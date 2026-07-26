// SPDX-License-Identifier: MPL-2.0
/**
 * PDF graphics-state INHERITANCE across a form XObject, and the paint sites that
 * depended on it — engine/src/pdf-map.ts.
 *
 * PDF 32000-1 §8.10.1: "the form XObject's content stream shall be executed with the
 * current graphics state". The interpreter used to seed every `Do` with a FRESH state,
 * passing through only the CTM and the clip, so `q /GS0 gs /Fm0 Do Q` — the canonical
 * Illustrator/InDesign soft-mask idiom — painted the form's contents at full opacity,
 * unmasked, and did not even warn. The same page printed by Chromium never exercises
 * this (it does not wrap masked paint in forms), so the audit fixtures cannot see it;
 * these synthetic streams are the evidence.
 *
 * Also covered here: the fill/stroke independence of `B` under a mask, text alpha and
 * text masking, and the deferred stroke-pattern warning.
 *
 * Run with: node --test tests/pdf-form-gstate.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { interpretPdfPage } from '../engine/src/pdf-map.ts';
import type { PdfNode, PdfPageInput, PdfSoftMaskDef } from '../engine/src/pdf-map.ts';
import { pdfNodesToSvg } from '../engine/src/pdf-svg.ts';
import { isShadowPlate } from '../engine/src/pdf-smask.ts';

const pageW = (content: string, extra: Partial<PdfPageInput> = {}): { nodes: any[]; warns: string[] } => {
  const warns: string[] = [];
  const nodes = interpretPdfPage({
    content, width: 400, height: 300,
    onWarn: (code, detail) => warns.push(detail ? `${code}|${detail}` : code),
    ...extra,
  });
  return { nodes: nodes as any[], warns };
};

/** A mask group that folds to a CONSTANT: one flat 50% grey rect over its own bbox. */
const HALF: PdfSoftMaskDef = {
  id: 'smHalf', subtype: 'Luminosity',
  content: '0.5 g 0 0 200 200 re f', resources: {}, bbox: [0, 0, 200, 200],
};
/** A mask group that is a real SHAPE (two rects → not constant-foldable), so it has
 *  to survive as an actual `<mask>` on the node. */
const SHAPE: PdfSoftMaskDef = {
  id: 'smShape', subtype: 'Luminosity',
  content: '1 g 0 0 100 200 re f 0 g 100 0 100 200 re f', resources: {}, bbox: [0, 0, 200, 200],
};
/** A mask the shell could not pre-decode at all (`smask: true`) — the last-resort rung. */
const OPAQUE = true as const;

const form = (content: string, extra: Record<string, unknown> = {}) =>
  ({ kind: 'form' as const, content, ...extra });

// ── D1: the root defect ───────────────────────────────────────────────────────

test('a form XObject inherits the soft mask in force (§8.10.1)', () => {
  // `q /GS0 gs /Fm0 Do Q` — Illustrator/InDesign's soft-mask idiom.
  const { nodes, warns } = pageW('q /GS0 gs /Fm0 Do Q', {
    extgstates: { GS0: { smask: SHAPE } },
    xobjects: { Fm0: form('0.8 0.8 0.8 rg 0 0 200 200 re f') },
  });
  assert.equal(nodes.length, 1);
  assert.ok(nodes[0]._softMask, `the form lost the mask entirely: ${JSON.stringify(nodes[0])}`);
  assert.equal(nodes[0]._softMask.subtype, 'Luminosity');
  assert.equal(nodes[0]._softMask.nodes.length, 2);
  assert.ok(warns.includes('smask.group.applied|smShape'), warns.join(','));
});

test('a form XObject inherits a mask that folds to a constant', () => {
  const { nodes } = pageW('q /GS0 gs /Fm0 Do Q', {
    extgstates: { GS0: { smask: HALF } },
    xobjects: { Fm0: form('0.8 0.8 0.8 rg 0 0 200 200 re f') },
  });
  assert.equal(nodes.length, 1);
  assert.equal(nodes[0].opacity, 50, 'the 50% grey mask must fold into the form fill’s alpha');
});

