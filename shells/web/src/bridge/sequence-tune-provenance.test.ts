// SPDX-License-Identifier: MPL-2.0
/**
 * sequence-tune-provenance.test.ts - a saved tune in a timeline is recorded in the
 * export's Content Credentials (Andy's approval of 2026-11-10).
 *
 * The export mix (bridge/sequence-render.ts mixSequenceAudio) hears each saved tune
 * that renders into a clip through `ClipAudioOpts.onTune`, finds its asset's record
 * by url and turns it into a source ingredient with lib/tune-provenance.ts. The mix
 * itself needs an OfflineAudioContext, so this suite pins the two halves Node can run,
 * as sequence-rondo-provenance.test.ts does for songs: the clip reports the tune once,
 * and the ingredient built from it survives the real C2PA writer and reader.
 *
 * NOT PROVEN HERE: the mix and the export bridge in a browser.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import { createClipAudio, type ClipAudioOpts } from './sequence-providers.ts';
import { lofiTuneBytes, type LofiTuneRecipe } from '../lib/lofi-tune.ts';
import { recordedSourceNames, tuneSource, tuneSourceIngredient, usesDetails } from '../lib/tune-provenance.ts';
import { embedC2pa } from '../../../../engine/src/c2pa.ts';
import { verifyC2pa } from '../../../../engine/src/c2pa-verify.ts';
import { aiKind } from '../../../../engine/src/ai-kind.ts';
import { isTuneIngredient } from '../../../../engine/src/tune-provenance.ts';

const recipe: LofiTuneRecipe = { mood: 'sugar', seed: 2024, generator: 'style=sugar&seed=2024&bars=8' };

function opts(heard: LofiTuneRecipe[]): ClipAudioOpts {
  return {
    deps: {
      hasWebCodecs: () => false,
      fetchBytes: async () => lofiTuneBytes(recipe),
      // A stand-in for the Web Audio render: a quiet tone at the asked length.
      renderLofi: async (_r, seconds) => {
        const n = Math.ceil(seconds * 8000);
        const tone = new Float32Array(n).map((_, i) => Math.sin(i / 5) * 0.2);
        return { left: tone, right: tone, sampleRate: 8000 };
      },
    },
    timeoutMs: 0,
    onTune: (r) => { heard.push(r); },
  };
}

/** A 16-bit stereo WAV of the clip's samples, the container an audio-only export writes. */
function wavOf(channels: Float32Array[], rate: number): Uint8Array {
  const frames = channels[0]!.length;
  const u8 = new Uint8Array(44 + frames * 4);
  const dv = new DataView(u8.buffer);
  const put = (at: number, s: string): void => { for (let i = 0; i < s.length; i++) u8[at + i] = s.charCodeAt(i); };
  put(0, 'RIFF'); dv.setUint32(4, 36 + frames * 4, true); put(8, 'WAVE');
  put(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 2, true);
  dv.setUint32(24, rate, true); dv.setUint32(28, rate * 4, true); dv.setUint16(32, 4, true); dv.setUint16(34, 16, true);
  put(36, 'data'); dv.setUint32(40, frames * 4, true);
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < 2; c++) dv.setInt16(44 + i * 4 + c * 2, Math.round(Math.max(-1, Math.min(1, channels[c]![i] ?? 0)) * 32767), true);
  }
  return u8;
}

test('a tune clip reports its recipe once, however many windows the mix reads', async () => {
  const heard: LofiTuneRecipe[] = [];
  const clip = await createClipAudio('blob:https://lolly.tools/tune', opts(heard));
  assert.ok(clip);
  await clip.pcm(0, 1, 8000);
  await clip.pcm(1, 2, 8000);
  assert.deepEqual(heard, [recipe], 'one report per clip');
  await clip.dispose();
});

test('the tune ingredient survives the C2PA writer and reader: name, maker, licence, digest, algorithmic, no AI flag', async () => {
  const heard: LofiTuneRecipe[] = [];
  const clip = await createClipAudio('blob:https://lolly.tools/tune', opts(heard));
  const pcm = await clip!.pcm(0, 1, 8000);
  const asset = { format: 'lofi', meta: { name: 'Night drive', madeIn: 'music-generator', maker: 'Andy', license: 'CC-BY-SA-4.0' } };
  const ing = await tuneSourceIngredient(tuneSource(heard[0]!, asset), { withMaker: true });
  const out = await embedC2pa(wavOf(pcm.channels, pcm.sampleRate), 'wav', {
    title: 'Design', claimGenerator: 'Lolly lolly.tools', generatorInfo: { name: 'Lolly', version: '0.0.0-test' }, ingredients: [ing],
  });
  const report = await verifyC2pa(out);
  assert.equal(report.state, 'valid', JSON.stringify(report.checks));
  assert.equal(report.aiGenerated, undefined, 'a composed tune is not flagged as AI');
  const tune = (report.ingredients ?? []).find(isTuneIngredient);
  assert.ok(tune, 'the tune ingredient reads back');
  assert.equal(tune.title, 'Night drive');
  assert.equal(tune.relationship, 'componentOf');
  assert.equal(tune.instanceId, `sha256:${createHash('sha256').update(lofiTuneBytes(recipe)).digest('hex')}`);
  assert.match(tune.description ?? '', /^A tune made with Lolly's music generator \(procedural, no AI\).* Made by Andy\. Licence: CC BY-SA 4\.0\.$/);
  assert.match(tune.digitalSourceType ?? '', /\/algorithmicMedia$/);
  assert.equal(aiKind(tune.digitalSourceType), undefined);
  assert.deepEqual((await recordedSourceNames(new Blob([out as BlobPart])))?.tunes, ['Night drive']);
  await clip!.dispose();
});

test('with "Use my details" off, a timeline tune\'s ingredient carries no maker name and keeps everything else', async () => {
  const heard: LofiTuneRecipe[] = [];
  const clip = await createClipAudio('blob:https://lolly.tools/tune', opts(heard));
  const pcm = await clip!.pcm(0, 1, 8000);
  const asset = { format: 'lofi', meta: { name: 'Night drive', madeIn: 'music-generator', maker: 'Andy Tester', license: 'CC-BY-SA-4.0' } };
  // The mix asks the live profile, as bridge/sequence-render.ts does.
  const host = { profile: { get: async () => ({ firstname: 'Andy', lastname: 'Tester', useDetails: false }) } };
  const ing = await tuneSourceIngredient(tuneSource(heard[0]!, asset), { withMaker: await usesDetails(host) });
  const out = await embedC2pa(wavOf(pcm.channels, pcm.sampleRate), 'wav', {
    title: 'Design', claimGenerator: 'Lolly lolly.tools', generatorInfo: { name: 'Lolly', version: '0.0.0-test' }, ingredients: [ing],
  });
  assert.equal(Buffer.from(out).includes('Andy Tester'), false, 'the maker\'s name must not leave the device with Use my details off');
  const tune = ((await verifyC2pa(out)).ingredients ?? []).find(isTuneIngredient);
  assert.ok(tune, 'the tune is still recorded');
  assert.equal(tune.title, 'Night drive');
  assert.match(tune.description ?? '', /by Lolly engine [^ ]+\. Licence: CC BY-SA 4\.0\.$/, 'the licence stays, straight after the engine version');
  assert.equal(tune.informationalUri, 'https://creativecommons.org/licenses/by-sa/4.0/');
  await clip!.dispose();
});
