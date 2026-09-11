// SPDX-License-Identifier: MPL-2.0
/**
 * timeline-panel: voice, video and screen takes - meters, count-in, start, stop, insert.
 *
 * Every function takes the shared `tp: TpCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `tp.<module>.<fn>`. Extracted verbatim
 * from initTimelinePanel() by scripts/split-closure.ts.
 */
import { t } from '../../i18n.ts';
import { announce } from '../../a11y.ts';
import { playSfx } from '../../lib/sfx.ts';
import { DEFAULT_CLIP_S, boxTiming, fmtTime, indexOfId, moveOverlay, setDuration } from '../timeline-math.ts';
import type { Box } from '../timeline-math.ts';
import { subscribeRecordPreview } from '../../lib/record-preview.ts';
import type { AssetRef, AudioLevel, RecordSession } from '@lolly-tools/core/host-v1';
import { TAKE_TIMING, clamp, finite } from '../timeline-config.ts';
import type { TakeKind, TakePhase, TimelineAddDetail, TimelineAddKind } from './shared.ts';
import { bindOp, type TpCtx } from './context.ts';

/** The manifest's audio add-kind - the seed a recorded take is born from. */
export const audioKind = (tp: TpCtx): TimelineAddKind | undefined => { const { addKinds } = tp; return addKinds.find((k) => k.id === 'audio'); };
/**
 * PROGRESSIVE ENHANCEMENT, deliberately not a manifest capability - the same call
 * `host.media`'s live camera makes: the button appears when the running shell can
 * actually record and the tool has somewhere to put a take, and is absent otherwise.
 * Two questions, both answered here:
 *   - `host.recorder` + `isAvailable('audio')`: can THIS SHELL capture audio at all (a
 *     CLI cannot, and neither can a browser outside a secure context);
 *   - the audio add-kind: does the tool have an audio vocabulary - with no audio kind
 *     there is no box for a take to become.
 * No permission prompt is risked by the button existing: nothing opens the mic until it
 * is pressed. Declaring `microphone` on the manifest instead would say "this tool cannot
 * run without a microphone", and other shells enforce exactly that: the TUI hides such a
 * tool from its gallery (shells/tui/src/tool-support.ts) and the CLI smoke gate skips it
 * (shells/cli/src/smoke.ts). An optional voiceover must never cost a timed tool its
 * headless support, so sequence-studio declares no capability for it.
 */
export function canRecordVoiceover(tp: TpCtx): boolean {
  const { host } = tp;
  const r = host.recorder;
  if (!r || typeof r.isAvailable !== 'function' || !audioKind(tp)) return false;
  try {
    return r.isAvailable('audio');
  } catch {
    return false;
  }
}
/** Same two questions for the typed twin: can this shell synthesize speech at all,
 *  and does the tool have an audio vocabulary for the clip to land in. */
export function canScriptVoiceover(tp: TpCtx): boolean {
  const { host } = tp;
  const sp = host.speech;
  if (!sp || typeof sp.isAvailable !== 'function' || !audioKind(tp)) return false;
  try {
    return sp.isAvailable();
  } catch {
    return false;
  }
}
/** The manifest's sequence-clip add-kind - what a camera take becomes. */
export const clipKind = (tp: TpCtx): TimelineAddKind | undefined => { const { addKinds } = tp; return addKinds.find((k) => k.id === 'clip'); };
/** The camera's two questions: can this shell capture video, and does the tool have
 *  a clip vocabulary for the take to land in. Same progressive terms as the mic. */
