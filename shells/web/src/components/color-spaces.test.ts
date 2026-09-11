// SPDX-License-Identifier: MPL-2.0
/**
 * Unit tests for the colour picker's space registry. DOM-free - the module never
 * touches document, which is the point of splitting it out of color-field.ts.
 * Run directly:  node --test shells/web/src/components/color-spaces.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseColor, convertColor, colorToHexString, SRGB_SOURCE, BEYOND_TIER, gamutTierProbe } from '@lolly/engine';
import type { GamutSource } from '@lolly/engine';
import {
  colorSpaces, getColorSpace, composeColor, decomposeColor, channelRuns, pinValue,
  spaceExactness, spaceText, spaceParse, slugMode, notationHasAlpha,
  registerColorProfile, unregisterColorProfile,
  type ChannelSpec,
} from './color-spaces.ts';

/** Max per-component difference between two colours, compared in sRGB. */
function srgbDelta(a: Parameters<typeof convertColor>[0], b: Parameters<typeof convertColor>[0]): number {
  const x = convertColor(a, 'srgb').components;
  const y = convertColor(b, 'srgb').components;
  return Math.max(...x.map((v, i) => Math.abs(v - (y[i] ?? 0))));
}

test('the eleven built-ins register in family order', () => {
  assert.deepEqual(colorSpaces().map(s => s.mode), [
    'oklch', 'oklab', 'lch', 'lab', 'xyz-d65',   // perceptual
    'hex', 'rgb', 'hsl',                          // device
    'display-p3', 'rec2020', 'cmyk',              // output
  ]);
  // The two judgement calls. XYZ says 'reference' on screen; bare CMYK says
  // nothing on screen - a name is the claim, so the space with no profile behind
  // it carries no name, and the qualification reaches AT through `ariaSuffix`.
  assert.equal(getColorSpace('xyz-d65')!.sub, 'reference');
  assert.equal(getColorSpace('cmyk')!.sub, undefined);
  assert.equal(getColorSpace('cmyk')!.ariaSuffix, 'no profile');
});

test('compose(decompose(c)) is the same colour, in every registered space', () => {
  const subject = parseColor('#3c7a9f')!;
  for (const spec of colorSpaces()) {
    const vals = decomposeColor(spec, subject, 200);
    const back = composeColor(spec, vals, subject.alpha);
    assert.ok(srgbDelta(subject, back) < 1e-6, `${spec.mode} round trip drifted`);
  }
});

test('a grey keeps the remembered hue rather than reading one out of noise', () => {
  const grey = parseColor('#808080')!;
  // OKLCH and LCH mark the powerless hue as component 2, HSL as component 0 - 
  // decomposeColor derives the flag from the channel's index, so all three work.
  for (const mode of ['oklch', 'lch', 'hsl'] as const) {
    const spec = getColorSpace(mode)!;
    assert.equal(decomposeColor(spec, grey, 217).h, 217, `${mode} lost the hue memory`);
  }
  // A colour that HAS a hue reports its own, never the memory.
  const green = parseColor('#30ba78')!;
  assert.ok(Math.abs(decomposeColor(getColorSpace('oklch')!, green, 217).h! - 217) > 10);
});

test('a chroma track is truncated by the gamut it is measured against', () => {
  const oklch = getColorSpace('oklch')!;
  const chroma = { ...oklch.channels[1]!, stops: 24 };
  const at = { l: 90, c: 0.2, h: 140 };   // a light green - where the gamuts differ most
  // Only the TIER-0 runs are what the limit can show. The list now covers the whole
  // axis (the rest are the onion-ring washes), so summing every run would total 1
  // under every limit and measure nothing.
  const total = (limit: 'srgb' | 'rec2020'): number =>
    channelRuns({ ...oklch, limit }, chroma, at)
      .filter(r => r.tier === 0)
      .reduce((t, r) => t + (r.to - r.from), 0);
  const srgb = total('srgb');
  const wide = total('rec2020');
  assert.ok(srgb > 0, 'the grey axis is inside every gamut, so a run must exist');
  assert.ok(srgb < 1, 'a light green cannot hold 0.4 chroma in sRGB');
  assert.ok(wide > srgb, `Rec.2020 must reach further than sRGB (${wide} vs ${srgb})`);
});

