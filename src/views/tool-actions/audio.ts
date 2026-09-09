// SPDX-License-Identifier: MPL-2.0
/**
 * actions bar: the tool's audio, captions and preview playback.
 *
 * Every function takes the shared `ta: ActionsCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `ta.<module>.<fn>`. Extracted verbatim
 * from renderActions() by scripts/split-closure.ts.
 */
import { composeSong, cuesToSrt, cuesToVtt, generatedSongSpec } from '@lolly/engine';
import { formatCaptions } from '../../lib/caption-format.ts';
import { pcmToWavBlob } from '../../lib/pcm-wav.ts';
import { stashedTranscript } from '../../lib/stt-job.ts';
import { renderSong } from '../../lib/zzfxm-render.ts';
import { transcriptWordsOf, ttsWordsOf } from '../timeline-captions.ts';
import { isCmykFmt } from './shared.ts';
import type { CaptionText } from './shared.ts';
import { bindOp, type ActionsCtx } from './context.ts';

// The tool's own audio slot (assetType 'audio'), read LIVE from the model so the
// popup always reflects the current sidebar pick. Returns the narrow ref shape
// the bed paths need; null when the slot is empty or the tool has none.
export const toolAudioRef = (ta: ActionsCtx): { id?: string; url?: string; format?: string } | null => {
  const { runtime } = ta;
  const v = runtime.getModel().find((i) => i.type === 'asset' && i.assetType === 'audio')?.value;
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const r = v as { id?: unknown; url?: unknown; format?: unknown };
  const ref = {
    id: typeof r.id === 'string' ? r.id : undefined,
    url: typeof r.url === 'string' ? r.url : undefined,
    format: typeof r.format === 'string' ? r.format : undefined,
  };
  return ref.id || ref.url ? ref : null;
};
// Resolve that slot to a fetchable { url, format }: the asset store when the ref
// has an id (same on-demand fetch+cache the catalog beds use), else the ref's own
// url (a transient upload). Null when nothing is resolvable - export stays silent.
export async function resolveToolAudio(ta: ActionsCtx): Promise<{ url: string; format?: string } | null> {
  const { host } = ta;
  const ref = toolAudioRef(ta);
  if (!ref) return null;
  if (ref.id) {
    try {
      const r = await host.assets.get(ref.id);
      if (r?.url) return { url: r.url, format: r.format };
    } catch {
      /* not in the store (transient ref) - fall back to its own url */
    }
  }
  return ref.url ? { url: ref.url, format: ref.format } : null;
}
// (The old `__tool__` pseudo-entry is gone: a tool with its own audio slot now
// always contributes that audio as the primary track of the two-row card, so
// the select only ever names the optional mix-in bed.)

// WP-F soft captions (plan 153). A cached spoken-word text of the tool's own audio -
// a TTS clip's own alignment, an earlier "Generate subtitles" run persisted on
// the asset record, or this session's stash. Cached words ONLY: this never
// triggers speech-to-text, so an export never blocks on inference; no cached
// spoken-word text ⇒ undefined ⇒ nothing to embed and nothing to ship beside the file.
// Mirrors the timing ladder in views/transcribe-control.ts and its
// 'word'-granularity reasoning (the engine grouper only joins, never splits).
// ponytail: cue times are source-relative; the caller only reads this when the
// clip exports from its head (stageAudioStart 0), since a nonzero in-point would
// desync the cues - map through cueSpansOnTimeline if a tool needs both.
export async function toolTranscriptText(ta: ActionsCtx): Promise<CaptionText | null> {
  const { host } = ta;
  const ref = toolAudioRef(ta);
  if (!ref) return null;
  const assetId = ref.id ?? '';
  let words =
    assetId && host.assets?.get
      ? await host.assets.get(assetId).then(
          (r) => ttsWordsOf(r?.meta) ?? transcriptWordsOf(r?.meta),
          () => null
        )
      : null;
  if (!words) words = stashedTranscript(assetId, ref.url ?? '');
  if (!words?.length) return null;
  const transcript = { words, granularity: 'word' as const };
  const vtt = formatCaptions(transcript, 'vtt');
  return vtt ? { vtt, srt: formatCaptions(transcript, 'srt') } : null;
}
/**
 * The captions of a moving export, serialised once for both the embedded track
 * and the sidecar files (plans/180 section 4). Two rungs, most specific first:
 *
 *   1. the CAPTION BOXES on a timed composition. They are already burned into
 *      the picture, so their own timeline windows are the film's cue times - no
 *      offset to apply and no second pass over the audio;
 *   2. the tool audio's cached spoken-word text (the WP-F ladder above), for a
 *      single-clip tool like the audiogram, which has no timeline to read.
 *
 * Null means there is genuinely nothing to caption - neither option adds a byte.
 */
