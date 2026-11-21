// SPDX-License-Identifier: MPL-2.0
/**
 * The emoji picker popover - the editor behind a `table` input's `emoji` column
 * (schema `columnEditors`).
 *
 * The grid itself is `unicode-emoji-picker` (MIT, Julien Marcou): a web component
 * that reads the Unicode Emoji data files, so it knows every emoji in the 17.0
 * release rather than whatever list we would have frozen into the repo. This
 * module is the thin part around it - the popover box, where it opens, when it
 * closes, and what a pick does.
 *
 * ## Everything here is lazy
 *
 * Nothing in this file, its stylesheet, the component, or the 1.9 MB Noto Color
 * Emoji face is fetched until someone taps an emoji cell. That is why the import
 * of the component below is dynamic and why the stylesheet is imported HERE
 * rather than added to the app sheet: this module is only ever reached through a
 * dynamic import, so the bundler gives it, its CSS and the component their own
 * chunk. Do not import this module at the top level of anything on the boot path.
 *
 * ## Why the popover is on <body>
 *
 * A table cell can sit in the sidebar (which clips its overflow and carries a
 * backdrop filter), or inside a popped-out float panel. Mounting the popover on
 * <body> and positioning it `fixed` in viewport coordinates escapes every one of
 * those, the same conclusion components/color-field.ts reached - which is also
 * where fixedContainingBlockOrigin comes from, for the rare page whose <body>
 * itself traps `fixed`. A cell inside an open native <dialog> mounts the popover
 * in that dialog instead, the only place that paints above its backdrop.
 *
 * The popover is a mountBodyPopover panel, which owns its open and close: the
 * outside press, Escape, focus back to the cell, resize, scroll, a route change
 * and system Back on a touch device. Both listeners run in the capture phase,
 * because canvas and drag layers stop pointerdown for their own handling, and
 * Tab is left to the picker, whose controls sit in its shadow root.
 *
 * ## The grid draws the chosen set (plan 252)
 *
 * A caller that hands in `options.emoji` gets a grid painted from the emoji set
 * the document chose, not from whatever face the machine has: the runtime's own
 * pass walks the component's shadow root and swaps each cluster for the pack's
 * artwork. See drawPackArtwork below for what is drawn, when, and why a device
 * with no chosen set keeps the grid it already had.
 */
import './emoji-picker.css';
import { mountEmojiChoice } from './emoji-choice.ts';
import type { EmojiSelection } from './emoji-choice.ts';
import { fixedContainingBlockOrigin } from './color-field.ts';
import { mountBodyPopover } from './body-popover.ts';
import { tRaw } from '../i18n.ts';

/**
 * The Unicode Emoji release the picker offers. The component defaults to 12.0
 * (its own note: newer sets are missing on Windows 10), which we override
 * because the point of shipping our own colour font is that the glyphs are
 * there whatever the device has.
 */
export const EMOJI_VERSION = '17.0';

/** Margin kept between the popover and every viewport edge. */
const MARGIN = 8;

/**
 * The emoji pass, in the one member the picker calls. `runtime.applyEmojiToDom`
 * fits it as it is, and nothing here imports an engine emoji module: the caller
 * hands the pass in, so this chunk stays what it always was.
 */
export interface EmojiArtworkPass {
  apply(node: unknown): Promise<unknown>;
  /**
   * Put the characters back. The pass is idempotent by design, so a cell that is
   * already drawn is left alone: without a revert, a set chosen while the grid is
   * open would leave every drawn cell showing the set before it.
   * `runtime.revertEmojiDom` fits this as it is.
   */
  revert?(node: unknown): Promise<unknown>;
  /** Say when the chosen set or treatment changes. Returns the unsubscribe. Only
   *  a surface that outlives a choice needs it - the popover closes on the pick. */
  onSetChange?(fn: () => void): () => void;
}

