// SPDX-License-Identifier: MPL-2.0
/*
 * gamut-slider.ts - the broken OKLCH axis, and the onion rings on it.
 *
 * Run directly:  node --test shells/web/src/lib/gamut-slider.test.ts
 *
 * What matters here is that this surface and the picker's tracks share ONE tier
 * model (engine/src/gamut-tier.ts): a stretch the limit cannot show is still
 * painted, at the tier of the narrowest gamut that CAN show it. Written after the
 * fact - the module had no coverage at all - so it pins the intent rather than the
 * numbers: the opacities live in CSS tokens and are meant to be tuned.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

const dom = new JSDOM('<!doctype html><html><body><div id="mount"></div></body></html>', {
  url: 'http://localhost/',
});
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Element = dom.window.Element;

const { gamutRuns, renderGamutSlider, paintGamutSlider, channelRange } = await import('./gamut-slider.ts');
const { BEYOND_TIER, inGamut, maxChroma, chromaAxisMax, GAMUTS } = await import('@lolly/engine');
import type { GamutSliderState } from './gamut-slider.ts';

/** A chroma axis at a mid-lightness blue: reachable near grey, then out. */
const CHROMA: GamutSliderState = { channel: 'c', base: { l: 0.62, c: 0.19, h: 260 }, limit: 'srgb' };
/** A hue axis at a chroma some hues hold and others do not. */
const HUE: GamutSliderState = { channel: 'h', base: { l: 0.6, c: 0.22, h: 0 }, limit: 'srgb' };

