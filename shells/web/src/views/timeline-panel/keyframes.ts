// SPDX-License-Identifier: MPL-2.0
/**
 * timeline-panel: keyframe actions - add, seek, open, delete, duplicate.
 *
 * Every function takes the shared `tp: TpCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `tp.<module>.<fn>`. Extracted verbatim
 * from initTimelinePanel() by scripts/split-closure.ts.
 */
import { t } from '../../i18n.ts';
import { announce } from '../../a11y.ts';
import type { KfTrack } from '../../../../../engine/src/keyframes.ts';
import { fmtTime, indexOfId, isTimed, kfBoxTrack, kfDiamondTimes, kfDuplicateMs, kfSeekDiamond, kfTimelineSec, kfTrackDelete, kfTrackDuplicate, kfWriteMs, setKfTrack, writeKfPose } from '../timeline-math.ts';
import type { Box } from '../timeline-math.ts';
import { bindOp, type TpCtx } from './context.ts';

// ── the keyframe writers (one commit each, like every other panel writer) ────

/** The playhead, in the seconds every kf helper speaks. */
export function playheadSec(tp: TpCtx): number {
  const { clock } = tp;
  return clock.t() / 1000;
}
/**
 * CAN this box be keyframed at all (plans/104 section 8, M2.5) - the ONE rule, with five
 * readers: "+Keyframe"'s scope, the transport button's enabled state, the canvas
 * contextual bar's enabled state (through `keyframableIds` on the handle), the
 * inspector's Keyframes group, and the diamonds on the bar.
 *
 * Deliberately permissive: a box is keyframable timed or not, because the M2.5
 * revision made the button itself the door - an untimed box is promoted onto the
 * timeline and keyed in the same commit. Two exclusions, both named in section 8:
 *
 *   • `audio` - sound has no pose to strike; keyframed gain is plan 101's, and until
 *     it exists an audio clip in a mixed selection must fall out rather than be
 *     silently given an x/y/s/r/o track no evaluator reads. The kind is taken from
 *     the MODEL row and from the live canvas, because a box carrying an audio asset
 *     is an audio clip whatever its `kind` says. That second source is exactly why
 *     this is a function and not an inline `kind !== 'audio'` at each site: a model
 *     read alone offers the affordance to a box the writer then refuses.
 *   • a `camera` is keyframable (it exists only to be animated) but is never
 *     PROMOTED by "+Keyframe" - a camera is timed by construction, so that button's
 *     promote branch can only be reached by a content box.
 *
 * `mediaKind` is the caller's already-paid `mediaOf(id).kind` where it has one (the
 * restyle loop reads it a line earlier for `data-kind`); omit it and this reads the
 * live canvas itself.
 */
export function isKeyframable(tp: TpCtx, row: Box | undefined, id: string, mediaKind?: string): boolean {
  const { cfg } = tp;
  if (!cfg.kfField || !row) return false;
  return String(row.kind ?? '') !== 'audio' && (mediaKind ?? tp.helpers.mediaOf(id).kind) !== 'audio';
}
/** WHICH of the selected boxes "+Keyframe" would act on. */
export function kfActionIds(tp: TpCtx): string[] {
  const { cfg, getBoxes, selection } = tp;
  if (!cfg.kfField) return [];
  const rows = getBoxes();
  return selection.get().filter((id) => isKeyframable(tp, rows[indexOfId(rows, cfg, id)], id));
}
/**
 * THE "+Keyframe" action - one implementation, three doors (the transport button,
 * the canvas contextual bar, and `K`), which is the whole point of section 8's M2.5
 * revision: "TWO homes, one action".
 *
 * Add-or-update the full pose at the playhead on every keyframable selected box, in
 * ONE write, so a multi-select press is ONE undo step (section 8's gesture/commit law,
 * applied to a press). `writeKfPose` returns the array by identity for a box it
 * cannot key, so anything unkeyable simply falls out.
 *
 * AUTO-PROMOTION is the new half: a selected box with no time at all is promoted
 * onto an overlay lane and keyed **inside the same array**, so the commit below is
 * still one write and one ⌘Z takes both back. `promoteRows` is the panel's existing
 * resolution (playhead start, authored → media → DEFAULT_CLIP_S length), composed -
 * never re-derived.
 */
