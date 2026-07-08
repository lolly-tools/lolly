/**
 * Brand-residue guard for the lolly-start starter pack.
 *
 * Run with: npm test  (node --test over the tests/ globs)
 * No test framework — uses node:test built-in. Dependency-free fs walk.
 *
 * Two invariants from plans/brand-token-contract.md §6:
 *
 * 1. brands/lolly-start/** is brand-CLEAN: the starter pack (tokens + the
 *    de-SUSE'd tool copies) must carry none of the SUSE brand hexes and no
 *    "SUSE" name/font references. The hex check is case-insensitive; the name
 *    check is the exact string "SUSE" — lowercase 'suse' appears legitimately
 *    in the vendor token-extension key (com.suse.lolly, engine/src/tokens.ts
 *    TOKEN_EXT — renaming it is an explicit non-goal). The build:catalog
 *    aggregation catalog/tools/index.json is excluded: it embeds COMMUNITY
 *    manifests verbatim (color-palette description, filter examples, …) whose
 *    de-SUSE sweep is deferred (contract §8), not lolly-start authored content.
 *
 * 2. Semantic brand vars are never consumed bare: templates get --primary,
 *    --on-primary, --secondary, --surface, --text, --muted, --edge projected
 *    onto the tool-canvas root only when the brand tokens resolve — a missing
 *    slot leaves the var UNSET (never ''), so every var() reference in tool
 *    markup/styles must carry a comma fallback or it collapses to nothing on
 *    an unbranded canvas. Checked across brands/lolly-start and community
 *    (exact var names only — the shell's shadcn-style extended names like
 *    --muted-foreground are a different, :root-scoped contract).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PACK = join(ROOT, 'brands', 'lolly-start');
const COMMUNITY = join(ROOT, 'community');

// Extensions we treat as text (the pack also carries binary thumbs/fonts).
const TEXT_EXTS = new Set([
  '.json', '.md', '.html', '.css', '.js', '.ts', '.svg',
  '.txt', '.csv', '.ics', '.vcf', '.xml', '.webmanifest',
]);

// Generated-by-build:catalog aggregation of the active profile's tool manifests
// (community residue, not pack content) — see the header comment.
const GENERATED = new Set([join(PACK, 'catalog', 'tools', 'index.json')]);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (entry.isFile()) out.push(p);
  }
  return out;
}

// The SUSE brand palette as shipped in the private pack's tokens/tools.
const SUSE_HEX = /#(?:30ba78|0c322c|90ebcd|fe7c3f|2453ff|192072)/i;

test('brands/lolly-start carries no SUSE brand hexes or SUSE references', () => {
  const files = walk(PACK).filter(
    f => TEXT_EXTS.has(extname(f).toLowerCase()) && !GENERATED.has(f),
  );
  // Sanity: the pack has real content (README, tokens, two tool dirs).
  assert.ok(files.length >= 8, `expected the starter pack's text files, found ${files.length}`);
  for (const f of files) {
    const text = readFileSync(f, 'utf8');
    const rel = relative(ROOT, f);
    const hex = text.match(SUSE_HEX);
    assert.equal(hex, null, `${rel} contains SUSE brand hex ${hex?.[0]}`);
    assert.ok(!text.includes('SUSE'), `${rel} references "SUSE"`);
  }
});

// Exact semantic slot names only: after the name the next non-space char must be
// ',' (fallback present) or ')' (bare — the failure). Extended names such as
// --muted-foreground don't match because '-' follows the name.
const SEMANTIC_VAR = /var\(\s*--(on-primary|primary|secondary|surface|text|muted|edge)\s*([,)])/g;

test('semantic brand var() references always carry a fallback', () => {
  const roots = [PACK, COMMUNITY].filter(dir => existsSync(dir));
  const files = roots
    .flatMap(dir => walk(dir))
    .filter(f => f.endsWith('.html') || f.endsWith('.css'));
  assert.ok(files.length > 0, 'expected tool templates/styles to scan');
  for (const f of files) {
    const text = readFileSync(f, 'utf8');
    const rel = relative(ROOT, f);
    for (const m of text.matchAll(SEMANTIC_VAR)) {
      assert.equal(
        m[2], ',',
        `${rel}: var(--${m[1]}) has no fallback — an unbranded canvas leaves the var unset`,
      );
    }
  }
});
