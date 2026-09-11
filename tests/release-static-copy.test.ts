// SPDX-License-Identifier: MPL-2.0

import assert from 'node:assert/strict';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { materializeDirectory } from '../shells/web/build/materialize-directory.ts';
import { stripModelCandidates } from '../shells/web/vite.config.js';

test('profile directory and file symlinks become standalone release bytes', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'lolly-materialize-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, 'source'));
  mkdirSync(join(dir, 'brand'));
  writeFileSync(join(dir, 'brand', 'tool.json'), '{"id":"demo"}');
  writeFileSync(join(dir, 'shared.html'), '<svg></svg>');
  symlinkSync('../shared.html', join(dir, 'brand', 'template.html'));
  symlinkSync(join(dir, 'brand'), join(dir, 'source', 'demo'), 'dir');
  const out = join(dir, 'dist');
  materializeDirectory(join(dir, 'source'), out);
  assert.equal(lstatSync(join(out, 'demo')).isSymbolicLink(), false);
  assert.equal(lstatSync(join(out, 'demo', 'template.html')).isSymbolicLink(), false);
  rmSync(join(dir, 'brand'), { recursive: true });
  rmSync(join(dir, 'shared.html'));
  assert.equal(readFileSync(join(out, 'demo', 'tool.json'), 'utf8'), '{"id":"demo"}');
  assert.equal(readFileSync(join(out, 'demo', 'template.html'), 'utf8'), '<svg></svg>');
});

test('rebuilding over old output symlinks never changes source files', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'lolly-rebuild-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const source = join(dir, 'source'),
    out = join(dir, 'dist');
  mkdirSync(join(source, 'demo'), { recursive: true });
  writeFileSync(join(source, 'demo', 'tool.json'), '{"id":"demo"}');
  mkdirSync(out);
  symlinkSync(join(source, 'demo'), join(out, 'demo'), 'dir');
  materializeDirectory(source, out);
  assert.equal(readFileSync(join(source, 'demo', 'tool.json'), 'utf8'), '{"id":"demo"}');
  assert.equal(lstatSync(join(out, 'demo')).isSymbolicLink(), false);
  assert.equal(readFileSync(join(out, 'demo', 'tool.json'), 'utf8'), '{"id":"demo"}');
  // A directory-level output link is replaced with real bytes too.
  rmSync(out, { recursive: true });
  symlinkSync(source, out, 'dir');
  materializeDirectory(source, out);
  assert.equal(lstatSync(out).isSymbolicLink(), false);
  assert.equal(readFileSync(join(source, 'demo', 'tool.json'), 'utf8'), '{"id":"demo"}');
  assert.throws(() => materializeDirectory(source, source), /overlap/);
  assert.throws(() => materializeDirectory(source, dir), /overlap/);
  assert.equal(readFileSync(join(source, 'demo', 'tool.json'), 'utf8'), '{"id":"demo"}');
});

test('unapproved model candidates are removed from the selected build output only', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'lolly-candidates-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const source = join(dir, 'public/models/matte/.candidates');
  const candidate = join(dir, 'release/models/matte/.candidates');
  mkdirSync(source, { recursive: true });
  mkdirSync(candidate, { recursive: true });
  writeFileSync(join(source, 'experimental.onnx'), 'source');
  writeFileSync(join(candidate, 'experimental.onnx'), 'candidate');
  writeFileSync(join(dir, 'release/models/matte/approved.onnx'), 'approved');
  const plugin = stripModelCandidates();
  plugin.configResolved({ root: dir, build: { outDir: 'release' } });
  plugin.closeBundle();
  assert.equal(existsSync(candidate), false);
  assert.equal(readFileSync(join(source, 'experimental.onnx'), 'utf8'), 'source');
  assert.equal(readFileSync(join(dir, 'release/models/matte/approved.onnx'), 'utf8'), 'approved');
});
