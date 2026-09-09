// SPDX-License-Identifier: MPL-2.0
/**
 * timeline-panel: the track rows - rebuild, restyle, ruler, playhead, roving focus, promote and demote.
 *
 * Every function takes the shared `tp: TpCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `tp.<module>.<fn>`. Extracted verbatim
 * from initTimelinePanel() by scripts/split-closure.ts.
 */
import { t } from '../../i18n.ts';
import { icon } from '../../lib/icons.ts';
import { announce } from '../../a11y.ts';
import { isTransitionKind } from '../../lib/transitions.ts';
import { DEFAULT_CLIP_S, MIN_DUR, MIN_TRIM_BAR_PX, boxTiming, deriveDuration, fmtTime, indexOfId, isThroughEdit, isTimed, kfBoxTrack, kfLocalSec, kfTimelineSec, moveOverlay, packSeq, rippleOverlays, seqBoxes, setDuration } from '../timeline-math.ts';
import type { Box } from '../timeline-math.ts';
import { isCaptionGroup } from '../timeline-captions.ts';
import { editedToOriginal, originalToEdited, removedSpansTimeline } from '../transcript-edit.ts';
import { tickStep, timeToPx } from './shared.ts';
import { bindOp, type TpCtx } from './context.ts';

/**
 * Is this row SOUND? Both sources, for `isKeyframable`'s reason exactly: a box
 * carrying an audio asset is an audio clip whatever its `kind` says, and a model row
 * whose media has not painted yet is still one.
 */
export function isAudioRow(tp: TpCtx, row: Box | undefined, id: string): boolean {
  return String(row?.kind ?? '') === 'audio' || tp.helpers.mediaOf(id).kind === 'audio';
}
/**
 * Inline rename: swap the bar's label for a text input in place. Enter/blur commits
 * (an empty value CLEARS the name, so the derived label comes back), Escape cancels.
 * One write through the panel's own path; the label refresh rides the normal restyle.
 * Reached from a double-click on the bar and from its context menu.
 */
export function renameClip(tp: TpCtx, id: string): void {
  const { bars, cfg, getBoxes } = tp;
  if (!cfg.labelField) return;
  const el = bars.get(id);
  const label = el?.querySelector<HTMLElement>('.tl-clip-label');
  if (!el || !label || el.querySelector('.tl-clip-rename')) return;
  const rows = getBoxes();
  const i = indexOfId(rows, cfg, id);
  if (i < 0) return;
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'tl-clip-rename';
  input.value = String(rows[i]![cfg.labelField] ?? '').trim();
  input.placeholder = tp.helpers.labelFor(id);
  input.setAttribute('aria-label', t('Rename'));
  input.maxLength = 120;
  let settled = false;
  const finish = (commitIt: boolean): void => {
    if (settled) return;
    settled = true;
    const v = input.value.trim();
    input.remove();
    label.hidden = false;
    if (commitIt && v !== String(getBoxes()[i]?.[cfg.labelField!] ?? '').trim()) {
      tp.helpers.write(tp.helpers.patchBox(getBoxes(), id, { [cfg.labelField!]: v }));
    }
    // Back onto the bar: its accessible name is its label span, so AT reads the
    // new name on the refocus - no separate announcement needed.
    el.focus?.();
  };
  // Typing must not reach the panel's roving-focus/shortcut keys, and a pointerdown
  // in the input must not start a bar drag.
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') finish(true);
    else if (e.key === 'Escape') finish(false);
  });
  input.addEventListener('pointerdown', (e) => e.stopPropagation());
  input.addEventListener('blur', () => finish(true));
  label.hidden = true;
  el.appendChild(input);
  input.focus();
  input.select();
}
export const durationSec = (tp: TpCtx): number => { const { cfg, getBoxes } = tp; return deriveDuration(getBoxes(), cfg) / 1000; };
// ── geometry ────────────────────────────────────────────────────────────────

/** where a box's bar is placed, in seconds. Open-ended clips run to the sequence end. */
export function span(tp: TpCtx, b: Box, total: number): { start: number; dur: number } {
  const { cfg } = tp;
  const timing = boxTiming(b, cfg);
  const start = timing.start ?? 0;
  const dur = timing.dur ?? Math.max(MIN_DUR, total - start);
  return { start, dur };
}
/** Every TIMED box whose span contains `at` (seconds). Scenery is always on and is
 *  never listed - it has no span to leave. */