export async function captionText(ta: ActionsCtx): Promise<CaptionText | null> {
  const { canvasEl } = ta;
  if (canvasEl?.querySelector?.('[data-sequence]')) {
    // The compositor module is large and only a timed composition ever gets here,
    // so it is loaded on demand rather than from the panel's own graph.
    const { stageCaptionCues } = await import('../../bridge/sequence-render.ts');
    const p = ta.video.videoParams();
    const cues = stageCaptionCues(
      canvasEl,
      p.durationUserSet ? { totalMs: p.duration * 1000 } : {}
    );
    if (cues.length) return { vtt: cuesToVtt(cues), srt: cuesToSrt(cues) };
  }
  return ta.formatRules.stageAudioStart() === 0 ? await toolTranscriptText(ta) : null;
} // "seed:targetSec" the cache was rendered for
export const genDur = (ta: ActionsCtx): number => Math.max(8, Math.min(90, ta.video.videoParams().duration));
export async function generatedWavUrl(ta: ActionsCtx, targetSec: number): Promise<string> {
  const key = `${ta.genSeed}:${targetSec}`;
  if (ta.genWavUrl && ta.genWavKey === key) return ta.genWavUrl;
  const pcm = await renderSong(composeSong(generatedSongSpec(ta.genSeed, targetSec)));
  if (ta.genWavUrl) URL.revokeObjectURL(ta.genWavUrl);
  ta.genWavUrl = URL.createObjectURL(pcmToWavBlob(pcm));
  ta.genWavKey = key;
  return ta.genWavUrl;
} // asset id currently loaded into previewAudio
export const setAudioPreviewPlaying = (ta: ActionsCtx, playing: boolean): void => {
  const { ICON_PAUSE, ICON_PLAY, audioPreviewBtn } = ta;
  if (!audioPreviewBtn) return;
  audioPreviewBtn.innerHTML = playing ? ICON_PAUSE : ICON_PLAY;
  audioPreviewBtn.classList.toggle('is-playing', playing);
  const label = playing ? 'Pause preview' : 'Preview track';
  audioPreviewBtn.title = label;
  audioPreviewBtn.setAttribute('aria-label', label);
};
export const stopAudioPreview = (ta: ActionsCtx): void => {
  try {
    ta.previewAudio?.pause();
  } catch {
    /* not started */
  }
};
export const syncAudioPreviewEnabled = (ta: ActionsCtx): void => {
  const { audioPreviewBtn, audioSel } = ta;
  if (audioPreviewBtn) audioPreviewBtn.disabled = !(audioSel?.value);
};
export const syncAudioRegenVisible = (ta: ActionsCtx): void => {
  const { audioRegenBtn, audioSel } = ta;
  if (audioRegenBtn) audioRegenBtn.hidden = audioSel?.value !== '__generate__';
};
// Fade / level / duck / centre-volume only mean anything once a track is
// chosen - with "None" they are dead controls, so they stay hidden.
export const syncTrackExtras = (ta: ActionsCtx): void => {
  const { audioSel, el } = ta;
  const on = !!audioSel?.value;
  el.querySelectorAll<HTMLElement>('[data-track-extras]').forEach((x) => {
    x.style.display = on ? '' : 'none';
  });
};
export const syncBarsDefault = (ta: ActionsCtx, fmt: string): void => {
  const { el } = ta;
  if (ta.barsUserSet) return;
  const bars = el.querySelector<HTMLInputElement>('[data-action="mark-bars"]');
  if (bars) bars.checked = isCmykFmt(fmt);
};
export const syncPrintDefault = (ta: ActionsCtx, fmt: string): void => {
  const { el } = ta;
  if (ta.marksUserSet) return;
  const en = el.querySelector<HTMLInputElement>('[data-action="print-enable"]');
  if (en) en.checked = ta.formatRules.printIntentFmt(fmt); // refreshPrintUi (called next) reveals/hides the body
};
export const syncCaptionsUi = (ta: ActionsCtx, fmt: string): void => {
  const { el } = ta;
  const embed = el.querySelector<HTMLInputElement>('[data-action="captions-embed"]');
  if (embed && !ta.captionsEmbedUserSet) embed.checked = fmt === 'webm';
  const note = el.querySelector<HTMLElement>('[data-captions-mp4-note]');
  if (note) note.style.display = fmt === 'mp4' ? 'block' : 'none';
};
export function wireAudio(ta: ActionsCtx): void {
  const { audioPreviewBtn, audioRegenBtn, audioSel, exportDefaults, host } = ta;
  audioSel?.addEventListener('change', () => {
    ta.audio.stopAudioPreview();
    ta.previewSrcId = null;
    ta.audio.syncAudioPreviewEnabled();
    ta.audio.syncAudioRegenVisible();
    ta.audio.syncTrackExtras();
  });
  ta.audio.syncTrackExtras();
  if (audioPreviewBtn) {
    audioPreviewBtn.addEventListener('click', async () => {
      const id = audioSel?.value;
      if (!id) return;
      // Key the loaded source so a regenerated tune reloads instead of replaying
      // the stale bytes; catalog/user ids key as themselves.
      const srcKey = id === '__generate__' ? `__generate__:${ta.genSeed}:${ta.audio.genDur()}` : id;
      if (ta.previewAudio && ta.previewSrcId === srcKey && !ta.previewAudio.paused) {
        ta.audio.stopAudioPreview();
        return;
      }
      try {
        if (!ta.previewAudio) {
          ta.previewAudio = new Audio();
          ta.previewAudio.preload = 'auto';
          ta.previewAudio.addEventListener('play', () => ta.audio.setAudioPreviewPlaying(true));
          ta.previewAudio.addEventListener('pause', () => ta.audio.setAudioPreviewPlaying(false));
          ta.previewAudio.addEventListener('ended', () => ta.audio.setAudioPreviewPlaying(false));
        }
        if (ta.previewSrcId !== srcKey) {
          audioPreviewBtn.classList.add('is-loading');
          const url =
            id === '__generate__'
              ? await ta.audio.generatedWavUrl(ta.audio.genDur())
              : (await host.assets.get(id)).url;
          if (!url) throw new Error('no track to preview');
          ta.previewAudio.src = url;
          ta.previewSrcId = srcKey;
          audioPreviewBtn.classList.remove('is-loading');
        }
        await ta.previewAudio.play();
      } catch {
        audioPreviewBtn.classList.remove('is-loading');
        ta.audio.setAudioPreviewPlaying(false);
      }
    });
    ta.audio.syncAudioPreviewEnabled();
  }
  if (audioRegenBtn) {
    audioRegenBtn.addEventListener('click', () => {
      ta.genSeed = (Math.random() * 0x7fffffff) >>> 0;
      const wasPlaying = Boolean(ta.previewAudio && !ta.previewAudio.paused);
      ta.audio.stopAudioPreview();
      ta.previewSrcId = null;
      // Mid-audition regenerate rolls straight into the new tune (still within the
      // user's click gesture, so autoplay policy allows it).
      if (wasPlaying) audioPreviewBtn?.click();
    });
    ta.audio.syncAudioRegenVisible();
  }

  // Colour bars track the format: ON for the CMYK print formats (pdf-cmyk /
  // cmyk-tiff), OFF for the RGB pdf, re-applied on every format switch - until the
  // user toggles them, or a shared link set marks explicitly, after which their
  // choice is left alone.
  ta.barsUserSet = Boolean(exportDefaults.marks);
}

export function audioOps(ta: ActionsCtx) {
  return {
    toolAudioRef: bindOp(ta, toolAudioRef),
    resolveToolAudio: bindOp(ta, resolveToolAudio),
    toolTranscriptText: bindOp(ta, toolTranscriptText),
    captionText: bindOp(ta, captionText),
    genDur: bindOp(ta, genDur),
    generatedWavUrl: bindOp(ta, generatedWavUrl),
    setAudioPreviewPlaying: bindOp(ta, setAudioPreviewPlaying),
    stopAudioPreview: bindOp(ta, stopAudioPreview),
    syncAudioPreviewEnabled: bindOp(ta, syncAudioPreviewEnabled),
    syncAudioRegenVisible: bindOp(ta, syncAudioRegenVisible),
    syncTrackExtras: bindOp(ta, syncTrackExtras),
    syncBarsDefault: bindOp(ta, syncBarsDefault),
    syncPrintDefault: bindOp(ta, syncPrintDefault),
    syncCaptionsUi: bindOp(ta, syncCaptionsUi),
    wireAudio: bindOp(ta, wireAudio),
  };
}
