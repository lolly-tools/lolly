// SPDX-License-Identifier: MPL-2.0
/**
 * The dashed choose-a-file tiles take a dropped file (lib/file-drop-tile.ts): My
 * images' Add tile, the Logos room's slot tiles and its custom-mark form. A drop goes
 * through the same door a picked file goes through, so a refusal reads the same.
 * Remove background is covered by views/matte-dialog-job.test.ts (its model download
 * is too heavy for this file).
 *
 * Gated on LOLLY_IMPORT_TEST_URL (a local Vite shell), like brand-workflow.browser.test.ts.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import type { Page } from 'playwright';
import { chromium } from 'playwright';
import { packPng } from '../engine/src/png.ts';
import { shellSettled } from './helpers/shell-settled.ts';

const origin = process.env.LOLLY_IMPORT_TEST_URL;
const options = { skip: origin ? false : 'set LOLLY_IMPORT_TEST_URL to a local Vite shell', timeout: 120_000 };

// A tight, fully opaque mark: no transparent margin, so no trim card is offered.
const PNG = Array.from(packPng(new Uint8Array(48 * 24 * 4).fill(200), { width: 48, height: 24 }));

interface DropFile { name: string; type: string; bytes: number[] }
const png = (name = 'mark.png'): DropFile => ({ name, type: 'image/png', bytes: PNG });
const notes: DropFile = { name: 'notes.txt', type: 'text/plain', bytes: Array.from(new TextEncoder().encode('not a picture')) };

interface OverState { prevented: boolean; dragover: boolean; borderStyle: string; cue: string }

/** Dispatch a file dragenter and dragover on the first match; report the tile's state. */
function dragOver(page: Page, selector: string, files: DropFile[] = [png()]): Promise<OverState> {
  return page.evaluate(({ selector, files }) => {
    const el = document.querySelector<HTMLElement>(selector);
    if (!el) throw new Error(`no ${selector}`);
    const transfer = new DataTransfer();
    for (const f of files) transfer.items.add(new File([new Uint8Array(f.bytes)], f.name, { type: f.type }));
    el.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer: transfer }));
    const over = new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: transfer });
    el.dispatchEvent(over);
    const tile = el.closest<HTMLElement>('[data-file-drop]') ?? el;
    return {
      prevented: over.defaultPrevented,
      dragover: tile.classList.contains('is-dragover'),
      borderStyle: getComputedStyle(tile).borderTopStyle,
      cue: getComputedStyle(tile, '::after').content,
    };
  }, { selector, files });
}

/** Dispatch a file drop on the first match. */
function drop(page: Page, selector: string, files: DropFile[]): Promise<void> {
  return page.evaluate(({ selector, files }) => {
    const el = document.querySelector<HTMLElement>(selector);
    if (!el) throw new Error(`no ${selector}`);
    const transfer = new DataTransfer();
    for (const f of files) transfer.items.add(new File([new Uint8Array(f.bytes)], f.name, { type: f.type }));
    el.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
  }, { selector, files });
}

async function openPage(origin: string) {
  const browser = await chromium.launch({ headless: true, channel: process.env.LOLLY_BROWSER_CHANNEL });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    for (const key of ['lolly-welcome-dismissed', 'lolly-tips-dismissed', 'lolly-privacy-ack']) localStorage.setItem(key, '1');
  });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname));
  return { browser, page, errors };
}

