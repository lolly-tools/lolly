// SPDX-License-Identifier: MPL-2.0
/**
 * versions.ts - the versioned design-system model (plans/97 section 6a).
 *
 * Run with:
 *   node --import ./tests/css-stub.mjs --test "shells/web/src/lib/design-system/versions.test.ts"
 *
 * The ladder, the slug grammar and the descendant predicate are contracts other
 * shells (MCP, CLI) must resolve identically, so they are pinned here rather than
 * left to the panel that happens to call them first.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOKEN_EXT } from '@lolly/engine';
import {
  readVersionIndex, withVersionIndex, slugifyVersion, suggestNextLabel,
  versionAssetId, isVersionAssetId, resolveDesignVersion, docChecksum, diffTokenDocs,
} from './versions.ts';
import type { VersionIndex } from './versions.ts';

const HEAD = 'user/tokens/brand';

/** A layered doc shaped like the real installed head: base ramps + per-theme
 *  semantic roles, plus a vendor extension key this module must never disturb. */
const layeredDoc = (): Record<string, unknown> => ({
  $extensions: {
    'org.example.other': { keep: true },
    [TOKEN_EXT]: { excluded: ['color.spectrum.lime'] },
  },
  base: {
    color: {
      ramp: {
        primary: {
          1: { $type: 'color', $value: 'oklch(0.9 0.05 250)' },
          5: { $type: 'color', $value: 'oklch(0.6 0.15 250)' },
        },
      },
      spectrum: { lime: { $type: 'color', $value: '#b4dd00' } },
    },
  },
  light: { color: { semantic: { primary: { $type: 'color', $value: '{color.ramp.primary.5}' } } } },
  dark: { color: { semantic: { primary: { $type: 'color', $value: '{color.ramp.primary.1}' } } } },
});

const index: VersionIndex = {
  versions: [
    { slug: 'v1', label: 'v1', date: '2026-08-01', checksum: 'a'.repeat(64) },
    {
      slug: 'jupiter', label: 'Jupiter', date: '2026-08-05', note: 'launch', checksum: 'b'.repeat(64),
      assets: [{ id: 'user/logo/horizontal-primary', version: '1.2.0', sha256: 'c'.repeat(64) }],
    },
  ],
  active: 'jupiter',
};

test('the index round-trips through a layered doc without disturbing other $extensions keys', () => {
  const doc = layeredDoc();
  const before = JSON.stringify(doc);
  const next = withVersionIndex(doc, index) as Record<string, unknown>;

  assert.equal(JSON.stringify(doc), before, 'the input doc must not be mutated');
  assert.deepEqual(readVersionIndex(next), index);

  const ext = (next.$extensions as Record<string, Record<string, unknown>>);
  assert.deepEqual(ext['org.example.other'], { keep: true }, 'a foreign vendor key survives');
  assert.deepEqual((ext[TOKEN_EXT] as Record<string, unknown>).excluded, ['color.spectrum.lime']);
  assert.deepEqual((next.base as Record<string, unknown>), (doc.base as Record<string, unknown>));
  assert.deepEqual((next.dark as Record<string, unknown>), (doc.dark as Record<string, unknown>));

  // Writing back what we read is a fixed point (the panel re-saves on every edit).
  assert.deepEqual(readVersionIndex(withVersionIndex(next, readVersionIndex(next))), index);
});

test('the reserved head can never be written as a version', () => {
  const doc = withVersionIndex({}, {
    versions: [{ slug: 'latest', label: 'Latest', date: '2026-08-08', checksum: 'x' }],
    active: 'latest',
  });
  assert.deepEqual(doc, {}, 'nothing addressable to store, so nothing is stored');
  assert.deepEqual(readVersionIndex(doc), { versions: [], active: null });
  assert.equal(resolveDesignVersion({ index: readVersionIndex(doc) }), 'latest', 'the head, as always');
});

