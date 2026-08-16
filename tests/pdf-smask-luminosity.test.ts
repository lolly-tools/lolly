// SPDX-License-Identifier: MPL-2.0
/**
 * Real /Luminosity soft-mask support, end to end: hand-written content streams →
 * interpretPdfPage (engine/src/pdf-map.ts) → pdfNodesToSvg (engine/src/pdf-svg.ts).
 *
 * WHY this suite exists. Chromium's printToPDF encodes a CSS `box-shadow` by filling
 * the element's whole rectangle with a flat translucent achromatic ink and letting an
 * ExtGState /SMask << /S /Luminosity /G … >> carve out the blur, the offset and the
 * rounded corners. Probing 136 masks across six real app pages, 94% of them are a
 * single blurred greyscale DCTDecode JPEG drawn on the group's own /BBox - i.e. ALL of
 * the shape information lives in the mask and the masked paint carries only colour.
 * Before this landed, the interpreter could not evaluate a mask group, so it dropped
 * every masked translucent achromatic fill (86× across the audit fixtures) and any
 * control whose box was drawn ONLY with box-shadow was invisible in the exported SVG.
 *
 * The fixtures below are Chromium's actual idiom, reduced to the smallest streams that
 * still exercise it. Every test in this file fails without the soft-mask path.
 *
 * Run with: node --test tests/pdf-smask-luminosity.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { interpretPdfPage } from '../engine/src/pdf-map.ts';
import type { PdfNode, PdfPageInput, PdfSoftMaskDef } from '../engine/src/pdf-map.ts';
import { pdfNodesToSvg } from '../engine/src/pdf-svg.ts';

const near = (a: number, b: number, eps = 0.6): boolean => Math.abs(a - b) <= eps;

/** Interpret a page, capturing the interpreter's (code, detail) warnings. */
function run(content: string, extra: Partial<PdfPageInput> = {}): { nodes: PdfNode[]; warns: string[] } {
  const warns: string[] = [];
  const nodes = interpretPdfPage({
    content, width: 400, height: 300,
    onWarn: (code, detail) => warns.push(detail ? `${code}|${detail}` : code),
    ...extra,
  });
  return { nodes, warns };
}

const svgOf = (nodes: PdfNode[], images: Record<string, string> = {}): string =>
  pdfNodesToSvg(nodes, { width: 400, height: 300, images });

// ── the money test: Chromium's box-shadow idiom ───────────────────────────────
//
// The page stream (verbatim shape, from probe/exportpanel-content.txt):
//   q  <page rect> re W n            ← the page clip
//      0 0 0 RG 0 0 0 rg
//      /G5 gs                        ← << /ca 0.2784 >>  the shadow colour's alpha
//      /G7 gs                        ← << /SMask << /S /Luminosity /G 6 0 R >> >>
//      112 115 651 276 re f          ← flat fill of the shadow's bbox
//   Q
// and the mask group's own stream is always, uniformly:
//   q  <unit image placed on the group /BBox> cm  /G3 gs  /X4 Do  Q

const SHADOW_MASK: PdfSoftMaskDef = {
  id: 'sm0',
  subtype: 'Luminosity',
  content: 'q 120 0 0 60 40 100 cm 0 0 0 RG 0 0 0 rg /X4 Do Q',
  resources: { xobjects: { X4: { kind: 'image', imageKey: 'm0' } } },
  bbox: [40, 100, 160, 160],
};

const SHADOW_PAGE = 'q 0 0 400 300 re W n 0 0 0 RG 0 0 0 rg /G5 gs /G7 gs 40 100 120 60 re f Q';
const SHADOW_GS = { G5: { ca: 0.2784 }, G7: { smask: SHADOW_MASK } };

