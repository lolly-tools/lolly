// SPDX-License-Identifier: MPL-2.0
/**
 * Strip Hidden Data on audio, through the real tool: the on-disk manifest, template
 * and hooks.js (whose strip-audio region is the compiled engine module) run in the
 * engine runtime. The report lists what was found, the download is the clean copy,
 * and a file that cannot be read is reported as such, never as already clean.
 * Run with: node --test tests/strip-data-audio.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readToolManifest, toolFile } from '@lolly-tools/node-shell/content-roots';
import { createRuntime } from '../engine/src/runtime.ts';
import { stripAudioMetadata } from '../engine/src/strip-audio.ts';
import {
  buildFlac, buildMp3, buildMp4, buildOpus, buildWav, cat, id3Text, id3v24, latin1, MP3_FRAMES, pattern, riff, riffChunk,
  WAV_PCM, wavFmt, XING_FRAMES,
} from './helpers/audio-fixtures.ts';

const BARE_HOST: any = { version: '1', profile: { get: async () => ({}) }, log: () => {} };

function stripDataTool(): any {
  const read = (rel: string) => readFileSync(toolFile('strip-data', rel)!, 'utf8');
  return { manifest: readToolManifest('strip-data'), hooksSource: read('hooks.js'), template: read('template.html') };
}

async function open(name: string, mime: string, bytes: Uint8Array) {
  return createRuntime(stripDataTool(), BARE_HOST, {
    source: { __file: true, name, mime, size: bytes.length, bytes, url: null },
  });
}

test('the manifest offers audio files and describes the audio path', () => {
  const manifest = readToolManifest('strip-data') as any;
  const source = manifest.inputs.find((i: any) => i.id === 'source');
  for (const t of ['.m4a', '.wav', '.mp3', '.flac', '.opus', 'audio/mp4', 'audio/mpeg', 'audio/wav']) assert.ok(source.accept.includes(t), t);
  assert.equal(source.accept[0], 'image/jpeg', 'image types stay first, so the smoke fixture choice is unchanged');
  assert.match(manifest.description, /images, audio and PDFs/);
});

test('strip-data (m4a): lists tags and Content Credentials, then downloads the engine\'s clean copy', async () => {
  const src = buildMp4({ udta: true, c2pa: 'tail', times: true, handlerName: 'MediabunnySoundHandler' });
  const rt = await open('song.m4a', 'audio/mp4', src);
  const html = rt.getHydrated();
  for (const text of ['Content Credentials', 'Title', 'Ska demo', 'Encoder', 'Handler description', 'Creation time', 'Download clean M4A', 'byte for byte']) {
    assert.ok(html.includes(text), `report shows ${text}`);
  }
  const { bytes, mime, filename } = await rt.exportFile() as any;
  assert.deepEqual(bytes, stripAudioMetadata(src, 'mp4'));
  assert.equal(mime, 'audio/mp4');
  assert.equal(filename, 'song-clean.m4a');
  rt.destroy();
});

test('strip-data (wav, flac, opus): each downloads a clean copy with its own type', async () => {
  for (const [name, mime, src, format, kind] of [
    ['take.wav', 'audio/wav', buildWav(), 'wav', 'WAV'],
    ['take.flac', 'audio/flac', buildFlac(), 'flac', 'FLAC'],
    ['take.opus', 'audio/ogg', buildOpus(), 'ogg', 'Opus'],
  ] as const) {
    const rt = await open(name, mime, src);
    assert.match(rt.getHydrated(), new RegExp(`Download clean ${kind}`));
    const out = await rt.exportFile() as any;
    assert.deepEqual(out.bytes, stripAudioMetadata(src, format), name);
    assert.equal(out.mime, mime);
    rt.destroy();
  }
});

test('strip-data (mp3): the clean copy is the frames alone, and a kept encoder header is explained', async () => {
  const rt = await open('song.mp3', 'audio/mpeg', buildMp3(XING_FRAMES));
  const html = rt.getHydrated();
  assert.match(html, /encoder header \(Xing header, LAME3\.100\)/);
  assert.match(html, /Content Credentials/);
  const { bytes, mime } = await rt.exportFile() as any;
  assert.deepEqual(bytes, XING_FRAMES);
  assert.equal(mime, 'audio/mpeg');
  rt.destroy();
});

test('strip-data (audio): a clean file reads as already clean and downloads unchanged', async () => {
  const plain = riff(wavFmt, riffChunk('data', WAV_PCM));
  const rt = await open('plain.wav', 'audio/wav', plain);
  assert.match(rt.getHydrated(), /This WAV is already clean/);
  assert.deepEqual((await rt.exportFile() as any).bytes, plain);
  rt.destroy();
});

test('strip-data (audio): a file that does not read is reported, never called clean, and downloads nothing', async () => {
  const broken = cat(id3v24(id3Text('TIT2', 'x')), pattern(3000, 2).map((v) => v & 0x7f));
  const rt = await open('broken.mp3', 'audio/mpeg', broken);
  const html = rt.getHydrated();
  assert.match(html, /This MP3 could not be read/);
  assert.match(html, /No MP3 audio follows the ID3 tag\. Nothing was removed\./);
  assert.doesNotMatch(html, /already clean/);
  await assert.rejects(rt.exportFile(), /No MP3 audio follows/);
  rt.destroy();
});

test('strip-data (audio): a bare MP3 with nothing to remove is already clean', async () => {
  const rt = await open('bare.mp3', 'audio/mpeg', MP3_FRAMES);
  assert.match(rt.getHydrated(), /This MP3 is already clean/);
  rt.destroy();
});

test('strip-data (mp4 with video): reported as MP4 and saved as video/mp4', async () => {
  const src = buildMp4({ udta: true, handlerName: 'VideoHandler' });
  const video = src.slice();
  const at = video.indexOf(0x73, 0); // first 's' of 'soun' sits in the mdia hdlr
  const soun = (() => { for (let i = at; i < video.length - 4; i++) if (String.fromCharCode(...video.subarray(i, i + 4)) === 'soun') return i; return -1; })();
  video.set(latin1('vide'), soun);
  const rt = await open('clip.mp4', 'video/mp4', video);
  assert.match(rt.getHydrated(), /Download clean MP4/);
  assert.equal((await rt.exportFile() as any).mime, 'video/mp4');
  rt.destroy();
});
