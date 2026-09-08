/* global onInit, onInput, exportFile */
var _pagesPreviewKey = '';
var _pagesPreview = null;
var _pagesJobKey = '';
var _pagesJob = null;
var _sourceIds = new WeakMap(), _sourceSeq = 0, _documents = new WeakMap();
function sourceId(f) { if (!_sourceIds.has(f.bytes)) _sourceIds.set(f.bytes, ++_sourceSeq); return _sourceIds.get(f.bytes); }
var PREVIEW_PAGE_CAP = 30;

function values(model) { var out = {}; model.forEach(function (i) { out[i.id] = i.value; }); return out; }
function sourceFiles(v) {
  var list = Array.isArray(v.source) ? v.source : (v.source ? [v.source] : []);
  return list.filter(function (f) { return f && f.bytes; });
}
function pdfMagic(b) {
  if (!b) return false;
  for (var i = 0; i <= Math.min(1024, b.length - 5); i++) {
    if (b[i] === 37 && b[i + 1] === 80 && b[i + 2] === 68 && b[i + 3] === 70 && b[i + 4] === 45) return true;
  }
  return false;
}
function fmt(n) {
  if (!(n >= 0)) return '';
  if (n < 1024) return n + ' B';
  var u = ['KB', 'MB', 'GB'], x = n, p = -1;
  do { x /= 1024; p++; } while (x >= 1024 && p < 2);
  return (x < 10 ? x.toFixed(1) : Math.round(x)) + ' ' + u[p];
}
function basename(name) { return String(name || 'document').replace(/\.pdf$/i, ''); }
function selected(expr, page, total) {
  var parts = String(expr || '').split(',');
  for (var i = 0; i < parts.length; i++) {
    var m = /^\s*(\d+)(?:-(\d*))?\s*$/.exec(parts[i]);
    if (!m) continue;
    var a = Number(m[1]), b = m[2] === undefined ? a : (m[2] ? Number(m[2]) : total);
    if (page >= Math.min(a, b) && page <= Math.max(a, b)) return true;
  }
  return false;
}
function pageOrder(expr, total) {
  var text = String(expr || '').trim();
  if (!text) return Array.from({ length: total }, function (_, i) { return i + 1; });
  var out = [];
  text.split(',').forEach(function (part) {
    var m = /^\s*(\d+)(?:-(\d*))?\s*$/.exec(part);
    if (!m) return;
    var from = Number(m[1]), to = m[2] === undefined ? from : (m[2] ? Number(m[2]) : total);
    if (from < 1 || from > total || to < 1 || to > total) return;
    var step = from <= to ? 1 : -1;
    for (var n = from; ; n += step) { out.push(n); if (n === to) break; }
  });
  return out;
}
function options(v) {
  var fs = sourceFiles(v);
  return {
    operation: v.operation,
    pages: String(v.pages || ''),
    rotation: Number(v.rotation) || 90,
    extras: fs.slice(1).map(function (f) { return f.bytes; })
  };
}
function key(v) {
  return [sourceFiles(v).map(function (f) { return [sourceId(f), f.name, f.size].join(':'); }).join(';'), v.operation, v.pages, v.rotation].join('|');
}
function job(host, v) {
  var fs = sourceFiles(v), k = key(v);
  if (_pagesJobKey === k && _pagesJob) return _pagesJob;
  _pagesJobKey = k;
  _pagesJob = Promise.resolve().then(function () { return host.pdf.organize(fs[0].bytes, options(v)); });
  return _pagesJob;
}
function fittedSize(width, height) {
  var w = Math.max(1, Number(width) || 612), h = Math.max(1, Number(height) || 792);
  var scale = Math.min(142 / w, 205 / h);
  return { width: Math.max(24, Math.round(w * scale)), height: Math.max(24, Math.round(h * scale)) };
}
async function previews(host, fs, v) {
  var documents = [], offset = 0;
  for (var i = 0; i < fs.length; i++) {
    var f = fs[i], cached = _documents.get(f.bytes);
    if (!cached) {
      cached = host.pdf.pages(f.bytes, { maxPages: 1 }).then(function (result) {
        var cache = new Map(); result.pages.forEach(function (p) { cache.set(p.page, p); });
        return { total: Number(result.totalPages) || result.pages.length, cache: cache };
      });
      _documents.set(f.bytes, cached);
    }
    var doc = await cached;
    documents.push({ index: i, number: i + 1, name: f.name || ('Document ' + (i + 1) + '.pdf'),
      pageLabel: doc.total + ' pages', total: doc.total, offset: offset, cache: doc.cache });
    offset += doc.total;
  }
  var order = v.operation === 'reorder' ? pageOrder(v.pages, offset) : pageOrder('', offset);
  var windowStart = Math.min(Math.max(0, Math.round(Number(v.previewPage) || 1) - 1), Math.max(0, order.length - 1));
  var visible = order.slice(windowStart, windowStart + PREVIEW_PAGE_CAP), pages = [], unavailable = false;
  for (var d = 0; d < documents.length; d++) {
    var document = documents[d];
    var wanted = visible.filter(function (n) { return n > document.offset && n <= document.offset + document.total; })
      .map(function (n) { return n - document.offset; }).filter(function (n) { return !document.cache.has(n); });
    if (wanted.length) {
      try {
        var rendered = await host.pdf.pages(fs[d].bytes, { maxPages: PREVIEW_PAGE_CAP, pageNumbers: wanted });
        rendered.pages.forEach(function (p) { document.cache.set(p.page, p); });
        while (document.cache.size > 90) document.cache.delete(document.cache.keys().next().value);
      } catch (e) { unavailable = true; }
    }
  }
  visible.forEach(function (n, at) {
    var doc = documents.find(function (d) { return n > d.offset && n <= d.offset + d.total; });
    var local = n - doc.offset, p = doc.cache.get(local), fit = fittedSize(p && p.widthPt, p && p.heightPt);
    var occurrence = windowStart + at, prefix = 'pg' + doc.number + 'o' + occurrence + '-';
    var svg = p ? p.svg.replace(/id="([^"]+)"/g, 'id="' + prefix + '$1"')
      .replace(/url\(#([^)]*)\)/g, 'url(#' + prefix + '$1)').replace(/href="#([^"]+)"/g, 'href="#' + prefix + '$1"') : '';
    if (!p) unavailable = true;
    pages.push({ page: n, occurrence: occurrence, ordinal: occurrence + 1, localPage: local, document: doc.number,
      sourceName: doc.name, svg: svg, previewWidth: fit.width, previewHeight: fit.height,
      chosen: selected(v.pages, n, offset), first: occurrence === 0, last: occurrence === order.length - 1,
      sizeLabel: p ? Math.round(p.widthPt) + ' × ' + Math.round(p.heightPt) + ' pt' : 'Preview unavailable' });
  });
  return { pages: pages, documents: documents, totalPages: offset, unavailable: unavailable,
    previewStart: windowStart + 1, previewEnd: windowStart + visible.length, orderLength: order.length,
    previousWindow: Math.max(1, windowStart + 1 - PREVIEW_PAGE_CAP), nextWindow: windowStart + 1 + PREVIEW_PAGE_CAP,
    hasPrevious: windowStart > 0, hasNext: windowStart + visible.length < order.length };
}
async function compute(ctx) {
  var v = values(ctx.model), fs = sourceFiles(v);
  var out = {
    hasFile: false, valid: false, available: false, fileName: '', fileSize: '', fileCount: 0,
    archiveName: 'pages.zip', error: '', preview: [], documents: [], previewUnavailable: false,
    ready: false, pending: false, summary: '', sizeAfter: '', operations: '', operation: String(v.operation || 'reorder'),
    pagesText: String(v.pages || ''), rotationText: String(v.rotation || '90'), totalPages: 0,
    isReorder: v.operation === 'reorder', isRotate: v.operation === 'rotate', isSplit: v.operation === 'split',
    canSelect: v.operation === 'rotate' || v.operation === 'extract' || v.operation === 'delete',
    selectionLabel: v.operation === 'reorder' ? 'Page order' : (v.operation === 'split' ? 'Split groups' : 'Selected pages'),
    pagesHelp: v.operation === 'reorder' ? 'Drag previews or use the arrow buttons. Exact order is kept.' :
      (v.operation === 'split' ? 'Each comma-separated page or range becomes a PDF.' : 'Click or press Space to toggle a page. Use the range field for exact selections.')
  };
  if (!fs.length) return out;
  out.hasFile = true;
  out.fileCount = fs.length;
  out.fileName = fs.length === 1 ? (fs[0].name || 'document.pdf') : fs.length + ' PDFs';
  var totalBytes = fs.reduce(function (n, f) { return n + (f.size || f.bytes.length); }, 0);
  out.fileSize = fmt(totalBytes);
  out.archiveName = basename(fs[0].name) + '-split.zip';
  out.documents = fs.map(function (f, index) {
    return { index: index, number: index + 1, name: f.name || ('Document ' + (index + 1) + '.pdf'), pageLabel: 'PDF' };
  });
  for (var i = 0; i < fs.length; i++) {
    if (!pdfMagic(fs[i].bytes)) { out.error = (fs[i].name || 'One selected file') + ' is not a PDF.'; return out; }
  }
  out.valid = true;
  if (!ctx.host || !ctx.host.pdf || typeof ctx.host.pdf.organize !== 'function') {
    out.error = 'PDF page editing is not available in this app.';
    return out;
  }
  out.available = true;
  if (!String(v.pages || '').trim() && out.canSelect) { out.error = 'Select at least one page.'; return out; }
  out.pending = true;
  if (ctx.report) ctx.report(out);
  if (typeof ctx.host.pdf.pages === 'function') {
    try {
      var p = await previews(ctx.host, fs, v);
      out.documents = p.documents; out.totalPages = p.totalPages; out.previewUnavailable = p.unavailable;
      out.preview = p.pages;
      ['previewStart','previewEnd','orderLength','previousWindow','nextWindow','hasPrevious','hasNext'].forEach(function (k) { out[k] = p[k]; });
      if (ctx.report) ctx.report(out);
    } catch (e) { out.previewUnavailable = true; out.previewError = String(e && e.message || e); }
  } else out.previewUnavailable = true;
  try {
    var res = await job(ctx.host, v);
    out.ready = true;
    out.summary = res.beforePages + ' pages → ' + res.afterPages + ' pages';
    out.sizeAfter = fmt(res.afterBytes);
    out.operations = res.operations.join(' · ');
  } catch (e) { out.error = String(e && e.message || e).replace(/^pdf:\s*/, ''); }
  out.pending = false;
  return out;
}
function onInit(ctx) { return compute(ctx); }
function onInput(ctx) { return compute(ctx); }
async function exportFile(ctx) {
  var v = values(ctx.model), fs = sourceFiles(v);
  if (!fs.length) throw new Error('Choose at least one PDF first.');
  for (var i = 0; i < fs.length; i++) if (!pdfMagic(fs[i].bytes)) throw new Error((fs[i].name || 'One selected file') + ' is not a PDF.');
  if (!ctx.host || !ctx.host.pdf || typeof ctx.host.pdf.organize !== 'function') throw new Error('PDF page editing is not available in this app.');
  var res = await job(ctx.host, v), base = basename(fs[0].name);
  if (res.files) return res.files.map(function (part, index) {
    var label = part.pages.length === 1 ? String(part.pages[0]) : part.pages[0] + '-' + part.pages[part.pages.length - 1];
    return { bytes: part.bytes, mime: 'application/pdf', filename: base + '-pages-' + label + (res.files.length > 1 ? '-' + (index + 1) : '') + '.pdf' };
  });
  return { bytes: res.bytes, mime: 'application/pdf', filename: base + '-' + v.operation + '.pdf' };
}
