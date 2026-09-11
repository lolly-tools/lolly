// SPDX-License-Identifier: MPL-2.0
/**
 * The Design tool's NAVIGATOR column - plans/179 section 5.1, milestone M2.
 *
 * One list of the document's artboards, always live, in the SAME page order the tool's
 * hook reads (`order` ascending, `x` ascending as the tie-break). It is titled "Slides"
 * once any frame carries timing, notes or a build step, and "Artboards" otherwise - but
 * it is never two lists: a deck and a poster are the same document with different fields
 * filled in, and splitting the list on "has a deck" is what made the old filmstrip
 * disagree with the timeline about which board is slide 1.
 *
 * What it owns, and what it does not:
 *   • it OWNS rename (one `setField` per commit) and REORDER (a dense 0..n-1 `order`
 *     through `renumberFrameOrder`, never a rewrite of `x` - moving a page's x drags its
 *     children through `cascadeFrameMove`, and the hook prefers `order` anyway, so
 *     export, presenter and timeline agree the moment the row is dropped);
 *   • it owns the two LAYER FLAGS (plans/179 M4) - hidden and locked, one `setField`
 *     per press. They belong to a list rather than to the canvas because a hidden box
 *     is not drawn and a locked one refuses every pointer: neither can be clicked back;
 *   • everything else - duplicate, delete, present, add - is a verb on `NavigatorActions`,
 *     injected by the host, because those touch model surgery the overlay already owns.
 *
 * Nothing here reaches the runtime directly: reads and writes go through the `ModelPort`
 * (whose `commit`/`setField` are the tool view's undo-coalescing `runtime.setInput`
 * wrapper, never `setInputNoHistory`), selection through the `SelectionPort`, and the
 * pan/zoom "frame this board" through the `ArtboardPort`. That is what makes the whole
 * module testable against fakes in jsdom - see design-navigator.test.ts.
 *
 * Two skins, one list: `column` (the left sidebar - draggable from its own edge grip,
 * collapsible to a 36px rail of numbered dots) and `strip` (a horizontal bottom
 * filmstrip, which is where the existing mobile Artboards panel will mount it). The strip
 * carries no Layers section - under 641px there is no room for a second list, and the
 * layer stack is a desktop concern.
 *
 * THE COLUMN IS THE EDITOR'S ONE LEFT SIDEBAR (Andy, 2026-09-02: "lets only have a single
 * left sidebar and a single right sidebar"). Two things follow, and neither is this
 * module's own doing:
 *   • it carries a SLOT (`[data-nav-rail-slot]`) that free-canvas re-parents its tool
 *     rail into while the column is open, so there is no floating palette beside it. The
 *     data attribute is the whole contract - neither module imports the other;
 *   • its width is a live drag (`setWidth`/`navWidthFor`), reported to the host on every
 *     frame so the stage reserve and the canvas fit follow the edge instead of jumping
 *     on release. Remembered per device under `lolly-design-nav-w`; the OPEN flag stays
 *     the host's own preference.
 *
 * The DOM is built with createElement/textContent throughout, so this file holds no
 * raw-HTML sink (primitive-guards R10) and every user string goes into a text node.
 *
 * Two boundaries this column has to keep on its own, because the editor cannot be asked
 * to know about it:
 *   • KEYS STOP HERE (`onRootKey`). free-canvas binds its shortcuts on `window` and bails
 *     only for a typing target or focus inside `.tl-panel`; a `role="option"` row is
 *     neither, so an unswallowed ArrowDown walks this list AND nudges the artboard.
 *   • the row menu is FIXED, placed off client rects (`placeMenu`). `.fc-nav` is both
 *     `overflow: hidden` and the positioned ancestor, and the rows scroll inside it, so
 *     an absolutely-placed menu is clipped away and mis-placed the moment the list moves.
 *
 * Run its tests:  node --import ./tests/css-stub.mjs --test shells/web/src/views/design-navigator.test.ts
 */
import type { Box, BoxFieldConfig } from './free-canvas-math.ts';
import { framesAreSequenced, num, renumberFrameOrder } from './free-canvas-math.ts';
import type {
  ArtboardPort, FramePort, FrameThumb, ModelPort, NarrationActions, NarrationStatus,
  NavigatorActions, SelectionPort,
} from './design-ports.ts';
import type { IconName } from '../lib/icons.ts';
import { icon } from '../lib/icons.ts';
import { slideTransitionPair } from '../lib/motion-model.ts';
import { t, tRaw } from '../i18n.ts';
import { announce } from '../a11y.ts';

/** Default open width of the column skin, in px - the width a fresh session starts at. */
export const NAV_WIDTH = 232;
/** Collapsed width: a rail of numbered dots, wide enough for a 2-digit badge. */
export const NAV_RAIL_WIDTH = 36;
/**
 * Narrowest OPEN column. A drag that goes under it SNAPS SHUT to the dot rail rather
 * than leaving a column too narrow to read a row in - the same feel as the tool view's
 * inputs sidebar, whose `SIDEBAR_MIN` snaps to 0 (views/tool.ts `setSidebarWidth`).
 */
export const NAV_MIN_WIDTH = 168;
/** Widest, so one drag cannot swallow the canvas it is a navigator for. */
export const NAV_MAX_WIDTH = 460;
/** Device-local remembered width. The OPEN flag is the host's own pref, not this one. */
export const NAV_WIDTH_KEY = 'lolly-design-nav-w';
/** How far one arrow key moves the column edge (Shift multiplies it). */
const NAV_KEY_STEP = 16;

/**
 * What a wanted width means: open at that width, or shut to the dot rail. Pure, so the
 * pointer drag and the arrow keys cannot end up with two different snap points.
 */
export function navWidthFor(px: number): { open: boolean; width: number } {
  if (!(px >= NAV_MIN_WIDTH)) return { open: false, width: NAV_RAIL_WIDTH };
  return { open: true, width: Math.min(NAV_MAX_WIDTH, Math.round(px)) };
}

/** The remembered open width, or the design default. Storage can be absent or refuse. */
function readSavedWidth(): number {
  try {
    const v = Number(localStorage.getItem(NAV_WIDTH_KEY));
    if (Number.isFinite(v) && v >= NAV_MIN_WIDTH) return Math.min(NAV_MAX_WIDTH, Math.round(v));
  } catch { /* no storage (private window, a host with none) - the default stands */ }
  return NAV_WIDTH;
}
/** Row thumbnail box. 16:9 fills 44x25 exactly, and every other aspect letterboxes inside it. */
const THUMB_W = 44;
const THUMB_H = 25;
/** How much of a layer's own text stands in for a missing name. */
const LAYER_TEXT_MAX = 24;
/** Pointer travel (px) before a press on a row counts as a drag rather than a click. */
const DRAG_SLOP = 4;
/** Gap between a row and the menu it anchors, and the menu's margin off a viewport edge. */
const MENU_GAP = 4;

/**
 * The keys the two lists own - ArrowUp/Down/Left/Right, Home, End, Enter, F2, Space,
 * Delete, Backspace, ContextMenu, F10 - are answered in `onRowKey`. Every one of them
 * ALSO means something on the canvas (free-canvas binds its shortcuts on `window`), and
 * so does every bare letter, so `onRootKey` stops the lot rather than keeping a list:
 * NOTHING pressed inside this column may drive the editor. The one exception is a
 * modifier chord, which is app-wide by definition - see `onRootKey`.
 */

/**
 * The fields this module reads beyond the geometry `BoxFieldConfig`. They are optional
 * because a host that has not declared them still gets working defaults - the same
 * literal names the Design manifest uses - rather than a column that renders nothing.
 */
interface NavCfg extends BoxFieldConfig {
  kindField?: string;
  textField?: string;
  durField?: string;
  startField?: string;
}

/**
 * The three field names M4 added to the tool's `canvas` block, read off the frame port.
 * Both spellings the overlay uses for the transition are accepted, so this column keeps
 * working whichever one the port ends up carrying, and each falls back to the literal
 * name the Design manifest declares - the same "working defaults, not a blank column"
 * rule {@link NavCfg} follows.
 */
interface NavFrameCfg extends FramePort {
  hiddenField?: string;
  lockedField?: string;
  transitionField?: string;
  frameTransitionField?: string;
}

/** How long a chip's transition preview runs. A glance, not the authored timing. */
const PREVIEW_MS = 520;

export interface DesignNavigatorOpts {
  /** The editor stage; the column mounts as a sibling of the canvas, like `.tl-panel`. */
  stageEl: HTMLElement;
  /** The live canvas - told to re-fit when the column's width changes. */
  canvasEl: HTMLElement;
  model: ModelPort;
  selection: SelectionPort;
  artboard: ArtboardPort;
  thumb: FrameThumb;
  actions: NavigatorActions;
  /**
   * Notes to voice (plans/180 section 8). Absent - a host with no speech bridge - and the
   * row's dot falls back to what it has always said: this slide has speaker notes.
   */
  narration?: NarrationActions;
  /** `column` (default) is the desktop left column; `strip` is the mobile filmstrip. */
  skin?: 'column' | 'strip';
  /** Start open? The host decides (device-local preference + viewport width). */
  initiallyOpen?: boolean;
  onOpenChange?(open: boolean): void;
  /** Fired on mount and on every open change with the width the host must reserve. */
  onWidthChange?(px: number): void;
}

export interface DesignNavigatorHandle {
  /** The mounted `<aside>` - the host may move it into another slot (the mobile panel). */
  el: HTMLElement;
  setOpen(open: boolean): void;
  isOpen(): boolean;
  /** The stage width this column occupies right now (0 for the bottom strip). */
  width(): number;
  destroy(): void;
}

/** A row's id as a string ('' when the field is absent). */
function fieldStr(b: Box | undefined, field: string): string {
  const v = b?.[field];
  return v == null ? '' : String(v);
}

/** Is the value authored at all - present, non-empty, and not the "none" spelling? */
function authored(v: unknown): boolean {
  if (v == null || v === '' || v === false) return false;
  const s = String(v).trim();
  return s !== '' && s !== 'none' && s !== '0' && s !== 'false';
}

/**
 * A layer flag as a boolean, read the way the tool's hook reads it (`boolVal`): the URL
 * codec stores columns as strings, so a hidden layer can come back as `'1'` or `'true'`
 * as easily as `true`, and a row that reads only `=== true` shows the wrong glyph on a
 * shared link.
 */