export function canRecordVideo(tp: TpCtx): boolean {
  const { host } = tp;
  const r = host.recorder;
  if (!r || typeof r.isAvailable !== 'function' || !clipKind(tp)) return false;
  try {
    return r.isAvailable('video');
  } catch {
    return false;
  }
}
export function canRecordScreen(tp: TpCtx): boolean {
  const { host } = tp;
  const r = host.recorder;
  if (!r || typeof r.isAvailable !== 'function' || !clipKind(tp)) return false;
  try {
    return r.isAvailable('screen');
  } catch {
    return false;
  }
}
export function showCamView(tp: TpCtx): void {
  const { opts } = tp;
  if (tp.camView) return;
  const size = opts.frameSize?.() ?? null;
  const el = document.createElement('div');
  el.className = 'tl-cam-view';
  el.setAttribute('data-export-hide', '');
  el.setAttribute('aria-hidden', 'true');
  if (size && size.w > 0 && size.h > 0) el.style.aspectRatio = `${size.w} / ${size.h}`;
  const v = document.createElement('video');
  v.muted = true;
  v.autoplay = true;
  v.playsInline = true;
  v.setAttribute('playsinline', '');
  el.appendChild(v);
  opts.stageEl.appendChild(el);
  tp.camView = el;
  tp.camPreviewOff = subscribeRecordPreview((stream) => {
    v.srcObject = stream;
    if (stream && typeof v.play === 'function')
      void v.play().catch(() => {
        /* muted inline video */
      });
  });
}
export function hideCamView(tp: TpCtx): void {
  try {
    tp.camPreviewOff?.();
  } catch {
    /* already unsubscribed */
  }
  tp.camPreviewOff = null;
  tp.camView?.remove();
  tp.camView = null;
}
export function assetFieldName(tp: TpCtx): string {
  const { cfg, getBoxes, opts } = tp;
  if (opts.assetField) return opts.assetField;
  if (tp.assetFieldCache) return tp.assetFieldCache;
  for (const b of getBoxes()) {
    if (!b) continue;
    for (const [k, v] of Object.entries(b)) {
      if (k === cfg.idField || !v || typeof v !== 'object' || Array.isArray(v)) continue;
      const ref = v as { id?: unknown; source?: unknown; url?: unknown };
      if (
        typeof ref.id === 'string' &&
        (typeof ref.source === 'string' || typeof ref.url === 'string')
      ) {
        tp.assetFieldCache = k;
        return k;
      }
    }
  }
  return 'image';
}
/** The asset ref a box carries, if any. */
export function refOf(tp: TpCtx, 
  id: string
): { id?: unknown; source?: unknown; type?: unknown; meta?: unknown } | null {
  const { cfg, getBoxes } = tp;
  const rows = getBoxes();
  const i = indexOfId(rows, cfg, id);
  if (i < 0) return null;
  const v = rows[i]![assetFieldName(tp)];
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as { id?: unknown }) : null;
}
/**
 * A box holding a previous VOICEOVER take - the one a re-take is allowed to overwrite.
 *
 * The id namespace alone is not enough: the record tool and screen capture mint their
 * takes as `user/recording/<ts>.mp4|webm` through the same `storeRecordingAsset`. Pick
 * one of those videos into a clip and the id test would offer to "record over this
 * take", turning a video clip into an audio box and DELETING the user's recording. So
 * the asset's type decides, with the live box's own media as the fallback for a ref
 * persisted without one.
 */
