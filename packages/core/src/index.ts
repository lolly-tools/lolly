// SPDX-License-Identifier: MPL-2.0
/**
 * @lolly-tools/core - the Lolly tool-author contract.
 *
 * Depend on this package to build a Lolly tool without cloning the platform:
 *   - Types: the `HostV1` capability bridge + the `tool.json` manifest shape.
 *   - validateTool(): validate a manifest against the authoritative JSON Schema.
 *   - createMockHost(): an in-memory HostV1 to unit-test your hooks headlessly.
 *   - defineTool() / defineHooks(): identity helpers for type-checked authoring.
 *
 * See README.md for the quickstart and examples/ for a complete tool.
 */
export type * from './contract.ts';
export * from './file-operation-v1.ts';
export { FILE_CONTRACT_VERSION, safeFileName, allocateFileName, normalizeSha256 } from './file-v1.ts';
export type { FileFactsV1, FileReferenceV1, FileOperationFindingV1, FileOperationReportV1 } from './file-v1.ts';

/** The canonical `FinishKind` spellings, as a value: the ONE list. `FinishKind`
 *  is derived from it, and `engine/src/preflight.ts` builds its recognised-finish
 *  set from it. This keeps the open union and the check that reports an
 *  unrecognised spelling from drifting apart. */
export { KNOWN_FINISH_KINDS } from './host-v1.ts';

export { validateTool, validateCanvasOp } from './validate.ts';
export type { ValidationIssue, ValidationResult } from './validate.ts';

export { createMockHost } from './mock-host.ts';
export { HOST_V1_OPTIONAL_APIS, presentApis, missingRequires } from './host-v1/apis.ts';
export { runHostConformance, formatConformance, HOST_V1_METHODS, HOST_V1_REQUIRED_APIS } from './host-conformance.ts';
export type { ConformanceReport, ConformanceIssue, ConformanceOpts, HostApi, HostRequiredApi, ApiMethods } from './host-conformance.ts';
export { withOptionalStubs } from './mock-host.ts';
export type { HostApiName } from './host-v1/apis.ts';
export type {
  MockHost,
  MockHostInspection,
  CreateMockHostOpts,
  ExportCall,
  LogLine,
} from './mock-host.ts';

export type {
  Severity, UnknownReason, Fact, QuantityKind, QuantityUnit, Bound, Count,
  FindingId, Evidence, Finding, PreflightReport,
  ReportedDimension, ReportedSize, ReportedSettings, ReportedJob,
} from './preflight.ts';
export {
  SEVERITY_RANK, knownFact, unknownFact, PREFLIGHT_FORMAT, PREFLIGHT_FORMAT_VERSION,
} from './preflight.ts';

// Money - the currency-formatting helper and the serialised money-bearing artifact
// shape. A SIBLING of the preflight vocabulary (never inside `PreflightReport`),
// so a report can never carry a number that reads as a quote. There is no default
// currency and no fallback symbol anywhere in it. See `plans/65-preflight-and-cost.md`
// section 6, and the header of `money.ts`.
export {
  formatMoney, formatFigure, monetaryFigure, minorUnitExponent,
  CurrencyError, MinorUnitError, COST_DISCLAIMER, COST_MEMBER,
} from './money.ts';
export type {
  MoneyInput, MonetaryFigure, SerializedCost, CostRatesFrom,
  SerializedWorkingRow, SerializedAdjustmentRow, SerializedUncostedLine,
} from './money.ts';

// money-policy - the pure decide-money-or-counts predicate. Keyed on per-selection
// provenance (own session vs reached-via-link), NOT on any URL param: the whole
// design keeps card identity and money out of URL space. See `money-policy.ts`.
export { canShowMoney } from './money-policy.ts';
export type { MoneyContext } from './money-policy.ts';

