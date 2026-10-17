/* global onInit, onInput, exportFile */
var _pagesPreviewKey = '';
var _pagesPreview = null;
var _pagesJobKey = '';
var _pagesJob = null;
var _sourceIds = new WeakMap(), _sourceSeq = 0, _documents = new WeakMap(), _imagePdfs = new WeakMap();
function sourceId(f) { if (!_sourceIds.has(f.bytes)) _sourceIds.set(f.bytes, ++_sourceSeq); return _sourceIds.get(f.bytes); }
var PREVIEW_PAGE_CAP = 30;
var PT_PER_MM = 72 / 25.4;

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
function ascii(b, at, text) {
  for (var i = 0; i < text.length; i++) if (b[at + i] !== text.charCodeAt(i)) return false;
  return true;
}
// PNG and JPEG go onto a page as they are. Other image formats are converted
// to PNG with host.images first.
function fileKind(f) {
  var b = f.bytes;
  if (b.length > 8 && b[0] === 0x89 && ascii(b, 1, 'PNG')) return 'image';
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image';
  if (pdfMagic(b)) return 'pdf';
  if (ascii(b, 0, 'GIF8') || (ascii(b, 0, 'RIFF') && ascii(b, 8, 'WEBP')) || ascii(b, 4, 'ftyp') || ascii(b, 0, 'BM')
    || ascii(b, 0, 'II*\0') || ascii(b, 0, 'MM\0*') || /^image\//i.test(String(f.mime || ''))) return 'convert';
  return '';
}
function fmt(n) {
  if (!(n >= 0)) return '';
  if (n < 1024) return n + ' B';
  var u = ['KB', 'MB', 'GB'], x = n, p = -1;
  do { x /= 1024; p++; } while (x >= 1024 && p < 2);
  return (x < 10 ? x.toFixed(1) : Math.round(x)) + ' ' + u[p];
}
function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
function basename(name) { return String(name || 'document').replace(/\.[^./\\]+$/, '') || 'document'; }
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
function imageOptions(v) {
  var size = v.imagePageSize === 'a4' || v.imagePageSize === 'letter' ? v.imagePageSize : 'image';
  var mm = Math.min(50, Math.max(0, Number(v.imageMargin) || 0));
  return { pageSize: size, margin: size === 'image' ? 0 : Math.round(mm * PT_PER_MM * 100) / 100 };
}
// One single-page PDF per image, cached by the image bytes and page options, so
// previews and the final page operation both treat it like any other PDF.
function documentFor(host, f, v) {
  var kind = fileKind(f);
  if (kind === 'pdf') return Promise.resolve({ bytes: f.bytes, image: false });
  var opts = imageOptions(v), k = opts.pageSize + ':' + opts.margin;
  var cache = _imagePdfs.get(f.bytes);
  if (!cache) { cache = new Map(); _imagePdfs.set(f.bytes, cache); }
  if (!cache.has(k)) {
    var made = Promise.resolve().then(function () {
      if (kind !== 'convert') return { bytes: f.bytes, converted: false };
      if (!host.images || typeof host.images.encode !== 'function') throw new Error((f.name || 'This image') + ' must be a PNG or JPEG in this app.');
      return host.images.encode(f.bytes, { format: 'png' }).then(function (r) { return { bytes: r.bytes, converted: true }; });
    }).then(function (picture) {
      return host.pdf.fromImages([{ bytes: picture.bytes }], opts).then(function (r) {
        return { bytes: r.bytes, image: true, converted: picture.converted, turned: r.turned || 0,
          metadataLeftOut: r.metadataLeftOut || 0, extraPicturesLeftOut: r.extraPicturesLeftOut || 0 };
      });
    });
    made.catch(function () { cache.delete(k); });
    cache.set(k, made);
    while (cache.size > 4) cache.delete(cache.keys().next().value);
  }
  return cache.get(k);
}
function imageNotes(docs) {
  var count = function (pick) { return docs.reduce(function (n, d) { return n + (pick(d) ? 1 : 0); }, 0); };
  var converted = count(function (d) { return d.converted; }), turned = count(function (d) { return d.turned; });
  var stripped = count(function (d) { return d.metadataLeftOut; }), extra = count(function (d) { return d.extraPicturesLeftOut; });
  var notes = [];
  if (converted) notes.push({ outcome: 'kept', message: 'Converted ' + plural(converted, 'image') + ' to PNG before placing ' + (converted === 1 ? 'it.' : 'them.') });
  if (turned) notes.push({ outcome: 'kept', message: 'Turned ' + plural(turned, 'photo') + ' upright using the camera orientation.' });
  if (stripped) notes.push({ outcome: 'removed', message: 'Left out photo details such as location and camera data from ' + plural(stripped, 'image') + '.' });
  if (extra) notes.push({ outcome: 'removed', message: 'Left out extra pictures stored after the main image in ' + plural(extra, 'file') + '.' });
  return notes;
}
function options(v, docs) {
  return {
    operation: v.operation,
    pages: String(v.pages || ''),
    rotation: Number(v.rotation) || 90,
    extras: docs.slice(1).map(function (d) { return d.bytes; })
  };
}
function key(v) {
  var image = imageOptions(v);
  return [sourceFiles(v).map(function (f) { return [sourceId(f), f.name, f.size].join(':'); }).join(';'), v.operation, v.pages, v.rotation,
    image.pageSize, image.margin].join('|');
}
function job(host, v, docs) {
  var k = key(v);
  if (_pagesJobKey === k && _pagesJob) return _pagesJob;
  _pagesJobKey = k;
  _pagesJob = Promise.resolve().then(function () { return host.pdf.organize(docs[0].bytes, options(v, docs)); });
  return _pagesJob;
}
function fittedSize(width, height) {
  var w = Math.max(1, Number(width) || 612), h = Math.max(1, Number(height) || 792);
  var scale = Math.min(142 / w, 205 / h);
  return { width: Math.max(24, Math.round(w * scale)), height: Math.max(24, Math.round(h * scale)) };
}
async function previews(host, fs, docs, v) {
  var documents = [], offset = 0;
  for (var i = 0; i < fs.length; i++) {
    var f = fs[i], bytes = docs[i].bytes, cached = _documents.get(bytes);
    if (!cached) {
      cached = host.pdf.pages(bytes, { maxPages: 1 }).then(function (result) {
        var cache = new Map(); result.pages.forEach(function (p) { cache.set(p.page, p); });
        return { total: Number(result.totalPages) || result.pages.length, cache: cache };
      });
      _documents.set(bytes, cached);
    }
    var doc = await cached;
    documents.push({ index: i, number: i + 1, name: f.name || ('Document ' + (i + 1) + '.pdf'), image: !!docs[i].image,
      pageLabel: docs[i].image ? 'Image' : plural(doc.total, 'page'), total: doc.total, offset: offset, cache: doc.cache });
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
        var rendered = await host.pdf.pages(docs[d].bytes, { maxPages: PREVIEW_PAGE_CAP, pageNumbers: wanted });
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
      origin: doc.image ? 'Image ' + doc.number : 'PDF ' + doc.number + ' · p' + local,
      sourceName: doc.name, svg: svg, previewWidth: fit.width, previewHeight: fit.height,
      chosen: selected(v.pages, n, offset), first: occurrence === 0, last: occurrence === order.length - 1,
      sizeLabel: p ? Math.round(p.widthPt) + ' × ' + Math.round(p.heightPt) + ' pt' : 'Preview unavailable' });
  });
  return { pages: pages, documents: documents, totalPages: offset, unavailable: unavailable,
    previewStart: windowStart + 1, previewEnd: windowStart + visible.length, orderLength: order.length,
    previousWindow: Math.max(1, windowStart + 1 - PREVIEW_PAGE_CAP), nextWindow: windowStart + 1 + PREVIEW_PAGE_CAP,
    hasPrevious: windowStart > 0, hasNext: windowStart + visible.length < order.length };
}
function errorText(e) { return String(e && e.message || e).replace(/^pdf:\s*/, ''); }
// Every check exportFile repeats before it runs: a readable file of each kind
// and the host methods those kinds need.
function sourceProblem(host, fs) {
  for (var i = 0; i < fs.length; i++) {
    if (!fileKind(fs[i])) return (fs[i].name || 'One selected file') + ' is not a PDF or an image.';
  }
  if (!host || !host.pdf || typeof host.pdf.organize !== 'function') return 'PDF page editing is not available in this app.';
  for (var j = 0; j < fs.length; j++) {
    if (fileKind(fs[j]) !== 'pdf' && typeof host.pdf.fromImages !== 'function') return 'Turning images into a PDF is not available in this app.';
  }
  return '';
}
async function compute(ctx) {
  var v = values(ctx.model), fs = sourceFiles(v);
  var image = imageOptions(v);
  var out = {
    hasFile: false, valid: false, available: false, fileName: '', fileSize: '', fileCount: 0,
    archiveName: 'pages.zip', error: '', preview: [], documents: [], previewUnavailable: false,
    ready: false, pending: false, summary: '', sizeAfter: '', operations: '', operation: String(v.operation || 'reorder'),
    pagesText: String(v.pages || ''), rotationText: String(v.rotation || '90'), totalPages: 0,
    hasImages: false, imagePageSize: image.pageSize, imageMarginText: String(Math.min(50, Math.max(0, Number(v.imageMargin) || 0))),
    fitsPaper: image.pageSize !== 'image', changes: [], hasChanges: false,
    isReorder: v.operation === 'reorder', isRotate: v.operation === 'rotate', isSplit: v.operation === 'split',
    canSelect: v.operation === 'rotate' || v.operation === 'extract' || v.operation === 'delete',
    selectionLabel: v.operation === 'reorder' ? 'Page order' : (v.operation === 'split' ? 'Split groups' : 'Selected pages'),
    pagesHelp: v.operation === 'reorder' ? 'Drag previews or use the arrow buttons. Exact order is kept.' :
      (v.operation === 'split' ? 'Each comma-separated page or range becomes a PDF.' : 'Click or press Space to toggle a page. Use the range field for exact selections.')
  };
  if (!fs.length) return out;
  out.hasFile = true;
  out.fileCount = fs.length;
  out.fileName = fs.length === 1 ? (fs[0].name || 'document.pdf') : plural(fs.length, 'file');
  var totalBytes = fs.reduce(function (n, f) { return n + (f.size || f.bytes.length); }, 0);
  out.fileSize = fmt(totalBytes);
  out.archiveName = basename(fs[0].name) + '-split.zip';
  out.hasImages = fs.some(function (f) { var k = fileKind(f); return k === 'image' || k === 'convert'; });
  out.documents = fs.map(function (f, index) {
    var k = fileKind(f);
    return { index: index, number: index + 1, name: f.name || ('Document ' + (index + 1) + '.pdf'), pageLabel: k === 'pdf' ? 'PDF' : 'Image' };
  });
  var problem = sourceProblem(ctx.host, fs);
  out.valid = fs.every(function (f) { return !!fileKind(f); });
  if (problem) { out.error = problem; return out; }
  out.available = true;
  if (!String(v.pages || '').trim() && out.canSelect) { out.error = 'Select at least one page.'; return out; }
  out.pending = true;
  if (ctx.report) ctx.report(out);
  var docs;
  try { docs = await Promise.all(fs.map(function (f) { return documentFor(ctx.host, f, v); })); }
  catch (e) { out.error = errorText(e); out.pending = false; return out; }
  var notes = imageNotes(docs);
  if (typeof ctx.host.pdf.pages === 'function') {
    try {
      var p = await previews(ctx.host, fs, docs, v);
      out.documents = p.documents; out.totalPages = p.totalPages; out.previewUnavailable = p.unavailable;
      out.preview = p.pages;
      ['previewStart','previewEnd','orderLength','previousWindow','nextWindow','hasPrevious','hasNext'].forEach(function (k) { out[k] = p[k]; });
      if (ctx.report) ctx.report(out);
    } catch (e) { out.previewUnavailable = true; out.previewError = errorText(e); }
  } else out.previewUnavailable = true;
  try {
    var res = await job(ctx.host, v, docs);
    out.ready = true;
    var allImages = docs.every(function (d) { return d.image; });
    out.summary = allImages ? plural(fs.length, 'image') + ' → ' + plural(res.afterPages, 'page') : res.beforePages + ' pages → ' + res.afterPages + ' pages';
    out.sizeAfter = fmt(res.afterBytes);
    out.operations = res.operations.join(' · ');
    out.changes = notes.concat((res.effects || []).map(function (e) { return { outcome: e.outcome, message: e.message }; }));
    out.hasChanges = out.changes.length > 0;
  } catch (e) { out.error = errorText(e); }
  out.pending = false;
  return out;
}
function onInit(ctx) { return compute(ctx); }
function onInput(ctx) { return compute(ctx); }
async function exportFile(ctx) {
  var v = values(ctx.model), fs = sourceFiles(v);
  if (!fs.length) throw new Error('Choose at least one PDF or image first.');
  var problem = sourceProblem(ctx.host, fs);
  if (problem) throw new Error(problem);
  var docs = await Promise.all(fs.map(function (f) { return documentFor(ctx.host, f, v); }));
  var res = await job(ctx.host, v, docs), base = basename(fs[0].name);
  if (res.files) return res.files.map(function (part, index) {
    var label = part.pages.length === 1 ? String(part.pages[0]) : part.pages[0] + '-' + part.pages[part.pages.length - 1];
    return { bytes: part.bytes, mime: 'application/pdf', filename: base + '-pages-' + label + (res.files.length > 1 ? '-' + (index + 1) : '') + '.pdf' };
  });
  var allImages = docs.every(function (d) { return d.image; });
  var name = allImages && (v.operation === 'reorder' || v.operation === 'merge') ? base + '.pdf' : base + '-' + v.operation + '.pdf';
  return { bytes: res.bytes, mime: 'application/pdf', filename: name };
}
