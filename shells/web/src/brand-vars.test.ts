// SPDX-License-Identifier: MPL-2.0
/**
 * Unit tests for the chrome half of the brand var contract: the HSL-triple
 * conversion and the injected-stylesheet builder. DOM-free (the application
 * function is thin glue over these).
 * Run directly:  node --test shells/web/src/brand-vars.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hexToHslTriple, chromeBrandCss, brandThemeCss, brandFontStack, brandRadiusValue, brandSpaceValue, brandMarkHue, brandMarkPrimary, lollyMarkCss, lollyMarkHex, LOLLY_TONE_HEX, highContrastAccent, apcaLcAbs, HC_TARGET_LC, uiTokenCssValue, contrastText,
  hslTripleToHex, THEME_SURFACES, THEME_DESTRUCTIVE, brandSurfaceHexes, FOCUS_RING_RATIO, CONTROL_RATIO, dangerText, dangerTextSurfaces, dangerTextCss, DANGER_TEXT_RATIO, DANGER_TEXT_HC_LC } from './brand-vars.ts';
import { apcaContrast } from '../../../engine/src/color-tools.ts';
import { hexToOklch, oklchToHex, contrastRatio, parseHex } from '../../../engine/src/brand-derive.ts';

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
  // --ring follows --primary in all three ungated blocks (tokens.css couples
  // them); the high-contrast blocks carry rings of their own, tested below.
  const ungated = css.replace(/html\[data-a11y-contrast="high"\][^{]*\{[^}]*\}/g, '');
  assert.equal((ungated.match(/--ring:/g) ?? []).length, 3);
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

test('brandThemeCss re-emits every storage stop, so no static SUSE green shows through', () => {
  // The constructed block overrides only the properties it states. A --store-N
  // that the static [data-theme="brand"] block in tokens.css declares and this
  // one skips keeps its SUSE green under every brand: --store-5 did, which
  // painted pins, file history and Lottie clips green in the blank brand.
  const tokensCss = readFileSync(new URL('./styles/tokens.css', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  const staticStores = [...tokensCss.matchAll(/\n\[data-theme="brand"\] \{([^}]*)\}/g)]
    .flatMap(m => [...m[1]!.matchAll(/--(store-[\w-]+):/g)].map(d => d[1]!));
  assert.ok(staticStores.includes('store-5'), `static brand stops: ${staticStores.join(', ')}`);
  const triple = (css: string, name: string) => {
    const m = new RegExp(`--${name}: ([\\d.]+) ([\\d.]+)% ([\\d.]+)%;`).exec(css);
    assert.ok(m, `constructs --${name}`);
    return { h: parseFloat(m[1]!), s: parseFloat(m[2]!), l: parseFloat(m[3]!) };
  };
  // SUSE, the blank starter (ink and paper) and a purple brand.
  for (const [light, dark] of [['#0c322c', '#30ba78'], ['#1d1d1d', '#ffffff'], ['#7b3fe4', '#a678ff']]) {
    const css = brandThemeCss(light!, dark!);
    for (const name of staticStores) triple(css, name);
    // --store-5 is the ramp's next stop: lighter than --store-4, at the same hue.
    const s4 = triple(css, 'store-4');
    const s5 = triple(css, 'store-5');
    assert.ok(s5.l > s4.l, `${light}/${dark}: --store-5 (${s5.l}%) is lighter than --store-4 (${s4.l}%)`);
    const dh = Math.abs(s5.h - s4.h) % 360;
    assert.ok(Math.min(dh, 360 - dh) < 5, `${light}/${dark}: --store-5 keeps the ramp's hue (${s4.h} → ${s5.h})`);
  }
  // The blank brand's stop stays in its own near-grey, not the static 132 60% 79%.
  const blank = triple(brandThemeCss('#1d1d1d', '#ffffff'), 'store-5');
  assert.ok(blank.s < 10, `blank --store-5 stays near-grey (${blank.s}%)`);
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
  assert.ok(css.includes('html[data-a11y-contrast="high"][data-theme="dark"] {'));
  assert.ok(css.includes('html[data-a11y-contrast="high"][data-theme="brand"] {'));
  // Gated blocks carry the pair and, where the fill can be found, the ring -
  // nothing else. The light accent already clears the bar, so its block states
  // no pair: only the ring that follows the light accent.
  const decls = (theme: string): string[] => [...(hcBlocks(css).get(theme) ?? '').matchAll(/--([\w-]+):/g)].map(d => d[1]!);
  assert.deepEqual(decls('light'), ['ring']);
  assert.deepEqual(decls('dark'), ['primary', 'primary-foreground', 'ring']);
  assert.deepEqual(decls('brand'), ['primary', 'primary-foreground', 'ring']);
  // A brand whose light accent ALSO fails gets the "neither dark nor brand"
  // block - spelled that way so it cannot leak into the two themes that carry
  // their own (same reasoning as tokens.css's high-contrast blocks).
  const amber = chromeBrandCss({ primary: '#eab308', onPrimary: null }, { primary: '#eab308', onPrimary: null });
  assert.ok(amber.includes('html[data-a11y-contrast="high"]:not([data-theme="dark"]):not([data-theme="brand"]) {'));
});

/** theme → declarations of each `html[data-a11y-contrast="high"]` block in a
 *  stylesheet, comments stripped. The bare attribute block is keyed 'any'. */
function hcBlocks(css: string): Map<string, string> {
  const out = new Map<string, string>();
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of bare.matchAll(/html\[data-a11y-contrast="high"\]([^{]*)\{([^}]*)\}/g)) {
    const sel = m[1]!.trim();
    const theme = sel === '' ? 'any'
      : sel === ':not([data-theme="dark"]):not([data-theme="brand"])' ? 'light'
        : (/^\[data-theme="(\w+)"\]$/.exec(sel)?.[1] ?? sel);
    out.set(theme, m[2]!);
  }
  return out;
}

