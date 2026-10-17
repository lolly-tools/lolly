// SPDX-License-Identifier: MPL-2.0
/**
 * The `.lolly` portability report and the empty offline-profile check (plan 203,
 * rank 9).
 *
 * A file states, for every dependency it needs, whether the dependency is embedded
 * (with its checksum), available from the reader's own catalog, linked from an
 * address, withheld by a rule, or missing. The check opens a file on an empty
 * profile with networking off and says which of those dependencies open there.
 * Neither ever holds a credential.
 *
 * Pure and DOM-free, like the pack's own round-trip tests: a real fflate zip, real
 * Blobs and real Web Crypto integrity, with `fetch` replaced by a trap so any
 * network use fails the test.
 *
 * Run directly: node --import ./tests/css-stub.mjs --test shells/web/src/lib/lolly-portability.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync, strFromU8, zipSync, strToU8 } from 'fflate';
import type { BeamAssetRecord, BeamPackHost, BeamSessionRow } from './beam-pack.ts';
import {
  buildLollyFile,
  readLollyFile,
  ingestLollyFile,
  readLollyPortability,
  checkLollyPortability,
  PORTABILITY_PART,
  LOLLY_PROJECT_TOOL_ID,
  type LollyLibraryAsset,
  type LollyToolBundle,
  type LollyFontEntry,
} from './lolly-pack.ts';
import {
  portableLink,
  readPortabilityReport,
  toolInventoryDigest,
  collectLinkedDependencies,
  type LollyDependency,
  type LollyPortabilityReport,
} from './lolly-portability.ts';

const PNG = (tag: number) => new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, tag, 0, 0]);
const SVG = (tag: string) => new TextEncoder().encode(`<svg xmlns="http://www.w3.org/2000/svg"><title>${tag}</title></svg>`);
const FONT_DIGEST = `sha256-${'A'.repeat(43)}=`;

/** The secrets a link in the document carries. None may reach the report. */
const SECRETS = ['s3cret-pass', 'SIG-0123456789', 'TOKEN-abcdef', 'X-Amz-Signature', 'font-sig-999', 'wrong-user'];

function memHost() {
  const userStore = new Map<string, BeamAssetRecord>();
  const slots = new Map<string, { data: unknown; thumb?: string | null }>();
  const host: BeamPackHost = {
    state: {
      list: async (): Promise<BeamSessionRow[]> => [...slots.keys()].map(slot => ({ slot })),
      load: async (slot: string) => slots.get(slot)?.data ?? null,
      save: async (slot: string, data: unknown, thumb?: string | null) => { slots.set(slot, { data, thumb }); },
      delete: async (slot: string) => { slots.delete(slot); },
    },
    assets: {
      _exportUserAssets: async () => [...userStore.values()],
      _uploadUserAsset: async (rec: BeamAssetRecord) => { userStore.set(rec.id, rec); },
      _getUserRecord: async (id: string) => userStore.get(id) ?? null,
      _deleteUserAsset: async (id: string) => { userStore.delete(id); },
    },
  };
  return { host, userStore, slots };
}

/** Replace `fetch` with a trap for the duration of `run`, and report every call. */
async function offline<T>(run: () => Promise<T>): Promise<{ result: T; calls: string[] }> {
  const original = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = (async (input: unknown) => {
    calls.push(String(input));
    throw new Error('networking is disabled for this check');
  }) as typeof fetch;
  try {
    return { result: await run(), calls };
  } finally {
    globalThis.fetch = original;
  }
}

const userAssets: BeamAssetRecord[] = [
  { id: 'user/uploads/photo.png', type: 'raster', format: 'png', blob: new Blob([PNG(1)], { type: 'image/png' }), meta: { name: 'photo.png' } },
  { id: 'user/fonts/mine.ttf', type: 'font', format: 'ttf', blob: new Blob([new Uint8Array([0, 1, 0, 0, 9])], { type: 'font/ttf' }), meta: { name: 'mine.ttf' } },
];

const resolveLibrary = async (id: string): Promise<LollyLibraryAsset | null> => {
  if (id === 'lolly/logo/primary') {
    return { bytes: SVG('logo'), mime: 'image/svg+xml', type: 'vector', format: 'svg', label: 'Lolly logo', licensed: false, licence: 'CC BY 4.0' };
  }
  if (id === 'brand/logo/locked') {
    return {
      bytes: SVG('locked'), mime: 'image/svg+xml', type: 'vector', format: 'svg', label: 'Locked logo',
      licensed: true, holdReason: 'this brand pack is authoritative on this device', holdKind: 'policy',
    };
  }
  return null;   // brand/art/unreadable: the sender could not read the bytes
};