// extension-v1 - the chrome extension contract (the door + furniture-spec, and
// the enumerable slot catalog). The host-v1 analog for chrome surfaces: a typed
// contract both supply channels compile against without depending on the engine
// or a shell. Types + one data constant only; no runtime, no DOM. See its header.
export { SLOT_REGISTRY, EXTENSION_CONTRACT_VERSION } from './extension-v1.ts';
export type {
  ExtensionSlotId, SlotCardinality, ExtensionChannel, Disposer,
  SlotManifest, SlotHost, Extension,
} from './extension-v1.ts';

// canvas-op-v1 - the canvas op/awareness/params contract (plans/99). The
// host-v1 analog for the live canvas: a typed seam the OSS shell's
// Scene/presenter and lolly-work's Yjs adapter both compile against without
// either depending on the engine or on yjs. Canonical in this repo (the op
// SHAPE is decided here; the transport lives in lolly-work). The OSS side's
// dormant `org/` seam registers a `CanvasSyncAdapter` against it. With
// nothing registered the path is dead and behaviour is byte-identical to
// single-player. `ReferenceCanvasDoc` is a dependency-free reference CRDT used
// to prove convergence in this repo's tests without a yjs dependency. See
// canvas-op-v1.ts's header and plans/99-canvas-op-contract.md.
export {
  CANVAS_OP_VERSION, DEFAULT_GEOMETRY_FIELDS, laneForField, damageToOps,
  opsToDamage, isCompatibleOpVersion, ReferenceCanvasDoc,
} from './canvas-op-v1.ts';
export type {
  BoxId, Scalar, BoxRow, GeometryField, OpOrigin, Damage, CanvasOp, GeomOp,
  FieldOp, AddOp, RemoveOp, OrderOp, ParamOp, ParamValue, ParamLiteral,
  ParamBinding, ProviderRef, Awareness, Presence, CanvasDocState,
  CanvasSyncAdapter,
} from './canvas-op-v1.ts';

export { defineTool, defineHooks } from './define-tool.ts';
export type {
  HookContext,
  HookModelItem,
  HookResult,
  ToolHooks,
  ExportHookContext,
  ExportFileResult,
} from './define-tool.ts';

// chart-v1 - the renderer-neutral chart document carried by the Chart tool,
// document API, CLI and automation surfaces. Libraries are adapters, never part
// of this saved/public shape.
export { CHART_SPEC_VERSION } from './chart-v1.ts';
export type {
  ChartValue, ChartFieldType, ChartFieldRole, ChartFieldFormat, ChartDimension, ChartExportFidelity, ChartMark,
  ChartChannel, ChartFieldV1, ChartDatasetV1, ChartEncodingV1, ChartSeriesV1,
  ChartScaleV1, ChartAxisV1, ChartLegendV1, ChartFormatterV1, ChartThemeV1,
  ChartMotionV1, ChartAccessibilityV1, ChartPresentationV1, ChartSpecV1,
  ChartFindingSeverity, ChartFindingV1, ChartColumnProfileV1, ChartDataProfileV1,
  ChartRecommendationV1, ChartValidationResultV1,
  ResolvedChartReportV1,
} from './chart-v1.ts';

// design-v1 - a semantic READ model over Design's permanent flat `boxes` wire
// value. Shared by MCP inspection and the web inspector; it does not replace or
// migrate saved documents.
export { DESIGN_DOCUMENT_VERSION, DESIGN_LAYER_KINDS, inspectDesignV1 } from './design-v1.ts';
export type {
  DesignLayerKindV1, DesignFindingSeverityV1, DesignBoundsV1, DesignTimingV1,
  DesignLayerInspectionV1, DesignArtboardInspectionV1, DesignFindingIdV1,
  DesignFindingV1, DesignInspectionV1, InspectDesignV1Options,
} from './design-v1.ts';

/** The `HostV1` contract version this SDK targets (matches `HostV1.version`). */
export const CONTRACT_VERSION = '1';

