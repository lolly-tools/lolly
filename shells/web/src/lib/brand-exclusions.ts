// SPDX-License-Identifier: MPL-2.0
/**
 * Swatch-exclusion read - the doc-level `$extensions` list that "deleting" a
 * derived swatch writes (see brand-doc.ts's exclusion block for the contract:
 * the token keeps resolving, only its tile/picker presence goes).
 *
 * A LEAF module on purpose: the boot-path tokens bridge (bridge/tokens.ts)
 * filters excluded swatches out of host.tokens.colors(), and reaching that
 * one read through the studio's doc-surgery module (lib/brand-doc.ts, which
 * pulls the @lolly/engine barrel) would invert the bridge→lib layering and
 * drag studio code into the bridge's static boot graph. This file imports
 * nothing beyond the engine's tokens leaf, which the bridge already rides;
 * brand-doc.ts re-exports it so studio callers keep one import site.
 */

import { TOKEN_EXT } from '../../../../engine/src/token-ext.ts';

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);

/** The doc's excluded swatch keys, in stored order (empty when none). */
export function getExcludedSwatches(doc: unknown): string[] {
  if (!isRec(doc)) return [];
  const ext = isRec(doc.$extensions) ? (doc.$extensions as Rec)[TOKEN_EXT] : null;
  const list = isRec(ext) ? (ext as Rec).excluded : null;
  return Array.isArray(list) ? list.filter((k): k is string => typeof k === 'string') : [];
}