test('an empty index leaves no trace, and absence or garbage reads as empty', () => {
  const empty: VersionIndex = { versions: [], active: null };
  const stripped = withVersionIndex(withVersionIndex(layeredDoc(), index), empty) as Record<string, unknown>;
  const ext = stripped.$extensions as Record<string, Record<string, unknown>>;
  assert.ok(!('versions' in (ext[TOKEN_EXT] as Record<string, unknown>)), 'the key is removed, not left empty');
  assert.deepEqual((ext[TOKEN_EXT] as Record<string, unknown>).excluded, ['color.spectrum.lime']);

  // A doc that only ever carried the ledger loses its containers entirely.
  const bare = withVersionIndex(withVersionIndex({ base: {} }, index), empty) as Record<string, unknown>;
  assert.deepEqual(bare, { base: {} });

  assert.deepEqual(readVersionIndex(undefined), empty);
  assert.deepEqual(readVersionIndex('nope'), empty);
  assert.deepEqual(readVersionIndex({ $extensions: { [TOKEN_EXT]: { versions: 7 } } }), empty);
});

test('readVersionIndex drops unaddressable entries, duplicate slugs and an unknown active', () => {
  const doc = {
    $extensions: {
      [TOKEN_EXT]: {
        versions: {
          list: [
            { slug: 'V2', label: 'V2', checksum: 'x' },              // not the segment grammar
            null,
            { label: 'no slug' },
            { slug: 'v1', label: 'v1', date: '2026-08-01', checksum: 'a' },
            { slug: 'v1', label: 'duplicate', checksum: 'z' },
            { slug: 'v3', assets: [{ id: 'x' }, { id: 'y', version: '1.0.0', sha256: 's' }] },
          ],
          active: 'ghost',
        },
      },
    },
  };
  const read = readVersionIndex(doc);
  assert.deepEqual(read.versions.map(v => v.slug), ['v1', 'v3']);
  assert.equal(read.versions[0]?.label, 'v1');
  assert.equal(read.versions[1]?.label, 'v3', 'a label defaults to the slug');
  assert.equal(read.versions[1]?.checksum, '');
  assert.deepEqual(read.versions[1]?.assets, [{ id: 'y', version: '1.0.0', sha256: 's' }]);
  assert.equal(read.active, null, 'an active naming no known version is not honoured');

  // The bare-array form is tolerated, with active alongside it.
  const legacyReserved = {
    $extensions: { [TOKEN_EXT]: { versions: [{ slug: 'latest', label: 'Latest', checksum: 'x' }], active: 'latest' } },
  };
  assert.deepEqual(readVersionIndex(legacyReserved), { versions: [], active: null },
    'a doc claiming the head as a version names nothing the ladder can resolve');


  const legacy = { $extensions: { [TOKEN_EXT]: { versions: [{ slug: 'v1', label: 'v1' }], active: 'v1' } } };
  assert.deepEqual(readVersionIndex(legacy), {
    versions: [{ slug: 'v1', label: 'v1', date: '', checksum: '' }], active: 'v1',
  });
});

test('slugifyVersion produces an asset-id segment or nothing', () => {
  const grammar = /^[a-z0-9][a-z0-9-]*$/;
  for (const [label, want] of [
    ['Jupiter', 'jupiter'],
    ['v2', 'v2'],
    ['V 2!', 'v-2'],
    ['  2026 Q3  ', '2026-q3'],
    ['Jüpiter', 'jupiter'],
    ['--v3--', 'v3'],
    ['a  b---c', 'a-b-c'],
  ] as const) {
    assert.equal(slugifyVersion(label), want, label);
    assert.match(want, grammar);
  }
  assert.equal(slugifyVersion('🎉🎉'), null);
  assert.equal(slugifyVersion(''), null);
  assert.equal(slugifyVersion('!!!'), null);
  // `latest` is the head. A version minted under it would be addressed by an id
  // the resolution ladder short-circuits, so the name is refused outright.
  assert.equal(slugifyVersion('latest'), null);
  assert.equal(slugifyVersion('Latest'), null);
  assert.equal(slugifyVersion(' LATEST! '), null);
  assert.equal(slugifyVersion('latest-2'), 'latest-2', 'only the exact name is reserved');
  const long = slugifyVersion('x'.repeat(80)) as string;
  assert.ok(long.length <= 48 && grammar.test(long));
});

