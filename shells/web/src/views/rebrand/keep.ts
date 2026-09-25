// SPDX-License-Identifier: MPL-2.0
/**
 * rebrand: Keep the design (plan 274 sections 0 and 4, mode A; plan 275 close-out
 * section 2.6 and decision 15).
 *
 * Owns `rb.els.modeSlot`, the two-way control (Renovate the layout and Keep the design,
 * shown whenever a project is open), and mode A's work area, `.rb-keep`, which it draws
 * into the shared comparison region `rb.els.compare` (`keepRegion`) and shows while
 * `state.mode` is keep-design; the review's own comparison and the two columns step
 * aside there (rebrand.css). Mode A is the surgical patch of the original file: theme
 * slots, literal colours and typefaces swapped to the design system, every other part of
 * the file passed through byte for byte.
 *
 * The work area follows the Renovate stage's grammar (close-out 2.6): the Result as the
 * hero, the Original as the inset beside the `[Original | Result | Both | Wipe]`
 * segment, the names in the caption row under each slide, and Wipe laying the Result
 * over the Original with a slider under the hero (geometry is unchanged here, so a wipe
 * is honest). Holding the slide, or the backslash key, shows the Original on the hero.
 * The slide shown is the review's selection (`rb.sel.slideId`), which the filmstrip
 * sets in its selection-only mode. The column beside it holds the one summary sentence,
 * Download .pptx and Open the result in Design.
 *
 * The mode control is the panel primitive's segment (`segHtml` with `variant: 'panel'`),
 * the same control the intake draws, with the title "Switch mode". Switching into Keep
 * the design asks first when the project holds decisions, since it recompiles the deck.
 *
 * Both panes are drawn by the engine's `framePreviewSvg`: the Original from
 * `state.faithful`, the Result from `state.keep.preview`, pictures through
 * `rb.controller.mediaHref`. The Result's picture refs are matched to the Original's by
 * layer id first (`keepMediaRemap`): the two decks compile from the same slide and
 * object ids, and the patch never touches media, so a layer holds the same picture on
 * both sides whatever ref scheme the ingest used.
 *
 * Every focusable control carries `data-key`, so a redraw puts focus back on the control
 * it was on (`captureKey`, `restoreKey`). View-only state (the view, the wipe position,
 * a download in flight) lives in a WeakMap keyed by the context, so it survives a redraw
 * and never reaches the controller. The wipe and the hold change attributes and two
 * style values, never the markup.
 */
import '../../styles/parts/panel.css';
import type { CompiledDeckV1, CompiledFrameV1 } from '@lolly-tools/core/rebrand-v1';
import { framePreviewSvg } from '@lolly/engine';
import { confirmDialog } from '../../components/confirm-dialog.ts';
import { customSliderHtml, mountCustomSlider, type MountedSlider } from '../../components/custom-slider.ts';
import { t, tRaw } from '../../i18n.ts';
import type { KeepDesignStateV1, RebrandDownloadV1, RebrandModeV1 } from '../../lib/rebrand/controller-api.ts';
import { KEEP_FAILURE_CODES, type KeepFailureCodeV1 } from '../../lib/rebrand/controller.ts';
import { icon } from '../../lib/icons.ts';
import { segHtml } from '../../lib/seg.ts';
import { escape as htmlEscape } from '../../utils.ts';
import { bindOp, type RbCtx } from './context.ts';

// ─── view-only state ─────────────────────────────────────────────────────────

/** What the stage shows: the Result as hero (the default), the Original, both, or the wipe. */
export type KeepViewV1 = 'original' | 'result' | 'both' | 'wipe';

interface KeepLocal {
  /** Wipe position, 0 to 100: the Result shows to the right of it. */
  wipe: number;
  view: KeepViewV1;
  /** The Original shows on the hero while the slide or the backslash key is held. */
  held: boolean;
  /** A pointer press on the hero waiting to become a hold. */
  arm: { timer: ReturnType<typeof setTimeout>; x: number; y: number; dispose: () => void } | null;
  /** A download or an open in Design is being prepared. */
  busy: 'download' | 'design' | null;
  /** The last download or open did not start. */
  failed: 'download' | 'design' | null;
  /** The keep status last announced, so a settled result is said once. */
  announced: string;
  /** What the mode control last drew, so a redraw of the work area leaves it alone. */
  modeKey: string;
  /** A mode confirm is open, so a second press does not stack another. */
  asking: boolean;
  slider: MountedSlider | null;
}

const LOCAL = new WeakMap<RbCtx, KeepLocal>();

/** The hold hint shows until the first hold of the visit. */
let holdSeen = false;

function localOf(rb: RbCtx): KeepLocal {
  let local = LOCAL.get(rb);
  if (!local) {
    local = { wipe: 50, view: 'result', held: false, arm: null, busy: null, failed: null, announced: '', modeKey: '', asking: false, slider: null };
    LOCAL.set(rb, local);
  }
  return local;
}

