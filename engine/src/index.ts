// SPDX-License-Identifier: MPL-2.0
/**
 * Engine public surface.
 *
 * Host shells (web/Tauri/CLI) import from here. Tools NEVER import from here - 
 * tools talk to the host through the capability bridge passed to their hooks.
 */

export { loadTool, ToolLoadError, applyManifestI18n } from './loader.ts';
export type { LoadedTool, ToolManifest, LoadToolOpts, ToolIntegrityOpts } from './loader.ts';
export { resolveChartTheme, validateChartSpec, inspectChartSpec } from './chart-spec.ts';
export { CHART_SPEC_VERSION } from '@lolly-tools/core';
export type {
  ChartValue, ChartFieldType, ChartFieldRole, ChartFieldFormat, ChartDimension, ChartExportFidelity, ChartMark,
  ChartChannel, ChartFieldV1, ChartDatasetV1, ChartEncodingV1, ChartSeriesV1,
  ChartScaleV1, ChartAxisV1, ChartLegendV1, ChartFormatterV1, ChartThemeV1,
  ChartMotionV1, ChartAccessibilityV1, ChartPresentationV1, ChartSpecV1,
  ChartFindingSeverity, ChartFindingV1, ChartColumnProfileV1, ChartDataProfileV1,
  ChartRecommendationV1, ChartValidationResultV1, ResolvedChartReportV1,
} from '@lolly-tools/core';
export {
  canonicalJson, sha256Hex, jwkThumbprint, importSpkiOrJwkPublicKey,
  signCatalogEnvelope, verifyEnvelopeSignature, verifyCatalogEnvelope, verifyToolFile,
  CATALOG_SIG_ALG, CATALOG_SIG_PATH, CATALOG_SIGNED_TOOL_FILES,
} from './catalog-integrity.ts';
export type {
  CatalogSignatureEnvelope, UnsignedCatalogEnvelope, IntegrityResult,
} from './catalog-integrity.ts';
export { validateManifest, validateRateCard } from './validate.ts';
export { parseProviderRef, isProviderRef } from './asset-provider.ts';
export { DOCUMENT_API_VERSION, compileDocument, validateDocument, documentSchema, inspectDocument, diffDocuments, measureDocument, optimizeDocument, packageDocument, compile, validate, inspect, diff, measure, optimize, package, render } from './document-api.ts';
export type { CompiledDocument, DocumentInspection, DocumentDiff, DocumentMeasurement } from './document-api.ts';
export { createRuntime, HOOK_BUDGET_MS, inRealmHookExecutor } from './runtime.ts';
export {
  createHookWorkerCore, lockDownAmbientCapabilities, workerRpcMethods, introspectHost, gatherHostSeeds,
  STRICT_AMBIENT_GLOBALS, STRICT_NAVIGATOR_PROPERTIES, WORKER_HOOK_NAMES, IN_REALM_ONLY_HOOK_NAMES,
} from './hook-worker-core.ts';
export type {
  HostShape, HostSeeds, HookInitMsg, HookInvokeMsg, HookHostReplyMsg, HookDisposeMsg, HookWorkerIn, WorkerHookName,
  InRealmOnlyHookName, HookInitDoneMsg, HookInvokeDoneMsg, HookReportMsg, HookHostCallMsg, HookLogMsg, HookWorkerOut,
  HookWorkerPort, HookWorkerCoreOpts,
} from './hook-worker-core.ts';
export type { HookExecutor, Hooks } from './runtime.ts';
// Emoji (1.196): the runtime draws every emoji in a rendered tree from the
// chosen pinned pack. TYPES ONLY here on purpose - the pinned Unicode tables are
// half a megabyte, so the modules themselves stay behind the runtime's dynamic
// imports and a render with no emoji never loads them. A shell that needs the
// DOM pass calls runtime.applyEmojiToDom / runtime.revertEmojiDom.
export type { RuntimeEmojiPassOpts, RuntimeEmojiResult, RuntimeEmojiState } from './runtime.ts';
export type { EmojiDomNode, EmojiDomResult } from './emoji-dom.ts';
export { hydrate, annotateTemplate, resolvePaintBindings } from './template.ts';
export { sniffAnimatedRaster, sniffVideoContainer, sniffLayeredRaster, sniffContainer } from './media-sniff.ts';
// Layered bitmap import/export (1.102): PSD/PSB + XCF readers, PSD writer.
export { isPsd, readPsd, PsdUnsupportedError } from './psd.ts';
export { writePsd } from './psd-write.ts';
export type { PsdWriteDoc, PsdWriteLayer } from './psd-write.ts';
export { isXcf, readXcf, XcfUnsupportedError } from './xcf.ts';
export { packBitsEncode, packBitsDecode } from './packbits.ts';
export {
  PSD_BLEND_TO_CSS, CSS_TO_PSD_BLEND, XCF_MODE_TO_CSS, psdBlendToCss, xcfModeToCss,
} from './raster-layers.ts';
export type { CssBlendMode, RasterLayer, LayeredRasterDoc, InflateFn } from './raster-layers.ts';
export { buildInputModel, summarizeInputs, normalizeTableValue, deriveExportFilename, matchesShowIf, DEFAULT_FILE_MAX_BYTES } from './inputs.ts';
export type { TableValue, TableColumnEditor, ShowIf } from './inputs.ts';
export { parseUrlState, serializeUrlState, serializeHdr, encodeBlocksCompact, encodeTableCompact, decodeTableCompact, RESERVED, HDR_DEFAULTS, VIDEO_CODEC_STRINGS, parseVideoParams, hasVideoParams } from './url-mode.ts';
// The `s=` state address + the still-export frame filter both shells apply (plan 112).
export { parseFrameAddress, selectFramePage, frameFilterApplies } from './frame-address.ts';
export { looksLikeTable, parseTableText, toTsv, toMarkdown, toHtmlTable } from './table-text.ts';
export type { HdrSettings, DepthSetting, VideoUrlSettings, VideoQuality } from './url-mode.ts';
export { LANGS, LANG_META, normalizeLang, flagEmoji, sortedLangs } from './lang.ts';
export type { Lang, LangSort } from './lang.ts';
export { packQuery, unpackToken, expandQuery, hasPackedState, isPackAvailable, PACK_PARAM } from './url-pack.ts';
export { packEncrypted, unpackEncrypted, hasEncryptedState, isEncryptAvailable, ENC_PARAM } from './url-pack.ts';
export { parseEmbedUrl } from './embed.ts';
export { parseToolUrl, buildEmbedUrl, isToolUrl, lollySchemeToHttps, APP_PATH_WORDS } from './tool-url.ts';
export {
  assertComposeStack, ComposeGuardError, MAX_COMPOSE_DEPTH,
  bakeAssetRef, isBakedRef, MAX_BAKED_URL_CHARS,
  assetIdForUrl, blocksForUrl,
} from './bake.ts';
export { assetVersionPin, encodeAssetVersion, decodeAssetVersion, assetDependency } from './asset-version.ts';
export type { AssetVersionPin } from './asset-version.ts';
export { toCSV, parseDelimited, detectDelimiter, parseBatchCsv, batchCsvTemplateWithNotes } from './batch.ts';
export type { BatchRow } from './batch.ts';
export { buildExportMeta } from './metadata.ts';
export { extractFileMetadata, extractXmpPacket, readMpfIndex, appendedIsExpected, META_GROUP_ORDER, META_GROUP_LABEL } from './file-metadata.ts';
export type { FileMetadata, MetaField, MetaGroup } from './file-metadata.ts';
export { softwareName, softwareOrigins, xmlProvenanceFields } from './software-origin.ts';
export type { SoftwareOrigin, SoftwareEvidence, SoftwareRole } from './software-origin.ts';
// Image-metadata byte stampers + the metadata carry (plans/144 Wave 1). The
// stampers graduated here from the web shell's bridge/export-image-meta.ts
// (now a thin re-export) so the transform path and the CLI share them.
export {
  patchJpegDpi, readU32, writeU32, pngChunk, insertPngPhys, setAvifCicp, insertPngCicp,
  iTXtChunk, insertPngMeta, buildExifTiff, insertJpegExif, svgMetaBlock, injectSvgMeta,
  withGifComment, insertPngIcc, insertJpegIcc, inflateBytes, deflateBytes,
  carryImageMetadata, buildCarryExifTiff, insertWebpMeta, insertAvifExif, buildExportXmp,
  insertPngXmp, insertJpegXmp, META_CARRY_FIELDS,
} from './image-meta.ts';
export { stripMetadata, isStrippableFormat, hasResidualMetadata } from './strip-metadata.ts';
export type { StripFormat } from './strip-metadata.ts';
export {
  embedWatermark, detectWatermark, canCarryWatermark, WATERMARK_VERSION, DEFAULT_STRENGTH,
  LOSSLESS_STRENGTH, DETECT_THRESHOLD, MIN_IMPRINT_BLOCKS, detectionThreshold, V2_BAND_SIZE,
} from './pixel-watermark.ts';
export { detectWatermarkSearch, bilinearResampleRgba, SEARCH_DETECT_FLOOR } from './watermark-search.ts';
export { unfilterPng, PNG_UNFILTER_MAX_OUTPUT_BYTES } from './png-unfilter.ts';
export { analyzeLsb, LSB_MAX_PIXELS } from './steganalysis.ts';
export { decodeTrustmarkPayload, TRUSTMARK_PAYLOAD_BITS, buildLollyDurablePayload, readLollyDurable } from './trustmark.ts';
export { embedDurableIntoRgba, packNchwSigned, sampleBilinear, TRUSTMARK_MODEL_RESOLUTION, TRUSTMARK_MIN_SIDE } from './trustmark.ts';
export type { LollyDurable } from './trustmark.ts';
export {
  contentSealConsensus, CONTENTSEAL_MESSAGE_BITS, CONTENTSEAL_REQUIRED_VIEWS,
  CONTENTSEAL_DEFAULT_TAU,
} from './contentseal.ts';
export {
  UNITS, CSS_DPI, isUnit, parseDimension,
  toInches, isPhysical, toPixels, toPoints, toCssPx, toCssLength, toUnit,
} from './units.ts';
export {
  frameRect, framingStyle, normalizeFraming, isNeutralFraming, isTilted,
  framingQuad, projectFramingPoint, minZoomForCover, FRAMING_PERSPECTIVE,
} from './framing.ts';
export type { Framing, FramingFit } from './framing.ts';
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
export type { GradientSpec } from './gradient-spec.ts';
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
export { hdrBoostToPQ, pqEncode, hdrViewTransform, pqEncodeFrame, pqToU16, pqToI420P10, HDR_PQ_CICP } from './hdr.ts';
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
export {
  parseSvgPath, parseSvgPathArgs, svgArcToBeziers,
  SVG_PATH_MAX_CHARS, SVG_PATH_MAX_ARGS, SVG_PATH_MAX_SEGMENTS, SVG_PATH_MAX_SUBPATHS,
} from './svg-path.ts';
export { extractSvgColors, SVG_COLORS_MAX_CHARS } from './svg-colors.ts';
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
export type { SvgLayer, SvgLayerBox } from './svg-layers.ts';
export {
  renderZzfxm, zzfxG, zzfxM, zzfxR, zzfxV, assertZzfxmBudgets,
  ZZFXM_MAX_INSTRUMENTS, ZZFXM_MAX_INSTRUMENT_PARAMS, ZZFXM_MAX_PATTERNS,
  ZZFXM_MAX_SEQUENCE, ZZFXM_MAX_CHANNELS, ZZFXM_MAX_STEPS_PER_PATTERN,
  ZZFXM_MAX_OUTPUT_SAMPLES, ZZFXM_MAX_MIX_SAMPLE_OPS, ZZFXM_MAX_SYNTH_SAMPLES,
  ZZFXM_MAX_CACHE_SAMPLES, ZZFXM_MIN_BPM, ZZFXM_MAX_BPM, ZZFXM_MAX_NOTE,
  ZZFXM_MAX_NUMERIC_MAGNITUDE,
} from './zzfxm.ts';
export type {
  ZzfxSong, ZzfxInstrument, ZzfxChannel, ZzfxPattern, RenderedPcm,
} from './zzfxm.ts';
// Audio analysis (host.audio, v1.71) - decoded PCM in, a per-frame reactivity
// track out. The shell owns the decoder and attaches this; the maths lives here so
// the web shell and the CLI read identical numbers off the same clip.
export { analysePcm, fftInPlace } from './audio-analyse.ts';
export type { AudioAnalysis, AudioAnalyseOpts, AudioFrames } from './audio-analyse.ts';
export { cleanAudioPcm, resamplePcm, cleanAudioPreview } from './audio-clean.ts';
// Captions (host.speech, v1.96) - spoken-word timings in, subtitle cues out. The
// grouping and VTT/SRT timestamp maths live here so the browser and a headless
// export break caption lines at the same words.
export { groupWordsToCues, cuesForSlide, cuesToVtt, cuesToSrt, cueAt } from './captions.ts';
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
export type { TextFacts } from './text-facts.ts';
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
export type { HumanizeResult } from './humanize.ts';
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
  // v1.170 (plans/181): the vocab-safe phoneme filter, the script marks
  // grammar, voice blending and the per-sentence segment tiling.
  KOKORO_VOCAB, filterToVocab, normalizeForSpeech,
  PAUSE_DEFAULT_S, SLOW_SPEED, FAST_SPEED, MIN_SPEECH_SPEED, MAX_SPEECH_SPEED,
  CLIP_EDGE_PAD_S, pauseGapS, parseScriptMarks, scriptLinesOf,
  parseVoiceBlend, accentOfBlend,
  MIN_SEAM_GAP_S, endsSentence, deriveSegmentsFromWords,
} from './speech-text.ts';
export type {
  TokenSpan, PhonemeChunk, SentenceClip, EspeakFn,
  ScriptSentence, ParsedScript, ParseScriptOpts, VoiceBlendComponent, TtsSegment,
} from './speech-text.ts';
// The dependency-free WAV reader that backs host.audio where there is no platform
// codec (the Node shells). Byte parsing, so it lives beside tiff.ts/apng.ts.
export { parseWav, packWav } from './wav.ts';
export type { WavAudio, WavSampleFormat } from './wav.ts';
export {
  parseMidi, midiToSong, midiToZzfxm,
  MIDI_MAX_NOTES, MIDI_MAX_STEPS, MIDI_MAX_VOICES,
} from './midi.ts';
export { composeSong, PRESETS, SCALES, mulberry32, patternSeconds } from './zzfx-compose.ts';
// The seed → spec draw behind `zzfxm:<seed>`. Engine-side so every shell composes
// the SAME song from one id; the draw order is a frozen contract (see the fn).
export { generatedSongSpec } from './zzfx-compose.ts';
// The `zzfxm:<seed>[:<style>]` asset-id scheme - a song NAMED rather than stored.
// Sits beside tool-url.ts's scheme for the same reason: every shell that resolves
// an asset id has to recognise it, and they must not each invent the rule.
export { ZZFXM_SCHEME, isZzfxmRef, parseZzfxmRef, formatZzfxmRef } from './zzfxm-ref.ts';
export type { ZzfxmRef } from './zzfxm-ref.ts';
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
// Design-system identity (plans/186 section 6) - the same argument one level up: which
// system an asset id belongs to, and what a design system is called, must read
// IDENTICALLY in the web bridge, the CLI and the MCP server, or a share opens under
// a system its author never used.
export {
  DESIGN_SYSTEM_ID_RE, DESIGN_SYSTEM_ID_MAX, DEFAULT_DESIGN_SYSTEM_ID, SHIPPED_DESIGN_SYSTEM_ID,
  isDesignSystemId, slugifyDesignSystemId, designSystemNamespace, designSystemHeadId,
  designMaterialOf, readDesignSystemIdentity, withDesignSystemIdentity,
} from './design-system.ts';
export type { DesignMaterial, DesignMaterialKind } from './design-system.ts';
export {
  parseCssLength, cornerRadii, uniformRadius, insetCorners, roundedRectPath, parseBoxShadow, parseTextShadow, gaussianShadowBands, gaussianShadowRings,
  parseCssMatrix, isNonAffineTransform, multiplyMat, matAboutPivot, isAxisAlignedMat, matToSvg, IDENTITY_2D,
} from './css-box.ts';
export type { Mat2D } from './css-box.ts';
export {
  parseClipShape, parseRadialGradient, parseConicGradient, parseDropShadowFilter,
  splitCssArgs, parseGradientAngle, parseGradientStop, expandGradientStops,
} from './css-paint.ts';
export type { ClipShape, GradientStop, ConicGradient, DropShadow } from './css-paint.ts';

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
export { type CapStyle, strokeToPath } from './geom/stroke.ts';
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
export { buildPptxParts, EMU_PER_PX } from './pptx.ts';
export type {
  PptxSlide, PptxShape, PptxRect, PptxText, PptxPic, PptxRun, PptxPara, PptxFill, PptxMedia, PptxBuildOpts,
  PptxTable, PptxTableCell, PptxLine, PptxTheme, PptxPath, PptxLayout, PptxPlaceholder, PptxPhType,
  PptxSlideTransition, PptxAudio,
} from './pptx.ts';
export {
  svgToCustGeomPaths, svgToNativePptx,
  SVG_CUSTGEOM_MAX_CHARS, SVG_CUSTGEOM_MAX_TAGS, SVG_CUSTGEOM_MAX_SHAPES,
  SVG_CUSTGEOM_MAX_ATTR_CHARS, SVG_CUSTGEOM_MAX_STYLE_CHARS,
  SVG_CUSTGEOM_MAX_TRANSFORM_CHARS, SVG_CUSTGEOM_MAX_POINTS_CHARS,
} from './svg-custgeom.ts';
export { rebrandPptxParts } from './pptx-patch.ts';
export type { RebrandPlan, RebrandTheme, PartMap } from './pptx-patch.ts';
// readingOrder is aliased: design-map.ts already owns the bare name here.
export { isPptx, readPptx, pptxMediaImages } from './pptx-read.ts';
export type {
  PptxParts, XmlParser, PptxDeckRead, PptxReadSlide, PptxReadNode, PptxReadTheme,
  PptxReadColor, PptxReadRun, PptxReadPara, PptxTextNode, PptxShapeNode, PptxPicNode,
  PptxTableNode, PptxUnknownNode, PptxMediaImage, PptxSlideAudio,
  // The read-side placeholder record; aliased because the WRITER's layout
  // placeholder (pptx.ts) already owns the bare name on this surface.
  PptxPlaceholder as PptxReadPlaceholder,
} from './pptx-read.ts';
// SCORM packaging, the pure half (plans/180 section 6): manifests, the runtime
// adapter source and the D1 launch page. The shell owns the zip.
export { scormManifest, scormManifest12, scormManifest2004, scormAdapterJs, scormLaunchHtml } from './scorm.ts';
export type {
  ScormVersion, ScormManifestOpts, ScormSlide, ScormVideo, ScormFont, ScormLaunchOpts,
  ScormLaunchLabels,
} from './scorm.ts';
export { deckToMarkdown } from './deck-md.ts';
export type { DocBlock, DocInline, DocListItem, DocTableCell } from './doc-model.ts';
export { mdFromBlocks, htmlFromBlocks } from './doc-md.ts';
// XmlParser is NOT re-exported from docx-read: pptx-read already owns the name
// on this surface and the shapes are identical.
export { isDocx, readDocx } from './docx-read.ts';
export type { DocxParts } from './docx-read.ts';
export {
  buildPdfXXmp, formatPdfDate, makeDocumentId, pdfxOutputIntentSpec,
  pdfxProfileEligibility, PDFX_VERSION,
} from './pdfx.ts';
export type {
  PdfXOutputIntentOptions, PdfXOutputIntentSpec, PdfXProfileFacts, PdfXXmpOptions,
} from './pdfx.ts';
export { buildC2paManifest, embedC2paInPdf, embedC2pa, attachC2paStore, exportActionSteps, collectAiIngredientDeclarations, C2PA_FORMATS, DIGITAL_SOURCE_TYPE, CAPTURE_SOURCE_TYPE, SCREEN_SOURCE_TYPE, GENERATED_SOURCE_TYPE, COMPOSITE_SOURCE_TYPE } from './c2pa.ts';
export type { C2paActionInput, C2paCredentialedIngredient, C2paSourceIngredient, C2paRightsRecord, C2paIngredientInput } from './c2pa.ts';
export { LOLLY_RIGHTS_ASSERTION } from './c2pa.ts';
export { verifyC2pa, extractC2paFromPdf, prepareC2paIngredient, prepareC2paIngredientFromStore, collectIngredients, collectIngredientRecords, extractC2paStore, parseCertificate, signedBy } from './c2pa-verify.ts';
export type { C2paReport, C2paCheck, ParsedCertificate, C2paIngredientRecord } from './c2pa-verify.ts';
export type { Signer as C2paSigner } from './c2pa.ts';
export { C2PA_CHECK, isExpiredOnly, resolveVerdict, defaultTrustAnchors } from './c2pa-verdict.ts';
export type { C2paVerdict, C2paVerdictInput, C2paVerdictState } from './c2pa-verdict.ts';
export { c2paTrustAnchors, LOLLY_CA_ROOT_PEM } from './c2pa-trust.ts';
export { c2paDefaultOn, imprintDefaultOn, isImprintFormat, IMPRINT_FORMATS } from './provenance-defaults.ts';
// Creative rights (plan 253): the reviewed licence profiles, the deterministic
// evaluator, attribution delivery and the file-level rights report. Pure data
// and arithmetic - no clock, no network, no filesystem. The runtime imports
// them at export time, not at mount, so a render with no recorded source never
// loads them.
export { OUTPUT_LICENCE_CHOICES, RIGHTS_RULES_VERSION, licenceDisplayName, licenceProfile, licenceProfiles, normaliseLicence, outputLicenceId, outputLicenceNotice, publicLocator, readLicenceExpression, roleObligation } from './rights-profiles.ts';
export type { AttributionPartsV1, CompatibleOutputLicenceV1, LicenceExpressionV1, LicenceLimitV1, LicenceOperatorV1, LicenceProfileV1, NormalisedLicenceV1, RoleObligationV1 } from './rights-profiles.ts';
export { evaluateCreativeUses } from './rights-evaluate.ts';
export type { RightsEvaluationInputV1 } from './rights-evaluate.ts';
export { attributionCompanion, attributionCredits, checkAttributionReadback, sourceIngredientsFor } from './rights-attribution.ts';
export type { AttributionCompanionV1, SourceDetailV1 } from './rights-attribution.ts';
export { evaluateReuse, rightsReportFromC2pa } from './rights-report.ts';
export {
  verifySeal, parseSealRecord, parseSealRecords, computeSealDigest, assembleSealMessage,
  resolveRanges, verifySealSignature, importSealKey,
  SEAL_SCAN_EDGE_BYTES, SEAL_SCAN_WHOLE_MAX_BYTES, SEAL_MAX_RECORD_CHARS,
  SEAL_MAX_RECORDS, SEAL_MAX_FIELDS, SEAL_MAX_FIELD_CHARS,
  SEAL_MAX_RANGE_SPEC_CHARS, SEAL_MAX_RANGES, SEAL_MAX_ASSEMBLED_BYTES,
} from './seal.ts';
export type { SealRecord, SealVerifyResult } from './seal.ts';
export { pemToDer, derToPem, generateCaRoot, issueLeafCert } from './x509.ts';
export { packApng } from './apng.ts';
export {
  demuxApng, APNG_DEMUX_MAX_INPUT_BYTES, APNG_DEMUX_MAX_CHUNKS,
  APNG_DEMUX_MAX_FRAMES, APNG_DEMUX_MAX_DIM, APNG_DEMUX_MAX_PIXELS,
  APNG_DEMUX_MAX_OUTPUT_BYTES,
} from './apng-decode.ts';
export { packWebpAnim } from './webp-anim.ts';
export {
  demuxWebpAnim, WEBP_DEMUX_MAX_INPUT_BYTES, WEBP_DEMUX_MAX_CHUNKS,
  WEBP_DEMUX_MAX_FRAMES, WEBP_DEMUX_MAX_DIM, WEBP_DEMUX_MAX_PIXELS,
  WEBP_DEMUX_MAX_OUTPUT_BYTES,
} from './webp-anim-decode.ts';
export { packTiff } from './tiff.ts';
export { packPng } from './png.ts';
export type { PackPngOptions, PngSamples } from './png.ts';
export { encodeBmp, decodeBmp, isBmp, BmpUnsupportedError, BMP_MAX_DIM } from './bmp.ts';
export {
  decodeIco, isIco, IcoDecodeError, ICO_MAX_ENTRIES, ICO_MAX_DIM,
  ICO_MAX_PIXELS, ICO_MAX_INPUT_BYTES,
} from './ico-decode.ts';
export { deflateRaw, zlibCompress, adler32 } from './deflate.ts';
export { gzip, gunzip, inflateRaw } from './gzip.ts';
export {
  readZip, storeZip, ZIP_READ_MAX_INPUT_BYTES, ZIP_READ_MAX_ENTRIES,
  ZIP_READ_MAX_ENTRY_BYTES, ZIP_READ_MAX_TOTAL_BYTES,
} from './zip.ts';
export type { ZipEntry } from './zip.ts';
export { packTar } from './tar.ts';
export { readTar, readTarGz } from './tar-read.ts';
export type { TarFile } from './tar.ts';
export { packCpio } from './cpio.ts';
export type { CpioFile } from './cpio.ts';
export { buildRpm } from './rpm.ts';
export type { RpmSpec, RpmMeta } from './rpm.ts';
export { planIconSet } from './icon-set.ts';
export type { IconSource } from './icon-set.ts';
export { buildLinuxPack, buildHomeTarball, packageRender } from './linux-pack.ts';
export type { FontFile } from './linux-pack.ts';
export { fontMetainfo, desktopEntry, metainfoPath } from './appstream.ts';
export { sfntKind, sfntToWoff, woffToSfnt, fontConversionTargets, convertFontContainer } from './font-convert.ts';
export { sourceToGrid, gridToTarget } from './file-data.ts';
export { videoProvenanceTags, embedMp4Meta, embedWebmMeta } from './video-meta.ts';
export { embedWavInfo } from './riff-meta.ts';
export { parseDataRows, rowsToCsv, DEFAULT_ROW_LIMIT } from './data-import.ts';
export { expandDerivedFormats } from './derived-formats.ts';
export { readXlsx, listXlsxSheets, DEFAULT_XLSX_ROW_LIMIT } from './xlsx-import.ts';
export { writeXlsx, colLetters } from './xlsx-write.ts';
export { writeEpub } from './epub.ts';
export {
  readEpub, EPUB_READ_MAX_INPUT_BYTES, EPUB_READ_MAX_PARTS,
  EPUB_READ_MAX_PART_BYTES, EPUB_READ_MAX_TOTAL_BYTES,
  EPUB_READ_MAX_MANIFEST_ITEMS, EPUB_READ_MAX_SPINE_ITEMS,
  EPUB_READ_MAX_NAV_LABELS, EPUB_READ_MAX_TITLE_CHARS,
  EPUB_READ_MAX_OUTPUT_CHARS,
} from './epub-read.ts';
export { writeOdt } from './odt.ts';
export { writeDocx } from './docx.ts';
export type { DocxDoc, DocxBlock, DocxMedia } from './docx.ts';
export {
  decomposeMatrix, boxGeomFromBBox, mapWeight, mapFontFamily, mapAlign,
  safeColor, nodeToBox, finalizeBoxes, parsePenpotContent, collectPenpotFontUsage, penpotShapeToNode, penpotGradientToSpec,
  penpotPathContentToD, penpotGradientSvgDef, penpotGroupToSvg, penpotDashArray, penpotBackgroundBlurPx,
  collectPenpotExportMarks, penpotFlowOrder, penpotAnimationToTransition,
  figmaNodesToNodes, figmaNodesToScenes, readingOrder, colorRunsToText, decodeFigVectorPath,
} from './design-map.ts';
export type { DesignMapOptions, DesignFrameScene, PenpotFontUsage } from './design-map.ts';
export { collectPenpotComponents, penpotComponentSlots } from './design-components.ts';
export type {
  PenpotShapesByPage, PenpotComponent, PenpotComponentVariant, PenpotComponentSlot,
  PenpotComponentCollection, PenpotExternalCensus, PenpotExternalComponent,
} from './design-components.ts';
// The Design scene grammar: what a `kind:'3d'` box's `scene` field holds (plan 265 m3).
export { designSceneEncode, designSceneDecode, designSceneAssetIds } from './design-scene.ts';
export type { DesignSceneValues } from './design-scene.ts';
export {
  interpretPdfPage, parseToUnicode, toUnicodeDecoder,
  PDF_MAP_MAX_ARRAY_DEPTH, PDF_MAP_MAX_BF_RANGE, PDF_MAP_MAX_RUN_DEPTH,
  PDF_MAP_MAX_PAGE_NODES, PDF_MAP_MAX_PATTERN_NODES, PDF_MAP_MAX_PATTERN_EVALS,
  PDF_MAP_MAX_MASK_NODES, PDF_MAP_MAX_MASK_TOTAL_NODES, PDF_MAP_MAX_MASK_EVALS,
  PDF_MAP_MAX_TOKENS, PDF_MAP_MAX_CONTENT_CHARS, PDF_MAP_MAX_TOTAL_CONTENT_CHARS,
} from './pdf-map.ts';
export type { PdfPageInput, PdfNode, PdfResources, PdfXObject, PdfFontInfo, PdfShading, PdfPattern, PdfGradientStop, PdfSoftMaskDef } from './pdf-map.ts';
export { isShadowPlate, maskRegion, relativeLuminance, constantMask } from './pdf-smask.ts';
export {
  pdfNodesToSvg, windowPdfSvg, cullPdfNodes, pdfNodeExtent, pdfNodeElementKind, CULL_PAD_PT,
  PDF_SVG_MAX_NODES, PDF_SVG_MAX_MASK_NODES, PDF_SVG_MAX_GRADIENT_STOPS,
  PDF_SVG_MAX_OUTLINE_LINES, PDF_SVG_MAX_TEXT_LINES, PDF_SVG_MAX_SOURCE_CHARS,
  PDF_SVG_MAX_CLIPS, PDF_SVG_MAX_CLIP_D, PDF_SVG_MAX_PATH_D,
  PDF_SVG_MAX_OUTLINE_D, PDF_SVG_MAX_COORD,
} from './pdf-svg.ts';
export type { PdfSvgOptions, CullWindow, PdfExtent } from './pdf-svg.ts';