export interface EmojiPopoverOptions {
  /** Define the `<unicode-emoji-picker>` element. Swappable so a jsdom test can
   *  drive the popover against a stand-in element instead of loading the real
   *  web component (which wants a browser). */
  defineElement?: () => Promise<void>;
  /** Draw every cell from the chosen emoji set. Left out, the grid stays exactly
   *  as the component drew it. */
  emoji?: EmojiArtworkPass;
  /** Require a document set before offering characters. */
  selection?: EmojiSelection;
}

/** A rectangle, in the members the placement maths actually reads. */
export interface Box { left: number; top: number; bottom: number; width: number; height: number }

/**
 * Where the popover goes for a given cell: under it when there is room, above it
 * when there is not, and always inside the viewport by MARGIN on every side.
 * Pure, so the phone case (a 393px-wide screen with a 369px-wide picker) is a
 * test rather than a device.
 */
export function placeEmojiPopover(
  anchor: Pick<Box, 'left' | 'top' | 'bottom'>,
  pop: Pick<Box, 'width' | 'height'>,
  view: { width: number; height: number },
): { left: number; top: number } {
  const below = anchor.bottom + 4;
  const above = anchor.top - 4 - pop.height;
  const flip = below + pop.height > view.height - MARGIN && above >= MARGIN;
  let top = flip ? above : below;
  top = Math.max(MARGIN, Math.min(top, view.height - pop.height - MARGIN));
  const left = Math.max(MARGIN, Math.min(anchor.left, view.width - pop.width - MARGIN));
  return { left: Math.round(left), top: Math.round(top) };
}

/** One popover at a time, so a second cell replaces the first rather than stacking. */
let current: { close: () => void } | null = null;

/** Close whatever popover is open. Safe to call when there is none. */
export function closeEmojiPopover(): void {
  current?.close();
}

let defined: Promise<void> | null = null;

/** Fetch + register the web component once per page. */
function defineEmojiPicker(): Promise<void> {
  defined ??= import('unicode-emoji-picker').then(({ defineUnicodeEmojiPicker }) => {
    defineUnicodeEmojiPicker();
  });
  return defined;
}

/** The class the engine's pass puts on every placement it makes. A string, not an
 *  import: this chunk must not pull an engine emoji module onto the page. */
const DRAWN_CLASS = 'lolly-emoji';

/**
 * The cells the component is showing right now. A cell it has scrolled past
 * carries `lazy-load`, a cell from another category carries `hidden`, and the
 * variation cells of a base cell are drawn with their parent rather than on their
 * own, which is why only a direct child of the grid matches.
 */
const VISIBLE_CELLS = '.emojis > .emoji:not(.hidden):not(.lazy-load)';

/** The counts the runtime's pass reports, when it is the runtime's pass talking. */
function drawnCounts(result: unknown): { replaced: number; unresolved: number } | null {
  if (!result || typeof result !== 'object') return null;
  const counts = result as { replaced?: unknown; unresolved?: unknown };
  if (typeof counts.replaced !== 'number' || typeof counts.unresolved !== 'number') return null;
  return { replaced: counts.replaced, unresolved: counts.unresolved };
}

/**
 * Give one cell's artwork local ids nobody else can claim.
 *
 * The engine names the ids inside a placement after the work item's place in the
 * tree it was handed, so two separate calls both start counting at the beginning
 * and two cells can mint the same gradient id. Inside one shadow root the first
 * one then wins for everybody, which paints one cell's gradient or clip path on
 * every later cell that named it. So each cell gets a tag of its own, written
 * onto the ids it owns and onto the references that name them. Running it twice
 * changes nothing, so a redraw after a set change is safe.
 */
export function scopeArtworkIds(cell: Element, tag: string): void {
  const renamed = new Map<string, string>();
  for (const owner of cell.querySelectorAll('[id]')) {
    const id = owner.getAttribute('id') ?? '';
    if (!id || id.startsWith(`${tag}-`)) continue;
    const next = `${tag}-${id}`;
    owner.setAttribute('id', next);
    renamed.set(id, next);
  }
  if (!renamed.size) return;
  for (const node of cell.querySelectorAll('*')) {
    for (const attribute of Array.from(node.attributes)) {
      const value = attribute.value;
      if (value.startsWith('url(#') && value.endsWith(')')) {
        const named = renamed.get(value.slice(5, -1));
        if (named) node.setAttribute(attribute.name, `url(#${named})`);
      } else if (value.startsWith('#')) {
        const named = renamed.get(value.slice(1));
        if (named) node.setAttribute(attribute.name, `#${named}`);
      }
    }
  }
}

