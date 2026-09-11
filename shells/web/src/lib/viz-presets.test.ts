// SPDX-License-Identifier: MPL-2.0
/**
 * Covers the visualizer's PURE half: brand-palette derivation (viz-palette.ts) and
 * preset construction (viz-presets.ts). The GL/audio half (butterchurn-viz.ts) needs
 * a real WebGL2 context and an AudioContext, so it isn't exercised here - it's
 * verified by opening the visualizer in a browser.
 *
 * The preset assertions matter more than they look: butterchurn calls a preset's
 * equations unguarded and merges whatever they return into its variable bag, so a
 * preset that returns undefined, forgets `pixel_eqs`, or emits an out-of-range
 * colour scalar fails at render time inside WebGL where the error is unreadable.
 * These run every preset's equations against plausible audio and assert the shape
 * butterchurn's renderer actually requires.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { hexToOklch } from '@lolly/engine';
import { buildVizPalette, hexToVizRgb, invalidateVizPalette, vizPalette, RAMP_STEPS } from './viz-palette.ts';
import {
  VIZ_PRESETS, accentAt, defaultVizPresetId, rampAt, vizPresetById, type MdVars,
} from './viz-presets.ts';

/** A brand with a dark base, two chromatic mids, and a pale tip - the shape the
 *  anchor picker is designed around. */
const SUSE_ISH = ['#0c322c', '#008878', '#30ba78', '#90ebcd', '#efefef'];

// ── palette ─────────────────────────────────────────────────────────────────

test('hexToVizRgb converts to butterchurn 0-1 scalars', () => {
  assert.deepEqual(hexToVizRgb('#000000'), [0, 0, 0]);
  assert.deepEqual(hexToVizRgb('#ffffff'), [1, 1, 1]);
  const mid = hexToVizRgb('#804000');
  assert.ok(mid);
  assert.ok(Math.abs(mid[0] - 128 / 255) < 1e-9);
  assert.equal(mid[2], 0);
});

test('hexToVizRgb rejects anything that is not a 6-digit hex', () => {
  for (const bad of ['', '#fff', 'red', 'oklch(0.5 0.1 200)', '#12345g', '#1234567']) {
    assert.equal(hexToVizRgb(bad), null, bad);
  }
});

test('buildVizPalette yields a full ramp with every channel in range', () => {
  const p = buildVizPalette(SUSE_ISH);
  assert.equal(p.ramp.length, RAMP_STEPS);
  for (const c of [...p.ramp, ...p.accents, p.deep, p.hero, p.tip]) {
    assert.equal(c.length, 3);
    for (const ch of c) {
      assert.ok(Number.isFinite(ch), `${ch} is not finite`);
      assert.ok(ch >= 0 && ch <= 1, `${ch} out of 0-1`);
    }
  }
});

test('the ramp runs dark to light', () => {
  const p = buildVizPalette(SUSE_ISH);
  const lum = (c: readonly number[]): number => 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
  assert.ok(lum(p.tip) > lum(p.deep), 'tip should be lighter than deep');
  assert.ok(lum(p.ramp[0]!) < lum(p.ramp[p.ramp.length - 1]!));
});

test('a tokenless or unusable brand still produces a usable palette', () => {
  for (const input of [[], ['not-a-colour'], ['#zzzzzz', 'transparent']]) {
    const p = buildVizPalette(input);
    assert.equal(p.ramp.length, RAMP_STEPS, JSON.stringify(input));
    assert.ok(p.accents.length >= 1);
  }
});

test('a monochrome brand keeps its own blacks and whites', () => {
  // Never invent a hue the brand does not own. An earlier version substituted a
  // synthetic teal here, which put a colour on screen that a black-and-white brand had
  // never asked for; a greyscale visualizer is the honest, on-brand result.
  for (const toks of [
    ['#000000', '#ffffff'],
    ['#000000', '#333333', '#777777', '#bbbbbb', '#ffffff'],
    ['#111111', '#888888', '#f5f5f5'],
  ]) {
    const p = buildVizPalette(toks);
    for (const c of p.ramp) {
      const spread = Math.max(...c) - Math.min(...c);
      assert.ok(spread < 0.06, `mono brand got a hued ramp step ${JSON.stringify(c)}`);
    }
    // Still needs the full tonal range for brandTone() to travel across.
    const lum = (c: readonly number[]): number => 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
    assert.ok(lum(p.tip) - lum(p.deep) > 0.5, `${JSON.stringify(toks)}: mono ramp is too flat`);
  }
});

