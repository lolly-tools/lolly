/* global onInit, onInput, exportFile */
/**
 * Compress PDF — hooks.
 *
 * A transform utility (file in → smaller file out). The actual compression lives
 * in the shell behind `host.pdf.compress` (pdf-lib + a browser canvas to re-encode
 * embedded images) — the hook sandbox has no PDF library and no `import`, so it
 * just orchestrates: read the picked PDF's bytes, ask the host to compress them
 * with the chosen settings, and hand the result to the download flow.
 *
 * The same compress job backs both the live before→after preview (onInit/onInput)
 * and the actual download (exportFile): a one-entry promise cache keyed on the
 * file + settings means the work runs once and the download reuses it. The preview
 * is bounded by a short inner budget so a huge PDF can't trip the runtime's 2s
 * onInput timeout — if it doesn't finish in time the card shows "ready" and the
 * full job still completes on download (10s budget).
 *
 * Settings (`level`, `grayscale`) are ordinary declared inputs, so they travel
 * through URL mode and the CLI; the canvas renders their controls (data-input-id)
 * and the web shell binds them back to the model.
 */

// One in-flight (or settled) compress job, keyed on file identity + settings, so
// the preview and the download share a single run instead of compressing twice.
var _job = { key: '', promise: null };
// How long the live preview waits for a result before falling back to "ready"
// (kept well under the runtime's 2s onInput timeout).
var PREVIEW_BUDGET_MS = 1200;

function inputsFrom(model) {
  var o = {};
  model.forEach(function (i) { o[i.id] = i.value; });
  return o;
}

function isPdf(bytes) {
  // "%PDF-" magic — tolerate a small leading BOM/garbage offset like real readers.
  if (!bytes || bytes.length < 5) return false;
  var limit = Math.min(bytes.length - 4, 1024);
  for (var i = 0; i <= limit; i++) {
    if (bytes[i] === 0x25 && bytes[i + 1] === 0x50 && bytes[i + 2] === 0x44 &&
        bytes[i + 3] === 0x46 && bytes[i + 4] === 0x2d) return true;
  }
  return false;
}

function fmtBytes(n) {
  if (!isFinite(n) || n <= 0) return '0 B';
  if (n < 1024) return n + ' B';
  var u = ['KB', 'MB', 'GB'], i = -1, v = n;
  do { v /= 1024; i++; } while (v >= 1024 && i < u.length - 1);
  return (v >= 10 ? Math.round(v) : Math.round(v * 10) / 10) + ' ' + u[i];
}

function levelOf(v) { return v === 'light' || v === 'strong' ? v : 'balanced'; }

function outName(name) {
  var base = String(name || 'document').replace(/\.pdf$/i, '');
  return base + '-compressed.pdf';
}

// Compress options for the host, derived from the declared inputs.
function optsOf(inputs) {
  return { level: levelOf(inputs.level), grayscale: Boolean(inputs.grayscale) };
}

function jobKey(file, opts) {
  // Include the object URL (unique per pick) so two different PDFs that happen to
  // share a name AND byte-size can't collide on the cached result.
  return (file.url || '') + '|' + file.name + '|' + file.size + '|' + opts.level + '|' + opts.grayscale;
}

// Return the shared compress promise for this (file, settings) key, starting it if
// needed. A failed job is dropped so a later attempt re-runs rather than reusing
// the rejection.
function jobFor(host, file, opts, key) {
  if (_job.key === key && _job.promise) return _job.promise;
  var p = Promise.resolve().then(function () { return host.pdf.compress(file.bytes, opts); });
  _job = { key: key, promise: p };
  p.catch(function () { if (_job.key === key) _job = { key: '', promise: null }; });
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

async function compute(ctx) {
  var inputs = inputsFrom(ctx.model);
  var host = ctx.host;
  var f = inputs.source;

  // The template reflects the `level`/`grayscale` controls from the input values
  // directly (they're in the template context by id, updated synchronously on
  // change), so we deliberately DON'T return those ids here — a hook key matching
  // an input id would write back to the model. Everything below is display-only.
  var base = {
    hasFile: false, supported: false, pdfUnavailable: false,
    fileName: '', fileSize: '',
    done: false, noGain: false, pending: false,
    compressedSize: '', savedText: '', imagesText: '',
  };

  if (!f || !f.bytes) return base;
  base.hasFile = true;
  base.fileName = f.name || 'document.pdf';
  base.fileSize = fmtBytes(f.size);

  if (!isPdf(f.bytes)) return base; // supported stays false → template shows "not a PDF"

  if (!host || !host.pdf || typeof host.pdf.compress !== 'function') {
    base.pdfUnavailable = true; // older shell: host.pdf without compress()
    return base;
  }
  base.supported = true;

  var opts = optsOf(inputs);
  var key = jobKey(f, opts);
  var res;
  try {
    res = await withBudget(jobFor(host, f, opts, key), PREVIEW_BUDGET_MS);
  } catch (e) {
    res = null;
  }

  if (!res) { base.pending = true; return base; }

  var saved = res.before - res.after;
  var pct = res.before > 0 ? Math.round((saved / res.before) * 100) : 0;
  base.compressedSize = fmtBytes(res.after);
  if (saved > 0 && pct >= 1) {
    base.done = true;
    base.savedText = pct + '% smaller — ' + fmtBytes(saved) + ' saved';
    base.imagesText = res.images > 0
      ? (res.images + ' image' + (res.images > 1 ? 's' : '') + ' recompressed')
      : '';
  } else {
    base.noGain = true;
  }
  return base;
}

function onInit(ctx) { return compute(ctx); }
function onInput(ctx) { return compute(ctx); }

async function exportFile(ctx) {
  var inputs = inputsFrom(ctx.model);
  var host = ctx.host;
  var f = inputs.source;
  if (!f || !f.bytes) throw new Error('Choose a PDF first.');
  if (!isPdf(f.bytes)) throw new Error('That file isn\'t a PDF.');
  if (!host || !host.pdf || typeof host.pdf.compress !== 'function') {
    throw new Error('PDF compression isn\'t available in this app.');
  }

  var opts = optsOf(inputs);
  var res = await jobFor(host, f, opts, jobKey(f, opts));
  return { bytes: res.bytes, mime: 'application/pdf', filename: outName(f.name) };
}
