// SPDX-License-Identifier: MPL-2.0
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { mountCanvasComments } from './tool-canvas-comments.ts';
import { registerCollabSurface, type CollabSurface } from '../lib/collab-surface.ts';
import type { CanvasCommentsCapability, CommentListResult, CommentPerson } from '../lib/canvas-comments.ts';
import type { CollabConnectionState, CollabParticipant, CollabSession, CollabSessionState } from '../lib/collab-session.ts';
import type { CommentAnchor, CommentMessage, CommentThread } from '@lolly-tools/core/canvas-review-v1';

const tick = () => new Promise(resolve => setImmediate(resolve));
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
/** A typed stand-in for the parts of a large interface a test actually reads. */
const partial = <T>(value: Partial<T>): T => value as T;
type Extras = Partial<Pick<CanvasCommentsCapability, 'get' | 'markRead' | 'suggest' | 'link' | 'pendingTarget' | 'onTarget' | 'changes'>>;
interface Options {
  threads?: CommentThread[]; extras?: Extras; result?: Partial<CommentListResult>; session?: CollabSession;
  surface?: Partial<CollabSurface>; geometry?: Record<string, { x: number; y: number; w: number; h: number; rot: number }>;
  command?: CanvasCommentsCapability['command'];
}
const now = new Date().toISOString();
function message(id: string, authorId: string, body: string, extra: Partial<CommentMessage> & { mentions?: CommentPerson[] } = {}): CommentMessage {
  const value: CommentMessage & { mentions?: CommentPerson[] } = { id, authorId, authorName: authorId === 'reviewer' ? 'Reviewer' : authorId, body, createdAt: now, ...extra };
  return value;
}
function thread(id: string, anchor: CommentAnchor, messages: CommentMessage[], extra: Partial<CommentThread> = {}): CommentThread {
  return { id, sessionId: 'session', anchor, authorId: messages[0]!.authorId, authorName: messages[0]!.authorName, revision: 1, createdAt: now, updatedAt: now, messages, ...extra };
}
const imageAnchor: CommentAnchor = { kind: 'object', collection: 'boxes', objectId: 'image', surface: 'page', x: .75, y: .5 };
const canvasAt = (x: number, y: number, surface = 'page'): CommentAnchor => ({ kind: 'canvas', surface, x, y });

function liveSession(connection: CollabConnectionState = 'live') {
  const self = partial<CollabParticipant>({ userId: 'reviewer', clientId: 'device-r', color: '#008657' });
  let state = partial<CollabSessionState>({ connection, self, peers: [] });
  const listeners = new Set<(value: CollabSessionState) => void>();
  const session = partial<CollabSession>({
    state: () => state, subscribe(fn) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    presence: partial<CollabSession['presence']>({ roster: () => [] }), updateSurface() {}, setFocus() {},
  });
  return { session, set(next: CollabConnectionState) { state = { ...state, connection: next }; for (const fn of listeners) fn(state); } };
}

