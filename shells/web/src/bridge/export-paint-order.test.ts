// SPDX-License-Identifier: MPL-2.0
/**
 * Paint order for the HTML→SVG walker - CSS 2.1 Appendix E section E.2 under
 * `ExportOpts.stackingOrder`, and the guarantee that tool exports (flag absent)
 * still paint in DOM order.
 *
 * ## Why a real browser
 *
 * jsdom cannot be the oracle. Every case here hinges on `getComputedStyle`
 * resolving `z-index`, `isolation`, `opacity` and - critically - CSS Display 3
 * section 2.7 blockification, which is what makes an `position: absolute` inline
 * element reachable by the walker's block-child loop at all. Hand-feeding a fake
 * computed style would only test the fake. So this follows the gated pattern of
 * export-stroke-paint.test.ts: esbuild-bundle the REAL module, drive it in a
 * REAL Chromium, self-skip when one isn't installed (tests/README.md).
 *
 * ## Why assertions are on serialised fill order
 *
 * Pixel diffing needs fonts, goldens and a tolerance, and it is the WRONG oracle
 * for ordering: two swapped boxes usually look similar, so a pixel test passes
 * while the page is wrong. Document order of unique fill strings in the emitted
 * SVG is the thing the spec actually constrains, and it is exact.
 *
 * Every fixture below was lifted from a measured defect on the audit fixtures,
 * and each one is RED before the stacking-order change.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const EXPORT_MODULE = fileURLToPath(new URL('./export.ts', import.meta.url));

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
const SKIP = typeof browser === 'string' ? browser : false;

let bundleCache: string | null = null;
/** Bundle the real export.ts and hang renderSvgFromHtml off `window`. */
async function bundle(): Promise<string> {
  if (bundleCache) return bundleCache;
  const { build } = await import('esbuild');
  const out = await build({
    stdin: {
      contents: `import { renderSvgFromHtml } from ${JSON.stringify(EXPORT_MODULE)};
                 window.__render = renderSvgFromHtml;`,
      resolveDir: HERE,
      loader: 'ts',
    },
    bundle: true, write: false, format: 'iife', platform: 'browser', logLevel: 'silent',
    // export.ts reaches a CSS side-effect import through a lazy chain (the durable
    // probe in format-support.ts); esbuild has no output path here, so drop the sheets.
    loader: { ".css": "empty" },
  });
  bundleCache = out.outputFiles[0]!.text;
  return bundleCache;
}

/**
 * Render `markup`'s `#root` through the real walker and return the SVG text.
 *
 * convertPaths:false keeps text as `<text>` elements (no HarfBuzz, no fonts, so
 * the suite is font-independent); rasterFallback:false keeps the output pure
 * vector so an unrelated escape-hatch trigger can never swallow a fixture.
 */
async function renderFixture(markup: string, stackingOrder: boolean): Promise<string> {
  const { chromium } = browser as { chromium: any };
  const b = await chromium.launch();
  try {
    const page = await b.newPage({ viewport: { width: 800, height: 600 } });
    await page.setContent(`<!doctype html><body style="margin:0">${markup}</body>`);
    await page.addScriptTag({ content: await bundle() });
    return await page.evaluate(async (so: boolean) => {
      const blob = await (window as any).__render(document.getElementById('root'),
        { convertPaths: false, rasterFallback: false, stackingOrder: so || undefined });
      return await blob.text();
    }, stackingOrder);
  } finally { await b.close(); }
}

/** First index of an rgb() colour in the SVG, tolerating either spacing form
 *  (`rgb(1,2,3)` from the fill helpers, `rgb(1, 2, 3)` from a computed value). */
function at(svg: string, r: number, g: number, b: number): number {
  const tight = svg.indexOf(`rgb(${r},${g},${b})`);
  const loose = svg.indexOf(`rgb(${r}, ${g}, ${b})`);
  const i = [tight, loose].filter(n => n >= 0);
  assert.ok(i.length, `colour rgb(${r},${g},${b}) missing from the output entirely`);
  return Math.min(...i);
}
/** Paint order of a list of colours, as their first-appearance indices. */
function order(svg: string, cols: [number, number, number][]): number[] {
  return cols.map(c => at(svg, c[0], c[1], c[2]));
}
const ASC = (ns: number[]) => ns.every((n, i) => i === 0 || n > ns[i - 1]!);

