// SPDX-License-Identifier: MPL-2.0
/**
 * The Remove-Background dialog as a JOB LAUNCHER (views/matte-dialog.ts, WP-F) -
 * the still-image sibling of upscale-dialog-job.test.ts.
 *
 * Run:  node --import ./tests/css-stub.mjs --test shells/web/src/views/matte-dialog-job.test.ts
 *
 * The conversion this pins: Run no longer runs anything. It validates (the
 * feasibility check stays), hands the decoded frame to lib/matte-job.ts's
 * startMatteJob, and the dialog CLOSES - the global toast owns progress and
 * cancellation from there. So:
 *   - the dialog carries NO progress bar any more (the job toast is the one bar);
 *   - Run enqueues exactly one job, with the decoded frame, the source bytes (for
 *     the ingredient scan), the credential title, the save name and the chosen
 *     model + output format;
 *   - the dialog never touches host.matte.run itself and never awaits the run;
 *   - the job's completion reaches the caller through opts.onComplete;
 *   - closing (Cancel or Escape) before Run enqueues nothing, and closing does NOT
 *     abort an enqueued job.
 *
 * lib/matte-job.ts is stubbed with a spy, so no model, canvas or C2PA signer is
 * involved; the decode is faked at the createImageBitmap/canvas boundary (jsdom has
 * neither). Everything else is the real openMatteDialog.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { JSDOM } from 'jsdom';

// The dialog imports its own stylesheet (the lazy-view pattern) and the job module.
// Node resolves neither usefully: stub the CSS to an empty module, and substitute a
// SPY for startMatteJob so the test observes the enqueue. outputFormatFor is a pure
// helper the dialog also imports from there, so the stub keeps a real copy of it.
registerHooks({
  load(url: string, ctx: unknown, next: (u: string, c: unknown) => unknown) {
    if (url.endsWith('.css')) return { format: 'module', shortCircuit: true, source: 'export default {};' };
    if (url.endsWith('lib/matte-job.ts')) {
      return {
        format: 'module', shortCircuit: true,
        source: `export function startMatteJob(host, req, hooks = {}) {
          const calls = (globalThis.__matteJobs ??= []);
          calls.push({ req, hooks });
          return { id: 'job-stub', started: Promise.resolve(), cancelled: false,
            progress() {}, finish() {}, fail() {} };
        }
        export function outputFormatFor(fmt) {
          const f = String(fmt ?? '').toLowerCase().replace('jpeg', 'jpg');
          return ['png', 'webp', 'avif'].includes(f) ? f : 'png';
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
  'KeyboardEvent', 'DOMParser', 'getComputedStyle', 'MutationObserver', 'IntersectionObserver', 'localStorage',
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
});

const { openMatteDialog } = await import('./matte-dialog.ts');

// ── fixture ───────────────────────────────────────────────────────────────────

const MODEL = {
  id: 'u2netp', name: 'U²-Net lite', tier: 'default', version: '1.0',
  approxBytes: 4_574_861, license: 'Apache-2.0', attribution: 'Xuebin Qin et al.',
};

function makeHost() {
  return {
    log: () => {},
    matte: {
      isAvailable: () => true,
      backend: () => 'wasm',
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
  return ((globalThis as unknown as { __matteJobs?: unknown[] }).__matteJobs ?? []) as never;
}
function resetJobs(): void { (globalThis as unknown as { __matteJobs: unknown[] }).__matteJobs = []; }

function overlay(): HTMLElement | null {
  return dom.window.document.querySelector<HTMLElement>('.matte-overlay');
}

/** A source the dialog can "decode" - the bytes are never parsed here. */
const source = (): Blob => new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/png' });

// ── the dialog has no bar of its own any more ─────────────────────────────────

test('the dialog carries no progress bar: the global job toast is the only one', async () => {
  resetJobs();
  const closed = openMatteDialog(makeHost() as never, { source: source(), sourceName: 'Holiday snap.png' });
  await settle();
  const el = overlay();
  assert.ok(el, 'the dialog mounted');
  assert.equal(el!.querySelector('[data-progress]'), null, 'no in-dialog progressbar');
  assert.equal(el!.querySelector('.matte-progress-fill'), null, 'and no fill to drive');
  assert.ok(el!.querySelector('[data-status]'), 'the status line stays - it carries the hand-off message');

  el!.querySelector<HTMLButtonElement>('.matte-cancel')!.dispatchEvent(new W.MouseEvent('click', { bubbles: true }));
  await closed;
  assert.equal(jobs().length, 0, 'closing without Running enqueues nothing');
});

