// SPDX-License-Identifier: MPL-2.0
/**
 * The serverless functions run on Vercel's nodejs24.x runtime, which starts Node
 * with `--no-experimental-require-module` and `--no-experimental-detect-module`
 * (measured 2026-09-14 with a throwaway function that returned process.execArgv).
 * Under those flags a CommonJS module cannot require() an ES module: it throws
 * ERR_REQUIRE_ESM. A developer's Node has require(esm) on by default, so a
 * dependency that pulls an ESM-only package into a CommonJS require chain loads
 * everywhere except production. jsdom 27 did exactly that (cssstyle 5's colour
 * parser requires the ESM-only @csstools/css-calc 3, and from 27.4 jsdom's own
 * html-encoding-sniffer 6 requires the ESM-only @exodus/bytes); after the jsdom 30
 * bump every render on lolly.tools answered 500. jsdom is pinned to 26.1.0 and
 * .github/dependabot.yml ignores newer releases for that reason.
 *
 * The functions bundle with `packages: 'external'` and load jsdom lazily, so the
 * committed bundles import cleanly and the failure only surfaces on the first
 * render. This test therefore imports each runtime dependency of the functions
 * (services/mcp and packages/node-shell) under the same flags, in a child process,
 * and fails on the first one that cannot load. Re-measure the flags with a function
 * that returns `process.execArgv` before relaxing this.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const VERCEL_NODE_FLAGS = ['--no-experimental-require-module', '--no-experimental-detect-module'];
// packages/rondo's runtime dependencies (QuickJS) load in the song renderer's
// Worker, which the MCP function carries as api/mcp/_rondo-worker.js (plan 301).
const FUNCTION_MANIFESTS = ['services/mcp/package.json', 'packages/node-shell/package.json', 'packages/rondo/package.json'];

/** Workspace packages resolve to TypeScript sources here, not to what Vercel traces. */
const WORKSPACE_PREFIXES = ['@lolly/', '@lolly-tools/'];

function runtimeDependencies(): string[] {
  const names = new Set<string>();
  for (const rel of FUNCTION_MANIFESTS) {
    const pkg = JSON.parse(readFileSync(resolve(ROOT, rel), 'utf8')) as { dependencies?: Record<string, string> };
    for (const name of Object.keys(pkg.dependencies ?? {})) {
      if (!WORKSPACE_PREFIXES.some(p => name.startsWith(p))) names.add(name);
    }
  }
  return [...names].sort();
}

test('every function runtime dependency loads under the Vercel Node flags', () => {
  const deps = runtimeDependencies();
  assert.ok(deps.includes('jsdom'), 'jsdom is the dependency this guard exists for; the manifests moved?');
  const script = `
    const failed = [];
    for (const name of ${JSON.stringify(deps)}) {
      try { await import(name); }
      catch (e) { failed.push(name + ': ' + (e && e.code ? e.code + ' ' : '') + String(e && e.message || e).split('\\n')[0]); }
    }
    if (failed.length) { console.error(failed.join('\\n')); process.exit(1); }
  `;
  const res = spawnSync(process.execPath, [...VERCEL_NODE_FLAGS, '--input-type=module', '-e', script], {
    cwd: ROOT, encoding: 'utf8', timeout: 120_000,
  });
  assert.equal(res.status, 0, `a function dependency cannot load on Vercel's runtime:\n${res.stderr.trim()}`);
});
