// SPDX-License-Identifier: MPL-2.0
/**
 * free-canvas: level of detail at far zoom (canvas performance review B1, with the media
 * gate of B2).
 *
 * One controller listens to the stage view (`lolly:stage-view`, whose detail carries the
 * absolute zoom) and writes ONE attribute on `#tool-stage`, only when the bucket changes:
 *
 *   near      0.5 and above   no attribute: the canvas is exactly what it always was
 *   mid       0.2 to 0.5      `data-fc-lod="mid"`
 *   far       0.07 to 0.2     artboard shadows go to the ring; media is paused (CSS + gate)
 *   overview  below 0.07      also no box-shadow, filter or backdrop-filter inside the
 *                             canvas, and text under about 4 screen px is hidden
 *
 * The edges have a hysteresis band so a zoom hovering on a threshold does not flicker.
 * The attribute lives on the stage, never on `#tool-canvas`, and is written through
 * lib/stage-lod.ts, which strips it for the length of any render (export, the SVG walker,
 * a "Record live" take) and never writes it in a pinned documentation capture. In the
 * overview editor.css hides every text box with one rule and this module lists the few
 * boxes whose text is still at least 4 screen px as exceptions (a rule per hidden box made
 * style matching stall the first frame after a zoom). Hidden text
 * uses `visibility`, never `display:none` or `content-visibility`, because the fit-text
 * pass measures layout.
 */
import type { FcCtx } from './context.ts';
import { bindOp } from './context.ts';
import { STAGE_LOD_ATTR, onStageViewHold, setStageView } from '../../lib/stage-lod.ts';
import { createMediaGate, type MediaGate } from '../canvas-media-gate.ts';
import { lottiePlayerFor } from '../lottie-mount.ts';

export type LodBucket = 'near' | 'mid' | 'far' | 'overview';
const ORDER: readonly LodBucket[] = ['overview', 'far', 'mid', 'near'];
/** Lower bound of each bucket, in absolute zoom. */
const FLOOR: Record<LodBucket, number> = { overview: 0, far: 0.07, mid: 0.2, near: 0.5 };
/** The zoom is allowed this far past an edge before the bucket changes. */
const HYSTERESIS = 0.08;
/** Text smaller than this on screen is hidden in the overview. */
export const GREEK_PX = 4;
/** The most text boxes the overview sheet shows again. */
const MAX_SHOWN = 48;

function bucketOf(abs: number): LodBucket {
  for (let i = ORDER.length - 1; i >= 0; i--) if (abs >= FLOOR[ORDER[i]!]) return ORDER[i]!;
  return 'overview';
}

/** The bucket for a zoom given the previous bucket. Pure: the tests call it directly. */
export function nextLodBucket(prev: LodBucket, abs: number): LodBucket {
  if (!Number.isFinite(abs) || abs <= 0) return prev;
  const i = ORDER.indexOf(prev);
  const lo = FLOOR[prev] * (1 - HYSTERESIS);
  const hi = i < ORDER.length - 1 ? FLOOR[ORDER[i + 1]!] * (1 + HYSTERESIS) : Infinity;
  if (abs >= lo && abs < hi) return prev;
  return bucketOf(abs);
}

interface LodState {
  bucket: LodBucket;
  abs: number;
  gate: MediaGate;
  fontPx: Map<string, number> | null;
  hiddenKey: string;
  sheet: HTMLStyleElement | null;
  teardown: (() => void) | null;
}
const states = new WeakMap<FcCtx, LodState>();

