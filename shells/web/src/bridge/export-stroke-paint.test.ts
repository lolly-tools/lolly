// SPDX-License-Identifier: MPL-2.0
/**
 * Stroke resolution for the PDF vector walker - guarded in a REAL browser, against the
 * REAL catalog artwork, through the REAL exported helpers.
 *
 * ## Why this test exists
 *
 * Every SUSE catalog illustration is an Illustrator export: it carries all of its paint in
 * a `<style>` block of generated classes (`.cls-7{stroke:#003e37;stroke-width:4px}`) and
 * puts NO stroke/stroke-width attribute on any node. `drawSvgVectorsInRegion` used to read
 * stroke as `getAttribute('stroke') ?? resolveStyleProp(e,'stroke') ?? 'none'` - attribute,
 * then the inline `style=""` attribute, then give up. Neither read can see a class rule, so
 * every stroke resolved to 'none' and the artwork exported to PDF as flat fills with EVERY
 * outline missing. Fill was unaffected the whole time, because resolveColor() had always
 * fallen back to getComputedStyle. That asymmetry is the bug; strokeOf/strokeWidthOf close it.
 *
 * ## Why it needs a real browser (and is therefore gated)
 *
 * The fix hinges on getComputedStyle applying a CSS *class* rule to an SVG node. jsdom does
 * not implement SVG presentation properties in its cascade at all - it returns '' for stroke,
 * stroke-width AND fill - so a jsdom run cannot tell a working resolver from a broken one, and
 * hand-feeding a fake computed style would only test the fake. A real Chromium is the only
 * honest oracle here, so this suite self-skips when one isn't installed, per the gated-test
 * convention in tests/README.md. To exercise it: `pnpm exec playwright install chromium`.
 *
 * The helpers are imported by BUNDLING the real module for the browser (esbuild, a devDep) - 
 * node never imports export.ts, which is browser-only at runtime.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '../../../..');
const EXPORT_MODULE = join(HERE, 'export.ts');

// The reference artwork: 103 shapes, most of them stroked ONLY by a class. Lives in the
// private SUSE brand pack, so it is absent under lolly-start / public CI - skip cleanly,
// exactly as tests/color-block.test.ts does for its tool. Named at its real place in the
// pack: the repo-root catalog/ view that used to front it is gone (plan 244).
const ART = join(REPO, 'brands/suse/catalog/assets/suse/illustrations/cybersecurity.svg');

/** Resolve a Chromium, or a reason to skip. Mirrors packages/node-shell/src/browsers.ts's
 *  stance: a plain `pnpm install` pulls no browser, so its absence is normal, not a failure. */
