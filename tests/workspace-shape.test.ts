// SPDX-License-Identifier: MPL-2.0
/**
 * Three shape rules, each of which fails quietly rather than loudly if someone
 * reverses it. The first two are what the subrepo collapse (plan 244) leaves behind.
 *
 * 1. The Tauri shells are NOT pnpm workspace members. They keep their own
 *    package.json and pnpm-lock.yaml, and scripts/typecheck-tauri.ts skips with a
 *    logged reason when their node_modules is absent - which is what stops a plain
 *    clone from being punished for not having the Tauri toolchain. Adding either to
 *    pnpm-workspace.yaml makes a root `pnpm install --frozen-lockfile` resolve
 *    `@tauri-apps/*`, and that documented skip stops meaning anything.
 * 2. brands/suse is the only submodule. It is the private brand pack, `update = none`
 *    so public clones skip it. Anything else in .gitmodules is a path that was folded
 *    into the tree coming back as a gitlink, which is what this whole plan undid.
 * 3. The lockfile resolves ONE react and ONE react-dom. `nodeLinker: hoisted` puts a
 *    single copy of each package at the repo root and nests every other version, so a
 *    second react version is installed under shells/tui while ink and ink-testing-library
 *    keep the root one. React then throws "Invalid hook call", ink's error boundary hides
 *    it, and every rendered frame comes out empty - which reaches a maintainer as a TUI
 *    test waiting fifteen seconds for terminal output that is never coming. The
 *    `overrides` block in pnpm-workspace.yaml states the intent; this is what checks it,
 *    because a regenerated lockfile can break the agreement without touching that file.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (name: string): string => readFileSync(path.join(repoRoot, name), 'utf8');

/** The `packages:` list of pnpm-workspace.yaml, in file order. */
function workspacePackages(source: string): string[] {
  const lines = source.split('\n');
  const start = lines.findIndex((line) => /^packages:\s*$/.test(line));
  assert.notEqual(start, -1, 'pnpm-workspace.yaml has no packages: key');
  const members: string[] = [];
  for (const line of lines.slice(start + 1)) {
    const entry = line.match(/^\s+-\s*(?:'([^']*)'|"([^"]*)"|(\S+))\s*$/);
    if (!entry) break;
    members.push((entry[1] ?? entry[2] ?? entry[3])!.trim());
  }
  return members;
}

/** Every `path =` in .gitmodules, sorted. */
function submodulePaths(source: string): string[] {
  return [...source.matchAll(/^\s*path\s*=\s*(.+?)\s*$/gm)].map((match) => match[1]!).sort();
}

/**
 * The versions the lockfile resolved for one package name, read off the top-level
 * `packages:` keys (`name@version:`, two spaces of indent, scoped names quoted).
 */
function lockedVersions(source: string, name: string): string[] {
  const lines = source.split('\n');
  const start = lines.findIndex((line) => /^packages:\s*$/.test(line));
  assert.notEqual(start, -1, 'pnpm-lock.yaml has no packages: key');
  const found = new Set<string>();
  for (const line of lines.slice(start + 1)) {
    if (/^\S/.test(line) && line.trim() !== '') break;
    const key = line.match(/^ {2}(?! )'?(.+?)'?:\s*$/);
    if (!key) continue;
    const at = key[1]!.lastIndexOf('@');
    if (at > 0 && key[1]!.slice(0, at) === name) found.add(key[1]!.slice(at + 1));
  }
  return [...found].sort();
}

test('the Tauri shells are not pnpm workspace members', () => {
  const members = workspacePackages(read('pnpm-workspace.yaml'));
  assert.ok(members.length > 0, 'no workspace members parsed');
  assert.deepEqual(
    members.filter((member) => /(^|\/)shells\/tauri-/.test(member) || member.startsWith('shells/tauri-')),
    [],
    'shells/tauri-* must stay out of pnpm-workspace.yaml - they are separate pnpm projects with their own lockfiles',
  );
  // A glob that would sweep them in is just as bad as naming them.
  assert.deepEqual(members.filter((member) => member.includes('*') && member.startsWith('shells/')), []);
});

test('brands/suse is the only submodule', () => {
  assert.deepEqual(submodulePaths(read('.gitmodules')), ['brands/suse']);
});

test('the submodule parser reads paths, not urls or update policy', () => {
  assert.deepEqual(
    submodulePaths('[submodule "a"]\n\tpath = one/a\n\turl = https://example.invalid/a\n\tupdate = none\n'),
    ['one/a'],
  );
});

test('the lockfile resolves one react and one react-dom', () => {
  const lock = read('pnpm-lock.yaml');
  for (const name of ['react', 'react-dom']) {
    const versions = lockedVersions(lock, name);
    assert.equal(versions.length, 1, `${name} resolved to ${versions.length} versions (${versions.join(', ')}); hoisting gives shells/tui a different copy from the one ink renders through, so every TUI frame comes out empty. Re-resolve the lockfile instead of hand-merging it.`);
  }
});

test('the locked-version parser reads top-level package keys only', () => {
  const lock = [
    'packages:',
    '',
    "  '@types/react@19.3.0':",
    '    resolution: {integrity: sha512-x}',
    '  react@19.3.0:',
    '    peerDependencies:',
    '      react-dom: 19.3.0',
    '  react-dom@19.3.0:',
    '    peerDependenciesMeta:',
    '      react:',
    '        optional: true',
    'snapshots:',
    '  react@19.2.8: {}',
  ].join('\n');
  assert.deepEqual(lockedVersions(lock, 'react'), ['19.3.0']);
  assert.deepEqual(lockedVersions(lock, 'react-dom'), ['19.3.0']);
  assert.deepEqual(lockedVersions(lock, '@types/react'), ['19.3.0']);
});

test('the workspace member parser stops at the end of the list', () => {
  const parsed = workspacePackages('packages:\n  - engine\n  - shells/web\n\nnodeLinker: hoisted\n  - not-a-member\n');
  assert.deepEqual(parsed, ['engine', 'shells/web']);
});
