// SPDX-License-Identifier: MPL-2.0
export function dbCycle(nodes, S, inp, bb) {
  const count = nodes.length, width = S.cardWidth;
  const height = Math.max.apply(null, nodes.map((n) => n.measuredHeight));
  const radius = Math.max(150, count * (Math.max(width, height) + S.siblingGap + 24) / (2 * Math.PI));
  nodes.forEach((n, i) => {
    const angle = -Math.PI / 2 + i * 2 * Math.PI / count;
    n.w = width; n.h = n.measuredHeight; n.x = radius * Math.cos(angle) - n.w / 2; n.y = radius * Math.sin(angle) - n.h / 2;
  });
  let behind = '';
  if (inp.cycleArrows !== false && count > 1) nodes.forEach((n, i) => {
    const target = nodes[(i + 1) % count], lookup = {};
    lookup[n.id] = n; lookup[target.id] = target;
    const a = anchorOf(n.id, lookup, {}), b = anchorOf(target.id, lookup, {});
    const p = borderPoint(a, b.cx, b.cy), q = borderPoint(b, a.cx, a.cy), distance = Math.hypot(q.x - p.x, q.y - p.y) || 1;
    const ux = (q.x - p.x) / distance, uy = (q.y - p.y) / distance;
    p.x += ux * 6; p.y += uy * 6; q.x -= ux * 6; q.y -= uy * 6;
    const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2, radial = Math.hypot(mx, my);
    const cx = mx + (radial > 1 ? mx / radial : i % 2 ? -1 : 1) * radius * 0.24;
    const cy = my + (radial > 1 ? my / radial : 0) * radius * 0.24;
    const d = 'M' + f2(p.x) + ' ' + f2(p.y) + (inp.cycleCurved === false ? 'L' : 'Q' + f2(cx) + ' ' + f2(cy) + ' ') + f2(q.x) + ' ' + f2(q.y);
    const route = { d: d, points: dbSample(d) }, gradient = !inp.edgeColor && inp.connectionPaint === 'gradient';
    const col = gradient || inp.connectionPaint === 'branch' ? n.accent : S.edgeColor, end = gradient ? target.accent : col;
    behind += '<g' + dbCanvasAttrs('cycleCurved', n.label + ' → ' + target.label, 'cycleCurved connectionPaint arrowHead directionMarkers') + '>';
    behind += dbPaintRoute(route, col, end, S.arrowWidth, S.arrowStyle, S, gradient);
    behind += dbRouteHeads(route, {}, col, end, S.arrowWidth, S);
    behind += '<path d="' + esc(d) + '" fill="none" stroke="transparent" stroke-width="14" pointer-events="stroke" data-export-hide=""/></g>';
    const pad = Math.max(16, S.inp.arrowHeadSizing === 'custom' ? S.arrowHeadSize + S.arrowWidth / 2 : 16);
    route.points.forEach((pt) => { bb.add(pt.x - pad, pt.y - pad, pad * 2, pad * 2); });
  });
  return { autoEdges: [], bands: [], layerById: {}, behind: behind };
}

