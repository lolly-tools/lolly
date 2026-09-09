// SPDX-License-Identifier: MPL-2.0
/**
 * free-canvas: duplicate, delete and the vector boolean operations.
 *
 * Every function takes the shared `fc: FcCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `fc.<module>.<fn>`. Extracted verbatim
 * from initFreeCanvas() by scripts/split-closure.ts.
 */
import { boxRect, duplicateFrameWithChildren, framesInPageOrder, num, rehomeChildrenOfDeletedFrames, renumberFrameOrder, seedFrameOrders } from '../free-canvas-math.ts';
import type { Box } from '../free-canvas-math.ts';
import { offsetBoxes, replaceBoxes, strokeBoxesToPath } from '../vector-ops.ts';
import type { BooleanOpName, VectorOpFailure, VectorOpResult } from '../vector-ops.ts';
import { t } from '../../i18n.ts';
import type { RunVectorOpts } from './shared.ts';
import { bindOp, type FcCtx } from './context.ts';

/** Fields of a copied row that POINT AT another box, so a deep copy has to repoint them
 *  when the target came along in the same copy. `matchOf` is listed for completeness -
 *  it is a free-text morph TAG, not an id, so it only ever re-keys in the pathological
 *  case where someone typed a box id as their tag; an ordinary tag ("hero") is left
 *  alone, which is what lets a slide and its duplicate morph into each other. */
export const dupRefFields = (fc: FcCtx): string[] =>
  { const { cfg, cv } = fc; return [cfg.clipField, cv.linkField, cfg.bindStartField, cfg.bindEndField, 'matchOf'].filter(
    (f): f is string => !!f
  ); };
export function duplicateSelection(fc: FcCtx): void {
  const { FRAME_DUP_GAP, cfg, frameCfg } = fc;
  const boxes = fc.select.getBoxes();
  const idx = fc.select.selIndices(boxes);
  if (!idx.length) return;
  // plans/179 A8 - duplicating an ARTBOARD duplicates what is on it. Cloning the frame
  // row alone left an empty page appended last, and because `resolveFrame` answers with
  // the LAST containing frame, the next gesture on any child of the ORIGINAL re-bucketed
  // it into that empty duplicate. The deep copy fixes both halves: the children come
  // along with fresh ids, and the copy is placed clear to the RIGHT so no rect overlaps.
  //
  // Gated on a LONE frame: a mixed selection has no single answer for where the copy
  // goes, and a frame copy moves a whole page rather than nudging a box by 24px.
  const fk = frameCfg?.frameKind;
  if (frameCfg && fk && idx.length === 1 && String(boxes[idx[0]!]?.[cfg.kindField]) === fk) {
    const ff = fc.select.frameFields();
    const seeded = seedFrameOrders(boxes, ff); // A9: legacy docs get an order first
    const pool: Box[] = seeded.slice();
    const res = duplicateFrameWithChildren(
      seeded,
      fc.select.idOf(boxes[idx[0]!], idx[0]!),
      ff,
      {
        // Each minted id joins the pool, so two children can never draw the same one.
        id: () => {
          const id = fc.select.freshId(pool);
          pool.push({ [cfg.idField]: id } as Box);
          return id;
        },
        group: () => fc.objects.freshGroupId(pool),
      },
      { gap: FRAME_DUP_GAP, groupField: cfg.groupField, refFields: dupRefFields(fc) }
    );
    if (res.frameId) {
      fc.selection = new Set([res.frameId]); // the new PAGE, not its contents
      fc.select.commit(res.boxes);
      return;
    }
  }
  const clones: Box[] = [];
  const nextSel = new Set<string>();
  const pool = boxes.slice();
  for (const i of idx) {
    const id = fc.select.freshId(pool.concat(clones));
    const r = boxRect(boxes[i], cfg);
    const clone = {
      ...boxes[i],
      [cfg.idField]: id,
      [cfg.xField]: Math.round(r.x + 24),
      [cfg.yField]: Math.round(r.y + 24),
    };
    clones.push(clone);
    nextSel.add(id);
  }
  fc.selection = nextSel;
  fc.select.commit([...boxes, ...clones]);
}
export function deleteSelection(fc: FcCtx): void {
  const { cfg, frameCfg } = fc;
  const boxes = fc.select.getBoxes();
  const sel = new Set(fc.select.selIndices(boxes));
  if (!sel.size) return;
  fc.selection = new Set<string>();
  const fk = frameCfg?.frameKind;
  const deadFrames = fk ? [...sel].filter((i) => String(boxes[i]?.[cfg.kindField]) === fk) : [];
  if (!frameCfg || !deadFrames.length) {
    fc.select.commit(boxes.filter((_, i) => !sel.has(i)));
    return;
  }
  // plans/179 A7 - deleting an artboard used to orphan its children: they kept pointing
  // at a dead frame id, stayed visible in the editor as scratch, and were absent from
  // every PNG/PDF/PPTX export (the render only walks boxes whose stored `frame` names a
  // live page). They now move to the PREVIOUS artboard keeping their frame-local
  // position, or - when the deleted page was the first one - onto the pasteboard.
  //
  // One commit, so the whole thing is one undo step, and A9's renumber rides along in
  // it: the pages that remain are densely re-ordered, so deleting slide 2 makes slide 3
  // slide 2 rather than leaving a hole for the x tie-break to guess at.
  const ff = fc.select.frameFields();
  const seeded = seedFrameOrders(boxes, ff);
  // EVERY doomed row, not only the artboards. A child that is itself in the delete is
  // dropped by index one line below, so counting it as re-homed made the toast say
  // "its 12 items are now on the pasteboard" of a document Cmd+A had just emptied.
  // `rehomeChildrenOfDeletedFrames` skips any row whose own id is in the set, and a
  // non-frame id matches no page, so widening it only narrows the tally.
  const deadIds = [...sel].map((i) => fc.select.idOf(boxes[i], i)).filter(Boolean);
  const res = rehomeChildrenOfDeletedFrames(seeded, deadIds, ff);
  const survivors = res.boxes.filter((_, i) => !sel.has(i)); // index-aligned with `boxes`
  const seq = framesInPageOrder(survivors, ff).map((b) => String(b[cfg.idField] ?? ''));
  fc.select.commit(renumberFrameOrder(survivors, seq, ff));
  // One sentence, and it names the outcome the user has to go looking for. With both
  // outcomes in one delete (several artboards at once, the first among them) the
  // pasteboard is the one worth saying: homed items are where you would expect them.
  if (res.orphaned) {
    fc.stage.flash(
      res.orphaned === 1
        ? t('Deleted artboard. Its one item is now on the pasteboard.')
        : t('Deleted artboard. Its {n} items are now on the pasteboard.', { n: res.orphaned })
    );
  } else if (res.homed) {
    fc.stage.flash(
      res.homed === 1
        ? t('Deleted artboard. Its one item moved to the previous artboard.')
        : t('Deleted artboard. Its {n} items moved to the previous artboard.', { n: res.homed })
    );
  }
}
/** How many selected boxes satisfy `pred`, in z-order. */
export function countSelected(fc: FcCtx, pred: (b: Box) => boolean): number {
  const boxes = fc.select.getBoxes();
  return fc.select.selIndices(boxes).reduce((n, i) => (pred(boxes[i]!) ? n + 1 : n), 0);
}
/** The selection as vector operands: array order is Z-ORDER (bottom first), which is
 *  what every operation in vector-ops.ts documents - Subtract's base is operand 0. */
