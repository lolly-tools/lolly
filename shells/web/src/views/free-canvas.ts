// free-canvas.ts — the WYSIWYG direct-manipulation overlay for render.layout:'editor'.
//
// This is the ONLY DOM in the free-canvas feature; all geometry lives in the pure,
// unit-tested free-canvas-math.ts. It mounts:
//   • a left toolbar (add / arrange / align / canvas background),
//   • a selection overlay (rotated outlines + 8 resize handles + a rotate handle),
//   • a contextual bar (fill / text controls / duplicate / delete + a transform readout),
// all as SIBLINGS of #tool-canvas inside #tool-stage — so they live OUTSIDE the
// exported node (runtime.export is handed #tool-canvas) and never leak into output.
// They also carry [data-export-hide] as a backstop.
//
// The overlay reads box geometry from the MODEL (runtime.getModel) and maps native
// canvas pixels ↔ screen via the live canvasEl rect (transform-agnostic: composes
// fitCanvas's scale AND stageNav's pan/zoom automatically). Edits mutate the box DOM
// directly for smooth feedback during a gesture and commit ONE runtime.setInput on
// release — which the shell's undo wrapper coalesces into a single history step.
//
// Opt-in and progressive: without this overlay the same flat `boxes` array renders
// identically headless (CLI/URL). The engine and URL never see the editor.

import type { AssetRef, InputSpec, InputValue, Runtime } from '@lolly/engine';
import type {
  AABB, Box, BoxFieldConfig, Canvas, Guide, HandleName, MarqueeRect, Point, Rect,
  AlignEdge, Axis, ZOp,
} from './free-canvas-math.ts';
import {
  boxRect, withRect, boxCorners, rectCentre, hitTest, marqueeHit, boxAABB,
  moveBoxes, resizeRect, alignBoxes, distributeBoxes, reorderZ,
  seedBox, normDragRect, snapAngle, normAngle, clampBoxToCanvas, selectionAABB,
  snapMove, snapPoint, scaleGroup, rotateGroup,
} from './free-canvas-math.ts';
import type { ColorFieldValue } from '../components/color-field.ts';
import { colorFieldHtml, wireColorField } from '../components/color-field.ts';

