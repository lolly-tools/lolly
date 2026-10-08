// SPDX-License-Identifier: MPL-2.0
/**
 * Songs in the MCP server's Content Credentials (plan 301, Andy's approval of
 * 2026-10-08).
 *
 * A song on a Design timeline is mixed in the browser tier, and the web shell's
 * credential records the song. `render` then signs the bytes again (one stamp path for
 * both tiers), and that re-sign must carry the song forward rather than drop the record. Pinned
 * here without a browser, on a WAV the web shell's stamp would have written:
 *
 *   - `songIngredientsIn` reads the song ingredients back off the first credential
 *   - the MCP stamp (`stampC2pa`) writes them into its own credential intact
 *   - the result text says what the final file records, and says plainly when a
 *     song the file holds is not recorded
 *
 * Run with: node --test services/mcp/test/rondo-credentials.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { embedC2pa, rondoSongIngredient, verifyC2pa, isRondoSongIngredient } from '@lolly/engine';
import { recordedSongs, songIngredientsIn } from '@lolly-tools/node-shell/audio';
import { stampC2pa } from '../src/render.ts';
import { songCredentialText } from '../src/audio-runs.ts';
import type { ToolManifest } from '../../../engine/src/loader.ts';

const manifest = {
  id: 'design', name: 'Design', version: '1.0.0', engineVersion: '^1.0.0', status: 'official',
  render: { width: 32, height: 32, formats: ['wav'] }, inputs: [],
} as unknown as ToolManifest;

/** A real minimal 16-bit stereo WAV. */
function wav(frames = 64): Uint8Array {
  const u8 = new Uint8Array(44 + frames * 4);
  const dv = new DataView(u8.buffer);
  const put = (at: number, s: string): void => { for (let i = 0; i < s.length; i++) u8[at + i] = s.charCodeAt(i); };
  put(0, 'RIFF'); dv.setUint32(4, 36 + frames * 4, true); put(8, 'WAVE');
  put(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 2, true);
  dv.setUint32(24, 48000, true); dv.setUint32(28, 48000 * 4, true); dv.setUint16(32, 4, true); dv.setUint16(34, 16, true);
  put(36, 'data'); dv.setUint32(40, frames * 4, true);
  for (let i = 0; i < frames * 2; i++) dv.setInt16(44 + i * 2, ((i % 32) - 16) * 512, true);
  return u8;
}

const facts = { executionClass: 'vm', version: 'fbbf6512df37+lolly.1', seed: 1919905380, silentParts: ['breath'] };

test('a re-sign over a browser-tier credential carries its songs forward', async () => {
  const fromBrowser = await embedC2pa(wav(), 'wav', {
    title: 'Design', claimGenerator: 'Lolly lolly.tools', generatorInfo: { name: 'Lolly', version: '0.0.0-test' },
    ingredients: [rondoSongIngredient({ name: 'Acid', hash: new Uint8Array(32).fill(3), facts })],
  });
  const carried = await songIngredientsIn(fromBrowser);
  assert.equal(carried.length, 1);
  assert.equal(carried[0]!.instanceId, `sha256:${'03'.repeat(32)}`);

  const resigned = await stampC2pa(fromBrowser, 'wav', manifest, {}, { c2pa: { on: true, days: null } }, carried);
  const report = await verifyC2pa(resigned);
  assert.equal(report.state, 'valid', JSON.stringify(report.checks));
  assert.equal(report.aiGenerated, undefined);
  const song = (report.ingredients ?? []).find(isRondoSongIngredient);
  assert.ok(song, 'the song is still recorded after the re-sign');
  assert.equal(song.title, 'Acid');
  assert.match(song.description ?? '', /vm execution class/);
  assert.match(song.description ?? '', /Not played in this render: breath\./);
  assert.match(song.digitalSourceType ?? '', /\/algorithmicMedia$/);
  assert.deepEqual(await recordedSongs(resigned), ['Acid']);
});

test('the result says what the file records, and what it does not', () => {
  assert.equal(songCredentialText(undefined), '');
  assert.match(songCredentialText({ expected: ['Acid'], recorded: ['Acid'] }),
    /^Songs: Content Credentials in this file record the song "Acid", rendered in Lolly's sandbox \(the vm execution class\), as a source\.$/);
  assert.equal(songCredentialText({ expected: ['Acid', 'Bass'], recorded: ['Acid'] }).split('\n')[1],
    'Songs: Content Credentials in this file do not record "Bass".');
  assert.equal(songCredentialText({ expected: ['Acid'], recorded: [] }), 'Songs: Content Credentials in this file do not record "Acid".');
});
