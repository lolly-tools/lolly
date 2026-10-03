// SPDX-License-Identifier: MPL-2.0
/**
 * org/collab-share.ts - the "Work collab" Share-dialog section.
 *
 * Proves both gates are independently required (canJoinCollab() from a real
 * initOrg() pass, AND a registered 'work' opener), that the row is absent by
 * default (dormant registry + no control plane, byte-identical), that a
 * rendered row's action invokes the opener with the session-context shape and
 * announces, and that a missing/throwing opener degrades to silence.
 *
 * jsdom + a Map-backed localStorage + a stubbed fetch drive a real initOrg()
 * pass, same harness shape as org/collab-config.test.ts, kept local to this
 * file so it doesn't collide with concurrent edits to that suite (or to
 * org/index.ts itself).
 *
 * Run directly:  node --test shells/web/src/org/collab-share.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM(
  '<!doctype html><html><body><div id="app"><main id="view"></main></div></body></html>',
  { url: 'https://instance.test/#/tool/qr-code', pretendToBeVisual: true },
);
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.location = dom.window.location as unknown as Location;
// a11y.ts's announce() (invoked on a successful open) schedules via rAF; jsdom's
// pretendToBeVisual only exposes it on dom.window, not the bare global this file
// runs in - shim it, mirroring org/approval-dialog.test.ts's harness.
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => { setTimeout(() => cb(0), 0); return 0; }) as unknown as typeof requestAnimationFrame;

const store = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => store.clear(),
  key: () => null,
  length: 0,
} as unknown as Storage;

type Handler = (url: string, init?: RequestInit) => Response;
let router: Handler = () => new Response('', { status: 404 });
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => router(String(input), init)) as typeof fetch;

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const { buildWorkCollabShareSection, _clearCollabStartsForTests } = await import('./collab-share.ts');
const { initOrg, _resetOrgForTests } = await import('./index.ts');
const { registerCollabOpener, _clearCollabOpenersForTests } = await import('../lib/collab-launch.ts');
type CollabLaunchContext = import('../lib/collab-launch.ts').CollabLaunchContext;
type CollabLaunchOutcome = import('../lib/collab-launch.ts').CollabLaunchOutcome;

function reset(): void {
  _resetOrgForTests();
  _clearCollabOpenersForTests();
  _clearCollabStartsForTests();
  store.clear();
  router = () => new Response('', { status: 404 });
}

/** Drive a real member session whose org-config carries the given `can` bits (or
 *  none at all when omitted). */
async function memberWithCan(can?: Record<string, boolean>): Promise<void> {
  router = (url) => {
    if (url.includes('/api/auth/config')) return json({ mode: 'open', provider: 'oidc', loginPath: '/login' });
    if (url.includes('/api/auth/session')) return json({ kind: 'member', user: { sub: 'u1', role: 'member' } });
    if (url.includes('/api/v1/org-config')) return json({
      instance: { name: 'Acme' },
      inboxUnread: 0,
      ...(can ? { can } : {}),
    });
    return new Response('', { status: 404 });
  };
  await initOrg();
}

// Opened over a live tool (the dialog's document reader is present), so the Team section
// could save it to a team project - the one way a device-only document gets a Start that
// can work (see the third gate in collab-share.ts's header).
const ctx = { toolId: 'qr-code', baseParts: ['url=https%3A%2F%2Fsuse.com'], currentFormat: 'png', copy: async () => {}, document: () => ({ inputs: {} }) };

function press(section: HTMLElement): void {
  section.querySelector('button[data-act="start-work-collab"]')!.dispatchEvent(new dom.window.Event('click', { bubbles: true }));
}

// ── Absent by default ──────────────────────────────────────────────────────────

test('no control plane at all: section is absent even with a registered opener', async () => {
  reset();
  await initOrg(); // dormant - 404 on the probe
  registerCollabOpener('work', () => {});
  assert.equal(buildWorkCollabShareSection(ctx), null);
});

test('collab.join granted, but no opener registered: section is absent', async () => {
  reset();
  await memberWithCan({ 'collab.join': true });
  assert.equal(buildWorkCollabShareSection(ctx), null);
});

test('an opener is registered, but collab.join is absent/false: section is absent', async () => {
  reset();
  await memberWithCan({ 'collab.join': false });
  registerCollabOpener('work', () => {});
  assert.equal(buildWorkCollabShareSection(ctx), null);
});

test('a registered 1-slot "private" opener does not satisfy the "work" row', async () => {
  reset();
  await memberWithCan({ 'collab.join': true });
  registerCollabOpener('private', () => {});
  assert.equal(buildWorkCollabShareSection(ctx), null);
});

// ── Present only when BOTH gates hold ───────────────────────────────────────────