test('the runs cover the whole axis, and adjacent ones share a boundary EXACTLY', () => {
  // Contiguity is pinned because it is easy to lose: refining each run's own two
  // edges independently (which is what this replaced) lands the two estimates of one
  // boundary up to a tolerance apart, and CSS then interpolates an alpha fade across
  // that sliver - a soft, wrong-looking gamut edge where the whole purpose of the
  // bisection was to sharpen it.
  const oklch = getColorSpace('oklch')!;
  const vals = decomposeColor(oklch, parseColor('oklch(62% 0.19 260)')!, 260);
  for (const limit of ['srgb', 'p3', 'rec2020'] as const) {
    for (const ch of oklch.channels) {
      const runs = channelRuns({ ...oklch, limit }, ch, vals, 1);
      assert.ok(runs.length >= 1, `${limit}/${ch.ch} has no runs at all`);
      assert.equal(runs[0]!.from, 0, `${limit}/${ch.ch} does not start at 0`);
      assert.equal(runs[runs.length - 1]!.to, 1, `${limit}/${ch.ch} does not end at 1`);
      for (let i = 0; i + 1 < runs.length; i++) {
        assert.equal(runs[i]!.to, runs[i + 1]!.from,
          `${limit}/${ch.ch} runs ${i}/${i + 1} disagree about their shared boundary`);
        assert.notEqual(runs[i]!.tier, runs[i + 1]!.tier, 'adjacent runs must differ in tier');
      }
    }
  }
});

test('an unreachable stretch is a RING, ranked by membership, not a hole', () => {
  // The point of the whole exercise: what the limit cannot show is still painted, at
  // the tier of the narrowest gamut that CAN - so the band a wider screen would carry
  // reads brighter than the band nothing carries.
  const oklch = getColorSpace('oklch')!;
  const chroma = { ...oklch.channels[1]!, stops: 24 };
  const at = { l: 65, c: 0.2, h: 29 };            // through the P3 red corner
  const tiers = (limit: 'srgb' | 'rec2020'): number[] =>
    channelRuns({ ...oklch, limit }, chroma, at).map(r => r.tier);
  const srgb = tiers('srgb');
  assert.deepEqual(srgb.slice(0, 2), [0, 1],
    `past sRGB the axis enters the first ring before anything else: ${srgb.join(',')}`);
  assert.equal(srgb[srgb.length - 1], BEYOND_TIER, 'chroma 0.4 at this hue is past every gamut');
  // A second ring appears where a second gamut genuinely adds reach. On THIS chroma
  // axis it does not - at hue 29 Rec.2020 stops short of P3's red corner, so the axis
  // goes from ring 1 straight to beyond, which is the truth and not a missing case.
  // The hue axis at a chroma both wider gamuts can partly hold shows all four.
  const hue = { ...oklch.channels[2]!, stops: 24, hold: undefined };
  const sweep = channelRuns(oklch, hue, { l: 60, c: 0.22, h: 0 }).map(r => r.tier);
  for (const ring of [0, 1, 2, BEYOND_TIER]) {
    assert.ok(sweep.includes(ring), `expected a tier ${ring} around the hue circle: ${sweep.join(',')}`);
  }
  // Every ring carries colours to paint - a tierless hole is what this replaced.
  for (const r of channelRuns(oklch, chroma, at)) {
    assert.ok(r.stops.length >= 1 && r.stops.every(s => typeof s === 'string' && s.length > 0));
    // …and a wash is capped at three, because 24 stops across a faint low-contrast
    // band is most of the cost for none of the information.
    if (r.tier !== 0) assert.ok(r.stops.length <= 3, `a wash carried ${r.stops.length} stops`);
  }
  // Under Rec.2020 the P3-only region is still a ring rather than "beyond" - the
  // membership question, asked of P3, not an index into an ordering.
  assert.ok(tiers('rec2020').every(t => t === 0 || t === 2 || t === BEYOND_TIER),
    `Rec.2020 cannot produce a tier 1 (its own subset answers 0): ${tiers('rec2020').join(',')}`);
});

