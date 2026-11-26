// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Page, BrowserContext } from 'playwright-core';
import { getBrowser, closeBrowser } from '../packages/node-shell/src/browsers.ts';
import { pollPage } from './helpers/page-poll.ts';

const viteOrigin = process.env.LOLLY_COLLAB_TEST_URL;
const ossDir = new URL('..', import.meta.url).pathname;
const workDir = process.env.LOLLY_WORK_DIR ?? resolve(ossDir, '../lolly-work');
const fixturePath = resolve(workDir, 'tests/collab/browser-fixture.ts');
// The origin is checked first, so a run without it always gives the same reason
// whether or not a lolly-work checkout is present.
function skipReason(): string | false {
  if (!viteOrigin) return 'set LOLLY_COLLAB_TEST_URL to a local Vite shell (the run also needs a lolly-work checkout)';
  if (!existsSync(fixturePath)) return 'the lolly-work collab fixture is missing; set LOLLY_WORK_DIR to a lolly-work checkout';
  return false;
}
const skip = skipReason();
type Row = { id: string; [key: string]: unknown };
interface Fixture {
  base: string; sessionId: string; inputs: { boxes: Row[] };
  readSession(): Promise<{ rev: number; inputs: Record<string, unknown> } | null>;
  suspendConnections(): void; resumeConnections(): void;
  denyEdit(email: string): Promise<void>; revokeJoin(email: string): Promise<void>;
  close(): Promise<void>;
}

