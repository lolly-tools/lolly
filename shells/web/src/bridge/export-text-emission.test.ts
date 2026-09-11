// SPDX-License-Identifier: MPL-2.0
/**
 * Characterization tests for the `<path>` EMISSION inside renderSvgFromHtml
 * (export-svg-walker.ts, extracted from export.ts on 2026-09-08) - the seam
 * plans/archive/maintainability-2026-07-29.md item 1 names as the
 * largest untested surface in the repo, and the blocker on decomposing the
 * biggest file.
 *
 * WHAT WAS ALREADY COVERED, AND WHY THAT WASN'T ENOUGH
 * `host.text.toPath` has a real-HarfBuzz golden suite (text-outline-golden.test.ts),
 * and the pure helpers (text-svg.ts, font-registry.ts) have their own. So glyph
 * outlines were proven correct in isolation. What nothing asserted was the
 * DECISION layer around them inside export.ts: which runs get outlined at all,
 * which fall back to `<text>`, and whether the surrounding CSS (letter-spacing,
 * variable weight, text-transform) reaches the shaper. That is precisely where
 * this project's own notes record the historical drift - glyph mangling, pill to
 * ellipse, the inline-flex drop. Every test here asserts an emission DECISION, not
 * glyph geometry, so it stays honest if HarfBuzz's output ever legitimately moves.
 *
 * A REAL CHROMIUM IS THE ORACLE. Every decision hinges on getComputedStyle
 * resolving a font stack, a used weight and a letter-spacing - jsdom has no font
 * matching, so it cannot answer any of them. Same harness shape as
 * export-m3.test.ts (esbuild bundle → page.addScriptTag), which is why the
 * `chromiumOrSkip` dance below looks familiar.
 *
 * THIS TIER IS BRAND-INDEPENDENT ON PURPOSE. The existing golden suite needs SUSE
 * font files under `catalog/fonts/`, a gitignored profile view, so it skips on the
 * `lolly-start` profile and in public CI - the second gap the audit called out.
 * This file instead uses `Outfit[wght].ttf`, which is committed in the WEB SHELL's
 * own `public/fonts/` and is therefore present on every clone regardless of
 * profile. It is also a variable font (wght 100..900), which is what makes the
 * variable-weight case below possible without a brand pack.
 *
 * Run directly: node --test shells/web/src/bridge/export-text-emission.test.ts
 */
import test from 'node:test';
import type { HostV1, TextAPI } from '@lolly-tools/core/host-v1';
import type { renderSvgFromHtml } from './export-svg-walker.ts';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const EXPORT_MODULE = fileURLToPath(new URL('./export.ts', import.meta.url));
// bridge/ -> src/ -> web/ -> shells/ -> repo root.
const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

/** The platform face, committed in the web shell itself - not a brand asset. */
const OUTFIT_TTF = join(REPO_ROOT, 'shells/web/public/fonts/Outfit[wght].ttf');
const HB_WASM = join(REPO_ROOT, 'node_modules/harfbuzzjs/dist/harfbuzz.wasm');

async function chromiumOrSkip(): Promise<{ chromium: any } | string> {
  if (!existsSync(OUTFIT_TTF)) return `missing ${OUTFIT_TTF}`;
  if (!existsSync(HB_WASM)) return 'harfbuzzjs wasm not installed';
  let chromium: any;
  try { ({ chromium } = await import('playwright')); }
  catch { return 'playwright not installed'; }
  try {
    const p = chromium.executablePath();
    if (!p || !existsSync(p)) return 'no Chromium (pnpm exec playwright install chromium)';
  } catch { return 'no Chromium (pnpm exec playwright install chromium)'; }
  return { chromium };
}

const browser = await chromiumOrSkip();
const SKIP = typeof browser === 'string' ? browser : false;

let bundleCache: string | null = null;
async function bundle(): Promise<string> {
  if (bundleCache) return bundleCache;
  const { build } = await import('esbuild');
  const out = await build({
    stdin: {
      // createExportAPI is what assigns export.ts's module-level `_host`, and the
      // outlining branch is gated on `_host?.text` - without this call every run
      // silently falls back to <text> and the whole suite would pass vacuously.
      // The `emits a <path>` test is the canary for exactly that mistake.
      contents: `import { renderSvgFromHtml, createExportAPI } from ${JSON.stringify(EXPORT_MODULE)};
                 import { createTextAPI } from ${JSON.stringify(join(HERE, 'text.ts'))};
                 window.__setup = (overrides = {}) => createExportAPI({ text: createTextAPI(), log: () => {}, ...overrides });
                 window.__makeText = createTextAPI;
                 window.__render = renderSvgFromHtml;`,
      resolveDir: HERE, loader: 'ts',
    },
    bundle: true, write: false, format: 'esm', platform: 'browser',
    // export.ts reaches a CSS side-effect import through a lazy chain (the durable
    // probe in format-support.ts); esbuild has no output path here, so drop the sheets.
    loader: { ".css": "empty" },
    target: 'esnext', logLevel: 'silent',
    plugins: [{
      // harfbuzzjs's dist/harfbuzz.js does `await import("module")` for a Node
      // createRequire. The real Vite build externalises it for the browser (it
      // logs that warning on every build); esbuild needs it said explicitly. The
      // branch is unreachable in a browser, so an inert createRequire is faithful.
      name: 'stub-node-module',
      setup(b: any) {
        b.onResolve({ filter: /^module$/ }, () => ({ path: 'module', namespace: 'stub-node-module' }));
        b.onLoad({ filter: /.*/, namespace: 'stub-node-module' }, () => ({
          contents: 'export function createRequire(){ return () => ({}); }\nexport default { createRequire };',
          loader: 'js',
        }));
      },
    }],
  });
  bundleCache = out.outputFiles[0]!.text;
  return bundleCache;
}

