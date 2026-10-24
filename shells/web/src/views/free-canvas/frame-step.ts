// SPDX-License-Identifier: MPL-2.0
/**
 * free-canvas: stepping between artboards from the keyboard.
 *
 * PageDown and PageUp go to the next and previous artboard in page order (the order the
 * navigator lists), Home and End to the first and last. Going to an artboard is what a
 * navigator row does: the artboard is selected, then framed through the stage's
 * `fc-focus-rect` route. The step counts from the artboard that holds the selection, or
 * from the last artboard stepped to once the selection is gone; from neither, PageDown
 * starts at the first artboard and PageUp at the last. The keys are left alone with a
 * modifier held, while typing (onKey returns before this for a field or a text edit),
 * and when something earlier on the page already handled them.
 */
import { announce } from '../../a11y.ts';
import { bindOp, type FcCtx } from './context.ts';

const STEP: Readonly<Record<string, 'next' | 'previous' | 'first' | 'last'>> = {
  PageDown: 'next',
  PageUp: 'previous',
  Home: 'first',
  End: 'last',
};

/** The id stepping counts from, or '' when there is none. */
function currentFrameId(fc: FcCtx, ids: string[]): string {
  if (fc.selection.size) {
    const active = fc.document.activeArtboardId();
    if (active && ids.includes(active)) return active;
  }
  return ids.includes(fc.frameStepId) ? fc.frameStepId : '';
}

/** Handle a stepping key; true when it was one and an artboard was framed. */
export function stepKey(fc: FcCtx, e: KeyboardEvent): boolean {
  const dir = STEP[e.key];
  if (!dir || !fc.frameCfg || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return false;
  const boxes = fc.select.getBoxes();
  const frames = fc.frameTitles.pageFrames(fc.document?.pageBoxes?.(boxes) || boxes);
  if (!frames.length) return false;
  const ids = frames.map(({ b, i }) => fc.select.idOf(b, i));
  const at = ids.indexOf(currentFrameId(fc, ids));
  const last = ids.length - 1;
  const to = dir === 'first' ? 0
    : dir === 'last' ? last
    : dir === 'next' ? (at < 0 ? 0 : Math.min(last, at + 1))
    : (at < 0 ? last : Math.max(0, at - 1));
  e.preventDefault();
  const id = ids[to]!;
  fc.frameStepId = id;
  fc.edges.deselectEdge();
  fc.selectionPort.set([id]);
  fc.artboardPort.focus(id);
  announce(fc.chromeSync.frameLabelText(frames[to]!.b, to));
  return true;
}

export function frameStepOps(fc: FcCtx) {
  return {
    stepKey: bindOp(fc, stepKey),
  };
}