export function boolFlag(v: unknown): boolean {
  if (v === true) return true;
  if (v == null || v === false || v === '') return false;
  const s = String(v).trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'yes' || s === 'on';
}

/** The kind word a layer with no name and no text falls back to. */
function kindWord(kind: string): string {
  switch (kind) {
    case 'text': return t('Text');
    case 'image': return t('Image');
    case 'video': return t('Video');
    case 'audio': return t('Sound');
    case 'path': return t('Path');
    case 'line': return t('Line');
    case 'box': return t('Box');
    case 'camera': return t('Camera');
    case 'table': return t('Table');
    case 'tool': return t('Tool');
    case 'anim': return t('Animation');
    default: return t('Layer');
  }
}

/** The registry glyph for a layer kind - `shapes` is the honest "something else". */
function kindIcon(kind: string): IconName {
  switch (kind) {
    case 'text': return 'font';
    case 'image': return 'image';
    case 'video': return 'filmStrip';
    case 'audio': return 'music';
    case 'path': return 'penTool';
    case 'line': return 'pen';
    case 'box': return 'box';
    case 'camera': return 'camera';
    case 'table': return 'table';
    case 'tool': return 'sparkle';
    case 'anim': return 'play';
    default: return 'shapes';
  }
}

/**
 * `icon()` markup as a real node, so this module holds no raw-HTML sink - the same
 * reasoning (and the same DOMParser namespacing caveat) as components/collab-pill.ts's
 * `iconNode`. A host with no DOMParser, or an unregistered glyph, leaves the control
 * with its accessible name and no picture.
 */
function iconNode(name: IconName): Element | null {
  const markup = icon(name);
  const parser = document.defaultView?.DOMParser ?? (globalThis as { DOMParser?: typeof DOMParser }).DOMParser;
  if (!markup || !parser) return null;
  const parsed = new parser().parseFromString(markup, 'image/svg+xml').documentElement;
  if (!parsed || parsed.localName === 'parsererror' || parsed.getElementsByTagName('parsererror').length) return null;
  return document.importNode(parsed, true);
}

/**
 * A rolling djb2 over the fields of a box. The thumbnail is a clone of the LIVE page, so
 * it goes stale the moment anything ON that page moves - not just when the frame row's
 * own name or size changes. Hashing is how the row memo can carry "and everything drawn
 * inside it" without holding a second copy of the document: it allocates nothing per
 * field beyond the `String(value)` any signature would build, and it is order-sensitive,
 * so a pure z-order swap of two children changes it too.
 */
export function hashBox(seed: number, b: Box | undefined): number {
  let h = seed >>> 0;
  if (!b) return h;
  const push = (s: string): void => {
    for (let i = 0; i < s.length; i++) h = (Math.imul(h, 33) ^ s.charCodeAt(i)) >>> 0;
  };
  for (const k of Object.keys(b).sort()) {
    const v = (b as Record<string, unknown>)[k];
    if (v == null) continue;
    push(k);
    push(typeof v === 'object' ? JSON.stringify(v) : String(v));
  }
  return h;
}

/** `document.createElement` with a class and (optionally) a text node, in one call. */
function make<K extends keyof HTMLElementTagNameMap>(
  tag: K, cls?: string, text?: string,
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text != null) el.textContent = text;
  return el;
}

/** The first line of a text run, clamped - what stands in for an unnamed layer. */
export function layerTextLabel(text: string, max = LAYER_TEXT_MAX): string {
  const first = String(text ?? '').replace(/<[^>]*>/g, ' ').split(/\r?\n/).map((s) => s.trim()).find((s) => s !== '') ?? '';
  return first.length > max ? `${first.slice(0, max - 1)}\u2026` : first;
}

/**
 * Move one id within a sequence by `delta` places, clamped. Pure, so the keyboard
 * reorder and the drop both end at one `applySeq` and cannot drift apart.
 */
export function moveInSeq(ids: string[], id: string, delta: number): string[] {
  const from = ids.indexOf(id);
  if (from < 0) return ids.slice();
  const to = Math.max(0, Math.min(ids.length - 1, from + delta));
  if (to === from) return ids.slice();
  const next = ids.slice();
  next.splice(from, 1);
  next.splice(to, 0, id);
  return next;
}

/** Drop `id` in front of the row at `beforeIndex` (length = "at the end"). */
export function insertAt(ids: string[], id: string, beforeIndex: number): string[] {
  const from = ids.indexOf(id);
  if (from < 0) return ids.slice();
  const rest = ids.slice(0, from).concat(ids.slice(from + 1));
  const at = Math.max(0, Math.min(rest.length, beforeIndex > from ? beforeIndex - 1 : beforeIndex));
  rest.splice(at, 0, id);
  return rest;
}