test('a form XObject inherits fill alpha, stroke colour and line width', () => {
  const { nodes } = pageW('/GA gs 1 0 0 RG 8 w /Fm0 Do', {
    extgstates: { GA: { ca: 0.4, CA: 0.4 } },
    // The form sets NO colour/width of its own: everything must come from the caller.
    xobjects: { Fm0: form('0 0 1 rg 10 10 50 50 re f  20 100 m 120 100 l S') },
  });
  assert.equal(nodes.length, 2);
  assert.equal(nodes[0].opacity, 40, 'fill alpha (/ca) crossed the Do');
  assert.equal(nodes[1]._vectorStroke.color, '#ff0000', 'stroke colour crossed the Do');
  assert.ok(Math.abs(nodes[1]._vectorStroke.width - 8) < 0.01, `line width crossed the Do: ${nodes[1]._vectorStroke.width}`);
  assert.equal(nodes[1].opacity, 40, 'stroke alpha (/CA) crossed the Do');
});

test('a form XObject cannot leak its graphics state back to the caller', () => {
  // §8.10.1 again: `Do` is state-neutral for the caller. The form paints red at 20%;
  // the rect after it must still be the caller's blue at full strength.
  const { nodes } = pageW('0 0 1 rg /Fm0 Do 10 10 50 50 re f', {
    // A form resolves resource NAMES against its OWN /Resources, so /GR lives there.
    xobjects: { Fm0: form('/GR gs 1 0 0 rg 100 100 20 20 re f', { resources: { extgstates: { GR: { ca: 0.2 } } } }) },
  });
  assert.equal(nodes.length, 2);
  assert.equal(nodes[0].fill, '#ff0000');
  assert.equal(nodes[0].opacity, 20);
  assert.equal(nodes[1].fill, '#0000ff', 'the form’s fill colour leaked out');
  assert.equal(nodes[1].opacity, 100, 'the form’s /ca leaked out');
});

test('an unevaluable mask still reaches a nested form’s shadow-plate rung', () => {
  // `smask: true` = a mask is in force but its group could not be decoded. The form's
  // translucent achromatic fill is a print engine's shadow plate; before inheritance
  // it painted as an opaque grey plate with no warning at all.
  const { nodes, warns } = pageW('q /GS0 gs /Fm0 Do Q', {
    extgstates: { GS0: { smask: OPAQUE, ca: 0.5 } },
    xobjects: { Fm0: form('0.8 0.8 0.8 rg 0 0 200 200 re f') },
  });
  assert.deepEqual(nodes, []);
  assert.ok(warns.includes('smask.shadow.skipped'), warns.join(','));
});

test('nested forms inherit transitively, and the clip still composes', () => {
  const { nodes } = pageW('q 0 0 200 200 re W n /GA gs /Fm0 Do Q', {
    extgstates: { GA: { ca: 0.5 } },
    xobjects: {
      // Fm1 is named from inside Fm0, so it must live in Fm0's own /Resources.
      Fm0: form('/Fm1 Do', { resources: { xobjects: { Fm1: form('0 0 1 rg 10 10 50 50 re f') } } }),
    },
  });
  assert.equal(nodes.length, 1);
  assert.equal(nodes[0].opacity, 50);
  assert.equal(nodes[0]._clips.length, 1);
});

// ── D2 / D3: text alpha and text masking ─────────────────────────────────────

test('text records the fill alpha in force at its origin', () => {
  const { nodes } = pageW('/GA gs 0 0 0 rg BT /F1 12 Tf 20 200 Td (muted label) Tj ET', {
    extgstates: { GA: { ca: 0.45 } },
  });
  assert.equal(nodes.length, 1);
  assert.equal(nodes[0].kind, 'text');
  assert.equal(nodes[0].opacity, 45, 'every muted label imported at full strength');
});

