// SPDX-License-Identifier: MPL-2.0
/**
 * views/tool-actions/approval-state.ts - the export bar's one control for where a
 * document stands. A small context double carries what the module reads: the control,
 * the line under it, the runtime's change feed and the format picker.
 *
 * Run directly:  node --test shells/web/src/views/tool-actions/approval-state.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://instance.test/', pretendToBeVisual: true });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.location = dom.window.location as unknown as Location;

const { approvalBarView, approvalStateOps, SETTLE_MS } = await import('./approval-state.ts');
const { registerApprovalOpener, _clearApprovalOpenerForTests } = await import('../../lib/approval-request.ts');
const { setExportPolicy, _clearExportPolicyForTests } = await import('../../lib/export-policy.ts');
type ApprovalStatus = import('../../lib/approval-request.ts').ApprovalStatus;
type ActionsCtx = import('./context.ts').ActionsCtx;

const pause = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms));
const tick = async (): Promise<void> => { for (let i = 0; i < 8; i++) await pause(0); };

interface Harness {
  ta: ActionsCtx;
  ops: ReturnType<typeof approvalStateOps>;
  button: HTMLButtonElement;
  line: HTMLElement;
  format: HTMLSelectElement;
  edit(): void;
  delivered: Array<{ name: string; size: number }>;
}

function harness(): Harness {
  const el = document.createElement('div');
  el.innerHTML = `<select data-action="format"><option value="svg">SVG</option><option value="jpeg">JPEG</option></select>
    <button type="button" data-action="request-approval">Request approval</button>
    <p data-approval-status hidden></p>`;
  document.body.replaceChildren(el);
  const subscribers = new Set<() => void>();
  const delivered: Array<{ name: string; size: number }> = [];
  const format = el.querySelector('select')!;
  const ta = {
    el, formatEl: format, formats: ['svg'], manifest: { id: 'card', name: 'Card' }, activeSlot: null,
    experience: { recordDeviceActivity: false },
    runtime: { getModel: () => [], subscribe: (fn: () => void) => { subscribers.add(fn); return () => { subscribers.delete(fn); }; } },
    saving: { deliverToBar: async (blob: Blob, name: string) => { delivered.push({ name, size: blob.size }); } },
    approvalBar: null,
  } as unknown as ActionsCtx;
  return {
    ta, ops: approvalStateOps(ta), format, delivered,
    button: el.querySelector('button')!, line: el.querySelector('p')!,
    edit: () => { for (const fn of subscribers) fn(); },
  };
}

interface Asked { toolId: string; format: string; query: string; signal?: AbortSignal | undefined }
function serving(answer: (asked: Asked) => ApprovalStatus | null | Promise<ApprovalStatus | null>): { asked: Asked[]; opened: string[]; files: string[] } {
  const asked: Asked[] = [];
  const opened: string[] = [];
  const files: string[] = [];
  registerApprovalOpener(() => {}, {
    work: {
      status: async (q, signal) => { asked.push({ ...q, signal }); return answer({ ...q, signal }); },
      approvedFile: async (id) => { files.push(id); return { blob: new Blob(['approved']), name: 'card.svg' }; },
      open: (id) => { opened.push(id); },
      sessions: async () => new Map(),
    },
  });
  return { asked, opened, files };
}

const reset = (chain = true): void => {
  _clearApprovalOpenerForTests();
  _clearExportPolicyForTests();
  if (chain) setExportPolicy({ canDownload: false, canRequestApproval: true, chains: { card: 'brand' } });
};

test('every state has one control and one plain line', () => {
  assert.deepEqual(approvalBarView(null), { action: 'request', label: 'Request approval', note: '', open: '' });
  assert.deepEqual(approvalBarView({ state: 'none' }), { action: 'request', label: 'Request approval', note: '', open: '' });
  assert.deepEqual(approvalBarView({ state: 'in_review', approvalId: 'a' }), { action: 'wait', label: 'In review', note: 'Reviewers have this file.', open: 'See request' });
  assert.equal(approvalBarView({ state: 'approved', approvalId: 'a' }).label, 'Download approved file');
  assert.match(approvalBarView({ state: 'approved', decidedAt: '2026-11-02T00:00:00Z' }).note, /^Approved .+2026\.$/);
  assert.deepEqual(approvalBarView({ state: 'rejected', approvalId: 'a' }), { action: 'request', label: 'Request approval', note: 'Not approved.', open: 'See why' });
  assert.deepEqual(approvalBarView({ state: 'changed', approvalId: 'a' }), { action: 'request', label: 'Request approval', note: 'Changed since approval.', open: 'See request' });
});

test('no chain: asks nothing and leaves the bar alone', async () => {
  reset(false);
  const { asked } = serving(() => ({ state: 'approved' }));
  const h = harness();
  h.ops.wire();
  h.edit();
  await pause(SETTLE_MS + 40);
  assert.equal(asked.length, 0);
  assert.equal(h.button.textContent, 'Request approval');
  assert.equal(h.ops.handleClick(), false);
});

test('no approval flow: the plain request', async () => {
  reset();
  const h = harness();
  h.ops.wire();
  await tick();
  assert.equal(h.ta.approvalBar, null);
  assert.equal(h.ops.handleClick(), false);
});

test('an instance that gives no answer leaves the plain request', async () => {
  reset();
  serving(() => null);
  const h = harness();
  h.ops.wire();
  await tick();
  assert.equal(h.button.textContent, 'Request approval');
  assert.equal(h.line.hidden, true);
  assert.equal(h.ops.handleClick(), false);
  h.ops.dispose();
});

test('asks on mount with the tool, the format and the inputs, in the recorded format spelling', async () => {
  reset();
  const { asked } = serving(() => ({ state: 'none' }));
  const h = harness();
  h.format.value = 'jpeg';
  h.ops.wire();
  await tick();
  assert.equal(asked.length, 1);
  assert.equal(asked[0]!.toolId, 'card');
  assert.equal(asked[0]!.format, 'jpg');
  assert.equal(typeof asked[0]!.query, 'string');
  h.ops.dispose();
});

test('edits settle first: a burst asks once, and a newer edit cancels an answer on its way', async () => {
  reset();
  const held: Array<(s: ApprovalStatus) => void> = [];
  const { asked } = serving(() => new Promise(resolve => { held.push(resolve); }));
  const h = harness();
  h.ops.wire();
  await tick();
  assert.equal(asked.length, 1);
  h.edit(); h.edit(); h.edit();
  assert.equal(asked[0]!.signal?.aborted, true, 'the answer on its way is cancelled');
  await pause(SETTLE_MS / 2);
  assert.equal(asked.length, 1, 'still waiting for the input to rest');
  h.edit();
  await pause(SETTLE_MS / 2);
  assert.equal(asked.length, 1, 'the wait restarted');
  await pause(SETTLE_MS);
  assert.equal(asked.length, 2, 'one ask for the whole burst');
  held[0]!({ state: 'approved', approvalId: 'old' });
  await tick();
  assert.equal(h.button.textContent, 'Request approval', 'a cancelled answer paints nothing');
  held[1]!({ state: 'changed', approvalId: 'apr_1' });
  await tick();
  assert.equal(h.line.textContent?.startsWith('Changed since approval.'), true);
  h.ops.dispose();
});

test('a new format asks again', async () => {
  reset();
  const { asked } = serving(() => ({ state: 'none' }));
  const h = harness();
  h.ops.wire();
  await tick();
  h.format.value = 'jpeg';
  h.format.dispatchEvent(new dom.window.Event('change'));
  await pause(SETTLE_MS + 40);
  assert.equal(asked.length, 2);
  assert.equal(asked[1]!.format, 'jpg');
  h.ops.dispose();
});

test('in review: the control waits, and the click does nothing', async () => {
  reset();
  const { opened } = serving(() => ({ state: 'in_review', approvalId: 'apr_1' }));
  const h = harness();
  h.ops.wire();
  await tick();
  assert.equal(h.button.textContent, 'In review');
  assert.equal(h.button.hasAttribute('disabled'), true);
  assert.equal(h.button.dataset.approvalLabel, 'In review', 'the locked bar reads the same word');
  assert.equal(h.ops.handleClick(), true);
  assert.equal(h.line.hidden, false);
  h.line.querySelector('button')!.click();
  assert.deepEqual(opened, ['apr_1']);
  h.ops.dispose();
});

test('approved: the control fetches the file and hands it to the delivery result, with no export', async () => {
  reset();
  const { files } = serving(() => ({ state: 'approved', approvalId: 'apr_1', decidedAt: '2026-11-02T00:00:00Z' }));
  const h = harness();
  h.ops.wire();
  await tick();
  assert.equal(h.button.textContent, 'Download approved file');
  assert.equal(h.button.hasAttribute('disabled'), false);
  assert.equal(h.ops.handleClick(), true, 'the request flow never runs');
  await tick();
  assert.deepEqual(files, ['apr_1']);
  assert.deepEqual(h.delivered, [{ name: 'card.svg', size: 8 }]);
  assert.equal(h.button.textContent, 'Download approved file');
  assert.equal(h.button.hasAttribute('aria-busy'), false);
  h.ops.dispose();
});

test('a failed fetch says so and leaves the control ready', async () => {
  reset();
  registerApprovalOpener(() => {}, {
    work: {
      status: async () => ({ state: 'approved', approvalId: 'apr_1' }),
      approvedFile: async () => { throw new Error('nope'); },
      open: () => {},
      sessions: async () => new Map(),
    },
  });
  const h = harness();
  h.ops.wire();
  await tick();
  h.ops.handleClick();
  await tick();
  assert.match(h.line.textContent ?? '', /Could not get the approved file/);
  assert.equal(h.button.hasAttribute('disabled'), false);
  h.ops.dispose();
});

test('rejected and changed go back to the request, with a way to see the old one', async () => {
  reset();
  let answer: ApprovalStatus = { state: 'rejected', approvalId: 'apr_1' };
  const { opened } = serving(() => answer);
  const h = harness();
  h.ops.wire();
  await tick();
  assert.equal(h.button.textContent, 'Request approval');
  assert.equal(h.ops.handleClick(), false, 'the request flow takes the click');
  h.line.querySelector('button')!.click();
  assert.deepEqual(opened, ['apr_1']);
  answer = { state: 'none' };
  h.ops.refresh();
  await tick();
  assert.equal(h.line.hidden, true, 'nothing to say once there is no request');
  h.ops.dispose();
});

test('refresh asks now, without waiting for inputs to rest', async () => {
  reset();
  const { asked } = serving(() => ({ state: 'in_review', approvalId: 'apr_1' }));
  const h = harness();
  h.ops.wire();
  await tick();
  h.ops.refresh();
  await tick();
  assert.equal(asked.length, 2);
  assert.equal(h.button.textContent, 'In review');
  h.ops.dispose();
});

test('leaving the view stops everything', async () => {
  reset();
  const { asked } = serving(() => ({ state: 'none' }));
  const h = harness();
  h.ops.wire();
  await tick();
  h.edit();
  h.ops.dispose();
  await pause(SETTLE_MS + 40);
  assert.equal(asked.length, 1);
  assert.equal(h.ta.approvalBar, null);
  h.edit();
  await pause(SETTLE_MS + 40);
  assert.equal(asked.length, 1);
});

test('a busy export is not repainted under it', async () => {
  reset();
  serving(() => ({ state: 'in_review', approvalId: 'apr_1' }));
  const h = harness();
  h.button.setAttribute('aria-busy', 'true');
  h.button.textContent = 'Exporting…';
  h.ops.wire();
  await tick();
  assert.equal(h.button.textContent, 'Exporting…');
  h.ops.dispose();
});