// ── Run enqueues, then the dialog closes ──────────────────────────────────────

test('Run enqueues ONE job with the decoded frame + the controls’ choices, then closes', async () => {
  resetJobs();
  const completed: Array<{ id: string }> = [];
  const closed = openMatteDialog(makeHost() as never, {
    source: source(), sourceName: 'Holiday snap.png',
    onComplete: (ref) => completed.push(ref as unknown as { id: string }),
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
  assert.equal(req.model, MODEL.id, 'the model the picker holds');
  assert.equal(req.outFormat, 'png', 'a PNG source keeps its alpha-capable format');

  // The message lands, then the dialog dismisses itself without waiting on the run.
  assert.ok(overlay(), 'the dialog is still up while the message shows');
  const status = el.querySelector<HTMLElement>('[data-status]')!;
  assert.match(status.textContent ?? '', /background/i);
  await closed;
  assert.equal(overlay(), null, 'the dialog closed itself');

  // The job's completion is what reaches the caller.
  hooks.onComplete?.({ id: 'user/matte/1-holiday-snap' } as never);
  assert.deepEqual(completed, [{ id: 'user/matte/1-holiday-snap' }]);
});

// ── the run belongs to the job, not the dialog ────────────────────────────────

test('the dialog never runs the model itself, and closing does not kill an enqueued job', async () => {
  resetJobs();
  // host.matte.run throws if it is ever called - so reaching the end proves the
  // dialog only ENQUEUED. The job stub exposes no abort, and the dialog holds no
  // AbortController any more, so closing can't cancel what is already queued.
  const closed = openMatteDialog(makeHost() as never, { source: source(), sourceName: 'a.png' });
  await settle();
  overlay()!.querySelector<HTMLButtonElement>('[data-run]')!.dispatchEvent(new W.MouseEvent('click', { bubbles: true }));
  await settle(2);
  assert.equal(jobs().length, 1);
  await closed;
  assert.equal(overlay(), null);
  assert.equal(jobs().length, 1, 'the enqueued job survives the dialog it was started from');
});

// ── Escape still just closes ──────────────────────────────────────────────────

test('Escape closes the dialog and starts nothing', async () => {
  resetJobs();
  const closed = openMatteDialog(makeHost() as never, { source: source(), sourceName: 'a.png' });
  await settle();
  assert.ok(overlay());
  overlay()!.closest('dialog')!.dispatchEvent(new dom.window.Event('cancel', { cancelable: true }));
  await closed;
  assert.equal(overlay(), null);
  assert.equal(jobs().length, 0);
});

// ── every caller reads the result off onComplete, not off the return ──────────

test('every openMatteDialog call site passes an onComplete hook', async () => {
  const { readFileSync, readdirSync, existsSync } = await import('node:fs');
  const { dirname, join } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const here = dirname(fileURLToPath(import.meta.url));
  // The dialog resolves when it CLOSES, not when the cutout exists, so a call site
  // that ignores onComplete silently drops the user's result. tsc can't catch that
  // (the hook is optional), which is why it is pinned here.
  for (const file of ['catalog.ts', 'picker.ts', 'free-canvas.ts']) {
    // catalog and free-canvas are an orchestrator plus feature modules under a dir of the same name (2026-09-09 split)
    const dir = join(here, file.replace(/\.ts$/, ''));
    const text = [readFileSync(join(here, file), 'utf8'), ...(existsSync(dir) ? readdirSync(dir).filter((n) => n.endsWith('.ts')).sort().map((n) => readFileSync(join(dir, n), 'utf8')) : [])].join('\n');
    let from = 0;
    let calls = 0;
    for (;;) {
      const at = text.indexOf('openMatteDialog(', from);
      if (at < 0) break;
      from = at + 1;
      calls++;
      assert.match(text.slice(at, at + 600), /onComplete/,
        `${file}: an openMatteDialog call near index ${at} has no onComplete - its result would be dropped`);
    }
    assert.ok(calls > 0, `${file} still calls openMatteDialog`);
  }
});
