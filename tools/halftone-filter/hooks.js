/**
 * Halftone Filter — hooks.
 *
 * Turns a raster image into a *vector* halftone: a grid of dots whose size
 * tracks the local lightness of the photo. The whole thing is emitted as an
 * inline <svg> (extra `svgContent`) so the template is SVG-rooted — which means
 * the SVG export is a true, scalable vector of <circle>/<rect>/<path> dots, and
 * the raster exports (PNG/WebP/AVIF) rasterise that same SVG (with optional
 * transparency).
 *
 * The sampling pipeline mirrors the classic canvas halftone effect:
 *   decode image → downsample to a cols×rows luminance grid → brightness /
 *   contrast / gamma → optional box-blur smoothing → optional 1-bit dithering →
 *   draw one dot per cell sized by (1 - lightness).
 *
 * Pixel decoding needs a real <canvas> (browser only). In a headless shell
 * (CLI/jsdom) there's no 2D context, so the hook degrades to a friendly
 * placeholder instead of throwing — this is a browser-rendered tool.
 */

// The viewBox the dots live in — matches render.width/height (a square frame).
var VIEW = 1000;
// Upper bound on the dot grid so a tiny grid size can't emit a runaway SVG.
var MAX_CELLS = 26000;
// A raster library asset used when the user hasn't picked an image yet, so the
// tool shows a real halftone on first paint (resolved lazily, like the badge tool).
var DEFAULT_IMAGE_ID = 'suse/headshots/andy-fitzsimon';

// Decoded-image cache (keyed by URL). Holds the in-flight PROMISE, not just the
// resolved image, so re-renders during the first decode share one load instead
// of starting a second decode of the same URL.
var _imgCache = { url: null, promise: null };
// Resolved URL of the demo default asset, cached so the no-image state doesn't
// re-read it from storage on every keystroke.
var _defaultUrl = null;
// One-entry memo of the last rendered SVG, keyed on every input that affects it.
var _memoKey = null;
var _memoResult = null;
// Remembered for beforeExport (which only gets format/opts): the transparency
// toggle and the resolved background colour.
var _transparent = false;
var _bgColor = '#ffffff';

// ── small helpers ────────────────────────────────────────────────────────────

function inputsFrom(model) {
  var o = {};
  model.forEach(function (i) { o[i.id] = i.value; });
  return o;
}
function n(v, d) { var x = Number(v); return isFinite(x) ? x : d; }
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function f2(v) { return Math.round(v * 100) / 100; }
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// A valid CSS colour string, or a fallback. Keeps stray input out of the SVG.
function color(v, fallback) {
  var s = (typeof v === 'string' ? v : '').trim();
  return s ? s : fallback;
}

function svgOpen() {
  return '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" '
    + 'viewBox="0 0 ' + VIEW + ' ' + VIEW + '" '
    + 'preserveAspectRatio="xMidYMid meet">';
}

function placeholder(message) {
  return svgOpen()
    + '<rect width="' + VIEW + '" height="' + VIEW + '" fill="#f4f4f5"/>'
    + '<text x="' + (VIEW / 2) + '" y="' + (VIEW / 2) + '" text-anchor="middle" '
    + 'dominant-baseline="middle" font-family="sans-serif" font-size="34" '
    + 'fill="#9ca3af">' + esc(message) + '</text>'
    + '</svg>';
}

// ── image decoding ───────────────────────────────────────────────────────────

function loadImage(url) {
  return new Promise(function (resolve, reject) {
    if (typeof Image === 'undefined') { reject(new Error('no Image')); return; }
    var im = new Image();
    im.onload = function () { resolve(im); };
    im.onerror = function () { reject(new Error('image load failed')); };
    try { im.crossOrigin = 'anonymous'; } catch (e) { /* ignore */ }
    im.src = url;
  });
}

function getImage(url) {
  if (_imgCache.url === url && _imgCache.promise) return _imgCache.promise;
  var promise = loadImage(url);
  _imgCache = { url: url, promise: promise };
  // Drop a failed load so a later attempt can retry rather than reusing the reject.
  promise.catch(function () { if (_imgCache.url === url) _imgCache = { url: null, promise: null }; });
  return promise;
}