test('high contrast keeps a brand that already clears the bar in its own colour', () => {
  // The blank starter: ink in light, paper in dark, both far over the bar, so
  // there is nothing to repair. tokens.css's dark and brand high-contrast
  // blocks still declare SUSE's lifted Jungle, which outranks the ungated
  // brand block, so the gated blocks must restate the starter's own pair or
  // the main button turns green the moment the preference is on.
  const starter = hcBlocks(chromeBrandCss(
    { primary: '#1d1d1d', onPrimary: '#ffffff' },
    { primary: '#ffffff', onPrimary: '#1d1d1d' },
  ));
  for (const theme of ['dark', 'brand']) {
    const block = starter.get(theme) ?? '';
    assert.match(block, /--primary: 0 0% 100%;/, `${theme}: the paper fill stands`);
    assert.match(block, /--primary-foreground: 0 0% 0%;/, `${theme}: the ungated block's computed ink stands`);
  }
  // Light states no pair: tokens.css leaves the light accent alone. Its block
  // holds only the ring that follows the starter's ink.
  assert.doesNotMatch(starter.get('light') ?? '', /--primary/);
  assert.match(starter.get('light') ?? '', /--ring: 0 0% 11\.4%;/);

  // A chromatic brand that passes keeps its hue too, not just a neutral one.
  const yellow = hcBlocks(chromeBrandCss(
    { primary: '#7a5c00', onPrimary: '#ffffff' },
    { primary: '#fde047', onPrimary: '#000000' },
  ));
  assert.ok(apcaLcAbs('#000000', '#fde047') >= HC_TARGET_LC, 'the yellow pair clears the bar unrepaired');
  for (const theme of ['dark', 'brand']) {
    assert.match(yellow.get(theme) ?? '', new RegExp(`--primary: ${hexToHslTriple('#fde047')};`), `${theme}: yellow stands`);
  }
});

test('every theme whose tokens.css high-contrast block pins a primary gets a brand block', () => {
  // The restatement above is only needed where tokens.css declares its own
  // --primary under the preference. Reading the real stylesheet keeps the two
  // in step: a static primary added to the light block later fails here until
  // the light block restates too.
  const tokens = readFileSync(new URL('./styles/tokens.css', import.meta.url), 'utf8');
  const pinned = [...hcBlocks(tokens)]
    .filter(([theme, decls]) => theme !== 'any' && /(^|[;\s])--primary\s*:/.test(decls))
    .map(([theme]) => theme)
    .sort();
  assert.deepEqual(pinned, ['brand', 'dark'], 'tokens.css pins a high-contrast primary in dark and brand only');
  for (const pair of [
    [{ primary: '#1d1d1d', onPrimary: '#ffffff' }, { primary: '#ffffff', onPrimary: '#1d1d1d' }],
    [{ primary: '#0c322c', onPrimary: '#ffffff' }, { primary: '#30ba78', onPrimary: '#000000' }],
  ] as const) {
    const gated = hcBlocks(chromeBrandCss(pair[0], pair[1]));
    for (const theme of pinned) assert.ok(gated.has(theme), `${pair[1].primary}: a gated ${theme} block`);
  }
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
  // are contrastText's picks (white on dark teal, black on Jungle green) -
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
    '  --primary-foreground: 0 0% 0%;',
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

test('chrome ink stays readable on mid-tone brand accents', () => {
  for (const [fill, ink] of [['#30ba78', '#000000'], ['#0c322c', '#ffffff'], ['#6336b5', '#ffffff'], ['#808080', '#000000']])
    assert.equal(contrastText(fill!), ink);
});

// ── Surfaces, the High contrast ring and the error-text red ─────────────────

const TOKENS_CSS = readFileSync(new URL('./styles/tokens.css', import.meta.url), 'utf8');

/** `--name: value` declarations of one block, comments stripped. */
function declsOf(body: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of body.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/--([\w-]+):\s*([^;]+);/g)) out.set(m[1]!, m[2]!.trim());
  return out;
}

/** tokens.css's static theme block whose selector starts with `head`. */
function staticBlock(head: string): Map<string, string> {
  const at = TOKENS_CSS.indexOf(head);
  assert.ok(at >= 0, `tokens.css has ${head}`);
  const open = TOKENS_CSS.indexOf('{', at);
  return declsOf(TOKENS_CSS.slice(open + 1, TOKENS_CSS.indexOf('\n}', open)));
}

const STATIC = {
  light: () => staticBlock(':root,\n[data-theme="light"] {\n  color-scheme: light;'),
  dark: () => staticBlock('\n[data-theme="dark"] {\n  color-scheme: dark;'),
  brand: () => staticBlock('\n[data-theme="brand"] {\n  color-scheme: dark;'),
} as const;
const HIGH = (theme: 'light' | 'dark' | 'brand'): Map<string, string> => declsOf(hcBlocks(TOKENS_CSS).get(theme) ?? '');

/** Two hexes within one 8-bit step per channel: an HSL triple rounded to a
 *  tenth can land one step away from the hex it was made from. */
function near(a: string | null, b: string | null): boolean {
  const x = a ? parseHex(a) : null, y = b ? parseHex(b) : null;
  return !!x && !!y && [0, 1, 2].every(i => Math.abs(x[i]! - y[i]!) <= 1);
}

test('hslTripleToHex reverses hexToHslTriple', () => {
  for (const hex of ['#0c322c', '#30ba78', '#ffffff', '#000000', '#dc2828', '#6d28d9', '#fde047']) {
    assert.ok(near(hslTripleToHex(hexToHslTriple(hex)!), hex), hex);
  }
  assert.equal(hslTripleToHex('224 71% 4%'), '#030711'); // rgb(3 7 17), as a browser computes it
  assert.equal(hslTripleToHex('not a triple'), null);
});

