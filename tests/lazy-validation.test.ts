// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const proof = `
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Ajv from 'ajv';
import Ajv2020 from 'ajv/dist/2020.js';
const calls = [];
const manifestValidators = new Set();
const compilers = [Ajv, Ajv2020].map(ctor => [ctor, ctor.prototype.compile]);
for (const [ctor, compile] of compilers) ctor.prototype.compile = function(schema, ...args) {
  calls.push(schema.$id ?? schema.title);
  if (['https://lolly.tools/schemas/tool.schema.json', 'https://lolly.tools/schemas/ratecard.schema.json'].includes(schema.$id)) {
    assert.equal(this.opts.code.optimize, 0);
    assert.equal(this.opts.validateSchema, true);
    manifestValidators.add(this);
  }
  return compile.call(this, schema, ...args);
};
const story = await import('./engine/src/text-story-document.ts');
const frame = await import('./engine/src/text-frame.ts');
const brand = await import('./engine/src/brand-system.ts');
const emoji = await import('./engine/src/emoji-source-records.ts');
const manifests = await import('./engine/src/validate.ts');
const document = { version: 1, stories: [], styles: [], fonts: [] };
const textFrame = { id: 'frame', storyId: 'story', width: 100, height: 50, mode: 'fixed',
  inset: { top: 0, right: 0, bottom: 0, left: 0 }, columns: { count: 1, gutter: 0, balance: false }, verticalAlign: 'top' };
assert.deepEqual(calls, [], 'importing engine readers must not compile schemas');
story.createTextStory('story', 'Hello', index => 'paragraph-' + index);
frame.textFrameKey(textFrame);
brand.brandSystemOf({ color: {} });
emoji.mergeEmojiSourceRecords([]);
assert.throws(() => story.parseTextDocument('{'), { code: 'document-json' });
assert.throws(() => emoji.readEmojiSourceRecords('{'), SyntaxError);
assert.deepEqual(calls, [], 'helpers and malformed JSON must not compile schemas');
const once = name => assert.equal(calls.filter(value => value === name).length, 1, name + ' must compile once');
assert.throws(() => story.parseTextDocument({}), { code: 'document-schema', message: "Invalid text document at /: must have required property 'version'" });
assert.deepEqual(story.parseTextDocument(document), document);
assert.throws(() => story.parseTextDocument({ ...document, version: 2 }), { code: 'document-schema', message: 'Invalid text document at /version: must be equal to constant' });
assert.deepEqual(story.parseTextDocument(JSON.stringify(document)), document);
once('https://lolly.tools/schemas/text-document-v1.schema.json');
assert.throws(() => frame.parseTextFrame({}), { code: 'frame-schema', message: "Invalid text frame at /: must have required property 'id'" });
const parsedFrame = frame.parseTextFrame(textFrame);
assert.deepEqual(parsedFrame, textFrame);
assert.notEqual(parsedFrame.inset, textFrame.inset);
assert.throws(() => frame.parseTextFrame({ ...textFrame, width: 0 }), { code: 'frame-schema' });
assert.deepEqual(frame.parseTextFrame(textFrame), textFrame);
once('https://lolly.tools/schemas/text-frame-v1.schema.json');
const brandSystem = JSON.parse(readFileSync('./tests/fixtures/brand-systems/harbour.json', 'utf8'));
assert.equal(brand.readBrandSystem({}), null);
const parsedBrand = brand.readBrandSystem(brandSystem);
assert.deepEqual(parsedBrand, brandSystem);
assert.notEqual(parsedBrand.roles, brandSystem.roles);
assert.equal(brand.readBrandSystem({ ...brandSystem, schemaVersion: 2 }), null);
assert.deepEqual(brand.readBrandSystem(brandSystem), brandSystem);
once('Brand vocabulary and proposed rules v1');
assert.throws(() => emoji.readEmojiSourceRecords([{}]), { message: 'The recorded emoji sources are invalid.' });
const sources = [];
assert.deepEqual(emoji.readEmojiSourceRecords(sources), sources);
assert.notEqual(emoji.readEmojiSourceRecords(sources), sources);
assert.throws(() => emoji.readEmojiSourceRecords({}), { message: 'The recorded emoji sources are invalid.' });
assert.deepEqual(emoji.readEmojiSourceRecords('[]'), []);
once('https://lolly.tools/schemas/emoji-source-records-v1.schema.json');
const manifestId = 'https://lolly.tools/schemas/tool.schema.json';
const rateCardId = 'https://lolly.tools/schemas/ratecard.schema.json';
const qr = JSON.parse(readFileSync('./community/qr-code/tool.json', 'utf8'));
const card = { $format: 'lolly-ratecard', formatVersion: 1, currency: 'EUR', lines: [{ id: 'setup', kind: 'perJob', rate: 1 }] };
const checkManifest = () => {
  assert.deepEqual(manifests.validateManifest(qr), { valid: true, errors: [] });
  assert.deepEqual(manifests.validateManifest({ ...qr, typo: true }), { valid: false, errors: [{ path: '/', message: 'unknown property "typo"' }] });
  assert.deepEqual(manifests.validateManifest(qr), { valid: true, errors: [] });
  once(manifestId);
};
const checkRateCard = () => {
  assert.equal(manifests.validateRateCard(card), true);
  assert.equal(manifests.validateRateCard({ ...card, lines: [{ ...card.lines[0], rate: '1' }] }), false);
  assert.equal(manifests.validateRateCard(card), true);
  once(rateCardId);
};
if (process.argv[1] === 'manifest') {
  checkManifest();
  assert.equal(calls.includes(rateCardId), false, 'manifest validation must not compile rate-card schema');
  checkRateCard();
} else {
  checkRateCard();
  assert.equal(calls.includes(manifestId), false, 'rate-card validation must not compile manifest schema');
  checkManifest();
}
assert.equal(calls.length, 6, 'the six actual validation schemas compile once each');
assert.equal(manifestValidators.size, 1, 'manifest and rate-card keep their shared Ajv instance');
for (const validator of manifestValidators) assert.throws(() => validator.compile({ type: 'invalid' }), /schema is invalid/);
`;

for (const first of ['manifest', 'rate-card']) {
  test(`engine schema readers defer compilation and cache validators (${first} first)`, () => {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', proof, first], { cwd: root, encoding: 'utf8', timeout: 30_000 });
    assert.equal(result.status, 0, result.error?.message ?? result.stderr ?? result.stdout);
  });
}