function fixture(options: Options = {}) {
  const dom = new JSDOM('<div id="stage"><div id="canvas"><div data-box-id="image">Artwork</div></div><div id="layer" aria-hidden="true"></div></div>', { pretendToBeVisual: true, url: 'https://lolly.ing/' });
  const doc = dom.window.document, stage = doc.getElementById('stage')!, canvas = doc.getElementById('canvas')!, layer = doc.getElementById('layer')!;
  const runtime = {}, drafts = new Map<string, string>(), calls: string[] = [];
  let threads: CommentThread[] = options.threads ?? [thread('thread', imageAnchor, [message('message', 'reviewer', 'Align this image')], { authorId: 'reviewer', authorName: 'Reviewer' })];
  let present = true, geometry = { x: 100, y: 100, w: 200, h: 100, rot: 0 }, refused = false, surfaceId = 'page';
  const revealed: string[] = [], points: Array<[string, { x: number; y: number }]> = [], focused: string[] = [];
  const capability: CanvasCommentsCapability = {
    async list() {
      calls.push('list');
      if (refused) throw Object.assign(new Error('removed'), { status: 403 });
      return { enabled: true, permissions: { userId: 'reviewer', create: true, editOwn: true, resolveAny: false, deleteAny: false }, threads, ...options.result };
    },
    async create(value, body, id, messageId) { const created = { ...threads[0]!, id, anchor: value, messages: [message(messageId, 'reviewer', body)] }; threads = [...threads, created]; return created; },
    command: options.command ?? (async (current, action, extra) => {
      const next = { ...current, revision: current.revision + 1, messages: [...current.messages] };
      if (action === 'reply') next.messages.push(message(extra!.messageId!, 'reviewer', extra!.body!));
      if (action === 'edit') next.messages = next.messages.map(value => value.id === extra!.messageId ? { ...value, body: extra!.body!, editedAt: now } : value);
      if (action === 'resolve') next.resolvedAt = now; if (action === 'reopen') delete next.resolvedAt;
      threads = threads.map(value => value.id === next.id ? next : value); return next;
    }),
    async loadDraft(key) { return drafts.get(key) ?? ''; }, async saveDraft(key, body) { drafts.set(key, body); },
    ...options.extras,
  };
  const off = registerCollabSurface(runtime, { id: () => surfaceId, collection: 'boxes', element: () => canvas, selection: () => ['image'],
    object: id => id === 'image' && present ? { ...geometry, element: canvas.firstElementChild as HTMLElement }
      : options.geometry?.[id] ? { ...options.geometry[id]!, element: null } : null,
    toClient: point => ({ x: point.x * 2, y: point.y * 2 }), fromClient: point => ({ x: point.x / 2, y: point.y / 2 }), subscribe: () => () => {},
    reveal: id => { revealed.push(id); },
    focusSurface: id => { focused.push(id); surfaceId = id; return true; },
    revealPoint: (id, point) => { points.push([id, point]); return true; },
    ...options.surface });
  const ui = mountCanvasComments(runtime, capability, stage, canvas, layer, undefined, options.session);
  const panel = stage.querySelector<HTMLElement>('.collab-comments-panel')!;
  const buttonNamed = (name: string) => [...stage.querySelectorAll<HTMLButtonElement>('button')].find(button => button.getAttribute('aria-label') === name || button.textContent === name);
  return { doc, dom, stage, canvas, layer, drafts, ui, capability, runtime, panel, calls, revealed, points, focused, threads: () => threads,
    setThreads(next: CommentThread[]) { threads = next; },
    status: () => panel.querySelector('[role="status"]')!.textContent,
    rows: () => [...panel.querySelectorAll<HTMLElement>('.collab-comment-list [data-comment-thread]')].map(row => row.dataset.commentThread),
    click(name: string) { const button = buttonNamed(name); assert.ok(button, `no button ${name}`); button.click(); },
    button: buttonNamed,
    openPanel() { stage.querySelector<HTMLButtonElement>('.collab-comments-open')!.click(); },
    move(value: typeof geometry) { geometry = value; ui.reanchor(); }, remove() { present = false; ui.reanchor(); }, undo() { present = true; ui.reanchor(); },
    deny() { refused = true; }, destroy() { ui.teardown(); off(); dom.window.close(); } };
}

