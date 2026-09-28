// SPDX-License-Identifier: MPL-2.0
import { canonicalDocument } from './revision-capture.ts';
import type { SavedStateData } from './state.ts';

/** New captures pin versioned uploads to their retained bytes, and keep a remote
 * file or tool link by its id alone, since it is fetched or rendered again from
 * that id on open. Kept separate from archive canonicalisation: importing an
 * older checkpoint cannot rewrite its content hash. The result is canonical, from
 * the same single walk the write path uses (revision-capture.ts). */
export function pinRevisionAssets(data: SavedStateData): SavedStateData {
  return canonicalDocument(data, true);
}