const FONT_CSS =
  `@font-face{font-family:Outfit;src:url('/fonts/Outfit[wght].ttf') format('truetype');font-weight:100 900}`;

/** One browser for the whole file - launching per test dominates the runtime. */
let shared: any = null;
async function page(): Promise<any> {
  const { chromium } = browser as { chromium: any };
  if (!shared) {
    shared = await chromium.launch({
      // Match the production node-shell/MCP launchers (packages/node-shell/src/
      // browsers.ts) so these BYTE goldens pin the rendering intent users get:
      // host-profile-independent sRGB + unhinted glyph metrics.
      args: ['--force-color-profile=srgb', '--font-render-hinting=none'],
    });
    shared.__page = await shared.newPage({ viewport: { width: 900, height: 700 } });
    // setContent gives the page a null origin with no server, so the @font-face
    // URL and HarfBuzz's wasm both have to be served here. Serving the font by
    // ROUTE (rather than inlining a data: URL) keeps font-registry on its real
    // resolve-a-URL path instead of a shape this app never actually takes.
    await shared.__page.route('**/*', async (route: any) => {
      const p = decodeURIComponent(new URL(route.request().url()).pathname);
      if (p === '/fonts/Outfit[wght].ttf') {
        return route.fulfill({ status: 200, contentType: 'font/ttf', body: readFileSync(OUTFIT_TTF) });
      }
      if (p.endsWith('.wasm')) {
        return route.fulfill({ status: 200, contentType: 'application/wasm', body: readFileSync(HB_WASM) });
      }
      if (p === '/') return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><body></body>' });
      return route.fulfill({ status: 404, body: '' });
    });
    await shared.__page.goto('http://localhost/');
  }
  return shared.__page;
}
test.after(async () => { if (shared) await shared.close(); });

/** Render `inner` inside #root and return the exported SVG source. */
async function render(inner: string, opts: Record<string, unknown> = {}): Promise<string> {
  const pg = await page();
  await pg.setContent(`<!doctype html><body style="margin:0"><style>${FONT_CSS}</style>` +
    `<div id="root" style="width:500px;height:150px;background:#fff">${inner}</div></body>`);
  await pg.evaluate(() => (document as any).fonts.ready);
  await pg.addScriptTag({ content: await bundle(), type: 'module' });
  await pg.waitForFunction(() => !!(window as any).__render);
  return await pg.evaluate(async (o: Record<string, unknown>) => {
    (window as any).__setup();
    const blob = await (window as any).__render(document.getElementById('root'),
      { rasterFallback: false, ...o });
    return await blob.text();
  }, opts);
}

const pathCount = (s: string): number => (s.match(/<path\b/g) ?? []).length;
const textCount = (s: string): number => (s.match(/<text\b/g) ?? []).length;
/** The `d` attribute of every emitted <path>, in document order. */
const pathData = (s: string): string[] => [...s.matchAll(/<path d="([^"]+)"/g)].map((m) => m[1] as string);

const OUTFIT = (t: string, extra = ''): string =>
  `<div style="font-family:Outfit;font-size:24px;${extra}">${t}</div>`;

// ── the two core decisions ───────────────────────────────────────────────────

test('a run whose font resolves is emitted as <path> glyph outlines, not <text>',
  { skip: SKIP }, async () => {
    const svg = await render(OUTFIT('Hello Outfit'));
    assert.ok(pathCount(svg) >= 1, 'expected at least one <path> of glyph outlines');
    assert.doesNotMatch(svg, /<text[^>]*>[^<]*Hello Outfit/,
      'the run resolved to a real font file, so it must NOT remain a <text> element');
    // Guards the whole file against passing vacuously: if createExportAPI were
    // never called, _host.text would be null, every run would fall back to
    // <text>, and only this assertion would notice.
    assert.match(pathData(svg)[0] ?? '', /^M[\d.,\- ]/, 'the <path> must carry real outline data');
  });