test('box-shadow: the masked fill is PAINTED, carrying the mask group as _softMask', () => {
  const { nodes, warns } = run(SHADOW_PAGE, { extgstates: SHADOW_GS });

  // Before soft-mask support this was ZERO nodes: translucent + achromatic under a
  // mask was dropped outright, so the control's box vanished.
  assert.equal(nodes.length, 1);
  const n = nodes[0]!;
  assert.equal(n.kind, 'box');
  assert.equal(n.shape, 'rect');
  assert.ok(near(n.x, 40) && near(n.y, 140), `xy ${n.x},${n.y}`);
  assert.ok(near(n.w, 120) && near(n.h, 60), `wh ${n.w},${n.h}`);
  // /ca survives untouched - the mask supplies shape, the ExtGState supplies alpha.
  assert.equal(n.opacity, 28);
  // The page clip is still on the node.
  assert.ok(n._clips?.length, 'page clip preserved');

  const m = n._softMask;
  assert.ok(m, 'the soft mask reached the node');
  assert.equal(m.subtype, 'Luminosity');
  // The mask region is the group /BBox in box space - the same rect the fill covers.
  assert.ok(near(m.x, 40) && near(m.y, 140) && near(m.w, 120) && near(m.h, 60), JSON.stringify(m));
  // The mask's content was re-run through this same interpreter: its raster is an
  // ordinary image node the shell resolves through the usual `images` record.
  assert.equal(m.nodes.length, 1);
  assert.equal(m.nodes[0]!._imageXObject, 'm0');

  assert.ok(warns.includes('smask.group.applied|sm0'), warns.join(','));
  assert.ok(!warns.some((w) => w.startsWith('smask.shadow.skipped')), warns.join(','));
});

test('box-shadow: pdfNodesToSvg emits a real <mask> and wraps the paint in it', () => {
  const { nodes } = run(SHADOW_PAGE, { extgstates: SHADOW_GS });
  const svg = svgOf(nodes, { m0: 'data:image/jpeg;base64,AAA' });

  assert.match(svg, /<mask id="pmask0" maskUnits="userSpaceOnUse" x="40" y="140" width="120" height="60" style="color-interpolation:sRGB">/);
  // The blur raster lives INSIDE the mask.
  const mask = /<mask id="pmask0"[^>]*>([\s\S]*?)<\/mask>/.exec(svg);
  assert.ok(mask, 'mask body');
  assert.match(mask[1]!, /<image[^>]+href="data:image\/jpeg;base64,AAA"/);
  // …and the painted rect is wrapped in it.
  assert.match(svg, /<g mask="url\(#pmask0\)">.*<rect [^>]*opacity="0\.28"/);
  // No mask-type on a /Luminosity mask (SVG's default IS luminance).
  assert.ok(!svg.includes('mask-type'), 'no mask-type for Luminosity');
});

test('box-shadow: one <mask> def serves every node that shares the mask', () => {
  // Two shadowed controls, same group, same CTM - Chromium names the same ExtGState
  // dozens of times on a real page.
  const { nodes } = run(
    'q 0 0 400 300 re W n 0 0 0 rg /G5 gs /G7 gs 40 100 120 60 re f Q'
    + ' q 0 0 400 300 re W n 0 0 0 rg /G5 gs /G7 gs 40 100 120 60 re f Q',
    { extgstates: SHADOW_GS },
  );
  assert.equal(nodes.length, 2);
  // The interpreter memoises: literally the same object, so the serializer's dedup is
  // a key lookup and the per-node cost is one pointer.
  assert.equal(nodes[0]!._softMask, nodes[1]!._softMask);

  const svg = svgOf(nodes, { m0: 'data:image/jpeg;base64,AAA' });
  assert.equal((svg.match(/<mask id=/g) || []).length, 1);
  assert.equal((svg.match(/<g mask="url\(#pmask0\)">/g) || []).length, 2);
  // The base64 payload appears exactly once - in the <defs>.
  assert.equal((svg.match(/base64,AAA/g) || []).length, 1);
});

// ── the gradient rung: CSS mask-image: linear-gradient() ──────────────────────

const AXIAL = {
  type: 2 as const,
  coords: [0, 0, 100, 0],
  stops: [{ offset: 0, color: '#000000' }, { offset: 1, color: '#ffffff' }],
  extend: [true, true] as [boolean, boolean],
  flat: '#808080',
};

