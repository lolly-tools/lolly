// SPDX-License-Identifier: MPL-2.0
/**
 * timeline-panel: the keyframe dock - depth control, keyframe list, ease select, latch, group popover.
 *
 * Every function takes the shared `tp: TpCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `tp.<module>.<fn>`. Extracted verbatim
 * from initTimelinePanel() by scripts/split-closure.ts.
 */
import { t } from '../../i18n.ts';
import { icon } from '../../lib/icons.ts';
import { announce } from '../../a11y.ts';
import { edgeDockWidth } from '../../lib/edge-dock.ts';
import type { PopoverAnchor } from '../../components/body-popover.ts';
import { EASINGS } from '../../lib/transitions.ts';
import { KF_CAMERA_CHANNELS, KF_EASE_TOKENS, KF_HOLD_EASE, KF_Z_FIELD_CLAMP, kfEaseCss, kfEaseName, kfEaseToken } from '../../../../../engine/src/keyframes.ts';
import type { KfTrack } from '../../../../../engine/src/keyframes.ts';
import { mountEasingEditor } from '../../components/easing-editor.ts';
import { clearKfTrack, fmtTime, indexOfId, kfBoxTrack, kfDiamondAt, kfFormatChannel, kfKeyAt, kfLocalMs, kfPoseAt, kfSlideMs, kfTimelineSec, kfTrackRetime, kfTrackSetEase, writeKfPose } from '../timeline-math.ts';
import type { Box } from '../timeline-math.ts';
import { KF_Z_SLIDER, clamp, finite } from '../timeline-config.ts';
import { kfEasePreset } from './shared.ts';
import type { InspectorGroup, KfLatchRefs, KfPoseField } from './shared.ts';
import { bindOp, type TpCtx } from './context.ts';

/**
 * Build the Keyframes group's body for an ANIMATED box (or a camera).
 *
 * Order is the reading order of the feature: where am I (the latch), what can I
 * change here (the pose), what is on this track (the list), and how do I stop
 * (remove). The list is the KEYBOARD AND SCREEN-READER ROUTE to the diamonds - real
 * buttons with real labels - which is what lets the diamonds themselves stay
 * aria-hidden pointer sugar on a `role="option"` bar.
 */
/**
 * The Depth control, surfaced DIRECTLY on a box that has no track yet (audit A5#1).
 *
 * Depth is a box PROPERTY (`cfg.zField`), not a keyframe: it is the one pose channel
 * with a base field of its own, so writing it off a diamond sets the box's own depth
 * (section 5.2 / section 8's "edits write the BASE") rather than minting a keyframe. It used to be
 * reachable only through the Keyframes pose row - i.e. only AFTER pressing Animate,
 * which a still, un-animated layer has no reason to do. Standing a lifted layer off the
 * board is the whole point of a flythrough's parallax, so it should not cost a keyframe
 * track to reach.
 *
 * This does NOT cross section 8's disclosure law: it writes the box's `z` field through the
 * SAME `ensureSceneCameraRows(patchBox(...))` path the pose row already uses off a
 * diamond - no track is created, exactly as setting position or size creates none, and
 * a box nobody touches keeps `zField` absent, so its export stays byte-identical. Only
 * rendered in the no-track branch; once a box has keyframes the pose row owns Depth (and
 * can key it), so there is never a second control disagreeing about where the value goes.
 */
