// SPDX-License-Identifier: MPL-2.0
/**
 * Every `applyPatch(` call in the web shell's views/ and lib/, and whether automatic
 * history hears it (plan 277 P4, section 3 item 3).
 *
 * The tool view tells history about an edit by wrapping `runtime.setInput`
 * (views/tool/setup.ts wrapSetInput). `applyPatch` goes round that wrapper, and on
 * purpose: mount-time patches (row ids, locked policy values, the template chosen on
 * open) must stay silent, or opening a tool would file a creation in Projects. So the
 * engine call is not wrapped wholesale. Instead each call is listed here as one of:
 *
 *   tracked     a user action; the listed proof shows where it reports the change
 *   mount-time  part of opening the document; must never file anything
 *   remote      a collaborator's edit arriving; a shared mount keeps no local history
 *   offscreen   a separate runtime on a hidden stage, not the open document
 *
 * A new call that is not listed fails, so the choice is made when the code is written.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../', import.meta.url));

interface Site {
  file: string;
  /** Text that picks out the call's source line, compared after trimming. */
  line: string;
  kind: 'tracked' | 'mount-time' | 'remote' | 'offscreen';
  why: string;
  /** For a tracked call: where the change is reported, as a pattern in a file. */
  proof?: { file: string; pattern: RegExp };
}

const SITES: readonly Site[] = [
  { file: 'views/tool-transaction.ts', line: 'const pending = runtime.applyPatch(values);', kind: 'tracked',
    why: 'a grouped command (a text edit, a multi-input change) committed through the undo history',
    proof: { file: 'views/tool/history.ts', pattern: /commitToolTransaction\([^)]*\);[\s\S]{0,120}finally \{ tview\.revisionChanged\(\); \}/ } },
  { file: 'views/tool/history.ts', line: 'if (values) void tview.runtime.applyPatch(values, { restoreTokenRefs: redo ? entry.tokenLinks?.after : entry.tokenLinks?.before }).then(() => tview.revisionChanged())', kind: 'tracked',
    why: 'undo or redo of a grouped command',
    proof: { file: 'views/tool/history.ts', pattern: /applyPatch\(values, \{ restoreTokenRefs: redo \? entry\.tokenLinks\?\.after : entry\.tokenLinks\?\.before \}\)\.then\(\(\) => tview\.revisionChanged\(\)\)/ } },
  { file: 'views/free-canvas/timeline.ts', line: 'await fc.runtime.applyPatch({ projectFps: rate, [fc.blockId]: boxes });', kind: 'tracked',
    why: "Design's Import animation: one Lottie becomes a sequence artboard",
    proof: { file: 'views/free-canvas/timeline.ts', pattern: /applyPatch\(\{ projectFps: rate, \[fc\.blockId\]: boxes \}\);\s*fc\.history\?\.changed\?\.\(\);/ } },
  { file: 'lib/studio-library.ts', line: 'await runtime.applyPatch(patch);', kind: 'tracked',
    why: "3D Studio's Apply studio, Update from studio and Save studio: the look",
    proof: { file: 'lib/studio-library.ts', pattern: /await runtime\.applyPatch\(patch\);\s*changed\?\.\(\);/ } },
  { file: 'lib/studio-library.ts', line: 'await runtime.applyPatch({', kind: 'tracked',
    why: 'the same actions: the link to the saved studio, written after the look',
    proof: { file: 'lib/studio-library.ts', pattern: /studioRef: studioFormatRef\(\{[\s\S]{0,160}\}\),\s*\}\);\s*changed\?\.\(\);/ } },
  { file: 'lib/studio-library.ts', line: "await runtime.applyPatch({ studioRef: '', studioOverrides: '' });", kind: 'tracked',
    why: "3D Studio's Detach: the document keeps its look and stops following the saved studio",
    proof: { file: 'lib/studio-library.ts', pattern: /applyPatch\(\{ studioRef: '', studioOverrides: '' \}\);\s*changed\?\.\(\);/ } },
  { file: 'views/tool/setup.ts', line: 'await runtime.applyPatch(policyValues);', kind: 'mount-time',
    why: "a locked policy value put into the runtime as the tool opens" },
  { file: 'views/tool/setup.ts', line: 'await runtime.applyPatch(seed, { restoreTokenRefs });', kind: 'mount-time',
    why: 'the starting point picked in the template chooser that opens with a blank document; not the first edit' },
  { file: 'lib/row-id.ts', line: 'if (Object.keys(values).length) await runtime.applyPatch(values);', kind: 'mount-time',
    why: 'stable row ids given to a session saved before rows had ids' },
  { file: 'lib/collab-plumbing.ts', line: 'pending = runtime.applyPatch(values);', kind: 'remote',
    why: 'a collaborator\'s edit arriving in a shared session, which keeps no history on this device' },
  { file: 'lib/design-tool-preflight.ts', line: 'await runtime.applyPatch(values);', kind: 'offscreen',
    why: 'the preparation check renders every choice combination on its own runtime and hidden stage' },
];