/** How long a held pointer waits before the Original shows (the stage's own timings). */
export const KEEP_HOLD_ARM_MS = 250;
export const KEEP_TOUCH_ARM_MS = 300;
/** Movement before the arm fires that reads as a drag or a scroll, not a hold. */
const HOLD_SLOP_PX = 6;

const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

/** A short stable number per object, so the memo key changes when a deck object is replaced. */
const IDENTITY = new WeakMap<object, number>();
let identitySeq = 0;
function identityOf(value: object | null | undefined): number {
  if (!value) return 0;
  let id = IDENTITY.get(value);
  if (id === undefined) {
    identitySeq += 1;
    id = identitySeq;
    IDENTITY.set(value, id);
  }
  return id;
}

// ─── pure helpers (exported for the tests) ───────────────────────────────────

/** "Changed 6 theme colours and 2 fonts." from what the patch reports. */
export function keepSummary(changes: NonNullable<KeepDesignStateV1['changes']>): string {
  const parts: string[] = [];
  if (changes.themeSlots > 0) {
    parts.push(changes.themeSlots === 1 ? tRaw('1 theme colour') : tRaw('{n} theme colours', { n: changes.themeSlots }));
  }
  if (changes.colours > 0) {
    parts.push(changes.colours === 1 ? tRaw('1 slide colour') : tRaw('{n} slide colours', { n: changes.colours }));
  }
  const fonts = changes.fonts.length;
  if (fonts > 0) parts.push(fonts === 1 ? tRaw('1 font') : tRaw('{n} fonts', { n: fonts }));
  const [a, b, c] = parts;
  if (a && b && c) return tRaw('Changed {a}, {b} and {c}.', { a, b, c });
  if (a && b) return tRaw('Changed {a} and {b}.', { a, b });
  if (a) return tRaw('Changed {a}.', { a });
  return tRaw('Nothing in this deck needed changing.');
}

/** Every picture ref a frame's rows name. */
function frameRefs(frame: CompiledFrameV1 | undefined): string[] {
  if (!frame) return [];
  const refs: string[] = [];
  for (const row of frame.layers) {
    const ref = row.image;
    if (typeof ref === 'string' && ref) refs.push(ref);
  }
  return refs;
}

/**
 * Result picture ref to Original picture ref, matched by layer id. A layer that holds a
 * picture on both sides holds the same one, since the patch leaves media alone.
 */
export function keepMediaRemap(before: CompiledFrameV1, after: CompiledFrameV1): Map<string, string> {
  const byId = new Map<string, string>();
  for (const row of before.layers) {
    if (typeof row.id === 'string' && typeof row.image === 'string' && row.image) byId.set(row.id, row.image);
  }
  const out = new Map<string, string>();
  for (const row of after.layers) {
    if (typeof row.id !== 'string' || typeof row.image !== 'string' || !row.image) continue;
    const original = byId.get(row.id);
    if (original && original !== row.image) out.set(row.image, original);
  }
  return out;
}

/** The Result frames the filmstrip drew, by Result frame, so a redraw keeps one object per frame. */
const stripFrames = new WeakMap<CompiledFrameV1, CompiledFrameV1>();

/**
 * The Result frame of one slide for the filmstrip, its pictures named by the Original's
 * refs (`keepMediaRemap`), which are the ones the controller serves. Without this the
 * strip's thumbnails draw the Result's pictures as grey boxes while the stage draws them.
 */
function stripFrame(rb: RbCtx, slideId: string): CompiledFrameV1 | undefined {
  const preview = rb.state.keep.status === 'ready' ? rb.state.keep.preview : undefined;
  const after = preview?.frames.find((frame) => frame.sourceSlideId === slideId);
  const before = rb.state.faithful?.frames.find((frame) => frame.sourceSlideId === slideId);
  if (!after || !before) return after;
  const held = stripFrames.get(after);
  if (held) return held;
  const remap = keepMediaRemap(before, after);
  const out = remap.size === 0 ? after : {
    ...after,
    layers: after.layers.map((row) => {
      const original = typeof row.image === 'string' ? remap.get(row.image) : undefined;
      return original ? { ...row, image: original } : row;
    }),
  };
  stripFrames.set(after, out);
  return out;
}

/**
 * True when the project holds something a person decided in Renovate the layout: a step
 * to undo, a layout or background they set, or an object they answered. Switching into
 * Keep the design asks first then.
 */
export function hasDecisions(rb: RbCtx): boolean {
  if (rb.state.history.canUndo) return true;
  const plan = rb.state.plan;
  if (!plan) return false;
  return plan.slides.some((slide) => slide.layoutSource === 'user'
    || slide.ground !== undefined
    || slide.objects.some((row) => row.author === 'user' || row.decision !== undefined));
}