export function buildDepthControl(tp: TpCtx, group: InspectorGroup, id: string, box: Box): void {
  const { cfg, getBoxes } = tp;
  if (!cfg.zField) return;
  const field = cfg.zField;
  const cur = clamp(finite(box[field], 0), KF_Z_FIELD_CLAMP[0], KF_Z_FIELD_CLAMP[1]);

  const wrap = document.createElement('label');
  wrap.className = 'field-row field-row--inline tl-field tl-depth-row';
  const lab = document.createElement('span');
  lab.className = 'field-label';
  lab.textContent = t('Depth');

  const num = document.createElement('input');
  num.className = 'field-input tl-num tl-depth-num';
  num.type = 'number';
  num.step = '10';
  num.min = String(KF_Z_FIELD_CLAMP[0]);
  num.max = String(KF_Z_FIELD_CLAMP[1]);
  num.value = kfFormatChannel('z', cur);

  // The tasteful 0–300 travel of the pose row's own slider, while the number beside it
  // still takes the whole field range (negatives included) - both held to the engine's
  // `KF_Z_FIELD_CLAMP`, never re-typed here.
  const slider = document.createElement('input');
  slider.className = 'tl-kf-slider tl-depth-slider';
  slider.type = 'range';
  slider.min = String(KF_Z_SLIDER[0]);
  slider.max = String(KF_Z_SLIDER[1]);
  slider.step = '10';
  slider.setAttribute('aria-label', t('Depth'));
  slider.value = String(clamp(cur, KF_Z_SLIDER[0], KF_Z_SLIDER[1]));

  // One model write per gesture: `input` mirrors into the number continuously, `change`
  // fires once on release and is the one that commits - the pose row's own contract.
  const commit = (raw: number): void => {
    const v = clamp(raw, KF_Z_FIELD_CLAMP[0], KF_Z_FIELD_CLAMP[1]);
    num.value = kfFormatChannel('z', v);
    // The first depth interaction mints the scene camera in the SAME commit (section 5.4), so
    // one gesture stays one ⌘Z and the camera panel becomes reachable - identical to the
    // pose row's off-diamond base write.
    const seeded = tp.camera.ensureSceneCameraRows(tp.helpers.patchBox(getBoxes(), id, { [field]: v }));
    tp.helpers.write(seeded.rows);
  };
  slider.addEventListener('input', () => {
    num.value = kfFormatChannel('z', finite(slider.value, 0));
  });
  slider.addEventListener('change', () => commit(finite(slider.value, 0)));
  num.addEventListener('change', () => {
    const raw = num.value.trim();
    if (raw === '') return;
    commit(finite(raw, 0));
  });

  wrap.append(lab, slider, num);
  group.body.appendChild(wrap);
}
export function buildKeyframes(tp: TpCtx, 
  group: InspectorGroup,
  id: string,
  box: Box,
  track: KfTrack,
  isCam = false
): void {
  const { KF_POSE_FIELDS, cfg, getBoxes } = tp;
  const body = group.body;
  const dur = tp.rows.span(box, tp.rows.durationSec()).dur;

  // ── the latch line ────────────────────────────────────────────────────────
  // The READOUT only. Its "+Keyframe" button moved out to the transport and the
  // canvas contextual bar in section 8's M2.5 revision: one action wants one home per
  // surface, and a third copy inside a popover that has to be opened first is the
  // one nobody would find.
  const latch = document.createElement('div');
  latch.className = 'tl-kf-latch';
  const state = document.createElement('span');
  state.className = 'tl-kf-state';
  // No aria-live: this changes on every scrub, and narrating "Keyframe at 0:01.2,
  // scene pose, keyframe at 0:01.4…" through a drag is not information. The state
  // is spoken where it is ACTED on - the pose fields' own labels below carry it.
  state.textContent = t('No keyframe here');
  latch.append(state);
  body.appendChild(latch);

  // ── the pose ──────────────────────────────────────────────────────────────
  //
  // A CAMERA has none of these: its channels are pan / dolly / focus / aperture /
  // FOV strength, and they live in the Camera group (section 8's seam). Scale, opacity and
  // blur on a camera would be controls for something that paints nothing.
  //
  // The section 5.2 "size is not keyframable" tooltip is GONE, and its absence is the
  // point: the P1 reversal (Andy, 2026-08-12 - "I can't change width and height of
  // elements and have them tween") put `w`/`h` on the wire, and a resize ON a
  // diamond now writes them. Size is still authored on the CANVAS, like x/y/r, so it
  // earns no field here - but the standing claim that it could never be animated had
  // to go.
  const pose: KfPoseField[] = [];
  if (!isCam) {
    const poseWrap = document.createElement('div');
    poseWrap.className = 'tl-kf-pose';
    body.appendChild(poseWrap);
    for (const f of KF_POSE_FIELDS) {
      const el = document.createElement('input');
      el.className = 'field-input tl-num tl-kf-pose-num';
      el.type = 'number';
      el.step = String(f.step);
      el.min = String(f.range[0]);
      el.max = String(f.range[1]);
      el.dataset.ch = f.ch;
      // ONE writer behind BOTH controls on the row (the number, and on `z` the
      // slider beside it), so two doors onto one channel cannot disagree about
      // where the value arrives.
      const commitChannel = (raw: number): void => {
        // RE-DERIVE THE LATCH AT COMMIT TIME, because `el.disabled` is not the guard
        // it looks like. `syncKfLatch` flips it on every clock tick; disabling a
        // FOCUSED input blurs it, and a browser commits the pending edit as `change`
        // on that blur - so a number typed while parked on a diamond could otherwise
        // land as a BRAND-NEW keyframe wherever the playhead had since travelled (a
        // ruler scrub `preventDefault()`s, so the field keeps focus throughout).
        // section 8's model is "nobody keyframes by accident".
        const rows = getBoxes();
        const j = indexOfId(rows, cfg, id);
        const at = tp.keyframes.playheadSec();
        if (j < 0) return;
        const on = kfDiamondAt(rows[j]!, cfg, at) !== null;
        // `min`/`max` are the SPINNER's range, not a validator: a typed value is
        // committed verbatim on `change`, so without this a Depth of 5000 reached
        // the engine's much wider WIRE clamp and stored a number the field's own
        // range says is impossible (section 5.1 names the inspector as a
        // `KF_Z_FIELD_CLAMP` site). Reflected back into the control, so the field
        // never disagrees with the model.
        const v = clamp(raw, f.range[0], f.range[1]);
        el.value = kfFormatChannel(f.ch, v);
        if (!on) {
          // OFF a diamond, section 8's rule is "edits write the BASE" - and depth and the
          // two tilt angles are the channels here that HAVE one: a keyed `z`/`rx`/`ry`
          // REPLACES the box's own field for its segment (section 5.2, P2.1), so the field
          // is exactly what it replaces. Every other channel is refused as before -
          // there is no keyframe to pose and nothing else to write, and minting one
          // would be the accident section 8 forbids. The field NAME comes off `cfg`
          // rather than being spelled here, so a tool that declares no `rxField` is the
          // same refusal as a tool that declares no `zField`.
          const field = f.base ? tp.camera.kfBaseField(f.base) : undefined;
          if (!field) {
            tp.kfPoseKey = '\u0000'; // the memo would otherwise call the stale value current
            syncKfLatch(tp);
            return;
          }
          // THE FIRST DEPTH OR TILT INTERACTION (section 5.4): posing a box in space mints
          // the scene camera in the SAME array, so one gesture stays one commit and one
          // ⌘Z. Both already project correctly without it (no camera box resolves to
          // the DEFAULT camera, never an identity) - the box is what makes the camera
          // panel reachable, not what makes depth or tilt work.
          const seeded = tp.camera.ensureSceneCameraRows(tp.helpers.patchBox(rows, id, { [field]: v }));
          tp.helpers.write(seeded.rows);
          return;
        }
        // 'set', not 'add': a typed number IS the value. The writer still composes a
        // FULL pose around it (every active channel evaluated at this instant), so a
        // diamond never becomes a partial one by being edited.
        // The SAME `rows`/`at` the latch check above was made against - re-reading
        // them here would be asking a second time whether this edit may land.
        tp.helpers.write(writeKfPose(rows, cfg, id, at, { [f.ch]: v }, 'set'));
      };
      el.addEventListener('change', () => {
        const raw = el.value.trim();
        if (raw === '') return;
        commitChannel(finite(raw, 0));
      });
      const wrap = document.createElement('label');
      wrap.className = 'field-row field-row--inline tl-field tl-kf-pose-row';
      const lab = document.createElement('span');
      lab.className = 'field-label';
      lab.textContent = f.label;
      wrap.append(lab, el);
      // THE DEPTH SLIDER (section 5.3 - P1's headline control). Its travel is the tasteful
      // band 0–300 while the number beside it still takes the whole field range,
      // negatives included; both are held to `KF_Z_FIELD_CLAMP`, which is the
      // engine's and is never re-typed here. One model write per gesture: `input`
      // fires continuously and only mirrors into the number, `change` fires once on
      // release and is the one that writes.
      let slider: HTMLInputElement | null = null;
      if (f.slider) {
        slider = document.createElement('input');
        slider.className = 'tl-kf-slider';
        slider.type = 'range';
        slider.min = String(f.slider[0]);
        slider.max = String(f.slider[1]);
        slider.step = String(f.step);
        slider.dataset.ch = f.ch;
        slider.setAttribute('aria-label', f.label);
        const live = slider;
        live.addEventListener('input', () => {
          el.value = kfFormatChannel(f.ch, finite(live.value, 0));
        });
        live.addEventListener('change', () => commitChannel(finite(live.value, 0)));
        wrap.insertBefore(live, el);
      }
      poseWrap.appendChild(wrap);
      // `base` only where the tool actually declares the field to fall back to: the
      // commit refuses on a missing `cfg` name, so a control that stayed live off a
      // diamond would be one the user can type into and watch snap back.
      pose.push({
        ch: f.ch,
        el,
        slider,
        base: f.base && tp.camera.kfBaseField(f.base) ? f.base : undefined,
      });
    }
  }

  // ── the list ──────────────────────────────────────────────────────────────
  const list = document.createElement('div');
  list.className = 'tl-kf-list';
  list.setAttribute('role', 'group');
  list.setAttribute('aria-label', t('Keyframes'));
  for (const k of track) {
    const at = fmtTime(kfTimelineSec(box, cfg, k.t));
    const row = document.createElement('div');
    row.className = 'tl-kf-row';
    row.dataset.t = String(k.t);

    const time = document.createElement('input');
    time.className = 'field-input tl-num tl-kf-time';
    time.type = 'number';
    // The wire's own quantum is the millisecond (section 4.6), so the grid is milliseconds
    // and the step is a hundredth of a second - fine enough to place a beat, coarse
    // enough that the arrow keys are usable.
    time.step = '10';
    time.min = '0';
    time.value = String(k.t);
    // NAMED WITH ITS ROW, exactly as Duplicate and Delete already are. section 8 makes this
    // list the keyboard and screen-reader route to the diamonds (which is what lets
    // the diamonds themselves stay aria-hidden), so a four-key track that tabs as
    // "Keyframe time" four times identifies nothing: the row is the only thing that
    // distinguishes one control from the next, and the row has no label of its own.
    time.setAttribute('aria-label', t('Keyframe time in milliseconds at {t}', { t: at }));
    time.addEventListener('change', () => {
      tp.keyframes.writeTrack(id, (tr) => kfTrackRetime(tr, k.t, kfSlideMs(finite(time.value, k.t), 0, dur)));
    });

    const ease = kfEaseSelect(tp, id, k.t, k.ease, at);

    const dup = tp.helpers.btn('tl-kf-dup', t('Duplicate keyframe at {t}', { t: at }), icon('duplicate'));
    dup.addEventListener('click', () => tp.keyframes.duplicateKeyframe(id, k.t));
    const del = tp.helpers.btn('tl-kf-del', t('Delete keyframe at {t}', { t: at }), icon('trash'));
    del.addEventListener('click', () => tp.keyframes.deleteKeyframe(id, k.t));

    row.append(time, ease, dup, del);
    list.appendChild(row);
  }
  body.appendChild(list);

  // ── the way out ───────────────────────────────────────────────────────────
  // Destructive, named with its own count, and one commit - so ⌘Z brings the whole
  // animation back. Disabling animation IS this: there is no stored flag to clear.
  // Absent on an empty track (a camera, before its first pose): there is nothing to
  // remove, and "Remove 0 keyframes" is a button that describes nothing.
  if (track.length) {
    const remove = tp.helpers.actionBtn(
      'tl-kf-clear',
      track.length === 1
        ? t('Remove 1 keyframe')
        : t('Remove {n} keyframes', { n: String(track.length) }),
      'trash'
    );
    remove.classList.add('is-danger');
    remove.addEventListener('click', () => {
      tp.helpers.write(clearKfTrack(getBoxes(), cfg, id));
      announce(t('Keyframes removed'));
    });
    body.appendChild(remove);
  }

  // ── the curve, DOCKED (section 8's M2.7) ─────────────────────────────────────────
  //
  // "The curve editor docks INSIDE the Keyframes popup (top or bottom of it - one
  // surface, never a second nested popover)". So the per-keyframe ease `<select>`s in
  // the list above no longer carry a "Custom…" route: the plot IS the custom editor,
  // it is always here, and whatever method the latched keyframe holds is what it
  // draws - "they can use presets to learn". Dragging a handle commits a bezier,
  // which is what auto-switches that keyframe's select to Custom.
  //
  // It follows the LATCH like everything else in this popup: the curve it edits is
  // the curve out of the keyframe the playhead is parked on, and off a diamond it
  // says so rather than editing an arbitrary one. `syncKfDock` builds and rebuilds
  // it - never this function, which runs on a model change while the dock has to
  // follow the clock.
  //
  // The standalone editor is NOT retired: the Motion group's Enter/Exit curves still
  // open it (a field, not a keyframe), and so does the diamond's own context menu,
  // which is a pointer route from a bar with no popup open.
  const dockHost = document.createElement('div');
  dockHost.className = 'tl-kf-dock';
  body.appendChild(dockHost);

  tp.kfLatch = {
    id,
    state,
    pose,
    list,
    dock: track.length ? { atMs: Number.NaN, editor: null, host: dockHost } : null,
  };
  tp.kfLatchKey = '\u0000'; // force the next sync: this row has never been read
  tp.kfPoseKey = '\u0000';
}
/**
 * The docked curve editor, rebuilt only when the keyframe it is easing CHANGES.
 *
 * Mounting an easing editor costs an SVG, a rAF loop and a document listener, and the
 * latch is re-read on every clock tick - so this is memoised on the target keyframe's
 * own local ms (NaN meaning "nothing yet", which compares unequal to everything
 * including itself, so the first sync always builds).
 */
