// SPDX-License-Identifier: MPL-2.0
/**
 * The two blur lanes, headless (plan 104 section 5.5, section 11 S1).
 *
 * What Node can prove about a blur is everything except the pixels an engine paints:
 * the parse of the authored filter, the spill geometry a scratch is sized from, the
 * mip ladder's choice of level and residual sigma, the box-blur kernel itself (pure
 * arithmetic over an array - no canvas involved), and the ORDER of the passes each
 * lane issues. The pixels are `tests/canvas-blur-lanes.browser.test.ts`, which is also
 * where the filter-vs-mip tolerance is measured and stated.
 *
 * Run directly:  node --test shells/web/src/lib/canvas-blur.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  BLUR_AREA_SHRINK_PER_SIGMA,
  BLUR_DIRECT_PIXELS,
  BLUR_MIN_SIGMA,
  BLUR_SCRATCH_MAX_PIXELS,
  BLUR_SCRATCH_MAX_SIDE,
  BLUR_SPREAD_SIGMAS,
  MIP_RESAMPLE_SIGMA_PER_SHRINK,
  _resetBlurPool,
  _setBlurCanvasFactory,
  blurLadder,
  boxBlurRgba,
  boxSizesForGauss,
  BOX_MIN_SIGMA,
  fxFilterString,
  isFxEmpty,
  parseDropShadows,
  parseFilterTerms,
  releaseStage,
  renderFx,
  scaleFilter,
  scratchPadCap,
  serialiseDropShadow,
  shadowSigma,
  spillPad,
  takeStage,
  unreproducibleTerms,
  type BlurCanvas,
} from './canvas-blur.ts';

// ── a recording canvas (no pixels, every call in order) ─────────────────────

interface Op { op: string; args: unknown[] }

interface StubCanvas {
  width: number;
  height: number;
  ops: Op[];
  id: number;
  getContext(kind: string, opts?: unknown): unknown;
}

let stubId = 0;

function stubCanvas(w: number, h: number): StubCanvas {
  const ops: Op[] = [];
  const canvas: StubCanvas = {
    width: w,
    height: h,
    ops,
    id: ++stubId,
    getContext() {
      const rec = (op: string) => (...args: unknown[]): void => { ops.push({ op, args }); };
      return {
        canvas,
        filter: 'none',
        fillStyle: '',
        globalAlpha: 1,
        globalCompositeOperation: 'source-over',
        imageSmoothingEnabled: false,
        imageSmoothingQuality: 'low',
        save: rec('save'),
        restore: rec('restore'),
        translate: rec('translate'),
        rotate: rec('rotate'),
        scale: rec('scale'),
        clip: rec('clip'),
        setTransform: rec('setTransform'),
        clearRect: rec('clearRect'),
        fillRect: rec('fillRect'),
        putImageData: rec('putImageData'),
        drawImage: (src: StubCanvas, ...rest: unknown[]) => {
          ops.push({ op: 'drawImage', args: [src?.id ?? src, ...rest] });
        },
        getImageData: (_x: number, _y: number, gw: number, gh: number) => {
          ops.push({ op: 'getImageData', args: [gw, gh] });
          return { data: new Uint8ClampedArray(Math.max(1, gw * gh * 4)), width: gw, height: gh };
        },
      };
    },
  };
  return canvas;
}

/** Install the recording factory and hand back the canvases it hands out, in order. */
function useStubCanvases(): { made: StubCanvas[]; done: () => void } {
  const made: StubCanvas[] = [];
  _setBlurCanvasFactory((w, h) => {
    const c = stubCanvas(Math.max(1, Math.ceil(w)), Math.max(1, Math.ceil(h)));
    made.push(c);
    return c as unknown as BlurCanvas;
  });
  return { made, done: () => _setBlurCanvasFactory(null) };
}

// ── the authored filter, parsed ─────────────────────────────────────────────

