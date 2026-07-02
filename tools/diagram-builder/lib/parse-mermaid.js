// SPDX-License-Identifier: MPL-2.0
// ── Mermaid subset → {nodes, layers, arrows, diagramType, dir} ────────────────────
import { slug, titleize } from './util.js';
import { BAND_PALETTE } from './constants.js';
import { dslLines, parseEdges } from './parse-dsl.js';

export function parseMermaid(text, host) {
  var lines = dslLines(text), nodes = [], byId = {}, layers = [], arrows = [], usedL = {}, order = 0;
  var diagramType = 'process', dir = 'down', sub = null;
  function ensure(id, label, shape) {
    id = slug(id) || ('n-' + (++order));
    if (!byId[id]) { byId[id] = { shape: shape || 'rounded', nodeId: id, label: label || titleize(id), detail: '', image: '', fill: '', parent: '', layer: sub || '' }; nodes.push(byId[id]); }
    else { if (label && (byId[id].label === titleize(id) || !byId[id].label)) byId[id].label = label; if (shape && byId[id].shape === 'rounded') byId[id].shape = shape; if (sub && !byId[id].layer) byId[id].layer = sub; }
    return id;
  }
  function defOf(tok) {
    tok = tok.trim();
    var m = tok.match(/^([A-Za-z0-9_]+)\s*(\(\[[\s\S]*\]\)|\[\([\s\S]*\)\]|\(\([\s\S]*\)\)|\{\{[\s\S]*\}\}|\{[\s\S]*\}|\[\[[\s\S]*\]\]|\[[\s\S]*\]|\([\s\S]*\))\s*$/);
    if (m) {
      var id = m[1], body = m[2], label = '', shape = 'rounded';
      if (/^\(\[[\s\S]*\]\)$/.test(body)) { shape = 'pill'; label = body.slice(2, -2); }
      else if (/^\(\([\s\S]*\)\)$/.test(body)) { shape = 'pill'; label = body.slice(2, -2); }
      else if (/^\[\([\s\S]*\)\]$/.test(body)) { shape = 'rounded'; label = body.slice(2, -2); }
      else if (/^\{\{[\s\S]*\}\}$/.test(body)) { shape = 'box'; label = body.slice(2, -2); }
      else if (/^\[\[[\s\S]*\]\]$/.test(body)) { shape = 'box'; label = body.slice(2, -2); }
      else if (/^\{[\s\S]*\}$/.test(body)) { shape = 'box'; label = body.slice(1, -1); }
      else if (/^\[[\s\S]*\]$/.test(body)) { shape = 'box'; label = body.slice(1, -1); }
      else { shape = 'rounded'; label = body.slice(1, -1); }
      return ensure(id, label.replace(/^["']|["']$/g, '').trim(), shape);
    }
    return ensure(tok, null, null);
  }
  lines.forEach(function (raw) {
    var t = raw.trim();
    if (!t || t.indexOf('%%') === 0) return;
    var h = t.match(/^(graph|flowchart)\s+(TB|TD|BT|RL|LR)\b/i);
    if (h) { var d = h[2].toUpperCase(); dir = (d === 'LR' || d === 'RL') ? 'right' : 'down'; return; }
    var sg = t.match(/^subgraph\s+(.+)$/i);
    if (sg) {
      diagramType = 'layercake';
      // Mermaid "subgraph id[Title]" — id is referenced by edges, the bracket is the
      // display title. Bare "subgraph Title" uses the whole token as the label.
      var sgRaw = sg[1].replace(/^["']|["']$/g, '').trim();
      var mb = sgRaw.match(/^([A-Za-z0-9_]+)\s*\[([\s\S]*)\]$/);
      var lab = mb ? mb[2].replace(/^["']|["']$/g, '').trim() : sgRaw.replace(/\[[\s\S]*\]$/, '').trim();
      var lid = slug(mb ? mb[1] : lab) || ('layer-' + (layers.length + 1));
      if (!usedL[lid]) { usedL[lid] = 1; layers.push({ kind: 'layer', layerId: lid, label: lab || titleize(lid), bandFill: BAND_PALETTE[layers.length % BAND_PALETTE.length] }); }
      sub = lid; return;
    }
    if (/^end$/i.test(t)) { sub = null; return; }
    if (/^(classDef|class|click|style|linkStyle|direction)\b/i.test(t)) { if (host && host.log) host.log('info', 'diagram-builder: mermaid line skipped: ' + t); return; }
    if (/(-->|---|-\.->|==>|<-->|<->|-\.-|\bo--|--o|x--|--x)/.test(t)) { parseEdges(t, defOf, arrows); return; }
    defOf(t);
  });
  return { nodes: nodes, layers: layers, arrows: arrows, diagramType: diagramType, dir: dir };
}
