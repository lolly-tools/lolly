// SPDX-License-Identifier: MPL-2.0
/**
 * lib/derived-asset.ts, the plan 253 half: a source with no Content Credential
 * but a recorded licence rides into a derived file as an UNSIGNED source
 * ingredient, a LUT joins as a transformation input under its own licence, and
 * a credit a licence asks for turns a dropped credential into a failure.
 *
 * Run: node --import ./tests/css-stub.mjs --test shells/web/src/lib/derived-asset.test.ts
 *
 * The stamp is the real one (bridge/export.ts stampDerivedC2pa → embedC2pa), and
 * every claim about the written file is read back with the engine's verifier.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;

const {
  signDerived, signDerivedOutcome, derivedRights, derivedSourceWork, derivedOperations, DerivedCreditError,
  derivedFailureMessage,
} = await import('./derived-asset.ts');
const { videoProvenanceFor, lutCreditOf } = await import('./video-jobs.ts');
const { PRESET_LUTS, lutSource } = await import('./preset-luts.ts');
const { verifyC2pa } = await import('@lolly/engine');

// ── a minimal PNG (the fixture tests/catalog-crop-preserves-genai-provenance.test.ts uses) ──
const bytesOf = (s: string): Uint8Array => Uint8Array.from(s, (c) => c.charCodeAt(0) & 0xff);
const concat = (arrs: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(arrs.reduce((n, a) => n + a.length, 0));
  let o = 0; for (const a of arrs) { out.set(a, o); o += a.length; } return out;
};
const u32be = (n: number): Uint8Array => Uint8Array.of((n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff);
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (b: Uint8Array): number => { let c = 0xffffffff; for (const x of b) c = CRC_T[(c ^ x) & 0xff]! ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const pngChunk = (type: string, data: Uint8Array): Uint8Array => { const td = concat([bytesOf(type), data]); return concat([u32be(data.length), td, u32be(crc32(td))]); };
function tinyPng(): Uint8Array {
  const ihdr = Uint8Array.of(0, 0, 0, 1, 0, 0, 0, 1, 8, 0, 0, 0, 0);
  const idat = Uint8Array.of(0x78, 0x01, 0x01, 0x02, 0x00, 0xfd, 0xff, 0x00, 0x7b, 0x00, 0x7c, 0x00, 0xf8);
  return concat([Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10), pngChunk('IHDR', ihdr), pngChunk('IDAT', idat), pngChunk('IEND', new Uint8Array(0))]);
}
const pngBlob = (): Blob => new Blob([tinyPng() as BlobPart], { type: 'image/png' });
/** Bytes that claim to be a PNG and are not: the writer refuses them, so no credential is attached. */
const brokenPng = (): Blob => new Blob([bytesOf('not a png') as BlobPart], { type: 'image/png' });

const host = { log() {}, profile: { get: async () => ({}) }, assets: { get: async () => ({}) as never } };

/** A library photo; `meta` decides what its catalog entry recorded. */
function photo(meta: Record<string, unknown> = {}): import('@lolly-tools/core/host-v1').AssetRef {
  return { source: 'library', id: 'lolly/photos/koala', type: 'raster', format: 'png', url: 'data:,x', meta: { name: 'Koala', ...meta } };
}
const CC_BY = { license: 'cc-by-4.0', attribution: 'Photo by Jo Example' };
const CROP = { edits: [{ action: 'c2pa.cropped' }], sourceBytes: tinyPng() };
const SUSE7 = PRESET_LUTS.find((preset) => preset.id === 'suse7-slog3-heavy')!.source;

/** A CBOR map comes back as a Map; a hand-built value as an object. */
const field = (value: unknown, key: string): unknown =>
  value instanceof Map ? value.get(key) : value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined;

async function readBack(blob: Blob) {
  return verifyC2pa(new Uint8Array(await blob.arrayBuffer()));
}

