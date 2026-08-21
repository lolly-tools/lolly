// SPDX-License-Identifier: MPL-2.0
/**
 * Goldens for engine/src/svg-layers.ts - "Lift layers" (plans/104 section 7 P3).
 *
 * The essential assertion in this file is the PARTITION property, and here is
 * why it is the one to have. section 7's exit criterion is "N lifted
 * layers at z = 0 render byte-identical to the un-lifted original", and there
 * are two ways to check that. One is to rasterise both and compare pixels,
 * which needs a browser and answers about the *renderer* as much as about us - 
 * `tests/svg-lift-identity.browser.test.ts` does exactly that, in a real engine,
 * and measured that "byte-identical" is not literally reachable there (a browser
 * composites each layer through its own 8-bit premultiplied buffer, so it rounds
 * twice where one pass rounds once). The other is to check the thing the
 * renderer's answer DEPENDS on: that the layers' bodies, concatenated in paint
 * order, are the source's own bytes - no node dropped, none duplicated, none
 * reordered. THAT one is exact, runs everywhere, and fails with a diff you can
 * read. Both exist; this is the one that bites first, and the one whose
 * "byte-identical" is literal.
 *
 * Run with: node --import ./tests/css-stub.mjs --test "tests/svg-layers.test.ts"
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  enumerateSvgLayers,
  SVG_LAYERS_MAX, SVG_LAYERS_MAX_CHARS, SVG_LAYERS_MAX_TAGS, SVG_LAYERS_MAX_CANDIDATES,
  SVG_LAYERS_MAX_DESCENT, SVG_LAYERS_MAX_REFS, SVG_LAYERS_HEAVY_BYTES,
} from '../engine/src/svg-layers.ts';

const NS = 'http://www.w3.org/2000/svg';
const doc = (body: string, attrs = ' viewBox="0 0 100 100"'): string =>
  `<svg xmlns="${NS}"${attrs}>${body}</svg>`;

/** The part of a derived layer between its root tags. */
function inner(markup: string): string {
  const open = markup.indexOf('>');
  return markup.slice(open + 1, markup.lastIndexOf('</svg>'));
}

/**
 * The partition check.
 *
 * Strip each derived document's prologue - the carried non-rendering siblings
 * (which the caller knows, because it wrote them) plus any `<defs>` borrowed to
 * repair a cross-layer reference - and any wrapper the enumerator descended
 * through, then concatenate what is left. It must equal the source's own
 * rendered children, byte for byte.
 *
 * A leading `<defs>` after the carry can only ever BE a borrowed repair: a
 * top-level `<defs>` is carried, so it is already gone by that point.
 */
function assertPartition(
  layers: Array<{ markup: string }>,
  expectBody: string,
  o: { carry?: string; wrapOpen?: string; wrapClose?: string } = {},
): void {
  const carry = o.carry ?? '';
  const bodies = layers.map((l) => {
    let s = inner(l.markup);
    assert.ok(s.startsWith(carry), `every layer repeats the carried prologue: ${s.slice(0, 80)}`);
    s = s.slice(carry.length);
    if (s.startsWith('<defs>')) s = s.slice(s.indexOf('</defs>') + '</defs>'.length);
    if (o.wrapOpen) {
      assert.ok(s.startsWith(o.wrapOpen) && s.endsWith(o.wrapClose!), s.slice(0, 80));
      s = s.slice(o.wrapOpen.length, -o.wrapClose!.length);
    }
    return s;
  });
  assert.equal(bodies.join(''), expectBody, 'layers must partition the source\'s rendered children');
}

// ─── enumeration ─────────────────────────────────────────────────────────────

test('every top-level <g> is a layer, in paint order', () => {
  const body = '<g id="a"><rect width="10" height="10"/></g><g id="b"><rect x="50" width="10" height="10"/></g>';
  const r = enumerateSvgLayers(doc(body));
  assert.equal(r.layers.length, 2);
  assert.deepEqual(r.layers.map((l) => l.label), ['Layer 1', 'Layer 2']);
  assert.deepEqual(r.layers.map((l) => l.index), [0, 1]);
  assert.ok(r.layers[0]!.markup.includes('id="a"'));
  assert.ok(!r.layers[0]!.markup.includes('id="b"'), 'a layer carries only its own group');
  assertPartition(r.layers, body);
});

test('the root attributes are reproduced verbatim, so every layer is in ROOT coordinates', () => {
  const attrs = ' viewBox="10 20 300 400" preserveAspectRatio="xMinYMid slice" width="300" height="400"';
  const r = enumerateSvgLayers(doc('<g><rect width="1" height="1"/></g><g><rect width="1" height="1"/></g>', attrs));
  for (const l of r.layers) {
    assert.ok(l.markup.startsWith(`<svg xmlns="${NS}"${attrs}>`), l.markup.slice(0, 120));
  }
});

