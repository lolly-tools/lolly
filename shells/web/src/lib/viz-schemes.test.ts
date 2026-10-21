// SPDX-License-Identifier: MPL-2.0
/**
 * Covers colour-scheme derivation (lib/viz-schemes.ts).
 *
 * The governing rule is the one that keeps this safe: a RAMP never crosses hue families
 * (interpolating green→blue→orange is what produced the off-brand pinks), while the
 * CONTRAST colour deliberately does come from a distant hue because it's drawn as a
 * separate role rather than blended into the ramp. Both halves are asserted here - a
 * regression in either direction is invisible in code and obvious on screen.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { hexToOklch } from '@lolly/engine';
import { deriveVizSchemes, nextVizSchemeId, randomVizSchemeId, vizSchemeById, vizLeads, vizSchemes, invalidateVizSchemes, type VizLead } from './viz-schemes.ts';

/** SUSE: three supporting greens, plus persimmon / waterhole / midnight to contrast. */
const SUSE = [
  '#0c322c', '#01564a', '#008878', '#30ba78', '#38d5b4', '#90ebcd', '#efefef',
  '#8e2810', '#bd3314', '#fe7c3f', '#192072', '#2453ff',
];
const SUSE_NAMES = [
  'Pine', 'Pine 6', 'Pine 4', 'Jungle', 'Pine 3', 'Mint', 'Fog',
  'Persimmon 8', 'Persimmon 6', 'Persimmon', 'Midnight', 'Waterhole',
];

function hueOf(c: readonly number[]): number {
  const hex = `#${c.map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('')}`;
  return hexToOklch(hex)?.h ?? 0;
}
function hueGap(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
}

test('a rich brand yields several distinct schemes', () => {
  const s = deriveVizSchemes(SUSE, SUSE_NAMES, '#30ba78');
  assert.ok(s.length >= 3, `expected several schemes, got ${s.length}`);
  assert.equal(new Set(s.map((x) => x.id)).size, s.length, 'ids must be unique');
  // Distinct FIELDS, not just distinct labels - two schemes on the same hue are one.
  const hues = s.map((x) => hueOf(x.palette.hero));
  for (let i = 0; i < hues.length; i++) {
    for (let j = i + 1; j < hues.length; j++) {
      assert.ok(hueGap(hues[i]!, hues[j]!) >= 40, `schemes ${i}/${j} share a hue family`);
    }
  }
});

test('the brand accent leads, even when another pairing scores higher', () => {
  // SUSE is a green brand. Persimmon/Waterhole is the punchiest pairing it can make, but
  // opening on it would be a striking picture of the wrong brand.
  const s = deriveVizSchemes(SUSE, SUSE_NAMES, '#30ba78');
  assert.ok(hueGap(hueOf(s[0]!.palette.hero), hexToOklch('#30ba78')!.h) < 45,
    `expected a green-family scheme first, got ${s[0]!.name}`);
});

test('each scheme contrasts its field with a genuinely distant hue', () => {
  for (const sc of deriveVizSchemes(SUSE, SUSE_NAMES, '#30ba78')) {
    const gap = hueGap(hueOf(sc.palette.hero), hueOf(sc.palette.contrast));
    assert.ok(gap >= 60, `${sc.name}: contrast only ${gap.toFixed(0)}° from the field`);
  }
});

test('but the RAMP never crosses hue families', () => {
  // The rule that prevents the pink. Contrast sits BESIDE the ramp, never inside it.
  for (const sc of deriveVizSchemes(SUSE, SUSE_NAMES, '#30ba78')) {
    const heroHue = hueOf(sc.palette.hero);
    for (const c of sc.palette.ramp) {
      const spread = Math.max(...c) - Math.min(...c);
      if (spread < 0.06) continue;   // near-neutral ends carry no meaningful hue
      assert.ok(hueGap(hueOf(c), heroHue) <= 60,
        `${sc.name}: a ramp step drifted out of the family`);
    }
  }
});

test('a field hero is mid-toned - never near-white or near-black', () => {
  // Chroma alone picks the dark brick over Persimmon; a linear lightness bonus then
  // over-corrects to Mint. Both were real, and both look wrong as a field.
  for (const sc of deriveVizSchemes(SUSE, SUSE_NAMES, '#30ba78')) {
    const hex = `#${sc.palette.hero.map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('')}`;
    const l = hexToOklch(hex)!.l;
    assert.ok(l > 0.35 && l < 0.85, `${sc.name}: hero lightness ${l.toFixed(2)} is unusable as a field`);
  }
});

test('a single-hue brand gets exactly one scheme, not a fabricated pairing', () => {
  const s = deriveVizSchemes(['#1a0033', '#7b2ff7', '#c9a7ff'], undefined, '#7b2ff7');
  assert.equal(s.length, 1);
  assert.equal(s[0]!.score, 0, 'a lone family has no counterpoint to score');
});