/** A session that touches every kind of dependency the report knows. */
function mixedSession() {
  return {
    __toolId: 'design',
    photo: { source: 'user', id: 'user/uploads/photo.png', type: 'raster', format: 'png', url: 'blob:x' },
    font: { source: 'user', id: 'user/fonts/mine.ttf', type: 'font', format: 'ttf', url: 'blob:y' },
    stale: { source: 'user', id: 'user/uploads/gone.png', type: 'raster', format: 'png', url: '' },
    logo: { source: 'library', id: 'lolly/logo/primary', type: 'vector', format: 'svg', url: '/catalog/logo.svg' },
    locked: { source: 'library', id: 'brand/logo/locked', type: 'vector', format: 'svg', url: '/catalog/locked.svg' },
    unreadable: { source: 'library', id: 'brand/art/unreadable', type: 'raster', format: 'png', url: '' },
    hero: {
      source: 'remote', type: 'raster', format: 'png', meta: { name: 'Hero photo' },
      id: 'https://wrong-user:s3cret-pass@cdn.example.com/media/hero.png?X-Amz-Signature=SIG-0123456789&token=TOKEN-abcdef#crop',
      url: 'https://cdn.example.com/media/hero.png?X-Amz-Signature=SIG-0123456789',
    },
    chart: { source: 'remote', type: 'vector', format: 'svg', id: 'https://lolly.tools/tool/qr-code.svg?url=https%3A%2F%2Fexample.com', url: '' },
    team: { source: 'remote', type: 'raster', format: 'png', id: 'project/p1/f2', url: '/api/v1/projects/p1/files/f2?access=TOKEN-abcdef' },
    temporary: { source: 'remote', type: 'raster', format: 'png', id: 'blob:https://lolly.tools/0b7c', url: 'blob:https://lolly.tools/0b7c' },
    baked: { source: 'remote', type: 'raster', format: 'png', id: 'baked/abc', url: 'data:image/png;base64,iVBORw0KGgo=', meta: { baked: true } },
  };
}

const fonts: LollyFontEntry[] = [
  { family: 'Brand Sans', weight: '400', style: 'normal', source: 'catalog', file: '/catalog/fonts/brand-sans.woff2?sig=font-sig-999', sha256: FONT_DIGEST },
  { family: 'Mine', weight: '700', style: 'italic', source: 'user', file: 'user/fonts/mine.ttf', sha256: FONT_DIGEST },
  { family: 'Elsewhere', weight: '400', style: 'normal', source: 'user', sha256: FONT_DIGEST },
  { family: 'Helvetica', weight: '400', style: 'normal', source: 'platform' },
];

async function buildMixed() {
  return buildLollyFile({
    session: mixedSession(), toolId: 'design', toolVersion: '3.1.0', toolTrust: 'signed-catalog',
    userAssets, resolveLibrary, fonts,
    designSystem: { doc: { color: { brand: { $value: '#ff0066' } } }, label: 'House style', id: 'ds-house', source: { kind: 'hosted', instance: 'https://brand.example' } },
    templates: [{ id: 't1', toolId: 'design', name: 'Poster', values: { title: 'Hi' }, createdAt: '', updatedAt: '' }],
  });
}

const row = (report: LollyPortabilityReport, kind: LollyDependency['kind'], id: string) => {
  const found = report.dependencies.find(dep => dep.kind === kind && dep.id === id);
  assert.ok(found, `the report lists the ${kind} ${id}`);
  return found;
};

