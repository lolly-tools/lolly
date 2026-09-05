// SPDX-License-Identifier: MPL-2.0
/**
 * engine/src/design-system.ts - the identity rules a device needs before it can
 * hold more than one design system (plans/186 section 6).
 *
 * Three consumers resolve material against a design system (the web bridge, the
 * CLI bridge and the MCP server), so what this module answers has to be one
 * answer. What is pinned here:
 *
 *   (1) the id grammar and its length bound, at both entry points: a typed id and
 *       a label slugified into one
 *   (2) the namespace and head rules, including the two ids that are special
 *       forever - `default` keeps the legacy `user/` prefix, `shipped` has no user
 *       namespace and no derivable head
 *   (3) `designMaterialOf` over the whole id table, legacy and namespaced, with
 *       the negative cases that matter: personal uploads, frozen bytes, catalog
 *       ids, and the `user/tokens/brandx` boundary that a prefix test would get
 *       wrong
 *   (4) the identity round-trip through a tokens doc, its tolerance of garbage,
 *       and the byte-identity promise when there is no identity to store
 *   (5) the barrel actually exports the surface the shells import
 *
 * Run with: node --test tests/design-system.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DEFAULT_DESIGN_SYSTEM_ID, DESIGN_SYSTEM_ID_MAX, DESIGN_SYSTEM_ID_RE, SHIPPED_DESIGN_SYSTEM_ID,
  designMaterialOf, designSystemHeadId, designSystemNamespace, isDesignSystemId,
  readDesignSystemIdentity, slugifyDesignSystemId, withDesignSystemIdentity,
} from '../engine/src/design-system.ts';
import type { DesignMaterial } from '../engine/src/design-system.ts';
import { TOKEN_EXT } from '../engine/src/token-ext.ts';

/** The asset-id grammar, read off the schema rather than restated: a namespace is
 *  the prefix of ids that have to validate as ordinary assets in a pack. */
const ASSET_ID_RE = (() => {
  const schema = JSON.parse(readFileSync(new URL('../schemas/asset.schema.json', import.meta.url), 'utf8'));
  const pattern = schema?.properties?.id?.pattern;
  assert.equal(typeof pattern, 'string', 'schemas/asset.schema.json must state an id pattern');
  return new RegExp(pattern);
})();

test('design-system: the id grammar is one asset-id segment, bounded', () => {
  for (const ok of ['default', 'shipped', 'acme', 'acme-2026', 'a', 'x9', '2026-rebrand']) {
    assert.equal(isDesignSystemId(ok), true, ok);
    assert.equal(DESIGN_SYSTEM_ID_RE.test(ok), true, ok);
  }
  for (const bad of ['', 'Acme', 'acme_2026', '-acme', 'acme/2026', 'acme 2026', 'acmé', 'acme.']) {
    assert.equal(isDesignSystemId(bad), false, bad);
  }
  // Not a string at all: the id arrives from an imported pack and a backup as well
  // as from a text field, so the guard is a type predicate over unknown.
  for (const bad of [null, undefined, 42, {}, ['acme']]) assert.equal(isDesignSystemId(bad), false);

  // The bound is enforced at the READ, not only at the mint, because an imported
  // pack carries an id nobody in this process typed.
  assert.equal(isDesignSystemId('a'.repeat(DESIGN_SYSTEM_ID_MAX)), true);
  assert.equal(isDesignSystemId('a'.repeat(DESIGN_SYSTEM_ID_MAX + 1)), false);

  // `latest` is reserved for a VERSION, never for a system: nothing here
  // short-circuits on it, so a person may call a design system that.
  assert.equal(isDesignSystemId('latest'), true);
});

