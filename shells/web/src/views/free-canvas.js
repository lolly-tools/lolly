// free-canvas.js — the WYSIWYG direct-manipulation overlay for render.layout:'editor'.
//
// This is the ONLY DOM in the free-canvas feature; all geometry lives in the pure,
// unit-tested free-canvas-math.js. It mounts:
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

import {
  boxRect, withRect, boxCorners, rectCentre, hitTest, marqueeHit, boxAABB,
  moveBoxes, resizeRect, alignBoxes, distributeBoxes, reorderZ,
  seedBox, normDragRect, snapAngle, normAngle, clampBoxToCanvas, selectionAABB,
  snapMove, snapPoint, scaleGroup, rotateGroup,
} from './free-canvas-math.js';
import { toCssPx } from '@lolly/engine';
import { colorFieldHtml, wireColorField } from '../components/color-field.js';
import {
  charsFromDom, htmlFromChars, markdownFromChars,
  rangeHasFlag, setFlag, wordRangeAt, allBulleted, toggleBullets,
} from './rich-text.js';

const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
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
  editText: '<path d="M4 7V5h16v2"/><path d="M9 19h6"/><path d="M12 5v14"/>',
  // Pencil — the "edit text" action (replaces the old 'T' glyph on the object bar).
  pencil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  // Type glyph — the Text add-kind + the "Aa" text panel.
  type: '<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>',
  boxKind: '<rect x="3" y="5" width="18" height="14" rx="2.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><line x1="11" y1="11.5" x2="12" y2="11.5"/><line x1="12" y1="11.5" x2="12" y2="16"/><circle cx="12" cy="8" r="0.7" fill="currentColor" stroke="none"/>',
  // Shape glyphs for the segmented shape control.
  shRect: '<rect x="4" y="6" width="16" height="12"/>',
  shRounded: '<rect x="4" y="6" width="16" height="12" rx="4.5"/>',
  shPill: '<rect x="3" y="7.5" width="18" height="9" rx="4.5"/>',
  shEllipse: '<ellipse cx="12" cy="12" rx="9" ry="7"/>',
  // Image-fit glyphs.
  fitContain: '<rect x="3" y="4.5" width="18" height="15" rx="1.5"/><rect x="8" y="8.5" width="8" height="7" rx="1"/>',
  fitCover: '<rect x="3" y="4.5" width="18" height="15" rx="1.5"/><path d="M3 16l4.5-3.5L11 15l3-2.2L21 18"/><circle cx="8.5" cy="9" r="1.2"/>',
  fitFill: '<rect x="3" y="4.5" width="18" height="15" rx="1.5"/><polyline points="8 9 5.5 12 8 15"/><polyline points="16 9 18.5 12 16 15"/>',
  radius: '<path d="M5 19V9a4 4 0 0 1 4-4h10"/><line x1="5" y1="19" x2="5" y2="21"/><line x1="3" y1="19" x2="5" y2="19"/>',
  opacity: '<rect x="3.5" y="3.5" width="17" height="17" rx="2.5"/><path d="M12 3.5v17"/><path d="M12 5.5h6.5M12 8.5h8M12 11.5h8M12 14.5h8M12 17.5h6.5"/>',
  blend: '<circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6" opacity="0.5"/>',
  shadowIc: '<rect x="3.5" y="3.5" width="12" height="12" rx="2.5"/><path d="M8.5 20.5h10a2 2 0 0 0 2-2v-10" opacity="0.45"/>',
  collapse: '<polyline points="15 18 9 12 15 6"/>',
  forward: '<polyline points="8 9 12 5 16 9"/><line x1="12" y1="5" x2="12" y2="15"/><line x1="5" y1="19" x2="19" y2="19"/>',
  backward: '<polyline points="8 15 12 19 16 15"/><line x1="12" y1="19" x2="12" y2="9"/><line x1="5" y1="5" x2="19" y2="5"/>',
  back: '<rect x="3" y="10" width="11" height="11" rx="1.5"/><path d="M10 7V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-2"/>',
  alignL: '<line x1="4" y1="3.5" x2="4" y2="20.5"/><rect x="7" y="5.5" width="13" height="4.5" rx="1"/><rect x="7" y="14" width="8" height="4.5" rx="1"/>',
  alignC: '<line x1="12" y1="3.5" x2="12" y2="20.5"/><rect x="5" y="5.5" width="14" height="4.5" rx="1"/><rect x="8" y="14" width="8" height="4.5" rx="1"/>',
  alignR: '<line x1="20" y1="3.5" x2="20" y2="20.5"/><rect x="4" y="5.5" width="13" height="4.5" rx="1"/><rect x="9" y="14" width="8" height="4.5" rx="1"/>',
  alignT: '<line x1="3.5" y1="4" x2="20.5" y2="4"/><rect x="5.5" y="7" width="4.5" height="13" rx="1"/><rect x="14" y="7" width="4.5" height="8" rx="1"/>',
  alignM: '<line x1="3.5" y1="12" x2="20.5" y2="12"/><rect x="5.5" y="5" width="4.5" height="14" rx="1"/><rect x="14" y="8" width="4.5" height="8" rx="1"/>',
  alignB: '<line x1="3.5" y1="20" x2="20.5" y2="20"/><rect x="5.5" y="4" width="4.5" height="13" rx="1"/><rect x="14" y="9" width="4.5" height="8" rx="1"/>',
  distH: '<line x1="4" y1="3.5" x2="4" y2="20.5"/><line x1="20" y1="3.5" x2="20" y2="20.5"/><rect x="9" y="7" width="6" height="10" rx="1"/>',
  distV: '<line x1="3.5" y1="4" x2="20.5" y2="4"/><line x1="3.5" y1="20" x2="20.5" y2="20"/><rect x="7" y="9" width="10" height="6" rx="1"/>',
  group: '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><rect x="6.5" y="6.5" width="5" height="5" rx="1"/><rect x="12.5" y="12.5" width="5" height="5" rx="1"/>',
  ungroup: '<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/>',
  clip: '<rect x="3" y="3" width="12" height="12" rx="2"/><circle cx="15.5" cy="15.5" r="5.5"/>',
  unclip: '<rect x="3" y="3" width="9" height="9" rx="2"/><circle cx="16.5" cy="16.5" r="4.5"/>',
  // Text alignment (lines of ragged copy) — distinct from the object-align icons.
  textL: '<line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="14" y2="12"/><line x1="4" y1="18" x2="17" y2="18"/>',
  textC: '<line x1="4" y1="6" x2="20" y2="6"/><line x1="7" y1="12" x2="17" y2="12"/><line x1="5.5" y1="18" x2="18.5" y2="18"/>',
  textR: '<line x1="4" y1="6" x2="20" y2="6"/><line x1="10" y1="12" x2="20" y2="12"/><line x1="7" y1="18" x2="20" y2="18"/>',
  textT: '<line x1="4" y1="4" x2="20" y2="4"/><line x1="6" y1="9" x2="18" y2="9"/><line x1="8" y1="13" x2="16" y2="13"/>',
  textM: '<line x1="6" y1="8" x2="18" y2="8"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="6" y1="16" x2="18" y2="16"/>',
  textB: '<line x1="4" y1="20" x2="20" y2="20"/><line x1="6" y1="15" x2="18" y2="15"/><line x1="8" y1="11" x2="16" y2="11"/>',
};

function icon(paths) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

// SUSE weight menu (shared by the Text panel and the in-edit format bar).
// SUSE Mono has no Black cut — its variable axis tops out at 800 — so the mono
// menu stops at Extrabold (hooks.js + the vector exporter cap it the same way).
const WEIGHT_CHOICES = [
  ['100', 'Thin'], ['200', 'Extra light'], ['300', 'Light'], ['400', 'Regular'],
  ['500', 'Medium'], ['600', 'Semibold'], ['700', 'Bold'], ['800', 'Extrabold'], ['900', 'Black'],
];
const weightChoicesFor = (font) => WEIGHT_CHOICES.filter(([v]) => String(font) !== 'SUSE Mono' || +v <= 800);
// Flex mappings for the align/valign live preview — must mirror hooks.js boxCss.
const H_JUSTIFY = { left: 'flex-start', center: 'center', right: 'flex-end' };
const V_ALIGN = { top: 'flex-start', middle: 'center', bottom: 'flex-end' };

