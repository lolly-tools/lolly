// SPDX-License-Identifier: MPL-2.0
/**
 * Plan 76 milestone 4: finding and resuming a review (release 1), and following,
 * presenting and versions (release 2), in a real browser against a local lolly-work
 * built from PR-W1a or PR-W1b (tests/collab/browser-fixture.ts).
 *
 * People: the owner (admin@test, who made the project), an editor (alice@test), a
 * reviewer who may comment but not edit (viewer@test), and outsider@test, who is in
 * another group and cannot open the project. Release 1 has three journeys:
 *
 *  1. mentions, the inbox notice and Open thread, live unread state, the four filters,
 *     Mark all as read, jumping to a thread on another artboard, Previous/Next and
 *     hiding pins;
 *  2. a thread link opened by someone without access, who asks, is approved more than
 *     two minutes later, and then sees the thread open in the same tab;
 *  3. an edit interrupted by a lost connection keeps a recovery notice until the person
 *     dismisses the notice, and the copy records the account that made the edit.
 *
 * Release 2 adds two more:
 *
 *  4. Hide pointers on one device; following a person (continuous, Escape returns,
 *     the person's own navigation stops it and keeps the view, the leader leaving ends
 *     it) with the followers named to the person followed; one presenter shown when two
 *     present, and following a presentation from slide to slide until it ends;
 *  5. saving a named version, its preview, a restore with three people in the document,
 *     Undo restore, and a manager deleting the version.
 *
 * Opt in with LOLLY_COLLAB_TEST_URL (a local Vite shell of this checkout) and
 * LOLLY_WORK_DIR (a lolly-work checkout with the M4 comment routes; journey 5 also needs
 * its session versions). CI skips it with the exact entries in tests/expected-skips.json.
 * Message mentions and presenting also need the review contract in packages/core
 * (PR-L1). LOLLY_M4_SHOTS=<dir> keeps a screenshot of every page when a journey fails.
 * Waits are DOM predicates evaluated on animation frames, never async predicates.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Browser, BrowserContext, Page } from 'playwright-core';
import { getBrowser, closeBrowser } from '../packages/node-shell/src/browsers.ts';

const viteOrigin = process.env.LOLLY_COLLAB_TEST_URL;
const ossDir = new URL('..', import.meta.url).pathname;
const workDir = process.env.LOLLY_WORK_DIR ?? resolve(ossDir, '../lolly-work');
const fixturePath = resolve(workDir, 'tests/collab/browser-fixture.ts');
function skipReason(): string | false {
  if (!viteOrigin) return 'set LOLLY_COLLAB_TEST_URL to a local Vite shell (the run also needs a lolly-work checkout)';
  if (!existsSync(fixturePath)) return 'the lolly-work collab fixture is missing; set LOLLY_WORK_DIR to a lolly-work checkout';
  if (!existsSync(resolve(workDir, 'server/src/comments/mentions.ts'))) return 'the lolly-work checkout has no comment mentions; use one built from PR-W1a';
  return false;
}
const skip = skipReason();
/** Journey 5 needs the instance's saved versions (PR-W1b). */
const versionsSkip: string | false = skip || (existsSync(resolve(workDir, 'server/src/versions/routes.ts')) ? false
  : 'the lolly-work checkout has no session versions; use one built from PR-W1b');

type Row = { id: string; [key: string]: unknown };
interface Fixture {
  base: string; sessionId: string; inputs: { boxes: Row[] };
  readSession(): Promise<{ rev: number; inputs: Record<string, unknown> } | null>;
  suspendConnections(): void; resumeConnections(): void;
  close(): Promise<void>;
}
interface Person { email: string; context: BrowserContext; page: Page; commentFrames: { threadId: string; at: number }[] }
interface Thread { id: string; anchor: { surface: string }; messages: { id: string; body: string; authorId: string }[]; resolvedAt?: string }

const LABEL = 'Browser session';
const SECOND_BOARD: Row[] = [
  { id: 'board2', kind: 'frame', name: 'Board 2', x: 2400, y: 0, w: 600, h: 400, rot: 0, bg: '#f4f4f4', clipChildren: true },
  { id: 'shape2', kind: 'box', frame: 'board2', x: 2560, y: 120, w: 160, h: 120, rot: 0, shape: 'ellipse', bg: '#22aa66' },
];

/** One test's world: the fixture, the browser, and everyone's pages and diagnostics. */
async function world() {
  const { createWorkBrowserFixture } = await import(pathToFileURL(fixturePath).href) as {
    createWorkBrowserFixture(oss: string, vite: string): Promise<Fixture>;
  };
  const fixture = await createWorkBrowserFixture(ossDir, viteOrigin!);
  const browser: Browser = await getBrowser();
  const people: Person[] = [];
  const errors: string[] = [];

  async function person(email: string): Promise<Person> {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    context.setDefaultTimeout(25_000);
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: fixture.base });
    await context.addInitScript(() => localStorage.setItem('lolly-welcome-dismissed', '1'));
    const login = await context.request.get(`${fixture.base}/api/auth/dev?email=${encodeURIComponent(email)}`, { maxRedirects: 0 });
    assert.equal(login.status(), 302, `dev sign-in for ${email}`);
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(`${email}: ${error.message}`));
    const who: Person = { email, context, page, commentFrames: [] };
    // The live room's comment frames, with the time each arrived (ids and a revision only).
    page.on('websocket', socket => {
      if (!socket.url().includes('/ws/collab/')) return;
      socket.on('framereceived', frame => {
        try {
          const value = JSON.parse(String(frame.payload)) as { t?: string; threadId?: string };
          if (value.t === 'comment' && typeof value.threadId === 'string') who.commentFrames.push({ threadId: value.threadId, at: Date.now() });
        } catch { /* binary or partial frames are not comment frames */ }
      });
    });
    people.push(who);
    return who;
  }
  async function api<T>(who: Person, method: string, path: string, body?: unknown, expected = [200, 201, 202]): Promise<T> {
    const response = await who.context.request.fetch(`${fixture.base}${path}`, {
      method, headers: { 'content-type': 'application/json' }, ...(body === undefined ? {} : { data: body }),
    });
    assert.ok(expected.includes(response.status()), `${method} ${path}: ${response.status()} ${await response.text()}`);
    return await response.json() as T;
  }
  async function comments(who: Person): Promise<{ threads: Thread[]; reads?: Record<string, string>; readFloor?: string; features?: Record<string, boolean> }> {
    return await api(who, 'GET', `/api/v1/sessions/${fixture.sessionId}/comments`);
  }
  async function dispose(): Promise<void> {
    for (const who of people) await who.context.close().catch(() => {});
    await closeBrowser(); await fixture.close();
  }
  async function diagnostics(): Promise<unknown> {
    const shots = process.env.LOLLY_M4_SHOTS;
    if (shots) for (const who of people) if (!who.page.isClosed()) await who.page.screenshot({ path: `${shots}/${who.email.split('@')[0]}.png` }).catch(() => {});
    return {
      errors: errors.slice(-20),
      pages: await Promise.all(people.filter(who => !who.page.isClosed()).map(async who => ({
        email: who.email, url: who.page.url(),
        body: await who.page.evaluate(() => document.body.innerText.slice(0, 1500)).catch(() => ''),
      }))),
    };
  }
  return { fixture, person, api, comments, dispose, diagnostics };
}