test('gradient mask: a shading inside the group renders as a gradient in the <mask>', () => {
  const def: PdfSoftMaskDef = {
    id: 'smg',
    subtype: 'Luminosity',
    content: '/Pattern cs /P6 scn 0 0 100 100 re f*',
    resources: { patterns: { P6: { shading: AXIAL, flat: '#808080' } } },
    bbox: [0, 0, 100, 100],
  };
  const { nodes, warns } = run('q 0 0 400 300 re W n 1 0 0 rg /G7 gs 0 0 100 100 re f Q', {
    extgstates: { G7: { smask: def } },
  });
  assert.equal(nodes.length, 1);
  const m = nodes[0]!._softMask;
  assert.ok(m, 'gradient mask applied');
  assert.equal(m.nodes.length, 1);
  assert.ok(m.nodes[0]!._gradient, 'the mask child carries the gradient');
  assert.ok(warns.includes('smask.group.applied|smg'), warns.join(','));

  const svg = svgOf(nodes);
  assert.match(svg, /<linearGradient id="pgrad0"/);
  const mask = /<mask id="pmask0"[^>]*>([\s\S]*?)<\/mask>/.exec(svg);
  assert.ok(mask, 'mask body');
  assert.match(mask[1]!, /<rect [^>]*fill="url\(#pgrad0\)"/);
});

// ── the constant rung: a flat group is an opacity, not a shape ────────────────

test('constant mask: a flat rect over the bbox folds into the node’s alpha, no <mask>', () => {
  const def: PdfSoftMaskDef = {
    id: 'smc',
    subtype: 'Luminosity',
    content: '0.5 g 0 0 100 100 re f',
    resources: {},
    bbox: [0, 0, 100, 100],
  };
  const { nodes, warns } = run('q 0 0 400 300 re W n 1 0 0 rg /G7 gs 0 0 100 100 re f Q', {
    extgstates: { G7: { smask: def } },
  });
  assert.equal(nodes.length, 1);
  assert.equal(nodes[0]!._softMask, undefined);
  // sRGB luminance of #808080 = 128/255 = 0.502 → 50%.
  assert.equal(nodes[0]!.opacity, 50);
  assert.ok(warns.includes('smask.group.folded|smc'), warns.join(','));
  const svg = svgOf(nodes);
  assert.ok(!svg.includes('<mask'), 'no mask def for a folded constant');
  assert.match(svg, /opacity="0\.5"/);
});

test('empty mask group → the paint is dropped (luminosity is the black backdrop)', () => {
  const def: PdfSoftMaskDef = { id: 'sme', subtype: 'Luminosity', content: '0 0 100 100 re n', resources: {}, bbox: [0, 0, 100, 100] };
  const { nodes, warns } = run('q 0 0 400 300 re W n 1 0 0 rg /G7 gs 0 0 100 100 re f Q', {
    extgstates: { G7: { smask: def } },
  });
  assert.equal(nodes.length, 0);
  assert.ok(warns.includes('smask.group.empty|sme'), warns.join(','));
});

// ── a masked tiling pattern: a CSS gradient that carries alpha ────────────────

test('a tiling pattern whose tile installs an evaluable mask now COLLAPSES with the mask', () => {
  // Chromium's encoding for "a gradient with transparency": a one-cell tiling pattern
  // whose body installs a /Luminosity mask (the alpha ramp) and fills with a shading
  // (the colour ramp). This used to warn pattern.smasked.skipped and lose the fill - 
  // it was the single most expensive defect on the brand-studio fixture (the whole
  // ambient page wash behind the studio was missing).
  const alphaRamp: PdfSoftMaskDef = {
    id: 'smt', subtype: 'Luminosity',
    content: '0.75 g 0 0 100 100 re f',   // a constant here keeps the assertion simple
    resources: {}, bbox: [0, 0, 100, 100],
  };
  const { nodes, warns } = run('q 0 0 400 300 re W n /Pattern cs /P1 scn 0 0 100 100 re f Q', {
    patterns: {
      P1: {
        flat: '#808080',
        tiling: {
          content: '/G8 gs /Pattern cs /P2 scn 0 0 100 100 re f*',
          resources: { extgstates: { G8: { smask: alphaRamp } }, patterns: { P2: { shading: AXIAL, flat: '#808080' } } },
          bbox: [0, 0, 100, 100], xStep: 100, yStep: 100, paintType: 1,
        },
      },
    },
  });
  assert.ok(!warns.some((w) => w.startsWith('pattern.smasked.skipped')), warns.join(','));
  assert.equal(nodes.length, 1);
  assert.ok(nodes[0]!._gradient, 'the colour ramp survived the collapse');
  // 0.75 grey → 0.7451 luminance, folded into the node's alpha.
  assert.equal(nodes[0]!.opacity, 75);
});

