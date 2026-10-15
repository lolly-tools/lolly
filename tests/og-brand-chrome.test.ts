// SPDX-License-Identifier: MPL-2.0
/**
 * Share card chrome (docs/og-image.ts, loadBrandChrome).
 *
 * The OG cards are painted in the active profile's brand colours, read from its
 * catalog through the content resolver. These tests pin that contract without a
 * browser: a temporary fixture root carries one profile per scenario, the real
 * repository checks the shipped lolly-start profile (and SUSE when the private
 * submodule is present), and a fake rasteriser captures the card SVG so the second
 * mark can be counted. The blank starter and any unreadable or illegible brand get
 * Lolly's own Opal chrome, and Lolly's own logo is never shown twice.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import {
  OPAL_CHROME, STARTER_TOKENS_ID, chromeFingerprint, createToolCardRenderer, loadBrandChrome,
  type BrandChrome,
} from '../docs/og-image.ts';
import { contentRoots } from '../packages/node-shell/src/content-roots.ts';

const ROOT = join(import.meta.dirname, '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

// ── Independent colour maths (not imported, so the module is checked, not echoed) ──

function mix(a: string, b: string, t: number): string {
  const p = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return '#' + x.map((v, i) => Math.round(v + (y[i]! - v) * t).toString(16).padStart(2, '0')).join('');
}

function ratio(a: string, b: string): number {
  const lum = (h: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(h.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

// ── Fixture root: one profile per scenario ──────────────────────────────────

const FIX = mkdtempSync(join(tmpdir(), 'lolly-og-chrome-'));
after(() => rmSync(FIX, { recursive: true, force: true }));

function put(rel: string, body: string): void {
  const file = join(FIX, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, body);
}

/** A minimal layered DTCG document whose dark theme carries the given semantic slots. */
function tokensDoc(slots: Record<string, string>): string {
  const semantic = Object.fromEntries(Object.entries(slots).map(([k, v]) => [k, { $value: v }]));
  return JSON.stringify({
    $themes: [
      { name: 'light', selectedTokenSets: { base: 'enabled', light: 'enabled' } },
      { name: 'dark', selectedTokenSets: { base: 'enabled', dark: 'enabled' } },
    ],
    base: { color: { $type: 'color', ramp: { grey: { 1: { $value: '#111111' } } } } },
    light: { color: { $type: 'color', semantic: { surface: { $value: '#ffffff' } } } },
    dark: { color: { $type: 'color', semantic },
    },
  });
}

