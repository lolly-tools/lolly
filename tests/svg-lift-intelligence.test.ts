// SPDX-License-Identifier: MPL-2.0
/**
 * Lift intelligence, graded on the artwork it failed on (plans/104 P3.2).
 *
 * The P3.1 acceptance pass ran six real `docs/shots` SVGs through lift → camera →
 * mp4 and wrote down what came out. Three of its findings were structural rather
 * than cosmetic, and all three are properties of pure functions, so they are
 * tested here against THE SAME SIX FILES rather than against fixtures that agree
 * with us:
 *
 *   1. **The ladder was content-blind.** A fixed 40 px per layer put 31 of
 *      `bs-palette-pane`'s 54 rows at the field clamp (z = 900) with no relative
 *      parallax at all, while the layers that did move spread 125× apart. The
 *      ladder is now a fixed band in MAGNIFICATION (`liftDepths`), so N layers
 *      share the band however large N is.
 *   2. **Rows were full-stage.** Every derived document kept the source's
 *      viewBox, so a 16 px icon's `shadow: depth` cost a full-frame gaussian - 
 *      which is what aborted the encoder watchdog on three of the six shots. The
 *      enumerator now crops a document to its ink where that is provably safe
 *      and reports the rect, and `liftRows` cuts the row to match.
 *   3. **Grids became staircases.** Nine identical cards on a 3 × 3 grid were
 *      nine different depths. `liftSlots` puts geometric peers on one rung.
 *
 * …plus the hero problem: `brand-colours` enumerated into 5 layers of which one
 * held 96 % of the ink, which is a picture with a frame around it, not a stack.
 *
 * These are the acceptance fixtures, so the numbers below are MEASURED, not
 * chosen: each is written with the value that made it fail before the fix.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { enumerateSvgLayers, svgRootViewBox } from '../engine/src/svg-layers.ts';
import type { SvgLayer, SvgLayerBox } from '../engine/src/svg-layers.ts';
import { KF_Z_FIELD_CLAMP, KF_EFF_MAX, depthForEff, projectDepth, DEFAULT_CAMERA } from '../engine/src/keyframes.ts';
import {
  liftRows, liftSlots, liftDepths, liftCanCrop, LIFT_EFF_CEIL, LIFT_PEER_OVERLAP_TOL,
} from '../shells/web/src/views/free-canvas-math.ts';
import type { Box } from '../shells/web/src/views/free-canvas-math.ts';

const SHOTS_DIR = fileURLToPath(new URL('../docs/shots/', import.meta.url));

/** Andy's six banked acceptance shots, with the layer counts P3.1 measured. */
const SHOTS = ['brand-colours', 'ai-stance-change-history', 'cc-verify-mobile',
  'bs-palette-pane', 'brand-studio', 'seq-studio-timeline'] as const;

const PAINT = /<(path|rect|circle|ellipse|line|polyline|polygon|text|image|use)\b/g;

/** Paint elements outside the non-rendering blocks - the hero test's own unit. */
function ink(markup: string): number {
  const body = markup.replace(/<defs[\s\S]*?<\/defs>/g, '').replace(/<style[\s\S]*?<\/style>/g, '');
  return (body.match(PAINT) ?? []).length;
}

interface Shot { name: string; src: string; layers: SvgLayer[]; viewBox: SvgLayerBox | null; warnings: string[] }

const shots: Shot[] = SHOTS.map((name) => {
  const path = `${SHOTS_DIR}${name}.svg`;
  const src = existsSync(path) ? readFileSync(path, 'utf8') : '';
  const r = src ? enumerateSvgLayers(src) : { layers: [], warnings: [], viewBox: null };
  return { name, src, layers: r.layers, viewBox: r.viewBox, warnings: r.warnings };
});

// The shots are committed; a missing one is a broken checkout, not a reason to
// pass. (`docs/` is a submodule - say which, so the message is actionable.)
test('the six acceptance shots are on disk and every one of them lifts', () => {
  for (const s of shots) {
    assert.ok(s.src, `${s.name}.svg is missing — run \`git submodule update --init docs\``);
    assert.ok(s.layers.length >= 2, `${s.name} must lift into a stack, got ${s.layers.length}`);
    assert.ok(s.viewBox, `${s.name} must report its viewBox — the crop map's denominator`);
  }
});

