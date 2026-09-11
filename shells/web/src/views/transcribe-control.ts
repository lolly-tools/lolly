// SPDX-License-Identifier: MPL-2.0
/**
 * Transcribe control (engine v1.150, `render.transcribe`) - the whole
 * speech-to-text affordance from one manifest declaration, so no tool ever
 * builds its own. Sibling of record-control.ts: extracted from tool.ts, closing
 * over nothing but its parameter object.
 *
 * The declaration names an audio/video input to listen to and a text input to
 * write into; everything between them is shell work, and all of it is the SAME
 * code path the timeline panel's "Generate subtitles" uses - the shared consent
 * sheet + background job (lib/stt-job.ts), the engine's cue grouper
 * (lib/caption-format.ts), and the two instant rungs of the timing ladder
 * (a TTS clip's own alignment, then a transcript an earlier run already paid
 * for). A clip transcribed once is never paid for twice.
 *
 * Two rules this control keeps:
 *   - ONE undoable write. The cues reach the target input through a single
 *     `runtime.setInput`, which in a mounted tool is the history-recording
 *     wrapper - so a transcription is one Ctrl+Z, not a hundred.
 *   - NEVER invent words. An empty transcript writes an empty value and says
 *     so; the model is not asked again for a better-sounding answer.
 */
import { announce } from '../a11y.ts';
import { t } from '../i18n.ts';
import { formatCaptions } from '../lib/caption-format.ts';
import { openTranscribeConsent, stashedTranscript, transcriptKey, type SttJobHost } from '../lib/stt-job.ts';
import { transcriptWordsOf, ttsWordsOf } from './timeline-captions.ts';
import type { AssetRef, SpeechWordTiming } from '@lolly-tools/core/host-v1';
import type { ToolRenderSpec } from '../../../../engine/src/loader.js';

/** `render.transcribe` - the manifest's speech-to-text declaration. */
export type TranscribeSpec = NonNullable<ToolRenderSpec['transcribe']>;

/** Just what this control drives: the input model, the one write, and the
 *  change stream the `auto` mode listens to. */
export interface TranscribeRuntime {
  getModel(): Array<{ id: string; value: unknown }>;
  setInput(id: string, value: never): Promise<unknown> | unknown;
  subscribe(fn: () => void): () => void;
}

/** The host slice: the speech bridge and the stash/persist rungs the job needs,
 *  plus the asset read the ladder uses and a log. */
export interface TranscribeHost extends SttJobHost {
  assets?: SttJobHost['assets'];
}

export interface TranscribeControlDeps {
  /** The already-mounted button (tool.ts renders it in the sidebar utils row). */
  btn: HTMLButtonElement;
  runtime: TranscribeRuntime;
  host: TranscribeHost;
  spec: TranscribeSpec;
  /** Flags the session unsaved, exactly as any other edit does. */
  markSessionDirty?: () => void;
}

/**
 * Wire the button. Returns an unsubscribe for the model watch, so a caller that
 * outlives the tool can drop it (tool.ts's teardown replaces the whole view, so
 * it ignores the handle).
 */
