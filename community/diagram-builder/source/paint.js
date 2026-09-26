// SPDX-License-Identifier: MPL-2.0
const dbOutlineCache = new Map();
export function dbFill(d, fill, opacity) {
  return '<path d="' + esc(d) + '" fill="' + esc(fill) + '"' + (opacity == null ? '' : ' opacity="' + f2(opacity) + '"') + '/>';
}
export function dbObject(d, fill, S, box) {
  let out = dbShadow(d, S.inp.cardDepth, false, S, box) + dbFill(d, fill);
  if (S.cardBorderWidth > 0) out += dbStroke(d, S.nodeStroke, S.cardBorderWidth);
  if (S.look === 'studio' && S.inp.surfaceHighlight > 0 && box && box.w > 14) {
    out += dbStroke('M' + f2(box.x + 6) + ' ' + f2(box.y + 1.5) + 'L' + f2(box.x + box.w - 6) + ' ' + f2(box.y + 1.5), dbMix(fill, '#ffffff', 0.35 * Number(S.inp.surfaceHighlight)), 1);
  }
  return out;
}
export function dbOutline(d, width) {
  const line = /^M(-?[\d.]+) (-?[\d.]+)L(-?[\d.]+) (-?[\d.]+)$/.exec(d);
  if (line) return dbCapsule(Number(line[1]), Number(line[2]), Number(line[3]), Number(line[4]), width);
  const key = width + ':' + d;
  if (dbOutlineCache.has(key)) return dbOutlineCache.get(key);
  if (host.geom?.stroke) {
    const result = host.geom.stroke(d, width, { cap: 'round', join: 'round', tolerance: 0.1, decimals: 2 });
    if (result.ok) {
      if (dbOutlineCache.size > 1200) dbOutlineCache.clear();
      dbOutlineCache.set(key, result.d); return result.d;
    }
  }
  return null;
}
export function dbCapsule(ax, ay, bx, by, width) {
  const length = Math.hypot(bx - ax, by - ay), r = width / 2, k = 0.5522847498 * r;
  if (length < 0.001) return circlePath(ax, ay, r);
  const ux = (bx - ax) / length, uy = (by - ay) / length;
  const p = (x, y) => f2(ax + ux * x - uy * y) + ' ' + f2(ay + uy * x + ux * y);
  return 'M' + p(0,r) + 'L' + p(length,r)
    + 'C' + p(length+k,r) + ' ' + p(length+r,k) + ' ' + p(length+r,0)
    + 'C' + p(length+r,-k) + ' ' + p(length+k,-r) + ' ' + p(length,-r)
    + 'L' + p(0,-r) + 'C' + p(-k,-r) + ' ' + p(-r,-k) + ' ' + p(-r,0)
    + 'C' + p(-r,k) + ' ' + p(-k,r) + ' ' + p(0,r) + 'Z';
}
export function dbStroke(d, col, width, opacity) {
  const outline = dbOutline(d, width);
  if (outline !== null) return dbFill(outline, col, opacity);
  return '<path d="' + esc(d) + '" fill="none" stroke="' + esc(col) + '" stroke-width="' + f2(width) + '" stroke-linecap="round" stroke-linejoin="round"' + (opacity == null ? '' : ' opacity="' + f2(opacity) + '"') + '/>';
}
export function dbShadow(d, amount, line, S, node) {
  amount = clamp(num(amount, 0), 0, 2); if (!amount || !d) return '';
  const token = S.brand.elevation, factor = line ? 0.5 : 1;
  const dx = token ? token.x * factor : 0, dy = token ? token.y * factor : line ? 1.5 : 3;
  let out = '<g transform="translate(' + f2(dx * amount) + ' ' + f2(dy * amount) + ')" aria-hidden="true">';
  const colour = token ? token.colour : '#10191d', layers = 8, blur = token ? token.blur * factor : line ? 3.6 : 7.2;
  for (let i = layers; i > 0; i--) {
    const spread = i / layers * amount * blur / 2, alpha = 0.01 + (layers - i) * 0.002;
    if (node) {
      const expanded = shapeGeom(node.shape, node.x-spread, node.y-spread, node.w+2*spread, node.h+2*spread, Object.assign({},S,{cornerRadius:S.cornerRadius+spread}), colour, 0);
      out += dbFill(expanded.outline, colour, alpha);
    } else out += dbStroke(d, colour, Math.max(0.3, spread * 2), alpha);
  }
  out += dbFill(d, colour, line ? 0.04 : 0.05);
  return out + '</g>';
}
export function dbResample(points, maxSegments) {
  if (points.length < 2) return points;
  let total = 0, lengths = [0];
  for (let i = 1; i < points.length; i++) { total += Math.hypot(points[i].x - points[i-1].x, points[i].y - points[i-1].y); lengths.push(total); }
  if (total < 0.01) return points.slice(0, 1);
  let count = Math.min(maxSegments, Math.max(2, Math.ceil(total / 3))), out = [], index = 1;
  for (let j = 0; j <= count; j++) {
    const distance = total * j / count;
    while (index < points.length - 1 && lengths[index] < distance) index++;
    const a = points[index-1], b = points[index], t = (distance - lengths[index-1]) / Math.max(0.001, lengths[index] - lengths[index-1]);
    out.push({ x: lerp(a.x,b.x,t), y: lerp(a.y,b.y,t), distance: distance });
  }
  return out;
}
export function dbRamp(from, to, S) {
  const gradient = S.brand.gradient;
  if (gradient && Array.isArray(gradient.value) && !S.inp.gradientFrom && !S.inp.gradientTo) {
    const stops = gradient.value.map((stop) => ({ color: color(stop.color, ''), position: Number(stop.position) })).filter((s) => s.color && Number.isFinite(s.position));
    stops.sort((a, b) => a.position - b.position);
    if (stops.length > 1) return Array.from({ length: 65 }, (_, i) => {
      const t = i / 64, next = stops.findIndex((s) => s.position >= t);
      if (next === 0) return stops[0].color;
      if (next < 0) return stops[stops.length - 1].color;
      const a = stops[next - 1], b = stops[next];
      return dbMix(a.color, b.color, (t - a.position) / Math.max(0.00001, b.position - a.position));
    });
  }
  if (host.color?.ramp) {
    try { return host.color.ramp([from, to], 65); } catch (_err) { /* use the same bounded fallback below */ }
  }
  return Array.from({ length: 65 }, (_, i) => dbMix(from, to, i / 64));
}
export function dbPaintRoute(route, col, endCol, width, style, S, gradient) {
  let out = '';
  if (S.inp.lineDepth > 0 && style === 'solid') {
    const amount = clamp(Number(S.inp.lineDepth), 0, 2);
    out += '<g transform="translate(0 ' + f2(amount * 1.5) + ')" aria-hidden="true">';
    for (let i = 4; i > 0; i--) out += dbFill(dbEnvelope(route.points, width + i * amount), '#10191d', 0.025);
    out += '</g>';
  }
  const points = dbResample(route.points, 160), ramp = gradient ? dbRamp(col, endCol, S) : [col];
  const ground = S.brand.bg === 'transparent' ? S.brand.surface : S.brand.bg;
  const casing = gradient && ramp.some((c) => contrastRatio(relLuminance(c), relLuminance(ground)) < 3);
  if (casing && style === 'solid') out += dbStroke(route.d, S.edgeColor, width + 1.25);
  if (!gradient && style === 'solid') return out + dbStroke(route.d, col, width);
  if (style === 'dotted' && points.length > 1) {
    const total = points[points.length - 1].distance, count = Math.min(320, Math.max(1, Math.floor(total / Math.max(3, width * 3))));
    let index = 1;
    for (let i = 0; i <= count; i++) {
      const distance = total * i / count;
      while (index < points.length - 1 && points[index].distance < distance) index++;
      const a = points[index - 1], b = points[index], t = (distance - a.distance) / Math.max(0.001, b.distance - a.distance);
      const x = lerp(a.x, b.x, t), y = lerp(a.y, b.y, t);
      if (casing) out += dbFill(circlePath(x, y, width / 2 + 0.625), S.edgeColor);
      out += dbFill(circlePath(x, y, width / 2), ramp[Math.round(i / count * (ramp.length - 1))]);
    }
    return out;
  }
  const dash = style === 'dotted' ? width * 2.5 : Math.max(8, width * 5);
  for (let i = 1; i < points.length; i++) {
    const a = points[i-1], b = points[i], middle = (a.distance + b.distance) / 2;
    if (style !== 'solid' && Math.floor(middle / dash) % 2) continue;
    const paint = ramp[Math.round((i - 0.5) / (points.length - 1) * (ramp.length - 1))];
    const d = 'M' + f2(a.x) + ' ' + f2(a.y) + 'L' + f2(b.x) + ' ' + f2(b.y);
    if (casing && style !== 'solid') out += dbStroke(d, S.edgeColor, width + 1.25);
    out += dbStroke(d, paint, width);
  }
  return out;
}
export function dbEnvelope(points, width) {
  if (points.length < 2) return '';
  const radius = width / 2, left = [], right = [];
  const p = (x, y) => f2(x) + ' ' + f2(y);
  points.forEach((point, i) => {
    const a = points[Math.max(0, i-1)], b = points[Math.min(points.length-1, i+1)];
    const length = Math.hypot(b.x-a.x,b.y-a.y) || 1, nx = -(b.y-a.y) / length * radius, ny = (b.x-a.x) / length * radius;
    left.push({x:point.x+nx,y:point.y+ny}); right.push({x:point.x-nx,y:point.y-ny});
  });
  let d = 'M' + p(left[0].x,left[0].y);
  left.slice(1).forEach((point) => { d += 'L' + p(point.x,point.y); });
  const cap = (tip, before, from, to) => {
    const length = Math.hypot(tip.x-before.x,tip.y-before.y) || 1, ux = (tip.x-before.x) / length * radius, uy = (tip.y-before.y) / length * radius;
    return 'Q' + p(from.x+ux,from.y+uy) + ' ' + p(tip.x+ux,tip.y+uy) + 'Q' + p(to.x+ux,to.y+uy) + ' ' + p(to.x,to.y);
  };
  const last = points.length-1;
  d += cap(points[last],points[last-1],left[last],right[last]);
  right.slice(0,-1).reverse().forEach((point) => { d += 'L' + p(point.x,point.y); });
  return d + cap(points[0],points[1],right[0],left[0]) + 'Z';
}
export function dbHead(tip, tangent, size, col, kind, width) {
  if (kind === 'none') return '';
  if (kind === 'double') kind = 'open';
  const length = Math.hypot(tangent.x, tangent.y) || 1, ux = tangent.x / length, uy = tangent.y / length;
  if (kind !== 'open') return arrowHead(tip, ux, uy, size, col, kind, width);
  const ax = tip.x - size * ux - size * uy, ay = tip.y - size * uy + size * ux;
  const bx = tip.x - size * ux + size * uy, by = tip.y - size * uy - size * ux;
  return dbStroke('M' + f2(ax) + ' ' + f2(ay) + 'L' + f2(tip.x) + ' ' + f2(tip.y) + 'L' + f2(bx) + ' ' + f2(by), col, width);
}
export function dbRouteHeads(route, edge, col, endCol, width, S) {
  const points = route.points, count = points.length; if (count < 2) return '';
  let kind = edge.head || S.arrowHead || 'open', both = edge.double || kind === 'double';
  const direction = S.inp.directionMarkers || 'infer';
  let end = edge.end == null ? kind !== 'none' : edge.end, start = edge.start == null ? both : edge.start;
  if (direction !== 'infer') { start = direction === 'start' || direction === 'both'; end = direction === 'end' || direction === 'both'; if (kind === 'none') kind = S.arrowHead === 'none' ? 'open' : S.arrowHead; }
  let size = S.inp.arrowHeadSizing === 'custom' ? S.arrowHeadSize : clamp(3.5 * width, 6, 10), out = '';
  if (start) out += dbHead(points[0], { x: points[0].x - points[1].x, y: points[0].y - points[1].y }, size, col, kind, width);
  if (end) out += dbHead(points[count-1], { x: points[count-1].x - points[count-2].x, y: points[count-1].y - points[count-2].y }, size, endCol, kind, width);
  return out;
}
export async function dbEdges(raw, nodeById, layerById, bg, bb, S) {
  let edges = arr(raw), boxes = [], lookup = new Map(), out = '', labels = '', unresolved = 0, labelBoxes = [];
  Object.keys(nodeById).forEach((id) => { const box = anchorOf(id, nodeById, layerById); box.id = id; lookup.set(id, box); boxes.push(box); });
  Object.keys(layerById).forEach((id) => { if (!lookup.has(id)) lookup.set(id, anchorOf(id, nodeById, layerById)); });
  if (edges.length > 900) throw new Error('Use at most 900 connections per diagram.');
  const fromCounts = new Map(), toCounts = new Map(), fromSeen = new Map(), toSeen = new Map();
  edges.forEach((edge) => { const a = slug(edge.from), b = slug(edge.to); fromCounts.set(a,(fromCounts.get(a)||0)+1); toCounts.set(b,(toCounts.get(b)||0)+1); });
  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i], from = slug(edge.from), to = slug(edge.to), A = lookup.get(from), B = lookup.get(to);
    if (!A || !B) { unresolved++; continue; }
    const fi = (fromSeen.get(from)||0)+1, ti = (toSeen.get(to)||0)+1; fromSeen.set(from,fi); toSeen.set(to,ti);
    let mode = edge.route && edge.route !== 'auto' ? edge.route : S.inp.connectionRoute;
    if (!mode || mode === 'auto') mode = S.diagramType === 'mindmap' ? 'curve' : 'elbow';
    const route = dbRoute(A, B, S, boxes, fi/(fromCounts.get(from)+1), ti/(toCounts.get(to)+1), mode, i % 4, edge._auto);
    const node = nodeById[from], target = nodeById[to];
    const override = S.inp.importColours === 'brand' ? '' : edge.color;
    let col = color(override, color(S.inp.edgeColor, S.inp.connectionPaint === 'branch' ? node?.accent || S.edgeColor : S.edgeColor)), endCol = col;
    const gradient = !override && !S.inp.edgeColor && S.inp.connectionPaint === 'gradient';
    if (gradient) { col = color(S.inp.gradientFrom, node?.accent || S.brand.primary); endCol = color(S.inp.gradientTo, target?.accent || S.brand.secondary); }
    const w = num(edge.width,0) > 0 ? Number(edge.width) : edge._auto ? S.connectorWidth : S.arrowWidth;
    const formWidth = S.inp.connectionForm === 'ribbon' ? Math.max(8, w * 5) : w;
    const style = edge.style || S.arrowStyle;
    const ref = S.sourceInput === 'nodes' ? Number.isInteger(edge._inputIndex) ? 'arrows:' + edge._inputIndex : 'connectionRoute' : S.sourceInput;
    const settings = ref.startsWith('arrows:') ? ['label', 'style', 'color', 'head', 'route'].map((field) => ref + ':' + field).join(' ') : 'connectionRoute directionMarkers connectionPaint connectionForm';
    const attrs = dbCanvasAttrs(ref, (node?.label || from) + ' → ' + (target?.label || to), settings);
    out += '<g' + attrs + ' data-diagram-edge="' + esc(from + ':' + to + ':' + i) + '">' + dbPaintRoute(route, col, endCol, formWidth, style, S, gradient);
    out += '<path d="' + esc(route.d) + '" fill="none" stroke="transparent" stroke-width="14" pointer-events="stroke" data-export-hide=""/>';
    const headRamp = gradient ? dbRamp(col, endCol, S) : [col, endCol];
    out += dbRouteHeads(route, edge, headRamp[0], headRamp[headRamp.length - 1], w, S) + '</g>';
    route.points.forEach((p) => { const pad = Math.max(14, formWidth, (S.inp.arrowHeadSizing === 'custom' ? S.arrowHeadSize : 10) + w / 2); bb.add(p.x-pad,p.y-pad,pad*2,pad*2); });
    const label = trim(edge.label);
    if (label) {
      let lw = await S.measure(label,12,500) + 14, lh = 26, candidates = dbResample(route.points,16), position = null;
      const endDistance = candidates[candidates.length-1].distance;
      candidates.sort((a,b) => Math.abs(a.distance-endDistance/2)-Math.abs(b.distance-endDistance/2));
      for (const candidate of candidates) {
        for (const dy of [0,-24,24,-44,44]) {
          const rect = { cx: candidate.x, cy: candidate.y+dy, hw: lw/2, hh: lh/2 };
          if (!boxes.concat(labelBoxes).some((b) => Math.abs(b.cx-rect.cx) < b.hw+rect.hw+6 && Math.abs(b.cy-rect.cy) < b.hh+rect.hh+6)) { position=rect; break; }
        }
        if (position) break;
      }
      if (!position) { note('Some connection labels need more space. Increase row spacing.'); position={cx:A.cx,cy:A.cy-A.hh-30,hw:lw/2,hh:lh/2}; }
      labelBoxes.push(position);
      const surface = bg === 'transparent' ? S.brand.surface : bg;
      labels += '<g' + attrs.replace('tabindex="0"', 'tabindex="-1"') + '>' + dbFill(roundedRectPath(position.cx-lw/2,position.cy-lh/2,lw,lh,5),surface);
      labels += dbText(position.cx,position.cy+4,label,12,500,dbInk(surface,S.nodeText,4.5),'middle') + '</g>';
      bb.add(position.cx-lw/2,position.cy-lh/2,lw,lh);
    }
  }
  return { svg:out, labels:labels, unresolved:unresolved, degenerate:0 };
}
export function dbAutoPath(d, S) {
  const points = dbSample(d); if (points.length < 2) return '';
  const straight = points.every((p,i) => !i || p.x === points[i-1].x || p.y === points[i-1].y);
  const path = straight ? dbRounded(points,clamp(num(S.inp.bendRadius,16),0,48)) : d;
  return dbPaintRoute({d:path,points:dbSample(path)},S.edgeColor,S.brand.secondary,S.connectorWidth,'solid',S,!S.inp.edgeColor && S.inp.connectionPaint === 'gradient');
}
