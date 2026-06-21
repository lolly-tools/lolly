/**
 * URL Capture hooks.
 *
 * Capture is a slow, side-effectful navigation (load a page, settle, scroll,
 * read its pixels), so it runs in `beforeExport` — the deliberate export action.
 * The auto-fired hooks can't host it: onInit (5s) and onInput (2s) are timeout-
 * wrapped and a real page load + settle won't fit, and re-capturing on every
 * keystroke would hammer the network.
 *
 * beforeExport receives { node, format, opts, host } but NOT the input model, so
 * onInit/onInput stash the latest inputs in a module-level var for it to read
 * (the same pattern qr-code uses for its transparent-bg flag).
 */

var _params = { url: '', scrollDepth: 0, waitMs: 500, css: '' };

function stash(model) {
  var v = Object.fromEntries(model.map(function (i) { return [i.id, i.value]; }));
  _params = {
    url: typeof v.url === 'string' ? v.url.trim() : '',
    scrollDepth: Number.isFinite(Number(v.scrollDepth)) ? Number(v.scrollDepth) : 0,
    waitMs: Number.isFinite(Number(v.waitMs)) ? Math.max(0, Number(v.waitMs)) : 500,
    css: typeof v.css === 'string' ? v.css : '',
  };
  return {};
}

function onInit({ model }) { return stash(model); }
function onInput({ model }) { return stash(model); }

async function beforeExport({ node, opts, host }) {
  // Thumbnails (and other cheap previews) must NOT trigger a fresh capture — that
  // is a slow headless-browser navigation. Reuse whatever is already on the canvas:
  // the last render if one exists, otherwise the placeholder. This is what makes
  // Save/leave fast after you've already rendered once.
  if (opts && opts.thumbnail) return;

  if (!host.capture) {
    throw new Error('URL capture needs the desktop app — the web app can’t screenshot external pages.');
  }
  if (!_params.url) {
    throw new Error('Enter a URL to capture.');
  }

  // Capture at the requested export dimensions when they're plain pixels; fall
  // back to the tool's render size. Physical units (e.g. "210mm") are resolved
  // by the export bridge per format — the engine owns that math, not this hook —
  // so we only read a leading pixel value here.
  var px = function (d, fallback) {
    var n = parseFloat(d);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : fallback;
  };
  var width = px(opts.width, 1280);
  var height = px(opts.height, 720);
  var dpi = Number(opts.dpi);

  var shot = await host.capture.page({
    url: _params.url,
    width: width,
    height: height,
    scrollDepth: _params.scrollDepth,
    waitMs: _params.waitMs,
    dpr: Number.isFinite(dpi) && dpi > 96 ? dpi / 96 : 1,
    css: _params.css,
  });

  // Composite the capture into the render target so the existing export path
  // (units, format conversion, provenance, watermark) handles it like any render.
  var img = node.querySelector('[data-capture]');
  if (img) {
    img.setAttribute('src', shot.url);
    img.setAttribute('width', String(width));
    img.setAttribute('height', String(height));
  }
  var placeholder = node.querySelector('[data-placeholder]');
  if (placeholder) {
    placeholder.style.display = 'none';
  }
}
