// SPDX-License-Identifier: MPL-2.0
/**
 * engineVersion enforcement in loadTool (P0-3).
 *
 * Tools sync to clients as data, ahead of the binary. A tool that declares it
 * needs a newer engine than the running build must be REFUSED — not warned, not
 * half-loaded to call a method that isn't there and die on a binary with no
 * update path. This proves loadTool refuses out-of-range manifests (before it
 * even fetches the template) and accepts in-range ones.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { loadTool, ToolLoadError } from '../engine/src/loader.ts';
import { ENGINE_VERSION } from '../engine/src/version.ts';
import { satisfiesRange } from '../engine/src/semver-range.ts';

function manifest(engineVersion: string): object {
  return {
    id: 'demo',
    name: 'Demo',
    version: '1.0.0',
    engineVersion,
    status: 'official',
    render: { width: 10, height: 10, formats: ['svg'] },
    inputs: [],
  };
}

/** fetchFile serving tool.json (+ template) for a given engineVersion range. */
function makeFetchFile(engineVersion: string, opts: { withTemplate?: boolean } = {}) {
  const files: Record<string, string> = {
    'demo/tool.json': JSON.stringify(manifest(engineVersion)),
  };
  if (opts.withTemplate !== false) files['demo/template.html'] = '<div>hi</div>';
  return async (path: string): Promise<string> => {
    const text = files[path];
    if (text === undefined) throw new Error(`404: ${path}`);
    return text;
  };
}

test('sanity: the running engine satisfies the ranges every shipping tool uses', () => {
  for (const range of ['^1.0.0', '^1.3.0', '^1.12.0', '^1.17.0']) {
    assert.equal(satisfiesRange(ENGINE_VERSION, range), true, range);
  }
});

test('loadTool accepts a tool whose engineVersion range includes this engine', async () => {
  const tool = await loadTool('demo', makeFetchFile('^1.0.0'));
  assert.equal(tool.manifest.id, 'demo');
});

test('loadTool REFUSES a tool that requires a newer engine (hard error)', async () => {
  await assert.rejects(
    loadTool('demo', makeFetchFile('^99.0.0')),
    (err: unknown) => {
      assert.ok(err instanceof ToolLoadError);
      assert.match((err as Error).message, /requires engine \^99\.0\.0/);
      assert.match((err as Error).message, /refusing to load/);
      return true;
    },
  );
});

test('loadTool REFUSES a tilde range that excludes this engine', async () => {
  // ~1.30.0 = >=1.30.0 <1.31.0 — excludes the current 1.5x line.
  await assert.rejects(loadTool('demo', makeFetchFile('~1.30.0')), ToolLoadError);
});

test('the engineVersion refusal happens BEFORE the template is fetched', async () => {
  // fetchFile has no template.html, so a load that proceeded to fetch it would
  // throw "404: demo/template.html". Getting the engineVersion error instead
  // proves the check short-circuits before any file fetch beyond the manifest.
  await assert.rejects(
    loadTool('demo', makeFetchFile('^99.0.0', { withTemplate: false })),
    (err: unknown) => {
      assert.match((err as Error).message, /requires engine/);
      assert.doesNotMatch((err as Error).message, /404/);
      return true;
    },
  );
});
