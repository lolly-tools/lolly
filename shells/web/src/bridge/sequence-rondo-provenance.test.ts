// SPDX-License-Identifier: MPL-2.0
/**
 * sequence-rondo-provenance.test.ts - a song in a timeline is recorded in the
 * export's Content Credentials (plan 301, Andy's approval of 2026-10-08).
 *
 * The export mix (bridge/sequence-render.ts mixSequenceAudio) hears each song that
 * renders into a clip through `ClipAudioOpts.onSong`, turns it into a source
 * ingredient with lib/rondo-provenance.ts, and renderFormat merges it into the
 * stamp. The mix itself needs an OfflineAudioContext, so this suite pins the two
 * halves Node can run: the clip reports the song once, with the facts of the render
 * that played it, and the ingredient built from that report survives the real C2PA
 * writer and reader with its name, its digest, the `vm` class and the parts the
 * render could not play, and without an AI flag.
 *
 * The song is rendered with packages/rondo's REAL `renderRondo` (QuickJS, the `vm`
 * class), as in sequence-rondo.test.ts.
 *
 * NOT PROVEN HERE: the mix and the export bridge in a browser (the browser pass in
 * the plan 301 report exports a Design video with a song clip and reads it back).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { createClipAudio, type ClipAudioOpts } from './sequence-providers.ts';
import type { RondoRendered, RondoSong } from '../lib/rondo-render.ts';
import { recordedSongNames, rondoRunVersion, songIngredient, addSongIngredients } from '../lib/rondo-provenance.ts';
import { renderRondo } from '@lolly-tools/rondo';
import { rondoSourceBytes } from '../../../../engine/src/rondo-source.ts';
import { embedC2pa } from '../../../../engine/src/c2pa.ts';
import { verifyC2pa } from '../../../../engine/src/c2pa-verify.ts';
import { aiKind } from '../../../../engine/src/ai-kind.ts';
import { isRondoSongIngredient } from '../../../../engine/src/rondo-provenance.ts';
import type { SourceIngredient } from '@lolly-tools/core/host-v1';

const stageSource = readFileSync(
  fileURLToPath(new URL('../../../../packages/rondo/generated/stage.js', import.meta.url)), 'utf8');
const { examples } = JSON.parse(readFileSync(
  fileURLToPath(new URL('../../../../packages/rondo/test/fixtures/examples.json', import.meta.url)), 'utf8')) as {
  examples: { name: string; js: string }[];
};
const codeOf = (name: string): string => {
  const e = examples.find((x) => x.name === name);
  assert.ok(e, `fixture has the "${name}" example`);
  return e.js;
};

const stored = (code: string, name: string): Uint8Array =>
  rondoSourceBytes({ schemaVersion: 1, format: 'rondocode', name, lang: 'js', code });

function opts(bytes: Uint8Array, heard: { song: RondoSong; render: Pick<RondoRendered, 'run' | 'findings'> }[]): ClipAudioOpts {
  return {
    deps: {
      renderRondo: (song, seconds) => renderRondo({ source: song.code, lang: song.lang, seconds }, { stageSource }),
      hasWebCodecs: () => false,
      fetchBytes: async () => bytes,
    },
    timeoutMs: 0,
    onSong: (song, render) => { heard.push({ song, render }); },
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
    for (let c = 0; c < 2; c++) {
      const v = Math.max(-1, Math.min(1, channels[c]![i] ?? 0));
      dv.setInt16(44 + i * 4 + c * 2, Math.round(v * 32767), true);
    }
  }
  return u8;
}

/** The stamp renderFormat applies, reduced to its ingredient list. */
const stamp = (bytes: Uint8Array, ingredients: SourceIngredient[]): Promise<Uint8Array> => embedC2pa(bytes, 'wav', {
  title: 'Design', claimGenerator: 'Lolly lolly.tools', generatorInfo: { name: 'Lolly', version: '0.0.0-test' }, ingredients,
});