export function initFreeCanvas(opts) {
  const { viewEl, stageEl, canvasEl, runtime, host, input, nativeW, nativeH, onDirty, editTool, setCanvasSize, info } = opts;
  // The artboard is resizable, so read its CURRENT declared size (not the mount-time
  // nativeW/H) everywhere geometry depends on the canvas dimensions.
  const canvasWH = () => ({
    w: parseInt(canvasEl.style.width, 10) || nativeW,
    h: parseInt(canvasEl.style.height, 10) || nativeH,
  });
  const cv = input.canvas || {};
  const blockId = input.id;
  const cfg = {
    idField: cv.idField || 'id',
    xField: cv.xField || 'x', yField: cv.yField || 'y',
    wField: cv.wField || 'w', hField: cv.hField || 'h',
    rotationField: cv.rotationField || 'rot',
    fillField: cv.fillField, opacityField: cv.opacityField, shapeField: cv.shapeField,
    radiusField: cv.radiusField, imageField: cv.imageField, fitField: cv.fitField,
    blendField: cv.blendField, textField: cv.textField, textColorField: cv.textColorField,
    fontSizeField: cv.fontSizeField, alignField: cv.alignField, valignField: cv.valignField,
    weightField: cv.weightField, fontField: cv.fontField, lineHeightField: cv.lineHeightField,
    padField: cv.padField, groupField: cv.groupField, clipField: cv.clipField,
    shadowField: cv.shadowField, shadowColorField: cv.shadowColorField,
    shadowXField: cv.shadowXField, shadowYField: cv.shadowYField, shadowBlurField: cv.shadowBlurField,
    kindField: 'kind',
  };
  const unwrapColor = (v) => (v && typeof v === 'object' && 'value' in v ? v.value : v);
  const minSize = cv.minSize ?? 8;
  const addKinds = Array.isArray(cv.addKinds) && cv.addKinds.length
    ? cv.addKinds : [{ id: 'box', label: 'Box', seed: {} }];
  const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── state ──────────────────────────────────────────────────────────────────
  let selection = new Set();   // box ids
  let armedKind = null;        // seed for the add-box create gesture
  let gesture = null;          // active pointer gesture
  let editing = null;          // { id, el, prev } while editing a box's text inline
  let disposed = false;

  // ── model access ─────────────────────────────────────────────────────────
  const getBoxes = () => {
    const e = runtime.getModel().find((i) => i.id === blockId);
    return Array.isArray(e?.value) ? e.value : [];
  };
  const bgInputId = 'background';
  const getBg = () => runtime.getModel().find((i) => i.id === bgInputId)?.value ?? '#ffffff';

  const idOf = (b, i) => (b && b[cfg.idField] != null && b[cfg.idField] !== '' ? String(b[cfg.idField]) : String(i));
  const selIndices = (boxes) => boxes.reduce((a, b, i) => (selection.has(idOf(b, i)) ? (a.push(i), a) : a), []);
  const indexOfId = (boxes, id) => boxes.findIndex((b, i) => idOf(b, i) === id);
  const groupOf = (b) => (cfg.groupField && b && b[cfg.groupField] ? String(b[cfg.groupField]) : '');
  const groupMemberIds = (boxes, g) => boxes.reduce((a, b, i) => (groupOf(b) === g ? (a.push(idOf(b, i)), a) : a), []);
  // The ids selected when box `i` is clicked: its whole group (if any), unless
  // `soloBox` (Alt-click) drills in to just that one box.
  function selectionForHit(boxes, i, soloBox) {
    const g = groupOf(boxes[i]);
    return (soloBox || !g) ? [idOf(boxes[i], i)] : groupMemberIds(boxes, g);
  }

  let idSeq = 0;
  function freshId(boxes) {
    // Short, collision-checked id (Math.random is fine in the browser shell).
    const used = new Set(boxes.map((b, i) => idOf(b, i)));
    let id;
    do { id = 'b' + (Date.now().toString(36).slice(-4)) + (idSeq++).toString(36) + Math.floor(Math.random() * 46656).toString(36); }
    while (used.has(id));
    return id;
  }

  function commit(nextBoxes) {
    onDirty?.(blockId);
    runtime.setInput(blockId, nextBoxes);
  }

  // ── coordinate mapping (transform-agnostic via the live canvas rect) ────────
  function metrics() {
    const cr = canvasEl.getBoundingClientRect();
    const sr = stageEl.getBoundingClientRect();
    const scale = cr.width / canvasWH().w || 1;
    return { cr, sr, scale };
  }
  const clientToNative = (cx, cy) => {
    const { cr, scale } = metrics();
    return { x: (cx - cr.left) / scale, y: (cy - cr.top) / scale };
  };
  const nativeToStage = (nx, ny, m = metrics()) => ({
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
  let ctxSelKey = null;   // sorted selected-id signature; rebuild ctxbar when it changes

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

  // ── toolbar ─────────────────────────────────────────────────────────────────
  let popover = null;
  let arrangeBtn = null, alignBtn = null;   // popover anchors (captured, not by index)
  function closePopover() { popover?.remove(); popover = null; }
  buildToolbar();   // after arrangeBtn/alignBtn exist (buildToolbar assigns them)

  function toolBtn(label, svg, onClick, extraClass = '') {
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

  function buildToolbar() {
    // Collapse toggle — the chromeless editor has no other way to reclaim the space,
    // so let the whole rail fold away (and back) with a tap.
    const collapse = document.createElement('button');
    collapse.type = 'button';
    collapse.className = 'fc-btn fc-collapse';
    collapse.title = 'Hide tools';
    collapse.setAttribute('aria-label', 'Hide tools');
    collapse.setAttribute('aria-expanded', 'true');
    collapse.innerHTML = icon(SVG.collapse);
    collapse.addEventListener('pointerdown', (e) => e.stopPropagation());
    collapse.addEventListener('click', (e) => {
      e.stopPropagation(); closePopover();
      const collapsed = toolbar.classList.toggle('is-collapsed');
      collapse.title = collapsed ? 'Show tools' : 'Hide tools';
      collapse.setAttribute('aria-label', collapse.title);
      collapse.setAttribute('aria-expanded', String(!collapsed));
    });
    toolbar.appendChild(collapse);
    const add = toolBtn('Add a box', SVG.add, () => openAddMenu(add), 'fc-btn-add');
    if (armedKind) add.classList.add('is-armed');
    arrangeBtn = toolBtn('Arrange (stacking order)', SVG.front, () => openArrangeMenu());
    alignBtn = toolBtn('Align & distribute', SVG.align, () => openAlignMenu());
    if (setCanvasSize) toolBtn('Canvas size', SVG.size, (b) => openSizeMenu(b));
    if (info) toolBtn('Document info', SVG.info, (b) => openInfoPanel(b));
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

  function fillPopover(el, items) {
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
  function spawnPopover(anchor, items) {
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
  function openContextMenu(clientX, clientY) {
    closePopover();
    const has = selection.size > 0;
    const multi = selection.size >= 2;
    const items = [
      { label: 'Duplicate', icon: icon(SVG.dup), run: () => duplicateSelection(), disabled: !has },
      { label: 'Delete', icon: icon(SVG.trash), run: () => deleteSelection(), disabled: !has, danger: true },
      { sep: true },
      { label: 'Bring to front', icon: icon(SVG.front), run: () => applyZ('front'), disabled: !has },
      { label: 'Bring forward', icon: icon(SVG.forward), run: () => applyZ('forward'), disabled: !has },
      { label: 'Send backward', icon: icon(SVG.backward), run: () => applyZ('backward'), disabled: !has },
      { label: 'Send to back', icon: icon(SVG.back), run: () => applyZ('back'), disabled: !has },
      { sep: true },
      { label: 'Align left', icon: icon(SVG.alignL), run: () => applyAlign('left'), disabled: !has },
      { label: 'Align centre', icon: icon(SVG.alignC), run: () => applyAlign('hcentre'), disabled: !has },
      { label: 'Align right', icon: icon(SVG.alignR), run: () => applyAlign('right'), disabled: !has },
      { label: 'Align top', icon: icon(SVG.alignT), run: () => applyAlign('top'), disabled: !has },
      { label: 'Align middle', icon: icon(SVG.alignM), run: () => applyAlign('vcentre'), disabled: !has },
      { label: 'Align bottom', icon: icon(SVG.alignB), run: () => applyAlign('bottom'), disabled: !has },
      { label: 'Distribute horizontally', icon: icon(SVG.distH), run: () => applyDistribute('h'), disabled: selection.size < 3 },
      { label: 'Distribute vertically', icon: icon(SVG.distV), run: () => applyDistribute('v'), disabled: selection.size < 3 },
      { sep: true },
      { label: 'Group', icon: icon(SVG.group), run: () => groupSelection(), disabled: !multi },
      { label: 'Ungroup', icon: icon(SVG.ungroup), run: () => ungroupSelection(), disabled: !selHasGroup() },
      { label: 'Clip to bottom shape', icon: icon(SVG.clip), run: () => clipSelection(), disabled: !multi },
      { label: 'Release clip', icon: icon(SVG.unclip), run: () => releaseClip(), disabled: !selHasClip() },
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
  function onContextMenu(e) {
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

  const ADD_KIND_ICON = { image: SVG.image, text: SVG.type, box: SVG.boxKind };
  function openAddMenu(anchor) {
    spawnPopover(anchor, addKinds.map((k) => ({
      label: k.label || k.id,
      icon: icon(ADD_KIND_ICON[k.id] || SVG.add),
      run: () => armCreate(k),
    })));
  }
  function openArrangeMenu() {
    const has = selection.size > 0;
    const multi = selection.size >= 2;
    spawnPopover(arrangeBtn, [
      { label: 'Bring to front', icon: icon(SVG.front), run: () => has && applyZ('front') },
      { label: 'Bring forward', icon: icon(SVG.forward), run: () => has && applyZ('forward') },
      { label: 'Send backward', icon: icon(SVG.backward), run: () => has && applyZ('backward') },
      { label: 'Send to back', icon: icon(SVG.back), run: () => has && applyZ('back') },
      { sep: true },
      { label: 'Group', icon: icon(SVG.group), run: () => multi && groupSelection() },
      { label: 'Ungroup', icon: icon(SVG.ungroup), run: () => ungroupSelection() },
      { sep: true },
      { label: 'Clip to bottom shape', icon: icon(SVG.clip), run: () => multi && clipSelection() },
      { label: 'Release clip', icon: icon(SVG.unclip), run: () => releaseClip() },
    ]);
  }
  function openAlignMenu() {
    const mk = (label, ic, fn) => ({ label, icon: icon(ic), run: fn });
    spawnPopover(alignBtn, [
      mk('Align left', SVG.alignL, () => applyAlign('left')),
      mk('Align centre', SVG.alignC, () => applyAlign('hcentre')),
      mk('Align right', SVG.alignR, () => applyAlign('right')),
      mk('Align top', SVG.alignT, () => applyAlign('top')),
      mk('Align middle', SVG.alignM, () => applyAlign('vcentre')),
      mk('Align bottom', SVG.alignB, () => applyAlign('bottom')),
      { sep: true },
      mk('Distribute horizontally', SVG.distH, () => applyDistribute('h')),
      mk('Distribute vertically', SVG.distV, () => applyDistribute('v')),
    ]);
  }

  // ── contextual bar ───────────────────────────────────────────────────────────
  // Every box is ONE unified object (fill + shape + image + text), so the bar
  // always offers every control. Rebuilt only when the selection set changes (so
  // the colour pickers show the selected box); positioned each frame elsewhere.
  function rebuildCtxBar(boxes, idx) {
    closeMorePanel();
    const first = boxes[idx[0]] || {};
    const fillVal = cfg.fillField ? (first[cfg.fillField] || 'transparent') : '';
    const fgVal = cfg.textColorField ? (first[cfg.textColorField] || '#0c322c') : '#0c322c';
    ctxbar.innerHTML = `
      ${cfg.fillField ? `<span class="fc-cfield" title="Fill">${colorFieldHtml('fc-fill', fillVal, { float: true })}</span>` : ''}
      ${cfg.textColorField ? `<span class="fc-cfield" title="Text colour">${colorFieldHtml('fc-fg', fgVal, { float: true })}</span>` : ''}
      <button type="button" class="fc-cbtn" data-cx="edit" title="Edit text (double-click)" aria-label="Edit text">${icon(SVG.pencil)}</button>
      <button type="button" class="fc-cbtn fc-cbtn-text" data-cx="text" title="Text — size, font, weight, alignment, line height, padding" aria-label="Text options">Aa</button>
      <button type="button" class="fc-cbtn" data-cx="setimg" title="Set image" aria-label="Set image">${icon(SVG.image)}</button>
      <button type="button" class="fc-cbtn" data-cx="more" title="More — shape, radius, opacity, fit, blend, shadow" aria-label="More options">${icon(SVG.more)}</button>
      <span class="fc-sep fc-sep-v"></span>
      <button type="button" class="fc-cbtn" data-cx="dup" title="Duplicate" aria-label="Duplicate">${icon(SVG.dup)}</button>
      <button type="button" class="fc-cbtn fc-danger" data-cx="del" title="Delete" aria-label="Delete">${icon(SVG.trash)}</button>
      <button type="button" class="fc-readout" data-cx="dims" data-cx-readout title="Edit position & size" aria-label="Edit position and size"></button>`;
    wireColorField(ctxbar, {
      onChange: (id, val) => {
        if (id === 'fc-fill') setField(cfg.fillField, unwrapColor(val));
        else if (id === 'fc-fg') setField(cfg.textColorField, unwrapColor(val));
      },
    });
    ctxbar.querySelectorAll('[data-cx]').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      const cx = b.dataset.cx;
      if (cx === 'text') openTextPanel(b);
      else if (cx === 'edit') { if (selection.size) startTextEdit([...selection][0], { selectAll: true }); }
      else if (cx === 'dup') duplicateSelection();
      else if (cx === 'del') deleteSelection();
      else if (cx === 'setimg') pickImage();
      else if (cx === 'more') openMorePanel(b);
      else if (cx === 'dims') openDimsPanel(b);
    }));
  }

  // ── "More" panel: shape / radius / opacity / image fit / blend ────────────────
  let morePanel = null;
  function closeMorePanel() { morePanel?.remove(); morePanel = null; }

  // ── canvas (document) size ────────────────────────────────────────────────────
  const SIZE_UNITS = ['px', 'mm', 'cm', 'in', 'pt'];
  let sizeUnit = 'px';   // remembered across opens of the size menu
  // px per 1 of a unit (96-DPI CSS convention — matches the artboard mapping).
  const pxPerUnit = (u) => (u === 'px' ? 1 : toCssPx({ value: 1, unit: u }));
  const toUnitVal = (n, from, to) => (n > 0 ? Math.round(n * pxPerUnit(from) / pxPerUnit(to) * 100) / 100 : n);
  function applyDocSize(w, h, unit = sizeUnit) {
    if (!setCanvasSize || !(w > 0) || !(h > 0)) return;
    setCanvasSize(w, h, unit);
    scheduleSync();
  }
  const SIZE_PRESETS = [
    ['Square', 1080, 1080], ['Portrait 4:5', 1080, 1350], ['Story 9:16', 1080, 1920],
    ['Landscape 16:9', 1920, 1080], ['Wide 1.91:1', 1200, 630], ['A4 portrait', 2480, 3508],
  ];
  function openSizeMenu(anchor) {
    closeMorePanel();
    const d = canvasWH();   // always px
    // Show the current px size expressed in the remembered unit.
    const dispW = toUnitVal(d.w, 'px', sizeUnit), dispH = toUnitVal(d.h, 'px', sizeUnit);
    const p = document.createElement('div');
    p.className = 'fc-panel fc-size-panel';
    p.innerHTML =
      '<div class="fc-panel-head">Canvas size</div>' +
      '<div class="fc-size-presets">' +
      SIZE_PRESETS.map(([label, w, h]) => `<button type="button" class="fc-size-preset${sizeUnit === 'px' && w === d.w && h === d.h ? ' is-current' : ''}" data-w="${w}" data-h="${h}"><b>${label}</b><span>${w}×${h}</span></button>`).join('') +
      '</div>' +
      `<label class="fc-row"><span>Units</span><select data-sz="unit">${SIZE_UNITS.map((u) => `<option value="${u}"${u === sizeUnit ? ' selected' : ''}>${u}</option>`).join('')}</select></label>` +
      `<label class="fc-row"><span>Width</span><input type="number" min="1" max="30000" step="any" data-sz="w" value="${dispW}"><b data-sz-unit>${sizeUnit}</b></label>` +
      `<label class="fc-row"><span>Height</span><input type="number" min="1" max="30000" step="any" data-sz="h" value="${dispH}"><b data-sz-unit>${sizeUnit}</b></label>`;
    p.addEventListener('pointerdown', (e) => e.stopPropagation());
    const wIn = () => p.querySelector('[data-sz="w"]');
    const hIn = () => p.querySelector('[data-sz="h"]');
    p.querySelectorAll('.fc-size-preset').forEach((b) => b.addEventListener('click', () => {
      // Presets are px — switch the unit control back to px and fill it in.
      sizeUnit = 'px';
      p.querySelector('[data-sz="unit"]').value = 'px';
      p.querySelectorAll('[data-sz-unit]').forEach((x) => (x.textContent = 'px'));
      wIn().value = b.dataset.w; hIn().value = b.dataset.h;
      p.querySelectorAll('.fc-size-preset').forEach((x) => x.classList.toggle('is-current', x === b));
      applyDocSize(+b.dataset.w, +b.dataset.h, 'px');
    }));
    const commitCustom = () => {
      const w = parseFloat(wIn().value), h = parseFloat(hIn().value);
      if (w > 0 && h > 0) {
        applyDocSize(w, h, sizeUnit);
        p.querySelectorAll('.fc-size-preset').forEach((x) => x.classList.toggle('is-current', sizeUnit === 'px' && +x.dataset.w === Math.round(w) && +x.dataset.h === Math.round(h)));
      }
    };
    p.querySelectorAll('input[data-sz]').forEach((i) => i.addEventListener('change', commitCustom));
    // Unit switch keeps the physical size: convert the shown W/H into the new unit.
    p.querySelector('[data-sz="unit"]').addEventListener('change', (e) => {
      const to = e.target.value;
      wIn().value = toUnitVal(parseFloat(wIn().value) || 0, sizeUnit, to);
      hIn().value = toUnitVal(parseFloat(hIn().value) || 0, sizeUnit, to);
      sizeUnit = to;
      p.querySelectorAll('[data-sz-unit]').forEach((x) => (x.textContent = to));
      p.querySelectorAll('.fc-size-preset').forEach((x) => x.classList.remove('is-current'));
    });
    stageEl.appendChild(p);
    morePanel = p;
    const ar = anchor.getBoundingClientRect(), sr = stageEl.getBoundingClientRect();
    p.style.left = Math.min(ar.right - sr.left + 8, sr.width - p.offsetWidth - 8) + 'px';
    p.style.top = Math.max(6, Math.min(ar.top - sr.top, sr.height - p.offsetHeight - 8)) + 'px';
  }

  function openMorePanel(anchor) {
    closeMorePanel();
    const boxes = getBoxes();
    const idx = selIndices(boxes);
    if (!idx.length) return;
    const b = boxes[idx[0]] || {};
    const opt = (v, label, cur) => `<option value="${v}"${String(cur) === v ? ' selected' : ''}>${label}</option>`;
    const shapeCur = b[cfg.shapeField] || 'rect';
    const fitCur = b[cfg.fitField] || 'contain';
    const blendCur = b[cfg.blendField] || 'normal';
    const radiusCur = Math.max(0, Math.round(parseFloat(b[cfg.radiusField]) || 0));
    const opacityCur = Math.round(parseFloat(b[cfg.opacityField]) ?? 100);
    // Shadow state — target picks the CSS mechanism; colour/x/y/blur are shared.
    const shadowCur = String(b[cfg.shadowField] || 'none');
    const shColor = String(b[cfg.shadowColorField] || '#00000055');
    const shX = Math.round(clampN(parseFloat(b[cfg.shadowXField]), 0, -300, 300));
    const shY = Math.round(clampN(parseFloat(b[cfg.shadowYField]), 0, -300, 300));
    const shBlur = Math.round(clampN(parseFloat(b[cfg.shadowBlurField]), 10, 0, 300));
    // Row with a leading icon label (keeps the "clean up + use icons" intent while
    // staying legible). segRow hosts a segmented control; iconRow a slider/select.
    const iconRow = (ic, lbl, ctrl) => `<label class="fc-row"><span class="fc-row-lbl" title="${lbl}">${icon(ic)}<span>${lbl}</span></span>${ctrl}</label>`;
    const segRow = (ic, lbl, seg) => `<div class="fc-row"><span class="fc-row-lbl" title="${lbl}">${icon(ic)}<span>${lbl}</span></span>${seg}</div>`;
    const p = document.createElement('div');
    p.className = 'fc-panel fc-more-panel';
    p.innerHTML = `
      ${cfg.shapeField ? segRow(SVG.shRounded, 'Shape', segHtml(cfg.shapeField, shapeCur, [['rect', 'Rectangle', SVG.shRect], ['rounded', 'Rounded', SVG.shRounded], ['pill', 'Pill', SVG.shPill], ['ellipse', 'Ellipse', SVG.shEllipse]])) : ''}
      ${cfg.radiusField ? iconRow(SVG.radius, 'Corner radius', `<input type="range" data-mp="radius" min="0" max="200" value="${radiusCur}"><b data-mp-val="radius">${radiusCur}</b>`) : ''}
      ${cfg.opacityField ? iconRow(SVG.opacity, 'Opacity', `<input type="range" data-mp="opacity" min="0" max="100" value="${Number.isFinite(opacityCur) ? opacityCur : 100}"><b data-mp-val="opacity">${Number.isFinite(opacityCur) ? opacityCur : 100}</b>`) : ''}
      ${cfg.fitField ? segRow(SVG.fitContain, 'Image fit', segHtml(cfg.fitField, fitCur, [['contain', 'Contain', SVG.fitContain], ['cover', 'Cover (crop)', SVG.fitCover], ['fill', 'Stretch', SVG.fitFill]])) : ''}
      ${cfg.blendField ? iconRow(SVG.blend, 'Blend mode', `<select data-mp="blend">
        ${['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'].map((m) => opt(m, m[0].toUpperCase() + m.slice(1).replace('-', ' '), blendCur)).join('')}
      </select>`) : ''}
      ${cfg.shadowField ? `<div class="fc-panel-sub">Shadow</div>
        ${segRow(SVG.shadowIc, 'Apply to', segHtml(cfg.shadowField, shadowCur, [['none', 'None'], ['box', 'Box'], ['text', 'Text'], ['content', 'Content']]))}
        <label class="fc-row"><span class="fc-row-lbl">Colour</span><span class="fc-cfield">${colorFieldHtml('fc-shadow', shColor, { float: true })}</span></label>
        <label class="fc-row"><span class="fc-row-lbl">X</span><input type="range" data-mp="shx" min="-300" max="300" value="${shX}"><b data-mp-val="shx">${shX}</b></label>
        <label class="fc-row"><span class="fc-row-lbl">Y</span><input type="range" data-mp="shy" min="-300" max="300" value="${shY}"><b data-mp-val="shy">${shY}</b></label>
        <label class="fc-row"><span class="fc-row-lbl">Blur</span><input type="range" data-mp="shblur" min="0" max="300" value="${shBlur}"><b data-mp-val="shblur">${shBlur}</b></label>` : ''}`;
    p.addEventListener('pointerdown', (e) => e.stopPropagation());
    wireSegs(p);
    const MP_FIELD = { radius: cfg.radiusField, opacity: cfg.opacityField, shx: cfg.shadowXField, shy: cfg.shadowYField, shblur: cfg.shadowBlurField };
    p.querySelectorAll('select[data-mp]').forEach((sel) => sel.addEventListener('change', () => setField(cfg.blendField, sel.value)));
    p.querySelectorAll('input[data-mp]').forEach((rng) => rng.addEventListener('input', () => {
      const valEl = p.querySelector(`[data-mp-val="${rng.dataset.mp}"]`);
      if (valEl) valEl.textContent = rng.value;
      setField(MP_FIELD[rng.dataset.mp], Number(rng.value));
    }));
    if (cfg.shadowColorField) wireColorField(p, { onChange: (id, val) => { if (id === 'fc-shadow') setField(cfg.shadowColorField, unwrapColor(val)); } });
    stageEl.appendChild(p);
    morePanel = p;
    const ar = anchor.getBoundingClientRect();
    const sr = stageEl.getBoundingClientRect();
    p.style.left = Math.min(ar.left - sr.left, sr.width - p.offsetWidth - 8) + 'px';
    p.style.top = (ar.bottom - sr.top + 8) + 'px';
  }

  // Clamp a floating panel below-and-left of its anchor, inside the stage.
  function positionPanelBelow(p, anchor) {
    const ar = anchor.getBoundingClientRect(), sr = stageEl.getBoundingClientRect();
    p.style.left = Math.max(6, Math.min(ar.left - sr.left, sr.width - p.offsetWidth - 8)) + 'px';
    p.style.top = Math.max(6, Math.min(ar.bottom - sr.top + 8, sr.height - p.offsetHeight - 8)) + 'px';
  }

  // ── Dimensions panel: manual X / Y / W / H / rotation for ONE box ─────────────
  // Opened from the object bar's transform readout (single selection only — editing
  // X on many boxes would stack them). Writes each field on `change`.
  function openDimsPanel(anchor) {
    closeMorePanel();
    const boxes = getBoxes();
    const idx = selIndices(boxes);
    if (idx.length !== 1) return;
    const b = boxes[idx[0]] || {};
    const rd = (f, d) => Math.round(clampN(b[f], d, -100000, 100000));
    const x = rd(cfg.xField, 0), y = rd(cfg.yField, 0);
    const w = Math.max(1, rd(cfg.wField, 1)), h = Math.max(1, rd(cfg.hField, 1));
    const rot = Math.round(clampN(b[cfg.rotationField], 0, -180, 180));
    const p = document.createElement('div');
    p.className = 'fc-panel fc-dims-panel';
    p.innerHTML =
      '<div class="fc-panel-head">Position &amp; size</div>' +
      '<div class="fc-dims-grid">' +
      `<label class="fc-row"><span>X</span><input type="number" data-dm="${cfg.xField}" value="${x}"></label>` +
      `<label class="fc-row"><span>Y</span><input type="number" data-dm="${cfg.yField}" value="${y}"></label>` +
      `<label class="fc-row"><span>W</span><input type="number" min="1" data-dm="${cfg.wField}" value="${w}"></label>` +
      `<label class="fc-row"><span>H</span><input type="number" min="1" data-dm="${cfg.hField}" value="${h}"></label>` +
      (cfg.rotationField ? `<label class="fc-row fc-dims-rot"><span>Rotation</span><input type="number" min="-180" max="180" data-dm="${cfg.rotationField}" value="${rot}"><b>°</b></label>` : '') +
      '</div>';
    p.addEventListener('pointerdown', (e) => e.stopPropagation());
    p.querySelectorAll('input[data-dm]').forEach((inp) => inp.addEventListener('change', () => {
      const f = inp.dataset.dm;
      let v = parseFloat(inp.value);
      if (!Number.isFinite(v)) return;
      if (f === cfg.wField || f === cfg.hField) v = Math.max(1, v);
      if (f === cfg.rotationField) v = clampN(v, 0, -180, 180);
      setField(f, Math.round(v * 100) / 100);
    }));
    stageEl.appendChild(p);
    morePanel = p;
    positionPanelBelow(p, anchor);
    // Anchor the readout drops BELOW the bar (readout sits at the bar's right end).
    const ar = anchor.getBoundingClientRect(), sr = stageEl.getBoundingClientRect();
    p.style.left = Math.max(6, Math.min(ar.right - sr.left - p.offsetWidth, sr.width - p.offsetWidth - 8)) + 'px';
  }

  // ── Document info panel: rename the session/file + at-a-glance details ─────────
  function openInfoPanel(anchor) {
    closeMorePanel();
    const d = canvasWH();
    const fname = info?.getFilename?.() ?? '';
    const p = document.createElement('div');
    p.className = 'fc-panel fc-info-panel';
    p.innerHTML =
      '<div class="fc-panel-head">Document</div>' +
      `<label class="fc-row"><span>Name</span><input type="text" data-info="filename" value="${escapeHtml(fname)}" placeholder="Untitled"></label>` +
      '<div class="fc-info-meta">' +
        '<div class="fc-info-line"><span>Last edited</span><b data-info-edited>…</b></div>' +
        `<div class="fc-info-line"><span>Canvas</span><b>${d.w} × ${d.h} px</b></div>` +
        (info?.name ? `<div class="fc-info-line"><span>Tool</span><b>${escapeHtml(info.name)}${info.version ? ' · v' + escapeHtml(info.version) : ''}</b></div>` : '') +
        (info?.status ? `<div class="fc-info-line"><span>Status</span><b>${escapeHtml(info.status)}</b></div>` : '') +
        (info?.formats?.length ? `<div class="fc-info-line"><span>Exports</span><b>${info.formats.map(escapeHtml).join(', ')}</b></div>` : '') +
      '</div>';
    p.addEventListener('pointerdown', (e) => e.stopPropagation());
    const fn = p.querySelector('[data-info="filename"]');
    fn?.addEventListener('input', () => info?.setFilename?.(fn.value));
    stageEl.appendChild(p);
    morePanel = p;
    positionPanelBelow(p, anchor);
    // Last-edited resolves async (reads the saved session's timestamp).
    Promise.resolve(info?.lastEdited?.()).then((iso) => {
      const el = p.querySelector('[data-info-edited]');
      if (el) el.textContent = iso ? fmtDate(iso) : 'Not saved yet';
    }).catch(() => {});
  }

  // ── field editing (applies to all selected boxes) ────────────────────────────
  function setField(field, value) {
    if (!field) return;
    const boxes = getBoxes();
    const sel = new Set(selIndices(boxes));
    commit(boxes.map((b, i) => (sel.has(i) ? { ...b, [field]: value } : b)));
  }
  function bumpFont(delta) {
    if (!cfg.fontSizeField) return;
    const boxes = getBoxes();
    const sel = new Set(selIndices(boxes));
    commit(boxes.map((b, i) => {
      if (!sel.has(i)) return b;
      const cur = parseFloat(b[cfg.fontSizeField]);
      const base = Number.isFinite(cur) ? cur : 48;
      return { ...b, [cfg.fontSizeField]: Math.max(4, base + delta) };
    }));
  }
  // Segmented icon/label control shared by the Text + More panels. `choices` is
  // [value, label, iconSvg?]; data-seg carries the RESOLVED field so wireSegs writes
  // it directly. When an entry has an icon it renders as an icon button (tooltip =
  // label); otherwise the label text.
  function segHtml(field, cur, choices) {
    return `<div class="fc-seg" data-seg="${field}">` +
      choices.map(([v, lbl, ic]) => `<button type="button" class="fc-seg-btn${String(cur) === String(v) ? ' is-on' : ''}${ic ? ' fc-seg-ic' : ''}" data-v="${v}" title="${lbl}" aria-label="${lbl}">${ic ? icon(ic) : lbl}</button>`).join('') +
      '</div>';
  }
  function wireSegs(panel, onSet = (field, v) => setField(field, v)) {
    panel.querySelectorAll('.fc-seg').forEach((segEl) => segEl.querySelectorAll('.fc-seg-btn').forEach((btn) => btn.addEventListener('click', () => {
      segEl.querySelectorAll('.fc-seg-btn').forEach((x) => x.classList.toggle('is-on', x === btn));
      onSet(segEl.dataset.seg, btn.dataset.v);
    })));
  }
  // ── Text panel: font · size · weight · line height · align · vertical · padding ─
  // In editor layout there is NO sidebar, so this panel is the only place these
  // typographic properties (several of which were previously unreachable) can be
  // set. Every control shows and writes the selected box's current value.
  function openTextPanel(anchor) {
    closeMorePanel();
    const boxes = getBoxes();
    const idx = selIndices(boxes);
    if (!idx.length) return;
    const b = boxes[idx[0]] || {};
    const opt = (v, label, cur) => `<option value="${v}"${String(cur) === v ? ' selected' : ''}>${label}</option>`;
    const fontCur = String(b[cfg.fontField] || 'SUSE');
    const sizeCur = Math.max(1, Math.round(parseFloat(b[cfg.fontSizeField]) || 48));
    const weightCur = String(b[cfg.weightField] || '700');
    const lhRaw = parseFloat(b[cfg.lineHeightField]);
    const lhCur = Number.isFinite(lhRaw) ? lhRaw : 1.12;
    // Defaults here MUST match hooks.js textCss so the panel shows the real rendered
    // value for a box that hasn't set the field yet (pad defaults to 8, not 0).
    const padRaw = parseFloat(b[cfg.padField]);
    const padCur = Math.max(0, Math.round(Number.isFinite(padRaw) ? padRaw : 8));
    const alignCur = String(b[cfg.alignField] || 'center');
    const valignCur = String(b[cfg.valignField] || 'middle');
    const p = document.createElement('div');
    p.className = 'fc-panel fc-text-panel';
    p.innerHTML =
      '<div class="fc-panel-head">Text</div>' +
      (cfg.fontField ? `<label class="fc-row"><span>Font</span><select data-tp="font">${opt('SUSE', 'SUSE Sans', fontCur)}${opt('SUSE Mono', 'SUSE Mono', fontCur)}</select></label>` : '') +
      // Size row now carries the A−/A+ steppers (moved off the object bar) around the number.
      (cfg.fontSizeField ? `<div class="fc-row"><span>Size</span><div class="fc-stepper">
        <button type="button" class="fc-cbtn" data-tp="smaller" title="Smaller" aria-label="Smaller text">A−</button>
        <input type="number" min="4" max="2000" data-tp="size" value="${sizeCur}">
        <button type="button" class="fc-cbtn" data-tp="bigger" title="Bigger" aria-label="Bigger text">A+</button>
      </div></div>` : '') +
      (cfg.weightField ? `<label class="fc-row"><span>Weight</span><select data-tp="weight">${weightChoicesFor(fontCur).map(([v, l]) => opt(v, l, weightCur)).join('')}</select></label>` : '') +
      (cfg.lineHeightField ? `<label class="fc-row"><span>Line height</span><input type="range" min="0.7" max="3" step="0.01" data-tp="lh" value="${lhCur}"><b data-tp-val="lh">${lhCur.toFixed(2)}</b></label>` : '') +
      (cfg.alignField ? `<div class="fc-row"><span>Align</span>${segHtml(cfg.alignField, alignCur, [['left', 'Align left', SVG.textL], ['center', 'Align centre', SVG.textC], ['right', 'Align right', SVG.textR]])}</div>` : '') +
      (cfg.valignField ? `<div class="fc-row"><span>Vertical</span>${segHtml(cfg.valignField, valignCur, [['top', 'Align top', SVG.textT], ['middle', 'Centre vertically', SVG.textM], ['bottom', 'Align bottom', SVG.textB]])}</div>` : '') +
      (cfg.padField ? `<label class="fc-row"><span>Padding</span><input type="range" min="0" max="200" data-tp="pad" value="${padCur}"><b data-tp-val="pad">${padCur}</b></label>` : '');
    p.addEventListener('pointerdown', (e) => e.stopPropagation());
    p.querySelector('[data-tp="smaller"]')?.addEventListener('click', () => { bumpFont(-6); const s = p.querySelector('[data-tp="size"]'); if (s) s.value = String(Math.max(4, (parseInt(s.value, 10) || 48) - 6)); });
    p.querySelector('[data-tp="bigger"]')?.addEventListener('click', () => { bumpFont(6); const s = p.querySelector('[data-tp="size"]'); if (s) s.value = String((parseInt(s.value, 10) || 48) + 6); });
    p.querySelectorAll('select[data-tp]').forEach((sel) => sel.addEventListener('change', () => {
      if (sel.dataset.tp !== 'font') { setField(cfg.weightField, sel.value); return; }
      // Font change: SUSE Mono has no 900 cut, so clamp any Black boxes to 800 in
      // the SAME commit (one undo step), then refresh the weight menu to match.
      const font = sel.value;
      const bx = getBoxes();
      const selSet = new Set(selIndices(bx));
      commit(bx.map((row, k) => {
        if (!selSet.has(k)) return row;
        const nb = { ...row, [cfg.fontField]: font };
        if (cfg.weightField && font === 'SUSE Mono' && (parseInt(nb[cfg.weightField], 10) || 700) > 800) nb[cfg.weightField] = '800';
        return nb;
      }));
      const wSel = p.querySelector('select[data-tp="weight"]');
      if (wSel) {
        const cur = Math.min(parseInt(wSel.value, 10) || 700, font === 'SUSE Mono' ? 800 : 900);
        wSel.innerHTML = weightChoicesFor(font).map(([v, l]) => opt(v, l, String(cur))).join('');
      }
    }));
    p.querySelectorAll('input[type="number"][data-tp]').forEach((inp) => inp.addEventListener('change', () => {
      const v = parseInt(inp.value, 10);
      if (Number.isFinite(v) && v >= 4) setField(cfg.fontSizeField, v);
    }));
    p.querySelectorAll('input[type="range"][data-tp]').forEach((rng) => rng.addEventListener('input', () => {
      const k = rng.dataset.tp;
      const valEl = p.querySelector(`[data-tp-val="${k}"]`);
      if (k === 'lh') { if (valEl) valEl.textContent = (+rng.value).toFixed(2); setField(cfg.lineHeightField, +rng.value); }
      else { if (valEl) valEl.textContent = rng.value; setField(cfg.padField, +rng.value); }
    }));
    wireSegs(p);
    stageEl.appendChild(p);
    morePanel = p;
    const ar = anchor.getBoundingClientRect();
    const sr = stageEl.getBoundingClientRect();
    p.style.left = Math.max(6, Math.min(ar.left - sr.left, sr.width - p.offsetWidth - 8)) + 'px';
    p.style.top = Math.max(6, Math.min(ar.bottom - sr.top + 8, sr.height - p.offsetHeight - 8)) + 'px';
  }
  async function pickImage() {
    if (!cfg.imageField || !host.assets?.pick) return;
    const boxes0 = getBoxes();
    const first = boxes0[selIndices(boxes0)[0]] || {};
    try {
      const ref = await host.assets.pick({
        title: 'Choose an image',
        // No type constraint: boxes take rasters AND vectors — logos and the
        // themable two-colour icons (with the picker's theme strip) included.
        allowUpload: true,
        current: first[cfg.imageField]?.id,
        // A box image that's already a Lolly render surfaces the picker's
        // edit-the-current-tool banner (inputs pre-filled) — the box's only
        // route back into the source tool, since boxes have no Edit badge.
        currentToolUrl: first[cfg.imageField]?.meta?.toolUrl,
        currentToolName: first[cfg.imageField]?.meta?.name,
        // Choosing a Lolly link or a saved creation opens its inputs first so the
        // user can set values (configure → insert), reusing the sidebar's editor.
        editTool,
      });
      if (!ref) return;
      const boxes = getBoxes();
      const sel = new Set(selIndices(boxes));
      commit(boxes.map((b, i) => (sel.has(i) ? { ...b, [cfg.imageField]: ref } : b)));
    } catch { /* user cancelled */ }
  }

  // ── grouping + clip/mask ──────────────────────────────────────────────────────
  function freshGroupId(boxes) {
    const used = new Set(boxes.map((b) => groupOf(b)).filter(Boolean));
    let g;
    do { g = 'g' + Date.now().toString(36).slice(-4) + (idSeq++).toString(36); } while (used.has(g));
    return g;
  }
  function groupSelection() {
    if (!cfg.groupField) return;
    const boxes = getBoxes();
    const idx = selIndices(boxes);
    if (idx.length < 2) return;
    const g = freshGroupId(boxes);
    const set = new Set(idx);
    commit(boxes.map((b, i) => (set.has(i) ? { ...b, [cfg.groupField]: g } : b)));
  }
  function ungroupSelection() {
    if (!cfg.groupField) return;
    const boxes = getBoxes();
    const set = new Set(selIndices(boxes));
    if (!boxes.some((b, i) => set.has(i) && groupOf(b))) return;
    commit(boxes.map((b, i) => (set.has(i) && groupOf(b) ? { ...b, [cfg.groupField]: '' } : b)));
  }
  // Clip: the LOWEST selected box (bottom of the stack) is the mask; every higher
  // selected box is clipped to its shape. They're grouped so the mask + content
  // travel together (Figma-style mask group).
  function clipSelection() {
    if (!cfg.clipField) return;
    const boxes = getBoxes();
    const idx = selIndices(boxes).slice().sort((a, b) => a - b);
    if (idx.length < 2) return;
    const maskId = idOf(boxes[idx[0]], idx[0]);
    const clipSet = new Set(idx.slice(1));
    const allSet = new Set(idx);
    const g = cfg.groupField ? freshGroupId(boxes) : '';
    commit(boxes.map((b, i) => {
      if (!allSet.has(i)) return b;
      const nb = { ...b };
      if (clipSet.has(i)) nb[cfg.clipField] = maskId;
      if (cfg.groupField) nb[cfg.groupField] = g;
      return nb;
    }));
  }
  function releaseClip() {
    if (!cfg.clipField) return;
    const boxes = getBoxes();
    const set = new Set(selIndices(boxes));
    if (!boxes.some((b, i) => set.has(i) && b[cfg.clipField])) return;
    commit(boxes.map((b, i) => (set.has(i) && b[cfg.clipField] ? { ...b, [cfg.clipField]: '' } : b)));
  }
  const selHasGroup = () => { const bx = getBoxes(); return selIndices(bx).some((i) => groupOf(bx[i])); };
  const selHasClip = () => { const bx = getBoxes(); return cfg.clipField && selIndices(bx).some((i) => bx[i][cfg.clipField]); };

  // ── z-order / align / distribute ─────────────────────────────────────────────
  function applyZ(op) {
    const boxes = getBoxes();
    const idx = selIndices(boxes);
    if (!idx.length) return;
    commit(reorderZ(boxes, idx, op));
  }
  function applyAlign(edge) {
    const boxes = getBoxes();
    const idx = selIndices(boxes);
    if (!idx.length) return;
    commit(alignBoxes(boxes, idx, edge, cfg, canvasWH()));
  }
  function applyDistribute(axis) {
    const boxes = getBoxes();
    const idx = selIndices(boxes);
    if (idx.length < 3) return;
    commit(distributeBoxes(boxes, idx, axis, cfg));
  }

  function duplicateSelection() {
    const boxes = getBoxes();
    const idx = selIndices(boxes);
    if (!idx.length) return;
    const clones = [];
    const nextSel = new Set();
    let pool = boxes.slice();
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
  function deleteSelection() {
    const boxes = getBoxes();
    const sel = new Set(selIndices(boxes));
    if (!sel.size) return;
    selection = new Set();
    commit(boxes.filter((_, i) => !sel.has(i)));
  }

  // ── create-mode arming ───────────────────────────────────────────────────────
  function armCreate(kind) {
    armedKind = kind;
    stageEl.classList.add('fc-arming');
    toolbar.querySelector('.fc-btn-add')?.classList.add('is-armed');
  }
  function disarm() {
    armedKind = null;
    stageEl.classList.remove('fc-arming');
    toolbar.querySelector('.fc-btn-add')?.classList.remove('is-armed');
  }

  // ── pointer gestures on the canvas ───────────────────────────────────────────
  function beginGesture(e, g) {
    try { canvasEl.setPointerCapture(e.pointerId); } catch { /* older browsers */ }
    gesture = { ...g, pointerId: e.pointerId, startClient: { x: e.clientX, y: e.clientY } };
    document.body.classList.add('fc-manipulating');
  }
  function endGesture() {
    document.body.classList.remove('fc-manipulating');
    gesture = null;
    rubber.hidden = true;
    clearGuides();
  }

  // ── inline text editing (double-click a box) ─────────────────────────────────
  // WYSIWYG rich text: the box's rendered markup is edited in place, and a
  // floating format bar offers bold/italic/bullets (selection-level, via the
  // rich-text.js char model) plus alignment/weight/size (box-level, staged in
  // editing.pending and committed with the text as one undo step).
  let fmtbar = null;

  function onDblClick(e) {
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
  // A box element only exists after a foreground paint (rAF-gated), so a freshly
  // created box needs us to wait a few frames before we can focus its text.
  function editAfterPaint(id, opts, tries = 8) {
    if (disposed) return;
    const el = canvasEl.querySelector(`.lolly-box[data-box-id="${cssEscape(id)}"] .lolly-box-text`);
    if (el) { startTextEdit(id, opts); return; }
    if (tries > 0) requestAnimationFrame(() => editAfterPaint(id, opts, tries - 1));
  }
  function startTextEdit(id, opts = {}) {
    if (editing) commitTextEdit();
    const el = canvasEl.querySelector(`.lolly-box[data-box-id="${cssEscape(id)}"] .lolly-box-text`);
    if (!el) return;
    const boxEl = el.closest('.lolly-box');
    // WYSIWYG: edit the RENDERED rich text in place (the element already holds
    // hooks.js richText output — <strong>/<em> runs, \n line breaks, "•  "
    // bullets). Formatting ops round-trip through the rich-text.js char model,
    // and commit serialises back to the stored markdown-subset source.
    // `pending` collects box-field changes (align/weight/size/…) made from the
    // format bar mid-edit; they preview as inline styles and land in the SAME
    // commit as the text, so the whole edit stays one undo step.
    editing = {
      id, el, boxEl,
      prevHtml: el.innerHTML,
      prevStyle: el.style.cssText,
      prevBoxStyle: boxEl ? boxEl.style.cssText : '',
      pending: {},
    };
    chrome.innerHTML = '';       // hide handles while typing
    ctxbar.hidden = true;
    closeMorePanel(); closePopover();
    boxEl?.classList.add('fc-box-editing');   // reveal overflow so typing stays visible
    el.setAttribute('contenteditable', 'true');
    el.setAttribute('role', 'textbox');
    el.setAttribute('aria-label', 'Edit text');
    el.classList.add('fc-editing');
    el.focus();
    // Select-all when replacing a create-seed ("Text") so the first keystroke wins;
    // otherwise drop the caret at the end for a natural continue-typing feel.
    const range = document.createRange();
    range.selectNodeContents(el);
    if (!opts.selectAll) range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges(); sel.addRange(range);
    el.addEventListener('keydown', onEditKey);
    el.addEventListener('blur', onEditBlur);
    el.addEventListener('paste', onEditPaste);
    document.addEventListener('selectionchange', onEditSelChange);
    showFmtBar();
    positionFmtBar();
    refreshFmtStates();
  }
  function onEditKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); cancelTextEdit(); }
    else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); commitTextEdit(); }
    // Plain Enter inserts a literal \n (the render model is pre-wrap text) —
    // never the browser's <div> soup, which would desync the char model.
    else if (e.key === 'Enter') { e.preventDefault(); document.execCommand('insertText', false, '\n'); }
    else if ((e.key === 'b' || e.key === 'B') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); toggleInline('b'); }
    else if ((e.key === 'i' || e.key === 'I') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); toggleInline('i'); }
    e.stopPropagation();          // keep global Delete/nudge/undo off while typing
  }
  // Paste as plain text: rich clipboard HTML would smuggle arbitrary markup into
  // the editable; \n survives fine under pre-wrap.
  function onEditPaste(e) {
    e.preventDefault();
    e.stopPropagation();
    const text = (e.clipboardData || window.clipboardData)?.getData('text/plain') ?? '';
    if (text) document.execCommand('insertText', false, text);
  }
  function onEditSelChange() {
    if (editing) refreshFmtStates();
  }
  function onEditBlur(e) {
    // Clicking our own format bar preventDefaults focus, so blur shouldn't fire from
    // it — but guard anyway so a stray blur toward the bar never drops the edit.
    if (e && e.relatedTarget && fmtbar && fmtbar.contains(e.relatedTarget)) return;
    commitTextEdit();
  }
  function finishEdit() {
    if (!editing) return null;
    const done = editing; editing = null;
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
    return done;
  }
  // Restore the pre-edit rendered view + inline styles (drops any pending-field
  // live previews the format bar applied during the edit).
  function restoreEditView(done) {
    done.el.innerHTML = done.prevHtml;
    done.el.style.cssText = done.prevStyle;
    if (done.boxEl) done.boxEl.style.cssText = done.prevBoxStyle;
  }
  function commitTextEdit() {
    const done = editing;
    if (!done) return;
    const text = markdownFromChars(charsFromDom(done.el));
    const pending = done.pending || {};
    const boxes = getBoxes();
    const i = indexOfId(boxes, done.id);
    const changedText = i >= 0 && String(boxes[i][cfg.textField] ?? '') !== text;
    const changed = changedText || Object.keys(pending).length > 0;
    // Grow-to-fit — ONLY when the edit actually changed something (so merely
    // opening a box to read it never mutates its height). The box clips overflow
    // in the final render, so if the copy is taller than the box, grow it (only
    // ever grow) to keep it whole. The editable IS the rendered rich text (with
    // any pending size/weight previews already applied), so measure it directly.
    let grownH = null;
    if (changed && cfg.hField && done.boxEl) {
      const needed = Math.ceil(done.el.scrollHeight);
      const boxNativeH = parseFloat(done.boxEl.style.height) || 0;
      if (boxNativeH && needed > boxNativeH + 1) grownH = needed;
    }
    finishEdit();
    if (i < 0) { renderChrome(); return; }
    if (changed) {
      commit(boxes.map((b, k) => {
        if (k !== i) return b;
        const nb = { ...b, ...pending, [cfg.textField]: text };
        if (grownH != null) nb[cfg.hField] = grownH;
        return nb;
      }));
    } else {
      restoreEditView(done);   // nothing changed → restore rendered view
      renderChrome();
    }
  }
  function cancelTextEdit() {
    const done = editing;
    if (!done) return;
    finishEdit();
    restoreEditView(done);     // discard edits, restore rendered view
    renderChrome();
  }

  // ── in-edit formatting: true rich text over the char model ────────────────────
  // The editable's DOM ↔ a flat char array (rich-text.js); the selection maps to
  // [start, end) character offsets. Toggle = parse → flip flags → re-render →
  // restore the selection at the same offsets. BRs count as one \n character.
  function selectionOffsets(el) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return null;
    const range = sel.getRangeAt(0);
    if (!el.contains(range.startContainer) || !el.contains(range.endContainer)) return null;
    const offsetOf = (container, offset) => {
      let n = 0;
      let found = false;
      const walk = (node) => {
        if (found) return;
        if (node.nodeType === 3) {
          if (node === container) { n += Math.min(offset, node.nodeValue.length); found = true; }
          else n += node.nodeValue.length;
          return;
        }
        if (node.nodeName === 'BR') {
          if (node === container) found = true;
          else n += 1;
          return;
        }
        const kids = node.childNodes;
        for (let k = 0; k < kids.length; k++) {
          if (node === container && k === offset) { found = true; return; }
          walk(kids[k]);
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
  function selectOffsets(el, a, b) {
    const idxIn = (node) => Array.prototype.indexOf.call(node.parentNode.childNodes, node);
    const posOf = (target) => {
      let n = 0;
      let out = null;
      const walk = (node) => {
        if (out) return;
        if (node.nodeType === 3) {
          const len = node.nodeValue.length;
          if (n + len >= target) { out = { node, offset: target - n }; return; }
          n += len;
          return;
        }
        if (node.nodeName === 'BR') {
          if (n + 1 > target) out = { node: node.parentNode, offset: idxIn(node) };
          else n += 1;
          return;
        }
        for (const kid of node.childNodes) { walk(kid); if (out) return; }
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
    sel.removeAllRanges(); sel.addRange(range);
  }
  function toggleInline(flag) {
    if (!editing) return;
    const el = editing.el;
    el.focus();
    const off = selectionOffsets(el);
    if (!off) return;
    let [a, b] = off;
    const chars = charsFromDom(el);
    if (a === b) [a, b] = wordRangeAt(chars, a);   // caret → the word under it
    if (a === b) return;
    const next = setFlag(chars, a, b, flag, !rangeHasFlag(chars, a, b, flag));
    el.innerHTML = htmlFromChars(next);
    selectOffsets(el, a, b);
    refreshFmtStates();
  }
  // Toggle "•  " bullets on every non-blank line (a text box is one logical block).
  function toggleBullet() {
    if (!editing) return;
    const el = editing.el;
    el.focus();
    const next = toggleBullets(charsFromDom(el));
    el.innerHTML = htmlFromChars(next);
    selectOffsets(el, next.length, next.length);   // caret to the end
    refreshFmtStates();
  }
  // A field tweak from the format bar mid-edit: preview it as an inline style on
  // the live box (repainting now would destroy the contenteditable) and stash it
  // in `pending` for commitTextEdit to fold into the box row.
  function applyPending(field, value) {
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
    }
    positionFmtBar();
    refreshFmtStates();
  }
  const pendingOr = (field, fallback) =>
    (editing && field && field in editing.pending ? editing.pending[field] : fallback);
  function showFmtBar() {
    if (fmtbar) return;
    fmtbar = document.createElement('div');
    fmtbar.className = 'fc-fmtbar';
    fmtbar.setAttribute('data-export-hide', '');
    const refs = { align: {}, valign: {} };
    const mk = (label, html, run) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'fc-cbtn'; b.title = label; b.setAttribute('aria-label', label);
      b.innerHTML = html;
      // preventDefault on pointerdown keeps the caret/selection in the editable
      // (focus never leaves → the toggle hits the live selection, no blur/commit).
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); });
      b.addEventListener('click', (e) => { e.stopPropagation(); run(); });
      fmtbar.appendChild(b);
      return b;
    };
    const vsep = () => {
      const s = document.createElement('span');
      s.className = 'fc-vsep';
      fmtbar.appendChild(s);
    };
    const boxes = getBoxes();
    const box = boxes[indexOfId(boxes, editing?.id)] || {};
    refs.b = mk('Bold (⌘B)', '<b>B</b>', () => toggleInline('b'));
    refs.i = mk('Italic (⌘I)', '<i style="font-family:serif">I</i>', () => toggleInline('i'));
    refs.bullet = mk('Bullet list', '•', () => toggleBullet());
    // How the copy sits in its box: horizontal + vertical alignment, live.
    if (cfg.alignField) {
      vsep();
      for (const [v, label, ic] of [['left', 'Align left', SVG.textL], ['center', 'Align centre', SVG.textC], ['right', 'Align right', SVG.textR]]) {
        refs.align[v] = mk(label, icon(ic), () => applyPending(cfg.alignField, v));
      }
    }
    if (cfg.valignField) {
      vsep();
      for (const [v, label, ic] of [['top', 'Align to top', SVG.textT], ['middle', 'Centre vertically', SVG.textM], ['bottom', 'Align to bottom', SVG.textB]]) {
        refs.valign[v] = mk(label, icon(ic), () => applyPending(cfg.valignField, v));
      }
    }
    if (cfg.weightField || cfg.fontSizeField) vsep();
    if (cfg.weightField) {
      const sel = document.createElement('select');
      sel.className = 'fc-fmt-weight';
      sel.title = 'Font weight';
      sel.setAttribute('aria-label', 'Font weight');
      const font = String((cfg.fontField && box[cfg.fontField]) || 'SUSE');
      sel.innerHTML = weightChoicesFor(font).map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
      sel.value = String(Math.min(parseInt(box[cfg.weightField], 10) || 700, font === 'SUSE Mono' ? 800 : 900));
      // No preventDefault here — the select needs focus to open; the blur guard
      // in onEditBlur recognises the bar so the edit survives the round trip.
      sel.addEventListener('pointerdown', (e) => e.stopPropagation());
      sel.addEventListener('change', () => applyPending(cfg.weightField, sel.value));
      fmtbar.appendChild(sel);
      refs.weight = sel;
    }
    if (cfg.fontSizeField) {
      mk('Smaller text', 'A−', () => bumpPendingFont(-6));
      mk('Bigger text', 'A+', () => bumpPendingFont(6));
    }
    fmtbar._refs = refs;
    overlay.appendChild(fmtbar);
  }
  function bumpPendingFont(delta) {
    if (!editing || !cfg.fontSizeField) return;
    const boxes = getBoxes();
    const box = boxes[indexOfId(boxes, editing.id)] || {};
    const cur = parseFloat(pendingOr(cfg.fontSizeField, box[cfg.fontSizeField]));
    const base = Number.isFinite(cur) ? cur : 48;
    applyPending(cfg.fontSizeField, Math.max(4, base + delta));
  }
  // Reflect the live state on the bar: B/I from the selection (or the word under
  // the caret), bullets/alignment/weight from the box row + pending overrides.
  function refreshFmtStates() {
    if (!fmtbar || !editing) return;
    const r = fmtbar._refs || {};
    const chars = charsFromDom(editing.el);
    let [a, b] = selectionOffsets(editing.el) || [chars.length, chars.length];
    if (a === b) [a, b] = wordRangeAt(chars, a);
    r.b?.classList.toggle('is-on', rangeHasFlag(chars, a, b, 'b'));
    r.i?.classList.toggle('is-on', rangeHasFlag(chars, a, b, 'i'));
    r.bullet?.classList.toggle('is-on', allBulleted(chars));
    const boxes = getBoxes();
    const box = boxes[indexOfId(boxes, editing.id)] || {};
    const alignCur = String(pendingOr(cfg.alignField, box[cfg.alignField] || 'center'));
    const valignCur = String(pendingOr(cfg.valignField, box[cfg.valignField] || 'middle'));
    for (const [v, btn] of Object.entries(r.align)) btn.classList.toggle('is-on', v === alignCur);
    for (const [v, btn] of Object.entries(r.valign)) btn.classList.toggle('is-on', v === valignCur);
    if (r.weight && document.activeElement !== r.weight) {
      r.weight.value = String(pendingOr(cfg.weightField, box[cfg.weightField] || '700'));
    }
  }
  function hideFmtBar() { fmtbar?.remove(); fmtbar = null; }
  function positionFmtBar() {
    if (!fmtbar || !editing) return;
    const boxes = getBoxes();
    const i = indexOfId(boxes, editing.id);
    if (i < 0) return;
    const m = metrics();
    const aabb = selectionAABB(boxes, [i], cfg);
    if (!aabb) return;
    const tl = nativeToStage(aabb.minX, aabb.minY, m);
    const br = nativeToStage(aabb.maxX, aabb.minY, m);
    const bw = fmtbar.offsetWidth || 0;
    fmtbar.style.left = Math.max(6, Math.min((tl.x + br.x) / 2 - bw / 2, m.sr.width - bw - 6)) + 'px';
    fmtbar.style.top = Math.max(6, tl.y - 44) + 'px';
  }

  function onCanvasPointerDown(e) {
    if (e.button > 0) return;                 // primary button / touch only
    if (editing) {
      if (editing.el.contains(e.target)) return;   // let the caret move within the text
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
        for (const x of hitSel) anyIn ? selection.delete(x) : selection.add(x);
      } else if (!selection.has(id)) {
        selection = new Set(hitSel);
      }
      renderChrome();
      // Start a move for the whole current selection.
      const start = new Map();
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

  function onGestureMove(e) {
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
      let corner = nat;
      const snap = snapPoint(nat.x, nat.y, gesture.others, canvasWH(), snapThreshNative());
      corner = { x: snap.x, y: snap.y };
      drawGuides(snap.guides);
      gesture.corner = corner;
      drawRubber(gesture.origin, corner);
      return;
    }
    if (gesture.type === 'move') {
      let mdx = dxN, mdy = dyN;
      if (gesture.selAABB && !e.altKey) {
        const cand = {
          minX: gesture.selAABB.minX + dxN, minY: gesture.selAABB.minY + dyN,
          maxX: gesture.selAABB.maxX + dxN, maxY: gesture.selAABB.maxY + dyN,
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

  function onGestureEnd(e) {
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
      let rect;
      if (moved < 6) {
        // A tap (no drag) drops a default-sized box centred on the point.
        const w = 320, h = 200;
        rect = { x: g.origin.x - w / 2, y: g.origin.y - h / 2, w, h };
      } else {
        const c = g.corner || nat;
        rect = normDragRect(g.origin.x, g.origin.y, c.x, c.y, minSize);
      }
      const id = freshId(boxes);
      let box = seedBox(cfg, {}, g.seed, rect, id);
      box = clampBoxToCanvas(box, cfg, canvasWH());
      selection = new Set([id]);
      const wasImage = (g.seed?.[cfg.kindField] === 'image') || armedKind?.id === 'image';
      const wasText = (g.seed?.[cfg.kindField] === 'text') || armedKind?.id === 'text';
      disarm();
      endGesture();
      commit([...boxes, box]);
      if (wasImage) setTimeout(() => pickImage(), 0);
      else if (wasText && cfg.textField) editAfterPaint(id, { selectAll: true });
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
  function applyLiveRect(index, r) {
    const boxes = getBoxes();
    const id = idOf(boxes[index], index);
    const el = canvasEl.querySelector(`.lolly-box[data-box-id="${cssEscape(id)}"]`);
    if (!el) return;
    el.style.left = Math.round(r.x) + 'px';
    el.style.top = Math.round(r.y) + 'px';
    el.style.width = Math.max(1, Math.round(r.w)) + 'px';
    el.style.height = Math.max(1, Math.round(r.h)) + 'px';
    el.style.transform = r.rot ? `rotate(${(Math.round(r.rot * 10) / 10)}deg)` : '';
  }

  function drawRubber(origin, nat) {
    const a = nativeToStage(Math.min(origin.x, nat.x), Math.min(origin.y, nat.y));
    const { scale } = metrics();
    rubber.style.left = a.x + 'px';
    rubber.style.top = a.y + 'px';
    rubber.style.width = Math.abs(nat.x - origin.x) * scale + 'px';
    rubber.style.height = Math.abs(nat.y - origin.y) * scale + 'px';
  }

  // ── handle interactions ──────────────────────────────────────────────────────
  function onHandlePointerDown(e, handle) {
    e.stopPropagation();
    if (e.button > 0) return;
    const boxes = getBoxes();
    const idx = selIndices(boxes);
    if (idx.length !== 1) return;
    const index = idx[0];
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
  function otherAABBs(boxes, exclude) {
    const out = [];
    for (let i = 0; i < boxes.length; i++) if (!exclude.has(i)) out.push(boxAABB(boxes[i], cfg));
    return out;
  }
  const snapThreshNative = () => SNAP_PX / (metrics().scale || 1);

  function drawGuides(list) {
    guidesEl.innerHTML = '';
    if (!list || !list.length) return;
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
  const clearGuides = () => { guidesEl.innerHTML = ''; };

  // ── overlay rendering ─────────────────────────────────────────────────────────
  let syncScheduled = false;
  function scheduleSync() {
    if (syncScheduled || disposed) return;
    syncScheduled = true;
    requestAnimationFrame(() => { syncScheduled = false; if (!gesture || gesture.type === 'tap') renderChrome(); });
  }

  // During a gesture, reposition chrome from the live DOM (which we just mutated).
  function renderChromeLive() {
    const boxes = getBoxes();
    const rects = new Map();
    for (const i of selIndices(boxes)) {
      const id = idOf(boxes[i], i);
      const el = canvasEl.querySelector(`.lolly-box[data-box-id="${cssEscape(id)}"]`);
      if (el) rects.set(i, {
        x: parseFloat(el.style.left) || 0, y: parseFloat(el.style.top) || 0,
        w: parseFloat(el.style.width) || 1, h: parseFloat(el.style.height) || 1,
        rot: rotOf(el),
      });
    }
    paintChrome(boxes, rects);
  }

  function renderChrome() {
    const boxes = getBoxes();
    paintChrome(boxes, null);
  }

  function paintChrome(boxes, liveRects) {
    // While editing text, suppress selection chrome + ctxbar; just keep the floating
    // format bar tracking the box as the stage pans/zooms.
    if (editing) { chrome.innerHTML = ''; ctxbar.hidden = true; positionFmtBar(); return; }
    // outlines + handles
    chrome.innerHTML = '';
    const idx = selIndices(boxes);
    const m = metrics();
    for (const i of idx) {
      const r = (liveRects && liveRects.get(i)) || boxRect(boxes[i], cfg);
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
    if (idx.length === 1) {
      const r = (liveRects && liveRects.get(idx[0])) || boxRect(boxes[idx[0]], cfg);
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

  function addHandles(r, m) {
    const box = { [cfg.xField]: r.x, [cfg.yField]: r.y, [cfg.wField]: r.w, [cfg.hField]: r.h, [cfg.rotationField]: r.rot };
    const corners = boxCorners(box, cfg).map((p) => nativeToStage(p.x, p.y, m)); // TL,TR,BR,BL
    const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    const pos = {
      nw: corners[0], ne: corners[1], se: corners[2], sw: corners[3],
      n: mid(corners[0], corners[1]), e: mid(corners[1], corners[2]),
      s: mid(corners[2], corners[3]), w: mid(corners[3], corners[0]),
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
  function groupAABBNative(idx, boxes, liveRects) {
    let a = null;
    for (const i of idx) {
      const r = (liveRects && liveRects.get(i)) || boxRect(boxes[i], cfg);
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
  function addGroupHandles(a, m) {
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
    for (const name of ['nw', 'ne', 'se', 'sw']) {
      const el = document.createElement('div');
      el.className = 'fc-handle fc-h-' + name;
      el.style.left = corners[name].x + 'px';
      el.style.top = corners[name].y + 'px';
      el.addEventListener('pointerdown', (e) => onGroupHandleDown(e, name));
      chrome.appendChild(el);
    }
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

  const CORNER_PT = (a, name) => ({
    nw: { x: a.minX, y: a.minY }, ne: { x: a.maxX, y: a.minY },
    se: { x: a.maxX, y: a.maxY }, sw: { x: a.minX, y: a.maxY },
  }[name]);
  const OPPOSITE = { nw: 'se', ne: 'sw', se: 'nw', sw: 'ne' };

  function onGroupHandleDown(e, name) {
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
      const origDist = Math.hypot(CORNER_PT(a, name).x - anchor.x, CORNER_PT(a, name).y - anchor.y) || 1;
      beginGesture(e, { type: 'gscale', sel, startBoxes: boxes, anchor, origDist });
    }
  }

  function positionCtxBar(boxes, idx, liveRects, m) {
    if (editing) { ctxbar.hidden = true; return; }   // hidden while typing in a box
    ctxbar.hidden = false;
    // Position above the selection's union AABB.
    const aabb = selectionAABB(boxes.map((b, i) => (liveRects?.get(i) ? rectAsBox(liveRects.get(i)) : b)), idx, cfg);
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
    const first = boxes[idx[0]];
    const r = liveRects?.get(idx[0]) || boxRect(first, cfg);
    const read = ctxbar.querySelector('[data-cx-readout]');
    if (read) read.textContent = idx.length > 1
      ? `${idx.length} selected`
      : `${Math.round(r.x)}, ${Math.round(r.y)}  ·  ${Math.round(r.w)}×${Math.round(r.h)}${r.rot ? '  ·  ' + Math.round(r.rot) + '°' : ''}`;
  }

  function updateToolbarState(count) {
    // Nothing hard-disabled — align-to-canvas works on a single box; arrange/delete
    // no-op when empty. Just reflect the armed state.
    toolbar.querySelector('.fc-btn-add')?.classList.toggle('is-armed', !!armedKind);
  }

  // ── helpers ───────────────────────────────────────────────────────────────────
  const kindOf = (b) => (b && b[cfg.kindField]) || 'box';
  const rectAsBox = (r) => ({ [cfg.xField]: r.x, [cfg.yField]: r.y, [cfg.wField]: r.w, [cfg.hField]: r.h, [cfg.rotationField]: r.rot });
  function rotOf(el) {
    const t = el.style.transform || '';
    const mm = t.match(/rotate\(([-0-9.]+)deg\)/);
    return mm ? parseFloat(mm[1]) : 0;
  }
  function normHex(v, fallback = '#ffffff') {
    const s = String(v == null ? '' : v).trim();
    if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase();
    if (/^#[0-9a-fA-F]{3}$/.test(s)) return ('#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3]).toLowerCase();
    return fallback;
  }
  function cssEscape(s) {
    return (window.CSS && CSS.escape) ? CSS.escape(s) : String(s).replace(/["\\]/g, '\\$&');
  }
  // Finite number clamped to [lo,hi], or the default when not a number.
  function clampN(v, dflt, lo, hi) {
    const n = typeof v === 'number' ? v : parseFloat(v);
    if (!Number.isFinite(n)) return dflt;
    return n < lo ? lo : (n > hi ? hi : n);
  }
  const HTML_ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
  function escapeHtml(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => HTML_ESC[c]); }
  function fmtDate(iso) {
    try { return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); }
    catch { return String(iso); }
  }

  // ── keyboard ─────────────────────────────────────────────────────────────────
  function typingTarget() {
    const el = document.activeElement;
    if (!el) return false;
    const t = el.tagName;
    return t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT' || el.isContentEditable;
  }
  function onKey(e) {
    if (disposed) return;
    if (e.key === 'Escape') { if (armedKind) { disarm(); } else if (selection.size) { selection = new Set(); renderChrome(); } closePopover(); return; }
    if (typingTarget()) return;
    // Enter / F2 on a selected box → edit its text (select-all so typing replaces it).
    if ((e.key === 'Enter' || e.key === 'F2') && !editing && selection.size && cfg.textField) {
      e.preventDefault();
      startTextEdit([...selection][0], { selectAll: e.key === 'Enter' });
      return;
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && selection.size) { e.preventDefault(); deleteSelection(); return; }
    if ((e.key === 'd' || e.key === 'D') && (e.metaKey || e.ctrlKey) && selection.size) { e.preventDefault(); duplicateSelection(); return; }
    if ((e.key === 'g' || e.key === 'G') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); e.shiftKey ? ungroupSelection() : groupSelection(); return; }
    // Stacking order (Illustrator/Figma convention): Cmd/Ctrl + ] forward, + [ back;
    // add Shift to jump all the way to front / back. (Undo/redo is handled globally
    // by tool.js's onHistoryKey — Cmd+Z / Cmd+Shift+Z / Cmd+Y — and reaches the editor
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
    // Arrow-nudge (Shift = 10px).
    const nudges = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (nudges[e.key] && selection.size) {
      e.preventDefault();
      const step = (e.shiftKey ? 10 : 1);
      const [ux, uy] = nudges[e.key];
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
  // While the editor is mounted, un-clip the canvas (and the tool's own clipping
  // root inside it) so boxes dragged off the artboard stay visible + selectable —
  // their DOM still lives inside canvasEl, so clicks bubble to the handlers above.
  // Export semantics are unchanged: the raster capture is bounded by the canvas
  // rect, and the vector walkers' out-of-viewBox geometry never paints.
  canvasEl.classList.add('fc-open-canvas');
  window.addEventListener('keydown', onKey);
  // Reposition chrome when the stage pans/zooms/resizes.
  const onStageMove = () => scheduleSync();
  stageEl.addEventListener('pointermove', onStageMove, { passive: true });
  stageEl.addEventListener('wheel', onStageMove, { passive: true });
  window.addEventListener('resize', onStageMove);
  const ro = new ResizeObserver(onStageMove);
  ro.observe(stageEl);
  // Keyboard/HUD zoom (setupStageNav's − / + / 0 / 1 / Fit) changes the canvas
  // wrapper's transform with NO pointer or wheel event — watch the wrapper's
  // style attribute so the selection chrome follows those zooms too.
  const mo = new MutationObserver(onStageMove);
  if (canvasEl.parentElement) mo.observe(canvasEl.parentElement, { attributes: true, attributeFilter: ['style'] });
  // Re-sync after every model change (paint()).
  const unsub = runtime.subscribe(() => scheduleSync());
  // Dismiss popover / more-panel on outside click.
  const onDocDown = (e) => {
    if (popover && !popover.contains(e.target)) closePopover();
    if (morePanel && !morePanel.contains(e.target) && !e.target.closest?.('[data-cx="more"],[data-cx="text"]')) closeMorePanel();
  };
  document.addEventListener('pointerdown', onDocDown, true);

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
      mo.disconnect();
      unsub?.();
      canvasEl.classList.remove('fc-open-canvas');
      overlay.remove(); toolbarDock.remove(); closePopover(); closeMorePanel();
      document.body.classList.remove('fc-manipulating');
    },
  };
}