export { findVectorArtwork, PDF_ARTWORK_MAX_NODES } from './pdf-artwork.ts';
export type { VectorArtwork } from './pdf-artwork.ts';

export {
  findHiddenText, findHiddenTextInPages, describeHiddenText,
  PDF_REDACTION_MAX_COVERS, PDF_REDACTION_MAX_NODES,
  PDF_REDACTION_MAX_PAGES, PDF_REDACTION_MAX_TEXT_CHARS,
} from './pdf-redaction.ts';
export type { HiddenTextFinding } from './pdf-redaction.ts';

export {
  extractPageText, joinPageText, PDF_TEXT_MAX_NODES, PDF_TEXT_MAX_ITEMS,
  PDF_TEXT_MAX_CHARS, PDF_TEXT_MAX_TAGGED_ELEMENTS,
  PDF_TEXT_MAX_MCIDS_PER_ELEMENT, PDF_TEXT_MAX_TAGGED_REFERENCES,
  PDF_TEXT_MAX_JOIN_PAGES,
} from './pdf-text.ts';
export type { PageText, TextBlock, TaggedElement } from './pdf-text.ts';
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
export type { StoredFace } from './color-faces.ts';
// An image's colours as a cloud in the same space the solid is drawn in.
export { imageColorCloud, UNIQUE_CAP } from './image-cloud.ts';
export type { ImageCloud, CloudPoint, CloudSpace } from './image-cloud.ts';
export type { GamutSolid, ProjectedQuad, SolidEmbed } from './gamut-solid.ts';
export { describeColor, contrastVsExtremes, wcagLevel, NOTATION_SPACES, EXTREMES_CONTRAST_FLOOR } from './color-describe.ts';
export type { ColorDescription } from './color-describe.ts';

