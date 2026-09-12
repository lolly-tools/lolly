#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Generate the data-derived tables inside the `skills/lolly/` agent skill, then
 * mirror the whole skill to `.claude/skills/lolly/` so Claude Code loads it from
 * any checkout.
 *
 * The tables are built from the PUBLIC catalog and the public tool manifests, on
 * purpose: `brands/lolly-start/catalog/tools/index.json` (not `catalogFile()`,
 * which answers for whatever profile is active) and `community/<id>/tool.json`
 * (not `toolFile()`). A maintainer with the SUSE profile mounted
 * therefore still generates the same public skill, and the skill stays true on a
 * clone that has no private pack.
 *
 * Only the marked blocks are rewritten - `<!-- GEN:name -->` … `<!-- /GEN:name -->`.
 * The prose around them is hand-written and left alone. `tests/agent-skill.test.ts`
 * runs this in --check mode and fails on any drift.
 *
 * Usage:
 *   node scripts/gen-agent-skill.ts            write the blocks + mirror
 *   node scripts/gen-agent-skill.ts --check    exit 1 if anything would change
 */
import {
  readFileSync,
  writeFileSync,
  readdirSync,
  mkdirSync,
  rmSync,
  existsSync,
  statSync,
} from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const skillDir = resolve(repoRoot, 'skills', 'lolly');
const mirrorDir = resolve(repoRoot, '.claude', 'skills', 'lolly');
const publicCatalog = resolve(repoRoot, 'brands', 'lolly-start', 'catalog', 'tools', 'index.json');
const communityDir = resolve(repoRoot, 'community');

const check = process.argv.includes('--check');

// ── Types (only the fields we read) ─────────────────────────────────────────
interface CatalogTool {
  id: string;
  name: string;
  category?: string;
  status?: string;
  description?: string;
  formats?: string[];
  requires?: string[];
  capabilities?: string[];
  listed?: boolean;
}
interface ManifestInput {
  id: string;
  urlKey?: string;
  type: string;
  default?: unknown;
  label?: string;
  section?: string;
  options?: { value: string; label?: string }[];
  fields?: ManifestInput[];
}
interface Manifest {
  id: string;
  inputs: ManifestInput[];
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf-8')) as T;
}

// ── Cell helpers ────────────────────────────────────────────────────────────
/** Escape a value for one markdown table cell: no pipes, no newlines. */
function cell(value: string): string {
  return value.replace(/\r?\n+/g, ' ').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
}

/** First sentence of a description, capped, for the tool table's Purpose column. */
function purpose(desc: string | undefined): string {
  if (!desc) return '';
  const flat = desc.replace(/\r?\n+/g, ' ').trim();
  const stop = flat.search(/\.(\s|$)/);
  const first = stop >= 0 ? flat.slice(0, stop + 1) : flat;
  return first.length > 120 ? `${first.slice(0, 117).trimEnd()}…` : first;
}

/** Render a default value for the input tables. */
function defaultCell(value: unknown): string {
  if (value === undefined) return '-';
  if (value === null) return 'null';
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  if (typeof value === 'string') {
    if (value === '') return '`""`';
    const flat = value.replace(/\r?\n+/g, '\\n');
    return `\`${flat.length > 32 ? `${flat.slice(0, 31)}…` : flat}\``;
  }
  if (Array.isArray(value)) return value.length ? '`[…]`' : '`[]`';
  return '`{…}`';
}

const list = (xs: string[] | undefined) => (xs?.length ? xs.join(', ') : '-');

// ── Generated blocks ────────────────────────────────────────────────────────
function toolTable(tools: CatalogTool[]): string {
  const head =
    '| ID | Name | Category | Formats | Requires | Capabilities | Purpose |\n' +
    '|---|---|---|---|---|---|---|';
  const rows = tools.map(
    (t) =>
      `| \`${t.id}\` | ${cell(t.name)} | ${t.category ?? '-'} | ${cell(list(t.formats))} | ` +
      `${cell(list(t.requires))} | ${cell(list(t.capabilities))} | ${cell(purpose(t.description))} |`
  );
  return [head, ...rows].join('\n');
}

function inputTable(inputs: ManifestInput[], opts: { section?: boolean } = {}): string {
  const withSection = opts.section ?? inputs.some((i) => i.section);
  const cols = withSection
    ? ['ID', 'Alias', 'Type', 'Default', 'Section', 'What it does']
    : ['ID', 'Alias', 'Type', 'Default', 'What it does'];
  const head = `| ${cols.join(' | ')} |\n|${cols.map(() => '---').join('|')}|`;
  const rows = inputs.map((i) => {
    const base = [
      `\`${i.id}\``,
      i.urlKey ? `\`${i.urlKey}\`` : '-',
      i.type,
      defaultCell(i.default),
    ];
    if (withSection) base.push(i.section ? cell(i.section) : '-');
    base.push(cell(i.label ?? ''));
    return `| ${base.join(' | ')} |`;
  });
  return [head, ...rows].join('\n');
}