// A 60px opaque box; `z` and `pos` vary per fixture.
const box = (css: string, colour: string) =>
  `<div style="width:60px;height:60px;background:${colour};${css}"></div>`;

// ─── (a) z-sort among siblings ────────────────────────────────────────────────
// The real `a.gcar-deck` carousel on the gallery fixture: three absolutely
// positioned siblings whose DOM order is the exact REVERSE of paint order
// (declared z 40, 30, 20, pairwise overlap 57–69 k px²).
test('z-index sorts positioned siblings: declared 40,30,20 must PAINT 20,30,40',
  { skip: SKIP }, async () => {
    const markup = `<div id="root" style="position:relative;width:300px;height:200px">
      ${box('position:absolute;left:0;top:0;z-index:40', '#2b6cb0')}
      ${box('position:absolute;left:20px;top:0;z-index:30', '#e53e3e')}
      ${box('position:absolute;left:40px;top:0;z-index:20', '#38a169')}
    </div>`;
    const svg = await renderFixture(markup, true);
    // 20 (green) first, then 30 (red), then 40 (blue).
    assert.ok(ASC(order(svg, [[56, 161, 105], [229, 62, 62], [43, 108, 176]])),
      'expected paint order z20 → z30 → z40');

    // Premise: DOM order gets this backwards, so the assertion above is required.
    const dom = await renderFixture(markup, false);
    assert.ok(ASC(order(dom, [[43, 108, 176], [229, 62, 62], [56, 161, 105]])),
      'premise: with the flag off the walker still paints in DOM order (40,30,20)');
  });

// ─── (b) hoist across a non-stacking-context ancestor ─────────────────────────
// The canonical dropdown/tooltip pattern: a `position:relative; z-index:auto`
// wrapper is NOT a stacking context, so its z-indexed child belongs to the
// ancestor context and must paint above the wrapper's LATER siblings. Any design
// that only sorts children within their own parent structurally cannot do this.
test('a z-indexed child hoists OUT of a non-stacking-context ancestor',
  { skip: SKIP }, async () => {
    const markup = `<div id="root" style="position:relative;width:300px;height:200px">
      <div style="position:relative;z-index:auto;width:200px;height:100px">
        ${box('position:absolute;left:0;top:0;z-index:5', '#2b6cb0')}
      </div>
      ${box('', '#e53e3e')}
    </div>`;
    const svg = await renderFixture(markup, true);
    assert.ok(at(svg, 229, 62, 62) < at(svg, 43, 108, 176),
      'the z:5 child must paint AFTER the wrapper\'s later in-flow sibling');

    const dom = await renderFixture(markup, false);
    assert.ok(at(dom, 43, 108, 176) < at(dom, 229, 62, 62), 'premise: DOM order paints it first');
  });

// ─── (c) layer 5 before layer 6: positioned child vs the parent's own text ────
test('a positioned child paints AFTER its parent\'s inline text (E.2 step 5 then 8)',
  { skip: SKIP }, async () => {
    const markup = `<div id="root" style="position:relative;width:300px;height:200px;color:#e53e3e;font:16px monospace">
      ${box('position:absolute;left:0;top:0', '#2b6cb0')}
      PAINTORDER
    </div>`;
    const svg = await renderFixture(markup, true);
    assert.ok(at(svg, 229, 62, 62) < at(svg, 43, 108, 176),
      'the text must be laid down before the positioned box that covers it');
    assert.ok(svg.includes('PAINTORDER'), 'premise: the text run was emitted at all');

    const dom = await renderFixture(markup, false);
    assert.ok(at(dom, 43, 108, 176) < at(dom, 229, 62, 62), 'premise: DOM order paints the box first');
  });

