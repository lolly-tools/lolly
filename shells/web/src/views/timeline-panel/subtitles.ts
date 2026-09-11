// SPDX-License-Identifier: MPL-2.0
/**
 * timeline-panel: subtitles and spoken-word texts - generate, apply, the speech-to-text sheet.
 *
 * Every function takes the shared `tp: TpCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `tp.<module>.<fn>`. Extracted verbatim
 * from initTimelinePanel() by scripts/split-closure.ts.
 */
import { t } from '../../i18n.ts';
import { announce } from '../../a11y.ts';
import { mountModal } from '../../components/modal.ts';
import { boxTiming, indexOfId } from '../timeline-math.ts';
import type { Box } from '../timeline-math.ts';
import { groupWordsToCues } from '../../../../../engine/src/captions.ts';
import { captionGroup, cueSpansOnTimeline, transcriptWordsOf, ttsWordsOf } from '../timeline-captions.ts';
import { openTranscriptPanel } from '../transcript-panel.ts';
import type { TranscriptTtsMeta } from '../transcript-panel.ts';
import { startTranscribeJob, stashedTranscript } from '../../lib/stt-job.ts';
import { fmtBytes } from '../../lib/format.ts';
import type { AssetRef, SpeechWordTiming } from '@lolly-tools/core/host-v1';
import type { TakeKind, TimelineAddKind } from './shared.ts';
import { bindOp, type TpCtx } from './context.ts';

// ── generated subtitles (plans/41-tts-stt-programme.md section 5) ─────────────────────
//
// Timing-source ladder, best first: the asset's own `meta.tts.words` (a TTS
// clip aligns itself - exact by construction, no download, no wait), then a
// spoken-word text an earlier run already paid for (`meta.spoken-word text` on the clip's
// own record, or this session's in-memory stash - both lib/stt-job.ts), else
// on-device Whisper via `host.speech.transcribe` (v1.99, its own one-time
// model download behind its own consent sheet). No rung reachable → the menu
// item is simply absent. Words become cues through the ENGINE's grouper and
// cues become ordinary overlay text boxes - editable, trimmable, deletable
// like anything else on the timeline, never a burned-in afterthought. The
// whole set carries `group = captions:<source id>`, which is what lets a
// re-run REPLACE the previous set (idempotent, never duplicating) and what the
// panel's lane collapse reads to keep 200 cues off 200 lane rows.
//
// The Whisper rung is a BACKGROUND JOB (lib/stt-job.ts, the WP-F pattern): the
// sheet takes consent and CLOSES, the global toast owns progress and cancel,
// and the caption boxes land here when it finishes. A spoken-word text that finishes
// with the panel gone is stashed and written onto the clip's own record rather
// than thrown away - see openTranscribeSheet and applySubtitles.

/** The manifest's text add-kind - the seed a caption cue is born from. */
export const textKind = (tp: TpCtx): TimelineAddKind | undefined => { const { addKinds } = tp; return addKinds.find((k) => k.id === 'text'); };
export const endSubtitles = (tp: TpCtx, id: string): void => {
  const { subtitlesPending } = tp;
  subtitlesPending.delete(id);
};
/**
 * Whether Generate subtitles can be OFFERED for this box: the tool must have a
 * text vocabulary, a group field to own the set with, audio to read - and at
 * least one rung of the timing ladder must be reachable. Sync, because the
 * context menu renders synchronously: the stored ref's meta answers the TTS
 * and spoken-word text rungs without a round-trip, the stash is a map lookup, and
 * the speech-to-text rung is a sync probe.
 */
export function canGenerateSubtitles(tp: TpCtx, id: string): boolean {
  const { cfg, getBoxes, host, opts } = tp;
  if (!cfg.groupField || !opts.textField || !textKind(tp)) return false;
  // A struck box's window IS the cut media - captioning it would place exactly
  // the words the user removed (plan 174 section 5.5 export-leak guard).
  const rows = getBoxes();
  if (tp.helpers.boxIgnored(rows[indexOfId(rows, cfg, id)])) return false;
  const media = tp.helpers.mediaOf(id);
  if (media.kind !== 'audio' && media.kind !== 'video') return false;
  const ref = tp.recording.refOf(id);
  if (ttsWordsOf(ref?.meta) || transcriptWordsOf(ref?.meta)) return true;
  if (stashedTranscript(typeof ref?.id === 'string' ? ref.id : '', media.url || '')) return true;
  try {
    return host.speech?.transcribeAvailable?.() === true;
  } catch {
    return false;
  }
}
/**
 * Walk the INSTANT rungs of the ladder for one box - the ones that cost
 * nothing - and, when none of them answers, report the source a speech-to-text
 * would read plus the asset id its result should be filed against.
 */
