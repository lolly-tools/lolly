// SPDX-License-Identifier: MPL-2.0
/**
 * The /info/llms.txt Formats section (plan 116 workstream A, priority 3). The
 * section body is built by a pure function (llmsFormatsSection over the register),
 * so this test pins it without building the site: the heading is present, it names
 * the machine-readable capabilities.json, and it lists exactly one line per
 * register format. That count is the same bijection the drift test guards, checked
 * here from the llms.txt side so a dropped or added format is caught in the agent
 * index too.
 *
 * Run directly: node --test tests/docs-llms.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { llmsFormatsSection, type FmtCatalog } from '../docs/formats-pages.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const catalog = JSON.parse(readFileSync(resolve(ROOT, 'docs/site/formats-catalog.json'), 'utf8')) as FmtCatalog;
const section = llmsFormatsSection(catalog, { url: 'https://lolly.tools' });

test('the Formats section exists with its heading', () => {
  assert.match(section, /^## Formats$/m, 'the section must open with a "## Formats" heading');
});

test('the section references the machine-readable capabilities.json', () => {
  assert.match(section, /https:\/\/lolly\.tools\/info\/capabilities\.json/,
    'an agent must be pointed at capabilities.json instead of scraping');
});

test('the section points at the curated convert pages', () => {
  assert.match(section, /\/info\/convert\//, 'the section must mention the convert pages');
});

test('the section lists exactly one line per register format', () => {
  const lines = section.split('\n').filter((l) => /^- \[/.test(l));
  assert.equal(lines.length, catalog.formats.length,
    `expected one Formats line per register format (${catalog.formats.length}), got ${lines.length}`);
  // Every line links a per-format side-door directory URL.
  for (const l of lines) {
    assert.match(l, /\]\(https:\/\/lolly\.tools\/info\/formats\/[a-z0-9-]+\/\):/, `malformed Formats line: ${l}`);
  }
});

test('every writable format states its metadata claims on its line', () => {
  // plans/144 O1: an agent reading llms.txt must see what Lolly writes into a
  // format's own metadata containers, not just that it writes the format. The
  // claims ride INLINE on the existing line, so the one-line-per-format count
  // above still holds.
  const lines = section.split('\n').filter((l) => /^- \[/.test(l));
  const missing: string[] = [];
  for (const f of catalog.formats) {
    if (f.dir === 'in') continue;
    const line = lines.find((l) => l.includes(`/info/formats/${f.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}/`))
      ?? lines.find((l) => l.startsWith(`- [${f.name}](`));
    if (!line) { missing.push(`${f.token}: no line`); continue; }
    if (!/Metadata: reads .+; writes .+; round trip (full|partial|none|n\/a)\./.test(line)) {
      missing.push(`${f.token}: no metadata claim on its line`);
    }
  }
  assert.deepEqual(missing, [], 'Every export and round-trip format needs its metadata block in llms.txt.');
});

test('the expected format count is a real number, not zero', () => {
  // A guard against a register that silently emptied: llms.txt must not ship a
  // Formats heading over nothing.
  assert.ok(catalog.formats.length >= 40, `the register should list dozens of formats (found ${catalog.formats.length})`);
});
