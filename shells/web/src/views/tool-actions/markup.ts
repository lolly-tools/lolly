// SPDX-License-Identifier: MPL-2.0
/**
 * actions bar: the bar's own HTML, built at mount.
 *
 * Every function takes the shared `ta: ActionsCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `ta.<module>.<fn>`. Extracted verbatim
 * from renderActions() by scripts/split-closure.ts.
 */
import { CMYK_CONDITIONS, DEFAULT_CMYK_CONDITION, HDR_DEFAULTS, UNITS } from '@lolly/engine';
import { durableSupport, liveCaptureSupport } from '../../bridge/format-support.js';
import { helpTip } from '../../components/help-tip.js';
import { t, tRaw } from '../../i18n.ts';
import { getAudioTake, onAudioTakeChange, saveTakeMp3, saveTakeNative, takeNativeExt } from '../../lib/audio-take.ts';
import { exportAffordance, getExportPolicy } from '../../lib/export-policy.ts';
import { icon } from '../../lib/icons.ts';
import { escape as escapeText } from '../../utils.js';
import { costPanelHtml } from '../cost-panel.ts';
import { formatOptionsHtml } from '../export-depth.ts';
import { durableCardHtml, isDurableFmt } from '../export-durable-card.ts';
import { formatPanelHtml, formatTriggerHtml, wireFormatPicker } from '../export-format-picker.ts';
import { packageOptionsHtml, saveAsBridge, saveAsButtonHtml } from '../export-package-options.ts';
import { preflightRowHtml } from '../export-preflight.ts';
import { jellyActive } from '../../lib/jelly.ts';
import { DEFAULT_PRINT_MARKS, fmtLabel, isC2paFmt, isCmykFmt, isHdrFmt, isImprintFmt, isPrintFmt } from './shared.ts';
import { bindOp, type ActionsCtx } from './context.ts';