test('design-system: slugifyDesignSystemId always yields an addressable id', () => {
  assert.equal(slugifyDesignSystemId('SUSE 2026'), 'suse-2026');
  assert.equal(slugifyDesignSystemId('Acme'), 'acme');
  // Diacritics fold to their base letter rather than vanishing.
  assert.equal(slugifyDesignSystemId('Jüpiter'), 'jupiter');
  assert.equal(slugifyDesignSystemId('Ångström Brand'), 'angstrom-brand');
  // Runs of punctuation collapse to one separator; the ends are trimmed.
  assert.equal(slugifyDesignSystemId('  --Acme // 2026!!  '), 'acme-2026');

  // Nothing survives: unlike a version slug this never returns null, because a
  // design system has to exist under SOME id. The caller de-duplicates.
  assert.equal(slugifyDesignSystemId(''), 'design-system');
  assert.equal(slugifyDesignSystemId('   '), 'design-system');
  assert.equal(slugifyDesignSystemId('🎨🎨'), 'design-system');

  // Truncated to the bound, and never left with a trailing separator by the cut.
  const long = slugifyDesignSystemId('a'.repeat(80));
  assert.equal(long.length, DESIGN_SYSTEM_ID_MAX);
  const cut = slugifyDesignSystemId(`${'b'.repeat(DESIGN_SYSTEM_ID_MAX)} tail`);
  assert.equal(cut, 'b'.repeat(DESIGN_SYSTEM_ID_MAX));
  assert.equal(cut.endsWith('-'), false);

  // Whatever comes out is usable as an id, by construction.
  for (const label of ['SUSE 2026', 'Jüpiter', '', '🎨', 'a'.repeat(80)]) {
    assert.equal(isDesignSystemId(slugifyDesignSystemId(label)), true, label);
  }
});

test('design-system: namespaces and heads, with shipped and junk refused', () => {
  // The migrated system keeps the legacy prefix forever (plan 186 decision 7):
  // saved sessions reference placed assets by id, so re-keying would break them.
  assert.equal(designSystemNamespace(DEFAULT_DESIGN_SYSTEM_ID), 'user/');
  assert.equal(designSystemHeadId(DEFAULT_DESIGN_SYSTEM_ID), 'user/tokens/brand');

  assert.equal(designSystemNamespace('acme'), 'user/ds/acme/');
  assert.equal(designSystemHeadId('acme'), 'user/ds/acme/tokens/brand');
  assert.equal(designSystemHeadId('acme-2026'), 'user/ds/acme-2026/tokens/brand');

  // A head is an ordinary asset id, so it has to satisfy the schema's pattern.
  assert.match(designSystemHeadId(DEFAULT_DESIGN_SYSTEM_ID), ASSET_ID_RE);
  assert.match(designSystemHeadId('acme-2026'), ASSET_ID_RE);

  // The shipped system's material is the catalog's, so nothing is minted under it
  // and its head is whatever id that catalog gave the asset.
  assert.equal(designSystemNamespace(SHIPPED_DESIGN_SYSTEM_ID), '');
  assert.throws(() => designSystemHeadId(SHIPPED_DESIGN_SYSTEM_ID), /shipped|catalog/i);

  // An id that could not name a valid asset prefix is refused at the mint, not
  // written into permanent rows.
  for (const bad of ['Acme', 'acme/2026', '', 'a'.repeat(DESIGN_SYSTEM_ID_MAX + 1)]) {
    assert.throws(() => designSystemNamespace(bad), /design-system id/);
    assert.throws(() => designSystemHeadId(bad), /design-system id/);
  }
});