export function syncKfDock(tp: TpCtx, refs: KfLatchRefs, box: Box, on: number | null): void {
  const { cfg } = tp;
  const d = refs.dock;
  if (!d) return;
  // ONLY WHILE THE POPUP IS SHOWING. The group's body stays in the document when the
  // group is shut (hidden, not detached), and the easing editor runs a rAF loop for
  // its motion strip which self-terminates only on DETACH - so mounting it into a
  // hidden body would leave an invisible animation painting for the life of the
  // session. `openGroupPopover`/`restoreGroupBody` reset the latch memo, so opening
  // the group builds it and closing it takes it down.
  const showing = tp.openGroup?.gid === 'keyframes' && tp.openGroup.id === refs.id;
  const want = !showing ? Number.POSITIVE_INFINITY : (on ?? Number.NEGATIVE_INFINITY);
  if (Object.is(d.atMs, want)) return;
  d.atMs = want;
  d.editor?.destroy();
  d.editor = null;
  d.host.textContent = '';
  if (!showing) return;
  if (on === null) {
    // The same sentence the pose fields carry, for the same reason and in the same
    // words: there is no keyframe here, so there is no curve to shape.
    const note = document.createElement('p');
    note.className = 'tl-kf-dock-note';
    note.textContent = t('Move the playhead onto a keyframe, or add one.');
    d.host.appendChild(note);
    return;
  }
  const key = kfKeyAt(kfBoxTrack(box, cfg), on);
  if (!key) return;
  if (key.ease === KF_HOLD_EASE) {
    // HOLD IS NOT A CURVE. Drawing the editor's fallback shape here would show a
    // motion this keyframe does not produce, which is the one thing a plot must
    // never do - so the dock says what hold means instead.
    const note = document.createElement('p');
    note.className = 'tl-kf-dock-note';
    note.textContent = t(
      'Hold keeps this pose until the next keyframe. Pick another curve to shape it.'
    );
    d.host.appendChild(note);
    return;
  }
  d.editor = mountEasingEditor(d.host, {
    // The ENGINE's adapters both ways: the wire token in, the CSS bezier the editor
    // speaks out (section 5.1 - "the adapter is mandatory", because the canonical ease wire
    // uses commas and the kf charset bans them).
    value: kfEaseCss(key.ease),
    onCommit: (wire) => tp.keyframes.writeTrack(refs.id, (tr) => kfTrackSetEase(tr, on, kfEaseToken(wire))),
  });
}
/**
 * The ease picker for ONE keyframe - the same vocabulary the transition picker uses.
 * `at` is the row's formatted time: its accessible name has to carry it for the same
 * reason the time field's does (see there).
 */
