// SPDX-License-Identifier: MPL-2.0
/**
 * Engine public surface.
 *
 * Host shells (web/Tauri/CLI) import from here. Tools NEVER import from here —
 * tools talk to the host through the capability bridge passed to their hooks.
 */

export { loadTool, ToolLoadError, applyManifestI18n } from './loader.ts';
export type { LoadedTool, ToolManifest, ToolFetchFile, LoadToolOpts, ToolIntegrityOpts, ToolI18nOverlay } from './loader.ts';
export {
  canonicalJson, sha256Hex, jwkThumbprint, importSpkiOrJwkPublicKey,
  signCatalogEnvelope, verifyEnvelopeSignature, verifyCatalogEnvelope, verifyToolFile,
  CATALOG_SIG_ALG, CATALOG_SIG_PATH, CATALOG_SIGNED_TOOL_FILES,
} from './catalog-integrity.ts';
export type {
  CatalogSignatureEnvelope, UnsignedCatalogEnvelope, IntegrityResult,
} from './catalog-integrity.ts';
export { validateManifest } from './validate.ts';
export { createRuntime, HOOK_BUDGET_MS } from './runtime.ts';
export { hydrate, annotateTemplate } from './template.ts';
export { sniffAnimatedRaster, sniffVideoContainer } from './media-sniff.ts';
export type { AnimatedRasterKind, VideoContainer } from './media-sniff.ts';
export { buildInputModel, summarizeInputs, DEFAULT_FILE_MAX_BYTES } from './inputs.ts';
export { parseUrlState, serializeUrlState, RESERVED } from './url-mode.ts';
export { LANGS, LANG_META, isLang, normalizeLang, flagEmoji, sortedLangs } from './lang.ts';
export type { Lang, LangMeta, LangSort } from './lang.ts';
export { packQuery, unpackToken, expandQuery, hasPackedState, isPackAvailable, PACK_PARAM } from './url-pack.ts';
export { packEncrypted, unpackEncrypted, hasEncryptedState, isEncryptAvailable, ENC_PARAM } from './url-pack.ts';
export { parseEmbedUrl } from './embed.ts';
export { parseToolUrl, buildEmbedUrl, isToolUrl } from './tool-url.ts';
export {
  assertComposeStack, ComposeGuardError, MAX_COMPOSE_DEPTH,
  bakeAssetRef, isBakedRef, MAX_BAKED_URL_CHARS,
  assetIdForUrl, blocksForUrl,
} from './bake.ts';
export { toCSV, parseDelimited, detectDelimiter, parseBatchCsv, batchCsvTemplate } from './batch.ts';
export type { BatchRow, BatchTemplateTool } from './batch.ts';
export { buildExportMeta } from './metadata.ts';
export { extractFileMetadata, META_GROUP_ORDER, META_GROUP_LABEL } from './file-metadata.ts';
export type { FileMetadata, MetaField, MetaGroup } from './file-metadata.ts';
export { stripMetadata, isStrippableFormat } from './strip-metadata.ts';
export type { StripFormat } from './strip-metadata.ts';
export {
  embedWatermark, detectWatermark, canCarryWatermark, WATERMARK_VERSION, DEFAULT_STRENGTH,
  LOSSLESS_STRENGTH, DETECT_THRESHOLD, MIN_IMPRINT_BLOCKS, detectionThreshold, V2_BAND_SIZE,
} from './pixel-watermark.ts';
export type { EmbedOptions, DetectResult, WatermarkGeometry } from './pixel-watermark.ts';
export { detectWatermarkSearch, bilinearResampleRgba, SEARCH_DETECT_FLOOR } from './watermark-search.ts';
export type { SearchResult } from './watermark-search.ts';
export { unfilterPng } from './png-unfilter.ts';
export { analyzeLsb } from './steganalysis.ts';
export type { LsbAnalysis } from './steganalysis.ts';
export { decodeTrustmarkPayload, encodeTrustmarkPayload, TRUSTMARK_PAYLOAD_BITS, buildLollyDurablePayload, readLollyDurable, LOLLY_DURABLE_SCHEMA_VERSION } from './trustmark.ts';
export type { TrustmarkDecodeResult, TrustmarkSchemaName, LollyDurable } from './trustmark.ts';
export { contentSealConsensus, CONTENTSEAL_MESSAGE_BITS, CONTENTSEAL_DEFAULT_TAU } from './contentseal.ts';
export type { ContentSealConsensus } from './contentseal.ts';
export {
  UNITS, CSS_DPI, isUnit, parseDimension,
  toInches, isPhysical, toPixels, toPoints, toCssPx, toCssLength, toUnit,
} from './units.ts';
export {
  srgbIccProfile, iccProfileBytes, COLOR_PROFILES,
  rgbToCmyk, cmykCondition, CMYK_CONDITIONS, DEFAULT_CMYK_CONDITION,
} from './color.ts';
export {
  computePrintGeometry, cmykToRgbApprox, PRINT_MARK_DEFAULTS,
} from './print-marks.ts';
export { parseSvgPath, parseSvgPathArgs, svgArcToBeziers } from './svg-path.ts';
export { extractSvgColors } from './svg-colors.ts';
export { renderZzfxm, zzfxG, zzfxM, zzfxR, zzfxV } from './zzfxm.ts';
export type {
  ZzfxSong, ZzfxInstrument, ZzfxChannel, ZzfxPattern, RenderedPcm,
} from './zzfxm.ts';
export { parseMidi, midiToSong, midiToZzfxm } from './midi.ts';
export type { ParsedMidi, MidiToSongOptions } from './midi.ts';
export { composeSong, PRESETS, SCALES, mulberry32, patternSeconds } from './zzfx-compose.ts';
export type { SongSpec, Archetype, PresetName, ScaleName } from './zzfx-compose.ts';
export {
  parseCssLength, cornerRadii, uniformRadius, insetCorners, roundedRectPath, parseBoxShadow,
} from './css-box.ts';
export {
  parseClipShape, parseRadialGradient, parseDropShadowFilter,
  splitCssArgs, parseGradientAngle, parseGradientStop,
} from './css-paint.ts';
export type { ClipShape, GradientStop, RadialGradient, DropShadow } from './css-paint.ts';
export { emitEmf } from './emf.ts';
export { emitEps } from './eps.ts';
export { emitDxf } from './dxf.ts';
export { buildPptxParts, EMU_PER_INCH, EMU_PER_PX } from './pptx.ts';
export type {
  PptxSlide, PptxShape, PptxRect, PptxText, PptxPic, PptxRun, PptxPara, PptxFill, PptxMedia, PptxBuildOpts,
  PptxTable, PptxTableCell, PptxLine, PptxTheme, PptxPath,
} from './pptx.ts';
export { svgToCustGeomPaths } from './svg-custgeom.ts';
export { rebrandPptxParts } from './pptx-patch.ts';
export type { RebrandPlan, RebrandTheme, RebrandReport, PartMap } from './pptx-patch.ts';
export { isPptx, readPptx, pptxMediaImages } from './pptx-read.ts';
export type {
  PptxParts, XmlParser, PptxDeckRead, PptxReadSlide, PptxReadNode, PptxReadTheme,
  PptxReadColor, PptxReadRun, PptxReadPara, PptxTextNode, PptxShapeNode, PptxPicNode,
  PptxTableNode, PptxUnknownNode, PptxMediaImage,
} from './pptx-read.ts';
export {
  buildPdfXXmp, formatPdfDate, makeDocumentId, pdfxOutputIntentSpec, PDFX_VERSION,
} from './pdfx.ts';
export { buildC2paManifest, embedC2paInPdf, embedC2pa, attachC2paStore, exportActionSteps, C2PA_FORMATS, LOLLY_EXPORT_ASSERTION, DIGITAL_SOURCE_TYPE, CAPTURE_SOURCE_TYPE, SCREEN_SOURCE_TYPE } from './c2pa.ts';
export type { C2paActionInput } from './c2pa.ts';
export { verifyC2pa, verifyC2paPdf, extractC2paFromPdf, prepareC2paIngredient, prepareC2paIngredientFromStore, extractC2paStore } from './c2pa-verify.ts';
export type { C2paIngredientData, C2paReport, C2paCheck, C2paSignerIdentity } from './c2pa-verify.ts';
export { C2PA_CHECK, isExpiredOnly, resolveVerdict, defaultTrustAnchors } from './c2pa-verdict.ts';
export type { C2paCheckCode, C2paVerdict, C2paVerdictInput, C2paVerdictState, C2paVerdictTone } from './c2pa-verdict.ts';
export { c2paTrustAnchors, LOLLY_CA_ROOT_PEM } from './c2pa-trust.ts';
export {
  verifySeal, parseSealRecord, parseSealRecords, computeSealDigest, assembleSealMessage,
  resolveRanges, verifySealSignature, importSealKey,
} from './seal.ts';
export type { SealRecord, SealRange, SealVerifyResult, SealPublicKeyResolver } from './seal.ts';
export { pemToDer, derToPem, generateCaRoot, issueLeafCert } from './x509.ts';
export { packApng } from './apng.ts';
export { packWebpAnim } from './webp-anim.ts';
export { packTiff } from './tiff.ts';
export { videoProvenanceTags, embedMp4Meta, embedWebmMeta } from './video-meta.ts';
export { parseDataRows, DEFAULT_ROW_LIMIT } from './data-import.ts';
export {
  decomposeMatrix, boxGeomFromBBox, mapWeight, mapFontFamily, mapAlign,
  safeColor, nodeToBox, finalizeBoxes, parsePenpotContent, penpotShapeToNode,
  figmaNodesToNodes, colorRunsToText, decodeFigVectorPath,
} from './design-map.ts';
export type { DesignMapFonts, DesignMapSeedColors, DesignMapOptions } from './design-map.ts';
export { interpretPdfPage, parseToUnicode, toUnicodeDecoder } from './pdf-map.ts';
export type { PdfPageInput, PdfNode, PdfResources, PdfXObject, PdfFontInfo, FontDecoder } from './pdf-map.ts';
export { pdfNodesToSvg, windowPdfSvg } from './pdf-svg.ts';
export type { PdfSvgOptions, SvgWindow } from './pdf-svg.ts';
export {
  createTokenSet, resolveColorValue, colorToHex,
  isAlias, aliasPath, isTokenValue, TOKEN_EXT,
} from './tokens.ts';
export {
  parseOklch, formatOklch, hexToOklch, oklchToHex, mixOklch, contrastRatio, deriveBrandTokens,
  RAMP_STEPS_MIN, RAMP_STEPS_MAX, RAMP_STEPS_DEFAULT,
} from './brand-derive.ts';
export type { Oklch, BrandDeriveOptions } from './brand-derive.ts';
export { SCHEME_KINDS, generateSchemeAccents } from './brand-schemes.ts';
export type { SchemeKind, AccentCandidate } from './brand-schemes.ts';
export { deltaEOk, apcaContrast, rampOklab, classBreaks, distinctColors, makeColorApi } from './color-tools.ts';
export type { RampOptions, DistinctColorsOptions } from './color-tools.ts';
export { nearestBrandColor, mapPaletteToBrand, mapFontsToBrand, suggestRebrandTheme } from './brand-map.ts';
export type { BrandSwatch, RoleHint, NearestBrandColorOptions, NearestBrandColor, BrandFonts } from './brand-map.ts';
export {
  coerceTokensDoc, assembleTokenSetFiles, extractPenpotProject, summarizeTokensDoc,
} from './brand-import.ts';
export type { TokensExtraction } from './brand-import.ts';
export {
  parseThemedAssetId, buildThemedAssetId, isThemableIconSvg, isValidThemeId,
  applyIconTheme, restyleIconTheme, parseIconThemesDoc,
} from './icon-theme.ts';
export type { IconTheme, IconThemesDoc, ParsedThemedAssetId } from './icon-theme.ts';
export {
  parseTreatedAssetId, buildTreatedAssetId, isValidTreatmentId, stripAssetModifiers,
  parsePhotoTreatmentsDoc, treatmentFilterSvg, wrapRasterWithTreatment,
} from './photo-treatment.ts';
export type { PhotoTreatment, PhotoTreatmentsDoc, ParsedTreatedAssetId, RasterTreatmentWrap } from './photo-treatment.ts';
export { derivePhotoTreatmentsDoc, deriveIconThemesDoc } from './brand-treatments.ts';
export type { DerivedPhotoTreatments, DerivedIconThemes } from './brand-treatments.ts';
export {
  hashR6, preparePassword, buildEncryptDictValues, encryptObjectBytes,
} from './pdf-crypto-r6.ts';
export type { EncryptDictInput, EncryptDictValues } from './pdf-crypto-r6.ts';
export {
  crc32, zipCryptoEncrypt, deriveAesZipKey, aesZipEncryptEntry, buildEncryptedZip,
} from './zip-crypto.ts';
export type { ZipTier, ZipEntryInput, AesZipKeys } from './zip-crypto.ts';

// Per-minor contract changelog: engine/CHANGELOG.md (one entry per ENGINE_VERSION
// minor, moved out of this barrel so prose edits stop conflicting with exports).
export { ENGINE_VERSION } from './version.ts';
export { satisfiesRange, parseVersion } from './semver-range.ts';
export { encodeFsToken, decodeFsToken } from './fs-token.ts';
export {
  sessionVersionStamp,
  migrateSessionRecord,
  SESSION_FORMAT_VERSION,
  SESSION_READER_VERSION,
} from './session-record.ts';
export type { SessionVersionStamp, StoredSessionRecord, SessionLogger } from './session-record.ts';