test('design-system: designMaterialOf reads the system and kind off the id alone', () => {
  const expect = (id: string, want: DesignMaterial | null): void => {
    assert.deepEqual(designMaterialOf(id), want, id);
  };
  const dflt = DEFAULT_DESIGN_SYSTEM_ID;

  // The legacy namespace: the material the device already had.
  expect('user/tokens/brand', { systemId: dflt, kind: 'tokens' });
  expect('user/tokens/brand/jupiter', { systemId: dflt, kind: 'version' });
  expect('user/fonts/suse-sans/0', { systemId: dflt, kind: 'font' });
  expect('user/fonts/suse-sans/12', { systemId: dflt, kind: 'font' });
  expect('user/logo/horizontal-primary', { systemId: dflt, kind: 'logo' });
  expect('user/logo/identity/horizontal-primary', { systemId: dflt, kind: 'logo' });

  // The namespaced form, same rules one level down.
  expect('user/ds/acme/tokens/brand', { systemId: 'acme', kind: 'tokens' });
  expect('user/ds/acme/tokens/brand/jupiter', { systemId: 'acme', kind: 'version' });
  expect('user/ds/acme-2026/fonts/inter/0', { systemId: 'acme-2026', kind: 'font' });
  expect('user/ds/acme/logo/horizontal-primary', { systemId: 'acme', kind: 'logo' });
  expect('user/ds/acme/logo/identity/horizontal-primary', { systemId: 'acme', kind: 'logo' });
  // The head this module mints is the id it reads back.
  expect(designSystemHeadId('acme'), { systemId: 'acme', kind: 'tokens' });

  // NOT design material. Personal uploads stay the person's, outside every system;
  // frozen bytes are content-keyed and shared BY every system, so they belong to
  // none; a catalog id belongs to a catalog.
  expect('user/frozen/9f86d081884c', null);
  expect('user/raster/1234-photo', null);
  expect('user/vector/1712345678901-mark', null);
  expect('user/headshot', null);
  expect('user/profiles/default', null);
  expect('lolly/tokens/brand', null);
  expect('suse/logo/primary', null);
  expect('', null);
  expect('user', null);
  expect('user/', null);

  // Segment counts are exact, so a prefix test's mistakes cannot happen here.
  expect('user/tokens/brandx', null);          // a different asset, not the head
  expect('user/tokens', null);
  expect('user/tokens/brand/a/b', null);       // one slug segment, or nothing
  expect('user/fonts/inter', null);            // a family is not a face
  expect('user/fonts/inter/0/extra', null);
  expect('user/logo', null);
  expect('user/logo/a/b/c', null);
  expect('user//tokens/brand', null);          // an empty segment is not a segment

  // A namespaced id whose system id fails the grammar names no system at all.
  expect('user/ds/Acme/tokens/brand', null);
  expect('user/ds//tokens/brand', null);
  expect('user/ds/acme', null);
  expect('user/ds', null);
});

test('design-system: identity round-trips through a tokens doc', () => {
  const doc = { color: { brand: { $value: '#0c322c', $type: 'color' } } };
  const written = withDesignSystemIdentity(doc, { id: 'acme', label: 'Acme 2026' }) as Record<string, unknown>;

  assert.deepEqual(readDesignSystemIdentity(written), { id: 'acme', label: 'Acme 2026' });
  // Written where the plan says, under the vendor extension.
  const ext = (written.$extensions as Record<string, unknown>)[TOKEN_EXT] as Record<string, unknown>;
  assert.deepEqual(ext.designSystem, { id: 'acme', label: 'Acme 2026' });

  // A deep clone: the input is never touched, and the rest of the doc rides along.
  assert.equal('$extensions' in doc, false);
  assert.deepEqual((written as { color: unknown }).color, doc.color);

  // Other extension keys are left exactly as they were.
  const withOther = withDesignSystemIdentity(
    { $extensions: { 'org.example': { keep: 1 }, [TOKEN_EXT]: { versions: { list: [], active: null } } } },
    { id: 'acme', label: 'Acme' },
  ) as Record<string, unknown>;
  const exts = withOther.$extensions as Record<string, Record<string, unknown>>;
  assert.deepEqual(exts['org.example'], { keep: 1 });
  assert.deepEqual(exts[TOKEN_EXT]?.versions, { list: [], active: null });
  assert.deepEqual(exts[TOKEN_EXT]?.designSystem, { id: 'acme', label: 'Acme' });
});

