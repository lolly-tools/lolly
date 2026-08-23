// SPDX-License-Identifier: MPL-2.0
/**
 * Engine public surface.
 *
 * Host shells (web/Tauri/CLI) import from here. Tools NEVER import from here - 
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
export { validateManifest, validateRateCard } from './validate.ts';
export { createRuntime, HOOK_BUDGET_MS, inRealmHookExecutor } from './runtime.ts';
export type { HookExecutor, Hooks } from './runtime.ts';
export { hydrate, annotateTemplate } from './template.ts';
export { sniffAnimatedRaster, sniffVideoContainer, sniffLayeredRaster, sniffContainer } from './media-sniff.ts';
export type { AnimatedRasterKind, VideoContainer, LayeredRasterKind, SniffedContainer } from './media-sniff.ts';
// Layered bitmap import/export (1.102): PSD/PSB + XCF readers, PSD writer.
export { isPsd, readPsd, PsdUnsupportedError } from './psd.ts';
export type { PsdReadOptions } from './psd.ts';
export { writePsd } from './psd-write.ts';
export type { PsdWriteDoc, PsdWriteLayer } from './psd-write.ts';
export { isXcf, readXcf, XcfUnsupportedError } from './xcf.ts';
export type { XcfReadOptions } from './xcf.ts';
export { packBitsEncode, packBitsDecode } from './packbits.ts';
export {
  PSD_BLEND_TO_CSS, CSS_TO_PSD_BLEND, XCF_MODE_TO_CSS, psdBlendToCss, xcfModeToCss,
} from './raster-layers.ts';
export type { CssBlendMode, RasterLayer, LayeredRasterDoc, InflateFn } from './raster-layers.ts';
export { buildInputModel, summarizeInputs, normalizeTableValue, DEFAULT_FILE_MAX_BYTES } from './inputs.ts';
export type { TableValue } from './inputs.ts';
export { parseUrlState, serializeUrlState, serializeHdr, encodeTableCompact, decodeTableCompact, RESERVED, HDR_DEFAULTS } from './url-mode.ts';
// The `s=` state address + the still-export frame filter both shells apply (plan 112).
export { parseFrameAddress, selectFramePage, frameFilterApplies, FRAME_FILTER_SKIP_FORMATS } from './frame-address.ts';
export type { FrameAddress, FrameSelection } from './frame-address.ts';
export { looksLikeTable, parseTableText, toTsv, toMarkdown, toHtmlTable } from './table-text.ts';
export type { HdrSettings, DepthSetting } from './url-mode.ts';
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
export { toCSV, parseDelimited, detectDelimiter, parseBatchCsv, batchCsvTemplate, batchCsvTemplateWithNotes } from './batch.ts';
export type { BatchRow, BatchTemplateTool } from './batch.ts';
export { buildExportMeta } from './metadata.ts';
export { extractFileMetadata, readMpfIndex, appendedIsExpected, META_GROUP_ORDER, META_GROUP_LABEL } from './file-metadata.ts';
export type { FileMetadata, MetaField, MetaGroup, JpegMpfIndex, MediaProducer } from './file-metadata.ts';
export { stripMetadata, isStrippableFormat, hasResidualMetadata } from './strip-metadata.ts';
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
export { embedDurableIntoRgba, packNchwSigned, sampleBilinear, TRUSTMARK_MODEL_RESOLUTION, TRUSTMARK_Q_WM_STRENGTH, TRUSTMARK_MIN_SIDE } from './trustmark.ts';
export type { TrustmarkDecodeResult, TrustmarkSchemaName, LollyDurable } from './trustmark.ts';
export type { DurableEmbedHooks, DurableEmbedMathOptions, CoverResizer, DurableEncoderRun } from './trustmark.ts';
export { contentSealConsensus, CONTENTSEAL_MESSAGE_BITS, CONTENTSEAL_DEFAULT_TAU } from './contentseal.ts';
export type { ContentSealConsensus } from './contentseal.ts';
export {
  UNITS, CSS_DPI, isUnit, parseDimension,
  toInches, isPhysical, toPixels, toPoints, toCssPx, toCssLength, toUnit,
} from './units.ts';
export {
  srgbIccProfile, pqBt2020IccProfile, iccProfileBytes, COLOR_PROFILES,
  rgbToCmyk, cmykCondition, CMYK_CONDITIONS, DEFAULT_CMYK_CONDITION,
} from './color.ts';
export {
  FINISH_MASK_CMYK, buildCmykPaletteMap, cmykKey, paletteHasFinish,
} from './cmyk-palette.ts';
export type { BrandPaletteEntry, PaletteHit, PaletteSpotHit } from './cmyk-palette.ts';
export {
  parseColor, parseColorToSrgb8, convertColor, gamutMapSrgb,
  colorToSrgb, colorToSrgb8, colorToHexString, formatColor,
  interpolateColor, deltaEOkColor, gradientStops, findColorToken,
  NAMED_COLORS, isNamedColor,
  MISSING_C0, MISSING_C1, MISSING_C2, MISSING_ALPHA,
} from './css-color.ts';
export type {
  CssColor, ColorSpaceTag, HueDirection, MixOptions, BakeOptions, ColorStop,
} from './css-color.ts';
export {
  parseGradientSpec, formatGradientSpec, gradientSpecToCss, gradientSpecStops,
  GRADIENT_KINDS, DEFAULT_GRADIENT_SPACE, MAX_GRADIENT_STOPS,
} from './gradient-spec.ts';
export type { GradientSpec, GradientKind, GradientSpecStop } from './gradient-spec.ts';
// Deep pixel buffers (plans/61-deeprichpixels.md section 5.1) - the Float32Array
// linear-light working frame whose space travels with the data, plus every
// converter between it and the byte world. Exported alongside hdr.ts because
// hdrViewTransform/pqEncodeFrame consume and return DeepFrames - a caller of
// those needs createDeepFrame/fromU8Srgb/convertSpace from the same surface.
export {
  PIXEL_SPACES, createDeepFrame, srgbToLinear, linearToSrgb,
  fromU8Srgb, toU8Srgb, fromU16, toU16,
  floatToHalf, halfToFloat, packF16, unpackF16,
  premultiply, unpremultiply, mapScanlines, convertSpace,
} from './pixels.ts';
export type { PixelSpace, DeepFrame } from './pixels.ts';
export { hdrBoostToPQ, pqEncode, hdrViewTransform, pqEncodeFrame, pqToU16, HDR_PQ_CICP } from './hdr.ts';
export type { HdrBoostOptions, PqImage } from './hdr.ts';
export {
  computePrintGeometry, cmykToRgbApprox, PRINT_MARK_DEFAULTS,
} from './print-marks.ts';
// Preflight - pre-export findings over a plain job description. Sits beside
// print-marks: the engine owns the RULES, each shell collects the FACTS from its
// own platform. Counts and assertions only; there is no cost/currency concept
// anywhere in it (plans/65-preflight-and-cost.md section 8).
export {
  preflight,
  PRINT_MARK_FORMATS, SEPARATING_FORMATS, SPOT_PLATE_FORMATS,
  HDR_FORMATS, DURABLE_FORMATS, CUTS_FORMATS, MOTION_FORMATS, PAGED_FORMATS,
  KNOWN_FINISHES,
} from './preflight.ts';
export type {
  PreflightJob, PreflightReport, PreflightManifest, PreflightInput, PreflightSettings,
  PreflightSize, PreflightSwatch, PreflightSource, StageFacts, ModelPhase, SizeSource,
  Finding, FindingId, Severity, Count, Bound, QuantityKind, QuantityUnit,
  Fact, UnknownReason, Evidence,
} from './preflight.ts';
// Rate card - the printer's own card, stored and validated (never a source of
// prices). parseRateCard is the pure reader; computeCost is the Phase 4 arithmetic
// (integer minor units, no currency formatting) that multiplies the card's rates by
// preflight's counts and emits a scalar total ONLY on full coverage (rule 2).
// plans/65-preflight-and-cost.md section 8.
export { parseRateCard, isRateCardError, EXAMPLE_RATECARD_DIGEST, computeCost } from './rate-card.ts';
export type {
  RateCard, RateCardLine, RateCardError, DisabledReason,
  CostWorking, CostRow, CostAdjustment, CostUncostedLine, CostUncostedReason,
  CostInput, CostBreakApplied, CostRowQuantityKind,
} from './rate-card.ts';
export { parseSvgPath, parseSvgPathArgs, svgArcToBeziers } from './svg-path.ts';
export { extractSvgColors } from './svg-colors.ts';
// Lift layers (1.119, plans/104 section 7): an SVG's own layers enumerated into one
// standalone document each, so a flat drawing becomes a stack of boxes with real
// depth. DOM-free, so the CLI lifts the same way the editor does.
// 1.121 (plans/104 P3.2) adds the two pieces that make a lift a STACK rather than
// a partition: a layer holding nearly all the ink is descended into and
// re-clustered (the hero problem), and a derived document is cropped to its own
// ink where that is provably safe - so a 16 px icon's depth shadow costs a 16 px
// gaussian instead of a full-frame one.
export {
  enumerateSvgLayers, svgRootViewBox,
  SVG_LAYERS_MAX, SVG_LAYERS_MAX_CHARS, SVG_LAYERS_MAX_TAGS, SVG_LAYERS_MAX_CANDIDATES,
  SVG_LAYERS_MAX_DEPTH, SVG_LAYERS_MAX_DESCENT, SVG_LAYERS_MAX_REFS,
  SVG_LAYERS_HEAVY_BYTES,
  SVG_LAYERS_HERO_SHARE, SVG_LAYERS_HERO_ROUNDS, SVG_LAYERS_HERO_MIN_INK,
  SVG_LAYERS_HERO_BUDGET, SVG_LAYERS_HERO_GAP_SCALES, SVG_LAYERS_PEER_AREA_RATIO,
} from './svg-layers.ts';
export type { SvgLayer, SvgLayerBox, SvgLayersResult, SvgLayerOptions } from './svg-layers.ts';
export { renderZzfxm, zzfxG, zzfxM, zzfxR, zzfxV } from './zzfxm.ts';
export type {
  ZzfxSong, ZzfxInstrument, ZzfxChannel, ZzfxPattern, RenderedPcm,
} from './zzfxm.ts';
// Audio analysis (host.audio, v1.71) - decoded PCM in, a per-frame reactivity
// track out. The shell owns the decoder and attaches this; the maths lives here so
// the web shell and the CLI read identical numbers off the same clip.
export { analysePcm, fftInPlace } from './audio-analyse.ts';
export type { AudioAnalysis, AudioAnalyseOpts, AudioFrames } from './audio-analyse.ts';
// Captions (host.speech, v1.96) - spoken-word timings in, subtitle cues out. The
// grouping and VTT/SRT timestamp maths live here so the browser and a headless
// export break caption lines at the same words.
export { groupWordsToCues, cuesToVtt, cuesToSrt, cueAt } from './captions.ts';
export type { CaptionCue, GroupWordsOpts } from './captions.ts';
// Text AI-likelihood signals (plans/125) - a string in, a tiered SIGNAL (never a
// verdict) out: byte-level artifact tells on digital text, chatbot-boilerplate
// phrase evidence, English-gated writing-style heuristics, per-finding heat
// temperatures + a rolling-window heat map, and a hedged style guess (only a
// leaked fingerprint names a model with confidence). Pure + model-free, so the
// verify view, the catalog, the CLI, and the OCR path read identical numbers.
// LEXICON_VERSION keys persisted analyses to the tell lists that produced them.
export { analyzeTextSignals, applyModelEstimate, LEXICON_VERSION } from './text-signals.ts';
// Document facts (plans/126 UX wave) - the neutral census behind the panels'
// interrogation surface: hidden characters by name, script shares, link
// hosts, structure and line-ending forensics. Counts, never verdicts.
export { textFacts, invisibleCharName, hiddenCharSeverity } from './text-facts.ts';
export type { TextFacts, HiddenCharCount, ScriptShare, LinkHost } from './text-facts.ts';
export type {
  TextSignalSource, TextSignalBand, TextSignalTier, TextSignalSpan,
  TextSignalFinding, TextStyleGuess, TextSignalReport, AnalyzeTextSignalsOpts,
  TextSignalDocKind, TextHeatCell, TextHeatmap, AiModelEstimate,
} from './text-signals.ts';
// Humanize (plans/125) - the DETERMINISTIC, on-device clean-up of the mechanical AI
// artifacts the analysis flags (invisible chars, leaked model tokens, curly-quote/em-dash
// noise). No model, so no genAI stamp; the semantic tells stay HIGHLIGHTED for a person to
// reword. The honest inverse of a detection-evading "humanizer".
export { humanizeText } from './humanize.ts';
export type { HumanizeChange, HumanizeResult } from './humanize.ts';
// Reword (plans/127) - the SEMANTIC half humanize defers, pure side only: the
// deterministic suggestion table, the sentence spans worth offering a model,
// the shared prompt, and the GATE that decides which model candidates a shell
// may ever offer (no longer, facts/names intact, analyser-calmer, no artifact).
// The model itself is shell-side; accepting its output stamps aiGenerated.
export {
  suggestRewrites, applySuggestion, rewordableSpans, buildRewordMessages,
  normalizeRewordReply, rewordGate, rewordCandidates, REWORD_SYSTEM_PROMPT,
} from './reword.ts';
export type {
  RewordSuggestion, RewordSpan, RewordMessage, RewordVerdict, RewordCandidate,
} from './reword.ts';
// Statistical text watermark (Kirchenbauer et al., arXiv:2301.10226) - the
// green-list scheme Lolly's reword generation embeds and /verify detects: the
// keyed hash + logit bias for an embedder, the unique-bigram z-test (whole text
// and windowed) for a detector. The key is public - a match is a provenance
// disclosure, not a cryptographic guarantee.
export {
  mix32, isGreenToken, addGreenBias, greenListZ, binomialTailP, scoreTokenWatermark,
  REWORD_WATERMARK,
} from './text-watermark.ts';
export type { WatermarkScheme, TextWatermarkScore } from './text-watermark.ts';
// Speech synthesis text machinery (host.speech, v1.98) - the pure half of Kokoro
// TTS: normalize/split/chunk maths, token-span bookkeeping, durations→word
// timings and clip concatenation. The shell's worker and Node scripts inject the
// model/phonemizer around it, so every surface speaks the same words the same way.
export {
  KOKORO_SAMPLE_RATE, KOKORO_STYLE_DIM, KOKORO_MODEL_ID, KOKORO_VOICE_BYTES,
  KOKORO_MODEL_BYTES, KOKORO_VOICES, KOKORO_DEFAULT_VOICE, SENTENCE_GAP_S,
  MAX_INPUT_CHARS, MAX_PHONEME_CHARS,
  splitSentences, splitWords, phonemeTokenSpans, chunkByPhonemeLength,
  wordTimingsFromDurations, concatClips, normalizeText, splitPunctuation,
  postProcessPhonemes, phonemizeChunk,
} from './speech-text.ts';
export type { TokenSpan, PhonemeChunk, SentenceClip, EspeakFn } from './speech-text.ts';
// The dependency-free WAV reader that backs host.audio where there is no platform
// codec (the Node shells). Byte parsing, so it lives beside tiff.ts/apng.ts.
export { parseWav, packWav } from './wav.ts';
export type { WavAudio, PackWavOptions, WavSampleFormat } from './wav.ts';
export { parseMidi, midiToSong, midiToZzfxm } from './midi.ts';
export type { ParsedMidi, MidiToSongOptions } from './midi.ts';
export { composeSong, PRESETS, SCALES, mulberry32, patternSeconds } from './zzfx-compose.ts';
// The seed → spec draw behind `zzfxm:<seed>`. Engine-side so every shell composes
// the SAME song from one id; the draw order is a frozen contract (see the fn).
export { generatedSongSpec } from './zzfx-compose.ts';
// The `zzfxm:<seed>[:<style>]` asset-id scheme - a song NAMED rather than stored.
// Sits beside tool-url.ts's scheme for the same reason: every shell that resolves
// an asset id has to recognise it, and they must not each invent the rule.
export { ZZFXM_SCHEME, ZZFXM_ARCHETYPES, isZzfxmRef, parseZzfxmRef, formatZzfxmRef } from './zzfxm-ref.ts';
export type { ZzfxmRef, ZzfxmArchetype } from './zzfxm-ref.ts';
export type { SongSpec, Archetype, PresetName, ScaleName } from './zzfx-compose.ts';
// Versioned design systems (plans/97 section 6a) - here for the same reason as the two
// id schemes above: the head/version asset-id scheme, the discovery-exclusion
// predicate and the resolution ladder must resolve IDENTICALLY in the web bridge,
// the MCP server and the CLI, so there is one implementation, not three.
// `sha256Hex` belongs to this surface too but is NOT re-listed here - the module
// re-exports catalog-integrity.ts's, already exported at the top of this barrel.
export {
  DESIGN_VERSION_LATEST, readVersionIndex, withVersionIndex, stripVersionIndex,
  slugifyVersion, isVersionSlug, suggestNextLabel, versionAssetId, isVersionAssetId,
  pickHeadAssetId, frozenAssetId, resolveDesignVersion, docChecksum,
  diffTokenDocs, collectAssetTokens, collectFontFamilies, applyPinnedAssets,
} from './design-version.ts';
export type { PinnedAsset, VersionEntry, VersionIndex } from './design-version.ts';
export {
  parseCssLength, cornerRadii, uniformRadius, insetCorners, roundedRectPath, parseBoxShadow, parseTextShadow, gaussianShadowBands, gaussianShadowRings,
  parseCssMatrix, isNonAffineTransform, multiplyMat, matAboutPivot, isAxisAlignedMat, matToSvg, IDENTITY_2D,
} from './css-box.ts';
export type { Mat2D } from './css-box.ts';
export {
  parseClipShape, parseRadialGradient, parseConicGradient, parseDropShadowFilter,
  splitCssArgs, parseGradientAngle, parseGradientStop, expandGradientStops,
} from './css-paint.ts';
export type { ClipShape, GradientStop, RadialGradient, ConicGradient, DropShadow } from './css-paint.ts';

// Vector geometry kernel (engine/src/geom/) - exact cubic Bezier operations, the
// substrate for boolean ops, path offsetting and stroke outlining. Nothing here
// flattens, samples or rasterises; see geom/bezier.ts for why that matters.
export {
  type Cubic, type Pt as GeomPt, type Box as GeomBox,
  lineToCubic, evalCubic, tangentAt, splitCubic, subCubic, extremaCubic,
  boundsCubic, hullBounds, boxesOverlap, flatnessCubic, lengthCubic,
  flattenCubic, isLineCubic, signedAreaCubic, nearestOnCubic,
} from './geom/bezier.ts';
export {
  type Intersection, EPS as GEOM_EPS,
  intersectSegments, intersectLineCubic, intersectCubics, cubicRoots01,
} from './geom/intersect.ts';
// The path model the operators work on, plus lossless conversion to and from the
// `SubPath[]` that svg-path.ts parses - so a boolean's result re-enters any existing sink
// (the PDF, EMF, EPS and DXF emitters) with no new code path.
export {
  type Contour, type GeomPath, JOIN_EPS,
  contourStart, contourEnd, closeContour, contourArea, reverseContour, orientContour,
  pathBounds, compactPath, pathFromSubPaths, subPathsFromPath, toSvgPathData, contourPoint,
} from './geom/path.ts';
// Boolean operations. `GeomLimitError` is part of the contract, not an escape hatch:
// difference/intersection/xor THROW it rather than degrade past the bounded-work ceiling,
// because a valid-looking answer a caller cannot distinguish from the real one is worse
// than being told. (Union has an exact way out and takes it; `selfUnion` never throws,
// since offsetting and stroking depend on that.)
export {
  type BooleanOp, type FillRule, type BooleanOptions, GeomLimitError,
  booleanPath, unionPath, intersectPath, differencePath, xorPath, selfUnion,
  windingNumber, pointInPath,
} from './geom/boolean.ts';
// Offsetting and stroke outlining. Both resolve their own self-intersections through
// `selfUnion`, which is why Stage 2 had to land before either could be correct.
export {
  type JoinStyle, type OffsetOptions,
  offsetCubic, offsetContour, offsetPath, offsetSweep, distanceToPath, fitCubic,
} from './geom/offset.ts';
export { type CapStyle, type StrokeOptions, strokeToPath } from './geom/stroke.ts';
// Curve fitting, by area and moment matching (Levien). `ParamCurveFit` is the reason this
// is separate from offsetting: an exact offset can be SAMPLED for position and derivative
// analytically but has no Bezier form, and fitting the real curve rather than an
// approximation of it is what removes an error term. `simplifyCubics` must never be
// applied to boolean output by default - see its own warning.
export {
  type ParamCurveFit, type FitOptions,
  quadratureMoments, cubicAsSource, fitError, fitCubicMoment, fitToCubics, simplifyCubics,
} from './geom/fit.ts';
// The authored-spline seam: geometry runs on cubics, but what the USER edits stays in
// its own form (pen-tool nodes with continuity, Catmull-Rom, B-spline, one day Spiro).
// Lowering is one-directional and deliberate - see geom/spline.ts.
export {
  type Continuity, type Node as SplineNode, type SplineKind, type AuthoredPath,
  type HyperbezierSolution,
  toCubics, enforceContinuity, solveHyperbezier, hyperbezierCubics,
} from './geom/spline.ts';
// The wire form of an authored path - one delimiter-safe field value, so a pen shape
// can live in a `blocks` sub-field and a share link. Shell code (the pen-tool overlay)
// imports these; tool code reaches the SAME implementation through
// host.geom.encodeAuthored / decodeAuthored, so there is only ever one codec.
// A value carries one path or several (`*`-separated: a boolean result with a hole is
// several contours), and one path encodes byte-identically at either arity.
export {
  type AuthoredDecodeFail,
  encodeAuthoredPath, encodeAuthoredPaths,
  decodeAuthoredPath, decodeAuthoredPaths, decodeAuthoredPathsResult,
} from './geom/authored-url.ts';
// The tool-facing face of all of the above (`host.geom`, v1.64): SVG path data in, SVG
// path data out, bounded parsing for untrusted `d` strings, and failures RETURNED as
// codes rather than thrown - because a throw out of a hook is logged and discarded,
// which would make a pen tool go quiet instead of telling the user anything.
export { makeGeomApi } from './geom-api.ts';
// Connector / line / arrow geometry (plan 90 R1) - one source for the editor preview, the
// committed/export render, and the CLI. The host bridge primitive exposes buildConnectorSvg.
export {
  edgeAnchor, edgeBorderPt, edgeWaypoints, edgeNested, connectorRoute,
  roundedEdgePath, smoothEdgePath, edgeArrowHead, edgeHeadInset,
  isEdgePoint, parseEdgePoint, formatEdgePoint, edgeEndRect, buildConnectorSvg,
  // plan 96 P1 - heads on the unified path primitive, and the host.connectors factory.
  pathHeadSvg, pathHeadInset, pathHeadSize, makeConnectorsApi,
  // plan 96 P3/P5 - a BOUND path is routed by its own spline kind, and ONE routed-line
  // renderer serves both that and the legacy edge model.
  pathRouteStyle, isConnectorRouteStyle, CONNECTOR_ROUTE_STYLES, routedLineSvg,
} from './connectors.ts';
export type { EdgeRect, EdgeAnchor, ConnectorRoute, ConnectorRenderOpts, ConnectorDecor, PathHeadOpts } from './connectors.ts';
// Dash fitting (plan 96) - manual `stroke-dasharray` entry (numbers only, the injection
// boundary) and Illustrator-style corner-fit dashes, as an array for a live preview or as
// absolute segments for the committed/export render. Reached by tools via
// host.connectors.dashFit.
export { parseDashArray, cornerFitDashArray, dashSegments } from './dash-fit.ts';
export type { DashSegment, DashFitOpts } from './dash-fit.ts';
export { emitEmf } from './emf.ts';
export { emitEps } from './eps.ts';
export { emitDxf } from './dxf.ts';
export { emitWmf } from './wmf.ts';
export { buildPptxParts, EMU_PER_INCH, EMU_PER_PX } from './pptx.ts';
export type {
  PptxSlide, PptxShape, PptxRect, PptxText, PptxPic, PptxRun, PptxPara, PptxFill, PptxMedia, PptxBuildOpts,
  PptxTable, PptxTableCell, PptxLine, PptxTheme, PptxPath, PptxLayout, PptxPlaceholder, PptxPhType,
} from './pptx.ts';
export { svgToCustGeomPaths, svgToNativePptx } from './svg-custgeom.ts';
export type { SvgNativePptx } from './svg-custgeom.ts';
export { rebrandPptxParts } from './pptx-patch.ts';
export type { RebrandPlan, RebrandTheme, RebrandReport, PartMap } from './pptx-patch.ts';
// readingOrder is aliased: design-map.ts already owns the bare name here.
export { isPptx, readPptx, pptxMediaImages, readingOrder as pptxReadingOrder } from './pptx-read.ts';
export type {
  PptxParts, XmlParser, PptxDeckRead, PptxReadSlide, PptxReadNode, PptxReadTheme,
  PptxReadColor, PptxReadRun, PptxReadPara, PptxTextNode, PptxShapeNode, PptxPicNode,
  PptxTableNode, PptxUnknownNode, PptxMediaImage,
  // The read-side placeholder record; aliased because the WRITER's layout
  // placeholder (pptx.ts) already owns the bare name on this surface.
  PptxPlaceholder as PptxReadPlaceholder,
} from './pptx-read.ts';
export { deckToMarkdown } from './deck-md.ts';
export type { DeckMarkdown, DeckMediaRef } from './deck-md.ts';
export type { DocBlock, DocInline, DocListItem, DocTableCell, DocMedia } from './doc-model.ts';
export { mdFromBlocks, htmlFromBlocks } from './doc-md.ts';
// XmlParser is NOT re-exported from docx-read: pptx-read already owns the name
// on this surface and the shapes are identical.
export { isDocx, readDocx } from './docx-read.ts';
export type { DocxParts, DocxReadResult } from './docx-read.ts';
export {
  buildPdfXXmp, formatPdfDate, makeDocumentId, pdfxOutputIntentSpec,
  pdfxProfileEligibility, PDFX_VERSION,
} from './pdfx.ts';
export type {
  PdfXOutputIntentOptions, PdfXOutputIntentSpec, PdfXProfileFacts, PdfXXmpOptions,
} from './pdfx.ts';
export { buildC2paManifest, embedC2paInPdf, embedC2pa, attachC2paStore, exportActionSteps, collectAiIngredientDeclarations, C2PA_FORMATS, LOLLY_EXPORT_ASSERTION, DIGITAL_SOURCE_TYPE, CAPTURE_SOURCE_TYPE, SCREEN_SOURCE_TYPE, GENERATED_SOURCE_TYPE, COMPOSITE_SOURCE_TYPE } from './c2pa.ts';
export type { C2paActionInput, AiIngredientDeclaration } from './c2pa.ts';
export { verifyC2pa, verifyC2paPdf, extractC2paFromPdf, prepareC2paIngredient, prepareC2paIngredientFromStore, collectIngredients, extractC2paStore, parseCertificate, signedBy } from './c2pa-verify.ts';
export type { C2paIngredientData, C2paReport, C2paCheck, C2paSignerIdentity, ParsedCertificate } from './c2pa-verify.ts';
export type { Signer as C2paSigner } from './c2pa.ts';
export { C2PA_CHECK, isExpiredOnly, resolveVerdict, defaultTrustAnchors } from './c2pa-verdict.ts';
export type { C2paCheckCode, C2paVerdict, C2paVerdictInput, C2paVerdictState, C2paVerdictTone } from './c2pa-verdict.ts';
export { c2paTrustAnchors, LOLLY_CA_ROOT_PEM } from './c2pa-trust.ts';
export { c2paDefaultOn, imprintDefaultOn, isImprintFormat, IMPRINT_FORMATS, isImprintContainerFormat, IMPRINT_CONTAINER_FORMATS } from './provenance-defaults.ts';
export type { ProvenanceManifest } from './provenance-defaults.ts';
export {
  verifySeal, parseSealRecord, parseSealRecords, computeSealDigest, assembleSealMessage,
  resolveRanges, verifySealSignature, importSealKey,
} from './seal.ts';
export type { SealRecord, SealRange, SealVerifyResult, SealPublicKeyResolver } from './seal.ts';
export { pemToDer, derToPem, generateCaRoot, issueLeafCert } from './x509.ts';
export { packApng } from './apng.ts';
export { demuxApng } from './apng-decode.ts';
export type { ApngFrame, DemuxApngResult } from './apng-decode.ts';
export { packWebpAnim } from './webp-anim.ts';
export { demuxWebpAnim } from './webp-anim-decode.ts';
export type { WebpAnimFrame, DemuxedWebpAnim } from './webp-anim-decode.ts';
export { packTiff } from './tiff.ts';
export { packPng } from './png.ts';
export type { PackPngOptions, PngCicp, PngTextEntry, PngSamples } from './png.ts';
export { encodeBmp, decodeBmp, isBmp, BmpUnsupportedError } from './bmp.ts';
export type { EncodeBmpOptions, DecodedBmp } from './bmp.ts';
export { decodeIco, isIco, IcoDecodeError } from './ico-decode.ts';
export type { IcoImage, IcoRgbaImage, IcoPngImage } from './ico-decode.ts';
export { deflateRaw, zlibCompress, adler32 } from './deflate.ts';
export type { DeflateOptions } from './deflate.ts';
export { gzip, gunzip, inflateRaw } from './gzip.ts';
export { readZip, storeZip } from './zip.ts';
export type { ZipEntry, ZipStoreEntry, StoreZipOptions } from './zip.ts';
export { packTar } from './tar.ts';
export { readTar, readTarGz } from './tar-read.ts';
export type { TarFile } from './tar.ts';
export { sfntKind, sfntToWoff, woffToSfnt } from './font-convert.ts';
export type { SfntKind } from './font-convert.ts';
export { videoProvenanceTags, embedMp4Meta, embedWebmMeta } from './video-meta.ts';
export { embedWavInfo } from './riff-meta.ts';
export type { WavInfoTags } from './riff-meta.ts';
export { parseDataRows, rowsToCsv, DEFAULT_ROW_LIMIT } from './data-import.ts';
export { expandDerivedFormats } from './derived-formats.ts';
export { readXlsx, listXlsxSheets, DEFAULT_XLSX_ROW_LIMIT } from './xlsx-import.ts';
export type { ReadXlsxOpts, ReadXlsxResult, XlsxSheetInfo } from './xlsx-import.ts';
export { writeXlsx, colLetters } from './xlsx-write.ts';
export type { XlsxSheet, XlsxCell } from './xlsx-write.ts';
export { writeEpub } from './epub.ts';
export type { EpubDoc, EpubChapter } from './epub.ts';
export { readEpub } from './epub-read.ts';
export type { EpubReadDoc, EpubReadChapter } from './epub-read.ts';
export { writeOdt } from './odt.ts';
export type { OdtDoc, OdtBlock } from './odt.ts';
export { writeDocx } from './docx.ts';
export type { DocxDoc, DocxBlock, DocxMedia } from './docx.ts';
export {
  decomposeMatrix, boxGeomFromBBox, mapWeight, mapFontFamily, mapAlign,
  safeColor, nodeToBox, finalizeBoxes, parsePenpotContent, collectPenpotFontUsage, penpotShapeToNode, penpotGradientToSpec,
  penpotPathContentToD, penpotGradientSvgDef, penpotGroupToSvg, penpotDashArray, penpotBackgroundBlurPx,
  collectPenpotExportMarks, penpotFlowOrder, penpotAnimationToTransition,
  figmaNodesToNodes, figmaNodesToScenes, readingOrder, colorRunsToText, decodeFigVectorPath,
} from './design-map.ts';
export type { DesignMapFonts, DesignMapSeedColors, DesignMapOptions, DesignFrameScene, PenpotFontUsage, PenpotExportEntry, PenpotExportMark, PenpotStrokeInfo, PenpotSceneTransition, PenpotFlowOrder } from './design-map.ts';
export { collectPenpotComponents, penpotComponentSlots } from './design-components.ts';
export type {
  PenpotShapesByPage, PenpotComponent, PenpotComponentVariant, PenpotComponentSlot,
  PenpotComponentCollection, PenpotExternalCensus, PenpotExternalComponent,
} from './design-components.ts';
export { interpretPdfPage, parseToUnicode, toUnicodeDecoder } from './pdf-map.ts';
export type { PdfPageInput, PdfNode, PdfResources, PdfXObject, PdfFontInfo, FontDecoder, PdfShading, PdfPattern, PdfGradient, PdfGradientStop, PdfSoftMask, PdfSoftMaskDef } from './pdf-map.ts';
export { isShadowPlate, maskRegion, relativeLuminance, constantMask } from './pdf-smask.ts';
export type { MaskRegion } from './pdf-smask.ts';
export { pdfNodesToSvg, windowPdfSvg, cullPdfNodes, pdfNodeExtent, pdfNodeElementKind, CULL_PAD_PT } from './pdf-svg.ts';
export type { PdfSvgOptions, SvgWindow, CullWindow, CullResult, PdfExtent, PdfElementKind } from './pdf-svg.ts';

export { findVectorArtwork } from './pdf-artwork.ts';
export type { VectorArtwork, ArtworkOptions, ArtworkRect } from './pdf-artwork.ts';

export { findHiddenText, findHiddenTextInPages, describeHiddenText } from './pdf-redaction.ts';
export type { HiddenTextFinding, RedactionOptions, Rect as PdfRect } from './pdf-redaction.ts';

export { extractPageText, joinPageText } from './pdf-text.ts';
export type { PageText, TextBlock, TextLine, TextItem, BlockKind, PdfTextOptions, TaggedElement } from './pdf-text.ts';
export {
  createTokenSet, resolveColorValue, colorToHex,
  isAlias, aliasPath, isTokenValue, typographyFamilies, tokenSetNames, TOKEN_EXT,
} from './tokens.ts';
export {
  parseOklch, formatOklch, hexToOklch, oklchToHex, mixOklch, contrastRatio, deriveBrandTokens,
  RAMP_STEPS_MIN, RAMP_STEPS_MAX, RAMP_STEPS_DEFAULT,
} from './brand-derive.ts';
export type { Oklch, BrandDeriveOptions } from './brand-derive.ts';
export { gamutSolid, projectGamutSolid, projectSolidPoint, projectSolidPoints, solidPointOklch, labSolidUnit, gamutSolidToSvg, shadedSolidFill } from './gamut-solid.ts';
// A brand colour's faces: one canonical value plus per-space/per-profile
// overrides. The generalisation of PrintLock - the export walkers consult it, so
// it is engine-side rather than living in the brand editor.
export { readFaces, writeFace, colorFaces, faceDrift, canonicalValue } from './color-faces.ts';
export type { ColorFace, StoredFace, FaceTarget, FaceOrigin } from './color-faces.ts';
// An image's colours as a cloud in the same space the solid is drawn in.
export { imageColorCloud, UNIQUE_CAP } from './image-cloud.ts';
export type { ImageCloud, ImageCloudOpts, CloudPoint, CloudSpace } from './image-cloud.ts';
export type { GamutSolid, SolidQuad, SolidPoint, SolidView, ProjectedQuad, SolidEmbed, GamutSolidSvgOptions } from './gamut-solid.ts';
export { describeColor, contrastVsExtremes, wcagLevel, NOTATION_SPACES, EXTREMES_CONTRAST_FLOOR } from './color-describe.ts';
export type { ColorDescription, ColorNotation, ContrastVerdict, WcagLevel } from './color-describe.ts';

export type { EncodeSpace } from './gamut.ts';
export { GAMUTS, oklchGamut, inGamut, gamutWithin, maxChroma, clipToGamut, oklchSlice, encodeOklch, sliceGamutEdge, sliceGamutRegion } from './gamut.ts';
export type { GamutName, SlicePlane, SliceOptions, SliceImage } from './gamut.ts';
export {
  BUILTIN_GAMUT_SOURCES, P3_SOURCE, REC2020_SOURCE, SRGB_SOURCE, NO_GAMUT_SOURCE,
  GAMUT_PROBE_MAX, GAMUT_PROBE_START, gamutSourceId, resolveGamutSource, fastRgbContains,
} from './gamut-source.ts';
export type { BuiltinGamutName, GamutLimit, GamutSource, RenderingIntent } from './gamut-source.ts';
// How high a chroma axis has to reach for a given gamut, derived from the gamut
// itself (memoised) rather than fixed at one constant that clips Rec.2020 and
// leaves a dead band on sRGB.
export { peakChroma, chromaAxisMax, chromaTickStep } from './gamut-axis.ts';
// Which RING out of the active gamut a colour sits in - one membership question
// per candidate, never an index into an ordering (Display-P3 is not inside
// Rec.2020). The picker and the Colour Lab sliders share this classifier.
export { gamutTier, gamutTierProbe, BEYOND_TIER, GAMUT_TIER_LADDER } from './gamut-tier.ts';
// An ICC profile as a gamut: parse the bytes, then hand `iccGamutSource(p, intent)`
// to any gamut function above. The reader is hardened (never throws, returns null
// on malformed bytes) because profile bytes arrive from the user's own files.
export {
  parseIccProfile, iccGamutSource, iccGamutIntent, iccCharacterization,
  iccRoundTripDeltaE, iccRoundTripDecides, ICC_GAMUT_DELTA_E,
} from './icc.ts';
export type { IccProfile } from './icc.ts';
// ICC profiles APPLIED to DeepFrame pixels (the digiKam act): device ↔ PCS per
// scanline, tetrahedral device-link lattices for pure-LUT profiles, and the
// ICC v4 clause-8 rendering-intent fallback. Sits beside the reader it drives;
// like the reader it never throws - null on malformed/unusable input.
export { ICC_DEVICE_SPACE, iccFrameRefusal, iccResolvedIntent, applyIccToFrame, convertViaIcc } from './icc-pixels.ts';
export type { IccDirection } from './icc-pixels.ts';
export { SCHEME_KINDS, generateSchemeAccents, rotateHue, generateAnalogous, rotateRampHue } from './brand-schemes.ts';
export type { SchemeKind, AccentCandidate, AnalogousParams } from './brand-schemes.ts';
export {
  deltaEOk, apcaContrast, rampOklab, classBreaks, distinctColors, makeColorApi,
  // APCA's band interpretation, alongside WCAG 2's AA/AAA - carried together
  // because conformance is still measured against the ratio while APCA is the one
  // that models polarity.
  apcaUse, apcaVerdict, APCA_BANDS, APCA_SRGB_ONLY,
  // Inverse APCA: solve the OKLCH lightness that hits a target Lc on a given
  // background - the generative half of the forward apcaContrast eval.
  solveLightnessForApca,
} from './color-tools.ts';
export type { RampOptions, DistinctColorsOptions, ApcaUse, ApcaVerdict, ApcaSolveResult, ApcaSolveOptions } from './color-tools.ts';
// Chroma / colour-range keying - remove a flat background by perceptual (OKLab)
// distance, model-free. The pure math behind the video-matte colour-key method.
export { chromaKeyAlpha } from './chroma-key.ts';
export type { ChromaKeyOptions } from './chroma-key.ts';
// Telea 2004 fast-marching inpainting - the classical content-aware fill behind
// Retouch (plans/124 WP-E). Ported, not depended on: stock opencv.js omits
// cv.inpaint. Windows itself to the mask bounding box and returns a new frame.
export { inpaintTelea } from './inpaint.ts';
export type { InpaintFrame, InpaintOpts } from './inpaint.ts';
// Colour grading - the .cube/.3dl readers, the tetrahedral sampler, the RGBA
// frame apply and the film grain + vignette pass, promoted out of the darkroom
// tool so a shell can grade a whole VIDEO with the maths that graded the still
// (plans/130). The tool keeps its own copy because tools never import the
// engine; tests/grade-drift.test.ts pins the two together.
export {
  CUBE_MAX_N, TDL_MAX_N, GRAIN_REF_LONG_EDGE,
  parseCubeLut, parse3dlLut, parseLutText,
  sampleLut, applyLutFrame, applyGrainVignette, grainCellPx, gradeMulberry32,
} from './grade.ts';
export type { GradeLut, GrainVignetteParams } from './grade.ts';
// Palette exchange - a flat swatch list serialised as DTCG tokens JSON, CSS
// custom properties / classes, SCSS variables, a GIMP .gpl, or a binary Adobe
// .ase. Pure + DOM-free; attached to host.color (paletteExport/paletteExportBytes)
// and reused by the web shell's Swatches download, so both paths are byte-identical.
export {
  paletteTokensJson, paletteCssVariables, paletteCssClasses,
  paletteScssVariables, paletteGpl, paletteAse,
} from './palette-export.ts';
export type { PaletteSwatch } from './palette-export.ts';
// Tonal-curve model: a ramp as three editable L/C/H curves over tone position.
// Defaults reproduce the derived primary ramp byte-for-byte; the serializable
// form persists a hand-edited ramp under a token's $extensions.
export {
  defaultColorCurve, evalChannel, sampleCurve, bakeCurve, curveFromRamp,
  serializeCurve, deserializeCurve,
} from './color-curve.ts';
export type { CurvePoint, ChannelCurve, ColorCurve, ColorCurveJSON } from './color-curve.ts';
// Colour-vision-deficiency simulation (Machado 2009) + Rec.709 grayscale, for
// the Colour Lab's accessibility preview. Pure matrix math, DOM-free.
export { simulateCvd, toGrayscale, simulateCvdHex, toGrayscaleHex } from './color-vision.ts';
export type { CvdType, Rgb } from './color-vision.ts';
export { nearestBrandColor, mapPaletteToBrand, mapFontsToBrand, suggestRebrandTheme } from './brand-map.ts';
export type { BrandSwatch, RoleHint, NearestBrandColorOptions, NearestBrandColor, BrandFonts } from './brand-map.ts';
export {
  coerceTokensDoc, assembleTokenSetFiles, extractPenpotProject, summarizeTokensDoc, scanPenpotUsage,
  scanPenpotAppliedTokens,
} from './brand-import.ts';
export type { TokensExtraction, PenpotUsage, PenpotUsageColor, PenpotUsageGradient, PenpotAppliedToken } from './brand-import.ts';
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

// Keyframe tracks + the depth camera (1.114, plans/104): the `kf` wire grammar,
// per-channel sparse evaluation, the ease adapter, and the affine projection
// (fold, guard, DOF) every consumer of the feature shares. 1.118 added the `w`/`h`
// channels (absolute px, replace-for-segment) - see engine/CHANGELOG.md.
export {
  KF_CHANNELS, KF_CAMERA_CHANNELS, KF_CLAMPS, KF_Z_FIELD_CLAMP, KF_QUANTA, KF_BEZIER_QUANTUM,
  KF_MAX_KEYS, KF_MAX_CHARS, KF_MAX_TIME_MS, KF_MAX_BLUR, KF_CHARSET_RE,
  KF_EASE_TOKENS, KF_EASE_PRESETS, KF_HOLD_EASE, KF_DEFAULT_EASE, KF_LINEAR_EASE, KF_HOLD_CSS,
  KF_GUARD_U, KF_GUARD_BAND, KF_EFF_MAX, DOF_K, DEFAULT_CAMERA, DEFAULT_PERSPECTIVE,
  isKfChannel, isKfSafe, cubicBezierAt, normaliseKfEase, kfEasePoints, kfEaseAt,
  kfEaseCss, kfEaseName, kfEaseToken, subdivideKfEase,
  parseKf, serialiseKf, evaluateKf, kfChannelsUsed,
  projectDepth, depthForEff, projectLayer, dofBlur, resolveCamera,
  // 1.121 (plans/104 P2) - the tilt tier. `projectLayer` grows a `m` homography when
  // (and only when) the camera authors an angle; `cameraTilted` is the exact-zero gate
  // that keeps every screen-parallel document on the path it always took.
  cameraTilted, kfMatrix3dCss, projectSurfacePoint,
} from './keyframes.ts';
export type {
  KfChannel, KfCameraChannel, KfPose, KfEasePresetToken, KfEasePreset, KfEaseSubdivision,
  KfKey, KfKeyInput, KfTrack, KfParseOptions,
  KfCameraPose, KfCameraView, KfCameraClip, KfDepth, KfLayerPose, KfProjection, KfMatrix3,
} from './keyframes.ts';

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