/** The Original frame of the selected slide, the Result frame from the same slide, and its place in the deck. */
function framePair(rb: RbCtx): { before?: CompiledFrameV1; after?: CompiledFrameV1; index: number; count: number } {
  const faithful: CompiledDeckV1 | null = rb.state.faithful;
  const frames = faithful?.frames ?? [];
  const count = frames.length;
  const selected = rb.sel.slideId;
  const at = selected ? frames.findIndex((frame) => frame.sourceSlideId === selected) : -1;
  const index = at >= 0 ? at : 0;
  const before = frames[index];
  const preview = rb.state.keep.status === 'ready' ? rb.state.keep.preview : undefined;
  const after = before && preview
    ? preview.frames.find((frame) => frame.sourceSlideId === before.sourceSlideId) ?? preview.frames[index]
    : undefined;
  return { before, after, index, count };
}

/** Frame SVG with its hatch pattern id made unique, since several panes draw the same frame id. */
function drawFrame(frame: CompiledFrameV1, href: (ref: string) => string | undefined, scope: string): string {
  const svg = framePreviewSvg(frame, { assetHref: href });
  return svg.replaceAll('id="hatch-', `id="${scope}-hatch-`).replaceAll('url(#hatch-', `url(#${scope}-hatch-`);
}

/**
 * Give each button of a `segHtml` group a `data-key` from its value hook, so a redraw
 * puts focus back on it (`segHtml` stamps no key of its own).
 */
function keySegments(root: HTMLElement, hook: string, prefix: string): void {
  for (const button of root.querySelectorAll<HTMLElement>(`[${hook}]`)) button.dataset.key = `${prefix}-${button.getAttribute(hook) ?? ''}`;
}

/** The `data-key` of the focused control inside `region`, before a redraw. */
function captureKey(region: HTMLElement): string | null {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement) || !region.contains(active)) return null;
  return active.closest<HTMLElement>('[data-key]')?.dataset.key ?? null;
}

/** Focus the control with that key again, unless focus moved somewhere real meanwhile. */
function restoreKey(region: HTMLElement, key: string | null): void {
  if (!key) return;
  const active = document.activeElement;
  if (active instanceof HTMLElement && active !== document.body && active.isConnected) return;
  const all = [...region.querySelectorAll<HTMLElement>('[data-key]')];
  const at = all.findIndex((el) => el.dataset.key === key);
  if (at < 0) return;
  // A control that just became disabled hands focus to its nearest enabled neighbour,
  // so focus never falls back to the page.
  const usable = (el: HTMLElement | undefined): el is HTMLElement => Boolean(el) && !el?.hasAttribute('disabled');
  for (let d = 0; d < all.length; d += 1) {
    const hit = [all[at - d], all[at + d]].find(usable);
    if (hit) {
      hit.focus();
      return;
    }
  }
}

/**
 * Mode A's work area inside the shared comparison region, made on first use. It is an
 * element of its own beside the comparison's markup, so neither module's redraw clears
 * the other's.
 */
export function keepRegion(rb: RbCtx): HTMLElement {
  const region = rb.els.compare;
  const found = region.querySelector<HTMLElement>(':scope > .rb-keep');
  if (found) return found;
  const area = document.createElement('section');
  area.className = 'rb-keep';
  area.setAttribute('aria-label', tRaw('Keep the design'));
  area.hidden = true;
  region.append(area);
  return area;
}

// ─── the mode control ────────────────────────────────────────────────────────

function renderModeSlot(rb: RbCtx): void {
  const slot = rb.els.modeSlot;
  const local = localOf(rb);
  const key = rb.state.project ? rb.state.mode : '';
  if (local.modeKey === key && (key === '' || slot.firstElementChild)) return;
  local.modeKey = key;
  if (!rb.state.project) {
    if (slot.firstElementChild) slot.innerHTML = '';
    return;
  }
  const memo = captureKey(slot);
  // The panel primitive's segment, the same control the intake draws for the same
  // choice. What each mode does is in the intake's line and the project menu's About
  // Renovate and Keep; the title says what pressing does.
  const modes: Array<{ id: RebrandModeV1; label: string }> = [
    { id: 'renovate', label: tRaw('Renovate the layout') },
    { id: 'keep-design', label: tRaw('Keep the design') },
  ];
  slot.innerHTML = segHtml('rb-mode', modes, rb.state.mode, tRaw('Mode'), { variant: 'panel', attr: 'data-mode', extraClass: 'rb-mode-seg' });
  slot.querySelector('.rb-mode-seg')?.setAttribute('title', tRaw('Switch mode'));
  keySegments(slot, 'data-mode', 'mode');
  restoreKey(slot, memo);
}

// ─── the work area ───────────────────────────────────────────────────────────

/**
 * The controller gives each keep failure a code (`KeepFailureCodeV1`); this is the
 * sentence each one shows under the status line. `keep.failed` has none: the status
 * line already says the swap did not work.
 */
const KEEP_FAILURE_WORDS: Record<KeepFailureCodeV1, () => string | null> = {
  'keep.no-patcher': () => tRaw('This version of Lolly cannot change a PowerPoint file.'),
  'keep.no-source': () => tRaw('The original file was not kept on this device, so choose it again to keep the design.'),
  'keep.no-system': () => tRaw('No design system is active.'),
  'keep.not-a-deck': () => tRaw('The file is not a PowerPoint deck Lolly can read.'),
  'keep.failed': () => null,
};