export function kfEaseSelect(tp: TpCtx, id: string, atMs: number, ease: string, at: string): HTMLSelectElement {
  const el = document.createElement('select');
  el.className = 'field-select tl-select tl-kf-ease';
  el.setAttribute('aria-label', t('Keyframe curve at {t}', { t: at }));
  const opt = (v: string, label: string): void => {
    const o = document.createElement('option');
    o.value = v;
    o.textContent = label;
    el.appendChild(o);
  };
  for (const tok of KF_EASE_TOKENS) {
    // The engine names the curve; `EASINGS` gives that name its word. One
    // vocabulary, so a curve cannot be called two things in two places.
    const name = kfEaseName(tok);
    opt(
      tok,
      name && Object.hasOwn(EASINGS, name) ? t((EASINGS as Record<string, string>)[name]!) : tok
    );
  }
  opt(KF_HOLD_EASE, t('Hold'));
  // CUSTOM IS A STATE, NOT A ROUTE (section 8's M2.7). The transition picker's
  // "Custom…" opens a popover; this list is inside a popup that already has the
  // curve editor DOCKED in it, and a second nested editor is exactly what M2.7
  // replaced. So a keyframe whose ease is an authored bezier selects an option that
  // says so, and dragging a handle in the dock is what puts it there - the numbers
  // live in the dock's own readout, three lines below, rather than in this label.
  // ONE WIRE, NORMALISED ONE WAY ON READ (plans/179 M4). The kf grammar has more than
  // one spelling for the same curve - `eb(0.4)(0)(0.2)(1)` IS Smooth - and a seed by
  // string equality would put a "Custom" row beside the preset it already equals, so
  // the same curve would read as two answers depending on which control wrote it last.
  // `parseKf` canonicalises a preset on its way in today, which is why this is a guard
  // rather than a fix: the read side owes the same answer however the token arrived.
  // Matched by NAME first (the engine's own vocabulary), by the CSS curve second, never
  // by comparing token strings here.
  const seed = kfEasePreset(ease);
  if (!KF_EASE_TOKENS.includes(seed as (typeof KF_EASE_TOKENS)[number]) && seed !== KF_HOLD_EASE)
    opt(seed, t('Custom'));
  el.value = seed;
  el.addEventListener('change', () => {
    tp.keyframes.writeTrack(id, (track) => kfTrackSetEase(track, atMs, el.value));
  });
  return el;
}
/**
 * Read the latch, once, and reflect it - the group header's wording, the pose
 * fields' values and enablement, the marked list row, the enlarged diamond.
 *
 * TWO memos, because the two halves change at different rates and the expensive one
 * must not be paid for the cheap one:
 *
 *   • `kfLatchKey` - the STRUCTURE. Keyed on the latch ANSWER (which selected box is
 *     parked on which diamond) plus the track, so scrubbing across a two-second gap
 *     asks this a hundred times and writes no DOM at all. The bars/dots walk, the
 *     header wording and the list marking live under it.
 *   • `kfPoseKey` - the POSE READOUT. Keyed on the playhead's own local millisecond,
 *     because section 8's M2.5 revision made these fields track it: off a diamond they now
 *     print the EVALUATED value at the playhead (the engine's `evaluateKf`, through
 *     `kfPoseAt` - the same arithmetic the preview and the export read), disabled.
 *     Four `<input>.value` writes per changed millisecond, and only while the
 *     Keyframes popover is actually built.
 */
