// SPDX-License-Identifier: MPL-2.0
/**
 * timeline-panel: per-property keyframing (plans/328) - the diamond on one field.
 *
 * A diamond beside a field keys THAT property at the playhead and nothing else, in one
 * commit: pressed on a property with a keyframe here it removes the property from that
 * keyframe, pressed anywhere else it writes the property's current value into the
 * keyframe at the playhead (making one when there is none). It is an explicit press, so
 * the "nothing else creates a keyframe" rule holds: no field edit ever keys on its own.
 *
 * The arithmetic is views/kf-props.ts; this module is the panel's half - which box, which
 * time, the model write, the words, and the button itself. The Keyframes popup builds a
 * diamond per row through `propButton`, and the Design inspector reaches the same toggle
 * and the same state through the timeline handle (`keyPort` in timeline-panel.ts).
 *
 * Every function takes the shared `tp: TpCtx` first (see context.ts).
 */
import { t } from '../../i18n.ts';
import { announce } from '../../a11y.ts';
import { evaluateKf, KF_CLAMPS, type KfPose } from '../../../../../engine/src/keyframes.ts';
import { kfColourCss, kfColourKey } from '../../../../../engine/src/kf-look.ts';
import {
  fmtTime, indexOfId, isTimed, kfBoxTrack, kfDiamondAt, kfFormatChannel, kfPoseAt, kfTimelineSec, kfWriteMs, setKfTrack,
} from '../timeline-math.ts';
import type { Box } from '../timeline-math.ts';
import {
  KF_LOOK_PROPS, KF_PROP_CHANNELS, kfLookBase, kfLookRefusal, kfPropAnimated, kfPropState, kfTrackDropChannels,
  kfTrackPutChannels, type KfLookFields, type KfLookRefusal, type KfProp, type KfPropState,
} from '../kf-props.ts';
import type { KfLookRow } from './shared.ts';
import type { InspectorKeysPort } from '../design-ports.ts';
import { kfColourBase } from '../kf-props.ts';
import { bindOp, type TpCtx } from './context.ts';

/** The appearance fields this tool declares (plans/328). */
export function lookFields(tp: TpCtx): KfLookFields {
  const { cfg } = tp;
  return {
    kind: 'kind', fill: cfg.fillField || undefined, stroke: cfg.strokeField || undefined,
    strokeW: cfg.strokeWField || undefined, radius: cfg.radiusField || undefined, shape: cfg.shapeField || undefined,
  };
}

/** What one property's diamond shows right now. */
export interface PropInfo {
  state: KfPropState;
  /** Why the box cannot key this property, or null. */
  refusal: KfLookRefusal | null;
  /** Timeline seconds a press would key at (the playhead, held inside the clip). */
  atSec: number;
  /** The keyframe the playhead is parked on, local ms, or null. */
  on: number | null;
}

/** The diamond's reading for `prop` on box `id`, or null when the box is not keyframable. */
export function propInfo(tp: TpCtx, id: string, prop: KfProp): PropInfo | null {
  const { cfg, getBoxes } = tp;
  if (!cfg.kfField) return null;
  const rows = getBoxes();
  const box = rows[indexOfId(rows, cfg, id)];
  if (!box || !tp.keyframes.isKeyframable(box, id)) return null;
  const at = tp.keyframes.playheadSec();
  const on = kfDiamondAt(box, cfg, at);
  const track = kfBoxTrack(box, cfg);
  const refusal = kfLookRefusal(prop, box, lookFields(tp));
  return {
    state: kfPropState(track, on, KF_PROP_CHANNELS[prop]),
    refusal: refusal && !kfPropAnimated(track, prop) ? refusal : null,
    atSec: kfTimelineSec(box, cfg, on ?? kfWriteMs(box, cfg, at)),
    on,
  };
}

/** The live canvas's computed paint for a box, for a brand colour with no literal fallback. */
function livePaint(tp: TpCtx, id: string, which: 'fill' | 'stroke'): string | null {
  const el = tp.helpers.boxEl(id);
  if (!el) return null;
  try {
    const path = el.querySelector<SVGElement>(which === 'fill' ? ':scope > svg.lolly-box-path > path' : ':scope > svg.lolly-box-path > path[stroke]');
    const cs = getComputedStyle(path ?? el);
    return path ? (which === 'fill' ? cs.fill : cs.stroke) : (which === 'fill' ? cs.backgroundColor : cs.borderTopColor);
  } catch { return null; }
}

