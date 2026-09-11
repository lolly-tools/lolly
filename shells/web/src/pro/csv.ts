// SPDX-License-Identifier: MPL-2.0
/**
 * Pro / Batch mode CSV/TSV reader & writer.
 *
 * These primitives were hoisted into the engine (engine/src/batch.ts) so the CLI and
 * TUI batch runners share the exact same reader-writer as the /pro grid. This module
 * re-exports them to keep the existing pro imports (`./csv.ts`) working unchanged.
 */
export { toCSV, parseDelimited, detectDelimiter } from '@lolly/engine';