/** Open the session from its team link (optionally a thread link) and wait for the live room and the Comments button. */
async function openSession(page: Page, base: string, sessionId: string, thread?: string): Promise<void> {
  await page.goto(`${base}/#/team/${encodeURIComponent(sessionId)}${thread ? `?thread=${encodeURIComponent(thread)}` : ''}`, { waitUntil: 'domcontentloaded' });
  await live(page);
}
async function live(page: Page): Promise<void> {
  await page.waitForFunction(() => document.querySelector('.collab-dot')?.getAttribute('data-state') === 'live', null, { polling: 'raf', timeout: 40_000 });
  await page.locator('#tool-canvas [data-frame-id="board"]').waitFor();
  await page.waitForFunction(() => {
    const open = document.querySelector<HTMLButtonElement>('.collab-comments-open');
    return !!open && !open.hidden;
  }, null, { polling: 'raf' });
}
/** The pill floats over the canvas, so press its controls in the page (as the docs drills do). */
async function press(page: Page, selector: string): Promise<void> {
  await page.locator(selector).first().waitFor({ state: 'attached' });
  await page.locator(selector).first().evaluate(element => (element as HTMLElement).click());
}
async function panelButton(page: Page, name: string): Promise<void> {
  await page.locator('.collab-comments-panel').getByRole('button', { name, exact: true }).first().click();
}
async function openPanel(page: Page): Promise<void> {
  if (await page.locator('.collab-comments-panel').evaluate(panel => !(panel as HTMLElement).hidden)) return;
  await press(page, '.collab-comments-open');
  await page.waitForFunction(() => document.querySelector<HTMLElement>('.collab-comments-panel')?.hidden === false, null, { polling: 'raf' });
}
async function closePanel(page: Page): Promise<void> {
  if (await page.locator('.collab-comments-panel').evaluate(panel => (panel as HTMLElement).hidden)) return;
  await panelButton(page, 'Close comments');
  await page.waitForFunction(() => document.querySelector<HTMLElement>('.collab-comments-panel')?.hidden === true, null, { polling: 'raf' });
}
const commentsLabel = (page: Page) => page.locator('.collab-comments-open').first().getAttribute('aria-label');
async function waitForLabel(page: Page, label: string, timeout = 25_000): Promise<number> {
  const started = Date.now();
  await page.waitForFunction(text => (document.querySelector('.collab-comments-open')?.getAttribute('aria-label') ?? 'Comments') === text, label, { polling: 'raf', timeout });
  return Date.now() - started;
}
/** Back from an open thread to the thread list, where the filters are. */
async function showList(page: Page): Promise<void> {
  const back = page.locator('.collab-comments-panel header').getByRole('button', { name: 'Comments', exact: true });
  if (await back.isVisible()) await back.click();
  await page.locator('.collab-comment-list').waitFor();
}
async function chooseFilter(page: Page, filter: 'open' | 'resolved' | 'unread' | 'involving'): Promise<void> {
  await showList(page);
  await page.locator(`.collab-comments-panel [role="radiogroup"][aria-label="Comment filter"] [data-filter="${filter}"]`).click();
}
const listedThreads = (page: Page) => page.locator('.collab-comment-list [data-comment-thread]').evaluateAll(rows => rows.map(row => row.getAttribute('data-comment-thread')));
const pinFor = (page: Page, id: string) => page.locator(`.collab-comment-pins [data-comment-thread="${id}"]`);
/** Fetch the inbox now (what a focus event does once a minute) and return the comment notices. */
async function inboxNotices(page: Page): Promise<{ id: string; title: string; data?: Record<string, string> }[]> {
  return await page.evaluate(async () => {
    const path = '/src/org/inbox.ts';
    const inbox = await import(/* @vite-ignore */ path) as {
      refreshInbox(o: { force: boolean }): Promise<boolean>;
      inboxMessages(): readonly { id: string; title: string; data?: Record<string, string> }[];
    };
    await inbox.refreshInbox({ force: true });
    return inbox.inboxMessages().filter(m => m.id.startsWith('cn_')).map(m => ({ id: m.id, title: m.title, ...(m.data ? { data: m.data } : {}) }));
  });
}
async function waitForNotice(page: Page, kind: string, threadId: string): Promise<{ id: string; title: string }> {
  const deadline = Date.now() + 30_000;
  for (;;) {
    const found = (await inboxNotices(page)).find(m => m.data?.kind === kind && m.data.threadId === threadId);
    if (found) return found;
    assert.ok(Date.now() < deadline, `no ${kind} notice for ${threadId}`);
    await page.waitForTimeout(500);
  }
}
async function openInbox(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const path = '/src/org/inbox-sheet.ts';
    (await import(/* @vite-ignore */ path) as { openInboxSheet(): void }).openInboxSheet();
  });
  await page.locator('.inbox-sheet').waitFor();
}
/** The threads the panel lists, as the list shows them, and the thread now open. */
async function waitThreadOpen(page: Page, threadId: string, text: string): Promise<void> {
  await page.waitForFunction(({ text }) => {
    const panel = document.querySelector<HTMLElement>('.collab-comments-panel');
    const tools = document.querySelector<HTMLElement>('.collab-comment-thread-tools');
    return !!panel && !panel.hidden && !!tools && !tools.hidden
      && (document.querySelector('.collab-comment-messages')?.textContent ?? '').includes(text);
  }, { text, threadId }, { polling: 'raf', timeout: 40_000 });
}
test('M4 review: mentions, inbox notice, Open thread, unread, filters, jump and pins with three people', {
  skip, timeout: 360_000,
}, async () => {
  const w = await world();
  try {
    const owner = await w.person('admin@test');
    const editor = await w.person('alice@test');
    const reviewer = await w.person('viewer@test');
    const outsider = await w.person('outsider@test');
    // A second artboard, and a thread pinned on its shape before anyone lists comments.
    const before = await w.fixture.readSession();
    await w.api(owner, 'PUT', `/api/v1/sessions/${w.fixture.sessionId}`, { rev: before!.rev, inputs: { ...before!.inputs, boxes: [...(before!.inputs.boxes as Row[]), ...SECOND_BOARD] } });
    const far = await w.api<{ thread: Thread }>(owner, 'POST', `/api/v1/sessions/${w.fixture.sessionId}/comments`, {
      id: 'th_board2', messageId: 'm_board2', body: 'Check the green ellipse on the second board.',
      anchor: { kind: 'object', collection: 'boxes', objectId: 'shape2', surface: 'board2', x: .5, y: .5, at: { x: 2640, y: 180 } },
    });
    const farId = far.thread.id;

    await openSession(owner.page, w.fixture.base, w.fixture.sessionId);
    await openSession(reviewer.page, w.fixture.base, w.fixture.sessionId);
    await reviewer.page.waitForFunction(() => document.querySelector('.collab-save-status')?.textContent === 'View only', null, { polling: 'raf' });
    await editor.page.goto(w.fixture.base, { waitUntil: 'domcontentloaded' });
    await editor.page.locator('.gallery').waitFor();

    // M1: the reviewer pins a comment on the shape and mentions the editor; the outsider is never offered.
    await openPanel(reviewer.page);
    await panelButton(reviewer.page, 'Pin a comment');
    await reviewer.page.locator('#tool-canvas [data-box-id="shape"]').click();
    const input = reviewer.page.locator('.collab-comment-composer textarea');
    await input.waitFor();
    assert.equal(await input.getAttribute('placeholder'), 'Comment or reply. Type @ to mention someone.');
    await input.pressSequentially('@');
    const options = reviewer.page.locator('.collab-comment-mentions [role="option"]');
    await options.first().waitFor();
    const offered = await options.allTextContents();
    assert.ok(offered.includes('Alice') && offered.includes('Bob'), `team members are offered: ${offered.join(', ')}`);
    assert.ok(!offered.some(name => /Outsider|outsider@|@test/.test(name)), `no outsider and no email address: ${offered.join(', ')}`);
    assert.ok(!offered.includes('Viewer'), 'the author is never offered');
    await input.pressSequentially('Ou');
    await reviewer.page.waitForFunction(() => !document.querySelector('.collab-comment-mentions [role="option"]'), null, { polling: 'raf' });
    await input.press('Backspace'); await input.press('Backspace');
    await input.pressSequentially('Al');
    await reviewer.page.waitForFunction(() => [...document.querySelectorAll('.collab-comment-mentions [role="option"]')].map(o => o.textContent).join() === 'Alice', null, { polling: 'raf' });
    await input.press('Enter');
    assert.equal(await input.inputValue(), '@Alice ');
    const body = 'please check the pink shape colour';
    await input.pressSequentially(body);
    await reviewer.page.locator('.collab-comment-composer button[type="submit"]').click();
    await reviewer.page.waitForFunction(() => document.querySelector('.collab-comments-panel [role="status"]')?.textContent === 'Comment saved.', null, { polling: 'raf' });
    const listed = await w.comments(owner);
    const mention = listed.threads.find(thread => thread.id !== farId);
    assert.ok(mention, 'the new thread is stored');
    assert.equal(listed.features?.mentions, true);
    assert.equal(listed.features?.events, true);
    const mentionId = mention.id;
    await closePanel(reviewer.page);

    // The outsider can neither be suggested nor read the session's comments.
    await w.api(outsider, 'GET', `/api/v1/sessions/${w.fixture.sessionId}/comments`, undefined, [403, 404]);

    // M1: the editor, on the gallery, gets the notice; Open thread opens the canvas, the room and the thread.
    const notice = await waitForNotice(editor.page, 'comment-mention', mentionId);
    await openInbox(editor.page);
    const row = editor.page.locator(`.inbox-sheet [data-msg="${notice.id}"]`);
    assert.equal((await row.locator('strong').first().textContent())?.trim(), `Viewer mentioned you in ${LABEL}`);
    const openThread = row.locator('[data-act="inbox-open-thread"]');
    assert.equal(await openThread.getAttribute('href'), `#/team/${w.fixture.sessionId}?thread=${mentionId}`, 'built from data, never cta.url');
    await openThread.click();
    await live(editor.page);
    await waitThreadOpen(editor.page, mentionId, body);
    // The stored mention is drawn as text in a <strong>, with the name the server recorded.
    assert.equal(await editor.page.locator('.collab-comment-messages strong.collab-comment-mention').first().textContent(), '@Alice');
    await pinFor(editor.page, mentionId).waitFor();
    assert.equal((await inboxNotices(editor.page)).some(m => m.id === notice.id), false, 'following the notice acknowledges it');

    // M2: the editor replies; the reviewer's closed panel shows the unread thread within about a second, and a notice.
    assert.equal(await commentsLabel(reviewer.page), 'Comments');
    const reply = editor.page.locator('.collab-comment-composer textarea');
    await reply.fill('Done, the colour is fixed.');
    // Time from the saved write (the editor's POST answer) to the reviewer's comment frame and unread badge.
    let savedAt = 0;
    const onSaved = (response: { url(): string; request(): { method(): string } }) => {
      if (response.request().method() === 'POST' && response.url().endsWith(`/comments/${mentionId}`)) savedAt = Date.now();
    };
    editor.page.on('response', onSaved);
    const clickedAt = Date.now();
    await editor.page.locator('.collab-comment-composer button[type="submit"]').click();
    await waitForLabel(reviewer.page, 'Comments, 1 unread');
    const badgeAt = Date.now();
    editor.page.off('response', onSaved);
    const frameAt = reviewer.commentFrames.find(frame => frame.threadId === mentionId && frame.at >= clickedAt)?.at ?? 0;
    console.log(`reply: click -> saved ${savedAt - clickedAt} ms; saved -> reviewer comment frame ${frameAt ? frameAt - savedAt : 'none'} ms; saved -> unread badge ${badgeAt - savedAt} ms`);
    assert.ok(frameAt > 0, 'the reviewer received a comment frame for the reply');
    assert.ok(savedAt > 0, 'the reply was saved');
    // The M4f gate: peer visibility under one second in the local browser.
    assert.ok(badgeAt - savedAt < 1_000, `the reply reached the reviewer through the live room (${badgeAt - savedAt} ms)`);
    await reviewer.page.locator('.collab-comments-open .collab-comments-badge').waitFor();
    await waitForNotice(reviewer.page, 'comment-reply', mentionId);
    // The owner is not involved: the thread is unread for them, but they get no notice.
    await waitForLabel(owner.page, 'Comments, 1 unread');
    assert.equal((await inboxNotices(owner.page)).length, 0, 'no notice for someone not in the thread');

    // M4: filters. The owner reads the Unread filter, then Mark all as read empties the filter.
    await openPanel(owner.page);
    await chooseFilter(owner.page, 'unread');
    assert.deepEqual(await listedThreads(owner.page), [mentionId]);
    await owner.page.locator('.collab-comment-list [data-unread="true"]').first().waitFor();
    await owner.page.locator('.collab-comments-panel').getByRole('button', { name: 'Mark all as read' }).click();
    await waitForLabel(owner.page, 'Comments');
    await owner.page.waitForFunction(() => document.querySelector('.collab-comment-list')?.textContent?.includes('No unread threads.'), null, { polling: 'raf' });
    const ownerReads = await w.comments(owner);
    assert.ok(ownerReads.reads && Object.hasOwn(ownerReads.reads, mentionId), 'the read is stored for the owner only');

    // The reviewer: Open threads lists both, Involving me only theirs; opening the thread marks it read.
    await openPanel(reviewer.page);
    await chooseFilter(reviewer.page, 'open');
    assert.deepEqual((await listedThreads(reviewer.page)).sort(), [farId, mentionId].sort());
    await chooseFilter(reviewer.page, 'involving');
    assert.deepEqual(await listedThreads(reviewer.page), [mentionId]);
    await chooseFilter(reviewer.page, 'open');
    await reviewer.page.locator(`.collab-comment-list [data-comment-thread="${mentionId}"]`).click();
    await waitThreadOpen(reviewer.page, mentionId, 'Done, the colour is fixed.');
    await waitForLabel(reviewer.page, 'Comments');
    // Reading the thread clears the reviewer's reply notice as well (M2).
    for (const deadline = Date.now() + 15_000; (await inboxNotices(reviewer.page)).some(m => m.data?.threadId === mentionId);) {
      assert.ok(Date.now() < deadline, 'the reply notice leaves the inbox once the thread is read');
      await reviewer.page.waitForTimeout(500);
    }

    // Jump: Next thread walks to the thread on the second artboard, which becomes the
    // artboard in view (pins are drawn for that artboard only); Previous comes back.
    assert.equal(await pinFor(reviewer.page, farId).count(), 0, 'the second artboard is not the one in view yet');
    const board2Before = await reviewer.page.locator('#tool-canvas [data-frame-id="board2"]').boundingBox();
    await panelButton(reviewer.page, 'Next thread');
    await waitThreadOpen(reviewer.page, farId, 'green ellipse');
    await pinFor(reviewer.page, farId).waitFor();
    await reviewer.page.waitForFunction(id => !document.querySelector(`.collab-comment-pins [data-comment-thread="${id}"]`), mentionId, { polling: 'raf' });
    const board2After = await reviewer.page.locator('#tool-canvas [data-frame-id="board2"]').boundingBox();
    assert.ok(board2Before && board2After && board2After.width > board2Before.width * 2, `the view moved to the second artboard: ${JSON.stringify({ board2Before, board2After })}`);
    await panelButton(reviewer.page, 'Previous thread');
    await waitThreadOpen(reviewer.page, mentionId, 'Done, the colour is fixed.');
    await pinFor(reviewer.page, mentionId).waitFor();
    // Alt+ArrowDown does the same from the keyboard.
    await reviewer.page.locator('.collab-comment-messages').focus();
    await reviewer.page.keyboard.press('Alt+ArrowDown');
    await waitThreadOpen(reviewer.page, farId, 'green ellipse');

    // Hide pins is this device's choice only.
    await panelButton(reviewer.page, 'Hide pins');
    assert.equal(await reviewer.page.locator('.collab-comment-pins').evaluate(el => (el as HTMLElement).hidden), true);
    assert.equal(await reviewer.page.evaluate(() => localStorage.getItem('lolly.comments.pins')), 'hidden');
    assert.equal(await owner.page.locator('.collab-comment-pins').evaluate(el => (el as HTMLElement).hidden), false, 'the owner still sees pins');
    await panelButton(reviewer.page, 'Show pins');
    assert.equal(await reviewer.page.locator('.collab-comment-pins').evaluate(el => (el as HTMLElement).hidden), false);

    // Resolved threads: the owner resolves the far thread in the panel; the reviewer finds
    // it under Resolved threads only, with its pin dimmed there.
    await chooseFilter(owner.page, 'open');
    await owner.page.locator(`.collab-comment-list [data-comment-thread="${farId}"]`).click();
    await waitThreadOpen(owner.page, farId, 'green ellipse');
    await panelButton(owner.page, 'Resolve thread');
    await owner.page.locator('.collab-comments-panel').getByRole('button', { name: 'Reopen thread' }).waitFor();
    await showList(reviewer.page);
    await reviewer.page.waitForFunction(id => {
      const open = document.querySelector('.collab-comments-panel [data-filter="open"]')?.textContent ?? '';
      const resolved = document.querySelector('.collab-comments-panel [data-filter="resolved"]')?.textContent ?? '';
      return /1$/.test(open.trim()) && /1$/.test(resolved.trim()) && !!id;
    }, farId, { polling: 'raf' });
    await chooseFilter(reviewer.page, 'resolved');
    assert.deepEqual(await listedThreads(reviewer.page), [farId]);
    await pinFor(reviewer.page, farId).waitFor();
    assert.equal(await pinFor(reviewer.page, farId).evaluate(pin => pin.classList.contains('is-resolved')), true, 'a resolved pin is dimmed');
    await chooseFilter(reviewer.page, 'open');
    assert.deepEqual(await listedThreads(reviewer.page), [mentionId]);
    assert.equal(await pinFor(reviewer.page, farId).count(), 0, 'resolved pins show only under Resolved threads');
  } catch (error) {
    console.error('M4 review diagnostics', await w.diagnostics());
    throw error;
  } finally {
    await w.dispose();
  }
});