test('a missing xmlns is supplied - a data: URL <img> needs it to render at all', () => {
  const r = enumerateSvgLayers('<svg viewBox="0 0 10 10"><g><rect width="1" height="1"/></g><g><circle r="1"/></g></svg>');
  assert.equal(r.layers.length, 2);
  for (const l of r.layers) assert.ok(l.markup.includes(`xmlns="${NS}"`));
});

test('the WHOLE <defs> rides into every layer (cheap, correct for cross-refs)', () => {
  const defs = '<defs><linearGradient id="g1"><stop offset="0" stop-color="#f00"/></linearGradient></defs>';
  const body = '<g><rect width="9" height="9" fill="url(#g1)"/></g><g><circle cx="50" cy="50" r="9" fill="url(#g1)"/></g>';
  const r = enumerateSvgLayers(doc(defs + body));
  assert.equal(r.layers.length, 2);
  for (const l of r.layers) assert.ok(l.markup.includes('id="g1"'), 'every layer keeps the paint server');
  assertPartition(r.layers, body, { carry: defs });
});

test('<style> is carried too - a class-driven fill would otherwise vanish per layer', () => {
  const style = '<style>.a{fill:#0a0}</style>';
  const r = enumerateSvgLayers(doc(`${style}<g><rect class="a" width="9" height="9"/></g><g><rect class="a" x="40" width="9" height="9"/></g>`));
  for (const l of r.layers) assert.ok(l.markup.includes('.a{fill:#0a0}'));
});

test('<title>/<desc>/<metadata> never reach a derived layer - the PII strip is not undone', () => {
  const r = enumerateSvgLayers(doc(
    '<title>Q3 revenue, internal</title><desc>drawn by a person</desc><metadata>rdf</metadata>' +
    '<g><rect width="9" height="9"/></g><g><rect x="40" width="9" height="9"/></g>',
  ));
  assert.equal(r.layers.length, 2);
  for (const l of r.layers) {
    assert.ok(!/<title|<desc|<metadata/i.test(l.markup), l.markup);
    assert.match(l.label, /^Layer \d+$/, 'labels are indices, never names');
  }
});

test('a name in the file is never read as a label', () => {
  const r = enumerateSvgLayers(doc(
    '<g data-name="Andy background" inkscape:label="secret"><rect width="9" height="9"/></g>' +
    '<g id="foreground"><rect x="40" width="9" height="9"/></g>',
  ));
  assert.deepEqual(r.layers.map((l) => l.label), ['Layer 1', 'Layer 2']);
});

// ─── the single wrapper ──────────────────────────────────────────────────────

test('a lone wrapping <g> is descended through - "1 layer found" is not a lift', () => {
  const r = enumerateSvgLayers(doc('<g id="Layer_1"><rect width="9" height="9"/><circle cx="50" cy="50" r="9"/></g>'));
  assert.equal(r.layers.length, 2, 'the wrapper is not the layer; its children are');
  for (const l of r.layers) assert.ok(l.markup.includes('id="Layer_1"'), 'the wrapper rides along as an ancestor');
});

test('the descended wrapper keeps its transform, and bboxes come back in ROOT units', () => {
  const r = enumerateSvgLayers(doc('<g transform="translate(5 5)"><rect width="4" height="4"/><rect x="10" width="4" height="4"/></g>'));
  assert.equal(r.layers.length, 2);
  for (const l of r.layers) assert.ok(l.markup.includes('transform="translate(5 5)"'));
  assert.deepEqual(r.layers[0]!.bbox, { x: 5, y: 5, w: 4, h: 4 });
  assert.deepEqual(r.layers[1]!.bbox, { x: 15, y: 5, w: 4, h: 4 });
});

test('a chain of single wrappers is descended to the first branch', () => {
  const r = enumerateSvgLayers(doc('<g id="w1"><g id="w2"><rect width="4" height="4"/><rect x="40" width="4" height="4"/></g></g>'));
  assert.equal(r.layers.length, 2);
  assert.ok(r.layers[0]!.markup.includes('id="w1"') && r.layers[0]!.markup.includes('id="w2"'));
});

test('descent stops at the descent cap rather than running away', () => {
  let body = '<rect width="4" height="4"/><rect x="40" width="4" height="4"/>';
  for (let i = 0; i < SVG_LAYERS_MAX_DESCENT + 4; i++) body = `<g id="w${i}">${body}</g>`;
  const r = enumerateSvgLayers(doc(body));
  assert.equal(r.layers.length, 1, 'the cap was reached before the branch - one layer, not a crash');
  assert.ok(r.layers[0]!.markup.includes('<rect width="4" height="4"/>'));
});

