/* global onInit, onInput, onFrame, host */

// A raster library asset shown when the user hasn't picked an image yet, so the
// tool demonstrates the effect on load. Same default as filter-scanline /
// filter-halftone, kept in sync deliberately.
// A Lolly tool URL (bag-video → PNG), resolved via host.compose. A plain catalog
// id still works (the resolver below branches on whether this is a URL).
var DEFAULT_IMAGE_ID = 'https://lolly.tools/tool/bag-video.png';

// Resolved URL of the demo default asset, cached so repeated input changes don't
// re-fetch it. Stays null until the first lookup succeeds.
var _defaultUrl = null;

function hexToChannels(hex) {
  const c = (hex || '#000000').replace('#', '');
  return {
    r: parseInt(c.slice(0, 2), 16) / 255,
    g: parseInt(c.slice(2, 4), 16) / 255,
    b: parseInt(c.slice(4, 6), 16) / 255,
  };
}

function ch(n) {
  return parseFloat(n.toFixed(4));
}

function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

function buildDuo(inputs) {
  const fg = hexToChannels(inputs.colorFg);
  const bg = hexToChannels(inputs.colorBg);

  // Colour grade — applied as SVG filter primitives upstream of the duotone table
  // (hueRotate → saturate → lightness), then a colour-treatment overlay after it.
  // Defaults are a strict no-op: hue 0, saturation 100, lightness 0, no treatment.
  var hueDeg = clamp(parseFloat(inputs.hue) || 0, -180, 180);
  var sat = clamp(parseFloat(inputs.saturation == null ? 100 : inputs.saturation) || 0, 0, 200) / 100;
  var lightV = clamp(parseFloat(inputs.lightness) || 0, -100, 100) / 100;
  var liteSlope = lightV >= 0 ? (1 - lightV) : (1 + lightV);
  var liteIntercept = lightV >= 0 ? lightV : 0;
  // treatment: feFlood + feBlend after the duotone table, opacity = intensity.
  // Off (empty / invalid colour) ⇒ amt 0, so the overlay contributes nothing.
  var tc = (typeof inputs.treatmentColor === 'string' ? inputs.treatmentColor.trim() : '');
  var tOn = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(tc);
  var treatAmt = tOn ? clamp(parseFloat(inputs.treatmentIntensity == null ? 20 : inputs.treatmentIntensity) || 0, 0, 100) / 100 : 0;
  var treatColor = tOn ? tc : '#000000';
  var blendMode = (typeof inputs.blendMode === 'string' && inputs.blendMode) ? inputs.blendMode : 'multiply';

  return {
    tableR: `${ch(fg.r)} ${ch(bg.r)}`,
    tableG: `${ch(fg.g)} ${ch(bg.g)}`,
    tableB: `${ch(fg.b)} ${ch(bg.b)}`,
    hueDeg: String(hueDeg),
    satFrac: String(sat),
    liteSlope: String(liteSlope),
    liteIntercept: String(liteIntercept),
    treatColor: treatColor,
    // Returned as `treatBlend` (NOT `blendMode`) on purpose: a patch key equal to a
    // declared input id is treated by the runtime as a write-back to that input
    // (mergePatch), which is redundant and opens a stale-overwrite window. Keep it
    // an extra so the template reads a computed value, never the input echoed back.
    treatBlend: blendMode,
    treatAmt: String(treatAmt),
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Brand overlay — optional SUSE logo + gently-animated "lower third" name card.
//
// Kept BYTE-IDENTICAL across every filter-* tool (paste target). Emits SVG children
// so the overlay survives ALL export paths — raster (png/webp/jpg), motion
// (gif/webm/mp4) AND vector (svg/pdf). Everything is OFF by default → overlayActive()
// is false → buildOverlaySvg() returns '' (zero markup / zero cost).
//
// Animation is ATTRIBUTE-BAKED (computed transform/opacity per render), never CSS
// @keyframes or SMIL: the tool's whole SVG is replaced on every paint / every live
// camera frame, which would reset a CSS/SMIL animation to t=0 each frame. Baking the
// pose means it looks identical in the live preview, in each captured video frame,
// and in a static vector snapshot. In live mode the gentle intro is driven by the
// camera clock (elapsed since the overlay first appeared).
//
// Module state used: _logoCache, _profileHeadshotUrl, _liveOvStart. Depends on `host`
// (host.assets.get / host.profile.get) being in scope.
// ══════════════════════════════════════════════════════════════════════════════
var LOGO_ASPECT = 210.179 / 37.666;   // SUSE horizontal lockup, from its own viewBox
var _logoCache = {};                  // variantId -> url | null (resolved once per variant)
var _profileHeadshotUrl;              // undefined = not looked up; null = none; string = url
var _liveOvStart = null;              // frame.t when the overlay first became active while live

function ovEsc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;';
  });
}
function ovNum(v, d) { var x = Number(v); return isFinite(x) ? x : d; }
function ovClamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function ovF2(v) { return Math.round(v * 100) / 100; }
function ovEaseOut(p) { p = ovClamp(p, 0, 1); return 1 - Math.pow(1 - p, 3); }

