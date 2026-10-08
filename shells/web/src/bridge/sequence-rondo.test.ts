// SPDX-License-Identifier: MPL-2.0
/**
 * sequence-rondo.test.ts - a rondocode song as clip audio (plan 301).
 *
 * The sibling of sequence-zzfxm.test.ts, for the other kind of song a timeline
 * box can hold. A rondocode song is CODE, so the property that matters first is
 * that it reaches the renderer by the right door and nothing else: a stored song
 * behind a `blob:` url is recognised by its bytes, a share link is decoded where it
 * stands and never fetched, and anything that is not a song is handed back for the
 * caller's own warning. Then the same claims the zzfxm suite makes: a song plus a
 * length decides the bytes, the clip asks the renderer for the length its box
 * needs (on the client's half-second grid), and the samples it returns are real.
 *
 * The song is rendered with packages/rondo's REAL `renderRondo` (QuickJS, the
 * `vm` class), injected in place of the shipped Worker, which Node has no use for.
 * So these are the samples the browser worker renders, not a mock's.
 *
 * NOT PROVEN HERE: the Worker itself and its wall-clock stop (lib/rondo-render.test.ts),
 * and that the timeline panel draws a waveform for the clip (the browser pass).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { createClipAudio, type ClipAudioOpts } from './sequence-providers.ts';
import { isRondoUrl, isRondoShareUrl, sniffRondoSource, looksLikeRondoSong } from '../lib/media-source.ts';
import { rondoTargetSec, type RondoSong } from '../lib/rondo-render.ts';
import { renderRondo } from '@lolly-tools/rondo';
import {
  isRondoFileName, isRondoShareLink, rondoFromShareLink, rondoSourceBytes,
} from '../../../../engine/src/rondo-source.ts';
import { deflateSync } from 'fflate';

// ── harness ─────────────────────────────────────────────────────────────────

const stageSource = readFileSync(
  fileURLToPath(new URL('../../../../packages/rondo/generated/stage.js', import.meta.url)), 'utf8');
const { examples } = JSON.parse(readFileSync(
  fileURLToPath(new URL('../../../../packages/rondo/test/fixtures/examples.json', import.meta.url)), 'utf8')) as {
  examples: { name: string; js: string; rondo?: string }[];
};
const example = (name: string): { name: string; js: string; rondo?: string } => {
  const e = examples.find((x) => x.name === name);
  assert.ok(e, `fixture has the "${name}" example`);
  return e;
};

const TINY = `const beep = synth(({ note, gate, adsr, sine }) => sine(note.freq).mul(adsr(gate, { a: 0.01, d: 0.1, s: 0.5, r: 0.1 })))
p('beep', note('c4 e4 g4 c5').sound('beep'))
setCps(1)`;

/** The canonical stored bytes of a song, exactly what the upload path writes. */
const stored = (code: string, lang: 'js' | 'rondo' = 'js', name = 'Beep'): Uint8Array =>
  rondoSourceBytes({ schemaVersion: 1, format: 'rondocode', name, lang, code });

/** The real renderer, standing in for the Worker. Records what it was asked. */
function realRenderer(): {
  render: (song: RondoSong, seconds: number) => ReturnType<typeof renderRondo>;
  asked: { song: RondoSong; seconds: number }[];
} {
  const asked: { song: RondoSong; seconds: number }[] = [];
  return {
    render: (song, seconds) => {
      asked.push({ song, seconds });
      return renderRondo({ source: song.code, lang: song.lang, seconds }, { stageSource });
    },
    asked,
  };
}

function deps(
  render: (song: RondoSong, seconds: number) => ReturnType<typeof renderRondo>,
  bytes: Uint8Array | null,
  extra: Partial<ClipAudioOpts> = {},
): ClipAudioOpts & { reads: () => number } {
  let reads = 0;
  // hasWebCodecs false: a song must open on a platform with no AudioDecoder at all.
  return {
    deps: {
      renderRondo: render,
      hasWebCodecs: () => false,
      fetchBytes: async () => { reads++; return bytes; },
    },
    timeoutMs: 0,
    ...extra,
    reads: () => reads,
  };
}