export type { EncodeSpace } from './gamut.ts';
export { GAMUTS, oklchGamut, inGamut, gamutWithin, maxChroma, clipToGamut, oklchSlice, encodeOklch, sliceGamutEdge, sliceGamutRegion } from './gamut.ts';
export type { GamutName, SlicePlane } from './gamut.ts';
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
export { SCHEME_KINDS, generateSchemeAccents, rotateHue, generateAnalogous, rotateRampHue } from './brand-schemes.ts';
export type { SchemeKind } from './brand-schemes.ts';
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
export type { ApcaUse, ApcaSolveResult, ApcaSolveOptions } from './color-tools.ts';
// Chroma / colour-range keying - remove a flat background by perceptual (OKLab)
// distance, model-free. The pure math behind the video-matte colour-key method.
export { chromaKeyAlpha } from './chroma-key.ts';
// Telea 2004 fast-marching inpainting - the classical content-aware fill behind
// Retouch (plans/124 WP-E). Ported, not depended on: stock opencv.js omits
// cv.inpaint. Windows itself to the mask bounding box and returns a new frame.
export { inpaintTelea } from './inpaint.ts';
export type { InpaintFrame } from './inpaint.ts';
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
export type { BrandSwatch, BrandFonts } from './brand-map.ts';
export {
  coerceTokensDoc, assembleTokenSetFiles, extractPenpotProject, summarizeTokensDoc, scanPenpotUsage,
  scanPenpotAppliedTokens,
} from './brand-import.ts';
export type { TokensExtraction, PenpotUsage, PenpotUsageColor, PenpotUsageGradient, PenpotAppliedToken } from './brand-import.ts';
// .penpot writer (plans/178): binfile-v3 entries from a Lolly document + the brand tokens.
export {
  buildPenpotEntries, boxesToPenpotDoc, svgToPenpotDoc, imageToPenpotDoc, penpotTokensJson,
  parsePenpotImportStream, penpotWorkspaceUrl, imageDimensions, decodeDataUrl, decodeBase64,
  parsePenpotColor, gradSpecToPenpot, designTextRuns, penpotUuid, seededPenpotUuid, markToolComponents,
  PENPOT_MIME, PENPOT_ROOT_ID, PENPOT_FILE_VERSION, PENPOT_FEATURES, PENPOT_MIGRATIONS, PENPOT_IMAGE_MTYPES,
} from './penpot-file.ts';
export { appSurfaceBoxes, appSurfaceExportReport, appSurfaceToPenpotDoc } from './app-surface.ts';
export type {
  AppSurface, AppSurfaceNode, AppSurfaceFrame, AppSurfaceRect, AppSurfaceText,
  AppSurfaceRole, AppSurfaceDataPolicy, AppSurfaceComponent, AppSurfaceExportReport,
} from './app-surface.ts';
export type {
  PenpotDoc, PenpotIrPage, PenpotIrShape, PenpotIrBoard, PenpotIrGroup, PenpotIrRect, PenpotIrCircle, PenpotIrPath,
  PenpotIrText, PenpotIrImage, PenpotIrFill, PenpotIrGradient, PenpotIrGradientStop, PenpotIrStroke, PenpotIrShadow,
  PenpotIrTextRun, PenpotIrParagraph, PenpotIrTypography, PenpotPaletteColor, PenpotMedia, PenpotBuild,
  PenpotBuildOptions, BoxesToPenpotOptions, SvgToPenpotOptions, SvgToPenpotResult, PenpotPendingImage,
  PenpotImportResult, PenpotColor, PenpotMatrix, PenpotComponentSpec, PenpotThemeSelection,
} from './penpot-file.ts';
// Applied-token bindings + component validation for the .penpot writer (plans/222).
export {
  PENPOT_BINDABLE, PENPOT_BINDABLE_PROPS, buildTokenTypeIndex, sanitizeAppliedTokens,
  isSafeTokenPath, penpotTokenClosure,
} from './penpot-bindings.ts';
export {
  parseThemedAssetId, buildThemedAssetId, isThemableIconSvg, isValidThemeId,
  applyIconTheme, restyleIconTheme, parseIconThemesDoc,
} from './icon-theme.ts';
export type { IconTheme } from './icon-theme.ts';
export {
  parseTreatedAssetId, buildTreatedAssetId, isValidTreatmentId, stripAssetModifiers,
  parsePhotoTreatmentsDoc, treatmentFilterSvg, wrapRasterWithTreatment,
} from './photo-treatment.ts';
export type { PhotoTreatment } from './photo-treatment.ts';
export { derivePhotoTreatmentsDoc, deriveIconThemesDoc } from './brand-treatments.ts';
export {
  hashR6, preparePassword, buildEncryptDictValues, encryptObjectBytes,
} from './pdf-crypto-r6.ts';
export {
  crc32, zipCryptoEncrypt, deriveAesZipKey, aesZipEncryptEntry, buildEncryptedZip,
} from './zip-crypto.ts';
export type { ZipTier, ZipEntryInput } from './zip-crypto.ts';

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
export { createTruePeakLimiter, activitySpans } from './audio-dynamics.ts';
export { createLoudnessMeter, integratedLoudness, normalizeGain, LOUDNESS_RATE } from './audio-loudness.ts';
export { parseFxChain, serializeFxChain, processFxPcm, FX_PRESETS, FX_CHAIN_MAX_CHARS } from './audio-fx.ts';
export { satisfiesRange, parseVersion } from './semver-range.ts';
export { encodeFsToken, decodeFsToken } from './fs-token.ts';
export {
  sessionVersionStamp,
  migrateSessionRecord,
  SESSION_FORMAT_VERSION,
  SESSION_READER_VERSION,
} from './session-record.ts';