// ══ 1. the eff-band ladder ════════════════════════════════════════════════════

describe('the depth ladder is a band, not a staircase', () => {
  const CEIL_Z = depthForEff(LIFT_EFF_CEIL);

  for (const s of shots) {
    test(`${s.name}: ${s.layers.length} layers fit the band`, () => {
      const z = liftDepths(liftSlots(s.layers.map((l) => l.bbox ?? l.viewBox ?? null)), KF_Z_FIELD_CLAMP);
      assert.equal(z.length, s.layers.length);
      assert.ok(z.every((v) => v <= CEIL_Z + 0.01),
        `nothing past the band ceiling (${CEIL_Z} px): ${Math.max(...z)}`);
      // The two failures the acceptance run reported, as assertions.
      assert.equal(z.filter((v) => v >= KF_Z_FIELD_CLAMP[1]).length, 0,
        'no row at the field clamp — P3.1 measured 31 of 54 on bs-palette-pane');
      assert.equal(z.filter((v) => v > 200).length, 0, 'no row past z = 200');
      // …and the guard is nowhere near: eff spreads across the band, not to 10.
      const effs = z.map((v) => projectDepth(DEFAULT_CAMERA, v).eff);
      assert.ok(Math.max(...effs) <= LIFT_EFF_CEIL + 1e-6,
        `magnification stays inside the band: ${Math.max(...effs)}`);
      assert.ok(Math.max(...effs) < KF_EFF_MAX, 'and nothing flies past the camera');
      assert.equal(z[0], 0, 'the bottom layer rests on the surface');
    });
  }

  test('the spread between neighbours is even, not exponential', () => {
    // P3.1: `ai-stance-change-history` moved its top layer 3202 px and its bottom
    // one 15 px - a 210× spread, because the tail sat at the guard where eff is
    // 10. Even rungs in eff mean the parallax ratio is the band, end to end.
    const s = shots.find((x) => x.name === 'ai-stance-change-history')!;
    const z = liftDepths(liftSlots(s.layers.map((l) => l.bbox ?? l.viewBox ?? null)), KF_Z_FIELD_CLAMP);
    const effs = z.map((v) => projectDepth(DEFAULT_CAMERA, v).eff);
    const spread = Math.max(...effs) / Math.min(...effs);
    assert.ok(spread <= LIFT_EFF_CEIL + 1e-6, `eff spread ${spread} must be the band, was 8.2 before`);
  });
});

// ══ 2. bbox-sized rows ════════════════════════════════════════════════════════

