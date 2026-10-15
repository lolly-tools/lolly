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
 *  3. The render canvas and the export stages keep the theme's own ink, with lolly-start's
 *     newsprint and with Opal, High contrast on or off. The page also loads the app's
 *     layer order with parts/base.css (the body colour tool markup inherits) and
 *     parts/a11y.css (the canvas boundary), because a pack's `ink` re-points
 *     --foreground and only that boundary keeps it out of an export.
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
const STYLES = join(REPO, 'shells/web/src/styles');
const TOKENS_CSS = readFileSync(join(STYLES, 'tokens.css'), 'utf8');
/** The app's layer order (styles/app.css), with parts/base.css and parts/a11y.css in the
 *  layers app.css imports them into. */
const LAYERED_CSS = (() => {
  const order = /@layer [\w\s,-]+;/.exec(readFileSync(join(STYLES, 'app.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ''));
  assert.ok(order, 'styles/app.css declares its layer order');
  const layer = (name: string, file: string): string => `@layer ${name} {\n${readFileSync(join(STYLES, file), 'utf8')}\n}`;
  return [order[0], layer('base', 'parts/base.css'), layer('a11y', 'parts/a11y.css')].join('\n');
})();

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

// ── The packs, resolved through the engine per theme ─────────────────────────

/** A token file's primaries and chrome, read as the web bridge reads them. */
async function pack(file: string) {
  const doc = JSON.parse(readFileSync(join(REPO, file), 'utf8'));
  const tokens = {
    resolve: async (ref: string, opts: { theme?: string } = {}) => createTokenSet(doc, { theme: opts.theme }).resolve(ref),
    themes: async () => createTokenSet(doc).themes(),
  };
  const pair = async (theme: string) => ({
    primary: tokenValueToHex(await tokens.resolve('{color.semantic.primary}', { theme })),
    onPrimary: tokenValueToHex(await tokens.resolve('{color.semantic.on-primary}', { theme })),
  });
  return { light: await pair('light'), dark: await pair('dark'), chrome: await resolvePackChrome(tokens, { toHex: tokenValueToHex, lc: apcaLcAbs }) };
}
const OPAL = await pack('tests/fixtures/pack-chrome/opal.json');
const FULL_SHEET = chromeBrandCss(OPAL.light, OPAL.dark, OPAL.chrome);
const CHROME_ONLY_SHEET = chromeBrandCss({ primary: null, onPrimary: null }, { primary: null, onPrimary: null }, OPAL.chrome);
/** lolly-start as the app boots it: its primaries and Lolly's newsprint room. */
const NEWSPRINT = await pack('brands/lolly-start/catalog/assets/lolly/tokens/brand.json');
const NEWSPRINT_SHEET = chromeBrandCss(NEWSPRINT.light, NEWSPRINT.dark, NEWSPRINT.chrome);

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

// ── The render canvas ────────────────────────────────────────────────────────

/** A page with the app's layered base and a11y sheets, tokens.css, a chrome sheet and
 *  one line of tool markup in each surface an export is captured from. */
async function openCanvas(sheet: string, html: { theme: 'light' | 'dark' | 'brand'; high: boolean }): Promise<Page> {
  const p = await browser!.newPage();
  p.on('pageerror', (e) => { throw e; });
  const attrs = `data-theme="${html.theme}"${html.high ? ' data-a11y-contrast="high"' : ''}`;
  await p.setContent(`<!doctype html><html ${attrs}><head><style>${LAYERED_CSS}</style><style>${TOKENS_CSS}</style>`
    + `<style id="brand-chrome-vars">${sheet}</style></head><body>`
    + '<div class="tool-canvas" id="tool-canvas"><p class="ink" id="in-canvas">Ink</p></div>'
    + '<div id="tool-content"><p class="ink" id="in-content">Ink</p></div>'
    + '<div class="pro-export-canvas"><p class="ink" id="in-export-stage">Ink</p></div>'
    + '<div class="me-scale"><div class="me-canvas"><p class="ink" id="in-multi-edit">Ink</p></div></div>'
    + '</body></html>');
  return p;
}

test("the render canvas keeps the theme's own ink with a pack's chrome, High contrast on or off", { skip }, async () => {
  for (const [name, sheet, chrome] of [['newsprint', NEWSPRINT_SHEET, NEWSPRINT.chrome], ['Opal', FULL_SHEET, OPAL.chrome]] as const) {
    for (const theme of ['light', 'dark', 'brand'] as const) {
      for (const high of [false, true]) {
        const label = `${name}, ${high ? 'High contrast ' : ''}${theme}`;
        const p = await openCanvas(sheet, { theme, high });
        const got = await p.evaluate(() => {
          const page = getComputedStyle(document.documentElement);
          const canvasInk = page.getPropertyValue('--foreground-canvas').trim();
          const probe = document.createElement('i');
          probe.style.color = `hsl(${canvasInk})`;
          document.body.append(probe);
          const want = getComputedStyle(probe).color;
          probe.remove();
          return {
            canvasInk,
            want,
            pageInk: page.getPropertyValue('--foreground').trim(),
            bodyColor: getComputedStyle(document.body).color,
            inks: [...document.querySelectorAll('.ink')].map((el) => ({
              id: el.id, color: getComputedStyle(el).color, foreground: getComputedStyle(el).getPropertyValue('--foreground').trim(),
            })),
          };
        });
        // The canvas ink is the theme's own: tokens.css's for light and dark, the
        // constructed brand theme's for brand (neither pack states brand chrome).
        if (theme !== 'brand') assert.equal(got.canvasInk, STATIC[theme].get('--foreground-canvas'), `${label}: the static canvas ink`);
        assert.equal(got.inks.length, 4);
        for (const ink of got.inks) {
          assert.equal(ink.color, got.want, `${label}: tool markup in #${ink.id} takes the canvas ink`);
          assert.equal(ink.foreground, got.canvasInk, `${label}: tool markup in #${ink.id} reads --foreground as the canvas ink`);
        }
        // Not vacuous: outside the canvas the page wears another ink, the pack's
        // in light and dark and the High contrast one in dark and brand.
        if (!high && theme !== 'brand') {
          assert.equal(got.pageInk, triple(chrome[theme]!.ink!), `${label}: the pack's ink is on the page`);
          assert.notEqual(got.bodyColor, got.want, `${label}: the body text wears the pack's ink`);
        }
        if (high && theme !== 'light') assert.notEqual(got.pageInk, got.canvasInk, `${label}: the High contrast ink is on the page`);
        await p.close();
      }
    }
  }
});