export function buildFormatOptions(ta: ActionsCtx): void {
  const { ICON_H, ICON_W, c2paInitDays, c2paInitOn, canPackage, experience, exportDefaults, formats, initialFmt, manifest } = ta;
  // Tier 1 - filename · format. The format selector is the highest-priority
  // control; the filename rides alongside it as the natural "name.format" pair.
  //
  // The float interchange formats (exr/hdr) are compositing containers, not peers
  // of png/jpg, so they sit in their own native <optgroup> - no custom CSS, no
  // extra space, native a11y. The group is built from what SURVIVED keepFormat, so
  // it exists only where those formats can actually be produced: on the web that is
  // a tool with a float-compose exportStill hook (see toolDeepExport above - Bitmap
  // Studio), and otherwise nowhere (a plain tool has no float master). The markup
  // then has no optgroup in it at all. See views/export-depth.ts.
  const formatOptions = formatOptionsHtml(formats, initialFmt, fmtLabel); ta.formatOptions = formatOptions;
  // The native select is kept as the VALUE CARRIER only (hidden): the mode-driven
  // narrowing, matchExportFormat auto-pick and every 'change' listener still talk
  // to it. What the user sees is the grouped picker: the pill's trigger half plus
  // a floating dropdown anchored to this row (views/export-format-picker.ts) -
  // floating so the rows below never move when it opens.
  const filenameRow = `
      <div class="filename-extension">
        <input type="text" class="export-filename" data-action="filename"
              value="${escapeText(exportDefaults.filename ?? '')}" placeholder="${escapeText(ta.formatRules.autoFilename())}" spellcheck="false">
        ${
          formats.length > 1
            ? `
          <select data-action="format" aria-label="Export format" hidden aria-hidden="true" tabindex="-1">
            ${formatOptions}
          </select>
          ${formatTriggerHtml(initialFmt ?? formats[0] ?? '', fmtLabel)}
          ${formatPanelHtml(formats, initialFmt ?? formats[0] ?? '', fmtLabel, experience.current?.().recommendedFormats)}
        `
            : ''
        }
      </div>`; ta.filenameRow = filenameRow;

  // Tier 2 - dimensions. The primary sizing control: full-width, prominent,
  // with the directional icon inside each field.
  const initUnit = exportDefaults.unit ?? 'px'; ta.initUnit = initUnit;
  const initDpi = exportDefaults.dpi ?? 300; ta.initDpi = initDpi;
  const dimsRow =
    manifest.render.dims !== false
      ? `
      <div class="export-dims">
        <div class="dim-field">
          ${ICON_W}
          <input type="number" data-action="export-width" data-scrub aria-label="Width"
                 value="${exportDefaults.width ?? manifest.render.width}" min="1" max="100000" step="any">
        </div>
        <div class="dim-field">
          ${ICON_H}
          <input type="number" data-action="export-height" data-scrub aria-label="Height"
                 value="${exportDefaults.height ?? manifest.render.height}" min="1" max="100000" step="any">
        </div>
        ${
          manifest.render.units === false
            ? ''
            : `
        <select class="dim-unit" data-action="export-unit" aria-label="Units"
                title="Units for width & height. Physical units (mm/cm/in/pt) export at the right size for print - PDF as a true page, raster at the chosen DPI.">
          ${UNITS.map((u) => `<option value="${u}" ${u === initUnit ? 'selected' : ''}>${u}</option>`).join('')}
        </select>
        <label class="dim-dpi" data-dpi-field style="display:${initUnit === 'px' ? 'none' : 'inline-flex'}"
               title="Raster resolution for physical units (ignored for vector formats).">
          <input type="number" data-action="export-dpi" value="${initDpi}" min="36" max="1200" step="1" aria-label="DPI">
          <span>DPI</span>
        </label>`
        }
      </div>`
      : ''; ta.dimsRow = dimsRow;

  // Editor-only aspect-ratio guard (manifest.render.aspectWarning). A hidden alert
  // beside the dimension controls, shown when the chosen page size falls outside the
  // tool's supported orientation band - see updateAspectWarning(). Never exported.
  const ICON_WARN = `<svg class="aspect-warn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`; ta.ICON_WARN = ICON_WARN;
  const aspectWarnRow =
    manifest.render.aspectWarning && manifest.render.dims !== false
      ? `<div class="export-aspect-warning" data-aspect-warning role="alert" hidden>${ICON_WARN}<span data-aspect-warning-text></span></div>`
      : ''; ta.aspectWarnRow = aspectWarnRow;

  // Export-fidelity guard. Some CSS the canvas can paint has no equivalent in the
  // chosen output format, and until now it simply vanished from the file with nothing
  // said. `backdrop-filter` (frosted glass) is the first case wired up: only SVG can
  // reconstruct it, so every other format exports the panel unfrosted. Same hidden
  // alert shape as the aspect guard, driven by updateFidelityWarning(). Never exported.
  const fidelityWarnRow = `<div class="export-aspect-warning" data-fidelity-warning role="alert" hidden>${ICON_WARN}<span data-fidelity-warning-text></span></div>`; ta.fidelityWarnRow = fidelityWarnRow;

  // Tier 2.5 - colour profile (Print PDF only). The CMYK press condition embedded
  // in the PDF's OutputIntent. A self-contained card so this professional/print
  // setting reads as deliberate; revealed only when "Print PDF" (pdf-cmyk) is the
  // chosen format. Options come from the engine's CMYK_CONDITIONS registry.
  const ICON_DROP = `<svg class="cmyk-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2.7s6.5 7 6.5 11.8a6.5 6.5 0 0 1-13 0C5.5 9.7 12 2.7 12 2.7z"/></svg>`; ta.ICON_DROP = ICON_DROP;
  const hasCmyk = formats.includes('pdf-cmyk') || formats.includes('cmyk-tiff'); ta.hasCmyk = hasCmyk;
  const initProfile =
    exportDefaults.profile && (CMYK_CONDITIONS as Record<string, unknown>)[exportDefaults.profile]
      ? exportDefaults.profile
      : DEFAULT_CMYK_CONDITION; ta.initProfile = initProfile;
  const cmykOptions = Object.entries(CMYK_CONDITIONS)
    .map(
      ([key, c]) =>
        `<option value="${escapeText(key)}" ${key === initProfile ? 'selected' : ''}>${escapeText((c as { info?: string }).info)}</option>`
    )
    .join(''); ta.cmykOptions = cmykOptions;
  // The full explanation lives under the info icon (helpTip), not as a wall of body
  // text - same affordance as the C2PA / Imprint rows.
  const cmykTip = hasCmyk
    ? helpTip(
        "Names the CMYK press standard your printer targets: the Print PDF's output intent, the Print TIFF's metadata (the pixels stay untagged DeviceCMYK). An Embed row carries a profile from this device inside the PDF, which is what PDF/X-4 conformance needs; the file then claims it unless something else in the export can't (RGB artwork, the credit-text stamp, a strong password)."
      )
    : null; ta.cmykTip = cmykTip;
  const cmykRow = hasCmyk
    ? `
      <div class="section-card export-cmyk" data-cmyk-only style="display:${isCmykFmt(initialFmt) ? 'flex' : 'none'}">
        <span class="cmyk-head help-tip-host">${ICON_DROP}<span>Color profile</span>${cmykTip!.button}${cmykTip!.pop}</span>
        <select class="field-select" data-action="cmyk-profile" aria-label="CMYK press profile">
          ${cmykOptions}
        </select>
      </div>`
    : ''; ta.cmykRow = cmykRow;

  // Tier 2.6 - PDF password (standard "PDF" only). A non-empty value locks the
  // exported PDF on open (jsPDF standard security handler, copy/modify restricted).
  // Revealed only when "PDF" is chosen - the print-PDF path (pdf-cmyk) re-saves
  // through pdf-lib, which can't write encrypted PDFs.
  //
  // URL-expressible by design: a `?password=` link can pre-set it for quick,
  // short-lived transactional use (event materials etc). That's clear-text in the
  // URL - an accepted trade-off for a basic lock, not for confidential material.
  // It is NOT persisted to the library at rest (see performSave); URL is the only
  // way it round-trips. The initial value below comes from the URL only.
  // Collapsed by default - a click-to-expand disclosure (mirrors the Print marks
  // card) so the field + caveat only surface when wanted, keeping the panel tight.
  // Pre-opened when a value arrives (e.g. ?password=) so it's visible. Collapse is
  // purely visual: the input remains the source of truth, so a typed value still
  // applies on export and survives collapse/expand.
  const ICON_LOCK = `<svg class="pdfpass-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`; ta.ICON_LOCK = ICON_LOCK;
  // The lock card serves both the PDF password tiers AND the ZIP bundle lock (the
  // engine's two-tier zip-crypto: standard ZipCrypto / strong AES-256). refreshLockTier
  // rewords the tier options + hint per format.
  const hasPdf = formats.includes('pdf'); ta.hasPdf = hasPdf;
  const hasZip = formats.includes('zip'); ta.hasZip = hasZip;
  const pdfPassInitOpen = Boolean(exportDefaults.password); ta.pdfPassInitOpen = pdfPassInitOpen;
  const pdfPassRow =
    hasPdf || hasZip
      ? `
      <div class="section-card export-pdfpass${pdfPassInitOpen ? ' is-open' : ''}" data-pdf-only style="display:${initialFmt === 'pdf' || initialFmt === 'zip' ? 'flex' : 'none'}">
        <button type="button" class="pdfpass-head" data-action="pdfpass-toggle" aria-expanded="${pdfPassInitOpen}">${ICON_LOCK}<span>Password protect</span></button>
        <div class="pdfpass-body" data-pdfpass-body style="display:${pdfPassInitOpen ? 'flex' : 'none'}">
          <input type="password" data-action="pdf-password" autocomplete="new-password" spellcheck="false"
                 value="${escapeText(exportDefaults.password ?? '')}"
                 placeholder="Leave blank for no password" aria-label="Open password">
          <select class="pdfpass-tier field-select field-select--sm" data-action="pdf-lock-tier" aria-label="Encryption strength">
            <option value="standard">Standard lock - opens in any PDF app</option>
            <option value="strong">Strong · AES-256 - newer apps only ⓘ</option>
          </select>
          <p class="pdfpass-hint" data-pdfpass-hint>Requires this password to open the PDF. A basic 40-bit lock - it opens in any PDF app and travels in a share link, so treat it as a deterrent, not protection for confidential files.</p>
        </div>
      </div>`
      : ''; ta.pdfPassRow = pdfPassRow;

  const pkgRow = packageOptionsHtml(canPackage, initialFmt, manifest.id); ta.pkgRow = pkgRow;

  // Tier 2.65 - Content Credentials, shown for every stampable container
  // (engine C2PA_FORMATS: pdf, png/apng, jpg, gif, svg, tiff, webp, mp4, webm).
  // Checking
  // it embeds a signed C2PA manifest into the finished bytes (the export
  // bridge stamps at the end of renderFormat - see stampC2pa in
  // bridge/export.js). For PDFs it is mutually exclusive with the
  // open-password: an encrypted document can't take the C2PA incremental
  // update (see refreshC2paUi). A tool pre-selects it via manifest render.c2pa.
  const ICON_CRED = `<svg class="c2pa-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 11.5 2 2 4-4"/></svg>`; ta.ICON_CRED = ICON_CRED;
  // c2paInitOn / c2paInitDays are hoisted above autoFilename (the "-lolly" name
  // suffix reads the same defaults before the checkboxes exist).
  const c2paFormats = formats.filter(isC2paFmt); ta.c2paFormats = c2paFormats;
  // The old always-visible explanation moves behind an info (?) tip so the card
  // reads as just "C2PA Credentials" + a toggle. The tip links to OUR on-device
  // /verify page (not the Adobe-run contentcredentials.org checker) so people can
  // confirm their own exports here.
  const c2paTip = c2paFormats.length
    ? helpTip(
        'Embeds a signed C2PA manifest recording that this file was made with Lolly - plus your name when profile details are on. ' +
          'Signed on-device, so viewers show it as an unverified credential unless you enrol a verified identity (Profile → Content Credentials).',
        { href: '#/verify', text: 'Check a file →' }
      )
    : null; ta.c2paTip = c2paTip;
  const c2paRow = c2paFormats.length
    ? `
      <div class="section-card export-c2pa" data-c2pa-only style="display:${isC2paFmt(initialFmt) || initialFmt === 'zip' ? 'flex' : 'none'}">
        <label class="c2pa-enable field-toggle help-tip-host">
          <input type="checkbox" class="field-check" data-action="pdf-c2pa" ${c2paInitOn ? 'checked' : ''}>
          <span class="c2pa-head">${ICON_CRED}<span>C2PA Credentials</span></span>
          ${c2paTip!.button}
          ${c2paTip!.pop}
        </label>
        <p class="c2pa-hint" data-c2pa-webm style="display:${initialFmt === 'webm' ? 'block' : 'none'}">WebM credentials are Lolly's own mapping for now - external C2PA viewers can't read WebM.</p>
        <div class="c2pa-life" data-c2pa-life>
          <label class="c2pa-life-pick"><span class="c2pa-life-label">${escapeText(t('Verified for'))}</span>
            <select class="field-select field-select--sm field-select--auto" data-action="c2pa-days" aria-label="Credential lifetime">
              ${[7, 30, 90, 365].map((d) => `<option value="${d}"${d === c2paInitDays ? ' selected' : ''}>${d} days</option>`).join('')}
            </select>
          </label>
        </div>
      </div>`
    : ''; ta.c2paRow = c2paRow;

  // Tier 2.66 - the Lolly pixel imprint (engine pixel-watermark.ts): a durable,
  // imperceptible mark mixed into the exported pixels. It completes the provenance
  // story next to the C2PA card above - the credential is strippable, the pixel
  // mark survives re-encodes/screenshots, and /verify detects both. On by default,
  // like C2PA; `?imprint=0` unchecks it, and the toggle round-trips back into the
  // URL (see views/tool.ts syncUrl) - unchecking sets imprint=0, checking (the
  // default) drops the param entirely so a plain link stays clean.
  const imprintFmts = formats.filter(isImprintFmt); ta.imprintFmts = imprintFmts;
  // A .pptx / .pdf is a CONTAINER: the Imprint can only ride raster images it
  // embeds, never the native vector slides/shapes or byte-faithful user uploads.
  // A deck of headings, boxes and a vector logo (or one whose only pictures are
  // your own photos) therefore carries no detectable Imprint even with it on - so
  // say so rather than let the toggle over-promise. It rides baked content:
  // rotated or CSS-filtered elements, effect layers, inline SVG art, rendered charts.
  const containerImprintFmt = imprintFmts.some(
    (f) => f === 'pptx' || f === 'pdf' || f === 'pdf-cmyk'
  ); ta.containerImprintFmt = containerImprintFmt;
  const imprintTip = imprintFmts.length
    ? helpTip(
        t(
          'Hides the Lolly Imprint - a durable, invisible watermark - in the image pixels. It survives re-encoding and screenshots, so any copy of the file can be recognised later.'
        ) +
          (containerImprintFmt
            ? ' ' +
              t(
                'It rides embedded raster images, not the vector shapes and text - a slide or page built only of headings, boxes and a vector logo has no pixels to carry it.'
              )
            : ''),
        { href: '#/verify', text: t('Check a file →') }
      )
    : null; ta.imprintTip = imprintTip;
  const imprintRow = imprintFmts.length
    ? `
      <div class="section-card export-c2pa export-imprint" data-imprint-only style="display:${isImprintFmt(initialFmt) || initialFmt === 'zip' ? 'flex' : 'none'}">
        <label class="c2pa-enable field-toggle help-tip-host">
          <input type="checkbox" class="field-check" data-action="imprint" ${exportDefaults.imprint !== false ? 'checked' : ''}>
          <span class="c2pa-head">${icon('imprint', { className: 'c2pa-icon' })}<span>${t('Lolly Imprint')}</span></span>
          ${imprintTip!.button}
          ${imprintTip!.pop}
        </label>
      </div>`
    : ''; ta.imprintRow = imprintRow;

  // Tier 2.67 - the DURABLE credential (opt-in). The card, its help tip and the
  // model-route probe all live in views/export-durable-card.ts; this view keeps
  // only the live route flag, which refreshPrintUi reads for visibility.
  ta.durableRouteOk = durableSupport();
  const durableFmts = formats.filter(isDurableFmt); ta.durableFmts = durableFmts;
  const durableRow = durableCardHtml({
    present: durableFmts.length > 0,
    visible: ta.durableRouteOk && isDurableFmt(initialFmt),
    checked: !!exportDefaults.durable,
  }); ta.durableRow = durableRow;

  // HDR (Rec.2100 PQ) raster export - OPT-IN, off by default. Boosts the brand's
  // primary colours (the live palette) toward peak luminance so white text and
  // brand colours glow on HDR displays while darks stay dark; SDR viewers see a
  // normal image. Raster only (png/jpeg today). Round-trips into the URL as
  // ?hdr=1 (see views/tool.ts syncUrl + engine/src/hdr.ts).
  const hdrFmts = formats.filter(isHdrFmt); ta.hdrFmts = hdrFmts;
  const hdrTip = hdrFmts.length
    ? helpTip(
        t(
          'HDR (Rec.2100 PQ) boosts your brand colours and white text toward peak brightness so they glow on HDR-capable screens - Safari/Preview on Apple devices, Chrome on an HDR display - while dark areas stay dark. IMPORTANT: only use it where the destination supports HDR. Many platforms (social media, messaging apps, some websites) re-encode uploads and strip the HDR signal, which can leave the image looking dark or washed out. On an ordinary SDR screen it still shows as a normal image.'
        )
      )
    : null; ta.hdrTip = hdrTip;
  // Author dials - seeded from a tuned ?hdr= value, else the engine defaults. The
  // body reveals when the toggle is on (like the print card). All four map onto
  // hdrBoostToPQ knobs in the bridge (see export.ts hdrTune): White = peak nits,
  // Reach = how far down the tones the glow spreads, Dark lift = how much darks
  // brighten (0 keeps them dark), Focus = colour richness of the boost.
  const hdrTune = exportDefaults.hdrTune ?? HDR_DEFAULTS; ta.hdrTune = hdrTune;
}

