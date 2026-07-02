// SPDX-License-Identifier: MPL-2.0
// Tool-local ESM hook modules (finding 9): a tool may declare
// `hooks.module: true` and ship hooks.js as a standard ES module with named
// exports, free to import sibling files — instead of a single new Function()
// mini-engine. These tests drive the real loader + runtime path with a module
// written to disk and imported via file:// URLs, exactly like the CLI shell.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';
import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';

const MANIFEST = {
  id: 'esm-demo',
  name: 'ESM Demo',
  version: '1.0.0',
  engineVersion: '^1.0.0',
  status: 'official',
  render: { width: 100, height: 100, formats: ['png'] },
  inputs: [{ id: 'title', type: 'text', default: 'hi' }],
  hooks: { onInit: true, module: true },
};

function writeFixtureTool(): string {
  const dir = mkdtempSync(join(tmpdir(), 'lolly-esm-'));
  const toolDir = join(dir, 'esm-demo');
  mkdirSync(join(toolDir, 'lib'), { recursive: true });
  writeFileSync(join(toolDir, 'tool.json'), JSON.stringify(MANIFEST));
  writeFileSync(join(toolDir, 'template.html'), '<h1>{{title}}</h1><p>{{shout}}</p>');
  // The entry imports a sibling module — the whole point of ESM hooks.
  writeFileSync(join(toolDir, 'hooks.js'),
    "import { shout } from './lib/shout.js';\n" +
    'export function onInit({ model }) {\n' +
    "  const title = model.find(i => i.id === 'title');\n" +
    "  return { shout: shout(title ? String(title.value) : '') };\n" +
    '}\n');
  writeFileSync(join(toolDir, 'lib', 'shout.js'),
    "export const shout = (s) => s.toUpperCase() + '!';\n");
  return dir;
}

function fixtureLoaders(dir: string) {
  return {
    fetchFile: (path: string) => readFile(join(dir, path), 'utf8'),
    resolveModuleUrl: (path: string) => pathToFileURL(join(dir, path)).href,
  };
}

test('loadTool records a hooks module URL instead of fetching source', async () => {
  const dir = writeFixtureTool();
  try {
    const { fetchFile, resolveModuleUrl } = fixtureLoaders(dir);
    const tool = await loadTool('esm-demo', fetchFile, { resolveModuleUrl });
    assert.equal(tool.hooksSource, null);
    assert.ok(tool.hooksUrl);
    assert.ok(tool.hooksUrl.startsWith('file://'));
    assert.ok(tool.hooksUrl.endsWith('esm-demo/hooks.js'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('module hooks run through the runtime: onInit patch from a sibling import', async () => {
  const dir = writeFixtureTool();
  try {
    const { fetchFile, resolveModuleUrl } = fixtureLoaders(dir);
    const tool = await loadTool('esm-demo', fetchFile, { resolveModuleUrl });
    const host = {
      version: '1',
      profile: { get: async () => ({}) },
      log: () => {},
    };
    const rt = await createRuntime(tool, host, { title: 'hello' });
    assert.equal(rt.hookErrors.length, 0, JSON.stringify(rt.hookErrors));
    assert.match(rt.getHydrated(), /HELLO!/); // extras.shout, computed via ./lib/shout.js
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('declaring hooks.module without a host resolver fails loudly, not silently', async () => {
  const dir = writeFixtureTool();
  try {
    const { fetchFile } = fixtureLoaders(dir);
    await assert.rejects(
      () => loadTool('esm-demo', fetchFile),
      /module hooks/i,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
