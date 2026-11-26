// SPDX-License-Identifier: MPL-2.0
/**
 * `render.when` and the shells that are not the web shell (engine 1.356).
 *
 * The CLI, the terminal app and the MCP server draw a tool the same way whatever
 * `render.export`, `render.webPreview` and `render.actions` hold: those three keys
 * choose web chrome, and a tool with `export: false` still renders from a terminal.
 * So a mode flag such as `--mode=scan` cannot make one of these shells export where
 * the default mode refuses, or refuse where the default mode exports.
 *
 * That stays true only while none of them reads the three keys from the manifest
 * block. The first half of this file pins that: a new read fails here, and the fix is
 * to read the block in effect (`runtime.getRender()`, or `resolveRender(render,
 * values)` from the engine), never `manifest.render` alone. The second half runs the
 * CLI's own path from argv to a runtime.
 *
 * Run directly: node --test tests/render-when-shells.test.ts
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createRuntime, loadTool, parseUrlState, resolveRender } from '../engine/src/index.ts';
import type { HostV1 } from '../engine/src/bridge/host-v1.ts';
import { isFileTransform } from '../packages/node-shell/src/transform-tool.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SHELL_ROOTS = ['shells/cli/src', 'shells/cli/bin', 'shells/tui/src', 'services/mcp/src', 'packages/node-shell/src'];

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules') continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...sources(path));
    else if (/\.ts$/.test(entry) && !/\.test\.ts$/.test(entry)) out.push(path);
  }
  return out;
}

/** A read of one of the three keys off a `render` block: `render.export`, `render?.actions`, `render.webPreview`. */
const FLAG_READ = /\brender\??\.(export|webPreview|actions)\b(?!\s*\()/g;
/** Reads that are known and do not depend on a mode, each with the reason. */
const KNOWN: Record<string, string> = {
  // An explicit `export: true` marks a tool that renders stills beside its exportFile
  // hook. It routes a whole tool before any value is read, and `when.set` is not a
  // place to declare that routing.
  'packages/node-shell/src/transform-tool.ts': 'export',
};

test('no terminal or server shell reads export, webPreview or actions from the manifest block', () => {
  const found: string[] = [];
  for (const root of SHELL_ROOTS) {
    for (const file of sources(join(ROOT, root))) {
      const rel = relative(ROOT, file);
      const code = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
      for (const match of code.matchAll(FLAG_READ)) {
        if (KNOWN[rel] === match[1]) continue;
        found.push(`${rel}: render.${match[1]}`);
      }
    }
  }
  assert.deepEqual(found, [], 'read the block in effect (runtime.getRender() or resolveRender), so a tool with render.when is honoured');
});

test('the one known read routes a whole tool and ignores `when`', () => {
  assert.equal(isFileTransform({ hooks: { exportFile: true }, render: { export: false } }), true);
  assert.equal(isFileTransform({ hooks: { exportFile: true }, render: { export: true } }), false);
  assert.equal(isFileTransform({ hooks: {}, render: { export: false } }), false);
});

// ── the CLI's path: argv pairs are URL mode, URL mode makes the values ──────────

const manifest = {
  id: 'two-modes', name: 'Two modes', version: '1.0.0', engineVersion: '>=1.356.0', status: 'community',
  render: {
    formats: ['svg'], width: 120, height: 40, actions: ['copy', 'download', 'save'],
    when: { input: 'mode', value: 'scan', set: { export: false, webPreview: true, actions: [] } },
  },
  inputs: [
    { id: 'mode', type: 'select', default: 'make', options: [{ value: 'make', label: 'Make' }, { value: 'scan', label: 'Scan' }] },
    { id: 'title', type: 'text', default: 'Hello' },
  ],
};
const host = {
  version: '1', shell: 'cli', capabilities: [], log: () => {}, profile: { get: async () => ({}) },
  assets: { get: async () => null, query: async () => [] }, state: { load: async () => null, save: async () => {}, list: async () => [] },
  clipboard: {}, export: {},
} as unknown as HostV1;

/** `--mode=scan --title=Hi` as the CLI hands flags on: the same query the web shell parses. */
async function cli(...flags: string[]) {
  const query = flags.map((flag) => flag.replace(/^--/, '')).join('&');
  const tool = await loadTool('two-modes', async (path) => {
    if (path.endsWith('tool.json')) return JSON.stringify(manifest);
    if (path.endsWith('template.html')) return '<svg xmlns="http://www.w3.org/2000/svg"><text>{{mode}}:{{title}}</text></svg>';
    throw new Error('No optional source');
  });
  const runtime = await createRuntime(tool, host, parseUrlState(query, tool.manifest).values);
  return { tool, runtime };
}

test('a mode flag reaches the block in effect, and the tool draws in either mode', async () => {
  const make = await cli('--title=Hi');
  assert.equal(make.runtime.getRender(), make.tool.manifest.render);
  assert.match(make.runtime.getHydrated(), /make:Hi/);

  const scan = await cli('--mode=scan', '--title=Hi');
  assert.equal(scan.runtime.getRender().export, false);
  assert.deepEqual(scan.runtime.getRender().actions, []);
  assert.match(scan.runtime.getHydrated(), /scan:Hi/, 'a mode with export:false still renders from a terminal');
  // With no runtime, the same answer from the manifest and the parsed values.
  assert.equal(resolveRender(scan.tool.manifest.render, { mode: 'scan' }).export, false);
  // The format list and the size are the tool's in both modes.
  assert.deepEqual(scan.runtime.getRender().formats, make.runtime.getRender().formats);
  assert.equal(scan.runtime.getRender().width, 120);
});

test('a value the block is not keyed on leaves the default in effect', async () => {
  const other = await cli('--mode=nonsense');
  assert.equal(other.runtime.getRender(), other.tool.manifest.render);
});