test('a tiling pattern whose tile installs an UNEVALUABLE mask still declines', () => {
  const { nodes, warns } = run('q 0 0 400 300 re W n /Pattern cs /P1 scn 0 0 100 100 re f Q', {
    patterns: {
      P1: {
        flat: '#808080',
        tiling: {
          content: '/G8 gs 0.1 0.1 0.1 rg 0 0 100 100 re f',
          // `true` = a mask is in force but the shell could not decode its group.
          resources: { extgstates: { G8: { smask: true } } },
          bbox: [0, 0, 100, 100], xStep: 100, yStep: 100, paintType: 1,
        },
      },
    },
  });
  assert.ok(warns.includes('pattern.smasked.skipped|P1'), warns.join(','));
  // The paint is cleared, so the selecting path yields a fill:none node that
  // serializes to nothing - byte-identical to the behaviour before mask groups could
  // be read, which is the whole point of the bottom rung.
  assert.ok(nodes.every((n) => !n.fill && (!n._vectorFill || n._vectorFill === 'none')), JSON.stringify(nodes));
  const svg = svgOf(nodes);
  assert.ok(!/<rect|<path|<image/.test(svg), svg);
});

// ── the ladder's bottom rung is byte-identical to the old behaviour ───────────

test('ladder: an unevaluable mask keeps the shadow-plate heuristic exactly as before', () => {
  const cases: Array<[string, Partial<PdfSoftMaskDef> | true, string | null]> = [
    ['legacy true', true, null],
    ['transfer', { transfer: true }, 'smask.group.unevaluated|transfer'],
    ['backdrop', { backdrop: 0.5 }, 'smask.group.unevaluated|bc'],
    ['no bbox', { bbox: undefined }, 'smask.group.unevaluated|bbox'],
    ['no content', { content: '' }, 'smask.group.unevaluated|content'],
  ];
  for (const [label, patch, expectWarn] of cases) {
    const smask = patch === true ? true : { ...SHADOW_MASK, ...patch };
    const { nodes, warns } = run(SHADOW_PAGE, { extgstates: { G5: { ca: 0.2784 }, G7: { smask } } });
    // The plate is dropped, exactly as it was before mask groups could be read.
    assert.equal(nodes.length, 0, label);
    assert.ok(warns.includes('smask.shadow.skipped'), `${label}: ${warns.join(',')}`);
    if (expectWarn) assert.ok(warns.includes(expectWarn), `${label}: ${warns.join(',')}`);
  }
});

test('ladder: an unevaluable mask over an OPAQUE or CHROMATIC fill still paints, unmasked', () => {
  // The heuristic's two guards, unchanged: real content under a mask must survive a
  // refusal (the brand palette's swatch tiles are drawn exactly this way).
  for (const fill of ['0 0 0 rg', '0.19 0.73 0.47 rg']) {
    const alpha = fill === '0 0 0 rg' ? '' : '/G5 gs ';
    const { nodes } = run(`q 0 0 400 300 re W n ${fill} ${alpha}/G7 gs 40 100 120 60 re f Q`, {
      extgstates: { G5: { ca: 0.2784 }, G7: { smask: true } },
    });
    assert.equal(nodes.length, 1, fill);
    assert.equal(nodes[0]!._softMask, undefined);
  }
});

test('an /S /Alpha mask is emitted as mask-type="alpha", and says so', () => {
  const { nodes, warns } = run(SHADOW_PAGE, {
    extgstates: { G5: { ca: 0.2784 }, G7: { smask: { ...SHADOW_MASK, subtype: 'Alpha' } } },
  });
  assert.equal(nodes[0]?._softMask?.subtype, 'Alpha');
  assert.ok(warns.includes('smask.alpha.approx|sm0'), warns.join(','));
  assert.match(svgOf(nodes, { m0: 'data:image/jpeg;base64,AAA' }), /<mask id="pmask0"[^>]* mask-type="alpha"/);
});