// Numeric helpers (2026-09-09)
export { clamp } from './clamp.ts';

// Kept on the barrel for the TUI, the api bundles and the chrome extension (2026-09-09 trim)
export { ASSET_PROVIDER_REF_RE } from './asset-provider.ts';
export { renderDocument } from './document-api.ts';
export { FRAME_FILTER_SKIP_FORMATS } from './frame-address.ts';
export { isLang } from './lang.ts';
export { batchCsvTemplate } from './batch.ts';
export { LSB_MIN_PIXELS, LSB_P_THRESHOLD, LSB_PREFIXES } from './steganalysis.ts';
export { encodeTrustmarkPayload, LOLLY_DURABLE_SCHEMA_VERSION, TRUSTMARK_Q_WM_STRENGTH } from './trustmark.ts';
export { SVG_COLORS_MAX_MATCHES } from './svg-colors.ts';
export { ZZFXM_ARCHETYPES } from './zzfxm-ref.ts';
export { EMU_PER_INCH } from './pptx.ts';
export { readingOrder as pptxReadingOrder } from './pptx-read.ts';
export { LOLLY_EXPORT_ASSERTION } from './c2pa.ts';
export { verifyC2paPdf } from './c2pa-verify.ts';
export { isImprintContainerFormat, IMPRINT_CONTAINER_FORMATS } from './provenance-defaults.ts';
export type { ProvenanceManifest } from './provenance-defaults.ts';
export { BMP_MAX_PIXELS } from './bmp.ts';
export { GUNZIP_MAX_OUTPUT_BYTES } from './gzip.ts';
export { TAR_MAX_ARCHIVE_BYTES, TAR_MAX_MEMBERS, TAR_MAX_PAYLOAD_BYTES } from './tar-read.ts';
export { PDF_ARTWORK_MAX_CANDIDATES } from './pdf-artwork.ts';
export { createPrepareAPI, inspectPreparation, applyPreparation, preparationDigest, preparationRecipe, readPreparationRecipe } from './prepare.ts';
export { inspectPrivateText, validatePreparationRules } from './prepare-text.ts';