for (const [attr, why] of [
  ['opacity="0.5"', 'group opacity'],
  ['filter="url(#f)"', 'a group filter'],
  ['mask="url(#m)"', 'a group mask'],
  ['style="mix-blend-mode:multiply"', 'a blend mode in style'],
  ['style="opacity:.4"', 'opacity in style'],
] as const) {
  test(`descent REFUSES a wrapper with ${why} - splitting it would change the picture`, () => {
    const r = enumerateSvgLayers(doc(`<g ${attr}><rect width="9" height="9"/><rect x="4" width="9" height="9"/></g>`));
    assert.equal(r.layers.length, 1, 'the wrapper stays whole');
    assert.ok(r.warnings.some((w) => w.includes('applies to all of it at once')), r.warnings.join(' | '));
  });
}

test('opacity="1" and filter="none" are no-ops and do NOT block the descent', () => {
  const r = enumerateSvgLayers(doc('<g opacity="1" filter="none"><rect width="4" height="4"/><rect x="40" width="4" height="4"/></g>'));
  assert.equal(r.layers.length, 2);
  assert.deepEqual(r.warnings, []);
});

test('transform and clip-path do not block the descent either - both are idempotent per layer', () => {
  const r = enumerateSvgLayers(doc('<g clip-path="url(#c)" transform="scale(2)"><rect width="4" height="4"/><rect x="40" width="4" height="4"/></g>'));
  assert.equal(r.layers.length, 2);
  for (const l of r.layers) assert.ok(l.markup.includes('clip-path="url(#c)"'));
});

// ─── clustering (the pdf-artwork.ts posture) ────────────────────────────────

test('stray leaves near each other become ONE layer; distant ones do not', () => {
  const body =
    '<rect x="0" y="0" width="10" height="10"/><rect x="12" y="0" width="10" height="10"/>' +
    '<circle cx="90" cy="90" r="4"/>';
  const r = enumerateSvgLayers(doc(body));
  assert.equal(r.layers.length, 2, 'two touching rects cluster; the far circle stays alone');
  assert.equal(r.layers[0]!.nodes, 2);
  assert.equal(r.layers[1]!.nodes, 1);
  assertPartition(r.layers, body);
});

test('a group is a hint, never a requirement - an ungrouped drawing still lifts', () => {
  // Nothing here is grouped at all: the structure comes entirely from proximity.
  const body =
    '<path d="M0 0 L8 0 L8 8 Z"/><path d="M2 2 L6 2 L6 6 Z"/>' +
    '<path d="M70 70 L78 70 L78 78 Z"/><path d="M72 72 L76 72 L76 76 Z"/>';
  const r = enumerateSvgLayers(doc(body));
  assert.equal(r.layers.length, 2);
  assert.deepEqual(r.layers.map((l) => l.nodes), [2, 2]);
});

test('an unmeasurable leaf (<text>) is its own layer - we do not guess where it is', () => {
  const body = '<rect width="10" height="10"/><text x="1" y="9">hi</text>';
  const r = enumerateSvgLayers(doc(body));
  assert.equal(r.layers.length, 2);
  assert.equal(r.layers.find((l) => l.markup.includes('<text'))!.bbox, null);
  assertPartition(r.layers, body);
});

test('paint order wins over proximity: a cluster something paints through is split', () => {
  // Two rects that WOULD cluster (they touch), with an overlapping group between
  // them in document order. Merging them would hoist the second rect below the
  // group it is painted above.
  const body =
    '<rect x="0" y="0" width="20" height="20" fill="#f00"/>' +
    '<g><rect x="5" y="5" width="20" height="20" fill="#0f0"/></g>' +
    '<rect x="10" y="10" width="20" height="20" fill="#00f"/>';
  const r = enumerateSvgLayers(doc(body));
  assert.equal(r.layers.length, 3, 'three layers, in document order');
  assert.ok(r.warnings.some((w) => w.includes('stacking order')), r.warnings.join(' | '));
  assertPartition(r.layers, body);
});

test('layers always come back in paint order, whatever the clustering did', () => {
  const body =
    '<rect x="0" width="5" height="5"/>' +
    '<g id="mid"><rect x="60" y="60" width="5" height="5"/></g>' +
    '<rect x="2" y="2" width="5" height="5"/>';
  const r = enumerateSvgLayers(doc(body));
  // The two rects cluster (they touch) and the group does not overlap them, so
  // the merge is safe - and the merged layer still sits where its FIRST member was.
  assert.equal(r.layers.length, 2);
  assert.equal(r.layers[0]!.nodes, 2);
  assert.ok(r.layers[1]!.markup.includes('id="mid"'));
});

// ─── the pathological <use> ─────────────────────────────────────────────────

test('a cross-group <use> keeps working: the referent is copied into that layer\'s <defs>', () => {
  // section 11's named risk. Lift these apart naively and layer 2 draws nothing.
  const body = '<g id="a"><path id="p" d="M0 0 L10 0 L10 10 Z" fill="#123"/></g><g id="b"><use href="#p" x="30"/></g>';
  const r = enumerateSvgLayers(doc(body));
  assert.equal(r.layers.length, 2);
  const second = r.layers[1]!.markup;
  assert.ok(second.includes('<use href="#p"'), 'the use survives');
  assert.ok(/<defs><path id="p"/.test(second), `the referent is repaired into <defs>: ${second}`);
  // …and it must be in <defs>, where it paints NOTHING - a copy outside would
  // double-draw the shape at its original position.
  assert.equal((second.match(/<path id="p"/g) ?? []).length, 1, 'exactly one copy');
  assert.ok(r.warnings.some((w) => w.includes('layer 2')), r.warnings.join(' | '));
  assertPartition(r.layers, body);
});

