// SPDX-License-Identifier: MPL-2.0
/**
 * The front door in a real browser: a file dropped on the gallery before the drop router
 * has loaded is still routed, a file dropped on Projects while it is still reading the
 * library is too (on the view, and on the Loading card that covers it after a
 * navigation), and a dialog choice that navigates is not undone by the dialog's own Back.
 * From the very start of the app (lib/drop-early.ts): a file dropped on the boot screen
 * before any app code has run, on a slow network and CPU, is opened once Lolly has
 * loaded; while the Start studio loads, a drop on its Logos zone goes to Logos and one
 * elsewhere goes to the studio's importer; and a drop made before the person moves to
 * another view is not opened there.
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
/** The app's entry module: the source file on a dev shell, the boot chunk in a build. */
const ENTRY = /\/src\/main\.(?:js|ts)(?:\?|$)|\/_app\/web-boot-[\w-]+\.js(?:\?|$)/;
/** A module the Start studio waits for after it has painted the Logos zone and before it listens for drops. */
const STUDIO_LATE = /\/emoji-brand-control(?:\.ts|-[\w-]+\.js)(?:\?|$)/;
/** Chrome DevTools' Slow 3G: 2 s round trips, 400 kbit/s each way. */
const SLOW_3G = { offline: false, latency: 2000, downloadThroughput: 51_200, uploadThroughput: 51_200 };
const MARK = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#0a7d5a"/></svg>';

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

/** Hold every request matching `pattern` until the returned release is called; `asked` settles once the page asks for one. */
async function hold(page: Page, pattern: RegExp): Promise<{ asked: Promise<void>; release: () => void }> {
  let release!: () => void, reached!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const asked = new Promise<void>(resolve => { reached = resolve; });
  await page.route(pattern, async route => { reached(); await held; await route.continue(); });
  return { asked, release };
}

/** Hold Projects' library read until the returned release is called; `asked` settles once Projects is waiting for that module. */
const holdProjectsRead = (page: Page): Promise<{ asked: Promise<void>; release: () => void }> => hold(page, PROJECTS_READ);

/** Drop an SVG mark on the middle of the first element matching `selector`, as a person would. True when the page takes the drop. */
async function dropMarkOn(page: Page, selector: string): Promise<boolean> {
  return page.evaluate(([selector, mark]) => {
    const box = document.querySelector(selector)!.getBoundingClientRect();
    const [x, y] = [box.left + box.width / 2, box.top + box.height / 2];
    const target = document.elementFromPoint(x, y)!;
    const transfer = new DataTransfer();
    transfer.items.add(new File([mark], 'mark.svg', { type: 'image/svg+xml' }));
    const init = { bubbles: true, cancelable: true, clientX: x, clientY: y, dataTransfer: transfer };
    target.dispatchEvent(new DragEvent('dragenter', init));
    target.dispatchEvent(new DragEvent('dragover', init));
    return !target.dispatchEvent(new DragEvent('drop', init));
  }, [selector, MARK] as const);
}

const IMPORTER = 'dialog[open] [data-start-import-panel]';

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

test('a file dropped on the boot screen before any app code has run is opened once Lolly has loaded', { skip, timeout: 240_000 }, async () => {
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin!).hostname));
  const { context, page, close } = await open();
  const diagnose = journeyDiagnostics(context, 'drop-front-door-boot');
  try {
    // A slow first visit: Slow 3G and a CPU four times slower. The app's entry module is
    // held as well, so the drop comes while only index.html has run, whatever the machine.
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', SLOW_3G);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const entry = await hold(page, ENTRY);
    await page.goto(`${origin}/#/`, { waitUntil: 'commit' });
    await entry.asked;
    await page.locator('#view > p.loading').waitFor({ state: 'attached', timeout: 120_000 });
    assert.equal(await page.evaluate(() => document.querySelector('#view > p.loading') !== null && !document.querySelector('#view .gallery')), true, 'only the boot screen is on show');
    const { taken } = await dropAtCentre(page);
    assert.equal(taken, true, 'the page takes the drop instead of the browser');
    // What follows is ordinary loading, so it runs at full speed to keep the test short.
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    entry.release();
    await page.locator('#view[data-drop-ready]').waitFor({ state: 'attached', timeout: 90_000 });
    await page.getByRole('dialog', { name: CHOOSER, exact: true }).waitFor({ timeout: 30_000 });
  } catch (error) { await diagnose(error); throw error; } finally { await close(); }
});

