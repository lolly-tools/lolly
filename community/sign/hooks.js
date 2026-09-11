/* global onInit, onInput, exportFile */
var _signAssetKey = '', _signAsset = null, _signInkKey = '', _signInk = null, _signPreviewKey = '', _signPreview = null;
var _signImages = new Map(), _signPreviewSource = null;
var INK_W = 600, INK_H = 180, MAX_STROKES = 300, MAX_POINTS = 5000;

function vals(model) { var o = {}; model.forEach(function (i) { o[i.id] = i.value; }); return o; }
function pdfMagic(b) { if (!b) return false; for (var i = 0; i <= Math.min(1024, b.length - 5); i++) if (b[i] === 37 && b[i + 1] === 80 && b[i + 2] === 68 && b[i + 3] === 70 && b[i + 4] === 45) return true; return false; }
function fmtBytes(n) { if (!(n >= 0)) return ''; if (n < 1024) return n + ' B'; var u = ['KB', 'MB', 'GB'], x = n, p = -1; do { x /= 1024; p++; } while (x >= 1024 && p < 2); return (x < 10 ? x.toFixed(1) : Math.round(x)) + ' ' + u[p]; }
function base(name) { return String(name || 'document').replace(/\.pdf$/i, ''); }
function position(v) { var p = v.position || {}; return { x: Math.max(0, Number(p.x) || 0), y: Math.max(0, Number(p.y) || 0), width: Math.max(12, Number(p.width) || 144) }; }
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
function placement(v, page, sig, ini) {
  var pos = position(v), sw = pos.width, sh = sw * sig.height / sig.width;
  var iw = ini ? sw * .28 : 0, ih = ini ? iw * ini.height / ini.width : 0;
  var iy = sh * .35, bottom = Math.max(sh, ini ? iy + ih : 0);
  var groupW = Math.max(sw + (ini ? 8 + iw : 0), v.date ? 56 : 0);
  var groupH = bottom + (v.date ? 15 : 0);
  var scale = Math.min(1, page.widthPt / groupW, page.heightPt / groupH);
  var width = groupW * scale, height = groupH * scale;
  var x = Math.max(0, Math.min(page.widthPt - width, pos.x)), y = Math.max(0, Math.min(page.heightPt - height, pos.y));
  return { x: x, y: y, width: sw * scale, height: sh * scale, groupWidth: width, groupHeight: height,
    initials: ini ? { x: x + (sw + 8) * scale, y: y + iy * scale, width: iw * scale, height: ih * scale } : null,
    date: v.date ? { text: today(), x: x, y: y + (bottom + 5) * scale, size: 10 * scale } : null };
}
async function signingLayout(host, v) {
  var pp = await pagePreview(host, v.source, Math.max(1, Math.round(Number(v.page) || 1)));
  var ink = parseInk(v.signatureInk);
  var sig = ink.paths.length ? await drawnBytes(host, v.signatureInk) : v.signature ? await imageBytes(host, v.signature) : { width: 600, height: 180 };
  var ini = v.initials ? await imageBytes(host, v.initials) : null;
  return { page: pp.page, total: pp.total, signature: sig, initials: ini, layout: placement(v, pp.page, sig, ini) };
}
async function compute(ctx) {
  var v = vals(ctx.model), f = v.source, ink = parseInk(v.signatureInk), pageNo = Math.max(1, Math.round(Number(v.page) || 1));
  var o = {
    hasFile: false, valid: false, available: false, canDownload: false, pending: false, fileName: '', fileSize: '', error: '', pageSvg: '', pageNo: pageNo,
    signatureUrl: v.signature && v.signature.url || '', initialsUrl: v.initials && v.initials.url || '', inkPaths: ink.paths,
    inkValue: String(v.signatureInk || ''), inkViewBox: ink.viewBox, hasInk: ink.paths.length > 0,
    hasSignature: ink.paths.length > 0 || Boolean(v.signature && v.signature.url), xPct: 0, yPct: 0, wPct: 20,
    posJson: '{}', positionWidth: 144, pageW: 612, pageH: 792, pageDisplayW: 301, signer: 'Signer', seal: Boolean(v.seal), lock: Boolean(v.lock), date: v.date !== false,
    sealText: v.seal ? 'Credential on' : 'Credential off', lockText: v.lock ? 'Password lock on' : 'Password lock off', positionText: ''
  };
  if (!f || !f.bytes) return o;
  o.hasFile = true; o.fileName = f.name || 'document.pdf'; o.fileSize = fmtBytes(f.size || f.bytes.length);
  if (!pdfMagic(f.bytes)) { o.error = 'That file is not a PDF.'; return o; }
  o.valid = true;
  if (!ctx.host || !ctx.host.pdf || typeof ctx.host.pdf.stamp !== 'function') { o.error = 'PDF signing is not available in this app.'; return o; }
  o.available = true; o.pending = true;
  if (ctx.report) ctx.report(o);
  try {
    o.signer = await profileName(ctx.host);
    var r = await signingLayout(ctx.host, v), p = r.page, l = r.layout;
    o.pageSvg = p.svg; o.pageW = p.widthPt; o.pageH = p.heightPt; o.totalPages = r.total;
    o.pageDisplayW = Math.round(p.widthPt * Math.min(465 / p.widthPt, 390 / p.heightPt));
    o.positionWidth = l.width; o.groupWidth = l.groupWidth; o.groupHeight = l.groupHeight;
    o.positionText = 'x ' + round1(l.x) + ' · y ' + round1(l.y) + ' · ' + round1(l.width) + ' pt wide';
    o.xPct = l.x / p.widthPt * 100; o.yPct = l.y / p.heightPt * 100; o.wPct = l.width / p.widthPt * 100; o.hPct = l.height / p.heightPt * 100;
    o.posJson = JSON.stringify({ x: l.x, y: l.y, width: l.width });
    o.initialsMark = l.initials; o.dateMark = o.hasSignature ? l.date : null;
    if (v.lock && v.seal) throw new Error('A password lock and a Content Credential cannot be combined: encryption would invalidate the credential. Turn one off.');
    if (v.seal && (!ctx.host.c2pa || typeof ctx.host.c2pa.sign !== 'function')) throw new Error('Content Credentials are unavailable in this app. Turn the credential off to download a visible signature.');
    if (v.lock && typeof ctx.host.pdf.lock !== 'function') throw new Error('AES-256 PDF locking is unavailable in this app.');
    o.canDownload = o.hasSignature;
  } catch (e) { o.error = String(e && e.message || e); }
  o.pending = false;
  return o;
}
function onInit(ctx) { return compute(ctx); }
function onInput(ctx) { return compute(ctx); }
async function exportFile(ctx) {
  var v = vals(ctx.model), f = v.source, ink = parseInk(v.signatureInk);
  if (!f || !f.bytes) throw new Error('Choose a PDF first.');
  if (!pdfMagic(f.bytes)) throw new Error('That file is not a PDF.');
  if (!ink.paths.length && !v.signature) throw new Error('Draw a signature or choose a signature image first.');
  if (v.lock && v.seal) throw new Error('A password lock and a Content Credential cannot be combined because encryption would invalidate the credential. Turn one off.');
  var host = ctx.host;
  if (!host || !host.pdf || typeof host.pdf.stamp !== 'function') throw new Error('PDF signing is not available in this app.');
  var r = await signingLayout(host, v), l = r.layout, page = Math.max(1, Math.round(Number(v.page) || 1));
  var images = [{ bytes: r.signature.bytes, page: page, x: l.x, y: l.y, width: l.width, height: l.height }];
  if (r.initials && l.initials) images.push(Object.assign({ bytes: r.initials.bytes, page: page }, l.initials));
  var texts = l.date ? [Object.assign({ page: page }, l.date)] : [];
  var stamped = await host.pdf.stamp(f.bytes, { images: images, texts: texts }), bytes = stamped.bytes, signer = await profileName(host);
  if (v.seal) {
    if (!host.c2pa || typeof host.c2pa.sign !== 'function') throw new Error('Content Credentials are not available in this app; turn the credential off or use a supported shell.');
    var ingredients = typeof host.c2pa.readIngredients === 'function' ? await host.c2pa.readIngredients(f.bytes) : [];
    bytes = await host.c2pa.sign(bytes, 'pdf', { title: base(f.name) + ' signed', description: 'Placed a visible signature on page ' + page, author: signer === 'Signer' ? undefined : { name: signer }, ingredients: ingredients, action: 'imported' });
  }
  if (v.lock) {
    if (!ctx.opts || !ctx.opts.password) throw new Error('A password is required to lock this PDF.');
    if (typeof host.pdf.lock !== 'function') throw new Error('AES-256 PDF locking is not available in this app.');
    bytes = (await host.pdf.lock(bytes, String(ctx.opts.password))).bytes;
  }
  return { bytes: bytes, mime: 'application/pdf', filename: base(f.name) + '-signed.pdf' };
}