// Whether this shell can decode pixels at all (real browser canvas with a 2D
// context). Headless shells (CLI/jsdom) can't, and their <img> never fires load,
// so we probe up front and skip image loading entirely rather than hang to the
// hook timeout.
function canRaster() {
  if (typeof document === 'undefined' || !document.createElement) return false;
  try {
    var c = document.createElement('canvas');
    return !!(c.getContext && c.getContext('2d'));
  } catch (e) { return false; }
}

// Downsample the image into a cols×rows grid of luminance values (0..255).
// Returns null when there's no usable 2D canvas (headless shells).
function sampleGrid(img, cols, rows, fit) {
  if (typeof document === 'undefined' || !document.createElement) return null;
  var c = document.createElement('canvas');
  c.width = cols; c.height = rows;
  var ctx = c.getContext && c.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  if (ctx.imageSmoothingQuality) ctx.imageSmoothingQuality = 'high';

  var iw = img.naturalWidth || img.width;
  var ih = img.naturalHeight || img.height;
  if (!iw || !ih) return null;

  if (fit === 'cover') {
    // Scale the source to fill the grid, centre-cropping the overflow.
    var s = Math.max(cols / iw, rows / ih);
    var dw = iw * s, dh = ih * s;
    ctx.drawImage(img, (cols - dw) / 2, (rows - dh) / 2, dw, dh);
  } else {
    // 'contain': the grid already carries the image's aspect ratio (see geometry
    // below), so a straight stretch into it preserves proportions.
    ctx.drawImage(img, 0, 0, cols, rows);
  }

  var data;
  try { data = ctx.getImageData(0, 0, cols, rows).data; }
  catch (e) { return null; } // tainted canvas (cross-origin asset)

  var g = new Float32Array(cols * rows);
  for (var i = 0, p = 0; i < g.length; i++, p += 4) {
    var a = data[p + 3] / 255;
    var lum = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
    // Composite transparency onto white so cut-out PNGs don't read as pure black.
    if (a < 1) lum = lum * a + 255 * (1 - a);
    g[i] = lum;
  }
  return g;
}

// ── tone + texture (ported from the reference canvas halftone) ────────────────

function applyTone(grid, brightness, contrast, gamma) {
  var cf = (259 * (contrast + 255)) / (255 * (259 - contrast));
  var invG = 1 / (gamma > 0 ? gamma : 0.0001);
  for (var i = 0; i < grid.length; i++) {
    var v = cf * (grid[i] - 128) + 128 + brightness;
    v = clamp(v, 0, 255);
    grid[i] = 255 * Math.pow(v / 255, invG);
  }
}

// One 3×3 box-blur pass (full 9-tap neighbourhood average) → a fresh array.
function onePass(src, cols, rows) {
  var t = new Float32Array(src.length);
  for (var row = 0; row < rows; row++) {
    for (var col = 0; col < cols; col++) {
      var sum = 0, count = 0;
      for (var dy = -1; dy <= 1; dy++) {
        for (var dx = -1; dx <= 1; dx++) {
          var r = row + dy, cc = col + dx;
          if (r >= 0 && r < rows && cc >= 0 && cc < cols) { sum += src[r * cols + cc]; count++; }
        }
      }
      t[row * cols + col] = sum / count;
    }
  }
  return t;
}

// Box-blur the cell grid by `strength` passes. The fractional part cross-fades
// the last full pass toward ONE MORE pass, so blur increases monotonically across
// the whole slider — a fractional step always *adds* blur (the earlier version
// blended toward the unblurred grid, which made smoothing non-monotonic).
function boxBlur(grid, cols, rows, strength) {
  var passes = Math.floor(strength);
  var frac = strength - passes;
  var base = grid;
  for (var p = 0; p < passes; p++) base = onePass(base, cols, rows);
  if (frac > 0) {
    var extra = onePass(base, cols, rows);
    var out = new Float32Array(base.length); // never mutate the caller's grid in place
    for (var i = 0; i < base.length; i++) out[i] = base[i] * (1 - frac) + extra[i] * frac;
    return out;
  }
  return base;
}

