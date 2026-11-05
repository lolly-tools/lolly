// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cliRecipe, editInputValues, shellWord, terminalReportLines } from './terminal-workflows.ts';
import { terminalPalette } from './theme.ts';

test('full diagnostic text wraps without interpreting markup or terminal controls', () => {
  const lines = terminalReportLines(['\x1b[31mReview <b>literal</b> markup\x1b[0m', '', 'Last finding stays available'], 16);
  assert.ok(lines.length > 3);
  assert.ok(lines.includes(''));
  assert.ok(!lines.join('').includes('\x1b'));
  assert.match(lines.join(' '), /<b>literal<\/b>/);
  assert.match(lines.join(' '), /Last finding stays available/);
});

test('private recipe values stay in stdin and shell metacharacters stay quoted', () => {
  const recipe = cliRecipe(
    'qr-code',
    { url: "PRIVATE ' $(touch /invalid)" },
    { format: 'svg', width: 812 },
    "/tmp/a file's.svg"
  );
  assert.ok(!recipe.split('\n')[0]?.includes('PRIVATE'));
  assert.ok(recipe.includes('PRIVATE'));
  assert.ok(recipe.includes('--inputs=-'));
  assert.ok(recipe.includes(shellWord("--output=/tmp/a file's.svg")));
  assert.throws(
    () => cliRecipe('x', { source: { bytes: new Uint8Array(2) } }, {}, 'out'),
    /loaded file/
  );
});

test('terminal appearance respects native foreground and explicit monochrome', () => {
  assert.equal(terminalPalette('terminal', false).fg, undefined);
  assert.equal(terminalPalette('light', false).fg, 'black');
  assert.equal(terminalPalette('dark', false).fg, 'white');
  assert.ok(Object.values(terminalPalette('light', true)).every((value) => value === undefined));
});

test('external editor gets a private file and returns a candidate without mutating the document', {
  skip: process.platform === 'win32',
}, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lolly-editor-test-'));
  const previous = { editor: process.env.EDITOR, visual: process.env.VISUAL };
  try {
    const script = join(dir, 'editor with spaces.mjs');
    await writeFile(
      script,
      `import {readFileSync,writeFileSync,statSync} from 'node:fs';
const path=process.argv[2]; if((statSync(path).mode&0o777)!==0o600)process.exit(2);
const value=JSON.parse(readFileSync(path,'utf8'));value.title='Edited';writeFileSync(path,JSON.stringify(value));`
    );
    process.env.EDITOR = `${shellWord(process.execPath)} ${shellWord(script)}`;
    delete process.env.VISUAL;
    let suspended = false;
    const original = { title: 'Before' };
    const candidate = await editInputValues(original, async (callback) => {
      suspended = true;
      await callback();
    });
    assert.ok(suspended);
    assert.equal(candidate.title, 'Edited');
    assert.equal(original.title, 'Before');
  } finally {
    if (previous.editor === undefined) delete process.env.EDITOR;
    else process.env.EDITOR = previous.editor;
    if (previous.visual === undefined) delete process.env.VISUAL;
    else process.env.VISUAL = previous.visual;
    await rm(dir, { recursive: true, force: true });
  }
});