export { RIGHTS_ISSUE_CODES, RIGHTS_STATUSES, CREATIVE_OPERATIONS } from './rights-v1.ts';
export type {
  RightsIssueCodeV1, RightsStatusV1, RightsAssertingPartyV1, RightsEvidenceSourceV1, RightsEvidenceStatusV1,
  RightsEvidenceV1, CreativePartyV1, PermissionGrantV1, CreativeWorkRecordV1, CreativeUseRoleV1, CreativeOperationV1,
  CreativeClassificationV1, CreativeUseV1, DeliveryRouteV1, UseContextV1, RightsRemedyV1, RightsIssueV1,
  AttributionNoticeV1, AttributionChannelV1, AttributionPlanV1, CreativeUseResultV1, RightsDecisionV1,
  RightsEvaluationV1, ReceiptStateV1, AttributionReceiptV1, RightsReportSourceV1, RightsReportV1,
} from './rights-v1.ts';
// rebrand-v1 - plan 274: the renovation contracts (source deck with per-object fidelity,
// census, renovation plan, compiled deck, report, project). Shared by #/rebrand, the
// CLI stages and the MCP tool. Pure data; the engine modules that fill them are pure too.
export {
  REBRAND_CONTRACT_VERSION, REBRAND_REFERENCE_DPI, SOURCE_KINDS, SOURCE_OBJECT_KINDS, SOURCE_ORIGINS,
  FIDELITY_STATES, FIDELITY_REASONS, PLACEHOLDER_TYPES, OCR_STATES, SOURCE_WARNING_CODES, OBJECT_CLASSES,
  EVIDENCE_SIGNALS, PLAN_ACTIONS, REVIEW_STATES, DECISION_AUTHORS, ARCHETYPE_ROLES, ARCHETYPE_IDS,
  COLOR_UNRESOLVED_REASONS, DISPOSITIONS, REPORT_CODES, PROJECT_STAGES, FILE_OUTCOMES, REBRAND_ERROR_CODES,
  PROJECT_PART_KINDS, PROJECT_WRITE_REFUSALS, SOURCE_ROLE_ESTIMATES,
} from './rebrand-v1.ts';
// Plan 275: open archetype ids (the twelve kept as KNOWN_ARCHETYPE_IDS), the layout read's units and match, deck themes and grounds.
export { KNOWN_ARCHETYPE_IDS, STRUCTURE_ID_PATTERN, isArchetypeRef, isKnownArchetypeId, LAYOUT_UNIT_KINDS, LAYOUT_MATCH_BANDS, SLIDE_GROUNDS, DECK_THEME_IDS } from './rebrand-v1.ts';
// Plan 275 decision 32 and section 4: vectors read as items, and how a slide is built (layout, original arrangement, picture).
export { VECTOR_OMIT_REASONS, VECTOR_ITEMS_MAX, VECTOR_ITEMS_MAX_CHARS, VECTOR_DECK_ITEMS_MAX, SLIDE_ARRANGEMENTS } from './rebrand-v1.ts';
export type { VectorOmitReasonV1, VectorItemsV1, VectorPathItemV1, VectorTextItemV1, VectorItemV1, SlideArrangementV1 } from './rebrand-v1.ts';
export type { StructureIdV1, ArchetypeRefV1, ReviewMessageV1, LayoutMatchBandV1, LayoutMatchV1, SlideGroundV1, LayoutUnitKindV1, LayoutUnitV1, FractionBoxV1, DeckThemeIdV1, DeckThemeV1, PresetLockedColorV1, RenovationPresetV1 } from './rebrand-v1.ts';
export type {
  SourceKindV1, SourceObjectKindV1, SourceOriginV1, FidelityStateV1, FidelityReasonV1, FidelityV1, PlaceholderTypeV1,
  BoxV1, SourceColorV1, SourceGradientV1, SourceRunV1, SourceParaV1, OcrStateV1, OcrLineEvidenceV1, OcrEvidenceV1, RasterStatsV1,
  SourceWarningCodeV1, SourceWarningV1, SourceObjectV1, SlideSourceV1, SourceDeckV1, ObjectClassV1, EvidenceSignalV1,
  SourceRoleEstimateV1, SlideRecoveryV1, SlideOcrV1,
  EvidenceV1, ClassHypothesisV1, ObjectGroupV1, ColorUseV1, ContrastPairV1, FontUseV1, LayoutFeaturesV1, DeckCensusV1,
  PlanActionV1, ReviewStateV1, DecisionAuthorV1, ReplacementV1, ObjectPlanV1, ArchetypeRoleV1, ArchetypeIdV1, SlidePlanV1,
  ColorUnresolvedReasonV1, ColorMappingV1, FontMappingV1, DecisionMemoryV1, DesignSystemSnapshotV1, AlgorithmVersionsV1,
  RenovationPlanV1, DesignBoxRowV1, CompiledFrameV1, LineageV1, CompiledDeckV1, DispositionV1, ReportCodeV1, ReportEntryV1,
  RebrandReportV1, ProjectStageV1, RenovationProjectV1, FileOutcomeV1, RebrandErrorCodeV1, RebrandCapabilitiesV1,
  ProjectPartKindV1, ProjectWriteRefusalV1, ProjectWriteResultV1, RenovationProjectStoreV1, StageProgressV1, StageEnvelopeV1, DecodeBudgetV1,
} from './rebrand-v1.ts';

