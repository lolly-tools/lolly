// SPDX-License-Identifier: MPL-2.0
/**
 * engine/src/design-version.ts — the versioned design-system contracts that
 * MULTIPLE shells depend on (plans/97 §6a).
 *
 * The ledger reader/writer, the slug grammar, the ladder, docChecksum and the
 * compat diff are exercised by the web shell's
 * `shells/web/src/lib/design-system/versions.test.ts`, which now runs against this
 * module through a re-export. This file deliberately does NOT duplicate those. It
 * covers what only makes sense from outside a browser:
 *
 *   (1) `pickHeadAssetId` — the discovery-exclusion rule the web bridge, the MCP
 *       server and the CLI must apply identically, INCLUDING its byte-identity
 *       promise for the catalogs that ship one tokens asset (nearly all of them)
 *   (2) `frozenAssetId` — checked against the id pattern read off
 *       schemas/asset.schema.json, not a copy of it, because a preserved asset has
 *       to travel in a pack as an ordinary asset
 *   (3) `stripVersionIndex` — a version asset never carries a ledger
 *   (4) `collectAssetTokens` / `collectFontFamilies` / `applyPinnedAssets` — the
 *       asset-manifest walk and the one place asset indirection happens
 *   (5) `sha256Hex` against a published test vector, since two independent
 *       implementations (a device and a pack validator) compare its output
 *   (6) the barrel actually exports the surface the shells import
 *
 * Run with: node --test tests/design-version.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DESIGN_VERSION_LATEST, applyPinnedAssets, collectAssetTokens, collectFontFamilies,
  frozenAssetId, isVersionAssetId, isVersionSlug, pickHeadAssetId, readVersionIndex, sha256Hex,
  slugifyVersion, stripVersionIndex, versionAssetId, withVersionIndex,
} from '../engine/src/index.ts';
import type { PinnedAsset, VersionIndex } from '../engine/src/index.ts';
import { TOKEN_EXT } from '../engine/src/tokens.ts';
import { validateManifest } from '../engine/src/validate.ts';

const HEAD = 'user/tokens/brand';

/** The asset-id grammar, read off the schema rather than restated — a frozen id
 *  that only satisfies a copy of the pattern is a pack that fails to validate. */
const ASSET_ID_RE = (() => {
  const schema = JSON.parse(readFileSync(new URL('../schemas/asset.schema.json', import.meta.url), 'utf8'));
  const pattern = schema?.properties?.id?.pattern;
  assert.equal(typeof pattern, 'string', 'schemas/asset.schema.json must state an id pattern');
  return new RegExp(pattern);
})();

/** A doc shaped like an installed design system: colour ramps, a logo group of
 *  `$type:'asset'` leaves, and font roles — plus a foreign `$extensions` key that
 *  none of these walks may disturb. */
const systemDoc = (): Record<string, unknown> => ({
  $extensions: { 'org.example.other': { keep: true } },
  base: {
    color: { ramp: { primary: { 5: { $type: 'color', $value: 'oklch(0.6 0.15 250)' } } } },
    asset: {
      logo: {
        'horizontal-primary': { $type: 'asset', $value: 'user/logo/horizontal-primary' },
        icon: { $type: 'asset', $value: 'user/logo/icon' },
        // An alias names another token, not bytes — never a manifest entry.
        favicon: { $type: 'asset', $value: '{asset.logo.icon}' },
      },
    },
    font: {
      heading: { $type: 'fontFamily', $value: 'Work Sans' },
      body: { $type: 'fontFamily', $value: ['Work Sans', 'Georgia'] },
    },
  },
  light: { font: { ui: { $type: 'fontFamily', $value: 'Inter' } } },
});

// ─── (1) the discovery-exclusion rule ────────────────────────────────────────