// ── Marker replacement ──────────────────────────────────────────────────────
function replaceBlock(text: string, name: string, body: string): string {
  const open = `<!-- GEN:${name} -->`;
  const close = `<!-- /GEN:${name} -->`;
  const start = text.indexOf(open);
  const end = text.indexOf(close);
  if (start < 0 || end < 0 || end < start) {
    throw new Error(`gen-agent-skill: markers for "${name}" not found (open@${start} close@${end})`);
  }
  return `${text.slice(0, start + open.length)}\n${body}\n${text.slice(end)}`;
}

/** Apply every (block-name → body) edit to one skill file. Returns new text. */
function applyBlocks(file: string, blocks: Record<string, string>): string {
  let text = readFileSync(file, 'utf-8');
  for (const [name, body] of Object.entries(blocks)) text = replaceBlock(text, name, body);
  return text;
}

// ── Mirror ──────────────────────────────────────────────────────────────────
function walk(dir: string, base = dir): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    if (statSync(abs).isDirectory()) out.push(...walk(abs, base));
    else out.push(relative(base, abs));
  }
  return out;
}

// ── Main ────────────────────────────────────────────────────────────────────
const catalog = readJson<{ tools: CatalogTool[] }>(publicCatalog);
const tools = catalog.tools.slice().sort((a, b) => a.id.localeCompare(b.id));
const mainTools = tools.filter((t) => t.category !== 'utility');
const utilTools = tools.filter((t) => t.category === 'utility');

function manifest(id: string): Manifest {
  return readJson<Manifest>(resolve(communityDir, id, 'tool.json'));
}
const chart = manifest('chart');
const design = manifest('design');
const deck = manifest('deck-studio');
const designBoxes = design.inputs.find((i) => i.id === 'boxes');
const deckBlock = deck.inputs.find((i) => i.id === 'deck');
if (!designBoxes?.fields) throw new Error('gen-agent-skill: design boxes block/fields not found');
if (!deckBlock?.fields) throw new Error('gen-agent-skill: deck-studio deck block/fields not found');

// (file relative to skillDir) → { block name → generated body }
const edits: Record<string, Record<string, string>> = {
  'reference/tools.md': {
    'tools-main': toolTable(mainTools),
    'tools-utilities': toolTable(utilTools),
  },
  'reference/chart.md': {
    'chart-inputs': inputTable(chart.inputs, { section: true }),
  },
  'reference/design.md': {
    'design-inputs': inputTable(design.inputs.filter((i) => i.id !== 'boxes')),
    'design-boxes': inputTable(designBoxes.fields),
  },
  'reference/deck.md': {
    'deck-inputs': inputTable(deck.inputs.filter((i) => i.id !== 'deck')),
    'deck-block': inputTable(deckBlock.fields),
  },
};

let drift = false;
const report: string[] = [];

// 1) Rewrite the marked blocks in the source skill files.
for (const [rel, blocks] of Object.entries(edits)) {
  const file = resolve(skillDir, rel);
  const next = applyBlocks(file, blocks);
  const prev = readFileSync(file, 'utf-8');
  if (next !== prev) {
    drift = true;
    report.push(`  generated blocks differ: skills/lolly/${rel}`);
    if (!check) writeFileSync(file, next, 'utf-8');
  }
}

// 2) Mirror skills/lolly → .claude/skills/lolly, byte-for-byte.
const sourceFiles = walk(skillDir).sort();
for (const rel of sourceFiles) {
  const src = readFileSync(resolve(skillDir, rel), 'utf-8');
  const dstPath = resolve(mirrorDir, rel);
  const dst = existsSync(dstPath) ? readFileSync(dstPath, 'utf-8') : null;
  if (dst !== src) {
    drift = true;
    report.push(`  mirror out of date: .claude/skills/lolly/${rel}`);
    if (!check) {
      mkdirSync(resolve(dstPath, '..'), { recursive: true });
      writeFileSync(dstPath, src, 'utf-8');
    }
  }
}
// Remove any mirror file whose source is gone.
if (existsSync(mirrorDir)) {
  const sourceSet = new Set(sourceFiles);
  for (const rel of walk(mirrorDir)) {
    if (!sourceSet.has(rel)) {
      drift = true;
      report.push(`  stale mirror file: .claude/skills/lolly/${rel}`);
      if (!check) rmSync(resolve(mirrorDir, rel));
    }
  }
}

if (check && drift) {
  console.error('✗ agent skill is out of date. Run: node scripts/gen-agent-skill.ts');
  for (const line of report) console.error(line);
  process.exit(1);
}
if (!check) {
  console.log(
    drift
      ? `✓ agent skill regenerated (${report.length} file(s) updated)`
      : '✓ agent skill already up to date'
  );
}
