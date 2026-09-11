// SPDX-License-Identifier: MPL-2.0
/**
 * The ambient URL-budget gauge (plan 115 P1). A small draggable bar in the tool chrome that
 * fills as you add content, so a team can SEE how heavy a shareable link is getting. It READS
 * the P0 cost model (costUrlState), never the raw address bar.
 *
 * It is a CONTENT-VOLUME meter (see gaugeVisual): the fill HEIGHT is a LOG curve of the content
 * length so the bar visibly responds to every edit (a linear byte/limit fraction sat near-empty
 * for any normal amount of content and read as "no feedback"), and it reaches the top only at a
 * genuinely large amount. The COLOUR stays calm - links pack and there is always the .lolly - so
 * it goes red only when content literally can't ride in a link (a device-local image) or is huge
 * past even packing. When it fills, a reassurance toast says "keep going, share the .lolly". The
 * render is pure + synchronous; the true copy-link size + the "shortest link" packing are the
 * Share dialog's job, not the ambient gauge's.
 *
 * Chrome-only: the caller mounts this in tool chrome, NEVER inside .tool-canvas /
 * #tool-content / the export stage. The gauge writes nothing that reaches a render.
 */
import type { UrlCostModel } from './url-budget.ts';
import { attachWobble } from './wobble.ts';

export type GaugeBand = 'ok' | 'warn' | 'over';

/** Log-curve knee: smaller = more low-end sensitivity. Chosen so a few hundred chars of content
 *  already reads as a clear fraction (a linear byte/limit fill sat near-empty for any normal
 *  edit - which read as "no feedback"). */
const FILL_K = 300;

/**
 * The gauge is a CONTENT-VOLUME meter, not a raw byte ruler. Pure so the render and the tests
 * can't disagree.
 *  - fillFraction (the bar HEIGHT): a LOG curve of the content length, very sensitive at the low
 *    end so the bar visibly moves the moment you add a row, reaching the top only at a genuinely
 *    large amount of content (target.warn). This is what gives the "it responds as I type" feel.
 *  - band (the COLOUR): stays calm because the link packs and there is always the .lolly - it
 *    only goes red when content literally can't ride in a link (a device-local image → fidelity
 *    loss, matching "red when there's content that can't be embedded") or is huge even past
 *    packing (≥ target.hard). Amber only marks "you've reached the top", paired with the toast.
 */
export function gaugeVisual(
  queryLen: number,
  faithful: boolean,
  target: { warn: number; hard: number },
): { fillFraction: number; band: GaugeBand; full: boolean } {
  const q = Math.max(0, queryLen);
  const fillFraction = target.warn > 0
    ? Math.min(1, Math.log1p(q / FILL_K) / Math.log1p(target.warn / FILL_K))
    : 0;
  const full = q >= target.warn;
  const band: GaugeBand = (!faithful || q >= target.hard) ? 'over' : full ? 'warn' : 'ok';
  return { fillFraction, band, full };
}

/** The share query the kept rows form (emits joined by '&'). Retained as a pure helper; the
 *  Share dialog now owns the actual packed-length verdict, so the gauge no longer packs. */
export function shareQueryOf(model: UrlCostModel): string {
  return model.params
    .filter((p) => p.status === 'kept')
    .map((p) => p.emit)
    .join('&');
}

export interface GaugeLabels {
  /** e.g. (42, 'warn') => "URL budget: 42% used". Localised by the caller. */
  used: (pct: number, band: GaugeBand) => string;
  /** Reassurance shown from the meter the first time a link FILLS the bar - "it's okay,
   *  keep going, you can share the .lolly file". A calm nudge, never a blocking warning. */
  reassure: string;
}

/** How long the reassurance toast stays up before it fades on its own (ms). */
const TOAST_MS = 6000;

export interface UrlGauge {
  /** Render a fresh cost model. `base` is the full-URL base (origin + '/t/<id>?') so the
   *  packed length is measured against the same absolute ceiling as readableLen. */
  update(model: UrlCostModel, base: string): void;
  /** Cancel timers + listeners - call on tool unmount so nothing fires after teardown. */
  dispose(): void;
}

/** localStorage key for the gauge's dragged position - a chrome pref (device-local, like
 *  the theme), NOT tool state. */
const POS_KEY = 'lolly-url-gauge-pos';
/** Pointer travel (px) past which a press is a drag, not a click. */
const DRAG_THRESHOLD = 4;

/**
 * Wire a gauge to a chrome element that has `[data-gauge-fill]` (the fill) and takes
 * `--gauge-frac` (0..1) + `data-band` / `data-state`. Also makes it DRAGGABLE (the user
 * repositions it instead of it hiding - position persists across sessions) and calls
 * `onActivate` on a click that wasn't a drag (opens the Share dialog). `prefersReducedMotion`
 * is accepted for API symmetry; the CSS gates the actual transitions.
 */
