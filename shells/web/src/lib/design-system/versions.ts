// SPDX-License-Identifier: MPL-2.0
/**
 * versions.ts - the versioned design-system model (plans/97 section 6a), re-exported.
 *
 * The implementation moved to `engine/src/design-version.ts` in engine 1.109.0.
 * It had to: the descendant-exclusion discovery rule, the slug grammar and the
 * resolution ladder are contracts the web bridge, the MCP server and the CLI must
 * all apply the same way, and a copy living in one shell is a copy the other two
 * would re-invent. Nothing here is web-specific, so nothing here stayed behind.
 *
 * This module survives as the studio's import path - `lib/design-system/*` and the
 * rooms import from here, boot-path bridge modules import the engine leaf directly
 * (the rule the rest of `bridge/` already follows for engine imports).
 */

export {
  DESIGN_VERSION_LATEST,
  readVersionIndex,
  withVersionIndex,
  stripVersionIndex,
  slugifyVersion,
  isVersionSlug,
  suggestNextLabel,
  versionAssetId,
  isVersionAssetId,
  pickHeadAssetId,
  frozenAssetId,
  sha256Hex,
  resolveDesignVersion,
  docChecksum,
  diffTokenDocs,
  collectAssetTokens,
  collectFontFamilies,
  applyPinnedAssets,
} from '@lolly/engine';

export type { PinnedAsset, VersionEntry, VersionIndex } from '@lolly/engine';
