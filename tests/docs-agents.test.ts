// SPDX-License-Identifier: MPL-2.0
/**
 * The agent-facing set beside /info/llms.txt - llms-full.txt, agents.md, openapi.json
 * and the /.well-known/lolly.json discovery record (docs/agents-pages.ts). Pure
 * builders, so this pins them without building the site, and it holds the facts they
 * state to the code that answers the requests:
 *
 *   - the render route's format list and MIME table match services/mcp/src/render.ts
 *     (TIER_A + png, mimeForFormat), so the OpenAPI description cannot drift from the
 *     server;
 *   - the MCP tool names match services/mcp/src/tools.ts TOOL_DEFS;
 *   - every root alias the files advertise (/agents.md, /llms.txt, …) is a rewrite in
 *     vercel.json, placed before the SPA catch-all that would otherwise swallow it;
 *   - llms-full.txt carries every page with a twin exactly once, in llms.txt order;
 *   - the prose passes the docs vernacular gate (no em dash, no banned phrase).
 *
 * Run directly: node --test tests/docs-agents.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildAgentDocs, buildAgentsMd, buildLlmsFullTxt, buildOpenApi, buildWellKnown,
  AGENT_FILES, ROOT_ALIASES, RENDER_GET_FORMATS, RENDER_GET_MIME, RENDER_GET_TEXT, MCP_TOOLS, MCP_RESOURCES,
  type AgentDocsOpts,
} from '../docs/agents-pages.ts';
import { TIER_A, mimeForFormat, isTextFormat } from '../services/mcp/src/render.ts';
import { TOOL_DEFS } from '../services/mcp/src/tools.ts';
import { RESOURCES, RESOURCE_TEMPLATES } from '../services/mcp/src/resources.ts';
import { BANNED_PHRASES } from '../scripts/check-docs-vernacular.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const URL = 'https://lolly.tools';

const pages: AgentDocsOpts['pages'] = [
  { slug: 'index', title: 'Lolly', pathway: 'quickstart', path: 'index', isLanding: true },
  { slug: 'quickstart', title: 'Quickstart', pathway: 'quickstart', path: 'start/quickstart' },
  { slug: 'exporting', title: 'Exporting & Formats', pathway: 'creators', path: 'create/exporting' },
  { slug: 'url-mode', title: 'URL Mode', pathway: 'builders', path: 'build/url-mode' },
  { slug: 'mcp', title: 'MCP Server', pathway: 'builders', path: 'build/mcp' },
  { slug: 'ai-agents', title: 'AI Agents', pathway: 'builders', path: 'build/ai-agents' },
  { slug: 'cli', title: 'CLI', pathway: 'builders', path: 'build/cli' },
  { slug: 'authoring-tools', title: 'Authoring Tools', pathway: 'builders', path: 'build/authoring-tools' },
  { slug: 'privacy', title: 'Privacy Policy', pathway: 'trust', path: 'trust/privacy' },
  // A registered page whose source could not be read has no twin - it must not appear.
  { slug: 'ghost', title: 'Ghost', pathway: 'operators', path: 'operate/ghost' },
];
const mdBySlug = new Map(pages.filter((p) => p.slug !== 'ghost').map((p) => [p.slug, `# ${p.title}\n\nBody of ${p.slug}.\n`]));
const opts: AgentDocsOpts = {
  url: URL,
  description: 'Lolly: a test description.',
  engineVersion: '9.9.9',
  pages,
  mdBySlug,
  sections: [
    { pathway: 'quickstart', label: 'Quickstart' },
    { pathway: 'creators', label: 'For Creators' },
    { pathway: 'builders', label: 'For Builders' },
    { pathway: 'operators', label: 'For Operators' },
    { pathway: 'trust', label: 'Trust' },
  ],
};

// ── the facts, held to the code ───────────────────────────────────────────────

test('the render route formats are TIER_A plus png, in a stable order', () => {
  assert.deepEqual(new Set(RENDER_GET_FORMATS), new Set([...TIER_A, 'png']));
  assert.equal(new Set(RENDER_GET_FORMATS).size, RENDER_GET_FORMATS.length, 'no duplicates');
});

test('the MIME table matches mimeForFormat for every render-route format', () => {
  for (const f of RENDER_GET_FORMATS) {
    assert.equal(RENDER_GET_MIME[f], mimeForFormat(f), `mime for ${f}`);
  }
  assert.deepEqual(Object.keys(RENDER_GET_MIME).sort(), [...RENDER_GET_FORMATS].sort(), 'one MIME per format, no extras');
});

test('the MCP tool and resource names match the server', () => {
  assert.deepEqual([...MCP_TOOLS], TOOL_DEFS.map((t) => t.name));
  const served = [...RESOURCES.map((r) => r.uri), ...RESOURCE_TEMPLATES.map((r) => r.uriTemplate)];
  assert.deepEqual([...MCP_RESOURCES].sort(), served.sort());
});

test('every root alias is a vercel.json rewrite placed before the SPA catch-all', () => {
  const vercel = JSON.parse(readFileSync(resolve(ROOT, 'vercel.json'), 'utf8')) as { rewrites: Array<{ source: string; destination: string }> };
  const catchAll = vercel.rewrites.findIndex((r) => r.destination === '/index.html');
  assert.ok(catchAll >= 0, 'the SPA catch-all rewrite exists');
  for (const alias of ROOT_ALIASES) {
    const i = vercel.rewrites.findIndex((r) => r.source === alias.source);
    assert.ok(i >= 0, `vercel.json has no rewrite for ${alias.source}`);
    assert.equal(vercel.rewrites[i]!.destination, alias.destination, `destination for ${alias.source}`);
    assert.ok(i < catchAll, `${alias.source} must precede the catch-all or the app shell answers it`);
  }
  // Every alias points at a file the build emits (llms.txt is the existing one).
  const emitted = new Set([...Object.values(AGENT_FILES), 'llms.txt'].map((f) => `/info/${f}`));
  for (const alias of ROOT_ALIASES) assert.ok(emitted.has(alias.destination), `${alias.destination} is not a build output`);
});

test('the shells/web .gitignore covers every generated agent file', () => {
  const ignore = readFileSync(resolve(ROOT, 'shells/web/.gitignore'), 'utf8');
  for (const f of Object.values(AGENT_FILES)) {
    const covered = ignore.includes(`public/info/${f}`) || (f.endsWith('.md') && ignore.includes('public/info/*.md'));
    assert.ok(covered, `public/info/${f} is a build output and must be gitignored`);
  }
});

// ── llms-full.txt ─────────────────────────────────────────────────────────────

test('llms-full.txt carries each twinned page once, landing first, then llms.txt order', () => {
  const txt = buildLlmsFullTxt(opts);
  const heads = [...txt.matchAll(/^# (.+)$/gm)].map((m) => m[1]).slice(1); // drop the file's own title
  // Each twin keeps its own H1 and is headed exactly once.
  assert.deepEqual(heads, ['Lolly', 'Quickstart', 'Exporting & Formats', 'URL Mode', 'MCP Server', 'AI Agents', 'CLI', 'Authoring Tools', 'Privacy Policy']);
  const bare = buildLlmsFullTxt({ ...opts, mdBySlug: new Map([['cli', 'No heading here.\n']]) });
  assert.ok(bare.includes('# CLI\n\nNo heading here.'), 'a twin without an H1 gets the page title');
  assert.ok(!txt.includes('Ghost'), 'a page without a twin is skipped, as llms.txt skips it');
  assert.ok(txt.includes(`Source: ${URL}/info/build/url-mode.md`));
  assert.ok(txt.includes(`Page: ${URL}/info/build/url-mode.html`));
  assert.ok(txt.includes('Body of url-mode.'));
  assert.equal(txt.split('Body of mcp.').length, 2, 'each body appears exactly once');
});

// ── agents.md ─────────────────────────────────────────────────────────────────

test('agents.md names every entry point and the three ways to get bytes', () => {
  const md = buildAgentsMd(opts);
  for (const alias of ROOT_ALIASES) assert.ok(md.includes(`${URL}${alias.source}`), `agents.md must point at ${alias.source}`);
  for (const must of [
    `${URL}/info/capabilities.json`, `${URL}/catalog/tools/index.json`, `${URL}/tools/{id}/tool.json`,
    `GET ${URL}/tool/{id}.{ext}?{inputs}`, 'https://mcp.lolly.tools/mcp', `${URL}/api/mcp`,
    'lolly install-browser', '`_v`', 'lolly://assets', `${URL}/info/build/url-mode.md`,
  ]) assert.ok(md.includes(must), `agents.md must mention ${must}`);
  for (const t of MCP_TOOLS) assert.ok(md.includes(`\`${t}\``), `agents.md must list ${t}`);
  // The doored path comes from the pages registry, never a guessed door.
  assert.ok(md.includes(`${URL}/info/build/mcp.md`));
});

test('the generated prose passes the docs vernacular gate', () => {
  const md = buildAgentsMd(opts);
  const full = buildLlmsFullTxt(opts);
  for (const [name, text] of [['agents.md', md], ['llms-full.txt header', full.slice(0, full.indexOf('---'))]] as const) {
    assert.ok(!/—/.test(text), `${name}: no em dash`);
    for (const { what, re } of BANNED_PHRASES) {
      assert.ok(!re.test(text), `${name}: banned phrase ${what}`);
    }
  }
});

// ── openapi.json ──────────────────────────────────────────────────────────────

test('openapi.json is 3.1 and describes the render route from the same facts', () => {
  const api = buildOpenApi(opts) as {
    openapi: string; info: { version: string; license: { identifier: string } }; servers: Array<{ url: string }>;
    paths: Record<string, { get?: { parameters: Array<{ name: string; in: string; schema: { enum?: string[] } }>; responses: Record<string, { content?: Record<string, unknown> }> } }>;
  };
  assert.equal(api.openapi, '3.1.0');
  assert.equal(api.info.version, '9.9.9');
  assert.equal(api.info.license.identifier, 'MPL-2.0');
  for (const s of api.servers) assert.match(s.url, /^https:\/\//);
  const render = api.paths['/tool/{id}.{ext}']!.get!;
  const ext = render.parameters.find((p) => p.name === 'ext' && p.in === 'path')!;
  assert.deepEqual(ext.schema.enum, [...RENDER_GET_FORMATS]);
  const ok = render.responses['200']!.content!;
  for (const f of RENDER_GET_FORMATS) assert.ok(ok[mimeForFormat(f)], `200 response lists ${mimeForFormat(f)}`);
  for (const code of ['304', '400', '404', '429', '500']) assert.ok(render.responses[code], `documents ${code}`);
  for (const path of ['/catalog/tools/index.json', '/tools/{id}/tool.json', '/info/capabilities.json', '/.well-known/lolly.json', '/api/mcp', '/.well-known/oauth-authorization-server', '/.well-known/oauth-protected-resource']) {
    assert.ok(api.paths[path], `describes ${path}`);
  }
});

test('the text-format list matches isTextFormat, so the response schemas follow the server', () => {
  assert.deepEqual([...RENDER_GET_TEXT].sort(), RENDER_GET_FORMATS.filter((f) => isTextFormat(f)).sort());
  const api = buildOpenApi(opts) as { paths: Record<string, { get: { responses: Record<string, { content: Record<string, { schema: { format?: string } }> }> } }> };
  const ok = api.paths['/tool/{id}.{ext}']!.get.responses['200']!.content;
  for (const f of RENDER_GET_FORMATS) {
    const binary = ok[mimeForFormat(f)]!.schema.format === 'binary';
    assert.equal(binary, !isTextFormat(f), `${f}: binary iff not a text format`);
  }
});

// ── well-known ────────────────────────────────────────────────────────────────

test('the discovery record points every URL at the site (or the MCP host) and lists the render formats', () => {
  const wk = buildWellKnown(opts) as Record<string, unknown> & { render: { formats: string[] }; mcp: Record<string, unknown> };
  const walk = (v: unknown): string[] => typeof v === 'string' ? [v] : Array.isArray(v) ? v.flatMap(walk) : v && typeof v === 'object' ? Object.values(v).flatMap(walk) : [];
  const urls = walk(wk).filter((s) => /^https?:\/\//.test(s));
  assert.ok(urls.length >= 15, 'a real record has many URLs');
  for (const s of urls) {
    assert.ok(s.startsWith(URL) || s.startsWith('https://mcp.lolly.tools/') || s.startsWith('https://github.com/lolly-tools/') || s === 'https://lolly.art', `unexpected host in ${s}`);
  }
  assert.deepEqual(wk.render.formats, [...RENDER_GET_FORMATS]);
  assert.equal(wk.engine, '9.9.9');
  assert.equal(wk.license, 'MPL-2.0');
  for (const alias of ROOT_ALIASES.filter((a) => a.source !== '/.well-known/lolly.json')) {
    assert.ok(urls.includes(`${URL}${alias.source}`), `record links ${alias.source}`);
  }
});

test('buildAgentDocs emits exactly the four files, as text, all non-empty', () => {
  const docs = buildAgentDocs(opts);
  assert.deepEqual(Object.keys(docs).sort(), Object.values(AGENT_FILES).sort());
  for (const [f, text] of Object.entries(docs)) {
    assert.ok(text.length > 200, `${f} is not empty`);
    if (f.endsWith('.json')) JSON.parse(text);
  }
});
