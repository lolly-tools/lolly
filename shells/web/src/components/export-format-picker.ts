// SPDX-License-Identifier: MPL-2.0
/**
 * Grouped export-format picker.
 *
 * Replaces the flat native <select> UI in the export sheet with the fused
 * "name.format" pill's right half as a trigger button, opening a compact
 * FLOATING dropdown (a context menu, not an in-flow panel - the rows below
 * the filename must never jump). Inside, formats sit under plain-word
 * category headers - Image, Document, Motion, Audio, Other - every section
 * visible at once, each format as a chip carrying a small metaphor glyph.
 * First-time users never meet vector/bitmap jargon at the top level.
 *
 * The native select STAYS in the DOM as the value carrier: every existing
 * listener, the mode-driven narrowing (setFormats) and the matchExportFormat
 * auto-pick keep talking to it unchanged, and this module mirrors it - chips
 * write select.value and dispatch 'change'; a programmatic 'change' re-syncs
 * the chips. Category labels resolve through t() at render time.
 *
 * The dropdown is a mountBodyPopover panel, which owns its open and close: the
 * outside press, Escape, focus back to the trigger, resize, a route change and
 * system Back on a touch device. It mounts in the trigger's own row, where the
 * in-flow panel used to sit, so the rules that dress it from an ancestor (the
 * export sheet's button look, the phone sheet, Batch's wider panel) still apply.
 */
import { t } from '../i18n.ts';
import { escape as escapeText } from '../utils.ts';
import { icon, type IconName } from '../lib/icons.ts';
import { closeButtonHtml } from '../lib/close-button.ts';
import { mountBodyPopover } from './body-popover.ts';

export type FormatCategory = 'image' | 'document' | 'motion' | 'audio' | 'other';

// Display order is fixed; only non-empty categories render.
const CATEGORY_ORDER: FormatCategory[] = ['image', 'document', 'motion', 'audio', 'other'];

const CATEGORY_LABEL: Record<FormatCategory, () => string> = {
  image: () => t('Image'),
  document: () => t('Document'),
  motion: () => t('Motion'),
  audio: () => t('Audio'),
  other: () => t('Other'),
};

// Every format id the shells can offer, sorted into a plain-word drawer.
// Anything unlisted (palette exchanges, fonts, plotter/legacy vector, float
// masters) deliberately reads as Other rather than guessing wrong.
const CATEGORY_OF: Record<string, FormatCategory> = {
  jxl: 'image', 'jxl-lossless': 'image', png: 'image', jpg: 'image', jpeg: 'image', webp: 'image', avif: 'image',
  svg: 'image', svgz: 'image', bmp: 'image', tiff: 'image', ico: 'image',
  pdf: 'document', 'pdf-cmyk': 'document', 'cmyk-tiff': 'document',
  pptx: 'document', penpot: 'document', lolly: 'document', docx: 'document', odt: 'document', html: 'document',
  md: 'document', txt: 'document', csv: 'document', json: 'document',
  ics: 'document', vcf: 'document', srt: 'document', vtt: 'document',
  mp4: 'motion', webm: 'motion', gif: 'motion', apng: 'motion', lottie: 'motion',
  'webp-anim': 'motion', 'svg-anim': 'motion',
  wav: 'audio', mp3: 'audio', m4a: 'audio', aac: 'audio',
  opus: 'audio', ogg: 'audio', flac: 'audio',
};

export const formatCategory = (f: string): FormatCategory => CATEGORY_OF[f] ?? 'other';

// Metaphor glyph per format (lib/icons.ts names), with the category's own
// glyph as the fallback: what KIND of thing comes out, not the codec's name.
const FORMAT_ICON: Record<string, IconName> = {
  svg: 'penTool', svgz: 'penTool',                                  // vector art
  'pdf-cmyk': 'stamp', 'cmyk-tiff': 'stamp', 'eps-cmyk': 'stamp',   // press output
  eps: 'shapes', emf: 'shapes', wmf: 'shapes',                      // placeable vector
  penpot: 'shapes',                                                 // an editable design file, not a page
  dxf: 'scissors',                                                  // cut file
  html: 'globe',
  csv: 'table',
  ics: 'calendar', vcf: 'user',
  srt: 'speech', vtt: 'speech',
  gif: 'animate', apng: 'animate', 'webp-anim': 'animate', 'svg-anim': 'animate',
  exr: 'sunburst', hdr: 'sunburst',                                 // high dynamic range
  zip: 'package', lolly: 'package',
  rpm: 'package', 'tar.gz': 'package',                              // Linux packages (plan 197)
};
const CATEGORY_ICON: Record<FormatCategory, IconName> = {
  image: 'image', document: 'document', motion: 'filmStrip', audio: 'music', other: 'box',
};
const iconFor = (f: string): IconName => FORMAT_ICON[f] ?? CATEGORY_ICON[formatCategory(f)];

