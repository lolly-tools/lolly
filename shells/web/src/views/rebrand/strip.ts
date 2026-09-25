// SPDX-License-Identifier: MPL-2.0
/**
 * rebrand: the filmstrip as a slide sorter (plan 274 section 4, plan 275 section 5,
 * close-out section 3.7).
 *
 * Owns `rb.els.strip`. One thumbnail per slide in deck order from `rb.derived.slides`,
 * drawn from the preview adapter at thumbnail size, windowed so a forty-slide deck
 * never mounts forty previews (`RB_STRIP_OVERSCAN` either side of the visible range).
 * The slides outside the window are two sized spacers, one before and one after, so
 * the scroll range is the whole deck while only the window is in the DOM.
 *
 * The strip is a `listbox` with `aria-multiselectable`: each thumbnail is an `option`
 * whose `aria-selected` says whether it is in the selection and whose `aria-current`
 * marks the slide the comparison shows. Its accessible name carries the slide's
 * number, title, review state, fidelity, whether it needs a look, and its layout. A
 * click selects the slide; Shift extends the selection in deck order, Ctrl or Cmd adds
 * or takes one away (section 5.5). "Select several…" on the menu turns on selection
 * mode for touch, where a tap adds or takes away and a bar over the strip says how many
 * are selected with what to do with them.
 *
 * The menu (section 5.1) is the shared `lib/context-menu.ts`: right click, a long press
 * on touch, Shift+F10 or the Menu key on the focused thumbnail, and the More button at
 * the picture's top corner all open the same nine rows. Inside a multi-selection it is
 * the bulk menu. There is no Delete: a slide is left out, never destroyed. A row that
 * cannot run now stays focusable (`aria-disabled`) with its reason as a second line.
 *
 * A thumbnail is its picture and nothing under it. On the picture: the slide's number
 * in the top start corner (away from the master's logo corner), a dot with a glyph in
 * the top end corner for a slide whose own card needs a look, the More button, and at
 * the bottom end the layout pill (a small wireframe and the layout's name), which opens
 * the layout chooser. More and the pill show on hover, on focus and on the current
 * slide, and only on a fine pointer. The drag that starts anywhere on the picture, and
 * the keyboard move with its bar, are `strip-drag.ts` (`rb.drag`); while a drag runs
 * the strip renders keyed, reusing the nodes it has, so the lifted slide's node and the
 * neighbours' motion survive a scroll that mounts more.
 *
 * In Keep the design (`rb.state.mode` is keep-design) the strip only selects: no menu,
 * no drag, no pill, no dot, no multi-selection; the keys still flick.
 *
 * Every horizontal measure goes through `logicalX` and `scrollStart`, which count from
 * the start edge whatever the direction, since `scrollLeft` is negative in a right to
 * left layout.
 */
import { promptDialog } from '../../components/confirm-dialog.ts';
import { mountModal } from '../../components/modal.ts';
import { t, tRaw } from '../../i18n.ts';
import { menuItemHtml, wireTileContextMenu, type ContextMenuSheetHead, type ContextMenuTarget, type TileContextMenuHandle } from '../../lib/context-menu.ts';
import { ICON_METAPHORS, icon, type IconName } from '../../lib/icons.ts';
import type { RebrandEditOutcomeV1 } from '../../lib/rebrand/controller-api.ts';
import { layoutName, layoutThumb } from '../../lib/slide-structures-ui.ts';
import { escape as htmlEscape } from '../../utils.ts';
import { archetypeThumbSvg } from '../free-canvas/archetype-thumb.ts';
import { bindOp, type RbCtx } from './context.ts';
import { RB_STRIP_OVERSCAN, framesForSlide, readableTitle, selectedSlideIds, unplacedOf } from './shared.ts';

/** Thumbnails taken as visible when the strip cannot be measured (before layout, or in a test). */
export const RB_STRIP_FALLBACK_VISIBLE = 8;

/** Thumbnail pitch in CSS px when none is mounted to measure: a 200 px picture plus the 8 px gap. */
const FALLBACK_PITCH = 208;

/**
 * The width the layout pill draws its wireframe at, in px, before CSS shows it at 16. At
 * or under 40 the shared drawer leaves the content marks out (close-out CP5a), so a small
 * pill never shows a plus.
 */
const PILL_WIREFRAME_WIDTH = 24;

interface StripState {
  /** Index of the first visible thumbnail, used when the strip cannot be measured. */
  start: number;
  pitch: number;
  frame: number;
  /** Selection mode, entered from the menu's "Select several…" row: a tap adds or takes away. */
  selecting: boolean;
  /** Where a Shift range starts: the slide last picked without Shift. */
  anchor: string | null;
  menu: TileContextMenuHandle | null;
}

const states = new WeakMap<RbCtx, StripState>();

function stateOf(rb: RbCtx): StripState {
  let state = states.get(rb);
  if (!state) {
    state = { start: 0, pitch: FALLBACK_PITCH, frame: 0, selecting: false, anchor: null, menu: null };
    states.set(rb, state);
  }
  return state;
}

function scroller(rb: RbCtx): HTMLElement | null {
  return rb.els.strip.querySelector<HTMLElement>('[data-scroll]');
}

function list(rb: RbCtx): HTMLElement | null {
  return rb.els.strip.querySelector<HTMLElement>('[data-list]');
}

// ─── geometry, in the strip's own direction ──────────────────────────────────

/** True when the strip runs right to left. */
export function isRtl(rb: RbCtx): boolean {
  const el = scroller(rb) ?? rb.els.strip;
  const dir = typeof getComputedStyle === 'function' ? getComputedStyle(el).direction : '';
  if (dir === 'rtl' || dir === 'ltr') return dir === 'rtl';
  return el.closest('[dir]')?.getAttribute('dir') === 'rtl';
}

/** How far the strip is scrolled from its start edge, positive in either direction. */
export function scrollStart(rb: RbCtx): number {
  return Math.abs(scroller(rb)?.scrollLeft ?? 0);
}

/** Scroll the strip to `value` px from its start edge. A right to left strip scrolls with a negative `scrollLeft`. */
export function setScrollStart(rb: RbCtx, value: number): void {
  const scroll = scroller(rb);
  if (!scroll) return;
  const max = Math.max(0, scroll.scrollWidth - scroll.clientWidth);
  const next = Math.max(0, Math.min(max, value));
  scroll.scrollLeft = isRtl(rb) ? -next : next;
}

/**
 * A pointer's x as a distance from the start edge of the list, so thumbnail `i` covers
 * `[i * pitch, i * pitch + width)` in either direction and past the mounted window
 * (the spacers are sized in whole pitches).
 */
export function logicalX(rb: RbCtx, clientX: number): number {
  const host = list(rb);
  if (!host) return 0;
  const rect = host.getBoundingClientRect();
  return isRtl(rb) ? rect.right - clientX : clientX - rect.left;
}

/** The pitch of one thumbnail, measured off a mounted one when layout has run. */
export function measurePitch(rb: RbCtx): number {
  const state = stateOf(rb);
  const thumbs = list(rb)?.querySelectorAll<HTMLElement>('.rb-thumb');
  const a = thumbs?.[0];
  const b = thumbs?.[1];
  const gap = a && b ? Math.abs(b.offsetLeft - a.offsetLeft) : 0;
  if (gap > 0) state.pitch = gap;
  else if (a && a.offsetWidth > 0) state.pitch = a.offsetWidth;
  return state.pitch;
}

/** The mounted range: the visible thumbnails plus the overscan either side. */
export function stripWindow(rb: RbCtx, count: number): { from: number; to: number } {
  const state = stateOf(rb);
  const scroll = scroller(rb);
  const pitch = measurePitch(rb);
  const width = scroll?.clientWidth ?? 0;
  const measurable = width > 0 && pitch > 0;
  const start = measurable ? Math.floor(scrollStart(rb) / pitch) : state.start;
  const visible = measurable ? Math.ceil(width / pitch) + 1 : RB_STRIP_FALLBACK_VISIBLE;
  const from = Math.max(0, Math.min(count - 1, start) - RB_STRIP_OVERSCAN);
  const to = Math.min(count - 1, start + visible - 1 + RB_STRIP_OVERSCAN);
  return { from, to: Math.max(from, to) };
}

/** The mounted thumbnail of a slide, or null when it is outside the window. */
export function tileFor(rb: RbCtx, slideId: string): HTMLElement | null {
  const host = list(rb);
  if (!host) return null;
  return [...host.querySelectorAll<HTMLElement>('.rb-thumb[data-slide]')].find((el) => el.dataset.slide === slideId) ?? null;
}

// ─── words ───────────────────────────────────────────────────────────────────

type ThumbKind = 'out' | 'attention' | 'unreviewed' | 'accepted';

