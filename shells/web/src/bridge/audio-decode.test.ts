// SPDX-License-Identifier: MPL-2.0
/**
 * audio-decode.test.ts - the web shell's `host.audio.decode` for a rondocode song.
 *
 * `decode()` (v1.246) is the one call a tool or another shell surface uses to turn a
 * song into PCM, so this checks its contract on the forms a song reaches it in (an
 * asset of format `rondo`, raw stored bytes, a share link) and the claim plan 301
 * makes across shells: asked for the same song and the same length, the web shell
 * returns the SAME BYTES as calling packages/rondo's `renderRondo` directly, which
 * is what the CLI and the MCP server do.
 *
 * Node has no Worker, so a stand-in runs the real `renderRondo` in-process with
 * the real staging bundle. The worker module itself is covered by the browser pass.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'fflate';
import { renderRondo } from '@lolly-tools/rondo';
import { rondoSourceBytes } from '../../../../engine/src/rondo-source.ts';

const stageSource = readFileSync(
  fileURLToPath(new URL('../../../../packages/rondo/generated/stage.js', import.meta.url)), 'utf8');
const { examples } = JSON.parse(readFileSync(
  fileURLToPath(new URL('../../../../packages/rondo/test/fixtures/examples.json', import.meta.url)), 'utf8')) as {
  examples: { name: string; js: string; rondo?: string }[];
};

/** A stand-in for the render worker: the real renderer, answered on the next tick. */
class InProcessWorker {
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  postMessage(msg: { id: number; code: string; lang: 'js' | 'rondo' | 'auto'; seconds?: number }): void {
    setImmediate(async () => {
      try {
        const pcm = await renderRondo({ source: msg.code, lang: msg.lang, ...(msg.seconds !== undefined ? { seconds: msg.seconds } : {}) }, { stageSource });
        this.onmessage?.({ data: { id: msg.id, pcm } });
      } catch (err) {
        const e = err as { name?: string; code?: string; message?: string };
        this.onmessage?.({ data: { id: msg.id, error: { name: e.name ?? 'Error', code: e.code ?? 'rondo.error', message: e.message ?? '' } } });
      }
    });
  }
  terminate(): void { /* nothing to stop in-process */ }
}
(globalThis as { Worker?: unknown }).Worker = InProcessWorker;

const { createAudioAPI } = await import('./audio.ts');
const audio = createAudioAPI();

const TINY = `const beep = synth(({ note, gate, adsr, sine }) => sine(note.freq).mul(adsr(gate, { a: 0.01, d: 0.1, s: 0.5, r: 0.1 })))
p('beep', note('c4 e4 g4 c5').sound('beep'))
setCps(1)`;
const stored = (code: string, name = 'Beep'): Uint8Array =>
  rondoSourceBytes({ schemaVersion: 1, format: 'rondocode', name, lang: 'js', code });
const hash = (chs: Float32Array[]): string => {
  const h = createHash('sha256');
  for (const c of chs) h.update(new Uint8Array(c.buffer, c.byteOffset, c.byteLength));
  return h.digest('hex');
};

test('decode renders a stored song exactly as long as asked, and says how it ran', async () => {
  const d = await audio.decode(stored(TINY), { seconds: 2 });
  assert.equal(d.sampleRate, 48_000);
  assert.equal(d.channels.length, 2);
  assert.equal(d.channels[0]!.length, 96_000, 'exactly the length asked, not a grid length');
  assert.equal(d.seconds, 2);
  assert.deepEqual(d.findings, []);
  assert.equal(d.run?.executionClass, 'vm');
  assert.equal(d.run?.source, 'rondocode');
  assert.match(d.run?.version ?? '', /^[0-9a-f]{12}\+lolly\.\d+$/);
  assert.equal(typeof d.run?.seed, 'number');
});

test('the web shell returns the same bytes as a direct renderRondo call, the CLI path', async () => {
  const d = await audio.decode(stored(TINY), { seconds: 2.25 });
  const direct = await renderRondo({ source: TINY, lang: 'js', seconds: 2.25 }, { stageSource });
  assert.equal(hash(d.channels), hash([direct.left, direct.right]));
});

test('an asset of format rondo, and a share link, decode too', async () => {
  const b64 = Buffer.from(stored(TINY)).toString('base64');
  const fromRef = await audio.decode({ id: 'user/upload/1-beep.rondo.json', url: `data:application/json;base64,${b64}`, type: 'audio', format: 'rondo', source: 'user' } as never, { seconds: 1 });
  assert.equal(fromRef.channels[0]!.length, 48_000);
  const json = new TextEncoder().encode(JSON.stringify({ n: 'Linked', c: TINY, l: 'js' }));
  const payload = Buffer.from(deflateSync(json)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const fromLink = await audio.decode(`https://rondocode.com/#s=d${payload}`, { seconds: 1 });
  assert.equal(hash(fromLink.channels), hash(fromRef.channels), 'the same song by either door');
});

test('what a song cannot play is in findings, by name', async () => {
  const mic = examples.find((e) => e.name === 'live mic');
  assert.ok(mic);
  const d = await audio.decode(stored(mic.js, 'Live mic'), { seconds: 1 });
  const f = d.findings.find((x) => x.code === 'rondo.part.mic');
  assert.ok(f, `a mic finding: ${JSON.stringify(d.findings)}`);
  assert.deepEqual([...f.parts].sort(), ['breath', 'talkbox']);
});

test('the channels decode returns are the caller\'s own: writing them leaves the cache intact', async () => {
  const first = await audio.decode(stored(TINY), { seconds: 1.5 });
  const before = hash(first.channels);
  first.channels[0]!.fill(0);
  const again = await audio.decode(stored(TINY), { seconds: 1.5 });
  assert.equal(hash(again.channels), before);
});
