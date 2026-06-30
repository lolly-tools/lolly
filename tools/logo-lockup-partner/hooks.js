/**
 * Logo Lockup: Partner — co-branding lockup hook.
 *
 * Lays out a lead logo (the SUSE logo by default) beside one or more partner logos,
 * with a connector (vertical bar / symbol / text) between them. Light or dark theme.
 *
 * The lead is the SUSE logo and follows the theme automatically: a SUSE library logo
 * is re-resolved to the on-light / on-dark, colour / mono variant for the chosen
 * theme + treatment (host.assets.get). Drop in your own lead to override; monochrome
 * then desaturates it instead of swapping artwork.
 *
 * Every logo is normalised to its content box (margins trimmed) and sized by a common
 * base height, scaled by optical-weight balancing (so the lead and partners read as
 * equally prominent) and by each logo's Presence tier. Raster logos are cropped to
 * their content box as a real <img> src so they fit exactly and survive every export
 * format; SVG logos keep their (tight) viewBox. Partner treatments (grayscale/invert)
 * are CSS filters on the <img>: PNG honours them on any logo, and the SVG/PDF walker
 * bakes them into raster logos — but an SVG-source logo keeps its colour in SVG/PDF
 * (the SUSE mono lead avoids this by swapping to real one-colour artwork).
 *
 * Pixel work (content trim, weight) needs a browser canvas; a headless shell keeps the
 * original artwork and equal heights.
 */

// ── caches (per source url) ──────────────────────────────────────────────────
var _imgCache = {};   // url -> Promise<Image>
var _boxCache = {};   // url -> content box + weight
var _cropCache = {};  // url -> content-trimmed data URL
// Remembered for beforeExport (which only sees format/opts).
var _transparent = false, _bg = '#ffffff';

// Theme backgrounds. Light is paper; dark is SUSE's deep green so the on-dark logos sit
// on-brand. A logo's own transparency is preserved; this only fills behind it.
var LIGHT_BG = '#ffffff', DARK_BG = '#0c322c';
var LIGHT_INK = '#16181d', DARK_INK = '#ffffff';

// Per-logo "Presence" tiers → a size multiplier applied on TOP of optical balancing.
var PRESENCE = { hero: 1.6, large: 1.25, normal: 1, small: 0.72 };
function presenceMul(v) { return PRESENCE[v] != null ? PRESENCE[v] : 1; }

var SYMBOLS = { times: '×', plus: '+', amp: '&' };

// The artboard (matches render.width/height in tool.json) and its CSS padding, so the
// hook can fit the lockup to the available area. Kept here as the single source.
var CANVAS_W = 1200, CANVAS_H = 360, PAD_X = 56, PAD_Y = 40;
var AVAIL_W = CANVAS_W - 2 * PAD_X;   // usable width  (1088)
var AVAIL_H = CANVAS_H - 2 * PAD_Y;   // usable height (280)

// ── small helpers ────────────────────────────────────────────────────────────
function inputsFrom(model) { var o = {}; model.forEach(function (i) { o[i.id] = i.value; }); return o; }
function num(v, d) { var x = Number(v); return isFinite(x) ? x : d; }
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function color(v, fallback) { var s = (typeof v === 'string' ? v : '').trim(); return s ? s : fallback; }

// Hex → [r,g,b]. Used to pre-blend connector colours so they don't rely on CSS
// opacity (which the SVG/PDF export walker drops — a 0.32 hairline would otherwise
// export as a solid ink bar). Blending toward the theme background here makes the
// muted look identical on screen, in PNG, and in vector export.
function hexToRgb(h) {
  h = String(h || '').replace('#', '');
  if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
  var n = parseInt(h, 16);
  return isFinite(n) ? [(n >> 16) & 255, (n >> 8) & 255, n & 255] : [0, 0, 0];
}
function mix(fg, bg, a) {
  var f = hexToRgb(fg), b = hexToRgb(bg);
  function ch(i) { return Math.round(f[i] * a + b[i] * (1 - a)); }
  return 'rgb(' + ch(0) + ',' + ch(1) + ',' + ch(2) + ')';
}