test('a run with no resolvable font file falls back to <text>', { skip: SKIP }, async () => {
  // The documented fallback: font-registry resolves nothing for this family, so
  // outlining is skipped and the run stays selectable text naming the family.
  const svg = await render(
    `<div style="font-family:'No Such Family XYZ',monospace;font-size:18px">Fallback run</div>`);
  assert.match(svg, /Fallback run/, 'the text must still be present');
  assert.equal(pathCount(svg), 0, 'nothing resolved, so no glyph outlines may be emitted');
  assert.ok(textCount(svg) >= 1, 'the run must survive as a <text> element');
});

// ── CSS that must reach the shaper ───────────────────────────────────────────

test('letter-spacing reaches the shaper and changes the emitted geometry',
  { skip: SKIP }, async () => {
    const tight = pathData(await render(OUTFIT('AVWA')))[0];
    const loose = pathData(await render(OUTFIT('AVWA', 'letter-spacing:6px')))[0];
    assert.ok(tight && loose, 'both runs must outline');
    assert.notEqual(tight, loose,
      'letter-spacing was dropped on the way to toPath - the glyphs would export at the wrong advances');
  });

test('a variable-font weight reaches the shaper (Outfit is wght 100..900)',
  { skip: SKIP }, async () => {
    const light = pathData(await render(OUTFIT('Weight', 'font-weight:200')))[0];
    const heavy = pathData(await render(OUTFIT('Weight', 'font-weight:800')))[0];
    assert.ok(light && heavy, 'both weights must outline');
    assert.notEqual(light, heavy,
      'both weights produced identical outlines - the variations axis is not being passed, ' +
      'so every weight would export at the default instance');
  });

test('text-transform is applied BEFORE shaping, not left to the renderer',
  { skip: SKIP }, async () => {
    // An outlined path has no text-transform to apply later, so the transform has
    // to happen before toPath or the export silently shows the untransformed text.
    const transformed = pathData(await render(OUTFIT('abc', 'text-transform:uppercase')))[0];
    const literal = pathData(await render(OUTFIT('ABC')))[0];
    assert.ok(transformed && literal, 'both runs must outline');
    assert.equal(transformed, literal,
      'uppercased "abc" must shape identically to a literal "ABC"');
  });

test('font-feature-settings reaches the shaper (frac changes the emitted geometry)',
  { skip: SKIP }, async () => {
    // featureSettingsToHb (the parser) is covered in text-svg.test.ts; this is
    // the missing half - proof the COMPUTED style actually reaches toPath
    // through export.ts. `frac` is a discretionary feature only reachable via
    // font-feature-settings (no CSS default turns it on), and probing Outfit
    // through the real HarfBuzz confirmed it is effective in this face (as are
    // kern/liga/tnum), so identical outlines here mean the feature was dropped
    // on the way to the shaper.
    const plain = pathData(await render(OUTFIT('1/2')))[0];
    const frac = pathData(await render(OUTFIT('1/2', "font-feature-settings:'frac' 1")))[0];
    assert.ok(plain && frac, 'both runs must outline');
    assert.notEqual(plain, frac,
      'font-feature-settings was dropped on the way to toPath - declared OpenType ' +
      'features would silently not apply to vector exports');
  });

// ── the refusal paths ────────────────────────────────────────────────────────

test('a run the font cannot cover (notdef) keeps its <text> instead of emitting tofu',
  { skip: SKIP }, async () => {
    // Outfit has no CJK. export.ts refuses the path when toPath reports notdef
    // glyphs - emitting them would bake a row of .notdef boxes into the artwork,
    // which is worse than a <text> the viewer's own fonts can still render.
    const svg = await render(OUTFIT('漢字テスト'));
    assert.equal(pathCount(svg), 0, 'uncovered glyphs must NOT be outlined');
    assert.ok(textCount(svg) >= 1, 'the run must survive as <text>');
  });

test('CHARACTERIZATION: a mixed run (covered Latin + one uncovered CJK char) falls back to <text> as a WHOLE',
  { skip: SKIP }, async () => {
    // Characterization, not judgement: this pins what export.ts does TODAY with
    // a run the font only partly covers (Outfit shapes the Latin, but the CJK
    // char is .notdef - HarfBuzz probe: notdef=1 with real outline data for the
    // rest). Observed behaviour: the notdef refusal is per-RUN, so the whole
    // run - including the perfectly coverable Latin - stays a single <text>;
    // there is no split-run or per-glyph tofu path. If a future change splits
    // the run and outlines the covered segment, update this test deliberately.
    const svg = await render(OUTFIT('Latin 漢 mix'));
    assert.equal(pathCount(svg), 0, 'today, NO part of a partly-covered run is outlined');
    assert.ok(textCount(svg) >= 1, 'the run survives as <text>');
    assert.match(svg, /Latin/, 'the covered Latin stays inside the fallback <text>');
    assert.match(svg, /漢/, 'the uncovered char stays inside the fallback <text>');
  });