test('only a brand with NOTHING usable gets the synthesised neutral', () => {
  // The invented palette is a last resort, not a preference - it must not pre-empt a
  // brand that does ship colours, however few or however dark.
  const empty = buildVizPalette([]);
  const midEmpty = empty.ramp[Math.floor(RAMP_STEPS / 2)]!;
  assert.ok(Math.max(...midEmpty) - Math.min(...midEmpty) > 0.02, 'the fallback should be chromatic');
  // …and it must not be any real brand's colours. SUSE's jungle must not appear.
  const suseJungle = hexToVizRgb('#30ba78')!;
  assert.notDeepEqual(empty.hero, suseJungle, 'the platform default must not be a brand colour');
});

test('a dark, desaturated brand primary is still honoured as the hero', () => {
  // Regression, and it cost a debugging round trip: SUSE's Pine (#0c322c) has OKLCH
  // chroma 0.0437, a hair under the 0.045 gate that keeps greys OUT OF THE RAMP. The
  // gate was also applied to the accent hint, so the brand's own declared primary was
  // dismissed as grey, the code fell through to most-chromatic, picked Waterhole blue
  // (0.2576) - and the entire visualizer rendered navy.
  const p = buildVizPalette(SUSE_FULL, '#0c322c');
  const pineHue = hexToOklch('#0c322c')!.h;
  assert.ok(hueGap(hueOf(p.hero), pineHue) < 20, `hero was ${JSON.stringify(p.hero)}, expected Pine's hue`);
  // Nothing in the ramp may have wandered to the blue side of the wheel.
  const blueHue = hexToOklch('#2453ff')!.h;
  for (const c of p.ramp) {
    if (Math.max(...c) - Math.min(...c) < 0.06) continue;
    assert.ok(hueGap(hueOf(c), blueHue) > 45, `ramp step ${JSON.stringify(c)} drifted towards blue`);
  }
});

/** OKLCH hue of a viz triple, for the hue-family assertions below. */
function hueOf(c: readonly number[]): number {
  const hex = `#${c.map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('')}`;
  return hexToOklch(hex)?.h ?? 0;
}
function hueGap(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
}

/** The full SUSE token set - deliberately spanning three distant hue families, which
 *  is what broke the first implementation. */
const SUSE_FULL = [
  '#0c322c', '#01564a', '#008878', '#30ba78', '#38d5b4', '#90ebcd', '#efefef',
  '#8e2810', '#bd3314', '#fe7c3f', '#192072', '#2453ff',
];

test('the ramp stays in ONE hue family - never interpolates green to blue through pink', () => {
  // The original bug: a perceptual ramp across the whole SUSE palette passes through
  // pink, so the visualizer read as nothing like the brand.
  const p = buildVizPalette(SUSE_FULL, '#30ba78');
  const heroHue = hueOf(p.hero);
  for (const c of p.ramp) {
    // Near-black/near-white ends carry little chroma and their hue is meaningless, so
    // only judge the steps that actually show a colour.
    const spread = Math.max(...c) - Math.min(...c);
    if (spread < 0.06) continue;
    assert.ok(hueGap(hueOf(c), heroHue) <= 60, `ramp step ${JSON.stringify(c)} left the family`);
  }
});

test('the hero is the brand accent, not merely the most chromatic swatch', () => {
  // SUSE's waterhole blue has higher OKLCH chroma than jungle green, so the
  // "most chromatic" heuristic picked blue and turned the whole visualizer blue.
  const p = buildVizPalette(SUSE_FULL, '#30ba78');
  assert.ok(hueGap(hueOf(p.hero), hueOf([0.19, 0.73, 0.47])) < 25, `hero was ${JSON.stringify(p.hero)}`);
  // With no hint it may fall back to chroma - but a hint must always win.
  const hinted = buildVizPalette(SUSE_FULL, '#2453ff');
  assert.ok(hueGap(hueOf(hinted.hero), hueOf([0.14, 0.33, 1])) < 25, 'an explicit hint must be honoured');
});

