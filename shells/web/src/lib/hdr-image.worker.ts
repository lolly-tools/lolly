// SPDX-License-Identifier: MPL-2.0
/**
 * Web Worker: encode an SDR RGBA buffer into an HDR cICP PNG off the main thread.
 *
 * WebKit has no live HDR canvas, so the Colour Lab's HDR slice must be a PNG
 * (plan 154 WP-5) - and the deflate is heavy enough to jank a phone if it runs on
 * the UI thread. It has no DOM in it, so it belongs here: the main thread posts an
 * {@link HdrJob} (RGBA buffer transferred in), the worker runs the same
 * `hdrPngBytes` maths and transfers the PNG bytes back. Keeps 16-bit quality with
 * zero main-thread cost. Bundled by Vite via `new Worker(new URL(...), {type:'module'})`.
 */
import { hdrPngBytes } from './hdr-image.ts';
import type { HdrJob, HdrResult } from './hdr-image.ts';

self.onmessage = (e: MessageEvent<HdrJob>): void => {
  const j = e.data;
  const bytes = hdrPngBytes(new Uint8ClampedArray(j.rgba), j.width, j.height, j.space, j.exp, j.depth);
  // A tight copy so the transferred buffer is exactly the PNG (packPng's may be a
  // view into a larger backing store).
  const png = bytes.slice().buffer;
  (self as unknown as Worker).postMessage({ id: j.id, png } satisfies HdrResult, [png]);
};
