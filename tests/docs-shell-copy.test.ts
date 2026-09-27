// SPDX-License-Identifier: MPL-2.0
// Copy on a shell block gives its commands only: prompts, output and comments are left
// out (packages/docs-render/src/components.ts, shells/web/src/lib/docs-enhance.ts). So a
// comment must never be what tells the reader which line to run. An "or" alternative, a
// "skip if" condition or a "[--flag]" synopsis inside a copyable block would paste as
// commands that all run, or that zsh rejects. Write the choice as a sentence between two
// blocks, or fence a synopsis as text.
// Run: node --test tests/docs-shell-copy.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFenceInfo, fenceCopies, fenceCopyMode } from '../packages/docs-render/src/index.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** English sources the static site renders: docs/*.md and the README (the About page). */
function sources(): string[] {
  const docs = readdirSync(resolve(root, 'docs')).filter((f) => f.endsWith('.md')).map((f) => `docs/${f}`);
  return [...docs, 'README.md'];
}

interface Block { file: string; line: number; body: string[] }

function copyableShellBlocks(file: string): Block[] {
  const lines = readFileSync(resolve(root, file), 'utf8').split('\n');
  const out: Block[] = [];
  let open: { info: string; line: number; body: string[] } | null = null;
  lines.forEach((l, i) => {
    const m = l.match(/^\s*```(.*)$/);
    if (m && !open) { open = { info: m[1]!, line: i + 1, body: [] }; return; }
    if (m && open) {
      const { lang, flags } = parseFenceInfo(open.info);
      if (fenceCopies(lang, flags) && fenceCopyMode(lang) === 'shell') out.push({ file, line: open.line, body: open.body });
      open = null;
      return;
    }
    if (open) open.body.push(l);
  });
  return out;
}

const CHOICE = /^\s*#\s*\(?(or\b|skip\b|only\b|opt in\b)|^\s*#.*\b(skip if|only if|if you|opt in)\b/i;
/** A bracketed optional argument outside quotes, as in a usage synopsis. zsh reads it as a glob. */
function hasSynopsisBracket(line: string): boolean {
  const bare = line.replace(/'[^']*'|"[^"]*"/g, '');
  return /\[-{1,2}[A-Za-z]/.test(bare);
}

test('no copyable shell block states a choice or a condition in a comment', () => {
  const found: string[] = [];
  for (const file of sources()) {
    for (const b of copyableShellBlocks(file)) {
      b.body.forEach((l, k) => { if (CHOICE.test(l)) found.push(`${b.file}:${b.line + k + 1}: ${l.trim()}`); });
    }
  }
  assert.deepEqual(found, [], 'Copy drops these comments, so the reader would run every line');
});

test('no copyable shell block carries a usage synopsis', () => {
  const found: string[] = [];
  for (const file of sources()) {
    for (const b of copyableShellBlocks(file)) {
      b.body.forEach((l, k) => {
        if (!/^\s*#/.test(l) && hasSynopsisBracket(l)) found.push(`${b.file}:${b.line + k + 1}: ${l.trim()}`);
      });
    }
  }
  assert.deepEqual(found, [], 'fence a synopsis as text; zsh rejects [--flag] as a pattern with no match');
});

test('the guard sees the cases it exists for', () => {
  assert.ok(CHOICE.test('# or from repo root:'));
  assert.ok(CHOICE.test('# the pull secret (skip if your image is on a public registry)'));
  assert.ok(CHOICE.test('# SUSE dev with access to the private brand pack? Opt in:'));
  assert.ok(!CHOICE.test('# List available tools'));
  assert.ok(!CHOICE.test('# (no output)'));
  assert.ok(hasSynopsisBracket('pnpm run cli batch rows.csv [--keep-going]'));
  assert.ok(!hasSynopsisBracket("--set imagePullSecrets[0].name=x"));
  assert.ok(!hasSynopsisBracket("--bars='[{\"page\":1}]'"));
});