test('a monochrome brand yields one scheme and stays monochrome', () => {
  const s = deriveVizSchemes(['#000000', '#888888', '#ffffff']);
  assert.equal(s.length, 1);
  for (const c of s[0]!.palette.ramp) {
    assert.ok(Math.max(...c) - Math.min(...c) < 0.06, 'a mono brand must not gain a hue');
  }
});

test('an empty brand still yields a usable scheme', () => {
  const s = deriveVizSchemes([]);
  assert.equal(s.length, 1);
  assert.ok(s[0]!.palette.ramp.length > 0);
});

test('scheme lookup and cycling are total', () => {
  const s = deriveVizSchemes(SUSE, SUSE_NAMES, '#30ba78');
  for (const bad of [null, undefined, '', 'nope', '__proto__']) {
    assert.equal(vizSchemeById(s, bad).id, s[0]!.id, String(bad));
  }
  // Cycling visits every scheme and returns to the start.
  const seen = new Set<string>();
  let id = s[0]!.id;
  for (let i = 0; i < s.length; i++) {
    seen.add(id);
    id = nextVizSchemeId(s, id);
  }
  assert.equal(seen.size, s.length, 'cycling must reach every scheme');
  assert.equal(id, s[0]!.id, 'and wrap back to the first');
  // An unknown current id must not wedge the cycle.
  assert.ok(s.some((x) => x.id === nextVizSchemeId(s, 'unknown')));
});

test('random cycling always moves, and stays within the brand', () => {
  const s = deriveVizSchemes(SUSE, SUSE_NAMES, '#30ba78');
  const ids = new Set(s.map((x) => x.id));
  for (let i = 0; i < 200; i++) {
    const next = randomVizSchemeId(s, s[0]!.id);
    // Never the same one - a cycle that appears to do nothing reads as broken.
    assert.notEqual(next, s[0]!.id);
    assert.ok(ids.has(next), `random picked an unknown scheme: ${next}`);
  }
  // With one scheme there is nowhere to go, and that must not throw or return undefined.
  const one = deriveVizSchemes(['#1a0033', '#7b2ff7', '#c9a7ff'], undefined, '#7b2ff7');
  assert.equal(randomVizSchemeId(one, one[0]!.id), one[0]!.id);
  assert.equal(randomVizSchemeId([], 'x'), 'x');
});

test('the ramp bottoms out near black so contrast comes from its own range', () => {
  // Andy: black is fine, majority black is not - ramping down to it in the right places
  // is where the punch comes from. A ramp that floors at a mid-dark tone has no deep end.
  for (const sc of deriveVizSchemes(SUSE, SUSE_NAMES, '#30ba78')) {
    const lum = (c: readonly number[]): number => 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
    assert.ok(lum(sc.palette.deep) < 0.06, `${sc.name}: dark end ${lum(sc.palette.deep).toFixed(3)} is not deep enough`);
    assert.ok(lum(sc.palette.tip) > 0.45, `${sc.name}: light end is too dim to contrast with it`);
    // …but still the brand's colour, not neutral black.
    assert.ok(Math.max(...sc.palette.deep) - Math.min(...sc.palette.deep) > 0.002,
      `${sc.name}: the dark end lost its hue entirely`);
  }
});

test('scheme ids are stable for a given brand', () => {
  // They're persisted, so a re-derivation must not invalidate a saved choice.
  const a = deriveVizSchemes(SUSE, SUSE_NAMES, '#30ba78').map((s) => s.id);
  const b = deriveVizSchemes(SUSE, SUSE_NAMES, '#30ba78').map((s) => s.id);
  assert.deepEqual(a, b);
});

