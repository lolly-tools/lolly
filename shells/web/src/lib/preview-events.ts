// SPDX-License-Identifier: MPL-2.0
/**
 * The one channel a stale or missing session picture is reported on (plan 373).
 *
 * The reader (components/preview-image.ts), the state bridge and the beam receiver
 * report a session whose picture should be drawn again; the idle redraw queue
 * (lib/preview-idle.ts) takes the reports once it has loaded. A leaf module, so
 * none of those reporters depends on the render path the redraw uses.
 */

export interface StaleTile { slot: string; toolId?: string; key?: string }

const WAITING_LIMIT = 200;
let handler: ((tile: StaleTile) => void) | null = null;
const waiting: StaleTile[] = [];

/** Report a session whose picture should be drawn again on idle time. */
export function staleTile(tile: StaleTile): void {
  if (!tile.slot) return;
  if (handler) handler(tile);
  else if (waiting.length < WAITING_LIMIT) waiting.push(tile);
}

/** Take the reports: the ones that arrived before, then each new one. */
export function onStaleTile(take: (tile: StaleTile) => void): void {
  handler = take;
  for (const tile of waiting.splice(0)) take(tile);
}