const CHEV = icon('chevronDown', { className: 'fmt-chev', size: 14 });

type LabelFn = (f: string) => string;

/** The fused right half of the name.format pill - dressed like the select it replaced. */
export function formatTriggerHtml(current: string, label: LabelFn): string {
  return `<button type="button" class="fmt-trigger" data-fmt-trigger aria-expanded="false"
    aria-label="${escapeText(t('Export format'))}" aria-haspopup="true"><span data-fmt-trigger-label>${escapeText(label(current))}</span>${CHEV}</button>`;
}

/** One category block: a plain header + its format chips, always visible. */
function categoryHtml(cat: FormatCategory, members: string[], current: string, label: LabelFn): string {
  const chips = members.map(f =>
    `<button type="button" class="fmt-chip" data-fmt="${escapeText(f)}" aria-pressed="${f === current}">${icon(iconFor(f), { className: 'fmt-chip-ic', size: 13 })}${escapeText(label(f))}</button>`
  ).join('');
  return `
    <div class="fmt-cat" data-cat="${cat}">
      <div class="fmt-cat-head">${escapeText(CATEGORY_LABEL[cat]())}</div>
      <div class="fmt-cat-body">${chips}</div>
    </div>`;
}

/** The dropdown's inner markup - only categories that actually have members. */
export function formatPanelInnerHtml(
  formats: string[], current: string, label: LabelFn,
  recommended: readonly string[] = [], expanded = false,
): string {
  const rec = [...new Set(recommended)].filter(f => formats.includes(f));
  if (rec.length && rec.length < formats.length && !expanded) {
    // A saved/deep-linked format outside the current recommendation must stay
    // visible: compact means focused, never "your active choice disappeared".
    const members = rec.includes(current) || !formats.includes(current) ? rec : [current, ...rec];
    const chips = members.map(f =>
      `<button type="button" class="fmt-chip" data-fmt="${escapeText(f)}" aria-pressed="${f === current}">${icon(iconFor(f), { className: 'fmt-chip-ic', size: 13 })}${escapeText(label(f))}</button>`
    ).join('');
    return `<div class="fmt-cat fmt-cat--recommended" data-cat="recommended">
      <div class="fmt-cat-head">${escapeText(t('Recommended'))}</div>
      <div class="fmt-cat-body">${chips}</div>
    </div>
    <button type="button" class="fmt-show-all" data-fmt-show-all>${escapeText(t('All formats'))} (${formats.length})</button>`;
  }
  const byCat = new Map<FormatCategory, string[]>();
  for (const f of formats) {
    const c = formatCategory(f);
    byCat.set(c, [...(byCat.get(c) ?? []), f]);
  }
  return CATEGORY_ORDER
    .filter(c => byCat.has(c))
    .map(c => categoryHtml(c, byCat.get(c)!, current, label))
    .join('');
}

/** The open panel's content: the phone sheet's head (hidden on a desktop) and the chips. */
function formatPanelHtml(
  formats: string[], current: string, label: LabelFn, recommended: readonly string[], expanded: boolean,
): string {
  return `<div class="fmt-pop-head"><strong>${escapeText(t('Export format'))}</strong>${closeButtonHtml({ attrs: { 'data-fmt-close': true } })}</div>
    <div data-fmt-panel-body>${formatPanelInnerHtml(formats, current, label, recommended, expanded)}</div>`;
}

/**
 * Where the panel goes: 6px under the trigger's row with the row's end edge, the
 * place the stylesheet gave the in-flow panel, flipped above the row and then
 * clamped when the drop would leave the viewport. A row already nearer an edge
 * than the margin keeps the panel on its own edge.
 *
 * The coordinates go through custom properties rather than inline `top`/`left`,
 * so a phone sheet the stylesheet lays out with `inset` keeps that box. The panel
 * is position:fixed, and the export sheet around it carries a transform, which
 * makes the sheet the box `fixed` resolves against: the panel is measured where
 * the browser drew it and moved by the difference.
 */