/** A slide's state in the words the queue and the report use. */
function stateWord(kind: ThumbKind): string {
  if (kind === 'out') return t('Left out');
  if (kind === 'attention') return t('Needs attention');
  if (kind === 'unreviewed') return t('Not reviewed');
  return t('Accepted');
}

/** The review state's name, for the thumbnail's accessible name. */
function reviewKind(include: boolean, attention: number, unreviewed: number): ThumbKind {
  if (!include) return 'out';
  if (attention > 0) return 'attention';
  return unreviewed > 0 ? 'unreviewed' : 'accepted';
}

/**
 * How faithfully the slide is drawn, for its accessible name, in the Object section's
 * words ("Read as a picture", "Drawn roughly", "Not drawn") said of some of the slide's
 * objects. Empty when every object is editable.
 */
function fidelityWord(fidelity: string): string {
  if (fidelity === 'picture') return t('Some objects are read as pictures');
  if (fidelity === 'approximate') return t('Some objects are drawn roughly');
  if (fidelity === 'unavailable') return t('Some objects are not drawn');
  return '';
}

/**
 * "Slide 4: Pillars", or "Slide 4" when the title is no title. Plain text: every caller
 * escapes it once where it goes into markup, so a title "R&D" is read as "R&D".
 */
function slideTitle(number: number, title: string | undefined): string {
  const own = readableTitle(title);
  return own ? tRaw('Slide {n}: {title}', { n: number, title: own }) : tRaw('Slide {n}', { n: number });
}

/** True in Keep the design, where the strip only selects a slide. */
export function isSelectionOnly(rb: RbCtx): boolean {
  return rb.state.mode === 'keep-design';
}

/**
 * The slides that carry the needs-a-look dot: a slide whose own card waits under Needs
 * attention before Open in Design (a card about this one slide, never a group that spans
 * the deck), or one with an object the compile could place on no slide that is still to
 * answer. When more than
 * half the slides would carry it, none does: a dot on most tiles says nothing the queue
 * does not already say at the top.
 */
export function problemSlides(rb: RbCtx): ReadonlySet<string> {
  const derived = rb.derived;
  if (!derived || isSelectionOnly(rb)) return new Set();
  const pending = new Set(derived.pendingIds);
  const included = new Set(derived.slides.filter((slide) => slide.include).map((slide) => slide.id));
  const out = new Set<string>();
  for (const item of derived.queue) {
    if (item.section !== 'attention' || item.type !== undefined || item.slideIds.length !== 1) continue;
    const [slideId] = item.slideIds;
    if (slideId && included.has(slideId) && item.objectIds.some((id) => pending.has(id))) out.add(slideId);
  }
  // An object the compile could place on no slide, while its card still waits.
  for (const row of unplacedOf(rb.state.preview?.deck, derived, rb.state.source)) {
    if (row.slideId && included.has(row.slideId) && pending.has(row.objectId)) out.add(row.slideId);
  }
  return out.size * 2 > derived.slides.length ? new Set() : out;
}

// ─── drawing ─────────────────────────────────────────────────────────────────

/** Set while a render draws a thumbnail whose picture has not loaded yet. */
const loading = new WeakMap<RbCtx, boolean>();

/**
 * The picture a slide was rebuilt from, as an image, when it has one: a slide left out
 * of the deck or kept as a picture shows as it was (plan 275 decision 29). Empty otherwise.
 */
function recoveryArt(rb: RbCtx, slideId: string): string {
  const ref = rb.state.source?.slides.find((one) => one.id === slideId)?.recovery?.assetRef;
  if (!ref) return '';
  const href = rb.controller.mediaHref(ref);
  if (!href) {
    loading.set(rb, true);
    return '';
  }
  return `<img src="${htmlEscape(href)}" alt="" draggable="false">`;
}

interface ThumbCtx {
  roving: string | null;
  selected: ReadonlySet<string>;
  selecting: boolean;
  /** Keep the design: the thumbnail is a picture to select, with no controls on it. */
  selectionOnly: boolean;
  /** Slides with a problem of their own, which carry the dot. */
  problems: ReadonlySet<string>;
  /** Slides the keyboard move is carrying, which take the lift. */
  moving: ReadonlySet<string>;
  /** The master the layouts are named and drawn from, null while it is being read. */
  master: ReturnType<RbCtx['chooser']['master']>;
  /**
   * The review state more than half the slides share, which their names leave out: a
   * word on most options says nothing, and the ones that differ are the ones named.
   */
  common: ThumbKind | null;
}

/** The picture of one slide: the Result in Keep the design, the Proposed frame otherwise, else the Original. */
function slideArt(rb: RbCtx, slideId: string, include: boolean, arrangement: string | undefined): string {
  const keepDeck = isSelectionOnly(rb) ? rb.state.keep?.preview : undefined;
  const preview = keepDeck ?? rb.state.preview?.deck;
  const faithful = rb.state.faithful;
  const edge = rb.compare.ladder().thumbnailLongEdge;
  if (!keepDeck) {
    const picture = include && arrangement !== 'picture' ? '' : recoveryArt(rb, slideId);
    if (picture) return picture;
  }
  // Keep the design draws the Result with the Original's picture refs, which are the ones served.
  const proposedFrame = keepDeck ? rb.keep.stripFrame(slideId) : include && preview ? framesForSlide(preview.frames, slideId)[0] : undefined;
  const originalFrame = faithful ? framesForSlide(faithful.frames, slideId)[0] : undefined;
  const drawn = preview && proposedFrame
    ? rb.compare.draw(preview, proposedFrame, edge, !keepDeck)
    : faithful && originalFrame ? rb.compare.draw(faithful, originalFrame, edge, false) : null;
  if (!drawn) return '';
  if (drawn.missing) loading.set(rb, true);
  return drawn.svg;
}

/** The arrangement a slide keeps in the plan, when it keeps one. */
function arrangementOf(rb: RbCtx, slideId: string): string | undefined {
  return rb.derived?.plan.slides.find((one) => one.id === slideId)?.arrangement;
}

/**
 * The markup of one thumbnail with `art` as its picture. Nothing in it follows the
 * selection: which slide is current, which are selected and which one takes the Tab
 * stop are set on the mounted node by `markSelection`, so a new selection never
 * rebuilds a picture.
 */
function thumbHtml(rb: RbCtx, index: number, slides: RbSlides, ctx: ThumbCtx, art: string): string {
  const slide = slides[index];
  if (!slide) return '';
  const arrangement = arrangementOf(rb, slide.id);
  const n = slide.number;
  const problem = ctx.problems.has(slide.id);
  const title = slideTitle(n, slide.title);
  const fidelity = fidelityWord(slide.fidelity);
  const kind = reviewKind(slide.include, slide.attention, slide.unreviewed);
  // One name per layout in the filmstrip, the chooser and Design: the shared, translated one.
  // A slide kept in its original arrangement or as a picture is named for that instead.
  const arranged = arrangement === 'original' || arrangement === 'picture' ? arrangement : undefined;
  const layout = arranged ? rb.chooser.arrangementName(arranged, 'state') : layoutName(ctx.master, slide.layout);
  // One word for the slide's state: its own problem when it has one, else the review
  // state unless most slides share it. Plain text throughout, escaped once below.
  const state = problem ? t('Needs a look') : kind === ctx.common ? '' : stateWord(kind);
  let name = state ? tRaw('{slide}, {state}', { slide: title, state }) : title;
  if (fidelity) name = tRaw('{slide}, {fidelity}', { slide: name, fidelity });
  name = tRaw('{slide}, {layout}', { slide: name, layout });
  const id = htmlEscape(slide.id);
  // The tick's check is drawn on every tile and shown by the option's aria-selected.
  const tick = ctx.selecting ? `<span class="rb-thumb-tick" aria-hidden="true">${icon('check')}</span>` : '';
  const out = slide.include ? '' : `<span class="rb-thumb-out" aria-hidden="true">${icon('eyeOff')}</span>`;
  const dot = problem ? `<span class="rb-thumb-dot" aria-hidden="true" title="${htmlEscape(t('Needs a look'))}">${icon('alert')}</span>` : '';
  const controls = ctx.selectionOnly ? '' : moreHtml(id) + (slide.include ? pillHtml(id, slide.layout, layout, arranged, ctx) : '');
  // The hover title sits on the picture, which is hidden from the accessibility tree, so
  // it is never read as a description that repeats the option's name.
  return `<li class="rb-thumb" role="none" data-slide="${id}" data-order="${slide.order}" data-include="${slide.include}"`
    + `${problem ? ' data-problem="true"' : ''}${ctx.moving.has(slide.id) ? ' data-moving="true"' : ''}>`
    + `<div class="rb-thumb-pick" role="option" data-slide="${id}" data-key="pick-${id}" tabindex="-1" aria-selected="false"`
    + ` aria-setsize="${slides.length}" aria-posinset="${index + 1}" aria-label="${htmlEscape(name)}">`
    + `<span class="rb-thumb-art" aria-hidden="true" title="${htmlEscape(tRaw('{slide}, {layout}', { slide: title, layout }))}">${art}</span>`
    + `<span class="rb-thumb-num" aria-hidden="true">${n}</span>`
    + `${dot}${tick}${out}</div>`
    + controls
    + '</li>';
}

