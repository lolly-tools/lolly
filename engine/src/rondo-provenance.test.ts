// SPDX-License-Identifier: MPL-2.0
/**
 * rondo-provenance.ts: a render with no singing is algorithmic media and never
 * flagged as AI; a file with synthesised singing declares the singing, lists the
 * parts and models, and reads back as composite AI media.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aiKind } from './ai-kind.ts';
import { embedC2pa } from './c2pa.ts';
import { verifyC2pa } from './c2pa-verify.ts';
import {
  isRondoSongIngredient, rondoCreatedAction, rondoDeclaration, rondoDigitalSourceType, rondoRecordedSentence,
  rondoRenderFacts, rondoSilentParts, rondoSongIngredient, rondoSourceId, uniqueRondoIngredients,
} from './rondo-provenance.ts';

const plain = { executionClass: 'vm', version: 'fbbf6512df37+lolly.1', seed: 1919905380 };
const singing = { ...plain, sungParts: ['lead'], voices: ['kizuna'] };

test('a render with no singing is algorithmic media, never an AI flag', () => {
  assert.match(rondoDigitalSourceType(plain), /algorithmicMedia$/);
  assert.equal(aiKind(rondoDigitalSourceType(plain)), undefined);
  assert.match(rondoDeclaration(plain), /with no trained model\.$/);
  assert.doesNotMatch(rondoDeclaration(plain), /AI-generated/);
});

test('synthesised singing is declared, named and reads back as composite AI media', () => {
  assert.equal(aiKind(rondoDigitalSourceType(singing)), 'composite');
  const d = rondoDeclaration(singing);
  assert.match(d, /singing is AI-generated/);
  assert.match(d, /Supertonic-3/);
  assert.match(d, /voice kizuna/);
  assert.match(d, /: lead\.$/);
  const action = rondoCreatedAction(singing);
  assert.equal(action.action, 'c2pa.created');
  assert.deepEqual(action.parameters.sungParts, ['lead']);
  assert.equal(action.parameters.executionClass, 'vm');
});

test('a song ingredient carries the digest, the run facts and the parts it could not play', () => {
  const hash = new Uint8Array(32).fill(7);
  const ing = rondoSongIngredient({ name: 'acid', hash, facts: { ...plain, silentParts: ['breath'] } });
  assert.equal(ing.relationship, 'componentOf');
  assert.equal(ing.credential, 'none');
  assert.equal(ing.instanceId, `sha256:${'07'.repeat(32)}`);
  assert.equal(ing.hash, undefined, 'a hash with no URL is refused by the writer, so the digest is the instance id');
  assert.equal(ing.url, undefined);
  assert.match(ing.description ?? '', /vm execution class by rondocode fbbf6512df37\+lolly\.1, seed 1919905380\./);
  assert.match(ing.description ?? '', /Not played in this render: breath\./);
  assert.equal(ing.rights, undefined, 'a song carries no licence of its own');
  assert.ok(isRondoSongIngredient(ing));
});

test('render facts take the silent parts from the findings and never claim singing', () => {
  const findings = [
    { code: 'rondo.part.sing', message: 'x', parts: ['lead', 'choir'] },
    { code: 'rondo.part.mic', message: 'y', parts: ['lead', 'mic1'] },
    { code: 'rondo.limits.length', message: 'z', parts: [] },
    { code: 'rondo.warning', message: 'w', parts: ['not-a-part'] },
  ];
  assert.deepEqual(rondoSilentParts(findings), ['lead', 'choir', 'mic1']);
  const facts = rondoRenderFacts({ executionClass: 'vm', version: 'fbbf6512df37+lolly.1', seed: 3 }, findings);
  assert.deepEqual(facts.silentParts, ['lead', 'choir', 'mic1']);
  assert.equal(facts.sungParts, undefined);
  assert.equal(aiKind(rondoDigitalSourceType(facts)), undefined);
  assert.equal(rondoRenderFacts({ executionClass: 'vm', version: 'v' }, []).silentParts, undefined);
});

test('one ingredient per song, by digest', () => {
  const a = rondoSongIngredient({ name: 'a', hash: new Uint8Array(32).fill(1), facts: plain });
  const b = rondoSongIngredient({ name: 'b', hash: new Uint8Array(32).fill(2), facts: plain });
  assert.deepEqual(uniqueRondoIngredients([a, b, { ...a, title: 'a again' }]).map((i) => i.title), ['a', 'b']);
  assert.throws(() => rondoSourceId(new Uint8Array(4)));
});

test('the sentence names every song and the sandbox', () => {
  assert.match(rondoRecordedSentence(['acid']), /record the song "acid", rendered in Lolly's sandbox \(the vm execution class\)/);
  assert.match(rondoRecordedSentence(['a', 'b']), /the songs "a", "b"/);
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

test('the writer accepts a song ingredient and the reader gets it back, not flagged as AI', async () => {
  const hash = new Uint8Array(32).fill(9);
  const facts = { ...plain, silentParts: ['lead'] };
  const out = await embedC2pa(wav(), 'wav', {
    title: 'acid', claimGenerator: 'Lolly lolly.tools', generatorInfo: { name: 'Lolly', version: '0.0.0-test' },
    actions: [rondoCreatedAction(facts)],
    ingredients: [rondoSongIngredient({ name: 'acid', hash, facts })],
  });
  const report = await verifyC2pa(out);
  assert.equal(report.state, 'valid', JSON.stringify(report.checks));
  assert.equal(report.aiGenerated, undefined, 'music computed from code is not AI-generated');
  const song = (report.ingredients ?? []).find(isRondoSongIngredient);
  assert.ok(song, 'the song ingredient reads back');
  assert.equal(song.title, 'acid');
  assert.equal(song.instanceId, rondoSourceId(hash));
  assert.equal(song.relationship, 'componentOf');
  assert.match(song.description ?? '', /in the vm execution class/);
  assert.match(song.digitalSourceType ?? '', /\/algorithmicMedia$/);
  assert.equal(aiKind(song.digitalSourceType), undefined);
});