export function buildHdrRow(ta: ActionsCtx): void {
  const { exportDefaults, hasCmyk, hasPdf, hdrFmts, hdrTip, hdrTune, initialFmt, manifest } = ta;
  const hdrRow = hdrFmts.length
    ? `
      <div class="section-card export-hdr" data-hdr-only style="display:${isHdrFmt(initialFmt) ? 'flex' : 'none'}">
        <label class="hdr-enable field-toggle help-tip-host">
          <input type="checkbox" class="field-check" data-action="hdr" ${exportDefaults.hdr ? 'checked' : ''}>
          <span class="hdr-head">${icon('sunburst', { className: 'hdr-icon' })}<span>${t('HDR (bright colours)')}</span></span>
          ${hdrTip!.button}
          ${hdrTip!.pop}
        </label>
        <div class="hdr-body" data-hdr-body style="display:${exportDefaults.hdr ? 'grid' : 'none'}">
          ${ta.formatRules.hdrSlider('hdr-peak', 'White', 400, 2000, 50, hdrTune.peakNits)}
          ${ta.formatRules.hdrSlider('hdr-reach', 'Reach', 0, 100, 5, hdrTune.reach)}
          ${ta.formatRules.hdrSlider('hdr-lift', 'Dark lift', 0, 100, 5, hdrTune.lift)}
          ${ta.formatRules.hdrSlider('hdr-focus', 'Focus', 0, 100, 5, hdrTune.richness)}
        </div>
      </div>`
    : ''; ta.hdrRow = hdrRow;

  // Tier 2.7 - print marks & bleed (pdf / pdf-cmyk / cmyk-tiff). An opt-in card
  // (master checkbox) so ordinary output stays trim-sized; turning it on reveals a
  // bleed field (default 3mm) + the mark toggles at print-standard defaults. Mark
  // size, gap and stroke weight are fixed in the engine (see print-marks.js).
  const ICON_CROP = `<svg class="print-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 2v16h16"/><path d="M2 6h16v16"/></svg>`; ta.ICON_CROP = ICON_CROP;
  // Print finishing applies to a single trim-sized artwork; tools that emit
  // per-page boxes (multi-page PDF) opt out via render.printMarks:false so the
  // card isn't shown promising marks the multi-page export path doesn't apply.
  const hasPrint = (hasPdf || hasCmyk) && manifest.render.printMarks !== false; ta.hasPrint = hasPrint;
  // Marks & bleed default ON only where there is PRINT INTENT: picking a separating
  // press format (Print PDF / Print TIFF / CMYK EPS), a manifest that declares
  // render.printMarks: true, or an explicit bleed/marks preference from a link/save.
  // The RGB vector formats (pdf / svg / eps) still SHOW the card - they can carry
  // marks - but its master toggle starts OFF, so an everyday PDF or SVG export is
  // trim-sized and unmarked until the user asks. Physical units alone never count
  // as print intent (see isPressFmt above).
  const declaresPrintIntent = manifest.render.printMarks === true; ta.declaresPrintIntent = declaresPrintIntent;
}

