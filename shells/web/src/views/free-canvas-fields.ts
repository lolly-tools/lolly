// SPDX-License-Identifier: MPL-2.0
/**
 * The Design editor's PURE row builders - the markup helpers the one-slot panels
 * (More / Text / Dims / Stroke / Artboards) grew, lifted out so the plan-179 side
 * columns can render the same rows without importing the 12k-line overlay.
 *
 * Plan 179 M3, work package (a)/(c). Everything here is a string builder or a
 * DOM-only helper: no model, no selection, no stage. The one exception is
 * {@link wireSegs}, which attaches click handlers and calls back out - and its
 * `onSet` is REQUIRED here (the overlay's copy defaulted it to its own `setField`
 * closure, which is exactly the coupling this module exists to remove).
 *
 * COPY, NOT MOVE. `free-canvas.ts` still owns its originals while the concurrent
 * M0 work is in flight; `free-canvas-panels-contract.test.ts` pins the markup of
 * both copies to the same literals so the later dedupe slice can prove they are
 * the same builder before deleting one of them. Keep the markup byte-identical:
 * `styles/parts/editor.css` styles `.fc-seg` / `.fc-row` / `.fc-dims-f` and a
 * whitespace drift here is a visual drift there.
 */
import { escape } from '../utils.ts';
import { t, tRaw } from '../i18n.ts';
import { num } from './free-canvas-math.ts';
import { scopeCss, unscopeCss } from '../lib/scope-css.ts';
import type { Box, BoxFieldConfig } from './free-canvas-math.ts';

/**
 * The 24x24 wrapper `free-canvas.ts` uses for its inline glyph strings - copied
 * verbatim, because the lifted rows embed its output and "byte-identical markup"
 * includes the `<svg>` attributes. `lib/icons.ts`'s `icon()` is the registry
 * lookup for NAMED glyphs and emits a different attribute order; this one takes
 * raw path markup, so the two are not interchangeable.
 */
export function svgIcon(paths: string): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

/**
 * The glyph path fragments the lifted rows embed, copied from `free-canvas.ts`'s
 * module-level `SVG` map (which is not exported, and must not grow an export while
 * that file belongs to another slice). Only the entries these builders and the
 * inspector's own rows actually use - not a second copy of the whole map.
 */