test('portableLink keeps scheme, host and path, and never a credential', () => {
  assert.equal(portableLink('https://wrong-user:s3cret-pass@cdn.example.com/a/photo.png?X-Amz-Signature=SIG-0123456789&token=x#frag'), 'https://cdn.example.com/a/photo.png');
  assert.equal(portableLink('https://files.example.com/s/9fK2pQ7xLm4nR8tV3wY6zB1c/photo.png'), 'https://files.example.com/s/{redacted}/photo.png',
    'an opaque, digit-bearing path segment reads as a token');
  assert.equal(portableLink('https://api.example.com/d/eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.c2lnbmF0dXJlLXZhbHVl/file'), 'https://api.example.com/d/{redacted}/file',
    'a JWT in the path reads as a token');
  assert.equal(portableLink('https://cdn.example.com/brand/guidelines-for-every-team.pdf'), 'https://cdn.example.com/brand/guidelines-for-every-team.pdf', 'a readable name stays');
  assert.equal(portableLink('blob:https://lolly.tools/0b7c'), 'blob:');
  assert.equal(portableLink('data:image/png;base64,iVBORw0KGgo='), 'data:');
  assert.equal(portableLink('lolly://t/qr-code?url=x'), 'https://lolly.tools/t/qr-code');
  assert.equal(portableLink('//cdn.example.com/a.png?sig=1'), 'https://cdn.example.com/a.png');
  assert.equal(portableLink('/catalog/fonts/brand.woff2?sig=1#x'), '/catalog/fonts/brand.woff2', 'a shell path keeps its path only');
  assert.equal(portableLink('lolly/logo/primary'), 'lolly/logo/primary', 'a catalog id is an identifier, not an address');
  assert.equal(portableLink(`user/uploads/deck.zip?file=${'a'.repeat(24)}`), `user/uploads/deck.zip?file=${'a'.repeat(24)}`,
    'a file selection inside an upload is part of its identity');
});

test('a .lolly carries a per-dependency report under the integrity map, with checksums', async () => {
  const built = await buildMixed();
  const files = unzipSync(new Uint8Array(await built.blob.arrayBuffer()));
  const report = JSON.parse(strFromU8(files[PORTABILITY_PART]!)) as LollyPortabilityReport;
  const manifest = built.manifest;

  assert.ok(manifest.integrity?.[PORTABILITY_PART], 'the report part is covered by the integrity map');
  assert.deepEqual(manifest.portability, { part: PORTABILITY_PART, selfContained: false, counts: report.counts },
    'the manifest repeats the totals for an intake');
  assert.deepEqual(built.summary.portability, { selfContained: false, counts: report.counts });
  const total = Object.values(report.counts).reduce((a, b) => a + b, 0);
  assert.equal(total, report.dependencies.length, 'the totals count the rows');

  // The tool travels by id, and the signed catalog lists the tool.
  const tool = row(report, 'tool', 'design');
  assert.equal(tool.status, 'available');
  assert.equal(tool.version, '3.1.0');
  assert.equal(tool.trust, 'signed-catalog');

  // Embedded bytes carry the digest the integrity map vouches for.
  for (const id of ['user/uploads/photo.png', 'user/fonts/mine.ttf', 'lolly/logo/primary']) {
    const dep = row(report, 'asset', id);
    assert.equal(dep.status, 'embedded');
    assert.ok(dep.path && dep.checksum, `${id} has a path and a checksum`);
    assert.equal(dep.checksum, manifest.integrity![dep.path!], `${id}'s checksum is the integrity map's`);
    assert.ok(typeof dep.bytes === 'number' && dep.bytes > 0);
  }
  assert.equal(row(report, 'asset', 'lolly/logo/primary').licence, 'CC BY 4.0');

  const locked = row(report, 'asset', 'brand/logo/locked');
  assert.equal(locked.status, 'withheld');
  assert.equal(locked.heldBy, 'policy', 'a deployment rule is told apart from a licence condition');
  assert.match(locked.reason!, /authoritative on this device/);
  assert.equal(row(report, 'asset', 'user/uploads/gone.png').status, 'missing');
  assert.equal(row(report, 'asset', 'brand/art/unreadable').status, 'missing');

  // Links travel as addresses, never with their credentials.
  const hero = row(report, 'link', 'https://cdn.example.com/media/hero.png');
  assert.equal(hero.status, 'linked');
  assert.equal(hero.label, 'Hero photo');
  const chart = row(report, 'link', 'https://lolly.tools/tool/qr-code.svg');
  assert.equal(chart.status, 'linked');
  assert.equal(chart.tool, 'qr-code', 'a tool link records the tool it renders');
  assert.equal(row(report, 'link', 'project/p1/f2').status, 'linked');
  assert.equal(row(report, 'link', 'blob:').status, 'missing', 'a temporary address cannot travel');
  assert.ok(!report.dependencies.some(dep => dep.id.startsWith('baked/')), 'a baked picture is part of the values, not a dependency');

  // Fonts: a carried face is embedded; the others are recorded by identity.
  const mine = row(report, 'font', 'Mine 700 italic');
  assert.equal(mine.status, 'embedded');
  assert.equal(mine.path, row(report, 'asset', 'user/fonts/mine.ttf').path);
  const brand = row(report, 'font', 'Brand Sans 400 normal');
  assert.equal(brand.status, 'available');
  assert.equal(brand.checksum, FONT_DIGEST, 'a font recorded by identity keeps its source digest');
  assert.equal(row(report, 'font', 'Elsewhere 400 normal').status, 'missing');
  assert.equal(row(report, 'font', 'Helvetica 400 normal').status, 'available');

  // The carried parts are dependencies too.
  const ds = row(report, 'design-system', 'ds-house');
  assert.equal(ds.status, 'embedded');
  assert.equal(ds.checksum, manifest.integrity!['design-system.json']);
  assert.equal(row(report, 'templates', 'templates').checksum, manifest.integrity!['templates.json']);

  // No credential anywhere a reader can see: the report, the manifest or the README.
  const visible = [strFromU8(files[PORTABILITY_PART]!), strFromU8(files['manifest.json']!), strFromU8(files['lolly.txt']!)].join('\n');
  for (const secret of SECRETS) assert.ok(!visible.includes(secret), `"${secret}" never reaches the report, manifest or README`);
  assert.equal(manifest.fonts?.[0]?.file, '/catalog/fonts/brand-sans.woff2', 'a font address loses its signed query');
  const c = report.counts;
  assert.deepEqual(c, { embedded: 6, available: 3, linked: 3, withheld: 1, missing: 4 });
  assert.ok(strFromU8(files['lolly.txt']!).includes(`Portability: ${c.embedded} embedded, ${c.available} available, ${c.linked} linked, ${c.withheld} withheld, ${c.missing} missing`),
    'the README states the totals');
});

