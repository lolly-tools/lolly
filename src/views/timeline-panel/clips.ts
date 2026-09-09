// SPDX-License-Identifier: MPL-2.0
/**
 * timeline-panel: clip export, download, matte, detach and join.
 *
 * Every function takes the shared `tp: TpCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `tp.<module>.<fn>`. Extracted verbatim
 * from initTimelinePanel() by scripts/split-closure.ts.
 */
import { t } from '../../i18n.ts';
import { announce } from '../../a11y.ts';
import { frameAt } from '../../lib/clip-thumbs.ts';
import { boxTiming, detachAudio, indexOfId, isThroughEdit, joinClips, reattachAudio, seqBoxes } from '../timeline-math.ts';
import type { Box } from '../timeline-math.ts';
import type { AssetRef, HostV1 } from '@lolly-tools/core/host-v1';
import type { VideoJobHost } from '../../lib/video-jobs.ts';
import { bindOp, type TpCtx } from './context.ts';

// ── Export frame: a native-resolution PNG of the frame under the playhead ────

/** May "Export frame" be offered for this box? Video only - a still/audio/lottie
 *  has no per-instant frame to grab. */
export function canExportFrame(tp: TpCtx, id: string): boolean {
  return !!id && tp.helpers.mediaOf(id).kind === 'video';
}
/**
 * Decode the frame under the playhead from the clip's ORIGINAL asset at the media's
 * own native resolution (never a downscaled preview surface), save it as a new
 * user-catalog asset, and hand the same bytes
 * to the browser's download flow. `mediaOf(id).url` is read straight off the
 * mounted `<video>` element's `currentSrc`/`src`, which - by the same invariant
 * that keeps every OTHER export path honest (see bridge/export.ts and
 * sequence-render.ts's own header) - is never swapped to a proxy: only
 * lib/clip-thumbs.ts's OWN filmstrip/waveform capture ever resolves one, which is
 * exactly why this calls `frameAt` and not `filmstrip`.
 */
export async function exportFrameAt(tp: TpCtx, id: string): Promise<void> {
  const { cfg, clock, getBoxes, host } = tp;
  const rows = getBoxes();
  const i = indexOfId(rows, cfg, id);
  if (i < 0) return;
  const media = tp.helpers.mediaOf(id);
  if (media.kind !== 'video' || !media.url) {
    announce(t('This clip has no video frame to export'));
    return;
  }
  const timing = boxTiming(rows[i]!, cfg);
  const start = timing.start ?? 0;
  const speed = timing.speed ?? 1;
  // The bar's own local-time mapping (clipIn plus elapsed playhead time, scaled by
  // speed) - the same arithmetic `out0` uses above to bound a filmstrip's window.
  const localSec = timing.clipIn + Math.max(0, clock.t() / 1000 - start) * speed;
  announce(t('Capturing frame…'));
  const bitmap = await frameAt(media.url, localSec);
  if (!bitmap) {
    announce(t('Could not capture that frame'));
    return;
  }
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    try {
      bitmap.close?.();
    } catch {
      /* already gone */
    }
    announce(t('Could not capture that frame'));
    return;
  }
  ctx.drawImage(bitmap, 0, 0);
  try {
    bitmap.close?.();
  } catch {
    /* already gone */
  }
  const rawBlob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png')
  );
  if (!rawBlob) {
    announce(t('Could not capture that frame'));
    return;
  }

  // Provenance: extracting a frame invents no pixels, so this is a c2pa.edited
  // step - never a generated-content claim - and the clip's own source asset is
  // kept as an ingredient when its bytes carry a credential. This is a plain,
  // editor-initiated derived asset (not a `renders` output), so it is left
  // UNTAGGED. Never blocks the save: both the ingredient read and the stamp are
  // try/catch, exactly like the Matte and Upscale dialogs' own save path.
  let blob = rawBlob;
  try {
    const [{ stampDerivedC2pa }, { extractC2paStore, prepareC2paIngredientFromStore }] =
      await Promise.all([import('../../bridge/export.ts'), import('@lolly/engine')]);
    const ingredient = await (async () => {
      try {
        const srcBytes = new Uint8Array(await (await fetch(media.url)).arrayBuffer());
        const ex = extractC2paStore(srcBytes);
        return ex ? prepareC2paIngredientFromStore(ex.store, ex.format) : null;
      } catch {
        return null; // source bytes unreachable - export continues without an ingredient
      }
    })();
    blob = await stampDerivedC2pa(host as unknown as HostV1, rawBlob, 'png', {
      title: 'Exported frame',
      tool: 'Sequence editor',
      actions: [{ action: 'c2pa.edited', description: 'Frame extracted from a video clip' }],
      ...(ingredient ? { ingredients: [ingredient] } : {}),
      dimensions: `${canvas.width}×${canvas.height}`,
    });
  } catch (e) {
    host.log?.(
      'warn',
      `Export frame: provenance stamp failed - ${e instanceof Error ? e.message : String(e)}`
    );
  }

  const now = Date.now();
  const filename = `frame-${now}.png`;
  try {
    await host.assets?._uploadUserAsset?.({
      id: `user/frame/${now}`,
      type: 'raster',
      format: 'png',
      blob,
      version: '1.0.0',
      width: canvas.width,
      height: canvas.height,
      meta: { name: filename, bytes: blob.size },
    });
  } catch (e) {
    host.log?.(
      'warn',
      `Export frame: save failed - ${e instanceof Error ? e.message : String(e)}`
    );
  }
  await host.export?.download?.(blob, filename);
  announce(t('Frame exported'));
}
// ── Remove background: a transparent alternative for a video clip's source ────