async function chromiumOrSkip(): Promise<{ chromium: any } | string> {
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
const SKIP_BROWSER = typeof browser === 'string' ? browser : false;
const SKIP_ART = !existsSync(ART) && 'SUSE brand pack not mounted (see profiles.json)';
const SKIP = SKIP_BROWSER || SKIP_ART;

/**
 * Bundle the real export.ts for the browser and hang the two helpers off `window`.
 * esbuild tree-shakes to just the paint resolvers (~35 KB), so this stays fast.
 */
async function bundleHelpers(): Promise<string> {
  const { build } = await import('esbuild');
  const out = await build({
    stdin: {
      contents: `import { strokeOf, strokeWidthOf } from ${JSON.stringify(EXPORT_MODULE)};
                 window.strokeOf = strokeOf; window.strokeWidthOf = strokeWidthOf;`,
      resolveDir: HERE,
      loader: 'ts',
    },
    bundle: true, write: false, format: 'iife', platform: 'browser', logLevel: 'silent',
    // export.ts reaches a CSS side-effect import through a lazy chain (the durable
    // probe in format-support.ts); esbuild has no output path here, so drop the sheets.
    loader: { ".css": "empty" },
  });
  return out.outputFiles[0]!.text;
}

/** Run `fn` in a page with `markup` in the body and the real helpers loaded. */
async function inPage<T>(markup: string, fn: (...a: any[]) => T): Promise<T> {
  const { chromium } = browser as { chromium: any };
  const b = await chromium.launch();
  try {
    const page = await b.newPage();
    await page.setContent(`<!doctype html><body>${markup}</body>`);
    await page.addScriptTag({ content: await bundleHelpers() });
    return await page.evaluate(fn as any);
  } finally { await b.close(); }
}

// ─── the regression: real artwork, real helpers ───────────────────────────────

test('strokeOf: a class-declared stroke on the real catalog artwork resolves (PDF outlines)',
  { skip: SKIP }, async () => {
    const svg = await readFile(ART, 'utf8');
    const r = await inPage(svg, () => {
      const els = [...document.querySelectorAll('path,rect,circle,polygon,polyline,ellipse,line')];
      const w = window as any;
      return {
        total: els.length,
        // The premise: NOTHING declares stroke the old code could see. If a future
        // re-export of this artwork adds attributes, this drops and the test below
        // stops proving anything - so assert it rather than trust it.
        withStrokeAttr: els.filter(e => e.getAttribute('stroke')).length,
        withStrokeWidthAttr: els.filter(e => e.getAttribute('stroke-width')).length,
        // What the walker now actually gets.
        stroked: els.filter(e => w.strokeOf(e) !== 'none').length,
        strokes: [...new Set(els.map(e => w.strokeOf(e)))].filter(s => s !== 'none').sort(),
        widths: [...new Set(els.filter(e => w.strokeOf(e) !== 'none').map(e => w.strokeWidthOf(e)))].sort(),
      };
    });

    assert.equal(r.withStrokeAttr, 0, 'premise: the artwork declares no stroke ATTRIBUTE');
    assert.equal(r.withStrokeWidthAttr, 0, 'premise: no stroke-width ATTRIBUTE either');

    // The regression itself. Pre-fix every one of these was 'none' → 0 outlines in PDF.
    assert.ok(r.stroked > 50, `expected most of ${r.total} shapes stroked, got ${r.stroked}`);
    assert.ok(r.strokes.includes('rgb(12, 50, 44)'),
      `expected the artwork's #0c322c outline colour, got ${JSON.stringify(r.strokes)}`);
    // 4px is the artwork's own stroke-width; pre-fix this silently fell back to 1.
    assert.ok(r.widths.includes(4), `expected a 4-unit stroke width, got ${JSON.stringify(r.widths)}`);
  });

// ─── precedence + defaults ───────────────────────────────────────────────────

test('strokeOf/strokeWidthOf: attribute > inline style > CSS class, and SVG defaults',
  { skip: SKIP_BROWSER }, async () => {
    const markup = `<svg viewBox="0 0 10 10">
      <style>.k{stroke:#003e37;stroke-width:4px}</style>
      <path id="cls"    class="k" d="M0 0h1"/>
      <path id="inline" class="k" d="M0 0h1" style="stroke:#ff0000;stroke-width:9"/>
      <path id="attr"   class="k" d="M0 0h1" stroke="#00ff00" stroke-width="7"/>
      <path id="bare"   d="M0 0h1"/>
      <path id="off"    d="M0 0h1" stroke="none"/>
      <g color="#0000ff"><path id="cc" d="M0 0h1" stroke="currentColor"/></g>
    </svg>`;
    const r = await inPage(markup, () => {
      const w = window as any;
      const at = (id: string) => document.getElementById(id)!;
      const pick = (id: string) => [w.strokeOf(at(id)), w.strokeWidthOf(at(id))];
      return { cls: pick('cls'), inline: pick('inline'), attr: pick('attr'),
               bare: pick('bare'), off: pick('off'), cc: pick('cc') };
    });

    // The class rule is the ONLY declaration → must come from the computed fallback.
    assert.deepEqual(r.cls, ['rgb(0, 62, 55)', 4]);
    // An inline style and an attribute each still win over the class - the fallback is a
    // fallback, not an override. (Both also beat the class in the real cascade, so a
    // computed-only implementation would pass this too; the point is we didn't regress it.)
    assert.deepEqual(r.inline, ['#ff0000', 9]);
    assert.deepEqual(r.attr, ['#00ff00', 7]);
    // Nothing declared: stroke's initial value is none, stroke-width's is 1. Getting this
    // wrong would paint outlines onto artwork that never asked for them.
    assert.deepEqual(r.bare, ['none', 1]);
    assert.equal(r.off[0], 'none');
    // currentColor must resolve through the computed style, not reach jsPDF verbatim.
    assert.equal(r.cc[0], 'rgb(0, 0, 255)');
  });
