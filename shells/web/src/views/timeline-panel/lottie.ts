// SPDX-License-Identifier: MPL-2.0
/** Disclosure, source loading and document writes for nested animation layers. */
import { t } from '../../i18n.ts';
import { announce } from '../../a11y.ts';
import { mountLottieLayerEditor, type LottieLayerEditorHandle } from '../../components/lottie-layer-editor.ts';
import { appendLottieEdit, applyLottieEdits, type LottieEdit } from '../../../../../engine/src/lottie-edit.ts';
import type { LottieAnimation } from '../../../../../engine/src/lottie-model.ts';
import { fetchLottieJson } from '../lottie-mount.ts';
import { boxTiming, indexOfId, type Box } from '../timeline-math.ts';
import { bindOp, type TpCtx } from './context.ts';
import { RESERVE_PAD } from '../timeline-config.ts';

export interface TimelineLottieState {
  id: string; signature: string; request: number; originalHeight: number;
  root: HTMLElement; status: HTMLElement; body: HTMLElement;
  source?: LottieAnimation; editor?: LottieLayerEditorHandle;
  /** Edits run one at a time, in the order they were made (see `edit`). */
  queue: Promise<void>; queued: number;
}
function box(tp: TpCtx): Box | undefined { return tp.getBoxes()[indexOfId(tp.getBoxes(), tp.cfg, tp.lottieState?.id ?? '')]; }
function showError(tp: TpCtx, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  if (tp.lottieState) tp.lottieState.status.textContent = message;
  announce(message);
}
function sourceFrame(tp: TpCtx): number {
  const source = tp.lottieState?.source, row = box(tp);
  if (!source || !row) return 0;
  const timing = boxTiming(row, tp.cfg);
  return source.ip + (timing.clipIn + (tp.rows.toAuthoredMs(tp.clock.t()) / 1000 - (timing.start ?? 0)) * timing.speed) * source.fr;
}
function seek(tp: TpCtx, frame: number): void {
  const source = tp.lottieState?.source, row = box(tp);
  if (!source || !row) return;
  const timing = boxTiming(row, tp.cfg), start = timing.start ?? 0;
  const at = start + ((frame - source.ip) / source.fr - timing.clipIn) / timing.speed;
  if (at < start || at >= start + (timing.dur ?? tp.rows.durationSec())) return;
  tp.clock.pause(); tp.clock.seek(tp.rows.toClockMs(at * 1000));
}
/**
 * Queue one edit. Writing an edit is asynchronous, and a person can tab to the next
 * field and change it before the last write finishes. An edit made then used to be dropped
 * (and the panel went inert, so the keys typed meanwhile went nowhere). Now each edit
 * waits for the one before it and appends to the edits that one wrote.
 */