test('the surface tables match tokens.css, high contrast included', () => {
  const roles = ['background', 'card', 'popover', 'muted', 'accent'] as const;
  for (const theme of ['light', 'dark', 'brand'] as const) {
    const base = STATIC[theme]();
    for (const role of roles) assert.equal(THEME_SURFACES[theme][role], base.get(role), `${theme} ${role}`);
    if (theme === 'brand') continue;
    // A high-contrast block re-points some surfaces; the rest stand.
    const high = HIGH(theme);
    for (const role of roles) {
      assert.equal(THEME_SURFACES[`${theme}High`][role], high.get(role) ?? base.get(role), `${theme} high ${role}`);
    }
  }
  // The brand theme's high-contrast block leaves its surfaces to the construction.
  for (const role of roles) assert.equal(HIGH('brand').get(role), undefined, `brand high ${role}`);
  // The fills every danger wash is made of.
  for (const theme of ['light', 'dark', 'brand'] as const) {
    assert.equal(THEME_DESTRUCTIVE[theme], STATIC[theme]().get('destructive'), `${theme} destructive`);
    assert.equal(THEME_DESTRUCTIVE[`${theme}High`], HIGH(theme).get('destructive') ?? STATIC[theme]().get('destructive'), `${theme} high destructive`);
  }
});

test('brandSurfaceHexes are the surfaces brandThemeCss lays down', () => {
  const roles = ['background', 'card', 'popover', 'muted', 'accent'] as const;
  for (const lp of ['#0c322c', '#1d1d1d', '#6d28d9', '#7a5c00']) {
    const built = declsOf(brandThemeCss(lp, '#30ba78'));
    const ours = brandSurfaceHexes(lp, roles);
    roles.forEach((role, i) => { assert.ok(near(ours[i]!, hslTripleToHex(built.get(role)!)), `${lp} ${role}`); });
  }
  assert.deepEqual(brandSurfaceHexes('nope'), []);
});

/** The high-contrast page, cards and popovers a ring sits on, per theme. */
function ringSurfaces(theme: string, lightPrimary: string): string[] {
  if (theme === 'brand') return brandSurfaceHexes(lightPrimary);
  const set = THEME_SURFACES[theme === 'dark' ? 'darkHigh' : 'lightHigh'];
  return [set.background, set.card, set.popover].map(t => hslTripleToHex(t)!);
}

test('under High contrast the ring follows a brand that can be seen, in every theme', () => {
  // The blank starter: ink in light, paper in dark and brand.
  const starter = hcBlocks(chromeBrandCss({ primary: '#1d1d1d', onPrimary: '#ffffff' }, { primary: '#ffffff', onPrimary: '#1d1d1d' }));
  assert.match(starter.get('light') ?? '', /--ring: 0 0% 11\.4%;/);
  assert.match(starter.get('dark') ?? '', /--ring: 0 0% 100%;/);
  assert.match(starter.get('brand') ?? '', /--ring: 0 0% 100%;/);
  // SUSE: Pine in light, where the pair already clears the bar; the repaired
  // Jungle in dark and brand - the very fill the main button wears.
  const suse = hcBlocks(chromeBrandCss({ primary: '#0c322c', onPrimary: '#ffffff' }, { primary: '#30ba78', onPrimary: '#000000' }));
  assert.match(suse.get('light') ?? '', new RegExp(`--ring: ${hexToHslTriple('#0c322c')!.replace(/\./g, '\\.')};`));
  for (const theme of ['dark', 'brand']) {
    const block = declsOf(suse.get(theme) ?? '');
    assert.ok(block.get('primary'), `${theme}: a repaired fill`);
    assert.equal(block.get('ring'), block.get('primary'), `${theme}: the ring is the button's fill`);
  }
});

test("under High contrast a violet brand's repaired fill now carries the ring", () => {
  // The violet #287 used to show Lolly's ring standing in: its label-only
  // repair (#8252d6, white) read 2.8:1 on its own brand theme. The repair now
  // holds the fill at 3:1 on that theme too, so the ring follows the brand.
  // No case is left where Lolly's ring has to stand in the brand theme: the
  // sweep below finds a fill that reads for every hue.
  const light = { primary: '#6d28d9', onPrimary: '#ffffff' };
  const blocks = hcBlocks(chromeBrandCss(light, { primary: '#a678ff', onPrimary: '#000000' }));
  const brand = declsOf(blocks.get('brand') ?? '');
  const fill = hslTripleToHex(brand.get('primary')!)!;
  const worst = Math.min(...ringSurfaces('brand', light.primary).map(s => contrastRatio(fill, s)));
  assert.ok(worst >= FOCUS_RING_RATIO, `the repaired fill reads on its brand theme (${worst.toFixed(2)}:1)`);
  assert.equal(brand.get('ring'), brand.get('primary'), "the ring is the button's fill");
  // The dark theme judges the label alone, as before, and its fill already
  // reads on the near-black page, so there it is the ring too.
  assert.equal(declsOf(blocks.get('dark') ?? '').get('ring'), declsOf(blocks.get('dark') ?? '').get('primary'));
});

// ── High contrast: the brand theme's main button reads on its own page ──────

/** The brand theme's High contrast pair for one brand, as hexes. */
function brandHcPair(light: { primary: string; onPrimary: string | null }, dark: { primary: string; onPrimary: string | null }) {
  const brand = declsOf(hcBlocks(chromeBrandCss(light, dark)).get('brand') ?? '');
  return {
    fill: hslTripleToHex(brand.get('primary') ?? '')!,
    ink: hslTripleToHex(brand.get('primary-foreground') ?? '')!,
    ring: brand.get('ring'),
    primary: brand.get('primary'),
  };
}

/** Every bar the brand theme's High contrast button has to meet: the fill at
 *  `ratio` (CONTROL_RATIO) on the page, cards and popovers; the label at 4.5:1
 *  and at HC_TARGET_LC; and only the lightness moved. Returns the failures, so
 *  a sweep can list them all. */
