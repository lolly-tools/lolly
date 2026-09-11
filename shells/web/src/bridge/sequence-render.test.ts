// SPDX-License-Identifier: MPL-2.0
/**
 * sequence-render - the parts of the compositor that can be proven in Node.
 *
 * The executor itself is browser-only (canvas, WebCodecs, dom-to-image), and it is
 * covered by the Playwright tier in tests/sequence-render.browser.test.ts. What can
 * be checked headlessly is (a) the pure geometry helpers and (b) the CROSS-FILE
 * CONTRACTS this module depends on but does not own - each of which was a shipped
 * defect, and each of which is invisible to the type checker.
 *
 * Run with: node --test shells/web/src/bridge/sequence-render.test.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { bgOverscanPad, radiiOf, fitRect, plateShotFrame, plateWindowDemands, normalizeMixGain } from './sequence-render.ts';
import { blurScratchNeedBytes, planPlateBudget } from './plate-budget.ts';
import { EMPTY_KF_TRACK, kfTrackOf, sequenceDrawPlan, type SeqLayer } from './sequence-plan.ts';
import { parseDropShadows, spillPad } from '../lib/canvas-blur.ts';

const read = (rel: string): string => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const strip = (src: string): string => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

// ── cross-file contracts (each one was a defect) ────────────────────────────

test('contract: the raster pass clears the phase-2 clock\'s off-playhead class', () => {
  // The compositor photographs the LIVE artboard. sequence-clock leaves OFF_CLASS
  // (display:none, via styles/parts/timeline.css) on every box outside the playhead
  // window, and dom-to-image copies the computed style wholesale - so without this
  // every clip but the scrubbed one exports blank.
  const render = strip(read('./sequence-render.ts'));
  // The named list grew with the read/restore seam (plans/104 section 6 point 0) - what the
  // contract pins is that OFF_CLASS comes from the applier, not that it comes alone.
  assert.match(render, /import\s*\{[^}]*\bOFF_CLASS\b[^}]*\}\s*from\s*'\.\/sequence-dom\.ts'/,
    'OFF_CLASS must be imported from the DOM applier, never restated as a literal');
  assert.match(render, /classList\.remove\(OFF_CLASS\)/, 'the raster must clear it');
  assert.match(render, /classList\.add\(OFF_CLASS\)/, 'and put it back');
  // sequence-dom.ts owns the name now (the clock was refactored onto it and
  // re-exports it, so the preview and every exporter still agree on one literal).
  assert.match(read('./sequence-dom.ts'), /export const OFF_CLASS = 'seq-off'/,
    'the applier owns the name');
  assert.match(read('../views/sequence-clock.ts'), /OFF_CLASS,?[\s\S]{0,200}from '\.\.\/bridge\/sequence-dom\.ts'/,
    'and the clock takes it from there rather than declaring a second one');
  assert.match(read('../styles/parts/sequence.css'), /\.seq-off\s*\{[^}]*display:\s*none\s*!important/,
    'the class only matters because the stylesheet hides it');
  // …and that sheet has to be EAGER. It used to live in parts/timeline.css, which only
  // arrives with the timeline panel's lazy chunk - so a deck presented without ever
  // opening the timeline stamped the class and nothing gave it meaning, and every build
  // fragment was on screen from the moment its slide arrived.
  assert.match(read('../styles/app.css'), /@import '\.\/parts\/sequence\.css'\s+layer\(views\)/,
    'app.css must import the rule eagerly, in the views layer it has always had');
  assert.doesNotMatch(read('../styles/parts/timeline.css'), /^\s*\.seq-off\s*\{/m,
    'and the lazy panel sheet must not declare a second copy of it');
});

test('contract: a frozen snapshotMotion still is marked, and the compositor hides it', () => {
  // On the ZIP path renderFormat's motion guard sees the OUTER format ('zip'), so
  // every <video> has already been swapped for a frozen <img> by the time the mp4
  // sub-render runs. Captured into the box's "over" plate it would sit on top of
  // every decoded frame - a zipped mp4 of a sequence would be a static picture.
  assert.match(strip(read('./export.ts')), /setAttribute\('data-motion-still', '1'\)/,
    'snapshotMotion must mark the still it inserts');
  assert.match(strip(read('./sequence-render.ts')), /querySelectorAll\('\[data-motion-still\]'\)/,
    'the compositor must hide it while rasterising the box');
});

test('contract: the frame cap applies to every buffered path, not just gif/apng', () => {
  // The MediaRecorder fallback pushes an ImageBitmap per frame, so it needs the same
  // ceiling; the streaming muxer holds no frames, so it must NOT have one. That
  // means the codec pick has to happen before the budget is decided.
  const src = strip(read('./sequence-render.ts'));
  const pickAt = src.indexOf('pickWebCodecsVideo(format');
  const capAt = src.indexOf('const cap = maxVideoFrames()');
  const windowAt = src.indexOf('activeFrameWindow(L,');
  assert.ok(pickAt > 0 && capAt > pickAt, 'the encoder pick must precede the frame cap');
  assert.ok(windowAt > capAt, 'activity windows must be derived AFTER the cap, from the capped grid');
  assert.match(src, /activeFrameWindow\(L, usedGrid,/, 'one grid for the loop and the windows');
});

test('contract: both mix graphs consume the ONE bed-duck envelope (section 6.1)', () => {
  // The bed's gain automation lives once, in audio-envelope.ts - a bed must duck
  // identically under a tool's own audio (export.ts) and under a sequence's audio
  // boxes (this module). Restating the ramp scheduling in either graph is how the
  // two exports drift apart.
  const seq = strip(read('./sequence-render.ts'));
  assert.match(seq, /import\s*\{\s*bedDuckEnvelope\b[^}]{0,60}\}\s*from '\.\/audio-envelope\.ts'/,
    'the sequence bed takes the envelope from audio-envelope.ts');
  assert.doesNotMatch(seq, /linearRampToValueAtTime/,
    'no hand-scheduled ramps left in the sequence mix');
  const exp = strip(read('./export.ts'));
  assert.match(exp, /import \{ bedDuckEnvelope, scheduleGainEvents \} from '\.\/audio-envelope\.ts'/,
    'the export mix-in bed takes the same envelope');
  // The per-span duck: mixSequenceAudio hands connectBed the sequence's own audio
  // spans (bed back to full BETWEEN clips), not one min..max window.
  assert.match(seq, /\{ level: duckLevel, spans \}/, 'duck carries the spans themselves');
  // And the offline WebCodecs bed render threads the mix-in track through.
  assert.match(exp, /renderMusicBed\(opts\.audio!\.url[\s\S]{0,240}opts\.audio!\.mix\)/,
    'renderMusicBed receives opts.audio.mix');
});

// ── the pure geometry helpers ───────────────────────────────────────────────

test('radiiOf reads the border-radius shorthand in unscaled box px', () => {
  assert.deepEqual(radiiOf('', 100, 100), [0, 0, 0, 0]);
  assert.deepEqual(radiiOf('0', 100, 100), [0, 0, 0, 0]);
  assert.deepEqual(radiiOf('12px', 100, 100), [12, 12, 12, 12]);
  assert.deepEqual(radiiOf('10px 20px', 100, 100), [10, 20, 10, 20]);
  assert.deepEqual(radiiOf('50%', 100, 100), [50, 50, 50, 50]);
  // The elliptical form collapses to its horizontal radii rather than throwing.
  assert.deepEqual(radiiOf('20px / 40px', 100, 100), [20, 20, 20, 20]);
  // A pill: CSS shrinks every radius by one common factor when a pair overflows.
  const pill = radiiOf('9999px', 200, 80);
  assert.ok(pill.every((r) => Math.abs(r - 40) < 1e-6), `pill radii ${pill}`);
});

test('fitRect places media the way object-fit does', () => {
  assert.deepEqual(fitRect('fill', '', 100, 50, 200, 200), { x: 0, y: 0, w: 200, h: 200 });
  assert.deepEqual(fitRect('contain', '', 100, 50, 200, 200), { x: 0, y: 50, w: 200, h: 100 });
  assert.deepEqual(fitRect('cover', '', 100, 50, 200, 200), { x: -100, y: 0, w: 400, h: 200 });
  assert.deepEqual(fitRect('none', '', 100, 50, 200, 200), { x: 50, y: 75, w: 100, h: 50 });
  assert.deepEqual(fitRect('scale-down', '', 100, 50, 200, 200), { x: 50, y: 75, w: 100, h: 50 });
  // object-position moves the fitted rect, and unknown tokens fall back to centre.
  assert.equal(fitRect('contain', 'left top', 100, 50, 200, 200).y, 0);
  // Pinning shipped behaviour, not CSS: a SINGLE token is applied to both axes here,
  // where CSS would read `25%` as x:25% y:center. A known, unreported deviation - 
  // the box editor only ever authors the two-token and keyword forms.
  assert.equal(fitRect('contain', '25%', 100, 50, 200, 200).y, 25);
  assert.equal(fitRect('contain', 'nonsense', 100, 50, 200, 200).y, 50);
  // A source with no known size falls back to the box rather than dividing by zero.
  assert.deepEqual(fitRect('contain', '', 0, 0, 200, 100), { x: 0, y: 0, w: 200, h: 100 });
});

// ── plate capture: pad + the filter rule (plans/104 section 5.5) ──────────────────

test('plateShotFrame: pad 0 is byte-for-byte the shot this file has always taken', () => {
  // THE FLOOR. A document that uses no depth must export the bytes it exported before
  // any of plans/104 existed, and the plate is where that starts: same canvas size,
  // same transform string, character for character.
  assert.deepEqual(plateShotFrame(640, 360, 2), { width: 1280, height: 720, transform: 'scale(2)' });
  assert.deepEqual(plateShotFrame(640, 360, 2, 0), { width: 1280, height: 720, transform: 'scale(2)' });
  // Rounding is on the FINAL device size, exactly as before (0.5px boxes round once).
  assert.deepEqual(plateShotFrame(101.5, 50.5, 1), { width: 102, height: 51, transform: 'scale(1)' });
  // A degenerate box still yields a canvas - a 0×0 raster is a lost plate.
  assert.equal(plateShotFrame(0.1, 0.1, 0.001).width, 1);
});

test('plateShotFrame: a pad grows the canvas by 2·pad·S and offsets the clone INSIDE the scale', () => {
  const f = plateShotFrame(640, 360, 2, 24);
  assert.equal(f.width, (640 + 48) * 2);
  assert.equal(f.height, (360 + 48) * 2);
  // `scale(S) translate(p,p)` maps x to S·(x + p): the pad stays in ELEMENT px and the
  // box lands p·S device px in, so the plate's origin is (-p,-p) in box space. The
  // other order - translate outside the scale - would offset by p device px and the
  // padding would not line up with the canvas at any S but 1.
  assert.equal(f.transform, 'scale(2) translate(24px, 24px)');
});

test('plateShotFrame: a hostile pad is no pad, never a NaN-sized canvas', () => {
  for (const bad of [Number.NaN, -12, Number.POSITIVE_INFINITY]) {
    assert.deepEqual(plateShotFrame(640, 360, 2, bad),
      { width: 1280, height: 720, transform: 'scale(2)' }, `pad ${bad}`);
  }
});

// ── plate geometry, asked of the planner (plans/104 section 5.5) ───────────────────

function demandLayer(over: Partial<SeqLayer> = {}): SeqLayer {
  return {
    el: null as never,
    idx: 0,
    startMs: 0, durMs: 1000, clipInMs: 0, speed: 1, mute: false, gain: 1, pan: 0, duck: 1, pitch: 0, varispeed: false, fx: '',
    enter: null, enterMs: 0, exit: null, exitMs: 0, enterEase: '', exitEase: '',
    split: '', splitStaggerMs: 0, splitOrder: '', splitUnits: 0, splitSeed: 0,
    hold: '', holdRate: 1,
    lane: 'seq', kind: 'static',
    rect: { x: 0, y: 0, w: 200, h: 120, rot: 0 },
    opacity: 1, blend: '', radius: '', clipPath: '', openEnded: false, frameScene: false,
    z: 0, rx: 0, ry: 0, kf: EMPTY_KF_TRACK, blur: 0, shadowFilter: '',
    ...over,
  };
}

const GRID = [0, 250, 500, 750];

test('plateWindowDemands: a document with no effects asks for nothing extra', () => {
  // The byte-identity floor, expressed as geometry: pad 0 means `plateShotFrame` is
  // the shot it always was, and maxEff 1 means `S * 1` is exactly `S`.
  const d = plateWindowDemands([demandLayer(), demandLayer({ idx: 1, kind: 'video' })], GRID, 1000);
  // `maxW`/`maxH` are the layer's own box until a `w`/`h` key stretches it (section 5.2 P1),
  // and `sized` false is what keeps its plate a ONE-SHOT static capture.
  assert.deepEqual(d.get(0), { pad: 0, maxEff: 1, maxW: 200, maxH: 120, sized: false });
  assert.deepEqual(d.get(1), { pad: 0, maxEff: 1, maxW: 200, maxH: 120, sized: false });
});

test('plateWindowDemands: the pad is the layer\'s own spill, in stage px', () => {
  const shadow = 'drop-shadow(0px 12px 24px #00000055)';
  const d = plateWindowDemands([
    demandLayer({ idx: 0, blur: 5, z: 60 }),
    demandLayer({ idx: 1, shadowFilter: shadow, z: 60 }),
  ], GRID, 1000);
  assert.equal(d.get(0)?.pad, spillPad(5), 'blur: three sigmas');
  assert.equal(d.get(1)?.pad, spillPad(0, parseDropShadows(shadow)), 'shadow: its own reach');
});

test('BYTE-IDENTITY FLOOR: a pre-104 blur/shadow asks for NO pad - its plate still carries it', () => {
  // `shadow: content` and an authored `blur` are pre-104 vocabulary. On a box with no
  // depth, ownership does not move (`ownsLayerFx`): the plate is shot with its filter
  // on, clipped at the box edge exactly as it always was, and the compositor applies
  // nothing. So there is nothing to make room for, and the shot geometry is the one
  // that shipped.
  const d = plateWindowDemands([
    demandLayer({ idx: 0, blur: 5 }),
    demandLayer({ idx: 1, shadowFilter: 'drop-shadow(0px 12px 24px #00000055)' }),
  ], GRID, 1000);
  assert.deepEqual(d.get(0), { pad: 0, maxEff: 1, maxW: 200, maxH: 120, sized: false });
  assert.deepEqual(d.get(1), { pad: 0, maxEff: 1, maxW: 200, maxH: 120, sized: false });
});

test('plateWindowDemands: a size tween is priced at its WIDEST, and marks the layer live', () => {
  // A `w`/`h` tween REFLOWS, so its plate is re-shot per frame - the budget prices the
  // peak, because the peak is the plate that has to fit.
  const track = kfTrackOf('t0_w200_h120*t1000_w600_h400');
  const d = plateWindowDemands([demandLayer({ kf: track })], GRID, 1000);
  assert.equal(d.get(0)?.sized, true, 'the layer re-captures per frame');
  assert.ok((d.get(0)?.maxW ?? 0) > 200, `widest width over the window (got ${d.get(0)?.maxW})`);
  assert.ok((d.get(0)?.maxH ?? 0) > 120, `widest height over the window (got ${d.get(0)?.maxH})`);
});

test('plateWindowDemands: the pad is the WINDOW MAXIMUM, taken from the planner\'s own blur', () => {
  // A `b` channel that ramps the blur up mid-clip: the plate has to be sized for the
  // widest moment, not for the value at t=0 - and the number comes from the same
  // `sequenceDrawPlan` the executor will read, never from a second derivation.
  const track = kfTrackOf('t0_b0*t1000_b20');
  const d = plateWindowDemands([demandLayer({ kf: track })], GRID, 1000);
  const at750 = sequenceDrawPlan([demandLayer({ kf: track })], 750, 1000)[0];
  assert.ok((at750?.blur ?? 0) > 0, 'the fixture really does ramp');
  assert.equal(d.get(0)?.pad, spillPad(at750?.blur ?? 0),
    'the widest frame on the grid sets the pad');
});

test('plateWindowDemands: a lifted layer asks for more resolution than a flat one', () => {
  // P0 has no camera, so the only way to get an eff above 1 is authored depth - which
  // is exactly the machinery P1 will drive from the camera instead.
  const flat = plateWindowDemands([demandLayer()], GRID, 1000, { stageW: 1920, stageH: 1080 });
  const lifted = plateWindowDemands([demandLayer({ z: 600 })], GRID, 1000, { stageW: 1920, stageH: 1080 });
  assert.equal(flat.get(0)?.maxEff, 1);
  assert.ok((lifted.get(0)?.maxEff ?? 0) > 1,
    `a box 600px off the board is magnified (got ${lifted.get(0)?.maxEff})`);
});

test('contract: every PLANNED layer is photographed clean, and the stage background is not', () => {
  // section 5.5: `PlanItem.blur` is the WHOLE blur (authored + kf `b` + DOF) and the executor
  // applies it, so a plate that still carried the element's own filter would blur
  // twice. The stage background is not a planned layer - no PlanItem carries its alpha
  // or its blur - so it keeps both, exactly as it always kept its opacity.
  const src = strip(read('./sequence-render.ts'));
  assert.match(src, /neutralFilter\?:\s*boolean/, 'the shot can be asked for a clean plate');
  // THE NEUTRALISED SET AND THE READ SET ARE THE SAME SET. `readLayer` splits
  // `styleProp(el, 'filter')` - `el.style.getPropertyValue`, inline by construction - 
  // so a filter arriving from a tool's `styles.css` never reaches `SeqLayer.blur` and
  // nobody would re-apply it. Writing `filter: none` here DOES out-specify a class, so
  // it would delete that effect from the plate as well: silently lost, where before
  // this feature it was baked in and exported. `removeProperty` takes exactly the
  // declaration the planner owns and nothing else.
  assert.match(src, /if \(ropts\.neutralFilter\) \{[\s\S]{0,900}el\.style\.removeProperty\('filter'\)/,
    'and that is what it does - the INLINE declaration only, which is the one the planner read');
  assert.ok(!/el\.style\.filter = 'none'/.test(src),
    'never `filter: none`, which would out-specify (and lose) a stylesheet-authored filter');
  assert.match(src, /const plateOpts: RasterOpts = \{\s*opaque: true,\s*neutralFilter: neutralOf\(L\.idx\),\s*neutralClipPath: clipNeutralOf\(L\.idx\),\s*pad: padOf\(L\.idx\),\s*\};/,
    'one plate recipe, shared by every planned layer; all three of its numbers are per-layer (section 5.5)');
  // P1 obligation 5b: the plate must NOT carry the clip-path when the compositor owns
  // the fx, or the shadow casts from the clipped silhouette instead of the real one.
  // Same posture as the filter - remove the INLINE declaration, never write a value.
  assert.match(src, /if \(ropts\.neutralClipPath\) \{[\s\S]{0,700}el\.style\.removeProperty\('clip-path'\)/,
    'the clip is lifted for the shot, and only the inline declaration');
  assert.ok(!/el\.style\.clipPath = 'none'/.test(src),
    'never `clip-path: none` - it would out-specify a stylesheet clip nobody re-applies');
  const bgAt = src.indexOf('bgRaster = await rasterBox(stageEl');
  const optsAt = src.indexOf('const plateOpts');
  assert.ok(bgAt > 0 && optsAt > bgAt, 'the background shot is taken before, and without, the plate recipe');
  // The live (lottie) re-shot is a drop-in replacement for the static plate, so it has
  // to be framed identically - same opacity, same filter rule, same pad, same scale.
  // …and the HIDE LIST is the static plate's own (`entry.hide`), not `[]`: a video
  // layer's plates are shot with the `<video>` hidden because the decoded frame is
  // composited between them, so a live re-shot that kept it would paint a stale poster
  // under the frame it is about to draw.
  assert.match(src, /const hide = slideHide\.length \? \[\.\.\.entry\.hide, \.\.\.slideHide\] : entry\.hide;\s*const shot = await rasterBox\(entry\.box, scaleOf\(layerIdx\), hide, \{[\s\S]{0,420}opaque: true,\s*neutralFilter: neutralOf\(layerIdx\),\s*neutralClipPath: clipNeutralOf\(layerIdx\),\s*pad: padOf\(layerIdx\),/,
    'the per-frame live plate matches the static one it replaces - the static hide list, plus a posed slide’s off-screen boxes (plans/184 R1)');
  // The `over` slot is the transparent half of that pair, framed identically.
  assert.match(src, /slot === 'over' \? \{ transparentBg: true \} : \{\}/,
    'a video layer\'s second live plate is the transparent one, as its static twin is');
  assert.match(src, /makeLiveRaster\(\s*liveBoxes, plateScaleOf, padOf, neutralOf, clipNeutralOf, sizeAt, splitShotAt, stage\.totalMs, slideShotAt,\s*\)/,
    'and is handed the same per-layer pad, scale and ownership the static plates were shot at'
    + ' (plus the split-text window predicate, plans/175 WP-A, and the posed-slide predicate, plans/184 R1)');
  // section 5.4: a camera is a pose over time. `drawItem` already refuses to draw one; the
  // plates loop must refuse to photograph its marker div in the first place.
  assert.match(src, /L\.kind !== 'audio' && L\.kind !== 'camera'/,
    'a camera contributes no plate, exactly as an audio bed contributes none');
});

test('contract: the whole render runs inside the authored-DOM scope (plans/104 section 6 point 0)', () => {
  // `parseSequenceStage` reads each box's rotation, opacity and blur off its INLINE
  // STYLE, and the preview clock has been writing exactly those. The scope has to wrap
  // the parse AND the plates AND the frame loop (the hybrid lottie path re-photographs
  // its box from inside it), which is why the body is a second function.
  const src = strip(read('./sequence-render.ts'));
  // `applySplitAt`/`clearSplitUnits` joined at plans/175 WP-A: the live split shots
  // drive unit spans through the SAME applier module, and the render's finally hands
  // them back at rest - a private split writer would be the drift this test prevents.
  assert.match(src, /import \{\s*OFF_CLASS, applySplitAt, applyTimeToElements, clearSplitUnits, createAuthoredStore, createSequenceTime,\s*isActiveAt, readTiming, stageNativeSize, transitionAt, withAuthoredDom,\s*\} from '\.\/sequence-dom\.ts'/,
    'the scope comes from the applier that owns the writes, never a local restore');
  // `createSequenceTime` joined that import at P2: the tilt capture tier poses the live
  // artboard frame by frame through the SAME session the contact sheet uses, from
  // INSIDE the scope above (which stood every other writer down first). A second,
  // private applier would be exactly the drift this contract exists to prevent.
  assert.match(src, /export async function renderSequence\([\s\S]{0,400}return await withAuthoredDom\(node as HTMLElement, \(\) => renderSequenceAuthored\(/,
    'renderSequence is the scope and nothing else');
  const bodyAt = src.indexOf('async function renderSequenceAuthored(');
  assert.ok(bodyAt > 0, 'the body is a separate function so the scope cannot be partial');
  assert.ok(src.indexOf('parseSequenceStage(node as HTMLElement)', bodyAt) > bodyAt,
    'and the parse is inside it');
  assert.match(read('./sequence-dom.ts'), /export async function withAuthoredDom/,
    'sequence-dom.ts owns the seam');
});

// ── P1a: the camera reaches the plates (plans/104 section 5.5) ─────────────────────

/** A camera clip, in the shape `stageCameras` derives from a `[data-cam]` box. */
const cam = (over: Partial<{ start: number | null; end: number | null; base: Record<string, number>; track: ReturnType<typeof kfTrackOf> }> = {}) => ({
  start: over.start ?? null, end: over.end ?? null,
  base: over.base ?? null, track: over.track ?? null,
});