export { applyPreparationMetadata } from './prepare-metadata.ts';

export { compareSources, createCompareAPI } from './compare.ts';
export { compareVisualSources, renderComparisonPage } from './compare-visual.ts';

export { createTextToolsAPI, runTextTool } from './text-tools.ts';
export { highlightCode, detectCodeLanguage, SYNTAX_LANGUAGES } from './text-syntax.ts';
export { TEXT_OPERATIONS } from './text-operations.ts';
export { parseTextLogs, filterTextLogs, groupTextLogs } from './text-logs.ts';
export type { TextLogEvent, TextLogReport } from './text-logs.ts';

// Learning documents and compilation remain independent of an LMS or a shell.
export { newLearningModule, parseLearningModule, checkLearningModule, learningPath, LEARNING_LIMITS } from './learning/module.ts';
export { learningProgress, encodeLearningAttempt, decodeLearningAttempt } from './learning/progress.ts';
export { compileLearningModule } from './learning/compile.ts';
export type { LearningBytes, CompiledLearning } from './learning/compile.ts';

export { LEARNING_TARGETS, learningRenditions, learningSummary } from './learning/delivery.ts';
export type { LearningRenderable, LearningRendition } from './learning/delivery.ts';
export { learningExportKey, checkLearningExportSize, learningHandoff } from './learning/preflight.ts';
export type { LearningExportSettings } from './learning/preflight.ts';