test('M4 review: a thread link opens after an access approval later than 120 s', {
  skip, timeout: 420_000,
}, async () => {
  const w = await world();
  try {
    const owner = await w.person('admin@test');
    const outsider = await w.person('outsider@test');
    const body = 'Only people with access can read this.';
    const created = await w.api<{ thread: Thread }>(owner, 'POST', `/api/v1/sessions/${w.fixture.sessionId}/comments`, {
      id: 'th_link', messageId: 'm_link', body,
      anchor: { kind: 'object', collection: 'boxes', objectId: 'shape', surface: 'board', x: .5, y: .5, at: { x: 130, y: 130 } },
    });
    const threadId = created.thread.id;

    // The owner copies the thread link from the panel.
    await openSession(owner.page, w.fixture.base, w.fixture.sessionId);
    await openPanel(owner.page);
    await owner.page.locator(`.collab-comment-list [data-comment-thread="${threadId}"]`).click();
    await waitThreadOpen(owner.page, threadId, body);
    await panelButton(owner.page, 'Copy link to thread');
    await owner.page.waitForFunction(() => /^Link copied\./.test(document.querySelector('.collab-comments-panel [role="status"]')?.textContent ?? ''), null, { polling: 'raf' });
    const link = await owner.page.evaluate(() => navigator.clipboard.readText());
    assert.equal(link, `${w.fixture.base}/#/team/${w.fixture.sessionId}?thread=${threadId}`);

    // The outsider follows it: a refusal with no comment content, and Ask for access.
    await outsider.page.goto(link, { waitUntil: 'domcontentloaded' });
    const ask = outsider.page.locator('[data-act="team-ask-send"]');
    await ask.waitFor();
    assert.equal(await ask.textContent(), 'Send request');
    assert.equal((await outsider.page.evaluate(() => document.body.innerText)).includes(body), false, 'no comment text before access');
    await ask.click();
    await outsider.page.waitForFunction(() => document.body.innerText.includes('Request sent.'), null, { polling: 'raf' });

    // The answer comes more than two minutes later, past the link's hold on the thread.
    await owner.page.waitForTimeout(125_000);
    const open = await w.api<{ requests: { id: string }[] }>(owner, 'GET', '/api/v1/access-requests');
    assert.equal(open.requests.length, 1, 'one request to answer');
    await w.api(owner, 'POST', `/api/v1/access-requests/${open.requests[0]!.id}/approve`, { role: 'viewer' });

    // The outsider's tab hears the answer (the inbox fetch a focus would make) and opens the thread.
    await inboxNotices(outsider.page);
    await live(outsider.page);
    await waitThreadOpen(outsider.page, threadId, body);
  } catch (error) {
    console.error('M4 thread link diagnostics', await w.diagnostics());
    throw error;
  } finally {
    await w.dispose();
  }
});