// Normalise the overlay-related inputs into one flat object (reused by still + live).
function overlayInputs(inp) {
  return {
    noFilter: !!inp.noFilter,
    showLogo: !!inp.showLogo,
    logoPosition: inp.logoPosition || 'top-right',
    logoStyle: inp.logoStyle || 'white',
    logoScale: inp.logoScale,
    lowerThird: !!inp.lowerThird,
    ltTheme: inp.ltTheme || 'bar',
    ltPosition: inp.ltPosition || 'left',
    firstname: inp.firstname,
    lastname: inp.lastname,
    title: inp.title,
  };
}
function overlayActive(o) { return !!(o.showLogo || o.lowerThird); }

// One of the 8 shipped SUSE logo ids. white → on-dark mono, green → on-dark colour,
// black → on-light mono. Horizontal lockup only (reads best over a strip/corner).
function logoVariantId(style) {
  return style === 'green' ? 'suse/logo/hor-neg-green'
    : style === 'black' ? 'suse/logo/hor-pos-black'
      : 'suse/logo/hor-neg-white';
}
// Resolve the chosen logo variant to a URL, cached per-variant. Safe to await in
// compute/onInit; call WITHOUT await from onFrame — it just warms the cache.
function resolveLogoUrl(style) {
  var id = logoVariantId(style);
  if (_logoCache[id] !== undefined) return Promise.resolve(_logoCache[id]);
  return host.assets.get(id)
    .then(function (r) { return (_logoCache[id] = (r && r.url) || null); })
    .catch(function () { return (_logoCache[id] = null); });
}
function cachedLogoUrl(style) { return _logoCache[logoVariantId(style)] || ''; }

// Resolve the user's PROFILE headshot to a URL once (async). Used as the auto default
// for the lower-third chip when the headshot input is empty. null = none / unavailable.
function resolveProfileHeadshot() {
  if (_profileHeadshotUrl !== undefined) return Promise.resolve(_profileHeadshotUrl);
  _profileHeadshotUrl = null;
  if (!host.profile || !host.profile.get) return Promise.resolve(null);
  return host.profile.get().then(function (p) {
    if (p && p.headshot && p.headshot.id) {
      return host.assets.get(p.headshot.id).then(function (r) { _profileHeadshotUrl = (r && r.url) || null; });
    }
  }).catch(function () { }).then(function () { return _profileHeadshotUrl; });
}

