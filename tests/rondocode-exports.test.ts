// SPDX-License-Identifier: MPL-2.0
/**
 * The Rondocode utility's exports (community/rondocode/hooks.js, exportSong and
 * exportStill) through the engine's real signer and reader: what each file
 * carries, and that the sentence said afterwards is what reading the file back
 * found. Andy approved the declaration on 2026-10-08 (plan 301): a file with
 * synthesised singing is composite AI media naming the sung parts; one without
 * is algorithmic media, never flagged as AI.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { signRondoFile } from '../engine/src/rondo-sign.ts';
import { verifyC2pa } from '../engine/src/c2pa-verify.ts';
import { collectIngredients } from '../engine/src/c2pa-extract.ts';
import { rondoFileName, rondoSourceBytes } from '../engine/src/rondo-source.ts';

const HOOKS_SRC = readFileSync(fileURLToPath(new URL('../community/rondocode/hooks.js', import.meta.url)), 'utf8');

interface Hooks {
  exportSong(host: unknown, job: unknown, version: string): Promise<string>;
  exportStill(ctx: unknown): Promise<{ bytes: Uint8Array; mime: string } | null>;
  midiWithText(smf: Uint8Array, text: string): Uint8Array;
  midiFirstText(smf: Uint8Array): string | null;
}

/** Compile hooks.js as engine/src/runtime.ts does, exposing the functions under test. */
function compile(): Hooks {
  return new Function('host', `${HOOKS_SRC}; return { exportSong, exportStill, midiWithText, midiFirstText };`)(null) as Hooks;
}

