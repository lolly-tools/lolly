// SPDX-License-Identifier: MPL-2.0
// The export notice sink, on its own so the tool view can register it without loading
// the export bridge and its format writers. bridge/export.ts says what a notice is and
// who listens.
let sink: ((msg: string) => void) | null = null;
export function _setExportNoticeSink(fn: ((msg: string) => void) | null): void { sink = fn; }
/** Surface one export-status line to the user through the registered sink (aria-live
 *  announce + the export card's [data-export-degraded] note), or nothing when no sink
 *  is registered (a direct caller). Lets a format module - e.g. the .penpot export's
 *  report - reach the person, not only host.log (plans/222 item B). */
export function _exportNotice(msg: string): void { if (msg) sink?.(msg); }
