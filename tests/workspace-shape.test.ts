// SPDX-License-Identifier: MPL-2.0
/**
 * Two shape rules the subrepo collapse (plan 244) leaves behind, both of which
 * fail quietly rather than loudly if someone reverses them.
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

test('the workspace member parser stops at the end of the list', () => {
  const parsed = workspacePackages('packages:\n  - engine\n  - shells/web\n\nnodeLinker: hoisted\n  - not-a-member\n');
  assert.deepEqual(parsed, ['engine', 'shells/web']);
});
