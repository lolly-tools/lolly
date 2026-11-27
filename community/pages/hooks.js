/* global onInit, onInput, exportFile */
// Pages holds three kinds of work on one file input, chosen by `operation`:
// the page operations (reorder, rotate, extract, delete, merge, split), Compress
// and Sign. Each has its own compute and export below, and one dispatcher at
// the foot of the file calls the one the operation asks for. Compress and Sign
// work on one PDF, the first in the list.
var _pagesPreviewKey = '';
var _pagesPreview = null;
var _pagesJobKey = '';
var _pagesJob = null;
var _sourceIds = new WeakMap(), _sourceSeq = 0, _documents = new WeakMap(), _imagePdfs = new WeakMap();
function sourceId(f) { if (!_sourceIds.has(f.bytes)) _sourceIds.set(f.bytes, ++_sourceSeq); return _sourceIds.get(f.bytes); }
var PREVIEW_PAGE_CAP = 30;
var PT_PER_MM = 72 / 25.4;

// ── Shared by the three kinds of work ───────────────────────────────────────

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
// An APNG announces its animation in an acTL chunk before the first IDAT.
function animatedPng(b) {
  for (var at = 8, n = 0; n < 4096 && at + 8 <= b.length; n++) {
    if (ascii(b, at + 4, 'acTL')) return true;
    if (ascii(b, at + 4, 'IDAT')) return false;
    at += 12 + b[at] * 16777216 + (b[at + 1] << 16) + (b[at + 2] << 8) + b[at + 3];
  }
  return false;
}
// PNG and JPEG go onto a page as they are. Other image formats, and an animated
// PNG (which becomes its still picture), are converted to PNG with host.images
// first.
function fileKind(f) {
  var b = f.bytes;
  if (b.length > 8 && b[0] === 0x89 && ascii(b, 1, 'PNG')) return animatedPng(b) ? 'convert' : 'image';
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
// The first PDF in the list: the one file Compress and Sign work on.
function firstPdf(fs) { for (var i = 0; i < fs.length; i++) if (pdfMagic(fs[i].bytes)) return fs[i]; return null; }
// The file chips for a one-PDF operation, each with its size. With more than
// one file loaded, a line says which one the work is done on.
function onePdfFacts(o, fs, f, done) {
  var shown = f || fs[0];
  o.hasFile = true; o.fileCount = fs.length;
  o.fileName = shown.name || 'document.pdf';
  o.documents = fs.map(function (file, index) {
    return { index: index, number: fs.length > 1 ? index + 1 : '', name: file.name || ('Document ' + (index + 1) + '.pdf'), pageLabel: fmt(file.size || file.bytes.length) };
  });
  o.onlyFirst = f && fs.length > 1 ? 'Only ' + o.fileName + ' is ' + done + '.' : '';
}

// === lolly:shared signedPdf - generated from community/_shared/signed-pdf.js; edit there and run pnpm run sync:shared ===
// A tool that saves a PDF again breaks a digital signature made over the old
// bytes. The shell's analysis (host.pdf.analyze) reports a filled signature
// field as a "Digital signature" finding; an empty signature field is not one.
// Each tool shows one sentence above its download button and logs the same
// sentence on export, which is how the command line prints the warning.
function signedPdfFound(findings) {
  return (findings || []).some(function (x) { return x && x.label === 'Digital signature'; });
}
// `names` holds the signed files the tool saves again, `loaded` the number of
// files loaded. One file loaded reads "This PDF"; several give the file names.
function signedPdfSentence(names, loaded) {
  if (!names || !names.length) return '';
  if (names.length === 1) {
    return (loaded === 1 ? 'This PDF' : names[0]) + ' is digitally signed: its signature will not verify on the saved copy, and the original file is not changed.';
  }
  return names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1]
    + ' are digitally signed: their signatures will not verify on the saved copy, and the original files are not changed.';
}
// What the template draws: the sentence in muted ink around the two words
// "digitally signed", which the template sets in the alert ink.
function signedPdfLine(note) {
  var mark = 'digitally signed', at = note ? note.indexOf(mark) : -1;
  if (at < 0) return { signedNote: '', signedLead: '', signedRest: '' };
  return { signedNote: note, signedLead: note.slice(0, at), signedRest: note.slice(at + mark.length) };
}
// The findings list still lists the signature. The consequence is left to the
// line above the button, so the point is made once.
function signedPdfFindings(findings) {
  return (findings || []).map(function (x) {
    if (!x || x.label !== 'Digital signature') return x;
    return Object.assign({}, x, { detail: String(x.detail || '').replace(/ - re-saving this file invalidates it$/, '') });
  });
}
// === /lolly:shared signedPdf ===