export async function subtitleSource(tp: TpCtx, 
  id: string
): Promise<{ words: SpeechWordTiming[] | null; src: AssetRef | string | null; assetId: string }> {
  const { host } = tp;
  const ref = tp.recording.refOf(id);
  const refId = typeof ref?.id === 'string' ? ref.id : '';
  const url = tp.helpers.mediaOf(id).url || '';
  const stored = ttsWordsOf(ref?.meta) ?? transcriptWordsOf(ref?.meta);
  if (stored) return { words: stored, src: null, assetId: refId };
  // The model may persist a slim ref; the store still holds the full record.
  let live: AssetRef | null = null;
  if (refId && host.assets?.get) {
    try {
      live = await host.assets.get(refId);
    } catch {
      /* fall through to Whisper */
    }
    const fromStore = ttsWordsOf(live?.meta) ?? transcriptWordsOf(live?.meta);
    if (fromStore) return { words: fromStore, src: null, assetId: refId };
  }
  // This session's stash: a run that finished with nobody watching, on a source
  // with no user-asset record of its own to annotate (a catalog clip, a URL).
  const stashed = stashedTranscript(refId, url);
  if (stashed) return { words: stashed, src: null, assetId: refId };
  // Freshest source wins: a live ref (fresh object URL), else the stored ref,
  // else the URL the canvas is already playing. All three are AudioSources.
  const src: AssetRef | string | null = live ?? (ref as AssetRef | null) ?? (url || null);
  return { words: null, src, assetId: refId };
}
/**
 * Open the right-docked Transcript panel for a clip (plans/174). Reuses the
 * subtitle timing ladder: stored TTS/Whisper words open the panel directly; a
 * clip with none is offered the same on-device speech-to-text the captions use,
 * after which the user re-opens the panel. The panel edits through THIS module's
 * own `write`/`getBoxes`/`clock`, so its cuts are ordinary undo-aware box writes.
 */
export async function openTranscript(tp: TpCtx, id?: string): Promise<void> {
  const { selection } = tp;
  const clipId = id || selection.get()[0] || '';
  if (!clipId) return;
  const { words, src, assetId } = await subtitleSource(tp, clipId);
  // No spoken-word text yet: the SAME consent sheet + background job as Generate
  // subtitles, but carrying the caller's INTENT - its completion must land in
  // the editor the user asked for, not drop caption boxes they did not.
  if (!words) {
    if (src) openTranscribeSheet(tp, clipId, src, assetId, 'transcript');
    return;
  }
  showTranscript(tp, clipId, words, assetId);
}
/**
 * Can this clip be spoken again in place? It needs an id of its own to be
 * rewritten under, the speech bridge that would speak the changed lines, and
 * the user-asset store's in-place bytes swap. Without all three, Edit script
 * still edits and Regenerate is simply not offered (the panel's own rule).
 */
export function canRegenerateClip(tp: TpCtx, assetId: string): boolean {
  const { host } = tp;
  if (!assetId || !host.speech) return false;
  const assets = host.assets as { _replaceUserAssetBytes?: unknown } | undefined;
  return typeof assets?._replaceUserAssetBytes === 'function';
}
/** Mount the flowing-text editor over these words - openTranscript's tail, and
 *  where a spoken-word text-intent speech-to-text delivers its result. */
