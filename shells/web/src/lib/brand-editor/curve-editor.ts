// SPDX-License-Identifier: MPL-2.0
/**
 * brand editor: the tonal-curve editor and its wings.
 *
 * Every function takes the shared `bedit: BrandEditorCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `bedit.<module>.<fn>`. Extracted verbatim
 * from mountBrandEditor() by scripts/split-closure.ts.
 */
import { colorToHex, hexToOklch, parseOklch } from '@lolly/engine';
import type { Oklch } from '@lolly/engine';
import { RAMP_IDS, isRec, leafAt, overlayRampCurves, reanchorCurve, seedRampCurve, setRampCurve } from '../brand-doc.ts';
import type { RampId } from '../brand-doc.ts';
import { mountCurveEditor } from '../curve-editor.ts';
import { t, tRaw } from '../../i18n.ts';
import { announce } from '../../a11y.ts';
import { prefersReducedMotion } from '../a11y-prefs.ts';
import { RAMP_LABEL, deriveSafe } from './shared.ts';
import type { WingKey } from './shared.ts';
import { bindOp, type BrandEditorCtx } from './context.ts';

/** Open a wing and bring it into view. False when it is absent (a locked build
 *  renders no studio at all). Scrolls ONLY when the wing was closed: revealing
 *  something is worth moving the page for, re-pointing a control inside a wing
 *  that is already open is not - that scroll used to yank the viewport away
 *  from whatever the user was actually using. */
