// SPDX-License-Identifier: MPL-2.0
/**
 * The export actions bar (finding 1): renderActions builds the filename /
 * format / dimensions / print / password / settings tiers and the Copy · Save ·
 * Share · Download actions, wired to the runtime's export pipeline. Plus the
 * `?copy` arming, the share-dialog wrapper, the dimension scrub behaviour and
 * the session thumbnail capture. Extracted from tool.js unchanged.
 *
 * `exportUnscaled` (the strip-scale → export → reapply dance) stays with the
 * canvas-scaling state in mountTool and is injected — it is the export-snapshot
 * boundary this bar renders through.
 */
import type { Runtime, ToolManifest, InputValue, Unit } from '@lolly/engine';
import { UNITS, toCssPx, CMYK_CONDITIONS, DEFAULT_CMYK_CONDITION } from '@lolly/engine';
import { escape } from '../../utils.ts';
import { navigateTo } from '../../nav.ts';
import { announce } from '../../a11y.ts';
import { PALETTE } from '../../palette.ts';
import { showScrubReadout, hideScrubReadout } from '../../components/scrub-readout.ts';
import { openShareDialog } from '../../components/share-dialog.ts';
import { bumpMetric, recordFormat } from '../../metrics.ts';
import { runTemplateScripts } from '../../render/lifecycle.ts';
import { aspectWarning } from '../export-size.ts';
import type { WebHost } from '../../bridge/index.ts';
import type { ExportOptions, ExportFormat as WebExportFormat } from '../../bridge/export/types.ts';
import type { InputHistory } from './input-history.ts';
import type { PrintMarks } from './constants.ts';
import {
  ZIP_BUNDLE, DEFAULT_PRINT_MARKS, isCmykFmt, isPrintFmt, printEnabled, readBleed, readMarks,
  keepFormat, fmtLabel, extFor,
} from './constants.ts';
import { buildShareParams } from './url-sync.ts';

/** Export defaults restored from the URL / a saved session (see mountTool). */
export interface ExportDefaults {
  filename?: string;
  format?: string;
  width?: number;
  height?: number;
  unit?: string;
  dpi?: number;
  profile?: string;
  password?: string;
  bleed?: string;
  marks?: Partial<PrintMarks> | null;
  nostage?: boolean;
}

/** mountTool's strip-scale → export → reapply wrapper (injected). */
export type ExportUnscaled = (fn: () => Promise<Blob>, opts?: { shutter?: boolean }) => Promise<Blob>;

/** What renderActions hands back for programmatic triggering (`?copy`, Save & leave…). */
export interface ActionsApi {
  copy?: (fmtOverride?: string) => Promise<{ method: string } | void>;
  preview?: () => Promise<void>;
  save?: (btn?: HTMLElement | null) => Promise<boolean>;
  setDims?: (dims?: { width?: number; height?: number; unit?: string }) => void;
}

type ActionsHistory = Pick<InputHistory, 'set' | 'setSilent'>;

