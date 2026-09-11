// SPDX-License-Identifier: MPL-2.0
// The pure half of the Paste-text dialog: what file a paste becomes. The dialog
// itself is DOM/overlay and belongs to a browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pastedTextFile } from './paste-text.ts';

test('markdown-shaped text saves as .md with a markdown MIME', () => {
  const md = pastedTextFile('Release notes', '# v2\n\n- **Faster:** the parser\n- links: [docs](https://x)');
  assert.equal(md.fileName, 'release-notes.md');
  assert.equal(md.mime, 'text/markdown');
});

test('plain prose saves as .txt', () => {
  const txt = pastedTextFile('Meeting notes', 'We agreed to move the fence line two metres north.');
  assert.equal(txt.fileName, 'meeting-notes.txt');
  assert.equal(txt.mime, 'text/plain');
});

test('an empty name falls back, and slugs strip punctuation without dying', () => {
  assert.equal(pastedTextFile('', 'hello world').fileName, 'pasted-text.txt');
  assert.equal(pastedTextFile('  Q3 / Plan (draft!)  ', 'hello world').fileName, 'q3-plan-draft.txt');
});

test('a very long name is capped, not rejected', () => {
  const { fileName } = pastedTextFile('x'.repeat(200), 'hello world');
  assert.ok(fileName.length <= 64, fileName);
  assert.ok(fileName.endsWith('.txt'));
});