test('parseFilterTerms reads the hooks\' own vocabulary, in order and parens-aware', () => {
  const terms = parseFilterTerms('blur(4.5px) drop-shadow(0px 2px 10px rgba(0, 0, 0, 0.33))');
  assert.deepEqual(terms.map((t) => t.name), ['blur', 'drop-shadow']);
  assert.equal(terms[1]?.args, '0px 2px 10px rgba(0, 0, 0, 0.33)');
});

test('parseDropShadows: lengths, colour, and a colour that contains its own commas', () => {
  const [a] = parseDropShadows('drop-shadow(0px 2px 10px #00000055)');
  assert.deepEqual(a, { dx: 0, dy: 2, blur: 10, color: '#00000055' });
  const [b] = parseDropShadows('drop-shadow(-4px 6px 12px rgba(0, 0, 0, 0.5))');
  // The colour keeps its own spacing - the tokeniser only splits at paren depth 0, so
  // a functional colour survives as ONE token instead of becoming four.
  assert.deepEqual(b, { dx: -4, dy: 6, blur: 12, color: 'rgba(0, 0, 0, 0.5)' });
});

test('parseDropShadows: missing lengths default to 0, missing colour to black', () => {
  assert.deepEqual(parseDropShadows('drop-shadow(4px 4px)'),
    [{ dx: 4, dy: 4, blur: 0, color: '#000000' }]);
});

test('a drop-shadow\'s blur is a RADIUS; its sigma is half of it (and blur() is already sigma)', () => {
  // The classic factor-of-two bug: `blur(10px)` is sigma 10, `drop-shadow(… 10px …)`
  // is sigma 5. Filter Effects says so, and the halving lives in exactly one function.
  assert.equal(shadowSigma({ dx: 0, dy: 0, blur: 10, color: '#000' }), 5);
  assert.equal(shadowSigma({ dx: 0, dy: 0, blur: 0, color: '#000' }), 0);
  assert.equal(fxFilterString({ sigma: 10, rest: '', shadows: [] }), 'blur(10px)');
});

test('scaleFilter scales every drop-shadow length by S and keeps the chain order', () => {
  const out = scaleFilter('drop-shadow(0px 2px 10px #00000055) drop-shadow(1px 1px 2px #fff)', 2);
  assert.deepEqual(out.shadows.map((s) => [s.dx, s.dy, s.blur]), [[0, 4, 20], [2, 2, 4]]);
  assert.equal(out.rest,
    'drop-shadow(0px 4px 20px #00000055) drop-shadow(2px 2px 4px #fff)');
});

test('scaleFilter passes an unknown term through verbatim and reports it as unreproducible', () => {
  const out = scaleFilter('grayscale(1) drop-shadow(0px 2px 10px #000)', 2);
  assert.equal(out.rest, 'grayscale(1) drop-shadow(0px 4px 20px #000)');
  assert.deepEqual(out.shadows.length, 1);
  assert.deepEqual(unreproducibleTerms(out.rest), ['grayscale']);
});

test('scaleFilter: none/empty is nothing at all', () => {
  for (const v of ['', '   ', 'none']) {
    assert.deepEqual(scaleFilter(v, 2), { rest: '', shadows: [] }, v);
  }
});

test('serialiseDropShadow round-trips through the parser at the wire quantum', () => {
  const s = { dx: -1.2345, dy: 2.5, blur: 10.5, color: '#00000055' };
  const back = parseDropShadows(serialiseDropShadow(s))[0];
  assert.deepEqual(back, { dx: -1.234, dy: 2.5, blur: 10.5, color: '#00000055' });
});

test('isFxEmpty is the byte-identity gate', () => {
  assert.equal(isFxEmpty(null), true);
  assert.equal(isFxEmpty({ sigma: 0, rest: '', shadows: [] }), true);
  assert.equal(isFxEmpty({ sigma: 0.1, rest: '', shadows: [] }), false);
  assert.equal(isFxEmpty({ sigma: 0, rest: 'drop-shadow(0px 1px 2px #000)', shadows: [] }), false);
});

// ── spill: how big the scratch has to be ────────────────────────────────────