test('M4 recovery: an interrupted edit keeps a persistent recovery notice', {
  skip, timeout: 180_000,
}, async () => {
  const w = await world();
  try {
    const editor = await w.person('alice@test');
    await openSession(editor.page, w.fixture.base, w.fixture.sessionId);
    await editor.page.waitForFunction(() => document.querySelector('.collab-save-status')?.textContent === 'Saved to work', null, { polling: 'raf' });
    // Drag the shape and lose the connection mid-drag (M9a: airplane mode during a gesture).
    const shape = await editor.page.locator('#tool-canvas [data-box-id="shape"]').boundingBox(); assert.ok(shape);
    const x = shape.x + shape.width / 2, y = shape.y + shape.height / 2;
    await editor.page.mouse.move(x, y);
    await editor.page.mouse.down();
    await editor.page.mouse.move(x + 20, y + 10, { steps: 4 });
    await editor.page.waitForTimeout(400);
    await editor.page.mouse.move(x + 40, y + 20, { steps: 4 });
    w.fixture.suspendConnections();
    await editor.page.waitForFunction(() => document.querySelector<HTMLElement>('.collab-recovery')?.hidden === false, null, { polling: 'raf' });
    await editor.page.mouse.up();
    const recovery = editor.page.locator('.collab-recovery');
    await recovery.getByRole('button', { name: 'Open recovery copy' }).waitFor();
    assert.equal(await recovery.locator('[role="status"]').textContent(), 'Interrupted edit saved on this device.');
    await recovery.getByRole('button', { name: 'Download recovery copy' }).waitFor();
    // The old notice closed itself after five seconds; this one stays, also after reconnecting.
    await editor.page.waitForTimeout(6_500);
    w.fixture.resumeConnections();
    await editor.page.waitForFunction(() => document.querySelector('.collab-dot')?.getAttribute('data-state') === 'live', null, { polling: 'raf', timeout: 40_000 });
    assert.equal(await recovery.evaluate(el => (el as HTMLElement).hidden), false, 'the notice waits for the person');
    // The copy is in the notification queue and records this workspace and account.
    const queued = await editor.page.evaluate(async () => {
      const path = '/src/lib/notifications.ts';
      const n = await import(/* @vite-ignore */ path) as { notificationEntries(): readonly { id: string; dismissed?: boolean }[] };
      return n.notificationEntries().filter(entry => entry.id.startsWith('collab-recovery:')).map(entry => ({ id: entry.id, dismissed: !!entry.dismissed }));
    });
    assert.equal(queued.length, 1, JSON.stringify(queued));
    const record = await editor.page.evaluate(async slot => {
      const path = '/src/bridge/index.ts';
      const host = await (await import(/* @vite-ignore */ path) as { createBridge(): Promise<{ state: { load(slot: string): Promise<unknown> } }> }).createBridge();
      const data = await host.state.load(slot) as Record<string, unknown> | null;
      return data?.__collabRecovery as { origin: string; account: string; at: string } | undefined;
    }, queued[0]!.id);
    const me = (await w.api<{ permissions: { userId: string } }>(editor, 'GET', `/api/v1/sessions/${w.fixture.sessionId}/comments`)).permissions.userId;
    assert.equal(record?.origin, w.fixture.base, 'the copy records this workspace');
    assert.equal(record?.account, me, 'the copy records the signed-in account');
    await recovery.getByRole('button', { name: 'Dismiss' }).click();
    assert.equal(await recovery.evaluate(el => (el as HTMLElement).hidden), true);
    const after = await editor.page.evaluate(async () => {
      const path = '/src/lib/notifications.ts';
      const n = await import(/* @vite-ignore */ path) as { notificationEntries(): readonly { id: string; dismissed?: boolean }[] };
      return n.notificationEntries().filter(entry => entry.id.startsWith('collab-recovery:')).map(entry => !!entry.dismissed);
    });
    assert.deepEqual(after, [true], 'dismissing the notice dismisses its queue entry');
  } catch (error) {
    console.error('M4 recovery diagnostics', await w.diagnostics());
    throw error;
  } finally {
    await w.dispose();
  }
});

