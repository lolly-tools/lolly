// SPDX-License-Identifier: MPL-2.0
/**
 * Export shutter - the STATUS BLOCK contract (fix T1 of the mobile UX audit).
 *
 * At <=640px the shutter goes fullscreen, so a long export used to leave a phone
 * with an opaque plate: no progress, no elapsed time, no way back, and (until
 * this) taps falling straight through to controls nobody could see. The block
 * that fixes that must not appear on a fast export, so the delay gate is as much
 * of the contract as the block itself.
 *
 * The subject is the real createShutter against jsdom - no WebGL there, so it
 * takes the seal-plate fallback, which is the path a phone without a GPU context
 * takes too. STATUS_DELAY is pinned rather than slept through (the RETENTION /
 * HOOK_BUDGET_MS mutable-object pattern).
 *
 * NOT covered here (needs a browser): the fullscreen reparent to <body> (jsdom's
 * matchMedia always answers false), the swirl shader, and whether the block is
 * legible over the plate.
 *
 * Run directly:  node --test shells/web/src/lib/shutter.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

registerHooks({
  resolve(spec: string, ctx: { parentURL?: string }, next: (s: string, c: unknown) => unknown) {
    if (spec.endsWith('.js') && spec.startsWith('.') && ctx.parentURL) {
      const js = new URL(spec, ctx.parentURL);
      if (!existsSync(fileURLToPath(js))) {
        const ts = new URL(spec.replace(/\.js$/, '.ts'), ctx.parentURL);
        if (existsSync(fileURLToPath(ts))) return { url: ts.href, format: 'module-typescript', shortCircuit: true };
      }
    }
    return next(spec, ctx);
  },
  load(url: string, ctx: unknown, next: (u: string, c: unknown) => unknown) {
    if (url.endsWith('.css')) return { format: 'module', shortCircuit: true, source: 'export default {};' };
    return next(url, ctx);
  },
} as Parameters<typeof registerHooks>[0]);

const dom = new JSDOM('<!DOCTYPE html><body></body>', { url: 'https://example.test/' });
// jsdom 25 has no matchMedia, and the shutter asks two questions through it.
// Reduced motion is answered YES: the iris then jumps to its end state instead of
// tweening, which keeps every close deterministic (and is a real user config).
// `narrow` is the <=640px / fullscreen switch, flipped by the mobile test below.
let narrow = false;
(dom.window as unknown as { matchMedia: (q: string) => unknown }).matchMedia = (q: string) => ({
  matches: /prefers-reduced-motion/.test(q) ? true : /max-width:\s*640px/.test(q) ? narrow : false,
  media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
});
for (const k of [
  'window', 'document', 'HTMLElement', 'HTMLCanvasElement', 'Element', 'Node', 'Event', 'CustomEvent',
  // matchMedia BOTH ways: shutter.ts asks window.matchMedia, a11y-prefs.ts the bare global.
  'MouseEvent', 'getComputedStyle', 'localStorage', 'matchMedia',
]) {
  try { (globalThis as Record<string, unknown>)[k] = (dom.window as unknown as Record<string, unknown>)[k]; } catch { /* getter-only global */ }
}
// Reduced motion means animate() never schedules a frame; the shim is only here
// so cancelAnimationFrame(0) on teardown doesn't reach an undefined global.
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 0) as unknown as number) as typeof requestAnimationFrame;
globalThis.cancelAnimationFrame = ((h: number) => clearTimeout(h as unknown as NodeJS.Timeout)) as typeof cancelAnimationFrame;
// jsdom has no WebGL: the shutter falls back to the seal plate, which is what a
// context-less phone does. Returning null is the honest answer.
(dom.window.HTMLCanvasElement.prototype as unknown as { getContext: () => null }).getContext = () => null;

const { createShutter, STATUS_DELAY, clockText } = await import('./shutter.ts');

const DELAY = 5;              // pinned for the tests; the shipped gate is 600ms
STATUS_DELAY.ms = DELAY;

const tick = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms));
/** The shutter root, wherever it currently lives (the stage, or <body> at <=640px). */
const rootOf = (stage: HTMLElement): HTMLElement =>
  (stage.querySelector('.export-shutter') ?? dom.window.document.body.querySelector('.export-shutter')) as HTMLElement;
const statusOf = (stage: HTMLElement): HTMLElement | null =>
  rootOf(stage)?.querySelector('.export-shutter__status') ?? null;
const visible = (stage: HTMLElement): boolean =>
  !!statusOf(stage)?.classList.contains('is-visible');

function mount(): HTMLElement {
  const stage = dom.window.document.createElement('div');
  dom.window.document.body.appendChild(stage);
  return stage;
}

// ── 1. the delay gate - the fast path must look exactly as it did ────────────

test('a fast export never builds the status block at all', async () => {
  const stage = mount();
  const sh = createShutter(stage);
  await sh.close({ label: 'QR Code', detail: 'PNG', onHide: () => {} });
  sh.open();                                  // done well inside the gate
  await tick(DELAY * 4);
  assert.equal(statusOf(stage), null, 'a sub-second export must not flash a status block');
  sh.destroy();
});

