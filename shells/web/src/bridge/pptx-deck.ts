// SPDX-License-Identifier: MPL-2.0
/**
 * Authored-deck-model lowering, re-exported.
 *
 * The lowering itself moved to `packages/node-shell/src/pptx-deck.ts` (plan 274 WP 6)
 * so the CLI can write a native .pptx without a browser: it was already DOM-free, and
 * a web-shell path was the one thing keeping it out of reach of a terminal run. This
 * file stays as the import path every web-shell caller already uses.
 */
export * from '@lolly-tools/node-shell/pptx-deck';