// ── Release 2: following, presenting and versions ─────────────────────────────

interface View { x: number; y: number; w: number }
/** An artboard's place in the stage: its offset from the stage's top-left corner, and its width. */
async function frameView(page: Page, frame = 'board'): Promise<View> {
  return await page.evaluate(id => {
    const stage = document.querySelector('.tool-stage')!.getBoundingClientRect();
    const box = document.querySelector(`#tool-canvas [data-frame-id="${id}"]`)!.getBoundingClientRect();
    return { x: Math.round(box.left - stage.left), y: Math.round(box.top - stage.top), w: Math.round(box.width) };
  }, frame);
}
const sameView = (a: View, b: View): boolean => Math.abs(a.x - b.x) <= 3 && Math.abs(a.y - b.y) <= 3 && Math.abs(a.w - b.w) <= 3;
/** Wait until an artboard is at the place `want` gives, within a few pixels. */
async function waitForView(page: Page, want: View, frame = 'board'): Promise<void> {
  await page.waitForFunction(({ want, frame }) => {
    const stage = document.querySelector('.tool-stage')?.getBoundingClientRect();
    const box = document.querySelector(`#tool-canvas [data-frame-id="${frame}"]`)?.getBoundingClientRect();
    return !!stage && !!box && Math.abs(box.left - stage.left - want.x) <= 3 && Math.abs(box.top - stage.top - want.y) <= 3
      && Math.abs(box.width - want.w) <= 3;
  }, { want, frame }, { polling: 'raf' });
}
/** One animation frame, so a camera change has been painted. */
const frame = (page: Page) => page.evaluate(() => new Promise<void>(done => requestAnimationFrame(() => requestAnimationFrame(() => done()))));
/** The person's own camera move: the wheel over an empty part of the stage, zooming with Control held. */
async function wheel(page: Page, dx: number, dy: number, zoom = false): Promise<void> {
  const stage = await page.locator('.tool-stage').boundingBox(); assert.ok(stage);
  await page.mouse.move(stage.x + stage.width * 0.3, stage.y + stage.height * 0.8);
  if (zoom) await page.keyboard.down('Control');
  await page.mouse.wheel(dx, dy);
  if (zoom) await page.keyboard.up('Control');
  await frame(page);
}
async function waitForText(page: Page, selector: string, text: string): Promise<void> {
  await page.waitForFunction(({ selector, text }) => document.querySelector(selector)?.textContent === text, { selector, text }, { polling: 'raf' });
}
const PILL = '.collab-pill--stage';
const followLabel = `${PILL} .collab-follow-label`;
/** Record every text the follow label shows from now on, so a short notice is never missed. */
async function recordFollowLabels(page: Page): Promise<void> {
  await page.evaluate(selector => {
    const seen: string[] = [];
    (window as unknown as { followLabels: string[] }).followLabels = seen;
    const label = document.querySelector(selector)!;
    seen.push(label.textContent ?? '');
    new MutationObserver(() => { if (seen.at(-1) !== label.textContent) seen.push(label.textContent ?? ''); })
      .observe(label, { childList: true, characterData: true, subtree: true });
  }, followLabel);
}
async function followLabelsSeen(page: Page, text: string): Promise<void> {
  try {
    await page.waitForFunction(want => (window as unknown as { followLabels: string[] }).followLabels.includes(want), text, { polling: 'raf' });
  } catch (error) {
    const seen = await page.evaluate(() => (window as unknown as { followLabels: string[] }).followLabels);
    throw new Error(`the follow label never read ${JSON.stringify(text)}; it read ${JSON.stringify(seen)}`, { cause: error });
  }
}
/** Click a person's avatar in the stage pill, which follows them (or stops when already followed). */
async function followFromAvatar(page: Page, name: string): Promise<void> {
  await page.waitForFunction(title => !!document.querySelector(`.collab-pill--stage .collab-stack .collab-av[title="${title}"]`), `Follow ${name}`, { polling: 'raf' });
  await press(page, `${PILL} .collab-stack .collab-av[title="Follow ${name}"]`);
}
/** Other people's pointers drawn on this page, by the name on their label. */
const pointerOf = (page: Page, name: string) => page.locator('.collab-cursor:not([hidden]) .collab-cursor-label', { hasText: name });
/** Present the deck from the keyboard (the editor's Ctrl/Cmd+Enter) and wait for the first slide. */
async function present(page: Page): Promise<void> {
  await page.locator('.tool-stage').hover({ position: { x: 20, y: 20 } });
  await page.keyboard.press('ControlOrMeta+Enter');
  await page.locator('.pr-stage .pr-active[data-frame-id]').waitFor();
}
/** Exit with the deck's own button: a deck opens fullscreen, where the browser keeps Escape for itself. */
async function stopPresenting(page: Page): Promise<void> {
  await press(page, '.pr-stage button[aria-label="Exit presentation"]');
  await page.waitForFunction(() => !document.querySelector('.pr-stage'), null, { polling: 'raf' });
}

