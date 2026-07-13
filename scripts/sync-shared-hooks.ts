#!/usr/bin/env node
/**
 * Shared-hook-region sync.
 *
 * Run as: npm run sync:shared
 *
 * Tool `hooks.js` files ship as self-contained plain JS (tools are data — no
 * imports), which historically meant byte-identical helper blocks were
 * copy-pasted across the filter-* tools (and logo-wall) and rotted apart.
 * `community/_shared/*.js` now holds the canonical source of each shared
 * block as a named region:
 *
 *   // === lolly:shared <name> — canonical source; edit here and run npm run sync:shared ===
 *   ...content...
 *   // === /lolly:shared <name> ===
 *
 * Consumers (`community/<tool>/hooks.js`, `brands/<brand>/tools/<tool>/hooks.js`)
 * mark where each region lives with the same grammar:
 *
 *   // === lolly:shared <name> — generated from community/_shared/<file>; edit there and run npm run sync:shared ===
 *   ...content (rewritten by this script)...
 *   // === /lolly:shared <name> ===
 *
 * This script rewrites every consumer region from its canonical source. It is
 * idempotent, refuses CRLF files, and fails loudly on malformed, nested,
 * unterminated, or unknown-name markers. `scripts/validate-catalog.ts` imports
 * `verifySharedRegions` from here as the CI drift guard — the check and the
 * writer share one parser so they can never disagree. Writing only happens
 * when this file is run directly.
 */

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SHARED_DIR = join(ROOT, 'community', '_shared');

// Marker grammar. The em-dash tail is freeform human guidance; only the region
// name is load-bearing. Anchored, whole-line matches — nothing else in a hooks
// file can collide with `// === lolly:shared`.
const BEGIN_RE = /^\/\/ === lolly:shared (\S+)(?: — (.*))? ===$/;
const END_RE = /^\/\/ === \/lolly:shared (\S+) ===$/;
// Optional `generated from community/_shared/<file>` reference in a consumer's
// begin-marker tail — when present it must name the region's actual source file.
const SOURCE_REF_RE = /generated from community\/_shared\/([\w.-]+)/;

export interface SharedRegion {
  /** Region name (globally unique across all _shared files). */
  name: string;
  /** Basename of the canonical file, e.g. "overlay.js". */
  file: string;
  /** Region content: the lines BETWEEN the markers, joined with \n (no trailing \n). */
  content: string;
}

interface ParsedRegion {
  name: string;
  tail: string | undefined;
  /** Line index of the begin marker. */
  beginLine: number;
  /** Line index of the end marker. */
  endLine: number;
  content: string;
}

/** Parse every marker region out of one file's text. Throws on malformed markers. */
function parseRegions(text: string, rel: string): ParsedRegion[] {
  if (text.includes('\r')) {
    throw new Error(`${rel}: contains CRLF line endings — shared-region sync only handles \\n files`);
  }
  const lines = text.split('\n');
  const regions: ParsedRegion[] = [];
  let open: { name: string; tail: string | undefined; beginLine: number } | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    // Catch near-miss marker lines (typos) so they fail instead of being ignored.
    if (/^\/\/ === \/?lolly:shared/.test(line) && !BEGIN_RE.test(line) && !END_RE.test(line)) {
      throw new Error(`${rel}:${i + 1}: malformed lolly:shared marker: "${line}"`);
    }
    const begin = BEGIN_RE.exec(line);
    if (begin) {
      if (open) {
        throw new Error(`${rel}:${i + 1}: nested lolly:shared marker "${begin[1]}" inside open region "${open.name}" (line ${open.beginLine + 1})`);
      }
      open = { name: begin[1]!, tail: begin[2], beginLine: i };
      continue;
    }
    const end = END_RE.exec(line);
    if (end) {
      if (!open) throw new Error(`${rel}:${i + 1}: end marker "/lolly:shared ${end[1]}" without a matching begin`);
      if (end[1] !== open.name) {
        throw new Error(`${rel}:${i + 1}: end marker "/lolly:shared ${end[1]}" does not match open region "${open.name}" (line ${open.beginLine + 1})`);
      }
      regions.push({
        name: open.name,
        tail: open.tail,
        beginLine: open.beginLine,
        endLine: i,
        content: lines.slice(open.beginLine + 1, i).join('\n'),
      });
      open = null;
    }
  }
  if (open) throw new Error(`${rel}: unterminated lolly:shared region "${open.name}" (begin at line ${open.beginLine + 1})`);
  return regions;
}

/** Load the canonical regions from community/_shared/*.js. Throws on duplicates. */
export function loadSharedRegions(): Map<string, SharedRegion> {
  const out = new Map<string, SharedRegion>();
  if (!existsSync(SHARED_DIR)) return out;
  for (const file of readdirSync(SHARED_DIR).sort()) {
    if (!file.endsWith('.js')) continue;
    const rel = `community/_shared/${file}`;
    const text = readFileSync(join(SHARED_DIR, file), 'utf8');
    for (const region of parseRegions(text, rel)) {
      const prev = out.get(region.name);
      if (prev) {
        throw new Error(`duplicate canonical region "${region.name}" in ${rel} (already defined in community/_shared/${prev.file})`);
      }
      out.set(region.name, { name: region.name, file, content: region.content });
    }
  }
  return out;
}

