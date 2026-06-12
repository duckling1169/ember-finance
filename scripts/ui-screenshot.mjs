// UI verification screenshots: captures routes in dark+light themes at
// desktop and phone widths. Requires the dev server running with
// NEXT_PUBLIC_DEV_BYPASS_AUTH=true.
//
// Usage: node scripts/ui-screenshot.mjs [route ...]
//   node scripts/ui-screenshot.mjs /holdings /flows
// No args = all main routes. Output: .screenshots/<route>-<theme>-<width>.png

// Playwright is not a project dependency; resolve it from a global/npx
// install via PLAYWRIGHT_DIR (a directory whose node_modules contains it).
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

const requireFrom = createRequire((process.env.PLAYWRIGHT_DIR ?? process.cwd()) + '/noop.js');
const { chromium } = requireFrom('playwright');

const BASE = process.env.UI_BASE_URL ?? 'http://localhost:3000';
const OUT = '.screenshots';

const ALL_ROUTES = [
  '/',
  '/accounts',
  '/holdings',
  '/activity',
  '/flows',
  '/budget',
  '/planning',
  '/assumptions',
  '/settings',
];

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'phone', width: 390, height: 844 },
];
const THEMES = ['dark', 'light'];

const routes = process.argv.slice(2).length ? process.argv.slice(2) : ALL_ROUTES;

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();

// Authenticate once via the dev login (requires web + API servers running),
// then reuse the storage state (Supabase session lives in localStorage).
const STATE = `${OUT}/auth-state.json`;
const { existsSync } = await import('node:fs');
if (!existsSync(STATE)) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.getByText('Dev Login (auto-generated)').click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 });
  await page.waitForTimeout(1000);
  await ctx.storageState({ path: STATE });
  await ctx.close();
  console.log('auth state saved');
}

for (const theme of THEMES) {
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      colorScheme: theme === 'dark' ? 'dark' : 'light',
      storageState: STATE,
    });
    await ctx.addInitScript(
      ([t]) => {
        window.localStorage.setItem('ember-theme', t);
      },
      [theme],
    );
    const page = await ctx.newPage();
    for (const route of routes) {
      const slug = route === '/' ? 'home' : route.replace(/^\//, '').replace(/[/?=&]/g, '_');
      try {
        await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 30000 });
        // Transient auth/household races can bounce to /login or /onboarding —
        // re-authenticate and retry once.
        if (/\/(login|onboarding)/.test(page.url()) && !/login|onboarding/.test(route)) {
          await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
          await page.getByText('Dev Login (auto-generated)').click();
          await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 });
          await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 30000 });
        }
        // theme class is applied client-side from localStorage
        await page.waitForTimeout(700);
        await page.screenshot({
          path: `${OUT}/${slug}-${theme}-${vp.name}.png`,
          fullPage: true,
        });
        console.log(`ok ${slug}-${theme}-${vp.name}`);
      } catch (err) {
        console.error(`FAIL ${slug}-${theme}-${vp.name}: ${err.message}`);
      }
    }
    // Supabase rotates refresh tokens; persist the latest session for the
    // next context or the auth silently dies mid-run.
    await ctx.storageState({ path: STATE });
    await ctx.close();
  }
}
await browser.close();