export const openWing = (bedit: BrandEditorCtx, k: WingKey): boolean => {
  const el = bedit.state.wingEl(k);
  if (!el) return false;
  const wasOpen = el.open;
  el.open = true;
  // Guarded: jsdom (the CLI shell's renderer, and the unit tests) has no
  // scrollIntoView, and this runs on the ordinary curve-glyph path. The glide
  // is JS-driven motion, so it asks the shared read (OS query OR the app pref)
  // and jumps instead when either says reduce - the wing's own CSS marker
  // rotation is already gated the same way.
  if (!wasOpen) {
    el.scrollIntoView?.({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }
  return true;
};
// The ramp picker is rendered once per wing, so both instances must agree.
export const syncRampPick = (bedit: BrandEditorCtx): void => {
  const { root } = bedit;
  root.querySelectorAll<HTMLElement>('[data-be-ramp-pick] [data-ramp]').forEach(b =>
    { b.setAttribute('aria-pressed', String(b.dataset.ramp === bedit.curveRamp)); });
};
/** Any CSS colour → OKLCH: exact for oklch()/lch() literals, else via hex. */
export const colorToOklch = (_bedit: BrandEditorCtx, s: string): Oklch | null => {
  const direct = parseOklch(s);
  if (direct) return direct;
  const hex = colorToHex(s);
  return hex ? hexToOklch(hex) : null;
};
/** Re-anchor every live curve by the primary's per-channel delta (old anchor →
 *  new primary), so a primary edit carries an edited palette with it rather
 *  than dropping it. Cumulative - the anchor tracks each step, so composed
 *  deltas sum. A no-op (bar bookkeeping) when no ramp carries a curve. */
export const reanchorCurvesTo = (bedit: BrandEditorCtx, nextPrimary: string): void => {
  const { curves } = bedit;
  if (!RAMP_IDS.some(r => curves[r])) { bedit.curveAnchorPrimary = nextPrimary; return; }
  const pOld = colorToOklch(bedit, bedit.curveAnchorPrimary);
  const pNew = colorToOklch(bedit, nextPrimary);
  if (pOld && pNew) {
    for (const r of RAMP_IDS) { const c = curves[r]; if (c) curves[r] = reanchorCurve(c, pOld, pNew); }
    syncCurveEditor(bedit);
  }
  bedit.curveAnchorPrimary = nextPrimary;
};
/** Push the current curve + step count into an open editor (Shades slider,
 *  re-anchor). No-op when nothing is open. */
export const syncCurveEditor = (bedit: BrandEditorCtx): void => {
  const { curves } = bedit;
  if (!bedit.editingCurveRamp || !bedit.curveHandle) return;
  bedit.curveHandle.render({ curve: curves[bedit.editingCurveRamp], steps: bedit.steps });
};
export const closeCurveEditor = (bedit: BrandEditorCtx, repaint = true): void => {
  const { curveEditorMount } = bedit;
  bedit.editingCurveRamp = null;
  bedit.curveHandle?.teardown(); bedit.curveHandle = null;
  if (curveEditorMount) curveEditorMount.hidden = true;
  if (repaint) bedit.state.renderPreview(); // clear the row's open state (skipped in reload)
};
/** A curve edit arrived on `doc`: repaint + install once the drag settles. */
export const queueCurveSave = (bedit: BrandEditorCtx): void => {
  const { CURVE_SETTLE_MS, root } = bedit;
  bedit.curveSaveDue = true;
  clearTimeout(bedit.curveSettleTimer);
  bedit.curveSettleTimer = setTimeout(() => {
    bedit.curveSaveDue = false;
    if (root.isConnected) bedit.ramps.repaintPalette();
    bedit.state.persist(true);
  }, CURVE_SETTLE_MS);
};
/** Drop a pending settle - for a path that has just persisted the same doc
 *  itself (the one-shot transforms), so it doesn't install twice. */
export const cancelCurveSave = (bedit: BrandEditorCtx): void => { clearTimeout(bedit.curveSettleTimer); bedit.curveSaveDue = false; };
export const openCurveEditor = (bedit: BrandEditorCtx, ramp: RampId, opts2: { toggle?: boolean; reveal?: boolean } = {}): void => {
  const { curveEditorMount, curveMountEl, curveTitleEl, curves } = bedit;
  if (opts2.toggle !== false && bedit.editingCurveRamp === ramp) { closeCurveEditor(bedit); return; }
  // The editor lives in the Curves wing now, and a curve glyph clicked on a
  // preview ramp row sits in the Generate wing - reveal its home first.
  // `reveal: false` is for a control INSIDE another wing re-pointing an editor
  // that is already open: the editor moves, the viewport does not.
  if (opts2.reveal !== false) openWing(bedit, 'curves');
  bedit.editingCurveRamp = ramp;
  bedit.curveRamp = ramp;
  syncRampPick(bedit);
  // Seed on first open from the LIVE draft derive (so it matches the visible
  // preview even after an uncommitted primary/scheme/shade change), at full
  // OKLCH precision - an untouched ramp re-bakes byte-identically until the
  // user actually drags. Falls back to the committed doc if the derive fails.
  if (!curves[ramp]) {
    const draft = deriveSafe({ primary: bedit.primary, scheme: bedit.scheme, surface: bedit.surface, contrast: bedit.contrast, steps: bedit.steps, foreground: bedit.foreground });
    curves[ramp] = seedRampCurve(draft ?? bedit.doc, ramp, bedit.steps);
  }
  bedit.curveAnchorPrimary = bedit.primary; // curves are now anchored to today's primary
  if (curveEditorMount) curveEditorMount.hidden = false;
  if (curveTitleEl) curveTitleEl.textContent = tRaw('{label} tonal curve', { label: RAMP_LABEL[ramp] });
  if (curveMountEl) {
    bedit.curveHandle?.teardown();
    bedit.curveHandle = mountCurveEditor(curveMountEl, {
      curve: curves[ramp]!, steps: bedit.steps,
      onChange: (next) => {
      const { curves } = bedit;
        // The open ramp can change under a re-anchor; always write the LIVE one.
        if (!bedit.editingCurveRamp) return;
        curves[bedit.editingCurveRamp] = next;
        // A real write: bake the steps + stamp the curve on the doc, repaint
        // the wing's preview per frame, and let the palette + install trail.
        // The bake counts the DOC's own steps, never the preview slider - 
        // see docRampSteps.
        overlayRampCurves(bedit.doc, { [bedit.editingCurveRamp]: next }, bedit.state.bakeSteps(bedit.editingCurveRamp));
        bedit.state.renderPreview();
        queueCurveSave(bedit);
      },
    });
  }
  bedit.state.renderPreview(); // reflect the open + edited state on the ramp rows
};
/** Open (never toggle) the curve editor on the wings' currently picked ramp - 
 *  what the Curves wing does on reveal and what its ramp picker does. */
export const showCurveEditor = (bedit: BrandEditorCtx, ramp: RampId): void => { openCurveEditor(bedit, ramp, { toggle: false }); };
/** "Rebuild from colour": drop this ramp's curve and re-bake ONLY its steps
 *  from the pure derive (other ramps + manual palette edits untouched). Never
 *  a silent discard - it's an explicit reset, and it arrives immediately. */
export const rebuildRampFromColour = (bedit: BrandEditorCtx): void => {
  const { curves } = bedit;
  const ramp = bedit.editingCurveRamp ?? bedit.curveRamp;
  if (!isRec(bedit.doc)) return;
  // It DELETES a hand-tuned curve and overwrites the ramp's steps, and a curve
  // cannot be retyped - so it takes a snapshot, like every other removal.
  bedit.state.pushUndo(t('Rebuild from colour')); // the button's own label - no new string
  cancelCurveSave(bedit); // this path persists itself; no stale settle behind it
  delete curves[ramp];
  setRampCurve(bedit.doc, ramp, null); // clear the stored curve on the committed doc
  // Copy this ramp's pure-derive step literals back over the doc so the palette
  // reflects the reset immediately. Derived at the DOC's shade count, not the
  // preview slider's: copyRampLiterals only overwrites the leaves the source
  // has, so a shorter derive would leave the ramp's tail on the old curve.
  const fresh = deriveSafe({ primary: bedit.primary, scheme: bedit.scheme, surface: bedit.surface, contrast: bedit.contrast, steps: bedit.state.bakeSteps(ramp), foreground: bedit.foreground });
  if (fresh) copyRampLiterals(bedit, fresh, ramp);
  closeCurveEditor(bedit); // re-renders the preview → pure derive for this ramp
  bedit.ramps.repaintPalette();
  bedit.state.persist(true);
  announce(tRaw('{label} ramp rebuilt from your colour', { label: RAMP_LABEL[ramp] }));
};
/** Copy one ramp's numeric step `$value`s from `src` into the committed `doc`. */
export const copyRampLiterals = (bedit: BrandEditorCtx, src: Record<string, unknown>, ramp: string): void => {
  if (!isRec(bedit.doc)) return;
  const sBase = (isRec(src.base) ? src.base : src) as Record<string, unknown>;
  const dBase = (isRec(bedit.doc.base) ? bedit.doc.base : bedit.doc) as Record<string, unknown>;
  const sGroup = leafAt(sBase, ['color', 'ramp', ramp]);
  const dGroup = leafAt(dBase, ['color', 'ramp', ramp]);
  if (!sGroup || !dGroup) return;
  for (const k of Object.keys(dGroup)) {
    if (!/^\d+$/.test(k)) continue;
    const sv = sGroup[k], dv = dGroup[k];
    if (isRec(sv) && isRec(dv) && typeof (sv as Record<string, unknown>).$value === 'string') {
      (dv as Record<string, unknown>).$value = (sv as Record<string, unknown>).$value;
    }
  }
};
export function curveEditorOps(bedit: BrandEditorCtx) {
  return {
    openWing: bindOp(bedit, openWing),
    syncRampPick: bindOp(bedit, syncRampPick),
    colorToOklch: bindOp(bedit, colorToOklch),
    reanchorCurvesTo: bindOp(bedit, reanchorCurvesTo),
    syncCurveEditor: bindOp(bedit, syncCurveEditor),
    closeCurveEditor: bindOp(bedit, closeCurveEditor),
    queueCurveSave: bindOp(bedit, queueCurveSave),
    cancelCurveSave: bindOp(bedit, cancelCurveSave),
    openCurveEditor: bindOp(bedit, openCurveEditor),
    showCurveEditor: bindOp(bedit, showCurveEditor),
    rebuildRampFromColour: bindOp(bedit, rebuildRampFromColour),
    copyRampLiterals: bindOp(bedit, copyRampLiterals),
  };
}