test('a ring on a two-stop channel has real WIDTH and lands where the tier changes', () => {
  // `stops` is a paint density, and it used to double as the tier sweep - so the 15
  // channels declaring `stops: 2` (hex/RGB/P3/Rec.2020 components, Lab/LCH/OKLab L,
  // HSL S - both DEFAULT tabs among them) were classified from frac 0 and frac 1 alone.
  // Two consequences, both pinned here: the single bracket was the whole axis, so a
  // fixed halving count left the edge off by up to 25% of the track and often produced
  // `from === to` - a ring computed and then painted as nothing; and a band neither
  // endpoint landed in was invisible however hard the edge was refined.
  const truth = (spec: Parameters<typeof channelRuns>[0], ch: ChannelSpec, vals: Record<string, number>) => {
    const probe = gamutTierProbe(spec.limit);
    const out: { tier: number; from: number; to: number }[] = [];
    const N = 2000;
    for (let i = 0; i < N; i++) {
      const f = i / (N - 1);
      const c = convertColor(composeColor(spec, { ...vals, [ch.ch]: ch.min + f * (ch.max - ch.min) }, 1), 'oklch');
      const t = probe(c.components[0]!, c.components[1]!, c.components[2]!);
      const open = out[out.length - 1];
      if (open && open.tier === t) open.to = f; else out.push({ tier: t, from: f, to: f });
    }
    return out.filter(r => r.to - r.from > 0.02);          // bands a sweep can be expected to see
  };
  const cases: [string, string, string][] = [
    ['hex', 'g', 'color(display-p3 1 0 0)'],               // 10.7 points out before
    ['hex', 'r', 'oklch(17.3% 0.353 254.6)'],              // ring lost entirely before
    ['rgb', 'g', 'oklch(47.0% 0.293 131.8)'],              // three bands, one seen before
    ['lch', 'l', 'oklch(62% 0.19 260)'],                   // seven bands, four seen before
  ];
  for (const [mode, chName, seed] of cases) {
    const spec = getColorSpace(mode)!;
    const ch = spec.channels.find(c => c.ch === chName)!;
    assert.equal(ch.stops, 2, `${mode}/${chName} is the two-stop case this test is about`);
    const vals = decomposeColor(spec, parseColor(seed)!, 200);
    const runs = channelRuns(spec, ch, vals, 1);
    for (const r of runs) {
      assert.ok(r.to - r.from > 1e-9,
        `${mode}/${chName} tier ${r.tier} came back zero-width: ${JSON.stringify(runs)}`);
    }
    // Every band the axis really carries is painted, at its tier, over nearly all of
    // its true extent. Stated as overlap rather than as a run list, because a band
    // thinner than a sample step may legitimately be missing (or present, and then it
    // splits a run in two) - that is the documented sub-sample limit, not this defect.
    for (const band of truth(spec, ch, vals)) {
      const covered = runs
        .filter(r => r.tier === band.tier)
        .reduce((t, r) => t + Math.max(0, Math.min(r.to, band.to) - Math.max(r.from, band.from)), 0);
      const width = band.to - band.from;
      assert.ok(covered / width > 0.85,
        `${mode}/${chName}: tier ${band.tier} over ${band.from.toFixed(3)}–${band.to.toFixed(3)} is ` +
        `${(100 * covered / width).toFixed(0)}% painted - ${JSON.stringify(runs.map(r => [r.tier, r.from, r.to]))}`);
    }
  }
});

test('a run leaves gaps where the axis is not displayable', () => {
  const oklch = getColorSpace('oklch')!;
  const hue = { ...oklch.channels[2]!, stops: 24, hold: undefined };
  // High chroma at mid lightness fits some hues and not others, so the hue track
  // becomes several arcs - the shape that tells you where you can go.
  const runs = channelRuns(oklch, hue, { l: 60, c: 0.15, h: 0 });
  const solid = runs.filter(r => r.tier === 0);
  assert.ok(solid.length >= 2, `expected several arcs, got ${solid.length}`);
  assert.ok(runs.every(r => r.stops.length >= 1));
  // The arcs are separated by washes, not by holes.
  assert.ok(runs.length > solid.length, 'the unreachable stretches must be painted too');
});

test('exactness is a bounded-space question, not a gamut one', () => {
  const p3red = parseColor('color(display-p3 1 0 0)')!;
  assert.equal(spaceExactness(getColorSpace('hex')!, p3red), 'approx');
  assert.equal(spaceExactness(getColorSpace('rgb')!, p3red), 'approx');
  assert.equal(spaceExactness(getColorSpace('hsl')!, p3red), 'approx');
  assert.equal(spaceExactness(getColorSpace('display-p3')!, p3red), 'exact');
  // The perceptual spaces are unbounded, so they can always state it exactly - 
  // which is why the picker's canonical value can now be a P3 colour at all.
  for (const mode of ['oklch', 'oklab', 'lch', 'lab', 'xyz-d65'] as const) {
    assert.equal(spaceExactness(getColorSpace(mode)!, p3red), 'exact', mode);
  }
});