test('spillPad: three sigmas of blur, ceiled', () => {
  assert.equal(spillPad(4), Math.ceil(BLUR_SPREAD_SIGMAS * 4));
  assert.equal(spillPad(0), 0);
  assert.equal(spillPad(Number.NaN), 0);
});

test('spillPad: a shadow reaches from the BLURRED silhouette, not from the box', () => {
  // A filter chain applies drop-shadow to the result of the blur before it, so the
  // shadow starts one blur-spill out and then travels its own offset and softness.
  const shadow = { dx: 0, dy: 6, blur: 20, color: '#000' };
  const blur = BLUR_SPREAD_SIGMAS * 4;                       // sigma 4
  const reach = 6 + BLUR_SPREAD_SIGMAS * 10;                 // offset + 3·(20/2)
  assert.equal(spillPad(4, [shadow]), Math.ceil(blur + reach));
  // …and with no blur at all it is just the shadow's own reach.
  assert.equal(spillPad(0, [shadow]), Math.ceil(reach));
});

test('spillPad takes the LARGEST shadow, and measures the offset per axis', () => {
  const a = { dx: -40, dy: 0, blur: 0, color: '#000' };
  const b = { dx: 0, dy: 4, blur: 4, color: '#000' };
  assert.equal(spillPad(0, [a, b]), 40);
});

test('scratchPadCap bounds a spill that the plate budget never sees', () => {
  // `spillPad` is 3σ with σ up to KF_MAX_BLUR × S: a 640×360 box at S = 2 with a 300 px
  // blur asks for a 4880×4320 scratch (~84 MB) that the per-plate long-side cap does
  // not price. `takeStage` answering null means the layer is drawn UNFILTERED, which is
  // worse than a spill clipped a long way out - so the pad is what gives.
  assert.equal(scratchPadCap(100, 100, 1000, 0), 450, 'the room left on the longer axis');
  assert.equal(scratchPadCap(4000, 100, 1000, 0), 0, 'a box already over the cap gets none');
  // The AREA rule is the binding one: 640×360 at S=2 is a 1280×720 scratch, and 3σ of a
  // 300px blur at S=2 would take it to 4880×4320 - 21 Mpx, past what Safari will hand
  // out, with three or four of them alive at once inside `renderFx`.
  const capped = scratchPadCap(1280, 720);
  assert.ok(capped < spillPad(300 * 2), `a 300px blur at S=2 is over the cap (${capped})`);
  assert.ok((1280 + capped * 2) * (720 + capped * 2) <= BLUR_SCRATCH_MAX_PIXELS,
    'and the capped scratch really does fit');
  // …and an ordinary spill is never touched.
  assert.ok(capped > spillPad(20), 'a 20px blur is nowhere near it');
  assert.equal(BLUR_SCRATCH_MAX_SIDE, 8192);
});

// ── the box kernel ──────────────────────────────────────────────────────────

test('boxSizesForGauss: three odd widths whose variance matches the target', () => {
  for (const sigma of [0.9, 2, 5, 17.3]) {
    const sizes = boxSizesForGauss(sigma, 3);
    assert.equal(sizes.length, 3, `sigma ${sigma}`);
    for (const s of sizes) assert.equal(s % 2, 1, `odd width for sigma ${sigma}: ${s}`);
    // Variance of a box of width w is (w²−1)/12; three convolved boxes add variances.
    const variance = sizes.reduce((acc, w) => acc + (w * w - 1) / 12, 0);
    const got = Math.sqrt(variance);
    assert.ok(Math.abs(got - sigma) / sigma < 0.12,
      `sigma ${sigma}: three boxes give ${got.toFixed(3)}`);
  }
});

test('boxSizesForGauss: a sigma too small to move a pixel asks for no pass at all', () => {
  assert.deepEqual(boxSizesForGauss(0), []);
  assert.deepEqual(boxSizesForGauss(0.1), []);
});

