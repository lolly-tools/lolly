// SPDX-License-Identifier: MPL-2.0
/**
 * Byte-exact golden tests for the FULL web renderer outputs - plan step 1 of
 * plans/archive/maintainability-2026-07-29.md: pin renderSvg / renderEmf / renderEps /
 * renderDxf (export.ts's renderFormatDispatch entry points) as exact snapshots
 * BEFORE decomposing export.ts, so the split can be proven byte-neutral.
 *
 * Same harness shape as export-text-emission.test.ts (read that file's header
 * for the rationale): esbuild stdin bundle of export.ts + text.ts, ONE shared
 * Chromium for the whole file, page.route serving the committed platform
 * Outfit[wght].ttf and harfbuzz.wasm, and createExportAPI({ text:
 * createTextAPI() }) armed in-page - export.ts's outlining branch is gated on
 * its module-level `_host?.text`, so skipping that call would make every text
 * run silently fall back to <text> and the goldens would pin the WRONG bytes.
 * The `<path` structural marker on the text fixtures is the canary for exactly
 * that mistake.
 *
 * DETERMINISM PROTOCOL: every fixture x format renders TWICE in the same run
 * and must be byte-identical BEFORE the golden comparison - extending the
 * emission suite's SVG determinism check to all four formats. A flaky byte
 * (id counter, Map order, timestamp) fails here with a clear message instead
 * of as an inscrutable golden diff.
 *
 * NON-VACUITY: each golden must carry a format-specific structural marker and
 * a minimum size, and a perturbed fixture must produce different bytes in
 * every format - a golden that would pass on empty output is a bug.
 *
 * CAVEAT the goldens inherit from the plan: renderSvgFromHtml reads Chromium's
 * computed layout, so the committed bytes are pinned to the Playwright
 * Chromium build (and this repo's font files). A Chromium upgrade may
 * legitimately move them - regenerate and diff-review, exactly as with the
 * toPath goldens. The same applies ACROSS OSes at the same Chromium version:
 * text layout goes through the platform font backend (CoreText on macOS,
 * FreeType on Linux), so glyph advances in the text-bearing fixtures can
 * differ per-OS. These goldens were generated on macOS, so a mismatch on
 * another OS with plausible-looking coordinates is that, not a regression.
 *
 * Which now matters in CI. This header used to add "CI has no Chromium, so not
 * there", and that was true only because the browser shard's install wrote a
 * different chromium revision than the gate above looks for - it skipped its
 * whole tier. That is fixed, so the Linux runner really does render these four
 * formats. If the two text fixtures (html-card, svg-native) mismatch there while
 * linear-gradient passes, the font backend is the reason: generate a Linux set
 * with UPDATE_GOLDENS=1 on a runner and review the diff, rather than relaxing
 * the byte comparison, which is the only thing this file is for.
 *
 * Run directly:            node --test shells/web/src/bridge/export-format-golden.test.ts
 * Regenerate the goldens:  UPDATE_GOLDENS=1 node --test shells/web/src/bridge/export-format-golden.test.ts
 *   (then re-run without UPDATE_GOLDENS to confirm green, and diff-review the
 *   fixture change before committing - the golden diff IS the review artefact.)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
      // The four per-format entry points are exported from export.ts solely for
      // this suite (see the export statement's comment there). createExportAPI
      // arms the module-level `_host` they all read - see the file header.
      contents: `import { renderSvg, renderEmf, renderEps, renderDxf, createExportAPI } from ${JSON.stringify(EXPORT_MODULE)};
                 import { createTextAPI } from ${JSON.stringify(join(HERE, 'text.ts'))};
                 window.__setup = () => createExportAPI({ text: createTextAPI(), log: () => {} });
                 window.__formats = { svg: renderSvg, emf: renderEmf, eps: renderEps, dxf: renderDxf };`,
      resolveDir: HERE, loader: 'ts',
    },
    bundle: true, write: false, format: 'esm', platform: 'browser',
    // export.ts reaches a CSS side-effect import through a lazy chain (the durable
    // probe in format-support.ts); esbuild has no output path here, so drop the sheets.
    loader: { ".css": "empty" },
    target: 'esnext', logLevel: 'silent',
    plugins: [{
      // harfbuzzjs's dist/harfbuzz.js does `await import("module")` for a Node
      // createRequire; unreachable in a browser, so an inert stub is faithful
      // (same as export-text-emission.test.ts).
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

type Format = 'svg' | 'emf' | 'eps' | 'dxf';

/**
 * Render `inner` inside #root through the REAL per-format entry point, TWICE in
 * the same page, and return both outputs (EMF as base64, the text formats
 * verbatim). Deliberately does NOT set opts.c2pa - a credential hashes the
 * finished bytes and would make every golden run-unique.
 */
