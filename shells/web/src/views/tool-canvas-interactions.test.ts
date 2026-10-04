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
  const off = registerCollabSurface(runtime, { id: () => 'page', collection: 'boxes', element: () => art, selection: () => [], subscribe: () => () => {},
    object: id => id === 'one' ? { ...geometry, element: doc.getElementById('original') } : null,
    toClient: point => ({ x: point.x * 2, y: point.y * 2 }) });
  const ui = mountCanvasInteractions(runtime, handle, session, layer)!;
  return { doc, art, layer, runtime, target, released, presence, ui,
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
    f.save(0); assert.deepEqual(f.released, []);
    f.save(1); second.finish(true); assert.deepEqual(f.released, []);
    f.save(0); assert.deepEqual(f.released, [first.id]);
  } finally { f.destroy(); }
});