export function isTakeBox(tp: TpCtx, id: string): boolean {
  const ref = refOf(tp, id);
  const refId = ref?.id;
  if (typeof refId !== 'string' || !refId.startsWith('user/recording/')) return false;
  if (typeof ref?.type === 'string') return ref.type === 'audio';
  return tp.helpers.mediaOf(id).kind === 'audio';
}
export function setNote(tp: TpCtx, msg: string): void {
  const { recNote } = tp;
  if (tp.noteTimer) {
    clearTimeout(tp.noteTimer);
    tp.noteTimer = 0;
  }
  recNote.textContent = msg;
  recNote.hidden = !msg;
  // Transient by design: a stale error sitting in the bar reads as a current one.
  if (msg)
    tp.noteTimer = setTimeout(() => {
    const { recNote } = tp;
      recNote.textContent = '';
      recNote.hidden = true;
      tp.noteTimer = 0;
    }, 8000) as unknown as number;
}
export function setPhase(tp: TpCtx, next: TakePhase): void {
  const { root } = tp;
  if (tp.takePhase === next) return;
  tp.takePhase = next;
  // A DOM seam rather than a callback: free-canvas may want to know one day, and a
  // jsdom test can await the take without reaching into module state.
  root.dispatchEvent(new CustomEvent('tl-take', { bubbles: true, detail: { phase: next } }));
}
export function syncMicBtn(tp: TpCtx): void {
  const { micBtn, selection } = tp;
  syncCamBtn(tp);
  syncScreenBtn(tp);
  if (micBtn.hidden) return;
  const mine = tp.takeKind === 'audio';
  const live = mine && (tp.takePhase === 'recording' || tp.takePhase === 'countin');
  // At rest the label says what the NEXT press will do, which depends on the
  // selection: with one of our own takes selected, recording replaces it.
  const sel = tp.takePhase === 'idle' ? selection.get() : [];
  const overTake = sel.length === 1 && !!sel[0] && isTakeBox(tp, sel[0]);
  const label =
    mine && tp.takePhase === 'saving'
      ? t('Saving the take…')
      : live
        ? t('Stop recording')
        : overTake
          ? t('Record over this take')
          : t('Record a voiceover');
  micBtn.setAttribute('aria-label', label);
  micBtn.setAttribute('data-tip', label);
  micBtn.setAttribute('aria-pressed', live ? 'true' : 'false');
  micBtn.classList.toggle('is-recording', mine && tp.takePhase === 'recording');
  // One take at a time: the other button waits while this kind is in flight.
  micBtn.disabled = tp.takePhase === 'saving' || (!mine && tp.takePhase !== 'idle');
}
/** The camera button's twin of syncMicBtn: no re-take (a clip is never overwritten). */
export function syncCamBtn(tp: TpCtx): void {
  const { camBtn } = tp;
  if (camBtn.hidden) return;
  const mine = tp.takeKind === 'video';
  const live = mine && (tp.takePhase === 'recording' || tp.takePhase === 'countin');
  const label =
    mine && tp.takePhase === 'saving'
      ? t('Saving the take…')
      : live
        ? t('Stop recording')
        : t('Record a video');
  camBtn.setAttribute('aria-label', label);
  camBtn.setAttribute('data-tip', label);
  camBtn.setAttribute('aria-pressed', live ? 'true' : 'false');
  camBtn.classList.toggle('is-recording', mine && tp.takePhase === 'recording');
  camBtn.disabled = tp.takePhase === 'saving' || (!mine && tp.takePhase !== 'idle');
}
export function syncScreenBtn(tp: TpCtx): void {
  const { screenBtn } = tp;
  if (screenBtn.hidden) return;
  const mine = tp.takeKind === 'screen';
  const live = mine && (tp.takePhase === 'recording' || tp.takePhase === 'countin');
  const label =
    mine && tp.takePhase === 'saving'
      ? t('Saving the take…')
      : live
        ? t('Stop recording')
        : t('Record screen');
  screenBtn.setAttribute('aria-label', label);
  screenBtn.setAttribute('data-tip', label);
  screenBtn.setAttribute('aria-pressed', live ? 'true' : 'false');
  screenBtn.classList.toggle('is-recording', mine && tp.takePhase === 'recording');
  screenBtn.disabled = tp.takePhase === 'saving' || (!mine && tp.takePhase !== 'idle');
}
export function paintLevel(tp: TpCtx, level: AudioLevel): void {
  const { rec, recFill } = tp;
  // dBFS, not raw amplitude: speech sits around 0.05–0.2 linear, which is invisible
  // on a linear bar. −60 dB → 0, 0 dB → full.
  const db = 20 * Math.log10(Math.max(1e-4, finite(level?.rms, 0)));
  const v = clamp((db + 60) / 60, 0, 1);
  recFill.style.width = `${Math.round(v * 100)}%`;
  rec.classList.toggle('is-hot', !!level?.clipping);
}
/** Silence the composition for the take, in the clock's own vocabulary (see note 2). */
export function muteComposition(tp: TpCtx): void {
  const { canvasEl, takeMuted } = tp;
  for (const el of Array.from(canvasEl.querySelectorAll<HTMLElement>('.lolly-box'))) {
    if (el.getAttribute('data-t-mute') === '1') continue; // authored mute: leave it
    el.setAttribute('data-t-mute', '1');
    takeMuted.add(el);
  }
}
export function restoreComposition(tp: TpCtx): void {
  const { takeMuted } = tp;
  for (const el of takeMuted) {
    try {
      el.removeAttribute('data-t-mute');
    } catch {
      /* detached by a repaint */
    }
  }
  takeMuted.clear();
}
/** Release `n` held meter references (all of them by default). Never releases more
 *  than are held - over-stopping would tear the mic out from under another holder. */