async function renderTwice(inner: string, format: Format): Promise<[string, string]> {
  const pg = await page();
  await pg.setContent(`<!doctype html><body style="margin:0"><style>${FONT_CSS}</style>` +
    `<div id="root" style="width:500px;height:150px;background:#fff">${inner}</div></body>`);
  await pg.evaluate(() => (document as any).fonts.ready);
  await pg.addScriptTag({ content: await bundle(), type: 'module' });
  await pg.waitForFunction(() => !!(window as any).__formats);
  return await pg.evaluate(async (fmt: Format) => {
    (window as any).__setup();
    const fn = (window as any).__formats[fmt];
    const encode = async (blob: Blob): Promise<string> => {
      if (fmt !== 'emf') return await blob.text();
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let bin = '';
      // Chunked - a spread over one large Uint8Array overflows the arg stack.
      for (let i = 0; i < bytes.length; i += 0x8000) {
        bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      }
      return btoa(bin);
    };
    const root = document.getElementById('root')!;
    const a = await encode(await fn(root, {}));
    const b = await encode(await fn(root, {}));
    return [a, b];
  }, format);
}

// ── golden fixture I/O (same accumulate-then-write pattern as text-outline) ──
const FIXTURE_PATH = join(HERE, '__fixtures__/export-format.golden.json');
const UPDATE_GOLDENS = process.env.UPDATE_GOLDENS === '1';

function loadFixture(): Record<string, string> {
  if (!existsSync(FIXTURE_PATH)) return {};
  return JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as Record<string, string>;
}

const committed = loadFixture();
const regenerated: Record<string, string> = {};

