// SPDX-License-Identifier: MPL-2.0
/**
 * WP-F: the soft-subtitle track (subtitlesVtt) must survive the video-encode
 * client → Worker postMessage boundary, so an off-thread encode carries the same
 * caption track the in-thread core does. It is a plain string (structured-clone-
 * safe), so this only guards that the field is actually forwarded, and that a
 * transcript-less encode posts no subtitlesVtt at all (the byte-identical guard).
 *
 * No real Worker: globalThis.Worker is swapped for a stand-in that records the
 * posted message and answers it, exercising encodeVideoInWorker end to end.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { EncodePick } from './video-encode-core.ts';

class FakeWorker {
  static last: FakeWorker | null = null;
  posted: Array<{ id: number; o: { subtitlesVtt?: string } }> = [];
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() { FakeWorker.last = this; }
  postMessage(m: unknown, _transfer?: unknown[]): void { this.posted.push(m as { id: number; o: { subtitlesVtt?: string } }); }
  terminate(): void {}
}
(globalThis as unknown as { Worker: unknown }).Worker = FakeWorker;

const { encodeVideoInWorker } = await import('./video-encode.ts');
const PICK: EncodePick = { container: 'mp4', codec: 'avc1.640028', muxCodec: 'avc' };

// Drive one encode and hand back the message the client posted (the worker never
// runs). The client keeps ONE reused worker, so read the latest posted message.
async function post(o: { width: number; height: number; fps: number; bitrate: number; subtitlesVtt?: string }): Promise<{ id: number; o: { subtitlesVtt?: string } }> {
  const p = encodeVideoInWorker([], PICK, o);
  const w = FakeWorker.last!;
  assert.ok(w, 'the client spawned a worker');
  const msg = w.posted[w.posted.length - 1]!;
  w.onmessage?.({ data: { id: msg.id, buffer: new ArrayBuffer(8), type: 'video/mp4' } });
  await p;   // settle so the pending map is drained
  return msg;
}

test('subtitlesVtt rides the postMessage boundary to the worker', async () => {
  const vtt = 'WEBVTT\n\n00:00.000 --> 00:01.000\nhello\n';
  const msg = await post({ width: 320, height: 240, fps: 30, bitrate: 1_000_000, subtitlesVtt: vtt });
  assert.equal(msg.o.subtitlesVtt, vtt, 'the caption track is forwarded verbatim');
});

test('a transcript-less encode posts no subtitlesVtt (byte-identical guard)', async () => {
  const msg = await post({ width: 320, height: 240, fps: 30, bitrate: 1_000_000 });
  assert.equal(msg.o.subtitlesVtt, undefined, 'nothing added when there is no track');
});