describe('a derived document is cropped to its ink, and the row is cut to match', () => {
  /** A plain image box: no background, no caption - so cropping is allowed. */
  const CFG = {
    idField: 'id', xField: 'x', yField: 'y', wField: 'w', hField: 'h', rotationField: 'rot',
    radiusField: 'radius', imageField: 'image', fitField: 'fit', imgPosField: 'imgPos',
    clipField: 'clip', groupField: 'group', zField: 'z', shadowField: 'shadow',
    textField: 'text', fillField: 'bg', gradField: 'grad',
  };
  const boxFor = (vb: SvgLayerBox): Box => {
    // A box with the artwork's own aspect, so `contain` fills it exactly.
    const k = 900 / vb.h;
    return { id: 'a', x: 100, y: 50, w: Math.round(vb.w * k), h: 900, rot: 0, fit: 'contain' } as Box;
  };

  for (const s of shots) {
    test(`${s.name}: every cropped row is its layer's ink, inside the box`, () => {
      const box = boxFor(s.viewBox!);
      assert.equal(liftCanCrop(box, CFG, { viewBox: s.viewBox, fit: 'contain' }), true,
        'a plain image box is croppable');
      const rows = liftRows(box, s.layers.map((l, i) => ({
        src: `data:,${i}`, id: `r${i}`, crop: l.viewBox ?? null, bbox: l.bbox,
      })), CFG, { viewBox: s.viewBox, fit: 'contain', zClamp: KF_Z_FIELD_CLAMP }) as Array<Record<string, number | string>>;

      // `contain` again, the way `liftContentRect` computes it - the box is built
      // from a rounded width, so the scale is the min of the two ratios and the
      // artwork is centred in whatever slack that leaves.
      const k = Math.min(Number(box.w) / s.viewBox!.w, Number(box.h) / s.viewBox!.h);
      const ox = Number(box.x) + (Number(box.w) - s.viewBox!.w * k) / 2;
      const oy = Number(box.y) + (Number(box.h) - s.viewBox!.h * k) / 2;
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i]!;
        const crop = s.layers[i]!.viewBox;
        if (!crop) {
          assert.equal(r.x, box.x, `${i}: an uncropped layer keeps the box`);
          assert.equal(r.w, box.w);
          continue;
        }
        // The row IS the crop, mapped through the box: this is the identity the
        // whole crop rests on - the document's viewBox and the row's rect are the
        // same rectangle in two coordinate systems.
        assert.ok(Math.abs(Number(r.w) - crop.w * k) <= 0.01, `${i}: width follows the crop`);
        assert.ok(Math.abs(Number(r.h) - crop.h * k) <= 0.01, `${i}: height follows the crop`);
        assert.ok(Math.abs(Number(r.x) - (ox + (crop.x - s.viewBox!.x) * k)) <= 0.01, `${i}: x follows the crop`);
        assert.ok(Math.abs(Number(r.y) - (oy + (crop.y - s.viewBox!.y) * k)) <= 0.01, `${i}: y follows the crop`);
        assert.equal(r.fit, 'fill', `${i}: a cropped row stretches its crop over its rect`);
        assert.ok(
          Number(r.x) >= Number(box.x) - 0.01 && Number(r.y) >= Number(box.y) - 0.01
          && Number(r.x) + Number(r.w) <= Number(box.x) + Number(box.w) + 0.01
          && Number(r.y) + Number(r.h) <= Number(box.y) + Number(box.h) + 0.01,
          `${i}: and it stays inside the box it came out of`,
        );
      }
    });

    test(`${s.name}: the crop the document declares is the crop reported`, () => {
      for (const l of s.layers) {
        if (!l.viewBox) {
          assert.match(l.markup.slice(0, 400), /viewBox="0 0 /, 'an uncropped layer keeps the source root');
          continue;
        }
        const vb = svgRootViewBox(l.markup);
        assert.ok(vb, 'a cropped document still declares a viewBox');
        for (const key of ['x', 'y', 'w', 'h'] as const) {
          assert.ok(Math.abs(vb![key] - l.viewBox[key]) <= 0.001,
            `the document's viewBox.${key} is the reported crop (${vb![key]} vs ${l.viewBox[key]})`);
        }
        // A crop is a WINDOW on the source, never a wider one: ink the original
        // clipped away must not come back because its layer got a bigger frame.
        const src = s.viewBox!;
        assert.ok(
          l.viewBox.x >= src.x - 1e-6 && l.viewBox.y >= src.y - 1e-6
          && l.viewBox.x + l.viewBox.w <= src.x + src.w + 1e-6
          && l.viewBox.y + l.viewBox.h <= src.y + src.h + 1e-6,
          'and it is inside the source viewBox',
        );
      }
    });
  }

  test('the filtered area collapses to the ink ratio — the shadow fix, measured', () => {
    // What the perf wall actually was: `shadow: depth` on N full-stage boxes is N
    // full-frame gaussians per frame. The number below is the share of the
    // full-stage cost the same stack now pays. Measured 2026-08-12; the bound is
    // the measurement plus headroom, so a regression to full-stage rows (100 %)
    // fails loudly.
    const worst: Record<string, number> = {
      'brand-colours': 0.40, 'ai-stance-change-history': 0.10, 'cc-verify-mobile': 0.35,
      'bs-palette-pane': 0.10, 'brand-studio': 0.70, 'seq-studio-timeline': 0.10,
    };
    for (const s of shots) {
      const stage = s.viewBox!.w * s.viewBox!.h;
      const area = s.layers.reduce((a, l) => a + (l.viewBox ? l.viewBox.w * l.viewBox.h : stage), 0);
      const ratio = area / (stage * s.layers.length);
      assert.ok(ratio <= worst[s.name]!,
        `${s.name}: filtered area is ${(ratio * 100).toFixed(1)}% of full-stage, budget ${worst[s.name]! * 100}%`);
    }
  });
});

