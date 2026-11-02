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

function compute(v) {
  var table = v.lines && typeof v.lines === 'object' ? v.lines : { columns: [], rows: [] };
  var columns = Array.isArray(table.columns) ? table.columns : [];
  var at = columnsOf(columns);
  var money = formatter(v.currency);
  var picked = Math.round(Number(v.highlight) || 0);
  var subtotal = 0, waiting = false;
  var lines = (Array.isArray(table.rows) ? table.rows : [])
    .filter(function (row) { return Array.isArray(row) && row.some(function (c) { return String(c == null ? '' : c).trim(); }); })
    .map(function (row, i) {
      var cell = function (k) { return String(row[k] == null ? '' : row[k]).trim(); };
      var qtyText = cell(at.qty), unitText = cell(at.unit);
      var qty = readNumber(qtyText), unit = readNumber(unitText);
      var pricedLater = unit === null;
      var pending = !pricedLater && qty === null;
      var total = !pricedLater && !pending ? qty * unit : null;
      if (total !== null) subtotal += total;
      if (pending) waiting = true;
      return {
        item: cell(at.item),
        qtyText: qty === null ? (qtyText || '?') : qty.toLocaleString(LOCALE_FOR[v.currency] || 'en-IE'),
        unitText: pricedLater ? '-' : money(unit),
        totalText: pricedLater ? 'Priced later' : pending ? PENDING : money(total),
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
function onInit({ model }) {
  return compute(_args(model));
}

// biome-ignore lint/correctness/noUnusedVariables: The engine calls this named hook.
function onInput({ model }) {
  return compute(_args(model));
}