test('xlink:href and url(#…) forms are repaired the same way', () => {
  const r = enumerateSvgLayers(doc(
    '<g id="a"><clipPath id="cp"><rect width="5" height="5"/></clipPath><path id="q" d="M0 0 L5 5"/></g>' +
    '<g id="b"><use xlink:href="#q"/><rect clip-path="url(#cp)" width="9" height="9"/></g>',
  ));
  const second = r.layers[1]!.markup;
  assert.ok(second.includes('id="q"'), 'xlink:href referent copied');
  assert.ok(second.includes('id="cp"'), 'url(#…) referent copied');
});

test('a reference already resolvable in the layer is NOT duplicated', () => {
  const r = enumerateSvgLayers(doc(
    '<g id="a"><path id="p" d="M0 0 L5 5"/><use href="#p" x="9"/></g>' +
    '<g id="b"><rect x="60" width="5" height="5"/></g>',
  ));
  assert.equal((r.layers[0]!.markup.match(/id="p"/g) ?? []).length, 1);
  assert.deepEqual(r.warnings, []);
});

test('a reference into the carried <defs> needs no repair', () => {
  const r = enumerateSvgLayers(doc(
    '<defs><linearGradient id="g1"><stop offset="0"/></linearGradient></defs>' +
    '<g><rect width="5" height="5" fill="url(#g1)"/></g><g><rect x="60" width="5" height="5" fill="url(#g1)"/></g>',
  ));
  assert.deepEqual(r.warnings, []);
  for (const l of r.layers) assert.equal((l.markup.match(/id="g1"/g) ?? []).length, 1);
});

test('a dangling reference is left dangling - a lift does not invent artwork', () => {
  const r = enumerateSvgLayers(doc('<g><use href="#nope"/><rect width="5" height="5"/></g><g><rect x="60" width="5" height="5"/></g>'));
  assert.deepEqual(r.warnings, []);
  assert.ok(r.layers[0]!.markup.includes('#nope'));
});

test('a DESCENDED WRAPPER\'s own reference is repaired for every layer, not just the body\'s', () => {
  // `referencedIds` used to see the layer body ONLY. A wrapper the enumerator
  // descended through is reproduced in every derived document and can point at an
  // id that now lives inside ONE of the layers - measured on Chromium before this
  // fix: layer 1 painted a 200x200 rect where the original painted a clipped
  // 120x120 one (76 800 channels different) with `warnings` empty, because an
  // unresolvable `clip-path` renders as no clip at all.
  const inner1 = '<g><rect width="50" height="50"/></g>';
  const inner2 = '<g><clipPath id="c"><rect width="30" height="30"/></clipPath><rect x="60" width="20" height="20"/></g>';
  const r = enumerateSvgLayers(doc(`<g clip-path="url(#c)">${inner1}${inner2}</g>`));
  assert.equal(r.layers.length, 2);
  assert.ok(/<defs><clipPath id="c">/.test(r.layers[0]!.markup), r.layers[0]!.markup);
  assert.equal((r.layers[1]!.markup.match(/id="c"/g) ?? []).length, 1, 'the owning layer is not given a duplicate');
  assert.ok(r.warnings.some((w) => w.includes('layer 1')), r.warnings.join(' | '));
  assertPartition(r.layers, inner1 + inner2, { wrapOpen: '<g clip-path="url(#c)">', wrapClose: '</g>' });
});

test('a CARRIED node\'s reference into a layer is repaired too - the Illustrator <clipPath><use> shape', () => {
  const carry = '<clipPath id="c"><use href="#shape"/></clipPath>';
  const body = '<g clip-path="url(#c)"><rect width="50" height="50"/></g><g><rect id="shape" x="60" width="20" height="20"/></g>';
  const r = enumerateSvgLayers(doc(carry + body));
  assert.equal(r.layers.length, 2);
  assert.ok(/<defs><rect id="shape"/.test(r.layers[0]!.markup), r.layers[0]!.markup);
  assert.equal((r.layers[1]!.markup.match(/id="shape"/g) ?? []).length, 1);
  assertPartition(r.layers, body, { carry });
});

