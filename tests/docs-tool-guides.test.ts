// SPDX-License-Identifier: MPL-2.0
/**
 * Tool to docs (plan 354 D6). A page in docs/manifest.json lists the tools it guides
 * (`tools`: a tool id, or a tool id and one of the page's heading ids), and build:info
 * writes that list for each locale to tool-guides.json, which the tool's help button
 * reads. Checked here: every entry points at a public tool, and in every locale build
 * every row opens a page that exists, at a section that exists on that page. Headings take different
 * ids in each language, so a section is placed by its position in the English page; a
 * translation whose headings no longer line up with English fails here.
 *
 * Run directly:  node --test tests/docs-tool-guides.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readRegistry, DOCS_ROOT } from '../docs/navigation.ts';
import { LANGS } from '../engine/src/lang.ts';

const REGISTRY = readRegistry(DOCS_ROOT);
const ENTRIES = REGISTRY.pages.flatMap((page) => (page.tools ?? []).map((entry) => {
  const [tool, anchor = ''] = entry.split('#') as [string, string?];
  return { page: page.path, tool, anchor };
}));

/** The public tool packs: a public clone and CI have these and nothing else. */
const PACKS = ['community', 'brands/lolly-start/tools', 'brands/lolly-demo/tools'];
const toolExists = (id: string): boolean => PACKS.some((pack) => existsSync(join(DOCS_ROOT, pack, id, 'tool.json')));

test('the manifest maps tools to pages: QR Code first to its walkthrough, then to print units', () => {
  assert.ok(ENTRIES.length > 0, 'no page lists a tool');
  const qr = ENTRIES.filter((e) => e.tool === 'qr-code');
  assert.deepEqual(qr.map((e) => `${e.page}#${e.anchor}`), ['start/make-something#', 'create/exporting#size-and-print-units']);
});

test('every tool a page lists is a public tool', () => {
  const missing = [...new Set(ENTRIES.map((e) => e.tool))].filter((id) => !toolExists(id));
  assert.deepEqual(missing, [], 'a SUSE-only tool would vanish from a public clone; list public tools only');
});

// ─── the built locales ───────────────────────────────────────────────────────

const BUILT = join(DOCS_ROOT, 'shells/web/public/info');
const built = existsSync(join(BUILT, 'tool-guides.json')) ? false : 'no built /info on disk - run `pnpm run build:info`';

interface Row { p: string; a: string; t: string; h: string }
const guides = (dir: string): Record<string, Row[]> =>
  (JSON.parse(readFileSync(join(dir, 'tool-guides.json'), 'utf8')) as { tools: Record<string, Row[]> }).tools;

test('every manifest entry opens a real page and section in every locale build', { skip: built }, () => {
  const english = guides(BUILT);
  const expected = ENTRIES.length;
  const problems: string[] = [];
  for (const lang of LANGS) {
    const dir = lang === 'en' ? BUILT : join(BUILT, lang);
    if (!existsSync(join(dir, 'tool-guides.json'))) continue; // a build that left the locale out
    const local = guides(dir);
    const rows = Object.values(local).flat();
    if (rows.length !== expected) problems.push(`${lang}: ${rows.length} rows, the manifest has ${expected}`);
    for (const [tool, list] of Object.entries(local)) {
      list.forEach((row, n) => {
        const file = join(dir, `${row.p}.html`);
        if (!existsSync(file)) { problems.push(`${lang} ${tool}: no page ${row.p}`); return; }
        if (!row.t) problems.push(`${lang} ${tool}: ${row.p} has no title`);
        const enRow = english[tool]?.[n];
        if (enRow?.a && !row.a) problems.push(`${lang} ${tool}: ${row.p} lost its section (its headings differ from English)`);
        if (row.a && !readFileSync(file, 'utf8').includes(` id="${row.a}"`)) problems.push(`${lang} ${tool}: no #${row.a} on ${row.p}`);
      });
    }
  }
  assert.deepEqual(problems, []);
});