export function syncKfLatch(tp: TpCtx): void {
  const { bars, cfg, getBoxes, selection } = tp;
  if (!cfg.kfField) return;
  const rows = getBoxes();
  const at = tp.keyframes.playheadSec();
  const sel = selection.get();
  const onOf = new Map<string, number | null>();
  for (const id of sel) {
    const i = indexOfId(rows, cfg, id);
    onOf.set(id, i < 0 ? null : kfDiamondAt(rows[i]!, cfg, at));
  }
  const refs = tp.kfLatch;
  const i = refs ? indexOfId(rows, cfg, refs.id) : -1;
  const box = i >= 0 ? rows[i]! : null;
  const on =
    refs && box ? (onOf.has(refs.id) ? onOf.get(refs.id)! : kfDiamondAt(box, cfg, at)) : null;
  const key = `${sel.map((id) => `${id}:${onOf.get(id) ?? ''}`).join(',')}|${refs?.id ?? ''}|${
      box && cfg.kfField ? String(box[cfg.kfField] ?? '') : ''
    }`;
  if (key !== tp.kfLatchKey) {
    tp.kfLatchKey = key;

    // The selected diamond draws large (section 3's observed-Depthfield note). Only on a
    // SELECTED bar: an unselected clip's diamonds are a picture of its animation, not
    // a control surface, and marking one of them would claim an edit target the
    // playhead does not actually own.
    for (const [id, el] of bars) {
      const strip = el.querySelector<HTMLElement>('.tl-kf-strip');
      if (!strip) continue;
      const dotOn = onOf.get(id) ?? null;
      for (const dot of Array.from(strip.children) as HTMLElement[]) {
        dot.classList.toggle('is-selected', dotOn !== null && dot.dataset.t === String(dotOn));
      }
    }

    if (refs && box) {
      refs.state.textContent =
        on === null
          ? t('No keyframe here')
          : t('Keyframe @ {t}', { t: fmtTime(kfTimelineSec(box, cfg, on)) });
      refs.state.classList.toggle('is-on', on !== null);
      for (const row of Array.from(refs.list.children) as HTMLElement[]) {
        row.classList.toggle('is-current', on !== null && row.dataset.t === String(on));
      }
      // The docked curve follows the same answer (section 8's M2.7). Inside the structural
      // memo, because mounting an editor is the most expensive thing this function
      // can do and the latch is what decides whether it has to happen at all.
      syncKfDock(tp, refs, box, on);
    }
  }

  if (!refs || !box) return;
  // Where to READ the pose from: the diamond when parked on one, otherwise the
  // playhead itself. `kfPoseAt` evaluates the track through the engine, so an
  // off-diamond number is the value the box is actually striking at this instant -
  // the same number the preview shows and the export writes.
  const readMs = on ?? kfLocalMs(box, cfg, at);
  // Every BASE field is in the memo, not just depth: off a diamond those rows read the
  // box's own field, so a tilt written from the canvas has to repaint the row the same
  // way a depth does.
  const poseKey = `${refs.id}|${on ?? ''}|${readMs}|${String(box[cfg.kfField] ?? '')}|${
      cfg.zField ? String(box[cfg.zField] ?? '') : ''
    }|${cfg.rxField ? String(box[cfg.rxField] ?? '') : ''}|${
      cfg.ryField ? String(box[cfg.ryField] ?? '') : ''
    }`;
  if (poseKey === tp.kfPoseKey) return;
  tp.kfPoseKey = poseKey;
  for (const f of refs.pose) {
    // EVALUATED, never blank (section 8's M2.5 point 3: blanking was honest but read as
    // broken). A disabled control showing the live value says "this is what it is
    // doing here, and there is no keyframe here to change it on" - which is the
    // truth. The memo above is keyed on `readMs`, so this genuinely tracks the
    // playhead rather than freezing at whatever the last diamond was.
    const v = kfPoseAt(box, cfg, readMs, [f.ch])[f.ch];
    const shown = typeof v === 'number' ? kfFormatChannel(f.ch, v) : '';
    if (f.el.value !== shown) f.el.value = shown;
    if (f.slider && f.slider.value !== shown) f.slider.value = shown;
    // OFF a diamond these are inert: there is no keyframe to pose, and an edit here
    // would have to invent one silently. "+Keyframe" is the one press that changes
    // that, and the title says so rather than leaving a dead control unexplained.
    //
    // EXCEPT DEPTH AND THE TWO TILT ANGLES (section 5.3, P1; P2.1): each has a base field
    // of its own, so off a diamond an edit there is not an invention - it is section 8's
    // "edits write the base", which is the whole reason the depth slider is usable on a
    // box that has never been keyframed at all. `base` is set on exactly the channels
    // that have one AND whose field this tool declares.
    const inert = on === null && !f.base;
    f.el.disabled = inert;
    f.el.title = inert ? t('Move the playhead onto a keyframe, or add one.') : '';
    if (f.slider) {
      f.slider.disabled = inert;
      f.slider.title = f.el.title;
    }
  }
}
/**
 * The CAMERA's channels, re-read on the same tick as the latch (section 8).
 *
 * Same readout law as the pose fields - the live EVALUATED pose, so the numbers are
 * what the shot is actually doing at this instant - but a different enablement rule,
 * because a camera's scene default IS a keyframe: `cameraPoseAtSec` has the three
 * cases, and this is just a picture of its answer.
 *
 * Its own memo, its own reference: the camera group can exist on a row whose
 * Keyframes group does not (a tool declaring a camera kind and no `kf` sub-field),
 * and the two are built in the opposite order from the one they sync in.
 */