export function createUrlGauge(
  el: HTMLElement,
  labels: GaugeLabels,
  _prefersReducedMotion: () => boolean,
  onActivate?: () => void,
): UrlGauge {
  const pctEl = el.querySelector<HTMLElement>('[data-gauge-pct]');

  // The reassurance toast (a sibling of the gauge in #tool-stage). Shown once each time a
  // link FIRST fills the bar, then it fades on its own - never a blocker, just "keep going".
  const toastEl = el.parentElement?.querySelector<HTMLElement>('[data-gauge-toast]') ?? null;
  let toastTimer: ReturnType<typeof setTimeout> | null = null;
  let wasFull = false; // last-seen "bar is at the top" state, so the toast only fires on entry
  let primed = false;  // the first paint (mount / a loaded link) records state WITHOUT toasting -
                       // reassurance is for when the user's own editing fills the bar, not on load
  const hideToast = (): void => {
    if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
    if (toastEl) toastEl.hidden = true;
  };
  const showToast = (): void => {
    if (!toastEl) return;
    toastEl.textContent = labels.reassure;
    // Park it beside the gauge (which the user may have dragged anywhere): to the right by
    // default, flipped left when the gauge sits in the right half of its stage. Both are
    // stage-relative, matching the gauge's own position:absolute coords.
    const p = el.offsetParent as HTMLElement | null;
    const stageW = p ? p.clientWidth : window.innerWidth;
    toastEl.hidden = false; // unhide first so offsetWidth is real for the flip decision
    const toRight = el.offsetLeft + el.offsetWidth / 2 < stageW / 2;
    toastEl.style.top = `${el.offsetTop}px`;
    if (toRight) {
      toastEl.style.left = `${el.offsetLeft + el.offsetWidth + 10}px`;
      toastEl.style.right = 'auto';
    } else {
      toastEl.style.left = 'auto';
      toastEl.style.right = `${Math.max(4, stageW - el.offsetLeft + 10)}px`;
    }
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, TOAST_MS);
  };

  // Position is stage-relative (the gauge is position:absolute inside #tool-stage), so
  // drags + persistence use offsetLeft/offsetTop and clamp to the offset parent's box.
  const bounds = (): { maxL: number; maxT: number } => {
    const p = el.offsetParent as HTMLElement | null;
    return {
      maxL: Math.max(4, (p ? p.clientWidth : window.innerWidth) - el.offsetWidth - 4),
      maxT: Math.max(4, (p ? p.clientHeight : window.innerHeight) - el.offsetHeight - 4),
    };
  };

  // ── restore the dragged position (clamped in case the stage is smaller here) ──
  try {
    const saved = JSON.parse(localStorage.getItem(POS_KEY) || 'null');
    if (saved && typeof saved.left === 'number' && typeof saved.top === 'number') {
      const { maxL, maxT } = bounds();
      el.style.left = `${Math.max(4, Math.min(saved.left, maxL))}px`;
      el.style.top = `${Math.max(4, Math.min(saved.top, maxT))}px`;
    }
  } catch { /* no/bad storage - keep the CSS default (canvas top-left) */ }

  // ── drag to move / click to share ──
  let dragging = false;
  let moved = false;
  let startX = 0;
  let startY = 0;
  let baseLeft = 0;
  let baseTop = 0;
  let prevX = 0;
  let prevY = 0;
  const wobble = attachWobble(el);

  const onMove = (e: PointerEvent): void => {
    if (!dragging) return;
    wobble.drag(e.clientX - prevX, e.clientY - prevY);
    prevX = e.clientX;
    prevY = e.clientY;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (!moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) moved = true;
    if (!moved) return;
    const { maxL, maxT } = bounds();
    el.style.left = `${Math.min(Math.max(baseLeft + dx, 4), maxL)}px`;
    el.style.top = `${Math.min(Math.max(baseTop + dy, 4), maxT)}px`;
  };
  const onUp = (): void => {
    if (!dragging) return;
    dragging = false;
    wobble.release();
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    if (moved) {
      try { localStorage.setItem(POS_KEY, JSON.stringify({ left: el.offsetLeft, top: el.offsetTop })); } catch { /* ignore */ }
    } else {
      onActivate?.(); // a click, not a drag → open the Share dialog
    }
  };
  const onDown = (e: PointerEvent): void => {
    if (e.button !== 0) return;
    hideToast(); // a drag would leave the toast stranded where the gauge used to be
    dragging = true;
    moved = false;
    startX = e.clientX;
    startY = e.clientY;
    baseLeft = el.offsetLeft; // stage-relative, matches the position:absolute coords we set
    baseTop = el.offsetTop;
    prevX = e.clientX;
    prevY = e.clientY;
    wobble.grab(e.clientX, e.clientY);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onActivate?.(); }
  };
  el.addEventListener('pointerdown', onDown);
  el.addEventListener('keydown', onKey);

  const paint = (visual: { fillFraction: number; band: GaugeBand; full: boolean }): void => {
    el.dataset.band = visual.band;
    el.style.setProperty('--gauge-frac', String(visual.fillFraction));
    const pct = Math.round(visual.fillFraction * 100);
    if (pctEl) pctEl.textContent = `${pct}%`;
    el.setAttribute('aria-label', labels.used(pct, visual.band));
    el.title = labels.used(pct, visual.band);
    el.hidden = false;
    // Pop the calm "keep going, there's always the .lolly" reassurance ONCE each time the bar
    // FIRST fills (reaches the top). Re-arms only after it drops back below full, so a settled
    // edit session isn't nagged every keystroke; skipped on the first paint so opening an
    // already-big shared link doesn't toast unprompted.
    if (primed) {
      if (visual.full && !wasFull) showToast();
      else if (!visual.full) hideToast();
    }
    wasFull = visual.full;
    primed = true;
  };

  const update = (model: UrlCostModel, _base?: string): void => {
    // Content-only length: drop the fixed origin+/t/id? base so the bar reads 0 for a blank tool
    // and doesn't drift with the domain. The visual is a PURE, SYNC function of it - it moves on
    // every edit (the old packed-length refine sat near-empty for normal content = "no feedback").
    // Packing / the true copy-link size are the Share dialog's job now, not the ambient gauge's.
    const queryLen = Math.max(0, model.readableLen - model.baseLen);
    paint(gaugeVisual(queryLen, model.fidelity.faithful, model.target));
  };

  const dispose = (): void => {
    hideToast();
    wobble.dispose();
    el.removeEventListener('pointerdown', onDown);
    el.removeEventListener('keydown', onKey);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
  };

  return { update, dispose };
}
