/* global onInit, onInput, exportFile */
/**
 * Convert Image - hooks.
 *
 * A transform utility (file in → converted file out). The decode/re-encode work
 * lives in the shell behind `host.images` (native codecs + a bundled HEIC WASM
 * decoder + a browser canvas) - the hook sandbox has no image library and no
 * `import`, so it just orchestrates: read the picked image's bytes, ask the host
 * to convert them with the chosen settings, and hand the result to the download
 * flow. Where the shell has no `host.images` (older shells, the node CLI), the
 * card says so instead of failing silently.
 *
 * The same convert job backs both the live before→after preview (onInit/onInput)
 * and the actual download (exportFile): a one-entry promise cache keyed on the
 * file + settings means the work runs once and the download reuses it. The
 * preview is bounded by a short inner budget so a huge photo can't trip the
 * runtime's 2s onInput timeout - if it doesn't finish in time the card shows
 * "ready" and the full job still completes on download (10s budget).
 *
 * Settings (`format`, `quality`, `maxEdge`) are ordinary declared inputs, so
 * they travel through URL mode and the CLI; the canvas renders their controls
 * (data-input-id) and the web shell binds them back to the model.
 */

// One in-flight (or settled) convert job, keyed on file identity + settings, so
// the preview and the download share a single run instead of converting twice.
var _job = { key: '', promise: null };
// The source image's decoded info (dimensions), keyed on file identity only.
var _info = { key: '', promise: null };
// How long the live preview waits for a result before falling back to "ready"
// (kept well under the runtime's 2s onInput timeout).
var PREVIEW_BUDGET_MS = 1200;

function inputsFrom(model) {
  var o = {};
  model.forEach(function (i) { o[i.id] = i.value; });
  return o;
}

// Magic-byte sniff (a hook-side mirror of the shell's byte sniffing): which
// image family is this? Returns a display label, or null when the bytes aren't
// an image the host can be asked to decode.
function imageKind(bytes) {
  if (!bytes || bytes.length < 12) return null;
  var cc = function (o) { return String.fromCharCode(bytes[o], bytes[o + 1], bytes[o + 2], bytes[o + 3]); };
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'JPEG';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'PNG';
  if (cc(0) === 'RIFF' && cc(8) === 'WEBP') return 'WebP';
  if (cc(0) === 'GIF8') return 'GIF';
  if ((bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0) ||
      (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0 && bytes[3] === 0x2a)) return 'TIFF';
  if (bytes[0] === 0x42 && bytes[1] === 0x4d) return 'BMP';
  if (cc(4) === 'ftyp') {
    var brand = cc(8);
    if (brand === 'avif' || brand === 'avis') return 'AVIF';
    if (/^(hei|hev|mif1|msf1)/.test(brand)) return 'HEIC';
  }
  return null;
}

function fmtBytes(n) {
  if (!isFinite(n) || n <= 0) return '0 B';
  if (n < 1024) return n + ' B';
  var u = ['KB', 'MB', 'GB'], i = -1, v = n;
  do { v /= 1024; i++; } while (v >= 1024 && i < u.length - 1);
  return (v >= 10 ? Math.round(v) : Math.round(v * 10) / 10) + ' ' + u[i];
}

function formatOf(v) { return v === 'jpeg' || v === 'png' ? v : 'webp'; }

function labelOf(format) { return format === 'jpeg' ? 'JPEG' : format === 'png' ? 'PNG' : 'WebP'; }

// Convert options for the host, derived from the declared inputs. quality is
// authored 10–100 (a friendlier slider) but the ImagesAPI takes 0..1.
function optsOf(inputs) {
  var q = Math.min(100, Math.max(10, Number(inputs.quality) || 85));
  var edge = Math.floor(Number(inputs.maxEdge));
  return {
    format: formatOf(inputs.target),
    quality: q / 100,
    maxEdge: isFinite(edge) && edge >= 1 ? edge : 0,
    keepLocation: inputs.keepLocation === true || inputs.keepLocation === 'true',
  };
}

// One line saying what the metadata carry did - the disclosure that keeps a
// drop from ever being silent. Empty when the source had nothing to carry.
function carryLine(carried) {
  if (!carried) return '';
  var parts = [];
  if (carried.carried && carried.carried.length) parts.push('Carried: ' + carried.carried.join(', '));
  if (carried.dropped && carried.dropped.length) {
    parts.push('Dropped: ' + carried.dropped.map(function (d) { return d.field + ' (' + d.why + ')'; }).join(', '));
  }
  return parts.join(' · ');
}

// File extension for the ACTUAL output mime (the shell may fall back, e.g. PNG
// where WebP encoding is unsupported - the honest name follows the bytes).
function extOf(mime) {
  return mime === 'image/jpeg' ? 'jpg' : mime === 'image/png' ? 'png' : 'webp';
}

function mimeLabel(mime) {
  return mime === 'image/jpeg' ? 'JPEG' : mime === 'image/png' ? 'PNG' : 'WebP';
}

function outName(name, mime) {
  var base = String(name || 'image').replace(/\.(heic|heif|hif|jpe?g|png|webp|avif|tiff?|gif|bmp)$/i, '');
  var out = base + '.' + extOf(mime);
  // Same name in → mark the copy so the download can't shadow the original.
  return out.toLowerCase() === String(name || '').toLowerCase() ? base + '-converted.' + extOf(mime) : out;
}

function jobKey(file, opts) {
  // Include the object URL (unique per pick) so two different images that happen
  // to share a name AND byte-size can't collide on the cached result.
  return (file.url || '') + '|' + file.name + '|' + file.size + '|' + opts.format + '|' + opts.quality + '|' + opts.maxEdge + '|' + (opts.keepLocation ? 1 : 0);
}

