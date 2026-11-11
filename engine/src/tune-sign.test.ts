// SPDX-License-Identifier: MPL-2.0
/**
 * tune-sign.ts: a WAV made by the music generator reads back with the declaration,
 * the style and the seed, as algorithmic media and with no AI flag. Read back through
 * the same verifier the Verify view uses.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canSignTune, signTuneFile } from './tune-sign.ts';
import { verifyC2pa } from './c2pa-verify.ts';
import { collectIngredients } from './c2pa-extract.ts';
import { aiKind } from './ai-kind.ts';
import { packWav } from './wav.ts';
import { ENGINE_VERSION } from './version.ts';
import { TUNE_DECLARATION } from './tune-provenance.ts';

const tone = new Float32Array(4800).map((_, i) => Math.sin(i / 9) * 0.25);
const wav = packWav({ channels: [tone, tone], sampleRate: 48000 } as Parameters<typeof packWav>[0]) as Uint8Array;
const facts = { style: 'sugar', styleName: 'Lolly Sings Sugar', seed: 2024 };

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
  assert.equal(step.description, `${TUNE_DECLARATION}. Style Lolly Sings Sugar, seed 2024.`);
  assert.deepEqual(params(step), { source: 'lolly-music-generator', style: 'sugar', seed: 2024 });
  assert.deepEqual(collectIngredients(out).map((i) => i.title), ['Lolly Sings Sugar · C major · 96 bpm · 2024'], 'the file\'s own manifest, titled for the track');
  assert.equal(report.ingredients?.length ?? 0, 0, 'a download records no source ingredient');
  assert.equal(report.claim?.generatorInfo?.version, ENGINE_VERSION, 'the engine version that made it');
});

test('the credential is the only thing signing adds, and an unsigned file holds none', async () => {
  const out = await signTuneFile(wav, 'wav', { name: 'x', facts });
  assert.ok(out.length > wav.length, 'the credential is the only thing added');
  const plain = await verifyC2pa(wav);
  assert.equal(plain.found, false, 'the unsigned WAV holds no credential');
});

test('a format with no credential placer is refused rather than reported as signed', async () => {
  assert.equal(canSignTune('wav'), true);
  assert.equal(canSignTune('m4a'), true);
  assert.equal(canSignTune('mid'), false);
  await assert.rejects(signTuneFile(new Uint8Array(8), 'mid', { name: 'x', facts }), /MID has no place for Content Credentials/);
});
