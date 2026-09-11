// SPDX-License-Identifier: MPL-2.0
/**
 * timeline-panel: the panel itself - junction, shortcuts, keys, wheel, time emit, open and destroy.
 *
 * Every function takes the shared `tp: TpCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `tp.<module>.<fn>`. Extracted verbatim
 * from initTimelinePanel() by scripts/split-closure.ts.
 */
import { t } from '../../i18n.ts';
import { mountModal } from '../../components/modal.ts';
import { releaseClipThumbs } from '../../lib/clip-thumbs.ts';
import { isTransitionKind } from '../../lib/transitions.ts';
import type { KfPose } from '../../../../../engine/src/keyframes.ts';
import { MAX_TRANSITION_MS, MIN_TRANSITION_MS } from '../sequence-clock.ts';
import { releaseSequenceDom } from '../../bridge/sequence-dom.ts';
import { indexOfId, isThroughEdit, kfDiamondAt, onionNeighbours, writeKfPose } from '../timeline-math.ts';
import type { Box } from '../timeline-math.ts';
import { FRAME_S, MIN_PANEL_H, PANEL_SHORTCUTS, RESERVE_PAD, TRIM_SHIFT_FRAMES, ZOOM_STEP, clamp, finite } from '../timeline-config.ts';
import { clampPanelH, panelKeysActive } from './shared.ts';
import { bindOp, type TpCtx } from './context.ts';

// ── junction (seam) transitions ─────────────────────────────────────────────