/** What drawPackArtwork hands back: when the first pass is done, and how to stop. */
export interface EmojiArtworkRun {
  /** Settles once the first pass over the mounted grid has finished. */
  ready: Promise<void>;
  /** Draw the grid again from scratch, for a set chosen while it is open: the
   *  characters go back first, so the cells that are already drawn are redrawn
   *  rather than kept. A pass with no `revert` cannot do this and does nothing. */
  redraw(): void;
  /** Stop watching and draw nothing more. Safe to call twice. */
  stop(): void;
}

/**
 * Draw the grid from the chosen emoji set.
 *
 * The component attaches an OPEN shadow root, so the runtime's pass can walk it:
 * each cell's text node becomes the pack's artwork, with the characters kept in
 * the clipped span the engine writes, and the placement is styled inline, so no
 * stylesheet has to reach inside the shadow boundary. The component keeps its own
 * data, so search, keyboard focus and what a pick reports are all untouched.
 *
 * Three decisions a reader should know about.
 *
 * The whole grid is not drawn at once. Every cell of every category is in the DOM
 * from the moment the component mounts, and one pass over all of them measured
 * 2,982 ms in jsdom on a 2026 laptop: 3,953 cells, one distinct glyph each, from
 * the full Twemoji Color pack. A second pass over the same drawn grid is 163 ms,
 * so it is the first one that has to be kept small. Only the cells the component
 * is showing are drawn (about 99 ms for the 60 of a first screen), and each burst
 * (the grid being built, a category switch, a search, cells losing `lazy-load` as
 * they scroll into view) draws whatever became visible, coalesced through one
 * frame. A drawn cell is left alone, which the engine's own idempotence makes
 * cheap anyway.
 *
 * With no set drawing, the grid is left exactly as the component made it. A probe
 * over a detached copy of the tab strip says whether any artwork comes back: a
 * device with no packs, a document with no set chosen, or a host with no emoji
 * API at all gives nothing, and a grid of several thousand identical placeholders
 * is not a picker. The canvas is where a missing choice is reported, and the
 * Emoji section is where it is made.
 *
 * A set chosen while the grid is open redraws it. The engine's pass is idempotent,
 * so a cell that is already drawn would otherwise keep the set it was drawn with
 * for as long as the surface lives. A pass that also carries `revert` gets
 * `redraw()`: the characters go back, the probe runs again, and the visible cells
 * are drawn from the new set. Only a surface that outlives a choice needs it - the
 * popover closes on the pick - so the character browser wires `onSetChange` and the
 * popover does not.
 */
