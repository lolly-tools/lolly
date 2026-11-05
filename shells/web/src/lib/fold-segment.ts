// SPDX-License-Identifier: MPL-2.0
/**
 * The one segment that a dialog, a sheet or the browse search keeps to on a fold.
 *
 * On a reported fold (lib/layout-posture.ts: native, viewport segments or a folded
 * posture) the screen is two pages, and anything that floats over both, a modal
 * dialog centred on the screen, the browse footer's search, would sit on the
 * crease. This module gives those surfaces one page: the segment holding the
 * control pane, so a dialog opens beside the controls that opened the dialog. On a
 * book fold that is the side away from the dominant hand (lib/hand-pref.ts),
 * mirrored in a right-to-left language; on a tabletop it is the lower half, the
 * deck.
 *
 * It writes the segment as insets and a size on <html>:
 *   --fold-seg-top, --fold-seg-right, --fold-seg-bottom, --fold-seg-left (px)
 *   --fold-seg-w, --fold-seg-h (px)
 * only while a fold is reported, and styles/parts/split.css places the surfaces
 * from them. A flat or continuous screen gets none of them, so a dialog there
 * keeps today's centring, and phone and desktop are byte-identical.
 */
import { currentLayout, onLayoutChange } from './layout-posture.ts';
import type { FoldRect, LayoutState } from './layout-posture.ts';
import { currentHand, onHandChange } from './hand-pref.ts';
import type { Hand } from './hand-pref.ts';

/** A segment, as distances from each edge of the viewport and its own size. */
export interface FoldSegment { top: number; right: number; bottom: number; left: number; width: number; height: number }

const PROPS = ['--fold-seg-top', '--fold-seg-right', '--fold-seg-bottom', '--fold-seg-left', '--fold-seg-w', '--fold-seg-h'] as const;

/**
 * The control pane's segment for a reported fold, or null when there is none.
 * Pure: the layout state, the hand, the direction and the window size in.
 */
export function controlSegment(state: LayoutState, hand: Hand, rtl: boolean, width: number, height: number): FoldSegment | null {
  const fold: FoldRect | null = state.layout === 'split' ? state.fold : null;
  if (!fold) return null;
  const r = (n: number): number => Math.max(0, Math.round(n));
  if (state.orientation === 'horizontal') {
    // A tabletop: the deck below the fold.
    const top = r(fold.y + fold.height);
    return { top, right: 0, bottom: 0, left: 0, width: r(width), height: r(height - top) };
  }
  const controlLeft = (hand === 'right') !== rtl;
  if (controlLeft) {
    const w = r(fold.x);
    return { top: 0, right: r(width - fold.x), bottom: 0, left: 0, width: w, height: r(height) };
  }
  const left = r(fold.x + fold.width);
  return { top: 0, right: 0, bottom: 0, left, width: r(width - left), height: r(height) };
}

/** Write a segment onto <html>, or take every property off with null. */
export function applyFoldSegment(seg: FoldSegment | null, doc: Document = document): void {
  const root = doc.documentElement;
  if (!seg) {
    for (const p of PROPS) root.style.removeProperty(p);
    if (root.getAttribute('style') === '') root.removeAttribute('style');
    return;
  }
  const values = [seg.top, seg.right, seg.bottom, seg.left, seg.width, seg.height];
  PROPS.forEach((p, i) => { root.style.setProperty(p, `${values[i]}px`); });
}

let running: (() => void) | null = null;

/**
 * Follow the layout, the hand, the direction and the window. Started once at boot,
 * after lib/layout-posture.ts. Returns the stop; a second start returns the first.
 */
export function startFoldSegments(win: Window = window): () => void {
  if (running) return running;
  const doc = win.document;
  const update = (): void => {
    applyFoldSegment(controlSegment(currentLayout(), currentHand(), doc.documentElement.dir === 'rtl', win.innerWidth, win.innerHeight), doc);
  };
  const offLayout = onLayoutChange(update);
  const offHand = onHandChange(update);
  win.addEventListener('resize', update);
  const dirWatch = typeof MutationObserver === 'function' ? new MutationObserver(update) : null;
  dirWatch?.observe(doc.documentElement, { attributes: true, attributeFilter: ['dir'] });
  update();
  running = () => {
    offLayout();
    offHand();
    win.removeEventListener('resize', update);
    dirWatch?.disconnect();
    applyFoldSegment(null, doc);
    running = null;
  };
  return running;
}
