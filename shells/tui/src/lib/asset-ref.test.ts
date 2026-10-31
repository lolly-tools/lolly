// SPDX-License-Identifier: MPL-2.0
/**
 * The terminal app's CSV import reads a file a picture column gives only when its
 * bytes are a picture (lib/asset-ref.ts, with the CLI's `pictureFileMime`).
 *
 * Run with: node --test shells/tui/src/lib/asset-ref.test.ts
 *
 * The import used to read any existing file a `logo` column named and label it by
 * its extension, so a CSV someone sent could put `~/.aws/credentials` in a row and
 * the person's export carried that file. Now:
 *
 *  - a file whose bytes are not a picture refuses the whole import, whatever the
 *    file is called, and its contents go nowhere;
 *  - a picture is labelled by its bytes (a PNG called `.dat` is a PNG, a legacy
 *    Illustrator SVG with a long DOCTYPE is an SVG);
 *  - a root `<svg>` past the first 64 KiB is not looked for, so only the head of a
 *    file decides;
 *  - a missing picture is still counted and left empty, and a catalog id still
 *    goes to the catalog.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NotAPictureError, resolveAssetRef, resolveRowPictures } from './asset-ref.ts';
import type { AssetRefHost } from './asset-ref.ts';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const root = await mkdtemp(join(tmpdir(), 'lolly-tui-asset-ref-'));
after(() => rm(root, { recursive: true, force: true }));

const CANARY = 'SECRET-TUI-CSV-CANARY-7719';
const secret = join(root, 'credentials');
await writeFile(secret, `[default]\naws_secret_access_key = ${CANARY}\n`);
const disguised = join(root, 'sponsor.png');
await writeFile(disguised, `notes, not a picture: ${CANARY}\n`);
await writeFile(join(root, 'acme.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>');
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
await writeFile(join(root, 'globex.dat'), PNG);

const host: AssetRefHost = {
  assets: { get: async (id) => (id === 'lolly/logo/primary' ? { source: 'catalog', id, type: 'vector', url: '/catalog/primary.svg' } : null) },
};
const refusedFor = (field: string | null, value: string) => (err: unknown): boolean => {
  assert.ok(err instanceof NotAPictureError, String(err));
  assert.equal(err.fieldId, field);
  assert.equal(err.value, value);
  assert.match(err.message, /is a file on this computer but not a picture Lolly recognises, so it was not read\./);
  assert.doesNotMatch(err.message, new RegExp(CANARY));
  return true;
};

test('a CSV row that points at a file which is not a picture refuses the import', async () => {
  const rows = [{ name: 'Acme', logo: 'acme.svg' }, { name: 'Leak', logo: secret }];
  await assert.rejects(resolveRowPictures(rows, ['logo'], root, host), refusedFor('logo', secret));
  for (const row of rows) assert.doesNotMatch(JSON.stringify(row), new RegExp(CANARY), 'no row holds the file');
  // The name decides nothing: text called sponsor.png, given beside the CSV.
  await assert.rejects(resolveRowPictures([{ logo: 'sponsor.png' }], ['logo'], root, host), refusedFor('logo', 'sponsor.png'));
  // A path typed into a picture field meets the same check.
  await assert.rejects(resolveAssetRef(disguised, host), refusedFor(null, disguised));
});

test('pictures are read and labelled by their bytes', async () => {
  const rows: Record<string, unknown>[] = [
    { logo: 'acme.svg' }, { logo: 'globex.dat' }, { logo: 'lolly/logo/primary' }, { logo: 'missing.png' }, { logo: '' },
  ];
  const unresolved = await resolveRowPictures(rows, ['logo'], root, host);
  assert.equal(unresolved, 1, 'the missing picture is counted');
  const [svg, png, catalog, missing, empty] = rows.map((r) => r.logo as Record<string, unknown> | null);
  assert.equal(svg?.type, 'vector');
  assert.match(String(svg?.url), /^data:image\/svg\+xml;base64,/);
  assert.equal(png?.type, 'raster');
  assert.equal(png?.format, 'png', 'a PNG called .dat is a PNG');
  assert.match(String(png?.url), /^data:image\/png;base64,/);
  assert.equal(catalog?.source, 'catalog');
  assert.equal(missing, null);
  assert.equal(empty, null);

  const illustrator = join(REPO, 'tests', 'fixtures', 'adobe', 'illustrator-legacy-logo.svg');
  assert.ok((await readFile(illustrator, 'utf8')).indexOf('<svg') > 512);
  const ref = await resolveAssetRef(illustrator, host) as Record<string, unknown>;
  assert.equal(ref.type, 'vector', 'a legacy Illustrator SVG, its root after a DOCTYPE');
});

test('only the head of a file decides: a root element past 64 KiB is not looked for', async () => {
  const late = join(root, 'late.svg');
  await writeFile(late, `<?xml version="1.0"?><!--${' '.repeat(70 * 1024)}--><svg xmlns="http://www.w3.org/2000/svg"/>`);
  await assert.rejects(resolveAssetRef(late, host), refusedFor(null, late));
});
