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

const { answerForSettings, approvalBarView, approvalStateOps, fileFits, SETTLE_MS } = await import('./approval-state.ts');
const { recordedFileSize } = await import('../export-dimension-fields.ts');
const { registerApprovalOpener, _clearApprovalOpenerForTests } = await import('../../lib/approval-request.ts');
const { setExportPolicy, _clearExportPolicyForTests } = await import('../../lib/export-policy.ts');
type ApprovalStatus = import('../../lib/approval-request.ts').ApprovalStatus;
type ApprovalFile = import('../../lib/approval-request.ts').ApprovalFile;
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
  /** Type a size. The bar's own field handler reports the change the same way. */
  size(width: number | string, height?: number | string): void;
  delivered: Array<{ name: string; size: number }>;
}

function harness(render: Record<string, unknown> = {}): Harness {
  const el = document.createElement('div');
  el.innerHTML = `<select data-action="format"><option value="svg">SVG</option><option value="jpeg">JPEG</option></select>
    <input data-action="export-width" value="600"><input data-action="export-height" value="600">
    <select data-action="export-unit"><option value="px">px</option><option value="mm">mm</option></select>
    <input data-action="export-dpi" value="300">
    <button type="button" data-action="request-approval">Request approval</button>
    <p data-approval-status hidden></p>`;
  document.body.replaceChildren(el);
  const subscribers = new Set<() => void>();
  const delivered: Array<{ name: string; size: number }> = [];
  const format = el.querySelector('select')!;
  const field = (name: string): HTMLInputElement => el.querySelector<HTMLInputElement>(`[data-action="export-${name}"]`)!;
  const ta = {
    el, formatEl: format, formats: ['svg'], manifest: { id: 'card', name: 'Card', render }, activeSlot: null,
    experience: { recordDeviceActivity: false },
    dims: {
      exportDims: () => {
        const unit = field('unit').value;
        const side = (name: string): number | string | undefined => {
          const value = parseFloat(field(name).value);
          return value > 0 ? (unit === 'px' ? value : `${value}${unit}`) : undefined;
        };
        return { width: side('width'), height: side('height'), ...(unit === 'px' ? {} : { dpi: Number(field('dpi').value) }) };
      },
    },
    runtime: { getModel: () => [], subscribe: (fn: () => void) => { subscribers.add(fn); return () => { subscribers.delete(fn); }; } },
    saving: { deliverToBar: async (blob: Blob, name: string) => { delivered.push({ name, size: blob.size }); } },
    approvalBar: null,
  } as unknown as ActionsCtx;
  const ops = approvalStateOps(ta);
  return {
    ta, ops, format, delivered,
    button: el.querySelector('button')!, line: el.querySelector('p')!,
    edit: () => { for (const fn of subscribers) fn(); },
    size: (width, height = width) => { field('width').value = String(width); field('height').value = String(height); ops.sizeChanged(); },
  };
}

interface Asked { toolId: string; format: string; query: string; signal?: AbortSignal | undefined }
function serving(
  answer: (asked: Asked) => ApprovalStatus | null | Promise<ApprovalStatus | null>,
  listed: (id: string) => ApprovalFile[] | Promise<ApprovalFile[]> = () => [],
): { asked: Asked[]; opened: string[]; files: string[]; reads: string[] } {
  const asked: Asked[] = [];
  const opened: string[] = [];
  const files: string[] = [];
  const reads: string[] = [];
  registerApprovalOpener(() => {}, {
    work: {
      status: async (q, signal) => { asked.push({ ...q, signal }); return answer({ ...q, signal }); },
      files: async (id) => { reads.push(id); return listed(id); },
      approvedFile: async (id) => { files.push(id); return { blob: new Blob(['approved']), name: 'card.svg' }; },
      open: (id) => { opened.push(id); },
      sessions: async () => new Map(),
    },
  });
  return { asked, opened, files, reads };
}