export function stopMeter(tp: TpCtx, n = tp.takeMeterRefs): void {
  const { host } = tp;
  for (let i = Math.min(n, tp.takeMeterRefs); i > 0; i--) {
    tp.takeMeterRefs--;
    try {
      host.recorder?.meter.stop();
    } catch {
      /* already released */
    }
  }
}
/** THE one teardown, whatever ended the take (see note 3). Idempotent. */
export function endTake(tp: TpCtx): void {
  const { rec, recFill, recTime } = tp;
  // Anything still in flight for this take (a meter/session that opens later, a save
  // that has not committed) is now stale and must not touch the panel again.
  tp.takeSeq++;
  if (tp.takeTimer) {
    cancelAnimationFrame(tp.takeTimer);
    tp.takeTimer = 0;
  }
  if (tp.takeCountTimer) {
    clearTimeout(tp.takeCountTimer);
    tp.takeCountTimer = 0;
  }
  try {
    tp.takeLevelOff?.();
  } catch {
    /* already unsubscribed */
  }
  tp.takeLevelOff = null;
  stopMeter(tp);
  const session = tp.takeSession;
  tp.takeSession = null;
  // Only reachable on an abort path - stopTake() has already consumed its session.
  if (session) {
    try {
      session.cancel();
    } catch {
      /* already released */
    }
  }
  restoreComposition(tp);
  hideCamView(tp);
  tp.takeReplaceId = '';
  tp.takeWarned = false;
  recFill.style.width = '0%';
  recTime.textContent = '';
  rec.hidden = true;
  rec.classList.remove('is-countin', 'is-hot');
  setPhase(tp, 'idle');
  tp.takeKind = 'audio';
  syncMicBtn(tp);
}
/** Abandon a take without keeping any audio. */
export function cancelTake(tp: TpCtx, note?: string): void {
  const { clock } = tp;
  if (tp.takePhase === 'idle') return;
  const wasLive = tp.takePhase === 'recording';
  endTake(tp);
  if (wasLive && !tp.disposed) {
    clock.pause();
    tp.playback.syncPlayBtn();
  }
  if (note) setNote(tp, note);
  if (wasLive) announce(t('Recording cancelled'));
}
export function failTake(tp: TpCtx, err: unknown): void {
  const { host } = tp;
  const name = (err as { name?: string } | null)?.name || '';
  const video = tp.takeKind === 'video';
  const screen = tp.takeKind === 'screen';
  endTake(tp);
  const msg =
    name === 'NotAllowedError' || name === 'SecurityError'
      ? screen
        ? t('Screen sharing was cancelled.')
        : video
          ? t('Camera blocked. Allow camera and microphone access for this site, then try again.')
          : t('Microphone blocked. Allow microphone access for this site, then try again.')
      : name === 'NotFoundError'
        ? screen
          ? t('No screen was available to capture.')
          : video
            ? t('No camera found.')
            : t('No microphone found.')
        : t('Could not start recording.');
  setNote(tp, msg);
  announce(msg, { assertive: true });
  host.log?.('warn', `timeline voiceover: ${name || String(err)}`);
}
/** The 3-2-1 beat. Resolves early if the take was abandoned while it ran. */
export function countIn(tp: TpCtx): Promise<void> {
  return new Promise<void>((resolve) => {
    let n = 3;
    const step = (): void => {
    const { recTime } = tp;
      tp.takeCountTimer = 0;
      if (tp.edit.phase() !== 'countin' || tp.disposed) {
        resolve();
        return;
      }
      if (n <= 0) {
        resolve();
        return;
      }
      recTime.textContent = String(n);
      n--;
      try {
        playSfx('click');
      } catch {
        /* audio layer muted or unavailable */
      }
      tp.takeCountTimer = setTimeout(step, Math.max(0, TAKE_TIMING.countInMs)) as unknown as number;
    };
    step();
  });
}
/** The elapsed clock, the cap, and the mute re-assertion - one rAF loop. */
export function tickTake(tp: TpCtx): void {
  const { recTime } = tp;
  tp.takeTimer = 0;
  if (tp.edit.phase() !== 'recording' || tp.disposed) return;
  const el = tp.edit.now() - tp.takeStartedAt;
  recTime.textContent = fmtTime(el / 1000);
  const left = tp.edit.takeMaxMs() - el;
  if (!tp.takeWarned && left <= TAKE_TIMING.warnMs) {
    tp.takeWarned = true;
    announce(t('Recording stops in 5 seconds.'), { assertive: true });
  }
  if (el >= tp.edit.takeMaxMs()) {
    void stopTake(tp);
    return;
  }
  // A repaint mid-take mints fresh box elements, which arrive unmuted. Re-silence
  // them a few times a second rather than every frame - this walks the canvas.
  if (el - tp.lastMuteAt > 250) {
    tp.lastMuteAt = el;
    muteComposition(tp);
  }
  tp.takeTimer = requestAnimationFrame(tp.recording.tickTake);
}
export async function startTake(tp: TpCtx, kind: TakeKind = 'audio'): Promise<void> {
  const { cfg, clock, getBoxes, host, opts, rec, recTime, selection } = tp;
  if (tp.takePhase !== 'idle' || tp.disposed || !tp.open) return;
  const recorder = host.recorder;
  if (!recorder) return;
  tp.takeKind = kind;
  // This take's identity for the rest of the function. `stale()` is the ONLY correct
  // post-await guard: a continuation that fails it belongs to an abandoned take and
  // must clean up only what IT acquired - never call endTake(), which would tear down
  // whichever take is live now.
  const seq = ++tp.takeSeq;
  const stale = (): boolean => seq !== tp.takeSeq || tp.disposed;
  // A re-take is decided BEFORE anything opens: exactly one selected box, and it must
  // already hold a take of ours. Anything else inserts a new box.
  const sel = selection.get();
  // A clip is never overwritten: only a voiceover re-takes over a selected take.
  tp.takeReplaceId =
    kind === 'audio' && sel.length === 1 && sel[0] && isTakeBox(tp, sel[0]) ? sel[0] : '';
  setNote(tp, '');
  setPhase(tp, 'countin');
  rec.hidden = false;
  rec.classList.add('is-countin');
  recTime.textContent = '';
  syncMicBtn(tp);
  if (kind === 'video') showCamView(tp);

  // The sound check is where the PERMISSION PROMPT happens, deliberately before the
  // count-in: a denial then costs a click, not a performance. It also gives the user
  // a live level to check before the first beat.
  if (kind !== 'screen') {
    try {
      await recorder.meter.start();
      tp.takeMeterRefs++;
    } catch (err) {
      // A rejected start() took no reference (the meter drops it itself). Only report
      // the failure if this take is still the live one.
      if (!stale()) failTake(tp, err);
      return;
    }
    if (stale()) {
      stopMeter(tp, 1);
      return;
    }
    tp.takeLevelOff = recorder.meter.subscribe(tp.recording.paintLevel);
  }

  // A re-take performs against the same picture as the take it replaces.
  if (tp.takeReplaceId) {
    const rows = getBoxes();
    const i = indexOfId(rows, cfg, tp.takeReplaceId);
    const at = i >= 0 ? boxTiming(rows[i]!, cfg).start : null;
    if (at != null) tp.rows.seekAuthored(at * 1000);
  }
  if (kind === 'screen') {
    setNote(tp, t('Choose a screen, window or browser tab to record.'));
    announce(t('Choose a screen, window or browser tab to record.'));
  } else {
    announce(
      kind === 'video' ? t('Camera live. Counting in.') : t('Microphone live. Counting in.')
    );
    await countIn(tp);
  }
  if (stale()) {
    if (kind !== 'screen') stopMeter(tp, 1);
    return;
  }
  if (tp.edit.phase() !== 'countin') {
    endTake(tp);
    return;
  }

  let session: RecordSession;
  try {
    // A video take asks for the export frame (RecordOpts.frame): the bridge records a
    // canvas of exactly that size, cover-cropped from the camera, and its self-view
    // shows the same picture. The front camera by default - a person recording a
    // message to colleagues faces the screen.
    const size = kind === 'video' ? (opts.frameSize?.() ?? null) : null;
    session = await recorder.record(
      kind === 'screen'
        ? {
            source: 'screen',
            audio: true,
            systemAudio: true,
            video: true,
            format: 'mp4',
            maxMs: TAKE_TIMING.videoMaxMs,
          }
        : kind === 'video'
          ? {
              audio: true,
              video: true,
              maxMs: TAKE_TIMING.videoMaxMs,
              facingMode: 'user',
              ...(size && size.w > 0 && size.h > 0
                ? { frame: { width: Math.round(size.w), height: Math.round(size.h) } }
                : {}),
            }
          : { audio: true, video: false, maxMs: TAKE_TIMING.maxMs }
    );
  } catch (err) {
    if (stale()) {
      if (kind !== 'screen') stopMeter(tp, 1);
      return;
    }
    failTake(tp, err);
    return;
  }
  // Abandoned while the recorder was opening: the session exists, so release it.
  if (stale()) {
    try {
      session.cancel();
    } catch {
      /* already released */
    }
    if (kind !== 'screen') stopMeter(tp, 1);
    return;
  }
  if (tp.edit.phase() !== 'countin') {
    try {
      session.cancel();
    } catch {
      /* already released */
    }
    endTake(tp);
    return;
  }

  tp.takeSession = session;
  setPhase(tp, 'recording');
  rec.classList.remove('is-countin');
  // The raw sound-check stream has done its job; the take's own levels drive the
  // meter from here, so the second microphone reference is released immediately.
  try {
    tp.takeLevelOff?.();
  } catch {
    /* already unsubscribed */
  }
  tp.takeLevelOff = null;
  if (kind !== 'screen') stopMeter(tp, 1); // exactly the one reference this take took, never another holder's
  tp.takeLevelOff = session.subscribe(tp.recording.paintLevel);

  tp.takeStartSec = clock.t() / 1000;
  tp.takeStartedAt = tp.edit.now();
  tp.lastMuteAt = 0;
  muteComposition(tp);
  if (!clock.playing()) {
    clock.play();
    tp.playback.syncPlayBtn();
  }
  syncMicBtn(tp);
  announce(
    kind === 'screen'
      ? t('Screen recording started. Press the screen button again to stop.')
      : kind === 'video'
        ? t('Recording. Press the camera button again to stop.')
        : t('Recording. Press the microphone button again to stop.')
  );
  tickTake(tp);
}
export async function stopTake(tp: TpCtx): Promise<void> {
  const { clock, host, recNote } = tp;
  if (tp.edit.phase() !== 'recording') return;
  const seq = tp.takeSeq;
  const session = tp.takeSession;
  const takeMs = Math.max(0, Math.round(tp.edit.now() - tp.takeStartedAt));
  tp.takeSession = null;
  setPhase(tp, 'saving');
  if (tp.takeTimer) {
    cancelAnimationFrame(tp.takeTimer);
    tp.takeTimer = 0;
  }
  syncMicBtn(tp);
  setNote(tp, t('Saving the take…'));

  let blob: Blob | null = null;
  try {
    blob = session ? await session.stop() : null;
  } catch (err) {
    host.log?.('warn', `timeline voiceover: stop failed - ${String(err)}`);
  }

  // Picture and sound go back to how we found them BEFORE the storage round-trip, so
  // a slow upload never leaves the composition muted and the playhead running.
  restoreComposition(tp);
  if (!tp.disposed) {
    clock.pause();
    tp.playback.syncPlayBtn();
    tp.rows.seekAuthored(tp.takeStartSec * 1000); // rewind to the top of the take, ready to hear it
  }

  try {
    await finishTake(tp, blob, takeMs, seq);
  } catch (err) {
    // Storage-full carries a user-ready message (assets.ts's STORAGE_FULL) and every
    // other upload in the app surfaces it verbatim - swallowing it behind "could not be
    // saved" leaves the user with no reason and no way to make room.
    // A `code` marks the user-ready ones (STORAGE_FULL and the cap errors) - the same
    // test picker.ts's upload handler uses.
    const coded = err as { code?: unknown; message?: string } | null;
    setNote(tp, coded?.code && coded.message ? coded.message : t('The take could not be saved.'));
    host.log?.('warn', `timeline voiceover: save failed - ${String(err)}`);
  } finally {
    // The progress note is transient state, not a result: clear it unless something
    // downstream replaced it with a real message.
    if (recNote.textContent === t('Saving the take…')) setNote(tp, '');
    endTake(tp);
  }
}
export async function finishTake(tp: TpCtx, blob: Blob | null, takeMs: number, seq: number): Promise<void> {
  const { host } = tp;
  if (!blob?.size) {
    setNote(tp, t('That take was empty. Nothing was recorded.'));
    return;
  }
  // MediaRecorder hands back the container it could encode, never necessarily the
  // one asked for, so read the blob rather than assuming.
  const ext: 'mp4' | 'webm' = /mp4|mpeg|m4a/i.test(blob.type || '') ? 'mp4' : 'webm';
  // Lazy, for picker.ts's own reason: it pulls in the picker CSS chunk, and a take is
  // the only thing in this panel that ever needs it.
  const { storeRecordingAsset } = await import('../picker.ts');
  const replaceId = tp.takeReplaceId;
  const prevRef = replaceId ? refOf(tp, replaceId)?.id : undefined;
  const prevId = typeof prevRef === 'string' ? prevRef : undefined;
  const ref = await storeRecordingAsset(
    host as unknown as Parameters<typeof storeRecordingAsset>[0],
    // NO prevId here: storeRecordingAsset deletes the asset it is handed as part of the
    // store, i.e. BEFORE the model is patched. Abandon the save between those two steps
    // (navigate away, close the panel) and the old recording is gone while the box still
    // points at it. The delete happens below, after the commit has arrived.
    blob,
    ext,
    undefined,
    undefined,
    // The measured length, not the blob's - see note 1. This is what becomes
    // `data-audio-dur` and therefore what a trim can clamp against. A camera take
    // is typed VIDEO (the store's default), so the picker's filters and the seq
    // pack read it as a picture with sound.
    tp.takeKind !== 'audio' ? { durationMs: takeMs } : { audio: true, durationMs: takeMs }
  );
  // The take was abandoned while the bytes were being stored (the panel closed, the
  // timeline was toggled off, destroy()). Commit nothing - an audio box arriving in a
  // panel the user has left is an undo step for a take they cancelled - and leave the
  // replaced asset alone. The orphan take is harmless; a deleted one is not.
  if (tp.disposed || seq !== tp.takeSeq) return;
  if (tp.takeKind !== 'audio') {
    emitRecordedClip(tp, ref, takeMs / 1000, tp.takeStartSec);
    return;
  }
  insertTake(tp, ref, takeMs / 1000);
  // Committed. Only now is the superseded recording safe to drop.
  if (replaceId && prevId && prevId !== ref.id && prevId.startsWith('user/recording/')) {
    try {
      await host.assets?._deleteUserAsset?.(prevId);
    } catch {
      /* orphan take is harmless */
    }
  }
}
/**
 * The take ends up on the timeline - ONE commit either way (see note 4).
 *
 * A new take is born from the manifest's audio add-kind seed, placed by `moveOverlay`
 * and sized by `setDuration`, both composed on the intermediate array so the two
 * writers cost one undo step between them. A re-take patches the asset in place and
 * re-fits the length in the same array, and clears `clipIn` - a trim-in measured
 * against the OLD recording points into audio that no longer exists.
 */