export function keepFailureText(code: string | undefined): string | null {
  const known = KEEP_FAILURE_CODES.find((one) => one === code);
  return known ? KEEP_FAILURE_WORDS[known]() : null;
}

function statusLine(rb: RbCtx): string {
  const { keep, faithful, phase } = rb.state;
  if (!faithful || phase === 'reading' || phase === 'analysing') return tRaw('Reading the slides.');
  if (keep.status === 'failed') return tRaw('The design system could not be swapped into this deck.');
  if (keep.status === 'ready' && keep.changes) return keepSummary(keep.changes);
  if (keep.status === 'ready') return tRaw('The deck with the design system is ready.');
  if (keep.status === 'idle') return tRaw('Not started.');
  return tRaw('Swapping theme, colours and fonts.');
}

/**
 * The Result's caption note: the design system it is in, and that the layout did not
 * move. What changed, counted, is the column's one sentence.
 */
function resultNote(rb: RbCtx): string {
  const name = rb.state.designSystem?.name;
  return name ? tRaw('In {name}, with the layout as it was', { name }) : tRaw('The layout as it was');
}

/** The view the stage can show now: Result and its companions need a Result. */
function shownView(rb: RbCtx, after: CompiledFrameV1 | undefined): KeepViewV1 {
  return after ? localOf(rb).view : 'original';
}

function figure(side: 'before' | 'after', name: string, note: string, art: string, label: string, hint = ''): string {
  return `<figure class="rb-keep-pane" data-pane="${side}">`
    + `<div class="rb-keep-hero" role="img" aria-label="${htmlEscape(label)}">`
    + `<div class="rb-keep-art" aria-hidden="true">${art}</div></div>`
    + `<figcaption class="rb-keep-cap"><strong>${htmlEscape(name)}</strong>`
    + (note ? `<span class="rb-keep-note">${htmlEscape(note)}</span>` : '')
    + hint
    + `</figcaption></figure>`;
}

function stageHtml(rb: RbCtx, pair: ReturnType<typeof framePair>): string {
  const { before, after, index, count } = pair;
  if (!before) return `<p class="rb-keep-empty">${htmlEscape(statusLine(rb))}</p>`;
  const local = localOf(rb);
  const hrefBefore = (ref: string): string | undefined => rb.controller.mediaHref(ref);
  const remap = after ? keepMediaRemap(before, after) : new Map<string, string>();
  const hrefAfter = (ref: string): string | undefined => rb.controller.mediaHref(remap.get(ref) ?? ref);
  const ratio = before.height > 0 ? before.width / before.height : 16 / 9;
  const slide = tRaw('Slide {n} of {count}', { n: index + 1, count });
  const view = shownView(rb, after);
  const original = t('Original');
  const result = t('Result');
  const beforeSvg = drawFrame(before, hrefBefore, 'keep-before');
  const afterSvg = after ? drawFrame(after, hrefAfter, 'keep-after') : '';

  // Row one: the inset (the side the hero does not show) and the segment. Both and Wipe
  // show both slides already, and a phone shows one slide and the segment only.
  let inset = '';
  if (after && (view === 'result' || view === 'original') && !rb.narrow) {
    const other = view === 'result' ? 'original' : 'result';
    inset = `<div class="rb-keep-inset">`
      + `<button type="button" class="rb-keep-inset-art" data-keep-view-to="${other}" data-key="inset" aria-label="${htmlEscape(other === 'original' ? tRaw('Show the Original') : tRaw('Show the Result'))}">`
      + `<span class="rb-keep-art" aria-hidden="true">${other === 'original' ? drawFrame(before, hrefBefore, 'keep-inset') : drawFrame(after, hrefAfter, 'keep-inset')}</span></button>`
      + `<p class="rb-keep-inset-cap"><strong>${other === 'original' ? original : result}</strong><span>${htmlEscape(slide)}</span></p></div>`;
  }
  const views: Array<{ id: KeepViewV1; label: string }> = [
    { id: 'original', label: original },
    { id: 'result', label: result },
    { id: 'both', label: t('Both') },
    { id: 'wipe', label: t('Wipe') },
  ];
  const seg = after
    ? segHtml('rb-keep-view', views, view, t('Show'), { variant: 'panel', attr: 'data-keep-view', extraClass: 'rb-keep-seg' })
    : '';
  const row = inset || seg ? `<div class="rb-keep-row">${inset}${seg}</div>` : '';

  let panes: string;
  if (!after) {
    // No Result yet: the Original alone, named as what it is.
    panes = figure('before', original, slide, beforeSvg, tRaw('Original: {slide}', { slide }));
  } else if (view === 'both') {
    panes = figure('before', original, slide, beforeSvg, tRaw('Original: {slide}', { slide }))
      + figure('after', result, resultNote(rb), afterSvg, tRaw('Result: {slide}', { slide }));
  } else if (view === 'wipe') {
    const wipe = local.wipe;
    panes = `<figure class="rb-keep-pane" data-pane="wipe">`
      + `<div class="rb-keep-hero" role="img" aria-label="${htmlEscape(tRaw('{slide}, original and result', { slide }))}">`
      + `<div class="rb-keep-art" aria-hidden="true">${beforeSvg}</div>`
      + `<div class="rb-keep-art rb-keep-art--after" aria-hidden="true" style="clip-path: inset(0 0 0 ${wipe}%)">${afterSvg}</div>`
      + `<div class="rb-keep-divider" aria-hidden="true" style="left: ${wipe}%"${wipe <= 0 || wipe >= 100 ? ' hidden' : ''}></div></div>`
      + `<figcaption class="rb-keep-cap rb-keep-cap--wipe"><span class="rb-keep-end">${original}</span>`
      + customSliderHtml({ min: 0, max: 100, step: 1, value: wipe, unit: tRaw('percent'), label: tRaw('Wipe between the original and the result'), ticks: false, attrs: 'data-keep-act="wipe" data-key="wipe"' })
      + `<span class="rb-keep-end">${result}</span></figcaption></figure>`;
  } else if (view === 'original') {
    panes = figure('before', original, slide, beforeSvg, tRaw('Original: {slide}', { slide }));
  } else {
    // The Result as the hero with the Original mounted under it, so a hold swaps at
    // once. The key is named where a keyboard is: the tooltip, never the caption.
    const hint = holdSeen
      ? ''
      : `<span class="rb-keep-hint" title="${htmlEscape(tRaw('Hold the \\ key to see the Original.'))}">${htmlEscape(tRaw('Hold the slide to see the Original'))}</span>`;
    panes = `<figure class="rb-keep-pane" data-pane="after">`
      + `<div class="rb-keep-hero" data-hold role="img" aria-label="${htmlEscape(tRaw('Result: {slide}', { slide }))}">`
      + `<div class="rb-keep-art rb-keep-art--before" aria-hidden="true">${beforeSvg}</div>`
      + `<div class="rb-keep-art rb-keep-art--after" aria-hidden="true">${afterSvg}</div></div>`
      + `<figcaption class="rb-keep-cap"><strong data-keep-name>${result}</strong>`
      + `<span class="rb-keep-note" data-keep-note>${htmlEscape(resultNote(rb))}</span>${hint}</figcaption></figure>`;
  }
  return `<div class="rb-keep-cmp" data-show="${view}" data-held="${local.held && view === 'result' ? 'true' : 'false'}" style="--rb-keep-ratio: ${ratio.toFixed(4)}">`
    + `<h2 class="visually-hidden">${htmlEscape(tRaw('Original and result'))}</h2>`
    + row
    + `<div class="rb-keep-panes">${panes}</div>`
    + `</div>`;
}

