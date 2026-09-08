// SPDX-License-Identifier: MPL-2.0
// node --import ./tests/css-stub.mjs --test shells/web/src/views/data.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import { writeXlsx, readXlsx } from '@lolly/engine';
import type { HostV1 } from '@lolly-tools/core/host-v1';

function workbook(): Uint8Array {
  const parts = unzipSync(writeXlsx({ name: 'First', rows: [['Name'], ['original']] }));
  parts['xl/workbook.xml'] = strToU8(strFromU8(parts['xl/workbook.xml']!).replace('</sheets>', '<sheet name="Second" sheetId="2" r:id="rId4"/></sheets>'));
  parts['xl/_rels/workbook.xml.rels'] = strToU8(strFromU8(parts['xl/_rels/workbook.xml.rels']!).replace('</Relationships>', '<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/></Relationships>'));
  parts['[Content_Types].xml'] = strToU8(strFromU8(parts['[Content_Types].xml']!).replace('</Types>', '<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'));
  parts['xl/worksheets/sheet2.xml'] = parts['xl/worksheets/sheet1.xml']!;
  return zipSync(parts);
}

const tick = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 10));

test('Spreadsheet preserves edits and file ownership through tab switches, failures and competing reads', async (suite) => {
  const dom = new JSDOM('<!doctype html><body><div id="view"></div></body>', { url: 'http://localhost/#/data', pretendToBeVisual: true });
  const original = new Map<string, PropertyDescriptor | undefined>();
  const globals = globalThis as unknown as Record<string, unknown>;
  const set = (key: string, value: unknown): void => {
    original.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  };
  for (const key of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLSelectElement', 'Element', 'Node', 'getComputedStyle', 'location', 'localStorage', 'sessionStorage', 'CustomEvent', 'MutationObserver', 'Event', 'navigator', 'history', 'requestAnimationFrame', 'cancelAnimationFrame']) set(key, (dom.window as unknown as Record<string, unknown>)[key]);
  set('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  set('ResizeObserver', undefined);
  Object.defineProperty(dom.window.HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 280 });
  const delivered: { blob: Blob; name: string }[] = [];
  let rejectDownload = false;
  const host = {
    profile: { get: async () => ({}) }, state: { get: async () => null, set: async () => {} }, log() {},
    export: { download: async (blob: Blob, name: string) => {
      if (rejectDownload) throw new Error('Storage refused');
      delivered.push({ blob, name });
    } },
  } as unknown as HostV1;
  const view = document.querySelector<HTMLElement>('#view')! as HTMLElement & { _cleanup?: () => void };
  try {
    const { mountDataView } = await import('./data.ts');
    await mountDataView(view, host);
    const fileInput = view.querySelector<HTMLInputElement>('[data-file]')!;
    const open = (file: File): void => {
      Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] });
      fileInput.dispatchEvent(new dom.window.Event('change'));
    };
    const button = (selector: string): HTMLButtonElement => view.querySelector<HTMLButtonElement>(selector)!;
    const edit = (text: string): void => {
      const cell = view.querySelector<HTMLElement>('.dg-cell[data-row="0"][data-col="0"]')!;
      cell.dispatchEvent(new dom.window.MouseEvent('dblclick', { bubbles: true }));
      const input = view.querySelector<HTMLInputElement>('.dg-editor')!;
      input.value = text;
      input.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    };
    const download = async (format = 'csv'): Promise<{ blob: Blob; name: string }> => {
      button(`[data-dl="${format}"]`).click(); await tick(); return delivered.at(-1)!;
    };

    await suite.test('keyboard opens picker once and shared worksheet tabs preserve independently edited sheets', async () => {
      let picks = 0;
      fileInput.addEventListener('click', e => { e.preventDefault(); picks++; });
      view.querySelector('[data-drop]')!.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      assert.equal(picks, 1);
      open(new File([workbook() as BlobPart], 'book.xlsx')); await tick();
      edit('edited first');
      const first = button('[data-sheet="0"]'); first.focus();
      first.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      assert.equal(document.activeElement, button('[data-sheet="1"]'));
      assert.equal(button('[data-sheet="0"]').tabIndex, -1);
      edit('edited second');
      button('[data-sheet="0"]').click();
      assert.match(await (await download()).blob.text(), /edited first/);
      button('[data-sheet="1"]').click();
      const saved = await download('xlsx');
      assert.deepEqual(readXlsx(new Uint8Array(await saved.blob.arrayBuffer())).rows, [['Name'], ['edited second']]);
      assert.match(view.querySelector('[data-status]')!.textContent!, /File ready/);
      assert.doesNotMatch(view.querySelector('[data-status]')!.textContent!, /Downloaded/);
    });

    await suite.test('invalid replacement preserves the old edited workbook and its filename', async () => {
      open(new File(['bad archive'], 'broken.xlsx')); await tick();
      assert.ok(view.querySelector('[data-status]')!.textContent);
      const saved = await download();
      assert.equal(saved.name, 'book.csv');
      assert.match(await saved.blob.text(), /edited second/);
      button('[data-sheet="0"]').click();
      assert.match(await (await download()).blob.text(), /edited first/);
    });

    await suite.test('later file selection wins over a slower earlier read', async () => {
      let release!: (bytes: ArrayBuffer) => void;
      const slow = new File(['Name\nold'], 'slow.csv');
      Object.defineProperty(slow, 'arrayBuffer', { value: () => new Promise<ArrayBuffer>(resolve => { release = resolve; }) });
      open(slow);
      open(new File(['Name\nnew'], 'latest.csv')); await tick();
      release(new TextEncoder().encode('Name\nold').buffer); await tick();
      const saved = await download();
      assert.equal(saved.name, 'latest.csv');
      assert.match(await saved.blob.text(), /new/);
      assert.equal(view.querySelector<HTMLElement>('[data-tabs]')!.hidden, true);
    });

    await suite.test('download refusal is visible and permits retry', async () => {
      rejectDownload = true; button('[data-dl="csv"]').click(); await tick();
      assert.match(view.querySelector('[data-status]')!.textContent!, /Storage refused/);
      assert.equal(button('[data-dl="csv"]').disabled, false);
      rejectDownload = false;
      assert.equal((await download()).name, 'latest.csv');
    });

    await suite.test('leaving releases the grid and ignores pending reads', async () => {
      let release!: (bytes: ArrayBuffer) => void;
      const slow = new File([], 'after-leave.csv');
      Object.defineProperty(slow, 'arrayBuffer', { value: () => new Promise<ArrayBuffer>(resolve => { release = resolve; }) });
      open(slow); view._cleanup?.();
      release(new TextEncoder().encode('Name\nlate').buffer); await tick();
      assert.equal(view.querySelector('[data-grid]')!.getAttribute('role'), null);
      assert.equal(view.querySelector('.dg-cell'), null);
    });
  } finally {
    view._cleanup?.(); dom.window.close();
    for (const [key, descriptor] of original) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globals[key];
    }
  }
});