test('schemes carry readable names, using the brand\'s own labels when it has them', () => {
  const named = deriveVizSchemes(SUSE, SUSE_NAMES, '#30ba78');
  assert.ok(named.some((s) => /Jungle/.test(s.name)), `expected a Jungle scheme, got ${named.map((s) => s.name).join(', ')}`);
  // Without labels it must still produce something human, not a hex code.
  for (const s of deriveVizSchemes(SUSE, undefined, '#30ba78')) {
    assert.ok(!/#|[0-9a-f]{6}/i.test(s.name), `unlabelled brand produced a raw name: ${s.name}`);
  }
});

// ── Authored leads replace the guess (plans/319) ─────────────────────────────

/** Three colourways, in the design system's order, canonical first. */
const LEADS: VizLead[] = [
  { id: 'jungle', name: 'Jungle', hex: '#30ba78', partner: '#fe7c3f' },
  { id: 'persimmon', name: 'Persimmon', hex: '#fe7c3f', partner: '#2453ff' },
  { id: 'waterhole', name: 'Waterhole', hex: '#2453ff', partner: '#30ba78' },
];

test('two or more authored leads become one scheme each, in the design system\'s order, named after the colourway', () => {
  const s = deriveVizSchemes(SUSE, SUSE_NAMES, '#30ba78', LEADS);
  assert.deepEqual(s.map((x) => [x.id, x.name]), [
    ['colourway-jungle', 'Jungle'], ['colourway-persimmon', 'Persimmon'], ['colourway-waterhole', 'Waterhole'],
  ]);
  // Each field is the lead itself, and the counterpoint is that colourway's own partner.
  for (const [i, lead] of LEADS.entries()) {
    const hero = s[i]!.palette.hero;
    assert.ok(hueGap(hueOf(hero), hexToOklch(lead.hex)!.h) < 30, `${lead.name}'s field is its own lead`);
    assert.ok(hueGap(hueOf(s[i]!.palette.contrast), hexToOklch(lead.partner!)!.h) < 10, `${lead.name}'s counterpoint is its partner`);
  }
  // The ids follow the colourway, not its colour, so a re-tuned lead keeps its stored scheme.
  const retuned = deriveVizSchemes(SUSE, SUSE_NAMES, '#30ba78', [{ ...LEADS[0]!, hex: '#2fb070' }, ...LEADS.slice(1)]);
  assert.deepEqual(retuned.map((x) => x.id), s.map((x) => x.id));
});

test('a partner too close to its lead hands the counterpoint to the best of the other leads', () => {
  const s = deriveVizSchemes(SUSE, SUSE_NAMES, null, [{ ...LEADS[0]!, partner: '#2fb57a' }, LEADS[1]!]);
  assert.ok(hueGap(hueOf(s[0]!.palette.contrast), hexToOklch('#fe7c3f')!.h) < 10, 'Persimmon stands in for the near-twin partner');
});

test('an ink-dark lead hands the field to its own partner and keeps its colourway\'s name', () => {
  const s = deriveVizSchemes(SUSE, SUSE_NAMES, null, [{ id: 'pine', name: 'Pine', hex: '#0c322c', partner: '#30ba78' }, LEADS[1]!]);
  assert.equal(s[0]!.id, 'colourway-pine');
  assert.equal(s[0]!.name, 'Pine');
  assert.ok(hueGap(hueOf(s[0]!.palette.hero), hexToOklch('#30ba78')!.h) < 30, 'the field is the partner, a colour that can carry one');
});

test('fewer than two leads changes nothing: the schemes are the palette guess, exactly', () => {
  const guess = deriveVizSchemes(SUSE, SUSE_NAMES, '#30ba78');
  for (const leads of [null, undefined, [], [LEADS[0]!]]) {
    assert.deepEqual(deriveVizSchemes(SUSE, SUSE_NAMES, '#30ba78', leads), guess);
  }
});

/** A host whose tokens answer one family per role, the way host.tokens.family does. */
function familyHost(primary: string[], secondary: string[] | null, colours = SUSE) {
  const ids = ['jungle', 'persimmon', 'waterhole'];
  const member = (value: string, i: number) => ({ id: ids[i]!, name: ids[i]!.replace(/^./, (c) => c.toUpperCase()), canonical: i === 0, active: i === 0, value });
  return {
    tokens: {
      colors: async () => colours.map((value) => ({ value })),
      family: async (role?: string) => {
        if (role === 'secondary') { if (!secondary) throw new Error('no partner'); return secondary.map(member); }
        return primary.map(member);
      },
    },
  };
}

test('vizLeads pairs each lead with its own partner by colourway id, and gives null below two leads', async () => {
  assert.deepEqual(await vizLeads(familyHost(['#30ba78', '#fe7c3f'], ['#fe7c3f', '#2453ff'])), [
    { id: 'jungle', name: 'Jungle', hex: '#30ba78', partner: '#fe7c3f' },
    { id: 'persimmon', name: 'Persimmon', hex: '#fe7c3f', partner: '#2453ff' },
  ]);
  assert.deepEqual((await vizLeads(familyHost(['#30ba78', '#fe7c3f'], null)))?.map((l) => l.partner), [null, null], 'a failed partner read keeps the leads');
  assert.equal(await vizLeads(familyHost(['#30ba78'], ['#fe7c3f'])), null);
  assert.equal(await vizLeads({ tokens: { colors: async () => [] } }), null, 'a host without the family');
  assert.equal(await vizLeads({ tokens: { colors: async () => [], family: async () => { throw new Error('offline'); } } }), null);
  assert.equal(await vizLeads(undefined), null);
});

test('vizSchemes reads the family once per session, and invalidateVizSchemes reads again', async () => {
  invalidateVizSchemes();
  try {
    const first = await vizSchemes(familyHost(['#30ba78', '#fe7c3f', '#2453ff'], ['#fe7c3f', '#2453ff', '#30ba78']));
    assert.deepEqual(first.map((x) => x.id), ['colourway-jungle', 'colourway-persimmon', 'colourway-waterhole']);
    const cached = await vizSchemes(familyHost(['#30ba78'], null));
    assert.deepEqual(cached.map((x) => x.id), first.map((x) => x.id), 'the session cache holds');
    invalidateVizSchemes();
    const guess = await vizSchemes(familyHost(['#30ba78'], null));
    assert.ok(guess.every((x) => !x.id.startsWith('colourway-')), 'a design system with one lead gets the palette guess');
  } finally { invalidateVizSchemes(); }
});