function controlFailures(name: string, lightPrimary: string, darkPrimary: string, fill: string, ink: string, ratio = CONTROL_RATIO): string[] {
  const out: string[] = [];
  if (!fill || !ink) return [`${name}: no pair stated`];
  for (const s of brandSurfaceHexes(lightPrimary)) {
    const r = contrastRatio(fill, s);
    if (!(r >= ratio)) out.push(`${name}: fill ${fill} reads ${r.toFixed(2)}:1 on ${s}`);
  }
  const label = contrastRatio(ink, fill);
  if (!(label >= 4.5)) out.push(`${name}: label ${ink} on ${fill} reads ${label.toFixed(2)}:1`);
  const lc = apcaLcAbs(ink, fill);
  if (!(lc >= HC_TARGET_LC)) out.push(`${name}: label ${ink} on ${fill} is Lc ${lc.toFixed(1)}`);
  // Only the lightness moved: the fill is the brand's own OKLCH hue and chroma
  // at some lightness, through the same sRGB mapping the search uses. (The
  // mapping itself trims chroma, and on warm hues turns the hue a few degrees,
  // where sRGB has no room near white, so the fill is looked for along that
  // line rather than compared channel by channel.)
  const before = hexToOklch(darkPrimary)!;
  const approxL = hexToOklch(fill)!.l;
  let onLine = false;
  for (let l = Math.max(0, approxL - 0.03); l <= Math.min(1, approxL + 0.03) && !onLine; l += 0.0002) {
    onLine = near(oklchToHex({ l, c: before.c, h: before.h }), fill);
  }
  if (!onLine) out.push(`${name}: ${fill} is not ${darkPrimary}'s hue and chroma at another lightness`);
  return out;
}

test("under High contrast a violet brand's main button reads 3:1 on its own brand theme", () => {
  const cases: Array<[string, { primary: string; onPrimary: string | null }, { primary: string; onPrimary: string | null }]> = [
    ['violet', { primary: '#6d28d9', onPrimary: '#ffffff' }, { primary: '#8b5cf6', onPrimary: null }],
    ['Jacaranda', { primary: '#8182d3', onPrimary: '#ffffff' }, { primary: '#8182d3', onPrimary: null }],
    // #7c3aed with white clears the bar unrepaired (Lc 82.8), so today it was
    // restated as it is, at 2.5:1 on its page: the restate path.
    ['#7c3aed', { primary: '#7c3aed', onPrimary: '#ffffff' }, { primary: '#7c3aed', onPrimary: '#ffffff' }],
  ];
  assert.ok(apcaLcAbs('#ffffff', '#7c3aed') >= HC_TARGET_LC, '#7c3aed clears the label bar unrepaired');
  assert.ok(contrastRatio('#7c3aed', brandSurfaceHexes('#7c3aed')[0]!) < CONTROL_RATIO, '#7c3aed sinks into its page');
  for (const [name, light, dark] of cases) {
    const pair = brandHcPair(light, dark);
    assert.deepEqual(controlFailures(name, light.primary, dark.primary, pair.fill, pair.ink), []);
    // The hue holds to 3 degrees, as in the "lifts any hue" test. The chroma
    // cannot hold to 0.01 here: sRGB has far less room for a violet near white
    // than at the brand's own lightness, so the tint keeps what fits and never
    // gains any.
    const before = hexToOklch(dark.primary)!, after = hexToOklch(pair.fill)!;
    const d = Math.abs(after.h - before.h) % 360;
    assert.ok(Math.min(d, 360 - d) < 3, `${name}: hue ${before.h.toFixed(1)} → ${after.h.toFixed(1)}`);
    assert.ok(after.c <= before.c + 0.01, `${name}: chroma ${before.c.toFixed(3)} → ${after.c.toFixed(3)}`);
    // On that mid-dark ground a fill that reads is a light tint: dark label.
    assert.equal(pair.ink, '#000000', `${name}: a dark label on the light fill`);
    assert.equal(pair.ring, pair.primary, `${name}: the ring follows the fill`);
  }
});

test('under High contrast every hue gets a brand-theme button that reads on its page', () => {
  // A light primary at OKLCH L .45 / C .15 for every 15 degrees of hue and the
  // dark primary at L .62 on the same hue, plus one near-neutral. The dark ink
  // is first unknown, then the ink the ungated block computes.
  const failures: string[] = [];
  const hues: Array<[number, number]> = [];
  for (let h = 0; h < 360; h += 15) hues.push([h, 0.15]);
  hues.push([250, 0.01]);
  for (const [h, c] of hues) {
    const lightPrimary = oklchToHex({ l: 0.45, c, h });
    const darkPrimary = oklchToHex({ l: 0.62, c, h });
    for (const onPrimary of [null, contrastText(darkPrimary)]) {
      const name = `h ${h} c ${c} (${lightPrimary} / ${darkPrimary}, ink ${onPrimary ?? 'unknown'})`;
      const pair = brandHcPair({ primary: lightPrimary, onPrimary: '#ffffff' }, { primary: darkPrimary, onPrimary });
      // A twentieth of headroom on the fill for the HSL triple's rounding.
      failures.push(...controlFailures(name, lightPrimary, darkPrimary, pair.fill, pair.ink, CONTROL_RATIO - 0.05));
    }
  }
  assert.deepEqual(failures, [], `hues with no brand-theme solution:\n${failures.join('\n')}`);
});