type RbSlides = NonNullable<RbCtx['derived']>['slides'];

/** The More button: the slide menu for a pointer. The keyboard has Shift+F10, so it takes no Tab stop. */
function moreHtml(id: string): string {
  return `<button type="button" class="rb-thumb-more" data-more="${id}" tabindex="-1" aria-hidden="true" aria-haspopup="menu"`
    + ` title="${htmlEscape(t('Slide menu'))}">${icon('menuDots', { filled: true })}</button>`;
}

/**
 * The layout pill: the slide's layout as a 16 px wireframe and its name, which opens the
 * chooser. The keyboard has L, so like More it takes no Tab stop. A slide in its original
 * arrangement or kept as a picture is named for that, with no wireframe, since it keeps
 * no layout's boxes. A name too long for the pill is never cut: `fitPills` then shows the
 * wireframe alone, and the title carries the whole name.
 */
function pillHtml(id: string, layoutId: string, layout: string, arranged: string | undefined, ctx: ThumbCtx): string {
  const wire = arranged || !ctx.master ? '' : layoutThumb(ctx.master, layoutId, PILL_WIREFRAME_WIDTH, archetypeThumbSvg);
  return `<button type="button" class="rb-thumb-layout" data-layout-of="${id}" tabindex="-1" aria-hidden="true" aria-haspopup="dialog"`
    + ` title="${htmlEscape(tRaw('Change layout: {layout}', { layout }))}"><span class="rb-thumb-layout-pill">`
    + (wire ? `<span class="rb-thumb-wire">${wire}</span>` : '')
    + `<span class="rb-thumb-layout-name">${htmlEscape(layout)}</span></span></button>`;
}

/** The slides in the order the strip shows them: deck order, or the keyboard move's preview of it. */
function shownSlides(rb: RbCtx): RbSlides {
  const slides = rb.derived?.slides ?? [];
  const order = rb.drag.previewOrder();
  if (!order) return slides;
  const byId = new Map(slides.map((slide) => [slide.id, slide]));
  const moved = order.flatMap((id) => {
    const found = byId.get(id);
    return found ? [found] : [];
  });
  const listed = new Set(order);
  return [...moved, ...slides.filter((slide) => !listed.has(slide.id))];
}

/** The selection the strip marks: the multi-selection, else the current slide. */
function selectionSet(rb: RbCtx): ReadonlySet<string> {
  return new Set(selectedSlideIds(rb.sel, rb.derived?.slides ?? []));
}

/** One element from markup, for the keyed render. */
function nodeFrom(html: string): HTMLElement | null {
  const template = document.createElement('template');
  template.innerHTML = html;
  return template.content.firstElementChild as HTMLElement | null;
}

function spacerHtml(n: number, edge: 'before' | 'after'): string {
  return `<li class="rb-strip-spacer" role="none" aria-hidden="true" data-spacer="${edge}" style="--n:${n}"></li>`;
}

/** What each mounted thumbnail was drawn from: its markup without the picture, and the picture. */
const drawnFrom = new WeakMap<Element, { meta: string; art: string }>();

/** Copy `fresh`'s attributes onto `el`, dropping the ones it no longer has. */
function syncAttributes(el: Element, fresh: Element): void {
  for (const { name } of [...el.attributes]) if (!fresh.hasAttribute(name)) el.removeAttribute(name);
  for (const { name, value } of [...fresh.attributes]) if (el.getAttribute(name) !== value) el.setAttribute(name, value);
}

/**
 * Bring a mounted thumbnail up to `fresh` in place. The tile and its option stay the same
 * elements, so focus, the chooser's anchor and a screen reader's place survive; so does
 * any other child that holds focus (the More button after its menu closes).
 */
function morphTile(el: HTMLElement, fresh: HTMLElement): void {
  syncAttributes(el, fresh);
  const active = document.activeElement;
  const kept = [...el.children].filter((child) => child.classList.contains('rb-thumb-pick') || (active !== null && child.contains(active)));
  const kids = [...fresh.childNodes];
  const twinOf = (child: Element): Element | undefined =>
    kids.find((kid): kid is Element => kid instanceof Element && kid.tagName === child.tagName && kid.className === child.className);
  const pairs = kept.flatMap((child) => {
    const twin = twinOf(child);
    return twin ? [{ child, twin }] : [];
  });
  if (pairs.length === 0) {
    el.replaceChildren(...kids);
    return;
  }
  const keep = new Set<Node>(pairs.map((pair) => pair.child));
  for (const child of [...el.childNodes]) if (!keep.has(child)) child.remove();
  // Lay the fresh children round the kept ones in the fresh order, never moving a kept one.
  let cursor: Node | null = el.firstChild;
  for (const kid of kids) {
    const pair = pairs.find((one) => one.twin === kid);
    if (pair) {
      cursor = pair.child.nextSibling;
      syncAttributes(pair.child, pair.twin);
      // The option's own children hold no focus; the option itself does.
      if (pair.child === active || !pair.child.contains(active)) pair.child.replaceChildren(...pair.twin.childNodes);
      continue;
    }
    el.insertBefore(kid, cursor);
  }
}

/**
 * Put `nodes` in `host` in order with as few moves as it takes, never moving the one that
 * holds focus: taking a focused element out of the document, even for a moment, blurs it,
 * and a screen reader then reads the slide again.
 */
function placeChildren(host: HTMLElement, nodes: HTMLElement[]): void {
  const active = document.activeElement;
  const pinned = active ? nodes.find((node) => node.parentNode === host && node.contains(active)) ?? null : null;
  const at = pinned ? nodes.indexOf(pinned) : nodes.length;
  let cursor: ChildNode | null = host.firstChild;
  const place = (list: HTMLElement[], stop: ChildNode | null): void => {
    for (const node of list) {
      if (node === cursor) {
        cursor = cursor.nextSibling;
        continue;
      }
      host.insertBefore(node, cursor);
    }
    while (cursor && cursor !== stop) {
      const next: ChildNode | null = cursor.nextSibling;
      cursor.remove();
      cursor = next;
    }
  };
  place(nodes.slice(0, at), pinned);
  if (!pinned) return;
  cursor = pinned.nextSibling;
  place(nodes.slice(at + 1), null);
}

/** A spacer for the slides outside the window, reusing the mounted one. */
function spacerNode(host: HTMLElement, n: number, edge: 'before' | 'after'): HTMLElement | null {
  const spacer = host.querySelector<HTMLElement>(`[data-spacer="${edge}"]`) ?? nodeFrom(spacerHtml(n, edge));
  spacer?.style.setProperty('--n', String(n));
  return spacer;
}

/** Set or clear a boolean data attribute, touching the node only when it changes. */
function flag(el: Element, name: string, on: boolean): void {
  if (on && el.getAttribute(name) !== 'true') el.setAttribute(name, 'true');
  else if (!on && el.hasAttribute(name)) el.removeAttribute(name);
}

/** Mark the current slide, the selection and the one Tab stop on the mounted thumbnails. */
function markSelection(rb: RbCtx, nodes: HTMLElement[], ctx: ThumbCtx): void {
  for (const node of nodes) {
    const id = node.dataset.slide;
    if (!id) continue;
    const current = rb.sel.slideId === id;
    const selected = ctx.selected.has(id);
    flag(node, 'data-current', current);
    flag(node, 'data-selected', selected);
    const pick = node.querySelector<HTMLElement>('.rb-thumb-pick');
    if (!pick) continue;
    const tab = ctx.roving === id ? '0' : '-1';
    if (pick.getAttribute('tabindex') !== tab) pick.setAttribute('tabindex', tab);
    if (pick.getAttribute('aria-selected') !== String(selected)) pick.setAttribute('aria-selected', String(selected));
    if (current && pick.getAttribute('aria-current') !== 'true') pick.setAttribute('aria-current', 'true');
    else if (!current) pick.removeAttribute('aria-current');
  }
}

/**
 * Draw the window keyed by slide. A thumbnail whose markup and picture are unchanged
 * keeps its node; one whose words changed is brought up to date in place, keeping its
 * picture when that did not change; a slide entering the window is made. During a drag
 * (`frozen`) every mounted node is kept as it is, since its transform is the drag's.
 * Answers the thumbnails that were made or changed.
 */