test('pickHeadAssetId: a version never shadows the design system it belongs to', () => {
  // The ONLY case that behaves differently from the `.find(...)` every consumer
  // ran before this rule existed: a version listed ahead of its own head.
  assert.equal(pickHeadAssetId([`${HEAD}/jupiter`, HEAD]), HEAD);
  assert.equal(pickHeadAssetId([HEAD, `${HEAD}/jupiter`, `${HEAD}/v2`]), HEAD);

  // Byte identity for everything else. One tokens asset, or none, or several
  // UNRELATED ones: the first still wins, exactly as before — which is what makes
  // this rule safe to land in three consumers at once.
  assert.equal(pickHeadAssetId([]), null);
  assert.equal(pickHeadAssetId([HEAD]), HEAD);
  assert.equal(pickHeadAssetId(['suse/tokens/brand']), 'suse/tokens/brand');
  assert.equal(pickHeadAssetId(['suse/tokens/brand', HEAD]), 'suse/tokens/brand');

  // A shared PREFIX is not a shared parent — the rule cuts on segment boundaries,
  // so a differently-named system next door is never mistaken for a version.
  assert.equal(pickHeadAssetId([`${HEAD}x`, HEAD]), `${HEAD}x`);
  assert.equal(isVersionAssetId(`${HEAD}x`, HEAD), false);
  assert.equal(isVersionAssetId(HEAD, HEAD), false, 'a head is not its own version');
  assert.equal(isVersionAssetId(versionAssetId(HEAD, 'v2'), HEAD), true);

  // Deeper descendants are still descendants (a hand-built id, or a future scheme):
  // excluded from discovery, because nothing that is not the head may answer as it.
  assert.equal(pickHeadAssetId([`${HEAD}/v2/draft`, HEAD]), HEAD);

  // Nothing but versions: the shortest id cannot be anyone's descendant, so a head
  // is always found. A list of siblings resolves to the first, never to null.
  assert.equal(pickHeadAssetId([`${HEAD}/a`, `${HEAD}/b`]), `${HEAD}/a`);

  // Duplicates must not make an id its own ancestor and empty the list.
  assert.equal(pickHeadAssetId([HEAD, HEAD]), HEAD);
});

// ─── (2) the frozen id is an ordinary asset id ───────────────────────────────

test('frozenAssetId: content-keyed, and legal as a catalog asset id', () => {
  const digest = 'a'.repeat(64);
  assert.equal(frozenAssetId(digest), 'user/frozen/aaaaaaaaaaaa');
  assert.match(frozenAssetId(digest), ASSET_ID_RE);

  // A pack ships preserved bytes under its own namespace, and that id must
  // validate too — this is the whole reason the scheme is three plain segments.
  assert.equal(frozenAssetId(digest, 'suse'), 'suse/frozen/aaaaaaaaaaaa');
  assert.match(frozenAssetId(digest, 'suse'), ASSET_ID_RE);

  // Content-keyed: identical bytes ⇒ identical id ⇒ ONE preserved copy shared by
  // every version that pinned them. Different bytes ⇒ a different id.
  const other = 'b0c1d2e3f405'.padEnd(64, '9');
  assert.notEqual(frozenAssetId(other), frozenAssetId(digest));
  assert.equal(frozenAssetId(digest), frozenAssetId(digest));
  assert.match(frozenAssetId(other), ASSET_ID_RE);

  // Case is not part of the key: a digest handed back in upper case is the SAME
  // bytes, and two ids for one blob would defeat the dedupe entirely.
  assert.equal(frozenAssetId(digest.toUpperCase()), frozenAssetId(digest));

  // Every digest a real hash can produce keeps the id legal (a leading digit is
  // the interesting one — the grammar's first segment character class allows it).
  for (const hex of ['0123456789ab', 'fedcba987654', '000000000000']) {
    assert.match(frozenAssetId(hex.padEnd(64, '0')), ASSET_ID_RE, hex);
  }

  // Anything that is not a digest is refused rather than minted. An id like
  // `user/frozen/` or `user/frozen/zz` cannot be stored or shipped, so a version
  // that pinned it would have lost its bytes with nothing anywhere saying so.
  for (const bad of ['', '   ', 'abc', 'not-a-digest', 'g'.repeat(64)]) {
    assert.throws(() => frozenAssetId(bad), /not a sha-256 hex digest/, JSON.stringify(bad));
  }
  for (const ns of ['', 'user/logo', 'User', 'my ns']) {
    assert.throws(() => frozenAssetId(digest, ns), /single lowercase id segment/, ns);
  }
});

test('slugifyVersion: a slug is always a legal id segment on a real head', () => {
  // The mint side of the same grammar: whatever a user types, the id it produces
  // has to validate as an asset id, or publishing writes an asset a pack rejects.
  for (const label of ['v2', 'Jupiter', 'Jüpiter', '2026 Q3 refresh', '  spring--2026  ', 'v01']) {
    const slug = slugifyVersion(label);
    assert.ok(slug, `${label} should slugify`);
    assert.match(versionAssetId(HEAD, slug), ASSET_ID_RE, label);
  }
  // ...and the two that must not mint an id at all.
  assert.equal(slugifyVersion('latest'), null);
  assert.equal(slugifyVersion('🎨'), null);
});

