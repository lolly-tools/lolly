// SPDX-License-Identifier: MPL-2.0
/**
 * The reading components (packages/docs-render components.ts) in a real Chromium, with the
 * stylesheet both readers ship (shells/web/src/styles/parts/docs-components.css): what a
 * string test cannot show.
 *
 *  1. ADMONITIONS. Each kind opens with its large two-tone Etiquette icon, and both parts
 *     of every icon are painted from the theme's roles: the base in the ink, the accent in
 *     the colourway's action colour lifted to a mid lightness (a grey one stays grey), a
 *     warning's accent in the docs' caution ink, and High contrast's in the accent ink for
 *     words. Nothing overflows a phone.
 *
 * The markup is the renderer's own. A green run without Chromium means "not exercised":
 * the file skips by name where Playwright's Chromium is not installed
 * (`pnpm exec playwright install chromium`).
 *
 * Run directly: node --import ./tests/css-stub.mjs --test tests/docs-reading-components.browser.test.ts
 */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Browser, BrowserType, Page } from 'playwright';
import { mdToHtml, type DocsRenderContext } from '../packages/docs-render/src/index.ts';
import { etiquetteDocIcons } from '../docs/etiquette-icons.ts';

const REPO = fileURLToPath(new URL('..', import.meta.url));

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

const ICONS = etiquetteDocIcons();
const ctx = {
  lang: 'en', htmlLang: 'en', t: (en: string) => en,
  docIcon: (key: string) => ICONS[key] ?? '', docLogo: () => '', docLogoBlock: () => '',
  nextCredId: () => 'shot-cred-1', localizedShot: () => null, darkShot: () => null, shotSize: () => null,
  credential: () => null, tryLink: () => null, showcase: () => null, art: () => null,
} as unknown as DocsRenderContext;

const notes = mdToHtml([
  '::: note Saved in this browser', 'Your work stays on this device until you export it.', ':::', '',
  '::: warning Clearing site data removes saved work', 'Export a backup first, with a long-unbroken-word-that-must-wrap-somewhere-safely.', ':::', '',
  '::: check The instance answers', 'The health check returns **ok**.', ':::',
].join('\n'), ctx);

// The app's tokens, the in-app reader's bridge (it declares the caution ink, --warn) and the
// shared component sheet, in the order the app loads them.
const CSS = ['styles/tokens.css', 'styles/parts/docs.css', 'styles/parts/docs-components.css']
  .map((rel) => readFileSync(join(REPO, 'shells/web/src', rel), 'utf8')).join('\n');

const page = (width: number, body: string, root = ''): string => `<!doctype html><html lang="en"${root}><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><style>${CSS}
body{margin:0;font-family:sans-serif;background:var(--ui-color-surface-canvas);color:var(--ui-color-text-default)}
.docs-content{width:${width}px;max-width:100%;box-sizing:border-box;margin:0;padding:0 16px}
.docs-content .icon-list .li-icon svg{width:100%;height:100%;display:block}
</style></head><body><main class="docs-content">${body}</main></body></html>`;

async function open(viewport: number, html: string): Promise<Page> {
  const ctx = await browser!.newContext({ viewport: { width: viewport, height: 900 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => { throw e; });
  await p.setContent(html);
  return p;
}

/** Each admonition's icon size and its two painted colours, as the browser resolved them,
 *  each read back through a canvas as an rgb() string so any colour syntax compares. */
const admonitions = (p: Page) => p.evaluate(() => [...document.querySelectorAll('.doc-note')].map((n) => {
  const svg = n.querySelector('.doc-note-glyph svg.eti')!;
  const pen = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
  const read = (host: Element, name: string): string => {
    const probe = document.createElement('span');
    probe.style.color = `var(${name})`;
    host.append(probe);
    pen.clearRect(0, 0, 1, 1);
    pen.fillStyle = getComputedStyle(probe).color;
    pen.fillRect(0, 0, 1, 1);
    probe.remove();
    const [r, g, b] = pen.getImageData(0, 0, 1, 1).data;
    return `rgb(${r}, ${g}, ${b})`;
  };
  const accent = read(svg.parentElement!, '--eti-accent');
  const base = read(svg.parentElement!, '--eti-base');
  const role = (name: string) => read(n, name);
  return {
    kind: n.className.replace(/.*doc-note--/, ''), size: svg.getBoundingClientRect().width,
    hidden: svg.closest('[aria-hidden="true"]') !== null, kindWord: n.querySelector('.doc-visually-hidden')?.textContent,
    accent, base, ink: role('--ui-color-text-default'), accentInk: role('--ui-color-text-accent'), warn: role('--warn'),
  };
}));
const channels = (c: string): number[] => (c.match(/\d+/g) ?? []).slice(0, 3).map(Number);
const lightness = (c: string): number => { const [r, g, b] = channels(c); return (Math.max(r!, g!, b!) + Math.min(r!, g!, b!)) / 510; };

test('an admonition opens with a large decorative two-tone icon painted from the theme roles', { skip }, async () => {
  for (const theme of ['light', 'dark', 'brand']) {
    const p = await open(1440, page(720, notes, ` data-theme="${theme}"`));
    const got = await admonitions(p);
    assert.deepEqual(got.map((g) => g.kind), ['note', 'warning', 'check']);
    for (const g of got) {
      assert.ok(g.size >= 36 && g.size <= 44, `${theme} ${g.kind}: the icon is about 2.5rem, got ${g.size}`);
      assert.ok(g.hidden, 'the icon is decoration');
      assert.equal(g.base, g.ink, `${theme} ${g.kind}: the object is the ink`);
      assert.notEqual(g.accent, g.base, `${theme} ${g.kind}: the detail is a second colour`);
    }
    assert.match(got[0]!.kindWord ?? '', /^Note: /);
    assert.equal(got[0]!.accent, got[2]!.accent, 'a note and a check both take the colourway');
    assert.notEqual(got[1]!.accent, got[0]!.accent, 'a warning takes the caution ink');
    assert.ok(lightness(got[0]!.accent) >= 0.4, `${theme}: the accent is lifted off the ink, got ${got[0]!.accent}`);
    await p.context().close();
  }
});

test('a grey colourway keeps a grey accent, and High contrast paints the accent ink for words', { skip }, async () => {
  let p = await open(1440, page(720, notes, ' style="--primary:0 0% 11%"'));
  const [r, g, b] = channels((await admonitions(p))[0]!.accent);
  assert.ok(Math.max(r!, g!, b!) - Math.min(r!, g!, b!) < 6, 'a grey lead is not given a hue');
  await p.context().close();
  for (const theme of ['light', 'dark']) {
    p = await open(1440, page(720, notes, ` data-theme="${theme}" data-a11y-contrast="high"`));
    const got = await admonitions(p);
    assert.equal(got[0]!.accent, got[0]!.accentInk, `${theme}: High contrast takes --ui-color-text-accent`);
    assert.equal(got[1]!.accent, got[1]!.warn, `${theme}: a warning keeps the caution ink unlifted`);
    await p.context().close();
  }
});

test('admonitions fit a phone', { skip }, async () => {
  const p = await open(390, page(390, notes));
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'nothing scrolls sideways');
  const size = (await admonitions(p))[0]!.size;
  assert.ok(size >= 32 && size < 40, `the icon shrinks a step on a phone, got ${size}`);
  await p.context().close();
});
