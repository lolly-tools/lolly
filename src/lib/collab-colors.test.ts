// SPDX-License-Identifier: MPL-2.0
/**
 * Collaborator colours (plans/100 section 4.4) - property tests against the REAL packs.
 *
 * The whole module is a set of guarantees about colours nobody has drawn yet, so
 * examples prove almost nothing here: an assertion that lolly-start's second
 * collaborator is `#b285d3` pins a hex, not a promise, and would go red on a
 * harmless chroma tweak while a genuine regression (two people seated 12° apart)
 * slipped past. So the tests are the guarantees themselves, quantified over
 * every colour the module can produce - every hue on the circle for the band
 * floor, every anchor for the count, and both shipped packs end to end.
 *
 * The packs are read from `brands/` rather than the `catalog/` view because the
 * view is whichever profile happens to be active; reading both directly is what
 * makes "and the OTHER pack still works" testable on one checkout. `brands/suse`
 * is a private submodule (`update = none`), so a public clone has no such
 * directory - those tests skip with a reason rather than failing, which is the
 * same stance `pnpm run validate:catalog:all` takes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  collabPalette, assignColor, bandColor, paletteHue, hueGap,
  COLLAB_BAND, COLLAB_APCA_FLOOR, COLLAB_MIN_DELTA_H, COLLAB_COLOR_COUNT,
  CHROME_SURFACES, HIGH_CONTRAST_SURFACES, BRAND_THEME_SURFACES,
  SEMANTIC_HUES, SEMANTIC_GUARD_DEG,
  DEFAULT_ANCHOR_HUE, HUE_CHROMA_FLOOR,
  type CollabColor, type CollabTheme,
} from './collab-colors.ts';
import { hslToRgb } from './color-formats.ts';
import { createTokenSet } from '../../../../engine/src/tokens.ts';
import { apcaContrast } from '../../../../engine/src/color-tools.ts';
import { hexToOklch } from '../../../../engine/src/brand-derive.ts';

// ── The packs ────────────────────────────────────────────────────────────────

const brandsDir = new URL('../../../../brands/', import.meta.url);

interface Pack { palette: { value: string }[]; accent: string | null }

/** A pack's colour tokens through the engine's own reader - the same
 *  `ColorSwatch[]` the shell gets from `host.tokens.colors()`, so the module is
 *  tested against the shape it will actually be handed. */
function readPack(rel: string): Pack | null {
  const path = fileURLToPath(new URL(rel, brandsDir));
  if (!existsSync(path)) return null;
  const doc: unknown = JSON.parse(readFileSync(path, 'utf8'));
  const set = createTokenSet(doc, { theme: 'light' });
  const swatches = set.colors();
  return {
    palette: swatches.map(s => ({ value: s.value })),
    accent: swatches.find(s => s.path === 'color.semantic.primary')?.value ?? null,
  };
}

const PACKS: { name: string; pack: Pack | null }[] = [
  { name: 'lolly-start', pack: readPack('lolly-start/catalog/assets/lolly/tokens/brand.json') },
  { name: 'suse', pack: readPack('suse/catalog/assets/suse/tokens/brand.json') },
];

// ── Shared property checks ───────────────────────────────────────────────────

const THEMES = Object.keys(CHROME_SURFACES) as CollabTheme[];

/** Re-measure a produced colour against the real surfaces - never trusting the
 *  `lc` the module reported about itself. */
function measure(hex: string, surfaces: readonly string[]): number {
  let worst = Infinity;
  for (const bg of surfaces) worst = Math.min(worst, Math.abs(apcaContrast(hex, bg)));
  return worst;
}

