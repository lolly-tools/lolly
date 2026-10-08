// SPDX-License-Identifier: MPL-2.0
/**
 * rondo-source.ts: song files, share links rondocode itself writes (made with pako,
 * as upstream does), canonical bytes, and the ceilings on every untrusted path.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from 'fflate';
import {
  isRondoFileName,
  isRondoShareLink,
  rondoFileName,
  rondoFromBytes,
  rondoFromFile,
  rondoFromShareLink,
  rondoSourceBytes,
  RondoSourceError,
  RONDO_MAX_SOURCE_BYTES,
} from './rondo-source.ts';

const enc = (s: string) => new TextEncoder().encode(s);
const b64url = (b: Uint8Array) => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

// Made with pako 1.0.11 deflateRaw({ level: 9, dictionary }), the library and
// call rondocode's own share.ts uses, so this is a link rondocode would write.
const PAKO_LINK =
  'https://rondocode.com/#s=pPZVhC8IgEIb_yst9rWwzKBj0TyTYHItIzlGrL9F_7z0dCXp6HuLx6HsfUemkj7cRiURlK5Hrgh_mDQqDjM1KuTyIvTd3pYv4WvI02UfQ98UXbaUyWkBx2cRgs1ViIKUDnIfj2Nr2esIZd80DqF7sztE2SPkaNOhM0fxfp0GtAGZPtChFout3TNaC4_yEOwZlLom5PLKOWb4_';

test('recognises song files and share links by shape alone', () => {
  assert.ok(isRondoFileName('acid.rondo'));
  assert.ok(isRondoFileName('Acid Line.rondo.JSON'));
  assert.ok(!isRondoFileName('acid.json'));
  assert.ok(!isRondoFileName('acid.rondo.txt'));
  assert.ok(isRondoShareLink(PAKO_LINK));
  assert.ok(isRondoShareLink('https://www.rondocode.com/docs#lang=en&s=uabc'));
  assert.ok(!isRondoShareLink('https://rondocode.com/'));
  assert.ok(!isRondoShareLink('https://evil.example/#s=pabc'));
  assert.ok(!isRondoShareLink('http://rondocode.com/#s=pabc'));
});

test('decodes a link rondocode itself would write (dictionary-primed DEFLATE)', () => {
  const s = rondoFromShareLink(PAKO_LINK);
  assert.equal(s.name, 'acid line');
  assert.equal(s.lang, 'rondo');
  assert.match(s.code, /^synth acid\n {2}saw \+ square note\/2/);
});

test('decodes the legacy and uncompressed link schemes', () => {
  const json = enc(JSON.stringify({ n: 'plain', c: "p('x', note('c4'))" }));
  assert.equal(rondoFromShareLink(`https://rondocode.com/#s=u${b64url(json)}`).code, "p('x', note('c4'))");
  const d = rondoFromShareLink(`https://rondocode.com/#s=d${b64url(deflateSync(json))}`);
  assert.equal(d.name, 'plain');
  assert.equal(d.lang, 'auto', 'no l field means the language is unstated');
});

test('refuses a link that inflates past the ceiling instead of reading a truncated song', () => {
  const huge = enc(JSON.stringify({ n: 'bomb', c: 'x'.repeat(RONDO_MAX_SOURCE_BYTES * 3) }));
  const link = `https://rondocode.com/#s=d${b64url(deflateSync(huge, { level: 9 }))}`;
  assert.throws(() => rondoFromShareLink(link), RondoSourceError);
});

test('refuses malformed links by name', () => {
  assert.throws(() => rondoFromShareLink('https://rondocode.com/#s=zAAAA'), /encoding/);
  assert.throws(() => rondoFromShareLink('https://rondocode.com/#s=p!!!'), RondoSourceError);
  assert.throws(() => rondoFromShareLink('https://rondocode.com/#s=pAAAA'), RondoSourceError);
  assert.throws(() => rondoFromShareLink(`https://rondocode.com/#s=u${b64url(enc('{"n":"x"}'))}`), /no code/);
});

test('reads a .rondo file as rondo source named after the file', () => {
  const s = rondoFromFile(enc('play acid\n  0 3 5\n'), 'My Acid.rondo');
  assert.deepEqual(s, { schemaVersion: 1, format: 'rondocode', name: 'My Acid', lang: 'rondo', code: 'play acid\n  0 3 5\n' });
});

test("reads rondocode's own project export and keeps its language unstated", () => {
  const s = rondoFromFile(enc(JSON.stringify({ name: 'groove', code: "p('d', note('c2'))" }, null, 2)), 'groove.rondo.json');
  assert.equal(s.lang, 'auto');
  assert.equal(s.name, 'groove');
});

test('canonical bytes round-trip and stay readable by rondocode (name and code at the top level)', () => {
  const src = rondoFromFile(enc('play acid\n  0 3 5\n'), 'acid.rondo');
  const bytes = rondoSourceBytes(src);
  assert.deepEqual(rondoFromBytes(bytes), src);
  const obj = JSON.parse(new TextDecoder().decode(bytes));
  assert.equal(typeof obj.name, 'string');
  assert.equal(typeof obj.code, 'string');
  assert.equal(obj.schemaVersion, 1);
  assert.deepEqual(rondoSourceBytes(rondoFromBytes(bytes)), bytes, 'canonical form is a fixed point');
  assert.equal(rondoFileName({ name: 'Acid Line!' }), 'acid-line.rondo.json');
});

test('refuses what it cannot vouch for', () => {
  assert.throws(() => rondoFromFile(enc('{"code": 1}'), 'x.rondo.json'), /no code/);
  assert.throws(() => rondoFromFile(enc('{"schemaVersion": 2, "code": "x"}'), 'x.rondo.json'), /schema version 2/);
  assert.throws(() => rondoFromFile(new Uint8Array([0xff, 0xfe, 0x00]), 'x.rondo'), /UTF-8/);
  assert.throws(() => rondoFromFile(enc('   '), 'x.rondo'), /no code/);
  assert.throws(() => rondoFromFile(enc('x'.repeat(RONDO_MAX_SOURCE_BYTES + 1)), 'x.rondo'), /under/);
  const named = rondoFromFile(enc(JSON.stringify({ name: 'a\u0000b\nc', code: 'x' })), 'y.rondo.json');
  assert.equal(named.name, 'a b c', 'control characters never reach a display name');
});