export const FIELD_GLYPH = {
  shRect: '<rect x="4" y="6" width="16" height="12"/>',
  shRounded: '<rect x="4" y="6" width="16" height="12" rx="4.5"/>',
  shPill: '<rect x="3" y="7.5" width="18" height="9" rx="4.5"/>',
  shEllipse: '<ellipse cx="12" cy="12" rx="9" ry="7"/>',
  shCircle: '<circle cx="12" cy="12" r="8"/>',
  fitContain: '<rect x="3" y="4.5" width="18" height="15" rx="1.5"/><rect x="8" y="8.5" width="8" height="7" rx="1"/>',
  fitCover: '<rect x="3" y="4.5" width="18" height="15" rx="1.5"/><path d="M3 16l4.5-3.5L11 15l3-2.2L21 18"/><circle cx="8.5" cy="9" r="1.2"/>',
  fitFill: '<rect x="3" y="4.5" width="18" height="15" rx="1.5"/><polyline points="8 9 5.5 12 8 15"/><polyline points="16 9 18.5 12 16 15"/>',
  fitPos: '<rect x="3" y="4.5" width="18" height="15" rx="1.5"/><circle cx="8" cy="8.5" r="1"/><circle cx="12" cy="8.5" r="1"/><circle cx="16" cy="8.5" r="1"/><circle cx="8" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="16" cy="12" r="1"/><circle cx="8" cy="15.5" r="1"/><circle cx="12" cy="15.5" r="1"/><circle cx="16" cy="15.5" r="1"/>',
  radius: '<path d="M5 19V9a4 4 0 0 1 4-4h10"/><line x1="5" y1="19" x2="5" y2="21"/><line x1="3" y1="19" x2="5" y2="19"/>',
  opacity: '<rect x="3.5" y="3.5" width="17" height="17" rx="2.5"/><path d="M12 3.5v17"/><path d="M12 5.5h6.5M12 8.5h8M12 11.5h8M12 14.5h8M12 17.5h6.5"/>',
  blend: '<circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6" opacity="0.5"/>',
  shadowIc: '<rect x="3.5" y="3.5" width="12" height="12" rx="2.5"/><path d="M8.5 20.5h10a2 2 0 0 0 2-2v-10" opacity="0.45"/>',
  strokeIc: '<path d="M4 8h16" stroke-width="4.5"/><path d="M4 16h16" stroke-width="1.3"/>',
  move: '<polyline points="5 9 2 12 5 15"/><polyline points="9 5 12 2 15 5"/><polyline points="15 19 12 22 9 19"/><polyline points="19 9 22 12 19 15"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/>',
  size: '<path d="M9 3H5a2 2 0 0 0-2 2v4"/><path d="M15 3h4a2 2 0 0 1 2 2v4"/><path d="M15 21h4a2 2 0 0 0 2-2v-4"/><path d="M9 21H5a2 2 0 0 1-2-2v-4"/>',
  rotate: '<path d="M21 12a9 9 0 1 1-3-6.7"/><polyline points="21 3 21 8 16 8"/>',
  clip: '<rect x="3" y="3" width="12" height="12" rx="2"/><circle cx="15.5" cy="15.5" r="5.5"/>',
  textL: '<line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="14" y2="12"/><line x1="4" y1="18" x2="17" y2="18"/>',
  textC: '<line x1="4" y1="6" x2="20" y2="6"/><line x1="7" y1="12" x2="17" y2="12"/><line x1="5.5" y1="18" x2="18.5" y2="18"/>',
  textR: '<line x1="4" y1="6" x2="20" y2="6"/><line x1="10" y1="12" x2="20" y2="12"/><line x1="7" y1="18" x2="20" y2="18"/>',
  textT: '<line x1="4" y1="4" x2="20" y2="4"/><line x1="6" y1="9" x2="18" y2="9"/><line x1="8" y1="13" x2="16" y2="13"/>',
  textM: '<line x1="6" y1="8" x2="18" y2="8"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="6" y1="16" x2="18" y2="16"/>',
  textB: '<line x1="4" y1="20" x2="20" y2="20"/><line x1="6" y1="15" x2="18" y2="15"/><line x1="8" y1="11" x2="16" y2="11"/>',
} as const;

/**
 * The perspective-tilt slider range, mirroring `FC_TILT` in `free-canvas.ts`.
 * Declared rather than imported: importing the overlay to read one tuple would
 * pull the whole editor into every consumer of this module (and, once the dedupe
 * slice ships and `free-canvas.ts` imports THIS file, close a cycle).
 */
export const TILT_RANGE: readonly [number, number] = Object.freeze([-75, 75] as const);

/** Finite number clamped to [lo,hi], or the default when not a number (copied from the overlay). */
function clampN(v: unknown, dflt: number, lo: number, hi: number): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  if (!Number.isFinite(n)) return dflt;
  return n < lo ? lo : (n > hi ? hi : n);
}

/**
 * `CSS.escape` where the host has it, else a minimal attribute-selector escape.
 * Read off `window`, never the bare global: a test that injects a jsdom window
 * copies a named list of globals over, and `CSS` is rarely on it, so testing
 * `window.CSS` and then calling bare `CSS.escape` throws a ReferenceError.
 */