export function insertTake(tp: TpCtx, ref: AssetRef, durSec: number): void {
  const { cfg, getBoxes } = tp;
  const field = assetFieldName(tp);
  const rows = getBoxes();
  if (tp.takeReplaceId && indexOfId(rows, cfg, tp.takeReplaceId) >= 0) {
    const id = tp.takeReplaceId;
    const patched = tp.helpers.patchBox(rows, id, {
      [field]: ref as unknown as Box[string],
      [cfg.clipInField]: 0,
    });
    tp.helpers.write(setDuration(patched, cfg, id, durSec, durSec, tp.helpers.mediaDur));
    tp.focusedId = id;
    tp.rows.selectAndReveal([id]);
    announce(t('Take replaced'));
    return;
  }
  insertAudioBoxAt(tp, ref, durSec, tp.takeStartSec);
}
/**
 * One audio clip ends up at one time - the SINGLE inserter behind both a finished
 * mic take and a saved scripted voiceover, so the two can never drift: born from
 * the manifest's audio seed, placed by `moveOverlay`, sized by `setDuration`,
 * one commit, one undo step.
 */
/**
 * A camera take reaches the canvas through the tl-add seam WITH its asset: the canvas owns box
 * geometry (the clip fills the active artboard, cover-fit, in the frame's own
 * coordinates), so the panel names the clip kind, the time and the media and
 * free-canvas's create pipeline does the rest in one commit. The panel never
 * invents a box's geometry - the same rule the plus menu keeps.
 */