export function dbProcess(nodes, rawEdges, S, dir) {
  const adjacency = new Map(nodes.map((n) => [n.id, []]));
  arr(rawEdges).forEach((edge) => {
    const from = slug(edge.from), to = slug(edge.to);
    if (adjacency.has(from) && adjacency.has(to)) { adjacency.get(from).push(to); adjacency.get(to).push(from); }
  });
  const visited = new Set(), groups = [];
  nodes.forEach((node) => {
    if (visited.has(node.id)) return;
    const group = new Set([node.id]), queue = [node.id]; visited.add(node.id);
    for (let i = 0; i < queue.length; i++) adjacency.get(queue[i]).forEach((id) => {
      if (!visited.has(id)) { visited.add(id); group.add(id); queue.push(id); }
    });
    groups.push(group);
  });
  if (groups.length > 1) {
    let cross = 0;
    groups.forEach((group) => {
      const subset = nodes.filter((node) => group.has(node.id));
      dbProcess(subset, arr(rawEdges).filter((edge) => group.has(slug(edge.from)) && group.has(slug(edge.to))), S, dir);
      const horizontal = dir === 'right';
      const min = Math.min(...subset.map((node) => horizontal ? node.y : node.x));
      const max = Math.max(...subset.map((node) => horizontal ? node.y + node.h : node.x + node.w));
      subset.forEach((node) => { if (horizontal) node.y += cross - min; else node.x += cross - min; });
      cross += max - min + Math.max(40, S.siblingGap);
    });
    return { autoEdges: [], bands: [], layerById: {}, routeDirection: dir };
  }
  const next = new Map(nodes.map((n) => [n.id, []]));
  const incoming = new Map();
  arr(rawEdges).forEach((e) => { if (next.has(slug(e.from)) && next.has(slug(e.to))) next.get(slug(e.from)).push(slug(e.to)); });
  arr(rawEdges).forEach((e) => { incoming.set(slug(e.to), (incoming.get(slug(e.to)) || 0) + 1); });
  let index = 0, stack = [], active = new Set(), indices = new Map(), low = new Map(), components = [], component = new Map();
  function visit(id) {
    indices.set(id, index); low.set(id, index++); stack.push(id); active.add(id);
    next.get(id).forEach((to) => {
      if (!indices.has(to)) { visit(to); low.set(id, Math.min(low.get(id), low.get(to))); }
      else if (active.has(to)) low.set(id, Math.min(low.get(id), indices.get(to)));
    });
    if (low.get(id) === indices.get(id)) {
      let group = [], member;
      do { member = stack.pop(); active.delete(member); component.set(member, components.length); group.push(member); } while (member !== id);
      components.push(group);
    }
  }
  nodes.forEach((n) => { if (!indices.has(n.id)) visit(n.id); });
  const order = new Map(nodes.map((n, i) => [n.id, i])), local = new Map(nodes.map((n) => [n.id, 0]));
  const spans = components.map((members) => {
    members.sort((a, b) => order.get(a) - order.get(b));
    members.forEach((from) => { next.get(from).forEach((to) => {
      if (component.get(from) === component.get(to) && order.get(to) > order.get(from)) local.set(to, Math.max(local.get(to), local.get(from) + 1));
    }); });
    return 1 + Math.max(...members.map((id) => local.get(id)));
  });
  const ranks = components.map(() => 0), indegree = components.map(() => 0), links = components.map(() => new Set());
  next.forEach((tos, from) => { tos.forEach((to) => {
    const a = component.get(from), b = component.get(to);
    if (a !== b && !links[a].has(b)) { links[a].add(b); indegree[b]++; }
  }); });
  const queue = []; indegree.forEach((degree, i) => { if (!degree) queue.push(i); });
  for (let q = 0; q < queue.length; q++) links[queue[q]].forEach((to) => { ranks[to] = Math.max(ranks[to], ranks[queue[q]] + spans[queue[q]]); if (--indegree[to] === 0) queue.push(to); });
  const rows = [];
  nodes.forEach((n) => { const rank = ranks[component.get(n.id)] + local.get(n.id); if (!rows[rank]) rows[rank] = []; rows[rank].push(n); });
  let horizontal = dir === 'right', main = 0;
  rows.forEach((row) => {
    row.forEach((n) => { n.w = S.cardWidth; n.h = Math.max(n.measuredHeight, horizontal ? Math.max(next.get(n.id).length, incoming.get(n.id) || 0) * 18 + 24 : 0); });
    const extent = row.reduce((sum, n) => sum + (horizontal ? n.h : n.w) + S.siblingGap, -S.siblingGap);
    let cross = -extent / 2;
    row.forEach((n) => { n.x = horizontal ? main : cross; n.y = horizontal ? cross : main; cross += (horizontal ? n.h : n.w) + S.siblingGap; });
    main += Math.max.apply(null, row.map((n) => horizontal ? n.w : n.h)) + Math.max(48, S.rowGap);
  });
  return { autoEdges: [], bands: [], layerById: {}, routeDirection: dir };
}
export function dbTree(nodes, S, dir, mindmap) {
  const roots = buildTree(nodes), horizontal = dir === 'right' || mindmap;
  function span(n) {
    n.w = S.cardWidth; n.h = n.measuredHeight;
    const children = n._children.map(span);
    n.span = Math.max(horizontal ? n.h : n.w, children.reduce((sum, value) => sum + value, 0) + Math.max(0, children.length - 1) * S.siblingGap);
    return n.span;
  }
  roots.forEach(span);
  const depthSizes = [];
  function sizes(n, depth) { depthSizes[depth] = Math.max(depthSizes[depth] || 0, horizontal ? n.w : n.h); n._children.forEach((c) => { sizes(c, depth + 1); }); }
  roots.forEach((r) => { sizes(r, 0); });
  const depths = [0]; for (let i = 0; i < depthSizes.length; i++) depths[i + 1] = depths[i] + depthSizes[i] + Math.max(48, S.rowGap);
  function place(n, depth, cross, side) {
    if (horizontal) { n.x = side < 0 ? -depths[depth] - n.w : depths[depth]; n.y = cross + n.span / 2 - n.h / 2; }
    else { n.x = cross + n.span / 2 - n.w / 2; n.y = depths[depth]; }
    n._side = side;
    const total = n._children.reduce((sum, c) => sum + c.span, 0) + Math.max(0, n._children.length - 1) * S.siblingGap;
    let offset = cross + (n.span - total) / 2;
    n._children.forEach((c) => { place(c, depth + 1, offset, side); offset += c.span + S.siblingGap; });
  }
  let cross = 0;
  roots.forEach((r) => {
    if (mindmap && S.inp.mindmapStyle !== 'right' && r._children.length > 1) {
      const sides = [[], []], totals = [0, 0];
      r._children.forEach((c) => { const side = totals[0] <= totals[1] ? 0 : 1; sides[side].push(c); totals[side] += c.span + S.siblingGap; });
      const extent = Math.max.apply(null, totals); r.x = -r.w / 2; r.y = cross + extent / 2 - r.h / 2;
      sides.forEach((list, side) => {
        let offset = cross + (extent - totals[side] + S.siblingGap) / 2;
        list.forEach((c) => { place(c, 1, offset, side ? -1 : 1); offset += c.span + S.siblingGap; });
      });
      cross += extent + S.rowGap;
    } else { place(r, 0, cross, 1); cross += r.span + S.rowGap; }
  });
  const trunks = [], joined = new Set();
  if (!mindmap && ['auto', 'elbow'].includes(S.inp.connectionRoute) && ['infer', 'none'].includes(S.inp.directionMarkers)) {
    nodes.forEach((parent) => {
      if (parent._children.length < 2) return;
      const children = parent._children.slice().sort((a, b) => horizontal ? a.y - b.y : a.x - b.x);
      const end = horizontal ? parent.x + parent.w + 5 : parent.y + parent.h + 5;
      const center = horizontal ? parent.y + parent.h / 2 : parent.x + parent.w / 2;
      const tips = children.map((c) => ({ main: (horizontal ? c.x : c.y) - 5, cross: horizontal ? c.y + c.h / 2 : c.x + c.w / 2 }));
      const bus = (end + Math.min(...tips.map((p) => p.main))) / 2;
      const point = (main, cross) => horizontal ? { x: main, y: cross } : { x: cross, y: main };
      const line = (points) => dbRounded(points, clamp(num(S.inp.bendRadius, 16), 0, 48));
      trunks.push(line([point(end, center), point(bus, center)]));
      const first = tips[0], last = tips[tips.length - 1];
      trunks.push(line([point(first.main, first.cross), point(bus, first.cross), point(bus, last.cross), point(last.main, last.cross)]));
      tips.slice(1, -1).forEach((p) => { trunks.push(line([point(bus, p.cross), point(p.main, p.cross)])); });
      children.forEach((c) => { joined.add(c.id); });
    });
  }
  return { autoEdges: trunks, bands: [], layerById: {}, routeDirection: horizontal ? 'right' : 'down',
    modernEdges: nodes.filter((n) => n._parent && !joined.has(n.id)).map((n) => ({ from: n._parent.id, to: n.id, head: 'none', _auto: true })) };
}
export function dbSimplify(points) {
  const out = [];
  points.forEach((p) => {
    const last = out[out.length - 1]; if (last && Math.hypot(last.x - p.x, last.y - p.y) < 0.01) return;
    while (out.length > 1) {
      const a = out[out.length - 2], b = out[out.length - 1];
      if (Math.abs((b.x - a.x) * (p.y - b.y) - (b.y - a.y) * (p.x - b.x)) > 0.001 || (b.x - a.x) * (p.x - b.x) + (b.y - a.y) * (p.y - b.y) < 0) break;
      out.pop();
    }
    out.push(p);
  });
  return out;
}
export function dbRounded(points, radius) {
  const p = dbSimplify(points); if (p.length < 2) return '';
  let d = 'M' + f2(p[0].x) + ' ' + f2(p[0].y), k = 4 * (Math.sqrt(2) - 1) / 3;
  for (let i = 1; i < p.length - 1; i++) {
    const a = p[i - 1], b = p[i], c = p[i + 1], al = Math.hypot(b.x - a.x, b.y - a.y), bl = Math.hypot(c.x - b.x, c.y - b.y);
    const r = Math.min(radius, al / 2, bl / 2), ux = (b.x - a.x) / al, uy = (b.y - a.y) / al, vx = (c.x - b.x) / bl, vy = (c.y - b.y) / bl;
    const ax = b.x - ux * r, ay = b.y - uy * r, bx = b.x + vx * r, by = b.y + vy * r;
    d += 'L' + f2(ax) + ' ' + f2(ay) + 'C' + f2(ax + ux * r * k) + ' ' + f2(ay + uy * r * k) + ' ' + f2(bx - vx * r * k) + ' ' + f2(by - vy * r * k) + ' ' + f2(bx) + ' ' + f2(by);
  }
  return d + 'L' + f2(p[p.length - 1].x) + ' ' + f2(p[p.length - 1].y);
}
export function dbPort(n, side, fraction, gap) {
  const u = { x: side === 'right' ? 1 : side === 'left' ? -1 : 0, y: side === 'bottom' ? 1 : side === 'top' ? -1 : 0 };
  const horizontal = !!u.x, cx = n.cx, cy = n.cy, hw = n.hw, hh = n.hh;
  const half = horizontal ? hh : hw, offset = (fraction - 0.5) * Math.max(half, 2 * half - 20);
  let x = cx + (horizontal ? u.x * hw : offset), y = cy + (horizontal ? offset : u.y * hh);
  if (n.shape === 'circle' || n.shape === 'ellipse') {
    if (horizontal) x = cx + u.x * hw * Math.sqrt(Math.max(0, 1 - offset * offset / (hh * hh)));
    else y = cy + u.y * hh * Math.sqrt(Math.max(0, 1 - offset * offset / (hw * hw)));
  } else if (n.shape === 'diamond') {
    if (horizontal) x = cx + u.x * hw * (1 - Math.abs(offset) / hh);
    else y = cy + u.y * hh * (1 - Math.abs(offset) / hw);
  } else if ((n.shape === 'pill' || n.shape === 'oval') && horizontal && hw >= hh) {
    x = cx + u.x * (hw - hh + Math.sqrt(Math.max(0, hh * hh - offset * offset)));
  }
  if ((n.shape === 'pill' || n.shape === 'oval') && !horizontal && hh >= hw) y = cy + u.y * (hh - hw + Math.sqrt(Math.max(0, hw * hw - offset * offset)));
  if (n.shape === 'hexagon' && horizontal) x = cx + u.x * (hw - clamp(Math.min(hw * 0.4, hh), 6, 44) * Math.abs(offset) / hh);
  if (n.shape === 'cylinder' && !horizontal) {
    const cap = clamp(Math.min(hh * 0.32, hw * 0.84), 4, 16);
    y = cy + u.y * (hh - cap + cap * Math.sqrt(Math.max(0, 1 - offset * offset / (hw * hw))));
  }
  return { x: x + u.x * gap, y: y + u.y * gap, ux: u.x, uy: u.y };
}
export function dbHits(a, b, box, pad) {
  const minX = box.cx - box.hw - pad, maxX = box.cx + box.hw + pad, minY = box.cy - box.hh - pad, maxY = box.cy + box.hh + pad;
  let lo = 0, hi = 1, dx = b.x - a.x, dy = b.y - a.y;
  for (const pair of [[-dx, a.x - minX], [dx, maxX - a.x], [-dy, a.y - minY], [dy, maxY - a.y]]) {
    if (Math.abs(pair[0]) < 1e-8) { if (pair[1] <= 0) return false; }
    else { const t = pair[1] / pair[0]; if (pair[0] < 0) lo = Math.max(lo, t); else hi = Math.min(hi, t); }
  }
  return hi > lo + 1e-6 && hi > 0 && lo < 1;
}
export function dbRoute(A, B, S, boxes, fromFraction, toFraction, routeMode, lane, tree) {
  let horizontal = S.routeDirection === 'right', forward = horizontal ? B.cx > A.cx + A.hw : B.cy > A.cy + A.hh;
  let sideA = horizontal ? 'right' : 'bottom', sideB = horizontal ? 'left' : 'top';
  if (A === B) { sideA = 'right'; sideB = 'top'; }
  else if (tree && horizontal && B.cx < A.cx) { sideA = 'left'; sideB = 'right'; forward = true; }
  else if (horizontal && Math.abs(B.cx - A.cx) < Math.max(A.hw, B.hw) && B.cy > A.cy + A.hh) { horizontal = false; forward = true; sideA = 'bottom'; sideB = 'top'; }
  else if (horizontal && Math.abs(B.cx - A.cx) < Math.max(A.hw, B.hw)) { sideA = 'right'; sideB = 'right'; }
  else if (!forward) { sideA = horizontal ? 'top' : 'left'; sideB = sideA; }
  const gap = Math.max(5, S.arrowWidth * 2), a = dbPort(A, sideA, fromFraction, gap), b = dbPort(B, sideB, toFraction, gap);
  const landing = Math.max(16, clamp(3.5 * S.arrowWidth, 6, 10) + 6);
  const aa = { x: a.x + a.ux * landing, y: a.y + a.uy * landing }, bb = { x: b.x + b.ux * landing, y: b.y + b.uy * landing };
  const candidates = [], pad = 8 + Math.max(0, Number(S.inp.cardDepth)) * 5;
  const clear = (points) => points.every((p, i) => !i || boxes.every((box) => {
    if ((box === A && i === 1) || (box === B && i === points.length - 1)) return true;
    return !dbHits(points[i - 1], p, box, box === A || box === B ? 0 : pad);
  }));
  const result = (d) => ({ d, points: dbSample(d), start: a, end: b, startTangent: { x: a.ux, y: a.uy }, endTangent: { x: -b.ux, y: -b.uy }, unresolved: false });
  if (forward && routeMode === 'curve') {
    const d = 'M' + f2(a.x) + ' ' + f2(a.y) + 'C' + f2(horizontal ? (a.x + b.x) / 2 : a.x) + ' ' + f2(horizontal ? a.y : (a.y + b.y) / 2) + ' ' + f2(horizontal ? (a.x + b.x) / 2 : b.x) + ' ' + f2(horizontal ? b.y : (a.y + b.y) / 2) + ' ' + f2(b.x) + ' ' + f2(b.y);
    const sampled = dbSample(d);
    if (sampled.every((p, i) => !i || boxes.every((box) => box === A || box === B || !dbHits(sampled[i - 1], p, box, pad)))) return result(d);
  }
  if (routeMode === 'straight' && A !== B) candidates.push([a, b]);
  if (forward) {
    const mx = (aa.x + bb.x) / 2, my = (aa.y + bb.y) / 2;
    candidates.push(horizontal ? [a, aa, { x: mx, y: aa.y }, { x: mx, y: bb.y }, bb, b] : [a, aa, { x: aa.x, y: my }, { x: bb.x, y: my }, bb, b]);
  }
  for (const candidate of candidates) {
    const points = dbSimplify(candidate);
    if (clear(points)) return result(dbRounded(points, routeMode === 'straight' ? 0 : clamp(num(S.inp.bendRadius, 16), 0, 48)));
  }
  const xs = [Math.min(A.cx - A.hw, B.cx - B.hw) - 32 - lane * 8], ys = [Math.min(A.cy - A.hh, B.cy - B.hh) - 32 - lane * 8];
  boxes.forEach((box) => { xs.push(box.cx - box.hw - pad - 16 - lane * 6, box.cx + box.hw + pad + 16 + lane * 6); ys.push(box.cy - box.hh - pad - 16 - lane * 6, box.cy + box.hh + pad + 16 + lane * 6); });
  const corridors = (values, center) => [...new Set(values)].sort((a, b) => Math.abs(a - center) - Math.abs(b - center)).slice(0, 24).concat(Math.min(...values), Math.max(...values));
  corridors(xs, (aa.x + bb.x) / 2).forEach((x) => { candidates.push([a, aa, { x: x, y: aa.y }, { x: x, y: bb.y }, bb, b]); });
  corridors(ys, (aa.y + bb.y) / 2).forEach((y) => { candidates.push([a, aa, { x: aa.x, y: y }, { x: bb.x, y: y }, bb, b]); });
  let best = null, score = Infinity;
  candidates.forEach((raw) => {
    let points = dbSimplify(raw), length = 0;
    for (let i = 1; i < points.length; i++) {
      const p = points[i - 1], q = points[i]; length += Math.hypot(q.x - p.x, q.y - p.y);
      for (const box of boxes) {
        if ((box === A && i === 1) || (box === B && i === points.length - 1)) continue;
        if (dbHits(p, q, box, box === A || box === B ? 0 : pad)) return;
      }
    }
    const value = length + points.length * 10;
    if (value < score) { best = points; score = value; }
  });
  if (!best) { note('Some connections could not avoid nearby cards. Increase row and sibling spacing.'); best = [a, aa, bb, b]; }
  let curve = routeMode === 'curve' && forward && best.length <= 6;
  let d;
  if (curve) {
    d = 'M' + f2(a.x) + ' ' + f2(a.y) + 'C' + f2(horizontal ? (a.x + b.x) / 2 : a.x) + ' ' + f2(horizontal ? a.y : (a.y + b.y) / 2) + ' ' + f2(horizontal ? (a.x + b.x) / 2 : b.x) + ' ' + f2(horizontal ? b.y : (a.y + b.y) / 2) + ' ' + f2(b.x) + ' ' + f2(b.y);
    const sampled = dbSample(d);
    if (sampled.some((p, i) => i && boxes.some((box) => box !== A && box !== B && dbHits(sampled[i - 1], p, box, pad)))) curve = false;
  }
  if (!curve) d = dbRounded(best, routeMode === 'straight' ? 0 : clamp(num(S.inp.bendRadius, 16), 0, 48));
  return { d: d, points: dbSample(d), start: a, end: b, startTangent: { x: a.ux, y: a.uy }, endTangent: { x: -b.ux, y: -b.uy }, unresolved: !Number.isFinite(score) };
}
export function dbSample(d) {
  let tokens = d.match(/[MLCQZ]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || [], points = [], x = 0, y = 0, i = 0;
  function add(px, py) { if (!points.length || Math.hypot(px - x, py - y) > 0.001) points.push({ x: px, y: py }); x = px; y = py; }
  while (i < tokens.length) {
    const op = tokens[i++];
    if (op === 'M' || op === 'L') add(Number(tokens[i++]), Number(tokens[i++]));
    else if (op === 'C' || op === 'Q') {
      let x0 = x, y0 = y, x1 = Number(tokens[i++]), y1 = Number(tokens[i++]);
      let x2 = Number(tokens[i++]), y2 = Number(tokens[i++]), x3, y3;
      if (op === 'Q') { x3 = x2; y3 = y2; x2 = x3 + (x1 - x3) * 2 / 3; y2 = y3 + (y1 - y3) * 2 / 3; x1 = x0 + (x1 - x0) * 2 / 3; y1 = y0 + (y1 - y0) * 2 / 3; }
      else { x3 = Number(tokens[i++]); y3 = Number(tokens[i++]); }
      const steps = Math.min(128, Math.max(8, Math.ceil((Math.hypot(x1 - x0, y1 - y0) + Math.hypot(x2 - x1, y2 - y1) + Math.hypot(x3 - x2, y3 - y2)) / 4)));
      for (let j = 1; j <= steps; j++) { const t = j / steps, u = 1 - t; add(u*u*u*x0 + 3*u*u*t*x1 + 3*u*t*t*x2 + t*t*t*x3, u*u*u*y0 + 3*u*u*t*y1 + 3*u*t*t*y2 + t*t*t*y3); }
    } else if (op !== 'Z') break;
  }
  return points;
}

export function dbLayercake(nodes, rawLayers, S) {
  const layers = [], layerById = {};
  arr(rawLayers).forEach((raw, i) => {
    if (!raw) return;
    const id = slug(raw.layerId) || slug(raw.label) || 'layer-' + (i + 1);
    if (layerById[id]) return;
    const layer = { idx: i, id: id, label: trim(raw.label) || id, bandFill: color(raw.bandFill, S.bandPalette[i % S.bandPalette.length]), _cards: [] };
    layers.push(layer); layerById[id] = layer;
  });
  nodes.forEach((node) => {
    const id = node.layerId || '__unassigned__';
    if (!layerById[id]) {
      const layer = { idx: layers.length, id: id, label: node.layerId ? titleize(id) : 'Unassigned', bandFill: S.bandPalette[layers.length % S.bandPalette.length], _cards: [] };
      layers.push(layer); layerById[id] = layer;
    }
    layerById[id]._cards.push(node);
  });
  const limit = clamp(num(S.inp.layerColumns, 0), 0, 8), cw = S.cardWidth;
  const cols = Math.max(1, ...layers.map((layer) => limit ? Math.min(limit, layer._cards.length) : layer._cards.length));
  const gap = Math.max(12, Math.round(S.siblingGap * 0.6)), pad = 20;
  const gutter = clamp(Math.max(0, ...layers.map((layer) => textWidth(layer.label, 15))) + 36, 112, 180);
  const inner = cols * cw + (cols - 1) * gap, width = gutter + inner + pad * 2;
  let y = 0;
  layers.forEach((layer) => {
    const rows = [];
    layer._cards.forEach((node, i) => { const row = Math.floor(i / cols); if (!rows[row]) rows[row] = []; rows[row].push(node); });
    let cy = y + pad;
    rows.forEach((row) => {
      const h = Math.max(60, ...row.map((node) => node.measuredHeight));
      const left = gutter + pad + (inner - row.length * cw - (row.length - 1) * gap) / 2;
      row.forEach((node, i) => { node.x = left + i * (cw + gap); node.y = cy; node.w = cw; node.h = h; });
      cy += h + gap;
    });
    layer.x = 0; layer.y = y; layer.w = width; layer.h = Math.max(60, cy - y - gap) + pad;
    y += layer.h + Math.max(24, S.rowGap * 0.5);
  });
  return { autoEdges: [], bands: layers, layerById: layerById, gutter: gutter };
}
