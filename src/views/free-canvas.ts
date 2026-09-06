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

import {
  boxRect,
  withRect,
  boxCorners,
  rectCentre,
  boxAABB,
  moveBoxes,
  resizeRect,
  alignBoxes,
  distributeBoxes,
  reorderZ,
  seedBox,
  normDragRect,
  snapAngle,
  normAngle,
  clampBoxToCanvas,
  selectionAABB,
  snapMove,
  snapPoint,
  scaleGroup,
  rotateGroup,
  num,
  edgeWaypoints,
  edgeNested,
  roundedEdgePath,
  smoothEdgePath,
  edgeArrowHead,
  edgeHeadInset,
  isEdgePoint,
  edgeEndRect,
  // plan 96 P3/P5 - a BOUND path is drawn by connector management, through the engine's
  // ONE routed-line renderer and its ONE kind→route mapping, so the live overlay, the
  // committed render and a headless CLI cannot disagree about where the line goes.
  routedLineSvg,
  pathRouteStyle,
  formatEdgePoint,
  gradientLine,
  gradientPosAt,
  gradientAngleAt,
  resolveFrame,
  sequenceFramesInOrder,
  framesAreSequenced,
  parseDashArray,
  formatDashArray,
  pathEndPoints,
  pathEndTangents,
  // Lift layers (plans/104 section 7): the pure box synthesis. The ENUMERATION is the
  // engine's (`enumerateSvgLayers`) and is fetched lazily with the dialog, because a
  // tag scanner has no business in the chunk of every editor that never lifts.
  isSvgImageRef,
  liftRows,
  applyLift,
  liftCanCrop,
  liftCropScale,
  LIFT_STRENGTH,
  layoutArtboards,
  // plans/104 section 6.5 - the chrome's half of "the canvas edits what the canvas shows":
  // a box the playhead has posed gets its outline and handles placed at the POSE.
  posedRect,
  // plans/179 section 5.2 - artboard housekeeping: which board is ACTIVE (A1/A11), what
  // happens to the children of a deleted one (A7), a deep duplicate (A8), the explicit
  // page `order` every creating/deleting path now writes (A9), and the marquee's
  // fully-enclosed rule for pages (A13).
  activeFrameIdFor,
  framesInPageOrder,
  nextFrameOrder,
  seedFrameOrders,
  renumberFrameOrder,
  rehomeChildrenOfDeletedFrames,
  duplicateFrameWithChildren,
  filterMarqueeFrames,
} from './free-canvas-math.ts';
import type {
  ZOp,
  AlignEdge,
  Axis,
  AABB as MathAABB,
  Rect as MathRect,
  EdgeRect,
  Box,
  SeqPose,
  FrameFields,
} from './free-canvas-math.ts';
// Phase-A spatial-index pick: grid-accelerated on large docs, identical result to the
// linear hitTest/marqueeHit on small ones (plans/98 section 6.1; proven in canvas-scene.test.ts).
import { pickTopmost, pickMarquee } from './canvas-scene.ts';
// plans/179 M1-C / M2 / M3: the ports the Design chrome (top bar, navigator, inspector)
// talks to this overlay through. Type-only - `design-ports.ts` is a contract file with
// no runtime, so importing it costs nothing in the editor chunk.
import type {
  ArtboardPort,
  CanvasRect,
  DesignCanvasPorts,
  DesignChromeOpts,
  FramePort,
  InspectorActions,
  ModelPort,
  NarrationStatus,
  NavigatorActions,
  SelectionPort,
} from './design-ports.ts';
// plans/180 M-A: the PURE half of notes-to-voice - the field map, the status read and
// the frame walk. Everything that downloads a model or writes a clip is behind the
// lazy import in `narrateDeck` below, so this costs the editor chunk a few hundred bytes.
import {
  DESIGN_NARRATION_FIELDS,
  narrationFrames as narrationFramesOf,
  narrationStatusFor,
  reanchorNarration,
  type NarrationFields,
  type NarrationTiming,
} from '../lib/narration.ts';
// plans/179 M3 (a): the pure row builders these panels used to keep private copies of.
// One implementation, shared with the inspector column - see the module header for why
// `wireSegs`'s `onSet` is required rather than defaulted to a `setField` closure.
import {
  dimsCell,
  frameThumb,
  iconRow,
  opt,
  posGridHtml,
  segHtml,
  segRow,
  shadowChoicesFrom,
  shapeChoicesFrom,
  tiltRow,
  wireSegs,
} from './free-canvas-fields.ts';
import {
  toCssPx,
  parseColor,
  colorToHexString,
  interpolateColor,
  parseGradientSpec,
  formatGradientSpec,
  gradientSpecToCss,
  MAX_GRADIENT_STOPS,
} from '@lolly/engine';
import type { GradientSpec } from '@lolly/engine';
import type {
  BooleanOpName,
  VectorFieldConfig,
  VectorOpFailure,
  VectorOpResult,
} from './vector-ops.ts';
import {
  booleanBoxes,
  boxOutlineKind,
  offsetBoxes,
  pathToBox,
  replaceBoxes,
  simplifyBoxes,
  strokeBoxesToPath,
} from './vector-ops.ts';
import type {
  AuthoredPath,
  Continuity,
  Cubic,
  HyperbezierSolution,
  SplineKind,
  SplineNode,
} from '@lolly/engine';
import type { PenFrame } from './free-canvas-pen.ts';
import type { OutlineGroup } from './outline-text.ts';
import {
  PEN_DEFAULT_KIND,
  PEN_KINDS,
  alignPoints,
  closesOnClick,
  convertKind,
  decodePathContours,
  defaultContinuity,
  deleteNodes,
  denormNodes,
  distributePoints,
  dragHandle,
  encodePathField,
  encodePathFields,
  frameToLocal,
  handlePoint,
  insertNodeOnCurve,
  kindReadsHandles,
  localToFrame,
  lowerAuthored,
  type InsertResult,
  type NodeAlignEdge,
  type PenPointRef,
  moveNodes,
  nearestOnPath,
  nodeAt,
  normNodes,
  pathPaintIsVisible,
  pathPaintSeed,
  penCommitFromNative,
  penFrame,
  pickPathPaint,
  pullHandles,
  refitFrame,
  resolveDrawnInk,
  setNodeContinuity,
} from './free-canvas-pen.ts';
import type { PathPaintFields } from './free-canvas-pen.ts';
// Type-only (erased at build): the timeline modules are LAZY - importing their types
// costs no chunk, and timeline-panel.ts pulls in styles/parts/timeline.css.
import type { TimeCfg } from './timeline-math.ts';
import type { TimelinePanel } from './timeline-panel.ts';
// Type-only, same terms: the showcase generator is a LAZY chunk too (it pulls
// timeline-math and the engine's keyframe module), so only its vocabulary is named here.
import type { ChoreoOrder, ShowcaseId } from './choreograph.ts';
// Type-only: the ghost layer is a lazy chunk that only an editor with onion skin turned
// ON ever fetches, so its runtime import lives inside onionFrom's dynamic `import()`.
import type { OnionPaintState, OnionSkinHandle } from './onion-skin.ts';
// Type-only, same terms: the motion-path layer (plans/104 section 8) is a lazy chunk that only
// an editor with a KEYFRAMED box selected ever fetches - and it pulls timeline-math (and
// therefore the engine's keyframe module) with it, which is exactly why it must not be a
// static import here.
import type { MotionPathHandle } from './motion-path.ts';
import type { MatteHost, MatteSource } from './matte-dialog.ts';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { InputValue } from '../../../../engine/src/inputs.ts';
import { takePendingDesignImport } from '../lib/drop-router.ts';
// The boot-path slice of user-fonts (NOT ../user-fonts.ts, which would drag the
// whole Google-font fetcher into this view chunk - see user-fonts.ts:73-80).
import { brandFontFamilies } from '../lib/register-user-fonts.ts';
import { LOLLY_MARK_SVG } from '../lib/lolly-mark.ts';
import { ensureRowIds, ulid } from '../lib/row-id.ts';
import { mountCssEditor } from '../lib/css-code-editor.ts';
import { announce } from '../a11y.ts';
import { prefersReducedMotion } from '../lib/a11y-prefs.ts';
import { escape } from '../utils.ts';
import { deepActiveElement, isTypingTarget } from '../lib/typing-target.ts';
import { BLEND_STYLES, HUE_ROUTES, isPolarSpace } from '../lib/blend-style.ts';
import { attachWobble } from '../lib/wobble.ts';
import { t, tRaw } from '../i18n.ts';
import { openDesignShortcuts } from './design-shortcuts.ts';
import { mountDesignGuides, type DesignGuidesHandle } from './design-guides.ts';
import {
  applyDesignStyle,
  captureDesignStyle,
  type DesignStyleSnapshot,
} from './design-style-clipboard.ts';
import type { ColorFieldValue } from '../components/color-field.ts';
import {
  colorFieldHtml,
  wireColorField,
  resolveColorVar,
  colorVarLabel,
} from '../components/color-field.ts';
// The app-wide "black or white, whichever reads on this" rule (see its own doc comment) -
// deliberately the same one the chrome accent and every colour surface flip with.
import { contrastText } from '../brand-vars.ts';
import {
  charsFromDom,
  htmlFromChars,
  markdownFromChars,
  rangeHasFlag,
  setFlag,
  setColor,
  rangeColor,
  wordRangeAt,
  allBulleted,
  toggleBullets,
  setWeight,
  rangeWeight,
  allNumbered,
  toggleNumbers,
  clearFormatting,
} from './rich-text.ts';

import { SVG, icon } from './free-canvas-icons.ts';
// ── local types ───────────────────────────────────────────────────────────────
// `Box` (a flat per-tool record, field names configured via cfg.*Field) is imported from
// free-canvas-math.ts so the overlay and the pure geometry share one honest type
// (`{ [key: string]: InputValue | undefined }`).
interface Point {
  x: number;
  y: number;
}
interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  rot?: number;
}
interface AABB {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  w?: number;
  h?: number;
}
interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}
interface Canvas {
  w: number;
  h: number;
}
interface Metrics {
  cr: DOMRect;
  sr: DOMRect;
  scale: number;
}
type HandleName = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
type Corner = 'nw' | 'ne' | 'se' | 'sw';

/** One entry of a `canvas.addKinds` list - a "kind" the add-box menu can create. */
interface AddKind {
  id: string;
  label?: string;
  seed?: Box;
}

/** The subset of a blocks-field declaration the editor reads: the font select's
 *  declared options drive the typography menus, so the editor writes exactly the
 *  wire values the tool's hooks.js understands (e.g. 'SUSE'/'SUSE Mono' on the
 *  SUSE profile, 'sans'/'mono' on lolly-start). */
interface BlockFieldDef {
  id: string;
  default?: unknown;
  options?: Array<{ value?: unknown; label?: string }>;
}
interface FontOption {
  value: string;
  label: string;
}

/** The free-form per-tool `canvas` schema block (from the manifest). */
interface CanvasCfg {
  idField?: string;
  xField?: string;
  yField?: string;
  wField?: string;
  hField?: string;
  rotationField?: string;
  fillField?: string;
  gradField?: string;
  opacityField?: string;
  shapeField?: string;
  radiusField?: string;
  imageField?: string;
  fitField?: string;
  imgPosField?: string;
  blendField?: string;
  textField?: string;
  textColorField?: string;
  fontSizeField?: string;
  alignField?: string;
  valignField?: string;
  weightField?: string;
  fontField?: string;
  lineHeightField?: string;
  trackingField?: string;
  ligaturesField?: string;
  alternatesField?: string;
  padField?: string;
  fitTextField?: string;
  groupField?: string;
  clipField?: string;
  shadowField?: string;
  shadowColorField?: string;
  shadowXField?: string;
  shadowYField?: string;
  shadowBlurField?: string;
  /** Vector sub-fields (the `boxes` fields Stage C appends: an authored path plus its
   *  stroke paint and fill rule). `pathField` is the FEATURE FLAG for the whole
   *  vector-operations section of the context menu - a tool that declares no path
   *  sub-field has nowhere to put a boolean result, so it is not offered one. Every
   *  entry degrades to "absent", never to "throws", on a manifest that predates them. */
  pathField?: string;
  strokeField?: string;
  strokeWField?: string;
  fillRuleField?: string;
  /** Stroke DECORATION sub-fields (appended after the timeline block): a dash-style
   *  keyword plus the line cap and join. Keywords, not authored dash arrays - see the
   *  hook's `dashArrayFor` for why the compact URL form cannot carry a comma. */
  strokeDashField?: string;
  strokeCapField?: string;
  strokeJoinField?: string;
  /** Power-user dash sub-fields (plan 96 P0). `strokeDashArrayField` holds the AUTHORED
   *  pattern as a SPACE-separated numeric string ("6 4") - a string, not a list, because a
   *  block sub-field is one scalar and space is the one separator the compact blocks URL
   *  survives (see lib/blocks-url.ts; a comma would split the row). It WINS over the
   *  keyword style when set. `dashFitField` is the boolean "fit the pattern to the path's
   *  corners" (Illustrator's corner-aligned dashes), applied by the tool's hook. */
  strokeDashArrayField?: string;
  dashFitField?: string;
  /** PATH DECORATION sub-fields (plan 96 P0 - the unified path primitive). An arrowhead
   *  shape at each end of an authored path, drawn at its end tangents: none · triangle ·
   *  open · circle · diamond · bar, the same vocabulary the connector heads use, because
   *  a spline, a line and a connector are one primitive that carries one decoration set. */
  headStartField?: string;
  headEndField?: string;
  /** PATH ENDPOINT BINDING (plan 96 P0). The id of the box each end is attached to, `''`
   *  for a free end. Model only at this stage: nothing reads them yet - P3 adds the bind
   *  gesture and hands a bound path to connector routing. Declared now so the fields ship
   *  in the manifests' wire order before anything depends on them. */
  bindStartField?: string;
  bindEndField?: string;
  /** PATH ROUTE OVERRIDE (plan 96 P3). A bound path's route is normally read off its own
   *  spline kind; six kinds cannot name the engine's thirteen routes, so this field carries
   *  the explicit one (elbow-src, curved-v, arc-wide …). '' = auto. It is also what makes
   *  the plan-90 edge migration lossless. */
  routeField?: string;
  /** The class the tool's hook puts on its committed BOUND-PATH `<svg>` (plan 96 P5) -
   *  hidden for the duration of a drag so the live overlay does not double up with the
   *  stale committed one. Named here for the same reason `canvas.connect.layerClass` was:
   *  only the manifest knows what its own hook emits. */
  pathLayerClass?: string;
  /** Timeline time-model sub-fields (phase 1: schema/manifest only - inert until a
   *  timeline panel mounts and reads them; see engine 1.65.0 CHANGELOG entry). */
  startField?: string;
  durField?: string;
  clipInField?: string;
  speedField?: string;
  enterField?: string;
  exitField?: string;
  enterMsField?: string;
  exitMsField?: string;
  muteField?: string;
  laneField?: string;
  /** OPTIONAL time sub-field: the A/V link (detached audio). Absent on a tool that does
   *  not offer detach - the ten-field time check below does NOT include it. */
  linkField?: string;
  gainField?: string;
  panField?: string;
  duckField?: string;
  pitchField?: string;
  varispeedField?: string;
  fxField?: string;
  /** OPTIONAL: the reversible-cut / strikethrough flag (plans/174). Machine-written
   *  by the Transcript panel; a tool without it never offers strikethrough. */
  ignoredField?: string;
  /** OPTIONAL: the user's own clip name (timeline rename). Editor metadata only -
   *  nothing renders it; the panel's labelFor prefers it over the derived label. */
  labelField?: string;
  /** OPTIONAL time sub-fields: the authored geometry curve for each preset. Absent
   *  leaves every preset on its built-in curve, so they sit outside that same check. */
  enterEaseField?: string;
  exitEaseField?: string;
  /** OPTIONAL, same terms (plans/175 WP-A): split-text animation - tier, unit gap
   *  (ms) and dealt order. Absent means no text-animation rows anywhere. */
  splitField?: string;
  staggerField?: string;
  splitOrderField?: string;
  /** OPTIONAL, same terms (plans/175 WP-B): the while-on-screen hold effect and
   *  its rate. Absent means no hold rows anywhere. */
  holdField?: string;
  holdRateField?: string;
  /** OPTIONAL, same terms: the box's KEYFRAME TRACK (plans/104 section 5.1). Absent means the
   *  tool is not keyframable - and, in `timeline-math`, that a split/trim/join has no
   *  track to rebase. */
  kfField?: string;
  /** OPTIONAL, same terms: the box's DEPTH (plans/104 section 5.3, px above the surface).
   *  Not a timing field - named alongside them because a keyframe's `z` channel
   *  replaces it for its segment, so every writer that carries one carries the other. */
  zField?: string;
  /** OPTIONAL, same terms: the box's own TILT in degrees - pitch and yaw about its own
   *  centre (plans/104 P2.1). Named here beside `zField` rather than on FieldCfg for
   *  `zField`'s stated reason, and for its second reason too: a keyframe's `rx`/`ry`
   *  channel replaces the field for its segment, so a writer that carries one carries
   *  all three. Absent means the tool has no tilt to offer, and the More panel's
   *  "Perspective tilt" rows are simply not drawn. */
  rxField?: string;
  ryField?: string;
  minSize?: number;
  addKinds?: AddKind[];
  import?: unknown;
  /** Opt-in: a SECOND blocks input holding connector edges between boxes, plus a
   *  "Connect" rail mode to author them (click a source card, then targets). The
   *  overlay only reads/writes this array + draws a live preview; the tool's hooks.js
   *  turns {from,to} into the actual routed lines. Absent for Design / Carousel,
   *  so their toolbars are unchanged. */
  connect?: ConnectCfg;
  /** Opt-in: snap box positions to a fixed grid (with a rail toggle). */
  grid?: { size?: number; default?: boolean };
  /** Opt-in: the canvas is a fixed size (no resize control). Connector tools set this
   *  so the connector <svg>'s viewBox stays 1:1 with box coordinates. */
  fixedCanvas?: boolean;
}

/**
 * The tool the rail says is live. One value, so entering a tool IS leaving every other one.
 *
 * These four are the modes that change what a canvas press MEANS. Point editing is not one
 * of them (it is a sub-state of `'select'`, like a live text edit), and neither is the
 * timeline: the docked panel is a second surface alongside the canvas, not a different
 * reading of a canvas press, so it stays a plain toggle and outlives any tool change.
 */
type EditorMode = 'select' | 'create' | 'pen' | 'line';

/** `canvas.connect` - how the editor authors + stores connector edges. */
interface ConnectCfg {
  input: string; // input id of the connectors blocks array
  fromField?: string; // edge field holding the source box id (default 'from')
  toField?: string; // edge field holding the target box id (default 'to')
  styleField?: string;
  arrowField?: string;
  headField?: string; // edge field for the arrowhead SHAPE (triangle/open/circle/diamond/bar)
  colorField?: string;
  dashField?: string;
  widthField?: string;
  layerClass?: string; // class of the tool's rendered connector <svg> (hidden mid-drag)
  defaultStyle?: string;
  defaultArrow?: string;
  defaultHead?: string;
  defaultColor?: string;
  defaultWidth?: number;
}

/** The resolved field-name config this module drives the DOM/model with. Fields the
 *  manifest may omit are typed as string but can be `undefined` at runtime; every
 *  read/write is guarded (setField no-ops on a falsy field), so this stays faithful. */
interface FieldCfg {
  idField: string;
  xField: string;
  yField: string;
  wField: string;
  hField: string;
  rotationField: string;
  fillField: string;
  gradField: string;
  opacityField: string;
  shapeField: string;
  radiusField: string;
  imageField: string;
  fitField: string;
  imgPosField: string;
  blendField: string;
  textField: string;
  textColorField: string;
  fontSizeField: string;
  alignField: string;
  valignField: string;
  weightField: string;
  fontField: string;
  lineHeightField: string;
  trackingField: string;
  ligaturesField: string;
  alternatesField: string;
  padField: string;
  fitTextField: string;
  groupField: string;
  clipField: string;
  shadowField: string;
  shadowColorField: string;
  shadowXField: string;
  shadowYField: string;
  shadowBlurField: string;
  kindField: string;
  pathField: string;
  strokeField: string;
  strokeWField: string;
  fillRuleField: string;
  strokeDashField: string;
  strokeCapField: string;
  strokeJoinField: string;
  strokeDashArrayField: string;
  dashFitField: string;
  headStartField: string;
  headEndField: string;
  bindStartField: string;
  bindEndField: string;
  routeField: string;
}

interface ModelItem {
  id: string;
  value: any;
}
interface RuntimeApi {
  getModel(): ModelItem[];
  setInput(id: string, value: any): void;
  subscribe(fn: () => void): (() => void) | void;
}
interface HostApi {
  assets?: { pick(opts: any): Promise<any> };
  /** Feature-detected (plan 96): the engine's dash-fit primitives, once the running
   *  engine carries them. `parse` is the AUTHORITY on what the Dash array field accepts,
   *  so the panel prefers it and falls back to free-canvas-math's own `parseDashArray`
   *  (the same contract) on an engine that predates it. */
  connectors?: { dashFit?: { parse?(text: string): number[] | null } };
}
interface DocInfo {
  getFilename?(): string;
  setFilename?(name: string): void;
  lastEdited?(): string | Promise<string> | null | undefined;
  /** The tool's manifest id. Read by the import panel's templates pass, which
   *  mints saved sessions that must resume into THIS tool. */
  id?: string;
  name?: string;
  version?: string;
  status?: string;
  formats?: string[];
  // Export provenance: a READ-ONLY view of the name/contact that gets baked into an
  // export's file metadata, plus an opt in/out toggle. The fields themselves are
  // edited in the profile (editHref) - never here.
  provenance?: {
    editHref?: string;
    get(): Promise<{ optedIn: boolean; author: string; contact: string }>;
    setOptIn(on: boolean): Promise<void>;
  };
}
interface HistoryApi {
  undo(): void;
  redo(): void;
  register(cb: (canUndo: boolean, canRedo: boolean) => void): void;
}

/**
 * One-shot EDITOR state a link can carry (docs/url-mode.md "On a tool route"): the
 * `_ui` object param and its `_sel` / `_t` / `_panel` shorthands (lib/editor-state.ts),
 * read once at mount and reapplied at runtime through the handle's `applyUi`. Editor state, never document
 * state - nothing here is written back to the model, and syncUrl drops the params on
 * the first edit. What it buys: a link that opens on a picture (a docs screenshot, a
 * bug report, "look at this frame") without a script of clicks to get there.
 */
export interface DeepLinkState {
  /** Box ids to select; unknown ids are ignored. */
  select?: string[];
  /** Playhead position in seconds - opens the timeline and parks the playhead there. */
  playhead?: number;
  /** A panel to open over the selection: `choreograph` today. */
  panel?: string;
}

interface InitFreeCanvasOpts {
  viewEl: HTMLElement;
  stageEl: HTMLElement;
  canvasEl: HTMLElement;
  runtime: RuntimeApi;
  deepLink?: DeepLinkState;
  host: HostApi;
  input: { id: string; canvas?: CanvasCfg; fields?: BlockFieldDef[] };
  nativeW: number;
  nativeH: number;
  onDirty?(id: string): void;
  editTool?(url: string, mode?: string): Promise<any>;
  setCanvasSize?(w: number, h: number, unit?: string): void;
  /** Keeps Design's persisted document unit/DPI and the export bar in lockstep. */
  setDocumentSettings?(settings: {
    unit: string;
    dpi: number;
    width?: number;
    height?: number;
  }): void;
  info?: DocInfo;
  history?: HistoryApi;
  actions?: ToolbarActions;
  /** Multi-page ("carousel") mode. When present, the box array spans a horizontal
   *  strip of N same-size page frames (each rendered as a `[data-pdf-page]` by the
   *  tool). Box coords stay GLOBAL across the strip; the overlay only needs to (a)
   *  translate a box's on-screen position by its frame's DOM offset during a live
   *  gesture, (b) un-clip frames mid-drag, and (c) expose a page-count + page-size
   *  control on the rail. Values name the number-input ids the geometry is read
   *  from / written to via runtime. Absent for single-page editors (Design). */
  pages?: PagesCfg;
  /**
   * Chrome the TOOL VIEW owns and lends back (plans/179 M1). Its presence is also the
   * signal that a Design top bar is mounted: the mark menu then drops every row the bar
   * now carries (Export, Save, Copy, Share, Undo, Redo, Slide transition, Present) and
   * grows the ones only a menu can hold (Theme, Interface sounds). Absent - Org Chart and
   * every other editor tool with no top bar - the menu is byte-identical to today's.
   */
  chrome?: DesignChromeOpts;
  /** Frame-primitive mode (plan 93 F1b). When present, the box array may include
   *  `kind === frameKind` boxes that render as free-placed `[data-pdf-page]` pages
   *  (the tool's hook emits them at authored x/y). The overlay then (a) drives live
   *  gestures in frame-local space via each frame's DOM offset - the same math the
   *  carousel uses, and (b) re-buckets a moved/created/resized box into the frame its
   *  centre lands in, on drop. Absent for tools whose canvas declares no `frameField`,
   *  so every frame-aware path below is dead for them (no-frames byte-identity). */
  frame?: FrameCfg;
}

interface PagesCfg {
  countField: string; // input id: page count
  widthField: string; // input id: page width (px)
  heightField: string; // input id: page height (px)
  min: number;
  max: number;
}

/** `canvas.frameField`/… - the frame-primitive field names (plan 93). `frameKind`
 *  is the `kind` value that marks a box as a page container; `frameField` is where a
 *  member box stores its owning frame id. order/clip are read by the hook, not yet by
 *  the overlay (cascade + clip toggles are later F1b slices). */
interface FrameCfg {
  frameField: string;
  frameKind: string;
  orderField?: string;
  clipChildrenField?: string;
  /** `canvas.frameTransitionField` - the FRAME sub-field holding this slide's own
   *  transition to the next one (plans/179 M4). Absent = every slide uses the
   *  document's, and "Place in order" derives nothing per frame. */
  transitionField?: string;
  /** `canvas.hiddenField` - the boolean sub-field marking a layer HIDDEN. The tool's
   *  hook already leaves a hidden row out of the render; this name is what lets the
   *  overlay keep it out of the model paths too (nothing to pick, nothing to snap to). */
  hiddenField?: string;
  /** `canvas.lockedField` - the boolean sub-field marking a layer LOCKED: it draws
   *  exactly as before, but no pointer gesture may acquire it. Absent = no lock. */
  lockedField?: string;
}

/** Primary tool actions surfaced as prominent icons in the editor rail (chromeless
 *  layout has no bottom pill). Callbacks delegate to the tool's existing handlers. */
interface ToolbarActions {
  export(): void;
  save(): void;
  copy(): void;
  share(): void;
  /** Open the frames as a fullscreen deck (plan 112); absent = not a frame tool. The
   *  optional id starts the deck ON that artboard (plans/179 M2's "Present from here"). */
  present?(atFrameId?: string): void;
  newFromTemplate?(): void; // re-open the Start template chooser mid-session (plans/142 WP-1); absent = tool has no templates
  bulk?(): void; // hand this template to /batch (plans/147 M1); absent = the batch can't run this tool
  canSave?: boolean; // omit the Save icon for tools that don't persist a session
  dirtyRef?: HTMLElement | null; // element whose `is-unsaved` class the Save icon mirrors
}

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

interface EditingState {
  id: string;
  el: HTMLElement;
  boxEl: HTMLElement | null;
  prevHtml: string;
  prevStyle: string;
  prevBoxStyle: string;
  pending: Record<string, any>;
  colorRange?: [number, number];
  weightRange?: [number, number];
}

interface FmtRefs {
  align: Record<string, HTMLButtonElement>;
  valign: Record<string, HTMLButtonElement>;
  font?: HTMLSelectElement;
  weight?: HTMLSelectElement;
  clear?: HTMLButtonElement;
  b?: HTMLButtonElement;
  i?: HTMLButtonElement;
  bullet?: HTMLButtonElement;
  numbers?: HTMLButtonElement;
  lig?: HTMLButtonElement;
  alt?: HTMLButtonElement;
  emoji?: HTMLButtonElement;
}
type FmtBar = HTMLDivElement & { _refs?: FmtRefs };

// Popover item shapes (separator / icon-grid / action row).
interface PopGridItem {
  label: string;
  icon?: string;
  run(): void;
  disabled?: boolean;
  danger?: boolean;
  keepOpen?: boolean;
}
interface PopSep {
  sep: true;
  grid?: undefined;
}
interface PopGrid {
  sep?: undefined;
  grid: PopGridItem[];
  cols?: number;
}
// `key` tags the rendered row with `data-pop="<key>"` so a long-lived menu can be
// refreshed in place - the undo/redo pair stays open while you step back, and its
// enabled state has to follow the history stack rather than the moment it opened.
// `on` makes a row a RADIO rather than a command - set it (even to false) and the row
// reports `aria-checked` and paints its current state. Used by the pen's spline-type menu,
// where the point of opening it is to see which type you are already on.
interface PopAction {
  sep?: undefined;
  grid?: undefined;
  label: string;
  icon?: string;
  run(): void;
  disabled?: boolean;
  danger?: boolean;
  keepOpen?: boolean;
  key?: string;
  on?: boolean;
}
type PopItem = PopSep | PopGrid | PopAction;

// Gesture state - filled in by beginGesture with pointerId/startClient.
interface GestureBase {
  pointerId: number;
  startClient: Point;
  origin?: Point;
}
interface TapGesture extends GestureBase {
  type: 'tap';
}
interface MarqueeGesture extends GestureBase {
  type: 'marquee';
  origin: Point;
  additive: boolean;
}
/**
 * CAMERA PAN (plans/104 section 8) - a drag on the EMPTY stage while a camera is selected and
 * running. It takes the gesture the marquee would otherwise have had, which is the
 * whole idea of "camera mode is entered by selection": there is no mode to turn on,
 * and clicking any box leaves it by ordinary selection semantics.
 *
 * `client` is the last pointer position in CLIENT px (what a pointer event carries);
 * `dx`/`dy` are the accumulated displacement in NATIVE px, converted through
 * `clientToNative` on every move exactly as every other drag in this canvas does. The
 * invariant is direct manipulation: the picture keeps up with the hand at any canvas
 * zoom, which needs a fixed MODEL displacement per SCREEN px - i.e. the client delta
 * divided by the zoom. Writing client px straight into the model instead made the same
 * drag move the shot half as far at 50 % and twice as far at 200 %.
 */
interface CamPanGesture extends GestureBase {
  type: 'campan';
  client: Point;
  dx: number;
  dy: number;
}
/**
 * The CAMERA TILT drag (plans/104 section 8, P2): shift + empty-stage drag, the chord section 8
 * reserved at M2.5 ("shift-drag reserved for tilt (P2)") and P2 finally spends.
 *
 * CLIENT px, and deliberately NOT native ones - the opposite of its `campan` sibling,
 * for the same reason that one converts. A pan writes a MODEL DISPLACEMENT, so it must
 * track the hand through the canvas zoom; a tilt writes an ANGLE, which has no length
 * in stage space at all. Converting here would make the same wrist movement turn the
 * camera four times as far at 25 % zoom as at 100 %, which is a dial whose gearing
 * depends on how far you happen to be zoomed out.
 */
interface CamTiltGesture extends GestureBase {
  type: 'camtilt';
  client: Point;
  dx: number;
  dy: number;
}
interface CreateGesture extends GestureBase {
  type: 'create';
  origin: Point;
  seed: Box;
  others: AABB[];
  corner?: Point;
}
// Line tool - one drag draws a TWO-NODE authored path (plan 96 P2; it made a connector
// edge under plan 90). Both ends are plain canvas points: a line is a path box like any
// pen shape, and attaching an end to a box is P3's bind gesture, not a side effect of
// releasing over one.
interface LineGesture extends GestureBase {
  type: 'line';
  origin: Point;
  to?: Point;
}
// `narrow` is plan 179 C4: a plain click on a member of a multi-selection means "just this
// one", but the very same press also starts the drag of the WHOLE selection - so the answer
// cannot be given until the pointer comes up without having moved. The ids under the click
// ride along until then; a real drag drops them untouched.
interface MoveGesture extends GestureBase {
  type: 'move';
  start: Map<number, Rect>;
  sel: number[];
  selAABB: AABB | null;
  others: AABB[];
  moveDelta?: { dx: number; dy: number };
  narrow?: string[];
}
interface ResizeGesture extends GestureBase {
  type: 'resize';
  index: number;
  handle: HandleName;
  startRect: Rect;
  others: AABB[];
  liveRect?: Rect;
}
interface RotateGesture extends GestureBase {
  type: 'rotate';
  index: number;
  startRect: Rect;
  centerClient: Point;
  pointerStartDeg: number;
  liveRect?: Rect;
}
interface GScaleGesture extends GestureBase {
  type: 'gscale';
  sel: number[];
  startBoxes: Box[];
  anchor: Point;
  origDist: number;
  liveBoxes?: Box[];
}
interface GRotateGesture extends GestureBase {
  type: 'grotate';
  sel: number[];
  startBoxes: Box[];
  centre: Point;
  centerClient: Point;
  pointerStartDeg: number;
  liveBoxes?: Box[];
}
// Pen tool (Stage D). Drawing is `pendraw` - one gesture per NODE, not one per path, since
// the path itself is a draft that outlives any single press (see `penDraft`). The other
// three belong to node-edit mode on an already-committed path box.
interface PenDrawGesture extends GestureBase {
  type: 'pendraw';
  origin: Point;
  index: number;
}
interface PenNodeGesture extends GestureBase {
  type: 'pennode';
  origin: Point;
  indices: number[];
  start: SplineNode[];
  moved?: boolean;
  /** plan 96 P3 - which END of the path is being dragged, when exactly one END node is.
   *  Set at press; drives the bind affordance during the drag and the write on drop. */
  bindEnd?: 'start' | 'end';
}
interface PenHandleGesture extends GestureBase {
  type: 'penhandle';
  origin: Point;
  index: number;
  which: 'in' | 'out';
  moved?: boolean;
}
interface PenMarqueeGesture extends GestureBase {
  type: 'penmarquee';
  origin: Point;
  additive: boolean;
}
/** One contour's slice of the combined node-edit path: how many nodes it owns, and the
 *  kind + closed flag to restore when the flat run is split back into real contours. */
interface PenPart {
  count: number;
  kind: SplineKind;
  closed: boolean;
}
type Gesture =
  | TapGesture
  | MarqueeGesture
  | CamPanGesture
  | CamTiltGesture
  | CreateGesture
  | MoveGesture
  | ResizeGesture
  | RotateGesture
  | GScaleGesture
  | GRotateGesture
  | PenDrawGesture
  | PenNodeGesture
  | PenHandleGesture
  | PenMarqueeGesture
  | LineGesture;
type FilledBaseFields = 'pointerId' | 'startClient';
type GestureInit =
  | Omit<TapGesture, FilledBaseFields>
  | Omit<MarqueeGesture, FilledBaseFields>
  | Omit<CamPanGesture, FilledBaseFields>
  | Omit<CamTiltGesture, FilledBaseFields>
  | Omit<CreateGesture, FilledBaseFields>
  | Omit<MoveGesture, FilledBaseFields>
  | Omit<ResizeGesture, FilledBaseFields>
  | Omit<RotateGesture, FilledBaseFields>
  | Omit<GScaleGesture, FilledBaseFields>
  | Omit<GRotateGesture, FilledBaseFields>
  | Omit<PenDrawGesture, FilledBaseFields>
  | Omit<PenNodeGesture, FilledBaseFields>
  | Omit<PenHandleGesture, FilledBaseFields>
  | Omit<PenMarqueeGesture, FilledBaseFields>
  | Omit<LineGesture, FilledBaseFields>;

const HANDLES: HandleName[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const SNAP_PX = 6;

// ── the floating rail's position ──────────────────────────────────────────────

/**
 * Where the detached tool rail may sit, in stage-relative px. Pure numbers so the
 * clamp is honestly testable without a browser - the caller does the measuring.
 *
 * `reserveBottom` is the band at the foot of the stage the rail must never cover
 * (the export pill, wherever a host still shows one). It comes off the TRAVEL range,
 * not off the stage, so a rail taller than the room that is left parks at the top
 * edge rather than at a negative offset.
 *
 * `reserveLeft` is the same promise on the other axis: the left band a docked column
 * holds (the Design navigator, plans/179 M2). The rail is `pointer-events: none` but
 * the toolbar inside it is not, so a rail parked over that column both hides its rows
 * and eats the clicks meant for them.
 */
export function clampRailPos(
  want: { left: number; top: number },
  rail: { w: number; h: number },
  stage: { w: number; h: number },
  o: { pad?: number; reserveBottom?: number; reserveLeft?: number } = {}
): { left: number; top: number } {
  const pad = o.pad ?? 8;
  // An unmeasurable stage (a not-yet-laid-out ResizeObserver delivery, a stage that has
  // gone display:none on navigation) must not be clamped against: every axis would
  // collapse to `pad` and the remembered position would be silently lost. Hand the
  // wanted position straight back - placePopover guards the same way.
  if (!(stage.w > 0) || !(stage.h > 0))
    return { left: Math.round(want.left), top: Math.round(want.top) };
  const minLeft = pad + Math.max(0, o.reserveLeft ?? 0);
  const maxLeft = Math.max(minLeft, stage.w - rail.w - pad);
  const maxTop = Math.max(pad, stage.h - rail.h - pad - Math.max(0, o.reserveBottom ?? 0));
  return {
    left: Math.round(Math.min(Math.max(want.left, minLeft), maxLeft)),
    top: Math.round(Math.min(Math.max(want.top, pad), maxTop)),
  };
}

/**
 * Where a rail/anchor popover goes, in stage-relative px. It prefers the anchor's
 * right (the docked rail's long-standing behaviour, unchanged while the rail sits on
 * the left edge) and FLIPS to its left when that would overflow the stage.
 *
 * The flip only started mattering when the rail became draggable: a rail parked in the
 * right half of a `overflow:hidden` stage (carousel-maker and record are `.is-paged`)
 * used to open its menu straight out through the clipped edge. Vertically the popover
 * is pulled up to keep its foot inside rather than being pinned to the anchor's top.
 *
 * Pure numbers, so the geometry is testable without a browser.
 */
export function placePopover(
  anchor: { left: number; right: number; top: number },
  pop: { w: number; h: number },
  stage: { w: number; h: number },
  gap = 8,
  pad = 6
): { left: number; top: number } {
  const rightSide = anchor.right + gap;
  const leftSide = anchor.left - gap - pop.w;
  // No measurable stage (detached / display:none / jsdom, which has no layout at all):
  // there is nothing to clamp against, so keep the plain anchored placement rather than
  // inventing a position from zeroes.
  if (!(stage.w > 0) || !(stage.h > 0)) return { left: rightSide, top: Math.max(pad, anchor.top) };
  // Flip only if the left side is genuinely better: on a stage too narrow for either,
  // stay on the preferred side and let the clamp do what it can.
  const left = rightSide + pop.w > stage.w - pad && leftSide >= pad ? leftSide : rightSide;
  const maxTop = Math.max(pad, stage.h - pop.h - pad);
  return {
    left: Math.round(Math.max(pad, Math.min(left, Math.max(pad, stage.w - pop.w - pad)))),
    top: Math.round(Math.min(Math.max(anchor.top, pad), maxTop)),
  };
}

// ── the contextual bar's position ─────────────────────────────────────────────

/** A stage-relative box, in stage px. */
interface StageBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** The top-chrome-row band the contextual bar is pinned into, in stage-relative px. */
export interface CtxTopBand {
  lo: number;
  hi: number;
  top: number;
}

/**
 * The free horizontal band on the top-chrome row where the contextual bar sits.
 *
 * The bar used to float ABOVE (or inside) the selection, which put it right over the very
 * artwork the user was looking at - the thing they were dragging or resizing. So it is
 * pinned to the TOP now, on the same line as the back pill (top-left) and the zoom HUD
 * (top-right): the band runs from the right edge of the left-corner chrome to the left
 * edge of the right-corner chrome, so all three read as one row at every width and none
 * can overlap another - the "layout harmony" the narrow mobile top row needs.
 *
 * `blockers` are that fixed chrome in stage coordinates, measured by the caller (so this
 * stays pure numbers and honestly testable without a browser - the same bargain
 * clampRailPos makes). A blocker whose centre is left of the stage centre bounds the band
 * on the left (the back pill); one to the right bounds it on the right (the zoom HUD). The
 * shared `top` aligns the bar with that chrome so the three sit on one line.
 *
 * The caller caps the bar to `hi - lo` and lets it scroll inside that width (see the
 * `.fc-ctxbar` overflow), so a bar too wide for the band - a phone - becomes a scrolling
 * strip on the row rather than a bar that drops down over the canvas.
 */
/**
 * The chrome elements that are actually in the way, in STAGE coordinates - the input
 * `ctxTopBand` bounds its band against.
 *
 * Two rules, and both of them were bugs:
 *   • ABOVE the stage is not in the way. In editor layout the back pill moves into the
 *     Design top bar, which sits over the stage's own reserved top band, so its rect is
 *     outside the stage box entirely and counting it narrowed the band to nothing on a
 *     narrow viewport. The bar's height is already handled by `--stage-reserve-top`.
 *   • an element that cannot be measured (hidden, detached, no layout) is not a blocker,
 *     because a zero box would otherwise clamp the band to the stage's left edge.
 *
 * Pure over the rects the caller hands in, so the left/right split is testable without a
 * browser - the same bargain `ctxTopBand` and `clampRailPos` make.
 */
export function stageBlockers(els: Array<HTMLElement | null | undefined>, sr: DOMRect): StageBox[] {
  const out: StageBox[] = [];
  for (const el of els) {
    if (!el || el.hidden || !el.getClientRects?.().length) continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    if (r.bottom <= sr.top) continue;
    out.push({
      left: r.left - sr.left,
      top: r.top - sr.top,
      right: r.right - sr.left,
      bottom: r.bottom - sr.top,
    });
  }
  return out;
}

export function ctxTopBand(
  stage: { w: number; h: number },
  blockers: StageBox[] = [],
  o: { pad?: number; gap?: number; reserve?: { top?: number; left?: number; right?: number } } = {}
): CtxTopBand {
  const pad = o.pad ?? 6;
  const gap = o.gap ?? 8;
  // The stage's reserved bands: the Design top bar across the top, the navigator on the
  // left, a right column. They are the row's EDGES, not chrome to align to - the bar
  // used to pin to y=6 under the top bar, which covered it whole (Andy, 2026-09-03:
  // "there is no way to edit the fill / colour of any object").
  const rt = Math.max(0, o.reserve?.top ?? 0);
  const rl = Math.max(0, o.reserve?.left ?? 0);
  const rr = Math.max(0, o.reserve?.right ?? 0);
  // An unmeasurable stage (display:none, a pre-layout ResizeObserver delivery, jsdom)
  // gives nothing to bound against - hand back a padded strip at the top rather than
  // inventing a band from zeroes, exactly as clampRailPos and placePopover do.
  if (!(stage.w > 0)) return { lo: pad, hi: pad, top: rt + pad };
  // Chrome standing wholly inside the top reserve (the top bar's own controls) is not
  // in this row at all.
  const live = blockers.filter((b) => b.right > b.left && b.bottom > b.top && b.bottom > rt);
  let lo = rl + pad;
  let hi = Math.max(lo, stage.w - rr - pad);
  // Align the bar's top with the chrome row (its topmost blocker); with no chrome to
  // align to, the plain pad below the top reserve.
  const top = live.length ? Math.max(rt + pad, Math.min(...live.map((b) => b.top))) : rt + pad;
  const cx = stage.w / 2;
  for (const b of live) {
    if ((b.left + b.right) / 2 <= cx)
      lo = Math.max(lo, b.right + gap); // back pill, left
    else hi = Math.min(hi, b.left - gap); // zoom HUD, right
  }
  return { lo, hi: Math.max(lo, hi), top };
}

/**
 * Centre a bar of width `bw` in the band. A bar wider than the band pins to `lo` - its
 * own `overflow-x` scrolls the rest of its controls into reach - so it never pushes past
 * `hi` into the chrome on the right.
 */
export function centreCtxBar(bw: number, band: CtxTopBand): { left: number; top: number } {
  const room = band.hi - band.lo;
  const left = bw >= room ? band.lo : band.lo + (room - bw) / 2;
  return { left: Math.round(left), top: Math.round(band.top) };
}

/**
 * The dragged rail position - CHROME state, exactly like zoom and pan. It lives in
 * the module for the life of the page and deliberately reaches neither the URL, the
 * box model, nor a saved session; a reload puts the rail back on its docked edge.
 * Shared by every free-canvas tool: one editor, one remembered spot for its tools.
 */
let railSession: { left: number; top: number } | null = null;

// Weight menu (shared by the Text panel and the in-edit format bar). Mono cuts
// rarely ship a Black - their variable axes top out at 800 - so the mono menu
// stops at Extrabold (both profiles' hooks.js + the vector exporter cap it the
// same way; mono detection lives in isMonoFont inside initFreeCanvas).
const WEIGHT_CHOICES: Array<[string, string]> = [
  ['100', 'Thin'],
  ['200', 'Extra light'],
  ['300', 'Light'],
  ['400', 'Regular'],
  ['500', 'Medium'],
  ['600', 'Semibold'],
  ['700', 'Bold'],
  ['800', 'Extrabold'],
  ['900', 'Black'],
];
// Fallback font menu for editor tools whose manifest doesn't declare a font
// select - the historical hard-coded pair, so such tools keep working unchanged.
const FALLBACK_FONT_OPTIONS: FontOption[] = [
  { value: 'SUSE', label: 'SUSE Sans' },
  { value: 'SUSE Mono', label: 'SUSE Mono' },
];
// Live-preview font stacks - kept byte-for-byte in step with the shipped
// design hooks.js FONTS maps (SUSE profile: 'SUSE'/'SUSE Mono';
// lolly-start: 'sans'/'mono') so the in-edit preview matches the committed
// render and the vector export exactly. Wire values not listed here derive a
// stack from the value itself (fontStackFor inside initFreeCanvas).
const FONT_STACK: Record<string, string> = {
  'SUSE Mono': "'SUSE Mono', ui-monospace, SFMono-Regular, monospace",
  SUSE: "'SUSE', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  sans: "var(--font-brand, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif)",
};
/**
 * The arrowhead vocabulary (plan 96 P1) - EXACTLY the strings `edgeArrowHead` in
 * engine/src/connectors.ts branches on, and in its order, because a spline, a line and a
 * connector are one primitive and must not offer two different sets of heads. Anything
 * outside this list falls through to the engine's triangle, which is why the menu is
 * closed rather than free text.
 */
const HEAD_CHOICES: Array<[string, string]> = [
  ['none', 'None'],
  ['triangle', 'Arrow'],
  ['open', 'Open arrow'],
  ['circle', 'Circle'],
  ['diamond', 'Diamond'],
  ['bar', 'Bar'],
];
/**
 * The route choices a BOUND path offers (plan 96 P3), in the engine's own order. '' is
 * "auto", i.e. read the route off the spline kind - which is what an unbound path has
 * always done and what a bound one does until someone says otherwise. The other thirteen
 * are `CONNECTOR_ROUTE_STYLES`, spelled with their labels here because six spline kinds
 * cannot name thirteen routes.
 */
const ROUTE_CHOICES: Array<[string, string]> = [
  ['', 'Auto, from the spline type'],
  ['straight', 'Straight'],
  ['elbow', 'Elbow, auto'],
  ['elbow-v', 'Elbow, vertical'],
  ['elbow-h', 'Elbow, horizontal'],
  ['elbow-src', 'Elbow, bend at the start'],
  ['elbow-tgt', 'Elbow, bend at the end'],
  ['curved', 'Curved, auto S'],
  ['curved-v', 'Curved, vertical S'],
  ['curved-h', 'Curved, horizontal S'],
  ['arc', 'Arc, bow'],
  ['arc-wide', 'Arc, wide bow'],
  ['arc-flip', 'Arc, reverse bow'],
  ['arc-flip-wide', 'Arc, wide reverse bow'],
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
export const CHOREO_SHOWCASES: ReadonlyArray<{
  id: ShowcaseId;
  label: string;
  sub: string;
  ms: number;
  icon: string;
}> = [
  {
    id: 'buildup',
    label: t('Buildup'),
    sub: t('Assemble from nothing'),
    ms: 3000,
    icon: SVG.front,
  },
  {
    id: 'deconstruct',
    label: t('Deconstruct'),
    sub: t('Fly apart at the end'),
    ms: 2500,
    icon: SVG.ungroup,
  },
  {
    id: 'loop',
    label: t('The Loop'),
    sub: t('Assemble, hold, fly apart - cycles as a GIF'),
    ms: 6000,
    icon: SVG.rotate,
  },
  {
    id: 'hero',
    label: t('Hero arc'),
    sub: t('Explode, fly through, come home'),
    ms: 6000,
    icon: SVG.choreo,
  },
  {
    id: 'trench',
    label: t('Trench run'),
    sub: t('A small lift, the camera flies between'),
    ms: 5000,
    icon: SVG.camera,
  },
  {
    id: 'scan',
    label: t('Map-scan'),
    sub: t('Hardly raised, the camera scans the page'),
    ms: 8000,
    icon: SVG.move,
  },
];

/**
 * The per-box tilt CONTROL range, degrees (plans/104 P2.1) - what the More panel's
 * "Perspective tilt" sliders span.
 *
 * A hand-copied `KF_TILT_CONTROL` (views/timeline-panel.ts), on `CHOREO_SHOWCASES`'
 * terms: this module reaches that chunk only through a dynamic import, so a static
 * import for a two-number tuple would pull a whole view into the canvas bundle. The two
 * are held equal by a drift test in free-canvas-choreo.test.ts, which is the only thing
 * that can hold them equal.
 */
export const FC_TILT: readonly [number, number] = Object.freeze([-75, 75] as const);

/** Is a dash pattern relevant to this box? A dash keyword is on, OR an array is already
 *  authored - the second half is what stops a stored pattern becoming unreachable the
 *  moment someone flips the keyword back to Solid. */
function dashRowOn(styleVal: string, arrVal: string): boolean {
  return styleVal === 'dashed' || styleVal === 'dotted' || String(arrVal).trim() !== '';
}
// ligatures default ON (off → disable liga/clig); alternates default OFF (on → salt).
function featureSettings(ligOn: boolean, altOn: boolean): string {
  const feat: string[] = [];
  if (!ligOn) feat.push('"liga" 0', '"clig" 0');
  if (altOn) feat.push('"salt" 1');
  return feat.join(', '); // '' = browser default (ligatures on, no alternates)
}
// A short, unambiguous marker for layout objects copied INSIDE the editor. The
// serialized boxes ride the OS clipboard behind it, so ⌘V pastes (duplicates)
// them - even across a reload - while ordinary copied text still lands as a new
// text box. Kept in-memory too, in case a browser blocks the clipboard read.
const FC_CLIP_PREFIX = 'lolly/layout-boxes:';
// Coerce a manifest/model boolean (real boolean or "true"/"1"/"on" string) - mirrors
// hooks.js boolVal so the editor previews match the render.
function boolOf(v: any, dflt: boolean): boolean {
  if (v === true || v === false) return v;
  if (v == null || v === '') return dflt;
  const s = String(v).toLowerCase();
  if (s === 'true' || s === '1' || s === 'yes' || s === 'on') return true;
  if (s === 'false' || s === '0' || s === 'no' || s === 'off') return false;
  return dflt;
}
// Flex mappings for the align/valign live preview - must mirror hooks.js boxCss.
const H_JUSTIFY: Record<string, string> = {
  left: 'flex-start',
  center: 'center',
  right: 'flex-end',
};
const V_ALIGN: Record<string, string> = { top: 'flex-start', middle: 'center', bottom: 'flex-end' };

export function initFreeCanvas(opts: InitFreeCanvasOpts): FreeCanvasHandle {
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
  let dirtyObserver: MutationObserver | null = null; // mirrors the Save icon's unsaved cue (see buildToolbar/actions)
  // The artboard is resizable, so read its CURRENT declared size (not the mount-time
  // nativeW/H) everywhere geometry depends on the canvas dimensions.
  const canvasWH = (): Canvas => ({
    w: parseInt(canvasEl.style.width, 10) || nativeW,
    h: parseInt(canvasEl.style.height, 10) || nativeH,
  });
  const cv: CanvasCfg = input.canvas || {};
  const blockId = input.id;
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
  } as FieldCfg;
  // The vector operations' own field view. `cfg` is a superset of `VectorFieldConfig`
  // and vector-ops resolves each name defensively (a non-string falls back to the
  // Design default), so the resolved config is handed over unchanged.
  // Null until the manifest declares `canvas.pathField` - see CanvasCfg.pathField.
  const vectorCfg: VectorFieldConfig | null = cv.pathField ? cfg : null;
  // Plan 96's path decorations are DECLARED, not defaulted-into-existence: the field names
  // above default (so the reads are simple), but a tool that never named them in its canvas
  // block has a hooks.js that cannot draw an arrowhead or an authored dash pattern, and
  // authoring one into its boxes would store a decoration the render silently ignores -
  // worse, one the compact URL drops on the way out because the field is undeclared. Every
  // `pathField` tool shipping today declares the head set - both Design packs, and
  // Sequence Studio since its 1.3.0 (fields headStart/headEnd, canvas headStartField/
  // headEndField) - so the check is a live gate for a tool that has not opted in yet, not a
  // description of one that exists.
  const hasHeadCfg = !!(cv.headStartField || cv.headEndField);
  const hasBindCfg = !!(cv.bindStartField || cv.bindEndField);
  const hasRouteCfg = !!cv.routeField;
  // ── Flip (mirror) ─────────────────────────────────────────────────────────────
  // Flip is opt-in per tool, and gated on the box sub-fields being DECLARED rather than on a
  // `canvas.*Field` key. The canvas block in schemas/tool.schema.json is a CLOSED SET whose
  // every new key is a breaking change for older shells (the engine validates a manifest
  // against that same schema at load), so the flag is the presence of the fixed-named `flipH`
  // + `flipV` sub-fields instead - the same "is the field declared" test `hasIdField` uses.
  // The names match what the tool's hooks.js reads when it folds the mirror into the box
  // transform, so overlay and render agree by convention. A tool that declares neither is
  // offered no flip and is byte-identical - like `pathField` gates the vector section.
  const FLIP_H_FIELD = 'flipH';
  const FLIP_V_FIELD = 'flipV';
  const canFlip =
    (input.fields || []).some((f) => f.id === FLIP_H_FIELD) &&
    (input.fields || []).some((f) => f.id === FLIP_V_FIELD);
  /** The committed bound-path layer's class, hidden while a drag re-routes it live. */
  const boundLayerClass = cv.pathLayerClass || 'lolly-connectors';
  const hasDashArrayCfg = !!cv.strokeDashArrayField;
  const unwrapColor = (v: ColorFieldValue) =>
    v && typeof v === 'object' && 'value' in v ? v.value : v;
  const minSize = cv.minSize ?? 8;
  // ── Manifest-driven typography ────────────────────────────────────────────────
  // The Text panel + format-bar font menus are built from the tool's OWN declared
  // font select (the blocks field named by canvas.fontField), so the editor writes
  // exactly the wire values the tool's hooks.js understands under any profile
  // (SUSE: 'SUSE'/'SUSE Mono'; lolly-start: 'sans'/'mono'). Tools without a font
  // field declaration fall back to the historical hard-coded pair.
  const fontFieldDef = cfg.fontField
    ? (input.fields || []).find((f) => f.id === cfg.fontField)
    : undefined;
  const fontOptions: FontOption[] = (
    fontFieldDef?.options?.length ? fontFieldDef.options : FALLBACK_FONT_OPTIONS
  ).map((o) => ({ value: String(o.value ?? ''), label: String(o.label || o.value || '') }));
  const defaultFont = String(fontFieldDef?.default || fontOptions[0]!.value);
  // Mono detection mirrors hooks.js weightOf (/mono/i on the wire value; the label
  // covers manifests whose values don't self-describe). Mono cuts rarely ship a
  // Black, so the weight menu and the font-change clamp cap mono at 800.
  const isMonoFont = (font: any): boolean => {
    const v = String(font);
    return /mono/i.test(v) || fontOptions.some((o) => o.value === v && /mono/i.test(o.label));
  };
  const maxWeightFor = (font: any): number => (isMonoFont(font) ? 800 : 900);
  const weightChoicesFor = (font: any): Array<[string, string]> =>
    WEIGHT_CHOICES.filter(([v]) => +v <= maxWeightFor(font));
  // Live-preview stack: exact hooks.js stacks for the known wire values; other
  // declared options derive one from the value (leading family + a generic tail);
  // unknown/empty values preview as the manifest's default font, mirroring
  // hooks.js fontFamily's fallback.
  const stackOf = (s: string): string =>
    FONT_STACK[s] ||
    (isMonoFont(s)
      ? `'${s}', ui-monospace, SFMono-Regular, monospace`
      : `'${s}', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`);
  const fontStackFor = (v: any): string => {
    const s = String(v ?? '');
    // Installed user-font families count too: hooks.js already paints any brand
    // font the kit carries, so the format-bar overlay must preview it rather
    // than coercing the preview to the default face.
    return s && (fontOptions.some((o) => o.value === s) || brandFontFamilies().includes(s))
      ? stackOf(s)
      : stackOf(defaultFont);
  };
  const fontOptionsHtml = (cur?: any): string =>
    fontOptions
      .map(
        (o) =>
          `<option value="${escapeHtml(o.value)}"${String(cur) === o.value ? ' selected' : ''}>${escapeHtml(o.label)}</option>`
      )
      .join('');
  // ── Manifest-driven shape control ─────────────────────────────────────────────
  // The "More" panel's shape segment is built from the tool's OWN declared shape
  // options - NOT a fixed list - so a tool only ever offers shapes its hooks.js can
  // render (e.g. `circle` is Design only; Carousel/Org-chart/Record don't
  // declare it, so it never shows there and can't produce a broken square). A known
  // value gets its glyph; anything else falls back to its label text.
  const shapeChoices: Array<[string, string, string?]> = shapeChoicesFrom(
    input.fields,
    cfg.shapeField
  );
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
  const shadowChoices: Array<[string, string]> = shadowChoicesFrom(input.fields, cfg.shadowField);
  const addKinds: AddKind[] =
    Array.isArray(cv.addKinds) && cv.addKinds.length
      ? cv.addKinds
      : [{ id: 'box', label: 'Box', seed: {} }];
  // Opt-in design-file import (Figma SVG / Penpot). Falsy for Design, whose
  // canvas config has no `import` key - so its toolbar is unchanged.
  const importCfg = cv.import || null;
  // Brand vocabulary for the importer (engine DesignMapOptions): imported text maps
  // onto the tool's OWN font select values (SUSE: 'SUSE'/'SUSE Mono'; lolly-start:
  // 'sans'/'mono'), and box seed colours come from its addKinds seeds - so an import
  // is indistinguishable from natively-authored boxes under any profile. Fields the
  // manifest doesn't declare stay undefined → the engine's neutral defaults apply.
  const importMap = (() => {
    const monoOpt = fontOptions.find((o) => isMonoFont(o.value));
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
          ? { monoFamily: monoOpt.value, monoMaxWeight: maxWeightFor(monoOpt.value) }
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
  })();
  // Opt-in connector authoring (Org Chart). The connect config names a SECOND blocks
  // input that stores {from,to} edges; the overlay authors them and draws a live
  // preview, but the tool's hooks.js owns the actual routed line geometry. Falsy for
  // every other editor tool, so their toolbars/gestures are unchanged.
  const connectCfg: ConnectCfg | null =
    cv.connect && cv.connect.input
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
      : null;
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
      : null;
  // Can this tool import a design AS timed scenes (frames → timeline clips) at all?
  // Time-capable + import-capable. Design qualifies (it declares the time model), so it
  // OFFERS the "as scenes vs replace the board" choice (plans/104 section 337) - on the drop
  // door (the stash's `scenes` flag) and in the import panel (the toggle below).
  const importSceneCapable: boolean = !!(timeCfg && importCfg);
  // Whether SCENES is the DEFAULT: only a manifest that still declares `import.mode:
  // 'scenes'`. Design does NOT (that opt-in flipped every import, plans/104 section 337), so
  // Design defaults to replacing the board and asks per-import.
  const importScenesMode: boolean =
    importSceneCapable && (importCfg as { mode?: unknown }).mode === 'scenes';
  // Can this tool lay a document's pages out as ARTBOARDS - one frame per page, slide
  // or board, each page's parts editable inside it? Import-capable + the frame
  // primitive. Design qualifies; like scenes, it is offered per import, never assumed.
  const importArtboardCapable: boolean = !!(importCfg && frameCfg);
  type ImportMode = 'board' | 'artboards' | 'scenes';
  /** What each import mode does, in one line under the choice. */
  const importHint = (mode: ImportMode): string =>
    mode === 'scenes'
      ? t(
          'Every frame becomes its own scene on the timeline, ready for timing tweaks, music and voiceover.'
        )
      : mode === 'artboards'
        ? t(
            'Every page or slide becomes its own artboard, side by side, with its parts still editable.'
          )
        : t('One page replaces the board. A multi-page document asks which page.');
  // A function, not a literal: TypeScript narrows `let m: ImportMode = cond ? 'a' : 'b'`
  // to those two members, which makes the panel's third radio unreachable at the type
  // level even though the user can pick it.
  const defaultImportMode = (): ImportMode => (importScenesMode ? 'scenes' : 'board');

  // Opt-in snap-to-grid. gridOn is toggled from the rail; gridSize is native px.
  const gridSize = Math.max(2, Math.round(cv.grid?.size ?? 20));
  let gridOn = !!(cv.grid && cv.grid.default !== false);

  // ── state ──────────────────────────────────────────────────────────────────
  let selection = new Set<string>(); // box ids
  // Selection change-notifier for the timeline panel. `selection` is assigned from ~20
  // sites, but EVERY one of them reaches paintChrome (directly via renderChrome /
  // renderChromeLive, or via commit → runtime.subscribe → scheduleSync), so the fire
  // lives in exactly one place (top of paintChrome) and is guarded by a signature -
  // a repaint with an unchanged selection is not a change. No write site is touched.
  // Listeners take the new ids (design-ports' SelectionPort). The timeline's own port
  // declares `(cb: () => void)`, which a handler ignoring the argument satisfies, so both
  // consumers read the SAME notifier.
  const selListeners = new Set<(ids: string[]) => void>();
  let selNotifyKey: string | null = null;
  function notifySelection(): void {
    if (!selListeners.size) return;
    const k = [...selection].sort().join(',');
    if (k === selNotifyKey) return;
    selNotifyKey = k;
    const ids = [...selection];
    for (const f of [...selListeners]) {
      try {
        f(ids);
      } catch (e) {
        console.error(e);
      }
    }
  }
  /**
   * THE selection port (plans/179 M2 (a)). One object, handed to the timeline panel AND
   * returned on `handle.design`, so a column and the timeline can never end up reading
   * two different adapters over the same Set.
   */
  const selectionPort: SelectionPort = {
    get: () => [...selection],
    set: (ids: string[]) => {
      selection = new Set(ids);
      renderChrome();
    },
    onChange: (cb: (ids: string[]) => void) => {
      selListeners.add(cb);
      return () => {
        selListeners.delete(cb);
      };
    },
  };
  let multiTapMode = false; // touch: taps ADD to the selection (Group/Align need ≥2)
  /**
   * THE tool mode - see `setMode`. Every mode used to be its own boolean, which is exactly
   * why they could all be true at once.
   */
  let mode: EditorMode = 'select';
  // The Node tool (Inkscape's `N`): a sub-mode of 'select' where a single click on a path
  // box jumps straight into node editing rather than selecting it. A flag, not a 5th
  // EditorMode, because `setMode` ends any `penEdit` session - the very thing this tool
  // wants to keep - so a real mode would fight that invariant. Mutually exclusive with the
  // other tools: picking pen/create/connect (or the plain pointer) clears it.
  let nodeToolActive = false;
  let armedKind: AddKind | null = null; // the create gesture's seed; set iff mode === 'create'
  let gesture: Gesture | null = null; // active pointer gesture
  // The pointerType of the last press ON THE CANVAS. A touch laptop reports `pointer:
  // coarse` for the whole document while the user is on the trackpad (see
  // timeline-panel.ts's EDGE_PX_COARSE), so anything that MOVES the canvas asks the event
  // rather than the media query - a trackpad user must never have the stage zoom under them.
  let lastPointerKind = '';
  let editing: EditingState | null = null; // { id, el, prev } while editing a box's text inline
  let disposed = false;
  let bindHover: string | null = null; // the box an end node would attach to on drop
  let liveConnectHidden = false; // the tool's real bound-path layer is hidden mid-drag
  let selectedEdges = new Set<string>(); // connector ids being inspected (click / shift-click / marquee)
  let edgePanel: HTMLElement | null = null; // the connector-properties popover
  let hoverEdge: string | null = null; // connector id under the cursor (hover affordance)
  let hoverRaf = 0;
  let lastMenuAt: Point = { x: 0, y: 0 }; // where the context menu was last opened (client px)

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
  let penDraft: AuthoredPath | null = null; // nodes in NATIVE px; null = not drawing
  let penCursor: Point | null = null; // live end of the segment under the cursor
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
  let penEdit: { id: string; path: AuthoredPath; parts: PenPart[]; frame: PenFrame } | null = null;
  let penSel = new Set<number>(); // selected node indices while editing
  // Selected CONTROL POINTS (handles) while editing - keys `${nodeIndex}:in` / `:out`.
  // Built by shift-clicking a handle; align/distribute operate on nodes ∪ these. Kept
  // separate from penSel so a handle is a point in its own right, not tied to its node.
  let penHandleSel = new Set<string>();
  // Node-edit selection mode: false = a marquee picks NODES only (default); true = it also
  // picks CONTROL POINTS. A session-scoped preference toggled from the node-edit bar.
  let penSelectHandles = false;
  // The previous frame's hyperbezier solution, reused as the `warm` start. A 40-node solve
  // re-converged from the chord-bend guess costs an O(n) Newton run per pointermove; warm,
  // it costs one or two steps. This is exactly what `toCubics`' `warm` parameter is for.
  let penWarm: HyperbezierSolution | null = null;
  const PEN_HIT_PX = 9; // grab radius for a node/handle, SCREEN px
  const PEN_CURVE_PX = 7; // "on the curve" band for insert, SCREEN px
  const PEN_PULL_MIN = 3; // drag past this and a click became a handle PULL, SCREEN px
  // Alt during a `pendraw` drag BREAKS the handle pair, and latches for the rest of that
  // drag rather than being read fresh each move: a break is a declaration about the node,
  // not a per-frame state, and reading it live makes the corner flicker back to smooth on
  // any move event that happens to arrive without the modifier.
  let penPullBroken = false;
  // The paint the user last put on a path, so the NEXT path they draw matches it - the
  // drawing-app convention, and the reason a session of pen work doesn't mean recolouring
  // every shape. Session-only (never persisted, never in the model): it is a memory of an
  // action, not a property of the document. Set from a paint write to a path selection and
  // from each commit, so consecutive draws agree even before anything is recoloured.
  let penLastPaint: Box | null = null;
  /** The canvas config's paint sub-field names, as the pure pen helpers want them. */
  const penPaintFields: PathPaintFields = {
    fill: cfg.fillField,
    stroke: cfg.strokeField,
    strokeW: cfg.strokeWField,
    fillRule: cfg.fillRuleField,
  };

  // ── model access ─────────────────────────────────────────────────────────
  const getBoxes = (): Box[] => {
    const e = runtime.getModel().find((i) => i.id === blockId);
    return Array.isArray(e?.value) ? e!.value : [];
  };
  const bgInputId = 'background';
  const getBg = (): any => runtime.getModel().find((i) => i.id === bgInputId)?.value ?? '#ffffff';

  /** The frame-primitive field names as the pure artboard helpers want them. Only
   *  meaningful with `frameCfg`; every caller is gated on it. */
  const frameFields = (): FrameFields => ({
    idField: cfg.idField,
    kindField: cfg.kindField,
    xField: cfg.xField,
    yField: cfg.yField,
    wField: cfg.wField,
    hField: cfg.hField,
    frameField: frameCfg?.frameField || 'frame',
    orderField: frameCfg?.orderField || 'order',
    frameKind: frameCfg?.frameKind || 'frame',
  });
  /** Does this document have artboards at all? Decides between "artboard fill" and
   *  "canvas background", and gates every housekeeping path below. */
  const hasFrames = (boxes: Box[]): boolean =>
    !!frameCfg && boxes.some((b) => b && String(b[cfg.kindField]) === frameCfg.frameKind);
  /** `canvas.labelField` - a row's own NAME. The timeline uses it for a renamed clip;
   *  plans/179 A10 uses it for an artboard's tab. Optional: no field, no rename. */
  const nameField: string = cv.labelField || '';
  /** The frame field that holds a slide's SPEAKER NOTES. Not a canvas-config key: the
   *  manifest declares `boxes[].notes` and every reader here (the notes panel, the deck
   *  model, the artboards import) names the same literal, so it is named once. */
  const FRAME_NOTES_FIELD = 'notes';
  /** The DOCUMENT-level slide transition (plans/179 M4). Not a canvas-config key for the
   *  same reason FRAME_NOTES_FIELD is not: the manifest declares a top-level `transition`
   *  input and every reader here names that same literal, so it is named once. Read live
   *  rather than captured - the sidebar can change it between mount and "Place in order". */
  const DOC_TRANSITION_INPUT = 'transition';
  const docTransitionValue = (): string => {
    const v = runtime.getModel().find((i) => i.id === DOC_TRANSITION_INPUT)?.value;
    return v == null ? '' : String(v);
  };
  // The rail's paint swatch and the key of what it currently shows. Declared HERE, not
  // beside paintBgField below, because buildToolbar runs during mount and a `let` in the
  // later block would still be in its temporal dead zone.
  let bgSlot: HTMLElement | null = null;
  let bgFieldKey = '';
  /** Which control the mark menu is hanging off (see `anchorEl` in buildToolbar) - out
   *  here for the same dead-zone reason, and so `openLollyMenu` can claim it. */
  let lollyAnchor: HTMLElement | null = null;
  const setLollyAnchor = (el: HTMLElement): void => {
    lollyAnchor = el;
  };
  /** The mark menu's row builder, published out of `buildToolbar` so `openLollyMenu`
   *  (design-ports) can spawn the SAME menu from the top bar's own mark. */
  let lollyMenuItems: (() => PopItem[]) | null = null;
  let shortcutsModal: ReturnType<typeof openDesignShortcuts> | null = null;
  /** One sheet at a time, whether it was opened from `?` or the document menu. */
  const showShortcuts = (opener?: HTMLElement | null): void => {
    if (shortcutsModal) return;
    shortcutsModal = openDesignShortcuts({
      opener,
      onClose: () => { shortcutsModal = null; },
    });
  };

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
  const hasIdField = !!cv.idField || (input.fields || []).some((f) => f.id === cfg.idField);
  const idOf = (b: Box | undefined, i: number): string => {
    const v = b ? b[cfg.idField] : undefined;
    if (v != null && v !== '') return String(v);
    return hasIdField ? '' : String(i);
  };
  const selIndices = (boxes: Box[]): number[] =>
    boxes.reduce<number[]>((a, b, i) => (selection.has(idOf(b, i)) ? (a.push(i), a) : a), []);
  const indexOfId = (boxes: Box[], id: string | undefined): number =>
    boxes.findIndex((b, i) => idOf(b, i) === id);
  const groupOf = (b: Box | undefined): string =>
    cfg.groupField && b && b[cfg.groupField] ? String(b[cfg.groupField]) : '';
  const groupMemberIds = (boxes: Box[], g: string): string[] =>
    boxes.reduce<string[]>((a, b, i) => (groupOf(b) === g ? (a.push(idOf(b, i)), a) : a), []);
  // The ids selected when box `i` is clicked: its whole group (if any), unless
  // `soloBox` (Alt-click) drills in to just that one box.
  function selectionForHit(boxes: Box[], i: number, soloBox: boolean): string[] {
    const g = groupOf(boxes[i]);
    return soloBox || !g ? [idOf(boxes[i], i)] : groupMemberIds(boxes, g);
  }

  /**
   * Frame-aware selection pick (plan 92, ISSUE 2a). Two passes over the SAME hitTest:
   * first the topmost NON-frame box under the point, and only when none is hit does the
   * topmost frame (artboard) take the click. So clicking a child selects the child, and
   * clicking an artboard's own empty area / edge selects the artboard - regardless of
   * array order, which fixes the appended-frame-swallows-its-children bug (an Add-menu
   * frame is pushed last → topmost → a plain hitTest would let it eat every child click).
   * Frame-agnostic docs (no frameCfg) fall straight through to the ordinary hitTest, and
   * the shared hitTest used by connect/line/node modes is deliberately NOT routed here.
   */
  function selectHit(boxes: Box[], px: number, py: number): number {
    const skip = seqHiddenSkip(boxes);
    if (!frameCfg) return pickTopmost(boxes, px, py, cfg, skip);
    const fk = frameCfg.frameKind;
    const isFrame = (i: number): boolean => String(boxes[i]?.[cfg.kindField]) === fk;
    const nonFrame = pickTopmost(boxes, px, py, cfg, (i) => (skip ? skip(i) : false) || isFrame(i));
    if (nonFrame >= 0) return nonFrame;
    return pickTopmost(boxes, px, py, cfg, skip);
  }

  function freshId(boxes: Box[]): string {
    // ULID (plan 100 section 3): the old id was a per-mount counter plus 4 random base-36
    // digits, so two devices opening the SAME saved session and adding a box each
    // could mint the same id - which is exactly the case a collab makes routine. The
    // collision check stays because it costs one pass over an array we already walk.
    const used = new Set(boxes.map((b, i) => idOf(b, i)));
    let id = ulid();
    while (used.has(id)) id = ulid();
    return id;
  }

  /** Fill in ids for rows that carry none - an import, a paste, or a hook patch that
   *  minted rows without one. Returns the SAME array when nothing was missing, so a
   *  caller commits only on a real change. Inert for a tool with no id field. */
  const withIds = (boxes: Box[]): Box[] => (hasIdField ? ensureRowIds(boxes, cfg.idField) : boxes);

  function commit(nextBoxes: Box[]): void {
    onDirty?.(blockId);
    runtime.setInput(blockId, withIds(nextBoxes));
  }

  // ── frame containment-on-drop (plan 93 F1b-1) ────────────────────────────────
  // Re-bucket the boxes TOUCHED by a gesture (by array index) into the frame their
  // centre now falls inside - the drop half of the frame primitive. Pure + gated on
  // `frameCfg`: dead (returns nextBoxes unchanged) for every tool whose canvas
  // declares no frameField, so no-frames documents are untouched. A frame-kind box
  // never gets a `frame` membership here (its own move/cascade is a later slice);
  // resolveFrame is idempotent, so a box that didn't change frames keeps its identity
  // (no spurious new object → no needless re-render churn). `touched` are indices into
  // `nextBoxes`; every gesture that calls this preserves index alignment (append for
  // create, in-place map for move/resize/scale), so indices stay valid.
  function assignFrames(nextBoxes: Box[], touched: Set<number>): Box[] {
    if (!frameCfg) return nextBoxes;
    const ff = frameCfg.frameField;
    const fk = frameCfg.frameKind;
    const frameBoxes = nextBoxes.filter((b) => String(b?.[cfg.kindField]) === fk);
    return nextBoxes.map((b, i) => {
      if (!touched.has(i) || !b) return b;
      if (String(b[cfg.kindField]) === fk) return b; // a frame keeps frame='' (no self-nesting)
      const fid = resolveFrame(b, frameBoxes);
      return String(b[ff] ?? '') === fid ? b : { ...b, [ff]: fid };
    });
  }

  // ── legible ink on a new text box ────────────────────────────────────────────
  // A text add-kind seeds ONE authored ink (Design: `fg: '#11141f'`), so the first text
  // placed on a dark artboard was near-black on near-black - at fit zoom on a phone that
  // is not "hard to read", it is nothing on screen at all, and typing changes nothing.
  //
  // The flip is `contrastText`, the shell's ONE inversion rule (brand-vars.ts), used
  // twice: once on the ground and once on the seeded ink. When both want the SAME overlay
  // ink they sit on the same side of the flip point, which is exactly the dark-on-dark /
  // light-on-light case - and it is the only case that gets rewritten. A seed that already
  // reads on its ground is left byte-identical, so a light artboard (every shipped default)
  // keeps the authored colour.

  /** Any authored colour value as `#rrggbb`, or null when it is absent, unparseable
   *  (an alias, a gradient) or too translucent to be the ground. */
  function inkHex(v: unknown): string | null {
    const c = parseColor(typeof v === 'string' ? v : null);
    return c && c.alpha > 0.5 ? colorToHexString(c) : null;
  }

  /** The painted ground behind the artboard: the first ancestor from the canvas up that
   *  actually paints something opaque. Read off the DOM rather than the `background`
   *  input because that input can hold an alias, a gradient or nothing at all, and what
   *  matters is what the user is looking at - the current theme's backdrop included. */
  function paintedGround(): string | null {
    for (let el: HTMLElement | null = canvasEl; el; el = el.parentElement) {
      const hex = inkHex(getComputedStyle(el).backgroundColor);
      if (hex) return hex;
    }
    return null;
  }

  /** The ground under `box`: its OWN fill first (a card's text sits on the card, not on
   *  whatever is behind it - Design's card seeds a near-black `#14181d`), then the fill of
   *  the frame containing it when the document has frames (a light artboard over a dark
   *  pasteboard is the case that makes the difference), then the painted backdrop. */
  function groundUnder(box: Box, boxes: Box[]): string | null {
    const own = cfg.fillField ? inkHex(box[cfg.fillField]) : null;
    if (own) return own;
    if (frameCfg && cfg.fillField) {
      const fk = frameCfg.frameKind;
      const fid = resolveFrame(
        box,
        boxes.filter((b) => String(b?.[cfg.kindField]) === fk)
      );
      const frame = fid ? boxes.find((b) => b && String(b[cfg.idField]) === fid) : undefined;
      const hex = frame ? inkHex(frame[cfg.fillField]) : null;
      if (hex) return hex;
    }
    return paintedGround();
  }

  /** `box` with its text ink flipped to whichever of black/white reads on the ground it
   *  sits on - and only when the seeded ink does not already read there. */
  function withLegibleInk(box: Box, boxes: Box[]): Box {
    const f = cfg.textColorField;
    if (!f) return box;
    const ground = groundUnder(box, boxes);
    if (!ground) return box;
    const ink = inkHex(box[f]);
    const wanted = contrastText(ground);
    if (ink && contrastText(ink) !== wanted) return box; // the seed already reads
    return { ...box, [f]: wanted };
  }

  // F1b-2 frame-move cascade: when a gesture directly moves a frame-kind box, its members
  // must travel with it in the SAME commit (one undo step). `prev` is the pre-gesture
  // model, `next` the post-transform model - both index-aligned with `sel` (no commit
  // happens mid-gesture, so getBoxes()/startBoxes and the transform output share indices).
  // For every frame box whose index is in `sel` we read its OWN top-left delta (next−prev)
  // and shift each member (frame === frame.id) that the gesture did NOT already move
  // directly (index NOT in `sel`). This is why we compose the delta here rather than call
  // cascadeFrameMove(next, id, dx, dy): moveBoxes/scaleGroup/rotateGroup already shifted the
  // frame box AND any selected children, so re-running cascadeFrameMove over the frame id
  // would double-apply to both. A frame box is never cascaded as a member (never
  // self-nests). Deriving the delta from prev/next covers move (exact d.dx/d.dy) and the
  // group transforms (each frame's own top-left translation) with one path. No-op without
  // frameCfg. assignFrames then runs on the touched `sel` only - the cascaded members keep
  // their frame because they moved with it (frame-local position unchanged), so they must
  // NOT be in the touched set, which is what keeps cascade-then-assign consistent.
  function cascadeFrameChildren(prev: Box[], next: Box[], sel: number[]): Box[] {
    if (!frameCfg) return next;
    const ff = frameCfg.frameField;
    const fk = frameCfg.frameKind;
    const selSet = new Set(sel);
    const deltas = new Map<string, { dx: number; dy: number }>();
    for (const i of sel) {
      const nb = next[i];
      const pb = prev[i];
      if (!nb || !pb || String(nb[cfg.kindField]) !== fk) continue;
      const fid = nb[cfg.idField] == null ? '' : String(nb[cfg.idField]);
      if (!fid) continue;
      const dx = num(nb[cfg.xField]) - num(pb[cfg.xField]);
      const dy = num(nb[cfg.yField]) - num(pb[cfg.yField]);
      if (Math.abs(dx) > 1e-6 || Math.abs(dy) > 1e-6) deltas.set(fid, { dx, dy });
    }
    if (deltas.size === 0) return next;
    return next.map((b, i) => {
      if (!b || selSet.has(i) || String(b[cfg.kindField]) === fk) return b;
      const d = deltas.get(String(b[ff] ?? ''));
      return d
        ? withRect(b, { x: num(b[cfg.xField]) + d.dx, y: num(b[cfg.yField]) + d.dy }, cfg)
        : b;
    });
  }

  // ── timeline panel (opt-in: canvas time-model fields → `timeCfg`) ─────────────
  // Every branch below is dead on a tool without `timeCfg`: no rail button, no lazy
  // chunk fetch, no stage reserve, no listener.
  let timelinePanel: TimelinePanel | null = null;
  let timelineLoading = false;
  /** The in-flight chunk load, so a second `ensureTimeline(true)` waits for the first. */
  let timelineLoad: Promise<void> | null = null;
  let timelineWantOpen = false;
  let timelineBtn: HTMLButtonElement | null = null;
  /** Whether the stage currently holds a band for the panel - the open/close EDGE, so
   *  a resize drag (which writes a new reserve every frame) costs nothing extra. */
  let timelineReserved = false;

  // Reserve a bottom band of the stage for the docked panel, then re-fit the canvas.
  // Mirrors deck-editor's syncFreeReserve exactly: a px STRING ('' releases), an
  // equality guard so the stage ResizeObserver cannot loop, and a `canvas-resize`
  // event (never a direct fitCanvas call) to trigger the re-fit.
  function reserveBottom(px: number): void {
    const next = px > 0 ? Math.round(px) + 'px' : '';
    if (stageEl.style.getPropertyValue('--stage-reserve-bottom') === next) return;
    if (next) stageEl.style.setProperty('--stage-reserve-bottom', next);
    else stageEl.style.removeProperty('--stage-reserve-bottom');
    // The right edge dock is a body-level fixed column that cannot read the stage's
    // inline style: publish the band on <html> too, so the column ends above the timeline.
    if (next) document.documentElement.style.setProperty('--design-timeline-h', next);
    else document.documentElement.style.removeProperty('--design-timeline-h');
    // The reserve is the timeline panel's open/close/height signal, so this is also
    // where the tool rail auto-docks (open) and returns to floating (close).
    dockRailForTimeline(px > 0);
    // …and it is the ONLY place free-canvas learns that the panel closed ITSELF
    // (plans/179 T2). Escape inside the panel calls its own `setOpen(false)` and never
    // comes back through `ensureTimeline`, so the rail button stayed armed, the chrome
    // kept the open-panel gate, and `timelineWantOpen` stayed true - which a later
    // chunk-load would have honoured by re-opening a panel the user had dismissed.
    // On the EDGE only: a resize drag rewrites the reserve every frame.
    if (px > 0 !== timelineReserved) {
      timelineReserved = px > 0;
      if (!timelineReserved && timelinePanel && !timelinePanel.isOpen()) {
        timelineWantOpen = false;
        hideSeqPrompt();
        scheduleSync();
      }
      syncTimelineBtn();
    }
    canvasEl.dispatchEvent(new Event('canvas-resize'));
  }

  function syncTimelineBtn(): void {
    if (!timelineBtn) return;
    const on = !!timelinePanel?.isOpen();
    timelineBtn.classList.toggle('is-armed', on);
    timelineBtn.setAttribute('aria-pressed', String(on));
  }

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
  const SEQ_OFF_CLASS = 'seq-off';
  /**
   * The ONE DOM read behind the whole rule (see the file header): is the sequence
   * currently hiding the box carrying `id`? Everything else - hit-test skipping,
   * chrome suppression, the keyboard gate - is a caller of this, so there is exactly
   * one expression that can ever be wrong.
   */
  function seqHiddenId(id: string): boolean {
    if (!timeCfg) return false;
    const el = canvasEl.querySelector(`.lolly-box[data-box-id="${cssEscape(id)}"]`);
    return el != null && el.classList.contains(SEQ_OFF_CLASS);
  }
  /**
   * The single ACQUISITION gate (see the file header): every pointer pick - click,
   * marquee, hover, drop - runs through this, so a box that must not be grabbed off the
   * canvas is excluded in ONE expression rather than at five call sites.
   *
   * Four exclusions:
   *   • SEQ-HIDDEN - the box is not on screen at the playhead, so a click falls through
   *     it to whatever is (the rule this function was written for).
   *   • CAMERA - a camera has NO canvas footprint at all (plans/104 section 5.4: "excluded
   *     from hit-testing, marquee…; selected via its bar/chip only"). It paints nothing
   *     and is minted with no geometry, so without this a zero-size marker at the origin
   *     is caught by any marquee crossing it and dragged around as if it were artwork.
   *   • HIDDEN - the layer flag (plans/179 M4). The hook leaves a hidden row out of the
   *     render entirely, so there is no element to hit - but the pick runs over the MODEL,
   *     which still holds the row at its geometry. Without this a hidden box is caught by
   *     a marquee and dragged around while nothing at all is on screen.
   *   • LOCKED - the other layer flag. It IS drawn, and drawn normally; what it refuses is
   *     acquisition. A locked frame is still selectable through its label, which is a
   *     separate element with its own handler and never reaches this pick.
   */
  function seqHiddenSkip(boxes: Box[]): ((i: number) => boolean) | undefined {
    const hideF = frameCfg?.hiddenField;
    const lockF = frameCfg?.lockedField;
    if (!timeCfg && !hideF && !lockF) return undefined;
    return (i: number) => {
      const b = boxes[i];
      if (!b) return false;
      if (hideF && boolOf(b[hideF], false)) return true;
      if (lockF && boolOf(b[lockF], false)) return true;
      if (!timeCfg) return false;
      return String(b[cfg.kindField] ?? '') === 'camera' || seqHiddenId(idOf(b, i));
    };
  }
  /**
   * RETENTION, the half `seqHiddenSkip` cannot cover: a selection acquired while its
   * box was on screen SURVIVES the playhead moving away from it. True means "at least
   * one selected box is on screen at the playhead, so editing it means something".
   * An untimed tool, or an empty selection, is always live.
   */
  function selectionLive(boxes: Box[]): boolean {
    if (!timeCfg || !selection.size) return true;
    for (let i = 0; i < boxes.length; i++) {
      const id = idOf(boxes[i], i);
      if (selection.has(id) && !seqHiddenId(id)) return true;
    }
    return false;
  }

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
  let seqPoseOf: ((el: Element | null | undefined) => SeqPose | null) | null = null;
  /**
   * The pose the playhead currently has box `id` in, or null.
   *
   * DOM truth on `seqHiddenId`'s exact terms: the numbers are the fold the applier
   * WROTE, not a second evaluation of the same track here, so the chrome cannot
   * disagree with the picture on the canvas (plans/104 section 6.5).
   */
  function seqPoseId(id: string): SeqPose | null {
    if (!seqPoseOf) return null;
    const el = canvasEl.querySelector<HTMLElement>(`.lolly-box[data-box-id="${cssEscape(id)}"]`);
    return el ? seqPoseOf(el) : null;
  }
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
  let poseMo: MutationObserver | null = null;
  function watchPoses(): void {
    if (poseMo || disposed) return;
    poseMo = new MutationObserver(() => {
      if (selection.size) scheduleSync();
    });
    poseMo.observe(canvasEl, { attributes: true, attributeFilter: ['style'], subtree: true });
  }

  // True when the block already carries authored timing - the auto-open cue. This is a
  // field-presence check, not editing arithmetic, so it stays here rather than pulling
  // timeline-math in eagerly (that module is part of the lazy chunk).
  function isTimedBox(b: Box): boolean {
    if (!timeCfg) return false;
    if (String(b[timeCfg.laneField] ?? '') === 'seq') return true;
    const s = b[timeCfg.startField];
    return Number.isFinite(typeof s === 'number' ? s : parseFloat(String(s ?? '')));
  }
  function anyTimed(boxes: Box[]): boolean {
    return !!timeCfg && boxes.some(isTimedBox);
  }

  async function ensureTimeline(open: boolean): Promise<void> {
    if (!timeCfg || disposed) return;
    timelineWantOpen = open;
    if (timelinePanel) {
      timelinePanel.setOpen(open);
      syncTimelineBtn();
      // The motion path is gated on `timelinePanel.isOpen()` (see motionIds), and this
      // is the ONE place that answer changes on an already-mounted panel - so this is
      // where the overlay is re-asked, rather than where it happens to be re-asked.
      //
      // It DOES already arrive without this line, and the route matters because
      // it is not one anybody wrote down: `setOpen` calls `reserve()`, which writes (or
      // clears) `--stage-reserve-bottom` on the stage's inline style, which trips the
      // stage MutationObserver, which schedules a sync, which repaints the chrome. Real,
      // measured, and made entirely of other decisions - it holds only while opening and
      // closing happen to reserve different heights and the observer happens to watch
      // attributes. One repaint on a toggle the user pressed is a cheap price for the
      // gate not resting on that.
      renderChrome();
      if (open) maybePromptSequenceFrames();
      else hideSeqPrompt();
      return;
    }
    if (!open) return;
    // A caller that arrives while the chunk is in flight (the `_t` deep link, one tick
    // after the mount-time auto-open) waits for THAT load rather than returning to a
    // panel that does not exist yet.
    if (timelineLoading) {
      await timelineLoad;
      return;
    }
    timelineLoading = true;
    timelineLoad = (async () => {
      try {
        // Lazy for the picker.ts reason: timeline-panel.ts imports its own CSS chunk and
        // the sequence clock, so a static import would ship both to every editor tool.
        // The applier's pose reader rides along in the same round trip - the panel's own
        // graph already contains that module, so this resolves off the module cache.
        const [{ initTimelinePanel }, seqDom] = await Promise.all([
          import('./timeline-panel.ts'),
          import('../bridge/sequence-dom.ts'),
        ]);
        if (disposed) return; // torn down while the chunk was in flight
        seqPoseOf = seqDom.sequencePoseOf;
        watchPoses(); // …and start following what it reports
        timelinePanel = initTimelinePanel({
          stageEl,
          canvasEl,
          runtime,
          host: host as { log?(level: string, msg: string): void },
          blockId,
          // The FRAME sub-field carrying a slide's own transition rides in on the time
          // cfg (plans/179 M4). It is not part of the time model - it lives on the canvas
          // block beside `frameField` - and without it here the panel's "a hand-set
          // Enter/Exit on an artboard stamps `custom`" branch was unreachable in the app:
          // the only thing that ever set the name was a test's own cfg patch, so every
          // hand-set slide transition was still fair game for the next "Place in order".
          cfg: { ...timeCfg, frameTransitionField: frameCfg?.transitionField || '' },
          getBoxes,
          commit,
          onDirty,
          // The box sub-field carrying rendered text, so the panel's generated
          // caption boxes write cue text where the tool's template reads it.
          textField: cv.textField,
          // The tool's OWN add-kinds, so the panel's plus offers exactly what the rail's
          // does (audio included) instead of hardcoding a list it cannot know.
          addKinds,
          // The canvas selection, adapted: read/write the same Set the overlay uses, and
          // subscribe to the single notifier fired from paintChrome. The SAME object the
          // Design columns are handed (see `selectionPort`).
          selection: selectionPort,
          reserve: reserveBottom,
          // The export frame for a camera take (RecordOpts.frame): the active artboard's
          // size, else the canvas - the same answer the size panel gives.
          frameSize: () => {
            const b = getBoxes();
            const fi = activeFrameIndex(b);
            return fi >= 0
              ? { w: num(b[fi]![cfg.wField]), h: num(b[fi]![cfg.hField]) }
              : canvasWH();
          },
        });
        timelinePanel.setOpen(timelineWantOpen); // the intent may have flipped mid-load
        // The contextual bar's "+Keyframe" asks the panel for its enabled state and had to
        // stand in for it while the chunk was in flight (see kfCtxHtml). Now that the real
        // rule exists, force ONE rebuild against it - the bar is otherwise only rebuilt
        // when the selection SET changes, so a selection made before the panel loaded would
        // keep the provisional answer for as long as it stands.
        ctxSelKey = null;
        renderChrome();
        if (timelineWantOpen) maybePromptSequenceFrames();
        else hideSeqPrompt();
      } catch (err) {
        console.error('[free-canvas] timeline panel failed to load:', err);
      } finally {
        timelineLoading = false;
        syncTimelineBtn();
      }
    })();
    await timelineLoad;
  }

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
  const MAX_ADD_AT_MS = 24 * 60 * 60 * 1000; // a day of sequence; beyond that it is junk
  let pendingAddAtMs: number | null = null;
  function onTlAdd(e: Event): void {
    if (!timeCfg || disposed) return;
    const d = (e as CustomEvent).detail as
      | { kind?: unknown; atMs?: unknown; asset?: unknown; durSec?: unknown }
      | null
      | undefined;
    const kind = addKinds.find((k) => k.id === (typeof d?.kind === 'string' ? d.kind : ''));
    if (!kind) return;
    const atMs = typeof d?.atMs === 'number' ? d.atMs : Number.NaN;
    if (!Number.isFinite(atMs) || atMs < 0 || atMs > MAX_ADD_AT_MS) return;
    // A finished camera take arrives WITH its asset (the panel's Record a video): no
    // create gesture and no picker - the clip is committed onto the sequence row now.
    // Untrusted detail: the asset must at least be an object with a string id.
    const asset = d?.asset;
    if (asset && typeof asset === 'object' && typeof (asset as { id?: unknown }).id === 'string') {
      const durSec =
        typeof d?.durSec === 'number' && Number.isFinite(d.durSec) && d.durSec > 0
          ? d.durSec
          : null;
      addRecordedClip(kind, asset as Box[string], durSec);
      return;
    }
    // AFTER setMode, never before: enterCreate clears the pending time so that an arm
    // from anywhere else cannot inherit one. This is the single place that sets it.
    setMode('create', { kind });
    pendingAddAtMs = atMs;
  }
  if (timeCfg) stageEl.addEventListener('tl-add', onTlAdd);

  /**
   * The recorded clip joins the SEQUENCE ROW the way imported scenes do: born from the
   * manifest's clip kind, sized to the ACTIVE artboard (else the canvas) in that
   * frame's own coordinates, cover-fit so the take - already cropped to the export
   * frame by the recorder - fills the picture edge to edge, appended after the current
   * end of the row with its MEASURED length, one commit. Not "at the playhead": a seq
   * clip's start is owned by the magnetic pack (moveOverlay refuses it, by design), and
   * a colleague's clip belongs after what the template already plays. The row repacks
   * from array order, so appending IS the placement.
   */
  function addRecordedClip(kind: AddKind, asset: Box[string], durSec: number | null): void {
    const tc = timeCfg!;
    const boxes = getBoxes();
    const fi = activeFrameIndex(boxes);
    const fr = fi >= 0 ? boxes[fi]! : null;
    const rect = fr
      ? {
          x: num(fr[cfg.xField]),
          y: num(fr[cfg.yField]),
          w: num(fr[cfg.wField]),
          h: num(fr[cfg.hField]),
        }
      : { x: 0, y: 0, ...canvasWH() };
    // After the current sequence's end - never disturb existing timing (importAsScenes).
    let at = 0;
    for (const b of boxes) {
      if (String(b[tc.laneField] ?? '') !== 'seq') continue;
      const s = num(b[tc.startField], NaN);
      if (!Number.isFinite(s)) continue;
      const d = num(b[tc.durField], NaN);
      at = Math.max(at, s + (Number.isFinite(d) && d > 0 ? d : 3));
    }
    const id = freshId(boxes);
    const box: Box = {
      ...(kind.seed as Box | undefined),
      [cfg.idField]: id,
      [cfg.xField]: rect.x,
      [cfg.yField]: rect.y,
      [cfg.wField]: rect.w,
      [cfg.hField]: rect.h,
      ...(cfg.imageField ? { [cfg.imageField]: asset } : {}),
      ...(cfg.fitField ? { [cfg.fitField]: 'cover' } : {}),
      [tc.laneField]: 'seq',
      [tc.startField]: at,
      ...(durSec != null ? { [tc.durField]: durSec } : {}),
    };
    commit(assignFrames([...boxes, box], new Set([boxes.length])));
    openTimeline();
    timelinePanel?.selectAndReveal([id]);
  }

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
  let tlPlaying = false;
  function onTlTime(e: Event): void {
    if (!timeCfg || disposed) return;
    const d = (e as CustomEvent).detail as OnionTimeDetail | null | undefined;
    tlPlaying = d?.playing === true;
    onionFrom(d);
    renderChrome();
  }
  if (timeCfg) stageEl.addEventListener('tl-time', onTlTime);

  // ── onion skin: the ghost layer, lazily mounted, never in an export ──────────
  // The whole feature is off unless the panel says otherwise, so the module, its
  // stylesheet and every DOM node it makes cost exactly nothing to an editor that never
  // turns it on. The layer itself lives inside `overlay` - a stage SIBLING of
  // #tool-canvas carrying [data-export-hide] - so no export path can reach it; see
  // onion-skin.ts's module doc for the three independent guarantees.
  interface OnionTimeDetail {
    playing?: unknown;
    mode?: unknown;
    past?: unknown;
    future?: unknown;
    opacity?: unknown;
    activeIds?: unknown;
  }
  let onionSkin: OnionSkinHandle | null = null;
  let onionLoading = false;
  let onionState: OnionPaintState | null = null;

  function onionOff(): void {
    onionState = null;
    if (!onionSkin) return;
    try {
      onionSkin.destroy();
    } catch (e) {
      console.error(e);
    }
    onionSkin = null;
  }

  function onionFrom(d: OnionTimeDetail | null | undefined): void {
    const mode = d?.mode === 'filled' ? 'filled' : d?.mode === 'outline' ? 'outline' : '';
    if (!mode) {
      onionOff();
      return;
    }
    onionState = {
      mode,
      past: d?.past,
      future: d?.future,
      opacity: d?.opacity,
      active: d?.activeIds,
    };
    if (onionSkin) {
      onionSkin.paint(onionState);
      return;
    }
    if (onionLoading) return;
    onionLoading = true;
    void (async () => {
      try {
        const mod = await import('./onion-skin.ts');
        // The mode may have been turned off again while the chunk was in flight.
        if (disposed || !onionState) return;
        onionSkin = mod.mountOnionSkin({
          overlayEl: overlay,
          canvasEl,
          cfg,
          getBoxes,
          metricsOf: metrics,
        });
        onionSkin.paint(onionState);
      } catch (e) {
        console.error(e);
      } finally {
        onionLoading = false;
      }
    })();
  }

  /** Re-place the ghosts after a pan / zoom / resize - they are positioned in stage px
   *  from the model, exactly like the selection outline, so they move with it. */
  function paintOnion(): void {
    if (onionSkin && onionState) onionSkin.paint(onionState);
  }

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
  let motionPath: MotionPathHandle | null = null;
  let motionLoading = false;

  function motionOff(): void {
    if (!motionPath) return;
    try {
      motionPath.destroy();
    } catch (e) {
      console.error(e);
    }
    motionPath = null;
  }

  /** The ids whose paths should be on screen right now - possibly none. */
  function motionIds(boxes: Box[]): string[] {
    if (!timeCfg?.kfField || !selection.size || !timelinePanel?.isOpen()) return [];
    const out: string[] = [];
    for (const i of selIndices(boxes)) {
      // The cheap half of the gate lives here so an ordinary selection of ordinary
      // boxes never fetches the chunk at all: a box with no `kf` value cannot have a
      // path, and asking costs one field read. Everything past this point (parse,
      // sample, project) is the lazy module's job.
      const raw = boxes[i]?.[timeCfg.kfField];
      if (raw == null || raw === '') continue;
      out.push(idOf(boxes[i], i));
    }
    return out;
  }

  /**
   * Re-draw the paths. Called from `paintChrome` beside `paintOnion`, so a pan, a zoom,
   * a selection change and every `tl-time` all keep the line under the box it describes.
   */
  function paintMotion(): void {
    if (disposed || !timeCfg?.kfField) return;
    const ids = motionIds(getBoxes());
    if (motionPath) {
      motionPath.paint(ids);
      return;
    }
    if (!ids.length || motionLoading) return;
    motionLoading = true;
    void (async () => {
      try {
        const mod = await import('./motion-path.ts');
        // The selection may have changed (or the view gone) while the chunk was in
        // flight, so the paint below asks the model again rather than reusing `ids`.
        if (disposed || !timeCfg) return;
        motionPath = mod.mountMotionPath({
          overlayEl: overlay,
          geom: cfg,
          time: timeCfg,
          getBoxes,
          metricsOf: metrics,
          canvasSize: canvasWH,
        });
        motionPath.paint(motionIds(getBoxes()));
      } catch (e) {
        console.error(e);
      } finally {
        motionLoading = false;
      }
    })();
  }

  /** Open the panel (used by the rail button and after creating a timed box). */
  function openTimeline(): void {
    void ensureTimeline(true);
  }
  function toggleTimeline(): void {
    void ensureTimeline(!timelinePanel?.isOpen());
  }

  function destroyTimeline(): void {
    try {
      stageEl.removeEventListener('tl-add', onTlAdd);
    } catch {
      /* stage detached */
    }
    try {
      stageEl.removeEventListener('tl-time', onTlTime);
    } catch {
      /* stage detached */
    }
    // No panel means no playhead means nothing to be either side OF - and no arm, so
    // no motion path either (see motionIds).
    onionOff();
    motionOff();
    try {
      timelinePanel?.destroy();
    } catch (e) {
      console.error(e);
    }
    timelinePanel = null;
    // Unconditional, even if destroy() above threw: a leaked reserve permanently shrinks
    // the stage for every other tool mounted in this session.
    stageEl.style.removeProperty('--stage-reserve-bottom');
    dockRailForTimeline(false);
    try {
      canvasEl.dispatchEvent(new Event('canvas-resize'));
    } catch {
      /* stage detached */
    }
  }

  // ── connectors (opt-in via canvas.connect) ───────────────────────────────────
  // The overlay authors edges into a SEPARATE blocks input; the tool's hooks.js reads
  // {from,to} + current box geometry and draws the routed line. Deleting a box leaves
  // its edges in the data but they render to nothing (the hook skips unresolved ids),
  // so undo restores a box AND its lines in one step.
  const getEdges = (): Box[] => {
    if (!connectCfg) return [];
    const e = runtime.getModel().find((i) => i.id === connectCfg.input);
    return Array.isArray(e?.value) ? e!.value : [];
  };
  function commitEdges(next: Box[]): void {
    if (!connectCfg) return;
    onDirty?.(connectCfg.input);
    runtime.setInput(connectCfg.input, next);
  }
  // `freshEdgeId` + `toggleEdge` (plan 90) lived here: Connect mode's write into the
  // connectors input. Plan 96 P4 deleted both with the mode. An edge is not a thing any
  // more - a connector is a path box whose `bindStart`/`bindEnd` name the boxes its ends
  // are attached to, written by the endpoint-bind gesture below, and every tool's hook
  // converts any surviving edge row to one of those on load. `commitEdges` above stays as
  // the DRAIN: nothing calls it today, but a tool that still declares `canvas.connect`
  // keeps its read-only inspector rather than silently losing the ability to delete a row.
  // `createLine` (plan 90) lived here: the Line tool's write into the connectors input.
  // Plan 96 P2 deleted it. A line is a PATH BOX now - `commitPathBox`, the same call the
  // pen commits through - so there is no second place a line can come from, and the edge
  // row it used to mint had no nodes to edit. `toggleEdge` above stays: it is the Connect
  // mode's own write, which P4 migrates.
  const gridRound = (v: number): number => Math.round(v / gridSize) * gridSize;

  // ── coordinate mapping (transform-agnostic via the live canvas rect) ────────
  // The canvas/stage screen rects are INVARIANT for the duration of a box gesture
  // (dragging/resizing/rotating a box never pans or zooms the artboard - pan/zoom is
  // a separate stageNav interaction that fires the transform MutationObserver). So
  // cache them once per gesture instead of forcing a layout flush on every metrics()
  // call (~6 getBoundingClientRect + ~3 forced reflows per drag frame otherwise). The
  // cache is cleared on gesture end and on ANY geometry change (onStageMove clears it),
  // so a pan/zoom/resize/auto-scroll can never leave it stale.
  let gestureMetrics: Metrics | null = null;
  function metrics(): Metrics {
    if (gestureMetrics && gesture) return gestureMetrics; // trust the cache only while the gesture is live
    const cr = canvasEl.getBoundingClientRect();
    const sr = stageEl.getBoundingClientRect();
    const scale = cr.width / canvasWH().w || 1;
    const m = { cr, sr, scale };
    gestureMetrics = gesture ? m : null; // hold for the rest of the gesture; drop when idle
    return m;
  }
  const clientToNative = (cx: number, cy: number): Point => {
    const { cr, scale } = metrics();
    return { x: (cx - cr.left) / scale, y: (cy - cr.top) / scale };
  };
  const nativeToStage = (nx: number, ny: number, m: Metrics = metrics()): Point => ({
    x: m.cr.left - m.sr.left + nx * m.scale,
    y: m.cr.top - m.sr.top + ny * m.scale,
  });

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
  let frameOffCache: Map<HTMLElement, Point> | null = null;
  const frameOffsetOfEl = (el: Element): Point => {
    // No pages AND no frame primitive ⇒ no [data-pdf-page] frames exist, so skip the
    // ancestor walk entirely (a plain single-page editor hits this every gesture frame).
    // A frame-primitive tool (frameCfg) emits [data-pdf-page] pages at authored x/y even
    // with no `pages` config, so it must walk too - offsetLeft/offsetTop then report the
    // frame's own position and the frame-local drag math below works unchanged.
    if (!pages && !frameCfg) return { x: 0, y: 0 };
    const f = el.closest?.('[data-pdf-page]') as HTMLElement | null;
    // closest() matches the element ITSELF: a frame's own page element positions in
    // GLOBAL canvas space, so its offset is zero - subtracting its own offsetLeft/Top
    // here would teleport a dragged artboard to the canvas origin on the first move.
    if (!f || f === el) return { x: 0, y: 0 };
    if (frameOffCache) {
      let c = frameOffCache.get(f);
      if (!c) {
        c = { x: f.offsetLeft, y: f.offsetTop };
        frameOffCache.set(f, c);
      }
      return c;
    }
    return { x: f.offsetLeft, y: f.offsetTop };
  };

  // The live DOM element for box `id`. A frame-kind box has no `.lolly-box` - its
  // element IS the page (`.lolly-frame-page[data-frame-id]`), so fall back to it;
  // gestures then move the page directly and its frame-local children ride along.
  const liveBoxEl = (id: string): HTMLElement | null =>
    canvasEl.querySelector<HTMLElement>(`.lolly-box[data-box-id="${cssEscape(id)}"]`) ??
    canvasEl.querySelector<HTMLElement>(`.lolly-frame-page[data-frame-id="${cssEscape(id)}"]`);

  // ── DOM: overlay + toolbar ──────────────────────────────────────────────────
  const overlay = document.createElement('div');
  overlay.className = 'fc-overlay';
  overlay.setAttribute('data-export-hide', '');
  stageEl.appendChild(overlay);

  // Frame dimmer - a hole-punch scrim sized to the export frame (repositioned only
  // when the artboard's screen geometry changes - see scrimDirty). Its big outset
  // box-shadow faintly tints everything OUTSIDE the frame, so boxes dragged off the
  // artboard read as gently faded while staying fully visible + selectable. First
  // overlay child so the selection chrome, guides and ctxbar all paint above it.
  const frameScrim = document.createElement('div');
  frameScrim.className = 'fc-frame-scrim';
  overlay.appendChild(frameScrim);
  // M2 - the scrim only moves on pan/zoom/resize, NEVER on a box drag/hover/selection
  // change. onStageMove (the geometry-change path) sets this; paintChrome repositions
  // the 100vmax soft-shadow region only when it's set, dropping a metrics() + a big
  // shadow repaint from every drag/selection sync. Starts true so mount positions it.
  let scrimDirty = true;

  const rubber = document.createElement('div');
  rubber.className = 'fc-rubber';
  rubber.hidden = true;
  overlay.appendChild(rubber);

  const guidesEl = document.createElement('div'); // snap/alignment guide lines
  guidesEl.className = 'fc-guides';
  overlay.appendChild(guidesEl);

  // Design-only authored guides. Their compact top-level input means they follow the
  // document through URL mode, .lolly files, undo and collaboration, while the visibility
  // toggle remains a per-device editor preference. Other free-canvas tools declare no
  // `guides` input and pay no DOM or event-listener cost.
  const guideInput = designChrome
    ? runtime.getModel().find((model) => model.id === 'guides')
    : undefined;
  const GUIDE_VISIBILITY_KEY = 'lolly-design-guides-visible';
  const readGuideVisibility = (): boolean => {
    try { return localStorage.getItem(GUIDE_VISIBILITY_KEY) !== 'false'; }
    catch { return true; }
  };
  let authoringGuides: DesignGuidesHandle | null = guideInput
    ? mountDesignGuides({
        stageEl,
        canvasEl,
        read: () => runtime.getModel().find((model) => model.id === 'guides')?.value,
        commit: (value) => {
          onDirty?.('guides');
          runtime.setInput('guides', value);
        },
        initiallyVisible: readGuideVisibility(),
        onSelect: () => { selection.clear(); renderChrome(); },
        onInspect: () => inspectorPort?.reveal('guide'),
      })
    : null;
  const setGuidesVisible = (visible: boolean): void => {
    authoringGuides?.setVisible(visible);
    try { localStorage.setItem(GUIDE_VISIBILITY_KEY, String(visible)); } catch { /* best effort */ }
  };

  // Frame name labels (Figma-style) - one small tab above each artboard's top-left that
  // NAMES it and selects the FRAME on click. This is the reliable way to "edit the frame
  // itself": a frame is now reachable even when content covers its whole area, so clicking
  // empty frame space is no longer the only door in. Repositioned every sync from the MODEL
  // (like the selection chrome); the container is click-through so only the tabs take a hit.
  // frameCfg-gated → dead for every no-frames document. Cleaned up with the overlay.
  const frameLabels = document.createElement('div');
  frameLabels.className = 'fc-frame-labels';
  overlay.appendChild(frameLabels);
  frameLabels.addEventListener('pointerdown', (e) => e.stopPropagation());
  frameLabels.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement | null)?.closest<HTMLElement>('.fc-frame-label');
    if (!el) return;
    e.stopPropagation();
    const fid = el.dataset.frameId || '';
    const boxes = getBoxes();
    const idx = boxes.findIndex((b, i) => idOf(b, i) === fid);
    if (idx < 0) return;
    deselectEdge();
    selection = new Set(selectionForHit(boxes, idx, true)); // solo the frame
    renderChrome();
  });
  // Double-click renames it in place (plans/179 A10). The single click above has already
  // fired and soloed the frame, which is the right selection to be renaming.
  frameLabels.addEventListener('dblclick', (e) => {
    const el = (e.target as HTMLElement | null)?.closest<HTMLElement>('.fc-frame-label');
    if (!el) return;
    e.stopPropagation();
    e.preventDefault();
    startFrameRename(el, el.dataset.frameId || '');
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
    startFrameRename(el, el.dataset.frameId || '');
  });

  // Camera-gesture HUD (audit A2/A4). A camera drag commits on release and previews
  // NOTHING on the stage (section 8's "drags commit on release"), so a shift-drag tilt or an
  // empty-stage pan gives no feedback at all until the drop - the single biggest reason
  // the camera "shortcuts are very noticable". This readout is that feedback: the
  // ABSOLUTE tilt the drop will land (via `timelinePanel.cameraTiltPreview`, so it can
  // never disagree with the write's own clamp) or the pan offset. Hidden except during a
  // camera gesture; decorative to assistive tech (the committed pose is the panel's job
  // to announce), pointer-transparent so it never eats the drag it is describing.
  const camHud = document.createElement('div');
  camHud.className = 'fc-cam-hud';
  camHud.hidden = true;
  camHud.setAttribute('aria-hidden', 'true');
  overlay.appendChild(camHud);

  const camHudDeg = (n: number): string => `${n > 0 ? '+' : ''}${Math.round(n)}°`;
  const camHudPx = (n: number): string => `${n > 0 ? '+' : ''}${Math.round(n)}`;
  // Built with DOM + textContent, never innerHTML: the values are numbers and the labels
  // are `t()` strings, so nothing here needs escaping - and keeping it off the raw-HTML
  // path is why this readout is not one more sink the R10 guard has to vouch for.
  const camHudSpan = (cls: string, text: string): HTMLElement => {
    const s = document.createElement('span');
    s.className = cls;
    s.textContent = text;
    return s;
  };
  /** Show the tilt the drop would land - absolute, clamped, straight from the panel. */
  function showCamTiltHud(dRx: number, dRy: number): void {
    const p = timelinePanel?.cameraTiltPreview(getBoxes(), dRx, dRy) ?? null;
    camHud.replaceChildren(
      camHudSpan('fc-cam-hud-k', t('Tilt')),
      ...(p
        ? [
            camHudSpan('fc-cam-hud-v', `X ${camHudDeg(p.rx)}`),
            camHudSpan('fc-cam-hud-v', `Y ${camHudDeg(p.ry)}`),
          ]
        : [camHudSpan('fc-cam-hud-v', t('No keyframe here'))])
    );
    camHud.hidden = false;
  }
  /** Show the pan offset the drag has accumulated (native px - the model's own units). */
  function showCamPanHud(dx: number, dy: number): void {
    camHud.replaceChildren(
      camHudSpan('fc-cam-hud-k', t('Pan')),
      camHudSpan('fc-cam-hud-v', `X ${camHudPx(dx)}`),
      camHudSpan('fc-cam-hud-v', `Y ${camHudPx(dy)}`)
    );
    camHud.hidden = false;
  }
  function hideCamHud(): void {
    if (camHud.hidden) return;
    camHud.hidden = true;
    camHud.replaceChildren();
  }
  /** Arm the HUD + a mode cursor at the start of a camera gesture. */
  function startCamHud(tilt: boolean): void {
    stageEl.style.cursor = tilt ? 'move' : 'grabbing';
    if (tilt) showCamTiltHud(0, 0);
    else showCamPanHud(0, 0);
  }

  // First-run invite on an empty canvas - a blank editor is otherwise a mystery. Only
  // shown for tools that can add boxes; clicking it opens the same Add menu as the rail.
  const emptyHint = document.createElement('div');
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
  const flashEl = document.createElement('div');
  flashEl.className = 'fc-flash';
  flashEl.setAttribute('aria-hidden', 'true');
  flashEl.hidden = true;
  overlay.appendChild(flashEl);
  let flashTimer: ReturnType<typeof setTimeout> | 0 = 0;
  function flash(message: string): void {
    if (!message) return;
    flashEl.textContent = message;
    flashEl.hidden = false;
    if (flashTimer) clearTimeout(flashTimer);
    flashTimer = setTimeout(() => {
      flashEl.hidden = true;
      flashEl.textContent = '';
      flashTimer = 0;
    }, 5200);
    announce(message, { assertive: true });
  }

  /** No cursor to carry a mode, and no hover to reveal one. Read live, because a hybrid
   *  device answers differently depending on what the user last touched. */
  const coarsePointer = (): boolean => matchMedia('(pointer: coarse)').matches;

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
  const armHintEl = document.createElement('div');
  armHintEl.className = 'fc-armhint';
  armHintEl.hidden = true;
  const armHintTxt = document.createElement('span');
  armHintTxt.className = 'fc-armhint-txt';
  const armHintX = document.createElement('button');
  armHintX.type = 'button';
  armHintX.className = 'btn btn--sm fc-armhint-x';
  armHintX.textContent = t('Got it');
  armHintEl.append(armHintTxt, armHintX);
  overlay.appendChild(armHintEl);
  // Dismissed for the REST OF THE MOUNT, not just this arm: someone who has read the
  // sentence once does not need it on every subsequent add.
  let armHintOff = false;
  armHintX.addEventListener('click', () => {
    armHintOff = true;
    hideArmHint();
  });

  /**
   * Kinds whose gesture ends at an ASSET PICKER rather than at a finished object - the
   * drag places the frame, then the library opens. Worth saying, because a drag that
   * ends in a dialog is a different promise from one that ends in a shape.
   *
   * The noun is PER KIND, and it is the noun the picker itself will use a moment later
   * (`pickImage`'s dialog title): one sentence for the lot said "place an image" when the
   * user had just chosen Video, Animation or Clip - in the very chip whose point is to
   * say what the armed mode is waiting for. Keyed on the add-kind's `id`, because all
   * four of these seed the same `kind: 'image'`.
   */
  const assetArmHint = (id: string): string | null => {
    switch (id) {
      case 'video':
      case 'clip':
        return t('Drag on the canvas to place a video, then choose one.');
      case 'lottie':
        return t('Drag on the canvas to place an animation, then choose one.');
      case 'tool':
        return t('Drag on the canvas to place a tool, then choose one.');
      case 'image':
        return t('Drag on the canvas to place an image, then choose one.');
      default:
        return null;
    }
  };

  function showArmHint(kind: AddKind | null | undefined): void {
    if (armHintOff || !kind) {
      hideArmHint();
      return;
    }
    const seedKind = kind.seed != null ? String(kind.seed[cfg.kindField] ?? '') : '';
    const asset = assetArmHint(kind.id);
    if (coarsePointer()) {
      // No cursor and no drag-to-size: a finger TAPS and the box appears at its seed size.
      const isText = kind.id === 'text' || seedKind === 'text';
      armHintTxt.textContent = isText
        ? t('Tap the canvas to place text')
        : t('Tap the canvas to place it');
    } else if (kind.id === 'audio' || seedKind === 'audio') {
      armHintTxt.textContent = t('Drag on the canvas to place a sound, then choose one.');
    } else if (asset) {
      armHintTxt.textContent = asset;
    } else if (seedKind === 'image') {
      armHintTxt.textContent = t('Drag on the canvas to place an image, then choose one.');
    } else {
      // The kind's own label, so the sentence names the thing the user just chose
      // ("draw: Circle", "draw: Artboard") rather than a generic "shape". No article and
      // no lowercasing: an article baked into the English source made "draw a artboard"
      // that no translator could repair, and `toLocaleLowerCase()` both destroyed a
      // German noun's capital and read the HOST locale rather than the app's.
      // tRaw, not t: this is a TEXT sink, where an escaped apostrophe in a translated
      // kind label would be shown literally as `&#39;`.
      armHintTxt.textContent = tRaw('Drag on the canvas to draw: {kind}. Press Escape to cancel.', {
        kind: kind.label ? t(kind.label) : kind.id,
      });
    }
    armHintEl.hidden = false;
  }
  function hideArmHint(): void {
    if (!armHintEl.hidden) armHintEl.hidden = true;
  }

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
  const offPlayheadEl = document.createElement('div');
  offPlayheadEl.className = 'fc-offplayhead';
  offPlayheadEl.hidden = true;
  const offPlayheadTxt = document.createElement('span');
  offPlayheadTxt.className = 'fc-offplayhead-txt';
  offPlayheadTxt.textContent = t('Not on screen at the playhead');
  const offPlayheadGo = document.createElement('button');
  offPlayheadGo.type = 'button';
  offPlayheadGo.className = 'btn btn--primary btn--sm fc-offplayhead-go';
  offPlayheadGo.textContent = t('Go to it');
  // A close (plans/184 section 6, S3): the chip read as a stuck error with no way to
  // put it away. Dismissed for THIS selection only - a new selection off the playhead
  // raises it again, since that is a new fact.
  const offPlayheadX = document.createElement('button');
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
  let offPlayheadAtMs = 0;
  // Guards the announcement so entering the state speaks ONCE, not on every repaint
  // (a pan, a zoom and every tl-time all repaint the chrome).
  let lastOffPlayheadKey = '';
  let dismissedOffPlayheadKey = '';
  offPlayheadGo.addEventListener('click', () => {
    stageEl.dispatchEvent(
      new CustomEvent('fc-seek', { bubbles: true, detail: { atMs: offPlayheadAtMs } })
    );
  });
  offPlayheadX.addEventListener('click', () => {
    dismissedOffPlayheadKey = lastOffPlayheadKey;
    offPlayheadEl.hidden = true;
  });

  /**
   * Raise the toast for an off-playhead selection. At the foot of the stage, beside the
   * timeline it is about (plans/184 section 6, S3) - it used to sit dead-centre on the
   * canvas, where it read as a stuck error over the work. The CSS owns the position.
   *
   * Two suppressions, both deliberate: no timeline panel means no clock means nothing is
   * ever `seq-off` (so this can only be a stale class), and during PLAYBACK a scene
   * leaving the screen is expected rather than a problem to report.
   */
  function showOffPlayhead(boxes: Box[], idx: number[]): void {
    if (!timeCfg || !timelinePanel || tlPlaying || !idx.length) {
      hideOffPlayhead();
      return;
    }
    const b = boxes[idx[0]!];
    // A field read, not arithmetic: the box's own authored start, in ms.
    offPlayheadAtMs = Math.max(0, Number(b?.[timeCfg.startField]) * 1000) || 0;
    const key = idx
      .map((k) => idOf(boxes[k], k))
      .sort()
      .join(',');
    if (key !== lastOffPlayheadKey) {
      lastOffPlayheadKey = key;
      announce(t('This card is not on screen at the playhead. Go to it to edit it.'));
    }
    offPlayheadEl.hidden = key === dismissedOffPlayheadKey;
  }
  function hideOffPlayhead(): void {
    if (!offPlayheadEl.hidden) offPlayheadEl.hidden = true;
    lastOffPlayheadKey = '';
    dismissedOffPlayheadKey = '';
  }

  // ── frames-as-scenes: the "play in order" invitation (plan 92) ───────────────
  // A one-shot, non-blocking prompt shown when the timeline OPENS on a frame doc whose
  // frames are NOT yet sequenced: "Play your N frames in order?" [Place in order][Not now].
  // Accepting lays the frames end-to-end in time on the scenes lane (one commit, one undo
  // step) so the clock gates the canvas to one frame at a time; declining dismisses for the
  // session. Gated on frameCfg + timeCfg both present - dead on any tool without frames or
  // without a time model. Built node-by-node (static text, `btn` recipes) like the
  // off-playhead chip; a stage sibling of #tool-canvas carrying [data-export-hide], so no
  // export path sees it.
  let seqPromptDismissed = false;
  const seqPromptEl = document.createElement('div');
  seqPromptEl.className = 'fc-frameseq';
  seqPromptEl.hidden = true;
  seqPromptEl.setAttribute('role', 'status');
  const seqPromptTxt = document.createElement('span');
  seqPromptTxt.className = 'fc-frameseq-txt';
  const seqPromptPlace = document.createElement('button');
  seqPromptPlace.type = 'button';
  seqPromptPlace.className = 'btn btn--primary btn--sm fc-frameseq-go';
  seqPromptPlace.textContent = t('Place in order');
  const seqPromptSkip = document.createElement('button');
  seqPromptSkip.type = 'button';
  seqPromptSkip.className = 'btn btn--sm';
  seqPromptSkip.textContent = t('Not now');
  seqPromptEl.append(seqPromptTxt, seqPromptPlace, seqPromptSkip);
  overlay.appendChild(seqPromptEl);

  function hideSeqPrompt(): void {
    if (!seqPromptEl.hidden) seqPromptEl.hidden = true;
  }

  /** The frames-as-scenes field config, or null when this tool has no frames/time model. */
  function frameSeqCfg(): {
    kindField: string;
    frameKind: string;
    startField: string;
    durField: string;
  } | null {
    if (!frameCfg || !timeCfg) return null;
    return {
      kindField: cfg.kindField,
      frameKind: frameCfg.frameKind,
      startField: timeCfg.startField,
      durField: timeCfg.durField,
    };
  }

  function frameCount(boxes: Box[]): number {
    if (!frameCfg) return 0;
    let n = 0;
    for (const b of boxes) if (b && String(b[cfg.kindField]) === frameCfg.frameKind) n++;
    return n;
  }

  seqPromptPlace.addEventListener('click', () => {
    if (!frameCfg || !timeCfg) {
      hideSeqPrompt();
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
    commitSequenced(
      sequenceFramesInOrder(getBoxes(), {
        defaultDurMs: 3000,
        lane: 'seq',
        ...(tr
          ? { transitionField: tr, docTransition: docTransitionValue() }
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
    hideSeqPrompt();
    announce(t('Frames placed in order. Scrub the playhead to preview your slideshow.'));
  });
  seqPromptSkip.addEventListener('click', () => {
    seqPromptDismissed = true;
    hideSeqPrompt();
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

  let narrateBusy = false;

  /** The field map lib/narration.ts writes through, built from THIS tool's canvas
   *  config so the pure module never has to know Design's names by heart. */
  function narrationFields(): NarrationFields | null {
    if (!frameCfg || !timeCfg || !cfg.groupField) return null;
    return {
      ...DESIGN_NARRATION_FIELDS,
      idField: cfg.idField,
      kindField: cfg.kindField,
      frameField: frameCfg.frameField,
      frameKind: frameCfg.frameKind,
      orderField: frameCfg.orderField || 'order',
      groupField: cfg.groupField,
      laneField: timeCfg.laneField,
      startField: timeCfg.startField,
      durField: timeCfg.durField,
      enterField: timeCfg.enterField,
      exitField: timeCfg.exitField,
      enterMsField: timeCfg.enterMsField,
      exitMsField: timeCfg.exitMsField,
      notesField: FRAME_NOTES_FIELD,
      ...(timeCfg.duckField ? { duckField: timeCfg.duckField } : {}),
      ...(cfg.imageField ? { assetField: cfg.imageField } : {}),
      ...(cfg.textField ? { textField: cfg.textField } : {}),
    };
  }

  /** A document-level number input, or `fallback` when it is unset or nonsense. */
  function docNumInput(id: string, fallback: number): number {
    const v = runtime.getModel().find((i) => i.id === id)?.value;
    const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  }

  /** The document's lead-in and tail, with the manifest's own defaults. Read fresh every
   *  time: both are doc inputs the author can change between two narrate runs. */
  function narrationTiming(): NarrationTiming {
    return {
      leadInMs: docNumInput('narrationLeadInMs', 400),
      tailMs: docNumInput('narrationTailMs', 600),
    };
  }

  /**
   * Frames re-flowed, and everything anchored to them moved with it (plans/180 T7).
   *
   * `sequenceFramesInOrder` writes FRAME rows only - a Design box stores absolute
   * film-clock seconds, so a re-pack that lengthens slide one leaves slide two's voice,
   * its captions and its build fragments speaking over slide one. One commit, so the
   * whole re-flow is a single undo step.
   */
  function commitSequenced(placed: Box[]): void {
    const f = narrationFields();
    commit(f ? reanchorNarration(placed, f, narrationTiming()) : placed);
  }

  /** One slide's narration status, for the navigator dot and the inspector button. */
  function narrationStatusOf(frameId: string): NarrationStatus {
    const f = narrationFields();
    return f ? narrationStatusFor(getBoxes(), f, frameId) : 'none';
  }

  /** How many slides carry speaker notes at all - what greys the deck-wide row. */
  function framesWithNotes(): number {
    const f = narrationFields();
    if (!f) return 0;
    let n = 0;
    for (const fr of narrationFramesOf(getBoxes(), f)) if (fr.spoken) n++;
    return n;
  }

  async function narrateDeck(frameId?: string): Promise<void> {
    if (disposed || !frameCfg || !timeCfg || !cfg.groupField) return;
    // A second press while a run is in flight used to do nothing at all - no toast, no
    // announcement, no state change - so the button read as broken. Say what is going on.
    if (narrateBusy) {
      announce(t('A narration run is already going.'));
      return;
    }
    const speech = (host as unknown as HostV1).speech;
    if (!speech?.isAvailable()) return;
    narrateBusy = true;
    const release = (): void => {
      narrateBusy = false;
    };
    try {
      // Lazy for the Script-audio reason: the whole speech path is a chunk nothing
      // else on this canvas needs until somebody asks for a voice.
      const [{ openNarrateConsent }, { currentLang }] = await Promise.all([
        import('../lib/narration.ts'),
        import('../i18n.ts'),
      ]);
      const fields = narrationFields();
      if (!fields) {
        release();
        return;
      }
      const docText = (id: string): string => {
        const v = runtime.getModel().find((i) => i.id === id)?.value;
        return v == null ? '' : String(v);
      };
      const tr = frameCfg.transitionField;
      await openNarrateConsent(
        host as unknown as Parameters<typeof openNarrateConsent>[0],
        {
          fields,
          getBoxes,
          commit,
          repack: (floors) => {
            // One commit for both halves: the frames re-flow, then every clip, caption and
            // build fragment anchored to them follows (plans/180 T7).
            commitSequenced(
              sequenceFramesInOrder(getBoxes(), {
                defaultDurMs: 3000,
                lane: 'seq',
                minDurMs: floors,
                idField: cfg.idField,
                ...(tr
                  ? { transitionField: tr, docTransition: docTransitionValue() }
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
          },
          voice: docText('narrationVoice'),
          speed: docNumInput('narrationSpeed', 1),
          timing: narrationTiming(),
          // Asking for ONE slide is always a deliberate re-record, so it never waits
          // for the notes to have changed.
          ...(frameId ? { frameIds: [frameId], force: true } : {}),
          lang: currentLang(),
        },
        { onDismiss: release, onSettled: release }
      );
    } catch (err) {
      (host as unknown as HostV1).log?.('warn', `narrate failed - ${String(err)}`);
      release();
    }
  }

  /**
   * Offer to sequence the frames when the timeline is open - but only when frames exist and
   * NONE are timed yet (never nag once sequenced), and only once per session (a decline
   * sticks). Positioned by CSS at the top-centre of the overlay, out of the toolbar's way.
   */
  function maybePromptSequenceFrames(): void {
    if (disposed || seqPromptDismissed) return;
    const sc = frameSeqCfg();
    if (!sc || !timelinePanel?.isOpen()) {
      hideSeqPrompt();
      return;
    }
    const boxes = getBoxes();
    const n = frameCount(boxes);
    if (n < 1 || framesAreSequenced(boxes, sc)) {
      hideSeqPrompt();
      return;
    }
    seqPromptTxt.textContent =
      n === 1
        ? t('Play this frame in the timeline?')
        : tRaw('Play your {n} frames in order?').replace('{n}', String(n));
    seqPromptEl.hidden = false;
  }

  // Connector preview layer (opt-in): the "rubber" line while linking two cards, and a
  // live redraw of every edge while a connected card is being dragged (so the lines
  // follow in real time - the tool's real connector <svg> only re-renders on commit).
  // An <svg> covering the canvas in stage space, drawn in NATIVE coords via its viewBox.
  const connectLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
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
  const penLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  penLayer.setAttribute('class', 'fc-pen-layer');
  penLayer.style.position = 'absolute';
  penLayer.style.left = '0';
  penLayer.style.top = '0';
  penLayer.style.overflow = 'visible';
  penLayer.style.pointerEvents = 'none';
  penLayer.style.display = 'none';
  overlay.appendChild(penLayer);

  const chrome = document.createElement('div'); // selection outlines + handles
  chrome.className = 'fc-chrome';
  overlay.appendChild(chrome);

  // Node/handle chrome, in its OWN container so it is built and torn down independently of
  // the selection chrome - the two are never on screen together, but they key on different
  // things (a node set vs a selection set) and sharing a container would make one rebuild
  // the other. Same build-once/reposition-many discipline as `chromeNodes`, for the reason
  // documented there: a 40-node path re-created per drag frame is far worse than the ~10
  // selection nodes that motivated the optimisation in the first place.
  const penChrome = document.createElement('div');
  penChrome.className = 'fc-pen-chrome';
  overlay.appendChild(penChrome);
  let penChromeKey: string | null = null;
  let penChromeNodes: { nodes: HTMLElement[]; arms: HTMLElement[]; dots: HTMLElement[] } | null =
    null;
  function clearPenChrome(): void {
    penChrome.innerHTML = '';
    penChromeKey = null;
    penChromeNodes = null;
  }

  const ctxbar = document.createElement('div'); // contextual controls
  ctxbar.className = 'fc-ctxbar';
  ctxbar.hidden = true;
  ctxbar.addEventListener('pointerdown', (e) => e.stopPropagation());
  overlay.appendChild(ctxbar);
  let ctxSelKey: string | null = null; // sorted selected-id signature; rebuild ctxbar when it changes

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
  let ctxShown = false;
  const CTX_ENTER = 'fc-ctxbar-enter';
  ctxbar.addEventListener('animationend', () => ctxbar.classList.remove(CTX_ENTER));
  function showCtxBar(): void {
    if (ctxShown && !ctxbar.hidden) return;
    ctxShown = true;
    ctxbar.hidden = false;
    // Reduced motion (OS query OR the app pref): appear instantly. No movement, and no
    // transform written at all, so the popover containing-block trap stays untouched.
    if (prefersReducedMotion()) return;
    ctxbar.classList.remove(CTX_ENTER);
    void ctxbar.offsetWidth; // restart the animation on a re-selection
    ctxbar.classList.add(CTX_ENTER);
  }
  function hideCtxBar(): void {
    ctxShown = false;
    ctxbar.hidden = true;
    ctxbar.classList.remove(CTX_ENTER);
  }

  // M1 - selection chrome (outline(s) + resize/rotate handles) is built ONCE per
  // selection set (keyed exactly like the ctxbar) and only REPOSITIONED on later
  // syncs. Rebuilding ~10 nodes + re-binding a pointerdown on each, every drag/pan/
  // zoom frame, was the bulk of a sync's DOM cost. chromeNodes holds the live nodes
  // so a reposition is pure style writes; teardown+rebuild happens only when the set
  // changes. handles[] order matches the build order (HANDLES for single; nw,ne,se,sw
  // for group) so positioning can address them positionally.
  let chromeKey: string | null = null;
  let chromeNodes: {
    outlines: HTMLElement[]; // one .fc-outline per selected box, in idx order
    groupOutline: HTMLElement | null; // multi-select only
    handles: HTMLElement[]; // resize (single) / corner (group) handles
    stem: HTMLElement | null; // rotate stem
    rot: HTMLElement | null; // rotate handle
  } | null = null;
  function clearChrome(): void {
    chrome.innerHTML = '';
    chromeKey = null;
    chromeNodes = null;
  }

  // Dock wrapper flex-centres the rail at rest without a transform on the rail
  // itself, and carries the left/top of a DRAGGED rail for the same reason
  // (a transform/backdrop-filter on either would capture the colour popover's
  // fixed positioning - see the .fc-toolbar-dock CSS note).
  const toolbarDock = document.createElement('div');
  toolbarDock.className = 'fc-toolbar-dock';
  toolbarDock.setAttribute('data-export-hide', '');
  const toolbar = document.createElement('div');
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
  const grip = document.createElement('div');
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
  let railDrag: { pointerId: number; dx: number; dy: number; lx: number; ly: number } | null = null;
  let railWant: { left: number; top: number } | null = null;
  let railRaf = 0;
  /**
   * WHERE THE RAIL IS RIGHT NOW. Two panels can ask for it, and they must not both get
   * it: the open NAVIGATOR takes the buttons into a grid at the top of its own column,
   * and the open TIMELINE turns the rail into a fixed-width left column of its own.
   * With two independent mechanisms the rail ended up docked left for the timeline while
   * the navigator was open beside it, clipping the layer names - so there is one mode,
   * two standing requests, and one applier (`applyRailMode`).
   */
  let railMode: 'float' | 'timeline' | 'navigator' = 'float';
  /** The timeline's standing request for the rail (see dockRailForTimeline). */
  let tlWantsRail = false;
  /** The navigator's, which wins: an open column already IS the left sidebar. */
  let navWantsRail = false;
  /** The docked rail column's own width in px, measured on the way in (see the dock). */
  let railDockW = 0;
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
  let navReserveLeft = 0;
  let inspectorReserveRight = 0;
  function syncStageReserves(): void {
    // The rail gets a band of its own ONLY while the timeline made it a column. With the
    // navigator open the buttons sit inside that column, so the navigator's width is the
    // whole left band and a rail allowance on top of it would double-count the same px.
    const railBand = railMode === 'timeline' ? railDockW + 12 : 0;
    const left = Math.max(0, Math.round(navReserveLeft + railBand));
    // Equality-guarded, like reserveBottom: the stage has a ResizeObserver, and an
    // unconditional write plus an unconditional `canvas-resize` is a loop.
    let changed = false;
    const put = (el: HTMLElement, prop: string, px: number): void => {
      const next = px > 0 ? `${px}px` : '';
      if (el.style.getPropertyValue(prop) === next) return;
      if (next) el.style.setProperty(prop, next);
      else el.style.removeProperty(prop);
      changed = true;
    };
    put(stageEl, '--stage-reserve-left', left);
    // The RIGHT band is always zero now: the inspector and every other right-hand panel
    // ride the app-wide edge dock, which insets `#view` through `--dock-w` instead of
    // reserving stage width. Written as a removal rather than skipped, so a stage left
    // with a right reserve by an earlier layout is cleared.
    put(stageEl, '--stage-reserve-right', 0);
    put(stageEl, '--ldock-rail-w', railBand);
    // <html>, not the stage: the fixed back pill insets past the dock with the app-wide
    // `--dock-w` pattern, and it is not a child of the stage.
    put(document.documentElement, '--ldock-w', railBand);
    if (changed) {
      try {
        canvasEl.dispatchEvent(new Event('canvas-resize'));
      } catch {
        /* stage detached */
      }
    }
  }
  /**
   * The navigator's own slot for the tool rail, present only while that column is open
   * (design-navigator.ts hides it with the rest of the body when the column collapses to
   * its dot rail). Read off the DOM rather than handed over: the navigator is mounted by
   * the tool view as a stage sibling, and neither module imports the other, so the data
   * attribute is the whole contract - the same shape as this file's `.tl-panel` reads.
   */
  function navRailSlot(): HTMLElement | null {
    const slot = stageEl.querySelector<HTMLElement>('[data-nav-rail-slot]');
    return slot && !slot.hidden ? slot : null;
  }
  /**
   * The columns' single door onto the reserves (design-ports' `setColumnWidths`), and
   * with it the moment the rail changes hands: a column reports its width on mount, on
   * every open/close and on every frame of a resize drag, which is exactly when its rail
   * slot appears and disappears.
   */
  function setColumnWidths(left: number, right: number): void {
    const l = Number.isFinite(left) ? Math.max(0, left) : 0;
    const r = Number.isFinite(right) ? Math.max(0, right) : 0;
    const wantNav = !!navRailSlot();
    if (l === navReserveLeft && r === inspectorReserveRight && wantNav === navWantsRail) return;
    navReserveLeft = l;
    inspectorReserveRight = r;
    navWantsRail = wantNav;
    applyRailMode();
    syncStageReserves();
    // A rail the user had already dragged carries an inline position that predates the
    // column: re-clamp it so opening the navigator pushes it clear rather than leaving
    // it sitting over the rows (the CSS default position follows the band on its own).
    reclampRail();
  }
  /**
   * WHERE THE RAIL WAS WHEN THE PANEL TOOK IT (plans/179 T2). The auto-dock strips the
   * dock's `is-detached` + inline left/top to turn it into a fixed-width column, so
   * without a snapshot the undock has nothing to put back and the rail sits wherever
   * the last thing to write a position left it - the reported "rail stranded at x=-33,
   * a third of it off-screen". `null` means it was NOT detached (the CSS edge park),
   * which is a position too and has to be restored as faithfully as a dragged one.
   */
  let railPreDock: { left: number; top: number } | null = null;
  let railWasDetached = false;
  // Self-gating (no-op unless the flag is on and motion is allowed); wobble owns the
  // transform on the dock (only ever set mid-drag, while the popover is closed).
  const wobble = attachWobble(toolbarDock);
  /**
   * The stage band the rail must never be dragged into. Three things can live in the
   * foot of the stage, and a rail parked under any of them is invisible (the rail is
   * `opacity: 0` at rest) AND unclickable:
   *   - the docked TIMELINE panel - `z-index: 22` and `pointer-events: auto`, well above
   *     the dock's 16, so it both paints over the rail and swallows its pointer;
   *   - the export pill, wherever a host still shows one;
   *   - the recorder tools' "Warm the mic / Record" control at the stage foot.
   * Measured live rather than read off `--stage-reserve-bottom`: that custom property is
   * only an input to fitCanvas and does not shrink the stage box, so the stage rect still
   * spans the panel band.
   */
  function railReserveBottom(sr: DOMRect): number {
    let reserve = 0;
    for (const sel of ['.tl-panel', '.render-pill', '.canvas-record-btn', '.canvas-record-timer']) {
      for (const el of Array.from(viewEl.querySelectorAll<HTMLElement>(sel))) {
        // getClientRects(), not offsetParent: a `position: fixed` element (the mobile
        // export pill is exactly that) reports a null offsetParent while being perfectly
        // visible, so the old guard could never see it.
        if (el.hidden || !el.getClientRects().length) continue;
        const r = el.getBoundingClientRect();
        if (r.height > 0 && r.bottom > sr.bottom - 4)
          reserve = Math.max(reserve, sr.bottom - r.top);
      }
    }
    return Math.max(0, Math.round(reserve));
  }
  function placeRail(want: { left: number; top: number }): void {
    const rr = toolbar.getBoundingClientRect();
    const sr = stageEl.getBoundingClientRect();
    const pos = clampRailPos(
      want,
      { w: rr.width, h: rr.height },
      { w: sr.width, h: sr.height },
      // The navigator's band, never the rail's own share of the reserve (while the
      // timeline has docked the rail it IS that column and is not draggable anyway).
      { reserveBottom: railReserveBottom(sr), reserveLeft: navReserveLeft }
    );
    railSession = pos;
    toolbarDock.classList.add('is-detached');
    toolbarDock.style.left = pos.left + 'px';
    toolbarDock.style.top = pos.top + 'px';
  }
  /** Keep a detached rail inside the stage when the stage itself changes size. */
  function reclampRail(): void {
    // While a panel holds the rail, a stage resize must not re-detach it - the
    // remembered position comes back when that panel lets go.
    if (railMode !== 'float' && !toolbarDock.classList.contains('is-detached')) return;
    if (railSession) placeRail(railSession);
  }
  /**
   * REMEMBER, BEFORE A PANEL TAKES IT. Both docks strip the dock's `is-detached` and its
   * inline left/top, which is also the evidence of where the rail was, so the snapshot
   * has to happen while the rail is still floating.
   */
  function snapshotRailHome(): void {
    railWasDetached = toolbarDock.classList.contains('is-detached');
    railPreDock = railSession ? { ...railSession } : null;
  }
  /**
   * GIVE IT BACK, explicitly (plans/179 T2). `railSession` first, because it is the
   * user's own last word on where the rail lives and it survives a dock - so a drag that
   * happened before it (or in another editor this page session) still wins. Then the
   * pre-dock snapshot. And if neither says "detached", the rail was parked on the CSS
   * edge: clear the column's leftovers rather than leaving the dock in whatever
   * half-state the panel styles put it in, which is how it ended up mostly off-screen.
   */
  function restoreFloatingRail(): void {
    const back = railSession ?? railPreDock;
    if (back && (railWasDetached || railSession)) {
      placeRail(back);
    } else {
      toolbarDock.classList.remove('is-detached');
      toolbarDock.style.removeProperty('left');
      toolbarDock.style.removeProperty('top');
    }
    railPreDock = null;
    railWasDetached = false;
  }
  /** Put the buttons in the navigator's slot (idempotent - a rebuilt slot re-homes). */
  function homeRailInNav(): void {
    const slot = navRailSlot();
    if (!slot || toolbar.parentElement === slot) return;
    slot.appendChild(toolbar);
  }
  /**
   * Navigator open: the rail is not a second left column beside it, it is the grid of
   * icons at the top OF it (Andy, 2026-09-02: "if the left dock is on we should dock the
   * fc-toolbar too, perhaps wrap the icons in a grid up the top of the toolbar"). Every
   * button keeps its element, so its handler, tooltip and accessible name travel with it;
   * only the drag grip and the separators go, and those are CSS (`.fc-toolbar--grid`).
   */
  function enterNavDock(): void {
    toolbarDock.classList.remove('is-detached');
    toolbarDock.style.removeProperty('left');
    toolbarDock.style.removeProperty('top');
    toolbar.classList.add('fc-toolbar--grid');
    homeRailInNav();
  }
  function leaveNavDock(): void {
    toolbar.classList.remove('fc-toolbar--grid');
    if (toolbar.parentElement !== toolbarDock) toolbarDock.appendChild(toolbar);
  }
  /**
   * Timeline open with no navigator: the rail stops floating and becomes a fixed-width
   * left PANEL - the mirror of the right edge-dock column (export settings / player).
   * Content is NUDGED right, never overlapped: the measured panel width is handed to
   * `syncStageReserves`, the one writer of `--stage-reserve-left`, `--ldock-rail-w` and
   * `--ldock-w`. Dragging is off while docked - a set-width panel has nowhere to drag to.
   * The panel look itself is CSS (`.has-tl-reserve` in editor.css).
   */
  function enterTimelineDock(): void {
    toolbarDock.classList.remove('is-detached');
    toolbarDock.style.removeProperty('left');
    toolbarDock.style.removeProperty('top');
    // Measure the floating rail BEFORE the panel styles land, +gutters. A rail that
    // cannot be measured (display:none mid-navigation) falls back to its design width.
    railDockW = Math.ceil(toolbar.getBoundingClientRect().width) || 46;
    stageEl.classList.add('has-tl-reserve');
  }
  function leaveTimelineDock(): void {
    railDockW = 0;
    stageEl.classList.remove('has-tl-reserve');
  }
  /**
   * The one applier. The navigator wins over the timeline: with the column open the rail
   * is inside it, and when the column closes the timeline's own left dock takes over
   * again, so today's behaviour stands wherever there is no navigator.
   */
  function applyRailMode(): void {
    const want = navWantsRail ? 'navigator' : tlWantsRail ? 'timeline' : 'float';
    if (want === railMode) {
      // Same mode, but a navigator re-render replaces the slot node under us.
      if (want === 'navigator') homeRailInNav();
      return;
    }
    if (railMode === 'float') snapshotRailHome();
    else if (railMode === 'timeline') leaveTimelineDock();
    else leaveNavDock();
    railMode = want;
    if (want === 'timeline') enterTimelineDock();
    else if (want === 'navigator') enterNavDock();
    else restoreFloatingRail();
  }
  /** The timeline's half of that request (the panel calls this as it opens/closes). */
  function dockRailForTimeline(on: boolean): void {
    // Desktop only, like the right edge-dock: a fixed left column is dead space on a
    // phone OR a short touch landscape, where CSS turns this same rail into the
    // horizontal palette above the timeline. Reserving that palette's full 828px
    // width as a left column reduced the artboard to the 40px safety floor.
    // Feature-detect matchMedia (absent under jsdom/CLI, where docking is harmless).
    if (
      on &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia(
        '(pointer: coarse) and (max-width: 640px), (pointer: coarse) and (max-height: 430px)'
      ).matches
    )
      return;
    if (on === tlWantsRail) return;
    tlWantsRail = on;
    applyRailMode();
    syncStageReserves();
  }
  const onRailDown = (e: PointerEvent): void => {
    if (e.button !== 0 || railDrag) return;
    if (railMode !== 'float') return; // a docked rail has a set width and place - no drag
    // Buttons/fields already stop pointerdown before it reaches here; this is the
    // belt to that pair of braces, and it keeps the colour trigger draggable-proof.
    if ((e.target as HTMLElement).closest?.('button, input, select, .fc-color-btn')) return;
    const rr = toolbar.getBoundingClientRect();
    railDrag = {
      pointerId: e.pointerId,
      dx: e.clientX - rr.left,
      dy: e.clientY - rr.top,
      lx: e.clientX,
      ly: e.clientY,
    };
    closePopover();
    closeMorePanel();
    toolbarDock.classList.add('is-dragging');
    try {
      toolbar.setPointerCapture(e.pointerId);
    } catch {
      /* no pointer capture (jsdom) */
    }
    wobble.grab(e.clientX, e.clientY);
    e.preventDefault();
    e.stopPropagation();
  };
  const onRailMove = (e: PointerEvent): void => {
    if (!railDrag || e.pointerId !== railDrag.pointerId) return;
    // No button held any more → the pointerup was lost (a capture stolen by the export
    // shutter's `pointer-events: none`, a devtools break). Finish the drag instead of
    // letting a bare hover keep sliding the rail around the stage.
    if (e.type === 'pointermove' && e.buttons === 0) {
      onRailUp(e);
      return;
    }
    // Per-move deltas for the wobble (not throttled) - the dock's left/top is unchanged.
    wobble.drag(e.clientX - railDrag.lx, e.clientY - railDrag.ly);
    railDrag.lx = e.clientX;
    railDrag.ly = e.clientY;
    const sr = stageEl.getBoundingClientRect();
    railWant = { left: e.clientX - sr.left - railDrag.dx, top: e.clientY - sr.top - railDrag.dy };
    // One style write per frame (the timeline resize grip's shape). Live-mutating
    // only - a rail position is never committed to the model.
    if (railRaf) return;
    railRaf = requestAnimationFrame(() => {
      railRaf = 0;
      if (railWant) placeRail(railWant);
    });
  };
  const onRailUp = (e: PointerEvent): void => {
    if (!railDrag || e.pointerId !== railDrag.pointerId) return;
    if (railRaf) {
      cancelAnimationFrame(railRaf);
      railRaf = 0;
    }
    if (railWant) placeRail(railWant);
    railWant = null;
    try {
      toolbar.releasePointerCapture(railDrag.pointerId);
    } catch {
      /* never captured */
    }
    railDrag = null;
    toolbarDock.classList.remove('is-dragging');
    wobble.release();
  };
  toolbar.addEventListener('pointerdown', onRailDown);
  toolbar.addEventListener('pointermove', onRailMove);
  toolbar.addEventListener('pointerup', onRailUp);
  toolbar.addEventListener('pointercancel', onRailUp);
  // The escape hatch the timeline panel's own grip already has: losing pointer capture
  // fires NEITHER pointerup nor pointercancel (the export shutter sets `pointer-events:
  // none` on the rail mid-drag, which releases capture implicitly). Without this the
  // drag state sticks forever - `.is-dragging` stays on and onRailDown refuses to start
  // a new drag - so the rail could never be released or re-grabbed.
  toolbar.addEventListener('lostpointercapture', onRailUp);

  // ── toolbar ─────────────────────────────────────────────────────────────────
  let popover: HTMLDivElement | null = null;
  let arrangeBtn: HTMLButtonElement | null = null; // popover anchor (captured, not by index)
  /** The mode buttons, captured by buildToolbar - see syncModeUI. Absent ones stay null:
   *  pen and connect are opt-in, so not every tool has all four. */
  const modeBtns: Record<'select' | 'create' | 'pen' | 'line', HTMLButtonElement | null> = {
    select: null,
    create: null,
    pen: null,
    line: null,
  };
  let nodeToolBtn: HTMLButtonElement | null = null; // the Node tool (opt-in, cv.pathField)
  /** The control the open popover belongs to: it owns the trigger's `aria-expanded`,
   *  and it is where focus goes back to when the menu closes from the keyboard. */
  let popoverAnchor: HTMLElement | null = null;
  function closePopover(restoreFocus = false): void {
    const anchor = popoverAnchor;
    popoverAnchor = null;
    popover?.remove();
    popover = null;
    if (!anchor) return;
    if (anchor.hasAttribute('aria-haspopup')) anchor.setAttribute('aria-expanded', 'false');
    // Only when the CLOSE came from the keyboard: a pointer dismiss has already moved
    // focus wherever the user clicked, and yanking it back would fight them.
    if (restoreFocus && anchor.isConnected) anchor.focus();
  }
  buildToolbar(); // after arrangeBtn exists (buildToolbar assigns it)
  // Put the rail back where it was dragged to earlier in this page session, re-clamped
  // against THIS stage (a different tool, a resized window).
  if (railSession) placeRail(railSession);

  /** How long a press has to be held before it counts as "open this tool's options"
   *  rather than "use this tool". Long enough not to fire on a slow click, short enough
   *  to feel like a press rather than a hang. */
  const HOLD_MS = 420;
  /** Pointer travel that turns a hold into a drag and cancels the menu, SCREEN px. */
  const HOLD_SLOP = 8;

  /**
   * A rail button, optionally with a press-and-hold menu of its own.
   *
   * `hold` is the touch-reachable half of a right-click: press and keep pressing, or
   * right-click, and the tool offers its options instead of running. The short click is
   * untouched - the tool still does its main job on a tap, which is what makes this safe
   * to add to a button people already use. The two never both fire: a hold that opened a
   * menu swallows the click that the pointerup would otherwise deliver.
   */
  function toolBtn(
    label: string,
    svg: string,
    onClick: (b: HTMLButtonElement, e: MouseEvent) => void,
    extraClass = '',
    hold?: (b: HTMLButtonElement) => void
  ): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'fc-btn ' + extraClass;
    b.setAttribute('data-tip', label);
    b.setAttribute('aria-label', label);
    b.innerHTML = icon(svg);
    let holdTimer: ReturnType<typeof setTimeout> | 0 = 0;
    let holdFired = false;
    let holdFrom: { x: number; y: number } | null = null;
    const cancelHold = (): void => {
      if (holdTimer) {
        clearTimeout(holdTimer);
        holdTimer = 0;
      }
      holdFrom = null;
    };
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      // The pointerup that ends a hold still delivers a click. Eat exactly that one.
      if (holdFired) {
        holdFired = false;
        return;
      }
      onClick(b, e);
    });
    b.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      if (!hold || e.button > 0) return; // secondary buttons take the contextmenu path
      holdFired = false;
      holdFrom = { x: e.clientX, y: e.clientY };
      // Bare `setTimeout`/`clearTimeout`, matching `flashTimer` above - pairing
      // `window.setTimeout` with a bare `clearTimeout` cancels nothing wherever the two
      // are not the same object, which is every jsdom-hosted test in this file.
      holdTimer = setTimeout(() => {
        holdTimer = 0;
        holdFired = true;
        hold(b);
      }, HOLD_MS);
    });
    if (hold) {
      // A press that travels is someone scrolling the rail, not someone holding it.
      b.addEventListener('pointermove', (e) => {
        if (holdFrom && Math.hypot(e.clientX - holdFrom.x, e.clientY - holdFrom.y) > HOLD_SLOP)
          cancelHold();
      });
      for (const ev of ['pointerup', 'pointercancel', 'pointerleave'])
        b.addEventListener(ev, cancelHold);
      b.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        cancelHold();
        hold(b);
      });
      b.setAttribute('aria-haspopup', 'true');
    }
    toolbar.appendChild(b);
    return b;
  }

  function buildToolbar(): void {
    // ONE menu at the top of the rail, behind Lolly's own mark: every DOCUMENT-level
    // action - export, save, undo/redo, canvas size, copy, share, document info,
    // import. The rail underneath it is tools only. The trigger is the brand-hued
    // identity mark (--lolly-mark), never the verify verdict green.
    //
    // Export/Save still go through opts.actions (which .click() the hidden
    // #render-fab / #render-save) - no duplicated export or save logic anywhere.
    let histUndo = false,
      histRedo = false;
    if (history) {
      history.register((canUndo, canRedo) => {
        histUndo = canUndo;
        histRedo = canRedo;
        // The pair keeps the menu open so you can step back repeatedly, so its
        // enabled state has to follow the stack live rather than freeze at open.
        // (The Cmd/Ctrl-Z shortcuts are the shell's own and never touched the rail.)
        const u = popover?.querySelector<HTMLButtonElement>('[data-pop="undo"]');
        const r = popover?.querySelector<HTMLButtonElement>('[data-pop="redo"]');
        const active = document.activeElement;
        if (active === u && !canUndo && canRedo) r?.focus();
        else if (active === r && !canRedo && canUndo) u?.focus();
        if (u) u.disabled = !canUndo;
        if (r) r.disabled = !canRedo;
      });
    }
    let lollyBtn: HTMLButtonElement | null = null;
    /**
     * WHERE THE MARK MENU IS HANGING FROM right now. The menu has two triggers - the
     * rail's own mark and the Design top bar's (`openLollyMenu`) - and four of its rows
     * open a PANEL that positions itself under its anchor. Hard-wiring `lollyBtn` there
     * put "Artboard size" / "Custom CSS" / "Document info" / "Import" on the far left of
     * the stage, docked to a rail button, whenever the menu had been opened from the bar.
     */
    const anchorEl = (): HTMLElement => lollyAnchor ?? lollyBtn!;
    /**
     * Is a Design TOP BAR mounted over this stage (plans/179 M1)? `opts.chrome` is only
     * handed over by a tool view that mounted one, so its presence is the signal - not a
     * media query, and not a guess from the layout.
     *
     * When it is, the menu stops being the editor's only door to the document actions and
     * becomes what a menu is for: the long tail. Export, Save, Copy, Share, Undo, Redo,
     * Slide transition and Present all have their own visible control up there, and a
     * second copy of each is a second thing to keep in step (the Undo rows in particular
     * would fight the bar over `history.register`'s single slot). What only a menu can
     * hold - Theme and Interface sounds, which used to ride the zoom HUD the bar retires -
     * moves IN. Without a bar the menu is byte-identical to what it has always been.
     */
    const barMounted = !!designChrome;
    /**
     * …and is that bar in its NARROW form? Under 640px design-topbar.css folds the
     * centre cluster (undo/redo, the zoom cluster, the panel toggles) and Share away,
     * and its comment has always said they "fold into the mark menu" - this is where
     * they land, so a phone is not left with no undo at all.
     *
     * Read off the LIVE DOM rather than a second copy of the breakpoint: `offsetParent`
     * is null exactly when a rule has taken the element out of the layout, so the menu
     * grows the rows the bar dropped whatever that sheet decides. NO BAR at all reads as
     * "not folded" - the bar's own controls are then not the ones missing. A bar that
     * cannot be measured (a host with no layout engine) reads as folded, which is the
     * safe direction: the cost is a duplicated row, and the cost of guessing the other
     * way is a phone with no undo.
     */
    const barFolded = (): boolean => {
      if (!barMounted) return false;
      const centre = stageEl.querySelector<HTMLElement>('.design-topbar .dtb-centre');
      return !!centre && centre.offsetParent === null;
    };
    const lollyItems = (): PopItem[] => {
      const items: PopItem[] = [];
      // Export leads - it's the star of the Lolly menu. Present is added LAST (very bottom).
      if (actions && !barMounted) {
        items.push({
          label: t('Export'),
          icon: icon(SVG.exportUp),
          key: 'export',
          run: () => actions.export(),
        });
        if (actions.canSave !== false)
          items.push({
            label: t('Save to your library'),
            icon: icon(SVG.save),
            key: 'save',
            run: () => actions.save(),
          });
        // Copy + Share ride directly under Save with NO divider - the on-device outputs of
        // the same "you've made something, now get it out" moment. "Share" reads plainly now
        // that the target can be a .lolly file or a private collab, not just a URL.
        items.push({
          label: t('Copy image to clipboard'),
          icon: icon(SVG.dup),
          key: 'copy',
          run: () => actions.copy(),
        });
        items.push({
          label: t('Share'),
          icon: icon(SVG.share),
          key: 'share',
          run: () => actions.share(),
        });
      }
      // The one action the bar hands BACK: saving is the render pill's, and the pill is
      // hidden in editor layout, so the menu keeps the door open when the view offers it.
      if (barMounted && designChrome?.saveToLibrary) {
        items.push({
          label: t('Save to your library'),
          icon: icon(SVG.save),
          key: 'save',
          run: () => designChrome.saveToLibrary!(),
        });
      }
      // Share is hidden with the bar's centre under 640px, and a phone has no ⌘Z, so
      // the two rows the fold takes away come back here (see barFolded).
      if (actions && barMounted && barFolded()) {
        items.push({
          label: t('Share'),
          icon: icon(SVG.share),
          key: 'share',
          run: () => actions.share(),
        });
      }
      if (history && (!barMounted || barFolded())) {
        if (items.length) items.push({ sep: true });
        items.push({
          label: t('Undo - step back'),
          icon: icon(SVG.undo),
          key: 'undo',
          disabled: !histUndo,
          keepOpen: true,
          run: () => history.undo(),
        });
        items.push({
          label: t('Redo - step forward'),
          icon: icon(SVG.redo),
          key: 'redo',
          disabled: !histRedo,
          keepOpen: true,
          run: () => history.redo(),
        });
      }
      // The inspector's toggle is folded away with the rest of the bar's centre, and
      // with nothing selected the object bar (its other door) does not exist either -
      // so the column would be unreachable on a phone. It closes from its own header.
      if (inspectorPort && barFolded()) {
        items.push({
          label: t('Inspector'),
          icon: icon(SVG.more),
          key: 'inspector',
          run: () => inspectorPort?.reveal('document'),
        });
      }
      if (pages || setCanvasSize) {
        if (items.length) items.push({ sep: true });
        if (pages)
          items.push({
            label: t('Pages & page size'),
            icon: icon(SVG.pages),
            key: 'pages',
            run: () => openPagesMenu(anchorEl()),
          });
        else
          items.push({
            label: activeFrameIndex(getBoxes()) >= 0 ? t('Artboard size') : t('Canvas size'),
            icon: icon(SVG.size),
            key: 'size',
            run: () => openSizeMenu(anchorEl()),
          });
      }
      if (info || importCfg || actions?.newFromTemplate || actions?.bulk) {
        if (items.length) items.push({ sep: true });
        if (info)
          items.push({
            label: t('Document info'),
            icon: icon(SVG.info),
            key: 'info',
            run: () => openInfoPanel(anchorEl()),
          });
        // Back to the Start chooser (plans/142 WP-1) - sits in the same "bring a
        // document in" group as Import. The pick applies through the tool's own
        // undoable path, so it is one ⌘Z away, never a destructive reset.
        if (actions?.newFromTemplate)
          items.push({
            label: t('New from template'),
            icon: icon(SVG.templates),
            key: 'templates',
            run: () => actions.newFromTemplate!(),
          });
        // "Bulk from rows" - the same group, because it is the other way a document
        // arrives: one sheet of rows in, one render per row out (plans/147 M1).
        if (actions?.bulk)
          items.push({
            label: t('Bulk from rows'),
            icon: icon(SVG.rows),
            key: 'bulk',
            run: () => actions.bulk!(),
          });
        // keepOpen, because openImportPanel closes this menu and then assigns its own
        // panel to `popover`: without it fillPopover's trailing closePopover() would
        // tear the freshly-mounted import panel down in the same click. (The pages /
        // size / info rows are safe - those assign `morePanel`, a different variable.)
        if (importCfg)
          items.push({
            label: t('Import a design'),
            icon: icon(SVG.importFile),
            key: 'import',
            keepOpen: true,
            run: () => openImportPanel(anchorEl()),
          });
      }
      // Custom CSS (plan 112 M4): only for a tool that declares the `customCss` input
      // (Design). Opens a highlighted, auto-completing editor bound to that input.
      if (runtime.getModel().some((i) => i.id === 'customCss')) {
        if (items.length) items.push({ sep: true });
        items.push({
          label: t('Custom CSS'),
          icon: icon(SVG.code),
          key: 'css',
          run: () => openCssPanel(anchorEl()),
        });
      }
      // Design's canvas keyboard used to be invisible while the timeline alone carried a
      // `?` sheet. The document menu is the pointer/touch door onto that same inventory;
      // a focused timeline keeps its own, more detailed sheet because its root consumes
      // the key before this window-level handler sees it.
      if (barMounted) {
        if (items.length) items.push({ sep: true });
        if (authoringGuides) {
          items.push({
            label: t('Rulers and guides'),
            icon: icon(SVG.grid),
            key: 'guides',
            on: authoringGuides.isVisible(),
            run: () => setGuidesVisible(!authoringGuides!.isVisible()),
          });
          if (authoringGuides.hasGuides()) {
            items.push({
              label: t('Remove all guides'),
              icon: icon(SVG.trash),
              key: 'clear-guides',
              run: () => authoringGuides?.clear(),
            });
          }
        }
        items.push({
          label: t('Keyboard shortcuts'),
          icon: icon(SVG.info),
          key: 'shortcuts',
          run: () => showShortcuts(anchorEl()),
        });
      }
      // Slide transition (plan 112 M5): one compact cycling row - Slide → Fade → Morph.
      // The menu closes on click; reopening shows the new value (no live refresh needed).
      //
      // Kept when a top bar is mounted, unlike the eight rows the bar really does carry:
      // this one is DOC-LEVEL and the bar has no transition control (nor has the
      // inspector's Document section, nor the navigator, which only reads it as a chip).
      // Dropping it left the input with no door anywhere in the editor - a deck set to
      // Morph could not be changed back to Fade except by hand-editing the URL. It goes
      // back to the per-frame slot's owner when plan 179 M4 ships that select.
      const trModel = runtime.getModel().find((i) => i.id === 'transition');
      if (trModel) {
        const order = ['slide', 'fade', 'morph'];
        const cur = String(trModel.value ?? 'slide');
        const nice = cur === 'morph' ? t('Morph') : cur === 'fade' ? t('Fade') : t('Slide');
        items.push({
          label: `${t('Slide transition')}: ${nice}`,
          icon: icon(SVG.present),
          key: 'transition',
          run: () => {
            const next = order[(order.indexOf(cur) + 1) % order.length]!;
            onDirty?.('transition');
            runtime.setInput('transition', next);
          },
        });
      }
      // Present is the VERY LAST row (Andy: Export is the star; Present sits at the bottom),
      // set off by its own separator and next to the Slide transition it uses (plan 112).
      if (actions?.present && !barMounted) {
        if (items.length) items.push({ sep: true });
        items.push({
          label: t('Present'),
          icon: icon(SVG.present),
          key: 'present',
          run: () => actions.present!(),
        });
      }
      // App preferences, at the very bottom (plans/179 M1). The rows are PROXIES: the tool
      // view built the real controls and lends them here, so the theme/sound state and its
      // persistence stay in one place and the menu never becomes a second opinion.
      if (barMounted && (designChrome?.themeToggle || designChrome?.soundToggle)) {
        if (items.length) items.push({ sep: true });
        if (designChrome.themeToggle) {
          items.push({
            label: t('Theme'),
            icon: icon(SVG.theme),
            key: 'theme',
            run: () => designChrome.themeToggle!.click(),
          });
        }
        if (designChrome.soundToggle) {
          items.push({
            label: t('Interface sounds'),
            icon: icon(SVG.sound),
            key: 'sound',
            run: () => designChrome.soundToggle!.click(),
          });
        }
      }
      return items;
    };
    // The ports' door onto the same menu: the top bar's mark button opens it anchored to
    // ITSELF, not to a rail button that may not even be on screen (see openLollyMenu).
    lollyMenuItems = lollyItems;
    if (actions || history || info || importCfg || pages || setCanvasSize) {
      // `fc-action-primary` is kept on the trigger because it is now the editor's
      // primary action affordance - mountTool focuses it on open (tool.ts) - with
      // .fc-btn-lolly restyling it back to the mark's own colour.
      lollyBtn = toolBtn(
        t('Menu - export, save, undo, canvas size'),
        '',
        () => {
          setLollyAnchor(lollyBtn!);
          const items = lollyItems();
          if (items.length) spawnPopover(lollyBtn!, items);
        },
        'fc-action fc-action-primary fc-btn-lolly'
      );
      // The mark is a whole <svg> (the brand swirl, root icon.svg), not a path set, so it
      // replaces toolBtn's icon(). Its three rings spin on hover only - see .fc-btn-lolly in
      // editor.css, the same interaction-only treatment as the Ask Lolly send button.
      lollyBtn.innerHTML = LOLLY_MARK_SVG;
      lollyBtn.setAttribute('aria-haspopup', 'menu');
      const ref = actions?.dirtyRef;
      if (ref && actions && actions.canSave !== false) {
        // The render pill's amber "unsaved" cue, mirrored onto the trigger - Save
        // lives inside the menu now, so the mark is what has to carry the cue.
        const mark = lollyBtn;
        const mirror = (): void => {
          mark.classList.toggle('is-unsaved', ref.classList.contains('is-unsaved'));
        };
        mirror();
        dirtyObserver = new MutationObserver(mirror);
        dirtyObserver.observe(ref, { attributes: true, attributeFilter: ['class'] });
      }
      const asep = document.createElement('div');
      asep.className = 'fc-sep';
      toolbar.appendChild(asep);
    }
    // Pointer leads the tools, and is the way OUT of every other one. Before it existed the
    // only exit from the pen or from connect mode was clicking that same tool's own button
    // again - discoverable only if you already knew, which is what "trapped in the current
    // tool" meant. Its own click is not a no-op even when it is already lit: it also leaves
    // point editing and finishes a draft.
    modeBtns.select = toolBtn(
      t('Pointer - select and move (V)'),
      SVG.pointer,
      () => pickPointer(),
      'fc-btn-pointer'
    );
    const add = toolBtn(t('Add a box'), SVG.add, () => openAddMenu(add), 'fc-btn-add');
    modeBtns.create = add;
    // Pen (opt-in via canvas.pathField - a tool with nowhere to store an authored path has
    // no pen). The tooltip carries the corner modifier, which is otherwise undiscoverable;
    // Alt is free here because a pen click returns long before `selectionForHit`, where Alt
    // means "drill into the group".
    if (cv.pathField) {
      modeBtns.pen = toolBtn(
        t('Pen - click to place points, drag to curve, Alt for a corner. Hold for the spline type'),
        SVG.pen,
        () => {
          mode === 'pen' ? toPointer() : setMode('pen');
        },
        'fc-btn-pen',
        (b) => openPenKindMenu(b)
      );
      // Node tool (Inkscape's N): click a shape to edit its points directly.
      nodeToolBtn = toolBtn(
        t('Edit points (N) - click a shape to edit its nodes directly'),
        SVG.nodes,
        () => toggleNodeTool(),
        'fc-btn-nodes'
      );
      // Line - the pen's other gesture (plan 96 P2). One drag makes a two-node path box,
      // arrowhead on by default; it lives beside the Pen because it is the SAME primitive
      // drawn a different way, and it is opt-in on `pathField` for the same reason the pen
      // is: a tool with nowhere to store an authored path cannot hold a line either.
      // Auto-arrange now rides a HOLD (or right-click) of the Line tool, when the boxes can
      // be joined (opt-in via bindings): lines are what create those bindings, so their tool
      // is the natural home for tidying the graph they make. Mirrors the pen's hold-for-spline.
      modeBtns.line = toolBtn(
        hasBindCfg
          ? t('Line - drag to draw a line or arrow. Hold to auto-arrange the connected cards')
          : t('Line - drag to draw a line or arrow'),
        SVG.line,
        () => {
          mode === 'line' ? toPointer() : setMode('line');
        },
        'fc-btn-line',
        hasBindCfg
          ? (b) =>
              spawnPopover(b, [
                {
                  label: t('Auto-arrange the connected cards'),
                  icon: icon(SVG.tidy),
                  run: () => autoLayout(),
                },
              ])
          : undefined
      );
    }
    // Timeline (opt-in via the canvas time-model fields - a tool with nowhere to store
    // a start/duration has no timeline). Toggles the docked panel; the panel module
    // itself is only fetched the first time it is opened.
    if (timeCfg) {
      timelineBtn = toolBtn(
        t('Timeline - arrange clips over time'),
        SVG.timeline,
        () => toggleTimeline(),
        'fc-btn-timeline'
      );
      timelineBtn.setAttribute('aria-pressed', String(!!timelinePanel?.isOpen()));
    }
    // Frames reorder (opt-in via canvas.orderField - the frame primitive's page-order
    // field). A tool with nowhere to store `order` has no frame sequence to sort, so the
    // button is absent for carousel/deck and every non-frame tool. Toggles the panel.
    if (frameCfg?.orderField) {
      toolBtn(t('Artboards'), SVG.frame, (b) => toggleFramesPanel(b), 'fc-btn-frames');
    }
    // (Auto-arrange no longer has a standalone rail button - it moved to a HOLD / right-click
    // of the Line tool above, since the line tool is what creates the bindings it lays out.)
    // One "Arrange" menu - align + distribute + stacking order + group + clip
    // (previously two separate rail buttons). Every one of those acts ON a selection,
    // so the button only appears once there is one (syncArrangeUI, from the same
    // paint that shows the object bar). The right-click menu and the keyboard keep
    // their own gating - nothing here is the only way to reach an action.
    arrangeBtn = toolBtn(t('Arrange - align, distribute, order, group'), SVG.align, () =>
      openArrangeMenu()
    );
    syncArrangeUI();
    // Snap-to-grid toggle (opt-in).
    if (cv.grid) {
      const gbtn = toolBtn(t('Snap to grid'), SVG.grid, () => {
        gridOn = !gridOn;
        gbtn.classList.toggle('is-armed', gridOn);
        gbtn.setAttribute('aria-pressed', String(gridOn));
      });
      gbtn.setAttribute('aria-pressed', String(gridOn));
      if (gridOn) gbtn.classList.add('is-armed');
    }
    // Pages / canvas size, copy, share, document info and import all live in the
    // Lolly menu at the top of the rail now - see lollyItems() above.
    const sep = document.createElement('div');
    sep.className = 'fc-sep';
    toolbar.appendChild(sep);
    // The paint at the foot of the rail - the app's shared colour picker (swatches + hex
    // + alpha). WHAT it paints depends on the document; see paintBgField. It lives in a
    // `display:contents` slot so the field itself can be REPLACED (not mutated) on a
    // re-sync while staying a direct flex child of the rail.
    bgSlot = document.createElement('div');
    bgSlot.style.display = 'contents';
    toolbar.appendChild(bgSlot);
    paintBgField();
    syncModeUI(); // Pointer lit on mount; the rail is never rebuilt after this
  }

  // ── the rail's paint swatch (plans/179 A1) ───────────────────────────────────
  //
  // It used to write the document `background` input unconditionally. In any document
  // with artboards - which is every new one, since the default `boxes` seeds artboard-1 -
  // the hook forces the page background to `transparent`, so the most visible control on
  // the rail did nothing at all. That is the "can't fill artboards" report.
  //
  // Now it follows the ACTIVE artboard (the one holding the selection, else the primary)
  // and paints its fill; with no artboards in the document it keeps writing `background`.
  // The field is rebuilt rather than mutated, because the swatch, the value field, the
  // LCH sliders and the aria-label are all seeded from the value at build time - and it
  // is replaced wholesale (a fresh element, freshly wired) because `wireColorField` binds
  // delegated listeners on the scope it is handed, so re-wiring one in place would fire
  // every later edit twice.
  /** What the swatch edits right now. `frameId` empty = the document background. */
  function bgTarget(): { frameId: string; value: unknown; tip: string } {
    if (frameCfg && cfg.fillField) {
      const boxes = getBoxes();
      const fid = hasFrames(boxes) ? activeFrameIdFor(boxes, selection, frameFields()) : '';
      if (fid) {
        const fb = boxes.find((b, i) => idOf(b, i) === fid);
        return {
          frameId: fid,
          value: fb ? (fb[cfg.fillField] ?? '') : '',
          tip: t('Artboard fill'),
        };
      }
    }
    return { frameId: '', value: getBg(), tip: t('Canvas background') };
  }

  function paintBgField(): void {
    if (!bgSlot) return;
    const tgt = bgTarget();
    bgFieldKey = `${tgt.frameId}|${String(tgt.value ?? '')}`;
    const wrap = document.createElement('div');
    wrap.className = 'fc-btn fc-color-btn';
    wrap.setAttribute('data-tip', tgt.tip);
    // Resolved, never raw (plan 179 A2): an artboard whose fill is `var(--brand-surface)`
    // seeded this swatch BLACK and its sliders a blue that came from the field's own
    // neutral seed. `seededColorField` reads the token off the canvas's computed style
    // and labels the trigger with the token's name; the model keeps the `var()`.
    wrap.innerHTML = seededColorField('fc-bg', tgt.value);
    wrap.addEventListener('pointerdown', (e) => e.stopPropagation());
    bgSlot.replaceChildren(wrap);
    wireColorField(wrap, {
      onChange: (_id, val) => {
        const col = unwrapColor(val);
        // Read the target FRESH: the selection may have moved since the field was built.
        const now = bgTarget();
        if (now.frameId && cfg.fillField) {
          const boxes = getBoxes();
          const i = boxes.findIndex((b, n) => idOf(b, n) === now.frameId);
          if (i < 0) return;
          // The field now SHOWS the pick while the popover stays open, and the open-popover
          // guard in syncBgField will skip the repaint that would have recorded it - so
          // forget the last painted key here, or an undo that restores the old value
          // compares equal to that stale key and leaves the swatch showing the pick.
          bgFieldKey = '';
          commit(boxes.map((b, n) => (n === i ? { ...b, [cfg.fillField]: col } : b)));
          return;
        }
        onDirty?.(bgInputId);
        runtime.setInput(bgInputId, col);
      },
    });
  }

  /** Keep the swatch honest as the selection and the model move. Skipped while the
   *  picker is open - rebuilding the field under an open popover would close it
   *  mid-edit - and skipped when nothing it shows has changed. */
  function syncBgField(): void {
    if (!bgSlot) return;
    const tgt = bgTarget();
    if (`${tgt.frameId}|${String(tgt.value ?? '')}` === bgFieldKey) return;
    // Skipped while the picker is open: drop the key so the deferred repaint happens on
    // the next sync after it closes, whatever the model says by then.
    if (bgSlot.querySelector('.color-popover:not([hidden])')) {
      bgFieldKey = '';
      return;
    }
    paintBgField();
  }

  function fillPopover(el: HTMLElement, items: PopItem[]): void {
    for (const it of items) {
      if (it.sep) {
        const s = document.createElement('div');
        s.className = 'fc-pop-sep';
        el.appendChild(s);
        continue;
      }
      // Icon-only grid row (e.g. align = 3 cols × 2 rows, distribute = 2 cols): each
      // action is a compact square button labelled only by its icon (title/aria carry
      // the text). `cols` drives the column count via a CSS var.
      if (it.grid) {
        const g = document.createElement('div');
        g.className = 'fc-pop-grid';
        g.style.setProperty('--cols', String(it.cols || it.grid.length));
        for (const gi of it.grid) {
          const gb = document.createElement('button');
          gb.type = 'button';
          gb.className = 'fc-pop-gitem' + (gi.danger ? ' fc-pop-danger' : '');
          gb.disabled = gi.disabled === true;
          gb.setAttribute('role', 'menuitem');
          gb.setAttribute('data-tip', gi.label);
          gb.setAttribute('aria-label', gi.label);
          gb.innerHTML = gi.icon || '';
          // `activeElement === gb` is read AFTER run(): a row that opened a panel and
          // focused something inside it must keep that focus, and one that did not has
          // to hand the keyboard back to the trigger rather than to <body>.
          gb.addEventListener('click', (e) => {
            e.stopPropagation();
            if (gb.disabled) return;
            gi.run();
            if (!gi.keepOpen) closePopover(document.activeElement === gb);
          });
          g.appendChild(gb);
        }
        el.appendChild(g);
        continue;
      }
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'fc-pop-item' + (it.danger ? ' fc-pop-danger' : '') + (it.on ? ' is-on' : '');
      // A row in a `role="menu"` has to be a menuitem, or the container's role makes the
      // whole popover unnavigable to a screen reader: only the radio rows carried one,
      // so every plain row (Export, Undo, Custom CSS…) announced as a bare button.
      b.setAttribute('role', it.on !== undefined ? 'menuitemradio' : 'menuitem');
      if (it.on !== undefined) b.setAttribute('aria-checked', String(it.on));
      if (it.key) b.dataset.pop = it.key;
      b.disabled = it.disabled === true;
      b.innerHTML =
        (it.icon ? `<span class="fc-pop-ic">${it.icon}</span>` : '') + `<span>${it.label}</span>`;
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        if (b.disabled) return;
        it.run();
        if (!it.keepOpen) closePopover(document.activeElement === b);
      });
      el.appendChild(b);
    }
  }
  function spawnPopover(anchor: HTMLElement, items: PopItem[]): void {
    closePopover();
    popover = document.createElement('div');
    popover.className = 'fc-popover';
    // A MENU, and one the keyboard can actually use. The popover is appended to the
    // STAGE (it has to be, to position itself absolutely inside it), so it is after
    // every bar and rail control in DOM order: a Tab from the trigger walked the whole
    // top bar before reaching the rows. Moving focus INTO it on open, with Escape and
    // Tab handing focus back to the trigger, is what closes that gap - the same
    // contract design-topbar's own menus keep.
    popover.setAttribute('role', 'menu');
    const named = anchor.getAttribute('aria-label');
    if (named) popover.setAttribute('aria-label', named);
    fillPopover(popover, items);
    popover.addEventListener('pointerdown', (e) => e.stopPropagation());
    popover.addEventListener('keydown', onPopoverKey);
    // A trigger OUTSIDE the stage - the docked HUD's mark sits in the right column, a
    // fixed sibling stacked above the stage - cannot use a stage-positioned menu: it
    // opened behind the column and looked like a dead button (Andy, 2026-09-03). Such a
    // menu goes on the body in viewport coordinates, above the column (editor.css).
    const detached = !stageEl.contains(anchor);
    if (detached) {
      popover.classList.add('fc-popover--viewport');
      document.body.appendChild(popover);
    } else stageEl.appendChild(popover);
    popoverAnchor = anchor;
    if (anchor.hasAttribute('aria-haspopup')) anchor.setAttribute('aria-expanded', 'true');
    const ar = anchor.getBoundingClientRect();
    const sr = detached
      ? { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight }
      : stageEl.getBoundingClientRect();
    const pr = popover.getBoundingClientRect(); // after append: it is laid out
    const pos = placePopover(
      { left: ar.left - sr.left, right: ar.right - sr.left, top: ar.top - sr.top },
      { w: pr.width, h: pr.height },
      { w: sr.width, h: sr.height }
    );
    popover.style.left = pos.left + 'px';
    popover.style.top = pos.top + 'px';
    popoverItems()[0]?.focus();
  }

  /** The popover's focusable rows, in order - grid cells included, disabled skipped. */
  function popoverItems(): HTMLButtonElement[] {
    if (!popover) return [];
    return [...popover.querySelectorAll<HTMLButtonElement>('.fc-pop-item, .fc-pop-gitem')].filter(
      (b) => !b.disabled
    );
  }

  /**
   * Menu keys, the APG way: arrows roam, Home/End jump, Escape closes and Tab closes
   * and lets the browser move on - both handing focus back to the trigger, because a
   * menu removed with focus still inside it drops the keyboard onto `<body>` and the
   * next Tab restarts at the top of the page.
   */
  function onPopoverKey(e: KeyboardEvent): void {
    if (!popover) return;
    const list = popoverItems();
    const at = list.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closePopover(true);
      return;
    }
    if (e.key === 'Tab') {
      closePopover(true);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      list[(at + 1 + list.length) % list.length]?.focus();
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      list[(at - 1 + list.length) % list.length]?.focus();
      return;
    }
    if (e.key === 'Home') {
      e.preventDefault();
      list[0]?.focus();
      return;
    }
    if (e.key === 'End') {
      e.preventDefault();
      list[list.length - 1]?.focus();
      return;
    }
    // Everything else the canvas would have answered - a bare letter is a tool
    // shortcut, Delete deletes the selection - stops at the menu.
    if (!(e.metaKey || e.ctrlKey)) e.stopPropagation();
  }
  // Sequence editors (timeCfg) import a design file as SCENES instead: every
  // frame/board/page becomes a stored vector asset placed as one full-canvas clip
  // in the main sequence, appended after the existing timing so nothing the user
  // authored moves. One commit → one undo step; the timeline opens to show the
  // play-through. Returns the number of scenes added.
  async function importAsScenes(f: File | Blob, setStatus: (m: string) => void): Promise<number> {
    const { parseDesignScenes } = await import('./design-import.ts');
    const { DEFAULT_CLIP_S } = await import('./timeline-math.ts');
    const res = await parseDesignScenes(f, {
      host: host as any,
      log: setStatus,
      interactive: true,
      map: importMap,
    });
    const scenes = res.scenes;
    if (!scenes.length) throw new Error(t('Nothing importable was found in that file.'));
    const tc = timeCfg!;
    const { w: cw, h: ch } = canvasWH();
    const all = [...getBoxes()];
    // Append after the current sequence's end - never disturb existing timing.
    let at = 0;
    for (const b of all) {
      if (String(b[tc.laneField] ?? '') !== 'seq') continue;
      const s = num(b[tc.startField], NaN);
      if (!Number.isFinite(s)) continue;
      const d = num(b[tc.durField], NaN);
      at = Math.max(at, s + (Number.isFinite(d) && d > 0 ? d : DEFAULT_CLIP_S));
    }
    for (const sc of scenes) {
      const id = freshId(all);
      all.push({
        [cfg.idField]: id,
        [cfg.kindField]: 'image',
        [cfg.xField]: 0,
        [cfg.yField]: 0,
        [cfg.wField]: cw,
        [cfg.hField]: ch,
        ...(cfg.imageField ? { [cfg.imageField]: sc.asset } : {}),
        ...(cfg.fitField ? { [cfg.fitField]: 'contain' } : {}),
        [tc.laneField]: 'seq',
        [tc.startField]: at,
        [tc.durField]: DEFAULT_CLIP_S,
        // A Penpot prototype flow carries the authored transition INTO each board;
        // scenes from a file without interactions carry neither key, so the box is
        // written exactly as it always was (enter defaults to 'none' - a cut).
        ...(sc.enter ? { [tc.enterField]: sc.enter } : {}),
        ...(sc.enterMs !== undefined ? { [tc.enterMsField]: sc.enterMs } : {}),
      } as unknown as Box);
      at += DEFAULT_CLIP_S;
    }
    if (disposed) return 0;
    selection = new Set<string>();
    commit(all);
    openTimeline();
    return scenes.length;
  }
  /**
   * Import a document's pages as ARTBOARDS: one frame per page / slide / board, laid
   * out left to right, every page's parts inside it as editable boxes - the deck
   * import (Andy, 2026-09-02: "artboards for slides or frames for animation"). It
   * replaces the board (as a single-page import does), sizes the export frame to the
   * first page, and leaves the pages UNTIMED on purpose: the "play these in order"
   * prompt that follows any fresh set of artboards is how they become a slideshow, so
   * deck-or-animation stays the user's call after the import as well as before it.
   * Returns the number of artboards laid down.
   */
  async function importAsArtboards(
    f: File | Blob,
    setStatus: (m: string) => void
  ): Promise<number> {
    if (!frameCfg) throw new Error(t('This tool has no artboards.'));
    const { parseDesignArtboards } = await import('./design-import.ts');
    const res = await parseDesignArtboards(f, {
      host: host as any,
      log: setStatus,
      interactive: true,
      map: importMap,
    });
    if (!res.frames.length) throw new Error(t('Nothing importable was found in that file.'));
    const fk = frameCfg.frameKind;
    const frameAddKind = addKinds.find(
      (k) => k.id === 'frame' || (k.seed != null && String(k.seed[cfg.kindField]) === fk)
    );
    const rows = layoutArtboards(
      res.frames.map((fr) => ({
        name: fr.name,
        width: fr.width,
        height: fr.height,
        boxes: fr.boxes as Box[],
        ...(fr.background ? { background: fr.background } : {}),
        // plans/179 P2 - a .pptx's speaker notes are parsed, normalised and capped by
        // pptx-import, and used to stop here: the re-projection dropped the field, so
        // "Speaker notes…" was empty on every imported slide and a re-export to PowerPoint
        // (which P1 just fixed) had nothing to put back.
        ...(fr.notes ? { notes: fr.notes } : {}),
      })),
      {
        cfg,
        frameField: frameCfg.frameField,
        frameKind: fk,
        orderField: frameCfg.orderField,
        frameSeed: (frameAddKind?.seed || {}) as Box,
        mintId: (used) => freshId(used),
        background: res.background,
        notesField: FRAME_NOTES_FIELD,
      }
    );
    if (disposed) return 0;
    selection = new Set<string>();
    commit(rows);
    const first = res.frames[0]!;
    if (setCanvasSize && first.width > 0 && first.height > 0)
      setCanvasSize(first.width, first.height, 'px');
    return res.frames.length;
  }
  // Import a design file (Figma SVG / Penpot). The heavy DOM parser is lazy-loaded so it
  // only ships to sessions that actually import. On success we REPLACE the whole boxes
  // array (through the normal commit path) and resize the artboard to the file's frame.
  // On a sequence editor the same panel imports frames as scenes (importAsScenes).
  function openImportPanel(anchor: HTMLElement): void {
    closePopover();
    const panel = document.createElement('div');
    panel.className = 'fc-popover fc-import-panel';
    // The section 337 choice, per-import: scenes-capable tools (Design) let the user pick
    // between replacing the board and laying the frames out as timed scenes. Default
    // follows the manifest (importScenesMode) - false for Design, so it replaces.
    let importMode: ImportMode = defaultImportMode();
    // Class-styled, not inline: this panel used to carry its whole look in `style=`
    // attributes (and a HARD-CODED brand green on the choose button, which never themed
    // or respected dark mode). The chrome now lives in `.fc-import-*` in editor.css and
    // the button is the standard `.btn .btn--primary`, so it follows the active brand.
    panel.innerHTML =
      `<div class="fc-import-title">${t('Import a design')}</div>` +
      '<p class="fc-import-hint">' +
      t(
        'Drop a Figma <b>.fig</b> / SVG, a Penpot <b>.penpot</b>, an Illustrator <b>.ai</b> or <b>.pdf</b>, a PowerPoint <b>.pptx</b>, or an InDesign <b>.idml</b> (File → Export → InDesign Markup). (For editable text from a Figma <b>SVG</b>, uncheck “Outline text” on export.)'
      ) +
      '</p>' +
      // The per-import choice (plans/104 section 337, widened 2026-09-02): one page onto
      // the board, every page as an artboard, or every frame as a timed scene. Each
      // option is present only where the tool can honour it; a tool with neither
      // capability gets no radiogroup at all.
      (importSceneCapable || importArtboardCapable
        ? `<div class="fc-import-mode" role="radiogroup" aria-label="${t('Import as')}">` +
          `<label class="fc-import-mode-opt"><input type="radio" name="fc-imp-mode" value="board"${importMode === 'board' ? ' checked' : ''}>${t('Replace the board')}</label>` +
          (importArtboardCapable
            ? `<label class="fc-import-mode-opt"><input type="radio" name="fc-imp-mode" value="artboards"${importMode === 'artboards' ? ' checked' : ''}>${t('As artboards')}</label>`
            : '') +
          (importSceneCapable
            ? `<label class="fc-import-mode-opt"><input type="radio" name="fc-imp-mode" value="scenes"${importMode === 'scenes' ? ' checked' : ''}>${t('As timed scenes')}</label>`
            : '') +
          '</div>' +
          `<p class="fc-import-scenes-hint" data-import-hint>${escape(importHint(importMode))}</p>`
        : '') +
      `<button type="button" class="btn btn--primary fc-import-choose">${t('Choose file…')}</button>` +
      // Components-as-templates: revealed once the chosen file turns out to
      // define components (countPenpotComponents peeks the zip), so a file
      // without a design system never shows a control that would do nothing.
      '<label class="fc-import-templates" hidden>' +
      '<input type="checkbox" checked><span></span></label>' +
      '<div class="fc-import-status" role="status" aria-live="polite"></div>';
    panel.addEventListener('pointerdown', (e) => e.stopPropagation());
    stageEl.appendChild(panel);
    const ar = anchor.getBoundingClientRect();
    const sr = stageEl.getBoundingClientRect();
    panel.style.left = Math.min(ar.right - sr.left + 8, sr.width - 272) + 'px';
    panel.style.top = Math.max(6, ar.top - sr.top) + 'px';
    popover = panel;

    const status = panel.querySelector<HTMLElement>('.fc-import-status')!;
    const chooseBtn = panel.querySelector<HTMLButtonElement>('.fc-import-choose')!;
    const tplRow = panel.querySelector<HTMLElement>('.fc-import-templates')!;
    const tplBox = tplRow.querySelector<HTMLInputElement>('input')!;
    const tplLabel = tplRow.querySelector<HTMLElement>('span')!;
    // Wire the board / artboards / scenes choice (present only where a mode is offered).
    const modeHint = panel.querySelector<HTMLElement>('[data-import-hint]');
    panel
      .querySelectorAll<HTMLInputElement>('.fc-import-mode input[name="fc-imp-mode"]')
      .forEach((r) => {
        r.addEventListener('change', () => {
          if (!r.checked) return;
          importMode =
            r.value === 'scenes' ? 'scenes' : r.value === 'artboards' ? 'artboards' : 'board';
          if (modeHint) modeHint.textContent = importHint(importMode);
        });
      });
    const fileEl = document.createElement('input');
    fileEl.type = 'file';
    fileEl.accept =
      '.fig,.svg,.penpot,.zip,.ai,.pdf,.pptx,.idml,.indd,image/svg+xml,application/zip,application/pdf,application/illustrator,application/vnd.openxmlformats-officedocument.presentationml.presentation';
    fileEl.style.display = 'none';
    panel.appendChild(fileEl);
    chooseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      fileEl.click();
    });
    fileEl.addEventListener('change', async () => {
      const f = fileEl.files && fileEl.files[0];
      fileEl.value = '';
      if (!f) return;
      status.classList.remove('is-ok', 'is-err');
      status.textContent = t('Importing…');
      // Re-hide the components offer for the NEW file. One handler serves every pick and
      // the panel survives a failed import (the auto-close is the last statement of the
      // try), so without this a Penpot file's "Also save 6 components as templates" row
      // stays on screen - checked - while a plain SVG is imported, offering something
      // that can never happen (componentCount is re-derived per file, and is 0).
      tplRow.hidden = true;
      tplLabel.textContent = '';
      tplBox.checked = true;
      chooseBtn.disabled = true;
      try {
        if (importMode === 'scenes') {
          // The user chose "As timed scenes": frames become timed scenes (importAsScenes above).
          const n = await importAsScenes(f, (m: string) => {
            status.textContent = m;
          });
          status.classList.add('is-ok');
          status.textContent = n === 1 ? t('Added 1 scene.') : t('Added {n} scenes.', { n });
        } else if (importMode === 'artboards') {
          // "As artboards": one frame per page, the parts editable (importAsArtboards above).
          const n = await importAsArtboards(f, (m: string) => {
            status.textContent = m;
          });
          status.classList.add('is-ok');
          status.textContent = n === 1 ? t('Added 1 artboard.') : t('Added {n} artboards.', { n });
        } else {
          const { parseDesignFile, countPenpotComponents, parseDesignTemplates } = await import(
            './design-import.ts'
          );
          // A design system's component masters can also be saved as reusable
          // templates. The offer appears as soon as the chosen file turns out to
          // define components (a cheap peek at the zip's component records), and
          // the pass itself runs after the board import so the canvas is never
          // kept waiting on it. Needs the tool's identity to mint sessions with.
          const templateToolId = info?.id || '';
          let componentCount = 0;
          if (templateToolId) {
            componentCount = await countPenpotComponents(f);
            if (componentCount > 0) {
              tplLabel.textContent =
                componentCount === 1
                  ? t('Also save 1 component as a template')
                  : t('Also save {n} components as templates', { n: componentCount });
              tplRow.hidden = false;
            }
          }
          // interactive: a multi-page PDF/.ai asks which page (shared page-picker dialog)
          // instead of silently importing the first. `map` carries this tool's font
          // vocabulary + seed colours (importMap above) into the engine's box mapper.
          const res = await parseDesignFile(f, {
            host: host as any,
            log: (m: string) => {
              status.textContent = m;
            },
            interactive: true,
            map: importMap,
          });
          const boxes = (Array.isArray(res.boxes) ? res.boxes : []) as Box[];
          if (!boxes.length) throw new Error(t('Nothing importable was found in that file.'));
          selection = new Set<string>();
          commit(boxes);
          if (setCanvasSize && res.width > 0 && res.height > 0)
            setCanvasSize(res.width, res.height, 'px');
          status.classList.add('is-ok');
          const imported =
            boxes.length === 1
              ? t('Imported 1 object.')
              : t('Imported {n} objects.', { n: boxes.length });
          status.textContent = imported;
          if (componentCount > 0 && tplBox.checked) {
            // Never let the extra pass fail an import that already succeeded.
            try {
              status.textContent = `${imported} ${t('Saving templates…')}`;
              const { templates } = await parseDesignTemplates(f, {
                host: host as any,
                log: (m: string) => {
                  status.textContent = `${imported} ${m}`;
                },
                // res.map carries the deck's own font families, already resolved
                // by the board import, so nothing is fetched or warned twice.
                map: res.map ?? importMap,
              });
              if (templates.length) {
                const { fileTemplatesAsSessions } = await import('../lib/design-templates.ts');
                const filed = await fileTemplatesAsSessions(host as any, templates, {
                  fileName: (f as File).name,
                  toolId: templateToolId,
                  toolVersion: info?.version,
                  boxesField: input.id,
                  format: info?.formats?.[0],
                  warn: (m: string) => {
                    status.textContent = `${imported} ${m}`;
                  },
                });
                status.textContent = `${imported} ${
                  filed.saved === 1
                    ? tRaw('Saved 1 template in “{folder}”.', { folder: filed.folderName })
                    : tRaw('Saved {n} templates in “{folder}”.', {
                        n: filed.saved,
                        folder: filed.folderName,
                      })
                }`;
              } else {
                status.textContent = `${imported} ${t('No components could be saved as templates.')}`;
              }
            } catch (e) {
              status.textContent = `${imported} ${t('The components couldn’t be saved as templates.')}`;
            }
          }
        }
        setTimeout(() => {
          if (popover === panel) closePopover();
        }, 1400);
      } catch (err) {
        status.classList.add('is-err');
        status.textContent = ((err as any) && (err as any).message) || t('Import failed.');
      } finally {
        chooseBtn.disabled = false;
      }
    });
  }
  // Right-click context menu at the cursor (desktop): a consolidated list of the
  // arrange / align / group / clip / edit actions.
  function openContextMenu(clientX: number, clientY: number): void {
    closePopover();
    const has = selection.size > 0;
    const multi = selection.size >= 2;
    // Outline text is the primary action on a selected text box, so it sits high in
    // the menu (right under Delete) rather than buried at the end of the vector-ops
    // section - where, for a text selection, every other entry is disabled and the
    // whole menu can run past the bottom of the screen. Shown only when there's an
    // outlinable text box in the selection AND the tool can store the result
    // (vectorCfg = pathField declared) AND host.text is present.
    const canOutlineText = Boolean(vectorCfg && cfg.textField && (host as unknown as HostV1).text);
    const outlinableCount = canOutlineText ? countSelected(isOutlinableTextBox) : 0;
    // SLIDE actions for a selected frame (Frame state / Speaker notes / Stack),
    // collected here and spliced in right under Delete - the Outline-text
    // precedent: a frame IS a slide, so its slide verbs are the primary actions,
    // not row 23 of a menu that scrolls (Andy, 2026-09-02, after finding the
    // stack item below the fold).
    const slideItems: PopItem[] = [];
    const items: PopItem[] = [
      {
        label: t('Duplicate'),
        icon: icon(SVG.dup),
        run: () => duplicateSelection(),
        disabled: !has,
      },
      {
        label: t('Cut'),
        icon: icon(SVG.scissors),
        run: () => cutSelection(),
        disabled: !has,
      },
      {
        label: t('Copy style'),
        icon: icon(SVG.dup),
        run: () => copySelectionStyle(),
        disabled: !has || !styleFields.length,
      },
      {
        label: t('Paste style'),
        icon: icon(SVG.pencil),
        run: () => pasteSelectionStyle(),
        disabled: !has || !styleClipboard,
      },
      {
        label: t('Delete'),
        icon: icon(SVG.trash),
        run: () => deleteSelection(),
        disabled: !has,
        danger: true,
      },
      { sep: true },
      ...(outlinableCount
        ? [
            {
              label: t('Outline text'),
              icon: icon(SVG.outlineText),
              run: () => void outlineTextOnSelection(),
            },
            { sep: true } as PopItem,
          ]
        : []),
      // Flip (mirror) - primary direct-manipulation actions on the selection, so they sit
      // high in the menu. Present only for a tool that declares the flip sub-fields
      // (`canFlip`), disabled with nothing selected like every action above.
      ...(canFlip
        ? [
            {
              label: t('Flip horizontal'),
              icon: icon(SVG.flipH),
              run: () => applyFlip('h'),
              disabled: !has,
            } as PopItem,
            {
              label: t('Flip vertical'),
              icon: icon(SVG.flipV),
              run: () => applyFlip('v'),
              disabled: !has,
            } as PopItem,
            { sep: true } as PopItem,
          ]
        : []),
      // Stacking order - icons only, 2×2: columns are magnitude (one step │ all the
      // way), rows are direction (up = forward/front, down = backward/back).
      {
        grid: [
          {
            label: t('Bring forward'),
            icon: icon(SVG.forward),
            run: () => applyZ('forward'),
            disabled: !has,
          },
          {
            label: t('Bring to front'),
            icon: icon(SVG.front),
            run: () => applyZ('front'),
            disabled: !has,
          },
          {
            label: t('Send backward'),
            icon: icon(SVG.backward),
            run: () => applyZ('backward'),
            disabled: !has,
          },
          {
            label: t('Send to back'),
            icon: icon(SVG.back),
            run: () => applyZ('back'),
            disabled: !has,
          },
        ],
        cols: 2,
      },
      { sep: true },
      // Align - icons only, 3 across × 2 rows (L/C/R then T/M/B).
      {
        grid: [
          {
            label: t('Align left'),
            icon: icon(SVG.alignL),
            run: () => applyAlign('left'),
            disabled: !has,
          },
          {
            label: t('Align centre'),
            icon: icon(SVG.alignC),
            run: () => applyAlign('hcentre'),
            disabled: !has,
          },
          {
            label: t('Align right'),
            icon: icon(SVG.alignR),
            run: () => applyAlign('right'),
            disabled: !has,
          },
          {
            label: t('Align top'),
            icon: icon(SVG.alignT),
            run: () => applyAlign('top'),
            disabled: !has,
          },
          {
            label: t('Align middle'),
            icon: icon(SVG.alignM),
            run: () => applyAlign('vcentre'),
            disabled: !has,
          },
          {
            label: t('Align bottom'),
            icon: icon(SVG.alignB),
            run: () => applyAlign('bottom'),
            disabled: !has,
          },
        ],
        cols: 3,
      },
      // Distribute - icons only, one row of 2 (needs 3+ boxes).
      {
        grid: [
          {
            label: t('Distribute horizontally'),
            icon: icon(SVG.distH),
            run: () => applyDistribute('h'),
            disabled: selection.size < 3,
          },
          {
            label: t('Distribute vertically'),
            icon: icon(SVG.distV),
            run: () => applyDistribute('v'),
            disabled: selection.size < 3,
          },
        ],
        cols: 2,
      },
      { sep: true },
      { label: t('Group'), icon: icon(SVG.group), run: () => groupSelection(), disabled: !multi },
      {
        label: t('Ungroup'),
        icon: icon(SVG.ungroup),
        run: () => ungroupSelection(),
        disabled: !canUngroup(),
      },
      {
        label: t('Clip to bottom shape'),
        icon: icon(SVG.clip),
        run: () => clipSelection(),
        disabled: !multi,
      },
      {
        label: t('Release clip'),
        icon: icon(SVG.unclip),
        run: () => releaseClip(),
        disabled: !selHasClip(),
      },
    ];
    // ── timeline ───────────────────────────────────────────────────────────────
    // Right-click parity with the panel's own timing toggle. Present for any
    // time-capable tool - `timeCfg` is null on Carousel Maker, Org Chart and Record, so
    // their menu is byte-for-byte what it was. It deliberately does NOT also require a
    // MOUNTED panel: a Design composition that has never opened its timeline is
    // exactly the user who needs to discover this, and a menu whose height changes
    // between two right-clicks on the same object is the thing the section above avoids.
    // So the panel is loaded on demand and the writer runs once it exists.
    // The two writers live in timeline-panel.ts (promote composes moveOverlay +
    // setDuration in ONE commit; demote clears to '' and repacks a seq row) and are
    // called, never reimplemented. Timing is per-box, so the items act on a single
    // selection and disable rather than hide, like Ungroup above.
    if (timeCfg) {
      const rows = getBoxes();
      const i = selection.size === 1 ? rows.findIndex((b, n) => selection.has(idOf(b, n))) : -1;
      const one = i >= 0 ? rows[i]! : null;
      const oneId = one ? idOf(one, i) : '';
      const timed = !!one && isTimedBox(one);
      // Open (loading the chunk if this is the first time), THEN write - `ensureTimeline`
      // resolves only once `timelinePanel` is assigned, and bails silently if the module
      // failed to load, so a broken chunk means no write rather than a half-written box.
      const withPanel = (fn: (p: NonNullable<typeof timelinePanel>) => void) => () => {
        void ensureTimeline(true).then(() => {
          if (timelinePanel) fn(timelinePanel);
        });
      };
      items.push({ sep: true });
      items.push({
        label: t('Add to the timeline'),
        icon: icon(SVG.timeline),
        run: withPanel((p) => p.promote(oneId)),
        disabled: !one || timed,
      });
      items.push({
        label: t('Make always on'),
        icon: icon(SVG.boxKind),
        run: withPanel((p) => p.demote(oneId)),
        disabled: !timed,
      });
    }
    // ── presentation (plan 112) ─────────────────────────────────────────────────
    // Per-box authoring for present mode, on a frame-capable tool: the audio opt-in and
    // the build (reveal) step. Shown ONLY for a single selected non-frame box, so a
    // multi-select, a frame, or a non-frame tool leaves the menu byte-for-byte unchanged.
    if (frameCfg && selection.size === 1) {
      const rows = getBoxes();
      const si = selIndices(rows);
      const one = si.length === 1 ? rows[si[0]!]! : null;
      const isFrame = !!one && String(one[cfg.kindField]) === frameCfg.frameKind;
      if (one && !isFrame) {
        const img = one['image'] as { url?: string; type?: string } | undefined;
        const hasImage = !!img?.url;
        const isVid =
          img?.type === 'video' || /\.(mp4|m4v|mov|webm)($|\?|#)/i.test(String(img?.url ?? ''));
        const curBuild = Number(one['build']);
        const frameBoxesNow = rows.filter((b) => String(b[cfg.kindField]) === frameCfg.frameKind);
        const bgFrameId = String(one['frame'] ?? '') || resolveFrame(one, frameBoxesNow);
        const setField = (field: string, value: InputValue): void => {
          const bs = getBoxes();
          const idx = new Set(selIndices(bs));
          commit(bs.map((b, i) => (idx.has(i) ? { ...b, [field]: value } : b)));
        };
        items.push({ sep: true });
        // Set as background: fill the box's frame, cover-fit, adopt membership, and send it
        // behind its siblings - the one-click cover image/video backdrop (plan section 8). Any
        // image/video box that resolves to a frame; disabled otherwise so the row is stable.
        items.push({
          label: t('Set as slide background'),
          icon: icon(SVG.image),
          disabled: !(hasImage && bgFrameId),
          run: () => {
            const bs = getBoxes();
            const idx = selIndices(bs);
            const fbs = bs.filter((b) => String(b[cfg.kindField]) === frameCfg.frameKind);
            const fid = String(bs[idx[0]!]?.['frame'] ?? '') || resolveFrame(bs[idx[0]!], fbs);
            const fb = bs.find((b) => String(b['id'] ?? '') === fid);
            if (!fb || idx.length !== 1) return;
            const filled = bs.map((b, i) =>
              i === idx[0]
                ? { ...b, x: fb['x'], y: fb['y'], w: fb['w'], h: fb['h'], fit: 'cover', frame: fid }
                : b
            );
            commit(reorderZ(filled, idx, 'back'));
          },
        });
        items.push({
          label: t('Play sound when presenting'),
          icon: icon(SVG.video),
          on: one['presentAudio'] === true,
          disabled: !isVid,
          run: () => setField('presentAudio', one['presentAudio'] !== true),
        });
        // Reveal step (build): "Always visible" + steps 1–3 as radios (equal numbers
        // reveal together; a box hidden until its step is advanced to in present mode).
        items.push({
          label: t('Always visible'),
          icon: icon(SVG.present),
          on: !(curBuild >= 1),
          run: () => setField('build', ''),
        });
        for (const n of [1, 2, 3]) {
          items.push({
            label: `${t('Reveal at step')} ${n}`,
            on: curBuild === n,
            run: () => setField('build', n),
          });
        }
        // Morph match (plan 112 M5's last gap): the explicit pairing tag the morph
        // transition prefers over its implicit text/image matching.
        items.push({
          label: t('Morph match…'),
          icon: icon(SVG.present),
          run: () => openMorphMatchPanel(viewEl, si[0]!),
        });
      } else if (one && isFrame) {
        // A selected FRAME: set its present-mode `state` tokens (per-slide theming) and
        // its speaker `notes` (shown only in the speaker view, never on the slide).
        // These go into slideItems, which the tail splices in under Delete.
        slideItems.push({
          label: t('Frame state (present)…'),
          icon: icon(SVG.present),
          run: () => openFrameStatePanel(viewEl, si[0]!),
        });
        slideItems.push({
          label: t('Speaker notes…'),
          icon: icon(SVG.notes),
          run: () => openSpeakerNotesPanel(viewEl, si[0]!),
        });
        // Sub-slide stacks (plan 112 M5): structure disposes. Stacking writes the
        // previous COLUMN HEAD's id into stackOf; unstacking clears it. Present
        // order is the hook's own (order asc, x asc), so "previous" here is
        // exactly the slide to this one's left in the deck.
        {
          const bs2 = getBoxes();
          const fbs = bs2
            .map((b, i2) => ({ b, i2 }))
            .filter((e) => String(e.b[cfg.kindField]) === frameCfg?.frameKind)
            .sort(
              (p, q) =>
                (Number(p.b['order']) || 0) - (Number(q.b['order']) || 0) ||
                (Number(p.b['x']) || 0) - (Number(q.b['x']) || 0)
            );
          const at = fbs.findIndex((e) => e.i2 === si[0]);
          const stacked = String(bs2[si[0]!]?.['stackOf'] ?? '') !== '';
          const prevHead =
            at > 0
              ? fbs
                  .slice(0, at)
                  .reverse()
                  .find((e) => String(e.b['stackOf'] ?? '') === '')
              : undefined;
          if (stacked) {
            slideItems.push({
              label: t('Unstack this slide'),
              icon: icon(SVG.present),
              run: () => setField('stackOf', ''),
            });
          } else if (prevHead) {
            const headId = String(prevHead.b['id'] ?? '');
            if (headId) {
              slideItems.push({
                label: t('Stack under the previous slide'),
                icon: icon(SVG.present),
                run: () => setField('stackOf', headId),
              });
            }
          }
        }
      }
      // Per-box CSS class names (plan 112 M4) - the companion to doc-level Custom CSS,
      // for ANY single box, frame included: a rule can then say `.callout { … }` instead
      // of addressing a machine-minted id. Not a present-only field (the class rides the
      // canvas and every export), so it sits at the end of the section rather than inside
      // either branch.
      if (one) {
        items.push({
          label: t('CSS class…'),
          icon: icon(SVG.code),
          run: () => openBoxClassPanel(viewEl, si[0]!),
        });
      }
    }
    // ── vector operations ──────────────────────────────────────────────────────
    // Present only for tools whose manifest declares `canvas.pathField` (there is
    // nowhere to store a result otherwise); WITHIN the section every entry disables
    // rather than hides, like Ungroup / Release clip above, so the menu keeps the same
    // height between right-clicks.
    if (vectorCfg) {
      const regions = countSelected((b) => boxOutlineKind(b, vectorCfg) !== 'none');
      const paths = countSelected((b) => boxOutlineKind(b, vectorCfg) === 'path');
      // A boolean needs two operands that actually bound a region - two text boxes are
      // two selected boxes and no shapes at all.
      const boolItem = (op: BooleanOpName, label: string, ic: string): PopGridItem => ({
        label,
        icon: icon(ic),
        disabled: regions < 2,
        run: () =>
          runVectorOp((ops, id) => booleanBoxes(ops, op, { cfg: vectorCfg, id }), {
            skipNote: true,
            empty: boolEmptyMessage(op),
          }),
      });
      items.push({ sep: true });
      items.push({
        cols: 4,
        grid: [
          boolItem('union', t('Union - merge into one shape'), SVG.boolUnion),
          // Operand order is vector-ops' documented convention and Illustrator's/Figma's:
          // the BOTTOMMOST selected shape is the base and everything above is taken away.
          boolItem(
            'difference',
            t('Subtract - remove the shapes above from the bottom one'),
            SVG.boolSubtract
          ),
          boolItem('intersect', t('Intersect - keep only where they overlap'), SVG.boolIntersect),
          boolItem('xor', t('Exclude - keep everything but the overlap'), SVG.boolExclude),
        ],
      });
      items.push({
        label: t('Outline stroke…'),
        icon: icon(SVG.outlineStroke),
        disabled: !regions,
        run: () => askOutlineStroke(),
      });
      items.push({
        label: t('Offset path…'),
        icon: icon(SVG.offsetPath),
        disabled: !regions,
        run: () => askOffsetPath(),
      });
      items.push({
        label: t('Simplify'),
        icon: icon(SVG.simplify),
        disabled: !paths,
        run: () =>
          runVectorOp((ops, id) => simplifyBoxes(ops, SIMPLIFY_TOL, { cfg: vectorCfg, id }), {
            each: true,
          }),
      });
      // NOTE: "Outline text" lives near the TOP of this menu (just under Delete), not
      // here - see the canOutlineText block at the head of openContextMenu. It is the
      // gateway INTO vector editing for a text box, so it must not sit below a wall of
      // path-only ops that are all disabled while text is selected.
    }
    // ── remove background ──────────────────────────────────────────────────────
    // Present for any tool with an image field (somewhere to store the cutout)
    // once the on-device matte capability has a STAGED model - otherwise absent,
    // like the timeline/vector sections. Acts on ONE selected image box and, like
    // Ungroup / the vector ops, disables rather than hides so the menu keeps a
    // constant height between right-clicks.
    const matteApi = (host as unknown as HostV1).matte;
    if (cfg.imageField && matteApi?.isAvailable() === true && matteApi.models().length > 0) {
      const rows = getBoxes();
      const idxs = selIndices(rows);
      const one = idxs.length === 1 ? rows[idxs[0]!]! : null;
      const img = one
        ? (one[cfg.imageField] as { id?: string; url?: string } | undefined)
        : undefined;
      items.push({ sep: true });
      items.push({
        label: t('Remove background'),
        icon: icon(SVG.scissors),
        run: () => void removeBackgroundOnSelection(),
        disabled: !(img?.id || img?.url),
      });
    }
    // ── lift layers (plans/104 section 7) ─────────────────────────────────────────────
    // Present for any tool with an image field (somewhere to put the derived
    // documents) - absent entirely otherwise, like the timeline/vector/matte
    // sections. WITHIN the section it disables rather than hides, so the menu keeps
    // the same height between right-clicks: the entry is what tells someone the
    // action exists at all, and an entry that appears only once you have already
    // selected the right kind of box teaches nobody anything.
    if (canLift()) {
      items.push({ sep: true });
      items.push({
        label: t('Lift layers'),
        icon: icon(SVG.liftLayers),
        run: () => askLiftLayers(),
        disabled: liftTargetIndex(getBoxes()) < 0,
      });
    }
    // ── choreograph (plans/104 P4) ────────────────────────────────────────────────────
    // Lift's own section, and its posture verbatim: present for any tool that can hold
    // keyframes at all, absent otherwise, and WITHIN the section disabled rather than
    // hidden so the menu keeps a constant height. The separator is Lift's when Lift is
    // here; a keyframe-capable tool with no image field opens the section itself.
    if (canChoreograph()) {
      if (!canLift()) items.push({ sep: true });
      items.push({
        label: t('Choreograph…'),
        icon: icon(SVG.choreo),
        run: () => askChoreograph(),
        disabled: !canChoreographNow(),
      });
    }
    lastMenuAt = { x: clientX, y: clientY };
    // The slide splice: index 3 is the slot right after Duplicate, Delete and
    // their separator - the same slot Outline text takes for a text selection
    // (a frame selection never has one, so the two can't collide).
    if (slideItems.length) items.splice(3, 0, ...slideItems, { sep: true });
    popover = document.createElement('div');
    popover.className = 'fc-popover fc-context-menu';
    // The rows carry `role="menuitem"`, so the container has to say `menu` - an orphan
    // menuitem tells a screen reader less than a plain button would.
    popover.setAttribute('role', 'menu');
    fillPopover(popover, items);
    popover.addEventListener('pointerdown', (e) => e.stopPropagation());
    popover.addEventListener('keydown', onPopoverKey);
    stageEl.appendChild(popover);
    const sr = stageEl.getBoundingClientRect();
    const left = Math.max(6, Math.min(clientX - sr.left, sr.width - popover.offsetWidth - 6));
    const top = Math.max(6, Math.min(clientY - sr.top, sr.height - popover.offsetHeight - 6));
    popover.style.left = left + 'px';
    popover.style.top = top + 'px';
  }
  // Open the menu at a point, selecting whatever is under it first (a right-click on an
  // unselected box acts on THAT box, not on the stale selection). Shared by the desktop
  // `contextmenu` event and the touch two-finger tap below, so both behave identically.
  function contextMenuAt(clientX: number, clientY: number, soloBox: boolean): void {
    if (editing) commitTextEdit();
    // While node editing, right-click is a NODE menu (align/distribute/continuity/delete),
    // not the object menu - and it must not re-select boxes underneath.
    if (penEdit) {
      openPenNodeMenu(clientX, clientY);
      return;
    }
    const nat = clientToNative(clientX, clientY);
    const boxes = getBoxes();
    const hit = selectHit(boxes, nat.x, nat.y); // artboard-aware: child over frame; frame on empty area
    // Plan 179 C4, both halves. An UNSELECTED box is SELECTED - `new Set`, replacing what
    // was there, never adding to it: a menu that acts on "this and whatever was selected
    // before" is a menu whose verbs are aimed at something the user cannot see. A box that
    // IS in the selection leaves the selection exactly as it stands, so right-clicking one
    // member of a group of five still means all five.
    if (hit >= 0 && !selection.has(idOf(boxes[hit], hit))) {
      selection = new Set(selectionForHit(boxes, hit, soloBox));
      ctxSelKey = null; // the object bar re-gates for the new kind
      renderChrome();
    }
    openContextMenu(clientX, clientY);
  }
  function onContextMenu(e: MouseEvent): void {
    e.preventDefault();
    contextMenuAt(e.clientX, e.clientY, e.altKey);
  }

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
  };
  function openAddMenu(anchor: HTMLElement): void {
    spawnPopover(
      anchor,
      addKinds.map((k) => ({
        label: k.label ? t(k.label) : k.id,
        icon: icon(ADD_KIND_ICON[k.id] || SVG.add),
        run: () => setMode('create', { kind: k }),
      }))
    );
  }
  function openArrangeMenu(): void {
    const has = selection.size > 0;
    const multi = selection.size >= 2;
    const canDist = selection.size >= 3;
    spawnPopover(arrangeBtn!, [
      // Align - a compact 3×2 icon grid (left/centre/right · top/middle/bottom).
      {
        cols: 3,
        grid: [
          { label: t('Align left'), icon: icon(SVG.alignL), run: () => applyAlign('left') },
          { label: t('Align centre'), icon: icon(SVG.alignC), run: () => applyAlign('hcentre') },
          { label: t('Align right'), icon: icon(SVG.alignR), run: () => applyAlign('right') },
          { label: t('Align top'), icon: icon(SVG.alignT), run: () => applyAlign('top') },
          { label: t('Align middle'), icon: icon(SVG.alignM), run: () => applyAlign('vcentre') },
          { label: t('Align bottom'), icon: icon(SVG.alignB), run: () => applyAlign('bottom') },
        ],
      },
      // Distribute - needs 3+ selected, so disabled otherwise.
      {
        cols: 2,
        grid: [
          {
            label: t('Distribute horizontally'),
            icon: icon(SVG.distH),
            run: () => applyDistribute('h'),
            disabled: !canDist,
          },
          {
            label: t('Distribute vertically'),
            icon: icon(SVG.distV),
            run: () => applyDistribute('v'),
            disabled: !canDist,
          },
        ],
      },
      { sep: true },
      { label: t('Bring to front'), icon: icon(SVG.front), run: () => has && applyZ('front') },
      { label: t('Bring forward'), icon: icon(SVG.forward), run: () => has && applyZ('forward') },
      { label: t('Send backward'), icon: icon(SVG.backward), run: () => has && applyZ('backward') },
      { label: t('Send to back'), icon: icon(SVG.back), run: () => has && applyZ('back') },
      { sep: true },
      { label: t('Group'), icon: icon(SVG.group), run: () => multi && groupSelection() },
      { label: t('Ungroup'), icon: icon(SVG.ungroup), run: () => ungroupSelection() },
      { sep: true },
      {
        label: t('Clip to bottom shape'),
        icon: icon(SVG.clip),
        run: () => multi && clipSelection(),
      },
      { label: t('Release clip'), icon: icon(SVG.unclip), run: () => releaseClip() },
    ]);
  }

  // ── contextual bar ───────────────────────────────────────────────────────────

  /** Is every selected box a vector path box? Stroke paint only means something there -
   *  every other kind is a styled div, whose "border" is a different mechanism entirely -
   *  so a mixed selection gets no stroke controls rather than controls that write a field
   *  half the selection ignores. */
  function selectionAllPaths(boxes: Box[], idx: number[]): boolean {
    if (!vectorCfg || !idx.length) return false;
    return idx.every((i) => boxOutlineKind(boxes[i], vectorCfg!) === 'path');
  }

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
  const STROKE_KINDS = new Set(['path', 'box', 'image', 'frame']);
  /** Kinds that render NO text node, so "Edit text" would open nothing. */
  const NO_TEXT_KINDS = new Set(['frame', 'audio', 'camera']);
  /** Kinds that paint no picture from the image field. (An `audio` box DOES use it - that
   *  field is where its track lives - and a frame page paints it as the board's fill.) */
  const NO_IMAGE_KINDS = new Set(['camera']);
  /** The kind a row declares, or '' for a tool whose boxes carry none. */
  const kindOf = (b: Box | undefined): string => String(b?.[cfg.kindField] ?? '');
  /** Does EVERY selected row's kind belong to `kinds`? (A mixed selection gets the
   *  control only when all of it can honour the write - the `selectionAllPaths` rule.) */
  function selectionAllKinds(boxes: Box[], idx: number[], kinds: ReadonlySet<string>): boolean {
    if (!idx.length) return false;
    return idx.every((i) => {
      const k = kindOf(boxes[i]);
      return !k || kinds.has(k);
    });
  }
  /** Does EVERY selected row's kind stay OUT of `kinds`? The deny-list twin of
   *  {@link selectionAllKinds}; the empty kind is never in a deny set, so it passes. */
  function selectionNoKinds(boxes: Box[], idx: number[], kinds: ReadonlySet<string>): boolean {
    if (!idx.length) return false;
    return idx.every((i) => !kinds.has(kindOf(boxes[i])));
  }

  /**
   * The element whose cascade resolves a `var()` colour: the tool's own canvas, where
   * the brand vars are installed. `#tool-canvas` is the shell's id for it; the overlay's
   * `canvasEl` IS that element in the app and a bare div in a test harness, so this reads
   * the id first and falls back to what the overlay was handed.
   */
  function colorScope(): Element | null {
    return (
      (typeof document !== 'undefined' ? document.getElementById('tool-canvas') : null) ?? canvasEl
    );
  }

  /**
   * One colour field's SEED (plan 179 A2). A stored `var(--brand-primary, #0b1220)` is
   * resolved through the canvas's computed style so the swatch, the sliders and the value
   * field all show the colour the artboard is actually painted, and the token's own name
   * ("Primary") rides along on the trigger.
   *
   * The MODEL is not touched. Nothing here writes; the `var()` survives in the box until
   * the user picks a different colour, at which point the picker stores whatever it
   * always stored.
   */
  function colorSeed(raw: unknown): { value: string; name: string } {
    const s = raw == null ? '' : String(raw);
    return { value: resolveColorVar(s, colorScope()), name: colorVarLabel(s) };
  }
  /** `colorFieldHtml` with the var() resolution applied - every seed in the editor.
   *  A function declaration, not a const: `buildToolbar` runs before this line does. */
  function seededColorField(id: string, raw: unknown): string {
    const s = colorSeed(raw);
    return colorFieldHtml(id, s.value, { float: true, name: s.name });
  }

  /**
   * The PAINT section of a contextual bar: fill, text colour, and - for any kind that
   * renders a stroke - stroke colour plus the button onto the rest of the stroke (width,
   * style, ends, corners, fill rule).
   *
   * Shared by the object bar and the pen's node-editing bar because the pen bar REPLACES
   * `ctxbar.innerHTML`: without sharing, every paint control vanished at exactly the moment
   * the user was shaping the thing they wanted to paint. Composed rather than appended so
   * each bar keeps deciding its own order.
   *
   * `allPaths` still gates the PATH-only half (a path has no text ink and no gradient
   * fill); `allStroked` - which every path also satisfies - gates the stroke pair, so an
   * artboard's baked 2px border is finally removable from the canvas that drew it.
   */
  function paintCtxHtml(first: Box, allPaths: boolean, allStroked: boolean = allPaths): string {
    const fillVal = cfg.fillField ? first[cfg.fillField] || 'transparent' : '';
    const fgVal = cfg.textColorField ? first[cfg.textColorField] || '#0c322c' : '#0c322c';
    const strokeVal = cfg.strokeField ? first[cfg.strokeField] || 'transparent' : 'transparent';
    // While a gradient is being edited on the canvas, the SAME field edits the
    // selected stop's colour instead of the flat fill - so the brand swatch palette
    // (the whole reason to reuse this control) is one click from every stop.
    const gradOn = gradEdit != null;
    const fillTitle = gradOn ? t('Gradient stop colour') : t('Fill');
    const fillShown = gradOn ? (gradStopColor(first) ?? fillVal) : fillVal;
    return (
      (cfg.fillField
        ? `<span class="fc-cfield" data-tip="${escape(fillTitle)}">${seededColorField('fc-fill', fillShown)}</span>`
        : '') +
      (cfg.gradField && !allPaths
        ? `<button type="button" class="fc-cbtn${gradOn ? ' is-on' : ''}" data-cx="grad" aria-pressed="${gradOn}" data-tip="${escape(t('Gradient - drag the stops on the canvas'))}" aria-label="${escape(t('Gradient fill'))}">${icon(SVG.gradIc)}</button>`
        : '') +
      (cfg.textColorField && !allPaths
        ? `<span class="fc-cfield" data-tip="${escape(t('Text colour'))}">${seededColorField('fc-fg', fgVal)}</span>`
        : '') +
      (allStroked && cfg.strokeField
        ? `<span class="fc-cfield" data-tip="${escape(t('Stroke colour'))}">${seededColorField('fc-stroke', strokeVal)}</span>`
        : '') +
      (allStroked
        ? `<button type="button" class="fc-cbtn" data-cx="stroke" data-tip="${escape(t('Stroke - width, style, ends, corners, fill rule'))}" aria-label="${escape(t('Stroke options'))}">${icon(SVG.strokeIc)}</button>`
        : '')
    );
  }

  /** One `wireColorField` call per bar - it binds delegated listeners on the scope, so a
   *  second call on the same element would fire every change twice. */
  function wirePaintCtx(scope: HTMLElement): void {
    wireColorField(scope, {
      onChange: (id, val) => {
        if (id === 'fc-fill') {
          if (gradEdit != null) setGradStopColor(unwrapColor(val));
          else setField(cfg.fillField, unwrapColor(val));
        } else if (id === 'fc-fg') setField(cfg.textColorField, unwrapColor(val));
        else if (id === 'fc-stroke') setField(cfg.strokeField, unwrapColor(val));
      },
    });
  }

  /**
   * "+Keyframe" in its SECOND home (plans/104 section 8's M2.5 revision - "TWO homes, one
   * action"). The first is the timeline transport's left additive cluster; this is the
   * diamond beside Duplicate / Delete on the selected object itself, because the
   * selection is what the action acts on and the canvas is where the selection lives.
   *
   * Offered only for a tool whose manifest declares a `kf` sub-field (progressive
   * capability, exactly like the timeline rail button next to it), and DISABLED rather
   * than hidden when the selection has nothing to pose - a control that appears and
   * disappears as you click around teaches nothing, and the tooltip is where the reason
   * goes. Audio is the one exclusion: keyframed gain is plan 101's, not this feature's.
   *
   * WHICH boxes count is the PANEL's answer, not a local copy of it (`keyframableIds`
   * on the handle). "Two homes, one action" has to mean one ENABLEMENT rule too, or the
   * homes disagree about what the action can do: the panel's rule reads the live canvas
   * as well as the model - a box carrying an audio asset is a sound whatever its `kind`
   * says - and a model-only filter here rendered that box ENABLED, then wrote nothing
   * and said nothing when it was pressed.
   *
   * Before the lazy panel chunk has ever loaded there is no rule to ask, so the model
   * half stands in; `ensureTimeline` invalidates `ctxSelKey` the moment the panel does
   * exist, which rebuilds this bar against the real answer.
   */
  function kfCtxHtml(boxes: Box[], idx: number[]): string {
    if (!timeCfg?.kfField) return '';
    const n = timelinePanel
      ? timelinePanel.keyframableIds(idx.map((i) => idOf(boxes[i], i))).length
      : idx.filter((i) => String(boxes[i]?.kind ?? '') !== 'audio').length;
    const tip = n ? t('+Keyframe') : t('Sound has no pose to keyframe');
    return (
      `<button type="button" class="fc-cbtn" data-cx="kf" aria-disabled="${n ? 'false' : 'true'}"` +
      ` data-tip="${escape(tip)}" aria-label="${escape(tip)}">${icon(SVG.keyframe)}</button>`
    );
  }

  /**
   * The press. It opens the timeline first - `ensureTimeline(true)` loads the lazy
   * chunk and resolves only once the panel exists - then calls the panel's ONE writer,
   * which reads the shared selection itself. Same `withPanel` shape as the context
   * menu's timing items above, and for the same reason: a broken chunk means no write
   * rather than a half-written box.
   *
   * Opening the panel is not incidental. section 8's latch model says the playhead's position
   * IS the arm, so the surface that shows the playhead has to be up before a keyframe
   * can honestly be written at it.
   */
  function addKeyframeFromCanvas(): void {
    void ensureTimeline(true).then(() => {
      timelinePanel?.addKeyframe();
    });
  }

  // ── camera mode (plans/104 section 8) ───────────────────────────────────────────────
  //
  // "Camera mode is entered by SELECTION, never a global toggle": with a camera
  // selected and the playhead inside its window, an empty-stage drag pans the shot and
  // a plain wheel dollies it. There is nothing to switch on and nothing to switch off -
  // clicking any box hands both gestures straight back.
  //
  // The PANEL owns the answer (it owns the clock, and "inside its window" is a question
  // about the playhead), so this is one call and no local copy of the rule. Before the
  // lazy panel chunk exists there is no camera and no clock, hence ''.

  /** The camera a canvas gesture is aimed at right now, or ''. */
  function camModeId(): string {
    return timelinePanel?.cameraModeId() ?? '';
  }

  /**
   * The DOLLY, coalesced (section 8: "wheel coalesces one commit per pause").
   *
   * A wheel is a stream of small deltas with no end event, so a commit per notch would
   * be a hundred undo steps for one gesture. The deltas accumulate here and one write
   * lands when the stream stops - the same "one commit per gesture" law the drags obey,
   * with a timer standing in for pointerup.
   */
  let dollyPending = 0;
  let dollyTimer: ReturnType<typeof setTimeout> | null = null;
  const DOLLY_PAUSE_MS = 180;
  /** Wheel notches → dolly px. A notch is ~100 deltaY on a mouse; ~24px of camera is a
   *  visible but recoverable step at P = 1200. */
  const DOLLY_PX_PER_DELTA = 0.24;
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
  const CAM_TILT_DEG_PER_PX = 0.2;
  /**
   * `deltaY` is only in PIXELS when `deltaMode` says so. Firefox reports LINES (mode 1,
   * ~3 per notch) and a page-scroll device reports PAGES (mode 2) - read raw, a notch
   * there would dolly two thirds of a pixel and the wheel would feel dead. The two
   * factors are the conventional line height and viewport page the browsers themselves
   * use when they normalise.
   */
  const wheelPx = (e: WheelEvent): number =>
    e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight || 800 : 1);

  function flushDolly(): void {
    dollyTimer = null;
    const d = dollyPending;
    dollyPending = 0;
    if (!d || !timelinePanel) return;
    const boxes = getBoxes();
    const next = timelinePanel.cameraWrite(boxes, { z: d });
    if (next !== boxes) commit(next);
  }

  /**
   * Plain wheel = DOLLY; Cmd/Ctrl-wheel stays the VIEW's zoom and Space+drag stays the
   * view's pan (section 8: "move the shot" and "move my view" have to stay separable, which
   * the reference tool never had to solve).
   *
   * Bound on the canvas with `passive: false` so the notch can be claimed, and it stops
   * propagating only when it IS claimed - otherwise `tool-stage-nav`'s own listener on
   * the stage keeps the wheel it has always had.
   */
  function onCameraWheel(e: WheelEvent): void {
    if (e.ctrlKey || e.metaKey) return; // the view's zoom, untouched
    if (!camModeId()) return; // no camera armed: the view's pan
    e.preventDefault();
    e.stopPropagation();
    // AWAY FROM THE VIEWER ON A SCROLL DOWN. `eff = P/(P − (z − camZ))`, so a camera
    // whose z grows is a camera moving back - and a wheel pushed forward (deltaY < 0)
    // is the universal "closer", so the sign here is deltaY's own.
    dollyPending += wheelPx(e) * DOLLY_PX_PER_DELTA;
    if (dollyTimer) clearTimeout(dollyTimer);
    dollyTimer = setTimeout(flushDolly, DOLLY_PAUSE_MS);
  }

  /**
   * A cheap signature of everything the object bar PAINTS from the model: the four colour
   * fields' values plus the kind that decides which controls exist. Compared per sync, so
   * an undo, a redo, a hook patch or another device's edit re-seeds the swatches.
   *
   * It is deliberately narrow. Opacity, radius, shadow and every other More-panel field
   * are absent because the bar does not show them - widening this would rebuild the bar
   * (and close the open panel) on every slider tick.
   *
   * While a floating surface is OPEN the signature is HELD at whatever the bar was built
   * with, because `rebuildCtxBar` begins with `closeMorePanel()` and re-writes
   * `ctxbar.innerHTML`: a rebuild under an open surface destroys the very thing the
   * pointer is inside. Two surfaces qualify, and BOTH are needed once the trigger widened
   * from "the selection set changed" to "any painted value changed":
   *
   *   · a colour popover ANYWHERE - the picker writes the model on every swatch click and
   *     slider tick, and the rail's artboard-fill swatch is not a child of `ctxbar`, so a
   *     bar-scoped test let each LCH tick re-`innerHTML` the bar under it;
   *   · an open More / Stroke / Text / dims panel - Cmd+Z, a collaborator's fill edit or a
   *     colour picked from the bar would otherwise close the panel being worked in.
   *
   * Each trigger keeps itself current on its own (`updateTrigger`), and the next sync
   * after the surface closes picks the real signature back up.
   */
  const ctxValueHeld = (): boolean =>
    !!document.querySelector('.color-trigger[aria-expanded="true"]') || !!morePanel;

  function ctxValueSig(boxes: Box[], idx: number[]): string {
    if (ctxValueHeld()) {
      // Split at the FIRST '|' only: ids never contain one, but an authored colour could,
      // and a sig sliced in half would compare unequal and rebuild the very bar this
      // branch exists to keep standing.
      const cut = String(ctxSelKey ?? '').indexOf('|');
      if (cut >= 0) return String(ctxSelKey).slice(cut + 1);
    }
    const fields = [
      cfg.fillField,
      cfg.gradField,
      cfg.textColorField,
      cfg.strokeField,
      cfg.kindField,
    ];
    // Delimited, not concatenated: '#fff' + '' and '' + '#fff' are different states, and a
    // signature that cannot tell them apart is a rebuild that never happens. The two
    // separators are control characters, so no authored colour or kind can forge one.
    return idx
      .map((i) => {
        const b = boxes[i] || {};
        return fields.map((f) => (f ? String(b[f] ?? '') : '')).join('\u0001');
      })
      .join('\u0002');
  }

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
  let inspectorPort: {
    reveal(
      section: 'document' | 'artboard' | 'object' | 'text' | 'image' | 'motion' | 'present' | 'guide'
    ): void;
  } | null = null;
  function setInspector(h: typeof inspectorPort): void {
    inspectorPort = h;
    // With the full Design chrome mounted the bar is the selection toolbar: it stays
    // while something is selected instead of fading whenever the pointer leaves the
    // stage for the inspector or the navigator (see .fc-ctxbar--pinned in editor.css).
    ctxbar.classList.toggle('fc-ctxbar--pinned', !!h);
    // And it is a different bar (verbs only, plans/184 R16), so the one on screen is
    // rebuilt for the current selection rather than waiting for the next change.
    ctxSelKey = '';
    renderChrome();
  }
  /** The stage's reserved bands, read from the inline custom properties the arbiter
   *  (left) and the Design top bar (top) write on the stage; inline reads cost nothing
   *  per sync frame, unlike a computed style. */
  function stageReserves(): { top: number; left: number; right: number } {
    const px = (p: string): number => parseFloat(stageEl.style.getPropertyValue(p)) || 0;
    return {
      top: px('--stage-reserve-top'),
      left: px('--stage-reserve-left'),
      right: px('--stage-reserve-right'),
    };
  }

  function rebuildCtxBar(boxes: Box[], idx: number[]): void {
    // The gradient panel outlives a ctx-bar rebuild. Selecting a stop (and picking a
    // stop colour) deliberately rebuilds the bar so its Fill field shows that stop -
    // and `closeMorePanel()` below would take the panel with it every time, so the
    // panel vanished the moment you touched a handle. Re-request it instead; the sync
    // that follows reopens it against the freshly built button.
    if (gradEdit != null && morePanel?.classList.contains('fc-grad-panel')) gradPanelPending = true;
    closeMorePanel();
    const coarse = matchMedia('(pointer: coarse)').matches; // touch → offer add-to-selection
    const first: Box = boxes[idx[0]!] || {};
    const allPaths = selectionAllPaths(boxes, idx);
    // Stroke goes to every kind that renders a border (A5); text and image controls to
    // the kinds that can hold them (C3). A control that appears and then does nothing is
    // worse than one that is not there: "Edit text" on an artboard, an image or a path
    // opened nothing and said nothing at all.
    // `vectorCfg` (i.e. the manifest declared `pathField`) is the tool-level gate. It is
    // not incidental: `cfg.strokeField` DEFAULTS to 'stroke' for every canvas tool, so
    // without it a Carousel Maker card - whose hooks paint no border at all - would grow
    // a stroke swatch writing a field nothing reads. Both tools that declare `pathField`
    // (Design, Org Chart) also declare stroke on box/image/frame, which is the model this
    // widening follows.
    const allStroked = allPaths || (!!vectorCfg && selectionAllKinds(boxes, idx, STROKE_KINDS));
    const canText = !!cfg.textField && selectionNoKinds(boxes, idx, NO_TEXT_KINDS);
    const canImage = !!cfg.imageField && selectionNoKinds(boxes, idx, NO_IMAGE_KINDS);
    // An audio box's "image" IS its track, so the one button says which it is picking.
    const audioPick = canImage && selectionAllKinds(boxes, idx, new Set(['audio']));
    const imgTip = audioPick ? t('Choose a sound') : t('Set image');
    // VERBS ONLY when an inspector owns the properties (plans/184 R16): edit text, edit
    // points, set image, keyframe, duplicate, delete, select more - and the readout, which
    // jumps to the Object section, plus Aa to the Text section. The paint cluster and the
    // More opener duplicated the inspector beside it, on a bar that floats over the work.
    // Gradient mode is the one exception: its stops are handles on the canvas and the bar's
    // Fill field edits the SELECTED STOP, which nothing else offers. Without an inspector
    // (no dock host) the bar keeps every control and its own popovers, as before.
    const verbsOnly = !!inspectorPort && gradEdit == null;
    ctxbar.innerHTML = `
      ${verbsOnly ? '' : paintCtxHtml(first, allPaths, allStroked)}
      ${
        vectorCfg && idx.length === 1 && boxOutlineKind(first, vectorCfg) === 'path'
          ? `<button type="button" class="fc-cbtn" data-cx="nodes" data-tip="${escape(t('Edit points (double-click)'))}" aria-label="${escape(t('Edit points'))}">${icon(SVG.nodes)}</button>`
          : ''
      }
      ${canText ? `<button type="button" class="fc-cbtn" data-cx="edit" data-tip="${escape(t('Edit text (double-click)'))}" aria-label="${escape(t('Edit text'))}">${icon(SVG.pencil)}</button>` : ''}
      ${canText ? `<button type="button" class="fc-cbtn fc-cbtn-text" data-cx="text" data-tip="${escape(t('Text - size, font, weight, line height, kerning, ligatures, alignment'))}" aria-label="${escape(t('Text options'))}">Aa</button>` : ''}
      ${canImage ? `<button type="button" class="fc-cbtn" data-cx="setimg"${audioPick ? ' data-cx-audio="1"' : ''} data-tip="${escape(imgTip)}" aria-label="${escape(imgTip)}">${icon(audioPick ? SVG.audioKind : SVG.image)}</button>` : ''}
      ${verbsOnly ? '' : `<button type="button" class="fc-cbtn" data-cx="more" data-tip="${escape(t('More - shape, radius, opacity, fit, blend, shadow'))}" aria-label="${escape(t('More options'))}">${icon(SVG.more)}</button>`}
      <span class="fc-sep fc-sep-v"></span>
      ${kfCtxHtml(boxes, idx)}
      <button type="button" class="fc-cbtn" data-cx="dup" data-tip="${escape(t('Duplicate'))}" aria-label="${escape(t('Duplicate'))}">${icon(SVG.dup)}</button>
      <button type="button" class="fc-cbtn fc-danger" data-cx="del" data-tip="${escape(t('Delete'))}" aria-label="${escape(t('Delete'))}">${icon(SVG.trash)}</button>
      ${coarse ? `<button type="button" class="fc-cbtn${multiTapMode ? ' is-on' : ''}" data-cx="multi" aria-pressed="${multiTapMode}" data-tip="${escape(t('Select more - tap cards to add'))}" aria-label="${escape(t('Select more cards'))}">${icon(SVG.add)}</button>` : ''}
      <button type="button" class="fc-readout" data-cx="dims" data-cx-readout data-tip="${escape(verbsOnly ? t('Edit in the inspector') : t('Edit position & size'))}" aria-label="${escape(verbsOnly ? t('Edit in the inspector') : t('Edit position and size'))}"></button>`;
    wirePaintCtx(ctxbar);
    ctxbar.querySelectorAll<HTMLElement>('[data-cx]').forEach((b) =>
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        const cx = b.dataset.cx;
        if (cx === 'text') {
          if (inspectorPort) inspectorPort.reveal('text');
          else openTextPanel(b);
        } else if (cx === 'stroke') {
          if (inspectorPort) inspectorPort.reveal('object');
          else openStrokePanel(b);
        } else if (cx === 'nodes') {
          if (selection.size) startPenEdit([...selection][0]!);
        } else if (cx === 'edit') {
          if (selection.size) startTextEdit([...selection][0]!, { selectAll: true });
        } else if (cx === 'kf') {
          if (b.getAttribute('aria-disabled') !== 'true') addKeyframeFromCanvas();
        } else if (cx === 'dup') duplicateSelection();
        else if (cx === 'del') deleteSelection();
        else if (cx === 'setimg') pickImage(b.dataset.cxAudio ? { pickType: 'audio' } : undefined);
        else if (cx === 'more') {
          if (inspectorPort) inspectorPort.reveal('object');
          else openMorePanel(b);
        } else if (cx === 'grad') toggleGradEdit(b);
        else if (cx === 'multi') {
          multiTapMode = !multiTapMode;
          b.classList.toggle('is-on', multiTapMode);
          b.setAttribute('aria-pressed', String(multiTapMode));
          announce(
            multiTapMode ? t('Select more - tap cards to add them.') : t('Multi-select off.')
          );
        } else if (cx === 'dims') {
          if (inspectorPort) inspectorPort.reveal('object');
          else openDimsPanel(b);
        }
      })
    );
  }

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
  let gradEdit: string | null = null; // box id being edited, or null
  let gradStopIdx = 0; // which stop the Fill field + Delete act on
  // The panel is opened by the SYNC, not by the click that asks for it. Entering
  // gradient mode resets `ctxSelKey` so the ctx bar rebuilds (its Fill field changes
  // meaning), and `rebuildCtxBar` begins with `closeMorePanel()` - so a panel opened
  // synchronously was destroyed a frame later by the very re-sync that opening it
  // required. Found in a browser, invisible to review: the handles appeared, the panel
  // did not, and any click into it hit a detached node.
  let gradPanelPending = false;
  // The spec mid-drag. `writeGradSpec(…, live)` only touches the box's own
  // backgroundImage (no setInput, so the tool does not re-render per pointermove), so
  // without this the chrome kept repainting from the COMMITTED model: the grabbed
  // handle was destroyed and rebuilt at its pre-drag position on every frame while the
  // paint underneath followed the pointer. Same idea as `liveRects` for box gestures.
  let gradLive: GradientSpec | null = null;

  // The gradient line, as an SVG in STAGE px - redrawn each sync. Stage px rather than
  // native-with-a-viewBox (the pen layer's trick) because the stop handles are DOM
  // divs that must not scale with zoom, and one coordinate system for both is simpler
  // to keep honest than two.
  const gradLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  gradLayer.setAttribute('class', 'fc-grad-layer');
  gradLayer.style.position = 'absolute';
  gradLayer.style.left = '0';
  gradLayer.style.top = '0';
  gradLayer.style.overflow = 'visible';
  gradLayer.style.pointerEvents = 'none';
  gradLayer.style.display = 'none';
  overlay.appendChild(gradLayer);
  const gradChrome = document.createElement('div');
  gradChrome.className = 'fc-grad-chrome';
  overlay.appendChild(gradChrome);

  /** The parsed spec on a box, or null when it has no (readable) gradient. */
  const gradSpecOf = (b: Box | undefined): GradientSpec | null =>
    b && cfg.gradField ? parseGradientSpec(String(b[cfg.gradField] ?? '')) : null;

  /** Index of the box being gradient-edited, or -1 (it may have been deleted). */
  function gradIndex(boxes: Box[]): number {
    if (gradEdit == null) return -1;
    return boxes.findIndex((b, i) => idOf(b, i) === gradEdit);
  }

  /** Leave gradient mode and drop its chrome. Safe to call when not in it. */
  function exitGradEdit(): void {
    if (gradEdit == null) return;
    gradEdit = null;
    gradStopIdx = 0;
    gradPanelPending = false;
    gradLive = null;
    gradLayer.style.display = 'none';
    gradChrome.innerHTML = '';
    ctxSelKey = ''; // force the ctx bar to rebuild without the stop-colour mode
    scheduleSync();
  }

  /**
   * A fresh gradient for a box that has none: its own fill, ramped toward white.
   *
   * Deliberately not fill→transparent: the point of the first click is to SHOW what a
   * gradient does here, and an OKLab ramp to a light tint does that while staying
   * on-brand (it keeps the fill's hue). A transparent second stop would look like
   * nothing happened on a light artboard.
   */
  function seedGradSpec(b: Box): GradientSpec {
    const fill = cfg.fillField ? String(b[cfg.fillField] ?? '') : '';
    const base = parseColor(fill) ? fill : '#30ba78';
    const light = colorToHexString(
      interpolateColor(parseColor(base)!, parseColor('#ffffff')!, 0.7)
    );
    return parseGradientSpec(`lin_90_${base.replace('#', '')}-0_${light.replace('#', '')}-100`)!;
  }

  /** Enter/leave gradient mode for the current selection. */
  function toggleGradEdit(anchor: HTMLElement): void {
    if (!cfg.gradField) return;
    if (gradEdit != null) {
      exitGradEdit();
      return;
    }
    const boxes = getBoxes();
    const idx = selIndices(boxes);
    if (idx.length !== 1) {
      announce(t('Select one card to edit its gradient.'));
      return;
    }
    const b = boxes[idx[0]!]!;
    gradEdit = idOf(b, idx[0]!);
    gradStopIdx = 0;
    // A box with no gradient yet gets one, in the same step that opens the editor -
    // otherwise the handles would have nothing to sit on.
    if (!gradSpecOf(b)) writeGradSpec(seedGradSpec(b), false);
    ctxSelKey = '';
    gradPanelPending = true;
    void anchor; // the panel anchors on the rebuilt button, not this one
    scheduleSync();
  }

  /**
   * Write a spec to the box being edited. `live` mutates only that box's DOM (a drag
   * in progress - no setInput, so the tool does not re-render every pointermove, the
   * same discipline every other gesture here follows); otherwise it commits one undo
   * step through the model.
   */
  function writeGradSpec(spec: GradientSpec, live: boolean): void {
    if (!cfg.gradField || gradEdit == null) return;
    const value = formatGradientSpec(spec);
    if (live) {
      gradLive = spec;
      // `liveBoxEl`, not a bare `.lolly-box` lookup: an ARTBOARD's element is its page
      // (`.lolly-frame-page[data-frame-id]`), so the plain query answered null and the
      // whole live write was skipped - the handles tracked the pointer while the board's
      // fill sat still until the commit re-rendered (plan 179 A3).
      const el = liveBoxEl(gradEdit);
      if (el) el.style.backgroundImage = gradientSpecToCss(spec) || '';
      return;
    }
    gradLive = null;
    const boxes = getBoxes();
    const i = gradIndex(boxes);
    if (i < 0) return;
    commit(boxes.map((b, j) => (j === i ? { ...b, [cfg.gradField]: value } : b)));
  }

  /** The selected stop's colour, for the ctx bar's Fill field. */
  function gradStopColor(b: Box | undefined): string | null {
    const spec = gradSpecOf(b);
    return spec ? (spec.stops[Math.min(gradStopIdx, spec.stops.length - 1)]?.color ?? null) : null;
  }

  /** Point the ctx bar's Fill field at the selected stop. */
  function setGradStopColor(hex: unknown): void {
    const boxes = getBoxes();
    const i = gradIndex(boxes);
    const spec = i >= 0 ? gradSpecOf(boxes[i]) : null;
    if (!spec) return;
    const at = Math.min(gradStopIdx, spec.stops.length - 1);
    const colour = String(hex ?? '').trim();
    if (!colour || !parseColor(colour)) return;
    spec.stops[at] = { ...spec.stops[at]!, color: colour };
    writeGradSpec(spec, false);
  }

  /** Add a stop at `pos`, coloured as the gradient already is there. */
  function insertGradStop(spec: GradientSpec, pos: number): GradientSpec {
    if (spec.stops.length >= MAX_GRADIENT_STOPS) return spec;
    let at = spec.stops.findIndex((s) => s.pos > pos);
    if (at < 0) at = spec.stops.length;
    const before = spec.stops[Math.max(0, at - 1)]!;
    const after = spec.stops[Math.min(spec.stops.length - 1, at)]!;
    const span = after.pos - before.pos;
    const f = span > 0 ? (pos - before.pos) / span : 0;
    const ca = parseColor(before.color);
    const cb = parseColor(after.color);
    // Sampled through the engine in the spec's OWN space, so the new stop lands on the
    // curve the user can see rather than on the sRGB chord through it.
    const colour =
      ca && cb
        ? colorToHexString(interpolateColor(ca, cb, f, { space: spec.space, hue: spec.hue }))
        : before.color;
    const stops = [...spec.stops];
    stops.splice(at, 0, { color: colour, pos });
    gradStopIdx = at;
    return { ...spec, stops };
  }

  /** Remove the selected stop (a gradient needs two, so this refuses at two). */
  function deleteGradStop(): boolean {
    const boxes = getBoxes();
    const i = gradIndex(boxes);
    const spec = i >= 0 ? gradSpecOf(boxes[i]) : null;
    if (!spec || spec.stops.length <= 2) return false;
    const stops = spec.stops.filter((_, j) => j !== Math.min(gradStopIdx, spec.stops.length - 1));
    gradStopIdx = Math.max(0, Math.min(gradStopIdx, stops.length - 1));
    writeGradSpec({ ...spec, stops }, false);
    ctxSelKey = '';
    return true;
  }

  /**
   * Draw the gradient line + one handle per stop + the direction handle.
   *
   * Rebuilt (not repositioned) each sync: a gradient has a handful of handles and the
   * set changes whenever a stop is added or removed, so the build-once/reposition-many
   * discipline the selection chrome needs would only buy bookkeeping here.
   */
  function paintGradChrome(boxes: Box[], m: Metrics): void {
    if (gradEdit == null) {
      if (gradLayer.style.display !== 'none') {
        gradLayer.style.display = 'none';
        gradChrome.innerHTML = '';
      }
      return;
    }
    const i = gradIndex(boxes);
    // Prefer the in-flight spec so the handles track the pointer, not the last commit.
    const spec = i >= 0 ? (gradLive ?? gradSpecOf(boxes[i])) : null;
    if (!spec) {
      // The box (or its gradient) is gone - leave the mode rather than showing handles
      // for something that no longer exists.
      if (gradEdit != null) exitGradEdit();
      return;
    }
    const r = boxRect(boxes[i]!, cfg);
    const line = gradientLine(r.w, r.h, spec.angle);
    const off = frameOffsetOfEl(liveBoxEl(gradEdit!) ?? canvasEl);
    // Through the box's ROTATION, not a plain translation: the same element that paints
    // the gradient carries `transform: rotate()`, so an axis-aligned mapping left the
    // line and swatches ~76px off the visible sweep on a 200×120 box at 45°, and every
    // drag then wrote a position that did not match the point under the cursor.
    const toStage = (p: { x: number; y: number }) => {
      const f = localToFrame(r as PenFrame, p.x, p.y);
      return nativeToStage(f.x + off.x, f.y + off.y, m);
    };
    const a = toStage(line.from);
    const b = toStage(line.to);

    gradLayer.style.display = '';
    gradLayer.setAttribute('width', String(Math.max(1, m.sr.width)));
    gradLayer.setAttribute('height', String(Math.max(1, m.sr.height)));
    // Two strokes: a dark halo under a light rule, so the line stays visible over any
    // artwork (the same reason the guides layer doubles up).
    gradLayer.innerHTML =
      `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="fc-grad-line-halo"/>` +
      `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="fc-grad-line"/>`;

    gradChrome.innerHTML = '';
    const lerpStage = (t: number) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    spec.stops.forEach((st, si) => {
      const p = lerpStage(Math.min(100, Math.max(0, st.pos)) / 100);
      const h = document.createElement('div');
      h.className =
        'fc-grad-stop' + (si === Math.min(gradStopIdx, spec.stops.length - 1) ? ' is-on' : '');
      h.style.left = `${p.x}px`;
      h.style.top = `${p.y}px`;
      // The handle IS its colour - a swatch you can see against the paint behind it.
      h.style.setProperty('--stop', parseColor(st.color) ? st.color : 'transparent');
      h.setAttribute(
        'data-tip',
        t('Stop {n} - {pos}%', { n: String(si + 1), pos: String(Math.round(st.pos)) })
      );
      h.setAttribute('aria-label', h.getAttribute('data-tip') || '');
      h.addEventListener('pointerdown', (e) => onGradStopDown(e, si));
      gradChrome.appendChild(h);
    });
    // Direction handle, past the 100% end - far enough that its fat touch target
    // clears the last stop's. Appended FIRST so the stops paint (and hit-test) above
    // it: at 18px the two overlapped, and dragging the 100% stop silently rotated the
    // gradient instead of moving the stop.
    const dirLen = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const dir = document.createElement('div');
    dir.className = 'fc-grad-dir';
    dir.style.left = `${b.x + ((b.x - a.x) / dirLen) * 30}px`;
    dir.style.top = `${b.y + ((b.y - a.y) / dirLen) * 30}px`;
    dir.setAttribute('data-tip', t('Drag to set the gradient direction (hold Shift to snap)'));
    dir.setAttribute('aria-label', dir.getAttribute('data-tip') || '');
    dir.addEventListener('pointerdown', onGradDirDown);
    gradChrome.insertBefore(dir, gradChrome.firstChild);
  }

  // Native (box-local) coords for a pointer event, in the edited box's own frame.
  function gradLocal(
    e: PointerEvent,
    boxes: Box[],
    i: number
  ): { x: number; y: number; w: number; h: number } {
    const r = boxRect(boxes[i]!, cfg);
    const off = frameOffsetOfEl(liveBoxEl(gradEdit!) ?? canvasEl);
    const n = clientToNative(e.clientX, e.clientY);
    // The exact inverse of paintGradChrome's mapping, rotation included.
    const l = frameToLocal(r as PenFrame, n.x - off.x, n.y - off.y);
    return { x: l.x, y: l.y, w: r.w, h: r.h };
  }

  function onGradStopDown(e: PointerEvent, si: number): void {
    e.stopPropagation();
    e.preventDefault();
    const boxes = getBoxes();
    const i = gradIndex(boxes);
    const spec0 = i >= 0 ? gradSpecOf(boxes[i]) : null;
    if (!spec0) return;
    gradStopIdx = si;
    ctxSelKey = ''; // the Fill field now shows THIS stop
    let spec = spec0;
    let moved = false;
    const move = (ev: PointerEvent) => {
      const l = gradLocal(ev, boxes, i);
      const pos = Math.round(gradientPosAt(l.w, l.h, spec.angle, l.x, l.y));
      const stops = [...spec.stops];
      stops[si] = { ...stops[si]!, pos };
      spec = { ...spec, stops };
      moved = true;
      writeGradSpec(spec, true); // live: mutate the box's own background only
      scheduleSync();
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      (ev.target as Element)?.releasePointerCapture?.(ev.pointerId);
      // A tap with no movement just selects the stop; a drag commits one undo step.
      if (moved) writeGradSpec(spec, false);
      else scheduleSync();
    };
    (e.target as Element).setPointerCapture?.(e.pointerId);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    scheduleSync();
  }

  function onGradDirDown(e: PointerEvent): void {
    e.stopPropagation();
    e.preventDefault();
    const boxes = getBoxes();
    const i = gradIndex(boxes);
    const spec0 = i >= 0 ? gradSpecOf(boxes[i]) : null;
    if (!spec0) return;
    let spec = spec0;
    const move = (ev: PointerEvent) => {
      const l = gradLocal(ev, boxes, i);
      spec = { ...spec, angle: gradientAngleAt(l.w, l.h, l.x, l.y, ev.shiftKey ? 15 : 0) };
      writeGradSpec(spec, true);
      scheduleSync();
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      (ev.target as Element)?.releasePointerCapture?.(ev.pointerId);
      writeGradSpec(spec, false);
    };
    (e.target as Element).setPointerCapture?.(e.pointerId);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  /**
   * Gradient panel: kind, interpolation space, hue route, add/remove a stop, clear.
   *
   * The interpolation control is the reason this panel exists at all. Every other
   * gradient tool bakes sRGB and leaves you to fight the grey middle; here the space
   * is the user's choice, defaulting to OKLab. The options are named for what they
   * give you - Smooth / Vivid - with sRGB named plainly rather than editorialised: it
   * is the classic behaviour, and someone matching an existing asset wants it without
   * being told off for asking.
   *
   * Those names now come from `lib/blend-style.ts`, because Colour Lab's blend ramp
   * offers the same choice and the vocabulary is only worth having if it is the same
   * one in both places.
   */
  function openGradPanel(anchor: HTMLElement): void {
    closeMorePanel();
    const boxes = getBoxes();
    const i = gradIndex(boxes);
    const spec = i >= 0 ? gradSpecOf(boxes[i]) : null;
    if (!spec) return;
    const polar = isPolarSpace(spec.space);
    // NOT the shared `segRow` (which leads with a glyph): a gradient row is named in
    // words, so this one is its own builder and keeps its own name rather than shadowing
    // the import with a different signature.
    const gradSegRow = (lbl: string, seg: string): string =>
      `<div class="fc-row"><span class="fc-row-lbl"><span>${escape(lbl)}</span></span>${seg}</div>`;
    const p = document.createElement('div');
    p.className = 'fc-panel fc-grad-panel';
    p.innerHTML =
      gradSegRow(
        t('Gradient'),
        segHtml('gradkind', spec.kind, [
          ['linear', t('Linear')],
          ['radial', t('Radial')],
          ['conic', t('Conic')],
        ])
      ) +
      gradSegRow(
        t('Blend'),
        segHtml(
          'gradspace',
          spec.space,
          BLEND_STYLES.map((b) => [b.space, t(b.label)] as [string, string])
        )
      ) +
      (polar
        ? gradSegRow(
            t('Hue route'),
            segHtml(
              'gradhue',
              spec.hue || 'shorter',
              HUE_ROUTES.map((r) => [r.dir, t(r.label)] as [string, string])
            )
          )
        : '') +
      `<div class="fc-row fc-grad-row-btns">` +
      `<button type="button" class="fc-pop-item" data-gp="add">${t('Add stop')}</button>` +
      `<button type="button" class="fc-pop-item" data-gp="del"${spec.stops.length <= 2 ? ' disabled' : ''}>${t('Remove stop')}</button>` +
      `<button type="button" class="fc-pop-item fc-danger" data-gp="clear">${t('No gradient')}</button>` +
      `</div>`;
    p.addEventListener('pointerdown', (e) => e.stopPropagation());
    wireSegs(p, (field, v) => {
      const cur = gradSpecOf(getBoxes()[gradIndex(getBoxes())]);
      if (!cur || !v) return;
      if (field === 'gradkind') writeGradSpec({ ...cur, kind: v as GradientSpec['kind'] }, false);
      else if (field === 'gradspace')
        writeGradSpec({ ...cur, space: v as GradientSpec['space'] }, false);
      else if (field === 'gradhue') writeGradSpec({ ...cur, hue: v as GradientSpec['hue'] }, false);
      // Reopen so a space change can show/hide the hue row against the new state -
      // through the pending flag, for the same reason the first open goes that way.
      if (field === 'gradspace') {
        gradPanelPending = true;
        scheduleSync();
      }
    });
    p.querySelectorAll<HTMLElement>('[data-gp]').forEach((btn) =>
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const cur = gradSpecOf(getBoxes()[gradIndex(getBoxes())]);
        if (!cur) return;
        if (btn.dataset.gp === 'add') {
          // Halfway between the selected stop and the NEXT one. On the last stop there is
          // no next, so go halfway back to the previous instead - the seeded gradient
          // selects a stop at 100%, where "halfway to itself" is 100% and the button did
          // nothing at all.
          const at = Math.min(gradStopIdx, cur.stops.length - 1);
          const here = cur.stops[at]!.pos;
          const neighbour =
            at + 1 < cur.stops.length
              ? cur.stops[at + 1]!.pos
              : cur.stops[Math.max(0, at - 1)]!.pos;
          const mid = (here + neighbour) / 2;
          // Degenerate only if the neighbour sits exactly on top (a hard-edge pair):
          // then nudge into whatever room the gradient has.
          const pos =
            Math.abs(mid - here) < 0.5
              ? here >= 50
                ? Math.max(0, here - 10)
                : Math.min(100, here + 10)
              : mid;
          writeGradSpec(insertGradStop(cur, pos), false);
        } else if (btn.dataset.gp === 'del') {
          deleteGradStop();
        } else {
          setField(cfg.gradField, '');
          exitGradEdit();
          closeMorePanel();
          return;
        }
        ctxSelKey = '';
        gradPanelPending = true;
        scheduleSync();
      })
    );
    stageEl.appendChild(p);
    morePanel = p;
    const ar = anchor.getBoundingClientRect();
    const sr = stageEl.getBoundingClientRect();
    p.style.left = Math.min(ar.left - sr.left, sr.width - p.offsetWidth - 8) + 'px';
    p.style.top = ar.bottom - sr.top + 8 + 'px';
  }

  // ── "More" panel: shape / radius / opacity / image fit / blend ────────────────
  let morePanel: HTMLElement | null = null;
  function closeMorePanel() {
    morePanel?.remove();
    morePanel = null;
  }
  /**
   * Close the innermost floating surface, and report whether there WAS one. This is rung 1
   * of the Escape ladder (see `onKey`), and the honesty of the return value is the whole
   * point: returning true when nothing closed is how Escape used to go missing.
   *
   * Three surfaces, innermost first. The colour popover is a child of its own field and
   * closes itself when focus is inside it - but by the time the user reaches for Escape,
   * focus is usually back on the canvas, so it needs a rung here too. Its teardown is not
   * re-implemented: a non-bubbling Escape on the field lets color-field own its internals.
   * It has to be non-bubbling - a bubbling one would arrive straight back here.
   */
  function dismissFloating(): boolean {
    const colour = stageEl.querySelector<HTMLElement>('.color-popover:not([hidden])');
    if (colour) {
      const field = colour.closest<HTMLElement>('[data-color-field]');
      if (field) {
        field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: false }));
        return true;
      }
    }
    // A reference to a detached element is not an open panel. Drop it rather than
    // "closing" it, or it eats this press and every one after.
    if (popover && !popover.isConnected) popover = null;
    if (morePanel && !morePanel.isConnected) morePanel = null;
    if (!popover && !morePanel) return false;
    // Both together, as they always have been: closing a panel must NOT also drop the
    // selection it was about to act on (the one-number prompt for Offset / Outline stroke
    // is there to act on that selection), which is why this rung returns before the rest.
    closePopover();
    closeMorePanel();
    return true;
  }

  // ── canvas (document) size ────────────────────────────────────────────────────
  const SIZE_UNITS = ['px', 'mm', 'cm', 'in', 'pt'];
  // This is document state, not a temporary menu preference: the same saved Design
  // document must reopen with the unit its author used. Geometry remains CSS px, so
  // legacy boxes and the renderer retain their exact values.
  const readDocumentUnit = (): string => {
    const v = runtime.getModel().find((i) => i.id === 'documentUnit')?.value;
    return typeof v === 'string' && SIZE_UNITS.includes(v) ? v : 'px';
  };
  const readDocumentDpi = (): number => {
    const n = Number(runtime.getModel().find((i) => i.id === 'documentDpi')?.value);
    return Number.isFinite(n) && n >= 36 && n <= 2400 ? Math.round(n) : 300;
  };
  let sizeUnit = readDocumentUnit();
  const syncDocumentSettings = (width?: number, height?: number): void => {
    setDocumentSettings?.({ unit: sizeUnit, dpi: readDocumentDpi(), width, height });
  };
  const setDocumentUnit = (unit: string): void => {
    if (!SIZE_UNITS.includes(unit)) return;
    sizeUnit = unit;
    onDirty?.('documentUnit');
    void runtime.setInput('documentUnit', unit);
    syncDocumentSettings();
  };
  // The export panel is a peer of the size menu. Its unit picker updates the
  // persisted document input itself, then tells this long-lived editor instance
  // to use the same unit the next time its panel opens.
  canvasEl.addEventListener('fc-document-unit', ((e: Event) => {
    const unit = (e as CustomEvent<unknown>).detail;
    if (typeof unit === 'string' && SIZE_UNITS.includes(unit)) {
      sizeUnit = unit;
      // The size panel/export sheet may have originated this event, but the Inspector
      // can too. Re-publish the complete document setting so all three surfaces converge.
      syncDocumentSettings();
    }
  }) as EventListener);
  canvasEl.addEventListener('fc-document-dpi', ((e: Event) => {
    const dpi = Number((e as CustomEvent<unknown>).detail);
    if (Number.isFinite(dpi) && dpi >= 36 && dpi <= 2400) syncDocumentSettings();
  }) as EventListener);
  // px per 1 of a unit (96-DPI CSS convention - matches the artboard mapping).
  const pxPerUnit = (u: string): number => (u === 'px' ? 1 : toCssPx({ value: 1, unit: u as any }));
  const toUnitVal = (n: number, from: string, to: string): number =>
    n > 0 ? Math.round(((n * pxPerUnit(from)) / pxPerUnit(to)) * 100) / 100 : n;
  // The artboard the size UI targets: the selected frame-kind box, else the primary
  // (lowest order, then leftmost) one. −1 when the doc has no artboards.
  function activeFrameIndex(boxes: Box[]): number {
    if (!frameCfg) return -1;
    const fk = frameCfg.frameKind;
    const of = frameCfg.orderField;
    for (const i of selIndices(boxes)) {
      const b = boxes[i];
      if (b && String(b[cfg.kindField]) === fk) return i;
    }
    let best = -1;
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      if (!b || String(b[cfg.kindField]) !== fk) continue;
      if (best < 0) {
        best = i;
        continue;
      }
      const a = boxes[best]!;
      const cmp =
        num(of ? b[of] : 0) - num(of ? a[of] : 0) || num(b[cfg.xField]) - num(a[cfg.xField]);
      if (cmp < 0) best = i;
    }
    return best;
  }

  /**
   * The frame's LIVE on-screen box - the page element (or the frame box as a fallback).
   * Client coords so the stage can frame it without knowing the canvas coordinate space;
   * see `onQueryRect` for why every rect on this seam is client-space.
   *
   * Module-level (it was born inside `openFramesPanel`) because the filmstrip, the
   * navigator column and the top bar's "Fit artboard" must all frame a board the SAME
   * way - one `fc-focus-rect` payload, computed once.
   */
  function frameClientRect(fb: Box | undefined): DOMRect | null {
    const fid = fb?.[cfg.idField] == null ? '' : String(fb![cfg.idField]);
    if (!fid) return null;
    const el =
      canvasEl.querySelector<HTMLElement>(`.lolly-frame-page[data-frame-id="${cssEscape(fid)}"]`) ??
      canvasEl.querySelector<HTMLElement>(`.lolly-box[data-box-id="${cssEscape(fid)}"]`);
    return el ? el.getBoundingClientRect() : null;
  }

  /** The active artboard's id, or '' when the document has no artboards - the same
   *  resolution `emitActiveArtboard` publishes (a selected board, else the board owning
   *  the selection, else the primary one). */
  function activeArtboardId(): string {
    const boxes = getBoxes();
    return hasFrames(boxes) ? activeFrameIdFor(boxes, selection, frameFields()) : '';
  }

  /** Pan/zoom the stage onto one artboard - exactly what a filmstrip cell's click does. */
  function focusArtboard(id: string): void {
    if (!id) return;
    const boxes = getBoxes();
    const r = frameClientRect(boxes.find((b, i) => idOf(b, i) === id));
    if (!r) return;
    stageEl.dispatchEvent(
      new CustomEvent('fc-focus-rect', {
        bubbles: true,
        detail: {
          x: r.left,
          y: r.top,
          w: r.width,
          h: r.height,
        },
      })
    );
  }

  // With artboards in the doc the pasteboard is the world - a canvas-rect clamp
  // would yank a new box away from an artboard outside that rect (plans/141
  // follow-up). Every placement is already intent-anchored (pointer, visible
  // centre, or source + 24), so nothing can be "fully lost"; the clamp applies
  // only to no-frames docs, where the canvas IS the artboard.
  const clampToWorkArea = (box: Box): Box =>
    frameCfg && getBoxes().some((b) => b && String(b[cfg.kindField]) === frameCfg.frameKind)
      ? box
      : clampBoxToCanvas(box, cfg, canvasWH());

  function applyDocSize(w: number, h: number, unit = sizeUnit): void {
    if (!(w > 0) || !(h > 0)) return;
    // Framed docs: the size menu edits the ACTIVE artboard (plans/141 WP-B) - the
    // canvas rect is just the pasteboard there, so presets/custom sizes land on the
    // artboard the user is working with, one undoable commit.
    const boxes = getBoxes();
    const fi = activeFrameIndex(boxes);
    if (fi >= 0) {
      const pxW = toUnitVal(w, unit, 'px');
      const pxH = toUnitVal(h, unit, 'px');
      if (pxW < 1 || pxH < 1) return;
      commit(boxes.map((b, i) => (i === fi ? withRect(b, { w: pxW, h: pxH }, cfg) : b)));
      syncDocumentSettings(w, h);
      scheduleSync();
      return;
    }
    if (!setCanvasSize) return;
    setCanvasSize(w, h, unit);
    scheduleSync();
  }
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
  ];
  // Page-size presets for multi-page (carousel) mode. Every page shares one size.
  const PAGE_PRESETS: Array<[string, number, number]> = [
    ['Portrait 4:5', 1080, 1350],
    ['Square', 1080, 1080],
    ['Story 9:16', 1080, 1920],
    ['Landscape 16:9', 1920, 1080],
    ['A4 portrait', 793.7, 1122.5],
    ['Letter', 816, 1056],
  ];
  const modelVal = (id: string, dflt: number): number => {
    const v = runtime.getModel().find((i) => i.id === id)?.value;
    const n = typeof v === 'number' ? v : parseFloat(v);
    return Number.isFinite(n) ? n : dflt;
  };
  // Pages panel - a page-count stepper (min..max) + shared page-size presets. Each
  // control writes the tool's page inputs via runtime.setInput; the web shell resizes
  // the editing strip in response (see tool.ts pages mode).
  function openPagesMenu(anchor: HTMLElement): void {
    if (!pages) return;
    closeMorePanel();
    const cur = clampN(modelVal(pages.countField, 3), 3, pages.min, pages.max);
    const pw = Math.round(modelVal(pages.widthField, 1080));
    const ph = Math.round(modelVal(pages.heightField, 1350));
    const p = document.createElement('div');
    p.className = 'fc-panel fc-size-panel fc-pages-panel';
    p.innerHTML =
      `<div class="fc-panel-head">${t('Pages')}</div>` +
      '<div class="fc-row fc-pages-step">' +
      `<button type="button" class="fc-step-btn" data-pg="dec" aria-label="${escape(t('Fewer pages'))}"${cur <= pages.min ? ' disabled' : ''}>${icon(SVG.minus)}</button>` +
      `<b class="fc-pages-count" data-pg-count>${cur}</b>` +
      `<button type="button" class="fc-step-btn" data-pg="inc" aria-label="${escape(t('More pages'))}"${cur >= pages.max ? ' disabled' : ''}>${icon(SVG.add)}</button>` +
      '</div>' +
      `<div class="fc-panel-head">${t('Page size')}</div>` +
      '<div class="fc-size-presets">' +
      PAGE_PRESETS.map(
        ([label, w, h]) =>
          `<button type="button" class="fc-size-preset${w === pw && h === ph ? ' is-current' : ''}" data-w="${w}" data-h="${h}"><b>${escape(t(label))}</b><span>${w}×${h}</span></button>`
      ).join('') +
      '</div>';
    p.addEventListener('pointerdown', (e) => e.stopPropagation());
    const setCount = (n: number): void => {
      const clamped = clampN(n, cur, pages.min, pages.max);
      p.querySelector('[data-pg-count]')!.textContent = String(clamped);
      p.querySelector<HTMLButtonElement>('[data-pg="dec"]')!.disabled = clamped <= pages.min;
      p.querySelector<HTMLButtonElement>('[data-pg="inc"]')!.disabled = clamped >= pages.max;
      onDirty?.(pages.countField);
      runtime.setInput(pages.countField, clamped);
    };
    p.querySelector('[data-pg="dec"]')!.addEventListener('click', () =>
      setCount(clampN(modelVal(pages.countField, cur), cur, pages.min, pages.max) - 1)
    );
    p.querySelector('[data-pg="inc"]')!.addEventListener('click', () =>
      setCount(clampN(modelVal(pages.countField, cur), cur, pages.min, pages.max) + 1)
    );
    p.querySelectorAll<HTMLButtonElement>('.fc-size-preset').forEach((b) =>
      b.addEventListener('click', () => {
        p.querySelectorAll('.fc-size-preset').forEach((x) =>
          x.classList.toggle('is-current', x === b)
        );
        onDirty?.(pages.widthField);
        runtime.setInput(pages.widthField, +b.dataset.w!);
        runtime.setInput(pages.heightField, +b.dataset.h!);
      })
    );
    stageEl.appendChild(p);
    morePanel = p;
    positionPanelBelow(p, anchor);
  }
  function openSizeMenu(anchor: HTMLElement): void {
    closeMorePanel();
    // Framed docs: the panel reads/edits the ACTIVE artboard (plans/141 WP-B).
    const boxes0 = getBoxes();
    const fi = activeFrameIndex(boxes0);
    const d =
      fi >= 0 ? { w: num(boxes0[fi]![cfg.wField]), h: num(boxes0[fi]![cfg.hField]) } : canvasWH(); // always px
    const dpi = readDocumentDpi();
    // Show the current px size expressed in the remembered unit.
    const dispW = toUnitVal(d.w, 'px', sizeUnit),
      dispH = toUnitVal(d.h, 'px', sizeUnit);
    const p = document.createElement('div');
    p.className = 'fc-panel fc-size-panel';
    p.innerHTML =
      `<div class="fc-panel-head">${fi >= 0 ? t('Artboard size') : t('Canvas size')}</div>` +
      '<div class="fc-size-presets">' +
      SIZE_PRESETS.map(
        ([label, w, h]) =>
          `<button type="button" class="fc-size-preset${sizeUnit === 'px' && w === d.w && h === d.h ? ' is-current' : ''}" data-w="${w}" data-h="${h}"><b>${escape(t(label))}</b><span>${w}×${h}</span></button>`
      ).join('') +
      '</div>' +
      `<label class="fc-row"><span>${t('Units')}</span><select class="field-select field-select--sm" data-sz="unit">${SIZE_UNITS.map((u) => `<option value="${u}"${u === sizeUnit ? ' selected' : ''}>${u}</option>`).join('')}</select></label>` +
      `<label class="fc-row"><span>${t('Width')}</span><input type="number" min="1" max="30000" step="any" data-sz="w" value="${dispW}"><b data-sz-unit>${sizeUnit}</b></label>` +
      `<label class="fc-row"><span>${t('Height')}</span><input type="number" min="1" max="30000" step="any" data-sz="h" value="${dispH}"><b data-sz-unit>${sizeUnit}</b></label>` +
      `<label class="fc-row"><span>${t('DPI')}</span><input type="number" min="36" max="2400" step="1" data-sz="dpi" value="${dpi}"><b>${t('dpi')}</b></label>`;
    p.addEventListener('pointerdown', (e) => e.stopPropagation());
    const wIn = () => p.querySelector<HTMLInputElement>('[data-sz="w"]')!;
    const hIn = () => p.querySelector<HTMLInputElement>('[data-sz="h"]')!;
    p.querySelectorAll<HTMLButtonElement>('.fc-size-preset').forEach((b) =>
      b.addEventListener('click', () => {
        // Paper presets carry their truthful physical unit; screen presets remain px.
        const paper = b.textContent?.includes('A4')
          ? 'mm'
          : b.textContent?.includes('Letter')
            ? 'in'
            : 'px';
        const pw = +b.dataset.w!,
          ph = +b.dataset.h!;
        setDocumentUnit(paper);
        p.querySelector<HTMLSelectElement>('[data-sz="unit"]')!.value = paper;
        p.querySelectorAll<HTMLElement>('[data-sz-unit]').forEach((x) => (x.textContent = paper));
        wIn().value = String(toUnitVal(pw, 'px', paper));
        hIn().value = String(toUnitVal(ph, 'px', paper));
        p.querySelectorAll('.fc-size-preset').forEach((x) =>
          x.classList.toggle('is-current', x === b)
        );
        applyDocSize(+wIn().value, +hIn().value, paper);
      })
    );
    const commitCustom = () => {
      const w = parseFloat(wIn().value),
        h = parseFloat(hIn().value);
      if (w > 0 && h > 0) {
        applyDocSize(w, h, sizeUnit);
        p.querySelectorAll<HTMLButtonElement>('.fc-size-preset').forEach((x) =>
          x.classList.toggle(
            'is-current',
            sizeUnit === 'px' && +x.dataset.w! === Math.round(w) && +x.dataset.h! === Math.round(h)
          )
        );
      }
    };
    p.querySelectorAll<HTMLInputElement>('input[data-sz]').forEach((i) =>
      i.addEventListener('change', commitCustom)
    );
    p.querySelector<HTMLInputElement>('[data-sz="dpi"]')!.addEventListener('change', (e) => {
      const next = Math.round(Number((e.target as HTMLInputElement).value));
      if (!(next >= 36 && next <= 2400)) return;
      onDirty?.('documentDpi');
      void runtime.setInput('documentDpi', next);
      syncDocumentSettings();
    });
    // Unit switch keeps the physical size: convert the shown W/H into the new unit.
    p.querySelector<HTMLSelectElement>('[data-sz="unit"]')!.addEventListener('change', (e) => {
      const to = (e.target as HTMLSelectElement).value;
      wIn().value = String(toUnitVal(parseFloat(wIn().value) || 0, sizeUnit, to));
      hIn().value = String(toUnitVal(parseFloat(hIn().value) || 0, sizeUnit, to));
      setDocumentUnit(to);
      p.querySelectorAll<HTMLElement>('[data-sz-unit]').forEach((x) => (x.textContent = to));
      p.querySelectorAll('.fc-size-preset').forEach((x) => x.classList.remove('is-current'));
    });
    stageEl.appendChild(p);
    morePanel = p;
    const ar = anchor.getBoundingClientRect(),
      sr = stageEl.getBoundingClientRect();
    p.style.left = Math.min(ar.right - sr.left + 8, sr.width - p.offsetWidth - 8) + 'px';
    p.style.top = Math.max(6, Math.min(ar.top - sr.top, sr.height - p.offsetHeight - 8)) + 'px';
  }

  function openMorePanel(anchor: HTMLElement): void {
    closeMorePanel();
    const boxes = getBoxes();
    const idx = selIndices(boxes);
    if (!idx.length) return;
    const b: Box = boxes[idx[0]!] || {};
    // Frame-only "Clip children" toggle - shown only when a SINGLE frame-kind box is
    // selected. Dead for non-frame tools (frameCfg is null there) and for a mixed/multi
    // selection, so no-frames documents and ordinary boxes are byte-identical. The hook
    // defaults an unset clipChildren to ON (boolVal(fb.clipChildren, true)), so reflect
    // that here. Writes through setField → one commit → the render honours overflow.
    // "Lift layers" (plans/104 section 7) - its SECOND home, beside the right-click menu. The
    // More panel is where a box's own properties live, and "this picture is a stack of
    // layers" is one of them; a user who never right-clicks would otherwise never meet
    // the feature. Shown only when this exact selection can be lifted (unlike the menu,
    // which disables to keep its height constant - a panel is rebuilt per open and has
    // no such promise to keep, and a dead row among live controls reads as broken).
    const showLift = liftTargetIndex(boxes) === idx[0]!;
    // "Choreograph" (plans/104 P4) sits beside it on the same terms - and hides, rather
    // than disables, for the same reason: this panel is rebuilt per open, so a row that
    // could do nothing is simply not drawn.
    const showChoreo = canChoreograph() && idx.filter((i) => isPosable(boxes[i])).length >= 2;
    const isFrame =
      !!frameCfg && idx.length === 1 && String(b[cfg.kindField]) === frameCfg.frameKind;
    const showClip = isFrame && !!frameCfg!.clipChildrenField;
    const clipCur = showClip ? boolOf(b[frameCfg!.clipChildrenField!], true) : true;
    const shapeCur = b[cfg.shapeField] || 'rect';
    const fitCur = b[cfg.fitField] || 'contain';
    const posCur = String(b[cfg.imgPosField] || 'center');
    const blendCur = b[cfg.blendField] || 'normal';
    const radiusCur = Math.max(0, Math.round(parseFloat(String(b[cfg.radiusField])) || 0));
    const opacityCur = Math.round(clampN(b[cfg.opacityField], 100, 0, 100));
    // Shadow state - target picks the CSS mechanism; colour/x/y/blur are shared.
    const shadowCur = String(b[cfg.shadowField] || 'none');
    const shColor = String(b[cfg.shadowColorField] || '#00000055');
    const shX = Math.round(clampN(parseFloat(String(b[cfg.shadowXField])), 0, -300, 300));
    const shY = Math.round(clampN(parseFloat(String(b[cfg.shadowYField])), 0, -300, 300));
    const shBlur = Math.round(clampN(parseFloat(String(b[cfg.shadowBlurField])), 10, 0, 300));
    // "Perspective tilt" (plans/104 P2.1) - the box's own pitch and yaw, and the canvas's
    // door onto them; the timeline's pose rows are the other one, for a keyed value.
    // ONE box only: this panel READS boxes[idx[0]] and WRITES the whole selection, so on
    // a mixed selection it would stamp the first box's angle onto every other. And never
    // on a camera - the camera has its own Tilt X/Y in the timeline's Camera group, and
    // two doors onto one channel with different ranges is the failure `holdTilt` names.
    // (`isPosable` also rules out a frame page and an audio clip, which is right for the
    // same reason a showcase will not pose them: neither paints a card to tilt.)
    const tiltRx = cv.rxField || '',
      tiltRy = cv.ryField || '';
    const showTilt = idx.length === 1 && !!(tiltRx || tiltRy) && isPosable(b);
    const rxCur = showTilt
      ? Math.round(clampN(parseFloat(String(b[tiltRx])), 0, FC_TILT[0], FC_TILT[1]))
      : 0;
    const ryCur = showTilt
      ? Math.round(clampN(parseFloat(String(b[tiltRy])), 0, FC_TILT[0], FC_TILT[1]))
      : 0;
    // ── what this selection can actually be asked (plan 179 C6) ────────────────
    // Image fit and Image position style an image the box does not have: on a text box
    // they were two controls that wrote a field nothing read, and they were the first
    // two rows a poster author met. Offered for the kinds that CAN carry an image, and
    // only once one of them has one (or the kind is `image`, whose whole job is to).
    // Shape and Corner radius go the other way: a path box's outline is its own
    // geometry, and rounding the bounding div does nothing to the curve.
    // EVERY selected item, not just the first: the panel reads one box and writes them
    // all, so a path beside a box still has a box to shape.
    const allPathSel = selectionAllPaths(boxes, idx);
    const hasImg =
      !!cfg.imageField &&
      idx.some((i) => {
        const row = boxes[i] || {};
        return kindOf(row) === 'image' || !!row[cfg.imageField];
      });
    const showImgRows = hasImg && selectionNoKinds(boxes, idx, NO_IMAGE_KINDS);
    const showShapeRows = !allPathSel;
    // Shadow targets an ARTBOARD can honour (plan 179 A4's remainder). `frameGroupsFor`
    // takes `shadowCss(fb).box` and nothing else, on purpose: a page has no text run, and
    // the alpha-silhouette targets ('content', 'depth') describe a shape's outline - on a
    // full rectangle they are the box shadow by a slower route, and `depth` reads a `z`
    // a frame never carries. Offering them anyway wrote the model and painted nothing.
    const framesOnly = !!frameCfg && selectionAllKinds(boxes, idx, new Set([frameCfg.frameKind]));
    const shadowOpts = framesOnly
      ? shadowChoices.filter(([v]) => v === 'none' || v === 'box')
      : shadowChoices;
    const p = document.createElement('div');
    p.className = 'fc-panel fc-more-panel';
    p.innerHTML = `
      ${showClip ? `<label class="fc-row fc-row-toggle field-toggle"><span class="fc-row-lbl" data-tip="${escape(t('Clip children'))}">${icon(SVG.clip)}<span>${t('Clip children')}</span></span><input type="checkbox" class="field-check" data-mp-clip${clipCur ? ' checked' : ''}></label>` : ''}
      ${cfg.shapeField && shapeChoices.length && showShapeRows ? segRow(SVG.shRounded, t('Shape'), segHtml(cfg.shapeField, shapeCur, shapeChoices)) : ''}
      ${cfg.radiusField && showShapeRows ? iconRow(SVG.radius, t('Corner radius'), `<input type="range" class="field-range" data-mp="radius" min="0" max="200" value="${radiusCur}"><b data-mp-val="radius">${radiusCur}</b>`) : ''}
      ${cfg.opacityField ? iconRow(SVG.opacity, t('Opacity'), `<input type="range" class="field-range" data-mp="opacity" min="0" max="100" value="${Number.isFinite(opacityCur) ? opacityCur : 100}"><b data-mp-val="opacity">${Number.isFinite(opacityCur) ? opacityCur : 100}</b>`) : ''}
      ${
        cfg.fitField && showImgRows
          ? segRow(
              SVG.fitContain,
              t('Image fit'),
              segHtml(cfg.fitField, fitCur, [
                ['contain', t('Contain'), SVG.fitContain],
                ['cover', t('Cover (crop)'), SVG.fitCover],
                ['fill', t('Stretch'), SVG.fitFill],
              ])
            )
          : ''
      }
      ${cfg.imgPosField && showImgRows ? segRow(SVG.fitPos, t('Image position'), posGridHtml(cfg.imgPosField, posCur)) : ''}
      ${
        cfg.blendField
          ? iconRow(
              SVG.blend,
              t('Blend mode'),
              `<select class="field-select field-select--sm" data-mp="blend">
        ${['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'].map((m) => opt(m, t(m[0]!.toUpperCase() + m.slice(1).replace('-', ' ')), blendCur)).join('')}
      </select>`
            )
          : ''
      }
      ${
        cfg.shadowField
          ? `<div class="fc-panel-sub">${t('Shadow')}</div>
        ${segRow(SVG.shadowIc, t('Apply to'), segHtml(cfg.shadowField, shadowCur, shadowOpts))}
        <label class="fc-row"><span class="fc-row-lbl">${t('Colour')}</span><span class="fc-cfield">${colorFieldHtml('fc-shadow', shColor, { float: true })}</span></label>
        <label class="fc-row"><span class="fc-row-lbl">${t('X')}</span><input type="range" class="field-range" data-mp="shx" min="-300" max="300" value="${shX}"><b data-mp-val="shx">${shX}</b></label>
        <label class="fc-row"><span class="fc-row-lbl">${t('Y')}</span><input type="range" class="field-range" data-mp="shy" min="-300" max="300" value="${shY}"><b data-mp-val="shy">${shY}</b></label>
        <label class="fc-row"><span class="fc-row-lbl">${t('Blur')}</span><input type="range" class="field-range" data-mp="shblur" min="0" max="300" value="${shBlur}"><b data-mp-val="shblur">${shBlur}</b></label>`
          : ''
      }
      ${
        showTilt
          ? `<div class="fc-panel-sub">${t('Perspective tilt')}</div>
        ${tiltRx ? tiltRow('rx', t('Tilt X'), rxCur) : ''}
        ${tiltRy ? tiltRow('ry', t('Tilt Y'), ryCur) : ''}`
          : ''
      }
      ${showLift ? `<div class="fc-row"><button type="button" class="fc-cbtn fc-mp-lift" data-mp-lift>${icon(SVG.liftLayers)}<span>${escape(t('Lift layers'))}</span></button></div>` : ''}
      ${showChoreo ? `<div class="fc-row"><button type="button" class="fc-cbtn fc-mp-choreo" data-mp-choreo>${icon(SVG.choreo)}<span>${escape(t('Choreograph…'))}</span></button></div>` : ''}`;
    p.addEventListener('pointerdown', (e) => e.stopPropagation());
    // Shape is special-cased: switching to "circle" also squares the box (w = h),
    // since a circle is only an ellipse the geometry keeps 1:1. Everything else writes
    // its field straight through.
    wireSegs(p, (field, v) => {
      if (field === cfg.shapeField) setShape(v);
      else setField(field, v);
    });
    // `rx`/`ry` come off the CANVAS block, not the resolved FieldCfg - the tilt fields
    // live beside `zField` for the reason stated there. A falsy name makes `setField`
    // return, which is the same progressive-capability gate every other row uses.
    const MP_FIELD: Record<string, string> = {
      radius: cfg.radiusField,
      opacity: cfg.opacityField,
      shx: cfg.shadowXField,
      shy: cfg.shadowYField,
      shblur: cfg.shadowBlurField,
      rx: tiltRx,
      ry: tiltRy,
    };
    p.querySelectorAll<HTMLSelectElement>('select[data-mp]').forEach((sel) =>
      sel.addEventListener('change', () => setField(cfg.blendField, sel.value))
    );
    p.querySelectorAll<HTMLInputElement>('input[data-mp]').forEach((rng) =>
      rng.addEventListener('input', () => {
        const valEl = p.querySelector<HTMLElement>(`[data-mp-val="${rng.dataset.mp}"]`);
        if (valEl) valEl.textContent = rng.value;
        setField(MP_FIELD[rng.dataset.mp!], Number(rng.value));
      })
    );
    if (cfg.shadowColorField)
      wireColorField(p, {
        onChange: (id, val) => {
          if (id === 'fc-shadow') setField(cfg.shadowColorField, unwrapColor(val));
        },
      });
    if (showClip)
      p.querySelector<HTMLInputElement>('input[data-mp-clip]')?.addEventListener('change', (e) =>
        setField(frameCfg!.clipChildrenField, (e.currentTarget as HTMLInputElement).checked)
      );
    // The panel is anchored to the More button; the dialog it opens is anchored to
    // `lastMenuAt`, so point that at this button first or the confirm would land
    // wherever the last right-click happened to be.
    p.querySelector<HTMLButtonElement>('[data-mp-lift]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
      lastMenuAt = { x: r.left, y: r.bottom };
      askLiftLayers();
    });
    p.querySelector<HTMLButtonElement>('[data-mp-choreo]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
      lastMenuAt = { x: r.left, y: r.bottom };
      askChoreograph();
    });
    stageEl.appendChild(p);
    morePanel = p;
    const ar = anchor.getBoundingClientRect();
    const sr = stageEl.getBoundingClientRect();
    p.style.left = Math.min(ar.left - sr.left, sr.width - p.offsetWidth - 8) + 'px';
    const top = ar.bottom - sr.top + 8;
    p.style.top = top + 'px';
    // Clamp to the stage and let the panel scroll (plan 179 C6). It hangs from the object
    // bar, which is pinned to the TOP chrome row, so on a short viewport its last section -
    // Perspective tilt - ran off the bottom of the screen with no way to reach it. A
    // max-height plus the sheet's own `overflow-y: auto` is the whole fix; the rows keep
    // their sizes, and a panel that fits is byte-identical (the cap is simply never hit).
    p.style.maxHeight = Math.max(160, sr.height - top - 12) + 'px';
  }

  /**
   * ── Explicit page order for a new artboard (plans/179 A9) ─────────────────────
   *
   * Until now nothing on the canvas ever wrote `order`, so "which slide is this" was
   * decided by x position alone: a scratch board drawn to the LEFT of a deck became
   * slide 1, and the presenter opened on it. Every path that CREATES a frame now stamps
   * the next slot - one past the highest order in the document - and a legacy document
   * (frames, no order anywhere) has its existing order seeded from x in the SAME commit,
   * so the sequence the user was looking at is the sequence that gets written down.
   *
   * Returns both halves because the seeding rewrites rows in `boxes`; the caller must
   * commit the returned array, not the one it started with. Inert (same objects back) for
   * a non-frame box, and for any tool whose canvas declares no `orderField`.
   */
  function withNewFrameOrder(boxes: Box[], box: Box): { boxes: Box[]; box: Box } {
    if (!frameCfg?.orderField) return { boxes, box };
    if (String(box[cfg.kindField]) !== frameCfg.frameKind) return { boxes, box };
    const ff = frameFields();
    const seeded = seedFrameOrders(boxes, ff);
    return { boxes: seeded, box: { ...box, [ff.orderField]: nextFrameOrder(seeded, ff) } };
  }

  /**
   * ── Instant artboard (plan 112, inclusive-design) ─────────────────────────────
   *
   * Lay down a new artboard at the current EXPORT / page size in one action - no drag.
   * Dragging to size is optional labour; an artboard can be resized once it exists, so a
   * click is enough. The new page is placed clear of everything already on the canvas
   * (to the RIGHT of the content's right edge, or at the origin on a blank doc) so it never
   * overlaps or silently adopts loose boxes, then framed in the viewport. Dead unless the
   * canvas declares the frame primitive (frameCfg). Used by the Artboards navigator's
   * empty-state button and the Artboard tool's tap (a tap with no drag).
   */
  function addArtboard(): void {
    if (!frameCfg) return;
    const fk = frameCfg.frameKind;
    const frameAddKind = addKinds.find(
      (k) => k.id === 'frame' || (k.seed != null && String(k.seed[cfg.kindField]) === fk)
    );
    if (!frameAddKind) return;
    const boxes = getBoxes();
    const d = canvasWH(); // current export / page size
    const gap = Math.round(d.w * 0.08);
    // The FIRST artboard sits at the origin - it coincides with the export frame (so it isn't
    // dimmed by the pasteboard scrim) and wraps any loose content that's already there. Later
    // artboards line up to the RIGHT of the furthest existing frame.
    const frames = boxes.filter((b) => b != null && String(b[cfg.kindField]) === fk);
    const x = frames.length
      ? frames.reduce((m, b) => Math.max(m, num(b[cfg.xField]) + num(b[cfg.wField])), 0) + gap
      : 0;
    const id = freshId(boxes);
    const made = withNewFrameOrder(
      boxes,
      seedBox(cfg, {}, frameAddKind.seed || {}, { x, y: 0, w: d.w, h: d.h } as MathRect, id)
    );
    selection = new Set([id]);
    commit(assignFrames([...made.boxes, made.box], new Set([made.boxes.length]))); // frame keeps frame='' (no self-nesting)
    renderChrome();
    // Bring it into view (the doc may be panned); defer so the frame page has rendered.
    requestAnimationFrame(() => {
      const el =
        canvasEl.querySelector<HTMLElement>(
          `.lolly-frame-page[data-frame-id="${cssEscape(id)}"]`
        ) ?? canvasEl.querySelector<HTMLElement>(`.lolly-box[data-box-id="${cssEscape(id)}"]`);
      if (!el) return;
      const r = el.getBoundingClientRect();
      stageEl.dispatchEvent(
        new CustomEvent('fc-focus-rect', {
          bubbles: true,
          detail: { x: r.left, y: r.top, w: r.width, h: r.height },
        })
      );
    });
  }

  /**
   * A new artboard drawn around loose boxes (plans/184 R15): the union of their rects,
   * seeded like any added frame, appended to the page order, and the boxes re-parented
   * into it - `assignFrames` resolves each touched box by geometry, and the new frame
   * now contains them. One commit. A timeline document with no artboards gets its first
   * one this way from the navigator, without drawing one by hand around the work.
   */
  function makeArtboardAround(ids: readonly string[]): void {
    if (!frameCfg || !ids.length) return;
    const fk = frameCfg.frameKind;
    const frameAddKind = addKinds.find(
      (k) => k.id === 'frame' || (k.seed != null && String(k.seed[cfg.kindField]) === fk)
    );
    if (!frameAddKind) return;
    const boxes = getBoxes();
    const want = new Set(ids.map(String));
    const picked: number[] = [];
    boxes.forEach((b, i) => {
      if (b && want.has(String(b[cfg.idField] ?? '')) && String(b[cfg.kindField]) !== fk)
        picked.push(i);
    });
    if (!picked.length) return;
    let x0 = Infinity,
      y0 = Infinity,
      x1 = -Infinity,
      y1 = -Infinity;
    for (const i of picked) {
      const b = boxes[i]!;
      const x = num(b[cfg.xField]),
        y = num(b[cfg.yField]);
      const w = Math.max(1, num(b[cfg.wField])),
        h = Math.max(1, num(b[cfg.hField]));
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x + w);
      y1 = Math.max(y1, y + h);
    }
    const rect = {
      x: Math.round(x0),
      y: Math.round(y0),
      w: Math.max(1, Math.round(x1 - x0)),
      h: Math.max(1, Math.round(y1 - y0)),
    } as MathRect;
    const id = freshId(boxes);
    const made = withNewFrameOrder(boxes, seedBox(cfg, {}, frameAddKind.seed || {}, rect, id));
    selection = new Set([id]);
    commit(assignFrames([...made.boxes, made.box], new Set([...picked, made.boxes.length])));
    renderChrome();
  }

  /**
   * ── Fit targets: what the stage is allowed to zoom to (plan 179 C5) ───────────
   *
   * The RETURN LEG of the `fc-focus-rect` seam. That event is the overlay asking the
   * stage to frame something; this one is the stage asking the overlay what is worth
   * framing. Same shape, same one-way-per-direction rule: the overlay still never sees
   * the StageNav, and tool.ts still owns it. Answered inline - `dispatchEvent` runs its
   * listeners synchronously, so the asker reads `detail.rect` the moment it returns.
   *
   *   · `content`   - the union of every artboard PAGE, so Fit frames the WORK instead of
   *                   the 1920×1080 export box. A 3-slide deck used to open on slide 1
   *                   with 2 and 3 off the right edge and nothing saying they existed.
   *                   Null when this canvas has no frame primitive or no artboards, which
   *                   is exactly what keeps Fit unchanged in every other document.
   *   · `selection` - the current selection's AABB, for Zoom to selection (Shift+2).
   *
   * CLIENT coords, deliberately, for the reason focusRect documents: a frames tool's
   * canvas overflows its nominal width with pasteboard artboards, so any native→screen
   * scale derived from nativeW is wrong by the pasteboard ratio. A live rect is not. It
   * also makes a rotated box's AABB free - a client rect already IS one.
   *
   * The listener is not unregistered: `disposed` makes it inert, and stageEl is rebuilt
   * with the view that owns it (same reasoning as the `tl-*` handlers, which only need
   * explicit removal because the timeline can be closed and reopened within one mount).
   */
  /**
   * The computation behind BOTH doors onto a fit target: the `fc-query-rect` event below
   * (tool.ts's StageNav) and `handle.design`'s `contentRect()`/`selectionRect()`. One
   * function, so the top bar's Fit buttons and the stage's own keys can never frame two
   * different rectangles.
   */
  function queryRect(what: 'content' | 'selection' | 'active'): CanvasRect | null {
    const els: HTMLElement[] = [];
    if (what === 'content') {
      if (!frameCfg) return null;
      for (const el of canvasEl.querySelectorAll<HTMLElement>('.lolly-frame-page[data-frame-id]'))
        els.push(el);
    } else if (what === 'active') {
      const id = activeArtboardId();
      if (!id) return null;
      const el = canvasEl.querySelector<HTMLElement>(
        `.lolly-frame-page[data-frame-id="${cssEscape(id)}"]`
      );
      if (el) els.push(el);
    } else {
      for (const id of selection) {
        const el =
          canvasEl.querySelector<HTMLElement>(
            `.lolly-frame-page[data-frame-id="${cssEscape(id)}"]`
          ) ?? canvasEl.querySelector<HTMLElement>(`.lolly-box[data-box-id="${cssEscape(id)}"]`);
        if (el) els.push(el);
      }
    }
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (!(r.width > 0) || !(r.height > 0)) continue;
      minX = Math.min(minX, r.left);
      minY = Math.min(minY, r.top);
      maxX = Math.max(maxX, r.right);
      maxY = Math.max(maxY, r.bottom);
    }
    if (!(maxX > minX) || !(maxY > minY)) return null; // nothing measurable
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }
  function onQueryRect(e: Event): void {
    if (disposed) return;
    const d = (e as CustomEvent).detail as { what?: unknown; rect?: unknown } | null;
    if (!d || typeof d !== 'object') return;
    if (d.what !== 'content' && d.what !== 'selection' && d.what !== 'active') return;
    const rect = queryRect(d.what);
    if (rect) (d as { rect: unknown }).rect = rect;
  }
  stageEl.addEventListener('fc-query-rect', onQueryRect);

  /**
   * ── Artboards navigator (plan 112) ────────────────────────────────────────────
   *
   * A bottom-docked filmstrip of the document's frame-kind boxes in page order, each a
   * LIVE scaled thumbnail (a clipped clone of the canvas over that frame's rect - the same
   * trick present-mode's slide previews use, but over the editor canvas). Clicking a
   * thumbnail - or the ‹ › steppers - frames that artboard in the viewport by dispatching
   * `fc-focus-rect`; tool.ts holds the StageNav and answers it (`stageZoom.focusRect`).
   *
   * NO reorder (plan 112 M5, "the artboards do not reorder at all"): the sequence IS the
   * canvas layout the hook reads (order asc, x asc), which the user changes by moving frames
   * on the canvas - a list-drag that only wrote `order` fought that and confused people.
   *
   * Docks ABOVE the sequence timeline when it is open: a rAF loop keeps its `bottom`
   * tracking the timeline's height (write-guarded, so it only touches the DOM when the height
   * actually changes), so opening/closing/resizing the timeline never overlaps the strip.
   * Gated on frameCfg?.orderField (no orderField → no frames → no rail button). Reuses the
   * `morePanel` slot so the shared outside-click / rebuild dismissal takes it down.
   */
  function openFramesPanel(_anchor: HTMLElement): void {
    closeMorePanel();
    if (!frameCfg?.orderField) return;
    const of = frameCfg.orderField;
    const fk = frameCfg.frameKind;
    const xF = cfg.xField;
    const THUMB_MAX_W = 132,
      THUMB_MAX_H = 90; // letterbox any aspect (landscape slide → portrait poster)
    const p = document.createElement('div');
    p.className = 'fc-panel fc-frames-panel';
    let active = 0;

    // Frames in the SAME page order the hook uses: order asc, x asc tie-break.
    const framesInOrder = (): Box[] =>
      getBoxes()
        .filter((b) => String(b?.[cfg.kindField]) === fk)
        .sort((a, b) => num(a?.[of]) - num(b?.[of]) || num(a?.[xF]) - num(b?.[xF]));

    // The thumbnail is `frameThumb` from ./free-canvas-fields.ts now - the SAME clone the
    // navigator column's rows use, so the strip and the column can never drift on how a
    // page is scaled, frozen or made pointer-inert. This is only its strip-sized binding.
    const makeThumb = (fb: Box): HTMLElement =>
      frameThumb(canvasEl, fb, cfg, { maxW: THUMB_MAX_W, maxH: THUMB_MAX_H });

    function goTo(i: number, frames: Box[]): void {
      active = Math.max(0, Math.min(i, frames.length - 1));
      const fb = frames[active];
      const r = fb ? frameClientRect(fb) : null;
      if (r)
        stageEl.dispatchEvent(
          new CustomEvent('fc-focus-rect', {
            bubbles: true,
            detail: {
              x: r.left,
              y: r.top,
              w: r.width,
              h: r.height,
            },
          })
        );
      p.querySelectorAll('.fc-frame-cell').forEach((c, idx) =>
        c.classList.toggle('is-active', idx === active)
      );
      p.querySelector<HTMLElement>(`.fc-frame-cell[data-fi="${active}"]`)?.scrollIntoView({
        block: 'nearest',
        inline: 'nearest',
      });
    }

    // The Artboard add-kind (label "Artboard", kind === frameKind) - the same tool the
    // Add menu arms. Present on every frame-capable canvas; the empty state offers it
    // directly so "draw one with the Artboard tool" is a button, not a scavenger hunt.
    const frameAddKind = addKinds.find(
      (k) => k.id === 'frame' || (k.seed != null && String(k.seed[cfg.kindField]) === fk)
    );

    function render(): void {
      const frames = framesInOrder();
      if (!frames.length) {
        p.innerHTML =
          `<div class="fc-frames-empty">` +
          `<span class="fc-frames-empty-msg">${escape(t('No artboards yet.'))}</span>` +
          (frameAddKind
            ? `<button type="button" class="fc-frames-empty-add" data-add-frame>${icon(SVG.frame)}<span>${escape(t('Draw an artboard'))}</span></button>`
            : `<span>${escape(t('Draw one with the Artboard tool.'))}</span>`) +
          `</div>`;
        // One click lays down a full page-size artboard (no drag) and closes the panel -
        // dragging to size is optional labour, and the artboard is resizable once it exists.
        p.querySelector<HTMLButtonElement>('[data-add-frame]')?.addEventListener('click', () => {
          closeMorePanel();
          addArtboard();
        });
        return;
      }
      active = Math.max(0, Math.min(active, frames.length - 1));
      p.innerHTML =
        `<div class="fc-frames-head">` +
        `<span class="fc-frames-title">${escape(t('Artboards'))}</span>` +
        `<button type="button" class="fc-cbtn fc-frames-step" data-fstep="-1" data-tip="${escape(t('Previous artboard'))}" aria-label="${escape(t('Previous artboard'))}">${icon(SVG.chevLeft)}</button>` +
        `<button type="button" class="fc-cbtn fc-frames-step" data-fstep="1" data-tip="${escape(t('Next artboard'))}" aria-label="${escape(t('Next artboard'))}">${icon(SVG.chevRight)}</button>` +
        `</div>` +
        `<div class="fc-frames-strip">` +
        frames
          .map(
            (_b, i) =>
              `<button type="button" class="fc-frame-cell${i === active ? ' is-active' : ''}" data-fi="${i}" data-tip="${escape(t('Focus artboard'))}"><span class="fc-frame-cell-slot"></span><span class="fc-frame-cell-n">${i + 1}</span></button>`
          )
          .join('') +
        `</div>`;
      const cells = p.querySelectorAll<HTMLElement>('.fc-frame-cell');
      cells.forEach((cell, i) =>
        cell.querySelector('.fc-frame-cell-slot')?.replaceChildren(makeThumb(frames[i]!))
      );
      cells.forEach((cell) =>
        cell.addEventListener('click', () => goTo(num(cell.dataset.fi), frames))
      );
      p.querySelectorAll<HTMLButtonElement>('[data-fstep]').forEach((btn) =>
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          goTo(active + (btn.dataset.fstep === '1' ? 1 : -1), frames);
        })
      );
    }

    p.addEventListener('pointerdown', (e) => e.stopPropagation());
    render();
    stageEl.appendChild(p);
    morePanel = p;

    // Keep the strip docked above the timeline for as long as it lives (the timeline can
    // open/close/resize independently). Cheap: one rect read per frame, and it only writes
    // `bottom` when the value actually changes.
    let lastBottom = -1;
    const reposition = (): void => {
      if (morePanel !== p) return; // closed → let the loop die
      const tl = stageEl.querySelector<HTMLElement>('.tl-panel');
      const tlOpen = !!tl && getComputedStyle(tl).display !== 'none';
      const bottom = (tlOpen ? tl!.getBoundingClientRect().height : 0) + 12;
      if (bottom !== lastBottom) {
        lastBottom = bottom;
        p.style.bottom = `${bottom}px`;
      }
      requestAnimationFrame(reposition);
    };
    reposition();
  }

  /** Is the Artboards filmstrip the panel currently in the one-slot `morePanel`? */
  const isFramesPanelOpen = (): boolean => !!morePanel?.classList.contains('fc-frames-panel');
  /** Open/close the filmstrip. The anchor is unused by the panel (it docks to the stage
   *  bottom, not to its trigger), so the top bar's toggle needs none. */
  function toggleFramesPanel(anchor?: HTMLElement): void {
    if (isFramesPanelOpen()) closeMorePanel();
    else openFramesPanel(anchor ?? toolbar);
  }

  /**
   * Validate a typed dash pattern. The ENGINE owns this contract (it is the same parse the
   * tool's hook runs on the stored value), so the running engine's primitive wins whenever
   * it is there; `parseDashArray` in free-canvas-math.ts is the identical fallback for a
   * build that predates it, so the field never stops validating. Feature-detected at the
   * call, not cached, because the bridge is assembled asynchronously.
   */
  function parseDashText(text: string): number[] | null {
    // An emptied field is "no authored array", never an error - decided here rather than
    // delegated, so clearing the control cannot depend on how the engine reads a blank.
    if (!text.trim()) return [];
    const viaHost = host?.connectors?.dashFit?.parse;
    if (typeof viaHost === 'function') {
      try {
        return viaHost(text);
      } catch {
        /* a refusing primitive is not a reason to lose the field */
      }
    }
    return parseDashArray(text);
  }

  /**
   * ── Stroke panel: width / style / ends / corners / fill rule ───────────────────
   *
   * A path box's stroke had a colour control and nothing else, so the width and the two
   * decorations were unreachable from the canvas - which is the working surface for an
   * `render.layout:"editor"` tool. Everything writes through `setField`, i.e. to EVERY
   * selected box in one `commit()`, the same as the More panel's controls.
   *
   * Fill rule lives here rather than under More because it is a property of the path's
   * paint, and it is what makes a hole a hole the moment anyone uses Subtract.
   *
   * Stroke ALIGNMENT (inside / centre / outside) is deliberately absent: SVG strokes on the
   * centreline only, so inside/outside is not a paint setting but a real outline conversion -
   * which the context menu already offers, exactly, as "Outline stroke".
   *
   * Plan 96 adds three things a keyword-only stroke could not say: the two ARROWHEADS (a
   * spline, a line and a connector are one primitive, so they share one decoration set), the
   * authored DASH ARRAY for anyone who wants the actual numbers, and the corner FIT that
   * makes a dashed rectangle land a dash on each corner instead of a half one.
   */
  function openStrokePanel(anchor: HTMLElement): void {
    closeMorePanel();
    const boxes = getBoxes();
    const idx = selIndices(boxes);
    if (!idx.length) return;
    const b: Box = boxes[idx[0]!] || {};
    const swCur = Math.max(
      0,
      Math.round(clampN(parseFloat(String(b[cfg.strokeWField])), 0, 0, 400))
    );
    const dashCur = String(b[cfg.strokeDashField] ?? '');
    const capCur = String(b[cfg.strokeCapField] || 'round');
    const joinCur = String(b[cfg.strokeJoinField] || 'round');
    const ruleCur = String(b[cfg.fillRuleField] || 'nonzero');
    const dashArrCur = String(b[cfg.strokeDashArrayField] ?? '');
    const dashFitCur = b[cfg.dashFitField] === true || String(b[cfg.dashFitField]) === 'true';
    const headStartCur = String(b[cfg.headStartField] || 'none');
    const headEndCur = String(b[cfg.headEndField] || 'none');
    // Route is a property of a CONNECTOR, so it is offered only once an end is attached:
    // on a free spline it would be a control with nothing to act on. `pathRouteStyle`
    // supplies the label for what Auto currently resolves to, so "auto" is never a mystery.
    const routeCur = String(b[cfg.routeField] ?? '');
    const routeBound = hasRouteCfg && isBoundPath(b);
    // Plan 179 A5: the panel is reachable from any kind that renders a stroke now, and a
    // box / image / artboard paints its stroke as a CSS BORDER. A border has a width and
    // a solid/dashed/dotted style and nothing else - no line ends, no join style, no fill
    // rule, no arrowheads, no dash array. Those are the SVG path's, and the manifest says
    // so (`strokeCap`, `strokeJoin`, `fillRule`, `headStart/End`, `strokeDashArray` and
    // `dashFit` all declare `showFor: ["path"]`). Offering them here would be the object
    // bar's old mistake one level down: a control that writes a field the render ignores.
    const pathOnly = selectionAllPaths(boxes, idx);
    const headSelect = (field: string, cur: string, lbl: string): string =>
      `<select class="field-select field-select--sm" data-sp-head="${escape(field)}" aria-label="${escape(lbl)}">` +
      HEAD_CHOICES.map(
        ([v, l]) => `<option value="${v}"${cur === v ? ' selected' : ''}>${escape(t(l))}</option>`
      ).join('') +
      '</select>';
    const p = document.createElement('div');
    p.className = 'fc-panel fc-more-panel fc-stroke-panel';
    p.innerHTML =
      `<label class="fc-row"><span class="fc-row-lbl" data-tip="${escape(t('Stroke width'))}">${icon(SVG.strokeIc)}<span>${t('Stroke width')}</span></span>` +
      `<input type="range" class="field-range" data-sp="width" min="0" max="120" value="${swCur}"><b data-sp-val="width">${swCur}</b></label>` +
      segRow(
        SVG.dashDashed,
        t('Stroke style'),
        segHtml(cfg.strokeDashField, dashCur, [
          ['', t('Solid'), SVG.dashSolid],
          ['dashed', t('Dashed'), SVG.dashDashed],
          ['dotted', t('Dotted'), SVG.dashDotted],
        ])
      ) +
      // The power-user pair, where the manifest declares them (hasDashArrayCfg). Shown when
      // a dash style is on, or whenever an array is already authored - so a pattern can
      // never become unreachable by switching the keyword back to Solid, and a solid stroke
      // is not asked about dashes it has none of.
      (hasDashArrayCfg && pathOnly
        ? `<label class="fc-row" data-sp-row="dasharray"${dashRowOn(dashCur, dashArrCur) ? '' : ' hidden'}>` +
          `<span class="fc-row-lbl" data-tip="${escape(t('Dash array'))}">${icon(SVG.dashDotted)}<span>${t('Dash array')}</span></span>` +
          `<input type="text" data-sp="dasharray" inputmode="decimal" spellcheck="false" autocomplete="off"` +
          ` value="${escape(dashArrCur)}" placeholder="6 4" aria-label="${escape(t('Dash array'))}"></label>` +
          `<label class="fc-row fc-row-toggle field-toggle" data-sp-row="dashfit"${dashRowOn(dashCur, dashArrCur) ? '' : ' hidden'}>` +
          `<span class="fc-row-lbl" data-tip="${escape(t('Fit dashes to corners'))}">${icon(SVG.joinMiter)}<span>${t('Fit dashes to corners')}</span></span>` +
          `<input type="checkbox" class="field-check" data-sp="dashfit"${dashFitCur ? ' checked' : ''}></label>`
        : '') +
      (pathOnly
        ? segRow(
            SVG.capRound,
            t('Line ends'),
            segHtml(cfg.strokeCapField, capCur, [
              ['round', t('Round ends'), SVG.capRound],
              ['butt', t('Flat ends'), SVG.capButt],
              ['square', t('Square ends'), SVG.capSquare],
            ])
          )
        : '') +
      // Arrowheads. Two plain menus rather than twelve icon buttons: the six shapes are
      // named things, and the row already carries three other segmented controls. Offered
      // only where the manifest declares them - see hasHeadCfg.
      (hasHeadCfg && pathOnly
        ? segRow(
            SVG.line,
            t('Path start'),
            headSelect(cfg.headStartField, headStartCur, t('Path start'))
          ) +
          segRow(SVG.line, t('Path end'), headSelect(cfg.headEndField, headEndCur, t('Path end')))
        : '') +
      // Route - how a line with an attached end is bent between the two boxes. One plain
      // menu, beside the heads, because the three of them are the connector's whole shape.
      (routeBound
        ? segRow(
            SVG.tidy,
            t('Route'),
            `<select class="field-select field-select--sm" data-sp-route aria-label="${escape(t('Route'))}">` +
              ROUTE_CHOICES.map(
                ([v, l]) =>
                  `<option value="${v}"${routeCur === v ? ' selected' : ''}>${escape(t(l))}</option>`
              ).join('') +
              '</select>'
          )
        : '') +
      (pathOnly
        ? segRow(
            SVG.joinRound,
            t('Corners'),
            segHtml(cfg.strokeJoinField, joinCur, [
              ['round', t('Round corners'), SVG.joinRound],
              ['miter', t('Sharp corners'), SVG.joinMiter],
              ['bevel', t('Bevelled corners'), SVG.joinBevel],
            ])
          ) +
          segRow(
            SVG.ruleEvenOdd,
            t('Fill rule'),
            segHtml(cfg.fillRuleField, ruleCur, [
              ['nonzero', t('Fill overlaps (non-zero)'), SVG.ruleNonzero],
              ['evenodd', t('Punch holes (even-odd)'), SVG.ruleEvenOdd],
            ])
          )
        : '');
    p.addEventListener('pointerdown', (e) => e.stopPropagation());
    // The dash-style segment also decides whether the two dash rows are on screen, so it
    // needs the write PLUS the reveal - hence a custom onSet rather than wireSegs' default.
    const dashArrEl = p.querySelector<HTMLInputElement>('input[data-sp="dasharray"]');
    const syncDashRows = (styleVal: string): void => {
      const on = dashRowOn(styleVal, dashArrEl?.value ?? dashArrCur);
      p.querySelectorAll<HTMLElement>('[data-sp-row="dasharray"], [data-sp-row="dashfit"]').forEach(
        (row) => {
          row.hidden = !on;
        }
      );
    };
    wireSegs(p, (field, v) => {
      setField(field, v);
      if (field === cfg.strokeDashField) syncDashRows(String(v ?? ''));
    });
    p.querySelectorAll<HTMLInputElement>('input[data-sp="width"]').forEach((rng) =>
      rng.addEventListener('input', () => {
        const valEl = p.querySelector<HTMLElement>('[data-sp-val="width"]');
        if (valEl) valEl.textContent = rng.value;
        setField(cfg.strokeWField, Number(rng.value));
      })
    );
    // Dash array: validated on every keystroke, but a REFUSAL writes nothing at all rather
    // than a repaired guess. That is what keeps the hook's injection stance intact - only
    // numbers ever reach `stroke-dasharray` - and it is also the honest answer to "6 x":
    // there is no pattern there to store, and silently dropping the 'x' would author a
    // pattern the user did not type.
    if (dashArrEl) {
      dashArrEl.addEventListener('input', () => {
        const nums = parseDashText(dashArrEl.value);
        const bad = nums === null;
        dashArrEl.setAttribute('aria-invalid', String(bad));
        if (bad) return;
        setField(cfg.strokeDashArrayField, nums.length ? formatDashArray(nums) : '');
      });
      // Leaving the field with something unparseable puts back what is actually stored,
      // so the control never shows a value the document does not have.
      dashArrEl.addEventListener('blur', () => {
        if (dashArrEl.getAttribute('aria-invalid') !== 'true') return;
        const cur = getBoxes()[selIndices(getBoxes())[0] ?? -1] as Box | undefined;
        dashArrEl.value = String(cur?.[cfg.strokeDashArrayField] ?? '');
        dashArrEl.setAttribute('aria-invalid', 'false');
      });
    }
    p.querySelectorAll<HTMLInputElement>('input[data-sp="dashfit"]').forEach((cb) =>
      cb.addEventListener('change', () => setField(cfg.dashFitField, cb.checked))
    );
    p.querySelectorAll<HTMLSelectElement>('select[data-sp-head]').forEach((sel) =>
      sel.addEventListener('change', () => setField(sel.dataset.spHead, sel.value))
    );
    p.querySelectorAll<HTMLSelectElement>('select[data-sp-route]').forEach((sel) =>
      sel.addEventListener('change', () => setField(cfg.routeField, sel.value))
    );
    stageEl.appendChild(p);
    morePanel = p;
    const ar = anchor.getBoundingClientRect();
    const sr = stageEl.getBoundingClientRect();
    p.style.left = Math.min(ar.left - sr.left, Math.max(0, sr.width - p.offsetWidth - 8)) + 'px';
    p.style.top = ar.bottom - sr.top + 8 + 'px';
  }

  // ── one-number prompt ─────────────────────────────────────────────────────────
  // A couple of menu actions need a number before they can run. There is no prompt() in
  // this app and no dialog light enough for a menu item, so this is the same `fc-panel`
  // recipe the size and dimensions panels already use - a labelled number field
  // committed by Enter or by the button - positioned at the point the menu was opened
  // from. It rides `morePanel`, so an outside click or Escape dismisses it like the rest.
  interface NumberAsk {
    at: Point;
    title: string;
    hint?: string;
    value: number;
    min?: number;
    max?: number;
    step?: number;
    unit?: string;
    confirm: string;
    apply(value: number): void;
  }
  function askNumber(ask: NumberAsk): void {
    closePopover();
    closeMorePanel();
    const p = document.createElement('div');
    p.className = 'fc-panel fc-num-panel';
    p.innerHTML =
      `<div class="fc-panel-head">${escape(ask.title)}</div>` +
      (ask.hint ? `<p class="fc-num-hint">${escape(ask.hint)}</p>` : '') +
      '<div class="fc-num-row">' +
      `<input type="number" data-num step="${ask.step ?? 1}"` +
      (ask.min != null ? ` min="${ask.min}"` : '') +
      (ask.max != null ? ` max="${ask.max}"` : '') +
      ` value="${ask.value}" aria-label="${escape(ask.title)}">` +
      `<i>${escape(ask.unit || 'px')}</i>` +
      `<button type="button" class="btn btn--primary btn--sm fc-num-go" data-num-go>${escape(ask.confirm)}</button>` +
      '</div>';
    p.addEventListener('pointerdown', (e) => e.stopPropagation());
    const inp = p.querySelector<HTMLInputElement>('[data-num]')!;
    const go = (): void => {
      const v = parseFloat(inp.value);
      closeMorePanel();
      if (Number.isFinite(v)) ask.apply(v);
    };
    // Enter is the only keyboard commit; Escape falls through to onKey, which closes the
    // panel without applying.
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        go();
      }
    });
    p.querySelector<HTMLButtonElement>('[data-num-go]')!.addEventListener('click', (e) => {
      e.stopPropagation();
      go();
    });
    stageEl.appendChild(p);
    morePanel = p;
    const sr = stageEl.getBoundingClientRect();
    p.style.left =
      Math.max(6, Math.min(ask.at.x - sr.left, Math.max(6, sr.width - p.offsetWidth - 6))) + 'px';
    p.style.top =
      Math.max(6, Math.min(ask.at.y - sr.top, Math.max(6, sr.height - p.offsetHeight - 6))) + 'px';
    inp.focus();
    inp.select();
  }

  // ── are-you-sure ──────────────────────────────────────────────────────────────
  // One action in this overlay destroys authored work rather than moving it: switching a
  // path's spline kind to one that solves its own handles. There is no confirm dialog here
  // and a modal would be far too much furniture for a control on the object bar, so this is
  // the SAME `fc-panel` recipe as askNumber - a titled panel with a sentence and one
  // primary button - riding `morePanel`, so an outside click or Escape dismisses it and
  // that dismissal means "no".
  interface ConfirmAsk {
    at: Point;
    title: string;
    hint: string;
    confirm: string;
    apply(): void;
    cancel?(): void;
  }
  function askConfirm(ask: ConfirmAsk): void {
    closePopover();
    closeMorePanel();
    const p = document.createElement('div');
    p.className = 'fc-panel fc-num-panel fc-confirm-panel';
    p.innerHTML =
      `<div class="fc-panel-head">${escape(ask.title)}</div>` +
      `<p class="fc-num-hint">${escape(ask.hint)}</p>` +
      '<div class="fc-num-row fc-confirm-row">' +
      `<button type="button" class="btn btn--sm" data-confirm-no>${escape(t('Keep them'))}</button>` +
      `<button type="button" class="btn btn--primary btn--sm" data-confirm-yes>${escape(ask.confirm)}</button>` +
      '</div>';
    p.addEventListener('pointerdown', (e) => e.stopPropagation());
    // Exactly one of apply/cancel runs, exactly once, whichever way the panel goes away.
    // The two buttons settle it synchronously; the observer only catches the INDIRECT
    // dismissals (Escape, an outside click), which go through the generic closeMorePanel
    // and so cannot call back here themselves. Synchronously matters: the caller usually has
    // UI to put back - a <select> still showing the kind it did not switch to - and leaving
    // that until a microtask would show the wrong value for a frame.
    let settled = false;
    const settle = (ok: boolean): void => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      if (ok) ask.apply();
      else ask.cancel?.();
    };
    const observer = new MutationObserver(() => {
      if (!p.isConnected) settle(false);
    });
    p.querySelector<HTMLButtonElement>('[data-confirm-yes]')!.addEventListener('click', (e) => {
      e.stopPropagation();
      closeMorePanel();
      settle(true);
    });
    p.querySelector<HTMLButtonElement>('[data-confirm-no]')!.addEventListener('click', (e) => {
      e.stopPropagation();
      closeMorePanel();
      settle(false);
    });
    stageEl.appendChild(p);
    observer.observe(stageEl, { childList: true });
    morePanel = p;
    const sr = stageEl.getBoundingClientRect();
    p.style.left =
      Math.max(6, Math.min(ask.at.x - sr.left, Math.max(6, sr.width - p.offsetWidth - 6))) + 'px';
    p.style.top =
      Math.max(6, Math.min(ask.at.y - sr.top, Math.max(6, sr.height - p.offsetHeight - 6))) + 'px';
    p.querySelector<HTMLButtonElement>('[data-confirm-yes]')!.focus();
  }

  /**
   * The drop door's question for a document of several pages: artboards, timed scenes,
   * or just one page. The SAME `fc-panel` recipe as askConfirm, centred on the stage,
   * and deliberately NOT the shared `choiceDialog`: that modal rides the phantom
   * history entry the Back button needs, and popping it on close fires a popstate the
   * router answers by re-mounting the tool - which tore down the very view that was
   * mid-import and dropped the result on the floor (measured 2026-09-02). A stage panel
   * touches no history. Resolves null on Escape / an outside click.
   */
  function askImportPages(pages: number | null): Promise<ImportMode | null> {
    return new Promise((resolve) => {
      closePopover();
      closeMorePanel();
      const p = document.createElement('div');
      p.className = 'fc-panel fc-num-panel fc-confirm-panel fc-import-pages-panel';
      p.setAttribute('role', 'dialog');
      p.setAttribute('aria-label', t('Import pages'));
      p.tabIndex = -1;
      const hint = pages
        ? t('This document has {n} pages. How should they come in?', { n: pages })
        : t('How should this document’s pages come in?');
      p.innerHTML =
        `<div class="fc-panel-head">${escape(t('Import pages'))}</div>` +
        `<p class="fc-num-hint">${escape(hint)}</p>` +
        '<div class="fc-num-row fc-confirm-row">' +
        `<button type="button" class="btn btn--sm" data-import-mode="">${escape(t('Cancel'))}</button>` +
        (importArtboardCapable
          ? `<button type="button" class="btn btn--primary btn--sm" data-import-mode="artboards">${escape(t('As artboards'))}</button>`
          : '') +
        (importSceneCapable
          ? `<button type="button" class="btn ${importArtboardCapable ? '' : 'btn--primary '}btn--sm" data-import-mode="scenes">${escape(t('As timed scenes'))}</button>`
          : '') +
        `<button type="button" class="btn btn--sm" data-import-mode="board">${escape(t('Just one page'))}</button>` +
        '</div>';
      p.addEventListener('pointerdown', (e) => e.stopPropagation());
      let settled = false;
      const settle = (mode: ImportMode | null): void => {
        if (settled) return;
        settled = true;
        observer.disconnect();
        resolve(mode);
      };
      const observer = new MutationObserver(() => {
        if (!p.isConnected) settle(null);
      });
      p.querySelectorAll<HTMLButtonElement>('[data-import-mode]').forEach((b) => {
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          const v = b.dataset.importMode;
          closeMorePanel();
          settle(
            v === 'artboards'
              ? 'artboards'
              : v === 'scenes'
                ? 'scenes'
                : v === 'board'
                  ? 'board'
                  : null
          );
        });
      });
      stageEl.appendChild(p);
      observer.observe(stageEl, { childList: true });
      morePanel = p;
      const sr = stageEl.getBoundingClientRect();
      p.style.left = Math.max(6, Math.round((sr.width - p.offsetWidth) / 2)) + 'px';
      p.style.top = Math.max(6, Math.round((sr.height - p.offsetHeight) / 2)) + 'px';
      (p.querySelector<HTMLButtonElement>('.btn--primary') ?? p).focus();
    });
  }

  // ── Lift layers (plans/104 section 7) ───────────────────────────────────────────────
  //
  // "The feature that makes this especially for vectors": one box holding a flat SVG
  // becomes N stacked boxes, one per layer of the drawing, sharing a group, with their
  // depth auto-staggered and `shadow: depth` pre-set - at which point every layer is an
  // ordinary plate with its own z, keyframes and blur, and the rest of this plan works
  // on it unchanged. Zero new machinery downstream; the whole feature is here plus the
  // engine's enumerator.
  //
  // The division of labour, and why nothing below re-implements any of it:
  //   • `enumerateSvgLayers` (engine, 1.119) reads the sanitised markup and derives one
  //     STANDALONE `<svg>` per layer, in the source's own root coordinates - which is
  //     what makes the geometry identity hold (N layers at z = 0 render as the original).
  //   • `liftRows` + `applyLift` (free-canvas-math) synthesise the rows and splice them
  //     in place, including the paint-order distribution (bg on the bottom row, text on
  //     the top) that keeps a lift from compositing the background N times.
  //   • `storeUserUpload` (picker) is the ONE ingest funnel: every derived document goes
  //     through DOMPurify again on the way in, exactly like a file the user dragged.
  //
  // ONE commit for the whole thing, so one ⌘Z puts the original box back.

  /** The single selected box that can be lifted, or -1. */
  function liftTargetIndex(boxes: Box[]): number {
    if (!cfg.imageField) return -1;
    const idx = selIndices(boxes);
    if (idx.length !== 1) return -1;
    return isSvgImageRef(boxes[idx[0]!]?.[cfg.imageField]) ? idx[0]! : -1;
  }

  /** Is "Lift layers" available on this tool at all? (Somewhere to put the rows.) */
  const canLift = (): boolean => !!cfg.imageField;

  /** The stem of a source asset's name, for naming the derived documents. */
  function liftBaseName(ref: unknown): string {
    const r = (ref || {}) as { url?: unknown; meta?: { name?: unknown } | null };
    const named = typeof r.meta?.name === 'string' ? r.meta.name : '';
    // `decodeURIComponent` THROWS on a lone `%` or a bad escape, and the tail it is
    // handed comes from a ref the shell did not necessarily mint - `isSvgImageRef`
    // accepts a hand-written `data:image/svg+xml` link, and a hook patch can put
    // anything in `url`. A URIError here used to escape a naming helper into an
    // unhandled rejection; the raw tail is a perfectly good name.
    const tail =
      typeof r.url === 'string' ? (r.url.split(/[?#]/)[0] || '').split('/').pop() || '' : '';
    let fromUrl = tail;
    try {
      fromUrl = decodeURIComponent(tail);
    } catch {
      /* keep the raw tail */
    }
    const raw = (named || fromUrl || 'artwork').replace(/\.[a-z0-9]+$/i, '');
    // The picker's own id sanitiser runs over the final filename anyway; keeping this
    // conservative means the derived names stay readable in the asset library.
    return (
      raw
        .replace(/[^a-z0-9 _-]/gi, '')
        .trim()
        .slice(0, 40) || 'artwork'
    );
  }

  /**
   * The confirm dialog: what the lift WILL do, before it does it.
   *
   * The `fc-panel` recipe `askConfirm` established - a titled panel with a sentence and
   * two buttons, riding `morePanel` so an outside click or Escape dismisses it and that
   * dismissal means "no". It grows one thing: the list of layers.
   *
   * The list is READ-ONLY, deliberately, and this is a v1 decision worth stating. section 7
   * calls it a "checklist preview", and the obvious reading is checkboxes - but an
   * unticked layer has nowhere to go: dropping it would silently delete artwork the
   * user never asked to lose, and merging it into a neighbour is a semantic section 7 does not
   * define. So v1 SHOWS the plan and asks yes or no to all of it; per-layer control
   * belongs with the Objects panel (plan 100), which is section 7's own stated home for the
   * list. No thumbnails either: rendering N derived documents to preview them costs a
   * rasteriser and a frame each, and the label plus the element count already answers
   * the only question the dialog is asked ("did it find my layers, or one big blob?").
   *
   * Two async stages, one panel: it opens IMMEDIATELY in a reading state (the fetch +
   * sanitise + enumerate can take a moment on a large file, and a menu item that does
   * nothing visible for half a second reads as broken), then re-renders in place with
   * the plan, or with the enumerator's own refusal in its own words.
   *
   * That second stage is the whole reason this panel is built in THREE pieces (head,
   * a live `[data-lift-msg]` sentence, a swapped `[data-lift-body]`) rather than one
   * `innerHTML` per stage. "Reading the artwork…" is a picture of work in flight, and
   * a picture is all it was: the panel opened without focus and repainted wholesale
   * whenever the enumeration landed, so a screen reader was told nothing at open and
   * nothing at the finish - and then focus jumped to a button that had appeared out of
   * a silence. Three habits the shell already has fix it:
   *
   *   • `aria-busy` on the container while it reads (template-chooser's tile,
   *     tool-actions' export button, color-lab's charts section);
   *   • ONE `role="status"` sentence that OUTLIVES both stages, so the outcome is a
   *     mutation of a mounted live region rather than a new region nobody announces;
   *   • focus taken at OPEN (askConfirm's move, and it is the user's own gesture that
   *     opened this), then moved WITHIN the panel afterwards - `focusInPanel` declines
   *     when the user has since gone somewhere else, because a control that appears
   *     after an await has no claim on where they went while it loaded.
   */
  function askLiftLayers(): void {
    if (!cfg.imageField) return;
    const boxes0 = getBoxes();
    const at = liftTargetIndex(boxes0);
    if (at < 0) return;
    const sourceId = idOf(boxes0[at], at);
    const ref = boxes0[at]![cfg.imageField] as { url?: unknown } | undefined;
    const url = typeof ref?.url === 'string' ? ref.url : '';
    if (!url) return;

    closePopover();
    closeMorePanel();
    const p = document.createElement('div');
    p.className = 'fc-panel fc-num-panel fc-lift-panel';
    p.tabIndex = -1;
    p.setAttribute('role', 'dialog');
    p.setAttribute('aria-label', t('Lift layers'));
    // Reading is a STATE, not just a sentence. Dropped again by whichever of
    // renderPlan / renderRefusal lands - both are the end of the work.
    p.setAttribute('aria-busy', 'true');
    p.addEventListener('pointerdown', (e) => e.stopPropagation());
    p.innerHTML =
      `<div class="fc-panel-head">${escape(t('Lift layers'))}</div>` +
      `<p class="fc-num-hint" data-lift-msg role="status" aria-live="polite">${escape(t('Reading the artwork…'))}</p>` +
      '<div data-lift-body></div>';
    // Mounted once and only ever re-WORDED: the count sentence, the refusal and the
    // reading state are the same line of the panel, so the announcement is a change to
    // a live region that was already in the tree.
    const msgEl = p.querySelector<HTMLElement>('[data-lift-msg]')!;
    const bodyEl = p.querySelector<HTMLElement>('[data-lift-body]')!;
    stageEl.appendChild(p);
    morePanel = p;
    const sr = stageEl.getBoundingClientRect();
    p.style.left =
      Math.max(6, Math.min(lastMenuAt.x - sr.left, Math.max(6, sr.width - p.offsetWidth - 6))) +
      'px';
    p.style.top =
      Math.max(6, Math.min(lastMenuAt.y - sr.top, Math.max(6, sr.height - p.offsetHeight - 6))) +
      'px';
    // At OPEN, synchronously, on the gesture that asked for it - so the dialog's name
    // and its reading sentence are what gets read, and every later focus move is a move
    // WITHIN a surface the user is already in rather than a jump out of one they left.
    p.focus();

    /** Still the panel on screen? Every await below re-asks before touching the DOM. */
    const live = (): boolean => !disposed && morePanel === p && p.isConnected;

    /**
     * Move focus to a control this panel just built - unless the user went elsewhere
     * while it was reading. `document.body` (or nothing at all) counts as "still ours":
     * that is where focus lands when the element it was on is replaced, which is
     * exactly what the stage swap below does.
     */
    const focusInPanel = (el: HTMLElement | null | undefined): void => {
      if (!el) return;
      const active = document.activeElement;
      if (active === null || active === document.body || p.contains(active)) el.focus();
    };

    void (async () => {
      try {
        // The sanitised markup, through the shell's ONE untrusted-SVG path (DOMPurify,
        // serialised from the sanitised NODE). `fetchAnimSvg` is that path plus a
        // per-URL cache - named for its first caller, but it is simply "give me this
        // SVG's markup, safely", which is exactly what an enumeration needs.
        const [{ fetchAnimSvg }, { enumerateSvgLayers, svgRootViewBox }] = await Promise.all([
          import('./anim-svg-mount.ts'),
          import('../../../../engine/src/svg-layers.ts'),
        ]);
        const markup = await fetchAnimSvg(url);
        if (!live()) return;
        // Whether a derived document may be CROPPED to its own ink is a property of
        // the box it will land in, and it has to be settled before the documents
        // exist - a cropped document needs a row cut to the same rect (plans/104
        // P3.2). `liftCanCrop` is the one predicate; `liftRows` asks it again at
        // commit time, so the dialog and the write cannot disagree.
        const sboxes = getBoxes();
        const src = sboxes[indexOfId(sboxes, sourceId)];
        const place = {
          viewBox: svgRootViewBox(markup),
          fit: String(src?.[cfg.fitField] ?? 'contain'),
        };
        const cropToInk = !!src && liftCanCrop(src, cfg, place);
        // …and WHERE it will be cropped to. A crop is only free if the row it maps
        // to lands on the pixel grid the uncropped picture was already on, and the
        // scale that decides that is a property of THIS box, not of the artwork -
        // so the engine is told it rather than assuming 1:1 (engine 1.122).
        const cropScale = (src && liftCropScale(src, cfg, place)) || undefined;
        const { layers, warnings, viewBox } = enumerateSvgLayers(markup, { cropToInk, cropScale });
        if (!live()) return;
        if (layers.length < 2) {
          // ONE layer is not a stack, and lifting it would add a box and a group for no
          // gain. The enumerator's own warning (if any) says why in plain words.
          renderRefusal(
            warnings[0] || t('This artwork is a single layer, so there is nothing to lift apart.')
          );
          return;
        }
        renderPlan(layers, warnings, viewBox);
      } catch (e) {
        console.error(e);
        if (live()) renderRefusal(t('That artwork could not be read.'));
      }
    })();

    function renderRefusal(message: string): void {
      p.removeAttribute('aria-busy');
      msgEl.textContent = message;
      bodyEl.innerHTML = `<div class="fc-num-row fc-confirm-row"><button type="button" class="btn btn--sm" data-lift-close>${escape(t('Close'))}</button></div>`;
      const close = bodyEl.querySelector<HTMLButtonElement>('[data-lift-close]');
      close?.addEventListener('click', (e) => {
        e.stopPropagation();
        closeMorePanel();
      });
      focusInPanel(close);
    }

    function renderPlan(layers: SvgLayerPlan[], warnings: string[], viewBox: SvgSourceBox): void {
      p.removeAttribute('aria-busy');
      // The count sentence is the headline section 7 names verbatim ("6 layers found"), and it
      // is the SAME line that said "Reading the artwork…" a moment ago - so a screen
      // reader hears the finish without the dialog being rebuilt around it.
      msgEl.textContent = t('{n} layers found', { n: layers.length });
      bodyEl.innerHTML =
        `<ul class="fc-lift-list">${layers
          .map((L, i) => {
            // The label is an INDEX, never a name out of the file: the engine never
            // reads `data-name`/`inkscape:label`, so "Layer 3" is the honest thing to
            // print. The count beside it is what tells a stack of six real layers apart
            // from six stray leaves the clusterer happened to group.
            //
            // One exception, and it is an ID rather than a name: `boxId` is the walker's
            // `data-box-id` come back round (section 7's identity passthrough - a Lolly
            // screenshot exported with `layerIds` carries the canvas's own box ids), so
            // when it is there the row can say WHICH element of the original page this
            // layer is. Minted by the canvas, never read out of a stranger's file.
            const label = t('Layer {n}', { n: i + 1 });
            const nodes = L.nodes === 1 ? t('1 shape') : t('{n} shapes', { n: L.nodes });
            const from =
              typeof L.boxId === 'string' && L.boxId
                ? ` <span class="fc-lift-n">${escape(L.boxId)}</span>`
                : '';
            return (
              `<li class="fc-lift-row"><span class="fc-lift-tick" aria-hidden="true">${icon(SVG.check)}</span>` +
              `<span class="fc-lift-name">${escape(label)}${from}</span><span class="fc-lift-n">${escape(nodes)}</span></li>`
            );
          })
          .join('')}</ul>` +
        (warnings.length
          ? `<p class="fc-num-hint fc-lift-warn">${escape(warnings.join(' '))}</p>`
          : '') +
        // Depth intensity (audit A5#2): how far apart the stack stands. Medium is the
        // shipped taste ceiling - an unchanged lift is byte-identical to before - with
        // Dramatic there for a sparse hero shot that reads flat at the default.
        '<div class="fc-num-row fc-lift-strength-row">' +
        `<label class="field-label fc-lift-strength-lab" for="fc-lift-strength">${escape(t('Depth intensity'))}</label>` +
        '<select class="field-select field-select--sm fc-lift-strength" id="fc-lift-strength" data-lift-strength>' +
        `<option value="subtle">${escape(t('Subtle'))}</option>` +
        `<option value="medium" selected>${escape(t('Medium'))}</option>` +
        `<option value="dramatic">${escape(t('Dramatic'))}</option>` +
        '</select>' +
        '</div>' +
        '<div class="fc-num-row fc-confirm-row">' +
        `<button type="button" class="btn btn--sm" data-lift-no>${escape(t('Cancel'))}</button>` +
        `<button type="button" class="btn btn--primary btn--sm" data-lift-yes>${escape(t('Lift layers'))}</button>` +
        '</div>';
      bodyEl.querySelector<HTMLButtonElement>('[data-lift-no]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        closeMorePanel();
      });
      const yes = bodyEl.querySelector<HTMLButtonElement>('[data-lift-yes]');
      yes?.addEventListener('click', (e) => {
        e.stopPropagation();
        // Read the Depth-intensity choice at commit time - the select is the only source
        // of truth, and an unknown value maps to `medium` (1), the byte-identical default.
        const pick =
          bodyEl.querySelector<HTMLSelectElement>('[data-lift-strength]')?.value ?? 'medium';
        const strength = LIFT_STRENGTH[pick] ?? LIFT_STRENGTH.medium;
        yes.disabled = true;
        yes.textContent = t('Lifting…');
        // Busy again, and for the same reason it was at open: the stores and the commit
        // are work in flight. `runLift`'s `finally` takes the panel down whichever way
        // it goes, so there is no path that leaves this attribute standing.
        p.setAttribute('aria-busy', 'true');
        // The button that was pressed is now disabled, so focus is about to be dropped
        // on the floor by the browser - park it on the panel, which still says what is
        // happening, rather than letting it fall to <body> and out of the dialog.
        p.focus();
        void runLift(sourceId, ref, layers, viewBox, () => live(), strength);
      });
      focusInPanel(yes);
    }
  }

  /** What this file needs from an engine `SvgLayer` - structural, so no runtime import. */
  interface SvgLayerPlan {
    markup: string;
    nodes: number;
    boxId?: string;
    /** The crop the engine cropped this layer's document to (section P3.2), in source user units. */
    viewBox?: { x: number; y: number; w: number; h: number };
    /** The layer's measured ink extent - what decides which rows are peers. */
    bbox?: { x: number; y: number; w: number; h: number } | null;
  }
  /** The source document's own viewBox - the denominator for those crops. */
  type SvgSourceBox = { x: number; y: number; w: number; h: number } | null;

  /**
   * Do the lift: store one asset per derived layer, then write the rows in ONE commit.
   *
   * The stores happen FIRST and the commit last, so a failure part-way through leaves
   * the board exactly as it was - a half-lifted stack (some layers boxed, the original
   * gone) is the one outcome worth engineering against, and "nothing changed, here is
   * why" is recoverable where that is not.
   *
   * The model is re-read AFTER the awaits and the source box found by ID, never by the
   * index the dialog opened with: a collaborator's edit, an undo, or the user's own
   * click could have moved it while the assets were being written.
   */
  async function runLift(
    sourceId: string,
    ref: unknown,
    layers: SvgLayerPlan[],
    viewBox: SvgSourceBox,
    stillOpen: () => boolean,
    strength = 1
  ): Promise<void> {
    if (!cfg.imageField) return;
    try {
      // Inside the try, with the panel's close in the `finally` below: the confirm
      // button is already disabled and reading "Lifting…", so ANY throw from here on
      // that left the panel open would strand it in that state, dismissable only by
      // clicking outside. Naming the file was the one step that used to sit outside
      // both.
      const base = liftBaseName(ref);
      const [{ storeUserUpload }, { KF_Z_FIELD_CLAMP }] = await Promise.all([
        import('./picker.ts'),
        import('../../../../engine/src/keyframes.ts'),
      ]);
      const refs = [] as InputValue[];
      for (let i = 0; i < layers.length; i++) {
        const file = new File([layers[i]!.markup], `${base}-layer-${i + 1}.svg`, {
          type: 'image/svg+xml',
        });
        refs.push(
          (await storeUserUpload(
            host as unknown as Parameters<typeof storeUserUpload>[0],
            file
          )) as unknown as InputValue
        );
      }
      if (disposed) return;
      // Still closed here on the happy path, BEFORE the commit re-renders the
      // stage - the `finally` below is the safety net for the paths that used to
      // sail past this line, not a replacement for it.
      if (stillOpen()) closeMorePanel();

      const boxes = getBoxes();
      const at = indexOfId(boxes, sourceId);
      if (at < 0) {
        flash(t('That artwork is no longer on the canvas, so nothing was changed.'));
        return;
      }
      const source = boxes[at]!;
      // Ids are minted against a GROWING array, so two rows can never collide.
      let scratch = boxes;
      const ids: string[] = [];
      for (let i = 0; i < layers.length; i++) {
        const id = freshId(scratch);
        ids.push(id);
        scratch = [...scratch, { [cfg.idField]: id } as Box];
      }
      const rows = liftRows(
        source,
        layers.map((L, i) => ({
          src: String((refs[i] as { url?: unknown } | null)?.url ?? ''),
          id: ids[i]!,
          // The engine cropped the document; this is the same rect, so the row can
          // be sized to the ink instead of to the stage (plans/104 P3.2).
          crop: L.viewBox ?? null,
          bbox: L.bbox ?? null,
        })),
        // `zField` is the DEPTH field (plans/104 section 5.3) and lives on the canvas block
        // rather than in this module's geometry cfg - the only reader it has had until
        // now is `timeCfg`, because a keyed `z` replaces it for its segment. A lift is
        // its second reader, so it is named here rather than smuggled into FieldCfg,
        // where thirty other call sites would then have to ignore it.
        { ...cfg, zField: cv.zField || '' },
        {
          zClamp: KF_Z_FIELD_CLAMP,
          group: cfg.groupField ? freshGroupId(boxes) : '',
          viewBox,
          fit: String(source[cfg.fitField] ?? 'contain'),
          strength,
        }
        // `liftRows` types the image value as a URL STRING, but this canvas's image
        // sub-field is a declared `asset`: the engine resolves block asset sub-fields by
        // their `.id` (runtime.ts resolveAssetRefs) and the tool hook reads `image.url`,
        // so a bare string would render nothing and would not survive a reload. The row
        // therefore carries the whole ref, written in the same pass - one object per row,
        // still one commit.
      ).map((row, i) => ({ ...row, [cfg.imageField]: refs[i] }));

      selection = new Set(ids);
      commit(applyLift(boxes, at, rows));
      // No singular branch: `askLiftLayers` refuses anything under two layers with
      // `renderRefusal`, and `runLift` is reachable only from `renderPlan`, so a
      // "Lifted 1 layer." string could never have been shown - it was a dead key in
      // twenty-six locales.
      flash(t('Lifted {n} layers.', { n: layers.length }));
    } catch (e) {
      console.error(e);
      if (!disposed) flash(t('Those layers could not be lifted, so nothing was changed.'));
    } finally {
      // The panel closes whatever happened, which the try alone never guaranteed:
      // an IndexedDB quota rejection during the uploads (the very failure a heavy
      // lift invites - see the engine's SVG_LAYERS_HEAVY_BYTES warning) flashed a
      // message and left the confirm button disabled and reading "Lifting…" for
      // good, dismissable only by clicking outside. Idempotent - on the happy path
      // the panel is already gone and `stillOpen()` is false.
      if (stillOpen()) closeMorePanel();
    }
  }

  // ── Choreograph (plans/104 P4) ──────────────────────────────────────────────────────
  //
  // One click over a stack of boxes writes EXPANDED per-box keyframe tracks plus a camera
  // track - the camera presets' posture exactly: nothing is stored by name, so what a
  // showcase writes is ordinary keyframes the user can retime, split or delete afterwards.
  // All of the maths and the model write live in ./choreograph.ts, which is a LAZY chunk
  // (it pulls timeline-math and the engine's keyframe module); everything below is picker.

  /** Is "Choreograph" available on this tool at all? (Somewhere to write the tracks.) */
  const canChoreograph = (): boolean => !!timeCfg?.kfField;

  /**
   * A box a showcase may pose. Mirrors `choreographable` in ./choreograph.ts, which stays
   * the authority at write time - this copy exists only so the menu can gate itself
   * without fetching the chunk. (`cfg.kindField` is 'kind', the literal key the camera
   * readers use, so the two ask the same question of the same field.)
   */
  const isPosable = (b: Box | undefined): boolean =>
    !!b && !['camera', 'frame', 'audio'].includes(String(b[cfg.kindField] ?? ''));

  /** The selected boxes a showcase would pose, in array order. */
  function choreoIds(boxes: Box[]): string[] {
    return selIndices(boxes)
      .filter((i) => isPosable(boxes[i]))
      .map((i) => idOf(boxes[i], i));
  }

  /** A showcase over one box is just a keyframe, so two is the floor - and it is the same
   *  floor `applyChoreograph` refuses under, rather than a second opinion about it. */
  const canChoreographNow = (): boolean => choreoIds(getBoxes()).length >= 2;

  /**
   * The picker: six showcases, four settings, one button.
   *
   * The same `fc-panel` recipe as `askLiftLayers` - it rides `morePanel`, so an outside
   * click or Escape dismisses it and that dismissal means "no" - minus the reading state,
   * because there is nothing to fetch before it can draw itself: the plan is generated at
   * commit time out of boxes already on the canvas.
   */
  function askChoreograph(): void {
    if (!canChoreograph()) return;
    closePopover();
    closeMorePanel();
    let showcase: ShowcaseId = 'buildup';
    // The length follows the chosen showcase until the user types one. After that it is
    // theirs, and switching cards must not quietly overwrite it.
    let secDirty = false;
    const n = choreoIds(getBoxes()).length;
    const secOf = (id: ShowcaseId): string =>
      String((CHOREO_SHOWCASES.find((s) => s.id === id)?.ms ?? 3000) / 1000);
    const orderOpt = (v: string, label: string): string =>
      `<option value="${v}">${escape(label)}</option>`;

    const p = document.createElement('div');
    p.className = 'fc-panel fc-num-panel fc-choreo-panel';
    p.tabIndex = -1;
    p.setAttribute('role', 'dialog');
    p.setAttribute('aria-label', t('Choreograph'));
    // The count sentence is written once and never re-worded, so a live region would
    // announce nothing (only a mutation fires one). It is the dialog's DESCRIPTION instead,
    // read after the name when focus arrives.
    p.setAttribute('aria-describedby', 'fc-choreo-desc');
    p.addEventListener('pointerdown', (e) => e.stopPropagation());
    p.innerHTML =
      `<div class="fc-panel-head">${escape(t('Choreograph'))}</div>` +
      `<p class="fc-num-hint" id="fc-choreo-desc">${escape(t('{n} boxes. One click writes a full motion arc - every keyframe stays editable afterwards.', { n }))}</p>` +
      `<div class="fc-choreo-grid" role="radiogroup" aria-label="${escape(t('Showcase'))}">` +
      CHOREO_SHOWCASES.map(
        (s) =>
          // Roving tabindex: the checked card is the group's one Tab stop, the arrows walk the rest.
          `<button type="button" class="fc-choreo-card" role="radio" data-choreo="${s.id}" aria-checked="${s.id === showcase ? 'true' : 'false'}" tabindex="${s.id === showcase ? 0 : -1}">` +
          `${icon(s.icon)}<span class="fc-choreo-name">${escape(s.label)}</span>` +
          `<span class="fc-choreo-sub">${escape(s.sub)}</span></button>`
      ).join('') +
      '</div>' +
      '<div class="fc-num-row">' +
      // `step="any"`, the size panel's own choice for a fractional field above: the step
      // base is `min`, so a `step="0.5"` measured from 0.8 makes 3, 2.5, 6, 5 and 8 - the
      // six authored lengths this field is prefilled with - each a step MISMATCH, and the
      // spinner walks 3 to 3.3 rather than to 3.5. `min` is CHOREO_MIN_MS in seconds.
      `<label class="field-label fc-choreo-lab" for="fc-choreo-sec">${escape(t('Length in seconds'))}</label>` +
      `<input type="number" class="field-input fc-choreo-num" id="fc-choreo-sec" data-choreo-sec min="0.8" step="any" value="${secOf(showcase)}">` +
      '</div>' +
      '<div class="fc-num-row">' +
      // 90 ms is the generator's own DEFAULT_STAGGER_MS, restated here for the same
      // reason the six lengths are: the chunk must not be fetched to draw the picker.
      `<label class="field-label fc-choreo-lab" for="fc-choreo-stagger">${escape(t('Stagger ms'))}</label>` +
      '<input type="number" class="field-input fc-choreo-num" id="fc-choreo-stagger" data-choreo-stagger min="0" step="10" value="90">' +
      '</div>' +
      '<div class="fc-num-row">' +
      `<label class="field-label fc-choreo-lab" for="fc-choreo-order">${escape(t('Order'))}</label>` +
      '<select class="field-select field-select--sm fc-choreo-order" id="fc-choreo-order" data-choreo-order>' +
      orderOpt('', t('First to last')) +
      orderOpt('reverse', t('Last to first')) +
      orderOpt('center', t('From the centre')) +
      orderOpt('depth', t('By depth')) +
      orderOpt('random', t('Random')) +
      '</select>' +
      '</div>' +
      `<label class="fc-row fc-row-toggle field-toggle"><span>${escape(t('Camera move'))}</span>` +
      '<input type="checkbox" class="field-check" data-choreo-camera checked></label>' +
      `<label class="fc-row fc-row-toggle field-toggle"><span>${escape(t('Float - a breath of scale'))}</span>` +
      '<input type="checkbox" class="field-check" data-choreo-float checked></label>' +
      // Unchecked on purpose: one tilt key moves the whole export onto the slower
      // capture tier and refuses a board holding video, so 3D is a choice, not a default.
      `<label class="fc-row fc-row-toggle field-toggle"><span>${escape(t('Tumble - a 3D wobble (slower to export)'))}</span>` +
      '<input type="checkbox" class="field-check" data-choreo-tumble></label>' +
      '<div class="fc-num-row fc-confirm-row">' +
      `<button type="button" class="btn btn--sm" data-choreo-no>${escape(t('Cancel'))}</button>` +
      `<button type="button" class="btn btn--primary btn--sm" data-choreo-yes>${escape(t('Choreograph'))}</button>` +
      '</div>';
    stageEl.appendChild(p);
    morePanel = p;
    const sr = stageEl.getBoundingClientRect();
    p.style.left =
      Math.max(6, Math.min(lastMenuAt.x - sr.left, Math.max(6, sr.width - p.offsetWidth - 6))) +
      'px';
    p.style.top =
      Math.max(6, Math.min(lastMenuAt.y - sr.top, Math.max(6, sr.height - p.offsetHeight - 6))) +
      'px';
    // At OPEN, synchronously, on the gesture that asked for it - askLiftLayers' rule, and
    // the reason the dialog's own name is what a screen reader is given first.
    p.focus();

    /** Still the panel on screen? The one await below re-asks before touching anything. */
    const live = (): boolean => !disposed && morePanel === p && p.isConnected;

    const cards = Array.from(p.querySelectorAll<HTMLButtonElement>('[data-choreo]'));
    const secIn = p.querySelector<HTMLInputElement>('[data-choreo-sec]')!;
    const staggerIn = p.querySelector<HTMLInputElement>('[data-choreo-stagger]')!;
    const orderSel = p.querySelector<HTMLSelectElement>('[data-choreo-order]')!;
    const camIn = p.querySelector<HTMLInputElement>('[data-choreo-camera]')!;
    const floatIn = p.querySelector<HTMLInputElement>('[data-choreo-float]')!;
    const tumbleIn = p.querySelector<HTMLInputElement>('[data-choreo-tumble]')!;
    const yes = p.querySelector<HTMLButtonElement>('[data-choreo-yes]')!;

    const pick = (id: ShowcaseId): void => {
      showcase = id;
      for (const c of cards) {
        const on = c.dataset.choreo === id;
        c.setAttribute('aria-checked', on ? 'true' : 'false');
        c.tabIndex = on ? 0 : -1;
      }
      if (!secDirty) secIn.value = secOf(id);
    };
    for (const c of cards) {
      c.addEventListener('click', (e) => {
        e.stopPropagation();
        pick(c.dataset.choreo as ShowcaseId);
      });
    }
    // Arrows walk the group, which is what calling it a radiogroup owes its keyboard users.
    p.querySelector('.fc-choreo-grid')?.addEventListener('keydown', (ev) => {
      const key = (ev as KeyboardEvent).key;
      const step =
        key === 'ArrowRight' || key === 'ArrowDown'
          ? 1
          : key === 'ArrowLeft' || key === 'ArrowUp'
            ? -1
            : 0;
      if (!step) return;
      ev.preventDefault();
      const at = cards.findIndex((c) => c.getAttribute('aria-checked') === 'true');
      const next = cards[(Math.max(0, at) + step + cards.length) % cards.length];
      if (next) {
        pick(next.dataset.choreo as ShowcaseId);
        next.focus();
      }
    });
    secIn.addEventListener('input', () => {
      secDirty = true;
    });
    // Enter in either number field commits, exactly as askNumber's does.
    for (const inp of [secIn, staggerIn]) {
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          void run();
        }
      });
    }
    p.querySelector<HTMLButtonElement>('[data-choreo-no]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      closeMorePanel();
    });
    yes.addEventListener('click', (e) => {
      e.stopPropagation();
      void run();
    });

    /**
     * Read the panel, generate, commit ONCE - the tracks, any clip promotions and the
     * camera in a single undo step, which is `applyChoreograph`'s whole contract.
     */
    async function run(): Promise<void> {
      if (yes.disabled || !timeCfg) return;
      // The generator floors the arc at 0.8 s; say so in the field rather than let it read
      // 0.1 while a 0.8 s arc is made.
      let sec = parseFloat(secIn.value);
      if (secDirty && Number.isFinite(sec) && sec < 0.8) {
        sec = 0.8;
        secIn.value = '0.8';
      }
      const opts = {
        showcase,
        staggerMs: Math.max(0, Math.round(parseFloat(staggerIn.value) || 0)),
        order: orderSel.value as ChoreoOrder,
        camera: camIn.checked,
        float: floatIn.checked,
        tumble: tumbleIn.checked,
        // Left alone, the generator picks: a timed board's own clip span, and the
        // showcase's authored length on a board with no sequence yet.
        durationMs: secDirty && Number.isFinite(sec) ? Math.round(sec * 1000) : undefined,
      };
      yes.disabled = true;
      yes.textContent = t('Choreographing…');
      // Busy for the reason the lift's confirm is: the chunk fetch and the commit are work
      // in flight. The pressed button is now disabled, so park focus on the panel rather
      // than let the browser drop it on <body> and out of the dialog.
      p.setAttribute('aria-busy', 'true');
      p.focus();
      try {
        // LAZY, and this is why: choreograph.ts pulls timeline-math and with it the
        // engine's keyframe module - the same reason DEFAULT_CLIP_S is read through a
        // dynamic import rather than named at the top of this file.
        const { applyChoreograph, whyNotChoreograph } = await import('./choreograph.ts');
        if (!live()) return;
        const boxes = getBoxes();
        const ids = choreoIds(boxes);
        // A frames document opts out of depth and keyframe projection wholesale, so a
        // showcase written there would render as nothing: refuse, and say which.
        if (whyNotChoreograph(boxes, ids, timeCfg) === 'frames') {
          flash(
            t(
              'Choreograph works on a single artboard - a document with frames cannot be projected.'
            )
          );
          return;
        }
        const res = applyChoreograph(boxes, ids, opts, {
          cfg: timeCfg,
          rect: (b) => boxRect(b, cfg),
          stage: canvasWH(),
          // The manifest's own camera seed, exactly as ensureSceneCameraRows mints one.
          cameraSeed: addKinds.find((k) => k.id === 'camera')?.seed,
          mint: (rows) => freshId(rows),
        });
        if (!res) {
          flash(t('Select at least two boxes to choreograph.'));
          return;
        }
        closeMorePanel();
        selection = new Set(res.ids);
        commit(res.rows);
        // A hundred new keyframes are invisible until the timeline is up, so open it
        // rather than leave the user to go looking for what just happened.
        openTimeline();
        flash(t('Choreographed {n} boxes.', { n: res.ids.length }));
      } catch (e) {
        console.error(e);
        if (!disposed) flash(t('That showcase could not be written, so nothing was changed.'));
      } finally {
        // Idempotent: on the happy path the panel is already gone and `live()` is false.
        if (live()) closeMorePanel();
      }
    }
  }

  // Clamp a floating panel below-and-left of its anchor, inside the stage.
  function positionPanelBelow(p: HTMLElement, anchor: HTMLElement): void {
    const ar = anchor.getBoundingClientRect(),
      sr = stageEl.getBoundingClientRect();
    p.style.left = Math.max(6, Math.min(ar.left - sr.left, sr.width - p.offsetWidth - 8)) + 'px';
    p.style.top =
      Math.max(6, Math.min(ar.bottom - sr.top + 8, sr.height - p.offsetHeight - 8)) + 'px';
  }

  // ── Dimensions panel: manual X / Y / W / H / rotation for ONE box ─────────────
  // Opened from the object bar's transform readout (single selection only - editing
  // X on many boxes would stack them). Writes each field on `change`.
  function openDimsPanel(anchor: HTMLElement): void {
    closeMorePanel();
    const boxes = getBoxes();
    const idx = selIndices(boxes);
    if (idx.length !== 1) return;
    const b: Box = boxes[idx[0]!] || {};
    const rd = (f: string, d: number): number => Math.round(clampN(b[f], d, -100000, 100000));
    const x = rd(cfg.xField, 0),
      y = rd(cfg.yField, 0);
    const w = Math.max(1, rd(cfg.wField, 1)),
      h = Math.max(1, rd(cfg.hField, 1));
    const rot = Math.round(clampN(b[cfg.rotationField], 0, -180, 180));
    // One labelled number cell: leading axis letter · the field · trailing unit. Shared
    // with the inspector's Object section - see ./free-canvas-fields.ts's `dimsCell`.
    const cell = dimsCell;
    const p = document.createElement('div');
    p.className = 'fc-panel fc-dims-panel';
    p.innerHTML =
      `<div class="fc-panel-head">${t('Position &amp; size')}</div>` +
      '<div class="fc-dims">' +
      `<div class="fc-dims-row"><span class="fc-dims-ic" data-tip="${escape(t('Position'))}">${icon(SVG.move)}</span>${cell(t('X'), cfg.xField, x)}${cell(t('Y'), cfg.yField, y)}</div>` +
      `<div class="fc-dims-row"><span class="fc-dims-ic" data-tip="${escape(t('Size'))}">${icon(SVG.size)}</span>${cell(t('W'), cfg.wField, w, true)}${cell(t('H'), cfg.hField, h, true)}</div>` +
      (cfg.rotationField
        ? `<div class="fc-dims-row fc-dims-rot"><span class="fc-dims-ic" data-tip="${escape(t('Rotation'))}">${icon(SVG.rotate)}</span>` +
          `<label class="fc-dims-f"><input type="number" min="-180" max="180" data-dm="${cfg.rotationField}" value="${rot}"><i>°</i></label>` +
          `<input type="range" class="field-range fc-dims-slider" min="-180" max="180" value="${rot}" aria-label="${escape(t('Rotation'))}" data-dm-slider></div>`
        : '') +
      '</div>';
    p.addEventListener('pointerdown', (e) => e.stopPropagation());
    // Number fields commit on `change`; W/H floor at 1 and rotation clamps to ±180.
    p.querySelectorAll<HTMLInputElement>('input[data-dm]').forEach((inp) =>
      inp.addEventListener('change', () => {
        const f = inp.dataset.dm;
        let v = parseFloat(inp.value);
        if (!Number.isFinite(v)) return;
        if (f === cfg.wField || f === cfg.hField) v = Math.max(1, v);
        if (f === cfg.rotationField) {
          v = clampN(v, 0, -180, 180);
          inp.value = String(v);
        }
        setField(f, Math.round(v * 100) / 100);
      })
    );
    // Rotation slider - drags live-mirror the number readout and commit once on
    // release, so a drag never floods the undo history with intermediate steps.
    if (cfg.rotationField) {
      const rotNum = p.querySelector<HTMLInputElement>(
        `input[type="number"][data-dm="${cfg.rotationField}"]`
      );
      const rotRange = p.querySelector<HTMLInputElement>('[data-dm-slider]');
      if (rotNum && rotRange) {
        rotRange.addEventListener('input', () => {
          rotNum.value = rotRange.value;
        });
        rotRange.addEventListener('change', () =>
          setField(cfg.rotationField, clampN(parseFloat(rotRange.value), 0, -180, 180))
        );
        rotNum.addEventListener('input', () => {
          rotRange.value = rotNum.value;
        });
      }
    }
    stageEl.appendChild(p);
    morePanel = p;
    positionPanelBelow(p, anchor);
    // Anchor the readout drops BELOW the bar (readout sits at the bar's right end).
    const ar = anchor.getBoundingClientRect(),
      sr = stageEl.getBoundingClientRect();
    p.style.left =
      Math.max(6, Math.min(ar.right - sr.left - p.offsetWidth, sr.width - p.offsetWidth - 8)) +
      'px';
  }

  // ── Document info panel: rename the session/file + at-a-glance details ─────────
  // Custom CSS editor panel (plan 112 M4): a highlighted, auto-completing editor bound to
  // the doc-level `customCss` input. setInput (+ onDirty) applies it live to the editor,
  // exports, and presentation, and rides undo/save like any other edit. rAF-coalesced, so
  // per-keystroke re-render is a live preview, not churn.
  function openCssPanel(anchor: HTMLElement): void {
    closeMorePanel();
    const current = String(runtime.getModel().find((i) => i.id === 'customCss')?.value ?? '');
    const p = document.createElement('div');
    p.className = 'fc-panel fc-css-panel';
    p.innerHTML =
      `<div class="fc-panel-head">${t('Custom CSS')}</div>` +
      `<div class="fc-css-hint">${t('Applies to the editor, exports, and presentation. Target .lolly-box, a frame with [data-frame-id], or a present state like .pr-active.')}</div>` +
      '<div class="fc-css-mount"></div>';
    p.addEventListener('pointerdown', (e) => e.stopPropagation());
    stageEl.appendChild(p);
    morePanel = p;
    positionPanelBelow(p, anchor);
    mountCssEditor(p.querySelector<HTMLElement>('.fc-css-mount')!, {
      value: current,
      ariaLabel: t('Custom CSS'),
      placeholder: '.lolly-box { … }',
      onChange: (v) => {
        onDirty?.('customCss');
        runtime.setInput('customCss', v);
      },
    });
  }

  // Per-frame present `state` panel (plan 112 M4): a one-field editor for a selected
  // frame's state tokens. Commits on change (blur), not per keystroke - state has no live
  // editor effect (it themes present mode), so there is no reason to churn the boxes array.
  function openFrameStatePanel(anchor: HTMLElement, frameIdx: number): void {
    closeMorePanel();
    const cur = String(getBoxes()[frameIdx]?.['state'] ?? '');
    const p = document.createElement('div');
    p.className = 'fc-panel fc-fstate-panel';
    p.innerHTML =
      `<div class="fc-panel-head">${t('Frame state')}</div>` +
      `<div class="fc-css-hint">${t('Space-separated tokens for present mode. Stamped as data-frame-state on the frame - target them in Custom CSS, e.g. [data-frame-state~="dark"] .lolly-box { … }. Also lifted onto the presenter root while this slide is active.')}</div>` +
      `<input type="text" class="fc-fstate-input field-input" value="${escapeHtml(cur)}" placeholder="dark title-slide" spellcheck="false" autocomplete="off" autocapitalize="off">`;
    p.addEventListener('pointerdown', (e) => e.stopPropagation());
    stageEl.appendChild(p);
    morePanel = p;
    positionPanelBelow(p, anchor);
    const input = p.querySelector<HTMLInputElement>('.fc-fstate-input');
    input?.addEventListener('change', () => {
      const boxes = getBoxes();
      if (frameIdx < boxes.length)
        commit(boxes.map((b, i) => (i === frameIdx ? { ...b, state: input.value } : b)));
    });
    input?.focus();
  }

  // Per-box CSS class names (plan 112 M4): the author's handle for Custom CSS. Commits on
  // change (blur) like the frame-state panel - the hook re-renders the box with the new
  // class list, and the doc-level Custom CSS rules then apply live.
  function openBoxClassPanel(anchor: HTMLElement, boxIdx: number): void {
    closeMorePanel();
    const cur = String(getBoxes()[boxIdx]?.['cls'] ?? '');
    const p = document.createElement('div');
    p.className = 'fc-panel fc-fstate-panel';
    p.innerHTML =
      `<div class="fc-panel-head">${t('CSS class')}</div>` +
      `<div class="fc-css-hint">${t('Space-separated class names for this box (a–z, 0–9, -, _). Target them in Custom CSS, e.g. .callout { outline: 2px solid red }, on the canvas, in exports and while presenting. Names beginning lolly- pr- seq- fc- belong to the app and are dropped.')}</div>` +
      `<input type="text" class="fc-fstate-input field-input" value="${escapeHtml(cur)}" placeholder="callout hero" spellcheck="false" autocomplete="off" autocapitalize="off">`;
    p.addEventListener('pointerdown', (e) => e.stopPropagation());
    stageEl.appendChild(p);
    morePanel = p;
    positionPanelBelow(p, anchor);
    const input = p.querySelector<HTMLInputElement>('.fc-fstate-input');
    input?.addEventListener('change', () => {
      const boxes = getBoxes();
      if (boxIdx < boxes.length)
        commit(boxes.map((b, i) => (i === boxIdx ? { ...b, cls: input.value } : b)));
    });
    input?.focus();
  }

  // Speaker notes (plan 112 M5): a multi-line note the presenter reads while this slide is
  // active in the speaker view - never rendered on the slide the audience sees.
  function openSpeakerNotesPanel(anchor: HTMLElement, frameIdx: number): void {
    closeMorePanel();
    const cur = String(getBoxes()[frameIdx]?.[FRAME_NOTES_FIELD] ?? '');
    const p = document.createElement('div');
    p.className = 'fc-panel fc-notes-panel';
    p.innerHTML =
      `<div class="fc-panel-head">${t('Speaker notes')}</div>` +
      `<div class="fc-css-hint">${t('Shown only in the speaker view (press S while presenting) while this slide is active. Never rendered on the slide itself.')}</div>` +
      `<textarea class="fc-notes-input field-input" rows="5" spellcheck="true" placeholder="${escapeHtml(t('What to say on this slide…'))}">${escapeHtml(cur)}</textarea>`;
    p.addEventListener('pointerdown', (e) => e.stopPropagation());
    stageEl.appendChild(p);
    morePanel = p;
    positionPanelBelow(p, anchor);
    const input = p.querySelector<HTMLTextAreaElement>('.fc-notes-input');
    input?.addEventListener('change', () => {
      const boxes = getBoxes();
      if (frameIdx < boxes.length)
        commit(
          boxes.map((b, i) => (i === frameIdx ? { ...b, [FRAME_NOTES_FIELD]: input.value } : b))
        );
    });
    input?.focus();
  }

  // Morph match (plan 112 M5): the explicit pairing key for the morph slide
  // transition. Two boxes on different slides carrying the SAME tag morph into each
  // other, overriding the implicit matching (identical text, or the same image).
  function openMorphMatchPanel(anchor: HTMLElement, boxIdx: number): void {
    closeMorePanel();
    const cur = String(getBoxes()[boxIdx]?.['matchOf'] ?? '');
    const p = document.createElement('div');
    p.className = 'fc-panel fc-fstate-panel';
    p.innerHTML =
      `<div class="fc-panel-head">${t('Morph match')}</div>` +
      `<div class="fc-css-hint">${t('Give this box and its partner on another slide the same tag; the morph slide transition then moves between them. Boxes with identical text or the same image already match on their own - the tag overrides that.')}</div>` +
      `<input type="text" class="fc-fstate-input field-input" value="${escapeHtml(cur)}" placeholder="hero" spellcheck="false" autocomplete="off" autocapitalize="off">`;
    p.addEventListener('pointerdown', (e) => e.stopPropagation());
    stageEl.appendChild(p);
    morePanel = p;
    positionPanelBelow(p, anchor);
    const input = p.querySelector<HTMLInputElement>('.fc-fstate-input');
    input?.addEventListener('change', () => {
      const boxes = getBoxes();
      if (boxIdx < boxes.length)
        commit(boxes.map((b, i) => (i === boxIdx ? { ...b, matchOf: input.value.trim() } : b)));
    });
    input?.focus();
  }

  function openInfoPanel(anchor: HTMLElement): void {
    closeMorePanel();
    const d = canvasWH();
    const fname = info?.getFilename?.() ?? '';
    const p = document.createElement('div');
    p.className = 'fc-panel fc-info-panel';
    p.innerHTML =
      `<div class="fc-panel-head">${t('Document')}</div>` +
      `<label class="fc-row"><span>${t('Name')}</span><input type="text" data-info="filename" value="${escapeHtml(fname)}" placeholder="${escapeHtml(t('Untitled'))}"></label>` +
      '<div class="fc-info-meta">' +
      `<div class="fc-info-line"><span>${t('Last edited')}</span><b data-info-edited>…</b></div>` +
      `<div class="fc-info-line"><span>${t('Canvas')}</span><b>${d.w} × ${d.h} px</b></div>` +
      (info?.name
        ? `<div class="fc-info-line"><span>${t('Tool')}</span><b>${escapeHtml(info!.name)}${info!.version ? ' · v' + escapeHtml(info!.version) : ''}</b></div>`
        : '') +
      (info?.status
        ? `<div class="fc-info-line"><span>${t('Status')}</span><b>${escapeHtml(info!.status)}</b></div>`
        : '') +
      (info?.formats?.length
        ? `<div class="fc-info-line"><span>${t('Exports')}</span><b>${info!.formats!.map(escapeHtml).join(', ')}</b></div>`
        : '') +
      '</div>' +
      // Provenance: what travels in the exported file's metadata. Read-only display +
      // an opt in/out toggle; the name/contact are edited in the profile.
      (info?.provenance
        ? `<div class="fc-panel-head fc-info-sub">${t('Embedded in exports')}</div>` +
          `<label class="fc-row fc-row-toggle field-toggle"><span>${t('Credit me')}</span><input type="checkbox" class="field-check" data-info="optin" disabled></label>` +
          '<div class="fc-info-meta">' +
          `<div class="fc-info-line"><span>${t('Made with')}</span><b>Lolly · lolly.tools</b></div>` +
          `<div class="fc-info-line" data-prov="author" hidden><span>${t('Name')}</span><b></b></div>` +
          `<div class="fc-info-line" data-prov="contact" hidden><span>${t('Contact')}</span><b></b></div>` +
          '<div class="fc-info-note" data-prov="note"></div>' +
          '</div>'
        : '');
    p.addEventListener('pointerdown', (e) => e.stopPropagation());
    const fn = p.querySelector<HTMLInputElement>('[data-info="filename"]');
    fn?.addEventListener('input', () => info?.setFilename?.(fn!.value));
    stageEl.appendChild(p);
    morePanel = p;
    positionPanelBelow(p, anchor);
    // Last-edited resolves async (reads the saved session's timestamp).
    Promise.resolve(info?.lastEdited?.())
      .then((iso) => {
        const el = p.querySelector<HTMLElement>('[data-info-edited]');
        if (el) el.textContent = iso ? fmtDate(iso) : t('Not saved yet');
      })
      .catch(() => {});
    // Provenance section fills async (reads the profile) then wires the opt-in toggle.
    const prov = info?.provenance;
    if (prov) {
      const optin = p.querySelector<HTMLInputElement>('[data-info="optin"]');
      const authorRow = p.querySelector<HTMLElement>('[data-prov="author"]');
      const contactRow = p.querySelector<HTMLElement>('[data-prov="contact"]');
      const note = p.querySelector<HTMLElement>('[data-prov="note"]');
      const editLink = prov.editHref
        // nosemgrep: lolly-href-escape-is-not-scheme-validation - editHref's only caller passes the literal '#/profile?focus=use-details' (views/tool.ts)
        ? ` <a href="${escapeHtml(prov.editHref)}">${t('Edit details')}</a>`
        : '';
      const paint = (optedIn: boolean, author: string, contact: string): void => {
        if (optin) optin.checked = optedIn;
        if (authorRow) {
          authorRow.hidden = !(optedIn && author);
          authorRow.querySelector('b')!.textContent = author;
        }
        if (contactRow) {
          contactRow.hidden = !(optedIn && contact);
          contactRow.querySelector('b')!.textContent = contact;
        }
        if (note) {
          note.innerHTML = optedIn
            ? author || contact
              ? t('Baked into your PNG, PDF & SVG file metadata.')
              : tRaw('No name on file yet -{action} to be credited.', {
                  action: editLink || ` ${t('add your details in your profile')}`,
                })
            : tRaw('Your name &amp; contact stay off your files.{link}', { link: editLink });
        }
      };
      prov
        .get()
        .then(({ optedIn, author, contact }) => {
          if (optin) optin.disabled = false;
          paint(optedIn, author, contact);
          optin?.addEventListener('change', () => {
            const on = optin.checked;
            paint(on, author, contact); // reflect immediately
            optin.disabled = true;
            Promise.resolve(prov.setOptIn(on))
              .catch(() => {
                optin.checked = !on;
                paint(!on, author, contact);
              }) // revert on failure
              .finally(() => {
                optin.disabled = false;
              });
          });
        })
        .catch(() => {});
    }
  }

  // ── field editing (applies to all selected boxes) ────────────────────────────
  function setField(field: string | undefined, value: any): void {
    if (!field) return;
    const boxes = getBoxes();
    const idx = selIndices(boxes);
    const sel = new Set(idx);
    const next = boxes.map((b, i) => (sel.has(i) ? { ...b, [field]: value } : b));
    // Recolouring a path is what teaches the pen its next paint. Every paint control on
    // both bars (and the whole stroke panel) writes through here, so this is the one place
    // that has to notice - and it is gated on the selection being ALL paths so restyling a
    // text box or an image can't hand the pen a fill that means nothing for a curve.
    if (idx.length > 0 && selectionAllPaths(boxes, idx)) {
      const remembered = pickPathPaint(penPaintFields, next[idx[0]!]);
      if (remembered) penLastPaint = remembered;
    }
    commit(next);
  }
  // Is this box a circle? (An ellipse the geometry keeps square - see setShape.)
  const isCircle = (b: Box | undefined): boolean =>
    !!cfg.shapeField && String(b?.[cfg.shapeField]) === 'circle';
  // Set the shape on the selection. "circle" additionally squares each box to its
  // smaller side about its centre (an inscribed circle), in the SAME commit as the
  // shape change (one undo step) - otherwise a w≠h box would render as an ellipse and
  // the label would lie. Any other shape writes straight through.
  function setShape(v: string | undefined): void {
    if (!cfg.shapeField) return;
    if (v !== 'circle' || !cfg.wField || !cfg.hField) {
      setField(cfg.shapeField, v);
      return;
    }
    const boxes = getBoxes();
    const sel = new Set(selIndices(boxes));
    commit(
      boxes.map((b, i) => {
        if (!sel.has(i)) return b;
        const w = Math.max(1, num(b[cfg.wField], 1));
        const h = Math.max(1, num(b[cfg.hField], 1));
        const d = Math.round(Math.min(w, h));
        const cx = num(b[cfg.xField], 0) + w / 2;
        const cy = num(b[cfg.yField], 0) + h / 2;
        return {
          ...b,
          [cfg.shapeField]: 'circle',
          [cfg.wField]: d,
          [cfg.hField]: d,
          [cfg.xField]: Math.round(cx - d / 2),
          [cfg.yField]: Math.round(cy - d / 2),
        };
      })
    );
  }
  function bumpFont(delta: number): void {
    if (!cfg.fontSizeField) return;
    const boxes = getBoxes();
    const sel = new Set(selIndices(boxes));
    commit(
      boxes.map((b, i) => {
        if (!sel.has(i)) return b;
        const cur = parseFloat(String(b[cfg.fontSizeField]));
        const base = Number.isFinite(cur) ? cur : 48;
        return { ...b, [cfg.fontSizeField]: Math.max(4, base + delta) };
      })
    );
  }
  // `segHtml`, `POS9`/`posGridHtml` and `wireSegs` used to live here as closures over
  // `setField`. They are ./free-canvas-fields.ts's now (plans/179 M3), so the Design
  // inspector column renders the same rows from the same builder - and `wireSegs` takes
  // an explicit `onSet` at every call site, because a shared builder that writes through
  // one panel's closure by default is not shared.
  // ── Text panel: font · size · weight · line height · align · vertical · padding ─
  // In editor layout there is NO sidebar, so this panel is the only place these
  // typographic properties (several of which were previously unreachable) can be
  // set. Every control shows and writes the selected box's current value.
  function openTextPanel(anchor: HTMLElement): void {
    closeMorePanel();
    const boxes = getBoxes();
    const idx = selIndices(boxes);
    if (!idx.length) return;
    const b: Box = boxes[idx[0]!] || {};
    const fontCur = String(b[cfg.fontField] || defaultFont);
    const sizeCur = Math.max(1, Math.round(parseFloat(String(b[cfg.fontSizeField])) || 48));
    const weightCur = String(b[cfg.weightField] || '700');
    const lhRaw = parseFloat(String(b[cfg.lineHeightField]));
    const lhCur = Number.isFinite(lhRaw) ? lhRaw : 1.12;
    // Defaults here MUST match hooks.js textCss so the panel shows the real rendered
    // value for a box that hasn't set the field yet (pad defaults to 8, not 0).
    const padRaw = parseFloat(String(b[cfg.padField]));
    const padCur = Math.max(0, Math.round(Number.isFinite(padRaw) ? padRaw : 8));
    const trRaw = parseFloat(String(b[cfg.trackingField]));
    const trCur = Number.isFinite(trRaw) ? trRaw : 0;
    const ligCur = boolOf(b[cfg.ligaturesField], true);
    const altCur = boolOf(b[cfg.alternatesField], false);
    const fitCur = boolOf(b[cfg.fitTextField], false);
    const alignCur = String(b[cfg.alignField] || 'center');
    const valignCur = String(b[cfg.valignField] || 'middle');
    const p = document.createElement('div');
    p.className = 'fc-panel fc-text-panel';
    p.innerHTML =
      `<div class="fc-panel-head">${t('Text')}</div>` +
      (cfg.fontField
        ? `<label class="fc-row"><span>${t('Font')}</span><select class="field-select field-select--sm" data-tp="font">${fontOptionsHtml(fontCur)}</select></label>`
        : '') +
      // Size row now carries the A−/A+ steppers (moved off the object bar) around the number.
      (cfg.fontSizeField
        ? `<div class="fc-row"><span>${t('Size')}</span><div class="fc-stepper">
        <button type="button" class="fc-cbtn" data-tp="smaller" data-tip="${escape(t('Smaller'))}" aria-label="${escape(t('Smaller text'))}">A−</button>
        <input type="number" min="4" max="2000" data-tp="size" value="${sizeCur}">
        <button type="button" class="fc-cbtn" data-tp="bigger" data-tip="${escape(t('Bigger'))}" aria-label="${escape(t('Bigger text'))}">A+</button>
      </div></div>`
        : '') +
      (cfg.weightField
        ? `<label class="fc-row"><span>${t('Weight')}</span><select class="field-select field-select--sm" data-tp="weight">${weightChoicesFor(
            fontCur
          )
            .map(([v, l]) => opt(v, t(l), weightCur))
            .join('')}</select></label>`
        : '') +
      (cfg.lineHeightField
        ? `<label class="fc-row"><span>${t('Line height')}</span><input type="range" class="field-range" min="0.7" max="3" step="0.01" data-tp="lh" value="${lhCur}"><b data-tp-val="lh">${lhCur.toFixed(2)}</b></label>`
        : '') +
      (cfg.trackingField
        ? `<label class="fc-row"><span>${t('Letter spacing')}</span><input type="range" class="field-range" min="-20" max="100" step="0.5" data-tp="tr" value="${trCur}"><b data-tp-val="tr">${trCur}</b></label>`
        : '') +
      (cfg.ligaturesField
        ? `<label class="fc-row fc-row-toggle field-toggle"><span>${t('Ligatures')}</span><input type="checkbox" class="field-check" data-tp="lig"${ligCur ? ' checked' : ''}></label>`
        : '') +
      (cfg.alternatesField
        ? `<label class="fc-row fc-row-toggle field-toggle"><span>${t('Alternates')}</span><input type="checkbox" class="field-check" data-tp="alt"${altCur ? ' checked' : ''}></label>`
        : '') +
      // Shrink-to-fit: on → the text scales down to fit the box (never up); off → the box
      // grows to the text (the default). See the hooks.js fit pass driven by data-fit.
      (cfg.fitTextField
        ? `<label class="fc-row fc-row-toggle field-toggle"><span>${t('Shrink text to fit')}</span><input type="checkbox" class="field-check" data-tp="fit"${fitCur ? ' checked' : ''}></label>`
        : '') +
      (cfg.alignField
        ? `<div class="fc-row"><span>${t('Align')}</span>${segHtml(cfg.alignField, alignCur, [
            ['left', t('Align left'), SVG.textL],
            ['center', t('Align centre'), SVG.textC],
            ['right', t('Align right'), SVG.textR],
          ])}</div>`
        : '') +
      (cfg.valignField
        ? `<div class="fc-row"><span>${t('Vertical')}</span>${segHtml(cfg.valignField, valignCur, [
            ['top', t('Align top'), SVG.textT],
            ['middle', t('Centre vertically'), SVG.textM],
            ['bottom', t('Align bottom'), SVG.textB],
          ])}</div>`
        : '') +
      (cfg.padField
        ? `<label class="fc-row"><span>${t('Padding')}</span><input type="range" class="field-range" min="0" max="200" data-tp="pad" value="${padCur}"><b data-tp-val="pad">${padCur}</b></label>`
        : '');
    p.addEventListener('pointerdown', (e) => e.stopPropagation());
    p.querySelector<HTMLButtonElement>('[data-tp="smaller"]')?.addEventListener('click', () => {
      bumpFont(-6);
      const s = p.querySelector<HTMLInputElement>('[data-tp="size"]');
      if (s) s.value = String(Math.max(4, (parseInt(s.value, 10) || 48) - 6));
    });
    p.querySelector<HTMLButtonElement>('[data-tp="bigger"]')?.addEventListener('click', () => {
      bumpFont(6);
      const s = p.querySelector<HTMLInputElement>('[data-tp="size"]');
      if (s) s.value = String((parseInt(s.value, 10) || 48) + 6);
    });
    p.querySelectorAll<HTMLSelectElement>('select[data-tp]').forEach((sel) =>
      sel.addEventListener('change', () => {
        if (sel.dataset.tp !== 'font') {
          setField(cfg.weightField, sel.value);
          return;
        }
        // Font change: mono cuts have no 900, so clamp any Black boxes to 800 in
        // the SAME commit (one undo step), then refresh the weight menu to match.
        const font = sel.value;
        const bx = getBoxes();
        const selSet = new Set(selIndices(bx));
        commit(
          bx.map((row, k) => {
            if (!selSet.has(k)) return row;
            const nb = { ...row, [cfg.fontField]: font };
            if (
              cfg.weightField &&
              isMonoFont(font) &&
              (parseInt(String(nb[cfg.weightField]), 10) || 700) > 800
            )
              nb[cfg.weightField] = '800';
            return nb;
          })
        );
        const wSel = p.querySelector<HTMLSelectElement>('select[data-tp="weight"]');
        if (wSel) {
          const cur = Math.min(parseInt(wSel.value, 10) || 700, maxWeightFor(font));
          wSel.innerHTML = weightChoicesFor(font)
            .map(([v, l]) => opt(v, t(l), String(cur)))
            .join('');
        }
      })
    );
    p.querySelectorAll<HTMLInputElement>('input[type="number"][data-tp]').forEach((inp) =>
      inp.addEventListener('change', () => {
        const v = parseInt(inp.value, 10);
        if (Number.isFinite(v) && v >= 4) setField(cfg.fontSizeField, v);
      })
    );
    p.querySelectorAll<HTMLInputElement>('input[type="range"][data-tp]').forEach((rng) =>
      rng.addEventListener('input', () => {
        const k = rng.dataset.tp;
        const valEl = p.querySelector<HTMLElement>(`[data-tp-val="${k}"]`);
        if (k === 'lh') {
          if (valEl) valEl.textContent = (+rng.value).toFixed(2);
          setField(cfg.lineHeightField, +rng.value);
        } else if (k === 'tr') {
          if (valEl) valEl.textContent = rng.value;
          setField(cfg.trackingField, +rng.value);
        } else {
          if (valEl) valEl.textContent = rng.value;
          setField(cfg.padField, +rng.value);
        }
      })
    );
    const cbField: Record<string, string> = {
      lig: cfg.ligaturesField,
      alt: cfg.alternatesField,
      fit: cfg.fitTextField,
    };
    p.querySelectorAll<HTMLInputElement>('input[type="checkbox"][data-tp]').forEach((cb) =>
      cb.addEventListener('change', () => {
        setField(cbField[cb.dataset.tp!], cb.checked);
      })
    );
    wireSegs(p, (field, v) => setField(field, v));
    stageEl.appendChild(p);
    morePanel = p;
    const ar = anchor.getBoundingClientRect();
    const sr = stageEl.getBoundingClientRect();
    p.style.left = Math.max(6, Math.min(ar.left - sr.left, sr.width - p.offsetWidth - 8)) + 'px';
    p.style.top =
      Math.max(6, Math.min(ar.bottom - sr.top + 8, sr.height - p.offsetHeight - 8)) + 'px';
  }
  // `initialTab` is the picker pane this add-kind should OPEN on (picker.ts's
  // PickerOpts.initialTab - a default the user can leave immediately, not a lock):
  // 'tools' for the Tool kind, 'library' for the media kinds, whose `pickType` has
  // already narrowed the library to just the assets that fit.
  async function pickImage(pickOpts?: {
    pickType?: 'lottie' | 'video' | 'audio';
    initialTab?: 'library' | 'tools';
  }): Promise<void> {
    if (!cfg.imageField || !host.assets?.pick) return;
    const pickType = pickOpts?.pickType;
    const boxes0 = getBoxes();
    const first: Box = boxes0[selIndices(boxes0)[0]!] || {};
    // The box's current image, viewed as an asset ref (the image field holds one).
    const curImg = first[cfg.imageField] as
      | { id?: string; meta?: { toolUrl?: string; name?: string } }
      | undefined;
    // A box already filled by a live Lolly render: ask edit-or-replace before
    // opening the picker (same choice-first flow as the sidebar image slots).
    const curToolUrl = curImg?.meta?.toolUrl;
    if (curToolUrl && editTool) {
      // Lazy: picker.ts pulls in the picker's own CSS chunk, and the overlay only needs
      // it on this one branch - a static import would ship (and evaluate) it for every
      // editor mount.
      const { askLollyIntent } = await import('./picker.ts');
      const intent = await askLollyIntent(curImg?.meta?.name);
      if (!intent) return;
      if (intent === 'edit') {
        try {
          const edited = await editTool(curToolUrl, 'edit');
          if (!edited) return;
          const boxes = getBoxes();
          const sel = new Set(selIndices(boxes));
          commit(boxes.map((b, i) => (sel.has(i) ? { ...b, [cfg.imageField]: edited } : b)));
        } catch {
          /* user cancelled */
        }
        return;
      }
    }
    try {
      const ref = await host.assets!.pick({
        title:
          pickType === 'video'
            ? t('Choose a video')
            : pickType === 'lottie'
              ? t('Choose an animation')
              : pickType === 'audio'
                ? t('Choose a sound')
                : pickOpts?.initialTab === 'tools'
                  ? t('Choose a tool')
                  : t('Choose an image'),
        // No type constraint by default: boxes take rasters AND vectors - logos and
        // the themable two-colour icons (with the picker's theme strip) included, plus
        // animated rasters (gif/apng/webp, which are type:'raster'). The "Animation" /
        // "Video" add-kinds constrain the picker to lottie / video respectively; each
        // renders as a live player once placed (mediaHtmlFor dispatches on asset type).
        ...(pickType ? { type: pickType } : {}),
        // Open on the pane that matches what the user asked to add (see the note on
        // this function). Omitted → the picker's own default (Library).
        ...(pickOpts?.initialTab ? { initialTab: pickOpts.initialTab } : {}),
        allowUpload: true,
        current: curImg?.id,
        // A box image that's already a Lolly render surfaces the picker's
        // edit-the-current-tool banner (inputs pre-filled) - the box's only
        // route back into the source tool, since boxes have no Edit badge.
        currentToolUrl: curImg?.meta?.toolUrl,
        currentToolName: curImg?.meta?.name,
        // Choosing a Lolly link or a saved creation opens its inputs first so the
        // user can set values (configure → insert), reusing the sidebar's editor.
        editTool,
      });
      if (!ref) return;
      const boxes = getBoxes();
      const sel = new Set(selIndices(boxes));
      commit(boxes.map((b, i) => (sel.has(i) ? { ...b, [cfg.imageField]: ref } : b)));
    } catch {
      /* user cancelled */
    }
  }

  // Cut the background out of the single selected image box on-device (host.matte)
  // and drop the cutout back over that box - the exact tail of pickImage, so the
  // result is an ordinary image ref with alpha, its original preserved as a C2PA
  // ingredient. Lazy chunk (matte-dialog.ts) like askLollyIntent above.
  //
  // The run is a BACKGROUND job (WP-F): the dialog closes at once and the cutout
  // arrives minutes later, by which time the selection may be somewhere else
  // entirely. So the swap is pinned to the BOX'S OWN ID (plan 100 section 3), never
  // the live selection, and simply doesn't happen if that box is gone - the cutout
  // is a saved asset either way, so nothing is lost.
  async function removeBackgroundOnSelection(): Promise<void> {
    const imageField = cfg.imageField;
    if (!imageField) return;
    const boxes0 = getBoxes();
    const idxs = selIndices(boxes0);
    if (idxs.length !== 1) return;
    const at0 = idxs[0]!;
    const box = boxes0[at0]!;
    const cur = box[imageField] as
      | { id?: string; url?: string; meta?: { name?: string } }
      | undefined;
    if (!cur || (!cur.id && !cur.url)) return; // no image to cut out
    const boxId = idOf(box, at0);
    try {
      const { openMatteDialog } = await import('./matte-dialog.ts');
      await openMatteDialog(host as unknown as MatteHost, {
        source: cur as unknown as MatteSource,
        sourceName: cur.meta?.name,
        onComplete: (cutout) => {
          const boxes = getBoxes();
          const at = indexOfId(boxes, boxId);
          if (at < 0) return; // that box is gone - leave the canvas alone
          commit(boxes.map((b, i) => (i === at ? { ...b, [imageField]: cutout } : b)));
        },
      });
    } catch {
      /* cancelled or unavailable */
    }
  }

  // ── outline text ─────────────────────────────────────────────────────────────
  // Convert selected text boxes' glyphs into ordinary kind:'path' boxes (plan 88 -
  // the Font Outliner capability, in place). Measurement + shaping live in the lazy
  // outline-text.ts chunk, which reuses the export walk's line machinery; here is
  // only the model surgery: source box → per-fill path boxes at the same z, one
  // commit, refusal-first (a box that can't be outlined faithfully is left alone
  // and said so, never partially converted).

  function isOutlinableTextBox(b: Box): boolean {
    const kind = String(b[cfg.kindField] ?? '');
    if (kind === 'path' || kind === 'audio') return false;
    return Boolean(cfg.textField && String(b[cfg.textField] ?? '').trim());
  }

  /** A box that paints something besides its text (fill, gradient, image, or a
   *  border) keeps its frame; only the text leaves it. A bare text box is replaced
   *  outright. The border matters because a non-path box renders strokeW>0 + a stroke
   *  colour as a CSS border on the frame, and the glyph path boxes deliberately clear
   *  their stroke - so without keeping the frame a bordered label would silently lose
   *  its border on outline. */
  function paintsBesidesText(b: Box): boolean {
    const bg = cfg.fillField ? String(b[cfg.fillField] ?? '').trim() : '';
    const grad = cfg.gradField ? String(b[cfg.gradField] ?? '').trim() : '';
    const img = cfg.imageField
      ? (b[cfg.imageField] as { id?: string; url?: string } | undefined)
      : undefined;
    const border =
      num(b[cfg.strokeWField], 0) > 0 && String(b[cfg.strokeField] ?? '').trim() !== '';
    return Boolean(bg || grad || (img && (img.id || img.url)) || border);
  }

  // Re-entrancy guard: the action reads the live DOM across awaits (fonts, shaping)
  // before its one synchronous commit. Two overlapping runs both measuring the
  // pre-commit DOM could, for a box KEPT because it also paints (paintsBesidesText),
  // splice a second copy of the same glyphs. The menu button self-destructs on click
  // so this isn't reachable through the current dispatch, but the guard is a cheap,
  // future-proof invariant for an async mutator.
  let outliningInFlight = false;
  async function outlineTextOnSelection(): Promise<void> {
    if (outliningInFlight) return;
    outliningInFlight = true;
    try {
      await runOutlineTextOnSelection();
    } finally {
      outliningInFlight = false;
    }
  }
  async function runOutlineTextOnSelection(): Promise<void> {
    if (!vectorCfg || !cfg.textField) return;
    const textApi = (host as unknown as HostV1).text;
    if (!textApi) return;
    const boxes0 = getBoxes();
    const srcIds = selIndices(boxes0)
      .filter((i) => isOutlinableTextBox(boxes0[i]!))
      .map((i) => idOf(boxes0[i], i));
    if (!srcIds.length) return;

    const { outlineBoxText, rotatedFrameShift } = await import('./outline-text.ts');
    const rectToNative = (r: DOMRect): { x: number; y: number; w: number; h: number } => {
      const { cr, scale } = metrics();
      return {
        x: (r.left - cr.left) / scale,
        y: (r.top - cr.top) / scale,
        w: r.width / scale,
        h: r.height / scale,
      };
    };

    // Settle fonts AND layout ONCE, up front - before touching any box DOM. A pending
    // webfont load resolves here, and the template's fit pass (which re-runs on
    // document.fonts.ready and rewrites --fit → font-size → line wrapping) gets two
    // paint frames to finish. If we awaited this per box instead, a font-load could
    // move the box between the query and the measurement, so the captured element is
    // stale and the shaped glyphs land at the wrong size/place (or a repaint drops the
    // result). After this, each box is queried fresh and measured with no await between.
    try {
      await document.fonts?.ready;
    } catch {
      /* no Font Loading API */
    }
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

    const results = new Map<string, OutlineGroup[]>();
    let firstRefusal: string | null = null;
    for (const id of srcIds) {
      const el = canvasEl.querySelector<HTMLElement>(`.lolly-box[data-box-id="${cssEscape(id)}"]`);
      const textEl = el?.querySelector<HTMLElement>('.lolly-box-text');
      if (!el || !textEl) {
        firstRefusal ??= 'no-text';
        continue;
      }
      try {
        const res = await outlineBoxText(el, textEl, textApi, rectToNative);
        if (res.ok) results.set(id, res.groups);
        else firstRefusal ??= res.reason;
      } catch {
        firstRefusal ??= 'empty';
      }
    }

    // The model may have moved while shaping - re-read and apply by id, one commit.
    // `kfField` and `zField` ride along with the timing (plans/104, the M1-flagged
    // gap): a clip on screen 2s..5s stays 2s..5s, and a clip that was FLYING stays
    // flying - outlining its text must not quietly un-animate it, or drop it back to
    // the floor. Both are per-box authored values with no cross-box identity (unlike
    // `linkOf`, which is deliberately absent from this list), and the keyframe
    // channels are relative offsets, so a glyph box inherits the motion correctly
    // wherever the outlining put it.
    const timeCarry = timeCfg
      ? [
          timeCfg.startField,
          timeCfg.durField,
          timeCfg.clipInField,
          timeCfg.speedField,
          timeCfg.enterField,
          timeCfg.exitField,
          timeCfg.enterMsField,
          timeCfg.exitMsField,
          timeCfg.muteField,
          timeCfg.laneField,
          timeCfg.enterEaseField,
          timeCfg.exitEaseField,
          timeCfg.kfField,
          timeCfg.zField,
        ].filter((f): f is string => Boolean(f))
      : [];
    const shadowCarry = [
      cfg.shadowColorField,
      cfg.shadowXField,
      cfg.shadowYField,
      cfg.shadowBlurField,
    ].filter(Boolean) as string[];
    let next = getBoxes();
    const nextSel = new Set<string>();
    let outlined = 0;
    for (const [srcId, groups] of results) {
      const at = next.findIndex((b, i) => idOf(b, i) === srcId);
      if (at < 0) continue;
      const src = next[at]!;
      // Keep the source frame (only the text leaves it) when it also paints a fill/
      // gradient/image/border; a bare text box is replaced outright. Decided once here
      // because it also governs shadow carry below.
      const keepSource = paintsBesidesText(src);
      const rot = num(src[cfg.rotationField], 0);
      const scx = num(src[cfg.xField], 0) + num(src[cfg.wField], 0) / 2;
      const scy = num(src[cfg.yField], 0) + num(src[cfg.hField], 0) / 2;
      const made: Box[] = [];
      let failed = false;
      // Outlining now yields one box PER GLYPH, so the letters are GROUPED to stay a word:
      // keep the source's own group if it had one (respect existing structure), else mint a
      // fresh shared group when there is more than one box. A lone glyph needs no group.
      const madeGroup = cfg.groupField
        ? src[cfg.groupField]
          ? String(src[cfg.groupField])
          : groups.length > 1
            ? freshGroupId(next)
            : ''
        : '';
      for (const g of groups) {
        const pb = pathToBox(g.path, src, { cfg: vectorCfg, id: freshId(next.concat(made)) });
        // Only the node ceiling gets here (finite, non-empty geometry by construction)
        // - too much text for one encodable shape. Refuse the whole box.
        if (!pb) {
          failed = true;
          break;
        }
        // A path box's fill field paints the GLYPHS; the text box's fill was its
        // background. pathToBox inherited the latter - override with the run colour.
        if (cfg.fillField) pb[cfg.fillField] = g.fill;
        pb[cfg.strokeField] = '';
        pb[cfg.strokeWField] = 0;
        pb[cfg.fillRuleField] = 'nonzero';
        // Shadow: only carry it onto the glyphs when the source is REPLACED. If the
        // frame is kept (keepSource), it still paints the box's own shadow, so copying
        // it onto each glyph too would double it. And any carried shadow becomes
        // 'content' (a drop-shadow following the glyph silhouette): 'text' has nothing
        // to attach to once the text is geometry, and 'box' would otherwise draw a
        // rectangle around each colour group's bounding box - never what was intended.
        // Timing fields always carry (a clip on screen 2s..5s stays 2s..5s) - but never
        // linkOf: duplicating a detach-audio link id would corrupt its link group.
        const shadowField = cfg.shadowField;
        if (!keepSource && shadowField) {
          const sh = src[shadowField];
          if (sh !== undefined && sh !== '' && sh !== 'none') {
            pb[shadowField] = 'content';
            for (const f of shadowCarry) if (src[f] !== undefined) pb[f] = src[f];
          }
        }
        for (const f of timeCarry) if (src[f] !== undefined) pb[f] = src[f];
        // Group membership: every glyph box of one source shares `madeGroup` (its old group
        // if it had one, else a fresh one for the word), so the letters move together and
        // the replace/keep-source branches match replaceBoxes (which only fills group when
        // unset) instead of orphaning glyphs when the group later moves.
        if (cfg.groupField && madeGroup) pb[cfg.groupField] = madeGroup;
        if (rot) {
          const cx = num(pb[cfg.xField], 0) + num(pb[cfg.wField], 0) / 2;
          const cy = num(pb[cfg.yField], 0) + num(pb[cfg.hField], 0) / 2;
          const { dx, dy } = rotatedFrameShift(scx, scy, cx, cy, rot);
          pb[cfg.xField] = num(pb[cfg.xField], 0) + dx;
          pb[cfg.yField] = num(pb[cfg.yField], 0) + dy;
          pb[cfg.rotationField] = rot;
        }
        made.push(pb);
      }
      if (failed || !made.length) {
        firstRefusal ??= 'too-complex';
        continue;
      }
      if (keepSource) {
        next = next.map((b, i) => (i === at ? { ...b, [cfg.textField as string]: '' } : b));
        next = [...next.slice(0, at + 1), ...made, ...next.slice(at + 1)];
      } else {
        next = replaceBoxes(next, [srcId], -1, made, { cfg: vectorCfg });
      }
      for (const nb of made) nextSel.add(String(nb[cfg.idField]));
      outlined++;
    }

    if (!outlined) {
      flash(
        firstRefusal === 'not-visible'
          ? t(
              'This clip is not on screen at the current playhead. Move to it, then outline its text.'
            )
          : firstRefusal === 'no-font'
            ? t('No font file could be resolved for this text, so it was left as it is.')
            : firstRefusal === 'notdef'
              ? t('The font cannot draw some of these characters, so the text was left as it is.')
              : firstRefusal === 'too-complex'
                ? t('There is too much text to outline in one shape, so it was left as it is.')
                : t('Nothing in this selection can be outlined.')
      );
      return;
    }
    selection = nextSel;
    commit(next);
    const skipped = srcIds.length - outlined;
    flash(
      (outlined === 1
        ? t('Text outlined. It is now a shape and can no longer be edited as text.')
        : t('{n} text boxes outlined. They are now shapes and can no longer be edited as text.', {
            n: outlined,
          })) +
        (skipped
          ? ' ' +
            (skipped === 1
              ? t('One selected item could not be outlined and was left as it is.')
              : t('{n} selected items could not be outlined and were left as they are.', {
                  n: skipped,
                }))
          : '')
    );
  }

  // ── grouping + clip/mask ──────────────────────────────────────────────────────
  // A group TAG, not a row identity: it is compared for equality between boxes of this
  // one document, so it keeps its short per-mount form (freshId moved to ULIDs because a
  // ROW is what a remote op addresses - see plan 100 section 3). Its own counter since that
  // move; two peers grouping at the same millisecond can still mint the same tag, which
  // would merge two unrelated groups - a convergence snag for the collab wave, not this one.
  let groupSeq = 0;
  function freshGroupId(boxes: Box[]): string {
    const used = new Set(boxes.map((b) => groupOf(b)).filter(Boolean));
    let g: string;
    do {
      g = 'g' + Date.now().toString(36).slice(-4) + (groupSeq++).toString(36);
    } while (used.has(g));
    return g;
  }
  function groupSelection(): void {
    if (!cfg.groupField) return;
    const boxes = getBoxes();
    const idx = selIndices(boxes);
    if (idx.length < 2) return;
    const g = freshGroupId(boxes);
    const set = new Set(idx);
    commit(boxes.map((b, i) => (set.has(i) ? { ...b, [cfg.groupField]: g } : b)));
  }
  function ungroupSelection(): void {
    if (!cfg.groupField) return;
    const boxes = getBoxes();
    const set = new Set(selIndices(boxes));
    if (boxes.some((b, i) => set.has(i) && groupOf(b))) {
      commit(boxes.map((b, i) => (set.has(i) && groupOf(b) ? { ...b, [cfg.groupField]: '' } : b)));
      return;
    }
    // Nothing tagged: an imported vector is the other kind of group (below).
    const targets = unpackTargetIds(boxes);
    if (targets.length) void unpackSvgBoxes(targets);
  }

  /**
   * The selected boxes an Ungroup would take APART rather than untag: each holds an SVG
   * and carries no group of its own. An imported vector is a group in every sense but
   * the field - it was drawn as parts and arrives as one picture - so Ungroup on it does
   * what Ungroup does everywhere else and separates the parts: one box per layer of the
   * drawing, cropped to its ink, sharing a fresh group so the whole still selects and
   * moves as one until the next Ungroup peels that too (Andy, 2026-09-02: "importing
   * vectors as images into design should allow groups to be ungrouped"). Every derived
   * part is itself a standalone SVG, so the peel repeats down to the leaves.
   *
   * Lift layers is the same enumeration with a different intent - a depth ladder and a
   * shadow for a camera move, behind a confirm - so the two share `liftRows` and differ
   * only in `flat` (and in the hero heuristic, see `unpackSvgBoxes`).
   */
  function unpackTargetIds(boxes: Box[]): string[] {
    if (!cfg.imageField || !cfg.groupField) return [];
    return selIndices(boxes)
      .filter((i) => !groupOf(boxes[i]) && isSvgImageRef(boxes[i]?.[cfg.imageField]))
      .map((i) => idOf(boxes[i], i));
  }
  /** Is Ungroup live for this selection - a group to dissolve, or a vector to take apart? */
  const canUngroup = (): boolean => selHasGroup() || unpackTargetIds(getBoxes()).length > 0;

  /**
   * Take the SVG boxes `ids` apart into their layers - ONE commit for all of them, so one
   * ⌘Z puts every picture back. Every read and every asset store happens BEFORE the
   * commit (runLift's rule): a failure part-way leaves the board exactly as it was.
   * The model is re-read after the awaits and each source found by ID, never by the
   * index the action started with.
   */
  async function unpackSvgBoxes(ids: string[]): Promise<void> {
    if (!cfg.imageField || !cfg.groupField) return;
    announce(t('Ungrouping…'));
    try {
      const [
        { fetchAnimSvg },
        { enumerateSvgLayers, svgRootViewBox },
        { storeUserUpload },
        { KF_Z_FIELD_CLAMP },
      ] = await Promise.all([
        import('./anim-svg-mount.ts'),
        import('../../../../engine/src/svg-layers.ts'),
        import('./picker.ts'),
        import('../../../../engine/src/keyframes.ts'),
      ]);
      interface Part {
        layers: SvgLayerPlan[];
        refs: InputValue[];
        viewBox: SvgSourceBox;
      }
      const parts = new Map<string, Part>();
      let single = 0;
      for (const id of ids) {
        const boxes = getBoxes();
        const src = boxes[indexOfId(boxes, id)];
        const ref = src?.[cfg.imageField] as { url?: unknown } | undefined;
        const url = typeof ref?.url === 'string' ? ref.url : '';
        if (!src || !url) continue;
        const markup = await fetchAnimSvg(url);
        if (disposed) return;
        const place = {
          viewBox: svgRootViewBox(markup),
          fit: String(src[cfg.fitField] ?? 'contain'),
        };
        const cropToInk = liftCanCrop(src, cfg, place);
        const cropScale = liftCropScale(src, cfg, place) || undefined;
        // `heroDescent: false`: an Ungroup peels ONE level of the drawing's own structure,
        // the way every vector editor's does, so it is predictable and it repeats. The
        // hero heuristic belongs to the Lift dialog, where one big layer means a
        // flythrough over a picture; here it would be a second, unasked-for peel.
        const { layers, viewBox } = enumerateSvgLayers(markup, {
          heroDescent: false,
          cropToInk,
          cropScale,
        });
        if (layers.length < 2) {
          single++;
          continue;
        }
        const base = liftBaseName(ref);
        const refs: InputValue[] = [];
        for (let i = 0; i < layers.length; i++) {
          const file = new File([layers[i]!.markup], `${base}-part-${i + 1}.svg`, {
            type: 'image/svg+xml',
          });
          refs.push(
            (await storeUserUpload(
              host as unknown as Parameters<typeof storeUserUpload>[0],
              file
            )) as unknown as InputValue
          );
        }
        if (disposed) return;
        parts.set(id, { layers, refs, viewBox });
      }
      if (!parts.size) {
        flash(
          single
            ? t('This artwork is a single shape, so there is nothing to ungroup.')
            : t('That artwork could not be read.')
        );
        return;
      }
      let scratch = getBoxes();
      const newIds: string[] = [];
      for (const [id, part] of parts) {
        const at = indexOfId(scratch, id);
        if (at < 0) continue; // gone while it was being read - the others still apply
        const source = scratch[at]!;
        // Ids are minted against a GROWING array, so no two rows can collide.
        const rowIds: string[] = [];
        let minted = scratch;
        for (let i = 0; i < part.layers.length; i++) {
          const rid = freshId(minted);
          rowIds.push(rid);
          minted = [...minted, { [cfg.idField]: rid } as Box];
        }
        const rows = liftRows(
          source,
          part.layers.map((L, i) => ({
            src: String((part.refs[i] as { url?: unknown } | null)?.url ?? ''),
            id: rowIds[i]!,
            crop: L.viewBox ?? null,
            bbox: L.bbox ?? null,
          })),
          { ...cfg, zField: cv.zField || '' },
          {
            zClamp: KF_Z_FIELD_CLAMP,
            group: freshGroupId(scratch),
            viewBox: part.viewBox,
            fit: String(source[cfg.fitField] ?? 'contain'),
            flat: true,
          }
          // The whole ref, not the URL string - the same reason runLift gives: the engine
          // resolves a block's asset sub-field by `.id` and the hook reads `image.url`.
        ).map((row, i) => ({ ...row, [cfg.imageField]: part.refs[i] }));
        scratch = applyLift(scratch, at, rows);
        newIds.push(...rowIds);
      }
      if (!newIds.length) {
        flash(t('That artwork is no longer on the canvas, so nothing was changed.'));
        return;
      }
      selection = new Set(newIds);
      commit(scratch);
      flash(t('Ungrouped into {n} parts.', { n: newIds.length }));
    } catch (e) {
      console.error(e);
      if (!disposed) flash(t('Those parts could not be separated, so nothing was changed.'));
    }
  }
  // Clip: the LOWEST selected box (bottom of the stack) is the mask; every higher
  // selected box is clipped to its shape. They're grouped so the mask + content
  // travel together (Figma-style mask group).
  function clipSelection(): void {
    if (!cfg.clipField) return;
    const boxes = getBoxes();
    const idx = selIndices(boxes)
      .slice()
      .sort((a, b) => a - b);
    if (idx.length < 2) return;
    const maskId = idOf(boxes[idx[0]!], idx[0]!);
    const clipSet = new Set(idx.slice(1));
    const allSet = new Set(idx);
    const g = cfg.groupField ? freshGroupId(boxes) : '';
    commit(
      boxes.map((b, i) => {
        if (!allSet.has(i)) return b;
        const nb = { ...b };
        if (clipSet.has(i)) nb[cfg.clipField] = maskId;
        if (cfg.groupField) nb[cfg.groupField] = g;
        return nb;
      })
    );
  }
  function releaseClip(): void {
    if (!cfg.clipField) return;
    const boxes = getBoxes();
    const set = new Set(selIndices(boxes));
    if (!boxes.some((b, i) => set.has(i) && b[cfg.clipField])) return;
    commit(
      boxes.map((b, i) => (set.has(i) && b[cfg.clipField] ? { ...b, [cfg.clipField]: '' } : b))
    );
  }
  const selHasGroup = () => {
    const bx = getBoxes();
    return selIndices(bx).some((i) => groupOf(bx[i]));
  };
  const selHasClip = () => {
    const bx = getBoxes();
    return cfg.clipField && selIndices(bx).some((i) => bx[i]![cfg.clipField]);
  };

  // ── z-order / align / distribute ─────────────────────────────────────────────
  function applyZ(op: string): void {
    const boxes = getBoxes();
    const idx = selIndices(boxes);
    if (!idx.length) return;
    commit(reorderZ(boxes, idx, op as ZOp));
  }
  function applyAlign(edge: string): void {
    const boxes = getBoxes();
    const idx = selIndices(boxes);
    if (!idx.length) return;
    commit(alignBoxes(boxes, idx, edge as AlignEdge, cfg, canvasWH()));
  }
  function applyDistribute(axis: string): void {
    const boxes = getBoxes();
    const idx = selIndices(boxes);
    if (idx.length < 3) return;
    commit(distributeBoxes(boxes, idx, axis as Axis, cfg));
  }

  /**
   * Mirror the selection horizontally ('h') or vertically ('v'). The flip is a per-box
   * boolean the tool's hooks.js folds into the box transform as a NEGATIVE SCALE about the
   * box centre (transform-origin 50% 50%) - so it mirrors the artwork itself, on the canvas
   * AND in every export (the vector walkers read that inline transform as a 2-D affine and
   * keep the mirror; see engine's isAxisAlignedMat), not just the on-canvas preview.
   *
   * TOGGLES each box's own flag, so the action is its own inverse and a mixed selection
   * (some already flipped) un-flips those and flips the rest. Mirror-IN-PLACE per box: a
   * multi-box flip mirrors every member about ITS OWN centre, not the selection's combined
   * bounds - each box keeps its position and turns over in place. Group-bounds
   * mirroring would have to move boxes (reflect each centre across the selection midline)
   * and re-bucket frames; per-box mirror needs neither and never surprises the user with a
   * box that jumped. One commit for the whole selection - one undo step. No-op on a tool
   * that declares no flip fields (`canFlip`).
   */
  function applyFlip(axis: 'h' | 'v'): void {
    if (!canFlip) return;
    const field = axis === 'h' ? FLIP_H_FIELD : FLIP_V_FIELD;
    const boxes = getBoxes();
    const sel = new Set(selIndices(boxes));
    if (!sel.size) return;
    commit(boxes.map((b, i) => (sel.has(i) ? { ...b, [field]: !boolOf(b[field], false) } : b)));
  }

  /** How far to the right of the original a duplicated artboard sits - the same 56px
   *  gutter the carousel migration and the import layout put between pages. */
  const FRAME_DUP_GAP = 56;

  /** Fields of a copied row that POINT AT another box, so a deep copy has to repoint them
   *  when the target came along in the same copy. `matchOf` is listed for completeness -
   *  it is a free-text morph TAG, not an id, so it only ever re-keys in the pathological
   *  case where someone typed a box id as their tag; an ordinary tag ("hero") is left
   *  alone, which is what lets a slide and its duplicate morph into each other. */
  const dupRefFields = (): string[] =>
    [cfg.clipField, cv.linkField, cfg.bindStartField, cfg.bindEndField, 'matchOf'].filter(
      (f): f is string => !!f
    );

  function duplicateSelection(): void {
    const boxes = getBoxes();
    const idx = selIndices(boxes);
    if (!idx.length) return;
    // plans/179 A8 - duplicating an ARTBOARD duplicates what is on it. Cloning the frame
    // row alone left an empty page appended last, and because `resolveFrame` answers with
    // the LAST containing frame, the next gesture on any child of the ORIGINAL re-bucketed
    // it into that empty duplicate. The deep copy fixes both halves: the children come
    // along with fresh ids, and the copy is placed clear to the RIGHT so no rect overlaps.
    //
    // Gated on a LONE frame: a mixed selection has no single answer for where the copy
    // goes, and a frame copy moves a whole page rather than nudging a box by 24px.
    const fk = frameCfg?.frameKind;
    if (frameCfg && fk && idx.length === 1 && String(boxes[idx[0]!]?.[cfg.kindField]) === fk) {
      const ff = frameFields();
      const seeded = seedFrameOrders(boxes, ff); // A9: legacy docs get an order first
      const pool: Box[] = seeded.slice();
      const res = duplicateFrameWithChildren(
        seeded,
        idOf(boxes[idx[0]!], idx[0]!),
        ff,
        {
          // Each minted id joins the pool, so two children can never draw the same one.
          id: () => {
            const id = freshId(pool);
            pool.push({ [cfg.idField]: id } as Box);
            return id;
          },
          group: () => freshGroupId(pool),
        },
        { gap: FRAME_DUP_GAP, groupField: cfg.groupField, refFields: dupRefFields() }
      );
      if (res.frameId) {
        selection = new Set([res.frameId]); // the new PAGE, not its contents
        commit(res.boxes);
        return;
      }
    }
    const clones: Box[] = [];
    const nextSel = new Set<string>();
    const pool = boxes.slice();
    for (const i of idx) {
      const id = freshId(pool.concat(clones));
      const r = boxRect(boxes[i], cfg);
      const clone = {
        ...boxes[i],
        [cfg.idField]: id,
        [cfg.xField]: Math.round(r.x + 24),
        [cfg.yField]: Math.round(r.y + 24),
      };
      clones.push(clone);
      nextSel.add(id);
    }
    selection = nextSel;
    commit([...boxes, ...clones]);
  }
  function deleteSelection(): void {
    const boxes = getBoxes();
    const sel = new Set(selIndices(boxes));
    if (!sel.size) return;
    selection = new Set<string>();
    const fk = frameCfg?.frameKind;
    const deadFrames = fk ? [...sel].filter((i) => String(boxes[i]?.[cfg.kindField]) === fk) : [];
    if (!frameCfg || !deadFrames.length) {
      commit(boxes.filter((_, i) => !sel.has(i)));
      return;
    }
    // plans/179 A7 - deleting an artboard used to orphan its children: they kept pointing
    // at a dead frame id, stayed visible in the editor as scratch, and were absent from
    // every PNG/PDF/PPTX export (the render only walks boxes whose stored `frame` names a
    // live page). They now move to the PREVIOUS artboard keeping their frame-local
    // position, or - when the deleted page was the first one - onto the pasteboard.
    //
    // One commit, so the whole thing is one undo step, and A9's renumber rides along in
    // it: the pages that remain are densely re-ordered, so deleting slide 2 makes slide 3
    // slide 2 rather than leaving a hole for the x tie-break to guess at.
    const ff = frameFields();
    const seeded = seedFrameOrders(boxes, ff);
    // EVERY doomed row, not only the artboards. A child that is itself in the delete is
    // dropped by index one line below, so counting it as re-homed made the toast say
    // "its 12 items are now on the pasteboard" of a document Cmd+A had just emptied.
    // `rehomeChildrenOfDeletedFrames` skips any row whose own id is in the set, and a
    // non-frame id matches no page, so widening it only narrows the tally.
    const deadIds = [...sel].map((i) => idOf(boxes[i], i)).filter(Boolean);
    const res = rehomeChildrenOfDeletedFrames(seeded, deadIds, ff);
    const survivors = res.boxes.filter((_, i) => !sel.has(i)); // index-aligned with `boxes`
    const seq = framesInPageOrder(survivors, ff).map((b) => String(b[cfg.idField] ?? ''));
    commit(renumberFrameOrder(survivors, seq, ff));
    // One sentence, and it names the outcome the user has to go looking for. With both
    // outcomes in one delete (several artboards at once, the first among them) the
    // pasteboard is the one worth saying: homed items are where you would expect them.
    if (res.orphaned) {
      flash(
        res.orphaned === 1
          ? t('Deleted artboard. Its one item is now on the pasteboard.')
          : t('Deleted artboard. Its {n} items are now on the pasteboard.', { n: res.orphaned })
      );
    } else if (res.homed) {
      flash(
        res.homed === 1
          ? t('Deleted artboard. Its one item moved to the previous artboard.')
          : t('Deleted artboard. Its {n} items moved to the previous artboard.', { n: res.homed })
      );
    }
  }

  // ── vector operations (opt-in via canvas.pathField) ───────────────────────────
  // The geometry itself lives in vector-ops.ts (pure, DOM-free, engine-backed); this is
  // only the menu wiring: gather the operands, run the op, and commit ONE model write.
  //
  // Failure never half-edits the model - `run` is called first and nothing is committed
  // unless it answered `ok:true`.

  /** Curve-fitting tolerance for Simplify, in native canvas px. Sub-pixel, so the result
   *  is visually the same path with fewer nodes; not exposed as a prompt because the
   *  useful range is narrow and "fewer nodes, same shape" is the whole request. */
  const SIMPLIFY_TOL = 0.6;

  /** How many selected boxes satisfy `pred`, in z-order. */
  function countSelected(pred: (b: Box) => boolean): number {
    const boxes = getBoxes();
    return selIndices(boxes).reduce((n, i) => (pred(boxes[i]!) ? n + 1 : n), 0);
  }

  /** The selection as vector operands: array order is Z-ORDER (bottom first), which is
   *  what every operation in vector-ops.ts documents - Subtract's base is operand 0. */
  function vectorOperands(): { boxes: Box[]; operands: Box[]; ids: string[] } {
    const boxes = getBoxes();
    const idx = selIndices(boxes);
    return { boxes, operands: idx.map((i) => boxes[i]!), ids: idx.map((i) => idOf(boxes[i], i)) };
  }

  /**
   * A refusal the user can read.
   *
   * vector-ops.ts does not import i18n at all - its `message` is diagnostic English
   * for a log - so the translated sentence is owned here and keyed on `reason`.
   *
   * `empty-result` is the interesting one, and it is NOT an error: an intersection of two
   * shapes that do not overlap is legitimately empty, and so is an inward offset deeper
   * than the shape's own inradius. This REFUSES AND SAYS SO rather than deleting the
   * operands. Deleting them is defensible - Illustrator's Intersect does exactly that -
   * but on screen an empty result and a no-op are the same picture, so the destructive
   * reading of an ambiguous gesture would remove the user's artwork and leave nothing
   * behind to explain where it went. Stating the answer in words costs one more tap and
   * never loses work.
   */
  function vectorFailureMessage(res: VectorOpFailure, empty?: string): string {
    switch (res.reason) {
      case 'too-complex':
        // The kernel's GeomLimitError: the answer exists, the engine declines to guess it
        // rather than hand back a plausible-looking wrong shape. That has to be said.
        return t(
          'These shapes are too intricate to combine exactly. Simplify them first, or combine fewer at a time.'
        );
      case 'no-outline':
        return t('Text and image boxes have no outline to work with. Select shapes or pen paths.');
      case 'needs-two':
        return t('Select two or more shapes to combine them.');
      case 'not-applicable':
        return t('Only pen paths can be simplified.');
      case 'empty-result':
        return empty || t('That would leave nothing to draw, so the shapes were left as they are.');
      case 'bad-input':
        return t('One of the selected shapes has a path that cannot be read.');
      default:
        return t('That could not be worked out, so nothing was changed.');
    }
  }

  /** The empty-result sentence for each boolean. Union of non-empty regions cannot be
   *  empty, so it falls through to the generic line. */
  function boolEmptyMessage(op: BooleanOpName): string | undefined {
    if (op === 'intersect')
      return t('Those shapes do not overlap, so there is nothing to keep. Nothing was changed.');
    if (op === 'difference')
      return t(
        'The shapes above cover the bottom one completely, so nothing is left. Nothing was changed.'
      );
    if (op === 'xor')
      return t('Those shapes overlap exactly, so nothing is left. Nothing was changed.');
    return undefined;
  }

  interface RunVectorOpts {
    /** simplifyBoxes returns one box PER OPERAND, each of which keeps its own place in
     *  the stack - so the result is applied operand by operand instead of as one swap. */
    each?: boolean;
    /** Mention boxes the operation left alone (text/image have no outline). */
    skipNote?: boolean;
    /** Override the `empty-result` sentence for this operation. */
    empty?: string;
  }

  function runVectorOp(
    run: (operands: Box[], id: string) => VectorOpResult,
    opts: RunVectorOpts = {}
  ): void {
    if (!vectorCfg) return;
    const { boxes, operands, ids } = vectorOperands();
    if (!operands.length) return;
    const res = run(operands, freshId(boxes));
    if (!res.ok) {
      flash(vectorFailureMessage(res, opts.empty));
      return;
    }

    const nextSel = new Set<string>();
    let next: Box[];
    if (opts.each) {
      // res.boxes lines up 1:1 with the operands NOT in `skipped`, in operand order.
      const skipped = new Set(res.skipped);
      const targets = operands.map((_, k) => k).filter((k) => !skipped.has(k));
      next = boxes;
      for (let k = 0; k < res.boxes.length; k++) {
        const at = targets[k];
        if (at === undefined) break;
        const nb: Box = { ...res.boxes[k]! };
        // Only the first result carries the id we minted; the rest are ours to allocate
        // (checked against the array as it grows, so two results never collide).
        const nid =
          nb[cfg.idField] != null && nb[cfg.idField] !== ''
            ? String(nb[cfg.idField])
            : freshId(next);
        nb[cfg.idField] = nid;
        next = replaceBoxes(next, [ids[at]!], -1, nb, { cfg: vectorCfg });
        nextSel.add(nid);
      }
    } else {
      next = replaceBoxes(boxes, ids, -1, res.boxes, { cfg: vectorCfg });
      for (const b of res.boxes) {
        const v = b[cfg.idField];
        if (v != null && v !== '') nextSel.add(String(v));
      }
    }
    if (!nextSel.size) {
      flash(vectorFailureMessage({ ok: false, reason: 'internal', message: 'no result id' }));
      return;
    }
    selection = nextSel;
    commit(next);
    if (opts.skipNote && res.skipped.length) {
      flash(
        res.skipped.length === 1
          ? t('One selected item has no outline, so it was left as it is.')
          : t('{n} selected items have no outline, so they were left as they are.', {
              n: res.skipped.length,
            })
      );
    }
  }

  // Outline stroke - the width defaults to the topmost operand's OWN stroke width, which
  // is the stroke the user is looking at.
  function askOutlineStroke(): void {
    if (!vectorCfg) return;
    const { operands } = vectorOperands();
    const seed = Math.max(0.1, num(operands[operands.length - 1]?.[cfg.strokeWField], 1));
    askNumber({
      at: lastMenuAt,
      title: t('Outline stroke'),
      hint: t('Replace the stroke with a filled shape of the same outline.'),
      value: Math.round(seed * 100) / 100,
      min: 0.1,
      step: 0.5,
      confirm: t('Outline'),
      apply: (v) =>
        runVectorOp((ops, id) => strokeBoxesToPath(ops, { cfg: vectorCfg, id, width: v }), {
          skipNote: true,
        }),
    });
  }

  // Offset - no `min` on the field, because a negative distance is an inset and that is
  // half of what this control is for.
  function askOffsetPath(): void {
    if (!vectorCfg) return;
    askNumber({
      at: lastMenuAt,
      title: t('Offset path'),
      hint: t('Grow the shape outwards. A negative distance shrinks it inwards.'),
      value: 8,
      step: 1,
      confirm: t('Offset'),
      apply: (v) =>
        runVectorOp((ops, id) => offsetBoxes(ops, v, { cfg: vectorCfg, id }), {
          skipNote: true,
          empty: t('Shrinking by that much removes the shape completely. Nothing was changed.'),
        }),
    });
  }

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
  let penDrawKind: SplineKind = PEN_DEFAULT_KIND;

  /** One set of spline-type names for every surface that offers them - the pen bar's
   *  `<select>` and the rail button's hold menu. Built per call rather than frozen at
   *  module load so a language switch renames them. */
  function penKindLabels(): Record<string, string> {
    return {
      hyperbezier: t('Smooth (auto)'),
      spiro: t('Spiro'),
      cubic: t('Bezier handles'),
      'catmull-rom': t('Through the points'),
      bspline: t('B-spline'),
      line: t('Straight lines'),
    };
  }

  /**
   * The spline type, chosen from the rail BEFORE anything is drawn.
   *
   * Until this existed the switcher only appeared in the pen bar, which only appears once
   * there is a draft - so choosing the type meant drawing a path in the wrong one first
   * and converting, and `hyperbezier → cubic` is the only conversion that is lossless.
   * Picking up the pen already knowing what you want to draw is the normal case for
   * tracing, so it gets a normal path to it.
   */
  function openPenKindMenu(anchor: HTMLElement): void {
    const labels = penKindLabels();
    spawnPopover(
      anchor,
      PEN_KINDS.map((k) => ({
        label: labels[k] || k,
        on: k === penDrawKind,
        run: () => setPenDrawKind(k),
      }))
    );
  }

  /** Choose the type and arm the pen, so the menu leaves you ready to draw rather than
   *  back where you started. An in-progress draft follows the choice, exactly as it does
   *  from the pen bar's own switcher. */
  function setPenDrawKind(to: SplineKind): void {
    penDrawKind = to;
    if (penDraft) {
      penDraft = { ...penDraft, kind: to };
      penWarm = null;
    }
    if (mode !== 'pen') setMode('pen');
    else renderChrome();
    announce(tRaw('Spline type: {name}', { name: penKindLabels()[to] || to }));
  }

  const penScale = (): number => metrics().scale || 1;
  const penTol = (): number => PEN_HIT_PX / penScale();

  // Entering/leaving pen mode. Neither is called directly - `setMode` owns the transition,
  // which is what guarantees the other three modes are down before this one is up.
  function enterPen(): void {
    deselectEdge();
    selection = new Set<string>();
    stageEl.classList.add('fc-penning');
    announce(
      t(
        'Pen on - click to place points, drag to curve them, click the first point to close. Enter finishes, Esc cancels.'
      )
    );
    renderChrome();
  }
  function exitPen(): void {
    penDraft = null;
    penCursor = null;
    penWarm = null;
    stageEl.classList.remove('fc-penning');
    clearGuides();
    renderChrome();
  }

  // ── drawing ───────────────────────────────────────────────────────────────────

  /** Place a node at a (already snapped) native point and start the drag that pulls its
   *  handles out. `corner` is the Alt modifier - see the button's tooltip. */
  function penPlaceNode(e: PointerEvent, at: Point, corner: boolean): void {
    const kind = penDraft ? penDraft.kind : penDrawKind;
    const nodes = penDraft ? penDraft.nodes.slice() : [];
    nodes.push({ x: at.x, y: at.y, continuity: corner ? 'corner' : defaultContinuity(kind) });
    penDraft = { kind, nodes, closed: false };
    penCursor = null;
    penPullBroken = corner; // Alt held at placement arms the break for the drag that follows
    beginGesture(e, { type: 'pendraw', origin: at, index: nodes.length - 1 });
    paintPen();
    syncPenChrome();
  }

  /** Drop the last placed node (Backspace/Delete while drawing). The last one leaving
   *  ends the draw, because an empty draft is not a draft. */
  function penUndoNode(): void {
    if (!penDraft) return;
    const nodes = penDraft.nodes.slice(0, -1);
    if (!nodes.length) {
      penDraft = null;
      penCursor = null;
      penWarm = null;
      renderChrome();
      return;
    }
    penDraft = { ...penDraft, nodes, closed: false };
    penWarm = null; // the node count changed, so the warm start is stale
    renderChrome();
  }

  /**
   * End the draw and commit - ONE `setInput`, so one undo step removes the whole path.
   *
   * A draft with fewer than two nodes commits nothing: a single click with the pen selected
   * is a mis-click, and materialising a one-node box for it would leave the user something
   * invisible to find and delete.
   */
  function penFinishDraw(): void {
    const draft = penDraft;
    penDraft = null;
    penCursor = null;
    penWarm = null;
    clearGuides();
    if (!draft) {
      renderChrome();
      return;
    }
    if (!commitPathBox(draft)) renderChrome();
  }

  /**
   * A finished authored path → a committed path box. ONE `setInput`, so one undo step
   * removes the whole thing.
   *
   * Extracted from `penFinishDraw` for plan 96 P2: the Line tool draws the same primitive
   * with a different gesture (one drag, two nodes) and must land the same box - same
   * seeding, same paint fallback, same single commit - or a line would be a second-class
   * shape the moment anyone tried to node-edit or restyle it. `extra` is the per-gesture
   * decoration the line adds on top (its default arrowhead and its empty bindings).
   *
   * Returns false when nothing was committed (fewer than two nodes, an unlowerable kind, a
   * tool with no `pathField`) - the caller's cue to repaint its own chrome.
   */
  function commitPathBox(draft: AuthoredPath, extra?: Box): boolean {
    if (!cfg.pathField) return false;
    const made = penCommitFromNative(draft);
    const value = made ? encodePathField(made.path) : '';
    if (!made || !value) return false;
    const boxes = getBoxes();
    const id = freshId(boxes);
    const pathSeed: Box = { ...(addKinds.find((k) => k.id === 'path')?.seed || {}) };
    // Paint: what the user last used on a path, then this tool's own `path` seed - and
    // nothing else. Other add-kinds are deliberately NOT consulted: a `path` seed's empty
    // fill is a statement ("paths in this brand are stroke-only"), so letting a box seed
    // fill it in would overrule the brand, and where there is no `path` seed at all the
    // nearest kind's colour is chosen for a filled rectangle, not for a curve - Sequence
    // Studio's card is #14181d on a #0b1220 artboard, i.e. invisible. The honest fallback
    // for that case is the ink the path was drawn in, below.
    const seed: Box = {
      ...pathSeed,
      ...pathPaintSeed(penPaintFields, [penLastPaint, pathSeed]),
    };
    // Last resort: stroke it in the colour it was DRAWN in. The preview strokes the draft
    // in `currentColor` off .fc-pen-layer (the brand primary), so this is the shape the user
    // was just looking at rather than an invented hue - and it is resolved to a concrete
    // hex here because a box field has to render headlessly, where a CSS variable cannot.
    if (cfg.strokeField && !pathPaintIsVisible(penPaintFields, seed)) {
      seed[cfg.strokeField] = drawnInkHex();
      if (cfg.strokeWField && !(Number(seed[cfg.strokeWField]) > 0)) seed[cfg.strokeWField] = 4;
    }
    let box = seedBox(
      cfg,
      {},
      seed,
      { x: made.x, y: made.y, w: made.w, h: made.h } as MathRect,
      id
    );
    box[cfg.kindField] = 'path';
    if (cfg.shapeField) box[cfg.shapeField] = 'rect';
    box[cfg.pathField] = value;
    // The gesture's own decoration goes on LAST so it beats the tool's `path` seed: the
    // Line tool's arrowhead is what the user asked for by picking that tool, and a brand
    // seed that says "paths are plain" should not silently take it off.
    if (extra) for (const k of Object.keys(extra)) box[k] = extra[k];
    selection = new Set([id]);
    penLastPaint = pickPathPaint(penPaintFields, box);
    commit([...boxes, box]);
    return true;
  }

  /** The colour the pen preview is drawn in, as a concrete hex - always a usable value, since
   *  a shape in the wrong colour still beats a shape in none. Computed at commit time rather
   *  than cached: the brand, and so this colour, can change mid-session. The resolution is
   *  pure (`resolveDrawnInk`) so it can be tested without a stylesheet, which is also the one
   *  case that reaches its fallback - jsdom applies no CSS, a real browser always resolves. */
  function drawnInkHex(): string {
    try {
      return resolveDrawnInk(getComputedStyle(penLayer).color);
    } catch {
      return resolveDrawnInk(null);
    }
  }

  /** Abandon the draw. Nothing was ever written, so there is nothing to undo. */
  function penCancelDraw(): void {
    penDraft = null;
    penCursor = null;
    penWarm = null;
    clearGuides();
    renderChrome();
  }

  // ── node-edit mode ────────────────────────────────────────────────────────────

  /** Enter node editing on a path box. Entered like `startTextEdit` - a double-click or an
   *  explicit affordance - and left just as explicitly, so ordinary selection behaviour is
   *  never silently different. */
  // ── Multi-contour node editing: combined flat view ↔ per-contour split ─────────
  // Join per-contour paths into ONE combined path (nodes concatenated) + the parts
  // descriptor that splits it back. The combined kind is the first part's - see the
  // penEdit declaration for why that is correct for every producer here.
  function penJoin(paths: AuthoredPath[]): { path: AuthoredPath; parts: PenPart[] } {
    const parts: PenPart[] = paths.map((p) => ({
      count: p.nodes.length,
      kind: p.kind,
      closed: p.closed,
    }));
    const first = paths[0]!;
    return {
      path: { kind: first.kind, closed: first.closed, nodes: paths.flatMap((p) => [...p.nodes]) },
      parts,
    };
  }
  // Split a flat run of nodes back into per-contour paths by the given parts. Used to turn a
  // position-op result (same node count, same parts) back into real contours for the write.
  function penSplitWith(flat: AuthoredPath, parts: PenPart[]): AuthoredPath[] {
    const out: AuthoredPath[] = [];
    let i = 0;
    for (const part of parts) {
      out.push({
        kind: part.kind,
        closed: part.closed,
        nodes: flat.nodes.slice(i, i + part.count),
      });
      i += part.count;
    }
    return out;
  }
  // The current edit's contours as real per-contour paths (render / insert / delete read this).
  function penContours(): AuthoredPath[] {
    return penEdit ? penSplitWith(penEdit.path, penEdit.parts) : [];
  }
  // Cumulative flat start index of each part, and the part a flat node index falls in.
  function penPartStarts(parts: PenPart[]): number[] {
    const starts: number[] = [];
    let acc = 0;
    for (const p of parts) {
      starts.push(acc);
      acc += p.count;
    }
    return starts;
  }

  function startPenEdit(id: string): void {
    if (!cfg.pathField) return;
    if (editing) commitTextEdit();
    if (mode === 'pen') toPointer();
    const boxes = getBoxes();
    const i = indexOfId(boxes, id);
    if (i < 0) return;
    const decoded = decodePathContours(boxes[i]![cfg.pathField]);
    if (!decoded.length) {
      flash(t('That shape has no editable path.'));
      return;
    }
    const frame = penFrame(boxes[i], cfg);
    const local = decoded.map((p) => denormNodes(p, frame.w, frame.h));
    const joined = penJoin(local);
    penEdit = { id, frame, path: joined.path, parts: joined.parts };
    penSel = new Set<number>();
    penHandleSel = new Set<string>();
    penWarm = null;
    selection = new Set([id]);
    stageEl.classList.add('fc-node-editing');
    closeMorePanel();
    closePopover();
    announce(
      t(
        'Editing points - drag a point or its handle, click the curve to add a point, Esc to finish.'
      )
    );
    renderChrome();
  }

  function endPenEdit(): void {
    if (!penEdit) return;
    setPathSvgHidden(false);
    penEdit = null;
    penSel = new Set<number>();
    penHandleSel = new Set<string>();
    penWarm = null;
    stageEl.classList.remove('fc-node-editing');
    clearPenChrome();
    paintPen();
    ctxSelKey = null; // force the ordinary object bar to rebuild
    scheduleSync();
  }

  /** Re-read the edited path from the MODEL, so an undo, a resize or a sibling edit while
   *  node-editing is reflected rather than overwritten by stale local state. Skipped
   *  mid-gesture, where the local path IS the truth until the drop commits. */
  function penSyncFromModel(boxes: Box[]): void {
    if (!penEdit || gesture) return;
    const i = indexOfId(boxes, penEdit.id);
    if (i < 0) {
      endPenEdit();
      return;
    }
    const decoded = decodePathContours(boxes[i]![cfg.pathField]);
    if (!decoded.length) {
      endPenEdit();
      return;
    }
    const frame = penFrame(boxes[i], cfg);
    const local = decoded.map((p) => denormNodes(p, frame.w, frame.h));
    const joined = penJoin(local);
    penEdit = { id: penEdit.id, frame, path: joined.path, parts: joined.parts };
    const n = penEdit.path.nodes.length;
    if ([...penSel].some((k) => k >= n)) penSel = new Set([...penSel].filter((k) => k < n));
    // Handle-selection keys reference node indices; a structural change (insert/delete)
    // reshuffles them, so drop any that no longer point at a live node rather than
    // aligning the wrong control point.
    if ([...penHandleSel].some((key) => Number(key.split(':')[0]) >= n)) {
      penHandleSel = new Set([...penHandleSel].filter((key) => Number(key.split(':')[0]) < n));
    }
  }

  /**
   * One completed edit → one model write, frame REFITTED to the curve.
   *
   * The frame is the curve's tight bounding box - that is the invariant every other part of
   * the editor reads (selection chrome, marquee, align/distribute, group bounds, the export
   * bbox) and the one `hooks.js` clips to. So an edit that put a node or a curve outside the
   * old frame grows it and an edit that pulled the shape inward shrinks it, and either way
   * `refitFrame` compensates the frame's own rotation so the RENDERED shape does not move by
   * a pixel. See `refitFrame` for the rotation and rounding arithmetic.
   *
   * This is the commit, not the drag: refitting per pointermove would make the box chase the
   * cursor. The live gesture paints on the native pen layer with the box's own `<svg>`
   * hidden, so nothing clips in between.
   *
   * Every contour is re-encoded, not just the edited one - see `penEdit`.
   *
   * `next` is the COMBINED path (all contours' nodes flat) that a position op returned - same
   * node count and same parts as `penEdit.path`, so it splits cleanly by the current parts.
   * A STRUCTURAL op (insert/delete/close/convert) that changes the parts calls
   * `penEditWritePaths` directly with the new per-contour array instead.
   */
  function penEditWrite(next: AuthoredPath): void {
    if (!penEdit) return;
    penEditWritePaths(penSplitWith(next, penEdit.parts));
  }
  function penEditWritePaths(all: AuthoredPath[]): void {
    if (!penEdit || !cfg.pathField || !all.length) return;
    // No refit when there is no curve to fit (an unlowerable kind): the old frame is then
    // the only frame there is, and it is better than a frame invented from nothing.
    const fit = refitFrame(all, penEdit.frame, penWarm);
    const frame = fit ? fit.frame : penEdit.frame;
    const paths = fit ? fit.paths : all;
    const value = encodePathFields(paths.map((p) => normNodes(p, frame.w, frame.h)));
    if (!value) {
      flash(t('That edit could not be saved, so nothing was changed.'));
      return;
    }
    const joined = penJoin(paths);
    penEdit = { ...penEdit, frame, path: joined.path, parts: joined.parts };
    const boxes = getBoxes();
    const i = indexOfId(boxes, penEdit.id);
    if (i < 0) {
      endPenEdit();
      return;
    }
    commit(
      boxes.map((b, k) =>
        k === i
          ? {
              ...b,
              [cfg.pathField]: value,
              [cfg.xField]: frame.x,
              [cfg.yField]: frame.y,
              [cfg.wField]: frame.w,
              [cfg.hField]: frame.h,
            }
          : b
      )
    );
  }

  /** The handle under a box-local point, or null. Handles are tested BEFORE nodes: they
   *  are smaller and sit outside the curve, so a node would otherwise shadow one that
   *  happens to be short. */
  function penHandleAt(
    x: number,
    y: number,
    tol: number
  ): { index: number; which: 'in' | 'out' } | null {
    if (!penEdit || !kindReadsHandles(penEdit.path.kind)) return null;
    let best: { index: number; which: 'in' | 'out' } | null = null;
    let bestD = tol;
    penEdit.path.nodes.forEach((n, i) => {
      for (const which of ['in', 'out'] as const) {
        const p = handlePoint(n, which);
        if (!p) continue;
        const d = Math.hypot(p.x - x, p.y - y);
        if (d <= bestD) {
          bestD = d;
          best = { index: i, which };
        }
      }
    });
    return best;
  }

  /** Insert a node where the pointer met the curve. Exact for `cubic` (a de Casteljau
   *  split), on-curve-but-reshaping for the derived kinds - see `insertNodeOnCurve`.
   *  Part-aware: the click may land on any contour, so each is tried and the nearest wins;
   *  the insert reshapes only THAT contour, and the new node's flat index is offset by the
   *  contour's start so the selection lands on it. */
  function penInsertAt(x: number, y: number): void {
    if (!penEdit) return;
    const contours = penContours();
    const starts = penPartStarts(penEdit.parts);
    let best: InsertResult | null = null;
    let bestPart = -1;
    for (let pi = 0; pi < contours.length; pi++) {
      // The warm hyperbezier start belongs to a single active contour; it is only valid
      // when there IS one contour. Multi-contour boxes are cubic, which needs no warm start.
      const res = insertNodeOnCurve(contours[pi]!, x, y, contours.length === 1 ? penWarm : null);
      if (res && (!best || res.distance < best.distance)) {
        best = res;
        bestPart = pi;
      }
    }
    if (!best || bestPart < 0) return;
    penWarm = null; // one more node → the warm start is stale
    penSel = new Set([starts[bestPart]! + best.index]);
    penHandleSel = new Set<string>(); // indices shifted; drop stale handle picks
    penEditWritePaths(contours.map((c, pi) => (pi === bestPart ? best!.path : c)));
  }

  function penDeleteSelected(): void {
    if (!penEdit || !penSel.size) return;
    const contours = penContours();
    const starts = penPartStarts(penEdit.parts);
    // Bucket the flat selection into each contour's own local index set.
    const perPart: Array<Set<number>> = contours.map(() => new Set<number>());
    for (const g of penSel) {
      for (let pi = contours.length - 1; pi >= 0; pi--) {
        if (g >= starts[pi]!) {
          perPart[pi]!.add(g - starts[pi]!);
          break;
        }
      }
    }
    const out: AuthoredPath[] = [];
    let anyDeleted = false;
    for (let pi = 0; pi < contours.length; pi++) {
      const sel = perPart[pi]!;
      const c = contours[pi]!;
      if (!sel.size) {
        out.push(c);
        continue;
      }
      // A wholly-selected contour is dropped outright (an intentional per-glyph erase), as
      // long as another survives (`out.length` guard below). A PARTIAL selection that would
      // orphan a contour under two points keeps it whole instead - the same floor as before.
      if (sel.size >= c.nodes.length) {
        anyDeleted = true;
        continue;
      }
      const nd = deleteNodes(c, sel);
      if (nd) {
        out.push(nd);
        anyDeleted = true;
      } else out.push(c);
    }
    if (!out.length || !anyDeleted) {
      flash(t('A path needs at least two points, so those were kept.'));
      return;
    }
    penWarm = null;
    penSel = new Set<number>();
    penHandleSel = new Set<string>();
    penEditWritePaths(out);
  }

  /**
   * Align / distribute the SELECTED NODES - the same six-plus-two operations the object
   * bar offers, and deliberately the same icons and the same grid shape, because "align
   * left" means the same thing to a user whether the things being aligned are boxes or
   * points. The two never collide: this button only exists while node editing, where
   * `selection` (boxes) is empty by construction.
   *
   * Straightening a traced outline is the reason this button exists. A hand-placed run of points
   * along a straight edge is never actually straight, and the alternative is nudging each
   * one with the arrow keys.
   */
  /** The selection as point refs - nodes ∪ selected control points - for align/distribute. */
  function penPointRefs(): PenPointRef[] {
    const refs: PenPointRef[] = [...penSel].map((i) => ({ node: i }));
    for (const key of penHandleSel) {
      const [i, which] = key.split(':');
      refs.push({ node: Number(i), handle: which as 'in' | 'out' });
    }
    return refs;
  }

  /** The align + distribute grids for the current node/control-point selection, shared by
   *  the node-edit bar's Arrange button and the node right-click menu. `disabled` reflects
   *  the combined count (align ≥2, distribute ≥3) so the SAME items read correctly in a
   *  context menu that stays a constant shape. */
  function penArrangeItems(): PopItem[] {
    const n = penPointRefs().length;
    const align = (edge: NodeAlignEdge): void => {
      if (!penEdit) return;
      penWarm = null; // points moved, so a warm hyperbezier start is stale
      penEditWrite(alignPoints(penEdit.path, penPointRefs(), edge));
    };
    const dist = (axis: 'h' | 'v'): void => {
      if (!penEdit) return;
      penWarm = null;
      penEditWrite(distributePoints(penEdit.path, penPointRefs(), axis));
    };
    return [
      {
        cols: 3,
        grid: [
          {
            label: t('Align left'),
            icon: icon(SVG.alignL),
            run: () => align('left'),
            disabled: n < 2,
          },
          {
            label: t('Align centre'),
            icon: icon(SVG.alignC),
            run: () => align('hcentre'),
            disabled: n < 2,
          },
          {
            label: t('Align right'),
            icon: icon(SVG.alignR),
            run: () => align('right'),
            disabled: n < 2,
          },
          {
            label: t('Align top'),
            icon: icon(SVG.alignT),
            run: () => align('top'),
            disabled: n < 2,
          },
          {
            label: t('Align middle'),
            icon: icon(SVG.alignM),
            run: () => align('vcentre'),
            disabled: n < 2,
          },
          {
            label: t('Align bottom'),
            icon: icon(SVG.alignB),
            run: () => align('bottom'),
            disabled: n < 2,
          },
        ],
      },
      // Evenly spacing three points needs three points.
      {
        cols: 2,
        grid: [
          {
            label: t('Distribute horizontally'),
            icon: icon(SVG.distH),
            run: () => dist('h'),
            disabled: n < 3,
          },
          {
            label: t('Distribute vertically'),
            icon: icon(SVG.distV),
            run: () => dist('v'),
            disabled: n < 3,
          },
        ],
      },
    ];
  }

  function openPenArrangeMenu(anchor: HTMLElement): void {
    if (!penEdit || penPointRefs().length < 2) return;
    spawnPopover(anchor, penArrangeItems());
  }

  /** Right-click menu WHILE node editing: the same align/distribute grids plus delete and
   *  continuity, at the cursor. Selects the node/handle under the pointer first (like the
   *  object menu selects the box under it) so a right-click acts on what it is over. */
  function openPenNodeMenu(clientX: number, clientY: number): void {
    if (!penEdit) return;
    closePopover();
    const nat = clientToNative(clientX, clientY);
    const loc = frameToLocal(penEdit.frame, nat.x, nat.y);
    const tol = penTol();
    const hh = penHandleAt(loc.x, loc.y, tol);
    if (hh) {
      const key = `${hh.index}:${hh.which}`;
      if (!penHandleSel.has(key)) {
        penHandleSel = new Set([key]);
        penSel = new Set<number>();
      }
    } else {
      const ni = nodeAt(penEdit.path, loc.x, loc.y, tol);
      if (ni >= 0 && !penSel.has(ni)) {
        penSel = new Set([ni]);
        penHandleSel = new Set<string>();
      }
    }
    renderChrome();
    const items: PopItem[] = [...penArrangeItems()];
    if (penSel.size && kindReadsHandles(penEdit.path.kind)) {
      items.push({ sep: true });
      items.push({
        cols: 3,
        grid: [
          {
            label: t('Corner point - handles move independently'),
            icon: icon(SVG.contCorner),
            run: () => penSetContinuity('corner'),
          },
          {
            label: t('Smooth point - handles stay in line'),
            icon: icon(SVG.contSmooth),
            run: () => penSetContinuity('smooth'),
          },
          {
            label: t('Symmetric point - handles stay in line and equal'),
            icon: icon(SVG.contSymmetric),
            run: () => penSetContinuity('symmetric'),
          },
        ],
      });
    }
    items.push({ sep: true });
    items.push({
      label: t('Delete the selected points'),
      icon: icon(SVG.trash),
      danger: true,
      disabled: !penSel.size,
      run: () => penDeleteSelected(),
    });
    popover = document.createElement('div');
    popover.className = 'fc-popover fc-context-menu';
    // The rows carry `role="menuitem"`, so the container has to say `menu` - an orphan
    // menuitem tells a screen reader less than a plain button would.
    popover.setAttribute('role', 'menu');
    fillPopover(popover, items);
    popover.addEventListener('pointerdown', (e) => e.stopPropagation());
    popover.addEventListener('keydown', onPopoverKey);
    stageEl.appendChild(popover);
    const sr = stageEl.getBoundingClientRect();
    popover.style.left =
      Math.max(6, Math.min(clientX - sr.left, sr.width - popover.offsetWidth - 6)) + 'px';
    popover.style.top =
      Math.max(6, Math.min(clientY - sr.top, sr.height - popover.offsetHeight - 6)) + 'px';
  }

  function penSetContinuity(c: Continuity): void {
    if (!penEdit || !penSel.size) return;
    penEditWrite(setNodeContinuity(penEdit.path, penSel, c));
  }

  function penToggleClosed(): void {
    if (!penEdit) return;
    penWarm = null; // open↔closed changes the segment count
    // Flip every contour to the SAME new state (based on the first), so a multi-contour box
    // toggles deterministically rather than leaving a mix. Single-contour is the old behaviour.
    const contours = penContours();
    const closed = !contours[0]!.closed;
    penEditWritePaths(contours.map((p) => ({ ...p, closed })));
  }

  /**
   * Switch the edited path's spline kind, warning first when that discards authored work.
   *
   * The asymmetry is `convertKind`'s: to `cubic` bakes the current lowering into explicit
   * handles and is lossless; to `hyperbezier` (or another derived kind) DROPS them and
   * cannot get them back. So the lossy direction asks, in the same `fc-panel` recipe the
   * one-number prompts use - the smallest confirmation this overlay has.
   */
  function penSetKind(to: SplineKind): void {
    if (!penEdit) return;
    const apply = (): void => {
      const warm = penWarm;
      penWarm = null;
      // Convert every contour. The warm start belongs to a single active contour, so it is
      // only passed when there is exactly one; multi-contour boxes are cubic and need none.
      const contours = penContours();
      penEditWritePaths(
        contours.map(
          (p, pi) => convertKind(p, to, pi === 0 && contours.length === 1 ? warm : null).path
        )
      );
    };
    if (!penContours().some((p) => convertKind(p, to).lossy)) {
      apply();
      return;
    }
    askConfirm({
      at: penCtxAnchorPoint(),
      title: t('Discard the handles?'),
      hint: t(
        'This spline works out its own handle lengths, so the ones you set will be dropped. Switching back cannot bring them back.'
      ),
      confirm: t('Discard and switch'),
      apply,
      cancel: () => {
        ctxSelKey = null;
        renderChrome();
      }, // put the menu back on the old kind
    });
  }

  // ── pen preview + node chrome ─────────────────────────────────────────────────

  /** Hide the box's own rendered `<svg>` while a node drag is live, so the (stale) committed
   *  shape does not double up with the pen layer's live one. Mirrors
   *  `setRealConnectorsHidden`; the commit re-renders it anyway. */
  function setPathSvgHidden(hidden: boolean): void {
    if (!penEdit) return;
    const el = canvasEl.querySelector<HTMLElement>(
      `.lolly-box[data-box-id="${cssEscape(penEdit.id)}"] .lolly-box-path`
    );
    if (el) el.style.visibility = hidden ? 'hidden' : '';
  }

  /**
   * Lower a path to SVG path data for the preview, KEEPING the hyperbezier solution as the
   * next frame's warm start.
   *
   * This is why `toCubics(path, warm)` grew that parameter and why the pen path does not use
   * it: `toCubics` throws the solution it computed away, so every frame of a drag would
   * re-converge a 40-node Newton run from the chord-bend guess. Solving here and holding
   * the answer turns each subsequent frame into one or two steps.
   */
  function penPathD(p: AuthoredPath): string {
    const low = lowerAuthored(p, penWarm);
    if (low.solution) penWarm = low.solution;
    return low.cubics.length ? cubicsToD(low.cubics, p.closed) : '';
  }
  /** Cubics → `d`, in native/box-local units. `M` once, then one `C` per curve; the close
   *  is emitted as `Z` only when the contour really is closed, so an open path is not
   *  silently filled. */
  function cubicsToD(cubics: Cubic[], closed: boolean): string {
    const first = cubics[0]!;
    let d = `M${cf2(first[0])} ${cf2(first[1])}`;
    for (const k of cubics)
      d += `C${cf2(k[2])} ${cf2(k[3])} ${cf2(k[4])} ${cf2(k[5])} ${cf2(k[6])} ${cf2(k[7])}`;
    return closed ? d + 'Z' : d;
  }

  /**
   * The arrowheads of the box being node-edited, as an SVG fragment in BOX-LOCAL px (the
   * caller wraps it in the frame transform, so a rotated box's heads rotate with it).
   *
   * Why it is here at all: a node drag hides the box's own `<svg>` and paints this hairline
   * outline instead, so without it the arrowheads blink out for the whole gesture - exactly
   * while you are moving the point one of them sits on. The geometry is the engine's
   * `edgeArrowHead`, the same call the committed render reaches through the host bridge, so
   * the preview head is the head.
   *
   * Heads go on a SINGLE OPEN contour only, matching pathHtmlFor: "the path's ends" is not
   * a thing a multi-contour boolean result or a closed loop has. The ink is `currentColor`
   * (the guide colour of the outline it decorates), not the box's stroke: this is chrome,
   * and a head painted in a stroke colour that happens to match the artboard would vanish.
   * No shaft pullback either - a 1.6px hairline cannot poke through a filled head visibly,
   * and the inset belongs to the committed render, which is what the export reads.
   */
  function penEditHeadsSvg(contours: AuthoredPath[]): string {
    if (!hasHeadCfg || !penEdit || contours.length !== 1 || contours[0]!.closed) return '';
    const boxes = getBoxes();
    const i = indexOfId(boxes, penEdit.id);
    if (i < 0) return '';
    const b = boxes[i] || {};
    const hs = String(b[cfg.headStartField] || 'none');
    const he = String(b[cfg.headEndField] || 'none');
    if (hs === 'none' && he === 'none') return '';
    const low = lowerAuthored(contours[0]!, penWarm);
    if (!low.cubics.length) return '';
    const tips = pathEndPoints(low.cubics);
    const dir = pathEndTangents(low.cubics);
    if (!tips || !dir) return '';
    // The same clamp `pathHeadSize` applies before the engine sizes a head, so the preview
    // head is the committed head at every stroke width, not just under 20.
    const size = Math.max(9, clampN(b[cfg.strokeWField], 2.5, 0.5, 20) * 4);
    return (
      (hs !== 'none'
        ? edgeArrowHead(tips.start, dir.start.x, dir.start.y, size, 'currentColor', hs)
        : '') +
      (he !== 'none' ? edgeArrowHead(tips.end, dir.end.x, dir.end.y, size, 'currentColor', he) : '')
    );
  }

  /** The pen layer: the draft (plus the segment under the cursor) while drawing, and the
   *  edited path's live outline while node-editing. */
  function paintPen(): void {
    if (!penDraft && !penEdit) {
      if (penLayer.style.display !== 'none') {
        penLayer.style.display = 'none';
        penLayer.innerHTML = '';
      }
      return;
    }
    const m = metrics();
    placeNativeLayer(penLayer, m);
    const sw = 1.6 / (m.scale || 1); // constant SCREEN width at any zoom
    let body = '';
    if (penDraft) {
      // The cursor is included as a real node, so the preview is what committing here
      // would actually produce - for a hyperbezier that means the WHOLE run re-solves,
      // which is the honest picture and the reason the warm start matters.
      const preview: AuthoredPath = penCursor
        ? {
            ...penDraft,
            nodes: [
              ...penDraft.nodes,
              { x: penCursor.x, y: penCursor.y, continuity: defaultContinuity(penDraft.kind) },
            ],
          }
        : penDraft;
      const d = penPathD(preview);
      if (d)
        body += `<path d="${escape(d)}" fill="none" stroke="currentColor" stroke-width="${cf2(sw)}" stroke-linejoin="round" stroke-linecap="round"/>`;
    } else if (penEdit) {
      // Every contour is lowered and drawn (the box's own `<svg>` is hidden for the gesture,
      // so any contour left out would just vanish). A LONE contour keeps the warm hyperbezier
      // start for a smooth live drag; with several they are cubic and lower cold, and a warm
      // solution belongs to a single run anyway. Each keeps its OWN kind + closed via penPathD/
      // the cold lower, so a curve is never drawn ACROSS a contour boundary.
      const contours = penContours();
      const ds = contours
        .map((p) => {
          if (contours.length === 1) return penPathD(p);
          const low = lowerAuthored(p);
          return low.cubics.length ? cubicsToD(low.cubics, p.closed) : '';
        })
        .filter(Boolean);
      const fr = penEdit.frame;
      if (ds.length) {
        const tf =
          `translate(${cf2(fr.x)} ${cf2(fr.y)})` +
          (fr.rot ? ` rotate(${cf2(fr.rot)} ${cf2(fr.w / 2)} ${cf2(fr.h / 2)})` : '');
        body +=
          `<g transform="${tf}"><path d="${escape(ds.join(' '))}" fill="none" stroke="currentColor" stroke-width="${cf2(sw)}" stroke-linejoin="round" stroke-linecap="round"/>` +
          penEditHeadsSvg(contours) +
          '</g>';
      }
    }
    penLayer.innerHTML = body;
    penLayer.style.display = '';
  }

  // ── endpoint binding (plan 96 P3) ─────────────────────────────────────────────
  //
  // Dragging one END of a path onto a box ATTACHES that end to it: the path becomes a
  // connector and the engine routes it from that box's border, re-solving as the box moves.
  // Dragging the same end off every box detaches it and the path is a plain spline again.
  // There is no mode and no separate tool - the gesture is the one the shape suggests, and
  // it is the thing Connect mode used to be (plan 96 P4 deleted that).

  /** Which end of the edited path a node-drag is moving, or undefined when it is not a
   *  single END node (an interior node has nothing to attach; two at once is a reshape).
   *  A CLOSED path has no ends, and a multi-contour path has no single pair of them. */
  function bindEndFor(indices: number[]): 'start' | 'end' | undefined {
    if (!hasBindCfg || !penEdit || indices.length !== 1) return undefined;
    if (penEdit.parts.length !== 1 || penEdit.path.closed) return undefined;
    const i = indices[0]!,
      n = penEdit.path.nodes.length;
    if (n < 2) return undefined;
    return i === 0 ? 'start' : i === n - 1 ? 'end' : undefined;
  }

  /** The box an end node would attach to at this native point: the topmost hit that is not
   *  the path itself and not a frame (a page is a container, not a thing to point at). */
  function bindableAt(x: number, y: number, selfId: string): string | null {
    const boxes = getBoxes();
    const hit = pickTopmost(boxes, x, y, cfg, seqHiddenSkip(boxes));
    if (hit < 0) return null;
    const b = boxes[hit] || {};
    const id = idOf(b, hit);
    if (id === selfId) return null;
    if (frameCfg && String(b[cfg.kindField]) === (frameCfg.frameKind || 'frame')) return null;
    return id;
  }

  /** The snap ring over the box an end would attach to. Drawn in the connector preview
   *  layer (native coordinates, already placed) so it pans and zooms with everything else.
   *  Same dashed outline Connect mode used to put round its pending source card - the
   *  affordance survived the mode. */
  function setBindHover(id: string | null): void {
    if (id === bindHover) return;
    bindHover = id;
    if (!id) {
      if (!penEdit) hideConnectLayer();
      else {
        connectLayer.innerHTML = '';
      }
      return;
    }
    const boxes = getBoxes();
    const i = indexOfId(boxes, id);
    if (i < 0) {
      bindHover = null;
      return;
    }
    const r = boxRect(boxes[i], cfg);
    placeConnectLayer(metrics());
    connectLayer.innerHTML =
      `<rect x="${cf2(r.x - 4)}" y="${cf2(r.y - 4)}" width="${cf2(r.w + 8)}" height="${cf2(r.h + 8)}" rx="10"` +
      ' fill="none" stroke="#30ba78" stroke-width="3" stroke-dasharray="7 5"/>';
    connectLayer.style.display = '';
  }

  /**
   * Write one end's binding - the whole commit, one `setInput`, one undo step.
   *
   * A no-op write is skipped so re-dragging an already-attached end does not mint an undo
   * step that changes nothing. Attaching also seeds a head on the far end when the path has
   * neither: an undecorated connector reads as a divider rather than as a link, and this is
   * the moment the user said "this points at that".
   */
  function applyBinding(id: string, which: 'start' | 'end', to: string): void {
    const field = which === 'start' ? cfg.bindStartField : cfg.bindEndField;
    if (!field) return;
    const boxes = getBoxes();
    const i = indexOfId(boxes, id);
    if (i < 0) return;
    const b = boxes[i] || {};
    if (String(b[field] ?? '') === to) return;
    const next: Box = { ...b, [field]: to };
    if (
      to &&
      hasHeadCfg &&
      String(b[cfg.headStartField] || 'none') === 'none' &&
      String(b[cfg.headEndField] || 'none') === 'none'
    ) {
      next[which === 'start' ? cfg.headStartField : cfg.headEndField] = 'triangle';
    }
    commit(boxes.map((row, k) => (k === i ? next : row)));
    announce(
      to
        ? t('Attached to {name}. The line routes to it now, and follows it.', { name: to })
        : t('Detached. The line is a free shape again.')
    );
  }

  /** Every node's position in NATIVE px, in node order - the one place the two modes'
   *  coordinate spaces are reconciled. */
  function penNodePoints(): Array<{
    node: SplineNode;
    at: Point;
    hIn: Point | null;
    hOut: Point | null;
  }> {
    const p = penEdit ? penEdit.path : penDraft;
    if (!p) return [];
    const fr = penEdit ? penEdit.frame : null;
    const toNative = (x: number, y: number): Point => (fr ? localToFrame(fr, x, y) : { x, y });
    return p.nodes.map((node) => {
      const hi = handlePoint(node, 'in'),
        ho = handlePoint(node, 'out');
      return {
        node,
        at: toNative(node.x, node.y),
        hIn: hi ? toNative(hi.x, hi.y) : null,
        hOut: ho ? toNative(ho.x, ho.y) : null,
      };
    });
  }

  /**
   * Build-once / reposition-many for node chrome, keyed on the node COUNT plus which path
   * is being edited - nothing else. Repositioning is pure style writes, so a drag, a pan
   * and a zoom all cost the same handful of them; only placing or deleting a node (or
   * changing which box is edited) recreates elements and rebinds their pointerdown. This
   * is the discipline `chromeNodes` documents, and it matters more here: a 40-node path
   * rebuilt per frame is 120 elements and 80 listeners per pointermove.
   */
  function syncPenChrome(): void {
    const p = penEdit ? penEdit.path : penDraft;
    if (!p) {
      if (penChromeKey) clearPenChrome();
      return;
    }
    // Handles are drawn while DRAWING as well as while editing. A pen's click-drag is the
    // one gesture whose whole feedback is the arm you are pulling, and on the very first
    // node of a path there is no segment yet, so without the arm the drag has no visible
    // effect at all - you are aiming a tangent blind. `handlePoint` returns null for a node
    // with no authored handle, so a click-only node still shows a bare dot and only the
    // nodes actually dragged grow arms.
    const withHandles = kindReadsHandles(p.kind);
    const key = `${penEdit ? 'e:' + penEdit.id : 'd'}:${p.nodes.length}:${withHandles ? 'h' : '-'}`;
    if (key !== penChromeKey) {
      penChromeKey = key;
      buildPenChrome(p.nodes.length, withHandles);
    }
    positionPenChrome();
  }

  /**
   * The node chrome carries NO listeners, unlike the selection handles.
   *
   * Every pen hit test already has to happen in box-local coordinates and be
   * rotation-aware - a handle can be anywhere, including under another node - so
   * `onCanvasPointerDown` does it with `penHandleAt`/`nodeAt`/`nearestOnPath` against the
   * real geometry. Binding a second, element-based path on top would give two answers to
   * the same question, and it is precisely the per-node listener rebinding that the
   * build-once discipline exists to avoid. The elements are therefore pointer-transparent
   * (see `.fc-pen-chrome` in editor.css) and this function only ever mints divs.
   */
  function buildPenChrome(count: number, withHandles: boolean): void {
    penChrome.innerHTML = '';
    const arms: HTMLElement[] = [];
    const dots: HTMLElement[] = [];
    const nodes: HTMLElement[] = [];
    // Arms below dots below nodes: paint order is tree order in this container.
    for (let k = 0; withHandles && k < count * 2; k++) {
      const arm = document.createElement('div');
      arm.className = 'fc-pen-arm';
      arm.hidden = true;
      penChrome.appendChild(arm);
      arms.push(arm);
    }
    for (let k = 0; withHandles && k < count * 2; k++) {
      const dot = document.createElement('div');
      dot.className = 'fc-pen-handle';
      dot.hidden = true;
      penChrome.appendChild(dot);
      dots.push(dot);
    }
    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      el.className = 'fc-pen-node';
      penChrome.appendChild(el);
      nodes.push(el);
    }
    penChromeNodes = { nodes, arms, dots };
  }

  /** The MODEL row of the box being node-edited (the bindings live there, not on the
   *  denormalised local path `penEdit` holds). null when the edit is over. */
  function penEditBox(): Box | null {
    if (!penEdit) return null;
    const boxes = getBoxes();
    const i = indexOfId(boxes, penEdit.id);
    return i >= 0 ? boxes[i] || null : null;
  }

  function positionPenChrome(): void {
    const nodes = penChromeNodes;
    if (!nodes) return;
    const m = metrics();
    const pts = penNodePoints();
    for (let i = 0; i < nodes.nodes.length; i++) {
      const el = nodes.nodes[i]!;
      const pt = pts[i];
      if (!pt) {
        el.hidden = true;
        continue;
      }
      el.hidden = false;
      const s = nativeToStage(pt.at.x, pt.at.y, m);
      el.style.left = s.x + 'px';
      el.style.top = s.y + 'px';
      const cont =
        pt.node.continuity ?? defaultContinuity(penEdit ? penEdit.path.kind : penDraft!.kind);
      el.classList.toggle('is-corner', cont === 'corner');
      el.classList.toggle('is-symmetric', cont === 'symmetric');
      el.classList.toggle('is-on', penSel.has(i));
      // The first node of an OPEN draft is the one a click closes on, so it reads as a
      // target rather than as another placed point.
      el.classList.toggle('is-close-target', !!penDraft && i === 0 && pts.length >= 3);
      // plan 96 P3 - an ATTACHED end reads as filled, so a pinned-to-a-box endpoint
      // is visible without dragging it to find out. Only the two ends can carry one.
      const end = penEdit ? (i === 0 ? 'start' : i === pts.length - 1 ? 'end' : null) : null;
      el.classList.toggle('is-bound', !!end && !!penEditBox() && bindOf(penEditBox()!, end) !== '');
    }
    for (let k = 0; k < nodes.dots.length; k++) {
      const i = k >> 1;
      const which: 'in' | 'out' = k % 2 === 0 ? 'in' : 'out';
      const dot = nodes.dots[k]!;
      const arm = nodes.arms[k]!;
      const pt = pts[i];
      const h = pt ? (which === 'in' ? pt.hIn : pt.hOut) : null;
      if (!pt || !h) {
        dot.hidden = true;
        arm.hidden = true;
        continue;
      }
      const a = nativeToStage(pt.at.x, pt.at.y, m);
      const b = nativeToStage(h.x, h.y, m);
      dot.hidden = false;
      dot.classList.toggle('is-on', penHandleSel.has(`${i}:${which}`));
      dot.style.left = b.x + 'px';
      dot.style.top = b.y + 'px';
      arm.hidden = false;
      arm.style.left = a.x + 'px';
      arm.style.top = a.y + 'px';
      arm.style.width = Math.hypot(b.x - a.x, b.y - a.y) + 'px';
      arm.style.transform = `rotate(${(Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI}deg)`;
    }
  }

  // ── the pen's contextual bar ───────────────────────────────────────────────────

  /** Where the pen bar's own panels (the lossy-switch confirmation) anchor. */
  function penCtxAnchorPoint(): Point {
    const r = ctxbar.getBoundingClientRect();
    return { x: r.left || lastMenuAt.x, y: r.bottom || lastMenuAt.y };
  }

  /**
   * The paint section + kind switcher + continuity control, in `ctxbar` - which is the
   * contextual control bar that already rebuilds on a selection-signature change, so the
   * pen's signature just joins that scheme rather than inventing a second bar.
   *
   * The paint controls are the SAME `paintCtxHtml` the object bar uses. This bar replaces
   * `ctxbar.innerHTML`, so before that sharing existed fill and stroke disappeared the
   * instant node editing began - which is the thing the bug report was actually about.
   */
  function penCtxBar(): void {
    const p = penEdit ? penEdit.path : penDraft;
    if (!p) return;
    const contSig = [...penSel]
      .sort((a, b) => a - b)
      .map((i) => p.nodes[i]?.continuity ?? '')
      .join(',');
    const handleSig = [...penHandleSel].sort().join(',');
    const key = `pen:${penEdit ? penEdit.id : 'draft'}:${p.kind}:${p.closed ? 'c' : 'o'}:${p.nodes.length}:${contSig}:${handleSig}:${penSelectHandles ? 'h' : '-'}`;
    if (key !== ctxSelKey) {
      ctxSelKey = key;
      buildPenCtxBar(p);
    }
    showCtxBar();
    positionPenCtxBar();
  }

  function buildPenCtxBar(p: AuthoredPath): void {
    closeMorePanel();
    const drawing = !!penDraft;
    const selN = penSel.size;
    // Align/distribute act on nodes ∪ selected control points, so the arrange button
    // enables on the COMBINED count (delete + continuity stay node-only via selN).
    const selPts = penSel.size + penHandleSel.size;
    const cont = selN
      ? String(p.nodes[[...penSel][0]!]?.continuity ?? defaultContinuity(p.kind))
      : '';
    const kindLabel = penKindLabels();
    // Paint belongs to the BOX, so it only appears once there is one: a draft lives in JS
    // state until it commits, and its paint comes from the add-kind's seed.
    const painted = !drawing && !!penEdit;
    let editBox: Box = {};
    if (painted) {
      const rows = getBoxes();
      editBox = rows[indexOfId(rows, penEdit!.id)] || {};
    }
    ctxbar.innerHTML =
      (painted ? paintCtxHtml(editBox, true) + '<span class="fc-sep fc-sep-v"></span>' : '') +
      `<select class="field-select field-select--sm fc-pen-kind" data-pen="kind" data-tip="${escape(t('Spline type'))}" aria-label="${escape(t('Spline type'))}">` +
      PEN_KINDS.map(
        (k) =>
          `<option value="${k}"${k === p.kind ? ' selected' : ''}>${escape(kindLabel[k] || k)}</option>`
      ).join('') +
      '</select>' +
      (drawing
        ? ''
        : '<span class="fc-sep fc-sep-v"></span>' +
          segHtml('pen-cont', cont, [
            ['corner', t('Corner point - handles move independently'), SVG.contCorner],
            ['smooth', t('Smooth point - handles stay in line'), SVG.contSmooth],
            ['symmetric', t('Symmetric point - handles stay in line and equal'), SVG.contSymmetric],
          ]) +
          `<button type="button" class="fc-cbtn${p.closed ? ' is-on' : ''}" data-pen="closed" aria-pressed="${p.closed}" data-tip="${escape(t('Closed path'))}" aria-label="${escape(t('Closed path'))}">${icon(SVG.penClose)}</button>` +
          // Marquee selection mode: nodes only, or nodes + control points. Only meaningful
          // where control points exist (cubic / hyperbezier).
          (kindReadsHandles(p.kind)
            ? `<button type="button" class="fc-cbtn${penSelectHandles ? ' is-on' : ''}" data-pen="handlesel" aria-pressed="${penSelectHandles}" data-tip="${escape(penSelectHandles ? t('Selecting nodes and control points - click for nodes only') : t('Selecting nodes only - click to include control points'))}" aria-label="${escape(t('Include control points in a marquee selection'))}">${icon(SVG.nodes)}</button>`
            : '') +
          `<button type="button" class="fc-cbtn" data-pen="arrange"${selPts >= 2 ? '' : ' disabled'} data-tip="${escape(t('Align and distribute the selected points'))}" aria-label="${escape(t('Align and distribute the selected points'))}">${icon(SVG.align)}</button>` +
          `<button type="button" class="fc-cbtn fc-danger" data-pen="del"${selN ? '' : ' disabled'} data-tip="${escape(t('Delete the selected points'))}" aria-label="${escape(t('Delete the selected points'))}">${icon(SVG.trash)}</button>`) +
      '<span class="fc-sep fc-sep-v"></span>' +
      `<button type="button" class="fc-cbtn" data-pen="done" data-tip="${escape(drawing ? t('Finish this path (Enter)') : t('Finish editing points (Esc)'))}" aria-label="${escape(drawing ? t('Finish this path') : t('Finish editing points'))}">${icon(SVG.penDone)}</button>` +
      `<span class="fc-readout">${escape(
        drawing
          ? p.nodes.length === 1
            ? t('1 point - hold Alt for a corner')
            : t('{n} points - hold Alt for a corner', { n: p.nodes.length })
          : selN
            ? t('{k} of {n} points', { k: selN, n: p.nodes.length })
            : t('{n} points', { n: p.nodes.length })
      )}</span>`;
    const kindSel = ctxbar.querySelector<HTMLSelectElement>('[data-pen="kind"]');
    kindSel?.addEventListener('change', () => {
      const to = kindSel.value as SplineKind;
      if (penDraft) {
        penDraft = { ...penDraft, kind: to };
        penDrawKind = to;
        penWarm = null;
        renderChrome();
        return;
      }
      penSetKind(to);
    });
    wireSegs(ctxbar, (field, v) => {
      if (field === 'pen-cont' && v) penSetContinuity(v as Continuity);
    });
    if (painted) {
      wirePaintCtx(ctxbar);
      ctxbar.querySelectorAll<HTMLElement>('[data-cx="stroke"]').forEach((b) =>
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          openStrokePanel(b);
        })
      );
    }
    ctxbar.querySelectorAll<HTMLElement>('[data-pen]').forEach((b) =>
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        const which = b.dataset.pen;
        if (which === 'closed') penToggleClosed();
        else if (which === 'handlesel') {
          penSelectHandles = !penSelectHandles;
          ctxSelKey = null;
          renderChrome();
        } else if (which === 'arrange') openPenArrangeMenu(b);
        else if (which === 'del') penDeleteSelected();
        else if (which === 'done') {
          if (penDraft) penFinishDraw();
          else endPenEdit();
        }
      })
    );
  }

  /** Pinned to the top chrome row, centred between the back pill and zoom HUD - the same
   *  perch the object bar takes, so the bar does not jump when a draw becomes a selection
   *  and never sits over the path the user is shaping. */
  function positionPenCtxBar(): void {
    const m = metrics();
    const band = ctxTopBand({ w: m.sr.width, h: m.sr.height }, ctxBarBlockers(m.sr), {
      reserve: stageReserves(),
    });
    ctxbar.style.maxWidth = Math.max(0, band.hi - band.lo) + 'px';
    const bw = ctxbar.offsetWidth || 0;
    if (bw <= 0) return; // not laid out yet - next frame, rather than a half-width-off jump
    const pos = centreCtxBar(bw, band);
    ctxbar.style.left = pos.left + 'px';
    ctxbar.style.top = pos.top + 'px';
  }

  // ── the tool mode ─────────────────────────────────────────────────────────────
  /**
   * THE mode switch. Every enter/exit below is private to it, because the bug it fixes was
   * not a missing button: the modes were four independent booleans, so each `armX` had to
   * remember to disarm each of the others by hand - and `armConnect` never disarmed the pen,
   * so Connect-over-Pen left two live tools, two lit rail buttons, and an Escape that took
   * two presses to dismantle what looked like one state. Here "enter next" IS "leave
   * everything else", once, in one place.
   *
   * `draft` decides an in-progress pen path's fate, and the two answers are deliberately
   * opposite: a TOOL SWITCH finishes it ('commit', the default - the user asked for a
   * different tool, not to throw the path away, which is what every mainstream design tool
   * does), while Escape means cancel and passes 'discard'. Getting these the same way round
   * either loses drawn work or resurrects work the user just abandoned. `penFinishDraw`
   * still commits nothing for a draft under two nodes, so a stray single click on the way
   * out leaves no invisible one-node box behind.
   *
   * Point editing is not a mode, but it IS something the user is inside, so any tool change
   * leaves it - the same way switching tools leaves a text edit.
   */
  function setMode(
    next: EditorMode,
    o: { kind?: AddKind; draft?: 'commit' | 'discard' } = {}
  ): void {
    // The line tool writes a PATH BOX now (plan 96 P2), so it is gated on the same config
    // the pen is - `pathField` - and no longer on the connectors input it used to write to.
    if (next === 'line' && !cfg.pathField) return;
    if (next === 'pen' && !cfg.pathField) return;
    if (next === 'create' && !o.kind && !armedKind) return;
    if (next !== 'select') nodeToolActive = false; // any other tool exits the Node tool
    const from = mode;
    if (penEdit) endPenEdit();
    if (from === 'pen' && penDraft) {
      if (o.draft === 'discard') penCancelDraw();
      else penFinishDraw();
    }
    mode = next;
    if (from !== next) {
      // A mode switch while a create/line DRAG is still in flight (Escape's discard rung, or
      // a V/P/N tool shortcut pressed mid-draw) ABORTS that gesture, so its eventual
      // pointerup can't commit a box/line against the discard - both tools committed on
      // release and neither ended the gesture here (plan 90 verify LENS 3). endGesture()
      // nulls `gesture`, so onGestureEnd early-returns on release; the browser auto-releases
      // the pointer capture. Scoped to these two so select-mode move/resize/rotate is
      // untouched (those never coexist with a tool switch), as is pen's own draft handling.
      if (gesture && (gesture.type === 'create' || gesture.type === 'line')) endGesture();
      if (from === 'create') exitCreate();
      else if (from === 'pen') exitPen();
      else if (from === 'line') exitLine();
      if (next === 'pen') enterPen();
      else if (next === 'line') enterLine();
    }
    if (next === 'create') enterCreate(o.kind);
    syncModeUI();
  }
  /** Back to the pointer, from anywhere - Escape's mode rung, and every internal "this
   *  gesture consumed the tool" exit. */
  const toPointer = (draft: 'commit' | 'discard' = 'commit'): void => {
    setMode('select', { draft });
  };
  /** The pointer as an EXPLICIT user choice (the rail button, `V`). Announced, because the
   *  other two tools announce themselves and a mode change no screen reader hears is not a
   *  mode change; the internal exits above stay quiet, or every edge click would speak. */
  const pickPointer = (): void => {
    nodeToolActive = false; // the plain pointer is NOT the Node tool
    toPointer();
    announce(t('Pointer on - click to select, drag to move.'));
  };

  /** Toggle the Node tool. Turning it on drops any other tool (it is a select sub-mode)
   *  and, if exactly one path box is selected, jumps straight into editing it - the
   *  "jump straight into node editing an object" ask. */
  function toggleNodeTool(): void {
    if (nodeToolActive) {
      nodeToolActive = false;
      if (penEdit) endPenEdit();
      syncModeUI();
      announce(t('Pointer on - click to select, drag to move.'));
      return;
    }
    if (mode !== 'select') setMode('select'); // exit pen/create/connect
    nodeToolActive = true;
    const boxes = getBoxes();
    if (selection.size === 1) {
      const id = [...selection][0]!;
      const i = boxes.findIndex((b, k) => idOf(b, k) === id);
      if (i >= 0 && boxOutlineKind(boxes[i], vectorCfg ?? undefined) === 'path') startPenEdit(id);
    }
    syncModeUI();
    announce(t('Node tool on - click a shape to edit its points.'));
  }

  function enterCreate(kind?: AddKind): void {
    if (kind) armedKind = kind;
    // Every arm starts UNTIMED, and the timeline path re-stamps its time right after
    // calling setMode. Clearing here rather than only in exitCreate is what makes a
    // create→create switch safe: setMode skips exitCreate when the mode does not
    // change, so arming from the timeline `+` and then from the rail's add menu used
    // to carry the stale playhead time into the box drawn by the SECOND arm.
    pendingAddAtMs = null;
    deselectEdge();
    stageEl.classList.add('fc-arming');
    showArmHint(armedKind);
  }
  function exitCreate(): void {
    armedKind = null;
    pendingAddAtMs = null; // an abandoned arm must not time the NEXT box drawn by hand
    stageEl.classList.remove('fc-arming');
    hideArmHint(); // placed, or abandoned - either way the arm is over
  }
  // `enterConnect` / `exitConnect` (plan 90) lived here. Plan 96 P4 deleted Connect mode
  // outright: clicking a card and then another card was a third way to make the one
  // primitive the Pen and the Line tool already make, and P3 replaced it with the gesture
  // the shape itself suggests - drag a line's endpoint onto a box and it attaches. There is
  // no mode to enter, so there is no mode to be trapped in and none to leave.
  // The Line tool (plan 96 P2) - the pen's other gesture. One drag draws a straight
  // two-node authored path, committed as an ordinary path box: selectable, node-editable,
  // and carrying the same stroke + arrowhead decorations any spline does.
  function enterLine(): void {
    deselectEdge();
    hideConnectLayer();
    selection = new Set<string>();
    stageEl.classList.add('fc-lining');
    setHoverEdge(null);
    announce(t('Line tool - drag on the canvas to draw a line or arrow. Esc to finish.'));
    renderChrome();
  }
  function exitLine(): void {
    stageEl.classList.remove('fc-lining');
    hideConnectLayer();
    clearGuides();
  }
  /**
   * What the Line tool adds to a path box beyond the pen's own seeding.
   *
   * An OPEN arrowhead at the END and nothing at the start: someone reaching for a line tool on a
   * layout canvas is nearly always pointing at something, and an undecorated straight
   * segment is what the pen already gives. The head is a normal field, so the stroke panel
   * takes it straight back off.
   *
   * Both bindings are written EMPTY rather than left absent, so a line drawn today carries
   * the same structure of row as one bound in P3 - the field exists, it just names no box.
   */
  const lineBoxSeed = (): Box => ({
    ...(hasHeadCfg ? { [cfg.headStartField]: 'none', [cfg.headEndField]: 'open' } : {}),
    ...(hasBindCfg ? { [cfg.bindStartField]: '', [cfg.bindEndField]: '' } : {}),
  });

  /**
   * The rail's one job: say which tool is live. Attributes only, on buttons captured at
   * build time - this runs on every chrome sync (so, every frame of a drag), and the rail
   * follows the same build-once/touch-many discipline as the selection chrome.
   */
  function syncModeUI(): void {
    const flag = (b: HTMLElement | null, on: boolean): void => {
      if (!b) return;
      b.classList.toggle('is-armed', on);
      b.setAttribute('aria-pressed', String(on));
    };
    flag(modeBtns.select, mode === 'select' && !nodeToolActive);
    flag(modeBtns.create, mode === 'create');
    flag(modeBtns.pen, mode === 'pen');
    flag(modeBtns.line, mode === 'line');
    flag(nodeToolBtn, nodeToolActive);
  }

  // Auto-arrange the connected cards into a tidy top-down hierarchy. Roots (cards with
  // nothing pointing AT them) are laid out left-to-right; each child sits under its parent,
  // and a parent is centred over the span of its children. Unconnected cards are left where
  // they are. One commit → one undo step.
  //
  // The graph is read off the path boxes' BINDINGS (plan 96 P4). It used to be read off the
  // `connectors` edge input; a connector is a path box now, and `bindStart` → `bindEnd` is
  // the same directed pair `from` → `to` was, so the walk below is unchanged.
  function autoLayout(): void {
    if (!hasBindCfg) return;
    const boxes = getBoxes();
    if (!boxes.length) return;
    const idAt = new Map<string, number>();
    boxes.forEach((b, i) => idAt.set(idOf(b, i), i));
    const children = new Map<string, string[]>();
    const hasParent = new Set<string>();
    for (const b of boxes) {
      if (!b) continue;
      const from = String(b[cfg.bindStartField] ?? ''),
        to = String(b[cfg.bindEndField] ?? '');
      if (!from || !to || !idAt.has(from) || !idAt.has(to) || from === to) continue;
      if (!children.has(from)) children.set(from, []);
      if (!children.get(from)!.includes(to)) children.get(from)!.push(to);
      hasParent.add(to);
    }
    const roots = boxes
      .map((b, i) => idOf(b, i))
      .filter((id) => children.has(id) && !hasParent.has(id));
    if (!roots.length) {
      announce(t('Connect some cards first, then Auto-arrange lays them out.'));
      return;
    } // nothing connected → leave the canvas alone
    const HGAP = 40,
      VGAP = 90;
    const cw = canvasWH();
    const placed = new Map<string, { x: number; y: number }>();
    const seen = new Set<string>();
    let cursorX = 0;
    // First pass: assign x by in-order leaf slots, y by depth; parents centre over kids.
    function widthOf(id: string): number {
      const b = boxes[idAt.get(id)!]!;
      return Math.max(1, num(b[cfg.wField], 200));
    }
    function heightAtDepth(d: number): number {
      // Uniform row height = the tallest card overall (keeps rows aligned).
      let mh = 0;
      for (const b of boxes) mh = Math.max(mh, num(b[cfg.hField], 100));
      return d * (mh + VGAP);
    }
    function layout(id: string, depth: number): { cx: number } {
      seen.add(id);
      const kids = (children.get(id) || []).filter((k) => !seen.has(k));
      const y = heightAtDepth(depth);
      if (!kids.length) {
        const x = cursorX;
        cursorX += widthOf(id) + HGAP;
        placed.set(id, { x, y });
        return { cx: x + widthOf(id) / 2 };
      }
      const cxs: number[] = [];
      for (const k of kids) cxs.push(layout(k, depth + 1).cx);
      const cx = (cxs[0]! + cxs[cxs.length - 1]!) / 2;
      placed.set(id, { x: cx - widthOf(id) / 2, y });
      return { cx };
    }
    for (const r of roots) {
      layout(r, 0);
      cursorX += HGAP * 2;
    }
    // Centre the whole tree horizontally on the artboard, then snap onto the grid.
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity;
    for (const [id, p] of placed) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x + widthOf(id));
      minY = Math.min(minY, p.y);
    }
    const offX = (cw.w - (maxX - minX)) / 2 - minX;
    const offY = Math.max(40, cw.h * 0.12) - minY;
    const g = gridOn ? gridSize : 1;
    const next = boxes.map((b, i) => {
      const id = idOf(b, i);
      const p = placed.get(id);
      if (!p) return b;
      return {
        ...b,
        [cfg.xField]: Math.round((p.x + offX) / g) * g,
        [cfg.yField]: Math.round((p.y + offY) / g) * g,
      };
    });
    commit(next);
  }

  // ── object copy / paste ───────────────────────────────────────────────────────
  // ⌘/Ctrl+C on a selection copies the box(es) - both to an in-memory clip and,
  // behind FC_CLIP_PREFIX, onto the OS clipboard - so the next ⌘V duplicates them
  // (see onGlobalPaste). While editing text the browser's native text copy wins;
  // this only fires on the bare canvas with a selection.
  let objectClipboard: Box[] | null = null; // Array<box> - the in-memory fallback
  let styleClipboard: DesignStyleSnapshot | null = null;
  // Copy style is an ALLOW-LIST of fields the manifest declared as visual controls.
  // Identity, geometry, content (text/image/path), artboard ownership, timing, notes,
  // hidden/locked state, groups and z-order are absent by construction. Filtering the
  // resolved/defaulted names through the block schema is important: a legacy tool must
  // not acquire a field its URL wire cannot carry merely because this editor knows the
  // conventional name.
  const declaredBoxFields = new Set((input.fields || []).map((f) => f.id));
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
  ].filter((f): f is string => !!f && declaredBoxFields.has(f)))];

  /** Copy the first selected row's visual fields; multi-selection follows every paint panel. */
  function copySelectionStyle(): void {
    const boxes = getBoxes();
    const first = selIndices(boxes)[0];
    if (first == null || !styleFields.length) return;
    styleClipboard = captureDesignStyle(boxes[first]!, styleFields);
    flash(t('Style copied'));
  }

  /** Apply one style to the full selection in one model write / undo step. */
  function pasteSelectionStyle(): void {
    if (!styleClipboard || !selection.size) return;
    const boxes = getBoxes();
    const next = applyDesignStyle(boxes, selection, (b, i) => idOf(b, i), styleClipboard) as Box[];
    commit(next);
    flash(t('Style pasted'));
  }

  let lastPointer: { x: number; y: number } | null = null; // last client {x,y} over the stage - paste placement
  function pasteAimedHere(): boolean {
    const ae = document.activeElement;
    return !(ae && ae !== document.body && !stageEl.contains(ae));
  }
  /**
   * What a copy takes: the selection, PLUS the children of any selected artboard
   * (plans/179 A8, the Cmd+C leg). A slide is its content - copying the page row alone
   * pasted an empty board. Ids are written explicitly so `pasteObjects` can re-point a
   * child at the copy of its own page even when the tool stores no id on the row.
   */
  function copyRows(boxes: Box[], idx: number[]): Box[] {
    const take = new Set(idx);
    const fk = frameCfg?.frameKind;
    if (fk) {
      const ff = frameFields();
      const pages = new Set(
        idx.filter((i) => String(boxes[i]?.[cfg.kindField]) === fk).map((i) => idOf(boxes[i], i))
      );
      if (pages.size)
        boxes.forEach((b, i) => {
          if (b && pages.has(String(b[ff.frameField] ?? ''))) take.add(i);
        });
    }
    return [...take]
      .sort((a, b) => a - b)
      .map((i) => ({ ...boxes[i], [cfg.idField]: idOf(boxes[i], i) }));
  }
  function onCopy(e: ClipboardEvent): void {
    if (disposed || editing) return; // editing → native text copy
    if (typingTarget() || !pasteAimedHere()) return;
    const boxes = getBoxes();
    const idx = selIndices(boxes);
    if (!idx.length) return; // nothing selected → native copy
    const picked = copyRows(boxes, idx);
    objectClipboard = picked;
    try {
      e.clipboardData!.setData('text/plain', FC_CLIP_PREFIX + JSON.stringify(picked));
      e.preventDefault();
    } catch {
      /* clipboard write blocked - the in-memory copy still serves ⌘V */
    }
  }
  /** Copy's exact deep payload followed by one ordinary delete commit. */
  function cutSelection(transfer?: DataTransfer | null): void {
    const boxes = getBoxes();
    const idx = selIndices(boxes);
    if (!idx.length) return;
    const picked = copyRows(boxes, idx);
    objectClipboard = picked;
    const encoded = FC_CLIP_PREFIX + JSON.stringify(picked);
    try {
      if (transfer) transfer.setData('text/plain', encoded);
      else void navigator.clipboard?.writeText(encoded).catch(() => { /* in-memory fallback */ });
    } catch {
      /* the in-memory payload still makes a later paste work */
    }
    deleteSelection();
  }
  /** Native Cut keeps text fields native and owns the canvas only with a selection. */
  function onCut(e: ClipboardEvent): void {
    if (disposed || editing) return; // editing → native text cut
    if (typingTarget() || !pasteAimedHere() || !selection.size) return;
    if (timeCfg && !selectionLive(getBoxes())) {
      e.preventDefault();
      announce(t('This card is not on screen at the playhead. Go to it to edit it.'));
      return;
    }
    e.preventDefault();
    cutSelection(e.clipboardData);
  }
  /**
   * Duplicate a set of copied boxes at a +24,+24 offset (cascades on repeat paste),
   * clamped into the canvas, and select the fresh copies. Mirrors duplicateSelection.
   *
   * An ARTBOARD row takes the same path Cmd+D does (plans/179 A8/A9), because a paste
   * creates a frame exactly as a duplicate does. Left on the +24 rule it kept the SOURCE
   * board's `order` - two slides claiming one page slot, settled only by the x tie-break -
   * and sat 24px over the board it came from; since the paste is appended LAST and
   * `resolveFrame` answers with the last containing frame, that board's children re-bucketed
   * into the copy on their next gesture and vanished from every export. So a pasted board
   * goes clear of every board there is, takes the next page slot, and brings the children
   * `copyRows` collected with it, keeping their frame-local position.
   */
  function pasteObjects(picked: any): void {
    if (!Array.isArray(picked) || !picked.length) return;
    const rows = (picked as unknown[]).filter((s): s is Box => !!s && typeof s === 'object');
    if (!rows.length) return;
    const fk = frameCfg?.frameKind;
    const ff = frameCfg ? frameFields() : null;
    const isFrameRow = (s: Box): boolean => !!fk && String(s[cfg.kindField]) === fk;
    let boxes = getBoxes();
    if (ff && rows.some(isFrameRow)) boxes = seedFrameOrders(boxes, ff); // legacy docs get an order first
    const clones: Box[] = [];
    const nextSel = new Set<string>();
    const pageIds = new Map<string, string>(); // pasted frame id → its copy's id
    const pageShift = new Map<string, number>(); // …and how far right it moved
    let deckRight = fk
      ? boxes.reduce(
          (m, b) =>
            b && String(b[cfg.kindField]) === fk
              ? Math.max(m, num(b[cfg.xField]) + num(b[cfg.wField]))
              : m,
          Number.NEGATIVE_INFINITY
        )
      : Number.NEGATIVE_INFINITY;
    for (const src of rows) {
      // pages first - a child needs its new page
      if (!isFrameRow(src)) continue;
      const r = boxRect(src, cfg);
      const x = Math.round(Number.isFinite(deckRight) ? deckRight + FRAME_DUP_GAP : r.x);
      const id = freshId(boxes.concat(clones));
      const clone: Box = {
        ...src,
        [cfg.idField]: id,
        [cfg.xField]: x,
        [cfg.yField]: Math.round(r.y),
      };
      if (ff) clone[ff.orderField] = nextFrameOrder(boxes.concat(clones), ff);
      clones.push(clone);
      nextSel.add(id);
      const old = src[cfg.idField] == null ? '' : String(src[cfg.idField]);
      if (old) {
        pageIds.set(old, id);
        pageShift.set(old, x - r.x);
      }
      deckRight = x + r.w;
    }
    for (const src of rows) {
      if (isFrameRow(src)) continue;
      const id = freshId(boxes.concat(clones));
      const r = boxRect(src, cfg);
      const owner = ff ? String(src[ff.frameField] ?? '') : '';
      const dx = owner ? pageShift.get(owner) : undefined;
      const clone: Box =
        dx == null
          ? clampToWorkArea({
              ...src,
              [cfg.idField]: id,
              [cfg.xField]: Math.round(r.x + 24),
              [cfg.yField]: Math.round(r.y + 24),
            })
          : {
              ...src,
              [cfg.idField]: id,
              [cfg.xField]: Math.round(r.x + dx),
              [cfg.yField]: Math.round(r.y),
              [ff!.frameField]: pageIds.get(owner)!,
            };
      clones.push(clone);
      nextSel.add(id);
    }
    if (!clones.length) return;
    // With a whole page pasted the selection is that PAGE, not its contents - the same
    // answer Cmd+D gives, so the next gesture moves the slide.
    selection = pageIds.size ? new Set(pageIds.values()) : nextSel;
    commit([...boxes, ...clones]);
    renderChrome();
  }

  // ── paste-to-create ──────────────────────────────────────────────────────────
  // Pasting (⌘/Ctrl+V, or a mobile long-press paste) while nothing is being edited
  // drops the clipboard text into a NEW text box. Rich clipboard HTML (bold/italic/
  // colour/weight/lists) is converted to the tool's markdown-subset source by
  // round-tripping through the same rich-text model the editor uses; plain text is
  // used verbatim. The in-edit editable has its OWN paste handler (onEditPaste) and
  // stops propagation, so this only fires on the bare canvas.
  const textAddKind = (): AddKind | undefined =>
    addKinds.find((k) => k.id === 'text' || (k.seed && k.seed[cfg.kindField] === 'text'));
  function sourceFromPastedHtml(html: string): string {
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      return markdownFromChars(charsFromDom(doc.body))
        .replace(/\n{3,}/g, '\n\n')
        .replace(/\s+$/, '');
    } catch {
      return '';
    }
  }
  function createTextBoxFromSource(source: string): void {
    if (!cfg.textField) return;
    const kind = textAddKind();
    const seed: Box = { ...(kind && kind.seed) };
    seed[cfg.textField] = source;
    const boxes = getBoxes();
    const cw = canvasWH();
    // Place the new box where the cursor last was over the stage (a text paste is
    // usually aimed there); fall back to the visible-canvas centre when the pointer
    // is stale / off-stage (e.g. a keyboard ⌘V after scrolling).
    const m = metrics();
    const onStage =
      lastPointer &&
      lastPointer.x >= m.sr.left &&
      lastPointer.x <= m.sr.left + m.sr.width &&
      lastPointer.y >= m.sr.top &&
      lastPointer.y <= m.sr.top + m.sr.height;
    const c = onStage
      ? clientToNative(lastPointer!.x, lastPointer!.y)
      : clientToNative(m.sr.left + m.sr.width / 2, m.sr.top + m.sr.height / 2);
    const fontSize = parseFloat(String(seed[cfg.fontSizeField])) || 64;
    const lhRaw = parseFloat(String(seed[cfg.lineHeightField]));
    const lh = Number.isFinite(lhRaw) ? lhRaw : 1.12;
    const padRaw = parseFloat(String(seed[cfg.padField]));
    const pad = Number.isFinite(padRaw) ? padRaw : 8;
    const lines = source.split('\n').length;
    const w = Math.round(Math.min(cw.w * 0.72, 760));
    // Over-estimate height (the box clips overflow in the render) - the user can drag
    // to resize, and a subsequent text edit grows-to-fit exactly.
    const h = Math.round(Math.max(120, lines * fontSize * lh + pad * 2 + fontSize * 0.5));
    const id = freshId(boxes);
    let box = seedBox(cfg, {}, seed, { x: c.x - w / 2, y: c.y - h / 2, w, h } as MathRect, id);
    box = clampToWorkArea(box);
    box = withLegibleInk(box, boxes); // same reason as the create gesture: a dark seed on a dark ground is nothing
    selection = new Set([id]);
    commit([...boxes, box]);
    renderChrome();
  }
  function onGlobalPaste(e: ClipboardEvent): void {
    if (disposed || editing) return;
    if (typingTarget()) return; // a real input owns the paste
    if (!canvasEl.isConnected) return;
    if (!pasteAimedHere()) return; // aimed at a modal/picker elsewhere
    const dt = e.clipboardData || (window as any).clipboardData;
    if (!dt) return;
    const plain = String((dt.getData && dt.getData('text/plain')) || '');
    // Objects copied inside the editor → paste = duplicate them (⌘C/⌘V an object).
    // Prefer the clipboard payload (survives reloads); fall back to the in-memory
    // copy when the clipboard held only our marker or the read was blocked.
    if (plain.startsWith(FC_CLIP_PREFIX) || (objectClipboard && !plain.trim())) {
      let picked = objectClipboard;
      if (plain.startsWith(FC_CLIP_PREFIX)) {
        try {
          picked = JSON.parse(plain.slice(FC_CLIP_PREFIX.length));
        } catch {
          /* keep in-memory */
        }
      }
      if (Array.isArray(picked) && picked.length) {
        e.preventDefault();
        e.stopPropagation();
        pasteObjects(picked);
        return;
      }
    }
    // Otherwise clipboard TEXT (rich or plain) → a new text box at the canvas centre.
    if (!cfg.textField) return;
    const html = dt.getData && dt.getData('text/html');
    let source = html && html.trim() ? sourceFromPastedHtml(html) : '';
    if (!source) source = plain.replace(/\r\n?/g, '\n').replace(/\s+$/, '');
    if (!source.trim()) return; // nothing useful → let the default happen
    e.preventDefault();
    e.stopPropagation();
    createTextBoxFromSource(source);
  }

  // Multi-page mode: page frames clip their content (overflow:hidden) so a box that
  // bleeds off a page is cut at the page edge in the render. While a box is being
  // dragged, lift that clip so a box crossing between pages (or into the gap) stays
  // fully visible under the cursor; the next paint re-buckets it and restores the clip.
  // No-op for single-page editors (no [data-pdf-page] frames).
  function setFramesClipped(clipped: boolean): void {
    if (!pages && !frameCfg) return;
    canvasEl.querySelectorAll<HTMLElement>('[data-pdf-page]').forEach((f) => {
      if (!clipped) {
        // Stash the inline overflow before lifting the clip so we can restore it
        // EXACTLY. Carousel `.cm-page` clips from the stylesheet (inline ''), but the
        // frames path bakes `overflow:hidden` INLINE on clipChildren frames - blanket
        // resetting to '' there would delete the only clip source, so restore verbatim.
        f.dataset.fcOverflow = f.style.overflow;
        f.style.overflow = 'visible';
      } else if (f.dataset.fcOverflow !== undefined) {
        // Restore ONLY elements that carry the stash: a mid-gesture repaint mints fresh
        // page nodes without it, and writing '' at those would delete the hook-baked
        // inline `overflow:hidden` that is a clipChildren frame's only clip source.
        f.style.overflow = f.dataset.fcOverflow;
        delete f.dataset.fcOverflow;
      }
    });
    // When restoring the clip at gesture end, also drop the drag-time z-index hoist
    // (applyLiveRect set it) so box paint order returns to array order. A committed edit
    // repaints the elements clean anyway; this covers a gesture that ends without a commit.
    if (clipped)
      canvasEl
        .querySelectorAll<HTMLElement>('.lolly-box, .lolly-frame-page[data-frame-id]')
        .forEach((el) => {
          el.style.zIndex = '';
        });
  }

  // ── pointer gestures on the canvas ───────────────────────────────────────────
  function beginGesture(e: PointerEvent, g: GestureInit): void {
    try {
      canvasEl.setPointerCapture(e.pointerId);
    } catch {
      /* older browsers */
    }
    gesture = {
      ...g,
      pointerId: e.pointerId,
      startClient: { x: e.clientX, y: e.clientY },
    } as Gesture;
    setHoverEdge(null); // drop any hover highlight/cursor when a drag begins
    document.body.classList.add('fc-manipulating');
    setFramesClipped(false);
    frameOffCache = new Map(); // frame offsets are stable during a drag - cache to avoid per-move reflow
  }
  function endGesture(): void {
    document.body.classList.remove('fc-manipulating');
    gesture = null;
    rubber.hidden = true;
    // The camera HUD and its mode cursor die WITH the gesture, whichever way it ended -
    // committed, cancelled, or a click that never moved. This one teardown covers every
    // exit path, so no branch has to remember to clear them.
    hideCamHud();
    stageEl.style.cursor = '';
    clearGuides();
    setFramesClipped(true);
    frameOffCache = null; // release the gesture-scoped frame-offset cache
    // The ctx bar's live state dies WITH the gesture: the frozen placement, the cached
    // chrome rects, and - the visible one - the drag readout. Its values come from
    // `liveRects`, so without a repaint of its own the bar keeps showing the coordinates
    // the pointer left behind until the tool's own re-render lands, which is a second or
    // more away and outlives things as unrelated as a playhead scrub. `commit()` writes
    // the model synchronously, so the frame after this one reads the settled numbers.
    ctxFrozen = null;
    ctxBlockers = null;
    if (!disposed)
      requestAnimationFrame(() => {
        if (!disposed && !gesture) renderChrome();
      });
  }

  // ── inline text editing (double-click a box) ─────────────────────────────────
  // WYSIWYG rich text: the box's rendered markup is edited in place, and a
  // floating format bar offers bold/italic/bullets (selection-level, via the
  // rich-text.js char model) plus alignment/weight/size (box-level, staged in
  // editing.pending and committed with the text as one undo step).
  let fmtbar: FmtBar | null = null;

  function onDblClick(e: MouseEvent): void {
    // A double-click ends an open pen path - the polyline-ending gesture every tool with a
    // multi-click primitive uses - and it never falls through to a text edit, because there
    // is no box under the cursor yet to edit.
    if (penDraft) {
      e.preventDefault();
      penFinishDraw();
      return;
    }
    // On a committed path box it ENTERS node editing, the same way a double-click enters a
    // text edit on a text box (see startTextEdit); one mode per kind of content.
    if (vectorCfg && !penEdit) {
      const pnat = clientToNative(e.clientX, e.clientY);
      const pboxes = getBoxes();
      const phit = pickTopmost(pboxes, pnat.x, pnat.y, cfg, seqHiddenSkip(pboxes));
      if (phit >= 0 && boxOutlineKind(pboxes[phit], vectorCfg) === 'path') {
        e.preventDefault();
        startPenEdit(idOf(pboxes[phit], phit));
        return;
      }
    }
    if (penEdit) return; // node-edit mode owns its own double-clicks
    if (!cfg.textField) return;
    // Already editing this box's text → let the browser's native double-click
    // word-selection stand. This listener is on the canvas, so a dblclick inside
    // the editable bubbles up to here; re-entering startTextEdit would commit +
    // restart the edit and collapse the caret to the end - the reported "word
    // flashes selected then vanishes" bug. (Triple-click escaped it only because
    // its third click fires no second dblclick event.) Just refresh the bar.
    if (editing && editing.el.contains(e.target as Node)) {
      refreshFmtStates();
      return;
    }
    const nat = clientToNative(e.clientX, e.clientY);
    const boxes = getBoxes();
    const hit = selectHit(boxes, nat.x, nat.y); // artboard-aware (a frame has no editable text → startTextEdit no-ops)
    if (hit < 0) return;
    e.preventDefault();
    selection = new Set([idOf(boxes[hit], hit)]);
    renderChrome();
    startTextEdit(idOf(boxes[hit], hit));
  }
  // A box element only exists after a foreground paint (rAF-gated), so a freshly
  // created box needs us to wait a few frames before we can focus its text.
  function editAfterPaint(id: string, opts: { selectAll?: boolean }, tries = 8): void {
    if (disposed) return;
    const el = canvasEl.querySelector<HTMLElement>(
      `.lolly-box[data-box-id="${cssEscape(id)}"] .lolly-box-text`
    );
    if (el) {
      startTextEdit(id, opts);
      return;
    }
    if (tries > 0) requestAnimationFrame(() => editAfterPaint(id, opts, tries - 1));
  }
  function startTextEdit(id: string, opts: { selectAll?: boolean } = {}): void {
    if (editing) commitTextEdit();
    const el = canvasEl.querySelector<HTMLElement>(
      `.lolly-box[data-box-id="${cssEscape(id)}"] .lolly-box-text`
    );
    if (!el) return;
    const boxEl = el.closest<HTMLElement>('.lolly-box');
    // WYSIWYG: edit the RENDERED rich text in place (the element already holds
    // hooks.js richText output - <strong>/<em> runs, \n line breaks, "•  "
    // bullets). Formatting ops round-trip through the rich-text.js char model,
    // and commit serialises back to the stored markdown-subset source.
    // `pending` collects box-field changes (align/weight/size/…) made from the
    // format bar mid-edit; they preview as inline styles and land in the SAME
    // commit as the text, so the whole edit stays one undo step.
    editing = {
      id,
      el,
      boxEl,
      prevHtml: el.innerHTML,
      prevStyle: el.style.cssText,
      prevBoxStyle: boxEl ? boxEl.style.cssText : '',
      pending: {},
    };
    stageEl.classList.add('is-text-editing');
    clearChrome(); // hide handles while typing (resets chrome node cache)
    hideCtxBar();
    closeMorePanel();
    closePopover();
    boxEl?.classList.add('fc-box-editing'); // reveal overflow so typing stays visible
    el.setAttribute('contenteditable', 'true');
    el.setAttribute('role', 'textbox');
    el.setAttribute('aria-label', t('Edit text'));
    el.classList.add('fc-editing');
    el.focus();
    // Select-all when replacing a create-seed ("Text") so the first keystroke wins;
    // otherwise drop the caret at the end for a natural continue-typing feel.
    const range = document.createRange();
    range.selectNodeContents(el);
    if (!opts.selectAll) range.collapse(false);
    const sel = window.getSelection();
    sel!.removeAllRanges();
    sel!.addRange(range);
    el.addEventListener('keydown', onEditKey);
    el.addEventListener('blur', onEditBlur);
    el.addEventListener('paste', onEditPaste);
    document.addEventListener('selectionchange', onEditSelChange);
    showFmtBar();
    positionFmtBar();
    refreshFmtStates();
    zoomForTouchEdit(el, boxEl);
  }

  /** The smallest on-screen type an edit can start at. Fit zoom on a phone is ~19%, which
   *  renders a 64px text box at ~12px - typing into that shows the user nothing. */
  const TOUCH_EDIT_MIN_PX = 16;

  /**
   * Bring a too-small text box up to readable type before the user starts typing.
   *
   * Touch only, decided by the EVENT that reached the canvas and not by a media query: a
   * mouse user has a cursor, a wheel and the zoom HUD within reach, moving the canvas under
   * a deliberate double-click would be rude, and a touch laptop calls itself coarse for the
   * whole document while its owner is on the trackpad. Never mid-gesture either - the stage
   * must not slide out from under a finger that is still down.
   *
   * What gets measured is the on-screen TYPE, not the box: a tapped-out text box is ~320×200
   * native, which clears any box-height threshold at fit zoom while its 64px type is still a
   * dozen pixels tall. The canvas is scaled by a CSS transform, so a client rect is
   * post-transform and `offsetHeight` is not - their ratio IS the live composed scale,
   * without the overlay having to read a StageNav it deliberately cannot see. A ROTATED box
   * inflates that ratio (a client rect is the AABB), which only ever under-reports the need
   * to zoom, so it can produce no surprise movement.
   *
   * The zoom goes through `fc-focus-rect`, the overlay's ONLY channel to the pan/zoom
   * transform (tool.ts holds the StageNav). focusRect frames a CLIENT rect at 85% of the
   * stage, so asking it for the modest factor we actually want means handing it a rect that
   * is STAGE-SHAPED and `0.85 / want` of the stage's size, centred on the box - at any other
   * aspect its letterboxing `min()` would pick the other axis and over-zoom.
   */
  function zoomForTouchEdit(el: HTMLElement, boxEl: HTMLElement | null): void {
    if (gesture || (lastPointerKind !== 'touch' && lastPointerKind !== 'pen')) return;
    const shown = el.getBoundingClientRect().height;
    const laid = el.offsetHeight;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (!(shown > 0) || !(laid > 0) || !(fs > 0)) return;
    const onScreen = fs * (shown / laid);
    if (onScreen >= TOUCH_EDIT_MIN_PX) return;
    const sr = stageEl.getBoundingClientRect();
    if (!(sr.width > 0) || !(sr.height > 0)) return;
    const br = (boxEl || el).getBoundingClientRect();
    const h = (0.85 * sr.height) / (TOUCH_EDIT_MIN_PX / onScreen);
    const w = h * (sr.width / sr.height);
    stageEl.dispatchEvent(
      new CustomEvent('fc-focus-rect', {
        bubbles: true,
        detail: {
          x: br.left + br.width / 2 - w / 2,
          y: br.top + br.height / 2 - h / 2,
          w,
          h,
        },
      })
    );
  }
  function onEditKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      cancelTextEdit();
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      commitTextEdit();
    }
    // Plain Enter inserts a literal \n (the render model is pre-wrap text) -
    // never the browser's <div> soup, which would desync the char model.
    else if (e.key === 'Enter') {
      e.preventDefault();
      document.execCommand('insertText', false, '\n');
    } else if ((e.key === 'b' || e.key === 'B') && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      toggleInline('b');
    } else if ((e.key === 'i' || e.key === 'I') && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      toggleInline('i');
    }
    e.stopPropagation(); // keep global Delete/nudge/undo off while typing
  }
  // Paste as plain text: rich clipboard HTML would smuggle arbitrary markup into
  // the editable; \n survives fine under pre-wrap.
  function onEditPaste(e: ClipboardEvent): void {
    e.preventDefault();
    e.stopPropagation();
    const text = (e.clipboardData || (window as any).clipboardData)?.getData('text/plain') ?? '';
    if (text) document.execCommand('insertText', false, text);
  }
  function onEditSelChange(): void {
    if (editing) refreshFmtStates();
  }
  function onEditBlur(e: FocusEvent): void {
    // Clicking our own format bar preventDefaults focus, so blur shouldn't fire from
    // it - but guard anyway so a stray blur toward the bar never drops the edit.
    if (e && e.relatedTarget && fmtbar && fmtbar.contains(e.relatedTarget as Node)) return;
    commitTextEdit();
  }
  function finishEdit(): EditingState | null {
    if (!editing) return null;
    const done = editing;
    editing = null;
    hideFmtBar();
    done.el.removeEventListener('keydown', onEditKey);
    done.el.removeEventListener('blur', onEditBlur);
    done.el.removeEventListener('paste', onEditPaste);
    document.removeEventListener('selectionchange', onEditSelChange);
    done.el.removeAttribute('contenteditable');
    done.el.removeAttribute('role');
    done.el.removeAttribute('aria-label');
    done.el.classList.remove('fc-editing');
    done.boxEl?.classList.remove('fc-box-editing');
    stageEl.classList.remove('is-text-editing');
    return done;
  }
  // Restore the pre-edit rendered view + inline styles (drops any pending-field
  // live previews the format bar applied during the edit).
  function restoreEditView(done: EditingState): void {
    done.el.innerHTML = done.prevHtml;
    done.el.style.cssText = done.prevStyle;
    if (done.boxEl) done.boxEl.style.cssText = done.prevBoxStyle;
  }
  function commitTextEdit(): void {
    const done = editing;
    if (!done) return;
    const text = markdownFromChars(charsFromDom(done.el));
    const pending = done.pending || {};
    const boxes = getBoxes();
    const i = indexOfId(boxes, done.id);
    const changedText = i >= 0 && String(boxes[i]![cfg.textField] ?? '') !== text;
    const changed = changedText || Object.keys(pending).length > 0;
    // Grow-to-fit - ONLY when the edit actually changed something (so merely
    // opening a box to read it never mutates its height). The box clips overflow
    // in the final render, so if the copy is taller than the box, grow it (only
    // ever grow) to keep it whole. The editable IS the rendered rich text (with
    // any pending size/weight previews already applied), so measure it directly.
    // A box that opted into shrink-to-fit handles overflow by scaling the text DOWN, so
    // it must NOT also grow - the two are opposite responses to the same overflow.
    const fitOn = i >= 0 && !!cfg.fitTextField && boolOf(boxes[i]![cfg.fitTextField], false);
    let grownH: number | null = null;
    if (changed && !fitOn && cfg.hField && done.boxEl) {
      const needed = Math.ceil(done.el.scrollHeight);
      const boxNativeH = parseFloat(done.boxEl.style.height) || 0;
      if (boxNativeH && needed > boxNativeH + 1) grownH = needed;
    }
    finishEdit();
    if (i < 0) {
      renderChrome();
      return;
    }
    if (changed) {
      commit(
        boxes.map((b, k) => {
          if (k !== i) return b;
          const nb = { ...b, ...pending, [cfg.textField]: text };
          if (grownH != null) nb[cfg.hField] = grownH;
          return nb;
        })
      );
    } else {
      restoreEditView(done); // nothing changed → restore rendered view
      renderChrome();
    }
  }
  function cancelTextEdit(): void {
    const done = editing;
    if (!done) return;
    finishEdit();
    restoreEditView(done); // discard edits, restore rendered view
    renderChrome();
  }

  // ── in-edit formatting: true rich text over the char model ────────────────────
  // The editable's DOM ↔ a flat char array (rich-text.js); the selection maps to
  // [start, end) character offsets. Toggle = parse → flip flags → re-render →
  // restore the selection at the same offsets. BRs count as one \n character.
  function selectionOffsets(el: HTMLElement): [number, number] | null {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return null;
    const range = sel.getRangeAt(0);
    if (!el.contains(range.startContainer) || !el.contains(range.endContainer)) return null;
    const offsetOf = (container: Node, offset: number): number => {
      let n = 0;
      let found = false;
      const walk = (node: Node): void => {
        if (found) return;
        if (node.nodeType === 3) {
          if (node === container) {
            n += Math.min(offset, node.nodeValue!.length);
            found = true;
          } else n += node.nodeValue!.length;
          return;
        }
        if (node.nodeName === 'BR') {
          if (node === container) found = true;
          else n += 1;
          return;
        }
        const kids = node.childNodes;
        for (let k = 0; k < kids.length; k++) {
          if (node === container && k === offset) {
            found = true;
            return;
          }
          walk(kids[k]!);
          if (found) return;
        }
        if (node === container) found = true;
      };
      walk(el);
      return n;
    };
    const a = offsetOf(range.startContainer, range.startOffset);
    const b = offsetOf(range.endContainer, range.endOffset);
    return a <= b ? [a, b] : [b, a];
  }
  function selectOffsets(el: HTMLElement, a: number, b: number): void {
    const idxIn = (node: Node): number =>
      Array.prototype.indexOf.call(node.parentNode!.childNodes, node);
    const posOf = (target: number): { node: Node; offset: number } => {
      let n = 0;
      let out: { node: Node; offset: number } | null = null;
      const walk = (node: Node): void => {
        if (out) return;
        if (node.nodeType === 3) {
          const len = node.nodeValue!.length;
          if (n + len >= target) {
            out = { node, offset: target - n };
            return;
          }
          n += len;
          return;
        }
        if (node.nodeName === 'BR') {
          if (n + 1 > target) out = { node: node.parentNode!, offset: idxIn(node) };
          else n += 1;
          return;
        }
        for (const kid of node.childNodes) {
          walk(kid);
          if (out) return;
        }
      };
      walk(el);
      return out || { node: el, offset: el.childNodes.length };
    };
    const start = posOf(a);
    const end = b === a ? start : posOf(b);
    const range = document.createRange();
    range.setStart(start.node, start.offset);
    range.setEnd(end.node, end.offset);
    const sel = window.getSelection();
    sel!.removeAllRanges();
    sel!.addRange(range);
  }
  function toggleInline(flag: string): void {
    if (!editing) return;
    const el = editing.el;
    el.focus();
    const off = selectionOffsets(el);
    if (!off) return;
    let [a, b] = off;
    const chars = charsFromDom(el);
    if (a === b) [a, b] = wordRangeAt(chars, a); // caret → the word under it
    if (a === b) return;
    const next = setFlag(
      chars,
      a,
      b,
      flag as 'b' | 'i',
      !rangeHasFlag(chars, a, b, flag as 'b' | 'i')
    );
    el.innerHTML = htmlFromChars(next);
    selectOffsets(el, a, b);
    refreshFmtStates();
  }
  // Text colour on the selection (mid-edit). The colour picker steals focus/selection, so
  // STASH the range the moment the swatch is engaged (while the editable still owns the
  // selection) and colour that range on each pick. `color` falsy → clear to the box fg.
  function stashRunColorRange(): void {
    if (!editing) return;
    const off = selectionOffsets(editing.el);
    if (!off) return; // focus already left → keep the earlier stash
    const chars = charsFromDom(editing.el);
    let [a, b] = off;
    if (a === b) [a, b] = wordRangeAt(chars, a);
    if (a < b) editing.colorRange = [a, b];
  }
  function applyRunColor(color: any): void {
    if (!editing || !editing.colorRange) return;
    const [a, b] = editing.colorRange;
    const el = editing.el;
    el.innerHTML = htmlFromChars(setColor(charsFromDom(el), a, b, color || null));
    try {
      selectOffsets(el, a, b);
    } catch {
      /* focus may be in the colour picker */
    }
    refreshFmtStates();
  }
  // Per-selection font weight (mid-edit). Like the colour picker, the <select> steals
  // focus/selection when it opens, so STASH the range on engage and re-weight it on
  // change. A null weight clears the run back to the box weight. Weight and bold are
  // the same axis, so setWeight drops any bold on the run (rich-text.js invariant).
  function stashRunWeightRange(): void {
    if (!editing) return;
    const off = selectionOffsets(editing.el);
    if (!off) return;
    const chars = charsFromDom(editing.el);
    let [a, b] = off;
    if (a === b) [a, b] = wordRangeAt(chars, a);
    if (a < b) editing.weightRange = [a, b];
  }
  function applyRunWeight(weight: any): void {
    if (!editing || !editing.weightRange) return;
    const [a, b] = editing.weightRange;
    const el = editing.el;
    el.innerHTML = htmlFromChars(setWeight(charsFromDom(el), a, b, weight));
    try {
      selectOffsets(el, a, b);
    } catch {
      /* focus may be in the select */
    }
    refreshFmtStates();
  }
  // Toggle "•  " bullets / "1.  " numbers on every non-blank line (a text box is one
  // logical list - bullets and numbers are mutually exclusive, handled in rich-text.js).
  function toggleBullet(): void {
    toggleList(toggleBullets);
  }
  function toggleNumber(): void {
    toggleList(toggleNumbers);
  }
  function toggleList(fn: (chars: any) => any): void {
    if (!editing) return;
    const el = editing.el;
    el.focus();
    const next = fn(charsFromDom(el));
    el.innerHTML = htmlFromChars(next);
    selectOffsets(el, next.length, next.length); // caret to the end
    refreshFmtStates();
  }
  // A field tweak from the format bar mid-edit: preview it as an inline style on
  // the live box (repainting now would destroy the contenteditable) and stash it
  // in `pending` for commitTextEdit to fold into the box row.
  function applyPending(field: string | undefined, value: any): void {
    if (!editing || !field) return;
    editing.pending[field] = value;
    const el = editing.el;
    const boxEl = editing.boxEl;
    if (field === cfg.alignField) {
      el.style.textAlign = value;
      if (boxEl) boxEl.style.justifyContent = H_JUSTIFY[value] || 'center';
    } else if (field === cfg.valignField) {
      if (boxEl) boxEl.style.alignItems = V_ALIGN[value] || 'center';
    } else if (field === cfg.weightField) {
      el.style.fontWeight = String(value);
    } else if (field === cfg.fontSizeField) {
      el.style.fontSize = value + 'px';
    } else if (field === cfg.fontField) {
      el.style.fontFamily = fontStackFor(value);
    } else if (field === cfg.ligaturesField || field === cfg.alternatesField) {
      applyFeaturePreview();
    }
    positionFmtBar();
    refreshFmtStates();
  }
  // Preview the box-level OpenType features on the live editable (ligatures /
  // stylistic alternates). 'normal' explicitly re-enables defaults, overriding
  // any stale value baked into the box's rendered style.
  function applyFeaturePreview(): void {
    if (!editing) return;
    const boxes = getBoxes();
    const box: Box = boxes[indexOfId(boxes, editing.id)] || {};
    const ligOn = boolOf(pendingOr(cfg.ligaturesField, box[cfg.ligaturesField]), true);
    const altOn = boolOf(pendingOr(cfg.alternatesField, box[cfg.alternatesField]), false);
    editing.el.style.fontFeatureSettings = featureSettings(ligOn, altOn) || 'normal';
  }
  // Toggle a box-level boolean (ligatures/alternates) from the format bar, staged
  // like the other box fields and committed with the text as one undo step.
  function toggleBoxBool(field: string | undefined, dflt: boolean): void {
    if (!editing || !field) return;
    const boxes = getBoxes();
    const box: Box = boxes[indexOfId(boxes, editing.id)] || {};
    applyPending(field, !boolOf(pendingOr(field, box[field]), dflt));
  }
  // Drop the brand emoji trio (🦎💚🐧 / 🐧💚🦎) at the caret and force the box's
  // ligatures ON, so the font can shape the three adjacent glyphs as one ligature.
  // The insert keeps them adjacent; forcing ligatures on means a box that had the
  // feature switched off still shapes them. Staged like the other box fields, so the
  // insert + the ligature toggle land in the SAME commit (one undo step).
  function insertBrandLigature(seq: string): void {
    if (!editing) return;
    editing.el.focus();
    if (cfg.ligaturesField) {
      const box: Box = getBoxes()[indexOfId(getBoxes(), editing.id)] || {};
      if (!boolOf(pendingOr(cfg.ligaturesField, box[cfg.ligaturesField]), true))
        applyPending(cfg.ligaturesField, true);
    }
    // execCommand keeps the contenteditable's own selection model in sync (same path
    // as Enter/paste); the inserted glyphs serialise straight through on commit.
    document.execCommand('insertText', false, seq);
    refreshFmtStates();
  }
  // Strip inline character formatting (bold/italic/weight/colour) from the
  // selection (or the word under the caret). Lists are paragraph-level and kept.
  function clearFormattingSelection(): void {
    if (!editing) return;
    const el = editing.el;
    el.focus();
    const off = selectionOffsets(el);
    if (!off) return;
    let [a, b] = off;
    const chars = charsFromDom(el);
    if (a === b) [a, b] = wordRangeAt(chars, a);
    if (a === b) return;
    el.innerHTML = htmlFromChars(clearFormatting(chars, a, b));
    selectOffsets(el, a, b);
    refreshFmtStates();
  }
  const pendingOr = (field: string | undefined, fallback: any): any =>
    editing && field && field in editing.pending ? editing.pending[field] : fallback;
  function showFmtBar(): void {
    if (fmtbar) return;
    fmtbar = document.createElement('div') as FmtBar;
    fmtbar.className = 'fc-fmtbar';
    fmtbar.setAttribute('data-export-hide', '');
    const refs: FmtRefs = { align: {}, valign: {} };
    // The bar is built as a row of logical GROUPS (type · styles · align · valign ·
    // size · OpenType). Each group is one flex item that never splits internally, so
    // when the bar wraps to a second row it breaks cleanly between groups and the
    // clusters stay legible. `curGroup` is the section buttons land in; section()
    // starts a new one.
    let curGroup: HTMLElement = fmtbar;
    const section = (): HTMLElement => {
      const g = document.createElement('span');
      g.className = 'fc-fmt-group';
      fmtbar!.appendChild(g);
      curGroup = g;
      return g;
    };
    const mk = (label: string, html: string, run: () => void): HTMLButtonElement => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'fc-cbtn';
      b.setAttribute('data-tip', label);
      b.setAttribute('aria-label', label);
      b.innerHTML = html;
      // preventDefault on pointerdown keeps the caret/selection in the editable
      // (focus never leaves → the toggle hits the live selection, no blur/commit).
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        run();
      });
      curGroup.appendChild(b);
      return b;
    };
    const boxes = getBoxes();
    const box: Box = boxes[indexOfId(boxes, editing?.id)] || {};
    // Type pill - font, weight and text colour joined into ONE connected control
    // (a single left→right run: font → weight → colour). These are the type
    // settings reached for most while typing; the weight menu is seeded from the
    // font so it sits between them. CSS collapses the inner borders so the three
    // read as one pill - only the pill's outer corners round.
    const typeGroup = document.createElement('span');
    typeGroup.className = 'fc-fmt-typegroup';
    if (cfg.fontField) {
      const fsel = document.createElement('select');
      fsel.className = 'field-select field-select--sm field-select--auto fc-fmt-font';
      fsel.setAttribute('data-tip', t('Font'));
      fsel.setAttribute('aria-label', t('Font'));
      fsel.innerHTML = fontOptionsHtml();
      fsel.addEventListener('pointerdown', (e) => e.stopPropagation());
      fsel.addEventListener('change', () => {
        const font = fsel.value;
        applyPending(cfg.fontField, font);
        if (cfg.weightField && isMonoFont(font)) {
          const bx: Box = getBoxes()[indexOfId(getBoxes(), editing!.id)] || {};
          if ((parseInt(pendingOr(cfg.weightField, bx[cfg.weightField]), 10) || 700) > 800)
            applyPending(cfg.weightField, '800');
        }
        if (refs.weight) {
          // the run-weight menu's choices depend on the font
          const cur = refs.weight.value;
          refs.weight.innerHTML =
            `<option value="">${t('Auto')}</option>` +
            weightChoicesFor(font)
              .map(([v, l]) => `<option value="${v}">${escape(t(l))}</option>`)
              .join('');
          refs.weight.value = weightChoicesFor(font).some(([v]) => v === cur) ? cur : '';
        }
      });
      typeGroup.appendChild(fsel);
      refs.font = fsel;
    }
    // Weight (per-selection) sits right after the font - its menu depends on the
    // font - and before the colour. "Auto" = no explicit run weight (the run
    // inherits the box weight); refreshFmtStates fills it from the selected run.
    if (cfg.weightField) {
      const sel = document.createElement('select');
      sel.className = 'field-select field-select--sm field-select--auto fc-fmt-weight';
      sel.setAttribute('data-tip', t('Weight of the selected text'));
      sel.setAttribute('aria-label', t('Weight of the selected text'));
      const font = String((cfg.fontField && box[cfg.fontField]) || defaultFont);
      sel.innerHTML =
        `<option value="">${t('Auto')}</option>` +
        weightChoicesFor(font)
          .map(([v, l]) => `<option value="${v}">${escape(t(l))}</option>`)
          .join('');
      sel.value = '';
      // Stash the selection on engage (the select steals focus/selection when it
      // opens); no preventDefault - the select needs focus, and the onEditBlur guard
      // recognises the bar so the edit survives the round trip.
      sel.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        stashRunWeightRange();
      });
      sel.addEventListener('change', () =>
        applyRunWeight(sel.value === '' ? null : parseInt(sel.value, 10))
      );
      typeGroup.appendChild(sel);
      refs.weight = sel;
    }
    // Per-selection text colour (distinct from the whole-box fg on the object bar)
    // - closes the pill.
    if (cfg.textColorField) {
      const cw = document.createElement('span');
      cw.className = 'fc-cfield fc-fmt-color';
      cw.innerHTML = colorFieldHtml('fc-runcolor', box[cfg.textColorField] || '#0c322c', {
        float: true,
      });
      // Capture the selection before the picker takes focus (capture phase catches the
      // trigger's pointerdown; later swatch clicks find no selection and keep the stash).
      cw.addEventListener('pointerdown', () => stashRunColorRange(), true);
      typeGroup.appendChild(cw);
      wireColorField(cw, { onChange: (_id, val) => applyRunColor(unwrapColor(val)) });
    }
    // Type section - the connected font·weight·colour pill plus the "reset
    // formatting" button (T-with-a-slash: strips bold/italic/weight/colour from the
    // selection, keeping paragraph structure). Grouped so the pill and its reset
    // never split across a wrapped row.
    if (typeGroup.childElementCount || cfg.textColorField) {
      const g = section();
      if (typeGroup.childElementCount) g.appendChild(typeGroup);
      if (cfg.textColorField)
        refs.clear = mk(t('Reset text formatting'), icon(SVG.resetColor), () =>
          clearFormattingSelection()
        );
    }
    // Character styles - bold / italic / bulleted + numbered lists.
    section();
    refs.b = mk(t('Bold (⌘B)'), '<b>B</b>', () => toggleInline('b'));
    refs.i = mk(t('Italic (⌘I)'), '<i style="font-family:serif">I</i>', () => toggleInline('i'));
    refs.bullet = mk(t('Bulleted list'), icon(SVG.bulletList), () => toggleBullet());
    refs.numbers = mk(t('Numbered list'), '<b style="font-size:11px">1.</b>', () => toggleNumber());
    // How the copy sits in its box: horizontal alignment, then vertical - each its
    // own group so the two icon-runs read apart.
    if (cfg.alignField) {
      section();
      for (const [v, label, ic] of [
        ['left', 'Align left', SVG.textL],
        ['center', 'Align centre', SVG.textC],
        ['right', 'Align right', SVG.textR],
      ] as Array<[string, string, string]>) {
        refs.align[v] = mk(t(label), icon(ic), () => applyPending(cfg.alignField, v));
      }
    }
    if (cfg.valignField) {
      section();
      for (const [v, label, ic] of [
        ['top', 'Align to top', SVG.textT],
        ['middle', 'Centre vertically', SVG.textM],
        ['bottom', 'Align to bottom', SVG.textB],
      ] as Array<[string, string, string]>) {
        refs.valign[v] = mk(t(label), icon(ic), () => applyPending(cfg.valignField, v));
      }
    }
    // Size steppers - the weight menu moved into the type pill, so this trailing
    // group is just the A− / A+ font-size nudges.
    if (cfg.fontSizeField) {
      section();
      mk(t('Smaller text'), 'A−', () => bumpPendingFont(-6));
      mk(t('Bigger text'), 'A+', () => bumpPendingFont(6));
    }
    // OpenType features (whole-box, staged): ligatures + stylistic alternates, plus
    // the brand-ligature inserter.
    if (cfg.ligaturesField || cfg.alternatesField) {
      section();
      if (cfg.ligaturesField)
        refs.lig = mk(t('Ligatures'), '<span style="font-size:13px">fi</span>', () =>
          toggleBoxBool(cfg.ligaturesField, true)
        );
      if (cfg.alternatesField)
        refs.alt = mk(t('Stylistic alternates'), '<span style="font-size:13px">a͎</span>', () =>
          toggleBoxBool(cfg.alternatesField, false)
        );
      // Geeko 💚 Tux - drops the brand emoji trio at the caret and forces ligatures
      // on so the font can shape the three adjacent glyphs as one ligature. Plain
      // click inserts 🦎💚🐧; ⌥/Alt-click flips to penguin-first (🐧💚🦎). Gated on
      // the ligatures field since it turns that feature on.
      if (cfg.ligaturesField) {
        const emo = document.createElement('button');
        emo.type = 'button';
        emo.className = 'fc-cbtn fc-fmt-emoji';
        emo.setAttribute('data-tip', t('Insert 🦎💚🐧 - turns ligatures on (⌥-click for 🐧💚🦎)'));
        emo.setAttribute('aria-label', t('Insert Geeko loves Tux'));
        emo.textContent = '🦎💚🐧';
        emo.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          e.stopPropagation();
        });
        emo.addEventListener('click', (e) => {
          e.stopPropagation();
          insertBrandLigature(e.altKey ? '🐧💚🦎' : '🦎💚🐧');
        });
        curGroup.appendChild(emo);
        refs.emoji = emo;
      }
    }
    fmtbar._refs = refs;
    overlay.appendChild(fmtbar);
  }
  function bumpPendingFont(delta: number): void {
    if (!editing || !cfg.fontSizeField) return;
    const boxes = getBoxes();
    const box: Box = boxes[indexOfId(boxes, editing.id)] || {};
    const cur = parseFloat(pendingOr(cfg.fontSizeField, box[cfg.fontSizeField]));
    const base = Number.isFinite(cur) ? cur : 48;
    applyPending(cfg.fontSizeField, Math.max(4, base + delta));
  }
  // Reflect the live state on the bar: B/I from the selection (or the word under
  // the caret), bullets/alignment/weight from the box row + pending overrides.
  function refreshFmtStates(): void {
    if (!fmtbar || !editing) return;
    const r = (fmtbar._refs || {}) as FmtRefs;
    const chars = charsFromDom(editing.el);
    let [a, b] = selectionOffsets(editing.el) || [chars.length, chars.length];
    if (a === b) [a, b] = wordRangeAt(chars, a);
    r.b?.classList.toggle('is-on', rangeHasFlag(chars, a, b, 'b'));
    r.i?.classList.toggle('is-on', rangeHasFlag(chars, a, b, 'i'));
    r.bullet?.classList.toggle('is-on', allBulleted(chars));
    r.numbers?.classList.toggle('is-on', allNumbered(chars));
    const boxes = getBoxes();
    const box: Box = boxes[indexOfId(boxes, editing.id)] || {};
    const alignCur = String(pendingOr(cfg.alignField, box[cfg.alignField] || 'center'));
    const valignCur = String(pendingOr(cfg.valignField, box[cfg.valignField] || 'middle'));
    for (const [v, btn] of Object.entries(r.align)) btn.classList.toggle('is-on', v === alignCur);
    for (const [v, btn] of Object.entries(r.valign)) btn.classList.toggle('is-on', v === valignCur);
    if (r.weight && document.activeElement !== r.weight) {
      // The weight picker reflects the SELECTED RUN's explicit weight (or Auto).
      const rw = rangeWeight(chars, a, b);
      r.weight.value = rw != null ? String(rw) : '';
    }
    // Whole-box font + OpenType feature toggles (staged in pending).
    if (r.font && document.activeElement !== r.font) {
      r.font.value = String(pendingOr(cfg.fontField, box[cfg.fontField]) || defaultFont);
    }
    r.lig?.classList.toggle(
      'is-on',
      boolOf(pendingOr(cfg.ligaturesField, box[cfg.ligaturesField]), true)
    );
    r.alt?.classList.toggle(
      'is-on',
      boolOf(pendingOr(cfg.alternatesField, box[cfg.alternatesField]), false)
    );
  }
  function hideFmtBar(): void {
    fmtbar?.remove();
    fmtbar = null;
  }
  function positionFmtBar(): void {
    if (!fmtbar || !editing) return;
    const boxes = getBoxes();
    const i = indexOfId(boxes, editing.id);
    if (i < 0) return;
    const m = metrics();
    const aabb = selectionAABB(boxes, [i], cfg);
    if (!aabb) return;
    const tl = nativeToStage(aabb.minX, aabb.minY, m);
    const br = nativeToStage(aabb.maxX, aabb.minY, m);
    const bottomY = nativeToStage(aabb.minX, aabb.maxY, m).y;
    const bw = fmtbar.offsetWidth || 0;
    const bh = fmtbar.offsetHeight || 44;
    const GAP = 8;
    fmtbar.style.left =
      Math.max(6, Math.min((tl.x + br.x) / 2 - bw / 2, m.sr.width - bw - 6)) + 'px';
    // Seat the WHOLE bar above the box using its real height (the two-row
    // colour version is ~90px - a fixed offset let it dip onto the first line).
    // If there's no room above, flip below the box; clamp to the stage so a
    // tall/off-screen box pins the bar to a visible edge, never over the text.
    const above = tl.y - bh - GAP;
    const top = above >= 6 ? above : Math.min(bottomY + GAP, m.sr.height - bh - 6);
    fmtbar.style.top = Math.max(6, top) + 'px';
  }

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
  const TWO_TAP_MS = 500;
  const TWO_TAP_SLOP = 14; // SCREEN px, per finger
  interface TouchPt {
    x: number;
    y: number;
    moved: number;
  }
  const touchPts = new Map<number, TouchPt>();
  let twoTapStart = 0; // when the second finger landed (0 = not a candidate)
  let twoTapDone = false; // menu already opened for this touch sequence

  // Capture phase on the STAGE, so this runs before onCanvasPointerDown (bound to the
  // canvas, a descendant) and that handler can see the second finger has arrived.
  function onStageTouchDown(e: PointerEvent): void {
    if (e.pointerType === 'mouse') return;
    touchPts.set(e.pointerId, { x: e.clientX, y: e.clientY, moved: 0 });
    if (touchPts.size === 2) {
      twoTapStart = e.timeStamp || Date.now();
      twoTapDone = false;
    } else if (touchPts.size > 2) twoTapStart = 0; // three fingers is not a tap
  }
  function onStageTouchMove(e: PointerEvent): void {
    const p = touchPts.get(e.pointerId);
    if (!p) return;
    p.moved = Math.max(p.moved, Math.hypot(e.clientX - p.x, e.clientY - p.y));
    if (p.moved > TWO_TAP_SLOP) twoTapStart = 0; // a pan or a pinch, not a tap
  }
  function onStageTouchUp(e: PointerEvent): void {
    if (e.pointerType === 'mouse') return;
    const pts = [...touchPts.values()];
    const when = e.timeStamp || Date.now();
    if (
      twoTapStart &&
      !twoTapDone &&
      pts.length === 2 &&
      when - twoTapStart <= TWO_TAP_MS &&
      pts.every((p) => p.moved <= TWO_TAP_SLOP)
    ) {
      twoTapDone = true; // the OTHER finger's up must not re-open it
      twoTapStart = 0;
      if (gesture) endGesture(); // neither finger commits a (zero-delta) drag
      contextMenuAt((pts[0]!.x + pts[1]!.x) / 2, (pts[0]!.y + pts[1]!.y) / 2, false);
    }
    touchPts.delete(e.pointerId);
    if (!touchPts.size) {
      twoTapStart = 0;
      twoTapDone = false;
    }
  }

  // Pen-DRAW placement and armed-CREATE, factored out so BOTH the in-frame handler
  // (onCanvasPointerDown, bound to canvasEl) and the off-frame handler
  // (onBackdropPointerDown, bound to the stage) share one implementation. The frame is
  // canvasEl's own hit box, so without this a click on the empty stage OUTSIDE the frame
  // never reaches the pen/create logic - you couldn't start a node or add an object off
  // the artboard even though clientToNative maps such points fine and the gesture, once
  // begun, already captures the pointer anywhere. Each returns true when it handled the
  // event (the caller then stops propagation).
  function tryPenDrawAt(e: PointerEvent, nat: Point): boolean {
    if (mode !== 'pen') return false;
    const tol = penTol();
    if (penDraft && closesOnClick(penDraft.nodes, nat.x, nat.y, tol)) {
      penDraft = { ...penDraft, closed: true };
      penFinishDraw();
      return true;
    }
    let px = nat.x,
      py = nat.y;
    if (gridOn && !e.altKey) {
      px = gridRound(px);
      py = gridRound(py);
    }
    const snap = snapPoint(
      px,
      py,
      otherAABBs(getBoxes(), new Set<number>()) as MathAABB[],
      canvasWH(),
      snapThreshNative(),
      authoringGuides?.snapTargets()
    );
    drawGuides(snap.guides);
    penPlaceNode(e, { x: snap.x, y: snap.y }, e.altKey);
    return true;
  }
  function tryArmedCreateAt(e: PointerEvent, nat: Point): boolean {
    if (!armedKind) return false;
    // The sentence has been acted on - take it down at the START of the gesture, not at
    // its commit, or it sits over the rubber band describing something already happening.
    hideArmHint();
    beginGesture(e, {
      type: 'create',
      origin: nat,
      seed: armedKind.seed || {},
      others: otherAABBs(getBoxes(), new Set<number>()),
    });
    rubber.hidden = false;
    return true;
  }
  // Line tool press: start a line at the pressed point. The drag previews the rubber;
  // release commits a two-node path box (see onGestureEnd). Snapped and grid-rounded the
  // same way a pen node and a created box are, so a line lands on the guides the rest of
  // the editor draws. Alt opts out of both, exactly as it does for the pen.
  function tryLineDrawAt(e: PointerEvent, nat: Point): boolean {
    if (mode !== 'line' || !cfg.pathField) return false;
    const at = lineSnap(nat, e.altKey);
    beginGesture(e, { type: 'line', origin: at });
    drawLineRubber(at, at);
    return true;
  }
  /** A line endpoint's landing spot: grid first (when the grid is on), then the smart
   *  guides, whose guide lines are drawn as a side effect - the same order tryPenDrawAt
   *  uses, so the two gestures agree about where "here" is. */
  function lineSnap(nat: Point, alt: boolean): Point {
    let px = nat.x,
      py = nat.y;
    if (gridOn && !alt) {
      px = gridRound(px);
      py = gridRound(py);
    }
    if (alt) {
      clearGuides();
      return { x: px, y: py };
    }
    const snap = snapPoint(
      px,
      py,
      otherAABBs(getBoxes(), new Set<number>()) as MathAABB[],
      canvasWH(),
      snapThreshNative(),
      authoringGuides?.snapTargets()
    );
    drawGuides(snap.guides);
    return { x: snap.x, y: snap.y };
  }

  function onCanvasPointerDown(e: PointerEvent): void {
    if (e.button > 0) return; // primary button / touch only
    lastPointerKind = e.pointerType || '';
    // A second finger belongs to a stage gesture (pan / pinch / two-finger tap), never to
    // a box drag - and the first finger's gesture is abandoned so no drag commits.
    if (e.pointerType !== 'mouse' && touchPts.size > 1) {
      // A node the FIRST finger placed is retracted, not just abandoned: the create gesture
      // above commits nothing until release, but a pen node is already in the draft, and a
      // two-finger pan must not litter the shape being drawn with the point it started on.
      if (gesture?.type === 'pendraw') {
        endGesture();
        penUndoNode();
        return;
      }
      if (gesture) endGesture();
      return;
    }
    if (editing) {
      if (editing.el.contains(e.target as Node)) return; // let the caret move within the text
      commitTextEdit(); // clicked elsewhere → commit, then select
    }
    closePopover();
    const nat = clientToNative(e.clientX, e.clientY);
    const boxes = getBoxes();

    // Line tool: press starts a line (drag → release attaches to a card or floats free).
    if (tryLineDrawAt(e, nat)) {
      e.stopPropagation();
      e.preventDefault();
      return;
    }

    // Pen - DRAWING. Click places a node; the drag that follows pulls its handles out
    // symmetrically; a click on the first node closes the path. Nothing about the box
    // selection model runs here, which is why Alt is free to mean "corner". Shared with
    // the off-frame handler so a path can be started/extended outside the artboard.
    if (tryPenDrawAt(e, nat)) {
      e.stopPropagation();
      e.preventDefault();
      return;
    }

    // Pen - NODE EDITING. Handles first (smaller, and outside the curve), then nodes, then
    // the curve itself (a click on it inserts), and only then a marquee over the nodes.
    if (penEdit) {
      const fr = penEdit.frame;
      const loc = frameToLocal(fr, nat.x, nat.y);
      const tol = penTol();
      const hh = penHandleAt(loc.x, loc.y, tol);
      if (hh) {
        const key = `${hh.index}:${hh.which}`;
        // Shift/⌘-click a control point TOGGLES it into the point selection (for align /
        // distribute) rather than dragging it - the handle equivalent of shift-clicking a
        // node. A plain click drags it (a direct edit), and clears any point selection.
        if (e.shiftKey || e.metaKey || e.ctrlKey) {
          penHandleSel.has(key) ? penHandleSel.delete(key) : penHandleSel.add(key);
          ctxSelKey = null;
          renderChrome();
          e.stopPropagation();
          e.preventDefault();
          return;
        }
        penHandleSel = new Set<string>();
        setPathSvgHidden(true);
        beginGesture(e, { type: 'penhandle', origin: nat, index: hh.index, which: hh.which });
        e.stopPropagation();
        e.preventDefault();
        return;
      }
      const ni = nodeAt(penEdit.path, loc.x, loc.y, tol);
      if (ni >= 0) {
        if (e.shiftKey || e.metaKey || e.ctrlKey) {
          penSel.has(ni) ? penSel.delete(ni) : penSel.add(ni);
        } else if (!penSel.has(ni)) {
          penSel = new Set([ni]);
          penHandleSel = new Set<string>();
        }
        setPathSvgHidden(true);
        const indices = penSel.size ? [...penSel] : [ni];
        beginGesture(e, {
          type: 'pennode',
          origin: nat,
          indices,
          start: penEdit.path.nodes.map((n) => ({ ...n })),
          // plan 96 P3: dragging exactly ONE of the path's two ends is the bind gesture.
          // Two nodes at once is a reshape, and an interior node has no end to attach.
          bindEnd: bindEndFor(indices),
        });
        ctxSelKey = null; // the continuity control reflects the new pick
        renderChrome();
        e.stopPropagation();
        e.preventDefault();
        return;
      }
      // Is the click on ANY contour's curve? Lower each on its own (lowering the combined run
      // as one path would draw - and hit - a phantom segment joining one glyph to the next),
      // and take the nearest across all. penInsertAt then reshapes whichever contour that was.
      const contours = penContours();
      let hitD = Infinity;
      for (const p of contours) {
        const low = lowerAuthored(p, contours.length === 1 ? penWarm : null);
        const h = low.cubics.length ? nearestOnPath(low.cubics, loc.x, loc.y) : null;
        if (h && h.distance < hitD) hitD = h.distance;
      }
      if (hitD <= PEN_CURVE_PX / penScale()) {
        penInsertAt(loc.x, loc.y);
        e.stopPropagation();
        e.preventDefault();
        return;
      }
      beginGesture(e, { type: 'penmarquee', origin: nat, additive: e.shiftKey || e.metaKey });
      rubber.hidden = false;
      e.stopPropagation();
      e.preventDefault();
      return;
    }

    if (tryArmedCreateAt(e, nat)) {
      e.stopPropagation();
      e.preventDefault();
      return;
    }

    // Node tool: a click on a PATH box jumps straight into editing its nodes (the click
    // that would otherwise just select it). Non-path boxes fall through to normal select,
    // so the tool doesn't trap you on a shape it can't edit. Runs only when no node-edit
    // session is live (that case is handled by the penEdit block above).
    if (nodeToolActive && vectorCfg && !penEdit) {
      const nh = pickTopmost(boxes, nat.x, nat.y, cfg, seqHiddenSkip(boxes));
      if (nh >= 0 && boxOutlineKind(boxes[nh], vectorCfg) === 'path') {
        startPenEdit(idOf(boxes[nh], nh));
        e.stopPropagation();
        e.preventDefault();
        return;
      }
    }

    const hit = selectHit(boxes, nat.x, nat.y); // artboard-aware: a child over a frame wins; the frame takes an empty-area/edge click
    if (hit >= 0) {
      deselectEdge(); // picking a card drops any connector selection
      const id = idOf(boxes[hit], hit);
      const additive = e.shiftKey || e.metaKey || e.ctrlKey || multiTapMode;
      const hitSel = selectionForHit(boxes, hit, e.altKey); // whole group, or Alt = just this box
      // A plain click on a box that is ALREADY in a multi-selection means "just this one"
      // (plan 179 C4) - but the same press is also the start of a drag of everything
      // selected, and narrowing here would make every group move impossible. So the
      // intention is recorded and settled at pointerup, once we know whether the pointer
      // moved. Nothing is narrowed when the click lands on the only thing selected.
      let narrow: string[] | undefined;
      if (additive) {
        const anyIn = hitSel.some((x) => selection.has(x));
        for (const x of hitSel) anyIn ? selection.delete(x) : selection.add(x);
      } else if (!selection.has(id)) {
        selection = new Set(hitSel);
      } else if (selection.size > hitSel.length) {
        narrow = hitSel;
      }
      renderChrome();
      // Start a move for the whole current selection.
      const start = new Map<number, Rect>();
      const sel = selIndices(boxes);
      for (const i of sel) start.set(i, boxRect(boxes[i], cfg));
      beginGesture(e, {
        type: 'move',
        start,
        sel,
        narrow,
        selAABB: selectionAABB(boxes, sel, cfg),
        others: otherAABBs(boxes, new Set(sel)),
      });
      e.stopPropagation();
      return;
    }

    // No card under the pointer - try a connector line (they render behind the cards).
    if (connectCfg) {
      const eid = edgeAt(nat.x, nat.y);
      if (eid) {
        selectEdge(eid, e.shiftKey || e.metaKey || e.ctrlKey);
        e.stopPropagation();
        return;
      }
    }
    deselectEdge(); // clicked empty → drop any connector selection

    // Empty canvas - or the CAMERA's, when one is selected and running (plans/104 section 8).
    // The camera takes the drag the marquee would have had: there is nothing on the
    // empty stage for a marquee to catch that a camera user is reaching for, and
    // clicking any box hands the gesture straight back by ordinary selection.
    // SHIFT IS THE TILT (P2 - section 8 reserved the chord at M2.5 and this milestone spends
    // it). The additive marquee keeps shift everywhere else, including on this very
    // canvas the moment no camera is armed: `camModeId()` is a selection state the user
    // can see, so the chord is never quietly reassigned under them.
    if (e.pointerType === 'mouse' && camModeId()) {
      beginGesture(e, {
        type: e.shiftKey ? 'camtilt' : 'campan',
        client: { x: e.clientX, y: e.clientY },
        dx: 0,
        dy: 0,
      });
      startCamHud(e.shiftKey);
      e.stopPropagation();
      return;
    }
    if (e.pointerType === 'mouse') {
      beginGesture(e, { type: 'marquee', origin: nat, additive: e.shiftKey || e.metaKey });
      rubber.hidden = false;
      e.stopPropagation();
    } else {
      // Let stageNav own touch pan/pinch on empty canvas; arm a tap-to-deselect.
      gesture = {
        type: 'tap',
        pointerId: e.pointerId,
        startClient: { x: e.clientX, y: e.clientY },
      };
    }
  }

  // Clicking the stage/view backdrop OUTSIDE the artboard deselects, just like clicking the
  // empty canvas inside it (onCanvasPointerDown is bound to canvasEl, so those clicks never
  // reached it). Guarded to a DIRECT hit on the backdrop element (target === currentTarget)
  // so a bubbled event from a box, toolbar, popover or the canvas never triggers it. Doesn't
  // stopPropagation, so stageNav's pan on a backdrop drag is unaffected.
  function onBackdropPointerDown(e: PointerEvent): void {
    if (e.button > 0 || e.target !== e.currentTarget) return;
    if (editing) commitTextEdit();
    // Off-frame click while DRAWING places/extends a node (not "finish"), and off-frame
    // click while an Add is armed starts the create - the same as inside the artboard, so
    // the whole stage is usable, not just the export frame. These come FIRST, before the
    // "clicking off the artboard means I'm done" fallbacks below.
    const natBd = clientToNative(e.clientX, e.clientY);
    if (tryPenDrawAt(e, natBd)) {
      e.stopPropagation();
      e.preventDefault();
      return;
    }
    if (tryArmedCreateAt(e, natBd)) {
      e.stopPropagation();
      e.preventDefault();
      return;
    }
    if (tryLineDrawAt(e, natBd)) {
      e.stopPropagation();
      e.preventDefault();
      return;
    }
    // Clicking right off the artboard is the natural "I'm done" for a node-edit session,
    // and it matches what the same click already does to a selection. (A pen DRAFT is no
    // longer finished here - an off-frame click extends it, handled above.)
    if (penEdit) {
      endPenEdit();
      return;
    }
    closePopover();
    deselectEdge();
    // A SHIFT/⌘ drag is additive, so it must not wipe what is already selected - same
    // rule the in-artboard marquee follows.
    const additive = e.shiftKey || e.metaKey;
    if (selection.size && !additive) selection = new Set<string>();
    renderChrome();
    // …and a plain left-drag out here MARQUEES, exactly as it does over the artboard.
    // Nothing claimed that gesture before: stageNav pans on middle-drag or Space+drag
    // and lets plain left-clicks through, while the marquee lived on canvasEl - so a
    // left-drag on the backdrop fell between the two and did nothing at all, which is
    // what made the whole area outside the artboard feel inert.
    // Touch is left alone: stageNav owns one-finger pan there, as it does inside.
    if (e.pointerType !== 'mouse' || spacePan) return;
    // …and the CAMERA takes it first when one is armed (plans/104 section 8), exactly as it
    // does over the artboard: the backdrop is empty stage too, and a camera pan that
    // stopped at the artboard's edge would be a gesture with an invisible boundary.
    if (camModeId()) {
      beginGesture(e, {
        type: e.shiftKey ? 'camtilt' : 'campan',
        client: { x: e.clientX, y: e.clientY },
        dx: 0,
        dy: 0,
      });
      startCamHud(e.shiftKey);
      return;
    }
    beginGesture(e, { type: 'marquee', origin: clientToNative(e.clientX, e.clientY), additive });
    rubber.hidden = false;
    // The gesture captures the pointer on canvasEl, so the move/up handlers bound there
    // keep receiving it even though the drag started outside.
  }

  /** Right-click on the backdrop opens the SAME menu as right-click on empty artboard -
   *  guarded to a direct hit so a bubbled event from a box or the toolbar can't reach it. */
  function onBackdropContextMenu(e: MouseEvent): void {
    if (e.target !== e.currentTarget) return;
    onContextMenu(e);
  }

  /** Space is stageNav's pan modifier (Space+left-drag). Tracked here only so the
   *  backdrop marquee yields to it - stageNav owns the pan and exposes no state. */
  let spacePan = false;
  function onSpaceKey(e: KeyboardEvent): void {
    if (e.code === 'Space' && !isTypingTarget()) spacePan = e.type === 'keydown';
  }

  // pointermove fires far faster than paint (60–120 Hz); coalesce to one rAF per frame so
  // the heavy path (snap + live rects + connector redraw) runs at most once per paint.
  let pendingMove: PointerEvent | null = null;
  let moveRaf = 0;
  function onGestureMove(e: PointerEvent): void {
    if (!gesture || e.pointerId !== gesture.pointerId) return;
    if (gesture.type === 'tap') return; // stageNav owns it; only checked on up
    e.preventDefault(); // must be synchronous to suppress scroll/text-select
    pendingMove = e;
    if (!moveRaf) moveRaf = requestAnimationFrame(flushGestureMove);
  }
  function flushGestureMove(): void {
    moveRaf = 0;
    const e = pendingMove;
    pendingMove = null;
    if (e) applyGestureMove(e);
  }
  function applyGestureMove(e: PointerEvent): void {
    if (!gesture || e.pointerId !== gesture.pointerId) return;
    const nat = clientToNative(e.clientX, e.clientY);
    const dxN =
      nat.x - (gesture.origin?.x ?? clientToNative(gesture.startClient.x, gesture.startClient.y).x);
    const dyN =
      nat.y - (gesture.origin?.y ?? clientToNative(gesture.startClient.x, gesture.startClient.y).y);

    if (gesture.type === 'marquee' || gesture.type === 'penmarquee') {
      drawRubber(gesture.origin, nat);
      return;
    }
    // CAMERA PAN (plans/104 section 8). Accumulate in NATIVE px and write nothing: the
    // projection is applied by the sequence DOM applier off the model, so the one
    // honest preview is the commit itself - which is why section 8's gesture law for the
    // camera is "drags commit on release", not "on move".
    //
    // Native, not client, because the model is native: `camX` is stage px, and the
    // picture it displaces is on screen at the canvas zoom. Accumulating client px and
    // writing them as model px made a 200 px drag move the shot 100 screen px at 50 %
    // zoom and 400 at 200 % - the picture sliding out from under the cursor, which is
    // the opposite of the direct manipulation the release handler promises and every
    // other drag here performs (`marquee`, `move`, `resize`, `pen` all convert first).
    if (gesture.type === 'campan') {
      const prev = clientToNative(gesture.client.x, gesture.client.y);
      gesture.dx += nat.x - prev.x;
      gesture.dy += nat.y - prev.y;
      gesture.client = { x: e.clientX, y: e.clientY };
      showCamPanHud(gesture.dx, gesture.dy);
      return;
    }
    // …and its shifted twin, in CLIENT px (see CamTiltGesture: an angle has no length
    // in stage space, so a zoom-relative gearing would be gearing by accident).
    if (gesture.type === 'camtilt') {
      gesture.dx += e.clientX - gesture.client.x;
      gesture.dy += e.clientY - gesture.client.y;
      gesture.client = { x: e.clientX, y: e.clientY };
      // The HUD shows the ABSOLUTE landing tilt, so it maps the drag to the same deltas
      // the release will (`rx = -dy·K`, `ry = dx·K`) and asks the panel to compose+clamp.
      showCamTiltHud(-gesture.dy * CAM_TILT_DEG_PER_PX, gesture.dx * CAM_TILT_DEG_PER_PX);
      return;
    }
    // Pen: pull the just-placed node's handles out, the universal click-and-drag idiom.
    // Symmetrically by default; Alt BREAKS the pair and steers only the outgoing arm, which
    // is the gesture tracing lives on - it is how a curve turns a corner into a new curve
    // without giving up the one already drawn. Alt with no drag still places a hard corner,
    // because the break only takes effect past `PEN_PULL_MIN`.
    if (gesture.type === 'pendraw') {
      if (!penDraft) return;
      const i = gesture.index;
      const n = penDraft.nodes[i];
      if (!n) return;
      const pulled =
        Math.hypot(nat.x - gesture.origin.x, nat.y - gesture.origin.y) > PEN_PULL_MIN / penScale();
      // A click-DRAG is the Bézier idiom: it names a direction AND a length. `hyperbezier`
      // can only honour the direction, and only within a right angle of its chord - past
      // that `hbArm`'s signed shape function puts the control arm on the far side of the
      // node, so the curve leaves in the OPPOSITE direction to the drag, and approaching
      // 90° the arm collapses to zero so the drag stops mattering at all. That is
      // deliberate in the solver (see `hbArm`'s comment: clamping costs convergence), so
      // the fix belongs here: the first real pull promotes the draft to `cubic`, whose
      // lowering honours the handle exactly. The bake is lossless (see `convertKind`), so
      // the shape drawn so far does not move, and the kind pill flips to say what happened.
      if (penDraft.kind === 'hyperbezier' && pulled) {
        penDraft = convertKind(penDraft, 'cubic', penWarm).path;
        penWarm = null;
        announce(t('Switched to Bezier handles - this curve kind honours the handle you drag.'));
        renderChrome();
      }
      const nodes = penDraft.nodes.slice();
      const cur = nodes[i] ?? n; // re-read: the promotion above rebuilds the node array
      const dx = nat.x - gesture.origin.x,
        dy = nat.y - gesture.origin.y;
      const at = { ...cur, x: gesture.origin.x, y: gesture.origin.y };
      // Whichever branch runs owns the node's continuity outright: `pullHandles` refuses a
      // `corner` node, and `defaultContinuity` is `'corner'` for every kind except
      // `hyperbezier` - so without this a click-drag in a `cubic` draft silently did nothing.
      // Breaking keeps `hIn` exactly where it is: on the first broken frame that is the arm
      // the bake left holding the segment already drawn, so "keep what is behind me, aim what
      // is ahead" needs no recomputation.
      if (e.altKey) penPullBroken = true;
      nodes[i] = !pulled
        ? at
        : penPullBroken
          ? { ...at, continuity: 'corner', hOutX: dx, hOutY: dy }
          : pullHandles({ ...at, continuity: 'smooth' }, dx, dy);
      penDraft = { ...penDraft, nodes };
      paintPen();
      positionPenChrome();
      return;
    }
    if (gesture.type === 'pennode') {
      if (!penEdit) return;
      // The pointer snaps against sibling boxes and the artboard exactly as a create/resize
      // drag does - same helper, same `.fc-guides` layer, Alt suppresses it - so a node can
      // be landed on a neighbour's edge without a second snapping system existing.
      let sx = nat.x,
        sy = nat.y;
      if (!e.altKey) {
        if (gridOn) {
          sx = gridRound(sx);
          sy = gridRound(sy);
        }
        const snap = snapPoint(
          sx,
          sy,
          otherAABBs(getBoxes(), new Set([indexOfId(getBoxes(), penEdit.id)])) as MathAABB[],
          canvasWH(),
          snapThreshNative(),
          authoringGuides?.snapTargets()
        );
        sx = snap.x;
        sy = snap.y;
        drawGuides(snap.guides);
      } else clearGuides();
      const fr = penEdit.frame;
      const a = frameToLocal(fr, gesture.origin.x, gesture.origin.y);
      const b = frameToLocal(fr, sx, sy);
      gesture.moved = Math.hypot(sx - gesture.origin.x, sy - gesture.origin.y) > 0.01;
      penEdit = {
        ...penEdit,
        path: moveNodes(penEdit.path, gesture.indices, b.x - a.x, b.y - a.y, gesture.start),
      };
      // plan 96 P3 - the bind affordance. The ring follows the pointer, not the node: the
      // node is under the finger and the box is what the drop acts on.
      if (gesture.bindEnd) setBindHover(bindableAt(sx, sy, penEdit.id));
      paintPen();
      positionPenChrome();
      return;
    }
    if (gesture.type === 'penhandle') {
      if (!penEdit) return;
      // No snapping: a handle is not an object edge, so an alignment guide would be a lie.
      // `dragHandle` re-applies the node's continuity on EVERY move, which is what
      // `enforceContinuity` exists for.
      const loc = frameToLocal(penEdit.frame, nat.x, nat.y);
      gesture.moved = true;
      penEdit = {
        ...penEdit,
        path: dragHandle(penEdit.path, gesture.index, gesture.which, loc.x, loc.y),
      };
      paintPen();
      positionPenChrome();
      return;
    }
    if (gesture.type === 'create') {
      let px = nat.x,
        py = nat.y;
      if (gridOn && !e.altKey) {
        px = gridRound(px);
        py = gridRound(py);
      } // land on grid
      const snap = snapPoint(
        px,
        py,
        gesture.others as MathAABB[],
        canvasWH(),
        snapThreshNative(),
        authoringGuides?.snapTargets()
      );
      const corner = { x: snap.x, y: snap.y };
      drawGuides(snap.guides);
      gesture.corner = corner;
      drawRubber(gesture.origin, corner);
      return;
    }
    if (gesture.type === 'line') {
      const to = lineSnap(nat, e.altKey);
      gesture.to = to;
      drawLineRubber(gesture.origin, to);
      return;
    }
    if (gesture.type === 'move') {
      let mdx = dxN,
        mdy = dyN;
      if (gesture.selAABB && !e.altKey) {
        // Smart guides win: snap the RAW drag to any sibling/artboard edge or centre
        // first, so dragging a card onto another's vertical/horizontal line locks it
        // into alignment (even off-grid). The grid then only rounds whichever axis
        // did NOT catch a guide, so cards stay tidy without fighting alignment.
        const cand = {
          minX: gesture.selAABB.minX + dxN,
          minY: gesture.selAABB.minY + dyN,
          maxX: gesture.selAABB.maxX + dxN,
          maxY: gesture.selAABB.maxY + dyN,
        };
        const snap = snapMove(
          cand as MathAABB,
          gesture.others as MathAABB[],
          canvasWH(),
          snapThreshNative(),
          authoringGuides?.snapTargets()
        );
        mdx = dxN + snap.dx;
        mdy = dyN + snap.dy;
        if (gridOn) {
          // An angled guide constrains both coordinates; grid rounding either
          // coordinate afterwards would pull the object back off the line.
          const diagonal = snap.guides.some((g) => g.x1 !== g.x2 && g.y1 !== g.y2);
          const xAligned = diagonal || snap.guides.some((g) => g.x1 === g.x2);
          const yAligned = diagonal || snap.guides.some((g) => g.y1 === g.y2);
          if (!xAligned) mdx = gridRound(gesture.selAABB.minX + dxN) - gesture.selAABB.minX;
          if (!yAligned) mdy = gridRound(gesture.selAABB.minY + dyN) - gesture.selAABB.minY;
        }
        drawGuides(snap.guides);
      } else clearGuides();
      gesture.moveDelta = { dx: mdx, dy: mdy };
      for (const [i, r] of gesture.start) applyLiveRect(i, { ...r, x: r.x + mdx, y: r.y + mdy });
      renderChromeLive();
      liveConnUpdate();
      return;
    }
    if (gesture.type === 'resize') {
      let sdx = dxN,
        sdy = dyN;
      if ((gesture.startRect.rot || 0) === 0 && !e.altKey) {
        let px = nat.x,
          py = nat.y;
        if (gridOn) {
          px = gridRound(px);
          py = gridRound(py);
        }
        const snap = snapPoint(
          px,
          py,
          gesture.others as MathAABB[],
          canvasWH(),
          snapThreshNative(),
          authoringGuides?.snapTargets()
        );
        sdx += snap.x - nat.x;
        sdy += snap.y - nat.y;
        drawGuides(snap.guides);
      } else clearGuides();
      // A circle stays a circle: lock its aspect (1:1) through the resize, as if Shift
      // were held. Its startRect is already square, so any handle keeps w === h.
      const nr = resizeRect(gesture.startRect, gesture.handle, sdx, sdy, {
        minSize,
        keepAspect: e.shiftKey || isCircle(getBoxes()[gesture.index]),
        fromCentre: e.altKey,
      });
      applyLiveRect(gesture.index, { ...nr, rot: gesture.startRect.rot });
      gesture.liveRect = { ...nr, rot: gesture.startRect.rot };
      renderChromeLive();
      liveConnUpdate();
      return;
    }
    if (gesture.type === 'rotate') {
      const c = gesture.centerClient;
      let deg =
        (Math.atan2(e.clientY - c.y, e.clientX - c.x) * 180) / Math.PI -
        gesture.pointerStartDeg +
        gesture.startRect.rot!;
      deg = normAngle(deg); // keep stored rotation in [-180, 180)
      if (!e.altKey) deg = snapAngle(deg, 15, 4);
      const live = { ...gesture.startRect, rot: deg };
      applyLiveRect(gesture.index, live);
      gesture.liveRect = live;
      renderChromeLive();
      return;
    }
    if (gesture.type === 'gscale') {
      const k = Math.hypot(nat.x - gesture.anchor.x, nat.y - gesture.anchor.y) / gesture.origDist;
      const next = scaleGroup(gesture.startBoxes, gesture.sel, gesture.anchor, k, cfg, { minSize });
      for (const i of gesture.sel) applyLiveRect(i, boxRect(next[i], cfg));
      gesture.liveBoxes = next;
      renderChromeLive();
      liveConnUpdate();
      return;
    }
    if (gesture.type === 'grotate') {
      const c = gesture.centerClient;
      let deg =
        (Math.atan2(e.clientY - c.y, e.clientX - c.x) * 180) / Math.PI - gesture.pointerStartDeg;
      if (!e.altKey) deg = snapAngle(deg, 15, 4);
      const next = rotateGroup(gesture.startBoxes, gesture.sel, gesture.centre, deg, cfg);
      for (const i of gesture.sel) applyLiveRect(i, boxRect(next[i], cfg));
      gesture.liveBoxes = next;
      renderChromeLive();
      liveConnUpdate();
      return;
    }
  }

  function onGestureEnd(e: PointerEvent): void {
    if (!gesture || e.pointerId !== gesture.pointerId) return;
    const g = gesture;
    // Apply any pending (coalesced) move first so the drop commits the final pointer
    // position, then drop the scheduled frame.
    if (moveRaf) {
      cancelAnimationFrame(moveRaf);
      moveRaf = 0;
    }
    if (pendingMove) {
      const pe = pendingMove;
      pendingMove = null;
      applyGestureMove(pe);
    }
    try {
      canvasEl.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    endLiveConnectors(); // restore the tool's committed connector layer after a drag

    if (g.type === 'tap') {
      const moved = Math.hypot(e.clientX - g.startClient.x, e.clientY - g.startClient.y);
      if (moved < 6) {
        selection = new Set<string>();
        toPointer();
        renderChrome();
      }
      gesture = null;
      return;
    }

    const nat = clientToNative(e.clientX, e.clientY);
    if (g.type === 'line') {
      const moved = Math.hypot(e.clientX - g.startClient.x, e.clientY - g.startClient.y);
      const to = g.to ?? lineSnap(nat, e.altKey);
      endGesture();
      hideConnectLayer();
      clearGuides();
      // A tap is a mis-click, and a zero-length line is not a shape: neither commits - the
      // same floor `penFinishDraw` puts under a one-node draft.
      if (moved < 6 || (Math.abs(to.x - g.origin.x) < 0.5 && Math.abs(to.y - g.origin.y) < 0.5)) {
        toPointer();
        return;
      }
      commitPathBox(
        {
          kind: 'line',
          closed: false,
          nodes: [
            { x: g.origin.x, y: g.origin.y, continuity: 'corner' },
            { x: to.x, y: to.y, continuity: 'corner' },
          ],
        },
        lineBoxSeed()
      );
      toPointer();
      return;
    }
    const boxes = getBoxes();

    // Pen: placing a node commits NOTHING - the draft is a draft until the path ends, which
    // is what makes the whole drawing one undo step (see `penFinishDraw`).
    if (g.type === 'pendraw') {
      endGesture();
      penCursor = nat;
      paintPen();
      syncPenChrome();
      penCtxBar();
      return;
    }
    if (g.type === 'pennode' || g.type === 'penhandle') {
      const moved = g.moved === true;
      const next = penEdit ? penEdit.path : null;
      // plan 96 P3 - landing an end node ON a box attaches it; landing it anywhere else
      // detaches it. Read BEFORE endGesture(), which clears the hover.
      const bindTo =
        g.type === 'pennode' && g.bindEnd && moved
          ? { which: g.bindEnd, id: bindHover ?? '' }
          : null;
      const editId = penEdit?.id ?? '';
      setPathSvgHidden(false);
      setBindHover(null);
      endGesture();
      if (moved && next) penEditWrite(next);
      else renderChrome();
      if (bindTo && editId) applyBinding(editId, bindTo.which, bindTo.id);
      return;
    }
    if (g.type === 'penmarquee') {
      const moved = Math.hypot(e.clientX - g.startClient.x, e.clientY - g.startClient.y);
      if (penEdit) {
        if (moved < 6) {
          if (!g.additive) {
            penSel = new Set<number>();
            penHandleSel = new Set<string>();
          }
        } else {
          const r = normDragRect(g.origin.x, g.origin.y, nat.x, nat.y, 0);
          const inR = (p: Point): boolean =>
            p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
          const pts = penNodePoints();
          const nodeHits = pts.reduce<number[]>(
            (acc, pt, i) => (inR(pt.at) ? (acc.push(i), acc) : acc),
            []
          );
          // In "nodes + control points" mode, a marquee also grabs any handle whose point
          // falls in the box - the direct-selection behaviour Illustrator/Inkscape users
          // expect. Nodes-only mode (the default) leaves handles alone.
          const handleHits: string[] = [];
          if (penSelectHandles && penEdit && kindReadsHandles(penEdit.path.kind)) {
            pts.forEach((pt, i) => {
              if (pt.hIn && inR(pt.hIn)) handleHits.push(`${i}:in`);
              if (pt.hOut && inR(pt.hOut)) handleHits.push(`${i}:out`);
            });
          }
          if (g.additive) {
            for (const i of nodeHits) penSel.add(i);
            for (const k of handleHits) penHandleSel.add(k);
          } else {
            penSel = new Set(nodeHits);
            penHandleSel = new Set(handleHits);
          }
        }
      }
      endGesture();
      ctxSelKey = null;
      renderChrome();
      return;
    }

    if (g.type === 'create') {
      const moved = Math.hypot(e.clientX - g.startClient.x, e.clientY - g.startClient.y);
      // A circle seed must be born square (seedBox takes its geometry from the drawn
      // rect, not the seed's w/h), so a tap uses one default diameter and a drag squares
      // to its smaller side (anchored at the drag's top-left).
      const circleSeed = cfg.shapeField && String(g.seed?.[cfg.shapeField]) === 'circle';
      // A tap with the Artboard tool means "a page here" - size it to the export/page
      // dimensions, not the tiny generic default. Dragging still sizes it freely.
      const frameSeed = !!frameCfg && String(g.seed?.[cfg.kindField]) === frameCfg.frameKind;
      let rect: Rect;
      if (moved < 6) {
        // A tap (no drag) drops a default-sized box centred on the point.
        const cd = canvasWH();
        const w = frameSeed ? cd.w : circleSeed ? 400 : 320;
        const h = frameSeed ? cd.h : circleSeed ? 400 : 200;
        rect = { x: g.origin.x - w / 2, y: g.origin.y - h / 2, w, h };
      } else {
        const c = g.corner || nat;
        rect = normDragRect(g.origin.x, g.origin.y, c.x, c.y, minSize);
        if (circleSeed) {
          const s = Math.max(minSize, Math.min(rect.w, rect.h));
          rect = { x: rect.x, y: rect.y, w: s, h: s };
        }
      }
      const id = freshId(boxes);
      let box = seedBox(cfg, {}, g.seed, rect as MathRect, id);
      box = clampToWorkArea(box);
      if (gridOn && !e.altKey)
        box = {
          ...box,
          [cfg.xField]: gridRound(num(box[cfg.xField], 0)),
          [cfg.yField]: gridRound(num(box[cfg.yField], 0)),
        };
      selection = new Set([id]);
      // The Animation and Video add-kinds both seed kind:'image' (they render through
      // the image field), so they also match wasImage - check them FIRST and open the
      // type-constrained picker instead of the general image one.
      const wasLottie = armedKind?.id === 'lottie';
      const wasVideo = armedKind?.id === 'video';
      // Sequence Studio's kinds. `clip` seeds kind:'image' too, so - like Animation and
      // Video - it must be recognised BEFORE wasImage or it would open the general image
      // picker. `tool` also seeds kind:'image', and it still opens the UNTYPED picker -
      // that is where the Lolly-link / saved-session path lives, and the picker is
      // already handed `editTool` so a chosen tool opens its inputs first - but it asks
      // for the Tools pane, so the tool grid is what the user lands on. Same idea as the
      // typed kinds above: the pane matches the kind that was added.
      // `card` seeds kind:'box' and takes no asset at all - it is authored like text.
      // An add-kind id this switch doesn't know keeps its seed-derived behaviour.
      const wasClip = armedKind?.id === 'clip';
      const wasAudio = armedKind?.id === 'audio' || g.seed?.[cfg.kindField] === 'audio';
      const wasCard = armedKind?.id === 'card';
      const wasTool = armedKind?.id === 'tool';
      const wasCamera = armedKind?.id === 'camera' || g.seed?.[cfg.kindField] === 'camera';
      const wasImage =
        !wasLottie &&
        !wasVideo &&
        !wasClip &&
        !wasAudio &&
        !wasTool &&
        (g.seed?.[cfg.kindField] === 'image' || armedKind?.id === 'image');
      const wasText = g.seed?.[cfg.kindField] === 'text' || armedKind?.id === 'text' || wasCard;
      // Read BEFORE toPointer(): exitCreate clears the pending time with the armed kind.
      const addAtMs = pendingAddAtMs;
      toPointer(); // the gesture consumed the armed kind - back to the pointer
      endGesture();
      // A card is authored like text, so it takes the same legibility pass.
      if (wasText) box = withLegibleInk(box, boxes);
      // Containment-on-create: the new box lands in whatever frame its centre falls in
      // (dead unless frameCfg). It is the last element of the array, so index boxes.length.
      // A DRAWN artboard also takes the next explicit page order (plans/179 A9), which is
      // why the commit reads the pair back rather than `boxes`: seeding a legacy doc's
      // order rewrites frame rows, and both halves belong in this one commit.
      const made = withNewFrameOrder(boxes, box);
      commit(assignFrames([...made.boxes, made.box], new Set([made.boxes.length])));
      // Added from the timeline, so it lands TIMED at the playhead instead of as scenery
      // (the rail's plus keeps that default). The panel's promote() owns the write - one
      // commit through moveOverlay + setDuration - so no timing arithmetic lives here.
      // `dur: null` is deliberate and load-shifting: this box was created a moment ago
      // and its asset picker has not even opened, so nothing on the canvas knows how long
      // its media is. Authoring a length HERE would pin a 45s audio track to 3s and would
      // overwrite the `card` kind's own seeded 2.5s. Unauthored, the seq pack derives it
      // from the media and an overlay runs to the sequence end - same as a canvas add.
      // (One exception, owned by promoteRows: at/after the sequence end - where the
      // playhead parks after a play-through, and where an untimed doc always is - an
      // open window would be EMPTY, so promote authors a real length there instead.)
      if (addAtMs != null) timelinePanel?.promote(id, { start: addAtMs / 1000, dur: null });
      // A new timed box is only useful next to a timeline, so creating one opens it - and
      // a CAMERA needs the timeline up too, because camera mode (and with it the shift-drag
      // tilt / drag-pan gestures, plans/104 section 8) only arms while `cameraModeId()` sees an
      // OPEN timeline. Without this, adding a camera left the timeline shut and a shift-drag
      // fell through to the marquee - "tilt doesn't work" until you happened to open it.
      if (timeCfg && (wasClip || wasCard || wasAudio || wasCamera)) openTimeline();
      if (wasLottie) setTimeout(() => pickImage({ pickType: 'lottie', initialTab: 'library' }), 0);
      else if (wasVideo || wasClip)
        setTimeout(() => pickImage({ pickType: 'video', initialTab: 'library' }), 0);
      else if (wasAudio)
        setTimeout(() => pickImage({ pickType: 'audio', initialTab: 'library' }), 0);
      else if (wasTool) setTimeout(() => pickImage({ initialTab: 'tools' }), 0);
      else if (wasImage) setTimeout(() => pickImage({ initialTab: 'library' }), 0);
      else if (wasText && cfg.textField) editAfterPaint(id, { selectAll: true });
      return;
    }
    if (g.type === 'campan') {
      const { dx, dy } = g;
      endGesture();
      // ONE commit on release, and only when the shot actually moved. `cameraWrite`
      // resolves WHICH keyframe it lands on (the latch, section 8) and returns the array
      // unchanged when there is nowhere honest to put it.
      //
      // NEGATED, because the content follows the hand: the projection subtracts camX
      // (`cx' = W/2 + (cx − camX − W/2)·eff`), so a camera moving right slides the
      // scene left. Dragging right has to move the picture right, which is the direct
      // manipulation every other drag in this canvas performs - and `dx`/`dy` arrive in
      // NATIVE px for the same reason (see CamPanGesture), so the shot keeps up with the
      // hand at every canvas zoom instead of only at 100 %.
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        const next = timelinePanel?.cameraWrite(boxes, { x: -dx, y: -dy });
        if (next && next !== boxes) commit(next);
      }
      return;
    }
    if (g.type === 'camtilt') {
      const { dx, dy } = g;
      endGesture();
      // DIRECT MANIPULATION, like every other drag here: you are turning the ARTWORK,
      // not aiming the lens. Drag DOWN and the near edge comes toward you at the bottom
      // of frame - which is `rx` NEGATIVE in the engine's convention (see
      // `surfaceMatrix`: negative Tilt X pitches the camera nose-down over the surface,
      // far edge receding to a horizon at the top). Drag RIGHT and the right-hand edge
      // comes nearer, which is `ry` positive. Aiming the lens instead would invert both
      // and put the horizon where the hand did not ask for it.
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        const next = timelinePanel?.cameraWrite(boxes, {
          rx: -dy * CAM_TILT_DEG_PER_PX,
          ry: dx * CAM_TILT_DEG_PER_PX,
        });
        if (next && next !== boxes) commit(next);
      }
      return;
    }
    if (g.type === 'marquee') {
      const moved = Math.hypot(e.clientX - g.startClient.x, e.clientY - g.startClient.y);
      if (moved < 6) {
        selection = new Set<string>();
        deselectEdge();
      } else {
        // A marquee grabs cards AND any connector lines it crosses - a mixed selection
        // (card handles + the connector panel editing every selected line at once).
        const rect = normDragRect(g.origin.x, g.origin.y, nat.x, nat.y, 0);
        // plans/179 A13: an ARTBOARD joins the selection only when the band encloses it
        // whole (Figma's rule). Rubber-banding over two cards used to grab the page they
        // sit on as well, so the next Fill recoloured the slide and Delete removed it.
        // Children keep the ordinary "touched by the band" rule.
        const raw = pickMarquee(boxes, rect, cfg, seqHiddenSkip(boxes));
        const kept = frameCfg
          ? filterMarqueeFrames(boxes, raw, rect, { ...cfg, frameKind: frameCfg.frameKind })
          : raw;
        const hits = kept.map((i: number) => idOf(boxes[i], i));
        const edgeHits = edgesInRect(rect);
        if (g.additive) {
          for (const id of hits) selection.add(id);
          for (const id of edgeHits) selectedEdges.add(id);
        } else {
          selection = new Set(hits);
          selectedEdges = new Set(edgeHits);
        }
        if (selectedEdges.size) setHoverEdge(null);
      }
      endGesture();
      renderChrome(); // card chrome + edge highlights (via renderChrome)
      if (selectedEdges.size) openEdgePanel();
      else closeEdgePanel();
      return;
    }
    if (g.type === 'move') {
      const d = g.moveDelta || { dx: 0, dy: 0 };
      const sel = g.sel;
      const narrow = g.narrow;
      endGesture();
      if (Math.abs(d.dx) > 0.5 || Math.abs(d.dy) > 0.5) {
        // PLAYHEAD-CONTEXTUAL WRITES (plans/104 section 8). The gesture is untouched - the
        // preview path never knew about this and still does not - and the redirection
        // happens HERE, at the one commit, which is what keeps a keyframed drag one
        // undo step exactly like an ordinary one.
        //
        // A MIXED selection is split rather than refused: the boxes parked on a
        // keyframe are posed, the rest are moved, and both halves compose into ONE
        // array committed once. Refusing the whole gesture because one box in five is
        // not animated would make the feature feel like a mode, which is the thing
        // this model exists to avoid.
        const kfIds = new Set(
          timelinePanel?.kfPoseIds([...sel].map((i) => idOf(boxes[i], i))) ?? []
        );
        const moveIdx = [...sel].filter((i) => !kfIds.has(idOf(boxes[i], i)));
        let next = moveIdx.length ? moveBoxes(boxes, moveIdx, d.dx, d.dy, cfg) : boxes;
        if (kfIds.size && timelinePanel)
          next = timelinePanel.kfPoseWrite(next, [...kfIds], { x: d.dx, y: d.dy });
        // Containment-on-drop: the moved boxes re-bucket into the frame their centre
        // now lands in. moveBoxes preserves index order, so g.sel indices stay valid -
        // and only the boxes that actually MOVED are re-bucketed: a posed box's own
        // geometry never changed, so it cannot have crossed a frame edge.
        commit(assignFrames(cascadeFrameChildren(boxes, next, moveIdx), new Set(moveIdx)));
      } else {
        // The press never became a drag, so honour the click's own meaning: narrow the
        // multi-selection to the box that was clicked (plan 179 C4). `ctxSelKey` is reset
        // because the object bar's controls are gated by what is selected, and the bar
        // must not survive a selection it no longer describes.
        if (narrow && narrow.length) {
          selection = new Set(narrow);
          ctxSelKey = null;
        }
        renderChrome();
      }
      return;
    }
    if (g.type === 'resize' || g.type === 'rotate') {
      const live = g.liveRect || g.startRect;
      const idx = g.index;
      const rotId = idOf(boxes[idx], idx);
      // BOTH gestures are pose channels now. Rotate always was (`r`); RESIZE became one
      // at P1 (plans/104 section 5.2, REVERSED - Andy, 2026-08-12 hands-on: "I can't change
      // width and height of elements and have them tween"), so a resize ON a diamond
      // writes `w`/`h` and a resize anywhere else still writes the box itself.
      //
      // The two channels compose differently and the difference is not cosmetic: `w`/`h`
      // are ABSOLUTE px that replace the box's own size for their segment, so they are
      // written with 'set' - a dragged handle produces the new WIDTH, not a change to it
      // - while the origin shift an nw/n/w handle also produces is a `x`/`y` DELTA and
      // is written with 'add', because those channels are offsets from the authored
      // position. Two folds over one array, one commit, one undo step.
      //
      // ZERO DELTA IS NOT A POSE. `liveRect` is only ever assigned in pointermove, so a
      // press-and-release on a handle leaves `live === g.startRect` and every delta
      // exactly 0 - and a redirected write of `{ r: 0 }` is not a no-op: `kfActiveChannels`
      // ADDS `r` to the box's channel set, so on a track that does not already animate
      // rotation (a URL-authored `t0_x0*t1000_x40`, or one built from the inspector's
      // z/s/o/b fields) a click on the handle rewrites the wire and spends an undo step on
      // a gesture that moved nothing. The move branch above is guarded for the same reason
      // (0.5px there); below the tolerance this falls through to the base write, which is
      // the identical no-op an unkeyframed box already gets - the two stay in step.
      const dr = g.type === 'rotate' ? num(live.rot, 0) - num(g.startRect.rot, 0) : 0;
      const dw = num(live.w, 0) - num(g.startRect.w, 0);
      const dh = num(live.h, 0) - num(g.startRect.h, 0);
      const onDiamond = (timelinePanel?.kfPoseIds([rotId]).length ?? 0) > 0;
      const rotKf = g.type === 'rotate' && Math.abs(dr) > 0.01 && onDiamond;
      const sizeKf = g.type === 'resize' && (Math.abs(dw) > 0.5 || Math.abs(dh) > 0.5) && onDiamond;
      endGesture();
      if (rotKf && timelinePanel) {
        commit(timelinePanel.kfPoseWrite(boxes, [rotId], { r: dr }));
        return;
      }
      if (sizeKf && timelinePanel) {
        let next = timelinePanel.kfPoseWrite(boxes, [rotId], { w: live.w, h: live.h }, 'set');
        // An nw/n/w handle moves the ORIGIN as well as the size. Without this the box
        // would grow from its top-left in the preview (which is what the fold does with
        // `w`/`h` alone) while the handle the user is holding says it grew from the
        // opposite corner.
        const dx = num(live.x, 0) - num(g.startRect.x, 0);
        const dy = num(live.y, 0) - num(g.startRect.y, 0);
        if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
          next = timelinePanel.kfPoseWrite(next, [rotId], { x: dx, y: dy });
        }
        commit(next);
        return;
      }
      // Containment-on-resize: a resize/rotate can move the box's centre across a frame
      // edge, so re-bucket the single edited box. An nw/n/w handle on a FRAME moves its
      // origin too - cascade members with it (Figma semantics: children keep their
      // frame-local position), exactly like the move and group-transform commits.
      const resized = boxes.map((b, i) => (i === idx ? withRect(b, live, cfg) : b));
      commit(assignFrames(cascadeFrameChildren(boxes, resized, [idx]), new Set([idx])));
      return;
    }
    if (g.type === 'gscale' || g.type === 'grotate') {
      const next = g.liveBoxes;
      const sel = g.sel;
      endGesture();
      // Containment-on-group-transform: every scaled/rotated box re-buckets. g.liveBoxes
      // is a full index-aligned array, so g.sel indices stay valid.
      if (next) commit(assignFrames(cascadeFrameChildren(boxes, next, sel), new Set(sel)));
      else renderChrome();
      return;
    }
    endGesture();
  }

  // Apply a rect to a live box DOM element during a gesture (no model write).
  function applyLiveRect(index: number, r: Rect): void {
    const boxes = getBoxes();
    const id = idOf(boxes[index], index);
    const el = liveBoxEl(id);
    if (!el) return;
    // r is in GLOBAL native coords; the element positions relative to its page frame.
    const fo = frameOffsetOfEl(el);
    el.style.left = Math.round(r.x - fo.x) + 'px';
    el.style.top = Math.round(r.y - fo.y) + 'px';
    el.style.width = Math.max(1, Math.round(r.w)) + 'px';
    el.style.height = Math.max(1, Math.round(r.h)) + 'px';
    el.style.transform = r.rot ? `rotate(${Math.round(r.rot * 10) / 10}deg)` : '';
    // Multi-page: a box dragged toward a higher-index page spills (unclipped) into that
    // page's rectangle, but the later frame's opaque background paints OVER it (same
    // stacking context, tree order). A positive z-index hoists the live box above every
    // later frame for the duration of the drag; endGesture clears it (and the next paint
    // rebuilds the element clean). No-op for single-page editors (Design).
    if (pages || frameCfg) el.style.zIndex = '9999';
  }

  function drawRubber(origin: Point, nat: Point): void {
    const a = nativeToStage(Math.min(origin.x, nat.x), Math.min(origin.y, nat.y));
    const { scale } = metrics();
    rubber.style.left = a.x + 'px';
    rubber.style.top = a.y + 'px';
    rubber.style.width = Math.abs(nat.x - origin.x) * scale + 'px';
    rubber.style.height = Math.abs(nat.y - origin.y) * scale + 'px';
  }

  // ── handle interactions ──────────────────────────────────────────────────────
  function onHandlePointerDown(e: PointerEvent, handle: HandleName | 'rotate'): void {
    e.stopPropagation();
    if (e.button > 0) return;
    const boxes = getBoxes();
    const idx = selIndices(boxes);
    if (idx.length !== 1) return;
    const index = idx[0]!;
    const startRect = boxRect(boxes[index], cfg);
    if (handle === 'rotate') {
      const m = metrics();
      const c = rectCentre(startRect);
      const cs = nativeToStage(c.x, c.y, m);
      const centerClient = { x: cs.x + m.sr.left, y: cs.y + m.sr.top };
      const pointerStartDeg =
        (Math.atan2(e.clientY - centerClient.y, e.clientX - centerClient.x) * 180) / Math.PI;
      beginGesture(e, { type: 'rotate', index, startRect, centerClient, pointerStartDeg });
    } else {
      beginGesture(e, {
        type: 'resize',
        index,
        handle,
        startRect,
        others: otherAABBs(boxes, new Set([index])),
      });
    }
  }

  // AABBs of every box NOT in `exclude` (snap targets), + the snap threshold in
  // native px (a fixed SCREEN distance regardless of zoom).
  function otherAABBs(boxes: Box[], exclude: Set<number>): AABB[] {
    const out: AABB[] = [];
    // A HIDDEN layer (plans/179 M4) is not drawn, so it must not pull a guide either: a
    // drag snapping to an edge nobody can see reads as the canvas fighting back. A LOCKED
    // one still snaps - it is on screen, and "can't be moved" is not "isn't there".
    const hideF = frameCfg?.hiddenField;
    for (let i = 0; i < boxes.length; i++) {
      if (exclude.has(i)) continue;
      if (hideF && boolOf(boxes[i]?.[hideF], false)) continue;
      out.push(boxAABB(boxes[i], cfg));
    }
    return out;
  }
  const snapThreshNative = (): number => SNAP_PX / (metrics().scale || 1);

  function drawGuides(list: any[] | null | undefined): void {
    guidesEl.innerHTML = '';
    if (!list || !list.length) return;
    const m = metrics();
    for (const g of list) {
      const a = nativeToStage(g.x1, g.y1, m),
        b = nativeToStage(g.x2, g.y2, m);
      const el = document.createElement('div');
      el.className = 'fc-guide';
      el.style.left = a.x + 'px';
      el.style.top = a.y + 'px';
      el.style.width = Math.hypot(b.x - a.x, b.y - a.y) + 'px';
      el.style.transform = `rotate(${(Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI}deg)`;
      guidesEl.appendChild(el);
    }
  }
  const clearGuides = (): void => {
    guidesEl.innerHTML = '';
  };

  // ── bound paths (plan 96 P3) ──────────────────────────────────────────────────
  //
  // A path box with an end attached to another box is a CONNECTOR: connector management
  // draws it, routed from the bound box's border toward the other end. The editor's live
  // overlay reads the SAME model the tool's hook reads (bindStart/bindEnd + the decoration
  // fields) and draws it with the SAME engine call (`routedLineSvg`), so what tracks the
  // cursor during a drag is what lands in the committed render on drop.

  /** One end's binding: the id of the box it is attached to, '' for a free end. */
  const bindOf = (b: Box, which: 'start' | 'end'): string =>
    String(b[which === 'start' ? cfg.bindStartField : cfg.bindEndField] ?? '').trim();
  /** Is this box a connector? ONE binding is enough - a path pinned at one end and loose at
   *  the other still routes, from the border toward the loose point. */
  const isBoundPath = (b: Box): boolean =>
    hasBindCfg &&
    String(b[cfg.kindField]) === 'path' &&
    (bindOf(b, 'start') !== '' || bindOf(b, 'end') !== '');

  /**
   * A bound path as the engine's endpoint pair + decoration record, or null when it is not
   * a connector (or when a HALF-bound path's free end cannot be read - half a connector is
   * worse than none). `rectFor` resolves a box id to the rect to route from, which is the
   * LIVE DOM rect mid-drag and the model rect otherwise.
   *
   * This mirrors `boundPathRow` in the tool hooks field-for-field, deliberately: the hook
   * cannot import from the shell and the shell cannot call the hook, so the ONE thing that
   * has to be shared is the geometry, and that is `routedLineSvg`.
   */
  function boundPathParts(
    b: Box
  ): { from: string; to: string; decor: Parameters<typeof routedLineSvg>[2] } | null {
    if (!isBoundPath(b)) return null;
    const bs = bindOf(b, 'start'),
      be = bindOf(b, 'end');
    const ends = !bs || !be ? pathEndsNative(b) : null;
    if ((!bs || !be) && !ends) return null;
    const contours = decodePathContours(b[cfg.pathField]);
    const sole = contours[0];
    const route = pathRouteStyle(
      sole ? sole.kind : '',
      b[cfg.routeField],
      sole ? sole.nodes.length : 2
    );
    const sw = clampN(b[cfg.strokeWField], 0, 0, 400);
    const dashKw = String(b[cfg.strokeDashField] ?? '');
    return {
      from: bs || formatEdgePoint(ends!.start.x, ends!.start.y),
      to: be || formatEdgePoint(ends!.end.x, ends!.end.y),
      decor: {
        style: route,
        headStart: String(b[cfg.headStartField] || 'none'),
        headEnd: String(b[cfg.headEndField] || 'none'),
        dash: dashKw === 'dashed' || dashKw === 'dotted' ? dashKw : 'solid',
        dashArray: parseDashText(String(b[cfg.strokeDashArrayField] ?? '')) || null,
        dashFit: boolOf(b[cfg.dashFitField], false),
        color: cAttr(String(b[cfg.strokeField] || '#64748b')),
        width: sw > 0 ? Math.min(20, Math.max(0.5, sw)) : 3,
      },
    };
  }

  /** A path box's first and last node in NATIVE canvas px. Nodes are stored normalised to
   *  the frame; rotation is ignored for the same reason the hook ignores it - a bound path
   *  is drawn between two rects and the router re-solves both ends anyway. */
  function pathEndsNative(b: Box): { start: Point; end: Point } | null {
    const contours = decodePathContours(b[cfg.pathField]);
    const ns = contours[0]?.nodes;
    if (!ns || ns.length < 2) return null;
    const r = boxRect(b, cfg);
    const w = Math.max(1, r.w),
      h = Math.max(1, r.h);
    const a = ns[0]!,
      z = ns[ns.length - 1]!;
    return {
      start: { x: r.x + a.x * w, y: r.y + a.y * h },
      end: { x: r.x + z.x * w, y: r.y + z.y * h },
    };
  }

  // ── connector preview layer ───────────────────────────────────────────────────
  // The routing math (edgeWaypoints / roundedEdgePath / smoothEdgePath / edgeBorderPt /
  // edgeNested) lives in free-canvas-math.ts so it is unit-tested (tests/connector-
  // geometry.test.ts) and stays in sync with tools/org-chart/hooks.js. Arrowheads render
  // live too (edgeArrowHead, plan 90 thread B) with the same gap + inset pullback as the
  // committed render, so nothing jumps on commit; dashes stay preview-only (throwaway
  // stroke-dasharray) since the committed layer draws real <line> segments.
  const cf2 = (v: number): number => Math.round(v * 100) / 100;
  const cAttr = (s: string): string => String(s == null ? '' : s).replace(/[<>"]/g, '');
  // Size + place a preview <svg> to cover the artboard in stage px (native viewBox), so
  // its contents can be written in native coordinates and a pan/zoom is one element move.
  function placeNativeLayer(el: SVGSVGElement, m: Metrics): void {
    const cw = canvasWH();
    const o = nativeToStage(0, 0, m);
    el.style.left = o.x + 'px';
    el.style.top = o.y + 'px';
    el.style.width = cw.w * m.scale + 'px';
    el.style.height = cw.h * m.scale + 'px';
    el.setAttribute('viewBox', `0 0 ${cw.w} ${cw.h}`);
    el.setAttribute('preserveAspectRatio', 'none');
  }
  const placeConnectLayer = (m: Metrics): void => placeNativeLayer(connectLayer, m);
  // Hide/show the tool's committed bound-path <svg> (so it doesn't double up with the
  // live preview mid-drag). Re-shown on gesture end; the commit re-renders it anyway.
  // The class is the manifest's (`canvas.pathLayerClass`) for the same reason it used to be
  // `canvas.connect.layerClass`: only a tool knows what its own hook emits.
  function setRealConnectorsHidden(hidden: boolean): void {
    const cls = connectCfg?.layerClass || boundLayerClass;
    const el = canvasEl.querySelector<HTMLElement>('.' + cls);
    if (el) el.style.visibility = hidden ? 'hidden' : '';
    liveConnectHidden = hidden;
  }
  // The rect used to anchor an edge to a box: the LIVE DOM rect when present (mid-drag),
  // else the model rect. Rotation is ignored (org cards are axis-aligned).
  function boxRectById(boxes: Box[], id: string): EdgeRect | null {
    const i = indexOfId(boxes, id);
    if (i < 0) return null;
    const el = canvasEl.querySelector<HTMLElement>(`.lolly-box[data-box-id="${cssEscape(id)}"]`);
    if (el && el.style.left) {
      const fo = frameOffsetOfEl(el);
      return {
        x: (parseFloat(el.style.left) || 0) + fo.x,
        y: (parseFloat(el.style.top) || 0) + fo.y,
        w: parseFloat(el.style.width) || 1,
        h: parseFloat(el.style.height) || 1,
      };
    }
    const r = boxRect(boxes[i], cfg);
    return { x: r.x, y: r.y, w: r.w, h: r.h };
  }
  // Pull the shaft back off an arrow end and build the head fragment(s) for the preview -
  // mirrors the gap + headInset logic in drawConnector() (org-chart/hooks.js) so the live
  // line matches the committed render and nothing jumps on release. Returns the (copied)
  // shaft points to draw through, plus the heads SVG to append. End direction is the last
  // shaft segment (exact for straight/elbow, a close sample for arc/curved).
  function previewHeads(
    src: Point[],
    arrow: string,
    head: string,
    headSize: number,
    col: string
  ): { pts: Point[]; heads: string } {
    const pts = src.map((p) => ({ x: p.x, y: p.y }));
    const n = pts.length;
    if (n < 2 || arrow === 'none' || head === 'none') return { pts, heads: '' };
    const d2 = (a: Point, b: Point): number => Math.hypot(b.x - a.x, b.y - a.y);
    const along = (from: Point, toward: Point, d: number): Point => {
      const L = d2(from, toward);
      if (L < 1e-4) return { x: from.x, y: from.y };
      const t = Math.min(d, L) / L;
      return { x: from.x + (toward.x - from.x) * t, y: from.y + (toward.y - from.y) * t };
    };
    const gap = Math.max(8, headSize * 0.8);
    const inset = edgeHeadInset(head, headSize);
    const last = { x: pts[n - 1]!.x, y: pts[n - 1]!.y },
      first = { x: pts[0]!.x, y: pts[0]!.y };
    const lastNbr = pts[n - 2]!,
      firstNbr = pts[1]!;
    let heads = '';
    if (arrow === 'end' || arrow === 'both') {
      const ge = Math.min(gap, d2(last, lastNbr) * 0.55);
      const endTip = along(last, lastNbr, ge);
      pts[n - 1] = along(last, lastNbr, Math.min(ge + inset, d2(last, lastNbr) * 0.9));
      const L = d2(last, lastNbr) || 1;
      heads += edgeArrowHead(
        endTip,
        (last.x - lastNbr.x) / L,
        (last.y - lastNbr.y) / L,
        headSize,
        col,
        head
      );
    }
    if (arrow === 'both') {
      const gs = Math.min(gap, d2(first, firstNbr) * 0.55);
      const startTip = along(first, firstNbr, gs);
      pts[0] = along(first, firstNbr, Math.min(gs + inset, d2(first, firstNbr) * 0.9));
      const seg = pts[1]!; // reversed first drawn segment = direction OUT of the source
      const L = d2(startTip, seg) || 1;
      heads += edgeArrowHead(
        startTip,
        (startTip.x - seg.x) / L,
        (startTip.y - seg.y) / L,
        headSize,
        col,
        head
      );
    }
    return { pts, heads };
  }
  /** Every box's rect for routing: the LIVE DOM rect when there is one (mid-drag), else
   *  the model rect. Resolved in ONE querySelectorAll + one pass, so a connected drag
   *  redraws in O(boxes + lines) rather than two DOM queries per line. */
  function liveRectById(boxes: Box[]): Map<string, EdgeRect> {
    const liveEls = new Map<string, HTMLElement>();
    canvasEl.querySelectorAll<HTMLElement>('.lolly-box[data-box-id]').forEach((el) => {
      const id = el.getAttribute('data-box-id');
      if (id != null) liveEls.set(id, el);
    });
    const rectById = new Map<string, EdgeRect>();
    for (let i = 0; i < boxes.length; i++) {
      const id = idOf(boxes[i], i);
      const el = liveEls.get(id);
      if (el && el.style.left) {
        const fo = frameOffsetOfEl(el);
        rectById.set(id, {
          x: (parseFloat(el.style.left) || 0) + fo.x,
          y: (parseFloat(el.style.top) || 0) + fo.y,
          w: parseFloat(el.style.width) || 1,
          h: parseFloat(el.style.height) || 1,
        });
      } else {
        const r = boxRect(boxes[i], cfg);
        rectById.set(id, { x: r.x, y: r.y, w: r.w, h: r.h });
      }
    }
    return rectById;
  }

  /**
   * Redraw every BOUND PATH from the current (possibly live) box rects - the plan 96 P3
   * live re-route. Called each frame of a drag that moves a box a line is attached to, so
   * the line follows in real time while the tool's committed layer is hidden.
   *
   * The geometry is `routedLineSvg`, the engine's committed renderer, called with the same
   * decoration record the hook builds - not a preview approximation of it. So nothing jumps
   * on release: what the drag showed IS what the commit re-renders.
   *
   * Returns the number of lines drawn, so the caller knows whether the layer is worth
   * showing at all.
   */
  function drawLiveBoundPaths(boxes: Box[], rectById: Map<string, EdgeRect>): string {
    if (!hasBindCfg) return '';
    let body = '';
    for (const b of boxes) {
      const parts = b && boundPathParts(b);
      if (!parts) continue;
      const a = edgeEndRect(parts.from, rectById);
      const z = edgeEndRect(parts.to, rectById);
      if (!a || !z) continue; // a dangling id draws nothing
      if (!isEdgePoint(parts.from) && !isEdgePoint(parts.to) && edgeNested(a, z)) continue;
      body += routedLineSvg(a, z, parts.decor);
    }
    return body;
  }

  // Redraw every edge from the current (possibly live) box rects. Called each frame of a
  // drag involving connected cards, so the lines track the boxes in real time.
  function drawLiveConnectors(): void {
    const boxes = getBoxes();
    if (hasBindCfg && !connectCfg) {
      // The plan-96 path: every connector is a bound path box, and there is no edge input.
      placeConnectLayer(metrics());
      connectLayer.innerHTML = drawLiveBoundPaths(boxes, liveRectById(boxes));
      connectLayer.style.display = '';
      return;
    }
    if (!connectCfg) return;
    const edges = getEdges();
    placeConnectLayer(metrics());
    const rectById = liveRectById(boxes);
    // A tool that still declares BOTH (an un-migrated pack on a new shell) draws each from
    // its own model, once - the bound paths first so they sit under the legacy edges.
    let body = drawLiveBoundPaths(boxes, rectById);
    for (const e of edges) {
      if (!e) continue;
      // An endpoint is a box id OR a free point (`@x,y`); edgeEndRect resolves either (a
      // point → a 0×0 rect the routing already handles). A dangling id → null → no line.
      const fromV = String(e[connectCfg.fromField!]);
      const toV = String(e[connectCfg.toField!]);
      const a = edgeEndRect(fromV, rectById);
      const b = edgeEndRect(toV, rectById);
      if (!a || !b) continue;
      // Nested pair draws no line (mirrors hooks.js) - but ONLY when both ends are nodes;
      // a free point inside a box is a deliberate endpoint, not an overlap to suppress.
      if (!isEdgePoint(fromV) && !isEdgePoint(toV) && edgeNested(a, b)) continue;
      const style = String(
        (connectCfg.styleField && e[connectCfg.styleField]) || connectCfg.defaultStyle
      );
      const col = cAttr(
        String((connectCfg.colorField && e[connectCfg.colorField]) || connectCfg.defaultColor)
      );
      const w = Math.min(
        20,
        Math.max(
          0.5,
          Number((connectCfg.widthField && e[connectCfg.widthField]) ?? connectCfg.defaultWidth) ||
            2.5
        )
      );
      const arrow = String(
        (connectCfg.arrowField && e[connectCfg.arrowField]) || connectCfg.defaultArrow || 'none'
      );
      const head = String(
        (connectCfg.headField && e[connectCfg.headField]) || connectCfg.defaultHead || 'triangle'
      );
      const raw = edgeWaypoints(a, b, style);
      if (raw.length < 2) continue;
      const { pts, heads } = previewHeads(raw, arrow, head, Math.max(9, w * 4), col);
      const d =
        style === 'curved' ? smoothEdgePath(pts) : roundedEdgePath(pts, Math.min(16, w * 4 + 6));
      body +=
        `<path d="${d}" fill="none" stroke="${col}" stroke-width="${cf2(w)}" stroke-linejoin="round" stroke-linecap="round"/>` +
        heads;
    }
    connectLayer.innerHTML = body;
    connectLayer.style.display = '';
  }
  // `drawConnectRubber` (plan 90) lived here - the dashed rubber from a pending source
  // card to the cursor. It went with Connect mode (plan 96 P4); `drawBindRing` below is
  // its replacement, and it hangs off the endpoint being dragged rather than off a mode.
  /**
   * The Line tool's rubber (plan 96 P2): a dashed shaft between the two canvas points of
   * the drag, with the head the committed box will carry previewed at the far end.
   *
   * Both ends are plain points now. Under plan 90 the start resolved through `edgeEndRect`
   * (a card border or an `@x,y`) and the far end outlined whatever card a release would
   * attach to - honest then, misleading now: releasing over a box binds nothing until P3,
   * and an outline promising an attachment that does not happen is worse than no outline.
   *
   * Drawn in the SAME ink and at the same head size as `commitPathBox` will use, so the
   * preview is the shape you get rather than a stand-in for it.
   */
  function drawLineRubber(from: Point, to: Point): void {
    const col = cAttr(drawnInkHex());
    const w = lineDraftWidth();
    const head = 'open'; // lineBoxSeed's default headEnd
    const headSize = Math.max(9, w * 4);
    const dirL = Math.hypot(to.x - from.x, to.y - from.y) || 1;
    const ux = (to.x - from.x) / dirL,
      uy = (to.y - from.y) / dirL;
    // Below the head's own length there is no room for both, so the dot stands in - the
    // same "there is an endpoint here" mark the connect rubber uses.
    const showHead = dirL > headSize;
    const inset = showHead ? edgeHeadInset(head, headSize) : 0;
    const tip = showHead
      ? edgeArrowHead(to, ux, uy, headSize, col, head)
      : `<circle cx="${cf2(to.x)}" cy="${cf2(to.y)}" r="5" fill="${col}"/>`;
    placeConnectLayer(metrics());
    connectLayer.innerHTML =
      `<path d="M${cf2(from.x)} ${cf2(from.y)}L${cf2(to.x - ux * inset)} ${cf2(to.y - uy * inset)}" fill="none" stroke="${col}" stroke-width="${cf2(w)}" stroke-dasharray="8 6" stroke-linecap="round"/>` +
      tip;
    connectLayer.style.display = '';
  }
  /** The stroke width a line draft previews at: whatever the committed box will take -
   *  the last path paint, else the tool's own `path` seed, else `penFinishDraw`'s own 4px
   *  last resort - so the rubber is not a different weight from the shape it becomes. */
  function lineDraftWidth(): number {
    const seed = { ...(addKinds.find((k) => k.id === 'path')?.seed || {}) } as Box;
    const w = Number(penLastPaint?.[cfg.strokeWField] ?? seed[cfg.strokeWField] ?? 0);
    return Math.min(20, Math.max(0.5, w > 0 ? w : 4));
  }
  function hideConnectLayer(): void {
    connectLayer.style.display = 'none';
    connectLayer.innerHTML = '';
  }
  // Called each frame of a drag that moves connected cards: hide the tool's committed
  // connector layer once, then redraw every edge live so the lines follow the boxes.
  function liveConnUpdate(): void {
    if (!connectCfg && !hasBindCfg) return;
    if (!liveConnectHidden) setRealConnectorsHidden(true);
    drawLiveConnectors();
  }
  // On drop, keep the preview one extra paint so the committed connectors re-render
  // underneath before we drop it (avoids a flash), then restore + clear.
  function endLiveConnectors(): void {
    if (!liveConnectHidden) return;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (disposed) return;
        setRealConnectorsHidden(false);
        if (!selectedEdges.size) hideConnectLayer();
      })
    );
  }

  // ── connector inspector (click a line → edit its bend / thickness / colour) ────
  // Connectors render in the tool's #tool-canvas svg (pointer-events:none) BEHIND the
  // cards, so the overlay hit-tests them itself: on a click that misses every box, the
  // nearest connector polyline within a small screen-px band is selected.
  const edgeById = (eid: string): Box | null =>
    getEdges().find((e) => e && String(e[cfg.idField]) === eid) || null;
  function distToSeg(px: number, py: number, a: Point, b: Point): number {
    const vx = b.x - a.x,
      vy = b.y - a.y,
      L2 = vx * vx + vy * vy;
    const t = L2 > 0 ? Math.max(0, Math.min(1, ((px - a.x) * vx + (py - a.y) * vy) / L2)) : 0;
    return Math.hypot(px - (a.x + vx * t), py - (a.y + vy * t));
  }
  function polylineDist(px: number, py: number, pts: Point[]): number {
    let d = Infinity;
    for (let i = 0; i < pts.length - 1; i++)
      d = Math.min(d, distToSeg(px, py, pts[i]!, pts[i + 1]!));
    return d;
  }
  function polylineMid(pts: Point[]): Point {
    if (pts.length < 2) return pts[0] || { x: 0, y: 0 };
    let total = 0;
    for (let i = 0; i < pts.length - 1; i++)
      total += Math.hypot(pts[i + 1]!.x - pts[i]!.x, pts[i + 1]!.y - pts[i]!.y);
    let acc = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const seg = Math.hypot(pts[i + 1]!.x - pts[i]!.x, pts[i + 1]!.y - pts[i]!.y);
      if (acc + seg >= total / 2) {
        const t = seg ? (total / 2 - acc) / seg : 0;
        return {
          x: pts[i]!.x + (pts[i + 1]!.x - pts[i]!.x) * t,
          y: pts[i]!.y + (pts[i + 1]!.y - pts[i]!.y) * t,
        };
      }
      acc += seg;
    }
    return pts[pts.length - 1]!;
  }
  const edgeStyleOf = (e: Box): string =>
    String(
      (connectCfg?.styleField && e[connectCfg.styleField]) || connectCfg?.defaultStyle || 'elbow'
    );
  const edgeWidthOf = (e: Box): number =>
    clampN(
      connectCfg?.widthField ? e[connectCfg.widthField] : undefined,
      connectCfg?.defaultWidth ?? 2.5,
      0.5,
      20
    );
  function edgePts(e: Box): Point[] | null {
    if (!connectCfg) return null;
    const boxes = getBoxes();
    const a = boxRectById(boxes, String(e[connectCfg.fromField!])),
      b = boxRectById(boxes, String(e[connectCfg.toField!]));
    return a && b ? edgeWaypoints(a, b, edgeStyleOf(e)) : null;
  }
  // The connector id nearest to a native point, within ~9 screen px. null if none.
  function edgeAt(x: number, y: number): string | null {
    if (!connectCfg) return null;
    const thresh = 9 / (metrics().scale || 1);
    let best: { id: string; d: number } | null = null;
    for (const e of getEdges()) {
      if (!e) continue;
      const id = String(e[cfg.idField] ?? '');
      if (!id) continue;
      const pts = edgePts(e);
      if (!pts) continue;
      const d = polylineDist(x, y, pts);
      if (d <= thresh && (!best || d < best.d)) best = { id, d };
    }
    return best ? best.id : null;
  }
  // Hover affordance: a pointer cursor + a faint highlight when the cursor is over a
  // connector line, so the (pointer-events:none) lines read as selectable. rAF-throttled
  // so the edgeAt hit-test never runs more than once per frame.
  function updateHover(): void {
    hoverRaf = 0;
    if (!connectCfg || selectedEdges.size || gesture || !lastPointer) {
      setHoverEdge(null);
      return;
    }
    const nat = clientToNative(lastPointer.x, lastPointer.y);
    setHoverEdge(edgeAt(nat.x, nat.y));
  }
  function setHoverEdge(id: string | null): void {
    if (id === hoverEdge) return;
    hoverEdge = id;
    stageEl.style.cursor = id ? 'pointer' : '';
    if (id) {
      const e = edgeById(id);
      const pts = e && edgePts(e);
      if (e && pts) {
        const w = edgeWidthOf(e);
        const d =
          edgeStyleOf(e) === 'curved'
            ? smoothEdgePath(pts)
            : roundedEdgePath(pts, Math.min(16, w * 4 + 6));
        placeConnectLayer(metrics());
        connectLayer.innerHTML = `<path d="${d}" fill="none" stroke="#30ba78" stroke-width="${cf2(w + 6)}" stroke-linejoin="round" stroke-linecap="round" opacity="0.18"/>`;
        connectLayer.style.display = '';
      }
    } else if (!selectedEdges.size) {
      hideConnectLayer();
    }
  }
  // The "primary" selected edge - drives the panel's displayed values + placement.
  function primaryEdgeId(): string | null {
    for (const id of selectedEdges) return id;
    return null;
  }
  // Geometry for marquee edge-hit: does a connector's polyline overlap the drag rect?
  function pointInRect(x: number, y: number, r: Rect): boolean {
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }
  function segsCross(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
    const d = (a: Point, b: Point, c: Point): number =>
      (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    const d1 = d(p3, p4, p1),
      d2 = d(p3, p4, p2),
      d3 = d(p1, p2, p3),
      d4 = d(p1, p2, p4);
    return d1 > 0 !== d2 > 0 && d3 > 0 !== d4 > 0;
  }
  function polylineInRect(pts: Point[], r: Rect): boolean {
    for (const p of pts) if (pointInRect(p.x, p.y, r)) return true; // an endpoint inside
    const c = [
      { x: r.x, y: r.y },
      { x: r.x + r.w, y: r.y },
      { x: r.x + r.w, y: r.y + r.h },
      { x: r.x, y: r.y + r.h },
    ];
    for (let i = 0; i < pts.length - 1; i++)
      for (let j = 0; j < 4; j++)
        if (segsCross(pts[i]!, pts[i + 1]!, c[j]!, c[(j + 1) % 4]!)) return true; // a segment crossing a side
    return false;
  }
  function edgesInRect(r: Rect): string[] {
    if (!connectCfg) return [];
    const ids: string[] = [];
    for (const e of getEdges()) {
      if (!e) continue;
      const id = String(e[cfg.idField] ?? '');
      const pts = id && edgePts(e);
      if (pts && polylineInRect(pts, r)) ids.push(id);
    }
    return ids;
  }
  // Select a connector. `additive` (shift/⌘-click) toggles it in the current set;
  // otherwise it becomes the sole selection. Either way it clears the card selection -
  // a marquee is what mixes cards + connectors (see the marquee gesture end).
  function selectEdge(eid: string, additive?: boolean): void {
    setHoverEdge(null);
    if (additive && selectedEdges.size) {
      if (selectedEdges.has(eid)) selectedEdges.delete(eid);
      else selectedEdges.add(eid);
      if (!selectedEdges.size) {
        deselectEdge();
        return;
      }
    } else {
      selectedEdges = new Set([eid]);
    }
    selection = new Set<string>(); // a connector and a card can't be selected by a plain click
    renderChrome(); // clear any card chrome + draw the highlight(s)
    openEdgePanel(); // rebuild (count / values may have changed)
  }
  function deselectEdge(): void {
    if (!selectedEdges.size && !edgePanel) return;
    selectedEdges = new Set<string>();
    closeEdgePanel();
    hideConnectLayer();
  }
  function closeEdgePanel(): void {
    edgePanel?.remove();
    edgePanel = null;
  }
  // Redraw EVERY selected edge's highlight (native coords in the connect layer) + keep
  // the panel over the primary edge. Prunes any edge whose line/box vanished.
  function refreshEdgeChrome(): void {
    if (!connectCfg || !selectedEdges.size) return;
    let html = '';
    const alive = new Set<string>();
    for (const eid of selectedEdges) {
      const e = edgeById(eid);
      const pts = e && edgePts(e);
      if (!e || !pts) continue;
      alive.add(eid);
      const w = edgeWidthOf(e);
      // Match the tool hook's path choice: a dashed/dotted line is drawn as sharp
      // segments (no smooth curve), so the highlight follows suit; solid honours curved.
      const dashV = String((connectCfg.dashField && e[connectCfg.dashField]) || 'solid');
      const d =
        dashV !== 'solid'
          ? roundedEdgePath(pts, 0)
          : edgeStyleOf(e) === 'curved'
            ? smoothEdgePath(pts)
            : roundedEdgePath(pts, Math.min(16, w * 4 + 6));
      html += `<path d="${d}" fill="none" stroke="#30ba78" stroke-width="${cf2(w + 8)}" stroke-linejoin="round" stroke-linecap="round" opacity="0.35"/>`;
    }
    if (alive.size !== selectedEdges.size) selectedEdges = alive; // drop the vanished
    if (!selectedEdges.size) {
      deselectEdge();
      return;
    }
    placeConnectLayer(metrics());
    connectLayer.innerHTML = html;
    connectLayer.style.display = '';
    positionEdgePanel();
  }
  // Set a field on ALL selected connectors at once (the multi-edit core).
  function setEdgeField(field: string | undefined, value: unknown): void {
    if (!connectCfg || !selectedEdges.size || !field) return;
    const edges = getEdges();
    commitEdges(
      edges.map((e) =>
        e && selectedEdges.has(String(e[cfg.idField])) ? { ...e, [field]: value as InputValue } : e
      )
    );
    refreshEdgeChrome(); // bend/thickness change → re-highlight + reposition
  }
  function deleteSelectedEdge(): void {
    if (!connectCfg || !selectedEdges.size) return;
    commitEdges(getEdges().filter((e) => !(e && selectedEdges.has(String(e[cfg.idField])))));
    deselectEdge();
  }
  function positionEdgePanel(): void {
    const pid = primaryEdgeId();
    if (!edgePanel || !connectCfg || !pid) return;
    const e = edgeById(pid);
    const pts = e && edgePts(e);
    if (!pts) return;
    const s = nativeToStage(polylineMid(pts).x, polylineMid(pts).y, metrics());
    const sr = stageEl.getBoundingClientRect();
    edgePanel.style.left =
      Math.max(6, Math.min(s.x + 14, sr.width - edgePanel.offsetWidth - 8)) + 'px';
    edgePanel.style.top =
      Math.max(6, Math.min(s.y + 12, sr.height - edgePanel.offsetHeight - 8)) + 'px';
  }
  function openEdgePanel(): void {
    closeEdgePanel();
    const pid = primaryEdgeId();
    if (!connectCfg || !pid) return;
    const e = edgeById(pid);
    if (!e) return;
    const nSel = selectedEdges.size; // >1 → the panel edits them ALL; values shown are the primary's
    const styleF = connectCfg.styleField,
      arrowF = connectCfg.arrowField,
      dashF = connectCfg.dashField;
    const widthF = connectCfg.widthField,
      colorF = connectCfg.colorField,
      headF = connectCfg.headField;
    const styleCur = edgeStyleOf(e);
    const arrowCur = String((arrowF && e[arrowF]) || connectCfg.defaultArrow || 'end');
    const headCur = String((headF && e[headF]) || connectCfg.defaultHead || 'triangle');
    const dashCur = String((dashF && e[dashF]) || 'solid');
    const widthCur = edgeWidthOf(e);
    const colorCur = String((colorF && e[colorF]) || connectCfg.defaultColor || '#94a3b8');
    // Arrowhead-shape glyphs for the segmented picker (a shaft + the head, pointing right).
    const HEAD_CHOICES: Array<[string, string, string]> = [
      [
        'triangle',
        t('Triangle'),
        '<line x1="3" y1="12" x2="13" y2="12"/><path d="M12 8l7 4-7 4Z" fill="currentColor" stroke="none"/>',
      ],
      [
        'open',
        t('Open'),
        '<line x1="3" y1="12" x2="19" y2="12"/><path d="M14 7l6 5-6 5" fill="none"/>',
      ],
      [
        'circle',
        t('Circle'),
        '<line x1="3" y1="12" x2="13" y2="12"/><path d="M20 12a3.3 3.3 0 1 1-6.6 0 3.3 3.3 0 0 1 6.6 0Z" fill="currentColor" stroke="none"/>',
      ],
      [
        'diamond',
        t('Diamond'),
        '<line x1="3" y1="12" x2="11" y2="12"/><path d="M11 12l4.5-4 4.5 4-4.5 4Z" fill="currentColor" stroke="none"/>',
      ],
      [
        'bar',
        t('Bar'),
        '<line x1="3" y1="12" x2="18" y2="12"/><line x1="18" y1="6" x2="18" y2="18"/>',
      ],
    ];
    // Bend has many orthogonal flavours → a dropdown (kept in sync with tool.json's
    // `style` options + hooks.js waypoints()).
    const STYLE_OPTS: Array<[string, string]> = [
      ['straight', 'Straight'],
      ['elbow', 'Elbow - auto'],
      ['elbow-v', 'Elbow - vertical'],
      ['elbow-h', 'Elbow - horizontal'],
      ['elbow-src', 'Bend at start'],
      ['elbow-tgt', 'Bend at end'],
      ['curved', 'Curved - auto'],
      ['curved-v', 'Curved - vertical'],
      ['curved-h', 'Curved - horizontal'],
      ['arc', 'Arc - bow'],
      ['arc-wide', 'Arc - wide bow'],
      ['arc-flip', 'Arc - reverse bow'],
      ['arc-flip-wide', 'Arc - wide reverse'],
    ];
    // `row()` below wraps controls in a <div>, not a <label>, so this select gets no
    // implicit name from its row text - it names itself.
    const styleSelect = `<select class="field-select field-select--sm" data-ep="style" aria-label="${escape(t('Connector bend'))}">${STYLE_OPTS.map(([v, l]) => `<option value="${v}"${styleCur === v ? ' selected' : ''}>${escape(t(l))}</option>`).join('')}</select>`;
    const row = (lbl: string, ctrl: string): string =>
      `<div class="fc-row"><span class="fc-row-lbl"><span>${lbl}</span></span>${ctrl}</div>`;
    const p = document.createElement('div');
    p.className = 'fc-panel fc-edge-panel';
    p.innerHTML =
      (nSel > 1
        ? `<div class="fc-edge-count">${t('{n} connectors - editing all', { n: nSel })}</div>`
        : '') +
      (styleF ? row(t('Bend'), styleSelect) : '') +
      (arrowF
        ? row(
            t('Arrow'),
            segHtml(arrowF, arrowCur, [
              ['none', t('None')],
              ['end', t('End')],
              ['both', t('Both')],
            ])
          )
        : '') +
      (headF ? row(t('Head'), segHtml(headF, headCur, HEAD_CHOICES)) : '') +
      (dashF
        ? row(
            t('Line'),
            segHtml(dashF, dashCur, [
              ['solid', t('Solid')],
              ['dashed', t('Dashed')],
              ['dotted', t('Dotted')],
            ])
          )
        : '') +
      (widthF
        ? `<label class="fc-row"><span class="fc-row-lbl"><span>${t('Thickness')}</span></span><input type="range" class="field-range" data-ep="width" min="0.5" max="12" step="0.5" value="${widthCur}"><b data-ep-val="width">${widthCur}</b></label>`
        : '') +
      (colorF
        ? `<label class="fc-row"><span class="fc-row-lbl"><span>${t('Colour')}</span></span><span class="fc-cfield">${colorFieldHtml('fc-edge-color', colorCur, { float: true })}</span></label>`
        : '') +
      `<div class="fc-row fc-edge-actions"><button type="button" class="fc-cbtn fc-danger" data-ep="del">${icon(SVG.trash)}<span>${nSel > 1 ? t('Delete {n} lines', { n: nSel }) : t('Delete line')}</span></button></div>`;
    p.addEventListener('pointerdown', (ev) => ev.stopPropagation());
    wireSegs(p, (field, v) => setEdgeField(field, v));
    if (styleF) {
      const sel = p.querySelector<HTMLSelectElement>('select[data-ep="style"]');
      sel?.addEventListener('change', () => setEdgeField(styleF, sel.value));
    }
    if (widthF) {
      const rng = p.querySelector<HTMLInputElement>('input[data-ep="width"]');
      rng?.addEventListener('input', () => {
        const vb = p.querySelector<HTMLElement>('[data-ep-val="width"]');
        if (vb) vb.textContent = rng.value;
        setEdgeField(widthF, Number(rng.value));
      });
    }
    if (colorF)
      wireColorField(p, {
        onChange: (id, val) => {
          if (id === 'fc-edge-color') setEdgeField(colorF, unwrapColor(val));
        },
      });
    p.querySelector<HTMLButtonElement>('[data-ep="del"]')?.addEventListener('click', (ev) => {
      ev.stopPropagation();
      deleteSelectedEdge();
    });
    stageEl.appendChild(p);
    edgePanel = p;
    positionEdgePanel();
  }

  // ── overlay rendering ─────────────────────────────────────────────────────────
  let syncScheduled = false;
  function scheduleSync(): void {
    if (syncScheduled || disposed) return;
    syncScheduled = true;
    requestAnimationFrame(() => {
      syncScheduled = false;
      if (!gesture || gesture.type === 'tap') renderChrome();
    });
  }

  // During a gesture, reposition chrome from the live DOM (which we just mutated).
  function renderChromeLive(): void {
    const boxes = getBoxes();
    const rects = new Map<number, Rect>();
    for (const i of selIndices(boxes)) {
      const id = idOf(boxes[i], i);
      const el = liveBoxEl(id);
      // el.style.left/top are FRAME-LOCAL in multi-page mode; add the frame offset back
      // so the selection chrome (which paints in global native → stage coords) lines up.
      if (el) {
        const fo = frameOffsetOfEl(el);
        rects.set(i, {
          x: (parseFloat(el.style.left) || 0) + fo.x,
          y: (parseFloat(el.style.top) || 0) + fo.y,
          w: parseFloat(el.style.width) || 1,
          h: parseFloat(el.style.height) || 1,
          rot: rotOf(el),
        });
      }
    }
    paintChrome(boxes, rects);
  }

  function renderChrome(): void {
    const boxes = getBoxes();
    if (selection.size) authoringGuides?.select(null);
    authoringGuides?.sync();
    paintChrome(boxes, null);
    // Keep the selected connector's highlight + inspector tracking any box move,
    // pan/zoom, or edit (drops the selection if its edge/box has gone).
    if (selectedEdges.size) refreshEdgeChrome();
    emitActiveArtboard();
  }

  // ── active artboard → export bar (plans/141 WP-B) ─────────────────────────────
  // The export bar mirrors the artboard the user is working with. Emit (deduped)
  // from renderChrome - which already runs on every selection change, commit, and
  // `tl-time` - carrying BOTH candidates: the selected artboard (falling back to
  // the primary one) and the artboard under the sequence playhead (the page the
  // clock left visible). tool-actions picks per export format: still formats
  // follow the selection, animated formats follow the playhead. No frames → no
  // event, and the bar keeps its no-frames behaviour.
  let activeArtboardKey = '';
  /**
   * The ArtboardPort's own subscribers (plans/179 M2). Separate from the `fc-artboard`
   * DOM event because a column wants the ID and nothing else: the event's payload also
   * carries the PLAYHEAD's artboard, so it re-fires as the clock moves over a deck and a
   * navigator subscribed to it would repaint on every frame of playback.
   */
  const artboardListeners = new Set<(id: string) => void>();
  let artboardNotifiedId = '';
  function notifyActiveArtboard(id: string): void {
    if (id === artboardNotifiedId) return;
    artboardNotifiedId = id;
    for (const f of [...artboardListeners]) {
      try {
        f(id);
      } catch (e) {
        console.error(e);
      }
    }
  }
  function emitActiveArtboard(): void {
    // The rail's paint swatch follows the same active artboard (plans/179 A1), and this
    // is the one function that already runs on every selection change, commit and
    // `tl-time` - so it is where the swatch is kept in step. Ahead of the frameCfg
    // guard: a no-frames document still has a `background` to re-show after an undo.
    syncBgField();
    if (!frameCfg) return;
    const boxes = getBoxes();
    const fk = frameCfg.frameKind;
    const frames = boxes.filter((b) => b && String(b[cfg.kindField]) === fk);
    // With artboards in the doc the canvas rect is only the pasteboard - this class
    // drops the shell's page chrome (the outer shadow ring) so the artboards are the
    // only page-looking surfaces (plans/141; see parts/tool.css).
    canvasEl.classList.toggle('fc-has-frames', frames.length > 0);
    const info = (b: Box | null): { id: string; w: number; h: number } | null =>
      b ? { id: idOf(b, boxes.indexOf(b)), w: num(b[cfg.wField]), h: num(b[cfg.hField]) } : null;
    // plans/179 A11: a still export follows the artboard that CONTAINS the selection,
    // not the primary one. Selecting a card on slide 3 and exporting PNG used to export
    // slide 1. `activeFrameIdFor` is the same resolution the rail's fill swatch uses -
    // a selected artboard, else the one owning the selected box, else primary - so the
    // swatch you just painted and the page you just exported can never disagree.
    const activeId = activeFrameIdFor(boxes, selection, frameFields());
    // Ahead of the `activeArtboardKey` dedupe below, which also folds in the PLAYHEAD's
    // artboard and the two sizes - none of which change which board the editor is "on".
    notifyActiveArtboard(frames.length ? activeId : '');
    const sel = activeId
      ? (frames.find((b) => String(b[cfg.idField] ?? '') === activeId) ?? null)
      : null;
    const timedEl = canvasEl.querySelector<HTMLElement>(
      '[data-pdf-page][data-t-start]:not(.seq-off)'
    );
    const timedId = timedEl?.getAttribute('data-frame-id') ?? '';
    const timed = timedId
      ? (frames.find((b) => String(b[cfg.idField] ?? '') === timedId) ?? null)
      : null;
    const detail = { sel: info(sel), timed: info(timed) };
    const key = JSON.stringify(detail);
    if (key === activeArtboardKey) return;
    activeArtboardKey = key;
    if (detail.sel) canvasEl.dataset.fcActiveFrame = detail.sel.id;
    else delete canvasEl.dataset.fcActiveFrame;
    // Fires at mount too (renderChrome), so construct from the element's own realm -
    // a bare CustomEvent here can resolve to Node's own in a jsdom harness.
    const Ev = (canvasEl.ownerDocument?.defaultView?.CustomEvent ??
      CustomEvent) as typeof CustomEvent;
    canvasEl.dispatchEvent(new Ev('fc-artboard', { bubbles: true, detail }));
  }

  // Align the frame dimmer to the export frame. Runs on every sync (pan / zoom /
  // resize) regardless of selection or text-edit state, so the "faded outside the
  // frame" cue tracks the artboard wherever it moves.
  function positionFrameScrim(): void {
    // With artboards in the doc the canvas rect is just the pasteboard - dimming
    // outside it would mark a false "export frame" (each artboard's own page
    // surface + shadow is the cue, and exports are per-artboard; plans/141 WP-B).
    if (frameCfg && getBoxes().some((b) => b && String(b[cfg.kindField]) === frameCfg.frameKind)) {
      frameScrim.hidden = true;
      return;
    }
    frameScrim.hidden = false;
    const m = metrics();
    const wh = canvasWH();
    const tl = nativeToStage(0, 0, m);
    frameScrim.style.left = tl.x + 'px';
    frameScrim.style.top = tl.y + 'px';
    frameScrim.style.width = wh.w * m.scale + 'px';
    frameScrim.style.height = wh.h * m.scale + 'px';
  }

  // Frame name labels: rebuild the tabs only when the frame set / order / active state
  // changes (tracked by frameLabelKey), and reposition them every sync - the same MODEL-px
  // discipline positionFrameScrim uses. Hidden entirely while editing text or in pen mode so
  // the canvas stays clean. frameCfg-gated.
  let frameLabelKey = '';
  function syncFrameLabels(boxes: Box[]): void {
    if (!frameCfg) return;
    if (editing || penDraft || penEdit) {
      if (frameLabels.childElementCount) frameLabels.replaceChildren();
      frameLabelKey = '';
      return;
    }
    const fk = frameCfg.frameKind;
    const of = frameCfg.orderField ?? '';
    const frames = boxes
      .map((b, i) => ({ b, i }))
      .filter(({ b }) => String(b?.[cfg.kindField]) === fk)
      .sort(
        (a, c) => num(a.b?.[of]) - num(c.b?.[of]) || num(a.b?.[cfg.xField]) - num(c.b?.[cfg.xField])
      );
    if (!frames.length) {
      if (frameLabels.childElementCount) frameLabels.replaceChildren();
      frameLabelKey = '';
      return;
    }
    // The NAME is part of the key: a rename has to repaint the tab (plans/179 A10).
    const key = frames
      .map(
        ({ b, i }, n) =>
          `${idOf(b, i)}:${n}:${selection.has(idOf(b, i)) ? 1 : 0}:${frameLabelText(b, n)}`
      )
      .join('|');
    // Never rebuild under an open rename - the input lives in this container and a
    // replaceChildren would delete it mid-word.
    if (key !== frameLabelKey && !renamingFrameId) {
      frameLabelKey = key;
      frameLabels.replaceChildren(
        ...frames.map(({ b, i }, n) => {
          const id = idOf(b, i);
          const el = document.createElement('button');
          el.type = 'button';
          el.className = 'fc-frame-label' + (selection.has(id) ? ' is-active' : '');
          el.dataset.frameId = id;
          el.textContent = frameLabelText(b, n);
          if (nameField) {
            el.title = t('Double-click to rename');
            el.setAttribute('aria-keyshortcuts', 'F2 Enter');
          }
          return el;
        })
      );
    }
    const m = metrics();
    const kids = frameLabels.children;
    for (let n = 0; n < frames.length; n++) {
      const el = kids[n] as HTMLElement | undefined;
      if (!el) continue;
      const fb = frames[n]!.b;
      const tl = nativeToStage(num(fb[cfg.xField]), num(fb[cfg.yField]), m);
      const left = `${Math.round(tl.x)}px`;
      const top = `${Math.round(Math.max(2, tl.y - 20))}px`;
      el.style.left = left;
      el.style.top = top;
      // The rename input rides on the same rect as the tab it replaces, so a pan or zoom
      // mid-rename does not leave it behind.
      if (renamingFrameId && idOf(fb, frames[n]!.i) === renamingFrameId) {
        const inp = frameLabels.querySelector<HTMLElement>('.fc-frame-rename');
        if (inp) {
          inp.style.left = left;
          inp.style.top = top;
        }
      }
    }
  }

  // ── artboard rename (plans/179 A10) ──────────────────────────────────────────
  //
  // The tabs were hard-coded "Artboard N" and there was no rename anywhere on the canvas,
  // so the `name` an import fills in was written and never shown. The tab now reads the
  // name when there is one, and a double-click turns it into a one-field editor: Enter or
  // a click away saves, Escape cancels. Single click still solos the frame.
  let renamingFrameId = '';

  /** The tab text for a frame: its own name, else its 1-based place in the PAGE order.
   *  `Artboard` is the key every one of the 26 catalogues already carries; an
   *  `Artboard {n}` key would be a NEW string in none of them, so a French deck would
   *  have regressed from "Plan de travail 1" to "Artboard 1". */
  function frameLabelText(b: Box | undefined, n: number): string {
    const nm = nameField ? String(b?.[nameField] ?? '').trim() : '';
    return nm || `${t('Artboard')} ${n + 1}`;
  }

  function startFrameRename(el: HTMLElement, fid: string): void {
    if (!nameField || renamingFrameId || !fid) return;
    const boxes = getBoxes();
    const i = boxes.findIndex((b, n) => idOf(b, n) === fid);
    if (i < 0) return;
    renamingFrameId = fid;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'fc-frame-rename field-input';
    input.value = String(boxes[i]![nameField] ?? '');
    input.placeholder = el.textContent || '';
    input.setAttribute('aria-label', t('Artboard name'));
    input.spellcheck = false;
    input.style.left = el.style.left;
    input.style.top = el.style.top;
    el.hidden = true;
    frameLabels.appendChild(input);
    input.focus();
    input.select();
    let done = false;
    /**
     * `refocus` is only ever true for a KEY (Enter / Escape): the input is about to be
     * removed and the tab it replaced is about to be rebuilt, so without a hand-back
     * focus falls to `<body>` - where the next Tab restarts at the top of the page and
     * every bare canvas shortcut is live again. A blur, by contrast, means the user has
     * already put the focus somewhere themselves, and taking it back would fight them.
     */
    const finish = (save: boolean, refocus = false): void => {
      if (done) return;
      done = true;
      renamingFrameId = '';
      input.remove();
      el.hidden = false;
      if (save && nameField) {
        const bs = getBoxes();
        const j = bs.findIndex((b, n) => idOf(b, n) === fid);
        const v = input.value.trim();
        if (j >= 0 && String(bs[j]![nameField] ?? '') !== v) {
          commit(bs.map((b, n) => (n === j ? { ...b, [nameField]: v } : b)));
        }
      }
      frameLabelKey = ''; // force the tab to repaint with the new name
      renderChrome();
      // The repaint replaced the tab, so `el` is detached - find the new one by id.
      if (refocus) {
        const back = [...frameLabels.querySelectorAll<HTMLElement>('.fc-frame-label')].find(
          (l) => (l.dataset.frameId || '') === fid
        );
        back?.focus();
      }
    };
    // Typing a name must not reach the canvas shortcuts (every letter is a tool).
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        finish(true, true);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        finish(false, true);
      }
    });
    input.addEventListener('blur', () => finish(true));
    input.addEventListener('pointerdown', (e) => e.stopPropagation());
  }

  function paintChrome(boxes: Box[], liveRects: Map<number, Rect> | null): void {
    // The one place a selection change is announced (see selListeners) - BEFORE the
    // text-edit / pen early returns, so a listener never misses a change made in
    // those modes. Inert (returns immediately) when nothing is listening.
    notifySelection();
    syncFrameLabels(boxes);
    // M2 - reposition the frame scrim only when the artboard geometry changed (pan/
    // zoom/resize set scrimDirty); a box drag/hover/selection change never moves it.
    const movedStage = scrimDirty;
    if (scrimDirty) {
      positionFrameScrim();
      scrimDirty = false;
    }
    // Ghosts and motion paths are both positioned in stage px from the MODEL, exactly
    // like the selection outline, so they have to be re-placed whenever the artboard's
    // geometry or the model moves. Skipped on the LIVE path (`liveRects` non-null = a
    // box drag is in flight) unless the stage itself moved - and the two have SEPARATE
    // reasons, which is worth writing down because the shared line reads like one:
    //
    //   • a GHOST is of an off-playhead box, which is by definition never the one being
    //     dragged, so rebuilding it sixty times a second buys nothing;
    //   • a MOTION PATH is of the box being dragged, and skipping it is what holds the
    //     line still at the pose the drag started from. Not a compromise: no gesture
    //     here writes the model while the pointer is down (see writeGradSpec's note -
    //     it is the discipline all of them follow), `getBoxes()` hands back the input's
    //     own array, and `samplePaths` memoises on that array's IDENTITY plus the
    //     selection and the artboard size. So a paint per pointermove would re-run the
    //     same map over the same samples and draw the same polyline - the path CANNOT
    //     follow a live drag, and the honest picture is the authored one it is still
    //     describing. The commit at pointerup replaces the array, which is the moment
    //     the path is allowed to move.
    if (!liveRects || movedStage) {
      paintOnion();
      paintMotion();
    }
    // ── THE ONE RULE, enforcement point 2 of 3: RETENTION (see the file header) ──
    // The chrome below is positioned from the MODEL, mapped through the playhead's own
    // pose (`chromeRect`) - and a HIDDEN box has no pose, because the applier hands its
    // styles back when it leaves the window. So a selected box the sequence is hiding
    // would get a full outline, 8 resize handles, a rotate handle and a contextual bar
    // painted at its authored rect over empty canvas - the "edit a layer you cannot
    // see" failure, and the ONLY drag entry point that never goes through the hit-test
    // (a handle is its own pointerdown target). So the whole apparatus comes down and
    // the reconciliation banner goes up instead.
    if (timeCfg && selection.size && !selectionLive(boxes)) {
      const offIdx = selIndices(boxes);
      if (offIdx.length) {
        clearChrome();
        hideCtxBar();
        closeMorePanel();
        chromeKey = '';
        ctxSelKey = '';
        showOffPlayhead(boxes, offIdx);
        updateToolbarState(0);
        return;
      }
    }
    hideOffPlayhead();
    // While editing text, suppress selection chrome + ctxbar; just keep the floating
    // format bar tracking the box as the stage pans/zooms.
    if (editing) {
      clearChrome();
      hideCtxBar();
      positionFmtBar();
      return;
    }
    // Pen mode owns the chrome outright - no selection outline, no resize handles, and the
    // object bar replaced by the pen's own. Same suppression a text edit does, for the same
    // reason: the box's frame is not what is being manipulated.
    if (penDraft || penEdit) {
      clearChrome();
      penSyncFromModel(boxes);
      if (penDraft || penEdit) {
        paintPen();
        syncPenChrome();
        penCtxBar();
        updateToolbarState(0);
        syncBoxA11y();
        emptyHint.hidden = true;
        return;
      }
    }
    if (penChromeKey) clearPenChrome();
    paintPen();
    const idx = selIndices(boxes);
    const m = metrics();
    // Gradient handles sit UNDER the selection chrome in z-order but are painted here
    // so they track the same pan/zoom sync (and self-exit if their box went away).
    // Gradient mode belongs to ONE box. If the selection moved on, leave the mode -
    // otherwise the ctx bar rebuilds for the new box while the Fill field and Delete
    // still write to the old one, which is silent, wrong, and very hard to spot.
    if (gradEdit != null && !(idx.length === 1 && idOf(boxes[idx[0]!], idx[0]!) === gradEdit)) {
      exitGradEdit();
      ctxSelKey = '';
    }
    paintGradChrome(boxes, m);
    // M1 - build the outline(s) + handles ONCE per selection set, then only reposition.
    const key = idx.length
      ? idx
          .map((i) => idOf(boxes[i], i))
          .sort()
          .join(',')
      : '';
    if (key !== chromeKey) {
      chromeKey = key;
      buildChrome(idx.length); // (re)create nodes for the new set
    }
    positionChrome(boxes, idx, liveRects, m);
    // Contextual bar - rebuilt when the selection set changes OR when the VALUES it shows
    // change (plan 179 A16). The set alone was not enough: Cmd+Z put the old fill back in
    // the model and left the swatch showing the colour that had just been undone, which is
    // the one state a colour control must never be in. The signature is the handful of
    // fields the bar actually paints, so an opacity drag or a text edit still costs nothing.
    const ctxKey = idx.length ? `${key}|${ctxValueSig(boxes, idx)}` : '';
    if (ctxKey !== ctxSelKey) {
      ctxSelKey = ctxKey;
      if (idx.length) rebuildCtxBar(boxes, idx);
      else {
        hideCtxBar();
        closeMorePanel();
        multiTapMode = false;
      }
    }
    // Now that the ctx bar exists (and cannot close the panel again this frame), honour
    // a pending request to open the gradient panel, anchored on the live button.
    if (gradPanelPending && gradEdit != null) {
      gradPanelPending = false;
      const btn = ctxbar.querySelector<HTMLElement>('[data-cx="grad"]');
      if (btn) openGradPanel(btn);
    }
    if (idx.length) positionCtxBar(boxes, idx, liveRects, m);
    updateToolbarState(idx.length);
    syncBoxA11y();
    // A doc holding only empty ARTBOARDS is still content-empty - keep inviting the
    // first card until a non-frame box exists (a blank Design now seeds Artboard 1).
    const hasContentBox = frameCfg
      ? boxes.some((b) => b && String(b[cfg.kindField]) !== frameCfg.frameKind)
      : boxes.length > 0;
    emptyHint.hidden = hasContentBox || !toolbar.querySelector('.fc-btn-add');
  }
  // Make each rendered card keyboard-focusable + labelled, and reflect selection state, so
  // keyboard users can Tab to a card (which selects it → every onKey action applies) and
  // screen readers announce it. The tool template owns the .lolly-box elements; we annotate
  // them here after each sync (fresh elements after a re-render arrive without the attrs).
  function syncBoxA11y(): void {
    canvasEl.querySelectorAll<HTMLElement>('.lolly-box[data-box-id]').forEach((el) => {
      const id = el.getAttribute('data-box-id') || '';
      if (!el.hasAttribute('tabindex')) {
        el.tabIndex = 0;
        el.setAttribute('role', 'button');
        const txt = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60);
        el.setAttribute('aria-label', txt ? tRaw('Card: {text}', { text: txt }) : t('Card'));
      }
      const on = selection.has(id);
      if ((el.getAttribute('aria-pressed') === 'true') !== on)
        el.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  // Create the chrome node set for a selection of `count` boxes (0 = none, 1 = single
  // with 8 resize handles + rotate, 2+ = group AABB with 4 corners + rotate). Nodes
  // are stored in chromeNodes so subsequent syncs reposition them without recreating
  // (or re-binding pointerdown). positionChrome fills in geometry.
  function buildChrome(count: number): void {
    chrome.innerHTML = '';
    const outlines: HTMLElement[] = [];
    const handles: HTMLElement[] = [];
    let groupOutline: HTMLElement | null = null;
    let stem: HTMLElement | null = null;
    let rot: HTMLElement | null = null;
    if (count === 1) {
      const o = document.createElement('div');
      o.className = 'fc-outline';
      outlines.push(o);
      chrome.appendChild(o);
      for (const h of HANDLES) {
        const el = document.createElement('div');
        el.className = 'fc-handle fc-h-' + h;
        el.addEventListener('pointerdown', (e) => onHandlePointerDown(e, h));
        handles.push(el);
        chrome.appendChild(el);
      }
      stem = document.createElement('div');
      stem.className = 'fc-rot-stem';
      chrome.appendChild(stem);
      rot = document.createElement('div');
      rot.className = 'fc-handle fc-h-rotate';
      rot.setAttribute('data-tip', t('Rotate'));
      rot.addEventListener('pointerdown', (e) => onHandlePointerDown(e, 'rotate'));
      chrome.appendChild(rot);
    } else if (count > 1) {
      for (let k = 0; k < count; k++) {
        const o = document.createElement('div');
        o.className = 'fc-outline';
        outlines.push(o);
        chrome.appendChild(o);
      }
      groupOutline = document.createElement('div');
      groupOutline.className = 'fc-outline fc-group-outline';
      chrome.appendChild(groupOutline);
      for (const name of ['nw', 'ne', 'se', 'sw'] as Corner[]) {
        const el = document.createElement('div');
        el.className = 'fc-handle fc-h-' + name;
        el.addEventListener('pointerdown', (e) => onGroupHandleDown(e, name));
        handles.push(el);
        chrome.appendChild(el);
      }
      stem = document.createElement('div');
      stem.className = 'fc-rot-stem';
      chrome.appendChild(stem);
      rot = document.createElement('div');
      rot.className = 'fc-handle fc-h-rotate';
      rot.setAttribute('data-tip', t('Rotate group'));
      rot.addEventListener('pointerdown', (e) => onGroupHandleDown(e, 'rotate'));
      chrome.appendChild(rot);
    }
    chromeNodes = { outlines, groupOutline, handles, stem, rot };
  }

  /**
   * The rect the chrome for box `i` is drawn on: the live DOM rect mid-gesture (else
   * the model's), mapped through whatever pose the playhead has that box in.
   *
   * ⚑ plans/104 section 9.15. The chrome used to be placed from the model ALONE, which is
   * right for an untimed board and wrong the moment a keyframe or a camera moves the
   * box: the outline and all eight handles drew at the authored rect while the artwork
   * sat somewhere else entirely, so the user was offered editing controls over a patch
   * of empty canvas. Section 6.5's rule is that chrome goes through the same fold the
   * render did, and `seqPoseId` is that fold - read back from the applier, never
   * re-evaluated here.
   *
   * The MODEL is still what a gesture writes (an off-diamond edit moves the base; see
   * section 8's latch), so this deliberately changes where the controls are drawn and
   * nothing about what they do.
   *
   * A box with a LIVE rect is the exception, and not an arbitrary one: `applyLiveRect`
   * writes `transform: rotate(...)` straight onto the element, which CLOBBERS the
   * applier's composed pose for the duration of the drag. So mid-gesture the box really
   * is unposed on screen, and posing its chrome would be the original bug with the
   * signs reversed. The live rect is used verbatim, exactly as it always was.
   */
  function chromeRect(boxes: Box[], i: number, liveRects: Map<number, Rect> | null): Rect {
    const live = liveRects?.get(i);
    if (live) return live;
    const r = boxRect(boxes[i], cfg);
    if (!seqPoseOf) return r;
    const pose = seqPoseId(idOf(boxes[i], i));
    return pose ? posedRect(r, pose) : r;
  }

  // Reposition the (already-built) chrome nodes for the current selection. Pure style
  // writes - pixel-identical to the old build path, just no node churn.
  function positionChrome(
    boxes: Box[],
    idx: number[],
    liveRects: Map<number, Rect> | null,
    m: Metrics
  ): void {
    const nodes = chromeNodes;
    if (!nodes) return;
    // Resolved ONCE per sync: a posed rect costs a `querySelector` per box, and the
    // group branch below would otherwise ask for every one of them a second time.
    const rects = idx.map((i) => chromeRect(boxes, i, liveRects));
    for (let k = 0; k < idx.length; k++) {
      const r = rects[k]!;
      const tl = nativeToStage(r.x, r.y, m);
      const o = nodes.outlines[k]!;
      o.style.left = tl.x + 'px';
      o.style.top = tl.y + 'px';
      o.style.width = r.w * m.scale + 'px';
      o.style.height = r.h * m.scale + 'px';
      o.style.transform = r.rot ? `rotate(${r.rot}deg)` : '';
    }
    if (idx.length === 1) {
      positionHandles(rects[0]!, m);
    } else if (idx.length > 1) {
      positionGroupHandles(aabbOfRects(rects), m);
    }
  }

  function positionHandles(r: Rect, m: Metrics): void {
    const nodes = chromeNodes;
    if (!nodes) return;
    const box = {
      [cfg.xField]: r.x,
      [cfg.yField]: r.y,
      [cfg.wField]: r.w,
      [cfg.hField]: r.h,
      [cfg.rotationField]: r.rot,
    };
    const corners = boxCorners(box, cfg).map((p: Point) => nativeToStage(p.x, p.y, m)); // TL,TR,BR,BL
    const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    const pos: Record<HandleName, Point> = {
      nw: corners[0]!,
      ne: corners[1]!,
      se: corners[2]!,
      sw: corners[3]!,
      n: mid(corners[0]!, corners[1]!),
      e: mid(corners[1]!, corners[2]!),
      s: mid(corners[2]!, corners[3]!),
      w: mid(corners[3]!, corners[0]!),
    };
    HANDLES.forEach((h, k) => {
      const el = nodes.handles[k]!;
      el.style.left = pos[h].x + 'px';
      el.style.top = pos[h].y + 'px';
    });
    // rotate handle: outward from the BOTTOM-edge midpoint along the box "down"
    // normal - kept clear of the contextual bar (which floats above the selection)
    // and the 'n' resize handle, so the two never fight for a grab (Canva-style).
    const ROT_OFFSET = 30;
    const c = nativeToStage(r.x + r.w / 2, r.y + r.h / 2, m);
    const bottom = pos.s;
    const len = Math.hypot(bottom.x - c.x, bottom.y - c.y) || 1;
    const ux = (bottom.x - c.x) / len,
      uy = (bottom.y - c.y) / len;
    const rp = { x: bottom.x + ux * ROT_OFFSET, y: bottom.y + uy * ROT_OFFSET };
    if (nodes.stem) {
      nodes.stem.style.left = bottom.x + 'px';
      nodes.stem.style.top = bottom.y + 'px';
      nodes.stem.style.width = ROT_OFFSET + 'px';
      nodes.stem.style.transform = `rotate(${(Math.atan2(uy, ux) * 180) / Math.PI}deg)`;
    }
    if (nodes.rot) {
      nodes.rot.style.left = rp.x + 'px';
      nodes.rot.style.top = rp.y + 'px';
    }
  }

  // Axis-aligned native AABB over already-resolved rects (rotation-aware).
  function aabbOfRects(rects: Rect[]): Bounds {
    let a: Bounds | null = null;
    for (const r of rects) {
      for (const p of boxCorners(rectAsBox(r), cfg)) {
        a = a
          ? {
              minX: Math.min(a.minX, p.x),
              minY: Math.min(a.minY, p.y),
              maxX: Math.max(a.maxX, p.x),
              maxY: Math.max(a.maxY, p.y),
            }
          : { minX: p.x, minY: p.y, maxX: p.x, maxY: p.y };
      }
    }
    return a || { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }

  // The same AABB over the AUTHORED geometry - live DOM rects during a gesture, else
  // the model. This is what a group GESTURE anchors on (its scale/rotate write the
  // model), which is why it is deliberately not the posed one `positionChrome` draws.
  function groupAABBNative(
    idx: number[],
    boxes: Box[],
    liveRects: Map<number, Rect> | null
  ): Bounds {
    return aabbOfRects(idx.map((i) => (liveRects && liveRects.get(i)) || boxRect(boxes[i], cfg)));
  }

  // Group/multi-selection chrome: an axis-aligned box with 4 corner handles
  // (uniform scale) + a rotate handle. Nodes are built by buildChrome; this only
  // repositions the group outline, the 4 corner handles (nw,ne,se,sw order) and the
  // rotate stem/handle.
  function positionGroupHandles(a: Bounds, m: Metrics): void {
    const nodes = chromeNodes;
    if (!nodes) return;
    const corners: Record<Corner, Point> = {
      nw: nativeToStage(a.minX, a.minY, m),
      ne: nativeToStage(a.maxX, a.minY, m),
      se: nativeToStage(a.maxX, a.maxY, m),
      sw: nativeToStage(a.minX, a.maxY, m),
    };
    if (nodes.groupOutline) {
      nodes.groupOutline.style.left = corners.nw.x + 'px';
      nodes.groupOutline.style.top = corners.nw.y + 'px';
      nodes.groupOutline.style.width = corners.ne.x - corners.nw.x + 'px';
      nodes.groupOutline.style.height = corners.sw.y - corners.nw.y + 'px';
    }
    (['nw', 'ne', 'se', 'sw'] as Corner[]).forEach((name, k) => {
      const el = nodes.handles[k]!;
      el.style.left = corners[name].x + 'px';
      el.style.top = corners[name].y + 'px';
    });
    const bc = { x: (corners.sw.x + corners.se.x) / 2, y: (corners.sw.y + corners.se.y) / 2 };
    if (nodes.stem) {
      nodes.stem.style.left = bc.x + 'px';
      nodes.stem.style.top = bc.y + 'px';
      nodes.stem.style.width = '30px';
      nodes.stem.style.transform = 'rotate(90deg)';
    }
    if (nodes.rot) {
      nodes.rot.style.left = bc.x + 'px';
      nodes.rot.style.top = bc.y + 30 + 'px';
    }
  }

  const CORNER_PT = (a: Bounds, name: Corner): Point =>
    (
      ({
        nw: { x: a.minX, y: a.minY },
        ne: { x: a.maxX, y: a.minY },
        se: { x: a.maxX, y: a.maxY },
        sw: { x: a.minX, y: a.maxY },
      }) as Record<Corner, Point>
    )[name];
  const OPPOSITE: Record<Corner, Corner> = { nw: 'se', ne: 'sw', se: 'nw', sw: 'ne' };

  function onGroupHandleDown(e: PointerEvent, name: Corner | 'rotate'): void {
    e.stopPropagation();
    if (e.button > 0) return;
    const boxes = getBoxes();
    const sel = selIndices(boxes);
    if (sel.length < 2) return;
    const a = groupAABBNative(sel, boxes, null);
    const centre = { x: (a.minX + a.maxX) / 2, y: (a.minY + a.maxY) / 2 };
    if (name === 'rotate') {
      const m = metrics();
      const cs = nativeToStage(centre.x, centre.y, m);
      const centerClient = { x: cs.x + m.sr.left, y: cs.y + m.sr.top };
      const pointerStartDeg =
        (Math.atan2(e.clientY - centerClient.y, e.clientX - centerClient.x) * 180) / Math.PI;
      beginGesture(e, {
        type: 'grotate',
        sel,
        startBoxes: boxes,
        centre,
        centerClient,
        pointerStartDeg,
      });
    } else {
      const anchor = CORNER_PT(a, OPPOSITE[name]);
      const origDist =
        Math.hypot(CORNER_PT(a, name).x - anchor.x, CORNER_PT(a, name).y - anchor.y) || 1;
      beginGesture(e, { type: 'gscale', sel, startBoxes: boxes, anchor, origDist });
    }
  }

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
  let ctxBlockers: StageBox[] | null = null;
  /** The placement held for the life of a box gesture (see positionCtxBar). */
  let ctxFrozen: { left: number; top: number } | null = null;
  function ctxBarBlockers(sr: DOMRect): StageBox[] {
    if (ctxBlockers && gesture) return ctxBlockers;
    // .chrome-topleft, not just its .tools-home pill: the island can also carry the
    // Home fab beside the pill, and the ctx bar must dodge the whole cluster.
    //
    // The LEFT SIDEBAR is on that list too (plans/179 M4): `.fc-nav` is the navigator
    // column - open, or collapsed to its dot rail - and while it is open the tool rail is
    // a grid inside it, so one rect covers both. The rail's own dock joins them only
    // while the TIMELINE has made it a full-height column; a floating rail is vertically
    // centred and nowhere near this row, so counting it would push the bar sideways for
    // chrome that is not actually in the way.
    const out = stageBlockers(
      [
        stageEl.querySelector<HTMLElement>('.stage-nav'),
        stageEl.querySelector<HTMLElement>('.fc-nav'),
        railMode === 'timeline' ? toolbarDock : null,
        ...Array.from(document.querySelectorAll<HTMLElement>('.chrome-topleft, .tools-home')),
      ],
      sr
    );
    ctxBlockers = gesture ? out : null;
    return out;
  }

  function positionCtxBar(
    boxes: Box[],
    idx: number[],
    liveRects: Map<number, Rect> | null,
    m: Metrics
  ): void {
    if (editing) {
      hideCtxBar();
      return;
    } // hidden while typing in a box
    showCtxBar();
    // Pinned to the top chrome row (never over the selection, whose artwork the user is
    // looking at), centred in the band between the back pill and the zoom HUD and capped
    // to it - a bar too wide for a narrow phone row scrolls inside that width (see the
    // `.fc-ctxbar` overflow) instead of dropping down over the canvas.
    const band = ctxTopBand({ w: m.sr.width, h: m.sr.height }, ctxBarBlockers(m.sr), {
      reserve: stageReserves(),
    });
    ctxbar.style.maxWidth = Math.max(0, band.hi - band.lo) + 'px';
    // Measured AFTER the bar is shown and its max-width is set, so `offsetWidth` reflects
    // a laid-out, capped bar rather than the zero a `hidden` element reports. A zero here
    // would paint the first frame off-centre and then snap; leave the last position alone
    // and come back next frame instead.
    const bw = ctxbar.offsetWidth || 0;
    if (bw > 0) {
      // Frozen for the life of a box gesture: the transform readout grows mid-drag
      // ("241, -235" → "113, -92 · 1920×1080"), which would re-centre the bar and walk
      // its controls sideways. It re-places on release; the readout itself keeps updating.
      const pos = liveRects && ctxFrozen ? ctxFrozen : centreCtxBar(bw, band);
      ctxFrozen = liveRects ? pos : null;
      ctxbar.style.left = pos.left + 'px';
      ctxbar.style.top = pos.top + 'px';
    }
    // Transform readout.
    const first = boxes[idx[0]!];
    const r = liveRects?.get(idx[0]!) || boxRect(first, cfg);
    const read = ctxbar.querySelector('[data-cx-readout]');
    if (read)
      read.textContent =
        idx.length > 1
          ? t('{n} selected', { n: idx.length })
          : `${Math.round(r.x)}, ${Math.round(r.y)}  ·  ${Math.round(r.w)}×${Math.round(r.h)}${r.rot ? '  ·  ' + Math.round(r.rot) + '°' : ''}`;
  }

  function updateToolbarState(count: number): void {
    // Nothing hard-disabled - align-to-canvas works on a single box; arrange/delete
    // no-op when empty. Just reflect which tool is live, and whether the layout
    // options have anything to act on.
    syncModeUI();
    syncArrangeUI();
  }
  /** The Arrange button is layout options for a SELECTION - no selection, no button.
   *  Hidden rather than disabled: an always-there control whose whole menu no-ops is
   *  what made "arrange" read as broken. Nothing else reaches these actions through
   *  it (right-click and the keyboard are unchanged), so hiding it removes no path. */
  function syncArrangeUI(): void {
    if (arrangeBtn) arrangeBtn.hidden = selection.size === 0;
  }

  // ── helpers ───────────────────────────────────────────────────────────────────
  const rectAsBox = (r: Rect): Box => ({
    [cfg.xField]: r.x,
    [cfg.yField]: r.y,
    [cfg.wField]: r.w,
    [cfg.hField]: r.h,
    [cfg.rotationField]: r.rot,
  });
  function rotOf(el: HTMLElement): number {
    const t = el.style.transform || '';
    const mm = t.match(/rotate\(([-0-9.]+)deg\)/);
    return mm ? parseFloat(mm[1]!) : 0;
  }
  function normHex(v: any, fallback = '#ffffff'): string {
    const s = String(v == null ? '' : v).trim();
    if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase();
    if (/^#[0-9a-fA-F]{3}$/.test(s))
      return ('#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3]).toLowerCase();
    return fallback;
  }
  function cssEscape(s: any): string {
    return window.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/["\\]/g, '\\$&');
  }
  // Finite number clamped to [lo,hi], or the default when not a number.
  function clampN(v: any, dflt: number, lo: number, hi: number): number {
    const n = typeof v === 'number' ? v : parseFloat(v);
    if (!Number.isFinite(n)) return dflt;
    return n < lo ? lo : n > hi ? hi : n;
  }
  // Delegates to the canonical 5-char escape (utils.ts) - this used to hand-roll a 4-char
  // (no `'`) escape, safe only by accident of every call site using double-quoted attrs.
  function escapeHtml(s: any): string {
    return escape(s);
  }
  function fmtDate(iso: any): string {
    try {
      return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
      return String(iso);
    }
  }

  // ── keyboard ─────────────────────────────────────────────────────────────────
  // Shadow-aware: jelly text fields keep their real <input> in a shadow root, so a
  // host-only tagName test reads as "not typing" and shortcuts eat the keystroke.
  function typingTarget(): boolean {
    return isTypingTarget();
  }
  // Keyboard focus on a card selects it, so Tab / Shift-Tab cycle the cards and the onKey
  // actions (Delete, arrows, duplicate, group…) apply. Pointer focus is ignored here -
  // pointerdown already owns pointer selection (and would clobber shift-click multi-select).
  function onBoxFocus(e: FocusEvent): void {
    if (gesture || editing) return;
    const el = (e.target as HTMLElement | null)?.closest?.(
      '.lolly-box[data-box-id]'
    ) as HTMLElement | null;
    if (!el || !el.matches(':focus-visible')) return;
    const id = el.getAttribute('data-box-id');
    if (!id || (selection.size === 1 && selection.has(id))) return;
    selection = new Set([id]);
    renderChrome();
  }
  /**
   * Does this press CHANGE the selected boxes? The keyboard half of the one rule gates
   * on exactly this set and nothing else, so navigation (Tab, ⌘A, the tool letters) and
   * every escape route stay live on an off-playhead selection.
   *
   * The list mirrors onKey's own mutating branches below: arrow nudge, delete, the
   * text-edit entry (Enter/F2 - starting a text edit on a box nobody can see is the
   * same mistake in slow motion), duplicate, group/ungroup, and z-order.
   */
  function isMutatingKey(e: KeyboardEvent): boolean {
    const k = e.key;
    // Alt+←/→ is the seek chord the nudge branch below declines - it edits nothing, so it
    // must not be answered with "this card is not on screen". Alt+↑/↓ is NOT that chord
    // and nudges like any other arrow, so it is a mutating press (this used to decline all
    // four, which made Alt+↑/↓ a key that did nothing anywhere).
    if (k === 'ArrowLeft' || k === 'ArrowRight') return !e.altKey;
    if (k === 'ArrowUp' || k === 'ArrowDown') return true;
    if (k === 'Delete' || k === 'Backspace') return true;
    if (k === 'Enter' || k === 'F2') return true;
    if (!(e.metaKey || e.ctrlKey)) return false;
    return k === 'x' || k === 'X' || k === 'd' || k === 'D' || k === 'g' || k === 'G'
      || k === ']' || k === '[' || (e.altKey && (k === 'v' || k === 'V'));
  }
  /**
   * Chrome that puts focusable controls over the canvas opts out of the canvas keyboard
   * by marking its own root `data-canvas-keys="off"`: the Design top bar, the right edge
   * dock column, the navigator column. The verbs in `onKey` are bound on `window`, so
   * without this a focused button in one of those roots was a live canvas surface -
   * Delete on the Export button removed the selection, an arrow key in a menu nudged a
   * box. One attribute check covers every such root, rather than a growing class list.
   *
   * The event target AND the deep active element are both tested: a pointer-focused
   * button is the target, while a jelly text field keeps its real input in a shadow root
   * (the event retargets to the host, which is what `closest` can walk).
   *
   * The two exemptions are the ones those roots already make by hand where they stop
   * their own keys (`onRootKey` in design-topbar.ts and design-navigator.ts), so the
   * attribute says the same thing rather than something stricter: app-wide chords carry
   * meta/ctrl and mean the same wherever focus is, and Escape is how you leave a mode,
   * a draft or a selection, so it belongs to the ladder below from anywhere.
   *
   * The NEAREST marked ancestor decides, so a surface inside one of those roots can say
   * `data-canvas-keys="on"` and get the canvas keys back. The tool rail needs exactly
   * that: it is a canvas palette that free-canvas parks inside the navigator column while
   * that column is open, and without the opt-back-in `v` armed the pointer tool from a
   * floating rail and did nothing from a docked one - the same button, two meanings.
   */
  function chromeKeysOff(e: KeyboardEvent): boolean {
    if (e.metaKey || e.ctrlKey || e.key === 'Escape') return false;
    const off = (el: HTMLElement | null): boolean =>
      el?.closest?.('[data-canvas-keys]')?.getAttribute('data-canvas-keys') === 'off';
    if (off(e.target as HTMLElement | null)) return true;
    return off(deepActiveElement() as HTMLElement | null);
  }
  function onKey(e: KeyboardEvent): void {
    if (disposed) return;
    // The timeline panel binds its keys on its OWN root and owns them while focus is
    // inside it (deck-editor's `.deck-strip, .deck-bar…` bail). Without this, Delete /
    // arrows / ⌘A / Enter typed at a clip would also hit the canvas selection.
    if (timelinePanel && (document.activeElement as HTMLElement | null)?.closest?.('.tl-panel'))
      return;
    if (chromeKeysOff(e)) return;
    // ── Escape: ONE ladder, innermost rung first, one rung per press ───────────
    // Escape is exempt from the typing bail below on purpose: it is how you get out of a
    // text edit too (onEditKey owns that and stops here).
    //
    // The rule that matters is that a rung only swallows the key if it actually DID
    // something. The old first rung returned on a merely non-null `popover` / `morePanel`
    // reference, so a reference left pointing at a detached element silently ate the next
    // Escape - the reported "Esc does not leave point editing". A floating surface that is
    // no longer in the document is not a rung.
    if (e.key === 'Escape') {
      // Rung 1 stays the colour popover - it is the innermost surface, and it can be
      // open over the gradient panel while picking a stop's brand swatch.
      if (stageEl.querySelector('.color-popover:not([hidden])') && dismissFloating()) {
        e.preventDefault();
        return;
      }
      // Gradient editing is a MODE like point editing, and its panel is part of it:
      // closing just the panel left the handles up with no way back to it (the toolbar
      // button now reads as "leave"), so Escape takes the whole mode.
      if (gradEdit != null) {
        e.preventDefault();
        closeMorePanel();
        exitGradEdit();
        return;
      }
      if (dismissFloating()) {
        e.preventDefault();
        return;
      }
      // Cancel, not commit: a draft dies here and Enter (or a tool switch) is what keeps it.
      if (penDraft) {
        e.preventDefault();
        penCancelDraw();
        return;
      }
      // Point editing ends and the rail is already the pointer, since it never left it.
      if (penEdit) {
        e.preventDefault();
        endPenEdit();
        return;
      }
      if (mode !== 'select') {
        e.preventDefault();
        toPointer('discard');
        return;
      }
      if (selectedEdges.size) {
        e.preventDefault();
        deselectEdge();
        return;
      }
      if (selection.size) {
        e.preventDefault();
        selection = new Set<string>();
        renderChrome();
        return;
      }
      return; // nothing left to back out of - leave the key alone
    }
    // ── the pen's other keys ───────────────────────────────────────────────────
    // Each already means something on a box, so the pen takes them only while it is
    // actually on, and hands them straight back when it is not. The split follows the
    // meanings already in this handler rather than redefining them:
    //   Enter - "commit the thing you are in the middle of", as it commits a text edit;
    //             it finishes the drawn path and leaves point editing.
    //   Delete/Backspace - "remove what is selected", so it drops the last placed node
    //             while drawing and the selected nodes while editing, never the box.
    if ((penDraft || penEdit) && !typingTarget()) {
      if (penDraft) {
        if (e.key === 'Enter') {
          e.preventDefault();
          penFinishDraw();
          return;
        }
        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault();
          penUndoNode();
          return;
        }
      } else if (penEdit) {
        if (e.key === 'Enter') {
          e.preventDefault();
          endPenEdit();
          return;
        }
        if ((e.key === 'Delete' || e.key === 'Backspace') && penSel.size) {
          e.preventDefault();
          penDeleteSelected();
          return;
        }
        if (e.key === 'a' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          penSel = new Set(penEdit.path.nodes.map((_, i) => i));
          ctxSelKey = null;
          renderChrome();
          return;
        }
      }
    }
    if (typingTarget()) return;
    // The canvas-wide sheet. A focused timeline returns at the top of this handler and
    // keeps its own detailed `?` inventory; every other Design surface gets this one.
    if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey && designChrome) {
      e.preventDefault();
      showShortcuts(document.activeElement as HTMLElement | null);
      return;
    }
    if (
      authoringGuides &&
      e.shiftKey &&
      !e.metaKey &&
      !e.ctrlKey &&
      !e.altKey &&
      (e.key === 'r' || e.key === 'R')
    ) {
      e.preventDefault();
      setGuidesVisible(!authoringGuides.isVisible());
      return;
    }
    // ── THE ONE RULE, enforcement point 3 of 3: KEYBOARD ────────────────────────
    // Chrome suppression closes every POINTER path onto an off-playhead box; a nudge,
    // a Delete or a duplicate needs no chrome at all. Navigation stays live on purpose
    // - Tab still moves, Escape (handled above, before this gate) still deselects, and
    // ⌘A still selects all - because the way out of this state must never be blocked.
    if (timeCfg && selection.size && isMutatingKey(e) && !selectionLive(getBoxes())) {
      e.preventDefault();
      announce(t('This card is not on screen at the playhead. Go to it to edit it.'));
      return;
    }
    // Standard copy/paste-properties chord (Figma/Sketch): the in-memory snapshot means
    // clipboard permission can never make the operation flaky. Copy is a read; Paste is
    // covered by the off-playhead mutation gate immediately above.
    if ((e.metaKey || e.ctrlKey) && e.altKey && !e.shiftKey) {
      if ((e.key === 'c' || e.key === 'C') && selection.size) {
        e.preventDefault();
        copySelectionStyle();
        return;
      }
      if ((e.key === 'v' || e.key === 'V') && selection.size && styleClipboard) {
        e.preventDefault();
        pasteSelectionStyle();
        return;
      }
    }
    // Flip the selection: Shift+H mirrors horizontally, Shift+V vertically (Figma/Sketch's
    // keys). Shift-qualified deliberately - bare V is already the Pointer tool below (the
    // Illustrator convention), so bare V would hijack it, and the pair stays symmetric behind
    // one modifier. Checked BEFORE the V/P tool letters so Shift+V flips rather than arming the
    // pointer; it falls through to the pointer when nothing is selected or the tool has no flip
    // field, so that path is untouched. After `typingTarget()` above, so a field/text edit
    // types the letter instead. Cmd/Ctrl/Alt variants are left alone.
    if (
      e.shiftKey &&
      !e.metaKey &&
      !e.ctrlKey &&
      !e.altKey &&
      canFlip &&
      selection.size &&
      (e.key === 'h' || e.key === 'H' || e.key === 'v' || e.key === 'V')
    ) {
      e.preventDefault();
      applyFlip(e.key === 'v' || e.key === 'V' ? 'v' : 'h');
      return;
    }
    // Tool shortcuts, the Illustrator/Figma letters: V pointer, P pen. Unmodified only -
    // ⌘V is paste and ⌘P is print - and after `typingTarget()`, so a live text edit or any
    // focused field gets the letter typed into it instead. Neither letter meant anything
    // here before (the only unmodified keys taken are Escape/Enter/F2/Delete/arrows, and
    // tool-stage-nav's 0/1/+/-).
    if (!e.metaKey && !e.ctrlKey && !e.altKey && (e.key === 'v' || e.key === 'V')) {
      e.preventDefault();
      pickPointer();
      return;
    }
    if (
      !e.metaKey &&
      !e.ctrlKey &&
      !e.altKey &&
      (e.key === 'p' || e.key === 'P') &&
      cfg.pathField
    ) {
      e.preventDefault();
      if (mode !== 'pen') setMode('pen');
      return;
    }
    // N - the Node tool (Inkscape's key). Toggles direct node editing on the selection.
    if (
      !e.metaKey &&
      !e.ctrlKey &&
      !e.altKey &&
      (e.key === 'n' || e.key === 'N') &&
      cfg.pathField
    ) {
      e.preventDefault();
      toggleNodeTool();
      return;
    }
    // Enter / F2 on a selected box → edit its text (select-all so typing replaces it).
    // On a kind with no text node - an artboard, an audio bed, a camera marker -
    // `startTextEdit` returns on the missing node and nothing at all happens, which is
    // the silent no-op plan 179 C3 refuses. The object bar hides its pencil for those
    // kinds; the keyboard has no such affordance, so it says why instead.
    // Cmd/Ctrl+Return is the tool view's Present shortcut (plans/179 M1 section 4), so a
    // held modifier is NOT a request to edit text here - it belongs to the document.
    if (
      (e.key === 'Enter' || e.key === 'F2') &&
      !(e.key === 'Enter' && (e.metaKey || e.ctrlKey)) &&
      !editing &&
      selection.size &&
      cfg.textField
    ) {
      e.preventDefault();
      const rows = getBoxes();
      const first = [...selection][0]!;
      const at = rows.findIndex((b, n) => idOf(b, n) === first);
      const k = at >= 0 ? kindOf(rows[at]) : '';
      if (NO_TEXT_KINDS.has(k)) {
        announce(t('This object has no text to edit.'));
        return;
      }
      startTextEdit(first, { selectAll: e.key === 'Enter' });
      return;
    }
    // In gradient mode the selected thing is a STOP, so Delete removes that - deleting
    // the whole card here would be a nasty surprise mid-gradient. Falls through when the
    // gradient is down to its last two stops (deleteGradStop refuses and says so).
    if ((e.key === 'Delete' || e.key === 'Backspace') && gradEdit != null) {
      e.preventDefault();
      if (!deleteGradStop()) announce(t('A gradient needs at least two stops.'));
      return;
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedEdges.size) {
      e.preventDefault();
      deleteSelectedEdge();
      return;
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && selection.size) {
      e.preventDefault();
      deleteSelection();
      return;
    }
    if ((e.key === 'd' || e.key === 'D') && (e.metaKey || e.ctrlKey) && selection.size) {
      e.preventDefault();
      duplicateSelection();
      return;
    }
    if ((e.key === 'g' || e.key === 'G') && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      e.shiftKey ? ungroupSelection() : groupSelection();
      return;
    }
    // Stacking order (Illustrator/Figma convention): Cmd/Ctrl + ] forward, + [ back;
    // add Shift to jump all the way to front / back. (Undo/redo is handled globally
    // by tool.js's onHistoryKey - Cmd+Z / Cmd+Shift+Z / Cmd+Y - and reaches the editor
    // because every edit commits through runtime.setInput, which the undo wrapper
    // records; nothing extra is needed here.)
    if ((e.key === ']' || e.key === '[') && (e.metaKey || e.ctrlKey) && selection.size) {
      e.preventDefault();
      if (e.key === ']') applyZ(e.shiftKey ? 'front' : 'forward');
      else applyZ(e.shiftKey ? 'back' : 'backward');
      return;
    }
    if (e.key === 'a' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      const boxes = getBoxes();
      selection = new Set(boxes.map((b, i) => idOf(b, i)));
      renderChrome();
      return;
    }
    // Arrow-nudge (Shift = 10px). Alt+←/→ is RESERVED, and only that pair: it is the
    // timeline panel's keyframe walk (plans/104 section 8, and section 9.2 records the decline as "the
    // seek chord"), so the chord means one thing in this editor rather than seeking in
    // the panel and nudging on the canvas. It is a reservation, not a collision: the panel
    // binds its keys on its OWN root, this handler is on `window` and bails outright while
    // focus is inside `.tl-panel`, so the two never race for the same press - the chord is
    // simply panel-focus-scoped, like `k`/`s`/`e`. Alt+↑/↓ is NOT that chord: declining it
    // too (as this once did) bought nothing and left a key that did nothing anywhere, so it
    // nudges like any other arrow.
    const nudges: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const altSeek = e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight');
    if (nudges[e.key] && selection.size && !altSeek) {
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      const [ux, uy] = nudges[e.key]!;
      const boxes = getBoxes();
      // Same containment+cascade path as the pointer-drag move (see g.type === 'move'):
      // nudging a frame-kind box must carry its members in the SAME commit, and any box
      // whose centre crosses a frame edge must re-bucket. cascadeFrameChildren + assignFrames
      // over the selected indices only - no-op on frameless tools (Design), so a
      // no-frame nudge stays byte-identical to the old moveBoxes-only path.
      const idx = selIndices(boxes);
      // …and the SAME playhead-contextual split, for the same reason (plans/104 section 8).
      // The nudge is the keyboard equivalent of the drag: on a diamond, dragging a box
      // poses the keyframe, so nudging it by the same pixel must pose it too - or the
      // accessible route silently gets the opposite model-write semantics from the
      // pointer one. One commit either way, so it stays one undo step.
      const kfIds = new Set(timelinePanel?.kfPoseIds(idx.map((i) => idOf(boxes[i], i))) ?? []);
      const moveIdx = idx.filter((i) => !kfIds.has(idOf(boxes[i], i)));
      let next = moveIdx.length ? moveBoxes(boxes, moveIdx, ux * step, uy * step, cfg) : boxes;
      if (kfIds.size && timelinePanel)
        next = timelinePanel.kfPoseWrite(next, [...kfIds], { x: ux * step, y: uy * step });
      commit(assignFrames(cascadeFrameChildren(boxes, next, moveIdx), new Set(moveIdx)));
    }
  }

  // ── wiring ────────────────────────────────────────────────────────────────────
  // Two-finger-tap recognition - capture phase, so a second finger is already recorded by
  // the time the canvas's own pointerdown handler runs (see onCanvasPointerDown).
  stageEl.addEventListener('pointerdown', onStageTouchDown, true);
  stageEl.addEventListener('pointermove', onStageTouchMove, true);
  stageEl.addEventListener('pointerup', onStageTouchUp, true);
  stageEl.addEventListener('pointercancel', onStageTouchUp, true);
  canvasEl.addEventListener('pointerdown', onCanvasPointerDown);
  stageEl.addEventListener('pointerdown', onBackdropPointerDown); // deselect/marquee on backdrop
  viewEl.addEventListener('pointerdown', onBackdropPointerDown);
  stageEl.addEventListener('contextmenu', onBackdropContextMenu);
  viewEl.addEventListener('contextmenu', onBackdropContextMenu);
  window.addEventListener('keydown', onSpaceKey);
  window.addEventListener('keyup', onSpaceKey);
  canvasEl.addEventListener('pointermove', onGestureMove);
  canvasEl.addEventListener('pointerup', onGestureEnd);
  canvasEl.addEventListener('pointercancel', onGestureEnd);
  canvasEl.addEventListener('dblclick', onDblClick);
  canvasEl.addEventListener('contextmenu', onContextMenu);
  canvasEl.addEventListener('focusin', onBoxFocus);
  // While the editor is mounted, un-clip the canvas (and the tool's own clipping
  // root inside it) so boxes dragged off the artboard stay visible + selectable -
  // their DOM still lives inside canvasEl, so clicks bubble to the handlers above.
  // Export semantics are unchanged: the raster capture is bounded by the canvas
  // rect, and the vector walkers' out-of-viewBox geometry never paints.
  canvasEl.classList.add('fc-open-canvas');
  window.addEventListener('keydown', onKey);
  document.addEventListener('paste', onGlobalPaste);
  document.addEventListener('copy', onCopy);
  document.addEventListener('cut', onCut);
  // Reposition chrome when the stage pans/zooms/resizes.
  // Geometry changed (pan/zoom/resize) - invalidate the metrics cache and mark the
  // frame scrim for repositioning (M2: paintChrome only moves the scrim when this is
  // set, so drag/hover/selection syncs skip the 100vmax shadow repaint).
  const onStageMove = (e: any): void => {
    gestureMetrics = null;
    ctxBlockers = null;
    scrimDirty = true;
    if (e && typeof e.clientX === 'number') lastPointer = { x: e.clientX, y: e.clientY };
    scheduleSync();
    reclampRail();
    if (connectLayer.style.display !== 'none') placeConnectLayer(metrics());
  };
  // pointermove fires continuously while the cursor merely HOVERS the canvas. The old
  // handler rebuilt the whole selection chrome (2 getBoundingClientRect + innerHTML swap
  // + 10 handle nodes re-bound) every frame for zero visual change. Here we only track
  // the paste-at-cursor position; a real pan (buttons held) still re-syncs, and pan/zoom
  // via the transform is already caught by the MutationObserver below - so an idle hover
  // costs nothing.
  const onStagePointerMove = (e: any): void => {
    if (e && typeof e.clientX === 'number') lastPointer = { x: e.clientX, y: e.clientY };
    // Pen: the segment from the last placed node to the cursor, previewed live. Only while
    // no gesture is running - mid-drag the pointer is pulling a handle, not proposing a
    // node. Works for `pointerType: 'touch'` too: a touch drag reports `buttons` while
    // down, so this only fires between taps and never fights stageNav's pan/pinch.
    if (
      mode === 'pen' &&
      penDraft &&
      !gesture &&
      e &&
      typeof e.clientX === 'number' &&
      !e.buttons
    ) {
      penCursor = clientToNative(e.clientX, e.clientY);
      paintPen();
      return;
    }
    // Hover affordance over connector lines (idle hover only, throttled to one rAF/frame).
    if (
      connectCfg &&
      !selectedEdges.size &&
      !gesture &&
      e &&
      !e.buttons &&
      typeof e.clientX === 'number'
    ) {
      if (!hoverRaf) hoverRaf = requestAnimationFrame(updateHover);
    }
    if (e && e.buttons) scheduleSync();
  };
  stageEl.addEventListener('pointermove', onStagePointerMove, { passive: true });
  stageEl.addEventListener('wheel', onStageMove, { passive: true });
  // The camera's wheel (plans/104 section 8) - on the CANVAS, not the stage, and non-passive
  // so a claimed notch can be preventDefault()ed. It runs BEFORE `tool-stage-nav`'s
  // stage-level listener (a canvas-level handler on the way up), and only claims the
  // event when a camera is actually armed.
  canvasEl.addEventListener('wheel', onCameraWheel as EventListener, { passive: false });
  window.addEventListener('resize', onStageMove);
  const ro = new ResizeObserver(onStageMove);
  ro.observe(stageEl);
  // A CSS transition that finishes inside the stage - the rail docking or undocking is the
  // one that matters (plans/179 A10) - changes the layout with no resize, no wheel and no
  // transform mutation, so nothing above catches it and the artboard label tabs stay where
  // the pre-transition rect put them. One re-sync at transitionend glues them back.
  // Narrowed twice over, because every rail button transitions its colour on hover and a
  // chrome rebuild per hover would be a real cost: only a transition on the RAIL, and only
  // of a property that can move something.
  const onStageTransitionEnd = (e: Event): void => {
    const el = e.target as HTMLElement | null;
    if (!el?.closest?.('.fc-toolbar-dock')) return;
    const prop = (e as TransitionEvent).propertyName || '';
    if (!/^(left|top|right|bottom|width|height|transform|inset|margin|padding)/.test(prop)) return;
    scheduleSync();
  };
  stageEl.addEventListener('transitionend', onStageTransitionEnd);
  // Keyboard/HUD zoom (setupStageNav's − / + / 0 / 1 / Fit) changes the canvas
  // wrapper's transform with NO pointer or wheel event - watch the wrapper's
  // style attribute so the selection chrome follows those zooms too.
  const mo = new MutationObserver(onStageMove);
  if (canvasEl.parentElement)
    mo.observe(canvasEl.parentElement, { attributes: true, attributeFilter: ['style'] });
  // Re-sync after every model change (paint()).
  // A bulk external apply - picking an ANIMATED template after the blank mount - can flip
  // the doc from untimed to timed; open the timeline the first time that happens, so the
  // template reads as animated. One-shot: it never re-opens after a manual close, and a
  // static template (poster / pull quote / blank) leaves the stage whole. Mirrors the
  // mount-time check below (which handles a doc that arrives already timed).
  let timelineAutoOpened = false;
  const unsub = runtime.subscribe(() => {
    scheduleSync();
    if (!timelineAutoOpened && timeCfg && anyTimed(getBoxes())) {
      timelineAutoOpened = true;
      openTimeline();
    }
  });
  // Hide-controls full preview (Figma/Penpot `\`, and `/` - Andy, 2026-09-03): strip the
  // editor chrome to a clean canvas so the artwork can be seen whole. Chrome-only - the
  // render geometry and export are untouched. Escape always restores it, so a preview
  // can never trap you. The hidden state also takes the chrome's SPACE back: editor.css
  // zeroes the stage reserves and the dock width under the class, and since the fit
  // reads computed values it only needs asking.
  const chromeRoot = (): HTMLElement | null => stageEl.closest('.tool-view');
  const refitAfterChrome = (): void => {
    try {
      canvasEl.dispatchEvent(new Event('canvas-resize'));
    } catch {
      /* stage detached */
    }
  };
  function onPreviewKey(e: KeyboardEvent): void {
    if (e.defaultPrevented) return;
    const l = chromeRoot();
    if (!l) return;
    if (
      (e.key === '\\' || e.key === '/') &&
      !e.metaKey &&
      !e.ctrlKey &&
      !e.altKey &&
      !isTypingTarget(e.target as Element | null)
    ) {
      e.preventDefault();
      l.classList.toggle('is-chrome-hidden');
      refitAfterChrome();
    } else if (e.key === 'Escape' && l.classList.contains('is-chrome-hidden')) {
      e.preventDefault();
      e.stopPropagation();
      l.classList.remove('is-chrome-hidden');
      refitAfterChrome();
    }
  }
  document.addEventListener('keydown', onPreviewKey);
  // Dismiss popover / more-panel on outside click.
  const onDocDown = (e: PointerEvent): void => {
    if (popover && !popover.contains(e.target as Node)) closePopover();
    // The colour popover is a companion of the panel, not an outside click: the whole
    // point of the gradient panel is to pick stop colours from the brand palette, and
    // closing the panel the moment you reached for a swatch made that a two-click
    // dance. `[data-cx="grad"]` is exempt for the same reason as `more`/`text` - the
    // button that opens a panel must not immediately close it.
    const t = e.target as HTMLElement;
    // Everything that IS the gradient-editing surface: the button that opens the panel,
    // the on-canvas handles, and the colour popover the panel sends you to for a brand
    // swatch. None of those are an "outside click" - treating the handles as one closed
    // the panel the instant you selected a stop.
    const companion = t.closest?.(
      '[data-cx="more"],[data-cx="text"],[data-cx="grad"],.color-popover,[data-color-field],.fc-grad-stop,.fc-grad-dir'
    );
    if (morePanel && !morePanel.contains(e.target as Node) && !companion) closeMorePanel();
  };
  document.addEventListener('pointerdown', onDocDown, true);

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
    const loaded = getBoxes();
    let next = withIds(loaded);
    // Frame membership follows spatial position (plan 112 (b)): a box placed OVER a frame
    // (its centre inside) becomes that frame's member on load - exactly as a drag would
    // assign it - so a template or import that positioned content spatially WITHOUT setting
    // `frame` still presents and per-page-exports as frames, not as excluded pasteboard. A
    // centre OUTSIDE every frame stays '' (assignFrames leaves it), keeping the pasteboard
    // scratchpad. Quiet, like the id stamping below: membership matching position is not a
    // user edit, so no onDirty (no Save-pill flash) and no history entry (no ⌘Z surprise).
    if (frameCfg) next = assignFrames(next, new Set(next.map((_, i) => i)));
    // mountTool installs the un-wrapped setter; a mount without it falls back.
    const quiet =
      (runtime as RuntimeApi & { setInputNoHistory?: RuntimeApi['setInput'] }).setInputNoHistory ??
      ((id: string, value: unknown) => runtime.setInput(id, value));
    const changed = next.length !== loaded.length || next.some((b, i) => b !== loaded[i]);
    if (changed) quiet(blockId, next);
  }

  renderChrome();

  // A composition that already has timing opens with its timeline showing; an empty
  // (or untimed) one leaves the stage whole until the user asks for it from the rail.
  if (timeCfg && anyTimed(getBoxes())) {
    timelineAutoOpened = true;
    openTimeline();
  }

  // The link's one-shot editor state (`_ui` + the `_sel`/`_t`/`_panel` shorthands,
  // lib/editor-state.ts) - and, the SAME routine, the runtime `applyUi` the handle
  // exposes (plans/176 v1). On a board with a timeline (already timed, or a playhead
  // asks for one) everything waits for the lazy panel chunk: the panel's mount owns
  // the selection adapter and the clock, so a selection made before it is up is not
  // the one it shows, and a seek before it is up seeks nothing. Selection first,
  // because the panel opens over it. All of it is dropped if the editor is torn down
  // meanwhile.
  const applyEditorState = (dl: DeepLinkState | undefined): void => {
    if (!dl || disposed) return;
    const wantSeek = typeof dl.playhead === 'number' && Number.isFinite(dl.playhead) && !!timeCfg;
    const run = (): void => {
      if (disposed) return;
      if (dl.select?.length) {
        const rows = getBoxes();
        const known = new Set(rows.map((b, i) => idOf(b, i)));
        const ids = dl.select.filter((id) => known.has(id));
        if (ids.length) {
          selection = new Set(ids);
          renderChrome();
          // And through the panel when it is up: its selection adapter is the one it
          // shows, and a camera id - no canvas footprint - only reaches the Camera
          // inspector group via the panel's own selection path.
          timelinePanel?.selectAndReveal(ids);
        }
      }
      if (wantSeek) timelinePanel?.seek(Math.max(0, dl.playhead as number));
      if (dl.panel === 'choreograph' && selection.size) {
        // Anchor the picker just right of the selection, as a click on the More panel's
        // row would - the panel clamps itself into the stage from there.
        const rows = getBoxes();
        const cr = canvasEl.getBoundingClientRect();
        const k = cr.width / Math.max(1, canvasWH().w);
        let right = 0,
          top = Number.POSITIVE_INFINITY;
        for (const i of selIndices(rows)) {
          const r = boxRect(rows[i], cfg);
          right = Math.max(right, r.x + r.w);
          top = Math.min(top, r.y);
        }
        lastMenuAt = {
          x: cr.left + right * k + 16,
          y: cr.top + (Number.isFinite(top) ? top : 0) * k,
        };
        askChoreograph();
      }
    };
    if (wantSeek || timelineAutoOpened) {
      timelineAutoOpened = true;
      void ensureTimeline(true).then(run);
    } else {
      run();
    }
  };
  applyEditorState(opts.deepLink);

  // Universal drop front door (lib/drop-router.ts): a design file dropped on the
  // gallery/dashboard was stashed one-shot and is consumed here on mount, through
  // the exact same lazy parseDesignFile → commit path as the Import panel above.
  const pendingImport = importCfg ? takePendingDesignImport() : null;
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
          if (disposed) return;
          if (n !== 1) {
            const pick = await askImportPages(n);
            if (disposed) return;
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
          const n = await importAsScenes(pendingImport.file, (m: string) => announce(m));
          if (disposed) return;
          announce(n === 1 ? t('Added 1 scene.') : t('Added {n} scenes.', { n }));
          return;
        }
        if (mode === 'artboards') {
          const n = await importAsArtboards(pendingImport.file, (m: string) => announce(m));
          if (disposed) return;
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
        if (disposed) return;
        const boxes = (Array.isArray(res.boxes) ? res.boxes : []) as Box[];
        if (!boxes.length) throw new Error(t('Nothing importable was found in that file.'));
        selection = new Set<string>();
        commit(boxes);
        if (setCanvasSize && res.width > 0 && res.height > 0)
          setCanvasSize(res.width, res.height, 'px');
        announce(
          boxes.length === 1
            ? t('Imported 1 object.')
            : t('Imported {n} objects.', { n: boxes.length })
        );
      } catch (err) {
        if (!disposed)
          announce((err as Error)?.message || t('Import failed.'), { assertive: true });
      }
    })();
  }

  // ══ the Design side-column ports (plans/179 M1-C / M2 / M3) ═══════════════════
  //
  // Everything below is a THIN adapter onto code this file already has. None of it
  // is a second implementation: the columns get the overlay's own selection Set, its own
  // `commit`, its own artboard resolution and its own arrange runners, so a verb pressed
  // in a column and the same verb pressed on the canvas are literally the same code.
  // Nothing here is Design-specific either - a canvas with no frame primitive answers ''
  // and null rather than being handed a port that is absent.

  /**
   * Write one field across the GIVEN ids in one commit. The bar's `setField` writes the
   * SELECTION; a column's row can act on a box it did not select (a layer's lock, a
   * navigator rename), and making that go through the selection would move the user's
   * selection as a side effect of typing in a text field.
   */
  function setFieldOn(ids: readonly string[], field: string, value: unknown): void {
    if (!field || !ids.length) return;
    const want = new Set(ids.map((s) => String(s)));
    const boxes = getBoxes();
    let touched = false;
    const next: Box[] = boxes.map((b, i) => {
      if (!want.has(idOf(b, i))) return b;
      touched = true;
      return { ...b, [field]: value } as Box;
    });
    if (touched) commit(next);
  }

  /** Act on ONE artboard by id through a selection-driven runner, then hand the selection
   *  back. Duplicate and delete both re-point it themselves (at the copy / at nothing),
   *  which is the behaviour a row menu wants, so only the pre-state is staged here. */
  function withFrameSelected(id: string, run: () => void): void {
    if (!id) return;
    const boxes = getBoxes();
    if (indexOfId(boxes, id) < 0) return;
    selection = new Set([id]);
    run();
  }

  /**
   * A new artboard immediately AFTER `id`: placed to its right, at its size, and slotted
   * into the page sequence at its order + 1 with every later page renumbered - so
   * "add after slide 2" makes a slide 3 rather than a slide 9 that x happens to sort
   * third. One commit. Unknown id falls back to `addArtboard`'s append-at-the-end.
   */
  function addArtboardAfter(id: string): void {
    if (!frameCfg?.orderField) {
      addArtboard();
      return;
    }
    const fk = frameCfg.frameKind;
    const frameAddKind = addKinds.find(
      (k) => k.id === 'frame' || (k.seed != null && String(k.seed[cfg.kindField]) === fk)
    );
    if (!frameAddKind) return;
    const boxes0 = getBoxes();
    const at = indexOfId(boxes0, id);
    if (at < 0 || String(boxes0[at]?.[cfg.kindField]) !== fk) {
      addArtboard();
      return;
    }
    const ff = frameFields();
    const seeded = seedFrameOrders(boxes0, ff); // A9: a legacy doc gets its order first
    const src = seeded[at]!;
    const d = canvasWH();
    const w = Math.max(1, num(src[cfg.wField]) || d.w);
    const h = Math.max(1, num(src[cfg.hField]) || d.h);
    const newId = freshId(seeded);
    const box = seedBox(
      cfg,
      {},
      frameAddKind.seed || {},
      {
        x: num(src[cfg.xField]) + w + Math.round(w * 0.08),
        y: num(src[cfg.yField]),
        w,
        h,
      } as MathRect,
      newId
    );
    const seq = framesInPageOrder(seeded, ff).map((b) => String(b[cfg.idField] ?? ''));
    const where = seq.indexOf(String(id));
    seq.splice(where < 0 ? seq.length : where + 1, 0, newId);
    selection = new Set([newId]);
    commit(renumberFrameOrder([...seeded, box], seq, ff));
    renderChrome();
    focusArtboardWhenPainted(newId);
  }

  /** Frame a board once the render has actually put its page in the DOM (the commit only
   *  schedules one), so the focus is not a no-op on a page that does not exist yet. */
  function focusArtboardWhenPainted(id: string): void {
    requestAnimationFrame(() => {
      if (!disposed) focusArtboard(id);
    });
  }

  /**
   * Reorder ONE artboard's children. Array order IS z here (`reorderZ`'s model), so the
   * rewrite keeps every other row where it was and only refills the slots the children
   * already occupy: a layer drag must not move a box between artboards, and it must not
   * disturb the order of anything outside this frame.
   */
  function reorderFrameChildren(frameId: string, orderedIds: readonly string[]): void {
    if (!frameCfg || !frameId) return;
    const ff = frameCfg.frameField,
      fk = frameCfg.frameKind;
    const boxes = getBoxes();
    const slots: number[] = [];
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      if (!b || String(b[cfg.kindField]) === fk) continue;
      if (String(b[ff] ?? '') !== frameId) continue;
      slots.push(i);
    }
    if (slots.length < 2) return;
    const byId = new Map<string, number>();
    for (const i of slots) byId.set(idOf(boxes[i], i), i);
    const seen = new Set<number>();
    const seq: number[] = [];
    for (const id of orderedIds) {
      const i = byId.get(String(id));
      if (i == null || seen.has(i)) continue;
      seen.add(i);
      seq.push(i);
    }
    // A child the caller did not name keeps its own relative order, behind the named
    // ones - a partial list re-stacks what it mentions and loses nothing.
    for (const i of slots) if (!seen.has(i)) seq.push(i);
    if (seq.every((src, k) => src === slots[k])) return; // already in that order
    const next = boxes.slice();
    slots.forEach((dst, k) => {
      next[dst] = boxes[seq[k]!]!;
    });
    commit(next);
  }

  /** The arrange menu's runners, by name (design-inspector's `ARRANGE_OPS`). A switch,
   *  not a translation table: the column speaks this overlay's own op vocabulary. */
  function runArrange(op: string): void {
    switch (op) {
      case 'left':
      case 'hcentre':
      case 'right':
      case 'top':
      case 'vcentre':
      case 'bottom':
        applyAlign(op);
        break;
      case 'h':
      case 'v':
        applyDistribute(op);
        break;
      case 'front':
      case 'forward':
      case 'backward':
      case 'back':
        if (selection.size) applyZ(op);
        break;
      case 'group':
        if (selection.size >= 2) groupSelection();
        break;
      case 'ungroup':
        ungroupSelection();
        break;
      // Not in ARRANGE_OPS today, but the same menu's other two runners - named so a
      // later column row is a string, not a second door into the model.
      case 'clip':
        if (selection.size >= 2) clipSelection();
        break;
      case 'unclip':
        releaseClip();
        break;
      default:
        break;
    }
  }

  /**
   * The inspector's Motion section is a DOOR, not a second editor: it opens the timeline
   * on the box. The panel exposes no public "open this inspector group" method, so the
   * `group` argument is honoured as far as it can be - the timeline opens and reveals the
   * clip, and the group's own disclosure stays the panel's business.
   */
  function openTimelineOn(_group: string, id: string): void {
    void _group;
    openTimeline();
    if (!id) return;
    // The panel may still be a chunk in flight; `selectAndReveal` is only meaningful once
    // it is mounted, so ask on the next frame as well as now.
    const reveal = (): void => {
      try {
        timelinePanel?.selectAndReveal([id]);
      } catch (e) {
        console.error(e);
      }
    };
    reveal();
    requestAnimationFrame(() => {
      if (!disposed) reveal();
    });
  }

  /** `model.cfg`, plus the two tilt field names that live on the CANVAS block rather than
   *  the resolved geometry config (see openMorePanel) - a column asking for `rxField`
   *  must get the same answer the panel does. */
  const portCfg = {
    ...cfg,
    rxField: cv.rxField || undefined,
    ryField: cv.ryField || undefined,
  } as unknown as ModelPort['cfg'];

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
    getBoxes,
    commit,
    setField: (ids, field, value) => setFieldOn(ids, field, value),
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
  };

  const artboardPort: ArtboardPort = {
    active: activeArtboardId,
    focus: focusArtboard,
    onChange: (cb) => {
      artboardListeners.add(cb);
      return () => {
        artboardListeners.delete(cb);
      };
    },
  };

  const navigatorActions: NavigatorActions = {
    duplicateFrame: (id) => withFrameSelected(id, duplicateSelection),
    deleteFrame: (id) => withFrameSelected(id, deleteSelection),
    addArtboardAfter,
    present: (fromFrameId) => actions?.present?.(fromFrameId),
    reorderChildren: reorderFrameChildren,
    makeArtboard: makeArtboardAround,
  };

  const inspectorActions: InspectorActions = {
    pickImage: (ids) => {
      if (!ids.length) return;
      selection = new Set(ids);
      renderChrome();
      const boxes = getBoxes();
      // An audio box's "image" IS its track - the same read the object bar's Set image does.
      const audio = selectionAllKinds(boxes, selIndices(boxes), new Set(['audio']));
      void pickImage(audio ? { pickType: 'audio' } : undefined);
    },
    openGradient: (ids) => {
      if (ids.length) {
        selection = new Set(ids);
        renderChrome();
      }
      toggleGradEdit(ctxbar); // the anchor is unused - the panel re-anchors on the rebuilt button
    },
    arrange: runArrange,
    openTimeline: openTimelineOn,
  };

  const designPorts: DesignCanvasPorts = {
    selection: selectionPort,
    guides: authoringGuides ?? undefined,
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
              void narrateDeck();
            },
            narrateFrame: (id: string) => {
              void narrateDeck(id);
            },
            status: (id: string) => narrationStatusOf(id),
            // Busy counts as not ready: a menu built while a run is in flight greys the
            // row rather than offering a press that can only be refused.
            ready: () => !narrateBusy && framesWithNotes() > 0,
            reason: () =>
              narrateBusy
                ? t('A narration run is already going.')
                : t('No slide has speaker notes yet.'),
          },
        }
      : {}),
    fonts: {
      options: () => fontOptions.map((o) => [o.value, o.label] as [string, string]),
      weights: (font: string) =>
        weightChoicesFor(font).map(([v, l]) => [v, t(l)] as [string, string]),
    },
    fields: input.fields ?? [],
    activeFrameId: activeArtboardId,
    // CLIENT px, like every other rect on this seam - see `queryRect`/`frameClientRect`
    // for why (a frames document's canvas overflows its nominal width, so any
    // native-from-nativeW scale is wrong by the pasteboard ratio).
    activeFrameRect: () => {
      const id = activeArtboardId();
      if (!id) return null;
      const boxes = getBoxes();
      const r = frameClientRect(boxes.find((b, i) => idOf(b, i) === id));
      return r ? { x: r.left, y: r.top, w: r.width, h: r.height } : null;
    },
    contentRect: () => queryRect('content'),
    selectionRect: () => queryRect('selection'),
    openLollyMenu: (anchor) => {
      // Claim the anchor BEFORE the rows are built: four of them open a panel that
      // positions itself under it, and `anchorEl()` is how they find out which control
      // was actually clicked rather than docking to the rail button on the far left.
      if (anchor) setLollyAnchor(anchor);
      const items = lollyMenuItems?.() ?? [];
      if (items.length && anchor) spawnPopover(anchor, items);
    },
    toggleTimeline,
    isTimelineOpen: () => !!timelinePanel?.isOpen(),
    toggleFramesPanel: () => toggleFramesPanel(),
    isFramesPanelOpen,
    setColumnWidths,
    setInspector,
  };

  return {
    design: designPorts,
    destroy() {
      disposed = true;
      // FIRST, so nothing that throws later in this teardown can leave the stage's
      // bottom band reserved for a panel that no longer exists.
      destroyTimeline();
      // …and the same promise for the SIDE bands: a leaked left/right reserve
      // permanently narrows the stage for every other tool mounted in this session.
      setColumnWidths(0, 0);
      finishEdit();
      if (flashTimer) clearTimeout(flashTimer);
      stageEl.removeEventListener('pointerdown', onStageTouchDown, true);
      stageEl.removeEventListener('pointermove', onStageTouchMove, true);
      stageEl.removeEventListener('pointerup', onStageTouchUp, true);
      stageEl.removeEventListener('pointercancel', onStageTouchUp, true);
      canvasEl.removeEventListener('pointerdown', onCanvasPointerDown);
      stageEl.removeEventListener('pointerdown', onBackdropPointerDown);
      viewEl.removeEventListener('pointerdown', onBackdropPointerDown);
      stageEl.removeEventListener('contextmenu', onBackdropContextMenu);
      viewEl.removeEventListener('contextmenu', onBackdropContextMenu);
      window.removeEventListener('keydown', onSpaceKey);
      window.removeEventListener('keyup', onSpaceKey);
      canvasEl.removeEventListener('pointermove', onGestureMove);
      canvasEl.removeEventListener('pointerup', onGestureEnd);
      canvasEl.removeEventListener('pointercancel', onGestureEnd);
      canvasEl.removeEventListener('dblclick', onDblClick);
      canvasEl.removeEventListener('contextmenu', onContextMenu);
      canvasEl.removeEventListener('focusin', onBoxFocus);
      window.removeEventListener('keydown', onKey);
      toolbar.removeEventListener('pointerdown', onRailDown);
      toolbar.removeEventListener('pointermove', onRailMove);
      toolbar.removeEventListener('pointerup', onRailUp);
      toolbar.removeEventListener('pointercancel', onRailUp);
      toolbar.removeEventListener('lostpointercapture', onRailUp);
      wobble.dispose();
      if (railRaf) {
        cancelAnimationFrame(railRaf);
        railRaf = 0;
      }
      document.removeEventListener('paste', onGlobalPaste);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('cut', onCut);
      stageEl.removeEventListener('pointermove', onStagePointerMove);
      stageEl.removeEventListener('wheel', onStageMove);
      stageEl.removeEventListener('transitionend', onStageTransitionEnd);
      canvasEl.removeEventListener('wheel', onCameraWheel as EventListener);
      if (dollyTimer) {
        clearTimeout(dollyTimer);
        dollyTimer = null;
      }
      window.removeEventListener('resize', onStageMove);
      document.removeEventListener('pointerdown', onDocDown, true);
      document.removeEventListener('keydown', onPreviewKey);
      chromeRoot()?.classList.remove('is-chrome-hidden'); // never leave the next mount chromeless
      ro.disconnect();
      mo.disconnect();
      poseMo?.disconnect();
      dirtyObserver?.disconnect();
      unsub?.();
      canvasEl.classList.remove('fc-open-canvas');
      stageEl.classList.remove('fc-penning', 'fc-node-editing');
      // Take the rail back from whichever panel is holding it BEFORE the dock goes: while
      // the navigator has it, the buttons live in that column, and removing an empty dock
      // would leave them behind in a node this handle no longer owns.
      tlWantsRail = navWantsRail = false;
      applyRailMode();
      authoringGuides?.destroy();
      authoringGuides = null;
      overlay.remove();
      toolbarDock.remove();
      closePopover();
      closeMorePanel();
      closeEdgePanel();
      shortcutsModal?.close();
      document.body.classList.remove('fc-manipulating');
    },
    uiState() {
      // The wire field names (docs/url-mode.md `_ui`): what a link to this exact view
      // would carry. Panel detection is the picker's own root class - no second flag
      // to keep in step with askChoreograph's open/close.
      const st: { sel: string[]; t?: number; panel?: string } = { sel: [...selection] };
      if (timelinePanel?.isOpen()) st.t = timelinePanel.time();
      if (document.querySelector('.fc-choreo-panel')) st.panel = 'choreograph';
      return st;
    },
    applyUi(state: DeepLinkState) {
      applyEditorState(state);
    },
  };
}