// ── budgets + fuzz guards (every mask arrives from an untrusted file) ─────────

// The evaluation budget was raised from 96 to 256 (and backed by a total-mask-node
// ceiling) because "96 shadows per page" is a cliff an ordinary Illustrator page
// clears, and past it EVERY remaining mask silently degrades to the grey-plate
// heuristic. Exhaustion is now announced once with its own code as well.
test('budget: a page with 400 distinct masks evaluates at most 256 of them', () => {
  const extgstates: Record<string, { smask: PdfSoftMaskDef }> = {};
  let content = '';
  for (let i = 0; i < 400; i++) {
    extgstates[`G${i}`] = {
      smask: { id: `sm${i}`, subtype: 'Luminosity', content: `q 10 0 0 10 ${i} 10 cm /X4 Do Q`, resources: { xobjects: { X4: { kind: 'image', imageKey: `m${i}` } } }, bbox: [i, 10, i + 10, 20] },
    };
    // Opaque + chromatic, so the last-resort rung keeps them and only the mask differs.
    content += `q 0.19 0.73 0.47 rg /G${i} gs ${i} 10 10 10 re f Q `;
  }
  const { nodes, warns } = run(content, { extgstates });
  assert.equal(nodes.length, 400);
  const applied = nodes.filter((n) => n._softMask).length;
  assert.ok(applied > 0 && applied <= 256, `applied ${applied}`);
  assert.ok(warns.includes('smask.group.unevaluated|budget'), 'the page says it ran out');
  // Announced ONCE with its own code, so the cliff shows in the census instead of
  // hiding among the per-group refusals.
  assert.equal(warns.filter((w) => w === 'smask.budget.exhausted').length, 1);
  // One warn per refused mask at most - no warn storm.
  assert.ok(warns.filter((w) => w === 'smask.group.unevaluated|budget').length <= 400 - applied);
});

test('budget: many SMALL masks are bounded by total mask nodes, not just a count', () => {
  // 200 masks × 40 nodes each = 8000 mask nodes, past MASK_TOTAL_NODES (4000), so the
  // page stops well before the 256-evaluation count. The real cost is nodes
  // interpreted and emitted, so that is what bounds an untrusted page.
  const extgstates: Record<string, { smask: PdfSoftMaskDef }> = {};
  let content = '';
  let body = '';
  for (let k = 0; k < 40; k++) body += `${k % 2 ? '1' : '0.5'} g ${k} 10 5 5 re f `;
  for (let i = 0; i < 200; i++) {
    extgstates[`G${i}`] = { smask: { id: `smn${i}`, subtype: 'Luminosity', content: body, resources: {}, bbox: [0, 0, 100, 40] } };
    content += `q 0.19 0.73 0.47 rg /G${i} gs ${i} 10 10 10 re f Q `;
  }
  const { nodes, warns } = run(content, { extgstates });
  assert.equal(nodes.length, 200, 'every paint still lands');
  const applied = nodes.filter((n) => n._softMask).length;
  assert.ok(applied > 0 && applied < 200, `applied ${applied}`);
  assert.ok(applied * 40 <= 4000 + 40, `mask nodes spent ${applied * 40}`);
  assert.equal(warns.filter((w) => w === 'smask.budget.exhausted').length, 1);
});

test('fuzz: a self-referential mask group terminates and paints something bounded', () => {
  // The group's content installs the very ExtGState that names it. The memo cannot
  // catch this (the entry isn't written until the run returns) - the in-flight set and
  // the one-level nesting cap do.
  const def: PdfSoftMaskDef = {
    id: 'smself', subtype: 'Luminosity',
    content: '0.5 g /G7 gs 0 0 100 100 re f',
    resources: {}, bbox: [0, 0, 100, 100],
  };
  def.resources = { extgstates: { G7: { smask: def } } };
  const { nodes, warns } = run('q 0 0 400 300 re W n 1 0 0 rg /G7 gs 0 0 100 100 re f Q', {
    extgstates: { G7: { smask: def } },
  });
  assert.ok(nodes.length <= 1, `bounded output, got ${nodes.length}`);
  assert.ok(warns.includes('smask.group.unevaluated|nested'), warns.join(','));
});