test('convertPaths:false keeps every run as selectable <text>', { skip: SKIP }, async () => {
  // The user-facing "Convert paths" toggle. Same markup as the first test, which
  // DOES outline - so this pins the toggle itself, not an accident of the fixture.
  const svg = await render(OUTFIT('NoConvert'), { convertPaths: false });
  assert.equal(pathCount(svg), 0, 'convertPaths:false must suppress every outline');
  assert.match(svg, /NoConvert/, 'the text must be present and selectable');
});

// ── the property a snapshot suite depends on ─────────────────────────────────

test('emission is deterministic - the same markup exports byte-identical SVG',
  { skip: SKIP }, async () => {
    // Item 1's plan is to pin these formats as exact snapshots before splitting
    // export.ts. That is only sound if the output is stable; this is the check
    // that says so, and it would catch an id counter or Map iteration order
    // leaking into the bytes.
    const a = await render(OUTFIT('Same'));
    const b = await render(OUTFIT('Same'));
    assert.equal(a, b, 'two identical renders diverged - the output is not snapshot-safe');
  });

// ── tiled conic backgrounds (the transparency checkerboard) ──────────────────

test('a TILED conic background becomes one <pattern>, not an element-sized sweep',
  { skip: SKIP }, async () => {
    // The stage's transparency checkerboard is
    //   repeating-conic-gradient(...) 50% / 2em 2em
    // Until 2026-07-30 the walker passed the ELEMENT box to parseConicGradient and
    // fanned wedges across it, ignoring background-size - so a 32px checkerboard
    // rendered as a single 800x500 four-quadrant sweep. Not a raster, but silently
    // WRONG PIXELS, which is worse. Chromium cannot help here either: PDF has no
    // conic shading type, so the print path rasterises it (measured), which makes
    // the walker the only way to get a crisp checkerboard.
    const svg = await render(
      `<div style="width:200px;height:120px;background:` +
      `repeating-conic-gradient(rgba(255,255,255,.025) 0% 25%, rgba(0,0,0,.025) 0% 50%) 50% / 2em 2em"></div>`);
    const pats = svg.match(/<pattern\b[^>]*>/g) ?? [];
    assert.equal(pats.length, 1, 'expected exactly one <pattern> for the tiled conic');
    assert.match(pats[0] as string, /width="32"/, 'the pattern tile must be the 2em background-size, not the element width');
    assert.match(pats[0] as string, /height="32"/);
    assert.equal((svg.match(/<image\b/g) ?? []).length, 0, 'a tiled conic must never rasterise');
  });

test('an UNTILED conic with a real RAMP is still emitted as a wedge fan', { skip: SKIP }, async () => {
  // Guards the sampling path: a genuine colour ramp has no exact vector form, so it
  // stays a fan. (The fixture here used to be a hard-stopped gradient, which now takes
  // the exact-sector path below - a fan was never the RIGHT answer for it, only the
  // answer we had.)
  const svg = await render(
    `<div style="width:200px;height:120px;background:` +
    `conic-gradient(red, yellow, lime, aqua, blue, magenta, red)"></div>`);
  assert.equal((svg.match(/<pattern\b/g) ?? []).length, 0, 'an untiled conic must not become a pattern');
  assert.ok((svg.match(/<path\b/g) ?? []).length > 8, 'expected a wedge fan');
  assert.equal((svg.match(/<image\b/g) ?? []).length, 0);
});

test('a TILED gradient layer becomes a <pattern>, not an element-sized sweep',
  { skip: SKIP }, async () => {
    // The editor stage's transparency checkerboard: two 45deg linear-gradient layers at
    // `24px 24px`, offset `0 0, 12px 12px`. A gradient is sized by background-size like
    // any other background image, but only the conic and url() branches tiled - so this
    // had no honest vector form and fell to the raster escape hatch. Measured: a
    // 1080x676, 53 KB PNG of a faint checkerboard inside docs/shots/use-chart-output.svg.
    const svg = await render(
      `<div style="width:240px;height:144px;background-color:hsl(210 20% 92%);background-image:` +
      `linear-gradient(45deg, rgba(0,0,0,.045) 25%, transparent 25%, transparent 75%, rgba(0,0,0,.045) 75%),` +
      `linear-gradient(45deg, rgba(0,0,0,.045) 25%, transparent 25%, transparent 75%, rgba(0,0,0,.045) 75%);` +
      `background-size:24px 24px;background-position:0 0, 12px 12px"></div>`);
    const pats = svg.match(/<pattern\b[^>]*>/g) ?? [];
    assert.equal(pats.length, 2, 'one pattern per tiled layer');
    for (const pat of pats) {
      assert.match(pat, /width="24"/, 'the tile is the background-size, not the element width');
      assert.match(pat, /height="24"/);
    }
    assert.equal((svg.match(/<image\b/g) ?? []).length, 0, 'a tiled gradient must never rasterise');
    // The second layer is phased by background-position: 12px on a 24px tile.
    assert.ok(pats.some((pt) => /\bx="12"/.test(pt) && /\by="12"/.test(pt)),
      'the offset layer keeps its phase');
  });

