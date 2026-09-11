// SPDX-License-Identifier: MPL-2.0
/**
 * Preflight in the export panel - "Before you export" (plans/65-preflight-and-cost.md section 8, phase 1).
 *
 * The engine owns the RULES (`engine/src/preflight.ts`, a pure synchronous
 * `preflight(job) -> PreflightReport`); this module owns only the two shell-side
 * halves the engine must never have: turning a report into a VIEW, and writing
 * that view into the panel's DOM. `views/tool-actions.ts` collects the facts.
 *
 * Four decisions that are essential and must not erode:
 *
 * 1. **It is a statement, not a setting**, so it sits LAST in the panel, below
 *    every control it describes and immediately above the Download button. A card
 *    that appears above a control the user is still adjusting is the one that gets
 *    clicked through.
 * 2. **Collapsed by default, always** - never pre-opened on error, no dismiss
 *    control, no auto-focus, no animation, and it never gates Download. The
 *    severity rides the collapsed summary, so "1 to fix" is legible without
 *    opening and opening stays a choice the user makes for a reason. The panel's
 *    own precedent (`.export-protection`) pre-opens only for an explicitly
 *    deep-linked SETTING; a default-on state never opens anything.
 * 3. **A real `<details>`.** `parts/disclosure.css` documents why the other export
 *    cards are JS-toggled instead: they hold INPUTS whose values must survive a
 *    collapse. This card holds no fields, only reading matter, so that reason does
 *    not apply and the native element is strictly better - keyboard toggling, AT
 *    semantics and find-in-page auto-open for free, with no `aria-expanded` to
 *    keep in sync. Escape is NOT intercepted: the export popup owns Escape, and
 *    teaching the disclosure to close on it would make the user press it twice.
 * 4. **`Finding.message` is never printed here.** The engine has no `t()` and must
 *    not gain one, so its messages are the CLI/JSON English and the translation
 *    FALLBACK. The panel translates by finding `id` through {@link COPY} and
 *    re-interpolates from `evidence`. Ids not in the map fall through to the
 *    English `message` - which is the normal, documented path for a new check, not
 *    a defect.
 *
 * There is no currency, rate or price in this module, and none may be added.
 */
import { t, tRaw } from '../i18n.ts';
import { escape } from '../utils.ts';
import { icon, type IconName } from '../lib/icons.ts';
import { PREFLIGHT_FLAG, isFlagOnSync } from '../feature-flags.ts';
import { mountModal, type ModalHandle } from '../components/modal.ts';
import type { Count, Finding, PreflightReport } from '@lolly/engine';

// ─── The view model (pure - this is the tested half) ────────────────────────

/**
 * How a body row is toned.
 *
 * `gap` is its own tone, not a shade of `note`, and that distinction is the point
 * of the whole module. Every named gap carries `severity: 'info'` by the engine's
 * invariant, so toning off severity alone rendered "Lolly could not check this"
 * in exactly the same box as a measured fact - which is most of the way back to
 * omitting it. `gap` is MUTED, never warning-toned: a refusal is not a problem.
 */
export type PreflightTone = 'error' | 'warn' | 'note' | 'gap';

export interface PreflightRow {
  readonly tone: PreflightTone;
  readonly id: string;
  readonly text: string;
}

/** One label/value line. Same anatomy as the /valid view's `fact()`. */
export interface PreflightFact {
  readonly label: string;
  readonly value: string;
}

export interface PreflightView {
  /** False when the report says nothing at all: the card is not rendered. */
  readonly show: boolean;
  readonly tone: 'clean' | 'know' | 'fix';
  readonly verdict: string;
  readonly facts: readonly PreflightFact[];
  readonly rows: readonly PreflightRow[];
}

/** What the shell knows about the job that is not in the report. */
export interface PreflightContext {
  /** The format's display label (`fmtLabel`), never the raw id. */
  readonly formatLabel: string;
  /** e.g. "210 × 297 mm at 300 DPI". Empty string to omit the row. */
  readonly sizeText: string;
  /** e.g. "3 mm". Null when the job carries no bleed setting at all. */
  readonly bleedText?: string | null;
  /** Shell- or tool-specific checks that cannot live in the engine report. */
  readonly additionalRows?: readonly PreflightRow[];
}

