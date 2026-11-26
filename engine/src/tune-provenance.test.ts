// SPDX-License-Identifier: MPL-2.0
/**
 * tune-provenance.ts: a tune Lolly composed is algorithmic media and never an AI
 * flag. A download's created step carries the declaration word for word; a saved
 * tune used in another export is one source ingredient with its name, the digest
 * of its recipe, the engine version, and the maker and licence only when recorded.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aiKind } from './ai-kind.ts';
import { ALGORITHMIC_SOURCE_TYPE, embedC2pa } from './c2pa.ts';
import { verifyC2pa } from './c2pa-verify.ts';
import { isRondoSongIngredient } from './rondo-provenance.ts';
import {
  TUNE_DECLARATION, TUNE_SOURCE_TYPE, isTuneDeclaration, isTuneIngredient, tuneCreatedAction, tuneDeclaration, tuneIngredient, tuneSourceId,
} from './tune-provenance.ts';

const facts = { style: 'sugar', styleName: 'Lolly Sings Sugar', seed: 2024 };

test('the created step is algorithmic media, never an AI flag, and keeps the declaration word for word', () => {
  const action = tuneCreatedAction(facts);
  assert.equal(TUNE_SOURCE_TYPE, ALGORITHMIC_SOURCE_TYPE, 'the one algorithmicMedia IRI the writer uses');
  assert.equal(action.action, 'c2pa.created');
  assert.match(action.digitalSourceType, /\/algorithmicMedia$/);
  assert.equal(aiKind(action.digitalSourceType), undefined, 'algorithmicMedia is not read as AI');
  assert.equal(TUNE_DECLARATION, "Made with Lolly's music generator (procedural, no AI)");
  assert.equal(action.description, "Made with Lolly's music generator (procedural, no AI). Style Lolly Sings Sugar, seed 2024.");
  assert.ok(action.description.startsWith(TUNE_DECLARATION));
  assert.deepEqual(action.parameters, { source: 'lolly-music-generator', style: 'sugar', seed: 2024 });
  assert.ok(isTuneDeclaration(action.description));
  assert.equal(isTuneDeclaration('Music computed on the device'), false);
  assert.match(tuneDeclaration({ style: 'dnb', seed: 5 }), /Style dnb, seed 5\.$/, 'the style id stands in for a missing name');
});

test('a tune ingredient carries the name, the recipe digest, the engine version and algorithmic media', () => {
  const hash = new Uint8Array(32).fill(0xab);
  const ing = tuneIngredient({ name: 'Lolly Sings Sugar · C major · 96 bpm · 2024', hash, facts: { origin: 'generator', engineVersion: '1.2.3' } });
  assert.equal(ing.credential, 'none');
  assert.equal(ing.title, 'Lolly Sings Sugar · C major · 96 bpm · 2024');
  assert.equal(ing.relationship, 'componentOf');
  assert.equal(ing.format, 'application/json');
  assert.equal(ing.instanceId, `sha256:${'ab'.repeat(32)}`, 'the digest is the instance id');
  assert.equal(ing.hash, undefined, 'a hash with no URL is refused by the writer, so the digest is the instance id');
  assert.equal(ing.url, undefined);
  assert.equal(ing.rights, undefined, 'a rights record needs a public source address, which a tune on a device has none of');
  assert.equal(ing.description, "A tune made with Lolly's music generator (procedural, no AI), composed and rendered on the device from its recipe by Lolly engine 1.2.3.");
  assert.equal(ing.informationalUri, undefined, 'no licence, no terms page');
  assert.match(ing.digitalSourceType ?? '', /\/algorithmicMedia$/);
  assert.equal(aiKind(ing.digitalSourceType), undefined);
  assert.ok(isTuneIngredient(ing));
  assert.equal(isRondoSongIngredient(ing), false, 'a tune is not mistaken for a rondocode song');
  assert.throws(() => tuneSourceId(new Uint8Array(4)));
});

test('the maker and the licence travel only when the tune records them', () => {
  const hash = new Uint8Array(32).fill(1);
  const both = tuneIngredient({
    name: 'Night drive', hash,
    facts: { origin: 'generator', engineVersion: '1.2.3', maker: ' Andy Fitzsimon ', licence: { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' } },
  });
  assert.match(both.description ?? '', / Made by Andy Fitzsimon\. Licence: CC BY 4\.0\.$/);
  assert.equal(both.informationalUri, 'https://creativecommons.org/licenses/by/4.0/');
  const unsafe = tuneIngredient({ name: 'x', hash, facts: { origin: 'generator', engineVersion: '1', licence: { name: 'CC0 1.0', url: 'javascript:alert(1)' } } });
  assert.equal(unsafe.informationalUri, undefined, 'only a public http(s) page becomes the terms link');
  const station = tuneIngredient({ name: '', hash, facts: { origin: 'station', engineVersion: '1.2.3' } });
  assert.equal(station.title, 'Untitled tune');
  assert.match(station.description ?? '', /^A tune from a station of Lolly's Neurospicy player \(procedural, no AI\)/);
  assert.doesNotMatch(station.description ?? '', /Made by|Licence/);
  assert.ok(isTuneIngredient(station));
});

/** A real minimal 16-bit stereo WAV. */
function wav(frames = 64): Uint8Array {
  const dataLen = frames * 4;
  const u8 = new Uint8Array(44 + dataLen);
  const dv = new DataView(u8.buffer);
  const put = (at: number, s: string): void => { for (let i = 0; i < s.length; i++) u8[at + i] = s.charCodeAt(i); };
  put(0, 'RIFF'); dv.setUint32(4, 36 + dataLen, true); put(8, 'WAVE');
  put(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 2, true);
  dv.setUint32(24, 48000, true); dv.setUint32(28, 48000 * 4, true); dv.setUint16(32, 4, true); dv.setUint16(34, 16, true);
  put(36, 'data'); dv.setUint32(40, dataLen, true);
  for (let i = 0; i < frames * 2; i++) dv.setInt16(44 + i * 2, ((i % 32) - 16) * 512, true);
  return u8;
}

test('the writer accepts a tune ingredient and the reader gets it back, not flagged as AI', async () => {
  const hash = new Uint8Array(32).fill(9);
  const out = await embedC2pa(wav(), 'wav', {
    title: 'Film', claimGenerator: 'Lolly lolly.tools', generatorInfo: { name: 'Lolly', version: '0.0.0-test' },
    ingredients: [tuneIngredient({ name: 'Night drive', hash, facts: { origin: 'generator', engineVersion: '1.2.3', maker: 'Andy', licence: { name: 'CC0 1.0', url: 'https://creativecommons.org/publicdomain/zero/1.0/' } } })],
  });
  const report = await verifyC2pa(out);
  assert.equal(report.state, 'valid', JSON.stringify(report.checks));
  assert.equal(report.aiGenerated, undefined, 'a composed tune is not AI-generated');
  const tune = (report.ingredients ?? []).find(isTuneIngredient);
  assert.ok(tune, 'the tune ingredient reads back');
  assert.equal(tune.title, 'Night drive');
  assert.equal(tune.instanceId, tuneSourceId(hash));
  assert.equal(tune.relationship, 'componentOf');
  assert.match(tune.description ?? '', /by Lolly engine 1\.2\.3\. Made by Andy\. Licence: CC0 1\.0\.$/);
  assert.match(tune.digitalSourceType ?? '', /\/algorithmicMedia$/);
  assert.equal(aiKind(tune.digitalSourceType), undefined);
});
