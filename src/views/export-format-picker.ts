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
 */
import { t } from '../i18n.ts';
import { escape } from '../utils.ts';
import { icon, type IconName } from '../lib/icons.ts';

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
  png: 'image', jpg: 'image', jpeg: 'image', webp: 'image', avif: 'image',
  svg: 'image', svgz: 'image', bmp: 'image', tiff: 'image', ico: 'image',
  pdf: 'document', 'pdf-cmyk': 'document', 'cmyk-tiff': 'document',
  pptx: 'document', penpot: 'document', lolly: 'document', docx: 'document', odt: 'document', html: 'document',
  md: 'document', txt: 'document', csv: 'document', json: 'document',
  ics: 'document', vcf: 'document', srt: 'document', vtt: 'document',
  mp4: 'motion', webm: 'motion', gif: 'motion', apng: 'motion',
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
    aria-label="${escape(t('Export format'))}" aria-haspopup="true"><span data-fmt-trigger-label>${escape(label(current))}</span>${CHEV}</button>`;
}

/** One category block: a plain header + its format chips, always visible. */
function categoryHtml(cat: FormatCategory, members: string[], current: string, label: LabelFn): string {
  const chips = members.map(f =>
    `<button type="button" class="fmt-chip" data-fmt="${escape(f)}" aria-pressed="${f === current}">${icon(iconFor(f), { className: 'fmt-chip-ic', size: 13 })}${escape(label(f))}</button>`
  ).join('');
  return `
    <div class="fmt-cat" data-cat="${cat}">
      <div class="fmt-cat-head">${escape(CATEGORY_LABEL[cat]())}</div>
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
      `<button type="button" class="fmt-chip" data-fmt="${escape(f)}" aria-pressed="${f === current}">${icon(iconFor(f), { className: 'fmt-chip-ic', size: 13 })}${escape(label(f))}</button>`
    ).join('');
    return `<div class="fmt-cat fmt-cat--recommended" data-cat="recommended">
      <div class="fmt-cat-head">${escape(t('Recommended'))}</div>
      <div class="fmt-cat-body">${chips}</div>
    </div>
    <button type="button" class="fmt-show-all" data-fmt-show-all>${escape(t('All formats'))} (${formats.length})</button>`;
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

export function formatPanelHtml(
  formats: string[], current: string, label: LabelFn, recommended: readonly string[] = [],
): string {
  return `<div class="fmt-pop" data-fmt-panel hidden>
    <div class="fmt-pop-head"><strong>${escape(t('Export format'))}</strong><button type="button" data-fmt-close aria-label="${escape(t('Close'))}">×</button></div>
    <div data-fmt-panel-body>${formatPanelInnerHtml(formats, current, label, recommended)}</div>
  </div>`;
}

export interface FormatPickerApi {
  /** Rebuild the dropdown after a narrowing (setFormats) and re-sync the trigger. */
  refresh(formats: string[], current: string): void;
  /** Change the compact first view without changing which formats are available. */
  setRecommended(formats: readonly string[]): void;
}

/**
 * Wire the trigger + dropdown to the (hidden) native select. `root` is the
 * export panel element holding all three. Returns null when the tool has a
 * single format (no select rendered).
 */
export function wireFormatPicker(
  root: HTMLElement, select: HTMLSelectElement | null, label: LabelFn,
  options: { recommended?: readonly string[] } = {},
): FormatPickerApi | null {
  const trigger = root.querySelector<HTMLButtonElement>('[data-fmt-trigger]');
  const panel = root.querySelector<HTMLElement>('[data-fmt-panel]');
  if (!trigger || !panel || !select) return null;
  const doc = trigger.ownerDocument;
  let recommended = [...(options.recommended ?? [])];
  let expanded = false;

  const body = (): HTMLElement => panel.querySelector<HTMLElement>('[data-fmt-panel-body]') ?? panel;
  const paint = (formats: string[], current: string): void => {
    body().innerHTML = formatPanelInnerHtml(formats, current, label, recommended, expanded);
  };

  // Tapping anywhere outside the open dropdown closes it, like any menu.
  const onOutside = (e: Event): void => {
    const target = e.target as Node;
    if (panel.contains(target) || trigger.contains(target)) return;
    setOpen(false);
  };
  const setOpen = (open: boolean): void => {
    if (open) {
      expanded = false;
      paint([...select.options].map(o => o.value), select.value);
    }
    panel.hidden = !open;
    trigger.setAttribute('aria-expanded', String(open));
    if (open) doc.addEventListener('pointerdown', onOutside, true);
    else doc.removeEventListener('pointerdown', onOutside, true);
  };

  const sync = (): void => {
    const cur = select.value;
    const lbl = trigger.querySelector('[data-fmt-trigger-label]');
    if (lbl) lbl.textContent = label(cur);
    panel.querySelectorAll<HTMLButtonElement>('.fmt-chip').forEach(chip => {
      chip.setAttribute('aria-pressed', String(chip.dataset.fmt === cur));
    });
  };

  trigger.addEventListener('click', () => setOpen(panel.hidden));

  panel.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('[data-fmt-close]')) {
      setOpen(false);
      trigger.focus();
      return;
    }
    if ((e.target as HTMLElement).closest('[data-fmt-show-all]')) {
      expanded = true;
      paint([...select.options].map(o => o.value), select.value);
      return;
    }
    const chip = (e.target as HTMLElement).closest<HTMLButtonElement>('.fmt-chip');
    if (chip?.dataset.fmt) {
      select.value = chip.dataset.fmt;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      sync();
      setOpen(false);
      trigger.focus();
    }
  });

  // Escape closes the dropdown first; a second Escape reaches the sheet's own
  // document-level close handler (stopPropagation keeps them sequential).
  const onKey = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape' || panel.hidden) return;
    e.stopPropagation();
    setOpen(false);
    trigger.focus();
  };
  trigger.addEventListener('keydown', onKey);
  panel.addEventListener('keydown', onKey);

  // Programmatic changes (matchExportFormat auto-pick, setFormats fallback)
  // land on the select; mirror them.
  select.addEventListener('change', sync);
  sync();

  return {
    refresh(formats: string[], current: string): void {
      expanded = false;
      paint(formats, current);
      sync();
    },
    setRecommended(formats: readonly string[]): void {
      recommended = [...formats];
      expanded = false;
      paint([...select.options].map(o => o.value), select.value);
      sync();
    },
  };
}