const HANDLES: HandleName[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const SNAP_PX = 6;          // snap threshold in SCREEN px
const SVG = {
  add: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  front: '<rect x="7" y="3" width="11" height="11" rx="1.5"/><path d="M14 17v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h2"/>',
  align: '<line x1="3" y1="4" x2="3" y2="20"/><rect x="6" y="7" width="12" height="4" rx="1"/><rect x="6" y="14" width="7" height="4" rx="1"/>',
  dup: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
  more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  size: '<path d="M9 3H5a2 2 0 0 0-2 2v4"/><path d="M15 3h4a2 2 0 0 1 2 2v4"/><path d="M15 21h4a2 2 0 0 0 2-2v-4"/><path d="M9 21H5a2 2 0 0 1-2-2v-4"/>',
};

function icon(paths: string): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

// ── opts / config shapes ──────────────────────────────────────────────────────

/** One entry of a `canvas.addKinds` list — a "kind" the add-box menu can create. */
export interface AddKind {
  id: string;
  label?: string;
  seed?: Box;
}

/**
 * The shape of an input's `canvas` flag (schema-declared, from the manifest).
 * Untyped at the engine level (`Record<string, unknown>`) since it's a free-form
 * per-tool schema block; this is the shape free-canvas actually reads from it.
 */
interface CanvasSchemaConfig {
  idField?: string;
  xField?: string; yField?: string; wField?: string; hField?: string;
  rotationField?: string;
  fillField?: string; opacityField?: string; shapeField?: string;
  radiusField?: string; imageField?: string; fitField?: string;
  blendField?: string; textField?: string; textColorField?: string;
  fontSizeField?: string; alignField?: string; valignField?: string;
  weightField?: string; groupField?: string; clipField?: string;
  minSize?: number;
  addKinds?: AddKind[];
}

/** The resolved field-name config this module drives the DOM/model with. */
interface FreeCanvasFieldConfig extends BoxFieldConfig {
  fillField?: string; opacityField?: string; shapeField?: string;
  radiusField?: string; imageField?: string; fitField?: string;
  blendField?: string; textField?: string; textColorField?: string;
  fontSizeField?: string; alignField?: string; valignField?: string;
  weightField?: string; groupField?: string; clipField?: string;
  kindField: string;
}

/** The slice of the runtime this module drives — the real Runtime satisfies it. */
type FreeCanvasRuntime = Pick<Runtime, 'getModel' | 'setInput' | 'subscribe'>;

/** Options accepted by {@link AssetPickOpts.editTool} results and asset picking. */
interface AssetPickOpts {
  title?: string;
  type?: 'vector' | 'raster' | 'video' | 'palette' | 'font';
  allowUpload?: boolean;
  current?: string;
  /** Choosing a Lolly link or a saved creation opens its inputs first so the
   *  user can set values (configure → insert), reusing the sidebar's editor. */
  editTool?(toolUrl: string): Promise<AssetRef | null>;
}

/** The slice of the host bridge this module drives — only the asset picker. */
interface FreeCanvasHost {
  assets?: {
    pick(opts: AssetPickOpts): Promise<AssetRef | null>;
  };
}

export interface InitFreeCanvasOpts {
  viewEl: HTMLElement;
  stageEl: HTMLElement;
  canvasEl: HTMLElement;
  /** Handed through by the caller; not read by this module. */
  outerEl?: HTMLElement | null;
  runtime: FreeCanvasRuntime;
  host: FreeCanvasHost;
  /** The `blocks` input spec that carries the `canvas` flag (from the manifest). */
  input: InputSpec;
  nativeW: number;
  nativeH: number;
  onDirty?(id: string): void;
  editTool(toolUrl: string): Promise<AssetRef | null>;
  setCanvasSize?(w: number, h: number): void;
}

export interface FreeCanvasHandle {
  destroy(): void;
}

// ── gesture state ─────────────────────────────────────────────────────────────

interface GestureBase {
  pointerId: number;
  startClient: Point;
  /** Present for marquee/create gestures; other gesture types derive their
   *  delta from `startClient` instead (see onGestureMove). */
  origin?: Point;
}
interface TapGesture extends GestureBase { type: 'tap' }
interface MarqueeGesture extends GestureBase { type: 'marquee'; origin: Point; additive: boolean }
interface CreateGesture extends GestureBase {
  type: 'create'; origin: Point; seed: Box; others: AABB[]; corner?: Point;
}
interface MoveGesture extends GestureBase {
  type: 'move'; start: Map<number, Rect>; sel: number[]; selAABB: AABB | null; others: AABB[];
  moveDelta?: { dx: number; dy: number };
}
interface ResizeGesture extends GestureBase {
  type: 'resize'; index: number; handle: HandleName; startRect: Rect; others: AABB[]; liveRect?: Rect;
}
interface RotateGesture extends GestureBase {
  type: 'rotate'; index: number; startRect: Rect; centerClient: Point; pointerStartDeg: number; liveRect?: Rect;
}
interface GScaleGesture extends GestureBase {
  type: 'gscale'; sel: number[]; startBoxes: Box[]; anchor: Point; origDist: number; liveBoxes?: Box[];
}
interface GRotateGesture extends GestureBase {
  type: 'grotate'; sel: number[]; startBoxes: Box[]; centre: Point; centerClient: Point; pointerStartDeg: number;
  liveBoxes?: Box[];
}
type Gesture =
  | TapGesture | MarqueeGesture | CreateGesture | MoveGesture
  | ResizeGesture | RotateGesture | GScaleGesture | GRotateGesture;
// Only `pointerId`/`startClient` are filled in by beginGesture itself; `origin`
// is caller-supplied on the gesture variants that declare it (create/marquee),
// so it must NOT be stripped here the way the shared base fields are.
type FilledBaseFields = 'pointerId' | 'startClient';

/** What callers pass to {@link beginGesture} — everything but the base fields it fills in. */
type GestureInit =
  | Omit<TapGesture, FilledBaseFields>
  | Omit<MarqueeGesture, FilledBaseFields>
  | Omit<CreateGesture, FilledBaseFields>
  | Omit<MoveGesture, FilledBaseFields>
  | Omit<ResizeGesture, FilledBaseFields>
  | Omit<RotateGesture, FilledBaseFields>
  | Omit<GScaleGesture, FilledBaseFields>
  | Omit<GRotateGesture, FilledBaseFields>;

/** Metrics for mapping between native canvas px and stage (screen) px. */
interface Metrics { cr: DOMRect; sr: DOMRect; scale: number }

/** Editing state while a box's text is being edited inline. */
interface EditingState { id: string; el: HTMLElement; prev: string | null }

/** A popover separator row. */
interface PopSep { sep: true }
/** A popover action row. */
interface PopAction {
  sep?: undefined;
  label: string;
  icon?: string;
  run(): void;
  disabled?: boolean;
  danger?: boolean;
  keepOpen?: boolean;
}
type PopItem = PopSep | PopAction;

/** Bounding box shape used by the group-handle helpers (no w/h, unlike AABB). */
interface Bounds { minX: number; minY: number; maxX: number; maxY: number }

export function initFreeCanvas(opts: InitFreeCanvasOpts): FreeCanvasHandle {
  const { viewEl, stageEl, canvasEl, runtime, host, input, nativeW, nativeH, onDirty, editTool, setCanvasSize } = opts;
  // The artboard is resizable, so read its CURRENT declared size (not the mount-time
  // nativeW/H) everywhere geometry depends on the canvas dimensions.
  const canvasWH = (): Canvas => ({
    w: parseInt(canvasEl.style.width, 10) || nativeW,
    h: parseInt(canvasEl.style.height, 10) || nativeH,
  });
  // The `canvas` schema block is a free-form per-tool config the shell doesn't
  // validate beyond "is this a blocks input with `canvas` set" (tool/index.ts) —
  // trust boundary: cast to the shape this module actually reads, defensively
  // defaulting every field below.
  const cv = (input.canvas ?? {}) as CanvasSchemaConfig;
  const blockId = input.id;
  const cfg: FreeCanvasFieldConfig = {
    idField: cv.idField || 'id',
    xField: cv.xField || 'x', yField: cv.yField || 'y',
    wField: cv.wField || 'w', hField: cv.hField || 'h',
    rotationField: cv.rotationField || 'rot',
    fillField: cv.fillField, opacityField: cv.opacityField, shapeField: cv.shapeField,
    radiusField: cv.radiusField, imageField: cv.imageField, fitField: cv.fitField,
    blendField: cv.blendField, textField: cv.textField, textColorField: cv.textColorField,
    fontSizeField: cv.fontSizeField, alignField: cv.alignField, valignField: cv.valignField,
    weightField: cv.weightField, groupField: cv.groupField, clipField: cv.clipField,
    kindField: 'kind',
  };
  const unwrapColor = (v: ColorFieldValue): string => (typeof v === 'object' && v !== null && 'value' in v ? v.value : v);
  const minSize = cv.minSize ?? 8;
  const addKinds: AddKind[] = Array.isArray(cv.addKinds) && cv.addKinds.length
    ? cv.addKinds : [{ id: 'box', label: 'Box', seed: {} }];

  // ── state ──────────────────────────────────────────────────────────────────
  let selection = new Set<string>();          // box ids
  let armedKind: AddKind | null = null;       // seed for the add-box create gesture
  let gesture: Gesture | null = null;         // active pointer gesture
  let editing: EditingState | null = null;    // { id, el, prev } while editing a box's text inline
  let disposed = false;

  // ── model access ─────────────────────────────────────────────────────────
  const getBoxes = (): Box[] => {
    const e = runtime.getModel().find((i) => i.id === blockId);
    // The canvas-flagged blocks input's value is an array of flat Box records
    // by manifest contract (see free-canvas-math.ts header); InputValue's own
    // type is wider (it also allows non-record array elements), so this cast
    // narrows to what this module actually assumes everywhere else.
    return Array.isArray(e?.value) ? (e.value as Box[]) : [];
  };
  const bgInputId = 'background';
  const getBg = (): InputValue => runtime.getModel().find((i) => i.id === bgInputId)?.value ?? '#ffffff';

  const idOf = (b: Box | undefined, i: number): string =>
    (b && b[cfg.idField] != null && b[cfg.idField] !== '' ? String(b[cfg.idField]) : String(i));
  const selIndices = (boxes: Box[]): number[] =>
    boxes.reduce<number[]>((a, b, i) => (selection.has(idOf(b, i)) ? (a.push(i), a) : a), []);
  const indexOfId = (boxes: Box[], id: string): number => boxes.findIndex((b, i) => idOf(b, i) === id);
  const groupOf = (b: Box | undefined): string => (cfg.groupField && b && b[cfg.groupField] ? String(b[cfg.groupField]) : '');
  const groupMemberIds = (boxes: Box[], g: string): string[] =>
    boxes.reduce<string[]>((a, b, i) => (groupOf(b) === g ? (a.push(idOf(b, i)), a) : a), []);
  // The ids selected when box `i` is clicked: its whole group (if any), unless
  // `soloBox` (Alt-click) drills in to just that one box.
  function selectionForHit(boxes: Box[], i: number, soloBox: boolean): string[] {
    const g = groupOf(boxes[i]);
    return (soloBox || !g) ? [idOf(boxes[i], i)] : groupMemberIds(boxes, g);
  }

  let idSeq = 0;
  function freshId(boxes: Box[]): string {
    // Short, collision-checked id (Math.random is fine in the browser shell).
    const used = new Set(boxes.map((b, i) => idOf(b, i)));
    let id: string;
    do { id = 'b' + (Date.now().toString(36).slice(-4)) + (idSeq++).toString(36) + Math.floor(Math.random() * 46656).toString(36); }
    while (used.has(id));
    return id;
  }

  function commit(nextBoxes: Box[]): void {
    onDirty?.(blockId);
    runtime.setInput(blockId, nextBoxes);
  }

  // ── coordinate mapping (transform-agnostic via the live canvas rect) ────────
  function metrics(): Metrics {
    const cr = canvasEl.getBoundingClientRect();
    const sr = stageEl.getBoundingClientRect();
    const scale = cr.width / canvasWH().w || 1;
    return { cr, sr, scale };
  }
  const clientToNative = (cx: number, cy: number): Point => {
    const { cr, scale } = metrics();
    return { x: (cx - cr.left) / scale, y: (cy - cr.top) / scale };
  };
  const nativeToStage = (nx: number, ny: number, m: Metrics = metrics()): Point => ({
    x: m.cr.left - m.sr.left + nx * m.scale,
    y: m.cr.top - m.sr.top + ny * m.scale,
  });

  // ── DOM: overlay + toolbar ──────────────────────────────────────────────────
  const overlay = document.createElement('div');
  overlay.className = 'fc-overlay';
  overlay.setAttribute('data-export-hide', '');
  stageEl.appendChild(overlay);

  const rubber = document.createElement('div');
  rubber.className = 'fc-rubber';
  rubber.hidden = true;
  overlay.appendChild(rubber);

  const guidesEl = document.createElement('div'); // snap/alignment guide lines
  guidesEl.className = 'fc-guides';
  overlay.appendChild(guidesEl);

  const chrome = document.createElement('div');   // selection outlines + handles
  chrome.className = 'fc-chrome';
  overlay.appendChild(chrome);

  const ctxbar = document.createElement('div');    // contextual controls
  ctxbar.className = 'fc-ctxbar';
  ctxbar.hidden = true;
  ctxbar.addEventListener('pointerdown', (e) => e.stopPropagation());
  overlay.appendChild(ctxbar);
  let ctxSelKey: string | null = null;   // sorted selected-id signature; rebuild ctxbar when it changes

  // Dock wrapper flex-centres the rail without a transform on the rail itself
  // (a transform/backdrop-filter there would capture its colour popover's fixed
  // positioning — see the .fc-toolbar-dock CSS note).
  const toolbarDock = document.createElement('div');
  toolbarDock.className = 'fc-toolbar-dock';
  toolbarDock.setAttribute('data-export-hide', '');
  const toolbar = document.createElement('div');
  toolbar.className = 'fc-toolbar';
  toolbar.setAttribute('role', 'toolbar');
  toolbar.setAttribute('aria-label', 'Editor tools');
  toolbarDock.appendChild(toolbar);
  stageEl.appendChild(toolbarDock);
  buildToolbar();

  // ── toolbar ─────────────────────────────────────────────────────────────────
  let popover: HTMLDivElement | null = null;
  function closePopover(): void { popover?.remove(); popover = null; }

  function toolBtn(label: string, svg: string, onClick: (b: HTMLButtonElement, e: MouseEvent) => void, extraClass = ''): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'fc-btn ' + extraClass;
    b.title = label;
    b.setAttribute('aria-label', label);
    b.innerHTML = icon(svg);
    b.addEventListener('click', (e) => { e.stopPropagation(); onClick(b, e); });
    b.addEventListener('pointerdown', (e) => e.stopPropagation());
    toolbar.appendChild(b);
    return b;
  }

  function buildToolbar(): void {
    const add = toolBtn('Add a box', SVG.add, () => openAddMenu(add), 'fc-btn-add');
    if (armedKind) add.classList.add('is-armed');
    toolBtn('Arrange (stacking order)', SVG.front, () => openArrangeMenu());
    toolBtn('Align & distribute', SVG.align, () => openAlignMenu());
    if (setCanvasSize) toolBtn('Canvas size', SVG.size, (b) => openSizeMenu(b));
    const sep = document.createElement('div'); sep.className = 'fc-sep'; toolbar.appendChild(sep);
    // Canvas background — the app's shared colour picker (swatches + hex + alpha).
    const bgWrap = document.createElement('div');
    bgWrap.className = 'fc-btn fc-color-btn';
    bgWrap.title = 'Canvas background';
    bgWrap.innerHTML = colorFieldHtml('fc-bg', getBg(), { float: true });
    bgWrap.addEventListener('pointerdown', (e) => e.stopPropagation());
    toolbar.appendChild(bgWrap);
    wireColorField(bgWrap, {
      onChange: (_id, val) => { onDirty?.(bgInputId); runtime.setInput(bgInputId, unwrapColor(val)); },
    });
  }

  function fillPopover(el: HTMLElement, items: PopItem[]): void {
    for (const it of items) {
      if (it.sep) { const s = document.createElement('div'); s.className = 'fc-pop-sep'; el.appendChild(s); continue; }
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'fc-pop-item' + (it.danger ? ' fc-pop-danger' : '');
      b.disabled = it.disabled === true;
      b.innerHTML = (it.icon ? `<span class="fc-pop-ic">${it.icon}</span>` : '') + `<span>${it.label}</span>`;
      b.addEventListener('click', (e) => { e.stopPropagation(); if (b.disabled) return; it.run(); if (!it.keepOpen) closePopover(); });
      el.appendChild(b);
    }
  }
  function spawnPopover(anchor: HTMLElement, items: PopItem[]): void {
    closePopover();
    popover = document.createElement('div');
    popover.className = 'fc-popover';
    fillPopover(popover, items);
    popover.addEventListener('pointerdown', (e) => e.stopPropagation());
    stageEl.appendChild(popover);
    const ar = anchor.getBoundingClientRect();
    const sr = stageEl.getBoundingClientRect();
    popover.style.left = (ar.right - sr.left + 8) + 'px';
    popover.style.top = Math.max(6, ar.top - sr.top) + 'px';
  }
  // Right-click context menu at the cursor (desktop): a consolidated list of the
  // arrange / align / group / clip / edit actions.
  function openContextMenu(clientX: number, clientY: number): void {
    closePopover();
    const has = selection.size > 0;
    const multi = selection.size >= 2;
    const items: PopItem[] = [
      { label: 'Duplicate', run: () => duplicateSelection(), disabled: !has },
      { label: 'Delete', run: () => deleteSelection(), disabled: !has, danger: true },
      { sep: true },
      { label: 'Bring to front', run: () => applyZ('front'), disabled: !has },
      { label: 'Bring forward', run: () => applyZ('forward'), disabled: !has },
      { label: 'Send backward', run: () => applyZ('backward'), disabled: !has },
      { label: 'Send to back', run: () => applyZ('back'), disabled: !has },
      { sep: true },
      { label: 'Align left', run: () => applyAlign('left'), disabled: !has },
      { label: 'Align centre', run: () => applyAlign('hcentre'), disabled: !has },
      { label: 'Align right', run: () => applyAlign('right'), disabled: !has },
      { label: 'Align top', run: () => applyAlign('top'), disabled: !has },
      { label: 'Align middle', run: () => applyAlign('vcentre'), disabled: !has },
      { label: 'Align bottom', run: () => applyAlign('bottom'), disabled: !has },
      { label: 'Distribute horizontally', run: () => applyDistribute('h'), disabled: selection.size < 3 },
      { label: 'Distribute vertically', run: () => applyDistribute('v'), disabled: selection.size < 3 },
      { sep: true },
      { label: 'Group', run: () => groupSelection(), disabled: !multi },
      { label: 'Ungroup', run: () => ungroupSelection(), disabled: !selHasGroup() },
      { label: 'Clip to bottom shape', run: () => clipSelection(), disabled: !multi },
      { label: 'Release clip', run: () => releaseClip(), disabled: !selHasClip() },
    ];
    popover = document.createElement('div');
    popover.className = 'fc-popover fc-context-menu';
    fillPopover(popover, items);
    popover.addEventListener('pointerdown', (e) => e.stopPropagation());
    stageEl.appendChild(popover);
    const sr = stageEl.getBoundingClientRect();
    const left = Math.max(6, Math.min(clientX - sr.left, sr.width - popover.offsetWidth - 6));
    const top = Math.max(6, Math.min(clientY - sr.top, sr.height - popover.offsetHeight - 6));
    popover.style.left = left + 'px';
    popover.style.top = top + 'px';
  }
  function onContextMenu(e: MouseEvent): void {
    e.preventDefault();
    if (editing) commitTextEdit();
    const nat = clientToNative(e.clientX, e.clientY);
    const boxes = getBoxes();
    const hit = hitTest(boxes, nat.x, nat.y, cfg);
    if (hit >= 0 && !selection.has(idOf(boxes[hit], hit))) {
      selection = new Set(selectionForHit(boxes, hit, e.altKey));
      renderChrome();
    }
    openContextMenu(e.clientX, e.clientY);
  }

  function openAddMenu(anchor: HTMLElement): void {
    spawnPopover(anchor, addKinds.map((k): PopItem => ({
      label: k.label || k.id,
      icon: icon(k.id === 'image' ? SVG.image : SVG.add),
      run: () => armCreate(k),
    })));
  }
  function openArrangeMenu(): void {
    const has = selection.size > 0;
    const multi = selection.size >= 2;
    const anchor = toolbar.children[1];
    if (!(anchor instanceof HTMLElement)) return;
    spawnPopover(anchor, [
      { label: 'Bring to front', run: () => { if (has) applyZ('front'); } },
      { label: 'Bring forward', run: () => { if (has) applyZ('forward'); } },
      { label: 'Send backward', run: () => { if (has) applyZ('backward'); } },
      { label: 'Send to back', run: () => { if (has) applyZ('back'); } },
      { sep: true },
      { label: 'Group', run: () => { if (multi) groupSelection(); } },
      { label: 'Ungroup', run: () => ungroupSelection() },
      { sep: true },
      { label: 'Clip to bottom shape', run: () => { if (multi) clipSelection(); } },
      { label: 'Release clip', run: () => releaseClip() },
    ]);
  }
  function openAlignMenu(): void {
    const mk = (label: string, fn: () => void): PopItem => ({ label, run: fn });
    const anchor = toolbar.children[2];
    if (!(anchor instanceof HTMLElement)) return;
    spawnPopover(anchor, [
      mk('Align left', () => applyAlign('left')),
      mk('Align centre', () => applyAlign('hcentre')),
      mk('Align right', () => applyAlign('right')),
      mk('Align top', () => applyAlign('top')),
      mk('Align middle', () => applyAlign('vcentre')),
      mk('Align bottom', () => applyAlign('bottom')),
      { sep: true },
      mk('Distribute horizontally', () => applyDistribute('h')),
      mk('Distribute vertically', () => applyDistribute('v')),
    ]);
  }

  // ── contextual bar ───────────────────────────────────────────────────────────
  // Every box is ONE unified object (fill + shape + image + text), so the bar
  // always offers every control. Rebuilt only when the selection set changes (so
  // the colour pickers show the selected box); positioned each frame elsewhere.
  function rebuildCtxBar(boxes: Box[], idx: number[]): void {
    closeMorePanel();
    const firstIdx = idx[0];
    const first: Box = (firstIdx !== undefined ? boxes[firstIdx] : undefined) || {};
    const fillVal = cfg.fillField ? (first[cfg.fillField] || 'transparent') : '';
    const fgVal = cfg.textColorField ? (first[cfg.textColorField] || '#0c322c') : '#0c322c';
    ctxbar.innerHTML = `
      ${cfg.fillField ? `<span class="fc-cfield" title="Fill">${colorFieldHtml('fc-fill', fillVal, { float: true })}</span>` : ''}
      ${cfg.textColorField ? `<span class="fc-cfield" title="Text colour">${colorFieldHtml('fc-fg', fgVal, { float: true })}</span>` : ''}
      <button type="button" class="fc-cbtn" data-cx="smaller" title="Smaller text" aria-label="Smaller text">A−</button>
      <button type="button" class="fc-cbtn" data-cx="bigger" title="Bigger text" aria-label="Bigger text">A+</button>
      <button type="button" class="fc-cbtn" data-cx="align" title="Text alignment" aria-label="Text alignment">≡</button>
      <button type="button" class="fc-cbtn" data-cx="weight" title="Text weight" aria-label="Text weight">B</button>
      <button type="button" class="fc-cbtn" data-cx="setimg" title="Set image" aria-label="Set image">${icon(SVG.image)}</button>
      <button type="button" class="fc-cbtn" data-cx="more" title="More — shape, radius, opacity, fit, blend" aria-label="More options">${icon(SVG.more)}</button>
      <span class="fc-sep fc-sep-v"></span>
      <button type="button" class="fc-cbtn" data-cx="dup" title="Duplicate" aria-label="Duplicate">${icon(SVG.dup)}</button>
      <button type="button" class="fc-cbtn fc-danger" data-cx="del" title="Delete" aria-label="Delete">${icon(SVG.trash)}</button>
      <span class="fc-readout" data-cx-readout></span>`;
    wireColorField(ctxbar, {
      onChange: (id, val) => {
        if (id === 'fc-fill') setField(cfg.fillField, unwrapColor(val));
        else if (id === 'fc-fg') setField(cfg.textColorField, unwrapColor(val));
      },
    });
    ctxbar.querySelectorAll<HTMLElement>('[data-cx]').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      const cx = b.dataset.cx;
      if (cx === 'smaller') bumpFont(-6);
      else if (cx === 'bigger') bumpFont(6);
      else if (cx === 'align') cycleAlign();
      else if (cx === 'weight') cycleWeight();
      else if (cx === 'dup') duplicateSelection();
      else if (cx === 'del') deleteSelection();
      else if (cx === 'setimg') pickImage();
      else if (cx === 'more') openMorePanel(b);
    }));
  }

  // ── "More" panel: shape / radius / opacity / image fit / blend ────────────────
  let morePanel: HTMLDivElement | null = null;
  function closeMorePanel(): void { morePanel?.remove(); morePanel = null; }

  // ── canvas (document) size ────────────────────────────────────────────────────
  function applyDocSize(w: number, h: number): void {
    if (!setCanvasSize) return;
    setCanvasSize(Math.max(16, Math.round(w)), Math.max(16, Math.round(h)));
    scheduleSync();
  }
  const SIZE_PRESETS: [string, number, number][] = [
    ['Square', 1080, 1080], ['Portrait 4:5', 1080, 1350], ['Story 9:16', 1080, 1920],
    ['Landscape 16:9', 1920, 1080], ['Wide 1.91:1', 1200, 630], ['A4 portrait', 2480, 3508],
  ];
  function openSizeMenu(anchor: HTMLElement): void {
    closeMorePanel();
    const d = canvasWH();
    const p = document.createElement('div');
    p.className = 'fc-panel fc-size-panel';
    p.innerHTML =
      '<div class="fc-panel-head">Canvas size</div>' +
      '<div class="fc-size-presets">' +
      SIZE_PRESETS.map(([label, w, h]) => `<button type="button" class="fc-size-preset${w === d.w && h === d.h ? ' is-current' : ''}" data-w="${w}" data-h="${h}"><b>${label}</b><span>${w}×${h}</span></button>`).join('') +
      '</div>' +
      '<label class="fc-row"><span>Width</span><input type="number" min="16" max="12000" data-sz="w" value="' + d.w + '"><b>px</b></label>' +
      '<label class="fc-row"><span>Height</span><input type="number" min="16" max="12000" data-sz="h" value="' + d.h + '"><b>px</b></label>';
    p.addEventListener('pointerdown', (e) => e.stopPropagation());
    const wIn = () => p.querySelector<HTMLInputElement>('[data-sz="w"]');
    const hIn = () => p.querySelector<HTMLInputElement>('[data-sz="h"]');
    p.querySelectorAll<HTMLButtonElement>('.fc-size-preset').forEach((b) => b.addEventListener('click', () => {
      const w = b.dataset.w, h = b.dataset.h;
      if (w == null || h == null) return;
      const wi = wIn(), hi = hIn();
      if (wi) wi.value = w;
      if (hi) hi.value = h;
      p.querySelectorAll('.fc-size-preset').forEach((x) => x.classList.toggle('is-current', x === b));
      applyDocSize(+w, +h);
    }));
    const commitCustom = (): void => {
      const wi = wIn(), hi = hIn();
      if (!wi || !hi) return;
      const w = parseInt(wi.value, 10), h = parseInt(hi.value, 10);
      if (w >= 16 && h >= 16) {
        applyDocSize(w, h);
        p.querySelectorAll('.fc-size-preset').forEach((x) => {
          if (!(x instanceof HTMLElement)) return;
          x.classList.toggle('is-current', +(x.dataset.w ?? NaN) === w && +(x.dataset.h ?? NaN) === h);
        });
      }
    };
    p.querySelectorAll<HTMLInputElement>('input[data-sz]').forEach((i) => i.addEventListener('change', commitCustom));
    stageEl.appendChild(p);
    morePanel = p;
    const ar = anchor.getBoundingClientRect(), sr = stageEl.getBoundingClientRect();
    p.style.left = Math.min(ar.right - sr.left + 8, sr.width - p.offsetWidth - 8) + 'px';
    p.style.top = Math.max(6, Math.min(ar.top - sr.top, sr.height - p.offsetHeight - 8)) + 'px';
  }

  function openMorePanel(anchor: HTMLElement): void {
    closeMorePanel();
    const boxes = getBoxes();
    const idx = selIndices(boxes);
    if (!idx.length) return;
    const firstIdx = idx[0];
    const b: Box = (firstIdx !== undefined ? boxes[firstIdx] : undefined) || {};
    const opt = (v: string, label: string, cur: unknown) => `<option value="${v}"${String(cur) === v ? ' selected' : ''}>${label}</option>`;
    const shapeCur = (cfg.shapeField && b[cfg.shapeField]) || 'rect';
    const fitCur = (cfg.fitField && b[cfg.fitField]) || 'cover';
    const blendCur = (cfg.blendField && b[cfg.blendField]) || 'normal';
    const radiusCur = Math.max(0, Math.round(parseFloat(String(cfg.radiusField ? b[cfg.radiusField] : undefined)) || 0));
    const opacityRaw = parseFloat(String(cfg.opacityField ? b[cfg.opacityField] : undefined));
    const opacityCur = Number.isFinite(opacityRaw) ? Math.round(opacityRaw) : 100;
    const p = document.createElement('div');
    p.className = 'fc-panel';
    p.innerHTML = `
      ${cfg.shapeField ? `<label class="fc-row"><span>Shape</span><select data-mp="shape">
        ${opt('rect', 'Rectangle', shapeCur)}${opt('rounded', 'Rounded', shapeCur)}${opt('pill', 'Pill', shapeCur)}${opt('ellipse', 'Ellipse', shapeCur)}
      </select></label>` : ''}
      ${cfg.radiusField ? `<label class="fc-row"><span>Corner radius</span><input type="range" data-mp="radius" min="0" max="200" value="${radiusCur}"><b data-mp-val="radius">${radiusCur}</b></label>` : ''}
      ${cfg.opacityField ? `<label class="fc-row"><span>Opacity</span><input type="range" data-mp="opacity" min="0" max="100" value="${Number.isFinite(opacityCur) ? opacityCur : 100}"><b data-mp-val="opacity">${Number.isFinite(opacityCur) ? opacityCur : 100}</b></label>` : ''}
      ${cfg.fitField ? `<label class="fc-row"><span>Image fit</span><select data-mp="fit">
        ${opt('cover', 'Cover (crop)', fitCur)}${opt('contain', 'Contain', fitCur)}${opt('fill', 'Stretch', fitCur)}
      </select></label>` : ''}
      ${cfg.blendField ? `<label class="fc-row"><span>Blend mode</span><select data-mp="blend">
        ${['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'].map((m) => opt(m, m.charAt(0).toUpperCase() + m.slice(1).replace('-', ' '), blendCur)).join('')}
      </select></label>` : ''}`;
    p.addEventListener('pointerdown', (e) => e.stopPropagation());
    p.querySelectorAll<HTMLSelectElement>('select[data-mp]').forEach((sel) => sel.addEventListener('change', () => {
      const key = sel.dataset.mp;
      const field = key === 'shape' ? cfg.shapeField : key === 'fit' ? cfg.fitField : cfg.blendField;
      setField(field, sel.value);
    }));
    p.querySelectorAll<HTMLInputElement>('input[data-mp]').forEach((rng) => rng.addEventListener('input', () => {
      const key = rng.dataset.mp;
      const valEl = p.querySelector<HTMLElement>(`[data-mp-val="${key}"]`);
      if (valEl) valEl.textContent = rng.value;
      const field = key === 'radius' ? cfg.radiusField : cfg.opacityField;
      setField(field, Number(rng.value));
    }));
    stageEl.appendChild(p);
    morePanel = p;
    const ar = anchor.getBoundingClientRect();
    const sr = stageEl.getBoundingClientRect();
    p.style.left = Math.min(ar.left - sr.left, sr.width - p.offsetWidth - 8) + 'px';
    p.style.top = (ar.bottom - sr.top + 8) + 'px';
  }

  // ── field editing (applies to all selected boxes) ────────────────────────────
  function setField(field: string | undefined, value: InputValue): void {
    if (!field) return;
    const boxes = getBoxes();
    const sel = new Set(selIndices(boxes));
    commit(boxes.map((b, i) => (sel.has(i) ? { ...b, [field]: value } : b)));
  }
  function bumpFont(delta: number): void {
    const fontSizeField = cfg.fontSizeField;
    if (!fontSizeField) return;
    const boxes = getBoxes();
    const sel = new Set(selIndices(boxes));
    commit(boxes.map((b, i) => {
      if (!sel.has(i)) return b;
      const cur = parseFloat(String(b[fontSizeField]));
      const base = Number.isFinite(cur) ? cur : 48;
      return { ...b, [fontSizeField]: Math.max(4, base + delta) };
    }));
  }
  const ALIGN_CYCLE = ['left', 'center', 'right'];
  function cycleAlign(): void {
    const alignField = cfg.alignField;
    if (!alignField) return;
    const boxes = getBoxes();
    const sel = new Set(selIndices(boxes));
    const first = boxes.find((b, i) => sel.has(i));
    const cur = ALIGN_CYCLE.indexOf(String(first?.[alignField]));
    const next = ALIGN_CYCLE[(cur + 1) % ALIGN_CYCLE.length] || 'center';
    commit(boxes.map((b, i) => (sel.has(i) ? { ...b, [alignField]: next } : b)));
  }
  const WEIGHT_CYCLE = ['400', '600', '700', '800'];
  function cycleWeight(): void {
    const weightField = cfg.weightField;
    if (!weightField) return;
    const boxes = getBoxes();
    const sel = new Set(selIndices(boxes));
    const first = boxes.find((b, i) => sel.has(i));
    const cur = WEIGHT_CYCLE.indexOf(String(first?.[weightField]));
    const next = WEIGHT_CYCLE[(cur + 1) % WEIGHT_CYCLE.length] || '700';
    commit(boxes.map((b, i) => (sel.has(i) ? { ...b, [weightField]: next } : b)));
  }
  /** The image field's stored value is an AssetRef by convention; narrow it. */
  function assetRefId(v: InputValue | undefined): string | undefined {
    if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Uint8Array) && 'id' in v) {
      const id = (v as { id?: unknown }).id;
      return typeof id === 'string' ? id : undefined;
    }
    return undefined;
  }
  async function pickImage(): Promise<void> {
    const imageField = cfg.imageField;
    const pick = host.assets?.pick;
    if (!imageField || !pick) return;
    const boxes0 = getBoxes();
    const firstIdx0 = selIndices(boxes0)[0];
    const first: Box = (firstIdx0 !== undefined ? boxes0[firstIdx0] : undefined) || {};
    try {
      const ref = await pick({
        title: 'Choose an image',
        type: 'raster',
        allowUpload: true,
        current: assetRefId(first[imageField]),
        // Choosing a Lolly link or a saved creation opens its inputs first so the
        // user can set values (configure → insert), reusing the sidebar's editor.
        editTool,
      });
      if (!ref) return;
      const boxes = getBoxes();
      const sel = new Set(selIndices(boxes));
      commit(boxes.map((b, i) => (sel.has(i) ? { ...b, [imageField]: ref } : b)));
    } catch { /* user cancelled */ }
  }

  // ── grouping + clip/mask ──────────────────────────────────────────────────────
  function freshGroupId(boxes: Box[]): string {
    const used = new Set(boxes.map((b) => groupOf(b)).filter(Boolean));
    let g: string;
    do { g = 'g' + Date.now().toString(36).slice(-4) + (idSeq++).toString(36); } while (used.has(g));
    return g;
  }
  function groupSelection(): void {
    const groupField = cfg.groupField;
    if (!groupField) return;
    const boxes = getBoxes();
    const idx = selIndices(boxes);
    if (idx.length < 2) return;
    const g = freshGroupId(boxes);
    const set = new Set(idx);
    commit(boxes.map((b, i) => (set.has(i) ? { ...b, [groupField]: g } : b)));
  }
  function ungroupSelection(): void {
    const groupField = cfg.groupField;
    if (!groupField) return;
    const boxes = getBoxes();
    const set = new Set(selIndices(boxes));
    if (!boxes.some((b, i) => set.has(i) && groupOf(b))) return;
    commit(boxes.map((b, i) => (set.has(i) && groupOf(b) ? { ...b, [groupField]: '' } : b)));
  }
  // Clip: the LOWEST selected box (bottom of the stack) is the mask; every higher
  // selected box is clipped to its shape. They're grouped so the mask + content
  // travel together (Figma-style mask group).
  function clipSelection(): void {
    const clipField = cfg.clipField;
    if (!clipField) return;
    const boxes = getBoxes();
    const idx = selIndices(boxes).slice().sort((a, b) => a - b);
    if (idx.length < 2) return;
    const idx0 = idx[0];
    if (idx0 === undefined) return; // unreachable — idx.length >= 2 guarantees a first element
    const maskId = idOf(boxes[idx0], idx0);
    const clipSet = new Set(idx.slice(1));
    const allSet = new Set(idx);
    const g = cfg.groupField ? freshGroupId(boxes) : '';
    const groupField = cfg.groupField;
    commit(boxes.map((b, i) => {
      if (!allSet.has(i)) return b;
      const nb = { ...b };
      if (clipSet.has(i)) nb[clipField] = maskId;
      if (groupField) nb[groupField] = g;
      return nb;
    }));
  }
  function releaseClip(): void {
    const clipField = cfg.clipField;
    if (!clipField) return;
    const boxes = getBoxes();
    const set = new Set(selIndices(boxes));
    if (!boxes.some((b, i) => set.has(i) && b[clipField])) return;
    commit(boxes.map((b, i) => (set.has(i) && b[clipField] ? { ...b, [clipField]: '' } : b)));
  }
  const selHasGroup = (): boolean => { const bx = getBoxes(); return selIndices(bx).some((i) => groupOf(bx[i])); };
  const selHasClip = (): boolean => {
    const clipField = cfg.clipField;
    if (!clipField) return false;
    const bx = getBoxes();
    return selIndices(bx).some((i) => bx[i]?.[clipField]);
  };

  // ── z-order / align / distribute ─────────────────────────────────────────────
  function applyZ(op: ZOp): void {
    const boxes = getBoxes();
    const idx = selIndices(boxes);
    if (!idx.length) return;
    commit(reorderZ(boxes, idx, op));
  }
  function applyAlign(edge: AlignEdge): void {
    const boxes = getBoxes();
    const idx = selIndices(boxes);
    if (!idx.length) return;
    commit(alignBoxes(boxes, idx, edge, cfg, canvasWH()));
  }
  function applyDistribute(axis: Axis): void {
    const boxes = getBoxes();
    const idx = selIndices(boxes);
    if (idx.length < 3) return;
    commit(distributeBoxes(boxes, idx, axis, cfg));
  }

  function duplicateSelection(): void {
    const boxes = getBoxes();
    const idx = selIndices(boxes);
    if (!idx.length) return;
    const clones: Box[] = [];
    const nextSel = new Set<string>();
    const pool = boxes.slice();
    for (const i of idx) {
      const id = freshId(pool.concat(clones));
      const r = boxRect(boxes[i], cfg);
      const clone = { ...boxes[i], [cfg.idField]: id, [cfg.xField]: Math.round(r.x + 24), [cfg.yField]: Math.round(r.y + 24) };
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
    selection = new Set();
    commit(boxes.filter((_, i) => !sel.has(i)));
  }

  // ── create-mode arming ───────────────────────────────────────────────────────
  function armCreate(kind: AddKind): void {
    armedKind = kind;
    stageEl.classList.add('fc-arming');
    toolbar.querySelector('.fc-btn-add')?.classList.add('is-armed');
  }
  function disarm(): void {
    armedKind = null;
    stageEl.classList.remove('fc-arming');
    toolbar.querySelector('.fc-btn-add')?.classList.remove('is-armed');
  }

  // ── pointer gestures on the canvas ───────────────────────────────────────────
  function beginGesture(e: PointerEvent, g: GestureInit): void {
    try { canvasEl.setPointerCapture(e.pointerId); } catch { /* older browsers */ }
    // TS can't verify a spread over a generic union preserves the discriminant
    // shape; the object literal below is exactly `g` plus the two base fields
    // every gesture variant declares, for every member of GestureInit/Gesture.
    gesture = { ...g, pointerId: e.pointerId, startClient: { x: e.clientX, y: e.clientY } } as Gesture;
    document.body.classList.add('fc-manipulating');
  }
  function endGesture(): void {
    document.body.classList.remove('fc-manipulating');
    gesture = null;
    rubber.hidden = true;
    clearGuides();
  }

  // ── inline text editing (double-click a box) ─────────────────────────────────
  function onDblClick(e: MouseEvent): void {
    if (!cfg.textField) return;
    const nat = clientToNative(e.clientX, e.clientY);
    const boxes = getBoxes();
    const hit = hitTest(boxes, nat.x, nat.y, cfg);
    if (hit < 0) return;
    e.preventDefault();
    selection = new Set([idOf(boxes[hit], hit)]);
    renderChrome();
    startTextEdit(idOf(boxes[hit], hit));
  }
  function startTextEdit(id: string): void {
    if (editing) commitTextEdit();
    const el = canvasEl.querySelector<HTMLElement>(`.lolly-box[data-box-id="${cssEscape(id)}"] .lolly-box-text`);
    if (!el) return;
    editing = { id, el, prev: el.textContent };
    chrome.innerHTML = '';       // hide handles while typing
    ctxbar.hidden = true;
    closeMorePanel();
    el.setAttribute('contenteditable', 'plaintext-only');
    el.classList.add('fc-editing');
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel?.removeAllRanges(); sel?.addRange(range);
    el.addEventListener('keydown', onEditKey);
    el.addEventListener('blur', onEditBlur);
  }
  function onEditKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') { e.preventDefault(); cancelTextEdit(); }
    else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitTextEdit(); }
    e.stopPropagation();          // keep global Delete/nudge/undo off while typing
  }
  function onEditBlur(): void { commitTextEdit(); }
  function finishEdit(): EditingState | null {
    if (!editing) return null;
    const done = editing; editing = null;
    done.el.removeEventListener('keydown', onEditKey);
    done.el.removeEventListener('blur', onEditBlur);
    done.el.removeAttribute('contenteditable');
    done.el.classList.remove('fc-editing');
    return done;
  }
  function commitTextEdit(): void {
    const done = finishEdit();
    if (!done) return;
    // commitTextEdit only runs while `editing` is set, which startTextEdit only
    // sets after onDblClick's `if (!cfg.textField) return;` check — so this is
    // always defined here.
    const textField = cfg.textField;
    if (!textField) { renderChrome(); return; }
    const text = (done.el as HTMLElement & { innerText: string }).innerText.replace(/ /g, ' ').replace(/\n$/, '');
    const boxes = getBoxes();
    const i = indexOfId(boxes, done.id);
    if (i >= 0 && String(boxes[i]?.[textField] ?? '') !== text) {
      commit(boxes.map((b, k) => (k === i ? { ...b, [textField]: text } : b)));
    } else renderChrome();
  }
  function cancelTextEdit(): void {
    const done = finishEdit();
    if (!done) return;
    done.el.textContent = done.prev;
    renderChrome();
  }

  function onCanvasPointerDown(e: PointerEvent): void {
    if (e.button > 0) return;                 // primary button / touch only
    if (editing) {
      if (editing.el.contains(e.target as Node | null)) return;   // let the caret move within the text
      commitTextEdit();                            // clicked elsewhere → commit, then select
    }
    closePopover();
    const nat = clientToNative(e.clientX, e.clientY);
    const boxes = getBoxes();

    if (armedKind) {
      beginGesture(e, { type: 'create', origin: nat, seed: armedKind.seed || {}, others: otherAABBs(boxes, new Set()) });
      rubber.hidden = false;
      e.stopPropagation(); e.preventDefault();
      return;
    }

    const hit = hitTest(boxes, nat.x, nat.y, cfg);
    if (hit >= 0) {
      const id = idOf(boxes[hit], hit);
      const additive = e.shiftKey || e.metaKey || e.ctrlKey;
      const hitSel = selectionForHit(boxes, hit, e.altKey);   // whole group, or Alt = just this box
      if (additive) {
        const anyIn = hitSel.some((x) => selection.has(x));
        for (const x of hitSel) { if (anyIn) selection.delete(x); else selection.add(x); }
      } else if (!selection.has(id)) {
        selection = new Set(hitSel);
      }
      renderChrome();
      // Start a move for the whole current selection.
      const start = new Map<number, Rect>();
      const sel = selIndices(boxes);
      for (const i of sel) start.set(i, boxRect(boxes[i], cfg));
      beginGesture(e, {
        type: 'move', start, sel,
        selAABB: selectionAABB(boxes, sel, cfg),
        others: otherAABBs(boxes, new Set(sel)),
      });
      e.stopPropagation();
      return;
    }

    // Empty canvas.
    if (e.pointerType === 'mouse') {
      beginGesture(e, { type: 'marquee', origin: nat, additive: e.shiftKey || e.metaKey });
      rubber.hidden = false;
      e.stopPropagation();
    } else {
      // Let stageNav own touch pan/pinch on empty canvas; arm a tap-to-deselect.
      gesture = { type: 'tap', pointerId: e.pointerId, startClient: { x: e.clientX, y: e.clientY } };
    }
  }

  function onGestureMove(e: PointerEvent): void {
    if (!gesture || e.pointerId !== gesture.pointerId) return;
    if (gesture.type === 'tap') return;       // stageNav owns it; only checked on up
    e.preventDefault();
    const nat = clientToNative(e.clientX, e.clientY);
    const dxN = nat.x - (gesture.origin?.x ?? clientToNative(gesture.startClient.x, gesture.startClient.y).x);
    const dyN = nat.y - (gesture.origin?.y ?? clientToNative(gesture.startClient.x, gesture.startClient.y).y);

    if (gesture.type === 'marquee') {
      drawRubber(gesture.origin, nat);
      return;
    }
    if (gesture.type === 'create') {
      const snap = snapPoint(nat.x, nat.y, gesture.others, canvasWH(), snapThreshNative());
      const corner = { x: snap.x, y: snap.y };
      drawGuides(snap.guides);
      gesture.corner = corner;
      drawRubber(gesture.origin, corner);
      return;
    }
    if (gesture.type === 'move') {
      let mdx = dxN, mdy = dyN;
      if (gesture.selAABB && !e.altKey) {
        const selAABB = gesture.selAABB;
        const cand: AABB = {
          minX: selAABB.minX + dxN, minY: selAABB.minY + dyN,
          maxX: selAABB.maxX + dxN, maxY: selAABB.maxY + dyN,
          w: selAABB.w, h: selAABB.h,
        };
        const snap = snapMove(cand, gesture.others, canvasWH(), snapThreshNative());
        mdx += snap.dx; mdy += snap.dy;
        drawGuides(snap.guides);
      } else clearGuides();
      gesture.moveDelta = { dx: mdx, dy: mdy };
      for (const [i, r] of gesture.start) applyLiveRect(i, { ...r, x: r.x + mdx, y: r.y + mdy });
      renderChromeLive();
      return;
    }
    if (gesture.type === 'resize') {
      let sdx = dxN, sdy = dyN;
      if ((gesture.startRect.rot || 0) === 0 && !e.altKey) {
        const snap = snapPoint(nat.x, nat.y, gesture.others, canvasWH(), snapThreshNative());
        sdx += snap.x - nat.x; sdy += snap.y - nat.y;
        drawGuides(snap.guides);
      } else clearGuides();
      const nr = resizeRect(gesture.startRect, gesture.handle, sdx, sdy, {
        minSize, keepAspect: e.shiftKey, fromCentre: e.altKey,
      });
      applyLiveRect(gesture.index, { ...nr, rot: gesture.startRect.rot });
      gesture.liveRect = { ...nr, rot: gesture.startRect.rot };
      renderChromeLive();
      return;
    }
    if (gesture.type === 'rotate') {
      const c = gesture.centerClient;
      let deg = Math.atan2(e.clientY - c.y, e.clientX - c.x) * 180 / Math.PI - gesture.pointerStartDeg + gesture.startRect.rot;
      deg = normAngle(deg);                       // keep stored rotation in [-180, 180)
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
      return;
    }
    if (gesture.type === 'grotate') {
      const c = gesture.centerClient;
      let deg = Math.atan2(e.clientY - c.y, e.clientX - c.x) * 180 / Math.PI - gesture.pointerStartDeg;
      if (!e.altKey) deg = snapAngle(deg, 15, 4);
      const next = rotateGroup(gesture.startBoxes, gesture.sel, gesture.centre, deg, cfg);
      for (const i of gesture.sel) applyLiveRect(i, boxRect(next[i], cfg));
      gesture.liveBoxes = next;
      renderChromeLive();
      return;
    }
  }

  function onGestureEnd(e: PointerEvent): void {
    if (!gesture || e.pointerId !== gesture.pointerId) return;
    const g = gesture;
    try { canvasEl.releasePointerCapture(e.pointerId); } catch { /* ignore */ }

    if (g.type === 'tap') {
      const moved = Math.hypot(e.clientX - g.startClient.x, e.clientY - g.startClient.y);
      if (moved < 6) { selection = new Set(); disarm(); renderChrome(); }
      gesture = null;
      return;
    }

    const nat = clientToNative(e.clientX, e.clientY);
    const boxes = getBoxes();

    if (g.type === 'create') {
      const moved = Math.hypot(e.clientX - g.startClient.x, e.clientY - g.startClient.y);
      let rect: Rect;
      if (moved < 6) {
        // A tap (no drag) drops a default-sized box centred on the point.
        const w = 320, h = 200;
        rect = { x: g.origin.x - w / 2, y: g.origin.y - h / 2, w, h, rot: 0 };
      } else {
        const c = g.corner || nat;
        rect = { ...normDragRect(g.origin.x, g.origin.y, c.x, c.y, minSize), rot: 0 };
      }
      const id = freshId(boxes);
      let box = seedBox(cfg, {}, g.seed, rect, id);
      box = clampBoxToCanvas(box, cfg, canvasWH());
      selection = new Set([id]);
      const wasImage = (g.seed?.[cfg.kindField] === 'image') || armedKind?.id === 'image';
      disarm();
      endGesture();
      commit([...boxes, box]);
      if (wasImage) setTimeout(() => pickImage(), 0);
      return;
    }
    if (g.type === 'marquee') {
      const moved = Math.hypot(e.clientX - g.startClient.x, e.clientY - g.startClient.y);
      if (moved < 6) { selection = new Set(); }
      else {
        const rect = normDragRect(g.origin.x, g.origin.y, nat.x, nat.y, 0);
        const hits = marqueeHit(boxes, rect, cfg).map((i) => idOf(boxes[i], i));
        if (g.additive) for (const id of hits) selection.add(id);
        else selection = new Set(hits);
      }
      endGesture();
      renderChrome();
      return;
    }
    if (g.type === 'move') {
      const d = g.moveDelta || { dx: 0, dy: 0 };
      endGesture();
      if (Math.abs(d.dx) > 0.5 || Math.abs(d.dy) > 0.5) commit(moveBoxes(boxes, [...g.sel], d.dx, d.dy, cfg));
      else renderChrome();
      return;
    }
    if (g.type === 'resize' || g.type === 'rotate') {
      const live = g.liveRect || g.startRect;
      endGesture();
      commit(boxes.map((b, i) => (i === g.index ? withRect(b, live, cfg) : b)));
      return;
    }
    if (g.type === 'gscale' || g.type === 'grotate') {
      const next = g.liveBoxes;
      endGesture();
      if (next) commit(next); else renderChrome();
      return;
    }
    endGesture();
  }

  // Apply a rect to a live box DOM element during a gesture (no model write).
  function applyLiveRect(index: number, r: Rect): void {
    const boxes = getBoxes();
    const id = idOf(boxes[index], index);
    const el = canvasEl.querySelector<HTMLElement>(`.lolly-box[data-box-id="${cssEscape(id)}"]`);
    if (!el) return;
    el.style.left = Math.round(r.x) + 'px';
    el.style.top = Math.round(r.y) + 'px';
    el.style.width = Math.max(1, Math.round(r.w)) + 'px';
    el.style.height = Math.max(1, Math.round(r.h)) + 'px';
    el.style.transform = r.rot ? `rotate(${(Math.round(r.rot * 10) / 10)}deg)` : '';
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
    const index = idx[0];
    if (index === undefined) return; // unreachable — idx.length === 1 guarantees this
    const startRect = boxRect(boxes[index], cfg);
    if (handle === 'rotate') {
      const m = metrics();
      const c = rectCentre(startRect);
      const cs = nativeToStage(c.x, c.y, m);
      const centerClient = { x: cs.x + m.sr.left, y: cs.y + m.sr.top };
      const pointerStartDeg = Math.atan2(e.clientY - centerClient.y, e.clientX - centerClient.x) * 180 / Math.PI;
      beginGesture(e, { type: 'rotate', index, startRect, centerClient, pointerStartDeg });
    } else {
      beginGesture(e, { type: 'resize', index, handle, startRect, others: otherAABBs(boxes, new Set([index])) });
    }
  }

  // AABBs of every box NOT in `exclude` (snap targets), + the snap threshold in
  // native px (a fixed SCREEN distance regardless of zoom).
  function otherAABBs(boxes: Box[], exclude: Set<number>): AABB[] {
    const out: AABB[] = [];
    for (let i = 0; i < boxes.length; i++) if (!exclude.has(i)) out.push(boxAABB(boxes[i], cfg));
    return out;
  }
  const snapThreshNative = (): number => SNAP_PX / (metrics().scale || 1);

  function drawGuides(list: Guide[]): void {
    guidesEl.innerHTML = '';
    if (!list.length) return;
    const m = metrics();
    for (const g of list) {
      const a = nativeToStage(g.x1, g.y1, m), b = nativeToStage(g.x2, g.y2, m);
      const el = document.createElement('div');
      el.className = 'fc-guide';
      el.style.left = a.x + 'px';
      el.style.top = a.y + 'px';
      el.style.width = Math.hypot(b.x - a.x, b.y - a.y) + 'px';
      el.style.transform = `rotate(${Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI}deg)`;
      guidesEl.appendChild(el);
    }
  }
  const clearGuides = (): void => { guidesEl.innerHTML = ''; };

  // ── overlay rendering ─────────────────────────────────────────────────────────
  let syncScheduled = false;
  function scheduleSync(): void {
    if (syncScheduled || disposed) return;
    syncScheduled = true;
    requestAnimationFrame(() => { syncScheduled = false; if (!gesture || gesture.type === 'tap') renderChrome(); });
  }

  // During a gesture, reposition chrome from the live DOM (which we just mutated).
  function renderChromeLive(): void {
    const boxes = getBoxes();
    const rects = new Map<number, Rect>();
    for (const i of selIndices(boxes)) {
      const id = idOf(boxes[i], i);
      const el = canvasEl.querySelector<HTMLElement>(`.lolly-box[data-box-id="${cssEscape(id)}"]`);
      if (el) rects.set(i, {
        x: parseFloat(el.style.left) || 0, y: parseFloat(el.style.top) || 0,
        w: parseFloat(el.style.width) || 1, h: parseFloat(el.style.height) || 1,
        rot: rotOf(el),
      });
    }
    paintChrome(boxes, rects);
  }

  function renderChrome(): void {
    const boxes = getBoxes();
    paintChrome(boxes, null);
  }

  function paintChrome(boxes: Box[], liveRects: Map<number, Rect> | null): void {
    // outlines + handles
    chrome.innerHTML = '';
    const idx = selIndices(boxes);
    const m = metrics();
    for (const i of idx) {
      const r = liveRects?.get(i) || boxRect(boxes[i], cfg);
      const tl = nativeToStage(r.x, r.y, m);
      const o = document.createElement('div');
      o.className = 'fc-outline';
      o.style.left = tl.x + 'px';
      o.style.top = tl.y + 'px';
      o.style.width = r.w * m.scale + 'px';
      o.style.height = r.h * m.scale + 'px';
      o.style.transform = r.rot ? `rotate(${r.rot}deg)` : '';
      chrome.appendChild(o);
    }
    const idx0 = idx[0];
    if (idx.length === 1 && idx0 !== undefined) {
      const r = liveRects?.get(idx0) || boxRect(boxes[idx0], cfg);
      addHandles(r, m);
    } else if (idx.length > 1) {
      addGroupHandles(groupAABBNative(idx, boxes, liveRects), m);
    }
    // Contextual bar — rebuild its controls only when the SELECTION set changes
    // (so the colour pickers reflect the box); otherwise just reposition it.
    const key = idx.length ? idx.map((i) => idOf(boxes[i], i)).sort().join(',') : '';
    if (key !== ctxSelKey) {
      ctxSelKey = key;
      if (idx.length) rebuildCtxBar(boxes, idx);
      else { ctxbar.hidden = true; closeMorePanel(); }
    }
    if (idx.length) positionCtxBar(boxes, idx, liveRects, m);
    updateToolbarState(idx.length);
  }

  function addHandles(r: Rect, m: Metrics): void {
    const box: Box = { [cfg.xField]: r.x, [cfg.yField]: r.y, [cfg.wField]: r.w, [cfg.hField]: r.h, [cfg.rotationField]: r.rot };
    const corners = boxCorners(box, cfg).map((p) => nativeToStage(p.x, p.y, m)); // TL,TR,BR,BL
    const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    const [cTL, cTR, cBR, cBL] = corners;
    if (!cTL || !cTR || !cBR || !cBL) return; // unreachable — boxCorners always returns 4 points
    const pos: Record<HandleName, Point> = {
      nw: cTL, ne: cTR, se: cBR, sw: cBL,
      n: mid(cTL, cTR), e: mid(cTR, cBR),
      s: mid(cBR, cBL), w: mid(cBL, cTL),
    };
    for (const h of HANDLES) {
      const el = document.createElement('div');
      el.className = 'fc-handle fc-h-' + h;
      el.style.left = pos[h].x + 'px';
      el.style.top = pos[h].y + 'px';
      el.addEventListener('pointerdown', (e) => onHandlePointerDown(e, h));
      chrome.appendChild(el);
    }
    // rotate handle: outward from the BOTTOM-edge midpoint along the box "down"
    // normal — kept clear of the contextual bar (which floats above the selection)
    // and the 'n' resize handle, so the two never fight for a grab (Canva-style).
    const ROT_OFFSET = 30;
    const c = nativeToStage(r.x + r.w / 2, r.y + r.h / 2, m);
    const bottom = pos.s;
    const len = Math.hypot(bottom.x - c.x, bottom.y - c.y) || 1;
    const ux = (bottom.x - c.x) / len, uy = (bottom.y - c.y) / len;
    const rp = { x: bottom.x + ux * ROT_OFFSET, y: bottom.y + uy * ROT_OFFSET };
    const stem = document.createElement('div');
    stem.className = 'fc-rot-stem';
    stem.style.left = bottom.x + 'px'; stem.style.top = bottom.y + 'px';
    stem.style.width = ROT_OFFSET + 'px';
    stem.style.transform = `rotate(${Math.atan2(uy, ux) * 180 / Math.PI}deg)`;
    chrome.appendChild(stem);
    const rot = document.createElement('div');
    rot.className = 'fc-handle fc-h-rotate';
    rot.style.left = rp.x + 'px'; rot.style.top = rp.y + 'px';
    rot.title = 'Rotate';
    rot.addEventListener('pointerdown', (e) => onHandlePointerDown(e, 'rotate'));
    chrome.appendChild(rot);
  }

  // Axis-aligned native AABB of a multi-selection (rotation-aware), from live DOM
  // rects during a gesture else from the model.
  function groupAABBNative(idx: number[], boxes: Box[], liveRects: Map<number, Rect> | null): Bounds {
    let a: Bounds | null = null;
    for (const i of idx) {
      const r = liveRects?.get(i) || boxRect(boxes[i], cfg);
      for (const p of boxCorners(rectAsBox(r), cfg)) {
        a = a
          ? { minX: Math.min(a.minX, p.x), minY: Math.min(a.minY, p.y), maxX: Math.max(a.maxX, p.x), maxY: Math.max(a.maxY, p.y) }
          : { minX: p.x, minY: p.y, maxX: p.x, maxY: p.y };
      }
    }
    return a || { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }

  // Group/multi-selection chrome: an axis-aligned box with 4 corner handles
  // (uniform scale) + a rotate handle.
  function addGroupHandles(a: Bounds, m: Metrics): void {
    const corners = {
      nw: nativeToStage(a.minX, a.minY, m), ne: nativeToStage(a.maxX, a.minY, m),
      se: nativeToStage(a.maxX, a.maxY, m), sw: nativeToStage(a.minX, a.maxY, m),
    };
    const outline = document.createElement('div');
    outline.className = 'fc-outline fc-group-outline';
    outline.style.left = corners.nw.x + 'px';
    outline.style.top = corners.nw.y + 'px';
    outline.style.width = (corners.ne.x - corners.nw.x) + 'px';
    outline.style.height = (corners.sw.y - corners.nw.y) + 'px';
    chrome.appendChild(outline);
    (['nw', 'ne', 'se', 'sw'] as const).forEach((name) => {
      const el = document.createElement('div');
      el.className = 'fc-handle fc-h-' + name;
      el.style.left = corners[name].x + 'px';
      el.style.top = corners[name].y + 'px';
      el.addEventListener('pointerdown', (e) => onGroupHandleDown(e, name));
      chrome.appendChild(el);
    });
    const bc = { x: (corners.sw.x + corners.se.x) / 2, y: (corners.sw.y + corners.se.y) / 2 };
    const stem = document.createElement('div');
    stem.className = 'fc-rot-stem';
    stem.style.left = bc.x + 'px'; stem.style.top = bc.y + 'px';
    stem.style.width = '30px'; stem.style.transform = 'rotate(90deg)';
    chrome.appendChild(stem);
    const rot = document.createElement('div');
    rot.className = 'fc-handle fc-h-rotate';
    rot.style.left = bc.x + 'px'; rot.style.top = (bc.y + 30) + 'px';
    rot.title = 'Rotate group';
    rot.addEventListener('pointerdown', (e) => onGroupHandleDown(e, 'rotate'));
    chrome.appendChild(rot);
  }

  type GroupCorner = 'nw' | 'ne' | 'se' | 'sw';
  const CORNER_PT = (a: Bounds, name: GroupCorner): Point => ({
    nw: { x: a.minX, y: a.minY }, ne: { x: a.maxX, y: a.minY },
    se: { x: a.maxX, y: a.maxY }, sw: { x: a.minX, y: a.maxY },
  })[name];
  const OPPOSITE: Record<GroupCorner, GroupCorner> = { nw: 'se', ne: 'sw', se: 'nw', sw: 'ne' };

  function onGroupHandleDown(e: PointerEvent, name: GroupCorner | 'rotate'): void {
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
      const pointerStartDeg = Math.atan2(e.clientY - centerClient.y, e.clientX - centerClient.x) * 180 / Math.PI;
      beginGesture(e, { type: 'grotate', sel, startBoxes: boxes, centre, centerClient, pointerStartDeg });
    } else {
      const anchor = CORNER_PT(a, OPPOSITE[name]);
      const corner = CORNER_PT(a, name);
      const origDist = Math.hypot(corner.x - anchor.x, corner.y - anchor.y) || 1;
      beginGesture(e, { type: 'gscale', sel, startBoxes: boxes, anchor, origDist });
    }
  }

  function positionCtxBar(boxes: Box[], idx: number[], liveRects: Map<number, Rect> | null, m: Metrics): void {
    if (editing) { ctxbar.hidden = true; return; }   // hidden while typing in a box
    ctxbar.hidden = false;
    const i0 = idx[0];
    if (i0 === undefined) { ctxbar.hidden = true; return; } // unreachable — only called when idx.length
    // Position above the selection's union AABB.
    const rects = boxes.map((b, i) => {
      const live = liveRects?.get(i);
      return live ? rectAsBox(live) : b;
    });
    const aabb = selectionAABB(rects, idx, cfg);
    if (!aabb) { ctxbar.hidden = true; return; }
    const tl = nativeToStage(aabb.minX, aabb.minY, m);
    const br = nativeToStage(aabb.maxX, aabb.maxY, m);
    // Centre by computed `left` (NOT translateX) so the colour popover — which is
    // position:fixed — isn't captured by a transformed ancestor. Clamp on-stage.
    const bw = ctxbar.offsetWidth || 0;
    const stageW = m.sr.width;
    const left = Math.max(6, Math.min((tl.x + br.x) / 2 - bw / 2, stageW - bw - 6));
    ctxbar.style.left = left + 'px';
    ctxbar.style.top = Math.max(6, tl.y - 48) + 'px';
    // Transform readout.
    const first = boxes[i0];
    const r = liveRects?.get(i0) || boxRect(first, cfg);
    const read = ctxbar.querySelector<HTMLElement>('[data-cx-readout]');
    if (read) read.textContent = idx.length > 1
      ? `${idx.length} selected`
      : `${Math.round(r.x)}, ${Math.round(r.y)}  ·  ${Math.round(r.w)}×${Math.round(r.h)}${r.rot ? '  ·  ' + Math.round(r.rot) + '°' : ''}`;
  }

  function updateToolbarState(_count: number): void {
    // Nothing hard-disabled — align-to-canvas works on a single box; arrange/delete
    // no-op when empty. Just reflect the armed state.
    toolbar.querySelector('.fc-btn-add')?.classList.toggle('is-armed', !!armedKind);
  }

  // ── helpers ───────────────────────────────────────────────────────────────────
  const rectAsBox = (r: Rect): Box => ({ [cfg.xField]: r.x, [cfg.yField]: r.y, [cfg.wField]: r.w, [cfg.hField]: r.h, [cfg.rotationField]: r.rot });
  function rotOf(el: HTMLElement): number {
    const t = el.style.transform || '';
    const mm = t.match(/rotate\(([-0-9.]+)deg\)/);
    return mm?.[1] ? parseFloat(mm[1]) : 0;
  }
  function cssEscape(s: string): string {
    return (window.CSS && CSS.escape) ? CSS.escape(s) : String(s).replace(/["\\]/g, '\\$&');
  }

  // ── keyboard ─────────────────────────────────────────────────────────────────
  function typingTarget(): boolean {
    const el = document.activeElement;
    if (!el) return false;
    const t = el.tagName;
    return t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT' || (el instanceof HTMLElement && el.isContentEditable);
  }
  function onKey(e: KeyboardEvent): void {
    if (disposed) return;
    if (e.key === 'Escape') { if (armedKind) { disarm(); } else if (selection.size) { selection = new Set(); renderChrome(); } closePopover(); return; }
    if (typingTarget()) return;
    if ((e.key === 'Delete' || e.key === 'Backspace') && selection.size) { e.preventDefault(); deleteSelection(); return; }
    if ((e.key === 'd' || e.key === 'D') && (e.metaKey || e.ctrlKey) && selection.size) { e.preventDefault(); duplicateSelection(); return; }
    if ((e.key === 'g' || e.key === 'G') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); if (e.shiftKey) ungroupSelection(); else groupSelection(); return; }
    if (e.key === 'a' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      const boxes = getBoxes();
      selection = new Set(boxes.map((b, i) => idOf(b, i)));
      renderChrome();
      return;
    }
    // Arrow-nudge (Shift = 10px).
    const nudges: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
    };
    const nudge = nudges[e.key];
    if (nudge && selection.size) {
      e.preventDefault();
      const step = (e.shiftKey ? 10 : 1);
      const [ux, uy] = nudge;
      const boxes = getBoxes();
      commit(moveBoxes(boxes, selIndices(boxes), ux * step, uy * step, cfg));
    }
  }

  // ── wiring ────────────────────────────────────────────────────────────────────
  canvasEl.addEventListener('pointerdown', onCanvasPointerDown);
  canvasEl.addEventListener('pointermove', onGestureMove);
  canvasEl.addEventListener('pointerup', onGestureEnd);
  canvasEl.addEventListener('pointercancel', onGestureEnd);
  canvasEl.addEventListener('dblclick', onDblClick);
  canvasEl.addEventListener('contextmenu', onContextMenu);
  window.addEventListener('keydown', onKey);
  // Reposition chrome when the stage pans/zooms/resizes.
  const onStageMove = (): void => scheduleSync();
  stageEl.addEventListener('pointermove', onStageMove, { passive: true });
  stageEl.addEventListener('wheel', onStageMove, { passive: true });
  window.addEventListener('resize', onStageMove);
  const ro = new ResizeObserver(onStageMove);
  ro.observe(stageEl);
  // Re-sync after every model change (paint()).
  const unsub = runtime.subscribe(() => scheduleSync());
  // Dismiss popover / more-panel on outside click.
  const onDocDown = (e: PointerEvent): void => {
    const target = e.target;
    if (popover && !(target instanceof Node && popover.contains(target))) closePopover();
    if (morePanel && !(target instanceof Node && morePanel.contains(target)) && !(target instanceof Element && target.closest('[data-cx="more"]'))) closeMorePanel();
  };
  document.addEventListener('pointerdown', onDocDown, true);

  // `viewEl` is accepted for parity with other view init functions but isn't
  // read by this module.
  void viewEl;

  renderChrome();

  return {
    destroy() {
      disposed = true;
      finishEdit();
      canvasEl.removeEventListener('pointerdown', onCanvasPointerDown);
      canvasEl.removeEventListener('pointermove', onGestureMove);
      canvasEl.removeEventListener('pointerup', onGestureEnd);
      canvasEl.removeEventListener('pointercancel', onGestureEnd);
      canvasEl.removeEventListener('dblclick', onDblClick);
      canvasEl.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('keydown', onKey);
      stageEl.removeEventListener('pointermove', onStageMove);
      stageEl.removeEventListener('wheel', onStageMove);
      window.removeEventListener('resize', onStageMove);
      document.removeEventListener('pointerdown', onDocDown, true);
      ro.disconnect();
      unsub();
      overlay.remove(); toolbarDock.remove(); closePopover(); closeMorePanel();
      document.body.classList.remove('fc-manipulating');
    },
  };
}