/** May "Remove background…" be offered for this box? A video clip the browser can
 *  decode (WebCodecs) - the same video-matte gate the catalog detail modal (WP-G) uses.
 *  The dialog offers the on-device model (if staged) AND the model-free colour key, so a
 *  staged model is NOT required. Absent (never greyed) otherwise, like Export frame. */
export function canVideoMatte(tp: TpCtx, id: string): boolean {
  return (
    !!id &&
    tp.helpers.mediaOf(id).kind === 'video' &&
    typeof (window as { VideoDecoder?: unknown }).VideoDecoder !== 'undefined'
  );
}
/**
 * Open the shared video-job dialog (op 'matte') on this clip's ORIGINAL source video.
 * The source is resolved via refOf(id) - the box's persisted asset ref - and re-fetched
 * by its permanent id (fresh object URL + full meta), NEVER the scrub proxy: the same
 * original-asset rule Export frame follows above, for the same reason (a proxy is a
 * lossy downscaled re-encode). The dialog starts a WP-F background job and closes; the
 * transparent asset ends up in the user catalog when it finishes.
 *
 * We CREATE the asset; the follow-on track swap is left to the user. A "replace this
 * clip's source" write is deliberately NOT wired here: the box's asset-field name and
 * shape are the tool's own, and a video→transparent-WebP swap changes the media KIND
 * (a still animated raster, no per-clip timing/audio) - not a safe, general edit for
 * the panel to make blind. Creating the asset (and letting the user swap it in from the
 * asset picker) is the honest, non-destructive half.
 */
/** Does this clip carry a source file to download - an audio, video or image ref? */
export function canDownload(tp: TpCtx, id: string): boolean {
  const { host } = tp;
  const ref = tp.recording.refOf(id);
  return !!(ref && typeof ref.id === 'string' && ref.id) && !!host.export?.download;
}
/** The file extension a downloaded clip gets, from its bytes' type first. */
export function extOfBlob(_tp: TpCtx, blob: Blob, format: string | undefined): string {
  const byType: Record<string, string> = {
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/mpeg': 'mp3',
    'audio/mp4': 'm4a',
    'audio/ogg': 'ogg',
    'audio/flac': 'flac',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
    'image/avif': 'avif',
  };
  return (
    byType[blob.type] ||
    (format && /^[a-z0-9]{2,5}$/i.test(format) ? format.toLowerCase() : 'bin')
  );
}
/**
 * "Download": the clip's own source bytes, by its permanent asset id - re-resolved
 * like the subtitle and matte paths, so a stale proxy URL never decides. The name is
 * the asset's own, with an extension from the bytes (Andy, 2026-09-03).
 */