test('a catalog entry with a licence becomes a work; one with none adds nothing', () => {
  const read = derivedSourceWork(photo(CC_BY))!;
  assert.equal(read.work.id, 'lolly/photos/koala');
  assert.equal(read.work.title, 'Koala');
  // The catalog's declaration stays word for word; the identifier and link are filled in beside the declaration.
  assert.deepEqual(read.work.rights, [{
    declaration: 'cc-by-4.0', expression: 'CC-BY-4.0', url: 'https://creativecommons.org/licenses/by/4.0/',
    assertedBy: 'catalog', evidence: 'catalog-entry', status: 'parsed',
  }]);
  assert.equal(read.detail?.attribution, 'Photo by Jo Example');
  assert.equal(derivedSourceWork(photo()), null, 'not recorded is never read as permission');
  assert.equal(derivedSourceWork(photo({ attribution: 'Someone' })), null, 'a credit with no licence is not a licence');
});

test('a structured record and a disagreeing legacy licence stay two statements, and the rules name the conflict', () => {
  const rights = { works: [{ id: 'koala-work', creators: [{ name: 'Jo Example' }], rights: [{ declaration: 'CC0 1.0', assertedBy: 'source', evidence: 'manifest', status: 'parsed' }] }] };
  const read = derivedSourceWork(photo({ rights, license: 'cc-by-4.0' }))!;
  assert.equal(read.work.id, 'koala-work', 'the record names the work');
  assert.equal(read.work.rights.length, 2);
  const result = derivedRights(photo({ rights, license: 'cc-by-4.0' }), { edits: [], format: 'png' })!;
  assert.ok(result.evaluation.issues.some((issue) => issue.code === 'licence.grant-conflict'));
});

test('edit actions map to the facts the rules read; anything unnamed is the cautious word', () => {
  assert.deepEqual(derivedOperations([{ action: 'c2pa.cropped' }, { action: 'c2pa.resized' }]), ['cropped', 'resized']);
  assert.deepEqual(derivedOperations([{ action: 'c2pa.color_adjustments' }]), ['recoloured']);
  assert.deepEqual(derivedOperations([{ action: 'c2pa.orientation' }, { action: 'c2pa.edited' }]), ['retouched']);
  assert.deepEqual(derivedOperations([]), ['converted'], 'a re-encode with no edit is still a conversion');
});

