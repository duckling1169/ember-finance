# Handoff: Why does Vercel emit one Serverless Function per App Router page?

**Status:** Unresolved root cause. A working _workaround_ is shipped (static export); this
investigation is about understanding the underlying behavior so we can (optionally) move back
to a single normal Next.js deployment that also hosts the Hono API.

**Goal for the research agent:** Explain _why_ Vercel's Next.js builder produced ~one
Serverless Function per App Router page for this project (blowing the Hobby 12-function cap),
when a local `next build` produces only **1** function. Confirm with hard evidence (the actual
Vercel build output / function manifest), then recommend whether a normal (non-static) deploy
is viable.

---

## The symptom

- Plan: Vercel **Hobby** (max **12 Serverless Functions per deployment**).
- Every production deploy with the default `nextjs` framework preset **ERRORed** with:
  `No more than 12 Serverless Functions can be added to a Deployment on the Hobby plan.`
- The function count **tracked the page count over time**: an older READY deploy reported
  `lambdaRuntimeStats: {"nodejs":6}` when the app had ~6 pages; once the app grew to ~13
  routes it crossed 12 and started failing. Strongly implies **one function per page**.

## The contradiction (the core mystery)

A local `next build` of the exact same commit produces **1** function:

```
Route (app)
┌ ○ /                      ○ = Static (prerendered, NOT a function)
├ ƒ /accounts/[id]         ƒ = Dynamic (the only on-demand route)
├ ○ /accounts  /activity  /budget  /flows  /holdings  /login
├ ○ /onboarding  /onboarding/quick-start  /planning  /settings
└ ○ /_not-found
```

- `.next/prerender-manifest.json` → **14 static routes**.
- `.next/routes-manifest.json` dynamicRoutes → **1** (`/accounts/[id]`).

So locally Next marks every page `○ Static` (no function). On Vercel they apparently become
per-page functions. **Same Next version, same bundler, same framework preset.** Not
reproducible locally.

## Environment / facts

- Next.js **16.1.6**, React 19, **App Router**, **Turbopack** is the build bundler
  (deploy metadata shows `"bundler": "turbopack"`; local `next build` also uses Turbopack).
- Node **24.x** on Vercel.
- All **12 page.tsx are `'use client'`** (pure client SPA; data comes from a separate Hono API
  over HTTP via SWR). No `next/image`. No `middleware.ts`. No `app/api/**/route.ts`. No
  `pages/` router. No `sitemap/robots/opengraph/icon` special files.
- 4 pages call `useSearchParams()` **without a `<Suspense>` boundary**
  (activity, flows, planning, onboarding). Local build does **not** error or mark them dynamic.
- Repo `duckling1169/ember-finance` is a **standalone git repo**, but locally it lives **inside
  a parent pnpm workspace** at `js/` (workspace file is OUTSIDE the repo). `next` is **hoisted
  to the parent `js/node_modules`** locally. On Vercel the repo is checked out standalone and
  installs its own deps.
- Vercel project: `prj_tr2w21xUSl4RenBiRa25dCL65qy4`, team `team_nwOu7Vzirub5iS4E198wVLXB`
  (slug `adam-behrmans-projects`). Settings: framework `nextjs`, `rootDirectory: null`
  (= repo root), `buildCommand/installCommand/outputDirectory: null` (all defaults).

## Hypotheses tested and RULED OUT

1. **Missing/different env vars at build forcing dynamic rendering.**
   `src/lib/supabase.ts` uses fallbacks (`process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321'`,
   key `|| 'missing-key'`), so it never throws at build. Tested: built with `.env.local` removed,
   and with `VERCEL=1 VERCEL_ENV=production CI=1` set → **still 1 function, all pages static**.
   Env is not it.

2. **Root-level `/api` directory convention turning `api/**/*.ts`into functions.**
Vercel docs: that convention applies to **"Other"/non-framework** projects, not the`nextjs`preset. With`framework: nextjs` it does not fire. (NOTE: it *does\* fire when you set
   `framework: null` — see "While fixing" below.)

3. **Monorepo / workspace-root mis-inference.**
   The repo has **no** `pnpm-workspace.yaml`; Vercel checks it out standalone. The
   "Next.js inferred your workspace root, but it may not be correct… from src/app" Turbopack
   error only reproduced **locally** because of the parent `js/` workspace. Setting
   `turbopack.root = import.meta.dirname` **broke the local build** (because `next` is hoisted to
   the parent `node_modules`, outside the app dir). This is a local-only artifact, not the Vercel
   cause.

4. **Vercel project misconfiguration.** All settings are defaults/correct (see above).

5. **Stale Vercel build cache.** A forced no-cache deploy
   (`vercel deploy --prod --force`) still hit the 12-function error.

6. **`output: 'export'` not set / not committed.** Verified the committed `next.config.ts` had
   `output: 'export'` (after an earlier commit-staging mistake was corrected) and it **still**
   produced the 12-function error — i.e. **Vercel appears to ignore `output: 'export'`** for this
   project under the `nextjs` preset. This is itself a second unexplained behavior worth confirming.