export { compileDesignTool } from './design-tool/compiler.ts';
export type { CompiledDesignTool } from './design-tool/compiler.ts';
export { compileSessionTool } from './design-tool/session-compiler.ts';
export type { SessionToolSource } from './design-tool/session-compiler.ts';
export { designExportSize, assertDesignValues } from './design-tool/policy.ts';
export { buildStudioScene, studioFinish, STUDIO_FINISHES, studioTime, studioAnimated, studioLightMotion } from './studio3d.ts';
export { studioActiveIndex, studioActiveValues, studioCameraEdit, studioFocusEdit, studioCollectionRows, studioCollectionSize, studioSubjectIds, studioSubjectEdit, studioSheetSize, STUDIO_COLLECTION_LIMIT, STUDIO_SHEET_PIXELS } from './studio3d-collection.ts';
export { studioCameraPose, studioRestPose, studioCameraTravels, studioCameraKeyFromView, studioAddCameraKey, studioCameraFromKey, STUDIO_CAMERA_KEY_LIMIT } from './studio3d-camera-path.ts';
export { studioOrbitLight, studioScaleLightDistance, studioPlaceableLights, studioLightEdit, STUDIO_LIGHT_TARGET, STUDIO_LIGHT_RANGE, STUDIO_PRESET_LIGHT_POSITIONS, STUDIO_KEY_CARD_OFFSET } from './studio3d-lights.ts';
export { studioSceneObjects, studioObjectEdit, studioObjectSelect, studioActiveObject, studioArrangementRows, studioObjectId, studioObjectName, studioOverlaps, studioArrangementPivot, STUDIO_ARRANGEMENT_LIMIT, STUDIO_ARRANGEMENT_EXTENT } from './studio3d-arrangement.ts';
export { studioLookOf, studioApplyLook, studioKeyInput, studioKeyField, studioParseRef, studioFormatRef, studioParseOverrides, studioFormatOverrides, studioRecordOverride, STUDIO_LOOK_KEYS, STUDIO_INSTANCE_KEYS, STUDIO_LOOK_INPUT_IDS } from './studio3d-look.ts';
export type { StudioLookValues, StudioRef } from './studio3d-look.ts';
export { studioObjectPose, STUDIO_MOTION_KINDS, STUDIO_ONE_SHOT_KINDS, STUDIO_POSE_REST, STUDIO_POSE_MAX_LIFT } from './studio3d-motion.ts';
export type { StudioPoseV1 } from './studio3d-motion.ts';

export { brandContext, contextTokens } from './brand-context.ts';
export { checkBrandDesign, applyBrandFix } from './brand-check.ts';
export type { BrandFinding, BrandFix } from './brand-check.ts';
export { BRAND_STYLE_PROPERTIES, summarizeBrandStyles, readBrandStyleEvidence } from './brand-evidence.ts';
export type { BrandStyleProperty, BrandStyleValue, BrandStyleEvidence } from './brand-evidence.ts';

export { parseTextDocument, serializeTextDocument, createTextStory, TEXT_DOCUMENT_MAX_BYTES } from './text-story-document.ts';
export { assertTextRange, snapTextRange, textBoundaries, sourceBreaks, paragraphRanges, deletionRange, TextSourceError, TEXT_SOURCE_MAX_UNITS } from './text-source.ts';
export { replaceStoryRange, formatStoryRange, formatStoryParagraphs, storyParagraphIds, normalizeTextSpans } from './text-edits.ts';
export type { TextInsertion, StoryEditOptions, StoryEditResult, TextSpanPatch } from './text-edits.ts';
export { sliceTextDocument, importTextFragment } from './text-fragment.ts';
export { resizeDesignTextFrames } from './text-design.ts';
export { composeText, TEXT_LAYOUT_ALGORITHM } from './text-layout.ts';
export { prepareTextParagraph } from './text-paragraph.ts';
export type { TextParagraphPiece, ShapedTextLine } from './text-paragraph.ts';
export { textStyleResolver, mergeTextCharacter } from './text-styles.ts';
export { styleTextRange, defineTextStyle, nextParagraphStyle } from './text-style-commands.ts';
export type { TextStyleCommand } from './text-style-commands.ts';
export { removeTextFrames, deleteTextStory, linkTextFrames, splitTextThread, detachTextFrame, duplicateTextFrames, placeTextStory, insertTextFrame } from './text-thread-commands.ts';
export type { TextThreadSnapshot } from './text-thread-commands.ts';
export { textHyphenationLanguage } from './text-hyphenation.ts';
export { previewTextCleanup, applyTextCleanup } from './text-cleanup.ts';
export type { TextCleanupEdit, TextCleanupPreview, TextCleanupOptions } from './text-cleanup.ts';

