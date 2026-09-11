// Embed, Imprint & Track - hooks.js
//
// A transform tool (file in → stamped file out) for ANY media the artist already
// has: images, PDF, video, audio. For each dropped file it:
//   1. reads every C2PA manifest already inside it (its own + nested) so nothing is
//      orphaned - host.c2pa.readIngredients,
//   2. (raster only) layers the durable pixel Imprint, plus the imperceptible neural
//      mark when asked - host.export.imprint,
//   3. signs a fresh manifest asserting the artist's author / copyright / licence,
//      carrying the read manifests forward as ingredients - host.c2pa.sign.
// Nothing is uploaded; everything happens on the device. onInput builds the canvas
// summary; exportFile does the work and returns one record per file (the shell zips
// a batch).

function _values(model) {
  var m = {};
  for (var i = 0; i < model.length; i++) m[model[i].id] = model[i].value;
  return m;
}

function _fmtBytes(n) {
  n = Number(n) || 0;
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' KB';
  return (n / (1024 * 1024)).toFixed(1) + ' MB';
}

// Map a file's MIME/extension to the engine format key + a coarse kind. Returns
// null for anything Lolly can't carry a Content Credential in.
function _formatKey(mime, name) {
  var m = String(mime || '').toLowerCase();
  var ext = String(name || '').toLowerCase().split('.').pop();
  function is(sub, e) { return m.indexOf(sub) !== -1 || (e && ext === e); }
  if (is('jpeg', 'jpg') || ext === 'jpeg') return { key: 'jpg', kind: 'image', raster: true, mime: 'image/jpeg' };
  if (is('png', 'png')) return { key: 'png', kind: 'image', raster: true, mime: 'image/png' };
  if (is('webp', 'webp')) return { key: 'webp', kind: 'image', raster: true, mime: 'image/webp' };
  if (is('avif', 'avif')) return { key: 'avif', kind: 'image', raster: false, mime: 'image/avif' };
  if (is('tiff', 'tiff') || ext === 'tif') return { key: 'tiff', kind: 'image', raster: false, mime: 'image/tiff' };
  if (is('gif', 'gif')) return { key: 'gif', kind: 'image', raster: false, mime: 'image/gif' };
  if (is('svg', 'svg')) return { key: 'svg', kind: 'vector', raster: false, mime: 'image/svg+xml' };
  if (is('pdf', 'pdf')) return { key: 'pdf', kind: 'PDF', raster: false, mime: 'application/pdf' };
  if (m.indexOf('quicktime') !== -1 || ext === 'mov' || ext === 'm4v' || (m.indexOf('mp4') !== -1 && m.indexOf('audio') === -1) || ext === 'mp4') return { key: 'mp4', kind: 'video', raster: false, mime: 'video/mp4' };
  if (is('webm', 'webm')) return { key: 'webm', kind: 'video', raster: false, mime: 'video/webm' };
  if (ext === 'm4a' || m.indexOf('aac') !== -1 || (m.indexOf('audio') !== -1 && m.indexOf('mp4') !== -1)) return { key: 'm4a', kind: 'audio', raster: false, mime: 'audio/mp4' };
  if (m.indexOf('mpeg') !== -1 || ext === 'mp3') return { key: 'mp3', kind: 'audio', raster: false, mime: 'audio/mpeg' };
  if (m.indexOf('wav') !== -1 || ext === 'wav') return { key: 'wav', kind: 'audio', raster: false, mime: 'audio/wav' };
  return null;
}

function _fileList(v) {
  return Array.isArray(v.files) ? v.files : [];
}