export function buildPrintAndRows(ta: ActionsCtx): void {
  const { ICON_CROP, actions, c2paFormats, c2paRow, canvasEl, copyUrlBtn, defaultDuration, defaultWait, durableRow, durationMax, experience, exportDefaults, exportOpts, formats, hasAnimated, hasPdf, hasPrint, hasZip, imprintFmts, imprintRow, initialFmt, manifest, pdfPassInitOpen, pdfPassRow, runtime } = ta;
  const printInitOn =
    Boolean(exportDefaults.bleed || exportDefaults.marks) || ta.formatRules.printIntentFmt(initialFmt); ta.printInitOn = printInitOn;
  const printInitMm = exportDefaults.bleed ? parseFloat(exportDefaults.bleed) || 3 : 3; ta.printInitMm = printInitMm;
  // Colour bars default ON for the CMYK print formats (the press uses them as a
  // control strip), OFF for the RGB pdf. An explicit marks default (link/save) wins.
  // 'Stamp details' (provenance) is always pre-checked: the credit stamp is on by
  // default whenever the print-marks card is enabled, regardless of any remembered
  // marks state. The other marks still restore from saved/linked defaults.
  const pim = {
    ...DEFAULT_PRINT_MARKS,
    colorBars: isCmykFmt(initialFmt),
    ...(exportDefaults.marks || {}),
    provenance: true,
  }; ta.pim = pim;
  const printRow = hasPrint
    ? `
      <div class="section-card export-print" data-printmarks-only style="display:${isPrintFmt(initialFmt) ? 'flex' : 'none'}">
        <label class="print-enable field-toggle">
          <input type="checkbox" class="field-check" data-action="print-enable" ${printInitOn ? 'checked' : ''}>
          <span class="print-head">${ICON_CROP}<span>Print marks &amp; bleed</span></span>
        </label>
        <div class="print-body" data-print-body style="display:${printInitOn ? 'flex' : 'none'}">
          <label class="print-bleed">
            <span>Bleed</span>
            <input type="number" data-action="print-bleed" value="${printInitMm}" min="0" max="25" step="0.5" aria-label="Bleed in millimetres">
            <span>mm</span>
          </label>
          <div class="print-toggles">
            <label class="export-option"><input type="checkbox" class="field-check" data-action="mark-crop" ${pim.crop ? 'checked' : ''}> Crop</label>
            <label class="export-option"><input type="checkbox" class="field-check" data-action="mark-reg" ${pim.registration ? 'checked' : ''}> Registration</label>
            <label class="export-option"><input type="checkbox" class="field-check" data-action="mark-bleed" ${pim.bleed ? 'checked' : ''}> Bleed</label>
            <label class="export-option"><input type="checkbox" class="field-check" data-action="mark-bars" ${pim.colorBars ? 'checked' : ''}> Color bars</label>
            <label class="export-option"><input type="checkbox" class="field-check" data-action="mark-prov" ${pim.provenance ? 'checked' : ''}> Stamp details</label>
          </div>
          <p class="print-hint">Adds bleed and the chosen marks for a print shop; the artwork is scaled to fill the bleed. Registration marks print on all four plates in the Print PDF and Print TIFF. (An open-password can't be combined with marks.)</p>
        </div>
      </div>`
    : ''; ta.printRow = printRow;

  // Tier 2.8 - "Content protection": one collapsed disclosure folding the
  // provenance/protection cards (password, C2PA, Imprint) so the panel shows one
  // header instead of up to three separate boxes. Print marks & bleed are NOT in
  // here - they're print PRODUCTION geometry, not content protection, so printRow
  // stays its own top-level section (see the assembly below). Purely a wrapping
  // shell - none of the inner cards' own markup, classes, data-actions, defaults
  // or per-format [data-*-only] gating changes; this only adds one more OUTER
  // layer of visibility on top (see refreshPrintUi, which also owns hiding the
  // whole wrapper when NONE of the three apply to the selected format).
  const hasProtection = hasPdf || hasZip || c2paFormats.length > 0 || imprintFmts.length > 0; ta.hasProtection = hasProtection;
  // Collapsed by default. Pre-opened only when an inner card carries an EXPLICIT
  // deep-linked setting - a URL-sourced password, a URL-sourced C2PA choice, or a
  // linked imprint/durable flag - so a share link still surfaces its setting without
  // an extra click. The mere default-on C2PA state (c2paInitOn) does NOT open it, so
  // the common case shows a single tidy collapsed header.
  const protectionOpen =
    pdfPassInitOpen ||
    Boolean(exportDefaults.c2pa) ||
    Boolean(exportDefaults.imprint) ||
    Boolean(exportDefaults.durable); ta.protectionOpen = protectionOpen;
  // Matches the canonical per-format predicates the inner cards already use
  // (isC2paFmt/isImprintFmt, plus the password card's pdf/pdf-cmyk/zip set) -
  // never loosened, just OR'd together to decide the outer wrapper.
  const protectionVisibleInitial =
    initialFmt === 'pdf' ||
    initialFmt === 'pdf-cmyk' ||
    initialFmt === 'zip' ||
    isC2paFmt(initialFmt) ||
    isImprintFmt(initialFmt); ta.protectionVisibleInitial = protectionVisibleInitial;
  const protectionRow = hasProtection
    ? `
      <div class="section-card export-protection${protectionOpen ? ' is-open' : ''}" data-protection-section style="display:${protectionVisibleInitial ? 'flex' : 'none'}">
        <button type="button" class="protection-head" data-action="protection-toggle" aria-expanded="${protectionOpen}">${icon('shield', { className: 'protection-icon' })}<span>${t('Content protection')}</span></button>
        <div class="protection-body" data-protection-body style="display:${protectionOpen ? 'flex' : 'none'}">
          ${pdfPassRow}${c2paRow}${imprintRow}${durableRow}
        </div>
      </div>`
    : ''; ta.protectionRow = protectionRow;

  // Tier 3 - ancillary settings. Everything optional (transparent bg, dithering)
  // lives in one wrapping chip cluster so the panel reads consistently no matter
  // which controls a given tool/format enables.
  //
  // Several of these inputs are injected by the engine WITH a help string
  // (inputs.ts synthesises 'Convert paths' and explains what turning it off keeps),
  // and the chip used to drop that text on the floor - the one control in the sheet
  // whose jargon had an answer written for it that nobody could read. Render it as
  // the same (i) affordance the sidebar and the cards above use. The LABEL still
  // comes from the engine, untouched.
  const optionChips = exportOpts
    .map((i) => {
      // 'Convert paths' only affects vector output, so its chip is gated to the
      // selected format (hidden for png/jpg/etc). Other export options are global.
      const vectorOnly = i.id === 'convertPaths';
      const hide = vectorOnly && !ta.formatRules.isVectorFmt(initialFmt);
      const tip = i.help ? helpTip(i.help) : null;
      return `
        <label class="export-option${tip ? ' help-tip-host' : ''}"${vectorOnly ? ' data-vector-only' : ''}${hide ? ' style="display:none"' : ''}>
          <input type="checkbox" class="field-check" data-input-id="${escapeText(i.id)}" ${i.value ? 'checked' : ''}>
          ${escapeText(i.label ?? i.id)}
          ${tip ? `${tip.button}${tip.pop}` : ''}
        </label>`;
    })
    .join(''); ta.optionChips = optionChips;

  // F22 (plans/163) - transparency, mirrored from the sidebar.
  //
  // The engine synthesises `transparentBg` as an ordinary SIDEBAR input, not an
  // export one (inputs.ts): the background is a creative choice people make next to
  // colour and theme. True - but the moment they go looking for it is when they are
  // exporting a PNG, and by then the sidebar is behind the sheet. So the same input
  // gets a second home here, as one more chip in the strip beside Convert paths.
  // One input id, two views of it, never two settings. Only shown for a format with
  // an alpha channel to keep; the label and the help text come from the engine's
  // spec, exactly like the chips above.
  // A tool may declare `transparentBg` itself instead of letting the engine synthesise
  // it (asset-export calls it "No background"); either way it is the same input id and
  // the same checkbox. The type test keeps the mirror honest if one is ever declared as
  // something other than a boolean.
  const transparentInput = runtime
    .getModel()
    .find((i) => i.id === 'transparentBg' && i.type === 'boolean'); ta.transparentInput = transparentInput as ActionsCtx['transparentInput'];
  const transparentTip = transparentInput?.help ? helpTip(transparentInput.help) : null; ta.transparentTip = transparentTip as ActionsCtx['transparentTip'];
  const transparentChip = transparentInput
    ? `
        <label class="export-option${transparentTip ? ' help-tip-host' : ''}" data-alpha-only
               style="display:${ta.formatRules.isAlphaFmt(initialFmt) ? 'flex' : 'none'}">
          <input type="checkbox" class="field-check" data-action="transparent-bg" ${transparentInput.value ? 'checked' : ''}>
          ${escapeText(transparentInput.label ?? transparentInput.id)}
          ${transparentTip ? `${transparentTip.button}${transparentTip.pop}` : ''}
        </label>`
    : ''; ta.transparentChip = transparentChip;
  // Tier 2.1 - timing (animated formats only). How long the clip runs, and how long
  // to hold before recording starts, are size-like decisions: for a video the length
  // is the first thing anyone changes. So the row sits directly under the dimensions
  // rather than at the bottom of the optional chip strip, where it used to rank below
  // the audio card's ducking controls. The Dither toggle rides along because it is
  // the GIF-only quality dial for the same take. Nothing else moves: the data-actions,
  // the [data-anim-params] / [data-gif-only] / [data-video-only] hooks and the
  // per-format show/hide handlers are the same ones as before.
  const timingTip = hasAnimated
    ? helpTip(
        t(
          'Start after holds the canvas still for a moment before recording begins, so animations and fonts settle first. Duration is how long the finished clip runs.'
        )
      )
    : null; ta.timingTip = timingTip;
  const liveTip =
    hasAnimated && liveCaptureSupport()
      ? helpTip(
          t(
            'Records the on-screen preview in real time through a screen share, so motion matches exactly what you see. Pick this tab in the share dialog and keep it visible for the whole take.'
          )
        )
      : null; ta.liveTip = liveTip as ActionsCtx['liveTip'];
  const timingRow = hasAnimated
    ? `
        <div class="video-params" data-anim-params style="display:${ta.formatRules.isAnimatedFmt(initialFmt) ? 'flex' : 'none'}">
          <span class="vp-field help-tip-host"><span>${escapeText(t('Start after'))}</span>
            <input type="number" data-action="video-wait" value="${defaultWait}" min="0" max="30" step="0.5"
                   aria-label="${escapeText(t('Start recording after (seconds)'))}"><span>s</span>${timingTip!.button}${timingTip!.pop}</span>
          <span class="vp-field"><span>${escapeText(t('Duration'))}</span>
            <input type="number" data-action="video-duration" value="${defaultDuration}" min="1" max="${durationMax}" step="0.5"
                   aria-label="${escapeText(t('Recording duration (seconds)'))}"><span>s</span></span>
          <label class="gif-dither-toggle" data-gif-only
                 style="display:${initialFmt === 'gif' ? 'flex' : 'none'}">
            <input type="checkbox" class="field-check" data-action="gif-dither">
            Dither
          </label>
          ${
            liveTip
              ? `<label class="gif-dither-toggle help-tip-host" data-video-only data-live-capture
                 style="display:${ta.formatRules.isVideoFmt(initialFmt) ? 'flex' : 'none'}">
            <input type="checkbox" class="field-check" data-action="video-live">
            ${escapeText(t('Record live'))}
            ${liveTip.button}${liveTip.pop}
          </label>`
              : ''
          }
          ${runtime.hasFrameHook ? `<span class="vp-live-hint" style="flex-basis:100%;font-size:11px;opacity:.7;margin-top:2px">Records the live feed - start <strong>Go&nbsp;live</strong> on the canvas first.</span>` : ''}
        </div>`
    : ''; ta.timingRow = timingRow;
  // Audio track card - webm/mp4 only. An optional catalog music bed (type:
  // 'audio', suse/music/*) muxed into the recording; it plays for the clip
  // duration, looping when the clip outlasts the track. Options are filled
  // async from host.assets.query once per mount (see below) - the selection is
  // popup-local like wait/duration, never serialized into URLs or share links.
  const ICON_NOTE = `<svg class="audio-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`; ta.ICON_NOTE = ICON_NOTE;
  const ICON_PLAY = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.14v13.72a1 1 0 0 0 1.53.85l10.79-6.86a1 1 0 0 0 0-1.7L9.53 4.29A1 1 0 0 0 8 5.14z"/></svg>`; ta.ICON_PLAY = ICON_PLAY;
  const ICON_PAUSE = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6.5" y="5" width="4" height="14" rx="1.2"/><rect x="13.5" y="5" width="4" height="14" rx="1.2"/></svg>`; ta.ICON_PAUSE = ICON_PAUSE;
  const hasVideo = formats.some(ta.formatRules.isVideoFmt); ta.hasVideo = hasVideo;
  // The "plays for the clip duration, loops as needed, WebM/MP4 only" note moves
  // behind the same inline (i) tip the sidebar's input helpers use, so the card
  // stays compact - heading + track picker, with the explanation on demand.
  const audioTip = hasVideo
    ? helpTip('Plays under the clip for its full duration, looping as needed. WebM and MP4 only.')
    : null; ta.audioTip = audioTip;
  // A tool with its own audio slot (assetType 'audio', e.g. the audiogram) always
  // contributes that audio to the export (resolved live from the sidebar pick), and
  // the card becomes two rows: the tool's audio with a level slider, plus an
  // optional mix-in track whose CENTRE level (off/low/full) sets the bed's gain
  // while the tool audio plays - full at the top and tail (section 6.1). "Generate music"
  // composes a seeded ZzFXM tune on-device (engine composeSong → render worker →
  // transient WAV). Tools without an audio slot keep the single-bed card.
  const hasToolAudioInput = runtime
    .getModel()
    .some((i) => i.type === 'asset' && i.assetType === 'audio'); ta.hasToolAudioInput = hasToolAudioInput;
  const toolAudioTip =
    hasToolAudioInput && hasVideo
      ? helpTip(t('Always included when the tool has audio picked. WebM and MP4 only.'))
      : null; ta.toolAudioTip = toolAudioTip;
  const mixTip =
    hasToolAudioInput && hasVideo
      ? helpTip(
          t(
            'Plays at full volume before and after this tool’s audio and eases to the centre volume underneath it.'
          )
        )
      : null; ta.mixTip = mixTip;
  const bedPickHtml = `
        <div class="audio-pick">
          <select class="field-select" data-action="video-audio" aria-label="${hasToolAudioInput ? escapeText(t('Mix-in track')) : 'Audio track'}"
                  title="${hasToolAudioInput ? escapeText(t('Optional track mixed around this tool’s audio, looping if the clip is longer than the track.')) : 'Optional music bed muxed into the recording - plays for the clip duration, looping if the clip is longer than the track.'}">
            <option value="">None</option>
            <option value="__generate__">${escapeText(t('Generate music'))}</option>
          </select>
          <button type="button" class="audio-preview" data-action="audio-preview" title="Preview track" aria-label="Preview track" disabled>${ICON_PLAY}</button>
          <button type="button" class="audio-preview" data-action="audio-regen" hidden title="${escapeText(t('Regenerate music'))}" aria-label="${escapeText(t('Regenerate music'))}">${icon('refresh')}</button>
        </div>
        <div class="audio-fade" data-track-extras style="display:none">
          <label>Fade in <input type="number" data-action="audio-fadein" min="0" max="5" step="0.5" value="1"><span>s</span></label>
          <label>Fade out <input type="number" data-action="audio-fadeout" min="0" max="5" step="0.5" value="1.5"><span>s</span></label>
        </div>`; ta.bedPickHtml = bedPickHtml;
  const audioRow = !hasVideo
    ? ''
    : hasToolAudioInput
      ? `
      <div class="export-audio" data-video-only style="display:${ta.formatRules.isVideoFmt(initialFmt) ? 'flex' : 'none'}">
        <span class="audio-head help-tip-host">${ICON_NOTE}<span>${escapeText(t('This tool’s audio'))}</span>${toolAudioTip!.button}${toolAudioTip!.pop}</span>
        <div class="audio-fade">
          <label>${escapeText(t('Level'))} <input type="number" data-action="audio-tool-level" min="0" max="100" step="5" value="100" aria-label="${escapeText(t('Tool audio level'))}"><span>%</span></label>
        </div>
        <span class="audio-head help-tip-host">${ICON_NOTE}<span>${escapeText(t('Mix in'))}</span>${mixTip!.button}${mixTip!.pop}</span>
        ${bedPickHtml}
        <div class="audio-fade" data-track-extras style="display:none">
          <label>${escapeText(t('Centre volume'))}
            <select class="field-select" data-action="audio-centre" aria-label="${escapeText(t('Centre volume'))}"
                    title="${escapeText(t('The mix-in track’s volume while this tool’s audio is playing. It always plays at full volume before and after.'))}">
              <option value="off">${escapeText(t('Off'))}</option>
              <option value="low" selected>${escapeText(t('Low'))}</option>
              <option value="full">${escapeText(t('Full'))}</option>
            </select>
          </label>
        </div>
      </div>`
      : `
      <div class="export-audio" data-video-only style="display:${ta.formatRules.isVideoFmt(initialFmt) ? 'flex' : 'none'}">
        <span class="audio-head help-tip-host">${ICON_NOTE}<span>Audio track</span>${audioTip!.button}${audioTip!.pop}</span>
        ${bedPickHtml}
        <div class="audio-fade" data-track-extras style="display:none">
          <label>Music level <input type="number" data-action="audio-volume" min="0" max="100" step="5" value="100"><span>%</span></label>
          <label title="When your clip has its own sound, the music dips to this level under it (100% = no ducking).">Duck to <input type="number" data-action="audio-duck" min="0" max="100" step="5" value="35"><span>%</span></label>
        </div>
      </div>`; ta.audioRow = audioRow;
  // Normalize loudness (plans/101 section 2.5): a master target for the WHOLE
  // exported mix - clips and bed together - measured to BS.1770 and applied as
  // one gain before the always-on true-peak limiter. Off by default so existing
  // projects keep their levels; the labels state real platform targets in the
  // correct unit, which almost nobody shipping does.
  const loudnessRow = !hasVideo
    ? ''
    : `
      <div class="export-audio export-loudness" data-video-only style="display:${ta.formatRules.isVideoFmt(initialFmt) ? 'flex' : 'none'}">
        <label>${escapeText(t('Loudness'))}
          <select class="field-select" data-action="audio-normalize" aria-label="${escapeText(t('Loudness'))}"
                  title="${escapeText(t('Normalize the exported mix to a platform loudness target. Off keeps your levels as authored.'))}">
            <option value="off" selected>${escapeText(t('Off'))}</option>
            <option value="-14">${escapeText(t('Streaming'))} (−14 LUFS)</option>
            <option value="-16">${escapeText(t('Podcast'))} (−16 LUFS)</option>
            <option value="-23">${escapeText(t('Broadcast'))} (−23 LUFS)</option>
          </select>
        </label>
      </div>`; ta.loudnessRow = loudnessRow;

  // Captions (plans/180 section 4) - the three layers a moving export can carry, in
  // order of how reliably they reach a viewer.
  //
  //   Burned in    - the caption boxes on the canvas. They are part of the picture, so
  //                  they are always there and cannot be switched off from here; the
  //                  row says so rather than pretending it is a choice.
  //   Embedded     - a soft, player-toggleable WebVTT track beside the audio. WebM
  //                  carries it safely; MP4 stores it as ISO 14496-30 `wvtt`, which
  //                  Safari and QuickTime read and several Windows players ignore. So
  //                  the box follows the container until the user touches it: on for
  //                  WebM, off for MP4, and the MP4 note explains why.
  //   Sidecar      - a .vtt and a .srt beside the film. A render is one Blob, so
  //                  asking for these turns the download into a small zip.
  //
  // Every option is off-by-default for MP4 and adds nothing to a document with no
  // caption boxes and no cached spoken-word text, so an untouched export is unchanged.
  const captionsTip = hasVideo
    ? helpTip(
        t(
          'Captions drawn on the canvas are always part of the picture. An embedded track can be switched off by the viewer’s player; the sidecar files are the ones an editor or a video platform will accept.'
        )
      )
    : null; ta.captionsTip = captionsTip;
  const captionsRow = !hasVideo
    ? ''
    : `
      <div class="export-audio export-captions" data-video-only style="display:${ta.formatRules.isVideoFmt(initialFmt) ? 'flex' : 'none'}">
        <span class="audio-head help-tip-host">${icon('transcript', { className: 'audio-icon' })}<span>${escapeText(t('Captions'))}</span>${captionsTip!.button}${captionsTip!.pop}</span>
        <div class="audio-fade">
          <label title="${escapeText(t('Caption boxes on the canvas are drawn into every frame.'))}">
            <input type="checkbox" class="field-check" checked disabled aria-label="${escapeText(t('Burned in'))}">
            ${escapeText(t('Burned in'))}
          </label>
          <label>
            <input type="checkbox" class="field-check" data-action="captions-embed" ${initialFmt === 'webm' ? 'checked' : ''}>
            ${escapeText(t('Embedded track'))}
          </label>
          <label>
            <input type="checkbox" class="field-check" data-action="captions-sidecar">
            ${escapeText(t('Sidecar .vtt + .srt'))}
          </label>
        </div>
        <p class="section-card__hint" data-captions-mp4-note style="display:${initialFmt === 'mp4' ? 'block' : 'none'}">${escapeText(t('Some players ignore captions inside MP4'))}</p>
      </div>`; ta.captionsRow = captionsRow;

  // WP-B: video quality select (Smaller / Balanced / Best) plus a default-collapsed
  // "Pro settings" disclosure (explicit codec, frame rate, rate mode, encoder hint).
  // Video-only. The quality stop drives the bitrate authority; the pro knobs override
  // the auto ladder / encoder config. Every control is optional - an untouched export
  // takes Balanced + the auto ladder + the encoder defaults, byte-for-byte as before.
  const ICON_SLIDERS = icon('sliders', { size: 14 }); ta.ICON_SLIDERS = ICON_SLIDERS;
  const videoQualityRow = !hasVideo
    ? ''
    : `
      <div class="export-video-quality" data-video-only style="display:${ta.formatRules.isVideoFmt(initialFmt) ? 'flex' : 'none'}">
        <label class="vp-field vq-main"><span>${escapeText(t('Quality'))}</span>
          <select class="field-select field-select--sm" data-action="video-quality" aria-label="${escapeText(t('Video quality'))}">
            <option value="smaller">${escapeText(t('Smaller file'))}</option>
            <option value="balanced" selected>${escapeText(t('Balanced'))}</option>
            <option value="best">${escapeText(t('Best quality'))}</option>
          </select>
        </label>
        <div class="section-card export-pro-settings">
          <button type="button" class="prosettings-head" data-action="prosettings-toggle" aria-expanded="false">${ICON_SLIDERS}<span>${escapeText(t('Pro settings'))}</span></button>
          <div class="prosettings-body" data-prosettings-body style="display:none">
            <label class="vp-field"><span>${escapeText(t('Codec'))}</span>
              <select class="field-select field-select--sm" data-action="video-codec" aria-label="${escapeText(t('Video codec'))}">
                <option value="" selected>${escapeText(t('Auto (best available)'))}</option>
                <option value="av01.0.08M.08">AV1</option>
                <option value="avc1.640033">H.264</option>
                <option value="hvc1.1.6.L93.B0">HEVC</option>
                <option value="vp09.00.10.08">VP9</option>
              </select>
            </label>
            <label class="vp-field"><span>${escapeText(t('Frame rate'))}</span>
              <select class="field-select field-select--sm" data-action="video-fps" aria-label="${escapeText(t('Frame rate'))}">
                <option value="" selected>${escapeText(t('Auto'))}</option>
                <option value="24">24</option>
                <option value="25">25</option>
                <option value="30">30</option>
                <option value="50">50</option>
                <option value="60">60</option>
              </select>
            </label>
            <label class="vp-field"><span>${escapeText(t('Rate mode'))}</span>
              <select class="field-select field-select--sm" data-action="video-bitratemode" aria-label="${escapeText(t('Bitrate mode'))}">
                <option value="" selected>${escapeText(t('VBR (default)'))}</option>
                <option value="constant">${escapeText(t('CBR (constant)'))}</option>
              </select>
            </label>
            <label class="vp-field"><span>${escapeText(t('Encoder'))}</span>
              <select class="field-select field-select--sm" data-action="video-hwaccel" aria-label="${escapeText(t('Hardware acceleration'))}">
                <option value="" selected>${escapeText(t('Auto'))}</option>
                <option value="prefer-hardware">${escapeText(t('Prefer hardware'))}</option>
                <option value="prefer-software">${escapeText(t('Prefer software'))}</option>
              </select>
            </label>
          </div>
        </div>
      </div>`; ta.videoQualityRow = videoQualityRow;

  // Full-page chip - HTML export only. Drops the fixed-size tool-canvas frame so
  // the saved page fills the whole browser window instead of a centred card.
  const hasHtml = formats.includes('html'); ta.hasHtml = hasHtml;
  const htmlChip = hasHtml
    ? `
        <label class="export-option" data-html-only style="display:${initialFmt === 'html' ? 'flex' : 'none'}"
               title="Drop the fixed-size canvas frame so the saved page fills the whole window.">
          <input type="checkbox" class="field-check" data-action="full-page" ${exportDefaults.nostage ? 'checked' : ''}>
          Full page
        </label>`
    : ''; ta.htmlChip = htmlChip;
  // Outline-fonts chip - EMF only. EMF keeps text LIVE by default (real GDI text
  // records, editable in Office / Google Drawings); this forces the old
  // text-as-paths output for when exact glyphs matter more than editability.
  const hasEmf = formats.includes('emf'); ta.hasEmf = hasEmf;
  const emfChip = hasEmf
    ? `
        <label class="export-option" data-emf-only style="display:${initialFmt === 'emf' ? 'flex' : 'none'}"
               title="${escapeText(t('Convert text to vector outlines so it looks identical everywhere. Off, text stays editable in Office and Google Slides but uses whatever fonts that device has.'))}">
          <input type="checkbox" class="field-check" data-action="emf-outline">
          ${t('Outline fonts')}
        </label>`
    : ''; ta.emfChip = emfChip;
  const settingsRow =
    transparentChip || optionChips || htmlChip || emfChip
      ? `<div class="export-settings">${transparentChip}${optionChips}${htmlChip}${emfChip}</div>`
      : ''; ta.settingsRow = settingsRow;

  // Cloud send destinations - the PROVIDER-AGNOSTIC send-target seam
  // (lib/send-target.ts): each built-in is dormant without its own config (e.g.
  // gdrive needs a Google OAuth client id), and a deployment's control plane can add
  // or replace kinds. The container renders per-format via renderSendTargets below.
  // Why this exists at all (the gdrive case): Drive re-types plain web uploads
  // server-side from its extension table (measured 2026-08-18), so an authenticated
  // upload is the one path that arrives an EMF openable in - or converted straight
  // into - Google Drawings, the paste-into-Slides journey.
  //
  // The container is ALWAYS emitted, and hidden while it holds no cards. It used to be
  // conditional on sendTargetsFor() finding something at this instant, which was only
  // sound while the built-ins were registered during boot: they are loaded on demand
  // now (plans/155 Task 3.3, kicked off below), so at this line the registry is
  // legitimately empty on the first panel of the session and a conditional container
  // would decide "no Send section" for a tool that has one. Emitting it costs an empty
  // `hidden` div - the same shape as the ingredient note two rows up.
  const sendRow = '<div data-send-targets hidden></div>'; ta.sendRow = sendRow;

  // Tier 4 - actions. Copy · Save · Share share one equal-width row; Download is
  // the primary CTA, alone on its own full-width line at the very bottom.
  const CLIPBOARD_SVG = `<svg class="copy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>`; ta.CLIPBOARD_SVG = CLIPBOARD_SVG;
  const copyBtn = actions.includes('copy')
    ? jellyActive()
      ? `<jelly-button variant="platinum" data-action="copy" class="copy-btn" title="Copy to clipboard" label="Copy">${CLIPBOARD_SVG}<span>Copy</span></jelly-button>`
      : `<button type="button" data-action="copy" class="btn btn--ghost copy-btn" title="Copy to clipboard">${CLIPBOARD_SVG}<span>Copy</span></button>`
    : ''; ta.copyBtn = copyBtn;
  const saveBtn = actions.includes('save') ? ta.saving.saveBtnHtml() : ''; ta.saveBtn = saveBtn;
  // Download is the primary CTA - jelly mode gives it the accent-fill squish.
  const initialExperience = experience.current?.() ?? {}; ta.initialExperience = initialExperience;
  const downloadLabel =
    initialExperience.downloadLabel ||
    `Download${formats.length === 1 ? ' ' + fmtLabel(formats[0]!) : ''}`; ta.downloadLabel = downloadLabel;
  // Consult the generic export-policy seam (src/lib/export-policy.ts): dormant - or a
  // deployment that withholds nothing - resolves to 'download' and the CTA below is
  // byte-identical to today. When a control plane withholds download but permits an
  // approval request, the primary CTA becomes "Request approval" (Save still saves the
  // session locally); when it withholds both, the CTA is dropped for a small note - no
  // dead button. Gated on actions.includes('download') so a tool with no download
  // action is unaffected. The view holds no control-plane knowledge: it asks the seam
  // what it may offer, and routes "Request approval" through the generic opener.
  const affordance = actions.includes('download')
    ? exportAffordance(getExportPolicy())
    : 'download'; ta.affordance = affordance;
  // Same primary-CTA slot as Download, so it takes the same prominent jelly
  // recipe under the flag (the .download-btn-jelly class is a size/weight hook,
  // not download-specific); the delegated [data-action] handler is unchanged.
  const requestApprovalBtn = jellyActive()
    ? `<jelly-button data-action="request-approval" class="download-btn-jelly">${escapeText(t('Request approval'))}</jelly-button>`
    : `<button type="button" class="btn btn--primary" data-action="request-approval">${escapeText(t('Request approval'))}</button>`; ta.requestApprovalBtn = requestApprovalBtn;
  const downloadBtn = !actions.includes('download')
    ? ''
    : affordance === 'request-approval'
      ? requestApprovalBtn
      : affordance === 'blocked'
        ? ''
        : // The native button's ↓ affordance is a ::before glyph; the bridge strips
          // pseudo-content off jelly hosts (it painted at the host corner, outside
          // the capsule), so the jelly label carries the arrow as plain text.
          jellyActive()
          ? `<jelly-button data-action="download" class="download-btn-jelly">↓ <span data-download-label>${escapeText(downloadLabel)}</span></jelly-button>`
          : `<button type="button" class="btn btn--primary" data-action="download"><span data-download-label>${escapeText(downloadLabel)}</span></button>`; ta.downloadBtn = downloadBtn;
  // The desktop shell's one-shot native-dialog seam (or the browser picker standing
  // in for it). Kept on the context for the export's own bookkeeping; choosing WHERE
  // an exported file is saved is the post-export "Save file…" control now.
  const desktopExport = saveAsBridge(); ta.desktopExport = desktopExport;
  // "Save as" beside Download opens the SAME document dialog the render pill's Save
  // does (a project, or a template) - one label, one meaning - so it renders
  // wherever that dialog exists, not only where a file dialog does.
  const saveAsBtn = saveAsButtonHtml(
    Boolean(experience.openSaveAs && downloadBtn && affordance === 'download')
  ); ta.saveAsBtn = saveAsBtn;
  const blockedNote =
    actions.includes('download') && affordance === 'blocked'
      ? `<p class="export-blocked-note" role="status" style="margin:.2rem 0 0;color:hsl(var(--muted-foreground));font-size:12px;text-align:center">${escapeText(t('Downloading is turned off for this tool on this instance.'))}</p>`
      : ''; ta.blockedNote = blockedNote;
  // Tier 3.5 - "Before you export". LAST of the cards, below every setting and
  // immediately above the buttons: it is not a setting, it is a statement ABOUT
  // the settings, so it must sit under all of them or it would contradict a
  // control the user has not reached yet. Hidden until the engine's rules have
  // something true to say; see views/export-preflight.ts + refreshPreflight().
  const isDesignTool = manifest.id === 'design'; ta.isDesignTool = isDesignTool;
  const notesHandoutRow =
    isDesignTool && formats.includes('pdf')
      ? `
      <div class="section-card export-notes-handout" data-notes-handout-only style="display:${initialFmt === 'pdf' && canvasEl?.querySelector('[data-pdf-page]') ? 'flex' : 'none'}">
        <label class="field-toggle">
          <input type="checkbox" class="field-check" data-action="pdf-notes-handout">
          <span class="notes-handout-head">${icon('transcript', { size: 18 })}<span>${escapeText(t('Speaker notes handout'))}</span></span>
        </label>
        <p class="print-hint">${escapeText(t('Makes a portrait PDF with each slide above its speaker notes. Long notes continue onto extra pages.'))}</p>
      </div>`
      : ''; ta.notesHandoutRow = notesHandoutRow;
  const preflightRow = preflightRowHtml({ force: isDesignTool }); ta.preflightRow = preflightRow;
  // Tier 3.6 - "Cost, worked out from your rate card". After preflight (it consumes
  // preflight's counts) and above the buttons. Chrome only: data-export-hide, never a
  // pixel of the export. Rendered only for a costable job with a card and canShowMoney.
  const costRow = costPanelHtml(); ta.costRow = costRow;
  const secondaryRow = `<div class="export-action-buttons">${copyBtn}${saveBtn}${copyUrlBtn}</div>`; ta.secondaryRow = secondaryRow;
  const downloadRow = downloadBtn
    ? `<div class="export-action-buttons">${saveAsBtn}${downloadBtn}</div>`
    : blockedNote; ta.downloadRow = downloadRow;

  // Audio-capture tools (render.capture:'audio'): the recording is the deliverable,
  // and the format list below only covers the share CARD - so the sheet leads with
  // a "Your recording" card fed by the latest take (lib/audio-take.ts, written by
  // views/record-control.ts). Before any take exists it says plainly what the
  // Download below saves, closing the "Export is not my recording" trap.
  const isAudioCaptureTool = manifest.render.capture === 'audio'; ta.isAudioCaptureTool = isAudioCaptureTool;
  const recordingRow = isAudioCaptureTool
    ? `
      <div class="section-card export-recording" data-recording-row>
        <span class="c2pa-head">${icon('mic', { className: 'c2pa-icon' })}<span>${escapeText(t('Your recording'))}</span></span>
        <div class="export-recording-body" data-recording-body></div>
      </div>`
    : ''; ta.recordingRow = recordingRow;
}

