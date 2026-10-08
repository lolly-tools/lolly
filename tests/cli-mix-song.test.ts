// SPDX-License-Identifier: MPL-2.0
/**
 * `lolly mix <song>`: one rondocode song to WAV (plan 301 phase C).
 *
 * A song is a soundtrack of one clip, so it goes through `mix`'s mixer and limiter.
 * Its code runs in the `vm` execution class inside a Worker; what it could not play
 * is a recorded warning. Pinned here, against the real CLI in a child process:
 *
 *   1. A `.rondo.json` file and a share link both come out as a RIFF/WAVE file of the
 *      length asked for.
 *   2. `--json` carries the song's execution class and its findings, both in the
 *      result and on each warning, with the finding's stable code.
 *   3. `--strict` turns a silent part into a failing exit; a song that cannot be
 *      read is a usage error with a stable kind; `--json` without `--out` is refused
 *      because the WAV and the report cannot share stdout.
 *
 * Run with: node --test tests/cli-mix-song.test.ts
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { deflateSync } from 'fflate';
import { rondoSourceBytes } from '../engine/src/rondo-source.ts';
import { verifyC2pa } from '../engine/src/c2pa-verify.ts';
import { aiKind } from '../engine/src/ai-kind.ts';
import { isRondoSongIngredient } from '../engine/src/rondo-provenance.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const BIN = join(ROOT, 'shells', 'cli', 'bin', 'lolly.ts');
const dir = await mkdtemp(join(tmpdir(), 'lolly-mix-song-'));
after(() => rm(dir, { recursive: true, force: true }));

const { examples } = JSON.parse(await readFile(join(ROOT, 'packages/rondo/test/fixtures/examples.json'), 'utf8')) as {
  examples: { name: string; js: string }[];
};
const codeOf = (name: string): string => examples.find(e => e.name === name)!.js;

function cli(args: string[]): Promise<{ stdout: Buffer; stderr: string; code: number }> {
  return new Promise((done) => {
    const child = spawn(process.execPath, [BIN, ...args], {
      cwd: dir,
      env: { ...process.env, NO_COLOR: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const out: Buffer[] = [];
    let err = '';
    child.stdout!.on('data', (c: Buffer) => out.push(c));
    child.stderr!.on('data', (c: Buffer) => { err += c.toString('utf8'); });
    child.on('close', (code) => done({ stdout: Buffer.concat(out), stderr: err, code: code ?? -1 }));
  });
}

const envelopeOf = (r: { stdout: Buffer }): Record<string, any> => JSON.parse(r.stdout.toString('utf8'));

/** Frames in a 16-bit stereo WAV this CLI wrote: the data chunk's size over 4. */
function wavFrames(b: Buffer): number {
  assert.equal(b.subarray(0, 4).toString('latin1'), 'RIFF');
  assert.equal(b.subarray(8, 12).toString('latin1'), 'WAVE');
  let at = 12;
  while (at + 8 <= b.length) {
    const id = b.subarray(at, at + 4).toString('latin1');
    const size = b.readUInt32LE(at + 4);
    if (id === 'data') return size / (b.readUInt16LE(34) / 8) / b.readUInt16LE(22);
    at += 8 + size + (size % 2);
  }
  assert.fail('no data chunk');
}

const liveMicFile = join(dir, 'live-mic.rondo.json');
await writeFile(liveMicFile, rondoSourceBytes({ schemaVersion: 1, format: 'rondocode', name: 'Live mic', lang: 'js', code: codeOf('live mic') }));

test('a .rondo.json song mixes to WAV; --json carries the vm class and the silent parts', async () => {
  const out = join(dir, 'live-mic.wav');
  const r = await cli(['mix', liveMicFile, '--seconds=1.5', `--out=${out}`, '--json']);
  assert.equal(r.code, 0, r.stderr);
  const env = envelopeOf(r);
  assert.equal(env.ok, true);
  assert.equal(env.command, 'mix');
  assert.equal(env.result.seconds, 1.5);
  assert.equal(env.result.song.name, 'Live mic');
  assert.equal(env.result.song.executionClass, 'vm');
  assert.equal(env.result.song.source, 'rondocode');
  assert.deepEqual(env.result.song.findings.map((f: { code: string }) => f.code), ['rondo.part.mic']);
  const w = env.warnings.find((x: { code: string }) => x.code === 'RONDO_PART_MIC');
  assert.ok(w, JSON.stringify(env.warnings));
  assert.equal(w.finding, 'rondo.part.mic');
  assert.deepEqual(w.parts, ['breath', 'talkbox']);
  assert.equal(w.executionClass, 'vm');
  assert.match(r.stderr, /vm execution class/);
  assert.equal(wavFrames(await readFile(out)), 72_000);
});

test('a share link mixes too, and --strict fails a song with a silent part', async () => {
  const json = new TextEncoder().encode(JSON.stringify({ n: 'Live mic', c: codeOf('live mic') }));
  const link = `https://rondocode.com/#s=d${Buffer.from(deflateSync(json)).toString('base64url')}`;
  const out = join(dir, 'linked.wav');
  const r = await cli(['mix', link, '--seconds=1', `--out=${out}`, '--strict']);
  assert.equal(r.code, 2, r.stderr);
  assert.match(r.stderr, /Warning: Song "Live mic": Parts that play the live microphone are silent/);
  assert.equal(wavFrames(await readFile(out)), 48_000, 'the file is still written; the exit reports the warning');
});