export type {
  EmojiPackPinV1, EmojiSourceRecordV1, EmojiSourceV1, EmojiMeaningV1, EmojiMetricsV1, EmojiGlyphV1,
  EmojiPackManifestV1, EmojiStyleV1, EmojiRequestV1, EmojiIssueCodeV1,
  EmojiIssueV1, ResolvedEmojiGlyphV1, EmojiResolutionV1,
} from './emoji-v1.ts';

// live-v1 - plan 289 D1: an agent working in a running Design editor (desktop listener or paired tab).
export { LIVE_PROTOCOL, LIVE_METHODS, LIVE_LIMITS, LIVE_ERRORS, parseLiveRequest, liveResult, liveError } from './live-v1.ts';
export type { LiveMethodV1, LiveRequestV1, LiveReplyV1, LiveHelloResultV1, LiveDocumentV1, LiveApplyParamsV1, LiveLookResultV1 } from './live-v1.ts';
export type { AgentPresence, AgentChange, AgentChangeTarget } from './agent-presence-v1.ts';

export type { LearningRichNode, LearningQuiz, LearningProgressEventV1, LearningTarget, LearningSource, LearningBlock, LearningLesson, LearningModule, LearningFile, LearningContentBlock, LearningContent, LearningAttempt, LearningFinding, LearningRelease } from './learning-v1.ts';
export type { StudioSceneV1, StudioSourceV1, StudioObjectV1, StudioCameraKeyV1, StudioMaterialV1, StudioLightV1, StudioSurfaceInfo, StudioSourceInfo, StudioVector3, StudioProjection, StudioFinish, StudioFinishSpec, StudioLookScopeV1, StudioLinkV1, StudioMotionKind, StudioPoseV1 } from './studio3d-v1.ts';

export * from './text-v1.ts';

// slide-master-v1 - plan 274 section 3.4: slide masters as design-system data. A brand
// pack ships one file of these; the engine seeds Design frames from them and Design's
// Reset slide and Apply archetype re-lay role-bound layers through them.
export {
  SLIDE_MASTER_CONTRACT_VERSION, PLACEHOLDER_KINDS, FURNITURE_KINDS, MASTER_ALIGNMENTS,
  MASTER_VALIGNMENTS, MASTER_FONT_SLOTS, findArchetype, findFurniture, roleFontSize,
} from './slide-master-v1.ts';
export type {
  PlaceholderKindV1, FurnitureKindV1, MasterAlignV1, MasterValignV1, MasterFontSlotV1,
  MasterBoxV1, MasterTextStyleV1, PlaceholderLayerV1, FurnitureLayerV1, ArchetypeBackgroundV1,
  ArchetypeV1, MasterTypeScaleV1, MasterLogoV1, SlideMasterV1, SlideMasterFileV1,
} from './slide-master-v1.ts';
export type { GridSpanV1, ArchetypeRepeatV1 } from './slide-master-v1.ts';