function ditherFloyd(grid, cols, rows) {
  for (var row = 0; row < rows; row++) {
    for (var col = 0; col < cols; col++) {
      var idx = row * cols + col;
      var oldV = grid[idx];
      var newV = oldV < 128 ? 0 : 255;
      var err = oldV - newV;
      grid[idx] = newV;
      if (col + 1 < cols) grid[idx + 1] += err * 7 / 16;
      if (row + 1 < rows) {
        if (col - 1 >= 0) grid[idx + cols - 1] += err * 3 / 16;
        grid[idx + cols] += err * 5 / 16;
        if (col + 1 < cols) grid[idx + cols + 1] += err * 1 / 16;
      }
    }
  }
}

function ditherOrdered(grid, cols, rows) {
  var bayer = [[0, 2], [3, 1]];
  for (var row = 0; row < rows; row++) {
    for (var col = 0; col < cols; col++) {
      var t = (bayer[row % 2][col % 2] + 0.5) * (255 / 4);
      var idx = row * cols + col;
      grid[idx] = grid[idx] < t ? 0 : 255;
    }
  }
}

// Noise dithering uses an index-seeded pseudo-random so the texture is stable
// across re-renders (Math.random would shimmer on every keystroke / export).
function ditherNoise(grid, cols, rows) {
  for (var i = 0; i < grid.length; i++) {
    var s = Math.sin(i * 12.9898) * 43758.5453;
    var rnd = s - Math.floor(s);              // 0..1, deterministic
    var v = grid[i] + (rnd - 0.5) * 50;
    grid[i] = v < 128 ? 0 : 255;
  }
}

// ── dot geometry → SVG ───────────────────────────────────────────────────────

function dotMarkup(shape, cx, cy, r) {
  cx = f2(cx); cy = f2(cy); r = f2(r);
  if (shape === 'square') {
    var s = f2(r * 1.7724);                    // match a circle's area (√π)
    return '<rect x="' + f2(cx - s / 2) + '" y="' + f2(cy - s / 2) + '" width="' + s + '" height="' + s + '"/>';
  }
  if (shape === 'diamond') {
    var d = f2(r * 1.2533);                     // match a circle's area (√(π/2))
    return '<path d="M' + cx + ' ' + f2(cy - d) + 'L' + f2(cx + d) + ' ' + cy
      + 'L' + cx + ' ' + f2(cy + d) + 'L' + f2(cx - d) + ' ' + cy + 'Z"/>';
  }
  return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '"/>';
}

function buildSvg(args) {
  var img = args.img;
  var cell = clamp(n(args.gridSize, 10), 4, 40);
  var fit = args.fit === 'cover' ? 'cover' : 'contain';

  var iw = img.naturalWidth || img.width;
  var ih = img.naturalHeight || img.height;
  var ar = iw / ih;

  // Region the dots occupy inside the square viewBox. 'contain' fits the whole
  // image (letterboxed by the background); 'cover' fills the frame.
  var regionW, regionH;
  if (fit === 'cover') {
    regionW = VIEW; regionH = VIEW;
  } else if (ar >= 1) {
    regionW = VIEW; regionH = VIEW / ar;
  } else {
    regionH = VIEW; regionW = VIEW * ar;
  }

  var cols = Math.max(1, Math.round(regionW / cell));
  var rows = Math.max(1, Math.round(regionH / cell));
  // Clamp total dots so a fine grid on a big region stays bounded.
  if (cols * rows > MAX_CELLS) {
    var k = Math.sqrt(MAX_CELLS / (cols * rows));
    cols = Math.max(1, Math.floor(cols * k));
    rows = Math.max(1, Math.floor(rows * k));
  }

  var grid = sampleGrid(img, cols, rows, fit);
  if (!grid) return null; // headless / tainted — caller falls back to placeholder

  applyTone(grid, clamp(n(args.brightness, 0), -100, 100),
    clamp(n(args.contrast, 0), -100, 100), clamp(n(args.gamma, 1), 0.1, 3));

  var smoothing = clamp(n(args.smoothing, 0), 0, 5);
  if (smoothing > 0) grid = boxBlur(grid, cols, rows, smoothing);

  if (args.dither === 'floyd') ditherFloyd(grid, cols, rows);
  else if (args.dither === 'ordered') ditherOrdered(grid, cols, rows);
  else if (args.dither === 'noise') ditherNoise(grid, cols, rows);

  var offX = (VIEW - regionW) / 2;
  var offY = (VIEW - regionH) / 2;
  var cellW = regionW / cols;
  var cellH = regionH / rows;
  var maxR = (Math.min(cellW, cellH) / 2) * clamp(n(args.dotScale, 1), 0.4, 1.5);
  var invert = Boolean(args.invert);
  var shape = args.shape || 'circle';

  var dots = [];
  for (var row = 0; row < rows; row++) {
    for (var col = 0; col < cols; col++) {
      var norm = clamp(grid[row * cols + col] / 255, 0, 1);
      var coverage = invert ? norm : (1 - norm); // dark → big dot (unless inverted)
      var r = maxR * coverage;
      if (r < 0.3) continue;                      // skip invisibly small dots
      dots.push(dotMarkup(shape, offX + (col + 0.5) * cellW, offY + (row + 0.5) * cellH, r));
    }
  }

  var fg = color(args.fgColor, '#0c322c');
  var bg = args.transparent ? null : color(args.bgColor, '#ffffff');
  var out = svgOpen();
  if (bg) out += '<rect width="' + VIEW + '" height="' + VIEW + '" fill="' + esc(bg) + '"/>';
  out += '<g fill="' + esc(fg) + '">' + dots.join('') + '</g></svg>';
  return out;
}