test('fuzz: a mask inside a mask is refused at depth 1, the outer one still applies', () => {
  const inner: PdfSoftMaskDef = { id: 'smin', subtype: 'Luminosity', content: '1 g 0 0 100 100 re f', resources: {}, bbox: [0, 0, 100, 100] };
  const outer: PdfSoftMaskDef = {
    id: 'smout', subtype: 'Luminosity',
    // Two nodes so it can't fold to a constant - it must stay a real <mask>.
    content: '0.5 g /G9 gs 0 0 100 100 re f 1 g 10 10 20 20 re f',
    resources: { extgstates: { G9: { smask: inner } } },
    bbox: [0, 0, 100, 100],
  };
  const { nodes, warns } = run('q 0 0 400 300 re W n 1 0 0 rg /G7 gs 0 0 100 100 re f Q', {
    extgstates: { G7: { smask: outer } },
  });
  assert.equal(nodes.length, 1);
  assert.ok(nodes[0]!._softMask, 'the outer mask applied');
  assert.ok(warns.includes('smask.group.unevaluated|nested'), warns.join(','));
});

test('fuzz: malformed mask groups never throw and always fall back a rung', () => {
  const bad: Array<Partial<PdfSoftMaskDef>> = [
    { bbox: [NaN, 0, Infinity, 0] },
    { bbox: [] },
    { bbox: [0, 0, 0, 0] },
    { matrix: [0, 0, 0, 0, 0, 0] },
    { matrix: [NaN, 1, 1, 1, 1, 1] },
    { content: '(((((( 99999 <<<< /X4 Do' },
    { content: 'q '.repeat(50_000) },
    { content: '['.repeat(20_000) },
    { content: 'x'.repeat(1_000_000) },
    { resources: undefined as never },
    { subtype: 'Nonsense' as never },
  ];
  for (const patch of bad) {
    const { nodes } = run(SHADOW_PAGE, {
      extgstates: { G5: { ca: 0.2784 }, G7: { smask: { ...SHADOW_MASK, ...patch } } },
    });
    // Either dropped (the shadow rung) or painted unmasked - never a crash, and the
    // output stays bounded.
    assert.ok(nodes.length <= 1, JSON.stringify(Object.keys(patch)));
  }
});

test('fuzz: a mask group that paints 64+ nodes is refused rather than half-emitted', () => {
  let content = '';
  for (let i = 0; i < 200; i++) content += `0.5 g ${i} 10 5 5 re f `;
  const { nodes, warns } = run(SHADOW_PAGE, {
    extgstates: { G5: { ca: 0.2784 }, G7: { smask: { ...SHADOW_MASK, content } } },
  });
  assert.ok(warns.includes('smask.group.unevaluated|nodes'), warns.join(','));
  assert.equal(nodes.length, 0);   // falls to the shadow rung, as before
});

// ── geometry: the mask region is an AABB, its content keeps the true quad ─────

test('a rotated mask group: AABB region + the real quad as a clip on its children', () => {
  const def: PdfSoftMaskDef = {
    ...SHADOW_MASK,
    id: 'smrot',
    matrix: [0.7, 0.7, -0.7, 0.7, 0, 0],
    bbox: [0, 0, 100, 100],
    content: 'q 100 0 0 100 0 0 cm /X4 Do Q',
  };
  const { nodes } = run('q 0 0 400 300 re W n 0.19 0.73 0.47 rg /G7 gs 0 0 100 100 re f Q', {
    extgstates: { G7: { smask: def } },
  });
  const m = nodes[0]?._softMask;
  assert.ok(m, 'mask applied');
  // 100x100 rotated 45° → a 140x140 axis-aligned mask region.
  assert.ok(near(m.w, 140, 1) && near(m.h, 140, 1), `${m.w}x${m.h}`);
  // The group's content is clipped to the TRUE transformed bbox, not the AABB.
  assert.ok(m.nodes[0]!._clips?.length, 'bbox quad clip present');
  const svg = svgOf(nodes, { m0: 'data:image/jpeg;base64,AAA' });
  assert.match(svg, /<mask id="pmask0"[^>]*>\s*<g clip-path="url\(#pclip\d+\)">/);
});
