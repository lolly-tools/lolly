/**
 * Shared hook helpers - the filter-* brand overlay (logo + lower-third).
 *
 * CANONICAL SOURCE for the `overlay` region below. Tool hooks.js ship as
 * self-contained data (no imports), so each consumer carries a byte-for-byte
 * copy of this region between `lolly:shared` marker comments. Edit the region
 * HERE, then run `npm run sync:shared` to rewrite every consumer;
 * `npm run validate:catalog` fails if any consumer drifts from this file.
 *
 * The region depends on `host` (host.assets.get / host.profile.get) being in
 * scope - true inside any hooks.js - and declares its own module state
 * (_logoCache, _profileHeadshotUrl, _liveOvStart).
 *
 * The `overlayTheme` region reads the card's colours and timing from the design
 * system. A consumer includes it once, reads the theme before a render and hands
 * it to the effect as `_ovTheme`; the `overlay` region draws with what it is given
 * and falls back to a neutral card when it is given nothing.
 */

// === lolly:shared overlayTheme - canonical source; edit here and run npm run sync:shared ===
// The name card's colours and timing, read from the design system.
//   card    the darker of surface and text, so the card stays a dark plate over
//           footage in a light and in a dark appearance
//   ink     the name: the first of surface, text and on-primary to clear 4.5:1 on the card
//   accent  the underline and the headshot ring: primary where it clears 3:1 on
//           the card, then secondary, then the ink
//   title   the ink leaning toward the accent, kept only while it clears 4.5:1
// Durations and curves are the system's motion tokens. A value the system does not
// give keeps the neutral built-in.
var OVT_HEX = /^#[0-9a-f]{6}$/i;
function ovtHex(v, mix) {
  if (typeof v !== 'string') return '';
  var s = v.trim();
  if (/^#[0-9a-f]{3}$/i.test(s)) s = '#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
  if (/^#[0-9a-f]{8}$/i.test(s)) s = s.slice(0, 7);
  if (OVT_HEX.test(s)) return s.toLowerCase();
  // Any other notation (oklch, rgb) goes through the host's own colour reader.
  if (s && mix) { try { var m = mix(s, s, 0); if (typeof m === 'string' && OVT_HEX.test(m.trim())) return m.trim().toLowerCase(); } catch (e) { /* not a colour */ } }
  return '';
}
function ovtLum(h) {
  var c = [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)].map(function (x) {
    var s = x / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function ovtContrast(a, b) {
  var la = ovtLum(a), lb = ovtLum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
// The first candidate that clears `min` on `ground`, else whichever came closest.
function ovtReadable(candidates, ground, min) {
  var best = '', bestScore = -1;
  for (var i = 0; i < candidates.length; i++) {
    var c = candidates[i];
    if (!c) continue;
    var score = ovtContrast(c, ground);
    if (score >= min) return c;
    if (score > bestScore) { best = c; bestScore = score; }
  }
  return best;
}
function ovtMix(a, b, amount, mix) {
  if (mix) { try { var m = ovtHex(mix(a, b, amount)); if (m) return m; } catch (e) { /* plain mix below */ } }
  var out = '#';
  for (var i = 1; i < 7; i += 2) {
    var x = parseInt(a.slice(i, i + 2), 16), y = parseInt(b.slice(i, i + 2), 16);
    var v = Math.round(x + (y - x) * amount).toString(16);
    out += v.length < 2 ? '0' + v : v;
  }
  return out;
}
function ovtMs(v) {
  var n = null, unit = 'ms';
  if (typeof v === 'number') n = v;
  else if (typeof v === 'string') {
    var m = /^\s*(\d+(?:\.\d+)?|\.\d+)\s*(ms|s)\s*$/i.exec(v);
    if (m) { n = Number(m[1]); unit = m[2].toLowerCase(); }
  } else if (v && typeof v === 'object' && typeof v.value === 'number') {
    n = v.value; unit = v.unit === 's' ? 's' : 'ms';
  }
  if (n === null || !(n > 0)) return 0;
  return Math.min(4000, unit === 's' ? n * 1000 : n);
}
function ovtCurve(value) {
  var v = value;
  if (v && typeof v === 'object' && !Array.isArray(v) && Array.isArray(v.timingFunction)) v = v.timingFunction;
  if (!Array.isArray(v) || v.length !== 4) return null;
  for (var i = 0; i < 4; i++) if (typeof v[i] !== 'number' || !isFinite(v[i])) return null;
  if (v[0] < 0 || v[0] > 1 || v[2] < 0 || v[2] > 1) return null;
  return v.slice();
}
// Pure: token values in, theme out. `mix` is host.color.mix where the host has one.
function overlayTheme(tok, mix) {
  var t = {};
  var surface = ovtHex(tok.surface, mix), text = ovtHex(tok.text, mix);
  var primary = ovtHex(tok.primary, mix), onPrimary = ovtHex(tok.onPrimary, mix), secondary = ovtHex(tok.secondary, mix);
  if (surface && text) {
    var card = ovtLum(surface) <= ovtLum(text) ? surface : text;
    var ink = ovtReadable([surface, text, onPrimary], card, 4.5);
    var accent = ovtReadable([primary, secondary, ink], card, 3);
    var lean = ovtMix(ink, accent, 0.35, mix);
    t.card = card;
    t.ink = ink;
    t.accent = accent;
    t.title = ovtContrast(lean, card) >= 4.5 ? lean : ink;
    t.glassTitle = ovtMix(ink, accent, 0.12, mix);
    t.surface = surface;
  }
  if (primary) t.primary = primary;
  var long = ovtMs(tok.long), medium = ovtMs(tok.medium);
  if (long) t.inMs = long;
  if (medium) { t.logoMs = medium; t.outMs = medium; }
  var inCurve = ovtCurve(tok.emphasised), outCurve = ovtCurve(tok.exit);
  if (inCurve) t.inCurve = inCurve;
  if (outCurve) t.outCurve = outCurve;
  return t;
}
async function readOverlayTheme(h) {
  var tokens = h && h.tokens;
  if (!tokens || typeof tokens.resolve !== 'function') return {};
  var read = async function (ref) { try { return await tokens.resolve(ref); } catch (e) { return null; } };
  return overlayTheme({
    primary: await read('{color.semantic.primary}'),
    onPrimary: await read('{color.semantic.on-primary}'),
    secondary: await read('{color.semantic.secondary}'),
    surface: await read('{color.semantic.surface}'),
    text: await read('{color.semantic.text}'),
    medium: await read('{motion.duration.medium}'),
    long: await read('{motion.duration.long}'),
    emphasised: await read('{motion.curve.emphasised}'),
    exit: await read('{motion.curve.exit}'),
  }, h.color && typeof h.color.mix === 'function' ? h.color.mix : null);
}
// === /lolly:shared overlayTheme ===

// === lolly:shared overlay - canonical source; edit here and run npm run sync:shared ===
var OV_LOGO_ASPECT = 4;               // the logo's box until the asset gives its own size
var _logoCache = {};                  // variantId -> url | null (resolved once per variant)
var _logoAspect = {};                 // variantId -> width / height, read from the asset
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
// The card where no design system answers: a neutral dark plate, white ink.
var OV_THEME = {
  card: '#111111', ink: '#ffffff', accent: '#ffffff', title: '#d9d9d9', glassTitle: '#ececec',
  inMs: 560, logoMs: 460, outMs: 300, inCurve: [0.05, 0.7, 0.1, 1], outCurve: [0.3, 0, 0.8, 0.15],
};
// A clip leaves this much still time after the exit, so its last frame is clear.
var OV_TAIL_MS = 100;
function ovTheme(o) {
  var t = (o && o.theme) || {}, out = {};
  for (var k in OV_THEME) out[k] = t[k] != null ? t[k] : OV_THEME[k];
  return out;
}
// y of a CSS cubic-bezier(x1, y1, x2, y2) at x = p, by bisection on the curve's x.
function ovBezier(c, p) {
  p = ovClamp(p, 0, 1);
  if (p === 0 || p === 1) return p;
  var lo = 0, hi = 1, u = p;
  for (var i = 0; i < 24; i++) {
    u = (lo + hi) / 2;
    var x = 3 * (1 - u) * (1 - u) * u * c[0] + 3 * (1 - u) * u * u * c[2] + u * u * u;
    if (x < p) lo = u; else hi = u;
  }
  return 3 * (1 - u) * (1 - u) * u * c[1] + 3 * (1 - u) * u * u * c[3] + u * u * u;
}
// How far in the card is at `elapsed` ms: 0 away, 1 at rest. It enters over `inMs`.
// When the clip's length is known (`total`), it leaves over `outMs` before the end.
function ovProgress(th, elapsed, inMs, total) {
  var p = ovBezier(th.inCurve, elapsed / Math.max(1, inMs));
  if (total > 0 && isFinite(total)) {
    var outStart = total - OV_TAIL_MS - th.outMs;
    if (elapsed > outStart) p *= 1 - ovBezier(th.outCurve, (elapsed - outStart) / Math.max(1, th.outMs));
  }
  return ovClamp(p, 0, 1);
}

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
    nameWeight: inp.nameWeight,
    subtitleWeight: inp.subtitleWeight,
    // The design system's text face, as a font-family list; the consumer reads it
    // from the tokens and passes it in as _fontBrand.
    font: inp._fontBrand,
    // The card's colours and timing from the design system, read by the consumer
    // (the overlayTheme region) and passed in as _ovTheme.
    theme: inp._ovTheme || null,
  };
}
function overlayActive(o) { return !!(o.showLogo || o.lowerThird); }

// The brand-logo VARIANT for a style (used as the cache key + resolution key). Horizontal
// lockup only (reads best over a strip/corner). white → mono-reverse (on-dark mono), green →
// primary-reverse (on-dark colour), black → mono (on-light). Resolved from the CURRENT
// brand's asset.logo.<variant> tokens, so this brand-neutral tool inherits whatever brand is
// loaded rather than one brand's own mark.
function logoVariantId(style) {
  return style === 'green' ? 'horizontal-primary-reverse'
    : style === 'black' ? 'horizontal-mono'
      : 'horizontal-mono-reverse';
}
// Resolve the chosen logo variant to a URL, cached per-variant. Safe to await in
// compute/onInit; call WITHOUT await from onFrame - it just warms the cache. Null when the
// brand declares no such logo (no fallback mark - this is a brand-neutral community tool).
// The logo's shape comes from the asset: its recorded size, else the decoded picture's.
function resolveLogoUrl(style) {
  var variant = logoVariantId(style);
  if (_logoCache[variant] !== undefined) return Promise.resolve(_logoCache[variant]);
  var idP = (host.tokens && host.tokens.resolve) ? host.tokens.resolve('{asset.logo.' + variant + '}') : Promise.resolve(null);
  return Promise.resolve(idP).then(function (id) {
    if (typeof id !== 'string' || !id || id.indexOf('{') === 0) return (_logoCache[variant] = null);
    return host.assets.get(id).then(function (r) {
      var url = (r && r.url) || null;
      if (r && r.width > 0 && r.height > 0) _logoAspect[variant] = r.width / r.height;
      if (!url || _logoAspect[variant] || typeof Image === 'undefined') return (_logoCache[variant] = url);
      return new Promise(function (resolve) {
        var im = new Image();
        var done = function () {
          if (im.naturalWidth > 0 && im.naturalHeight > 0) _logoAspect[variant] = im.naturalWidth / im.naturalHeight;
          resolve((_logoCache[variant] = url));
        };
        im.onload = done; im.onerror = done;
        im.src = url;
      });
    });
  }).catch(function () { return (_logoCache[variant] = null); });
}
function cachedLogoUrl(style) { return _logoCache[logoVariantId(style)] || ''; }
function cachedLogoAspect(style) { return _logoAspect[logoVariantId(style)] || OV_LOGO_ASPECT; }

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
// o = normalised overlay inputs + { logoUrl, headshotUrl, mode:'still'|'live', elapsed, total }.
// `total` is the clip's length in ms where one is known (a motion export): the card
// then leaves before the end. A live camera has no end, so the card stays.
function buildOverlaySvg(OW, OH, o) {
  if (!overlayActive(o)) return '';
  var live = o.mode === 'live';
  var elapsed = live ? ovNum(o.elapsed, 1e9) : 1e9;
  var total = live ? ovNum(o.total, 0) : 0;
  var th = ovTheme(o);
  var out = '';

  // ── logo ───────────────────────────────────────────────────────────────────
  if (o.showLogo && o.logoUrl) {
    var pos = o.logoPosition || 'top-right';
    var m = OW * 0.045;
    var scale = ovClamp(ovNum(o.logoScale, 1), 0.25, 3);
    var w = pos === 'full' ? ovClamp(OW * 0.72 * scale, 40, OW)
      : ovClamp(OW * 0.2 * scale, 24, OW - m * 2);
    var h = w / cachedLogoAspect(o.logoStyle);
    var x = (pos === 'top-left' || pos === 'bottom-left') ? m
      : (pos === 'top-right' || pos === 'bottom-right') ? OW - m - w
        : (OW - w) / 2;
    var y = (pos === 'top-left' || pos === 'top-right' || pos === 'top') ? m
      : (pos === 'bottom-left' || pos === 'bottom-right' || pos === 'bottom') ? OH - m - h
        : (OH - h) / 2;
    var lop = live ? ovProgress(th, elapsed, th.logoMs, 0) : 1;
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

    var p = live ? ovProgress(th, elapsed, th.inMs, total) : 1;
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

    var accent = th.accent;
    var r = Math.min(cardH * 0.2, 22);
    var g = '<g transform="translate(' + ovF2(cx) + ' ' + ovF2(cy + dy) + ')"'
      + (p < 1 ? ' opacity="' + ovF2(p) + '"' : '') + '>';

    if (theme === 'bar') {
      g += ovRRect(0, 0, cardW, cardH, r, th.card, 0.97);
    } else if (theme === 'glass') {
      g += ovRRect(0, 0, cardW, cardH, r, th.card, 0.34);
      g += '<rect x="0.75" y="0.75" width="' + ovF2(cardW - 1.5) + '" height="' + ovF2(cardH - 1.5)
        + '" rx="' + ovF2(r) + '" ry="' + ovF2(r) + '" fill="none" stroke="' + th.ink + '" stroke-opacity="0.3" stroke-width="1.4"/>';
    } // 'minimal' → no plate; text carries a soft outline for legibility

    var textX = padX + (hasShot ? chip + gap : 0);
    var blockTop = (cardH - lineH) / 2;
    var nameY = blockTop + nameSize * 0.82;
    var titleY = nameY + titleSize * 1.4;
    var titleColor = theme === 'bar' ? th.title : th.glassTitle;
    var shadow = theme === 'minimal'
      ? ' style="paint-order:stroke;stroke:' + th.card + ';stroke-opacity:0.55;stroke-width:' + ovF2(nameSize * 0.14) + 'px;stroke-linejoin:round"'
      : '';
    var titleShadow = theme === 'minimal'
      ? ' style="paint-order:stroke;stroke:' + th.card + ';stroke-opacity:0.55;stroke-width:' + ovF2(titleSize * 0.16) + 'px;stroke-linejoin:round"'
      : '';
    var FONT = o.font || 'SUSE, sans-serif';

    if (hasShot) {
      var cxs = padX + chip / 2, cys = cardH / 2, rad = chip / 2;
      g += '<clipPath id="lollyShot"><circle cx="' + ovF2(cxs) + '" cy="' + ovF2(cys) + '" r="' + ovF2(rad) + '"/></clipPath>';
      g += '<image href="' + ovEsc(o.headshotUrl) + '" x="' + ovF2(padX) + '" y="' + ovF2(cys - rad)
        + '" width="' + ovF2(chip) + '" height="' + ovF2(chip) + '" preserveAspectRatio="xMidYMid slice" clip-path="url(#lollyShot)"/>';
      g += '<circle cx="' + ovF2(cxs) + '" cy="' + ovF2(cys) + '" r="' + ovF2(rad) + '" fill="none" stroke="' + accent + '" stroke-width="' + ovF2(rad * 0.09) + '"/>';
    }

    g += '<text x="' + ovF2(textX) + '" y="' + ovF2(nameY) + '" font-family="' + FONT + '" font-size="' + ovF2(nameSize)
      + '" font-weight="' + ovClamp(Math.round(ovNum(o.nameWeight, 700)), 100, 900) + '" fill="' + th.ink + '"' + shadow + '>' + ovEsc(name) + '</text>';
    if (title) {
      g += '<text x="' + ovF2(textX) + '" y="' + ovF2(titleY) + '" font-family="' + FONT + '" font-size="' + ovF2(titleSize)
        + '" font-weight="' + ovClamp(Math.round(ovNum(o.subtitleWeight, 500)), 100, 900) + '" fill="' + titleColor + '"' + titleShadow + '>' + ovEsc(title) + '</text>';
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

// ── Export frame clock (motion formats only) ─────────────────────────────────
// A still export always renders the overlay at rest (mode:'still' → fully faded
// in, no offset) - correct for png/svg/pdf/etc. But a gif/webm/mp4 export of a
// STILL photo previously held that same resting pose for the whole clip: the
// intro ease-in buildOverlaySvg already does for 'live' (camera) mode never
// played, because nothing called it with mode:'live' + an advancing elapsed.
// armOverlayClock wires that up: register __lollyFrameRender on the tool's
// inert clock-anchor canvas (see docs on <canvas data-ov-clock> in template.html
// - the same anchor-element convention as the slides tool, required because the
// capture loop only drives a t through a <canvas> carrying that property), and
// on each captured frame rebuild JUST the overlay markup (via the untouched
// buildOverlaySvg) at that frame's elapsed ms, splicing it into a stable slot
// (`<g id="lolly-ov-slot">`, wrapped once around every buildOverlaySvg() call
// site in the tool's buildSvg()). The expensive filtered-image content is never
// touched - only the overlay's own small SVG fragment is rebuilt per frame.
// getOv(t) returns a full overlay-input object (mode:'live', elapsed: t*clipMs) -
// callers build it from their own cached _lastOv (see armFilterOverlayExport).
// W/H are the SAME viewBox-units box the tool's own buildOverlaySvg(W, H, …) call
// used for the still render - a fixed VIEW constant for the square-canvas tools,
// or the tool's own current width/height for the ones with dynamic W/H inputs.
// The anchor is an inert 0x0 canvas. A template may carry one; where none does,
// one is added to the export node for the length of the export and removed after.
// getOv(t, clipSec) receives the clip's real length in seconds when the shell gives one.
var _ovClockMounted = null;
function armOverlayClock(root, W, H, getOv) {
  var canvas = root && root.querySelector && root.querySelector('[data-ov-clock]');
  var slot = root && root.querySelector && root.querySelector('#lolly-ov-slot');
  if (!slot) return null;
  if (!canvas) {
    if (!root.ownerDocument || !root.appendChild) return null;
    canvas = root.ownerDocument.createElement('canvas');
    canvas.setAttribute('data-ov-clock', ''); canvas.setAttribute('aria-hidden', 'true');
    canvas.width = 0; canvas.height = 0;
    root.appendChild(canvas);
    _ovClockMounted = canvas;
  }
  canvas.__lollyFrameRender = function (t, clipSec) {
    try {
      var ov = getOv(t, clipSec);
      slot.innerHTML = ov ? buildOverlaySvg(W, H, ov) : '';
    } catch (e) { /* leave the last good frame in place */ }
  };
  return canvas;
}
function disarmOverlayClock(canvas) {
  if (!canvas) return;
  try { delete canvas.__lollyFrameRender; } catch (e) { canvas.__lollyFrameRender = undefined; }
  if (canvas === _ovClockMounted) {
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    _ovClockMounted = null;
  }
}
// Formats the clock should arm for - every other export (png/svg/pdf/jpg/webp/…)
// captures the still, at-rest overlay exactly as before.
var OV_MOTION_FORMATS = { gif: 1, apng: 1, webm: 1, mp4: 1 };
// Serialise the overlay's export state (its box + the FULLY-RESOLVED overlay
// params, logo/headshot URLs included) for the render patch. The template stamps
// it onto the clock anchor as data-ov-params; armFilterOverlayExport reads it back
// from the DOM. This is the isolation-safe channel (plans/86 section 18): the render hook
// - which alone holds the resolved URLs - writes the state into its patch, which
// reaches the DOM whether the hook ran in this realm or in a Worker, so the
// in-realm export hook never depends on a module var a Worker-side hook wrote.
// Empty string when the overlay is inactive, so the attribute costs nothing then.
function overlayExportParams(W, H, ov) {
  return (ov && overlayActive(ov)) ? JSON.stringify({ W: W, H: H, ov: ov }) : '';
}
// Shared beforeExport/afterExport glue: arms the clock for a motion export.
// Two call forms:
//   armFilterOverlayExport(ctx)                 - isolation-safe: recover W/H/ov
//     from the clock anchor's data-ov-params (written via overlayExportParams).
//   armFilterOverlayExport(ctx, W, H, lastOv)   - legacy: params from the tool's
//     own module state (only correct when the render hook ran in THIS realm).
// The DOM path is preferred; the legacy path stays until every filter migrates.
var _ovClock = null;
function armFilterOverlayExport(ctx, W, H, lastOv) {
  if (W == null && lastOv == null) {
    var el = ctx.node && ctx.node.querySelector && ctx.node.querySelector('[data-ov-clock]');
    var raw = el && el.getAttribute && el.getAttribute('data-ov-params');
    if (!raw) return;
    var parsed; try { parsed = JSON.parse(raw); } catch (e) { return; }
    W = parsed.W; H = parsed.H; lastOv = parsed.ov;
  }
  if (!lastOv || !overlayActive(lastOv) || !OV_MOTION_FORMATS[ctx.format]) return;
  var planned = (ctx.opts && ctx.opts.duration) || 5;
  _ovClock = armOverlayClock(ctx.node, W, H, function (t, clipSec) {
    var clipMs = (clipSec > 0 ? clipSec : planned) * 1000;
    return Object.assign({}, lastOv, { mode: 'live', elapsed: t * clipMs, total: clipMs });
  });
}
function disarmFilterOverlayExport() {
  disarmOverlayClock(_ovClock);
  _ovClock = null;
}
// === /lolly:shared overlay ===