export function addKeyframeAction(tp: TpCtx, opts?: { speak?: boolean }): void {
  const { cfg, getBoxes } = tp;
  if (!cfg.kfField) return;
  const ids = kfActionIds(tp);
  if (!ids.length) return;
  const at = playheadSec(tp);
  const before = getBoxes();
  let next = before;
  // Where the FIRST written keyframe actually arrived - which is the playhead unless
  // it sat outside the clip, in which case `kfWriteMs` clamped it to the clip's own
  // edge. Announcing the playhead there would name a time no keyframe exists at.
  let landed: number | null = null;
  let promoted = 0;
  for (const id of ids) {
    const i = indexOfId(next, cfg, id);
    if (i < 0) continue;
    // A camera is timed by construction; only a content box can be scenery here.
    if (!isTimed(next[i]!, cfg) && String(next[i]!.kind ?? '') !== 'camera') {
      // The CAPTURED playhead, not `promoteRows`'s own `clock.t()` fallback. Both
      // reads are the playhead, but they are two reads: while the transport is
      // playing the second one is later, so the clip would start after the time its
      // first keyframe is then written at - the pose ends up at a non-zero local ms (or
      // gets clamped to the clip edge) instead of at the box's own t = 0, and the
      // announcement names a time no keyframe is at. One gesture, one instant.
      const grown = tp.rows.promoteRows(next, id, { start: at });
      if (grown !== next) {
        next = grown;
        promoted++;
      }
    }
    const step = writeKfPose(next, cfg, id, at, {}, 'set');
    if (step !== next && landed === null) {
      const j = indexOfId(next, cfg, id);
      if (j >= 0) landed = kfTimelineSec(next[j]!, cfg, kfWriteMs(next[j]!, cfg, at));
    }
    next = step;
  }
  if (next === before) return;
  tp.helpers.write(next);
  if (!opts?.speak) return;
  // The promotion is the surprising half, so it is the half that is spoken: a box
  // that was "always on" a moment ago now has a start and a length.
  announce(
    promoted
      ? t('Added to the timeline. Keyframe at {t}', { t: fmtTime(landed ?? at) })
      : t('Keyframe at {t}', { t: fmtTime(landed ?? at) })
  );
}
export function syncKfBtn(tp: TpCtx): void {
  const { cfg, kfBtn } = tp;
  if (!cfg.kfField) return;
  const n = kfActionIds(tp).length;
  const key = String(n);
  if (key === tp.kfBtnKey) return;
  tp.kfBtnKey = key;
  const tip =
    n === 0
      ? t('Select something on the canvas to keyframe it')
      : n === 1
        ? t('+Keyframe')
        : t('+Keyframe on {n} objects', { n: String(n) });
  kfBtn.setAttribute('aria-disabled', n === 0 ? 'true' : 'false');
  kfBtn.setAttribute('aria-label', tip);
  kfBtn.setAttribute('data-tip', tip);
}
/** The Animate door: a t = 0 pose, which is where an animation starts (section 8). */
export function animateBox(tp: TpCtx, id: string): void {
  const { cfg, getBoxes } = tp;
  const rows = getBoxes();
  const i = indexOfId(rows, cfg, id);
  if (i < 0 || !cfg.kfField) return;
  // t = 0 in the box's OWN time, which is its start on the timeline - not the
  // playhead. A door that opened onto a track whose only key sat wherever the
  // playhead happened to be would make the clip jump the moment it was animated.
  const next = writeKfPose(rows, cfg, id, kfTimelineSec(rows[i]!, cfg, 0), {}, 'set');
  if (next === rows) return;
  tp.helpers.write(next);
  announce(t('Animating. Move the playhead and press K to add a pose.'));
}
/** One track's worth of edit, from the CRUD list or the diamond menu. */
export function writeTrack(tp: TpCtx, 
  id: string,
  edit: (track: KfTrack) => Parameters<typeof setKfTrack>[3]
): void {
  const { cfg, getBoxes } = tp;
  const rows = getBoxes();
  const i = indexOfId(rows, cfg, id);
  if (i < 0) return;
  tp.helpers.write(setKfTrack(rows, cfg, id, edit(kfBoxTrack(rows[i]!, cfg))));
}
/**
 * Alt+←/→ - the playhead to the previous / next diamond of the SELECTED boxes.
 *
 * Same selection rule as the latch, for the same reason: the diamonds you can walk
 * are the ones you declared you were working on. Stops at the ends rather than
 * wrapping - a shortcut that silently teleports to the other end of a sequence is
 * how you lose your place.
 */
