// SPDX-License-Identifier: MPL-2.0
/**
 * The agent skill at skills/lolly/ (mirrored to .claude/skills/lolly/). This holds
 * three properties the skill's usefulness rests on:
 *
 *   - the generated tables are current: scripts/gen-agent-skill.ts --check exits 0,
 *     so the tool table and every input table match the public catalog and the
 *     manifests, and the .claude mirror matches the source;
 *   - surfaces.md names every MCP tool the server registers (TOOL_DEFS +
 *     PRIVATE_FILE_TOOLS), so an agent reading only the skill cannot miss one -
 *     in particular the validate-before-render tools the plan called out as drift;
 *   - every worked URL in url-mode.md parses through parseUrlState against its own
 *     tool's manifest with no unknown input, so a copied link is never a typo that
 *     renders defaults in silence.
 *
 * Run directly: node --test tests/agent-skill.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseUrlState, RESERVED } from '../engine/src/url-mode.ts';
import { TOOL_DEFS } from '../services/mcp/src/tools.ts';
import { PRIVATE_FILE_TOOLS } from '../services/mcp/src/file-resources.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const skill = (p: string) => readFileSync(resolve(ROOT, 'skills', 'lolly', p), 'utf-8');

test('generated tables and the .claude mirror are current', () => {
  // Throws (non-zero exit) if anything the generator owns has drifted.
  execFileSync(process.execPath, [resolve(ROOT, 'scripts', 'gen-agent-skill.ts'), '--check'], {
    cwd: ROOT,
    stdio: 'pipe',
  });
});

test('surfaces.md names every MCP tool the server registers', () => {
  const surfaces = skill('reference/surfaces.md');
  const tools = TOOL_DEFS.map((t: { name: string }) => t.name);
  const files = PRIVATE_FILE_TOOLS.map((t: { name: string }) => t.name);
  const names = [...tools, ...files];
  assert.equal(new Set(names).size, names.length, 'registered MCP tool names must be unique');
  const documentedTools = [...surfaces.matchAll(/^\| `(lolly_[a-z_]+)` \|/gm)].map(match => match[1]);
  assert.deepEqual(documentedTools.sort(), tools.sort(), 'MCP tool table must match the registered tools');
  const scoped = surfaces.match(/### Scoped file tools\n([\s\S]*?)\n### Resources/);
  assert.ok(scoped, 'surfaces.md must describe the scoped file tools');
  const documentedFiles = [...new Set([...scoped[1].matchAll(/`(files_[a-z_]+)`/g)].map(match => match[1]))];
  assert.deepEqual(documentedFiles.sort(), files.sort(), 'scoped file documentation must match the registered tools');
});

// Pull the worked links out of the single ```text block under "Ten worked links".
function workedUrls(): string[] {
  const md = skill('reference/url-mode.md');
  const anchor = md.indexOf('## Ten worked links');
  assert.ok(anchor >= 0, 'url-mode.md has no "Ten worked links" section');
  const fence = md.indexOf('```text', anchor);
  assert.ok(fence >= 0, 'url-mode.md worked-links block is not a ```text fence');
  const start = md.indexOf('\n', fence) + 1;
  const end = md.indexOf('```', start);
  return md
    .slice(start, end)
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('https://lolly.tools/'));
}

function toolIdOf(url: string): string {
  const m = url.match(/\/(?:tool|t)\/([a-z0-9][a-z0-9-]*)/);
  assert.ok(m?.[1], `no tool id in ${url}`);
  return m[1];
}
function queryOf(url: string): string {
  const i = url.indexOf('?');
  return i < 0 ? '' : url.slice(i + 1);
}

test('every worked URL parses with no unknown input', () => {
  const urls = workedUrls();
  assert.ok(urls.length >= 10, `expected at least 10 worked URLs, found ${urls.length}`);
  for (const url of urls) {
    const id = toolIdOf(url);
    const manifest = JSON.parse(
      readFileSync(resolve(ROOT, 'community', id, 'tool.json'), 'utf-8')
    ) as { inputs: { id: string; urlKey?: string; type?: string; fields?: { id: string }[] }[] };
    const known = new Set<string>();
    for (const inp of manifest.inputs) {
      known.add(inp.id);
      if (inp.urlKey) known.add(inp.urlKey);
      if (inp.type === 'vector' && inp.fields) for (const f of inp.fields) known.add(`${inp.id}.${f.id}`);
    }
    const query = queryOf(url);
    for (const [key] of new URLSearchParams(query)) {
      if (RESERVED.has(key) || key.startsWith('_') || key.startsWith('pkg.')) continue;
      assert.ok(known.has(key), `worked URL for "${id}" uses unknown input "${key}": ${url}`);
    }
    // The whole link must also parse without throwing.
    assert.doesNotThrow(() => parseUrlState(query, manifest as never), `parseUrlState threw for ${url}`);
  }
});