test('section 5.5 the eff ladder is REAL once a camera exists: a dolly asks for sharper plates', () => {
  // P0 could only reach eff > 1 through authored depth. The whole point of P1 is that
  // the CAMERA gets there too - a flat board flown toward is magnified, and a plate
  // shot at S and then blown up by eff is a soft plate.
  const flat = plateWindowDemands([demandLayer()], GRID, 1000, { stageW: 1920, stageH: 1080 });
  const dolly = plateWindowDemands([demandLayer()], GRID, 1000, {
    stageW: 1920, stageH: 1080, cameras: [cam({ base: { z: -600 } })],
  });
  assert.equal(flat.get(0)?.maxEff, 1, 'no camera: nothing extra, and S × 1 is exactly S');
  assert.ok((dolly.get(0)?.maxEff ?? 0) > 1,
    `the camera alone lifts the demand (got ${dolly.get(0)?.maxEff})`);
  // …and it is the WINDOW MAXIMUM, taken over the same grid the frame loop walks.
  const ramp = plateWindowDemands([demandLayer()], GRID, 1000, {
    stageW: 1920, stageH: 1080, cameras: [cam({ start: 0, track: kfTrackOf('t0_el_z0*t750_el_z-800') })],
  });
  assert.ok((ramp.get(0)?.maxEff ?? 0) > (dolly.get(0)?.maxEff ?? 0) * 0.5,
    'a ramp is sized for its deepest frame, not for t=0');
});