test('isVersionSlug enforces the LENGTH bound too, not only the grammar', () => {
  // Minting is not the only door a slug comes through: an imported pack's
  // versions.json reaches installUserTokens with a slug nobody here typed. If the
  // bound lived only in slugifyVersion, that path could mint an unbounded,
  // permanent asset id (shells/web/src/brand-transfer.ts feeds entry.slug straight
  // in), and readVersionIndex would happily list it back.
  const long = 'v'.repeat(300);
  assert.equal(isVersionSlug(long), false, 'a 300-character segment is not a usable version name');
  assert.equal(isVersionSlug('a'.repeat(48)), true, 'the bound itself is usable');
  assert.equal(isVersionSlug('a'.repeat(49)), false);
  // Whatever the mint produces always satisfies the read, at any input length.
  const minted = slugifyVersion('Spring '.repeat(40));
  assert.ok(minted && isVersionSlug(minted));
  // …and the read refuses the over-long one everywhere it can appear.
  assert.deepEqual(
    readVersionIndex({ $extensions: { [TOKEN_EXT]: { versions: { list: [
      { slug: long, label: 'x', date: '', checksum: '' },
      { slug: 'v1', label: 'v1', date: '', checksum: '' },
    ], active: long } } } }).versions.map(v => v.slug),
    ['v1'],
  );
});

// ─── (3) a version carries no ledger ─────────────────────────────────────────

test('stripVersionIndex: the payload a version asset stores has no history in it', () => {
  const index: VersionIndex = {
    versions: [{ slug: 'v1', label: 'v1', date: '2026-08-01', checksum: 'abc' }],
    active: 'v1',
  };
  const head = withVersionIndex(systemDoc(), index) as Record<string, unknown>;
  assert.equal(readVersionIndex(head).versions.length, 1);

  const payload = stripVersionIndex(head) as Record<string, unknown>;
  assert.deepEqual(readVersionIndex(payload), { versions: [], active: null });

  // Only the ledger goes. The tokens survive, and so does a foreign extension key
  // — a version that quietly dropped somebody else's data would not be a copy.
  assert.deepEqual(payload.base, (systemDoc() as Record<string, unknown>).base);
  assert.deepEqual(payload.$extensions, { 'org.example.other': { keep: true } });

  // Stripping an already-clean doc is a no-op, and the head is never mutated.
  assert.deepEqual(stripVersionIndex(payload), payload);
  assert.equal(readVersionIndex(head).versions.length, 1);
});

// ─── (4) the asset manifest walk, and the one indirection ────────────────────

test('collectAssetTokens: every asset leaf, wherever it lives, aliases excluded', () => {
  const found = collectAssetTokens(systemDoc());
  assert.deepEqual(found, [
    { path: 'base.asset.logo.horizontal-primary', id: 'user/logo/horizontal-primary' },
    { path: 'base.asset.logo.icon', id: 'user/logo/icon' },
  ]);

  // An asset named anywhere else is still pinned — the walk is not a hard-coded
  // tour of `asset.logo.*`, which is only where today's studio happens to write.
  const elsewhere = { promo: { hero: { $type: 'asset', $value: 'user/photo/hero' } } };
  assert.deepEqual(collectAssetTokens(elsewhere), [{ path: 'promo.hero', id: 'user/photo/hero' }]);

  // Nothing to pin reads as nothing, never as a throw: an empty system publishes.
  assert.deepEqual(collectAssetTokens({}), []);
  assert.deepEqual(collectAssetTokens(null), []);
});

test('collectFontFamilies: families, flattened and de-duped in first-seen order', () => {
  // 'Work Sans' is named by two roles and appears once; the fallback array is
  // flattened; a family in another theme set still counts.
  assert.deepEqual(collectFontFamilies(systemDoc()), ['Work Sans', 'Georgia', 'Inter']);
  assert.deepEqual(collectFontFamilies({}), []);
});

