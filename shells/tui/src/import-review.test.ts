// SPDX-License-Identifier: MPL-2.0
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { terminalContent } from '../../../tests/helpers/terminal-content.ts';

const root = await mkdtemp(join(tmpdir(), 'lolly-import-review-'));
after(() => rm(root, { recursive: true, force: true }));
await terminalContent(root);
process.env.LOLLY_ROOT = root;
process.env.LOLLY_STATE_DIR = join(root, 'state');
const { parsePdfBytes } = await import('./import/pdf.ts');
const { importDesignFile } = await import('./import-design.ts');
const { createTuiBridge } = await import('./bridge.ts');
const { exportToFile, mountTool } = await import('./engine-render.ts');

test('PDF page scope and dropped paths are visible findings, with explicit page selection', async () => {
  const doc = await PDFDocument.create();
  doc.addPage([100, 80]).drawRectangle({ x: 5, y: 5, width: 30, height: 20 });
  doc.addPage([220, 180]).drawRectangle({ x: 10, y: 10, width: 40, height: 30 });
  const warnings: string[] = [];
  const page = await parsePdfBytes(
    await doc.save(),
    (warning) => warnings.push(warning),
    undefined,
    2
  );
  assert.equal(page.page, 2);
  assert.equal(page.pageCount, 2);
  assert.equal(page.width, 220);
  assert.ok(warnings.some((warning) => warning.includes('page 2 of 2')));
  await assert.rejects(parsePdfBytes(await doc.save(), undefined, undefined, 3), /Choose a page/);
});

test('project JSON reopens with private saved values and export controls', async () => {
  const path = join(root, 'project.json');
  await writeFile(
    path,
    JSON.stringify({
      slot: 'original',
      toolId: 'batch-fixture',
      data: {
        __toolId: 'batch-fixture',
        __label: 'Imported',
        label: 'Saved text',
        __tui_query: 'w=812&format=svg',
      },
    })
  );
  const { host, dom } = await createTuiBridge();
  try {
    const imported = await importDesignFile(path, host);
    assert.equal(imported.data?.label, 'Saved text');
    assert.notEqual(imported.slot, 'original');
    assert.equal(new URLSearchParams(imported.query).get('w'), '812');
  } finally {
    dom.window.close();
  }
});

test('TUI output guards refuse bytes from the wrong encoder before writing a file', async () => {
  const { host, dom } = await createTuiBridge();
  try {
    const { runtime, manifest } = await mountTool('batch-fixture', host);
    runtime.export = async () => new Blob([Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10)]);
    const path = join(root, 'wrong.svg');
    await assert.rejects(exportToFile(runtime, dom, manifest, 'svg', path), /encoder returned PNG/);
    assert.ok(!existsSync(path));
  } finally {
    dom.window.close();
  }
});

test('requested credential failures stop the export before unsigned bytes are written', async () => {
  const { host, dom } = await createTuiBridge();
  try {
    const { runtime, manifest } = await mountTool('batch-fixture', host);
    runtime.emojiIngredients = () => {
      throw new Error('fixture credential context failure');
    };
    const path = join(root, 'unsigned.svg');
    await assert.rejects(
      exportToFile(runtime, dom, manifest, 'svg', path, { c2paDays: 30 }),
      /Could not add the requested Content Credentials/
    );
    assert.ok(!existsSync(path));
  } finally {
    dom.window.close();
  }
});
