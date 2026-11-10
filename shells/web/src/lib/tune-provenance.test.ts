// SPDX-License-Identifier: MPL-2.0
/**
 * lib/tune-provenance.ts: what a saved tune records and what an export says about it
 * (Andy's approval of 2026-11-10).
 *  - A tune saved from the music generator records its maker only when the profile has
 *    a name, the music generator and both versions, and no licence.
 *  - Its ingredient carries the recipe's digest, the engine version, algorithmic media,
 *    the licence when recorded, and the maker only while "Use my details" is on.
 *  - The sheet's lines are future tense before the export, and after it say only what a
 *    reading of the written bytes found.
 *  - A download is signed and read back, and the reading is what the hint repeats.
 *
 * Run directly: node --import ./tests/css-stub.mjs --test shells/web/src/lib/tune-provenance.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  MADE_IN_GENERATOR, profileMaker, readTuneRecord, recordedSourceNames, signTrackDownload, tuneAt, tuneLicence, tuneLicenceChoices,
  tuneNoteLines, tuneRecordLines, tuneSaveRecord, tuneSource, tuneSourceIngredient, tuneSourceOfRef, usesDetails, withTuneLicence, distinctTunes,
} from './tune-provenance.ts';
import { lofiTuneBytes } from './lofi-tune.ts';
import { embedC2pa } from '../../../../engine/src/c2pa.ts';
import { verifyC2pa } from '../../../../engine/src/c2pa-verify.ts';
import { aiKind } from '../../../../engine/src/ai-kind.ts';
import { ENGINE_VERSION } from '../../../../engine/src/version.ts';
import { TUNE_DECLARATION, isTuneIngredient } from '../../../../engine/src/tune-provenance.ts';
import { rondoSongIngredient } from '../../../../engine/src/rondo-provenance.ts';
import { LOLLY_RELEASE } from './lolly-release.ts';

const recipe = { mood: 'sugar' as const, seed: 2024, generator: 'style=sugar&seed=2024&bars=8' };
const tuneRef = (meta: Record<string, unknown>) => ({ format: 'lofi', meta: { name: 'Lolly Sings Sugar · C major · 96 bpm · 2024', lofi: recipe, generator: recipe.generator, ...meta } });

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

test('a saved tune records the maker only when the profile has a name, the music generator and both versions', () => {
  assert.equal(profileMaker({ firstname: ' Andy ', lastname: 'Fitzsimon' }), 'Andy Fitzsimon');
  assert.equal(profileMaker({ firstname: '', lastname: '  ' }), '');
  assert.equal(profileMaker(null), '');
  const versions = { lolly: LOLLY_RELEASE, engine: ENGINE_VERSION };
  assert.match(LOLLY_RELEASE, /^\d+\.\d+\.\d+$/, 'the release version reads from the web package');
  assert.deepEqual(tuneSaveRecord('Andy Fitzsimon', versions), { madeIn: MADE_IN_GENERATOR, maker: 'Andy Fitzsimon', versions });
  const anonymous = tuneSaveRecord('', versions);
  assert.equal('maker' in anonymous, false, 'no name, no maker field');
  assert.equal('license' in anonymous, false, 'a new tune\'s licence is not recorded');
});

test('the record reads back from the meta, and a tune saved before the record still reads as a generator track', () => {
  const rec = readTuneRecord(tuneRef(tuneSaveRecord('Andy', { lolly: '1.2.0', engine: '1.300.0' })));
  assert.deepEqual(rec, { origin: 'generator', maker: 'Andy', versions: { lolly: '1.2.0', engine: '1.300.0' } });
  assert.equal(readTuneRecord(tuneRef({}))?.origin, 'generator', 'the generator\'s settings mark a track made there');
  assert.deepEqual(readTuneRecord({ format: 'lofi', meta: { lofi: { mood: 'warm', seed: 3 } } }), { origin: 'station' });
  assert.equal(readTuneRecord({ format: 'wav', meta: { madeIn: MADE_IN_GENERATOR } }), null, 'only a saved tune has a tune record');
  assert.equal(readTuneRecord(tuneRef({ maker: 42, versions: 'x' }))?.maker, undefined, 'untrusted fields are dropped, not coerced');
});

test('the licence menu is the export panel\'s list without the Public Domain Mark, and setting one changes only the licence', () => {
  const ids = tuneLicenceChoices().map((c) => c.id);
  assert.ok(ids.includes('CC0-1.0') && ids.includes('CC-BY-4.0') && ids.includes('CC-BY-SA-4.0'));
  assert.equal(ids.includes('CC-PDM-1.0'), false, 'the mark is for a work already free of copyright');
  const meta = tuneRef({ maker: 'Andy' }).meta;
  const set = withTuneLicence(meta, 'CC-BY-4.0');
  assert.equal(set.license, 'CC-BY-4.0');
  assert.deepEqual({ ...set, license: undefined }, { ...meta, license: undefined }, 'nothing else changes');
  assert.deepEqual(tuneLicence(set), { declared: 'CC-BY-4.0', name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' });
  assert.equal('license' in withTuneLicence(set, ''), false, 'Not recorded clears it');
  assert.equal('license' in withTuneLicence(set, 'GPL-3.0'), false, 'an id the menu does not offer is not written');
  assert.equal(tuneLicence(meta), null);
});

test('the ingredient carries the recipe digest, the engine version, the maker and licence, and algorithmic media', async () => {
  const source = tuneSource(recipe, tuneRef({ ...tuneSaveRecord('Andy', { lolly: '1.2.0', engine: '1.300.0' }), license: 'CC0-1.0' }));
  assert.deepEqual({ name: source.name, origin: source.origin, maker: source.maker, licence: source.licence }, {
    name: 'Lolly Sings Sugar · C major · 96 bpm · 2024', origin: 'generator', maker: 'Andy',
    licence: { name: 'CC0 1.0', url: 'https://creativecommons.org/publicdomain/zero/1.0/' },
  });
  const ing = await tuneSourceIngredient(source, { withMaker: true });
  assert.equal(ing.instanceId, `sha256:${createHash('sha256').update(lofiTuneBytes(recipe)).digest('hex')}`,
    'the digest of the canonical recipe bytes, so a reader holding the tune can match it');
  assert.match(ing.description ?? '', new RegExp(`by Lolly engine ${ENGINE_VERSION.replaceAll('.', '\\.')}\\. Made by Andy\\. Licence: CC0 1\\.0\\.$`));
  assert.equal(ing.informationalUri, 'https://creativecommons.org/publicdomain/zero/1.0/');
  assert.equal(aiKind(ing.digitalSourceType), undefined);
  assert.ok(isTuneIngredient(ing));

  // A station tune by path, with no asset record: algorithmic media, no maker, no licence.
  const station = await tuneSourceIngredient(tuneSource({ mood: 'warm', seed: 7 }, null), { withMaker: true });
  assert.match(station.description ?? '', /^A tune from a station of Lolly's Neurospicy player/);
  assert.doesNotMatch(station.description ?? '', /Made by|Licence/);
  assert.equal(distinctTunes([source, source, null]).length, 1, 'the same tune twice is one source');
});

test('with "Use my details" off the maker\'s name never travels, and the licence still does', async () => {
  const off = { profile: { get: async () => ({ firstname: 'Andy', lastname: 'Tester', useDetails: false }) } };
  const on = { profile: { get: async () => ({ firstname: 'Andy', lastname: 'Tester', useDetails: true }) } };
  assert.equal(await usesDetails(off), false);
  assert.equal(await usesDetails(on), true);
  assert.equal(await usesDetails({ profile: { get: async () => ({ useDetails: 'yes' }) } }), false, 'only an explicit yes counts');
  assert.equal(await usesDetails({ profile: { get: async () => { throw new Error('locked'); } } }), false, 'an unreadable profile reads as off');
  assert.equal(await usesDetails(null), false, 'no host, no profile, no name');

  const source = tuneSource(recipe, tuneRef({ maker: 'Andy Tester', license: 'CC-BY-4.0' }));
  const ing = await tuneSourceIngredient(source, { withMaker: await usesDetails(off) });
  assert.doesNotMatch(ing.description ?? '', /Andy|Tester|Made by/, 'the name is left out');
  assert.match(ing.description ?? '', /Licence: CC BY 4\.0\.$/, 'the licence sentence stays');
  assert.equal(ing.informationalUri, 'https://creativecommons.org/licenses/by/4.0/', 'and its terms link');
  const withName = await tuneSourceIngredient(source, { withMaker: await usesDetails(on) });
  assert.equal(withName.description, `${(ing.description ?? '').replace(' Licence:', ' Made by Andy Tester. Licence:')}`, 'nothing else differs');

  // The written file holds no trace of the name either.
  const out = await embedC2pa(wav(), 'wav', {
    title: 'Film', claimGenerator: 'Lolly lolly.tools', generatorInfo: { name: 'Lolly', version: '0.0.0-test' }, ingredients: [ing],
  });
  assert.equal(Buffer.from(out).includes('Andy Tester'), false, 'no byte of the file carries the maker\'s name');
  const [line] = tuneNoteLines([source], { withMaker: false });
  assert.doesNotMatch(line ?? '', /Andy|made the tune/, 'the sheet does not promise a name the file will not carry');
  assert.match(line ?? '', /It will give the tune’s licence as CC BY 4\.0\.$/);
});

test('a tune is found by its bytes at a library url, and other media is never read as one', async () => {
  const url = `data:application/json;base64,${Buffer.from(lofiTuneBytes(recipe)).toString('base64')}`;
  assert.deepEqual(await tuneAt(url), recipe);
  assert.equal(await tuneAt('https://example.test/song.mp3'), null, 'a media url is not fetched');
  assert.equal(await tuneAt(`data:application/json;base64,${Buffer.from('{"mood":"sugar","seed":1}').toString('base64')}`), null);
  const fromRef = await tuneSourceOfRef({ format: 'lofi', url, meta: { name: 'Mine', maker: 'Sam', madeIn: MADE_IN_GENERATOR } });
  assert.equal(fromRef?.name, 'Mine');
  assert.equal(fromRef?.maker, 'Sam');
  assert.equal(await tuneSourceOfRef({ format: 'wav', url }), null);
});

test('the sheet promises in the future tense, and after the export repeats only what the reading found', () => {
  const [line] = tuneNoteLines([tuneSource(recipe, tuneRef({ maker: 'Andy', license: 'CC-BY-4.0' }))], { withMaker: true });
  assert.match(line ?? '', /^Content Credentials will record the tune “Lolly Sings Sugar · C major · 96 bpm · 2024” as a source of this file: music Lolly composed from its recipe \(procedural, no AI\)\./);
  assert.match(line ?? '', /The record will name Andy as the person who made the tune\./);
  assert.match(line ?? '', /It will give the tune’s licence as CC BY 4\.0\.$/);
  const [bare] = tuneNoteLines([tuneSource(recipe, tuneRef({}))], { withMaker: true });
  assert.doesNotMatch(bare ?? '', /made the tune|licence/, 'nothing about a maker or a licence the tune does not record');
  assert.deepEqual(tuneRecordLines(['A', 'B'], ['A']), {
    found: 'This file’s Content Credentials record the tune “A”.',
    missing: 'This file’s Content Credentials do not record the tune “B”.',
  });
  assert.deepEqual(tuneRecordLines(['A', 'B'], ['A', 'B']), { found: 'This file’s Content Credentials record the tunes “A”, “B”.', missing: null });
});

test('the readback finds songs and tunes in one pass, and a file with no credential records neither', async () => {
  const tune = await tuneSourceIngredient(tuneSource(recipe, tuneRef({})), { withMaker: false });
  const song = rondoSongIngredient({ name: 'Acid', hash: new Uint8Array(32).fill(3), facts: { executionClass: 'vm', version: 'fbbf6512df37+lolly.1' } });
  const out = await embedC2pa(wav(), 'wav', {
    title: 'Film', claimGenerator: 'Lolly lolly.tools', generatorInfo: { name: 'Lolly', version: '0.0.0-test' }, ingredients: [song, tune],
  });
  assert.deepEqual(await recordedSourceNames(new Blob([out as BlobPart])), { songs: ['Acid'], tunes: ['Lolly Sings Sugar · C major · 96 bpm · 2024'] });
  assert.deepEqual(await recordedSourceNames(new Blob([wav() as BlobPart])), { songs: [], tunes: [] });
});

test('a download is signed by the music generator and the hint repeats what the reading found', async () => {
  const signed = await signTrackDownload({ identity: { signer: async () => null } }, new Blob([wav() as BlobPart], { type: 'audio/wav' }), 'wav', {
    name: 'Lolly Sings Sugar · C major · 96 bpm · 2024', style: 'sugar', styleName: 'Lolly Sings Sugar', seed: 2024,
  });
  assert.equal(signed.blob.type, 'audio/wav');
  assert.equal(signed.declaration, `${TUNE_DECLARATION}. Style Lolly Sings Sugar, seed 2024.`);
  const report = await verifyC2pa(new Uint8Array(await signed.blob.arrayBuffer()));
  assert.equal(report.state, 'valid');
  assert.equal(report.aiGenerated, undefined, 'algorithmic media is not an AI flag');
  await assert.rejects(signTrackDownload({}, new Blob([new Uint8Array(8)]), 'mid', { name: 'x', style: 'sugar', seed: 1 }), /no place for Content Credentials/);
});