/**
 * The value `prop` has on `box` at local time `localMs`: what its keyframes blend to
 * there when it is animated, else the box's own value, so keying it changes nothing on
 * screen until the person moves the playhead and changes the value.
 */
export function propValue(tp: TpCtx, box: Box, id: string, prop: KfProp, localMs: number): KfPose | null {
  const { cfg } = tp;
  const track = kfBoxTrack(box, cfg);
  const chs = KF_PROP_CHANNELS[prop];
  if (kfPropAnimated(track, prop)) {
    const v = evaluateKf(track, localMs, chs);
    for (const ch of chs) if (typeof v[ch] !== 'number') v[ch] = 0;
    return v;
  }
  if (KF_LOOK_PROPS.includes(prop)) return kfLookBase(prop, box, lookFields(tp), (which) => livePaint(tp, id, which));
  return kfPoseAt(box, cfg, localMs, chs);
}

/** A property's name, as its field is labelled. */
export function propLabel(prop: KfProp): string {
  switch (prop) {
    case 'z': return t('Depth');
    case 'rx': return t('Tilt X');
    case 'ry': return t('Tilt Y');
    case 's': return t('Scale');
    case 'o': return t('Opacity');
    case 'b': return t('Blur');
    case 'fill': return t('Fill');
    case 'stroke': return t('Stroke');
    case 'lw': return t('Stroke width');
    case 'cr': return t('Corner radius');
    case 'ts': return t('Trim start');
    case 'te': return t('Trim end');
  }
}

/** Why a property cannot be keyed, in words. */
export function refusalText(r: KfLookRefusal): string {
  switch (r) {
    case 'placement': return t('A stroke on or outside the outline keeps its width and is not trimmed.');
    case 'arrowheads': return t('A line with arrowheads is not trimmed. Remove the arrowheads to trim it.');
    case 'sides': return t('A trim needs the same stroke width on every side.');
    case 'picture': return t('A box showing a picture is not trimmed.');
    default: return t('Add a fill or a stroke first.');
  }
}

/**
 * Press a property's diamond on every keyframable id, as ONE commit. Promotes an
 * untimed box onto the timeline in the same commit, as "+Keyframe" does, so the first
 * key has a clip to live in. Returns true when something was written.
 */
export function toggleProp(tp: TpCtx, ids: readonly string[], prop: KfProp): boolean {
  const { cfg, getBoxes } = tp;
  if (!cfg.kfField) return false;
  const at = tp.keyframes.playheadSec();
  const before = getBoxes();
  let next = before;
  let added: boolean | null = null;
  let landed = at;
  for (const id of ids) {
    let i = indexOfId(next, cfg, id);
    const row = next[i];
    if (!row || !tp.keyframes.isKeyframable(row, id)) continue;
    const track0 = kfBoxTrack(row, cfg);
    const info = kfLookRefusal(prop, row, lookFields(tp));
    if (info && !kfPropAnimated(track0, prop)) continue;
    if (!isTimed(row, cfg) && String(row.kind ?? '') !== 'camera') {
      next = tp.rows.promoteRows(next, id, { start: at });
      i = indexOfId(next, cfg, id);
    }
    const box = next[i]!;
    const track = kfBoxTrack(box, cfg);
    const on = kfDiamondAt(box, cfg, at);
    const chs = KF_PROP_CHANNELS[prop];
    if (on !== null && kfPropState(track, on, chs) === 'key') {
      // Pressed where the property already has a keyframe: take it off this one.
      if (added === null) { added = false; landed = kfTimelineSec(box, cfg, on); }
      next = setKfTrack(next, cfg, id, kfTrackDropChannels(track, on, chs));
      continue;
    }
    const local = on ?? kfWriteMs(box, cfg, at);
    const value = propValue(tp, box, id, prop, local);
    if (!value) continue;
    if (added === null) { added = true; landed = kfTimelineSec(box, cfg, local); }
    next = setKfTrack(next, cfg, id, kfTrackPutChannels(track, local, value));
  }
  if (next === before || added === null) return false;
  tp.helpers.write(next);
  const name = propLabel(prop);
  announce(added
    ? t('{name} keyframe added at {t}', { name, t: fmtTime(landed) })
    : t('{name} keyframe removed at {t}', { name, t: fmtTime(landed) }));
  return true;
}

