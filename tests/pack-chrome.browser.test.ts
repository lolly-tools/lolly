// SPDX-License-Identifier: MPL-2.0
/**
 * A design pack's own chrome, in a real Chromium: the cascade the node suites can only
 * read as text. A page loads styles/tokens.css and the sheet chromeBrandCss builds from
 * the Opal fixture (tests/fixtures/pack-chrome/opal.json), then reads computed values:
 *
 *  1. Without High contrast, light and dark take the pack's page, cards and edges. A
 *     theme card marked dark inside a light page takes the pack's dark card.
 *  2. With High contrast on, every custom property tokens.css's High contrast light and
 *     dark blocks declare computes to tokens.css's own value, and so does the page: the
 *     pack's light and dark chrome steps aside and Lolly's measured room is what shows.
 *     The unsaved colour is not a surface and stays.
 *
 * A green run without Chromium means "not exercised": the file skips by name where
 * Playwright's Chromium is not installed (`pnpm exec playwright install chromium`).
 *
 * Run directly: node --import ./tests/css-stub.mjs --test tests/pack-chrome.browser.test.ts
 */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Browser, BrowserType, Page } from 'playwright';
import { createTokenSet } from '../engine/src/tokens.ts';
import { apcaLcAbs, chromeBrandCss, hexToHslTriple, tokenValueToHex } from '../shells/web/src/brand-vars.ts';
import { resolvePackChrome } from '../shells/web/src/lib/brand-chrome.ts';

const REPO = fileURLToPath(new URL('..', import.meta.url));
const TOKENS_CSS = readFileSync(join(REPO, 'shells/web/src/styles/tokens.css'), 'utf8');

async function chromiumOrSkip(): Promise<{ chromium: BrowserType } | string> {
  let chromium: BrowserType;
  try { ({ chromium } = await import('playwright')); } catch { return 'no Playwright (pnpm install)'; }
  try {
    const p = chromium.executablePath();
    if (!p || !existsSync(p)) return 'no Chromium (pnpm exec playwright install chromium)';
  } catch { return 'no Chromium (pnpm exec playwright install chromium)'; }
  return { chromium };
}
const browserOrReason = await chromiumOrSkip();
const skip = typeof browserOrReason === 'string' ? browserOrReason : false;

let browser: Browser | undefined;
before(async () => { if (typeof browserOrReason !== 'string') browser = await browserOrReason.chromium.launch({ headless: true }); });
after(async () => { await browser?.close(); });

// ── The Opal fixture, resolved through the engine per theme ──────────────────

const OPAL = await (async () => {
  const doc = JSON.parse(readFileSync(join(REPO, 'tests/fixtures/pack-chrome/opal.json'), 'utf8'));
  const tokens = {
    resolve: async (ref: string, opts: { theme?: string } = {}) => createTokenSet(doc, { theme: opts.theme }).resolve(ref),
    themes: async () => createTokenSet(doc).themes(),
  };
  const pair = async (theme: string) => ({
    primary: tokenValueToHex(await tokens.resolve('{color.semantic.primary}', { theme })),
    onPrimary: tokenValueToHex(await tokens.resolve('{color.semantic.on-primary}', { theme })),
  });
  return { light: await pair('light'), dark: await pair('dark'), chrome: await resolvePackChrome(tokens, { toHex: tokenValueToHex, lc: apcaLcAbs }) };
})();
const FULL_SHEET = chromeBrandCss(OPAL.light, OPAL.dark, OPAL.chrome);
const CHROME_ONLY_SHEET = chromeBrandCss({ primary: null, onPrimary: null }, { primary: null, onPrimary: null }, OPAL.chrome);

// ── tokens.css's own values, read as text ────────────────────────────────────