// fitCanvas and exportUnscaled are passed in so refreshCanvasPreview and the
// export actions can coordinate with the responsive-scaling logic in mountTool.
export function renderActions(
  el: HTMLElement | null,
  manifest: ToolManifest,
  runtime: Runtime,
  history: ActionsHistory,
  canvasEl: HTMLElement | null,
  host: WebHost,
  fitCanvas: () => void,
  exportUnscaled: ExportUnscaled,
  exportDefaults: ExportDefaults = {},
  onUrlSync: ((key?: string) => void) | null = null,
  playShutter: () => void = () => {},
  fileIntoFolder: string | null = null,
  returnTo = '/',
  initialSlot: string | null = null,
): ActionsApi | undefined {
  // The slot this editing session writes to. Seeded from a resumed `?slot=` session,
  // otherwise null until the first save mints one. Every subsequent save (the Save
  // button, the render-pill quick-Save, "Save & leave") reuses it so edits UPDATE the
  // same saved session in place instead of spawning a new one on each save. Without
  // this, re-saving after an edit orphaned a fresh copy in Uncategorised and left the
  // original folder card frozen at its first-save state.
  let activeSlot = initialSlot;
  // Shareable-link button (wired by wireUpCopyUrl). A link glyph + label; the
  // label is swapped to "Copied!" on click, so it's wrapped in its own span to
  // keep the icon. Lives at the foot of the actions bar — after the render
  // (Download) button, so on mobile it stacks behind it.
  const copyUrlBtn = `<button type="button" data-action="copy-url" class="copy-url-btn btn" title="Copy a shareable link" aria-label="Share"><svg class="copy-url-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 1 1 0 10h-2"/><line x1="8" x2="16" y1="12" y2="12"/></svg><span data-copy-url-label>Share</span></button>`;

  // Save glyph — a tray with a down-arrow (matches the Feather "download" mark),
  // line-art to sit consistently beside the Copy and Share icons.
  const SAVE_SVG = `<svg class="save-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`;

  // The unit select is populated from UNITS, so every live value is a Unit.
  const asUnit = (u: string): Unit => UNITS.find(x => x === u) ?? 'px';

  const inputVal = (sel: string): string | undefined =>
    el?.querySelector<HTMLInputElement | HTMLSelectElement>(sel)?.value;
  const isChecked = (sel: string): boolean | undefined =>
    el?.querySelector<HTMLInputElement>(sel)?.checked;

  // Shared, awaitable save routine — used by the Save button AND the
  // unsaved-changes dialog's "Save & leave". Returns true on success. Always
  // re-enables the button and surfaces failures: a save error used to leave the
  // button stuck on "Saving…" silently, which made "Save & leave" appear to do
  // nothing (and then click a now-disabled button — a no-op). The thumbnail is
  // best-effort (captureThumbnail swallows its own errors), so it never blocks a save.
  async function performSave(saveBtnEl?: HTMLElement | null): Promise<boolean> {
    const btn = saveBtnEl ?? el?.querySelector<HTMLButtonElement>('[data-action="save"]');
    if (!btn || btn.dataset.saving) return false;
    const label = btn.querySelector('[data-save-label]') ?? btn;
    const idle  = label.textContent;
    btn.dataset.saving = '1';
    if (btn instanceof HTMLButtonElement) btn.disabled = true;
    label.textContent = 'Saving…';
    try {
      // Reuse the session's slot after the first save (or when resuming an existing
      // session) so a re-save updates it in place; only mint a new slot the first time.
      const slot   = activeSlot || `${manifest.id}:${Date.now()}`;
      const values = Object.fromEntries(runtime.getModel().map(i => [i.id, i.value]));
      // The effective export format (user-selected, or the tool's default). Drives
      // a vector (SVG) thumbnail for vector tools — see captureThumbnail.
      const fmt    = inputVal('[data-action="format"]') ?? '';
      const thumb  = await captureThumbnail(manifest, canvasEl, runtime, exportUnscaled, fmt);
      await host.state.save(slot, {
        ...values,
        __toolId:          manifest.id,
        __toolVersion:     manifest.version,
        __export_filename: inputVal('[data-action="filename"]')?.trim() ?? '',
        __export_format:   fmt,
        __export_width:    inputVal('[data-action="export-width"]') ?? '',
        __export_height:   inputVal('[data-action="export-height"]') ?? '',
        __export_unit:     inputVal('[data-action="export-unit"]') ?? 'px',
        __export_dpi:      inputVal('[data-action="export-dpi"]') ?? '',
        __export_profile:  inputVal('[data-action="cmyk-profile"]') ?? '',
        __export_bleed:    readBleed(el),
        __export_marks:    readMarks(el),
      }, thumb);
      // Remember the slot so the next save updates THIS session rather than creating a
      // duplicate (see activeSlot above). Set before filing so a fresh first-save is
      // both filed into its folder AND pinned as the active slot for later edits.
      activeSlot = slot;
      // File a freshly-created session into the folder the Projects "+ New tool" flow
      // launched from (claimed at mount into fileIntoFolder — empty value = root/uncat
      // = null = no filing). One-shot, best-effort, never blocks the save.
      if (fileIntoFolder) {
        try {
          const { createFolderStore } = await import('../../folders.ts');
          await createFolderStore(host).moveItem(slot, fileIntoFolder, 'session');
        } catch { /* filing is best-effort */ }
        fileIntoFolder = null;
      }
      label.textContent = 'Saved';
      announce('Saved');
      return true;                              // leave the button as-is; the caller navigates away
    } catch (e) {
      console.error('Save failed:', e);
      label.textContent = idle;
      if (btn instanceof HTMLButtonElement) btn.disabled = false;
      delete btn.dataset.saving;
      announce('Save failed');
      return false;
    }
  }

  if (manifest.render.export === false) {
    if (!el) return undefined;
    const hasInputs = (manifest.inputs?.length ?? 0) > 0;
    // An explicit empty actions list opts out of the default Save+Share bar — for
    // on-device file utilities that provide their own download button and must
    // NOT persist the user's file bytes to storage (Save would write them to
    // IndexedDB, contradicting the "nothing is stored/uploaded" promise).
    const optedOut = Array.isArray(manifest.render.actions) && manifest.render.actions.length === 0;
    if (!hasInputs || optedOut) { el.innerHTML = ''; return {}; }
    el.innerHTML = `<div class="export-action-buttons"><button data-action="save" class="save-btn">${SAVE_SVG}<span data-save-label>Save</span></button>${copyUrlBtn}</div>`;
    el.querySelector<HTMLButtonElement>('[data-action="save"]')!.addEventListener('click', async function () {
      if (await performSave(this)) setTimeout(() => { navigateTo(returnTo); }, 800);
    });
    return { save: performSave };
  }

  // The actions bar element is part of the tool view's static markup, so it is
  // always present for export-enabled tools; the guard keeps the DOM reads honest.
  if (!el) return undefined;

  const actions    = manifest.render.actions ?? ['copy', 'download', 'save'];
  const exportOpts = runtime.getModel().filter(i => i.group === 'export' && i.control === 'checkbox');
  const isAnimatedFmt = (f: string | undefined): boolean => f === 'webm' || f === 'mp4' || f === 'gif';
  // Mirrors VECTOR_FORMATS in engine/src/inputs.js — formats where text→path
  // outlining (the 'Convert paths' toggle) applies. Bitmap formats don't.
  const isVectorFmt   = (f: string | undefined): boolean => f === 'svg' || f === 'pdf' || f === 'pdf-cmyk';
  // Show only the video containers this browser can record (Safari→mp4, Firefox→webm,
  // recent Chrome→both); non-video formats always pass. See keepFormat / VIDEO.
  const formats       = manifest.render.formats.filter(keepFormat);
  const hasAnimated   = formats.some(isAnimatedFmt);
  const initialFmt    = (exportDefaults.format && formats.includes(exportDefaults.format)) ? exportDefaults.format : formats[0];
  const videoDefaults = manifest.render.video ?? {};
  const defaultWait     = typeof videoDefaults.wait === 'number' ? videoDefaults.wait : 1;
  const defaultDuration = typeof videoDefaults.duration === 'number' ? videoDefaults.duration : 5;

  // Directional glyphs that live inside the dimension inputs: ↔ marks width,
  // ↕ marks height, so the two fields read as "wide × tall" without labels.
  const ICON_W = `<svg class="dim-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="7 8 3 12 7 16"/><polyline points="17 8 21 12 17 16"/><line x1="4" y1="12" x2="20" y2="12"/></svg>`;
  const ICON_H = `<svg class="dim-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="8 7 12 3 16 7"/><polyline points="8 17 12 21 16 17"/><line x1="12" y1="4" x2="12" y2="20"/></svg>`;

  // Tier 1 — filename · format. The format selector is the highest-priority
  // control; the filename rides alongside it as the natural "name.format" pair.
  const filenameRow = `
      <div class="filename-extension">
        <input type="text" class="export-filename" data-action="filename"
              value="${escape(exportDefaults.filename ?? manifest.name)}" placeholder="filename" spellcheck="false">
        ${formats.length > 1 ? `
          <select data-action="format" aria-label="Export format">
            ${formats.map(f => `<option value="${f}" ${f === initialFmt ? 'selected' : ''}>${fmtLabel(f)}</option>`).join('')}
          </select>
        ` : ''}
      </div>`;

  // Tier 2 — dimensions. The primary sizing control: full-width, prominent,
  // with the directional icon inside each field.
  const initUnit = exportDefaults.unit ?? 'px';
  const initDpi  = exportDefaults.dpi ?? 300;
  const dimsRow = manifest.render.dims !== false ? `
      <div class="export-dims">
        <div class="dim-field">
          ${ICON_W}
          <input type="number" data-action="export-width" data-scrub aria-label="Width"
                 value="${exportDefaults.width ?? manifest.render.width}" min="1" max="100000" step="any">
        </div>
        <span class="dim-x">×</span>
        <div class="dim-field">
          ${ICON_H}
          <input type="number" data-action="export-height" data-scrub aria-label="Height"
                 value="${exportDefaults.height ?? manifest.render.height}" min="1" max="100000" step="any">
        </div>
        <select class="dim-unit" data-action="export-unit" aria-label="Units"
                title="Units for width & height. Physical units (mm/cm/in/pt) export at the right size for print — PDF as a true page, raster at the chosen DPI.">
          ${UNITS.map(u => `<option value="${u}" ${u === initUnit ? 'selected' : ''}>${u}</option>`).join('')}
        </select>
        <label class="dim-dpi" data-dpi-field style="display:${initUnit === 'px' ? 'none' : 'inline-flex'}"
               title="Raster resolution for physical units (ignored for vector formats).">
          <input type="number" data-action="export-dpi" value="${initDpi}" min="36" max="1200" step="1" aria-label="DPI">
          <span>dpi</span>
        </label>
      </div>` : '';

  // Editor-only aspect-ratio guard (manifest.render.aspectWarning). A hidden alert
  // beside the dimension controls, shown when the chosen page size falls outside the
  // tool's supported orientation band — see updateAspectWarning(). Never exported.
  const ICON_WARN = `<svg class="aspect-warn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
  const aspectWarnRow = (manifest.render.aspectWarning && manifest.render.dims !== false)
    ? `<div class="export-aspect-warning" data-aspect-warning role="alert" hidden>${ICON_WARN}<span data-aspect-warning-text></span></div>`
    : '';

  // Tier 2.5 — colour profile (Print PDF only). The CMYK press condition embedded
  // in the PDF's OutputIntent. A self-contained card so this professional/print
  // setting reads as deliberate; revealed only when "Print PDF" (pdf-cmyk) is the
  // chosen format. Options come from the engine's CMYK_CONDITIONS registry.
  const ICON_DROP = `<svg class="cmyk-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2.7s6.5 7 6.5 11.8a6.5 6.5 0 0 1-13 0C5.5 9.7 12 2.7 12 2.7z"/></svg>`;
  const hasCmyk     = formats.includes('pdf-cmyk') || formats.includes('cmyk-tiff');
  const initProfile = (exportDefaults.profile && Object.keys(CMYK_CONDITIONS).includes(exportDefaults.profile))
    ? exportDefaults.profile : DEFAULT_CMYK_CONDITION;
  const cmykOptions = Object.entries(CMYK_CONDITIONS)
    .map(([key, c]) => `<option value="${escape(key)}" ${key === initProfile ? 'selected' : ''}>${escape(c.info)}</option>`)
    .join('');
  const cmykRow = hasCmyk ? `
      <div class="export-cmyk" data-cmyk-only style="display:${isCmykFmt(initialFmt) ? 'flex' : 'none'}">
        <span class="cmyk-head">${ICON_DROP}<span>Color profile</span></span>
        <select data-action="cmyk-profile" aria-label="CMYK press profile"
                title="The CMYK press condition your printer targets — embedded as the Print PDF's output intent, recorded in the Print TIFF's metadata.">
          ${cmykOptions}
        </select>
        <p class="cmyk-hint">Names the CMYK press standard your printer targets — the Print PDF embeds it as its output intent; the Print TIFF records it in metadata (the pixels stay untagged DeviceCMYK).</p>
      </div>` : '';

  // Tier 2.6 — PDF password (standard "PDF" only). A non-empty value locks the
  // exported PDF on open (jsPDF standard security handler, copy/modify restricted).
  // Revealed only when "PDF" is chosen — the print-PDF path (pdf-cmyk) re-saves
  // through pdf-lib, which can't write encrypted PDFs.
  //
  // URL-expressible by design: a `?password=` link can pre-set it for quick,
  // short-lived transactional use (event materials etc). That's clear-text in the
  // URL — an accepted trade-off for a basic lock, not for confidential material.
  // It is NOT persisted to the library at rest (see performSave); URL is the only
  // way it round-trips. The initial value below comes from the URL only.
  // Collapsed by default — a click-to-expand disclosure (mirrors the Print marks
  // card) so the field + caveat only surface when wanted, keeping the panel tight.
  // Pre-opened when a value arrives (e.g. ?password=) so it's visible. Collapse is
  // purely visual: the input remains the source of truth, so a typed value still
  // applies on export and survives collapse/expand.
  const ICON_LOCK = `<svg class="pdfpass-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
  const hasPdf = formats.includes('pdf');
  const pdfPassInitOpen = Boolean(exportDefaults.password);
  const pdfPassRow = hasPdf ? `
      <div class="export-pdfpass${pdfPassInitOpen ? ' is-open' : ''}" data-pdf-only style="display:${initialFmt === 'pdf' ? 'flex' : 'none'}">
        <button type="button" class="pdfpass-head" data-action="pdfpass-toggle" aria-expanded="${pdfPassInitOpen}">${ICON_LOCK}<span>Password protect</span></button>
        <div class="pdfpass-body" data-pdfpass-body style="display:${pdfPassInitOpen ? 'flex' : 'none'}">
          <input type="password" data-action="pdf-password" autocomplete="new-password" spellcheck="false"
                 value="${escape(exportDefaults.password ?? '')}"
                 placeholder="Leave blank for no password" aria-label="PDF open password">
          <p class="pdfpass-hint">Requires this password to open the PDF. A basic lock, not strong encryption — don't rely on it for highly confidential files.</p>
        </div>
      </div>` : '';

  // Tier 2.7 — print marks & bleed (pdf / pdf-cmyk / cmyk-tiff). An opt-in card
  // (master checkbox) so ordinary output stays trim-sized; turning it on reveals a
  // bleed field (default 3mm) + the mark toggles at print-standard defaults. Mark
  // size, gap and stroke weight are fixed in the engine (see print-marks.js).
  const ICON_CROP = `<svg class="print-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 2v16h16"/><path d="M2 6h16v16"/></svg>`;
  // Print finishing applies to a single trim-sized artwork; tools that emit
  // per-page boxes (multi-page PDF) opt out via render.printMarks:false so the
  // card isn't shown promising marks the multi-page export path doesn't apply.
  const hasPrint     = (hasPdf || hasCmyk) && manifest.render.printMarks !== false;
  const printInitOn  = Boolean(exportDefaults.bleed || exportDefaults.marks);
  const printInitMm  = exportDefaults.bleed ? (parseFloat(exportDefaults.bleed) || 3) : 3;
  // Colour bars default ON for the CMYK print formats (the press uses them as a
  // control strip), OFF for the RGB pdf. An explicit marks default (link/save) wins.
  // 'Stamp details' (provenance) is always pre-checked: the credit stamp is on by
  // default whenever the print-marks card is enabled, regardless of any remembered
  // marks state. The other marks still restore from saved/linked defaults.
  const pim          = { ...DEFAULT_PRINT_MARKS, colorBars: isCmykFmt(initialFmt), ...(exportDefaults.marks || {}), provenance: true };
  const printRow = hasPrint ? `
      <div class="export-print" data-printmarks-only style="display:${isPrintFmt(initialFmt) ? 'flex' : 'none'}">
        <label class="print-enable">
          <input type="checkbox" data-action="print-enable" ${printInitOn ? 'checked' : ''}>
          <span class="print-head">${ICON_CROP}<span>Print marks &amp; bleed</span></span>
        </label>
        <div class="print-body" data-print-body style="display:${printInitOn ? 'flex' : 'none'}">
          <label class="print-bleed">
            <span>Bleed</span>
            <input type="number" data-action="print-bleed" value="${printInitMm}" min="0" max="25" step="0.5" aria-label="Bleed in millimetres">
            <span>mm</span>
          </label>
          <div class="print-toggles">
            <label class="export-option"><input type="checkbox" data-action="mark-crop" ${pim.crop ? 'checked' : ''}> Crop</label>
            <label class="export-option"><input type="checkbox" data-action="mark-reg" ${pim.registration ? 'checked' : ''}> Registration</label>
            <label class="export-option"><input type="checkbox" data-action="mark-bleed" ${pim.bleed ? 'checked' : ''}> Bleed</label>
            <label class="export-option"><input type="checkbox" data-action="mark-bars" ${pim.colorBars ? 'checked' : ''}> Color bars</label>
            <label class="export-option"><input type="checkbox" data-action="mark-prov" ${pim.provenance ? 'checked' : ''}> Stamp details</label>
          </div>
          <p class="print-hint">Adds bleed and the chosen marks for a print shop; the artwork is scaled to fill the bleed. Registration marks print on all four plates in the Print PDF and Print TIFF. (An open-password can't be combined with marks.)</p>
        </div>
      </div>` : '';

  // Tier 3 — ancillary settings. Everything optional (transparent bg, timing,
  // dithering) lives in one wrapping chip cluster so the panel reads consistently
  // no matter which controls a given tool/format enables.
  const optionChips = exportOpts.map(i => {
    // 'Convert paths' only affects vector output, so its chip is gated to the
    // selected format (hidden for png/jpg/etc). Other export options are global.
    const vectorOnly = i.id === 'convertPaths';
    const hide = vectorOnly && !isVectorFmt(initialFmt);
    return `
        <label class="export-option"${vectorOnly ? ' data-vector-only' : ''}${hide ? ' style="display:none"' : ''}>
          <input type="checkbox" data-input-id="${escape(i.id)}" ${i.value ? 'checked' : ''}>
          ${escape(i.label ?? i.id)}
        </label>`;
  }).join('');
  const videoChip = hasAnimated ? `
        <div class="video-params" data-anim-params style="display:${isAnimatedFmt(initialFmt) ? 'flex' : 'none'}">
          <span class="vp-field"><span>Wait</span>
            <input type="number" data-action="video-wait" value="${defaultWait}" min="0" max="30" step="0.5"><span>s</span></span>
          <span class="vp-field"><span>Duration</span>
            <input type="number" data-action="video-duration" value="${defaultDuration}" min="1" max="60" step="0.5"><span>s</span></span>
          <label class="gif-dither-toggle" data-gif-only
                 style="display:${initialFmt === 'gif' ? 'flex' : 'none'}">
            <input type="checkbox" data-action="gif-dither">
            Dither
          </label>
          <label class="gif-dither-toggle" data-webm-only
                 style="display:${initialFmt === 'webm' ? 'flex' : 'none'}">
            <input type="checkbox" data-action="webm-60fps">
            60fps
          </label>
          ${runtime.hasFrameHook ? `<span class="vp-live-hint" style="flex-basis:100%;font-size:11px;opacity:.7;margin-top:2px">Records the live feed — start <strong>Go&nbsp;live</strong> on the canvas first.</span>` : ''}
        </div>` : '';
  // Full-page chip — HTML export only. Drops the fixed-size tool-canvas frame so
  // the saved page fills the whole browser window instead of a centred card.
  const hasHtml  = formats.includes('html');
  const htmlChip = hasHtml ? `
        <label class="export-option" data-html-only style="display:${initialFmt === 'html' ? 'flex' : 'none'}"
               title="Drop the fixed-size canvas frame so the saved page fills the whole window.">
          <input type="checkbox" data-action="full-page" ${exportDefaults.nostage ? 'checked' : ''}>
          Full page
        </label>` : '';
  const settingsRow = (optionChips || videoChip || htmlChip)
    ? `<div class="export-settings">${optionChips}${htmlChip}${videoChip}</div>`
    : '';

  // Tier 4 — actions. Copy · Save · Share share one equal-width row; Download is
  // the primary CTA, alone on its own full-width line at the very bottom.
  const CLIPBOARD_SVG = `<svg class="copy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>`;
  const copyBtn = actions.includes('copy')
    ? `<button data-action="copy" class="copy-btn" title="Copy to clipboard">${CLIPBOARD_SVG}<span>Copy</span></button>` : '';
  const saveBtn = actions.includes('save')
    ? `<button data-action="save" class="save-btn" title="Save to your library">${SAVE_SVG}<span data-save-label>Save</span></button>` : '';
  const downloadBtn = actions.includes('download')
    ? `<button data-action="download">Download${formats.length === 1 ? ' ' + fmtLabel(formats[0] ?? '') : ''}</button>`
    : '';
  const secondaryRow = `<div class="export-action-buttons">${copyBtn}${saveBtn}${copyUrlBtn}</div>`;
  const downloadRow = downloadBtn ? `<div class="export-action-buttons">${downloadBtn}</div>` : '';

  el.innerHTML = `
    ${actions.includes('download') ? `${filenameRow}${dimsRow}${aspectWarnRow}${cmykRow}${pdfPassRow}${printRow}${settingsRow}` : ''}
    ${secondaryRow}
    ${downloadRow}
  `;

  exportOpts.forEach(i => {
    el.querySelector(`[data-input-id="${escape(i.id)}"]`)
      ?.addEventListener('change', (e) => { const t = e.target; if (t instanceof HTMLInputElement) void history.set(i.id, t.checked); });
  });

  const animParamsEl  = el.querySelector<HTMLElement>('[data-anim-params]');
  const ditherEl      = el.querySelector<HTMLElement>('[data-gif-only]');
  const webm60El      = el.querySelector<HTMLElement>('[data-webm-only]');
  const formatEl      = el.querySelector<HTMLSelectElement>('[data-action="format"]');
  const aspectWarnEl  = el.querySelector<HTMLElement>('[data-aspect-warning]');

  // Colour bars track the format: ON for the CMYK print formats (pdf-cmyk /
  // cmyk-tiff), OFF for the RGB pdf, re-applied on every format switch — until the
  // user toggles them, or a shared link set marks explicitly, after which their
  // choice is left alone.
  let barsUserSet = Boolean(exportDefaults.marks);
  const syncBarsDefault = (fmt: string): void => {
    if (barsUserSet) return;
    const bars = el.querySelector<HTMLInputElement>('[data-action="mark-bars"]');
    if (bars) bars.checked = isCmykFmt(fmt);
  };

  // Show/hide timing params and format-specific controls when the format selector changes.
  if (formatEl) {
    formatEl.addEventListener('change', () => {
      const fmt = formatEl.value;
      if (animParamsEl) animParamsEl.style.display = isAnimatedFmt(fmt) ? 'flex' : 'none';
      if (ditherEl)     ditherEl.style.display     = fmt === 'gif'  ? 'flex' : 'none';
      if (webm60El)     webm60El.style.display      = fmt === 'webm' ? 'flex' : 'none';
      el.querySelectorAll<HTMLElement>('[data-vector-only]').forEach(c => { c.style.display = isVectorFmt(fmt) ? 'flex' : 'none'; });
      el.querySelectorAll<HTMLElement>('[data-html-only]').forEach(c => { c.style.display = fmt === 'html' ? 'flex' : 'none'; });
      el.querySelectorAll<HTMLElement>('[data-cmyk-only]').forEach(c => { c.style.display = isCmykFmt(fmt) ? 'flex' : 'none'; });
      el.querySelectorAll<HTMLElement>('[data-printmarks-only]').forEach(c => { c.style.display = isPrintFmt(fmt) ? 'flex' : 'none'; });
      syncBarsDefault(fmt);
      refreshPrintUi(); // owns [data-pdf-only] (password) visibility — see below
      onUrlSync?.('format');
      onUrlSync?.('marks');  // bars may have flipped with the format
    });
  }

  // Print marks card: reveal its body when enabled, and hide the open-password
  // card while it's on (marks/bleed route through pdf-lib, which can't encrypt).
  function refreshPrintUi(): void {
    if (!el) return;
    const on  = isChecked('[data-action="print-enable"]');
    const fmt = formatEl?.value ?? initialFmt;
    const body = el.querySelector<HTMLElement>('[data-print-body]');
    if (body) body.style.display = on ? 'flex' : 'none';
    el.querySelectorAll<HTMLElement>('[data-pdf-only]').forEach(c => { c.style.display = (fmt === 'pdf' && !on) ? 'flex' : 'none'; });
  }
  el.querySelector('[data-action="print-enable"]')?.addEventListener('change', () => {
    refreshPrintUi(); onUrlSync?.('bleed'); onUrlSync?.('marks');
  });
  el.querySelector('[data-action="print-bleed"]')?.addEventListener('input', () => onUrlSync?.('bleed'));
  ['mark-crop', 'mark-reg', 'mark-bleed', 'mark-bars', 'mark-prov'].forEach(a =>
    el.querySelector(`[data-action="${a}"]`)?.addEventListener('change', () => {
      if (a === 'mark-bars') barsUserSet = true;  // stop auto-tracking once chosen
      onUrlSync?.('marks');
    }));
  refreshPrintUi(); // initial state (e.g. card pre-opened from a shared link)

  // Colour profile (CMYK press condition) — print-PDF only; persists via URL/save.
  el.querySelector('[data-action="cmyk-profile"]')?.addEventListener('change', () => onUrlSync?.('profile'));

  el.querySelector('[data-action="filename"]')?.addEventListener('input', () => onUrlSync?.('filename'));

  // Full-page HTML export toggle ("no stage") — round-trips through the URL as ?nostage.
  el.querySelector('[data-action="full-page"]')?.addEventListener('change', () => onUrlSync?.('nostage'));

  // PDF open-password — clear-text in the URL by design (see pdfPassRow). Syncs on
  // input so a crafted/edited link round-trips; syncUrl gates it to the pdf format.
  el.querySelector('[data-action="pdf-password"]')?.addEventListener('input', () => onUrlSync?.('password'));

  // Password protect disclosure — the header toggles the body open/closed (purely
  // visual; the input value still drives export). Focus the field on expand.
  el.querySelector('[data-action="pdfpass-toggle"]')?.addEventListener('click', () => {
    const card = el.querySelector('.export-pdfpass');
    const open = card?.classList.toggle('is-open') ?? false;
    const body = el.querySelector<HTMLElement>('[data-pdfpass-body]');
    if (body) body.style.display = open ? 'flex' : 'none';
    el.querySelector('[data-action="pdfpass-toggle"]')?.setAttribute('aria-expanded', String(open));
    if (open) el.querySelector<HTMLInputElement>('[data-action="pdf-password"]')?.focus();
  });

  const dimUnit = (): string => inputVal('[data-action="export-unit"]') || 'px';
  const dimDpi  = (): number => { const n = parseInt(inputVal('[data-action="export-dpi"]') ?? '', 10); return n > 0 ? n : 300; };
  // Raw numeric values the user typed, in the active unit.
  function rawDims(): { w: number | undefined; h: number | undefined } {
    const w = parseFloat(inputVal('[data-action="export-width"]') ?? '');
    const h = parseFloat(inputVal('[data-action="export-height"]') ?? '');
    return { w: w > 0 ? w : undefined, h: h > 0 ? h : undefined };
  }

  // Export dimensions: values qualified with the active unit (+ DPI for physical
  // units) so the engine converts per format. Vector ignores DPI; raster uses it.
  function exportDims(): { width?: number | string; height?: number | string; dpi?: number } {
    if (manifest.render.dims === false) {
      return { width: manifest.render.width, height: manifest.render.height };
    }
    const { w, h } = rawDims();
    const u = dimUnit();
    const q = (v: number | undefined): number | string | undefined => (v !== undefined && v > 0 ? (u !== 'px' ? `${v}${u}` : v) : undefined);
    const out: { width?: number | string; height?: number | string; dpi?: number } = { width: q(w), height: q(h) };
    if (u !== 'px') out.dpi = dimDpi();
    return out;
  }

  // On-screen preview is CSS px: physical units shown at their 96-DPI px size.
  function previewPx(): { width: number | undefined; height: number | undefined } {
    const { w, h } = rawDims();
    const u = dimUnit();
    const toPx = (v: number | undefined): number | undefined => (v !== undefined && v > 0 ? (u === 'px' ? v : toCssPx({ value: v, unit: asUnit(u) })) : undefined);
    return { width: toPx(w), height: toPx(h) };
  }

  // Editor-only aspect-ratio guard. Evaluate the current page size (in px, so the
  // unit drops out of the ratio) against the tool's declared band and show/hide the
  // warning beside the dimension fields. Driven from refreshCanvasPreview, so it
  // tracks both typed dimensions and a size-select change. Never touches the canvas.
  function updateAspectWarning(): void {
    if (!aspectWarnEl) return;
    const { width, height } = previewPx();
    const msg = aspectWarning(manifest, width, height);
    aspectWarnEl.querySelector('[data-aspect-warning-text]')!.textContent = msg ?? '';
    aspectWarnEl.hidden = !msg;
  }

  // Print marks & bleed export opts (pdf / pdf-cmyk / cmyk-tiff). Empty when the card is off,
  // so an ordinary PDF stays trim-sized with no marks.
  function printOpts(): Partial<ExportOptions> {
    if (!printEnabled(el)) return {};
    const mm = parseFloat(inputVal('[data-action="print-bleed"]') ?? '');
    return {
      bleed: mm > 0 ? `${mm}mm` : undefined,
      cropMarks:         isChecked('[data-action="mark-crop"]') ?? false,
      registrationMarks: isChecked('[data-action="mark-reg"]') ?? false,
      bleedMarks:        isChecked('[data-action="mark-bleed"]') ?? false,
      colorBars:         isChecked('[data-action="mark-bars"]') ?? false,
      provenance:        isChecked('[data-action="mark-prov"]') ?? false,
    };
  }

  function videoParams(): { wait: number; duration: number; fps: number | undefined } {
    const wait     = parseFloat(inputVal('[data-action="video-wait"]') ?? '') ?? 1;
    const duration = parseFloat(inputVal('[data-action="video-duration"]') ?? '') ?? 5;
    const hiFps    = isChecked('[data-action="webm-60fps"]') ?? false;
    return {
      wait:     isFinite(wait)     ? Math.max(0,  wait)     : 1,
      duration: isFinite(duration) ? Math.max(0.5, duration) : 5,
      fps:      hiFps ? 60 : undefined,
    };
  }

  // Preview the export aspect ratio on the canvas, then re-fit to the stage.
  function refreshCanvasPreview(): void {
    updateAspectWarning(); // first, so it reflects current fields even when dims are incomplete
    const { width: w, height: h } = previewPx();
    if (!(w !== undefined && h !== undefined && w > 0 && h > 0) || !canvasEl) return;
    const previewScale = Math.min(1, manifest.render.width / w, manifest.render.height / h);
    canvasEl.style.width  = Math.round(w * previewScale) + 'px';
    canvasEl.style.height = Math.round(h * previewScale) + 'px';
    fitCanvas();
    // If the tool declares width/height inputs, sync dims so hooks can recompute layout.
    const model = runtime.getModel();
    const hasW = model.some(i => i.id === 'width');
    const hasH = model.some(i => i.id === 'height');
    if (hasW || hasH) {
      // Chain to avoid concurrent hook executions on the shared model. Route through
      // history.setSilent — NOT history.set — so this PROGRAMMATIC px sync, fired at
      // mount and on every unit/dimension change, never lands in the undo history or
      // wipes the redo chain. The user's own edits to a width/height field still go
      // through history.set and stay undoable.
      const setDims = (id: string, value: InputValue) => history.setSilent(id, value);
      const p = hasW ? setDims('width', w) : Promise.resolve();
      void p.then(() => { if (hasH) void setDims('height', h); });
      // subscriber fires runTemplateScripts + syncUrl after each setInput
    } else {
      runTemplateScripts(canvasEl);
      onUrlSync?.();
    }
  }
  // Deferred-preview tools (manifest.render.preview): a painted preview is only
  // valid for the geometry it was captured at, so any change to the export size,
  // unit or DPI must drop back to the placeholder + its "click to preview"
  // button — exactly as changing a sidebar input does. Re-emitting
  // rebuilds the canvas from the model through the one render path (which clears
  // the painted [data-capture] image). No-op for ordinary tools, whose live
  // canvas is the preview. Format/filename don't change captured pixels, so they
  // leave the preview intact.
  const invalidatePreview = manifest.render.preview ? () => runtime.refresh() : () => {};

  // Brief, editor-only outline pulse on the canvas while the export size is being
  // changed (scrub / scroll / type), so a resize reads as deliberate. Applied to
  // the OUTER wrapper — never the exported #tool-canvas — so it can't bleed into
  // output, and removed shortly after the last change; the CSS handles the fade.
  // Re-armed on every change, so a continuous drag holds it on, then it lapses.
  const canvasOuterEl = canvasEl?.closest('.tool-canvas-outer') ?? canvasEl?.parentElement ?? null;
  let dimPulseTimer: ReturnType<typeof setTimeout> | 0 = 0;
  function pulseCanvasResize(): void {
    if (!canvasOuterEl) return;
    canvasOuterEl.classList.add('is-resizing');
    clearTimeout(dimPulseTimer);
    dimPulseTimer = setTimeout(() => canvasOuterEl.classList.remove('is-resizing'), 450);
  }

  // Label the floating scrub readout with the value + current unit (e.g. "1024 px",
  // "210 mm") so a drag reads clearly even with the cursor/finger over the field.
  // (dimUnit() is defined above with the other dimension helpers.)
  ([
    [el.querySelector<HTMLInputElement>('[data-action="export-width"]'),  'w'],
    [el.querySelector<HTMLInputElement>('[data-action="export-height"]'), 'h'],
  ] as const).forEach(([inp, key]) => {
    if (!inp) return;
    const onDimChange = () => { onUrlSync?.(key); refreshCanvasPreview(); invalidatePreview(); pulseCanvasResize(); };
    inp.addEventListener('input', onDimChange);
    addScrubBehavior(inp, onDimChange, { format: v => `${v} ${dimUnit()}` });
  });

  // Apply a {width,height,unit} from a size-select option to the export-bar fields,
  // so choosing a size sets the actual exported page size. Refreshes the preview +
  // URL just like a manual edit. The user can still override the fields afterwards.
  function setDims({ width, height, unit }: { width?: number; height?: number; unit?: string } = {}): void {
    if (manifest.render.dims === false || !el) return;
    const uEl = el.querySelector<HTMLSelectElement>('[data-action="export-unit"]');
    if (uEl && unit) {
      uEl.value = unit;
      const dpiField = el.querySelector<HTMLElement>('[data-dpi-field]');
      if (dpiField) dpiField.style.display = unit === 'px' ? 'none' : 'inline-flex';
    }
    const wEl = el.querySelector<HTMLInputElement>('[data-action="export-width"]');
    const hEl = el.querySelector<HTMLInputElement>('[data-action="export-height"]');
    if (wEl && width !== undefined && width > 0) wEl.value = String(width);
    if (hEl && height !== undefined && height > 0) hEl.value = String(height);
    refreshCanvasPreview();
    invalidatePreview();
    pulseCanvasResize();
    onUrlSync?.('unit'); onUrlSync?.('w'); onUrlSync?.('h');
  }

  // Unit switch keeps the physical size: convert the typed values to the new
  // unit, toggle the DPI field, refresh the preview, and sync the URL.
  const unitSel = el.querySelector<HTMLSelectElement>('[data-action="export-unit"]');
  const dpiFieldEl = el.querySelector<HTMLElement>('[data-dpi-field]');
  let curUnit = initUnit;
  unitSel?.addEventListener('change', () => {
    const to = unitSel.value;
    const wEl = el.querySelector<HTMLInputElement>('[data-action="export-width"]');
    const hEl = el.querySelector<HTMLInputElement>('[data-action="export-height"]');
    const conv = (v: string): string => { const n = parseFloat(v); return n > 0 ? String(Math.round(toCssPx({ value: n, unit: asUnit(curUnit) }) / (toCssPx({ value: 1, unit: asUnit(to) })) * 100) / 100) : v; };
    if (wEl) wEl.value = conv(wEl.value);
    if (hEl) hEl.value = conv(hEl.value);
    curUnit = to;
    if (dpiFieldEl) dpiFieldEl.style.display = (to === 'px') ? 'none' : 'inline-flex';
    onUrlSync?.('unit'); onUrlSync?.('w'); onUrlSync?.('h');
    refreshCanvasPreview();
    invalidatePreview();
    pulseCanvasResize();
  });
  el.querySelector('[data-action="export-dpi"]')?.addEventListener('input', () => { onUrlSync?.('dpi'); invalidatePreview(); });

  el.querySelector('[data-action="copy"]')?.addEventListener('click', () => {
    // performCopy drives the camera-shutter itself (fullscreen on mobile), per
    // path: the image path GATES the off-screen resize ("shake") behind the closed
    // shutter — like exports do — while keeping the clipboard write in the user
    // gesture by handing the shutter-delayed blob promise to ClipboardItem; the
    // text/html paths play it as parallel feedback (they have no such resize).
    performCopy().then((res) => {
      bumpMetric('imagesCopied');
      // Honest feedback: on browsers without image-clipboard support the bridge
      // downloads the file instead, so don't claim it was copied.
      announce(res?.method === 'download'
        ? 'Clipboard image not supported here — downloaded instead'
        : 'Copied to clipboard');
    }).catch(err => console.error('Copy failed:', err));
  });

  // Copies the current render to the clipboard. Shared by the Copy button and
  // the `?copy` URL action. `fmtOverride` honours `?format=<format>&copy`.
  async function performCopy(fmtOverride?: string): Promise<{ method: string } | void> {
    const fmt = fmtOverride
      || formatEl?.value
      || (formats.includes('png') ? 'png' : formats[0]) || 'png';

    // Universal copy, by format:
    //   • txt / md   → plain text
    //   • html       → rich HTML (so an email signature pastes formatted into Gmail)
    //   • everything else (raster, SVG, PDF, …) → a PNG bitmap
    // so a paste always yields something useful whatever format is selected.
    const TEXT_FORMATS = new Set(['txt', 'md', 'markdown']);
    if (TEXT_FORMATS.has(fmt)) {
      playShutter();   // parallel capture feedback — writeText must stay in-gesture
      const blob = await exportUnscaled(() => runtime.export(canvasEl, fmt, exportDims()));
      await host.clipboard.writeText(await blob.text());
      return;
    }

    if (fmt === 'html') {
      playShutter();   // parallel capture feedback — no off-screen resize to hide here
      if (!canvasEl) return;
      // Clone the canvas, then scrub everything email clients strip or ignore.
      const clone = canvasEl.cloneNode(true);
      if (!(clone instanceof HTMLElement)) return;   // cloneNode of an HTMLElement always is one
      clone.querySelectorAll('[data-canvas-input]').forEach(el => el.removeAttribute('data-canvas-input'));
      clone.querySelectorAll('script').forEach(el => el.remove());
      // <style> blocks — email clients (Gmail etc.) strip them; the template
      // already carries full inline styles so these are pure character waste.
      clone.querySelectorAll('style').forEach(el => el.remove());
      // Annotation comment markers (<!-- ci:id -->) — invisible, ~30 chars each.
      const walker = document.createTreeWalker(clone, NodeFilter.SHOW_COMMENT);
      const comments: Node[] = [];
      let commentNode;
      while ((commentNode = walker.nextNode())) comments.push(commentNode);
      comments.forEach(n => n.parentNode?.removeChild(n));

      // Wrap the async blob-URL → data-URL conversion in a Promise so ClipboardItem
      // receives it while navigator.clipboard.write() is still in gesture context.
      const htmlBlobPromise = (async () => {
        // Email signatures display at ≤200px, so cap encoding there; html tools
        // needing larger images can raise this in their own beforeExport hook.
        await Promise.all([...clone.querySelectorAll('img')].map(async img => {
          const src = img.getAttribute('src');
          if (!src?.startsWith('blob:')) return;
          try {
            const dataUrl = await new Promise<string>((res, rej) => {
              const bmp = new Image();
              bmp.onload = () => {
                const MAX = 200;
                const scale = Math.min(1, MAX / Math.max(bmp.naturalWidth, bmp.naturalHeight));
                const w = Math.round(bmp.naturalWidth * scale);
                const h = Math.round(bmp.naturalHeight * scale);
                const c = document.createElement('canvas');
                c.width = w; c.height = h;
                const ctx = c.getContext('2d');
                if (!ctx) { rej(new Error('no 2d context')); return; }
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, w, h);
                ctx.drawImage(bmp, 0, 0, w, h);
                res(c.toDataURL('image/jpeg', 0.75));
              };
              bmp.onerror = rej;
              bmp.src = src;
            });
            img.src = dataUrl;
          } catch { /* leave as-is if conversion fails */ }
        }));
        return new Blob([clone.innerHTML], { type: 'text/html' });
      })();

      if (navigator.clipboard?.write && window.ClipboardItem) {
        try {
          const textBlob = htmlBlobPromise.then(b => b.text().then(
            t => { const d = document.createElement('div'); d.innerHTML = t; return new Blob([d.textContent ?? ''], { type: 'text/plain' }); }
          ));
          await navigator.clipboard.write([new ClipboardItem({ 'text/html': htmlBlobPromise, 'text/plain': textBlob })]);
          return;
        } catch { /* fall through to the bridge path */ }
      }
      await host.clipboard.writeHtml(await htmlBlobPromise.then(b => b.text()));
      return;
    }

    // Image copy. { shutter: true } closes the camera-iris BEFORE the off-screen
    // resize so its brief "shake" is hidden — exactly like exports — then opens it.
    // The clipboard write still stays in the user gesture because we hand the
    // shutter-delayed blob *promise* straight to ClipboardItem rather than awaiting
    // it first (awaiting before write() loses the gesture and the browser silently
    // denies the write; deferring the blob inside the promise is the cross-browser
    // pattern that survives the ~shutter delay). One export feeds both paths.
    const blobPromise = exportUnscaled(() => runtime.export(canvasEl, 'png', exportDims()), { shutter: true });
    if (navigator.clipboard?.write && window.ClipboardItem) {
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blobPromise })]);
        return { method: 'clipboard' };
      } catch { /* fall through to the bridge path — blobPromise has already resolved */ }
    }
    // Bridge path: image clipboard write unavailable (e.g. older Firefox) — this
    // returns { method: 'download' } when it falls back to saving the file instead.
    return host.clipboard.writeImage(await blobPromise);
  }

  el.querySelector('[data-action="download"]')?.addEventListener('click', async (e) => {
    const btn  = e.currentTarget;
    if (!(btn instanceof HTMLButtonElement)) return;
    const prev = btn.textContent;
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');

    const fmt        = formatEl?.value ?? formats[0] ?? 'png';
    const isAnimated = isAnimatedFmt(fmt);
    const isGif      = fmt === 'gif';

    if (isAnimated) {
      const { wait, duration, fps } = videoParams();
      const totalS = wait + duration;
      btn.textContent = isGif
        ? `Encoding GIF… ${totalS}s`
        : fps === 60
          ? `Rendering 60fps… ${totalS}s+`
          : `Recording… ${totalS}s`;
    } else {
      // Slow non-animated exports (CMYK TIFF, high-DPI raster, PDF) previously froze
      // on a disabled button with no signal. Show progress and tell assistive tech.
      btn.textContent = 'Exporting…';
    }
    announce('Exporting…');

    try {
      const opts: Partial<ExportOptions> = {
        ...exportDims(),
        ...(isAnimated ? videoParams() : {}),
        ...(isGif ? { dither: isChecked('[data-action="gif-dither"]') ?? false } : {}),
        ...(fmt === 'html' ? { fullPage: isChecked('[data-action="full-page"]') ?? false } : {}),
        ...(isPrintFmt(fmt) ? printOpts() : {}),
        ...(fmt === 'pdf-cmyk' ? { palette: PALETTE } : {}),
        ...(isCmykFmt(fmt) ? {
          colorProfile: inputVal('[data-action="cmyk-profile"]') || DEFAULT_CMYK_CONDITION,
        } : {}),
        ...(fmt === 'pdf' && inputVal('[data-action="pdf-password"]')
          ? { password: inputVal('[data-action="pdf-password"]') }
          : {}),
        ...(fmt === 'zip' ? {
          ...printOpts(),   // bundled pdf / pdf-cmyk get marks & bleed; rasters ignore them
          palette: PALETTE,
          colorProfile: inputVal('[data-action="cmyk-profile"]') || DEFAULT_CMYK_CONDITION,
          filename: inputVal('[data-action="filename"]')?.trim() || manifest.name,
          // ZIP_BUNDLE only holds members of the web export-format union.
          bundleFormats: formats.filter((f): f is WebExportFormat => ZIP_BUNDLE.has(f)),
        } : {}),
      };
      // Mask the resize with the shutter for instant (raster/vector) exports;
      // skip it for animated formats, which record the live canvas over seconds.
      const blob = await exportUnscaled(() => runtime.export(canvasEl, fmt, opts), { shutter: !isAnimated });
      const filename = inputVal('[data-action="filename"]')?.trim() || manifest.name;
      await host.export.download(blob, `${filename}.${extFor(fmt, blob)}`);
      bumpMetric('filesRendered'); recordFormat(fmt); // local usage metric
    } catch (err) {
      console.error('Export failed:', err);
      btn.removeAttribute('aria-busy');
      btn.textContent = 'Export failed';
      announce('Export failed', { assertive: true });
      setTimeout(() => { btn.textContent = prev; btn.disabled = false; }, 3000);
      return;
    }

    btn.removeAttribute('aria-busy');
    btn.textContent = prev;
    btn.disabled = false;
    announce('Export complete');
  });

  el.querySelector<HTMLButtonElement>('[data-action="save"]')?.addEventListener('click', async function () {
    if (await performSave(this)) setTimeout(() => { navigateTo(returnTo); }, 800);
  });

  // Apply the initial (or restored) dimensions to the canvas preview immediately.
  refreshCanvasPreview();

  // Render to the live frame for PREVIEW only (deferred-preview tools — see
  // manifest.render.preview). We run the normal export pipeline purely for its
  // side effect: an expensive beforeExport hook (e.g. url-shot's page capture)
  // paints its result into the canvas DOM. We then discard the blob — no
  // download, no clipboard. The painted frame stays until the next input change
  // rebuilds the template (which correctly invalidates the stale preview).
  let previewing = false;
  async function preview(): Promise<void> {
    if (previewing) return;
    previewing = true;
    try {
      const previewFmt = manifest.render.preview?.format;
      const fmt = (typeof previewFmt === 'string' ? previewFmt : undefined) || manifest.render.formats[0] || 'png';
      await exportUnscaled(() => runtime.export(canvasEl, fmt, exportDims()));
    } finally {
      previewing = false;
    }
  }

  // Expose actions the mount scope can trigger programmatically (e.g. `?copy`,
  // and the unsaved-changes dialog's "Save & leave").
  return { copy: performCopy, preview, save: performSave, setDims };
}

