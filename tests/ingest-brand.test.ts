// SPDX-License-Identifier: MPL-2.0
/**
 * ingest-brand — the container sniff in `extract()`, driven end to end through
 * the real script (spawned like tests/brand-treatments.test.ts does), because
 * the script runs main() on import and its helpers are deliberately local.
 *
 * Covered here: the two ZIP shapes plan 97 M2 added — a Lolly design system pack
 * (manifest `format: "lolly-brand"` → its tokens.json member) and a plain zip of
 * loose token-set files — plus the Penpot archive, which must keep routing where
 * it always did. The directory/monolithic-file shapes are exercised by
 * tests/brand-treatments.test.ts.
 *
 * Then M7's round-trip: a pack's PUBLISHED VERSIONS and the bytes they pin become
 * ordinary catalog assets (plans/97 §6a), a ledger entry the pack cannot back with
 * a payload is dropped rather than shipped unloadable, and a pack from a system
 * that never published is written exactly as it was before any of this existed.
 *
 * Run with: node --test "tests/ingest-brand.test.ts"
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { strToU8, zipSync } from 'fflate';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const TOKENS = {
  color: {
    $type: 'color',
    brand: { primary: { $value: '#30ba78' }, ink: { $value: '#0c322c' } },
  },
};

/** The pack's own integrity form: SRI-style `sha256-<base64>` over each part's
 *  bytes, exactly as shells/web/src/lib/bundle.ts writes it. */
const partHash = (body: unknown): string =>
  `sha256-${createHash('sha256').update(JSON.stringify(body)).digest('base64')}`;

/** Write a zip fixture. A `Uint8Array` member is stored as-is (the script also
 *  inflates a pack's `frozen/` binaries); anything else is JSON-encoded. */
function writeZip(t: { after: (fn: () => void) => void }, members: Record<string, unknown>, name: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'lolly-ingest-zip-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const entries: Record<string, Uint8Array> = {};
  for (const [path, body] of Object.entries(members)) {
    entries[path] = body instanceof Uint8Array ? body : strToU8(JSON.stringify(body));
  }
  const file = join(dir, name);
  writeFileSync(file, zipSync(entries));
  return file;
}

interface Run { status: number | null; stdout: string; stderr: string; out: string }

// --out must live inside the repo (ingest-brand refuses outside paths), so the
// pack lands in a dot-dir under brands/ (profile/pack scans skip dot-dirs).
function runIngest(t: { after: (fn: () => void) => void }, source: string, name: string): Run {
  const outRel = `brands/.tmp-test-${name}`;
  const out = join(ROOT, outRel);
  t.after(() => rmSync(out, { recursive: true, force: true }));
  const r = spawnSync(
    process.execPath,
    [join(ROOT, 'scripts/ingest-brand.ts'), source, '--name', name, '--out', outRel, '--force'],
    { cwd: ROOT, encoding: 'utf8' },
  );
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, out };
}

test('a Lolly design system pack: tokens.json is the document, assets are named as left behind', (t) => {
  const zip = writeZip(t, {
    'manifest.json': {
      format: 'lolly-brand', formatVersion: 1, minReader: 1, app: 'lolly', label: 'ACME',
    },
    'tokens.json': TOKENS,
    'fonts.json': [{ file: 'fonts/a.woff2' }, { file: 'fonts/b.woff2' }],
    'logos.json': [{ file: 'logos/mark.svg' }],
    'prefs.json': { theme: 'dark' },
  }, 'LollyBrand-ACME-2026-08-09.zip');

  const r = runIngest(t, zip, 'packbrand');
  assert.equal(r.status, 0, `ingest-brand failed:\n${r.stdout}\n${r.stderr}`);
  assert.match(r.stdout, /✓ extracted Lolly design system pack \(\.zip\): /);
  // The note is the whole point of the v1 scope: say what did NOT come across.
  assert.match(r.stdout, /· pack assets are not imported yet: fonts\/ \(2\) and logos\/ \(1\)/);

  const brand = JSON.parse(readFileSync(join(r.out, 'catalog/assets/packbrand/tokens/brand.json'), 'utf8'));
  assert.deepEqual(brand, TOKENS, 'the pack tokens.json lands verbatim, not the manifest');
  const readme = readFileSync(join(r.out, 'README.md'), 'utf8');
  assert.match(readme, /\*\*Container:\*\* Lolly design system pack \(\.zip\)/);
});