function panelHtml(rb: RbCtx): string {
  const { keep, phase } = rb.state;
  const local = localOf(rb);
  const reading = phase === 'reading' || phase === 'analysing';
  const status = keep.status === 'failed' ? 'failed' : keep.status === 'ready' ? 'ready' : 'working';
  const rows: string[] = [];
  rows.push(`<p class="rb-keep-status" data-status="${status}">${htmlEscape(statusLine(rb))}</p>`);
  // While the deck is read or the swap runs, the way out stays on screen.
  if (reading || keep.status === 'working') {
    rows.push(`<div class="rb-keep-acts"><button type="button" class="btn btn--ghost" data-keep-act="cancel" data-key="cancel">${t('Cancel')}</button></div>`);
  }
  if (!reading && keep.status === 'idle') {
    rows.push(`<div class="rb-keep-acts"><button type="button" class="btn btn--primary" data-keep-act="start" data-key="start">${t('Start')}</button></div>`);
  }
  if (keep.status === 'failed') {
    const detail = keepFailureText(keep.error);
    if (detail) rows.push(`<p class="lp-help rb-keep-detail">${htmlEscape(detail)}</p>`);
    let acts = `<button type="button" class="btn btn--primary" data-keep-act="retry" data-key="retry">${t('Try again')}</button>`;
    if (keep.error === 'keep.no-source') {
      acts += `<button type="button" class="btn btn--ghost" data-keep-act="pick" data-key="pick">${t('Choose the file again')}</button>`;
    }
    if (keep.error === 'keep.no-system' || !rb.state.designSystem) {
      acts += `<button type="button" class="btn btn--ghost" data-keep-act="studio" data-key="studio">${t('Open the design system studio')}</button>`;
    }
    rows.push(`<div class="rb-keep-acts">${acts}</div>`);
  }
  if (keep.status === 'ready') {
    const busy = local.busy !== null;
    const busyAttr = busy ? ' disabled aria-describedby="rb-keep-busy"' : '';
    rows.push(`<div class="rb-keep-acts rb-keep-acts--stack">`
      + `<button type="button" class="btn btn--primary rb-keep-download" data-keep-act="download" data-key="download"${busyAttr}>${icon('download')}<span>${t('Download .pptx')}</span></button>`
      + `<button type="button" class="btn btn--ghost rb-keep-design" data-keep-act="design" data-key="design"${busyAttr}>${t('Open the result in Design')}</button>`
      + `</div>`);
    if (busy) rows.push(`<p class="lp-help" id="rb-keep-busy">${t('Preparing the file.')}</p>`);
    if (local.failed === 'download') rows.push(`<p class="lp-help rb-keep-detail" role="alert">${t('The download did not start.')}</p>`);
    if (local.failed === 'design') rows.push(`<p class="lp-help rb-keep-detail" role="alert">${t('The result could not be opened in Design.')}</p>`);
  }
  return `<div class="lp rb-keep-panel">`
    + `<div class="lp-head"><h2 class="lp-head-name">${t('Result')}</h2></div>`
    + `<div class="lp-scroll"><div class="lp-rows">${rows.join('')}</div></div>`
    + `</div>`;
}

