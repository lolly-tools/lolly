// SPDX-License-Identifier: MPL-2.0
/**
 * rondo-sign.ts: a WAV rendered from a song reads back with what it declares.
 * With synthesised singing it is composite AI media naming the sung parts; with
 * none it is not flagged as AI at all. Read back through the same verifier the
 * Verify view uses.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canSignRondo, signRondoFile } from './rondo-sign.ts';
import { verifyC2pa } from './c2pa-verify.ts';
import { collectIngredients } from './c2pa-extract.ts';
import { packWav } from './wav.ts';
import { rondoSourceBytes } from './rondo-source.ts';

const tone = new Float32Array(4800).map((_, i) => Math.sin(i / 9) * 0.25);
const wav = packWav({ channels: [tone, tone], sampleRate: 48000 } as Parameters<typeof packWav>[0]) as Uint8Array;
const song = rondoSourceBytes({ schemaVersion: 1, format: 'rondocode', name: 'Test song', lang: 'rondo', code: 'synth s\n  sine\nplay s\n  0 2 4\n' });
const base = { executionClass: 'vm', version: 'fbbf6512df37+lolly.1', seed: 7 };

/** The RIFF LIST/INFO comment (ICMT) a WAV carries, read straight from its bytes. */
function wavComment(bytes: Uint8Array): string {
  const at = new TextDecoder('latin1').decode(bytes).indexOf('ICMT');
  if (at < 0) return '';
  const size = new DataView(bytes.buffer, bytes.byteOffset).getUint32(at + 4, true);
  return new TextDecoder().decode(bytes.subarray(at + 8, at + 8 + size)).replace(/\0+$/, '');
}

const createdParams = (report: Awaited<ReturnType<typeof verifyC2pa>>): Record<string, unknown> => {
  const p = report.history?.find((h) => h.action === 'c2pa.created')?.parameters;
  return p instanceof Map ? Object.fromEntries(p) : (p as Record<string, unknown>) ?? {};
};

test('a WAV with synthesised singing reads back as composite AI media with the sung parts', async () => {
  const out = await signRondoFile(wav, 'wav', { song, name: 'Test song', facts: { ...base, sungParts: ['lead', 'harmony'], voices: ['kizuna'] } });
  const report = await verifyC2pa(out);
  assert.equal(report.found, true);
  assert.equal(report.state, 'valid');
  assert.equal(report.aiGenerated?.kind, 'composite');
  const params = createdParams(report);
  assert.deepEqual(params.sungParts, ['lead', 'harmony']);
  assert.deepEqual(params.voices, ['kizuna']);
  assert.equal(params.executionClass, 'vm');
  assert.match(wavComment(out), /The singing is AI-generated .*: lead, harmony\./);
  // One C2PA 2.4 AI disclosure per model the singing passed through.
  assert.deepEqual(report.aiDisclosures?.map((d) => d.modelName), [
    'Supertonic-3 text to speech (Supertone Inc.)',
    'wav2vec 2.0 phoneme aligner (facebook/wav2vec2-lv-60-espeak-cv-ft, exported to ONNX)',
    'ContentVec speech encoder for voice conversion',
    'RVC voice generator "kizuna"',
  ]);
  assert.ok(report.aiDisclosures?.every((d) => d.modelType === 'c2pa.types.model.onnx'));
  assert.match(report.aiDisclosures?.[3]?.modelIdentifier ?? '', /rondocode-sing\/blob\/528c7e4e[0-9a-f]+\/gen_kizuna\.onnx$/);
});

test('a WAV with no singing reads back as not AI, and still records the song', async () => {
  const out = await signRondoFile(wav, 'wav', { song, name: 'Test song', facts: base });
  const report = await verifyC2pa(out);
  assert.equal(report.found, true);
  assert.equal(report.state, 'valid');
  assert.equal(report.aiGenerated, undefined, 'algorithmic media is not an AI flag');
  assert.equal(createdParams(report).sungParts, undefined);
  assert.equal(report.aiDisclosure, undefined, 'no model, no disclosure');
  assert.match(wavComment(out), /with no trained model\./);
  const own = collectIngredients(out)[0];
  assert.equal(own?.title, 'Test song');
});

test('a format with no credential placer is refused rather than reported as signed', async () => {
  assert.equal(canSignRondo('mid'), false);
  assert.equal(canSignRondo('flac'), true);
  await assert.rejects(signRondoFile(new Uint8Array(8), 'mid', { song, name: 'x', facts: base }), /MID has no place for Content Credentials/);
});