export function showTranscript(tp: TpCtx, clipId: string, words: SpeechWordTiming[], assetId: string): void {
  const { cfg, getBoxes, host, runtime } = tp;
  const meta = tp.recording.refOf(clipId)?.meta as { tts?: TranscriptTtsMeta } | undefined;
  openTranscriptPanel({
    cfg,
    words,
    assetId,
    sourceId: clipId,
    assetField: tp.recording.assetFieldName(),
    getBoxes,
    write: tp.helpers.write,
    // What Lolly spoke this clip with, so Edit script can diff against the
    // script it was made from rather than guessing one from the words.
    tts: meta?.tts,
    // The synthesis half of Regenerate (plans/181 section 5.2): speak only the
    // lines that changed, splice them into the clip at the silence between
    // sentences, and rewrite it under its own id. Lazy for the Script-audio
    // reason - the whole speech path is a chunk nothing else in the panel needs.
    ...(canRegenerateClip(tp, assetId)
      ? {
          regenerate: async (req) => {
            const { regenerateTtsClipAsJob } = await import('../../lib/tts-regenerate.ts');
            return regenerateTtsClipAsJob(
              host as unknown as Parameters<typeof regenerateTtsClipAsJob>[0],
              {
                assetId,
                script: req.script,
                baseScript: req.baseScript,
                keepPrevious: req.keepPrevious,
                onProgress: req.onProgress,
              }
            );
          },
        }
      : {}),
    // A regenerated clip's captions have to follow its new words. Only when
    // this source ALREADY has caption boxes: applySubtitles replaces the
    // group, so running it on a document with none would add a set nobody
    // asked for.
    reapplySubtitles: (next) => {
      const groupField = cfg.groupField;
      const gid = captionGroup(clipId);
      if (!groupField || !getBoxes().some((b) => String(b?.[groupField] ?? '') === gid)) return;
      applySubtitles(tp, clipId, next);
    },
    // The panel's rows are in AUTHORED time (mapped off the box starts), so its seek and
    // its read-along tick go through the same authored<->clock map as the ruler.
    seek: (ms) => tp.rows.seekAuthored(ms),
    subscribeTick: (cb) => { const { clock } = tp; return clock.onTick((raw) => cb(tp.rows.toAuthoredMs(raw))); },
    subscribeModel: (cb) => {
      const off = runtime.subscribe(cb);
      return () => {
        off?.();
      };
    },
  });
}
/**
 * The consent sheet for the speech-to-text rung: what the run does, what it
 * downloads once, and one Go. Go ENQUEUES the background job and closes.
 *
 * Closing this sheet ABORTS NOTHING, and that is the whole point of the
 * conversion. Before Go there is nothing to abort; after Go the run belongs to
 * the job, whose ✕ in the global toast is the one honest cancel. The version
 * this replaced aborted on every exit path, so an Escape - or a stray backdrop
 * click - destroyed a ~77 MB one-time model download and every minute of
 * inference behind it.
 */