// Build the overlay SVG children. OW/OH = the output coordinate box (viewBox units).
// o = normalised overlay inputs + { logoUrl, headshotUrl, mode:'still'|'live', elapsed }.
function buildOverlaySvg(OW, OH, o) {
  if (!overlayActive(o)) return '';
  var live = o.mode === 'live';
  var elapsed = live ? ovNum(o.elapsed, 1e9) : 1e9;
  var out = '';

  // ── SUSE logo ──────────────────────────────────────────────────────────────
  if (o.showLogo && o.logoUrl) {
    var pos = o.logoPosition || 'top-right';
    var m = OW * 0.045;
    var scale = ovClamp(ovNum(o.logoScale, 1), 0.25, 3);
    var w = pos === 'full' ? ovClamp(OW * 0.72 * scale, 40, OW)
      : ovClamp(OW * 0.2 * scale, 24, OW - m * 2);
    var h = w / LOGO_ASPECT;
    var x = (pos === 'top-left' || pos === 'bottom-left') ? m
      : (pos === 'top-right' || pos === 'bottom-right') ? OW - m - w
        : (OW - w) / 2;
    var y = (pos === 'top-left' || pos === 'top-right' || pos === 'top') ? m
      : (pos === 'bottom-left' || pos === 'bottom-right' || pos === 'bottom') ? OH - m - h
        : (OH - h) / 2;
    var lop = live ? ovEaseOut(elapsed / 460) : 1;
    out += '<image href="' + ovEsc(o.logoUrl) + '" x="' + ovF2(x) + '" y="' + ovF2(y)
      + '" width="' + ovF2(w) + '" height="' + ovF2(h) + '" preserveAspectRatio="xMidYMid meet"'
      + (lop < 1 ? ' opacity="' + ovF2(lop) + '"' : '') + '/>';
  }

  // ── lower-third name card ────────────────────────────────────────────────────
  if (o.lowerThird) {
    var name = [String(o.firstname || '').trim(), String(o.lastname || '').trim()].filter(Boolean).join(' ') || 'Your name';
    var title = String(o.title || '').trim();
    var theme = o.ltTheme || 'bar';
    var lp = o.ltPosition || 'left';
    var hasShot = !!o.headshotUrl;

    var p = live ? ovEaseOut(elapsed / 560) : 1;
    var mg = OW * 0.045;
    var padX = OH * 0.032, padY = OH * 0.028;
    var nameSize = OH * 0.045, titleSize = OH * 0.028;
    var lineH = nameSize + (title ? titleSize * 1.5 : 0);
    var cardH = lineH + padY * 2;
    var chip = hasShot ? cardH - padY * 0.9 : 0;
    var gap = hasShot ? padX * 0.7 : 0;
    var nameW = name.length * nameSize * 0.6;
    var titleW = title.length * titleSize * 0.58;
    var textW = Math.max(nameW, titleW, OW * 0.14);
    var cardW = ovClamp(padX + (hasShot ? chip + gap : 0) + textW + padX, OW * 0.22, OW - mg * 2);

    var cx = lp === 'center' ? (OW - cardW) / 2 : lp === 'right' ? OW - mg - cardW : mg;
    var cy = OH - mg - cardH;
    var dy = (1 - p) * (OH * 0.035);

    var accent = '#30ba78';
    var r = Math.min(cardH * 0.2, 22);
    var g = '<g transform="translate(' + ovF2(cx) + ' ' + ovF2(cy + dy) + ')"'
      + (p < 1 ? ' opacity="' + ovF2(p) + '"' : '') + '>';

    if (theme === 'bar') {
      g += ovRRect(0, 0, cardW, cardH, r, '#0c322c', 0.97);
    } else if (theme === 'glass') {
      g += ovRRect(0, 0, cardW, cardH, r, '#0b1512', 0.34);
      g += '<rect x="0.75" y="0.75" width="' + ovF2(cardW - 1.5) + '" height="' + ovF2(cardH - 1.5)
        + '" rx="' + ovF2(r) + '" ry="' + ovF2(r) + '" fill="none" stroke="#ffffff" stroke-opacity="0.3" stroke-width="1.4"/>';
    } // 'minimal' → no plate; text carries a soft outline for legibility

    var textX = padX + (hasShot ? chip + gap : 0);
    var blockTop = (cardH - lineH) / 2;
    var nameY = blockTop + nameSize * 0.82;
    var titleY = nameY + titleSize * 1.4;
    var titleColor = theme === 'bar' ? '#a9e3c8' : '#e6f0ec';
    var shadow = theme === 'minimal'
      ? ' style="paint-order:stroke;stroke:#0b1512;stroke-opacity:0.55;stroke-width:' + ovF2(nameSize * 0.14) + 'px;stroke-linejoin:round"'
      : '';
    var titleShadow = theme === 'minimal'
      ? ' style="paint-order:stroke;stroke:#0b1512;stroke-opacity:0.55;stroke-width:' + ovF2(titleSize * 0.16) + 'px;stroke-linejoin:round"'
      : '';
    var FONT = 'SUSE, system-ui, -apple-system, sans-serif';

    if (hasShot) {
      var cxs = padX + chip / 2, cys = cardH / 2, rad = chip / 2;
      g += '<clipPath id="lollyShot"><circle cx="' + ovF2(cxs) + '" cy="' + ovF2(cys) + '" r="' + ovF2(rad) + '"/></clipPath>';
      g += '<image href="' + ovEsc(o.headshotUrl) + '" x="' + ovF2(padX) + '" y="' + ovF2(cys - rad)
        + '" width="' + ovF2(chip) + '" height="' + ovF2(chip) + '" preserveAspectRatio="xMidYMid slice" clip-path="url(#lollyShot)"/>';
      g += '<circle cx="' + ovF2(cxs) + '" cy="' + ovF2(cys) + '" r="' + ovF2(rad) + '" fill="none" stroke="' + accent + '" stroke-width="' + ovF2(rad * 0.09) + '"/>';
    }

    g += '<text x="' + ovF2(textX) + '" y="' + ovF2(nameY) + '" font-family="' + FONT + '" font-size="' + ovF2(nameSize)
      + '" font-weight="700" fill="#ffffff"' + shadow + '>' + ovEsc(name) + '</text>';
    if (title) {
      g += '<text x="' + ovF2(textX) + '" y="' + ovF2(titleY) + '" font-family="' + FONT + '" font-size="' + ovF2(titleSize)
        + '" font-weight="500" fill="' + titleColor + '"' + titleShadow + '>' + ovEsc(title) + '</text>';
    }
    var ulY = (title ? titleY : nameY) + (title ? titleSize * 0.55 : nameSize * 0.4);
    var ulW = Math.min(nameW, cardW - textX - padX) * (live ? p : 1);
    g += '<rect x="' + ovF2(textX) + '" y="' + ovF2(ulY) + '" width="' + ovF2(Math.max(0, ulW)) + '" height="' + ovF2(Math.max(2, nameSize * 0.08)) + '" rx="' + ovF2(nameSize * 0.04) + '" fill="' + accent + '"/>';

    g += '</g>';
    out += g;
  }

  return out;
}
// A rounded rect (rx clamped) shared by the overlay themes.
function ovRRect(x, y, w, h, r, fill, op) {
  r = Math.min(r, w / 2, h / 2);
  return '<rect x="' + ovF2(x) + '" y="' + ovF2(y) + '" width="' + ovF2(w) + '" height="' + ovF2(h)
    + '" rx="' + ovF2(r) + '" ry="' + ovF2(r) + '" fill="' + fill + '"'
    + (op != null && op < 1 ? ' fill-opacity="' + ovF2(op) + '"' : '') + '/>';
}