// ── A PDF that already carries a digital signature ──────────────────────────
// Every operation saves the PDF again, and a signature made over the old bytes
// does not verify on the new file. The shell's own analysis says whether a
// signature field is filled, so nothing here reads the PDF. One answer is kept
// per file. An app without the analysis gives no answer and no line is shown.
var _signedPdfs = new WeakMap();
function isSigned(host, f) {
  if (!host || !host.pdf || typeof host.pdf.analyze !== 'function' || fileKind(f) !== 'pdf') return Promise.resolve(false);
  if (!_signedPdfs.has(f.bytes)) {
    var asked = Promise.resolve().then(function () { return host.pdf.analyze(f.bytes); }).then(function (r) {
      return signedPdfFound(r && r.findings);
    });
    asked.catch(function () { _signedPdfs.delete(f.bytes); });
    _signedPdfs.set(f.bytes, asked);
  }
  return _signedPdfs.get(f.bytes).catch(function () { return false; });
}
// The one sentence shown above the download button and printed by the command
// line. `worked` holds the files the operation saves again. With one file
// loaded the sentence says "This PDF"; with several, the signed files by name.
async function signedNote(host, worked, loaded) {
  var names = [];
  for (var i = 0; i < worked.length; i++) {
    if (await isSigned(host, worked[i])) names.push(worked[i].name || 'document.pdf');
  }
  return signedPdfSentence(names, loaded);
}