export function activeIdsAt(tp: TpCtx, boxes: Box[], at: number): string[] {
  const { cfg } = tp;
  const total = durationSec(tp);
  const out: string[] = [];
  for (const b of boxes) {
    if (!b || !isTimed(b, cfg)) continue;
    const { start, dur } = span(tp, b, total);
    if (at >= start && at < start + dur) out.push(String(b[cfg.idField] ?? ''));
  }
  return out;
}
// ── the one selection writer (free-canvas.ts's header states the rule) ────────
//
// "Selecting in the timeline moves the playhead so the selection stays live."
//
// The rule is one-directional on purpose. TIME never rewrites the selection - that
// is the Premiere failure ("the selection jumps back to the clip under the playhead
// and I wind up making changes to the wrong clip") - but SELECTION may move time,
// because the alternative is a selected clip the canvas cannot show and therefore
// cannot edit. So every route into `selection.set` inside this panel comes through
// here instead, and the canvas's off-playhead banner becomes a state you can only
// reach the long way round (scrub away from your own selection).
//
// Three refusals, each essential:
//   • `{ reveal: false }` - a Shift-extend. Revealing on the SECOND of two clips
//     picks one arbitrarily and moves the picture out from under the first.
//   • playing - a seek mid-playback is a jump-cut nobody asked for, and during
//     playback the selection is going in and out of frame by definition.
//   • already live - the commonest case by far, and it must cost nothing.
export function selectAndReveal(tp: TpCtx, ids: string[], opts?: { reveal?: boolean }): void {
  const { cfg, clock, getBoxes, selection } = tp;
  selection.set(ids);
  if (opts?.reveal === false || tp.disposed || clock.playing()) return;
  const id = ids[0];
  if (!id) return;
  const rows = getBoxes();
  const i = indexOfId(rows, cfg, id);
  if (i < 0 || !isTimed(rows[i]!, cfg)) return; // scenery is always on screen
  const { start, dur } = span(tp, rows[i]!, durationSec(tp));
  const at = toAuthoredMs(tp, clock.t()) / 1000;
  if (at >= start && at < start + dur) return;
  seekAuthored(tp, start * 1000);
  announce(t('Moved the playhead to this clip'));
}
export function applyBarGeometry(tp: TpCtx, el: HTMLElement, start: number, dur: number): void {
  el.style.left = `${timeToPx(start, tp.pxPerSec)}px`;
  el.style.width = `${Math.max(2, timeToPx(dur, tp.pxPerSec))}px`;
}
/**
 * The diamonds: one strip per ANIMATED clip, one dot per keyframe (plans/104 section 8).
 *
 * POINTER SUGAR, and the word is exact. A bar is `role="option"` inside a listbox,
 * where an interactive child is illegal - so these are `<span>`s, aria-hidden, out
 * of the tab order, and everything they can do (retime, duplicate, re-ease, delete)
 * is also a real labelled button in the inspector's Keyframes group. That list is
 * the keyboard and screen-reader route; this is the one you can grab.
 *
 * Positioned exactly like `.tl-seam`: an absolute `left` in bar-local pixels, with
 * the half-size offset in the SHEET's `margin`, never a `transform`. A transform on
 * a diamond would make its bar a containing block for the fixed-position popovers
 * the panel body-mounts (the trap documented on `.tl-panel`), and the seam chips
 * learned that first.
 *
 * On an `is-tight` bar the strip hides outright - the trim-grip precedent: a target
 * you cannot hit is worse than no target, and the inspector list still has every
 * keyframe. Reconciled in place (`restyle`'s no-churn law): the dots are re-used and
 * only their count changes with the track.
 *
 * `keyframable` is the caller's `isKeyframable` answer. A bar that is NOT keyframable
 * shows no diamonds even if its row carries a track: the inspector offers that box no
 * Keyframes group and "+Keyframe" refuses it, so dots would be the one affordance
 * pointing at a surface nothing else admits to (a sound with a hand-authored `kf=`
 * from a share URL is the only way to get one).
 */
