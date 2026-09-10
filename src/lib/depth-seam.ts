// SPDX-License-Identifier: MPL-2.0
/**
 * The tool-facing depth seam (plans/160 section 7) - `window.__lollyDepth`, and
 * nothing else.
 *
 * A tool is DATA: community/spatial-photo can never import the shell. So the web
 * shell publishes exactly one function on `window` and the tool feature-detects
 * it - absent (the CLI, both Tauri shells, any host with no model) the tool
 * shows an unavailable state and blocks depth-dependent export.
 *
 * WHY THIS IS ITS OWN FILE, separate from lib/depth-job.ts: `main.ts` calls
 * `installDepthSeam()` at module scope, so the seam is on the boot graph by
 * construction - and through lib/depth-job.ts that one edge dragged the ORT
 * canvas helpers, the depth model catalogue and the matte error classifier
 * (42.4 KB of source, ~4 KB gz) onto the render-blocking preload set for every
 * visitor, to publish a function almost nobody calls. `forImage` already returns
 * a Promise, so the driver loads on the first real request and the publish costs
 * one closure (plans/155 WP-3).
 */
import type { DepthMap } from './depth-models.ts';

export interface DepthSeam {
  /** Depth for the image at `url`, or null when it could not be read (no model,
   *  a cancel, a decode failure). NEVER rejects - a tool must not have to handle
   *  an error it cannot act on; the job toast already carries the human message. */
  forImage(url: string): Promise<DepthMap | null>;
}

/** Publish the seam. Idempotent, and a no-op outside a window (worker/SSR). */
export function installDepthSeam(): void {
  const target = globalThis as unknown as { __lollyDepth?: DepthSeam; window?: unknown };
  if (typeof target.window === 'undefined' || target.__lollyDepth) return;
  target.__lollyDepth = {
    // A failed import resolves null like every other unreadable source: the
    // contract above says forImage never rejects, and a tool that asked for
    // depth it cannot get must show a retryable unavailable state.
    forImage: (url) => import('./depth-job.ts').then(m => m.depthForImage(url), () => null),
  };
}