// Arms the `?copy` URL action. Clipboard writes require a user gesture
// (navigator.clipboard.write rejects otherwise, and the image path would fall
// back to a surprise download), so we can't copy silently on load. Instead we
// highlight the Copy button and perform the copy on the user's first click —
// which carries the transient activation the clipboard API needs.
export function armAutoCopy(actionsEl: HTMLElement | null, actionsApi: ActionsApi | undefined, fmt?: string): void {
  const copyBtn = actionsEl?.querySelector('[data-action="copy"]');
  const doCopy = actionsApi?.copy;
  if (!copyBtn || !doCopy) {
    console.warn('[copy] ?copy requested but this tool has no copy action');
    return;
  }

  const disarm = (): void => {
    document.removeEventListener('pointerdown', onGesture, true);
    copyBtn.classList.remove('copy-armed');
  };

  const onGesture = (e: PointerEvent): void => {
    disarm();
    // If the click landed on the Copy button, its own handler runs the copy —
    // don't double up. Any other first interaction triggers it here.
    if (e.target instanceof Node && copyBtn.contains(e.target)) return;
    doCopy(fmt).catch(err => console.error('Auto-copy failed:', err));
  };

  document.addEventListener('pointerdown', onGesture, true);
  copyBtn.classList.add('copy-armed');
}

