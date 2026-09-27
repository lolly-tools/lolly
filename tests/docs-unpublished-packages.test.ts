// SPDX-License-Identifier: MPL-2.0
// The docs must not send a reader to an npm package that does not exist: the command
// fails with a 404 on the first thing they type. `@lolly-tools/cli` is not published
// (checked 2026-09-26), so the terminal route is a checkout's `pnpm run cli` until it
// is. When the package ships, delete its entry here and document the install.
// Run: node --test tests/docs-unpublished-packages.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const UNPUBLISHED = ['@lolly-tools/cli'];

test('no English docs page or README names an unpublished package', () => {
  const files = [
    ...readdirSync(resolve(root, 'docs')).filter((f) => f.endsWith('.md')).map((f) => `docs/${f}`),
    'README.md',
  ];
  const found: string[] = [];
  for (const file of files) {
    readFileSync(resolve(root, file), 'utf8').split('\n').forEach((line, i) => {
      for (const pkg of UNPUBLISHED) if (line.includes(pkg)) found.push(`${file}:${i + 1}: ${pkg}`);
    });
  }
  assert.deepEqual(found, []);
});
