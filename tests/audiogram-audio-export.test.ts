// SPDX-License-Identifier: MPL-2.0
//
// Audiogram audio-only export (wav / mp3 / m4a / opus).
//
// What an audio export MEANS for this tool: THE TRIMMED EXCERPT — from the
// "Start at" in-point to the end of the clip (or to a length the user typed),
// not the whole source file. The tool applies nothing else to it: hooks.js only
// ANALYSES the clip (host.audio) to drive the picture, and the video's soundtrack
// is that same span played at the export bar's own level, with no fade,
// normalisation or gain of the tool's own. So the excerpt is a plain trim, and the
// audio file and the video's soundtrack cannot disagree about the same clip.
//
// Pinned here:
//   1. The manifest offers all four audio formats and still opens on the picture.
//   2. The in-point contract: template.html stamps `start` as data-audio-start,
//      which is where the export bar reads the excerpt's start from.
//   3. beforeExport clears an inherited video duration for an audio format (an
//      excerpt runs to the end of the clip) and defers to a user-set length.
//   4. The trim window is respected, clamps to what is there, and an untrimmed
//      export in the source's own format PASSES THE ORIGINAL BYTES THROUGH rather
//      than re-encoding lossy to lossy for nothing.
//   5. With no audio picked there is nothing to export, and the attempt says so
//      instead of writing a file of silence.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { packWav, parseWav } from '../engine/src/wav.ts';
import type { AudioPcm } from '../shells/web/src/lib/audio-encode.ts';
import { NO_AUDIO_MSG, renderAudioExport } from '../shells/web/src/lib/audio-encode.ts';

const SR = 8000;

const TOOL_DIR = new URL('../community/audiogram/', import.meta.url);
const MANIFEST = JSON.parse(readFileSync(new URL('tool.json', TOOL_DIR), 'utf8')) as {
  render: { formats: string[] };
  inputs: { id: string; type: string; assetType?: string }[];
};
const TEMPLATE = readFileSync(new URL('template.html', TOOL_DIR), 'utf8');
const HOOKS_SRC = readFileSync(new URL('hooks.js', TOOL_DIR), 'utf8');

const AUDIO_FORMATS = ['wav', 'mp3', 'm4a', 'opus'];

interface HookModule {
  beforeExport: (ctx: { format: string; opts: Record<string, unknown> }) => void;
}

/** Compile hooks.js exactly as engine/src/runtime.ts getHookFactory does. */
function compileHooks(): HookModule {
  const factory = new Function(
    'host',
    `${HOOKS_SRC}; return { beforeExport: typeof beforeExport !== 'undefined' ? beforeExport : null };`,
  ) as (host: unknown) => HookModule;
  return factory(null);
}

/** A 220 Hz tone, `seconds` long — every sample distinct enough that a slice can
 *  be checked against the position it claims to have come from. */
function tone(seconds: number): AudioPcm {
  const out = new Float32Array(Math.round(seconds * SR));
  for (let i = 0; i < out.length; i++) out[i] = 0.6 * Math.sin((2 * Math.PI * 220 * i) / SR);
  return { channels: [out], sampleRate: SR };
}

function wavSource(seconds: number): { pcm: AudioPcm; bytes: ArrayBuffer } {
  const pcm = tone(seconds);
  const u8 = packWav(pcm);
  // A standalone ArrayBuffer, so a byte-identity check compares the whole thing.
  const bytes = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
  return { pcm, bytes };
}

/** An "mp3": an ID3 tag over bytes nothing here decodes. The decode is injected,
 *  so what matters is that sniffAudioFormat reads it as mp3 — which is what the
 *  pass-through rule keys off. */