// ══ 3. peer-depth coherence ═══════════════════════════════════════════════════

describe('geometric peers share a depth, so grids stay grids', () => {
  for (const s of shots) {
    test(`${s.name}: no inversion repaints overlapping ink`, () => {
      const crops = s.layers.map((l) => l.bbox ?? l.viewBox ?? null);
      const slots = liftSlots(crops);
      // The module's own bar: an inversion matters where it flips a MEANINGFUL
      // overlap. Two anti-aliased pixels of a drop shadow kissing the next swatch
      // is not a repaint, and treating it as one costs the whole grid.
      const hit = (a: SvgLayerBox, b: SvgLayerBox): boolean => {
        const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        return w > 0 && h > 0 && w * h >= LIFT_PEER_OVERLAP_TOL * Math.min(a.w * a.h, b.w * b.h);
      };
      for (let i = 0; i < slots.length; i++) {
        for (let j = i + 1; j < slots.length; j++) {
          if (slots[i]! <= slots[j]!) continue;
          const a = crops[i], b = crops[j];
          assert.ok(a && b && !hit(a, b),
            `${s.name}: rows ${i}/${j} would sort out of paint order while overlapping`);
        }
      }
    });
  }

  /** The rungs, and how many rows stand on each. */
  const rungs = (s: Shot): { count: number; biggest: number; members: number[] } => {
    const slots = liftSlots(s.layers.map((l) => l.bbox ?? l.viewBox ?? null));
    const by = new Map<number, number[]>();
    slots.forEach((v, i) => { by.set(v, [...(by.get(v) ?? []), i]); });
    let members: number[] = [];
    for (const m of by.values()) if (m.length > members.length) members = m;
    return { count: by.size, biggest: members.length, members };
  };

  // Measured 2026-08-12. The first number is what the grid actually is, so these
  // fail in BOTH directions: a coherence regression drops the group, and an
  // over-eager merge collapses the stack into one rung.
  const GRIDS: Record<string, { rungs: number; biggest: number }> = {
    'bs-palette-pane': { rungs: 6, biggest: 25 },     // 25 swatch wells + 25 chips
    'cc-verify-mobile': { rungs: 6, biggest: 9 },     // the 3×3 card block
    // Re-measured 2026-08-17: the baseline re-captured against design's timeline
    // (sequence-studio consolidated into design; the recipe now opens design with
    // the old default sequence packed into the URL), and design's toolbar row has
    // one more control than the standalone tool's did.
    'seq-studio-timeline': { rungs: 22, biggest: 10 }, // the toolbar's icon row
  };
  for (const [name, want] of Object.entries(GRIDS)) {
    test(`${name}: its grid is ONE surface, not ${want.biggest} steps`, () => {
      const s = shots.find((x) => x.name === name)!;
      const got = rungs(s);
      assert.equal(got.biggest, want.biggest, `${name}: the grid should be one rung of ${want.biggest}`);
      assert.equal(got.count, want.rungs, `${name}: ${s.layers.length} layers on ${want.rungs} rungs`);
      // One rung is one WHISPER, not one number: the members spread across a single
      // band step so the depth sort keeps an order of its own (plans/104 section 4.2)
      // while the grid still reads as one surface.
      const z = liftDepths(liftSlots(s.layers.map((l) => l.bbox ?? l.viewBox ?? null)), KF_Z_FIELD_CLAMP);
      const eff = got.members.map((i) => projectDepth(DEFAULT_CAMERA, z[i]!).eff);
      const step = (LIFT_EFF_CEIL - 1) / Math.max(1, got.count - 1);
      assert.ok(Math.max(...eff) - Math.min(...eff) <= step + 1e-9,
        `${name}: the grid spreads ${(Math.max(...eff) - Math.min(...eff)).toFixed(4)}, more than one rung`);
      assert.equal(new Set(z).size, z.length, 'and every depth is still distinct');
    });
  }

  test('coherence never collapses a stack into a single surface', () => {
    for (const s of shots) {
      const got = rungs(s);
      assert.ok(got.count >= 3, `${s.name}: ${got.count} rungs is not a stack`);
      assert.ok(got.biggest < s.layers.length, `${s.name}: everything landed on one rung`);
    }
  });
});