test('text under a soft mask carries the mask', () => {
  const { nodes, warns } = pageW('/GS0 gs 0 0 0 rg BT /F1 12 Tf 20 200 Td (masked type) Tj ET', {
    extgstates: { GS0: { smask: SHAPE } },
  });
  assert.equal(nodes.length, 1);
  assert.ok(nodes[0]._softMask, 'text painted unmasked, silently');
  assert.ok(warns.includes('smask.group.applied|smShape'), warns.join(','));
});

test('text under a mask group that paints nothing is fully masked out', () => {
  // §11.6.5.2: an empty group's luminosity is the backdrop = black = 0.
  // The group has content but paints nothing (`n` discards the path). An EMPTY
  // content string is a different case: the shell could not decode it, which is the
  // fallback rung, not a black backdrop.
  const EMPTY: PdfSoftMaskDef = { id: 'smEmpty', subtype: 'Luminosity', content: '0 0 200 200 re n', resources: {}, bbox: [0, 0, 200, 200] };
  const { nodes } = pageW('/GS0 gs 0 0 0 rg BT /F1 12 Tf 20 200 Td (invisible) Tj ET', {
    extgstates: { GS0: { smask: EMPTY } },
  });
  assert.deepEqual(nodes, []);
});

test('an unevaluable mask never drops TEXT (only shadow plates)', () => {
  // The shadow-plate rung is for fills, not for type: a grey translucent label must
  // survive a mask we cannot read, or the page loses its words.
  const { nodes } = pageW('/GS0 gs 0.5 0.5 0.5 rg BT /F1 12 Tf 20 200 Td (still here) Tj ET', {
    extgstates: { GS0: { smask: OPAQUE, ca: 0.5 } },
  });
  assert.equal(nodes.length, 1);
  assert.equal(nodes[0].text, 'still here');
});

test('text alpha inside a form XObject crosses the Do too', () => {
  const { nodes } = pageW('/GA gs /Fm0 Do', {
    extgstates: { GA: { ca: 0.25 } },
    xobjects: { Fm0: form('0 0 0 rg BT /F1 12 Tf 20 200 Td (in a form) Tj ET') },
  });
  assert.equal(nodes.length, 1);
  assert.equal(nodes[0].opacity, 25);
});

// ── D5: `B` must ask the mask about fill and stroke separately ────────────────

test('an unevaluable mask over a shadow-plate fill keeps the OPAQUE stroke', () => {
  const { nodes } = pageW('/GA gs /GS0 gs 0.9 0.9 0.9 rg 1 0 0 RG 0 0 100 100 re B', {
    extgstates: { GA: { ca: 0.5 }, GS0: { smask: OPAQUE } },
  });
  assert.equal(nodes.length, 1, 'the whole paint was discarded, stroke included');
  assert.equal(nodes[0]._vectorFill, 'none', 'the shadow-plate fill is still dropped');
  assert.equal(nodes[0]._vectorStroke.color, '#ff0000');
  assert.equal(nodes[0].opacity, 100, 'the stroke keeps its own (opaque) alpha');
});

test('`B` with both paints surviving still reports the fill’s alpha', () => {
  const { nodes } = pageW('0 0 1 rg 1 0 0 RG /GA gs 10 10 50 50 re B', {
    extgstates: { GA: { ca: 0.5, CA: 0.25 } },
  });
  assert.equal(nodes.length, 1);
  assert.equal(nodes[0].opacity, 50);
});

// ── the benign stroke-pattern warning ────────────────────────────────────────

test('selecting an unreproducible stroke pattern and never stroking does not warn', () => {
  // Chromium sets stroke AND fill to the same pattern in one breath, then only fills
  // — 80 such `/Pn SCN` occurrences across the audit fixtures, ZERO of them followed
  // by a stroke paint op, yet `pattern.unsupported` fired 78 times and buried the
  // real signal in the census. `PS` has no flat back-stop, so the OLD code warned.
  const { nodes, warns } = pageW('/PS SCN /P1 scn 10 10 50 50 re f', {
    patterns: { PS: {}, P1: { flat: '#336699' } },
  });
  assert.equal(nodes.length, 1);
  assert.equal(nodes[0].fill, '#336699');
  assert.deepEqual(warns, [], `benign selection warned: ${warns.join(',')}`);
});