// btnScopeEl — element containing the copy-url button (the actions bar)
// exportScopeEl — element containing format/filename/w/h inputs (actionsEl); optional
export function wireUpCopyUrl(btnScopeEl: HTMLElement, runtime: Pick<Runtime, 'getModel'>, exportScopeEl: HTMLElement | null, manifest: ToolManifest): void {
  btnScopeEl.querySelector('[data-action="copy-url"]')?.addEventListener('click', () => {
    showShareDialog(runtime, exportScopeEl ?? btnScopeEl, manifest);
  });
}

// The Share button opens the shared dialog (components/share-dialog.js): a ready-to-copy
// link plus the on-visit behaviour toggles. This thin wrapper feeds it the live tool
// state; the Projects view reuses the same dialog for a saved session.
export function showShareDialog(runtime: Pick<Runtime, 'getModel'>, exportScope: HTMLElement | null, manifest: ToolManifest): void {
  // Resolve the tool id from the address bar (path or hash form) so the link is the
  // crawler-visible /t/<id> shape. The dialog itself lives in components/share-dialog.js,
  // shared with the Projects view's per-session "Share link". buildShareParams stays here
  // (it reads the live runtime + export-panel DOM); the session path passes its own parts.
  const toolId = window.location.pathname.match(/^\/t\/([^/?]+)/)?.[1]
              ?? window.location.hash.match(/^#\/tool\/([^/?]+)/)?.[1];
  const currentFormat = exportScope?.querySelector<HTMLSelectElement>('[data-action="format"]')?.value || '';
  openShareDialog({ toolId, baseParts: buildShareParams(runtime, exportScope), manifest, currentFormat });
}

// Adds scroll-to-change and click-drag-to-scrub to a number input.
// Dragging uses Pointer Lock once the threshold is crossed so the cursor
// wraps across screen edges and movement is truly unbounded.
// onChange fires after every value change from either interaction.
// opts.format(value) returns the label shown in the floating readout that
// appears while dragging (defaults to the bare value) — see scrub-readout.js.
export function addScrubBehavior(inputEl: HTMLInputElement, onChange: () => void, opts: { format?: (value: string) => string } = {}): void {
  const format = opts.format ?? ((v: string) => String(v));
  const getMin = (): number => parseInt(inputEl.min, 10) || 1;
  const getMax = (): number => parseInt(inputEl.max, 10) || 99999;
  const clamp  = (v: number): number => Math.min(getMax(), Math.max(getMin(), v));

  inputEl.addEventListener('wheel', e => {
    // Only hijack the wheel to scrub the value when the field is focused; otherwise
    // let the event bubble so the surrounding panel scrolls past it normally.
    if (document.activeElement !== inputEl) return;
    e.preventDefault();
    const step = e.shiftKey ? 10 : 1;
    inputEl.value = String(clamp((parseInt(inputEl.value, 10) || 0) + (e.deltaY < 0 ? step : -step)));
    onChange();
  }, { passive: false });

  let dragging    = false;
  let wasDragging = false;
  let activeId: number | null = null;   // the one pointer currently driving a drag

  inputEl.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    // One scrub at a time: a second finger landing on the field mustn't reset the
    // baseline of the drag already in progress (it drove jumpy values on touch).
    if (activeId !== null) return;
    activeId = e.pointerId;
    const startX   = e.clientX;
    const startVal = parseInt(inputEl.value, 10) || 0;
    // Touch can't lock the pointer, so the value stays hidden under the finger —
    // track the readout above the touch point; otherwise anchor it to the field.
    const isTouch  = e.pointerType === 'touch';
    let   accumulated = 0; // total delta once pointer lock is active
    dragging = false;
    inputEl.setPointerCapture(e.pointerId);

    // Float the live value clear of the cursor/finger while dragging.
    function showReadout(ev: PointerEvent): void {
      const text = format(inputEl.value);
      if (isTouch) showScrubReadout({ text, finger: { x: ev.clientX, y: ev.clientY } });
      else showScrubReadout({ text, anchorEl: inputEl });
    }

    function onMove(e: PointerEvent): void {
      if (e.pointerId !== activeId) return;   // ignore any other pointer
      if (!dragging) {
        if (Math.abs(e.clientX - startX) < 4) return;
        dragging = true;
        document.body.style.cursor = 'ew-resize';
        // Request pointer lock so the cursor wraps at screen edges.
        // unadjustedMovement removes OS pointer acceleration for 1:1 scrubbing.
        // Skipped for touch (unsupported) — the clientX fallback drives it there.
        if (!isTouch) {
          const req = inputEl.requestPointerLock?.({ unadjustedMovement: true });
          if (req instanceof Promise) {
            req.catch(() => inputEl.requestPointerLock?.());
          }
        }
      }

      const step = e.shiftKey ? 10 : 1;
      if (document.pointerLockElement === inputEl) {
        // Locked: accumulate raw movementX — no screen-edge limit.
        accumulated += e.movementX * step;
        inputEl.value = String(clamp(startVal + Math.round(accumulated)));
      } else {
        // Lock not yet active (or unavailable): fall back to clientX delta.
        const dx = e.clientX - startX;
        inputEl.value = String(clamp(startVal + Math.round(dx * step)));
        // Keep accumulated in sync so the switch to locked mode is seamless.
        accumulated = parseInt(inputEl.value, 10) - startVal;
      }
      onChange();
      showReadout(e);
    }

    function onUp(e?: PointerEvent): void {
      // pointerup/cancel carry an event (ignore other pointers); onLockChange
      // calls onUp() with no argument to force a release.
      if (e && e.pointerId !== activeId) return;
      inputEl.removeEventListener('pointermove',   onMove);
      inputEl.removeEventListener('pointerup',     onUp);
      inputEl.removeEventListener('pointercancel', onUp);
      document.removeEventListener('pointerlockchange', onLockChange);
      if (document.pointerLockElement === inputEl) document.exitPointerLock();
      document.body.style.cursor = '';
      hideScrubReadout();
      if (dragging) {
        wasDragging = true;
        setTimeout(() => { wasDragging = false; }, 50);
      }
      dragging = false;
      activeId = null;
    }

    function onLockChange(): void {
      // Escape key or other external release — stop dragging cleanly.
      if (document.pointerLockElement !== inputEl) onUp();
    }

    inputEl.addEventListener('pointermove',   onMove);
    inputEl.addEventListener('pointerup',     onUp);
    inputEl.addEventListener('pointercancel', onUp);
    document.addEventListener('pointerlockchange', onLockChange);
  });

  // Suppress the click-to-focus that follows a drag so the cursor doesn't jump into text mode.
  inputEl.addEventListener('click', e => {
    if (wasDragging) { e.preventDefault(); inputEl.blur(); }
  });
}