function peakOf(ch: Float32Array): number {
  let peak = 0;
  for (let i = 0; i < ch.length; i++) { const v = Math.abs(ch[i] as number); if (v > peak) peak = v; }
  return peak;
}

function digest(channels: Float32Array[]): string {
  let h = 0x811c9dc5;
  for (const ch of channels) {
    const bytes = new Uint8Array(ch.buffer, ch.byteOffset, ch.byteLength);
    for (let i = 0; i < bytes.length; i++) { h ^= bytes[i] as number; h = Math.imul(h, 0x01000193); }
  }
  return (h >>> 0).toString(16);
}

/** A share link the way rondocode writes one: `d` scheme, raw DEFLATE over `{ n, c, l }`. */
function shareLink(code: string, name = 'Linked', lang = 'js'): string {
  const json = new TextEncoder().encode(JSON.stringify({ n: name, c: code, l: lang }));
  const b64 = Buffer.from(deflateSync(json)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `https://rondocode.com/#s=d${b64}`;
}

// ── recognition ─────────────────────────────────────────────────────────────

test('the leaf recogniser agrees with the engine on names and links', () => {
  const link = shareLink(TINY);
  const cases = [
    'song.rondo', 'song.rondo.json', 'SONG.RONDO.JSON', 'x/y/acid.rondo', 'song.json', 'song.rondo.txt',
    'song.mod', link, 'https://www.rondocode.com/play#s=dabc', 'https://rondocode.com/#x=1', 'http://rondocode.com/#s=dabc',
  ];
  for (const c of cases) {
    const engine = isRondoFileName(c) || isRondoShareLink(c);
    assert.equal(isRondoUrl(c), engine, `isRondoUrl and the engine disagree on ${c}`);
    assert.equal(isRondoShareUrl(c), isRondoShareLink(c), `isRondoShareUrl and the engine disagree on ${c}`);
  }
  // The engine decodes the link the test wrote, so the helper above is a real link.
  assert.equal(rondoFromShareLink(link).code, TINY);
});

test('stored song bytes sniff as a song; other JSON and other bytes do not', () => {
  assert.equal(sniffRondoSource(stored(TINY)), true);
  assert.equal(sniffRondoSource(new TextEncoder().encode(`﻿  ${new TextDecoder().decode(stored(TINY))}`)), true, 'a BOM and leading space are allowed');
  // A ZzFXM song JSON (an ingested MIDI) is JSON too, and must stay the zzfxm path's.
  assert.equal(sniffRondoSource(new TextEncoder().encode('{"instruments":[],"patterns":[],"sequence":[]}')), false);
  // rondocode's own project export has no `format`; it is canonicalised on the way in.
  assert.equal(sniffRondoSource(new TextEncoder().encode('{"name":"x","code":"p()"}')), false);
  assert.equal(sniffRondoSource(new Uint8Array([0x49, 0x44, 0x33, 0x04])), false, 'an mp3 is not a song');
  assert.equal(sniffRondoSource(new TextEncoder().encode('{ not json')), false);
  assert.equal(looksLikeRondoSong('blob:https://lolly.tools/abc', stored(TINY)), true);
  assert.equal(looksLikeRondoSong('https://x.test/a.rondo.json'), true);
});

// ── the clip ────────────────────────────────────────────────────────────────

test('a stored song behind a blob: url opens on a platform with no WebCodecs, and plays', async () => {
  const r = realRenderer();
  const opts = deps(r.render, stored(TINY));
  const audio = await createClipAudio('blob:https://lolly.tools/song', opts);
  assert.ok(audio, 'the song must open as clip audio');
  assert.equal(audio.durationSec(), 0, 'a song is rendered to fit its box, like a zzfxm bed');
  const pcm = await audio.pcm(0, 2.2, 48_000);
  assert.equal(pcm.sampleRate, 48_000);
  assert.equal(pcm.channels.length, 2);
  assert.equal(pcm.channels[0]!.length, Math.round(2.2 * 48_000));
  assert.ok(peakOf(pcm.channels[0]!) > 0.05, 'real samples, not silence');
  assert.equal(r.asked.length, 1);
  assert.equal(r.asked[0]!.seconds, 2.5, 'the window end, rounded up to the half-second grid');
  assert.equal(opts.reads(), 1, 'one speculative read');
  await audio.dispose();
});

test('a song and a length decide the bytes', async () => {
  const a = await createClipAudio('blob:https://lolly.tools/a', deps(realRenderer().render, stored(TINY)));
  const b = await createClipAudio('blob:https://lolly.tools/b', deps(realRenderer().render, stored(TINY)));
  const pa = await a!.pcm(0.5, 3, 48_000);
  const pb = await b!.pcm(0.5, 3, 48_000);
  assert.equal(digest(pa.channels), digest(pb.channels));
});

test('the preview and the export ask for the same render when their lengths differ by a float bit', () => {
  assert.equal(rondoTargetSec(12.000000001), rondoTargetSec(12));
  assert.equal(rondoTargetSec(12.2), 12.5);
  assert.equal(rondoTargetSec(0.1), 1, 'a render is at least a second; a short box reads its window out of it');
  assert.equal(rondoTargetSec(10_000), 600, 'the renderer ceiling');
});

test('a share link is decoded where it stands and never fetched', async () => {
  const r = realRenderer();
  const opts = deps(r.render, null);
  opts.deps!.fetchBytes = async () => { throw new Error('a share link must never be fetched'); };
  const audio = await createClipAudio(shareLink(TINY), opts);
  assert.ok(audio);
  const pcm = await audio.pcm(0, 1, 48_000);
  assert.ok(peakOf(pcm.channels[0]!) > 0.05);
  assert.equal(r.asked[0]!.song.code, TINY);
});

test('a .rondo file url is read as rondo-language text', async () => {
  const src = example('acid').rondo!;
  const r = realRenderer();
  const audio = await createClipAudio('https://lolly.test/media/acid.rondo', deps(r.render, new TextEncoder().encode(src)));
  assert.ok(audio);
  await audio.pcm(0, 1, 48_000);
  assert.equal(r.asked[0]!.song.lang, 'rondo');
  assert.equal(r.asked[0]!.song.name, 'acid');
});

test('what the render cannot play is named, in the log and on the export card', async () => {
  const notices: string[] = [];
  const logs: string[] = [];
  const opts = deps(realRenderer().render, stored(example('live mic').js, 'js', 'Live mic'), {
    notice: (m) => { notices.push(m); },
    log: (_l, m) => { logs.push(m); },
  });
  const audio = await createClipAudio('blob:https://lolly.tools/mic', opts);
  assert.ok(audio);
  await audio.pcm(0, 2, 48_000);
  await audio.pcm(2, 4, 48_000);
  assert.equal(notices.length, 1, `said once per clip, not per window: ${JSON.stringify(notices)}`);
  assert.match(notices[0]!, /live microphone/);
  assert.match(notices[0]!, /breath/);
  assert.match(notices[0]!, /talkbox/);
  assert.ok(logs.some((m) => m.includes('Live mic')), 'the log names the song');
});

test('a song that fails to render is silent with its reason said, and fails the window', async () => {
  const notices: string[] = [];
  const opts = deps(realRenderer().render, stored('this is not ( valid javascript', 'js', 'Broken'), {
    notice: (m) => { notices.push(m); },
  });
  const audio = await createClipAudio('blob:https://lolly.tools/broken', opts);
  assert.ok(audio, 'the bytes are a song; the failure belongs to the render');
  await assert.rejects(audio.pcm(0, 1, 48_000), (err: Error & { code?: string }) => err.code === 'SEQ_DECODE_FAILED');
  assert.equal(notices.length, 1);
  assert.match(notices[0]!, /Broken/);
  assert.match(notices[0]!, /silent/);
});

test('JSON that is not a song is handed back, so the caller warns as before', async () => {
  const opts = deps(async () => { throw new Error('must never be called'); },
    new TextEncoder().encode('{"instruments":[],"patterns":[],"sequence":[]}'));
  const audio = await createClipAudio('blob:https://lolly.tools/zz', opts);
  assert.equal(audio, null);
  assert.equal(opts.reads(), 1);
});
