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
 *     renders defaults in silence;
 *   - the root skill routes diagram requests to reference/diagrams.md, whose decision
 *     tables, worked inputs, CLI flags and MCP tool names match the Diagrams manifest
 *     and the MCP server, and which publishes no render URL while the tool is
 *     experimental (the public render route answers 404 for the tool).
 *
 * Run directly: node --test tests/agent-skill.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseUrlState, RESERVED } from '../engine/src/url-mode.ts';
import { TOOL_DEFS } from '../services/mcp/src/tools.ts';
import { PRIVATE_FILE_TOOLS } from '../services/mcp/src/file-resources.ts';
import { validateDocument } from '../engine/src/document-api.ts';
import type { ToolManifest } from '../engine/src/loader.ts';
import { CLI_FLAGS } from '../shells/cli/src/run.ts';
import { GLOBAL_BOOL_FLAGS } from '../shells/cli/src/args.ts';
import { sharedBlocks } from '../scripts/lib/diagram-skill.ts';

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
  assert.ok(scoped?.[1], 'surfaces.md must describe the scoped file tools');
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

// ── Diagrams ────────────────────────────────────────────────────────────────
interface DiagramField { id: string; type?: string; options?: { value: string }[]; fields?: DiagramField[]; showIf?: unknown }
const diagramManifest = JSON.parse(
  readFileSync(resolve(ROOT, 'community', 'diagram-builder', 'tool.json'), 'utf-8')
) as { inputs: DiagramField[] };
const diagrams = () => skill('reference/diagrams.md');

test('the root skill routes diagram requests to reference/diagrams.md', () => {
  const root = skill('SKILL.md');
  const description = root.match(/^description: >-\n([\s\S]*?)\n---/m)?.[1] ?? '';
  assert.match(description, /\bdiagram\b/i, 'the skill description must trigger on diagram requests');
  assert.ok(root.includes('`reference/diagrams.md`'), 'SKILL.md must route diagram work to reference/diagrams.md');
  for (const ref of new Set([...root.matchAll(/`(reference\/[a-z-]+\.md)`/g)].map((m) => m[1]!))) {
    assert.ok(existsSync(resolve(ROOT, 'skills', 'lolly', ref)), `SKILL.md points at ${ref}, which does not exist`);
  }
});

test('the diagram decision tables use only what the Diagrams manifest declares', () => {
  const choose = sharedBlocks(diagrams())['diagram-choose'];
  assert.ok(choose, 'diagrams.md must hold the SHARE:diagram-choose block');
  const types = diagramManifest.inputs.find((i) => i.id === 'diagramType')!.options!.map((o) => o.value);
  const declared = new Set<string>(['sequenceDiagram']); // a Mermaid keyword, not a manifest value
  for (const input of diagramManifest.inputs) {
    declared.add(input.id);
    for (const o of input.options ?? []) declared.add(o.value);
    for (const f of input.fields ?? []) { declared.add(f.id); for (const o of f.options ?? []) declared.add(o.value); }
  }
  const routed = new Set<string>();
  for (const row of choose.split('\n').filter((l) => l.startsWith('| ') && !l.startsWith('| Explanation') && !l.startsWith('| Pattern'))) {
    const route = row.split(' | ')[1] ?? '';
    for (const [, token] of route.matchAll(/`([^`]+)`/g)) {
      assert.ok(declared.has(token!), `the decision table routes to \`${token}\`, which the Diagrams manifest does not declare`);
      if (types.includes(token!)) routed.add(token!);
    }
  }
  assert.deepEqual([...routed].sort(), [...types].sort(), 'the decision tables must route to every diagram type');
});