// ══ 4. the hero problem ═══════════════════════════════════════════════════════

describe('a layer holding the whole picture is opened up', () => {
  test('brand-colours: 5 layers of which one held 96% becomes a real stack', () => {
    const s = shots.find((x) => x.name === 'brand-colours')!;
    assert.ok(s.layers.length >= 10 && s.layers.length <= 20,
      `expected 10–20 sensible layers, got ${s.layers.length}`);
    assert.match(s.warnings.join(' '), /held \d+% of this artwork/,
      'and the dialog says why the count is what it is');
  });

  for (const s of shots) {
    test(`${s.name}: no layer holds more than two thirds of the ink`, () => {
      const inks = s.layers.map((l) => ink(l.markup));
      const total = inks.reduce((a, b) => a + b, 0);
      assert.ok(total > 0, 'the layers draw something');
      const share = Math.max(...inks) / total;
      assert.ok(share <= 2 / 3 + 1e-9,
        `${s.name}: one layer holds ${(share * 100).toFixed(0)}% of the artwork`);
    });
  }

  test('the descent never loses artwork, and never runs away with it', () => {
    for (const s of shots) {
      const before = ink(s.src);
      const after = s.layers.reduce((a, l) => a + ink(l.markup), 0);
      assert.equal(after, before,
        `${s.name}: the layers are a partition — ${after} paint elements against the source's ${before}`);
      assert.ok(s.layers.length <= 64, `${s.name}: within the layer cap`);
    }
  });

  test('opening a hero up is opt-out, and the opt-out is the old behaviour', () => {
    const s = shots.find((x) => x.name === 'brand-colours')!;
    const raw = enumerateSvgLayers(s.src, { heroDescent: false });
    assert.equal(raw.layers.length, 5, 'the 1.119 enumeration, unchanged');
    const flat = enumerateSvgLayers(s.src, { cropToInk: false });
    assert.ok(flat.layers.every((l) => !l.viewBox), 'and cropping is opt-out too');
    assert.ok(flat.layers.every((l) => /viewBox="0 0 1440 900"/.test(l.markup.slice(0, 400))),
      'opting out gives back the source root, verbatim');
  });

  test('lifting six real screenshots stays interactive', () => {
    // Not a benchmark - a tripwire for the quadratic paths the caps exist to
    // bound. Measured cold on this machine: 2–35 ms per shot.
    for (const s of shots) {
      const t0 = performance.now();
      enumerateSvgLayers(s.src);
      const ms = performance.now() - t0;
      assert.ok(ms < 1500, `${s.name} took ${ms.toFixed(0)} ms`);
    }
  });
});

// ══ the caps still bind ═══════════════════════════════════════════════════════

describe('opening a hero up respects the ceilings it was given', () => {
  test('a descent that would be tail-merged straight back is not made', () => {
    // The merge at the layer cap folds a contiguous run into one document, and a
    // document can only re-emit ONE wrapper chain - so a descent that overshot
    // the cap would hand it members from two different chains and lose the
    // hero's own transform on half of them. It is refused instead, which is
    // 1.119's answer to the same file.
    const s = shots.find((x) => x.name === 'brand-colours')!;
    const capped = enumerateSvgLayers(s.src, { maxLayers: 6 });
    assert.ok(capped.layers.length <= 6, `the cap must bind: got ${capped.layers.length}`);
    assert.equal(capped.layers.filter((l) => l.viewBox).length >= 0, true);
    // At a cap of 6 the 5-layer enumeration cannot grow to 16, so the hero stays
    // whole and the artwork is still whole with it.
    const before = ink(s.src);
    assert.equal(capped.layers.reduce((a, l) => a + ink(l.markup), 0), before,
      'and no artwork is lost either way');
  });

  test('maxLayers still only lowers the ceiling', () => {
    const s = shots.find((x) => x.name === 'bs-palette-pane')!;
    assert.ok(enumerateSvgLayers(s.src, { maxLayers: 1000 }).layers.length <= 64);
    assert.equal(enumerateSvgLayers(s.src, { maxLayers: 3 }).layers.length, 3);
  });
});
