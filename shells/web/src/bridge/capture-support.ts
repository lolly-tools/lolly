// SPDX-License-Identifier: MPL-2.0
/**
 * "Can this browser capture?" - the synchronous feature probes behind `host.media`
 * and `host.recorder`, split out of the two impl modules that used to each keep a
 * private copy.
 *
 * WHY A LEAF. Both contracts answer availability SYNCHRONOUSLY (`MediaAPI.isAvailable`,
 * `RecorderAPI.isAvailable`) - a shell decides whether to draw a "Go live" toggle or a
 * record button before anything is started - while everything else they do is async
 * and gesture-driven. That is exactly the shape `bridge/index.ts` builds lazy facades
 * for (host.viz's `isAvailable` beside a lazy `presets`, host.raster's `canRaster`,
 * host.speech's `isAvailable`), and each of those answers from the same probe module
 * the real impl calls rather than a re-typed copy, so the facade and the impl cannot
 * drift. This is that module for camera/mic/screen.
 *
 * Nothing here touches a device or prompts for anything: these are capability reads
 * on `navigator.mediaDevices` and the `MediaRecorder` constructor. A `true` never
 * implies a grant - the prompt happens on start()/record()/still().
 */

/** getUserMedia present (a secure context with a media-devices implementation). */
export const hasGetUserMedia = (): boolean =>
  typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);

/** getDisplayMedia present - screen/window/tab share. Absent on most mobile browsers. */
export const hasGetDisplayMedia = (): boolean =>
  typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getDisplayMedia);

/** MediaRecorder present - needed to record a stream, but NOT to grab a still frame. */
export const hasMediaRecorder = (): boolean => typeof MediaRecorder !== 'undefined';

/** `MediaAPI.isAvailable()` - is a camera usable right now? */
export const cameraAvailable = (): boolean => hasGetUserMedia();

/**
 * `RecorderAPI.isAvailable(kind)` - is device capture of this kind usable right now?
 * A screenshot needs no MediaRecorder, only a display stream to grab a frame from.
 */
export function recorderAvailable(kind?: 'audio' | 'video' | 'screen'): boolean {
  if (kind === 'screen') return hasGetDisplayMedia();
  return hasGetUserMedia() && hasMediaRecorder();
}
