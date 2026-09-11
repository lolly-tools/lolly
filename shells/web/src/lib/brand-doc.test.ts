// SPDX-License-Identifier: MPL-2.0
/**
 * brand-doc.ts - the pure DTCG surgery behind the Dashboard's brand editor.
 *
 * Run with: node --test "shells/web/src/**\/*.test.ts"
 *
 * Exercised against the REAL shipped starter brand (brands/lolly-start), so a
 * change to the token contract's shape (ramps / spectrum / per-theme semantic
 * roles) fails here rather than silently blanking the palette in the UI.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  createTokenSet, deriveBrandTokens, defaultColorCurve, serializeCurve, deserializeCurve,
  sampleCurve, bakeCurve, apcaContrast, solveLightnessForApca,
  generateAnalogous, hexToOklch, oklchToHex, inGamut, clipToGamut,
} from '@lolly/engine';
import {
  walkSwatches, setSwatchValue, setSwatchName, deleteSwatch, addSwatch, setSwatchGroup, leafAt,
  setSwatchCmykLock, setSwatchSpotLock, getSwatchPrintOverride, primaryAnchorPath,
  getExcludedSwatches, setSwatchExcluded,
  getRampCurve, setRampCurve, seedRampCurve, reanchorCurve, overlayRampCurves,
  contrastTargets, contrastLockCurve, rotateCurveHue,
  nudgeSwatch, NUDGE_STEP, NUDGE_BIG,
} from './brand-doc.ts';
import type { ContrastLockPreset } from './brand-doc.ts';

const BRAND = fileURLToPath(
  new URL('../../../../brands/lolly-start/catalog/assets/lolly/tokens/brand.json', import.meta.url),
);
/** A fresh deep clone per test - every helper mutates in place. */
const load = (): Record<string, unknown> => JSON.parse(readFileSync(BRAND, 'utf8'));
const resolverFor = (doc: unknown, theme: string) => {
  const set = createTokenSet(doc, { theme });
  return (key: string) => set.resolve(key);
};

test('walkSwatches finds the starter brand’s ramps and one theme’s roles', () => {
  const doc = load();
  const s = walkSwatches(doc, 'light', resolverFor(doc, 'light'));

  const ramps = s.filter(x => x.kind === 'ramp');
  const spectrum = s.filter(x => x.kind === 'spectrum');
  const roles = s.filter(x => x.kind === 'semantic');

  // The minimal starter is ONE ramp (neutral, 1 Ink … 9 Paper) and the 7 semantic
  // slots (light only, every one of them an alias into that ramp) - contract shape,
  // so pinned. It deliberately ships NO chart spectrum and NO primary or secondary
  // ramp: a fresh install is ink and paper, and a new design system grows by ADDING
  // colour, not by clearing a big preset (chart tools fall back to their own palette
  // until a spectrum exists).
  assert.equal(ramps.length, 9, 'neutral only, 9 steps');
  assert.equal(spectrum.length, 0, 'the starter ships no spectrum - the user adds one');
  assert.equal(roles.length, 7);
  assert.equal(s.length, 16, '9 ramp steps + 7 roles is the whole starter palette');
  assert.equal(s.length, ramps.length + spectrum.length + roles.length, 'no swatch is walked twice or missed');

  // Dark roles are filtered out entirely (they'd duplicate primary/surface/…).
  assert.ok(!s.some(x => x.set === 'dark'));
});