function writeGreek(fc: FcCtx, st: LodState): void {
  const { canvasEl } = fc;
  if (st.bucket !== 'overview') {
    st.fontPx = null;
    if (st.sheet) { st.sheet.textContent = ''; st.hiddenKey = ''; }
    return;
  }
  if (!st.fontPx) {
    // Read once per entry or repaint, from the inline style the renderer wrote
    // (`calc(24px * var(--fit, 1))`): getComputedStyle would force a style pass over the
    // whole canvas at the moment the zoom is changing. Fit only shrinks text, so the
    // authored size is an upper bound and the greeking errs towards leaving text visible.
    st.fontPx = new Map();
    for (const text of canvasEl.querySelectorAll<HTMLElement>('.lolly-box-text')) {
      const id = text.closest<HTMLElement>('[data-box-id]')?.dataset.boxId;
      const px = parseFloat(/(\d+(?:\.\d+)?)px/.exec(text.style.fontSize)?.[1] ?? '');
      if (id && Number.isFinite(px)) st.fontPx.set(id, px);
    }
  }
  // Only the largest readable boxes (titles) are listed: hundreds of attribute rules
  // cost more to match than the hidden text saves.
  const ids = [...st.fontPx]
    .filter(([, px]) => px * st.abs >= GREEK_PX)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_SHOWN)
    .map(([id]) => id)
    .sort();
  const key = ids.join('\n');
  if (key === st.hiddenKey) return;
  st.hiddenKey = key;
  if (!st.sheet) {
    st.sheet = canvasEl.ownerDocument.createElement('style');
    st.sheet.setAttribute('data-fc-lod-sheet', '');
    canvasEl.ownerDocument.head.appendChild(st.sheet);
  }
  st.sheet.textContent = ids
    .map((id) => `.tool-stage[${STAGE_LOD_ATTR}="overview"] .lolly-box[data-box-id="${fc.keys.cssEscape(id)}"] .lolly-box-text{visibility:visible}`)
    .join('\n');
}

function apply(fc: FcCtx, st: LodState, abs: number): void {
  if (!(abs > 0)) return;
  st.abs = abs;
  const next = nextLodBucket(st.bucket, abs);
  if (next !== st.bucket) {
    st.bucket = next;
    setStageView(fc.stageEl, STAGE_LOD_ATTR, next === 'near' ? null : next);
    st.gate.setFrozen(next === 'far' || next === 'overview');
    st.fontPx = null;
    writeGreek(fc, st);
  } else if (next === 'overview') {
    writeGreek(fc, st);
  }
}

/** Start the controller. Idempotent; `destroyLod` (or the returned teardown) undoes the mount. */
export function mountLod(fc: FcCtx): () => void {
  const prior = states.get(fc);
  if (prior?.teardown) return prior.teardown;
  const { stageEl, canvasEl } = fc;
  const gate = createMediaGate({
    root: stageEl,
    canvas: canvasEl,
    // With a timeline mounted the sequence clock already owns every clip's play state.
    skip: () => !!fc.timelinePanel,
    lottiePlayer: lottiePlayerFor,
  });
  const st: LodState = { bucket: 'near', abs: 1, gate, fontPx: null, hiddenKey: '', sheet: null, teardown: null };
  states.set(fc, st);

  const onView = (e: Event) => apply(fc, st, ((e as CustomEvent).detail as { abs?: number } | null)?.abs ?? NaN);
  stageEl.addEventListener('lolly:stage-view', onView);
  const offHold = onStageViewHold(stageEl, (held) => gate.setHeld(held));

  // New media arrives with every paint; look again once the paint burst is over.
  const win = canvasEl.ownerDocument.defaultView;
  let raf = 0, late: ReturnType<typeof setTimeout> | null = null;
  const rescan = () => {
    raf = 0;
    gate.scan();
    st.fontPx = null;
    if (st.bucket === 'overview') writeGreek(fc, st);
  };
  const MO = win?.MutationObserver;
  const mo = MO ? new MO(() => {
    if (!raf && win) raf = win.requestAnimationFrame(rescan);
    // A Lottie player mounts a moment after its marker is painted.
    if (late !== null) clearTimeout(late);
    late = setTimeout(() => { late = null; gate.scan(); }, 500);
  }) : null;
  mo?.observe(canvasEl, { childList: true, subtree: true });

  try { apply(fc, st, fc.stage.metrics().scale); } catch { /* not laid out yet: the first stage-view will say */ }
  gate.scan();

  st.teardown = () => {
    stageEl.removeEventListener('lolly:stage-view', onView);
    offHold();
    mo?.disconnect();
    if (raf && win) win.cancelAnimationFrame(raf);
    if (late !== null) clearTimeout(late);
    setStageView(stageEl, STAGE_LOD_ATTR, null);
    st.sheet?.remove();
    gate.destroy();
    states.delete(fc);
  };
  return st.teardown;
}

export function destroyLod(fc: FcCtx): void { states.get(fc)?.teardown?.(); }

/** The current bucket (tests, diagnostics). */
export function lodBucket(fc: FcCtx): LodBucket { return states.get(fc)?.bucket ?? 'near'; }

export function lodOps(fc: FcCtx) {
  return {
    mount: bindOp(fc, mountLod),
    destroy: bindOp(fc, destroyLod),
    bucket: bindOp(fc, lodBucket),
  };
}