test('the value field accepts any CSS colour, whatever space is active', () => {
  const oklch = getColorSpace('oklch')!;
  // A hex pasted while OKLCH is active used to be silently held as unparseable.
  assert.equal(spaceText(getColorSpace('hex')!, spaceParse(oklch, '#30ba78')!), '#30ba78');
  // Wide-gamut and perceptual notations land in their authored space.
  assert.equal(spaceParse(getColorSpace('hex')!, 'color(display-p3 1 0 0)')!.space, 'display-p3');
  assert.equal(spaceParse(getColorSpace('rgb')!, 'oklch(62% 0.11 250)')!.space, 'oklch');
  assert.equal(spaceParse(oklch, 'rebeccapurple')!.space, 'srgb');
  // The bare component list the picker used to speak still works, per space.
  assert.deepEqual(spaceParse(oklch, '62% 0.11 250')!.components, [0.62, 0.11, 250]);
  assert.deepEqual(spaceParse(getColorSpace('rgb')!, '255, 0, 0')!.components, [1, 0, 0]);
  // Alpha rides along.
  assert.equal(spaceParse(oklch, '62% 0.11 250 / 0.5')!.alpha, 0.5);
  // CMYK has no CSS notation, so it reads back its own.
  const cmyk = getColorSpace('cmyk')!;
  assert.equal(spaceText(cmyk, spaceParse(cmyk, 'cmyk(40% 0% 30% 10%)')!), 'cmyk(40% 0% 30% 10%)');
  assert.equal(spaceParse(oklch, ''), null);
  assert.equal(spaceParse(oklch, 'not a colour'), null);
});

test('a value field states the colour in its own sliders\' units', () => {
  const green = parseColor('#30ba78')!;
  // RGB's sliders are 0–255, so its text is too. It used to fall through to
  // `color(srgb 0.188235 …)`, stating one colour in two unit systems in one panel.
  assert.equal(spaceText(getColorSpace('rgb')!, green), 'rgb(48 186 120)',
    "RGB's text must speak the 0–255 its sliders and readouts speak");
  assert.ok(srgbDelta(spaceParse(getColorSpace('rgb')!, 'rgb(48 186 120)')!, green) < 1e-9,
    "RGB's own text must read back as the same colour");
  // Out of sRGB it stays unclamped, matching the (clamped-slider, unclamped-readout)
  // convention - rgb() parses an out-of-range component as-is, so this round-trips.
  const p3red = parseColor('color(display-p3 1 0 0)')!;
  const wide = spaceText(getColorSpace('rgb')!, p3red);
  assert.match(wide, /^rgb\(278\.73 -57\.82 -38\.28\)$/);
  assert.ok(srgbDelta(spaceParse(getColorSpace('rgb')!, wide)!, p3red) < 1e-4,
    "RGB's unclamped text must still read back as the colour it states");
  // Alpha rides along in both, so text copied out of the field keeps its opacity - 
  // CMYK dropped it entirely.
  assert.equal(spaceText(getColorSpace('rgb')!, parseColor('#3c7a9f40')!), 'rgb(60 122 159 / 0.251)');
  assert.equal(spaceText(getColorSpace('cmyk')!, parseColor('#3c7a9f40')!), 'cmyk(62% 23% 0% 38% / 0.251)');
  assert.equal(spaceParse(getColorSpace('cmyk')!, 'cmyk(62% 23% 0% 38% / 0.251)')!.alpha, 0.251,
    'CMYK must read its own alpha back');
});

test('the HSL tab states a saturation hsl() can actually reproduce', () => {
  const hsl = getColorSpace('hsl')!;
  // srgbToHsl reports the TRUE saturation of a wider colour (152% for P3 red) while
  // hsl() clamps s/l on the way in, so an unclamped string is a notation no consumer
  // - this field included - resolves to the colour shown. Clamp the DISPLAY only.
  const shown = spaceText(hsl, parseColor('color(display-p3 1 0 0)')!);
  const nums = (shown.match(/[\d.]+(?=%)/g) ?? []).map(Number);
  assert.equal(nums.length, 2, `expected s% and l% in ${shown}`);
  assert.ok(nums.every(n => n <= 100), `hsl() cannot reproduce ${shown}`);
  // …so retyping the field's own text lands on the colour that text describes.
  const back = spaceParse(hsl, shown)!;
  assert.ok(srgbDelta(back, spaceParse(hsl, spaceText(hsl, back))!) < 1e-9,
    "the HSL tab's text must be a fixed point - retyping it must not move the colour");
  // An in-gamut colour is untouched by the clamp and round-trips exactly.
  assert.equal(colorToHexString(spaceParse(hsl, spaceText(hsl, parseColor('#30ba78')!))!), '#30ba78');
});