test('blurLadder: shrink never exceeds sigma, and the residual removes the resample\'s own blur', () => {
  for (const sigma of [1, 3, 9, 40]) {
    const L = blurLadder(sigma, 512, 512);
    assert.ok(L, `sigma ${sigma}`);
    assert.ok(L.shrink <= Math.max(1, sigma * BLUR_AREA_SHRINK_PER_SIGMA), `shrink ${L.shrink} for sigma ${sigma}`);
    assert.equal(L.shrink, 2 ** Math.round(Math.log2(L.shrink)), 'power of two');
    const inner = sigma / L.shrink;
    const resample = L.shrink > 1 ? MIP_RESAMPLE_SIGMA_PER_SHRINK : 0;
    assert.ok(Math.abs(L.sigma - Math.sqrt(Math.max(0, inner * inner - resample * resample))) < 1e-9);
  }
});

test('blurLadder: below the visible threshold there is no lane to take', () => {
  assert.equal(blurLadder(BLUR_MIN_SIGMA, 512, 512), null);
  assert.equal(blurLadder(0, 512, 512), null);
  assert.equal(blurLadder(4, 0, 512), null);
  // …and neither is there one for a sigma BELOW the quantiser's own crossover: the
  // ladder cannot shrink there (any level would over-blur) and the nearer of the two
  // answers three integer boxes can give is the identity. Null says so - where it used
  // to allocate a full-size scratch and copy the source into it to change nothing.
  assert.equal(blurLadder(BOX_MIN_SIGMA / 2 - 0.01, 512, 512), null);
  // ABOVE the crossover the band is expressed, not stranded (plans/104 P1 obligation
  // 5a). It used to run all the way to ~0.87, so a residual under 0.577 was silently
  // dropped and the resamples became the whole blur.
  const band = blurLadder(0.5, 512, 512);
  assert.deepEqual(band, { shrink: 1, sigma: 0.5, sizes: [1, 1, 3] });
  assert.ok(blurLadder(1, 512, 512), 'and a sigma the lane can express still gets a ladder');
});

