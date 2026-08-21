// SPDX-License-Identifier: MPL-2.0
// The neutral document census (engine/src/text-facts.ts): counts are right,
// severity still reads as severity, and ordinary text stays quiet.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { textFacts, invisibleCharName, hiddenCharSeverity } from '../engine/src/text-facts.ts';

test('a plain paragraph censuses quiet', () => {
  const f = textFacts('One sentence here. Another follows it.\n\nA second paragraph closes.');
  assert.equal(f.words, 10);
  assert.equal(f.sentences, 3);
  assert.equal(f.paragraphs, 2);
  assert.deepEqual(f.hidden, []);
  assert.deepEqual(f.scripts, [{ script: 'Latin', pct: 100 }]);
  assert.deepEqual(f.linkHosts, []);
  assert.equal(f.lineEndings.crlf, 0);
  assert.equal(f.bom, false);
});

test('hidden characters are counted by name with the danger graded', () => {
  const f = textFacts('a​b​c ‮d  e');
  const byName = Object.fromEntries(f.hidden.map((h) => [h.name, h]));
  assert.equal(byName.ZWSP!.count, 2);
  assert.equal(byName.ZWSP!.severity, 'note');
  assert.equal(byName.RLO!.count, 1);
  assert.equal(byName.RLO!.severity, 'severe');
  assert.equal(byName.NBSP!.severity, 'note');
});

test('severity grade: overrides, tags, PUA and VS17+ are severe; the rest are notes', () => {
  for (const name of ['RLO', 'LRO', 'TAG', 'PUA', 'BOM', 'VS17', 'VS22']) {
    assert.equal(hiddenCharSeverity(name), 'severe', name);
  }
  for (const name of ['ZWSP', 'NBSP', 'SHY', 'SP', 'VS2', 'VS16', 'WJ']) {
    assert.equal(hiddenCharSeverity(name), 'note', name);
  }
});

test('link hosts are censused without ever being fetched, www stripped', () => {
  const f = textFacts('See https://www.example.com/a and https://example.com/b and https://other.test/.');
  assert.deepEqual(f.linkHosts, [{ host: 'example.com', count: 2 }, { host: 'other.test', count: 1 }]);
});

test('script shares and the CRLF splice trail', () => {
  const f = textFacts('Latin text\r\nwith a spliced line\nand Привет от Кирилла.');
  assert.equal(f.lineEndings.crlf, 1);
  assert.equal(f.lineEndings.lf, 1);
  assert.equal(f.scripts[0]!.script, 'Latin');
  assert.ok(f.scripts.some((s) => s.script === 'Cyrillic'));
});

test('naming matches the shell chip renderers (one table, the engine owns it)', () => {
  assert.equal(invisibleCharName('​'), 'ZWSP');
  assert.equal(invisibleCharName('\u{E0041}'), 'TAG');
  assert.equal(invisibleCharName('x'), null);
});
