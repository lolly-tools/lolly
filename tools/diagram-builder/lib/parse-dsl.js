// SPDX-License-Identifier: MPL-2.0
// ── text DSL parsing ─────────────────────────────────────────────────────────────
import { quadFromText, slug, trim } from './util.js';
import { BAND_PALETTE } from './constants.js';

export function dslLines(text) { return String(text == null ? '' : text).replace(/\r\n?/g, '\n').split('\n'); }
export function isComment(t) { return !t || t.indexOf('//') === 0; }
export function leadIndent(s) { var n = 0; for (var i = 0; i < s.length; i++) { var c = s.charAt(i); if (c === ' ') n++; else if (c === '\t') n += 4; else break; } return n; }
export function stripBullet(s) { return s.replace(/^[-*•]\s+/, ''); }
export function splitDetail(s) { var i = s.indexOf('::'); return i >= 0 ? { label: s.slice(0, i).trim(), detail: s.slice(i + 2).trim() } : { label: s.trim(), detail: '' }; }
export function splitArrowLabel(s) { var m = s.match(/\s:\s+(.+)$/); return m ? { body: s.slice(0, m.index), label: m[1].trim() } : { body: s, label: '' }; }
export function imageRef(s) {
  s = trim(s);
  if (!s) return '';
  var m = s.match(/^([a-z][a-z0-9+.-]*):/i);
  if (m) { var sch = m[1].toLowerCase(); return (sch === 'http' || sch === 'https' || sch === 'data') ? s : ''; }
  return (s.indexOf('/') >= 0 || /\.(png|jpe?g|gif|svg|webp|avif|bmp|ico)$/i.test(s)) ? s : '';
}
// `Label :: Detail @ image #hex` plus shape wrappers ([Box] (Rounded) ([Pill]) {…}).
export function splitToken(s) {
  s = String(s == null ? '' : s);
  var image = '', m = s.match(/\s@\s*([^@]+)$/);
  if (m) { var ref = imageRef(m[1]); if (ref) { image = ref; s = s.slice(0, m.index); } }
  var fill = '', fm = s.match(/\s(#[0-9a-fA-F]{3,8})\s*$/);
  if (fm) {
    // Only treat a trailing #hex as a card fill if it's a real colour length (6/8) or
    // a 3/4 shorthand containing a hex letter — so "Issue #1234" / "Room #500" stay as
    // labels instead of being eaten as a colour.
    var hx = fm[1].slice(1), hl = hx.length, hasLetter = /[a-f]/i.test(hx);
    if (hl === 6 || hl === 8 || ((hl === 3 || hl === 4) && hasLetter)) { fill = fm[1]; s = s.slice(0, fm.index); }
  }
  var shape = '', t = s.trim();
  if (/^\(\[[\s\S]*\]\)$/.test(t)) { shape = 'pill'; t = t.slice(2, -2); }
  else if (/^\[\([\s\S]*\)\]$/.test(t)) { shape = 'rounded'; t = t.slice(2, -2); }
  else if (/^\[\[[\s\S]*\]\]$/.test(t)) { shape = 'box'; t = t.slice(2, -2); }
  else if (/^\([\s\S]*\)$/.test(t)) { shape = 'rounded'; t = t.slice(1, -1); }
  else if (/^\[[\s\S]*\]$/.test(t)) { shape = 'box'; t = t.slice(1, -1); }
  else if (/^\{[\s\S]*\}$/.test(t)) { shape = 'box'; t = t.slice(1, -1); }
  var d = splitDetail(t);
  return { label: d.label, detail: d.detail, image: image, shape: shape, fill: fill };
}
// Map an edge operator string to style/head/width/double.
export function edgeOp(op) {
  var o = { style: 'solid', head: '', width: 0, double: false };
  if (op.indexOf('<') >= 0) o.double = true;
  if (op.indexOf('.') >= 0) o.style = 'dotted';
  if (op.indexOf('=') >= 0) o.width = 3.5;
  if (op.indexOf('o') >= 0) o.head = 'circle';        // mermaid circle edge --o
  else if (op.indexOf('x') >= 0) o.head = 'none';     // mermaid cross edge --x (no cross head)
  else if (op.indexOf('>') < 0 && !o.double) o.head = 'none'; // --- or -.-
  return o;
}
// Parse a chain like `A --> B -.-> C : label` (or mermaid `A -->|x| B`) into arrows.
// resolve(token) → node id (process/mermaid create nodes); null = resolve by slug.
export function parseEdges(content, resolve, arrows) {
  var al = splitArrowLabel(content), body = al.body, chainLabel = al.label;
  // mermaid `-- text -->` / `-. text .->` → normalise to `-->|text|`
  body = body.replace(/--\s+([^|>][^>]*?)\s+-->/g, '-->|$1|').replace(/-\.\s+([^|>][^>]*?)\s+\.->/g, '-.->|$1|');
  var OPRE = /(<-->|<-+>|<->|-\.->|-\.\.->|\.\.>|===>|==>|=>|o--o|x--x|--->|-->|->|--o|--x|o--|x--|---|-\.-)/g;
  var parts = [], ops = [], last = 0, m;
  while ((m = OPRE.exec(body))) { parts.push(body.slice(last, m.index)); ops.push(m[1]); last = m.index + m[1].length; }
  parts.push(body.slice(last));
  if (ops.length === 0) { var only = parts[0].trim(); if (only && resolve) resolve(only); return; }
  var labels = [];
  for (var i = 1; i < parts.length; i++) {
    var pm = parts[i].match(/^\s*\|([^|]*)\|/);
    if (pm) { labels[i - 1] = pm[1].trim(); parts[i] = parts[i].replace(/^\s*\|[^|]*\|/, ''); }
  }
  var ids = parts.map(function (p) { return resolve ? resolve(p.trim()) : slug(splitToken(p.trim()).label); });
  for (var j = 0; j < ops.length; j++) {
    var o = edgeOp(ops[j]);
    var lbl = labels[j] || (j === ops.length - 1 ? chainLabel : '');
    arrows.push({ from: ids[j], to: ids[j + 1], label: lbl, style: o.style, head: o.head, width: o.width, double: o.double, color: '' });
  }
}
export function collectArrows(content, arrows, addNode) { parseEdges(content, addNode, arrows); }

export function parseOrg(lines) {
  var nodes = [], arrows = [], used = {}, stack = [];
  function uid(label) { var b = slug(label) || 'node', id = b, k = 2; while (used[id]) { id = b + '-' + k; k++; } used[id] = 1; return id; }
  lines.forEach(function (raw) {
    var t = raw.trim();
    if (isComment(t) || t.charAt(0) === '#') return;
    if (/-->|->|==>/.test(t)) { collectArrows(stripBullet(t), arrows, null); return; }
    var indent = leadIndent(raw), d = splitToken(stripBullet(t));
    if (!d.label) return;
    var id = uid(d.label);
    while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
    nodes.push({ shape: d.shape || 'rounded', nodeId: id, label: d.label, detail: d.detail, image: d.image, fill: d.fill, parent: stack.length ? stack[stack.length - 1].id : '', layer: '' });
    stack.push({ indent: indent, id: id });
  });
  return { nodes: nodes, layers: [], arrows: arrows };
}
export function parseLayercake(lines) {
  var nodes = [], layers = [], arrows = [], usedN = {}, usedL = {}, cur = '', bi = 0;
  function uid(used, label, pre) { var b = slug(label) || pre, id = b, k = 2; while (used[id]) { id = b + '-' + k; k++; } used[id] = 1; return id; }
  lines.forEach(function (raw) {
    var t = raw.trim();
    if (isComment(t)) return;
    if (t.charAt(0) === '#') {
      var lab = t.replace(/^#+\s*/, '').trim();
      if (!lab) return;
      var lid = uid(usedL, lab, 'layer');
      layers.push({ kind: 'layer', layerId: lid, label: lab, bandFill: BAND_PALETTE[bi % BAND_PALETTE.length] });
      bi++; cur = lid; return;
    }
    var c = stripBullet(t);
    if (/-->|->|==>/.test(c)) { collectArrows(c, arrows, null); return; }
    var d = splitToken(c);
    if (!d.label) return;
    nodes.push({ shape: d.shape || 'rounded', nodeId: uid(usedN, d.label, 'node'), label: d.label, detail: d.detail, image: d.image, fill: d.fill, parent: '', layer: cur });
  });
  return { nodes: nodes, layers: layers, arrows: arrows };
}
export function parseProcess(lines) {
  var nodes = [], arrows = [], seen = {};
  function addNode(rawPart) {
    var d = splitToken(rawPart), key = slug(d.label) || 'step';
    if (seen[key]) {
      if (d.detail && !seen[key].detail) seen[key].detail = d.detail;
      if (d.image && !seen[key].image) seen[key].image = d.image;
      if (d.shape && seen[key].shape === 'rounded') seen[key].shape = d.shape;
      return key;
    }
    var node = { shape: d.shape || 'rounded', nodeId: key, label: d.label, detail: d.detail, image: d.image, fill: d.fill, parent: '', layer: '' };
    seen[key] = node; nodes.push(node);
    return key;
  }
  lines.forEach(function (raw) {
    var t = stripBullet(raw.trim());
    if (isComment(t) || t.charAt(0) === '#') return;
    if (/-->|->|==>|---/.test(t)) collectArrows(t, arrows, addNode);
    else addNode(t);
  });
  return { nodes: nodes, layers: [], arrows: arrows };
}
export function parseList(lines) {
  var nodes = [], used = {};
  function uid(l) { var b = slug(l) || 'item', id = b, k = 2; while (used[id]) { id = b + '-' + k; k++; } used[id] = 1; return id; }
  lines.forEach(function (raw) {
    var t = stripBullet(raw.trim());
    if (isComment(t) || t.charAt(0) === '#') return;
    var d = splitToken(t); if (!d.label) return;
    nodes.push({ shape: d.shape || 'rounded', nodeId: uid(d.label), label: d.label, detail: d.detail, image: d.image, fill: d.fill, parent: '', layer: '' });
  });
  return { nodes: nodes, layers: [], arrows: [] };
}
export function parseMatrix(lines) {
  var nodes = [], used = {}, cur = 'tr';
  function uid(l) { var b = slug(l) || 'item', id = b, k = 2; while (used[id]) { id = b + '-' + k; k++; } used[id] = 1; return id; }
  lines.forEach(function (raw) {
    var t = stripBullet(raw.trim());
    if (isComment(t)) return;
    if (t.charAt(0) === '#') { var q = quadFromText(t.replace(/^#+\s*/, '')); if (q) cur = q; return; }
    var score = null, sm = t.match(/@\s*\(\s*([\d.]+)\s*,\s*([\d.]+)\s*\)\s*$/);
    if (sm) { score = [parseFloat(sm[1]), parseFloat(sm[2])]; t = t.slice(0, sm.index).trim(); }
    var d = splitToken(t); if (!d.label) return;
    nodes.push({ shape: d.shape || 'pill', nodeId: uid(d.label), label: d.label, detail: d.detail, image: d.image, fill: d.fill, parent: '', layer: '', quadrant: cur, score: score });
  });
  return { nodes: nodes, layers: [], arrows: [] };
}
export function parseGantt(lines) {
  var nodes = [], arrows = [], used = {}, seq = 0;
  function uid(l) { var b = slug(l) || 'task', id = b, k = 2; while (used[id]) { id = b + '-' + k; k++; } used[id] = 1; return id; }
  lines.forEach(function (raw) {
    var t = stripBullet(raw.trim());
    if (isComment(t) || t.charAt(0) === '#') return;
    if (/-->|->|==>/.test(t)) { collectArrows(t, arrows, null); return; }
    var al = splitArrowLabel(t), body = al.body, spec = al.label, start = NaN, len = NaN;
    if (spec) {
      var r = spec.match(/^([\d.]+)\s*(?:\.\.|to|-)\s*([\d.]+)$/i), p = spec.match(/^([\d.]+)\s*\+\s*([\d.]+)$/);
      if (r) { start = parseFloat(r[1]); len = parseFloat(r[2]) - start; }
      else if (p) { start = parseFloat(p[1]); len = parseFloat(p[2]); }
    }
    var d = splitToken(body); if (!d.label) return;
    if (!isFinite(start)) start = seq; if (!isFinite(len) || len <= 0) len = 1; seq = Math.max(seq, start + len);
    nodes.push({ shape: d.shape || 'rounded', nodeId: uid(d.label), label: d.label, detail: d.detail, image: d.image, fill: d.fill, parent: '', layer: '', ganttStart: start, ganttLen: len });
  });
  return { nodes: nodes, layers: [], arrows: arrows };
}
export function parseDsl(text, mode) {
  var lines = dslLines(text);
  if (mode === 'layercake' || mode === 'kanban') return parseLayercake(lines);
  if (mode === 'process') return parseProcess(lines);
  if (mode === 'timeline' || mode === 'cycle' || mode === 'pyramid') return parseList(lines);
  if (mode === 'matrix') return parseMatrix(lines);
  if (mode === 'gantt') return parseGantt(lines);
  return parseOrg(lines); // org + mindmap
}