export function openTranscribeSheet(tp: TpCtx, 
  id: string,
  src: AssetRef | string,
  assetId: string,
  intent: 'subtitles' | 'transcript' = 'subtitles'
): void {
  const { host } = tp;
  const sp = host.speech;
  if (!sp) {
    endSubtitles(tp, id);
    return;
  }
  let enqueued = false;
  let bytes = 0;
  try {
    bytes = sp.transcribeModelBytes();
  } catch {
    /* consent line just omits the size */
  }
  // The sheet says what the RUN will do for the intent that opened it: the
  // Edit-spoken-word text door promises the editor, not caption boxes.
  const title = intent === 'transcript' ? t('Edit transcript') : t('Generate subtitles');
  const note =
    intent === 'transcript'
      ? t(
          'Listens to this clip on this device and opens its transcript for editing. Nothing is uploaded.'
        )
      : t('Listens to this clip on this device and writes timed captions. Nothing is uploaded.');
  const html = `<form method="dialog" class="tl-junction tl-stt">
      <h2 class="tl-junction-title">${title}</h2>
      <p class="tl-stt-note">${note}</p>
      <p class="tl-stt-note tl-stt-note-dl" data-stt-dl hidden></p>
      <p class="tl-stt-note">${t('It runs in the background, so you can close this and keep working.')}</p>
      <div class="tl-junction-actions">
        <button type="button" class="btn" data-act="cancel">${t('Cancel')}</button>
        <button type="button" class="btn btn--primary" data-act="go">${t('Generate')}</button>
      </div>
    </form>`;
  const modal = mountModal<void>(html, {
    className: 'modal tl-junction-modal',
    ariaLabel: title,
    initialFocus: (el) => el.querySelector<HTMLElement>('[data-act="go"]'),
    // Only the not-yet-enqueued close releases the guard; once the job exists it
    // owns the release, through onSettled.
    onClose: () => {
      if (!enqueued) endSubtitles(tp, id);
    },
  });
  const dlNote = modal.el.querySelector<HTMLElement>('[data-stt-dl]');
  const goBtn = modal.el.querySelector<HTMLButtonElement>('[data-act="go"]');
  // The one-time download is the consent-worthy part, so say so up front -
  // but only when it is actually owed (the probe is async, the line arrives).
  void sp
    .transcribeCached?.()
    .then((cached) => {
      if (!cached && dlNote) {
        dlNote.textContent =
          bytes > 0
            ? t(
                'The first run downloads the speech model once ({size}). It stays on this device.',
                { size: fmtBytes(bytes) }
              )
            : t('The first run downloads the speech model once. It stays on this device.');
        dlNote.hidden = false;
      }
    })
    .catch(() => {
      /* the probe failing just means no size line */
    });
  goBtn?.addEventListener('click', () => {
    if (enqueued) return;
    enqueued = true;
    startTranscribeJob(
      host,
      {
        src,
        ...(assetId ? { assetId } : {}),
        title: intent === 'transcript' ? t('Transcribing…') : t('Generating subtitles'),
      },
      {
        // The completion goes where the INTENT pointed: the Edit-spoken-word text door
        // opens the flowing-text editor (the bug this fixes - it used to drop
        // caption boxes and never show the editor); the subtitles door places
        // captions as ever. Either way the job already stashed the words, so a
        // torn-down panel just means the next click opens instantly.
        onComplete: (words) => {
          if (intent !== 'transcript') return applySubtitles(tp, id, words);
          if (tp.disposed || !words.length) return;
          showTranscript(tp, id, [...words], assetId);
          return true; // handled here - the job's own announce would say "captions"
        },
        onError: (err) => {
          host.log?.('warn', `timeline subtitles: transcription failed - ${String(err)}`);
        },
        onSettled: () => endSubtitles(tp, id),
      }
    );
    modal.close();
    announce(
      intent === 'transcript'
        ? t('Transcribing in the background. The editor opens when it finishes.')
        : t('Generating subtitles in the background. You can keep working.')
    );
  });
  modal.el
    .querySelector<HTMLElement>('[data-act="cancel"]')
    ?.addEventListener('click', () => modal.close());
}
/**
 * Place (or REplace) the caption set for one audio/video box from a finished
 * word list. One commit: the previous `captions:<id>` group goes and the new
 * cues land in its place - run it twice and you have one set, not two.
 *
 * Returns whether the words were CONSUMED. False means there was nobody to
 * consume them - the panel has been destroyed, the tool has no text
 * vocabulary, or the source clip is gone - which is how lib/stt-job.ts knows
 * to announce where the spoken-word text is instead of assuming it arrived.
 */
export function applySubtitles(tp: TpCtx, id: string, words: readonly SpeechWordTiming[]): boolean {
  const { cfg, getBoxes, opts } = tp;
  const groupField = cfg.groupField;
  const textField = opts.textField;
  const seedKind = textKind(tp);
  if (tp.disposed || !groupField || !textField || !seedKind) return false;
  // The words may have arrived minutes later; re-read the model and make sure
  // the source survived.
  const rows = getBoxes();
  const i = indexOfId(rows, cfg, id);
  if (i < 0) return false;
  // Struck while the speech-to-text ran: not consumed, so the job files the
  // spoken-word text on the record instead of captioning the cut span (plan 174 section 5.5).
  if (tp.helpers.boxIgnored(rows[i]!)) return false;
  const timing = boxTiming(rows[i]!, cfg);
  const spans = words.length
    ? cueSpansOnTimeline(groupWordsToCues(words), {
        start: timing.start ?? 0,
        dur: tp.rows.span(rows[i]!, tp.rows.durationSec()).dur,
        clipIn: timing.clipIn,
        speed: timing.speed,
      })
    : [];
  // Nothing to place is still an answer, and telling the user is consuming it.
  if (!spans.length) {
    announce(t('No speech was found to caption.'), { assertive: true });
    return true;
  }
  const gid = captionGroup(id);
  const kept = rows.filter((b) => !b || String(b[groupField] ?? '') !== gid);
  // Mint against the SURVIVORS plus what this loop has already minted - mintId
  // reads the live model, which does not include either until the commit arrives.
  const used = new Set(kept.map((b) => String(b?.[cfg.idField] ?? '')));
  let n = used.size + 1;
  const mint = (): string => {
    let next = `b${n}`;
    while (used.has(next)) {
      n++;
      next = `b${n}`;
    }
    used.add(next);
    return next;
  };
  const made: Box[] = spans.map((c) => ({
    ...(seedKind.seed as Box | undefined),
    [cfg.idField]: mint(),
    [textField]: c.text,
    [cfg.laneField]: '', // overlay: a caption rides ABOVE the sequence
    [cfg.startField]: c.start,
    [cfg.durField]: Math.round((c.end - c.start) * 1000) / 1000,
    [cfg.enterField]: 'fade',
    [cfg.exitField]: 'fade',
    [groupField]: gid,
  }));
  tp.helpers.write([...kept, ...made]);
  tp.rows.selectAndReveal([id]);
  announce(
    t('{count} caption boxes added. Each one is editable like any clip.', {
      count: String(made.length),
    })
  );
  return true;
}
/**
 * Generate (or REgenerate) the caption set for one audio/video box: take the
 * cheapest rung of the timing ladder that answers, and only fall through to the
 * consent sheet (and the background speech-to-text behind it) when none does.
 */