// ── lifecycle ────────────────────────────────────────────────────────────────

async function compute(model) {
  var inputs = inputsFrom(model);
  _transparent = Boolean(inputs.transparentBg);
  _bgColor = color(inputs.bgColor, '#ffffff');

  // No canvas pixel access (headless CLI/jsdom): skip image loading (its <img>
  // would never resolve) and show the placeholder. This is a browser tool.
  if (!canRaster()) return { svgContent: placeholder('Preview renders in the browser') };

  // Resolve the image URL: the user's pick, else the demo default asset (resolved
  // from storage once, then cached so keystrokes don't re-read it).
  var ref = inputs.image;
  var url = ref && typeof ref === 'object' ? ref.url : null;
  if (!url) {
    if (!_defaultUrl) {
      try {
        var def = await host.assets.get(DEFAULT_IMAGE_ID);
        _defaultUrl = def && def.url;
      } catch (e) {
        if (host.log) host.log('warn', 'halftone-filter: default image unavailable', { error: String(e) });
      }
    }
    url = _defaultUrl;
  }
  if (!url) return { svgContent: placeholder('Choose an image to halftone') };

  // One params object is the single source of truth for both the memo key and the
  // render, so a render-affecting input can't drift out of the memo (and silently
  // cache a stale preview).
  var params = {
    url: url, gridSize: inputs.gridSize, dotScale: inputs.dotScale, shape: inputs.shape,
    fgColor: inputs.fgColor, bgColor: inputs.bgColor, invert: inputs.invert, fit: inputs.fit,
    brightness: inputs.brightness, contrast: inputs.contrast, gamma: inputs.gamma,
    smoothing: inputs.smoothing, dither: inputs.dither, transparent: _transparent,
  };
  var memoKey = JSON.stringify(params);
  if (memoKey === _memoKey) return _memoResult;

  var svgContent;
  try {
    params.img = await getImage(url);
    svgContent = buildSvg(params);
    if (!svgContent) svgContent = placeholder('Preview renders in the browser');
  } catch (e) {
    if (host.log) host.log('warn', 'halftone-filter: render failed', { error: String(e) });
    svgContent = placeholder('Could not read this image');
  }

  _memoKey = memoKey;
  _memoResult = { svgContent: svgContent };
  return _memoResult;
}

function onInit(ctx) { return compute(ctx.model); }
function onInput(ctx) { return compute(ctx.model); }

function beforeExport(ctx) {
  // Alpha-capable raster formats: for "No BG" clear the canvas so it exports with
  // real transparency (the SVG already omits its background rect); otherwise fill
  // the whole exported frame with the chosen background, so a non-square export
  // has no transparent margins around the square halftone (the SVG's own bg rect
  // only covers its square viewBox). SVG stays transparent / square by design.
  var alpha = ['png', 'webp', 'avif'];
  if (alpha.indexOf(ctx.format) !== -1) {
    ctx.opts.background = _transparent ? 'transparent' : _bgColor;
  }
}