export { assetOpenChoices } from './asset-open-v1.ts';

// check-v1 - plan 291 W1: one findings list across five families for `lolly check`,
// `lolly_check` and the web page hook. Types and constants only.
export {
  CHECK_FORMAT, CHECK_FORMAT_VERSION, CHECK_FAMILIES, CHECK_FAMILY_STATES, CHECK_CHECKERS,
  CHECK_FINDING_NEEDS, CHECK_OUTCOMES, CHECK_EXIT_CODES, CHECK_EXIT, CHECK_OUTCOME_EXIT_CODES,
  CHECK_INPUT_KINDS, CHECK_DESIGN_SYSTEM_ORIGINS, CHECK_CODE_PATTERN,
} from './check-v1.ts';
export type {
  CheckFamily, CheckFamilyStateKind, CheckCheckerV1, CheckFindingNeedsV1, CheckOutcomeV1, CheckExitCodeV1,
  CheckInputKindV1, CheckDesignSystemOriginV1, CheckBoxV1, CheckFixV1, CheckOriginV1, CheckFindingV1,
  CheckFamilyStateV1, CheckCountsV1, CheckInputV1, CheckFidelityV1, CheckDesignSystemV1, CheckReportV1,
  CheckFidelityEditV1, CheckFidelityExceptedV1,
} from './check-v1.ts';

// content-inventory-v1 - plan 291 W2: what a source deck says, slide by slide, for
// `lolly read`, `lolly_read` and the check's fidelity family. Types and constants only.
export {
  CONTENT_INVENTORY_VERSION, INVENTORY_SOURCE_KINDS, INVENTORY_TEXT_ROLES, INVENTORY_PICTURE_KINDS,
  INVENTORY_ALIGNMENTS,
} from './content-inventory-v1.ts';
export type {
  InventorySourceKindV1, InventoryTextRoleV1, InventoryPictureKindV1, InventoryAlignV1, InventoryBoxV1,
  InventoryRunV1, InventoryParagraphV1, InventoryTextV1, InventoryNotesV1, InventoryCropV1, InventoryPictureV1,
  InventoryTableV1, InventoryChartV1, InventoryObjectV1, InventorySlideV1, InventoryMediaV1, InventorySourceV1,
  InventoryThumbnailV1, ContentInventoryV1,
} from './content-inventory-v1.ts';

// design-package-v1 - plan 291 W8: what `lolly package` and `lolly_package` report after
// writing a Design document as a reopenable .lolly session. Types and constants only.
export {
  DESIGN_PACKAGE_FORMAT, DESIGN_PACKAGE_VERSION, DESIGN_PACKAGE_MEDIA_ORIGINS, DESIGN_PACKAGE_ERROR_CODES,
  DESIGN_PACKAGE_WARNING_CODES,
} from './design-package-v1.ts';
export type {
  DesignPackageMediaOriginV1, DesignPackageErrorCodeV1, DesignPackageWarningCodeV1, DesignPackageMediaV1,
  DesignPackageMissingV1, DesignPackageReferencesV1, DesignPackageWarningV1, DesignPackageReadbackV1,
  DesignPackageReportV1,
} from './design-package-v1.ts';

// text-measure-v1 - plan 291 W5: where a plain Design text layer's lines break and how
// tall it is, for `lolly measure --text`, `lolly_measure_text` and the check's
// text-measure checker. Types and constants only.
export { TEXT_MEASURE_FORMAT, TEXT_MEASURE_VERSION, TEXT_MEASURE_METHOD, TEXT_MEASURE_BREAKS, TEXT_MEASURE_VALIGNS } from './text-measure-v1.ts';
export type {
  TextMeasureBreakV1, TextMeasureValignV1, TextMeasureFontsV1, TextMeasureSpecV1, TextMeasureFaceV1, TextMeasureLineV1,
  TextMeasureBoxV1, TextMeasureOverflowV1, TextMeasureToleranceV1, TextMeasureV1,
} from './text-measure-v1.ts';