const file = (approvalId: string, state: ApprovalFile['state'], width?: number, height = width, over: Partial<ApprovalFile> = {}): ApprovalFile => ({
  approvalId, state, format: 'svg', video: false,
  ...(width !== undefined ? { widthPx: width } : {}), ...(height !== undefined ? { heightPx: height } : {}),
  ...(state === 'approved' ? { decidedAt: '2026-11-05T12:00:00Z' } : {}), ...over,
});

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
  assert.match(approvalBarView({ state: 'approved', decidedAt: '2026-11-02T12:00:00Z', file: file('a', 'approved', 600) }).note, /^Approved .+2026\. SVG, 600 × 600\.$/);
  assert.match(approvalBarView({ state: 'approved', decidedAt: '2026-11-02T12:00:00Z', file: file('a', 'approved', undefined, undefined, { format: 'pdf' }) }).note, /^Approved .+2026\. PDF\.$/, 'a file with no recorded size gives none');
  assert.equal(approvalBarView({ state: 'approved', file: file('a', 'approved', 600) }).note, 'Approved. SVG, 600 × 600.');
  assert.match(approvalBarView({ state: 'approved', decidedAt: '2026-11-02T12:00:00Z' }).note, /^Approved .+2026\. Size not checked\.$/, 'facts it could not read are not claimed');
  assert.deepEqual(approvalBarView({ state: 'resized', approvalId: 'a' }), { action: 'request', label: 'Request approval', note: 'Changed since the request.', open: 'See request' });
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
      files: async () => [],
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

const SVG = (width?: number, height?: number, physical = false) => ({ format: 'svg', physical, ...(width !== undefined ? { width } : {}), ...(height !== undefined ? { height } : {}) });

test('the size a file records: an image in pixels at its dpi, an SVG in CSS pixels', () => {
  assert.deepEqual(recordedFileSize({ width: 600, height: 400 }, 'png'), { width: 600, height: 400 });
  assert.deepEqual(recordedFileSize({ width: 600, height: 400 }, 'svg'), { width: 600, height: 400 });
  assert.deepEqual(recordedFileSize({ width: '210mm', height: '297mm', dpi: 300 }, 'png'), { width: 2480, height: 3508 });
  assert.deepEqual(recordedFileSize({ width: '210mm', height: '297mm', dpi: 150 }, 'png'), { width: 1240, height: 1754 });
  assert.deepEqual(recordedFileSize({ width: '210mm', height: '297mm', dpi: 300 }, 'svg'), { width: 794, height: 1123 });
  assert.deepEqual(recordedFileSize({ width: 600 }, 'png'), { width: 600 }, 'a blank side is the tool\'s choice');
  assert.deepEqual(recordedFileSize({}, 'png'), {});
});

test('a file fits when its format and every side both state agree, exactly in pixels', () => {
  const six = file('a', 'approved', 600);
  assert.equal(fileFits(six, SVG(600, 600)), true);
  assert.equal(fileFits(six, SVG(1200, 600)), false);
  assert.equal(fileFits(six, SVG(600, 1200)), false);
  assert.equal(fileFits(six, SVG(601, 600)), false, 'one pixel is another file');
  assert.equal(fileFits(six, { ...SVG(600, 600), format: 'png' }), false, 'another format is another file');
  assert.equal(fileFits(six, SVG(601, 599, true)), true, 'a physical unit rounds on its way to pixels');
  assert.equal(fileFits(six, SVG(602, 600, true)), false, 'and only by a pixel');
  assert.equal(fileFits(file('a', 'approved', 600, 600, { video: true }), SVG(601, 600)), true, 'an encoder may even out a side');
  assert.equal(fileFits(six, SVG(600)), true, 'a side left blank is the tool\'s choice');
  assert.equal(fileFits(six, SVG()), true, 'a tool with no size of its own');
  assert.equal(fileFits(file('a', 'approved', undefined, undefined), SVG(1200, 1200)), true, 'a file with no recorded size cannot differ');
});