test('roles resolve their {alias} to a real hex (the tiles must never be blank)', () => {
  const doc = load();
  const s = walkSwatches(doc, 'light', resolverFor(doc, 'light'));
  const roles = s.filter(x => x.kind === 'semantic');

  for (const r of roles) {
    assert.ok(r.isAlias, `${r.key} should be stored as an alias`);
    assert.match(r.hex, /^#[0-9a-f]{6}$/i, `${r.key} must resolve to a hex, got ${JSON.stringify(r.hex)}`);
  }
  // Without a resolver, an alias has no colour of its own - the exact bug the
  // resolver argument exists to prevent.
  const blind = walkSwatches(doc, 'light').filter(x => x.kind === 'semantic');
  assert.ok(blind.every(r => r.hex === ''));
});

test('the theme argument selects which set’s roles surface', () => {
  const doc = load();
  const light = walkSwatches(doc, 'light', resolverFor(doc, 'light')).filter(x => x.kind === 'semantic');
  const dark = walkSwatches(doc, 'dark', resolverFor(doc, 'dark')).filter(x => x.kind === 'semantic');

  assert.ok(light.every(r => r.set === 'light'));
  assert.ok(dark.every(r => r.set === 'dark'));
  // The starter brand inverts its neutral ramp between themes, so surface differs.
  const surfL = light.find(r => r.key === 'color.semantic.surface')!;
  const surfD = dark.find(r => r.key === 'color.semantic.surface')!;
  assert.notEqual(surfL.hex.toLowerCase(), surfD.hex.toLowerCase());
});

test('roles are structural (not deletable); ramps, spectrum + custom are the user’s', () => {
  const doc = load();
  const s = walkSwatches(doc, 'light', resolverFor(doc, 'light'));
  // Semantic roles are the fixed contract slots - never deletable.
  assert.ok(s.filter(x => x.kind === 'semantic').every(x => !x.deletable));
  // Ramp steps ARE user-deletable now (the user shapes their own shade set).
  assert.ok(s.filter(x => x.kind === 'ramp').every(x => x.deletable));
  assert.ok(s.filter(x => x.kind === 'spectrum').every(x => x.deletable));
});

test('token keys are the canonical dotted paths pickers resolve', () => {
  const doc = load();
  const s = walkSwatches(doc, 'light', resolverFor(doc, 'light'));
  assert.ok(s.some(x => x.key === 'color.ramp.neutral.5'));
  assert.ok(s.some(x => x.key === 'color.semantic.primary'));
  // Group labels drive the palette's sections.
  assert.equal(s.find(x => x.key === 'color.ramp.neutral.5')!.group, 'Neutral');
  assert.equal(s.find(x => x.key === 'color.semantic.primary')!.group, 'Roles · Light');
});

test('setSwatchValue recolours a ramp step in place', () => {
  const doc = load();
  const path = ['base', 'color', 'ramp', 'neutral', '5'];
  assert.equal(setSwatchValue(doc, path, '#ff0000'), true);
  assert.equal(leafAt(doc, path)!.$value, '#ff0000');

  const s = walkSwatches(doc, 'light', resolverFor(doc, 'light'));
  assert.equal(s.find(x => x.key === 'color.ramp.neutral.5')!.hex.toLowerCase(), '#ff0000');
  assert.equal(setSwatchValue(doc, ['base', 'color', 'ramp', 'nope', '1'], '#fff'), false);
});

test('recolouring a role DETACHES its alias into a literal', () => {
  const doc = load();
  const path = ['light', 'color', 'semantic', 'primary'];
  assert.match(String(leafAt(doc, path)!.$value), /^\{.+\}$/); // starts as an alias
  setSwatchValue(doc, path, '#123456');

  const role = walkSwatches(doc, 'light', resolverFor(doc, 'light'))
    .find(x => x.key === 'color.semantic.primary')!;
  assert.equal(role.isAlias, false);
  assert.equal(role.hex.toLowerCase(), '#123456');
});

test('setSwatchName writes $description; clearing it removes the key', () => {
  const doc = load();
  // A custom swatch keeps this independent of the starter's palette shape; its slug
  // ('blue') is what the name falls back to once the $description is cleared.
  const path = addSwatch(doc, 'custom', 'Blue', '#0055ff')!;
  setSwatchName(doc, path, '  Ocean  ');
  assert.equal(leafAt(doc, path)!.$description, 'Ocean');
  assert.equal(walkSwatches(doc, 'light').find(x => x.key === 'color.custom.blue')!.name, 'Ocean');

  setSwatchName(doc, path, '   ');
  assert.equal('$description' in leafAt(doc, path)!, false);
  // Falls back to the prettified leaf key.
  assert.equal(walkSwatches(doc, 'light').find(x => x.key === 'color.custom.blue')!.name, 'Blue');
});

test('addSwatch creates the custom group, slugs collide-safely, and is findable', () => {
  const doc = load();
  assert.equal(walkSwatches(doc, 'light').some(x => x.kind === 'custom'), false);

  const p1 = addSwatch(doc, 'custom', 'Brand Blue', '#4f84ba');
  assert.deepEqual(p1, ['base', 'color', 'custom', 'brand-blue']);

  const p2 = addSwatch(doc, 'custom', 'Brand Blue', '#000000');
  assert.deepEqual(p2, ['base', 'color', 'custom', 'brand-blue-2']);

  const customs = walkSwatches(doc, 'light', resolverFor(doc, 'light')).filter(x => x.kind === 'custom');
  assert.equal(customs.length, 2);
  assert.equal(customs[0]!.name, 'Brand Blue');
  assert.equal(customs[0]!.hex.toLowerCase(), '#4f84ba');
  assert.equal(customs[0]!.group, 'Custom');
  assert.ok(customs.every(c => c.deletable));
  // It must be a real token the picker/exports can resolve.
  assert.equal(createTokenSet(doc, { theme: 'light' }).resolve('color.custom.brand-blue'), '#4f84ba');
});

test('addSwatch can grow the spectrum, and lands in the spectrum group', () => {
  const doc = load();
  const before = walkSwatches(doc, 'light').filter(x => x.kind === 'spectrum').length;
  const p = addSwatch(doc, 'spectrum', 'Chartreuse', '#7fff00');
  assert.deepEqual(p, ['base', 'color', 'spectrum', 'chartreuse']);
  const s = walkSwatches(doc, 'light', resolverFor(doc, 'light'));
  // Relative to the starter's own palette size - the point is that the group GREW by
  // one, not how many hues the starter happens to ship.
  assert.equal(s.filter(x => x.kind === 'spectrum').length, before + 1);
  assert.equal(s.find(x => x.key === 'color.spectrum.chartreuse')!.group, 'Spectrum');
});

test('deleteSwatch removes a leaf, and reports a miss', () => {
  const doc = load();
  const p = addSwatch(doc, 'custom', 'Temp', '#abcdef')!;
  assert.equal(walkSwatches(doc, 'light').some(x => x.key === 'color.custom.temp'), true);

  assert.equal(deleteSwatch(doc, p), true);
  assert.equal(walkSwatches(doc, 'light').some(x => x.key === 'color.custom.temp'), false);
  assert.equal(deleteSwatch(doc, p), false, 'deleting twice is a miss, not a throw');
  assert.equal(deleteSwatch(doc, ['base', 'color', 'nope', 'x']), false);
});

test('a translucent (#rrggbbaa) swatch survives into a resolvable token', () => {
  const doc = load();
  const path = addSwatch(doc, 'custom', 'Glass', '#0088ff80')!;
  // The walker keeps the 8-digit hex (alpha not dropped).
  const sw = walkSwatches(doc, 'light', resolverFor(doc, 'light')).find(s => s.key === 'color.custom.glass')!;
  assert.equal(sw.hex.toLowerCase(), '#0088ff80');
  // And it resolves as a real token (so pickers + exports see the alpha), and is deletable.
  assert.equal(createTokenSet(doc, { theme: 'light' }).resolve('color.custom.glass'), '#0088ff80');
  assert.ok(sw.deletable);
  // Recolour-in-place keeps the alpha byte the caller writes.
  setSwatchValue(doc, path, '#11223344');
  assert.equal(leafAt(doc, path)!.$value, '#11223344');
});

test('a single-set (imported) doc still walks and accepts new swatches', () => {
  const doc: Record<string, unknown> = {
    color: { $type: 'color', brand: { blue: { $value: '#0055ff' } } },
  };
  const s = walkSwatches(doc, 'light');
  assert.equal(s.length, 1);
  assert.equal(s[0]!.key, 'color.brand.blue');
  assert.equal(s[0]!.set, null);

  // No `base` set → the custom group hangs off the top-level colour group.
  assert.deepEqual(addSwatch(doc, 'custom', 'Accent', '#ff0090'), ['color', 'custom', 'accent']);
  assert.equal(walkSwatches(doc, 'light').length, 2);
});

test('walkSwatches ignores $-metadata and non-colour leaves', () => {
  const doc: Record<string, unknown> = {
    $description: 'doc',
    base: {
      color: { $type: 'color', ramp: { primary: { 1: { $value: '#111111', $description: 'Ink' } } } },
      // A non-colour token (spacing) must never surface as a swatch.
      space: { sm: { $value: '4px', $type: 'dimension' } },
    },
  };
  const s = walkSwatches(doc, 'light');
  assert.equal(s.length, 1);
  assert.equal(s[0]!.name, 'Ink');
  assert.equal(s[0]!.kind, 'ramp');
});

// ── Print locks (CMYK / spot) ────────────────────────────────────────────────
// The print anchor is the PRIMARY ramp's middle step, and the shipped starter has
// no primary ramp at all - it is ink and paper until somebody picks a colour - so
// the anchor tests build one: the starter plus a minimal 9-step primary, the shape
// a derived design system carries.
const withPrimaryRamp = (): Record<string, unknown> => {
  const doc = load();
  const ramp = leafAt(doc, ['base', 'color', 'ramp'])!;
  const steps = ['#04150e', '#0a2b1d', '#0f412b', '#14573a', '#30ba78', '#6fd0a0', '#a3e2c4', '#d0f0e2', '#f2fbf7'];
  ramp.primary = Object.fromEntries(steps.map((hex, i) => [String(i + 1), { $value: hex }]));
  return doc;
};
/** An ordinary swatch for the lock behaviours that are NOT about the anchor: the
 *  starter's middle neutral step (5 Ash). */
const NEUTRAL_STEP = ['base', 'color', 'ramp', 'neutral', '5'];

test('the shipped starter has no print anchor: no primary ramp, nothing to pin', () => {
  // A greyscale fresh install: every print-lock caller has to branch on this null
  // rather than assume a brand colour exists to anchor CMYK/spot to.
  assert.equal(primaryAnchorPath(load()), null);
  // …and the moment a primary ramp exists, the anchor is its middle step again.
  assert.deepEqual(primaryAnchorPath(withPrimaryRamp()), ['base', 'color', 'ramp', 'primary', '5']);
});

test('primary CMYK lock: pin, read back, and clear (round-trip)', () => {
  const doc = withPrimaryRamp();
  const path = primaryAnchorPath(doc)!;
  assert.equal(getSwatchPrintOverride(doc, path), null, 'a freshly derived ramp has no pinned override');

  assert.equal(setSwatchCmykLock(doc, path, [80, 20, 0, 5]), true);
  assert.deepEqual(getSwatchPrintOverride(doc, path), { cmyk: [80, 20, 0, 5] });

  // The anchor rides in the vendor $extensions on the primary ramp's step 5.
  const leaf = leafAt(doc, ['base', 'color', 'ramp', 'primary', '5'])!;
  const ext = leaf.$extensions as Record<string, { cmyk?: unknown }>;
  assert.deepEqual(ext['com.suse.lolly']!.cmyk, [80, 20, 0, 5]);

  // Clearing removes the anchor (and the empty extension scaffolding).
  assert.equal(setSwatchCmykLock(doc, path, null), true);
  assert.equal(getSwatchPrintOverride(doc, path), null);
  assert.equal(leaf.$extensions, undefined, 'empty $extensions cleaned up');
});

test('primary CMYK lock clamps to 0–100 and rounds', () => {
  const doc = withPrimaryRamp();
  const path = primaryAnchorPath(doc)!;
  setSwatchCmykLock(doc, path, [120, -5, 33.7, 50]);
  assert.deepEqual(getSwatchPrintOverride(doc, path), { cmyk: [100, 0, 34, 50] });
});

test('cmyk and spot locks are independent: setting/clearing one never touches the other', () => {
  const doc = withPrimaryRamp();
  const path = primaryAnchorPath(doc)!;

  assert.equal(setSwatchCmykLock(doc, path, [80, 20, 0, 5]), true);
  assert.equal(setSwatchSpotLock(doc, path, { name: 'PANTONE 186 C', book: 'PANTONE+ Solid Coated' }), true);

  // Both present at once - the spot lock is a fallback source, not a replacement.
  const locked = getSwatchPrintOverride(doc, path);
  assert.deepEqual(locked, { cmyk: [80, 20, 0, 5], spot: { name: 'PANTONE 186 C', book: 'PANTONE+ Solid Coated' } });

  const leaf = leafAt(doc, ['base', 'color', 'ramp', 'primary', '5'])!;
  const ext = leaf.$extensions as Record<string, { cmyk?: unknown; spot?: unknown }>;
  assert.deepEqual(ext['com.suse.lolly']!.cmyk, [80, 20, 0, 5], 'setting spot left cmyk untouched');

  // Clearing the spot leaves the cmyk lock in place.
  assert.equal(setSwatchSpotLock(doc, path, null), true);
  assert.deepEqual(getSwatchPrintOverride(doc, path), { cmyk: [80, 20, 0, 5] });

  // Clearing the cmyk lock too fully clears the entry.
  assert.equal(setSwatchCmykLock(doc, path, null), true);
  assert.equal(getSwatchPrintOverride(doc, path), null);
  assert.equal(leaf.$extensions, undefined, 'empty $extensions cleaned up');
});

test('a spot lock carries its tactile finish through write → read → walk', () => {
  // Any swatch, not the anchor: a spot ink is pinnable on every colour in the doc.
  const doc = load();
  const path = NEUTRAL_STEP;

  // setSwatchSpotLock rebuilds the extension object field-by-field, so a new
  // SpotColor field is silently DROPPED unless it's listed there. This is the
  // guard on that: `finish` must survive the round trip verbatim.
  assert.equal(setSwatchSpotLock(doc, path, { name: 'Gold foil', book: 'Luxor', finish: 'foil' }), true);
  assert.deepEqual(getSwatchPrintOverride(doc, path), { spot: { name: 'Gold foil', book: 'Luxor', finish: 'foil' } });

  // It reaches walkSwatches unchanged - that's the read the tiles and the
  // popover's control both use.
  const s = walkSwatches(doc, 'light').find(sw => sw.path.length === path.length && sw.path.every((seg, i) => seg === path[i]));
  assert.equal(s?.lock?.spot?.finish, 'foil');

  // No finish = an ordinary spot ink: the key is absent, not present-and-empty,
  // so an existing brand's stored doc is byte-identical to before this shipped.
  assert.equal(setSwatchSpotLock(doc, path, { name: 'PANTONE 186 C' }), true);
  const bare = getSwatchPrintOverride(doc, path)!.spot!;
  assert.deepEqual(bare, { name: 'PANTONE 186 C' });
  assert.equal('finish' in bare, false, 'an unfinished spot writes no finish key at all');

  // A finish the shell has never heard of is data, not an error - FinishKind is
  // an open union so a brand can declare its own.
  assert.equal(setSwatchSpotLock(doc, path, { name: 'Scodix', finish: 'raised-gloss' }), true);
  assert.equal(getSwatchPrintOverride(doc, path)?.spot?.finish, 'raised-gloss');

  // Clearing the spot takes the finish with it (a finish only exists ON a spot).
  assert.equal(setSwatchSpotLock(doc, path, null), true);
  assert.equal(getSwatchPrintOverride(doc, path), null);
});

test('a malformed finish in a stored doc degrades to no finish, keeping the ink', () => {
  // Not something the editor can write - this is an imported or hand-edited
  // brand doc. Total-function tolerance, matching engine/src/tokens.ts's
  // readSpotColor: `name` is what a /Separation plate is named for, so a
  // nonsense finish must cost us the field and nothing more.
  const doc = load();
  const path = NEUTRAL_STEP;
  const leaf = leafAt(doc, path)!;
  for (const bad of [42, null, { kind: 'foil' }, ['foil'], true]) {
    leaf.$extensions = { 'com.suse.lolly': { spot: { name: 'Gold foil', book: 'Luxor', finish: bad } } };
    assert.deepEqual(
      getSwatchPrintOverride(doc, path),
      { spot: { name: 'Gold foil', book: 'Luxor' } },
      `finish: ${JSON.stringify(bad)}`,
    );
  }
});

test('walkSwatches surfaces a swatch\'s print lock (cmyk and/or spot, or none)', () => {
  const doc = load();
  const path = NEUTRAL_STEP;
  setSwatchCmykLock(doc, path, [0, 100, 79, 4]);
  setSwatchSpotLock(doc, path, { name: 'PANTONE 186 C' });
  const s = walkSwatches(doc, 'light').find(sw => sw.path.length === path.length && sw.path.every((seg, i) => seg === path[i]));
  assert.deepEqual(s?.lock, { cmyk: [0, 100, 79, 4], spot: { name: 'PANTONE 186 C' } });
});

test('swatch exclusions: hide (not remove) derived leaves; empty list cleans up', () => {
  const doc = load();
  assert.deepEqual(getExcludedSwatches(doc), []);

  // Excluding a ramp step lists its key; the token itself stays in the doc, so
  // roles + gradient aliases pointing at it keep resolving.
  assert.equal(setSwatchExcluded(doc, 'color.ramp.neutral.2', true), true);
  assert.equal(setSwatchExcluded(doc, 'color.semantic.muted', true), true);
  assert.deepEqual(getExcludedSwatches(doc), ['color.ramp.neutral.2', 'color.semantic.muted']);
  assert.ok(leafAt(doc, ['base', 'color', 'ramp', 'neutral', '2']), 'the token survives its exclusion');
  // Re-excluding is idempotent.
  assert.equal(setSwatchExcluded(doc, 'color.ramp.neutral.2', true), true);
  assert.deepEqual(getExcludedSwatches(doc), ['color.ramp.neutral.2', 'color.semantic.muted']);
  // walkSwatches still lists it - filtering is the CALLER's seam (the editor's
  // repaintPalette / the bridge's colors()), so other consumers stay whole.
  assert.ok(walkSwatches(doc, 'light').some(s => s.key === 'color.ramp.neutral.2'));

  // Un-excluding both empties the list and cleans the vendor entry away.
  assert.equal(setSwatchExcluded(doc, 'color.ramp.neutral.2', false), true);
  assert.equal(setSwatchExcluded(doc, 'color.semantic.muted', false), true);
  assert.deepEqual(getExcludedSwatches(doc), []);
  assert.equal((doc as Record<string, unknown>).$extensions, undefined, 'empty $extensions cleaned up');
});

test('addSwatch displayGroup files a custom swatch under a derived section heading', () => {
  const doc = load();
  const path = addSwatch(doc, 'custom', 'Brand blue', '#123456', { displayGroup: 'Primary' })!;
  assert.ok(path);
  const s = walkSwatches(doc, 'light', resolverFor(doc, 'light'))
    .find(x => x.path.length === path.length && x.path.every((seg, i) => seg === path[i]))!;
  assert.equal(s.kind, 'custom', 'still a custom token - the tag only relabels the section');
  assert.equal(s.group, 'Primary');
  assert.equal(s.deletable, true);
  // Without the tag the group stays the structural one.
  const plain = addSwatch(doc, 'custom', 'Loose end', '#654321')!;
  const p = walkSwatches(doc, 'light').find(x => x.path.join('.') === plain.join('.'))!;
  assert.equal(p.group, 'Custom');
});

test('a "Roles" displayGroup tag follows the CURRENT theme’s Roles section', () => {
  const doc = load();
  // The editor stores the tag theme-less - it must merge into whichever
  // theme's Roles heading is showing, never a phantom stale-theme section.
  const path = addSwatch(doc, 'custom', 'Accent ink', '#224466', { displayGroup: 'Roles' })!;
  const find = (theme: string) => walkSwatches(doc, theme, resolverFor(doc, theme))
    .find(x => x.path.join('.') === path.join('.'))!;
  assert.equal(find('light').group, 'Roles · Light');
  assert.equal(find('dark').group, 'Roles · Dark');
  // A legacy theme-suffixed tag (persisted before the tag went theme-less)
  // maps to the live section too instead of stranding the swatch.
  const legacy = addSwatch(doc, 'custom', 'Old tag', '#446622', { displayGroup: 'Roles · Light' })!;
  const l = walkSwatches(doc, 'dark', resolverFor(doc, 'dark')).find(x => x.path.join('.') === legacy.join('.'))!;
  assert.equal(l.group, 'Roles · Dark');
});

test('setSwatchGroup re-files a tile under a heading, and null sends it home', () => {
  const doc = load();
  // The bulk bar's "Move to" - the same vendor tag addSwatch writes, so a ramp
  // step keeps deriving and a custom swatch keeps its key.
  const step = walkSwatches(doc, 'light', resolverFor(doc, 'light')).find(s => s.kind === 'ramp')!;
  assert.equal(setSwatchGroup(doc, step.path, 'Brights'), true);
  const moved = walkSwatches(doc, 'light', resolverFor(doc, 'light'))
    .find(s => s.path.join('.') === step.path.join('.'))!;
  assert.equal(moved.group, 'Brights');
  assert.equal(moved.kind, 'ramp', 'a move relabels the section, never the token');
  assert.equal(moved.key, step.key);

  assert.equal(setSwatchGroup(doc, step.path, null), true);
  const home = walkSwatches(doc, 'light', resolverFor(doc, 'light'))
    .find(s => s.path.join('.') === step.path.join('.'))!;
  assert.equal(home.group, step.group);
  const leaf = leafAt(doc, step.path)!;
  assert.equal(leaf.$extensions, undefined, 'the emptied vendor entry is cleaned away');

  assert.equal(setSwatchGroup(doc, ['color', 'nope', 'nope'], 'Brights'), false);
});

// ── Per-ramp tonal curves ─────────────────────────────────────────────────────

/** The primary ramp's step $values (`base.color.ramp.<ramp>.<i>`), in step order. */
const rampStepValues = (doc: unknown, ramp: string): string[] => {
  const group = leafAt(doc, ['base', 'color', 'ramp', ramp])!;
  return Object.keys(group).filter(k => /^\d+$/.test(k)).map(Number).sort((a, b) => a - b)
    .map(i => String((group[String(i)] as { $value: unknown }).$value));
};

test('setRampCurve ⇄ getRampCurve round-trips the stored ColorCurveJSON, and null clears it', () => {
  const doc = load();
  const curve = defaultColorCurve({ l: 0.6, c: 0.12, h: 250 }, 9);
  // Neutral is the starter's only ramp (no primary until the user picks a colour),
  // so it is the one a fresh install can carry a tuned curve on.
  assert.equal(getRampCurve(doc, 'neutral'), null, 'starter brand carries no ramp curve');

  assert.equal(setRampCurve(doc, 'neutral', curve), true);
  const json = getRampCurve(doc, 'neutral');
  assert.ok(json, 'the curve reads back');
  // Stored as the canonical serialized OBJECT, so it round-trips exactly.
  assert.equal(JSON.stringify(json), serializeCurve(curve));
  assert.deepEqual(deserializeCurve(json!), curve);

  // The curve rides in the ramp GROUP node's vendor $extensions (not a step).
  const group = leafAt(doc, ['base', 'color', 'ramp', 'neutral'])!;
  const ext = group.$extensions as Record<string, { curve?: unknown }>;
  assert.ok(ext['com.suse.lolly']!.curve, 'stored under the vendor namespace on the group');

  // Clearing removes the curve and the now-empty extension scaffolding, but the
  // group's own $description survives (cleanupExt only touches $extensions).
  assert.equal('$description' in group, true);
  assert.equal(setRampCurve(doc, 'neutral', null), true);
  assert.equal(getRampCurve(doc, 'neutral'), null);
  assert.equal(group.$extensions, undefined, 'empty $extensions cleaned up');
  assert.equal('$description' in group, true, 'the group description is untouched');
});

test('a group-level $extensions.curve is NEVER surfaced as a swatch', () => {
  const doc = load();
  const before = walkSwatches(doc, 'light', resolverFor(doc, 'light'));
  setRampCurve(doc, 'neutral', defaultColorCurve({ l: 0.6, c: 0.12, h: 250 }, 9));
  const after = walkSwatches(doc, 'light', resolverFor(doc, 'light'));
  // The walker skips every $-prefixed key, so the curve adds no phantom swatch.
  assert.equal(after.length, before.length);
  assert.ok(!after.some(s => s.path.includes('$extensions') || s.path.includes('curve')));
  // The neutral ramp still shows exactly its 9 steps.
  assert.equal(after.filter(s => s.kind === 'ramp' && s.group === 'Neutral').length, 9);
});

test('seedRampCurve of an untouched derived ramp re-bakes byte-identical to its step $values', () => {
  // A DERIVED doc: its ramp step literals are formatOklch(v), the exact form the
  // overlay regenerates, so seed → overlay is a fixed point (parseOklch full
  // precision, never a hex round-trip).
  for (const ramp of ['primary', 'neutral', 'secondary'] as const) {
    for (const steps of [3, 9, 20]) {
      const doc = deriveBrandTokens({ primary: '#4f83cc', steps, name: 'x' }) as Record<string, unknown>;
      const before = rampStepValues(doc, ramp);
      const curve = seedRampCurve(doc, ramp, steps);
      overlayRampCurves(doc, { [ramp]: curve }, steps);
      assert.deepEqual(rampStepValues(doc, ramp), before, `${ramp} @ ${steps} steps: seed re-bakes byte-identically`);
    }
  }
});

test('an empty curves map makes overlayRampCurves a deep-equal no-op (byte-identity guard)', () => {
  const doc = deriveBrandTokens({ primary: '#4f83cc', steps: 9, name: 'x' }) as Record<string, unknown>;
  const clone = structuredClone(doc);
  overlayRampCurves(doc, {}, 9);
  assert.deepEqual(doc, clone, 'a curve-less brand is untouched by the overlay');
  // And no ramp gains a curve extension.
  assert.equal(getRampCurve(doc, 'primary'), null);
  assert.equal(getRampCurve(doc, 'neutral'), null);
  assert.equal(getRampCurve(doc, 'secondary'), null);
});

test('a ramp curve SURVIVES a "Use this colour" re-derive (the forbidden failure)', () => {
  const steps = 9;
  const doc = deriveBrandTokens({ primary: '#4f83cc', steps, name: 'x' }) as Record<string, unknown>;
  // Hand-tune the primary curve so it differs from the pure derive.
  const curve = seedRampCurve(doc, 'primary', steps);
  curve.L.points[2]!.v = Math.min(1, curve.L.points[2]!.v + 0.1);
  overlayRampCurves(doc, { primary: curve }, steps);
  const edited = rampStepValues(doc, 'primary');

  // Simulate the derive handler: a FRESH derive (no extension) with the curve
  // carried forward in editor state and overlaid - exactly what brand-editor does.
  const next = deriveBrandTokens({ primary: '#4f83cc', steps, name: 'x' }) as Record<string, unknown>;
  overlayRampCurves(next, { primary: curve }, steps);

  // The curve is re-stamped (recoverable) AND the edited literals are reproduced,
  // not silently reset to the pure derive.
  assert.ok(getRampCurve(next, 'primary'), 'the curve survives the re-derive');
  assert.deepEqual(rampStepValues(next, 'primary'), edited, 'the edited ramp is reproduced');
  // The untouched neutral/secondary ramps carry no curve after the re-derive.
  assert.equal(getRampCurve(next, 'neutral'), null);
});

test('reanchorCurve shifts by the primary delta: H wraps, L and C clamp', () => {
  const curve = {
    L: { points: [{ t: 0, v: 0.2 }, { t: 1, v: 0.8 }] },
    C: { points: [{ t: 0, v: 0.05 }, { t: 1, v: 0.2 }] },
    H: { points: [{ t: 0, v: 5 }, { t: 1, v: 355 }] },
  };
  // H: 350° → 10° is a +20° rotation across 0 (dH = -340 ≡ +20 mod 360).
  // L: +0.4 (0.5 → 0.9) pushes 0.8 past 1 → clamps.
  // C: -0.08 (0.1 → 0.02) pushes 0.05 below 0 → clamps.
  const out = reanchorCurve(
    curve,
    { l: 0.5, c: 0.1, h: 350 },
    { l: 0.9, c: 0.02, h: 10 },
  );
  assert.deepEqual(out.H.points.map(p => p.v), [25, 15], 'hue rotates mod 360 (wrap-safe)');
  assert.deepEqual(out.L.points.map(p => Number(p.v.toFixed(4))), [0.6, 1], 'lightness additive, clamped to [0,1]');
  assert.deepEqual(out.C.points.map(p => Number(p.v.toFixed(4))), [0, 0.12], 'chroma additive, clamped ≥ 0');
  // The input is not mutated (a fresh curve is returned).
  assert.equal(curve.L.points[1]!.v, 0.8);
});

// ── Rotate hue (whole-ramp hue rotation as a curve transform) ──────────────────

test('rotateCurveHue shifts every H point by degrees (mod 360), leaving L and C untouched', () => {
  const curve = {
    L: { points: [{ t: 0, v: 0.2 }, { t: 0.5, v: 0.5 }, { t: 1, v: 0.85 }] },
    C: { points: [{ t: 0, v: 0.03 }, { t: 0.5, v: 0.12 }, { t: 1, v: 0.05 }] },
    H: { points: [{ t: 0, v: 10 }, { t: 0.5, v: 200 }, { t: 1, v: 350 }] },
  };
  const out = rotateCurveHue(curve, 40);
  // Every H control point shifts by +40, wrapping mod 360 (350 + 40 = 390 → 30).
  assert.deepEqual(out.H.points.map(p => p.v), [50, 240, 30], 'hue rotates mod 360 (wrap-safe)');
  assert.deepEqual(out.H.points.map(p => p.t), [0, 0.5, 1], 'tone positions unchanged (no resample)');
  // L and C are byte-identical - only the hue turns.
  assert.deepEqual(out.L.points, curve.L.points);
  assert.deepEqual(out.C.points, curve.C.points);
  // A negative rotation wraps the other way (10 - 40 = -30 → 330).
  const back = rotateCurveHue(curve, -40);
  assert.deepEqual(back.H.points.map(p => p.v), [330, 160, 310]);
  // One control point per existing point - no resample.
  assert.equal(out.H.points.length, curve.H.points.length);
  // The input is never mutated (a fresh curve is returned).
  assert.deepEqual(curve.H.points.map(p => p.v), [10, 200, 350]);
});

test('rotateCurveHue: a full ±360° turn is an identity on the control points', () => {
  const curve = {
    L: { points: [{ t: 0, v: 0.3 }, { t: 1, v: 0.7 }] },
    C: { points: [{ t: 0, v: 0.04 }, { t: 1, v: 0.1 }] },
    H: { points: [{ t: 0, v: 0 }, { t: 0.5, v: 137 }, { t: 1, v: 359 }] },
  };
  for (const deg of [360, -360]) {
    const out = rotateCurveHue(curve, deg);
    assert.deepEqual(out.H.points.map(p => p.v), curve.H.points.map(p => p.v), `${deg}° is a hue identity`);
    assert.deepEqual(out.L.points, curve.L.points);
    assert.deepEqual(out.C.points, curve.C.points);
  }
});

test('a rotated curve is an ordinary ColorCurve - round-trips through set/getRampCurve', () => {
  const doc = load();
  const steps = 9;
  const base = seedRampCurve(doc, 'neutral', steps);
  const curve = rotateCurveHue(base, 120);
  // Its shape (L/C) matches the seed; only the hues moved.
  assert.deepEqual(curve.L.points, base.L.points);
  assert.deepEqual(curve.C.points, base.C.points);

  assert.equal(setRampCurve(doc, 'neutral', curve), true);
  const json = getRampCurve(doc, 'neutral');
  assert.ok(json, 'the rotated curve reads back');
  assert.deepEqual(deserializeCurve(json!), curve, 'exact round-trip - it is just a curve');
  // And overlaying it bakes the ramp steps + re-stamps the curve (same machinery
  // every other curve rides), so the rotation persists like any hand edit.
  overlayRampCurves(doc, { neutral: curve }, steps);
  assert.ok(getRampCurve(doc, 'neutral'), 'the curve survives overlay + re-stamp');
});

// ── Parametric analogous (the harmony picker's Analogous mode generator) ───────

test('generateAnalogous yields `count` accents whose hues step by `angle` (the panel generator path)', () => {
  const primary = '#4f83cc';
  const norm = (h: number): number => ((h % 360) + 360) % 360;
  const pH = hexToOklch(primary)!.h;
  for (const [count, angle] of [[2, 15], [3, 30], [5, 45]] as const) {
    const accents = generateAnalogous(primary, { count, angle });
    assert.equal(accents.length, count, `${count} accents produced`);
    for (let i = 0; i < accents.length; i++) {
      // Accent i (1-indexed) sits at primary + (i+1)·angle around the wheel.
      assert.ok(Math.abs(accents[i]!.hue - norm(pH + angle * (i + 1))) < 1e-9,
        `accent ${i}: hue steps by ${angle}° from the primary`);
    }
    // Consecutive accents differ by exactly `angle` (mod 360).
    for (let i = 1; i < accents.length; i++) {
      const d = norm(accents[i]!.hue - accents[i - 1]!.hue);
      assert.ok(Math.abs(d - norm(angle)) < 1e-9, `step ${i}: consecutive hue delta is ${angle}°`);
    }
  }
});

// ── Contrast-lock ─────────────────────────────────────────────────────────────
// A faithful port of community/color-palette/hooks.js `_targets`/`_fitTargets`/
// `_parseLc`, so `contrastTargets` is proved to speak the SAME numbers the
// Palette Lab tool does - a drift here means the two surfaces disagree.
const TOOL_SPANS: Record<ContrastLockPreset, [number, number]> = { even: [15, 90], text: [45, 100], ui: [8, 66] };
const toolR1 = (n: number): number => Math.round(n * 10) / 10;
function toolParseLc(s: string): number[] {
  if (s == null) return [];
  return String(s).split(',').map(x => Number(String(x).trim())).filter(n => Number.isFinite(n) && n >= 0);
}
function toolFit(list: number[], steps: number): number[] {
  if (list.length === 1) { const flat: number[] = []; for (let i = 0; i < steps; i++) flat.push(list[0]!); return flat; }
  const out: number[] = [];
  for (let j = 0; j < steps; j++) {
    const t = steps <= 1 ? 0 : j / (steps - 1);
    const pos = t * (list.length - 1);
    const lo = Math.floor(pos), hi = Math.min(list.length - 1, lo + 1);
    out.push(toolR1(list[lo]! + (list[hi]! - list[lo]!) * (pos - lo)));
  }
  return out;
}
function toolTargets(preset: ContrastLockPreset, steps: number, custom: string): number[] {
  // The one deliberate correction to the literal port: an empty/whitespace custom
  // falls through to the preset (the tool's `_parseLc('')` returns [0], zeroing the
  // ramp - see contrastTargets' note). All non-empty numeric parsing is identical.
  const list = custom.trim() ? toolParseLc(custom) : [];
  if (list.length) return toolFit(list, steps);
  const ends = TOOL_SPANS[preset] || TOOL_SPANS.even;
  const out: number[] = [];
  for (let i = 0; i < steps; i++) { const t = steps <= 1 ? 0 : i / (steps - 1); out.push(toolR1(ends[0] + (ends[1] - ends[0]) * t)); }
  return out;
}

test('contrastTargets speaks the Palette Lab tool numbers (presets × steps, and custom-list fit)', () => {
  // Concrete anchors - the exact spans + one-decimal rounding, pinned so a change
  // to the shared table is caught here and not only via the port below.
  assert.deepEqual(contrastTargets('even', 5), [15, 33.8, 52.5, 71.3, 90]);
  assert.deepEqual(contrastTargets('text', 3), [45, 72.5, 100]);
  assert.deepEqual(contrastTargets('ui', 5), [8, 22.5, 37, 51.5, 66]);
  assert.deepEqual(contrastTargets('even', 1), [15], 'n === 1 samples the dark end only');

  // Full parity against the tool's own algorithm across presets, ramp lengths and
  // custom lists (incl. junk-dropping, single-value fill, and up/down resampling).
  const customs = ['', '50', '15,30,45,60,75,90', 'abc, 40, , 80', '10,90'];
  for (const preset of ['even', 'text', 'ui'] as ContrastLockPreset[]) {
    for (const steps of [1, 3, 5, 7, 9, 11]) {
      for (const custom of customs) {
        assert.deepEqual(
          contrastTargets(preset, steps, custom), toolTargets(preset, steps, custom),
          `${preset} @ ${steps} steps, custom="${custom}"`,
        );
      }
    }
  }
  // A single custom value fills every step; a comma list resamples to `steps`.
  assert.deepEqual(contrastTargets('even', 4, '50'), [50, 50, 50, 50]);
  assert.deepEqual(contrastTargets('ui', 3, '20,40,60,80'), [20, 50, 80]);
});

test('contrastLockCurve retones each step to its APCA target (or caps it), preserving hue', () => {
  const steps = 9;
  const doc = deriveBrandTokens({ primary: '#4f83cc', steps, name: 'x' }) as Record<string, unknown>;
  const base = seedRampCurve(doc, 'primary', steps);
  const baseStops = sampleCurve(base, steps);
  const bg = '#ffffff';
  const TOL = 3; // Lc - the solver's continuous bisection then 8-bit-hex quantisation.

  for (const preset of ['even', 'text', 'ui'] as ContrastLockPreset[]) {
    const targets = contrastTargets(preset, steps);
    const { curve, unreachable } = contrastLockCurve(base, steps, targets, bg);
    const stops = sampleCurve(curve, steps);
    const hexes = bakeCurve(curve, steps);
    let capped = 0;
    for (let i = 0; i < steps; i++) {
      // Hue is the base stop's hue, passed through the solver unchanged (normalised).
      const wantH = ((baseStops[i]!.h % 360) + 360) % 360;
      assert.ok(Math.abs(stops[i]!.h - wantH) < 1e-9, `${preset} step ${i}: hue preserved`);
      // Chroma never exceeds the base stop's (gamut-clamped at the solved lightness).
      assert.ok(stops[i]!.c <= baseStops[i]!.c + 1e-9, `${preset} step ${i}: chroma not raised`);
      // Re-measure the baked tone's APCA against bg with the REAL engine metric:
      // within tolerance of its target, OR the solver flagged it unreachable.
      const r = solveLightnessForApca(baseStops[i]!.h, baseStops[i]!.c, targets[i]!, bg);
      const lc = Math.abs(apcaContrast(hexes[i]!, bg));
      if (r.reachable) assert.ok(Math.abs(lc - targets[i]!) <= TOL, `${preset} step ${i}: Lc ${lc} ≈ target ${targets[i]}`);
      else { capped++; assert.ok(lc <= targets[i]! + TOL, `${preset} step ${i}: unreachable → capped below target`); }
    }
    assert.equal(unreachable, capped, `${preset}: the reported unreachable count matches the solver`);
  }
  // An impossible target (Lc 999 exceeds the APCA ceiling of ~106) makes EVERY
  // step unreachable - exercises the capped branch + the count deterministically,
  // regardless of hue.
  assert.equal(contrastLockCurve(base, steps, contrastTargets('even', steps, '999'), bg).unreachable, steps);
});

test('a contrast-locked curve is an ordinary ColorCurve - round-trips through set/getRampCurve', () => {
  const steps = 7;
  const doc = deriveBrandTokens({ primary: '#c0392b', steps, name: 'x' }) as Record<string, unknown>;
  const base = seedRampCurve(doc, 'secondary', steps);
  const { curve } = contrastLockCurve(base, steps, contrastTargets('even', steps), '#ffffff');

  assert.equal(setRampCurve(doc, 'secondary', curve), true);
  const json = getRampCurve(doc, 'secondary');
  assert.ok(json, 'the locked curve reads back');
  assert.deepEqual(deserializeCurve(json!), curve, 'exact round-trip - it is just a curve');
  // And overlaying it bakes the ramp steps to those exact tones (same machinery
  // every other curve rides), so the transform is persisted like any hand edit.
  overlayRampCurves(doc, { secondary: curve }, steps);
  assert.ok(getRampCurve(doc, 'secondary'), 'the curve survives overlay + re-stamp');
});

// ── nudgeSwatch - keyboard OKLCH channel nudging (palette grid) ──────────────────

// Circular hue distance (degrees), so a wrap across 360 reads as "close".
const hueDelta = (a: number, b: number): number => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

test('nudgeSwatch: L moves lightness by the step and holds hue/chroma', () => {
  const base = '#808080'; // near-neutral, comfortably inside sRGB
  const before = hexToOklch(base)!;
  const up = hexToOklch(nudgeSwatch(base, 'L', 1, false))!;
  const down = hexToOklch(nudgeSwatch(base, 'L', -1, false))!;
  assert.ok(Math.abs(up.l - (before.l + NUDGE_STEP.L)) < 0.01, `L up ≈ +${NUDGE_STEP.L}`);
  assert.ok(Math.abs(down.l - (before.l - NUDGE_STEP.L)) < 0.01, `L down ≈ -${NUDGE_STEP.L}`);
});

test('nudgeSwatch: C moves chroma by the step (staying in gamut)', () => {
  const base = oklchToHex({ l: 0.6, c: 0.08, h: 250 }); // low chroma → +0.01 stays in sRGB
  const before = hexToOklch(base)!;
  const up = hexToOklch(nudgeSwatch(base, 'C', 1, false))!;
  assert.ok(up.c > before.c, 'chroma increased');
  assert.ok(Math.abs(up.c - (before.c + NUDGE_STEP.C)) < 0.006, `C up ≈ +${NUDGE_STEP.C}`);
  assert.ok(hueDelta(up.h, before.h) < 1.5, 'hue held while chroma moves');
});

test('nudgeSwatch: H rotates hue by the step', () => {
  const base = oklchToHex({ l: 0.6, c: 0.1, h: 120 });
  const before = hexToOklch(base)!;
  const up = hexToOklch(nudgeSwatch(base, 'H', 1, false))!;
  assert.ok(hueDelta(up.h, before.h + NUDGE_STEP.H) < 1.0, `H up ≈ +${NUDGE_STEP.H}°`);
});

test('nudgeSwatch: Shift (big) multiplies the step by NUDGE_BIG', () => {
  const base = '#808080';
  const before = hexToOklch(base)!;
  const big = hexToOklch(nudgeSwatch(base, 'L', 1, true))!;
  assert.ok(Math.abs(big.l - (before.l + NUDGE_STEP.L * NUDGE_BIG)) < 0.01, `big L ≈ +${NUDGE_STEP.L * NUDGE_BIG}`);
});

test('nudgeSwatch: the result is always a real sRGB colour', () => {
  // Push a saturated stop further out - clipToGamut + oklchToHex must land in sRGB.
  const base = oklchToHex({ l: 0.7, c: 0.25, h: 30 });
  const out = hexToOklch(nudgeSwatch(base, 'C', 1, true))!;
  assert.ok(inGamut(out.l, out.c, out.h, 'srgb'), 'nudged colour fits sRGB');
  // clipToGamut is idempotent on it (already inside → same object, chroma unchanged).
  assert.equal(clipToGamut(out, 'srgb').c, out.c, 'no further chroma to give up');
});

test('nudgeSwatch: hue wraps across 360 rather than clamping', () => {
  const base = oklchToHex({ l: 0.6, c: 0.1, h: 1 }); // just past 0°
  const out = hexToOklch(nudgeSwatch(base, 'H', -1, false))!; // 1 - 2 → -1 → 359
  assert.ok(out.h >= 355, `wrapped to ~359°, got ${out.h.toFixed(1)}`);
});

test('nudgeSwatch: L clamps to [0,1] and C clamps at 0', () => {
  const white = hexToOklch(nudgeSwatch('#ffffff', 'L', 1, true))!;
  assert.ok(white.l <= 1, 'L never exceeds 1');
  const gray = nudgeSwatch('#808080', 'C', -1, false); // c≈0 already → max(0, …)
  const g = hexToOklch(gray)!;
  assert.ok(g.c >= 0, 'chroma never goes negative');
});

test('nudgeSwatch: an unparseable colour is returned unchanged', () => {
  assert.equal(nudgeSwatch('not-a-colour', 'L', 1, false), 'not-a-colour');
});