function renderTiles(rb: RbCtx, host: HTMLElement, slides: RbSlides, from: number, to: number, ctx: ThumbCtx, frozen: boolean): HTMLElement[] {
  const have = new Map<string, HTMLElement>();
  for (const el of host.querySelectorAll<HTMLElement>('.rb-thumb[data-slide]')) have.set(el.dataset.slide ?? '', el);
  const nodes: HTMLElement[] = [];
  const tiles: HTMLElement[] = [];
  const changed: HTMLElement[] = [];
  if (from > 0) {
    const spacer = spacerNode(host, from, 'before');
    if (spacer) nodes.push(spacer);
  }
  for (let i = from; i <= to; i += 1) {
    const slide = slides[i];
    if (!slide) continue;
    const old = have.get(slide.id);
    if (old && frozen) {
      nodes.push(old);
      tiles.push(old);
      continue;
    }
    const art = slideArt(rb, slide.id, slide.include, arrangementOf(rb, slide.id));
    const meta = thumbHtml(rb, i, slides, ctx, '');
    const known = old ? drawnFrom.get(old) : undefined;
    if (old && known && known.meta === meta && known.art === art) {
      nodes.push(old);
      tiles.push(old);
      continue;
    }
    // The picture is the costly part: an unchanged one moves across instead of being parsed again.
    const sameArt = Boolean(old && known && known.art === art);
    const made = nodeFrom(sameArt ? meta : thumbHtml(rb, i, slides, ctx, art));
    if (!made) continue;
    const oldArt = sameArt ? old?.querySelector('.rb-thumb-art') : null;
    if (oldArt) made.querySelector('.rb-thumb-art')?.replaceWith(oldArt);
    const node = old ?? made;
    if (old) morphTile(old, made);
    drawnFrom.set(node, { meta, art });
    nodes.push(node);
    tiles.push(node);
    changed.push(node);
  }
  const after = slides.length - 1 - to;
  if (after > 0) {
    const spacer = spacerNode(host, after, 'after');
    if (spacer) nodes.push(spacer);
  }
  placeChildren(host, nodes);
  markSelection(rb, tiles, ctx);
  return changed;
}

/**
 * A layout name longer than its pill shows the wireframe alone (or, with no wireframe,
 * wraps), with the whole name in the title: a name is never cut. Measured once per pill,
 * all reads before any write, and only where the pill is laid out.
 */
function fitPills(rb: RbCtx, tiles: HTMLElement[]): void {
  if (rb.narrow) return;
  const fits: Array<{ pill: HTMLElement; fit: string }> = [];
  for (const tile of tiles) {
    const pill = tile.querySelector<HTMLElement>('.rb-thumb-layout');
    const name = pill?.querySelector<HTMLElement>('.rb-thumb-layout-name');
    if (!pill || !name || pill.dataset.fit) continue;
    const room = name.clientWidth;
    if (room === 0) continue;
    const cut = name.scrollWidth > room + 1;
    fits.push({ pill, fit: !cut ? 'name' : pill.querySelector('.rb-thumb-wire') ? 'wire' : 'wrap' });
  }
  for (const { pill, fit } of fits) pill.dataset.fit = fit;
}

export function renderStrip(rb: RbCtx): void {
  const derived = rb.derived;
  const host = list(rb);
  if (!derived || !host) return;
  const state = stateOf(rb);
  const selectionOnly = isSelectionOnly(rb);
  if (selectionOnly && state.selecting) state.selecting = false;
  const slides = shownSlides(rb);
  const { from, to } = stripWindow(rb, slides.length);
  const preview = rb.state.preview;
  const keepDeck = rb.state.keep?.preview ?? null;
  const selected = selectionSet(rb);
  const order = rb.drag.previewOrder();
  const key = [
    derived.plan.revision,
    slides.length,
    from,
    to,
    rb.sel.slideId,
    [...selected].join(','),
    state.selecting,
    order ? order.join(',') : '',
    preview ? `${preview.deck.source.instanceId}:${preview.planRevision}` : '',
    rb.state.faithful?.source.instanceId ?? '',
    rb.state.designSystem?.id ?? '',
    // Keep the design draws the Result and no controls.
    rb.state.mode,
    selectionOnly && keepDeck ? keepDeck.source.instanceId : '',
    // The layout pills and names are drawn from the master once it is read.
    rb.chooser.master() ? 'master' : '',
    // The thumbnail size follows the layout tier and the deck length.
    rb.narrow,
    rb.compare.ladder().thumbnailLongEdge,
  ].join('|');
  if (rb.memo.strip === key && lastPlan.get(rb) === derived.plan && lastPreview.get(rb) === preview && lastKeep.get(rb) === keepDeck) return;
  rb.memo.strip = key;
  lastPlan.set(rb, derived.plan);
  lastPreview.set(rb, preview);
  lastKeep.set(rb, keepDeck);
  setArtRatio(rb);
  const visibleIds = slides.slice(from, to + 1).map((slide) => slide.id);
  const roving = rb.sel.slideId && visibleIds.includes(rb.sel.slideId) ? rb.sel.slideId : (visibleIds[0] ?? null);
  const move = rb.drag.keyMove();
  const ctx: ThumbCtx = {
    roving,
    selected,
    selecting: state.selecting,
    selectionOnly,
    problems: problemSlides(rb),
    moving: new Set(move?.ids ?? []),
    master: rb.chooser.master(),
    common: commonKind(derived.slides),
  };
  loading.set(rb, false);
  // The focused thumbnail keeps its node through every redraw (`renderTiles`), so focus
  // needs no putting back. It is lost only when the thumbnail scrolls out of the window,
  // and then nothing takes it: moving focus would scroll the strip back under the person.
  const changed = renderTiles(rb, host, slides, from, to, ctx, host.dataset.dragging === 'true');
  fitPills(rb, changed);
  host.setAttribute('aria-busy', rb.state.previewStale ? 'true' : 'false');
  rb.els.strip.toggleAttribute('data-selection-only', selectionOnly);
  // The instructions follow the mode, which can change after the strip is wired.
  const help = rb.els.strip.querySelector<HTMLElement>('#rb-strip-help');
  const words = instructions(selectionOnly);
  if (help && help.textContent !== words) help.textContent = words;
  renderBar(rb, selected);
  // A picture still loading draws again on the state change that follows its load.
  if (loading.get(rb)) rb.memo.strip = '';
}

