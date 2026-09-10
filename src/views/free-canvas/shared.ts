// SPDX-License-Identifier: MPL-2.0
/**
 * Module-level declarations of free-canvas.ts that its feature modules use: the types,
 * constants and pure helpers that used to sit above initFreeCanvas(). Moved here verbatim so
 * no feature module has to import the orchestrator file. The design tool (free canvas) view.
 */
import type { Box } from '../free-canvas-math.ts';
import type { DesignChromeOpts } from '../design-ports.ts';
import type { SplineKind, SplineNode } from '@lolly/engine';

// ── local types ───────────────────────────────────────────────────────────────
// `Box` (a flat per-tool record, field names configured via cfg.*Field) is imported from
// free-canvas-math.ts so the overlay and the pure geometry share one honest type
// (`{ [key: string]: InputValue | undefined }`).
export interface Point {
  x: number;
  y: number;
}
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  rot?: number;
}
export interface AABB {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  w?: number;
  h?: number;
}
export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}
export interface Canvas {
  w: number;
  h: number;
}
export interface Metrics {
  cr: DOMRect;
  sr: DOMRect;
  scale: number;
}
export type HandleName = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
export type Corner = 'nw' | 'ne' | 'se' | 'sw';

/** One entry of a `canvas.addKinds` list - a "kind" the add-box menu can create. */
export interface AddKind {
  id: string;
  label?: string;
  seed?: Box;
}

/** The subset of a blocks-field declaration the editor reads: the font select's
 *  declared options drive the typography menus, so the editor writes exactly the
 *  wire values the tool's hooks.js understands (e.g. 'SUSE'/'SUSE Mono' on the
 *  SUSE profile, 'sans'/'mono' on lolly-start). */
export interface BlockFieldDef {
  id: string;
  default?: unknown;
  options?: Array<{ value?: unknown; label?: string }>;
}
export interface FontOption {
  value: string;
  label: string;
}

