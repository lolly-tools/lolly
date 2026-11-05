// SPDX-License-Identifier: MPL-2.0
/**
 * Hold an export until the document is the one a person would see before pressing
 * Download (views/tool/exporting.ts `linkExport`).
 *
 * The export panel never had this problem: by the time someone clicks, the tool has
 * long since answered everything the mount set off. A link export starts on the first
 * quiet canvas, which can be before the tool has been told the size it will be written
 * at (engine 1.293's canvas size), and before the hook runs that size, a colourway or a
 * late onInit started have come back. Each of those changes the drawing: Certificate
 * lays out a story sheet differently from an A4 one.
 *
 * Kept free of the tool view so the order of the waits can be tested without a browser.
 */

/** A size in CSS px, the form `runtime.setCanvasSize` takes. */
export interface SettleCanvas {
  width: number;
  height: number;
}

/** What the settle reads and drives. The view hands in its own runtime and paint loop. */
export interface SettleTarget {
  runtime: {
    setCanvasSize?(size: SettleCanvas | null): Promise<void>;
    whenSettled(): Promise<void>;
  };
  /** Paint a queued frame now, if there is one. */
  flush(): void;
  /** What the canvas shows: a different value after flush() means something new was painted. */
  shown(): unknown;
  /** True while a frame is still queued. */
  pending(): boolean;
  /** Resolves once the canvas has gone quiet (render-lifecycle waitForQuiescence). */
  quiet(): Promise<void>;
  warn?(message: string, error: unknown): void;
}

/** The passes a settle may take: a size change, the run it starts and one late answer. */
export const SETTLE_PASSES = 4;

/**
 * Tell the tool the export size, then wait until no hook run is out and the canvas shows
 * the last answer. A pass that paints something new waits for quiet again before the
 * next check, because the new drawing's own scripts can still be moving.
 */
export async function settleForExport(target: SettleTarget, canvas: SettleCanvas | null): Promise<void> {
  const { runtime } = target;
  if (canvas) {
    try { await runtime.setCanvasSize?.(canvas); }
    catch (error) { target.warn?.('Canvas size', error); }
  }
  for (let pass = 0; pass < SETTLE_PASSES; pass++) {
    const before = target.shown();
    await runtime.whenSettled();
    target.flush();
    if (target.shown() === before && !target.pending()) return;
    await target.quiet();
  }
}
