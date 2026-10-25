// SPDX-License-Identifier: MPL-2.0
/**
 * The editor-only view state the canvas stage wears: `data-fc-moving` while the view is
 * being pinched, wheeled or dragged, and `data-fc-lod` for the level of detail at the
 * current zoom (views/free-canvas/lod.ts). Both are attributes on `#tool-stage`, never on
 * `#tool-canvas` or anything inside it, because thumbnails and present mode clone pages
 * and an export reads the canvas itself. editor.css keys every rule on them, so with
 * neither attribute present the canvas looks exactly as it did before either existed.
 *
 * A render must never see them. `holdStageView` strips both for as long as the hold
 * lasts and puts back the latest values when the last hold ends; a writer that asks for
 * a change while the stage is held only updates what will be put back. The export
 * suspend window (views/tool/exporting.ts) and the "Record live" take
 * (views/tool-actions/wiring.ts) hold the stage, and a pinned documentation capture
 * (lib/capture-neutral.ts) never has them written at all.
 * Listeners (the canvas media gate) hear when a hold starts and ends, so media the
 * level of detail paused plays again for the render.
 */
import { captureNeutralPinned } from './capture-neutral.ts';

/** Present while the view is moving: the compositor scales the last raster. */
export const STAGE_MOTION_ATTR = 'data-fc-moving';
/** The level-of-detail bucket; absent at `near`, so a close view adds nothing. */
export const STAGE_LOD_ATTR = 'data-fc-lod';
const ATTRS = [STAGE_MOTION_ATTR, STAGE_LOD_ATTR] as const;
export type StageViewAttr = typeof ATTRS[number];

interface StageViewState {
  holds: number;
  /** What the writers last asked for; written now, or put back when the holds end. */
  wanted: Map<StageViewAttr, string>;
  listeners: Set<(held: boolean) => void>;
}
const states = new WeakMap<Element, StageViewState>();
function stateOf(stage: Element): StageViewState {
  let s = states.get(stage);
  if (!s) { s = { holds: 0, wanted: new Map(), listeners: new Set() }; states.set(stage, s); }
  return s;
}

/** The canvas stage an element sits in (the stage itself included), if any. */
export function stageOf(node: Element | null | undefined): Element | null {
  return node?.closest?.('.tool-stage') ?? null;
}

/** Ask for an attribute (a string) or for its removal (null). */
export function setStageView(stage: Element, attr: StageViewAttr, value: string | null): void {
  const s = stateOf(stage);
  if (value === null) s.wanted.delete(attr);
  else s.wanted.set(attr, value);
  if (s.holds || captureNeutralPinned()) return;
  if (value === null) stage.removeAttribute(attr);
  else if (stage.getAttribute(attr) !== value) stage.setAttribute(attr, value);
}

/** True while a render holds the stage view off. */
export function stageViewHeld(stage: Element): boolean {
  return (states.get(stage)?.holds ?? 0) > 0;
}

/**
 * Strip the view attributes from the stage holding `node` until the returned release is
 * called. Holds nest; the release is idempotent. A node outside any stage (a CLI render,
 * a detached clone) gets a release that does nothing.
 */
export function holdStageView(node: Element | null | undefined): () => void {
  const stage = stageOf(node);
  if (!stage) return () => {};
  const s = stateOf(stage);
  if (s.holds++ === 0) {
    for (const attr of ATTRS) stage.removeAttribute(attr);
    for (const cb of s.listeners) { try { cb(true); } catch { /* a listener must not break the render */ } }
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--s.holds) return;
    if (!captureNeutralPinned()) for (const [attr, value] of s.wanted) stage.setAttribute(attr, value);
    for (const cb of s.listeners) { try { cb(false); } catch { /* see above */ } }
  };
}

/** Hear holds start (true) and end (false). Returns the unsubscribe. */
export function onStageViewHold(stage: Element, cb: (held: boolean) => void): () => void {
  const s = stateOf(stage);
  s.listeners.add(cb);
  return () => { s.listeners.delete(cb); };
}

/**
 * Mark the stage as moving for as long as the stage navigation reports motion (A5 of the
 * canvas performance review). Returns the teardown, which also clears the attribute.
 */
export function mountStageMotion(
  nav: { onMotion(start: () => void, end: () => void): () => void },
  stage: Element,
): () => void {
  const off = nav.onMotion(
    () => setStageView(stage, STAGE_MOTION_ATTR, ''),
    () => setStageView(stage, STAGE_MOTION_ATTR, null),
  );
  return () => { off(); setStageView(stage, STAGE_MOTION_ATTR, null); };
}