test('section 5.5 the camera also moves ownership: a flat shadowed layer needs a pad under a pan', () => {
  // P1 obligation 1. A plate is shot ONCE for the whole render, so a camera that moves
  // makes every projectable layer compositor-owned - and a compositor-owned shadow
  // needs room to spill, which is exactly what a plate shot at the box edge does not
  // have. Without threading `cameraMoves` the pad stays 0 and the shadow is clipped.
  const shadow = 'drop-shadow(0px 12px 24px #00000055)';
  const env = { stageW: 1920, stageH: 1080, cameras: [cam({ base: { x: 120 } })] };
  const still = plateWindowDemands([demandLayer({ shadowFilter: shadow })], GRID, 1000, env, false);
  const moving = plateWindowDemands([demandLayer({ shadowFilter: shadow })], GRID, 1000, env, true);
  assert.equal(still.get(0)?.pad, 0, 'the pre-104 reading: the plate keeps the shadow');
  assert.equal(moving.get(0)?.pad, spillPad(0, parseDropShadows(shadow)),
    'under a moving camera the compositor owns it, so the plate must make room');
});

test('section 5.5 bg-as-layer: the overscan is the camera\'s own reveal, derived not guessed', () => {
  // No camera → 0, and at 0 the bg plate is the artboard-sized canvas it always was
  // and the executor takes its untransformed full-canvas draw.
  assert.equal(bgOverscanPad(1920, 1080, GRID, { stageW: 1920, stageH: 1080 }), 0);
  assert.equal(bgOverscanPad(1920, 1080, GRID, { stageW: 1920, stageH: 1080, cameras: [] }), 0);

  // A PURE PAN reveals exactly its own displacement: the plane is the same size, just
  // somewhere else, so `pad = |camX|`.
  const pan = bgOverscanPad(1920, 1080, GRID, {
    stageW: 1920, stageH: 1080, cameras: [cam({ base: { x: 140 } })],
  });
  assert.ok(Math.abs(pan - 140) < 1e-9, `pure pan reveals |camX| (got ${pan})`);

  // A PULL-BACK shrinks the plane inside the frame and opens a gap at every edge at
  // once: `pad = (W/2)·(1/eff − 1)` on the wider axis. camZ = +1200 at P = 1200 is
  // eff = 1/2, so the artboard covers half the frame and the margin is a full W/2.
  const back = bgOverscanPad(1920, 1080, GRID, {
    stageW: 1920, stageH: 1080, cameras: [cam({ base: { z: 1200 } })],
  });
  assert.ok(Math.abs(back - 960) < 1e-6, `pull-back to eff 1/2 needs W/2 (got ${back})`);

  // …and a push-IN needs nothing: the plane is bigger than the frame, so there is no
  // reveal to cover and the pad must not grow for nothing.
  assert.equal(bgOverscanPad(1920, 1080, GRID, {
    stageW: 1920, stageH: 1080, cameras: [cam({ base: { z: -600 } })],
  }), 0);
});

