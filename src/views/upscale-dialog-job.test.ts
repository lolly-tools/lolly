// SPDX-License-Identifier: MPL-2.0
/**
 * The Upscale dialog as a JOB LAUNCHER (views/upscale-dialog.ts, WP-F).
 *
 * Run:  node --import ./tests/css-stub.mjs --test shells/web/src/views/upscale-dialog-job.test.ts
 *
 * The conversion this pins: Run no longer runs anything. It validates and hands
 * the decoded frame to lib/upscale-job.ts's startUpscaleJob, then the sheet
 * CLOSES - the global toast owns progress and cancellation from there. So:
 *   - the sheet carries NO progress bar any more (the job toast is the one bar);
 *   - Run enqueues exactly one job, with the decoded frame, the credential title
 *     (the decoded source's own name), the save name (the caller's display name)
 *     and the model options the controls describe;
 *   - the dialog dismisses itself and resolves without waiting on the run;
 *   - the job's completion reaches the caller through opts.onComplete;
 *   - closing without Running enqueues nothing.
 *
 * lib/upscale-job.ts is stubbed with a spy, so no model, canvas or C2PA signer is
 * involved; the decode is faked at the createImageBitmap/canvas boundary (jsdom
 * has neither). Everything else is the real openUpscaleDialog.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { JSDOM } from 'jsdom';

// The dialog imports its own stylesheet (the lazy-view pattern) and the job
// module. Node resolves neither usefully: stub the CSS to an empty module, and
// substitute a SPY for startUpscaleJob so the test observes the enqueue.
registerHooks({
  load(url: string, ctx: unknown, next: (u: string, c: unknown) => unknown) {
    if (url.endsWith('.css')) return { format: 'module', shortCircuit: true, source: 'export default {};' };
    if (url.endsWith('lib/upscale-job.ts')) {
      return {
        format: 'module', shortCircuit: true,
        source: `export function startUpscaleJob(host, req, hooks = {}) {
          const calls = (globalThis.__upscaleJobs ??= []);
          calls.push({ req, hooks });
          return { id: 'job-stub', started: Promise.resolve(), cancelled: false,
            progress() {}, finish() {}, fail() {} };
        }`,
      };
    }
    return next(url, ctx);
  },
} as Parameters<typeof registerHooks>[0]);

const dom = new JSDOM('<!DOCTYPE html><body></body>', { pretendToBeVisual: true, url: 'https://lolly.test/' });
dom.window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
dom.window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
const W = dom.window as unknown as typeof globalThis & { MouseEvent: typeof MouseEvent; KeyboardEvent: typeof KeyboardEvent };
for (const k of [
  'window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLButtonElement', 'HTMLSelectElement',
  'HTMLImageElement', 'HTMLCanvasElement', 'Element', 'Node', 'Event', 'CustomEvent', 'MouseEvent',
  'KeyboardEvent', 'DOMParser', 'getComputedStyle', 'MutationObserver', 'IntersectionObserver',
]) {
  const v = (dom.window as unknown as Record<string, unknown>)[k];
  if (v !== undefined) (globalThis as Record<string, unknown>)[k] = v;
}
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => dom.window.requestAnimationFrame(cb)) as typeof requestAnimationFrame;
globalThis.cancelAnimationFrame = ((h: number) => dom.window.cancelAnimationFrame(h)) as typeof cancelAnimationFrame;
(globalThis as Record<string, unknown>).matchMedia = (q: string) =>
  ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} });

// The decode boundary: jsdom has no ImageBitmap and no 2D context, so hand the
// dialog a fixed 8×6 source frame.
const SRC_W = 8, SRC_H = 6;
(globalThis as Record<string, unknown>).createImageBitmap = async () => ({ width: SRC_W, height: SRC_H, close() {} });
(dom.window.HTMLCanvasElement.prototype as unknown as { getContext: () => unknown }).getContext = () => ({
  drawImage() {},
  putImageData() {},
  createImageData: (w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
  getImageData: (_x: number, _y: number, w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
  imageSmoothingEnabled: true,
});

const { openUpscaleDialog } = await import('./upscale-dialog.ts');

// ── fixture ───────────────────────────────────────────────────────────────────

const MODEL = {
  id: 'realesr-general-x4v3', name: 'Real-ESRGAN general (fast)', scale: 4, version: 'v0.3.0',
  approxBytes: 4_000_000, license: 'BSD-3-Clause', attribution: 'xinntao',
};

function makeHost() {
  return {
    log: () => {},
    upscale: {
      isAvailable: () => true,
      models: () => [MODEL],
      modelBytes: () => MODEL.approxBytes,
      cached: async () => true,
      canRun: async () => ({ ok: true }),
      run: async () => { throw new Error('the dialog must never run the model itself'); },
    },
    assets: { _uploadUserAsset: async () => {}, get: async (id: string) => ({ id, type: 'raster', url: `blob:${id}` }) },
  };
}

async function settle(n = 10): Promise<void> {
  for (let i = 0; i < n; i++) await new Promise<void>(r => setTimeout(r, 0));
}

function jobs(): Array<{ req: Record<string, unknown>; hooks: Record<string, (v: unknown) => void> }> {
  return ((globalThis as unknown as { __upscaleJobs?: unknown[] }).__upscaleJobs ?? []) as never;
}
function resetJobs(): void { (globalThis as unknown as { __upscaleJobs: unknown[] }).__upscaleJobs = []; }

function overlay(): HTMLElement | null {
  return dom.window.document.querySelector<HTMLElement>('.upscale-overlay');
}

/** A source the dialog can "decode" - the bytes are never parsed here. */
const source = (): Blob => new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/png' });

