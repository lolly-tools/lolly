// SPDX-License-Identifier: MPL-2.0
/**
 * Error text paints in the text red, never the fill red.
 *
 * --destructive is a FILL: the destructive button, with --destructive-foreground
 * as its ink. As the colour of words the fill red read 2.1:1 on the dark page
 * and about 2.3:1 on the brand theme, so every theme now carries
 * --destructive-text, a red that reads 4.5:1 on its own surfaces (Lc 75 under
 * High contrast). Both names start the same way, so a new
 * `color: hsl(var(--destructive))` reads as correct in review and quietly
 * brings the 2.1:1 back. This guard is what notices.
 *
 * Also guarded: `var(--danger, …)`, a token nothing defines, whose literal
 * fallback was the only colour it ever painted.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/styles/error-text-contract.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('..', import.meta.url));

function sources(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir).sort()) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) sources(path, out);
    else if ((entry.endsWith('.css') || entry.endsWith('.ts')) && !entry.endsWith('.test.ts')) out.push(path);
  }
  return out;
}

/** `color:` (not background-color, border-color …) reading the FILL red. */
const FILL_AS_TEXT = /(?<![-\w])color\s*:\s*hsl\(\s*var\(\s*--destructive\s*[,)]/;
const UNDEFINED_DANGER = /var\(\s*--danger\b/;

test('no error text paints in the fill red, and nothing reads the undefined --danger', () => {
  const hits: string[] = [];
  for (const file of sources(SRC)) {
    readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
      if (FILL_AS_TEXT.test(line) || UNDEFINED_DANGER.test(line)) hits.push(`${relative(SRC, file)}:${i + 1}: ${line.trim()}`);
    });
  }
  assert.deepEqual(hits, [], 'use hsl(var(--destructive-text)) or var(--ui-color-status-danger) for error text');
});

test('the danger status role is the text red', () => {
  const tokens = readFileSync(join(SRC, 'styles', 'tokens.css'), 'utf8');
  assert.match(tokens, /--ui-color-status-danger: hsl\(var\(--destructive-text\)\);/);
});
