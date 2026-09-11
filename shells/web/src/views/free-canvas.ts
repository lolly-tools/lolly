// SPDX-License-Identifier: MPL-2.0
// free-canvas.js - the WYSIWYG direct-manipulation overlay for render.layout:'editor'.
//
// This is the ONLY DOM in the free-canvas feature. All geometry lives in the pure,
// unit-tested free-canvas-math.js. It mounts:
//   • a left toolbar (add / arrange / align / canvas background),
//   • a selection overlay (rotated outlines + 8 resize handles + a rotate handle),
//   • a contextual bar (fill / text controls / duplicate / delete + a transform readout),
// all as SIBLINGS of #tool-canvas inside #tool-stage. They live OUTSIDE the
// exported node (runtime.export is handed #tool-canvas), so they never appear in
// the output. They also carry [data-export-hide] as a backstop.
//
// The overlay reads box geometry from the MODEL (runtime.getModel) and maps native
// canvas pixels to screen pixels via the live canvasEl rect. This works regardless
// of transform: it combines fitCanvas's scale with stageNav's pan/zoom
// automatically. Edits mutate the box DOM directly for smooth feedback during a
// gesture, then commit ONE runtime.setInput on release, which the shell's undo
// wrapper coalesces into a single history step.
//
// Opt-in and progressive: without this overlay the same flat `boxes` array renders
// identically headless (CLI/URL). The engine and URL never see the editor.
//
// ── THE ONE RULE (sequence editing) ──────────────────────────────────────────
// On a time-capable tool (`timeCfg`) the canvas is a window onto ONE instant. One
// rule governs everything the user can touch:
//
//   "The canvas edits exactly what the canvas shows at the playhead. Moving the
//    playhead never changes the selection; selecting in the timeline moves the
//    playhead so the selection stays live; when a selection is nevertheless
//    off-playhead, the canvas says so and offers to reconcile. The timeline
//    inspector and the sidebar are the precision fallbacks and are never gated
//    by time."
//
// This rule is enforced in three places, on purpose, because enforcing it in only
// one place would leave a gap:
//   1. ACQUISITION - `seqHiddenSkip` makes a click fall THROUGH a hidden box to
//      the visible one beneath (no toast: in a stacked scene composition that
//      would fire on every click).
//   2. RETENTION - `paintChrome` suppresses the outline, all 8 resize handles,
//      the rotate handle and the contextual bar when the selection is not live,
//      so no pointer path can start a gesture on something nobody can see. The
//      chrome is positioned from the MODEL - mapped through the pose the playhead
//      has the box in, and an off-screen box has none - so without this it would
//      paint full editing controls at the authored rect, over nothing.
//   3. KEYBOARD - `onKey` refuses every mutating key on an off-playhead
//      selection, because a nudge or a Delete needs no visible controls at all.
// Plus the reconciliation: an off-playhead selection raises the `.fc-offplayhead`
// banner, whose button dispatches `fc-seek` at the box's own start. The timeline
// panel answers it, and reports the playhead position back via `tl-time`.
//
// Deliberately NOT built: a "selection follows playhead" preference. Premiere
// ships one and users still lose work to it: letting time change the selection
// destroys work.

import { sequenceFramesInOrder } from './free-canvas-math.ts';
import type { Box } from './free-canvas-math.ts';
import type { ArtboardPort, DesignCanvasPorts, FramePort, InspectorActions, ModelPort, NavigatorActions, SelectionPort } from './design-ports.ts';
import { frameThumb, shadowChoicesFrom, shapeChoicesFrom } from './free-canvas-fields.ts';
import type { VectorFieldConfig } from './vector-ops.ts';
import { PEN_DEFAULT_KIND } from './free-canvas-pen.ts';
import type { PathPaintFields } from './free-canvas-pen.ts';
import type { TimeCfg } from './timeline-math.ts';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { InputValue } from '../../../../engine/src/inputs.ts';
import { takePendingDesignImport } from '../lib/drop-router.ts';
import { brandFontFamilies } from '../lib/register-user-fonts.ts';
import { announce } from '../a11y.ts';
import { attachWobble } from '../lib/wobble.ts';
import { t } from '../i18n.ts';
import { mountDesignGuides } from './design-guides.ts';
import { SVG, icon } from './free-canvas-icons.ts';
import { railSession, } from './free-canvas/shared.ts';
import type { AddKind, CanvasCfg, ConnectCfg, Corner, DeepLinkState, FieldCfg, FontOption, ImportMode, InitFreeCanvasOpts, RuntimeApi, TouchPt } from './free-canvas/shared.ts';
import type { FcCtx } from './free-canvas/context.ts';
import { helpersOps } from './free-canvas/helpers.ts';
import { selectOps } from './free-canvas/select.ts';
import { timelineOps } from './free-canvas/timeline.ts';
import { stageOps } from './free-canvas/stage.ts';
import { narrationOps } from './free-canvas/narration.ts';
import { railOps } from './free-canvas/rail.ts';
import { toolboxOps } from './free-canvas/toolbox.ts';
import { menusOps } from './free-canvas/menus.ts';
import { contextBarOps } from './free-canvas/context-bar.ts';
import { gradientOps } from './free-canvas/gradient.ts';
import { documentOps } from './free-canvas/document.ts';
import { dialogsOps } from './free-canvas/dialogs.ts';
import { fieldPanelsOps } from './free-canvas/field-panels.ts';
import { objectsOps } from './free-canvas/objects.ts';
import { opsOps } from './free-canvas/ops.ts';
import { penToolOps } from './free-canvas/pen-tool.ts';
import { modesOps } from './free-canvas/modes.ts';
import { textEditOps } from './free-canvas/text-edit.ts';
import { gesturesOps } from './free-canvas/gestures.ts';
import { connectorsOps } from './free-canvas/connectors.ts';
import { edgesOps } from './free-canvas/edges.ts';
import { chromeSyncOps } from './free-canvas/chrome-sync.ts';
import { keysOps } from './free-canvas/keys.ts';
import { editorStateOps } from './free-canvas/editor-state.ts';
export { clampRailPos, stageBlockers, ctxTopBand, centreCtxBar, FC_TILT } from './free-canvas/shared.ts';
export type { DeepLinkState, CtxTopBand } from './free-canvas/shared.ts';

// Phase-A spatial-index pick: grid-accelerated on large docs, identical result to the
// linear hitTest/marqueeHit on small ones (plans/98 section 6.1; proven in canvas-scene.test.ts).

// plans/179 M1-C / M2 / M3: the ports the Design chrome (top bar, navigator, inspector)
// talks to this overlay through. Type-only - `design-ports.ts` is a contract file with
// no runtime, so importing it costs nothing in the editor chunk.

// plans/180 M-A: the PURE half of notes-to-voice - the field map, the status read and
// the frame walk. Everything that downloads a model or writes a clip is behind the
// lazy import in `narrateDeck` below, so this costs the editor chunk a few hundred bytes.

// plans/179 M3 (a): the pure row builders these panels used to keep private copies of.
// One implementation, shared with the inspector column - see the module header for why
// `wireSegs`'s `onSet` is required rather than defaulted to a `setField` closure.


// Type-only (erased at build): the timeline modules are LAZY - importing their types
// costs no chunk, and timeline-panel.ts pulls in styles/parts/timeline.css.


// Type-only, same terms: the showcase generator is a LAZY chunk too (it pulls
// timeline-math and the engine's keyframe module), so only its vocabulary is named here.

// Type-only: the ghost layer is a lazy chunk that only an editor with onion skin turned
// ON ever fetches, so its runtime import lives inside onionFrom's dynamic `import()`.

// Type-only, same terms: the motion-path layer (plans/104 section 8) is a lazy chunk that only
// an editor with a KEYFRAMED box selected ever fetches - and it pulls timeline-math (and
// therefore the engine's keyframe module) with it, which is exactly why it must not be a
// static import here.


// The boot-path slice of user-fonts (NOT ../user-fonts.ts, which would drag the
// whole Google-font fetcher into this view chunk - see user-fonts.ts:73-80).


export { placePopover } from './free-canvas-popover.ts';


// The app-wide "black or white, whichever reads on this" rule (see its own doc comment) -
// deliberately the same one the chrome accent and every colour surface flip with.


interface FreeCanvasHandle {
  destroy(): void;
  /** The live editor state in the `_ui` wire field names: what a link here would carry. */
  uiState(): { sel: string[]; t?: number; panel?: string };
  /** Apply editor state at runtime - the same routine the mount-time deep link runs. */
  applyUi(state: DeepLinkState): void;
  /**
   * The plans/179 side-column ports (see `design-ports.ts`). Present on EVERY mount, not
   * only Design's: each member answers from this overlay's own live state, and the
   * frame-shaped ones degrade honestly on a canvas with no frame primitive ('' / null)
   * rather than being absent and forcing every caller to feature-detect.
   */
  design: DesignCanvasPorts;
}
// Fallback font menu for editor tools whose manifest doesn't declare a font
// select - the historical hard-coded pair, so such tools keep working unchanged.
const FALLBACK_FONT_OPTIONS: FontOption[] = [
  { value: 'SUSE', label: 'SUSE Sans' },
  { value: 'SUSE Mono', label: 'SUSE Mono' },
];
/**
 * The Choreograph showcases (plans/104 P4), in the generator's own `SHOWCASE_IDS` order.
 *
 * The names and the lengths sit at MODULE SCOPE for the reason `KF_CAMERA_PRESETS`' table
 * does (timeline-panel.ts): scripts/translate.ts extracts literal `t('…')` call sites, so
 * a `t(showcase.label)` built at render time would need every name hand-listed in
 * extra-keys.spa.json. `ms` restates `SHOWCASE_MS` rather than importing it, because
 * ./choreograph.ts is a lazy chunk this picker must not pull in merely to draw itself -
 * tests/choreograph.test.ts and the co-located UI test pin the two id lists and these six
 * lengths equal, so the copy cannot drift.
 */
export { CHOREO_SHOWCASES } from './choreograph-options.ts';