function cssEscape(s: unknown): string {
  const css = typeof window !== 'undefined' ? window.CSS : undefined;
  return typeof css?.escape === 'function' ? css.escape(String(s)) : String(s).replace(/["\\]/g, '\\$&');
}

// ── segmented controls ────────────────────────────────────────────────────────

// Segmented icon/label control shared by the Text + More panels. `choices` is
// [value, label, iconSvg?]; data-seg carries the RESOLVED field so wireSegs writes
// it directly. When an entry has an icon it renders as an icon button (tooltip =
// label); otherwise the label text.
//
// `is-on` is the PAINT; `aria-pressed` is the STATE, and both are always written.
// The pre-lift markup carried the class alone, so a screen-reader user heard nine
// unrelated "Anchor image top left" buttons with no way to tell which one was
// current and no confirmation after pressing one. `groupLabel` (optional, and the
// only thing here a caller may omit) names the SET - "Shape", "Image fit" - which
// a per-button label cannot say. Deliberately NOT `role="radiogroup"`/`radio`:
// that contract owes the user arrow-key roving between the options, and a radio
// group without it reads worse than the toggle buttons these have always been.
export function segHtml(field: string, cur: unknown, choices: Array<[string, string, string?]>, groupLabel?: string): string {
  return `<div class="fc-seg" data-seg="${field}"${groupLabel ? ` role="group" aria-label="${escape(groupLabel)}"` : ''}>` +
    choices.map(([v, lbl, ic]) => {
      const on = String(cur) === String(v);
      return `<button type="button" class="fc-seg-btn${on ? ' is-on' : ''}${ic ? ' fc-seg-ic' : ''}" data-v="${v}" data-tip="${escape(lbl)}" aria-label="${escape(lbl)}" aria-pressed="${on}">${ic ? svgIcon(ic) : escape(lbl)}</button>`;
    }).join('') +
    '</div>';
}

// Image-position anchor picker - a 3×3 grid of the CSS `object-position` anchors,
// where the button's CELL is its meaning (top-left cell = anchor top-left). It's a
// `.fc-seg` so wireSegs writes it like any segmented control; the values are literal
// CSS object-position keywords (the hook whitelists them; the exporter reads the
// computed value so SVG/PDF honour the anchor too). Default 'center'.
export const POS9: Array<[string, string]> = [
  ['left top', 'Top left'], ['center top', 'Top'], ['right top', 'Top right'],
  ['left center', 'Left'], ['center', 'Centre'], ['right center', 'Right'],
  ['left bottom', 'Bottom left'], ['center bottom', 'Bottom'], ['right bottom', 'Bottom right'],
];

export function posGridHtml(field: string, cur: string, groupLabel?: string): string {
  return `<div class="fc-seg fc-posgrid" data-seg="${field}"${groupLabel ? ` role="group" aria-label="${escape(groupLabel)}"` : ''}>` +
    POS9.map(([v, lbl]) => `<button type="button" class="fc-seg-btn fc-pos-btn${cur === v ? ' is-on' : ''}" data-v="${v}" data-tip="${escape(t(lbl))}" aria-label="${escape(tRaw('Anchor image {pos}', { pos: t(lbl).toLowerCase() }))}" aria-pressed="${cur === v}"><i></i></button>`).join('') +
    '</div>';
}

/**
 * Wire every `.fc-seg` inside `panel`: clicking a segment marks it `is-on`, moves
 * `aria-pressed` with it, and reports `(field, value)`.
 *
 * The state moves in BOTH vocabularies or the control lies to one of its audiences:
 * repainting the class alone leaves the old segment announced as pressed, and the
 * press itself unconfirmed.
 *
 * `onSet` is REQUIRED (the overlay's copy defaulted to its own `setField`); a
 * shared builder with a default write target is not shared, it is the overlay
 * wearing a different filename.
 */
export function wireSegs(panel: HTMLElement, onSet: (field: string | undefined, v: string | undefined) => void): void {
  panel.querySelectorAll<HTMLElement>('.fc-seg').forEach((segEl) => segEl.querySelectorAll<HTMLButtonElement>('.fc-seg-btn').forEach((btn) => btn.addEventListener('click', () => {
    segEl.querySelectorAll<HTMLElement>('.fc-seg-btn').forEach((x) => {
      const on = x === btn;
      x.classList.toggle('is-on', on);
      x.setAttribute('aria-pressed', String(on));
    });
    onSet(segEl.dataset.seg, btn.dataset.v);
  })));
}

// ── labelled rows ─────────────────────────────────────────────────────────────

// Row with a leading icon label (keeps the "clean up + use icons" intent while
// staying legible). segRow hosts a segmented control; iconRow a slider/select.
export const iconRow = (ic: string, lbl: string, ctrl: string): string => `<label class="fc-row"><span class="fc-row-lbl" data-tip="${escape(lbl)}">${svgIcon(ic)}<span>${lbl}</span></span>${ctrl}</label>`;

export const segRow = (ic: string, lbl: string, seg: string): string => `<div class="fc-row"><span class="fc-row-lbl" data-tip="${escape(lbl)}">${svgIcon(ic)}<span>${lbl}</span></span>${seg}</div>`;

// One labelled number cell: leading axis letter · the field · trailing unit.
export const dimsCell = (label: string, field: string, val: number, min1 = false): string =>
  `<label class="fc-dims-f"><span>${label}</span><input type="number"${min1 ? ' min="1"' : ''} data-dm="${field}" value="${val}"><i>px</i></label>`;

/** One perspective-tilt slider row (`data-mp` = 'rx' | 'ry'), clamped to {@link TILT_RANGE}. */
export const tiltRow = (key: string, lbl: string, cur: number): string =>
  `<label class="fc-row"><span class="fc-row-lbl">${lbl}</span><input type="range" class="field-range" data-mp="${key}" min="${TILT_RANGE[0]}" max="${TILT_RANGE[1]}" value="${cur}"><b data-mp-val="${key}">${cur}</b></label>`;

/** One `<option>`, selected when its value matches `cur` (the helper three panels each had). */
export const opt = (v: string, label: string, cur: unknown): string => `<option value="${v}"${String(cur) === v ? ' selected' : ''}>${label}</option>`;

// ── manifest-driven choice tables ─────────────────────────────────────────────

/** The subset of a manifest field declaration these tables read. */
export interface ChoiceField {
  id?: string;
  options?: Array<{ value?: unknown; label?: unknown }>;
}

const SHAPE_ICON: Record<string, string> = {
  rect: FIELD_GLYPH.shRect, rounded: FIELD_GLYPH.shRounded, pill: FIELD_GLYPH.shPill, ellipse: FIELD_GLYPH.shEllipse, circle: FIELD_GLYPH.shCircle,
};

/**
 * The shape segment's choices, built from the tool's OWN declared shape options -
 * NOT a fixed list - so a tool only ever offers shapes its hooks.js can render
 * (e.g. `circle` is Design only). A known value gets its glyph; anything else
 * falls back to its label text.
 */
export function shapeChoicesFrom(fields: readonly ChoiceField[] | undefined, shapeField: string | undefined): Array<[string, string, string?]> {
  if (!shapeField) return [];
  const def = (fields || []).find((f) => f?.id === shapeField);
  return (def?.options || []).map((o) => [String(o.value ?? ''), t(String(o.label || o.value || '')), SHAPE_ICON[String(o.value ?? '')]] as [string, string, string?]);
}

/**
 * The shadow-target segment's choices, on the same terms: a segmented control marks
 * `is-on` by exact match, so a manifest that declares a fifth target (`depth`) must
 * be read rather than assumed, or a lifted layer opens its Shadow row with every
 * segment off. Falls back to the historical four when the manifest declares none.
 */
export function shadowChoicesFrom(fields: readonly ChoiceField[] | undefined, shadowField: string | undefined): Array<[string, string]> {
  if (!shadowField) return [];
  const def = (fields || []).find((f) => f?.id === shadowField);
  return (def?.options || []).length
    ? (def!.options || []).map((o) => [String(o.value ?? ''), t(String(o.label || o.value || ''))] as [string, string])
    : [['none', t('None')], ['box', t('Box')], ['text', t('Text')], ['content', t('Content')]];
}

// ── frame thumbnails ──────────────────────────────────────────────────────────

/**
 * The custom-property namespaces a rendered page is allowed to read: the brand's semantic
 * colour slots (`brand-vars.ts` writes those onto the tool canvas element), the tool's own
 * `--lolly-*` values, and the typeface stacks. Deliberately not everything, so copying a
 * page's scope onto a thumbnail can never redefine a chrome token on whatever hosts it.
 */
const THUMB_SCOPE_VAR = /^--(?:brand|lolly|font)-/;

/**
 * The paint a cloned page cannot carry on its own. `background-color` and `background-image`
 * are the fill; `color` and `font-family` are inherited, so without them the clone would
 * pick up the host column's chrome text colour and font instead of the canvas's.
 */
const THUMB_PAINT = ['background-color', 'background-image', 'color', 'font-family'] as const;

let nextThumbScope = 0;
const thumbStyles = new WeakMap<HTMLElement, { id: string; source: string; css: string }>();

/** Carry the tool's structural and custom CSS into previews outside its canvas.
 * Cache the re-scoping per canvas/render; each thumbnail remains self-contained. */
function frameThumbStyles(canvas: HTMLElement, media: HTMLElement): HTMLStyleElement | null {
  // Base tool CSS lives in <head>; template/custom CSS lives inside the canvas.
  const sheets = [
    ...canvas.ownerDocument.head.querySelectorAll<HTMLStyleElement>('style[data-lolly-scope]'),
    ...canvas.querySelectorAll<HTMLStyleElement>('style[data-lolly-scope]'),
  ].filter(sheet => canvas.matches(sheet.dataset.lollyScope!));
  if (!sheets.length) return null;
  const source = JSON.stringify(sheets.map(sheet => [sheet.dataset.lollyScope, sheet.textContent]));
  let cached = thumbStyles.get(canvas);
  if (!cached || cached.source !== source) {
    const id = String(++nextThumbScope);
    const scope = `[data-frame-thumb-scope="${id}"]`;
    const css = sheets.map(sheet => scopeCss(unscopeCss(sheet.textContent ?? '', sheet.dataset.lollyScope || '#tool-canvas'), scope)).join('\n');
    cached = { id, source, css };
    thumbStyles.set(canvas, cached);
  }
  media.dataset.frameThumbScope = cached.id;
  const style = document.createElement('style');
  style.textContent = cached.css;
  return style;
}

/**
 * Repaint a cloned page so it shows what the canvas shows.
 *
 * A page's fill is inline but INDIRECT: the inspector stores a brand token as
 * `background: var(--brand-surface)`, and a board with no authored fill gets the tool's
 * `var(--lolly-frame-surface, #ffffff)` default. Both of those names are defined INSIDE the
 * tool canvas - brand-vars.ts sets the brand slots on `#tool-canvas`, and the tool's own
 * stylesheet is scoped to it - so a clone parked in the navigator column resolved neither.
 * The fill computed to nothing, the column's dark background showed straight through, and a
 * pink board read as a near-black rectangle (Andy, 2026-09-03, dark theme).
 *
 * Two steps, because either alone leaves a case dark: copy the custom properties the page
 * consumes off the live element and its ancestors, then write the RESOLVED background over
 * the top, which also covers a fill that came from a stylesheet rather than the style
 * attribute. Transparent is copied as transparent on purpose - a board the user made
 * see-through must not gain the `#ffffff` fallback the missing token would have handed it.
 */
function paintLikeCanvas(src: HTMLElement, clone: HTMLElement): void {
  const vals = new Map<string, string>();
  // Inline declarations first: brand-vars.ts writes the brand slots straight onto the canvas
  // element, and the nearest ancestor wins, exactly as the cascade would resolve them here.
  for (let node: HTMLElement | null = src; node; node = node.parentElement) {
    const decl = node.style;
    for (let i = 0; i < decl.length; i++) {
      const name = decl.item(i);
      if (THUMB_SCOPE_VAR.test(name) && !vals.has(name)) vals.set(name, decl.getPropertyValue(name).trim());
    }
  }
  let computed: CSSStyleDeclaration | null = null;
  try { computed = getComputedStyle(src); } catch { /* no view (detached realm) - the inline read stands */ }
  if (computed) {
    // Only the newest engines enumerate custom properties in a computed style, so the inline
    // walk above is the floor, and this adds whatever the engine is willing to list.
    for (let i = 0; i < computed.length; i++) {
      const name = computed.item(i);
      if (THUMB_SCOPE_VAR.test(name)) vals.set(name, '');
    }
    for (const name of [...vals.keys()]) {
      const v = computed.getPropertyValue(name).trim();
      if (v) vals.set(name, v);
    }
  }
  for (const [name, v] of vals) if (v) clone.style.setProperty(name, v);
  if (!computed) return;
  for (const prop of THUMB_PAINT) {
    const v = computed.getPropertyValue(prop).trim();
    // `none` is the empty answer for background-image; the clone keeps its own value.
    if (v && v !== 'none') clone.style.setProperty(prop, v);
  }
}

/**
 * A still, scaled clone of just THIS frame's rendered page. The template already emits
 * one `.lolly-frame-page[data-frame-id]` per frame (its boxes at frame-LOCAL coords over
 * the frame bg), so cloning that page - not the whole canvas - keeps a list of them
 * O(N), not O(N²): a whole-canvas clone per cell renders every frame N times over and
 * froze big decks. Media is frozen so N thumbnails don't spin N decoders; pointer-inert
 * (the row owns the click). Falls back to a canvas-clip if the page markup isn't present.
 */
export function frameThumb(
  canvasEl: HTMLElement,
  fb: Box,
  cfg: BoxFieldConfig,
  { maxW, maxH }: { maxW: number; maxH: number },
): HTMLElement {
  const fw = Math.max(1, num(fb[cfg.wField])), fh = Math.max(1, num(fb[cfg.hField]));
  const s = Math.min(maxW / fw, maxH / fh);
  const media = document.createElement('div');
  media.className = 'fc-frame-thumb';
  media.style.width = `${Math.round(fw * s)}px`;
  media.style.height = `${Math.round(fh * s)}px`;
  // A page can carry a blend mode (an artboard wears the same paint a box does). Isolate the
  // thumbnail so it blends against its own contents, not against the column behind it.
  media.style.setProperty('isolation', 'isolate');
  const fid = fb[cfg.idField] == null ? '' : String(fb[cfg.idField]);
  const page = fid ? canvasEl.querySelector<HTMLElement>(`.lolly-frame-page[data-frame-id="${cssEscape(fid)}"]`) : null;
  const src = page ?? canvasEl;
  const clone = src.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('style[data-lolly-scope], script, [data-export-hide]').forEach(node => { node.remove(); });
  // The playhead hides clips outside its current time. A board thumbnail shows
  // its contents at rest, while authored display:none / hidden flags stay intact.
  for (const node of [clone, ...clone.querySelectorAll<HTMLElement>('.seq-off, .tl-shot')]) {
    node.classList.remove('seq-off', 'tl-shot');
  }
  clone.removeAttribute('id');
  clone.style.position = 'absolute';
  clone.style.left = '0';
  clone.style.top = '0';
  clone.style.margin = '0';
  clone.style.pointerEvents = 'none';
  clone.style.transformOrigin = 'top left';
  // The clone leaves the canvas scope, so the fill and the brand tokens it reads come with it.
  paintLikeCanvas(src, clone);
  // A frame page is already frame-local (starts at 0,0); the whole-canvas fallback must
  // be shifted so the frame's native rect sits at the thumbnail origin.
  clone.style.transform = page
    ? `scale(${s})`
    : `translate(${-num(fb[cfg.xField]) * s}px, ${-num(fb[cfg.yField]) * s}px) scale(${s})`;
  for (const v of clone.querySelectorAll<HTMLVideoElement>('video')) {
    v.muted = true; v.autoplay = false; v.removeAttribute('autoplay');
    try { v.pause(); } catch { /* not-ready - ignore */ }
  }
  media.appendChild(clone);
  const style = frameThumbStyles(canvasEl, media);
  if (style) media.appendChild(style);
  return media;
}

/**
 * Clamped read of a numeric box field - the Dims panel's `rd`. Kept to two decimals
 * rather than an integer (plans/184 R12): a 793.7 px A4 board must read back as itself,
 * and the cell's own precision decides what is shown.
 */
export function dimOf(b: Box, field: string | undefined, dflt: number): number {
  if (!field) return dflt;
  return Math.round(clampN(b[field], dflt, -100000, 100000) * 100) / 100;
}
