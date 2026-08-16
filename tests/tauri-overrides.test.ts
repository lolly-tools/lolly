// SPDX-License-Identifier: MPL-2.0
/**
 * The Tauri shells' bridge-overrides stay inside the typecheck.
 *
 * `bridge-overrides/` is the entire application-specific surface of both Tauri
 * shells. It was `.js` and covered by no tsconfig until 2026-07-30, which
 * maintainability-2026-07-29.md item 4 called out: a mistake in an override
 * surfaced at runtime on a device, not at build. The conversion closed that, and
 * these are the tripwires that keep it closed - a new override added as `.js`, or
 * a deleted tsconfig, would otherwise silently reopen the gap because
 * scripts/typecheck-tauri.ts SKIPS rather than fails when a shell looks
 * unconfigured (see its header for why).
 *
 * Deliberately does NOT run tsc: that needs each shell's own node_modules for the
 * @tauri-apps types (the Tauri shells are not npm workspaces). CI installs them
 * and runs `npm run typecheck:tauri -- --strict`. This file asserts the shape the
 * gate depends on, so it stays honest on any clone.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, existsSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Every override directory, including the parent-owned shared one. */
const OVERRIDE_DIRS = [
  'shells/tauri-desktop/bridge-overrides',
  'shells/tauri-mobile/bridge-overrides',
  'shells/tauri-shared/bridge-overrides',
];

/** The tsconfigs that cover those directories. tauri-shared's is reached by the
 *  main `typecheck` script; the two shells' by scripts/typecheck-tauri.ts. */
const TSCONFIGS = ['shells/tauri-desktop', 'shells/tauri-mobile', 'shells/tauri-shared'];

function dirFiles(rel: string): string[] {
  const dir = join(ROOT, rel);
  try {
    if (!statSync(dir).isDirectory()) return [];
  } catch {
    return []; // shell submodule not checked out - the per-dir tests skip below
  }
  return readdirSync(dir);
}

test('every bridge override is TypeScript, not JavaScript', () => {
  const offenders: string[] = [];
  let checked = 0;
  for (const rel of OVERRIDE_DIRS) {
    const files = dirFiles(rel);
    if (!files.length) continue;
    checked++;
    for (const name of files) {
      if (name.endsWith('.js') || name.endsWith('.mjs')) offenders.push(`${rel}/${name}`);
    }
  }
  assert.ok(checked > 0, 'no bridge-overrides directory found at all — did the paths move?');
  assert.deepEqual(
    offenders,
    [],
    'a bridge override is .js, so nothing typechecks it: an error there surfaces at ' +
      'runtime in a webview. Convert it to .ts (the tsconfigs already include ' +
      "bridge-overrides/**/*.ts, so no config change is needed).",
  );
});

test('each override directory is covered by a tsconfig that includes it', () => {
  let checked = 0;
  for (const rel of TSCONFIGS) {
    const cfgPath = join(ROOT, rel, 'tsconfig.json');
    if (!existsSync(join(ROOT, rel, 'bridge-overrides'))) continue; // submodule absent
    checked++;
    assert.ok(
      existsSync(cfgPath),
      `${rel} has bridge-overrides/ but no tsconfig.json — its overrides would be ` +
        'typechecked by nothing, and scripts/typecheck-tauri.ts would report a SKIP ' +
        'rather than a failure.',
    );
    // Plain JSON.parse is safe: these configs carry their prose as `"//"` KEYS
    // (valid JSON), not as // line comments, so there is nothing to strip.
    const raw = readFileSync(cfgPath, 'utf8');
    const cfg = JSON.parse(raw) as { include?: string[] };
    assert.ok(
      cfg.include?.some((pattern) => pattern.startsWith('bridge-overrides/')),
      `${rel}/tsconfig.json does not include bridge-overrides/ — tsc would pass vacuously`,
    );
  }
  assert.ok(checked > 0, 'no Tauri shell was checked — did the paths move?');
});

test('the shared state logic is typed against the web bridge, not restated', () => {
  const rel = 'shells/tauri-shared/bridge-overrides/state-fs.ts';
  const path = join(ROOT, rel);
  assert.ok(existsSync(path), `${rel} is missing — both Tauri shells import it`);
  const src = readFileSync(path, 'utf8');
  // The whole point of the type-only import: a method added to the web state
  // bridge and forgotten here must fail typecheck, not crash a device at boot.
  assert.match(
    src,
    /import type \{[^}]*WebStateAPI[^}]*\} from '\.\.\/\.\.\/web\/src\/bridge\/state\.ts'/,
    'state-fs.ts no longer derives its return type from the web bridge\'s WebStateAPI. ' +
      'Restating the surface locally lets the two drift, which is what the file header ' +
      'says must not happen (a missing method crashes boot).',
  );
  assert.match(
    src,
    /export function createFsStateAPI\(fs: StateFs\): WebStateAPI/,
    'createFsStateAPI must return WebStateAPI so the drift is caught by tsc',
  );
});

test("the shells' vite override maps point at files that exist", () => {
  // The resolveId plugin maps an extension-less basename to an ABSOLUTE path. A
  // stale `.js` there resolves to nothing and Vite falls back to the WEB module,
  // which is how the shell once shipped web IndexedDB state and a throwing
  // capture stub (documented in vite.config.js). Nothing else catches it.
  let checked = 0;
  for (const shell of ['shells/tauri-desktop', 'shells/tauri-mobile']) {
    const cfg = join(ROOT, shell, 'vite.config.js');
    if (!existsSync(cfg)) continue;
    checked++;
    const src = readFileSync(cfg, 'utf8');
    const referenced = [...src.matchAll(/bridge-overrides\/([\w.-]+\.[jt]s)/g)].map((m) => m[1]);
    assert.ok(referenced.length > 0, `${shell}/vite.config.js references no override files`);
    for (const name of new Set(referenced)) {
      assert.ok(
        existsSync(join(ROOT, shell, 'bridge-overrides', name as string)),
        `${shell}/vite.config.js maps a bridge module to bridge-overrides/${name}, which ` +
          'does not exist — the override silently falls back to the web implementation.',
      );
    }
  }
  assert.ok(checked > 0, 'no Tauri vite config found — did the paths move?');
});
