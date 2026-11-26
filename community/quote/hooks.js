/* global host */
/**
 * Quote hooks.
 *
 * Reads the `lines` table into the rows the logic-less template prints, each
 * with its total, and works out the subtotal, the discount, the tax and the
 * amount due. DOM-free, so the CLI and the tests run the same path as the web
 * shell. Nothing here throws: a cell that is not a number reads as missing.
 *
 * The table convention, mirrored in the input help:
 *   columns         an item, a quantity and a unit price, found by heading
 *                   (Quantity/Qty, Unit price/Price) and otherwise taken as
 *                   the first three columns in that order
 *   unit price      empty: the item is priced later and stays out of the totals
 *   quantity        "?": a number still to be decided; that line's total and the
 *                   totals below show an ellipsis until it is set
 *
 * Numbers read the way people paste them: "2,672", "€ 2.672,50", "1 200".
 *
 * Formulas: a cell that starts with "=" is worked out by host.calc when the shell
 * has it (the heading row is row 1, so the first line is row 2: "=B2*0.9" takes
 * ten percent off the quantity of the first line). Without host.calc the cell
 * reads as missing, like any other text that is not a number. A formula that
 * fails shows "Check formula" and holds the totals back, like "?". Volatile
 * functions such as NOW and RAND are read once per edit: they stay live while
 * the table is edited, and an export prints the numbers on the page, never a
 * second evaluation.
 */

var LOCALE_FOR = {
  EUR: 'en-IE', USD: 'en-US', GBP: 'en-GB', CHF: 'de-CH', JPY: 'ja-JP',
  AUD: 'en-AU', CAD: 'en-CA', SEK: 'sv-SE', INR: 'en-IN',
};
var PENDING = '…';

/** A pasted amount as a number, or null. A lone separator followed by exactly
 *  three digits is a thousands separator ("2,672"); otherwise the last separator
 *  is the decimal point ("2.672,50", "1,5"). */