test('an UNTILED gradient still fills the element directly, with no pattern',
  { skip: SKIP }, async () => {
    // The other side of the branch: `background-size` absent (or covering) means the
    // gradient spans the box, and that path must stay exactly as it was.
    const svg = await render(
      `<div style="width:240px;height:144px;background-image:` +
      `linear-gradient(90deg, rgb(255,0,0), rgb(0,0,255))"></div>`);
    assert.equal((svg.match(/<pattern\b/g) ?? []).length, 0);
    assert.equal((svg.match(/<linearGradient\b/g) ?? []).length, 1);
    assert.equal((svg.match(/<image\b/g) ?? []).length, 0);
  });

test('a HARD-STOPPED conic emits one EXACT sector per band, not a sampled fan',
  { skip: SKIP }, async () => {
    // `A 0 25%, B 0 50%` is the checkerboard idiom: constant-colour bands with
    // instantaneous transitions. A uniform fan puts wedge edges where the colour does
    // NOT change, and each carries the deliberate 0.004rad overlap that stops
    // antialiasing seams - so a 14px checker tile came out with a faint diagonal
    // hairline across every square. Measured on docs/shots/use-chart-output.svg.
    const svg = await render(
      `<div style="width:200px;height:120px;background:` +
      `repeating-conic-gradient(rgb(255,0,0) 0% 25%, rgb(0,0,255) 0% 50%)"></div>`);
    const paths = svg.match(/<path\b[^>]*>/g) ?? [];
    assert.equal(paths.length, 4, 'two bands x two periods around the circle - exact, not sampled');
    assert.equal((svg.match(/<image\b/g) ?? []).length, 0);
    // Both colours survive, and neither is a blend of the two (which is what a fan
    // sampling across a hard boundary would produce).
    assert.equal(paths.filter((p) => /fill="#ff0000"/.test(p)).length, 2, 'the first band, once per period');
    assert.equal(paths.filter((p) => /fill="#0000ff"/.test(p)).length, 2, 'the second band');
  });

test('a fully TRANSPARENT band paints nothing at all', { skip: SKIP }, async () => {
  // The checker's clear squares are `transparent`. Emitting them as zero-alpha paths is
  // pure weight in every exported file - half the sectors, painting nothing.
  const svg = await render(
    `<div style="width:200px;height:120px;background:` +
    `repeating-conic-gradient(rgb(255,0,0) 0% 25%, transparent 0% 50%)"></div>`);
  const paths = svg.match(/<path\b[^>]*>/g) ?? [];
  assert.equal(paths.length, 2, 'only the two opaque bands are emitted');
  assert.ok(paths.every((p) => !/fill-opacity="0"/.test(p)));
});

// ── self-containment: every <image> href must be inlinable ───────────────────

test('an <img> with a PATH src is inlined as a data: URI, not left as a fetchable href',
  { skip: SKIP }, async () => {
    // A docs screenshot is served as `<img src="/info/shots/x.svg">`, and an SVG
    // consumed that way runs in SECURE STATIC MODE with no network access - so a
    // bare `href="/catalog/thumb.png"` renders blank and the file is not
    // self-contained. Until 2026-07-30 only data: and blob: were inlined; an
    // http/relative src fell through verbatim. The sibling CSS-url branch
    // (cssUrlToHref) already fetched http, so this was an inconsistency, not a
    // deliberate exemption. It is the hard blocker on migrating the docs corpus to
    // the walker: any shot framing a catalogue thumbnail would lose its images.
    const pg = await page();
    await pg.route('**/thumb-fixture.png', (route: any) => route.fulfill({
      status: 200, contentType: 'image/png',
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        'base64'),
    }));
    const svg = await render('<img src="/thumb-fixture.png" width="40" height="30">');
    assert.match(svg, /<image[^>]*href="data:image\//, 'the path src must be inlined as a data: URI');
    assert.doesNotMatch(svg, /href="https?:\/\/[^"]*thumb-fixture/, 'no fetchable href may survive');
    assert.doesNotMatch(svg, /href="\/thumb-fixture/, 'no root-relative href may survive');
  });

// ── CSS url() parsing: the select chevron ────────────────────────────────────