test('an empty profile with networking off opens what the file carries and reports the rest', async () => {
  const built = await buildMixed();
  const bytes = new Uint8Array(await built.blob.arrayBuffer());
  const target = memHost();
  const { result, calls } = await offline(async () => {
    const contents = await readLollyFile(bytes);
    const check = await checkLollyPortability(contents);   // an empty receiver
    // The test's own SVG is benign; a DOM-free runtime has no sanitiser of its own.
    const ingest = await ingestLollyFile(contents, target.host, { sanitizeSvg: async (svg) => svg });
    return { check, ingest };
  });
  const { check, ingest } = result;

  assert.deepEqual(calls, [], 'reading, checking and opening the file never touched the network');
  assert.equal(check.ready, false, 'this file depends on things an empty device does not have');
  const outcome = (kind: LollyDependency['kind'], id: string) => check.dependencies.find(dep => dep.kind === kind && dep.id === id)?.outcome;
  for (const id of ['user/uploads/photo.png', 'user/fonts/mine.ttf', 'lolly/logo/primary']) assert.equal(outcome('asset', id), 'ready', `${id} opens from the file`);
  assert.equal(outcome('design-system', 'ds-house'), 'ready');
  assert.equal(outcome('templates', 'templates'), 'ready');
  assert.equal(outcome('font', 'Mine 700 italic'), 'ready');
  assert.equal(outcome('asset', 'brand/logo/locked'), 'held-back');
  assert.equal(outcome('asset', 'user/uploads/gone.png'), 'unavailable');
  assert.equal(outcome('tool', 'design'), 'unavailable', 'an empty profile has no tools');
  assert.equal(outcome('font', 'Brand Sans 400 normal'), 'unavailable');
  assert.equal(outcome('link', 'https://cdn.example.com/media/hero.png'), 'needs-network');
  assert.equal(outcome('link', 'https://lolly.tools/tool/qr-code.svg'), 'needs-network');
  assert.equal(check.outcomes.damaged, 0);

  // The check and the open agree: every embedded asset reached the empty store, and
  // the session's references point at bytes that are now on this device.
  const embeddedAssets = check.dependencies.filter(dep => dep.kind === 'asset' && dep.status === 'embedded');
  assert.equal(target.userStore.size, embeddedAssets.length);
  assert.equal(ingest.imported, embeddedAssets.length);
  const session = ingest.session as Record<string, { id: string }>;
  for (const key of ['photo', 'font', 'logo']) assert.ok(target.userStore.has(session[key]!.id), `${key} resolves on the receiving device`);
});