export function syncKfCam(tp: TpCtx): void {
  const { cfg, getBoxes } = tp;
  const refs = tp.kfCam;
  if (!refs || !cfg.kfField) return;
  const rows = getBoxes();
  const i = indexOfId(rows, cfg, refs.id);
  if (i < 0) return;
  const box = rows[i]!;
  const at = tp.keyframes.playheadSec();
  const on = kfDiamondAt(box, cfg, at);
  const readMs = on ?? kfLocalMs(box, cfg, at);
  const key = `${refs.id}|${readMs}|${String(box[cfg.kfField] ?? '')}|${
      cfg.zField ? String(box[cfg.zField] ?? '') : ''
    }`;
  if (key === tp.kfCamKey) return;
  tp.kfCamKey = key;
  const writable = tp.camera.cameraPoseAtSec(box, at) !== null;
  const pose = kfPoseAt(box, cfg, readMs, KF_CAMERA_CHANNELS);
  for (const f of refs.fields) {
    const v = pose[f.ch];
    const shown = typeof v === 'number' ? kfFormatChannel(f.ch, v) : '';
    if (f.el.value !== shown) f.el.value = shown;
    f.el.disabled = !writable;
    f.el.title = writable ? '' : t('Move the playhead onto a keyframe, or add one.');
  }
}
/**
 * ABOVE the transport, never below it.
 *
 * The panel is docked at the BOTTOM of the stage and the bar is its top edge, so a
 * popover dropped under its anchor would open into the tracks it exists to edit (and
 * off the bottom of the window on a short viewport). Bottom-aligned to the panel's
 * own top edge, near-edge aligned to the anchor (left under ltr, right under rtl -
 * `menuPosition`'s rule, for the same reason), and clamped into the viewport.
 */