test('references PAST the repair cap are named, not silently unrepaired', () => {
  // The cap has always existed; being told about it has not. Past it the repair
  // simply stops looking, so a layer keeps a `url(#…)` whose target now lives in a
  // different document and paints nothing - the same silent-difference class as
  // the wrapper case above, arrived at by a different route.
  const defs: string[] = [];
  const uses: string[] = [];
  for (let i = 0; i < SVG_LAYERS_MAX_REFS + 4; i++) {
    defs.push(`<clipPath id="c${i}"><rect width="5" height="5"/></clipPath>`);
    uses.push(`<rect clip-path="url(#c${i})" x="${i}" width="1" height="1"/>`);
  }
  const r = enumerateSvgLayers(doc(`<g id="src">${defs.join('')}</g><g id="dst">${uses.join('')}</g>`));
  assert.equal(r.layers.length, 2);
  const copies = (r.layers[1]!.markup.match(/<clipPath id="c/g) ?? []).length;
  assert.equal(copies, SVG_LAYERS_MAX_REFS, 'the cap still bounds the work');
  assert.ok(r.warnings.some((w) => /left unrepaired/.test(w)), r.warnings.join(' | '));
});

test('a document sitting EXACTLY on the repair cap is not accused of overflowing it', () => {
  const defs: string[] = [];
  const uses: string[] = [];
  for (let i = 0; i < SVG_LAYERS_MAX_REFS; i++) {
    defs.push(`<clipPath id="c${i}"><rect width="5" height="5"/></clipPath>`);
    uses.push(`<rect clip-path="url(#c${i})" x="${i}" width="1" height="1"/>`);
  }
  const r = enumerateSvgLayers(doc(`<g id="src">${defs.join('')}</g><g id="dst">${uses.join('')}</g>`));
  assert.ok(!r.warnings.some((w) => /left unrepaired/.test(w)), r.warnings.join(' | '));
});

// ─── the root composites as a unit ──────────────────────────────────────────

for (const [attrs, why] of [
  [' opacity="0.55"', 'opacity'],
  [' filter="url(#f)"', 'filter'],
  [' style="mix-blend-mode:multiply"', 'mix-blend-mode'],
  [' mask="url(#m)"', 'mask'],
  [' style="isolation:isolate"', 'isolation'],
] as const) {
  test(`a root whose \`${why}\` applies to the whole picture is REFUSED, not split silently`, () => {
    // The same test the descent already ran on a wrapper `<g>`, run on the element
    // that wraps everything. `rootAttributes()` re-emits the root verbatim into
    // every layer, so `opacity="0.55"` up here is applied N times over instead of
    // once over the composite - measured on Chromium at 45 203 channels beyond
    // ±1 against the browser suite's 154-channel budget, with zero warnings.
    const r = enumerateSvgLayers(doc(
      '<g><rect width="60" height="60" fill="#c00"/></g><g><rect x="30" width="60" height="60" fill="#06c"/></g>',
      ` viewBox="0 0 100 100"${attrs}`,
    ));
    assert.deepEqual(r.layers, []);
    assert.ok(r.warnings[0]!.includes(why) && r.warnings[0]!.includes('whole'), r.warnings.join(' | '));
  });
}

test('a root carrying only NO-OP unit properties still lifts', () => {
  const body = '<g><rect width="5" height="5"/></g><g><rect x="60" width="5" height="5"/></g>';
  const r = enumerateSvgLayers(doc(body, ' viewBox="0 0 100 100" opacity="1" filter="none" style="mix-blend-mode:normal;isolation:auto"'));
  assert.equal(r.layers.length, 2);
  assertPartition(r.layers, body);
});

// ─── the walker identity passthrough ────────────────────────────────────────

test('data-box-id survives onto the layer as boxId - ids, never names', () => {
  const r = enumerateSvgLayers(doc('<g data-box-id="b7"><rect width="5" height="5"/></g><g><rect x="60" width="5" height="5"/></g>'));
  assert.equal(r.layers[0]!.boxId, 'b7');
  assert.equal(r.layers[1]!.boxId, undefined);
});

test('a clustered layer reports no boxId - it is not one element', () => {
  const r = enumerateSvgLayers(doc('<rect data-box-id="b1" width="5" height="5"/><rect data-box-id="b2" x="3" width="5" height="5"/>'));
  assert.equal(r.layers.length, 1);
  assert.equal(r.layers[0]!.boxId, undefined);
});

// ─── caps, junk, refusals ───────────────────────────────────────────────────

test('the layer cap MERGES THE TAIL - a cap must never drop artwork', () => {
  const parts: string[] = [];
  for (let i = 0; i < 10; i++) parts.push(`<g id="g${i}"><rect x="${i * 9}" width="4" height="4"/></g>`);
  const body = parts.join('');
  const r = enumerateSvgLayers(doc(body), { maxLayers: 4 });
  assert.equal(r.layers.length, 4);
  assert.equal(r.layers[3]!.nodes, 7, 'the last layer carries the whole tail');
  assert.ok(r.warnings.some((w) => w.includes('merged into one')), r.warnings.join(' | '));
  assertPartition(r.layers, body);
});

test('maxLayers can only lower the ceiling, never raise it', () => {
  const parts: string[] = [];
  for (let i = 0; i < SVG_LAYERS_MAX + 20; i++) parts.push(`<g><rect x="${i * 3}" width="1" height="1"/></g>`);
  const r = enumerateSvgLayers(doc(parts.join('')), { maxLayers: 5000 });
  assert.equal(r.layers.length, SVG_LAYERS_MAX);
});

test('the candidate cap bounds the QUADRATIC clustering - and merges the tail', () => {
  // Before this cap, 39 000 stray leaves took 16 seconds: the clustering is a
  // pairwise union-find. The cap is what makes a hostile (or merely large) file
  // a bounded wait instead of a hung tab, and the tail merge is what keeps it
  // from being a lift that lost half the drawing.
  const n = SVG_LAYERS_MAX_CANDIDATES + 500;
  const parts: string[] = [];
  for (let i = 0; i < n; i++) parts.push(`<rect x="${(i % 500) * 3}" y="${Math.floor(i / 500) * 3}" width="1" height="1"/>`);
  const body = parts.join('');
  const t0 = performance.now();
  const r = enumerateSvgLayers(doc(body, ' viewBox="0 0 1600 40"'));
  const ms = performance.now() - t0;
  assert.ok(ms < 3000, `clustering must stay bounded, took ${ms.toFixed(0)}ms`);
  assert.ok(r.warnings.some((w) => w.includes('shapes at its root')), r.warnings.join(' | '));
  assertPartition(r.layers, body);
});

test('the reference repair is bounded by the DOCUMENT, not by layers x refs', () => {
  // The companion to the clustering golden above, on the other axis. Both counts
  // are capped, but the id resolution used to run a fresh RegExp per (layer, ref)
  // over the whole layer body AND the whole carried markup: 64 x 64 x ~4 MB is
  // ~16 GB of character scanning, every byte of it inside the declared caps.
  // Measured on the shipped code, single-threaded, on the main thread behind the
  // dialog's "Reading the artwork..." panel: 1 832 ms with plain filler and
  // 10 682 ms when the filler NEAR-MISSES the regex - against 1 ms for the same
  // document with no references at all. The filler below is the near-miss case,
  // because it is the one that ran 10 seconds.
  const unit = ' id="nope-63-63z"';
  const filler = unit.repeat(Math.floor(3_400_000 / unit.length));
  const parts: string[] = [];
  for (let g = 0; g < SVG_LAYERS_MAX; g++) {
    const uses: string[] = [];
    for (let r = 0; r < SVG_LAYERS_MAX_REFS; r++) uses.push(`<use href="#nope-${g}-${r}"/>`);
    parts.push(`<g><rect x="${g}" width="1" height="1"/>${uses.join('')}</g>`);
  }
  const src = `<svg xmlns="${NS}" viewBox="0 0 100 100"><defs><!--${filler}--></defs>${parts.join('')}</svg>`;
  assert.ok(src.length < SVG_LAYERS_MAX_CHARS, 'the fixture has to sit INSIDE the size cap to prove anything');
  const t0 = performance.now();
  const r = enumerateSvgLayers(src);
  const ms = performance.now() - t0;
  assert.equal(r.layers.length, SVG_LAYERS_MAX);
  assert.ok(ms < 2000, `reference resolution must stay bounded, took ${ms.toFixed(0)}ms`);
});

test('a lift that multiplies the bytes says so BEFORE the caller writes them', () => {
  // Carrying the whole <defs> into every layer is free in pixels and not free in
  // bytes: one embedded raster in a <pattern> (Illustrator and Figma both emit
  // these) plus 24 groups derives 24x the source, and the shell writes every byte
  // of that into IndexedDB on one confirm click.
  const b64 = 'A'.repeat(1_000_000);
  const defs = `<defs><pattern id="p" width="10" height="10"><image href="data:image/png;base64,${b64}" width="10" height="10"/></pattern></defs>`;
  const gs: string[] = [];
  for (let i = 0; i < 24; i++) gs.push(`<g><rect x="${i * 4}" width="3" height="3" fill="url(#p)"/></g>`);
  const r = enumerateSvgLayers(doc(defs + gs.join('')));
  const total = r.layers.reduce((a, l) => a + l.markup.length, 0);
  assert.ok(total > SVG_LAYERS_HEAVY_BYTES, `${total} bytes should trip the threshold`);
  assert.ok(r.warnings.some((w) => w.includes('MB from a')), r.warnings.join(' | '));
});

test('an ordinary lift is NOT accused of being heavy', () => {
  const body = '<g><rect width="5" height="5"/></g><g><rect x="60" width="5" height="5"/></g>';
  const r = enumerateSvgLayers(doc(body));
  assert.deepEqual(r.warnings, []);
});

test('an oversized document is refused with words, not an exception', () => {
  const huge = doc(`<g><rect width="1" height="1"/></g>${' '.repeat(SVG_LAYERS_MAX_CHARS)}`);
  const r = enumerateSvgLayers(huge);
  assert.deepEqual(r.layers, []);
  assert.ok(r.warnings[0]!.includes('too large'), r.warnings.join(' | '));
});

test('a document with too many tags is refused, not walked', () => {
  const parts: string[] = [];
  for (let i = 0; i < SVG_LAYERS_MAX_TAGS + 10; i++) parts.push('<rect width="1" height="1"/>');
  const r = enumerateSvgLayers(doc(parts.join('')));
  assert.deepEqual(r.layers, []);
  assert.ok(r.warnings[0]!.includes('tags'), r.warnings.join(' | '));
  // The refusal must name what is actually counted. `scanTags` emits one entry per
  // OPEN tag and one per CLOSE tag, so a wall of `<g>…</g>` hits the cap at half the
  // element count the old wording ("more than 40 000 elements") promised.
  assert.ok(!/\belements\b/.test(r.warnings[0]!), r.warnings[0]!);
  const pairs: string[] = [];
  for (let i = 0; i < SVG_LAYERS_MAX_TAGS / 2 + 10; i++) pairs.push('<g></g>');
  const paired = enumerateSvgLayers(doc(pairs.join('')));
  assert.deepEqual(paired.layers, [], 'open+close is two tags, so ~20 000 <g></g> pairs already refuse');
  assert.ok(paired.warnings[0]!.includes('tags'), paired.warnings.join(' | '));
});

test('junk in, warnings out - never a throw', () => {
  const junk = [
    '', 'not markup at all', '<svg', '<svg></svg>', '<svg/>',
    '<svg xmlns="' + NS + '"><g><rect width="1" height="1"/></svg>',   // unclosed <g>
    '<svg xmlns="' + NS + '"></g><g><rect/></g></svg>',                 // stray close
    doc('<g><rect width="1" height="1"/></g>'.repeat(1) + '<'),
    doc('<rect d="a>b" width="1" height="1"/><rect x="3" width="1" height="1"/>'),
    doc('<path d="M0 0 C" width="1"/>'),
    doc('<g transform="translate(nonsense)"><rect width="1" height="1"/><rect x="9" width="1" height="1"/></g>'),
    '<html><body>hi</body></html>',
  ];
  for (const s of junk) {
    const r = enumerateSvgLayers(s);
    assert.ok(Array.isArray(r.layers) && Array.isArray(r.warnings), s.slice(0, 40));
    for (const l of r.layers) assert.ok(l.markup.startsWith('<svg'), l.markup.slice(0, 60));
  }
});

test('a root that draws nothing says so', () => {
  const r = enumerateSvgLayers(doc('<defs><linearGradient id="g"/></defs>'));
  assert.deepEqual(r.layers, []);
  assert.ok(r.warnings[0]!.includes('nothing to lift'), r.warnings.join(' | '));
});

test('a <script> never reaches a derived layer, even if one got this far', () => {
  const r = enumerateSvgLayers(doc('<script>alert(1)</script><g><rect width="5" height="5"/></g><g><rect x="60" width="5" height="5"/></g>'));
  assert.equal(r.layers.length, 2);
  for (const l of r.layers) assert.ok(!/<script/i.test(l.markup), l.markup);
});

test('a NESTED <script> is dropped too - a layer body is a slice, and the slice has holes', () => {
  // This test used to place the <script> at the root ONLY, which is where the
  // enumerator's filter looked, so it read as a stronger guarantee than the code
  // gave: a layer body is a verbatim slice, and anything nested inside one rode
  // through whole.
  const r = enumerateSvgLayers(doc(
    '<g><rect width="5" height="5"/><script>alert(1)</script></g><g><rect x="60" width="5" height="5"/></g>',
  ));
  assert.equal(r.layers.length, 2);
  for (const l of r.layers) assert.ok(!/<script/i.test(l.markup), l.markup);
  assertPartition(r.layers, '<g><rect width="5" height="5"/></g><g><rect x="60" width="5" height="5"/></g>');
});

test('a NESTED <title>/<desc> is dropped too - that is where a name actually hides', () => {
  const r = enumerateSvgLayers(doc(
    '<g><title>Andy Fitzsimon draft</title><desc>internal only</desc><rect width="5" height="5"/></g>'
    + '<g><metadata>x</metadata><rect x="60" width="5" height="5"/></g>',
  ));
  assert.equal(r.layers.length, 2);
  for (const l of r.layers) {
    assert.ok(!/<title|<desc|<metadata/i.test(l.markup), l.markup);
    assert.ok(!/Andy|internal only/.test(l.markup), l.markup);
  }
});

test('a nested drop inside a CARRIED node goes too - the prologue is a slice as well', () => {
  const r = enumerateSvgLayers(doc(
    '<defs><linearGradient id="g1"><title>secret</title><stop offset="0"/></linearGradient></defs>'
    + '<g><rect width="5" height="5" fill="url(#g1)"/></g><g><rect x="60" width="5" height="5"/></g>',
  ));
  assert.equal(r.layers.length, 2);
  for (const l of r.layers) {
    assert.ok(l.markup.includes('id="g1"'), 'the gradient itself still rides along');
    assert.ok(!/secret/.test(l.markup), l.markup);
  }
});

test('the reference-repair cap bounds the work a hostile document can ask for', () => {
  // One layer referencing far more ids than the cap allows.
  const defs: string[] = [];
  const uses: string[] = [];
  for (let i = 0; i < SVG_LAYERS_MAX_REFS * 3; i++) {
    defs.push(`<path id="r${i}" d="M0 0 L1 1"/>`);
    uses.push(`<use href="#r${i}"/>`);
  }
  const r = enumerateSvgLayers(doc(`<g id="src">${defs.join('')}</g><g id="dst">${uses.join('')}</g>`));
  assert.equal(r.layers.length, 2);
  const copies = (r.layers[1]!.markup.match(/<path id="r/g) ?? []).length;
  assert.ok(copies <= SVG_LAYERS_MAX_REFS, `${copies} copies exceeds the cap`);
});

// ─── bounds ─────────────────────────────────────────────────────────────────

test('analytic bounds cover every primitive we claim to measure', () => {
  const cases: Array<[string, { x: number; y: number; w: number; h: number }]> = [
    ['<rect x="1" y="2" width="3" height="4"/>', { x: 1, y: 2, w: 3, h: 4 }],
    ['<circle cx="10" cy="10" r="2"/>', { x: 8, y: 8, w: 4, h: 4 }],
    ['<ellipse cx="10" cy="10" rx="3" ry="1"/>', { x: 7, y: 9, w: 6, h: 2 }],
    ['<line x1="1" y1="1" x2="5" y2="9"/>', { x: 1, y: 1, w: 4, h: 8 }],
    ['<polygon points="0,0 4,0 4,6"/>', { x: 0, y: 0, w: 4, h: 6 }],
    ['<path d="M0 0 L10 0 L10 5 Z"/>', { x: 0, y: 0, w: 10, h: 5 }],
    ['<image x="2" y="3" width="8" height="9" href="a.png"/>', { x: 2, y: 3, w: 8, h: 9 }],
  ];
  for (const [markup, want] of cases) {
    // A far-away second node keeps them from clustering into one layer.
    const r = enumerateSvgLayers(doc(`${markup}<rect x="900" y="900" width="1" height="1"/>`, ' viewBox="0 0 1000 1000"'));
    assert.deepEqual(r.layers[0]!.bbox, want, markup);
  }
});

test('a group containing anything unmeasurable is unmeasurable - never a partial extent', () => {
  const r = enumerateSvgLayers(doc('<g><rect width="5" height="5"/><text x="0" y="0">t</text></g><g><rect x="60" width="5" height="5"/></g>'));
  assert.equal(r.layers[0]!.bbox, null, 'the <text> makes the whole group unmeasurable');
  assert.deepEqual(r.layers[1]!.bbox, { x: 60, y: 0, w: 5, h: 5 });
});

test('a rotate() transform is measured, not refused', () => {
  const r = enumerateSvgLayers(doc('<g transform="rotate(90 0 0)"><rect width="4" height="2"/><rect x="40" width="4" height="2"/></g>'));
  const b = r.layers[0]!.bbox!;
  assert.ok(Math.abs(b.x - -2) < 1e-9 && Math.abs(b.y - 0) < 1e-9, JSON.stringify(b));
  assert.ok(Math.abs(b.w - 2) < 1e-9 && Math.abs(b.h - 4) < 1e-9, JSON.stringify(b));
});

// ─── determinism ────────────────────────────────────────────────────────────

test('the same bytes in give the same layers out, every time', () => {
  const src = doc(
    '<defs><linearGradient id="g"><stop offset="0"/></linearGradient></defs>' +
    '<g id="a"><path d="M0 0 C1 1 2 2 3 3"/></g>' +
    '<rect x="40" width="5" height="5"/><rect x="43" width="5" height="5"/>' +
    '<g id="b"><use href="#g"/></g>',
  );
  const a = enumerateSvgLayers(src);
  const b = enumerateSvgLayers(src);
  assert.deepEqual(a, b);
});

test('a wrapper we DID NOT descend into does not have its own defs hoisted out', () => {
  // The descent stages the wrapper's non-rendering children and only commits
  // them when it actually descends. Without that, this document - whose wrapper
  // holds nothing but a <defs> - would emit that defs twice, once carried and
  // once inside the wrapper's own markup, and every id in it would be duplicated.
  const r = enumerateSvgLayers(doc('<g id="w"><defs><linearGradient id="only"/></defs></g>'));
  assert.equal(r.layers.length, 1);
  assert.equal((r.layers[0]!.markup.match(/id="only"/g) ?? []).length, 1, r.layers[0]!.markup);
});
