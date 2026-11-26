// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { identifyVendor, vendorMonogram, vendorRegistry } from './identify.ts';

const read = (name: string) => readFileSync(new URL(name, import.meta.url), 'utf8');
const registry = JSON.parse(read('./registry.json')) as Array<{ id: string; name: string; kind: string; patterns: string[]; mark?: string }>;
const marks = JSON.parse(read('./marks.json')) as Record<string, string[]>;

test('the registry is well formed: unique ids, known kinds, patterns that compile, marks that exist', () => {
  const ids = new Set<string>();
  for (const row of registry) {
    assert.match(row.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, row.id);
    assert.ok(!ids.has(row.id), `duplicate id ${row.id}`);
    ids.add(row.id);
    assert.ok(['software', 'device', 'ai', 'signer', 'scheme'].includes(row.kind), `${row.id} kind`);
    assert.ok(row.name && row.patterns.length, row.id);
    for (const pattern of row.patterns) {
      assert.doesNotThrow(() => new RegExp(pattern, 'i'), `${row.id} pattern`);
      assert.ok(!new RegExp(pattern, 'i').test(''), `${row.id} matches the empty string`);
      // A pattern is our own data, kept simple: no nested quantifier that could backtrack badly.
      assert.doesNotMatch(pattern, /\([^)]*[+*][^)]*\)[+*]/, `${row.id} nests a quantifier`);
    }
    if (row.mark) assert.ok(marks[row.mark], `${row.id} names a mark that is not held`);
    assert.equal(identifyVendor(row.name)?.id, row.id, `${row.id}'s own name must identify ${row.id}`);
  }
  assert.equal(vendorRegistry().length, registry.length);
});

test('every held mark is path data only', () => {
  for (const [key, paths] of Object.entries(marks)) {
    assert.ok(paths.length, key);
    for (const d of paths) assert.match(d, /^[MmLlHhVvCcSsQqTtAaZz0-9eE.,\s-]+$/, key);
  }
});

test('a product is identified ahead of its maker, and by the names files record', () => {
  const id = (name: string) => identifyVendor(name)?.id ?? null;
  assert.equal(id('Adobe Photoshop 27.1 (Macintosh)'), 'adobe-photoshop');
  assert.equal(id('Adobe Firefly'), 'adobe-firefly');
  assert.equal(id('Adobe XMP Core 9.1'), 'adobe');
  assert.equal(id('Lavf58.76.100'), 'ffmpeg');
  assert.equal(id('Apple iPhone 16 Pro'), 'apple');
  assert.equal(id('Google Pixel 9'), 'google-pixel');
  assert.equal(id('Google Gemini'), 'google-gemini');
  assert.equal(id('SM-S928B'), 'samsung');
  assert.equal(id('Canon EOS R5'), 'canon');
  assert.equal(id('ChatGPT'), 'openai');
  assert.equal(id('GPT-Image-1'), 'openai');
  assert.equal(id('Stable Diffusion XL'), 'stability-ai');
  assert.equal(id('Midjourney v6'), 'midjourney');
  assert.equal(id('Microsoft PowerPoint'), 'microsoft-powerpoint');
  assert.equal(id('Truepic Lens'), 'truepic');
  assert.equal(identifyVendor('ElevenLabs')?.kind, 'ai');
  assert.equal(identifyVendor('TrustMark')?.kind, 'scheme');
  assert.equal(identifyVendor('DigiCert')?.kind, 'signer');
});

test('a person, an ordinary word or junk is not taken for a product', () => {
  for (const name of ['Maya Lopez', 'Claude Dupont', 'Sora Tanaka', 'metadata toolkit 1.0', 'XMP Core 6.0', 'Jo Example', 'unknown thing', '', 'pages 3 of 14', 'the community edition'])
    assert.equal(identifyVendor(name), null, name);
  assert.equal(identifyVendor(undefined), null);
  assert.equal(identifyVendor({ name: 'Adobe' }), null);
  assert.equal(identifyVendor('x'.repeat(100_000)), null, 'a long name is read bounded');
});

test('a product with no mark gets a monogram from its own name', () => {
  assert.equal(vendorMonogram('Midjourney'), 'Mi');
  assert.equal(vendorMonogram('Stability AI'), 'SA');
  assert.equal(vendorMonogram('Black Forest Labs'), 'BF');
  assert.equal(vendorMonogram('xAI'), 'XA');
  assert.equal(vendorMonogram('  '), '');
  const unmarked = vendorRegistry().filter((v) => !v.mark);
  assert.ok(unmarked.length > 0);
  for (const v of unmarked) assert.match(vendorMonogram(v.name), /^\p{Lu}[\p{L}\p{N}]?$/u, v.id);
});

test('the README states what a mark means', () => {
  assert.match(read('./README.md'), /do not imply endorsement or verified authorship/);
});