function fakeMp3(): ArrayBuffer {
  const u8 = new Uint8Array(2048);
  u8.set([0x49, 0x44, 0x33, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
  for (let i = 10; i < u8.length; i++) u8[i] = (i * 37) & 0xff;
  return u8.buffer as ArrayBuffer;
}

const bytesOf = async (blob: Blob): Promise<Uint8Array> => new Uint8Array(await blob.arrayBuffer());

test('the manifest offers all four audio formats and still opens on the picture', () => {
  const formats = MANIFEST.render.formats;
  for (const f of AUDIO_FORMATS) assert.ok(formats.includes(f), `render.formats is missing ${f}`);
  assert.ok(!AUDIO_FORMATS.includes(formats[0]!), `the default format must stay the picture, got ${formats[0]}`);
  assert.equal(formats[0], 'png');
  // The excerpt is meaningless without a clip to cut it out of.
  assert.ok(
    MANIFEST.inputs.some((i) => i.type === 'asset' && i.assetType === 'audio'),
    'the tool must still declare an audio asset input',
  );
});

test('the in-point reaches the export bar as data-audio-start', () => {
  // The export path reads the excerpt's start off the stage, not out of the
  // manifest — so this attribute IS the contract between the "Start at" input and
  // an audio export. See views/tool-actions.ts stageAudioStart().
  assert.match(TEMPLATE, /data-audio-start="\{\{default start 0\}\}"/);
});

test('beforeExport: an audio export runs to the end of the clip unless a length was typed', () => {
  const hooks = compileHooks();

  // An 8 s duration inherited from the video card must not truncate the sound.
  const inherited = { format: 'wav', opts: { duration: 8 } as Record<string, unknown> };
  hooks.beforeExport(inherited);
  assert.ok(!('duration' in inherited.opts), 'an inherited duration is cleared, so the excerpt runs to the end');

  for (const format of AUDIO_FORMATS) {
    const chosen = { format, opts: { duration: 4, durationUserSet: true } as Record<string, unknown> };
    hooks.beforeExport(chosen);
    assert.equal(chosen.opts.duration, 4, `${format}: a user-set length wins`);
  }

  // The video branch is untouched: with nothing analysed it still falls back to
  // the manifest's own default rather than being cleared.
  const video = { format: 'mp4', opts: {} as Record<string, unknown> };
  hooks.beforeExport(video);
  assert.equal(video.opts.duration, 8, 'mp4 still follows the analysed span');
});

test('the excerpt is the chosen window, not the source length', async () => {
  const { pcm, bytes } = wavSource(10);
  const blob = await renderAudioExport('wav', {
    audio: { url: 'blob:clip', start: 2 },
    duration: 3,
    fetchBytes: async () => bytes,
    decode: async () => pcm,
  });
  const out = parseWav(await bytesOf(blob));
  assert.equal(out.sampleRate, SR);
  assert.equal(out.channels[0]!.length, 3 * SR, 'three seconds of frames, not ten');
  // ...and it is the window that was asked for, not the head of the file.
  const src = pcm.channels[0]!;
  for (const at of [0, 1000, 3 * SR - 1]) {
    assert.ok(
      Math.abs(out.channels[0]![at]! - src[2 * SR + at]!) < 1e-3,
      `sample ${at} of the excerpt is sample ${2 * SR + at} of the source`,
    );
  }
});

test('a window longer than what is left clamps instead of failing', async () => {
  const { pcm, bytes } = wavSource(4);
  const blob = await renderAudioExport('wav', {
    audio: { url: 'blob:clip', start: 1 },
    duration: 10,                                     // more than the 3 s that remain
    fetchBytes: async () => bytes,
    decode: async () => pcm,
  });
  const out = parseWav(await bytesOf(blob));
  assert.equal(out.channels[0]!.length, 3 * SR, 'clamped to the end of the clip');
});

test('a start past the end of the clip falls back to 0:00 and says so', async () => {
  const { pcm, bytes } = wavSource(4);
  const warnings: string[] = [];
  const blob = await renderAudioExport('wav', {
    audio: { url: 'blob:clip', start: 9 },
    fetchBytes: async () => bytes,
    decode: async () => pcm,
    log: (level, msg) => { if (level === 'warn') warnings.push(msg); },
  });
  assert.equal(warnings.length, 1, 'the fallback is reported, not silent');
  assert.equal(parseWav(await bytesOf(blob)).channels[0]!.length, 4 * SR);
});

test('an untrimmed export in the source own format passes the original bytes through', async () => {
  // Lossy in, lossy out, nothing changed: re-encoding here would throw away
  // quality for nothing, so the source bytes come back untouched.
  const src = fakeMp3();
  const blob = await renderAudioExport('mp3', {
    audio: { url: 'blob:voice.mp3' },
    fetchBytes: async () => src,
    decode: async () => tone(2),
  });
  assert.deepEqual(await bytesOf(blob), new Uint8Array(src), 'the source file itself');
  assert.equal(blob.type, 'audio/mpeg');

  // Same for a whole-file WAV.
  const wav = wavSource(2);
  const same = await renderAudioExport('wav', {
    audio: { url: 'blob:clip.wav' },
    fetchBytes: async () => wav.bytes,
    decode: async () => wav.pcm,
  });
  assert.deepEqual(await bytesOf(same), new Uint8Array(wav.bytes));
});

test('a trimmed export re-encodes, and a format change never passes through', async () => {
  const src = fakeMp3();
  const decoded = tone(4);
  // An excerpt genuinely changes the samples, so lamejs really runs.
  const trimmed = await renderAudioExport('mp3', {
    audio: { url: 'blob:voice.mp3', start: 1 },
    duration: 2,
    fetchBytes: async () => src,
    decode: async () => decoded,
  });
  const out = await bytesOf(trimmed);
  assert.notDeepEqual(out, new Uint8Array(src), 'a trim is a real encode, not the source bytes');
  assert.ok(out.length > 0);
  // Sanity: MPEG frame sync at the head of what lamejs produced.
  assert.equal(out[0], 0xff);
  assert.equal(out[1]! & 0xe0, 0xe0);

  // An untrimmed WAV asked for as MP3 is a format the user does not have yet, so
  // the pass-through must not fire on "untouched" alone.
  const wav = wavSource(1);
  const converted = await renderAudioExport('mp3', {
    audio: { url: 'blob:clip.wav' },
    fetchBytes: async () => wav.bytes,
    decode: async () => wav.pcm,
  });
  assert.notDeepEqual(await bytesOf(converted), new Uint8Array(wav.bytes));
  assert.equal(converted.type, 'audio/mpeg');
});

test('no audio picked means no audio file', async () => {
  // The audiogram draws a placeholder waveform with an empty slot; there is still
  // nothing to SOUND. The export fails with the reason rather than writing silence.
  for (const format of AUDIO_FORMATS) {
    await assert.rejects(
      () => renderAudioExport(format as 'wav', { audio: null, pcm: null }),
      (err: Error) => err.message === NO_AUDIO_MSG,
      `${format}: an empty slot must not produce a file`,
    );
  }
});
