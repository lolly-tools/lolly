// SPDX-License-Identifier: MPL-2.0
/**
 * Unit tests for the chrome half of the brand var contract: the HSL-triple
 * conversion and the injected-stylesheet builder. DOM-free (the application
 * function is thin glue over these).
 * Run directly:  node --test shells/web/src/brand-vars.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hexToHslTriple, chromeBrandCss, brandThemeCss, brandFontStack, brandRadiusValue, brandSpaceValue, brandMarkHue, brandMarkPrimary, lollyMarkCss, highContrastAccent, apcaLcAbs, HC_TARGET_LC, uiTokenCssValue } from './brand-vars.ts';
import { apcaContrast } from '../../../engine/src/color-tools.ts';
import { hexToOklch } from '../../../engine/src/brand-derive.ts';

const SANS_TAIL = "'Outfit', ui-sans-serif, system-ui, sans-serif";

test('brandFontStack builds a safe stack ending in the platform tail', () => {
  assert.equal(brandFontStack('SUSE', SANS_TAIL), `'SUSE', ${SANS_TAIL}`);
  // A brand naming a platform default doesn't duplicate it in the tail
  // (SUSE's font.mono is 'SUSE Mono' - the mono tail's own first family).
  assert.equal(
    brandFontStack('SUSE Mono', "'SUSE Mono', ui-monospace, monospace"),
    "'SUSE Mono', ui-monospace, monospace",
  );
  assert.equal(brandFontStack('Outfit', SANS_TAIL), SANS_TAIL); // same family, same stack
  // DTCG fontFamily array form; quotes on names are stripped before re-quoting.
  assert.equal(brandFontStack(['"Inter"', 'Roboto Flex'], SANS_TAIL), `'Inter', 'Roboto Flex', ${SANS_TAIL}`);
  // Nothing usable → null (slot treated as missing; :root default stands).
  assert.equal(brandFontStack(undefined, SANS_TAIL), null);
  assert.equal(brandFontStack('', SANS_TAIL), null);
  assert.equal(brandFontStack('{font.brand}', SANS_TAIL), null); // alias residue
  assert.equal(brandFontStack(42, SANS_TAIL), null);
});

test('brandFontStack rejects families that could smuggle CSS', () => {
  // The value comes from an untrusted imported tokens doc and lands in a style
  // value - anything beyond plain name characters must be dropped.
  assert.equal(brandFontStack("x'; background:url(//evil)", SANS_TAIL), null);
  assert.equal(brandFontStack('a}*{color:red', SANS_TAIL), null);
  assert.equal(brandFontStack('url(//evil.example/f.woff2)', SANS_TAIL), null);
  // A hostile entry in an array is dropped; the clean one survives.
  assert.equal(brandFontStack(['Inter', 'x;y'], SANS_TAIL), `'Inter', ${SANS_TAIL}`);
});

test('brandRadiusValue accepts a plain CSS length in rem/px/em', () => {
  assert.equal(brandRadiusValue('0.5rem'), '0.5rem');
  assert.equal(brandRadiusValue('0rem'), '0rem');
  assert.equal(brandRadiusValue('12px'), '12px');
  assert.equal(brandRadiusValue('1em'), '1em');
});

test('brandRadiusValue rejects anything that isn\'t a bare length', () => {
  assert.equal(brandRadiusValue(undefined), null);
  assert.equal(brandRadiusValue(''), null);
  assert.equal(brandRadiusValue('{shape.radius}'), null); // alias residue
  assert.equal(brandRadiusValue('1rem; background:url(//evil)'), null); // CSS smuggling
  assert.equal(brandRadiusValue('calc(1rem + 1px)'), null); // not a bare length
  assert.equal(brandRadiusValue('1vw'), null); // unit not in the allowed set
  assert.equal(brandRadiusValue('-1rem'), null); // negative - meaningless for a radius
  assert.equal(brandRadiusValue(-1), null); // wrong type entirely (a number, not a string)
});

test('brandSpaceValue accepts the same safe dimension grammar as radius', () => {
  assert.equal(brandSpaceValue('0.5rem'), '0.5rem');
  assert.equal(brandSpaceValue('8px'), '8px');
  assert.equal(brandSpaceValue('{space.base}'), null);
  assert.equal(brandSpaceValue('8px; color:red'), null);
  assert.equal(brandSpaceValue('-4px'), null);
});

test('UI-token CSS values accept only the supported DTCG shapes', () => {
  assert.equal(uiTokenCssValue('color', '#30ba78'), '#30ba78');
  assert.equal(uiTokenCssValue('length', '14px'), '14px');
  assert.equal(uiTokenCssValue('length', 'calc(4px + 1px)'), null);
  assert.equal(uiTokenCssValue('duration', '180ms'), '180ms');
  assert.equal(uiTokenCssValue('duration', 'var(--dur-2)'), null);
  assert.equal(uiTokenCssValue('easing', [0.32, 0.72, 0, 1]), 'cubic-bezier(.32, .72, 0, 1)');
  assert.equal(uiTokenCssValue('easing', [0, 0, 0]), null);
  assert.equal(uiTokenCssValue('number', 50), '50');
  assert.equal(uiTokenCssValue('number', -1), null);
  assert.equal(
    uiTokenCssValue('shadow', { color: '#00000042', offsetX: '0px', offsetY: '4px', blur: '14px', spread: '0px' }),
    '0px 4px 14px 0px #00000042',
  );
  assert.equal(
    uiTokenCssValue('shadow', { color: 'url(https://bad.example)', offsetX: '0px', offsetY: '0px', blur: '0px', spread: '0px' }),
    null,
  );
});

test('hexToHslTriple produces shadcn "H S% L%" triples', () => {
  assert.equal(hexToHslTriple('#000000'), '0 0% 0%');
  assert.equal(hexToHslTriple('#ffffff'), '0 0% 100%');
  assert.equal(hexToHslTriple('#ff0000'), '0 100% 50%');
  // SUSE Jungle #30ba78 - the triple tokens.css derived its dark-theme accent from.
  assert.equal(hexToHslTriple('#30ba78'), '151.3 59% 45.9%');
  assert.equal(hexToHslTriple('not-a-hex'), null);
  assert.equal(hexToHslTriple('#fff'), null); // 6-digit only - resolver output is normalised
});

test('chromeBrandCss emits light/dark accent blocks plus the constructed brand theme', () => {
  const css = chromeBrandCss(
    { primary: '#1c1c22', onPrimary: '#f7f7f5' },
    { primary: '#f7f7f5', onPrimary: '#1c1c22' },
  );
  assert.ok(css.includes(':root, [data-theme="light"]'));
  assert.ok(css.includes('[data-theme="dark"] {'));
  assert.ok(css.includes('[data-theme="brand"] {'));
  assert.ok(css.includes('--primary:'));
  assert.ok(css.includes('--primary-foreground:'));
  // --ring follows --primary in all three blocks (tokens.css couples them).
  assert.equal((css.match(/--ring:/g) ?? []).length, 3);
});

test('brandThemeCss constructs the full mid-toned chrome from the two primaries', () => {
  // The SUSE palette itself: surfaces from Pine, accent Jungle - the construction
  // should land in the neighbourhood of the static tokens.css block.
  const css = brandThemeCss('#0c322c', '#30ba78');
  for (const name of ['background', 'foreground', 'card', 'popover', 'muted', 'secondary',
    'accent', 'border', 'input', 'ring', 'primary', 'primary-foreground',
    'store-1', 'store-4', 'store-other']) {
    assert.ok(css.includes(`--${name}:`), `constructs --${name}`);
  }
  assert.ok(css.includes('color-scheme: dark'));
  // Every emitted value is a valid "H S% L%" triple.
  for (const m of css.matchAll(/--[\w-]+: ([^;]+);/g)) {
    assert.match(m[1]!, /^\d+(\.\d+)? \d+(\.\d+)?% \d+(\.\d+)?%$/, `${m[0]} is a triple`);
  }
  // The accent passes through verbatim as Jungle's triple; the background is a
  // mid-dark Pine-hued surface (hue within a few degrees of Pine's 171).
  assert.ok(css.includes('--primary: 151.3 59% 45.9%'));
  const bg = /--background: ([\d.]+) ([\d.]+)% ([\d.]+)%/.exec(css)!;
  assert.ok(Math.abs(parseFloat(bg[1]!) - 171) < 12, `background hue ${bg[1]} ≈ Pine`);
  const bgL = parseFloat(bg[3]!);
  assert.ok(bgL > 6 && bgL < 22, `background stays mid-dark (${bgL}%)`);
  // A neutral (ink) brand constructs a *grey* chrome - low saturation everywhere.
  const neutral = brandThemeCss('#0e1217', '#f3f5f8');
  const sats = [...neutral.matchAll(/--(?:background|card|muted|border): [\d.]+ ([\d.]+)%/g)].map(m => parseFloat(m[1]!));
  assert.ok(sats.length >= 4 && sats.every(s => s < 20), `neutral brand stays near-grey (${sats.join(', ')})`);
});

test('an unresolvable primary yields no block; both missing yields empty css', () => {
  const darkOnly = chromeBrandCss({ primary: null, onPrimary: null }, { primary: '#f7f7f5', onPrimary: null });
  assert.ok(!darkOnly.includes('[data-theme="light"]'));
  assert.ok(darkOnly.includes('[data-theme="dark"]'));
  // The foreground is COMPUTED from the fill (contrastText - the app-wide
  // inversion rule), so it is always stated, authored on-primary or not:
  // #f7f7f5 is a near-white fill, so its ink is black.
  const ungatedDark = /^\[data-theme="dark"\] \{[^}]*\}/m.exec(darkOnly)?.[0] ?? '';
  assert.ok(ungatedDark.includes('--primary:'));
  assert.ok(ungatedDark.includes('--primary-foreground: 0 0% 0%'));
  assert.equal(chromeBrandCss({ primary: null, onPrimary: null }, { primary: null, onPrimary: null }), '');
});

// ── High-contrast accent (F2) ────────────────────────────────────────────────

test('apcaLcAbs matches the engine apcaContrast (the port must not drift)', () => {
  const swatches = ['#000000', '#ffffff', '#30ba78', '#08211d', '#7b3fe4', '#eab308',
    '#f7f7f5', '#1c1c22', '#123456', '#abcdef', '#808080', '#00b8d4'];
  for (const text of swatches) {
    for (const bg of swatches) {
      assert.equal(apcaLcAbs(text, bg), Math.abs(apcaContrast(text, bg)), `Lc(${text}, ${bg})`);
    }
  }
  // The reference pair the engine's own suite pins (APCA-1.0.98G).
  assert.ok(Math.abs(apcaLcAbs('#000000', '#ffffff') - 106.04) < 0.01);
  assert.ok(Number.isNaN(apcaLcAbs('not-a-hex', '#ffffff')));
});

test('highContrastAccent lifts any hue over the target Lc while holding hue and chroma', () => {
  // The finding: SUSE Jungle pairs at Lc 53 with its own ink and ~54 with pure
  // black or white - under even APCA's large-text floor.
  assert.ok(apcaLcAbs('#08211d', '#30ba78') < 60);
  const cases: Array<[string, string | null]> = [
    ['#30ba78', '#08211d'],  // SUSE Jungle - dark/brand accent
    ['#a678ff', '#1c1c22'],  // light purple on dark ink
    ['#00b8d4', '#ffffff'],  // cyan
    ['#eab308', '#000000'],  // amber, already black-inked
    ['#808080', '#ffffff'],  // exactly neutral: no hue to preserve, still fixable
    ['#30ba78', null],       // ink unknown (tokens.css static) → searched anyway
  ];
  for (const [primary, ink] of cases) {
    const hc = highContrastAccent(primary, ink);
    assert.ok(hc, `${primary} gets an adjusted pair`);
    // Read from the module, not a literal: the bar is a tunable design decision
    // (it was raised from APCA's 75 floor to 80 for real headroom, since the
    // bisection converges on the MINIMUM clearing lightness), and a copy here
    // would just have to be chased.
    const lc = apcaLcAbs(hc.ink, hc.fill);
    assert.ok(lc >= HC_TARGET_LC, `${primary} → ${hc.fill}/${hc.ink} clears Lc ${HC_TARGET_LC} (got ${lc.toFixed(1)})`);
    const before = hexToOklch(primary)!;
    const after = hexToOklch(hc.fill)!;
    // Hue and chroma are held; only lightness moves. (An achromatic fill has no
    // meaningful hue, hence the chroma guard on the hue assertion.)
    if (before.c > 0.02) {
      const d = Math.abs(after.h - before.h) % 360;
      // 3°, not 0: the search holds hue and chroma in OKLCH, but the result has to
      // come back as an sRGB hex, and near the top of the lightness range sRGB
      // cannot hold a high chroma at all. Amber is the worst case here - asking
      // for its own h 86.05 / c 0.162 at the lightness that clears the bar
      // (L 0.867) already reads back at h 87.1 before the search picks anything,
      // because the requested colour is outside the gamut and gets clipped. Two
      // degrees of yellow is imperceptible; pretending it doesn't happen would
      // just make this assertion a liar.
      assert.ok(Math.min(d, 360 - d) < 3, `${primary} keeps its hue (${before.h} → ${after.h})`);
    }
    assert.ok(Math.abs(after.c - before.c) < 0.01, `${primary} keeps its chroma`);
    assert.notEqual(after.l.toFixed(3), before.l.toFixed(3), `${primary} moved its lightness`);
  }
  // Smaller move wins: Jungle reaches the bar in 0.12 L lighter (black ink)
  // versus ~0.16 darker, so it brightens rather than darkening.
  const jungle = highContrastAccent('#30ba78', '#08211d')!;
  assert.equal(jungle.ink, '#000000');
  assert.ok(hexToOklch(jungle.fill)!.l > hexToOklch('#30ba78')!.l);
});

test('highContrastAccent leaves a pair that already clears the bar alone', () => {
  // SUSE Pine (the light accent) is at Lc 98 - nothing to fix, so no block and
  // the brand's own colour stands untouched even under the pref.
  assert.equal(highContrastAccent('#0c322c', '#f7f7f5'), null);
  assert.equal(highContrastAccent('#7b3fe4', '#ffffff'), null);   // Lc 83
  assert.equal(highContrastAccent('#1c1c22', '#f7f7f5'), null);   // starter ink, Lc 101
  assert.equal(highContrastAccent(null, '#ffffff'), null);
  assert.equal(highContrastAccent('not-a-hex', '#ffffff'), null);
});

test('chromeBrandCss appends attribute-gated high-contrast accents, per theme', () => {
  const css = chromeBrandCss(
    { primary: '#0c322c', onPrimary: '#f7f7f5' },
    { primary: '#30ba78', onPrimary: '#08211d' },
  );
  // The light accent already clears the bar, so only dark + brand are gated.
  assert.ok(!css.includes('html[data-a11y-contrast="high"]:not('));
  assert.ok(css.includes('html[data-a11y-contrast="high"][data-theme="dark"] {'));
  assert.ok(css.includes('html[data-a11y-contrast="high"][data-theme="brand"] {'));
  // Gated blocks carry the pair and NOTHING else - --ring stays with tokens.css,
  // which forces the theme's brightest ink there on purpose.
  for (const m of css.matchAll(/html\[data-a11y-contrast="high"\][^{]*\{([^}]*)\}/g)) {
    const decls = [...m[1]!.matchAll(/--([\w-]+):/g)].map(d => d[1]);
    assert.deepEqual(decls, ['primary', 'primary-foreground']);
  }
  // A brand whose light accent ALSO fails gets the "neither dark nor brand"
  // block - spelled that way so it cannot leak into the two themes that carry
  // their own (same reasoning as tokens.css's high-contrast blocks).
  const amber = chromeBrandCss({ primary: '#eab308', onPrimary: null }, { primary: '#eab308', onPrimary: null });
  assert.ok(amber.includes('html[data-a11y-contrast="high"]:not([data-theme="dark"]):not([data-theme="brand"]) {'));
});

test('high contrast forces an explicit ink when the theme ink is unknowable', () => {
  // The gated block never reads the ungated one's computed ink - it states the
  // maximal one itself; the fill is left where the brand put it (Lc 101 already).
  const css = chromeBrandCss({ primary: null, onPrimary: null }, { primary: '#f7f7f5', onPrimary: null });
  const gated = /html\[data-a11y-contrast="high"\]\[data-theme="dark"\] \{([^}]*)\}/.exec(css)?.[1] ?? '';
  assert.ok(gated.includes('--primary: 60 11.1% 96.5%'), 'fill unchanged');
  assert.ok(gated.includes('--primary-foreground: 0 0% 0%'), 'ink stated explicitly');
});

test('the ungated chrome CSS is pinned, with computed accent inks', () => {
  // The gated high-contrast blocks are appended last; everything above them is
  // the no-pref stylesheet, pinned here for the SUSE palette. The accent inks
  // are contrastText's picks (white on the dark teal AND on Jungle green) - 
  // the authored on-primary pair is deliberately not consulted.
  const css = chromeBrandCss(
    { primary: '#0c322c', onPrimary: '#f7f7f5' },
    { primary: '#30ba78', onPrimary: '#08211d' },
  );
  const ungated = css.slice(0, css.indexOf('html[data-a11y-contrast')).trimEnd();
  assert.equal(ungated, [
    ':root, [data-theme="light"] {',
    '  --primary: 170.5 61.3% 12.2%;',
    '  --ring: 170.5 61.3% 12.2%;',
    '  --primary-foreground: 0 0% 100%;',
    '}',
    '[data-theme="dark"] {',
    '  --primary: 151.3 59% 45.9%;',
    '  --ring: 151.3 59% 45.9%;',
    '  --primary-foreground: 0 0% 100%;',
    '}',
    brandThemeCss('#0c322c', '#30ba78'),
    lollyMarkCss('#0c322c', '#30ba78'),
  ].join('\n'));
});

test('brandMarkPrimary/Hue picks the more chromatic primary and ignores near-neutral inks', () => {
  // SUSE: near-black Pine measures teal (~181°) because it is so dark; the vivid
  // Jungle green (~157°) is the true brand colour and must win.
  assert.equal(brandMarkPrimary('#0c322c', '#30ba78'), '#30ba78');
  const hue = brandMarkHue('#0c322c', '#30ba78');
  assert.ok(hue != null && Math.abs(hue - 157) < 8, `SUSE mark hue ≈ Jungle 157° (got ${hue})`);
  // A greyscale/ink "brand" (the blank starter) has no hue worth adopting.
  assert.equal(brandMarkPrimary('#1c1c22', '#f7f7f5'), null);
  assert.equal(brandMarkHue(null, null), null);
});

test('lollyMarkCss emits the brand-hued glyph/text tone + coin glow, or nothing for a neutral brand', () => {
  const css = lollyMarkCss('#7b3fe4', '#a678ff'); // a purple brand
  assert.ok(css.includes(':root, [data-theme="light"]'));
  assert.ok(css.includes('--lolly-mark:'));
  assert.ok(css.includes('--lolly-coin-glow:'));
  // Dark/brand chrome re-points the mark to Lolly's lighter dark tone.
  assert.ok(css.includes('[data-theme="dark"], [data-theme="brand"]'));
  // Two distinct --lolly-mark values (light tone vs dark tone).
  const marks = [...css.matchAll(/--lolly-mark: (#[0-9a-f]{6})/g)].map((m) => m[1]);
  assert.equal(marks.length, 2);
  assert.notEqual(marks[0], marks[1]);
  // No brand hue → nothing, so the CSS green fallbacks stand.
  assert.equal(lollyMarkCss('#1c1c22', '#f7f7f5'), '');
  assert.equal(lollyMarkCss(null, null), '');
});