test('an unsigned CC BY source rides into the derived file as an opened source ingredient with its credit', async () => {
  const outcome = await signDerivedOutcome(host, photo(CC_BY), pngBlob(), 'png', CROP);
  assert.equal(outcome.state, 'signed');
  assert.deepEqual(outcome.missing, []);
  const report = await readBack(outcome.blob);
  assert.equal(report.found, true);
  assert.equal(report.state, 'valid');
  const ingredients = report.ingredients ?? [];
  assert.equal(ingredients.length, 1, 'one ingredient: the source');
  const [ing] = ingredients;
  assert.equal(ing!.credentialed, false, 'no upstream manifest is invented');
  assert.equal(ing!.activeManifest, undefined);
  assert.equal(ing!.relationship, 'parentOf', 'the new file derives from its source');
  assert.equal(ing!.title, 'Koala');
  assert.match(ing!.description ?? '', /Photo by Jo Example/);
  assert.match(ing!.description ?? '', /Licence: CC-BY-4\.0 <https:\/\/creativecommons\.org\/licenses\/by\/4\.0\/>/);
  assert.equal(ing!.informationalUri, 'https://creativecommons.org/licenses/by/4.0/');
  assert.match(ing!.description ?? '', /cropped/);
  // The history opens the source and then crops it; nothing claims the pixels were created here.
  const actions = (report.claim?.actions ?? []).map((a) => a.action);
  assert.deepEqual(actions.slice(0, 2), ['c2pa.opened', 'c2pa.cropped']);
  assert.ok(!actions.includes('c2pa.created'));
  // The readable credit travels in the export details, required line first.
  const credits = String(report.environment?.inputs?.credits ?? '');
  assert.match(credits, /Photo by Jo Example/);
  assert.match(credits, /CC BY 4\.0 https:\/\/creativecommons\.org\/licenses\/by\/4\.0\//);
  assert.match(credits, /changes: cropped/);
});

test('a structured record with a public locator and hash binds the source bytes and writes the rights record', async () => {
  const sourceHash = `sha256:${'cd'.repeat(32)}`;
  const ref = photo({
    attribution: 'Photo by Jo Example',
    rights: { works: [{
      id: 'koala-work', title: 'Koala', creators: [{ name: 'Jo Example' }],
      sourceUrl: 'https://example.org/koala.png', sourceHash,
      rights: [{ declaration: 'CC BY 4.0', assertedBy: 'source', evidence: 'manifest', status: 'parsed' }],
    }] },
  });
  // The catalog's own checksum of the bytes this crop read pins the form actually used.
  ref.checksum = `sha256-${Buffer.from('ef'.repeat(32), 'hex').toString('base64')}`;
  ref.version = '1.0.0';
  const outcome = await signDerivedOutcome(host, ref, pngBlob(), 'png', CROP);
  assert.equal(outcome.state, 'signed');
  const [ing] = (await readBack(outcome.blob)).ingredients ?? [];
  assert.equal(ing?.data?.url, 'https://example.org/koala.png');
  assert.equal(ing?.data?.hash, 'cd'.repeat(32));
  assert.equal(ing?.instanceId, 'lolly/photos/koala@1.0.0');
  assert.equal(ing?.rights?.creator, 'Jo Example');
  assert.equal(ing?.rights?.license, 'CC-BY-4.0');
  assert.equal(ing?.rights?.sourceHash, sourceHash);
  assert.equal(ing?.rights?.usedHash, `sha256:${'ef'.repeat(32)}`);
  assert.deepEqual(ing?.rights?.modifications, ['cropped']);
});

test('control: a source with no recorded licence derives exactly as before, created with no ingredient', async () => {
  const outcome = await signDerivedOutcome(host, photo(), pngBlob(), 'png', CROP);
  assert.equal(outcome.state, 'signed');
  assert.equal(outcome.rights, null);
  assert.equal(outcome.credits, '');
  const report = await readBack(outcome.blob);
  assert.deepEqual(report.ingredients ?? [], []);
  assert.equal(report.claim?.actions?.[0]?.action, 'c2pa.created');
  assert.equal(report.environment?.inputs?.credits, undefined);
});

test('a licence nobody can look up adds no ingredient: the file reads as it did before', async () => {
  const ref = photo({ license: 'proprietary', attribution: 'Acme Brand Team' });
  const result = derivedRights(ref, { edits: [{ action: 'c2pa.cropped' }], format: 'png' })!;
  assert.equal(result.ingredient, undefined);
  assert.ok(result.evaluation.issues.some((issue) => issue.code === 'licence.unknown'), 'recorded, not interpreted');
  assert.deepEqual(result.required, [], 'an uninterpreted licence asks for nothing automatically');
  const report = await readBack((await signDerivedOutcome(host, ref, pngBlob(), 'png', CROP)).blob);
  assert.deepEqual(report.ingredients ?? [], []);
  assert.equal(report.claim?.actions?.[0]?.action, 'c2pa.created');
});

test('a genAI-flagged unsigned source keeps its AI source type on the opened step', async () => {
  const outcome = await signDerivedOutcome(host, photo({ ...CC_BY, aiGenerated: 'full' }), pngBlob(), 'png', CROP);
  const report = await readBack(outcome.blob);
  const opened = report.claim?.actions?.find((a) => a.action === 'c2pa.opened');
  assert.match(String(opened?.digitalSourceType ?? ''), /trainedAlgorithmicMedia$/);
});

test('a required credit the file cannot carry is a failure, not a quiet unsigned file', async () => {
  // Unstampable format: no route for the credit at all.
  const unstampable = await signDerivedOutcome(host, photo(CC_BY), pngBlob(), 'bmp', CROP);
  assert.equal(unstampable.state, 'delivery-failed');
  assert.deepEqual(unstampable.missing, ['lolly/photos/koala']);
  assert.ok(unstampable.rights?.issues.some((issue) => issue.code === 'attribution.delivery-missing'));
  await assert.rejects(() => signDerived(host, photo(CC_BY), pngBlob(), 'bmp', CROP), (err: unknown) => {
    assert.ok(err instanceof DerivedCreditError);
    assert.equal(err.outcome.state, 'delivery-failed');
    assert.match(err.message, /could not carry the credit its source asks for/);
    return true;
  });
  // A stampable format whose writer refused: the stamp hands back the same blob.
  const broken = brokenPng();
  const refused = await signDerivedOutcome(host, photo(CC_BY), broken, 'png', CROP);
  assert.equal(refused.state, 'delivery-failed');
  assert.equal(refused.blob, broken);
  await assert.rejects(() => signDerived(host, photo(CC_BY), brokenPng(), 'png', CROP), DerivedCreditError);
});

test('the catalog crop and icon download routes tell the user when the credit could not travel', async () => {
  const err = await signDerived(host, photo(CC_BY), pngBlob(), 'bmp', CROP).catch((e: unknown) => e);
  assert.equal(derivedFailureMessage(err, 'general'), (err as Error).message);
  assert.equal(derivedFailureMessage(new Error('Failed to fetch'), 'general'), 'general', 'other failures keep the general message');
  // Each route used to catch, log and close with nothing said.
  const { readFileSync } = await import('node:fs');
  const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), 'utf8');
  const crop = read('../views/assets/details-inline-modes.ts');
  for (const logLine of ["'Catalog crop save failed'", "'Catalog crop failed'"]) {
    const at = crop.indexOf(logLine);
    assert.ok(at > 0, logLine);
    assert.match(crop.slice(at, at + 300), /announce\(derivedFailureMessage\(err, /, `${logLine} is announced`);
  }
  const icon = read('../views/assets/downloads.ts');
  const at = icon.indexOf("'Catalog download failed'");
  assert.match(icon.slice(at, at + 300), /announce\(derivedFailureMessage\(err, /);
});

test('optional provenance stays best-effort: no licence, or a licence that asks for no credit, still ships', async () => {
  for (const meta of [{}, { license: 'cc0-1.0', attribution: 'Jo Example' }]) {
    const broken = brokenPng();
    const outcome = await signDerivedOutcome(host, photo(meta), broken, 'png', CROP);
    assert.equal(outcome.state, 'unsigned');
    assert.deepEqual(outcome.missing, []);
    assert.equal(await signDerived(host, photo(meta), broken, 'png', CROP), broken);
  }
});

test('a promised credential now fails on a signing failure, not only on an unstampable format', async () => {
  await assert.rejects(
    () => signDerived(host, photo(), brokenPng(), 'png', { ...CROP, requireCredential: true }),
    /Content Credentials could not be attached/,
  );
});

test('a LUT is a transformation input under its own licence, never the photograph\'s', () => {
  const cc0Photo = photo({ license: 'cc0-1.0', attribution: 'Jo Example' });
  const result = derivedRights(cc0Photo, { edits: [{ action: 'c2pa.color_adjustments' }], sources: [SUSE7], format: 'png' })!;
  const lutUse = result.evaluation.uses.find((use) => use.work === 'darkroom/luts/suse7-slog3-heavy')!;
  const photoUse = result.evaluation.uses.find((use) => use.work === 'lolly/photos/koala')!;
  assert.equal(lutUse.classification, 'unchanged');
  assert.equal(lutUse.rule, 'transformation-input-v1');
  assert.equal(lutUse.licence, 'CC-BY-4.0');
  assert.equal(photoUse.licence, 'CC0-1.0', 'the photo keeps its own licence');
  assert.equal(photoUse.classification, 'adaptation');
  // Only the LUT's licence asks for a credit; the CC0 photo's is a courtesy.
  assert.deepEqual(result.required, ['darkroom/luts/suse7-slog3-heavy']);
  assert.deepEqual(result.evaluation.plan.optional.map((notice) => notice.work), ['lolly/photos/koala']);
  // The one ingredient is the photo, and nothing of the LUT's licence is written into the ingredient.
  assert.equal(result.ingredient?.title, 'Koala');
  assert.doesNotMatch(result.ingredient?.description ?? '', /CC-BY|Chamalian|SUSE/);
  assert.match(result.credits, /SUSE · Peter Chamalian/);
  // A photo with no record still gets the LUT's credit, and no ingredient is made for the LUT.
  const bare = derivedRights(photo(), { edits: [{ action: 'c2pa.color_adjustments' }], sources: [SUSE7], format: 'png' })!;
  assert.equal(bare.ingredient, undefined);
  assert.deepEqual(bare.required, ['darkroom/luts/suse7-slog3-heavy']);
});

test('the SUSE7 record writes the colour action the old LutCredit wrote, field for field', () => {
  const legacy = videoProvenanceFor('grade', {
    lutLabel: 'SUSE7 S-Log3 (Heavy)',
    lutCredit: {
      name: 'SUSE7 S-Log3 (Heavy)', author: 'Peter Chamalian',
      role: 'Director of Photography & Editor', org: 'SUSE',
      copyright: '© 2025 SUSE', license: 'CC BY 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/', created: '2025-09',
    },
  });
  const migrated = videoProvenanceFor('grade', { lutLabel: 'SUSE7 S-Log3 (Heavy)', lut: SUSE7 });
  assert.deepEqual(migrated, legacy);
});

test('every preset LUT carries a transformation record; the public-domain looks credit FilmSim as a courtesy', () => {
  assert.equal(PRESET_LUTS.length, 5);
  for (const preset of PRESET_LUTS) {
    assert.equal(preset.source.use.role, 'transformation', preset.id);
    assert.equal(preset.source.use.work, preset.source.work.id);
    assert.equal(preset.source.work.title, preset.label, 'the descriptive name, never an upstream stock name');
  }
  const muted = PRESET_LUTS.find((preset) => preset.id === 'chrome-muted')!.source;
  const credit = lutCreditOf(muted)!;
  assert.equal(credit.author, 'Sébastien Guyader');
  assert.equal(credit.license, 'CC0 1.0');
  assert.equal('org' in credit, false);
  const result = derivedRights(photo(), { edits: [{ action: 'c2pa.color_adjustments' }], sources: [muted], format: 'png' })!;
  assert.deepEqual(result.required, [], 'CC0 asks for nothing');
  assert.match(result.credits, /Credits offered as a courtesy/);
  // A record that names nobody has no credit to write on the colour action.
  assert.equal(lutCreditOf(lutSource({ id: 'x', creators: [], rights: [] })), null);
});

test('a graded CC BY photo carries one ingredient, both credits, and the LUT record on the colour step', async () => {
  const prov = videoProvenanceFor('grade', { lutLabel: 'SUSE7 S-Log3 (Heavy)', lut: SUSE7 });
  const o = { edits: prov.actions as never, sources: [SUSE7], sourceBytes: tinyPng() };
  const outcome = await signDerivedOutcome(host, photo(CC_BY), pngBlob(), 'png', o);
  assert.equal(outcome.state, 'signed');
  const report = await readBack(outcome.blob);
  assert.equal(report.ingredients?.length, 1, 'the LUT is not part of the picture');
  assert.equal(report.ingredients?.[0]?.title, 'Koala');
  const credits = String(report.environment?.inputs?.credits ?? '');
  assert.match(credits, /Photo by Jo Example/);
  assert.match(credits, /SUSE · Peter Chamalian/);
  const colour = report.claim?.actions?.find((a) => a.action === 'c2pa.color_adjustments');
  const lut = field(colour?.parameters, 'com.lolly.lut');
  assert.equal(field(lut, 'creator'), 'Peter Chamalian');
  assert.equal(field(lut, 'license'), 'CC BY 4.0');
  // Drop the credential and both required credits are named as missing.
  const failed = await signDerivedOutcome(host, photo(CC_BY), brokenPng(), 'png', o);
  assert.equal(failed.state, 'delivery-failed');
  assert.deepEqual([...failed.missing].sort(), ['darkroom/luts/suse7-slog3-heavy', 'lolly/photos/koala']);
});