export function drawPackArtwork(picker: HTMLElement, pass: EmojiArtworkPass): EmojiArtworkRun {
  const root = picker.shadowRoot;
  // Two ways to stop. `halt` puts the watch down, which is what a probe reporting
  // no artwork does: nothing more is drawn, but the surface is still alive and a
  // set chosen later can start it again. `stop` retires the whole run and is the
  // teardown every exit calls.
  let stopped = false, retired = false;
  let pending: { handle: number; frames: boolean } | null = null;
  let running: Promise<void> | null = null;
  let queued = false, probed = false, scopes = 0, stale = false;
  let observer: MutationObserver | null = null;
  let unsubscribe: (() => void) | null = null;

  const halt = (): void => {
    stopped = true;
    observer?.disconnect();
    observer = null;
    if (pending?.frames) cancelAnimationFrame(pending.handle);
    else if (pending) clearTimeout(pending.handle);
    pending = null;
  };
  const stop = (): void => {
    retired = true;
    unsubscribe?.();
    unsubscribe = null;
    halt();
  };
  if (!root) return { ready: Promise.resolve(), redraw: () => {}, stop };

  const tags = new WeakMap<Element, string>();
  const tagFor = (cell: Element): string => {
    let tag = tags.get(cell);
    if (!tag) { tag = `c${scopes++}`; tags.set(cell, tag); }
    return tag;
  };

  const run = async (): Promise<void> => {
    if (stopped) return;
    // A set was chosen while the grid was open: the characters go back, so the
    // cells already drawn are drawn again from the new set rather than skipped as
    // finished, and the probe runs again so a choice that draws nothing hands the
    // component's own grid back rather than a wall of placeholders.
    if (stale && pass.revert) {
      stale = false;
      await pass.revert(root);
      if (stopped) return;
    }
    if (!probed) {
      const sample = (root.querySelector('.tabs') ?? root.querySelector('.emoji'))?.cloneNode(true);
      // Nothing is mounted yet. The next burst, which is the grid arriving, tries again.
      if (!sample) return;
      probed = true;
      const counts = drawnCounts(await pass.apply(sample));
      // Nothing draws: keep the grid the component made, and stop asking. Not a
      // teardown - a set chosen later reaches redraw() and starts this again.
      if (counts && counts.replaced === 0) { halt(); return; }
    }
    const targets: Element[] = [];
    // Each tab on its own, not the strip as a whole: a set that carries some tab
    // glyphs and not others would otherwise leave the rest showing the machine's
    // font for as long as the picker is open, because one drawn glyph made the
    // whole strip look finished.
    for (const tab of root.querySelectorAll('.tabs > *')) {
      if (!tab.querySelector(`.${DRAWN_CLASS}`)) targets.push(tab);
    }
    for (const cell of root.querySelectorAll(VISIBLE_CELLS)) {
      if (!cell.querySelector(`.${DRAWN_CLASS}`)) targets.push(cell);
    }
    for (const target of targets) {
      if (stopped) return;
      await pass.apply(target);
      scopeArtworkIds(target, tagFor(target));
    }
  };

  const kick = (): Promise<void> => {
    if (running) { queued = true; return running; }
    running = run()
      // A picker that cannot draw artwork is still a picker. Log it once, keep
      // the grid the component made and stop asking.
      .catch((e: unknown) => { console.warn(`emoji picker artwork: ${(e as Error)?.message ?? e}`); stop(); })
      .then(() => {
        running = null;
        if (queued && !stopped) { queued = false; void kick(); }
      });
    return running;
  };

  // One frame per burst: the grid rewrites itself on every category switch and
  // every keystroke in search, and each cell we draw is itself a change.
  const schedule = (): void => {
    if (stopped || pending) return;
    const fire = (): void => { pending = null; void kick(); };
    pending = typeof requestAnimationFrame === 'function'
      ? { handle: requestAnimationFrame(fire), frames: true }
      : { handle: setTimeout(fire, 16) as unknown as number, frames: false };
  };

  // Cells arrive and are replaced as childList changes; visibility is a class.
  const watch = (): void => {
    observer = new MutationObserver(schedule);
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  };

  const redraw = (): void => {
    if (retired || !pass.revert) return;
    // A run the probe put down starts again here, which is the first-run order: the
    // browser is opened with no set chosen, so nothing drew, and the set is chosen
    // after that.
    if (stopped) { stopped = false; watch(); }
    stale = true;
    probed = false;
    void kick();
  };

  watch();
  unsubscribe = pass.onSetChange?.(redraw) ?? null;
  return { ready: kick(), redraw, stop };
}

/**
 * Open the picker over `anchor`. `onPick` is called with the chosen emoji and the
 * popover closes itself; the caller only has to store the value.
 *
 * Returns the popover element (already in the document) so a caller or a test can
 * look at it; the returned promise settles once the picker itself is mounted.
 */