test('the worked diagram inputs validate and supply their own content', () => {
  const section = diagrams().split(/^## Worked inputs$/m)[1];
  assert.ok(section, 'diagrams.md has no "## Worked inputs" section');
  const examples = [...section.matchAll(/```json\n([\s\S]*?)```/g)].map((m) => JSON.parse(m[1]!) as Record<string, unknown>);
  assert.ok(examples.length >= 2, `expected at least two worked inputs, found ${examples.length}`);
  for (const inputs of examples) {
    const result = validateDocument({ kind: 'inputs', manifest: diagramManifest as unknown as ToolManifest, value: inputs });
    assert.deepEqual(result.errors, [], `worked input ${JSON.stringify(inputs).slice(0, 80)} does not validate`);
    assert.ok(typeof inputs.look === 'string', 'a worked input must set look, or it renders in Legacy');
    // The source's own content input, so the render never falls back to sample content.
    const content = inputs.source === 'visual' ? 'nodes' : diagramManifest.inputs.find((i) => (i.type === 'longtext')
      && JSON.stringify(i.showIf) === JSON.stringify({ source: inputs.source }))?.id;
    assert.ok(content && inputs[content] !== undefined, `the ${String(inputs.source)} worked input must supply ${content}`);
    if (inputs.source === 'visual') {
      const ids = new Set((inputs.nodes as { nodeId?: string }[]).map((n) => n.nodeId));
      for (const node of inputs.nodes as { nodeId?: string }[]) assert.ok(node.nodeId, 'every worked card needs a stable nodeId');
      for (const arrow of (inputs.arrows ?? []) as { from: string; to: string }[]) {
        assert.ok(ids.has(arrow.from) && ids.has(arrow.to), `worked connection ${arrow.from} -> ${arrow.to} points at a missing card`);
      }
    }
  }
});

test('every CLI flag and MCP tool the Diagrams guidance shows exists', () => {
  const known = new Set<string>([...RESERVED, ...CLI_FLAGS, ...GLOBAL_BOOL_FLAGS]);
  for (const input of diagramManifest.inputs) known.add(input.id);
  const mcp = new Set(TOOL_DEFS.map((t: { name: string }) => t.name));
  const pages = ['skills/lolly/reference/diagrams.md', 'community/diagram-builder/skill/workflow.md', 'community/diagram-builder/SKILL.md'];
  let runs = 0;
  for (const page of pages) {
    const text = readFileSync(resolve(ROOT, page), 'utf-8').replace(/\s+/g, ' ');
    for (const [, name] of text.matchAll(/\b(lolly_[a-z_]+)\b/g)) assert.ok(mcp.has(name!), `${page} shows ${name}, which the MCP server does not register`);
    for (const [cmd] of text.matchAll(/lolly run diagram-builder[^`|]*/g)) {
      runs++;
      for (const [, flag] of cmd.matchAll(/--([a-zA-Z][a-zA-Z-]*)/g)) {
        assert.ok(known.has(flag!), `${page}: "${cmd.trim()}" uses --${flag}, which is neither a Diagrams input nor a CLI flag`);
      }
    }
  }
  assert.ok(runs >= 2, `expected the Diagrams guidance to show lolly run diagram-builder, saw ${runs}`);
});

test('the Diagrams guidance publishes no render URL while the tool is experimental', () => {
  const catalog = JSON.parse(readFileSync(resolve(ROOT, 'brands', 'lolly-start', 'catalog', 'tools', 'index.json'), 'utf-8')) as { tools: { id: string; status?: string }[] };
  assert.equal(catalog.tools.find((t) => t.id === 'diagram-builder')?.status, 'experimental',
    'Diagrams is no longer experimental: revise "Where Diagrams runs" in skills/lolly/reference/diagrams.md, which says the public render route answers 404');
  const route = sharedBlocks(diagrams())['diagram-route'] ?? '';
  assert.match(route, /public render route/, 'diagrams.md must state the experimental route rule');
  assert.match(route, /404/, 'the route rule must say the public render route answers 404');
  for (const page of ['skills/lolly/reference/diagrams.md', 'community/diagram-builder/skill/workflow.md', 'community/diagram-builder/SKILL.md']) {
    const text = readFileSync(resolve(ROOT, page), 'utf-8');
    assert.doesNotMatch(text, /https?:\/\/\S*diagram-builder/, `${page} links to a Diagrams URL`);
    assert.doesNotMatch(text, /\/(?:tool|t)\/diagram-builder\.[a-z]/, `${page} shows a Diagrams render URL`);
  }
});