/**
 * Write a value for `prop` into the keyframe the playhead is parked on, on every id.
 * Returns false (and writes nothing) when the playhead is on no keyframe of the first
 * box: there is then no keyframe to write, and the caller decides what an edit means.
 */
export function writePropAtKey(tp: TpCtx, ids: readonly string[], _prop: KfProp, value: KfPose): boolean {
  const { cfg, getBoxes } = tp;
  if (!cfg.kfField) return false;
  const at = tp.keyframes.playheadSec();
  let next = getBoxes();
  let wrote = false;
  for (const id of ids) {
    const i = indexOfId(next, cfg, id);
    const box = next[i];
    if (!box) continue;
    const on = kfDiamondAt(box, cfg, at);
    if (on === null) continue;
    next = setKfTrack(next, cfg, id, kfTrackPutChannels(kfBoxTrack(box, cfg), on, value));
    wrote = true;
  }
  if (wrote) tp.helpers.write(next);
  return wrote;
}

/** The diamond glyph, built as nodes: no markup string reaches the DOM. */
function diamondGlyph(): SVGSVGElement {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'tl-kf-prop-glyph');
  svg.setAttribute('viewBox', '0 0 12 12');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('d', 'M6 1.2 10.8 6 6 10.8 1.2 6Z');
  svg.appendChild(path);
  return svg;
}

/** One field's diamond: a labelled toggle, synced in place by `syncPropButtons`. */
export function propButton(tp: TpCtx, id: string, prop: KfProp): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'tl-kf-prop';
  b.dataset.prop = prop;
  b.dataset.id = id;
  b.appendChild(diamondGlyph());
  b.addEventListener('click', () => {
    if (b.getAttribute('aria-disabled') === 'true') { announce(b.title); return; }
    toggleProp(tp, [id], prop);
  });
  syncPropButton(tp, b);
  return b;
}

/** Re-read one diamond: its state, its words and whether it can be pressed. */
export function syncPropButton(tp: TpCtx, b: HTMLElement): void {
  const prop = b.dataset.prop as KfProp | undefined;
  const id = b.dataset.id ?? '';
  if (!prop) return;
  const info = propInfo(tp, id, prop);
  const state = info?.state ?? 'none';
  const name = propLabel(prop);
  const when = fmtTime(info?.atSec ?? 0);
  const label = info?.refusal
    ? refusalText(info.refusal)
    : state === 'key'
      ? t('Remove the keyframe for {name} at {t}', { name, t: when })
      : t('Add a keyframe for {name} at {t}', { name, t: when });
  if (b.dataset.state !== state) b.dataset.state = state;
  if (b.getAttribute('aria-label') !== label) {
    b.setAttribute('aria-label', label);
    b.title = label;
  }
  const off = !info || !!info.refusal;
  if ((b.getAttribute('aria-disabled') === 'true') !== off) b.setAttribute('aria-disabled', String(off));
}

/** Re-read every diamond inside `scope`. */
export function syncPropButtons(tp: TpCtx, scope: ParentNode | null | undefined): void {
  if (!scope) return;
  for (const b of Array.from(scope.querySelectorAll<HTMLElement>('.tl-kf-prop'))) syncPropButton(tp, b);
}

/** Refusals that mean the box has no such paint at all, so no control is offered. */
const ABSENT: ReadonlySet<KfLookRefusal> = new Set<KfLookRefusal>(['no-field', 'no-fill', 'no-stroke', 'shape']);

/** The appearance properties the Keyframes popup offers a row for, in order. */
const LOOK_ROWS: readonly KfProp[] = ['fill', 'stroke', 'lw', 'cr', 'ts', 'te'];

/**
 * The Keyframes popup's APPEARANCE rows (plans/328): fill, stroke, stroke width, corner
 * radius and trim, each with its own diamond. A row is left out when the box has nothing
 * to key there (no fill, no stroke, a shape with no corners); a row whose stroke cannot
 * carry the key (placed outside, arrowheads) stays, with the reason on its diamond, so
 * the person learns why rather than looking for a control that is not there.
 *
 * Like Scale, Opacity and Blur these have no meaning off a keyframe here - the box's own
 * fill and stroke are edited in the Design inspector - so a row writes into the keyframe
 * the playhead is parked on and is inactive anywhere else.
 */
