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
  return surfaceRender(model);
}

// biome-ignore lint/correctness/noUnusedVariables: The engine calls this named hook.
function onInput({ model }) {
  return surfaceRender(model);
}

async function surfaceRender(model) {
  var values = _args(model);
  var palette = await toolSurface(values, {});
  return Object.assign(await compute(values), palette);
}

// === lolly:shared tool-surface - generated from community/_shared/tool-surface.js; edit there and run pnpm run sync:shared ===
function surfaceHex(value, fallback) {
  if (value && typeof value === 'object' && Array.isArray(value.components)) {
    var space = value.colorSpace || 'srgb';
    if (space === 'srgb' && value.components.length === 3 && value.components.every(Number.isFinite)) {
      value = '#' + value.components.map(function (n) { return Math.round(Math.max(0, Math.min(1, n)) * 255).toString(16).padStart(2, '0'); }).join('');
    } else value = 'color(' + space + ' ' + value.components.join(' ') + ')';
  }
  if (host.color && typeof host.color.mix === 'function') {
    try {
      var normalized = host.color.mix(String(value), String(value), 0);
      if (normalized && /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(normalized)) return normalized.slice(0, 7);
    } catch (_) { /* Try the plain hex form below. */ }
  }
  var match = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(String(value || '').trim());
  if (!match) return fallback;
  var hex = match[1];
  if (hex.length === 3) hex = hex.split('').map(function (c) { return c + c; }).join('');
  return '#' + hex.slice(0, 6).toLowerCase();
}

function surfaceMix(a, b, amount) {
  if (host.color && typeof host.color.mix === 'function') {
    try { return surfaceHex(host.color.mix(a, b, amount), a); } catch (_) { /* Use sRGB below. */ }
  }
  return '#' + [1, 3, 5].map(function (at) {
    var first = parseInt(a.slice(at, at + 2), 16);
    var last = parseInt(b.slice(at, at + 2), 16);
    return Math.round(first + (last - first) * amount).toString(16).padStart(2, '0');
  }).join('');
}

function surfaceContrast(a, b) {
  function luminance(hex) {
    var channels = [1, 3, 5].map(function (at) {
      var c = parseInt(hex.slice(at, at + 2), 16) / 255;
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  }
  var x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

function surfaceReadable(preferred, ground, alternatives) {
  if (surfaceContrast(preferred, ground) >= 4.5) return preferred;
  var choices = alternatives.concat(['#111111', '#ffffff']);
  return choices.reduce(function (best, colour) {
    return surfaceContrast(colour, ground) > surfaceContrast(best, ground) ? colour : best;
  }, preferred);
}

async function toolSurface(values, aliases) {
  aliases = aliases || {};
  async function readToken(path) {
    try {
      if (host.tokens && typeof host.tokens.resolve === 'function') {
        return await host.tokens.resolve('{' + path + '}');
      }
      if (host.tokens && typeof host.tokens.get === 'function') {
        var set = await host.tokens.get();
        if (set && typeof set.resolve === 'function') return set.resolve('{' + path + '}');
      }
    } catch (_) { /* A tool without a design system still draws. */ }
    return null;
  }
  var colours = await Promise.all([
    readToken('color.semantic.primary'), readToken('color.semantic.on-primary'),
    readToken('color.semantic.surface'), readToken('color.semantic.text'),
  ]);
  colours = colours.map(function (c, i) { return surfaceHex(c, ['#2563eb', '#ffffff', '#f6f7f9', '#17232b'][i]); });
  var primary = surfaceHex(values[aliases.accent || 'accent'], colours[0]);
  var paper = surfaceHex(values[aliases.background || 'background'], colours[2]);
  var text = surfaceHex(values[aliases.ink || 'ink'], colours[3]);
  var ground = values.ground || 'tint';
  var fill = ground === 'lead' ? primary : ground === 'ink' ? text
    : ground === 'surface' ? paper : surfaceMix(paper, primary, 0.1);
  var ink = ground === 'lead' ? colours[1] : ground === 'ink' ? paper : text;
  ink = surfaceReadable(ink, fill, [text, paper, colours[1]]);
  var accent = primary;
  for (var amount = 0.1; surfaceContrast(accent, fill) < 4.5 && amount <= 1.01; amount += 0.1) {
    accent = surfaceMix(primary, ink, Math.min(1, amount));
  }
  var onAccent = surfaceReadable(colours[1], accent, [fill, text, paper]);
  var density = values.density || 'auto';
  var chars = JSON.stringify(['body', 'heading', 'subheading', 'quote', 'criteria', 'events', 'data',
    'directions', 'blocks', 'content', 'company', 'firstname', 'lastname', 'description', 'title']
    .map(function (key) { return values[key]; })).length;
  var spacing = density === 'compact' ? 0.78 : density === 'spacious' ? 1.16
    : density === 'comfortable' ? 1 : chars > 4500 ? 0.78 : chars > 2400 ? 0.9 : 1;
  var timing = await readToken('motion.duration.long');
  var ms = 700;
  if (typeof timing === 'number' && Number.isFinite(timing)) ms = timing;
  else if (timing && typeof timing === 'object' && typeof timing.value === 'number') {
    ms = timing.value * (timing.unit === 's' ? 1000 : 1);
  } else if (typeof timing === 'string') {
    var match = /^(\d+(?:\.\d+)?)(ms|s)$/.exec(timing.trim());
    if (match) ms = Number(match[1]) * (match[2] === 's' ? 1000 : 1);
  }
  var curve = await readToken('motion.curve.emphasised');
  if (!Array.isArray(curve) || curve.length !== 4 || !curve.every(Number.isFinite)
      || curve[0] < 0 || curve[0] > 1 || curve[2] < 0 || curve[2] > 1) curve = [0.2, 0, 0, 1];
  return {
    surfaceGround: values.transparentBg === true || values.transparentBg === 'true' ? 'transparent' : fill,
    surfacePaper: fill,
    surfaceInk: ink,
    surfaceAccent: accent,
    surfaceOnAccent: onAccent,
    surfaceMuted: surfaceMix(ink, fill, 0.22),
    surfaceEdge: surfaceMix(fill, ink, 0.2),
    surfacePanel: surfaceMix(fill, ink, 0.045),
    surfaceTint: surfaceMix(fill, accent, 0.12),
    surfaceSpacing: String(spacing),
    surfaceEnterSeconds: String(Math.max(0, Math.min(3000, ms)) / 1000),
    surfaceCurve: curve.join(','),
  };
}
// === /lolly:shared tool-surface ===
