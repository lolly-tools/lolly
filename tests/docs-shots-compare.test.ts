// SPDX-License-Identifier: MPL-2.0
// Docs-screenshot comparison logic (scripts/lib/shot-compare.ts) — the pure rules
// behind `npm run docs:shots`. Synthetic RGBA buffers only: no Chromium, no sharp.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_THRESHOLDS, channelStddev, isBlank, pixelDiffFraction, classifyShot,
  parseShotRecipes, stripSvgC2pa, svgRootSize, classifyVectorShot,
  type RawImage,
} from '../scripts/lib/shot-compare.ts';

/** Uniform w×h RGBA image. */
function uniform(w: number, h: number, [r, g, b, a]: [number, number, number, number]): RawImage {
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) data.set([r, g, b, a], i * 4);
  return { width: w, height: h, data };
}

/** Deterministic high-contrast pattern (checkerboard) — very much not blank. */
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