test('the degenerate band delivers the NEAREST expressible blur, never a stranded residual', () => {
  // THE MEASURED CASE (plans/104 section 9.2 M1 browser verify): a 3840×2160 layer at sigma 3
  // takes shrink 4, which leaves a residual of 0.559 - and 0.559 landed in the band
  // where the Wells construction collapses to all-width-1 boxes. `[]` there meant the
  // two resamples WERE the whole blur, delivered at 0.72×/0.82× of the request.
  const L = blurLadder(3, 3840, 2160);
  assert.ok(L);
  assert.equal(L.shrink, 4);
  assert.ok(Math.abs(L.sigma - 0.559) < 0.01, `residual ${L.sigma}`);
  assert.deepEqual(L.sizes, [1, 1, 3], 'the residual is expressed, not dropped');

  // The crossover is the MIDPOINT IN SIGMA between 0 and the smallest expressible box
  // blur - the metric that matters, because the quantiser's step here is enormous
  // relative to the values in the band and variance-matching would keep choosing zero.
  assert.deepEqual(boxSizesForGauss(BOX_MIN_SIGMA / 2 + 1e-6), [1, 1, 3]);
  assert.deepEqual(boxSizesForGauss(BOX_MIN_SIGMA / 2 - 1e-6), []);
  assert.ok(Math.abs(BOX_MIN_SIGMA - Math.sqrt(2 / 3)) < 1e-12, 'one width-3 box: variance (9-1)/12');

  // …but INSIDE A LADDER the comparison is between two DELIVERED blurs, because the
  // resample already carries 0.5 in quadrature whichever answer is picked (P1 review,
  // MEDIUM 6). That moves the crossover from 0.408 to ≈0.530, and the difference is not
  // cosmetic: at a residual of 0.42 the promotion delivers 1.48× the request where doing
  // nothing delivers 0.78×, so the band's low half was being made WORSE, not better.
  const deliver = (residual: number): number => {
    const sizes = boxSizesForGauss(residual, 3, MIP_RESAMPLE_SIGMA_PER_SHRINK);
    const box = Math.sqrt(sizes.reduce((a, v) => a + (v * v - 1) / 12, 0));
    return Math.hypot(MIP_RESAMPLE_SIGMA_PER_SHRINK, box);
  };
  for (const residual of [0.42, 0.45, 0.5, 0.53]) {
    assert.deepEqual(boxSizesForGauss(residual, 3, MIP_RESAMPLE_SIGMA_PER_SHRINK), [],
      `residual ${residual}: nothing is the NEARER delivered answer here`);
  }
  for (const residual of [0.55, 0.559, 0.57]) {
    assert.deepEqual(boxSizesForGauss(residual, 3, MIP_RESAMPLE_SIGMA_PER_SHRINK), [1, 1, 3],
      `residual ${residual}: one width-3 box is the nearer one`);
  }
  // …and "nearer" is verified as such, not asserted as a threshold: on both sides of the
  // crossover the answer taken is the one closer to what was asked for.
  for (const residual of [0.42, 0.5, 0.55, 0.57]) {
    const want = Math.hypot(MIP_RESAMPLE_SIGMA_PER_SHRINK, residual);
    const other = deliver(residual) === MIP_RESAMPLE_SIGMA_PER_SHRINK
      ? Math.hypot(MIP_RESAMPLE_SIGMA_PER_SHRINK, BOX_MIN_SIGMA)
      : MIP_RESAMPLE_SIGMA_PER_SHRINK;
    assert.ok(Math.abs(deliver(residual) - want) <= Math.abs(other - want),
      `residual ${residual}: the OTHER answer was nearer`);
  }

  // The far edge: 0.577 is where the construction used to jump from "nothing" to [1,1,3]
  // in one step. With nothing carried, that jump has moved down to 0.408 - it has not
  // disappeared, and it cannot: 0.8165 is the smallest blur three integer boxes can say.
  assert.deepEqual(boxSizesForGauss(0.58), [1, 1, 3]);
  assert.deepEqual(boxSizesForGauss(0.56), [1, 1, 3]);

  // …and NOTHING that was already expressible moved.
  for (const sigma of [0.7, 1, 1.5, 2, 3, 4, 8, 12, 30]) {
    const sizes = boxSizesForGauss(sigma);
    assert.ok(sizes.length === 3 && sizes.some((v) => v > 1), `sigma ${sigma}: ${sizes}`);
  }
});

test('blurLadder: a big surface drops an extra level rather than blur 2 Mpx in JS', () => {
  // sigma 3: the sigma rule alone asks for shrink 2, and the area cap
  // (BLUR_AREA_SHRINK_PER_SIGMA · sigma) leaves headroom for the area rule to take.
  const small = blurLadder(3, 256, 256);
  const big = blurLadder(3, 4096, 4096);
  assert.ok(small && big);
  assert.ok(big.shrink > small.shrink,
    `${big.shrink} vs ${small.shrink}: the area rule must bite above ${BLUR_DIRECT_PIXELS}px`);
  // …but never past the cap, so the extra level cannot out-blur the request.
  assert.ok(big.shrink <= BLUR_AREA_SHRINK_PER_SIGMA * 3);
});

test('blurLadder: the AREA rule is not defeated by a SMALL sigma on a huge scratch', () => {
  // THE DEFECT. The cap was 1.8·sigma, a margin below the real bound, and for sigma 1
  // that rounded down to `floor(log2(1.8)) = 0` - the area rule could not fire at all,
  // so a 4K layer ran the three-pass box blur at FULL resolution: 8 M mip px against a
  // 1 M budget, plus two `Float32Array(w·h·4)` (~265 MB of transient) per layer per
  // frame, on the lane that IS the Safari mainline.
  //
  // The real bound is where the residual stops being real: shrink ≤ sigma/0.5. AT it
  // the residual is exactly 0 - the two resamples ARE the blur and the box pass is
  // skipped entirely, which is the cheap answer as well as the correct one.
  const L = blurLadder(1, 3840, 2160);
  assert.ok(L);
  assert.equal(L.shrink, 2, 'one level down, exactly the bound');
  assert.deepEqual(L.sizes, [], 'and no JS box pass at all: the resample supplies the sigma');
  const mipPx = (3840 / L.shrink) * (2160 / L.shrink);
  assert.ok(mipPx * 0 === 0);
  const L2 = blurLadder(2, 3840, 2160);
  assert.ok(L2);
  assert.equal(L2.shrink, 4);
  assert.deepEqual(L2.sizes, []);
  assert.ok((3840 / L2.shrink) * (2160 / L2.shrink) < BLUR_DIRECT_PIXELS,
    'sigma 2 on a 4K layer now lands inside the pixel budget');
});

