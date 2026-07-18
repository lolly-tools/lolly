#!/usr/bin/env node
/**
 * README "Current tools" generator.
 *
 * Run as: npm run build:readme-tools  (or directly: node scripts/build-readme-tools.ts)
 *
 * Regenerates the count sentence + tool table between the
 * `<!-- tools-table:start -->` / `<!-- tools-table:end -->` markers in
 * README.md from `catalog/tools/index.json` — the ACTIVE-profile view, so the
 * table reflects whatever `npm run profile:<name>` last built. The table lists
 * LISTED tools only (alphabetical); unlisted helpers are called out in the
 * sentence, mirroring how the section was hand-maintained before it was
 * generated. Idempotent: a second run is a byte-identical no-op.
 */
import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const README_PATH = join(ROOT, 'README.md');
const INDEX_PATH = join(ROOT, 'catalog/tools/index.json');
const START_MARK = '<!-- tools-table:start -->';
const END_MARK = '<!-- tools-table:end -->';

interface IndexEntry {
  id: string;
  name?: string;
  description?: string;
  listed?: boolean;
}

function fail(msg: string): never {
  console.error(`build-readme-tools: ${msg}`);
  process.exit(1);
}

// Markdown-table-safe cell text: no pipes, no newlines.
function cell(s: string): string {
  return s.replace(/\s+/g, ' ').replace(/\|/g, '\\|').trim();
}

/** The active profile's human label ("SUSE"), resolved by matching the
 *  catalog/ view against profiles.json's catalog paths. */
function activeCatalogLabel(): string {
  try {
    const profiles = JSON.parse(readFileSync(join(ROOT, 'profiles.json'), 'utf8')) as {
      profiles?: Record<string, { label?: string; catalog?: string }>;
    };
    const real = realpathSync(join(ROOT, 'catalog'));
    for (const p of Object.values(profiles.profiles ?? {})) {
      if (p.catalog && realpathSync(join(ROOT, p.catalog)) === real) return p.label ?? 'active';
    }
  } catch {
    /* fall through — a missing/odd profiles.json never blocks the README build */
  }
  return 'active';
}

if (!existsSync(INDEX_PATH)) {
  fail(
    'catalog/tools/index.json not found — the catalog view is not built. ' +
      'Run `npm run profile` (postinstall builds it) or `npm run build:catalog` first.',
  );
}

const index = JSON.parse(readFileSync(INDEX_PATH, 'utf8')) as { tools?: IndexEntry[] };
const tools = index.tools ?? [];
if (tools.length === 0) fail('catalog/tools/index.json has no tools — refusing to write an empty table.');

const listed = tools.filter(t => t.listed !== false).sort((a, b) => (a.name ?? a.id).localeCompare(b.name ?? b.id, 'en'));
const unlisted = tools.filter(t => t.listed === false).sort((a, b) => (a.name ?? a.id).localeCompare(b.name ?? b.id, 'en'));

const label = activeCatalogLabel();
const unlistedClause =
  unlisted.length === 0
    ? ', all listed in the gallery'
    : ` — ${listed.length} listed in the gallery, plus ${unlisted.length === 1 ? 'one unlisted helper' : `${unlisted.length} unlisted helpers`} (${unlisted.map(t => t.name ?? t.id).join(', ')})`;
const sentence = `The ${label} catalog ships **${tools.length} tools** today${unlistedClause}. Generated from \`catalog/tools/index.json\` by \`npm run build:readme-tools\`:`;

const table = [
  '| Tool | What it makes |',
  '|---|---|',
  ...listed.map(t => `| ${cell(t.name ?? t.id)} | ${cell(t.description ?? '')} |`),
].join('\n');

const readme = readFileSync(README_PATH, 'utf8');
const start = readme.indexOf(START_MARK);
const end = readme.indexOf(END_MARK);
if (start < 0 || end < 0) fail(`README.md is missing the ${START_MARK} / ${END_MARK} markers.`);
if (end < start) fail('README.md has the tools-table markers in the wrong order.');

const next =
  readme.slice(0, start + START_MARK.length) + '\n' + sentence + '\n\n' + table + '\n' + readme.slice(end);

if (next === readme) {
  console.log(`README.md tools section already current (${tools.length} tools, ${listed.length} listed).`);
} else {
  writeFileSync(README_PATH, next);
  console.log(`README.md tools section regenerated (${tools.length} tools, ${listed.length} listed, ${unlisted.length} unlisted).`);
}