// Return the shared convert promise for this (file, settings) key, starting it
// if needed. A failed job is dropped so a later attempt re-runs rather than
// reusing the rejection.
function jobFor(host, file, opts, key) {
  if (_job.key === key && _job.promise) return _job.promise;
  // carryMetadata: the source's own EXIF/XMP details move into the converted
  // file (engine 1.149+); location only when the user opted in. Older shells
  // ignore the flag - the convert still works, just without the carry.
  var carry = { gps: opts.keepLocation };
  var p = Promise.resolve().then(function () {
    return opts.maxEdge >= 1
      ? host.images.resize(file.bytes, { maxEdge: opts.maxEdge, format: opts.format, quality: opts.quality, carryMetadata: carry })
      : host.images.encode(file.bytes, { format: opts.format, quality: opts.quality, carryMetadata: carry });
  });
  _job = { key: key, promise: p };
  p.catch(function () { if (_job.key === key) _job = { key: '', promise: null }; });
  return p;
}

// The source's decoded info (oriented dimensions), cached per file.
function infoFor(host, file) {
  var key = (file.url || '') + '|' + file.name + '|' + file.size;
  if (_info.key === key && _info.promise) return _info.promise;
  var p = Promise.resolve().then(function () { return host.images.decode(file.bytes); });
  _info = { key: key, promise: p };
  p.catch(function () { if (_info.key === key) _info = { key: '', promise: null }; });
  return p;
}

// Resolve `promise` if it settles within `ms`, otherwise resolve null (the job
// keeps running in the shell and stays cached for the download).
function withBudget(promise, ms) {
  return new Promise(function (resolve) {
    var settled = false;
    var t = setTimeout(function () { if (!settled) { settled = true; resolve(null); } }, ms);
    promise.then(
      function (v) { if (!settled) { settled = true; clearTimeout(t); resolve(v); } },
      function () { if (!settled) { settled = true; clearTimeout(t); resolve(null); } }
    );
  });
}

function hasImagesApi(host) {
  return !!(host && host.images && typeof host.images.encode === 'function' && typeof host.images.resize === 'function');
}

async function compute(ctx) {
  var inputs = inputsFrom(ctx.model);
  var host = ctx.host;
  var f = inputs.source;

  // The template reflects the `format`/`quality`/`maxEdge` controls from the
  // input values directly, so we deliberately DON'T return those ids here - a
  // hook key matching an input id would write back to the model. Everything
  // below is display-only.
  var base = {
    hasFile: false, supported: false, imagesUnavailable: false,
    fileName: '', fileSize: '', sourceMeta: '', animatedNote: false,
    done: false, pending: false,
    outSize: '', outMeta: '', deltaText: '', saved: false, grew: false,
    carriedLine: '',
    formatLabel: labelOf(formatOf(inputs.target)),
  };

  if (!f || !f.bytes) return base;
  base.hasFile = true;
  base.fileName = f.name || 'image';
  base.fileSize = fmtBytes(f.size);

  var kind = imageKind(f.bytes);
  if (!kind) return base; // supported stays false → template shows "not an image"
  base.sourceMeta = kind;

  if (!hasImagesApi(host)) {
    base.imagesUnavailable = true; // shell without host.images (e.g. the node CLI)
    return base;
  }
  base.supported = true;

  var opts = optsOf(inputs);
  var key = jobKey(f, opts);
  // Both jobs start now and share one preview budget; whichever misses it simply
  // shows on a later repaint (or, for the convert, at download time).
  var infoP = withBudget(infoFor(host, f), PREVIEW_BUDGET_MS);
  var resP = withBudget(jobFor(host, f, opts, key), PREVIEW_BUDGET_MS);
  var info = await infoP;
  var res = await resP;

  if (info) {
    base.sourceMeta = kind + ' · ' + info.width + '×' + info.height + ' px';
    base.animatedNote = !!info.animated; // conversion flattens to the first frame
  }

  if (!res) { base.pending = true; return base; }

  base.done = true;
  base.outSize = fmtBytes(res.bytes.length);
  base.outMeta = mimeLabel(res.mime) + ' · ' + res.width + '×' + res.height + ' px';
  base.carriedLine = carryLine(res.carried);
  var delta = f.size - res.bytes.length;
  var pct = f.size > 0 ? Math.round((Math.abs(delta) / f.size) * 100) : 0;
  // Honest either way - a lossless PNG of a photo is usually LARGER than the
  // JPEG/HEIC it came from, and that's worth saying plainly.
  if (delta > 0 && pct >= 1) {
    base.saved = true;
    base.deltaText = pct + '% smaller - ' + fmtBytes(delta) + ' saved';
  } else if (delta < 0 && pct >= 1) {
    base.grew = true;
    base.deltaText = pct + '% larger than the original';
  } else {
    base.deltaText = 'about the same size';
  }
  return base;
}

function onInit(ctx) { return compute(ctx); }
function onInput(ctx) { return compute(ctx); }

async function exportFile(ctx) {
  var inputs = inputsFrom(ctx.model);
  var host = ctx.host;
  var f = inputs.source;
  if (!f || !f.bytes) throw new Error('Choose an image first.');
  if (!imageKind(f.bytes)) throw new Error('That file doesn\'t look like an image.');
  if (!hasImagesApi(host)) {
    throw new Error('Image conversion isn\'t available in this app.');
  }

  var opts = optsOf(inputs);
  var res = await jobFor(host, f, opts, jobKey(f, opts));
  // Mirror the card's disclosure onto the log channel so a headless run (the
  // CLI writes info logs to stderr) discloses the carry identically.
  var line = carryLine(res.carried);
  if (line && typeof host.log === 'function') host.log('info', line);
  return { bytes: res.bytes, mime: res.mime, filename: outName(f.name, res.mime) };
}
