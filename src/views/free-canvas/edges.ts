// SPDX-License-Identifier: MPL-2.0
/**
 * free-canvas: connector edges - hit testing, hover, selection and the edge panel.
 *
 * Every function takes the shared `fc: FcCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `fc.<module>.<fn>`. Extracted verbatim
 * from initFreeCanvas() by scripts/split-closure.ts.
 */
import { edgeWaypoints, roundedEdgePath, smoothEdgePath } from '../free-canvas-math.ts';
import type { Box } from '../free-canvas-math.ts';
import { segHtml, wireSegs } from '../free-canvas-fields.ts';
import type { InputValue } from '../../../../../engine/src/inputs.ts';
import { escape as escapeText } from '../../utils.ts';
import { t } from '../../i18n.ts';
import { colorFieldHtml, wireColorField } from '../../components/color-field.ts';
import { SVG, icon } from '../free-canvas-icons.ts';
import type { Point, Rect } from './shared.ts';
import { bindOp, type FcCtx } from './context.ts';

// ── connectors (opt-in via canvas.connect) ───────────────────────────────────
// The overlay authors edges into a SEPARATE blocks input; the tool's hooks.js reads
// {from,to} + current box geometry and draws the routed line. Deleting a box leaves
// its edges in the data but they render to nothing (the hook skips unresolved ids),
// so undo restores a box AND its lines in one step.
export const getEdges = (fc: FcCtx): Box[] => {
  const { connectCfg, runtime } = fc;
  if (!connectCfg) return [];
  const e = runtime.getModel().find((i) => i.id === connectCfg.input);
  return Array.isArray(e?.value) ? e!.value : [];
};
export function commitEdges(fc: FcCtx, next: Box[]): void {
  const { connectCfg, onDirty, runtime } = fc;
  if (!connectCfg) return;
  onDirty?.(connectCfg.input);
  runtime.setInput(connectCfg.input, next);
}
// ── connector inspector (click a line → edit its bend / thickness / colour) ────
// Connectors render in the tool's #tool-canvas svg (pointer-events:none) BEHIND the
// cards, so the overlay hit-tests them itself: on a click that misses every box, the
// nearest connector polyline within a small screen-px band is selected.
export const edgeById = (fc: FcCtx, eid: string): Box | null =>
  { const { cfg } = fc; return getEdges(fc).find((e) => e && String(e[cfg.idField]) === eid) || null; };
