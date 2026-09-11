// SPDX-License-Identifier: MPL-2.0
/**
 * Compact blocks → URL encoding. ENGINE-OWNED since plan 171 - the encoder moved
 * to engine/src/url-mode.ts (beside its decoder) so every shell mints the SAME
 * compact link for the same state: before the move the CLI/engine serialisation
 * path always fell back to the 1.5-10x larger JSON form, a real web-vs-CLI drift
 * in what "the canonical link for this state" looked like.
 *
 * This module stays as the web shell's import path (views/tool.ts syncUrl and
 * lib/url-budget.ts encodeModelParam) and for its co-located wire-format tests;
 * the format documentation - field order as append-only wire contract, separator
 * safety, `keepUserIds` - now lives on the engine function.
 */

export { encodeBlocksCompact } from '@lolly/engine';