test('highContrastAccent holds the fill to its surfaces only when given them', () => {
  const page = brandSurfaceHexes('#7c3aed');
  // A pair whose label clears the bar but whose fill sinks into the page: left
  // alone without surfaces, moved with them.
  assert.equal(highContrastAccent('#7c3aed', '#ffffff'), null);
  const moved = highContrastAccent('#7c3aed', '#ffffff', page)!;
  assert.ok(moved, 'the sinking fill is repaired');
  assert.notEqual(moved.fill, '#7c3aed');
  for (const s of page) assert.ok(contrastRatio(moved.fill, s) >= CONTROL_RATIO, `${moved.fill} on ${s}`);
  assert.ok(apcaLcAbs(moved.ink, moved.fill) >= HC_TARGET_LC);
  // A pair that already reads on the surfaces it is given is still left alone.
  assert.equal(highContrastAccent('#0c322c', '#f7f7f5', ['#ffffff']), null);
  // Without surfaces, the result is exactly the label-only repair it was
  // before the surfaces existed (values from main before the change).
  const pinned: Array<[string, string | null, { fill: string; ink: string } | null]> = [
    ['#30ba78', '#08211d', { fill: '#69eaa4', ink: '#000000' }],
    ['#a678ff', '#1c1c22', { fill: '#8252d6', ink: '#ffffff' }],
    ['#808080', '#ffffff', { fill: '#6f6f6f', ink: '#ffffff' }],
    ['#8b5cf6', null, { fill: '#7e4de6', ink: '#ffffff' }],
    ['#7b3fe4', '#ffffff', null],
  ];
  for (const [primary, ink, want] of pinned) {
    assert.deepEqual(highContrastAccent(primary, ink), want, `${primary} without surfaces`);
    assert.deepEqual(highContrastAccent(primary, ink, []), want, `${primary} with []`);
  }
  // Surfaces the label-only repair already reads on change nothing.
  assert.deepEqual(highContrastAccent('#30ba78', '#08211d', brandSurfaceHexes('#0c322c')), { fill: '#69eaa4', ink: '#000000' });
});

test('every ring emitted under High contrast reads 3:1 on the surfaces it sits on', () => {
  const brands: Array<[{ primary: string; onPrimary: string | null }, { primary: string; onPrimary: string | null }]> = [
    [{ primary: '#1d1d1d', onPrimary: '#ffffff' }, { primary: '#ffffff', onPrimary: '#1d1d1d' }],
    [{ primary: '#0c322c', onPrimary: '#ffffff' }, { primary: '#30ba78', onPrimary: '#000000' }],
    [{ primary: '#7a5c00', onPrimary: '#ffffff' }, { primary: '#fde047', onPrimary: '#000000' }],
    [{ primary: '#6d28d9', onPrimary: '#ffffff' }, { primary: '#a678ff', onPrimary: '#000000' }],
    [{ primary: '#1e3a8a', onPrimary: '#ffffff' }, { primary: '#3b82f6', onPrimary: '#ffffff' }],
    [{ primary: '#eab308', onPrimary: null }, { primary: '#eab308', onPrimary: null }],
  ];
  let rings = 0;
  for (const [light, dark] of brands) {
    for (const [theme, body] of hcBlocks(chromeBrandCss(light, dark))) {
      const ring = declsOf(body).get('ring');
      if (!ring) continue;
      rings++;
      const hex = hslTripleToHex(ring)!;
      for (const s of ringSurfaces(theme, light.primary)) {
        // A twentieth of headroom for the triple's rounding.
        assert.ok(contrastRatio(hex, s) >= FOCUS_RING_RATIO - 0.05, `${light.primary}/${dark.primary} ${theme}: ${hex} on ${s}`);
      }
    }
  }
  assert.ok(rings >= 12, `rings were emitted (${rings})`);
});

test('dangerText keeps a red that already reads and walks one that does not', () => {
  assert.equal(dangerText('#B00020', ['#ffffff']), '#b00020', 'already reads on white: unchanged');
  const dark = dangerTextSurfaces('dark');
  const lifted = dangerText('#9e2424', dark)!;
  for (const s of dark) assert.ok(contrastRatio(lifted, s) >= DANGER_TEXT_RATIO, `${lifted} on ${s}`);
  const from = hexToOklch('#9e2424')!, to = hexToOklch(lifted)!;
  assert.ok(to.l > from.l, 'lighter on a dark page');
  assert.ok(Math.abs(to.h - from.h) < 6, `still the same red (hue ${from.h.toFixed(1)} to ${to.h.toFixed(1)})`);
  // High contrast: the APCA body-text floor on every surface.
  const darkHigh = dangerTextSurfaces('dark', true);
  const pale = dangerText('#c11f1f', darkHigh, true)!;
  for (const s of darkHigh) assert.ok(apcaLcAbs(pale, s) >= DANGER_TEXT_HC_LC, `${pale} on ${s}`);
  // A brand theme of any hue: one value reads on all of them.
  const anyBrand = dangerText('#a63030', dangerTextSurfaces('brand'))!;
  for (const lp of ['#0c322c', '#1d1d1d', '#6d28d9', '#7a5c00', '#e0452b', '#0ea5e9']) {
    for (const s of brandSurfaceHexes(lp, ['background', 'card', 'popover', 'muted'])) {
      assert.ok(contrastRatio(anyBrand, s) >= DANGER_TEXT_RATIO, `${anyBrand} on ${lp}'s ${s}`);
    }
  }
  assert.equal(dangerText('not-a-colour', dark), null);
  assert.equal(dangerText('#9e2424', []), null);
});

test("tokens.css carries the text reds dangerText computes from each theme's own red", () => {
  for (const theme of ['light', 'dark', 'brand'] as const) {
    for (const high of [false, true]) {
      const block = high ? HIGH(theme) : STATIC[theme]();
      const fill = (high ? block.get('destructive') : undefined) ?? STATIC[theme]().get('destructive');
      const text = block.get('destructive-text');
      assert.ok(fill && text, `${theme}${high ? ' high' : ''} declares --destructive and --destructive-text`);
      const expected = dangerText(hslTripleToHex(fill!)!, dangerTextSurfaces(theme, high), high);
      assert.ok(near(hslTripleToHex(text!), expected), `${theme}${high ? ' high' : ''}: tokens.css ${text} vs dangerText ${expected}`);
    }
  }
});