function readNumber(text) {
  // A formula nothing worked out is not a number: reading its digits would turn "=2*5" into 25.
  if (/^\s*=/.test(String(text == null ? '' : text))) return null;
  var s = String(text == null ? '' : text).replace(/[^0-9.,-]/g, '');
  if (!s || s === '-') return null;
  var lastDot = s.lastIndexOf('.'), lastComma = s.lastIndexOf(',');
  var sep = Math.max(lastDot, lastComma);
  if (sep >= 0) {
    var tail = s.slice(sep + 1);
    var onlyOne = s.indexOf(s[sep]) === sep && (lastDot < 0 || lastComma < 0);
    if (onlyOne && tail.length === 3) s = s.replace(/[.,]/g, '');
    else s = s.slice(0, sep).replace(/[.,]/g, '') + '.' + tail;
  }
  var n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function formatter(currency) {
  var code = LOCALE_FOR[currency] ? currency : 'EUR';
  var whole = new Intl.NumberFormat(LOCALE_FOR[code], { style: 'currency', currency: code, maximumFractionDigits: 0 });
  var cents = new Intl.NumberFormat(LOCALE_FOR[code], { style: 'currency', currency: code });
  return function (n) { return (Math.round(n * 100) % 100 === 0 ? whole : cents).format(n); };
}

function formatDate(value, currency) {
  if (!value || !/^\d{4}-\d{2}-\d{2}/.test(String(value))) return '';
  var d = new Date(String(value).slice(0, 10) + 'T12:00:00Z');
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(LOCALE_FOR[currency] || 'en-IE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d);
}

/** Which column holds what: by heading when it says, else 0, 1 and 2. */
function columnsOf(columns) {
  var names = (columns || []).map(function (c) { return String(c || '').trim().toLowerCase(); });
  var find = function (re, fallback) {
    for (var i = 0; i < names.length; i++) if (re.test(names[i])) return i;
    return fallback;
  };
  var qty = find(/^(quantity|qty|units?|seats?|amount)$/, 1);
  var unit = find(/^(unit ?price|price|rate|each|unit cost|cost)$/, 2);
  var item = find(/^(item|product|description|line|service)$/, 0);
  return { item: item, qty: qty, unit: unit };
}

function hasFormula(table) {
  return (Array.isArray(table.rows) ? table.rows : []).some(function (row) {
    return Array.isArray(row) && row.some(function (c) { return typeof c === 'string' && c.length > 1 && c.charAt(0) === '='; });
  });
}

/** The table with its formula cells worked out, and the cells whose formula failed. */
async function workedOut(v) {
  var table = v.lines && typeof v.lines === 'object' ? v.lines : { columns: [], rows: [] };
  if (!hasFormula(table) || typeof host === 'undefined' || !host || !host.calc) return { table: table, failed: {} };
  try {
    var out = await host.calc.table({ columns: table.columns || [], rows: table.rows || [] });
    var failed = {};
    out.errors.forEach(function (e) { failed[e.row + ':' + e.col] = true; });
    return { table: out.table, failed: failed };
  } catch (error) {
    return { table: table, failed: {} };
  }
}

function compute(v, calculated) {
  var table = calculated.table;
  var columns = Array.isArray(table.columns) ? table.columns : [];
  var at = columnsOf(columns);
  var money = formatter(v.currency);
  var picked = Math.round(Number(v.highlight) || 0);
  var subtotal = 0, waiting = false;
  var rowIndexes = [];
  var lines = (Array.isArray(table.rows) ? table.rows : [])
    .filter(function (row, index) {
      var kept = Array.isArray(row) && row.some(function (c) { return String(c == null ? '' : c).trim(); });
      if (kept) rowIndexes.push(index);
      return kept;
    })
    .map(function (row, i) {
      var cell = function (k) { return String(row[k] == null ? '' : row[k]).trim(); };
      var qtyText = cell(at.qty), unitText = cell(at.unit);
      var qty = readNumber(qtyText), unit = readNumber(unitText);
      var broken = false;
      for (var key in calculated.failed) {
        var at2 = key.split(':');
        // The failed key counts rows of the table's body, which is the order the unfiltered rows have.
        if (Number(at2[0]) === rowIndexes[i] && (Number(at2[1]) === at.qty || Number(at2[1]) === at.unit)) broken = true;
      }
      if (broken) qty = null;
      var pricedLater = unit === null && !broken;
      var pending = !pricedLater && qty === null;
      var total = !pricedLater && !pending ? qty * unit : null;
      if (total !== null) subtotal += total;
      if (pending) waiting = true;
      return {
        item: cell(at.item),
        qtyText: qty === null ? (qtyText || '?') : qty.toLocaleString(LOCALE_FOR[v.currency] || 'en-IE'),
        unitText: pricedLater ? '-' : money(unit),
        totalText: pricedLater ? 'Priced later' : broken ? 'Check formula' : pending ? PENDING : money(total),
        pending: pending,
        pricedLater: pricedLater,
        highlight: picked === i + 1,
      };
    });
  var discount = Math.min(100, Math.max(0, Number(v.discount) || 0));
  var tax = Math.min(100, Math.max(0, Number(v.tax) || 0));
  var discountAmount = subtotal * discount / 100;
  var taxAmount = (subtotal - discountAmount) * tax / 100;
  var due = subtotal - discountAmount + taxAmount;
  var shown = function (n) { return waiting ? PENDING : money(n); };
  return {
    quoteLines: lines,
    itemHead: String(columns[at.item] || 'Item'),
    qtyHead: String(columns[at.qty] || 'Quantity'),
    unitHead: String(columns[at.unit] || 'Unit price'),
    subtotalText: shown(subtotal),
    hasDiscount: discount > 0,
    discountText: shown(discountAmount),
    hasTax: tax > 0,
    taxText: shown(taxAmount),
    taxName: String(v.taxLabel || 'Tax'),
    dueText: shown(due),
    dateText: formatDate(v.date, v.currency),
    validText: formatDate(v.validUntil, v.currency),
  };
}

function _args(model) {
  return Object.fromEntries(model.map(function (i) { return [i.id, i.value]; }));
}

// biome-ignore lint/correctness/noUnusedVariables: The engine calls this named hook.
async function onInit({ model }) {
  return surfaceRender(model);
}

// biome-ignore lint/correctness/noUnusedVariables: The engine calls this named hook.
async function onInput({ model }) {
  return surfaceRender(model);
}

async function surfaceRender(model) {
  var values = _args(model);
  var palette = await toolSurface(values, {});
  return Object.assign(await compute(values, await workedOut(values)), palette);
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