test('blurLadder: never takes an axis below 2px', () => {
  const L = blurLadder(64, 8, 8);
  assert.ok(L);
  assert.ok(L.shrink <= 4, `shrink ${L.shrink} would leave a 2px axis or less`);
});

test('boxBlurRgba: a lone opaque pixel spreads, conserves its energy, and stays neutral', () => {
  const w = 33;
  const h = 33;
  const data = new Uint8ClampedArray(w * h * 4);
  const mid = ((16 * w) + 16) * 4;
  data[mid] = 255; data[mid + 1] = 255; data[mid + 2] = 255; data[mid + 3] = 255;
  boxBlurRgba(data, w, h, boxSizesForGauss(3, 3));
  assert.ok((data[mid + 3] as number) < 255, 'the centre gave alpha away');
  assert.ok((data[mid + 3] as number) > 0, 'and kept some');
  const neighbour = ((16 * w) + 18) * 4;
  assert.ok((data[neighbour + 3] as number) > 0, 'two px out has ink');
  // Premultiplied throughout, so a white dot stays white where it is visible: a
  // straight-alpha blur would have dragged the black of the transparent surround in.
  assert.ok((data[neighbour] as number) > 200,
    `no dark halo (got ${data[neighbour]}), which is what premultiplying buys`);
  // Energy is conserved by the kernel (edge clamping duplicates, it never drops), and
  // then 8-bit quantisation eats the tails: spreading 255 over ~300 px leaves dozens of
  // them below half a level, and those round to nothing. A few percent short is the
  // arithmetic being honest, not a leak - what would be a bug is a factor.
  let alpha = 0;
  for (let i = 3; i < data.length; i += 4) alpha += data[i] as number;
  assert.ok(alpha > 220 && alpha < 266, `alpha is conserved to within quantisation (got ${alpha})`);
});

test('boxBlurRgba: no sizes, no work', () => {
  const data = new Uint8ClampedArray([1, 2, 3, 4]);
  boxBlurRgba(data, 1, 1, []);
  assert.deepEqual([...data], [1, 2, 3, 4]);
});

// ── the pool ────────────────────────────────────────────────────────────────

test('takeStage answers null where the realm has no canvas - and every caller survives it', () => {
  _setBlurCanvasFactory(() => null);
  try {
    assert.equal(takeStage(10, 10), null);
    assert.equal(renderFx({ width: 10, height: 10 } as BlurCanvas, { sigma: 4, rest: '', shadows: [] }, 'mip'), null);
    releaseStage(null);
  } finally {
    _setBlurCanvasFactory(null);
  }
});

test('takeStage recycles a released scratch instead of allocating another', () => {
  const { made, done } = useStubCanvases();
  try {
    const a = takeStage(64, 64);
    assert.ok(a);
    releaseStage(a);
    const b = takeStage(64, 64);
    assert.equal(b?.canvas, a.canvas, 'same canvas back');
    assert.equal(made.length, 1, 'and nothing new allocated');
  } finally {
    _resetBlurPool();
    done();
  }
});