// ── the sheet has no bar of its own any more ──────────────────────────────────

test('the sheet carries no progress bar: the global job toast is the only one', async () => {
  resetJobs();
  const closed = openUpscaleDialog(makeHost() as never, { source: source(), sourceName: 'Holiday snap.png' });
  await settle();
  const el = overlay();
  assert.ok(el, 'the sheet mounted');
  assert.equal(el!.querySelector('[data-progress]'), null, 'no in-dialog progressbar');
  assert.equal(el!.querySelector('.upscale-progress-fill'), null, 'and no fill to drive');
  assert.ok(el!.querySelector('[data-status]'), 'the status line stays - it carries the hand-off message');

  el!.querySelector<HTMLButtonElement>('.upscale-cancel')!.dispatchEvent(new W.MouseEvent('click', { bubbles: true }));
  await closed;
  assert.equal(jobs().length, 0, 'closing without Running enqueues nothing');
});

// ── Run enqueues, then the sheet closes ───────────────────────────────────────

test('Run enqueues ONE job with the decoded frame + the controls’ options, then closes', async () => {
  resetJobs();
  const completed: Array<{ id: string }> = [];
  const closed = openUpscaleDialog(makeHost() as never, {
    source: source(), sourceName: 'Holiday snap.png',
    onComplete: (ref) => completed.push(ref as { id: string }),
  });
  await settle();
  const el = overlay()!;
  const run = el.querySelector<HTMLButtonElement>('[data-run]')!;
  assert.equal(run.disabled, false, 'the feasibility check cleared Run');

  run.dispatchEvent(new W.MouseEvent('click', { bubbles: true }));
  await settle(2);

  assert.equal(jobs().length, 1, 'exactly one job');
  const { req, hooks } = jobs()[0]!;
  const f = req.frame as { width: number; height: number };
  assert.equal(f.width, SRC_W);
  assert.equal(f.height, SRC_H);
  assert.equal(req.sourceName, 'Holiday snap.png', 'the credential title comes from the decoded source');
  assert.equal(req.saveName, 'Holiday snap.png', 'and the save name from the caller');
  assert.ok(req.sourceBytes, 'the source bytes ride along for the ingredient scan');
  const model = req.model as { model: string; scale: number; targetMaxEdge: number };
  assert.equal(model.model, MODEL.id, 'the recommended engine');
  assert.equal(model.scale, 4);
  assert.equal(model.targetMaxEdge, SRC_W * 4, 'seeded to the engine’s native ceiling');
  assert.equal(req.pixel, undefined, 'the model path is not the pixel path');

  // The message lands, then the sheet dismisses itself without waiting on the run.
  assert.ok(overlay(), 'the sheet is still up while the message shows');
  const status = el.querySelector<HTMLElement>('[data-status]')!;
  assert.match(status.textContent ?? '', /background/i);
  await closed;
  assert.equal(overlay(), null, 'the sheet closed itself');

  // The job's completion is what reaches the caller.
  hooks.onComplete?.({ id: 'user/upscaled/1-holiday-snap' } as never);
  assert.deepEqual(completed, [{ id: 'user/upscaled/1-holiday-snap' }]);
});

// ── the pixel-art path enqueues the algorithmic request ───────────────────────

test('the pixel-art intent enqueues a pixel scale and no model', async () => {
  resetJobs();
  const closed = openUpscaleDialog(makeHost() as never, { source: source(), sourceName: 'sprite.png' });
  await settle();
  const el = overlay()!;
  const intent = el.querySelector<HTMLSelectElement>('[data-intent]')!;
  intent.value = 'pixel';
  intent.dispatchEvent(new W.Event('change', { bubbles: true }));
  await settle();
  el.querySelector<HTMLButtonElement>('[data-run]')!.dispatchEvent(new W.MouseEvent('click', { bubbles: true }));
  await settle(2);

  assert.equal(jobs().length, 1);
  const req = jobs()[0]!.req;
  assert.deepEqual(req.pixel, { scale: 4 }, 'the integer scale the select holds');
  assert.equal(req.model, undefined, 'no model on the local path');
  await closed;
});

// ── Escape still just closes ──────────────────────────────────────────────────

test('Escape closes the sheet and starts nothing', async () => {
  resetJobs();
  const closed = openUpscaleDialog(makeHost() as never, { source: source(), sourceName: 'a.png' });
  await settle();
  assert.ok(overlay());
  overlay()!.closest('dialog')!.dispatchEvent(new dom.window.Event('cancel', { cancelable: true }));
  await closed;
  assert.equal(overlay(), null);
  assert.equal(jobs().length, 0);
});