function edit(tp: TpCtx, change: LottieEdit): void {
  const state = tp.lottieState;
  if (!state?.source) return;
  state.queued++;
  state.queue = state.queue.then(() => writeEdit(tp, state, change)).then(() => {
    // The last one written: redraw from the document as it now stands (see `sync`).
    if (--state.queued || tp.disposed || tp.lottieState !== state) return;
    state.signature = '';
    sync(tp);
  });
}
async function writeEdit(tp: TpCtx, state: TimelineLottieState, change: LottieEdit): Promise<void> {
  const row = box(tp), source = state.source;
  if (tp.disposed || tp.lottieState !== state || !source || !row) return;
  try {
    const before = String(row.animationEdits ?? ''), id = state.id;
    const assetField = tp.recording.assetFieldName(), identity = JSON.stringify([row[assetField], row.animationId]);
    const next = await appendLottieEdit(source, before, change);
    const current = box(tp);
    // Another write (an undo, another panel) or another clip since this edit began: it no longer applies.
    if (tp.disposed || tp.lottieState !== state || String(current?.animationEdits ?? '') !== before || JSON.stringify([current?.[assetField], current?.animationId]) !== identity) return;
    tp.helpers.write(tp.helpers.patchBox(tp.getBoxes(), id, { animationEdits: next }));
    state.status.textContent = '';
  } catch (error) { if (tp.lottieState === state) showError(tp, error); }
}
export function close(tp: TpCtx): void {
  const state = tp.lottieState;
  if (!state) return;
  state.request++; state.editor?.destroy(); state.root.remove(); tp.lottieState = undefined;
  tp.panelH = state.originalHeight; tp.root.style.height = `${tp.panelH}px`;
  if (tp.open) tp.reserve(tp.panelH + RESERVE_PAD);
  tp.inspector.querySelector('.tl-animation-open')?.setAttribute('aria-expanded', 'false');
  tp.rows.restyle(tp.getBoxes());
}
export function open(tp: TpCtx, id: string): void {
  if (!tp.opts.internalAnimationEdits) return;
  if (tp.lottieState?.id === id) { close(tp); return; }
  close(tp);
  const root = document.createElement('section'); root.className = 'tl-animation-editor'; root.setAttribute('aria-label', t('Animation layers'));
  const status = document.createElement('div'); status.className = 'tl-animation-status'; status.setAttribute('role', 'status');
  const body = document.createElement('div'); root.append(status, body);
  root.addEventListener('pointerdown', event => event.stopPropagation());
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.stopPropagation(); close(tp); tp.inspector.querySelector<HTMLElement>('.tl-animation-open')?.focus(); }
    else if (!(event.metaKey || event.ctrlKey)) event.stopPropagation();
  });
  tp.root.insertBefore(root, tp.ruler);
  tp.lottieState = { id, root, status, body, signature: '', request: 0, originalHeight: tp.panelH, queue: Promise.resolve(), queued: 0 };
  tp.panelH = Math.min(Math.max(tp.panelH, 440), Math.max(240, tp.stageEl.clientHeight * 0.7));
  tp.root.style.height = `${tp.panelH}px`; tp.reserve(tp.panelH + RESERVE_PAD);
  tp.inspector.querySelector('.tl-animation-open')?.setAttribute('aria-expanded', 'true');
  tp.clock.pause(); sync(tp);
}
export function appendButton(tp: TpCtx, id: string): void {
  if (!tp.opts.internalAnimationEdits || tp.helpers.mediaOf(id).kind !== 'lottie') return;
  const button = tp.helpers.actionBtn('tl-animation-open', t('Animation layers'), 'layers');
  button.setAttribute('aria-expanded', tp.lottieState?.id === id ? 'true' : 'false');
  button.addEventListener('click', () => open(tp, id)); tp.inspector.append(button);
}
export function rowButton(tp: TpCtx, id: string, row: HTMLElement, kind: string): void {
  let button = row.querySelector<HTMLButtonElement>('.tl-animation-expand');
  if (!tp.opts.internalAnimationEdits || kind !== 'lottie') { button?.remove(); return; }
  if (!button) {
    button = tp.helpers.btn('tl-animation-expand', t('Animation layers'), '+');
    button.tabIndex = -1; button.setAttribute('aria-hidden', 'true');
    button.addEventListener('pointerdown', event => event.stopPropagation());
    button.addEventListener('click', event => { event.stopPropagation(); tp.rows.selectAndReveal([id]); open(tp, id); });
    row.append(button);
  }
  button.textContent = tp.lottieState?.id === id ? '−' : '+';
}
export function sync(tp: TpCtx): void {
  const state = tp.lottieState;
  if (!state || !tp.open || tp.disposed) return;
  if (!tp.selection.get().includes(state.id) || !box(tp)) { close(tp); return; }
  const row = box(tp)!, media = tp.helpers.mediaOf(state.id);
  if (media.kind !== 'lottie') { close(tp); return; }
  const marker = tp.helpers.boxEl(state.id)?.querySelector('[data-lottie-src]');
  const animationId = String(row.animationId || marker?.getAttribute('data-lottie-animation') || '');
  const encoded = String(row.animationEdits ?? ''), signature = `${media.url}\n${animationId}\n${encoded}`;
  if (signature === state.signature) return;
  // Queued edits read the fields as they stand, so the panel is not redrawn under them.
  // The last one to be written asks again (see `edit`).
  if (state.queued) return;
  state.signature = signature; const request = ++state.request;
  state.status.textContent = t('Loading animation layers…');
  // Only the first load waits behind an inert panel. A reload after an edit leaves the
  // fields live, so focus and typing carry on while it runs.
  if (!state.editor) state.body.inert = true;
  void fetchLottieJson(media.url, animationId || undefined).then(async source => {
    const animation = await applyLottieEdits(source, encoded);
    // An edit queued while this loaded: the drain loads again (see `edit`).
    if (tp.disposed || tp.lottieState !== state || request !== state.request || state.queued) return;
    state.source = source;
    state.editor ??= mountLottieLayerEditor(state.body, {
      frame: () => sourceFrame(tp), seek: frame => seek(tp, frame), edit: change => { edit(tp, change); },
      reset: () => tp.helpers.write(tp.helpers.patchBox(tp.getBoxes(), state.id, { animationEdits: '' })), close: () => close(tp),
    });
    state.editor.update(animation, !!encoded); state.status.textContent = ''; state.body.inert = false;
  }).catch(error => { if (tp.lottieState === state && request === state.request) { state.body.inert = false; showError(tp, error); } });
}
export function tick(tp: TpCtx): void { tp.lottieState?.editor?.tick(); }
export function destroy(tp: TpCtx): void { const state = tp.lottieState; if (state) { state.request++; state.editor?.destroy(); state.root.remove(); tp.lottieState = undefined; } }
export function lottieOps(tp: TpCtx) {
  return { open: bindOp(tp, open), close: bindOp(tp, close), appendButton: bindOp(tp, appendButton), rowButton: bindOp(tp, rowButton), sync: bindOp(tp, sync), tick: bindOp(tp, tick), destroy: bindOp(tp, destroy) };
}