// ─── Copy ───────────────────────────────────────────────────────────────────

const evStr = (f: Finding, key: string): string => {
  const v = f.evidence?.[key];
  return v === null || v === undefined ? '' : String(v);
};

/**
 * The translated panel copy, keyed by finding id.
 *
 * DELIBERATELY the minimum set (plan section 8 / the surface brief section 3): the five
 * findings a user can act on. Every other id falls through to `finding.message`,
 * the engine's resolved English - visible, honest, and one export/import cycle
 * away from being translated if it earns it. Each entry costs a chrome string in
 * 26 locales, so a row is added here because someone argued for it.
 */
const COPY: Record<string, (f: Finding) => string> = {
  // (A) The correctness fix. A brand can declare that a spot ink IS a finish. The
  // CMYK sinks no longer give it the swatch's colour build - `FINISH_MASK_CMYK`
  // (engine/src/cmyk-palette.ts) routes every declared finish to 100% K in all four
  // of them - so these strings describe the SHIPPED behaviour, and they name the
  // defect that is actually left: overprint is implemented nowhere, so the finish
  // plate knocks out the artwork under it. Telling the user "your foil will print
  // gold" would send them to fix something that is already fixed.
  'print.finish-separates-as-ink': f => tRaw(
    '“{name}” is a {finish} finish. Lolly writes it as its own named plate with a 100% black process fallback, and it is not overprinted, so it knocks out the artwork beneath it. Agree with your printer how they want the finish supplied before sending this.',
    { name: evStr(f, 'swatch') || evStr(f, 'spotName'), finish: evStr(f, 'finish') },
  ),
  'print.finish-flattened-into-process': f => tRaw(
    '“{name}” is a {finish} finish, and this format has no separation plates. It is written into the process build as solid black, so it is a mask rather than a finish, and it is not overprinted. Supply the finish as its own artwork.',
    { name: evStr(f, 'swatch') || evStr(f, 'spotName'), finish: evStr(f, 'finish') },
  ),
  'print.no-bleed': () => t(
    'This is a print format with bleed set to zero. Artwork that runs to the edge will show a white sliver after trimming.',
  ),
  'print.trim-not-physical': () => t(
    'The page size is in pixels, so there is no trim size and no print area. Set the size in mm, cm or inches.',
  ),
  'plates.no-spots-declared': () => t(
    'This brand declares no spot inks, so there are no spot plates to count.',
  ),
};

/** The sentence to show for `f`: translated by id, else the engine's English. */
export function messageFor(f: Finding): string {
  const fn = COPY[f.id as string];
  if (!fn) return f.message;
  try { return fn(f); } catch { return f.message; }
}

// ─── Number formatting ──────────────────────────────────────────────────────

/** Square metres, at the precision a sheet is actually discussed in. */
const areaText = (n: number): string => {
  if (!Number.isFinite(n)) return '';
  const s = n < 1 ? n.toFixed(4) : n.toFixed(2);
  return `${s.replace(/\.?0+$/, '')} m²`;
};

const areaCount = (report: PreflightReport, box: 'trim' | 'bleed'): Count | undefined =>
  report.counts.find(c => c?.kind === 'area' && c.box === box && Number.isFinite(c.value));

/**
 * The page count, ONLY when it is exact.
 *
 * A ceiling is never promoted into a bare fact row (section 6 rule 4): when the count is
 * a ceiling it stays in the body list, where the engine's own sentence still says
 * "up to". Suppressing the row costs nothing and removes the one place a bound
 * could be laundered.
 */
const exactPages = (report: PreflightReport): Count | undefined =>
  report.counts.find(c => c?.kind === 'pages' && c.bound === 'exact' && Number.isFinite(c.value));

// ─── report → view ──────────────────────────────────────────────────────────

/**
 * Turn a report into everything the card renders. Pure: no DOM, no globals
 * beyond the i18n catalog, so it is the half worth testing.
 */