test('pinValue tolerates conversion noise: plain white is inside every space', () => {
  // Lab/LCH L convert to 100.00000139, Rec.2020 R to 255.00000000000006, XYZ Z to
  // 1.08905775 - float noise and a rounded axis ceiling, not an excursion. An
  // untoleranced compare flagged all four, so the caution line said "Outside Lab"
  // for a colour spaceExactness (BOUNDS_SLACK 1e-4) calls exact, with the flagged
  // readout printing the in-range bound.
  for (const seed of ['#ffffff', 'white', 'color(srgb 1 1 1)', 'oklch(100% 0 0)']) {
    const c = parseColor(seed)!;
    for (const spec of colorSpaces()) {
      const vals = decomposeColor(spec, c, 250);
      for (const ch of spec.channels) {
        const { at, pinned } = pinValue(ch, vals[ch.ch] ?? ch.min);
        assert.equal(pinned, false, `${seed} reported outside ${spec.mode} on ${ch.ch} (${vals[ch.ch]})`);
        assert.ok(at >= ch.min && at <= ch.max, `${spec.mode}/${ch.ch} must still land a legal slider value`);
      }
      assert.equal(spaceExactness(spec, c), 'exact', `${spec.mode} disagrees with the pin`);
    }
  }
  // A GENUINE excursion still pins: P3 red's blue is -1.39 of 255 in Rec.2020.
  const rec = getColorSpace('rec2020')!;
  const p3 = decomposeColor(rec, parseColor('color(display-p3 1 0 0)')!, 250);
  assert.equal(pinValue(rec.channels[2]!, p3.b!).pinned, true, 'a real out-of-range value must still pin');
});

test('a run reaches the gamut edge, so the thumb never stands on emptiness', () => {
  // Runs used to end at the last IN-GAMUT SAMPLE, leaving every edge short by up to
  // one step (4.3% of the track at 24 stops). At #/lab's own default the L track
  // stopped at 60.87% with the thumb at 62% and the note reading "exact".
  const oklch = getColorSpace('oklch')!;
  const seed = parseColor('oklch(62% 0.19 260)')!;
  const vals = decomposeColor(oklch, seed, 260);
  for (const ch of oklch.channels) {
    const runs = channelRuns(oklch, ch, vals, 1);
    const frac = ((vals[ch.ch] ?? ch.min) - ch.min) / (ch.max - ch.min);
    // The thumb must sit in a REACHABLE run, not merely in some run - every axis is
    // fully covered now, so "in a run" no longer says anything.
    assert.ok(runs.some(r => r.tier === 0 && r.from - 1e-9 <= frac && frac <= r.to + 1e-9),
      `the ${ch.ch} thumb at ${frac.toFixed(4)} sits outside the reachable band: ${JSON.stringify(runs.map(r => [r.from, r.to, r.tier]))}`);
    // And no run is a zero-width sliver - a single reachable sample used to paint
    // as literally nothing.
    for (const r of runs) assert.ok(r.to > r.from, `${ch.ch} has a zero-width run at ${r.from}`);
  }
  // The refined edge is close to the truth, not a sample position: the L axis holds
  // 0.19 chroma at hue 260 up to L ≈ 0.645, which no 24-sample grid lands on.
  const l = channelRuns(oklch, oklch.channels[0]!, vals, 1).filter(r => r.tier === 0);
  assert.ok(Math.abs((l[0]?.to ?? 0) - 0.645) < 0.005, `L run ends at ${l[0]?.to}, not ~0.645`);
});