// ── 2. a long export gets a status block ────────────────────────────────────

test('an export that outlasts the delay shows label, detail and a clock', async () => {
  const stage = mount();
  const sh = createShutter(stage);
  await sh.close({ label: 'Sequence Studio', detail: 'MP4', onHide: () => {} });
  assert.equal(visible(stage), false, 'not before the delay');
  await tick(DELAY * 3);
  const box = statusOf(stage)!;
  assert.ok(box, 'the block must exist once the export outlasts the delay');
  assert.equal(visible(stage), true);
  assert.equal(box.querySelector('.export-shutter__status-label')!.textContent, 'Sequence Studio');
  assert.match(box.querySelector('.export-shutter__status-meta')!.textContent!, /MP4.*\d:\d\d/);
  sh.destroy();
});

test('the block is above the shutter plate, and its button is not aria-hidden', async () => {
  const stage = mount();
  const sh = createShutter(stage);
  await sh.close({ label: 'Design', onHide: () => {} });
  await tick(DELAY * 3);
  const root = rootOf(stage);
  // An aria-hidden ancestor over a focusable control is a trap; the decorative
  // surfaces hide themselves instead.
  assert.equal(root.getAttribute('aria-hidden'), null);
  assert.equal(root.querySelector('.export-shutter__seal')!.getAttribute('aria-hidden'), 'true');
  assert.ok(root.querySelector('button.export-shutter__status-hide'), 'the way out must be a real button');
  sh.destroy();
});

// ── 3. progress ─────────────────────────────────────────────────────────────

test('real progress paints a percent and reveals the bar; no total keeps it hidden', async () => {
  const stage = mount();
  const sh = createShutter(stage);
  await sh.close({ label: 'Sequence Studio', detail: 'WEBM', onHide: () => {} });
  await tick(DELAY * 3);
  const box = statusOf(stage)!;
  const bar = box.querySelector<HTMLElement>('.export-shutter__status-bar')!;
  assert.equal(bar.hidden, true, 'an unknown total earns no bar');

  sh.progress(30, 120);
  assert.match(box.querySelector('.export-shutter__status-meta')!.textContent!, /25%/);
  assert.equal(bar.hidden, false);
  assert.equal(bar.querySelector<HTMLElement>('i')!.style.width, '25%');
  assert.equal(bar.getAttribute('aria-valuenow'), '25');

  sh.progress(120, 120);
  assert.equal(bar.querySelector<HTMLElement>('i')!.style.width, '100%');
  sh.destroy();
});

test('progress before the block appears is not lost', async () => {
  const stage = mount();
  const sh = createShutter(stage);
  await sh.close({ label: 'Sequence Studio', onHide: () => {} });
  sh.progress(1, 2);                          // reported while still sealed-blank
  await tick(DELAY * 3);
  assert.match(statusOf(stage)!.querySelector('.export-shutter__status-meta')!.textContent!, /50%/);
  sh.destroy();
});

// ── 4. the way out ─────────────────────────────────────────────────────────

test('the button runs onHide, and opening restores the view', async () => {
  const stage = mount();
  let hidden = 0;
  const sh = createShutter(stage);
  await sh.close({ label: 'Sequence Studio', detail: 'MP4', onHide: () => { hidden++; sh.open(); } });
  await tick(DELAY * 3);
  assert.equal(visible(stage), true);

  statusOf(stage)!.querySelector<HTMLElement>('button')!
    .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  assert.equal(hidden, 1, 'the tap must reach onHide');
  // The block belongs to a sealed screen: it goes with the opening, not 375ms later.
  assert.equal(visible(stage), false);
  // …and the export's own finally still calls open() afterwards. Idempotent.
  sh.open();
  assert.equal(visible(stage), false);
  sh.destroy();
});

test('Esc is the other way out, and dies with the shutter', async () => {
  const stage = mount();
  let hidden = 0;
  const sh = createShutter(stage);
  const esc = (): void => {
    dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  };
  await sh.close({ label: 'Sequence Studio', onHide: () => { hidden++; sh.open(); } });
  esc();
  assert.equal(hidden, 0, 'nothing to dismiss before the block is up');
  await tick(DELAY * 3);
  esc();
  assert.equal(hidden, 1);
  esc();
  assert.equal(hidden, 1, 'and not again once it is open');
  sh.destroy();
  esc();
  assert.equal(hidden, 1, 'a torn-down shutter leaves no listener behind');
});

test('a second export starts from a clean status block', async () => {
  const stage = mount();
  const sh = createShutter(stage);
  await sh.close({ label: 'One', detail: 'PDF', onHide: () => {} });
  await tick(DELAY * 3);
  sh.progress(9, 10);
  sh.open();
  await sh.close({ label: 'Two', detail: 'PNG', onHide: () => {} });
  await tick(DELAY * 3);
  const box = statusOf(stage)!;
  assert.equal(box.querySelector('.export-shutter__status-label')!.textContent, 'Two');
  assert.equal(box.querySelector<HTMLElement>('.export-shutter__status-bar')!.hidden, true,
    'the previous export\'s 90% must not carry over');
  sh.destroy();
});