function assertProperties(colors: readonly CollabColor[], label: string): void {
  assert.ok(colors.length > 0, `${label}: produced no colours at all`);

  for (const c of colors) {
    assert.match(c.hex, /^#[0-9a-f]{6}$/i, `${label}: ${c.hex} is not a plain sRGB hex`);

    // 1. Legible in BOTH themes - measured, not taken on the module's word.
    for (const theme of THEMES) {
      const lc = measure(c.hex, CHROME_SURFACES[theme]);
      assert.ok(
        lc >= COLLAB_APCA_FLOOR,
        `${label}: ${c.hex} is |Lc| ${lc.toFixed(1)} on ${theme} chrome, under the ${COLLAB_APCA_FLOOR} floor`,
      );
      assert.ok(
        Math.abs(lc - c.lc[theme]) < 0.01,
        `${label}: ${c.hex} reports ${theme} Lc ${c.lc[theme]} but measures ${lc.toFixed(2)}`,
      );
    }

    // 2. Out of the state-hue neighbourhoods.
    for (const g of SEMANTIC_HUES) {
      assert.ok(
        hueGap(c.hue, g) >= SEMANTIC_GUARD_DEG,
        `${label}: ${c.hex} at ${c.hue.toFixed(1)}° sits inside the ${g}° state guard`,
      );
    }

    // 3. The reported hue is the hue of the colour that actually renders.
    const round = hexToOklch(c.hex);
    assert.ok(round, `${label}: ${c.hex} did not round-trip`);
    assert.ok(
      hueGap(round.h, c.hue) < 3,
      `${label}: ${c.hex} reports hue ${c.hue.toFixed(1)}° but renders ${round.h.toFixed(1)}°`,
    );
  }

  // 4. Pairwise separation, and no repeats.
  const hexes = new Set(colors.map(c => c.hex.toLowerCase()));
  assert.equal(hexes.size, colors.length, `${label}: the palette contains a duplicate hex`);
  for (let i = 0; i < colors.length; i++) {
    for (let j = i + 1; j < colors.length; j++) {
      const gap = hueGap(colors[i]!.hue, colors[j]!.hue);
      assert.ok(
        gap >= COLLAB_MIN_DELTA_H,
        `${label}: ${colors[i]!.hex} and ${colors[j]!.hex} are ${gap.toFixed(1)}° apart, under ΔH ${COLLAB_MIN_DELTA_H}`,
      );
    }
  }
}

// ── The shipped packs ────────────────────────────────────────────────────────

for (const { name, pack } of PACKS) {
  test(`${name}: every collaborator colour clears the floor in both themes and is 50° from the rest`, { skip: pack ? false : `${name} is not mounted` }, () => {
    const colors = collabPalette(pack!);
    assertProperties(colors, name);
    assert.equal(colors.length, COLLAB_COLOR_COUNT, `${name}: seats ${colors.length} people, not ${COLLAB_COLOR_COUNT}`);
  });

  test(`${name}: the same pack yields the same colours every time`, { skip: pack ? false : `${name} is not mounted` }, () => {
    const a = collabPalette(pack!);
    const b = collabPalette(pack!);
    const c = collabPalette({ palette: [...pack!.palette], accent: pack!.accent });
    assert.deepEqual(b, a, 'two calls disagreed');
    assert.deepEqual(c, a, 'a copied palette array disagreed');
  });
}

// ── What each pack actually contributes ──────────────────────────────────────
// The two shipped packs answer this differently, so they get a case each rather
// than one loop-generated assertion: suse owns hues and must show them, while the
// starter owns none by design and must fall back to a full set anyway.

const startPack = PACKS.find(p => p.name === 'lolly-start')!.pack;
const susePack = PACKS.find(p => p.name === 'suse')!.pack;

test('suse: the pack\'s own hues survive into the set', { skip: susePack ? false : 'suse is not mounted' }, () => {
  const colors = collabPalette(susePack!);
  const fromPack = colors.filter(c => c.source === 'palette');
  assert.ok(fromPack.length > 0, 'suse: nothing of the brand made it through - the derivation stopped being brand-derived');

  // Every colour labelled `palette` really is a hue the pack owns.
  const packHues = susePack!.palette
    .map(p => paletteHue(p.value))
    .filter((h): h is number => h !== null);
  for (const c of fromPack) {
    assert.ok(
      packHues.some(h => hueGap(h, c.hue) < 0.5),
      `suse: ${c.hex} is labelled 'palette' but ${c.hue.toFixed(1)}° is in no pack token`,
    );
  }
});

test('lolly-start: the greyscale starter seats everyone from the platform fallback', { skip: startPack ? false : 'lolly-start is not mounted' }, () => {
  // The starter ships one neutral ramp and every semantic role aliases into it, so
  // there is no brand hue to derive from. The guarantee is that this costs nobody
  // a seat: all six are SPUN from the documented fallback anchor, and none of them
  // pretends to be a colour the pack owns.
  const packHues = startPack!.palette
    .map(p => paletteHue(p.value))
    .filter((h): h is number => h !== null);
  assert.deepEqual(packHues, [], 'the starter pack has gained a hue - it is meant to be ink and paper');

  const colors = collabPalette(startPack!);
  assert.equal(colors.length, COLLAB_COLOR_COUNT, `lolly-start: seats ${colors.length} people, not ${COLLAB_COLOR_COUNT}`);
  assert.ok(colors.every(c => c.source === 'spun'), 'a neutral was read as a brand hue');
  assert.equal(colors[0]!.hue, DEFAULT_ANCHOR_HUE, 'the spin did not start at the documented fallback anchor');
  assertProperties(colors, 'lolly-start');
});

test('the shipped packs do not collapse onto one another', { skip: PACKS.every(p => p.pack) ? false : 'both packs need mounting' }, () => {
  const [start, suse] = PACKS.map(p => collabPalette(p.pack!));
  assert.notDeepEqual(
    suse!.map(c => c.hex), start!.map(c => c.hex),
    'both packs produced identical colours - the palette is not reaching the derivation',
  );
});

// ── Single-accent packs (the common path: lolly-start ships one colour) ──────

test('a one-accent pack still seats six tellable-apart people, from every possible accent', () => {
  for (let h = 0; h < 360; h++) {
    const colors = collabPalette({ accent: `oklch(69% 0.14 ${h})` });
    assert.equal(colors.length, COLLAB_COLOR_COUNT, `accent ${h}° seated only ${colors.length}`);
    assertProperties(colors, `accent ${h}°`);
  }
});

test('a greyscale pack falls back to the platform indigo rather than to nothing', () => {
  const greys = ['#000000', '#333333', '#808080', '#cccccc', '#ffffff'].map(value => ({ value }));
  const colors = collabPalette({ palette: greys, accent: '#808080' });
  assert.equal(colors.length, COLLAB_COLOR_COUNT);
  assert.ok(colors.every(c => c.source === 'spun'), 'a grey was read as a hue');
  assert.equal(colors[0]!.hue, DEFAULT_ANCHOR_HUE, 'the spin did not start at the documented fallback anchor');
  assertProperties(colors, 'greyscale');
});

test('a near-grey is not read as a hue the brand owns', () => {
  assert.equal(paletteHue(`oklch(69% ${HUE_CHROMA_FLOOR / 2} 275)`), null);
  assert.ok(paletteHue(`oklch(69% ${HUE_CHROMA_FLOOR * 2} 275)`) !== null);
  assert.equal(paletteHue('#808080'), null, 'pure grey has no hue');
  assert.equal(paletteHue(null), null);
  assert.equal(paletteHue('not a colour'), null);
  assert.equal(paletteHue(''), null);
});

test('brand hues that fragment the circle are given up rather than seating fewer people', () => {
  // Three hues that are each fine and collectively ruinous: the 90° gap between
  // 181 and 271 seats nobody, and keeping all three tops out at five. This is
  // SUSE's shape (pine / persimmon / midnight), stated as a bare case so the
  // step-down loop is pinned even when the private pack is not mounted.
  const palette = [181, 44, 271].map(h => ({ value: `oklch(60% 0.15 ${h})` }));
  const colors = collabPalette({ palette, accent: `oklch(60% 0.15 181)` });
  assert.equal(colors.length, COLLAB_COLOR_COUNT, 'the step-down did not run');
  assertProperties(colors, 'fragmenting palette');
  assert.equal(colors.filter(c => c.source === 'palette').length, 2, 'the wrong number of brand hues was kept');
});

// ── The band itself ──────────────────────────────────────────────────────────

test('the band clears the floor for every hue on the circle, in both themes', () => {
  const worst: Record<string, { hue: number; lc: number }> = {};
  for (let i = 0; i < 3600; i++) {
    const hue = i / 10;
    const c = bandColor(hue);
    for (const theme of THEMES) {
      const lc = measure(c.hex, CHROME_SURFACES[theme]);
      if (!worst[theme] || lc < worst[theme]!.lc) worst[theme] = { hue, lc };
    }
  }
  for (const theme of THEMES) {
    assert.ok(
      worst[theme]!.lc >= COLLAB_APCA_FLOOR,
      `${theme}: hue ${worst[theme]!.hue}° only reaches |Lc| ${worst[theme]!.lc.toFixed(1)}`,
    );
  }
});

// ── The surfaces are the REAL surfaces (the guard the module promises) ───────

/**
 * `CHROME_SURFACES` is a frozen hex copy of `styles/tokens.css`, and its docstring
 * promises that "a token edit that moves them shows up as a failing test". This is
 * that test: the stylesheet is parsed, each theme's surface tokens are resolved the
 * way the browser resolves them (base block, then the theme block, then the
 * high-contrast override on top), converted with the shell's OWN hsl→rgb, and
 * compared against the constants. Without it the copy is a comment, not a guard - 
 * which is exactly how the shipped high-contrast block moved three surfaces without
 * anything noticing.
 */
const SURFACE_TOKENS = ['--background', '--card', '--popover', '--muted', '--secondary', '--accent'] as const;

/** Declarations of every block whose (whitespace-normalized) selector matches. */
function declarationsFor(css: string, selector: string): Map<string, string> {
  const out = new Map<string, string>();
  // Comments first: several of them contain braces and colons of their own.
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const norm = (s: string): string => s.replace(/\s+/g, ' ').trim();
  const re = /([^{}]*)\{([^{}]*)\}/g;
  for (let m = re.exec(clean); m; m = re.exec(clean)) {
    if (norm(m[1]!) !== selector) continue;
    for (const decl of m[2]!.split(';')) {
      const at = decl.indexOf(':');
      if (at < 0) continue;
      out.set(decl.slice(0, at).trim(), decl.slice(at + 1).trim());
    }
  }
  return out;
}

/** The six surface tokens of a theme, in `tokens.css` order, deduplicated. */
function surfaceHexes(css: string, selectors: readonly string[]): string[] {
  const vars = new Map<string, string>();
  for (const sel of selectors) {
    for (const [k, v] of declarationsFor(css, sel)) vars.set(k, v);
  }
  const seen = new Set<string>();
  for (const token of SURFACE_TOKENS) {
    const triple = vars.get(token);
    assert.ok(triple, `${selectors.join(' + ')}: ${token} is not declared`);
    const m = /^([\d.]+)\s+([\d.]+)%\s+([\d.]+)%$/.exec(triple!);
    assert.ok(m, `${token}: '${triple}' is not a bare H S% L% triple`);
    const [r, g, b] = hslToRgb(Number(m![1]), Number(m![2]), Number(m![3]));
    seen.add(`#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`);
  }
  return [...seen];
}

const LIGHT_SEL = ':root, [data-theme="light"]';
const DARK_SEL = '[data-theme="dark"]';
const BRAND_SEL = '[data-theme="brand"]';
const HC_LIGHT_SEL = 'html[data-a11y-contrast="high"]:not([data-theme="dark"]):not([data-theme="brand"])';
const HC_DARK_SEL = 'html[data-a11y-contrast="high"][data-theme="dark"]';

test('the enumerated surfaces are the ones tokens.css actually declares', () => {
  const css = readFileSync(fileURLToPath(new URL('../styles/tokens.css', import.meta.url)), 'utf8');

  const expect = (label: string, got: readonly string[], want: readonly string[]): void => {
    assert.deepEqual(
      new Set(got), new Set(want),
      `${label}: tokens.css resolves to [${got.join(' ')}], the module lists [${want.join(' ')}]`,
    );
  };

  expect('light', surfaceHexes(css, [LIGHT_SEL]), CHROME_SURFACES.light);
  expect('dark', surfaceHexes(css, [LIGHT_SEL, DARK_SEL]), CHROME_SURFACES.dark);
  expect('high-contrast light', surfaceHexes(css, [LIGHT_SEL, HC_LIGHT_SEL]), HIGH_CONTRAST_SURFACES.light);
  expect('high-contrast dark', surfaceHexes(css, [LIGHT_SEL, DARK_SEL, HC_DARK_SEL]), HIGH_CONTRAST_SURFACES.dark);
  expect('brand', surfaceHexes(css, [LIGHT_SEL, BRAND_SEL]), BRAND_THEME_SURFACES);
  // The high-contrast BRAND block repairs inks and edges only - the module says so.
  expect('high-contrast brand', surfaceHexes(css, [LIGHT_SEL, BRAND_SEL, 'html[data-a11y-contrast="high"][data-theme="brand"]']), BRAND_THEME_SURFACES);
});

test('the two themes that cannot reach the floor are measured, not assumed', () => {
  // Same stance as the brand theme below: state the cost, pin it, let the halo carry
  // it - and re-derive the "no band clears 40 everywhere" claim rather than trusting
  // the docstring, because that claim is what justifies not enforcing these.
  let worstDark = Infinity;
  let worstLight = Infinity;
  for (let h = 0; h < 360; h++) {
    worstDark = Math.min(worstDark, measure(bandColor(h).hex, HIGH_CONTRAST_SURFACES.dark));
    worstLight = Math.min(worstLight, measure(bandColor(h).hex, HIGH_CONTRAST_SURFACES.light));
  }
  assert.ok(worstLight >= COLLAB_APCA_FLOOR, `high-contrast light drops to ${worstLight.toFixed(1)} - it should be covered by the enforced band`);
  assert.ok(worstDark >= 30, `high-contrast dark drops to |Lc| ${worstDark.toFixed(1)}, under APCA's non-text mark`);
  assert.ok(worstDark < COLLAB_APCA_FLOOR, 'high contrast now clears the enforced floor - enforce it and say so in the header');

  // …and there is genuinely no band that would let us enforce it: sweep L and C over
  // the union of every enumerated surface and take the best worst case.
  const all = [
    ...CHROME_SURFACES.light, ...CHROME_SURFACES.dark,
    ...HIGH_CONTRAST_SURFACES.light, ...HIGH_CONTRAST_SURFACES.dark,
  ];
  let best = 0;
  for (let l = 0.60; l <= 0.80001; l += 0.005) {
    for (const c of [0.08, 0.10, 0.12]) {
      let worst = Infinity;
      for (let h = 0; h < 360; h += 3) worst = Math.min(worst, measure(bandColor(h, { l, c, h: 0 }, { light: all, dark: all }).hex, all));
      best = Math.max(best, worst);
    }
  }
  assert.ok(best < COLLAB_APCA_FLOOR, `a band at |Lc| ${best.toFixed(1)} clears the floor everywhere - the module should move to it`);
});

test('the brand theme is honestly documented - above APCA non-text, below our floor', () => {
  // The module's header claims the third theme costs ~7 points and lands in the
  // high 30s. Pinned so the claim cannot quietly stop being true.
  let worst = Infinity;
  for (let h = 0; h < 360; h++) worst = Math.min(worst, measure(bandColor(h).hex, BRAND_THEME_SURFACES));
  assert.ok(worst >= 30, `brand theme drops to |Lc| ${worst.toFixed(1)}, under APCA's non-text mark`);
  assert.ok(worst < COLLAB_APCA_FLOOR, 'the brand theme now clears the enforced floor - say so in the header and enforce it');
});

test('the band is a fixed L/C - a brand cannot drag the lightness around', () => {
  const colors = collabPalette({ palette: [{ value: '#000010' }, { value: '#ffeeff' }], accent: '#000010' });
  for (const c of colors) {
    const o = hexToOklch(c.hex)!;
    assert.ok(Math.abs(o.l - COLLAB_BAND.l) < 0.02, `${c.hex} is L ${o.l.toFixed(3)}, off the band`);
    // Chroma may only come DOWN, and only where sRGB cannot hold the band.
    assert.ok(o.c <= COLLAB_BAND.c + 0.005, `${c.hex} is C ${o.c.toFixed(3)}, above the band`);
  }
});

test('an unreachable floor yields fewer colours rather than illegible ones', () => {
  const colors = collabPalette({ accent: '#5283d5', apcaFloor: 200 });
  assert.deepEqual(colors, [], 'a floor nothing can clear still handed out colours');
});

test('count is honoured, and asking for more than the circle holds returns what fits', () => {
  assert.equal(collabPalette({ accent: '#5283d5', count: 3 }).length, 3);
  assert.deepEqual(collabPalette({ accent: '#5283d5', count: 0 }), []);
  const many = collabPalette({ accent: '#5283d5', count: 24 });
  assert.ok(many.length < 24, 'the circle cannot hold 24 hues at ΔH 50 - something skipped the separation check');
  assertProperties(many, 'count 24');
});

test('an empty pack is not a crash', () => {
  assertProperties(collabPalette({}), 'no options');
  assertProperties(collabPalette({ palette: [], accent: null }), 'empty palette');
  assertProperties(collabPalette({ palette: [null, undefined, 'nonsense', { value: 42 }, {}] }), 'junk palette');
});

test('bare hex strings work as well as ColorSwatch objects', () => {
  const asStrings = collabPalette({ palette: ['#5283d5', '#fe7c3f'], accent: '#5283d5' });
  const asSwatches = collabPalette({ palette: [{ value: '#5283d5' }, { value: '#fe7c3f' }], accent: '#5283d5' });
  assert.deepEqual(asStrings, asSwatches);
});

test('the guards can be widened, and the cost is visible', () => {
  const wide = collabPalette({ accent: '#5283d5', semanticGuard: 40 });
  assert.ok(wide.length < COLLAB_COLOR_COUNT, 'a 40° guard should cost at least one seat');
  for (const c of wide) {
    for (const g of SEMANTIC_HUES) assert.ok(hueGap(c.hue, g) >= 40);
  }
});

// ── Assignment ───────────────────────────────────────────────────────────────

const COLORS = collabPalette({ accent: '#5283d5' });

test('assignment is first-unused-wins, keyed by join order', () => {
  const taken: string[] = [];
  for (let i = 0; i < COLORS.length; i++) {
    const c = assignColor(i, taken, COLORS)!;
    assert.equal(c.hex, COLORS[i]!.hex, `join ${i} did not get colour ${i}`);
    taken.push(c.hex);
  }
});

test('every client computes the same colour for the same person', () => {
  // Two peers with the same roster and the same join order must agree - the
  // property the whole scheme rests on. Order of the `taken` iterable must not
  // matter either; one peer's set is not the other's insertion order.
  const roster = [0, 1, 2, 3];
  const taken = roster.map(i => COLORS[i]!.hex);
  for (const joinOrder of [4, 5, 9, 40]) {
    const a = assignColor(joinOrder, taken, COLORS);
    const b = assignColor(joinOrder, [...taken].reverse(), COLORS);
    assert.deepEqual(b, a, `join ${joinOrder} disagreed between peers`);
  }
});

test('a departed collaborator does not reshuffle everyone else', () => {
  // Peer 1 has left; `taken` is what the OTHERS hold, never the asker's own.
  // Peer 2 keeps colour 2 rather than sliding into the gap - which is also what
  // stops two clients handing out colour 1 at once while a late presence packet
  // is still in flight.
  assert.equal(assignColor(2, [COLORS[0]!.hex], COLORS)!.hex, COLORS[2]!.hex, 'peer 2 moved');
  assert.equal(assignColor(3, [COLORS[0]!.hex, COLORS[2]!.hex], COLORS)!.hex, COLORS[3]!.hex, 'peer 3 moved');
  // A NEW joiner wraps past the end and picks up the freed colour.
  assert.equal(assignColor(COLORS.length, [COLORS[0]!.hex, COLORS[2]!.hex], COLORS)!.hex, COLORS[1]!.hex);
});

test('past capacity the colour repeats, and says so by repeating rather than inventing', () => {
  const taken = COLORS.map(c => c.hex);
  for (let i = 0; i < 20; i++) {
    const c = assignColor(i, taken, COLORS)!;
    assert.equal(c.hex, COLORS[i % COLORS.length]!.hex, 'the wrap is not the preferred slot');
  }
});

test('assignment tolerates the shapes a roster actually arrives in', () => {
  assert.equal(assignColor(0, null, COLORS)!.hex, COLORS[0]!.hex);
  assert.equal(assignColor(0, undefined, COLORS)!.hex, COLORS[0]!.hex);
  assert.equal(assignColor(0, new Set([COLORS[0]!.hex]), COLORS)!.hex, COLORS[1]!.hex);
  // Case is not identity - a peer that upper-cased its hex must not double-book.
  assert.equal(assignColor(0, [COLORS[0]!.hex.toUpperCase()], COLORS)!.hex, COLORS[1]!.hex);
  // Negative and non-finite join orders are still deterministic.
  assert.equal(assignColor(-1, [], COLORS)!.hex, COLORS[COLORS.length - 1]!.hex);
  assert.equal(assignColor(Number.NaN, [], COLORS)!.hex, COLORS[0]!.hex);
  assert.equal(assignColor(0, [], []), null);
});

// ── Hue arithmetic ───────────────────────────────────────────────────────────

test('hue distance is circular and symmetric', () => {
  assert.equal(hueGap(10, 350), 20);
  assert.equal(hueGap(350, 10), 20);
  assert.equal(hueGap(0, 180), 180);
  assert.equal(hueGap(0, 181), 179);
  assert.equal(hueGap(-10, 350), 0);
  assert.equal(hueGap(370, 10), 0);
});
