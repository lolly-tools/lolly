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
  var v = _args(model);
  return compute(v, await workedOut(v));
}

// biome-ignore lint/correctness/noUnusedVariables: The engine calls this named hook.
async function onInput({ model }) {
  var v = _args(model);
  return compute(v, await workedOut(v));
}