export function syncDiamonds(tp: TpCtx, el: HTMLElement, box: Box, tight: boolean, keyframable: boolean): void {
  const { cfg } = tp;
  const track = cfg.kfField && keyframable ? kfBoxTrack(box, cfg) : null;
  let strip = el.querySelector<HTMLElement>('.tl-kf-strip');
  if (!track?.length) {
    strip?.remove();
    return;
  }
  const fresh = !strip;
  if (!strip) {
    strip = document.createElement('div');
    strip.className = 'tl-kf-strip';
    strip.setAttribute('aria-hidden', 'true');
    el.appendChild(strip);
  }
  strip.hidden = tight;
  while (strip.childElementCount > track.length) strip.lastElementChild?.remove();
  const grew = strip.childElementCount < track.length;
  while (strip.childElementCount < track.length) {
    const dot = document.createElement('span');
    dot.className = 'tl-kf-dot';
    // NO tabIndex, not even -1 (section 8's M2.6 low): this subtree is aria-hidden, and a
    // focusable node inside an aria-hidden subtree is the one combination that has no
    // honest reading - focus would land somewhere the accessibility tree says is not
    // there. `-1` keeps it out of the TAB order but leaves it programmatically
    // focusable, and a pointer press focuses it in some engines. Nothing needs it:
    // the dots are pointer sugar and the inspector list is the AT route.
    strip.appendChild(dot);
  }
  // A NEW dot is a BLANK dot - `is-selected` went with the node it replaced (or with
  // the whole row, on a `rebuild`). The latch's structural memo is keyed on the
  // ANSWER, which a row rebuild does not change, so it would skip the re-mark and the
  // enlarged diamond would silently vanish (section 8's M2.6 low: "enlarged-diamond mark
  // lost on row rebuild"). Resetting the memo is the whole fix - the next
  // `syncKfLatch` re-reads and re-marks - and it costs nothing on the common path,
  // because a repaint that mints no dot does not touch it.
  if (grew || fresh) tp.kfLatchKey = '\u0000';
  for (let i = 0; i < track.length; i++) {
    const dot = strip.children[i] as HTMLElement;
    const k = track[i]!;
    dot.dataset.t = String(k.t);
    dot.style.left = `${timeToPx(kfLocalSec(k.t), tp.pxPerSec)}px`;
    // `title`, not [data-tip]: the bubble primitive draws a ::after ABOVE the
    // element and this one lives inside the `.tl-tracks` scroller, which clips -
    // the same reason the scenery chip's `+` uses a native tooltip.
    const tip = t('Keyframe @ {t}', { t: fmtTime(kfTimelineSec(box, cfg, k.t)) });
    if (dot.title !== tip) dot.title = tip;
  }
}
// ── rows ────────────────────────────────────────────────────────────────────