export function distToSeg(_fc: FcCtx, px: number, py: number, a: Point, b: Point): number {
  const vx = b.x - a.x,
    vy = b.y - a.y,
    L2 = vx * vx + vy * vy;
  const t = L2 > 0 ? Math.max(0, Math.min(1, ((px - a.x) * vx + (py - a.y) * vy) / L2)) : 0;
  return Math.hypot(px - (a.x + vx * t), py - (a.y + vy * t));
}
export function polylineDist(fc: FcCtx, px: number, py: number, pts: Point[]): number {
  let d = Infinity;
  for (let i = 0; i < pts.length - 1; i++)
    d = Math.min(d, distToSeg(fc, px, py, pts[i]!, pts[i + 1]!));
  return d;
}
export function polylineMid(_fc: FcCtx, pts: Point[]): Point {
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
export const edgeStyleOf = (fc: FcCtx, e: Box): string =>
  { const { connectCfg } = fc; return String(
    (connectCfg?.styleField && e[connectCfg.styleField]) || connectCfg?.defaultStyle || 'elbow'
  ); };
export const edgeWidthOf = (fc: FcCtx, e: Box): number =>
  { const { connectCfg } = fc; return fc.keys.clampN(
    connectCfg?.widthField ? e[connectCfg.widthField] : undefined,
    connectCfg?.defaultWidth ?? 2.5,
    0.5,
    20
  ); };
export function edgePts(fc: FcCtx, e: Box): Point[] | null {
  const { connectCfg } = fc;
  if (!connectCfg) return null;
  const boxes = fc.select.getBoxes();
  const a = fc.connectors.boxRectById(boxes, String(e[connectCfg.fromField!])),
    b = fc.connectors.boxRectById(boxes, String(e[connectCfg.toField!]));
  return a && b ? edgeWaypoints(a, b, edgeStyleOf(fc, e)) : null;
}
// The connector id nearest to a native point, within ~9 screen px. null if none.
export function edgeAt(fc: FcCtx, x: number, y: number): string | null {
  const { cfg, connectCfg } = fc;
  if (!connectCfg) return null;
  const thresh = 9 / (fc.stage.metrics().scale || 1);
  let best: { id: string; d: number } | null = null;
  for (const e of getEdges(fc)) {
    if (!e) continue;
    const id = String(e[cfg.idField] ?? '');
    if (!id) continue;
    const pts = edgePts(fc, e);
    if (!pts) continue;
    const d = polylineDist(fc, x, y, pts);
    if (d <= thresh && (!best || d < best.d)) best = { id, d };
  }
  return best ? best.id : null;
}
// Hover affordance: a pointer cursor + a faint highlight when the cursor is over a
// connector line, so the (pointer-events:none) lines read as selectable. rAF-throttled
// so the edgeAt hit-test never runs more than once per frame.
export function updateHover(fc: FcCtx): void {
  const { connectCfg } = fc;
  fc.hoverRaf = 0;
  if (!connectCfg || fc.selectedEdges.size || fc.gesture || !fc.lastPointer) {
    setHoverEdge(fc, null);
    return;
  }
  const nat = fc.stage.clientToNative(fc.lastPointer.x, fc.lastPointer.y);
  setHoverEdge(fc, edgeAt(fc, nat.x, nat.y));
}
export function setHoverEdge(fc: FcCtx, id: string | null): void {
  const { connectLayer, stageEl } = fc;
  if (id === fc.hoverEdge) return;
  fc.hoverEdge = id;
  stageEl.style.cursor = id ? 'pointer' : '';
  if (id) {
    const e = edgeById(fc, id);
    const pts = e && edgePts(fc, e);
    if (e && pts) {
      const w = edgeWidthOf(fc, e);
      const d =
        edgeStyleOf(fc, e) === 'curved'
          ? smoothEdgePath(pts)
          : roundedEdgePath(pts, Math.min(16, w * 4 + 6));
      fc.connectors.placeConnectLayer(fc.stage.metrics());
      connectLayer.innerHTML = `<path d="${d}" fill="none" stroke="#30ba78" stroke-width="${fc.connectors.cf2(w + 6)}" stroke-linejoin="round" stroke-linecap="round" opacity="0.18"/>`;
      connectLayer.style.display = '';
    }
  } else if (!fc.selectedEdges.size) {
    fc.connectors.hideConnectLayer();
  }
}
// The "primary" selected edge - drives the panel's displayed values + placement.
export function primaryEdgeId(fc: FcCtx): string | null {
  for (const id of fc.selectedEdges) return id;
  return null;
}
// Geometry for marquee edge-hit: does a connector's polyline overlap the drag rect?
export function pointInRect(_fc: FcCtx, x: number, y: number, r: Rect): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}
export function segsCross(_fc: FcCtx, p1: Point, p2: Point, p3: Point, p4: Point): boolean {
  const d = (a: Point, b: Point, c: Point): number =>
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const d1 = d(p3, p4, p1),
    d2 = d(p3, p4, p2),
    d3 = d(p1, p2, p3),
    d4 = d(p1, p2, p4);
  return d1 > 0 !== d2 > 0 && d3 > 0 !== d4 > 0;
}
export function polylineInRect(fc: FcCtx, pts: Point[], r: Rect): boolean {
  for (const p of pts) if (pointInRect(fc, p.x, p.y, r)) return true; // an endpoint inside
  const c = [
    { x: r.x, y: r.y },
    { x: r.x + r.w, y: r.y },
    { x: r.x + r.w, y: r.y + r.h },
    { x: r.x, y: r.y + r.h },
  ];
  for (let i = 0; i < pts.length - 1; i++)
    for (let j = 0; j < 4; j++)
      if (segsCross(fc, pts[i]!, pts[i + 1]!, c[j]!, c[(j + 1) % 4]!)) return true; // a segment crossing a side
  return false;
}
export function edgesInRect(fc: FcCtx, r: Rect): string[] {
  const { cfg, connectCfg } = fc;
  if (!connectCfg) return [];
  const ids: string[] = [];
  for (const e of getEdges(fc)) {
    if (!e) continue;
    const id = String(e[cfg.idField] ?? '');
    const pts = id && edgePts(fc, e);
    if (pts && polylineInRect(fc, pts, r)) ids.push(id);
  }
  return ids;
}
// Select a connector. `additive` (shift/⌘-click) toggles it in the current set;
// otherwise it becomes the sole selection. Either way it clears the card selection -
// a marquee is what mixes cards + connectors (see the marquee gesture end).
export function selectEdge(fc: FcCtx, eid: string, additive?: boolean): void {
  setHoverEdge(fc, null);
  if (additive && fc.selectedEdges.size) {
    if (fc.selectedEdges.has(eid)) fc.selectedEdges.delete(eid);
    else fc.selectedEdges.add(eid);
    if (!fc.selectedEdges.size) {
      deselectEdge(fc);
      return;
    }
  } else {
    fc.selectedEdges = new Set([eid]);
  }
  fc.selection = new Set<string>(); // a connector and a card can't be selected by a plain click
  fc.chromeSync.renderChrome(); // clear any card chrome + draw the highlight(s)
  openEdgePanel(fc); // rebuild (count / values may have changed)
}
export function deselectEdge(fc: FcCtx): void {
  if (!fc.selectedEdges.size && !fc.edgePanel) return;
  fc.selectedEdges = new Set<string>();
  closeEdgePanel(fc);
  fc.connectors.hideConnectLayer();
}
export function closeEdgePanel(fc: FcCtx): void {
  fc.edgePanel?.remove();
  fc.edgePanel = null;
}
// Redraw EVERY selected edge's highlight (native coords in the connect layer) + keep
// the panel over the primary edge. Prunes any edge whose line/box vanished.
export function refreshEdgeChrome(fc: FcCtx): void {
  const { connectCfg, connectLayer } = fc;
  if (!connectCfg || !fc.selectedEdges.size) return;
  let html = '';
  const alive = new Set<string>();
  for (const eid of fc.selectedEdges) {
    const e = edgeById(fc, eid);
    const pts = e && edgePts(fc, e);
    if (!e || !pts) continue;
    alive.add(eid);
    const w = edgeWidthOf(fc, e);
    // Match the tool hook's path choice: a dashed/dotted line is drawn as sharp
    // segments (no smooth curve), so the highlight follows suit; solid honours curved.
    const dashV = String((connectCfg.dashField && e[connectCfg.dashField]) || 'solid');
    const d =
      dashV !== 'solid'
        ? roundedEdgePath(pts, 0)
        : edgeStyleOf(fc, e) === 'curved'
          ? smoothEdgePath(pts)
          : roundedEdgePath(pts, Math.min(16, w * 4 + 6));
    html += `<path d="${d}" fill="none" stroke="#30ba78" stroke-width="${fc.connectors.cf2(w + 8)}" stroke-linejoin="round" stroke-linecap="round" opacity="0.35"/>`;
  }
  if (alive.size !== fc.selectedEdges.size) fc.selectedEdges = alive; // drop the vanished
  if (!fc.selectedEdges.size) {
    deselectEdge(fc);
    return;
  }
  fc.connectors.placeConnectLayer(fc.stage.metrics());
  connectLayer.innerHTML = html;
  connectLayer.style.display = '';
  positionEdgePanel(fc);
}
// Set a field on ALL selected connectors at once (the multi-edit core).
export function setEdgeField(fc: FcCtx, field: string | undefined, value: unknown): void {
  const { cfg, connectCfg } = fc;
  if (!connectCfg || !fc.selectedEdges.size || !field) return;
  const edges = getEdges(fc);
  commitEdges(fc, 
    edges.map((e) =>
      e && fc.selectedEdges.has(String(e[cfg.idField])) ? { ...e, [field]: value as InputValue } : e
    )
  );
  refreshEdgeChrome(fc); // bend/thickness change → re-highlight + reposition
}
export function deleteSelectedEdge(fc: FcCtx): void {
  const { cfg, connectCfg } = fc;
  if (!connectCfg || !fc.selectedEdges.size) return;
  commitEdges(fc, getEdges(fc).filter((e) => !(e && fc.selectedEdges.has(String(e[cfg.idField])))));
  deselectEdge(fc);
}
export function positionEdgePanel(fc: FcCtx): void {
  const { connectCfg, stageEl } = fc;
  const pid = primaryEdgeId(fc);
  if (!fc.edgePanel || !connectCfg || !pid) return;
  const e = edgeById(fc, pid);
  const pts = e && edgePts(fc, e);
  if (!pts) return;
  const s = fc.stage.nativeToStage(polylineMid(fc, pts).x, polylineMid(fc, pts).y, fc.stage.metrics());
  const sr = stageEl.getBoundingClientRect();
  fc.edgePanel.style.left =
    Math.max(6, Math.min(s.x + 14, sr.width - fc.edgePanel.offsetWidth - 8)) + 'px';
  fc.edgePanel.style.top =
    Math.max(6, Math.min(s.y + 12, sr.height - fc.edgePanel.offsetHeight - 8)) + 'px';
}
export function openEdgePanel(fc: FcCtx): void {
  const { connectCfg, stageEl } = fc;
  closeEdgePanel(fc);
  const pid = primaryEdgeId(fc);
  if (!connectCfg || !pid) return;
  const e = edgeById(fc, pid);
  if (!e) return;
  const nSel = fc.selectedEdges.size; // >1 → the panel edits them ALL; values shown are the primary's
  const styleF = connectCfg.styleField,
    arrowF = connectCfg.arrowField,
    dashF = connectCfg.dashField;
  const widthF = connectCfg.widthField,
    colorF = connectCfg.colorField,
    headF = connectCfg.headField;
  const styleCur = edgeStyleOf(fc, e);
  const arrowCur = String((arrowF && e[arrowF]) || connectCfg.defaultArrow || 'end');
  const headCur = String((headF && e[headF]) || connectCfg.defaultHead || 'triangle');
  const dashCur = String((dashF && e[dashF]) || 'solid');
  const widthCur = edgeWidthOf(fc, e);
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
  const styleSelect = `<select class="field-select field-select--sm" data-ep="style" aria-label="${escapeText(t('Connector bend'))}">${STYLE_OPTS.map(([v, l]) => `<option value="${v}"${styleCur === v ? ' selected' : ''}>${escapeText(t(l))}</option>`).join('')}</select>`;
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
  wireSegs(p, (field, v) => setEdgeField(fc, field, v));
  if (styleF) {
    const sel = p.querySelector<HTMLSelectElement>('select[data-ep="style"]');
    sel?.addEventListener('change', () => setEdgeField(fc, styleF, sel.value));
  }
  if (widthF) {
    const rng = p.querySelector<HTMLInputElement>('input[data-ep="width"]');
    rng?.addEventListener('input', () => {
      const vb = p.querySelector<HTMLElement>('[data-ep-val="width"]');
      if (vb) vb.textContent = rng.value;
      setEdgeField(fc, widthF, Number(rng.value));
    });
  }
  if (colorF)
    wireColorField(p, {
      onChange: (id, val) => {
        if (id === 'fc-edge-color') setEdgeField(fc, colorF, fc.helpers.unwrapColor(val));
      },
    });
  p.querySelector<HTMLButtonElement>('[data-ep="del"]')?.addEventListener('click', (ev) => {
    ev.stopPropagation();
    deleteSelectedEdge(fc);
  });
  stageEl.appendChild(p);
  fc.edgePanel = p;
  positionEdgePanel(fc);
}
export function edgesOps(fc: FcCtx) {
  return {
    getEdges: bindOp(fc, getEdges),
    commitEdges: bindOp(fc, commitEdges),
    edgeById: bindOp(fc, edgeById),
    distToSeg: bindOp(fc, distToSeg),
    polylineDist: bindOp(fc, polylineDist),
    polylineMid: bindOp(fc, polylineMid),
    edgeStyleOf: bindOp(fc, edgeStyleOf),
    edgeWidthOf: bindOp(fc, edgeWidthOf),
    edgePts: bindOp(fc, edgePts),
    edgeAt: bindOp(fc, edgeAt),
    updateHover: bindOp(fc, updateHover),
    setHoverEdge: bindOp(fc, setHoverEdge),
    primaryEdgeId: bindOp(fc, primaryEdgeId),
    pointInRect: bindOp(fc, pointInRect),
    segsCross: bindOp(fc, segsCross),
    polylineInRect: bindOp(fc, polylineInRect),
    edgesInRect: bindOp(fc, edgesInRect),
    selectEdge: bindOp(fc, selectEdge),
    deselectEdge: bindOp(fc, deselectEdge),
    closeEdgePanel: bindOp(fc, closeEdgePanel),
    refreshEdgeChrome: bindOp(fc, refreshEdgeChrome),
    setEdgeField: bindOp(fc, setEdgeField),
    deleteSelectedEdge: bindOp(fc, deleteSelectedEdge),
    positionEdgePanel: bindOp(fc, positionEdgePanel),
    openEdgePanel: bindOp(fc, openEdgePanel),
  };
}
