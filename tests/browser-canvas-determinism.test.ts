// SPDX-License-Identifier: MPL-2.0
/**
 * The scoped Chromium that renders exports for the CLI, the TUI and the MCP server draws
 * every 2D canvas on the CPU (packages/node-shell/src/canvas-launch.ts).
 *
 * An export draws the page into a canvas and encodes that canvas. On the accelerated
 * canvas the pixels depended on what the GPU process had drawn before, so the same
 * render gave different PNG bytes from run to run, a few edge pixels one step apart.
 * The PNG encoder itself gives the same bytes for the same pixels.
 * `node scripts/probe-canvas-determinism.ts` measures both in a real browser; this file
 * pins the flag without starting one.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CPU_CANVAS_ARGS } from '../packages/node-shell/src/canvas-launch.ts';
import { chromiumLaunchArgs, chromiumLaunchOptions } from '../packages/node-shell/src/browsers.ts';
import { browserLaunchArgs, browserLaunchOptions } from '../services/mcp/src/render.ts';

const FLAG = '--disable-accelerated-2d-canvas';

test('the flag is the one that moves 2D canvases off the GPU process', () => {
  assert.deepEqual([...CPU_CANVAS_ARGS], [FLAG]);
});

test('export renders from the CLI and TUI draw their canvases on the CPU', () => {
  for (const platform of ['darwin', 'linux', 'win32'] as const) {
    assert.ok(chromiumLaunchArgs('software', platform).includes(FLAG), platform);
    assert.ok(chromiumLaunchOptions('software', {}, platform).args.includes(FLAG), platform);
  }
});

test('docs captures keep the machine GPU, as before', () => {
  // `auto` is the docs-screenshot pipeline: it compares raster shots by pixels with a
  // tolerance and was never part of the byte-identity claims for exports.
  assert.ok(!chromiumLaunchArgs('auto', 'darwin').includes(FLAG));
});

test('the MCP renderer draws its canvases on the CPU, sandboxed or not', () => {
  for (const env of [{}, { LOLLY_BROWSER_NO_SANDBOX: '1' }]) {
    assert.ok(browserLaunchArgs(env).includes(FLAG), JSON.stringify(env));
    assert.ok(browserLaunchOptions(env).args.includes(FLAG), JSON.stringify(env));
  }
});