export async function generateSubtitles(tp: TpCtx, id: string): Promise<void> {
  const { cfg, host, opts, subtitlesPending } = tp;
  if (!cfg.groupField || !opts.textField || !textKind(tp)) return;
  if (subtitlesPending.has(id)) return;
  subtitlesPending.add(id);
  let handedOver = false;
  try {
    const { words, src, assetId } = await subtitleSource(tp, id);
    if (tp.disposed) return;
    if (words) {
      applySubtitles(tp, id, words);
      return;
    }
    let sttOk = false;
    try {
      sttOk = host.speech?.transcribeAvailable?.() === true;
    } catch {
      /* stays false */
    }
    if (!sttOk || !src) return;
    openTranscribeSheet(tp, id, src, assetId);
    handedOver = true; // the sheet, then the job, owns the guard from here
  } catch (err) {
    host.log?.('warn', `timeline subtitles failed - ${String(err)}`);
  } finally {
    if (!handedOver) endSubtitles(tp, id);
  }
}
/** The button: press to start, press again to stop. */
export function toggleTake(tp: TpCtx, kind: TakeKind = 'audio'): void {
  // The other kind's button is disabled while a take runs (syncMicBtn), so a press
  // that reaches here mid-take belongs to the live kind.
  if (tp.takePhase === 'recording') {
    void tp.recording.stopTake();
    return;
  }
  if (tp.takePhase === 'countin') {
    tp.recording.cancelTake();
    return;
  }
  if (tp.takePhase === 'saving') return;
  void tp.recording.startTake(kind);
}
/**
 * A backgrounded tab STOPS the take rather than dropping it: the clock pauses itself
 * on `visibilitychange`, so the picture the user was performing against is gone -
 * but the audio recorded up to that point is theirs, and losing it silently would be
 * worse than a short take. Nothing keeps running either way.
 */
export function onVisibility(tp: TpCtx): void {
  if (typeof document === 'undefined' || !document.hidden || tp.takePhase === 'idle') return;
  if (tp.takePhase === 'recording') void tp.recording.stopTake();
  else if (tp.takePhase === 'countin')
    tp.recording.cancelTake(t('Recording cancelled: the tab went to the background.'));
}
export function subtitlesOps(tp: TpCtx) {
  return {
    textKind: bindOp(tp, textKind),
    endSubtitles: bindOp(tp, endSubtitles),
    canGenerateSubtitles: bindOp(tp, canGenerateSubtitles),
    subtitleSource: bindOp(tp, subtitleSource),
    openTranscript: bindOp(tp, openTranscript),
    canRegenerateClip: bindOp(tp, canRegenerateClip),
    showTranscript: bindOp(tp, showTranscript),
    openTranscribeSheet: bindOp(tp, openTranscribeSheet),
    applySubtitles: bindOp(tp, applySubtitles),
    generateSubtitles: bindOp(tp, generateSubtitles),
    toggleTake: bindOp(tp, toggleTake),
    onVisibility: bindOp(tp, onVisibility),
  };
}
