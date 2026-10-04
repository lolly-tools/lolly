// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { mountCanvasComments } from './tool-canvas-comments.ts';
import { registerCollabSurface } from '../lib/collab-surface.ts';
import type { CanvasCommentsCapability } from '../lib/canvas-comments.ts';
import type { CommentAnchor, CommentThread } from '@lolly-tools/core/canvas-review-v1';

const tick = () => new Promise(resolve => setImmediate(resolve));
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
function fixture() {
  const dom = new JSDOM('<div id="stage"><div id="canvas"><div data-box-id="image">Artwork</div></div><div id="layer" aria-hidden="true"></div></div>', { pretendToBeVisual: true });
  const doc = dom.window.document, stage = doc.getElementById('stage')!, canvas = doc.getElementById('canvas')!, layer = doc.getElementById('layer')!;
  const runtime = {}, now = new Date().toISOString(), drafts = new Map<string, string>();
  const anchor: CommentAnchor = { kind: 'object', collection: 'boxes', objectId: 'image', surface: 'page', x: .75, y: .5 };
  let threads: CommentThread[] = [{ id: 'thread', sessionId: 'session', anchor, authorId: 'reviewer', authorName: 'Reviewer',
    revision: 1, createdAt: now, updatedAt: now, messages: [{ id: 'message', authorId: 'reviewer', authorName: 'Reviewer', body: 'Align this image', createdAt: now }] }];
  let present = true, geometry = { x: 100, y: 100, w: 200, h: 100, rot: 0 }, refused = false;
  const capability: CanvasCommentsCapability = {
    async list() { if (refused) throw Object.assign(new Error('removed'), { status: 403 }); return { enabled: true, permissions: { userId: 'reviewer', create: true, editOwn: true, resolveAny: false, deleteAny: false }, threads }; },
    async create(value, body, id, messageId) { const thread = { ...threads[0]!, id, anchor: value, messages: [{ id: messageId, authorId: 'reviewer', authorName: 'Reviewer', body, createdAt: now }] }; threads = [...threads, thread]; return thread; },
    async command(thread, action, options) {
      const next = { ...thread, revision: thread.revision + 1, messages: [...thread.messages] };
      if (action === 'reply') next.messages.push({ id: options!.messageId!, authorId: 'reviewer', authorName: 'Reviewer', body: options!.body!, createdAt: now });
      if (action === 'edit') next.messages = next.messages.map(message => message.id === options!.messageId ? { ...message, body: options!.body!, editedAt: now } : message);
      if (action === 'resolve') next.resolvedAt = now; if (action === 'reopen') delete next.resolvedAt;
      threads = threads.map(value => value.id === next.id ? next : value); return next;
    },
    async loadDraft(key) { return drafts.get(key) ?? ''; }, async saveDraft(key, body) { drafts.set(key, body); },
  };
  const off = registerCollabSurface(runtime, { id: () => 'page', collection: 'boxes', element: () => canvas, selection: () => ['image'],
    object: id => id === 'image' && present ? { ...geometry, element: canvas.firstElementChild as HTMLElement } : null,
    toClient: point => ({ x: point.x * 2, y: point.y * 2 }), fromClient: point => ({ x: point.x / 2, y: point.y / 2 }), subscribe: () => () => {} });
  const ui = mountCanvasComments(runtime, capability, stage, canvas, layer);
  return { doc, dom, stage, canvas, layer, drafts, ui, capability, runtime, threads: () => threads,
    move(value: typeof geometry) { geometry = value; ui.reanchor(); }, remove() { present = false; ui.reanchor(); }, undo() { present = true; ui.reanchor(); },
    deny() { refused = true; }, destroy() { ui.teardown(); off(); dom.window.close(); } };
}
test('a review pin follows object translation, resizing and rotation; deletion keeps the thread and undo restores the pin', async () => {
  const f = fixture(); const artwork = f.canvas.outerHTML;
  try {
    await tick(); const pin = () => f.stage.querySelector<HTMLElement>('.collab-comment-pin');
    assert.equal(pin()!.style.left, '500px'); assert.equal(pin()!.style.top, '300px');
    assert.equal(pin()!.closest('[aria-hidden="true"]'), null, 'pins are accessible outside hidden presence chrome');
    const node = pin(); f.move({ x: 200, y: 100, w: 400, h: 200, rot: 90 });
    assert.equal(pin(), node, 'moving a pin preserves its keyboard focus');
    assert.equal(pin()!.style.left, '800px'); assert.equal(pin()!.style.top, '600px');
    pin()!.click(); f.remove(); assert.equal(pin(), null);
    assert.match(f.stage.querySelector('.collab-comment-messages')!.textContent!, /Object deleted/);
    assert.equal(f.threads().length, 1); f.undo(); assert.ok(pin()); assert.equal(f.canvas.outerHTML, artwork);
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
