// SPDX-License-Identifier: MPL-2.0
/**
 * brand-logos.ts - pure doc surgery for the logo tokens (canonical matrix +
 * custom variants + named identities), plus the bridge-backed install/list/
 * remove round-trip on an in-memory host.
 * Run directly:  node --test shells/web/src/lib/brand-logos.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  withLogoToken, logoGroupOf, LOGO_VARIANTS, splitVariant, variantLabel, isReverseTreatment,
  LOGO_SLUG_RE, LOGO_DEFAULT_IDENTITY, isCanonicalVariant, logoAssetId, parseLogoAssetId,
  listLogos, installLogo, removeLogo, USER_LOGO_PREFIX,
} from './brand-logos.ts';
import type { UserFontsHost } from '../user-fonts.ts';
import { USER_TOKENS_ID } from '../bridge/tokens.ts';

test('the matrix is orientation × treatment: 2 × 4 = 8 optional slots', () => {
  assert.equal(LOGO_VARIANTS.length, 8);
  for (const v of ['horizontal-primary', 'horizontal-primary-reverse', 'horizontal-mono', 'horizontal-mono-reverse',
    'vertical-primary', 'vertical-primary-reverse', 'vertical-mono', 'vertical-mono-reverse']) {
    assert.ok((LOGO_VARIANTS as readonly string[]).includes(v), `${v} present`);
  }
  assert.deepEqual(splitVariant('vertical-primary-reverse'), { orientation: 'vertical', treatment: 'primary-reverse' });
  assert.equal(variantLabel('horizontal-primary-reverse'), 'Horizontal · Primary reverse');
  assert.ok(isReverseTreatment('mono-reverse'));
  assert.ok(!isReverseTreatment('primary'));
});

test('LOGO_SLUG_RE: canonical keys pass, hostile/oversized slugs fail', () => {
  for (const v of LOGO_VARIANTS) assert.ok(LOGO_SLUG_RE.test(v), `${v} valid`);
  for (const good of ['icon', 'app-icon', 'crest', 'x1', 'a'.repeat(40)]) {
    assert.ok(LOGO_SLUG_RE.test(good), `${good} valid`);
  }
  for (const bad of ['Foo!', '', 'a'.repeat(41), '-leading', 'has_underscore', 'UPPER', 'has space', 'sl/ash']) {
    assert.ok(!LOGO_SLUG_RE.test(bad), `${JSON.stringify(bad)} rejected`);
  }
});

test('custom slugs: splitVariant yields null axes; variantLabel prettifies', () => {
  assert.deepEqual(splitVariant('app-icon'), { orientation: null, treatment: null });
  assert.deepEqual(splitVariant('crest'), { orientation: null, treatment: null });
  assert.equal(variantLabel('app-icon'), 'App icon');
  assert.equal(variantLabel('crest'), 'Crest');
  assert.ok(isCanonicalVariant('vertical-mono'));
  assert.ok(!isCanonicalVariant('app-icon'));
});

test('asset id scheme: default identity keeps the two-segment form', () => {
  assert.equal(logoAssetId('horizontal-primary'), 'user/logo/horizontal-primary');
  assert.equal(logoAssetId('icon', LOGO_DEFAULT_IDENTITY), 'user/logo/icon');
  assert.equal(logoAssetId('icon', 'acme'), 'user/logo/acme/icon');
  assert.deepEqual(parseLogoAssetId('user/logo/horizontal-primary'), { identity: 'default', variant: 'horizontal-primary' });
  assert.deepEqual(parseLogoAssetId('user/logo/acme/icon'), { identity: 'acme', variant: 'icon' });
  assert.equal(parseLogoAssetId('user/logo/a/b/c'), null, 'extra segments rejected');
  assert.equal(parseLogoAssetId('user/logo/Foo!'), null, 'invalid variant slug rejected');
  assert.equal(parseLogoAssetId('user/logo/B@d/icon'), null, 'invalid identity slug rejected');
  assert.equal(parseLogoAssetId('user/upload/1'), null, 'foreign namespace rejected');
});

test('withLogoToken adds/reads/clears a variant on a layered doc (writes into base)', () => {
  const doc = { $themes: [{ name: 'light' }], base: {}, light: {} };
  const a = withLogoToken(doc, 'horizontal-primary-reverse', 'user/logo/horizontal-primary-reverse');
  assert.deepEqual(logoGroupOf(a)!['horizontal-primary-reverse'], { $type: 'asset', $value: 'user/logo/horizontal-primary-reverse' });
  assert.ok((a.base as Record<string, unknown>).asset, 'base.asset created');

  const b = withLogoToken(a, 'vertical-mono-reverse', 'user/logo/vertical-mono-reverse');
  assert.equal(Object.keys(logoGroupOf(b)!).length, 2);

  const c = withLogoToken(b, 'horizontal-primary-reverse', null);
  assert.equal(logoGroupOf(c)!['horizontal-primary-reverse'], undefined);
  assert.ok(logoGroupOf(c)!['vertical-mono-reverse'], 'other variant untouched');

  const d = withLogoToken(c, 'vertical-mono-reverse', null);
  assert.equal(logoGroupOf(d), null);
  assert.equal((d.base as Record<string, unknown>).asset, undefined);
});

test('withLogoToken works on a plain (non-layered) doc at the root', () => {
  const a = withLogoToken({}, 'vertical-mono', 'user/logo/vertical-mono');
  assert.deepEqual(logoGroupOf(a)!['vertical-mono'], { $type: 'asset', $value: 'user/logo/vertical-mono' });
});

test('identity tokens nest under asset.logo.<identity> and prune on clear', () => {
  // Default + identity coexist: the identity is a GROUP inside the default group.
  const a = withLogoToken(
    withLogoToken({}, 'horizontal-primary', 'user/logo/horizontal-primary'),
    'icon', 'user/logo/acme/icon', 'acme');
  assert.deepEqual(logoGroupOf(a, 'acme')!['icon'], { $type: 'asset', $value: 'user/logo/acme/icon' });
  assert.ok(logoGroupOf(a)!['horizontal-primary'], 'default slot untouched');
  assert.ok(logoGroupOf(a)!['acme'], 'identity group visible in the default group');
  assert.equal(logoGroupOf(a, 'other'), null, 'unknown identity is null');

  // Clearing the identity's last variant prunes the group but not its siblings…
  const b = withLogoToken(a, 'icon', null, 'acme');
  assert.equal(logoGroupOf(b, 'acme'), null);
  assert.ok(logoGroupOf(b)!['horizontal-primary'], 'default slot survives the prune');

  // …and clearing everything prunes asset.logo entirely (layered doc too).
  const c = withLogoToken(
    withLogoToken({ $themes: [{ name: 'x' }], base: {} }, 'crest', 'user/logo/acme/crest', 'acme'),
    'crest', null, 'acme');
  assert.equal(logoGroupOf(c), null);
  assert.equal((c.base as Record<string, unknown>).asset, undefined);
});

// ── Bridge round-trip on an in-memory host ────────────────────────────────────
function memoryHost(): UserFontsHost & { store: Map<string, any> } {
  const store = new Map<string, any>();
  return {
    store,
    assets: {
      async _uploadUserAsset(record: any) { store.set(record.id, record); },
      async _deleteUserAsset(id: string) { store.delete(id); },
      async _exportUserAssets() { return [...store.values()]; },
      async _getBlob(id: string) { return store.get(id)?.blob ?? null; },
    },
  };
}
const png = (name: string): File => new File([new Uint8Array([1, 2, 3])], name, { type: 'image/png' });
const tokensDocOf = async (host: ReturnType<typeof memoryHost>): Promise<any> =>
  JSON.parse(await host.store.get(USER_TOKENS_ID).blob.text());

test('install/list/remove round-trip: canonical, custom + label, named identity', async () => {
  const host = memoryHost();
  await installLogo(host, 'horizontal-primary', png('h.png'));
  await installLogo(host, 'crest', png('c.png'), { label: 'Crest mark' });
  await installLogo(host, 'icon', png('i.png'), { identity: 'acme' });

  const slots = await listLogos(host);
  assert.equal(slots.length, 3);
  const by = new Map(slots.map(s => [s.assetId, s]));
  const canonical = by.get('user/logo/horizontal-primary')!;
  assert.deepEqual(
    { variant: canonical.variant, identity: canonical.identity, label: canonical.label, custom: canonical.custom },
    { variant: 'horizontal-primary', identity: 'default', label: 'Horizontal · Primary', custom: false });
  const crest = by.get('user/logo/crest')!;
  assert.deepEqual(
    { variant: crest.variant, identity: crest.identity, label: crest.label, custom: crest.custom },
    { variant: 'crest', identity: 'default', label: 'Crest mark', custom: true });
  const icon = by.get('user/logo/acme/icon')!;
  assert.deepEqual(
    { variant: icon.variant, identity: icon.identity, label: icon.label, custom: icon.custom },
    { variant: 'icon', identity: 'acme', label: 'Icon', custom: true });
  assert.ok(slots.every(s => s.url), 'every slot has a preview URL');
  slots.forEach(s => URL.revokeObjectURL(s.url));

  // Meta records the slot; the tokens doc records the fill at the right path.
  assert.equal(host.store.get('user/logo/crest').meta.label, 'Crest mark');
  assert.equal(host.store.get('user/logo/acme/icon').meta.identity, 'acme');
  const doc = await tokensDocOf(host);
  assert.equal(doc.asset.logo['crest'].$value, 'user/logo/crest');
  assert.equal(doc.asset.logo.acme.icon.$value, 'user/logo/acme/icon');

  // Remove prunes asset + token, identity group included.
  await removeLogo(host, 'icon', 'acme');
  assert.ok(!host.store.has('user/logo/acme/icon'));
  assert.equal((await tokensDocOf(host)).asset.logo.acme, undefined);
  await removeLogo(host, 'crest');
  assert.ok(!host.store.has('user/logo/crest'));
  assert.equal((await tokensDocOf(host)).asset.logo['crest'], undefined);
  assert.equal((await listLogos(host)).length, 1);
});

test('listLogos keeps every valid slug (no silent drop) and skips malformed ids', async () => {
  const host = memoryHost();
  // A pre-existing install: canonical id, meta without identity/label.
  await host.assets._uploadUserAsset({
    id: `${USER_LOGO_PREFIX}vertical-mono`, type: 'raster', format: 'png',
    blob: new Blob([new Uint8Array(4)], { type: 'image/png' }),
    meta: { format: 'png', variant: 'vertical-mono', kind: 'logo' },
  });
  // An unknown-but-valid slug (the old code dropped these), and two malformed ids.
  await host.assets._uploadUserAsset({
    id: `${USER_LOGO_PREFIX}crest`, type: 'raster', format: 'png',
    blob: new Blob([new Uint8Array(4)], { type: 'image/png' }), meta: { format: 'png' },
  });
  await host.assets._uploadUserAsset({
    id: `${USER_LOGO_PREFIX}Bad!Name`, type: 'raster', format: 'png',
    blob: new Blob([new Uint8Array(4)], { type: 'image/png' }),
  });
  await host.assets._uploadUserAsset({
    id: `${USER_LOGO_PREFIX}a/b/c`, type: 'raster', format: 'png',
    blob: new Blob([new Uint8Array(4)], { type: 'image/png' }),
  });
  const slots = await listLogos(host);
  slots.forEach(s => URL.revokeObjectURL(s.url));
  assert.deepEqual(slots.map(s => s.variant).sort(), ['crest', 'vertical-mono']);
  const legacy = slots.find(s => s.variant === 'vertical-mono')!;
  assert.equal(legacy.identity, 'default');
  assert.equal(legacy.custom, false);
  assert.equal(legacy.label, 'Vertical · Mono');
});

test('installLogo rejects bad slugs, bad identities and shadowing identities', async () => {
  const host = memoryHost();
  await assert.rejects(installLogo(host, 'Foo!', png('x.png')), /lowercase/);
  await assert.rejects(installLogo(host, '', png('x.png')), /lowercase/);
  await assert.rejects(installLogo(host, 'a'.repeat(41), png('x.png')), /lowercase/);
  await assert.rejects(installLogo(host, 'icon', png('x.png'), { identity: 'Foo!' }), /lowercase/);
  // An identity named after a matrix slot would shadow that slot's token.
  await assert.rejects(installLogo(host, 'icon', png('x.png'), { identity: 'horizontal-primary' }), /variant name/);
  // The format/size gates still stand.
  await assert.rejects(
    installLogo(host, 'icon', new File([new Uint8Array(4)], 'x.gif', { type: 'image/gif' })),
    /PNG, JPEG, SVG or WebP/);
  assert.equal(host.store.size, 0, 'nothing stored on any rejection');
});

test('installLogo refuses cross-shape collisions in the asset.logo namespace', async () => {
  const host = memoryHost();
  // 'default' is the unnamed identity's reserved key - naming a second logo
  // "default" must not silently merge into the primary identity.
  await assert.rejects(installLogo(host, 'icon', png('x.png'), { identity: 'default' }), /reserved/);
  // A custom default-identity mark and an identity share asset.logo.<key>:
  // whichever shape exists first, the other is refused rather than destroyed.
  await installLogo(host, 'crest', png('c.png'), { label: 'Crest' });
  await assert.rejects(installLogo(host, 'icon', png('i.png'), { identity: 'crest' }), /already a mark/);
  await installLogo(host, 'acme', png('a.png'), { identity: 'sub-brand' });
  await assert.rejects(installLogo(host, 'sub-brand', png('s.png')), /already a logo/);
  // Both originals survived untouched.
  const slots = await listLogos(host);
  assert.deepEqual(slots.map(s => `${s.identity}/${s.variant}`).sort(), ['default/crest', 'sub-brand/acme']);
});