function canRaster() {
  if (typeof document === 'undefined' || !document.createElement) return false;
  try { var c = document.createElement('canvas'); return !!(c.getContext && c.getContext('2d')); }
  catch (e) { return false; }
}

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
  if (_imgCache[url]) return _imgCache[url];
  var promise = loadImage(url);
  _imgCache[url] = promise;
  promise.catch(function () { if (_imgCache[url] === promise) delete _imgCache[url]; });
  return promise;
}

// Resolution-independent content box (margins trimmed) + optical weight of a logo,
// measured at a fixed sample size. fx/fy/fw/fh are fractions of the image; weight is
// the artwork's footprint over its bounding square (any colour). Cached per url.
function measureContent(url, img) {
  if (_boxCache[url]) return _boxCache[url];
  if (typeof document === 'undefined' || !document.createElement) return null;
  var iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  if (!iw || !ih) return null;
  var S = 96, cols, rows;
  if (iw >= ih) { cols = S; rows = Math.max(1, Math.round(S * ih / iw)); }
  else { rows = S; cols = Math.max(1, Math.round(S * iw / ih)); }

  var c = document.createElement('canvas');
  c.width = cols; c.height = rows;
  var ctx = c.getContext && c.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  if (ctx.imageSmoothingQuality) ctx.imageSmoothingQuality = 'high';
  ctx.clearRect(0, 0, cols, rows);
  ctx.drawImage(img, 0, 0, cols, rows);
  var data;
  try { data = ctx.getImageData(0, 0, cols, rows).data; }
  catch (e) { return null; }                 // tainted canvas (cross-origin asset)

  function corner(x, y) { var p = (y * cols + x) * 4; return [data[p], data[p + 1], data[p + 2], data[p + 3]]; }
  var cs = [corner(0, 0), corner(cols - 1, 0), corner(0, rows - 1), corner(cols - 1, rows - 1)];
  function med4(a) { var s = a.slice().sort(function (m, n) { return m - n; }); return (s[1] + s[2]) / 2; }
  var bgOpaque = cs.filter(function (q) { return q[3] >= 32; }).length === 4;
  var bg = [0, 1, 2].map(function (k) { return med4([cs[0][k], cs[1][k], cs[2][k], cs[3][k]]); });

  var minX = cols, minY = rows, maxX = -1, maxY = -1, presence = 0;
  for (var y = 0; y < rows; y++) {
    for (var x = 0; x < cols; x++) {
      var p = (y * cols + x) * 4, a = data[p + 3];
      if (a < 24) continue;
      var content;
      if (!bgOpaque) { content = true; }
      else {
        var dr = data[p] - bg[0], dg = data[p + 1] - bg[1], db = data[p + 2] - bg[2];
        content = (dr * dr + dg * dg + db * db) > 1200;
      }
      if (!content) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      presence += a / 255;
    }
  }

  var box;
  if (maxX < minX) {
    box = { fx: 0, fy: 0, fw: 1, fh: 1, weight: 0.01 };
  } else {
    var bw = maxX - minX + 1, bh = maxY - minY + 1, sq = Math.max(bw, bh);
    box = {
      fx: minX / cols, fy: minY / rows, fw: bw / cols, fh: bh / rows,
      weight: Math.max(0.01, presence / (sq * sq)),
    };
  }
  _boxCache[url] = box;
  return box;
}