test('authenticated work Design: cursors, edits, reconnect, duplicate tabs, viewer and revocation', {
  skip, timeout: 180_000,
}, async () => {
  const { createWorkBrowserFixture } = await import(pathToFileURL(fixturePath).href) as {
    createWorkBrowserFixture(oss: string, vite: string): Promise<Fixture>;
  };
  const fixture = await createWorkBrowserFixture(ossDir, viteOrigin!);
  const browser = await getBrowser();
  const contexts: BrowserContext[] = [], pages: Page[] = [];
  const errors: string[] = [];
  const frames = new Map<Page, { t: string; [key: string]: unknown }[]>();
  async function createPage(email: string, existing?: BrowserContext): Promise<Page> {
    const context = existing ?? await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    context.setDefaultTimeout(20_000);
    if (!existing) {
      contexts.push(context);
      await context.addInitScript(() => localStorage.setItem('lolly-welcome-dismissed', '1'));
      const response = await context.request.get(`${fixture.base}/api/auth/dev?email=${email}`, { maxRedirects: 0 });
      assert.equal(response.status(), 302);
    }
    const page = await context.newPage(); pages.push(page); frames.set(page, []);
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error' || message.type() === 'warning') errors.push(message.text()); });
    page.on('websocket', socket => {
      if (!socket.url().includes('/ws/collab/')) return;
      socket.on('framereceived', event => {
        try { frames.get(page)!.push(JSON.parse(String(event.payload))); } catch { /* diagnostic only */ }
      });
    });
    await page.goto(fixture.base, { waitUntil: 'domcontentloaded' });
    await page.locator('.gallery').waitFor();
    await pollPage(page, async () => {
      const path = '/src/org/collab-config.ts', mount = '/src/lib/collab-live-mount.ts';
      return (await import(path)).canJoinCollab() && (await import(mount)).liveCollabMountInstalled();
    }, undefined, { message: 'the live collab mount' });
    const outcome = await page.evaluate(async sessionId => {
      const path = '/src/org/collab-work-opener.ts';
      return (await import(path)).joinWorkCollabFromInvite({ sessionId, toolId: 'design' });
    }, fixture.sessionId);
    assert.equal(outcome.ok, true, JSON.stringify(outcome));
    await page.locator('#tool-canvas [data-frame-id="board"]').waitFor({ timeout: 20_000 });
    await page.locator('.collab-pill').waitFor();
    assert.equal(await page.locator('.tmpl-chooser-modal').count(), 0, 'joining an existing document does not offer a replacement template');
    return page;
  }
  const saved = (page: Page) => page.waitForFunction(() => document.querySelector('.collab-save-status')?.textContent === 'Saved to work');
  const joinId = (page: Page) => (frames.get(page)!.findLast(frame => frame.t === 'join-ack')?.you as { id: string })?.id;
  async function edit(page: Page, field: string, value: unknown) {
    // The installed canvas API invokes the actual runtime setter and collaboration diff.
    const session = await fixture.readSession();
    const boxes = (session!.inputs.boxes as Row[]).map(row => row.id === 'shape' ? { ...row, [field]: value } : row);
    await page.evaluate(boxes => {
      (window as unknown as { __lollySetInput(id: string, value: unknown): void }).__lollySetInput('boxes', boxes);
    }, boxes);
  }
  async function pointer(page: Page, x: number, y: number) {
    await page.bringToFront();
    const board = page.locator('#tool-canvas [data-frame-id="board"]');
    const bounds = await board.boundingBox(); assert.ok(bounds);
    await board.hover({ position: { x: bounds.width*x, y: bounds.height*y } });
  }
  try {
    const alice = await createPage('alice@test');
    const bob = await createPage('bob@test');
    await saved(alice); await saved(bob);
    await pointer(alice, .25, .4);
    await bob.waitForFunction(id => {
      const cursor = document.querySelector<HTMLElement>(`.collab-cursor[data-client-id="${id}"]`);
      return !!cursor && !cursor.hidden;
    }, joinId(alice));
    const shape = await alice.locator('#tool-canvas [data-box-id="shape"]').boundingBox(); assert.ok(shape);
    await alice.mouse.move(shape.x+shape.width/2, shape.y+shape.height/2);
    await alice.mouse.down();
    await alice.mouse.move(shape.x+shape.width/2+30, shape.y+shape.height/2, { steps: 5 });
    await alice.mouse.up();
    await bob.waitForFunction(() => parseFloat(document.querySelector<HTMLElement>('#tool-canvas [data-box-id="shape"]')?.style.left ?? '60') > 60);
    await edit(alice, 'x', 110); await saved(alice);
    await bob.waitForFunction(() => document.querySelector<HTMLElement>('[data-box-id="shape"]')?.style.left === '110px');
    await edit(bob, 'bg', '#3366ff'); await saved(bob);
    await alice.waitForFunction(() => document.querySelector<HTMLElement>('[data-box-id="shape"]')?.style.backgroundColor === 'rgb(51, 102, 255)');

    const oldAlice = joinId(alice);
    fixture.suspendConnections();
    await alice.waitForFunction(() => /disconnected/.test(document.querySelector('.collab-save-status')?.textContent ?? ''));
    await edit(alice, 'x', 170);
    await alice.waitForFunction(() => /pending/.test(document.querySelector('.collab-save-status')?.textContent ?? ''));
    fixture.resumeConnections();
    await saved(alice); await saved(bob);
    assert.notEqual(joinId(alice), oldAlice);
    await bob.waitForFunction(() => document.querySelector<HTMLElement>('[data-box-id="shape"]')?.style.left === '170px');
    await pointer(alice, .6, .3);
    await bob.waitForFunction(({ old, current }) => !document.querySelector(`[data-client-id="${old}"]`)
      && !!document.querySelector(`.collab-cursor[data-client-id="${current}"]`), { old: oldAlice, current: joinId(alice) });

    const duplicate = await createPage('alice@test', alice.context());
    assert.notEqual(joinId(duplicate), joinId(alice));
    await pointer(duplicate, .7, .5);
    await bob.waitForFunction(ids => ids.every(id => !!document.querySelector(`.collab-cursor[data-client-id="${id}"]`)), [joinId(alice), joinId(duplicate)]);
    const duplicateId = joinId(duplicate); await duplicate.close();
    await bob.waitForFunction(id => !document.querySelector(`[data-client-id="${id}"]`), duplicateId);

    const viewer = await createPage('viewer@test');
    await viewer.waitForFunction(() => document.querySelector('.collab-save-status')?.textContent === 'View only');
    await pointer(viewer, .2, .2);
    await alice.waitForFunction(id => !!document.querySelector(`.collab-cursor[data-client-id="${id}"]`), joinId(viewer));
    const revision = (await fixture.readSession())!.rev;
    await edit(viewer, 'x', 999);
    assert.equal(await viewer.locator('#tool-canvas [data-box-id="shape"]').evaluate(el => (el as HTMLElement).style.left), '170px');
    assert.equal((await fixture.readSession())!.rev, revision);

    await fixture.denyEdit('bob@test');
    await bob.waitForFunction(() => document.querySelector('.collab-save-status')?.textContent === 'View only');
    await edit(bob, 'x', 888);
    assert.equal((await fixture.readSession())!.rev, revision);
    await fixture.revokeJoin('viewer@test');
    await viewer.waitForFunction(() => /disconnected/.test(document.querySelector('.collab-save-status')?.textContent ?? ''));
    await alice.waitForFunction(id => !document.querySelector(`[data-client-id="${id}"]`), joinId(viewer));
  } catch (error) {
    console.error('Work Design browser diagnostics', { errors, session: await fixture.readSession(), pages: await Promise.all(pages.filter(page => !page.isClosed()).map(async page => ({ url: page.url(), body: await page.evaluate(() => document.body.innerText.slice(0, 1800)), pill: await page.evaluate(() => document.querySelector('.collab-pill')?.textContent), frames: frames.get(page)?.slice(-4) }))) });
    throw error;
  } finally {
    for (const context of contexts) await context.close();
    await closeBrowser(); await fixture.close();
  }
});
