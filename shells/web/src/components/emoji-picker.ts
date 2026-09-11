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
 * itself traps `fixed`.
 */
import './emoji-picker.css';
import { fixedContainingBlockOrigin } from './color-field.ts';
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

export interface EmojiPopoverOptions {
  /** Define the `<unicode-emoji-picker>` element. Swappable so a jsdom test can
   *  drive the popover against a stand-in element instead of loading the real
   *  web component (which wants a browser). */
  defineElement?: () => Promise<void>;
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

  const pop = document.createElement('div');
  pop.className = 'emoji-pop';
  pop.setAttribute('role', 'dialog');
  pop.setAttribute('aria-label', tRaw('Pick an emoji'));
  document.body.append(pop);

  let listeners: (() => void) | null = null;
  const close = (): void => {
    listeners?.();
    listeners = null;
    pop.remove();
    if (current?.close === close) current = null;
  };
  current = { close };

  await (options.defineElement ?? defineEmojiPicker)();
  // Either end can be gone already: the component load is a network round trip,
  // and in that time the popover can have been closed or the sidebar can have
  // rebuilt the cell out from under us (every structural table edit does).
  if (!pop.isConnected) return pop;
  if (!anchor.isConnected) { close(); return pop; }

  const picker: HTMLElement = document.createElement('unicode-emoji-picker');
  picker.setAttribute('version', EMOJI_VERSION);
  picker.addEventListener('emoji-pick', (event) => {
    const emoji = (event as CustomEvent<{ emoji?: unknown }>).detail?.emoji;
    if (typeof emoji === 'string') onPick(emoji);
    close();
  });
  pop.append(picker);

  position(pop, anchor);
  listeners = arm(pop, anchor, close);
  // Focus the first EMOJI, never the search box: a dialog should take focus, but
  // focusing a text input on a phone raises the keyboard over the grid the user
  // just asked to see. Search is one tap away for anyone who wants it.
  (picker as { focusContent?: (skipSearchInput?: boolean) => void }).focusContent?.(true);
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

/** Wire the three ways out. Returns the teardown. */
function arm(pop: HTMLElement, anchor: HTMLElement, close: () => void): () => void {
  const onDown = (e: Event): void => {
    // A press inside the picker's shadow DOM retargets to the host element, so
    // contains() on the wrapper is enough to tell inside from outside.
    const target = e.target as Node | null;
    if (pop.contains(target) || anchor.contains(target)) return;
    close();
  };
  const onKey = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape') return;
    close();
    anchor.focus();
  };
  // A fixed popover does not follow a scrolling sidebar, so a scroll dismisses it
  // rather than stranding it over unrelated controls. The anchor going away (a
  // sidebar rebuild) counts the same.
  const onScroll = (): void => { if (!anchor.isConnected || !pop.contains(document.activeElement)) close(); };
  // CAPTURE for the pointer press: canvas and drag layers stop pointerdown for
  // their own handling, which starves a bubble-phase closer and leaves the
  // popover open over nothing.
  document.addEventListener('pointerdown', onDown, true);
  document.addEventListener('keydown', onKey, true);
  window.addEventListener('scroll', onScroll, true);
  return () => {
    document.removeEventListener('pointerdown', onDown, true);
    document.removeEventListener('keydown', onKey, true);
    window.removeEventListener('scroll', onScroll, true);
  };
}