test('contract: the executor PROJECTS the background rather than pinning it to the canvas', () => {
  // The defect this pins: the bg plate drew full-canvas and untransformed while every
  // layer above it was projected, so a pan slid the whole composition across frozen
  // wallpaper - the opposite of a camera move (section 5.5).
  const src = strip(read('./sequence-render.worker.ts'));
  assert.match(src, /if \(!camMoves && bgPad === 0\) \{\s*ctx\.drawImage\(job\.bg, 0, 0, job\.outW, job\.outH\);/,
    'with no camera it is byte-for-byte the one-line draw it always was');
  assert.match(src, /projectLayer\(view, \{ bx: view\.w \/ 2, by: view\.h \/ 2, z: 0 \}\)/,
    'and otherwise it is an implicit z = 0 layer through the SAME projection as every other');
  assert.match(strip(read('./sequence-render.ts')), /bgPad > 0 \? \{ pad: bgPad \} : \{\}/,
    'the plate is captured with the overscan, and with nothing when there is none');
});

test('section 5.5 the blur scratches are priced against the plate budget (P1 obligation 3)', () => {
  // They are pooled ACROSS layers and frames and `takeStage` RESIZES rather than
  // reallocating, so the peak is the single largest filtered layer - not their sum.
  const owned = { w: 640, h: 360, pad: 30, owned: true };
  const one = blurScratchNeedBytes([owned], 2);
  assert.ok(one > 0);
  assert.equal(blurScratchNeedBytes([owned, owned, owned], 2), one, 'pooled: the peak, not the sum');
  assert.ok(blurScratchNeedBytes([{ ...owned, w: 1920, h: 1080 }, owned], 2) > one, 'the largest sets it');
  // A render with no compositor-owned filter reserves nothing at all, which is every
  // export written before plans/104.
  assert.equal(blurScratchNeedBytes([{ w: 640, h: 360, pad: 30 }], 2), 0);
  assert.equal(blurScratchNeedBytes([], 2), 0);
  // …and the budget takes it off the top, so λ is turned by the whole memory picture.
  const layers = [{ idx: 0, kind: 'static' as const, w: 1920, h: 1080, maxEff: 3 }];
  const plain = planPlateBudget({ layers, scale: 2, worker: true, budgetBytes: 64 << 20 });
  const reserved = planPlateBudget({
    layers, scale: 2, worker: true, budgetBytes: 64 << 20, reserveBytes: 32 << 20,
  });
  assert.equal(plain.reservedBytes, 0);
  assert.equal(reserved.reservedBytes, 32 << 20);
  assert.ok(reserved.budgetBytes < plain.budgetBytes, 'the reserve comes off the plates\' allowance');
  assert.ok(reserved.bytes <= plain.bytes, 'so the plates degrade at least as far');
  // The reserve can never eat more than half, or a pathological blur would drive every
  // plate to the floor to rescue scratches their own caps already bound.
  const greedy = planPlateBudget({
    layers, scale: 2, worker: true, budgetBytes: 64 << 20, reserveBytes: 1 << 30,
  });
  assert.equal(greedy.reservedBytes, 32 << 20);
});

// ── the ingredient gather (plans/130) ───────────────────────────────────────
//
// The renderer cannot be run here, so what these pin is WHERE the gather sits and
// WHAT it is allowed to see. Its own behaviour - resolution order, the scan cap,
// the dedupe, the never-throws guarantee - is run for real against a signed
// fixture in sequence-ingredients.test.ts.

test('contract: the gather runs before every exit, not beside one', () => {
  // renderSequenceAuthored has five exits and the tilt capture tier takes the
  // earliest of them, before a single plate is photographed. There is no late point
  // common to all five, so anchoring the gather anywhere but the top covers one
  // path and silently drops the rest.
  const src = strip(read('./sequence-render.ts'));
  const call = 'await gatherStageIngredients(stage.layers, opts, host)';
  const gatherAt = src.lastIndexOf(call);
  assert.ok(gatherAt > 0, 'renderSequenceAuthored must gather its sources');
  for (const [what, exit] of [
    ['the tilt capture tier', 'return await renderTiltCapture(tilt)'],
    ['the GL composite', 'return await renderGlComposite('],
    ['the thread selection', 'supportsWorkerSequenceRender()'],
    ['the in-thread executor', 'return await renderInThread('],
  ] as Array<[string, string]>) {
    const at = src.indexOf(exit);
    assert.ok(at > 0, `${what} still exists`);
    assert.ok(gatherAt < at, `the gather must precede ${what}`);
  }
  // …and it is the FIRST thing after the stage guard, so nothing between the parse
  // and it can decide not to reach it.
  assert.match(src.slice(src.indexOf('async function renderSequenceAuthored'), gatherAt),
    /MAX_SEQUENCE_MS[\s\S]*$/, 'the gather sits immediately after the length ceiling');
});

test('contract: the audio-only export gathers the same sources', () => {
  // wav/mp3/m4a/opus leave through sequenceAudioPcm, not renderSequence, and are
  // stamped by the same renderFormat tail. Threading ingredients only through the
  // video path would credit the film and orphan its soundtrack.
  const src = strip(read('./sequence-render.ts'));
  const call = 'await gatherStageIngredients(stage.layers, opts, host)';
  assert.equal(src.split(call).length - 1, 2, 'both entry points gather, and only those two');
  const audioAt = src.indexOf('export async function sequenceAudioPcm');
  const firstGather = src.indexOf(call);
  assert.ok(audioAt > 0 && firstGather > audioAt && firstGather < src.indexOf('async function renderSequenceAuthored'),
    'the audio-only path gathers inside its own body');
});

test('contract: the gather sees every media box, not the mixer\'s or the worker\'s list', () => {
  // mixSequenceAudio skips muted, zero-length and speed-shifted clips - those still
  // put picture on the screen. The worker's `clips` holds only video layers visible
  // in the used grid - that drops every audio box, which is what this exists for.
  const src = strip(read('./sequence-render.ts'));
  const at = src.indexOf('async function gatherStageIngredients');
  assert.ok(at > 0, 'the helper exists');
  const body = src.slice(at, src.indexOf('\n}\n', at));
  assert.match(body, /L\.kind !== 'video' && L\.kind !== 'audio'/, 'both media kinds, and no other filter');
  for (const skip of ['L.mute', 'w.first', 'durMs', 'speed']) {
    assert.ok(!body.includes(skip), `the mixer's ${skip} skip must not become the ingredient filter`);
  }
  // The export bar's music bed is not a stage layer, so it is added by hand or it
  // travels uncredited.
  assert.match(body, /opts\.audio\?\.url/, 'the bed is a source');
  assert.match(body, /opts\.audio\?\.mix\?\.url/, 'and so is the mix-in track under it');
  // Gated on the stamp being wanted, and on nothing about the output format: gif
  // and apng sequences are stampable containers too.
  assert.match(body, /if \(!opts\.c2pa \|\| !opts\._ingredientSink\) return;/, 'one guard, the stamp itself');
  assert.ok(!/format/.test(body), 'the gather must not be gated on the output container');
  // The policy lives next door, where it can actually be tested.
  assert.match(src, /import \{ gatherSequenceIngredients, type SequenceIngredientSource \} from '\.\/sequence-ingredients\.ts';/,
    'the gather itself comes from sequence-ingredients.ts');
  assert.match(body, /gatherSequenceIngredients\(sources, opts\._ingredientSink,/, 'and writes into the sink renderFormat reads');
});

test('contract: SeqHost offers the credential lookup, optionally', () => {
  // A rendered document keeps no asset ids, so the id has to come back out of the
  // asset bridge's object-URL cache - and for an upload that lookup is the ONLY
  // route to its credential, since ingest re-encoded the pixels. Optional because
  // the host handed in is frequently null; its absence costs the byte-scan
  // fallback, never the export.
  const src = strip(read('./sequence-render.ts'));
  const iface = src.slice(src.indexOf('export interface SeqHost'), src.indexOf('// ── policy constants'));
  assert.match(iface, /assets\?: \{/, 'the surface is optional');
  assert.match(iface, /credential\?\(id: string\): Promise<\{ store: Uint8Array; format: string \} \| null>/,
    'and matches the AssetsAPI method it is typed down from');
  assert.match(src, /import \{ assetIdForUrl, MAX_CREDENTIAL_SCAN_BYTES \} from '\.\/assets\.ts';/,
    'the url→id reverse lookup and the scan cap both come from the asset bridge');
  assert.match(strip(read('./assets.ts')), /export function assetIdForUrl\(url: string\): string \| null/,
    'which is where that reverse lookup is owned');
});

test('contract: renderFormat folds the sink into the stamp after the render returns', () => {
  // The whole reason the gather can sit at the top of the renderer and still reach
  // the credential: `opts` is the same object, and the fold happens after dispatch.
  const exp = strip(read('./export.ts'));
  const dispatchAt = exp.indexOf('const blob = await renderFormatDispatch(node, format, opts);');
  const foldAt = exp.indexOf('opts._ingredientSink.filter((i) => !have.has(i.activeLabel))');
  assert.ok(dispatchAt > 0 && foldAt > dispatchAt, 'the sink is read after the render, not before');
  assert.match(exp, /if \(opts\.c2pa\) opts\._ingredientSink \?\?= \[\];/, 'and created before it, under c2pa only');
});

// ── Normalize loudness (plans/101 section 2.5): the mix-level pre-gain ─────────

test('normalizeMixGain: a -20 LKFS mix lifted to -14 is ~+6 dB; off and silence are 1', () => {
  const n = 48_000 * 3;
  const tone = new Float32Array(n);
  for (let i = 0; i < n; i++) tone[i] = 0.1 * Math.sin((2 * Math.PI * 997 * i) / 48_000);
  const spec = { clips: [{ pcm: [tone, tone], startMs: 0 }], beds: [] } as never;
  const g = normalizeMixGain(spec, n, -14);
  // The 997 Hz calibration: amp 0.1 in both channels reads -20 LKFS, so the
  // -14 target asks for +6 dB (block-boundary tolerance, same as the meter's).
  assert.ok(Math.abs(20 * Math.log10(g) - 6) < 0.3, `expected ~+6 dB, got ${(20 * Math.log10(g)).toFixed(2)}`);
  assert.equal(normalizeMixGain(spec, n, undefined), 1, 'off is exactly 1');
  const silent = { clips: [{ pcm: [new Float32Array(n), new Float32Array(n)], startMs: 0 }], beds: [] } as never;
  assert.equal(normalizeMixGain(silent, n, -14), 1, 'an unmeterable mix is left alone');
});

test('contract (plans/184 R1): a slide’s boxes are posed by the SAME rule the presenter uses, and the slide is re-shot while they move', () => {
  const src = strip(read('./sequence-render.ts'));
  const pm = strip(read('../views/present-mode.ts'));
  // One rule, two readers: both import poseSlideBoxes from lib/slide-pose.ts.
  assert.match(src, /import \{ poseSlideBoxes, type SlidePose \} from '\.\.\/lib\/slide-pose\.ts'/);
  assert.match(pm, /import \{ PENDING_MS, poseSlideBoxes \} from '\.\.\/lib\/slide-pose\.ts'/);
  assert.ok(!/appearModeOf/.test(pm), 'the presenter no longer keeps its own copy of the appear-mode mapping');
  // The film shows clicks from the start on the page’s own timeline window; the podium parks them.
  assert.match(src, /poseSlideBoxes\(L\.el, \{\s*reduced: false, clicks: 'show', pageStartMs: L\.startMs,\s*authoredPageStartMs: staged \? 0 : L\.startMs, pageDurMs: L\.durMs,\s*\}\)/);
  assert.match(pm, /poseSlideBoxes\(clone, \{ reduced, clicks: 'park', pageStartMs: 0, authoredPageStartMs: frameStartMs, pageDurMs: null \}\)/);
  // A staged click deck says so, and the compositor reads it (deck-as-sequence.ts writes it).
  assert.match(src, /const staged = stageEl\.hasAttribute\('data-deck-staged'\)/);
  assert.match(strip(read('../lib/deck-as-sequence.ts')), /set\(root, 'data-deck-staged', '1'\)/);
  // A posed slide is a live layer, its static plate is at rest with off-screen boxes hidden,
  // and everything is put back in the render’s outer finally.
  assert.match(src, /if \(slidePose && !liveBoxes\.has\(L\.idx\)\) \{\s*liveBoxes\.set\(L\.idx, \{ marker: null, box: el, hide: \[\] \}\);\s*needsLiveRaster = true;/);
  assert.match(src, /if \(slidePose\) plateHide = slideHiddenAt\(slidePose, slideRestMs\(slidePose, L\)\);\s*under = await rasterBox\(el, PS, plateHide, plateOpts\);/);
  assert.match(src, /slideStore\.restoreAll\(\);\s*for \(const pose of slidePoses\.values\(\)\) \{\s*for \(const b of pose\.boxes\) b\.classList\.remove\(OFF_CLASS\);\s*pose\.restore\(\);/);
});