export function makeBar(_tp: TpCtx, id: string, lane: '' | 'seq'): HTMLElement {
  const el = document.createElement('div');
  el.className = `tl-clip${lane === 'seq' ? ' tl-clip-seq' : ''}`;
  el.dataset.id = id;
  el.dataset.lane = lane;
  el.setAttribute('role', 'option');
  el.setAttribute('aria-selected', 'false');
  el.tabIndex = -1;
  const cv = document.createElement('canvas');
  cv.className = 'tl-clip-thumbs';
  cv.setAttribute('aria-hidden', 'true');
  const label = document.createElement('span');
  label.className = 'tl-clip-label';
  const inEdge = document.createElement('span');
  inEdge.className = 'tl-edge tl-edge-in';
  inEdge.dataset.edge = 'in';
  const outEdge = document.createElement('span');
  outEdge.className = 'tl-edge tl-edge-out';
  outEdge.dataset.edge = 'out';
  el.append(cv, label, inEdge, outEdge);
  return el;
}
/** Full row rebuild - only when `tracksKey` changed. */
export function rebuild(tp: TpCtx, boxes: Box[]): void {
  const { bars, cfg, chips, laneWrap, root, scenery, tracks } = tp;
  const scrollLeft = tracks.scrollLeft;
  // Every bar is about to be destroyed. If one of them had focus, the browser sends
  // focus to <body> - and since the key handler is bound on `root`, that kills the
  // keyboard for the rest of the session (delete a clip, then no shortcut works).
  // Remember it and restore focus onto the new roving bar below.
  const hadFocus =
    root.contains(document.activeElement) &&
    !!(document.activeElement as HTMLElement | null)?.closest('.tl-clip');
  bars.clear();
  chips.clear();
  laneWrap.textContent = '';
  scenery.textContent = '';

  const total = durationSec(tp);
  const seq = seqBoxes(boxes, cfg);
  const seqIds = new Set(seq.map((b) => String(b[cfg.idField] ?? '')));

  // Overlay lanes first (one row each - except that overlays SHARING a group share
  // one row), then the magnetic seq row. The collapse is presentation only: the
  // boxes stay independent in the model, individually selectable and fully editable
  // on canvas - but 200 generated caption cues must not become 200 lane rows, and
  // grouped bars never overlap in time (cues are sequential), so side by side on one
  // row is both honest and readable. The lane-explosion decision, section 5 of the plan.
  const groupLanes = new Map<string, HTMLElement>();
  // REVERSE model order (plans/165 Slice C-tracks): array order is paint order,
  // and the NLE convention every editor teaches is that the TOP track is the
  // FRONTMOST layer - so the last overlay in the array takes the first row, and
  // the magnetic seq row stays the floor (video-track-one at the bottom). A
  // group row sits where its frontmost member does.
  for (let bi = boxes.length - 1; bi >= 0; bi--) {
    const b = boxes[bi];
    if (!b) continue;
    const id = b[cfg.idField];
    if (id == null || id === '') continue;
    const timing = boxTiming(b, cfg);
    if (timing.lane === 'seq' || timing.start === null) continue;
    const group = cfg.groupField ? String(b[cfg.groupField] ?? '') : '';
    let lane = group ? groupLanes.get(group) : undefined;
    if (!lane) {
      lane = document.createElement('div');
      lane.className = 'tl-lane';
      // Presentational: a listbox may only own options, and these rows are pure
      // layout. Flattening them keeps every `role="option"` bar owned by the listbox.
      lane.setAttribute('role', 'presentation');
      lane.dataset.lane = 'overlay';
      // The row's FRONTMOST member (first placed in reverse order) - what a
      // vertical bar drag restacks against.
      lane.dataset.anchor = String(id);
      // A row's own title, when the row has one thing to say about itself. Two
      // cases, both watermarks under the bars (see `.tl-lane-label`): a generated
      // caption group, and SOUND (plans/179 T11). The audio row earns one because it
      // is the row you cannot read at a glance - a waveform is a picture of a level,
      // not of a source, and a music bed has no words of its own to fall back on.
      // Every other group keeps an unlabelled shared row; their bars carry their own
      // labels, which now say what they are (see labelFor).
      const laneTitle =
        group && isCaptionGroup(group)
          ? { cls: 'tl-lane-captions', text: t('Captions') }
          : isAudioRow(tp, b, String(id))
            ? { cls: 'tl-lane-audio', text: t('Audio') }
            : null;
      if (laneTitle) {
        lane.classList.add(laneTitle.cls);
        const lab = document.createElement('span');
        lab.className = 'tl-lane-label';
        lab.setAttribute('aria-hidden', 'true'); // every bar in it is announced itself
        lab.textContent = laneTitle.text;
        lane.appendChild(lab);
      }
      if (group) groupLanes.set(group, lane);
      laneWrap.appendChild(lane);
    }
    const el = makeBar(tp, String(id), '');
    bars.set(String(id), el);
    lane.appendChild(el);
  }

  const seqLane = document.createElement('div');
  seqLane.className = 'tl-lane tl-lane-seq';
  seqLane.setAttribute('role', 'presentation');
  seqLane.dataset.lane = 'seq';
  if (!seq.length) {
    const slot = document.createElement('button');
    slot.type = 'button';
    slot.className = 'tl-dropslot';
    slot.textContent = t('Add a clip');
    // Pointer affordance only - a button is not a legal child of a listbox. The
    // keyboard/AT route to the same thing is the canvas rail's add-clip control.
    slot.setAttribute('aria-hidden', 'true');
    slot.tabIndex = -1;
    // free-canvas owns the add-kind pipeline; ask for a clip rather than reaching in.
    // This used to dispatch its own `tl-add-clip`; it now goes through the SAME
    // `tl-add` seam the `+` menu uses, so there is one event and one listener.
    slot.addEventListener('click', () => tp.menus.emitAdd('clip'));
    seqLane.appendChild(slot);
  }
  for (const b of seq) {
    const id = String(b[cfg.idField] ?? '');
    if (!id) continue;
    const el = makeBar(tp, id, 'seq');
    bars.set(id, el);
    seqLane.appendChild(el);
  }
  // Seam chips between adjacent seq clips (the junction affordance).
  for (let i = 0; i < seq.length - 1; i++) {
    const aId = String(seq[i]![cfg.idField] ?? '');
    const bId = String(seq[i + 1]![cfg.idField] ?? '');
    if (!aId || !bId) continue;
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'tl-seam';
    chip.dataset.a = aId;
    chip.dataset.b = bId;
    // Pointer affordance only (see .tl-dropslot): the same transition is authored
    // from the inspector's Enter / Exit fields, which ARE in the tab order.
    chip.setAttribute('aria-hidden', 'true');
    chip.tabIndex = -1;
    chip.setAttribute('data-tip', t('Transition between clips'));
    seqLane.appendChild(chip);
  }
  laneWrap.appendChild(seqLane);

  // Scenery: everything untimed, as a collapsed strip of chips.
  const untimed = boxes.filter((b) => b && !isTimed(b, cfg));
  if (untimed.length) {
    const label = document.createElement('span');
    label.className = 'tl-scenery-label';
    label.textContent = t('Always on');
    scenery.appendChild(label);
    for (const b of untimed) {
      const id = String(b![cfg.idField] ?? '');
      if (!id) continue;
      // A pill of TWO buttons rather than one: the label selects (which now opens a
      // real inspector), and the `+` promotes the box onto an overlay lane. A button
      // inside a button is not legal HTML, hence the wrapper - the pill's border and
      // background live on the group so the two halves read as one control.
      const group = document.createElement('span');
      group.className = 'tl-chip-group';
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'tl-chip';
      chip.dataset.id = id;
      chip.textContent = tp.helpers.labelFor(id);
      // The chip IS the selection state for a box with no bar, so it says so.
      chip.setAttribute('aria-pressed', 'false');
      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'tl-chip-add';
      add.dataset.id = id;
      add.innerHTML = icon('plus');
      const addLabel = t('Add to the timeline');
      add.setAttribute('aria-label', `${addLabel}: ${tp.helpers.labelFor(id)}`);
      // `title`, not [data-tip]: the bubble primitive is a ::after drawn ABOVE the
      // button, and this one lives inside the .tl-tracks scroller, which clips. A
      // native tooltip is browser-drawn and cannot be sliced by an ancestor.
      add.title = addLabel;
      group.append(chip, add);
      chips.set(id, chip);
      scenery.appendChild(group);
    }
  }
  scenery.hidden = !untimed.length;

  restyle(tp, boxes, total, seqIds);
  tracks.scrollLeft = scrollLeft;
  // restyle → updateRovingTabindex has just picked the surviving focus target.
  if (hadFocus) (bars.get(tp.focusedId) ?? root).focus?.();
}
/** Cheap pass: geometry, labels, selection state. No node churn. */
export function restyle(tp: TpCtx, boxes: Box[], total = durationSec(tp), seqIds?: Set<string>): void {
  const { bars, cfg, chips, inner, laneWrap, selection, tracks } = tp;
  refreshRemoved(tp, boxes); // keep the ignored-span map current for the playhead/seek maps
  const sel = new Set(selection.get());
  const seqSet = seqIds ?? new Set(seqBoxes(boxes, cfg).map((b) => String(b[cfg.idField] ?? '')));
  for (const b of boxes) {
    if (!b) continue;
    const id = String(b[cfg.idField] ?? '');
    const el = id ? bars.get(id) : null;
    if (!el) continue;
    const { start, dur } = span(tp, b, total);
    applyBarGeometry(tp, el, start, dur);
    // labelFor and mediaOf each walk the canvas; call them ONCE per box per pass.
    const text = tp.helpers.labelFor(id);
    const label = el.querySelector<HTMLElement>('.tl-clip-label');
    if (label && label.textContent !== text) label.textContent = text;
    const timing = boxTiming(b, cfg);
    const isSel = sel.has(id);
    el.classList.toggle('is-selected', isSel);
    const muted = b[cfg.muteField] === true || b[cfg.muteField] === 'true';
    el.classList.toggle('is-muted', muted);
    // Struck-through / ignored (plans/174): the RULER keeps it (unlike a delete), greyed
    // and struck, while playback and export skip it. The bar stays draggable/restorable.
    el.classList.toggle('is-ignored', tp.helpers.boxIgnored(b));
    // A/V link. The muted side is the picture (its sound is elsewhere); the other side
    // is the sound itself. The `is-muted` hatch already reads as "silenced" on the
    // video, so this adds the one thing the hatch cannot say: WHERE the sound went.
    const linked = !!cfg.linkField && !!b[cfg.linkField!];
    el.classList.toggle('is-linked', linked);
    let linkEl = el.querySelector<HTMLElement>('.tl-clip-link');
    if (linked && !linkEl) {
      linkEl = document.createElement('span');
      linkEl.className = 'tl-clip-link';
      linkEl.innerHTML = icon('link');
      el.appendChild(linkEl);
    }
    if (linkEl) {
      linkEl.hidden = !linked;
      const tip = muted ? t('Sound is on its own lane') : t('Sound detached from this clip');
      if (linkEl.title !== tip) linkEl.title = tip;
    }
    el.setAttribute('aria-selected', isSel ? 'true' : 'false');
    // Read once and shared with the diamond gate below - `mediaOf` is a live DOM
    // query, and this loop runs per bar per restyle.
    const mediaKind = tp.helpers.mediaOf(id).kind;
    el.dataset.kind = mediaKind || (seqSet.has(id) ? 'clip' : 'overlay');
    // Too narrow to carry two trim zones (see MIN_TRIM_BAR_PX): hide the grips and
    // say where the precise route is, rather than offering a target that would eat
    // the whole bar. Read off the width we just WROTE - asking the DOM for
    // offsetWidth here would force a layout per bar per keystroke.
    const tight = timeToPx(dur, tp.pxPerSec) < MIN_TRIM_BAR_PX;
    el.classList.toggle('is-tight', tight);
    syncDiamonds(tp, el, b, tight, tp.keyframes.isKeyframable(b, id, mediaKind));
    const base = `${text} · ${fmtTime(start)} → ${fmtTime(start + dur)}`;
    el.title = tight
      ? `${base} · ${t('This clip is too narrow to trim here. Zoom in, or set its Length in the panel.')}`
      : base;
    if (timing.speed !== 1) el.dataset.speed = String(timing.speed);
    else delete el.dataset.speed;
  }
  // Scenery chips carry the same selected state a bar does - otherwise selecting an
  // untimed box changes the inspector with nothing on screen to say which box it is.
  for (const [id, chip] of chips) {
    const isSel = sel.has(id);
    chip.classList.toggle('is-selected', isSel);
    chip.setAttribute('aria-pressed', isSel ? 'true' : 'false');
  }
  // Seam chips ride the clip edges.
  for (const chip of Array.from(laneWrap.querySelectorAll<HTMLElement>('.tl-seam'))) {
    const bId = chip.dataset.b || '';
    const i = indexOfId(boxes, cfg, bId);
    const timing = i >= 0 ? boxTiming(boxes[i]!, cfg) : null;
    const at = timing?.start ?? 0;
    chip.style.left = `${timeToPx(at, tp.pxPerSec)}px`;
    const a = indexOfId(boxes, cfg, chip.dataset.a || '');
    const aBox = a >= 0 ? boxes[a]! : null;
    const faded =
      Boolean(aBox && isTransitionKind(aBox[cfg.exitField]) && aBox[cfg.exitField] !== 'none') ||
      Boolean(
        i >= 0 &&
          isTransitionKind(boxes[i]![cfg.enterField]) &&
          boxes[i]![cfg.enterField] !== 'none'
      );
    chip.classList.toggle('is-fade', faded);
    // THROUGH EDIT - a cut whose two sides are still contiguous, i.e. a split nobody
    // has committed to yet. Final Cut's hairline marker, and the single mechanism in
    // the whole survey that makes cutting non-frightening: you can see at a glance
    // which seams are decisions and which are just "I cut here and changed nothing".
    // Computed HERE rather than in rebuild's seam pass, because contiguity dies to a
    // trim or a transition edit, neither of which changes tracksKey.
    // The MARK is the whole affordance, exactly as Final Cut does it - the tip still
    // says what clicking does (open the junction), because that is still what it does;
    // the junction dialog is where the Join action appears.
    chip.classList.toggle(
      'is-through',
      isThroughEdit(boxes, cfg, chip.dataset.a || '', bId, tp.clips.sameSource)
    );
  }
  inner.style.width = `${Math.max(tracks.clientWidth, timeToPx(total, tp.pxPerSec) + 24)}px`;
  // A rebuild mints fresh bars, so the keyboard's armed edge has to be re-painted or
  // it silently disarms visually while still being armed in state.
  tp.edit.paintFocusedEdge();
  updateRuler(tp, total);
  updateRovingTabindex(tp);
  tp.inspectorPane.renderInspector(boxes);
  // AFTER the row is built (it may have just been rebuilt from scratch, taking the
  // latch's marks with it) and after the diamonds have been re-laid: this reads the
  // playhead against what is now on screen. `renderInspector` resets the memo when
  // it rebuilds, so a repaint can never leave the header saying the wrong thing.
  tp.kfDock.syncKfLatch();
  tp.kfDock.syncKfCam();
  // The mic's label follows the selection (record vs record-over), so it repaints
  // with everything else rather than needing its own observer.
  tp.recording.syncMicBtn();
  // And so does "+Keyframe": it is enabled by what is SELECTED, which is one of the
  // two things that bring us here.
  tp.keyframes.syncKfBtn();
  // So does the blade's - its scope depends on the selection and on the model, which
  // are exactly the two things that bring us here. The other half (the playhead
  // crossing a clip boundary) rides `tl-time`, so neither costs a per-tick pass.
  tp.playback.syncSplitBtn();
}
export function updateRuler(tp: TpCtx, total = durationSec(tp)): void {
  const { clock, ruler, rulerInner } = tp;
  const step = tickStep(tp.pxPerSec);
  ruler.setAttribute('aria-valuemax', String(Math.round(total * 10) / 10));
  setRulerNow(tp, clock.t());
  // The tick strip only depends on these three. restyle() runs on every sidebar
  // keystroke, every selection change and every ResizeObserver callback, and
  // rebuilding ~600 elements per keystroke at MAX_PPS is what "cheap pass" is not.
  const key = `${step}|${Math.round(total * 1000)}|${Math.round(tp.pxPerSec * 1000)}`;
  if (key === tp.rulerKey) return;
  tp.rulerKey = key;
  rulerInner.textContent = '';
  rulerInner.style.width = `${Math.max(0, timeToPx(total, tp.pxPerSec) + 24)}px`;
  for (let s = 0; s <= total + step; s += step) {
    const tick = document.createElement('span');
    tick.className = 'tl-tick';
    tick.style.left = `${timeToPx(s, tp.pxPerSec)}px`;
    const lab = document.createElement('span');
    lab.className = 'tl-tick-label';
    lab.textContent = fmtTime(s);
    tick.appendChild(lab);
    rulerInner.appendChild(tick);
  }
}
export function setRulerNow(tp: TpCtx, tMs: number): void {
  const { ruler } = tp;
  const tenth = Math.round((tMs / 1000) * 10) / 10;
  if (tenth === tp.rulerNow) return;
  tp.rulerNow = tenth;
  ruler.setAttribute('aria-valuenow', String(tenth));
  ruler.setAttribute('aria-valuetext', fmtTime(tMs / 1000));
}
export function refreshRemoved(tp: TpCtx, boxes: Box[]): void {
  const { cfg } = tp;
  tp.removedMs = cfg.ignoredField
    ? removedSpansTimeline(boxes, cfg).map((s) => ({ start: s.start * 1000, end: s.end * 1000 }))
    : [];
}
/** Clock (compressed/edited) ms → ruler (authored) ms. */
export const toAuthoredMs = (tp: TpCtx, clockMs: number): number => editedToOriginal(tp.removedMs, clockMs);
/** Ruler (authored) ms → clock (compressed/edited) ms. */
export const toClockMs = (tp: TpCtx, authoredMs: number): number => originalToEdited(tp.removedMs, authoredMs);
/** Seek the clock to an AUTHORED-time position (the ruler/model's own time). */
export const seekAuthored = (tp: TpCtx, authoredMs: number, opts?: { scrubbing?: boolean }): void =>
  { const { clock } = tp; clock.seek(toClockMs(tp, Math.max(0, authoredMs)), opts); };
