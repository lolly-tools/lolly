// SPDX-License-Identifier: MPL-2.0
import type { PresenceState } from '../../lib/collab-presence.ts';
import type { CollabSurface } from '../../lib/collab-surface.ts';
import type { FcCtx } from './context.ts';

/** Resolve remote ids against the current model before changing local chrome. */
interface PeerCanvas {
  disposed: boolean;
  blockId: string;
  cfg: Pick<FcCtx['cfg'], 'kindField'>;
  frameCfg?: Pick<NonNullable<FcCtx['frameCfg']>, 'frameKind' | 'frameField'>;
  select: Pick<FcCtx['select'], 'getBoxes' | 'idOf' | 'indexOfId'>;
  selectionPort: Pick<FcCtx['selectionPort'], 'set'>;
  document: Pick<FcCtx['document'], 'focusArtboard'>;
  textEdit: Pick<FcCtx['textEdit'], 'commitTextEdit'>;
}
export function revealCanvasPeer(fc: PeerCanvas, state: PresenceState): boolean {
  if (fc.disposed || !state.surface) return false;
  const boxes = fc.select.getBoxes();
  const frame = fc.frameCfg && boxes.find((box, i) => fc.select.idOf(box, i) === state.surface!.id && box[fc.cfg.kindField] === fc.frameCfg!.frameKind);
  if (!frame && state.surface.id !== `canvas:${fc.blockId}`) return false;
  const ids = [...new Set(state.selection ?? [])].slice(0, 200).filter(id => {
    const i = fc.select.indexOfId(boxes, id);
    if (i < 0) return false;
    return !frame || id === state.surface!.id || String(boxes[i]?.[fc.frameCfg!.frameField] ?? '') === state.surface!.id;
  });
  fc.textEdit.commitTextEdit();
  fc.selectionPort.set(ids.length ? ids : frame ? [state.surface.id] : []);
  if (frame) fc.document.focusArtboard(state.surface.id);
  return true;
}

/** The canvas pieces that bring a surface or a point into view without touching the selection. */
interface ViewCanvas {
  disposed: boolean;
  blockId: string;
  stageEl: HTMLElement;
  cfg: Pick<FcCtx['cfg'], 'kindField'>;
  frameCfg?: Pick<NonNullable<FcCtx['frameCfg']>, 'frameKind'>;
  select: Pick<FcCtx['select'], 'getBoxes' | 'idOf'>;
  stage: Pick<FcCtx['stage'], 'metrics' | 'nativeToStage'>;
  document: Pick<FcCtx['document'], 'focusArtboard'>;
}
/** True when `id` is this canvas or one of its artboards. */
function hasSurface(fc: ViewCanvas, id: string): boolean {
  if (id === `canvas:${fc.blockId}`) return true;
  const frameKind = fc.frameCfg?.frameKind;
  return !!frameKind && fc.select.getBoxes().some((box, i) => fc.select.idOf(box, i) === id && box[fc.cfg.kindField] === frameKind);
}

/**
 * `focusSurface` and `revealPoint` for the free canvas (plan 76 M4): following a person and
 * jumping to a comment move only the camera, never the selection. Both go through the stage's
 * `fc-focus-rect` seam, which applies the view at once, so there is no animation to reduce.
 */
export function canvasSurfaceView(fc: ViewCanvas): Required<Pick<CollabSurface, 'focusSurface' | 'revealPoint'>> {
  return {
    focusSurface(id) {
      if (fc.disposed || !hasSurface(fc, id)) return false;
      if (id !== `canvas:${fc.blockId}`) fc.document.focusArtboard(id);
      return true;
    },
    revealPoint(surfaceId, point) {
      if (fc.disposed || !hasSurface(fc, surfaceId) || ![point.x, point.y].every(v => Number.isFinite(v) && Math.abs(v) <= 1e6)) return false;
      const m = fc.stage.metrics(), at = fc.stage.nativeToStage(point.x, point.y, m);
      const x = m.sr.left + at.x, y = m.sr.top + at.y, cx = m.sr.left + m.sr.width / 2, cy = m.sr.top + m.sr.height / 2;
      // A zero-size rect revealed inside a one-pixel window at the stage centre: the stage
      // pans the point to the centre and keeps the zoom.
      const Event = fc.stageEl.ownerDocument.defaultView?.CustomEvent ?? CustomEvent;
      fc.stageEl.dispatchEvent(new Event('fc-focus-rect', { bubbles: true, detail: { x, y, w: 0, h: 0, viewport: { x: cx - .5, y: cy - .5, w: 1, h: 1 } } }));
      return true;
    },
  };
}