test('My images: the Add tile takes a dropped image and refuses what the picker refuses', options, async () => {
  const { browser, page, errors } = await openPage(origin!);
  try {
    await page.goto(`${origin}/#/profile?focus=storage-section`, { waitUntil: 'networkidle' }); await shellSettled(page);
    await page.locator('#userimg-grid').waitFor({ state: 'attached', timeout: 30_000 });
    await page.evaluate(() => {
      let d = document.querySelector('#userimg-grid')?.closest('details');
      while (d) { d.open = true; d = d.parentElement?.closest('details') ?? null; }
    });
    const tiles = page.locator('#userimg-grid [data-userimg]');
    const before = await tiles.count();

    const over = await dragOver(page, '#userimg-add');
    assert.equal(over.prevented, true, 'the tile answers a file drag');
    assert.equal(over.dragover, true);
    assert.equal(over.borderStyle, 'solid', 'the dashes turn solid while a file is over the tile');
    assert.equal(over.cue, '"Drop to add"', 'and the cue says what a drop does');

    await drop(page, '#userimg-add', [png('dropped.png')]);
    await page.waitForFunction(n => document.querySelectorAll('#userimg-grid [data-userimg]').length === n, before + 1);
    assert.equal(await page.locator('#userimg-add.is-dragover').count(), 0, 'the drop clears the drag-over state');

    const error = page.locator('#userimg-error');
    await drop(page, '#userimg-add', [notes]);
    await error.filter({ hasText: 'That file is not an image or a video.' }).waitFor();
    assert.equal(await tiles.count(), before + 1, 'nothing was stored for the text file');

    // Parity: the picker path refuses the same file with the same sentence.
    await page.evaluate(() => { const e = document.querySelector<HTMLElement>('#userimg-error'); if (e) { e.hidden = true; e.textContent = ''; } });
    await page.locator('#userimg-file').setInputFiles({ name: notes.name, mimeType: notes.type, buffer: Buffer.from(notes.bytes) });
    await error.filter({ hasText: 'That file is not an image or a video.' }).waitFor();
    assert.equal(await tiles.count(), before + 1);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('Logos room: slot tiles and the custom-mark form take a dropped file, and keep the importer shut', options, async () => {
  const { browser, page, errors } = await openPage(origin!);
  try {
    await page.goto(`${origin}/#/profile?focus=design-systems-section`, { waitUntil: 'networkidle' }); await shellSettled(page);
    await page.locator('[data-ds-act="new"]').waitFor();
    await page.getByRole('button', { name: 'Make a new one', exact: true }).click();
    await page.waitForURL('**/#/start?rename=1');
    await page.locator('dialog.view-loading').waitFor({ state: 'detached' });
    const importer = page.locator('[data-ds-src-tiles]');
    const railDrag = () => page.evaluate(() => {
      const rail = document.querySelector('.ds-rail');
      if (!rail) throw new Error('no rail');
      const transfer = new DataTransfer();
      transfer.items.add(new File(['x'], 'a.png', { type: 'image/png' }));
      rail.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer: transfer }));
      rail.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: transfer }));
    });

    // A room without drop areas of its own still opens the importer on a file drag.
    await page.locator('[data-ds-room="color"]').click();
    await railDrag();
    await importer.waitFor({ state: 'attached' });
    await page.keyboard.press('Escape');
    await importer.waitFor({ state: 'detached' });

    // The Logos room keeps the drag, even with every fold closed (the default).
    await page.locator('[data-ds-room="logos"]').click();
    await page.locator('[data-be-logos] .be-logo-drop').first().waitFor({ state: 'attached' });
    await railDrag();
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => setTimeout(r, 200))));
    assert.equal(await importer.count(), 0, 'no importer opens over the Logos room');

    // A repaint after a placement closes the folds again, so each step reopens them.
    const openFolds = () => page.evaluate(() => document.querySelectorAll<HTMLDetailsElement>('details.be-logo-group').forEach(d => { d.open = true; }));
    await openFolds();
    const empty = '[data-be-logos] .be-logo-slot:not(.is-filled) .be-logo-drop';
    const variant = await page.locator(empty).first().locator('[data-logo-file]').getAttribute('data-logo-file');
    assert.ok(variant);
    const over = await dragOver(page, empty);
    assert.equal(over.prevented, true);
    assert.equal(over.borderStyle, 'solid');
    assert.equal(over.cue, '"Drop to add"');
    assert.equal(await importer.count(), 0, 'a drag over a tile never opens the importer');

    await drop(page, empty, [png('primary.png')]);
    await page.locator(`[data-be-logos] .be-logo-slot.is-filled[data-be-logo="${variant}"]`).waitFor();
    const filled = `[data-be-logos] .be-logo-slot.is-filled[data-be-logo="${variant}"] .be-logo-drop`;
    assert.equal((await dragOver(page, filled)).cue, '"Drop to replace"', 'a filled tile says a drop replaces the mark');

    const err = page.locator('[data-be-logo-err]');
    await drop(page, empty, [notes]);
    await err.filter({ hasText: 'Use a PNG, JPEG, SVG or WebP image.' }).waitFor();
    await drop(page, empty, [png('a.png'), png('b.png')]);
    await err.filter({ hasText: 'Drop one file at a time here.' }).waitFor();

    const form = '[data-be-logos] .be-logo-addmark';
    assert.equal((await dragOver(page, form)).borderStyle, 'solid');
    await drop(page, form, [png('icon.png')]);
    await err.filter({ hasText: 'Name the mark first - letters and numbers, e.g. "Icon".' }).waitFor();
    await openFolds();
    await page.locator(`${form} [data-addmark-name]`).fill('Icon');
    await drop(page, form, [png('icon.png')]);
    await page.locator('[data-be-logos] .be-logo-slot.is-filled[data-treatment="custom"]').waitFor();
    assert.equal(await importer.count(), 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