export function updatePlayhead(tp: TpCtx, tMs: number): void {
  const { playhead, rulerInner, timeEl, tracks } = tp;
  // Read first, write after: reading scrollLeft between style writes forces a
  // synchronous layout on every one of the 60 ticks a second.
  const scrollLeft = tracks.scrollLeft;
  const x = timeToPx(tMs / 1000, tp.pxPerSec);
  playhead.style.left = `${x}px`;
  timeEl.textContent = `${fmtTime(tMs / 1000)} / ${fmtTime(durationSec(tp))}`;
  setRulerNow(tp, tMs);
  rulerInner.style.transform = `translateX(${-scrollLeft}px)`;
}
export function updateRovingTabindex(tp: TpCtx): void {
  const { bars, selection } = tp;
  const list = Array.from(bars.values());
  if (!list.length) return;
  // The fallback is COMPUTED, never written back: a rebuild can run against a
  // model the latest edit has not reached yet (bars briefly missing the id focus
  // was just moved to), and persisting the stand-in permanently re-aimed every
  // keyboard edit (Shift+D, [/]/e) at the FIRST bar while the selection painted
  // elsewhere. A stale focusedId self-heals on the next pass once its bar exists.
  const target =
    tp.focusedId && bars.has(tp.focusedId)
      ? tp.focusedId
      : selection.get().find((id) => bars.has(id)) || String(list[0]!.dataset.id || '');
  for (const el of list) el.tabIndex = el.dataset.id === target ? 0 : -1;
}
// ── promotion / demotion (scenery ⇄ timed) ──────────────────────────────────