test('a pack with no readable tokens.json fails, naming the pack', (t) => {
  const zip = writeZip(t, {
    'manifest.json': { format: 'lolly-brand', formatVersion: 1 },
    'fonts.json': [],
  }, 'LollyBrand-empty.zip');

  const r = runIngest(t, zip, 'packempty');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Lolly design system pack \(\.zip\) but carries no readable tokens\.json/);
});

test('a pack whose tokens.json was swapped after export is refused, not ingested', (t) => {
  // The manifest vouches for the ORIGINAL document; the member carries another.
  // This is the case the web importer refuses (verifyIntegrity), so the CLI must
  // not be the soft way in — a README recording the pack as provenance for a
  // document the pack never signed is a lie the file format can prevent.
  const swapped = { color: { $type: 'color', brand: { primary: { $value: '#ff0000' } } } };
  const zip = writeZip(t, {
    'manifest.json': {
      format: 'lolly-brand', formatVersion: 1, minReader: 1, app: 'lolly', label: 'ACME',
      integrity: { 'tokens.json': partHash(TOKENS), 'fonts/body.woff2': 'sha256-notinflated' },
    },
    'tokens.json': swapped,
  }, 'LollyBrand-tampered.zip');

  const r = runIngest(t, zip, 'packtampered');
  assert.equal(r.status, 1, `expected a refusal, got:\n${r.stdout}`);
  assert.match(r.stderr, /appears corrupted — "tokens\.json" failed the integrity check/);
});

test('a pack that matches its integrity map ingests, binaries left unverified', (t) => {
  const zip = writeZip(t, {
    'manifest.json': {
      format: 'lolly-brand', formatVersion: 1, minReader: 1, app: 'lolly', label: 'ACME',
      // The binary part is in the map and NOT in hand: only .json members are
      // inflated, so it is skipped rather than reported missing.
      integrity: { 'tokens.json': partHash(TOKENS), 'logos/mark.svg': 'sha256-neverinflated' },
    },
    'tokens.json': TOKENS,
  }, 'LollyBrand-signed.zip');

  const r = runIngest(t, zip, 'packsigned');
  assert.equal(r.status, 0, `ingest-brand failed:\n${r.stdout}\n${r.stderr}`);
  const brand = JSON.parse(readFileSync(join(r.out, 'catalog/assets/packsigned/tokens/brand.json'), 'utf8'));
  assert.deepEqual(brand, TOKENS);
});

test('a zip of loose token-set files assembles, one wrapper folder stripped', (t) => {
  const zip = writeZip(t, {
    'export/$metadata.json': { tokenSetOrder: ['core', 'brand'] },
    'export/$themes.json': [{ id: 'light', name: 'Light', selectedTokenSets: { core: 'enabled' } }],
    'export/core.json': { grey: { $type: 'color', $value: '#888888' } },
    'export/brand.json': { primary: { $type: 'color', $value: '#30ba78' } },
    '__MACOSX/._core.json': { junk: true },
  }, 'token-sets.zip');

  const r = runIngest(t, zip, 'setszip');
  assert.equal(r.status, 0, `ingest-brand failed:\n${r.stdout}\n${r.stderr}`);
  assert.match(r.stdout, /✓ extracted one-file-per-set token directory \(zipped\): 2 sets · 1 themes/);

  const brand = JSON.parse(readFileSync(join(r.out, 'catalog/assets/setszip/tokens/brand.json'), 'utf8'));
  // $metadata/$themes are only recognised at the ROOT, so the strip is what
  // makes a wrapped export assemble at all.
  assert.deepEqual(brand.$metadata, { tokenSetOrder: ['core', 'brand'] });
  assert.equal(Array.isArray(brand.$themes) && brand.$themes.length, 1);
  assert.equal(brand.core.grey.$value, '#888888');
  assert.equal(brand.brand.primary.$value, '#30ba78');
  assert.ok(!('__MACOSX' in brand) && !('_core' in brand), 'resource forks are not sets');
});