test("dangerTextCss gives a design system's own red a text red per theme", () => {
  const css = dangerTextCss('#b00020');
  const blocks = [...css.matchAll(/([^{}]+)\{\s*--destructive-text: ([^;]+);\s*\}/g)].map(m => [m[1]!.trim(), m[2]!] as const);
  assert.deepEqual(blocks.map(b => b[0]), [
    ':root, [data-theme="light"]', '[data-theme="dark"]', '[data-theme="brand"]',
    'html[data-a11y-contrast="high"]:not([data-theme="dark"]):not([data-theme="brand"])',
    'html[data-a11y-contrast="high"][data-theme="dark"]', 'html[data-a11y-contrast="high"][data-theme="brand"]',
  ]);
  const themes = [['light', false], ['dark', false], ['brand', false], ['light', true], ['dark', true], ['brand', true]] as const;
  blocks.forEach(([sel, triple], i) => {
    const [theme, high] = themes[i]!;
    const hex = hslTripleToHex(triple)!;
    for (const s of dangerTextSurfaces(theme, high)) {
      const ok = high ? apcaLcAbs(hex, s) >= DANGER_TEXT_HC_LC - 0.5 : contrastRatio(hex, s) >= DANGER_TEXT_RATIO - 0.05;
      assert.ok(ok, `${sel}: ${hex} on ${s}`);
    }
  });
  // The light theme keeps a red that already reads there.
  assert.ok(near(hslTripleToHex(blocks[0]![1])!, '#b00020'));
  assert.equal(dangerTextCss(null), '');
  assert.equal(dangerTextCss('not-a-colour'), '');
});

test("the blank brand's noir is byte-identical: the brand theme never reads Lolly's tone", () => {
  // Captured from origin/main before the tone moved to Opal (the theme at 05f7a9eff,
  // the chrome at 88ccf581c, which added #287's High contrast ring). The blank
  // starter (#1d1d1d light, #ffffff dark, chroma 0) keeps its rose-grey noir.
  const noirTheme = [
    "[data-theme=\"brand\"] {\n",
    "  color-scheme: dark;\n",
    "  --background: 348 5.6% 17.5%;\n",
    "  --foreground: 0 6.2% 93.7%;\n",
    "  --foreground-canvas: 0 6.2% 93.7%;\n",
    "  --card: 350 5% 23.5%;\n",
    "  --card-foreground: 0 6.2% 93.7%;\n",
    "  --popover: 350 5% 23.5%;\n",
    "  --popover-foreground: 0 6.2% 93.7%;\n",
    "  --primary: 0 0% 100%;\n",
    "  --primary-foreground: 0 0% 0%;\n",
    "  --secondary: 342.9 5% 27.6%;\n",
    "  --secondary-foreground: 0 6.2% 93.7%;\n",
    "  --muted: 342.9 5.2% 26.5%;\n",
    "  --muted-foreground: 345 6.2% 87.5%;\n",
    "  --accent: 345 5.5% 28.6%;\n",
    "  --accent-foreground: 0 6.2% 93.7%;\n",
    "  --border: 340 4.3% 40.6%;\n",
    "  --input: 340 4.3% 40.6%;\n",
    "  --ring: 0 0% 100%;\n",
    "  --store-1: 345 1.8% 56.5%;\n",
    "  --store-2: 348 2.6% 62.5%;\n",
    "  --store-3: 348 3% 67.3%;\n",
    "  --store-4: 348 3.7% 73.5%;\n",
    "  --store-5: 348 4.9% 79.8%;\n",
    "  --store-other: 340 1.2% 52.7%;\n",
    "}",
  ].join('');
  const noirChrome = [
    ":root, [data-theme=\"light\"] {\n",
    "  --primary: 0 0% 11.4%;\n",
    "  --ring: 0 0% 11.4%;\n",
    "  --primary-foreground: 0 0% 100%;\n",
    "}\n",
    "[data-theme=\"dark\"] {\n",
    "  --primary: 0 0% 100%;\n",
    "  --ring: 0 0% 100%;\n",
    "  --primary-foreground: 0 0% 0%;\n",
    "}\n",
    "[data-theme=\"brand\"] {\n",
    "  color-scheme: dark;\n",
    "  --background: 348 5.6% 17.5%;\n",
    "  --foreground: 0 6.2% 93.7%;\n",
    "  --foreground-canvas: 0 6.2% 93.7%;\n",
    "  --card: 350 5% 23.5%;\n",
    "  --card-foreground: 0 6.2% 93.7%;\n",
    "  --popover: 350 5% 23.5%;\n",
    "  --popover-foreground: 0 6.2% 93.7%;\n",
    "  --primary: 0 0% 100%;\n",
    "  --primary-foreground: 0 0% 0%;\n",
    "  --secondary: 342.9 5% 27.6%;\n",
    "  --secondary-foreground: 0 6.2% 93.7%;\n",
    "  --muted: 342.9 5.2% 26.5%;\n",
    "  --muted-foreground: 345 6.2% 87.5%;\n",
    "  --accent: 345 5.5% 28.6%;\n",
    "  --accent-foreground: 0 6.2% 93.7%;\n",
    "  --border: 340 4.3% 40.6%;\n",
    "  --input: 340 4.3% 40.6%;\n",
    "  --ring: 0 0% 100%;\n",
    "  --store-1: 345 1.8% 56.5%;\n",
    "  --store-2: 348 2.6% 62.5%;\n",
    "  --store-3: 348 3% 67.3%;\n",
    "  --store-4: 348 3.7% 73.5%;\n",
    "  --store-5: 348 4.9% 79.8%;\n",
    "  --store-other: 340 1.2% 52.7%;\n",
    "}\n",
    "html[data-a11y-contrast=\"high\"]:not([data-theme=\"dark\"]):not([data-theme=\"brand\"]) {\n",
    "  --ring: 0 0% 11.4%;\n",
    "}\n",
    "html[data-a11y-contrast=\"high\"][data-theme=\"dark\"] {\n",
    "  --primary: 0 0% 100%;\n",
    "  --primary-foreground: 0 0% 0%;\n",
    "  --ring: 0 0% 100%;\n",
    "}\n",
    "html[data-a11y-contrast=\"high\"][data-theme=\"brand\"] {\n",
    "  --primary: 0 0% 100%;\n",
    "  --primary-foreground: 0 0% 0%;\n",
    "  --ring: 0 0% 100%;\n",
    "}",
  ].join('');
  assert.equal(brandThemeCss('#1d1d1d', '#ffffff'), noirTheme);
  assert.equal(
    chromeBrandCss({ primary: '#1d1d1d', onPrimary: '#ffffff' }, { primary: '#ffffff', onPrimary: '#1d1d1d' }),
    noirChrome,
  );
});