export function preflightView(report: PreflightReport | null | undefined, ctx: PreflightContext): PreflightView {
  const findings: readonly Finding[] = report?.findings ?? [];
  const additionalRows = ctx.additionalRows ?? [];
  if (findings.length === 0 && additionalRows.length === 0) {
    return { show: false, tone: 'clean', verdict: '', facts: [], rows: [] };
  }

  const fix = findings.filter(f => f.severity === 'error' || f.severity === 'warn').length
    + additionalRows.filter(row => row.tone === 'error' || row.tone === 'warn').length;
  // Counted and NOT-COUNTED are different answers and are never summed into one
  // number. A job where the palette did not resolve, the size is not physical and
  // the stage says nothing used to read "5 things to know", identically to a job
  // where five quantities were successfully measured.
  const gaps = findings.filter(f => !!f.needs).length
    + additionalRows.filter(row => row.tone === 'gap').length;
  const know = findings.filter(f => f.severity !== 'error' && f.severity !== 'warn' && !f.needs).length
    + additionalRows.filter(row => row.tone === 'note').length;

  // Facts first: the counted measurements. Counting IS the feature, so a clean
  // body is never empty - "nothing to fix" with no numbers under it would read as
  // a lint pass rather than a measurement.
  const facts: PreflightFact[] = [];
  if (ctx.formatLabel) facts.push({ label: t('Format'), value: ctx.formatLabel });
  if (ctx.sizeText)    facts.push({ label: t('Size'), value: ctx.sizeText });
  if (ctx.bleedText)   facts.push({ label: t('Bleed'), value: ctx.bleedText });

  const trim = report ? areaCount(report, 'trim') : undefined;
  const bleedArea = report ? areaCount(report, 'bleed') : undefined;
  const pages = report ? exactPages(report) : undefined;
  if (trim)      facts.push({ label: t('Trim'), value: areaText(trim.value) });
  if (bleedArea) facts.push({ label: t('With bleed'), value: areaText(bleedArea.value) });
  if (pages)     facts.push({ label: t('Pages'), value: String(pages.value) });

  // A finding whose number is already a fact row is not repeated in the list.
  // Identity, not shape: `report.counts` holds the very objects the findings
  // carry, so this can never accidentally swallow a different measurement.
  const consumed = new Set<Count>([trim, bleedArea, pages].filter(Boolean) as Count[]);

  const rows: PreflightRow[] = findings
    .filter(f => !(f.count && consumed.has(f.count)))
    .map(f => ({
      // `needs` is read FIRST: it is the honest distinction, and severity is only
      // the fallback for a finding that asserts something.
      tone: (f.needs ? 'gap' : f.severity === 'error' ? 'error' : f.severity === 'warn' ? 'warn' : 'note') as PreflightTone,
      id: String(f.id),
      text: messageFor(f),
    }));
  rows.push(...additionalRows);

  // The summary carries the VERDICT only; the numbers live in the body. Keeping
  // counts out of the header stops it reflowing on every keystroke, and halves
  // the plural-aware string budget.
  //
  // `refuse.output-file-size` is emitted unconditionally by the engine's registry,
  // so `gaps` is never 0 in practice and the "counted" leg is the one that can be.
  // Four strings, inside the plan's 8-12 chrome-string budget.
  const verdict = fix > 0
    ? (gaps > 0
      ? t('{fix} to fix, {gaps} not checked', { fix, gaps })
      : t('{fix} to fix, {know} to know', { fix, know }))
    : gaps > 0
      ? t('{know} counted, {gaps} not checked', { know, gaps })
      : know === 1
        ? t('One thing to know')
        : t('{n} things to know', { n: know });

  return { show: true, tone: fix > 0 ? 'fix' : 'know', verdict, facts, rows };
}

// ─── DOM ────────────────────────────────────────────────────────────────────

/**
 * The preflight CONTROL - a compact row that opens a modal with the full report,
 * rather than an inline body. It reuses the `.section-card` box and the canonical
 * `.section-card-head`/`.section-card-icon` anatomy; hidden until
 * {@link applyPreflight} has something true to say.
 *
 * Why a modal, not the old inline `<details>`: the report grew (trim/bleed
 * geometry, plate counts, ink coverage, effective DPI, cost) past what reads well
 * folded into the export panel. A one-line control with the verdict badge keeps the
 * panel compact; "show all the details" is a click into a focused dialog. The
 * control is a real `<button aria-haspopup="dialog">`; the modal's own Escape /
 * backdrop / focus-trap come from {@link mountModal}. It is still a STATEMENT not a
 * setting, still last in the panel, and still never gates Download.
 */