test('core accents are the brand family; off-family hues are demoted to support', () => {
  const p = buildVizPalette(SUSE_FULL, '#30ba78');
  const heroHue = hueOf(p.hero);
  assert.ok(p.accents.length >= 2, 'need a few tones to work with');
  for (const c of p.accents) {
    assert.ok(hueGap(hueOf(c), heroHue) <= 60, `accent ${JSON.stringify(c)} is off-family`);
  }
  // Persimmon and waterhole must still be REACHABLE - just not as effect fills.
  assert.ok(p.support.length >= 1, 'SUSE has off-family hues to support with');
  for (const c of p.support) {
    assert.ok(hueGap(hueOf(c), heroHue) > 45, `support ${JSON.stringify(c)} should be off-family`);
  }
});

test('core accents are separated by lightness, not repeated', () => {
  const p = buildVizPalette(SUSE_FULL, '#30ba78');
  const seen = new Set(p.accents.map((c) => c.join(',')));
  assert.equal(seen.size, p.accents.length, 'accents must be distinct');
  const lum = (c: readonly number[]): number => 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
  const lums = p.accents.map(lum).sort((a, b) => a - b);
  assert.ok(lums[lums.length - 1]! - lums[0]! > 0.2, 'accents should span a real tonal range');
});

test('the palette serves brands other than SUSE', () => {
  // This ships in the public, brand-agnostic web shell, so the derivation has to hold
  // up for any pack - not just the one it was developed against.
  // `hued` says whether this brand ships any real colour. A greyscale brand SHOULD get
  // a greyscale ramp - see the monochrome test - so only hued brands are asserted to
  // produce a hued ramp.
  const brands: Array<[string, string[], string | null, boolean]> = [
    ['purple, single hue', ['#1a0033', '#7b2ff7', '#c9a7ff'], '#7b2ff7', true],
    ['warm mono', ['#2b1608', '#c2410c', '#fed7aa'], '#c2410c', true],
    ['dark-primary brand', ['#0c322c', '#efefef'], '#0c322c', true],
    ['greyscale', ['#000000', '#444444', '#888888', '#cccccc', '#ffffff'], null, false],
    ['empty pack', [], null, true],
    ['two colours only', ['#123456', '#abcdef'], null, true],
  ];
  for (const [label, tokens, hint, hued] of brands) {
    const p = buildVizPalette(tokens, hint);
    assert.equal(p.ramp.length, RAMP_STEPS, label);
    assert.ok(p.accents.length >= 1, `${label}: needs at least one accent`);
    if (hued) {
      const mid = p.ramp[Math.floor(RAMP_STEPS / 2)]!;
      assert.ok(Math.max(...mid) - Math.min(...mid) > 0.02, `${label}: ramp middle is grey`);
    }
    // Dark→light range, so brandTone() has somewhere to travel.
    const lum = (c: readonly number[]): number => 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
    assert.ok(lum(p.tip) - lum(p.deep) > 0.2, `${label}: ramp has no tonal range`);
    // And when a hint is given, the ramp must follow THAT brand's hue.
    if (hint) {
      const want = hexToOklch(hint)?.h ?? 0;
      assert.ok(hueGap(hueOf(p.hero), want) < 25, `${label}: hero left the brand's hue`);
    }
  }
});

test('a single-hue brand still gets accents, and an empty support list', () => {
  const p = buildVizPalette(['#0c322c', '#30ba78', '#90ebcd'], '#30ba78');
  assert.ok(p.accents.length >= 2);
  // Nothing off-family to offer - every consumer must cope with support being empty.
  assert.equal(p.support.length, 0);
});

test('vizPalette caches per session and invalidates on request', async () => {
  invalidateVizPalette();
  let calls = 0;
  const host = {
    tokens: {
      colors: (): Promise<Array<{ value: string }>> => {
        calls++;
        return Promise.resolve(SUSE_ISH.map((value) => ({ value })));
      },
    },
  };
  const a = await vizPalette(host);
  const b = await vizPalette(host);
  assert.equal(calls, 1, 'second read should hit the cache');
  assert.deepEqual(a.ramp, b.ramp);
  invalidateVizPalette();
  await vizPalette(host);
  assert.equal(calls, 2);
  invalidateVizPalette();
});