export function openJunction(tp: TpCtx, aId: string, bId: string): void {
  const { cfg, getBoxes } = tp;
  const boxes = getBoxes();
  const ai = indexOfId(boxes, cfg, aId);
  const bi = indexOfId(boxes, cfg, bId);
  if (ai < 0 || bi < 0) return;
  const curMs = Math.round(
    clamp(finite(boxes[bi]![cfg.enterMsField], 400), MIN_TRANSITION_MS, MAX_TRANSITION_MS)
  );
  const isCut =
    !isTransitionKind(boxes[bi]![cfg.enterField]) || boxes[bi]![cfg.enterField] === 'none';
  // A through edit gets its own way out: this cut has changed nothing, so the useful
  // action here is not "which transition" but "put it back". Offered only where it is
  // real - the same predicate that draws the seam's hairline.
  const through = isThroughEdit(boxes, cfg, aId, bId, tp.clips.sameSource);
  const html = `<form method="dialog" class="tl-junction">
      <h2 class="tl-junction-title">${t('Transition between clips')}</h2>
      <div class="tl-junction-kinds">
        <button type="button" class="btn tl-junction-kind${isCut ? ' is-active' : ''}" data-act="cut">${t('Cut')}</button>
        <button type="button" class="btn tl-junction-kind${isCut ? '' : ' is-active'}" data-act="xfade">${t('Crossfade')}</button>
      </div>
      <label class="field-row field-row--inline tl-junction-dial">
        <span class="field-label">${t('Length (ms)')}</span>
        <input class="field-input tl-num" type="number" min="${MIN_TRANSITION_MS}" max="${MAX_TRANSITION_MS}" step="50" value="${curMs}" data-act="ms">
      </label>
      <div class="tl-junction-actions">${through ? `<button type="button" class="btn tl-junction-join" data-act="join">${t('Join clips')}</button>` : ''}<button type="button" class="btn btn--primary" data-act="done">${t('Done')}</button></div>
    </form>`;
  const modal = mountModal<void>(html, {
    className: 'modal tl-junction-modal',
    ariaLabel: t('Transition between clips'),
    initialFocus: (el) => el.querySelector<HTMLElement>('[data-act="xfade"]'),
  });
  const msInput = modal.el.querySelector<HTMLInputElement>('[data-act="ms"]');
  /** Live kind, read off the buttons, so Done commits what the dialog is showing. */
  const isCutNow = (): boolean =>
    !!modal.el.querySelector('[data-act="cut"]')?.classList.contains('is-active');
  const apply = (kind: 'cut' | 'xfade'): void => {
    const ms = Math.round(
      clamp(finite(msInput?.value, curMs), MIN_TRANSITION_MS, MAX_TRANSITION_MS)
    );
    const rows = getBoxes();
    // Crossfade v1 is MODEL-FREE: no overlap is stored. A.exit + B.enter both fade for
    // `ms`, straddling the cut; the compositor reads the pair. Cut clears both.
    const patched = tp.helpers.patchBox(
      tp.helpers.patchBox(
        rows,
        aId,
        kind === 'cut'
          ? { [cfg.exitField]: 'none' }
          : { [cfg.exitField]: 'fade', [cfg.exitMsField]: ms }
      ),
      bId,
      kind === 'cut'
        ? { [cfg.enterField]: 'none' }
        : { [cfg.enterField]: 'fade', [cfg.enterMsField]: ms }
    );
    tp.helpers.write(patched);
  };
  modal.el.addEventListener('click', (ev) => {
    const act = (ev.target as HTMLElement | null)?.closest<HTMLElement>('[data-act]')?.dataset
      .act;
    if (act === 'join') {
      modal.close();
      tp.clips.joinAt(aId, bId);
    } else if (act === 'cut') {
      apply('cut');
      modal.close();
    } else if (act === 'xfade') {
      apply('xfade');
      modal.close();
    } else if (act === 'done') {
      // Done must COMMIT the dialog's state, not discard it: editing only the length
      // of an existing crossfade and pressing Done wrote nothing at all.
      apply(isCutNow() ? 'cut' : 'xfade');
      modal.close();
    }
  });
}
export function openShortcuts(tp: TpCtx): void {
  if (tp.keysModal) return;
  // A native <dialog> restores focus on close all by itself (the dialog-closing
  // steps). Captured explicitly anyway so the guarantee belongs to the panel: the
  // sheet opens from the toolbar button AND from `?` over a focused clip bar, and
  // "you end up back where you were" has to hold for both.
  const opener = document.activeElement as HTMLElement | null;

  const sheet = document.createElement('div');
  sheet.className = 'tl-keys-sheet';
  const heading = document.createElement('h2');
  heading.className = 'tl-keys-title';
  heading.textContent = t('Timeline keyboard shortcuts');
  const table = document.createElement('table');
  table.className = 'tl-keys-table';
  const tbody = document.createElement('tbody');
  for (const row of PANEL_SHORTCUTS) {
    const tr = document.createElement('tr');
    const keysCell = document.createElement('td');
    keysCell.className = 'tl-keys-keys';
    const kbd = document.createElement('kbd');
    kbd.textContent = row.keys;
    keysCell.appendChild(kbd);
    const whatCell = document.createElement('td');
    whatCell.className = 'tl-keys-what';
    whatCell.textContent = row.label;
    if (row.hint) {
      const hint = document.createElement('span');
      hint.className = 'tl-keys-hint';
      hint.textContent = row.hint;
      whatCell.appendChild(hint);
    }
    tr.append(keysCell, whatCell);
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  const actions = document.createElement('div');
  actions.className = 'tl-keys-actions';
  const done = document.createElement('button');
  done.type = 'button';
  done.className = 'btn btn--primary';
  done.textContent = t('Done');
  actions.appendChild(done);
  sheet.append(heading, table, actions);

  const modal = mountModal<void>('', {
    className: 'modal tl-keys-modal',
    ariaLabel: t('Timeline keyboard shortcuts'),
    onClose: () => {
      tp.keysModal = null;
      if (opener?.isConnected) opener.focus();
    },
  });
  tp.keysModal = modal;
  modal.el.appendChild(sheet);
  done.addEventListener('click', () => modal.close());
  done.focus();
}
export function onKey(tp: TpCtx, e: KeyboardEvent): void {
  const { bars, clock, onionMenu, root, selection } = tp;
  if (!tp.open) return;
  if (!panelKeysActive(root, document.activeElement, tp.hovered)) return;
  // UNMODIFIED ONLY (Shift excepted - several bindings below read it deliberately).
  // Every binding here is a bare letter or punctuation chosen BECAUSE no browser
  // fights for it; that reasoning only holds if the handler also declines the chord.
  // Without this, Cmd/Ctrl+S split instead of saving the page, Cmd/Ctrl+F fitted the
  // timeline instead of opening Find, Cmd+[ / Cmd+] armed a trim edge instead of
  // going back/forward, and Ctrl+- / Ctrl+= zoomed the timeline instead of the page -
  // every one of them preventDefault()ed. free-canvas.ts guards its `v`/`p` tool
  // letters the same way.
  // …with ONE documented exception, taken BEFORE the guard because the guard is a
  // bare `return`: Alt+←/→ walks the selected clip's keyframes (plans/104 section 8). Alt
  // is already this panel's "not the ordinary reading" modifier - it bypasses
  // snapping on every drag - and no browser binds Alt+arrow on a focused element,
  // which is the same test every bare letter below had to pass.
  if (e.altKey && !e.metaKey && !e.ctrlKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
    e.preventDefault();
    e.stopPropagation();
    tp.keyframes.seekDiamond(e.key === 'ArrowRight' ? 1 : -1);
    return;
  }
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const total = tp.rows.durationSec();
  const stepS = e.shiftKey ? 1 : FRAME_S;
  switch (e.key) {
    case ' ':
    case 'Spacebar': {
      // A focused <button> activates on Space by itself (click on keyup). Let it -
      // handling it here as well would toggle playback twice.
      if ((e.target as HTMLElement | null)?.closest('button')) return;
      e.preventDefault();
      e.stopPropagation();
      tp.playback.togglePlay();
      return;
    }
    case 'ArrowLeft':
      e.preventDefault();
      e.stopPropagation();
      clock.seek(Math.max(0, clock.t() - stepS * 1000));
      return;
    case 'ArrowRight':
      e.preventDefault();
      e.stopPropagation();
      clock.seek(Math.min(total * 1000, clock.t() + stepS * 1000));
      return;
    case 'ArrowUp':
    case 'ArrowDown': {
      e.preventDefault();
      e.stopPropagation();
      const list = Array.from(bars.keys());
      if (!list.length) return;
      const at = Math.max(0, list.indexOf(tp.focusedId));
      const next = list[clamp(at + (e.key === 'ArrowDown' ? 1 : -1), 0, list.length - 1)]!;
      tp.focusedId = next;
      tp.rows.selectAndReveal([next]);
      tp.rows.updateRovingTabindex();
      bars.get(next)?.focus();
      return;
    }
    case 'Home':
      e.preventDefault();
      e.stopPropagation();
      clock.seek(0);
      return;
    case 'End':
      e.preventDefault();
      e.stopPropagation();
      tp.rows.seekAuthored(total * 1000);
      return;
    // Split: `s` cuts what is in scope (selection, else the clip under the playhead);
    // Shift+S cuts EVERY timed clip the playhead is inside, on every lane, ignoring
    // the selection. Both are one write, so both are one undo.
    case 's':
    case 'S':
      e.preventDefault();
      e.stopPropagation();
      tp.playback.splitAtPlayhead(e.shiftKey ? { everything: true } : undefined);
      return;
    // Shift+D detaches (or re-attaches) the clip's sound. Bare letters and Shift+letter
    // are the only unclaimed key space here: every canonical NLE chord for this
    // (Cmd/Ctrl+B, Cmd/Ctrl+Shift+B, Cmd/Ctrl+K) collides with a browser binding whose
    // preventDefault is unreliable, and a shortcut that silently does nothing is worse
    // than one that has to be learned from the panel's own menu.
    case 'd':
    case 'D': {
      if (!e.shiftKey) return;
      e.preventDefault();
      e.stopPropagation();
      const id = tp.edit.trimTargetId();
      if (!id) return;
      if (tp.clips.partnerOf(id)) tp.clips.reattachAudioAt(id);
      else tp.clips.detachAudioAt(id);
      return;
    }
    // Trim, from the keyboard. `[` / `]` aim at an edge; `,` / `.` walk it a frame at
    // a time (Shift: ten); `e` pulls it to the playhead. Bare letters and punctuation
    // deliberately - every canonical NLE trim chord collides with a browser binding
    // whose preventDefault() is unreliable, and a shortcut that silently does nothing
    // is worse than one the user has to learn.
    case '[':
      e.preventDefault();
      e.stopPropagation();
      tp.edit.focusEdge('in');
      return;
    case ']':
      e.preventDefault();
      e.stopPropagation();
      tp.edit.focusEdge('out');
      return;
    case ',':
    case '<':
      e.preventDefault();
      e.stopPropagation();
      tp.edit.trimBy(-(e.shiftKey ? TRIM_SHIFT_FRAMES : 1) * FRAME_S);
      return;
    case '.':
    case '>':
      e.preventDefault();
      e.stopPropagation();
      tp.edit.trimBy((e.shiftKey ? TRIM_SHIFT_FRAMES : 1) * FRAME_S);
      return;
    case 'e':
    case 'E':
      e.preventDefault();
      e.stopPropagation();
      tp.edit.trimToPlayhead();
      return;
    // "+Keyframe" from the keyboard - the THIRD door onto `addKeyframeAction`, and
    // literally the same call the transport button and the canvas contextual bar
    // make (section 8's M2.5 revision: two homes, one action). So `K` inherits every rule
    // from it, including the auto-promotion of an untimed selected box: the panel
    // being open with something selected IS the disclosure, and a keyboard user must
    // not be given the smaller half of a feature. Always preventDefault, including
    // on a selection with nothing to key: a shortcut that sometimes falls through to
    // the page is a shortcut nobody can trust.
    case 'k':
    case 'K': {
      e.preventDefault();
      e.stopPropagation();
      tp.keyframes.addKeyframeAction({ speak: true });
      return;
    }
    // Onion skin: `o` toggles it, Shift+O opens its options - the same bare-letter /
    // Shift-letter split `s`/`S` and `d`/`D` already use, and the only key space left
    // that no browser binding fights for. Both cases fold into ONE branch and the
    // modifier is read off the EVENT, exactly like `s`/`S`: KeyboardEvent.key reports
    // the produced character, so with Caps Lock on a bare `o` arrives as 'O' and
    // Shift+o as 'o' - branching on the letter's case inverts the pair.
    case 'o':
    case 'O':
      e.preventDefault();
      e.stopPropagation();
      if (e.shiftKey) onionMenu.open();
      else tp.menus.toggleOnion();
      return;
    case '+':
    case '=':
      e.preventDefault();
      e.stopPropagation();
      tp.playback.zoom(ZOOM_STEP);
      return;
    case '-':
    case '_':
      e.preventDefault();
      e.stopPropagation();
      tp.playback.zoom(1 / ZOOM_STEP);
      return;
    case 'f':
    case 'F':
      e.preventDefault();
      e.stopPropagation();
      tp.playback.fit();
      return;
    case 'Delete':
    case 'Backspace':
      e.preventDefault();
      e.stopPropagation();
      tp.edit.deleteBox();
      return;
    // The menu key and Shift+F10 are the platform's context-menu keys. Without them
    // "Send to timeline" / "Make always on" would be pointer-only affordances.
    // `?` is the web's own "what can I press here" key. Every shortcut this panel
    // binds is a bare letter chosen because no browser fights for it, which also
    // means none of them is guessable - so the sheet is not a nicety.
    case '?':
      e.preventDefault();
      e.stopPropagation();
      openShortcuts(tp);
      return;
    case 'ContextMenu':
      e.preventDefault();
      e.stopPropagation();
      tp.menus.openCtxForFocused();
      return;
    case 'F10':
      if (!e.shiftKey) return;
      e.preventDefault();
      e.stopPropagation();
      tp.menus.openCtxForFocused();
      return;
    // The Escape LADDER, narrowest mode first: (1) a LIVE pointer drag - a trim or a
    // move mid-flight is the narrowest mode of all, and it is a visible one (the bar
    // carries .is-trimming, the badge and the reachable-media ghost are on screen), so
    // Escape must abandon it rather than pull the whole panel out from under the
    // pointer; (2) an armed keyboard trim edge, (3) a live take - mid-recording Escape
    // is the "stop, I fluffed it" key, and closing the panel out from under a live
    // microphone is not what the press meant - (4) the panel itself. Each rung is a
    // mode the user entered deliberately, so each one gets its own press.
    case 'Escape':
      e.preventDefault();
      e.stopPropagation();
      if (tp.gesture) {
        // endGesture drops the pointer capture and the chrome, so the pointerup that
        // follows finds `gesture === null` and writes nothing - the edit is abandoned,
        // not committed. The re-sync repaints the bars from the model, since a live
        // ripple preview would otherwise sit on screen until the next unrelated sync.
        tp.gestures.endGesture(tp.gesture);
        tp.syncing.scheduleSync();
        return;
      }
      if (tp.focusedEdge) {
        tp.focusedEdge = null;
        tp.edit.paintFocusedEdge();
        return;
      }
      if (tp.takePhase !== 'idle') {
        tp.recording.cancelTake();
        return;
      }
      // Clear a MULTI-selection before closing, so Escape means "deselect" first after
      // a marquee (matching the canvas). A single selected clip is the normal state and
      // does NOT swallow the close press - the ladder's last rung stays the panel.
      if (selection.get().length > 1) {
        tp.rows.selectAndReveal([], { reveal: false });
        return;
      }
      setOpen(tp, false);
      return;
    default:
  }
}
export function onWheel(tp: TpCtx, e: WheelEvent): void {
  if (!(e.ctrlKey || e.altKey || e.metaKey)) return;
  e.preventDefault();
  const cursorPx = e.clientX - tp.syncing.tracksRectLeft();
  tp.playback.zoom(e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP, cursorPx);
} // unmatchable, so the first tick always announces
export function emitTime(tp: TpCtx, tMs: number): void {
  const { cfg, clock, getBoxes, root } = tp;
  if (tp.disposed) return;
  const playing = clock.playing();
  const boxes = getBoxes();
  const at = tMs / 1000;
  const activeIds = tp.rows.activeIdsAt(boxes, at);
  const pref = tp.onionPref;
  const ghosts = pref
    ? onionNeighbours(boxes, cfg, at, pref.before, pref.after)
    : { past: [] as string[], future: [] as string[] };
  const mode = pref ? pref.mode : '';
  const opacity = pref ? pref.opacity : 1;
  // BEFORE the gate, and deliberately: the splittable set is NOT the active set. A
  // clip becomes active at its exact start, where a cut is impossible, and becomes
  // splittable one frame later - so gating the blade's label on tl-time's signature
  // would leave it disabled for the whole clip. It carries its own memo instead, so
  // the per-tick cost is one scope resolution and no DOM write.
  tp.playback.syncSplitBtn();
  const key = `${playing ? 1 : 0}|${activeIds.join(',')}|${mode}|${opacity}|${ghosts.past.join(',')}|${ghosts.future.join(',')}`;
  if (key === tp.lastTimeKey) return;
  tp.lastTimeKey = key;
  root.dispatchEvent(
    new CustomEvent('tl-time', {
      bubbles: true,
      detail: {
        atMs: tMs,
        activeIds,
        playing,
        mode,
        opacity,
        past: ghosts.past,
        future: ghosts.future,
      },
    })
  );
}
/**
 * `fc-seek` - the canvas→panel half. The off-playhead banner's "Go to it" asks for a
 * time; the clock is ours, so the seek is ours. Untrusted detail (anything can
 * dispatch a CustomEvent), hence the finite/non-negative coercion.
 */
export function onFcSeek(tp: TpCtx, e: Event): void {
  const { clock } = tp;
  if (tp.disposed) return;
  const d = (e as CustomEvent).detail as { atMs?: unknown } | null | undefined;
  const raw = typeof d?.atMs === 'number' ? d.atMs : Number.NaN;
  clock.seek(Number.isFinite(raw) ? Math.max(0, raw) : 0);
}
// ── open / close / destroy ──────────────────────────────────────────────────

export function setOpen(tp: TpCtx, next: boolean): void {
  const { addMenu, canvasEl, clock, ctxMenu, easeMenu, onionMenu, reserve, root, stageEl } = tp;
  if (tp.disposed || next === tp.open) return;
  tp.open = next;
  root.hidden = !tp.open;
  if (tp.open) {
    // FIRST: lift the hold the last close took, so the clock may write again. The
    // resume re-asserts it at its OWN retained time, which is what makes reopening
    // resume at the same playhead rather than at zero (plans/179 T2).
    tp.seqHold?.();
    tp.seqHold = null;
    const stageH = stageEl.getBoundingClientRect().height || 0;
    // CSS makes this a fixed compact transport on a phone/short landscape.
    // Reserve the height it ACTUALLY paints, not the remembered 190px desktop
    // height; the stale reserve was shrinking a 16:9 artboard to a few pixels.
    tp.panelH = tp.helpers.compactPanel() ? MIN_PANEL_H : clampPanelH(tp.panelH, stageH, tp.gestures.chromeH());
    root.style.height = `${tp.panelH}px`;
    reserve(tp.panelH + RESERVE_PAD);
    tp.lastKey = '\u0000';
    tp.fitPending = true;
    tp.syncing.sync();
    clock.reapply();
    // The synchronous reapply above gates the canvas AS IT IS NOW, but `reserve()` at
    // :4839 re-fits (and may re-render) the artboard AFTER this returns - a plain re-fit
    // that does not move the clock fires no further gate, so a template whose clips are
    // already timed on first render (sequence-studio "Video") would keep every clip
    // visible at rest until the user first scrubs/plays. Re-assert the gate one frame
    // later, once the re-fit has settled. Idempotent: on a steady frame reapply() writes
    // zero styles and only re-adds/removes `.seq-off`. Fires only on open, never per tick.
    requestAnimationFrame(() => {
    const { clock } = tp;
      if (tp.disposed || !tp.open) return;
      clock.reapply();
    });
    root.focus?.();
  } else {
    // A hidden panel has no visible mic button, no meter and no elapsed clock, so a
    // take cannot survive the close: the microphone would stay open with nothing on
    // screen to say so.
    tp.recording.cancelTake();
    // End any gesture FIRST: Escape is reachable mid-drag, and a live resize keeps
    // calling reserve() on every subsequent pointermove - leaving the artboard
    // shrunk behind a hidden panel until the tool is destroyed.
    tp.gestures.endGesture(tp.gesture);
    // The menus are body-mounted, so hiding the panel does not hide them.
    addMenu.close();
    ctxMenu.close();
    onionMenu.close();
    easeMenu.close();
    // …and the inspector's group popover most of all: it is positioned ABOVE the
    // panel, so a hidden panel would leave a settings card floating over the canvas
    // with nothing under it to explain what it belongs to.
    tp.kfDock.closeGroupPopover();
    tp.keysModal?.close();
    clock.pause();
    tp.playback.syncPlayBtn(); // a paused clock emits no ticks, so project the state now
    tp.thumbs.abortThumbs();
    tp.cancelIdle?.();
    tp.cancelIdle = null;
    // CLOSING RELEASES THE CLOCK (plans/179 T2). A paused clock still holds the
    // canvas at whatever frame it stopped on: three of a deck's four artboards left
    // `display: none` with only their labels, every box still wearing the composed
    // transform/opacity of the frame it happened to be mid-way through. There is no
    // playhead on screen any more, so there is nothing on the canvas that could
    // explain it - which is the whole argument for the "no clock = every box shows"
    // contract. `clock.pause()` above has already put every video back the way the
    // free-run rules leave it (paused where we started it, muted/loop as authored);
    // this hands back the CLASSES and the POSE, and holds every writer down until
    // the panel opens again. The clock keeps its time, so the reopen resumes here.
    tp.seqHold?.(); // never non-null on this path; a close is never nested
    tp.seqHold = releaseSequenceDom(canvasEl);
    reserve(0);
  }
}
export function destroy(tp: TpCtx): void {
  const { addMenu, bars, chips, clock, ctxMenu, easeMenu, host, kfCtxMenu, onionMenu, reserve, ro, root, stageEl, tracks, unsubPose, unsubRuntime, unsubSelection, unsubShot, unsubTick } = tp;
  if (tp.disposed) return;
  // BEFORE `disposed` flips: cancelTake's teardown is deliberately allowed to touch
  // the clock, and a take that outlived the panel is a microphone nobody can stop.
  tp.recording.cancelTake();
  tp.disposed = true;
  if (tp.noteTimer) {
    clearTimeout(tp.noteTimer);
    tp.noteTimer = 0;
  }
  if (tp.inspectorEnterT) {
    clearTimeout(tp.inspectorEnterT);
    tp.inspectorEnterT = null;
  }
  if (typeof document !== 'undefined')
    document.removeEventListener('visibilitychange', tp.subtitles.onVisibility);
  tp.gestures.endGesture(tp.gesture);
  // Body-mounted: these outlive root.remove() unless they are closed explicitly.
  try {
    addMenu.close();
  } catch {
    /* never opened */
  }
  try {
    ctxMenu.close();
  } catch {
    /* never opened */
  }
  try {
    onionMenu.close();
  } catch {
    /* never opened */
  }
  try {
    easeMenu.close();
  } catch {
    /* never opened */
  }
  try {
    kfCtxMenu.close();
  } catch {
    /* never opened */
  }
  // The editor holds a rAF loop and a document-level pointerup; closing the popover
  // only takes its DOM away.
  try {
    tp.easeEditor?.destroy();
  } catch {
    /* never opened */
  }
  tp.easeEditor = null;
  // …and so does the one DOCKED in the Keyframes popup (section 8's M2.7).
  try {
    tp.kfLatch?.dock?.editor?.destroy();
  } catch {
    /* never mounted */
  }
  try {
    tp.kfDock.closeGroupPopover();
  } catch {
    /* never opened */
  }
  tp.kfLatch = null;
  tp.kfCam = null;
  try {
    tp.keysModal?.close();
  } catch {
    /* never opened */
  }
  if (tp.onionHold) {
    clearTimeout(tp.onionHold);
    tp.onionHold = 0;
  }
  try {
    clock.pause();
  } catch {
    /* already gone */
  }
  // Dropped, never LIFTED: lifting re-asserts the playhead one statement before
  // `clock.destroy()` undoes it again. The clock's own teardown restores the styles
  // and the classes whether it is held or not, and deregisters the writer - which is
  // what takes the hold's bookkeeping with it.
  tp.seqHold = null;
  tp.thumbs.abortThumbs();
  tp.cancelIdle?.();
  tp.cancelIdle = null;
  try {
    unsubShot();
  } catch {
    /* already gone */
  }
  try {
    unsubPose();
  } catch {
    /* already gone */
  }
  // The decoded pictures outlive the panel otherwise: nothing else in the web shell
  // consumes this cache (picker.ts imports `onIdle` alone), so up to CACHE_LIMIT
  // ImageBitmaps - filmstrips of dozens each, plus every frame's node raster - would
  // sit there with no DOM referencing them until some other editor happened to evict
  // them. Also detaches the probe <video> and closes the decode context.
  try {
    releaseClipThumbs();
  } catch {
    /* nothing decoded this session */
  }
  try {
    unsubTick();
  } catch {
    /* already gone */
  }
  try {
    unsubSelection?.();
  } catch {
    /* already gone */
  }
  try {
    unsubRuntime?.();
  } catch {
    /* already gone */
  }
  try {
    ro?.disconnect();
  } catch {
    /* already gone */
  }
  try {
    stageEl.removeEventListener('fc-seek', tp.panel.onFcSeek);
  } catch {
    /* stage detached */
  }
  root.removeEventListener('pointerdown', tp.gestures.onPointerDown);
  root.removeEventListener('pointermove', tp.gestures.onPointerMove);
  root.removeEventListener('pointerup', tp.gestures.onPointerUp);
  root.removeEventListener('pointercancel', tp.gestures.onPointerCancel);
  root.removeEventListener('lostpointercapture', tp.gestures.onPointerCancel);
  root.removeEventListener('keydown', tp.panel.onKey);
  root.removeEventListener('contextmenu', tp.menus.onContextMenu);
  root.removeEventListener('wheel', tp.panel.onWheel);
  tracks.removeEventListener('touchstart', tp.playback.onTouchStart);
  tracks.removeEventListener('touchmove', tp.playback.onTouchMove);
  tracks.removeEventListener('touchend', tp.playback.onTouchEnd);
  tracks.removeEventListener('touchcancel', tp.playback.onTouchEnd);
  try {
    clock.destroy();
  } catch {
    /* already gone */
  }
  reserve(0);
  root.remove();
  bars.clear();
  chips.clear();
  host.log?.('debug', 'timeline panel destroyed');
}
/**
 * Of `ids`, the ones whose OWN keyframe sits exactly under the playhead right now.
 *
 * Exact equality, because the latch has already put the playhead there (section 8): a
 * tolerance would make a canvas drag key a keyframe the panel's own header says
 * you are not on, which is the one way this model can lie.
 */
export function kfPoseIds(tp: TpCtx, ids: readonly string[]): string[] {
  const { cfg, getBoxes } = tp;
  // A CLOSED panel arms nothing. section 8's model is "the playhead's position IS the arm",
  // and with the panel shut there is no playhead on screen, no diamonds, no latch
  // header and no "+Keyframe" anywhere - so a drag that quietly wrote a keyframe
  // instead of moving the box would be the one thing this model exists to prevent:
  // a keyframe nobody asked for, from a gesture that looked like an ordinary move.
  // `setOpen(false)` keeps the clock's time, so the answer would otherwise survive
  // the close.
  if (!tp.open || !cfg.kfField) return [];
  const rows = getBoxes();
  const at = tp.keyframes.playheadSec();
  const out: string[] = [];
  for (const id of ids) {
    const i = indexOfId(rows, cfg, id);
    if (i >= 0 && kfDiamondAt(rows[i]!, cfg, at) !== null) out.push(id);
  }
  return out;
}
/**
 * The gesture's delta, folded into each box's keyframe at the playhead - a FULL
 * pose over its active channel set, so every diamond stays a complete honest one.
 * Pure: no commit, no announce, no DOM. The caller writes once.
 */
export function kfPoseWrite(tp: TpCtx, 
  boxes: Box[],
  ids: readonly string[],
  delta: KfPose,
  mode: 'add' | 'set' = 'add'
): Box[] {
  const { cfg } = tp;
  if (!cfg.kfField) return boxes;
  const at = tp.keyframes.playheadSec();
  let next = boxes;
  for (const id of ids) next = writeKfPose(next, cfg, id, at, delta, mode);
  return next;
}
export function panelOps(tp: TpCtx) {
  return {
    openJunction: bindOp(tp, openJunction),
    openShortcuts: bindOp(tp, openShortcuts),
    onKey: bindOp(tp, onKey),
    onWheel: bindOp(tp, onWheel),
    emitTime: bindOp(tp, emitTime),
    onFcSeek: bindOp(tp, onFcSeek),
    setOpen: bindOp(tp, setOpen),
    destroy: bindOp(tp, destroy),
    kfPoseIds: bindOp(tp, kfPoseIds),
    kfPoseWrite: bindOp(tp, kfPoseWrite),
  };
}