/** The free-form per-tool `canvas` schema block (from the manifest). */
export interface CanvasCfg {
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
   *  by the speech-to-text panel; a tool without it never offers strikethrough. */
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
export type EditorMode = 'select' | 'create' | 'pen' | 'line';

/** `canvas.connect` - how the editor authors + stores connector edges. */
export interface ConnectCfg {
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
export interface FieldCfg {
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

export interface ModelItem {
  id: string;
  value: any;
}
export interface RuntimeApi {
  getModel(): ModelItem[];
  setInput(id: string, value: any): void;
  subscribe(fn: () => void): (() => void) | undefined;
}
export interface HostApi {
  assets?: { pick(opts: any): Promise<any> };
  /** Feature-detected (plan 96): the engine's dash-fit primitives, once the running
   *  engine carries them. `parse` is the AUTHORITY on what the Dash array field accepts,
   *  so the panel prefers it and falls back to free-canvas-math's own `parseDashArray`
   *  (the same contract) on an engine that predates it. */
  connectors?: { dashFit?: { parse?(text: string): number[] | null } };
}
export interface DocInfo {
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
export interface HistoryApi {
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

export interface InitFreeCanvasOpts {
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
   *  centre ends up in, on drop. Absent for tools whose canvas declares no `frameField`,
   *  so every frame-aware path below is dead for them (no-frames byte-identity). */
  frame?: FrameCfg;
}

export interface PagesCfg {
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
export interface FrameCfg {
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
export interface ToolbarActions {
  export(): void;
  save(): void;
  copy(): void;
  share(): void;
  /** Open the frames as a fullscreen deck (plan 112); absent = not a frame tool. The
   *  optional id starts the deck ON that artboard (plans/179 M2's "Present from here"). */
  present?(atFrameId?: string): void;
  newFromTemplate?(): void; // re-open the Start template chooser mid-session (plans/142 WP-1); absent = the tool has no templates, shipped or the person's own (plans/226 WP-1)
  bulk?(): void; // hand this template to /batch (plans/147 M1); absent = the batch can't run this tool
  canSave?: boolean; // omit the Save icon for tools that don't persist a session
  dirtyRef?: HTMLElement | null; // element whose `is-unsaved` class the Save icon mirrors
}

export interface EditingState {
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

export interface FmtRefs {
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
export type FmtBar = HTMLDivElement & { _refs?: FmtRefs };

// Popover item shapes (separator / icon-grid / action row).
export interface PopGridItem {
  label: string;
  icon?: string;
  run(): void;
  disabled?: boolean;
  danger?: boolean;
  keepOpen?: boolean;
}
export interface PopSep {
  sep: true;
  grid?: undefined;
}
export interface PopGrid {
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
export interface PopAction {
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
export type PopItem = PopSep | PopGrid | PopAction;

// Gesture state - filled in by beginGesture with pointerId/startClient.
export interface GestureBase {
  pointerId: number;
  startClient: Point;
  origin?: Point;
}
export interface TapGesture extends GestureBase {
  type: 'tap';
}
export interface MarqueeGesture extends GestureBase {
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
export interface CamPanGesture extends GestureBase {
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
export interface CamTiltGesture extends GestureBase {
  type: 'camtilt';
  client: Point;
  dx: number;
  dy: number;
}
export interface CreateGesture extends GestureBase {
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
export interface LineGesture extends GestureBase {
  type: 'line';
  origin: Point;
  to?: Point;
}
// `narrow` is plan 179 C4: a plain click on a member of a multi-selection means "just this
// one", but the very same press also starts the drag of the WHOLE selection - so the answer
// cannot be given until the pointer comes up without having moved. The ids under the click
// ride along until then; a real drag drops them untouched.
export interface MoveGesture extends GestureBase {
  type: 'move';
  start: Map<number, Rect>;
  sel: number[];
  selAABB: AABB | null;
  others: AABB[];
  moveDelta?: { dx: number; dy: number };
  narrow?: string[];
}
export interface ResizeGesture extends GestureBase {
  type: 'resize';
  index: number;
  handle: HandleName;
  startRect: Rect;
  others: AABB[];
  liveRect?: Rect;
}
export interface RotateGesture extends GestureBase {
  type: 'rotate';
  index: number;
  startRect: Rect;
  centerClient: Point;
  pointerStartDeg: number;
  liveRect?: Rect;
}
export interface GScaleGesture extends GestureBase {
  type: 'gscale';
  sel: number[];
  startBoxes: Box[];
  anchor: Point;
  origDist: number;
  liveBoxes?: Box[];
}
export interface GRotateGesture extends GestureBase {
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
export interface PenDrawGesture extends GestureBase {
  type: 'pendraw';
  origin: Point;
  index: number;
}
export interface PenNodeGesture extends GestureBase {
  type: 'pennode';
  origin: Point;
  indices: number[];
  start: SplineNode[];
  moved?: boolean;
  /** plan 96 P3 - which END of the path is being dragged, when exactly one END node is.
   *  Set at press; drives the bind affordance during the drag and the write on drop. */
  bindEnd?: 'start' | 'end';
}
export interface PenHandleGesture extends GestureBase {
  type: 'penhandle';
  origin: Point;
  index: number;
  which: 'in' | 'out';
  moved?: boolean;
}
export interface PenMarqueeGesture extends GestureBase {
  type: 'penmarquee';
  origin: Point;
  additive: boolean;
}
/** One contour's slice of the combined node-edit path: how many nodes it owns, and the
 *  kind + closed flag to restore when the flat run is split back into real contours. */
export interface PenPart {
  count: number;
  kind: SplineKind;
  closed: boolean;
}
export type Gesture =
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
export type FilledBaseFields = 'pointerId' | 'startClient';
export type GestureInit =
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

export const HANDLES: HandleName[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
export const SNAP_PX = 6;

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

// ── the contextual bar's position ─────────────────────────────────────────────

/** A stage-relative box, in stage px. */
export interface StageBox {
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
 * The free horizontal band on the top-chrome row where the contextual bar is placed.
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
export let railSession: { left: number; top: number } | null = null;

// Weight menu (shared by the Text panel and the in-edit format bar). Mono cuts
// rarely ship a Black - their variable axes top out at 800 - so the mono menu
// stops at Extrabold (both profiles' hooks.js + the vector exporter cap it the
// same way; mono detection lives in isMonoFont inside initFreeCanvas).
export const WEIGHT_CHOICES: Array<[string, string]> = [
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
// Live-preview font stacks - kept byte-for-byte in step with the shipped
// design hooks.js FONTS maps (SUSE profile: 'SUSE'/'SUSE Mono';
// lolly-start: 'sans'/'mono') so the in-edit preview matches the committed
// render and the vector export exactly. Wire values not listed here derive a
// stack from the value itself (fontStackFor inside initFreeCanvas).
export const FONT_STACK: Record<string, string> = {
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
export const HEAD_CHOICES: Array<[string, string]> = [
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
export const ROUTE_CHOICES: Array<[string, string]> = [
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
export function dashRowOn(styleVal: string, arrVal: string): boolean {
  return styleVal === 'dashed' || styleVal === 'dotted' || String(arrVal).trim() !== '';
}
// ligatures default ON (off → disable liga/clig); alternates default OFF (on → salt).
export function featureSettings(ligOn: boolean, altOn: boolean): string {
  const feat: string[] = [];
  if (!ligOn) feat.push('"liga" 0', '"clig" 0');
  if (altOn) feat.push('"salt" 1');
  return feat.join(', '); // '' = browser default (ligatures on, no alternates)
}
// A short, unambiguous marker for layout objects copied INSIDE the editor. The
// serialized boxes ride the OS clipboard behind it, so ⌘V pastes (duplicates)
// them - even across a reload - while ordinary copied text still ends up as a new
// text box. Kept in-memory too, in case a browser blocks the clipboard read.
export const FC_CLIP_PREFIX = 'lolly/layout-boxes:';
// Coerce a manifest/model boolean (real boolean or "true"/"1"/"on" string) - mirrors
// hooks.js boolVal so the editor previews match the render.
export function boolOf(v: any, dflt: boolean): boolean {
  if (v === true || v === false) return v;
  if (v == null || v === '') return dflt;
  const s = String(v).toLowerCase();
  if (s === 'true' || s === '1' || s === 'yes' || s === 'on') return true;
  if (s === 'false' || s === '0' || s === 'no' || s === 'off') return false;
  return dflt;
}
// Flex mappings for the align/valign live preview - must mirror hooks.js boxCss.
export const H_JUSTIFY: Record<string, string> = {
  left: 'flex-start',
  center: 'center',
  right: 'flex-end',
};
export const V_ALIGN: Record<string, string> = { top: 'flex-start', middle: 'center', bottom: 'flex-end' };
export type ImportMode = 'board' | 'artboards' | 'scenes';

// ── onion skin: the ghost layer, lazily mounted, never in an export ──────────
// The whole feature is off unless the panel says otherwise, so the module, its
// stylesheet and every DOM node it makes cost exactly nothing to an editor that never
// turns it on. The layer itself lives inside `overlay` - a stage SIBLING of
// #tool-canvas carrying [data-export-hide] - so no export path can reach it; see
// onion-skin.ts's module doc for the three independent guarantees.
export interface OnionTimeDetail {
  playing?: unknown;
  mode?: unknown;
  past?: unknown;
  future?: unknown;
  opacity?: unknown;
  activeIds?: unknown;
}

// ── one-number prompt ─────────────────────────────────────────────────────────
// A couple of menu actions need a number before they can run. There is no prompt() in
// this app and no dialog light enough for a menu item, so this is the same `fc-panel`
// recipe the size and dimensions panels already use - a labelled number field
// committed by Enter or by the button - positioned at the point the menu was opened
// from. It rides `morePanel`, so an outside click or Escape dismisses it like the rest.
export interface NumberAsk {
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

// ── are-you-sure ──────────────────────────────────────────────────────────────
// One action in this overlay destroys authored work rather than moving it: switching a
// path's spline kind to one that solves its own handles. There is no confirm dialog here
// and a modal would be far too much furniture for a control on the object bar, so this is
// the SAME `fc-panel` recipe as askNumber - a titled panel with a sentence and one
// primary button - riding `morePanel`, so an outside click or Escape dismisses it and
// that dismissal means "no".
export interface ConfirmAsk {
  at: Point;
  title: string;
  hint: string;
  confirm: string;
  apply(): void;
  cancel?(): void;
}

/** What this file needs from an engine `SvgLayer` - structural, so no runtime import. */
export interface SvgLayerPlan {
  markup: string;
  nodes: number;
  boxId?: string;
  /** The crop the engine cropped this layer's document to (section P3.2), in source user units. */
  viewBox?: { x: number; y: number; w: number; h: number };
  /** The layer's measured ink extent - what decides which rows are peers. */
  bbox?: { x: number; y: number; w: number; h: number } | null;
}
/** The source document's own viewBox - the denominator for those crops. */
export type SvgSourceBox = { x: number; y: number; w: number; h: number } | null;

export interface RunVectorOpts {
  /** simplifyBoxes returns one box PER OPERAND, each of which keeps its own place in
   *  the stack - so the result is applied operand by operand instead of as one swap. */
  each?: boolean;
  /** Mention boxes the operation left alone (text/image have no outline). */
  skipNote?: boolean;
  /** Override the `empty-result` sentence for this operation. */
  empty?: string;
} // SCREEN px, per finger
export interface TouchPt {
  x: number;
  y: number;
  moved: number;
}
/** railSession is an ES module binding now: importers read it live and write it through here. */
export function setRailSession(value: { left: number; top: number } | null): void { railSession = value; }