test('the file that fits the bar decides, and approved beats open beats rejected', () => {
  const approved: ApprovalStatus = { state: 'approved', approvalId: 'old', decidedAt: '2026-11-01T00:00:00Z' };
  const rows = [file('new', 'in_review', 1200), file('no', 'rejected', 800), file('old', 'approved', 600)];
  assert.equal(answerForSettings(approved, rows, SVG(600, 600))?.state, 'approved');
  assert.equal(answerForSettings(approved, rows, SVG(600, 600))?.approvalId, 'old');
  assert.deepEqual(answerForSettings(approved, rows, SVG(1200, 1200)), { state: 'in_review', approvalId: 'new', file: rows[0] });
  assert.deepEqual(answerForSettings(approved, rows, SVG(800, 800)), { state: 'rejected', approvalId: 'no', file: rows[1] });
  assert.deepEqual(answerForSettings(approved, rows, SVG(900, 900)), { state: 'changed', approvalId: 'old' }, 'nothing at this size');
  const both = [file('later', 'rejected', 600), file('old', 'approved', 600)];
  assert.equal(answerForSettings(approved, both, SVG(600, 600))?.approvalId, 'old', 'a later rejection says nothing about the approved file');
  const open: ApprovalStatus = { state: 'in_review', approvalId: 'new' };
  assert.deepEqual(answerForSettings(open, [file('new', 'in_review', 600)], SVG(900, 900)), { state: 'resized', approvalId: 'new' });
  assert.equal(answerForSettings(approved, [], SVG(900, 900)), approved, 'no facts: the answer stands and claims no size');
  assert.equal(answerForSettings(approved, null, SVG(900, 900)), approved);
  const rejected: ApprovalStatus = { state: 'rejected', approvalId: 'no' };
  assert.equal(answerForSettings(rejected, rows, SVG(600, 600)), rejected, 'other states are the instance\'s word');
  assert.equal(answerForSettings(null, rows, SVG(600, 600)), null);
});

test('approved at this size: the line gives the file and the click delivers it', async () => {
  reset();
  const { files } = serving(() => ({ state: 'approved', approvalId: 'apr_1', decidedAt: '2026-11-05T12:00:00Z' }), () => [file('apr_1', 'approved', 600)]);
  const h = harness();
  h.ops.wire();
  await tick();
  assert.equal(h.button.textContent, 'Download approved file');
  assert.match(h.line.textContent ?? '', /^Approved .+2026\. SVG, 600 × 600\.$/);
  assert.equal(h.button.dataset.approvalState, 'approved');
  assert.equal(h.ops.handleClick(), true);
  await tick();
  assert.deepEqual(files, ['apr_1']);
  h.ops.dispose();
});

test('another size: the same state as changed inputs, with the approved request a click away, and no read', async () => {
  reset();
  const { asked, reads, opened, files } = serving(() => ({ state: 'approved', approvalId: 'apr_1', decidedAt: '2026-11-05T12:00:00Z' }), () => [file('apr_1', 'approved', 600)]);
  const h = harness();
  h.ops.wire();
  await tick();
  assert.equal(asked.length, 1);
  assert.deepEqual(reads, ['apr_1']);
  h.size(1);
  h.size(12);
  h.size(120);
  h.size(1200);
  assert.equal(h.button.textContent, 'Download approved file', 'keystrokes wait for the field to rest');
  await pause(SETTLE_MS + 40);
  assert.equal(h.button.textContent, 'Request approval');
  assert.equal(h.line.textContent?.startsWith('Changed since approval.'), true);
  assert.equal(h.button.dataset.approvalState, 'changed');
  assert.equal(asked.length, 1, 'a size edit asks nothing');
  assert.equal(reads.length, 1, 'a size edit reads nothing');
  assert.equal(h.ops.handleClick(), false, 'the request flow takes the click');
  assert.deepEqual(files, [], 'and the 600 file was not handed over');
  h.line.querySelector('button')!.click();
  assert.deepEqual(opened, ['apr_1']);
  h.size(600);
  await pause(SETTLE_MS + 40);
  assert.equal(h.button.textContent, 'Download approved file', 'the approved size offers the file again');
  assert.equal(reads.length, 1);
  h.ops.dispose();
});

test('a click before the field has rested shows the truth and delivers nothing', async () => {
  reset();
  const { files } = serving(() => ({ state: 'approved', approvalId: 'apr_1' }), () => [file('apr_1', 'approved', 600)]);
  const h = harness();
  h.ops.wire();
  await tick();
  h.size(1200);
  assert.equal(h.button.textContent, 'Download approved file');
  assert.equal(h.ops.handleClick(), true, 'the click is spent on showing the new state');
  assert.equal(h.button.textContent, 'Request approval');
  await tick();
  assert.deepEqual(files, []);
  assert.deepEqual(h.delivered, []);
  assert.equal(h.ops.handleClick(), false, 'the next click requests');
  h.ops.dispose();
});