test('applyPinnedAssets: rewrites the pinned leaves and only those', () => {
  const doc = systemDoc();
  const frozenId = frozenAssetId('c'.repeat(64));
  const pins: PinnedAsset[] = [
    // Replaced since publish: the version's bytes were preserved.
    { id: 'user/logo/horizontal-primary', version: '1.0.0', sha256: 'c'.repeat(64), frozenId },
    // Pinned but untouched: the head id still holds the bytes it recorded, so
    // rewriting would add indirection for nothing.
    { id: 'user/logo/icon', version: '1.0.0', sha256: 'd'.repeat(64) },
  ];

  /** `base.asset.logo` as a flat id map — the shape every assertion below reads. */
  const logoIds = (d: unknown): Record<string, string> => Object.fromEntries(
    collectAssetTokens(d).map(({ path, id }) => [path.replace('base.asset.logo.', ''), id]),
  );

  const out = applyPinnedAssets(doc, pins) as Record<string, unknown>;
  assert.deepEqual(logoIds(out), {
    'horizontal-primary': frozenId,        // replaced since publish ⇒ frozen bytes
    icon: 'user/logo/icon',                // pinned but never changed ⇒ untouched
  });                                      // the alias leaf is not an id at all

  // Pure: the caller's doc is untouched, so a memoised head can be handed in safely.
  assert.deepEqual(logoIds(doc), {
    'horizontal-primary': 'user/logo/horizontal-primary',
    icon: 'user/logo/icon',
  });

  // Non-asset leaves never move, whatever the pin list says.
  assert.deepEqual(out.light, doc.light);

  // No pins, or none with preserved bytes: the document is unchanged in value.
  assert.deepEqual(applyPinnedAssets(doc, []), doc);
  assert.deepEqual(applyPinnedAssets(doc, [pins[1]!]), doc);
});

// ─── (5) the digest two implementations compare ──────────────────────────────

test('sha256Hex: the published empty-string and "abc" vectors, lowercase hex', async () => {
  // A device writes this digest into a pin; a pack validator recomputes it from the
  // file on disk. They are different codebases, so the encoding is pinned to the
  // FIPS 180-4 vectors rather than to whatever we happen to produce today.
  assert.equal(await sha256Hex(new Uint8Array(0)),
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(await sha256Hex(new TextEncoder().encode('abc')),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

// ─── (6) the surfaces other shells and packs import ──────────────────────────

test('the barrel exports the design-version surface the shells resolve against', async () => {
  const engine = await import('../engine/src/index.ts');
  for (const name of [
    'readVersionIndex', 'withVersionIndex', 'stripVersionIndex', 'slugifyVersion',
    'isVersionSlug', 'suggestNextLabel', 'versionAssetId', 'isVersionAssetId',
    'pickHeadAssetId', 'frozenAssetId', 'sha256Hex', 'resolveDesignVersion',
    'docChecksum', 'diffTokenDocs', 'collectAssetTokens', 'collectFontFamilies',
    'applyPinnedAssets',
  ]) {
    assert.equal(typeof (engine as Record<string, unknown>)[name], 'function', `${name} is not exported`);
  }
  assert.equal(engine.DESIGN_VERSION_LATEST, DESIGN_VERSION_LATEST);
  assert.equal(DESIGN_VERSION_LATEST, 'latest');

  // The ledger lives under the shells' own vendor extension, not a new namespace —
  // a doc written by the studio and one written by a pack must be the same file.
  const doc = withVersionIndex({}, {
    versions: [{ slug: 'v1', label: 'v1', date: '', checksum: '' }], active: null,
  }) as Record<string, Record<string, unknown>>;
  assert.ok(doc.$extensions?.[TOKEN_EXT], `the ledger belongs to ${TOKEN_EXT}`);
});

test('designVersion is an admitted manifest field, and NOT a load gate', () => {
  // Both schema copies gained it (tests/lolly-tools-core.test.ts guards the pair);
  // this checks the engine's own validator accepts a pin and rejects a value that
  // could never be an asset-id segment.
  const manifest = (designVersion?: unknown): unknown => ({
    id: 'demo', name: 'Demo', version: '1.0.0', engineVersion: '^1.0.0',
    status: 'official', render: { width: 600, height: 400, formats: ['png'] }, inputs: [],
    ...(designVersion === undefined ? {} : { designVersion }),
  });
  assert.equal(validateManifest(manifest()).valid, true, 'no pin is the normal case');
  assert.equal(validateManifest(manifest('jupiter')).valid, true);
  assert.equal(validateManifest(manifest(DESIGN_VERSION_LATEST)).valid, true,
    "'latest' is a legal pin: it means the edit head");
  assert.equal(validateManifest(manifest('Jupiter')).valid, false, 'a slug is lowercase');
  assert.equal(validateManifest(manifest('-v2')).valid, false, 'an id segment cannot lead with -');
  assert.equal(validateManifest(manifest('v2/draft')).valid, false, 'a pin is ONE segment');
});