export function emitRecordedClip(tp: TpCtx, ref: AssetRef, durSec: number, atSec: number): void {
  const { root } = tp;
  const kind = clipKind(tp);
  if (!kind) return;
  const detail: TimelineAddDetail = {
    kind: kind.id,
    atMs: Math.round(atSec * 1000),
    asset: ref,
    durSec,
  };
  root.dispatchEvent(new CustomEvent('tl-add', { bubbles: true, detail }));
  announce(t('Video added to the timeline'));
}
export function insertAudioBoxAt(tp: TpCtx, ref: AssetRef, durSec: number, atSec: number): string {
  const { cfg, getBoxes } = tp;
  const rows = getBoxes();
  const id = tp.edit.mintId();
  const box: Box = {
    ...(audioKind(tp)?.seed as Box | undefined),
    [cfg.idField]: id,
    [assetFieldName(tp)]: ref as unknown as Box[string],
  };
  const placed = moveOverlay([...rows, box], cfg, id, atSec);
  tp.helpers.write(setDuration(placed, cfg, id, durSec, durSec, tp.helpers.mediaDur));
  tp.focusedId = id;
  tp.rows.selectAndReveal([id]);
  announce(t('Voiceover added to the timeline'));
  return id;
}
export async function openScriptVoiceover(tp: TpCtx): Promise<void> {
  const { clock, host, scriptBtn, transcriptBtn } = tp;
  if (tp.scriptBusy || !canScriptVoiceover(tp)) return;
  tp.scriptBusy = true;
  scriptBtn.disabled = true;
  const atSec = clock.t() / 1000;
  try {
    // Lazy for the picker's reason: the dialog is its own CSS chunk, and this
    // button is the only thing in the panel that ever needs it.
    const { openScriptAudioDialog } = await import('../script-audio.ts');
    const ref = await openScriptAudioDialog(
      host as unknown as Parameters<typeof openScriptAudioDialog>[0]
    );
    if (tp.disposed || !ref) return;
    // The measured clip length rides the record (script-audio's buildTtsRecord
    // stamps `meta.durationMs`) - the same field a mic take stores, and for the
    // same reason: it is what a trim can clamp against.
    const ms = Number((ref.meta as Record<string, unknown> | undefined)?.durationMs);
    const clipId = insertAudioBoxAt(tp, 
      ref,
      Number.isFinite(ms) && ms > 0 ? ms / 1000 : DEFAULT_CLIP_S,
      atSec
    );
    // The scripted clip carries its own exact word timings (meta.tts.words), so
    // the spoken-word text panel opens instantly - "TTS in, text editor out" is the
    // plans/174 entry point, and Esc dismisses it for anyone who just wanted audio.
    if (!transcriptBtn.hidden) void tp.subtitles.openTranscript(clipId);
  } catch (err) {
    host.log?.('warn', `timeline scripted voiceover failed - ${String(err)}`);
  } finally {
    tp.scriptBusy = false;
    scriptBtn.disabled = false;
  }
}
export function recordingOps(tp: TpCtx) {
  return {
    audioKind: bindOp(tp, audioKind),
    canRecordVoiceover: bindOp(tp, canRecordVoiceover),
    canScriptVoiceover: bindOp(tp, canScriptVoiceover),
    clipKind: bindOp(tp, clipKind),
    canRecordVideo: bindOp(tp, canRecordVideo),
    canRecordScreen: bindOp(tp, canRecordScreen),
    showCamView: bindOp(tp, showCamView),
    hideCamView: bindOp(tp, hideCamView),
    assetFieldName: bindOp(tp, assetFieldName),
    refOf: bindOp(tp, refOf),
    isTakeBox: bindOp(tp, isTakeBox),
    setNote: bindOp(tp, setNote),
    setPhase: bindOp(tp, setPhase),
    syncMicBtn: bindOp(tp, syncMicBtn),
    syncCamBtn: bindOp(tp, syncCamBtn),
    syncScreenBtn: bindOp(tp, syncScreenBtn),
    paintLevel: bindOp(tp, paintLevel),
    muteComposition: bindOp(tp, muteComposition),
    restoreComposition: bindOp(tp, restoreComposition),
    stopMeter: bindOp(tp, stopMeter),
    endTake: bindOp(tp, endTake),
    cancelTake: bindOp(tp, cancelTake),
    failTake: bindOp(tp, failTake),
    countIn: bindOp(tp, countIn),
    tickTake: bindOp(tp, tickTake),
    startTake: bindOp(tp, startTake),
    stopTake: bindOp(tp, stopTake),
    finishTake: bindOp(tp, finishTake),
    insertTake: bindOp(tp, insertTake),
    emitRecordedClip: bindOp(tp, emitRecordedClip),
    insertAudioBoxAt: bindOp(tp, insertAudioBoxAt),
    openScriptVoiceover: bindOp(tp, openScriptVoiceover),
  };
}