test('every gate holds: the section renders with plan-0 naming and a working action', async () => {
  reset();
  await memberWithCan({ 'collab.join': true });
  const seen: CollabLaunchContext[] = [];
  registerCollabOpener('work', (c) => { seen.push(c); });

  const section = buildWorkCollabShareSection(ctx);
  assert.ok(section, 'section renders');
  assert.equal(section!.textContent?.includes('Work collab'), true);
  const btn = section!.querySelector('button[data-act="start-work-collab"]');
  assert.ok(btn, 'has the action button');
  assert.equal(btn!.textContent, 'Start a collab');

  btn!.dispatchEvent(new dom.window.Event('click', { bubbles: true }));
  // The opener sees the CollabLaunchContext shape - toolId/baseParts/currentFormat
  // plus the row's outcome callback, never the dialog's `copy` helper or document
  // reader (those are ShareSectionContext concerns).
  assert.equal(seen.length, 1);
  const { onOutcome, ...launch } = seen[0]!;
  assert.deepEqual(launch, { toolId: ctx.toolId, baseParts: ctx.baseParts, currentFormat: ctx.currentFormat }, 'opener invoked with the session-context shape');
  assert.equal(typeof onOutcome, 'function', 'the row hears how the start ended');
});

test('a throwing opener degrades to silence (no throw out of the click handler)', async () => {
  reset();
  await memberWithCan({ 'collab.join': true });
  registerCollabOpener('work', () => { throw new Error('boom'); });
  const section = buildWorkCollabShareSection(ctx)!;
  const btn = section.querySelector('button[data-act="start-work-collab"]')!;
  assert.doesNotThrow(() => btn.dispatchEvent(new dom.window.Event('click', { bubbles: true })));
});

test('resetting the org seam reverts a previously-visible section to absent', async () => {
  reset();
  await memberWithCan({ 'collab.join': true });
  registerCollabOpener('work', () => {});
  assert.ok(buildWorkCollabShareSection(ctx));
  _resetOrgForTests();
  assert.equal(buildWorkCollabShareSection(ctx), null);
});

// ── A live room (plan 74) ──────────────────────────────────────────────────────

const {
  adoptTeamSessionOrigin, noteTeamSessionLive, _clearTeamSessionOriginForTests,
} = await import('./team-session-origin.ts');

test('a session this tab is live on shows the room, with no second start', async () => {
  reset();
  _clearTeamSessionOriginForTests();
  await memberWithCan({ 'collab.join': true });
  const seen: unknown[] = [];
  registerCollabOpener('work', (c) => { seen.push(c); });
  adoptTeamSessionOrigin({ sessionId: 'ses_1', toolId: 'qr-code' });
  const leave = noteTeamSessionLive('ses_1');

  const section = buildWorkCollabShareSection(ctx)!;
  assert.ok(section, 'the section still says what is going on');
  assert.equal(section.querySelector('[data-act="start-work-collab"]'), null, 'no Start a collab while live');
  assert.match(section.textContent ?? '', /You are in a live collab on this session\./);
  assert.ok(section.hasAttribute('data-collab-live'));

  leave();
  const after = buildWorkCollabShareSection(ctx)!;
  assert.ok(after.querySelector('[data-act="start-work-collab"]'), 'once the room closes it can be started again');
  assert.deepEqual(seen, []);
});

test('a live room on another session does not hide the start for this one', async () => {
  reset();
  _clearTeamSessionOriginForTests();
  await memberWithCan({ 'collab.join': true });
  registerCollabOpener('work', () => {});
  adoptTeamSessionOrigin({ sessionId: 'ses_1', toolId: 'qr-code' });
  noteTeamSessionLive('ses_2');
  assert.ok(buildWorkCollabShareSection(ctx)!.querySelector('[data-act="start-work-collab"]'));
});

test('a panel drawn before the room went live does not start a second one', async () => {
  reset();
  _clearTeamSessionOriginForTests();
  await memberWithCan({ 'collab.join': true });
  const seen: unknown[] = [];
  registerCollabOpener('work', (c) => { seen.push(c); });
  adoptTeamSessionOrigin({ sessionId: 'ses_1', toolId: 'qr-code' });
  const btn = buildWorkCollabShareSection(ctx)!.querySelector<HTMLButtonElement>('[data-act="start-work-collab"]')!;
  noteTeamSessionLive('ses_1');
  btn.dispatchEvent(new dom.window.Event('click', { bubbles: true }));
  assert.deepEqual(seen, []);
});

// ── A document the instance does not hold, and failures you can see (tester audit, 2026-10) ──

const { registerWorkCollabOpener, STRINGS } = await import('./collab-work-opener.ts');