export function initDesignNavigator(opts: DesignNavigatorOpts): DesignNavigatorHandle {
  const { stageEl, canvasEl, model, selection, artboard, thumb, actions, narration } = opts;
  const skin = opts.skin === 'strip' ? 'strip' : 'column';
  const cfg = model.cfg as NavCfg;
  const frameCfg = model.frame as NavFrameCfg | null;

  // Field names, resolved once. Everything below reads through F, never a literal.
  const F = {
    id: cfg.idField || 'id',
    kind: cfg.kindField || 'kind',
    x: cfg.xField || 'x',
    w: cfg.wField || 'w',
    h: cfg.hField || 'h',
    text: cfg.textField || 'text',
    dur: cfg.durField || 'dur',
    start: cfg.startField || 'start',
    order: frameCfg?.orderField || 'order',
    frame: frameCfg?.frameField || 'frame',
    frameKind: frameCfg?.frameKind || 'frame',
    label: frameCfg?.labelField || 'name',
    hidden: frameCfg?.hiddenField || 'hidden',
    locked: frameCfg?.lockedField || 'locked',
    trans: frameCfg?.transitionField || frameCfg?.frameTransitionField || 'slideTransition',
  };
  // Fields the manifest names literally (they have no cfg key) - see the spec's cfg table.
  const NOTES = 'notes';
  const BUILD = 'build';

  let open = opts.initiallyOpen !== false;
  /** The width the column returns to when it is opened - dragged, and remembered. */
  let openW = readSavedWidth();
  let renamingId = '';           // a rename in flight owns the row: no rebuild may clobber it
  let listSig = '\u0000';        // memo for the whole list build
  let activeSig = '\u0000';      // memo for the cheap is-active repaint
  let dragSuppressClick = false;
  let destroyed = false;

  /**
   * Where the focus must land after the rebuild one of OUR writes triggers, armed for
   * exactly the length of that synchronous write (see `queueFocus`). It is never left
   * armed across a turn: a host whose verb is a no-op or settles later would otherwise
   * have the next unrelated rebuild yank the caret out of whatever the user had moved on
   * to - a canvas text box, say - and into this list.
   */
  let pendingFocus: { id: string; layers: boolean; index: number } | null = null;

  /** Thumbnails are expensive clones of the live page - keep one per row signature. */
  const thumbs = new Map<string, { sig: string; el: HTMLElement }>();
  // A thumbnail is a clone of the LIVE page, and the shell paints the page one animation
  // frame after the model emits (tool.ts defers the canvas rebuild to rAF) while this
  // column rebuilds its rows on the emit itself. Cloning on the emit pictured the previous
  // edit, and the memo then kept that picture until the next edit of the same board. So a
  // row queues its thumbnail and one rAF pass builds the queue: the shell requested its
  // frame first, so ours runs after the paint (the ordering free-canvas's scheduleSync
  // relies on for its own chrome).
  const pendingThumbs = new Map<string, { b: Box; sig: string; slot: HTMLElement }>();
  let thumbRaf = 0;
  function queueThumb(id: string, b: Box, sig: string, slot: HTMLElement): void {
    pendingThumbs.set(id, { b, sig, slot });
    if (!thumbRaf) thumbRaf = requestAnimationFrame(flushThumbs);
  }
  function flushThumbs(): void {
    thumbRaf = 0;
    const queue = [...pendingThumbs.entries()];
    pendingThumbs.clear();
    for (const [id, p] of queue) {
      // A row rebuilt again before this frame queued its own slot; the old one is gone.
      if (destroyed || !el.contains(p.slot)) continue;
      let node: HTMLElement | null = null;
      try { node = thumb(p.b, THUMB_W, THUMB_H); } catch { node = null; }
      if (node) { thumbs.set(id, { sig: p.sig, el: node }); p.slot.replaceChildren(node); }
    }
  }

  // ── DOM shell ───────────────────────────────────────────────────────────────
  const el = make('aside', `fc-nav fc-nav--${skin}`);
  el.setAttribute('data-export-hide', '');
  el.setAttribute('data-live-hide', '');
  el.setAttribute('aria-label', tRaw('Navigator'));
  // The canvas-keyboard opt-out, the same statement the Design top bar and the edge dock
  // make. The canvas editor binds its bare-key verbs on `window`, so a focused row here
  // was a live canvas surface: Delete on a layer row removed the canvas selection, and an
  // arrow key moved a box instead of the caret. This column owns its own row keys.
  el.setAttribute('data-canvas-keys', 'off');

  const head = make('div', 'fc-nav-head');
  const titleEl = make('h2', 'fc-nav-title', t('Artboards'));
  const toggleBtn = make('button', 'fc-nav-toggle');
  toggleBtn.type = 'button';
  const bodyEl = make('div', 'fc-nav-body');
  const listEl = make('div', 'fc-nav-list');
  listEl.setAttribute('role', 'listbox');
  // The canvas can hold two artboards (or two layers) at once, and this list MIRRORS that
  // selection rather than owning it - so the listbox has to admit that more than one row
  // can read as selected, or a screen reader is told a single-select list is lying.
  listEl.setAttribute('aria-multiselectable', 'true');
  listEl.setAttribute('data-nav-list', 'frames');
  const emptyEl = make('p', 'fc-nav-empty', t('No artboards yet.'));
  emptyEl.hidden = true;
  // A document with boxes and no artboards (plans/184 R15): one press draws an artboard
  // around everything, and each loose layer's row carries the same verb for itself.
  const makeAllBtn = make('button', 'btn btn--sm fc-nav-make-all', t('Make an artboard around everything'));
  makeAllBtn.type = 'button';
  makeAllBtn.hidden = true;
  makeAllBtn.addEventListener('click', () => {
    const ids = looseOf(model.getBoxes()).map((b) => fieldStr(b, F.id)).filter(Boolean);
    if (ids.length) actions.makeArtboard?.(ids);
  });
  const layersEl = make('section', 'fc-nav-layers');
  const layersHead = make('h3', 'fc-nav-subhead', t('Layers'));
  const layersList = make('div', 'fc-nav-layer-list');
  layersList.setAttribute('role', 'listbox');
  layersList.setAttribute('aria-multiselectable', 'true');
  layersList.setAttribute('data-nav-list', 'layers');
  // A real <ul>: the dots are buttons, so each needs its own list item to sit in rather
  // than an overridden role. `role="list"` is restated because `list-style: none` drops
  // the implicit one in Safari/VoiceOver.
  const railEl = make('ul', 'fc-nav-rail');
  railEl.setAttribute('role', 'list');
  /**
   * THE TOOL RAIL'S SEAT. free-canvas re-parents its `.fc-toolbar` in here while this
   * column is open, so the editor has one left sidebar instead of a column with a
   * floating palette beside it (Andy, 2026-09-02). Empty and hidden are different
   * things: `hidden` is this column's open state and is what free-canvas reads to decide
   * whether to hand the rail over, while an empty-but-open slot is exactly the state it
   * looks for. The sheet collapses `:empty` so an editor with no rail loses no space.
   */
  const railSlot = make('div', 'fc-nav-rail-slot');
  railSlot.setAttribute('data-nav-rail-slot', '');
  /**
   * The column's own edge grip - the same drag the inputs sidebar has always had
   * (views/tool.ts `#sidebar-drag-handle`), down to the shared `.resize-grip` look.
   * A `separator` with a value is the window-splitter pattern, so the width is
   * reachable from the keyboard as well as the pointer.
   */
  const grip = make('div', 'fc-nav-grip resize-grip');
  grip.setAttribute('role', 'separator');
  grip.setAttribute('aria-orientation', 'vertical');
  grip.setAttribute('aria-label', tRaw('Resize navigator'));
  grip.setAttribute('aria-valuemin', String(NAV_RAIL_WIDTH));
  grip.setAttribute('aria-valuemax', String(NAV_MAX_WIDTH));
  grip.tabIndex = 0;

  head.append(titleEl, toggleBtn);
  layersEl.append(layersHead, layersList);
  bodyEl.append(listEl, emptyEl, makeAllBtn);
  if (skin === 'column') bodyEl.append(layersEl);
  else layersEl.hidden = true;
  el.append(head);
  if (skin === 'column') el.append(railSlot);
  el.append(bodyEl);
  if (skin === 'column') el.append(railEl, grip);

  // ── model reads ─────────────────────────────────────────────────────────────
  const isFrame = (b: Box | undefined): boolean => !!b && fieldStr(b, F.kind) === F.frameKind;

  /** Frames in PAGE order: order asc, x asc - the tie-break the tool's hook uses. */
  function framesOf(boxes: Box[]): Box[] {
    return boxes.filter(isFrame)
      .sort((a, b) => (num(a[F.order]) - num(b[F.order])) || (num(a[F.x]) - num(b[F.x])));
  }

  /** "Slides" once any frame carries timing, speaker notes or a build step. */
  function isDeck(boxes: Box[], frames: Box[]): boolean {
    if (framesAreSequenced(boxes, { kindField: F.kind, frameKind: F.frameKind, startField: F.start, durField: F.dur })) return true;
    return frames.some((b) => String(b[NOTES] ?? '').trim() !== '' || authored(b[BUILD]));
  }

  const hasNotes = (b: Box): boolean => String(b[NOTES] ?? '').trim() !== '';

  /**
   * What this slide's dot says (plans/180 section 8).
   *
   * With a narration port it is the port's own four-state answer; without one - a host
   * with no speech bridge - a slide with notes still shows the dot it has always shown,
   * which is why `pending` doubles as "has speaker notes" and the label is chosen by
   * whether narration exists at all rather than by the state alone.
   */
  function narrationStatusOf(b: Box, id: string): NarrationStatus {
    if (narration) return narration.status(id);
    return hasNotes(b) ? 'pending' : 'none';
  }

  /** The dot's accessible name: what a reader hears, and what a pointer sees on hover. */
  function narrationLabel(st: NarrationStatus): string {
    if (!narration) return tRaw('Has speaker notes');
    if (st === 'current') return tRaw('Narrated');
    if (st === 'stale') return tRaw('Narrated, but the notes changed since');
    return tRaw('Speaker notes, not narrated yet');
  }

  /** The children of a frame, in ARRAY order (first paints first / sits at the back). */
  function childrenOf(boxes: Box[], frameId: string): Box[] {
    if (!frameId) return [];
    return boxes.filter((b) => !!b && !isFrame(b) && fieldStr(b, F.frame) === frameId);
  }

  /** Every box that is not a frame - the layers of a document that has no artboards. */
  function looseOf(boxes: Box[]): Box[] {
    return boxes.filter((b) => !!b && !isFrame(b));
  }

  /** One decimal of seconds, the timeline's own notation. */
  const secs = (v: unknown): string => (Math.round(Number(v) * 10) / 10).toFixed(1);

  /**
   * A timed box's place on the timeline, in the row's own words (plans/184 R15): a
   * navigator that lists the layers of a timeline document has to say WHEN each one is,
   * or the list is a set of names with nothing to tell them apart.
   */
  function timeChip(b: Box): HTMLElement | null {
    const startRaw = b[F.start];
    if (startRaw == null || startRaw === '' || !Number.isFinite(Number(startRaw))) return null;
    const dur = Number(b[F.dur]);
    const when = Number.isFinite(dur) && dur > 0
      ? tRaw('{start}s for {dur}s', { start: secs(startRaw), dur: secs(dur) })
      : tRaw('from {start}s', { start: secs(startRaw) });
    const seq = String(b['lane'] ?? '') === 'seq';
    const chip = make('span', 'fc-nav-layer-time', seq ? `${t('Sequence')} ${when}` : when);
    chip.title = seq ? t('On the sequence lane') : t('On its own lane');
    return chip;
  }

  const frameName = (b: Box, i: number): string => {
    const v = String(b[F.label] ?? '').trim();
    // `Artboard` is a key all 26 catalogues carry; `Artboard {n}` is in none of them.
    return v || `${tRaw('Artboard')} ${i + 1}`;
  };

  /**
   * One hash per frame id covering everything DRAWN on that page: the frame box itself
   * and, chained in array order, each of its children. This is the thumbnail's memo. The
   * row's own fields are not enough - a thumbnail is a clone of the live page, so it goes
   * stale on the first keystroke into a text box on that board and stays stale for the
   * session, which in a slide navigator breaks the primary way to find a slide.
   */
  function pageHashes(boxes: Box[]): Map<string, number> {
    const out = new Map<string, number>();
    for (const b of boxes) {
      if (!b) continue;
      if (isFrame(b)) {
        const id = fieldStr(b, F.id);
        if (id) out.set(id, hashBox(out.get(id) ?? 5381, b));
        continue;
      }
      const fid = fieldStr(b, F.frame);
      if (fid) out.set(fid, hashBox(out.get(fid) ?? 5381, b));
    }
    return out;
  }

  /** Per-row memo: everything a row PAINTS, so an unrelated edit rebuilds nothing. */
  function rowSig(b: Box, i: number, page: number): string {
    return [
      fieldStr(b, F.id), String(b[F.order] ?? ''), String(b[F.x] ?? ''),
      String(b[F.w] ?? ''), String(b[F.h] ?? ''), String(b[F.label] ?? ''),
      // The narration dot, not just "has notes": narrating a slide changes nothing in
      // the row's own fields, so without the status in here the dot would keep saying
      // "not narrated yet" until some unrelated edit happened to rebuild the row.
      narrationStatusOf(b, fieldStr(b, F.id)), String(b[F.dur] ?? ''),
      // The M4 flags, and this frame's own transition to the next slide: all three are
      // painted by the row (the chip, and the layer rows' toggles), so all three move it.
      String(b[F.hidden] ?? ''), String(b[F.locked] ?? ''), String(b[F.trans] ?? ''), String(i),
      // …and the page's own content, which is what the THUMBNAIL is a picture of.
      String(page),
    ].join(':');
  }

  // ── writes (rename, reorder, and the two layer flags - nothing else) ────────

  /** Renumber `order` densely 0..n-1 to match `seq`, in ONE commit. `x` is untouched. */
  function applySeq(seq: string[]): void {
    const boxes = model.getBoxes();
    model.commit(renumberFrameOrder(boxes, seq, {
      kindField: F.kind, idField: F.id, orderField: F.order, frameKind: F.frameKind,
    }));
  }

  /**
   * Arm the focus hand-back for the rebuild the NEXT statement triggers, and disarm it
   * the moment that statement returns. Scoping it to one synchronous write is the whole
   * point: `render` only ever consumes a flag its own caller just set, so a verb that
   * commits nothing (an optional `NavigatorActions` method the host left off) cannot
   * leave a live claim on the user's focus behind it.
   */
  function queueFocus(id: string, list: HTMLElement, run: () => void): void {
    const rows = rowsOf(list);
    const at = rows.findIndex((r) => (r.dataset.id ?? '') === id);
    pendingFocus = { id, layers: list === layersList, index: at < 0 ? 0 : at };
    try { run(); } finally { pendingFocus = null; }
  }

  function moveFrame(id: string, delta: number): void {
    const boxes = model.getBoxes();
    const ids = framesOf(boxes).map((b) => fieldStr(b, F.id));
    const next = moveInSeq(ids, id, delta);
    if (next.join('|') === ids.join('|')) return;
    queueFocus(id, listEl, () => applySeq(next));
    const b = boxes.find((x) => fieldStr(x, F.id) === id);
    const at = next.indexOf(id);
    announceMove(b ? frameName(b, at) : '', at, next.length);
  }

  /** A reorder repaints silently, so the only report a screen reader gets is this one. */
  function announceMove(name: string, at: number, total: number): void {
    if (!name) return;
    // tRaw: announce() writes into a live region's textContent, so an escaped
    // apostrophe in a board's name would be READ OUT as an entity.
    announce(tRaw('{name} moved to {n} of {total}', { name, n: at + 1, total }));
  }

  function renameFrame(id: string, value: string): void {
    model.setField([id], F.label, value);
  }

  /**
   * Flip one layer flag - hidden or locked - on ONE row, in one commit.
   *
   * A boolean, not the string the URL codec happens to store: `setField` is the tool
   * view's coalescing `setInput` wrapper and the manifest declares both fields as
   * booleans, so the value written here is the value the hook reads back.
   */
  function setFlag(id: string, field: string, on: boolean): void {
    model.setField([id], field, on);
  }

  /** This frame's own transition, with '' resolved to the document's. */
  function transitionOf(b: Box): { own: string; resolved: string } {
    const own = fieldStr(b, F.trans).trim();
    return { own, resolved: own || String(model.getInput('transition') ?? '').trim() };
  }

  /** The chip's word for a transition value. The wire value itself is the fallback. */
  function transitionWord(kind: string): string {
    switch (kind) {
      case 'slide': return t('Slide');
      case 'fade': return t('Fade');
      case 'morph': return t('Morph');
      case 'flight': return t('Fly');
      case 'none': return t('Cut');
      case 'custom': return t('Custom');
      default: return kind.replace(/[-_]/g, ' ');
    }
  }

  /** One preview at a time: a second click while one runs is the same answer twice. */
  let previewing = false;

  /**
   * Play the move from this slide into the NEXT one, once, on the live canvas.
   *
   * The player is the timeline panel's own `playOnce`, imported on the click rather than
   * at mount: the panel is a large chunk this column has no other reason to pull in, and
   * a build where it does not export one yet leaves the chip as a label and nothing else.
   * Everything that decides whether there is anything to play is read first and
   * synchronously, so a chip on the last slide (or a canvas with no pages, which is every
   * jsdom test) costs no import at all.
   *
   * The page the preview runs on is the one being entered, and the enter kind comes from
   * {@link slideTransitionPair}, so what the chip plays is what the presenter will do.
   * `custom` has no derived pair by design - the frame's own timeline enter is the truth
   * there - so the preview falls back to the deck's transition rather than inventing one.
   */
  function previewTransition(id: string): void {
    if (previewing) return;
    const frames = framesOf(model.getBoxes());
    const at = frames.findIndex((b) => fieldStr(b, F.id) === id);
    const here = at >= 0 ? frames[at] : undefined;
    const next = at >= 0 ? frames[at + 1] : undefined;
    if (!here || !next) return;
    const { own, resolved } = transitionOf(here);
    const kind = own === 'custom' ? String(model.getInput('transition') ?? '').trim() : resolved;
    const pair = slideTransitionPair(kind);
    if (!pair || pair.enter === 'none') return;
    const page = canvasEl.querySelector<HTMLElement>(`.lolly-frame-page[data-frame-id="${cssId(fieldStr(next, F.id))}"]`);
    if (!page) return;
    previewing = true;
    void playEnter(page, pair.enter);
  }

  /**
   * Run one enter on `page`. The kind is STAMPED for the length of the preview and taken
   * off again: a per-slide transition is not a box animation, so nothing on the page
   * carries it as authored data, and the player reads it off the element. Every attribute
   * written here is put back exactly as it was found - absent stays absent - so a preview
   * leaves the document byte-identical.
   */
  async function playEnter(page: HTMLElement, enter: string): Promise<void> {
    const attrs: Array<[string, string]> = [['data-t-enter', enter], ['data-t-enter-ms', String(PREVIEW_MS)]];
    const before = attrs.map(([k]) => [k, page.getAttribute(k)] as const);
    try {
      const mod = await import('./timeline-panel.ts').catch(() => null);
      const play = (mod as { playOnce?: (el: Element, ms: number) => void } | null)?.playOnce;
      if (typeof play !== 'function' || destroyed) return;
      for (const [k, v] of attrs) page.setAttribute(k, v);
      play(page, PREVIEW_MS);
      await new Promise((done) => setTimeout(done, PREVIEW_MS + 80));
    } catch { /* the player refused: the chip is still a label, and the page is untouched */ }
    finally {
      // Unconditional, so an early return and a throw put the page back the same way a
      // finished preview does. Writing a value that is already there costs nothing.
      for (const [k, v] of before) { if (v == null) page.removeAttribute(k); else page.setAttribute(k, v); }
      previewing = false;
    }
  }

  // ── selection ───────────────────────────────────────────────────────────────
  function selectFrame(id: string): void {
    selection.set([id]);
    artboard.focus(id);
    // On a phone this navigator is a temporary bottom sheet, not permanent
    // workspace. Once the requested artboard is on screen, give the canvas back.
    if (skin === 'strip') setOpen(false);
  }

  // ── row menu ────────────────────────────────────────────────────────────────
  let menuEl: HTMLElement | null = null;
  let menuOwnerId = '';
  /** The control the open menu hangs off - it owns its own toggle, so it is not "outside". */
  let menuAnchor: HTMLElement | null = null;

  const view = (): Window | null => document.defaultView;

  function closeMenu(restoreFocus = false): void {
    if (!menuEl) return;
    const owner = listEl.querySelector<HTMLElement>(`[data-nav-row][data-id="${cssId(menuOwnerId)}"]`);
    menuEl.remove();
    menuEl = null;
    menuOwnerId = '';
    menuAnchor = null;
    document.removeEventListener('pointerdown', onDocPointerDown, true);
    const w = view();
    w?.removeEventListener('scroll', onViewportShift, true);
    w?.removeEventListener('resize', onViewportShift);
    for (const b of listEl.querySelectorAll('[data-nav-menu-btn]')) b.setAttribute('aria-expanded', 'false');
    if (restoreFocus && owner) owner.focus();
  }

  function onDocPointerDown(ev: Event): void {
    if (!menuEl) return;
    const target = ev.target as Node | null;
    // The kebab owns its own toggle. This listener is on `document` in the CAPTURE phase,
    // so it runs BEFORE the button's own click; closing here would reset `menuOwnerId`,
    // the click would then read "no menu is mine" and re-open the one it meant to
    // dismiss, and the menu could never be closed by the control that opened it.
    if (target && (menuEl.contains(target) || menuAnchor?.contains(target))) return;
    closeMenu();
  }

  /** A viewport-anchored menu cannot follow its row, so a scroll or a resize closes it. */
  function onViewportShift(): void { closeMenu(); }

  /**
   * Anchor the menu under `row` in VIEWPORT coordinates (the sheet positions it `fixed`).
   * That is the only placement that survives this column: `.fc-nav` is `overflow: hidden`
   * AND the positioned ancestor, so an absolutely-placed menu is clipped away at the
   * bottom of the list, and `offsetTop` inside the scrolling body measures content
   * coordinates that no longer match where the row is painted once the list has scrolled.
   * With no layout at all (jsdom) every read is 0 and the CSS placement stands.
   */
  function placeMenu(menu: HTMLElement, row: HTMLElement): void {
    const w = view();
    const vw = w?.innerWidth ?? 0;
    const vh = w?.innerHeight ?? 0;
    const r = row.getBoundingClientRect?.();
    const m = menu.getBoundingClientRect?.();
    if (!r || !m || vw <= 0 || vh <= 0) return;
    const mh = m.height || 0;
    const mw = m.width || 0;
    const below = r.bottom + MENU_GAP;
    const above = r.top - mh - MENU_GAP;
    // Below by default; above only when below would run off the viewport and above fits.
    const top = (below + mh <= vh || above < MENU_GAP)
      ? Math.max(MENU_GAP, Math.min(below, vh - mh - MENU_GAP))
      : above;
    menu.style.top = `${Math.round(top)}px`;
    menu.style.left = `${Math.round(Math.max(MENU_GAP, Math.min(r.left, vw - mw - MENU_GAP)))}px`;
    // Width is the sheet's business, not this function's: an inline `min-width` here would
    // out-rank the sheet's `min-inline-size` (inline style beats a stylesheet, and the two
    // are the same property in a horizontal writing mode), so a 96px filmstrip row would
    // squash its own menu to 96px.
  }

  /** A value safe inside an attribute selector (ids are ulids today, but never assume). */
  function cssId(id: string): string {
    return id.replace(/["\\]/g, '\\$&');
  }

  /** A row's actions button, which is its SIBLING (see buildFrameRow's role note). */
  function kebabOf(row: HTMLElement): HTMLElement | null {
    return row.parentElement?.querySelector<HTMLElement>('[data-nav-menu-btn]') ?? null;
  }

  function openRowMenu(id: string, row: HTMLElement, index: number): void {
    closeMenu();
    const boxes = model.getBoxes();
    const frames = framesOf(boxes);
    const ids = frames.map((b) => fieldStr(b, F.id));
    const at = ids.indexOf(id);
    const b0 = boxes.find((x) => fieldStr(x, F.id) === id);
    const name = b0 ? frameName(b0, index) : '';
    // The SAME word the list title chose. The labels were fixed literals, so a poster or
    // a multi-artboard print document - correctly titled "Artboards", every row an
    // artboard - right-clicked into "Duplicate slide" / "Delete slide" / "Add artboard
    // after" in one menu. The vocabulary is a property of the document, not of the menu.
    const deck = isDeck(boxes, frames);
    const menu = make('div', 'fc-nav-menu');
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', deck ? tRaw('Slide actions') : tRaw('Artboard actions'));
    const item = (label: string, glyph: IconName | null, flip: boolean, disabled: boolean, run: () => void): void => {
      const b = make('button', `fc-nav-menu-item${flip ? ' fc-nav-flip' : ''}`);
      b.type = 'button';
      b.setAttribute('role', 'menuitem');
      if (disabled) { b.disabled = true; b.setAttribute('aria-disabled', 'true'); }
      const g = glyph ? iconNode(glyph) : null;
      if (g) b.append(g);   // icon() already stamps aria-hidden
      b.append(make('span', 'fc-nav-menu-label', label));
      b.addEventListener('click', () => {
        // Focus first, THEN run: the item the user is standing on is about to be removed
        // from the document, and every one of these verbs rebuilds the list underneath
        // it. Handing focus back to the row (and re-claiming it through the rebuild) is
        // what keeps a keyboard user inside the navigator instead of on <body>.
        closeMenu(true);
        queueFocus(id, listEl, run);
      });
      menu.append(b);
    };
    item(deck ? t('Duplicate slide') : t('Duplicate artboard'), 'duplicate', false, false, () => {
      actions.duplicateFrame(id);
      if (name) announce(tRaw('{name} duplicated', { name }));
    });
    item(deck ? t('Delete slide') : t('Delete artboard'), 'trash', false, false, () => {
      actions.deleteFrame(id);
      if (name) announce(tRaw('{name} deleted', { name }));
    });
    if (actions.present) item(t('Present from here'), 'play', false, false, () => actions.present!(id));
    item(deck ? t('Add slide after') : t('Add artboard after'), 'plus', false, false, () => {
      actions.addArtboardAfter(id);
      announce(t('Artboard added'));
    });
    item(t('Move up'), 'chevronDown', true, at <= 0, () => moveFrame(id, -1));
    item(t('Move down'), 'chevronDown', false, at < 0 || at >= ids.length - 1, () => moveFrame(id, 1));
    menu.addEventListener('keydown', (ev: KeyboardEvent) => {
      const items = [...menu.querySelectorAll<HTMLButtonElement>('.fc-nav-menu-item:not([disabled])')];
      const here = items.indexOf(document.activeElement as HTMLButtonElement);
      if (ev.key === 'Escape') { ev.stopPropagation(); closeMenu(true); }
      else if (ev.key === 'ArrowDown') { ev.preventDefault(); items[(here + 1) % items.length]?.focus(); }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); items[(here - 1 + items.length) % items.length]?.focus(); }
      else if (ev.key === 'Tab') closeMenu();
    });
    el.append(menu);
    menuEl = menu;
    menuOwnerId = id;
    menuAnchor = kebabOf(row);
    placeMenu(menu, row);
    menuAnchor?.setAttribute('aria-expanded', 'true');
    document.addEventListener('pointerdown', onDocPointerDown, true);
    const w = view();
    w?.addEventListener('scroll', onViewportShift, true);
    w?.addEventListener('resize', onViewportShift);
    menu.querySelector<HTMLButtonElement>('.fc-nav-menu-item:not([disabled])')?.focus();
  }

  // ── rename ──────────────────────────────────────────────────────────────────
  function startRename(id: string, row: HTMLElement, index: number): void {
    if (renamingId) return;
    const nameEl = row.querySelector<HTMLElement>('[data-nav-name]');
    if (!nameEl) return;
    renamingId = id;
    const boxes = model.getBoxes();
    const b = boxes.find((x) => fieldStr(x, F.id) === id);
    const input = make('input', 'fc-nav-name-input');
    input.type = 'text';
    input.value = b ? String(b[F.label] ?? '') : '';
    input.placeholder = `${tRaw('Artboard')} ${index + 1}`;
    input.setAttribute('aria-label', isDeck(boxes, framesOf(boxes)) ? tRaw('Rename slide') : tRaw('Rename artboard'));
    input.setAttribute('data-nav-name-input', '');
    let done = false;
    const finish = (commit: boolean): void => {
      if (done) return;
      done = true;
      renamingId = '';
      const value = input.value.trim();
      input.replaceWith(nameEl);
      if (commit && b && value !== String(b[F.label] ?? '')) renameFrame(id, value);
      else render();
      const back = listEl.querySelector<HTMLElement>(`[data-nav-row][data-id="${cssId(id)}"]`);
      back?.focus();
    };
    input.addEventListener('keydown', (ev: KeyboardEvent) => {
      ev.stopPropagation();
      if (ev.key === 'Enter') { ev.preventDefault(); finish(true); }
      else if (ev.key === 'Escape') { ev.preventDefault(); finish(false); }
    });
    input.addEventListener('blur', () => finish(true));
    input.addEventListener('pointerdown', (ev: Event) => ev.stopPropagation());
    nameEl.replaceWith(input);
    input.focus();
    input.select();
  }

  // ── drag to reorder ─────────────────────────────────────────────────────────
  interface DragState {
    id: string;
    list: HTMLElement;
    kind: 'frames' | 'layers';
    x0: number;
    y0: number;
    live: boolean;
  }
  let drag: DragState | null = null;

  const horizontal = (): boolean => skin === 'strip';

  function rowsOf(list: HTMLElement): HTMLElement[] {
    return [...list.querySelectorAll<HTMLElement>('[data-nav-row]')];
  }

  /** Where the pointer says the dragged row goes: the index of the row it drops before. */
  function dropIndex(list: HTMLElement, ev: MouseEvent): number {
    const rows = rowsOf(list);
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]!.getBoundingClientRect();
      const mid = horizontal() ? r.left + r.width / 2 : r.top + r.height / 2;
      const p = horizontal() ? ev.clientX : ev.clientY;
      if (p < mid) return i;
    }
    return rows.length;
  }

  function clearDropMarks(): void {
    for (const r of [...rowsOf(listEl), ...rowsOf(layersList)]) {
      r.classList.remove('is-drop-before', 'is-drop-after', 'is-dragging');
    }
  }

  function onDragMove(ev: Event): void {
    if (!drag) return;
    const me = ev as MouseEvent;
    if (!drag.live) {
      const moved = Math.abs(me.clientX - drag.x0) + Math.abs(me.clientY - drag.y0);
      if (moved < DRAG_SLOP) return;
      drag.live = true;
      drag.list.classList.add('is-reordering');
      drag.list.querySelector<HTMLElement>(`[data-nav-row][data-id="${cssId(drag.id)}"]`)?.classList.add('is-dragging');
    }
    const at = dropIndex(drag.list, me);
    const rows = rowsOf(drag.list);
    for (const r of rows) r.classList.remove('is-drop-before', 'is-drop-after');
    if (at < rows.length) rows[at]!.classList.add('is-drop-before');
    else rows[rows.length - 1]?.classList.add('is-drop-after');
  }

  function onDragEnd(ev: Event): void {
    if (!drag) return;
    const { id, list, kind, live } = drag;
    drag = null;
    document.removeEventListener('pointermove', onDragMove, true);
    document.removeEventListener('pointerup', onDragEnd, true);
    document.removeEventListener('pointercancel', onDragCancel, true);
    list.classList.remove('is-reordering');
    if (!live) { clearDropMarks(); return; }
    // The click that always follows a pointerup must not re-select the row the drop just
    // moved; the timer is the belt for a drop that no click follows at all.
    dragSuppressClick = true;
    setTimeout(() => { dragSuppressClick = false; }, 0);
    const at = dropIndex(list, ev as MouseEvent);
    const ids = rowsOf(list).map((r) => r.dataset.id ?? '');
    clearDropMarks();
    const next = insertAt(ids, id, at);
    if (next.join('|') === ids.join('|')) return;
    queueFocus(id, list, () => { if (kind === 'frames') applySeq(next); else commitLayerOrder(next); });
  }

  function onDragCancel(): void {
    if (!drag) return;
    const list = drag.list;
    drag = null;
    document.removeEventListener('pointermove', onDragMove, true);
    document.removeEventListener('pointerup', onDragEnd, true);
    document.removeEventListener('pointercancel', onDragCancel, true);
    list.classList.remove('is-reordering');
    clearDropMarks();
  }

  function beginDrag(ev: MouseEvent, id: string, list: HTMLElement, kind: 'frames' | 'layers'): void {
    if (renamingId) return;
    drag = { id, list, kind, x0: ev.clientX, y0: ev.clientY, live: false };
    document.addEventListener('pointermove', onDragMove, true);
    document.addEventListener('pointerup', onDragEnd, true);
    document.addEventListener('pointercancel', onDragCancel, true);
  }

  // ── layers ──────────────────────────────────────────────────────────────────
  /**
   * `displayIds` are top-first; the overlay wants PAINT order, which is the reverse.
   * Reports whether anything was actually handed over: `reorderChildren` is an OPTIONAL
   * verb, so a host that has not wired it makes every layer reorder a silent no-op.
   */
  function commitLayerOrder(displayIds: string[]): boolean {
    const frameId = artboard.active();
    if (!frameId || !actions.reorderChildren) return false;
    actions.reorderChildren(frameId, [...displayIds].reverse());
    return true;
  }

  function moveLayer(id: string, delta: number): void {
    const rows = rowsOf(layersList);
    const ids = rows.map((r) => r.dataset.id ?? '');
    const next = moveInSeq(ids, id, delta);
    if (next.join('|') === ids.join('|')) return;
    let moved = false;
    queueFocus(id, layersList, () => { moved = commitLayerOrder(next); });
    if (!moved) return;
    const at = next.indexOf(id);
    announceMove(rows.find((r) => (r.dataset.id ?? '') === id)?.textContent ?? '', at, next.length);
  }

  // ── row building ────────────────────────────────────────────────────────────
  function chip(cls: string, text: string, label: string): HTMLElement {
    const c = make('span', `fc-nav-chip ${cls}`, text);
    c.title = label;
    c.setAttribute('aria-label', label);
    return c;
  }

  function buildFrameRow(b: Box, i: number, sig: string): HTMLElement {
    const id = fieldStr(b, F.id);
    const row = make('div', 'fc-nav-row');
    row.dataset.id = id;
    row.setAttribute('data-nav-row', '');
    row.setAttribute('role', 'option');
    row.setAttribute('aria-selected', 'false');
    row.tabIndex = -1;

    const thumbSlot = make('span', 'fc-nav-thumb');
    thumbSlot.setAttribute('aria-hidden', 'true');
    const cached = thumbs.get(id);
    if (cached && cached.sig === sig) thumbSlot.append(cached.el);
    else queueThumb(id, b, sig, thumbSlot);
    row.append(thumbSlot);

    row.append(make('span', 'fc-nav-idx', String(i + 1)));

    const main = make('span', 'fc-nav-main');
    const name = make('span', 'fc-nav-name', frameName(b, i));
    name.setAttribute('data-nav-name', '');
    main.append(name);

    const meta = make('span', 'fc-nav-meta');
    // The narration dot (plans/180 section 8). One dot, four answers: absent when the
    // slide has nothing to say, hollow while its notes are unspoken, filled once they
    // are narrated, and marked stale when the notes moved after the voice was made.
    // Stale is the state the whole feature turns on - it is what makes re-generating
    // the author's decision rather than a re-synthesis on every keystroke.
    const narrSt = narrationStatusOf(b, id);
    if (narrSt !== 'none') {
      const dot = make('span', 'fc-nav-dot');
      dot.setAttribute('role', 'img');
      // Only where narration is real: without the port the dot is the notes mark it has
      // always been, and must keep the look it has always had (see design-navigator.css).
      if (narration) dot.setAttribute('data-narration', narrSt);
      const label = narrationLabel(narrSt);
      dot.title = label;
      dot.setAttribute('aria-label', label);
      meta.append(dot);
    }
    // How this slide changes into the next one. The frame's own `slideTransition` (M4)
    // answers first; '' means "follow the deck", which is shown dimmed and still marked
    // `data-doc-default` so the two reads stay tellable apart at a glance and in a test.
    // 'none' is a real answer here - a slide that cuts while the deck fades is worth a
    // chip - which is why the frame's own value is not put through `authored`.
    const { own, resolved } = transitionOf(b);
    const inherited = own === '';
    const shown = inherited ? (authored(resolved) ? resolved : '') : own;
    if (shown) {
      // The WORD, not the wire value. The chip's visible text is already translated
      // through `transitionWord`, so naming the button 'Transition: flight' left a
      // screen reader (and anyone hovering) with the internal token beside a chip
      // reading "Fly" - and in any non-English locale the two disagreed outright.
      const label = own === 'custom'
        ? tRaw('Transition: set in the timeline')
        : tRaw('Transition: {name}', { name: transitionWord(shown) });
      const c = make('button', `fc-nav-chip fc-nav-chip--trans${inherited ? ' is-inherited' : ''}`, transitionWord(shown));
      c.type = 'button';
      // The kebab's rule, for the kebab's reason: a `role="option"` flattens its content
      // to an accessible name, so this button is not separately reachable to a screen
      // reader and must not become a tab stop either. What it SAYS is the state, which
      // does reach the row's name; what it DOES is reached from the row instead, with P
      // (`onRowKey`) - the same shape as the kebab's Shift+F10. The timeline offers no
      // second door onto this one: its Preview button resolves `.lolly-box[data-box-id]`
      // and an artboard is a `.lolly-frame-page`, so a frame's Enter row never grows one.
      c.tabIndex = -1;
      c.setAttribute('aria-keyshortcuts', 'p');
      c.title = label;
      c.setAttribute('aria-label', label);
      if (inherited) c.setAttribute('data-doc-default', '1');
      c.setAttribute('data-nav-trans', '');
      // The row underneath answers a press with a select, and a double press with a
      // rename: neither is what pressing the chip twice quickly means.
      c.addEventListener('pointerdown', (ev: Event) => ev.stopPropagation());
      c.addEventListener('dblclick', (ev: Event) => ev.stopPropagation());
      c.addEventListener('click', (ev: Event) => { ev.stopPropagation(); previewTransition(id); });
      meta.append(c);
    }
    const dur = num(b[F.dur], 0);
    if (dur > 0 && authored(model.getInput('autoAdvance'))) {
      const n = String(Math.round(dur * 10) / 10);
      meta.append(chip('fc-nav-chip--dwell', tRaw('{n}s', { n }), tRaw('Auto-advance {n}s', { n })));
    }
    if (meta.childNodes.length) main.append(meta);
    row.append(main);

    const menuBtn = make('button', 'fc-nav-row-menu');
    menuBtn.type = 'button';
    menuBtn.tabIndex = -1;
    menuBtn.setAttribute('data-nav-menu-btn', '');
    menuBtn.setAttribute('aria-haspopup', 'menu');
    menuBtn.setAttribute('aria-expanded', 'false');
    menuBtn.setAttribute('aria-label', tRaw('Actions for {name}', { name: frameName(b, i) }));
    const g = iconNode('menuDots');
    if (g) menuBtn.append(g);
    menuBtn.addEventListener('pointerdown', (ev: Event) => ev.stopPropagation());
    menuBtn.addEventListener('click', (ev: Event) => {
      ev.stopPropagation();
      if (menuOwnerId === id) closeMenu(true); else openRowMenu(id, row, i);
    });

    row.addEventListener('pointerdown', (ev: Event) => beginDrag(ev as MouseEvent, id, listEl, 'frames'));
    row.addEventListener('click', () => {
      if (dragSuppressClick) { dragSuppressClick = false; return; }
      selectFrame(id);
    });
    row.addEventListener('dblclick', () => startRename(id, row, i));
    row.addEventListener('contextmenu', (ev: Event) => { ev.preventDefault(); openRowMenu(id, row, i); });
    row.addEventListener('keydown', (ev: KeyboardEvent) => onRowKey(ev, id, row, i, listEl, 'frames'));

    // THE KEBAB IS THE ROW'S SIBLING, not its child (review finding, 2026-09-02). A
    // `role="option"` element's content is flattened to its accessible NAME, so a button
    // inside one is not in the accessibility tree at all: every artboard's actions menu
    // was unreachable to a screen reader, with only the keyboard's Shift+F10 left. The
    // wrapper is `role="presentation"`, so the listbox still owns the option directly.
    const item = make('div', 'fc-nav-item');
    item.setAttribute('role', 'presentation');
    item.append(row, menuBtn);
    return item;
  }

  /**
   * One layer flag toggle - the eye or the padlock - as a real button BESIDE the row.
   *
   * Beside, not inside, for the frame kebab's reason: a `role="option"` flattens its
   * content into the option's accessible name, so a button in there is both unreachable
   * to a screen reader and read out as part of the layer's name. `aria-pressed` carries
   * the state and the label carries the verb, which is what the press will do next.
   *
   * Out of the tab order for that same reason, and therefore reached from the ROW: H
   * hides, L locks (`onRowKey`), announced through `aria-keyshortcuts`. Without a key
   * these two were pointer-only - a keyboard user could arrow to a layer and had no way
   * to hide or lock it anywhere except the inspector's Object section, which needs that
   * column docked open.
   */
  function flagBtn(glyph: IconName, on: boolean, label: string, run: () => void): HTMLElement {
    const b = make('button', `fc-nav-layer-btn${on ? ' is-on' : ''}`);
    b.type = 'button';
    b.tabIndex = -1;
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.setAttribute('aria-label', label);
    b.setAttribute('aria-keyshortcuts', glyph === 'lock' ? 'l' : 'h');
    b.title = label;
    b.setAttribute('data-nav-flag', glyph === 'lock' ? 'locked' : 'hidden');
    const g = iconNode(glyph);
    if (g) b.append(g);
    // The press must not also start a reorder drag on the row it sits beside.
    b.addEventListener('pointerdown', (ev: Event) => ev.stopPropagation());
    b.addEventListener('click', (ev: Event) => { ev.stopPropagation(); run(); });
    return b;
  }

  function buildLayerRow(b: Box, i: number, loose = false): HTMLElement {
    const id = fieldStr(b, F.id);
    const kind = fieldStr(b, F.kind) || 'box';
    const hidden = boolFlag(b[F.hidden]);
    const locked = boolFlag(b[F.locked]);
    const row = make('div', `fc-nav-layer${hidden ? ' is-hidden' : ''}${locked ? ' is-locked' : ''}`);
    row.dataset.id = id;
    row.setAttribute('data-nav-row', '');
    row.setAttribute('role', 'option');
    row.setAttribute('aria-selected', 'false');
    row.tabIndex = -1;
    const g = iconNode(kindIcon(kind));
    if (g) {
      const slot = make('span', 'fc-nav-layer-glyph');
      slot.append(g);
      row.append(slot);
    }
    const named = String(b[F.label] ?? '').trim();
    const label = named || layerTextLabel(String(b[F.text] ?? '')) || kindWord(kind);
    row.append(make('span', 'fc-nav-layer-name', label));
    // The state, in the row's own text. The toggles are outside the option (see
    // `flagBtn`), so without this a hidden layer is announced exactly like a visible one.
    const state = [hidden ? t('Hidden') : '', locked ? t('Locked') : ''].filter(Boolean).join(', ');
    if (state) row.append(make('span', 'fc-nav-layer-state', state));
    const when = timeChip(b);
    if (when) row.append(when);
    row.addEventListener('click', () => {
      if (dragSuppressClick) { dragSuppressClick = false; return; }
      selection.set([id]);
    });
    if (actions.reorderChildren) {
      row.addEventListener('pointerdown', (ev: Event) => beginDrag(ev as MouseEvent, id, layersList, 'layers'));
    }
    row.addEventListener('keydown', (ev: KeyboardEvent) => onRowKey(ev, id, row, i, layersList, 'layers'));

    const item = make('div', 'fc-nav-layer-item');
    item.setAttribute('role', 'presentation');
    item.append(
      row,
      flagBtn(hidden ? 'eyeOff' : 'eye', hidden, hidden ? t('Show layer') : t('Hide layer'),
        () => setFlag(id, F.hidden, !hidden)),
      flagBtn('lock', locked, locked ? t('Unlock layer') : t('Lock layer'),
        () => setFlag(id, F.locked, !locked)),
    );
    // A loose layer (no artboard anywhere) can become the first one's contents.
    if (loose && actions.makeArtboard) item.append(verbBtn(kindIcon(F.frameKind), t('Make artboard'), () => actions.makeArtboard?.([id])));
    return item;
  }

  /** A row-side verb: the flag button's shape without a pressed state. */
  function verbBtn(glyph: IconName, label: string, run: () => void): HTMLElement {
    const b = make('button', 'fc-nav-layer-btn');
    b.type = 'button';
    b.tabIndex = -1;
    b.setAttribute('aria-label', label);
    b.title = label;
    b.setAttribute('data-nav-verb', 'make-artboard');
    const g = iconNode(glyph);
    if (g) b.append(g);
    b.addEventListener('pointerdown', (ev: Event) => ev.stopPropagation());
    b.addEventListener('click', (ev: Event) => { ev.stopPropagation(); run(); });
    return b;
  }

  /**
   * A key this list ACTED on stops here. `onRootKey` is the belt for everything else;
   * this is the braces, at the node that consumed the press.
   */
  function swallow(ev: KeyboardEvent): void {
    ev.preventDefault();
    ev.stopPropagation();
  }

  /** One keyboard contract for both lists: move focus, select, rename, reorder, menu. */
  function onRowKey(ev: KeyboardEvent, id: string, row: HTMLElement, index: number, list: HTMLElement, kind: 'frames' | 'layers'): void {
    // An app-wide chord is not one of this list's keys: ⌘/Ctrl+Return presents, ⌘S
    // saves. Answering `Enter` here regardless of the modifier turned ⌘Return - pressed
    // on the very slide you want to present from - into a rename.
    if (ev.metaKey || ev.ctrlKey) return;
    const rows = rowsOf(list);
    const here = rows.indexOf(row);
    const step = (delta: number): void => {
      const next = rows[Math.max(0, Math.min(rows.length - 1, here + delta))];
      if (next && next !== row) { next.tabIndex = 0; row.tabIndex = -1; next.focus(); }
    };
    const fwd = horizontal() ? 'ArrowRight' : 'ArrowDown';
    const back = horizontal() ? 'ArrowLeft' : 'ArrowUp';
    if (ev.altKey && (ev.key === 'ArrowUp' || ev.key === 'ArrowDown')) {
      swallow(ev);
      const delta = ev.key === 'ArrowUp' ? -1 : 1;
      if (kind === 'frames') moveFrame(id, delta); else moveLayer(id, delta);
      return;
    }
    if (ev.key === fwd) { swallow(ev); step(1); return; }
    if (ev.key === back) { swallow(ev); step(-1); return; }
    if (ev.key === 'Home') { swallow(ev); step(-rows.length); return; }
    if (ev.key === 'End') { swallow(ev); step(rows.length); return; }
    if (kind === 'frames' && (ev.key === 'F2' || ev.key === 'Enter')) {
      // Enter/F2 renames (the row's own editable thing); Space is "go to this board".
      swallow(ev);
      startRename(id, row, index);
      return;
    }
    if (ev.key === ' ') { swallow(ev); if (kind === 'frames') selectFrame(id); else selection.set([id]); return; }
    // The two flag toggles beside a layer row, and the transition preview beside a frame
    // row, are all `tabIndex = -1` (see `flagBtn` and the chip): they are announced on
    // the row and operated from it. Without these three keys the capabilities were
    // pointer-only.
    if (kind === 'layers' && (ev.key === 'h' || ev.key === 'H')) { swallow(ev); toggleFlag(id, F.hidden); return; }
    if (kind === 'layers' && (ev.key === 'l' || ev.key === 'L')) { swallow(ev); toggleFlag(id, F.locked); return; }
    if (kind === 'frames' && (ev.key === 'p' || ev.key === 'P')) { swallow(ev); previewTransition(id); return; }
    if (kind === 'frames' && (ev.key === 'ContextMenu' || (ev.shiftKey && ev.key === 'F10'))) {
      swallow(ev);
      openRowMenu(id, row, index);
    }
  }

  /** Flip one layer flag from whatever the model currently holds. */
  function toggleFlag(id: string, field: string | undefined): void {
    if (!field) return;
    const b = model.getBoxes().find((r) => fieldStr(r, F.id) === id);
    if (!b) return;
    setFlag(id, field, !boolFlag(b[field]));
  }

  /**
   * THE GATE. The navigator is a widget, not a canvas: a key pressed inside it must never
   * ALSO drive the editor. free-canvas binds its shortcuts on `window` and bails only for
   * a typing target (INPUT/TEXTAREA/SELECT/contenteditable) or focus inside `.tl-panel` -
   * and a `role="option"` div is neither. Without this, ArrowDown to walk to the next
   * slide would nudge the selected artboard a pixel and push an undo step on the way
   * past, Alt+Arrow would reorder AND nudge in two commits, and Space would arm the
   * canvas's pan. This module cannot edit that handler, so it stops its own keys on the
   * way out instead.
   *
   * APP-WIDE CHORDS ALWAYS TRAVEL. The modifier is tested BEFORE the owned-key list,
   * not after it: a chord means the same thing wherever focus is (⌘Z undo, ⌘S save,
   * ⌘/Ctrl+Return present), and gating it on the list's own keys silently ate
   * ⌘Return - the list of slides being the most natural place to be standing when you
   * want to present from one. `onRowKey` declines the same chords for the same reason,
   * so nothing here answers them twice either.
   */
  function onRootKey(ev: KeyboardEvent): void {
    // THE TOOL RAIL IS A GUEST, NOT A ROW. free-canvas parks its `.fc-toolbar` in the slot
    // while this column is open, and its buttons are canvas controls: the tool letters,
    // Delete and the arrows belong to the editor there exactly as they do when the rail
    // floats. This column speaks for its own rows, not for a palette it lends a seat to.
    if ((ev.target as Element | null)?.closest?.('[data-nav-rail-slot]')) return;
    if (ev.key === 'Escape') {
      if (menuEl) { ev.stopPropagation(); closeMenu(true); return; }
      // ESCAPE LEAVES THE COLUMN (review finding, 2026-09-02) - it does not fall through
      // to the editor's own Escape ladder, whose first rung clears the selection. Someone
      // pressing Escape in a list of slides means "put me back on the canvas", and losing
      // the selection they had just walked to on the way is not part of that.
      ev.stopPropagation();
      handBackToCanvas();
      return;
    }
    if (ev.metaKey || ev.ctrlKey) return;
    ev.stopPropagation();
  }

  /**
   * Hand the keyboard back to the artwork: the selected card if the overlay has made it
   * focusable (it gives every rendered box a tabindex), else nothing in particular -
   * blurring is enough, because the editor binds its shortcuts on `window` and only this
   * column's own gate was keeping them out.
   */
  function handBackToCanvas(): void {
    const first = selection.get()[0];
    const box = first ? canvasEl.querySelector<HTMLElement>(`.lolly-box[data-box-id="${cssId(String(first))}"]`) : null;
    if (box) { box.focus?.(); return; }
    const active = document.activeElement as HTMLElement | null;
    if (active && el.contains(active)) active.blur?.();
  }

  // ── render ──────────────────────────────────────────────────────────────────
  function render(force = false): void {
    // A live drag owns the rows it is dragging between, and a rename owns its input:
    // a rebuild under either drops the very node the gesture is holding.
    if (destroyed || renamingId || drag?.live) return;
    const boxes = model.getBoxes();
    const frames = framesOf(boxes);
    const deck = isDeck(boxes, frames);
    const activeId = artboard.active();
    // No artboards at all (a timeline document, plans/184 R15): every box is a layer of
    // the document itself, listed with its timing, rather than an empty column.
    const loose = frames.length === 0;
    const kids = skin === 'column' ? (loose ? looseOf(boxes) : childrenOf(boxes, activeId)) : [];
    const pages = pageHashes(boxes);
    const sigs = frames.map((b, i) => rowSig(b, i, pages.get(fieldStr(b, F.id)) ?? 0));
    const sig = [
      sigs.join('|'), activeId, String(kids.length),
      kids.map((b) => `${fieldStr(b, F.id)}:${fieldStr(b, F.kind)}:${String(b[F.label] ?? '')}:${String(b[F.text] ?? '')}`
        + `:${String(b[F.hidden] ?? '')}:${String(b[F.locked] ?? '')}:${String(b[F.start] ?? '')}:${String(b[F.dur] ?? '')}:${String(b['lane'] ?? '')}`).join('~'),
      String(model.getInput('transition') ?? ''), String(model.getInput('autoAdvance') ?? ''),
      deck ? 'd' : 'a', open ? 'o' : 'c',
    ].join('#');
    if (!force && sig === listSig) { paintActive(); return; }
    listSig = sig;
    closeMenu();

    // ONE WORD PER DOCUMENT. The title's Slides/Artboards rule is the document's
    // vocabulary, not the heading's: the row menu already followed it, and the list's
    // own name and its empty state have to as well, or a deck says "No artboards yet."
    // under a heading that says Slides.
    titleEl.textContent = deck ? t('Slides') : t('Artboards');
    listEl.setAttribute('aria-label', deck ? tRaw('Slides') : tRaw('Artboards'));
    emptyEl.textContent = loose && kids.length
      ? t('No artboards. Every box is a loose layer, listed below.')
      : (deck ? t('No slides yet.') : t('No artboards yet.'));
    makeAllBtn.hidden = !(loose && kids.length > 0 && skin === 'column' && !!actions.makeArtboard);
    toggleBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggleBtn.setAttribute('aria-label', open ? tRaw('Hide navigator') : tRaw('Show navigator'));
    toggleBtn.title = open ? tRaw('Hide navigator') : tRaw('Show navigator');
    toggleBtn.replaceChildren();
    const tg = iconNode(open ? 'chevronLeft' : 'chevronRight');
    if (tg) toggleBtn.append(tg);

    // Frame rows.
    const keep = new Set(frames.map((b) => fieldStr(b, F.id)));
    for (const id of [...thumbs.keys()]) if (!keep.has(id)) thumbs.delete(id);
    listEl.replaceChildren(...frames.map((b, i) => buildFrameRow(b, i, sigs[i]!)));
    emptyEl.hidden = frames.length > 0;
    listEl.hidden = frames.length === 0;

    // The rail: numbered dots, one per frame, each focusing its board. The dot is a real
    // button inside a real list item - an explicit `role="listitem"` on the button itself
    // REPLACES the button role rather than adding to it, which drops the control out of a
    // screen reader's rotor and gives no hint that the thing is activatable.
    railEl.replaceChildren(...frames.map((b, i) => {
      const li = make('li', 'fc-nav-rail-item');
      const dot = make('button', 'fc-nav-dot-btn', String(i + 1));
      dot.type = 'button';
      dot.dataset.id = fieldStr(b, F.id);
      dot.setAttribute('aria-label', frameName(b, i));
      dot.addEventListener('click', () => selectFrame(fieldStr(b, F.id)));
      li.append(dot);
      return li;
    }));

    // Layers: the active board's children, reversed - the top of the list paints on top.
    if (skin === 'column') {
      const disp = [...kids].reverse();
      layersEl.hidden = disp.length === 0;
      layersHead.textContent = loose ? t('Loose layers') : t('Layers');
      layersList.setAttribute('aria-label', tRaw('{n} layers', { n: disp.length }));
      layersList.replaceChildren(...disp.map((b, i) => buildLayerRow(b, i, loose)));
    }

    paintActive(true);
    // A write of ours rebuilds the row the user is standing on, so hand the focus (and
    // the list's single tab stop) back to it - otherwise every Alt+Arrow, and every menu
    // verb, drops the keyboard onto <body> after one move. Two guards on the hand-back:
    // it only ever fires for a write still on the stack (`queueFocus`), and only while
    // the navigator still holds the keyboard - <body> counts, because the rebuild just
    // removed the row that had it, but a canvas text box the user has moved on to does
    // not, and must never be interrupted.
    const want = pendingFocus;
    if (want && navHasFocus()) {
      const list = want.layers ? layersList : listEl;
      const rows = rowsOf(list);
      // The row itself when it survived (a reorder), else whatever now stands in its
      // place (a delete), else the one control that is always there.
      const back = rows.find((r) => (r.dataset.id ?? '') === want.id)
        ?? rows[Math.max(0, Math.min(want.index, rows.length - 1))];
      if (back) {
        for (const r of rows) r.tabIndex = -1;
        back.tabIndex = 0;
        back.focus();
      } else toggleBtn.focus();
    }
  }

  /**
   * Does the navigator still hold the keyboard? `<body>` counts as ours: a rebuild that
   * replaced the focused row leaves the document focused on nothing at all, and that is
   * precisely the case the hand-back exists for.
   */
  function navHasFocus(): boolean {
    const a = document.activeElement;
    return !a || a === document.body || el.contains(a);
  }

  /** The cheap repaint: active board + selection, memoised on one signature. */
  function paintActive(force = false): void {
    const activeId = artboard.active();
    const ids = selection.get();
    const sig = `${activeId}|${[...ids].sort().join(',')}`;
    if (!force && sig === activeSig) return;
    activeSig = sig;
    const sel = new Set(ids.map(String));
    // The single tab stop follows the SELECTION first and the active board second: a
    // selected row is where the user just was, and the active board is only where the
    // editor is pointing. Falls back to the head of the list so a keyboard user can
    // always get in.
    const frameRows = rowsOf(listEl);
    const rowId = (r: HTMLElement): string => r.dataset.id ?? '';
    const roverFrame = frameRows.find((r) => sel.has(rowId(r)))
      ?? frameRows.find((r) => rowId(r) === activeId)
      ?? frameRows[0];
    for (const row of frameRows) {
      const id = rowId(row);
      // Two different claims, and they are not the same claim: `aria-selected` is the
      // canvas selection this list mirrors, `aria-current` is the board the editor is
      // pointing at. Collapsing them (the old `active || selected`) told a screen reader
      // a board was selected when nothing was, and left no way to name the active one.
      const chosen = sel.has(id);
      const current = id === activeId;
      row.classList.toggle('is-active', chosen || current);
      row.setAttribute('aria-selected', chosen ? 'true' : 'false');
      if (current) row.setAttribute('aria-current', 'true'); else row.removeAttribute('aria-current');
      row.tabIndex = row === roverFrame ? 0 : -1;
    }
    for (const dot of railEl.querySelectorAll<HTMLElement>('.fc-nav-dot-btn')) {
      const on = (dot.dataset.id ?? '') === activeId;
      dot.classList.toggle('is-active', on);
      if (on) dot.setAttribute('aria-current', 'true'); else dot.removeAttribute('aria-current');
    }
    const layerRows = rowsOf(layersList);
    const roverLayer = layerRows.find((r) => sel.has(r.dataset.id ?? '')) ?? layerRows[0];
    for (const row of layerRows) {
      const on = sel.has(row.dataset.id ?? '');
      row.classList.toggle('is-active', on);
      row.setAttribute('aria-selected', on ? 'true' : 'false');
      row.tabIndex = row === roverLayer ? 0 : -1;
    }
  }

  // ── open / close / width ────────────────────────────────────────────────────
  function widthNow(): number {
    if (skin === 'strip') return 0;
    return open ? openW : NAV_RAIL_WIDTH;
  }

  /** The one place the column's own box is written (the sheet carries the defaults). */
  function applyWidth(): void {
    if (skin !== 'column') return;
    el.style.width = `${widthNow()}px`;
    grip.setAttribute('aria-valuenow', String(widthNow()));
  }

  /**
   * Tell the host EVERY time the width moves, mid-drag included. The reserve is what
   * keeps the canvas beside the column rather than under it, so a width the host only
   * heard about on release would leave the artwork clipped for the whole gesture.
   */
  function report(): void {
    opts.onWidthChange?.(widthNow());
    try { canvasEl.dispatchEvent(new Event('canvas-resize', { bubbles: true })); } catch { /* no Event ctor - the host re-fits on its own */ }
  }

  /** Paint the open/closed shape. Shared by mount, the toggle and the drag's snap. */
  function applyOpenState(): void {
    el.classList.toggle('is-collapsed', !open);
    bodyEl.hidden = !open;
    titleEl.hidden = !open;
    // What free-canvas reads before it hands the tool rail over: a collapsed column is a
    // strip of dots with nowhere to put a grid of buttons.
    railSlot.hidden = !open || skin !== 'column';
    railEl.hidden = open || skin !== 'column';
    applyWidth();
  }

  function setOpen(next: boolean): void {
    const want = !!next;
    if (want === open) return;
    open = want;
    closeMenu();
    applyOpenState();
    listSig = '\u0000';
    render();
    opts.onOpenChange?.(open);
    report();
  }

  function saveWidth(): void {
    try { localStorage.setItem(NAV_WIDTH_KEY, String(openW)); } catch { /* no storage: this session only */ }
  }

  /**
   * Take a wanted edge position. Crossing `NAV_MIN_WIDTH` inward shuts the column to its
   * dot rail and crossing it outward re-opens it at the width the pointer is asking for,
   * so the grip is both the resize and the collapse - the way the inputs sidebar has
   * always behaved (views/tool.ts `setSidebarWidth`).
   */
  function setWidth(px: number, save = true): void {
    const want = navWidthFor(px);
    if (want.open) openW = want.width;
    // setOpen paints, re-renders and reports. With no crossing there is nothing to
    // rebuild, so the width write and the report are the whole job.
    if (want.open !== open) setOpen(want.open);
    else { applyWidth(); report(); }
    if (save && want.open) saveWidth();
  }

  // The drag: pointer capture, one write per frame, and the live width published on
  // every one of them (see `report`).
  let gripDrag: { pointerId: number; x0: number; w0: number } | null = null;
  let gripWant = 0;
  let gripRaf = 0;
  const onGripDown = (ev: PointerEvent): void => {
    if (ev.button !== 0 || gripDrag) return;
    gripDrag = { pointerId: ev.pointerId, x0: ev.clientX, w0: widthNow() };
    gripWant = gripDrag.w0;
    el.classList.add('is-dragging');
    try { grip.setPointerCapture(ev.pointerId); } catch { /* no pointer capture (jsdom) */ }
    ev.preventDefault();
    ev.stopPropagation();
  };
  const onGripMove = (ev: PointerEvent): void => {
    if (!gripDrag || ev.pointerId !== gripDrag.pointerId) return;
    // No button held any more means the pointerup was lost (a capture stolen by an
    // overlay). Finish, rather than letting a bare hover keep resizing the column.
    if (ev.type === 'pointermove' && ev.buttons === 0) { onGripUp(ev); return; }
    gripWant = gripDrag.w0 + (ev.clientX - gripDrag.x0);
    if (gripRaf) return;
    gripRaf = requestAnimationFrame(() => { gripRaf = 0; setWidth(gripWant, false); });
  };
  const onGripUp = (ev: PointerEvent): void => {
    if (!gripDrag || ev.pointerId !== gripDrag.pointerId) return;
    if (gripRaf) { cancelAnimationFrame(gripRaf); gripRaf = 0; }
    setWidth(gripWant);
    try { grip.releasePointerCapture(gripDrag.pointerId); } catch { /* never captured */ }
    gripDrag = null;
    el.classList.remove('is-dragging');
  };
  const onGripKey = (ev: KeyboardEvent): void => {
    if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
    const step = NAV_KEY_STEP * (ev.shiftKey ? 3 : 1);
    if (ev.key === 'ArrowRight') { ev.preventDefault(); setWidth(widthNow() + step); }
    else if (ev.key === 'ArrowLeft') { ev.preventDefault(); setWidth(widthNow() - step); }
    else if (ev.key === 'Home') { ev.preventDefault(); setWidth(NAV_RAIL_WIDTH); }
    else if (ev.key === 'End') { ev.preventDefault(); setWidth(NAV_MAX_WIDTH); }
  };
  grip.addEventListener('pointerdown', onGripDown);
  grip.addEventListener('pointermove', onGripMove);
  grip.addEventListener('pointerup', onGripUp);
  grip.addEventListener('pointercancel', onGripUp);
  grip.addEventListener('lostpointercapture', onGripUp);
  grip.addEventListener('keydown', onGripKey);
  // Double-click resets to the design width - the convention every splitter follows.
  grip.addEventListener('dblclick', () => setWidth(NAV_WIDTH));

  toggleBtn.addEventListener('click', () => setOpen(!open));
  el.addEventListener('keydown', onRootKey);

  // ── mount ───────────────────────────────────────────────────────────────────
  applyOpenState();
  stageEl.appendChild(el);
  render(true);

  const offModel = model.subscribe(() => render());
  const offSel = selection.onChange(() => paintActive());
  const offArt = artboard.onChange(() => { listSig = '\u0000'; render(); });
  opts.onWidthChange?.(widthNow());

  return {
    el,
    setOpen,
    isOpen: () => open,
    width: widthNow,
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      pendingFocus = null;
      // Whatever the host parked in the rail slot (the editor's tool rail) is the HOST's
      // node, not this column's: hand it back to the stage before this one goes, or the
      // rail is removed from the document along with the navigator. free-canvas re-homes
      // it in its own dock on its next reserve write, and on its own teardown.
      for (const kid of [...railSlot.children]) stageEl.appendChild(kid);
      closeMenu();
      onDragCancel();
      document.removeEventListener('pointermove', onDragMove, true);
      document.removeEventListener('pointerup', onDragEnd, true);
      document.removeEventListener('pointercancel', onDragCancel, true);
      document.removeEventListener('pointerdown', onDocPointerDown, true);
      offModel();
      offSel();
      offArt();
      if (thumbRaf) cancelAnimationFrame(thumbRaf);
      thumbRaf = 0;
      pendingThumbs.clear();
      thumbs.clear();
      el.remove();
    },
  };
}