test('M4 follow: Hide pointers, following a person, followers by name, one presenter and following a presentation', {
  skip, timeout: 300_000,
}, async () => {
  const w = await world();
  try {
    const owner = await w.person('admin@test');
    const editor = await w.person('alice@test');
    const reviewer = await w.person('viewer@test');
    // Two artboards, so a presentation has a second slide.
    const before = await w.fixture.readSession();
    await w.api(owner, 'PUT', `/api/v1/sessions/${w.fixture.sessionId}`, { rev: before!.rev, inputs: { ...before!.inputs, boxes: [...(before!.inputs.boxes as Row[]), ...SECOND_BOARD] } });
    // Joined in this order: the owner is the earliest present participant.
    for (const who of [owner, editor, reviewer]) await openSession(who.page, w.fixture.base, w.fixture.sessionId);

    // Hide pointers hides other people's pointers on this device only, and is remembered here.
    const shape = await owner.page.locator('#tool-canvas [data-box-id="shape"]').boundingBox(); assert.ok(shape);
    await owner.page.mouse.move(shape.x + 10, shape.y + 10);
    await owner.page.mouse.move(shape.x + 40, shape.y + 30, { steps: 4 });
    await pointerOf(editor.page, 'Admin').first().waitFor();
    await pointerOf(reviewer.page, 'Admin').first().waitFor();
    await press(reviewer.page, 'button[aria-label="Hide pointers"]');
    await reviewer.page.waitForFunction(() => !document.querySelector('.collab-cursor:not([hidden])'), null, { polling: 'raf' });
    assert.equal(await reviewer.page.evaluate(() => localStorage.getItem('lolly.collab.pointers')), 'hidden');
    await owner.page.mouse.move(shape.x + 70, shape.y + 50, { steps: 4 });
    await editor.page.waitForFunction(() => [...document.querySelectorAll('.collab-cursor:not([hidden]) .collab-cursor-label')].some(l => l.textContent === 'Admin'), null, { polling: 'raf' });
    await frame(reviewer.page); await reviewer.page.waitForTimeout(400);
    assert.equal(await pointerOf(reviewer.page, 'Admin').count(), 0, 'the reviewer sees no pointers');
    await press(reviewer.page, 'button[aria-label="Show pointers"]');
    await owner.page.mouse.move(shape.x + 30, shape.y + 60, { steps: 4 });
    await pointerOf(reviewer.page, 'Admin').first().waitFor();
    assert.equal(await reviewer.page.evaluate(() => localStorage.getItem('lolly.collab.pointers')), null);

    // Following: the owner looks somewhere else, and the editor follows them there.
    const editorOwn = await frameView(editor.page);
    await wheel(owner.page, 0, -240, true);
    await wheel(owner.page, -90, 60);
    const ownerFirst = await frameView(owner.page);
    assert.ok(!sameView(ownerFirst, editorOwn), `the owner moved their camera: ${JSON.stringify({ ownerFirst, editorOwn })}`);
    await followFromAvatar(editor.page, 'Admin');
    await waitForText(editor.page, followLabel, 'Following Admin');
    assert.equal(await editor.page.locator(`${PILL} .collab-follow-action`).textContent(), 'Stop following');
    await waitForView(editor.page, ownerFirst);
    await editor.page.locator('.tool-stage > .collab-follow-frame').waitFor({ state: 'attached' });
    // The person followed sees who follows them, by name.
    await waitForText(owner.page, `${PILL} .collab-followers`, 'Followers: 1');
    await press(owner.page, `${PILL} .collab-stack`);
    const roster = owner.page.locator('.collab-roster');
    assert.equal(await roster.locator('.collab-roster-heading').textContent(), 'Following you');
    assert.deepEqual(await roster.locator('.collab-roster-followers .collab-roster-name').allTextContents(), ['Alice']);
    await owner.page.keyboard.press('Escape');
    await owner.page.waitForFunction(() => !document.querySelector('.collab-roster'), null, { polling: 'raf' });
    // Following is continuous: the owner moves again, and the editor's view comes along.
    await wheel(owner.page, 0, 160);
    const ownerSecond = await frameView(owner.page);
    assert.ok(!sameView(ownerSecond, ownerFirst), 'the owner moved again');
    await waitForView(editor.page, ownerSecond);
    // Escape stops following and brings back the editor's own view.
    await editor.page.keyboard.press('Escape');
    await waitForView(editor.page, editorOwn);
    await waitForText(editor.page, followLabel, 'You stopped following Admin.');
    await owner.page.waitForFunction(() => !document.querySelector('.collab-pill--stage .collab-followers'), null, { polling: 'raf' });
    assert.equal(await editor.page.locator('.tool-stage > .collab-follow-frame').count(), 0, 'the follow outline is gone');
    // The editor's own navigation also stops following, and keeps the view where it is.
    await followFromAvatar(editor.page, 'Admin');
    await waitForView(editor.page, ownerSecond);
    await wheel(editor.page, 0, -120);
    await waitForText(editor.page, followLabel, 'You stopped following Admin.');
    const kept = await frameView(editor.page);
    assert.ok(!sameView(kept, editorOwn), `own navigation keeps the view it reached, not the saved one: ${JSON.stringify({ kept, editorOwn })}`);
    await wheel(owner.page, 0, 140);
    await owner.page.waitForTimeout(300);
    assert.ok(sameView(await frameView(editor.page), kept), 'no longer following the owner');

    // Presenting: two people present, and the others see one presenter, the one who joined first.
    await present(owner.page);
    await waitForText(reviewer.page, followLabel, 'Admin is presenting');
    await waitForText(editor.page, followLabel, 'Admin is presenting');
    await present(editor.page);
    await reviewer.page.waitForTimeout(600);
    assert.equal(await reviewer.page.locator(followLabel).textContent(), 'Admin is presenting', 'one presenter is shown');
    await stopPresenting(editor.page);
    // The reviewer follows the presentation from slide to slide.
    const board2Before = await frameView(reviewer.page, 'board2');
    assert.equal(await reviewer.page.locator(`${PILL} .collab-follow-action`).textContent(), 'Follow presentation');
    await press(reviewer.page, `${PILL} .collab-follow-action`);
    await waitForText(reviewer.page, followLabel, 'Following the presentation by Admin');
    await owner.page.keyboard.press('ArrowRight');
    await owner.page.locator('.pr-stage .pr-active[data-frame-id="board2"]').waitFor();
    await reviewer.page.waitForFunction(width => {
      const stage = document.querySelector('.tool-stage')!.getBoundingClientRect();
      const box = document.querySelector('#tool-canvas [data-frame-id="board2"]')!.getBoundingClientRect();
      const cx = box.left + box.width / 2, cy = box.top + box.height / 2;
      return box.width > width * 1.5 && cx > stage.left && cx < stage.right && cy > stage.top && cy < stage.bottom;
    }, board2Before.w, { polling: 'raf' });
    // When the presentation ends, following the presentation ends too.
    await stopPresenting(owner.page);
    await waitForText(reviewer.page, followLabel, 'You stopped following Admin.');

    // The person followed leaving ends the follow, with a status.
    await followFromAvatar(editor.page, 'Admin');
    await waitForText(editor.page, followLabel, 'Following Admin');
    await recordFollowLabels(editor.page);
    await owner.page.close();
    await followLabelsSeen(editor.page, 'Admin left. You stopped following.');
  } catch (error) {
    console.error('M4 follow diagnostics', await w.diagnostics());
    throw error;
  } finally {
    await w.dispose();
  }
});