test('a run carries HOW FAR out it is, not merely that it is out', () => {
  const runs = gamutRuns(CHROMA);
  assert.ok(runs.length >= 2, 'the axis must break somewhere');
  assert.equal(runs[0]!.tier, 0, 'the axis starts at grey, which every gamut holds');
  assert.ok(runs.some(r => r.tier > 0), 'and the unreachable part is a RING, not a hole');
  // Every run still carries colours to paint across it - a wash shades in the
  // direction the axis is going rather than flat-lining at the boundary colour.
  for (const r of runs) {
    assert.ok(r.to > r.from, 'no zero-width runs');
    assert.ok(r.stops.length >= 1 && r.stops.every(s => /^#[0-9a-f]{6}$/i.test(s)), JSON.stringify(r.stops));
  }
  // Contiguous, so the axis reads as one axis.
  for (let i = 0; i + 1 < runs.length; i++) assert.equal(runs[i]!.to, runs[i + 1]!.from);
});

test('the tiers come from membership, so sRGB is never a ring under a P3 limit', () => {
  // Same rule the classifier is pinned on in tests/gamut-tier.test.ts, asserted
  // through this surface: a true subset answers tier 0 and can never be a wash.
  for (const r of gamutRuns({ ...HUE, limit: 'p3' })) {
    if (r.tier === 0) continue;
    const mid = (r.from + r.to) / 2 * 360;
    assert.equal(inGamut(HUE.base.l, HUE.base.c, mid, 'srgb'), false,
      `hue ${mid.toFixed(0)}° is inside sRGB, so it cannot be a ring under a P3 limit`);
  }
  // Under sRGB the same axis shows more than one ring - the onion.
  const tiers = new Set(gamutRuns(HUE).map(r => r.tier));
  assert.ok(tiers.has(1) && tiers.has(2), `expected two rings, got ${[...tiers].join(',')}`);
  assert.ok(tiers.has(BEYOND_TIER), 'and hues no display holds at this chroma');
});

test('a segment states its ring as a CSS token, and tier 0 states nothing', () => {
  const root = document.getElementById('mount')!;
  root.innerHTML = renderGamutSlider('gs', HUE, 200);
  paintGamutSlider(root.querySelector('.gsl')!, HUE, 200);
  const segs = [...root.querySelectorAll<HTMLElement>('.gsl-seg')];
  assert.ok(segs.length >= 3, `expected several segments, got ${segs.length}`);
  const solid = segs.filter(s => !s.style.getPropertyValue('--seg-a'));
  const washed = segs.filter(s => s.style.getPropertyValue('--seg-a'));
  assert.ok(solid.length >= 1, 'the reachable arcs carry no alpha override at all');
  assert.ok(washed.length >= 1, 'the unreachable ones do');
  // The VALUE is a var() into the shared scale, never a number baked in here: the
  // wash brightness is a design judgement, tunable in styles/tokens.css.
  for (const s of washed) {
    assert.match(s.style.getPropertyValue('--seg-a'), /^var\(--track-tier-(\d+|beyond),/);
    assert.ok(!/opacity/.test(s.getAttribute('style') ?? ''), 'no literal opacity on the element');
  }
  // …and more than one distinct ring is named across the axis.
  const named = new Set(washed.map(s => s.style.getPropertyValue('--seg-a')));
  assert.ok(named.size >= 2, `expected different rings, got ${[...named].join(' / ')}`);
  // The out-of-gamut MARK is about the current value, not about the axis, and it
  // stays exactly as it was.
  assert.equal(root.querySelector('.gsl')!.classList.contains('is-out'),
    !inGamut(HUE.base.l, HUE.base.c, 200, 'srgb'));
});

test('a P3 display paints its P3 rings opaque and in true colour; sRGB keeps the wash', () => {
  // The blue chroma axis leaves sRGB but is still inside P3 for a stretch. On a P3
  // screen that stretch is real colour, not a hint.
  const p3runs = gamutRuns({ ...CHROMA, displayGamut: 'p3' });
  const shownRings = p3runs.filter(r => r.displayable && r.tier > 0);
  assert.ok(shownRings.length >= 1, 'a ring sRGB cannot show but P3 can is now displayable');
  for (const r of shownRings) {
    assert.ok(r.stops.every(s => s.startsWith('oklch(')),
      `a displayable run is emitted in the display gamut (CSS oklch), not sRGB hex: ${JSON.stringify(r.stops)}`);
  }
  // Colours no ladder gamut holds are never called displayable, even on a P3 screen.
  assert.ok(p3runs.filter(r => r.tier === BEYOND_TIER).every(r => !r.displayable),
    'BEYOND is never displayable');

  // The SAME axis on an sRGB screen: no out-of-sRGB ring is displayable, and every
  // washed run stays sRGB hex - the honest wash the module has always painted.
  const srgbRuns = gamutRuns({ ...CHROMA, displayGamut: 'srgb' });
  for (const r of srgbRuns) {
    if (r.tier > 0) assert.equal(r.displayable, false, 'an sRGB screen cannot truthfully show a ring');
    if (!r.displayable) assert.ok(r.stops.every(s => /^#[0-9a-f]{6}$/i.test(s)), 'washed runs stay hex');
  }

  // No displayGamut at all ⇒ nothing is displayable: byte-for-byte the old behaviour.
  assert.ok(gamutRuns(CHROMA).every(r => !r.displayable), 'no display info ⇒ no override');
});

test('paint: on a P3 display exactly the non-displayable rings carry a --seg-a wash', () => {
  const state: GamutSliderState = { ...CHROMA, displayGamut: 'p3' };
  const runs = gamutRuns(state);
  assert.ok(runs.some(r => r.displayable && r.tier > 0), 'the fixture has an opaque P3 ring to prove');
  const washedRuns = runs.filter(r => r.tier !== 0 && !r.displayable).length;

  const root = document.createElement('div');
  root.innerHTML = renderGamutSlider('p3s', state, CHROMA.base.c);
  paintGamutSlider(root, state, CHROMA.base.c);
  const washedSegs = [...root.querySelectorAll<HTMLElement>('.gsl-seg')]
    .filter(s => s.style.getPropertyValue('--seg-a')).length;
  assert.equal(washedSegs, washedRuns, 'a displayable P3 ring is opaque; only beyond-P3 rings wash');
});

test('the wash opacity defaults to fully opaque, for the non-gamut sliders', () => {
  // views/color-lab.ts hand-builds a .gsl-seg for the blend-steps gradient preview.
  // It is not a gamut axis and must not be washed, which is why `.gsl-seg` reads
  // `opacity: var(--seg-a, 100%)` rather than defaulting to a wash.
  const css = readFileSync(new URL('./oklch-slice.css', import.meta.url), 'utf8');
  assert.match(css, /opacity:\s*var\(--seg-a,\s*100%\)/, 'the 100% default keeps the blend preview opaque');
  assert.ok(!/gsl-seg--ghost/.test(css), 'the single flat ghost class is retired');
});

test('a chroma slider reaches exactly as far as its gamut, in both directions', () => {
  // The old flat 0.4 was wrong twice over: it stops short of Rec.2020's real reach
  // (so the widest colours could not be dialled in at all) and runs a quarter past
  // sRGB's (so a quarter of the travel did nothing but repeat the boundary colour).
  // Asserted against maxChroma, not against literals.
  for (const g of GAMUTS) {
    const max = channelRange('c', chromaAxisMax(g)).max;
    let peak = 0;
    for (let i = 1; i < 100; i++) {
      for (let h = 0; h < 360; h += 2) peak = Math.max(peak, maxChroma(i / 100, h, g));
    }
    assert.ok(max > peak, `${g}: a chroma slider stopping at ${max} cannot reach ${peak}`);
    assert.ok(max < peak * 1.2, `${g}: ${max} leaves dead travel above ${peak}`);
  }
  // Not stated per name: a narrower gamut simply gets a shorter axis.
  assert.ok(channelRange('c', chromaAxisMax('srgb')).max < channelRange('c', chromaAxisMax('rec2020')).max);
});

test('a slider with no explicit cMax takes its ceiling from its limit', () => {
  const mount = document.getElementById('mount')!;
  const state: GamutSliderState = { channel: 'c', base: { l: 0.7, c: 0.2, h: 328 }, limit: 'srgb' };
  mount.innerHTML = renderGamutSlider('c', state, 0.2);
  const input = mount.querySelector('input')!;
  assert.equal(input.max, String(chromaAxisMax('srgb')));
  // Repainting under a WIDER limit moves the bounds with it, so a repaint without a
  // rebuild cannot leave the thumb on the old scale while the track shows the new.
  paintGamutSlider(mount, { ...state, limit: 'rec2020' }, 0.45);
  assert.equal(input.max, String(chromaAxisMax('rec2020')));
  assert.equal(input.value, '0.45');
});

test('a chroma value past the axis stretches it instead of being clamped away', () => {
  // A range input cannot hold a value above its own `max`, so any ceiling that could
  // sit below the value is a value-destroying ceiling: the thumb pins at the end and
  // reports a colour it is not on. Chroma's ceiling is an axis CHOICE, not a bound,
  // so it gives. Lightness and hue have real ends and do not.
  const mount = document.getElementById('mount')!;
  const state: GamutSliderState = { channel: 'c', base: { l: 0.5, c: 0.7, h: 328 }, limit: 'srgb' };
  mount.innerHTML = renderGamutSlider('c', state, 0.7);
  const input = mount.querySelector('input')!;
  assert.ok(Number(input.max) >= 0.7, `the axis holds the value, max ${input.max}`);
  assert.equal(input.value, '0.7');
  // The runs are built from the same stretched ceiling, so the track behind the thumb
  // is on the thumb's scale: the last segment must end at the track's end.
  paintGamutSlider(mount, state, 0.7);
  assert.ok(Number(input.max) >= 0.7, `the repaint keeps the reach, max ${input.max}`);
  const segs = [...mount.querySelectorAll<HTMLElement>('.gsl-seg')];
  const last = segs[segs.length - 1]!;
  const end = parseFloat(last.style.left) + parseFloat(last.style.width);
  assert.ok(Math.abs(end - 100) < 0.01, `the painted track spans the whole axis, ended at ${end}%`);

  // Back inside, the axis returns to the gamut's own ceiling.
  paintGamutSlider(mount, state, 0.2);
  assert.equal(input.max, String(chromaAxisMax('srgb')));
  assert.equal(input.value, '0.2');
});
