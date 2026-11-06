// SPDX-License-Identifier: MPL-2.0
/**
 * The front door in a real browser: a file dropped on the gallery before the drop router
 * has loaded is still routed, a file dropped on Projects while it is still reading the
 * library is too (on the view, and on the Loading card that covers it after a
 * navigation), and a dialog choice that navigates is not undone by the dialog's own Back.
 *
 * LOLLY_IMPORT_TEST_URL=http://127.0.0.1:5173 node --import ./tests/browser-gpu.ts --test tests/drop-front-door.browser.test.ts
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium, type BrowserContext, type Page } from 'playwright';
import { journeyDiagnostics } from './helpers/journey-diagnostics.ts';
import { gotoSettled } from './helpers/shell-settled.ts';

const origin = process.env.LOLLY_IMPORT_TEST_URL;
const skip = origin ? false : 'set LOLLY_IMPORT_TEST_URL to a local Vite shell';
/** The drop router's module: the source file on a dev shell, its chunk in a build. */
const DROP_ROUTER = /\/drop-router(?:\.ts|-[\w-]+\.js)(?:\?|$)/;
/** A module Projects loads while it reads the library, before it first paints (its recent exports). */
const PROJECTS_READ = /\/export-history(?:\.ts|-[\w-]+\.js)(?:\?|$)/;
const CHOOSER = 'What should Lolly do with this file?';

async function open(): Promise<{ context: BrowserContext; page: Page; close: () => Promise<void> }> {
  const browser = await chromium.launch({ headless: true, channel: process.env.LOLLY_BROWSER_CHANNEL });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  await context.addInitScript(() => {
    for (const key of ['lolly-welcome-dismissed', 'lolly-tips-dismissed', 'lolly-privacy-ack']) localStorage.setItem(key, '1');
  });
  return { context, page: await context.newPage(), close: async () => { await context.close(); await browser.close(); } };
}

/** Drop a text file on whatever is under the middle of the window, as a person would. True when the page takes the drop. */
async function dropAtCentre(page: Page): Promise<{ taken: boolean; onCard: boolean }> {
  return page.evaluate(() => {
    const target = document.elementFromPoint(innerWidth / 2, innerHeight / 2)!;
    const transfer = new DataTransfer();
    transfer.items.add(new File(['Agenda\nWelcome\n'], 'notes.txt', { type: 'text/plain' }));
    target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: transfer }));
    // A drop nothing cancels is the browser's to handle: it opens the file and leaves Lolly.
    const taken = !target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
    return { taken, onCard: !!target.closest('dialog.view-loading') };
  });
}

/** Hold Projects' library read until the returned release is called; `asked` settles once Projects is waiting for that module. */
async function holdProjectsRead(page: Page): Promise<{ asked: Promise<void>; release: () => void }> {
  let release!: () => void, reached!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const asked = new Promise<void>(resolve => { reached = resolve; });
  await page.route(PROJECTS_READ, async route => { reached(); await held; await route.continue(); });
  return { asked, release };
}

test('a file dropped on Projects while it is still loading is routed once it has loaded', { skip, timeout: 120_000 }, async () => {
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin!).hostname));
  const { context, page, close } = await open();
  const diagnose = journeyDiagnostics(context, 'drop-front-door-projects');
  try {
    // A first visit straight to Projects: the boot screen stays in the view until Projects
    // has read the library, which here waits on a module that is held, as on a slow connection.
    const { asked, release } = await holdProjectsRead(page);
    await page.goto(`${origin}/#/p`, { waitUntil: 'domcontentloaded' });
    await asked;
    assert.equal(await page.locator('#view[data-drop-ready]').count(), 0, 'the router has not attached yet');
    const { taken } = await dropAtCentre(page);
    assert.equal(taken, true, 'the page takes the drop instead of the browser');
    release();
    await page.locator('#view[data-drop-ready]').waitFor({ state: 'attached', timeout: 30_000 });
    await page.getByRole('dialog', { name: CHOOSER, exact: true }).waitFor({ timeout: 30_000 });
  } catch (error) { await diagnose(error); throw error; } finally { await close(); }
});

