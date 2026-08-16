/**
 * Deterministic vernacular + hidden-unicode gate over the English docs
 * sources. The scanner is a plain script (scripts/check-docs-vernacular.ts) - 
 * character and substring matching with a literal allowlist, no judgment
 * anywhere - so what this test enforces is exactly what the standalone CLI
 * enforces, and neither depends on a model or a reviewer noticing.
 *
 * If this fails: fix the copy, never the ban list. Adding an ALLOW entry is a
 * conscious decision for a LITERAL use (a waveform's shape, not a metaphor).
 */
import { test } from 'node:test';
import assert from 'node:assert';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scan, scanBuilt, staleAllows } from '../scripts/check-docs-vernacular.ts';

const BUILT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'shells/web/public/info');

test('docs sources carry no banned vernacular or fingerprint unicode', () => {
  const v = scan();
  assert.deepStrictEqual(
    v.map(x => `${x.file}:${x.line} [${x.what}] ${x.excerpt}`),
    [],
    'Banned phrase or unicode in docs sources — fix the copy (see scripts/check-docs-vernacular.ts for the ban list and the rules for ALLOW entries).',
  );
});

test('built pages carry no fingerprint unicode in visible text or spoken attributes', { skip: !existsSync(BUILT) }, () => {
  // Layer 3: sources can be clean while a GENERATOR assembles the character
  // into the page (the credential-label join did). English pages only; styles,
  // scripts, inlined SVGs and code samples are out of scope by construction.
  const v = scanBuilt();
  assert.deepStrictEqual(
    v.map(x => `${x.file} [${x.what}] ${x.excerpt}`),
    [],
    'A build-time generator introduced a banned character - fix the generator (docs/build.ts or packages/docs-render), then npm run build:info.',
  );
});

test('every allowlist entry still sanctions a line that exists', () => {
  assert.deepStrictEqual(staleAllows(), [], 'Stale ALLOW entries — the sanctioned line changed or moved; update or remove the entry so the list keeps meaning what it says.');
});