test('a size the file records in other units: unit and dpi changes compare again', async () => {
  reset();
  const { reads } = serving(() => ({ state: 'approved', approvalId: 'apr_1' }), () => [file('apr_1', 'approved', 794, 1123)]);
  const h = harness();
  h.size(210, 297);
  const unit = h.ta.el!.querySelector<HTMLSelectElement>('[data-action="export-unit"]')!;
  unit.value = 'mm';
  h.ops.wire();
  await tick();
  assert.equal(h.button.textContent, 'Download approved file', 'an SVG at 210 x 297 mm is the file a browser read as 794 x 1123');
  unit.value = 'px';
  unit.dispatchEvent(new dom.window.Event('change'));
  await pause(SETTLE_MS + 40);
  assert.equal(h.button.textContent, 'Request approval', '210 px is another file');
  assert.equal(reads.length, 1);
  h.ops.dispose();
});

test('a tool with no size of its own compares nothing', async () => {
  reset();
  serving(() => ({ state: 'approved', approvalId: 'apr_1' }), () => [file('apr_1', 'approved', 600)]);
  const h = harness({ dims: false });
  h.size(1200);
  h.ops.wire();
  await tick();
  assert.equal(h.button.textContent, 'Download approved file');
  h.ops.dispose();
});

test('a request the list does not hold: the file stays reachable and no size is claimed', async () => {
  reset();
  const { files } = serving(() => ({ state: 'approved', approvalId: 'apr_1', decidedAt: '2026-11-05T12:00:00Z' }));
  const h = harness();
  h.size(1200);
  h.ops.wire();
  await tick();
  assert.equal(h.button.textContent, 'Download approved file');
  assert.match(h.line.textContent ?? '', /Size not checked\.$/);
  h.ops.handleClick();
  await tick();
  assert.deepEqual(files, ['apr_1']);
  h.ops.dispose();
});

test('a read that fails claims no size, and the next answer reads again', async () => {
  reset();
  let fail = true;
  const { reads } = serving(() => ({ state: 'approved', approvalId: 'apr_1' }), () => {
    if (fail) throw new Error('offline');
    return [file('apr_1', 'approved', 600)];
  });
  const h = harness();
  h.ops.wire();
  await tick();
  assert.match(h.line.textContent ?? '', /Size not checked\.$/);
  fail = false;
  h.edit();
  await pause(SETTLE_MS + 40);
  assert.equal(reads.length, 2);
  assert.match(h.line.textContent ?? '', /^Approved .+2026\. SVG, 600 × 600\.$/);
  h.ops.dispose();
});

test('one read per state change: edits with the same answer read nothing, a new state reads once', async () => {
  reset();
  let answer: ApprovalStatus = { state: 'approved', approvalId: 'apr_1' };
  const { asked, reads } = serving(() => answer, () => [file('apr_1', 'approved', 600), file('apr_2', 'in_review', 600)]);
  const h = harness();
  h.ops.wire();
  await tick();
  h.edit();
  await pause(SETTLE_MS + 40);
  h.edit();
  await pause(SETTLE_MS + 40);
  assert.equal(asked.length, 3, 'each settled edit asks the instance');
  assert.deepEqual(reads, ['apr_1'], 'and the same answer reads once');
  answer = { state: 'in_review', approvalId: 'apr_2' };
  h.edit();
  await pause(SETTLE_MS + 40);
  assert.deepEqual(reads, ['apr_1', 'apr_2']);
  answer = { state: 'none' };
  h.edit();
  await pause(SETTLE_MS + 40);
  assert.equal(reads.length, 2, 'a state with no request reads nothing');
  h.ops.dispose();
});