export function isPreflightEnabled(): boolean {
  return isFlagOnSync(PREFLIGHT_FLAG);
}

export function preflightRowHtml(options: { force?: boolean } = {}): string {
  // A personal opt-in flag, default OFF (an individual exporting a PNG for a chat
  // message must never be ambushed by prepress findings). The profile's Feature
  // flags card turns it on; a control plane governs it through the ordinary flag
  // mechanism (default/hidden, plus the legacy can['export.preflight'] capability
  // that orgFlagGovernance maps onto the flag's default). Read through the
  // synchronous mirror: this renders in the export panel, outside the
  // profile-aware views, and an absent mirror entry must resolve to the flag's
  // own opt-in default rather than failing open.
  if (!options.force && !isPreflightEnabled()) return '';
  return `
      <div class="section-card export-preflight" data-preflight-section style="display:none">
        <button type="button" class="section-card-head preflight-head preflight-open" data-action="preflight-open" aria-haspopup="dialog">
          ${icon('checklist', { className: 'section-card-icon' })}<span>${escape(t('Before you export'))}</span><span class="preflight-verdict" data-preflight-verdict></span>${icon('chevronRight', { className: 'preflight-chevron' })}
        </button>
      </div>`;
}

/**
 * Each row shows TWO marks: a large metaphor for WHAT the check is about (a droplet
 * for ink, stacked plates for separations, a crop frame for bleed/trim), and a
 * small corner badge for its STATUS (alert / info / help). Severity is carried by
 * the badge AND the tone tint - never colour alone, so it survives a colour-blind
 * reader and a monochrome print of the screen.
 *
 * The metaphor is keyed by finding id: an exact entry first, then an id-family
 * prefix, then the card's own checklist glyph as a neutral default. A new engine
 * check with no entry still renders (as the default), so this map never gates a
 * finding - it only enriches the ones it knows.
 */
const METAPHOR_BY_ID: Record<string, IconName> = {
  'print.no-bleed': 'crop', 'print.bleed-unknown': 'crop',
  'print.trim-not-physical': 'crop', 'print.trim-partially-declared': 'crop',
  'refuse.trim-when-unset': 'crop', 'settings.print-marks-on-non-print-format': 'crop',
  'print.geometry': 'resize', 'settings.aspect-guard': 'resize',
  'print.effective-dpi': 'image', 'print.image-effective-dpi': 'image',
  'print.image-dpi-needs-stage': 'image', 'count.raster-pixels': 'image',
  'count.ink-coverage-palette': 'droplet', 'print.ink-over-tac': 'droplet',
  'print.rich-black': 'droplet', 'refuse.ink-coverage': 'droplet',
  'settings.press-profile-on-non-separating-format': 'droplet',
  'plates.palette-unresolved': 'palette',
  'plates.process': 'layers', 'plates.spot-ceiling': 'layers',
  'plates.no-spots-declared': 'layers', 'refuse.exact-separation': 'layers',
  'plates.finish-ceiling': 'sparkle', 'print.finish-separates-as-ink': 'sparkle',
  'print.finish-flattened-into-process': 'sparkle', 'print.finish-unknown-kind': 'sparkle',
  'settings.format-not-offered': 'sliders',
  'settings.hdr-on-unsupported-format': 'sunburst',
  'settings.durable-on-unsupported-format': 'shield',
  'count.sequence-duration': 'clock', 'count.video-duration-declared': 'clock',
  'count.cuts-applies': 'grid', 'count.cuts-inert': 'grid', 'count.cuts-needs-stage': 'grid',
  'refuse.output-file-size': 'package',
  'export.experimental-watermark': 'imprint',
  'design.text.overflow': 'resize',
  'design.text.contrast-low': 'palette',
  'design.text.contrast-review': 'palette',
  'design.font.unembeddable': 'keyboard',
};
const METAPHOR_BY_PREFIX: ReadonlyArray<readonly [string, IconName]> = [
  ['count.pages.', 'document'],
  ['plates.', 'layers'],
  ['input.', 'keyboard'],
  ['print.finish', 'sparkle'],
];
export function metaphorIcon(id: string): IconName {
  if (id in METAPHOR_BY_ID) return METAPHOR_BY_ID[id]!;
  for (const [p, name] of METAPHOR_BY_PREFIX) if (id.startsWith(p)) return name;
  return 'checklist';
}