test('a fill-side pattern with nothing usable is STILL reported at selection', () => {
  // Only the STROKE branch is deferred: a fill that names an unusable pattern loses
  // its paint there and then, so its report must not move.
  const { warns } = pageW('/PX scn 10 10 50 50 re f', { patterns: { PX: {} } });
  assert.deepEqual(warns, ['pattern.unsupported|PX']);
});

test('an unreproducible stroke pattern that ACTUALLY strokes is still reported', () => {
  const { warns } = pageW('/PX SCN 2 w 10 10 m 100 10 l S', { patterns: { PX: {} } });
  assert.deepEqual(warns, ['pattern.unsupported|PX']);
});

test('a later real stroke colour cancels the pending stroke-pattern report', () => {
  const { warns } = pageW('/PX SCN 1 0 0 RG 2 w 10 10 m 100 10 l S', { patterns: { PX: {} } });
  assert.deepEqual(warns, []);
});

test('the pending stroke-pattern report is graphics-state, restored by Q', () => {
  // Selected inside q…Q, so after Q there is no pattern selected and no report.
  const { warns } = pageW('q /PX SCN Q 1 0 0 RG 2 w 10 10 m 100 10 l S', { patterns: { PX: {} } });
  assert.deepEqual(warns, []);
});

// ── D6: the mask budget cliff is announced ───────────────────────────────────

test('exhausting the soft-mask budget is announced once, with its own code', () => {
  // 300 DISTINCT mask groups (distinct ids ⇒ distinct memo keys) on one page — past
  // the 256-evaluation budget. Every refusal past the cliff still falls back to the
  // pre-mask behaviour, but the census now says the cliff was reached.
  const extgstates: Record<string, { smask: PdfSoftMaskDef }> = {};
  let content = '';
  for (let i = 0; i < 300; i++) {
    extgstates['G' + i] = {
      smask: { id: 'm' + i, subtype: 'Luminosity', content: '1 g 0 0 100 200 re f 0 g 100 0 100 200 re f', resources: {}, bbox: [0, 0, 200, 200] },
    };
    content += `q /G${i} gs 0 0 1 rg 10 10 20 20 re f Q `;
  }
  const { nodes, warns } = pageW(content, { extgstates });
  assert.equal(nodes.length, 300, 'every paint must still land, masked or not');
  assert.equal(warns.filter((w) => w === 'smask.budget.exhausted').length, 1);
  const applied = warns.filter((w) => w.startsWith('smask.group.applied')).length;
  assert.equal(applied, 256, `evaluated ${applied} masks before the cliff`);
});

// ── D3, serializer half: text was the one element builder without opacity ─────

test('pdf-svg emits opacity on <text> and on outlined glyph paths', () => {
  const base: PdfNode = {
    kind: 'text', x: 10, y: 20, w: 100, h: 16, rot: 0,
    fg: '#333333', fontSize: 12, text: 'muted', opacity: 45,
  };
  const svg = pdfNodesToSvg([base], { width: 200, height: 100 });
  assert.match(svg, /<text[^>]*opacity="0\.45"/, svg);

  // The outlined rung is the SAME run — the two presentations must agree.
  const outlined: PdfNode = { ...base, _outlinePath: ['M0 0L10 0L10 -10Z'] };
  const svg2 = pdfNodesToSvg([outlined], { width: 200, height: 100 });
  assert.match(svg2, /<path d="M0 0L10 0L10 -10Z" fill="#333333" opacity="0\.45"\/>/, svg2);
});

