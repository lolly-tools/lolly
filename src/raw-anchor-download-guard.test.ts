// SPDX-License-Identifier: MPL-2.0
/**
 * Raw-anchor download guard (plan 216 item 1).
 *
 * A browser turns `<a download>` + click into a file download. A WebView with no
 * download handler does NOT - wry cancels the click outright - so on the Tauri
 * desktop/mobile shells every such click silently no-ops and the file never
 * appears. Those shells fix it by OVERRIDING the delivery verb, `host.export.
 * download`, with a native filesystem save (each shell's bridge-overrides/
 * export.ts), substituted for shells/web/src/bridge/export.ts by vite.config.js. The
 * override only reaches importers INSIDE bridge/, so any module elsewhere that
 * clicks its own anchor bypasses it and breaks on mobile - the exact defect that
 * shipped as "batch ZIPs never appear on iOS".
 *
 * The rule this pins: nothing under shells/web/src OUTSIDE bridge/ assigns
 * `.download` on an anchor. Deliver through `host.export.download` (overridable),
 * `saveBlob`/`saveSequential` (pro/zip.ts, which route through it), or - when no
 * host exists yet - `anchorSave`/`anchorSaveUrl` from bridge/export.ts, which keep
 * the one legitimate anchor in bridge/. If this fails: replace the raw anchor with
 * one of those, don't add another `.download =`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = dirname(fileURLToPath(import.meta.url));

/** Every .ts under shells/web/src that is not a test and not inside bridge/. */
function guardedFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir).sort()) {
    const abs = join(dir, entry);
    if (statSync(abs).isDirectory()) {
      if (entry === 'bridge') continue; // the one place the anchor legitimately lives
      out.push(...guardedFiles(abs));
    } else if (/\.ts$/.test(entry) && !/\.test\.ts$/.test(entry)) {
      out.push(abs);
    }
  }
  return out;
}

// True if the source assigns `.download` on something, with line and block
// comments stripped first so a commented-out anchor is not counted (mirrors
// boot-path-guard's comment strip).
function downloadAssignments(source: string): boolean {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/[^\n]*$/gm, '');
  return /\.download\s*=/.test(code);
}

test('no module outside shells/web/src/bridge/ assigns .download on an anchor', () => {
  const offenders = guardedFiles(SRC)
    .filter((file) => downloadAssignments(readFileSync(file, 'utf8')))
    .map((file) => relative(SRC, file).replaceAll('\\', '/'));
  assert.deepEqual(
    offenders,
    [],
    'a raw `<a download>` outside bridge/ is dropped by the Tauri WebView (no native override reaches it) - deliver through host.export.download / saveBlob / bridge/export.ts anchorSave instead',
  );
});

test('bridge/export.ts still owns a real anchor helper (the guard has something to protect)', () => {
  const src = readFileSync(join(SRC, 'bridge', 'export.ts'), 'utf8');
  assert.match(src, /export function anchorSave\b/, 'anchorSave is the sanctioned fallback the guard points callers at');
  assert.match(src, /\.download\s*=/, 'the one legitimate `.download =` lives here');
});
