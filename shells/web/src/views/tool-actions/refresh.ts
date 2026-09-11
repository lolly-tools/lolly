// SPDX-License-Identifier: MPL-2.0
/**
 * actions bar: the refresh passes for print, notes, lock tier and C2PA.
 *
 * Every function takes the shared `ta: ActionsCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `ta.<module>.<fn>`. Extracted verbatim
 * from renderActions() by scripts/split-closure.ts.
 */
import { applyDepthFact, depthFact } from '../export-depth.ts';
import { isDurableFmt } from '../export-durable-card.ts';
import { isC2paFmt, isHdrFmt, isImprintFmt } from './shared.ts';
import { bindOp, type ActionsCtx } from './context.ts';

// The depth fact - what the chosen format WILL carry beyond an ordinary 8-bit
// image, stated and not offered (plans/61-deeprichpixels.md section 10 item 3). Nothing is
// rendered unless there is something true to say, so this runs wherever either
// input to that truth changes: the format, and the HDR toggle. `?depth=` has no
// panel control by design - it rides the link, so exportDefaults is its only
// source. See views/export-depth.ts for the derivation.
export function refreshDepthFact(ta: ActionsCtx): void {
  const { el, exportDefaults, formatEl, initialFmt } = ta;
  const fmt = formatEl?.value ?? initialFmt;
  const hdr =
    el!.querySelector<HTMLInputElement>('[data-action="hdr"]')?.checked ?? exportDefaults.hdr;
  applyDepthFact(el, depthFact(fmt, { hdr: !!hdr, depth: exportDefaults.depth }));
}
// Print marks card: reveal its body when enabled, and hide the open-password
// card while it's on (marks/bleed route through pdf-lib, which can't encrypt).
export function refreshPrintUi(ta: ActionsCtx): void {
  const { el, formatEl, initialFmt } = ta;
  const on = el!.querySelector<HTMLInputElement>('[data-action="print-enable"]')?.checked;
  const fmt = formatEl?.value ?? initialFmt;
  const body = el!.querySelector<HTMLElement>('[data-print-body]');
  if (body) body.style.display = on ? 'flex' : 'none';
  // The lock card serves the RGB `pdf` AND the print `pdf-cmyk` (the strong AES tier
  // composes with CMYK/marks) AND the `zip` bundle (whole-zip encryption);
  // refreshLockTier() constrains/rewords which tiers apply in the current context.
  el!.querySelectorAll<HTMLElement>('[data-pdf-only]').forEach((c) => {
    c.style.display = fmt === 'pdf' || fmt === 'pdf-cmyk' || fmt === 'zip' ? 'flex' : 'none';
  });
  refreshLockTier(ta);
  // Content Credentials follow the stampable-container set, independent of
  // the print card (marks + credential compose fine - the stamp runs last).
  // Shown for zip too: bundled members are stamped individually. The webm
  // caveat sentence only shows for webm (no external viewer reads it there).
  el!.querySelectorAll<HTMLElement>('[data-c2pa-only]').forEach((c) => {
    c.style.display = isC2paFmt(fmt) || fmt === 'zip' ? 'flex' : 'none';
  });
  el!.querySelectorAll<HTMLElement>('[data-imprint-only]').forEach((c) => {
    c.style.display = isImprintFmt(fmt) || fmt === 'zip' ? 'flex' : 'none';
  });
  el!.querySelectorAll<HTMLElement>('[data-durable-only]').forEach((c) => {
    // durableRouteOk is the probe's answer (see the card above): a shell with no
    // route to the encoder keeps the card hidden whatever the format is.
    c.style.display = ta.durableRouteOk && isDurableFmt(fmt) ? 'flex' : 'none';
  });
  el!.querySelectorAll<HTMLElement>('[data-hdr-only]').forEach((c) => {
    c.style.display = isHdrFmt(fmt) ? 'flex' : 'none';
  });
  el!.querySelectorAll<HTMLElement>('[data-c2pa-webm]').forEach((c) => {
    c.style.display = fmt === 'webm' ? 'block' : 'none';
  });
  // The "Content protection" wrapper itself: hidden when none of its four inner
  // cards apply to the selected format (e.g. a text/data format like csv/json/ics),
  // so an always-collapsed, permanently-empty header never shows. Each inner card
  // keeps its own [data-*-only] gate above - this is one more OUTER layer only, it
  // never loosens them. Mirrors the exact per-card predicates this function already
  // applies (password: pdf/pdf-cmyk/zip; C2PA/imprint: their own fmt set; print: isPrintFmt).
  const protectionEl = el!.querySelector<HTMLElement>('[data-protection-section]');
  if (protectionEl) {
    // Print marks live in their own section now (data-printmarks-only), so the
    // protection wrapper's visibility does NOT include isPrintFmt.
    const anyValid =
      fmt === 'pdf' || fmt === 'pdf-cmyk' || fmt === 'zip' || isC2paFmt(fmt) || isImprintFmt(fmt);
    protectionEl.style.display = anyValid ? 'flex' : 'none';
  }
  refreshNotesHandoutUi(ta);
}
/** Design-only layout switch: a handout needs artboards and the multi-page RGB PDF path. */
export function refreshNotesHandoutUi(ta: ActionsCtx): void {
  const { canvasEl, el, formatEl, initialFmt } = ta;
  const row = el!.querySelector<HTMLElement>('[data-notes-handout-only]');
  if (!row) return;
  const fmt = formatEl?.value ?? initialFmt;
  const hasPages = !!canvasEl?.querySelector('[data-pdf-page]');
  row.style.display = fmt === 'pdf' && hasPages ? 'flex' : 'none';
  const input = row.querySelector<HTMLInputElement>('[data-action="pdf-notes-handout"]');
  if (input) {
    input.disabled = !hasPages;
    if (!hasPages) input.checked = false;
  }
}
export function refreshLockTier(ta: ActionsCtx): void {
  const { STD_LOCK_HINT, STD_ZIP_HINT, STRONG_LOCK_HINT, STRONG_ZIP_HINT, el, formatEl, initialFmt, onUrlSync } = ta;
  const tierEl = el!.querySelector<HTMLSelectElement>('[data-action="pdf-lock-tier"]');
  if (!tierEl) return;
  const fmt = formatEl?.value ?? initialFmt;
  const isZip = fmt === 'zip';
  const marksOn =
    el!.querySelector<HTMLInputElement>('[data-action="print-enable"]')?.checked ?? false;
  // ZIP: both tiers always apply. PDF: RC4 "standard" needs a plain RGB pdf with no
  // finishing pass; print / CMYK / crop-marks force the strong (encrypt-last) tier.
  const standardOk = isZip || (fmt === 'pdf' && !marksOn);
  const stdOpt = tierEl.querySelector<HTMLOptionElement>('option[value="standard"]');
  const strongOpt = tierEl.querySelector<HTMLOptionElement>('option[value="strong"]');
  if (stdOpt) {
    stdOpt.disabled = !standardOk;
    stdOpt.textContent = isZip
      ? 'Standard lock - opens in any unzip tool'
      : 'Standard lock - opens in any PDF app';
  }
  if (strongOpt)
    strongOpt.textContent = isZip
      ? 'Strong · AES-256 - 7-Zip / Keka / macOS'
      : 'Strong · AES-256 - newer apps only ⓘ';
  if (!standardOk) tierEl.value = 'strong';
  // Never let a URL-prefilled password become a STRONG key: clear it the moment
  // the tier is strong (whether force-flipped here or picked by the user).
  if (tierEl.value === 'strong' && ta.pwFromUrl) {
    const pwEl = el!.querySelector<HTMLInputElement>('[data-action="pdf-password"]');
    if (pwEl?.value) {
      pwEl.value = '';
      onUrlSync?.('password');
    }
    ta.pwFromUrl = false;
  }
  const hintEl = el!.querySelector<HTMLElement>('[data-pdfpass-hint]');
  if (hintEl) {
    const strong = tierEl.value === 'strong';
    hintEl.textContent = isZip
      ? strong
        ? STRONG_ZIP_HINT
        : STD_ZIP_HINT
      : strong
        ? (standardOk ? '' : 'Print, CMYK and crop-marked PDFs use the strong lock. ') +
          STRONG_LOCK_HINT
        : STD_LOCK_HINT;
  }
}
export function refreshC2paUi(ta: ActionsCtx, changed?: string): void {
  const { c2paEl, formatEl, initialFmt, onUrlSync, pdfPassEl } = ta;
  if (!c2paEl) return;
  // The exclusion is a PDF-only fact (only an encrypted PDF can't take the
  // credential); on any other format a lingering password in the hidden
  // card must not disable - let alone silently uncheck - the credential.
  const fmt = formatEl?.value ?? initialFmt;
  if (!pdfPassEl || (fmt !== 'pdf' && fmt !== 'pdf-cmyk')) {
    c2paEl.disabled = false;
    if (pdfPassEl) pdfPassEl.disabled = false;
    return;
  }
  if (changed === 'c2pa' && c2paEl.checked && pdfPassEl.value) {
    pdfPassEl.value = '';
    onUrlSync?.('password');
  }
  if (pdfPassEl.value) c2paEl.checked = false;
  c2paEl.disabled = Boolean(pdfPassEl.value);
  // The exclusion is one-directional on purpose: while a password is typed the
  // C2PA box is disabled (above), but the password field itself is NEVER disabled.
  // Disabling it here deadlocked the panel - C2PA is default-ON for a normal PDF,
  // so the field mounted disabled, and the only thing that clears C2PA (typing a
  // password) could never happen in a field you can't type into. The default-on
  // credential yields to the explicit action: typing a password unchecks C2PA.
  pdfPassEl.disabled = false;
}
// A px-only tool (render.units:false) has no unit selector, so an on-screen pixel
// is an exported pixel - the token-cost readout can't drift from the real raster
// resolution the way a physical unit + DPI would. Force px explicitly, not just by
// the selector's absence, so the invariant holds regardless of DOM state.
export const dimUnit = (ta: ActionsCtx): string =>
  { const { el, manifest } = ta; return manifest.render.units === false
    ? 'px'
    : el!.querySelector<HTMLSelectElement>('[data-action="export-unit"]')?.value || 'px'; };
export function refreshOps(ta: ActionsCtx) {
  return {
    refreshDepthFact: bindOp(ta, refreshDepthFact),
    refreshPrintUi: bindOp(ta, refreshPrintUi),
    refreshNotesHandoutUi: bindOp(ta, refreshNotesHandoutUi),
    refreshLockTier: bindOp(ta, refreshLockTier),
    refreshC2paUi: bindOp(ta, refreshC2paUi),
    dimUnit: bindOp(ta, dimUnit),
  };
}