test('vizPalette falls back rather than rejecting when tokens throw', async () => {
  invalidateVizPalette();
  const p = await vizPalette({ tokens: { colors: () => Promise.reject(new Error('no tokens')) } });
  assert.equal(p.ramp.length, RAMP_STEPS);
  invalidateVizPalette();
});

// ── ramp sampling ───────────────────────────────────────────────────────────

test('rampAt wraps and interpolates without leaving 0-1', () => {
  const p = buildVizPalette(SUSE_ISH);
  for (const t of [-3.7, -1, -0.01, 0, 0.5, 0.999, 1, 2.5, 1000.25]) {
    const c = rampAt(p, t);
    assert.equal(c.length, 3);
    for (const ch of c) assert.ok(ch >= 0 && ch <= 1 && Number.isFinite(ch), `t=${t} → ${ch}`);
  }
  // Wrapping means t and t+1 sample the same point.
  assert.deepEqual(rampAt(p, 0.3), rampAt(p, 1.3));
});

test('rampAt is continuous across the wrap seam', () => {
  const p = buildVizPalette(SUSE_ISH);
  const before = rampAt(p, 0.999);
  const after = rampAt(p, 0.001);
  // Not equal - but the step must be small, or the colour walk would visibly snap
  // once per cycle.
  const jump = Math.max(...before.map((v, i) => Math.abs(v - after[i]!)));
  assert.ok(jump < 0.35, `seam jump ${jump} too large`);
});

test('accentAt wraps in both directions', () => {
  const p = buildVizPalette(SUSE_ISH);
  const n = p.accents.length;
  assert.deepEqual(accentAt(p, 0), accentAt(p, n));
  assert.deepEqual(accentAt(p, 0), accentAt(p, -n));
  assert.deepEqual(accentAt(p, 1 - n), accentAt(p, 1));
});

// ── presets ─────────────────────────────────────────────────────────────────

/** Plausible mid-song variable bag. butterchurn seeds audio scalars near 1.0. */
function vars(over: Partial<MdVars> = {}): MdVars {
  return {
    time: 12.5, frame: 560, fps: 60,
    bass: 1.2, bass_att: 1.1, mid: 0.9, mid_att: 1.0, treb: 1.4, treb_att: 1.2,
    ...over,
  };
}

/** The audio states a preset has to survive: silence, average, and a loud transient. */
const AUDIO_CASES: Array<[string, Partial<MdVars>]> = [
  ['silence', { bass: 0, bass_att: 0, mid: 0, mid_att: 0, treb: 0, treb_att: 0 }],
  ['average', {}],
  ['loud', { bass: 4, bass_att: 3.5, mid: 3, mid_att: 2.8, treb: 5, treb_att: 4 }],
  ['boot', { time: 0, frame: 0 }],
];

test('every preset is registered with a unique id and a name', () => {
  const ids = new Set(VIZ_PRESETS.map((d) => d.id));
  assert.equal(ids.size, VIZ_PRESETS.length);
  for (const d of VIZ_PRESETS) {
    assert.ok(d.id && d.name, `${d.id} needs an id and a name`);
    assert.equal(typeof d.build, 'function');
  }
  assert.ok(VIZ_PRESETS.some((d) => d.calm), 'at least one preset must be calm enough for reduced motion');
});

test('presets are built as real functions, never equation source strings', () => {
  // This is the property that keeps the whole visualizer off `new Function`:
  // butterchurn only string-compiles a preset when `init_eqs` is NOT a function.
  const p = buildVizPalette(SUSE_ISH);
  for (const def of VIZ_PRESETS) {
    const preset = def.build(p);
    assert.equal(typeof preset.init_eqs, 'function', `${def.id} init_eqs`);
    assert.equal(typeof preset.frame_eqs, 'function', `${def.id} frame_eqs`);
    // pixel_eqs must be a function or the empty string - butterchurn tests for ''.
    assert.ok(typeof preset.pixel_eqs === 'function' || preset.pixel_eqs === '', `${def.id} pixel_eqs`);
    for (const key of ['init_eqs_str', 'frame_eqs_str', 'pixel_eqs_str']) {
      assert.ok(!(key in preset), `${def.id} must not carry ${key}`);
    }
  }
});

