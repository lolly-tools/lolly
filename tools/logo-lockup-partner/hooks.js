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
 * are CSS filters on the <img>, which the SVG/PDF export walker bakes in faithfully.
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

// ── small helpers ────────────────────────────────────────────────────────────
function inputsFrom(model) { var o = {}; model.forEach(function (i) { o[i.id] = i.value; }); return o; }
function num(v, d) { var x = Number(v); return isFinite(x) ? x : d; }
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function color(v, fallback) { var s = (typeof v === 'string' ? v : '').trim(); return s ? s : fallback; }

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
// The SUSE library logos come in on-light/on-dark × colour/mono variants. Map the
// chosen theme + treatment to the right id.
function suseVariantId(theme, mono) {
  var pol = theme === 'dark' ? 'neg' : 'pos';
  var col = mono ? (theme === 'dark' ? 'white' : 'black') : 'green';
  return 'suse/logo/hor-' + pol + '-' + col;
}
function isSuseLogo(ref) {
  return !!(ref && typeof ref.id === 'string' && ref.id.indexOf('suse/logo/') === 0);
}

// Resolve the lead to the artwork actually used. A SUSE logo is swapped to the variant
// matching the theme/treatment (no desaturation needed — there's real on-dark and mono
// artwork). A user's own lead is used as-is, desaturated via a filter when mono.
async function resolveLead(ref, theme, mono) {
  if (!ref || !ref.url) return null;
  if (isSuseLogo(ref)) {
    var want = suseVariantId(theme, mono);
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

  // Content-trim raster logos (browser only); SVG keeps its viewBox.
  if (canRaster()) {
    await Promise.all(items.map(async function (it) {
      if (!it.url || it.isSvg) return;
      var img = await getImage(it.url).catch(function () { return null; });
      if (!img) return;
      it.displayUrl = getTrimmedRaster(it.url, img, measureContent(it.url, img));
    }));
  }

  // Optical-weight balancing across every logo, so the lead and partners read equally.
  var factors = items.map(function () { return 1; });
  if (balance && canRaster() && items.length >= 2) {
    var imgs = await Promise.all(items.map(function (it) {
      return it.url ? getImage(it.url).catch(function () { return null; }) : Promise.resolve(null);
    }));
    var dens = [], denByIdx = [];
    for (var i = 0; i < items.length; i++) {
      var box = imgs[i] ? measureContent(items[i].url, imgs[i]) : null;
      var den = (box && box.weight != null) ? Math.max(box.weight, 0.01) : null;
      denByIdx[i] = den;
      if (den) dens.push(den);
    }
    if (dens.length >= 2) {
      dens.sort(function (a, b) { return a - b; });
      var mid = dens.length >> 1;
      var refDen = dens.length % 2 ? dens[mid] : (dens[mid - 1] + dens[mid]) / 2;
      for (var j = 0; j < items.length; j++) {
        factors[j] = denByIdx[j] ? clamp(Math.sqrt(refDen / denByIdx[j]), 0.55, 1.7) : 1;
      }
    }
  }

  // Lead emphasis in the "lead + partners" layout, on top of its presence.
  var leadEmphasis = layout === 'lead' ? 1.45 : 1;
  items.forEach(function (it, i) {
    var emph = it.isLead ? leadEmphasis : 1;
    it.h = Math.round(clamp(baseH * factors[i] * it.pmul * emph, 12, 320));
  });

  pruneCaches(items.map(function (it) { return it.url; }));

  var leadCell = items.filter(function (it) { return it.isLead; })[0] || null;
  var partnerCells = items.filter(function (it) { return !it.isLead; });

  // Connector — only meaningful between a lead and at least one partner.
  var connKind = inputs.connector || 'bar';
  var connectorOn = connKind !== 'none' && !!leadCell && partnerCells.length >= 1;
  var connText = '';
  var connStyle = '';
  if (connectorOn) {
    if (connKind === 'symbol') {
      connText = SYMBOLS[inputs.symbol] || SYMBOLS.times;
      connStyle = 'font-size:' + Math.round(baseH * 0.52) + 'px';
    } else if (connKind === 'text') {
      connText = String(inputs.connectorText == null ? '' : inputs.connectorText);
      connStyle = 'font-size:' + clamp(Math.round(baseH * 0.17), 11, 40) + 'px';
    } else { // bar
      connStyle = 'height:' + Math.round((leadCell ? leadCell.h : baseH) * 0.9) + 'px';
    }
  }

  return {
    hasContent: !!(leadCell || partnerCells.length),
    themeClass: 'll-theme-' + theme,
    layoutClass: 'll-layout-' + layout,
    stageBg: _transparent ? 'transparent' : _bg,
    ink: ink,
    gap: gap,
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
