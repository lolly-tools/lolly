// SPDX-License-Identifier: MPL-2.0
/**
 * timeline-panel: the inspector groups and the inspector render.
 *
 * Every function takes the shared `tp: TpCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `tp.<module>.<fn>`. Extracted verbatim
 * from initTimelinePanel() by scripts/split-closure.ts.
 */
import { t } from '../../i18n.ts';
import { icon } from '../../lib/icons.ts';
import type { IconName } from '../../lib/icons.ts';
import { announce } from '../../a11y.ts';
import { mountBodyPopover } from '../../components/body-popover.ts';
import { EASINGS, HOLD_FX, MAX_HOLD_RATE, MAX_SPLIT_STAGGER_MS, MIN_HOLD_RATE, SPLIT_ORDERS, SPLIT_TIERS, TRANSITIONS, TRANSITION_KINDS, easingToWire, isHoldFx, isSplitOrder, isSplitTier, isTransitionKind } from '../../lib/transitions.ts';
import { parseKf } from '../../../../../engine/src/keyframes.ts';
import { MAX_TRANSITION_MS, MIN_TRANSITION_MS } from '../sequence-clock.ts';
import { appearModeOf, setAppear } from '../../lib/motion-model.ts';
import type { AppearIntent, AppearMode } from '../../lib/motion-model.ts';
import { MAX_TIME_S, MIN_DUR, boxTiming, fmtDur, fmtTime, indexOfId, isTimed, kfBoxTrack, kfFormatChannel, kfWriteMs, moveOverlay, setClipIn, setDuration, setKfTrack, setSpeed, writeKfPose } from '../timeline-math.ts';
import type { Box } from '../timeline-math.ts';
import { integratedLoudness } from '../../../../../engine/src/audio-loudness.ts';
import { FX_PRESETS, parseFxChain, serializeFxChain } from '../../../../../engine/src/audio-fx.ts';
import { KF_CAMERA_PRESETS, clamp, finite } from '../timeline-config.ts';
import { animateSummary, canPlayOnce, groupBodySeq, playOnce, setGroupBodySeq } from './shared.ts';
import type { InspectorGroup, KfPoseField } from './shared.ts';
import { bindOp, type TpCtx } from './context.ts';

/** One group of the clip inspector. Shut by default, always. */
export function inspectorGroup(tp: TpCtx, gid: string, labelText: string, glyph: IconName): InspectorGroup {
  const { groupsById } = tp;
  const wrap = document.createElement('div');
  wrap.className = 'tl-group';
  wrap.dataset.group = gid;

  const head = document.createElement('button');
  head.type = 'button';
  head.className = 'tl-group-head';
  head.setAttribute('aria-expanded', 'false');
  head.setAttribute('aria-haspopup', 'dialog');
  setGroupBodySeq(groupBodySeq + (1));
  const bodyId = `tl-g-${gid}-${groupBodySeq}`;
  head.setAttribute('aria-controls', bodyId);

  // Icon BESIDE the text, never instead of it: the glyph is decorative
  // (`icon()` stamps aria-hidden), and the button's accessible name is the label
  // plus whatever the summary currently reads.
  const ico = document.createElement('span');
  ico.className = 'tl-group-icon';
  ico.innerHTML = icon(glyph);
  const lab = document.createElement('span');
  lab.className = 'tl-group-label';
  lab.textContent = labelText;
  // ALWAYS shown now, which is what makes the segment a constant width: the chips are
  // the segment's whole reading, and the body they summarise is somewhere else.
  const chipRow = document.createElement('span');
  chipRow.className = 'tl-group-chips';
  const caret = document.createElement('span');
  caret.className = 'tl-group-caret';
  caret.innerHTML = icon('chevronDown');
  head.append(ico, lab, chipRow, caret);

  const body = document.createElement('div');
  body.className = 'tl-group-body';
  body.id = bodyId;
  body.hidden = true;
  wrap.append(head, body);

  const group: InspectorGroup = {
    root: wrap,
    body,
    head,
    label: labelText,
    setSummary(parts: string[]): void {
      chipRow.textContent = '';
      for (const p of parts) {
        if (!p) continue;
        const c = document.createElement('span');
        c.className = 'tl-group-chip';
        c.textContent = p;
        chipRow.appendChild(c);
      }
    },
    isOpen: () => tp.openGroup?.gid === gid && !body.hidden,
  };
  groupsById.set(gid, group);

  head.addEventListener('click', () => {
    // Purely a UI disclosure: no write() anywhere on this path, and `inspectorKey`
    // never sees it (see its comment) - so this can never dirty the session.
    tp.kfDock.openGroupPopover(gid, tp.inspectorId);
  });

  return group;
}
/**
 * The CAMERA group (plans/104 section 8) - the scene-camera panel, and the only place a
 * camera's pose is typed rather than dragged.
 *
 * Three parts, in the order a shot is set up: the preset MOVES (each one commit, each
 * expanded onto the track), the pose CHANNELS with their affordance chips, and
 * nothing else. The chips are the reference tool's own vocabulary - DRAG on the pans,
 * SHIFT-DRAG on the tilts, SCROLL on the dolly - and they are honest here because this
 * group is only ever shown while the camera is selected, which is exactly the
 * condition that arms those canvas gestures (`cameraModeId`).
 *
 * The presets are BUTTONS, not a nested menu: this body is already borrowed into a
 * body-mounted popover, and a menu opened from inside it would be a second popover
 * that the card's own outside-press dismissal would have to be taught about (the
 * `.tl-ease-pop` exemption exists for exactly that reason, and one exemption is
 * enough). A press here is one preset, one commit, one undo step.
 */
