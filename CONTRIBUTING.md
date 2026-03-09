# Contributing to FIRE App

## Development Setup

1. Clone and install dependencies:

   ```bash
   git clone https://github.com/<your-username>/FIreApp.git
   cd FIreApp
   npm install
   cd api && npm install
   ```

2. Set up environment:

   ```bash
   cp .env.local.example .env.local  # fill in your keys
   ```

3. Run Supabase migrations:

   ```bash
   npm run db:migrate
   ```

4. Start dev servers:

   ```bash
   npm run dev        # Next.js frontend — http://localhost:3000
   npm run dev:api    # Hono API server — http://localhost:3001
   ```

## Project Structure

```
├── api/                  # Hono API server (standalone)
│   ├── src/
│   │   ├── adapters/     # Provider adapters (CSV, manual, teller, snaptrade)
│   │   ├── lib/          # Shared utilities (crypto, env, supabase client)
│   │   ├── routes/       # Hono route handlers
│   │   ├── services/     # Business logic (ingest pipeline, dedup)
│   │   └── types/        # TypeScript interfaces and constants
│   └── tests/
│       ├── unit/         # Fast, no external deps
│       └── integration/  # Hits real Supabase (needs .env.local)
├── supabase/
│   └── migrations/       # SQL migrations (numbered: 001_, 002_, ...)
└── src/                  # Next.js frontend (app router)
```

## Branch Strategy

- `main` — production-ready, deploys automatically
- `dev` — active development, PRs merge here first
- Feature branches: `feature/<short-description>` off `dev`
- Bug fixes: `fix/<short-description>` off `dev`
- Maintenance: `chore/<short-description>` off `dev`

## Code Style

We use **ESLint** + **Prettier** enforced via a **husky** pre-commit hook.

- **Prettier**: single quotes, trailing commas, 100 char line width
- **ESLint**: TypeScript strict, no unused vars (prefix with `_` to ignore), no `console.log` (use `console.warn`/`console.error`)
- Run manually: `npm run lint` (both root + api), `npm run format`

The pre-commit hook runs `lint-staged` automatically — you don't need to remember to format.

## Commit Message Format

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short summary>
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Examples:

```
feat(csv): add Schwab positions export adapter
fix(dedup): handle overlapping date ranges across sources
test(ingest): add brokerage DRIP reinvestment scenario
chore(deps): update vitest to v4
```

## Testing

We use **Vitest** for all tests.

```bash
cd api

npm test              # run all tests once
npm run test:watch    # watch mode

# run specific test files
npx vitest run tests/unit/csv-adapter.test.ts
npx vitest run tests/integration/
```

### Expectations

- **Unit tests** for all adapters, utilities, and pure logic — no network calls
- **Integration tests** for database operations, ingest pipeline, and API routes — these hit a real Supabase instance
- New features should include tests. Bug fixes should include a regression test.
- Tests clean up after themselves (create test household, run assertions, delete everything)

### Writing Tests

- Use `createTestHousehold()` / `cleanupTestHousehold()` helpers for integration tests
- Group related tests in `describe` blocks
- Test both happy path and edge cases
- For CSV adapters: include realistic sample data matching real institution export formats

## BDD (Behavior-Driven Development)

Define behavior **before** writing implementation code.

- Write feature specs in plain language using **Given / When / Then** format
- Use descriptive test names that reflect expected behavior:
  ```ts
  it('flips sign for credit card convention', ...)
  it('auto-hides less authoritative source when cross-source duplicate detected', ...)
  ```
- Keep scenarios focused on a single behavior — avoid combining multiple assertions

## Database Migrations

Migrations live in `supabase/migrations/` with simple numbered names: `001_schema.sql`, `002_feature.sql`, etc.

```bash
npm run db:migrate    # push migrations to remote Supabase
npm run db:reset      # reset and re-run all migrations (destructive)
```

- Keep migrations additive when possible (add columns, not drop)
- In `dev`, we consolidate migrations freely since there's no production data
- Never modify a migration that's been applied to `main`

## PR Process

1. Create a feature branch from `dev`
2. Make changes, commit following the format above
3. Ensure lint passes: `npm run lint`
4. Ensure tests pass: `cd api && npm test`
5. Push your branch and open a PR against `dev`
6. Fill out the PR description with a summary of changes
7. Address review feedback before merging

## Key Conventions

- **Amounts**: negative = money out, positive = money in (across all adapters)
- **Dates**: always `YYYY-MM-DD` strings internally
- **Account types**: checking, savings, credit, brokerage, retirement, hsa, loan, mortgage, property, vehicle, other
- **Dedup**: DB constraints for same-source, `is_hidden`/`hidden_reason` for cross-source
- **RLS**: every table has `household_id` — all queries filter by household
- **ESM**: both root and api use ES modules (`"type": "module"`)