export function groupPopPosition(tp: TpCtx, el: HTMLDivElement, anchor: PopoverAnchor): void {
  const { root } = tp;
  const r = anchor.getBoundingClientRect();
  const pw = el.offsetWidth;
  const ph = el.offsetHeight;
  const vw = window.innerWidth || 1024;
  const panelTop = root.getBoundingClientRect().top || window.innerHeight || 768;
  const rtl = document.documentElement.dir === 'rtl';
  const near = rtl ? r.right - pw : r.left;
  // Clamp to the CONTENT area, not the viewport: a docked column reserves inline-end
  // space (right in ltr, left in rtl), so keep the popover clear of it.
  const dockW = edgeDockWidth();
  const left = Math.max(8 + (rtl ? dockW : 0), Math.min(near, vw - pw - 12 - (rtl ? 0 : dockW)));
  el.style.left = `${Math.round(left)}px`;
  el.style.top = `${Math.round(Math.max(8, panelTop - ph - 8))}px`;
}
/**
 * Put the borrowed body back in its segment (hidden) and forget the open state.
 *
 * Called from the popover's own `onClose`, so it runs however the popover was
 * dismissed. It must NOT call `groupPop.close()` - that is what called it.
 */
export function restoreGroupBody(tp: TpCtx): void {
  const { groupsById } = tp;
  const g = tp.openGroup ? groupsById.get(tp.openGroup.gid) : null;
  if (g) {
    if (g.body.parentElement === tp.groupPopHost) {
      g.body.hidden = true;
      g.root.appendChild(g.body);
    }
    g.root.classList.remove('is-open');
    g.head.setAttribute('aria-expanded', 'false');
  }
  tp.openGroup = null;
  tp.groupPopHost = null;
  // …and the moment it stops being true. Not a sync call: `restoreGroupBody` runs
  // from the popover's own close hook, sometimes mid-teardown, so it only invalidates
  // the memo and lets the next tick (or the next render) take the editor down.
  tp.kfLatchKey = '\u0000';
  tp.kfLatch?.dock?.editor?.destroy();
  if (tp.kfLatch?.dock) {
    tp.kfLatch.dock.editor = null;
    tp.kfLatch.dock.atMs = Number.NaN;
  }
}
/** Shut the popover, whoever asked. Idempotent; `restoreGroupBody` runs underneath. */
export function closeGroupPopover(tp: TpCtx, returnFocus = false): void {
  const { groupPoint, groupPop } = tp;
  // The delegate is still needed by `close()` itself (aria-expanded, focus restore),
  // so it is cleared AFTER, not before.
  groupPop.close(returnFocus);
  groupPoint.delegate = null;
  // Belt and braces for the never-opened case, where `close()` returns early and the
  // hook above never runs.
  if (tp.openGroup) restoreGroupBody(tp);
}
/**
 * Aim the point at one segment.
 *
 * A `pointAnchor`'s rect is degenerate (`left === right === x`), so the NEAR edge has
 * to be chosen here rather than in the placement: under `dir=rtl` that is the
 * segment's right edge, which is what makes the card open towards the button that
 * spawned it in Arabic, Hebrew, Farsi and Urdu instead of away from it.
 */
