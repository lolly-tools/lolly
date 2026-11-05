// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { coverContextHash, pickBakedCover, type BakedCoverManifest } from './gallery-covers.ts';

const manifest: BakedCoverManifest = {
  v: 1,
  contexts: { aaa: 'light', bbb: 'dark' },
  covers: {
    design: {
      version: '1.0.0',
      light: { templateId: 'cover', file: '/catalog/previews/covers/design.light.webp' },
      dark: { templateId: 'cover-dark', file: '/catalog/previews/covers/design.dark.webp' },
    },
    plain: { version: '2.0.0', light: { file: '/catalog/previews/covers/plain.light.svg' } },
  },
};
const design = { id: 'design', version: '1.0.0' };

test('a visitor in a baked context gets the file for the cover of that theme', () => {
  assert.equal(pickBakedCover(manifest, 'aaa', design, 0, 'cover'), '/catalog/previews/covers/design.light.webp');
  assert.equal(pickBakedCover(manifest, 'bbb', design, 0, 'cover-dark'), '/catalog/previews/covers/design.dark.webp');
});

test('a theme that hides earlier looks still finds its cover by template id', () => {
  assert.equal(pickBakedCover(manifest, 'aaa', design, 1, 'cover'), '/catalog/previews/covers/design.light.webp');
});

test('a tool whose first look has no template matches a file with no template', () => {
  assert.equal(pickBakedCover(manifest, 'aaa', { id: 'plain', version: '2.0.0' }, 0), '/catalog/previews/covers/plain.light.svg');
});

test('anything that differs from what was baked renders live', () => {
  assert.equal(pickBakedCover(manifest, 'other-brand', design, 0, 'cover'), null, 'another design system');
  assert.equal(pickBakedCover(manifest, 'aaa', { id: 'design', version: '1.0.1' }, 0, 'cover'), null, 'a newer tool version');
  assert.equal(pickBakedCover(manifest, 'aaa', design, 0, 'another-template'), null, 'a different cover');
  assert.equal(pickBakedCover(manifest, 'aaa', { id: 'plain', version: '2.0.0' }, 1), null, 'only the first default look is baked');
  assert.equal(pickBakedCover(manifest, 'bbb', { id: 'plain', version: '2.0.0' }, 0), null, 'not baked in this theme');
  assert.equal(pickBakedCover(manifest, 'aaa', { id: 'unknown', version: '1.0.0' }, 0), null, 'an unknown tool');
  assert.equal(pickBakedCover(null, 'aaa', design, 0, 'cover'), null, 'no manifest');
});

test('the context hash is stable and hides the tokens it covers', async () => {
  const hash = await coverContextHash('{"tokens":["secret"]}');
  assert.equal(hash, await coverContextHash('{"tokens":["secret"]}'));
  assert.notEqual(hash, await coverContextHash('{"tokens":["other"]}'));
  assert.match(hash, /^[0-9a-f]{32}$/);
});