test('an audible song with nothing silent passes --strict', async () => {
  const file = join(dir, 'acid.rondo.json');
  await writeFile(file, rondoSourceBytes({ schemaVersion: 1, format: 'rondocode', name: 'Acid', lang: 'js', code: codeOf('acid') }));
  const r = await cli(['mix', file, '--seconds=1', `--out=${join(dir, 'acid.wav')}`, '--strict', '--json']);
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(envelopeOf(r).warnings, []);
  assert.deepEqual(envelopeOf(r).result.song.findings, []);
});

test('refusals are named: an unreadable song, --json with no file, a bad length', async () => {
  const bad = join(dir, 'bad.rondo.json');
  await writeFile(bad, '{"code": 42}');
  const unreadable = await cli(['mix', bad, `--out=${join(dir, 'bad.wav')}`, '--json']);
  assert.equal(unreadable.code, 2);
  assert.equal(envelopeOf(unreadable).error.kind, 'RONDO_SOURCE_INVALID');

  const noFile = await cli(['mix', liveMicFile, '--json']);
  assert.equal(noFile.code, 2);
  assert.equal(envelopeOf(noFile).error.kind, 'CONFLICTING_FLAGS');

  const badLength = await cli(['mix', liveMicFile, '--seconds=0', `--out=${join(dir, 'x.wav')}`]);
  assert.equal(badLength.code, 2);
  assert.match(badLength.stderr, /--seconds needs a positive number/);
});

/** The text of a WAV's RIFF LIST/INFO tag, or undefined. */
function infoTag(b: Buffer, tag: string): string | undefined {
  let at = 12;
  while (at + 8 <= b.length) {
    const id = b.subarray(at, at + 4).toString('latin1');
    const size = b.readUInt32LE(at + 4);
    if (id === 'LIST' && b.subarray(at + 8, at + 12).toString('latin1') === 'INFO') {
      let p = at + 12;
      while (p + 8 <= at + 8 + size) {
        const sub = b.subarray(p, p + 4).toString('latin1');
        const len = b.readUInt32LE(p + 4);
        if (sub === tag) return b.subarray(p + 8, p + 8 + len).toString('utf8').replace(/\0+$/, '');
        p += 8 + len + (len % 2);
      }
    }
    at += 8 + size + (size % 2);
  }
  return undefined;
}

// Plan 301, Andy's approval of 2026-10-08: a mix that holds a song is signed, and its
// Content Credentials record the song. The terminal says so only after reading the
// written file back.
test('a song mix is signed: the credential records the song, declares how it was made, and is not flagged as AI', async () => {
  const out = join(dir, 'signed.wav');
  const r = await cli(['mix', liveMicFile, '--seconds=1', `--out=${out}`, '--json']);
  assert.equal(r.code, 0, r.stderr);
  const env = envelopeOf(r);
  assert.deepEqual(env.result.credentials, { songs: ['Live mic'], recorded: ['Live mic'], written: true });
  assert.match(r.stderr, /Content Credentials in this file record the song "Live mic", rendered in Lolly's sandbox \(the vm execution class\)/);

  const bytes = await readFile(out);
  assert.equal(wavFrames(bytes), 48_000, 'the sound is unchanged by the credential');
  const report = await verifyC2pa(new Uint8Array(bytes));
  assert.equal(report.state, 'valid', JSON.stringify(report.checks));
  assert.equal(report.aiGenerated, undefined, 'music computed from code is not flagged as AI');
  const song = (report.ingredients ?? []).find(isRondoSongIngredient);
  assert.ok(song, 'the song ingredient reads back');
  assert.equal(song.title, 'Live mic');
  assert.equal(song.instanceId, `sha256:${createHash('sha256').update(await readFile(liveMicFile)).digest('hex')}`);
  assert.match(song.description ?? '', /in the vm execution class by rondocode [0-9a-f]{12}\+lolly\.\d+, seed \d+\./);
  assert.match(song.description ?? '', /Not played in this render: breath, talkbox\./);
  assert.match(song.digitalSourceType ?? '', /\/algorithmicMedia$/);
  assert.equal(aiKind(song.digitalSourceType), undefined);
  // The whole file is one song's render, so the created step says how it was made.
  const created = (report.history ?? []).find((h) => h.action === 'c2pa.created');
  assert.ok(created, JSON.stringify(report.history));
  assert.match(String(created.digitalSourceType ?? ''), /\/algorithmicMedia$/);
  assert.match(infoTag(bytes, 'ICMT') ?? '', /^Music computed on the device from the code of a rondocode song \(vm execution class, rondocode [0-9a-f]{12}\+lolly\.\d+\), with no trained model\.$/);
  assert.equal(infoTag(bytes, 'INAM'), 'Live mic');
});

test('--c2pa=off writes the song mix with no credential, and says so', async () => {
  const out = join(dir, 'unsigned.wav');
  const r = await cli(['mix', liveMicFile, '--seconds=1', `--out=${out}`, '--c2pa=off', '--json']);
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(envelopeOf(r).result.credentials, { songs: ['Live mic'], recorded: [], written: false });
  assert.match(r.stderr, /Content Credentials are off for this run, so the file does not record its songs/);
  assert.doesNotMatch(r.stderr, /Content Credentials in this file record/);
  assert.equal((await verifyC2pa(new Uint8Array(await readFile(out)))).found, false);
});