test('a background-image whose data-URI contains quotes is emitted, not dropped',
  { skip: SKIP }, async () => {
    // firstCssUrl matched `(["\']?)([^)"\']+)\\1` - a character class banning BOTH
    // quote marks from the URL body. An inline SVG data-URI is full of
    // `xmlns=\'…\'`, so the match failed, firstCssUrl returned null, the background
    // branch never ran, and NOTHING was emitted. That silently removed the select
    // chevron (--field-chevron, styles/parts/fields.css:42 - one declaration, on
    // every <select> in the app) from every SVG and PDF export, not just docs
    // screenshots. Measured before the fix: 0 <image> for this markup.
    const chevron = "url(\"data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' "
      + "width=\'14\' height=\'14\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23888888\'"
      + "%3E%3Cpolyline points=\'6 9 12 15 18 9\'/%3E%3C/svg%3E\")";
    const svg = await render(
      `<style>.chev{width:200px;height:36px;background-color:#fff;background-image:${chevron};`
      + `background-repeat:no-repeat;background-position:right 10px center}</style>`
      + `<div class="chev"></div>`);
    assert.ok((svg.match(/<image\b/g) ?? []).length >= 1,
      'the quoted SVG data-URI background must be emitted');
    assert.match(svg, /href="data:image\/svg\+xml/, 'and inlined as a data: URI');
  });

test('a plain path and an unquoted url() still parse (no regression from the quote fix)',
  { skip: SKIP }, async () => {
    const pg = await page();
    await pg.route('**/bg-fixture.png', (route: any) => route.fulfill({
      status: 200, contentType: 'image/png',
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        'base64'),
    }));
    const svg = await render(
      '<style>.bg{width:60px;height:40px;background-image:url(/bg-fixture.png);'
      + 'background-repeat:no-repeat}</style><div class="bg"></div>');
    assert.match(svg, /<image[^>]*href="data:image\//, 'an unquoted path url() must still resolve and inline');
  });

// ── gradient stop offsets ────────────────────────────────────────────────────

test('an absolute px stop position becomes a fraction of the gradient line, not "Npx"',
  { skip: SKIP }, async () => {
    // <stop offset> takes a number 0-1 or a percentage. A raw "25px" is invalid SVG:
    // resvg discards it outright (both stops of a two-stop strip collapse to the last
    // colour) and the render drifts far from the browser's. parseRadialGradient has
    // always divided a px stop by rx; this pins the linear analogue, dividing by the
    // gradient-line length (2*len). On a 100px-wide box at 90deg the line is 100px,
    // so 25px is exactly 25%.
    const svg = await render(
      '<style>.g{width:100px;height:30px;background-image:'
      + 'linear-gradient(90deg,#f00 0px,#f00 25px,#00f 25px,#00f 100px)}</style><div class="g"></div>');
    const offs = [...svg.matchAll(/offset="([^"]+)"/g)].map((m) => m[1] as string);
    assert.ok(offs.length >= 4, `expected 4 stops, got ${offs.length}`);
    assert.deepEqual(offs.slice(0, 4), ['0%', '25%', '25%', '100%']);
    assert.equal(offs.some((o) => o.endsWith('px')), false, 'no px offset may survive');
  });

test('a percentage-only gradient is untouched by the px conversion', { skip: SKIP }, async () => {
  // The common case by far, so it must not churn a single byte of existing exports
  // or committed docs baselines.
  const svg = await render(
    '<style>.g{width:100px;height:30px;background-image:'
    + 'linear-gradient(90deg,#0ea5e9 0%,#9333ea 100%)}</style><div class="g"></div>');
  assert.deepEqual([...svg.matchAll(/offset="([^"]+)"/g)].map((m) => m[1]), ['0%', '100%']);
});

// ── scaled ancestors: computed lengths vs client rects ───────────────────────

test('text inside a SCALED element exports at the size the browser paints it',
  { skip: SKIP }, async () => {
    // A client rect carries an ancestor's scale; a computed length does not. Walking a
    // scaled subtree on the AABB path therefore lands every box correctly while leaving
    // every getComputedStyle length 1/s too big. Measured on the Design docs
    // shot: a 1080px artboard displayed at 868 (`matrix(0.8037…)`) exported its headline
    // 1/0.8037 = 24.4% oversize, overflowing the card it fits on screen.
    //
    // The oracle is the BROWSER's own ink width for the same run, so this stays honest
    // if HarfBuzz's metrics ever legitimately move.
    const pg = await page();
    await pg.setContent(`<!doctype html><body style="margin:0"><style>${FONT_CSS}</style>` +
      `<div id="root" style="width:500px;height:150px;background:#fff">` +
      `<div style="transform:scale(0.5);transform-origin:0 0;width:1000px;height:300px">` +
      `<span id="run" style="font-family:Outfit;font-size:64px;font-weight:700;white-space:nowrap">Design once</span>` +
      `</div></div></body>`);
    await pg.evaluate(() => (document as any).fonts.ready);
    await pg.addScriptTag({ content: await bundle(), type: 'module' });
    await pg.waitForFunction(() => !!(window as any).__render);
    const r = await pg.evaluate(async () => {
      (window as any).__setup();
      const painted = document.getElementById('run')!.getBoundingClientRect().width;  // scaled by 0.5
      const blob = await (window as any).__render(document.getElementById('root'), { rasterFallback: false });
      const svg = await blob.text();
      // Measure the emitted ink the same way the browser measures the run.
      const host = document.createElement('div');
      host.style.cssText = 'position:absolute;left:-9999px;top:0';
      host.innerHTML = svg;
      document.body.appendChild(host);
      // getBoundingClientRect, NOT getBBox: getBBox reports the element's own user
      // space and ignores ancestor transforms - including the very <g transform> the
      // scale fix emits, which would make this measure the bug it is meant to catch.
      let x0 = Infinity, x1 = -Infinity;
      for (const pth of host.querySelectorAll('svg path')) {
        const bb = pth.getBoundingClientRect();
        if (bb.width < 0.5 || bb.height < 2) continue;
        x0 = Math.min(x0, bb.left); x1 = Math.max(x1, bb.right);
      }
      host.remove();
      return { painted, inked: x1 > x0 ? x1 - x0 : 0 };
    });
    assert.ok(r.inked > 0, 'the run was outlined at all');
    const ratio = r.inked / r.painted;
    assert.ok(ratio > 0.9 && ratio < 1.1,
      `emitted ink ${r.inked.toFixed(1)}px vs painted ${r.painted.toFixed(1)}px (ratio ${ratio.toFixed(3)}) - ` +
      'a ratio near 1/scale means the computed font-size was used without the ancestor scale');
  });

// ── over-provisioned raster previews: downscale on inline ────────────────────

test('an oversized bitmap is downscaled to what its display box can show',
  { skip: SKIP }, async () => {
    // A gallery preview committed as a 3200x1800 PNG appears in a ~341px tile, so the
    // walker was inlining ~5.76M pixels for a box that resolves at ~700 - one such tile
    // was 4.6 MB of a 6.6 MB shot. The inlined <image> should carry no more resolution
    // than the box needs at the export dpi, and none of the pixels should be visible as
    // a quality loss (not asserted here; verified by eye on the real gallery shot).
    const pg = await page();
    await pg.setContent(`<!doctype html><body style="margin:0">` +
      `<div id="root" style="width:500px;height:500px;background:#fff">` +
      // a 2000x2000 canvas painted as an <img> source, shown in a 200px box
      `<canvas id="src" width="2000" height="2000" style="display:none"></canvas>` +
      `<img id="big" style="width:200px;height:200px" alt="">` +
      `<img id="small" style="width:200px;height:200px" alt="">` +
      `</div></body>`);
    await pg.evaluate(() => {
      const c = document.getElementById('src') as HTMLCanvasElement;
      const ctx = c.getContext('2d')!;
      // a non-flat gradient so downscale can't be a no-op collapse
      const g = ctx.createLinearGradient(0, 0, 2000, 2000);
      g.addColorStop(0, '#f00'); g.addColorStop(1, '#00f');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 2000, 2000);
      (document.getElementById('big') as HTMLImageElement).src = c.toDataURL('image/png');
      const s = document.createElement('canvas'); s.width = 128; s.height = 128;
      s.getContext('2d')!.fillStyle = '#0a0'; s.getContext('2d')!.fillRect(0, 0, 128, 128);
      (document.getElementById('small') as HTMLImageElement).src = s.toDataURL('image/png');
    });
    await pg.evaluate(() => Promise.all([...document.images].map(i => i.decode().catch(() => {}))));
    await pg.addScriptTag({ content: await bundle(), type: 'module' });
    await pg.waitForFunction(() => !!(window as any).__render);
    const r = await pg.evaluate(async () => {
      (window as any).__setup();
      // dpi 96 (screen): the box is 200 CSS px, factor max(2, 96/96)=2 → cap 400px.
      const svg = await (await (window as any).__render(document.getElementById('root'),
        { rasterFallback: false, dpi: 96 })).text();
      // decode every embedded PNG and report its pixel size
      const dims: Array<{ w: number; h: number }> = [];
      for (const m of svg.matchAll(/href="(data:image\/png;base64,[^"]+)"/g)) {
        const img = new Image(); img.src = m[1];
        await img.decode().catch(() => {});
        dims.push({ w: img.naturalWidth, h: img.naturalHeight });
      }
      return { dims, count: dims.length };
    });
    assert.equal(r.count, 2, 'both images emitted');
    type Dim = { w: number; h: number };
    const dims = r.dims as Dim[];
    const big = dims.find((d: Dim) => d.w > 200) ?? dims.reduce((a: Dim, b: Dim) => a.w >= b.w ? a : b);
    const small = dims.find((d: Dim) => d.w <= 200) ?? dims.reduce((a: Dim, b: Dim) => a.w <= b.w ? a : b);
    // The 2000px source is capped to ~400px (box 200 x factor 2), never left at 2000.
    assert.ok(big.w <= 400 * 1.15 && big.w >= 300,
      `oversized 2000px source should cap near 400px, got ${big.w}`);
    // The 128px source is already under the cap, so it is NOT upscaled or touched.
    assert.equal(small.w, 128, 'a small source is left exactly as it was');
  });

