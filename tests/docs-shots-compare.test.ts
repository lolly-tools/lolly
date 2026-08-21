// SPDX-License-Identifier: MPL-2.0
// Docs-screenshot comparison logic (scripts/lib/shot-compare.ts) - the pure rules
// behind `npm run docs:shots`. Synthetic RGBA buffers only: no Chromium, no sharp.
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import {
  DEFAULT_THRESHOLDS, MAX_SHOT_PX, clampDpr, ineffectiveTolerance, channelStddev, isBlank, pixelDiffFraction, classifyShot,
  parseShotRecipes, stripSvgC2pa, svgRootSize, classifyVectorShot,
  type RawImage, walkerWindow } from '../scripts/lib/shot-compare.ts';

/** Uniform w×h RGBA image. */
function uniform(w: number, h: number, [r, g, b, a]: [number, number, number, number]): RawImage {
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) data.set([r, g, b, a], i * 4);
  return { width: w, height: h, data };
}

/** Deterministic high-contrast pattern (checkerboard) - very much not blank. */
function checker(w: number, h: number): RawImage {
  const img = uniform(w, h, [0, 0, 0, 255]);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if ((x + y) % 2 === 0) img.data.set([255, 255, 255, 255], (y * w + x) * 4);
    }
  }
  return img;
}

test('channelStddev: uniform image has zero deviation; checkerboard does not', () => {
  assert.equal(channelStddev(uniform(8, 8, [200, 100, 50, 255])), 0);
  assert.ok(channelStddev(checker(8, 8)) > 100);
});

test('isBlank: uniform wash is blank, real content is not', () => {
  assert.equal(isBlank(uniform(16, 16, [255, 255, 255, 255])), true);
  assert.equal(isBlank(checker(16, 16)), false);
});

test('pixelDiffFraction: identical → 0, dims mismatch → null, tolerance respected', () => {
  const a = checker(10, 10);
  assert.equal(pixelDiffFraction(a, checker(10, 10), 12), 0);
  assert.equal(pixelDiffFraction(a, checker(10, 12), 12), null);

  // One pixel nudged just under the tolerance → still 0; over it → exactly 1 pixel.
  const under = checker(10, 10);
  under.data[0] = under.data[0]! > 128 ? under.data[0]! - 12 : under.data[0]! + 12;
  assert.equal(pixelDiffFraction(a, under, 12), 0);
  const over = checker(10, 10);
  over.data[0] = over.data[0]! > 128 ? over.data[0]! - 13 : over.data[0]! + 13;
  assert.equal(pixelDiffFraction(a, over, 12), 1 / 100);
});

test('classifyShot: no baseline → new; tiny + blank flags mark a probable failed render', () => {
  const v = classifyShot({
    newBytes: 500,
    newImg: uniform(10, 10, [255, 255, 255, 255]),
    expected: { width: 10, height: 10 },
  });
  assert.equal(v.kind, 'new');
  assert.ok(v.flags.includes('tiny'));
  assert.ok(v.flags.includes('blank'));
  assert.equal(v.pixelDiff, null);
});

test('classifyShot: identical capture → unchanged, no flags', () => {
  const img = checker(10, 10);
  const v = classifyShot({
    newBytes: 50_000,
    newImg: img,
    expected: { width: 10, height: 10 },
    oldBytes: 50_000,
    oldImg: checker(10, 10),
  });
  assert.equal(v.kind, 'unchanged');
  assert.deepEqual(v.flags, []);
  assert.equal(v.pixelDiff, 0);
});

test('classifyShot: visible difference → changed; big byte swing → size-jump flag', () => {
  const changed = checker(10, 10);
  for (let i = 0; i < 10; i++) changed.data.set([30, 200, 90, 255], i * 4); // 10% of pixels
  const v = classifyShot({
    newBytes: 90_000,
    newImg: changed,
    expected: { width: 10, height: 10 },
    oldBytes: 50_000, // +80% > sizeDeltaFrac 0.4
    oldImg: checker(10, 10),
  });
  assert.equal(v.kind, 'changed');
  assert.ok(v.flags.includes('size-jump'));
  assert.ok((v.pixelDiff ?? 0) >= 0.1 - 1e-9);
  assert.ok((v.sizeDelta ?? 0) > 0.4);
});