// A raster logo cropped to its content box (margins removed) as a data URL — so a plain
// <img> fits its slot tightly and consistently, and embeds faithfully in every export
// format. Returns the original url when there's nothing to trim or pixels can't be read.
function getTrimmedRaster(url, img, box) {
  if (_cropCache[url] !== undefined) return _cropCache[url];
  if (!box) return url;
  if (box.fx <= 0.012 && box.fy <= 0.012 && box.fw >= 0.976 && box.fh >= 0.976) {
    _cropCache[url] = url; return url;
  }
  if (typeof document === 'undefined' || !document.createElement) return url;
  var iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  if (!iw || !ih) return url;
  var sx = clamp(Math.floor(box.fx * iw) - 1, 0, iw - 1);
  var sy = clamp(Math.floor(box.fy * ih) - 1, 0, ih - 1);
  var sw = clamp(Math.ceil((box.fx + box.fw) * iw) + 1, sx + 1, iw) - sx;
  var sh = clamp(Math.ceil((box.fy + box.fh) * ih) + 1, sy + 1, ih) - sy;
  if (sw <= 0 || sh <= 0) { _cropCache[url] = url; return url; }
  try {
    var c = document.createElement('canvas');
    c.width = sw; c.height = sh;
    var ctx = c.getContext && c.getContext('2d');
    if (!ctx) return url;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    var out = c.toDataURL('image/png');
    _cropCache[url] = out;
    return out;
  } catch (e) { _cropCache[url] = url; return url; }
}

function pruneCaches(activeUrls) {
  var keep = {};
  activeUrls.forEach(function (u) { if (u) keep[u] = true; });
  Object.keys(_imgCache).forEach(function (u) { if (!keep[u]) delete _imgCache[u]; });
  Object.keys(_boxCache).forEach(function (u) { if (!keep[u]) delete _boxCache[u]; });
  Object.keys(_cropCache).forEach(function (u) { if (!keep[u]) delete _cropCache[u]; });
}

// ── lead (SUSE) variant resolution ───────────────────────────────────────────
// The SUSE library logos come in horizontal/vertical × on-light/on-dark × colour/mono
// variants. Map the chosen orientation + theme + treatment to the right id. Orientation
// is taken from whatever SUSE logo the user picked, so a vertical pick stays vertical.
function suseVariantId(orient, theme, mono) {
  var o = orient === 'vert' ? 'vert' : 'hor';
  var pol = theme === 'dark' ? 'neg' : 'pos';
  var col = mono ? (theme === 'dark' ? 'white' : 'black') : 'green';
  return 'suse/logo/' + o + '-' + pol + '-' + col;
}
function isSuseLogo(ref) {
  return !!(ref && typeof ref.id === 'string' && ref.id.indexOf('suse/logo/') === 0);
}

// Resolve the lead to the artwork actually used. A SUSE logo is swapped to the variant
// matching its orientation + the theme/treatment (no desaturation needed — there's real
// on-dark and mono artwork). A user's own lead is used as-is, desaturated when mono.
async function resolveLead(ref, theme, mono) {
  if (!ref || !ref.url) return null;
  if (isSuseLogo(ref)) {
    var orient = ref.id.indexOf('vert-') !== -1 ? 'vert' : 'hor';
    var want = suseVariantId(orient, theme, mono);
    if (ref.id !== want && typeof host !== 'undefined' && host.assets && host.assets.get) {
      try {
        var v = await host.assets.get(want);
        if (v && v.url) return { ref: v, mono: false };
      } catch (e) { /* fall through to the resolved default */ }
    }
    return { ref: ref, mono: false };
  }
  return { ref: ref, mono: mono };   // own logo: monochrome via grayscale filter
}

// ── build one logo's render data ──────────────────────────────────────────────
function filterClass(name) {
  if (name === 'grayscale') return 'll-f-grayscale';
  if (name === 'invert') return 'll-f-invert';
  return '';
}

function makeItem(ref, opts) {
  var url = ref && ref.url ? ref.url : '';
  return {
    url: url,
    displayUrl: url,
    name: ref && ref.meta && ref.meta.name ? ref.meta.name : '',
    isSvg: !!(ref && (ref.type === 'vector' || ref.format === 'svg')),
    opacity: clamp(num(opts.opacity, 1), 0.1, 1),
    pmul: presenceMul(opts.presence),
    filterClass: opts.mono ? 'll-f-grayscale' : filterClass(opts.filter),
    isLead: !!opts.isLead,
    canvasId: opts.canvasId,
    aspect: 1,    // content width / height — measured below, drives fit-to-width
    box: null,    // content box + optical weight
    h: 0,
  };
}