test('a print-dpi export keeps a higher-resolution raster than a screen export',
  { skip: SKIP }, async () => {
    // The cap is dpi-aware, which is what makes it safe on the tool-export path: the same
    // 2000px source placed in a 200px box keeps more pixels at 300 dpi than at 96.
    const pg = await page();
    await pg.setContent(`<!doctype html><body style="margin:0">` +
      `<div id="root" style="width:400px;height:400px;background:#fff">` +
      `<canvas id="src" width="2000" height="2000" style="display:none"></canvas>` +
      `<img id="big" style="width:200px;height:200px" alt=""></div></body>`);
    await pg.evaluate(() => {
      const c = document.getElementById('src') as HTMLCanvasElement;
      const ctx = c.getContext('2d')!;
      const g = ctx.createLinearGradient(0, 0, 2000, 2000);
      g.addColorStop(0, '#f00'); g.addColorStop(1, '#00f');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 2000, 2000);
      (document.getElementById('big') as HTMLImageElement).src = c.toDataURL('image/png');
    });
    await pg.evaluate(() => document.images[0]?.decode().catch(() => {}));
    await pg.addScriptTag({ content: await bundle(), type: 'module' });
    await pg.waitForFunction(() => !!(window as any).__render);
    const measure = async (dpi: number) => pg.evaluate(async (d: number) => {
      (window as any).__setup();
      const svg = await (await (window as any).__render(document.getElementById('root'),
        { rasterFallback: false, dpi: d })).text();
      const m = svg.match(/href="(data:image\/png;base64,[^"]+)"/);
      if (!m) return 0;
      const img = new Image(); img.src = m[1]; await img.decode().catch(() => {});
      return img.naturalWidth;
    }, dpi);
    const screen = await measure(96);
    const print = await measure(300);
    assert.ok(print > screen, `print (${print}px) must keep more than screen (${screen}px)`);
  });

