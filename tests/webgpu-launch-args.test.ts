// SPDX-License-Identifier: MPL-2.0
/**
 * Every launcher that boots the web shell must give Chromium a WebGPU adapter, or the
 * shell shows the unsupported-environment card instead of rendering (plan 295). CI's
 * browser jobs preload tests/browser-gpu.ts, which adds the SwiftShader flags to every
 * launch, so a launcher that forgot them still passes there and fails on a GPU-less
 * Linux host. This pins the flags per launcher without starting a browser.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SOFTWARE_WEBGPU_ARGS, webGpuLaunchArgs } from '../packages/node-shell/src/webgpu-launch.ts';
import { chromiumLaunchArgs } from '../packages/node-shell/src/browsers.ts';
import { browserLaunchArgs, browserLaunchOptions } from '../services/mcp/src/render.ts';

const ADAPTER = '--use-webgpu-adapter=swiftshader';
const ENABLE = '--enable-unsafe-webgpu';

const includesAll = (args: readonly string[], flags: readonly string[]): boolean => flags.every(flag => args.includes(flag));

test('the shared list is WebGPU on with SwiftShader as its adapter', () => {
  assert.deepEqual([...SOFTWARE_WEBGPU_ARGS], [ENABLE, ADAPTER]);
  assert.deepEqual(webGpuLaunchArgs(), [ENABLE, ADAPTER]);
  assert.deepEqual(webGpuLaunchArgs('software', 'darwin'), [ENABLE, ADAPTER], 'software is the same adapter on every host');
  assert.deepEqual(webGpuLaunchArgs('auto', 'linux'), [ENABLE, ADAPTER], 'a Linux host may have no GPU at all');
  assert.deepEqual(webGpuLaunchArgs('auto', 'darwin'), [ENABLE], 'macOS keeps its Metal adapter');
  assert.deepEqual(webGpuLaunchArgs('auto', 'win32'), [ENABLE], 'Windows keeps its Direct3D adapter');
});

test('the CLI and TUI browser tier launches with an adapter on a GPU-less Linux host', () => {
  for (const graphics of ['software', 'auto'] as const) {
    const args = chromiumLaunchArgs(graphics, 'linux');
    assert.ok(includesAll(args, SOFTWARE_WEBGPU_ARGS), `${graphics}: ${args.join(' ')}`);
  }
  assert.ok(includesAll(chromiumLaunchArgs('software', 'darwin'), SOFTWARE_WEBGPU_ARGS));
  assert.ok(chromiumLaunchArgs('auto', 'darwin').includes(ENABLE));
});

test('the MCP renderer launches with an adapter, sandboxed or not', () => {
  for (const env of [{}, { LOLLY_BROWSER_NO_SANDBOX: '1' }]) {
    assert.ok(includesAll(browserLaunchArgs(env), SOFTWARE_WEBGPU_ARGS), JSON.stringify(env));
    assert.ok(includesAll(browserLaunchOptions(env).args, SOFTWARE_WEBGPU_ARGS), JSON.stringify(env));
  }
});

test('the maintainer scripts that boot the shell take the shared flags at every launch', () => {
  for (const script of ['build-previews', 'build-animated-previews', 'build-covers', 'capture-sidebars', 'check-ui-performance']) {
    const source = readFileSync(fileURLToPath(new URL(`../scripts/${script}.ts`, import.meta.url)), 'utf8');
    const launches = [...source.matchAll(/chromium\.launch\(\{[^;]*?\}\)/g)].map(match => match[0]);
    assert.ok(launches.length > 0, `${script}: no chromium.launch found; update this test if the launch moved`);
    for (const launch of launches) assert.match(launch, /webGpuLaunchArgs\('(?:software|auto)'\)/, `${script}: ${launch}`);
  }
});