export function buildLookRows(tp: TpCtx, host: HTMLElement, id: string, box: Box): KfLookRow[] {
  const { cfg } = tp;
  const track = kfBoxTrack(box, cfg);
  const fields = lookFields(tp);
  const out: KfLookRow[] = [];
  let section: HTMLElement | null = null;
  for (const prop of LOOK_ROWS) {
    const refusal = kfLookRefusal(prop, box, fields);
    if (refusal && !kfPropAnimated(track, prop) && ABSENT.has(refusal)) continue;
    if (!section) {
      section = document.createElement('div');
      section.className = 'tl-kf-pose tl-kf-look';
      host.appendChild(section);
    }
    const colour = prop === 'fill' || prop === 'stroke';
    const el = document.createElement('input');
    if (colour) {
      el.type = 'color';
      el.className = 'tl-kf-colour';
    } else {
      el.type = 'number';
      el.className = 'field-input tl-num tl-kf-pose-num';
      const trim = prop === 'ts' || prop === 'te';
      el.min = '0';
      el.max = String(trim ? 100 : prop === 'lw' ? KF_CLAMPS.lw[1] : KF_CLAMPS.cr[1]);
      el.step = trim ? '1' : '0.5';
    }
    el.dataset.prop = prop;
    el.addEventListener('change', () => commitLookRow(tp, id, prop, el.value));
    const wrap = document.createElement('div');
    wrap.className = 'field-row field-row--inline tl-field tl-kf-pose-row';
    const lab = document.createElement('label');
    lab.className = 'field-label';
    lab.textContent = propLabel(prop);
    const fieldId = `tl-kf-look-${prop}-${Math.random().toString(36).slice(2, 8)}`;
    el.id = fieldId;
    lab.htmlFor = fieldId;
    const unit = document.createElement('span');
    unit.className = 'tl-kf-unit';
    unit.textContent = colour ? '' : prop === 'ts' || prop === 'te' ? '%' : 'px';
    wrap.append(lab, el);
    if (unit.textContent) wrap.appendChild(unit);
    wrap.appendChild(propButton(tp, id, prop));
    section.appendChild(wrap);
    out.push({ prop, el });
  }
  return out;
}

/** One appearance row's typed value, as the key it writes. */
function lookRowValue(prop: KfProp, raw: string): KfPose | null {
  if (prop === 'fill' || prop === 'stroke') return kfColourKey(raw, prop);
  const v = Number(raw);
  if (!Number.isFinite(v)) return null;
  if (prop === 'ts' || prop === 'te') return { [prop]: Math.min(1, Math.max(0, v / 100)) };
  return { [prop]: Math.max(0, v) };
}

/** Commit one appearance row: into the keyframe at the playhead, or nowhere. */
export function commitLookRow(tp: TpCtx, id: string, prop: KfProp, raw: string): void {
  const value = lookRowValue(prop, raw);
  // Re-derived at commit time, as the pose rows are: a field that was enabled when it
  // took focus may be committed after the playhead has left the keyframe.
  if (!value || !writePropAtKey(tp, [id], prop, value)) {
    tp.kfPoseKey = '\u0000';
    tp.kfDock.syncKfLatch();
  }
}

/** Show each appearance row's value at `readMs`, and whether it can be edited here. */
export function syncLookRows(tp: TpCtx, rows: readonly KfLookRow[], id: string, box: Box, on: number | null, readMs: number): void {
  for (const row of rows) {
    const v = propValue(tp, box, id, row.prop, readMs);
    let shown = '';
    if (v) {
      if (row.prop === 'fill' || row.prop === 'stroke') shown = kfColourCss(v, row.prop) ?? '';
      else if (row.prop === 'ts' || row.prop === 'te') shown = String(Math.round((v[row.prop] ?? 0) * 1000) / 10);
      else shown = kfFormatChannel(row.prop === 'lw' ? 'lw' : 'cr', v[row.prop] ?? 0);
    }
    if (row.el.value !== shown && shown) row.el.value = shown;
    const inert = on === null;
    row.el.disabled = inert;
    row.el.title = inert ? t('Move the playhead onto a keyframe, or add one.') : '';
  }
}

/** What a property's diamond says for `info`: the words syncPropButton puts on the button. */
function propWords(prop: KfProp, info: PropInfo): string {
  const name = propLabel(prop);
  const when = fmtTime(info.atSec);
  if (info.refusal) return refusalText(info.refusal);
  return info.state === 'key'
    ? t('Remove the keyframe for {name} at {t}', { name, t: when })
    : t('Add a keyframe for {name} at {t}', { name, t: when });
}