const svg = (w: number, h: number, marker: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" data-marker="${marker}"><rect width="${w}" height="${h}" fill="#fff"/></svg>`;

interface FixtureAsset { id: string; type: string; tags: string[]; format: string; file: string; body: string }

const tokensAsset = (id: string, body: string): FixtureAsset => ({
  id, type: 'tokens', tags: ['tokens', 'brand', 'dtcg'], format: 'json', file: `assets/${id}.json`, body,
});
const logoAsset = (id: string, tags: string[], w: number, h: number): FixtureAsset => ({
  id, type: 'vector', tags: ['logo', ...tags], format: 'svg', file: `assets/${id}.svg`, body: svg(w, h, id),
});

const ACME = { surface: '#101820', primary: '#ffb000', text: '#ffffff' };

const PROFILES: Record<string, FixtureAsset[] | null> = {
  fixture: [
    tokensAsset('acme/tokens/brand', tokensDoc(ACME)),
    logoAsset('acme/logo/plain-white', ['on-dark'], 100, 100),
    logoAsset('acme/logo/hor-white', ['horizontal', 'mono', 'on-dark'], 400, 100),
    logoAsset('acme/logo/hor-colour', ['horizontal'], 400, 100),
  ],
  lollylogo: [
    tokensAsset('acme/tokens/brand', tokensDoc(ACME)),
    logoAsset('lolly/logo/reverse', ['lolly', 'mark', 'on-dark'], 100, 100),
    logoAsset('lolly/logo/mono-reverse', ['lolly', 'mark', 'mono', 'on-dark'], 100, 100),
  ],
  lollyfirst: [
    tokensAsset('acme/tokens/brand', tokensDoc(ACME)),
    logoAsset('lolly/logo/reverse', ['lolly', 'mark', 'on-dark'], 100, 100),
    logoAsset('acme/logo/badge-white', ['on-dark'], 200, 100),
  ],
  starter: [tokensAsset(STARTER_TOKENS_ID, tokensDoc({ surface: '#1d1d1d', primary: '#ffffff', text: '#ffffff' }))],
  noindex: null,
  badjson: [tokensAsset('acme/tokens/brand', '{ not json')],
  notext: [tokensAsset('acme/tokens/brand', tokensDoc({ surface: ACME.surface, primary: ACME.primary }))],
  darkdark: [tokensAsset('acme/tokens/brand', tokensDoc({ surface: '#101820', primary: '#ffb000', text: '#2a2a2a' }))],
  faintaccent: [tokensAsset('acme/tokens/brand', tokensDoc({ surface: '#101820', primary: '#202a35', text: '#f0f0f0' }))],
};

put('profiles.json', JSON.stringify({
  default: 'fixture',
  profiles: Object.fromEntries(Object.keys(PROFILES).map(name => [name, { tools: ['tools'], catalog: `catalogs/${name}` }])),
}));
mkdirSync(join(FIX, 'tools'), { recursive: true });
for (const [name, assets] of Object.entries(PROFILES)) {
  mkdirSync(join(FIX, 'catalogs', name), { recursive: true });
  if (!assets) continue; // no assets/index.json at all
  for (const a of assets) put(`catalogs/${name}/${a.file}`, a.body);
  put(`catalogs/${name}/assets/index.json`, JSON.stringify({
    assets: assets.map(a => ({
      id: a.id, type: a.type, tags: a.tags, formats: [{ format: a.format, url: `/catalog/${a.file}` }],
    })),
  }));
}

/** Chrome for a fixture profile. The repo root is the real one, so icon.svg gives the mark. */
const fixtureChrome = (profile: string): BrandChrome =>
  loadBrandChrome(ROOT, contentRoots({ root: FIX, profile }));

const colours = (c: BrandChrome) => ({ field: c.field, accent: c.accent, ink: c.ink });
const OPAL = { field: OPAL_CHROME.field, accent: OPAL_CHROME.accent, ink: OPAL_CHROME.ink };

// ── 1-5: the fixture profiles ──────────────────────────────────────────────

test('1. a brand token pack gives its own dark-theme field, accent and ink', () => {
  const c = fixtureChrome('fixture');
  assert.deepEqual(colours(c), { field: ACME.surface, accent: ACME.primary, ink: ACME.text });
  assert.equal(c.muted, mix(ACME.text, ACME.surface, 0.38));
  assert.equal(c.footer, mix(ACME.text, ACME.surface, 0.58));
});

test('2. a horizontal mono on-dark logo is picked over a plain on-dark one', () => {
  const c = fixtureChrome('fixture');
  assert.ok(c.logo, 'the fixture brand ships an on-dark logo');
  assert.equal(c.logo.ratio, 4);
  assert.match(decodeURIComponent(c.logo.href), /data-marker="acme\/logo\/hor-white"/);
});

test('3. Lolly\'s own marks are never the brand logo', () => {
  assert.equal(fixtureChrome('lollylogo').logo, null);
  // A brand logo listed after a copy of Lolly's mark still wins.
  const c = fixtureChrome('lollyfirst');
  assert.ok(c.logo);
  assert.match(decodeURIComponent(c.logo.href), /data-marker="acme\/logo\/badge-white"/);
  assert.equal(c.logo.ratio, 2);
});

test('4. the starter tokens id gives the Opal chrome even though its slots resolve', () => {
  assert.equal(STARTER_TOKENS_ID, 'lolly/tokens/brand');
  assert.deepEqual(colours(fixtureChrome('starter')), OPAL);
});

test('5. a missing index, bad tokens, a missing slot or illegible ink give Opal, never a throw', () => {
  for (const profile of ['noindex', 'badjson', 'notext', 'darkdark']) {
    let c: BrandChrome | undefined;
    assert.doesNotThrow(() => { c = fixtureChrome(profile); }, profile);
    assert.deepEqual(colours(c!), OPAL, profile);
    assert.equal(c!.muted, mix(OPAL.ink, OPAL.field, 0.38), profile);
  }
  assert.equal(fixtureChrome('noindex').logo, null);
  // A root with no profiles.json makes the resolver throw; that is caught as well.
  const bare = loadBrandChrome(join(FIX, 'tools'));
  assert.deepEqual(colours(bare), OPAL);
  assert.equal(bare.logo, null);
  assert.equal(bare.mark, null, 'no icon.svg under that root');
});

test('5b. an accent too faint for the field gives way to the ink', () => {
  const c = fixtureChrome('faintaccent');
  assert.equal(c.field, '#101820');
  assert.equal(c.ink, '#f0f0f0');
  assert.equal(c.accent, '#f0f0f0');
});

// ── 6-7: the real repository ───────────────────────────────────────────────

test('6. lolly-start renders on Opal with the lollipop once', () => {
  const c = loadBrandChrome(ROOT, contentRoots({ root: ROOT, profile: 'lolly-start' }));
  assert.deepEqual(colours(c), OPAL);
  assert.equal(c.logo, null);
  assert.ok(c.mark, 'icon.svg gives the Lolly mark');
});

const SUSE_INDEX = join(ROOT, 'brands/suse/catalog/assets/index.json');
test('7. SUSE keeps its own colours and logo (read only)', {
  skip: existsSync(SUSE_INDEX) ? false : 'brands/suse is not checked out',
}, () => {
  const c = loadBrandChrome(ROOT, contentRoots({ root: ROOT, profile: 'suse' }));
  assert.deepEqual(colours(c), { field: '#0c322c', accent: '#30ba78', ink: '#ffffff' });
  assert.ok(c.logo);
});

// ── 8: the card SVG, through a fake rasteriser ─────────────────────────────

async function toolCardSvg(chrome: BrandChrome): Promise<{ svg: string; background?: string }> {
  let seen = { svg: '', background: undefined as string | undefined };
  const fake = async (svgText: string, opts: { width: number; height: number; background?: string }) => {
    seen = { svg: svgText, background: opts.background };
    return Buffer.alloc(0);
  };
  await createToolCardRenderer(fake, chrome).render({
    name: 'QR code',
    description: 'Make a QR code.',
    iconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 4h16v16H4z"/></svg>',
  });
  return seen;
}

const imageCount = (s: string) => (s.match(/<image\b/g) ?? []).length;

test('8. the co-brand row shows one lollipop for lolly-start and adds the logo for a brand', async () => {
  const start = loadBrandChrome(ROOT, contentRoots({ root: ROOT, profile: 'lolly-start' }));
  const a = await toolCardSvg(start);
  assert.equal(imageCount(a.svg), 1, 'lolly-start: the lockup mark only');
  assert.match(a.svg, new RegExp(`<rect width="1200" height="630" fill="${OPAL.field}"/>`));
  assert.equal(a.background, OPAL.field);

  const brand = fixtureChrome('fixture');
  const b = await toolCardSvg(brand);
  assert.equal(imageCount(b.svg), 2, 'a brand: the lockup mark and its own logo');
  assert.match(b.svg, new RegExp(`<rect width="1200" height="630" fill="${ACME.surface}"/>`));
});

// ── 9: the fingerprint ──────────────────────────────────────────────────────

test('9. chromeFingerprint follows every chrome input and is stable', () => {
  const base: BrandChrome = {
    ...OPAL, muted: '#9fb3b1', footer: '#6d8a89',
    logo: { href: 'data:image/svg+xml,a', ratio: 4 }, mark: 'data:image/svg+xml,m',
  };
  const fp = chromeFingerprint(base);
  assert.match(fp, /^[0-9a-f]{64}$/);
  assert.equal(chromeFingerprint({ ...base, logo: { ...base.logo! } }), fp);
  const variants: BrandChrome[] = [
    { ...base, field: '#000000' },
    { ...base, accent: '#000000' },
    { ...base, ink: '#000000' },
    { ...base, logo: null },
    { ...base, logo: { href: 'data:image/svg+xml,b', ratio: 4 } },
    { ...base, logo: { href: 'data:image/svg+xml,a', ratio: 3 } },
    { ...base, mark: null },
    { ...base, mark: 'data:image/svg+xml,n' },
  ];
  for (const v of variants) assert.notEqual(chromeFingerprint(v), fp);
});

// ── 10: source guards ───────────────────────────────────────────────────────

test('10. og-image.ts carries no other brand\'s colours and no repo-root catalog path', () => {
  const src = read('docs/og-image.ts');
  assert.doesNotMatch(src, /0c322c|30ba78/i, 'no SUSE Pine or Jungle hex');
  assert.ok(!src.includes("'catalog/assets/index.json'"), 'the catalog comes from the resolver');
  assert.match(src, /from '\.\.\/packages\/node-shell\/src\/content-roots\.ts'/);
  const shell = /export const STARTER_TOKENS_ID = '([^']+)'/.exec(read('shells/web/src/lib/design-system/starter.ts'));
  assert.ok(shell, 'the shell still exports STARTER_TOKENS_ID');
  assert.equal(STARTER_TOKENS_ID, shell[1]);
});

// ── 11: Opal contrast ───────────────────────────────────────────────────────

test('11. the Opal chrome is legible: ink and muted 4.5:1, footer and accent 3:1', () => {
  const c = loadBrandChrome(ROOT, contentRoots({ root: ROOT, profile: 'lolly-start' }));
  assert.ok(ratio(c.ink, c.field) >= 4.5, `ink ${ratio(c.ink, c.field)}`);
  assert.ok(ratio(c.muted, c.field) >= 4.5, `muted ${ratio(c.muted, c.field)}`);
  assert.ok(ratio(c.footer, c.field) >= 3, `footer ${ratio(c.footer, c.field)}`);
  assert.ok(ratio(c.accent, c.field) >= 3, `accent ${ratio(c.accent, c.field)}`);
});