test("Lolly's tone is Opal: Spearmint on light, Green Apple on dark, and the mark reproduces both", () => {
  assert.deepEqual({ ...LOLLY_TONE_HEX }, { light: '#033633', dark: '#50c369' });
  assert.equal(lollyMarkHex(hexToOklch('#033633')!.h, 'light'), '#033633');
  assert.equal(lollyMarkHex(hexToOklch('#50c369')!.h, 'dark'), '#50c369');
});

test("the brand-hued mark stays readable at every hue: 4.5:1 on light and dark grounds", () => {
  for (let hue = 0; hue <= 330; hue += 30) {
    const light = lollyMarkHex(hue, 'light');
    for (const ground of ['#ffffff', '#f1f5f9'])
      assert.ok(contrastRatio(light, ground) >= 4.5, `light mark ${light} (hue ${hue}) on ${ground}: ${contrastRatio(light, ground).toFixed(2)}`);
    const dark = lollyMarkHex(hue, 'dark');
    assert.ok(contrastRatio(dark, '#090e1a') >= 4.5, `dark mark ${dark} (hue ${hue}) on #090e1a: ${contrastRatio(dark, '#090e1a').toFixed(2)}`);
  }
});

// ── A pack's own chrome (lib/brand-chrome.ts) ────────────────────────────────

const { createTokenSet } = await import('../../../engine/src/tokens.ts');
const { CHROME_SEL, DANGER_WASH_ALPHA, applyChromeAccent, tokenValueToHex } = await import('./brand-vars.ts');
const { deriveChrome, resolvePackChrome, chromeIssues } = await import('./lib/brand-chrome.ts');

const SUSE_PAIR = [{ primary: '#0c322c', onPrimary: '#f7f7f5' }, { primary: '#30ba78', onPrimary: '#08211d' }] as const;
const START_PAIR = [{ primary: '#1d1d1d', onPrimary: '#ffffff' }, { primary: '#ffffff', onPrimary: '#1d1d1d' }] as const;

/** lolly-start's newsprint room, as the C1 plan gives it (section 5). */
function newsprint(): import('./lib/brand-chrome.ts').PackChrome {
  const light = deriveChrome('light', { page: '#fcfaf6', raised: '#fefdfa', overlay: '#ffffff', muted: '#f3f0e9', hover: '#eeebe4', edge: '#dbd7cf', ink: '#171612', 'muted-ink': '#5e5b53' })!;
  const dark = deriveChrome('dark', { page: '#171612', raised: '#201e1a', overlay: '#201e1a', muted: '#282621', hover: '#32302b', edge: '#403d36', ink: '#eae8e2', 'muted-ink': '#c1bdb5' })!;
  assert.deepEqual([...chromeIssues('light', light, apcaLcAbs), ...chromeIssues('dark', dark, apcaLcAbs)], []);
  return { light, dark, unsaved: {}, issues: [] };
}

/** The Opal fixture's chrome and primaries, resolved through the engine per theme. */
async function opal(): Promise<{ chrome: import('./lib/brand-chrome.ts').PackChrome; light: { primary: string | null; onPrimary: string | null }; dark: { primary: string | null; onPrimary: string | null } }> {
  const doc = JSON.parse(readFileSync(new URL('../../../tests/fixtures/pack-chrome/opal.json', import.meta.url), 'utf8'));
  const tokens = {
    resolve: async (ref: string, opts: { theme?: string } = {}) => createTokenSet(doc, { theme: opts.theme }).resolve(ref),
    themes: async () => createTokenSet(doc).themes(),
  };
  const pair = async (theme: string) => ({
    primary: tokenValueToHex(await tokens.resolve('{color.semantic.primary}', { theme })),
    onPrimary: tokenValueToHex(await tokens.resolve('{color.semantic.on-primary}', { theme })),
  });
  return { chrome: await resolvePackChrome(tokens, { toHex: tokenValueToHex, lc: apcaLcAbs }), light: await pair('light'), dark: await pair('dark') };
}

/** Selector to declarations, for every block of a generated sheet, in order. */
function sheetBlocks(css: string): Array<[string, Map<string, string>]> {
  return [...css.matchAll(/([^{}\n][^{}]*) \{\n([^}]*)\n\}/g)].map((m) => [m[1]!, declsOf(m[2]!)]);
}

test('without pack chrome the sheet is what it was: no chrome, null and an empty group are identical', () => {
  for (const [light, dark] of [SUSE_PAIR, START_PAIR]) {
    const before = chromeBrandCss(light, dark);
    assert.equal(chromeBrandCss(light, dark, null), before);
    assert.equal(chromeBrandCss(light, dark, undefined, '#b00020'), before, 'a danger red alone adds nothing');
    assert.equal(chromeBrandCss(light, dark, { unsaved: {}, issues: [] }), before);
    assert.equal(chromeBrandCss(light, dark, { unsaved: {}, issues: ['dark: page #fcfaf6 has OKLCH lightness 0.986, outside 0 to 0.4'] }), before);
  }
});