export async function downloadClipAt(tp: TpCtx, id: string): Promise<void> {
  const { host } = tp;
  const ref = tp.recording.refOf(id);
  const refId = typeof ref?.id === 'string' ? ref.id : '';
  let live: AssetRef | null = null;
  if (refId && host.assets?.get) {
    try {
      live = await host.assets.get(refId);
    } catch {
      live = null;
    }
  }
  const url = String(live?.url || '').trim();
  if (!url || !host.export?.download) {
    announce(t('Couldn’t find this clip’s source file'));
    return;
  }
  try {
    const blob = await (await fetch(url)).blob();
    const meta = (live?.meta ?? ref?.meta) as Record<string, unknown> | undefined;
    const raw = String(
      (typeof meta?.name === 'string' && meta.name) || refId.split('/').pop() || 'clip'
    );
    const base = raw.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'clip';
    const name = /\.[a-z0-9]{2,5}$/i.test(base)
      ? base
      : `${base}.${extOfBlob(tp, blob, live?.format)}`;
    await host.export.download(blob, name);
  } catch {
    announce(t('Couldn’t download this clip'));
  }
}
export async function videoMatteAt(tp: TpCtx, id: string): Promise<void> {
  const { host } = tp;
  if (!canVideoMatte(tp, id)) {
    announce(t('This clip has no video to process'));
    return;
  }
  const ref = tp.recording.refOf(id);
  const refId = typeof ref?.id === 'string' ? ref.id : '';
  // Re-resolve the ORIGINAL asset by its permanent id - the box's stored ref, never a
  // proxy - exactly like the subtitle path (wordsForBox) does.
  let source: AssetRef | null = null;
  if (refId && host.assets?.get) {
    try {
      source = await host.assets.get(refId);
    } catch {
      /* resolve failed → bail below */
    }
  }
  if (!source) {
    announce(t('Couldn’t find this clip’s source video'));
    return;
  }
  const sourceName = (source.meta?.name as string | undefined) ?? source.id;
  const ai = source.meta?.aiGenerated;
  try {
    const { openVideoJobDialog } = await import('../video-job-dialog.ts');
    await openVideoJobDialog(host as unknown as VideoJobHost, {
      op: 'matte',
      source,
      sourceName,
      ...(ai === 'full' || ai === 'partial' ? { aiGeneratedSource: ai } : {}),
    });
  } catch (err) {
    host.log?.('error', `Remove background: ${err instanceof Error ? err.message : String(err)}`);
  }
}
// ── A/V link: detach audio, re-attach, and the through-edit join ─────────────
//
// Detach is deliberately NOT Final Cut's: theirs is one-way, and "there's no way to
// resync a clip, except for Undo" is the single most-cited complaint in the survey.
// This is the Premiere/Resolve model - a persistent link, written on BOTH boxes, so
// the sound can go back where it came from from either side. All of the arithmetic is
// in timeline-math (`detachAudio` / `reattachAudio`); everything here is the gate.

/** The id this box is A/V-linked to, or '' (no link field, no value, or a dangling id). */
export function partnerOf(tp: TpCtx, id: string, rows: Box[] = tp.getBoxes()): string {
  const { cfg } = tp;
  const link = cfg.linkField;
  if (!link || !id) return '';
  const i = indexOfId(rows, cfg, id);
  if (i < 0) return '';
  const v = rows[i]![link];
  const other = v == null ? '' : String(v);
  return other && indexOfId(rows, cfg, other) >= 0 ? other : '';
}
/**
 * May this clip's sound be pulled onto its own lane? Four gates, all of them "does
 * this even mean anything here" rather than policy:
 *   • the TOOL declares a link sub-field (sequence-studio does; design does
 *     not, and gets no affordance at all rather than a broken one);
 *   • the tool has an `audio` add-kind - the vocabulary a detached sound is born into,
 *     exactly the check the microphone button already makes;
 *   • the box is actually a video (an image has no sound; a sound is already detached);
 *   • and it is not linked already.
 */