test('a one-member zip keeps its folder, the same answer the studio gives', (t) => {
  // stripCommonPrefix (shells/web/src/lib/design-system/sources/file.ts) bails
  // below two paths: one member's leading directory is where that file lives,
  // not packaging. The CLI stripped it, so the same archive produced a set
  // called `core` here and `export/core` in the studio.
  const zip = writeZip(t, {
    'export/core.json': { grey: { $type: 'color', $value: '#888888' } },
  }, 'one-set.zip');

  const r = runIngest(t, zip, 'onesetzip');
  assert.equal(r.status, 0, `ingest-brand failed:\n${r.stdout}\n${r.stderr}`);
  const brand = JSON.parse(readFileSync(join(r.out, 'catalog/assets/onesetzip/tokens/brand.json'), 'utf8'));
  assert.ok(!('core' in brand), 'the wrapper folder is not stripped off a lone member');
  assert.equal(brand['export/core']?.grey?.$value, '#888888');
});

test('a Penpot archive still routes to the Penpot extractor', (t) => {
  const zip = writeZip(t, {
    'manifest.json': { type: 'penpot/export-files', files: [{ id: 'f1', features: ['design-tokens/v1'] }] },
    'files/f1/tokens.json': TOKENS,
  }, 'project.penpot');

  const r = runIngest(t, zip, 'penpotzip');
  assert.equal(r.status, 0, `ingest-brand failed:\n${r.stdout}\n${r.stderr}`);
  assert.match(r.stdout, /✓ extracted Penpot project archive \(\.penpot\): /);
  const brand = JSON.parse(readFileSync(join(r.out, 'catalog/assets/penpotzip/tokens/brand.json'), 'utf8'));
  assert.equal(brand.color.brand.primary.$value, '#30ba78');
});

// ── published design-system versions travel into the pack (plans/97 §6a) ─────

/** A pack whose head document publishes one version pinning one logo, whose
 *  bytes have since been replaced (so the version's copy is frozen). */
function versionedPack(t: { after: (fn: () => void) => void }): string {
  const LOGO = 'user/logo/horizontal-primary';
  const ledger = {
    list: [{
      slug: 'v2',
      label: 'V2',
      date: '2026-08-01T00:00:00.000Z',
      checksum: 'checksum-v2',
      assets: [{ id: LOGO, version: '1.0.0', sha256: 'a'.repeat(64), frozenId: 'user/frozen/aabbccddeeff' }],
    }],
    active: 'v2',
  };
  return writeZip(t, {
    'manifest.json': { format: 'lolly-brand', formatVersion: 2, minReader: 1, app: 'lolly', label: 'ACME' },
    'tokens.json': {
      ...TOKENS,
      asset: { logo: { primary: { $type: 'asset', $value: LOGO } } },
      $extensions: { 'com.suse.lolly': { versions: ledger } },
    },
    'versions.json': ledger,
    'versions/v2.json': {
      ...TOKENS,
      asset: { logo: { primary: { $type: 'asset', $value: LOGO } } },
    },
    'frozen.json': [{
      id: 'user/frozen/aabbccddeeff', type: 'vector', format: 'svg',
      file: 'frozen/aabbccddeeff.svg', mime: 'image/svg+xml',
    }],
    'frozen/aabbccddeeff.svg': strToU8('<svg xmlns="http://www.w3.org/2000/svg"/>'),
  }, 'LollyBrand-ACME-versioned.zip');
}