## What we could NEVER obtain (and why) — the key blocker

The **actual Vercel build-time route table / function manifest**. Every channel failed:

- MCP `get_deployment_build_logs` → `{ "events": [] }` (empty) for every deployment.
- CLI `vercel inspect <id> --logs` → prints only the `status ● Error` line, no build log.
- CLI `vercel deploy` → streams only high-level `Building…` then the error JSON, no route table.
- Vercel **dashboard** build log → for the function-limit failure it shows only
  "Build Failed: No more than 12 Serverless Functions…" with **no build log body**.
- Local `vercel build` → fails before producing `.vercel/output/` due to the parent-workspace
  Turbopack root error (hoisted `next`).

So we never saw the names of the functions Vercel created, nor Vercel's own `Route (app)` table.
**Getting this is the single most valuable next step.**

## While fixing it we learned (relevant to root cause)

The shipped workaround is: `output: 'export'` + `vercel.json` `{ framework: null, buildCommand:
"next build", outputDirectory: "out", cleanUrls: true }` + `.vercelignore` excluding
`api/ supabase/ docs/`. Result: **0 functions**, static deploy, READY, routes serve 200.

Two data points from that work bear on the mystery:

- With `framework: nextjs`: per-page functions (and `output: 'export'` ignored).
- With `framework: null`: the Next builder is bypassed, **but** the `/api` convention then turned
  the Hono `api/**/*.ts` files (12+) into functions → still hit 12 until `.vercelignore` excluded
  `api/`. (Confirms the `/api` convention is framework-gated.)

## Open questions for the research agent

1. **Why does `@vercel/next` emit one function per page** when local `next build` marks them all
   `○ Static`? Normal Next-on-Vercel consolidates to a small number of functions; per-page is
   abnormal. Is this Next 16 + Turbopack specific? An `@vercel/next` builder version issue? A
   consequence of _all pages being `'use client'`_? Of `useSearchParams()` without `<Suspense>`
   (does Vercel's build treat that as a dynamic/SSR bail-out where local Turbopack does not)?
2. **Why is `output: 'export'` ignored** by the `nextjs` preset for this project?
3. Are the "functions" actually per _page_, or per _route segment / RSC payload / something else_?
   (Need the manifest to know.)

## Concrete next steps (in priority order)

1. **Get the real function manifest — reproduce `vercel build` in a CLEAN checkout.**
   The local `vercel build` only failed because of the parent `js/` workspace. Clone the repo to a
   location **outside** any pnpm workspace (e.g. `/tmp/ember-clean`), install standalone
   (`pnpm install` or `npm install` in that copy), then:

   ```
   vercel pull --yes --environment=production --scope adam-behrmans-projects
   # temporarily REMOVE output:export / vercel.json framework:null to reproduce the ORIGINAL nextjs build
   vercel build
   ls .vercel/output/functions/          # <-- the function list we never saw
   cat .vercel/output/functions/*/.vc-config.json
   ```

   The directory names under `.vercel/output/functions/` will reveal whether it is one-per-page
   and why each page became a function.

2. **Watch a live build in the dashboard.** Trigger a deploy of a commit with the _original_
   `nextjs` preset (no export) and open the dashboard build log _while it builds_ — the
   `Route (app)` table and any "bail out to client-side rendering" / "dynamic server usage"
   warnings appear there even though the final errored log is empty.

3. **Test the `useSearchParams` + `<Suspense>` hypothesis.** Wrap the 4 offending pages in
   `<Suspense>` and do a normal (`framework: nextjs`, no export) deploy; see if the function count
   drops. This is the most likely "static-locally / dynamic-on-Vercel" mechanism.

4. **Check `@vercel/next` / Next 16.1.6 known issues** for App Router + Turbopack producing
   per-page functions or ignoring `output: 'export'`.

5. If root cause is found and fixable: collapse to a **single deployment** — normal Next build with
   the Hono API mounted as one catch-all `app/api/[[...route]]/route.ts` via `hono/vercel`'s
   `handle(app)` (one function), eliminating the separate API project, CORS, and
   `NEXT_PUBLIC_API_URL`.

## Useful references / IDs

- Frontend Vercel project: `prj_tr2w21xUSl4RenBiRa25dCL65qy4`
- Team: `team_nwOu7Vzirub5iS4E198wVLXB` / `adam-behrmans-projects`
- An ERRORed (function-limit) production deploy to inspect: `dpl_HJJhKvAB79xgpUUs5HPbtokkG8e4`
  (commit before the static-export workaround; `nextjs` preset).
- Files: `next.config.ts`, `vercel.json`, `.vercelignore`, `src/lib/swr.ts` (SWR hooks),
  `src/lib/api.ts` (`apiFetch`, `NEXT_PUBLIC_API_URL`), `src/lib/require-auth.tsx`.
- The shipped workaround commits: search git log for `fix(deploy):` around the
  "static export" / "framework:null" / "cleanUrls" messages.
