// SPDX-License-Identifier: MPL-2.0
/**
 * views/projects-tile-state.ts - the approval badge on a real session tile, the info
 * sheet's row, and the one read per view.
 *
 * Run directly:  node --test shells/web/src/views/projects-tile-state.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><main id="root"></main></body></html>', { url: 'https://instance.test/', pretendToBeVisual: true });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.location = dom.window.location as unknown as Location;

const { sessionTile } = await import('../folder-tiles.ts');
const { applyTileStates, approvalInfoRows, readSessionApprovals, renderApprovalBadge } = await import('./projects-tile-state.ts');
const { registerApprovalOpener, _clearApprovalOpenerForTests } = await import('../lib/approval-request.ts');
type SessionApproval = import('../lib/approval-request.ts').SessionApproval;

const root = document.getElementById('root')!;
const entry = (slot: string): Parameters<typeof sessionTile>[0] => ({ slot, toolId: 'card', label: slot, updatedAt: '2026-11-01T00:00:00Z', createdAt: '2026-11-01T00:00:00Z' }) as Parameters<typeof sessionTile>[0];
const approved: SessionApproval = { state: 'approved', approvalId: 'a', title: 'T', decidedAt: '2026-11-02T00:00:00Z' };
const reviewing: SessionApproval = { state: 'in_review', approvalId: 'b', title: 'T' };
const tile = (slot: string): HTMLElement => root.querySelector<HTMLElement>(`[data-ref="${slot}"]`)!;
const badge = (slot: string): HTMLElement | null => tile(slot).querySelector('.tile-badge--approval');

test('a session tile with a request says so in words; others say nothing', () => {
  root.innerHTML = sessionTile(entry('s1'), {}) + sessionTile(entry('s2'), {}) + sessionTile(entry('s3'), { sizeBytes: 2048 });
  applyTileStates(root, new Map([['s1', approved], ['s3', reviewing]]));
  assert.equal(badge('s1')!.textContent, 'Approved');
  assert.equal(badge('s1')!.dataset.state, 'approved');
  assert.equal(badge('s2'), null);
  assert.equal(badge('s3')!.textContent, 'In review');
  assert.equal(tile('s3').querySelectorAll('.tile-badges').length, 1, 'joins the row the tile already has');
  assert.ok(tile('s3').querySelector('.tile-badge--size'), 'the other badges stay');
});

test('painting again changes the one badge, and clears it when the request has gone', () => {
  root.innerHTML = sessionTile(entry('s1'), {});
  applyTileStates(root, new Map([['s1', reviewing]]));
  applyTileStates(root, new Map([['s1', approved]]));
  assert.equal(tile('s1').querySelectorAll('.tile-badge--approval').length, 1);
  assert.equal(badge('s1')!.textContent, 'Approved');
  applyTileStates(root, new Map());
  assert.equal(badge('s1'), null);
});

test('a tile that is not a saved session is left alone', () => {
  root.innerHTML = '<div class="folder-tile" data-kind="team-session" data-ref="s1"></div>';
  applyTileStates(root, new Map([['s1', approved]]));
  assert.equal(root.querySelector('.tile-badge--approval'), null);
});

test('a tile with no row of badges gets one, after its caption', () => {
  const el = document.createElement('div');
  el.innerHTML = '<span class="tile-title">T</span><span class="tile-sub">Now</span>';
  renderApprovalBadge(el, reviewing);
  assert.equal(el.lastElementChild?.className, 'tile-badges');
  assert.equal(el.querySelector('.tile-badge--approval')?.textContent, 'In review');
});

test('the info sheet row', () => {
  const states = new Map([['s1', approved], ['s2', reviewing]]);
  assert.deepEqual(approvalInfoRows(states, 'none'), []);
  assert.deepEqual(approvalInfoRows(states, 's2'), [['approval', 'Approval', 'In review']]);
  const [row] = approvalInfoRows(states, 's1');
  assert.equal(row![0], 'approval');
  assert.match(row![2], /^Approved .+2026$/);
});

test('one read per view, and none with no flow registered', async () => {
  _clearApprovalOpenerForTests();
  assert.equal((await readSessionApprovals()).size, 0);
  let reads = 0;
  registerApprovalOpener(() => {}, {
    work: {
      status: async () => null,
      approvedFile: async () => ({ blob: new Blob([]), name: '' }),
      open: () => {},
      sessions: async () => { reads++; return new Map([['s1', approved]]); },
    },
  });
  assert.equal((await readSessionApprovals()).get('s1')?.state, 'approved');
  assert.equal(reads, 1);
  registerApprovalOpener(() => {}, {
    work: {
      status: async () => null,
      approvedFile: async () => ({ blob: new Blob([]), name: '' }),
      open: () => {},
      sessions: async () => { throw new Error('offline'); },
    },
  });
  assert.equal((await readSessionApprovals()).size, 0, 'a failed read shows no badges, not an error');
  _clearApprovalOpenerForTests();
});
