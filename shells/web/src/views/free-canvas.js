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
  snapMove, snapPoint,
} from './free-canvas-math.js';
import { colorFieldHtml, wireColorField } from '../components/color-field.js';

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
};

function icon(paths) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

export function initFreeCanvas(opts) {
  const { viewEl, stageEl, canvasEl, runtime, host, input, nativeW, nativeH, onDirty, editTool } = opts;
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
    weightField: cv.weightField, kindField: 'kind',
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
    const scale = cr.width / nativeW || 1;
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
  buildToolbar();

  // ── toolbar ─────────────────────────────────────────────────────────────────
  let popover = null;
  function closePopover() { popover?.remove(); popover = null; }

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
    const add = toolBtn('Add a box', SVG.add, () => openAddMenu(add), 'fc-btn-add');
    if (armedKind) add.classList.add('is-armed');
    toolBtn('Arrange (stacking order)', SVG.front, () => openArrangeMenu());
    toolBtn('Align & distribute', SVG.align, () => openAlignMenu());
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

  function spawnPopover(anchor, items) {
    closePopover();
    popover = document.createElement('div');
    popover.className = 'fc-popover';
    for (const it of items) {
      if (it.sep) { const s = document.createElement('div'); s.className = 'fc-pop-sep'; popover.appendChild(s); continue; }
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'fc-pop-item';
      b.innerHTML = (it.icon ? `<span class="fc-pop-ic">${it.icon}</span>` : '') + `<span>${it.label}</span>`;
      b.addEventListener('click', (e) => { e.stopPropagation(); it.run(); if (!it.keepOpen) closePopover(); });
      popover.appendChild(b);
    }
    popover.addEventListener('pointerdown', (e) => e.stopPropagation());
    stageEl.appendChild(popover);
    const ar = anchor.getBoundingClientRect();
    const sr = stageEl.getBoundingClientRect();
    popover.style.left = (ar.right - sr.left + 8) + 'px';
    popover.style.top = Math.max(6, ar.top - sr.top) + 'px';
  }

  function openAddMenu(anchor) {
    spawnPopover(anchor, addKinds.map((k) => ({
      label: k.label || k.id,
      icon: icon(k.id === 'image' ? SVG.image : SVG.add),
      run: () => armCreate(k),
    })));
  }
  function openArrangeMenu() {
    const has = selection.size > 0;
    const mk = (label, op) => ({ label, run: () => has && applyZ(op) });
    spawnPopover(toolbar.children[1], [
      mk('Bring to front', 'front'), mk('Bring forward', 'forward'),
      mk('Send backward', 'backward'), mk('Send to back', 'back'),
    ]);
  }
  function openAlignMenu() {
    const mk = (label, fn) => ({ label, run: fn });
    spawnPopover(toolbar.children[2], [
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
  function rebuildCtxBar(boxes, idx) {
    closeMorePanel();
    const first = boxes[idx[0]] || {};
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
    ctxbar.querySelectorAll('[data-cx]').forEach((b) => b.addEventListener('click', (e) => {
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
  let morePanel = null;
  function closeMorePanel() { morePanel?.remove(); morePanel = null; }
  function openMorePanel(anchor) {
    closeMorePanel();
    const boxes = getBoxes();
    const idx = selIndices(boxes);
    if (!idx.length) return;
    const b = boxes[idx[0]] || {};
    const opt = (v, label, cur) => `<option value="${v}"${String(cur) === v ? ' selected' : ''}>${label}</option>`;
    const shapeCur = b[cfg.shapeField] || 'rect';
    const fitCur = b[cfg.fitField] || 'cover';
    const blendCur = b[cfg.blendField] || 'normal';
    const radiusCur = Math.max(0, Math.round(parseFloat(b[cfg.radiusField]) || 0));
    const opacityCur = Math.round(parseFloat(b[cfg.opacityField]) ?? 100);
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
        ${['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'].map((m) => opt(m, m[0].toUpperCase() + m.slice(1).replace('-', ' '), blendCur)).join('')}
      </select></label>` : ''}`;
    p.addEventListener('pointerdown', (e) => e.stopPropagation());
    p.querySelectorAll('select[data-mp]').forEach((sel) => sel.addEventListener('change', () => {
      const key = sel.dataset.mp;
      setField(key === 'shape' ? cfg.shapeField : key === 'fit' ? cfg.fitField : cfg.blendField, sel.value);
    }));
    p.querySelectorAll('input[data-mp]').forEach((rng) => rng.addEventListener('input', () => {
      const key = rng.dataset.mp;
      const valEl = p.querySelector(`[data-mp-val="${key}"]`);
      if (valEl) valEl.textContent = rng.value;
      setField(key === 'radius' ? cfg.radiusField : cfg.opacityField, Number(rng.value));
    }));
    stageEl.appendChild(p);
    morePanel = p;
    const ar = anchor.getBoundingClientRect();
    const sr = stageEl.getBoundingClientRect();
    p.style.left = Math.min(ar.left - sr.left, sr.width - p.offsetWidth - 8) + 'px';
    p.style.top = (ar.bottom - sr.top + 8) + 'px';
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
  const ALIGN_CYCLE = ['left', 'center', 'right'];
  function cycleAlign() {
    if (!cfg.alignField) return;
    const boxes = getBoxes();
    const sel = new Set(selIndices(boxes));
    const first = boxes.find((b, i) => sel.has(i));
    const cur = ALIGN_CYCLE.indexOf(first?.[cfg.alignField]);
    const next = ALIGN_CYCLE[(cur + 1) % ALIGN_CYCLE.length] || 'center';
    commit(boxes.map((b, i) => (sel.has(i) ? { ...b, [cfg.alignField]: next } : b)));
  }
  const WEIGHT_CYCLE = ['400', '600', '700', '800'];
  function cycleWeight() {
    if (!cfg.weightField) return;
    const boxes = getBoxes();
    const sel = new Set(selIndices(boxes));
    const first = boxes.find((b, i) => sel.has(i));
    const cur = WEIGHT_CYCLE.indexOf(String(first?.[cfg.weightField]));
    const next = WEIGHT_CYCLE[(cur + 1) % WEIGHT_CYCLE.length] || '700';
    commit(boxes.map((b, i) => (sel.has(i) ? { ...b, [cfg.weightField]: next } : b)));
  }
  async function pickImage() {
    if (!cfg.imageField || !host.assets?.pick) return;
    const boxes0 = getBoxes();
    const first = boxes0[selIndices(boxes0)[0]] || {};
    try {
      const ref = await host.assets.pick({
        title: 'Choose an image',
        type: 'raster',
        allowUpload: true,
        current: first[cfg.imageField]?.id,
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
    commit(alignBoxes(boxes, idx, edge, cfg, { w: nativeW, h: nativeH }));
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
  function startTextEdit(id) {
    if (editing) commitTextEdit();
    const el = canvasEl.querySelector(`.lolly-box[data-box-id="${cssEscape(id)}"] .lolly-box-text`);
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
    sel.removeAllRanges(); sel.addRange(range);
    el.addEventListener('keydown', onEditKey);
    el.addEventListener('blur', onEditBlur);
  }
  function onEditKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); cancelTextEdit(); }
    else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitTextEdit(); }
    e.stopPropagation();          // keep global Delete/nudge/undo off while typing
  }
  function onEditBlur() { commitTextEdit(); }
  function finishEdit() {
    if (!editing) return null;
    const done = editing; editing = null;
    done.el.removeEventListener('keydown', onEditKey);
    done.el.removeEventListener('blur', onEditBlur);
    done.el.removeAttribute('contenteditable');
    done.el.classList.remove('fc-editing');
    return done;
  }
  function commitTextEdit() {
    const done = finishEdit();
    if (!done) return;
    const text = done.el.innerText.replace(/ /g, ' ').replace(/\n$/, '');
    const boxes = getBoxes();
    const i = indexOfId(boxes, done.id);
    if (i >= 0 && String(boxes[i][cfg.textField] ?? '') !== text) {
      commit(boxes.map((b, k) => (k === i ? { ...b, [cfg.textField]: text } : b)));
    } else renderChrome();
  }
  function cancelTextEdit() {
    const done = finishEdit();
    if (!done) return;
    done.el.textContent = done.prev;
    renderChrome();
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
      if (additive) { selection.has(id) ? selection.delete(id) : selection.add(id); }
      else if (!selection.has(id)) { selection = new Set([id]); }
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
      const snap = snapPoint(nat.x, nat.y, gesture.others, { w: nativeW, h: nativeH }, snapThreshNative());
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
        const snap = snapMove(cand, gesture.others, { w: nativeW, h: nativeH }, snapThreshNative());
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
        const snap = snapPoint(nat.x, nat.y, gesture.others, { w: nativeW, h: nativeH }, snapThreshNative());
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
      box = clampBoxToCanvas(box, cfg, { w: nativeW, h: nativeH });
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
    if ((e.key === 'Delete' || e.key === 'Backspace') && selection.size) { e.preventDefault(); deleteSelection(); return; }
    if ((e.key === 'd' || e.key === 'D') && (e.metaKey || e.ctrlKey) && selection.size) { e.preventDefault(); duplicateSelection(); return; }
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
  window.addEventListener('keydown', onKey);
  // Reposition chrome when the stage pans/zooms/resizes.
  const onStageMove = () => scheduleSync();
  stageEl.addEventListener('pointermove', onStageMove, { passive: true });
  stageEl.addEventListener('wheel', onStageMove, { passive: true });
  window.addEventListener('resize', onStageMove);
  const ro = new ResizeObserver(onStageMove);
  ro.observe(stageEl);
  // Re-sync after every model change (paint()).
  const unsub = runtime.subscribe(() => scheduleSync());
  // Dismiss popover / more-panel on outside click.
  const onDocDown = (e) => {
    if (popover && !popover.contains(e.target)) closePopover();
    if (morePanel && !morePanel.contains(e.target) && !e.target.closest?.('[data-cx="more"]')) closeMorePanel();
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
      window.removeEventListener('keydown', onKey);
      stageEl.removeEventListener('pointermove', onStageMove);
      stageEl.removeEventListener('wheel', onStageMove);
      window.removeEventListener('resize', onStageMove);
      document.removeEventListener('pointerdown', onDocDown, true);
      ro.disconnect();
      unsub?.();
      overlay.remove(); toolbarDock.remove(); closePopover(); closeMorePanel();
      document.body.classList.remove('fc-manipulating');
    },
  };
}