// Cap on a vector thumbnail's raw SVG size. Dense vector output (e.g. a halftone
// with thousands of dots) can serialise to megabytes; above this we fall back to
// the raster path so a single thumbnail never bloats storage unbounded.
const SVG_THUMB_MAX_BYTES = 1_500_000;

export async function captureThumbnail(
  manifest: ToolManifest,
  canvasEl: HTMLElement | null,
  runtime: Pick<Runtime, 'export'>,
  exportUnscaled: ExportUnscaled,
  format = '',
): Promise<string | null> {
  const nw = manifest.render.width  || 600;
  const nh = manifest.render.height || 600;

  // Vector thumbnail: when the effective export format is SVG (the user picked it,
  // or it's the tool's default), capture an SVG data-URL instead of a PNG. SVG is
  // resolution-independent — it renders in the gallery's <img> and stays crisp at
  // any card size. renderSvg() inlines blob-URLs and vector tools outline their
  // text, so the SVG is self-contained and safe in an <img> sandbox. Falls through
  // to the raster path on failure or if the SVG is pathologically large.
  if (format === 'svg') {
    try {
      const blob = await exportUnscaled(
        () => runtime.export(canvasEl, 'svg', { width: nw, height: nh, embedMeta: false, thumbnail: true }),
        { shutter: true },
      );
      const svg = await blob.text();
      if (svg && svg.length <= SVG_THUMB_MAX_BYTES) {
        return `data:image/svg+xml,${encodeURIComponent(svg)}`;
      }
    } catch { /* fall through to the raster path */ }
  }

  // Raster thumbnail (default): a PNG sized for the gallery's preview-forward hero
  // (shown up to a full card column wide, at 2× for retina). Storage isn't a
  // concern for the single most-recent session per tool.
  try {
    const maxW = 720;
    const maxH = 560;
    const scale = Math.min(maxW / nw, maxH / nh);
    const tw = Math.max(1, Math.round(nw * scale));
    const th = Math.max(1, Math.round(nh * scale));
    // Mask the brief full-res resize with the shutter — the thumbnail is a fast
    // single PNG frame, so the shutter fully covers it for every tool.
    const blob = await exportUnscaled(
      // thumbnail:true lets expensive hooks (e.g. url-shot's capture) reuse the
      // last render on the canvas instead of re-running a slow capture.
      () => runtime.export(canvasEl, 'png', { width: tw, height: th, embedMeta: false, thumbnail: true }),
      { shutter: true },
    );
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