test('a file dropped on the Loading card on the way to Projects is routed there', { skip, timeout: 120_000 }, async () => {
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin!).hostname));
  const { context, page, close } = await open();
  const diagnose = journeyDiagnostics(context, 'drop-front-door-projects-card');
  try {
    await page.goto(origin!, { waitUntil: 'domcontentloaded' });
    await page.locator('#view[data-drop-ready] .gallery').waitFor({ state: 'attached', timeout: 60_000 });
    const { asked, release } = await holdProjectsRead(page);
    await page.evaluate(() => { location.hash = '#/p'; }); // as the Projects link does
    await asked;
    // A slow mount puts the Loading card over the page, so the drop reaches the card.
    await page.locator('dialog.view-loading[open]').waitFor({ timeout: 30_000 });
    const { taken, onCard } = await dropAtCentre(page);
    assert.equal(onCard, true, 'the drop reaches the Loading card');
    assert.equal(taken, true, 'the page takes the drop instead of the browser');
    release();
    await page.locator('#view[data-drop-ready] .projects').waitFor({ state: 'attached', timeout: 30_000 });
    await page.getByRole('dialog', { name: CHOOSER, exact: true }).waitFor({ timeout: 30_000 });
  } catch (error) { await diagnose(error); throw error; } finally { await close(); }
});

test('a file dropped on the gallery before the drop router has loaded is still routed', { skip, timeout: 120_000 }, async () => {
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin!).hostname));
  const { context, page, close } = await open();
  const diagnose = journeyDiagnostics(context, 'drop-front-door-early');
  try {
    // Hold the router's module until the file has been dropped, so the drop comes while
    // the module is still loading, as on a slow first visit.
    let release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    let asked = false;
    await page.route(DROP_ROUTER, async route => { asked = true; await held; await route.continue(); });
    await page.goto(origin!, { waitUntil: 'domcontentloaded' });
    await page.locator('#view .gallery').waitFor({ state: 'attached', timeout: 60_000 });
    await page.waitForFunction(() => document.querySelectorAll('#view .tool-masonry [data-tool]').length > 0, undefined, { timeout: 60_000 });
    assert.equal(await page.locator('#view[data-drop-ready]').count(), 0, 'the router has not attached yet');
    const taken = await page.evaluate(() => {
      const transfer = new DataTransfer();
      transfer.items.add(new File(['Agenda\nWelcome\n'], 'notes.txt', { type: 'text/plain' }));
      const view = document.querySelector('#view')!;
      view.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: transfer }));
      // A drop nothing cancels is the browser's to handle: it opens the file and leaves Lolly.
      return !view.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
    });
    assert.equal(taken, true, 'the page takes the drop instead of the browser');
    assert.equal(asked, true, 'the gallery had asked for the router');
    release();
    await page.locator('#view[data-drop-ready]').waitFor({ state: 'attached', timeout: 30_000 });
    await page.getByRole('dialog', { name: CHOOSER, exact: true }).waitFor({ timeout: 30_000 });
  } catch (error) { await diagnose(error); throw error; } finally { await close(); }
});

test('a dialog choice that navigates is not undone by the dialog closing', { skip, timeout: 120_000 }, async () => {
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin!).hostname));
  const { context, page, close } = await open();
  const diagnose = journeyDiagnostics(context, 'drop-front-door-navigate');
  try {
    await gotoSettled(page, `${origin}/#/utilities`);
    const reached = await page.evaluate(async () => {
      const modalPath = '/src/components/modal.ts', navPath = '/src/nav.ts';
      const { mountModal } = await import(modalPath);
      const { navigateTo } = await import(navPath);
      const modal = mountModal('<p>Choose</p>', { className: 'modal' });
      modal.close('open');
      // The dialog pops its own history entry on the next task. A choice that
      // navigates after a short await (the drop chooser loads a module first) does so
      // just after that Back was issued and before the Back has finished.
      await new Promise(resolve => setTimeout(resolve, 0));
      navigateTo('#/tools');
      await new Promise(resolve => setTimeout(resolve, 1500));
      return location.hash;
    });
    assert.equal(reached, '#/tools', 'the person ends up where the choice took them');
    await page.locator('#view:not([data-route-mounting]) .gallery').waitFor({ state: 'attached' });
  } catch (error) { await diagnose(error); throw error; } finally { await close(); }
});