test('takeStage hands back a CLEARED scratch at identity, resized in place', () => {
  const { done } = useStubCanvases();
  try {
    const a = takeStage(64, 64);
    releaseStage(a);
    const b = takeStage(32, 16);
    assert.equal(b?.canvas.width, 32);
    assert.equal(b?.canvas.height, 16);
    const ops = (b?.canvas as unknown as StubCanvas).ops.map((o) => o.op);
    assert.ok(ops.includes('setTransform'), 'identity transform');
  } finally {
    _resetBlurPool();
    done();
  }
});

// ── the lanes, as sequences of passes ───────────────────────────────────────

test('the FILTER lane is one property write and one draw', () => {
  const { made, done } = useStubCanvases();
  try {
    const src = stubCanvas(100, 60) as unknown as BlurCanvas;
    const out = renderFx(src, { sigma: 4, rest: 'drop-shadow(0px 2px 10px #000)', shadows: [] }, 'filter');
    assert.ok(out);
    assert.equal(made.length, 1, 'exactly one scratch');
    const ops = (out.canvas as unknown as StubCanvas).ops.filter((o) => o.op === 'drawImage');
    assert.equal(ops.length, 1, 'and exactly one draw through it');
  } finally {
    _resetBlurPool();
    done();
  }
});

test('the MIP lane walks down, blurs in JS at the level, and walks back up', () => {
  const { made, done } = useStubCanvases();
  try {
    const src = stubCanvas(256, 256) as unknown as BlurCanvas;
    const out = renderFx(src, { sigma: 8, rest: '', shadows: [] }, 'mip');
    assert.ok(out);
    const sizes = made.map((c) => c.width);
    // sigma 8 -> shrink 8: 128, 64, 32 down; 64, 128, 256 back up.
    assert.deepEqual(sizes, [128, 64, 32, 64, 128, 256]);
    const level = made[2] as StubCanvas;
    const kinds = level.ops.map((o) => o.op);
    assert.ok(kinds.includes('getImageData') && kinds.includes('putImageData'),
      'the exact part happens at the mip level, in JS');
    assert.equal(out.canvas.width, 256, 'and the result is back at full size');
  } finally {
    _resetBlurPool();
    done();
  }
});

test('the MIP lane casts a drop-shadow as silhouette → blur → offset → content on top', () => {
  const { made, done } = useStubCanvases();
  try {
    const src = stubCanvas(64, 64) as unknown as BlurCanvas;
    const out = renderFx(src, {
      sigma: 0, rest: '', shadows: [{ dx: 3, dy: 5, blur: 8, color: '#00000055' }],
    }, 'mip');
    assert.ok(out);
    // The silhouette pass: draw the content, then flood the colour through source-in.
    const sil = made[0] as StubCanvas;
    const silOps = sil.ops.map((o) => o.op);
    assert.deepEqual(silOps.filter((o) => o === 'drawImage' || o === 'fillRect'),
      ['drawImage', 'fillRect'], 'content, then the tint keyed to its alpha');
    // The composite: the blurred silhouette at the offset, then the content at 0,0.
    const composite = out.canvas as unknown as StubCanvas;
    const draws = composite.ops.filter((o) => o.op === 'drawImage');
    assert.equal(draws.length, 2);
    assert.deepEqual(draws[0]?.args.slice(1), [3, 5], 'the shadow carries the offset');
    assert.deepEqual(draws[1]?.args.slice(1), [0, 0], 'and the content sits square on top');
  } finally {
    _resetBlurPool();
    done();
  }
});

test('a sub-threshold blur with no shadow still hands back a scratch, never the caller\'s canvas', () => {
  // The release contract has to be uniform: a caller that got its own canvas back and
  // then released it would put a canvas it does not own into the pool.
  const { made, done } = useStubCanvases();
  try {
    const src = stubCanvas(64, 64) as unknown as BlurCanvas;
    const out = renderFx(src, { sigma: BLUR_MIN_SIGMA / 2, rest: '', shadows: [] }, 'mip');
    assert.ok(out);
    assert.notEqual(out.canvas, src);
    assert.equal(made.length, 1);
  } finally {
    _resetBlurPool();
    done();
  }
});