test('Comments stay outside the dock as it resizes in either text direction', async () => {
  for (const direction of ['ltr', 'rtl']) {
    const f = fixture();
    try {
      await tick();
      Object.defineProperty(f.dom.window, 'innerWidth', { value: 1440 });
      const dock = f.doc.createElement('aside'); dock.className = 'edge-dock';
      const controls = f.doc.createElement('div'); dock.append(controls); f.doc.body.append(dock);
      let width = 340;
      dock.getBoundingClientRect = () => new f.dom.window.DOMRect(direction === 'rtl' ? 0 : 1440 - width, 0, width, 1000);
      controls.getBoundingClientRect = () => new f.dom.window.DOMRect(direction === 'rtl' ? 10 : 1440 - width + 10, 80, width - 20, 40);
      // The stage can retain a wider bound than the visible area during a resize.
      f.stage.getBoundingClientRect = () => new f.dom.window.DOMRect(direction === 'rtl' ? 312 : 0, 0, 1128, 1000);
      const panel = f.stage.querySelector<HTMLElement>('.collab-comments-panel')!;
      panel.style.direction = direction; panel.style.paddingTop = '8px';
      f.ui.dockControls(controls);
      for (const next of [340, 400]) {
        width = next; f.ui.reanchor();
        assert.equal(panel.style.insetInlineEnd, `${width}px`, direction);
        assert.equal(panel.style.maxWidth, `${1440 - width - 16}px`, direction);
      }
    } finally { f.destroy(); }
  }
});
test('locating a shared thread preserves a private reply and respects revoked access', async () => {
  const f = fixture();
  try {
    await tick(); await f.ui.locate('thread'); await tick();
    const panel = f.stage.querySelector<HTMLElement>('.collab-comments-panel')!, input = panel.querySelector('textarea')!;
    assert.equal(panel.hidden, false); assert.match(panel.textContent!, /Align this image/);
    input.value = 'Unsent private reply'; input.dispatchEvent(new f.dom.window.Event('input'));
    await f.ui.locate(); assert.equal(panel.hidden, true);
    await f.ui.locate('thread'); assert.equal(input.value, 'Unsent private reply');
    f.deny(); await f.ui.locate('thread'); assert.equal(input.disabled, true); assert.equal(f.threads()[0]!.messages.length, 1);
  } finally { f.destroy(); }
});
test('a review pin follows object translation, resizing and rotation; a deleted object keeps a muted pin and undo restores it', async () => {
  const f = fixture(); const artwork = f.canvas.outerHTML;
  try {
    await tick(); const pin = () => f.stage.querySelector<HTMLElement>('.collab-comment-pin');
    assert.equal(pin()!.style.left, '500px'); assert.equal(pin()!.style.top, '300px');
    assert.equal(pin()!.closest('[aria-hidden="true"]'), null, 'pins are accessible outside hidden presence chrome');
    const node = pin(); f.move({ x: 200, y: 100, w: 400, h: 200, rot: 90 });
    assert.equal(pin(), node, 'moving a pin preserves its keyboard focus');
    assert.equal(pin()!.style.left, '800px'); assert.equal(pin()!.style.top, '600px');
    pin()!.click(); f.remove();
    assert.equal(pin(), node, 'the pin stays where the object last stood');
    assert.ok(pin()!.classList.contains('is-missing')); assert.equal(pin()!.style.left, '800px'); assert.equal(pin()!.style.top, '600px');
    assert.match(f.stage.querySelector('.collab-comment-messages')!.textContent!, /Object deleted/);
    assert.equal(f.threads().length, 1); f.undo(); assert.equal(pin()!.classList.contains('is-missing'), false); assert.equal(f.canvas.outerHTML, artwork);
  } finally { f.destroy(); }
});
test('an observer can reply without touching artwork, and unsent text survives refresh, teardown and remount', async () => {
  const f = fixture(), artwork = f.canvas.outerHTML;
  try {
    await tick(); f.stage.querySelector<HTMLButtonElement>('.collab-comment-pin')!.click(); await tick();
    let textarea = f.stage.querySelector<HTMLTextAreaElement>('textarea')!; textarea.value = 'My unsent review'; textarea.dispatchEvent(new f.dom.window.Event('input'));
    await tick(); await f.ui.refresh(); assert.equal(textarea.value, 'My unsent review');
    f.ui.teardown(); await tick();
    const next = mountCanvasComments(f.runtime, f.capability, f.stage, f.canvas, f.layer);
    await tick(); f.stage.querySelector<HTMLButtonElement>('.collab-comment-pin')!.click(); await tick();
    textarea = f.stage.querySelector<HTMLTextAreaElement>('textarea')!; assert.equal(textarea.value, 'My unsent review');
    f.stage.querySelector('form')!.dispatchEvent(new f.dom.window.Event('submit', { cancelable: true })); await tick(); await tick();
    assert.equal(f.threads()[0]!.messages[1]!.body, 'My unsent review'); assert.equal(f.canvas.outerHTML, artwork);
    next.teardown();
  } finally { f.destroy(); }
});
test('access removal clears received comments and pins while retaining the person’s own draft', async () => {
  const f = fixture();
  try {
    await tick(); f.stage.querySelector<HTMLButtonElement>('.collab-comment-pin')!.click(); await tick();
    const textarea = f.stage.querySelector<HTMLTextAreaElement>('textarea')!; textarea.value = 'Keep my reply'; textarea.dispatchEvent(new f.dom.window.Event('input')); await tick();
    f.deny(); await f.ui.refresh();
    assert.equal(f.stage.querySelector('.collab-comment-pin'), null); assert.equal(f.stage.querySelector('.collab-comment-messages')!.textContent, '');
    assert.equal(f.drafts.get('thread'), 'Keep my reply'); assert.equal(textarea.disabled, true);
  } finally { f.destroy(); }
});
test('authors edit their message while retaining a separate reply draft and leaving artwork untouched', async () => {
  const f = fixture(), artwork = f.canvas.outerHTML;
  try {
    await tick(); f.stage.querySelector<HTMLButtonElement>('.collab-comment-pin')!.click(); await tick();
    const reply = f.stage.querySelector<HTMLTextAreaElement>('.collab-comment-composer textarea')!;
    reply.value = 'Separate reply'; reply.dispatchEvent(new f.dom.window.Event('input'));
    const click = (name: string) => [...f.stage.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === name)!.click();
    click('Edit message'); await tick();
    const editor = f.stage.querySelector<HTMLTextAreaElement>('textarea[aria-label="Edit message"]')!;
    editor.value = 'Updated feedback'; editor.dispatchEvent(new f.dom.window.Event('input')); await tick();
    assert.equal(f.drafts.get('edit:thread:message'), 'Updated feedback');
    await f.ui.refresh(); assert.equal(editor.value, 'Updated feedback');
    click('Save message'); await tick(); await tick();
    assert.equal(f.threads()[0]!.messages[0]!.body, 'Updated feedback');
    assert.equal(reply.value, 'Separate reply'); assert.equal(f.drafts.get('thread'), 'Separate reply');
    assert.equal(f.canvas.outerHTML, artwork);
  } finally { f.destroy(); }
});

