// SPDX-License-Identifier: MPL-2.0
/**
 * The host-side half of the renovation journey (plan 274): read a source file
 * into the stage-1 `SourceDeckV1` model.
 *
 * `sourceDeckFromPptx` reads a PowerPoint package and `sourceDeckFromPdf` a PDF,
 * over the page walk in `../pdf-read.ts`.
 *
 * Everything past stage 1 that is pure lives in the engine
 * (`engine/src/deck-compile.ts`, `engine/src/rebrand-report.ts`). What belongs
 * here is the part that needs bytes: hashing content for identity, storing media
 * through a sink the shell owns, and the XML parser a caller injects.
 *
 * `flattened.ts` rebuilds a slide that is one picture of a whole slide from its
 * regions, with OCR injected (plan 274 section 6), and `ocr-node.ts` adapts the
 * node OCR runner to that injection for a caller that has the model installed.
 *
 * `pipeline.ts` runs every stage in order for a terminal, a script or a test
 * (read a pptx or a PDF, rebuild or keep the flattened slides, census, first
 * pass, compile, and the Design session, `.lolly` and
 * `.pptx` writers), `design-system.ts` reads the active content profile's
 * design system for it, and `presets.ts` finds the renovation presets that
 * design system and the personal presets file hold.
 *
 * Imported through the package's `./rebrand` subpath, never by relative path.
 * That subpath is for Node callers: pipeline.ts, design-system.ts and
 * presets.ts import `node:fs`, `node:path` and `node:crypto`, so a browser
 * caller imports an adapter module on its own instead, as the web shell does
 * through `./rebrand/source-pptx`. The PDF adapter is browser-safe too, but the
 * package exports no `./rebrand/source-pdf` subpath for it yet.
 */

export {
  sourceDeckFromPptx,
  newInstanceId,
  type MediaSinkV1,
  type SourcePptxOptsV1,
} from './source-pptx.ts';

export {
  sourceDeckFromPdf,
  SOURCE_PDF_DEFAULT_CAPS,
  type SourcePdfOptsV1,
  type SourcePdfCapsV1,
} from './source-pdf.ts';

export {
  readDeck,
  planDeck,
  compileDeck,
  checkPlanFits,
  planSourceProblems,
  acceptScopeOf,
  outcomeOf,
  outcomeCounts,
  planProblems,
  pipelineAlgorithms,
  flattenedReadOfPlan,
  pictureDimensions,
  resolvePipelineSystem,
  mediaRefFor,
  sourceHashOf,
  compiledRows,
  designSessionFromCompiled,
  buildDesignLolly,
  compiledDeckToPptx,
  catalogAssetBytes,
  RebrandPipelineError,
  PIPELINE_READER,
  PDF_PIPELINE_READER,
  pipelineReaderFor,
  decodePipelinePicture,
  FLATTENED_MAX_PIXELS,
  MEDIA_REF_PREFIX,
  DESIGN_TOOL_ID,
  REBRAND_HANDOFF_KEY,
  type RebrandFailureCodeV1,
  type AcceptScopeV1,
  type RebrandXmlParserV1,
  type PipelineMediaV1,
  type PipelineSystemV1,
  type ReadDeckInputV1,
  type ReadDeckResultV1,
  type FlattenedModeV1,
  type FlattenedReadV1,
  type PipelinePictureV1,
  type FlattenedKeepReasonV1,
  type FlattenedSlideReportV1,
  type PictureDecoderV1,
  type PlanDeckInputV1,
  type PlanDeckResultV1,
  type CompileDeckInputV1,
  type CompileDeckResultV1,
  type OutcomeCountsV1,
  type DesignSessionV1,
  type DesignSessionOptsV1,
  type DesignLollyInputV1,
  type DesignLollyResultV1,
  type CompiledPptxInputV1,
  type CompiledPptxResultV1,
} from './pipeline.ts';

export {
  reconstructFlattenedSlide,
  flattenedPictureOf,
  type FlattenedOcrV1,
  type FlattenedDecisionV1,
  type ReconstructFlattenedInputV1,
} from './flattened.ts';

export {
  nodeFlattenedOcr,
  type NodeFlattenedOcrOptsV1,
  type NodeFlattenedOcrV1,
} from './ocr-node.ts';

export {
  resolveProfileDesignSystem,
  colorTokensFromDtcg,
  fontsFromDtcg,
  type RebrandResolvedSystem,
  type ResolveProfileDesignSystemOptsV1,
} from './design-system.ts';

export {
  listPresets,
  resolvePreset,
  presetProblems,
  toRenovationPreset,
  personalPresetsFile,
  isPresetFileSpec,
  RebrandPresetError,
  PRESET_ASSET_TAGS,
  PRESET_FILE_VERSION,
  PERSONAL_PRESETS_FILE,
  type PresetEntryV1,
  type PresetFileV1,
  type PresetErrorCodeV1,
  type PresetOriginV1,
  type ResolvedPresetV1,
  type PresetProblemV1,
  type PresetListingV1,
  type PresetOptsV1,
} from './presets.ts';
