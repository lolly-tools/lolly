// SPDX-License-Identifier: MPL-2.0
/**
 * A link export writes the file the export panel writes (views/tool/exporting.ts
 * `linkExport`).
 *
 * Two bugs, found by the Certificate refresh: `?pageSize=story&format=png&export`
 * came out at the render box (1123 x 794, the story layout cropped into it) and on a
 * fresh browser without the issuer logo. The size precedence is a pure function
 * (tests/export-size.test.ts), the wait is lib/export-settle.ts
 * (export-settle.test.ts) and the logo read is the asset bridge (assets.test.ts).
 * exporting.ts cannot be imported under plain Node (see exporting-studio.test.ts),
 * so this pins how those pieces are wired.
 *
 * Run: node --test shells/web/src/views/tool/link-export.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (path: string) => readFileSync(join(SRC, path), 'utf8');

/** The body of a top-level function, from its declaration to the next top-level declaration. */
function functionBody(source: string, name: string): string {
  const start = source.search(new RegExp(`^export (?:async )?function ${name}\\b`, 'm'));
  assert.ok(start >= 0, `${name} is declared`);
  const rest = source.slice(start + 1);
  const next = rest.search(/^(?:export )?(?:async )?function |^\/\*\*/m);
  return next < 0 ? rest : rest.slice(0, next);
}

test('the first paint hands a link export to the exporting module', () => {
  const render = read('views/tool/render.ts');
  assert.match(render, /if \(tview\.pendingAutoExport\) \{\s*tview\.pendingAutoExport = false;\s*tview\.exporting\.linkExport\(\)\.catch\(/);
  assert.doesNotMatch(render, /host\.export\.download\(/, 'the paint loop no longer builds and writes the export itself');
});

test('a link export reads its size like the export bar, then settles, then exports at that size', () => {
  const body = functionBody(read('views/tool/exporting.ts'), 'linkExport');
  const quiet = body.indexOf('waitForQuiescence(tview.contentEl), tview.brandVarsReady');
  const size = body.indexOf('const size = linkExportSizeFor(tview);');
  const settle = body.indexOf('await settleLinkExport(tview, size.canvas);');
  const opts = body.indexOf('width: size.width,');
  const exported = body.indexOf('runtime.export(');
  assert.ok(quiet >= 0 && quiet < size && size < settle && settle < opts && opts < exported, 'quiet, size, settle, options, export - in that order');
  assert.match(body, /height: size\.height,/);
  assert.match(body, /if \(size\.dpi\) expOpts\.dpi = size\.dpi;/);
  assert.doesNotMatch(body, /nativeW|nativeH/, 'the render box is only the last fallback inside linkExportSize');
});

test('the size comes from the link, the saved session, the size select and the render box', () => {
  const body = functionBody(read('views/tool/exporting.ts'), 'linkExportSizeFor');
  assert.match(body, /link: \{ width: tview\.urlWidth, height: tview\.urlHeight, unit: tview\.urlUnit, dpi: tview\.urlDpi \}/);
  assert.match(body, /saved\.__export_width/);
  assert.match(body, /sizeDriver\.dims\[String\(value\)\]/);
  assert.match(body, /optionMoved: !fixed && \(option \?\? null\) !== \(tview\.sizeDims \?\? null\)/);
  assert.match(body, /render: \{ width: tview\.nativeW, height: tview\.nativeH \}/);
  assert.doesNotMatch(body, /rememberedExport/, 'a device-remembered size never reaches a link export');
});

test('the settle tells the tool its size and waits on the runtime and the paint loop', () => {
  const body = functionBody(read('views/tool/exporting.ts'), 'settleLinkExport');
  assert.match(body, /runtime: tview\.runtime,/);
  assert.match(body, /flush: \(\) => tview\.render\.flushRender\(\),/);
  assert.match(body, /shown: \(\) => tview\.lastPainted,/);
  assert.match(body, /quiet: \(\) => waitForQuiescence\(tview\.contentEl\),/);
});

test('a link export uses the password from either place, and refuses before any work', () => {
  const body = functionBody(read('views/tool/exporting.ts'), 'linkExport');
  assert.match(body, /const password = tview\.urlPassword \|\| tview\.automationPassword \|\| undefined;/, 'the one-time binding reaches the export, not only the panel defaults');
  assert.match(body, /if \(password\) expOpts\.password = password;/);
  const refused = body.indexOf('linkPasswordRefusal(fmt');
  const missing = body.indexOf('did not arrive');
  const quiet = body.indexOf('waitForQuiescence(tview.contentEl)');
  assert.ok(refused >= 0 && missing >= 0 && refused < quiet && missing < quiet, 'the refusal comes first');
  assert.match(body, /if \(password \|\| automationPasswordExpected\(\)\)/, 'a binding with no password in it writes no file');
  assert.doesNotMatch(body, /\$\{password\}/, 'no message repeats it');
});

test('a refused link tells the person, not only the log', () => {
  const render = read('views/tool/render.ts');
  assert.match(render, /Auto-export did not start: \$\{String\(err\)\}/, 'the Node drivers read this line to stop waiting');
  assert.match(render, /err instanceof LinkPasswordRefused\) void noticeDialog/);
});

test('setup takes the password out of every address it could be rebuilt from', () => {
  const setup = read('views/tool/setup.ts');
  const at = setup.indexOf('tview.urlPassword = urlPassword;');
  const block = setup.slice(at, setup.indexOf('tview.urlBleed = urlBleed;', at));
  assert.match(block, /tview\.urlParams = withoutLinkPassword\(query\);/);
  assert.match(block, /tview\.launchQuery = addressAfterLinkPassword\(query\);/);
  assert.match(block, /if \(!tview\.encLinkQuery\) \{/, 'a ciphertext link shows no password and stays');
  assert.match(block, /replaceRouteUrl\(/);
});