export function vectorOperands(fc: FcCtx): { boxes: Box[]; operands: Box[]; ids: string[] } {
  const boxes = fc.select.getBoxes();
  const idx = fc.select.selIndices(boxes);
  return { boxes, operands: idx.map((i) => boxes[i]!), ids: idx.map((i) => fc.select.idOf(boxes[i], i)) };
}
/**
 * A refusal the user can read.
 *
 * vector-ops.ts does not import i18n at all - its `message` is diagnostic English
 * for a log - so the translated sentence is owned here and keyed on `reason`.
 *
 * `empty-result` is the interesting one, and it is NOT an error: an intersection of two
 * shapes that do not overlap is legitimately empty, and so is an inward offset deeper
 * than the shape's own inradius. This REFUSES AND SAYS SO rather than deleting the
 * operands. Deleting them is defensible - Illustrator's Intersect does exactly that -
 * but on screen an empty result and a no-op are the same picture, so the destructive
 * reading of an ambiguous gesture would remove the user's artwork and leave nothing
 * behind to explain where it went. Stating the answer in words costs one more tap and
 * never loses work.
 */
export function vectorFailureMessage(_fc: FcCtx, res: VectorOpFailure, empty?: string): string {
  switch (res.reason) {
    case 'too-complex':
      // The kernel's GeomLimitError: the answer exists, the engine declines to guess it
      // rather than hand back a plausible-looking wrong shape. That has to be said.
      return t(
        'These shapes are too intricate to combine exactly. Simplify them first, or combine fewer at a time.'
      );
    case 'no-outline':
      return t('Text and image boxes have no outline to work with. Select shapes or pen paths.');
    case 'needs-two':
      return t('Select two or more shapes to combine them.');
    case 'not-applicable':
      return t('Only pen paths can be simplified.');
    case 'empty-result':
      return empty || t('That would leave nothing to draw, so the shapes were left as they are.');
    case 'bad-input':
      return t('One of the selected shapes has a path that cannot be read.');
    default:
      return t('That could not be worked out, so nothing was changed.');
  }
}
/** The empty-result sentence for each boolean. Union of non-empty regions cannot be
 *  empty, so it falls through to the generic line. */
