// SPDX-License-Identifier: MPL-2.0
// ── CSV / table → {nodes, layers, arrows} ────────────────────────────────────────
import { slug, trim } from './util.js';
import { dslLines } from './parse-dsl.js';

export function parseTable(text, mode) {
  var rows = dslLines(text).filter(function (l) { return trim(l); });
  var nodes = [], arrows = [], used = {};
  function splitRow(l) { return (l.indexOf('\t') >= 0 ? l.split('\t') : l.split(',')).map(function (c) { return c.trim(); }); }
  function uid(l) { var b = slug(l) || 'row', id = b, k = 2; while (used[id]) { id = b + '-' + k; k++; } used[id] = 1; return id; }
  function ensure(label) { var id = slug(label) || 'n'; if (!used[id]) { used[id] = 1; nodes.push({ shape: 'rounded', nodeId: id, label: label, detail: '', image: '', fill: '', parent: '', layer: '' }); } return id; }
  if (!rows.length) return { nodes: [], layers: [], arrows: [] };
  var header = splitRow(rows[0]).map(function (c) { return c.toLowerCase(); });
  var hasHeader = /^(id|label|name|from|source)$/.test(header[0] || '');
  var start = hasHeader ? 1 : 0;
  var edgeMode = (mode === 'process');
  for (var i = start; i < rows.length; i++) {
    var c = splitRow(rows[i]);
    if (edgeMode) {
      if (c.length >= 2 && c[0] && c[1]) arrows.push({ from: ensure(c[0]), to: ensure(c[1]), label: c[2] || '', style: 'solid', head: '', width: 0, color: '' });
      else if (c[0]) ensure(c[0]);
    } else if (mode === 'timeline' || mode === 'cycle' || mode === 'pyramid') {
      if (c[0]) nodes.push({ shape: 'rounded', nodeId: uid(c[0]), label: c[0], detail: c[1] || '', image: '', fill: '', parent: '', layer: '' });
    } else {
      if (!c[0] && !c[1]) continue;
      var id = slug(c[0]) || uid(c[1] || c[0]); used[id] = 1;
      nodes.push({ shape: 'rounded', nodeId: id, label: c[1] || c[0], detail: c[2] || '', image: '', fill: '', parent: slug(c[3] || ''), layer: slug(c[3] || '') });
    }
  }
  return { nodes: nodes, layers: [], arrows: arrows };
}
