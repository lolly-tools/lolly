// SPDX-License-Identifier: MPL-2.0
/**
 * Every studio export path asks the studio for a capture error before it keeps the output.
 *
 * Run with:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/views/tool/exporting-studio.test.ts
 *
 * exporting.ts cannot be imported under plain Node (its import chain reaches
 * bridge/format-support.js), so this pins the source instead: the editor's two capture
 * sites and the batch row export go through withStudioExport (lib/studio-export-guard.ts,
 * whose behaviour studio-export-guard.test.ts covers), and nothing calls prepareToolStudio
 * on its own and then exports without the check.
 *
 * The output size travels the same way, and the piece that can be run here is run: the
 * export bar's own dimensions-to-pixels reading, through the real wrapper, into a studio
 * that rebuilds the way lib/studio3d/mount.ts does.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { type StudioExportHooks, withStudioExport } from '../../lib/studio-export-guard.ts';
import { exportPixelSize } from '../export-dimension-fields.ts';

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

test('both editor capture sites export through withStudioExport and prepare at export quality', () => {
  const source = read('views/tool/exporting.ts');
  assert.match(source, /import \{ withStudioExport \} from '\.\.\/\.\.\/lib\/studio-export-guard\.ts';/);
  const body = functionBody(source, 'exportUnscaledRaw');
  const guarded = body.match(
    /return await withStudioExport\(tview\.studioModule, tview\.contentEl, \(\) => fn\(report\), 'export', size\);/g
  );
  assert.equal(guarded?.length, 2, 'the full-bleed path and the artboard path are both guarded');
  // The caller's output size is carried straight through; an export that knows no size
  // passes none, which leaves the studio at the detail the preview built.
  assert.match(source, /size\?: \{ width: number; height: number \};/);
  assert.doesNotMatch(body, /prepareToolStudio/, 'the guard prepares the frame; no bare prepare remains');
  assert.doesNotMatch(body, /return await fn\(report\)/, 'no capture site exports without the check');
  // The load check still runs first: a studio that failed to mount never starts an export.
  assert.ok(body.indexOf('if (tview.studioError) throw tview.studioError;') < body.indexOf('withStudioExport('));
});

test('the batch row export checks the studio it mounted, without a second prepare', () => {
  const source = read('pro/render-export.ts');
  assert.match(source, /import \{ type StudioExportHooks, withStudioExport \} from '\.\.\/lib\/studio-export-guard\.ts';/);
  const body = functionBody(source, 'renderRowToBlob');
  assert.match(
    body,
    /const blob = await withStudioExport\(\s*mounted\.studio,\s*canvas,\s*\(\) => runtime\.export\(target, fmt, exportOpts\),/
  );
  // The row's output size travels with it, so a studio whose curve detail follows the
  // output is built for the size this row renders at rather than for the preview.
  assert.match(body, /\{ width: outPixels\(width, layoutW\), height: outPixels\(height, layoutH\) \}/);
  assert.doesNotMatch(body, /await runtime\.export\(/, 'every export in the row goes through the check');
  assert.doesNotMatch(body, /prepareToolStudio/);
  // mountToolCanvas hands back the module it mounted the scene with, after its own prepare.
  assert.match(source, /mountedStudio = studio;/);
  assert.match(source, /return \{ stage, canvas, studio: mountedStudio \};/);
});

test('paged batch exports are checked the same way, at each page box size', () => {
  const body = functionBody(read('pro/render-export.ts'), 'renderToolPages');
  assert.match(body, /await withStudioExport\(mounted\.studio, canvas, \(\) => runtime\.export\(el, /);
  assert.doesNotMatch(body, /pages\.push\(await runtime\.export\(/);
  // A page renders with no dimension opts, so its laid-out box is its output size.
  assert.match(body, /const pageSize = \{ width: el\.offsetWidth, height: el\.offsetHeight \};/);
  assert.match(body, /\}\), undefined, pageSize\)\);/);
});

test('the editor export bar reads its pixel size from the dimensions it hands the bridge', () => {
  // px dimensions are already a pixel count, whatever the dpi field says.
  assert.deepEqual(exportPixelSize({ width: 4096, height: 4096 }), { width: 4096, height: 4096 });
  // Physical units become pixels at the export dpi - A4 at 300 dpi, the bridge's own rule.
  assert.deepEqual(exportPixelSize({ width: '210mm', height: '297mm', dpi: 300 }), {
    width: 2480,
    height: 3508,
  });
  // No dpi with a physical unit is print's 300; a px pair with none is left alone.
  assert.deepEqual(exportPixelSize({ width: '1in', height: '2in' }), { width: 300, height: 600 });
  // One side blank takes the other's value: the reader wants the longer side.
  assert.deepEqual(exportPixelSize({ width: 1200 }), { width: 1200, height: 1200 });
  // Nothing typed names no size, so the export carries none and the preview stands.
  assert.equal(exportPixelSize({}), undefined);
});

test('a 4096 px editor export rebuilds an auto-detail studio for 4096, not the preview', async () => {
  const container = { name: 'tool-content' };
  // What mount.ts does with the size: a recipe whose curve detail follows the output is
  // built again when the export is larger than what is already loaded.
  let detailPixels = 800; // the preview cap
  const asked: Array<{ width: number; height: number } | undefined> = [];
  const studio: StudioExportHooks<typeof container> = {
    prepareToolStudio() {},
    studioCaptureError: () => null,
    prepareStudioDetail(_container, size) {
      asked.push(size);
      const target = size ? Math.max(1, Math.round(Math.max(size.width, size.height))) : 800;
      if (target <= detailPixels) return Promise.resolve(false);
      detailPixels = target;
      return Promise.resolve(true);
    },
  };
  const size = exportPixelSize({ width: 4096, height: 4096 });
  const out = await withStudioExport(studio, container, async () => 'png bytes', 'export', size);
  assert.equal(out, 'png bytes');
  assert.deepEqual(asked, [{ width: 4096, height: 4096 }]);
  assert.equal(detailPixels, 4096, 'the sources were built for the exported size');
  // Without a size (no dimensions in the bar) nothing is rebuilt: the old behaviour.
  await withStudioExport(studio, container, async () => 'png bytes', 'export', exportPixelSize({}));
  assert.equal(asked.length, 1);
});

test('the export bar, the copy and the send all hand their pixel size to the wrapper', () => {
  const wiring = read('views/tool-actions/wiring.ts');
  // One reading of the bar: the same dims go to the bridge and to the size beside them.
  assert.match(wiring, /const exportDims = ta\.dims\.exportDims\(\);/);
  assert.match(wiring, /const exportSize = ta\.dims\.exportPixels\(exportDims\);/);
  assert.match(wiring, /\.\.\.exportDims,\n\s+signal: exportAbort\.signal,/);
  assert.match(wiring, /\{ shutter: true, detail: fmtLabel\(fmt\), onCancel: cancelExport, size: exportSize \}/);
  const copying = read('views/tool-actions/copying.ts');
  assert.match(copying, /const copyDims = ta\.dims\.exportDims\(\);/);
  assert.match(copying, /\{ shutter: true, size: ta\.dims\.exportPixels\(copyDims\) \}/);
  assert.match(copying, /size: ta\.dims\.exportPixels\(sendDims\),/);
  assert.match(copying, /size: ta\.dims\.exportPixels\(previewDims\),/);
  // The size is resolved once, from the dims the export itself uses - never read twice.
  const dims = read('views/tool-actions/dims.ts');
  assert.match(dims, /dims: ExportDimensionOpts = exportDims\(ta\)/);
  assert.match(dims, /return exportPixelSize\(dims\);/);
  // A deep link gives its size in the URL, and the link export hands that size to the wrapper.
  // It lives in views/tool/exporting.ts (linkExport) since the link export waits for the tool to settle.
  const exporting = read('views/tool/exporting.ts');
  assert.match(exporting, /\{ size: exportPixelSize\(expOpts\) \}/);
});