export function boolEmptyMessage(_fc: FcCtx, op: BooleanOpName): string | undefined {
  if (op === 'intersect')
    return t('Those shapes do not overlap, so there is nothing to keep. Nothing was changed.');
  if (op === 'difference')
    return t(
      'The shapes above cover the bottom one completely, so nothing is left. Nothing was changed.'
    );
  if (op === 'xor')
    return t('Those shapes overlap exactly, so nothing is left. Nothing was changed.');
  return undefined;
}
export function runVectorOp(fc: FcCtx, 
  run: (operands: Box[], id: string) => VectorOpResult,
  opts: RunVectorOpts = {}
): void {
  const { cfg, vectorCfg } = fc;
  if (!vectorCfg) return;
  const { boxes, operands, ids } = vectorOperands(fc);
  if (!operands.length) return;
  const res = run(operands, fc.select.freshId(boxes));
  if (!res.ok) {
    fc.stage.flash(vectorFailureMessage(fc, res, opts.empty));
    return;
  }

  const nextSel = new Set<string>();
  let next: Box[];
  if (opts.each) {
    // res.boxes lines up 1:1 with the operands NOT in `skipped`, in operand order.
    const skipped = new Set(res.skipped);
    const targets = operands.map((_, k) => k).filter((k) => !skipped.has(k));
    next = boxes;
    for (let k = 0; k < res.boxes.length; k++) {
      const at = targets[k];
      if (at === undefined) break;
      const nb: Box = { ...res.boxes[k]! };
      // Only the first result carries the id we minted; the rest are ours to allocate
      // (checked against the array as it grows, so two results never collide).
      const nid =
        nb[cfg.idField] != null && nb[cfg.idField] !== ''
          ? String(nb[cfg.idField])
          : fc.select.freshId(next);
      nb[cfg.idField] = nid;
      next = replaceBoxes(next, [ids[at]!], -1, nb, { cfg: vectorCfg });
      nextSel.add(nid);
    }
  } else {
    next = replaceBoxes(boxes, ids, -1, res.boxes, { cfg: vectorCfg });
    for (const b of res.boxes) {
      const v = b[cfg.idField];
      if (v != null && v !== '') nextSel.add(String(v));
    }
  }
  if (!nextSel.size) {
    fc.stage.flash(vectorFailureMessage(fc, { ok: false, reason: 'internal', message: 'no result id' }));
    return;
  }
  fc.selection = nextSel;
  fc.select.commit(next);
  if (opts.skipNote && res.skipped.length) {
    fc.stage.flash(
      res.skipped.length === 1
        ? t('One selected item has no outline, so it was left as it is.')
        : t('{n} selected items have no outline, so they were left as they are.', {
            n: res.skipped.length,
          })
    );
  }
}
// Outline stroke - the width defaults to the topmost operand's OWN stroke width, which
// is the stroke the user is looking at.
export function askOutlineStroke(fc: FcCtx): void {
  const { cfg, vectorCfg } = fc;
  if (!vectorCfg) return;
  const { operands } = vectorOperands(fc);
  const seed = Math.max(0.1, num(operands[operands.length - 1]?.[cfg.strokeWField], 1));
  fc.dialogs.askNumber({
    at: fc.lastMenuAt,
    title: t('Outline stroke'),
    hint: t('Replace the stroke with a filled shape of the same outline.'),
    value: Math.round(seed * 100) / 100,
    min: 0.1,
    step: 0.5,
    confirm: t('Outline'),
    apply: (v) =>
      runVectorOp(fc, (ops, id) => strokeBoxesToPath(ops, { cfg: vectorCfg, id, width: v }), {
        skipNote: true,
      }),
  });
}
// Offset - no `min` on the field, because a negative distance is an inset and that is
// half of what this control is for.
export function askOffsetPath(fc: FcCtx): void {
  const { vectorCfg } = fc;
  if (!vectorCfg) return;
  fc.dialogs.askNumber({
    at: fc.lastMenuAt,
    title: t('Offset path'),
    hint: t('Grow the shape outwards. A negative distance shrinks it inwards.'),
    value: 8,
    step: 1,
    confirm: t('Offset'),
    apply: (v) =>
      runVectorOp(fc, (ops, id) => offsetBoxes(ops, v, { cfg: vectorCfg, id }), {
        skipNote: true,
        empty: t('Shrinking by that much removes the shape completely. Nothing was changed.'),
      }),
  });
}
export function opsOps(fc: FcCtx) {
  return {
    dupRefFields: bindOp(fc, dupRefFields),
    duplicateSelection: bindOp(fc, duplicateSelection),
    deleteSelection: bindOp(fc, deleteSelection),
    countSelected: bindOp(fc, countSelected),
    vectorOperands: bindOp(fc, vectorOperands),
    vectorFailureMessage: bindOp(fc, vectorFailureMessage),
    boolEmptyMessage: bindOp(fc, boolEmptyMessage),
    runVectorOp: bindOp(fc, runVectorOp),
    askOutlineStroke: bindOp(fc, askOutlineStroke),
    askOffsetPath: bindOp(fc, askOffsetPath),
  };
}