test('design-system: reading an identity tolerates garbage', () => {
  assert.equal(readDesignSystemIdentity(null), null);
  assert.equal(readDesignSystemIdentity('nope'), null);
  assert.equal(readDesignSystemIdentity({}), null);
  assert.equal(readDesignSystemIdentity({ $extensions: 7 }), null);
  assert.equal(readDesignSystemIdentity({ $extensions: { [TOKEN_EXT]: 'x' } }), null);
  assert.equal(readDesignSystemIdentity({ $extensions: { [TOKEN_EXT]: { designSystem: [] } } }), null);

  // An id that fails the grammar reads as NO identity rather than half of one: it
  // could not name a namespace, so acting on it would mint unusable ids.
  const bad = (id: unknown): unknown => ({ $extensions: { [TOKEN_EXT]: { designSystem: { id, label: 'Acme' } } } });
  assert.equal(readDesignSystemIdentity(bad('Acme')), null);
  assert.equal(readDesignSystemIdentity(bad(42)), null);
  assert.equal(readDesignSystemIdentity(bad('a'.repeat(DESIGN_SYSTEM_ID_MAX + 1))), null);

  // A missing, empty or non-string label falls back to the id, so a list always
  // has something to print.
  const labelled = (label: unknown): unknown => ({
    $extensions: { [TOKEN_EXT]: { designSystem: label === undefined ? { id: 'acme' } : { id: 'acme', label } } },
  });
  for (const label of [undefined, '', 0, {}]) {
    assert.deepEqual(readDesignSystemIdentity(labelled(label)), { id: 'acme', label: 'acme' }, String(label));
  }
});

test('design-system: no identity stores nothing, byte for byte', () => {
  const doc = { color: { brand: { $value: '#0c322c', $type: 'color' } } };

  // A doc that never had an identity is unchanged by the writer, so a system that
  // predates this module round-trips byte-identically.
  assert.equal(JSON.stringify(withDesignSystemIdentity(doc, null)), JSON.stringify(doc));

  // Removing prunes the containers it emptied.
  const written = withDesignSystemIdentity(doc, { id: 'acme', label: 'Acme' });
  const cleared = withDesignSystemIdentity(written, null);
  assert.equal(JSON.stringify(cleared), JSON.stringify(doc));
  assert.equal(readDesignSystemIdentity(cleared), null);

  // An id that fails the grammar is the same as none: nothing unusable is stored.
  assert.equal(JSON.stringify(withDesignSystemIdentity(doc, { id: 'Acme', label: 'Acme' })), JSON.stringify(doc));

  // A sibling extension key keeps the containers alive; only ours goes.
  const shared = withDesignSystemIdentity(
    { $extensions: { [TOKEN_EXT]: { versions: { list: [], active: null } } } },
    null,
  ) as Record<string, unknown>;
  assert.deepEqual(shared, { $extensions: { [TOKEN_EXT]: { versions: { list: [], active: null } } } });

  // A non-record doc yields a fresh doc holding only the identity, so a caller
  // building a system from nothing has a starting point.
  const fresh = withDesignSystemIdentity(null, { id: 'acme', label: 'Acme' });
  assert.deepEqual(readDesignSystemIdentity(fresh), { id: 'acme', label: 'Acme' });
  assert.deepEqual(fresh, { $extensions: { [TOKEN_EXT]: { designSystem: { id: 'acme', label: 'Acme' } } } });
  assert.deepEqual(withDesignSystemIdentity('nope', null), {});
});

test('design-system: the barrel exports the surface the shells import', async () => {
  const engine = await import('../engine/src/index.ts');
  for (const name of [
    'DESIGN_SYSTEM_ID_RE', 'DESIGN_SYSTEM_ID_MAX', 'DEFAULT_DESIGN_SYSTEM_ID', 'SHIPPED_DESIGN_SYSTEM_ID',
    'isDesignSystemId', 'slugifyDesignSystemId', 'designSystemNamespace', 'designSystemHeadId',
    'designMaterialOf', 'readDesignSystemIdentity', 'withDesignSystemIdentity',
  ]) {
    assert.ok(name in engine, `engine/src/index.ts must export ${name}`);
  }
  assert.equal(engine.designSystemHeadId('acme'), 'user/ds/acme/tokens/brand');
});