test('every preset carries real warp/comp GLSL', () => {
  // Regression: butterchurn's renderer does a bare `preset.warp.trim()` /
  // `preset.comp.trim()` with no guard, so a preset that omits either key throws inside
  // loadPreset before the first frame - a black canvas with no error near the cause.
  //
  // And they must be NON-EMPTY: '' selects butterchurn's built-in shader path, which is
  // the limited look this whole shader layer exists to get past.
  const p = buildVizPalette(SUSE_ISH);
  for (const def of VIZ_PRESETS) {
    const preset = def.build(p);
    assert.equal(typeof preset.warp, 'string', `${def.id} warp must be a string`);
    assert.equal(typeof preset.comp, 'string', `${def.id} comp must be a string`);
    // Guard against the level confusion: the numeric warp AMOUNT belongs in baseVals
    // and must not have leaked up to the shader-source field.
    assert.doesNotThrow(() => preset.warp.trim(), `${def.id} warp`);
    assert.doesNotThrow(() => preset.comp.trim(), `${def.id} comp`);
    assert.ok(preset.warp.includes('shader_body'), `${def.id} warp is not a real shader`);
    assert.ok(preset.comp.includes('shader_body'), `${def.id} comp is not a real shader`);
    // A custom warp REPLACES the built-in `* decay`, so every one must reapply it.
    assert.match(preset.warp, /\*\s*decay/, `${def.id} warp drops decay`);
    // The composite must re-derive colour through the brand ramp - that's what keeps
    // the picture on-brand whatever the feedback loop mixed.
    assert.ok(preset.comp.includes('brandTone('), `${def.id} comp is not brand-toned`);
  }
});

test('every preset feeds the shader q-vars its equations promise', () => {
  // The shaders read q1 (exposure), q2 (echo) and q3 (warp gain). An unset q arrives at
  // the uniform as 0 via `mdVSFrame.q1 || 0`, so a preset that forgets them silently
  // loses its audio reactivity in the shader rather than failing.
  const p = buildVizPalette(SUSE_ISH);
  for (const def of VIZ_PRESETS) {
    const preset = def.build(p);
    for (const [label, over] of AUDIO_CASES) {
      const m = preset.frame_eqs({ ...vars(over), ...preset.baseVals } as MdVars);
      for (const q of ['q1', 'q2', 'q3']) {
        assert.equal(typeof m[q], 'number', `${def.id}/${label} ${q} unset`);
        assert.ok(Number.isFinite(m[q] as number), `${def.id}/${label} ${q} not finite`);
      }
      // Exposure is added to a 0-1 intensity in the shader; a wild value blows it out.
      const q1 = m.q1 as number;
      assert.ok(q1 >= 0 && q1 <= 2, `${def.id}/${label} exposure ${q1} out of range`);
    }
  }
});