const reviewThreads = () => [
  thread('mine', canvasAt(10, 10), [message('m1', 'reviewer', 'My own note')]),
  thread('closed', canvasAt(20, 20), [message('m2', 'ana', 'Fixed the colour')], { resolvedAt: now }),
  thread('asked', canvasAt(30, 30), [message('m3', 'ana', 'What do you think, @Reviewer?', { mentions: [{ id: 'reviewer', name: 'Reviewer' }] })]),
  thread('other', canvasAt(40, 40), [message('m4', 'bo', 'Unrelated')]),
];
test('filters show open, resolved and involving threads with counts, and resolved pins appear dimmed only under Resolved', async () => {
  const f = fixture({ threads: reviewThreads() });
  try {
    await tick(); f.openPanel(); await tick();
    const segments = () => [...f.panel.querySelectorAll<HTMLButtonElement>('[role="radio"]')].filter(segment => !segment.hidden).map(segment => segment.textContent);
    assert.equal(f.panel.querySelector('[role="radiogroup"]')!.getAttribute('aria-label'), 'Comment filter');
    assert.deepEqual(segments(), ['Open threads · 3', 'Resolved threads · 1', 'Involving me · 2'], 'Unread is hidden without read state');
    assert.deepEqual(f.rows(), ['mine', 'asked', 'other']);
    const pins = () => [...f.stage.querySelectorAll<HTMLElement>('.collab-comment-pin')].map(pin => `${pin.dataset.commentThread}${pin.classList.contains('is-resolved') ? ':dim' : ''}`).sort();
    assert.deepEqual(pins(), ['asked', 'mine', 'other']);
    f.panel.querySelector<HTMLButtonElement>('[data-filter="resolved"]')!.click();
    assert.deepEqual(f.rows(), ['closed']); assert.deepEqual(pins(), ['asked', 'closed:dim', 'mine', 'other']);
    assert.match(f.panel.querySelector('.collab-comment-list')!.textContent!, /2\. Resolved: Fixed the colour/, 'rows keep the number their pin shows');
    const group = f.panel.querySelector<HTMLElement>('[role="radiogroup"]')!;
    group.dispatchEvent(new f.dom.window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    assert.deepEqual(f.rows(), ['mine', 'asked'], 'arrow keys move to Involving me past the hidden Unread segment');
    assert.equal(f.doc.activeElement?.getAttribute('data-filter'), 'involving');
    f.setThreads(reviewThreads().filter(value => !value.resolvedAt)); await f.ui.refresh();
    f.panel.querySelector<HTMLButtonElement>('[data-filter="resolved"]')!.click();
    assert.equal(f.panel.querySelector('.collab-comment-list')!.textContent, 'No resolved threads.');
  } finally { f.destroy(); }
});

const at = (minutes: number) => new Date(Date.UTC(2026, 9, 7, 10, minutes)).toISOString();
test('unread threads show a dot and a count, selecting one marks it read after a pause, and Mark all as read clears the rest', async () => {
  const marks: Array<[string[], string | undefined]> = [];
  const f = fixture({
    threads: [
      thread('fresh', canvasAt(1, 1), [message('a', 'ana', 'New idea', { createdAt: at(30) })]),
      thread('seen', canvasAt(2, 2), [message('b', 'ana', 'Old idea', { createdAt: at(20) })]),
      thread('noticed', canvasAt(3, 3), [message('c', 'bo', 'Before the floor', { createdAt: at(1) })]),
      thread('own', canvasAt(4, 4), [message('d', 'reviewer', 'My note', { createdAt: at(40) })]),
    ],
    result: { readFloor: at(10), reads: { seen: at(25) }, notices: ['noticed'], features: { reads: true } },
    extras: { async markRead(ids, when) { marks.push([ids, when]); } },
  });
  try {
    await tick();
    const open = f.stage.querySelector<HTMLButtonElement>('.collab-comments-open')!;
    assert.equal(open.getAttribute('aria-label'), 'Comments, 2 unread'); assert.equal(open.querySelector('.collab-comments-badge')!.textContent, '2');
    f.openPanel(); await tick();
    const unread = () => [...f.panel.querySelectorAll<HTMLElement>('[data-unread="true"]')].map(row => row.dataset.commentThread);
    assert.deepEqual(unread(), ['fresh', 'noticed']);
    assert.match(f.panel.querySelector('[data-comment-thread="fresh"]')!.textContent!, /Unread$/);
    assert.equal(f.panel.querySelector<HTMLButtonElement>('[data-filter="unread"]')!.textContent, 'Unread · 2');
    f.panel.querySelector<HTMLButtonElement>('[data-comment-thread="fresh"]')!.click();
    await wait(200); assert.deepEqual(marks, [], 'a read waits for the pause');
    await wait(450);
    assert.deepEqual(marks, [[['fresh'], at(30)]], 'the mark covers the newest message the person saw');
    assert.equal(open.getAttribute('aria-label'), 'Comments, 1 unread');
    f.click('Comments');
    f.click('Mark all as read'); await tick();
    assert.deepEqual(marks.at(-1), [['noticed'], undefined]);
    assert.equal(open.getAttribute('aria-label'), 'Comments'); assert.equal(open.querySelector('.collab-comments-badge'), null);
    assert.equal(f.button('Mark all as read')!.hidden, true);
  } finally { f.destroy(); }
});
test('a refused read mark restores the unread state and reports a rate limit', async () => {
  const f = fixture({
    threads: [thread('fresh', canvasAt(1, 1), [message('a', 'ana', 'New idea', { createdAt: at(30) })])],
    result: { readFloor: at(10), features: { reads: true } },
    extras: { async markRead() { throw Object.assign(new Error('slow down'), { status: 429 }); } },
  });
  try {
    await tick(); f.openPanel(); await tick();
    f.click('Mark all as read'); await tick(); await tick();
    assert.equal(f.status(), 'You are commenting too quickly. Try again in a moment.');
    assert.equal(f.stage.querySelector('.collab-comments-open')!.getAttribute('aria-label'), 'Comments, 1 unread');
  } finally { f.destroy(); }
});
test('jumping reveals and centres an object, focuses another artboard, shows a deleted object where it was, and walks with buttons and Alt+arrows', async () => {
  const f = fixture({ threads: [
    thread('object', imageAnchor, [message('a', 'ana', 'Image')]),
    thread('elsewhere', canvasAt(10, 20, 'board-2'), [message('b', 'ana', 'Other artboard')]),
    thread('deleted', { kind: 'object', collection: 'boxes', objectId: 'gone', surface: 'page', x: .5, y: .5, at: { x: 5, y: 6 } } as CommentAnchor, [message('c', 'ana', 'Lost object')]),
    thread('done', canvasAt(1, 1), [message('d', 'ana', 'Resolved')], { resolvedAt: now }),
  ] });
  try {
    await tick(); f.openPanel(); await tick();
    f.panel.querySelector<HTMLButtonElement>('[data-comment-thread="object"]')!.click();
    f.click('Show comment location');
    assert.deepEqual(f.revealed, ['image']); assert.deepEqual(f.points.at(-1), ['page', { x: 250, y: 150 }]);
    f.click('Next thread');
    assert.deepEqual(f.focused, ['board-2']); assert.deepEqual(f.points.at(-1), ['board-2', { x: 10, y: 20 }]);
    assert.match(f.panel.querySelector('.collab-comment-messages')!.textContent!, /Other artboard/);
    f.panel.dispatchEvent(new f.dom.window.KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true, bubbles: true }));
    assert.deepEqual(f.points.at(-1), ['page', { x: 5, y: 6 }]);
    assert.equal(f.status(), 'The commented object was deleted. Showing where it was.');
    f.panel.dispatchEvent(new f.dom.window.KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true, bubbles: true }));
    assert.match(f.panel.querySelector('.collab-comment-messages')!.textContent!, /Image/, 'walking wraps and skips threads outside the filter');
    f.click('Previous thread');
    assert.match(f.panel.querySelector('.collab-comment-messages')!.textContent!, /Lost object/);
    const reply = f.panel.querySelector<HTMLTextAreaElement>('.collab-comment-composer textarea')!;
    reply.dispatchEvent(new f.dom.window.KeyboardEvent('keydown', { key: 'ArrowUp', altKey: true, bubbles: true }));
    assert.match(f.panel.querySelector('.collab-comment-messages')!.textContent!, /Lost object/, 'Alt+arrows stay with text editing in a field');
  } finally { f.destroy(); }
});
test('Hide pins is remembered on the device and Show pins brings them back', async () => {
  const f = fixture();
  try {
    await tick();
    const pins = f.stage.querySelector<HTMLElement>('.collab-comment-pins')!;
    assert.equal(pins.hidden, false); f.click('Hide pins');
    assert.equal(pins.hidden, true); assert.equal(f.dom.window.localStorage.getItem('lolly.comments.pins'), 'hidden');
    assert.ok(f.button('Show pins'));
    f.ui.teardown();
    const again = mountCanvasComments(f.runtime, f.capability, f.stage, f.canvas, f.layer); await tick();
    assert.equal(f.stage.querySelector<HTMLElement>('.collab-comment-pins')!.hidden, true);
    f.click('Show pins'); assert.equal(f.dom.window.localStorage.getItem('lolly.comments.pins'), null);
    assert.equal(f.stage.querySelector<HTMLElement>('.collab-comment-pins')!.hidden, false);
    again.teardown();
  } finally { f.destroy(); }
});
test('a saved comment event fetches only that thread, coalesced, and falls back to the list when the fetch is missing or fails', async () => {
  let emit: (event: { threadId: string; revision: number }) => void = () => {};
  const gets: string[] = [];
  const changes = { subscribe(fn: typeof emit) { emit = fn; return () => { emit = () => {}; }; } };
  const f = fixture({ extras: { changes, async get(id) {
    gets.push(id);
    return thread(id, imageAnchor, [message('message', 'reviewer', 'Align this image'), message('reply', 'ana', 'Done, have a look')], { revision: 3 });
  } } });
  try {
    await tick(); await f.ui.locate('thread'); await tick();
    emit({ threadId: 'thread', revision: 1 }); await wait(80); assert.deepEqual(gets, [], 'an event the tab already has costs nothing');
    const lists = f.calls.length;
    emit({ threadId: 'thread', revision: 2 }); emit({ threadId: 'thread', revision: 3 });
    await wait(100); assert.deepEqual(gets, ['thread']); assert.equal(f.calls.length, lists, 'no list for a single-thread change');
    assert.match(f.panel.querySelector('.collab-comment-messages')!.textContent!, /Done, have a look/);
  } finally { f.destroy(); }
  const g = fixture({ extras: { changes, async get() { throw Object.assign(new Error('gone'), { status: 500 }); } } });
  try {
    await tick(); const lists = g.calls.length;
    emit({ threadId: 'thread', revision: 5 }); await wait(100);
    assert.equal(g.calls.length, lists + 1, 'a failed fetch falls back to one list');
  } finally { g.destroy(); }
});
test('polling slows to 15 seconds only while comment events arrive through a live room', async () => {
  for (const [events, connection, expected] of [[true, 'live', 15_000], [false, 'live', 2_000], [true, 'reconnecting', 2_000]] as const) {
    mock.timers.enable({ apis: ['setTimeout'] });
    const room = liveSession(connection);
    const f = fixture({ session: room.session, result: { features: { events } }, extras: { changes: { subscribe: () => () => {} } } });
    try {
      await tick(); await tick();
      const lists = f.calls.length;
      mock.timers.tick(expected - 1); await tick(); assert.equal(f.calls.length, lists, `${events}/${connection}: not yet`);
      mock.timers.tick(1); await tick(); assert.equal(f.calls.length, lists + 1, `${events}/${connection}: every ${expected} ms`);
      if (expected === 15_000) {
        await tick(); room.set('reconnecting'); const before = f.calls.length;
        mock.timers.tick(2_000); await tick(); assert.equal(f.calls.length, before + 1, 'a dropped room returns to the fast poll at once');
      }
    } finally { f.destroy(); mock.timers.reset(); }
  }
});
test('a thread asked for by a link opens once the live document connects, and a missing thread says so', async () => {
  const room = liveSession('reconnecting');
  let target: string | undefined = 'thread', later: ((id: string) => void) | undefined;
  const f = fixture({ session: room.session, extras: {
    pendingTarget() { const value = target; target = undefined; return value; },
    onTarget(fn) { later = fn; return () => { later = undefined; }; },
  } });
  try {
    await tick(); await tick();
    assert.equal(f.status(), 'Comments open when the live document connects.'); assert.equal(f.panel.hidden, true);
    room.set('live'); await tick(); await tick(); await tick();
    assert.equal(f.panel.hidden, false); assert.match(f.panel.querySelector('.collab-comment-messages')!.textContent!, /Align this image/);
    assert.deepEqual(f.revealed, ['image'], 'the thread’s place is shown');
    later!('missing'); await tick(); await tick(); await tick();
    assert.equal(f.status(), 'This thread was deleted or is no longer available.');
  } finally { f.destroy(); }
  assert.equal(later, undefined, 'teardown stops listening for targets');
});
test('copy link to thread reports success and offers the link to copy by hand when the clipboard refuses', async () => {
  const f = fixture({ extras: { link: id => `https://lolly.ing/#/team/session?thread=${id}` } });
  try {
    await tick(); await f.ui.locate('thread'); await tick();
    f.click('Copy link to thread'); await tick();
    assert.equal(f.status(), 'The link could not be copied. Copy it from here instead.');
    const field = f.panel.querySelector<HTMLInputElement>('.collab-comment-link')!;
    assert.equal(field.hidden, false); assert.equal(field.value, 'https://lolly.ing/#/team/session?thread=thread'); assert.equal(f.doc.activeElement, field);
    const copied: string[] = [];
    Object.defineProperty(f.dom.window.navigator, 'clipboard', { value: { async writeText(text: string) { copied.push(text); } } });
    f.click('Copy link to thread'); await tick(); await tick();
    assert.deepEqual(copied, ['https://lolly.ing/#/team/session?thread=thread']);
    assert.equal(f.status(), 'Link copied. Only people who can open this document can use the link.'); assert.equal(field.hidden, true);
  } finally { f.destroy(); }
});
test('a mention chosen with the keyboard is sent, and the person is told when it was not stored', async () => {
  const sent: Array<string[] | undefined> = [];
  const f = fixture({
    result: { features: { mentions: true } },
    extras: { async suggest(query) { return { people: [{ id: 'ana', name: 'Ana Lopez' }, { id: 'bo', name: 'Bo' }].filter(person => person.name.startsWith(query)), truncated: false }; } },
    command: async (current, _action, extra) => {
      sent.push(extra?.mentions);
      return { ...current, revision: current.revision + 1, messages: [...current.messages, message(extra!.messageId!, 'reviewer', extra!.body!)] };
    },
  });
  try {
    await tick(); await f.ui.locate('thread'); await tick();
    const reply = f.panel.querySelector<HTMLTextAreaElement>('.collab-comment-composer textarea')!;
    assert.equal(reply.placeholder, 'Comment or reply. Type @ to mention someone.');
    reply.value = 'Thanks @A'; reply.setSelectionRange(9, 9); reply.dispatchEvent(new f.dom.window.Event('input', { bubbles: true }));
    await wait(160);
    const listbox = f.panel.querySelector<HTMLElement>('[role="listbox"]')!;
    assert.equal(listbox.closest<HTMLElement>('.collab-comment-mentions')!.hidden, false);
    reply.dispatchEvent(new f.dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    assert.equal(reply.value, 'Thanks @Ana Lopez ');
    f.panel.querySelector('form')!.dispatchEvent(new f.dom.window.Event('submit', { cancelable: true })); await tick(); await tick();
    assert.deepEqual(sent, [['ana']]);
    assert.equal(f.status(), 'Some people were not notified because they cannot open this document.');
  } finally { f.destroy(); }
});
test('commenting too quickly keeps the reply and says so', async () => {
  const f = fixture({ command: async () => { throw Object.assign(new Error('slow down'), { status: 429 }); } });
  try {
    await tick(); await f.ui.locate('thread'); await tick();
    const reply = f.panel.querySelector<HTMLTextAreaElement>('.collab-comment-composer textarea')!;
    reply.value = 'One more thing'; reply.dispatchEvent(new f.dom.window.Event('input'));
    f.panel.querySelector('form')!.dispatchEvent(new f.dom.window.Event('submit', { cancelable: true })); await tick(); await tick();
    assert.equal(f.status(), 'You are commenting too quickly. Try again in a moment.');
    assert.equal(reply.value, 'One more thing'); assert.equal(reply.disabled, false);
  } finally { f.destroy(); }
});
test('a host with only the original comment members makes no new requests and shows none of the new host features', async () => {
  const f = fixture();
  try {
    await tick(); f.openPanel(); await tick(); await f.ui.locate('thread'); await tick();
    assert.ok(f.calls.every(call => call === 'list'), 'only the list is requested');
    const open = f.stage.querySelector<HTMLButtonElement>('.collab-comments-open')!;
    assert.equal(open.querySelector('.collab-comments-badge'), null); assert.equal(open.getAttribute('aria-label'), 'Comments');
    assert.equal(f.panel.querySelector<HTMLElement>('[data-filter="unread"]')!.hidden, true);
    assert.equal(f.button('Mark all as read')!.hidden, true);
    assert.equal(f.button('Copy link to thread')!.hidden, true);
    const reply = f.panel.querySelector<HTMLTextAreaElement>('.collab-comment-composer textarea')!;
    assert.equal(reply.placeholder, 'Comment or reply'); assert.equal(reply.hasAttribute('aria-autocomplete'), false);
    assert.equal(f.panel.querySelector('[role="listbox"]'), null);
    for (const label of ['Close comments', 'Pin a comment', 'Comment on selection', 'Comment at canvas center', 'Show comment location', 'Previous thread', 'Next thread', 'Hide pins'])
      assert.ok(f.button(label), `${label} is a translated label`);
  } finally { f.destroy(); }
});