interface TextHarness {
  __render: typeof renderSvgFromHtml;
  __setup: (overrides: { text: TextAPI; log: HostV1['log'] }) => void;
  __makeText: () => TextAPI;
}

declare global { interface Window extends TextHarness {} }

test('interleaved HTML renders retain their shaping and logging capabilities across blocks',
  { skip: SKIP }, async () => {
    // Initialize the production bundle/font resolver, then use two different roots.
    await render(OUTFIT('Warm font'));
    const pg = await page();
    const result = await pg.evaluate(async () => {
      const harness = window;
      const a = document.createElement('div');
      const b = document.createElement('div');
      for (const root of [a, b]) {
        root.style.cssText = 'width:500px;height:150px;font-family:Outfit;font-size:24px';
        document.body.append(root);
      }
      for (const text of ['A first', 'A second', 'A fallback']) {
        const block = document.createElement('div'); block.textContent = text; a.append(block);
      }
      b.textContent = 'B only';
      const calls: Record<string, string[]> = { A: [], B: [] };
      const logs: Record<string, string[]> = { A: [], B: [] };
      let release = () => {};
      let entered = () => {};
      const held = new Promise<void>((resolve) => { release = resolve; });
      const started = new Promise<void>((resolve) => { entered = resolve; });
      const api = harness.__makeText();
      const install = (id: 'A' | 'B') => harness.__setup({
        text: { ...api, async toPath(opts) {
          calls[id]!.push(opts.text);
          if (opts.text === 'A first') { entered(); await held; }
          if (opts.text === 'A fallback') throw new Error('controlled shaping failure');
          return api.toPath(opts);
        } },
        log: (_level, message) => { logs[id]!.push(message); },
      });
      install('A');
      const pendingA = harness.__render(a, { rasterFallback: false });
      await Promise.race([started, new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error('render A did not reach shaping')), 10000);
      })]);
      install('B');
      const svgB = await (await harness.__render(b, { rasterFallback: false })).text();
      release();
      const svgA = await (await pendingA).text();
      return { calls, logs, svgA, svgB };
    });
    assert.deepEqual(result.calls, { A: ['A first', 'A second', 'A fallback'], B: ['B only'] });
    assert.equal(result.logs.A.filter((s: string) => s.includes('controlled shaping failure')).length, 1);
    assert.equal(result.logs.B.filter((s: string) => s.includes('controlled shaping failure')).length, 0);
    assert.equal(pathCount(result.svgA), 2);
    assert.match(result.svgA, /<text[^>]*>A fallback<\/text>/);
    assert.equal(pathCount(result.svgB), 1);
  });

test('text shadow filter IDs are deterministic and owned by each render', { skip: SKIP }, async () => {
  const first = await render(OUTFIT('Shadow', 'text-shadow:2px 3px 4px red,4px 5px 6px blue'));
  const pg = await page();
  const second = await pg.evaluate(async () => {
    const harness = window;
    return (await harness.__render(document.getElementById('root')!, { rasterFallback: false })).text();
  });
  assert.match(first, /id="fctxsh-1"/);
  assert.match(first, /id="fctxsh-2"/);
  assert.equal(second, first);
});