// Overlay geometry uses the export canvas size (width/height inputs, default 1080).
function overlayDims(inputs) {
  var W = Number(inputs.width) > 0 ? Number(inputs.width) : 1080;
  var H = Number(inputs.height) > 0 ? Number(inputs.height) : 1080;
  return { W: W, H: H };
}

async function patch({ model }) {
  const inputs = Object.fromEntries(model.map(i => [i.id, i.value]));
  const out = buildDuo(inputs);

  // No image picked → fall back to the shared demo image (resolved once), exposed
  // to the template as an extra. The template uses {{asset bgImage}} for the
  // user's own pick and {{defaultImageUrl}} for this fallback.
  if (!inputs.bgImage) {
    if (!_defaultUrl) {
      try {
        // Tool URL → render via compose; plain catalog id → host.assets.
        const def = (DEFAULT_IMAGE_ID.indexOf('://') !== -1)
          ? (host.compose && host.compose.renderUrl ? await host.compose.renderUrl(DEFAULT_IMAGE_ID) : null)
          : await host.assets.get(DEFAULT_IMAGE_ID);
        _defaultUrl = def && def.url;
      }
      catch (e) { if (host.log) host.log('warn', 'filter-duotone: default image unavailable', { error: String(e) }); }
    }
    if (_defaultUrl) out.defaultImageUrl = _defaultUrl;
  }

  // Brand overlay (still) — resolve logo + headshot URLs (cached) before building so
  // the render already carries them. Off by default → buildOverlaySvg returns ''.
  const ovi = overlayInputs(inputs);
  if (ovi.showLogo) await resolveLogoUrl(ovi.logoStyle);
  let headUrl = (inputs.ltHeadshot && inputs.ltHeadshot.url) || '';
  if (ovi.lowerThird && !headUrl) headUrl = (await resolveProfileHeadshot()) || '';
  const ov = Object.assign({}, ovi, { logoUrl: cachedLogoUrl(ovi.logoStyle), headshotUrl: headUrl, mode: 'still' });
  const d = overlayDims(inputs);
  out.overlaySvg = buildOverlaySvg(d.W, d.H, ov);
  out.noFilter = ovi.noFilter;

  return out;
}

