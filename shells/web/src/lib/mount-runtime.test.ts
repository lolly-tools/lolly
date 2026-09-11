// SPDX-License-Identifier: MPL-2.0
// Holds the mount-runtime chokepoint invariant.
//
// `host.color` and `host.geom` are installed lazily (they are ~39 KB gz that no
// shell code reads - only tool hooks) by lib/mount-runtime.ts's
// createToolRuntime, immediately before the runtime that runs those hooks.
// Someone importing the engine's `createRuntime` directly instead gets code that
// compiles, typechecks and renders - it just leaves both APIs undefined, and
// tools FEATURE-DETECT them, so a colour or vector tool degrades to its own
// fallback in total silence. No behavioural test can catch that; this grep can.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith('.ts') && !full.endsWith('.test.ts')) out.push(full);
  }
  return out;
}

test('nothing in shells/web/src imports createRuntime outside the chokepoint', () => {
  const allowed = path.join(srcDir, 'lib', 'mount-runtime.ts');
  const offenders: string[] = [];
  for (const file of walk(srcDir)) {
    if (file === allowed) continue;
    const src = readFileSync(file, 'utf8');
    // Import statements only - prose in header comments mentions createRuntime
    // all over the shell and must not trip this.
    for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*'([^']+)'/g)) {
      const names = (m[1] ?? '').split(',').map((s) => s.trim().split(/\s+as\s+/)[0]?.trim());
      if (names.includes('createRuntime')) offenders.push(`${path.relative(srcDir, file)} <- ${m[2]}`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    'import createToolRuntime from lib/mount-runtime.ts instead - a direct createRuntime '
      + 'leaves host.color/host.geom undefined and tools fail silently:\n  ' + offenders.join('\n  '),
  );
});

test('createToolRuntime installs host.color and host.geom before the runtime exists', async () => {
  const { installToolApis } = await import('../bridge/index.ts');
  const host = {} as Parameters<typeof installToolApis>[0];
  await installToolApis(host);
  assert.equal(typeof host.color?.deltaE, 'function', 'host.color must be installed');
  assert.equal(typeof host.geom?.union, 'function', 'host.geom must be installed');
});

test('installToolApis attaches to per-mount host CLONES, not just the first host', async () => {
  // multi-edit and pro/render-export mount against cloned hosts (scoped net,
  // thumb assets). Caching the INSTALL rather than the module would leave those
  // clones without either API.
  const { installToolApis } = await import('../bridge/index.ts');
  const a = {} as Parameters<typeof installToolApis>[0];
  const b = {} as Parameters<typeof installToolApis>[0];
  await installToolApis(a);
  await installToolApis(b);
  assert.equal(typeof b.geom?.union, 'function', 'a second host must also get host.geom');
  assert.equal(typeof b.color?.deltaE, 'function', 'a second host must also get host.color');
});