test("lolly-start's newsprint chrome leaves its noir brand theme untouched", () => {
  const css = chromeBrandCss(START_PAIR[0], START_PAIR[1], newsprint());
  const brand = sheetBlocks(css).filter(([sel]) => sel === '[data-theme="brand"]');
  assert.equal(brand.length, 1, 'one brand block: the constructed noir, no brand chrome');
  assert.ok(css.includes(brandThemeCss('#1d1d1d', '#ffffff')), 'the noir block is byte for byte the construction');
  // The pack's chrome never reaches the render canvas's ink.
  assert.equal(css.split('--foreground-canvas').length - 1, 1, 'only the constructed brand theme declares --foreground-canvas');
  // Its light and dark blocks carry the newsprint triples.
  const blocks = new Map(sheetBlocks(css));
  assert.equal(blocks.get(CHROME_SEL.light)?.get('background'), hexToHslTriple('#fcfaf6'));
  assert.equal(blocks.get(CHROME_SEL.dark)?.get('card'), hexToHslTriple('#201e1a'));
});

test('Opal: per-theme chrome blocks, gated off under High contrast, with reading error text and Honey for unsaved work', async () => {
  const { chrome, light, dark } = await opal();
  const css = chromeBrandCss(light, dark, chrome);
  const blocks = sheetBlocks(css);
  const bySel = new Map(blocks);
  const expect: Record<'light' | 'dark', Record<string, string>> = {
    light: { background: '#edf6e0', card: '#ffffff', popover: '#ffffff', muted: '#e2ebd6', secondary: '#e2ebd6', accent: '#dde6d0', border: '#ace1ad', input: '#ace1ad', foreground: '#09141a', 'card-foreground': '#09141a', 'muted-foreground': '#373e44' },
    dark: { background: '#09141a', card: '#121d24', popover: '#1c282f', muted: '#1c282f', accent: '#2d3a41', border: '#373e44', foreground: '#ffffff', 'popover-foreground': '#ffffff', 'muted-foreground': '#99a0a4' },
  };
  for (const theme of ['light', 'dark'] as const) {
    const decls = bySel.get(CHROME_SEL[theme]);
    assert.ok(decls, `a ${theme} chrome block`);
    for (const [name, hex] of Object.entries(expect[theme])) assert.equal(decls!.get(name), hexToHslTriple(hex), `${theme} --${name}`);
    assert.equal(decls!.get('foreground-canvas'), undefined, `${theme}: never the canvas ink`);
    assert.equal(decls!.get('primary'), undefined, `${theme}: never the accent`);
    // Every arm steps aside under High contrast, and none leads with the attribute.
    for (const arm of CHROME_SEL[theme].split(', ')) {
      assert.ok(arm.includes(':not([data-a11y-contrast="high"])'), `${theme} arm ${arm}`);
      assert.ok(!arm.startsWith('html[data-a11y-contrast'), `${theme} arm ${arm}`);
    }
    // The error-text red reads 4.5:1 on every pack surface and on a danger wash over the resting ones.
    const text = hslTripleToHex(decls!.get('destructive-text')!)!;
    const c = chrome[theme]!;
    const fill = hslTripleToHex(THEME_DESTRUCTIVE[theme])!;
    const resting = [c.page, c.raised, c.overlay, c.muted];
    const washes = resting.map((s) => {
      const t = parseHex(fill)!, b = parseHex(s)!;
      return '#' + [0, 1, 2].map((i) => Math.round(t[i]! * DANGER_WASH_ALPHA + b[i]! * (1 - DANGER_WASH_ALPHA)).toString(16).padStart(2, '0')).join('');
    });
    for (const s of [...resting, c.hover, ...washes]) {
      assert.ok(contrastRatio(text, s) >= DANGER_TEXT_RATIO - 0.05, `${theme}: ${text} on ${s} reads ${contrastRatio(text, s).toFixed(2)}`);
    }
    // The static text red did not read on all of them, which is why the block states a red of its own.
    const staticText = hslTripleToHex(STATIC[theme]().get('destructive-text')!)!;
    assert.ok([...resting, c.hover, ...washes].some((s) => contrastRatio(staticText, s) < DANGER_TEXT_RATIO), `${theme}: the static red needed the walk`);
  }
  // Unsaved: three ungated blocks, Honey deep in light, Honey in dark and in brand (from dark).
  const warn = blocks.filter(([, decls]) => decls.has('brand-warn')).map(([sel, decls]) => [sel, decls.get('brand-warn'), decls.get('brand-warn-ink')]);
  assert.deepEqual(warn, [
    [':root, [data-theme="light"]', '#b57c0a', '#000000'],
    ['[data-theme="dark"]', '#fac044', '#000000'],
    ['[data-theme="brand"]', '#fac044', '#000000'],
  ]);
  // The pack blocks sit after Lolly's mark and before the High contrast blocks.
  const order = blocks.map(([sel]) => sel);
  assert.ok(order.indexOf(CHROME_SEL.light) > order.lastIndexOf('[data-theme="dark"], [data-theme="brand"]'));
  assert.ok(order.indexOf(CHROME_SEL.dark) < order.findIndex((sel) => sel.startsWith('html[data-a11y-contrast')));
});

test("pack chrome walks the design system's own danger red when it declares one", async () => {
  const { chrome, light, dark } = await opal();
  const bauxite = '#a43427';
  const css = chromeBrandCss(light, dark, chrome, bauxite);
  const text = hslTripleToHex(new Map(sheetBlocks(css)).get(CHROME_SEL.light)!.get('destructive-text')!)!;
  const d = Math.abs(hexToOklch(text)!.h - hexToOklch(bauxite)!.h);
  assert.ok(Math.min(d, 360 - d) < 6, `${text} keeps Bauxite's hue`);
  assert.ok(contrastRatio(text, chrome.light!.page) >= DANGER_TEXT_RATIO);
});

test('applyChromeAccent is a no-op without a document', () => {
  assert.doesNotThrow(() => applyChromeAccent(SUSE_PAIR[0], SUSE_PAIR[1], newsprint()));
});