export function buildCameraGroup(tp: TpCtx, id: string, box: Box): void {
  const { KF_CAMERA_FIELDS, cfg, getBoxes, inspector } = tp;
  const g = inspectorGroup(tp, 'camera', t('Camera'), 'camera');
  inspector.appendChild(g.root);
  // What the segment reads at a glance: how many poses this camera holds. A camera
  // with none is the scene default - one still shot - and says so.
  const n = kfBoxTrack(box, cfg).length;
  g.setSummary([
    n === 0
      ? t('Not animated')
      : n === 1
        ? t('1 keyframe')
        : t('{n} keyframes', { n: String(n) }),
  ]);

  const moves = document.createElement('div');
  moves.className = 'tl-cam-presets';
  moves.setAttribute('role', 'group');
  moves.setAttribute('aria-label', t('Camera moves'));
  for (const preset of KF_CAMERA_PRESETS) {
    const b = tp.helpers.actionBtn(`tl-cam-preset tl-cam-${preset.id}`, preset.label, preset.icon);
    b.addEventListener('click', () => tp.camera.applyCameraPreset(preset));
    moves.appendChild(b);
  }
  // ORBIT USED TO LIVE HERE, hand-built and `aria-disabled` with the reason "Needs
  // tilt (coming)". P2 is that tilt, so it has moved into `KF_CAMERA_PRESETS` above
  // and comes out of the loop like every other move. The dimmed twin is GONE rather
  // than kept: a control explaining what it is waiting for is only honest while it is
  // still waiting, and this codebase's own rule about the raster allowlist applies
  // word for word - "don't leave a reason standing once it stops being true".
  g.body.appendChild(moves);

  const cam: KfPoseField[] = [];
  for (const f of KF_CAMERA_FIELDS) {
    const el = document.createElement('input');
    el.className = 'field-input tl-num tl-cam-num';
    el.type = 'number';
    el.step = String(f.step);
    el.min = String(f.range[0]);
    el.max = String(f.range[1]);
    el.dataset.ch = f.ch;
    el.addEventListener('change', () => {
      const raw = el.value.trim();
      if (raw === '') return;
      // Re-derived at commit time, exactly as the pose fields are and for the same
      // reason: `disabled` is a picture of the latch, not a guard on it.
      const rows = getBoxes();
      const j = indexOfId(rows, cfg, id);
      if (j < 0) return;
      const at = tp.camera.cameraPoseAtSec(rows[j]!, tp.keyframes.playheadSec());
      if (at === null) {
        tp.kfCamKey = '\u0000';
        tp.kfDock.syncKfCam();
        return;
      }
      const v = clamp(finite(raw, 0), f.range[0], f.range[1]);
      el.value = kfFormatChannel(f.ch, v);
      tp.helpers.write(writeKfPose(rows, cfg, id, at, { [f.ch]: v }, 'set'));
    });
    const wrap = document.createElement('label');
    wrap.className = 'field-row field-row--inline tl-field tl-cam-row';
    const lab = document.createElement('span');
    lab.className = 'field-label';
    lab.textContent = f.label;
    wrap.append(lab, el);
    if (f.hint) {
      // DECORATION, and marked as such: the gesture it names is on the canvas, the
      // control beside it does the same job for a keyboard, and a screen reader
      // reading "Pan X, drag" would be describing a mouse to someone not using one.
      const chip = document.createElement('span');
      chip.className = 'tl-cam-chip';
      chip.textContent = f.hint;
      chip.setAttribute('aria-hidden', 'true');
      wrap.appendChild(chip);
    }
    g.body.appendChild(wrap);
    cam.push({ ch: f.ch, el });
  }
  // The camera's channels ride the latch like every other live readout - but in a
  // reference of their own rather than inside `kfLatch`, because the Keyframes group
  // that owns that one is built AFTER this and is not guaranteed to exist at all (a
  // tool could declare a camera kind and no `kf` sub-field). One nullable ref, set
  // here, cleared on every inspector rebuild.
  tp.kfCam = { id, fields: cam };
}
export function renderInspector(tp: TpCtx, boxes: Box[]): void {
  const { bars, cfg, chips, easeMenu, easePoint, getBoxes, groupsById, inspector, selection } = tp;
  // Bars AND chips: an untimed box has no bar, and gating on `bars` alone is what
  // made "always on" a dead end - selecting a scenery chip rendered an empty bar and
  // there was no field anywhere in the UI that could give the box a time.
  const ids = selection.get().filter((id) => bars.has(id) || chips.has(id));
  const id = ids.length === 1 ? ids[0]! : '';
  const i = id ? indexOfId(boxes, cfg, id) : -1;
  const box = i >= 0 ? boxes[i]! : null;
  // MODEL VALUES ONLY - appended to, never trimmed. Group disclosure is session UI
  // state and deliberately absent: folding it in here would rebuild the whole row on
  // every toggle (throwing away the focus the user just pressed with), and would make
  // a repaint memo that is supposed to answer "did the MODEL change" answer something
  // else. The three added at the tail are what the regroup reads that the flat row
  // did not: the keyframe track and the box kind gate the Keyframes group's very
  // existence (plans/104 section 8). The A/V link no longer decides anything in this row -
  // M2.6 sent detach / re-attach back to the clip context menu - but it STAYS in the
  // key, because this list is appended to and never trimmed: a spare entry costs one
  // string compare, and dropping one is how a row starts printing stale values the
  // day something reads that field again. `z` joins them for the same reason `kf`
  // did: the pose row shows the box's depth wherever no keyframe overrides it (section 5.2),
  // so a depth edit made anywhere else must repaint this row or it prints a stale
  // number. `mute` is what flips the speaker toggle's glyph and `aria-pressed`.
  // `build` joins them for the Appears row (plans/179 M4): the step is the only one of
  // the three ways a box can appear that was not already in this list, and a row that
  // does not repaint after it is written keeps the wrong segment pressed.
  const key = box
    ? `${id}|${JSON.stringify([box[cfg.startField], box[cfg.durField], box[cfg.clipInField], box[cfg.speedField], box[cfg.enterField], box[cfg.exitField], box[cfg.enterMsField], box[cfg.exitMsField], box[cfg.muteField], cfg.enterEaseField ? box[cfg.enterEaseField] : '', cfg.exitEaseField ? box[cfg.exitEaseField] : '', cfg.kfField ? box[cfg.kfField] : '', cfg.zField ? box[cfg.zField] : '', cfg.linkField ? box[cfg.linkField] : '', box.kind, cfg.gainField ? box[cfg.gainField] : '', cfg.splitField ? box[cfg.splitField] : '', cfg.staggerField ? box[cfg.staggerField] : '', cfg.splitOrderField ? box[cfg.splitOrderField] : '', cfg.holdField ? box[cfg.holdField] : '', cfg.holdRateField ? box[cfg.holdRateField] : '', cfg.panField ? box[cfg.panField] : '', cfg.duckField ? box[cfg.duckField] : '', cfg.pitchField ? box[cfg.pitchField] : '', cfg.varispeedField ? box[cfg.varispeedField] : '', cfg.fxField ? box[cfg.fxField] : '', box.build])}`
    : '';
  if (key === tp.inspectorKey) return;
  tp.inspectorKey = key;
  tp.inspectorId = id;
  inspector.textContent = '';
  // The segments about to be destroyed are the popover's anchor and its content. The
  // map is rebuilt below; `resyncGroupPopover` at the end of this function re-points
  // an open popover at the segment that replaced its anchor (or shuts it), which is
  // what makes editing a field inside the popover - a commit, hence a rebuild - not
  // close the popover under the user's hands.
  groupsById.clear();
  // The row about to be destroyed owned the latch's DOM. Drop the reference before
  // anything can read a detached node, and reset the memo so the rebuilt row is
  // re-read rather than assumed to still match. The DOCKED curve editor holds a rAF
  // loop and a document listener of its own, so it is torn down rather than dropped
  // (its own loop self-terminates when detached, but the listener does not).
  tp.kfLatch?.dock?.editor?.destroy();
  tp.kfLatch = null;
  tp.kfLatchKey = '\u0000';
  tp.kfPoseKey = '\u0000';
  tp.kfCam = null;
  tp.kfCamKey = '\u0000';
  // An empty row still claims the bar's 10px flex gap, which reads as an unexplained
  // notch beside the tool buttons once the selection is dropped. Take it out of the
  // layout instead, so the toolbar returns to exactly the shape it had before.
  inspector.hidden = !box;
  if (!box) {
    tp.inspectorShown = false;
    if (tp.inspectorEnterT) {
      clearTimeout(tp.inspectorEnterT);
      tp.inspectorEnterT = null;
    }
    inspector.classList.remove('is-entering');
    // Nothing selected, so there is no clip whose settings this could be showing.
    tp.kfDock.closeGroupPopover();
    return;
  }
  if (!tp.inspectorShown) {
    tp.inspectorShown = true;
    inspector.classList.remove('is-entering');
    if (tp.inspectorEnterT) clearTimeout(tp.inspectorEnterT);
    // A tick, not zero: the class has to land on a row the browser has already laid
    // out, or the animation is coalesced into the same style pass that built the row
    // and never plays at all.
    tp.inspectorEnterT = setTimeout(() => {
    const { inspector } = tp;
      tp.inspectorEnterT = null;
      inspector.classList.add('is-entering');
    }, 32);
  }
  const timing = boxTiming(box, cfg);

  const row = (labelText: string, control: HTMLElement): HTMLElement => {
    const wrap = document.createElement('label');
    wrap.className = 'field-row field-row--inline tl-field';
    const lab = document.createElement('span');
    lab.className = 'field-label';
    lab.textContent = labelText;
    wrap.append(lab, control);
    return wrap;
  };
  /**
   * The same row, as a plain `<div>` - for a control made of BUTTONS.
   *
   * A `<button>` is a labelable element, so inside a `<label>` the first one becomes
   * the labelled control and a click anywhere on the label text (or the padding beside
   * it) fires it. On the Appears row that meant reading the word "Appears" pressed
   * "With the slide", and `setAppear`'s exclusive patch cleared the box's start,
   * length, lane and build in one mis-click with nothing pressed on screen to explain
   * it. The design inspector builds the same control in a plain div for this reason;
   * the control carries its own `role="group"` + `aria-label`, so nothing is lost.
   */
  const rowPlain = (labelText: string, control: HTMLElement): HTMLElement => {
    const wrap = document.createElement('div');
    wrap.className = 'field-row field-row--inline tl-field';
    const lab = document.createElement('span');
    lab.className = 'field-label';
    lab.textContent = labelText;
    wrap.append(lab, control);
    return wrap;
  };
  /**
   * A numeric field. `value === null` means UNAUTHORED - the field renders empty with
   * a placeholder rather than a misleading 0 (an untimed box does not start at zero,
   * it has no start at all), and an empty field that is left empty commits nothing.
   */
  const numField = (
    value: number | null,
    step: number,
    min: number,
    onCommit: (v: number) => void,
    placeholder?: string
  ): HTMLInputElement => {
    const el = document.createElement('input');
    el.className = 'field-input tl-num';
    el.type = 'number';
    el.step = String(step);
    el.min = String(min);
    el.max = String(MAX_TIME_S);
    if (value === null) {
      el.value = '';
      if (placeholder) el.placeholder = placeholder;
    } else {
      el.value = String(Math.round(value * 1000) / 1000);
    }
    el.addEventListener('change', () => {
      const raw = el.value.trim();
      if (value === null && raw === '') return; // nothing typed, nothing to promote
      onCommit(finite(raw, value ?? 0));
    });
    return el;
  };
  const kindSelect = (value: unknown, onCommit: (v: string) => void): HTMLSelectElement => {
    const el = document.createElement('select');
    el.className = 'field-select tl-select';
    for (const k of TRANSITION_KINDS) {
      const o = document.createElement('option');
      o.value = k;
      o.textContent = t(TRANSITIONS[k]);
      el.appendChild(o);
    }
    el.value = isTransitionKind(value) ? value : 'none';
    el.addEventListener('change', () => onCommit(el.value));
    return el;
  };
  /**
   * The easing picker for one direction. Governs GEOMETRY ONLY - opacity keeps its
   * own fixed ramp (see the easing section of lib/transitions.ts), which is why there
   * is no fade curve offered anywhere here and must not be.
   *
   * UNAUTHORED IS A REAL STATE and it is the default one: the empty option means "the
   * curve this kind was born with", it is what an untouched box selects, and choosing
   * it changes nothing - a `<select>` fires no `change` for the value it already
   * shows, so simply rendering this row can never write a field. That property is the
   * whole reason the built-in is an option rather than an implied absence of one.
   *
   * `__custom` is a ROUTE, not a value: picking it snaps the box back to whatever was
   * authored and opens the curve editor, so the control never displays a state the
   * model is not in.
   */
  const easeSelect = (field: string, value: unknown): HTMLSelectElement => {
    const el = document.createElement('select');
    el.className = 'field-select tl-select tl-ease';
    el.dataset.field = field;
    const cur = easingToWire(value);
    const opt = (v: string, label: string): void => {
      const o = document.createElement('option');
      o.value = v;
      o.textContent = label;
      el.appendChild(o);
    };
    opt('', t('Built-in'));
    for (const [k, label] of Object.entries(EASINGS)) opt(k, t(label));
    // An authored bezier has no preset to select, so it brings its own option - and
    // shows the actual numbers, because "Custom" alone tells the user nothing about
    // the curve they are looking at.
    if (cur && !Object.hasOwn(EASINGS, cur)) opt(cur, cur);
    opt('__custom', t('Custom…'));
    el.value = cur;
    el.addEventListener('change', () => {
      const v = el.value;
      if (v === '__custom') {
        el.value = cur; // the route was taken; the value did not change
        tp.menus.openEaseEditor(id, field, el);
        return;
      }
      tp.helpers.write(tp.helpers.patchBox(getBoxes(), id, { [field]: v }));
    });
    return el;
  };

  const timed = isTimed(box, cfg);

  // ── the groups ────────────────────────────────────────────────────────────
  //
  // A `camera` box swaps Time + Animate for the CAMERA group (plans/104 section 8, the P1
  // seam this function was left holding): pose channels - pan / dolly / focus /
  // aperture / FOV strength - each with the DRAG / SCROLL affordance chip the
  // reference tool puts on the same row. Keyframes and the timed ⇄ always-on switch
  // stay exactly as they are: a camera is timed like any other box, and its whole
  // purpose is animation.
  //
  // Why the two it replaces go: a camera's ENTER/EXIT transition is ignored by both
  // evaluators in v1 (section 5.4), so an Animate group on one is a control that writes a
  // field nothing reads; and its Time is the switch below plus the clip's own bar,
  // not a start/length pair - a camera has no media to trim and no speed to set.
  const isCamera = tp.camera.isCameraBox(box);

  // ── Camera ────────────────────────────────────────────────────────────────
  if (isCamera) buildCameraGroup(tp, id, box);

  // ── Time ──────────────────────────────────────────────────────────────────
  // Shut, like every group since section 8's M2.5 revision - including on an UNTIMED box,
  // where Start and Length are still the typed promotion route (the `.tl-timing`
  // switch below is the one-press one). Auto-opening a popover over the canvas
  // because a box was selected is a popover the user has to dismiss.
  const timeG = isCamera ? null : inspectorGroup(tp, 'time', t('Time'), 'clock');
  if (timeG) inspector.appendChild(timeG.root);

  if (timeG && !timed) {
    // ── UNTIMED (scenery) ───────────────────────────────────────────────────
    // Start and Length are the promotion route: this is the ONLY place in the UI a
    // text/image/lottie/tool box could ever be given a time without hand-editing the
    // ?boxes= URL. Both render EMPTY - a 0 would claim the box starts at the top of
    // the sequence, which is a different (and authored) state.
    const hint = t('Type a time to place this on the timeline');
    const untimedStart = numField(null, 0.1, 0, (v) => tp.rows.promote(id, { start: v }), '-');
    untimedStart.title = hint;
    timeG.body.appendChild(row(t('Start'), untimedStart));
    const untimedLen = numField(null, 0.1, MIN_DUR, (v) => tp.rows.promote(id, { dur: v }), '-');
    untimedLen.title = hint;
    timeG.body.appendChild(row(t('Length'), untimedLen));
    timeG.setSummary([t('Always on')]);
  } else if (timeG) {
    // ── TIMED ───────────────────────────────────────────────────────────────
    // Numeric start / duration / trim-in.
    //
    // A seq clip's start is DERIVED by the pack (reorder it to move it), so the field is
    // disabled rather than writable-but-ignored: the old shape committed the unchanged
    // array, which dirtied the session and pushed an empty step onto the undo stack.
    const startField = numField(timing.start ?? 0, 0.1, 0, (v) => {
      tp.helpers.write(moveOverlay(getBoxes(), cfg, id, v));
    });
    if (timing.lane === 'seq') {
      startField.disabled = true;
      startField.title = t(
        'Set by the clip order. Drag the clip along the sequence row to move it.'
      );
    }
    timeG.body.appendChild(row(t('Start'), startField));
    // Length is ABSOLUTE (`setDuration`), seeded from the span the bar actually shows.
    // The old shape seeded from `timing.dur ?? 0` and committed a DELTA against it,
    // so on an open-ended clip - which displays as `total - start` and read 0 - typing
    // 5 arrived on trimClip's own 3 s fallback + 5 = 8 s.
    const shown = tp.rows.span(box, tp.rows.durationSec());
    timeG.body.appendChild(
      row(
        t('Length'),
        numField(shown.dur, 0.1, MIN_DUR, (v) => {
          tp.helpers.write(setDuration(getBoxes(), cfg, id, v, tp.helpers.mediaOf(id).dur, tp.helpers.mediaDur));
        })
      )
    );
    // Trim in and Speed go through the clamped setters, NOT patchBox: a raw write puts
    // clipIn + dur x speed past the end of the source, which the player cannot recover
    // from (it seeks past duration and the bar plays nothing).
    timeG.body.appendChild(
      row(
        t('Trim in'),
        numField(timing.clipIn, 0.1, 0, (v) => {
          tp.helpers.write(setClipIn(getBoxes(), cfg, id, v, tp.helpers.mediaOf(id).dur, tp.helpers.mediaDur));
        })
      )
    );

    // Speed.
    const speed = document.createElement('select');
    speed.className = 'field-select tl-select';
    for (const v of [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4]) {
      const o = document.createElement('option');
      o.value = String(v);
      o.textContent = `×${v}`;
      speed.appendChild(o);
    }
    speed.value = String(timing.speed);
    speed.addEventListener('change', () =>
      tp.helpers.write(setSpeed(getBoxes(), cfg, id, finite(speed.value, 1), tp.helpers.mediaOf(id).dur, tp.helpers.mediaDur))
    );
    timeG.body.appendChild(row(t('Speed'), speed));
    // The collapsed reading: where it starts, how long it runs, how fast - the three
    // numbers a clip is identified by. Formatted by timeline-math's own formatters
    // (`fmtTime` / `fmtDur`), the same ones the transport pill and the trim badge use,
    // so a summary can never disagree with the readout beside it. Trim-in stays behind
    // the disclosure: it is a property of the SOURCE, not of the clip's place in time.
    timeG.setSummary([fmtTime(timing.start ?? 0), fmtDur(shown.dur), `×${timing.speed}`]);
  }

  // ── Motion ────────────────────────────────────────────────────────────────
  // When the box appears, then enter / exit + their durations. Authorable either side
  // of the timed line: a box that is always on can still be given the transition it
  // will use once it is timed, and the fields are plain value writes, so nothing here
  // depends on a bar existing.
  //
  // Never on a CAMERA: v1 ignores a camera box's enter/exit outright (section 5.4), so these
  // would be four controls writing fields no evaluator reads.
  const mediaKind = id ? tp.helpers.mediaOf(id).kind : '';
  const audioFades = mediaKind === 'audio';
  // MOTION, not "Animate" (plans/179 M4's vocabulary pass): the group now answers
  // "when does this arrive and how does it move", and "Animate" was already the word
  // on the Keyframes group's own door. The group ID stays `animate` - it is the
  // `openTimeline(group)` port's wire value, not a word anybody reads.
  const animG = isCamera
    ? null
    : inspectorGroup(tp, 'animate', audioFades ? t('Fades') : t('Motion'), 'animate');
  if (animG) inspector.appendChild(animG.root);
  if (animG && audioFades) {
    // A sound has no picture for `rise` or `pop` to move: its in/out ARE fades
    // (plans/165 WP-2 - the mix reads any authored kind on an audio box as a fade,
    // and this writer only ever authors 'fade'). Duration-only rows; 0 clears the
    // kind so an unfaded box stays byte-identical to one written before this change.
    const fadeRow = (label: string, kindField: string, msField: string): void => {
      const cur = isTransitionKind(String(box[kindField] ?? '')) ? finite(box[msField], 400) : 0;
      animG.body.appendChild(
        row(
          label,
          numField(cur, 50, 100, (v) => {
            const ms = Math.round(clamp(v, 0, MAX_TRANSITION_MS));
            tp.helpers.write(
              tp.helpers.patchBox(
                getBoxes(),
                id,
                ms > 0
                  ? { [kindField]: 'fade', [msField]: Math.max(MIN_TRANSITION_MS, ms) }
                  : { [kindField]: '', [msField]: '' }
              )
            );
          })
        )
      );
    };
    fadeRow(t('Fade in'), cfg.enterField, cfg.enterMsField);
    fadeRow(t('Fade out'), cfg.exitField, cfg.exitMsField);
    const fi = isTransitionKind(String(box[cfg.enterField] ?? ''))
      ? finite(box[cfg.enterMsField], 400)
      : 0;
    const fo = isTransitionKind(String(box[cfg.exitField] ?? ''))
      ? finite(box[cfg.exitMsField], 400)
      : 0;
    animG.setSummary([
      fi > 0 || fo > 0 ? `${fmtDur(fi / 1000)} / ${fmtDur(fo / 1000)}` : t('No fades'),
    ]);
  }
  if (animG && !audioFades) {
    // ── Appears (plans/179 M4): ONE control for WHEN this box arrives ──────────
    //
    // There were three ways to appear and no control that knew about all three: a
    // build step, a start on the timeline, or neither. A box could carry two of them
    // at once, and each player resolved that differently. `setAppear` returns an
    // EXCLUSIVE patch - all four fields on every press - so two answers is a state the
    // UI can no longer produce, and `appearModeOf` is the one reading of what a box
    // already says.
    //
    // Offered only where the manifest names its time fields the way the shared model
    // writes them: the patch carries Design's own field ids, and Design is also the
    // only tool that declares a build step at all. Never on a FRAME - a slide does not
    // arrive on its own slide, and a build step on one would be a number no player
    // reads - which is the same exclusion the hold and split rows below make.
    const appearable =
      cfg.startField === 'start' &&
      cfg.durField === 'dur' &&
      cfg.laneField === 'lane' &&
      String(box.kind ?? '') !== 'frame';
    const appearMode = appearModeOf(box);
    const writeAppear = (intent: AppearIntent): void => {
      tp.helpers.write(tp.helpers.patchBox(getBoxes(), id, { ...setAppear(box, intent) }));
    };
    if (appearable) {
      // The app's segmented-control primitive (lib/seg.ts), built as NODES because
      // this panel writes no markup strings: the same classes and the same
      // `aria-pressed` state, so it reads like every other three-way choice.
      const seg = document.createElement('div');
      seg.className = 'view-seg tl-appear-seg';
      seg.setAttribute('role', 'group');
      seg.setAttribute('aria-label', t('Appears'));
      const segBtn = (m: AppearMode, label: string): void => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'view-seg-btn';
        b.dataset.val = m;
        b.textContent = label;
        b.setAttribute('aria-pressed', String(m === appearMode));
        // The mode alone. `setAppear` keeps whatever step / start / length the box
        // already has, so switching away and back does not throw the number away.
        b.addEventListener('click', () => {
          if (m !== appearMode) writeAppear({ mode: m });
        });
        seg.appendChild(b);
      };
      segBtn('slide', t('With the slide'));
      segBtn('click', t('On click'));
      segBtn('time', t('At time'));
      animG.body.appendChild(rowPlain(t('Appears'), seg));
      if (appearMode === 'click') {
        animG.body.appendChild(
          row(
            t('step'),
            numField(Math.max(1, Math.round(finite(box.build, 1))), 1, 1, (v) =>
              writeAppear({ mode: 'click', step: v })
            )
          )
        );
      } else if (appearMode === 'time') {
        animG.body.appendChild(
          row(
            t('At time'),
            numField(timing.start ?? 0, 0.1, 0, (v) => writeAppear({ mode: 'time', startS: v }))
          )
        );
        // EMPTY is open-ended, and it is a real state: a box with no length stays up
        // for the rest of the slide. A 0 would say it arrives and leaves in the same
        // instant, which is a different (and authored) thing.
        const durS = finite(box[cfg.durField], Number.NaN);
        animG.body.appendChild(
          row(
            t('for'),
            numField(
              Number.isFinite(durS) && durS > 0 ? durS : null,
              0.1,
              MIN_DUR,
              (v) => writeAppear({ mode: 'time', durS: v }),
              '-'
            )
          )
        );
      }
    }
    // A timeline edit to a FRAME's enter/exit is the author overriding the deck (M4
    // section 1c), so the same patch stamps the frame's own transition field 'custom'
    // and the deck-level transition stops deriving a pair over the one just set by
    // hand. Manifest-gated like every optional write here: no field, no stamp.
    const frameTrans: Record<string, string> =
      String(box.kind ?? '') === 'frame' && cfg.frameTransitionField
        ? { [cfg.frameTransitionField]: 'custom' }
        : {};
    const enterSel = kindSelect(box[cfg.enterField], (v) =>
      tp.helpers.write(tp.helpers.patchBox(getBoxes(), id, { [cfg.enterField]: v, ...frameTrans }))
    );
    // Named DIRECTLY, not by its label. The preview button below sits inside this row's
    // `<label>`, and a labelled control takes its accessible name from the whole label
    // subtree - so the select was announced as "Enter Preview this motion, combo box".
    // An `aria-label` on the control wins over the label text for the name and leaves
    // the label's click behaviour (focus the select) exactly as it was.
    enterSel.setAttribute('aria-label', t('Enter'));
    const enterRow = row(t('Enter'), enterSel);
    // The one-shot preview, beside the kind it plays: the entrance is the one field in
    // this group whose value is a MOVEMENT, and a name in a list is a poor description
    // of one. A button inside the row's <label> is safe - label activation does not run
    // for a press on an interactive descendant.
    //
    // OFFERED ONLY WHERE IT IS REAL, the same rule as Join and Detach in the context
    // menu: a box with no entrance stamped on it has nothing for the applier to play,
    // and a button that visibly does nothing teaches the user that the feature is
    // broken. Absent, never disabled - and the question is asked through the same
    // predicate the player itself uses.
    if (canPlayOnce(tp.helpers.boxEl(id))) {
      const play = document.createElement('button');
      play.type = 'button';
      play.className = 'tl-btn tl-preview';
      play.innerHTML = icon('play');
      play.title = t('Preview this motion');
      play.setAttribute('aria-label', t('Preview this motion'));
      // Held down for the length of the ramp. `playOnce` refuses a second session on
      // its own (one preview at a time, across every surface), so this is the visible
      // half of that rule: a button that answered nothing would read as broken.
      play.addEventListener('click', () => {
        if (play.disabled) return;
        play.disabled = true;
        void playOnce(tp.helpers.boxEl(id), finite(box[cfg.enterMsField], 400)).finally(() => {
          play.disabled = false;
        });
      });
      enterRow.appendChild(play);
    }
    animG.body.appendChild(enterRow);
    animG.body.appendChild(
      row(
        t('Enter (ms)'),
        numField(finite(box[cfg.enterMsField], 400), 50, 100, (v) =>
          tp.helpers.write(
            tp.helpers.patchBox(getBoxes(), id, {
              [cfg.enterMsField]: Math.round(clamp(v, MIN_TRANSITION_MS, MAX_TRANSITION_MS)),
            })
          )
        )
      )
    );
    // The curve sits beside its duration, not beside its kind: "how long" and "how it
    // moves over that time" are the pair a user tunes together. Offered only where the
    // manifest declares a field for it - a tool that never asked for authored easing is
    // not given a control that would write a sub-field it does not read.
    if (cfg.enterEaseField)
      animG.body.appendChild(
        row(t('Enter curve'), easeSelect(cfg.enterEaseField, box[cfg.enterEaseField]))
      );
    animG.body.appendChild(
      row(
        t('Exit'),
        kindSelect(box[cfg.exitField], (v) =>
          tp.helpers.write(tp.helpers.patchBox(getBoxes(), id, { [cfg.exitField]: v, ...frameTrans }))
        )
      )
    );
    animG.body.appendChild(
      row(
        t('Exit (ms)'),
        numField(finite(box[cfg.exitMsField], 400), 50, 100, (v) =>
          tp.helpers.write(
            tp.helpers.patchBox(getBoxes(), id, {
              [cfg.exitMsField]: Math.round(clamp(v, MIN_TRANSITION_MS, MAX_TRANSITION_MS)),
            })
          )
        )
      )
    );
    if (cfg.exitEaseField)
      animG.body.appendChild(
        row(t('Exit curve'), easeSelect(cfg.exitEaseField, box[cfg.exitEaseField]))
      );
    // ── Split text (plans/175 WP-A): tier × stagger × order over the presets above ──
    // Manifest-gated like the ease rows, and only on a box that actually holds text.
    // '' (whole text) is the absence: an untouched box writes nothing, and the
    // stagger/order rows only appear once a tier is chosen (disclosure, not clutter).
    if (
      cfg.splitField &&
      cfg.staggerField &&
      cfg.textField &&
      String(box[cfg.textField] ?? '').trim() !== '' &&
      String(box.kind ?? '') !== 'frame'
    ) {
      const enumSelect = (
        entries: readonly (readonly [string, string])[],
        cur: string,
        onCommit: (v: string) => void
      ): HTMLSelectElement => {
        const el = document.createElement('select');
        el.className = 'field-select tl-select';
        for (const [v, label] of entries) {
          const o = document.createElement('option');
          o.value = v;
          o.textContent = label;
          el.appendChild(o);
        }
        el.value = cur;
        el.addEventListener('change', () => onCommit(el.value));
        return el;
      };
      const tierRaw = String(box[cfg.splitField] ?? '');
      const tier = isSplitTier(tierRaw) ? tierRaw : '';
      animG.body.appendChild(
        row(
          t('Text'),
          enumSelect(
            [
              ['', t('Whole text')],
              ...Object.entries(SPLIT_TIERS).map(([v, label]) => [v, t(label)] as const),
            ],
            tier,
            (v) => tp.helpers.write(tp.helpers.patchBox(getBoxes(), id, { [cfg.splitField as string]: v }))
          )
        )
      );
      if (tier) {
        animG.body.appendChild(
          row(
            t('Offset starts by (ms)'),
            numField(finite(box[cfg.staggerField], 60), 10, 0, (v) =>
              tp.helpers.write(
                tp.helpers.patchBox(getBoxes(), id, {
                  [cfg.staggerField as string]: Math.round(clamp(v, 0, MAX_SPLIT_STAGGER_MS)),
                })
              )
            )
          )
        );
        if (cfg.splitOrderField) {
          const ordRaw = String(box[cfg.splitOrderField] ?? '');
          animG.body.appendChild(
            row(
              t('Text order'),
              enumSelect(
                Object.entries(SPLIT_ORDERS).map(([v, label]) => [v, t(label)] as const),
                isSplitOrder(ordRaw) ? ordRaw : '',
                (v) => tp.helpers.write(tp.helpers.patchBox(getBoxes(), id, { [cfg.splitOrderField as string]: v }))
              )
            )
          );
        }
      }
    }
    // ── Hold effect (plans/175 WP-B): the Loop/Emphasis bucket beside In/Out ──
    // Manifest-gated like every optional row; any box kind can pulse - a CTA
    // sticker is the same feature as a heading. Frames are excluded, exactly as
    // the hook excludes them from the attribute.
    if (cfg.holdField && cfg.holdRateField && String(box.kind ?? '') !== 'frame') {
      const enumSelect = (
        entries: readonly (readonly [string, string])[],
        cur: string,
        onCommit: (v: string) => void
      ): HTMLSelectElement => {
        const el = document.createElement('select');
        el.className = 'field-select tl-select';
        for (const [v, label] of entries) {
          const o = document.createElement('option');
          o.value = v;
          o.textContent = label;
          el.appendChild(o);
        }
        el.value = cur;
        el.addEventListener('change', () => onCommit(el.value));
        return el;
      };
      const holdRaw = String(box[cfg.holdField] ?? '');
      const holdCur = isHoldFx(holdRaw) ? holdRaw : '';
      animG.body.appendChild(
        row(
          t('While on screen'),
          enumSelect(
            [
              ['', t('Still')],
              ...Object.entries(HOLD_FX).map(([v, label]) => [v, t(label)] as const),
            ],
            holdCur,
            (v) => tp.helpers.write(tp.helpers.patchBox(getBoxes(), id, { [cfg.holdField as string]: v }))
          )
        )
      );
      if (holdCur) {
        animG.body.appendChild(
          row(
            t('Hold speed (cycles/sec)'),
            numField(finite(box[cfg.holdRateField], 1), 0.1, MIN_HOLD_RATE, (v) =>
              tp.helpers.write(
                tp.helpers.patchBox(getBoxes(), id, {
                  [cfg.holdRateField as string]:
                    Math.round(clamp(v, MIN_HOLD_RATE, MAX_HOLD_RATE) * 100) / 100,
                })
              )
            )
          )
        );
      }
    }
    animG.setSummary(animateSummary(box[cfg.enterField], box[cfg.exitField]));
    // A rebuild mints a new <select>, so an editor that is still open is anchored to a
    // detached node - its focus restore on Escape would land nowhere. Re-point the
    // delegate at the control that replaced it.
    if (easeMenu.isOpen() && tp.easeId === id && tp.easeField) {
      const live = Array.from(inspector.querySelectorAll<HTMLSelectElement>('.tl-ease')).find(
        (s) => s.dataset.field === tp.easeField
      );
      if (live) easePoint.delegate = live;
    }
  }

  // ── Keyframes ─────────────────────────────────────────────────────────────
  //
  // THE DISCLOSURE LAW (plans/51:80, restated by plans/104 section 8): nobody keyframes by
  // accident. A camera exists only to be animated, so it always carries the group; a
  // content box earns it by already having a track. Every other box has no keyframe
  // affordance anywhere in the UI - not a disabled one, not an empty one. Animate is
  // DERIVED, never stored: the gate reads the track itself, so there is no second
  // source of truth to drift (section 8, "Animate is DERIVED, not stored").
  //
  // The body itself is built below. The DOOR is the form of it: a box with no
  // track and no camera kind gets ONE action ("Animate") behind a collapsed
  // disclosure, and nothing else - no diamonds on its bar, no latch, no list. A
  // camera is born disclosed, because a camera exists only to be animated.
  //
  // `isKeyframable` is the SAME gate "+Keyframe" uses, and it has to be: without it
  // a detached sound got the group and its Animate door, which wrote precisely the
  // x/y/s/r/o track the button refuses to write and no evaluator reads - a door onto
  // a room the rest of the UI says does not exist (section 8's disclosure law is explicit:
  // "Every other box has no keyframe affordance anywhere in the UI").
  const kfRaw = cfg.kfField ? String(box[cfg.kfField] ?? '') : '';
  if (cfg.kfField && tp.keyframes.isKeyframable(box, id)) {
    // parseKf is the engine's own reader (plans/104 section 5.1) - never a `split('*')` here.
    // It never throws, so a hand-edited share URL summarises as "No keyframes" rather
    // than taking the inspector down with it.
    const track = kfRaw ? parseKf(kfRaw) : null;
    const n = track ? track.length : 0;
    const kfG = inspectorGroup(tp, 'keyframes', t('Keyframes'), 'keyframe');
    inspector.appendChild(kfG.root);
    kfG.setSummary([
      n === 0
        ? t('Not animated')
        : n === 1
          ? t('1 keyframe')
          : t('{n} keyframes', { n: String(n) }),
    ]);

    if (n === 0 && !isCamera) {
      // ── Depth, then the door ─────────────────────────────────────────────
      // Depth stands FIRST because it is what a lifted layer needs before it needs a
      // keyframe: set the parallax, THEN (optionally) animate it. It writes the box's
      // own `z` field, not a track (see `buildDepthControl`), so it is not a keyframe
      // affordance and does not violate section 8's disclosure law.
      tp.kfDock.buildDepthControl(kfG, id, box);
      // One action, one commit, one undo step. Enabling is DERIVED, not stored
      // (section 8): what it writes is a t = 0 pose, and the track's existence IS the
      // animated state from then on - there is no flag anywhere to drift.
      const door = tp.helpers.actionBtn('tl-kf-animate', t('Animate'), 'keyframe');
      door.title = t(
        'Adds a first pose at the start of this clip. Everything else stays where it is.'
      );
      door.addEventListener('click', () => tp.keyframes.animateBox(id));
      kfG.body.appendChild(door);
    } else {
      // The curve editor is DOCKED in this body now (section 8's M2.7), so there is no
      // second popover anchored to a `<select>` this rebuild just detached - the
      // re-point the transition editor still needs above has nothing to re-point.
      // `syncKfLatch` rebuilds the dock against the row that replaced this one.
      tp.kfDock.buildKeyframes(kfG, id, box, track ?? parseKf(''), isCamera);
    }
  }

  // ── Sound: a TOGGLE, never a group ────────────────────────────────────────
  //
  // section 8's M2.6 pass: "SOUND stops being a popover group entirely… it becomes a
  // speaker/mute icon toggle on the strip (direct click flips mute - the NLE
  // convention), no popup." Mute is ONE bit, and a disclosure onto one switch is a
  // door onto a door: the M2.5 group cost a press, a popover mount and a "Sound on"
  // chip to say what a speaker glyph with `aria-pressed` says standing still.
  //
  // The A/V link went back to the CLIP CONTEXT MENU, its pre-M2 home (`ctxMenu`
  // above, which never stopped offering Re-attach / Detach) - plus the `Shift + D`
  // chord. Detaching a clip's audio is a structural edit that grows a second bar on
  // another lane; it is not a sibling of a mute switch, and it is not something the
  // inspector needs a permanent seat for.
  //
  // Mute is a playback concern, so it exists only on something that plays.
  //
  // VOLUME sits beside it on the same terms (plans/165 WP-1): a percent slider
  // writing the manifest's gain sub-field, shown only where the tool declares one
  // and the box actually carries sound. 100% = as recorded; up to 200% boosts the
  // RENDERED file - the preview element caps at 100%, which the title states so
  // the difference is a documented behaviour, not a surprise.
  //
  // THE COMPACT AUDIO STRIP (Andy, 2026-09-02, off a screenshot of the row
  // overflowing the panel): every audio control drops its all-caps text label
  // for an icon carrying the SAME string as title + aria-label, and the level
  // faders go vertical - a fader is read by position, not by track length, so
  // the vertical form costs nothing and returns ~100px per slider.
  const alab = (glyph: Parameters<typeof icon>[0], label: string): HTMLElement => {
    const s = document.createElement('span');
    s.className = 'tl-alab';
    s.innerHTML = icon(glyph);
    s.title = label;
    s.setAttribute('role', 'img');
    s.setAttribute('aria-label', label);
    return s;
  };
  // A FADER BUTTON (Andy's second-round call, off a zoomed screenshot): the
  // inline vertical mini-fader had a thumb bigger than its own travel - no
  // articulation at all. The icon is now a button; pressing it pops a TALL
  // fader over the sequence frame below, where there is room to be precise,
  // and the inline number stays for typed entry. One popover per button,
  // the EQ door's exact pattern.
  const faderBtn = (
    glyph: Parameters<typeof icon>[0],
    label: string,
    opts2: {
      min: number;
      max: number;
      step: number;
      horizontal?: boolean;
      read: () => number;
      commit: (v: number) => void;
      format?: (v: number) => string;
    }
  ): HTMLButtonElement => {
    const b = tp.helpers.btn('tl-alab tl-fader-btn', label, icon(glyph));
    b.removeAttribute('data-tip');
    b.title = label;
    const pop = mountBodyPopover(
      b,
      (el) => {
        el.textContent = '';
        const col = document.createElement('div');
        col.className = 'tl-fader-pop';
        const s = document.createElement('input');
        s.type = 'range';
        s.min = String(opts2.min);
        s.max = String(opts2.max);
        s.step = String(opts2.step);
        s.className = `tl-kf-slider ${opts2.horizontal ? 'tl-hfader' : 'tl-vfader'}`;
        s.value = String(opts2.read());
        s.setAttribute('aria-label', label);
        const readout = document.createElement('span');
        readout.className = 'tl-eq-db';
        const paint = (): void => {
          readout.textContent = (opts2.format ?? String)(Number(s.value));
        };
        paint();
        s.addEventListener('input', paint);
        s.addEventListener('change', () => opts2.commit(Number(s.value)));
        col.append(s, readout);
        el.appendChild(col);
        return s;
      },
      {
        className: 'folder-menu tl-menu tl-fader-popover',
        role: 'dialog',
        ariaLabel: label,
        position: tp.menus.menuPosition,
      }
    );
    b.addEventListener('click', (e) => {
      e.preventDefault();
      if (pop.isOpen()) pop.close(true);
      else pop.open();
    });
    return b;
  };
  if (timed && cfg.gainField && (mediaKind === 'audio' || mediaKind === 'video')) {
    const gf = cfg.gainField;
    const cur = clamp(finite(box[gf], 1), 0, 2);
    const wrap = document.createElement('label');
    wrap.className = 'field-row field-row--inline tl-field tl-afield tl-volume-row';
    const num = document.createElement('input');
    num.className = 'field-input tl-num tl-anum tl-volume-num';
    num.type = 'number';
    num.min = '0';
    num.max = '200';
    num.step = '5';
    num.value = String(Math.round(cur * 100));
    num.title = t(
      'Percent of the recorded level. Above 100% boosts the exported file; the preview plays at 100%.'
    );
    // One model write per gesture, the depth row's own contract: `input` mirrors
    // the number live, `change` commits once. 100% clears the field so an
    // untouched box stays byte-identical to one written before this change.
    const commit = (raw: number): void => {
      const pct = Math.round(clamp(raw, 0, 200));
      num.value = String(pct);
      tp.helpers.write(tp.helpers.patchBox(getBoxes(), id, { [gf]: pct === 100 ? '' : pct / 100 }));
    };
    const lab = faderBtn('volumeOn', t('Volume'), {
      min: 0,
      max: 200,
      step: 5,
      read: () => Math.round(clamp(finite(num.value, 100), 0, 200)),
      commit,
      format: (v) => `${v}%`,
    });
    num.addEventListener('change', () => commit(finite(num.value, 100)));
    wrap.append(lab, num);
    // VOLUME KEYFRAMES (plans/165 WP-3): the diamond keys the row's current value
    // at the playhead, riding the SAME kf grammar as pose keys (`v` channel), so
    // split/trim/join rebase volume automation with zero extra code. Deliberately
    // NOT the pose popup: an audio box is excluded from pose keyframing by the
    // disclosure law, and volume is a property of the sound, so its authoring
    // affordance lives beside the volume it keys. Linear between keys, held past
    // the ends - the DAW convention.
    if (cfg.kfField) {
      const keyBtn = tp.helpers.btn('tl-volume-key', t('Key volume at the playhead'), icon('keyframe'));
      keyBtn.removeAttribute('data-tip');
      keyBtn.title = t('Key volume at the playhead');
      keyBtn.addEventListener('click', () => {
      const { clock } = tp;
        const rows = getBoxes();
        const bi = indexOfId(rows, cfg, id);
        if (bi < 0) return;
        const bx = rows[bi]!;
        const atMs = kfWriteMs(bx, cfg, clock.t() / 1000);
        const track = kfBoxTrack(bx, cfg);
        const val = clamp(finite(num.value, 100), 0, 200) / 100;
        const hit = track.findIndex((k) => k.t === atMs);
        const keys =
          hit >= 0
            ? track.map((k, j) =>
                j === hit ? { t: k.t, ease: k.ease, v: { ...k.v, v: val } } : k
              )
            : [...track, { t: atMs, ease: '', v: { v: val } }];
        // The key CAPTURES the row's level and the flat trim resets to neutral in
        // the SAME commit - otherwise the two multiply and the keyed level plays
        // double. From here the slider is a trim over the automation (the DAW
        // model); the rebuild snaps it back to 100%.
        tp.helpers.write(tp.helpers.patchBox(setKfTrack(rows, cfg, id, keys as never), id, { [gf]: '' }));
        announce(t('Volume keyframe set'));
      });
      wrap.appendChild(keyBtn);
      const vCount = kfBoxTrack(box, cfg).filter((k) => typeof k.v.v === 'number').length;
      if (vCount > 0) {
        const meta = document.createElement('span');
        meta.className = 'tl-volume-keys field-label';
        meta.textContent =
          vCount === 1 ? t('1 volume key') : t('{n} volume keys', { n: String(vCount) });
        const clearBtn = tp.helpers.btn('tl-volume-clear', t('Clear volume keys'), icon('scissors'));
        clearBtn.removeAttribute('data-tip');
        clearBtn.title = t('Clear volume keys');
        clearBtn.addEventListener('click', () => {
          const rows = getBoxes();
          const bi = indexOfId(rows, cfg, id);
          if (bi < 0) return;
          const track = kfBoxTrack(rows[bi]!, cfg);
          const keys = track
            .map((k) => {
              const pose = { ...k.v } as Record<string, number>;
              delete pose.v;
              return { t: k.t, ease: k.ease, v: pose };
            })
            .filter((k) => Object.keys(k.v).length > 0);
          tp.helpers.write(setKfTrack(rows, cfg, id, keys as never));
          announce(t('Volume keyframes cleared'));
        });
        wrap.append(meta, clearBtn);
      }
    }
    // PER-CLIP NORMALIZE (plans/101 section 2.5): measure the trimmed window's
    // BS.1770 integrated loudness and set Volume so the clip hits a -16 LUFS
    // reference, clamped to the row's own 0..200% range. One decode, one
    // commit; a decode is a click away, never per frame.
    const normBtn = tp.helpers.btn('tl-volume-normalize', t('Normalize volume'), icon('zap'));
    normBtn.removeAttribute('data-tip');
    normBtn.title = t('Measure this clip and set Volume so it plays at -16 LUFS.');
    normBtn.addEventListener('click', () => {
      void (async () => {
        const media = tp.helpers.mediaOf(id);
        if (!media.url) {
          announce(t('Nothing to measure on this clip.'), { assertive: true });
          return;
        }
        normBtn.disabled = true;
        try {
          const bytes = await (await fetch(media.url)).arrayBuffer();
          // Decode AT the mix rate: an OfflineAudioContext resamples to its own
          // rate, and the meter's K-weighting coefficients are 48 kHz-only.
          const octx = new OfflineAudioContext(2, 1, 48_000);
          const buf = await octx.decodeAudioData(bytes);
          const rows0 = getBoxes();
          const bx = rows0[indexOfId(rows0, cfg, id)] ?? box;
          const clipInSec = finite(bx[cfg.clipInField], 0);
          const durSec = finite(bx[cfg.durField], Number.NaN);
          const speed = finite(bx[cfg.speedField], 1);
          const from = Math.max(0, Math.min(buf.length, Math.round(clipInSec * 48_000)));
          const srcSpan = Number.isFinite(durSec) ? durSec * speed : buf.duration - clipInSec;
          const n = Math.max(0, Math.min(buf.length - from, Math.round(srcSpan * 48_000)));
          const chs: Float32Array[] = [];
          for (let c = 0; c < 2; c++) {
            chs.push(
              buf.getChannelData(Math.min(c, buf.numberOfChannels - 1)).subarray(from, from + n)
            );
          }
          const lkfs = integratedLoudness(chs);
          if (lkfs == null) {
            announce(t('This clip is silent - nothing to normalize.'), { assertive: true });
            return;
          }
          const g = Math.max(0, Math.min(2, 10 ** ((-16 - lkfs) / 20)));
          tp.helpers.write(
            tp.helpers.patchBox(getBoxes(), id, {
              [gf]: Math.abs(g - 1) < 0.005 ? '' : Math.round(g * 100) / 100,
            })
          );
          announce(t('Volume normalized.'));
        } catch {
          announce(t('Could not measure this clip.'), { assertive: true });
        } finally {
          normBtn.disabled = false;
        }
      })();
    });
    wrap.appendChild(normBtn);
    inspector.appendChild(wrap);
  }
  // PAN (plans/165 WP-5): left/right balance, writing the manifest's pan sub-field.
  // Same one-commit discipline as the Volume row above; 0 clears the field so an
  // untouched box stays byte-identical. An audio box pans live through a real
  // StereoPannerNode; a video element cannot pan in preview, so its title says
  // where the pan applies.
  if (timed && cfg.panField && (mediaKind === 'audio' || mediaKind === 'video')) {
    const pf = cfg.panField;
    const cur = clamp(finite(box[pf], 0), -1, 1);
    const wrap = document.createElement('label');
    wrap.className = 'field-row field-row--inline tl-field tl-afield tl-pan-row';
    const num = document.createElement('input');
    num.className = 'field-input tl-num tl-anum tl-pan-num';
    num.type = 'number';
    num.min = '-100';
    num.max = '100';
    num.step = '5';
    num.value = String(Math.round(cur * 100));
    num.title =
      mediaKind === 'audio'
        ? t('Left/right balance: -100 is hard left, 100 is hard right.')
        : t(
            "Left/right balance: -100 is hard left, 100 is hard right. A video clip's sound pans in the exported file; the preview plays centred."
          );
    const commit = (raw: number): void => {
      const pct = Math.round(clamp(raw, -100, 100));
      num.value = String(pct);
      tp.helpers.write(tp.helpers.patchBox(getBoxes(), id, { [pf]: pct === 0 ? '' : pct / 100 }));
    };
    // Pan's pop-over fader is HORIZONTAL: balance reads left-to-right (a level
    // reads bottom-to-top), and the label format says which side is which.
    const lab = faderBtn('arrowsH', t('Pan'), {
      min: -100,
      max: 100,
      step: 5,
      horizontal: true,
      read: () => Math.round(clamp(finite(num.value, 0), -100, 100)),
      commit,
      format: (v) => (v === 0 ? 'C' : v < 0 ? `L${-v}` : `R${v}`),
    });
    num.addEventListener('change', () => commit(finite(num.value, 0)));
    wrap.append(lab, num);
    inspector.appendChild(wrap);
  }
  // DUCKING (plans/165 WP-6 v1): drop this track while any other clip's audio
  // plays - the export bed's own off/low behaviour, offered per audio box. A
  // select, not a slider: three honest levels beat a percent nobody can hear.
  // One write per change; the no-duck choice clears the field.
  if (timed && cfg.duckField && mediaKind === 'audio') {
    const df = cfg.duckField;
    const cur = finite(box[df], 1);
    const wrap = document.createElement('label');
    wrap.className = 'field-row field-row--inline tl-field tl-afield tl-duck-row';
    const lab = alab('speech', t('Under other audio'));
    const sel = document.createElement('select');
    sel.className = 'field-select field-select--sm tl-duck-select';
    sel.setAttribute('aria-label', t('Under other audio'));
    sel.title = t("Lower this track while any other clip's audio plays.");
    const opt = (v: string, label: string): void => {
      const o = document.createElement('option');
      o.value = v;
      o.textContent = label;
      sel.appendChild(o);
    };
    opt('', t('No change'));
    opt('0.2', t('Quieter'));
    opt('0', t('Silent'));
    sel.value = cur >= 1 ? '' : cur <= 0 ? '0' : '0.2';
    sel.addEventListener('change', () => {
      tp.helpers.write(tp.helpers.patchBox(getBoxes(), id, { [df]: sel.value === '' ? '' : Number(sel.value) }));
    });
    wrap.append(lab, sel);
    inspector.appendChild(wrap);
  }
  // EFFECT (plans/101 section 3.4): the preset rack. Each choice WRITES the
  // expanded chain (never the preset name), so a later preset re-tune can
  // never change what an already-shared link sounds like. A chain that no
  // preset produced reads back as Custom and is left alone until the user
  // picks something else - hand-authored grammar survives the round-trip.
  if (timed && cfg.fxField && (mediaKind === 'audio' || mediaKind === 'video')) {
    const ff = cfg.fxField;
    const cur = String(box[ff] ?? '');
    const wrap = document.createElement('label');
    wrap.className = 'field-row field-row--inline tl-field tl-afield tl-fx-row';
    const lab = alab('sparkle', t('Effect'));
    const sel = document.createElement('select');
    sel.className = 'field-select field-select--sm tl-fx-select';
    sel.setAttribute('aria-label', t('Effect'));
    sel.title =
      mediaKind === 'audio'
        ? t("How this clip's sound is treated in the mix.")
        : t(
            "How this clip's sound is treated in the mix. A video clip's effect applies in the exported file; the preview plays it untreated."
          );
    const PRESET_LABELS: [string, string][] = [
      ['voice-cleanup', t('Voice cleanup')],
      ['voice-clarity', t('Voice clarity')],
      ['warm', t('Warm')],
      ['bright', t('Bright')],
      ['telephone', t('Telephone')],
      ['muffled', t('Muffled')],
      ['radio', t('Radio')],
      ['lo-fi', t('Lo-fi')],
      ['echo', t('Echo')],
      ['room', t('Room')],
      ['hall', t('Hall')],
      ['plate', t('Plate')],
      ['de-hum', t('De-hum')],
      ['gate', t('Noise gate')],
    ];
    const opt = (v: string, label: string): void => {
      const o = document.createElement('option');
      o.value = v;
      o.textContent = label;
      sel.appendChild(o);
    };
    opt('', t('No effect'));
    for (const [key, label] of PRESET_LABELS) opt(key, label);
    const match = PRESET_LABELS.find(([key]) => FX_PRESETS[key] === cur)?.[0] ?? '';
    if (cur && !match) {
      opt('__custom', t('Custom'));
      sel.value = '__custom';
    } else {
      sel.value = match;
    }
    sel.addEventListener('change', () => {
      if (sel.value === '__custom') return; // reselecting the label is a no-op
      tp.helpers.write(tp.helpers.patchBox(getBoxes(), id, { [ff]: sel.value ? FX_PRESETS[sel.value] : '' }));
    });
    // The EQ door (the plans/101 "custom 3-band" rack): three vertical dB
    // faders in a popover, editing the chain's eq() entry directly - tone is
    // reachable without a preset, and composes WITH one (the preset writes the
    // chain, the faders then edit the eq entry inside it; the select honestly
    // reads Custom from then on).
    const eqBtn = tp.helpers.btn('tl-eq-btn', t('EQ'), icon('sliders'));
    eqBtn.removeAttribute('data-tip');
    eqBtn.title = t('EQ');
    const eqPop = mountBodyPopover(
      eqBtn,
      (el) => {
        el.textContent = '';
        const row = document.createElement('div');
        row.className = 'tl-eq-pop';
        const rows0 = getBoxes();
        const chain0 = parseFxChain(String(rows0[indexOfId(rows0, cfg, id)]?.[ff] ?? ''));
        const eq0 = chain0.entries.find((x) => x.name === 'eq');
        const db0 = eq0 ? eq0.params.map((p) => (p - 240) / 10) : [0, 0, 0];
        const sliders: HTMLInputElement[] = [];
        const commitEq = (): void => {
          const dbs = sliders.map((s) => Math.max(-12, Math.min(12, Number(s.value) || 0)));
          const rows = getBoxes();
          const chain = parseFxChain(String(rows[indexOfId(rows, cfg, id)]?.[ff] ?? ''));
          const at = chain.entries.findIndex((x) => x.name === 'eq');
          const entries = chain.entries.filter((x) => x.name !== 'eq');
          if (dbs.some((d) => d !== 0)) {
            const entry = { name: 'eq', params: dbs.map((d) => Math.round(d * 10) + 240) };
            entries.splice(at >= 0 ? Math.min(at, entries.length) : entries.length, 0, entry);
          }
          tp.helpers.write(tp.helpers.patchBox(rows, id, { [ff]: serializeFxChain(entries) }));
        };
        for (const [bi, label] of [t('Low'), t('Mid'), t('High')].entries()) {
          const band = document.createElement('div');
          band.className = 'tl-eq-band';
          const s = document.createElement('input');
          s.type = 'range';
          s.min = '-12';
          s.max = '12';
          s.step = '0.5';
          s.className = 'tl-kf-slider tl-vslider';
          s.value = String(db0[bi] ?? 0);
          s.setAttribute('aria-label', label);
          const db = document.createElement('span');
          db.className = 'tl-eq-db';
          const paint = (): void => {
            db.textContent = `${Number(s.value) > 0 ? '+' : ''}${Number(s.value)}`;
          };
          paint();
          s.addEventListener('input', paint);
          s.addEventListener('change', commitEq);
          const bandLab = document.createElement('span');
          bandLab.className = 'field-label';
          bandLab.textContent = label;
          band.append(s, db, bandLab);
          sliders.push(s);
          row.appendChild(band);
        }
        el.appendChild(row);
        return sliders[0] ?? null;
      },
      {
        className: 'folder-menu tl-menu tl-eq-popover',
        role: 'dialog',
        ariaLabel: t('EQ'),
        position: tp.menus.menuPosition,
      }
    );
    eqBtn.addEventListener('click', () => {
      if (eqPop.isOpen()) eqPop.close(true);
      else eqPop.open();
    });
    wrap.append(lab, sel, eqBtn);
    inspector.appendChild(wrap);
  }
  // PITCH (plans/165 WP-7b): transpose in semitones, formants preserved, at any
  // speed. Same one-commit discipline; 0 clears the field.
  if (timed && cfg.pitchField && (mediaKind === 'audio' || mediaKind === 'video')) {
    const ptf = cfg.pitchField;
    const cur = Math.round(clamp(finite(box[ptf], 0), -12, 12));
    const wrap = document.createElement('label');
    wrap.className = 'field-row field-row--inline tl-field tl-afield tl-pitch-row';
    const lab = alab('music', t('Pitch'));
    const num = document.createElement('input');
    num.className = 'field-input tl-num tl-anum tl-pitch-num';
    num.type = 'number';
    num.min = '-12';
    num.max = '12';
    num.step = '1';
    num.value = String(cur);
    num.setAttribute('aria-label', t('Pitch'));
    num.title =
      mediaKind === 'audio'
        ? t('Semitones up or down: 12 is an octave. 0 plays as recorded.')
        : t(
            "Semitones up or down: 12 is an octave. A video clip's sound transposes in the exported file; the preview plays as recorded."
          );
    num.addEventListener('change', () => {
      const st = Math.round(clamp(finite(num.value, 0), -12, 12));
      num.value = String(st);
      tp.helpers.write(tp.helpers.patchBox(getBoxes(), id, { [ptf]: st === 0 ? '' : st }));
    });
    wrap.append(lab, num);
    inspector.appendChild(wrap);
  }
  // PRESERVE PITCH (plans/165 WP-7b): only meaningful on a speed-changed clip.
  // Checked - the editor default - keeps the recorded pitch through the stretch;
  // unchecked plays tape-style (pitch follows speed). The default choice clears
  // the field so an untouched box stays byte-identical.
  if (
    timed &&
    cfg.varispeedField &&
    (mediaKind === 'audio' || mediaKind === 'video') &&
    finite(box[cfg.speedField], 1) !== 1
  ) {
    const vf = cfg.varispeedField;
    const vari = box[vf] === true || box[vf] === 'true';
    const wrap = document.createElement('label');
    wrap.className =
      'field-row field-row--inline tl-field tl-afield tl-varispeed-row field-toggle';
    const lab = alab('waves', t('Preserve pitch'));
    const check = document.createElement('input');
    check.className = 'field-check';
    check.type = 'checkbox';
    check.checked = !vari;
    check.setAttribute('aria-label', t('Preserve pitch'));
    check.title = t(
      'On keeps the recorded pitch when the clip plays faster or slower. Off plays it tape-style: pitch follows speed.'
    );
    check.addEventListener('change', () => {
      tp.helpers.write(tp.helpers.patchBox(getBoxes(), id, { [vf]: check.checked ? '' : 'true' }));
    });
    wrap.append(lab, check);
    inspector.appendChild(wrap);
  }
  if (timed) {
    const muted = box[cfg.muteField] === true || box[cfg.muteField] === 'true';
    const muteLabel = muted ? t('Unmute clip') : t('Mute clip');
    const mute = tp.helpers.btn('tl-mute', muteLabel, icon(muted ? 'volumeOff' : 'volumeOn'));
    // PRESSED means silent. The glyph flips with it (speaker ⇄ speaker-off) so the
    // state is readable without hovering, and the label names the ACTION the press
    // performs - both existing keys, neither invented for this pass.
    mute.setAttribute('aria-pressed', muted ? 'true' : 'false');
    // `title`, not the `[data-tip]` bubble `btn()` stamps: `.tl-inspector` is an
    // overflow scroller, so a bubble drawn above the control is clipped - the same
    // reason the `.tl-timing` switch at the end of the row carries a title.
    mute.removeAttribute('data-tip');
    mute.title = muteLabel;
    // ONE model write per press, like every other writer in this panel. `muted` is
    // read from the row this build painted, so the toggle can never invert twice off
    // one gesture; the rebuild that follows the commit re-reads it.
    mute.addEventListener('click', () =>
      tp.helpers.write(tp.helpers.patchBox(getBoxes(), id, { [cfg.muteField]: muted ? '' : 'true' }))
    );
    inspector.appendChild(mute);
  }

  // The timed ⇄ always-on switch. Both directions, always, from the keyboard as well
  // as the pointer: this is the affordance that makes "always on" a state rather than
  // a trap, and the promotion route for anyone who would rather press than type.
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'tl-timing';
  const toggleLabel = timed ? t('Make always on') : t('Add to the timeline');
  toggle.textContent = toggleLabel;
  // `title` for the same reason as the chip's `+`: .tl-inspector is an overflow
  // scroller, so a [data-tip] bubble drawn above the control would be clipped.
  toggle.title = timed
    ? t('Clear the timing so this box is on screen for the whole sequence')
    : t('Place this box on the timeline at the playhead');
  toggle.addEventListener('click', () => (timed ? tp.rows.demote(id) : tp.rows.promote(id)));
  inspector.appendChild(toggle);

  // LAST, once every segment exists: an open popover follows the row it belongs to
  // through the rebuild this commit caused, or shuts if that row is gone.
  tp.kfDock.resyncGroupPopover(id);
}
export function inspectorPaneOps(tp: TpCtx) {
  return {
    inspectorGroup: bindOp(tp, inspectorGroup),
    buildCameraGroup: bindOp(tp, buildCameraGroup),
    renderInspector: bindOp(tp, renderInspector),
  };
}