test('an opaque text node still emits no opacity attribute', () => {
  const svg = pdfNodesToSvg([{
    kind: 'text', x: 10, y: 20, w: 100, h: 16, rot: 0, fg: '#000000', fontSize: 12, text: 'solid', opacity: 100,
  }], { width: 200, height: 100 });
  assert.doesNotMatch(svg, /opacity=/, svg);
});

// ── an end-to-end check on the whole path ────────────────────────────────────

test('page → SVG: a masked form and a muted label both survive to markup', () => {
  const nodes = interpretPdfPage({
    content: 'q /GS0 gs /Fm0 Do Q  /GA gs 0 0 0 rg BT /F1 12 Tf 20 200 Td (muted) Tj ET',
    width: 400, height: 300,
    extgstates: { GS0: { smask: SHAPE }, GA: { ca: 0.4 } },
    xobjects: { Fm0: form('0 0 1 rg 0 0 200 200 re f') },
  });
  const svg = pdfNodesToSvg(nodes, { width: 400, height: 300 });
  assert.match(svg, /<mask id="/, 'the form’s inherited soft mask never reached the SVG');
  assert.match(svg, /mask="url\(#/, svg.slice(0, 400));
  assert.match(svg, /<text[^>]*opacity="0\.4"/, 'the muted label rendered at full strength');
});

// ── the boxes path must not mistake masked TEXT for a shadow plate ────────────

test('isShadowPlate never claims a text node', () => {
  // The Layout Studio boxes path drops every node isShadowPlate() accepts. A text
  // node keeps its colour in `fg`, which the fill probe cannot see, so a masked
  // muted label looked exactly like a translucent achromatic plate — and vanished.
  const masked: PdfNode = {
    kind: 'text', x: 0, y: 0, w: 50, h: 16, rot: 0, fg: '#333333', fontSize: 12,
    text: 'muted', opacity: 45,
    _softMask: { key: 'k', nodes: [], x: 0, y: 0, w: 50, h: 16, subtype: 'Luminosity' },
  };
  assert.equal(isShadowPlate(masked), false);
  // …but a real plate (a translucent achromatic BOX under a mask) still is one.
  assert.equal(isShadowPlate({ ...masked, kind: 'box', fill: '#cccccc', text: undefined }), true);
});

// ── Untrusted input: bounded work ────────────────────────────────────────────
// This interpreter runs on a PDF a user uploaded, so "terminates" is not enough —
// it has to terminate FAST. Two vectors an adversarial review measured on the live
// tree, both from tiny content streams. Note the cycle has to be built as a real
// self-reference: a form executes with its OWN /Resources, so `/Fm0 Do` inside Fm0
// only recurses when Fm0's resources actually contain Fm0. (A fixture that skips
// that resolves nothing, runs in ~1ms, and tests precisely nothing — which is how
// the first version of these tests passed with the fix reverted.)
test('a self-referential form with fanout terminates quickly', () => {
  const self: Record<string, unknown> = { kind: 'form', content: '/Fm0 Do /Fm0 Do /Fm0 Do /Fm0 Do /Fm0 Do /Fm0 Do' };
  self.resources = { xobjects: { Fm0: self } };          // the cycle
  const t0 = Date.now();
  const { nodes } = pageW('/Fm0 Do', { xobjects: { Fm0: self } } as never);
  const ms = Date.now() - t0;
  assert.ok(ms < 2000, `fanout-6 self-reference took ${ms}ms — the work bound is not holding`);
  assert.ok(Array.isArray(nodes), 'should return normally, not throw');
});

test('a huge no-paint content stream is bounded by the token budget', () => {
  const t0 = Date.now();
  const { nodes } = pageW(`${'q Q '.repeat(200_000)}1 0 0 rg 0 0 10 10 re f`, {});
  const ms = Date.now() - t0;
  assert.ok(ms < 5000, `200k no-op ops took ${ms}ms — tokenisation is unbounded`);
  assert.ok(Array.isArray(nodes), 'should return normally, not throw');
});
