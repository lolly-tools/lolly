// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { mountCanvasInteractions } from './tool-canvas-interactions.ts';
import { canvasInteractions } from '../lib/canvas-interaction.ts';
import { registerCollabSurface } from '../lib/collab-surface.ts';
import type { CanvasClaim, CanvasClaimTarget, CanvasPreview } from '@lolly-tools/core/canvas-interaction-v1';
import type { CollabSession, CollabSessionHandle, CollabSessionState } from '../lib/collab-session.ts';

function fixture() {
  const dom = new JSDOM('<div id="stage"><div id="art"><div id="original" class="lolly-box"><img src="data:image/png;base64,AA"><button id="button">edit</button></div></div><div id="layer"></div></div>');
  const doc = dom.window.document, art = doc.getElementById('art')!, layer = doc.getElementById('layer')!;
  const runtime = {}, own = 'connection-me'; let claims: CanvasClaim[] = [], pending = 0;
  let geometry = { x: 10, y: 20, w: 100, h: 80, rot: 0 };
  const target: CanvasClaimTarget = { kind: 'transform', collection: 'boxes', ids: ['one'] };
  let remote: { id: string; away: boolean; state: { name: string; color: string; selection: string[]; location: string; preview?: CanvasPreview } }[] = [];
  const claimSubs = new Set<(claims: readonly CanvasClaim[]) => void>(), sessionSubs = new Set<(state: CollabSessionState) => void>();
  const saveSubs = new Set<(state: { pending: number; message: string }) => void>();
  const released: string[] = [], presence: unknown[] = [];
  const state = { role: 'writer', connection: 'live' } as CollabSessionState;
  const publish = () => { for (const fn of claimSubs) fn(claims); for (const fn of sessionSubs) fn(state); };
  const capability = {
    available: () => true, owner: () => own, list: () => claims,
    async acquire(target: CanvasClaimTarget) { const claim = { id: 'my-claim', owner: own, name: 'Me', expiresAt: Date.now() + 10_000, target }; claims.push(claim); publish(); return claim; },
    async renew(id: string) { return claims.find(claim => claim.id === id)!; },
    release(id: string) { released.push(id); claims = claims.filter(claim => claim.id !== id); publish(); },
    subscribe(fn: (claims: readonly CanvasClaim[]) => void) { claimSubs.add(fn); fn(claims); return () => { claimSubs.delete(fn); }; },
  };
  const handle = { claims: capability, saveIn: { subscribe(fn: (state: { pending: number; message: string }) => void) {
    saveSubs.add(fn); fn({ pending, message: '' }); return () => { saveSubs.delete(fn); };
  } } } as unknown as CollabSessionHandle;
  const session = { state: () => state, presence: { roster: () => remote }, updateSurface: (patch: unknown) => presence.push(patch),
    subscribe(fn: (state: CollabSessionState) => void) { sessionSubs.add(fn); return () => { sessionSubs.delete(fn); }; } } as unknown as CollabSession;
  const reads: string[] = [];
  let readCheck: (() => void) | undefined;
  const off = registerCollabSurface(runtime, { id: () => 'page', collection: 'boxes', element: () => art, selection: () => [], subscribe: () => () => {},
    object: id => { reads.push(id); readCheck?.(); return id === 'one' ? { ...geometry, element: doc.getElementById('original') } : null; },
    toClient: point => { readCheck?.(); return { x: point.x * 2, y: point.y * 2 }; } });
  const ui = mountCanvasInteractions(runtime, handle, session, layer)!;
  return { doc, art, layer, runtime, target, released, presence, ui, reads,
    checkReads(fn: () => void) { readCheck = fn; },
    peer(preview: CanvasPreview) { claims = [{ id: preview.claimId, owner: 'peer', name: 'Alice', expiresAt: Date.now() + 10_000, target }];
      remote = [{ id: 'peer', away: false, state: { name: 'Alice', color: '#123456', selection: ['one'], location: 'page', preview } }]; publish(); },
    updateGeometry(value: typeof geometry) { geometry = value; ui.reanchor(); },
    save(value: number) { pending = value; for (const fn of saveSubs) fn({ pending, message: '' }); },
    disconnect() { claims = []; publish(); },
    destroy() { ui.teardown(); off(); dom.window.close(); },
  };
}
test('remote movement paints a ghost before release without altering exported artwork; late previews disappear with their claim', () => {
  const f = fixture();
  try {
    const artwork = f.art.outerHTML;
    f.peer({ claimId: 'peer-claim', collection: 'boxes', kind: 'move', phase: 'active',
      objects: [{ id: 'one', x: 40, y: 50, w: 100, h: 80, rot: 30 }] });
    const ghost = f.layer.querySelector<HTMLElement>('.collab-preview-ghost')!;
    assert.ok(ghost); assert.equal(ghost.style.left, '80px'); assert.equal(ghost.style.transform, 'rotate(30deg)');
    assert.ok(ghost.querySelector('img')); assert.equal(ghost.querySelector('[id]'), null);
    assert.equal(ghost.querySelector<HTMLElement>('.collab-preview-content')!.inert, true);
    assert.equal(f.art.outerHTML, artwork);
    f.disconnect(); assert.equal(f.layer.querySelector('.collab-preview-ghost'), null);
    assert.equal(f.art.outerHTML, artwork);
  } finally { f.destroy(); }
});
test('committing preview remains until matching geometry arrives', () => {
  const f = fixture();
  try {
    const geometry = { x: 40, y: 50, w: 200, h: 160, rot: 30 };
    f.peer({ claimId: 'peer-claim', collection: 'boxes', kind: 'resize', phase: 'committing', objects: [{ id: 'one', ...geometry }] });
    assert.ok(f.layer.querySelector('.collab-preview-ghost'));
    f.updateGeometry(geometry); assert.equal(f.layer.querySelector('.collab-preview-ghost'), null);
  } finally { f.destroy(); }
});
test('remote previews retain scoped typography at native size and scale separately into the viewport', () => {
  const f = fixture();
  try {
    const style = f.doc.createElement('style');
    style.textContent = '#art .lolly-box { font-size:32px; color:rgb(20, 30, 40) } #art .lolly-box p { font-size:28px; line-height:42px }';
    f.doc.head.append(style);
    const original = f.doc.getElementById('original')!; original.innerHTML = '<p>Move this text</p>';
    const artwork = f.art.outerHTML;
    f.peer({ claimId:'peer-claim',collection:'boxes',kind:'move',phase:'active',objects:[{id:'one',x:40,y:50,w:100,h:80,rot:0}] });
    const clone = f.layer.querySelector<HTMLElement>('.collab-preview-content')!;
    assert.equal(clone.style.fontSize,'32px'); assert.equal(clone.style.width,'100px');
    assert.equal(clone.style.transform,'scale(2, 2)');
    assert.equal(clone.querySelector('p')!.style.fontSize,'28px');
    assert.equal(clone.querySelector('p')!.style.lineHeight,'42px');
    f.peer({ claimId:'peer-claim',collection:'boxes',kind:'resize',phase:'active',objects:[{id:'one',x:40,y:50,w:200,h:160,rot:0}] });
    assert.equal(clone.style.width,'200px'); assert.equal(clone.style.transform,'scale(2, 2)');
    assert.equal(clone.querySelector('p')!.style.fontSize,'28px'); assert.equal(f.art.outerHTML,artwork);
  } finally { f.destroy(); }
});
test('a local claim stays through durable saving, then releases; disconnect cancels an active edit', async () => {
  const f = fixture(); let lost = 0;
  try {
    const port = canvasInteractions(f.runtime)!;
    const lease = await port.acquire(f.target, () => lost++);
    lease.preview({ kind: 'move', phase: 'active', objects: [{ id: 'one', x: 40, y: 50, w: 100, h: 80, rot: 0 }] });
    f.save(1); lease.finish(true); assert.deepEqual(f.released, []);
    f.save(0); assert.deepEqual(f.released, [lease.id]); assert.equal(lost, 0);
    await port.acquire(f.target, () => lost++); f.disconnect(); assert.equal(lost, 1);
    f.ui.teardown(); assert.equal(canvasInteractions(f.runtime), undefined);
    assert.equal(f.layer.children.length, 0);
  } finally { f.destroy(); }
});
test('the next gesture reuses its pending claim and an earlier receipt cannot end the active gesture', async () => {
  const f = fixture();
  try {
    const port = canvasInteractions(f.runtime)!;
    const first = await port.acquire(f.target, () => assert.fail('unexpected cancellation'));
    f.save(1); first.finish(true);
    const second = await port.acquire(f.target, () => assert.fail('unexpected cancellation'));
    assert.equal(second.id, first.id);
    first.finish(false); assert.deepEqual(f.released, [], 'an obsolete callback cannot cancel the new lease');
    f.save(0); assert.deepEqual(f.released, []);
    f.save(1); second.finish(true); assert.deepEqual(f.released, []);
    f.save(0); assert.deepEqual(f.released, [first.id]);
  } finally { f.destroy(); }
});