export { textLayoutSvg } from './text-layout-svg.ts';
export { parseTextFrame } from './text-frame.ts';
export { readDesignText, designTextFrame, upgradeDesignText, defaultTextFrameSettings } from './text-design.ts';
export type { DesignTextBox, TextFrameSettingsV1 } from './text-design.ts';

export { captureTextFrames, pasteTextFrames } from './text-frame-clipboard.ts';
export type { TextLayoutReceipt } from './text-layout-cache.ts';

export { textRecipe, type TextRecipe } from './text-recipes.ts';

export { emojiTextPath as textGuideGeometry } from './emoji-text-path.ts';
export { transformTextPath } from './text-spacing.ts';
export { importVectorPaint } from './vector-paint-import.ts';
export { renderVectorPaint, parseVectorPaint, transformVectorPaintPaths, vectorPaintMatrices, vectorMatrix, inverseVectorMatrix, multiplyVectorMatrix } from './vector-paint.ts';
export type { VectorPaintV1, VectorPaintNode, VectorMatrix } from './vector-paint.ts';

export { designTextWrap } from './text-design-wrap.ts';
export { scaleTextStory, scaleTextFrame } from './text-scale.ts';

export { textSemanticSource } from './text-semantic.ts';

// Slide masters as design-system data (plan 274 section 3.4): seeding a Design frame
// from an archetype, re-laying role-bound layers, and which logo a background wants.
export { seedFrame, applyArchetype, resetFrame, masterBoxToPx, pxToMasterFraction, archetypePlaceholders } from './slide-master.ts';
export type { SeedFrameOptsV1, SeededFrameV1, SeededCellV1, RelayoutOptsV1, TokenResolver } from './slide-master.ts';
export { slideStructureLibrary, findStructure, expandStructure, expandRepeat, structureOf, archetypeForStructure, darkVariantOf, searchTokens, structureSearchIndex, searchStructures } from './slide-structures.ts';
export type { StructureGridV1, StructureBandV1, StructureSlotV1, SlideStructureV1, SlideStructureSectionV1, SlideStructureLibraryV1, ExpandedStructureV1, StructureSearchEntryV1 } from './slide-structures.ts';
export { bgIsDark, pickLogoVariant, parseBackgroundRgb, BACKGROUND_DARK_THRESHOLD } from './logo-variant.ts';
export type {
  LogoSetV1, LogoVariantNameV1, LogoVariantRequestV1, LogoVariantChoiceV1,
  BackgroundInputV1, BackgroundValueV1, BackgroundGradientV1, BackgroundStopV1,
} from './logo-variant.ts';

// Renovation stage 5 and its report (plan 274 sections 3.4 and 9): the faithful
// compile from a read source deck to Design's authored values, and the report that
// accounts for every source object exactly once.
export { compileFaithful, DECK_COMPILE_VERSION } from './deck-compile.ts';
export type { CompileFaithfulOptsV1 } from './deck-compile.ts';
export { emptyReport, addEntry, setSlideCounts, finalizeReport, reportMessage } from './rebrand-report.ts';
export type { ReportEntryInputV1, SlideCountsV1 } from './rebrand-report.ts';

// Renovation stage 2 (plan 274 section 3.2): the census, its class rules and the
// small hashes that generate candidate groups. A census measures and says what it
// found; the action a person or a preset takes belongs to the plan stage.
export { censusDeck, DEFAULT_JITTER_TOLERANCE, ACCENT_CHROMA_FLOOR } from './deck-census.ts';
export type { CensusOptsV1, KnownLogoV1 } from './deck-census.ts';
export { classifyObject, CENSUS_RULES } from './deck-census-rules.ts';
export type { ObjectFeaturesV1 } from './deck-census-rules.ts';
export { censusHash, dhashFromGrey, hammingDistance, pathHash, digitNormalise } from './deck-census-hash.ts';

// Renovation stages 3 and 4 (plan 274 section 3.3): the automatic first pass and
// the four rule modules it calls. A proposal is not a decision, so nothing here
// writes one except a carry-forward from a previous revision.
export { firstPass, layoutFindings, archetypeHints, chartToolOffer, PLAN_RULES } from './rebrand-plan.ts';
export type { RenovationPresetV1, FirstPassInputV1, FirstPassDesignSystemV1 } from './rebrand-plan.ts';
export { assignColors, COLOR_RULES, DEFAULT_MIN_SEPARATION } from './rebrand-colors.ts';
export type { AssignColorsInputV1, BrandSwatchV1, LockedColorV1 } from './rebrand-colors.ts';
export { mapFonts, FONT_ALIASES, FONT_RULES } from './rebrand-fonts.ts';
export type { MapFontsInputV1, BrandFacesV1 } from './rebrand-fonts.ts';
export { scoreArchetypes, pickArchetype, ARCHETYPE_RULES, ARCHETYPE_MIN_GAP } from './rebrand-archetype.ts';
export type { ArchetypeHintsV1, ArchetypeScoreV1, ArchetypePickV1, PickArchetypeOptsV1 } from './rebrand-archetype.ts';
export { carryForward, applyDecision, DECISION_RULES } from './rebrand-decisions.ts';
export type { CarryForwardResultV1, CarriedDecisionV1 } from './rebrand-decisions.ts';

// Renovation stage 5, the renovate mode (plan 274 section 3.4): an accepted plan
// compiled onto the design system's slide master, and the pure SVG preview that
// draws the same rows the compile wrote, so a review and Design agree.
export { compileRenovated, DECK_RENOVATE_VERSION, AVERAGE_GLYPH_EM, ESTIMATE_LINE_HEIGHT, MAX_CONTINUATION_FRAMES } from './deck-compile.ts';
export type { CompileRenovatedInputV1, CompileRenovatedOptsV1, RenovateDesignSystemV1 } from './deck-compile.ts';
export { framePreviewSvg, wrapByAverageWidth } from './frame-preview-svg.ts';
export type { FramePreviewOptsV1 } from './frame-preview-svg.ts';

// Plan 274 work package 4 follow-ups: the cover-slide test the first pass reads
// a title slide by, and the hint options a caller narrows the hints with.
export { isCoverSlide } from './rebrand-plan.ts';
export type { ArchetypeHintsOptsV1 } from './rebrand-plan.ts';

// Plan 274 milestone 3: the design-system resolver every renovation surface
// shares, the review model the queue and the footer render, and the pure plan
// edits the view, the CLI and the MCP tool apply.
export { resolveRebrandDesignSystem, swatchesFromColors, themeSlotsFromColors, neutralSlideMaster, colorTokenHash, THEME_SLOTS, THEME_SLOT_TOKENS, THEME_SLOT_ALIASES, FALLBACK_BRAND_FACE } from './rebrand-design-system.ts';
export type { RebrandDesignSystemInputV1, RebrandDesignSystemV1, ThemeSlotV1, ThemeSlotAliasV1 } from './rebrand-design-system.ts';
export { reviewQueue, objectStates, slideStates, planSummary, pendingSuggestionIds, reviewMessage, effectiveAction, effectiveReplacement, effectiveSlideOrder, reviewFidelity, isCorrected, REVIEW_MESSAGES, REVIEW_NOUNS, REVIEW_FIDELITIES, QUEUE_SECTIONS } from './rebrand-review.ts';
export type { ReviewMessageV1, ReviewMessageCodeV1, ReviewNounKeyV1, ReviewFidelityV1, QueueSectionV1, QueueItemV1, ObjectStateV1, SlideStateV1, PlanSummaryV1 } from './rebrand-review.ts';
export { decideObjects, acceptSuggestions, setSlidesIncluded, moveSlide, moveSlides, resetSlideDecisions, setObjectText, setSlidesLayout, slidesSharingSourceLayout, setColorTarget, setFontTarget, capturePlanRows, restorePlanRows } from './rebrand-edit.ts';
export type { PlanEditResultV1, PlanEditSkipReasonV1, DecideObjectsInputV1, AcceptSuggestionsOptsV1, ResetSlidesOptsV1, PlanRowsSnapshotV1, PlanRowsTouchedV1 } from './rebrand-edit.ts';
export { markAppliedUnreviewed } from './rebrand-report.ts';
export { evidenceMessage } from './rebrand-review.ts';
export type { EvidenceContextV1 } from './rebrand-review.ts';
export { archetypeCoverage, COVERAGE_ROLES } from './rebrand-archetype.ts';
export type { CoverageRoleV1 } from './rebrand-archetype.ts';