/**
 * Give an UNTIMED box (scenery: no lane, no start - what the `text` / `image` /
 * `lottie` / `tool` add-kinds seed) a place on the timeline, in ONE commit.
 *
 * The defaults, spelled out because they are a product decision, not arithmetic:
 *   • START, when the caller does not name one, is the PLAYHEAD. "Put it where I am
 *     looking" is the mental model the rest of the panel already teaches (split and
 *     seek both work off the playhead), and it is the only anchor that is on screen.
 *   • LENGTH, when the caller does not name one, is the box's OWN authored duration
 *     first (a `card` add-kind seeds 2.5 s; clobbering it would make a card promoted
 *     here disagree with the identical card added from the rail), then its media
 *     duration when the live canvas knows it (a video or audio box plays in full),
 *     else DEFAULT_CLIP_S - the same 3 s the magnetic pack hands a clip it cannot
 *     measure, so a promoted box and a packed one never disagree.
 *   • `dur: null`, passed EXPLICITLY, means "author no length at all". That is the
 *     free-canvas create path: it promotes a box born milliseconds ago, before its
 *     asset picker has even opened, so mediaOf() cannot know a length yet and
 *     freezing DEFAULT_CLIP_S in would pin a 45 s audio track to 3 s and destroy the
 *     seq row's derive-from-media rule permanently. Left unauthored, packSeq fills a
 *     seq clip from its media later and an overlay stays open-ended to the sequence
 *     end - exactly what the same box added from the CANVAS already does.
 *   • The box ends up on an OVERLAY lane, never on the magnetic seq row: seq membership
 *     is a separate, deliberate choice (it repacks the whole row), and silently
 *     joining the spine because someone typed a start would move other clips.
 *
 * NO clamping arithmetic lives here. `moveOverlay` owns the start clamp and the
 * millisecond grid; `setDuration` owns the length clamp and the media fit. Both are
 * pure, so composing them on the intermediate array is ONE undo step, not two - and
 * a promoted start ends up on exactly the value a drag to the same time would.
 */
