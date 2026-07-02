// SPDX-License-Identifier: MPL-2.0
/**
 * Video export (webm/mp4) via captureStream() + MediaRecorder, plus the shared
 * recorder-MIME negotiation.
 */

import { canRecord, WEBM_CODECS, MP4_CODECS } from '../../capabilities.ts';
import { createFrameSource } from './dom.ts';
import type { FormatAdapter, RenderContext, ExportOptions } from './types.ts';
import type { HostV1 } from '@lolly/engine';

// Best recorder mime, preferring the requested container ('webm' | 'mp4') but
// falling back to the other so a deep-link/CLI request still produces a video.
// Returns null when no container is recordable.
export function videoMimeType(preferred?: string): string | null {
  if (!canRecord()) return null;
  const order = preferred === 'mp4' ? [...MP4_CODECS, ...WEBM_CODECS] : [...WEBM_CODECS, ...MP4_CODECS];
  return order.find(t => MediaRecorder.isTypeSupported?.(t)) ?? null;
}

// Container MIME for the output Blob, derived from the chosen recorder mime.
function videoContainer(mime: string | null): string {
  return mime && mime.includes('mp4') ? 'video/mp4' : 'video/webm';
}

const NO_VIDEO_MSG = 'Video recording is not supported in this browser. Use GIF instead, or try Chrome or Firefox for WebM.';

// Hard ceiling on buffered frames (Phase 1 holds one ImageBitmap each). A normal
// clip is well under this; it exists to bound memory when duration/fps are pushed
// past the UI limits via the URL, which would otherwise OOM a mobile WebView.
const MAX_VIDEO_FRAMES = 600;

// Renders the DOM node into a video using captureStream() + MediaRecorder.
//
// Two-phase approach to guarantee stable frame rate regardless of render speed:
//   Phase 1 — render: each frame is captured sequentially via toCanvas() and
//     stored as an ImageBitmap (GPU memory). Takes longer than real-time on
//     slow machines but ensures every frame is visually unique.
//   Phase 2 — replay: pre-rendered frames are painted to an offscreen canvas
//     at exactly the target fps while MediaRecorder encodes the stream.
async function renderVideo(node: HTMLElement, opts: ExportOptions, preferred: 'webm' | 'mp4', host: HostV1 | null): Promise<Blob> {
  const mimeType = videoMimeType(preferred);
  if (!mimeType) throw new Error(NO_VIDEO_MSG);

  if (node instanceof HTMLCanvasElement) {
    // node itself is a canvas — use it directly (rare but possible)
    const waitMs = (opts.wait ?? 1) * 1000;
    const durationMs = (opts.duration ?? 5) * 1000;
    await new Promise(r => setTimeout(r, waitMs));
    return recordStream(node.captureStream(30), { durationMs, mimeType });
  }

  const fps = opts.fps ?? 24;
  const frameMs = 1000 / fps;
  const durationMs = (opts.duration ?? 5) * 1000;
  let frameCount = Math.ceil(durationMs / frameMs);

  // Phase 1 buffers every frame as an ImageBitmap before replay, so the frame
  // count is the memory ceiling. Clamp it so a long/high-fps request (the duration
  // limit is bypassable via the URL) can't queue hundreds of bitmaps and OOM a
  // mobile WebView.
  if (frameCount > MAX_VIDEO_FRAMES) {
    host?.log('warn', `Video capped at ${MAX_VIDEO_FRAMES} frames (requested ${frameCount}); lower the duration or frame rate for a longer clip.`);
    frameCount = MAX_VIDEO_FRAMES;
  }

  // Phase 1: render all frames sequentially through the shared FrameSource.
  const source = await createFrameSource(node, opts);
  const targetW = source.width, targetH = source.height;
  const frames: ImageBitmap[] = [];
  try {
    for (let i = 0; i < frameCount; i++) {
      frames.push(await createImageBitmap(await source.frame()));
      opts.onProgress?.(i + 1, frameCount);
    }
  } finally {
    source.dispose();
  }

  // Phase 2: replay pre-rendered frames at target fps into captureStream.
  const offscreen = document.createElement('canvas');
  offscreen.width = targetW;
  offscreen.height = targetH;
  const ctx = offscreen.getContext('2d');
  const stream = offscreen.captureStream(fps);

  const recorder = new MediaRecorder(stream, { mimeType });
  const chunks: Blob[] = [];
  recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

  return new Promise<Blob>((resolve, reject) => {
    recorder.onerror = () => reject(new Error('MediaRecorder error'));
    recorder.onstop = () => {
      stream.getTracks().forEach(t => t.stop());
      frames.forEach(b => b.close());
      resolve(new Blob(chunks, { type: videoContainer(mimeType) }));
    };

    let fi = 0;
    recorder.start();

    function paintNext(): void {
      const f = frames[fi++];
      if (!f) { recorder.stop(); return; }
      ctx?.drawImage(f, 0, 0);
      setTimeout(paintNext, frameMs);
    }
    paintNext();
  });
}

function recordStream(stream: MediaStream, { durationMs = 5000, mimeType = videoMimeType() }: { durationMs?: number; mimeType?: string | null } = {}): Promise<Blob> {
  if (!mimeType) throw new Error(NO_VIDEO_MSG);
  const recorder = new MediaRecorder(stream, { mimeType });
  const chunks: Blob[] = [];
  recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

  return new Promise<Blob>((resolve, reject) => {
    recorder.onerror = () => reject(new Error('MediaRecorder error'));
    recorder.onstop = () => resolve(new Blob(chunks, { type: videoContainer(mimeType) }));
    recorder.start();
    setTimeout(() => recorder.stop(), durationMs);
  });
}

export const videoAdapter: FormatAdapter = {
  formats: ['webm', 'mp4'],
  render(ctx: RenderContext): Promise<Blob> {
    return renderVideo(ctx.node, ctx.opts, ctx.format === 'mp4' ? 'mp4' : 'webm', ctx.host);
  },
};