export function aimGroupPoint(tp: TpCtx, head: HTMLElement): void {
  const { groupPoint } = tp;
  const r = head.getBoundingClientRect();
  groupPoint.x = document.documentElement.dir === 'rtl' ? r.right : r.left;
  groupPoint.y = r.bottom;
  groupPoint.delegate = head;
}
/** Open ONE group's body in the popover, swapping out whatever was showing. */
export function openGroupPopover(tp: TpCtx, gid: string, id: string): void {
  const { groupPop, groupsById } = tp;
  const g = groupsById.get(gid);
  if (!g) return;
  if (tp.openGroup?.gid === gid) {
    closeGroupPopover(tp, true);
    return;
  }
  closeGroupPopover(tp);
  tp.openGroup = { gid, id };
  aimGroupPoint(tp, g.head);
  g.root.classList.add('is-open');
  groupPop.open();
  // The docked curve editor is mounted only while its popup is SHOWING (see
  // `syncKfDock`), and this is the moment that becomes true.
  tp.kfLatchKey = '\u0000';
  syncKfLatch(tp);
}
/**
 * After a rebuild: re-point the popover at the segment that replaced its anchor, and
 * move the freshly built body inside it. A field edit inside the popover commits,
 * which rebuilds the whole inspector row - without this the popover would be left
 * holding the DETACHED body of a row that no longer exists, and Escape would restore
 * focus to a node that is not in the document.
 */
export function resyncGroupPopover(tp: TpCtx, id: string): void {
  const { groupsById } = tp;
  if (!tp.openGroup) return;
  const g = groupsById.get(tp.openGroup.gid);
  // The selection moved on, or this box no longer offers the group (its track was
  // removed, its sound detached): there is nothing to re-point at, so shut.
  if (!g || tp.openGroup.id !== id) {
    closeGroupPopover(tp);
    return;
  }
  if (!tp.groupPopHost) {
    closeGroupPopover(tp);
    return;
  }
  aimGroupPoint(tp, g.head);
  g.head.setAttribute('aria-expanded', 'true');
  g.root.classList.add('is-open');
  tp.groupPopHost.textContent = '';
  g.body.hidden = false;
  tp.groupPopHost.appendChild(g.body);
}
export function kfDockOps(tp: TpCtx) {
  return {
    buildDepthControl: bindOp(tp, buildDepthControl),
    buildKeyframes: bindOp(tp, buildKeyframes),
    syncKfDock: bindOp(tp, syncKfDock),
    kfEaseSelect: bindOp(tp, kfEaseSelect),
    syncKfLatch: bindOp(tp, syncKfLatch),
    syncKfCam: bindOp(tp, syncKfCam),
    groupPopPosition: bindOp(tp, groupPopPosition),
    restoreGroupBody: bindOp(tp, restoreGroupBody),
    closeGroupPopover: bindOp(tp, closeGroupPopover),
    aimGroupPoint: bindOp(tp, aimGroupPoint),
    openGroupPopover: bindOp(tp, openGroupPopover),
    resyncGroupPopover: bindOp(tp, resyncGroupPopover),
  };
}