/**
 * The PURE half of {@link promote}: the promoted array, no commit and no side
 * effects. Split out for the one caller that must compose it with a second write -
 * "+Keyframe" on an UNTIMED box, which promotes it and poses its first keyframe in
 * ONE commit and therefore one undo step (section 8's M2.5 revision). Everything about the
 * resolution - the playhead start, the authored → media → DEFAULT_CLIP_S length
 * ladder, the overlay lane - is documented on `promote` and lives HERE so neither
 * caller re-derives it.
 */
export function promoteRows(tp: TpCtx, 
  rows: Box[],
  id: string,
  want?: { start?: number; dur?: number | null }
): Box[] {
  const { cfg, clock } = tp;
  const i = indexOfId(rows, cfg, id);
  if (!id || i < 0) return rows;
  const media = tp.helpers.mediaOf(id).dur;
  const start = want?.start ?? clock.t() / 1000;
  const own = boxTiming(rows[i]!, cfg).dur;
  let dur = want && 'dur' in want ? want.dur : (own ?? media ?? DEFAULT_CLIP_S);
  // "Author no length" means "run open-ended to the sequence end" - which is NOTHING
  // when the start is AT the end of an already-derived sequence. And the playhead
  // (the default start) parks exactly there after every play-through, so the ordinary
  // "+ then pick" flow was minting clips nobody could see, scrub to, or play. When the
  // open window would be empty, author a real length instead (the media's when the
  // canvas knows it, else the pack's own default) - the sequence extends to hold it,
  // which is what adding at the end means everywhere else. Gated on a sequence
  // EXISTING (duration > 0): on a doc with no derived length yet, unauthored is still
  // right - the hook's DEFAULT_SEQ_S fallback opens a window for it, and authoring
  // here is what would pin a 45s track to 3s before its picker ever opened.
  if (dur == null && clock.duration() > 0 && start * 1000 >= clock.duration() - 1)
    dur = own ?? media ?? DEFAULT_CLIP_S;
  const moved = moveOverlay(rows, cfg, id, start);
  return dur == null ? moved : setDuration(moved, cfg, id, dur, media, tp.helpers.mediaDur);
}
export function promote(tp: TpCtx, id: string, want?: { start?: number; dur?: number | null }): void {
  const { cfg, getBoxes } = tp;
  const rows = getBoxes();
  const i = indexOfId(rows, cfg, id);
  if (!id || i < 0) return;
  const next = promoteRows(tp, rows, id, want);
  // Both writers keep row IDENTITY for every row they did not change, so an
  // all-identical array means this promote had nothing to write - a seq-lane clip,
  // whose start the magnetic spine owns and whose length is derived. Skip the commit
  // rather than spend an undo step on a no-op.
  if (next.some((b, k) => b !== rows[k])) tp.helpers.write(next);
  tp.focusedId = id;
  selectAndReveal(tp, [id]);
  announce(t('Added to the timeline'));
}
/**
 * The reverse: take a timed box back to scenery ("always on"), in ONE commit, so that
 * state stays reachable instead of being a one-way trap.
 *
 * `start: ''` - not 0 - is what makes it scenery: boxTiming reads an authored 0 as
 * "enters at the top of the sequence" and only an EMPTY field as untimed. This is a
 * VALUE write, which is exactly what patchBox is for.
 */
