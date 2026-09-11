// SPDX-License-Identifier: MPL-2.0
/**
 * free-canvas: bound paths and live connectors.
 *
 * Every function takes the shared `fc: FcCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `fc.<module>.<fn>`. Extracted verbatim
 * from initFreeCanvas() by scripts/split-closure.ts.
 */
import { boxRect, edgeArrowHead, edgeEndRect, edgeHeadInset, edgeNested, edgeWaypoints, formatEdgePoint, isEdgePoint, pathRouteStyle, roundedEdgePath, routedLineSvg, smoothEdgePath } from '../free-canvas-math.ts';
import type { Box, EdgeRect } from '../free-canvas-math.ts';
import { decodePathContours } from '../free-canvas-pen.ts';
import { boolOf } from './shared.ts';
import type { Metrics, Point } from './shared.ts';
import { bindOp, type FcCtx } from './context.ts';

// ── bound paths (plan 96 P3) ──────────────────────────────────────────────────
//
// A path box with an end attached to another box is a CONNECTOR: connector management
// draws it, routed from the bound box's border toward the other end. The editor's live
// overlay reads the SAME model the tool's hook reads (bindStart/bindEnd + the decoration
// fields) and draws it with the SAME engine call (`routedLineSvg`), so what tracks the
// cursor during a drag is what ends up in the committed render on drop.

/** One end's binding: the id of the box it is attached to, '' for a free end. */
export const bindOf = (fc: FcCtx, b: Box, which: 'start' | 'end'): string =>
  { const { cfg } = fc; return String(b[which === 'start' ? cfg.bindStartField : cfg.bindEndField] ?? '').trim(); };
/** Is this box a connector? ONE binding is enough - a path pinned at one end and loose at
 *  the other still routes, from the border toward the loose point. */
export const isBoundPath = (fc: FcCtx, b: Box): boolean =>
  { const { cfg, hasBindCfg } = fc; return hasBindCfg &&
  String(b[cfg.kindField]) === 'path' &&
  (bindOf(fc, b, 'start') !== '' || bindOf(fc, b, 'end') !== ''); };
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
export function boundPathParts(fc: FcCtx, 
  b: Box
): { from: string; to: string; decor: Parameters<typeof routedLineSvg>[2] } | null {
  const { cfg } = fc;
  if (!isBoundPath(fc, b)) return null;
  const bs = bindOf(fc, b, 'start'),
    be = bindOf(fc, b, 'end');
  const ends = !bs || !be ? pathEndsNative(fc, b) : null;
  if ((!bs || !be) && !ends) return null;
  const contours = decodePathContours(b[cfg.pathField]);
  const sole = contours[0];
  const route = pathRouteStyle(
    sole ? sole.kind : '',
    b[cfg.routeField],
    sole ? sole.nodes.length : 2
  );
  const sw = fc.keys.clampN(b[cfg.strokeWField], 0, 0, 400);
  const dashKw = String(b[cfg.strokeDashField] ?? '');
  return {
    from: bs || formatEdgePoint(ends!.start.x, ends!.start.y),
    to: be || formatEdgePoint(ends!.end.x, ends!.end.y),
    decor: {
      style: route,
      headStart: String(b[cfg.headStartField] || 'none'),
      headEnd: String(b[cfg.headEndField] || 'none'),
      dash: dashKw === 'dashed' || dashKw === 'dotted' ? dashKw : 'solid',
      dashArray: fc.dialogs.parseDashText(String(b[cfg.strokeDashArrayField] ?? '')) || null,
      dashFit: boolOf(b[cfg.dashFitField], false),
      color: cAttr(fc, String(b[cfg.strokeField] || '#64748b')),
      width: sw > 0 ? Math.min(20, Math.max(0.5, sw)) : 3,
    },
  };
}
/** A path box's first and last node in NATIVE canvas px. Nodes are stored normalised to
 *  the frame; rotation is ignored for the same reason the hook ignores it - a bound path
 *  is drawn between two rects and the router re-solves both ends anyway. */
