// SPDX-License-Identifier: MPL-2.0
/**
 * The share-link meter (plan 115 P1), drawn INSIDE every Share button as a progress fill, so a
 * team can SEE how heavy a shareable link is getting at the control that shares the link. It READS
 * the P0 cost model (costUrlState), never the raw address bar.
 *
 * It used to be a free-standing draggable bar on the stage, which other tools' chrome kept
 * covering. The state now lives on the document root - `--share-link-fill` (0..1) and
 * `data-share-band` - and each button marked `[data-share-meter]` paints it through its own
 * `.share-meter` child (SHARE_METER_HTML / shareMeterNode). A button built after the last
 * edit (the export panel, a re-laid-out top bar) is therefore right the moment it exists.
 *
 * It is a CONTENT-VOLUME meter (see gaugeVisual): the fill is a LOG curve of the content
 * length so it visibly responds to every edit (a linear byte/limit fraction sat near-empty
 * for any normal amount of content and read as "no feedback"), and it reaches the end only at
 * a genuinely large amount. The COLOUR stays calm - links pack and there is always the .lolly
 * - so it goes red only when content literally can't ride in a link (a device-local image) or
 * is huge past even packing. When it fills, a reassurance toast beside the visible Share button
 * says "keep going, share the .lolly". The true copy-link size and the "shortest link" packing
 * are the Share dialog's job, not the meter's.
 *
 * Chrome-only: nothing here reaches .tool-canvas / #tool-content / the export stage.
 */
import type { UrlCostModel } from './url-budget.ts';

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
  /** e.g. (42, 'warn') => "URL budget: 42%". Localised by the caller; it becomes each Share
   *  button's accessible description, since the fill itself is decorative. */
  used: (pct: number, band: GaugeBand) => string;
  /** Reassurance shown beside the Share button the first time a link FILLS the meter - "it's
   *  okay, keep going, you can share the .lolly file". A calm nudge, never a blocking warning. */
  reassure: string;
}

/** How long the reassurance toast stays up before it fades on its own (ms). */
const TOAST_MS = 6000;

/** The meter's markup inside a Share button: decorative, painted under the label. */
export const SHARE_METER_HTML = '<span class="share-meter" aria-hidden="true"></span>';

/** The same meter as a node, for buttons built with createElement. */
export function shareMeterNode(doc: Document = document): HTMLSpanElement {
  const span = doc.createElement('span');
  span.className = 'share-meter';
  span.setAttribute('aria-hidden', 'true');
  return span;
}

/**
 * Make `button` a Share button that carries the meter: the marker, the decorative fill and,
 * when a tool has already measured its link, the description that fill stands for.
 */
export function attachShareMeter(button: HTMLElement): void {
  button.setAttribute('data-share-meter', '');
  if (!button.querySelector(':scope > .share-meter')) button.prepend(shareMeterNode(button.ownerDocument));
  const description = button.ownerDocument.documentElement.dataset.shareMeterText;
  if (description) button.setAttribute('aria-description', description);
}

export interface UrlGauge {
  /** Render a fresh cost model. `base` is accepted for the callers' symmetry; the meter
   *  measures content only (readableLen - baseLen). */
  update(model: UrlCostModel, base?: string): void;
  /** Clear the root state, cancel the toast timer and take the toast down - call on tool
   *  unmount so no Share button elsewhere keeps showing this tool's link. */
  dispose(): void;
}

/** The Share button the toast should stand beside: the first one actually on screen. */
function visibleShareButton(doc: Document): HTMLElement | null {
  for (const el of doc.querySelectorAll<HTMLElement>('[data-share-meter]')) {
    if (el.getClientRects().length && !el.closest('[hidden], [inert]')) return el;
  }
  return null;
}

/**
 * Drive the Share buttons' meter from the cost model. `toastEl` is the reassurance bubble
 * (a `role="status"` region); it is moved to <body> while shown, so it can stand beside a
 * Share button in any column, and taken down again by `dispose`.
 */
export function createShareMeter(toastEl: HTMLElement | null, labels: GaugeLabels): UrlGauge {
  const doc = toastEl?.ownerDocument ?? document;
  const root = doc.documentElement;
  let toastTimer: ReturnType<typeof setTimeout> | null = null;
  let wasFull = false; // last-seen "meter is full" state, so the toast only fires on entry
  let primed = false;  // the first paint (mount / a loaded link) records state WITHOUT toasting -
                       // reassurance is for when the user's own editing fills it, not on load
  const hideToast = (): void => {
    if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
    if (toastEl) toastEl.hidden = true;
  };
  const showToast = (): void => {
    if (!toastEl) return;
    if (toastEl.parentElement !== doc.body) doc.body.append(toastEl);
    toastEl.textContent = labels.reassure;
    toastEl.hidden = false; // unhide first so its size is real for the placement below
    const view = doc.defaultView;
    const vw = view?.innerWidth ?? 0, vh = view?.innerHeight ?? 0;
    const w = toastEl.offsetWidth, h = toastEl.offsetHeight;
    const at = visibleShareButton(doc)?.getBoundingClientRect();
    // Under the button, its right edges aligned; above it when there is no room below.
    // With no Share button on screen (a narrow top bar, a closed export panel) it takes
    // the top-left corner the old free-standing meter lived in.
    let left = at ? at.right - w : 12;
    let top = at ? at.bottom + 8 : 12;
    if (at && top + h > vh - 8) top = at.top - 8 - h;
    left = Math.max(8, Math.min(left, vw - w - 8));
    top = Math.max(8, top);
    toastEl.style.left = `${Math.round(left)}px`;
    toastEl.style.top = `${Math.round(top)}px`;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, TOAST_MS);
  };

  const paint = (visual: { fillFraction: number; band: GaugeBand; full: boolean }): void => {
    root.dataset.shareBand = visual.band;
    root.style.setProperty('--share-link-fill', String(visual.fillFraction));
    const description = labels.used(Math.round(visual.fillFraction * 100), visual.band);
    root.dataset.shareMeterText = description;
    for (const button of doc.querySelectorAll<HTMLElement>('[data-share-meter]')) button.setAttribute('aria-description', description);
    // Pop the calm "keep going, there's always the .lolly" reassurance ONCE each time the meter
    // FIRST fills. Re-arms only after it drops back below full, so a settled edit session isn't
    // nagged every keystroke; skipped on the first paint so opening an already-big shared link
    // doesn't toast unprompted.
    if (primed) {
      if (visual.full && !wasFull) showToast();
      else if (!visual.full) hideToast();
    }
    wasFull = visual.full;
    primed = true;
  };

  const update = (model: UrlCostModel): void => {
    // Content-only length: drop the fixed origin+/t/id? base so the meter reads 0 for a blank
    // tool and doesn't drift with the domain. The visual is a PURE, SYNC function of that length.
    const queryLen = Math.max(0, model.readableLen - model.baseLen);
    paint(gaugeVisual(queryLen, model.fidelity.faithful, model.target));
  };

  const dispose = (): void => {
    hideToast();
    toastEl?.remove();
    delete root.dataset.shareBand;
    delete root.dataset.shareMeterText;
    root.style.removeProperty('--share-link-fill');
    for (const button of doc.querySelectorAll<HTMLElement>('[data-share-meter]')) button.removeAttribute('aria-description');
  };

  return { update, dispose };
}