/**
 * Every hooks.js the sync manages: community/<tool>/hooks.js plus
 * brands/<brand>/tools/<tool>/hooks.js. Enumerates the real pack sources, never
 * the gitignored tools/ profile view (which symlinks/copies these same files).
 * A missing pack (e.g. the private brands/suse on a public clone) is skipped.
 */
export function listConsumerHookFiles(): string[] {
  const roots: string[] = [];
  const community = join(ROOT, 'community');
  if (existsSync(community)) roots.push(community);
  const brands = join(ROOT, 'brands');
  if (existsSync(brands)) {
    for (const brand of readdirSync(brands).sort()) {
      const toolsRoot = join(brands, brand, 'tools');
      if (existsSync(toolsRoot) && statSync(toolsRoot).isDirectory()) roots.push(toolsRoot);
    }
  }
  const files: string[] = [];
  for (const root of roots) {
    for (const entry of readdirSync(root).sort()) {
      // _shared is the canonical corpus, not a consumer (or a tool).
      if (entry.startsWith('.') || entry.startsWith('_') || entry === 'node_modules') continue;
      const dir = join(root, entry);
      if (!statSync(dir).isDirectory()) continue;
      const hooks = join(dir, 'hooks.js');
      if (existsSync(hooks)) files.push(hooks);
    }
  }
  return files;
}

/**
 * CI drift guard (used by scripts/validate-catalog.ts): every marked region in
 * every consumer must byte-match its canonical community/_shared source.
 * Returns error strings instead of throwing so the validator can aggregate.
 */
export function verifySharedRegions(): string[] {
  const errors: string[] = [];
  let canonical: Map<string, SharedRegion>;
  try {
    canonical = loadSharedRegions();
  } catch (e) {
    return [(e as Error).message];
  }
  for (const abs of listConsumerHookFiles()) {
    const rel = relative(ROOT, abs);
    let regions: ParsedRegion[];
    try {
      regions = parseRegions(readFileSync(abs, 'utf8'), rel);
    } catch (e) {
      errors.push((e as Error).message);
      continue;
    }
    for (const region of regions) {
      const canon = canonical.get(region.name);
      if (!canon) {
        errors.push(`${rel}:${region.beginLine + 1}: region "${region.name}" has no canonical source in community/_shared/`);
        continue;
      }
      const ref = region.tail ? SOURCE_REF_RE.exec(region.tail) : null;
      if (ref && ref[1] !== canon.file) {
        errors.push(`${rel}:${region.beginLine + 1}: region "${region.name}" claims community/_shared/${ref[1]} but its canonical source is community/_shared/${canon.file}`);
      }
      if (region.content !== canon.content) {
        errors.push(`${rel}:${region.beginLine + 1}: region "${region.name}" drifted from community/_shared/${canon.file} — edit the canonical file and run \`npm run sync:shared\``);
      }
    }
  }
  return errors;
}

/** Rewrite every consumer's marked regions from the canonical sources. */
function sync(): void {
  const canonical = loadSharedRegions();
  if (canonical.size === 0) {
    console.error('✗ no canonical regions found under community/_shared/');
    process.exit(1);
  }
  const consumersByRegion = new Map<string, number>();
  let filesChanged = 0;
  let filesScanned = 0;
  for (const abs of listConsumerHookFiles()) {
    const rel = relative(ROOT, abs);
    const text = readFileSync(abs, 'utf8');
    const regions = parseRegions(text, rel); // throws on malformed/nested/CRLF
    if (!regions.length) continue;
    filesScanned++;
    const lines = text.split('\n');
    // Splice bottom-up so earlier regions' line indices stay valid.
    let changed = false;
    for (const region of [...regions].reverse()) {
      const canon = canonical.get(region.name);
      if (!canon) {
        throw new Error(`${rel}:${region.beginLine + 1}: region "${region.name}" has no canonical source in community/_shared/`);
      }
      const ref = region.tail ? SOURCE_REF_RE.exec(region.tail) : null;
      if (ref && ref[1] !== canon.file) {
        throw new Error(`${rel}:${region.beginLine + 1}: region "${region.name}" claims community/_shared/${ref[1]} but its canonical source is community/_shared/${canon.file}`);
      }
      consumersByRegion.set(region.name, (consumersByRegion.get(region.name) ?? 0) + 1);
      if (region.content === canon.content) continue;
      lines.splice(region.beginLine + 1, region.endLine - region.beginLine - 1, ...canon.content.split('\n'));
      changed = true;
    }
    if (changed) {
      writeFileSync(abs, lines.join('\n'));
      filesChanged++;
      console.log(`  ✎ ${rel}`);
    }
  }
  for (const name of canonical.keys()) {
    if (!consumersByRegion.has(name)) {
      console.warn(`  ⚠ canonical region "${name}" has no consumers`);
    }
  }
  const regionSummary = [...consumersByRegion.entries()]
    .map(([name, n]) => `${name}×${n}`)
    .join(', ');
  console.log(
    `✓ sync:shared — ${canonical.size} canonical regions, ${filesScanned} consuming files, ` +
    `${filesChanged} rewritten${filesChanged === 0 ? ' (already in sync)' : ''}` +
    (regionSummary ? `\n  regions: ${regionSummary}` : ''),
  );
}

// Only rewrite consumers when run directly (`node scripts/sync-shared-hooks.ts`).
// validate-catalog.ts imports verifySharedRegions from this module and must NOT
// trigger writes as an import side effect.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    sync();
  } catch (e) {
    console.error(`✗ ${(e as Error).message}`);
    process.exit(1);
  }
}
