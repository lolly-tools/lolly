// SPDX-License-Identifier: MPL-2.0
// ── literal ASCII-art tracing → raw {nodes, arrows} + drawn positions ─────────────
import { slug } from './util.js';
import { imageRef } from './parse-dsl.js';

export function parseAscii(text) {
  var rows = String(text == null ? '' : text).replace(/\r\n?/g, '\n').split('\n').slice(0, 240);
  var H = rows.length, W = 0, i;
  for (i = 0; i < H; i++) { if (rows[i].length > W) W = rows[i].length; }
  W = Math.min(W, 400);
  function ch(r, c) { if (r < 0 || r >= H || c < 0) return ' '; var ln = rows[r]; return c < ln.length ? ln.charAt(c) : ' '; }
  function K(r, c) { return r + ',' + c; }

  var boxes = [], owner = {}, r, c, cc, rr;
  for (r = 0; r < H; r++) {
    for (c = 0; c < W; c++) {
      if (ch(r, c) !== '+') continue;
      var c2 = c + 1; while (c2 < W && ch(r, c2) === '-') c2++;
      if (c2 >= W || c2 === c + 1 || ch(r, c2) !== '+') continue;
      var r2 = r + 1; while (r2 < H && ch(r2, c2) === '|') r2++;
      if (r2 >= H || r2 === r + 1 || ch(r2, c2) !== '+' || ch(r2, c) !== '+') continue;
      var ok = true;
      for (cc = c + 1; cc < c2 && ok; cc++) if (ch(r2, cc) !== '-') ok = false;
      for (rr = r + 1; rr < r2 && ok; rr++) if (ch(rr, c) !== '|') ok = false;
      if (!ok) continue;
      var bi = boxes.length;
      boxes.push({ r0: r, c0: c, r1: r2, c1: c2, label: '', detail: '', id: '' });
      for (cc = c; cc <= c2; cc++) { owner[K(r, cc)] = bi; owner[K(r2, cc)] = bi; }
      for (rr = r; rr <= r2; rr++) { owner[K(rr, c)] = bi; owner[K(rr, c2)] = bi; }
    }
  }
  if (!boxes.length) return { nodes: [], arrows: [], pos: [] };

  boxes.forEach(function (b) {
    var lines = [], s, rr2, cc2, im;
    for (rr2 = b.r0 + 1; rr2 < b.r1; rr2++) {
      s = '';
      for (cc2 = b.c0 + 1; cc2 < b.c1; cc2++) s += ch(rr2, cc2);
      s = s.trim();
      if (!s) continue;
      im = s.match(/^@\s*(.+)$/);
      if (im && imageRef(im[1])) { b.image = imageRef(im[1]); continue; }
      lines.push(s);
    }
    b.label = lines[0] || '';
    b.detail = lines.slice(1).join(' ');
  });

  var CW = 11, CH = 26, nodes = [], pos = [], used = {};
  boxes.forEach(function (b, bi) {
    var base = slug(b.label) || ('box-' + (bi + 1)), id = base, k = 2;
    while (used[id]) { id = base + '-' + k; k++; }
    used[id] = 1; b.id = id;
    nodes.push({ shape: 'rounded', nodeId: id, label: b.label, detail: b.detail, image: b.image || '', fill: '', parent: '', layer: '' });
    pos.push({ x: b.c0 * CW, y: b.r0 * CH, w: Math.max(96, (b.c1 - b.c0) * CW), h: Math.max(44, (b.r1 - b.r0) * CH) });
  });

  function isWire(rr3, cc3) { var x = ch(rr3, cc3); return '-|+/\\><^v'.indexOf(x) >= 0 && owner[K(rr3, cc3)] === undefined; }
  function isHead(x) { return x === '>' || x === '<' || x === '^' || x === 'v'; }
  var OFF = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]];
  var CARD = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  function boxAt(pr, pc) {
    var d, o;
    for (d = 0; d < 8; d++) { o = owner[K(pr + OFF[d][0], pc + OFF[d][1])]; if (o !== undefined) return o; }
    for (d = 0; d < 4; d++) {
      var mr = pr + CARD[d][0], mc = pc + CARD[d][1];
      if (ch(mr, mc) === ' ' && owner[K(mr, mc)] === undefined) { o = owner[K(mr + CARD[d][0], mc + CARD[d][1])]; if (o !== undefined) return o; }
    }
    return undefined;
  }
  var seen = {}, arrows = [], pairSeen = {};
  for (r = 0; r < H; r++) {
    for (c = 0; c < W; c++) {
      if (!isWire(r, c) || seen[K(r, c)]) continue;
      var stack = [[r, c]], comp = [], heads = [];
      while (stack.length) {
        var p = stack.pop(), pr = p[0], pc = p[1];
        if (seen[K(pr, pc)] || !isWire(pr, pc)) continue;
        seen[K(pr, pc)] = 1;
        comp.push(p);
        if (isHead(ch(pr, pc))) heads.push(p);
        for (var d = 0; d < 8; d++) { var nr = pr + OFF[d][0], nc = pc + OFF[d][1]; if (isWire(nr, nc) && !seen[K(nr, nc)]) stack.push([nr, nc]); }
      }
      var touch = {};
      comp.forEach(function (cell) { var o = boxAt(cell[0], cell[1]); if (o !== undefined) touch[o] = 1; });
      var tb = Object.keys(touch).map(Number);
      if (tb.length < 2) continue;
      var fromI = tb[0], toI = tb[1];
      if (heads.length) { var hb = boxAt(heads[heads.length - 1][0], heads[heads.length - 1][1]); if (hb !== undefined) { toI = hb; fromI = (tb[0] === hb ? tb[1] : tb[0]); } }
      if (fromI === toI) continue;
      var pkey = fromI + '>' + toI;
      if (pairSeen[pkey]) continue;
      pairSeen[pkey] = 1;
      arrows.push({ from: nodes[fromI].nodeId, to: nodes[toI].nodeId, label: '', style: 'solid', head: '', width: 0, color: '' });
    }
  }
  return { nodes: nodes, arrows: arrows, pos: pos };
}