export function seekDiamond(tp: TpCtx, dir: number): void {
  const { cfg, getBoxes, selection } = tp;
  if (!cfg.kfField) return;
  const rows = getBoxes();
  const sel = selection.get();
  const to = kfSeekDiamond(rows, cfg, sel, playheadSec(tp), dir);
  if (to === null) {
    // "Last keyframe" on a box that HAS none is a lie about why nothing moved (section 8's
    // M2.6 low). Three different silences, and the shortcut has to name the right
    // one: nothing selected, nothing animated, or genuinely at the end of a track.
    const any = sel.some((id) => {
      const i = indexOfId(rows, cfg, id);
      return i >= 0 && kfDiamondTimes(rows[i]!, cfg).length > 0;
    });
    announce(
      !sel.length
        ? t('Select something on the canvas to keyframe it')
        : !any
          ? t('No keyframes')
          : dir > 0
            ? t('Last keyframe')
            : t('First keyframe')
    );
    return;
  }
  tp.rows.seekAuthored(to * 1000);
  announce(t('Keyframe @ {t}', { t: fmtTime(to) }));
}
/**
 * Park the playhead on one keyframe and open the Keyframes popup on it (section 8's M2.7).
 *
 * Selection, playhead and popup in one press, in that order and deliberately: the
 * selection is what builds the inspector row this popup borrows its body from (so
 * the group must exist before it can be opened), and the seek comes after it because
 * `selectAndReveal` moves the playhead to the clip's start when the selection would
 * otherwise be off screen - which would land it beside the diamond rather than on it.
 *
 * Writes nothing. Opening a keyframe is a way of LOOKING at it, and section 8's whole model
 * is that nothing is keyed by accident.
 */
export function openKeyframeAt(tp: TpCtx, id: string, atMs: number): void {
  const { cfg, getBoxes, selection } = tp;
  const rows = getBoxes();
  const i = indexOfId(rows, cfg, id);
  if (i < 0 || !cfg.kfField) return;
  if (!selection.get().includes(id)) tp.rows.selectAndReveal([id]);
  tp.rows.seekAuthored(kfTimelineSec(rows[i]!, cfg, atMs) * 1000);
  // The row is rebuilt by the selection change above (restyle → renderInspector), so
  // the segment this points at is the live one. On a box whose row offers no
  // Keyframes group (there is none - a diamond only exists where the group does)
  // `openGroupPopover` finds nothing and does nothing.
  tp.kfDock.openGroupPopover('keyframes', id);
  tp.kfDock.syncKfLatch();
}
/** Delete one keyframe, from wherever it was asked for. */
export function deleteKeyframe(tp: TpCtx, id: string, atMs: number): void {
  writeTrack(tp, id, (track) => kfTrackDelete(track, atMs));
  announce(t('Keyframe deleted'));
}
/** Copy one keyframe into the gap after it. */
export function duplicateKeyframe(tp: TpCtx, id: string, atMs: number): void {
  const { cfg, getBoxes } = tp;
  const rows = getBoxes();
  const i = indexOfId(rows, cfg, id);
  if (i < 0) return;
  const dur = tp.rows.span(rows[i]!, tp.rows.durationSec()).dur;
  writeTrack(tp, id, (track) => kfTrackDuplicate(track, atMs, kfDuplicateMs(track, atMs, dur)));
}
export function keyframesOps(tp: TpCtx) {
  return {
    playheadSec: bindOp(tp, playheadSec),
    isKeyframable: bindOp(tp, isKeyframable),
    kfActionIds: bindOp(tp, kfActionIds),
    addKeyframeAction: bindOp(tp, addKeyframeAction),
    syncKfBtn: bindOp(tp, syncKfBtn),
    animateBox: bindOp(tp, animateBox),
    writeTrack: bindOp(tp, writeTrack),
    seekDiamond: bindOp(tp, seekDiamond),
    openKeyframeAt: bindOp(tp, openKeyframeAt),
    deleteKeyframe: bindOp(tp, deleteKeyframe),
    duplicateKeyframe: bindOp(tp, duplicateKeyframe),
  };
}