function onInit(ctx) {
  return patch(ctx);
}

function onInput(ctx) {
  return patch(ctx);
}

// Live camera (engine v1.4): the runtime calls this once per frame with raw RGBA
// pixels. Unlike the pixel-tracing filters, duotone is a browser SVG filter on an
// <image>, so we just hand the frame back as the image source (a data URL) plus the
// current colour tables — the browser applies the #duo filter to it (GPU-fast). The
// template renders it as #duo-live (see template.html), so the framing script skips
// re-probing a fresh data URL every frame. null = no patch (last frame stays).
function onFrame({ frame, model }) {
  if (!frame || !frame.data || !frame.width || !frame.height) return null;
  if (typeof document === 'undefined' || typeof ImageData === 'undefined') return null;
  const inputs = Object.fromEntries(model.map(i => [i.id, i.value]));
  let liveSrc;
  try {
    const c = document.createElement('canvas');
    c.width = frame.width; c.height = frame.height;
    c.getContext('2d').putImageData(new ImageData(frame.data, frame.width, frame.height), 0, 0);
    // JPEG: cheap to encode and the duotone filter discards colour fidelity anyway.
    liveSrc = c.toDataURL('image/jpeg', 0.85);
  } catch (e) { return null; }

  // Brand overlay (live): warm caches without awaiting; drive the intro from camera time.
  const ovi = overlayInputs(inputs);
  if (overlayActive(ovi)) { if (_liveOvStart == null) _liveOvStart = frame.t; }
  else _liveOvStart = null;
  if (ovi.showLogo && _logoCache[logoVariantId(ovi.logoStyle)] === undefined) resolveLogoUrl(ovi.logoStyle);
  if (ovi.lowerThird && _profileHeadshotUrl === undefined) resolveProfileHeadshot();
  const headUrl = (inputs.ltHeadshot && inputs.ltHeadshot.url) || _profileHeadshotUrl || '';
  const ov = Object.assign({}, ovi, {
    logoUrl: cachedLogoUrl(ovi.logoStyle), headshotUrl: headUrl,
    mode: 'live', elapsed: frame.t - (_liveOvStart == null ? frame.t : _liveOvStart),
  });
  const d = overlayDims(inputs);

  // The live frame IS the source <image> (id duo-live); the #duo filter is removed by
  // the template's {{#unless noFilter}} when No-filter is on, so noFilter needs no
  // separate rawSrc here — just carry the boolean + the overlay children.
  const out = Object.assign(buildDuo(inputs), { liveSrc });
  out.overlaySvg = buildOverlaySvg(d.W, d.H, ov);
  out.noFilter = ovi.noFilter;
  return out;
}