/** The status glyph on the corner badge: an alert for a warn/error, a help mark
 *  for a gap ("Lolly could not check this" - a refusal, never an alert), an info
 *  mark for a plain note. Tone tint is applied in CSS. */
export function statusIcon(tone: PreflightTone): IconName {
  if (tone === 'warn' || tone === 'error') return 'alert';
  if (tone === 'gap') return 'help';
  return 'info';
}

/** The body markup for `view`. Exported for the test; escaped throughout. */
export function preflightBodyHtml(view: PreflightView): string {
  const facts = view.facts.map(f =>
    `<div class="preflight-fact"><span class="preflight-fact-label">${escape(f.label)}</span><span class="preflight-fact-value">${escape(f.value)}</span></div>`).join('');
  const rows = view.rows.length
    ? `<ul class="preflight-findings">${view.rows.map(r =>
        `<li class="preflight-finding is-${r.tone}" data-finding-id="${escape(r.id)}">`
        + `<span class="preflight-finding-figure">`
        + icon(metaphorIcon(r.id), { className: 'preflight-finding-metaphor' })
        + `<span class="preflight-finding-badge">${icon(statusIcon(r.tone), { className: 'preflight-finding-badge-icon' })}</span>`
        + `</span>`
        + `<span class="preflight-finding-text">${escape(r.text)}</span>`
        + `</li>`).join('')}</ul>`
    : '';
  return facts + rows;
}

// The current view + the open modal (if any), so a refresh keeps both the control's
// verdict and an OPEN dialog live as the user edits the panel behind it.
let currentView: PreflightView | null = null;
let openModal: ModalHandle<void> | null = null;

/** The modal's inner markup for `view` - a titled dialog wrapping the body. */
function preflightModalHtml(view: PreflightView): string {
  return `
    <div class="preflight-modal-head" data-tone="${escape(view.tone)}">
      ${icon('checklist', { className: 'section-card-icon' })}
      <span class="preflight-modal-title">${escape(t('Before you export'))}</span>
      <span class="preflight-verdict" data-preflight-verdict>${escape(view.verdict)}</span>
      <button type="button" class="preflight-modal-close" data-preflight-close aria-label="${escape(t('Close'))}">&#x2715;</button>
    </div>
    <div class="preflight-modal-body" data-preflight-body>${preflightBodyHtml(view)}</div>`;
}

/** Open the details modal for the current view (no-op when there is nothing to show). */
export function openPreflightModal(): void {
  if (!currentView || !currentView.show || openModal) return;
  const handle = mountModal<void>(preflightModalHtml(currentView), {
    className: 'modal preflight-modal',
    ariaLabel: t('Before you export'),
    initialFocus: (el) => el.querySelector<HTMLElement>('[data-preflight-close]'),
    onClose: () => { openModal = null; },
  });
  handle.el.querySelector('[data-preflight-close]')?.addEventListener('click', () => handle.close());
  openModal = handle;
}

/** Wire the panel's preflight control to open the modal. Call once at mount. */
export function wirePreflight(panel: Element | null | undefined): void {
  panel?.querySelector('[data-action="preflight-open"]')?.addEventListener('click', () => openPreflightModal());
}

/**
 * Update the control (show/hide + verdict + tone), and refresh an OPEN modal in
 * place. Never opens the modal, never moves focus, never touches Download.
 */
export function applyPreflight(panel: Element | null | undefined, view: PreflightView): void {
  currentView = view;
  const card = panel?.querySelector<HTMLElement>('[data-preflight-section]');
  if (card) {
    card.style.display = view.show ? 'flex' : 'none';
    if (view.show) {
      card.dataset.tone = view.tone;
      const verdictEl = card.querySelector<HTMLElement>('[data-preflight-verdict]');
      if (verdictEl) verdictEl.textContent = view.verdict;
    }
  }
  // If the dialog is open, keep it live as the user edits behind it; close it if the
  // job stopped having anything to say.
  if (openModal) {
    if (!view.show) { openModal.close(); }
    else { openModal.el.innerHTML = preflightModalHtml(view); openModal.el.querySelector('[data-preflight-close]')?.addEventListener('click', () => openModal?.close()); }
  }
}