/** Production modules under views/ and lib/, relative to shells/web/src. */
function modules(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(join(SRC, dir))) {
    const rel = `${dir}/${name}`;
    if (statSync(join(SRC, rel)).isDirectory()) out.push(...modules(rel));
    else if (/\.ts$/.test(name) && !/\.(test|test-utils)\.ts$/.test(name) && !name.endsWith('.d.ts')) out.push(rel);
  }
  return out;
}

/** A call, not a type member: a type member gives its parameter a type. */
const CALL = /\bapplyPatch\??\.?\(/;
const MEMBER = /\bapplyPatch\??\(\s*\w+\s*:/;

test('every applyPatch call in views/ and lib/ is listed as tracked, mount-time, remote or offscreen', () => {
  const found: { file: string; line: string }[] = [];
  for (const file of [...modules('views'), ...modules('lib')]) {
    const lines = readFileSync(join(SRC, file), 'utf8').split('\n');
    for (const raw of lines) {
      const line = raw.trim();
      if (line.startsWith('//') || line.startsWith('*') || !CALL.test(line) || MEMBER.test(line)) continue;
      found.push({ file: relative(SRC, join(SRC, file)), line });
    }
  }
  // A line that equals a listed line is that site; otherwise the listed text it contains.
  const siteOf = (call: { file: string; line: string }): Site | undefined =>
    SITES.find(site => site.file === call.file && call.line === site.line)
    ?? SITES.find(site => site.file === call.file && call.line.includes(site.line));
  const unlisted = found.filter(call => !siteOf(call));
  assert.deepEqual(unlisted, [], 'a new applyPatch call: add it to SITES as tracked (and report the change through revisionChanged) or say why it must stay silent');
  const matched = new Set(found.map(siteOf));
  const stale = SITES.filter(site => !matched.has(site));
  assert.deepEqual(stale.map(site => `${site.file}: ${site.line}`), [], 'a listed call is gone; remove its entry');
  for (const site of SITES) assert.ok(site.why.length > 20, `${site.file}: say why`);
});

test('every tracked call reports the change to automatic history', () => {
  for (const site of SITES.filter(s => s.kind === 'tracked')) {
    assert.ok(site.proof, `${site.file}: a tracked call names its proof`);
    const source = readFileSync(join(SRC, site.proof.file), 'utf8');
    assert.match(source, site.proof.pattern, `${site.file}: ${site.line}`);
  }
  // The callers hand the signal in: the tool view passes revisionChanged to the studio
  // actions, the collection review and the free-canvas history port.
  const render = readFileSync(join(SRC, 'views/tool/render.ts'), 'utf8');
  assert.match(render, /mountStudioActions\(panel, \{[\s\S]{0,200}changed: \(\) => tview\.revisionChanged\(\)/);
  assert.match(render, /openStudioCollection\(tview\.runtime, tview\.host, \(\) => tview\.revisionChanged\(\)\)/);
  assert.match(readFileSync(join(SRC, 'views/studio3d-collection.ts'), 'utf8'), /applyStudio\(runtime, chosen, changed\)/);
  assert.match(readFileSync(join(SRC, 'views/tool/history.ts'), 'utf8'), /export function transactionActions[\s\S]{0,400}changed: \(\) => tview\.revisionChanged\(\)/);
  assert.match(readFileSync(join(SRC, 'views/tool/session.ts'), 'utf8'), /history: \{[^}]*\.\.\.tview\.history\.transactionActions\(registerHistory\)/);
});