test('preview and selection reads share one object snapshot and finish before overlay writes', () => {
  const f = fixture();
  try {
    const mutations = new f.doc.defaultView!.MutationObserver(() => {});
    mutations.observe(f.layer, { subtree: true, childList: true, attributes: true, characterData: true });
    const rect = f.layer.getBoundingClientRect.bind(f.layer);
    f.layer.getBoundingClientRect = () => { mutations.takeRecords(); return rect(); };
    f.checkReads(() => assert.equal(mutations.takeRecords().length, 0, 'mounted overlay writes must follow all layout reads'));
    const preview: CanvasPreview = { claimId: 'peer-claim', collection: 'boxes', kind: 'move', phase: 'active',
      objects: [{ id: 'one', x: 40, y: 50, w: 100, h: 80, rot: 0 }] };
    f.peer(preview);
    assert.equal(f.reads.filter(id => id === 'one').length, 2, 'one snapshot per paint, despite preview and selection references');
    const ghost = f.layer.querySelector('.collab-preview-ghost')!, content = ghost.firstElementChild;
    mutations.takeRecords(); f.reads.length = 0;
    f.ui.reanchor();
    assert.deepEqual(f.reads, ['one']);
    assert.equal(ghost.firstElementChild, content, 'steady updates reuse the styled clone');
    mutations.disconnect(); f.checkReads(() => {});
  } finally { f.destroy(); }
});