/** The review state more than half the slides share, which their names then leave out. Left out is always said. */
function commonKind(slides: RbSlides): ThumbKind | null {
  const counts = new Map<ThumbKind, number>();
  for (const slide of slides) {
    const kind = reviewKind(slide.include, slide.attention, slide.unreviewed);
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  for (const [kind, count] of counts) if (kind !== 'out' && count * 2 > slides.length) return kind;
  return null;
}

/**
 * The deck's slide shape as `--rb-art-ratio` on the strip, so every picture is 112 px
 * high and as wide as the slide's own ratio makes it (200 px for 16:9). The spacers and
 * the drag's pitch read the same measure.
 */
function setArtRatio(rb: RbCtx): void {
  const frame = rb.state.preview?.deck.frames[0] ?? rb.state.faithful?.frames[0];
  const ratio = frame && frame.width > 0 && frame.height > 0 ? `${frame.width} / ${frame.height}` : '';
  if (ratio) rb.els.strip.style.setProperty('--rb-art-ratio', ratio);
  else rb.els.strip.style.removeProperty('--rb-art-ratio');
}

/** The plan and the preview a strip render last drew, so a new one always redraws. */
const lastPlan = new WeakMap<RbCtx, object>();
const lastPreview = new WeakMap<RbCtx, object | null>();
const lastKeep = new WeakMap<RbCtx, object | null>();

/** Scroll a slide's thumbnail into view, mounting it if it was outside the window. */
export function revealSlide(rb: RbCtx, slideId: string): void {
  const state = stateOf(rb);
  const slides = shownSlides(rb);
  const index = slides.findIndex((slide) => slide.id === slideId);
  if (index < 0) return;
  const scroll = scroller(rb);
  const pitch = measurePitch(rb);
  const width = scroll?.clientWidth ?? 0;
  if (scroll && width > 0 && pitch > 0) {
    const left = index * pitch;
    const at = scrollStart(rb);
    if (left < at || left + pitch > at + width) setScrollStart(rb, left - (width - pitch) / 2);
  } else if (index < state.start || index >= state.start + RB_STRIP_FALLBACK_VISIBLE) {
    state.start = Math.max(0, index - Math.floor(RB_STRIP_FALLBACK_VISIBLE / 2));
  }
  renderStrip(rb);
}

/** Put keyboard focus on a slide's thumbnail, mounting it first. */
export function focusSlide(rb: RbCtx, slideId: string): void {
  revealSlide(rb, slideId);
  tileFor(rb, slideId)?.querySelector<HTMLElement>('.rb-thumb-pick')?.focus();
}

// ─── the selection bar ───────────────────────────────────────────────────────

/**
 * A bar button: a disabled one stays focusable (`aria-disabled`) and names its reason
 * through `aria-describedby`, since a `disabled` button takes no focus and a `title`
 * never shows on touch.
 */
function barButton(act: string, label: string, why = ''): string {
  const off = why !== '';
  const reason = off ? `rb-strip-why-${act}` : '';
  return `<button type="button" class="btn btn--ghost btn--sm" data-bar-act="${htmlEscape(act)}"`
    + `${off ? ` aria-disabled="true" aria-describedby="${reason}"` : ''}>${htmlEscape(label)}</button>`
    + (off ? `<span class="visually-hidden" id="${reason}">${htmlEscape(why)}</span>` : '');
}

/**
 * The bar over the strip: the keyboard move's place and keys while it runs, else the
 * count and the commands while several slides are selected or selection mode is on.
 */
function renderBar(rb: RbCtx, selected: ReadonlySet<string>): void {
  const bar = rb.els.strip.querySelector<HTMLElement>('[data-bar]');
  if (!bar) return;
  const move = rb.drag.keyMove();
  const show = move !== null || (!isSelectionOnly(rb) && (stateOf(rb).selecting || selected.size > 1));
  bar.hidden = !show;
  if (move) bar.dataset.mode = 'move';
  else delete bar.dataset.mode;
  bar.setAttribute('aria-label', move ? t('Moving a slide') : t('Selected slides'));
  bar.innerHTML = !show ? '' : move ? moveBarHtml(move) : selectionBarHtml(rb, selected);
}

/** The keyboard move's bar: where the slide is, the keys, and Done and Cancel for a pointer. */
function moveBarHtml(move: { n: number; position: number; count: number }): string {
  const words = tRaw('Moving slide {n}. Position {position} of {count}. Left and Right move it, Enter drops it, Escape cancels.', {
    n: move.n,
    position: move.position,
    count: move.count,
  });
  return `<p class="rb-strip-count">${htmlEscape(words)}</p>`
    + '<div class="rb-strip-acts">'
    + barButton('move-done', t('Done'))
    + barButton('move-cancel', t('Cancel'))
    + '</div>';
}

/** The selection's bar: how many slides, and the commands that act on every one of them. */
function selectionBarHtml(rb: RbCtx, selected: ReadonlySet<string>): string {
  const count = selected.size;
  const words = count === 1 ? t('1 slide selected') : t('{count} slides selected', { count });
  const ids = [...selected];
  const anyOut = ids.some((id) => rb.derived?.slides.find((slide) => slide.id === id)?.include === false);
  const anyIn = ids.some((id) => rb.derived?.slides.find((slide) => slide.id === id)?.include === true);
  const allOut = anyIn ? '' : t('Every selected slide is already left out.');
  const match = matchOffer(rb, ids);
  // Include shows only when a selected slide is out, as on the bulk menu: a control never
  // takes a press that does nothing.
  return `<p class="rb-strip-count">${htmlEscape(words)}</p>`
    + '<div class="rb-strip-acts">'
    + (anyOut ? barButton('include', t('Include')) : '')
    + barButton('exclude', t('Leave out'), allOut)
    + barButton('layout', t('Change layout…'))
    + (match ? barButton('match', match.label, match.why) : '')
    + barButton('start', t('Move to start'), allOut)
    + barButton('end', t('Move to end'), allOut)
    + barButton('done', t('Done'))
    + '</div>';
}

// ─── selecting ───────────────────────────────────────────────────────────────

/**
 * Pick a slide. `replace` makes it the whole selection; `toggle` adds or takes it away
 * (Ctrl or Cmd, and a tap in selection mode); `range` selects every slide between the
 * anchor and it, in deck order (Shift). The comparison and the column follow the slide.
 */
export function pickSlide(rb: RbCtx, slideId: string, how: 'replace' | 'toggle' | 'range' = 'replace'): void {
  const state = stateOf(rb);
  const slides = rb.derived?.slides ?? [];
  if (!slides.some((slide) => slide.id === slideId)) return;
  // Keep the design selects one slide at a time.
  const way = isSelectionOnly(rb) ? 'replace' : how;
  const current = new Set(selectedSlideIds(rb.sel, slides));
  let next: Set<string>;
  if (way === 'toggle') {
    next = new Set(current);
    if (next.has(slideId) && next.size > 1) next.delete(slideId);
    else next.add(slideId);
    state.anchor = slideId;
    // Taking the current slide away moves the comparison to another selected one.
    const focus = next.has(slideId) ? slideId : [...next][next.size - 1] ?? slideId;
    rb.select({ slideId: focus, objectId: null, itemId: null, selSlides: next });
    return;
  }
  if (way === 'range') {
    const anchor = state.anchor ?? rb.sel.slideId ?? slideId;
    const a = slides.findIndex((slide) => slide.id === anchor);
    const b = slides.findIndex((slide) => slide.id === slideId);
    const [lo, hi] = a < 0 ? [b, b] : [Math.min(a, b), Math.max(a, b)];
    next = new Set(slides.slice(lo, hi + 1).map((slide) => slide.id));
    rb.select({ slideId, objectId: null, itemId: null, selSlides: next });
    return;
  }
  state.anchor = slideId;
  rb.select({ slideId, objectId: null, itemId: null, selSlides: new Set([slideId]) });
}

/** Every slide selected, the current one staying current (Ctrl+A in the strip). */
export function selectAll(rb: RbCtx): void {
  const slides = rb.derived?.slides ?? [];
  if (slides.length === 0 || isSelectionOnly(rb)) return;
  const slideId = rb.sel.slideId ?? slides[0]?.id ?? null;
  rb.select({ slideId, objectId: null, itemId: null, selSlides: new Set(slides.map((slide) => slide.id)) });
  rb.announce(t('{count} slides selected.', { count: slides.length }));
}

/** Back to one selected slide, and selection mode off. True when there was something to clear. */
export function clearSelection(rb: RbCtx): boolean {
  const state = stateOf(rb);
  const many = selectedSlideIds(rb.sel, rb.derived?.slides ?? []).length > 1;
  if (!many && !state.selecting) return false;
  state.selecting = false;
  rb.memo.strip = '';
  const slideId = rb.sel.slideId;
  rb.select({ selSlides: slideId ? new Set([slideId]) : new Set() });
  return true;
}

/** Selection mode for touch, from the menu's "Select several…" row. */
function enterSelecting(rb: RbCtx, slideId: string): void {
  const state = stateOf(rb);
  state.selecting = true;
  rb.memo.strip = '';
  rb.select({ slideId, objectId: null, itemId: null, selSlides: new Set([slideId]) });
  rb.announce(t('Tap slides to select them, then choose Done.'));
}

/** True while selection mode is on. */
export function isSelecting(rb: RbCtx): boolean {
  return stateOf(rb).selecting;
}

// ─── commands ────────────────────────────────────────────────────────────────

/** The number a slide shows in the strip, for an announcement about one slide. */
function numberOf(rb: RbCtx, slideId: string | undefined): number {
  return rb.derived?.slides.find((one) => one.id === slideId)?.number ?? 1;
}

/**
 * One sentence about these slides, singular or plural as a whole: "Slide 3 is left out."
 * or "3 slides are left out.", never "3 slides is".
 */
function aboutSlides(rb: RbCtx, ids: string[], one: (n: number) => string, many: (count: number) => string): string {
  return ids.length === 1 ? one(numberOf(rb, ids[0])) : many(ids.length);
}

function say(rb: RbCtx, outcome: RebrandEditOutcomeV1, success: string): void {
  rb.decide.announceOutcome(outcome, success);
}

/** Include or leave out these slides, and announce it. */
export async function includeSlides(rb: RbCtx, ids: string[], include: boolean): Promise<void> {
  if (ids.length === 0) return;
  const outcome = await rb.controller.include(ids, include);
  say(rb, outcome, include
    ? aboutSlides(rb, ids, (n) => t('Slide {n} is in the deck.', { n }), (count) => t('{count} slides are in the deck.', { count }))
    : aboutSlides(rb, ids, (n) => t('Slide {n} is left out.', { n }), (count) => t('{count} slides are left out.', { count })));
  if (!outcome.ok) {
    rb.memo.strip = '';
    renderStrip(rb);
  }
}

/** Move one slide by a step among the included slides, and say where it went. */
export async function moveBy(rb: RbCtx, slideId: string, delta: number): Promise<void> {
  const slides = rb.derived?.slides ?? [];
  const slide = slides.find((one) => one.id === slideId);
  if (!slide?.include || !Number.isFinite(delta) || delta === 0) return;
  const count = slides.filter((one) => one.include).length;
  const outcome = await rb.controller.move(slideId, delta);
  const position = Math.max(1, Math.min(count, slide.order + 1 + delta));
  say(rb, outcome, t('Moved slide {n} to position {position} of {count}.', { n: slide.number, position, count }));
}

/** Move these slides as one block so the first sits at `toIndex` among the included slides, and announce it. */
export async function moveBlock(rb: RbCtx, ids: string[], toIndex: number): Promise<RebrandEditOutcomeV1 | null> {
  const slides = rb.derived?.slides ?? [];
  const moving = ids.filter((id) => slides.find((one) => one.id === id)?.include);
  if (moving.length === 0 || !rb.controller.moveSlides) return null;
  const count = slides.filter((one) => one.include).length;
  const outcome = await rb.controller.moveSlides(moving, toIndex);
  const position = Math.max(1, Math.min(count, toIndex + 1));
  const first = slides.find((one) => one.id === moving[0]);
  const words = moving.length === 1
    ? t('Moved slide {n} to position {position} of {count}.', { n: first?.number ?? 1, position, count })
    : t('Moved {moved} slides to position {position} of {count}.', { moved: moving.length, position, count });
  say(rb, outcome, words);
  return outcome;
}

async function moveToEnd(rb: RbCtx, ids: string[], to: 'start' | 'end'): Promise<void> {
  const moving = ids.filter((id) => rb.derived?.slides.find((one) => one.id === id)?.include);
  if (moving.length === 0 || !rb.controller.moveTo) return;
  const outcome = await rb.controller.moveTo(moving, to);
  say(rb, outcome, to === 'start'
    ? aboutSlides(rb, moving, (n) => t('Slide {n} moved to the start.', { n }), (count) => t('{count} slides moved to the start.', { count }))
    : aboutSlides(rb, moving, (n) => t('Slide {n} moved to the end.', { n }), (count) => t('{count} slides moved to the end.', { count })));
}

/**
 * True when Reset slide would change something on this slide: a layout a person or
 * Auto-match chose, a background of its own, a decision or text a person set, or a
 * remembered decision. The engine resets exactly these (`resetSlideDecisions`), so a
 * slide with none of them offers the row disabled with its reason.
 */
function resettable(rb: RbCtx, slideId: string): boolean {
  const plan = rb.derived?.plan;
  const slide = plan?.slides.find((one) => one.id === slideId);
  if (!plan || !slide) return false;
  if (slide.layoutSource === 'user' || slide.layoutSource === 'auto' || slide.ground !== undefined) return true;
  const personal = slide.objects.some((row) => !row.locked
    && (row.decision !== undefined || row.author === 'user' || row.author === 'agent' || row.textOverride !== undefined));
  return personal || plan.decisions.some((memory) => memory.slideLineage === slideId);
}

async function resetSlides(rb: RbCtx, ids: string[]): Promise<void> {
  if (!rb.controller.resetSlide || !ids.some((id) => resettable(rb, id))) return;
  const outcome = await rb.controller.resetSlide(ids);
  say(rb, outcome, aboutSlides(rb, ids, (n) => t('Slide {n} is reset.', { n }), (count) => t('{count} slides are reset.', { count })));
}

/**
 * Auto-match over a selection as the bar and the bulk menu offer it: the chooser's label
 * with the count it would set ("Match 3 slides"), disabled with the reason when it would
 * set none or this build refuses it. Null when the controller carries no such command.
 */
function matchOffer(rb: RbCtx, ids: string[]): { label: string; why: string } | null {
  if (!rb.chooser.autoMatchState().shown) return null;
  const counts = rb.chooser.autoMatchCounts(ids);
  const why = rb.chooser.autoMatchBlockedFor(ids, counts);
  return { label: rb.chooser.matchLabel(counts.count, Boolean(why)), why };
}

/** Auto-match over these slides. A build that refuses it is learned once, and every surface disables it. */
async function matchLayouts(rb: RbCtx, ids: string[]): Promise<void> {
  const command = rb.controller.autoMatchLayouts;
  if (!command || matchOffer(rb, ids)?.why !== '') return;
  const before = rb.controller.getState().plan;
  const outcome = await command('likely', ids);
  if (!outcome.ok && outcome.refusal === 'not-built') {
    rb.chooser.noteAutoMatchRefused();
    rb.announce(t('Auto-match is not available yet.'));
    rb.memo.strip = '';
    renderStrip(rb);
    return;
  }
  say(rb, outcome, rb.chooser.matchedText(outcome.touched, rb.chooser.likelySet(before, rb.controller.getState().plan)));
}

/**
 * Open the deck in Design on this slide's frame, through the footer's own path: with
 * cards left it asks the same confirm the footer's button asks, so the two never differ.
 */
async function openSlideInDesign(rb: RbCtx, slideId: string): Promise<void> {
  await rb.foot.openInDesign(slideId);
}

/** The layout chooser for these slides, anchored on a thumbnail when one is mounted. */
export function chooseLayout(rb: RbCtx, ids: string[], anchor?: HTMLElement | null): void {
  if (ids.length === 0 || isSelectionOnly(rb)) return;
  const first = ids[0] ?? '';
  const at = anchor ?? tileFor(rb, first)?.querySelector<HTMLElement>('.rb-thumb-pick') ?? undefined;
  rb.chooser.open(ids, 'menu', at ?? undefined);
}

/** The first code point of each run of decimal digits a person may type a position in. */
const DIGIT_ZEROS = [0x30, 0x660, 0x6f0, 0x966, 0x9e6];

/** A typed position as a whole number, in Western, Arabic-Indic, Devanagari or Bengali digits. NaN otherwise. */
export function parsePosition(typed: string): number {
  let digits = '';
  for (const ch of typed.trim()) {
    const code = ch.codePointAt(0) ?? 0;
    const zero = DIGIT_ZEROS.find((start) => code >= start && code <= start + 9);
    if (zero === undefined) return Number.NaN;
    digits += String(code - zero);
  }
  return digits ? Number.parseInt(digits, 10) : Number.NaN;
}

/** "Move to position…": a one-field dialog, then one move over `moveSlides`. */
async function moveToPosition(rb: RbCtx, slideId: string): Promise<void> {
  const included = (rb.derived?.slides ?? []).filter((one) => one.include);
  const at = included.findIndex((one) => one.id === slideId);
  if (at < 0 || included.length < 2) return;
  const count = included.length;
  // A number out of range opens the dialog again with what was typed and the reason in
  // it, so nothing typed is lost and the reason is read where the field is.
  let value = String(at + 1);
  let error = '';
  let position = Number.NaN;
  for (;;) {
    const typed = await promptDialog({
      title: tRaw('Move to position'),
      message: tRaw('Position, from 1 to {count}', { count }),
      confirmLabel: tRaw('Move'),
      value,
      ...(error ? { error } : {}),
    });
    if (typed === null) {
      focusSlide(rb, slideId);
      return;
    }
    position = parsePosition(typed);
    if (Number.isInteger(position) && position >= 1 && position <= count) break;
    value = typed;
    error = tRaw('Type a position from 1 to {count}.', { count });
  }
  if (position === at + 1) {
    rb.announce(t('The slide stays where it was.'));
    focusSlide(rb, slideId);
    return;
  }
  await moveBlock(rb, [slideId], position - 1);
  focusSlide(rb, slideId);
}

// ─── the shortcuts ───────────────────────────────────────────────────────────

/** The keys the review answers, in the order the sheet lists them. Keep the design only flicks. */
export function shortcutRows(selectionOnly: boolean): Array<{ keys: string; label: string }> {
  const flick = [
    { keys: tRaw('Arrow keys, K and J'), label: tRaw('Previous and next slide') },
    { keys: tRaw('Home and End'), label: tRaw('First and last slide') },
  ];
  const help = { keys: '?', label: tRaw('Show these shortcuts') };
  if (selectionOnly) return [...flick, help];
  return [
    ...flick,
    { keys: tRaw('Shift and an arrow'), label: tRaw('Select more slides') },
    { keys: tRaw('Ctrl or Cmd and A'), label: tRaw('Select every slide') },
    { keys: tRaw('Alt and an arrow'), label: tRaw('Move the slide one place') },
    { keys: 'M', label: tRaw('Move the slide with the arrow keys') },
    { keys: 'L', label: tRaw('Change the layout') },
    { keys: tRaw('Shift+F10'), label: tRaw('Open the slide menu') },
    { keys: '\\', label: tRaw('Hold to show the Original') },
    { keys: tRaw('Ctrl or Cmd and Z'), label: tRaw('Undo') },
    { keys: tRaw('Shift, Ctrl or Cmd and Z'), label: tRaw('Redo') },
    { keys: 'Esc', label: tRaw('Back to one slide') },
    help,
  ];
}

/** The keyboard shortcuts as a sheet over the view: from `?`, the slide menu and the project menu. */
export function openShortcuts(rb: RbCtx): void {
  if (document.querySelector('dialog.rb-keys-sheet')) return;
  const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const title = tRaw('Keyboard shortcuts');
  const modal = mountModal<void>('', {
    className: 'modal rb-keys-sheet',
    ariaLabel: title,
    onClose: () => {
      if (opener?.isConnected) opener.focus();
    },
  });
  // Built as nodes: every word goes in as text.
  const heading = document.createElement('h2');
  heading.className = 'modal-title';
  heading.textContent = title;
  const table = document.createElement('table');
  table.className = 'rb-keys-table';
  const body = document.createElement('tbody');
  for (const row of shortcutRows(isSelectionOnly(rb))) {
    const tr = document.createElement('tr');
    const keys = document.createElement('td');
    keys.className = 'rb-keys-keys';
    const kbd = document.createElement('kbd');
    kbd.textContent = row.keys;
    keys.append(kbd);
    const label = document.createElement('td');
    label.textContent = row.label;
    tr.append(keys, label);
    body.append(tr);
  }
  table.append(body);
  // The single-character keys can be limited to a focused thumbnail (WCAG 2.1.4). Keep the
  // design has no letter but the question mark, so it offers the same switch.
  const single = document.createElement('label');
  single.className = 'field-toggle rb-keys-single';
  const check = document.createElement('input');
  check.type = 'checkbox';
  check.className = 'field-check';
  check.setAttribute('role', 'switch');
  check.checked = rb.keys.singleKeys();
  const words = document.createElement('span');
  words.textContent = tRaw('Use single-key shortcuts anywhere');
  single.append(check, words);
  const note = document.createElement('p');
  note.className = 'rb-keys-note';
  note.id = 'rb-keys-single-note';
  note.textContent = tRaw('When off, letters and the question mark work only on a focused slide in the filmstrip.');
  check.setAttribute('aria-describedby', note.id);
  check.addEventListener('change', () => rb.keys.setSingleKeys(check.checked));
  const actions = document.createElement('div');
  actions.className = 'modal-actions';
  const done = document.createElement('button');
  done.type = 'button';
  done.className = 'btn modal-primary';
  done.textContent = tRaw('Done');
  done.addEventListener('click', () => modal.close());
  actions.append(done);
  modal.el.append(heading, table, single, note, actions);
  done.focus();
}

// ─── the menu ────────────────────────────────────────────────────────────────

/**
 * One menu row, the shared `menuItemHtml`. A row that cannot run now keeps its focus
 * (`aria-disabled`) with its reason as a second line that is also its description, and
 * the shared menu runs nothing when it is picked.
 */
function menuRow(act: string, glyph: IconName, label: string, why = ''): string {
  return menuItemHtml(act, icon(glyph, glyph === 'menuDots' ? { filled: true } : {}), label, why ? { reason: why } : {});
}

/** A rule between two groups of rows: layout, then the deck, then order, then the rest. */
const MENU_RULE = '<div class="rb-menu-rule" role="separator"></div>';

/** The arrows for earlier and later, which point the other way in a right to left strip. */
function moveGlyphs(rb: RbCtx): { earlier: IconName; later: IconName; start: IconName; end: IconName } {
  return isRtl(rb)
    ? { earlier: 'arrowRight', later: 'arrowLeft', start: 'skipForward', end: 'skipBack' }
    : { earlier: 'arrowLeft', later: 'arrowRight', start: 'skipBack', end: 'skipForward' };
}

/**
 * The nine rows for one slide (close-out section 3.7), in groups: the layout, whether it
 * is in the deck, its place, the slide itself, and the rest. Duplicate is left out until
 * its contract is built: a row never takes a click that does nothing. A slide left out
 * offers Include in place of Leave out and has no place to move to.
 */
function singleRows(rb: RbCtx, slideId: string): string {
  const slides = rb.derived?.slides ?? [];
  const slide = slides.find((one) => one.id === slideId);
  if (!slide) return '';
  const included = slides.filter((one) => one.include);
  const at = included.findIndex((one) => one.id === slideId);
  const glyph = moveGlyphs(rb);
  let html = menuRow('layout', 'grid', t('Change layout…'));
  html += MENU_RULE;
  html += slide.include ? menuRow('exclude', 'eyeOff', t('Leave out')) : menuRow('include', 'eye', t('Include'));
  if (slide.include) {
    html += MENU_RULE;
    html += menuRow('earlier', glyph.earlier, t('Move earlier'), at <= 0 ? t('This slide is already first.') : '');
    html += menuRow('later', glyph.later, t('Move later'), at >= included.length - 1 ? t('This slide is already last.') : '');
    html += menuRow('position', 'hash', t('Move to position…'), included.length < 2 ? t('It is the only slide in the deck.') : '');
  }
  html += MENU_RULE;
  html += menuRow('reset', 'undo', t('Reset slide'), resettable(rb, slideId) ? '' : t('Nothing to reset on this slide.'));
  // Open in Design runs as the footer's button does, asking first while cards are left.
  html += menuRow('design', ICON_METAPHORS.design, t('Open in Design'), slide.include ? '' : t('Include the slide first.'));
  html += MENU_RULE;
  html += menuRow('select', 'checklist', t('Select several…'));
  html += menuRow('shortcuts', 'keyboard', t('Keyboard shortcuts'));
  return html;
}

/** The bulk menu over a multi-selection: a count, then the rows that act on every selected slide, in the same groups. */
function bulkRows(rb: RbCtx): string {
  const ids = selectedSlideIds(rb.sel, rb.derived?.slides ?? []);
  const slides = rb.derived?.slides ?? [];
  const anyOut = ids.some((id) => slides.find((one) => one.id === id)?.include === false);
  const anyIn = ids.some((id) => slides.find((one) => one.id === id)?.include === true);
  const allOut = anyIn ? '' : t('Every selected slide is already left out.');
  const glyph = moveGlyphs(rb);
  const match = matchOffer(rb, ids);
  return `<p class="folder-menu-head">${htmlEscape(t('{count} slides selected', { count: ids.length }))}</p>`
    + '<div role="menu">'
    + menuRow('layout', 'grid', t('Change layout…'))
    + (match ? menuRow('match', 'sparkle', match.label, match.why) : '')
    + MENU_RULE
    + (anyIn ? menuRow('exclude', 'eyeOff', t('Leave out')) : '')
    + (anyOut ? menuRow('include', 'eye', t('Include')) : '')
    + MENU_RULE
    + menuRow('start', glyph.start, t('Move to start'), allOut)
    + menuRow('end', glyph.end, t('Move to end'), allOut)
    + MENU_RULE
    + menuRow('reset', 'undo', t('Reset slides'), ids.some((id) => resettable(rb, id)) ? '' : t('Nothing to reset on these slides.'))
    + '</div>';
}

/** The sheet's head for one slide: its picture and its name. */
function sheetHead(rb: RbCtx, slideId: string): ContextMenuSheetHead | null {
  const slide = rb.derived?.slides.find((one) => one.id === slideId);
  if (!slide) return null;
  const arrangement = rb.derived?.plan.slides.find((one) => one.id === slideId)?.arrangement;
  const thumb = slideArt(rb, slide.id, slide.include, arrangement);
  return { name: slideTitle(slide.number, slide.title), ...(thumb ? { thumb } : {}) };
}

/**
 * After a command from the menu or the bar, focus goes back to the slide's thumbnail when
 * it was lost on the way (the menu handed it to a node the command redrew), never to
 * the page. Focus that moved somewhere real (a dialog, the footer's Undo) stays there.
 */
async function thenFocus(rb: RbCtx, slideId: string, work: Promise<unknown>): Promise<void> {
  await work;
  const active = document.activeElement;
  const lost = !(active instanceof HTMLElement) || active === document.body || !active.isConnected;
  if (lost && rb.viewEl.isConnected && rb.derived?.slides.some((slide) => slide.id === slideId)) focusSlide(rb, slideId);
}

/** Run a picked row for `ids`. The menu has closed already. */
function menuAction(rb: RbCtx, act: string, ids: string[], anchor: HTMLElement | null): void {
  const first = ids[0];
  if (!first) return;
  const run = (work: Promise<unknown>): void => void thenFocus(rb, first, work);
  switch (act) {
    case 'layout': chooseLayout(rb, ids, anchor); break;
    case 'match': run(matchLayouts(rb, ids)); break;
    case 'include': run(includeSlides(rb, ids, true)); break;
    case 'exclude': run(includeSlides(rb, ids, false)); break;
    case 'earlier': run(moveBy(rb, first, -1)); break;
    case 'later': run(moveBy(rb, first, 1)); break;
    case 'start': run(moveToEnd(rb, ids, 'start')); break;
    case 'end': run(moveToEnd(rb, ids, 'end')); break;
    case 'position': void moveToPosition(rb, first); break;
    case 'reset': run(resetSlides(rb, ids)); break;
    case 'design': void openSlideInDesign(rb, first); break;
    case 'select': enterSelecting(rb, first); break;
    case 'shortcuts': openShortcuts(rb); break;
    default: break;
  }
}

/** Open the slide's menu at a thumbnail: the More button, or the thumbnail itself from the keyboard. */
export function openMenu(rb: RbCtx, slideId: string, anchor?: HTMLElement | null): void {
  const state = stateOf(rb);
  const tile = tileFor(rb, slideId);
  if (!state.menu || !tile || isSelectionOnly(rb)) return;
  const from = anchor ?? tile.querySelector<HTMLElement>('.rb-thumb-pick');
  const rect = (from ?? tile).getBoundingClientRect();
  const x = isRtl(rb) ? rect.right : rect.left;
  const many = selectedSlideIds(rb.sel, rb.derived?.slides ?? []);
  if (many.length > 1 && many.includes(slideId)) state.menu.openBulkAt(x, rect.bottom);
  else state.menu.openAt(x, rect.bottom, { ref: slideId, tile }, from);
}

/** True while the filmstrip's menu is open. */
export function menuOpen(rb: RbCtx): boolean {
  return stateOf(rb).menu?.isOpen() ?? false;
}

// ─── wiring ──────────────────────────────────────────────────────────────────

/**
 * The one-line instructions a screen reader hears when focus first enters the strip.
 * It names no arrow's direction, since Left and Right swap in a right to left layout.
 */
function instructions(selectionOnly: boolean): string {
  return selectionOnly
    ? tRaw('Arrows, or K and J, go to the previous and next slide. Question mark lists the shortcuts.')
    : tRaw('Arrows, or K and J, go to the previous and next slide. Shift with an arrow selects more slides. Alt with an arrow moves the slide. M moves it with the arrow keys. L changes the layout. Shift+F10 opens the slide menu. Question mark lists the shortcuts.');
}

function onClick(rb: RbCtx, e: MouseEvent): void {
  const target = e.target as Element;
  const more = target.closest<HTMLElement>('[data-more]');
  if (more) {
    e.preventDefault();
    openMenu(rb, more.dataset.more ?? '', more);
    return;
  }
  // The layout pill: the chooser for this slide, or for the selection it is part of.
  const pill = target.closest<HTMLElement>('[data-layout-of]');
  if (pill) {
    e.preventDefault();
    const slideId = pill.dataset.layoutOf ?? '';
    const many = selectedSlideIds(rb.sel, rb.derived?.slides ?? []);
    chooseLayout(rb, many.length > 1 && many.includes(slideId) ? many : [slideId], pill);
    return;
  }
  const pick = target.closest<HTMLElement>('.rb-thumb-pick');
  const slideId = pick?.dataset.slide;
  if (!slideId || rb.drag.justDropped()) return;
  const toggle = stateOf(rb).selecting || e.ctrlKey || e.metaKey;
  pickSlide(rb, slideId, e.shiftKey ? 'range' : toggle ? 'toggle' : 'replace');
}

function onBar(rb: RbCtx, e: MouseEvent): void {
  const button = (e.target as Element).closest<HTMLElement>('[data-bar-act]');
  if (!button || button.getAttribute('aria-disabled') === 'true') return;
  const act = button.dataset.barAct ?? '';
  if (act === 'move-done') {
    rb.drag.dropMove();
    return;
  }
  if (act === 'move-cancel') {
    rb.drag.cancel();
    return;
  }
  const ids = selectedSlideIds(rb.sel, rb.derived?.slides ?? []);
  if (act === 'done') {
    clearSelection(rb);
    rb.announce(t('Selection mode is off.'));
    if (rb.sel.slideId) focusSlide(rb, rb.sel.slideId);
    return;
  }
  menuAction(rb, act, ids, button);
}

/**
 * Shift+F10 and the Menu key fire `contextmenu` on the focused thumbnail with a point
 * that is not the pointer's. That one opens at the thumbnail, with focus going back to
 * it when the menu closes; the shared module handles the pointer's.
 */
function onKeyboardMenu(rb: RbCtx, e: MouseEvent): void {
  const pick = (e.target as Element).closest<HTMLElement>('.rb-thumb-pick');
  if (!pick || pick !== document.activeElement) return;
  const rect = pick.getBoundingClientRect();
  const inside = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
  if (inside && (e.clientX !== 0 || e.clientY !== 0)) return;
  e.preventDefault();
  e.stopPropagation();
  openMenu(rb, pick.dataset.slide ?? '', pick);
}

export function wireStrip(rb: RbCtx): void {
  const state = stateOf(rb);
  const strip = rb.els.strip;
  strip.innerHTML = `<h2 class="visually-hidden">${htmlEscape(t('Slides'))}</h2>`
    + '<div class="rb-strip-bar" data-bar role="toolbar" hidden></div>'
    + '<div class="rb-strip-scroll" data-scroll>'
    + `<ol class="rb-strip-list" data-list role="listbox" aria-multiselectable="true" aria-orientation="horizontal"`
    + ` aria-label="${htmlEscape(t('Slides in deck order'))}" aria-describedby="rb-strip-help"></ol></div>`
    + `<p class="visually-hidden" id="rb-strip-help">${htmlEscape(instructions(isSelectionOnly(rb)))}</p>`;
  strip.querySelector('[data-bar]')?.setAttribute('aria-label', t('Selected slides'));
  const scroll = scroller(rb);
  const host = list(rb);
  const bar = strip.querySelector<HTMLElement>('[data-bar]');
  if (!scroll || !host || !bar) return;
  const onScroll = (): void => {
    if (state.frame) return;
    const schedule = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (fn: FrameRequestCallback) => setTimeout(() => fn(0), 16);
    state.frame = Number(schedule(() => {
      state.frame = 0;
      renderStrip(rb);
    }));
  };
  const click = (e: MouseEvent): void => onClick(rb, e);
  const barClick = (e: MouseEvent): void => onBar(rb, e);
  const keyboardMenu = (e: MouseEvent): void => onKeyboardMenu(rb, e);
  scroll.addEventListener('scroll', onScroll, { passive: true });
  host.addEventListener('click', click);
  bar.addEventListener('click', barClick);
  strip.addEventListener('contextmenu', keyboardMenu, true);
  state.menu = wireTileContextMenu({
    host: strip,
    tileSelector: '.rb-thumb',
    // A thumbnail being dragged opens no menu: the long press that armed the drag is not a
    // menu request. Keep the design has no slide menu.
    refOf: (tile) => (rb.drag.active() || isSelectionOnly(rb) ? null : tile.dataset.slide ?? null),
    isBulkTarget: (ref) => {
      const ids = selectedSlideIds(rb.sel, rb.derived?.slides ?? []);
      return ids.length > 1 && ids.includes(ref);
    },
    singleHtml: (target: ContextMenuTarget) => singleRows(rb, target.ref),
    bulkHtml: () => bulkRows(rb),
    // Under a coarse pointer the menu is a bottom sheet headed by the slide's picture and name.
    presentation: 'sheet',
    head: (target, kind) => (kind === 'single' && target ? sheetHead(rb, target.ref) : null),
    onAction: (act, target, kind) => {
      const ids = kind === 'bulk' ? selectedSlideIds(rb.sel, rb.derived?.slides ?? []) : target ? [target.ref] : [];
      const anchor = target?.tile?.querySelector<HTMLElement>('.rb-thumb-pick') ?? null;
      menuAction(rb, act, ids, anchor);
    },
  });
  rb.drag.wire();
  rb.disposers.push(() => {
    scroll.removeEventListener('scroll', onScroll);
    host.removeEventListener('click', click);
    bar.removeEventListener('click', barClick);
    strip.removeEventListener('contextmenu', keyboardMenu, true);
    state.menu?.destroy();
    state.menu = null;
  });
}

export function stripOps(rb: RbCtx) {
  return {
    wire: bindOp(rb, wireStrip),
    render: bindOp(rb, renderStrip),
    reveal: bindOp(rb, revealSlide),
    focus: bindOp(rb, focusSlide),
    pick: bindOp(rb, pickSlide),
    selectAll: bindOp(rb, selectAll),
    clearSelection: bindOp(rb, clearSelection),
    selecting: bindOp(rb, isSelecting),
    selectionOnly: bindOp(rb, isSelectionOnly),
    openMenu: bindOp(rb, openMenu),
    menuOpen: bindOp(rb, menuOpen),
    shortcuts: bindOp(rb, openShortcuts),
    chooseLayout: bindOp(rb, chooseLayout),
    include: bindOp(rb, includeSlides),
    moveBy: bindOp(rb, moveBy),
    moveBlock: bindOp(rb, moveBlock),
    tile: bindOp(rb, tileFor),
    window: bindOp(rb, stripWindow),
    pitch: bindOp(rb, measurePitch),
    rtl: bindOp(rb, isRtl),
    x: bindOp(rb, logicalX),
    scrollStart: bindOp(rb, scrollStart),
    setScrollStart: bindOp(rb, setScrollStart),
  };
}