const BARE = TOKENS_CSS.replace(/\/\*[\s\S]*?\*\//g, '');
/** Declarations of the block whose selector is exactly `head` and which declares `marker`. */
function staticBlock(head: string, marker: string): Map<string, string> {
  for (const m of BARE.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    if (m[1]!.trim() !== head || !m[2]!.includes(marker)) continue;
    return new Map([...m[2]!.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((d) => [d[1]!, d[2]!.trim()]));
  }
  throw new Error(`tokens.css has no ${head} block declaring ${marker}`);
}
const STATIC = {
  light: staticBlock(':root,\n[data-theme="light"]', '--background'),
  dark: staticBlock('[data-theme="dark"]', '--background'),
};
const HIGH = {
  light: staticBlock('html[data-a11y-contrast="high"]:not([data-theme="dark"]):not([data-theme="brand"])', '--card'),
  dark: staticBlock('html[data-a11y-contrast="high"][data-theme="dark"]', '--card'),
};
/** The accent the pack's semantic primaries own, under High contrast as well. */
const ACCENT = new Set(['--primary', '--primary-foreground', '--ring']);

// ── The page ─────────────────────────────────────────────────────────────────

async function open(sheet: string, html: { theme: 'light' | 'dark' | 'brand'; high: boolean }): Promise<Page> {
  const p = await browser!.newPage();
  p.on('pageerror', (e) => { throw e; });
  const attrs = `data-theme="${html.theme}"${html.high ? ' data-a11y-contrast="high"' : ''}`;
  await p.setContent(`<!doctype html><html ${attrs}><head><style>${TOKENS_CSS}</style><style id="brand-chrome-vars">${sheet}</style></head>`
    + '<body><button class="profile-theme" data-theme="dark" id="card-dark">Dark</button>'
    + '<button class="profile-theme" data-theme="light" id="card-light">Light</button></body></html>');
  return p;
}

/** Computed custom properties on `selector`. */
async function computed(p: Page, selector: string, names: readonly string[]): Promise<Record<string, string>> {
  return p.evaluate(({ selector, names }) => {
    const el = document.querySelector(selector)!;
    const cs = getComputedStyle(el);
    return Object.fromEntries(names.map((n) => [n, cs.getPropertyValue(n).trim()]));
  }, { selector, names: [...names] });
}

const triple = (hex: string): string => hexToHslTriple(hex)!;

test("without High contrast, light and dark wear the pack's chrome, theme cards included", { skip }, async () => {
  const light = OPAL.chrome.light!, dark = OPAL.chrome.dark!;
  for (const [theme, c] of [['light', light], ['dark', dark]] as const) {
    const p = await open(FULL_SHEET, { theme, high: false });
    assert.deepEqual(await computed(p, 'html', ['--background', '--card', '--border']), {
      '--background': triple(c.page), '--card': triple(c.raised), '--border': triple(c.edge),
    }, theme);
    // The ink the render canvas restores under High contrast is never the pack's.
    assert.equal((await computed(p, 'html', ['--foreground-canvas']))['--foreground-canvas'], STATIC[theme].get('--foreground-canvas'));
    await p.close();
  }
  // A theme card marked dark inside a light page shows the pack's dark card, and one
  // marked light inside a dark page shows the pack's light card.
  const lp = await open(FULL_SHEET, { theme: 'light', high: false });
  assert.equal((await computed(lp, '#card-dark', ['--card']))['--card'], triple(dark.raised));
  await lp.close();
  const dp = await open(FULL_SHEET, { theme: 'dark', high: false });
  assert.equal((await computed(dp, '#card-light', ['--background']))['--background'], triple(light.page));
  await dp.close();
  // Opal declares no brand theme, so the brand theme is the construction, not pack chrome.
  const bp = await open(FULL_SHEET, { theme: 'brand', high: false });
  const brandPage = (await computed(bp, 'html', ['--background']))['--background'];
  assert.notEqual(brandPage, triple(light.page));
  assert.notEqual(brandPage, triple(dark.page));
  await bp.close();
});

test("with High contrast on, Lolly's High contrast room shows in light and dark, whatever the pack declares", { skip }, async () => {
  for (const [label, sheet] of [['chrome only', CHROME_ONLY_SHEET], ['chrome and accent', FULL_SHEET]] as const) {
    for (const theme of ['light', 'dark'] as const) {
      const p = await open(sheet, { theme, high: true });
      const names = [...new Set([...HIGH[theme].keys(), '--background'])].filter((n) => label === 'chrome only' || !ACCENT.has(n));
      const got = await computed(p, 'html', names);
      for (const name of names) {
        const want = HIGH[theme].get(name) ?? STATIC[theme].get(name);
        assert.equal(got[name], want, `${label}, High contrast ${theme}: ${name}`);
      }
      // A theme card under High contrast is Lolly's own too.
      const other = theme === 'light' ? 'dark' : 'light';
      assert.equal((await computed(p, `#card-${other}`, ['--card']))[`--card`], STATIC[other].get('--card'), `${label}: the ${other} card`);
      // The unsaved colour is not a surface: it stays under High contrast.
      assert.equal((await computed(p, 'html', ['--brand-warn']))['--brand-warn'], theme === 'light' ? '#b57c0a' : '#fac044');
      await p.close();
    }
  }
});
