// SPDX-License-Identifier: MPL-2.0
/**
 * Test-only plate sharing: one render's plate captures, handed to a second render of the
 * same stage, so a comparison of the two compares what happens AFTER capture and not the
 * capture itself.
 *
 * Every `renderSequence` photographs its own plates through dom-to-image-more's
 * `toCanvas`. Two renders of one stage therefore compare two captures as well as the two
 * code paths under test, and on the Linux software-GPU runner a capture is not always
 * reproducible: the Lift cache comparison failed four times between 13 and 15 October
 * 2026 with one lifted text layer missing from one render's plates (see the cache test in
 * `lift-flythrough.browser.test.ts`). Recording the first render's captures and answering
 * the second render's calls from that recording removes the capture from the comparison.
 *
 * The replay refuses rather than guesses. Each call must ask for the same node shape and
 * the same shot options as the recorded call at that position, and every recorded shot
 * must be used. A refusal is thrown into the render (where `rasterBox` turns it into a
 * missing plate) AND kept on the share, because the caller has to fail on the refusal
 * itself rather than on the pixel difference it causes.
 */

interface Shot {
  signature: string;
  canvas: unknown;
  /** The capture's own rejection, rethrown on replay so both renders lose the same plate. */
  error: unknown;
  failed: boolean;
}

export interface PlateShare {
  shots: Shot[];
  replayed: number;
  /** Milliseconds the recording render spent inside `toCanvas`. */
  captureMs: number;
  refused: string | null;
}

/** What a test reads back: counts, the refusal and failed captures, no canvases. */
export interface PlateShareSummary {
  recorded: number;
  replayed: number;
  captureMs: number;
  refused: string | null;
  /** Captures that threw while recording. `rasterBox` draws those layers as nothing. */
  failed: number;
  /** The first few of those errors, shortened. */
  failures: string[];
}

export const newPlateShare = (): PlateShare => ({ shots: [], replayed: 0, captureMs: 0, refused: null });

const FAILURE_LIMIT = 4;
const FAILURE_CHARS = 160;

export function plateShareSummary(share: PlateShare | null): PlateShareSummary {
  if (!share) {
    return { recorded: 0, replayed: 0, captureMs: 0, refused: 'no plate share was started', failed: 0, failures: [] };
  }
  const unused = share.shots.length - share.replayed;
  const refused = share.refused
    ?? (share.replayed > 0 && unused > 0 ? `${unused} recorded plate(s) were never asked for` : null);
  const failed = share.shots.filter((shot) => shot.failed);
  return {
    recorded: share.shots.length, replayed: share.replayed, captureMs: share.captureMs, refused,
    failed: failed.length,
    failures: failed.slice(0, FAILURE_LIMIT).map((shot) => String((shot.error as Error)?.message ?? shot.error).slice(0, FAILURE_CHARS)),
  };
}

interface ShapeNode {
  tagName?: unknown;
  className?: unknown;
  getAttribute?(name: string): string | null;
  querySelectorAll?(selector: string): ArrayLike<{ getAttribute?(name: string): string | null }>;
}

/** The node and shot options a capture asked for. Image sources are reduced to lengths. */
export function shotSignature(node: unknown, options: unknown): string {
  const n = (node ?? {}) as ShapeNode;
  const images = typeof n.querySelectorAll === 'function' ? Array.from(n.querySelectorAll('img')) : [];
  const o = (options ?? {}) as { width?: unknown; height?: unknown; style?: Record<string, unknown> };
  return JSON.stringify([
    String(n.tagName ?? ''), String(n.className ?? ''),
    typeof n.getAttribute === 'function' ? n.getAttribute('data-t-z') : null,
    images.map((image) => (typeof image.getAttribute === 'function' ? image.getAttribute('src') ?? '' : '').length),
    o.width ?? null, o.height ?? null,
    o.style?.transform ?? null, o.style?.width ?? null, o.style?.height ?? null,
  ]);
}

type CaptureLibrary<N, A extends unknown[], C> = { toCanvas(node: N, ...args: A): Promise<C> };

function install<N, A extends unknown[], C>(
  library: CaptureLibrary<N, A, C>, wrapped: CaptureLibrary<N, A, C>['toCanvas'],
): () => void {
  const original = library.toCanvas;
  library.toCanvas = wrapped;
  return () => { if (library.toCanvas === wrapped) library.toCanvas = original; };
}

/** Pass every capture through, and keep its result (or its rejection) in call order. */
export function recordPlates<N, A extends unknown[], C>(
  library: CaptureLibrary<N, A, C>, share: PlateShare, now: () => number = () => performance.now(),
): () => void {
  const original = library.toCanvas;
  return install(library, async function (this: CaptureLibrary<N, A, C>, node, ...args) {
    const signature = shotSignature(node, args[0]);
    const t0 = now();
    try {
      const canvas = await original.call(this, node, ...args);
      share.shots.push({ signature, canvas, error: null, failed: false });
      return canvas;
    } catch (error) {
      share.shots.push({ signature, canvas: null, error, failed: true });
      throw error;
    } finally {
      share.captureMs += now() - t0;
    }
  });
}

/** Answer each capture with the recorded one at the same position, or refuse. */
export function replayPlates<N, A extends unknown[], C>(library: CaptureLibrary<N, A, C>, share: PlateShare): () => void {
  return install(library, async (node, ...args) => {
    const position = share.replayed;
    const shot = share.shots[position];
    const signature = shotSignature(node, args[0]);
    if (!shot || shot.signature !== signature) {
      share.refused ??= shot
        ? `capture ${position + 1} asked for ${signature}, the recording has ${shot.signature}`
        : `capture ${position + 1} has no recording (${share.shots.length} recorded)`;
      throw new Error(`plate replay refused: ${share.refused}`);
    }
    share.replayed++;
    if (shot.failed) throw shot.error;
    return shot.canvas as C;
  });
}