/** An inspector field's value (a CSS colour or a number) as the key it writes, or null. */
function fieldPose(prop: KfProp, value: unknown): KfPose | null {
  if (prop === 'fill' || prop === 'stroke') {
    const c = kfColourBase(typeof value === 'object' && value && 'value' in value ? (value as { value: unknown }).value : value);
    return c ? kfColourKey(c, prop) : null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? { [prop]: Math.max(0, n) } : null;
}

/**
 * The Design inspector's door onto per-property keyframing (plans/328). Everything is
 * answered from the timeline's own state; while the panel is closed there is no playhead
 * on screen, so there is no diamond and every field is an ordinary field.
 */
export function keyPort(tp: TpCtx): InspectorKeysPort {
  const read = (id: string): { box: Box; on: number | null } | null => {
    const rows = tp.getBoxes();
    const box = rows[indexOfId(rows, tp.cfg, id)];
    if (!box) return null;
    return { box, on: kfDiamondAt(box, tp.cfg, tp.keyframes.playheadSec()) };
  };
  return {
    state(id, prop) {
      if (!tp.open) return null;
      const info = propInfo(tp, id, prop);
      // A box with nothing to key here (no stroke, a shape with no corners) gets no
      // diamond at all; one whose stroke cannot carry the key keeps a disabled one.
      if (!info || (info.refusal && ABSENT.has(info.refusal))) return null;
      return { state: info.state, label: propWords(prop, info), disabled: !!info.refusal };
    },
    toggle(ids, prop) {
      if (tp.open) toggleProp(tp, ids, prop);
    },
    route(ids, prop, value) {
      const first = tp.open && ids[0] ? read(ids[0]) : null;
      if (!first || !kfPropAnimated(kfBoxTrack(first.box, tp.cfg), prop)) return 'base';
      const pose = fieldPose(prop, value);
      return pose && writePropAtKey(tp, ids, prop, pose) ? 'key' : 'locked';
    },
    shown(id, prop) {
      const r = tp.open ? read(id) : null;
      if (!r) return null;
      const track = kfBoxTrack(r.box, tp.cfg);
      if (!kfPropAnimated(track, prop)) return null;
      const local = r.on ?? Math.round((tp.keyframes.playheadSec() - (Number(r.box[tp.cfg.startField]) || 0)) * 1000);
      const v = evaluateKf(track, local, KF_PROP_CHANNELS[prop]);
      if (prop === 'fill' || prop === 'stroke') return kfColourCss(v, prop);
      const n = v[prop as 'lw' | 'cr'];
      return typeof n === 'number' ? Math.round(n * 100) / 100 : null;
    },
    subscribe(cb) {
      tp.keyListeners.add(cb);
      return () => { tp.keyListeners.delete(cb); };
    },
  };
}

/**
 * Tell the inspector's diamonds when what they show may have changed: the panel opening
 * or closing, the selection, or the playhead arriving on or leaving a keyframe. Asked on
 * every latch read, and silent unless that answer changed.
 */
export function notifyKeys(tp: TpCtx): void {
  if (!tp.keyListeners.size) return;
  const rows = tp.getBoxes();
  const at = tp.keyframes.playheadSec();
  const sig = `${tp.open}|${tp.selection.get().map((id) => {
    const box = rows[indexOfId(rows, tp.cfg, id)];
    return `${id}:${box ? kfDiamondAt(box, tp.cfg, at) ?? '' : ''}`;
  }).join(',')}`;
  if (sig === tp.keySig) return;
  tp.keySig = sig;
  for (const cb of [...tp.keyListeners]) {
    try { cb(); } catch { /* one listener cannot stop the others */ }
  }
}

export function propKeysOps(tp: TpCtx) {
  return {
    lookFields: bindOp(tp, lookFields),
    propInfo: bindOp(tp, propInfo),
    propValue: bindOp(tp, propValue),
    toggleProp: bindOp(tp, toggleProp),
    writePropAtKey: bindOp(tp, writePropAtKey),
    propButton: bindOp(tp, propButton),
    syncPropButton: bindOp(tp, syncPropButton),
    syncPropButtons: bindOp(tp, syncPropButtons),
    buildLookRows: bindOp(tp, buildLookRows),
    commitLookRow: bindOp(tp, commitLookRow),
    syncLookRows: bindOp(tp, syncLookRows),
    keyPort: bindOp(tp, keyPort),
    notifyKeys: bindOp(tp, notifyKeys),
  };
}