export function setupTranscribeControl({ btn, runtime, host, spec, markSessionDirty }: TranscribeControlDeps): () => void {
  let running = false;

  /** The source input's value as something host.speech can read, or null. */
  const sourceOf = (): AssetRef | string | null => {
    const v = runtime.getModel().find((i) => i.id === spec.source)?.value;
    if (!v) return null;
    if (typeof v === 'string') return v.trim() || null;
    if (typeof v !== 'object') return null;
    const ref = v as AssetRef;
    return (typeof ref.url === 'string' && ref.url) || (typeof ref.id === 'string' && ref.id) ? ref : null;
  };

  const sync = (): void => {
    const has = !!sourceOf();
    btn.disabled = running || !has;
    btn.title = running
      ? t('Transcribing…')
      : has ? t('Write what is said into the text field') : t('Add a clip first');
  };
  sync();

  const write = async (words: readonly SpeechWordTiming[], granularity: 'word' | 'segment'): Promise<boolean> => {
    const text = formatCaptions({ words, granularity }, spec.format ?? 'srt');
    await runtime.setInput(spec.target, text as never);
    markSessionDirty?.();
    announce(text ? t('Captions written from the clip.') : t('No speech was found to caption.'));
    return true;   // consumed either way - an empty answer was told to the user
  };

  /** A transcript an earlier run already paid for: the clip's own record (a TTS
   *  alignment first, exact by construction), then the live store, then this
   *  session's stash. Null means the model has to listen. */
  const known = async (src: AssetRef | string, assetId: string): Promise<SpeechWordTiming[] | null> => {
    const meta = typeof src === 'object' ? src.meta : undefined;
    const stored = ttsWordsOf(meta) ?? transcriptWordsOf(meta);
    if (stored) return stored;
    if (assetId && host.assets?.get) {
      try {
        const live = await host.assets.get(assetId);
        const fromStore = ttsWordsOf(live?.meta) ?? transcriptWordsOf(live?.meta);
        if (fromStore) return fromStore;
      } catch { /* unreadable record - fall through to the model */ }
    }
    return stashedTranscript(assetId, transcriptKey(src));
  };

  const run = async (): Promise<void> => {
    const src = sourceOf();
    if (running || !src) return;
    running = true;
    sync();
    let handedOver = false;
    try {
      const assetId = typeof src === 'object' && typeof src.id === 'string' ? src.id : '';
      const cached = await known(src, assetId);
      // 'word' for every cached rung, because none of them records what one entry
      // spanned: a TTS alignment is word- or sentence-granular by construction,
      // and neither the stash nor the persisted note carries the transcript's
      // granularity. Safe rather than lucky: the grouper only ever JOINS entries,
      // never splits one, and it joins only inside 42 characters AND 5 seconds -
      // which no sentence (it closes the cue on its own punctuation) and no
      // whisper segment (one per ~25 s chunk) can satisfy. Widen either ceiling,
      // or file a shorter segment, and the granularity has to be carried instead.
      if (cached) { await write(cached, 'word'); return; }
      await openTranscribeConsent(host, { src, ...(assetId ? { assetId } : {}), title: t('Transcribing') }, {
        onComplete: (words, info) => { void write(words, info.granularity); return true; },
        onError: (err) => host.log?.('warn', `transcribe failed - ${String(err)}`),
        // Both release the guard: onSettled once a job exists, onDismiss when the
        // sheet closed without starting one.
        onSettled: () => { running = false; sync(); autoCheck(); },
        onDismiss: () => { running = false; sync(); autoCheck(); },
      });
      handedOver = true;   // the sheet, then the job, owns the guard from here
    } catch (err) {
      host.log?.('warn', `transcribe failed - ${String(err)}`);
    } finally {
      if (!handedOver) { running = false; sync(); }
    }
  };

  btn.addEventListener('click', () => { void run(); });

  /**
   * `auto`: a freshly recorded or freshly picked clip transcribes with no click
   * while the named boolean input is on. Keyed off the SOURCE VALUE changing, not
   * off the recorder, so a take and an upload behave the same - and a value
   * already seen this mount never re-runs (a repaint is not a new clip).
   *
   * A change arriving WHILE a run is in flight is not consumed - `lastKey` stays
   * put, so the new clip is still pending when the run settles, which is why both
   * terminal callbacks above call back in here. Swapping the clip while the
   * previous job works used to burn the change against a guard that rejected it,
   * and that clip then never transcribed at all.
   */
  let lastKey = transcriptKey(sourceOf());
  const autoCheck = (): void => {
    if (!spec.auto || running) return;
    const key = transcriptKey(sourceOf());
    if (key === lastKey) return;
    lastKey = key;
    if (!key) return;
    if (runtime.getModel().find((i) => i.id === spec.auto)?.value !== true) return;
    void run();
  };

  return runtime.subscribe(() => { sync(); autoCheck(); });
}