export function canDetach(tp: TpCtx, id: string): boolean {
  const { cfg } = tp;
  if (!cfg.linkField || !tp.recording.audioKind() || !id) return false;
  if (partnerOf(tp, id)) return false;
  return tp.helpers.mediaOf(id).kind === 'video';
}
export function detachAudioAt(tp: TpCtx, id: string): void {
  const { cfg, getBoxes } = tp;
  if (!id) return;
  if (!canDetach(tp, id)) {
    announce(t('This clip has no sound to detach'));
    return;
  }
  const next = detachAudio(getBoxes(), cfg, id, tp.edit.mintId, tp.recording.audioKind()?.seed as Box | undefined);
  if (!next) {
    announce(t('This clip has no sound to detach'));
    return;
  }
  tp.helpers.write(next);
  announce(t('Audio detached'));
}
export function reattachAudioAt(tp: TpCtx, id: string): void {
  const { cfg, getBoxes } = tp;
  if (!id || !cfg.linkField) return;
  // Read the partner BEFORE the write: pressed from the SOUND's side, `id` is the box
  // that is about to be removed, and a selection left pointing at a deleted row is how
  // the inspector ends up describing something that no longer exists.
  const partner = partnerOf(tp, id);
  const next = reattachAudio(getBoxes(), cfg, id, tp.helpers.mediaDur);
  // The one refusal worth explaining: the group exists but nothing in it is muted, so
  // the user un-muted the picture by hand and we cannot tell the two sides apart.
  if (!next) {
    announce(t('Un-mute the video before re-attaching its sound'));
    return;
  }
  const survivor =
    indexOfId(next, cfg, id) >= 0 ? id : indexOfId(next, cfg, partner) >= 0 ? partner : '';
  tp.helpers.write(next);
  if (survivor) {
    tp.focusedId = survivor;
    tp.rows.selectAndReveal([survivor]);
  }
  announce(t('Audio re-attached'));
}
/**
 * Are two clips the same source? Injected into `isThroughEdit`, which must not know
 * what an asset is. Compared on the ref's ID (its identity), never the whole object -
 * two refs to the same asset can differ in resolved url/meta.
 */
export const sameSource = (tp: TpCtx, a: Box, b: Box): boolean => {
  const field = tp.recording.assetFieldName();
  const idOf = (x: Box): unknown => {
    const v = x?.[field];
    return v && typeof v === 'object' && !Array.isArray(v)
      ? ((v as { id?: unknown }).id ?? null)
      : null;
  };
  return JSON.stringify(idOf(a) ?? null) === JSON.stringify(idOf(b) ?? null);
};
/** The neighbour `id` forms a through edit with, and which side of it `id` is on. */
export function throughNeighbour(tp: TpCtx, 
  id: string,
  rows: Box[] = tp.getBoxes()
): { aId: string; bId: string } | null {
  const { cfg } = tp;
  const row = seqBoxes(rows, cfg).map((b) => String(b[cfg.idField] ?? ''));
  const at = row.indexOf(id);
  if (at < 0) return null;
  const prev = at > 0 ? row[at - 1]! : '';
  const next = at + 1 < row.length ? row[at + 1]! : '';
  // FCP accepts a ONE-SIDED selection: pressing Join on either half of a through edit
  // joins that edit. The clip's own out-edge is tried first, so a clip between two
  // through edits joins forwards - the direction the playhead is travelling.
  if (next && isThroughEdit(rows, cfg, id, next, tp.clips.sameSource)) return { aId: id, bId: next };
  if (prev && isThroughEdit(rows, cfg, prev, id, tp.clips.sameSource)) return { aId: prev, bId: id };
  return null;
}
export function joinAt(tp: TpCtx, aId: string, bId: string): void {
  const { cfg, getBoxes } = tp;
  const next = joinClips(getBoxes(), cfg, aId, bId, tp.helpers.mediaDur);
  if (!next) return;
  tp.helpers.write(next);
  tp.rows.selectAndReveal([aId]);
  announce(t('Clips joined'));
}
export function clipsOps(tp: TpCtx) {
  return {
    canExportFrame: bindOp(tp, canExportFrame),
    exportFrameAt: bindOp(tp, exportFrameAt),
    canVideoMatte: bindOp(tp, canVideoMatte),
    canDownload: bindOp(tp, canDownload),
    extOfBlob: bindOp(tp, extOfBlob),
    downloadClipAt: bindOp(tp, downloadClipAt),
    videoMatteAt: bindOp(tp, videoMatteAt),
    partnerOf: bindOp(tp, partnerOf),
    canDetach: bindOp(tp, canDetach),
    detachAudioAt: bindOp(tp, detachAudioAt),
    reattachAudioAt: bindOp(tp, reattachAudioAt),
    sameSource: bindOp(tp, sameSource),
    throughNeighbour: bindOp(tp, throughNeighbour),
    joinAt: bindOp(tp, joinAt),
  };
}