test('a new request at a new size: the instance still names the old approval, and the bar shows the new request', async () => {
  reset();
  let listed = [file('apr_1', 'approved', 600)];
  const { asked, reads } = serving(() => ({ state: 'approved', approvalId: 'apr_1', decidedAt: '2026-11-05T12:00:00Z' }), () => listed);
  const h = harness();
  h.ops.wire();
  await tick();
  h.size(1200);
  await pause(SETTLE_MS + 40);
  assert.equal(h.line.textContent?.startsWith('Changed since approval.'), true);
  listed = [file('apr_2', 'in_review', 1200), file('apr_1', 'approved', 600)];
  h.ops.refresh();
  await tick();
  assert.equal(asked.length, 2);
  assert.equal(reads.length, 2, 'sending a request reads again, though the answer did not move');
  assert.equal(h.button.textContent, 'In review');
  assert.equal(h.button.hasAttribute('disabled'), true);
  h.size(600);
  await pause(SETTLE_MS + 40);
  assert.equal(h.button.textContent, 'Download approved file', 'the older file is still there at its size');
  assert.equal(h.button.hasAttribute('disabled'), false);
  listed = [file('apr_2', 'approved', 1200), file('apr_1', 'approved', 600)];
  h.size(1200);
  h.ops.refresh();
  await tick();
  assert.equal(h.button.textContent, 'Download approved file');
  assert.equal(h.ops.handleClick(), true);
  await tick();
  h.ops.dispose();
});

test('an open request at another size does not hold the control', async () => {
  reset();
  serving(() => ({ state: 'in_review', approvalId: 'apr_1' }), () => [file('apr_1', 'in_review', 600)]);
  const h = harness();
  h.ops.wire();
  await tick();
  assert.equal(h.button.textContent, 'In review');
  h.size(1200);
  await pause(SETTLE_MS + 40);
  assert.equal(h.button.textContent, 'Request approval');
  assert.equal(h.button.hasAttribute('disabled'), false);
  assert.equal(h.line.textContent?.startsWith('Changed since the request.'), true);
  assert.equal(h.button.dataset.approvalState, 'resized');
  h.ops.dispose();
});

test('another format for the same inputs: the approved file is not this one, and See request reaches it', async () => {
  reset();
  const { opened } = serving(q => (q.format === 'svg' ? { state: 'approved', approvalId: 'apr_1' } : { state: 'none' }), () => [file('apr_1', 'approved', 600)]);
  const h = harness();
  h.ops.wire();
  await tick();
  assert.equal(h.button.textContent, 'Download approved file');
  h.format.value = 'jpeg';
  h.format.dispatchEvent(new dom.window.Event('change'));
  assert.equal(h.ops.handleClick(), true, 'a click before the answer delivers nothing');
  assert.deepEqual(h.delivered, []);
  assert.equal(h.button.textContent, 'Request approval');
  await pause(SETTLE_MS + 40);
  assert.equal(h.button.textContent, 'Request approval');
  assert.equal(h.line.textContent?.startsWith('Changed since approval.'), true);
  h.line.querySelector('button')!.click();
  assert.deepEqual(opened, ['apr_1']);
  h.format.value = 'svg';
  h.format.dispatchEvent(new dom.window.Event('change'));
  await pause(SETTLE_MS + 40);
  assert.equal(h.button.textContent, 'Download approved file');
  h.ops.dispose();
});

test('the window coming back reads the files again', async () => {
  reset();
  let listed = [file('apr_2', 'in_review', 600)];
  const { reads } = serving(() => ({ state: 'in_review', approvalId: 'apr_2' }), () => listed);
  const h = harness();
  h.ops.wire();
  await tick();
  listed = [file('apr_2', 'rejected', 600)];
  h.ta.approvalBar!.askedAt = 0;
  dom.window.dispatchEvent(new dom.window.Event('focus'));
  await tick();
  assert.equal(reads.length, 2);
  assert.equal(h.button.textContent, 'Request approval');
  assert.equal(h.line.textContent?.startsWith('Not approved.'), true);
  h.ops.dispose();
});

test('leaving the view stops a size comparison on its way', async () => {
  reset();
  serving(() => ({ state: 'approved', approvalId: 'apr_1' }), () => [file('apr_1', 'approved', 600)]);
  const h = harness();
  h.ops.wire();
  await tick();
  h.size(1200);
  h.ops.dispose();
  await pause(SETTLE_MS + 40);
  assert.equal(h.button.textContent, 'Download approved file');
});