// ── lifecycle ────────────────────────────────────────────────────────────────
async function compute(model) {
  var inputs = inputsFrom(model);
  var theme = inputs.theme === 'dark' ? 'dark' : 'light';
  var mono = inputs.leadTreatment === 'mono';
  var layout = inputs.layout === 'lead' ? 'lead' : 'row';
  var baseH = clamp(num(inputs.size, 120), 40, 220);
  var gap = clamp(num(inputs.gap, 56), 0, 240);
  var balance = inputs.balance !== false;

  _transparent = Boolean(inputs.transparentBg);
  _bg = theme === 'dark' ? DARK_BG : LIGHT_BG;
  var ink = theme === 'dark' ? DARK_INK : LIGHT_INK;

  // Lead + partners → one item list.
  var lead = await resolveLead(inputs.lead, theme, mono);
  var items = [];
  if (lead) {
    items.push(makeItem(lead.ref, {
      opacity: 1, presence: inputs.leadPresence, mono: lead.mono, isLead: true, canvasId: 'lead',
    }));
  }
  var partners = Array.isArray(inputs.partners) ? inputs.partners : [];
  partners.forEach(function (b, i) {
    var ref = b && b.logo;
    if (!ref || !ref.url) return;             // skip empty partner rows
    items.push(makeItem(ref, {
      opacity: b.opacity, presence: b.presence, filter: b.filter,
      isLead: false, canvasId: 'partners:' + i,
    }));
  });

  // Decode each logo once: content box (optical weight + aspect) and a content-trimmed
  // src for rasters (so an <img> fits tightly and embeds faithfully in every export).
  // Needs a browser canvas; a headless shell keeps originals and assumes a square aspect.
  if (canRaster()) {
    await Promise.all(items.map(async function (it) {
      if (!it.url) return;
      var img = await getImage(it.url).catch(function () { return null; });
      if (!img) return;
      var box = measureContent(it.url, img);
      it.box = box;
      var nw = img.naturalWidth || img.width, nh = img.naturalHeight || img.height;
      // Aspect must match how the element actually lays out: a raster <img> renders the
      // TRIMMED crop (content aspect), an SVG <img> renders its FULL viewBox (intrinsic
      // aspect). Using the wrong one skews the fit-to-width budget for padded SVGs.
      if (it.isSvg) it.aspect = (nw && nh) ? nw / nh : 1;
      else if (box && nw && nh) it.aspect = (box.fw * nw) / (box.fh * nh);
      else if (nw && nh) it.aspect = nw / nh;
      if (!it.isSvg) it.displayUrl = getTrimmedRaster(it.url, img, box);
    }));
  }

  // Optical-weight balancing: equalise each logo's footprint so the lead and partners
  // read equally. Reference = median weight (robust to one odd logo).
  var factors = items.map(function () { return 1; });
  if (balance && items.length >= 2) {
    var dens = [];
    items.forEach(function (it) { if (it.box && it.box.weight != null) dens.push(Math.max(it.box.weight, 0.01)); });
    if (dens.length >= 2) {
      dens.sort(function (a, b) { return a - b; });
      var mid = dens.length >> 1;
      var refDen = dens.length % 2 ? dens[mid] : (dens[mid - 1] + dens[mid]) / 2;
      items.forEach(function (it, i) {
        var den = it.box && it.box.weight != null ? Math.max(it.box.weight, 0.01) : null;
        factors[i] = den ? clamp(Math.sqrt(refDen / den), 0.55, 1.7) : 1;
      });
    }
  }

  // Raw target height per logo: base × balance × presence × lead emphasis.
  var leadEmphasis = layout === 'lead' ? 1.45 : 1;
  items.forEach(function (it, i) {
    var emph = it.isLead ? leadEmphasis : 1;
    it.h = clamp(baseH * factors[i] * it.pmul * emph, 12, 600);
  });

  // Connector kind (needed before fitting so its width counts).
  var connKind = inputs.connector || 'bar';
  var connectorOn = connKind !== 'none' && items.length >= 2 && items.some(function (it) { return it.isLead; });

  // Fit the whole lockup to the artboard: the row of logos (each width = height × aspect),
  // the connector and the gaps between elements must all fit AVAIL_W, and nothing may
  // exceed AVAIL_H. Everything scales by ONE factor — logos, gaps, and the connector
  // (which keys off the fitted height below) — so a wide wordmark, many partners, OR a
  // large gap can never spill off the canvas (which would clip on export). Scaling the
  // gaps too is what makes the dense / big-spacing cases stay inside the artboard.
  var connWEst = !connectorOn ? 0 : (connKind === 'symbol' ? baseH * 0.5 : connKind === 'text' ? baseH * 1.6 : 4);
  var elemCount = items.length + (connectorOn ? 1 : 0);
  var logosW = items.reduce(function (s, it) { return s + it.h * (it.aspect || 1); }, 0);
  var rawW = logosW + connWEst + Math.max(0, elemCount - 1) * gap;
  var fit = rawW > AVAIL_W ? AVAIL_W / rawW : 1;
  var tallest = items.reduce(function (m, it) { return Math.max(m, it.h * fit); }, 0);
  if (tallest > AVAIL_H) fit *= AVAIL_H / tallest;          // also cap height
  fit = clamp(fit, 0.04, 1);
  items.forEach(function (it) { it.h = Math.round(clamp(it.h * fit, 8, AVAIL_H)); });
  var gapPx = Math.round(gap * fit);                        // gaps shrink with the lockup

  pruneCaches(items.map(function (it) { return it.url; }));

  var leadCell = items.filter(function (it) { return it.isLead; })[0] || null;
  var partnerCells = items.filter(function (it) { return !it.isLead; });

  // Connector sizing keyed to the FITTED lead height, so it scales with the lockup.
  var effH = leadCell ? leadCell.h : (items[0] ? items[0].h : baseH);
  var connText = '', connStyle = '';
  // Colours are pre-blended toward the background (not CSS opacity) so the muted look
  // survives PDF export, where the vector walker drops element opacity.
  if (connectorOn) {
    if (connKind === 'symbol') {
      connText = SYMBOLS[inputs.symbol] || SYMBOLS.times;
      connStyle = 'font-size:' + Math.round(effH * 0.52) + 'px;color:' + mix(ink, _bg, 0.5);
    } else if (connKind === 'text') {
      connText = String(inputs.connectorText == null ? '' : inputs.connectorText);
      connStyle = 'font-size:' + clamp(Math.round(effH * 0.16), 11, 40) + 'px;color:' + mix(ink, _bg, 0.72);
    } else { // bar
      connStyle = 'height:' + Math.round(effH * 0.9) + 'px;background:' + mix(ink, _bg, 0.32);
    }
  }

  return {
    hasContent: !!(leadCell || partnerCells.length),
    themeClass: 'll-theme-' + theme,
    layoutClass: 'll-layout-' + layout,
    stageBg: _transparent ? 'transparent' : _bg,
    ink: ink,
    // NB: key must NOT be 'gap' — that's a declared input id, and a returned key matching
    // an input id overwrites that input (clobbering the user's slider in a feedback loop).
    rowGap: gapPx,
    leadCell: leadCell,
    partnerCells: partnerCells,
    connectorOn: connectorOn,
    connKind: connKind,
    connText: connText,
    connStyle: connStyle,
  };
}

function onInit(ctx) { return compute(ctx.model); }
function onInput(ctx) { return compute(ctx.model); }

function beforeExport(ctx) {
  // Raster formats: honour "No BG" (real transparency) or fill with the theme colour
  // so a non-matching export aspect has no transparent margins. Vector keeps its own.
  var alpha = ['png', 'webp'];
  if (alpha.indexOf(ctx.format) !== -1) {
    ctx.opts.background = _transparent ? 'transparent' : _bg;
  } else if (ctx.format === 'jpg' || ctx.format === 'jpeg') {
    ctx.opts.background = _bg;
  }
}