test('suggestNextLabel follows the last convention, or offers nothing', () => {
  const of = (labels: string[]): VersionIndex => ({
    versions: labels.map(l => ({ slug: slugifyVersion(l) ?? 'x', label: l, date: '', checksum: '' })),
    active: null,
  });
  assert.equal(suggestNextLabel(of(['v1'])), 'v2');
  assert.equal(suggestNextLabel(of(['v1', '2'])), '3');
  assert.equal(suggestNextLabel(of(['v09'])), 'v10', 'zero padding is kept');
  assert.equal(suggestNextLabel(of(['jupiter'])), '', 'free naming: no number to advance');
  assert.equal(suggestNextLabel({ versions: [], active: null }), '');
});

test('version asset ids are head descendants, and only descendants', () => {
  assert.equal(versionAssetId(HEAD, 'jupiter'), 'user/tokens/brand/jupiter');
  assert.equal(versionAssetId(`${HEAD}/`, 'v2'), 'user/tokens/brand/v2');

  assert.equal(isVersionAssetId('user/tokens/brand/jupiter', HEAD), true);
  assert.equal(isVersionAssetId('user/tokens/brandx', HEAD), false, 'a prefix is not a segment boundary');
  assert.equal(isVersionAssetId(HEAD, HEAD), false, 'the head is not one of its own versions');
  assert.equal(isVersionAssetId(`${HEAD}/`, HEAD), false);
  assert.equal(isVersionAssetId('suse/tokens/brand/v2', HEAD), false);
});

test('resolveDesignVersion walks override → pin → active → latest', () => {
  assert.equal(resolveDesignVersion({ override: 'v1', pin: 'jupiter', index }), 'v1');
  assert.equal(resolveDesignVersion({ override: 'latest', pin: 'jupiter', index }), 'latest');
  assert.equal(resolveDesignVersion({ pin: 'v1', index }), 'v1');
  assert.equal(resolveDesignVersion({ index }), 'jupiter', 'the active version');

  // Unknown slugs fall through a rung at a time rather than failing the render.
  assert.equal(resolveDesignVersion({ override: 'ghost', pin: 'v1', index }), 'v1');
  assert.equal(resolveDesignVersion({ override: 'ghost', pin: 'ghost', index }), 'jupiter');
  assert.equal(
    resolveDesignVersion({ override: 'ghost', pin: 'ghost', index: { ...index, active: null } }),
    'latest',
  );
  // Nothing published at all is today's behaviour, unchanged.
  assert.equal(resolveDesignVersion({ override: 'ghost', index: { versions: [], active: null } }), 'latest');
  assert.equal(resolveDesignVersion({ override: null, pin: undefined, index }), 'jupiter');
});

test('docChecksum is a stable sha-256 hex over canonical JSON', async () => {
  const a = { base: { color: { one: { $value: '#fff' }, two: { $value: '#000' } } }, name: 'x' };
  const b = { name: 'x', base: { color: { two: { $value: '#000' }, one: { $value: '#fff' } } } };
  const sum = await docChecksum(a);
  assert.match(sum, /^[0-9a-f]{64}$/);
  assert.equal(await docChecksum(b), sum, 'key order must not change the checksum');
  assert.notEqual(await docChecksum({ ...a, name: 'y' }), sum);
  // Known vector, so a change of canonical form (not just of the doc) is caught.
  assert.equal(
    await docChecksum({}),
    '44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a',
  );
});

