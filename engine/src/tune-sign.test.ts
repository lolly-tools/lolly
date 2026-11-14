// SPDX-License-Identifier: MPL-2.0
/**
 * tune-sign.ts: a WAV made by the music generator reads back with the declaration,
 * the style and the seed, as algorithmic media and with no AI flag. Read back through
 * the same verifier the Verify view uses.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canSignTune, signTuneFile, tagTuneFile } from './tune-sign.ts';
import { verifyC2pa } from './c2pa-verify.ts';
import { collectIngredients } from './c2pa-extract.ts';
import { aiKind } from './ai-kind.ts';
import { packWav } from './wav.ts';
import { ENGINE_VERSION } from './version.ts';
import { TUNE_DECLARATION, TUNE_SOURCE_TYPE } from './tune-provenance.ts';
import { extractFileMetadata } from './file-metadata.ts';
import { concatBytes } from './bytes.ts';

const tone = new Float32Array(4800).map((_, i) => Math.sin(i / 9) * 0.25);
const wav = packWav({ channels: [tone, tone], sampleRate: 48000 } as Parameters<typeof packWav>[0]) as Uint8Array;
const facts = { style: 'sugar', styleName: 'Lolly Sings Sugar', seed: 2024 };
const declaration = `${TUNE_DECLARATION}. Style Lolly Sings Sugar, seed 2024.`;

// An M4A with the box grammar the BMFF binding hashes (ftyp, moov, mdat), as
// tests/c2pa-formats.test.ts builds one: no sample is decoded.
const latin1 = (s: string): Uint8Array => Uint8Array.from(s, (c) => c.charCodeAt(0) & 0xff);
const u32 = (n: number): Uint8Array => Uint8Array.of(n >>> 24, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff);
const mp4box = (type: string, ...parts: Uint8Array[]): Uint8Array => { const p = concatBytes(parts); return concatBytes([u32(8 + p.length), latin1(type), p]); };
const m4a = concatBytes([
  mp4box('ftyp', latin1('M4A '), u32(0), latin1('M4A mp42isom')),
  mp4box('moov', mp4box('mvhd', new Uint8Array(100))),
  mp4box('mdat', latin1('fake-aac-payload')),
]);
/** The plain tags a file inspector shows, label to value. */
const plainTags = (bytes: Uint8Array): Record<string, string> =>
  Object.fromEntries(extractFileMetadata(bytes).fields.filter((f) => f.group === 'description').map((f) => [f.label, f.value]));

const created = (report: Awaited<ReturnType<typeof verifyC2pa>>) => report.history?.find((h) => h.action === 'c2pa.created');
const params = (step: ReturnType<typeof created>): Record<string, unknown> => {
  const p = step?.parameters;
  return p instanceof Map ? Object.fromEntries(p) : (p as Record<string, unknown>) ?? {};
};

test('a WAV from the music generator reads back as algorithmic media with the declaration', async () => {
  const out = await signTuneFile(wav, 'wav', { name: 'Lolly Sings Sugar · C major · 96 bpm · 2024', facts });
  const report = await verifyC2pa(out);
  assert.equal(report.found, true);
  assert.equal(report.state, 'valid', JSON.stringify(report.checks));
  assert.equal(report.aiGenerated, undefined, 'algorithmic media is not an AI flag');
  assert.equal(report.aiDisclosure, undefined, 'no model, no disclosure');
  const step = created(report);
  assert.ok(step, 'the created step reads back');
  assert.match(String(step.digitalSourceType), /\/algorithmicMedia$/);
  assert.equal(aiKind(step.digitalSourceType), undefined);
  assert.equal(step.description, declaration);
  assert.deepEqual(params(step), { source: 'lolly-music-generator', style: 'sugar', seed: 2024 });
  assert.deepEqual(collectIngredients(out).map((i) => i.title), ['Lolly Sings Sugar · C major · 96 bpm · 2024'], 'the file\'s own manifest, titled for the track');
  assert.equal(report.ingredients?.length ?? 0, 0, 'a download records no source ingredient');
  assert.equal(report.claim?.generatorInfo?.version, ENGINE_VERSION, 'the engine version that made it');
});

test('an M4A from the music generator declares algorithmic media, never a trained model, in its credential', async () => {
  const out = await signTuneFile(m4a, 'm4a', { name: 'Ska · 7', facts: { style: 'ska', styleName: 'Lolly Sings · Ska', seed: 7 } });
  const report = await verifyC2pa(out);
  assert.equal(report.state, 'valid', JSON.stringify(report.checks));
  assert.equal(report.aiGenerated, undefined, 'no AI flag');
  const step = created(report);
  assert.equal(step?.digitalSourceType, 'http://cv.iptc.org/newscodes/digitalsourcetype/algorithmicMedia');
  assert.equal(TUNE_SOURCE_TYPE, step?.digitalSourceType);
  assert.doesNotMatch(String(step?.digitalSourceType), /trainedAlgorithmicMedia/i);
  assert.equal(step?.description, `${TUNE_DECLARATION}. Style Lolly Sings · Ska, seed 7.`);
  assert.equal(report.claim?.generatorInfo?.name, 'Lolly');
  assert.equal(report.claim?.generatorInfo?.version, ENGINE_VERSION);
});

test('the plain description says the same as the credential, in the WAV comment and the M4A comment and description', async () => {
  const signedWav = await signTuneFile(wav, 'wav', { name: 'Sugar · 2024', facts });
  assert.deepEqual(plainTags(signedWav), { Title: 'Sugar · 2024', Comment: declaration });
  const signedM4a = await signTuneFile(m4a, 'm4a', { name: 'Sugar · 2024', facts });
  assert.deepEqual(plainTags(signedM4a), { Title: 'Sugar · 2024', Comment: declaration, Description: declaration });
  assert.equal((await verifyC2pa(signedM4a)).state, 'valid', 'the credential covers the description written before it');
  assert.equal((await verifyC2pa(signedWav)).state, 'valid');
});

test('tagging alone writes the description and no credential, and other formats come back as they were', async () => {
  const tagged = tagTuneFile(wav, 'wav', { name: 'x', facts });
  assert.equal(plainTags(tagged).Comment, declaration);
  assert.equal((await verifyC2pa(tagged)).found, false, 'the description is not a credential');
  const plain = await verifyC2pa(wav);
  assert.equal(plain.found, false, 'the unsigned WAV holds no credential');
  const other = new Uint8Array([1, 2, 3]);
  assert.equal(tagTuneFile(other, 'mid', { name: 'x', facts }), other);
});

test('a format with no credential placer is refused rather than reported as signed', async () => {
  assert.equal(canSignTune('wav'), true);
  assert.equal(canSignTune('m4a'), true);
  assert.equal(canSignTune('mid'), false);
  await assert.rejects(signTuneFile(new Uint8Array(8), 'mid', { name: 'x', facts }), /MID has no place for Content Credentials/);
});
