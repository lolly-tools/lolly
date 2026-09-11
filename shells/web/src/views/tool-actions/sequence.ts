// SPDX-License-Identifier: MPL-2.0
/**
 * actions bar: frames, cuts and sequence UI.
 *
 * Every function takes the shared `ta: ActionsCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `ta.<module>.<fn>`. Extracted verbatim
 * from renderActions() by scripts/split-closure.ts.
 */
import { t } from '../../i18n.ts';
import { escape as escapeText } from '../../utils.js';
import { MAX_TIME_S } from '../timeline-math.ts';
import { c2paDefaultOn } from '../../lib/c2pa-policy.ts';
import { bindOp, type ActionsCtx } from './context.ts';
 // a contact sheet is for human review; the engine clamps too
export const isStillFmt = (_ta: ActionsCtx, f: string | undefined): boolean =>
  !!f && ['png', 'jpg', 'jpeg', 'webp', 'svg', 'pdf'].includes(f);
/** Mount/unmount the Frames row for `isSeq`, then show it for still formats only. */
export function syncFramesUi(ta: ActionsCtx, isSeq: boolean): void {
  const { actions, el, formatEl, framesRowHtml, hasStillFmt, initialFmt } = ta;
  if (!hasStillFmt || !actions.includes('download')) return;
  let row = el!.querySelector<HTMLElement>('[data-seq-still-only]');
  if (!isSeq) {
    row?.remove();
    return;
  }
  if (!row) {
    // Sits with the sizing controls: it is a "how much comes out" dial, like dims.
    const anchor =
      el!.querySelector<HTMLElement>('[data-aspect-warning]') ??
      el!.querySelector<HTMLElement>('.export-dims') ??
      el!.querySelector<HTMLElement>('.filename-extension');
    const frag = document.createElement('div');
    frag.innerHTML = framesRowHtml.trim();
    row = frag.firstElementChild as HTMLElement;
    if (anchor) anchor.after(row);
    else el!.prepend(row);
  }
  row.style.display = isStillFmt(ta, formatEl?.value ?? initialFmt) ? 'flex' : 'none';
}
/** The Frames value as an integer in [1, CUTS_MAX]; nonsense (blank, 0, NaN) → 1. */
export function cutsValue(ta: ActionsCtx): number {
  const { CUTS_MAX, el } = ta;
  const inp = el!.querySelector<HTMLInputElement>('[data-action="export-cuts"]');
  const n = Math.floor(Number(inp?.value));
  return Number.isFinite(n) && n >= 1 ? Math.min(CUTS_MAX, n) : 1;
}
// Re-seed the Duration field (and its ceiling) from the live timeline. Called at
// mount and from the MutationObserver below, i.e. every time the artboard's
// derived length changes. Adds nothing else to the panel: no control is hidden,
// disabled or re-ordered for a sequence.
export function syncSequenceUi(ta: ActionsCtx): void {
  const { durationEl, liveLabelEl } = ta;
  const isSeq = !!ta.formatRules.seqStageEl();
  const secs = ta.formatRules.seqDurationS();
  // An animated tool (window.__lollyAnim) seeds Duration from its loop when this
  // isn't a sequence; the sequence timeline wins if a tool were somehow both.
  const animSecs = isSeq ? null : ta.formatRules.animDurationS();
  // A bed's own length (data-clip-ms) seeds Duration too, but does not make the
  // tool a "timed composition": Record live stays offered, as it always was here.
  const clipSecs = isSeq || animSecs != null ? null : ta.formatRules.clipDurationS();
  const derived = secs ?? animSecs ?? clipSecs;
  const timed = isSeq || animSecs != null;
  if (durationEl) {
    // A timeline (or a long animation loop) may legitimately outrun the 60s
    // recording cap - take the 1-hour ceiling while it's timed, restore 60s if it
    // stops being one (every clip deleted, or the animation cleared).
    const max = timed || clipSecs != null ? String(MAX_TIME_S) : '60';
    if (durationEl.max !== max) durationEl.max = max;
    if (derived != null && !ta.durationUserSet) {
      const next = String(derived);
      if (durationEl.value !== next) durationEl.value = next;
    }
  }
  // "Record live" is HIDDEN for a timed composition (Andy, 2026-07-27, after
  // testing it: "live record mode doesn't play or work but this method is fast").
  // Live capture screen-records the preview in real time, which for a sequence has
  // no advantage - the compositor renders the same thing deterministically at ~30x
  // realtime - and in practice the take did not animate. Rather than ship a control
  // that is slower AND wrong, it is suppressed here; the compositor is the only
  // motion path for a sequence. Suppression is a data flag, not a style write,
  // because the format-change handler re-shows every [data-video-only] control and
  // would otherwise undo it. Un-tick on the way out so a box ticked before the tool
  // became a sequence cannot leave opts.live set on a hidden control.
  if (liveLabelEl) {
    if (isSeq) liveLabelEl.dataset.suppressed = '1';
    else delete liveLabelEl.dataset.suppressed;
    if (isSeq) {
      liveLabelEl.style.display = 'none';
      const box = liveLabelEl.querySelector<HTMLInputElement>('[data-action="video-live"]');
      if (box?.checked) box.checked = false;
    }
  }
  syncFramesUi(ta, isSeq);
}
export function readSequenceDuration(ta: ActionsCtx): void {
  const { exportDefaults, manifest, videoDefaults } = ta;
  const seqInitialDuration = ta.formatRules.seqDurationS(); ta.seqInitialDuration = seqInitialDuration;
  const animInitialDuration = seqInitialDuration != null ? null : ta.formatRules.animDurationS(); ta.animInitialDuration = animInitialDuration;
  const defaultDuration =
    exportDefaults.video?.seconds ??
    seqInitialDuration ??
    animInitialDuration ??
    videoDefaults.duration ??
    5; ta.defaultDuration = defaultDuration;
  // A sequence (or a long animation loop) can legitimately run far past the 60s the
  // recording field allows for ordinary "record the animation for a while" tools, so
  // it takes the timeline's own ceiling (1 hour). Non-timed tools keep the 60s cap.
  const durationMax = seqInitialDuration != null || animInitialDuration != null ? MAX_TIME_S : 60; ta.durationMax = durationMax;

  // Directional glyphs that live inside the dimension inputs: ↔ marks width,
  // ↕ marks height, so the two fields read as "wide × tall" without labels.
  const ICON_W = `<svg class="dim-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="7 8 3 12 7 16"/><polyline points="17 8 21 12 17 16"/><line x1="4" y1="12" x2="20" y2="12"/></svg>`; ta.ICON_W = ICON_W;
  const ICON_H = `<svg class="dim-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="8 7 12 3 16 7"/><polyline points="8 17 12 21 16 17"/><line x1="12" y1="4" x2="12" y2="20"/></svg>`; ta.ICON_H = ICON_H;

  // ?c2pa= (parsed { on, days }) beats the tool's render.c2pa default; the days
  // value pre-selects the ephemeral-lifetime picker in the protection card.
  // Hoisted above autoFilename because the name suffix reads the same defaults.
  const c2paInitOn = exportDefaults.c2pa ? exportDefaults.c2pa.on : c2paDefaultOn(manifest); ta.c2paInitOn = c2paInitOn;
  const c2paInitDays = [7, 30, 90, 365].includes(exportDefaults.c2pa?.days as number)
    ? exportDefaults.c2pa!.days
    : 30; ta.c2paInitDays = c2paInitDays;
}

export function readStillFormats(ta: ActionsCtx): void {
  const { CUTS_MAX, formats } = ta;
  const hasStillFmt = formats.some(ta.sequence.isStillFmt); ta.hasStillFmt = hasStillFmt;
  const framesRowHtml = `
      <div class="export-dims export-frames" data-seq-still-only style="display:none">
        <label class="dim-dpi" title="${escapeText(t('Evenly spaced stills across the sequence. 1 exports the current playhead frame.'))}">
          <span>${escapeText(t('Frames'))}</span>
          <input type="number" data-action="export-cuts" value="1" min="1" max="${CUTS_MAX}" step="1"
                 aria-label="${escapeText(t('Frames to export'))}">
        </label>
      </div>`; ta.framesRowHtml = framesRowHtml;
}

export function sequenceOps(ta: ActionsCtx) {
  return {
    isStillFmt: bindOp(ta, isStillFmt),
    syncFramesUi: bindOp(ta, syncFramesUi),
    cutsValue: bindOp(ta, cutsValue),
    syncSequenceUi: bindOp(ta, syncSequenceUi),
    readSequenceDuration: bindOp(ta, readSequenceDuration),
    readStillFormats: bindOp(ta, readStillFormats),
  };
}