/** Open the History panel from the editor's History button (Design's top bar) and wait for its list. */
async function openHistory(page: Page): Promise<void> {
  if (!await page.locator('.revision-history-panel').count()) await press(page, '[data-topbar="history"], [data-history-open]');
  await page.locator('.revision-history-panel .revision-history-list').waitFor();
  await page.waitForFunction(() => !!document.querySelector('.revision-history-list article, .revision-history-list p'), null, { polling: 'raf' });
}
const historyRow = (page: Page, label: string) => page.locator('.revision-history-entry').filter({ has: page.locator('strong', { hasText: label }) });
async function historyStatus(page: Page, text: string): Promise<void> {
  await waitForText(page, '.revision-history-panel .revision-history-status', text);
}
/** Choose a confirmation dialog's confirm button. */
async function confirm(page: Page, title: string): Promise<void> {
  await page.getByRole('dialog', { name: title }).locator('[data-act="ok"]').click();
}
const shapeCount = (page: Page) => page.locator('#tool-canvas [data-box-id="shape"]').count();
async function waitForShape(pages: Page[], present: boolean): Promise<void> {
  for (const page of pages) {
    await page.waitForFunction(want => !!document.querySelector('#tool-canvas [data-box-id="shape"]') === want, present, { polling: 'raf' });
  }
}