export function initFreeCanvas(opts: InitFreeCanvasOpts): FreeCanvasHandle {
  const fc = {} as FcCtx;
  fc.helpers = helpersOps(fc);
  fc.select = selectOps(fc);
  fc.timeline = timelineOps(fc);
  fc.stage = stageOps(fc);
  fc.narration = narrationOps(fc);
  fc.rail = railOps(fc);
  fc.toolbox = toolboxOps(fc);
  fc.menus = menusOps(fc);
  fc.contextBar = contextBarOps(fc);
  fc.gradient = gradientOps(fc);
  fc.document = documentOps(fc);
  fc.dialogs = dialogsOps(fc);
  fc.fieldPanels = fieldPanelsOps(fc);
  fc.objects = objectsOps(fc);
  fc.ops = opsOps(fc);
  fc.penTool = penToolOps(fc);
  fc.modes = modesOps(fc);
  fc.textEdit = textEditOps(fc);
  fc.gestures = gesturesOps(fc);
  fc.connectors = connectorsOps(fc);
  fc.edges = edgesOps(fc);
  fc.chromeSync = chromeSyncOps(fc);
  fc.keys = keysOps(fc);
  fc.editorState = editorStateOps(fc);
  fc.opts = opts;

  const {
    viewEl,
    stageEl,
    canvasEl,
    runtime,
    host,
    input,
    nativeW,
    nativeH,
    onDirty,
    editTool,
    setCanvasSize,
    setDocumentSettings,
    info,
    history,
    actions,
    pages,
    chrome: designChrome,
    frame: frameCfg,
  } = opts;
  fc.viewEl = viewEl;
  fc.stageEl = stageEl;
  fc.canvasEl = canvasEl;
  fc.runtime = runtime;
  fc.host = host;
  fc.input = input;
  fc.nativeW = nativeW;
  fc.nativeH = nativeH;
  fc.onDirty = onDirty;
  fc.editTool = editTool;
  fc.setCanvasSize = setCanvasSize;
  fc.setDocumentSettings = setDocumentSettings;
  fc.info = info;
  fc.history = history;
  fc.actions = actions;
  fc.pages = pages;
  fc.designChrome = designChrome;
  fc.frameCfg = frameCfg;
  fc.dirtyObserver = null;
  const cv: CanvasCfg = input.canvas || {}; fc.cv = cv;
  const blockId = input.id; fc.blockId = blockId;
  const cfg = {
    idField: cv.idField || 'id',
    xField: cv.xField || 'x',
    yField: cv.yField || 'y',
    wField: cv.wField || 'w',
    hField: cv.hField || 'h',
    rotationField: cv.rotationField || 'rot',
    fillField: cv.fillField,
    gradField: cv.gradField,
    opacityField: cv.opacityField,
    shapeField: cv.shapeField,
    radiusField: cv.radiusField,
    imageField: cv.imageField,
    fitField: cv.fitField,
    imgPosField: cv.imgPosField,
    blendField: cv.blendField,
    textField: cv.textField,
    textColorField: cv.textColorField,
    fontSizeField: cv.fontSizeField,
    alignField: cv.alignField,
    valignField: cv.valignField,
    weightField: cv.weightField,
    fontField: cv.fontField,
    lineHeightField: cv.lineHeightField,
    trackingField: cv.trackingField,
    ligaturesField: cv.ligaturesField,
    alternatesField: cv.alternatesField,
    padField: cv.padField,
    fitTextField: cv.fitTextField,
    groupField: cv.groupField,
    clipField: cv.clipField,
    shadowField: cv.shadowField,
    shadowColorField: cv.shadowColorField,
    shadowXField: cv.shadowXField,
    shadowYField: cv.shadowYField,
    shadowBlurField: cv.shadowBlurField,
    kindField: 'kind',
    // `pathField` is left un-defaulted on purpose: it is the feature flag, so a manifest
    // that omits it must resolve to undefined. The other three DO default, to the same
    // names as vector-ops' DEFAULT_VECTOR_FIELDS - the shipped Design manifests
    // append the `stroke`/`strokeW`/`fillRule` sub-fields but only declare `pathField` on
    // the canvas block, and the overlay has to read the same field the ops write.
    pathField: cv.pathField,
    strokeField: cv.strokeField || 'stroke',
    strokeWField: cv.strokeWField || 'strokeW',
    fillRuleField: cv.fillRuleField || 'fillRule',
    strokeDashField: cv.strokeDashField || 'strokeDash',
    strokeCapField: cv.strokeCapField || 'strokeCap',
    strokeJoinField: cv.strokeJoinField || 'strokeJoin',
    // Plan 96 P0. Same defaulting rule as the three above and for the same reason: the
    // shipped manifests declare these on the canvas block AND as `boxes` sub-fields, and
    // a tool that predates them simply has no box carrying the field, so every read below
    // resolves to '' / false and every write lands on a row nothing reads.
    strokeDashArrayField: cv.strokeDashArrayField || 'strokeDashArray',
    dashFitField: cv.dashFitField || 'dashFit',
    headStartField: cv.headStartField || 'headStart',
    headEndField: cv.headEndField || 'headEnd',
    bindStartField: cv.bindStartField || 'bindStart',
    bindEndField: cv.bindEndField || 'bindEnd',
    routeField: cv.routeField || 'route',
  } as FieldCfg; fc.cfg = cfg;
  // The vector operations' own field view. `cfg` is a superset of `VectorFieldConfig`
  // and vector-ops resolves each name defensively (a non-string falls back to the
  // Design default), so the resolved config is handed over unchanged.
  // Null until the manifest declares `canvas.pathField` - see CanvasCfg.pathField.
  const vectorCfg: VectorFieldConfig | null = cv.pathField ? cfg : null; fc.vectorCfg = vectorCfg;
  // Plan 96's path decorations are DECLARED, not defaulted-into-existence: the field names
  // above default (so the reads are simple), but a tool that never named them in its canvas
  // block has a hooks.js that cannot draw an arrowhead or an authored dash pattern, and
  // authoring one into its boxes would store a decoration the render silently ignores -
  // worse, one the compact URL drops on the way out because the field is undeclared. Every
  // `pathField` tool shipping today declares the head set - both Design packs, and
  // Sequence Studio since its 1.3.0 (fields headStart/headEnd, canvas headStartField/
  // headEndField) - so the check is a live gate for a tool that has not opted in yet, not a
  // description of one that exists.
  const hasHeadCfg = !!(cv.headStartField || cv.headEndField); fc.hasHeadCfg = hasHeadCfg;
  const hasBindCfg = !!(cv.bindStartField || cv.bindEndField); fc.hasBindCfg = hasBindCfg;
  const hasRouteCfg = !!cv.routeField; fc.hasRouteCfg = hasRouteCfg;
  // ── Flip (mirror) ─────────────────────────────────────────────────────────────
  // Flip is opt-in per tool, and gated on the box sub-fields being DECLARED rather than on a
  // `canvas.*Field` key. The canvas block in schemas/tool.schema.json is a CLOSED SET whose
  // every new key is a breaking change for older shells (the engine validates a manifest
  // against that same schema at load), so the flag is the presence of the fixed-named `flipH`
  // + `flipV` sub-fields instead - the same "is the field declared" test `hasIdField` uses.
  // The names match what the tool's hooks.js reads when it folds the mirror into the box
  // transform, so overlay and render agree by convention. A tool that declares neither is
  // offered no flip and is byte-identical - like `pathField` gates the vector section.
  const FLIP_H_FIELD = 'flipH'; fc.FLIP_H_FIELD = FLIP_H_FIELD;
  const FLIP_V_FIELD = 'flipV'; fc.FLIP_V_FIELD = FLIP_V_FIELD;
  const canFlip =
    (input.fields || []).some((f) => f.id === FLIP_H_FIELD) &&
    (input.fields || []).some((f) => f.id === FLIP_V_FIELD); fc.canFlip = canFlip;
  /** The committed bound-path layer's class, hidden while a drag re-routes it live. */
  const boundLayerClass = cv.pathLayerClass || 'lolly-connectors'; fc.boundLayerClass = boundLayerClass;
  const hasDashArrayCfg = !!cv.strokeDashArrayField; fc.hasDashArrayCfg = hasDashArrayCfg;
  const minSize = cv.minSize ?? 8; fc.minSize = minSize;
  // ── Manifest-driven typography ────────────────────────────────────────────────
  // The Text panel + format-bar font menus are built from the tool's OWN declared
  // font select (the blocks field named by canvas.fontField), so the editor writes
  // exactly the wire values the tool's hooks.js understands under any profile
  // (SUSE: 'SUSE'/'SUSE Mono'; lolly-start: 'sans'/'mono'). Tools without a font
  // field declaration fall back to the historical hard-coded pair.
  const fontFieldDef = cfg.fontField
    ? (input.fields || []).find((f) => f.id === cfg.fontField)
    : undefined; fc.fontFieldDef = fontFieldDef;
  const fontOptions: FontOption[] = (
    fontFieldDef?.options?.length ? fontFieldDef.options : FALLBACK_FONT_OPTIONS
  ).map((o) => ({ value: String(o.value ?? ''), label: String(o.label || o.value || '') })); fc.fontOptions = fontOptions;
  const defaultFont = String(fontFieldDef?.default || fontOptions[0]!.value); fc.defaultFont = defaultFont;
  // ── Manifest-driven shape control ─────────────────────────────────────────────
  // The "More" panel's shape segment is built from the tool's OWN declared shape
  // options - NOT a fixed list - so a tool only ever offers shapes its hooks.js can
  // render (e.g. `circle` is Design only; Carousel/Org-chart/Record don't
  // declare it, so it never shows there and can't produce a broken square). A known
  // value gets its glyph; anything else falls back to its label text.
  const shapeChoices: Array<[string, string, string?]> = shapeChoicesFrom(
    input.fields,
    cfg.shapeField
  ); fc.shapeChoices = shapeChoices;
  // ── Manifest-driven SHADOW control, for the same reason ──────────────────────
  // The shadow segments were a fixed four (`none`/`box`/`text`/`content`) while the
  // manifests had moved on: Design and Sequence Studio both declare a fifth,
  // `depth` - the very target `liftRows` pre-sets on every lifted layer (plans/104
  // section 7) and a real branch of SHADOW_TARGETS in all three hooks copies. A segmented
  // control marks `is-on` by exact match, so a lifted layer opened its Shadow row
  // with ALL FOUR segments off (the control reads as broken) and clicking any of
  // them silently replaced the depth shadow with no way back from that panel.
  // Reading the tool's own options fixes it everywhere at once and keeps the three
  // manifests that DON'T declare `depth` (carousel-maker, org-chart, record) from
  // offering a target their hooks cannot render.
  const shadowChoices: Array<[string, string]> = shadowChoicesFrom(input.fields, cfg.shadowField); fc.shadowChoices = shadowChoices;
  const addKinds: AddKind[] =
    Array.isArray(cv.addKinds) && cv.addKinds.length
      ? cv.addKinds
      : [{ id: 'box', label: 'Box', seed: {} }]; fc.addKinds = addKinds;
  // Opt-in design-file import (Figma SVG / Penpot). Falsy for Design, whose
  // canvas config has no `import` key - so its toolbar is unchanged.
  const importCfg = cv.import || null; fc.importCfg = importCfg;
  // Brand vocabulary for the importer (engine DesignMapOptions): imported text maps
  // onto the tool's OWN font select values (SUSE: 'SUSE'/'SUSE Mono'; lolly-start:
  // 'sans'/'mono'), and box seed colours come from its addKinds seeds - so an import
  // is indistinguishable from natively-authored boxes under any profile. Fields the
  // manifest doesn't declare stay undefined → the engine's neutral defaults apply.
  const importMap = (() => {
    const monoOpt = fontOptions.find((o) => fc.helpers.isMonoFont(o.value));
    // '' is a real seed value (transparent fill - e.g. record's image seed), so only
    // a missing/non-string seed defers to the engine default.
    const seedColor = (kindId: string, field: string): string | undefined => {
      const seed = addKinds.find((k) => k.id === kindId)?.seed;
      const v = seed ? seed[field] : undefined;
      return typeof v === 'string' ? v : undefined;
    };
    return {
      fonts: {
        defaultFamily: defaultFont,
        ...(monoOpt
          ? { monoFamily: monoOpt.value, monoMaxWeight: fc.helpers.maxWeightFor(monoOpt.value) }
          : {}),
        // Every family the shell can actually resolve - the manifest's own wire
        // values plus installed user fonts - passes through mapFontFamily
        // verbatim instead of bucketing to the two-family vocabulary.
        knownFamilies: [...new Set([...fontOptions.map((o) => o.value), ...brandFontFamilies()])],
      },
      seedColors: {
        boxBg: seedColor('box', cfg.fillField || 'bg'),
        textFg: seedColor('text', cfg.textColorField || 'fg') || undefined, // text ink must be a colour
        imageBg: seedColor('image', cfg.fillField || 'bg'),
      },
    };
  })(); fc.importMap = importMap;
  // Opt-in connector authoring (Org Chart). The connect config names a SECOND blocks
  // input that stores {from,to} edges; the overlay authors them and draws a live
  // preview, but the tool's hooks.js owns the actual routed line geometry. Falsy for
  // every other editor tool, so their toolbars/gestures are unchanged.
  const connectCfg: ConnectCfg | null =
    cv.connect?.input
      ? {
          input: cv.connect.input,
          fromField: cv.connect.fromField || 'from',
          toField: cv.connect.toField || 'to',
          styleField: cv.connect.styleField,
          arrowField: cv.connect.arrowField,
          headField: cv.connect.headField,
          colorField: cv.connect.colorField,
          dashField: cv.connect.dashField,
          widthField: cv.connect.widthField,
          layerClass: cv.connect.layerClass || 'oc-connectors',
          defaultStyle: cv.connect.defaultStyle || 'elbow',
          defaultArrow: cv.connect.defaultArrow || 'end',
          defaultHead: cv.connect.defaultHead || 'triangle',
          defaultColor: cv.connect.defaultColor || '#94a3b8',
          defaultWidth: cv.connect.defaultWidth ?? 2.5,
        }
      : null; fc.connectCfg = connectCfg;
  // Opt-in TIME model (phase 1). A tool is "time-capable" only when its canvas config
  // maps ALL TEN time sub-fields - a partial mapping would give the panel somewhere to
  // read from but nowhere to write, so it is treated as absent.
  //
  // Two tools qualify today: Sequence Studio and Design (both declare the phase-1
  // time model in their canvas block). Carousel Maker, Org Chart, Record and every other
  // editor map none of them, so `timeCfg` is null there and every timeline branch below
  // is dead code for them - no rail button, no lazy chunk, no stage reserve, no listener.
  // On an UNTIMED Design composition the cost is one extra rail button and nothing
  // else: `anyTimed()` is false, so the panel never auto-opens and its chunk is never
  // fetched until the user asks for it.
  //
  // `idField` comes from the resolved cfg: the panel keys clips by the box id FIELD,
  // exactly as the overlay's selection does.
  const timeCfg: TimeCfg | null =
    cv.startField &&
    cv.durField &&
    cv.clipInField &&
    cv.speedField &&
    cv.enterField &&
    cv.exitField &&
    cv.enterMsField &&
    cv.exitMsField &&
    cv.muteField &&
    cv.laneField
      ? {
          startField: cv.startField,
          durField: cv.durField,
          clipInField: cv.clipInField,
          speedField: cv.speedField,
          enterField: cv.enterField,
          exitField: cv.exitField,
          enterMsField: cv.enterMsField,
          exitMsField: cv.exitMsField,
          muteField: cv.muteField,
          laneField: cv.laneField,
          idField: cfg.idField,
          // OPTIONAL, and deliberately outside the ten-field presence check above: a tool
          // that declares no link sub-field is still fully time-capable, it just never
          // offers "Detach audio" (progressive capability). Both shipping time-capable
          // tools declare it today - Sequence Studio, and Design since its 1.12.0
          // (`linkOf`) - so this is a live gate for the next tool to opt in, not a
          // description of one that exists.
          linkField: cv.linkField || '',
          // Same optional terms: the clip-volume sub-field (plans/165 WP-1).
          gainField: cv.gainField || '',
          panField: cv.panField || '',
          duckField: cv.duckField || '',
          pitchField: cv.pitchField || '',
          varispeedField: cv.varispeedField || '',
          fxField: cv.fxField || '',
          // And the reversible-cut / strikethrough flag (plans/174, transcript-driven
          // editing). A tool that declares no `ignored` sub-field never offers the
          // Transcript panel's strike gesture - the same progressive gate as the rest.
          ignoredField: cv.ignoredField || '',
          labelField: cv.labelField || '',
          // Also optional, for the same reason: the authored easing curves are additive on
          // top of a time model that was complete without them, so a manifest that declares
          // no ease sub-fields keeps every preset on its built-in curve.
          enterEaseField: cv.enterEaseField || '',
          exitEaseField: cv.exitEaseField || '',
          // Same again: split-text animation (plans/175 WP-A) - a manifest without the
          // three sub-fields simply never grows the "Animate text by" rows.
          splitField: cv.splitField || '',
          staggerField: cv.staggerField || '',
          splitOrderField: cv.splitOrderField || '',
          holdField: cv.holdField || '',
          holdRateField: cv.holdRateField || '',
          textField: cv.textField || '',
          // Same again: a shared group collapses overlays onto one panel lane row
          // (generated captions), and a tool without a group field never groups.
          groupField: cv.groupField || '',
          // And again: the keyframe track. It is the ONE field a split/trim-in/join
          // rebases instead of copying (plans/104 section 5.6) - a tool that declares none is
          // simply not keyframable, and every rebase branch in timeline-math is inert.
          kfField: cv.kfField || '',
          // And the depth field, for the one thing the time math needs it for: a `z`
          // keyframe REPLACES it for its segment (section 5.2), so writing an honest full pose
          // means knowing what the unkeyed value is.
          zField: cv.zField || '',
          // And the two tilt fields on the same terms, for the same one thing (P2.1): an
          // `rx`/`ry` keyframe REPLACES the field for its segment, so a full pose written
          // without knowing the unkeyed angle would flatten a board the user had posed.
          rxField: cv.rxField || '',
          ryField: cv.ryField || '',
        }
      : null; fc.timeCfg = timeCfg;
  // Can this tool import a design AS timed scenes (frames → timeline clips) at all?
  // Time-capable + import-capable. Design qualifies (it declares the time model), so it
  // OFFERS the "as scenes vs replace the board" choice (plans/104 section 337) - on the drop
  // door (the stash's `scenes` flag) and in the import panel (the toggle below).
  const importSceneCapable: boolean = !!(timeCfg && importCfg); fc.importSceneCapable = importSceneCapable;
  // Whether SCENES is the DEFAULT: only a manifest that still declares `import.mode:
  // 'scenes'`. Design does NOT (that opt-in flipped every import, plans/104 section 337), so
  // Design defaults to replacing the board and asks per-import.
  const importScenesMode: boolean =
    importSceneCapable && (importCfg as { mode?: unknown }).mode === 'scenes'; fc.importScenesMode = importScenesMode;
  // Can this tool lay a document's pages out as ARTBOARDS - one frame per page, slide
  // or board, each page's parts editable inside it? Import-capable + the frame
  // primitive. Design qualifies; like scenes, it is offered per import, never assumed.
  const importArtboardCapable: boolean = !!(importCfg && frameCfg); fc.importArtboardCapable = importArtboardCapable;

  // Opt-in snap-to-grid. gridOn is toggled from the rail; gridSize is native px.
  const gridSize = Math.max(2, Math.round(cv.grid?.size ?? 20)); fc.gridSize = gridSize;
  fc.gridOn = !!(cv.grid && cv.grid.default !== false);

  // ── state ──────────────────────────────────────────────────────────────────
  fc.selection = new Set<string>(); // box ids
  // Selection change-notifier for the timeline panel. `selection` is assigned from ~20
  // sites, but EVERY one of them reaches paintChrome (directly via renderChrome /
  // renderChromeLive, or via commit → runtime.subscribe → scheduleSync), so the fire
  // lives in exactly one place (top of paintChrome) and is guarded by a signature -
  // a repaint with an unchanged selection is not a change. No write site is touched.
  // Listeners take the new ids (design-ports' SelectionPort). The timeline's own port
  // declares `(cb: () => void)`, which a handler ignoring the argument satisfies, so both
  // consumers read the SAME notifier.
  const selListeners = new Set<(ids: string[]) => void>(); fc.selListeners = selListeners;
  fc.selNotifyKey = null;
  /**
   * THE selection port (plans/179 M2 (a)). One object, handed to the timeline panel AND
   * returned on `handle.design`, so a column and the timeline can never end up reading
   * two different adapters over the same Set.
   */
  const selectionPort: SelectionPort = {
    get: () => [...fc.selection],
    set: (ids: string[]) => {
      fc.selection = new Set(ids);
      fc.chromeSync.renderChrome();
    },
    onChange: (cb: (ids: string[]) => void) => {
      selListeners.add(cb);
      return () => {
        selListeners.delete(cb);
      };
    },
  }; fc.selectionPort = selectionPort;
  fc.multiTapMode = false; // touch: taps ADD to the selection (Group/Align need ≥2)
  /**
   * THE tool mode - see `setMode`. Every mode used to be its own boolean, which is exactly
   * why they could all be true at once.
   */
  fc.mode = 'select';
  // The Node tool (Inkscape's `N`): a sub-mode of 'select' where a single click on a path
  // box jumps straight into node editing rather than selecting it. A flag, not a 5th
  // EditorMode, because `setMode` ends any `penEdit` session - the very thing this tool
  // wants to keep - so a real mode would fight that invariant. Mutually exclusive with the
  // other tools: picking pen/create/connect (or the plain pointer) clears it.
  fc.nodeToolActive = false;
  fc.armedKind = null; // the create gesture's seed; set iff mode === 'create'
  fc.gesture = null; // active pointer gesture
  // The pointerType of the last press ON THE CANVAS. A touch laptop reports `pointer:
  // coarse` for the whole document while the user is on the trackpad (see
  // timeline-panel.ts's EDGE_PX_COARSE), so anything that MOVES the canvas asks the event
  // rather than the media query - a trackpad user must never have the stage zoom under them.
  fc.lastPointerKind = '';
  fc.editing = null; // { id, el, prev } while editing a box's text inline
  fc.disposed = false;
  fc.bindHover = null; // the box an end node would attach to on drop
  fc.liveConnectHidden = false; // the tool's real bound-path layer is hidden mid-drag
  fc.selectedEdges = new Set<string>(); // connector ids being inspected (click / shift-click / marquee)
  fc.edgePanel = null; // the connector-properties popover
  fc.hoverEdge = null; // connector id under the cursor (hover affordance)
  fc.hoverRaf = 0;
  fc.lastMenuAt = { x: 0, y: 0 }; // where the context menu was last opened (client px)

  // ── pen tool state (Stage D) ────────────────────────────────────────────────
  // Two things, never both: `mode === 'pen'` DRAWS a new path; `penEdit` edits a committed
  // one. Point editing is NOT a fifth mode - it is a sub-state of the pointer, entered by
  // double-clicking a path exactly as a text edit is (see `setMode`).
  //
  // The draft lives here in NATIVE canvas px and NOT in the model, which is the whole
  // answer to "what happens if the user pans/zooms or the model syncs mid-draw": a pan or
  // zoom only changes the native→screen mapping, so the draft is unaffected and its
  // preview is simply repainted from the same numbers; and a model sync (another actor, an
  // undo) cannot disturb a draft that is not in the model. The single commit reads
  // `getBoxes()` at commit time, so it appends to whatever the array is by then rather
  // than to a stale snapshot.
  fc.penDraft = null; // nodes in NATIVE px; null = not drawing
  fc.penCursor = null; // live end of the segment under the cursor
  // ALL of a field's contours are edited at once (a boolean with a hole, or outlined text
  // that is one path box of many glyph contours). They share ONE box-local coordinate space
  // (one frame), so `path` is a COMBINED AuthoredPath whose `nodes` are every contour's nodes
  // concatenated in order - every position op (move / drag a handle / align / distribute /
  // continuity / hit-test / marquee) runs on it unchanged, and `penSel` indexes into it flat.
  // `parts` records how to split that flat run back into real per-contour paths (each keeps
  // its own kind + closed): the write re-encodes every contour, the frame fits every contour,
  // and render / insert / delete are the only part-AWARE ops. `path.kind` is the first part's
  // kind (uniform across the contours every producer here makes - all cubic - so it governs
  // handle display + default continuity correctly). A single-contour box has one part and is
  // byte-identical to the old single-`path` model. All DENORMALISED to box-local px.
  fc.penEdit = null;
  fc.penSel = new Set<number>(); // selected node indices while editing
  // Selected CONTROL POINTS (handles) while editing - keys `${nodeIndex}:in` / `:out`.
  // Built by shift-clicking a handle; align/distribute operate on nodes ∪ these. Kept
  // separate from penSel so a handle is a point in its own right, not tied to its node.
  fc.penHandleSel = new Set<string>();
  // Node-edit selection mode: false = a marquee picks NODES only (default); true = it also
  // picks CONTROL POINTS. A session-scoped preference toggled from the node-edit bar.
  fc.penSelectHandles = false;
  // The previous frame's hyperbezier solution, reused as the `warm` start. A 40-node solve
  // re-converged from the chord-bend guess costs an O(n) Newton run per pointermove; warm,
  // it costs one or two steps. This is exactly what `toCubics`' `warm` parameter is for.
  fc.penWarm = null;
  const PEN_HIT_PX = 9; fc.PEN_HIT_PX = PEN_HIT_PX; // grab radius for a node/handle, SCREEN px
  const PEN_CURVE_PX = 7; fc.PEN_CURVE_PX = PEN_CURVE_PX; // "on the curve" band for insert, SCREEN px
  const PEN_PULL_MIN = 3; fc.PEN_PULL_MIN = PEN_PULL_MIN; // drag past this and a click became a handle PULL, SCREEN px
  // Alt during a `pendraw` drag BREAKS the handle pair, and latches for the rest of that
  // drag rather than being read fresh each move: a break is a declaration about the node,
  // not a per-frame state, and reading it live makes the corner flicker back to smooth on
  // any move event that happens to arrive without the modifier.
  fc.penPullBroken = false;
  // The paint the user last put on a path, so the NEXT path they draw matches it - the
  // drawing-app convention, and the reason a session of pen work doesn't mean recolouring
  // every shape. Session-only (never persisted, never in the model): it is a memory of an
  // action, not a property of the document. Set from a paint write to a path selection and
  // from each commit, so consecutive draws agree even before anything is recoloured.
  fc.penLastPaint = null;
  /** The canvas config's paint sub-field names, as the pure pen helpers want them. */
  const penPaintFields: PathPaintFields = {
    fill: cfg.fillField,
    stroke: cfg.strokeField,
    strokeW: cfg.strokeWField,
    fillRule: cfg.fillRuleField,
  }; fc.penPaintFields = penPaintFields;
  const bgInputId = 'background'; fc.bgInputId = bgInputId;
  /** `canvas.labelField` - a row's own NAME. The timeline uses it for a renamed clip;
   *  plans/179 A10 uses it for an artboard's tab. Optional: no field, no rename. */
  const nameField: string = cv.labelField || ''; fc.nameField = nameField;
  /** The frame field that holds a slide's SPEAKER NOTES. Not a canvas-config key: the
   *  manifest declares `boxes[].notes` and every reader here (the notes panel, the deck
   *  model, the artboards import) names the same literal, so it is named once. */
  const FRAME_NOTES_FIELD = 'notes'; fc.FRAME_NOTES_FIELD = FRAME_NOTES_FIELD;
  /** The DOCUMENT-level slide transition (plans/179 M4). Not a canvas-config key for the
   *  same reason FRAME_NOTES_FIELD is not: the manifest declares a top-level `transition`
   *  input and every reader here names that same literal, so it is named once. Read live
   *  rather than captured - the sidebar can change it between mount and "Place in order". */
  const DOC_TRANSITION_INPUT = 'transition'; fc.DOC_TRANSITION_INPUT = DOC_TRANSITION_INPUT;
  // The rail's paint swatch and the key of what it currently shows. Declared HERE, not
  // beside paintBgField below, because buildToolbar runs during mount and a `let` in the
  // later block would still be in its temporal dead zone.
  fc.bgSlot = null;
  fc.bgFieldKey = '';
  /** Which control the mark menu is hanging off (see `anchorEl` in buildToolbar) - out
   *  here for the same dead-zone reason, and so `openLollyMenu` can claim it. */
  fc.lollyAnchor = null;
  /** The mark menu's row builder, published out of `buildToolbar` so `openLollyMenu`
   *  (design-ports) can spawn the SAME menu from the top bar's own mark. */
  fc.lollyMenuItems = null;
  fc.shortcutsModal = null;

  // A row's identity is its OWN id, never its array position (plan 100 section 3): an index key
  // silently re-points at a different box the moment anything inserts above it - a peer's
  // concurrent add, an undo, a paste - and a late field op would then land on the wrong
  // box. Every shipped canvas manifest declares its id sub-field, and rows that lack a
  // value get one on load (see the normalisation at mount) plus on every commit, so the
  // '' below is only reachable for a row minted after mount by something that bypassed
  // both - where selecting nothing is the honest outcome, not "select whatever sits at
  // that index". `hasIdField` keeps the promise honest the other way: a manifest that
  // declares no id at all (none ship today) keeps the historical index fallback rather
  // than collapsing every row onto one key.
  const hasIdField = !!cv.idField || (input.fields || []).some((f) => f.id === cfg.idField); fc.hasIdField = hasIdField;

  // ── timeline panel (opt-in: canvas time-model fields → `timeCfg`) ─────────────
  // Every branch below is dead on a tool without `timeCfg`: no rail button, no lazy
  // chunk fetch, no stage reserve, no listener.
  fc.timelinePanel = null;
  fc.timelineLoading = false;
  /** The in-flight chunk load, so a second `ensureTimeline(true)` waits for the first. */
  fc.timelineLoad = null;
  fc.timelineWantOpen = false;
  fc.timelineBtn = null;
  /** Whether the stage currently holds a band for the panel - the open/close EDGE, so
   *  a resize drag (which writes a new reserve every frame) costs nothing extra. */
  fc.timelineReserved = false;

  // The playhead's visibility, as the clock APPLIED it to the live DOM (sequence-dom's
  // OFF_CLASS). A box the sequence currently hides must not swallow a canvas click -
  // the user edits what they can see - so every pointer hit-test skips it and the
  // click falls through to the visible box below. DOM truth, not re-derived timing:
  // selection can never disagree with playback. No timeline mounted (or a box not yet
  // painted) → nothing carries the class → behaviour is unchanged.
  // 'seq-off' is bridge/sequence-dom.ts's OFF_CLASS. A LITERAL, not an import:
  // sequence-dom statically pulls sequence-plan + transitions, and free-canvas keeps
  // the whole sequence graph lazy (see ensureTimeline). free-canvas-seq-hit.test.ts
  // pins this literal against the real export so the two can't drift.
  const SEQ_OFF_CLASS = 'seq-off'; fc.SEQ_OFF_CLASS = SEQ_OFF_CLASS;

  /**
   * The applier's own pose reader (`sequencePoseOf`), captured when the timeline chunk
   * lands - null until then, and forever on an untimed tool.
   *
   * Fetched rather than imported for the SEQ_OFF_CLASS reason above: a static import of
   * bridge/sequence-dom.ts would pull sequence-plan + transitions + the engine's
   * keyframe module into the chunk of every editor that never opens a timeline. It
   * rides `ensureTimeline`'s own import, so it costs no second request - the panel
   * statically pulls the same module through views/sequence-clock.ts - and it can only
   * answer non-null once a clock exists to have posed anything.
   */
  fc.seqPoseOf = null;
  /**
   * ⚑ plans/104 section 9.15, the other half: the chrome now reads its position off the pose
   * the applier wrote, so every write of one has to be followed by a re-place or the
   * outline freezes at whatever pose the last repaint happened to catch.
   *
   * `tl-time` cannot carry that - the panel gates that event on the ACTIVE SET, so a
   * scrub inside a single clip emits nothing at all - and the applier is three modules
   * away, so the signal is taken off the DOM it has just written. Armed with the
   * timeline chunk, because until a clock exists nothing can pose anything.
   *
   * Self-gating on three counts, which is what keeps a per-frame DOM signal affordable:
   * a stage nothing poses issues no inline-style writes and this never fires; with
   * nothing SELECTED there is no chrome to move, so the whole sync is skipped (a
   * timeline played with an empty selection costs exactly what it did before); and
   * `scheduleSync` coalesces the rest to one rAF and declines outright while a gesture
   * is live, so a playing timeline costs one chrome re-place per FRAME, not one per box.
   *
   * No feedback loop by construction - every node paintChrome writes to lives in
   * `overlay`/`stageEl`, outside `canvasEl`, and the one thing it does write on a
   * `.lolly-box` (syncBoxA11y's aria attributes) is not `style`.
   */
  fc.poseMo = null;

  /**
   * The panel asks THIS module for new boxes rather than reaching into it: its plus menu
   * (and its empty-sequence "Add a clip" slot) dispatches `tl-add` with
   * `{ kind, atMs }`, which bubbles from the panel root to the stage. Arming create-mode
   * is exactly what the rail's add menu does, so the next canvas click drops the box -
   * with the one difference the panel depends on: a box added FROM the timeline lands
   * TIMED at the playhead, where the rail's plus leaves it as scenery. `pendingAddAtMs`
   * carries that single bit through to the create commit and is cleared alongside the
   * armed kind, so an abandoned arm can never time the next hand-drawn box.
   *
   * The detail is untrusted - a CustomEvent can be dispatched by anything on the page -
   * so an unknown kind or a non-finite / negative / absurd `atMs` drops the whole event
   * rather than guessing: nothing reaches the model on a bad one.
   */
  const MAX_ADD_AT_MS = 24 * 60 * 60 * 1000; fc.MAX_ADD_AT_MS = MAX_ADD_AT_MS; // a day of sequence; beyond that it is junk
  fc.pendingAddAtMs = null;
  if (timeCfg) stageEl.addEventListener('tl-add', fc.timeline.onTlAdd);

  /**
   * The other half of the cross-module seam (same CustomEvent pattern as `tl-add` /
   * `tl-take`, deliberately - not a new coupling): the panel tells the canvas when the
   * ACTIVE SET changed, never once per tick. Two things ride on it:
   *   • the chrome repaint that makes the one rule track the playhead at all, and
   *   • `tlPlaying`, which suppresses the off-playhead banner during playback - scenes
   *     coming and going is the whole point of pressing play, and a chip that blinks on
   *     every cut is noise, not information.
   *   • the ONION SKIN, which is opt-in and OFF by default: the panel puts `mode` /
   *     `past` / `future` / `opacity` on the same detail, and an absent (or unknown)
   *     mode means the lazy chunk is never fetched at all.
   * Untrusted detail (anything on the page can dispatch it): only the `playing` flag is
   * read as a strict boolean, and the onion fields are re-validated in onionFrom.
   */
  fc.tlPlaying = false;
  if (timeCfg) stageEl.addEventListener('tl-time', fc.timeline.onTlTime);
  fc.onionSkin = null;
  fc.onionLoading = false;
  fc.onionState = null;

  // ── motion path: where a keyframed box travels, never in an export ───────────
  // plans/104 section 8's overlay bullet, on onion skin's exact terms - a `.fc-overlay` child
  // carrying [data-export-hide] that never writes to a `.lolly-box` (motion-path.ts's
  // module doc restates the three guarantees, and its own test file pins them).
  //
  // Shown for SELECTED animated boxes only, and only while the timeline is OPEN. That
  // second condition is M2's binding reading of section 8 applied again: a closed panel
  // disarms the latch because "the arm must be visible", and a path drawn with no
  // playhead, no diamonds and no transport in sight is a picture of a move the user
  // cannot currently reach. Opening the panel brings it back.
  fc.motionPath = null;
  fc.motionLoading = false;

  // ── coordinate mapping (transform-agnostic via the live canvas rect) ────────
  // The canvas/stage screen rects are INVARIANT for the duration of a box gesture
  // (dragging/resizing/rotating a box never pans or zooms the artboard - pan/zoom is
  // a separate stageNav interaction that fires the transform MutationObserver). So
  // cache them once per gesture instead of forcing a layout flush on every metrics()
  // call (~6 getBoundingClientRect + ~3 forced reflows per drag frame otherwise). The
  // cache is cleared on gesture end and on ANY geometry change (onStageMove clears it),
  // so a pan/zoom/resize/auto-scroll can never leave it stale.
  fc.gestureMetrics = null;

  // Multi-page mode: box coordinates are GLOBAL across the strip, but each box's DOM
  // element lives INSIDE its page frame ([data-pdf-page]) and is positioned relative
  // to that frame. So converting a global rect to/from the element's own left/top
  // means subtracting/adding the frame's offset within the canvas. Reading offsetLeft/
  // offsetTop off the live frame keeps this immune to the frame-gap constant (the frame
  // sits wherever the template laid it out). Returns {0,0} when the element isn't inside
  // a page frame - so a single-page editor (Design) is completely unaffected.
  // A [data-pdf-page] frame's offsetLeft/offsetTop does NOT change while a BOX is dragged -
  // only the box moves. But reading them forces a synchronous layout, and applyLiveRect +
  // the live chrome re-sync call this per box PER pointermove, so a drag with frames present
  // thrashed layout (the reported lag, even for an empty-frame drag whose chrome re-syncs).
  // A gesture-scoped cache keyed by the frame element reads each frame's offset at most ONCE
  // per gesture; every later read in the same drag returns the cached value with no reflow.
  // beginGesture arms it, endGesture clears it.
  fc.frameOffCache = null;

  // ── DOM: overlay + toolbar ──────────────────────────────────────────────────
  const overlay = document.createElement('div'); fc.overlay = overlay;
  overlay.className = 'fc-overlay';
  overlay.setAttribute('data-export-hide', '');
  stageEl.appendChild(overlay);

  // Frame dimmer - a hole-punch scrim sized to the export frame (repositioned only
  // when the artboard's screen geometry changes - see scrimDirty). Its big outset
  // box-shadow faintly tints everything OUTSIDE the frame, so boxes dragged off the
  // artboard read as gently faded while staying fully visible + selectable. First
  // overlay child so the selection chrome, guides and ctxbar all paint above it.
  const frameScrim = document.createElement('div'); fc.frameScrim = frameScrim;
  frameScrim.className = 'fc-frame-scrim';
  overlay.appendChild(frameScrim);
  // M2 - the scrim only moves on pan/zoom/resize, NEVER on a box drag/hover/selection
  // change. onStageMove (the geometry-change path) sets this; paintChrome repositions
  // the 100vmax soft-shadow region only when it's set, dropping a metrics() + a big
  // shadow repaint from every drag/selection sync. Starts true so mount positions it.
  fc.scrimDirty = true;

  const rubber = document.createElement('div'); fc.rubber = rubber;
  rubber.className = 'fc-rubber';
  rubber.hidden = true;
  overlay.appendChild(rubber);

  const guidesEl = document.createElement('div'); fc.guidesEl = guidesEl; // snap/alignment guide lines
  guidesEl.className = 'fc-guides';
  overlay.appendChild(guidesEl);

  // Design-only authored guides. Their compact top-level input means they follow the
  // document through URL mode, .lolly files, undo and collaboration, while the visibility
  // toggle remains a per-device editor preference. Other free-canvas tools declare no
  // `guides` input and pay no DOM or event-listener cost.
  const guideInput = designChrome
    ? runtime.getModel().find((model) => model.id === 'guides')
    : undefined; fc.guideInput = guideInput;
  const GUIDE_VISIBILITY_KEY = 'lolly-design-guides-visible'; fc.GUIDE_VISIBILITY_KEY = GUIDE_VISIBILITY_KEY;
  fc.authoringGuides = guideInput
    ? mountDesignGuides({
        stageEl,
        canvasEl,
        read: () => runtime.getModel().find((model) => model.id === 'guides')?.value,
        commit: (value) => {
          onDirty?.('guides');
          runtime.setInput('guides', value);
        },
        initiallyVisible: fc.stage.readGuideVisibility(),
        onSelect: () => { fc.selection.clear(); fc.chromeSync.renderChrome(); },
        onInspect: () => fc.inspectorPort?.reveal('guide'),
      })
    : null;

  // Frame name labels (Figma-style) - one small tab above each artboard's top-left that
  // NAMES it and selects the FRAME on click. This is the reliable way to "edit the frame
  // itself": a frame is now reachable even when content covers its whole area, so clicking
  // empty frame space is no longer the only door in. Repositioned every sync from the MODEL
  // (like the selection chrome); the container is click-through so only the tabs take a hit.
  // frameCfg-gated → dead for every no-frames document. Cleaned up with the overlay.
  const frameLabels = document.createElement('div'); fc.frameLabels = frameLabels;
  frameLabels.className = 'fc-frame-labels';
  overlay.appendChild(frameLabels);
  frameLabels.addEventListener('pointerdown', (e) => e.stopPropagation());
  frameLabels.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement | null)?.closest<HTMLElement>('.fc-frame-label');
    if (!el) return;
    e.stopPropagation();
    const fid = el.dataset.frameId || '';
    const boxes = fc.select.getBoxes();
    const idx = boxes.findIndex((b, i) => fc.select.idOf(b, i) === fid);
    if (idx < 0) return;
    fc.edges.deselectEdge();
    fc.selection = new Set(fc.select.selectionForHit(boxes, idx, true)); // solo the frame
    fc.chromeSync.renderChrome();
  });
  // Double-click renames it in place (plans/179 A10). The single click above has already
  // fired and soloed the frame, which is the right selection to be renaming.
  frameLabels.addEventListener('dblclick', (e) => {
    const el = (e.target as HTMLElement | null)?.closest<HTMLElement>('.fc-frame-label');
    if (!el) return;
    e.stopPropagation();
    e.preventDefault();
    fc.chromeSync.startFrameRename(el, el.dataset.frameId || '');
  });
  // …and from the keyboard, which a double-click alone left with no way in at all. F2 is
  // the platform rename key (and what the navigator's rows answer); Enter is the one a
  // person tries first, and `preventDefault` is what stops the button synthesising the
  // click that would merely solo the frame. The tab advertises both through
  // `aria-keyshortcuts` - its `title` can only speak to a mouse.
  frameLabels.addEventListener('keydown', (e) => {
    const el = (e.target as HTMLElement | null)?.closest<HTMLElement>('.fc-frame-label');
    if (!el || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key !== 'F2' && e.key !== 'Enter') return;
    e.preventDefault();
    e.stopPropagation();
    fc.chromeSync.startFrameRename(el, el.dataset.frameId || '');
  });

  // Camera-gesture HUD (audit A2/A4). A camera drag commits on release and previews
  // NOTHING on the stage (section 8's "drags commit on release"), so a shift-drag tilt or an
  // empty-stage pan gives no feedback at all until the drop - the single biggest reason
  // the camera "shortcuts are very noticable". This readout is that feedback: the
  // ABSOLUTE tilt the drop will land (via `timelinePanel.cameraTiltPreview`, so it can
  // never disagree with the write's own clamp) or the pan offset. Hidden except during a
  // camera gesture; decorative to assistive tech (the committed pose is the panel's job
  // to announce), pointer-transparent so it never eats the drag it is describing.
  const camHud = document.createElement('div'); fc.camHud = camHud;
  camHud.className = 'fc-cam-hud';
  camHud.hidden = true;
  camHud.setAttribute('aria-hidden', 'true');
  overlay.appendChild(camHud);

  // First-run invite on an empty canvas - a blank editor is otherwise a mystery. Only
  // shown for tools that can add boxes; clicking it opens the same Add menu as the rail.
  const emptyHint = document.createElement('div'); fc.emptyHint = emptyHint;
  emptyHint.className = 'fc-empty';
  emptyHint.hidden = true;
  emptyHint.innerHTML = `<button type="button" class="fc-empty-add">+ ${t('Add your first card')}</button>`;
  emptyHint.querySelector('button')!.addEventListener('click', () => {
    (toolbar.querySelector('.fc-btn-add') as HTMLElement | null)?.click();
  });
  overlay.appendChild(emptyHint);

  // Transient VISIBLE status for an action that refused. The overlay had no such
  // surface - `announce()` is screen-reader-only - and a vector operation that declines
  // must not read as a silent no-op: the kernel throwing `GeomLimitError` means the
  // answer exists and the engine will not guess it, which is a sentence the user needs
  // to see. Pointer-transparent and aria-hidden: the a11y path stays `announce()`, the
  // app's established mechanism, so nothing is announced twice.
  const flashEl = document.createElement('div'); fc.flashEl = flashEl;
  flashEl.className = 'fc-flash';
  flashEl.setAttribute('aria-hidden', 'true');
  flashEl.hidden = true;
  overlay.appendChild(flashEl);
  fc.flashTimer = 0;

  // A create arm used to show itself as a crosshair cursor plus a lit rail button, and on
  // touch not even that: choosing Text or Image from the Add menu closed the menu and then
  // looked like nothing at all - the button read as broken and the tap that would have
  // placed the box never came. A pink `+` is not a sentence on ANY pointer (plan 179 A18:
  // "Add menu > Artboard / Image / Box arm a draw mode silently"), so the arm now says what
  // it is waiting for whatever is pointing at it - it only says a different thing, because
  // a mouse drags to size and a finger taps to place. Pointer-transparent apart from its
  // dismiss button, so it can never eat the very gesture it is asking for; absolutely
  // positioned inside the stage overlay, so the stage's own insets keep it clear of the
  // safe area.
  // Built node-by-node with a WORDED dismiss, the same recipe the off-playhead and
  // frames-in-order chips use: a static-text chip is not worth a raw-HTML sink (R10 in
  // primitive-guards ratchets those), and a bare cross glyph is a small target on the one
  // pointer type this chip exists for.
  const armHintEl = document.createElement('div'); fc.armHintEl = armHintEl;
  armHintEl.className = 'fc-armhint';
  armHintEl.hidden = true;
  const armHintTxt = document.createElement('span'); fc.armHintTxt = armHintTxt;
  armHintTxt.className = 'fc-armhint-txt';
  const armHintX = document.createElement('button'); fc.armHintX = armHintX;
  armHintX.type = 'button';
  armHintX.className = 'btn btn--sm fc-armhint-x';
  armHintX.textContent = t('Got it');
  armHintEl.append(armHintTxt, armHintX);
  overlay.appendChild(armHintEl);
  // Dismissed for the REST OF THE MOUNT, not just this arm: someone who has read the
  // sentence once does not need it on every subsequent add.
  fc.armHintOff = false;
  armHintX.addEventListener('click', () => {
    fc.armHintOff = true;
    fc.stage.hideArmHint();
  });

  // The one rule's reconciliation surface. An off-playhead selection is the single
  // STUCK state the rule can produce - the user asked for a box, it is still theirs,
  // and the canvas simply cannot show it - so unlike a click that falls through a
  // hidden scene (silent, by design: it would fire on every click of a stacked
  // composition) this one gets a persistent chip with a way out. It is the only
  // pointer-receiving child of the otherwise pointer-transparent overlay, and it is a
  // stage sibling of #tool-canvas carrying [data-export-hide] on its parent, so no
  // export path can see it.
  // Built node-by-node rather than through innerHTML: two nodes with static text is
  // not worth a raw-HTML sink (primitive-guards R10 ratchets those for a reason), and
  // `btn btn--primary btn--sm` is the shell's ONE primary-fill recipe - restating the
  // fill pair locally is exactly what R2 refuses.
  const offPlayheadEl = document.createElement('div'); fc.offPlayheadEl = offPlayheadEl;
  offPlayheadEl.className = 'fc-offplayhead';
  offPlayheadEl.hidden = true;
  const offPlayheadTxt = document.createElement('span'); fc.offPlayheadTxt = offPlayheadTxt;
  offPlayheadTxt.className = 'fc-offplayhead-txt';
  offPlayheadTxt.textContent = t('Not on screen at the playhead');
  const offPlayheadGo = document.createElement('button'); fc.offPlayheadGo = offPlayheadGo;
  offPlayheadGo.type = 'button';
  offPlayheadGo.className = 'btn btn--primary btn--sm fc-offplayhead-go';
  offPlayheadGo.textContent = t('Go to it');
  // A close (plans/184 section 6, S3): the chip read as a stuck error with no way to
  // put it away. Dismissed for THIS selection only - a new selection off the playhead
  // raises it again, since that is a new fact.
  const offPlayheadX = document.createElement('button'); fc.offPlayheadX = offPlayheadX;
  offPlayheadX.type = 'button';
  offPlayheadX.className = 'btn btn--ghost btn--sm fc-offplayhead-x';
  offPlayheadX.setAttribute('aria-label', t('Dismiss'));
  // Parsed, not assigned as HTML: the raw-HTML sink inventory is pinned (primitive-guards
  // R10), and a glyph from lib/icons.ts is an SVG document in its own right.
  {
    const Parser =
      document.defaultView?.DOMParser ?? (globalThis as { DOMParser?: typeof DOMParser }).DOMParser;
    const glyph = Parser
      ? new Parser().parseFromString(icon('close'), 'image/svg+xml').documentElement
      : null;
    if (glyph && glyph.localName !== 'parsererror')
      offPlayheadX.append(document.importNode(glyph, true));
  }
  offPlayheadEl.append(offPlayheadTxt, offPlayheadGo, offPlayheadX);
  overlay.appendChild(offPlayheadEl);
  fc.offPlayheadAtMs = 0;
  // Guards the announcement so entering the state speaks ONCE, not on every repaint
  // (a pan, a zoom and every tl-time all repaint the chrome).
  fc.lastOffPlayheadKey = '';
  fc.dismissedOffPlayheadKey = '';
  offPlayheadGo.addEventListener('click', () => {
    stageEl.dispatchEvent(
      new CustomEvent('fc-seek', { bubbles: true, detail: { atMs: fc.offPlayheadAtMs } })
    );
  });
  offPlayheadX.addEventListener('click', () => {
    fc.dismissedOffPlayheadKey = fc.lastOffPlayheadKey;
    offPlayheadEl.hidden = true;
  });

  // ── frames-as-scenes: the "play in order" invitation (plan 92) ───────────────
  // A one-shot, non-blocking prompt shown when the timeline OPENS on a frame doc whose
  // frames are NOT yet sequenced: "Play your N frames in order?" [Place in order][Not now].
  // Accepting lays the frames end-to-end in time on the scenes lane (one commit, one undo
  // step) so the clock gates the canvas to one frame at a time; declining dismisses for the
  // session. Gated on frameCfg + timeCfg both present - dead on any tool without frames or
  // without a time model. Built node-by-node (static text, `btn` recipes) like the
  // off-playhead chip; a stage sibling of #tool-canvas carrying [data-export-hide], so no
  // export path sees it.
  fc.seqPromptDismissed = false;
  const seqPromptEl = document.createElement('div'); fc.seqPromptEl = seqPromptEl;
  seqPromptEl.className = 'fc-frameseq';
  seqPromptEl.hidden = true;
  seqPromptEl.setAttribute('role', 'status');
  const seqPromptTxt = document.createElement('span'); fc.seqPromptTxt = seqPromptTxt;
  seqPromptTxt.className = 'fc-frameseq-txt';
  const seqPromptPlace = document.createElement('button'); fc.seqPromptPlace = seqPromptPlace;
  seqPromptPlace.type = 'button';
  seqPromptPlace.className = 'btn btn--primary btn--sm fc-frameseq-go';
  seqPromptPlace.textContent = t('Place in order');
  const seqPromptSkip = document.createElement('button'); fc.seqPromptSkip = seqPromptSkip;
  seqPromptSkip.type = 'button';
  seqPromptSkip.className = 'btn btn--sm';
  seqPromptSkip.textContent = t('Not now');
  seqPromptEl.append(seqPromptTxt, seqPromptPlace, seqPromptSkip);
  overlay.appendChild(seqPromptEl);

  seqPromptPlace.addEventListener('click', () => {
    if (!frameCfg || !timeCfg) {
      fc.narration.hideSeqPrompt();
      return;
    }
    // The transitions come from the DOCUMENT and from each slide's own choice (plans/179
    // M4), not from a blanket 'fade'/'fade' this button used to impose - laying a deck out
    // on the timeline had been quietly overwriting the transition the author picked.
    // Without a transitionField (a tool with no per-frame transition) the flat defaults
    // stand, which is the behaviour every other frame tool keeps.
    const tr = frameCfg.transitionField;
    // commitSequenced, not commit: laying the deck out again moves every frame start, and
    // a narrated deck's clips/captions/builds have to move with them (plans/180 T7).
    fc.narration.commitSequenced(
      sequenceFramesInOrder(fc.select.getBoxes(), {
        defaultDurMs: 3000,
        lane: 'seq',
        ...(tr
          ? { transitionField: tr, docTransition: fc.select.docTransitionValue() }
          : { defaultEnter: 'fade', defaultExit: 'fade' }),
        startField: timeCfg.startField,
        durField: timeCfg.durField,
        laneField: timeCfg.laneField,
        enterField: timeCfg.enterField,
        exitField: timeCfg.exitField,
        orderField: frameCfg.orderField || 'order',
        kindField: cfg.kindField,
        frameKind: frameCfg.frameKind,
      })
    );
    fc.narration.hideSeqPrompt();
    announce(t('Frames placed in order. Scrub the playhead to preview your slideshow.'));
  });
  seqPromptSkip.addEventListener('click', () => {
    fc.seqPromptDismissed = true;
    fc.narration.hideSeqPrompt();
  });

  // ── Notes to voice (plans/180 M-A) ──────────────────────────────────────────
  //
  // ONE door for both verbs: narrateDeck() speaks every slide that carries speaker
  // notes, narrateDeck(frameId) speaks (or re-speaks) one. The consent sheet, the
  // serial heavy queue, the toast and every model write belong to lib/narration.ts;
  // all this function does is say what the deck's fields are called and how to
  // re-pack it afterwards.
  //
  // Re-packing is the T7 half and it has to happen HERE, not in the lib: the pack
  // options (the per-frame transition field, the document transition, the 3 s
  // default) are the overlay's, and they are the same ones "Place in order" passes
  // - narrating a deck must not quietly change how its slides change.

  fc.narrateBusy = false;

  // Connector preview layer (opt-in): the "rubber" line while linking two cards, and a
  // live redraw of every edge while a connected card is being dragged (so the lines
  // follow in real time - the tool's real connector <svg> only re-renders on commit).
  // An <svg> covering the canvas in stage space, drawn in NATIVE coords via its viewBox.
  const connectLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); fc.connectLayer = connectLayer;
  connectLayer.setAttribute('class', 'fc-connect-layer');
  connectLayer.style.position = 'absolute';
  connectLayer.style.left = '0';
  connectLayer.style.top = '0';
  connectLayer.style.overflow = 'visible';
  connectLayer.style.pointerEvents = 'none';
  connectLayer.style.display = 'none';
  overlay.appendChild(connectLayer);

  // Pen preview layer - the draft path plus the segment under the cursor while drawing,
  // and the edited path's own outline while node-editing. Same trick as the connector
  // layer: an <svg> covering the artboard in stage px, drawn in NATIVE coords via its
  // viewBox, so a pan/zoom only has to move and resize the element.
  const penLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); fc.penLayer = penLayer;
  penLayer.setAttribute('class', 'fc-pen-layer');
  penLayer.style.position = 'absolute';
  penLayer.style.left = '0';
  penLayer.style.top = '0';
  penLayer.style.overflow = 'visible';
  penLayer.style.pointerEvents = 'none';
  penLayer.style.display = 'none';
  overlay.appendChild(penLayer);

  const chrome = document.createElement('div'); fc.chrome = chrome; // selection outlines + handles
  chrome.className = 'fc-chrome';
  overlay.appendChild(chrome);

  // Node/handle chrome, in its OWN container so it is built and torn down independently of
  // the selection chrome - the two are never on screen together, but they key on different
  // things (a node set vs a selection set) and sharing a container would make one rebuild
  // the other. Same build-once/reposition-many discipline as `chromeNodes`, for the reason
  // documented there: a 40-node path re-created per drag frame is far worse than the ~10
  // selection nodes that motivated the optimisation in the first place.
  const penChrome = document.createElement('div'); fc.penChrome = penChrome;
  penChrome.className = 'fc-pen-chrome';
  overlay.appendChild(penChrome);
  fc.penChromeKey = null;
  fc.penChromeNodes = null;

  const ctxbar = document.createElement('div'); fc.ctxbar = ctxbar; // contextual controls
  ctxbar.className = 'fc-ctxbar';
  ctxbar.hidden = true;
  ctxbar.addEventListener('pointerdown', (e) => e.stopPropagation());
  overlay.appendChild(ctxbar);
  fc.ctxSelKey = null; // sorted selected-id signature; rebuild ctxbar when it changes

  // ── the bar's ENTRANCE ────────────────────────────────────────────────────────
  // The bar is auto-hidden at rest and revealed by `.tool-stage:hover` (see .fc-ctxbar
  // in editor.css), which means at the moment a card is selected the stage is ALREADY
  // hovered: the opacity transition has nothing to run, and a fully formed bar of a
  // dozen controls materialises between two video frames right where the pointer is.
  // So absent→present gets a real entrance - a short settle after the gesture, then a
  // fade and a small rise - and ONLY that transition: a reposition mid-drag must never
  // re-play it, which is what `ctxShown` tracks.
  //
  // The rise is a transform, and a transform on this bar is the containing block for
  // its colour popover's `position: fixed` (the reason .fc-ctxbar carries neither
  // translateX nor backdrop-filter). Safe here and only here, because the keyframes
  // fill `backwards` and NOT forwards: the computed transform is `none` again the
  // instant the animation ends, and the class comes off on animationend. A popover
  // cannot exist during the run anyway - rebuildCtxBar replaces the bar's innerHTML,
  // which destroys any open one.
  fc.ctxShown = false;
  const CTX_ENTER = 'fc-ctxbar-enter'; fc.CTX_ENTER = CTX_ENTER;
  ctxbar.addEventListener('animationend', () => ctxbar.classList.remove(CTX_ENTER));

  // M1 - selection chrome (outline(s) + resize/rotate handles) is built ONCE per
  // selection set (keyed exactly like the ctxbar) and only REPOSITIONED on later
  // syncs. Rebuilding ~10 nodes + re-binding a pointerdown on each, every drag/pan/
  // zoom frame, was the bulk of a sync's DOM cost. chromeNodes holds the live nodes
  // so a reposition is pure style writes; teardown+rebuild happens only when the set
  // changes. handles[] order matches the build order (HANDLES for single; nw,ne,se,sw
  // for group) so positioning can address them positionally.
  fc.chromeKey = null;
  fc.chromeNodes = null;

  // Dock wrapper flex-centres the rail at rest without a transform on the rail
  // itself, and carries the left/top of a DRAGGED rail for the same reason
  // (a transform/backdrop-filter on either would capture the colour popover's
  // fixed positioning - see the .fc-toolbar-dock CSS note).
  const toolbarDock = document.createElement('div'); fc.toolbarDock = toolbarDock;
  toolbarDock.className = 'fc-toolbar-dock';
  toolbarDock.setAttribute('data-export-hide', '');
  const toolbar = document.createElement('div'); fc.toolbar = toolbar;
  toolbar.className = 'fc-toolbar';
  toolbar.setAttribute('role', 'toolbar');
  toolbar.setAttribute('aria-label', t('Editor tools'));
  // The rail is CANVAS tooling, not chrome over the canvas, and it moves house: it floats
  // on the stage, and it sits in the navigator's slot while that column is open. The
  // column marks itself `data-canvas-keys="off"`, which the rail would inherit - so the
  // tool letters and Delete would answer from a floating rail and go quiet from a docked
  // one. The nearest marker wins (chromeKeysOff), so this keeps one meaning in both homes.
  toolbar.setAttribute('data-canvas-keys', 'on');
  // Grip at the very top - the rail is a floating palette, so it says so and gives a
  // drag target that is not one of the buttons (every button stops pointerdown, which
  // is what keeps a click on a tool from starting a drag).
  const grip = document.createElement('div'); fc.grip = grip;
  grip.className = 'fc-grip';
  grip.setAttribute('data-tip', t('Drag to move the tools'));
  grip.setAttribute('aria-hidden', 'true');
  grip.innerHTML = '<span></span><span></span>';
  toolbar.appendChild(grip);
  toolbarDock.appendChild(toolbar);
  stageEl.appendChild(toolbarDock);

  // ── dragging the rail ────────────────────────────────────────────────────────
  // Position is written as plain left/top on the DOCK. NEVER a transform: a
  // transformed ancestor becomes the containing block for every position:fixed
  // descendant, which throws the rail's colour popover off-screen. That bug has
  // already been fixed once here - do not reintroduce it for a drag.
  fc.railDrag = null;
  fc.railWant = null;
  fc.railRaf = 0;
  /**
   * WHERE THE RAIL IS RIGHT NOW. Two panels can ask for it, and they must not both get
   * it: the open NAVIGATOR takes the buttons into a grid at the top of its own column,
   * and the open TIMELINE turns the rail into a fixed-width left column of its own.
   * With two independent mechanisms the rail ended up docked left for the timeline while
   * the navigator was open beside it, clipping the layer names - so there is one mode,
   * two standing requests, and one applier (`applyRailMode`).
   */
  fc.railMode = 'float';
  /** The timeline's standing request for the rail (see dockRailForTimeline). */
  fc.tlWantsRail = false;
  /** The navigator's, which wins: an open column already IS the left sidebar. */
  fc.navWantsRail = false;
  /** The docked rail column's own width in px, measured on the way in (see the dock). */
  fc.railDockW = 0;
  /**
   * ── The ONE writer of the stage's side reserves (plans/179 M2-d) ──────────────
   *
   * `--stage-reserve-left` was contended: the docked timeline rail wrote it, and the
   * navigator column wants it too. Two writers over one custom property means the last
   * one to run wins and the other's band silently disappears - so both go through here,
   * which is the only place either property is set.
   *
   * `--ldock-rail-w` is published beside it because a rail the TIMELINE docked must keep
   * its OWN width while the reserve also covers the navigator (editor.css's
   * `.has-tl-reserve .fc-toolbar-dock`); `.tl-panel` reads the full reserve, so the
   * timeline band starts to the right of the left column rather than under it.
   */
  fc.navReserveLeft = 0;
  fc.inspectorReserveRight = 0;
  /**
   * WHERE THE RAIL WAS WHEN THE PANEL TOOK IT (plans/179 T2). The auto-dock strips the
   * dock's `is-detached` + inline left/top to turn it into a fixed-width column, so
   * without a snapshot the undock has nothing to put back and the rail sits wherever
   * the last thing to write a position left it - the reported "rail stranded at x=-33,
   * a third of it off-screen". `null` means it was NOT detached (the CSS edge park),
   * which is a position too and has to be restored as faithfully as a dragged one.
   */
  fc.railPreDock = null;
  fc.railWasDetached = false;
  // Self-gating (no-op unless the flag is on and motion is allowed); wobble owns the
  // transform on the dock (only ever set mid-drag, while the popover is closed).
  const wobble = attachWobble(toolbarDock); fc.wobble = wobble;
  toolbar.addEventListener('pointerdown', fc.rail.onRailDown);
  toolbar.addEventListener('pointermove', fc.rail.onRailMove);
  toolbar.addEventListener('pointerup', fc.rail.onRailUp);
  toolbar.addEventListener('pointercancel', fc.rail.onRailUp);
  // The escape hatch the timeline panel's own grip already has: losing pointer capture
  // fires NEITHER pointerup nor pointercancel (the export shutter sets `pointer-events:
  // none` on the rail mid-drag, which releases capture implicitly). Without this the
  // drag state sticks forever - `.is-dragging` stays on and onRailDown refuses to start
  // a new drag - so the rail could never be released or re-grabbed.
  toolbar.addEventListener('lostpointercapture', fc.rail.onRailUp);

  // ── toolbar ─────────────────────────────────────────────────────────────────
  fc.popover = null;
  fc.arrangeBtn = null; // popover anchor (captured, not by index)
  /** The mode buttons, captured by buildToolbar - see syncModeUI. Absent ones stay null:
   *  pen and connect are opt-in, so not every tool has all four. */
  const modeBtns: Record<'select' | 'create' | 'pen' | 'line', HTMLButtonElement | null> = {
    select: null,
    create: null,
    pen: null,
    line: null,
  }; fc.modeBtns = modeBtns;
  fc.nodeToolBtn = null; // the Node tool (opt-in, cv.pathField)
  /** The control the open popover belongs to: it owns the trigger's `aria-expanded`,
   *  and it is where focus goes back to when the menu closes from the keyboard. */
  fc.popoverAnchor = null;
  fc.toolbox.buildToolbar(); // after arrangeBtn exists (buildToolbar assigns it)
  // Put the rail back where it was dragged to earlier in this page session, re-clamped
  // against THIS stage (a different tool, a resized window).
  if (railSession) fc.rail.placeRail(railSession);

  /** How long a press has to be held before it counts as "open this tool's options"
   *  rather than "use this tool". Long enough not to fire on a slow click, short enough
   *  to feel like a press rather than a hang. */
  const HOLD_MS = 420; fc.HOLD_MS = HOLD_MS;
  /** Pointer travel that turns a hold into a drag and cancels the menu, SCREEN px. */
  const HOLD_SLOP = 8; fc.HOLD_SLOP = HOLD_SLOP;

  const ADD_KIND_ICON: Record<string, string> = {
    image: SVG.image,
    text: SVG.type,
    box: SVG.boxKind,
    lottie: SVG.anim,
    video: SVG.video,
    // Sequence Studio's kinds - without these all three fell back to the generic "+".
    clip: SVG.clipKind,
    card: SVG.boxKind,
    audio: SVG.audioKind,
    tool: SVG.toolKind,
    // The frame primitive (plan 93) - the artboard "#" rather than a bare "+".
    frame: SVG.frame,
    // The scene camera (plans/104 section 5.4). Same glyph the timeline's add menu and the
    // Camera inspector group wear, so one thing looks like one thing.
    camera: SVG.camera,
  }; fc.ADD_KIND_ICON = ADD_KIND_ICON;

  // ── what a KIND can carry (plan 179 C3 / A5) ─────────────────────────────────
  //
  // The object bar used to offer every control to every selection, so "Edit text" on an
  // artboard, an image or a path opened nothing and said nothing (`startTextEdit` returns
  // on a missing text node), while Stroke - which the manifest offers to four kinds and
  // the hooks render as a real CSS border - was reachable only on a path. Both halves of
  // that are the same mistake: the bar was not asking what the selection IS.
  //
  // `stroke`, `strokeW` and `strokeDash` declare `showFor: ["path","box","image","frame"]`,
  // so STROKE_KINDS is the manifest read back. Text and image have no `showFor` in any
  // manifest, so they are gated the other way round: by the kinds that provably CANNOT
  // carry them, taken from the render. Everything else is offered.
  //
  // That direction matters. An allow-list here was a second opinion the manifests do not
  // back, and it was wrong three ways at once: Org Chart's boxes are all `kind:"card"` and
  // lost their pencil, their Aa panel and Set image although the template paints
  // `.lolly-box-text` and an avatar on every one of them; a Design `image` or `path` box
  // lost the pencil while double-click kept editing the caption it renders; and an `audio`
  // box lost the only canvas route to its track, which lives in the SAME `image` field.
  //
  // The two deny sets come from `hooks.js`: `isBareBox` (audio, camera) is the pair whose
  // text `compute()` blanks, a frame renders a page div with no text node at all, and a
  // camera is a marker that paints nothing whatsoever.
  //
  // The EMPTY kind passes every gate. A tool whose boxes carry no `kind` at all (Carousel
  // Maker, every non-Design canvas) must keep the bar it has always had, and a gate that
  // read `String(undefined)` would have hidden the lot.
  const STROKE_KINDS = new Set(['path', 'box', 'image', 'frame']); fc.STROKE_KINDS = STROKE_KINDS;
  /** Kinds that render NO text node, so "Edit text" would open nothing. */
  const NO_TEXT_KINDS = new Set(['frame', 'audio', 'camera']); fc.NO_TEXT_KINDS = NO_TEXT_KINDS;
  /** Kinds that paint no picture from the image field. (An `audio` box DOES use it - that
   *  field is where its track lives - and a frame page paints it as the board's fill.) */
  const NO_IMAGE_KINDS = new Set(['camera']); fc.NO_IMAGE_KINDS = NO_IMAGE_KINDS;

  /**
   * The DOLLY, coalesced (section 8: "wheel coalesces one commit per pause").
   *
   * A wheel is a stream of small deltas with no end event, so a commit per notch would
   * be a hundred undo steps for one gesture. The deltas accumulate here and one write
   * lands when the stream stops - the same "one commit per gesture" law the drags obey,
   * with a timer standing in for pointerup.
   */
  fc.dollyPending = 0;
  fc.dollyTimer = null;
  const DOLLY_PAUSE_MS = 180; fc.DOLLY_PAUSE_MS = DOLLY_PAUSE_MS;
  /** Wheel notches → dolly px. A notch is ~100 deltaY on a mouse; ~24px of camera is a
   *  visible but recoverable step at P = 1200. */
  const DOLLY_PX_PER_DELTA = 0.24; fc.DOLLY_PX_PER_DELTA = DOLLY_PX_PER_DELTA;
  /**
   * Screen px → degrees of tilt (P2). 0.2 puts the Surface glide preset's own −40° at
   * a 200 px drag: one comfortable wrist movement reaches the signature angle.
   *
   * The band this runs into is `KF_TILT_CONTROL` (±75), not the ±180 WIRE clamp, and
   * the hold is in `timelinePanel.cameraWrite` rather than here - a drag supplies a
   * DELTA, so only the site that composes it with the pose it started from can bound
   * the result. 375 px of drag reaches the end of the band; past that the shot stops
   * turning, which is the same thing the Tilt X / Tilt Y number fields do.
   */
  const CAM_TILT_DEG_PER_PX = 0.2; fc.CAM_TILT_DEG_PER_PX = CAM_TILT_DEG_PER_PX;

  // A box is one unified object (fill + shape + image + text), but the KINDS differ in
  // what they can hold - so the bar offers what this selection can actually do (plan 179
  // C3). Rebuilt when the selection set changes OR when the values it shows change (A16:
  // the fill swatch used to keep the pre-undo colour after Cmd+Z); positioned each frame
  // elsewhere.
  /**
   * The mounted Design inspector, when there is one (plans/179 M3, design-ports'
   * `setInspector`). Its presence turns four object-bar buttons from PANEL OPENERS into
   * NAVIGATION: Text / More / Stroke / the position readout reveal the column's section
   * instead of hanging a one-slot popover off the bar, because the column already shows
   * every one of those controls and two live copies of a field is how they drift.
   *
   * `null` restores today's panels exactly - which is what keeps Org Chart, Carousel
   * Maker and every other editor tool (none of which mount a column) unchanged.
   */
  fc.inspectorPort = null;

  // ── on-canvas gradient editing ────────────────────────────────────────────────
  //
  // A gradient is the one paint property that is genuinely spatial: its stops sit
  // SOMEWHERE on the shape, and picking them off a list of numbers means guessing.
  // So the stops are handles on the artboard, dragged along the gradient's own line,
  // with the direction on a handle of its own.
  //
  // The model is the engine's gradient spec (a string on the box's `grad` field), and
  // the CSS comes from `gradientSpecToCss` - the SAME call the tool's hooks make, so
  // what the handles show and what the export writes cannot drift. The stops are
  // interpolated in OKLab and baked to sRGB by the engine (plans/60-color-spaces.md section 10),
  // which is what keeps a two-colour gradient from going muddy through the middle.
  //
  // Colour picking deliberately reuses the ctx bar's Fill field: in gradient mode it
  // edits the SELECTED STOP, so the brand palette is one click from every stop rather
  // than being re-implemented here.
  fc.gradEdit = null; // box id being edited, or null
  fc.gradStopIdx = 0; // which stop the Fill field + Delete act on
  // The panel is opened by the SYNC, not by the click that asks for it. Entering
  // gradient mode resets `ctxSelKey` so the ctx bar rebuilds (its Fill field changes
  // meaning), and `rebuildCtxBar` begins with `closeMorePanel()` - so a panel opened
  // synchronously was destroyed a frame later by the very re-sync that opening it
  // required. Found in a browser, invisible to review: the handles appeared, the panel
  // did not, and any click into it hit a detached node.
  fc.gradPanelPending = false;
  // The spec mid-drag. `writeGradSpec(…, live)` only touches the box's own
  // backgroundImage (no setInput, so the tool does not re-render per pointermove), so
  // without this the chrome kept repainting from the COMMITTED model: the grabbed
  // handle was destroyed and rebuilt at its pre-drag position on every frame while the
  // paint underneath followed the pointer. Same idea as `liveRects` for box gestures.
  fc.gradLive = null;

  // The gradient line, as an SVG in STAGE px - redrawn each sync. Stage px rather than
  // native-with-a-viewBox (the pen layer's trick) because the stop handles are DOM
  // divs that must not scale with zoom, and one coordinate system for both is simpler
  // to keep honest than two.
  const gradLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); fc.gradLayer = gradLayer;
  gradLayer.setAttribute('class', 'fc-grad-layer');
  gradLayer.style.position = 'absolute';
  gradLayer.style.left = '0';
  gradLayer.style.top = '0';
  gradLayer.style.overflow = 'visible';
  gradLayer.style.pointerEvents = 'none';
  gradLayer.style.display = 'none';
  overlay.appendChild(gradLayer);
  const gradChrome = document.createElement('div'); fc.gradChrome = gradChrome;
  gradChrome.className = 'fc-grad-chrome';
  overlay.appendChild(gradChrome);

  // ── "More" panel: shape / radius / opacity / image fit / blend ────────────────
  fc.morePanel = null;

  // ── canvas (document) size ────────────────────────────────────────────────────
  const SIZE_UNITS = ['px', 'mm', 'cm', 'in', 'pt']; fc.SIZE_UNITS = SIZE_UNITS;
  fc.sizeUnit = fc.document.readDocumentUnit();
  // The export panel is a peer of the size menu. Its unit picker updates the
  // persisted document input itself, then tells this long-lived editor instance
  // to use the same unit the next time its panel opens.
  canvasEl.addEventListener('fc-document-unit', ((e: Event) => {
    const unit = (e as CustomEvent<unknown>).detail;
    if (typeof unit === 'string' && SIZE_UNITS.includes(unit)) {
      fc.sizeUnit = unit;
      // The size panel/export sheet may have originated this event, but the Inspector
      // can too. Re-publish the complete document setting so all three surfaces converge.
      fc.document.syncDocumentSettings();
    }
  }) as EventListener);
  canvasEl.addEventListener('fc-document-dpi', ((e: Event) => {
    const dpi = Number((e as CustomEvent<unknown>).detail);
    if (Number.isFinite(dpi) && dpi >= 36 && dpi <= 2400) fc.document.syncDocumentSettings();
  }) as EventListener);
  // 16:9 leads - a design/deck starts widescreen (Andy's rule); the rest cover the range a
  // deck actually ships at: portrait + ultrawide signage, cinematic + full-stage keynote walls,
  // then social/print. Custom W×H below the presets covers anything else.
  //
  // The paper sizes are CSS pixels at the 96 dpi convention the engine's units.ts maps px
  // through (plans/184 section 2): A4 is 210 × 297 mm = 793.7 × 1122.5 px, Letter 8.5 × 11 in
  // = 816 × 1056 px. Fractional px are stored as they are (plans/184 R12), so A4 exports as a
  // true 595.3 × 841.9 pt page. Print resolution is the EXPORT's dpi (300 by default), applied
  // at export time - not baked into the canvas. The old presets wrote A4 at 300 dpi (2480 ×
  // 3508) and at 150 dpi (1240 × 1754) as px, so a board called A4 exported 656 × 928 mm.
  // design-units-contract.test.ts round-trips every paper preset through units.ts.
  const SIZE_PRESETS: Array<[string, number, number]> = [
    ['Landscape 16:9', 1920, 1080],
    ['Story 9:16', 1080, 1920],
    ['Square', 1080, 1080],
    ['Standard 4:3', 1440, 1080],
    ['Cinematic 21:9', 2520, 1080],
    ['Stage 32:9', 3840, 1080],
    ['Portrait 4:5', 1080, 1350],
    ['Wide 1.91:1', 1200, 630],
    ['A4 portrait', 793.7, 1122.5],
  ]; fc.SIZE_PRESETS = SIZE_PRESETS;
  // Page-size presets for multi-page (carousel) mode. Every page shares one size.
  const PAGE_PRESETS: Array<[string, number, number]> = [
    ['Portrait 4:5', 1080, 1350],
    ['Square', 1080, 1080],
    ['Story 9:16', 1080, 1920],
    ['Landscape 16:9', 1920, 1080],
    ['A4 portrait', 793.7, 1122.5],
    ['Letter', 816, 1056],
  ]; fc.PAGE_PRESETS = PAGE_PRESETS;
  stageEl.addEventListener('fc-query-rect', fc.document.onQueryRect);

  // Re-entrancy guard: the action reads the live DOM across awaits (fonts, shaping)
  // before its one synchronous commit. Two overlapping runs both measuring the
  // pre-commit DOM could, for a box KEPT because it also paints (paintsBesidesText),
  // splice a second copy of the same glyphs. The menu button self-destructs on click
  // so this isn't reachable through the current dispatch, but the guard is a cheap,
  // future-proof invariant for an async mutator.
  fc.outliningInFlight = false;

  // ── grouping + clip/mask ──────────────────────────────────────────────────────
  // A group TAG, not a row identity: it is compared for equality between boxes of this
  // one document, so it keeps its short per-mount form (freshId moved to ULIDs because a
  // ROW is what a remote op addresses - see plan 100 section 3). Its own counter since that
  // move; two peers grouping at the same millisecond can still mint the same tag, which
  // would merge two unrelated groups - a convergence snag for the collab wave, not this one.
  fc.groupSeq = 0;

  /** How far to the right of the original a duplicated artboard sits - the same 56px
   *  gutter the carousel migration and the import layout put between pages. */
  const FRAME_DUP_GAP = 56; fc.FRAME_DUP_GAP = FRAME_DUP_GAP;

  // ── vector operations (opt-in via canvas.pathField) ───────────────────────────
  // The geometry itself lives in vector-ops.ts (pure, DOM-free, engine-backed); this is
  // only the menu wiring: gather the operands, run the op, and commit ONE model write.
  //
  // Failure never half-edits the model - `run` is called first and nothing is committed
  // unless it answered `ok:true`.

  /** Curve-fitting tolerance for Simplify, in native canvas px. Sub-pixel, so the result
   *  is visually the same path with fewer nodes; not exposed as a prompt because the
   *  useful range is narrow and "fewer nodes, same shape" is the whole request. */
  const SIMPLIFY_TOL = 0.6; fc.SIMPLIFY_TOL = SIMPLIFY_TOL;

  // ── the pen tool (opt-in via canvas.pathField) ────────────────────────────────
  // Geometry lives in free-canvas-pen.ts (pure, engine-backed); this is the gestures, the
  // chrome and the one-commit-per-action wiring.
  //
  // Two exclusive modes. DRAWING builds `penDraft` in native px and writes the model
  // exactly once, when the path ends. NODE-EDITING holds the box's path DENORMALISED to
  // box-local px in `penEdit`, which is the space `hooks.js` lowers in, and writes the
  // model once per completed edit (a drag, an insert, a delete, a continuity change).

  /** The kind a NEW path is drawn in. Remembered across draws, seeded from the plan's
   *  default - `hyperbezier`, whose node default is `'smooth'`, so plain click-click-click
   *  draws a curve rather than a polyline. */
  fc.penDrawKind = PEN_DEFAULT_KIND;

  // ── object copy / paste ───────────────────────────────────────────────────────
  // ⌘/Ctrl+C on a selection copies the box(es) - both to an in-memory clip and,
  // behind FC_CLIP_PREFIX, onto the OS clipboard - so the next ⌘V duplicates them
  // (see onGlobalPaste). While editing text the browser's native text copy wins;
  // this only fires on the bare canvas with a selection.
  fc.objectClipboard = null; // Array<box> - the in-memory fallback
  fc.styleClipboard = null;
  // Copy style is an ALLOW-LIST of fields the manifest declared as visual controls.
  // Identity, geometry, content (text/image/path), artboard ownership, timing, notes,
  // hidden/locked state, groups and z-order are absent by construction. Filtering the
  // resolved/defaulted names through the block schema is important: a legacy tool must
  // not acquire a field its URL wire cannot carry merely because this editor knows the
  // conventional name.
  const declaredBoxFields = new Set((input.fields || []).map((f) => f.id)); fc.declaredBoxFields = declaredBoxFields;
  const styleFields = [...new Set([
    cfg.fillField, cfg.gradField, cfg.opacityField, cfg.shapeField, cfg.radiusField,
    cfg.fitField, cfg.imgPosField, cfg.blendField,
    cfg.textColorField, cfg.fontSizeField, cfg.alignField, cfg.valignField,
    cfg.weightField, cfg.fontField, cfg.lineHeightField, cfg.trackingField,
    cfg.ligaturesField, cfg.alternatesField, cfg.padField, cfg.fitTextField,
    cfg.strokeField, cfg.strokeWField, cfg.fillRuleField, cfg.strokeDashField,
    cfg.strokeCapField, cfg.strokeJoinField, cfg.strokeDashArrayField,
    cfg.dashFitField, cfg.headStartField, cfg.headEndField,
    cfg.shadowField, cfg.shadowColorField, cfg.shadowXField, cfg.shadowYField,
    cfg.shadowBlurField,
  ].filter((f): f is string => !!f && declaredBoxFields.has(f)))]; fc.styleFields = styleFields;

  fc.lastPointer = null;

  // ── inline text editing (double-click a box) ─────────────────────────────────
  // WYSIWYG rich text: the box's rendered markup is edited in place, and a
  // floating format bar offers bold/italic/bullets (selection-level, via the
  // rich-text.js char model) plus alignment/weight/size (box-level, staged in
  // editing.pending and committed with the text as one undo step).
  fc.fmtbar = null;

  /** The smallest on-screen type an edit can start at. Fit zoom on a phone is ~19%, which
   *  renders a 64px text box at ~12px - typing into that shows the user nothing. */
  const TOUCH_EDIT_MIN_PX = 16; fc.TOUCH_EDIT_MIN_PX = TOUCH_EDIT_MIN_PX;

  // ── two-finger tap → context menu (touch) ─────────────────────────────────────
  // A touchscreen has no right-click, and `contextmenu` is not reliably synthesised for
  // one: Android Chrome fires it on a long-press, iOS Safari does not fire it at all over
  // ordinary elements, and NO mobile browser fires it for a two-finger tap. So the
  // gesture is recognised here rather than waited for.
  //
  // It must not steal two-finger PAN or PINCH, which tool-stage-nav.ts owns on this same
  // element through these same pointer events. That is what the two thresholds are for: a
  // tap is two fingers down together, neither travelling more than TWO_TAP_SLOP, released
  // inside TWO_TAP_MS. A pan travels, a pinch travels, and a two-finger hold outstays the
  // window - each of those clears the candidate and stageNav keeps the gesture untouched.
  // Nothing is taken away from it in the tap case either: stageNav's pinch dead-zone
  // swallows a sub-pixel finger spread and a zero-delta two-finger pan is a no-op.
  const TWO_TAP_MS = 500; fc.TWO_TAP_MS = TWO_TAP_MS;
  const TWO_TAP_SLOP = 14; fc.TWO_TAP_SLOP = TWO_TAP_SLOP;
  const touchPts = new Map<number, TouchPt>(); fc.touchPts = touchPts;
  fc.twoTapStart = 0; // when the second finger landed (0 = not a candidate)
  fc.twoTapDone = false;

  /** Space is stageNav's pan modifier (Space+left-drag). Tracked here only so the
   *  backdrop marquee yields to it - stageNav owns the pan and exposes no state. */
  fc.spacePan = false;

  // pointermove fires far faster than paint (60–120 Hz); coalesce to one rAF per frame so
  // the heavy path (snap + live rects + connector redraw) runs at most once per paint.
  fc.pendingMove = null;
  fc.moveRaf = 0;

  // ── overlay rendering ─────────────────────────────────────────────────────────
  fc.syncScheduled = false;

  // ── active artboard → export bar (plans/141 WP-B) ─────────────────────────────
  // The export bar mirrors the artboard the user is working with. Emit (deduped)
  // from renderChrome - which already runs on every selection change, commit, and
  // `tl-time` - carrying BOTH candidates: the selected artboard (falling back to
  // the primary one) and the artboard under the sequence playhead (the page the
  // clock left visible). tool-actions picks per export format: still formats
  // follow the selection, animated formats follow the playhead. No frames → no
  // event, and the bar keeps its no-frames behaviour.
  fc.activeArtboardKey = '';
  /**
   * The ArtboardPort's own subscribers (plans/179 M2). Separate from the `fc-artboard`
   * DOM event because a column wants the ID and nothing else: the event's payload also
   * carries the PLAYHEAD's artboard, so it re-fires as the clock moves over a deck and a
   * navigator subscribed to it would repaint on every frame of playback.
   */
  const artboardListeners = new Set<(id: string) => void>(); fc.artboardListeners = artboardListeners;
  fc.artboardNotifiedId = '';

  // Frame name labels: rebuild the tabs only when the frame set / order / active state
  // changes (tracked by frameLabelKey), and reposition them every sync - the same MODEL-px
  // discipline positionFrameScrim uses. Hidden entirely while editing text or in pen mode so
  // the canvas stays clean. frameCfg-gated.
  fc.frameLabelKey = '';

  // ── artboard rename (plans/179 A10) ──────────────────────────────────────────
  //
  // The tabs were hard-coded "Artboard N" and there was no rename anywhere on the canvas,
  // so the `name` an import fills in was written and never shown. The tab now reads the
  // name when there is one, and a double-click turns it into a one-field editor: Enter or
  // a click away saves, Escape cancels. Single click still solos the frame.
  fc.renamingFrameId = '';
  const OPPOSITE: Record<Corner, Corner> = { nw: 'se', ne: 'sw', se: 'nw', sw: 'ne' }; fc.OPPOSITE = OPPOSITE;

  /**
   * The fixed stage chrome the contextual bar has to keep off, in STAGE coordinates:
   * the zoom HUD top-right (`.stage-nav`) and the back pill top-left
   * (`.tools-home`, which is `position: fixed` and therefore lives outside the stage
   * in the DOM but squarely on top of it on screen). Measured, never assumed - a
   * hard-coded HUD width goes stale the first time the theme/sound toggles or the
   * type multiplier change it, and the back pill's label is the view's own name.
   *
   * Cached for the life of a gesture beside `gestureMetrics`, for the same reason: two
   * more forced layouts per drag frame buy nothing, and this chrome cannot move while a
   * box is being dragged.
   */
  fc.ctxBlockers = null;
  /** The placement held for the life of a box gesture (see positionCtxBar). */
  fc.ctxFrozen = null;

  // ── wiring ────────────────────────────────────────────────────────────────────
  // Two-finger-tap recognition - capture phase, so a second finger is already recorded by
  // the time the canvas's own pointerdown handler runs (see onCanvasPointerDown).
  stageEl.addEventListener('pointerdown', fc.gestures.onStageTouchDown, true);
  stageEl.addEventListener('pointermove', fc.gestures.onStageTouchMove, true);
  stageEl.addEventListener('pointerup', fc.gestures.onStageTouchUp, true);
  stageEl.addEventListener('pointercancel', fc.gestures.onStageTouchUp, true);
  canvasEl.addEventListener('pointerdown', fc.gestures.onCanvasPointerDown);
  stageEl.addEventListener('pointerdown', fc.gestures.onBackdropPointerDown); // deselect/marquee on backdrop
  viewEl.addEventListener('pointerdown', fc.gestures.onBackdropPointerDown);
  stageEl.addEventListener('contextmenu', fc.gestures.onBackdropContextMenu);
  viewEl.addEventListener('contextmenu', fc.gestures.onBackdropContextMenu);
  window.addEventListener('keydown', fc.gestures.onSpaceKey);
  window.addEventListener('keyup', fc.gestures.onSpaceKey);
  canvasEl.addEventListener('pointermove', fc.gestures.onGestureMove);
  canvasEl.addEventListener('pointerup', fc.gestures.onGestureEnd);
  canvasEl.addEventListener('pointercancel', fc.gestures.onGestureEnd);
  canvasEl.addEventListener('dblclick', fc.gestures.onDblClick);
  canvasEl.addEventListener('contextmenu', fc.menus.onContextMenu);
  canvasEl.addEventListener('focusin', fc.keys.onBoxFocus);
  // While the editor is mounted, un-clip the canvas (and the tool's own clipping
  // root inside it) so boxes dragged off the artboard stay visible + selectable -
  // their DOM still lives inside canvasEl, so clicks bubble to the handlers above.
  // Export semantics are unchanged: the raster capture is bounded by the canvas
  // rect, and the vector walkers' out-of-viewBox geometry never paints.
  canvasEl.classList.add('fc-open-canvas');
  window.addEventListener('keydown', fc.keys.onKey);
  document.addEventListener('paste', fc.textEdit.onGlobalPaste);
  document.addEventListener('copy', fc.modes.onCopy);
  document.addEventListener('cut', fc.modes.onCut);
  stageEl.addEventListener('pointermove', fc.keys.onStagePointerMove, { passive: true });
  stageEl.addEventListener('wheel', fc.keys.onStageMove, { passive: true });
  // The camera's wheel (plans/104 section 8) - on the CANVAS, not the stage, and non-passive
  // so a claimed notch can be preventDefault()ed. It runs BEFORE `tool-stage-nav`'s
  // stage-level listener (a canvas-level handler on the way up), and only claims the
  // event when a camera is actually armed.
  canvasEl.addEventListener('wheel', fc.contextBar.onCameraWheel as EventListener, { passive: false });
  window.addEventListener('resize', fc.keys.onStageMove);
  const ro = new ResizeObserver(fc.keys.onStageMove); fc.ro = ro;
  ro.observe(stageEl);
  stageEl.addEventListener('transitionend', fc.keys.onStageTransitionEnd);
  // Keyboard/HUD zoom (setupStageNav's − / + / 0 / 1 / Fit) changes the canvas
  // wrapper's transform with NO pointer or wheel event - watch the wrapper's
  // style attribute so the selection chrome follows those zooms too.
  const mo = new MutationObserver(fc.keys.onStageMove); fc.mo = mo;
  if (canvasEl.parentElement)
    mo.observe(canvasEl.parentElement, { attributes: true, attributeFilter: ['style'] });
  // Re-sync after every model change (paint()).
  // A bulk external apply - picking an ANIMATED template after the blank mount - can flip
  // the doc from untimed to timed; open the timeline the first time that happens, so the
  // template reads as animated. One-shot: it never re-opens after a manual close, and a
  // static template (poster / pull quote / blank) leaves the stage whole. Mirrors the
  // mount-time check below (which handles a doc that arrives already timed).
  fc.timelineAutoOpened = false;
  const unsub = runtime.subscribe(() => {
    fc.chromeSync.scheduleSync();
    if (!fc.timelineAutoOpened && timeCfg && fc.timeline.anyTimed(fc.select.getBoxes())) {
      fc.timelineAutoOpened = true;
      fc.timeline.openTimeline();
    }
  }); fc.unsub = unsub;
  document.addEventListener('keydown', fc.keys.onPreviewKey);
  document.addEventListener('pointerdown', fc.keys.onDocDown, true);

  // Legacy documents - saved before this tool declared an id field, or hand-written into
  // a URL - get their ids HERE, once, on load. mountTool already ran the same migration
  // over every blocks input before this view was built, so in the app this pass normally
  // finds nothing; it stays because the canvas keys SELECTION on these ids and a harness
  // (or any future non-mountTool host) must not get an id-less document. Deliberately NOT
  // through commit(): giving a row an identity is not an edit the user made, so no onDirty and no
  // Save-pill flash - and not through the history-recording `setInput` either, or the
  // user's first ⌘Z would undo the id stamping back to an id-less array, where `idOf`
  // returns '' for every row and one click selects the whole document. The ids persist on
  // the next real save; a session closed unsaved simply gets fresh ones next time, which
  // is what "lazy" buys - no migration pass over stored slots.
  {
    const loaded = fc.select.getBoxes();
    let next = fc.select.withIds(loaded);
    // Frame membership follows spatial position (plan 112 (b)): a box placed OVER a frame
    // (its centre inside) becomes that frame's member on load - exactly as a drag would
    // assign it - so a template or import that positioned content spatially WITHOUT setting
    // `frame` still presents and per-page-exports as frames, not as excluded pasteboard. A
    // centre OUTSIDE every frame stays '' (assignFrames leaves it), keeping the pasteboard
    // scratchpad. Quiet, like the id stamping below: membership matching position is not a
    // user edit, so no onDirty (no Save-pill flash) and no history entry (no ⌘Z surprise).
    if (frameCfg) next = fc.select.assignFrames(next, new Set(next.map((_, i) => i)));
    // mountTool installs the un-wrapped setter; a mount without it falls back.
    const quiet =
      (runtime as RuntimeApi & { setInputNoHistory?: RuntimeApi['setInput'] }).setInputNoHistory ??
      ((id: string, value: unknown) => runtime.setInput(id, value));
    const changed = next.length !== loaded.length || next.some((b, i) => b !== loaded[i]);
    if (changed) quiet(blockId, next);
  }

  fc.chromeSync.renderChrome();

  // A composition that already has timing opens with its timeline showing; an empty
  // (or untimed) one leaves the stage whole until the user asks for it from the rail.
  if (timeCfg && fc.timeline.anyTimed(fc.select.getBoxes())) {
    fc.timelineAutoOpened = true;
    fc.timeline.openTimeline();
  }
  fc.editorState.applyEditorState(opts.deepLink);

  // Universal drop front door (lib/drop-router.ts): a design file dropped on the
  // gallery/dashboard was stashed one-shot and is consumed here on mount, through
  // the exact same lazy parseDesignFile → commit path as the Import panel above.
  const pendingImport = importCfg ? takePendingDesignImport() : null; fc.pendingImport = pendingImport;
  if (pendingImport) {
    void (async () => {
      announce(t('Importing…'));
      try {
        let mode: ImportMode = pendingImport.scenes && importSceneCapable ? 'scenes' : 'board';
        if (mode === 'board' && (importArtboardCapable || importSceneCapable)) {
          // The "Edit in Design" door with a document of several pages: ask how they
          // should come in, the way the Import panel's radios do - artboards (the deck
          // the file already is), timed scenes, or just one page. A single-page file
          // never asks; a bundle whose page count costs a full parse asks without the
          // number. Cancelling the question cancels the import, nothing changed.
          const { countDesignPages } = await import('./design-import.ts');
          const n = await countDesignPages(pendingImport.file);
          if (fc.disposed) return;
          if (n !== 1) {
            const pick = await fc.dialogs.askImportPages(n);
            if (fc.disposed) return;
            if (!pick) {
              announce(t('Import cancelled.'));
              return;
            }
            mode = pick;
          }
        }
        if (mode === 'scenes') {
          // The "Make a video from its frames" drop door: the dropped design's frames
          // become timed scenes on the timeline (plans/104 section 337).
          const n = await fc.menus.importAsScenes(pendingImport.file, (m: string) => announce(m));
          if (fc.disposed) return;
          announce(n === 1 ? t('Added 1 scene.') : t('Added {n} scenes.', { n }));
          return;
        }
        if (mode === 'artboards') {
          const n = await fc.menus.importAsArtboards(pendingImport.file, (m: string) => announce(m));
          if (fc.disposed) return;
          announce(n === 1 ? t('Added 1 artboard.') : t('Added {n} artboards.', { n }));
          return;
        }
        const { parseDesignFile } = await import('./design-import.ts');
        const res = await parseDesignFile(pendingImport.file, {
          host: host as any,
          log: (m: string) => announce(m),
          interactive: true,
          map: importMap,
        });
        if (fc.disposed) return;
        const boxes = (Array.isArray(res.boxes) ? res.boxes : []) as Box[];
        if (!boxes.length) throw new Error(t('Nothing importable was found in that file.'));
        fc.selection = new Set<string>();
        fc.select.commit(boxes);
        if (setCanvasSize && res.width > 0 && res.height > 0)
          setCanvasSize(res.width, res.height, 'px');
        announce(
          boxes.length === 1
            ? t('Imported 1 object.')
            : t('Imported {n} objects.', { n: boxes.length })
        );
      } catch (err) {
        if (!fc.disposed)
          announce((err as Error)?.message || t('Import failed.'), { assertive: true });
      }
    })();
  }

  /** `model.cfg`, plus the two tilt field names that live on the CANVAS block rather than
   *  the resolved geometry config (see openMorePanel) - a column asking for `rxField`
   *  must get the same answer the panel does. */
  const portCfg = {
    ...cfg,
    rxField: cv.rxField || undefined,
    ryField: cv.ryField || undefined,
  } as unknown as ModelPort['cfg']; fc.portCfg = portCfg;

  const modelPort: ModelPort = {
    blockId,
    cfg: portCfg,
    frame: frameCfg
      ? ({
          frameField: frameCfg.frameField,
          frameKind: frameCfg.frameKind,
          orderField: frameCfg.orderField || 'order',
          clipChildrenField: frameCfg.clipChildrenField,
          labelField: nameField || undefined,
          transitionField: frameCfg.transitionField,
        } as FramePort)
      : null,
    getBoxes: fc.select.getBoxes,
    commit: fc.select.commit,
    setField: (ids, field, value) => fc.editorState.setFieldOn(ids, field, value),
    // The runtime's own subscribe may return nothing (a host that never unsubscribes);
    // a port promises an unsubscribe, so a missing one becomes a no-op rather than a
    // crash inside a column's destroy().
    subscribe: (cb) => {
      const off = runtime.subscribe(cb);
      return typeof off === 'function' ? off : () => {};
    },
    getInput: (id) => runtime.getModel().find((i) => i.id === id)?.value,
    setInput: (id, value) => {
      onDirty?.(id);
      runtime.setInput(id, value as InputValue);
    },
  }; fc.modelPort = modelPort;

  const artboardPort: ArtboardPort = {
    active: fc.document.activeArtboardId,
    focus: fc.document.focusArtboard,
    onChange: (cb) => {
      artboardListeners.add(cb);
      return () => {
        artboardListeners.delete(cb);
      };
    },
  }; fc.artboardPort = artboardPort;

  const navigatorActions: NavigatorActions = {
    duplicateFrame: (id) => fc.editorState.withFrameSelected(id, fc.ops.duplicateSelection),
    deleteFrame: (id) => fc.editorState.withFrameSelected(id, fc.ops.deleteSelection),
    addArtboardAfter: fc.editorState.addArtboardAfter,
    present: (fromFrameId) => actions?.present?.(fromFrameId),
    reorderChildren: fc.editorState.reorderFrameChildren,
    makeArtboard: fc.document.makeArtboardAround,
  }; fc.navigatorActions = navigatorActions;

  const inspectorActions: InspectorActions = {
    pickImage: (ids) => {
      if (!ids.length) return;
      fc.selection = new Set(ids);
      fc.chromeSync.renderChrome();
      const boxes = fc.select.getBoxes();
      // An audio box's "image" IS its track - the same read the object bar's Set image does.
      const audio = fc.contextBar.selectionAllKinds(boxes, fc.select.selIndices(boxes), new Set(['audio']));
      void fc.objects.pickImage(audio ? { pickType: 'audio' } : undefined);
    },
    openGradient: (ids) => {
      if (ids.length) {
        fc.selection = new Set(ids);
        fc.chromeSync.renderChrome();
      }
      fc.gradient.toggleGradEdit(ctxbar); // the anchor is unused - the panel re-anchors on the rebuilt button
    },
    arrange: fc.editorState.runArrange,
    openTimeline: fc.editorState.openTimelineOn,
  }; fc.inspectorActions = inspectorActions;

  const designPorts: DesignCanvasPorts = {
    selection: selectionPort,
    guides: fc.authoringGuides ?? undefined,
    artboard: artboardPort,
    thumb: (frameBox, maxW, maxH) => frameThumb(canvasEl, frameBox, cfg, { maxW, maxH }),
    model: modelPort,
    navigatorActions,
    inspectorActions,
    // Notes to voice (plans/180). Offered only where the pieces exist: a speech
    // bridge, frames, a time model and a group field. Absent, no column grows a
    // Narrate control, which beats a button that cannot work.
    ...(frameCfg && timeCfg && cfg.groupField && (host as unknown as HostV1).speech?.isAvailable()
      ? {
          narrationActions: {
            narrateAll: () => {
              void fc.narration.narrateDeck();
            },
            narrateFrame: (id: string) => {
              void fc.narration.narrateDeck(id);
            },
            status: (id: string) => fc.narration.narrationStatusOf(id),
            // Busy counts as not ready: a menu built while a run is in flight greys the
            // row rather than offering a press that can only be refused.
            ready: () => !fc.narrateBusy && fc.narration.framesWithNotes() > 0,
            reason: () =>
              fc.narrateBusy
                ? t('A narration run is already going.')
                : t('No slide has speaker notes yet.'),
          },
        }
      : {}),
    fonts: {
      options: () => fontOptions.map((o) => [o.value, o.label] as [string, string]),
      weights: (font: string) =>
        fc.helpers.weightChoicesFor(font).map(([v, l]) => [v, t(l)] as [string, string]),
    },
    fields: input.fields ?? [],
    activeFrameId: fc.document.activeArtboardId,
    // CLIENT px, like every other rect on this seam - see `queryRect`/`frameClientRect`
    // for why (a frames document's canvas overflows its nominal width, so any
    // native-from-nativeW scale is wrong by the pasteboard ratio).
    activeFrameRect: () => {
      const id = fc.document.activeArtboardId();
      if (!id) return null;
      const boxes = fc.select.getBoxes();
      const r = fc.document.frameClientRect(boxes.find((b, i) => fc.select.idOf(b, i) === id));
      return r ? { x: r.left, y: r.top, w: r.width, h: r.height } : null;
    },
    contentRect: () => fc.document.queryRect('content'),
    selectionRect: () => fc.document.queryRect('selection'),
    openLollyMenu: (anchor) => {
      // Claim the anchor BEFORE the rows are built: four of them open a panel that
      // positions itself under it, and `anchorEl()` is how they find out which control
      // was actually clicked rather than docking to the rail button on the far left.
      if (anchor) fc.select.setLollyAnchor(anchor);
      const items = fc.lollyMenuItems?.() ?? [];
      if (items.length && anchor) fc.menus.spawnPopover(anchor, items);
    },
    toggleTimeline: fc.timeline.toggleTimeline,
    isTimelineOpen: () => !!fc.timelinePanel?.isOpen(),
    toggleFramesPanel: () => fc.document.toggleFramesPanel(),
    isFramesPanelOpen: fc.document.isFramesPanelOpen,
    setColumnWidths: fc.rail.setColumnWidths,
    setInspector: fc.contextBar.setInspector,
  }; fc.designPorts = designPorts;

  return {
    design: designPorts,
    destroy() {
      fc.disposed = true;
      // FIRST, so nothing that throws later in this teardown can leave the stage's
      // bottom band reserved for a panel that no longer exists.
      fc.timeline.destroyTimeline();
      // …and the same promise for the SIDE bands: a leaked left/right reserve
      // permanently narrows the stage for every other tool mounted in this session.
      fc.rail.setColumnWidths(0, 0);
      fc.textEdit.finishEdit();
      if (fc.flashTimer) clearTimeout(fc.flashTimer);
      stageEl.removeEventListener('pointerdown', fc.gestures.onStageTouchDown, true);
      stageEl.removeEventListener('pointermove', fc.gestures.onStageTouchMove, true);
      stageEl.removeEventListener('pointerup', fc.gestures.onStageTouchUp, true);
      stageEl.removeEventListener('pointercancel', fc.gestures.onStageTouchUp, true);
      canvasEl.removeEventListener('pointerdown', fc.gestures.onCanvasPointerDown);
      stageEl.removeEventListener('pointerdown', fc.gestures.onBackdropPointerDown);
      viewEl.removeEventListener('pointerdown', fc.gestures.onBackdropPointerDown);
      stageEl.removeEventListener('contextmenu', fc.gestures.onBackdropContextMenu);
      viewEl.removeEventListener('contextmenu', fc.gestures.onBackdropContextMenu);
      window.removeEventListener('keydown', fc.gestures.onSpaceKey);
      window.removeEventListener('keyup', fc.gestures.onSpaceKey);
      canvasEl.removeEventListener('pointermove', fc.gestures.onGestureMove);
      canvasEl.removeEventListener('pointerup', fc.gestures.onGestureEnd);
      canvasEl.removeEventListener('pointercancel', fc.gestures.onGestureEnd);
      canvasEl.removeEventListener('dblclick', fc.gestures.onDblClick);
      canvasEl.removeEventListener('contextmenu', fc.menus.onContextMenu);
      canvasEl.removeEventListener('focusin', fc.keys.onBoxFocus);
      window.removeEventListener('keydown', fc.keys.onKey);
      toolbar.removeEventListener('pointerdown', fc.rail.onRailDown);
      toolbar.removeEventListener('pointermove', fc.rail.onRailMove);
      toolbar.removeEventListener('pointerup', fc.rail.onRailUp);
      toolbar.removeEventListener('pointercancel', fc.rail.onRailUp);
      toolbar.removeEventListener('lostpointercapture', fc.rail.onRailUp);
      wobble.dispose();
      if (fc.railRaf) {
        cancelAnimationFrame(fc.railRaf);
        fc.railRaf = 0;
      }
      document.removeEventListener('paste', fc.textEdit.onGlobalPaste);
      document.removeEventListener('copy', fc.modes.onCopy);
      document.removeEventListener('cut', fc.modes.onCut);
      stageEl.removeEventListener('pointermove', fc.keys.onStagePointerMove);
      stageEl.removeEventListener('wheel', fc.keys.onStageMove);
      stageEl.removeEventListener('transitionend', fc.keys.onStageTransitionEnd);
      canvasEl.removeEventListener('wheel', fc.contextBar.onCameraWheel as EventListener);
      if (fc.dollyTimer) {
        clearTimeout(fc.dollyTimer);
        fc.dollyTimer = null;
      }
      window.removeEventListener('resize', fc.keys.onStageMove);
      document.removeEventListener('pointerdown', fc.keys.onDocDown, true);
      document.removeEventListener('keydown', fc.keys.onPreviewKey);
      fc.keys.chromeRoot()?.classList.remove('is-chrome-hidden'); // never leave the next mount chromeless
      ro.disconnect();
      mo.disconnect();
      fc.poseMo?.disconnect();
      fc.dirtyObserver?.disconnect();
      unsub?.();
      canvasEl.classList.remove('fc-open-canvas');
      stageEl.classList.remove('fc-penning', 'fc-node-editing');
      // Take the rail back from whichever panel is holding it BEFORE the dock goes: while
      // the navigator has it, the buttons live in that column, and removing an empty dock
      // would leave them behind in a node this handle no longer owns.
      fc.tlWantsRail = fc.navWantsRail = false;
      fc.rail.applyRailMode();
      fc.authoringGuides?.destroy();
      fc.authoringGuides = null;
      overlay.remove();
      toolbarDock.remove();
      fc.toolbox.closePopover();
      fc.document.closeMorePanel();
      fc.edges.closeEdgePanel();
      fc.shortcutsModal?.close();
      document.body.classList.remove('fc-manipulating');
    },
    uiState() {
      // The wire field names (docs/url-mode.md `_ui`): what a link to this exact view
      // would carry. Panel detection is the picker's own root class - no second flag
      // to keep in step with askChoreograph's open/close.
      const st: { sel: string[]; t?: number; panel?: string } = { sel: [...fc.selection] };
      if (fc.timelinePanel?.isOpen()) st.t = fc.timelinePanel.time();
      if (document.querySelector('.fc-choreo-panel')) st.panel = 'choreograph';
      return st;
    },
    applyUi(state: DeepLinkState) {
      fc.editorState.applyEditorState(state);
    },
  };
}
