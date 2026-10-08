// SPDX-License-Identifier: MPL-2.0
/**
 * Every launcher that boots the web shell must give Chromium a WebGPU adapter, or the
 * shell shows the unsupported-environment card instead of rendering (plan 295). CI's
 * browser jobs preload tests/browser-gpu.ts, which adds the SwiftShader flags to every
 * launch, so a launcher that forgot them still passes there and fails on a GPU-less
 * Linux host. This pins the flags per launcher without starting a browser: the shared
 * ones by calling them, and every Chromium launch under scripts/ by reading its source.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SOFTWARE_WEBGPU_ARGS, webGpuLaunchArgs } from '../packages/node-shell/src/webgpu-launch.ts';
import { chromiumLaunchArgs, chromiumLaunchOptions } from '../packages/node-shell/src/browsers.ts';
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

test('getBrowser passes those flags to its launch, with or without a chosen browser', () => {
  for (const env of [{}, { LOLLY_BROWSER_CHANNEL: 'chrome' }, { LOLLY_BROWSER_PATH: '/opt/chromium/chrome' }]) {
    const options = chromiumLaunchOptions('software', env, 'linux');
    assert.deepEqual(options.args, chromiumLaunchArgs('software', 'linux'), JSON.stringify(env));
    assert.ok(includesAll(options.args, SOFTWARE_WEBGPU_ARGS), JSON.stringify(env));
  }
  assert.equal(chromiumLaunchOptions('software', { LOLLY_BROWSER_CHANNEL: 'chrome' }).channel, 'chrome');
  // The options object above is what getBrowser launches with: its only launch takes it whole.
  const source = readFileSync(fileURLToPath(new URL('../packages/node-shell/src/browsers.ts', import.meta.url)), 'utf8');
  const launches = [...source.matchAll(/chromium\.launch\(([^)]*\))?[^)]*\)/g)].map(match => match[0]);
  assert.deepEqual(launches, ['chromium.launch(chromiumLaunchOptions(graphics))']);
});

test('the MCP renderer launches with an adapter, sandboxed or not', () => {
  for (const env of [{}, { LOLLY_BROWSER_NO_SANDBOX: '1' }]) {
    assert.ok(includesAll(browserLaunchArgs(env), SOFTWARE_WEBGPU_ARGS), JSON.stringify(env));
    assert.ok(includesAll(browserLaunchOptions(env).args, SOFTWARE_WEBGPU_ARGS), JSON.stringify(env));
  }
});

const SCRIPTS = fileURLToPath(new URL('../scripts/', import.meta.url));

/**
 * Launchers under scripts/ that never open the shell, each with the reason. Every other
 * Chromium launch there must take webGpuLaunchArgs. The list fails both ways: a launcher
 * listed here that starts opening a shell route, or that no longer launches, fails too.
 */
const NOT_THE_SHELL: Record<string, string> = {
  'bench-canvas-paint.ts': 'a setContent harness of plain boxes',
  'bench-canvas-previews.ts': 'a setContent harness of plain boxes',
  'bench-canvas-translation.ts': 'a setContent harness of plain boxes',
  'layout-lab/browser-check.ts': "the layout lab's own page (scripts/layout-lab/server.ts)",
  'layout-lab/browser-corpus-check.ts': "the layout lab's own page (scripts/layout-lab/server.ts)",
  'lib/presentation-playback.ts': 'a local page that plays one recorded clip',
  'lib/rasterize-svg-browser.ts': 'rasterises SVG through setContent',
  'probe-presentation-gpu.ts': 'measures capture on about:blank',
  'probe-presentation-soak.ts': 'fulfils its own probe page through context.route',
  'probe-presentation-sync.ts': 'fulfils its own probe page through context.route',
  'verify-skera-browser.ts': 'fulfils its own empty page through page.route',
};

function scriptFiles(dir = SCRIPTS, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) { if (name !== 'node_modules') scriptFiles(full, out); }
    else if (name.endsWith('.ts')) out.push(full);
  }
  return out;
}

/** Each launch call's full argument text, read with bracket matching (strings skipped). */
function launchCalls(source: string): string[] {
  const calls: string[] = [];
  for (const match of source.matchAll(/\.(?:launch|launchPersistentContext)\(/g)) {
    let depth = 1, i = match.index + match[0].length, quote = '';
    for (; i < source.length && depth > 0; i++) {
      const ch = source[i]!;
      if (quote) { if (ch === '\\') i++; else if (ch === quote) quote = ''; continue; }
      if (ch === "'" || ch === '"' || ch === '`') quote = ch;
      else if (ch === '(' || ch === '{' || ch === '[') depth++;
      else if (ch === ')' || ch === '}' || ch === ']') depth--;
    }
    calls.push(source.slice(match.index, i));
  }
  return calls;
}

/** A string that navigates into the shell: a hash route, or the /verify path route. */
const SHELL_ROUTE = /['"`][^'"`\n]*(?:#\/|\/verify\/)[^'"`\n]*['"`]/;

test('every script that launches Chromium to open the shell gives it the shared WebGPU flags', () => {
  const files = scriptFiles();
  let launches = 0;
  const unflagged: string[] = [];
  const listedButUsed: string[] = [];
  const seen = new Set<string>();
  for (const file of files) {
    const rel = relative(SCRIPTS, file).split('\\').join('/');
    const source = readFileSync(file, 'utf8');
    const calls = launchCalls(source);
    if (!calls.length) continue;
    launches += calls.length;
    if (rel in NOT_THE_SHELL) {
      seen.add(rel);
      if (SHELL_ROUTE.test(source)) listedButUsed.push(`${rel} is listed as not opening the shell, but navigates to a shell route`);
      continue;
    }
    for (const call of calls) {
      if (!/webGpuLaunchArgs\('(?:software|auto)'\)/.test(call)) unflagged.push(`${rel}: ${call.replace(/\s+/g, ' ').slice(0, 160)}`);
    }
  }
  assert.ok(launches >= 30, `only ${launches} launches found under scripts/; is the scan still reading them?`);
  assert.deepEqual(unflagged, [], 'add webGpuLaunchArgs to these launches, or list the script in NOT_THE_SHELL with the reason it never opens the shell');
  assert.deepEqual(listedButUsed, []);
  assert.deepEqual(Object.keys(NOT_THE_SHELL).filter(rel => !seen.has(rel)), [], 'these listed scripts no longer launch Chromium; remove them from NOT_THE_SHELL');
});

test('the launch scan sees a launch that forgot the flags', () => {
  assert.deepEqual(launchCalls("const b = await chromium.launch({ headless: true, args: ['--x', ')'] });\nawait b.close();"),
    [".launch({ headless: true, args: ['--x', ')'] })"]);
  const forgotten = launchCalls("await { chromium, webkit }[engine].launchPersistentContext(dir, {\n  headless: true,\n});");
  assert.equal(forgotten.length, 1);
  assert.doesNotMatch(forgotten[0]!, /webGpuLaunchArgs/);
  assert.match(launchCalls("chromium.launch({ args: webGpuLaunchArgs('software') })")[0]!, /webGpuLaunchArgs\('software'\)/);
});
