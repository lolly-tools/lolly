// SPDX-License-Identifier: MPL-2.0
import type { PresenceState } from '../../lib/collab-presence.ts';
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
