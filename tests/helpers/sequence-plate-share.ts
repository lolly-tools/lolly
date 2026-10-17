// SPDX-License-Identifier: MPL-2.0
import { SOURCE_CAPTURE_BYTE_LIMIT } from './sequence-capture-diagnostics.ts';

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
 *
 * Sharing also hides a bad capture from the pixel comparison, because both renders draw
 * the same bad plate. So the summary lists two kinds of plate for the log: captures that
 * threw, and recorded plates that came back fully transparent. The summary is read once
 * both renders are done, so reading those plates back cannot change either render.
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

/** What a test reads back: counts, the refusal, failed captures and empty plates, no canvases. */
export interface PlateShareSummary {
  recorded: number;
  replayed: number;
  captureMs: number;
  refused: string | null;
  /** Captures that threw while recording. `rasterBox` draws those layers as nothing. */
  failed: number;
  /** The first few of those errors, shortened. */
  failures: string[];
  /** Recorded plates with no pixel above zero alpha. Both renders draw them as nothing. */
  empty: number;
  /** The first few of those: capture position (from 1) and the captured node's shape. */
  emptyPlates: { at: number; node: string }[];
  /** Recorded plates that could not be read back, so `empty` cannot speak for them. */
  unread: number;
}

export const newPlateShare = (): PlateShare => ({ shots: [], replayed: 0, captureMs: 0, refused: null });

const FAILURE_LIMIT = 4;
const FAILURE_CHARS = 160;
const EMPTY_LIMIT = 16;
const NODE_CHARS = 80;

interface PlateCanvas {
  width: number;
  height: number;
  getContext(kind: '2d'): { getImageData(x: number, y: number, width: number, height: number): { data: Uint8ClampedArray } } | null;
}

/**
 * Whether a captured plate holds any pixel at all. A plate with no area draws nothing, so
 * it counts as empty. One too large for the readback limit, or with no 2d readback, is
 * `unread` rather than a guess.
 */
export function plateInk(canvas: unknown): 'ink' | 'empty' | 'unread' {
  const plate = canvas as Partial<PlateCanvas> | null;
  if (!plate || typeof plate.getContext !== 'function') return 'unread';
  const { width, height } = plate;
  if (typeof width !== 'number' || typeof height !== 'number') return 'unread';
  if (width === 0 || height === 0) return 'empty';
  if (!Number.isSafeInteger(width) || width < 1 || !Number.isSafeInteger(height) || height < 1
    || width > SOURCE_CAPTURE_BYTE_LIMIT / 4 / height) return 'unread';
  try {
    const context = plate.getContext('2d');
    if (!context) return 'unread';
    const bytes = context.getImageData(0, 0, width, height).data;
    if (bytes.length !== width * height * 4) return 'unread';
    for (let i = 3; i < bytes.length; i += 4) if (bytes[i] !== 0) return 'ink';
    return 'empty';
  } catch { return 'unread'; }
}

/** `div.lolly-box[z=40]`: tag, classes and depth from a shot signature. */
function plateNode(signature: string): string {
  const [tag, className, z] = JSON.parse(signature) as [string, string, string | null];
  const classes = className.split(/\s+/).filter(Boolean).map((name) => `.${name}`).join('');
  return `${tag.toLowerCase()}${classes}${z != null ? `[z=${z}]` : ''}`.slice(0, NODE_CHARS);
}

/** Read only after the last render that draws these plates has finished. */
export function plateShareSummary(share: PlateShare | null): PlateShareSummary {
  if (!share) {
    return { recorded: 0, replayed: 0, captureMs: 0, refused: 'no plate share was started', failed: 0, failures: [],
      empty: 0, emptyPlates: [], unread: 0 };
  }
  const unused = share.shots.length - share.replayed;
  const refused = share.refused
    ?? (share.replayed > 0 && unused > 0 ? `${unused} recorded plate(s) were never asked for` : null);
  const failed = share.shots.filter((shot) => shot.failed);
  const emptyPlates: { at: number; node: string }[] = [];
  let unread = 0;
  share.shots.forEach((shot, i) => {
    if (shot.failed) return;
    const ink = plateInk(shot.canvas);
    if (ink === 'empty') emptyPlates.push({ at: i + 1, node: plateNode(shot.signature) });
    else if (ink === 'unread') unread++;
  });
  return {
    recorded: share.shots.length, replayed: share.replayed, captureMs: share.captureMs, refused,
    failed: failed.length,
    failures: failed.slice(0, FAILURE_LIMIT).map((shot) => String((shot.error as Error)?.message ?? shot.error).slice(0, FAILURE_CHARS)),
    empty: emptyPlates.length, emptyPlates: emptyPlates.slice(0, EMPTY_LIMIT), unread,
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
