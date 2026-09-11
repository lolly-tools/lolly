// SPDX-License-Identifier: MPL-2.0
/**
 * The latest recorded audio take, shared between the stage's post-record
 * download bar (views/record-control.ts) and the export sheet's "Your
 * recording" card (views/tool-actions.ts). A voice tool's Export otherwise
 * only offers the share-card image, so the sheet needs a live view of the
 * take to hand over the actual audio.
 *
 * The save paths mirror the stage bar exactly: the native container keeps the
 * capture credential it was stamped with; the MP3 re-encode is re-signed as
 * the same live mic capture (transcoded). Signed saves carry the "-lolly"
 * name suffix so a recipient knows there is provenance to verify.
 */

export interface AudioTake {
  blob: Blob;
  mimeType: string;
  /** C2PA container key ('webm'/'m4a'/'ogg'), or null when nothing was stamped. */
  container: string | null;
}

import type { HostV1 } from '../../../../engine/src/bridge/host-v1.ts';

let take: AudioTake | null = null;
// ponytail: single listener slot - one tool view (one export sheet) exists at a
// time; replace-on-subscribe cannot leak across mounts. Widen to a Set if a
// second surface ever needs to watch takes.
let listener: (() => void) | null = null;

export function setAudioTake(next: AudioTake | null): void {
  take = next;
  listener?.();
}

export const getAudioTake = (): AudioTake | null => take;

/** Replaces any previous subscriber; pass null to unsubscribe. */
export function onAudioTakeChange(cb: (() => void) | null): void {
  listener = cb;
}

/** File extension for the take's native container (mirrors the stage bar). */
export const takeNativeExt = (t: AudioTake): string =>
  t.container ?? (t.mimeType.includes('mp4') ? 'm4a' : t.mimeType.includes('ogg') ? 'ogg' : 'webm');

const baseName = (signed: boolean): string => signed ? 'voice-recording-lolly' : 'voice-recording';

/** Save the take in its native container, credential intact when one was stamped. */
export async function saveTakeNative(host: HostV1, t: AudioTake): Promise<void> {
  await host.export.file(t.blob, { filename: `${baseName(!!t.container)}.${takeNativeExt(t)}` });
}

/**
 * Re-encode to MP3 and re-sign as the same live capture (transcoded), then
 * save. Throws on encode failure so the caller can fall back to the native
 * container with its own messaging.
 */
export async function saveTakeMp3(host: HostV1, t: AudioTake): Promise<void> {
  const { blobToMp3 } = await import('./audio-encode.ts');
  const mp3 = await blobToMp3(t.blob);
  const { stampCaptureClip } = await import('../bridge/export.ts');
  const { blob: signed } = await stampCaptureClip(host, mp3, 'mp3', { microphone: true, transcoded: true });
  await host.export.file(signed, { filename: `${baseName(true)}.mp3` });
}