test('classifyShot: baseline with different dimensions → changed (not comparable)', () => {
  const v = classifyShot({
    newBytes: 50_000,
    newImg: checker(10, 10),
    expected: { width: 10, height: 10 },
    oldBytes: 50_000,
    oldImg: checker(12, 10),
  });
  assert.equal(v.kind, 'changed');
  assert.equal(v.pixelDiff, null);
});

test('classifyShot: dims-mismatch honours the rounding slack', () => {
  const base = { newBytes: 50_000, newImg: checker(10, 10), oldBytes: 50_000, oldImg: checker(10, 10) };
  assert.ok(!classifyShot({ ...base, expected: { width: 12, height: 10 } }).flags.includes('dims-mismatch'));
  assert.ok(classifyShot({ ...base, expected: { width: 13, height: 10 } }).flags.includes('dims-mismatch'));
  assert.equal(DEFAULT_THRESHOLDS.dimSlack, 2);
});

test('parseShotRecipes: extracts a full url-shot recipe from a markdown image', () => {
  const md =
    '![The gallery](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600' +
    '&css=.welcome-dialog%7Bdisplay%3Anone%7D&tolerance=0.03&cropTop=0.1&format=svg&filename=gallery)';
  const { recipes, problems } = parseShotRecipes(md);
  assert.deepEqual(problems, []);
  assert.equal(recipes.length, 1);
  const r = recipes[0]!;
  assert.equal(r.slug, 'gallery');
  assert.equal(r.route, '/#/');                      // URLSearchParams decodes %2F%23%2F
  assert.equal(r.format, 'svg');
  assert.equal(r.width, 1440);
  assert.equal(r.height, 900);
  assert.equal(r.dpi, 192);
  assert.equal(r.waitMs, 1600);
  assert.equal(r.cropTop, 0.1);
  assert.equal(r.css, '.welcome-dialog{display:none}');
  assert.equal(r.pixelDiffFrac, 0.03);
});

test('parseShotRecipes: cropSelector is carried through verbatim', () => {
  const md = '![Share dialog](/t/url-shot?url=%2F%23%2Fprofile&cropSelector=.share-dialog&format=png&filename=share)';
  const { recipes, problems } = parseShotRecipes(md);
  assert.deepEqual(problems, []);
  assert.equal(recipes[0]!.cropSelector, '.share-dialog');
});

test('parseShotRecipes: waitSelector is carried through decoded', () => {
  const md = '![Viz](/t/url-shot?url=%2F%23%2F%3Fneuro%3Dviz&waitSelector=.viz-panel%5Bdata-demo-settled%5D&walker=1&format=svg&filename=viz)';
  const { recipes, problems } = parseShotRecipes(md);
  assert.deepEqual(problems, []);
  assert.equal(recipes[0]!.waitSelector, '.viz-panel[data-demo-settled]');
});

test('parseShotRecipes: identical duplicates share a baseline; conflicts and bad params are problems', () => {
  const same = '/t/url-shot?url=%2F%23%2F&format=svg&filename=gallery';
  const dup = parseShotRecipes(`![a](${same})\n![b](${same})`);
  assert.deepEqual(dup.problems, []);
  assert.equal(dup.recipes.length, 1);

  const conflict = parseShotRecipes(
    `![a](${same})\n![b](/t/url-shot?url=%2F%23%2Fstart&format=svg&filename=gallery)`,
  );
  assert.ok(conflict.problems.some((p) => p.includes('different recipe')));

  const bad = parseShotRecipes(
    '![no name](/t/url-shot?url=%2F%23%2F&format=svg)\n' +
    '![bad route](/t/url-shot?url=https%3A%2F%2Felsewhere.example&format=svg&filename=external)\n' +
    '![bad format](/t/url-shot?url=%2F%23%2F&format=bmp&filename=bmp-shot)\n' +
    '![bad tol](/t/url-shot?url=%2F%23%2F&tolerance=7&filename=tol-shot)',
  );
  assert.ok(bad.problems.some((p) => p.includes('filename=')));
  assert.ok(bad.problems.some((p) => p.includes('domain-relative')));
  assert.ok(bad.problems.some((p) => p.includes('format must be')));
  assert.ok(bad.problems.some((p) => p.includes('tolerance must be')));
});

