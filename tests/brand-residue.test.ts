/**
 * Brand-residue guard for the lolly-start starter pack.
 *
 * Run with: npm test  (node --test over the tests/ globs)
 * No test framework — uses node:test built-in. Dependency-free fs walk.
 *
 * Three invariants from plans/brand-token-contract.md §3/§6:
 *
 * 1. brands/lolly-start/** is brand-CLEAN: the starter pack (tokens + the
 *    de-SUSE'd tool copies) must carry none of the seven SUSE brand hexes and
 *    no SUSE name/font/asset-id references. Both checks are case-insensitive —
 *    the most damaging residue class is lowercase (a dangling "suse/logo/…"
 *    asset id would 404 under lolly-start, since no suse/* assets exist in
 *    this catalog). The one allowed occurrence is the vendor token-extension
 *    key com.suse.lolly (engine/src/tokens.ts TOKEN_EXT — renaming it is an
 *    explicit non-goal, contract §4): deriveBrandTokens output rides swatch
 *    hints on $extensions["com.suse.lolly"], so exactly that substring is
 *    scrubbed before the check (it currently appears nowhere in the pack).
 *    The build:catalog aggregation catalog/tools/index.json is excluded: it
 *    embeds COMMUNITY manifests verbatim (filter examples, …) whose de-SUSE
 *    sweep is deferred (contract §8), not lolly-start authored content.
 *
 * 2. Semantic brand vars are never consumed bare: templates get
 *    --brand-primary, --brand-on-primary, --brand-secondary, --brand-surface,
 *    --brand-text, --brand-muted, --brand-edge projected onto the tool-canvas
 *    root only when the brand tokens resolve — a missing slot leaves the var
 *    UNSET (never ''), so every var() reference in tool markup/styles must
 *    carry a comma fallback or it collapses to nothing on an unbranded
 *    canvas. Checked across brands/lolly-start and community.
 *
 * 3. The pre-rename bare slot names (--primary, --surface, …) are BANNED in
 *    lolly-start outright, fallback or not: those names now belong to the web
 *    shell's :root shadcn HSL-triple vocabulary (which community tools
 *    deliberately consume as hsl(var(--primary, …)) triples — so community is
 *    NOT scanned by this rule). A straggler in lolly-start would silently
 *    read an HSL triple, never a brand colour (contract §3, REVISED
 *    2026-07-09).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative, sep } from 'node:path';
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

// catalog/previews/ is a `npm run previews` render cache (screenshots +
// build-preview-bundle.ts's rolled-up bundle.json), COMMITTED so a plain
// git-based deploy ships gallery thumbnails (.gitignore's "Tool preview
// thumbnails" note) — not pack-authored content, and it reflects whatever
// profile/brand was active at capture time rather than lolly-start's own
// tokens. Same "generated, not authored" exclusion as index.json above.
const GENERATED_PREVIEWS = join(PACK, 'catalog', 'previews') + sep;
const isGenerated = (f: string) => GENERATED.has(f) || f.startsWith(GENERATED_PREVIEWS);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (entry.isFile()) out.push(p);
  }
  return out;
}

// The SUSE brand palette as shipped in the private pack's tokens/tools —
// all seven brand-use hexes from contract §6.
const SUSE_HEX = /#(?:30ba78|0c322c|90ebcd|fe7c3f|2453ff|192072|efefef)/i;

// The vendor token-extension key is the only legitimate 'suse' substring
// (derive-generated docs embed it in $extensions — see the header comment).
const ALLOWED_SUSE = 'com.suse.lolly';

test('brands/lolly-start carries no SUSE brand hexes or SUSE references', () => {
  const files = walk(PACK).filter(
    f => TEXT_EXTS.has(extname(f).toLowerCase()) && !isGenerated(f),
  );
  // Sanity: the pack has real content (README, tokens, two tool dirs).
  assert.ok(files.length >= 8, `expected the starter pack's text files, found ${files.length}`);
  for (const f of files) {
    const text = readFileSync(f, 'utf8');
    const rel = relative(ROOT, f);
    const hex = text.match(SUSE_HEX);
    assert.equal(hex, null, `${rel} contains SUSE brand hex ${hex?.[0]}`);
    // Case-insensitive, with surrounding word-ish context in the failure
    // message so a dangling "suse/logo/…" asset id is identifiable at a glance.
    const name = text.replaceAll(ALLOWED_SUSE, '').match(/[\w./-]*suse[\w./-]*/i);
    assert.equal(name, null, `${rel} contains SUSE residue "${name?.[0]}"`);
  }
});

// Exact semantic slot names only: after the name the next non-space char must be
// ',' (fallback present) or ')' (bare — the failure). Extended names such as
// --brand-text-something don't match because '-' follows the name.
const BRAND_VAR = /var\(\s*--brand-(on-primary|primary|secondary|surface|text|muted|edge)\s*([,)])/g;

test('semantic brand var() references always carry a fallback', () => {
  const roots = [PACK, COMMUNITY].filter(dir => existsSync(dir));
  const files = roots
    .flatMap(dir => walk(dir))
    .filter(f => f.endsWith('.html') || f.endsWith('.css'));
  assert.ok(files.length > 0, 'expected tool templates/styles to scan');
  for (const f of files) {
    const text = readFileSync(f, 'utf8');
    const rel = relative(ROOT, f);
    for (const m of text.matchAll(BRAND_VAR)) {
      assert.equal(
        m[2], ',',
        `${rel}: var(--brand-${m[1]}) has no fallback — an unbranded canvas leaves the var unset`,
      );
    }
  }
});

// The pre-rename bare names, retired by contract §3 (REVISED 2026-07-09).
// Same trailing [,)] trick so --primary-foreground-style extended names pass.
const RETIRED_VAR = /var\(\s*--(on-primary|primary|secondary|surface|text|muted|edge)\s*[,)]/g;

test('lolly-start never consumes the retired bare semantic var names', () => {
  const files = walk(PACK).filter(
    f => TEXT_EXTS.has(extname(f).toLowerCase()) && !isGenerated(f),
  );
  for (const f of files) {
    const text = readFileSync(f, 'utf8');
    const rel = relative(ROOT, f);
    for (const m of text.matchAll(RETIRED_VAR)) {
      assert.fail(
        `${rel}: var(--${m[1]}) uses a retired bare slot name — the injected brand vars are --brand-* (contract §3); bare names are the shell's shadcn HSL-triple vocabulary`,
      );
    }
  }
});