// ─── (d) negative z: after the context\'s own background, before its content ──
// This is the case that breaks under the obvious `insertBefore(firstChild)`
// implementation: the negative child would slide behind the CONTEXT'S OWN
// background, which section E.2 step 2 lays down first.
test('a z-index:-1 child paints after its context\'s own background and before in-flow content',
  { skip: SKIP }, async () => {
    const markup = `<div id="root" style="position:relative;width:300px;height:200px;background:#f7fafc">
      ${box('', '#38a169')}
      ${box('position:absolute;left:0;top:0;z-index:-1', '#e53e3e')}
    </div>`;
    const svg = await renderFixture(markup, true);
    const [bg, neg, flow] = order(svg, [[247, 250, 252], [229, 62, 62], [56, 161, 105]]);
    assert.ok(bg! < neg!, 'negative-z must NOT slide behind the context\'s own background');
    assert.ok(neg! < flow!, 'negative-z must paint before in-flow content');

    const dom = await renderFixture(markup, false);
    assert.ok(at(dom, 56, 161, 105) < at(dom, 229, 62, 62), 'premise: DOM order paints it last');
  });

// ─── (e) the `slides` shape: a z-indexed header declared before a static sibling
test('position:relative;z-index:2 declared FIRST still paints above a later static sibling',
  { skip: SKIP }, async () => {
    const markup = `<div id="root" style="width:300px;height:200px">
      ${box('position:relative;z-index:2', '#2b6cb0')}
      ${box('margin-top:-40px', '#e53e3e')}
    </div>`;
    const svg = await renderFixture(markup, true);
    assert.ok(at(svg, 229, 62, 62) < at(svg, 43, 108, 176), 'z:2 header must paint on top');

    const dom = await renderFixture(markup, false);
    assert.ok(at(dom, 43, 108, 176) < at(dom, 229, 62, 62), 'premise: DOM order paints it first');
  });

// ─── (f) a hoist across an overflow clip must KEEP the clip ───────────────────
// The one wrapper a hoist can cross. `overflow:hidden` creates no stacking
// context, so the z-indexed child leaves the clip group - and must carry the
// clip's id, or content that is correctly cropped today starts spilling.
test('a unit hoisted out of an overflow-clip group re-applies the clip',
  { skip: SKIP }, async () => {
    const markup = `<div id="root" style="position:relative;width:300px;height:200px">
      <div style="overflow:hidden;border-radius:12px;width:100px;height:100px;background:#edf2f7">
        ${box('position:absolute;left:0;top:0;z-index:3;width:400px', '#2b6cb0')}
      </div>
      ${box('', '#e53e3e')}
    </div>`;
    const svg = await renderFixture(markup, true);
    // Hoisted past the later sibling…
    assert.ok(at(svg, 229, 62, 62) < at(svg, 43, 108, 176), 'premise: the unit did hoist');
    // …and the hoisted <g> is wrapped in the overflow clip it left behind.
    const { chromium } = browser as { chromium: any };
    const b = await chromium.launch();
    try {
      const page = await b.newPage();
      const clipped = await page.evaluate((xml: string) => {
        const d = new DOMParser().parseFromString(xml, 'image/svg+xml');
        const rect = Array.from(d.querySelectorAll('rect'))
          .find(r => /rgb\(43, ?108, ?176\)/.test(r.getAttribute('fill') || ''));
        if (!rect) return 'no rect';
        for (let n: Element | null = rect; n; n = n.parentElement) {
          const cp = n.getAttribute?.('clip-path') || '';
          if (cp.includes('fcovclip-')) return 'clipped';
        }
        return 'UNCLIPPED';
      }, svg);
      assert.equal(clipped, 'clipped', 'a hoisted unit must re-apply every overflow clip it crossed');
    } finally { await b.close(); }
  });