test('presets differ in TECHNIQUE, not merely in parameters', () => {
  // The point of the shader layer: switching preset should change the KIND of image, not
  // its settings. Classified off each shader's BODY (the shared header declares every
  // helper, so matching the whole source would classify everything identically).
  const p = buildVizPalette(SUSE_ISH);
  const body = (src: string): string => src.slice(src.indexOf('shader_body'));
  const warpOf = (src: string): string => {
    const b = body(src);
    if (/lolBlurGradient\(/.test(b)) return 'watercolour';
    if (/lolVolNoise\(/.test(b)) return 'volume';
    if (/sampler_fw_main/.test(b)) return 'tile';
    if (/normalize\(uv - 0\.5/.test(b)) return 'radial';
    if (/lolNoise\(n/.test(b)) return 'flow';
    return 'plain';
  };
  const compOf = (src: string): string => {
    const b = body(src);
    if (/sharpL/.test(b)) return 'watercolour';
    if (/nrm =/.test(b)) return 'bump';
    if (/uv_echo/.test(b)) return 'echo';
    if (/for \(int i/.test(b)) return 'streak';
    if (/cloud =/.test(b)) return 'clouds';
    if (/floor\(uv \* n\)/.test(b)) return 'mosaic';
    if (/lolRelief\(/.test(b)) return 'relief';
    if (/lolEdge\(/.test(b)) return 'edge';
    if (/dir \* amt/.test(b)) return 'prism';
    return 'tone';
  };
  const counts = new Map<string, string[]>();
  for (const def of VIZ_PRESETS) {
    const preset = def.build(p);
    const inv = /e = 1\.0 - e;/.test(body(preset.comp)) ? '+inv' : '';
    const sol = /\(1\.0 - e\) \* 4\.0/.test(body(preset.comp)) ? '+sol' : '';
    const key = `${warpOf(preset.warp)}/${compOf(preset.comp)}${inv}${sol}`;
    counts.set(key, [...(counts.get(key) ?? []), def.name]);
  }
  // A broad vocabulary rather than one technique parameterised many ways.
  assert.ok(counts.size >= 9, `only ${counts.size} distinct techniques across ${VIZ_PRESETS.length} presets`);
  // No pairing may be over-used. Three is the tolerated maximum, and it is deliberate:
  // Brand Pulse (the default), Drift (calm, audio-independent geometry) and one other can
  // legitimately share flow+tone because their ROLES differ.
  for (const [key, names] of counts) {
    assert.ok(names.length <= 3, `${names.length} presets share ${key}: ${names.join(', ')}`);
  }
  // At least one preset must invert, and at least one solarize - the tonal curves are a
  // whole axis of variety and it should not quietly go unused.
  assert.ok([...counts.keys()].some((k) => k.includes('+inv')), 'no preset inverts');
  assert.ok([...counts.keys()].some((k) => k.includes('+sol')), 'no preset solarizes');
});

test('every preset declares exactly four shape and four wave slots', () => {
  // Regression: the renderer allocates `range(4)` custom shapes/waveforms ONCE and
  // then iterates those, indexing `preset.shapes[i]` / `preset.waves[i]`. Declare
  // fewer and it hands `undefined` to the draw call and throws mid-frame, killing
  // the render loop - another silent black screen. Unused slots are `enabled: 0`.
  const p = buildVizPalette(SUSE_ISH);
  for (const def of VIZ_PRESETS) {
    const preset = def.build(p);
    assert.equal(preset.shapes.length, 4, `${def.id} shapes`);
    assert.equal(preset.waves.length, 4, `${def.id} waves`);
    for (const part of [...preset.shapes, ...preset.waves]) {
      assert.equal(typeof part.baseVals.enabled, 'number', `${def.id} slot needs an explicit enabled`);
    }
  }
});

test('authored slots survive padding and padded ones stay inert', () => {
  // Asserts the INVARIANT, not the counts: how many rings Bloom draws is a design
  // choice that should be free to change without editing a test.
  const p = buildVizPalette(SUSE_ISH);
  for (const def of VIZ_PRESETS) {
    const preset = def.build(p);
    for (const kind of ['shapes', 'waves'] as const) {
      const parts = preset[kind];
      const enabled = parts.filter((s) => s.baseVals.enabled !== 0);
      const inert = parts.filter((s) => s.baseVals.enabled === 0);
      assert.equal(enabled.length + inert.length, 4, `${def.id} ${kind}`);
      // Authored (enabled) parts come first, so padding never displaces one.
      const firstInert = parts.findIndex((s) => s.baseVals.enabled === 0);
      if (firstInert !== -1) {
        assert.ok(parts.slice(firstInert).every((s) => s.baseVals.enabled === 0),
          `${def.id} ${kind}: enabled slots must precede padding`);
      }
      // A padded slot carries nothing but its disabled flag.
      for (const s of inert) assert.deepEqual(Object.keys(s.baseVals), ['enabled'], `${def.id} ${kind} padding`);
    }
    for (const w of preset.waves) {
      assert.ok(w.point_eqs === '' || typeof w.point_eqs === 'function', `${def.id} wave point_eqs`);
    }
  }
});

test('every preset paints a brand ground so the field is not black', () => {
  // The complaint that started this: MilkDrop's field is black unless geometry puts
  // colour in it, and shapes draw under the waveform - so slot 0 is a full-bleed
  // brand gradient. Assert every preset has one, and that it actually covers the
  // frame (a radius that only reaches ~0.71 would leave visible corners).
  const p = buildVizPalette(SUSE_ISH);
  for (const def of VIZ_PRESETS) {
    const ground = def.build(p).shapes[0]!;
    assert.notEqual(ground.baseVals.enabled, 0, `${def.id} needs an enabled ground`);
    assert.ok((ground.baseVals.rad ?? 0) >= 1, `${def.id} ground must overflow the frame`);
    // Never opaque: an opaque ground would wipe the decay trails every frame and
    // flatten the feedback loop the whole look depends on.
    const m = ground.frame_eqs({ ...vars(), ...ground.baseVals } as MdVars);
    assert.ok((m.a as number) > 0 && (m.a as number) < 0.95, `${def.id} ground alpha ${String(m.a)}`);
    // And it must be brand-coloured, not grey.
    const rgb = [m.r, m.g, m.b] as number[];
    assert.ok(Math.max(...rgb) - Math.min(...rgb) > 0.02, `${def.id} ground should carry brand hue`);
  }
});

test('presets fill the screen: real feedback, no dark centre', () => {
  // The parameters that actually cause MilkDrop's screen-filling look. The first pass
  // failed the user's eye on exactly these, so they're pinned.
  const p = buildVizPalette(SUSE_ISH);
  for (const def of VIZ_PRESETS) {
    const preset = def.build(p);
    const b = preset.baseVals;
    assert.ok((b.decay ?? 0) >= 0.94, `${def.id} decay ${String(b.decay)} kills trails too fast`);
    assert.notEqual(b.darken_center, 1, `${def.id} darken_center punches a hole in the middle`);
    const m = preset.frame_eqs({ ...vars(), ...b } as MdVars);
    // Something has to move the field every frame - zoom off 1, or rotation.
    const zoom = (m.zoom ?? b.zoom ?? 1) as number;
    const rot = Math.abs((m.rot ?? b.rot ?? 0) as number);
    assert.ok(Math.abs(zoom - 1) > 0.0005 || rot > 0.0005, `${def.id} field is static`);
  }
});

test('every enabled shape and wave carries the callbacks the renderer calls unguarded', () => {
  const p = buildVizPalette(SUSE_ISH);
  for (const def of VIZ_PRESETS) {
    const preset = def.build(p);
    assert.ok(Array.isArray(preset.shapes), `${def.id} shapes must be an array`);
    assert.ok(Array.isArray(preset.waves), `${def.id} waves must be an array`);
    for (const part of [...preset.shapes, ...preset.waves]) {
      // frame_eqs is invoked without a guard for enabled parts; init_eqs is guarded
      // but we supply it anyway.
      assert.equal(typeof part.frame_eqs, 'function', `${def.id} part frame_eqs`);
      assert.equal(typeof part.init_eqs, 'function', `${def.id} part init_eqs`);
      assert.equal(typeof part.baseVals, 'object');
    }
    for (const w of preset.waves) {
      assert.ok(w.point_eqs === '' || typeof w.point_eqs === 'function', `${def.id} wave point_eqs`);
    }
  }
});

test('frame equations return the variable bag and keep colours in 0-1', () => {
  const p = buildVizPalette(SUSE_ISH);
  const colourKeys = [
    'wave_r', 'wave_g', 'wave_b', 'ob_r', 'ob_g', 'ob_b',
    'ib_r', 'ib_g', 'ib_b', 'mv_r', 'mv_g', 'mv_b',
  ];
  for (const def of VIZ_PRESETS) {
    const preset = def.build(p);
    for (const [label, over] of AUDIO_CASES) {
      const m = preset.frame_eqs({ ...vars(over), ...preset.baseVals } as MdVars);
      assert.ok(m && typeof m === 'object', `${def.id}/${label} must return the bag`);
      for (const k of colourKeys) {
        if (!(k in m)) continue;
        const v = m[k];
        assert.equal(typeof v, 'number', `${def.id}/${label} ${k} not a number`);
        assert.ok(Number.isFinite(v as number) && (v as number) >= 0 && (v as number) <= 1,
          `${def.id}/${label} ${k} = ${String(v)} out of 0-1`);
      }
      // Alpha and the geometry knobs must stay finite too - a NaN zoom blanks the
      // render silently rather than throwing.
      for (const k of ['zoom', 'warp', 'rot', 'wave_a', 'wave_scale', 'decay', 'mv_a', 'dx', 'dy']) {
        if (k in m) assert.ok(Number.isFinite(m[k] as number), `${def.id}/${label} ${k} not finite`);
      }
    }
  }
});

test('pixel equations stay finite across the whole frame', () => {
  const p = buildVizPalette(SUSE_ISH);
  for (const def of VIZ_PRESETS) {
    const preset = def.build(p);
    if (typeof preset.pixel_eqs !== 'function') continue;
    for (const rad of [0, 0.5, 1, 1.5]) {
      for (const ang of [0, Math.PI, -Math.PI]) {
        const m = preset.pixel_eqs({ ...vars(), ...preset.baseVals, rad, ang } as MdVars);
        assert.ok(m && typeof m === 'object');
        assert.ok(Number.isFinite(m.warp as number), `${def.id} warp at rad=${rad}`);
      }
    }
  }
});

test('shape equations keep radius and alpha sane under a bass transient', () => {
  const p = buildVizPalette(SUSE_ISH);
  for (const def of VIZ_PRESETS) {
    const preset = def.build(p);
    for (const shape of preset.shapes) {
      for (const [label, over] of AUDIO_CASES) {
        const m = shape.frame_eqs({ ...vars(over), ...shape.baseVals } as MdVars);
        const rad = m.rad as number | undefined;
        const a = m.a as number | undefined;
        if (rad !== undefined) {
          assert.ok(Number.isFinite(rad) && rad > 0, `${def.id}/${label} rad=${String(rad)}`);
        }
        if (a !== undefined) {
          assert.ok(Number.isFinite(a) && a >= 0 && a <= 1, `${def.id}/${label} a=${String(a)}`);
        }
      }
    }
  }
});

test('the calm preset does not move its geometry with the audio', () => {
  // Drift is what reduced-motion users get; if bass moved its zoom or warp it would
  // lurch, which is exactly what they asked not to have.
  const p = buildVizPalette(SUSE_ISH);
  const drift = VIZ_PRESETS.find((d) => d.id === 'drift');
  assert.ok(drift, 'drift preset must exist');
  const preset = drift.build(p);
  const quiet = preset.frame_eqs({ ...vars({ bass: 0, bass_att: 0, treb_att: 0, mid_att: 0 }), ...preset.baseVals } as MdVars);
  const loud = preset.frame_eqs({ ...vars({ bass: 5, bass_att: 4, treb_att: 4, mid_att: 4 }), ...preset.baseVals } as MdVars);
  for (const k of ['zoom', 'warp', 'rot', 'dx', 'dy']) {
    assert.deepEqual(quiet[k], loud[k], `${k} must not react to audio in the calm preset`);
  }
  assert.notDeepEqual(quiet.wave_a, loud.wave_a, 'alpha SHOULD still respond');
});

test('presets read the brand: a different palette gives different colours', () => {
  const suse = buildVizPalette(SUSE_ISH);
  const other = buildVizPalette(['#1a0033', '#7b2ff7', '#f72585', '#ffd6e8']);
  for (const def of VIZ_PRESETS) {
    const a = def.build(suse).frame_eqs({ ...vars(), ...def.build(suse).baseVals } as MdVars);
    const b = def.build(other).frame_eqs({ ...vars(), ...def.build(other).baseVals } as MdVars);
    const differs = ['wave_r', 'wave_g', 'wave_b', 'mv_r', 'mv_g', 'mv_b', 'ob_r', 'ob_g', 'ob_b']
      .some((k) => k in a && k in b && a[k] !== b[k]);
    assert.ok(differs, `${def.id} should render different colours for a different brand`);
  }
});

// ── lookup + defaults ───────────────────────────────────────────────────────

test('vizPresetById falls back to the default for unknown or missing ids', () => {
  assert.equal(vizPresetById('pulse').id, 'pulse');
  for (const bad of [null, undefined, '', 'nope', '__proto__', 'constructor']) {
    assert.equal(vizPresetById(bad).id, VIZ_PRESETS[0]!.id, String(bad));
  }
});

test('defaultVizPresetId prefers a calm preset under reduced motion', () => {
  assert.equal(defaultVizPresetId(false), VIZ_PRESETS[0]!.id);
  const calm = vizPresetById(defaultVizPresetId(true));
  assert.ok(calm.calm, 'reduced motion must open on a calm preset');
});