export function placeFormatPanel(el: HTMLElement, row: HTMLElement): void {
  const M = 8;
  const GAP = 6;
  const r = row.getBoundingClientRect();
  el.style.setProperty('--fmt-row-w', `${r.width}px`);
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let top = r.bottom + GAP;
  if (h > 0 && top + h > vh - M) {
    const above = r.top - GAP - h;
    top = above >= M ? above : Math.max(M, vh - h - M);
  }
  const rtl = getComputedStyle(row).direction === 'rtl';
  const low = Math.min(M, Math.max(0, r.left));
  const high = vw - Math.min(M, Math.max(0, vw - r.right));
  const left = Math.max(low, Math.min(rtl ? r.left : r.right - w, high - w));
  // Not rounded, here or in the width above: the row sits on fractional pixels, and
  // the in-flow panel followed the row exactly.
  const set = (x: number, y: number): void => {
    el.style.setProperty('--fmt-left', `${x}px`);
    el.style.setProperty('--fmt-top', `${y}px`);
  };
  set(left, top);
  const box = el.getBoundingClientRect();
  if (!box.width && !box.height) return;
  const dx = left - box.left;
  const dy = top - box.top;
  if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) set(left + dx, top + dy);
}

export interface FormatPickerApi {
  destroy(): void;
  /** Rebuild the dropdown after a narrowing (setFormats) and re-sync the trigger. */
  refresh(formats: string[], current: string): void;
  /** Change the compact first view without changing which formats are available. */
  setRecommended(formats: readonly string[]): void;
}

/**
 * Wire the trigger + dropdown to the (hidden) native select. `root` is the
 * export panel element holding both. Returns null when the tool has a
 * single format (no select rendered).
 */
export function wireFormatPicker(
  root: HTMLElement, select: HTMLSelectElement | null, label: LabelFn,
  options: { recommended?: readonly string[] } = {},
): FormatPickerApi | null {
  const trigger = root.querySelector<HTMLButtonElement>('[data-fmt-trigger]');
  if (!trigger || !select) return null;
  const row = trigger.parentElement ?? root;
  let recommended = [...(options.recommended ?? [])];
  let expanded = false;
  let panel: HTMLDivElement | null = null;

  const offered = (): string[] => [...select.options].map(o => o.value);
  const paint = (formats = offered(), current = select.value): void => {
    if (panel) panel.innerHTML = formatPanelHtml(formats, current, label, recommended, expanded);
  };

  const sync = (): void => {
    const cur = select.value;
    const lbl = trigger.querySelector('[data-fmt-trigger-label]');
    if (lbl) lbl.textContent = label(cur);
    panel?.querySelectorAll<HTMLButtonElement>('.fmt-chip').forEach(chip => {
      chip.setAttribute('aria-pressed', String(chip.dataset.fmt === cur));
    });
  };

  const onPanel = (e: MouseEvent): void => {
    if ((e.target as HTMLElement).closest('[data-fmt-close]')) {
      popover.close(true);
      return;
    }
    if ((e.target as HTMLElement).closest('[data-fmt-show-all]')) {
      expanded = true;
      paint();
      return;
    }
    const chip = (e.target as HTMLElement).closest<HTMLButtonElement>('.fmt-chip');
    if (chip?.dataset.fmt) {
      select.value = chip.dataset.fmt;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      sync();
      popover.close(true);
    }
  };

  // Mounted after the trigger in its own row, so Tab still runs trigger, chips, then
  // the rest of the sheet, as it did for the in-flow panel, and focus stays on the
  // trigger when the panel opens. Capture, because the export sheet closes itself on
  // an Escape it hears on document: the panel takes that Escape first, and the sheet
  // closes on the next one.
  const popover = mountBodyPopover(trigger, (el) => {
    panel = el;
    el.dataset.fmtPanel = '';
    expanded = false;
    paint();
    el.addEventListener('click', onPanel);
    return null;
  }, {
    className: 'fmt-pop',
    role: 'none',
    container: row,
    capture: true,
    trapFocus: false,
    trackScroll: true,
    trackSize: true,
    position: (el) => placeFormatPanel(el, row),
    onClose: () => { panel = null; },
  });

  const onTrigger = (): void => {
    if (popover.isOpen()) popover.close(true);
    else popover.open();
  };
  trigger.addEventListener('click', onTrigger);

  // Programmatic changes (matchExportFormat auto-pick, setFormats fallback)
  // land on the select; mirror them.
  select.addEventListener('change', sync);
  sync();

  return {
    destroy(): void {
      popover.close();
      trigger.removeEventListener('click', onTrigger);
      select.removeEventListener('change', sync);
    },
    refresh(formats: string[], current: string): void {
      expanded = false;
      paint(formats, current);
      sync();
    },
    setRecommended(formats: readonly string[]): void {
      recommended = [...formats];
      expanded = false;
      paint();
      sync();
    },
  };
}