export async function openEmojiPopover(
  anchor: HTMLElement,
  onPick: (emoji: string) => void,
  options: EmojiPopoverOptions = {},
): Promise<HTMLElement> {
  closeEmojiPopover();

  let pop!: HTMLDivElement;
  let surface: (() => void) | null = null;
  // A cell the view rebuilds away leaves no anchor to close back to.
  const watchAnchor = new window.MutationObserver(() => { if (!anchor.isConnected) close(); });
  const dialog = anchor.closest<HTMLElement>('dialog[open]');
  const popover = mountBodyPopover(anchor, (el) => { pop = el; return null; }, {
    className: 'emoji-pop',
    role: 'dialog',
    ariaLabel: tRaw('Pick an emoji'),
    ...(dialog ? { container: dialog } : {}),
    position: (el) => position(el, anchor),
    trackScroll: true,
    capture: true,
    trapFocus: false,
    onClose: () => {
      watchAnchor.disconnect();
      surface?.();
      surface = null;
      const restoreFocus = pop.contains(document.activeElement);
      if (restoreFocus && anchor.isConnected) anchor.focus({ preventScroll: true });
      if (current === record) current = null;
    },
  });
  const close = (): void => { popover.close(); };
  const record = { close };
  current = record;

  // Dismissal is armed before either catalog or component download starts.
  popover.open();
  watchAnchor.observe(document.body, { childList: true, subtree: true });
  const stop = await mountEmojiChoice(pop, options.selection, async (body) => {
    await (options.defineElement ?? defineEmojiPicker)();
    if (!pop.isConnected || !anchor.isConnected) return () => {};
    const picker = document.createElement('unicode-emoji-picker');
    picker.setAttribute('version', EMOJI_VERSION);
    picker.addEventListener('emoji-pick', (event) => {
      const emoji = (event as CustomEvent<{ emoji?: unknown }>).detail?.emoji;
      close();
      if (typeof emoji === 'string' && anchor.isConnected) onPick(emoji);
    });
    body.append(picker);
    const artwork = options.emoji ? drawPackArtwork(picker, options.emoji) : null;
    (picker as { focusContent?: (skipSearchInput?: boolean) => void }).focusContent?.(true);
    return () => { artwork?.stop(); picker.remove(); };
  }, () => position(pop, anchor), close);
  if (!pop.isConnected || !anchor.isConnected) { stop(); close(); }
  else surface = stop;
  return pop;
}

/** Apply placeEmojiPopover's answer to the live element. */
function position(pop: HTMLElement, anchor: HTMLElement): void {
  // Viewport coordinates, then shifted into whatever box `fixed` is really laid
  // out against - normally the viewport itself, so this is a no-op.
  const origin = fixedContainingBlockOrigin(pop);
  const a = anchor.getBoundingClientRect();
  const p = pop.getBoundingClientRect();
  const at = placeEmojiPopover(a, p, { width: window.innerWidth, height: window.innerHeight });
  pop.style.left = `${at.left - origin.x}px`;
  pop.style.top = `${at.top - origin.y}px`;
}

/** The same picker as a persistent browsing surface. Picking does not dismiss it. */
export async function mountEmojiBrowser(
  container: HTMLElement,
  onPick: (emoji: string) => void,
  options: EmojiPopoverOptions = {},
): Promise<() => void> {
  return mountEmojiChoice(container, options.selection, async (body) => {
    await (options.defineElement ?? defineEmojiPicker)();
    const picker = document.createElement('unicode-emoji-picker');
    picker.setAttribute('version', EMOJI_VERSION);
    const pick = (event: Event): void => {
      const emoji = (event as CustomEvent<{ emoji?: unknown }>).detail?.emoji;
      if (typeof emoji === 'string') onPick(emoji);
    };
    picker.classList.add('emoji-browser');
    picker.addEventListener('emoji-pick', pick); body.append(picker);
    picker.selectTab('search');
    const artwork = options.emoji ? drawPackArtwork(picker, options.emoji) : null;
    return () => { artwork?.stop(); picker.removeEventListener('emoji-pick', pick); picker.remove(); };
  });
}