test.after(() => {
  if (!UPDATE_GOLDENS) return;
  // Every golden test skipped, so `regenerated` is empty - writing it would
  // silently blank the committed fixture. Refuse loudly instead.
  if (SKIP) assert.fail(`UPDATE_GOLDENS=1 but the suite cannot run here (${SKIP}); refusing to overwrite the fixture`);
  mkdirSync(join(HERE, '__fixtures__'), { recursive: true });
  const sorted: Record<string, string> = {};
  for (const key of Object.keys(regenerated).sort()) sorted[key] = regenerated[key]!;
  writeFileSync(FIXTURE_PATH, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8');
});

function goldenCompare(id: string, live: string): void {
  if (UPDATE_GOLDENS) { regenerated[id] = live; return; }
  const expected = committed[id];
  assert.ok(expected,
    `No committed golden for "${id}" - regenerate with: ` +
    `UPDATE_GOLDENS=1 node --test "shells/web/src/bridge/export-format-golden.test.ts"`);
  assert.ok(live === expected,
    `Golden byte mismatch for "${id}" (${live.length} vs ${expected!.length} chars) - ` +
    `if the change is intentional, regenerate with UPDATE_GOLDENS=1 and diff-review the fixture`);
}

// ── the fixture DOMs ─────────────────────────────────────────────────────────
// Small on purpose: each exercises one distinct walker surface, and a golden
// diff should be reviewable by eye.
const FIXTURES: Record<string, string> = {
  // HTML layout: an outlined Outfit text run + solid background + border-radius
  // (the pill-clamp geometry the notes record historical drift on).
  'html-card':
    '<div style="font-family:Outfit;font-size:24px;color:#123456;' +
    'background:#ffcc00;border-radius:12px;width:300px;height:80px;' +
    'padding:8px 16px">Golden card</div>',
  // A tool whose canvas IS an <svg> - the renderSvg fast-path clone (and, for
  // EMF/EPS/DXF, the svgDomToIr walk over the LIVE svg), with a <text> run
  // that must come out outlined.
  'svg-native':
    '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="100">' +
    '<rect x="5" y="5" width="290" height="90" fill="#e0f0ff"/>' +
    '<text x="20" y="60" font-family="Outfit" font-size="32" fill="#123456">SVG text</text>' +
    '</svg>',
  // A linear-gradient background: SVG keeps it as <linearGradient>; the
  // EMF/EPS/DXF IR flattens gradients to solids upstream.
  'linear-gradient':
    '<div style="width:300px;height:100px;' +
    'background:linear-gradient(90deg,#ff0000,#0000ff)"></div>',
};

const FORMATS: Format[] = ['svg', 'emf', 'eps', 'dxf'];

/** Format-specific structural markers: proof the golden is non-trivial output
 *  of the RIGHT container, not an empty or error string. */
function assertStructure(format: Format, out: string, fixture: string): void {
  assert.ok(out.length > 200, `${format} output is trivially small (${out.length} chars)`);
  if (format === 'svg') {
    assert.match(out, /<svg\b/, 'an SVG golden must contain an <svg> root');
    if (fixture === 'html-card' || fixture === 'svg-native') {
      // The canary (see header): outlined text means _host.text was armed.
      assert.match(out, /<path\b/, 'the text fixture must carry outlined <path> glyphs');
    }
    if (fixture === 'linear-gradient') {
      assert.match(out, /<linearGradient\b/, 'the gradient must survive as a real <linearGradient>');
    }
  } else if (format === 'eps') {
    assert.match(out, /^%!PS-Adobe/, 'an EPS golden must start with the PostScript DSC header');
  } else if (format === 'dxf') {
    assert.match(out, /SECTION/, 'a DXF golden must contain SECTION records');
    assert.match(out, /ENTITIES/, 'a DXF golden must contain an ENTITIES section');
  } else {
    // EMF: dSignature 0x464D4520 (" EMF") at byte offset 40 of the header.
    const bytes = Buffer.from(out, 'base64');
    assert.ok(bytes.length > 200, `EMF output is trivially small (${bytes.length} bytes)`);
    assert.equal(bytes.toString('latin1', 40, 44), ' EMF', 'EMF header signature missing at offset 40');
  }
}

// ── the goldens ──────────────────────────────────────────────────────────────

for (const [fixture, inner] of Object.entries(FIXTURES)) {
  for (const format of FORMATS) {
    test(`golden: ${fixture} renders byte-exact ${format}`, { skip: SKIP }, async () => {
      const [a, b] = await renderTwice(inner, format);
      // Determinism FIRST: a golden over unstable bytes is worse than no golden.
      assert.ok(a === b,
        `two ${format} renders of ${fixture} in the same run diverged - the output is not snapshot-safe`);
      assertStructure(format, a, fixture);
      goldenCompare(`${fixture}.${format}`, a);
    });
  }
}

// ── negative control: the goldens cannot pass on unchanged/empty output ──────

test('negative control: a perturbed fixture produces different bytes in every format',
  { skip: SKIP }, async () => {
    // Same html-card with one changed word and one changed colour. Compared to
    // the LIVE render of the unperturbed fixture (not the committed golden), so
    // this proves non-vacuity in both normal and UPDATE_GOLDENS runs.
    const perturbed = FIXTURES['html-card']!
      .replace('Golden card', 'Perturbed card').replace('#ffcc00', '#00ccff');
    for (const format of FORMATS) {
      const [base] = await renderTwice(FIXTURES['html-card']!, format);
      const [other] = await renderTwice(perturbed, format);
      assert.ok(base !== other,
        `${format}: perturbing the fixture did not change the bytes - the golden is vacuous`);
    }
  });

// ── the rendering-intent flags are PARSED, not silently ignored ──────────────

test('Chromium parses --force-color-profile (counterfactual: display-p3 flips the gamut query)',
  { skip: SKIP }, async () => {
    // A typo'd Chromium switch is silently ignored, which would make the
    // rendering-intent pins in packages/node-shell/src/browsers.ts a placebo.
    // Asserting the srgb side is vacuous on an sRGB host, so assert the
    // COUNTERFACTUAL instead: force display-p3 in a throwaway browser and the
    // gamut media query must flip to true on ANY host. If Chromium ever renames
    // the switch, this fails loudly instead of the pin rotting.
    const { chromium } = browser as { chromium: any };
    const b = await chromium.launch({ args: ['--force-color-profile=display-p3-d65'] });
    try {
      const p = await b.newPage();
      assert.equal(await p.evaluate(() => matchMedia('(color-gamut: p3)').matches), true,
        '--force-color-profile was not honoured - has the switch been renamed?');
    } finally {
      await b.close();
    }
  });