const VEC = (body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 675" width="1440" height="900">${body}</svg>`;

test('stripSvgC2pa: removes the engine placeSvg block so timestamps never diff', () => {
  const plain = VEC('<path d="M0 0h10v10z"/>');
  const stamped = plain
    .replace('<svg ', '<svg xmlns:c2pa="http://c2pa.org/manifest" ')
    .replace('>', '><metadata><c2pa:manifest>QUJD</c2pa:manifest></metadata>');
  assert.equal(stripSvgC2pa(stamped), plain);
  assert.equal(stripSvgC2pa(plain), plain);
});

test('svgRootSize reads the root width/height', () => {
  assert.deepEqual(svgRootSize(VEC('')), { width: 1440, height: 900 });
  assert.equal(svgRootSize('<div>not svg</div>'), null);
});

test('classifyVectorShot: unchanged ignores the baseline C2PA block; changes and dims flag', () => {
  const fresh = VEC('<path d="M0 0h10v10z"/>');
  const baseline = fresh.replace('>', '><metadata><c2pa:manifest>QUJD</c2pa:manifest></metadata>');
  const expected = { width: 1440, height: 900 };

  const unchanged = classifyVectorShot({
    newText: fresh, newBytes: 40_000, expected, oldText: baseline, oldBytes: 42_000,
  });
  assert.equal(unchanged.kind, 'unchanged');
  assert.deepEqual(unchanged.flags, []);

  const changed = classifyVectorShot({
    newText: VEC('<path d="M0 0h20v20z"/>'), newBytes: 90_000, expected, oldText: baseline, oldBytes: 40_000,
  });
  assert.equal(changed.kind, 'changed');
  assert.ok(changed.flags.includes('size-jump'));

  const fresh2 = classifyVectorShot({ newText: fresh, newBytes: 1_000, expected: { width: 100, height: 100 } });
  assert.equal(fresh2.kind, 'new');
  assert.ok(fresh2.flags.includes('tiny'));
  assert.ok(fresh2.flags.includes('dims-mismatch'));
  assert.equal(DEFAULT_THRESHOLDS.vectorMinBytes, 2_048);
});

test('parseShotRecipes: format defaults to svg; ordinary images are ignored', () => {
  const { recipes, problems } = parseShotRecipes(
    '![shot](/t/url-shot?url=%2F%23%2Fp&filename=projects)\n' +
    '![mascot](/info/mascots/quokka.png)\n' +
    '![tool link, not url-shot](/t/qr-code?url=x)',
  );
  assert.deepEqual(problems, []);
  assert.equal(recipes.length, 1);
  assert.equal(recipes[0]!.format, 'svg');
});

// ── Weight budget: the ceilings, and the density clamp that keeps them ────────
//
// Every threshold in this pipeline used to be a FLOOR (tiny/blank), which is how
// docs/shots grew to 70 MB of baselines up to 2880px wide while a reader never
// sees more than an 848px column. These tests pin the ceiling side.

test('clampDpr: a tight crop keeps its full density', () => {
  // 600 CSS px of visible content at 2x = 1200px - comfortably inside the budget,
  // so the recipe's requested density survives untouched. This is the case the
  // house rule produces (crop to the area of focus), and it must not be penalised.
  assert.equal(clampDpr(192, 600), 2);
  assert.equal(clampDpr(288, 400), 3);
});

test('clampDpr: a full-window frame gives density back instead of exceeding the ceiling', () => {
  // The historic default pairing: 1440 CSS px at 192dpi = 2880px, ~2.9x the pixels
  // of the display ceiling. The clamp reduces the ratio so width lands at the cap.
  const dpr = clampDpr(192, 1440);
  assert.ok(dpr < 2, 'a 1440-wide frame must not keep 2x');
  assert.ok(Math.round(1440 * dpr) <= MAX_SHOT_PX);
});

test('clampDpr: never below CSS resolution, and 96dpi is left alone', () => {
  // Downsampling under 1x would render soft at ANY display size - worse than heavy.
  assert.equal(clampDpr(192, 4_000), 1);
  assert.equal(clampDpr(96, 600), 1, '96dpi means 1x, not "scale me up"');
  assert.equal(clampDpr(48, 600), 1, 'a sub-96 dpi is not a downscale request');
});

test('clampDpr: a nonsense clip width falls back to the request rather than dividing by zero', () => {
  assert.equal(clampDpr(192, 0), 2);
  assert.equal(clampDpr(192, -10), 2);
});

test('classifyShot: over-scale fires on width, heavy on bytes', () => {
  const wide = checker(MAX_SHOT_PX + 200, 100);
  const v = classifyShot({
    newBytes: 50_000, newImg: wide,
    expected: { width: wide.width, height: wide.height },
  });
  assert.deepEqual(v.flags, ['over-scale']);

  const heavy = classifyShot({
    newBytes: DEFAULT_THRESHOLDS.maxBytes + 1, newImg: checker(800, 600),
    expected: { width: 800, height: 600 },
  });
  assert.deepEqual(heavy.flags, ['heavy']);
});

test('classifyShot: the ceilings are judged on a NEW shot too', () => {
  // Checked before the no-baseline early return: the cheapest moment to stop an
  // over-weight baseline is the run that would create it.
  const v = classifyShot({
    newBytes: DEFAULT_THRESHOLDS.maxBytes + 1,
    newImg: checker(MAX_SHOT_PX + 10, 50),
    expected: { width: MAX_SHOT_PX + 10, height: 50 },
  });
  assert.equal(v.kind, 'new');
  assert.deepEqual(v.flags.sort(), ['heavy', 'over-scale']);
});

test('classifyShot: a shot inside the budget carries no weight flag', () => {
  const img = checker(1_600, 1_000);
  const v = classifyShot({
    newBytes: 400_000, newImg: img, expected: { width: 1_600, height: 1_000 },
    oldBytes: 400_000, oldImg: img,
  });
  assert.deepEqual(v.flags, []);
  assert.equal(v.kind, 'unchanged');
});

test('classifyVectorShot: heavy fires on bytes; there is no pixel width to judge', () => {
  const svg = '<svg width="800" height="600"><rect/></svg>';
  const v = classifyVectorShot({
    newText: svg, newBytes: DEFAULT_THRESHOLDS.vectorMaxBytes + 1,
    expected: { width: 800, height: 600 },
  });
  assert.deepEqual(v.flags, ['heavy']);
  assert.ok(!v.flags.includes('over-scale'), 'over-scale is a raster concept');
});

test('the budget is derived from the /info column, not fitted to the corpus', () => {
  // 848 CSS px content column at DPR 2 = 1696 device px; the cap is that plus
  // rounding slack. If this number ever moves, docs/build.ts's .docs-wrap /
  // .docs-content geometry is what has to justify it.
  assert.equal(MAX_SHOT_PX, 1_800);
  assert.equal(DEFAULT_THRESHOLDS.maxWidth, MAX_SHOT_PX);
  assert.ok(DEFAULT_THRESHOLDS.maxBytes > DEFAULT_THRESHOLDS.minBytes);
  assert.ok(DEFAULT_THRESHOLDS.vectorMaxBytes > DEFAULT_THRESHOLDS.vectorMinBytes);
});

test('ineffectiveTolerance names vector recipes whose tolerance cannot apply', () => {
  // tolerance= sets pixelDiffFrac, which only classifyShot reads; a vector shot is
  // compared as a document by exact string equality, so the parameter is silently
  // inert. The walker migration carried tolerance=0.03 onto format=svg recipes that
  // frame animated content, which is exactly how this goes unnoticed.
  const shots = [
    { slug: 'raster-with-tol', format: 'png', pixelDiffFrac: 0.03 },
    { slug: 'vector-with-tol', format: 'svg', pixelDiffFrac: 0.03 },
    { slug: 'vector-plain', format: 'svg' },
  ] as unknown as Parameters<typeof ineffectiveTolerance>[0];
  assert.deepEqual(ineffectiveTolerance(shots), ['vector-with-tol']);
});

// ── walkerWindow: anchoring the published frame to the VISIBLE band ──────────

test('a taller-than-viewport centred element frames its visible band, not the top', () => {
  // The measured defect. renderSvgFromHtml emits nodes relative to the walked
  // node's top-left, so root (0,0) is that corner - and a 944x2009 element
  // centred in a 900px viewport sits at rect.top = -554.5. Anchoring the window
  // at 0,0 published y 0-900 (off-screen) while the reader saw y 554.5-1454.5.
  const w = walkerWindow({ w: 944, h: 2009 }, { w: 1440, h: 900 }, { x: 0, y: 554.5 });
  assert.deepEqual(w, { x: 0, y: 554.5, w: 944, h: 900 });
});

test('an element that fits on screen is unchanged - the common case must not churn', () => {
  // off is {0,0} for anything fully visible, and min() already no-ops on a box
  // smaller than the frame, so the arithmetic reduces to what shipped before.
  assert.deepEqual(walkerWindow({ w: 600, h: 600 }, { w: 1440, h: 900 }, { x: 0, y: 0 }),
    { x: 0, y: 0, w: 600, h: 600 });
  assert.deepEqual(walkerWindow({ w: 1440, h: 900 }, { w: 1440, h: 900 }, { x: 0, y: 0 }),
    { x: 0, y: 0, w: 1440, h: 900 });
});

test('the window never escapes the walked box, so it can never frame empty space', () => {
  // Clamped to nat - size on both axes. Without this a large offset would publish
  // a band past the end of the content, which no backdrop would cover.
  const w = walkerWindow({ w: 500, h: 1000 }, { w: 400, h: 300 }, { x: 9999, y: 9999 });
  assert.deepEqual(w, { x: 100, y: 700, w: 400, h: 300 });
  assert.ok(w.x + w.w <= 500 && w.y + w.h <= 1000);
});

test('an element SMALLER than the frame keeps its own box rather than being padded', () => {
  // Padding out to the recipe frame would add a transparent ring the subtree-scoped
  // walk has no ink for, and /info never upscales, so it would just publish smaller.
  assert.deepEqual(walkerWindow({ w: 236, h: 39.5 }, { w: 1440, h: 900 }, { x: 0, y: 0 }),
    { x: 0, y: 0, w: 236, h: 39.5 });
});

test('a horizontal overflow anchors on x the same way', () => {
  assert.deepEqual(walkerWindow({ w: 3000, h: 400 }, { w: 1440, h: 900 }, { x: 800, y: 0 }),
    { x: 800, y: 0, w: 1440, h: 400 });
});

test('the windowing inlined in the browser context still matches walkerWindow', () => {
  // build-docs-shots.ts computes the window inside a page.evaluate(), where it
  // cannot import anything - so the arithmetic is written out a second time and
  // the unit tests above would keep passing while the pipeline drifted. Rather
  // than compare source text (which reformats), lift the four expressions out and
  // run them against the same inputs the helper gets.
  const src = readFileSync(new URL('../scripts/build-docs-shots.ts', import.meta.url), 'utf-8');
  const grab = (name: string) => {
    const m = src.match(new RegExp(`const ${name} = (.+?);`));
    assert.ok(m, `build-docs-shots.ts no longer declares ${name} - re-point this test`);
    return m[1] as string;
  };
  const winWH = grab('winW'), wx = grab('wx'), wy = grab('wy');
  assert.match(winWH, /winH = /); // winW and winH share one declaration

  const inline = new Function('win', 'natW', 'natH', 'off', `
    const winW = ${winWH};
    const wx = ${wx};
    const wy = ${wy};
    return { x: wx, y: wy, w: winW, h: winH };
  `) as (win: { w: number; h: number }, natW: number, natH: number,
         off: { x: number; y: number }) => { x: number; y: number; w: number; h: number };

  for (const [nat, frame, off] of [
    [{ w: 944, h: 2009 }, { w: 1440, h: 900 }, { x: 0, y: 554.5 }],
    [{ w: 600, h: 600 }, { w: 1440, h: 900 }, { x: 0, y: 0 }],
    [{ w: 500, h: 1000 }, { w: 400, h: 300 }, { x: 9999, y: 9999 }],
    [{ w: 3000, h: 400 }, { w: 1440, h: 900 }, { x: 800, y: 0 }],
  ] as const) {
    assert.deepEqual(inline(frame, nat.w, nat.h, off), walkerWindow(nat, frame, off),
      `inline windowing diverged from walkerWindow for ${JSON.stringify(nat)}`);
  }
});