test('a pack with versions hydrates version + frozen catalog assets', (t) => {
  const r = runIngest(t, versionedPack(t), 'packversioned');
  assert.equal(r.status, 0, `ingest-brand failed:\n${r.stdout}\n${r.stderr}`);
  assert.match(r.stdout, /· 1 versions, 1 preserved files/);
  assert.match(r.stdout, /1 version, 1 preserved file\)/);

  // The version's payload sits beside the head — the FILE brand.json and the
  // DIRECTORY brand/ coexist, which is what makes `<head>/<slug>` addressable.
  const v2 = JSON.parse(readFileSync(join(r.out, 'catalog/assets/packversioned/tokens/brand/v2.json'), 'utf8'));
  assert.equal(v2.color.brand.primary.$value, '#30ba78');
  assert.ok(!v2.$extensions, 'a published version never carries a ledger of its own');

  const index = JSON.parse(readFileSync(join(r.out, 'catalog/assets/index.json'), 'utf8'));
  const byId = new Map<string, any>(index.assets.map((a: any) => [a.id, a]));
  const version = byId.get('packversioned/tokens/brand/v2');
  assert.ok(version, 'the version is an ordinary catalog asset');
  assert.equal(version.type, 'tokens');
  assert.equal(version.formats[0].url, '/catalog/assets/packversioned/tokens/brand/v2.json');
  assert.match(version.formats[0].checksum, /^sha256-/);

  // The preserved bytes are re-homed into the PACK's namespace. `user/…` is the
  // device's own space (the web bridge routes those ids to on-device storage), so
  // a catalog shipping one would name bytes nothing can resolve.
  const frozen = byId.get('packversioned/frozen/aabbccddeeff');
  assert.ok(frozen, 'the pinned bytes ship as a catalog asset');
  assert.equal(frozen.type, 'vector');
  assert.equal(frozen.formats[0].url, '/catalog/assets/packversioned/frozen/aabbccddeeff.svg');
  assert.ok(readFileSync(join(r.out, 'catalog/assets/packversioned/frozen/aabbccddeeff.svg'), 'utf8').startsWith('<svg'));

  // …and the head's ledger points at the re-homed id, or the rewrite would have
  // swapped a resolvable reference for a dead one.
  const head = JSON.parse(readFileSync(join(r.out, 'catalog/assets/packversioned/tokens/brand.json'), 'utf8'));
  const list = head.$extensions['com.suse.lolly'].versions.list;
  assert.equal(list.length, 1);
  assert.equal(list[0].assets[0].frozenId, 'packversioned/frozen/aabbccddeeff');
  assert.equal(list[0].assets[0].id, 'user/logo/horizontal-primary', 'the pin key matches the document, untouched');
  assert.equal(head.$extensions['com.suse.lolly'].versions.active, 'v2');

  const readme = readFileSync(join(r.out, 'README.md'), 'utf8');
  assert.match(readme, /\*\*Published versions:\*\* v2 \(1 preserved file\)/);
});

test('a ledger entry with no payload is dropped rather than shipped unloadable', (t) => {
  const zip = writeZip(t, {
    'manifest.json': { format: 'lolly-brand', formatVersion: 2, minReader: 1, app: 'lolly' },
    'tokens.json': {
      ...TOKENS,
      $extensions: {
        'com.suse.lolly': {
          versions: {
            list: [{ slug: 'ghost', label: 'Ghost', date: '2026-08-01T00:00:00.000Z', checksum: 'c' }],
            active: 'ghost',
          },
        },
      },
    },
  }, 'LollyBrand-ghost.zip');

  const r = runIngest(t, zip, 'packghost');
  assert.equal(r.status, 0, `ingest-brand failed:\n${r.stdout}\n${r.stderr}`);
  assert.match(r.stderr, /published version "ghost" has no readable versions\/ghost\.json/);
  const head = JSON.parse(readFileSync(join(r.out, 'catalog/assets/packghost/tokens/brand.json'), 'utf8'));
  assert.ok(!head.$extensions, 'the last unshippable entry takes the whole ledger with it');
});

test('a pack that never published is written exactly as it was before versions existed', (t) => {
  const zip = writeZip(t, {
    'manifest.json': { format: 'lolly-brand', formatVersion: 2, minReader: 1, app: 'lolly' },
    'tokens.json': TOKENS,
  }, 'LollyBrand-plain.zip');

  const r = runIngest(t, zip, 'packplain');
  assert.equal(r.status, 0, `ingest-brand failed:\n${r.stdout}\n${r.stderr}`);
  assert.doesNotMatch(r.stdout, /version/i);
  const brand = JSON.parse(readFileSync(join(r.out, 'catalog/assets/packplain/tokens/brand.json'), 'utf8'));
  assert.deepEqual(brand, TOKENS, 'the document is untouched, ledger machinery and all');
  const index = JSON.parse(readFileSync(join(r.out, 'catalog/assets/index.json'), 'utf8'));
  assert.ok(!index.assets.some((a: any) => a.id.includes('/frozen/') || a.id.endsWith('/brand/v2')));
});