function renderArea(rb: RbCtx): void {
  const region = keepRegion(rb);
  const local = localOf(rb);
  const memo = captureKey(region);
  const pair = framePair(rb);
  region.innerHTML = `<div class="rb-keep-layout" data-status="${htmlEscape(rb.state.keep.status)}">`
    + `<div class="rb-keep-stagecol">${stageHtml(rb, pair)}</div>`
    + panelHtml(rb)
    + `</div>`;
  keySegments(region, 'data-keep-view', 'view');
  const sliderEl = region.querySelector<HTMLElement>('.rb-keep-cap--wipe .custom-slider');
  local.slider = sliderEl
    ? mountCustomSlider(sliderEl, {
      onInput: (value) => setWipe(rb, value),
      onCommit: (value) => setWipe(rb, value),
    })
    : null;
  restoreKey(region, memo);
}

/** Move the wipe without a redraw: two style values, nothing else. */
export function setWipe(rb: RbCtx, value: number): void {
  const local = localOf(rb);
  local.wipe = Math.min(100, Math.max(0, value));
  // Only the wipe has a wipe to move; the position waits for the next Wipe.
  const stage = keepRegion(rb).querySelector<HTMLElement>('.rb-keep-cmp[data-show="wipe"]');
  const pane = stage?.querySelector<HTMLElement>('.rb-keep-art--after') ?? null;
  const divider = stage?.querySelector<HTMLElement>('.rb-keep-divider') ?? null;
  if (pane) pane.style.clipPath = `inset(0 0 0 ${local.wipe}%)`;
  if (divider) {
    divider.style.left = `${local.wipe}%`;
    // At either end the divider would be a stripe down one edge of the slide.
    divider.hidden = local.wipe <= 0 || local.wipe >= 100;
  }
}

// ─── hold to compare ─────────────────────────────────────────────────────────

/** Show the Original on the hero while held, or the Result again. Attributes only. */
export function setHold(rb: RbCtx, on: boolean): void {
  const local = localOf(rb);
  const cmp = keepRegion(rb).querySelector<HTMLElement>('.rb-keep-cmp[data-show="result"]');
  const next = on && Boolean(cmp) && rb.state.mode === 'keep-design';
  if (local.held === next) return;
  local.held = next;
  if (next && !holdSeen) {
    holdSeen = true;
    cmp?.querySelector('.rb-keep-hint')?.remove();
  }
  if (!cmp) return;
  cmp.dataset.held = next ? 'true' : 'false';
  const name = cmp.querySelector<HTMLElement>('[data-keep-name]');
  const note = cmp.querySelector<HTMLElement>('[data-keep-note]');
  if (name) name.textContent = next ? tRaw('Original') : tRaw('Result');
  if (note) note.hidden = next;
}

function endArm(rb: RbCtx): void {
  const local = localOf(rb);
  const arm = local.arm;
  local.arm = null;
  if (arm) {
    clearTimeout(arm.timer);
    arm.dispose();
  }
  setHold(rb, false);
}

function startArm(rb: RbCtx, e: PointerEvent): void {
  const local = localOf(rb);
  endArm(rb);
  const touch = e.pointerType === 'touch' || e.pointerType === 'pen';
  const onMove = (move: PointerEvent): void => {
    const arm = local.arm;
    if (!arm || local.held) return;
    if (Math.hypot(move.clientX - arm.x, move.clientY - arm.y) > HOLD_SLOP_PX) endArm(rb);
  };
  const onEnd = (): void => endArm(rb);
  const onMenu = (menu: Event): void => {
    // A long press on touch would open the system menu over the picture.
    if (local.arm || local.held) menu.preventDefault();
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onEnd);
  window.addEventListener('pointercancel', onEnd);
  window.addEventListener('blur', onEnd);
  rb.els.compare.addEventListener('contextmenu', onMenu);
  local.arm = {
    timer: setTimeout(() => setHold(rb, true), touch ? KEEP_TOUCH_ARM_MS : KEEP_HOLD_ARM_MS),
    x: e.clientX,
    y: e.clientY,
    dispose: () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
      window.removeEventListener('blur', onEnd);
      rb.els.compare.removeEventListener('contextmenu', onMenu);
    },
  };
}