test('diffTokenDocs reports added, changed and removed leaves across sets', () => {
  const a = layeredDoc();
  const b = layeredDoc() as Record<string, unknown>;
  const base = b.base as { color: { ramp: { primary: Record<string, unknown> }; spectrum: Record<string, unknown> } };
  base.color.ramp.primary['5'] = { $type: 'color', $value: 'oklch(0.62 0.16 250)' };  // changed
  base.color.ramp.primary['9'] = { $type: 'color', $value: 'oklch(0.3 0.1 250)' };    // added
  delete base.color.spectrum.lime;                                                     // removed
  const dark = b.dark as { color: { semantic: Record<string, unknown> } };
  dark.color.semantic.surface = { $type: 'color', $value: '{color.ramp.primary.1}' };  // added, dark only

  const d = diffTokenDocs(a, b);
  assert.deepEqual(d.added, ['base.color.ramp.primary.9', 'dark.color.semantic.surface']);
  assert.deepEqual(d.changed, ['base.color.ramp.primary.5']);
  assert.deepEqual(d.removed, ['base.color.spectrum.lime'], 'the breaking set');

  // A description edit is not a compatibility event; an identical doc has no diff.
  const described = layeredDoc() as Record<string, unknown>;
  // Typed through the shape the fixture actually builds. The old double cast went
  // via Record<string, never>, which makes every index `never` - casting `never`
  // onward does not restore an indexable chain, so tsc flagged the two hops as
  // possibly-undefined and the whole tests project failed to typecheck.
  (described.light as { color: { semantic: { primary: Record<string, unknown> } } })
    .color.semantic.primary.$description = 'the brand colour';
  assert.deepEqual(diffTokenDocs(a, described), { added: [], changed: [], removed: [] });
  assert.deepEqual(diffTokenDocs(a, layeredDoc()), { added: [], changed: [], removed: [] });

  // A rename reads as one removal plus one addition - exactly how it breaks a tool.
  const renamed = layeredDoc() as Record<string, unknown>;
  const rSpectrum = (renamed.base as { color: { spectrum: Record<string, unknown> } }).color.spectrum;
  rSpectrum.citrus = rSpectrum.lime;
  delete rSpectrum.lime;
  const rd = diffTokenDocs(a, renamed);
  assert.deepEqual(rd.added, ['base.color.spectrum.citrus']);
  assert.deepEqual(rd.removed, ['base.color.spectrum.lime']);

  assert.deepEqual(diffTokenDocs(null, undefined), { added: [], changed: [], removed: [] });
});

// ─── The engine alias ────────────────────────────────────────────────────────
// This module became a re-export of engine/src/design-version.ts (engine 1.109.0,
// plans/97 section 6a M7). Every test above still runs against the real implementation
// through it; this last one guards the seam itself, because a re-export list is
// the one kind of code that can lose a symbol with no error anywhere - the import
// simply resolves to undefined at the call site, in a room nobody typechecks twice.
test('versions: the module re-exports the whole engine surface', async () => {
  const mod = await import('./versions.ts');

  // The names this module owned before the move. Losing one silently breaks a
  // studio room, so they are listed literally rather than derived from the module.
  const moved = [
    'readVersionIndex', 'withVersionIndex', 'slugifyVersion', 'suggestNextLabel',
    'versionAssetId', 'isVersionAssetId', 'resolveDesignVersion', 'docChecksum',
    'diffTokenDocs',
  ];
  // ...and the names the move added, which M7's io layer, bridge and panel need.
  const added = [
    'stripVersionIndex', 'isVersionSlug', 'pickHeadAssetId', 'frozenAssetId',
    'sha256Hex', 'collectAssetTokens', 'collectFontFamilies', 'applyPinnedAssets',
  ];
  for (const name of [...moved, ...added]) {
    assert.equal(typeof (mod as Record<string, unknown>)[name], 'function', `${name} is not re-exported`);
  }

  // The one non-function export: the reserved head, which the ladder returns and
  // `?designv=latest` names. A wrong value here would publish a version nothing
  // can address, so it is pinned by value and not just by presence.
  assert.equal(mod.DESIGN_VERSION_LATEST, 'latest');
});
