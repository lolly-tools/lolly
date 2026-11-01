// SPDX-License-Identifier: MPL-2.0
/**
 * timeline-panel: a keyframe's place on the motion path (plans/330), in the Keyframes
 * popup's rows.
 *
 * The canvas path lets a pointer drag a keyframe's point and bend the travel through that point.
 * This is the same pair of edits for the keyboard and a screen reader: each row whose
 * keyframe keys a position gains X and Y fields (where the box's left and top edges are
 * at that keyframe, artboard px, the numbers the Design inspector uses) and a
 * **Curve the path** / **Straighten** toggle, every control named with its row's time.
 * The arithmetic is motion-path-math.ts's, so both doors make the same track.
 *
 * Every function takes the shared `tp: TpCtx` first (see context.ts); anything in
 * another module goes through `tp.<module>.<fn>`.
 */
import { t } from '../../i18n.ts';
import { icon } from '../../lib/icons.ts';
import { announce } from '../../a11y.ts';
import type { KfKey, KfTrack } from '../../../../../engine/src/keyframes.ts';
import { kfBoxTrack, kfFormatChannel, type Box } from '../timeline-math.ts';
import {
  hasHandles, holdsPosition, keyPosition, kfTrackCurve, kfTrackSetPosition, kfTrackStraighten,
  movesPosition, positionNeighbours,
} from '../motion-path-math.ts';
import { finite } from '../timeline-config.ts';
import { bindOp, type TpCtx } from './context.ts';

/** The box's own left/top, which a keyframe's `x`/`y` offset. 0 when the tool declares no field. */
function basePosition(tp: TpCtx, box: Box): { x: number; y: number } {
  const f = tp.opts.posFields;
  return {
    x: f?.x ? finite(box[f.x], 0) : 0,
    y: f?.y ? finite(box[f.y], 0) : 0,
  };
}

/** Can the travel through this keyframe be curved? It needs a whole position and a neighbour. */
function curvable(track: KfTrack, k: KfKey): boolean {
  if (!holdsPosition(k)) return false;
  const { prev, next } = positionNeighbours(track, k.t);
  return !!(prev || next);
}

/**
 * Add a row's path controls: X and Y on their own line, the curve action among the
 * row's actions. Nothing for a keyframe that keys no position, so a track of fades and
 * colours reads exactly as before.
 */
export function positionRow(tp: TpCtx, row: HTMLElement, id: string, box: Box, k: KfKey, at: string): void {
  if (!movesPosition(k)) return;
  const track = kfBoxTrack(box, tp.cfg);
  const pos = keyPosition(track, k);
  const base = basePosition(tp, box);
  const wrap = document.createElement('div');
  wrap.className = 'tl-kf-pos';
  const field = (axis: 'x' | 'y'): HTMLInputElement => {
    const lab = document.createElement('span');
    lab.className = 'field-label tl-kf-pos-label';
    lab.textContent = axis === 'x' ? t('X') : t('Y');
    lab.setAttribute('aria-hidden', 'true');
    const el = document.createElement('input');
    el.className = 'field-input tl-num tl-kf-pos-num';
    el.type = 'number';
    el.step = '1';
    el.dataset.axis = axis;
    el.value = kfFormatChannel(axis, base[axis] + pos[axis]);
    el.setAttribute('aria-label', axis === 'x'
      ? t('Keyframe X position at {t}', { t: at })
      : t('Keyframe Y position at {t}', { t: at }));
    el.addEventListener('change', () => {
      const raw = el.value.trim();
      if (raw === '') return;
      const v = finite(raw, base[axis] + pos[axis]) - base[axis];
      const x = axis === 'x' ? v : pos.x;
      const y = axis === 'y' ? v : pos.y;
      tp.keyframes.writeTrack(id, (tr) => kfTrackSetPosition(tr, k.t, x, y));
      announce(t('Keyframe at {t} moved', { t: at }));
    });
    wrap.append(lab, el);
    return el;
  };
  field('x');
  field('y');
  if (curvable(track, k)) {
    const curved = hasHandles(k);
    const label = curved ? t('Straighten the path at {t}', { t: at }) : t('Curve the path at {t}', { t: at });
    const toggle = tp.helpers.btn('tl-kf-curve', label, icon(curved ? 'pathStraight' : 'pathCurve'));
    toggle.addEventListener('click', () => {
      tp.keyframes.writeTrack(id, (tr) => (curved ? kfTrackStraighten(tr, k.t) : kfTrackCurve(tr, k.t)));
      announce(curved ? t('Path straightened at {t}', { t: at }) : t('Path curved at {t}', { t: at }));
    });
    // A row action, so it sits with the row's other actions, after Delete.
    const del = row.querySelector('.tl-kf-del');
    row.insertBefore(toggle, del ? del.nextSibling : null);
  }
  row.classList.add('has-pos');
  row.appendChild(wrap);
}

export function kfPathOps(tp: TpCtx) {
  return {
    positionRow: bindOp(tp, positionRow),
  };
}