// Build the canvas summary: what was dropped, what will happen to each.
function onInput(ctx) {
  var v = _values(ctx.model);
  var files = _fileList(v);
  var list = [];
  var supported = 0, raster = 0;
  for (var i = 0; i < files.length; i++) {
    var f = files[i];
    var fk = _formatKey(f.mime, f.name);
    if (fk) { supported++; if (fk.raster) raster++; }
    list.push({
      name: f.name || 'file',
      size: _fmtBytes(f.size),
      kind: fk ? fk.kind : 'unsupported',
      supported: !!fk,
      raster: !!(fk && fk.raster),
    });
  }
  var hasName = !!(v.creator && String(v.creator).trim());
  return {
    hasFiles: files.length > 0,
    fileCount: files.length,
    // NB: this key is `fileList`, NOT `files`. A hook return key that matches a
    // declared input id OVERWRITES that input's value (hook-patch semantics); the
    // file input's id here IS `files`, so returning `files` replaced the real
    // InputFile[] (with bytes) with this bytes-less summary - exportFile then read
    // empty bytes and produced a 0-byte download. `fileList` lands in `extras`
    // instead, leaving the `files` input value (the real bytes) untouched.
    fileList: list,
    supportedCount: supported,
    unsupportedCount: files.length - supported,
    rasterCount: raster,
    durableOn: v.durableMark === true,
    needsName: !hasName,
    downloadLabel: files.length > 1
      ? ('Stamp & download ' + files.length + ' files')
      : 'Stamp & download',
  };
}

// The transform: stamp each file, return one record per file.
async function exportFile(ctx) {
  var v = _values(ctx.model);
  var host = ctx.host;
  var files = _fileList(v);
  if (!files.length) throw new Error('Drop a file to stamp first.');

  var author = String(v.creator || '').trim();
  var contact = String(v.contact || '').trim();
  var title = String(v.title || '').trim();
  var rights = [v.copyright, v.license]
    .map(function (s) { return String(s || '').trim(); })
    .filter(Boolean).join(' · ');
  var email = '';
  if (contact.indexOf('@') !== -1) {
    var parts = contact.split(/[\s·,;]+/);
    for (var p = 0; p < parts.length; p++) if (parts[p].indexOf('@') !== -1) { email = parts[p]; break; }
  }
  var authorObj = author ? (email ? { name: author, email: email } : { name: author }) : null;
  var wantDurable = v.durableMark === true;

  var out = [];
  for (var i = 0; i < files.length; i++) {
    var f = files[i];
    var bytes = (f.bytes instanceof Uint8Array) ? f.bytes : new Uint8Array(f.bytes || []);
    var fk = _formatKey(f.mime, f.name);
    var name = f.name || 'file';
    // A format Lolly can't credential - hand it back untouched rather than drop it.
    if (!fk) {
      out.push({ bytes: bytes, mime: f.mime || 'application/octet-stream', filename: name });
      continue;
    }
    try {
      // Preserve any credential already inside the ORIGINAL bytes (its own + nested).
      var ingredients = [];
      try { ingredients = await host.c2pa.readIngredients(bytes); } catch (e0) { ingredients = []; }

      // Raster: layer the pixel Imprint (+ optional durable mark) UNDER the credential.
      var stamped = bytes;
      var imprinted = false;
      if (fk.raster && host.export && typeof host.export.imprint === 'function') {
        var marked = await host.export.imprint(bytes, fk.key, { durable: wantDurable });
        if (marked && marked.length && marked !== bytes) { stamped = marked; imprinted = true; }
      }

      var opts = { action: 'imported', imprinted: imprinted };
      if (authorObj) opts.author = authorObj;
      if (rights) opts.rights = rights;
      if (title) opts.title = title;
      if (ingredients && ingredients.length) opts.ingredients = ingredients;

      var signed = await host.c2pa.sign(stamped, fk.key, opts);
      out.push({ bytes: signed, mime: fk.mime, filename: name });
    } catch (err) {
      if (host.log) host.log('warn', 'Could not stamp "' + name + '" - ' + ((err && err.message) || err) + '; delivering it unchanged.');
      out.push({ bytes: bytes, mime: f.mime || fk.mime, filename: name });
    }
  }
  return out;
}