export function demote(tp: TpCtx, id: string): void {
  const { cfg, getBoxes } = tp;
  const rows = getBoxes();
  const i = indexOfId(rows, cfg, id);
  if (i < 0) return;
  const wasSeq = boxTiming(rows[i]!, cfg).lane === 'seq';
  const cleared = tp.helpers.patchBox(rows, id, {
    [cfg.startField]: '',
    [cfg.durField]: '',
    [cfg.laneField]: '',
  });
  // Pulling a clip off the magnetic row leaves a hole. Close it the way a delete
  // does - same pack, same overlay ripple - inside the same commit.
  tp.helpers.write(wasSeq ? rippleOverlays(rows, packSeq(cleared, cfg, tp.helpers.mediaDur), cfg) : cleared);
  tp.focusedId = '';
  selectAndReveal(tp, [id]);
  announce(t('Now always on'));
}
export function rowsOps(tp: TpCtx) {
  return {
    isAudioRow: bindOp(tp, isAudioRow),
    renameClip: bindOp(tp, renameClip),
    durationSec: bindOp(tp, durationSec),
    span: bindOp(tp, span),
    activeIdsAt: bindOp(tp, activeIdsAt),
    selectAndReveal: bindOp(tp, selectAndReveal),
    applyBarGeometry: bindOp(tp, applyBarGeometry),
    syncDiamonds: bindOp(tp, syncDiamonds),
    makeBar: bindOp(tp, makeBar),
    rebuild: bindOp(tp, rebuild),
    restyle: bindOp(tp, restyle),
    updateRuler: bindOp(tp, updateRuler),
    setRulerNow: bindOp(tp, setRulerNow),
    refreshRemoved: bindOp(tp, refreshRemoved),
    toAuthoredMs: bindOp(tp, toAuthoredMs),
    toClockMs: bindOp(tp, toClockMs),
    seekAuthored: bindOp(tp, seekAuthored),
    updatePlayhead: bindOp(tp, updatePlayhead),
    updateRovingTabindex: bindOp(tp, updateRovingTabindex),
    promoteRows: bindOp(tp, promoteRows),
    promote: bindOp(tp, promote),
    demote: bindOp(tp, demote),
  };
}