export function pathEndsNative(fc: FcCtx, b: Box): { start: Point; end: Point } | null {
  const { cfg } = fc;
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
export const cf2 = (_fc: FcCtx, v: number): number => Math.round(v * 100) / 100;
export const cAttr = (_fc: FcCtx, s: string): string => String(s == null ? '' : s).replace(/[<>"]/g, '');
// Size + place a preview <svg> to cover the artboard in stage px (native viewBox), so
// its contents can be written in native coordinates and a pan/zoom is one element move.
export function placeNativeLayer(fc: FcCtx, el: SVGSVGElement, m: Metrics): void {
  const cw = fc.helpers.canvasWH();
  const o = fc.stage.nativeToStage(0, 0, m);
  el.style.left = o.x + 'px';
  el.style.top = o.y + 'px';
  el.style.width = cw.w * m.scale + 'px';
  el.style.height = cw.h * m.scale + 'px';
  el.setAttribute('viewBox', `0 0 ${cw.w} ${cw.h}`);
  el.setAttribute('preserveAspectRatio', 'none');
}
export const placeConnectLayer = (fc: FcCtx, m: Metrics): void => { const { connectLayer } = fc; placeNativeLayer(fc, connectLayer, m); };
// Hide/show the tool's committed bound-path <svg> (so it doesn't double up with the
// live preview mid-drag). Re-shown on gesture end; the commit re-renders it anyway.
// The class is the manifest's (`canvas.pathLayerClass`) for the same reason it used to be
// `canvas.connect.layerClass`: only a tool knows what its own hook emits.
export function setRealConnectorsHidden(fc: FcCtx, hidden: boolean): void {
  const { boundLayerClass, canvasEl, connectCfg } = fc;
  const cls = connectCfg?.layerClass || boundLayerClass;
  const el = canvasEl.querySelector<HTMLElement>('.' + cls);
  if (el) el.style.visibility = hidden ? 'hidden' : '';
  fc.liveConnectHidden = hidden;
}
// The rect used to anchor an edge to a box: the LIVE DOM rect when present (mid-drag),
// else the model rect. Rotation is ignored (org cards are axis-aligned).
export function boxRectById(fc: FcCtx, boxes: Box[], id: string): EdgeRect | null {
  const { canvasEl, cfg } = fc;
  const i = fc.select.indexOfId(boxes, id);
  if (i < 0) return null;
  const el = canvasEl.querySelector<HTMLElement>(`.lolly-box[data-box-id="${fc.keys.cssEscape(id)}"]`);
  if (el?.style.left) {
    const fo = fc.stage.frameOffsetOfEl(el);
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
export function previewHeads(_fc: FcCtx, 
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
export function liveRectById(fc: FcCtx, boxes: Box[]): Map<string, EdgeRect> {
  const { canvasEl, cfg } = fc;
  const liveEls = new Map<string, HTMLElement>();
  canvasEl.querySelectorAll<HTMLElement>('.lolly-box[data-box-id]').forEach((el) => {
    const id = el.getAttribute('data-box-id');
    if (id != null) liveEls.set(id, el);
  });
  const rectById = new Map<string, EdgeRect>();
  for (let i = 0; i < boxes.length; i++) {
    const id = fc.select.idOf(boxes[i], i);
    const el = liveEls.get(id);
    if (el?.style.left) {
      const fo = fc.stage.frameOffsetOfEl(el);
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
export function drawLiveBoundPaths(fc: FcCtx, boxes: Box[], rectById: Map<string, EdgeRect>): string {
  const { hasBindCfg } = fc;
  if (!hasBindCfg) return '';
  let body = '';
  for (const b of boxes) {
    const parts = b && boundPathParts(fc, b);
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
export function drawLiveConnectors(fc: FcCtx): void {
  const { connectCfg, connectLayer, hasBindCfg } = fc;
  const boxes = fc.select.getBoxes();
  if (hasBindCfg && !connectCfg) {
    // The plan-96 path: every connector is a bound path box, and there is no edge input.
    placeConnectLayer(fc, fc.stage.metrics());
    connectLayer.innerHTML = drawLiveBoundPaths(fc, boxes, liveRectById(fc, boxes));
    connectLayer.style.display = '';
    return;
  }
  if (!connectCfg) return;
  const edges = fc.edges.getEdges();
  placeConnectLayer(fc, fc.stage.metrics());
  const rectById = liveRectById(fc, boxes);
  // A tool that still declares BOTH (an un-migrated pack on a new shell) draws each from
  // its own model, once - the bound paths first so they sit under the legacy edges.
  let body = drawLiveBoundPaths(fc, boxes, rectById);
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
    const col = cAttr(fc, 
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
    const { pts, heads } = previewHeads(fc, raw, arrow, head, Math.max(9, w * 4), col);
    const d =
      style === 'curved' ? smoothEdgePath(pts) : roundedEdgePath(pts, Math.min(16, w * 4 + 6));
    body +=
      `<path d="${d}" fill="none" stroke="${col}" stroke-width="${cf2(fc, w)}" stroke-linejoin="round" stroke-linecap="round"/>` +
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
export function drawLineRubber(fc: FcCtx, from: Point, to: Point): void {
  const { connectLayer } = fc;
  const col = cAttr(fc, fc.penTool.drawnInkHex());
  const w = lineDraftWidth(fc);
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
    : `<circle cx="${cf2(fc, to.x)}" cy="${cf2(fc, to.y)}" r="5" fill="${col}"/>`;
  placeConnectLayer(fc, fc.stage.metrics());
  connectLayer.innerHTML =
    `<path d="M${cf2(fc, from.x)} ${cf2(fc, from.y)}L${cf2(fc, to.x - ux * inset)} ${cf2(fc, to.y - uy * inset)}" fill="none" stroke="${col}" stroke-width="${cf2(fc, w)}" stroke-dasharray="8 6" stroke-linecap="round"/>` +
    tip;
  connectLayer.style.display = '';
}
/** The stroke width a line draft previews at: whatever the committed box will take -
 *  the last path paint, else the tool's own `path` seed, else `penFinishDraw`'s own 4px
 *  last resort - so the rubber is not a different weight from the shape it becomes. */
export function lineDraftWidth(fc: FcCtx): number {
  const { addKinds, cfg } = fc;
  const seed = { ...(addKinds.find((k) => k.id === 'path')?.seed || {}) } as Box;
  const w = Number(fc.penLastPaint?.[cfg.strokeWField] ?? seed[cfg.strokeWField] ?? 0);
  return Math.min(20, Math.max(0.5, w > 0 ? w : 4));
}
export function hideConnectLayer(fc: FcCtx): void {
  const { connectLayer } = fc;
  connectLayer.style.display = 'none';
  connectLayer.innerHTML = '';
}
// Called each frame of a drag that moves connected cards: hide the tool's committed
// connector layer once, then redraw every edge live so the lines follow the boxes.
export function liveConnUpdate(fc: FcCtx): void {
  const { connectCfg, hasBindCfg } = fc;
  if (!connectCfg && !hasBindCfg) return;
  if (!fc.liveConnectHidden) setRealConnectorsHidden(fc, true);
  drawLiveConnectors(fc);
}
// On drop, keep the preview one extra paint so the committed connectors re-render
// underneath before we drop it (avoids a flash), then restore + clear.
export function endLiveConnectors(fc: FcCtx): void {
  if (!fc.liveConnectHidden) return;
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      if (fc.disposed) return;
      setRealConnectorsHidden(fc, false);
      if (!fc.selectedEdges.size) hideConnectLayer(fc);
    })
  );
}
export function connectorsOps(fc: FcCtx) {
  return {
    bindOf: bindOp(fc, bindOf),
    isBoundPath: bindOp(fc, isBoundPath),
    boundPathParts: bindOp(fc, boundPathParts),
    pathEndsNative: bindOp(fc, pathEndsNative),
    cf2: bindOp(fc, cf2),
    cAttr: bindOp(fc, cAttr),
    placeNativeLayer: bindOp(fc, placeNativeLayer),
    placeConnectLayer: bindOp(fc, placeConnectLayer),
    setRealConnectorsHidden: bindOp(fc, setRealConnectorsHidden),
    boxRectById: bindOp(fc, boxRectById),
    previewHeads: bindOp(fc, previewHeads),
    liveRectById: bindOp(fc, liveRectById),
    drawLiveBoundPaths: bindOp(fc, drawLiveBoundPaths),
    drawLiveConnectors: bindOp(fc, drawLiveConnectors),
    drawLineRubber: bindOp(fc, drawLineRubber),
    lineDraftWidth: bindOp(fc, lineDraftWidth),
    hideConnectLayer: bindOp(fc, hideConnectLayer),
    liveConnUpdate: bindOp(fc, liveConnUpdate),
    endLiveConnectors: bindOp(fc, endLiveConnectors),
  };
}