// design-authoring-v1 - plan 291 W5: the `$` keys and layout macros an agent may write
// into Design rows, lowered to stored rows by the engine's expandDesignAuthoring.
// Types and constants only.
export {
  DESIGN_AUTHORING_FORMAT, DESIGN_AUTHORING_MAX_ROWS, DESIGN_AUTHORING_ROW_KEYS, DESIGN_AUTHORING_PATH_KEYS,
  DESIGN_AUTHORING_PATCH_KEYS, DESIGN_AUTHORING_MACROS, DESIGN_AUTHORING_DOCUMENT_KEYS, DESIGN_TEXT_STYLE_IDS,
  DESIGN_TEXT_STYLE_FIELDS, DESIGN_TEXT_ALIGNS, DESIGN_TEXT_VALIGNS, DESIGN_PATH_CURVES, DESIGN_STACK_AXES,
  DESIGN_GRID_ORDERS, DESIGN_TEMPLATE_ANCHORS, DESIGN_AUTHORING_NOTE_CODES,
} from './design-authoring-v1.ts';
export type {
  DesignAuthoringRowKeyV1, DesignAuthoringPathKeyV1, DesignAuthoringPatchKeyV1, DesignAuthoringMacroV1,
  DesignAuthoringDocumentKeyV1, DesignTextStyleIdV1, DesignTextStyleFieldV1, DesignTextAlignV1, DesignTextValignV1,
  DesignPathCurveV1, DesignStackAxisV1, DesignGridOrderV1, DesignTemplateAnchorV1, DesignAuthoringNoteCodeV1,
  DesignTextStyleV1, DesignTextStyleTableV1, DesignAuthoringNoteV1, DesignAuthoringPointV1, DesignAuthoringKeysV1,
  DesignAuthoringRowV1, DesignMacroTemplateV1, DesignMacroSlotValueV1, DesignMacroItemV1, DesignMacroDividerV1,
  DesignStackV1, DesignGridV1, DesignTableColumnV1, DesignTableRowV1, DesignTableV1, DesignAuthoringMacroRowV1,
  DesignAuthoringDocumentV1,
} from './design-authoring-v1.ts';

// design-compose-v1 - plan 291 W6: a deck spec written as slide-master archetypes and slot
// content, the report composing it gives back, and the archetype catalogue an agent picks
// from (the engine's composeDesignSlides, `lolly compose`, `lolly_compose`). Types and
// constants only.
export {
  DESIGN_COMPOSE_FORMAT, DESIGN_COMPOSE_VERSION, DESIGN_COMPOSE_DEFAULT_WIDTH, DESIGN_COMPOSE_DEFAULT_HEIGHT,
  DESIGN_COMPOSE_DEFAULT_GAP, DESIGN_COMPOSE_MAX_SLIDES, DESIGN_COMPOSE_GROUNDS, DESIGN_COMPOSE_MASTER_ORIGINS,
  DESIGN_COMPOSE_LOGO_MODES, DESIGN_COMPOSE_SLOT_KINDS, DESIGN_COMPOSE_RESERVED_FIELDS, DESIGN_COMPOSE_NOTE_CODES,
  DESIGN_COMPOSE_EMPHASIS_MODES, DESIGN_COMPOSE_CASES, DESIGN_COMPOSE_TRANSITIONS,
} from './design-compose-v1.ts';
export type {
  DesignComposeEmphasisV1, DesignComposeCaseV1, DesignComposeTransitionV1,
  DesignComposeGroundV1, DesignComposeMasterOriginV1, DesignComposeLogoModeV1, DesignComposeSlotKindV1,
  DesignComposeReservedFieldV1, DesignComposeNoteCodeV1, ComposeSlotValueV1, ComposeFurnitureV1, ComposeSlideV1,
  DesignComposeSpecV1, ComposeFitV1, ComposeReportSlideV1, ComposeReportNoteV1, ComposeReportV1, ComposeEditV1,
  ComposeArchetypeSlotV1, ComposeArchetypeV1,
} from './design-compose-v1.ts';