test('a song clip reports the render that played it once, however many windows the mix reads', async () => {
  const heard: { song: RondoSong; render: Pick<RondoRendered, 'run' | 'findings'> }[] = [];
  const clip = await createClipAudio('blob:https://lolly.tools/acid', opts(stored(codeOf('acid'), 'Acid'), heard));
  assert.ok(clip);
  await clip.pcm(0, 1, 48_000);
  await clip.pcm(1, 2, 48_000);
  assert.equal(heard.length, 1, 'one report per clip');
  assert.equal(heard[0]!.song.name, 'Acid');
  assert.equal(heard[0]!.render.run.executionClass, 'vm');
  assert.match(rondoRunVersion(heard[0]!.render.run), /^[0-9a-f]{12}\+lolly\.\d+$/);
  await clip.dispose();
});

test('the song ingredient survives the C2PA writer and reader: name, digest, vm, algorithmic, no AI flag', async () => {
  const heard: { song: RondoSong; render: Pick<RondoRendered, 'run' | 'findings'> }[] = [];
  const bytes = stored(codeOf('acid'), 'Acid');
  const clip = await createClipAudio('blob:https://lolly.tools/acid', opts(bytes, heard));
  const pcm = await clip!.pcm(0, 1, 48_000);
  const ing = await songIngredient(heard[0]!.song, heard[0]!.render);
  const out = await stamp(wavOf(pcm.channels, pcm.sampleRate), [ing]);

  const report = await verifyC2pa(out);
  assert.equal(report.state, 'valid', JSON.stringify(report.checks));
  assert.equal(report.aiGenerated, undefined, 'music computed from code is not flagged as AI');
  const song = (report.ingredients ?? []).find(isRondoSongIngredient);
  assert.ok(song, 'the song ingredient reads back');
  assert.equal(song.title, 'Acid');
  assert.equal(song.relationship, 'componentOf');
  assert.equal(song.instanceId, `sha256:${createHash('sha256').update(bytes).digest('hex')}`,
    'the digest of the stored canonical bytes, so a reader holding the song file can match it');
  assert.match(song.description ?? '', /rendered on the device in the vm execution class by rondocode [0-9a-f]{12}\+lolly\.\d+, seed \d+\./);
  assert.match(song.digitalSourceType ?? '', /\/algorithmicMedia$/);
  assert.equal(aiKind(song.digitalSourceType), undefined);
  assert.deepEqual(await recordedSongNames(new Blob([out as BlobPart])), ['Acid']);
  await clip!.dispose();
});

test('the parts a render could not play are named in the record, and no singing is claimed', async () => {
  const heard: { song: RondoSong; render: Pick<RondoRendered, 'run' | 'findings'> }[] = [];
  const clip = await createClipAudio('blob:https://lolly.tools/mic', opts(stored(codeOf('live mic'), 'Live mic'), heard));
  const pcm = await clip!.pcm(0, 1, 48_000);
  const ing = await songIngredient(heard[0]!.song, heard[0]!.render);
  assert.match(ing.description ?? '', /Not played in this render: breath, talkbox\./);
  assert.doesNotMatch(ing.description ?? '', /AI-generated/);
  const report = await verifyC2pa(await stamp(wavOf(pcm.channels, pcm.sampleRate), [ing]));
  assert.equal(report.state, 'valid');
  assert.equal(report.aiGenerated, undefined);
  await clip!.dispose();
});

test('the same song twice is one ingredient, and a file without a credential records none', async () => {
  const heard: { song: RondoSong; render: Pick<RondoRendered, 'run' | 'findings'> }[] = [];
  const bytes = stored(codeOf('acid'), 'Acid');
  for (const url of ['blob:https://lolly.tools/a', 'blob:https://lolly.tools/b']) {
    const clip = await createClipAudio(url, opts(bytes, heard));
    await clip!.pcm(0, 1, 48_000);
    await clip!.dispose();
  }
  assert.equal(heard.length, 2);
  const list: SourceIngredient[] = [];
  addSongIngredients(list, await Promise.all(heard.map(({ song, render }) => songIngredient(song, render))));
  assert.equal(list.length, 1);
  assert.deepEqual(await recordedSongNames(new Blob([wavOf([new Float32Array(8), new Float32Array(8)], 48_000) as BlobPart])), []);
});
