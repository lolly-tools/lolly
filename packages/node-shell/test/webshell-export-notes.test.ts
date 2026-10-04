// SPDX-License-Identifier: MPL-2.0
/**
 * The CLI's browser tier prints the web shell's own export notes (plan 291 M4).
 *
 * A Tier A PowerPoint export reports what it could not keep (a slide drawn dark on a
 * light layout, a picture left out) through `host.log('warn', 'pptx: …')`, which the web
 * shell prints as `[warn] pptx: …`. `lolly run <file>.lolly --export=pptx` used to drop
 * those lines, so the note the docs promise reached nobody on that path. The session
 * export reads them back from the page's console with `sessionExportNote`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sessionExportNote } from '../src/webshell-render.ts';

test('a pptx warning from the web shell is an export note; anything else is not', () => {
  const note = 'pptx: slide 5 is drawn dark on a light layout (Main point): the dark ground and ink are set on the slide itself.';
  // console.warn('[warn]', msg, '') prints the arguments joined by spaces.
  assert.equal(sessionExportNote('warning', `[warn] ${note} `), note);
  assert.equal(sessionExportNote('warning', `[warn] ${note}`), note);
  assert.equal(sessionExportNote('log', `[warn] ${note}`), null, 'only a warning');
  assert.equal(sessionExportNote('warning', '[warn] pdf: tilted <div> could not be captured'), null, 'only the PowerPoint export\'s notes');
  assert.equal(sessionExportNote('warning', 'pptx: no level prefix'), null);
  assert.equal(sessionExportNote('warning', `[warn] pptx: ${'x'.repeat(5000)}`)!.length, 2000, 'a runaway line is capped');
});

test('the web shell routes each Tier A note to the person and to the console line the CLI reads', async () => {
  const { readFile } = await import('node:fs/promises');
  const src = await readFile(new URL('../../../shells/web/src/bridge/export-pptx.ts', import.meta.url), 'utf8');
  const loop = /for \(const line of result\.notes\) \{([\s\S]*?)\n {2}\}/.exec(src);
  assert.ok(loop, 'the Tier A notes loop is there');
  assert.match(loop![1]!, /_host\?\.log\?\.\('warn', `pptx: \$\{line\}\.`\)/, 'the console line the CLI reads');
  assert.match(loop![1]!, /_exportNotice\(/, 'the export card and the aria-live announce');
});