test('notationHasAlpha reads the intent off the NOTATION, not off alpha === 1', () => {
  // The parsers default a missing alpha to 1, so the value field cannot tell "#30ba78
  // says nothing about opacity" (inherit the slider's) from "#30ba78ff says be
  // opaque" (an instruction) without looking at the text.
  for (const stated of ['#30ba78ff', '30ba78ff', '#3bad', 'rgb(255 0 0 / 100%)', 'rgba(1,2,3,1)',
    'oklch(70% 0.1 200 / 1)', 'color(srgb 1 0 0 / 1)', '62% 0.11 250 / 0.5', 'cmyk(0% 0% 0% 0% / 0.5)']) {
    assert.equal(notationHasAlpha(stated), true, `${stated} states an alpha`);
  }
  for (const silent of ['#30ba78', '30ba78', '#3ba', 'rgb(1 2 3)', 'rgba(1,2,3)', 'oklch(70% 0.1 200)',
    'rebeccapurple', '62% 0.11 250', '']) {
    assert.equal(notationHasAlpha(silent), false, `${silent} states no alpha`);
  }
});

test('a profile x intent is one registry entry, added and removed at runtime', () => {
  const inks: ChannelSpec[] = ['c', 'm', 'y', 'k'].map(ch => ({
    ch, label: ch.toUpperCase(), aria: ch, min: 0, max: 100, step: 1,
    fmt: (v: number) => `${Math.round(v)}%`, stops: 7,
  }));
  // A stand-in source: the id carries the intent, which is what makes profile x
  // intent naturally one key rather than an enum edit.
  const src: GamutSource = {
    id: 'icc:ab12cd:perceptual',
    label: 'Coated FOGRA39 (perceptual)',
    contains: (l, c, h) => SRGB_SOURCE.contains(l, c, h),
    inkCoverage: () => 2.4,
  };
  // A stand-in for the profile's own transform. Required, because a tab wearing a
  // profile's name has to state that profile's numbers: a bare naive substitution
  // under a measured name is the thing this parameter exists to make impossible.
  const device = {
    toLab: (dev: readonly number[]): [number, number, number] =>
      [100 - (dev[3] ?? 0) * 100, (dev[0] ?? 0) * 60 - 30, (dev[2] ?? 0) * 60 - 30],
    fromLab: (lab: readonly [number, number, number]): number[] =>
      [(lab[1] + 30) / 60, 0, (lab[2] + 30) / 60, 1 - lab[0] / 100],
  };
  const before = colorSpaces().length;
  registerColorProfile(src, inks, device);
  const spaces = colorSpaces();
  assert.equal(spaces.length, before + 1);
  const spec = spaces[spaces.length - 1]!;
  assert.equal(spec.mode, 'icc:ab12cd:perceptual');
  assert.equal(spec.family, 'output', 'a profile lands in the Output family, last');
  assert.equal(spec.label, 'CMYK');
  assert.equal(spec.sub, 'Coated FOGRA39 · perceptual');
  assert.equal(spec.limit, src, 'the limit IS the source, so inGamut works on the press');
  assert.equal(spec.channels.length, 4);
  // The broken-track machinery needs no extra code path for a press profile.
  assert.ok(channelRuns(spec, spec.channels[0]!, { c: 0, m: 0, y: 0, k: 0 }).length >= 1);
  // Selector-hostile colons become dashes for the tab/panel ids.
  assert.equal(slugMode(spec.mode), 'icc-ab12cd-perceptual');

  // The tab converts through the PROFILE, not through the naive CMYK the bare tab
  // uses: a drag on any channel is that file's answer, and it round-trips.
  const round = decomposeColor(spec, composeColor(spec, { c: 50, m: 0, y: 25, k: 20 }, 1), 0);
  assert.ok(Math.abs((round.c ?? 0) - 50) < 1e-6 && Math.abs((round.k ?? 0) - 20) < 1e-6,
    `the profile's own transform round-trips: ${JSON.stringify(round)}`);
  // …and the values are not thrown away. This composed to pure black for every
  // channel count but four, so one arrow key destroyed the colour.
  const composed = composeColor(spec, { c: 100, m: 0, y: 0, k: 0 }, 1);
  assert.ok(composed.components.some(v => Math.abs(v) > 1e-6), 'a channel value reaches the colour');

  unregisterColorProfile(src.id);
  assert.equal(colorSpaces().length, before);
  assert.equal(getColorSpace(src.id), undefined);
  // Built-ins are not removable through the profile door.
  unregisterColorProfile('cmyk');
  assert.ok(getColorSpace('cmyk'), 'cmyk survived');
});
