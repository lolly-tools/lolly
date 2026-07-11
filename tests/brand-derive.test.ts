/**
 * Unit tests for engine/src/brand-derive.ts — the OKLCH colour math
 * (parse/format/hex round-trips, gamut mapping, WCAG contrast) and the
 * deriveBrandTokens generator (document shape, ramp anchoring, scheme hues,
 * and the contrast-floor guarantees across a primary × scheme × surface ×
 * contrast matrix).
 *
 * Run with: node --test tests/brand-derive.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseOklch, formatOklch, hexToOklch, oklchToHex, mixOklch, contrastRatio, deriveBrandTokens,
} from '../engine/src/brand-derive.ts';
import type { Oklch } from '../engine/src/brand-derive.ts';
import { createTokenSet, colorToHex } from '../engine/src/tokens.ts';

// ── helpers ──────────────────────────────────────────────────────────────────

const hexRgb = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16),
];

function assertHexClose(actual: string, expected: string, tol = 1, msg = ''): void {
  assert.match(actual, /^#[0-9a-f]{6}$/, `${msg} not a 6-digit hex: ${actual}`);
  const a = hexRgb(actual);
  const e = hexRgb(expected);
  for (let i = 0; i < 3; i++) {
    assert.ok(
      Math.abs(a[i]! - e[i]!) <= tol,
      `${msg} channel ${i}: ${actual} vs ${expected} (tol ±${tol}/255)`,
    );
  }
}

// Resolve a token path from a derived doc for one theme, normalised to 6-digit hex.
type Resolver = ReturnType<typeof createTokenSet>;
function slotHex(ts: Resolver, path: string): string {
  const raw = ts.resolve(`{${path}}`) ?? ts.resolve(path);
  assert.notEqual(raw, undefined, `${path} did not resolve`);
  const hex = colorToHex(raw);
  assert.equal(typeof hex, 'string', `${path} → no hex (${String(raw)})`);
  assert.match(hex as string, /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/, `${path} → ${hex}`);
  return (hex as string).slice(0, 7);
}

// ── oklch ↔ hex round-trips ──────────────────────────────────────────────────

test('hexToOklch ↔ oklchToHex round-trips within ~1/255 per channel', () => {
  const hexes = ['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#4f83cc', '#30ba78', '#f5ee9e', '#0b0b10', '#808080', '#123456'];
  for (const hex of hexes) {
    const ok = hexToOklch(hex);
    assert.ok(ok, `${hex} parsed`);
    assertHexClose(oklchToHex(ok!), hex, 1, hex);
  }
});

test('hexToOklch matches published reference values (sRGB red)', () => {
  const red = hexToOklch('#ff0000')!;
  assert.ok(Math.abs(red.l - 0.628) < 0.005, `l ${red.l}`);
  assert.ok(Math.abs(red.c - 0.2577) < 0.005, `c ${red.c}`);
  assert.ok(Math.abs(red.h - 29.23) < 1, `h ${red.h}`);
  const white = hexToOklch('#ffffff')!;
  assert.ok(Math.abs(white.l - 1) < 1e-4 && white.c < 1e-4, 'white is l≈1 c≈0');
});

test('formatOklch → parseOklch round-trips', () => {
  const cases: Oklch[] = [
    { l: 0.62, c: 0.11, h: 250 },
    { l: 0.97, c: 0.004, h: 105.5 },
    { l: 0.5, c: 0.2, h: 29.23, alpha: 0.5 },
  ];
  for (const c of cases) {
    const back = parseOklch(formatOklch(c))!;
    assert.ok(back, formatOklch(c));
    assert.ok(Math.abs(back.l - c.l) < 1e-3, `l: ${formatOklch(c)}`);
    assert.ok(Math.abs(back.c - c.c) < 1e-3, `c: ${formatOklch(c)}`);
    assert.ok(Math.abs(back.h - c.h) < 0.01, `h: ${formatOklch(c)}`);
    assert.equal(back.alpha, c.alpha);
  }
  assert.equal(formatOklch({ l: 0.62, c: 0.11, h: 250 }), 'oklch(62% 0.11 250)');
});

// ── gamut mapping ────────────────────────────────────────────────────────────

test('oklchToHex clamps out-of-gamut chroma by chroma reduction (hue + L kept)', () => {
  const wild: Oklch = { l: 0.62, c: 0.35, h: 145 }; // far outside sRGB
  const hex = oklchToHex(wild);
  assert.match(hex, /^#[0-9a-f]{6}$/);
  assert.equal(oklchToHex(wild), hex, 'deterministic');
  const back = hexToOklch(hex)!;
  assert.ok(back.c < 0.35, `chroma reduced: ${back.c}`);
  assert.ok(back.c > 0.1, `still chromatic: ${back.c}`);
  assert.ok(Math.abs(back.l - 0.62) < 0.02, `lightness held: ${back.l}`);
  assert.ok(Math.abs(back.h - 145) < 2, `hue held: ${back.h}`);
  // In-gamut input is untouched by the mapper (pure round-trip).
  assertHexClose(oklchToHex(hexToOklch('#4f83cc')!), '#4f83cc', 1);
});

test('oklchToHex survives the sRGB corner-grazing rays (blue/yellow gamut dip)', () => {
  // Near the blue and yellow corners the constant-hue chroma ray dips ~7e-4
  // out of gamut before re-entering AT the corner. A too-tight gamut epsilon
  // makes the chroma search stop at that false boundary and lose ~15% chroma
  // (#0000ff emitted as #0031e5). These pin the loose-tolerance behaviour.
  // The exact anchor deriveBrandTokens({primary:'#0000ff'}) emits at step 5
  // (2dp-quantised hue) must land back on blue:
  assertHexClose(oklchToHex(parseOklch('oklch(45.2% 0.3132 264.05)')!), '#0000ff', 1, 'quantised blue');
  // Quantised (formatOklch → parseOklch) round-trips through the corner too.
  assertHexClose(oklchToHex(parseOklch(formatOklch(hexToOklch('#0000ff')!))!), '#0000ff', 1, 'quantised blue round-trip');
  assertHexClose(oklchToHex(parseOklch(formatOklch(hexToOklch('#ffff00')!))!), '#ffff00', 1, 'quantised yellow round-trip');
});

// ── parseOklch forms ─────────────────────────────────────────────────────────

test('parseOklch: oklch() percent + bare L, hue units, alpha', () => {
  const pct = parseOklch('oklch(62% 0.11 250)')!;
  assert.ok(Math.abs(pct.l - 0.62) < 1e-9 && Math.abs(pct.c - 0.11) < 1e-9 && pct.h === 250);
  assert.equal(pct.alpha, undefined);

  const bare = parseOklch('oklch(0.62 0.11 250deg)')!;
  assert.ok(Math.abs(bare.l - 0.62) < 1e-9 && bare.h === 250);

  assert.ok(Math.abs(parseOklch('oklch(62% 40% 250)')!.c - 0.16) < 1e-9, 'C% is of 0.4');

  assert.equal(parseOklch('oklch(62% 0.11 250 / 0.5)')!.alpha, 0.5);
  assert.equal(parseOklch('oklch(62% 0.11 250 / 50%)')!.alpha, 0.5);
  assert.equal(parseOklch('oklch(62% 0.11 250 / 1)')!.alpha, undefined, 'alpha 1 is omitted');

  assert.ok(Math.abs(parseOklch('oklch(62% 0.11 -110)')!.h - 250) < 1e-9, 'negative hue normalised');
  assert.equal(parseOklch('oklch(none 0.11 250)')!.l, 0, 'none reads as 0');
});

test('parseOklch: lch() (CIELAB D50) converts via Lab', () => {
  const white = parseOklch('lch(100% 0 0)')!;
  assert.ok(Math.abs(white.l - 1) < 1e-3 && white.c < 1e-3, `white → ${formatOklch(white)}`);
  const black = parseOklch('lch(0 0 0)')!; // bare L: same 0–100 scale as percent
  assert.ok(black.l < 1e-3, `black → ${formatOklch(black)}`);
  // sRGB red's CSS Color 4 lch() coordinates land back on red.
  const red = parseOklch('lch(54.29% 106.84 40.86)')!;
  assertHexClose(oklchToHex(red), '#ff0000', 3, 'lch red');
  assert.equal(parseOklch('lch(54.29% 106.84 40.86 / 0.5)')!.alpha, 0.5);
  // sRGB blue's lch() coordinates (the corner-grazing ray — the form
  // Tokens-Studio/DTCG lch exports produce) land back on blue.
  const blue = parseOklch('lch(29.568% 131.207 301.364)')!;
  assertHexClose(oklchToHex(blue), '#0000ff', 3, 'lch blue');
  assertHexClose(colorToHex('lch(29.568% 131.207 301.364)') as string, '#0000ff', 3, 'lch blue via colorToHex');
});

test('parseOklch: rejects malformed strings', () => {
  for (const bad of ['oklch(62%)', 'oklch(62% 0.11)', 'oklch(62% 0.11 250 / 1 / 2)',
    'rgb(1, 2, 3)', '#4f83cc', 'oklch 62% 0.11 250', 'oklch(a b c)', '']) {
    assert.equal(parseOklch(bad), null, bad);
  }
});

// ── mixOklch ─────────────────────────────────────────────────────────────────

test('mixOklch: linear midpoint in L/C, shortest-arc hue, exact endpoints, t clamped', () => {
  // Binary-exact component values so the endpoint/midpoint asserts are exact.
  const a: Oklch = { l: 0.25, c: 0.0625, h: 40 };
  const b: Oklch = { l: 0.75, c: 0.1875, h: 80 };
  assert.deepEqual(mixOklch(a, b, 0.5), { l: 0.5, c: 0.125, h: 60 });
  assert.deepEqual(mixOklch(a, b, 0), a);
  assert.deepEqual(mixOklch(a, b, 1), b);
  assert.deepEqual(mixOklch(a, b, -1), a, 't clamps low');
  assert.deepEqual(mixOklch(a, b, 2), b, 't clamps high');
});

test('mixOklch: hue takes the short way across 0° (350 ↔ 10 meets at 0)', () => {
  const a: Oklch = { l: 0.5, c: 0.1, h: 350 };
  const b: Oklch = { l: 0.5, c: 0.1, h: 10 };
  const mid = mixOklch(a, b, 0.5).h;
  assert.ok(Math.abs(mid) < 1e-9 || Math.abs(mid - 360) < 1e-9, `mid ${mid}`);
  assert.ok(Math.abs(mixOklch(a, b, 0.25).h - 355) < 1e-9, 'quarter stays on the near side');
  assert.ok(Math.abs(mixOklch(a, b, 0.75).h - 5) < 1e-9);
});

test("mixOklch: an achromatic endpoint (c < 0.02) adopts the other side's hue", () => {
  const grey: Oklch = { l: 0.9, c: 0.01, h: 260 }; // its stored hue is noise
  const teal: Oklch = { l: 0.5, c: 0.12, h: 190 };
  assert.equal(mixOklch(grey, teal, 0.25).h, 190, 'hue held the whole way in');
  assert.equal(mixOklch(teal, grey, 0.75).h, 190, 'and the whole way out');
  // Both achromatic: neither side donates — plain shortest-arc between them.
  assert.equal(mixOklch({ l: 0.2, c: 0, h: 10 }, { l: 0.8, c: 0.01, h: 350 }, 0.5).h, 0);
});

test('mixOklch: alpha interpolates against an implicit 1; fully opaque drops the field', () => {
  const m = mixOklch({ l: 0.5, c: 0.1, h: 0, alpha: 0.2 }, { l: 0.5, c: 0.1, h: 0 }, 0.5);
  assert.ok(Math.abs((m.alpha ?? 1) - 0.6) < 1e-9, `alpha ${m.alpha}`);
  assert.equal('alpha' in mixOklch({ l: 0.5, c: 0.1, h: 0 }, { l: 0.5, c: 0.1, h: 0 }, 0.5), false);
});

// ── contrastRatio ────────────────────────────────────────────────────────────

test('contrastRatio: WCAG 2.1 sanity', () => {
  assert.ok(Math.abs(contrastRatio('#000000', '#ffffff') - 21) < 1e-9, 'black/white = 21');
  assert.equal(contrastRatio('#ffffff', '#ffffff'), 1);
  assert.equal(contrastRatio('#123456', '#abcdef'), contrastRatio('#abcdef', '#123456'), 'symmetric');
  const grey = contrastRatio('#777777', '#ffffff'); // the classic ~4.5:1 borderline grey
  assert.ok(grey > 4 && grey < 5, `#777 vs white ≈ 4.5, got ${grey}`);
  assert.ok(Number.isNaN(contrastRatio('nope', '#ffffff')), 'unparseable → NaN');
});

// ── deriveBrandTokens: document shape ────────────────────────────────────────

test('deriveBrandTokens: §2 doc shape, resolvable via createTokenSet for BOTH themes', () => {
  const doc = deriveBrandTokens({ primary: '#4f83cc', name: 'Acme' });
  assert.deepEqual((doc.$metadata as { tokenSetOrder: string[] }).tokenSetOrder, ['base', 'light', 'dark']);
  const themes = doc.$themes as { name: string }[];
  assert.deepEqual(themes.map(t => t.name), ['light', 'dark'], 'light default');
  assert.ok(String(doc.$description).includes('Acme'), 'provenance name in $description');
  assert.ok(doc.base && doc.light && doc.dark, 'three sets');

  for (const theme of ['light', 'dark']) {
    const ts = createTokenSet(doc, { theme });
    for (const ramp of ['primary', 'neutral', 'secondary']) {
      for (let step = 1; step <= 9; step++) {
        assert.match(slotHex(ts, `color.ramp.${ramp}.${step}`), /^#/, `${theme} ${ramp}.${step}`);
      }
    }
    for (const name of ['blue', 'teal', 'violet', 'amber', 'rose', 'green']) {
      assert.match(slotHex(ts, `color.spectrum.${name}`), /^#/, `${theme} spectrum.${name}`);
    }
    for (const slot of ['primary', 'on-primary', 'secondary', 'surface', 'text', 'muted', 'edge']) {
      assert.match(slotHex(ts, `color.semantic.${slot}`), /^#/, `${theme} semantic.${slot}`);
    }
  }

  // Ramps are monotonic dark → light.
  const ts = createTokenSet(doc, { theme: 'light' });
  let prev = -1;
  for (let step = 1; step <= 9; step++) {
    const l = hexToOklch(slotHex(ts, `color.ramp.neutral.${step}`))!.l;
    assert.ok(l > prev, `neutral.${step} lighter than .${step - 1}`);
    prev = l;
  }
});

test('deriveBrandTokens: a mid-range primary appears verbatim at ramp step 5', () => {
  const doc = deriveBrandTokens({ primary: '#4f83cc' });
  const ts = createTokenSet(doc, { theme: 'light' });
  assertHexClose(slotHex(ts, 'color.ramp.primary.5'), '#4f83cc', 1, 'anchor step');
  // A pure-blue brand (L 0.452, mid-range → anchor rule fires) survives the
  // corner-grazing gamut ray: every hex consumer reads back blue, not #0031e5.
  const blue = createTokenSet(deriveBrandTokens({ primary: '#0000ff' }), { theme: 'light' });
  assertHexClose(slotHex(blue, 'color.ramp.primary.5'), '#0000ff', 1, 'blue anchor step');
});

test('deriveBrandTokens: mono keeps one hue family, secondary chroma reduced', () => {
  const p = hexToOklch('#4f83cc')!;
  const doc = deriveBrandTokens({ primary: '#4f83cc', scheme: 'mono' });
  const ts = createTokenSet(doc, { theme: 'light' });
  const sec = parseOklch(String(ts.get('color.ramp.secondary.5')!.value))!;
  assert.ok(Math.abs(sec.h - p.h) < 0.5, `same hue: ${sec.h} vs ${p.h}`);
  assert.ok(Math.abs(sec.c - p.c * 0.35) < p.c * 0.05, `chroma ×0.35: ${sec.c} vs ${p.c}`);
  // A distinct ramp, not a re-alias of primary.
  assert.notEqual(
    ts.get('color.ramp.secondary.5')!.value,
    ts.get('color.ramp.primary.5')!.value,
  );
});

test('deriveBrandTokens: complement rotates the secondary hue ~180°', () => {
  const p = hexToOklch('#4f83cc')!;
  const doc = deriveBrandTokens({ primary: '#4f83cc', scheme: 'complement' });
  const ts = createTokenSet(doc, { theme: 'light' });
  const sec = parseOklch(String(ts.get('color.ramp.secondary.5')!.value))!;
  const diff = Math.abs(((sec.h - p.h) % 360 + 360) % 360 - 180);
  assert.ok(diff < 0.5, `hue diff ≈ 180, got ${sec.h} vs ${p.h}`);
});

test('deriveBrandTokens: spectrum hues nudge ≤8° toward the primary hue', () => {
  const p = hexToOklch('#4f83cc')!; // hue ≈ 259
  const doc = deriveBrandTokens({ primary: '#4f83cc' });
  const ts = createTokenSet(doc, { theme: 'light' });
  const teal = parseOklch(String(ts.get('color.spectrum.teal')!.value))!;
  assert.ok(Math.abs(teal.h - 198) < 0.5, `teal 190 → 198 (toward ${p.h}), got ${teal.h}`);
  const rose = parseOklch(String(ts.get('color.spectrum.rose')!.value))!;
  assert.ok(Math.abs(rose.h - 347) < 0.5, `rose 355 → 347 (toward ${p.h}), got ${rose.h}`);
});

test('deriveBrandTokens: surface option orders $themes (chosen look first)', () => {
  const first = (doc: Record<string, unknown>) => (doc.$themes as { name: string }[])[0]!.name;
  assert.equal(first(deriveBrandTokens({ primary: '#4f83cc' })), 'light');
  assert.equal(first(deriveBrandTokens({ primary: '#4f83cc', surface: 'light' })), 'light');
  assert.equal(first(deriveBrandTokens({ primary: '#4f83cc', surface: 'dark' })), 'dark');
  assert.equal(first(deriveBrandTokens({ primary: '#4f83cc', surface: 'primary' })), 'dark');
});

test("deriveBrandTokens: surface 'primary' = dark chroma-rich primary surface, lifted primary slot", () => {
  const p = hexToOklch('#4f83cc')!;
  const doc = deriveBrandTokens({ primary: '#4f83cc', surface: 'primary' });
  const ts = createTokenSet(doc, { theme: 'dark' });
  const surf = parseOklch(String(ts.resolve('color.semantic.surface')))!;
  assert.ok(surf.l >= 0.22 - 1e-9 && surf.l <= 0.3 + 1e-9, `deep: L ${surf.l}`);
  assert.ok(surf.c >= 0.06 - 1e-9, `chroma-rich: C ${surf.c}`);
  assert.ok(Math.abs(surf.h - p.h) < 0.5, `primary hue: ${surf.h} vs ${p.h}`);
  // The primary slot lifts above the surface so it still reads on it.
  const prim = hexToOklch(slotHex(ts, 'color.semantic.primary'))!;
  assert.ok(prim.l > surf.l + 0.2, `lifted: primary L ${prim.l} vs surface L ${surf.l}`);
  assert.ok(contrastRatio(slotHex(ts, 'color.semantic.primary'), slotHex(ts, 'color.semantic.surface')) >= 3,
    'primary reads on the primary surface');
  // The light theme keeps its ordinary near-white neutral surface.
  const lightSurf = hexToOklch(slotHex(createTokenSet(doc, { theme: 'light' }), 'color.semantic.surface'))!;
  assert.ok(lightSurf.l > 0.9, `light theme surface stays light: ${lightSurf.l}`);
});

// ── contrast-floor matrix ────────────────────────────────────────────────────

const MATRIX_FLOORS = {
  comfort: { text: 7.0, muted: 3.0, onPrimary: 4.5, edge: 1.3 },
  high: { text: 10.0, muted: 4.5, onPrimary: 7.0, edge: 1.6 },
} as const;

const MATRIX_PRIMARIES = {
  'mid blue': '#4f83cc',
  'very light yellow': '#f5ee9e',
  'near black': '#0b0b10',
} as const;

for (const [label, primary] of Object.entries(MATRIX_PRIMARIES)) {
  for (const scheme of ['mono', 'complement'] as const) {
    for (const surface of ['light', 'dark', 'primary'] as const) {
      for (const contrast of ['comfort', 'high'] as const) {
        test(`floors hold: ${label} · ${scheme} · surface ${surface} · ${contrast}`, () => {
          const doc = deriveBrandTokens({ primary, scheme, surface, contrast });
          const F = MATRIX_FLOORS[contrast];
          for (const theme of ['light', 'dark']) {
            const ts = createTokenSet(doc, { theme });
            const hex = (slot: string) => slotHex(ts, `color.semantic.${slot}`);
            const surfaceHex = hex('surface');
            const checks: [string, number, number][] = [
              ['text', contrastRatio(hex('text'), surfaceHex), F.text],
              ['muted', contrastRatio(hex('muted'), surfaceHex), F.muted],
              ['on-primary', contrastRatio(hex('on-primary'), hex('primary')), F.onPrimary],
              ['edge', contrastRatio(hex('edge'), surfaceHex), F.edge],
            ];
            for (const [slot, ratio, floor] of checks) {
              assert.ok(ratio >= floor, `${theme}: ${slot} ${ratio.toFixed(2)} < ${floor}`);
            }
          }
        });
      }
    }
  }
}

// ── determinism + inputs ─────────────────────────────────────────────────────

test('deriveBrandTokens is deterministic (two calls deep-equal)', () => {
  const opts = { primary: '#4f83cc', scheme: 'complement', surface: 'primary', contrast: 'high', name: 'Acme' } as const;
  assert.deepEqual(deriveBrandTokens(opts), deriveBrandTokens(opts));
});

test('deriveBrandTokens accepts any CSS colour as primary, throws on garbage', () => {
  const viaHex = deriveBrandTokens({ primary: '#4f83cc' });
  for (const alias of ['rgb(79, 131, 204)', 'rgb(79 131 204)', 'hsl(215, 55%, 55%)', 'oklch(62% 0.11 259)', 'lch(54% 43 275)']) {
    const doc = deriveBrandTokens({ primary: alias });
    const ts = createTokenSet(doc, { theme: 'light' });
    assert.match(slotHex(ts, 'color.semantic.primary'), /^#/, alias);
  }
  // rgb() form of the same colour derives the same document.
  assert.deepEqual(deriveBrandTokens({ primary: 'rgb(79, 131, 204)' }), viaHex);
  assert.throws(() => deriveBrandTokens({ primary: 'not-a-colour' }), /unparseable primary/);
});