export function paintBar(ta: ActionsCtx): void {
  const { actions, aspectWarnRow, audioRow, captionsRow, cmykRow, costRow, dimsRow, downloadRow, el, exportOpts, fidelityWarnRow, filenameRow, hdrRow, host, initialExperience, isAudioCaptureTool, loudnessRow, manifest, notesHandoutRow, pkgRow, preflightRow, printRow, protectionRow, recordingRow, runtime, secondaryRow, sendRow, settingsRow, timingRow, videoQualityRow } = ta;
  // The action buttons are the sheet's PRIMARY content, so they come FIRST -
  // Copy / Save / Share and Download at the very top, before any setting - and
  // the dock sticks to the top edge so they stay in reach while the long sheets
  // (Print PDF, MP4) are scrolled.
  el.innerHTML = `
    <div class="export-actions-dock">
      <p class="export-outcome-summary" data-export-outcome${initialExperience.summary ? '' : ' hidden'}>${escapeText(initialExperience.summary ?? '')}</p>
      ${manifest.status === 'experimental' ? `<p class="export-experimental-note" role="note">${escapeText(t('This tool is experimental, so every export carries a watermark.'))}</p>` : ''}
      ${secondaryRow}
      ${downloadRow}
      ${actions.includes('download') ? `<p class="export-degraded-note" data-export-degraded role="status" hidden style="margin:.2rem 0 0;color:hsl(var(--muted-foreground));font-size:12px;text-align:center"></p>` : ''}
      ${actions.includes('download') ? `<p class="export-delivery" data-export-delivery role="status" hidden></p>` : ''}
    </div>
    ${actions.includes('download') ? `${recordingRow}${filenameRow}${dimsRow}${timingRow}${aspectWarnRow}${fidelityWarnRow}${notesHandoutRow}${hdrRow}${cmykRow}${printRow}${pkgRow}${protectionRow}<div class="export-ingredient-note" data-ingredient-note hidden></div>${audioRow}${loudnessRow}${captionsRow}${settingsRow}${videoQualityRow}${sendRow}${preflightRow}${costRow}` : ''}
  `;
  void ta.notes.fillIngredientNote();

  // "Your recording" card (audio-capture tools): paints from the shared take
  // registry and repaints when a take arrives or is cleared. Save actions are
  // the same signed paths the stage's post-record bar uses.
  if (isAudioCaptureTool) {
    const recBody = el.querySelector<HTMLElement>('[data-recording-body]');
    const fmtSize = (n: number): string =>
      n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
    const paintRecording = (): void => {
      if (!recBody) return;
      const take = getAudioTake();
      if (!take) {
        recBody.innerHTML = `<p class="export-recording-hint">${escapeText(t('Nothing recorded yet. Record on the canvas first - Download saves the share card image, not audio.'))}</p>`;
        return;
      }
      recBody.innerHTML = `
        <div class="export-recording-actions">
          <button type="button" class="btn btn--primary" data-action="take-mp3">${escapeText(t('Save MP3'))}</button>
          <button type="button" class="btn" data-action="take-native">${escapeText(tRaw('Save .{ext}', { ext: takeNativeExt(take) }))}</button>
          <span class="export-recording-size">${fmtSize(take.blob.size)}</span>
        </div>`;
    };
    paintRecording();
    onAudioTakeChange(paintRecording);
    recBody?.addEventListener('click', async (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]');
      const take = getAudioTake();
      if (!btn || !take) return;
      if (btn.dataset.action === 'take-native') {
        void saveTakeNative(host, take);
        return;
      }
      if (btn.dataset.action === 'take-mp3') {
        const was = btn.textContent;
        btn.disabled = true;
        btn.textContent = t('Encoding…');
        try {
          await saveTakeMp3(host, take);
        } catch (err) {
          host.log('warn', 'export-sheet mp3 transcode failed - saving the native container', {
            error: String(err),
          });
          void saveTakeNative(host, take);
        } finally {
          btn.disabled = false;
          btn.textContent = was;
        }
      }
    });
  }

  exportOpts.forEach((i) => {
    el.querySelector<HTMLInputElement>(`[data-input-id="${escapeText(i.id)}"]`)?.addEventListener(
      'change',
      ({ target }) => runtime.setInput(i.id, (target as HTMLInputElement).checked)
    );
  });

  // The transparency mirror, wired BOTH ways against the one input it reflects.
  // Ticking the chip goes through runtime.setInput, so the canvas repaints under the
  // open sheet - seeing the background go is the whole point of putting it here. And
  // the sidebar still owns the same input, so follow the model back: subscribe fires
  // on every model change, and writing the same boolean onto a checkbox emits no
  // event, so there is no loop between the two views.
  const transparentEl = el.querySelector<HTMLInputElement>('[data-action="transparent-bg"]'); ta.transparentEl = transparentEl as ActionsCtx['transparentEl'];
  if (transparentEl) {
    transparentEl.addEventListener('change', () =>
      runtime.setInput('transparentBg', transparentEl.checked)
    );
    runtime.subscribe(() => {
      transparentEl.checked = Boolean(
        runtime.getModel().find((i) => i.id === 'transparentBg')?.value
      );
    });
  }

  const animParamsEl = el.querySelector<HTMLElement>('[data-anim-params]'); ta.animParamsEl = animParamsEl;
  const ditherEl = el.querySelector<HTMLElement>('[data-gif-only]'); ta.ditherEl = ditherEl;
  const formatEl = el.querySelector<HTMLSelectElement>('[data-action="format"]'); ta.formatEl = formatEl;
  // The grouped-category UI over the hidden select (trigger + accordion panel).
  const formatPicker = wireFormatPicker(el, formatEl, fmtLabel, {
    recommended: initialExperience.recommendedFormats,
  }); ta.formatPicker = formatPicker;
  // The filename placeholder is derived from live input values plus the
  // provenance state, so it goes stale the moment either moves. Re-derive on
  // format/protection changes and every time the sheet opens (views/tool.ts
  // dispatches 'lolly:export-open' on the panel).
  const filenameInputEl = el.querySelector<HTMLInputElement>('[data-action="filename"]'); ta.filenameInputEl = filenameInputEl;
}

export function markupOps(ta: ActionsCtx) {
  return {
    buildFormatOptions: bindOp(ta, buildFormatOptions),
    buildHdrRow: bindOp(ta, buildHdrRow),
    buildPrintAndRows: bindOp(ta, buildPrintAndRows),
    paintBar: bindOp(ta, paintBar),
  };
}