// ─── (g) hoisting must STOP at a stacking-context creator ─────────────────────
// The one way this work can turn correct output into wrong output is a MISSED
// context creator letting content escape a subtree it belongs to. Two guards,
// both green before AND after.
test('hoisting stops at opacity<1 - a z-index:99 child stays inside the opacity group',
  { skip: SKIP }, async () => {
    const markup = `<div id="root" style="position:relative;width:300px;height:200px">
      <div style="opacity:0.6;width:100px;height:100px;background:#edf2f7">
        ${box('position:absolute;left:0;top:0;z-index:99', '#2b6cb0')}
      </div>
      ${box('', '#e53e3e')}
    </div>`;
    for (const so of [true, false]) {
      const svg = await renderFixture(markup, so);
      assert.ok(at(svg, 43, 108, 176) < at(svg, 229, 62, 62),
        `z:99 must not escape the opacity context (stackingOrder=${so})`);
      assert.ok(/opacity="0\.6/.test(svg), 'premise: the opacity group was emitted');
    }
  });

test('hoisting stops at isolation:isolate', { skip: SKIP }, async () => {
  const markup = `<div id="root" style="position:relative;width:300px;height:200px">
    <div style="isolation:isolate;width:100px;height:100px">
      ${box('position:absolute;left:0;top:0;z-index:99', '#2b6cb0')}
    </div>
    ${box('', '#e53e3e')}
  </div>`;
  const svg = await renderFixture(markup, true);
  assert.ok(at(svg, 43, 108, 176) < at(svg, 229, 62, 62), 'z:99 must not escape an isolated subtree');
});

// ─── (h) KNOWN LIMITATION assertions ──────────────────────────────────────────
// Recorded deliberately so a future fix trips these and gets reviewed, rather
// than quietly changing behaviour nobody was asserting.
test('KNOWN LIMITATION: floats are painted in tree order, not section E.2 layer 4',
  { skip: SKIP }, async () => {
    // A float paints BELOW positioned content but ABOVE in-flow blocks; the
    // walker has no float model and approximates with tree order. Zero floats
    // were measured across all six audit fixtures, so this is unbudgeted, not
    // unnoticed.
    const markup = `<div id="root" style="position:relative;width:300px;height:200px">
      ${box('float:left', '#2b6cb0')}
      ${box('margin-top:-40px', '#e53e3e')}
    </div>`;
    const svg = await renderFixture(markup, true);
    assert.ok(at(svg, 43, 108, 176) < at(svg, 229, 62, 62),
      'floats still paint in tree order - update this when a float model lands');
  });

// ─── RISK #1: tool exports must be untouched unless opted in ──────────────────
//
// `renderSvgFromHtml` is the shipping SVG/PDF/EMF/EPS path for every tool in
// every profile. The protection is that `PaintCtx.frame === null` with the flag
// off makes every deferral branch unreachable - so the OFF path emits nodes in
// pure document order, exactly as it always has.
//
// The oracle is version-independent on purpose: no golden bytes (Chromium
// layout and font metrics drift), no image diff. It is the PROPERTY that tool
// exports depend on - "the walker emits one paint unit per element, in document
// order" - checked against the DOM itself.
test('flag OFF: emitted order is exactly document order, even on a heavily z-indexed tree',
  { skip: SKIP }, async () => {
    // Deliberately stuffed with everything that would move under the flag:
    // negative z, positive z, positioned-auto, flex `order`, a float, an
    // overflow clip, an opacity group and a transform.
    const markup = `<div id="root" style="position:relative;width:400px;height:300px;background:#010101">
      ${box('position:absolute;left:0;top:0;z-index:-3', '#020202')}
      ${box('position:relative;z-index:7', '#030303')}
      <div style="display:flex;width:200px;height:60px">
        ${box('order:2', '#040404')}
        ${box('order:-1', '#050505')}
      </div>
      ${box('float:left', '#060606')}
      <div style="overflow:hidden;border-radius:8px;width:80px;height:80px;background:#070707">
        ${box('position:absolute;left:0;top:0;z-index:4', '#080808')}
      </div>
      <div style="opacity:0.5;width:80px;height:80px;background:#090909">
        ${box('position:absolute;left:0;top:0;z-index:2', '#0a0a0a')}
      </div>
      ${box('transform:rotate(10deg)', '#0b0b0b')}
      ${box('position:absolute;left:0;top:0;z-index:auto', '#0c0c0c')}
    </div>`;
    const svg = await renderFixture(markup, false);
    // Every fill is a distinct grey; document order is 1,2,3,…
    const seq: number[] = [];
    for (let i = 1; i <= 12; i++) seq.push(at(svg, i, i, i));
    assert.ok(ASC(seq), `flag OFF must emit in document order, got ${JSON.stringify(seq)}`);

    // And the fixture really does exercise the feature - otherwise the assertion
    // above proves nothing.
    const on = await renderFixture(markup, true);
    const onSeq: number[] = [];
    for (let i = 1; i <= 12; i++) onSeq.push(at(on, i, i, i));
    assert.ok(!ASC(onSeq), 'premise: with the flag ON this fixture DOES reorder');
  });

// ─── <canvas> vector twins ────────────────────────────────────────────────────
//
// A canvas painter can publish a `__lollyVectorTwin` producer (lib/vector-paint.ts)
// and the walker inlines its SVG instead of a toDataURL raster. The contract is
// presence-keyed - no ExportOpts field, no attribute, no flag - so the essential
// guarantee is the NEGATIVE one: a canvas WITHOUT the property must serialise
// byte-identically to how it always has, for every tool export in every profile.
//
// That is why the scenarios below run inside ONE page against ONE canvas: comparing
// bytes across separate Chromium launches would be comparing two layouts. Here the
// only thing that changes between snapshot 1 and snapshot 3 is the presence of a
// property on the element, so a difference can only be this feature leaking.

/** Markup for a painted 100×50 canvas inside a 200×100 root. */
const CANVAS_FIXTURE = `<div id="root" style="width:200px;height:100px;background:#ffffff">
  <canvas id="cv" width="100" height="50" style="display:block;width:100px;height:50px"></canvas>
</div>`;

/** A twin whose ids (`twin-clip`) collide with any other twin's - that is the point. */
const TWIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50">`
  + `<defs><clipPath id="twin-clip"><rect x="0" y="0" width="100" height="50"/></clipPath></defs>`
  + `<rect id="twin-tile" clip-path="url(#twin-clip)" x="0" y="0" width="100" height="50" fill="rgb(9,9,9)"/>`
  + `</svg>`;

/**
 * Run `steps` (an in-page async function body, given `render` and `cv`) and return
 * its map of named SVG strings. One launch, one page, one canvas.
 */
async function twinScenario(steps: string): Promise<Record<string, string>> {
  const { chromium } = browser as { chromium: any };
  const b = await chromium.launch();
  try {
    const page = await b.newPage({ viewport: { width: 800, height: 600 } });
    await page.setContent(`<!doctype html><body style="margin:0">${CANVAS_FIXTURE}</body>`);
    await page.addScriptTag({ content: await bundle() });
    return await page.evaluate(async (body: string) => {
      const cv = document.getElementById('cv') as HTMLCanvasElement;
      const g = cv.getContext('2d')!;
      g.fillStyle = 'rgb(1,2,3)';
      g.fillRect(0, 0, 100, 50);
      const render = async (el: Element = document.getElementById('root')!) => {
        const blob = await (window as any).__render(el, { convertPaths: false, rasterFallback: false });
        return await blob.text() as string;
      };
      // eslint-disable-next-line no-new-func
      const fn = new Function('render', 'cv', `return (async () => { ${body} })()`);
      return await fn(render, cv) as Record<string, string>;
    }, steps);
  } finally { await b.close(); }
}

test('a canvas with NO vector twin serialises byte-identically before and after the feature exists',
  { skip: SKIP }, async () => {
    const out = await twinScenario(`
      const before = await render();
      cv.__lollyVectorTwin = () => ${JSON.stringify(TWIN_SVG)};
      const twinned = await render();
      delete cv.__lollyVectorTwin;
      const after = await render();
      return { before, twinned, after };
    `);

    // (1) The historical output: a stretched raster <image> at the element box.
    assert.match(out.before!, /<image[^>]*href="data:image\/png/,
      'premise: an untwinned canvas is still rasterised');
    assert.match(out.before!, /<image[^>]*preserveAspectRatio="none"/,
      'premise: the raster keeps its stretch semantics');
    assert.match(out.before!, /<image[^>]*width="100"[^>]*height="50"/,
      'premise: the raster is placed on the element box');

    // (2) With a twin: the PNG is gone, the vector is in, and its ids are namespaced.
    assert.ok(!out.twinned!.includes('data:image/png'), 'the twin must REPLACE the raster, not join it');
    assert.ok(out.twinned!.includes('rgb(9,9,9)'), 'the twin\'s own paint must be present');
    assert.match(out.twinned!, /id="tw\d+-twin-clip"/, 'twin ids must be namespaced at insertion');
    assert.match(out.twinned!, /url\(#tw\d+-twin-clip\)/, 'references must follow the rename');
    assert.ok(!/id="twin-clip"/.test(out.twinned!), 'the raw twin-local id must not survive - it collides');
    // Placed exactly where the raster was: same box, same stretch. (The document's own
    // root <svg> carries no preserveAspectRatio, so this can only match the twin.)
    assert.match(out.twinned!, /<svg[^>]*\bwidth="100"[^>]*\bheight="50"[^>]*\bpreserveAspectRatio="none"/,
      'the twin inherits the raster branch\'s box and stretch semantics');

    // (3) THE GOLDEN. Same page, same layout, property removed - the bytes must return.
    assert.equal(out.after, out.before,
      'a canvas without __lollyVectorTwin must serialise BYTE-IDENTICALLY to the pre-feature output');
  });

test('every twin-producer failure mode falls back to the unmodified raster path',
  { skip: SKIP }, async () => {
    const out = await twinScenario(`
      const shot = async (producer) => { cv.__lollyVectorTwin = producer; const s = await render(); delete cv.__lollyVectorTwin; return s; };
      return {
        threw:     await shot(() => { throw new Error('boom'); }),
        rejected:  await shot(async () => { throw new Error('boom'); }),
        malformed: await shot(() => '<svg><rect fill="red"</svg>'),
        nul:       await shot(() => null),
        empty:     await shot(() => ''),
        notSvg:    await shot(() => '<html><body>nope</body></html>'),
      };
    `);
    for (const [name, svg] of Object.entries(out)) {
      assert.match(svg, /<image[^>]*href="data:image\/png/,
        `a producer that ${name} must leave today's raster path untouched`);
      assert.ok(!svg.includes('rgb(9,9,9)'), `${name}: nothing from a rejected twin may reach the output`);
    }
  });

test('a twin producer that re-enters the walker gets NO twins inside it (depth guard)',
  { skip: SKIP }, async () => {
    // The real timeline twin builds its node thumbnails by calling the walker. If the
    // guard were missing, an inner canvas carrying its own twin would recurse - and a
    // twin whose producer renders its OWN subtree would not terminate at all.
    const out = await twinScenario(`
      const host = document.createElement('div');
      host.style.cssText = 'position:absolute;left:0;top:200px;width:40px;height:20px';
      const inner = document.createElement('canvas');
      inner.width = 40; inner.height = 20;
      inner.style.cssText = 'display:block;width:40px;height:20px';
      const ig = inner.getContext('2d');
      ig.fillStyle = 'rgb(7,7,7)'; ig.fillRect(0, 0, 40, 20);
      inner.__lollyVectorTwin = () => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 20"><rect width="40" height="20" fill="rgb(200,0,0)"/></svg>';
      host.appendChild(inner);
      document.body.appendChild(host);
      cv.__lollyVectorTwin = async () => await render(host);
      const nested = await render();
      return { nested };
    `);
    const svg = out.nested!;
    // Premise, and it is required: the OUTER twin really was used, so the raster
    // below can only have come from the nested walk. The two canvases are deliberately
    // different sizes (100×50 vs 40×20) so the boxes tell them apart.
    assert.ok(!/<image[^>]*\bwidth="100"[^>]*\bheight="50"/.test(svg),
      'premise: the outer canvas took the twin path, not the raster path');
    assert.match(svg, /<image[^>]*href="data:image\/png[^>]*\bwidth="40"[^>]*\bheight="20"/,
      'the INNER canvas must still rasterise - only the outermost walk may use twins');
    assert.ok(!svg.includes('rgb(200,0,0)'),
      'the inner canvas\'s own twin must NOT have been consulted during a nested walk');
  });