test('a receiving device that already has a dependency reports it ready', async () => {
  const built = await buildMixed();
  const contents = await readLollyFile(new Uint8Array(await built.blob.arrayBuffer()));
  const check = await checkLollyPortability(contents, {
    hasAsset: (id) => id === 'brand/logo/locked',
    hasTool: (id) => id === 'design' || id === 'qr-code',
    hasFont: (font) => font.checksum === FONT_DIGEST && font.id.startsWith('Brand Sans'),
  });
  const outcome = (kind: LollyDependency['kind'], id: string) => check.dependencies.find(dep => dep.kind === kind && dep.id === id)?.outcome;
  assert.equal(outcome('asset', 'brand/logo/locked'), 'ready', 'a device with the brand pack shows the held-back logo');
  assert.equal(outcome('tool', 'design'), 'ready');
  assert.equal(outcome('link', 'https://lolly.tools/tool/qr-code.svg'), 'ready', 'a tool link renders offline when the tool is installed');
  assert.equal(outcome('font', 'Brand Sans 400 normal'), 'ready');
  assert.equal(outcome('link', 'https://cdn.example.com/media/hero.png'), 'needs-network', 'a web address still needs the network');
});

test('a file with its tool and its uploads is self-contained and opens complete offline', async () => {
  const enc = (s: string) => new TextEncoder().encode(s);
  const tool: LollyToolBundle = {
    id: 'demo-tool', version: '2.0.0', trust: 'custom',
    files: { 'tool.json': enc('{"id":"demo-tool","version":"2.0.0"}'), 'template.html': enc('<div>{{title}}</div>'), 'hooks.js': enc('export function onInit(){}') },
  };
  const built = await buildLollyFile({
    session: { photo: { source: 'user', id: 'user/uploads/photo.png', type: 'raster', format: 'png', url: '' } },
    toolId: 'demo-tool', toolVersion: '2.0.0', userAssets, tool,
  });
  assert.equal(built.summary.portability?.selfContained, true);
  const { result, calls } = await offline(async () => {
    const contents = await readLollyFile(new Uint8Array(await built.blob.arrayBuffer()));
    return { contents, report: await readLollyPortability(contents), check: await checkLollyPortability(contents) };
  });
  assert.deepEqual(calls, []);
  const toolRow = row(result.report, 'tool', 'demo-tool');
  assert.equal(toolRow.status, 'embedded');
  assert.equal(toolRow.trust, 'custom');
  assert.equal(toolRow.checksum, await toolInventoryDigest(result.contents.manifest.bundledTool!.files, result.contents.manifest.integrity),
    'the tool row carries the digest of its whole file inventory');
  assert.equal(result.report.dependencies.filter(dep => dep.kind === 'tool').length, 1, 'a carried tool is listed once');
  assert.equal(result.check.ready, true, 'every dependency opens on an empty device with networking off');
});

test('a custom tool left out of the file is reported missing, with the reason', async () => {
  const built = await buildLollyFile({ session: { title: 'Hi' }, toolId: 'my-fork', toolTrust: 'custom', userAssets: [] });
  const contents = await readLollyFile(new Uint8Array(await built.blob.arrayBuffer()));
  const report = await readLollyPortability(contents);
  const tool = row(report, 'tool', 'my-fork');
  assert.equal(tool.status, 'missing');
  assert.match(tool.reason!, /signed catalog does not list this tool/);
  const unknown = await buildLollyFile({ session: { title: 'Hi' }, toolId: 'qr-code', userAssets: [] });
  const unknownReport = await readLollyPortability(await readLollyFile(new Uint8Array(await unknown.blob.arrayBuffer())));
  assert.equal(row(unknownReport, 'tool', 'qr-code').status, 'available', 'with no trust read, the tool is not guessed missing');
});

test('a project file lists each tool its sessions open in, and not the container', async () => {
  const built = await buildLollyFile({
    kind: 'project', toolId: LOLLY_PROJECT_TOOL_ID, session: null, userAssets,
    project: {
      name: 'Launch', folders: [{ id: 'f1', name: 'Launch', parentId: null, items: [{ type: 'session', ref: 's1' }, { type: 'session', ref: 's2' }] }],
      sessions: [
        { key: 's1', toolId: 'design', toolVersion: '3.1.0', data: { photo: { source: 'user', id: 'user/uploads/photo.png', type: 'raster', format: 'png', url: '' } } },
        { key: 's2', toolId: 'chart', data: { link: { source: 'remote', id: 'https://data.example.com/q3.csv?key=TOKEN-abcdef', type: 'data', format: 'csv', url: '' } } },
      ],
    },
  });
  const contents = await readLollyFile(new Uint8Array(await built.blob.arrayBuffer()));
  const report = await readLollyPortability(contents);
  assert.deepEqual(report.dependencies.filter(dep => dep.kind === 'tool').map(dep => dep.id), ['design', 'chart']);
  assert.equal(row(report, 'asset', 'user/uploads/photo.png').status, 'embedded');
  assert.equal(row(report, 'link', 'https://data.example.com/q3.csv').status, 'linked');
  assert.ok(!JSON.stringify(report).includes('TOKEN-abcdef'));
});