/** True when a key press belongs to a field, or to a dialog of the app's own. */
function keyIsElsewhere(e: KeyboardEvent): boolean {
  const target = e.target;
  if (target instanceof HTMLElement) {
    if (target.isContentEditable || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return true;
    if (target instanceof HTMLInputElement && !['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file'].includes(target.type)) return true;
  }
  return Boolean(document.querySelector('dialog[open], [aria-modal="true"]:not([hidden])'));
}

/**
 * The backslash key holds the Original. With single-key shortcuts limited (WCAG 2.1.4),
 * it acts only while focus is on the stage or the filmstrip.
 */
function keyHolds(rb: RbCtx, e: KeyboardEvent): boolean {
  if (e.key !== '\\' || e.metaKey || e.ctrlKey || e.altKey) return false;
  if (rb.state.mode !== 'keep-design' || keyIsElsewhere(e)) return false;
  if (rb.keys.singleKeys()) return true;
  const target = e.target instanceof Node ? e.target : null;
  return Boolean(target && (keepRegion(rb).contains(target) || rb.els.strip.contains(target)));
}

function wireHold(rb: RbCtx): void {
  const local = localOf(rb);
  const onDown = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const target = e.target instanceof Element ? e.target : null;
    if (!target?.closest('.rb-keep [data-hold]')) return;
    startArm(rb, e);
  };
  const onKey = (e: KeyboardEvent): void => {
    if (e.defaultPrevented || !rb.els.compare.isConnected) return;
    if (e.key === 'Escape' && (local.held || local.arm)) {
      endArm(rb);
      e.preventDefault();
      return;
    }
    if (!keyHolds(rb, e)) return;
    e.preventDefault();
    if (!e.repeat) setHold(rb, true);
  };
  const onKeyUp = (e: KeyboardEvent): void => {
    if (e.key === '\\' && local.held && !local.arm) setHold(rb, false);
  };
  // A key hold whose key-up never arrives (the window lost focus while the key was down)
  // lets go when the window or the tab does.
  const onAway = (): void => {
    if (local.held && !local.arm) setHold(rb, false);
  };
  const onVisibility = (): void => {
    if (document.visibilityState === 'hidden') onAway();
  };
  rb.els.compare.addEventListener('pointerdown', onDown);
  document.addEventListener('keydown', onKey);
  document.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onAway);
  document.addEventListener('visibilitychange', onVisibility);
  rb.disposers.push(() => {
    endArm(rb);
    rb.els.compare.removeEventListener('pointerdown', onDown);
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onAway);
    document.removeEventListener('visibilitychange', onVisibility);
  });
}

// ─── rendering ───────────────────────────────────────────────────────────────

function announceSettled(rb: RbCtx): void {
  const local = localOf(rb);
  const { status } = rb.state.keep;
  if (rb.state.mode !== 'keep-design' || (status !== 'ready' && status !== 'failed')) {
    if (status === 'working' || status === 'idle') local.announced = '';
    return;
  }
  const key = `${status}:${identityOf(rb.state.keep.preview)}`;
  if (local.announced === key) return;
  local.announced = key;
  rb.announce(statusLine(rb));
}

/** Everything the drawing reads, so a render with nothing new returns at once. */
function keepKey(rb: RbCtx): string {
  const { state } = rb;
  const head = `${state.project ? state.project.id : '-'}|${state.mode}`;
  if (state.mode !== 'keep-design' || !state.source) return head;
  const local = localOf(rb);
  const pair = framePair(rb);
  const refs = [...frameRefs(pair.before), ...frameRefs(pair.after)];
  const ready = refs.map((ref) => (rb.controller.mediaHref(ref) ? '1' : '0')).join('');
  const { keep } = state;
  return [
    head,
    state.phase,
    identityOf(state.faithful),
    keep.status,
    identityOf(keep.preview),
    keep.changes ? JSON.stringify(keep.changes) : '',
    keep.error ?? '',
    state.designSystem?.name ?? '',
    pair.index,
    local.view,
    local.busy ?? '',
    local.failed ?? '',
    rb.narrow,
    ready,
  ].join('|');
}

export function renderKeep(rb: RbCtx): void {
  const key = keepKey(rb);
  if (rb.memo.keep === key) return;
  rb.memo.keep = key;
  renderModeSlot(rb);
  const showing = rb.state.mode === 'keep-design' && Boolean(rb.state.source);
  keepRegion(rb).hidden = !showing;
  if (!showing) endArm(rb);
  if (showing) renderArea(rb);
  announceSettled(rb);
}

/** Force the next render to draw, for a change only this module knows about. */
function redraw(rb: RbCtx): void {
  rb.memo.keep = '';
  renderKeep(rb);
}

export async function downloadKeep(rb: RbCtx): Promise<void> {
  const local = localOf(rb);
  if (local.busy) return;
  local.busy = 'download';
  local.failed = null;
  redraw(rb);
  try {
    const file = await rb.controller.keepDesignDownload();
    if (file) await rb.host.export.download(file.blob, file.filename);
    else local.failed = 'download';
  } catch {
    local.failed = 'download';
  } finally {
    local.busy = null;
    redraw(rb);
  }
}

