// SPDX-License-Identifier: MPL-2.0
/**
 * A tune rendered from a folder (lib/music-render.ts) always carries what the music
 * generator declares about it, with no switch to leave it out: the plain description in
 * the file's tags, and Content Credentials whose created step is algorithmic media with
 * the same sentence, read back through the verifier the Verify view uses.
 *
 * Run directly: node --import ./tests/css-stub.mjs --test shells/web/src/lib/music-render.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { verifyC2pa } from '../../../../engine/src/c2pa-verify.ts';
import { extractFileMetadata } from '../../../../engine/src/file-metadata.ts';
import { TUNE_DECLARATION } from '../../../../engine/src/tune-provenance.ts';
import { encodeWav } from './audio-encode.ts';
import { parseMusicState } from './music-state.ts';
import { credentialMusicFile } from './music-render.ts';

const tone = new Float32Array(4410).map((_, i) => Math.sin(i / 7) * 0.2);
const wav = encodeWav({ channels: [tone, tone], sampleRate: 44100 } as Parameters<typeof encodeWav>[0]);

test('a folder render\'s tune declares algorithmic media and the music generator, in its credential and its tags', async () => {
  const state = parseMusicState('style=ska&seed=7&bars=8');
  const { blob, declaration } = await credentialMusicFile({}, wav, 'wav', state);
  const bytes = new Uint8Array(await blob.arrayBuffer());

  const report = await verifyC2pa(bytes);
  assert.equal(report.state, 'valid', JSON.stringify(report.checks));
  assert.equal(report.aiGenerated, undefined, 'no AI flag');
  const step = report.history?.find((h) => h.action === 'c2pa.created');
  assert.equal(step?.digitalSourceType, 'http://cv.iptc.org/newscodes/digitalsourcetype/algorithmicMedia', 'algorithmic media, not a trained model');
  assert.ok(String(step?.description).startsWith(`${TUNE_DECLARATION}.`), String(step?.description));
  assert.ok(String(step?.description).endsWith('. Style Ska, seed 7.'), 'the plain genre title, as the project is titled');
  assert.doesNotMatch(String(step?.description), /Lolly Sings/);
  assert.equal(declaration, step?.description, 'the declaration handed back is the one the file records');
  assert.equal(report.claim?.title, 'Ska · 7', 'titled as the project is');
  assert.equal(report.claim?.generatorInfo?.name, 'Lolly');

  const comment = extractFileMetadata(bytes).fields.find((f) => f.label === 'Comment');
  assert.equal(comment?.value, declaration, 'the plain description says the same sentence');
});

test('a tune whose credential cannot be written is not handed on', async () => {
  const state = parseMusicState('style=ska&seed=7&bars=8');
  // A MIDI-shaped file has no place for Content Credentials, so the signer throws.
  await assert.rejects(credentialMusicFile({}, new Blob([new Uint8Array(8)]), 'mid' as 'wav', state));
});

test('the music generator\'s Download signs through the same step, with no switch and no unsigned path', () => {
  // The whole feature: the view and its modules (views/music-studio/*.ts).
  const dir = new URL('../views/music-studio/', import.meta.url);
  const source = [readFileSync(new URL('../views/music-studio.ts', import.meta.url), 'utf8'),
    ...readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts')).map((f) => readFileSync(new URL(f, dir), 'utf8'))].join('\n');
  assert.match(source, /credentialMusicFile\(host, blob, format, state, trackName\(\)\)/, 'the Download signs as a folder render does');
  assert.doesNotMatch(source, /host\.export\.download\(blob\b/, 'no download hands on the unsigned file');
  assert.doesNotMatch(source, /\[data-cred\]|credToggle|type="checkbox"[^>]*data-cred/, 'no switch to leave the record out');
});