// Plan 274 milestone 4: the one rule for the rows that still wait for an answer
// (no decision, unreviewed or needs attention, not locked, on an included slide),
// which the web view, the CLI, the MCP tool and the TUI gate on and count, and
// the picture grid a slot of several kept pictures is laid out with.
export { openPendingIds, openPendingCounts } from './rebrand-review.ts';
export { pictureGrid, MAX_GRID_PICTURES, GRID_GUTTER_SHARE } from './deck-compile.ts';
export { designTextOf, designTextFromPlain, parseDesignText, parseDesignLine, plainOfDesignText, hasDesignMarkup, escapeMarkup, hugMarkers } from './design-text.ts';
export type { DesignTextOptsV1, DesignTextResultV1, DesignTextRunV1, DesignTextLineV1 } from './design-text.ts';
export { archetypeIdFor, framePosition, FRAMES_PER_ROW, PICTURE_BOX_MIN_SHARE } from './deck-compile.ts';
export { PPTX_FORMATTING_READER_SINCE, PPTX_READER_SINCE } from './pptx-read.ts';
// Plan 275 review: where each layer of a frame goes on Apply layout, so Design rebuilds
// the frame around the slots the layers fill and reports only what kept its place.
export { archetypeSlots } from './slide-master.ts';
export type { ArchetypeSlotsV1 } from './slide-master.ts';
export type { GridCellV1 } from './deck-compile.ts';
// Flattened slides (plan 274 milestone 5): regions of a slide picture and the typesetting
// recovered from OCR lines, both pure, so the node pipeline and the web stage share them.
export { findSlideRegions, groundOfRegion, cropRgba, inkCoverage, inkBounds, inkColourOf, inkMaskOf } from './slide-regions.ts';
export type { RgbaImageV1, RegionBoxV1, SlideRegionKindV1, SlideRegionReasonV1, SlideRegionEvidenceV1, SlideRegionV1, SlideRegionsV1, SlideRegionOptsV1, InkGroundV1 } from './slide-regions.ts';
export { typesetOcrLines, readingOrderOf, glyphSetOf, lineSizeEstimate } from './ocr-typeset.ts';
export type { OcrLineInputV1, GlyphSetV1, TypesetOptsV1, TypesetLineV1, BulletEvidenceV1, TypesetParagraphV1, TypesetBlockV1 } from './ocr-typeset.ts';
// One word-break rule for the PDF interpreter, pdf-text and the rebrand PDF adapter.
export { pdfWordBreak, PDF_WORD_GAP_EM, PDF_RUN_WORD_GAP_EM, PDF_UNSPACED_GAP_EM, PDF_MIXED_GAP_EM } from './pdf-map.ts';
// The noun a review row names its object by, so a shell reads the engine's word.
export { nounFor } from './rebrand-review.ts';
// Plan 275 deck themes: the theme laid over the design system, the plan edits with their undo, and the solve per ground group.
export { systemForPlan, masterForPlan, themedColors, themeSourceOf } from './rebrand-design-system.ts';
export type { ThemeSourceV1, DeckLookV1, ThemeNoteV1, ThemedColorsV1, SystemForPlanOptsV1 } from './rebrand-design-system.ts';
export { buildDeckTheme, deckThemeChoices, deckGround, slideGroundPlan, slideGroundHex, solveThemeColors, themePreview, setDeckTheme, setSlideGround, captureThemeRows, restoreThemeRows, THEME_ROW_ID } from './rebrand-theme.ts';
export type { DeckThemeChoiceV1, ThemeSwatchesV1, SlideGroundPlanV1, ThemeSolveContextV1, ThemeSolveV1, ThemePreviewV1, ThemeEditResultV1, ThemeEditOptsV1, ThemeRowsSnapshotV1 } from './rebrand-theme.ts';
export { assignColorsByGround } from './rebrand-colors.ts';
export type { GroundGroupV1, ColorGroundIssueV1 } from './rebrand-colors.ts';
// Plan 275 WP2: the structure matcher and Auto-match (decision 28), one plan edit every surface calls.
export { autoMatchLayouts, autoMatchCount, autoMatchPreview, autoMatchedCounts, autoMatchReportEntries, withAutoMatchEntries, matchSlideLayout, readSlideStructure, archetypeForRead, slotCapacity, layoutNamePrior, structureName, STRUCTURE_RULES, AUTO_MATCH_BANDS } from './rebrand-structure.ts';
export type { AutoMatchBandsV1, AutoMatchOptsV1, AutoMatchSlideV1, AutoMatchSkipV1, StructureReadV1, SlideStructureReadV1, SlideLayoutMatchV1, ReadStructureOptsV1, MatchSlideLayoutOptsV1 } from './rebrand-structure.ts';
export type { ReviewQueueOptsV1 } from './rebrand-review.ts';
// Plan 275 decision 32: a drawing read as bounded items, and those items as Design rows and as clean SVG.
export { svgItemsOf, custGeomItems, vectorItemsToRows, vectorItemsSvg, vectorItemsDocument, MAX_VECTOR_ROWS_PER_OBJECT, MAX_VECTOR_ROWS_PER_FRAME, VECTOR_ITEM_MAX_NODES, VECTOR_ITEM_MAX_ENCODED, VECTOR_ROW_KIND_WORDS } from './svg-items.ts';
export type { SvgItemsOptsV1, SvgItemsXmlParser, CustGeomPaintV1, VectorRowsOptsV1, VectorPlacementV1, VectorRowsResultV1 } from './svg-items.ts';
// A document's budget of drawn path data, a drawing row's name taken apart, and a picture's crop applied to its drawing.
export { MAX_VECTOR_PATH_CHARS_PER_DOCUMENT, vectorRowsPathChars, vectorRowNameParts, cropVectorItems, cropViewBox } from './svg-items.ts';
export type { VectorCropV1 } from './svg-items.ts';
export { vectorFeatures, vectorColourUses, vectorChartEvidence, VECTOR_CHART_CONFIDENCE } from './deck-census-vector.ts';
export type { VectorFeatureFactsV1, VectorColourUseV1, VectorChartEvidenceV1 } from './deck-census-vector.ts';
// Plan 275 WP7: the Brand ground a stored theme names, and the ground distance that makes two theme tiles two choices.
export { brandGroundPath, THEME_DISTINCT_GROUND } from './rebrand-theme.ts';
export type { DeckGroundOptsV1 } from './rebrand-theme.ts';
export { themeSwatches } from './rebrand-theme.ts';
// Plan 275 section 4: a slide kept in its original arrangement or as a picture, one plan edit and the furniture it sits under.
export { setSlidesArrangement } from './rebrand-edit.ts';
export { ARRANGED_ARCHETYPE } from './deck-compile.ts';
// Plan 275 close-out: one text layout for the compile, the preview and the words-cut count, the document's path budget, and the compile options a design-system input carries.
export { designTextFit, layoutDesignText, DESIGN_LINE_HEIGHT, DOCUMENT_PATH_CHARS, compileSystemOpts } from './deck-compile.ts';
export type { DesignTextFitV1, DesignTextLayoutV1 } from './deck-compile.ts';