/**
 * The drop door's way into Design. `openFileInDesign` hands a file to Design's own pptx
 * import without asking again; until the drop door offers it, the result is saved and
 * the person is told where to import it.
 */
type DesignDoor = Pick<typeof import('../../lib/drop-router.ts'), 'takePendingDesignImport'> & {
  openFileInDesign?: (file: File) => void;
};

/** Open the patched deck in Design, through Design's own pptx import. */
export async function openResultInDesign(rb: RbCtx): Promise<void> {
  const local = localOf(rb);
  if (local.busy) return;
  local.busy = 'design';
  local.failed = null;
  redraw(rb);
  let opened = false;
  try {
    const out: RebrandDownloadV1 | null = await rb.controller.keepDesignDownload();
    if (out) {
      const file = new File([out.blob], out.filename, { type: PPTX_MIME });
      const door: DesignDoor = await import('../../lib/drop-router.ts');
      if (door.openFileInDesign) {
        door.openFileInDesign(file);
      } else {
        await rb.host.export.download(out.blob, out.filename);
        rb.announce(tRaw('Downloaded {name}. Import it in Design.', { name: out.filename }));
      }
      opened = true;
    }
  } catch {
    opened = false;
  } finally {
    local.busy = null;
    if (!opened) local.failed = 'design';
    if (rb.els.compare.isConnected) redraw(rb);
  }
}

/** Switch how the stage compares the two slides. The wipe keeps its last position. */
export function setView(rb: RbCtx, view: KeepViewV1): void {
  const local = localOf(rb);
  if (local.view === view) return;
  endArm(rb);
  local.view = view;
  redraw(rb);
}

/**
 * Switch mode. Into Keep the design with decisions on the project, the person is asked
 * first, since the deck is compiled again; the decisions stay with the project.
 */
export function chooseMode(rb: RbCtx, mode: RebrandModeV1): void {
  if (rb.state.mode === mode) return;
  if (mode !== 'keep-design' || !hasDecisions(rb)) {
    void rb.controller.setMode(mode);
    return;
  }
  const local = localOf(rb);
  if (local.asking) return;
  local.asking = true;
  void confirmDialog({
    title: tRaw('Switch to Keep the design?'),
    message: tRaw('Switching to Keep the design recompiles the deck. Your decisions stay with this project.'),
    confirmLabel: tRaw('Switch'),
    danger: false,
  }).then((ok) => {
    local.asking = false;
    if (ok && rb.state.mode !== mode) void rb.controller.setMode(mode);
  });
}

export function wireKeep(rb: RbCtx): void {
  const onMode = (e: MouseEvent): void => {
    const btn = (e.target as Element | null)?.closest<HTMLElement>('.rb-mode-seg [data-mode]');
    const value = btn?.dataset.mode;
    if (value === 'renovate' || value === 'keep-design') rb.keep.chooseMode(value);
  };
  // The comparison region is shared with compare.ts: only a click inside the work area is Keep's.
  const onArea = (e: MouseEvent): void => {
    if (!(e.target instanceof Element) || !e.target.closest('.rb-keep')) return;
    const viewEl = e.target.closest<HTMLElement>('.rb-keep-seg [data-keep-view], [data-keep-view-to]');
    const view = viewEl?.dataset.keepView ?? viewEl?.dataset.keepViewTo;
    if (view === 'original' || view === 'result' || view === 'both' || view === 'wipe') {
      rb.keep.setView(view);
      return;
    }
    const btn = e.target.closest<HTMLButtonElement>('[data-keep-act]');
    if (!btn || btn.disabled) return;
    const act = btn.dataset.keepAct;
    if (act === 'download') void rb.keep.download();
    else if (act === 'design') void rb.keep.openInDesign();
    else if (act === 'cancel') rb.controller.cancel();
    else if (act === 'start' || act === 'retry') void rb.controller.setMode('keep-design');
    else if (act === 'pick') rb.intake.pick();
    else if (act === 'studio') void import('../../nav.ts').then(({ navigateTo }) => navigateTo('#/start'));
  };
  rb.els.modeSlot.addEventListener('click', onMode);
  rb.els.compare.addEventListener('click', onArea);
  wireHold(rb);
  rb.disposers.push(() => {
    rb.els.modeSlot.removeEventListener('click', onMode);
    rb.els.compare.removeEventListener('click', onArea);
    LOCAL.delete(rb);
  });
}

export function keepOps(rb: RbCtx) {
  return {
    wire: bindOp(rb, wireKeep),
    render: bindOp(rb, renderKeep),
    chooseMode: bindOp(rb, chooseMode),
    download: bindOp(rb, downloadKeep),
    openInDesign: bindOp(rb, openResultInDesign),
    setWipe: bindOp(rb, setWipe),
    setView: bindOp(rb, setView),
    hold: bindOp(rb, setHold),
    region: bindOp(rb, keepRegion),
    stripFrame: bindOp(rb, stripFrame),
  };
}