test('no team origin and no way to get one in this dialog: no row, since Start could only refuse', async () => {
  reset();
  _clearTeamSessionOriginForTests();
  await memberWithCan({ 'collab.join': true });
  registerCollabOpener('work', () => {});
  const { document: _reader, ...shared } = ctx; // shared from outside a live tool
  assert.equal(buildWorkCollabShareSection(shared), null, 'no live document to save to a team project');
  // A team document needs no save first.
  adoptTeamSessionOrigin({ sessionId: 'ses_1', toolId: 'qr-code' });
  assert.ok(buildWorkCollabShareSection(shared), 'a team origin is enough on its own');

  // A member the instance does not let save new sessions has no way to a team origin here.
  reset();
  _clearTeamSessionOriginForTests();
  await memberWithCan({ 'collab.join': true, 'session.create': false });
  registerCollabOpener('work', () => {});
  assert.equal(buildWorkCollabShareSection(ctx), null, 'no save to a team project on offer');
});

test('a device-only document keeps its row: saving it in the Team section lets the same Start work', async () => {
  reset();
  _clearTeamSessionOriginForTests();
  await memberWithCan({ 'collab.join': true });
  const seen: CollabLaunchContext[] = [];
  registerCollabOpener('work', (c) => { seen.push(c); });
  const section = buildWorkCollabShareSection(ctx);
  assert.ok(section, 'the row is offered before the save');
  // What org/team-save.ts does when it saves this document to a team project.
  adoptTeamSessionOrigin({ sessionId: 'ses_9', toolId: 'qr-code' });
  press(section!);
  assert.equal(seen[0]?.sessionId, 'ses_9', 'the press reads the origin the save just gave the document');
});

test('how a start ended shows under the button while the section is open; a press clears it', async () => {
  reset();
  _clearTeamSessionOriginForTests();
  await memberWithCan({ 'collab.join': true });
  const answers: Array<(o: CollabLaunchOutcome) => void> = [];
  registerCollabOpener('work', (c) => { answers.push(c.onOutcome!); });
  const section = buildWorkCollabShareSection(ctx)!;
  const status = section.querySelector<HTMLElement>('[data-collab-status]')!;
  assert.ok(status, 'the status line sits in the section');
  assert.equal(status.hidden, true, 'nothing to say before a press');

  press(section);
  assert.equal(status.hidden, false);
  assert.equal(status.textContent, 'Starting a collab', 'a start under way says so');
  answers[0]!({ ok: false, message: 'The collab did not answer in time.' });
  assert.equal(status.hidden, false, 'a failure is visible, not only announced');
  assert.equal(status.textContent, 'The collab did not answer in time.');

  press(section);
  assert.equal(status.textContent, 'Starting a collab', 'a retry clears the last failure');
  answers[0]!({ ok: false, message: 'late' });
  assert.equal(status.textContent, 'Starting a collab', 'an earlier press answering late does not overwrite the latest');
  answers[1]!({ ok: true });
  assert.equal(status.hidden, true, 'success leaves nothing behind');
  assert.equal(status.textContent, '');
});

test('a section rebuilt while a start runs (the docked panel, on an edit) shows the start and how it ended', async () => {
  reset();
  _clearTeamSessionOriginForTests();
  await memberWithCan({ 'collab.join': true });
  const answers: Array<(o: CollabLaunchOutcome) => void> = [];
  registerCollabOpener('work', (c) => { answers.push(c.onOutcome!); });
  press(buildWorkCollabShareSection(ctx)!);
  // The pressed section is thrown away; the panel builds a fresh one before the answer.
  const rebuilt = buildWorkCollabShareSection(ctx)!;
  const status = rebuilt.querySelector<HTMLElement>('[data-collab-status]')!;
  assert.equal(status.hidden, false);
  assert.equal(status.textContent, 'Starting a collab', 'the start still running carries over');
  answers[0]!({ ok: false, message: 'The collab did not answer in time.' });
  assert.equal(status.textContent, 'The collab did not answer in time.', 'the failure lands in the section on screen');
  // Only a running start carries over: a section built after the answer starts blank.
  assert.equal(buildWorkCollabShareSection(ctx)!.querySelector<HTMLElement>('[data-collab-status]')!.hidden, true);
  // Another tool's Share dialog never shows this tool's start.
  press(rebuilt);
  adoptTeamSessionOrigin({ sessionId: 'ses_2', toolId: 'barcode' });
  const other = buildWorkCollabShareSection({ ...ctx, toolId: 'barcode' })!;
  assert.equal(other.querySelector<HTMLElement>('[data-collab-status]')!.hidden, true);
  answers[1]!({ ok: true });
});

test('the real work opener: a device-only document shows its refusal under the button', async () => {
  reset();
  _clearTeamSessionOriginForTests();
  await memberWithCan({ 'collab.join': true, 'collab.edit': true });
  const off = registerWorkCollabOpener();
  const section = buildWorkCollabShareSection(ctx)!;
  press(section);
  await new Promise((res) => setTimeout(res, 0));
  const status = section.querySelector<HTMLElement>('[data-collab-status]')!;
  assert.equal(status.hidden, false);
  assert.equal(status.textContent, STRINGS.noSession, 'the opener\'s own sentence, which used to reach only the screen reader');
  off();
});