/** A short 16-bit stereo WAV. */
function wav(seconds = 0.2): ArrayBuffer {
  const sr = 8000;
  const n = Math.round(sr * seconds);
  const buf = new ArrayBuffer(44 + n * 4);
  const dv = new DataView(buf);
  const tag = (o: number, s: string): void => { for (let i = 0; i < 4; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  tag(0, 'RIFF'); dv.setUint32(4, 36 + n * 4, true); tag(8, 'WAVE'); tag(12, 'fmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 2, true); dv.setUint32(24, sr, true);
  dv.setUint32(28, sr * 4, true); dv.setUint16(32, 4, true); dv.setUint16(34, 16, true); tag(36, 'data'); dv.setUint32(40, n * 4, true);
  for (let i = 0; i < n; i++) { const v = Math.round(Math.sin(i / 7) * 6000); dv.setInt16(44 + i * 4, v, true); dv.setInt16(46 + i * 4, v, true); }
  return buf;
}

/** A one-track Standard MIDI File with one note. */
function smf(): ArrayBuffer {
  const track = [0x00, 0x90, 60, 100, 0x60, 0x80, 60, 0, 0x00, 0xff, 0x2f, 0x00];
  const bytes = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 0, 96, 0x4d, 0x54, 0x72, 0x6b, 0, 0, 0, track.length, ...track];
  return new Uint8Array(bytes).buffer;
}

/** A host whose signer and reader are the engine's own, and whose saves are kept. */
function fakeHost(opts: { failSign?: boolean } = {}) {
  const saved: { name: string; bytes: Uint8Array; type: string }[] = [];
  const host = {
    export: {
      async file(blob: Blob, o: { filename: string }) { saved.push({ name: o.filename, bytes: new Uint8Array(await blob.arrayBuffer()), type: blob.type }); },
    },
    c2pa: {
      async sign(bytes: Uint8Array, format: string, o: { rondo: { song: Uint8Array; name: string } & Record<string, unknown> }) {
        if (opts.failSign) throw new Error('no signer here');
        const { song, name, ...facts } = o.rondo;
        return signRondoFile(bytes, format, { song, name, facts: facts as never });
      },
      async readIngredients(bytes: Uint8Array) { return collectIngredients(bytes); },
    },
  };
  return { host, saved };
}

const SONG = { code: 'synth lead\n  sine\nplay lead\n  0 2 4\n', lang: 'rondo', name: 'Test song' };
const VERSION = 'fbbf6512df37+lolly.editor.test';
const created = (r: Awaited<ReturnType<typeof verifyC2pa>>): Record<string, unknown> => {
  const p = r.history?.find((h) => h.action === 'c2pa.created')?.parameters;
  return p instanceof Map ? Object.fromEntries(p) : (p as Record<string, unknown>) ?? {};
};

test('an editor WAV with singing is saved as composite AI media naming the sung parts, and the sentence says so after reading back', async () => {
  const hooks = compile();
  const { host, saved } = fakeHost();
  const sentence = await hooks.exportSong(host, { format: 'wav', song: SONG, sung: ['lead'], voices: ['kizuna'], silent: [], audio: wav() }, VERSION);
  assert.equal(saved.length, 1);
  assert.equal(saved[0]!.name, 'test-song.wav');
  const report = await verifyC2pa(saved[0]!.bytes);
  assert.equal(report.state, 'valid');
  assert.equal(report.aiGenerated?.kind, 'composite');
  assert.deepEqual(created(report).sungParts, ['lead']);
  assert.equal(created(report).executionClass, 'frame');
  assert.match(sentence, /Read back from the file: .*"Test song".* declare the singing AI-generated\./);
});

test('an editor WAV without singing records the song and is not flagged as AI', async () => {
  const hooks = compile();
  const { host, saved } = fakeHost();
  const sentence = await hooks.exportSong(host, { format: 'wav', song: SONG, sung: [], voices: [], silent: ['vox'], audio: wav() }, VERSION);
  const report = await verifyC2pa(saved[0]!.bytes);
  assert.equal(report.state, 'valid');
  assert.equal(report.aiGenerated, undefined);
  assert.deepEqual(created(report).silentParts, ['vox']);
  assert.equal(collectIngredients(saved[0]!.bytes)[0]?.title, 'Test song');
  assert.match(sentence, /nothing in it is marked AI-generated\.$/);
});

test('a file with singing is never saved without its declaration', async () => {
  const hooks = compile();
  const { host, saved } = fakeHost({ failSign: true });
  await assert.rejects(hooks.exportSong(host, { format: 'wav', song: SONG, sung: ['lead'], voices: [], silent: [], audio: wav() }, VERSION), /could not be declared, so the file was not saved/);
  assert.equal(saved.length, 0);
  // Without singing the file is saved, and the sentence says it carries no credentials.
  const sentence = await hooks.exportSong(host, { format: 'wav', song: SONG, sung: [], voices: [], silent: [], audio: wav() }, VERSION);
  assert.equal(saved.length, 1);
  assert.match(sentence, /without Content Credentials: no signer here/);
});

test('stems: every WAV is signed, only the sung part declares singing, and the ZIP holds them all', async () => {
  const hooks = compile();
  const { host, saved } = fakeHost();
  const sentence = await hooks.exportSong(host, {
    format: 'zip', song: SONG, sung: ['lead'], voices: ['kizuna'], silent: [],
    stems: [{ name: 'song-lead.wav', part: 'lead', bytes: wav() }, { name: 'song-bass.wav', part: 'bass', bytes: wav() }],
  }, VERSION);
  assert.equal(saved[0]!.name, 'test-song-stems.zip');
  const zip = saved[0]!.bytes;
  const entries: { name: string; body: Uint8Array }[] = [];
  for (let at = 0; new DataView(zip.buffer, zip.byteOffset).getUint32(at, true) === 0x04034b50;) {
    const dv = new DataView(zip.buffer, zip.byteOffset + at);
    const size = dv.getUint32(18, true);
    const nlen = dv.getUint16(26, true);
    entries.push({ name: new TextDecoder().decode(zip.subarray(at + 30, at + 30 + nlen)), body: zip.subarray(at + 30 + nlen, at + 30 + nlen + size) });
    at += 30 + nlen + size;
  }
  assert.deepEqual(entries.map((e) => e.name), ['test-song-stems/test-song-lead.wav', 'test-song-stems/test-song-bass.wav']);
  assert.equal((await verifyC2pa(entries[0]!.body)).aiGenerated?.kind, 'composite');
  assert.equal((await verifyC2pa(entries[1]!.body)).aiGenerated, undefined);
  assert.match(sentence, /2 of 2 carry Content Credentials .* test-song-lead\.wav declares AI-generated singing\. The ZIP itself carries none\./);
});

test('MIDI: no credential, the statement in a text event, read back before it is claimed', async () => {
  const hooks = compile();
  const { host, saved } = fakeHost();
  const sentence = await hooks.exportSong(host, { format: 'mid', song: SONG, sung: [], voices: [], silent: [], midi: smf() }, VERSION);
  const text = hooks.midiFirstText(saved[0]!.bytes);
  assert.match(text ?? '', /^Notes computed on the device from the code of the rondocode song "Test song" \(frame execution class/);
  assert.match(sentence, /MIDI has no place for Content Credentials, so none were written; read back from the file, a text event/);
  // The inserted event keeps the file well formed: the track length grew by exactly the event.
  const before = new Uint8Array(smf());
  const after = hooks.midiWithText(before, 'x');
  assert.equal(new DataView(after.buffer).getUint32(18), new DataView(before.buffer).getUint32(18) + 5);
});

test('a song file is the code as written, with nothing added', async () => {
  const hooks = compile();
  const { host, saved } = fakeHost();
  const sentence = await hooks.exportSong(host, { format: 'json', song: SONG, sung: ['lead'], voices: [], silent: [] }, VERSION);
  assert.equal(saved[0]!.name, 'test-song.rondo.json');
  assert.equal(JSON.parse(new TextDecoder().decode(saved[0]!.bytes)).code, SONG.code);
  assert.match(sentence, /carries no Content Credentials\./);
});

test('Save to Assets: the song goes in as its canonical .rondo.json, a render with its credential, and a refusal is said by name', async () => {
  const hooks = compile();
  const added: { name: string; bytes: Uint8Array; mime?: string }[] = [];
  const { host, saved } = fakeHost();
  const withAssets = { ...host, assets: { async add(f: { name: string; bytes: Uint8Array; mime?: string }) { added.push(f); return { id: `user/${f.name}` }; } } };
  // The song: no sentence of the utility's own, because the app announces the save with Undo.
  assert.equal(await hooks.exportSong(withAssets, { format: 'json', song: SONG, sung: [], voices: [], silent: [], dest: 'assets' }, VERSION), '');
  // The engine's own canonical bytes and file name, so the asset is the same song everywhere.
  assert.equal(added[0]!.name, rondoFileName({ name: 'Test song' }));
  assert.deepEqual([...added[0]!.bytes], [...rondoSourceBytes({ schemaVersion: 1, format: 'rondocode', name: 'Test song', lang: 'rondo', code: SONG.code })]);
  assert.deepEqual(JSON.parse(new TextDecoder().decode(added[0]!.bytes)), { schemaVersion: 1, format: 'rondocode', name: 'Test song', lang: 'rondo', code: SONG.code });
  // A render: signed exactly as the download is, and only the read-back is said.
  const sentence = await hooks.exportSong(withAssets, { format: 'wav', song: SONG, sung: ['lead'], voices: ['kizuna'], silent: [], audio: wav(), dest: 'assets' }, VERSION);
  assert.equal(added[1]!.name, 'test-song.wav');
  assert.equal((await verifyC2pa(added[1]!.bytes)).aiGenerated?.kind, 'composite');
  assert.match(sentence, /^Read back from the file: .* declare the singing AI-generated\.$/);
  assert.equal(saved.length, 0, 'nothing was downloaded');
  // Stems stay a download, and a refusal from the app keeps its name.
  await assert.rejects(hooks.exportSong(withAssets, { format: 'zip', song: SONG, sung: [], voices: [], silent: [], stems: [], dest: 'assets' }, VERSION), /Assets does not keep/);
  const refusing = { ...host, assets: { async add() { throw Object.assign(new Error('Too many saves in a short time.'), { code: 'assets.add.rate' }); } } };
  await assert.rejects(hooks.exportSong(refusing, { format: 'json', song: SONG, sung: [], voices: [], silent: [], dest: 'assets' }, VERSION), /Not saved to Assets: Too many saves in a short time\. \(assets\.add\.rate\)/);
});