// ── Page operations ─────────────────────────────────────────────────────────
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
      var animated = f.bytes[0] === 0x89 && ascii(f.bytes, 1, 'PNG');
      if (!host.images || typeof host.images.encode !== 'function') {
        throw new Error((f.name || 'This image') + (animated ? ' is an animated PNG; save it as a still image first.' : ' must be a PNG or JPEG in this app.'));
      }
      return host.images.encode(f.bytes, { format: 'png' }).then(function (r) { return { bytes: r.bytes, converted: !animated, animated: animated }; });
    }).then(function (picture) {
      return host.pdf.fromImages([{ bytes: picture.bytes }], opts).then(function (r) {
        return { bytes: r.bytes, image: true, converted: picture.converted, animated: !!picture.animated, turned: r.turned || 0,
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
  var animated = count(function (d) { return d.animated; });
  var notes = [];
  if (converted) notes.push({ outcome: 'kept', message: 'Converted ' + plural(converted, 'image') + ' to PNG before placing ' + (converted === 1 ? 'it.' : 'them.') });
  if (animated) notes.push({ outcome: 'removed', message: 'Placed ' + plural(animated, 'animated PNG') + ' as a still picture, without the animation.' });
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
    documents.push({ index: i, number: fs.length > 1 ? i + 1 : '', ordinal: i + 1, name: f.name || ('Document ' + (i + 1) + '.pdf'), image: !!docs[i].image,
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
    var occurrence = windowStart + at, prefix = 'pg' + doc.ordinal + 'o' + occurrence + '-';
    var svg = p ? p.svg.replace(/id="([^"]+)"/g, 'id="' + prefix + '$1"')
      .replace(/url\(#([^)]*)\)/g, 'url(#' + prefix + '$1)').replace(/href="#([^"]+)"/g, 'href="#' + prefix + '$1"') : '';
    if (!p) unavailable = true;
    pages.push({ page: n, occurrence: occurrence, ordinal: occurrence + 1, localPage: local, document: doc.ordinal,
      origin: documents.length < 2 ? '' : (doc.image ? 'Image ' + doc.ordinal : 'PDF ' + doc.ordinal + ' · p' + local),
      // In Reorder the position field is the page's number, so the caption holds only the file a page came from.
      caption: v.operation !== 'reorder' || documents.length > 1,
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
async function pagesCompute(ctx) {
  var v = values(ctx.model), fs = sourceFiles(v);
  var image = imageOptions(v);
  var out = {
    hasFile: false, valid: false, available: false, fileName: '', fileCount: 0,
    archiveName: 'pages.zip', error: '', preview: [], documents: [], previewUnavailable: false,
    ready: false, pending: false, summary: '', sizeAfter: '', operations: '', operation: String(v.operation || 'reorder'),
    pagesText: String(v.pages || ''), rotationText: String(v.rotation || '90'), totalPages: 0,
    hasImages: false, imagePageSize: image.pageSize, imageMarginText: String(Math.min(50, Math.max(0, Number(v.imageMargin) || 0))),
    fitsPaper: image.pageSize !== 'image', changes: [], hasChanges: false,
    isReorder: v.operation === 'reorder', isRotate: v.operation === 'rotate', isSplit: v.operation === 'split',
    canSelect: v.operation === 'rotate' || v.operation === 'extract' || v.operation === 'delete',
    selectionLabel: v.operation === 'reorder' ? 'Page order' : (v.operation === 'split' ? 'Split groups' : 'Selected pages')
  };
  if (!fs.length) return out;
  out.hasFile = true;
  out.fileCount = fs.length;
  out.fileName = fs.length === 1 ? (fs[0].name || 'document.pdf') : plural(fs.length, 'file');
  out.archiveName = basename(fs[0].name) + '-split.zip';
  out.hasImages = fs.some(function (f) { var k = fileKind(f); return k === 'image' || k === 'convert'; });
  out.documents = fs.map(function (f, index) {
    var k = fileKind(f);
    return { index: index, number: fs.length > 1 ? index + 1 : '', name: f.name || ('Document ' + (index + 1) + '.pdf'), pageLabel: k === 'pdf' ? 'PDF' : 'Image' };
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
  out.signedNote = await signedNote(ctx.host, fs, fs.length);
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
    // The line above the button already says what happens to a signature, so the list leaves that entry out.
    out.changes = notes.concat((res.effects || []).filter(function (e) { return !(out.signedNote && e.feature === 'signatures'); })
      .map(function (e) { return { outcome: e.outcome, message: e.message }; }));
    out.hasChanges = out.changes.length > 0;
  } catch (e) { out.error = errorText(e); }
  out.pending = false;
  return out;
}
async function pagesExport(ctx) {
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

// ── Compress ────────────────────────────────────────────────────────────────
// The work is the shell's, behind host.pdf.compress. One job, keyed on the file
// and the settings, serves the preview and the download, so the PDF is
// compressed once. The preview waits a short time for the job: a large PDF
// that takes longer shows as pending and is finished by the download.
var _cmpJob = { key: '', promise: null };
var CMP_PREVIEW_BUDGET_MS = 1200;
function cmpOptions(v) { return { level: v.level === 'light' || v.level === 'strong' ? v.level : 'balanced', grayscale: Boolean(v.grayscale) }; }
function cmpJob(host, f, opts) {
  var k = [sourceId(f), f.name, f.size, opts.level, opts.grayscale].join('|');
  if (_cmpJob.key === k && _cmpJob.promise) return _cmpJob.promise;
  var p = Promise.resolve().then(function () { return host.pdf.compress(f.bytes, opts); });
  _cmpJob = { key: k, promise: p };
  // A failed job is dropped, so the next attempt runs again.
  p.catch(function () { if (_cmpJob.key === k) _cmpJob = { key: '', promise: null }; });
  return p;
}
// The promise's value when it settles within `ms`, otherwise null. The job
// keeps running and stays cached for the download.
function cmpWithin(promise, ms) {
  return new Promise(function (resolve) {
    var settled = false;
    var t = setTimeout(function () { if (!settled) { settled = true; resolve(null); } }, ms);
    promise.then(
      function (v) { if (!settled) { settled = true; clearTimeout(t); resolve(v); } },
      function () { if (!settled) { settled = true; clearTimeout(t); resolve(null); } }
    );
  });
}
function cmpProblem(host) { return !host || !host.pdf || typeof host.pdf.compress !== 'function' ? 'PDF compression is not available in this app.' : ''; }
async function cmpCompute(ctx) {
  var v = values(ctx.model), fs = sourceFiles(v), f = firstPdf(fs);
  var o = { hasFile: false, available: false, pending: false, error: '', done: false, noGain: false, savedLead: '', savedDetail: '' };
  if (!fs.length) return o;
  onePdfFacts(o, fs, f, 'compressed');
  if (!f) { o.error = 'That file is not a PDF.'; return o; }
  o.error = cmpProblem(ctx.host);
  if (o.error) return o;
  o.available = true;
  var job = cmpJob(ctx.host, f, cmpOptions(v));
  o.signedNote = await signedNote(ctx.host, [f], fs.length);
  o.signedPdf = !!o.signedNote;
  var res = await cmpWithin(job, CMP_PREVIEW_BUDGET_MS);
  if (!res) { o.pending = true; return o; }
  // A PDF that cannot be made smaller is handed back as it was, signature intact.
  if (!(res.after < res.before)) o.signedNote = '';
  var saved = res.before - res.after, pct = res.before > 0 ? Math.round(saved / res.before * 100) : 0;
  if (saved > 0 && pct >= 1) {
    o.done = true;
    o.savedLead = pct + '% smaller';
    o.savedDetail = fmt(res.before) + ' → ' + fmt(res.after);
  } else o.noGain = true;
  return o;
}
async function cmpExport(ctx) {
  var v = values(ctx.model), fs = sourceFiles(v), f = firstPdf(fs);
  if (!fs.length) throw new Error('Choose a PDF first.');
  if (!f) throw new Error('That file is not a PDF.');
  var problem = cmpProblem(ctx.host);
  if (problem) throw new Error(problem);
  var res = await cmpJob(ctx.host, f, cmpOptions(v));
  return { bytes: res.bytes, mime: 'application/pdf', filename: signBase(f.name) + '-compressed.pdf' };
}

// ── Sign ────────────────────────────────────────────────────────────────────
var _signAssetKey = '', _signAsset = null, _signInkKey = '', _signInk = null, _signPreviewKey = '', _signPreview = null;
var _signImages = new Map(), _signPreviewSource = null;
var INK_W = 600, INK_H = 180, MAX_STROKES = 300, MAX_POINTS = 5000;

function signBase(name) { return String(name || 'document').replace(/\.pdf$/i, ''); }
function signPosition(v) { var p = v.signaturePosition || {}; return { x: Math.max(0, Number(p.x) || 0), y: Math.max(0, Number(p.y) || 0), width: Math.max(12, Number(p.width) || 144) }; }
async function profileName(host) { try { var p = await host.profile.get(); if (p && p.useDetails) { var n = [p.firstname, p.lastname].filter(Boolean).join(' ').trim(); if (n) return n; } } catch (e) {} return 'Signer'; }

function round1(n) { var value = Math.round(n * 10) / 10; return value === 0 ? 0 : value; }
function pathData(points) {
  if (!points.length) return '';
  var d = 'M' + points[0][0] + ',' + points[0][1];
  if (points.length === 1) return d + 'L' + points[0][0] + ',' + points[0][1];
  for (var i = 1; i < points.length; i++) d += 'L' + points[i][0] + ',' + points[i][1];
  return d;
}
function parseInk(value) {
  var result = { paths: [], points: 0, viewBox: '0 0 ' + INK_W + ' ' + INK_H, width: INK_W, height: INK_H };
  var text = String(value || '').trim();
  if (!text) return result;
  var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  text.split(/(?=M)/).forEach(function (part) {
    if (result.paths.length >= MAX_STROKES || result.points >= MAX_POINTS) return;
    part = part.trim();
    if (!part || !/^M/.test(part) || /[^ML0-9.,\s+-]/.test(part)) return;
    var nums = part.match(/-?(?:\d+\.?\d*|\.\d+)/g) || [], points = [];
    for (var i = 0; i + 1 < nums.length && result.points + points.length < MAX_POINTS; i += 2) {
      var x = Number(nums[i]), y = Number(nums[i + 1]);
      if (!isFinite(x) || !isFinite(y) || Math.abs(x) > 100000 || Math.abs(y) > 100000) { points = []; break; }
      x = round1(x); y = round1(y); points.push([x, y]);
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
    if (points.length) { result.paths.push({ d: pathData(points) }); result.points += points.length; }
  });
  if (result.paths.length && isFinite(x0)) {
    var pad = 8, w = Math.max(16, x1 - x0 + pad * 2), h = Math.max(16, y1 - y0 + pad * 2);
    result.viewBox = round1(x0 - pad) + ' ' + round1(y0 - pad) + ' ' + round1(w) + ' ' + round1(h);
    result.width = Math.max(64, Math.round(w * 2));
    result.height = Math.max(24, Math.round(h * 2));
  }
  return result;
}
function svgBytes(ink) {
  var paths = ink.paths.map(function (path) { return '<path d="' + path.d + '" fill="none" stroke="#111111" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>'; }).join('');
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + ink.width + '" height="' + ink.height + '" viewBox="' + ink.viewBox + '">' + paths + '</svg>';
  return new TextEncoder().encode(svg);
}
async function imageBytes(host, asset) {
  if (!asset || !asset.url) throw new Error('Choose a signature image first.');
  var k = asset.url || asset.id;
  if (_signImages.has(k)) return _signImages.get(k);
  _signAssetKey = k;
  _signAsset = Promise.resolve().then(async function () {
    if (!host.raster || typeof host.raster.decode !== 'function' || typeof host.raster.encode !== 'function') throw new Error('Signature image decoding is not available in this app.');
    var bmp = await host.raster.decode(asset);
    try { var r = await host.raster.encode(bmp, { format: 'png' }); return { bytes: r.bytes, width: r.width, height: r.height }; }
    finally { if (bmp && bmp.close) bmp.close(); }
  });
  _signImages.set(k, _signAsset);
  while (_signImages.size > 4) _signImages.delete(_signImages.keys().next().value);
  _signAsset.catch(function () { _signImages.delete(k); });
  return _signAsset;
}
async function drawnBytes(host, value) {
  var ink = parseInk(value), k = String(value || '');
  if (!ink.paths.length) throw new Error('Draw a signature or choose a signature image first.');
  if (_signInkKey === k && _signInk) return _signInk;
  _signInkKey = k;
  _signInk = Promise.resolve().then(async function () {
    if (!host.raster || typeof host.raster.decode !== 'function' || typeof host.raster.encode !== 'function') throw new Error('Direct signature drawing is not available in this app.');
    var bmp = await host.raster.decode(svgBytes(ink));
    try { var r = await host.raster.encode(bmp, { format: 'png' }); return { bytes: r.bytes, width: r.width, height: r.height }; }
    finally { if (bmp && bmp.close) bmp.close(); }
  });
  _signInk.catch(function () { if (_signInkKey === k) { _signInkKey = ''; _signInk = null; } });
  return _signInk;
}

function signPageNo(v) { return Math.max(1, Math.round(Number(v.signaturePage) || 1)); }
function today() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
async function pagePreview(host, f, pageNo) {
  if (!host.pdf || typeof host.pdf.pages !== 'function') throw new Error('Accurate page preview is unavailable in this app.');
  var pk = String(pageNo);
  if (_signPreviewSource !== f.bytes || _signPreviewKey !== pk || !_signPreview) {
    _signPreviewSource = f.bytes; _signPreviewKey = pk;
    _signPreview = host.pdf.pages(f.bytes, { maxPages: 1, pageNumbers: [pageNo] });
  }
  var pp = await _signPreview;
  if (pp.totalPages && pageNo > pp.totalPages) throw new Error('Page ' + pageNo + ' is outside this ' + pp.totalPages + '-page PDF.');
  var p = pp.pages.find(function (p) { return p.page === pageNo; });
  if (!p) throw new Error('Page ' + pageNo + ' could not be previewed. Choose another page or PDF.');
  return { page: p, total: pp.totalPages };
}
// One point-space layout drives the visible marks and the exported PDF.
// Scale the whole group (including initials and date) to fit small pages.
function placement(v, page, sig, ini, dateW) {
  var pos = signPosition(v), sw = pos.width, sh = sw * sig.height / sig.width;
  var iw = ini ? sw * .28 : 0, ih = ini ? iw * ini.height / ini.width : 0;
  var iy = sh * .35, bottom = Math.max(sh, ini ? iy + ih : 0);
  var groupW = Math.max(sw + (ini ? 8 + iw : 0), v.signatureDate ? (dateW || 56) : 0);
  var groupH = bottom + (v.signatureDate ? 15 : 0);
  var scale = Math.min(1, page.widthPt / groupW, page.heightPt / groupH);
  var width = groupW * scale, height = groupH * scale;
  var x = Math.max(0, Math.min(page.widthPt - width, pos.x)), y = Math.max(0, Math.min(page.heightPt - height, pos.y));
  return { x: x, y: y, width: sw * scale, height: sh * scale, groupWidth: width, groupHeight: height,
    initials: ini ? { x: x + (sw + 8) * scale, y: y + iy * scale, width: iw * scale, height: ih * scale } : null,
    date: v.signatureDate ? { text: today(), x: x, y: y + (bottom + 5) * scale, size: 10 * scale } : null };
}
async function signingLayout(host, v, f) {
  var pp = await pagePreview(host, f, signPageNo(v));
  var ink = parseInk(v.signatureInk);
  var sig = ink.paths.length ? await drawnBytes(host, v.signatureInk) : v.signature ? await imageBytes(host, v.signature) : { width: 600, height: 180 };
  var ini = v.initials ? await imageBytes(host, v.initials) : null;
  // The date is shaped for the preview and the file alike. The layout keeps 56 points for
  // it (a Helvetica date), or the shaped width when the design system's face is wider, so
  // a small page scales the whole group down to fit. Once placed, the date is shaped
  // again at its final size if the group was scaled, and moved left if it would still
  // pass the page's right edge.
  var first = v.signatureDate ? await dateOutline(host, { text: today(), size: 10 }) : null;
  var layout = placement(v, pp.page, sig, ini, first ? Math.max(56, first.advance) : 56);
  if (layout.date && first) {
    var outline = layout.date.size === 10 ? first : await dateOutline(host, layout.date);
    if (outline) {
      layout.date.outline = outline;
      layout.date.x = Math.max(0, Math.min(layout.date.x, pp.page.widthPt - outline.advance));
    }
  }
  return { page: pp.page, total: pp.total, signature: sig, initials: ini, layout: layout };
}
async function signCompute(ctx) {
  var v = values(ctx.model), fs = sourceFiles(v), f = firstPdf(fs), ink = parseInk(v.signatureInk), pageNo = signPageNo(v);
  var o = {
    hasFile: false, valid: false, available: false, canDownload: false, pending: false, fileName: '', error: '', pageSvg: '', pageNo: pageNo,
    signatureUrl: v.signature && v.signature.url || '', initialsUrl: v.initials && v.initials.url || '', inkPaths: ink.paths,
    inkValue: String(v.signatureInk || ''), inkViewBox: ink.viewBox, hasInk: ink.paths.length > 0,
    hasSignature: ink.paths.length > 0 || Boolean(v.signature && v.signature.url), xPct: 0, yPct: 0, wPct: 20,
    posJson: '{}', positionWidth: 144, pageW: 612, pageH: 792, pageDisplayW: 301, signerName: ''
  };
  // The date is set in the design system's text face, on the page preview as in the file.
  o.dateFont = (await brandFonts(ctx.host)).brand;
  if (!fs.length) return o;
  onePdfFacts(o, fs, f, 'signed');
  if (!f) { o.error = 'That file is not a PDF.'; return o; }
  o.valid = true;
  if (!ctx.host || !ctx.host.pdf || typeof ctx.host.pdf.stamp !== 'function') { o.error = 'PDF signing is not available in this app.'; return o; }
  o.available = true; o.pending = true;
  o.signedNote = await signedNote(ctx.host, [f], fs.length);
  if (ctx.report) ctx.report(o);
  try {
    // The name the Content Credential records, shown before the file is saved.
    var signer = v.seal ? await profileName(ctx.host) : 'Signer';
    o.signerName = signer === 'Signer' ? '' : signer;
    var r = await signingLayout(ctx.host, v, f), p = r.page, l = r.layout;
    o.pageSvg = p.svg; o.pageW = p.widthPt; o.pageH = p.heightPt; o.totalPages = r.total;
    o.pageDisplayW = Math.round(p.widthPt * Math.min(465 / p.widthPt, 390 / p.heightPt));
    o.positionWidth = l.width; o.groupWidth = l.groupWidth; o.groupHeight = l.groupHeight;
    o.xPct = l.x / p.widthPt * 100; o.yPct = l.y / p.heightPt * 100; o.wPct = l.width / p.widthPt * 100; o.hPct = l.height / p.heightPt * 100;
    o.posJson = JSON.stringify({ x: l.x, y: l.y, width: l.width });
    o.initialsMark = l.initials; o.dateMark = o.hasSignature && l.date ? { text: l.date.text, x: l.date.x, y: l.date.y, size: l.date.size } : null;
    if (v.lock && v.seal) throw new Error('A password lock and a Content Credential cannot be combined: encryption would invalidate the credential. Turn one off.');
    if (v.seal && (!ctx.host.c2pa || typeof ctx.host.c2pa.sign !== 'function')) throw new Error('Content Credentials are unavailable in this app. Turn the credential off to download a visible signature.');
    if (v.lock && typeof ctx.host.pdf.lock !== 'function') throw new Error('AES-256 PDF locking is unavailable in this app.');
    o.canDownload = o.hasSignature;
  } catch (e) { o.error = String(e && e.message || e); }
  o.pending = false;
  return o;
}
// The date in the design system's text face, outlined: the first family in the face's
// list that this app can shape. Null when it has no shaper or no file for the face, and
// the date is then stamped as text in a standard PDF face, as before.
async function dateOutline(host, date) {
  if (!host || !host.text || typeof host.text.fontUrl !== 'function' || typeof host.text.toPath !== 'function') return null;
  var list = (await brandFonts(host)).brand.split(',');
  for (var i = 0; i < list.length; i++) {
    var family = list[i].trim().replace(/^['"]+|['"]+$/g, '');
    if (!family || BF_GENERIC.test(family)) continue;
    try {
      var face = await host.text.fontUrl(family, { weight: 400 });
      if (!face || !face.url) continue;
      var run = await host.text.toPath({ text: date.text, fontUrl: face.url, fontSize: date.size, variations: face.variations });
      if (run && run.d && !run.notdef) return { d: run.d, advance: Number(run.advanceWidth) || 0 };
    } catch (e) { /* the next family, or text */ }
  }
  return null;
}
// The file (name and size) whose credential could not be added on the last download.
var _sealRefused = '';
var SEAL_REFUSED = 'The Content Credential could not be added to this PDF. Download again for the signed PDF without one, or turn Add Content Credential off.';
async function signExport(ctx) {
  var v = values(ctx.model), fs = sourceFiles(v), f = firstPdf(fs), ink = parseInk(v.signatureInk);
  if (!fs.length) throw new Error('Choose a PDF first.');
  if (!f) throw new Error('That file is not a PDF.');
  if (!ink.paths.length && !v.signature) throw new Error('Draw a signature or choose a signature image first.');
  if (v.lock && v.seal) throw new Error('A password lock and a Content Credential cannot be combined because encryption would invalidate the credential. Turn one off.');
  var host = ctx.host;
  if (!host || !host.pdf || typeof host.pdf.stamp !== 'function') throw new Error('PDF signing is not available in this app.');
  var r = await signingLayout(host, v, f), l = r.layout, page = signPageNo(v);
  var images = [{ bytes: r.signature.bytes, page: page, x: l.x, y: l.y, width: l.width, height: l.height }];
  if (r.initials && l.initials) images.push(Object.assign({ bytes: r.initials.bytes, page: page }, l.initials));
  var texts = l.date ? [{ page: page, text: l.date.text, x: l.date.x, y: l.date.y, size: l.date.size }] : [];
  // A Content Credential attaches to a classic cross-reference table, so the stamp is
  // saved in that form when one is asked for. Without a credential the file is saved as before.
  var stamped = null, classic = !!v.seal;
  if (l.date && l.date.outline) {
    // The date as outlines in the design system's face, its baseline one size below the
    // top of its box, where stamped text puts it. A host older than stamped paths
    // ignores them and counts fewer stamps, so the date then goes in as text after all.
    var path = { page: page, x: l.date.x, y: l.date.y + l.date.size, d: l.date.outline.d, color: '#141414' };
    stamped = await host.pdf.stamp(f.bytes, { images: images, texts: [], paths: [path], classic: classic });
    if (!stamped || stamped.stamps !== images.length + 1) stamped = null;
  }
  if (!stamped) stamped = await host.pdf.stamp(f.bytes, { images: images, texts: texts, classic: classic });
  var bytes = stamped.bytes, signer = await profileName(host);
  if (v.seal) {
    if (!host.c2pa || typeof host.c2pa.sign !== 'function') throw new Error('Content Credentials are not available in this app; turn the credential off or use a supported shell.');
    var ingredients = typeof host.c2pa.readIngredients === 'function' ? await host.c2pa.readIngredients(f.bytes) : [];
    // A PDF the credential cannot be attached to must not cost the person the signature
    // they placed. The first download says so and saves nothing; the next download of the
    // same file saves the visible signature alone. The file never carries a credential
    // that was not added, and the person is told before they have a file without one.
    var sealKey = f.name + ':' + f.bytes.length;
    if (_sealRefused === sealKey) {
      _sealRefused = '';
    } else {
      try {
        bytes = await host.c2pa.sign(bytes, 'pdf', { title: signBase(f.name) + ' signed', description: 'Placed a visible signature on page ' + page, author: signer === 'Signer' ? undefined : { name: signer }, ingredients: ingredients, action: 'imported' });
      } catch (e) {
        _sealRefused = sealKey;
        if (host.log) host.log('warn', 'pages: the Content Credential could not be added', { reason: String(e && e.message || e) });
        throw new Error(SEAL_REFUSED);
      }
    }
  }
  if (v.lock) {
    if (!ctx.opts || !ctx.opts.password) throw new Error('A password is required to lock this PDF.');
    if (typeof host.pdf.lock !== 'function') throw new Error('AES-256 PDF locking is not available in this app.');
    bytes = (await host.pdf.lock(bytes, String(ctx.opts.password))).bytes;
  }
  return { bytes: bytes, mime: 'application/pdf', filename: signBase(f.name) + '-signed.pdf' };
}

// ── One dispatcher on `operation` ───────────────────────────────────────────
// Every key any of the three computes returns, at rest, so a value left by
// one operation is not read by the next one's panel. No input id is listed
// here: a key that matches an input id would write to that input.
function blank() {
  return {
    hasFile: false, valid: false, available: false, pending: false, ready: false, error: '', fileName: '', fileCount: 0,
    documents: [], onlyFirst: '',
    archiveName: 'pages.zip', preview: [], previewUnavailable: false, previewError: '', summary: '', sizeAfter: '', operations: '',
    pagesText: '', rotationText: '90', totalPages: 0, hasImages: false, imageMarginText: '0', fitsPaper: false, changes: [], hasChanges: false,
    isReorder: false, isRotate: false, isSplit: false, canSelect: false, selectionLabel: '',
    previewStart: 1, previewEnd: 0, orderLength: 0, previousWindow: 1, nextWindow: 1, hasPrevious: false, hasNext: false, paged: false,
    done: false, noGain: false, savedLead: '', savedDetail: '',
    canDownload: false, pageSvg: '', pageNo: 1, signatureUrl: '', initialsUrl: '', inkPaths: [], inkValue: '', inkViewBox: '0 0 ' + INK_W + ' ' + INK_H,
    hasInk: false, hasSignature: false, xPct: 0, yPct: 0, wPct: 20, hPct: 0, posJson: '{}', positionWidth: 144, pageW: 612, pageH: 792, pageDisplayW: 301,
    dateFont: '', signerName: '', groupWidth: 0, groupHeight: 0, initialsMark: null, dateMark: null,
    signedNote: '', signedLead: '', signedRest: '', signedPdf: false
  };
}
function kindOf(ctx) {
  var operation = values(ctx.model).operation;
  return operation === 'compress' || operation === 'sign' ? operation : 'pages';
}
var A11Y_NAME = { pages: 'PDF page manager', compress: 'PDF compressor', sign: 'PDF signing workspace' };
function compute(ctx) {
  var kind = kindOf(ctx);
  var whole = function (o) {
    var all = Object.assign(blank(), o, { isPageOp: kind === 'pages', isCompress: kind === 'compress', isSign: kind === 'sign', a11yName: A11Y_NAME[kind] });
    // The preview window's controls show only when the pages do not fit one window.
    all.paged = all.hasPrevious || all.hasNext;
    // Muted ink around the two words set in the alert ink.
    Object.assign(all, signedPdfLine(all.signedNote));
    return all;
  };
  var inner = Object.create(ctx);
  inner.report = ctx.report ? function (o) { ctx.report(whole(o)); } : undefined;
  return (kind === 'compress' ? cmpCompute(inner) : kind === 'sign' ? signCompute(inner) : pagesCompute(inner)).then(whole);
}
function onInit(ctx) { return compute(ctx); }
function onInput(ctx) { return compute(ctx); }
async function exportFile(ctx) {
  var kind = kindOf(ctx);
  var saved = await (kind === 'compress' ? cmpExport(ctx) : kind === 'sign' ? signExport(ctx) : pagesExport(ctx));
  // The same sentence for the log, which is how the command line gets to print the warning.
  // The file is saved either way.
  var fs = sourceFiles(values(ctx.model)), one = firstPdf(fs);
  var kept = kind === 'compress' && one && saved.bytes.length >= one.bytes.length;
  var note = kept ? '' : await signedNote(ctx.host, kind === 'pages' ? fs : (one ? [one] : []), fs.length);
  if (note && ctx.host && typeof ctx.host.log === 'function') ctx.host.log('warn', note);
  return saved;
}

// === lolly:shared brandFonts - generated from community/_shared/brand-fonts.js; edit there and run npm run sync:shared ===
// The design system's text face (font.brand) and mono face (font.mono) as
// font-family lists, for an SVG attribute, an inline style or a canvas font.
// A tool never names a face of its own. A headless SVG has no stylesheet, so
// the CLI, the TUI and the MCP server read the attribute to outline the text,
// and the page draws the same family. A design system that declares no such
// face gets the shell's own default, SUSE or SUSE Mono, as --font-brand and
// --font-mono do. Family names pass the shell's brand-vars.ts rule; a name
// with a space or a digit is quoted.
var BF_FAMILY = /^[A-Za-z0-9][A-Za-z0-9 _-]{0,63}$/;
var BF_GENERIC = /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-(sans-serif|serif|monospace|rounded)|emoji|math|fangsong)$/i;
function bfFamilyList(value, fallback, generic) {
  var names = [];
  var list = Array.isArray(value) ? value : (typeof value === 'string' && value.charAt(0) !== '{' ? value.split(',') : []);
  for (var i = 0; i < list.length; i++) {
    var n = String(list[i]).trim().replace(/^['"]+|['"]+$/g, '').trim();
    if (!BF_FAMILY.test(n) || BF_GENERIC.test(n)) continue;
    var dup = false;
    for (var j = 0; j < names.length; j++) if (names[j].toLowerCase() === n.toLowerCase()) dup = true;
    if (!dup) names.push(n);
  }
  if (!names.length) names.push(fallback);
  return names.map(function (f) { return /^[A-Za-z_-][A-Za-z0-9_-]*$/.test(f) ? f : "'" + f + "'"; }).join(', ') + ', ' + generic;
}
async function brandFonts(host) {
  var out = { brand: bfFamilyList(null, 'SUSE', 'sans-serif'), mono: bfFamilyList(null, 'SUSE Mono', 'monospace') };
  if (!host || !host.tokens || !host.tokens.resolve) return out;
  try { out.brand = bfFamilyList(await host.tokens.resolve('{font.brand}'), 'SUSE', 'sans-serif'); } catch (e) { /* the shell's default face stands */ }
  try { out.mono = bfFamilyList(await host.tokens.resolve('{font.mono}'), 'SUSE Mono', 'monospace'); } catch (e) { /* the shell's default face stands */ }
  return out;
}
// === /lolly:shared brandFonts ===