test('a file written before the report is described by the same rules', async () => {
  const built = await buildMixed();
  const contents = await readLollyFile(new Uint8Array(await built.blob.arrayBuffer()));
  const carried = await readLollyPortability(contents);
  // The same file as an older writer would have made it: no part, no manifest totals.
  const { [PORTABILITY_PART]: _part, ...olderFiles } = contents.files;
  const { portability: _summary, ...olderManifest } = contents.manifest;
  const older = { ...contents, files: olderFiles, manifest: { ...olderManifest, integrity: { ...contents.manifest.integrity } } };
  delete older.manifest.integrity[PORTABILITY_PART];
  const derived = await readLollyPortability(older);
  const statuses = (report: LollyPortabilityReport) => report.dependencies.map(dep => `${dep.kind} ${dep.id} ${dep.status}`).sort();
  assert.deepEqual(statuses(derived), statuses(carried), 'the derived report agrees with the carried one');
  assert.equal(row(derived, 'tool', 'design').trust, undefined, 'only the sender knew the tool trust');
});

test('a report whose carried rows disagree with the bytes reads as damaged', async () => {
  const built = await buildMixed();
  const contents = await readLollyFile(new Uint8Array(await built.blob.arrayBuffer()));
  const photo = (await readLollyPortability(contents)).dependencies.find(dep => dep.id === 'user/uploads/photo.png')!;
  const { [photo.path!]: _gone, ...without } = contents.files;
  const missingBytes = await checkLollyPortability({ ...contents, files: without });
  assert.equal(missingBytes.dependencies.find(dep => dep.id === photo.id)?.outcome, 'damaged');

  // A rewritten report part is refused by the integrity map before any check runs.
  const files = unzipSync(new Uint8Array(await built.blob.arrayBuffer()));
  const forged = JSON.parse(strFromU8(files[PORTABILITY_PART]!)) as LollyPortabilityReport;
  forged.dependencies = forged.dependencies.map(dep => ({ ...dep, status: 'embedded' as const }));
  files[PORTABILITY_PART] = strToU8(JSON.stringify(forged));
  await assert.rejects(readLollyFile(zipSync(files)), /integrity check/);
});

test('a report read off someone else\'s file drops malformed rows and counts again', () => {
  const read = readPortabilityReport({
    version: 1, selfContained: true, counts: { embedded: 99, available: 0, linked: 0, withheld: 0, missing: 0 },
    dependencies: [
      { kind: 'asset', id: 'user/uploads/photo.png', label: 'photo', status: 'embedded', path: 'assets/uploads/photo.png' },
      { kind: 'asset', id: 'x', label: 'x', status: 'teleported' },
      { kind: 'spell', id: 'x', label: 'x', status: 'missing' },
      { kind: 'link', id: 'https://example.com/a', label: 'a', status: 'linked', bytes: -1 },
      { kind: 'tool', id: 'design', label: 'design', status: 'missing', reason: 'left out' },
    ],
  })!;
  assert.deepEqual(read.dependencies.map(dep => dep.id), ['user/uploads/photo.png', 'design']);
  assert.deepEqual(read.counts, { embedded: 1, available: 0, linked: 0, withheld: 0, missing: 1 }, 'the totals come from the rows, not the file');
  assert.equal(read.selfContained, false);
  assert.equal(readPortabilityReport({ version: 2, dependencies: [] }), null, 'a newer report shape is not guessed at');
});

test('the link walk is bounded and keeps the first-seen order', () => {
  const values = { a: { source: 'remote', id: 'https://one.example/a.png' }, b: [{ source: 'remote', id: 'https://two.example/b.png' }, { source: 'remote', id: 'https://one.example/a.png' }] };
  const { links, truncated } = collectLinkedDependencies(values);
  assert.deepEqual(links.map(link => link.id), ['https://one.example/a.png', 'https://two.example/b.png'], 'a repeated link is one row');
  assert.equal(truncated, false);
  const many = Array.from({ length: 1200 }, (_, n) => ({ source: 'remote', id: `https://cdn.example.com/${n}.png` }));
  const bounded = collectLinkedDependencies(many);
  assert.equal(bounded.links.length, 1000);
  assert.equal(bounded.truncated, true, 'a document with more links than the cap says so');
});