test('close() without a status keeps the old sealed behaviour, however long it runs', async () => {
  const stage = mount();
  const sh = createShutter(stage);
  await sh.close();
  await tick(DELAY * 4);
  assert.equal(statusOf(stage), null, 'no status asked for, none built');
  sh.destroy();
});

// ── 5. the case the fix exists for ─────────────────────────────────────────

test('at <=640px the block rides the fullscreen shutter over on <body>', async () => {
  const stage = mount();
  const sh = createShutter(stage);
  narrow = true;
  try {
    await sh.close({ label: 'Sequence Studio', detail: 'MP4', onHide: () => {} });
    await tick(DELAY * 3);
    const root = dom.window.document.body.querySelector('.export-shutter')!;
    assert.equal(root.parentElement, dom.window.document.body, 'the phone shutter seals the whole screen');
    assert.ok(root.classList.contains('export-shutter--fullscreen'));
    assert.ok(root.querySelector('.export-shutter__status.is-visible'),
      'which is exactly where a blank sealed screen was the bug');
  } finally {
    narrow = false;
    sh.destroy();
  }
});

// ── 6. the sealed plate swallows taps (CSS contract) ────────────────────────
// The fall-through was the other half of the bug: pointer-events:none over a
// fullscreen opaque plate means tapping controls you cannot see. Source-scanned
// because no headless DOM applies the stylesheet.

test('the active shutter takes pointer events, and only the status block opts in', () => {
  const css = readFileSync(new URL('../styles/parts/tool.css', import.meta.url), 'utf8');
  const active = css.match(/\.export-shutter\.is-active\s*\{[^}]*\}/)![0];
  assert.match(active, /pointer-events:\s*auto/, 'a sealed plate must swallow taps');
  const block = css.match(/\.export-shutter__status\s*\{[^}]*\}/)![0];
  assert.match(block, /pointer-events:\s*auto/, 'its own controls must still take them');
});

// ── 7. the clock ───────────────────────────────────────────────────────────

// ── 8. Cancel - the same button, when the export can actually be stopped ────
// The block was born with Hide because no export path took an abort signal.
// ExportOpts.signal (engine 1.141) changed that, so an export that passes an
// onCancel gets a button that stops it; everything else keeps Hide.

test('an export with onCancel gets a Cancel button that runs it once', async () => {
  const stage = mount();
  let cancelled = 0, hidden = 0;
  const sh = createShutter(stage);
  await sh.close({
    label: 'Sequence Studio', detail: 'MP4',
    onHide: () => { hidden++; },
    onCancel: () => { cancelled++; },
  });
  await tick(DELAY * 3);
  const btn = statusOf(stage)!.querySelector<HTMLElement>('button')!;
  assert.equal(btn.textContent, 'Cancel', 'the label must promise what the button does');

  btn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  assert.equal(cancelled, 1);
  assert.equal(hidden, 0, 'Cancel and Hide are never both wired to the one click');
  // Cancel does NOT open the shutter: the export rejects and its own finally does,
  // so the block is still up at this point.
  assert.equal(visible(stage), true);
  sh.destroy();
});

test('Esc cancels too when a cancel is offered', async () => {
  const stage = mount();
  let cancelled = 0;
  const sh = createShutter(stage);
  await sh.close({ label: 'Sequence Studio', onHide: () => {}, onCancel: () => { cancelled++; } });
  await tick(DELAY * 3);
  dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(cancelled, 1, 'Esc mirrors the button, whichever button it is');
  sh.destroy();
});

test('without onCancel the button is still Hide, and a later export re-labels it', async () => {
  const stage = mount();
  let hidden = 0;
  const sh = createShutter(stage);
  await sh.close({ label: 'QR Code', detail: 'PDF', onHide: () => { hidden++; sh.open(); } });
  await tick(DELAY * 3);
  const btn = statusOf(stage)!.querySelector<HTMLElement>('button')!;
  assert.equal(btn.textContent, 'Hide', 'an export nothing can stop must not claim otherwise');
  btn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  assert.equal(hidden, 1);

  // The block is built once and reused, so the label belongs to the export, not the box.
  await sh.close({ label: 'Sequence Studio', detail: 'MP4', onHide: () => {}, onCancel: () => {} });
  await tick(DELAY * 3);
  assert.equal(statusOf(stage)!.querySelector<HTMLElement>('button')!.textContent, 'Cancel');
  sh.destroy();
});

test('clockText counts minutes and pads seconds', () => {
  assert.equal(clockText(0), '0:00');
  assert.equal(clockText(9_400), '0:09');
  assert.equal(clockText(83_000), '1:23');
  assert.equal(clockText(3_723_000), '62:03');
  assert.equal(clockText(-5), '0:00');
});