test('a file dropped on the Start studio\'s Logos zone while the studio loads goes to Logos', { skip, timeout: 120_000 }, async () => {
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin!).hostname));
  const { context, page, close } = await open();
  const diagnose = journeyDiagnostics(context, 'drop-front-door-start-logos');
  try {
    // The studio paints its rooms, the Logos zone among them, before it has read
    // everything it needs and before it listens for drops. Hold it in between.
    const late = await hold(page, STUDIO_LATE);
    await page.goto(`${origin}/#/start?area=logos`, { waitUntil: 'domcontentloaded' });
    await late.asked;
    await page.locator('[data-be-logo-intake]').waitFor({ state: 'visible', timeout: 30_000 });
    assert.equal(await page.locator('#view[data-route-mounting]').count(), 1, 'the studio is still loading');
    assert.equal(await dropMarkOn(page, '[data-be-logo-intake]'), true, 'the page takes the drop instead of the browser');
    late.release();
    await page.locator('#view:not([data-route-mounting]) .start').waitFor({ state: 'attached', timeout: 60_000 });
    await page.locator('[data-be-logo-queue] [data-logo-chip]').first().waitFor({ timeout: 30_000 });
    assert.equal(await page.locator(IMPORTER).count(), 0, 'the mark went to Logos, not to the importer\'s colour scan');
  } catch (error) { await diagnose(error); throw error; } finally { await close(); }
});

test('a file dropped elsewhere on the Start studio while it loads goes to the studio\'s importer', { skip, timeout: 120_000 }, async () => {
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin!).hostname));
  const { context, page, close } = await open();
  const diagnose = journeyDiagnostics(context, 'drop-front-door-start-page');
  try {
    const late = await hold(page, STUDIO_LATE);
    await page.goto(`${origin}/#/start`, { waitUntil: 'domcontentloaded' });
    await late.asked;
    await page.locator('.start h1').waitFor({ state: 'visible', timeout: 30_000 });
    assert.equal(await dropMarkOn(page, '.start h1'), true, 'the page takes the drop instead of the browser');
    late.release();
    await page.locator('#view:not([data-route-mounting]) .start').waitFor({ state: 'attached', timeout: 60_000 });
    await page.locator(IMPORTER).waitFor({ timeout: 30_000 });
    assert.equal(await page.locator('[data-be-logo-queue] [data-logo-chip]').count(), 0, 'nothing went to Logos');
  } catch (error) { await diagnose(error); throw error; } finally { await close(); }
});

test('a file dropped while one view loads is not opened by the view the person moves to', { skip, timeout: 120_000 }, async () => {
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin!).hostname));
  const { context, page, close } = await open();
  const diagnose = journeyDiagnostics(context, 'drop-front-door-left');
  try {
    await page.goto(origin!, { waitUntil: 'domcontentloaded' });
    await page.locator('#view[data-drop-ready] .gallery').waitFor({ state: 'attached', timeout: 60_000 });
    // On the way to the Start studio, which is held while it loads, the person drops a file.
    const late = await hold(page, STUDIO_LATE);
    await page.evaluate(() => { location.hash = '#/start'; });
    await late.asked;
    const { taken } = await dropAtCentre(page);
    assert.equal(taken, true, 'the page takes the drop instead of the browser');
    // Then gives up on the studio and goes back to the gallery, which opens the chooser
    // for any file dropped on the gallery. This drop was made for the studio.
    await page.evaluate(() => { location.hash = '#/'; });
    late.release();
    await page.locator('#view[data-drop-ready] .gallery').waitFor({ state: 'attached', timeout: 60_000 });
    await page.getByText('Lolly did not open notes.txt, because you left the page before it had loaded.', { exact: false }).waitFor({ timeout: 10_000 });
    await page.waitForTimeout(1500);
    assert.equal(await page.getByRole('dialog', { name: CHOOSER, exact: true }).count(), 0, 'the gallery did not open the studio\'s drop');
    assert.equal(await page.locator('#view .start').count(), 0, 'and the person is where they chose to go');
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
