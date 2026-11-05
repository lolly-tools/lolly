/* global host */
/**
 * Scorecard hooks.
 *
 * Reads the `criteria` table into rows the logic-less template prints: the
 * criterion, its initial, a bar, the score as text and the evidence (Markdown,
 * rendered and escaped by the template's `markdown` helper), plus the overall
 * score. DOM-free and never throws: a score that is not a number reads as not
 * yet known, and its row shows an empty bar.
 *
 * Columns are found by heading (Score/Rating, Evidence/Notes/Why), else taken
 * as criterion, score and evidence in that order.
 */

function columnsOf(columns) {
  var names = (columns || []).map(function (c) { return String(c || '').trim().toLowerCase(); });
  var find = function (re, fallback) {
    for (var i = 0; i < names.length; i++) if (re.test(names[i])) return i;
    return fallback;
  };
  return {
    name: find(/^(criterion|criteria|name|item|area|letter|element)$/, 0),
    score: find(/^(score|rating|value|grade|confidence|%)$/, 1),
    evidence: find(/^(evidence|notes?|why|comment|comments|reason|detail|details)$/, 2),
  };
}

/** A score as a share of the scale (0 to 1), or null when it says nothing. */
function share(text, scale) {
  var s = String(text == null ? '' : text).trim().replace(',', '.');
  if (!s) return null;
  var frac = /^(-?\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/.exec(s);
  if (frac) return Number(frac[2]) > 0 ? Number(frac[1]) / Number(frac[2]) : null;
  var pct = /^(-?\d+(?:\.\d+)?)\s*%$/.exec(s);
  if (pct) return Number(pct[1]) / 100;
  var n = Number(s);
  if (!Number.isFinite(n)) return null;
  return n / scale;
}

function clamp01(n) { return Math.min(1, Math.max(0, n)); }

function format(p, scale) {
  if (scale === 1 || scale === 100) return Math.round(p * 100) + '%';
  var n = Math.round(p * scale * 10) / 10;
  return n + '/' + scale;
}

function compute(v) {
  var scale = Number(v.scale) || 1;
  var table = v.criteria && typeof v.criteria === 'object' ? v.criteria : { columns: [], rows: [] };
  var at = columnsOf(table.columns);
  var known = [];
  var rows = (Array.isArray(table.rows) ? table.rows : [])
    .filter(function (row) { return Array.isArray(row) && String(row[at.name] == null ? '' : row[at.name]).trim(); })
    .slice(0, 16)
    .map(function (row) {
      var cell = function (k) { return String(row[k] == null ? '' : row[k]).trim(); };
      var name = cell(at.name);
      var p = share(cell(at.score), scale);
      if (p !== null) { p = clamp01(p); known.push(p); }
      return {
        name: name,
        initial: Array.from(name)[0].toUpperCase(),
        evidence: cell(at.evidence),
        known: p !== null,
        width: p === null ? '0%' : Math.round(p * 1000) / 10 + '%',
        scoreText: p === null ? 'Not yet' : format(p, scale),
        level: p === null ? 'is-unknown' : p < 0.4 ? 'is-low' : p < 0.7 ? 'is-mid' : 'is-high',
      };
    });
  var avg = known.length ? known.reduce(function (a, b) { return a + b; }, 0) / known.length : null;
  return {
    rows: rows,
    perColumn: String(Math.max(1, Math.ceil(rows.length / 2))),
    showOverall: v.overall !== false && avg !== null,
    overallText: avg === null ? '' : format(avg, scale),
    overallWidth: avg === null ? '0%' : Math.round(avg * 1000) / 10 + '%',
    knownText: known.length + ' of ' + rows.length + ' scored',
  };
}

function _args(model) {
  return Object.fromEntries(model.map(function (i) { return [i.id, i.value]; }));
}

// biome-ignore lint/correctness/noUnusedVariables: The engine calls this named hook.
function onInit({ model }) {
  return compute(_args(model));
}

// biome-ignore lint/correctness/noUnusedVariables: The engine calls this named hook.
function onInput({ model }) {
  return compute(_args(model));
}