test('M4 versions: save a version, preview, restore with three people present, Undo restore and a manager delete', {
  skip: versionsSkip, timeout: 300_000,
}, async () => {
  const w = await world();
  try {
    const owner = await w.person('admin@test');
    const editor = await w.person('alice@test');
    const reviewer = await w.person('viewer@test');
    const everyone = [owner, editor, reviewer].map(who => who.page);
    for (const page of everyone) await openSession(page, w.fixture.base, w.fixture.sessionId);
    const name = 'Before the review';

    // The editor saves a named version of the document as it is now.
    await openHistory(editor.page);
    const form = editor.page.locator('.revision-history-save');
    await editor.page.waitForFunction(() => document.querySelector<HTMLElement>('.revision-history-save')?.hidden === false, null, { polling: 'raf' });
    assert.equal(await form.locator('input').getAttribute('aria-label'), 'Version name (optional)');
    await form.locator('input').fill(name);
    await form.getByRole('button', { name: 'Save version' }).click();
    await historyStatus(editor.page, 'Version saved.');
    const saved = historyRow(editor.page, name);
    await saved.waitFor();
    const savedText = await saved.textContent() ?? '';
    assert.match(savedText, /Saved version/);
    assert.match(savedText, /Edited by Alice/);

    // Then deletes the shape in the live document; everyone sees it go.
    await editor.page.locator('.revision-history-panel header').getByRole('button', { name: 'Close', exact: true }).click();
    await editor.page.waitForFunction(() => !document.querySelector('.revision-history-panel'), null, { polling: 'raf' });
    await editor.page.locator('#tool-canvas [data-box-id="shape"]').click();
    await editor.page.keyboard.press('Delete');
    await waitForShape(everyone, false);

    // The preview shows the saved version larger, with what this editor may do.
    await openHistory(editor.page);
    await historyRow(editor.page, name).getByRole('button', { name: 'Preview' }).click();
    const preview = editor.page.locator('.history-version-preview');
    await preview.waitFor();
    assert.equal(await preview.locator('.modal-title').textContent(), name);
    await editor.page.waitForFunction(() => {
      const image = document.querySelector<HTMLImageElement>('.history-version-preview .history-version-figure img');
      return !!image && !image.hidden && image.src.startsWith('data:image/') && image.naturalWidth > 0;
    }, null, { polling: 'raf', timeout: 60_000 });
    assert.match(await preview.locator('.history-version-facts').textContent() ?? '', /Saved version.*Edited by Alice/);
    assert.equal(await preview.getByRole('button', { name: 'Delete version' }).count(), 0, 'only managers delete versions');
    await preview.getByRole('button', { name: 'Open as a copy' }).waitFor();

    // Restore, confirmed, reaches all three people through the live document.
    await preview.getByRole('button', { name: 'Restore this version' }).click();
    const ask = editor.page.getByRole('dialog', { name: 'Restore this version?' });
    assert.equal(await ask.locator('.modal-msg').textContent(), 'Everyone in this document will see the restored version. The current version stays in History, so you can go back.');
    const restoredAt = Date.now();
    await confirm(editor.page, 'Restore this version?');
    await waitForShape(everyone, true);
    console.log(`restore: confirm -> shape back for all three people ${Date.now() - restoredAt} ms`);
    const toast = editor.page.locator('.undo-toast').filter({ hasText: 'Version restored.' });
    await toast.waitFor();
    await editor.page.waitForFunction(() => !document.querySelector('.history-version-preview'), null, { polling: 'raf' });
    await editor.page.locator('.revision-history-entry', { hasText: 'Restored version' }).first().waitFor();
    for (const page of everyone) assert.equal(await page.locator('#tool-canvas [data-box-id="shape"]').count(), 1);
    // A reviewer who may not edit is refused by the instance.
    const versions = await w.api<{ versions: { id: string; kind: string; label?: string }[] }>(owner, 'GET', `/api/v1/sessions/${w.fixture.sessionId}/versions`);
    const named = versions.versions.find(v => v.kind === 'named' && v.label === name);
    assert.ok(named, JSON.stringify(versions.versions));
    assert.deepEqual(versions.versions.map(v => v.kind).filter(kind => kind !== 'auto' && kind !== 'save'), ['restore', 'before', 'named']);
    const refused = await reviewer.context.request.post(`${w.fixture.base}/api/v1/sessions/${w.fixture.sessionId}/versions/${named.id}/restore`, { data: { requestId: 'reviewer-restore' } });
    assert.equal(refused.status(), 403);

    // Undo restore puts back the document the restore replaced, for everyone.
    await toast.getByRole('button', { name: 'Undo restore' }).click();
    await waitForShape(everyone, false);
    await historyStatus(editor.page, 'Restore undone.');

    // A manager deletes the version for everyone, after a confirmation.
    await openHistory(owner.page);
    await historyRow(owner.page, name).getByRole('button', { name: 'Preview' }).click();
    const managerPreview = owner.page.locator('.history-version-preview');
    await managerPreview.getByRole('button', { name: 'Delete version' }).click();
    const sure = owner.page.getByRole('dialog', { name: 'Delete this version?' });
    assert.equal(await sure.locator('.modal-msg').textContent(), 'This removes the version from History for everyone.');
    await confirm(owner.page, 'Delete this version?');
    await historyStatus(owner.page, 'Version deleted.');
    assert.equal(await historyRow(owner.page, name).count(), 0);
    const after = await w.api<{ versions: { id: string }[] }>(owner, 'GET', `/api/v1/sessions/${w.fixture.sessionId}/versions`);
    assert.equal(after.versions.some(v => v.id === named.id), false, 'the version is gone for everyone');
    assert.equal(await shapeCount(owner.page), 0, 'deleting a version leaves the document as it is');
  } catch (error) {
    console.error('M4 versions diagnostics', await w.diagnostics());
    throw error;
  } finally {
    await w.dispose();
  }
});
