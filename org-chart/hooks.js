/* global onInit, onInput, host */

/**
 * Org Chart - cards on an open canvas, joined by connector lines that route between
 * them and stick to the boxes.
 *
 * ONE flat input drives the render:
 *   • `boxes` - one row per card (geometry + a `layout` that arranges its photo/icon +
 *               text: row = headshot left, icon = icon chip left, stacked = photo on top,
 *               plain = a bare box like Design) AND one row per connector, which
 *               is a `kind:'path'` box with an end attached to a card (plan 96).
 *
 * A connector used to be a row of a SECOND `connectors` input, {from,to,style,arrow,dash,
 * color,width}. It is now the same primitive as a hand-drawn line: an authored path whose
 * `bindStart`/`bindEnd` name the cards its two ends are attached to. Old documents (and old
 * share links) still carry the edge rows, so migrateEdges() converts them the moment this
 * tool loads and writes the emptied input back - a one-time, render-identical conversion
 * guarded by tests/org-chart-migration.test.ts.
 *
 * The direct-manipulation overlay (drag / resize / bind / snap-to-grid / auto-layout)
 * lives in the web shell (shells/web/src/views/free-canvas.ts) and only ever writes that
 * flat array back through the normal input path - so the engine, the URL and the CLI
 * never see the editor, and a headless render of the same state is identical.
 *
 * This hook is PURE (no DOM, no async). Handlebars is logic-less, so we precompute:
 *   - per-box inline CSS (boxStyle/textStyle) + media/avatar HTML (mediaHtml),
 *   - each FREE path box's own inline <svg> (pathHtml), and
 *   - ONE artboard-sized inline <svg> of every BOUND path (connectorSvg),
 * and expose them as `extras` the template applies. Running here (not in the template)
 * means the CLI produces the same output as the browser.
 *
 * None of that geometry is this file's any more: the routing, the arrowheads and the dash
 * segments are the ENGINE's, reached through host.connectors (v1.106/v1.111), which is what
 * makes the editor preview, the export and a headless CLI render byte-identical lines. The
 * engine's contract is export-safe without exception - shafts are <path>, heads are filled
 * <path> or plain <line>, dashes are real <line> segments, never a <marker>, a <polygon> or
 * a stroke-dasharray - because the PDF/EMF vector walkers drop all three.
 */

// Artboard coordinate space - MUST match render.width/height in tool.json. The
// connector <svg> uses this as its viewBox so path coords equal card x/y/w/h 1:1.
var CW = 1600, CH = 1000;

function inputsFrom(model) {
  var o = {};
  (model || []).forEach(function (i) { o[i.id] = i.value; });
  return o;
}
function num(v, d) { var x = typeof v === 'number' ? v : parseFloat(v); return isFinite(x) ? x : d; }
// === lolly:shared clamp - generated from community/_shared/math.js; edit there and run npm run sync:shared ===
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
// === /lolly:shared clamp ===
function f2(v) { return Math.round(v * 100) / 100; }

// === lolly:shared safeColor - generated from community/_shared/math.js; edit there and run npm run sync:shared ===
function safeColor(v, fallback) {
  var s = String(v == null ? '' : v).trim();
  if (!s) return fallback;
  if (/^#[0-9a-fA-F]{3,8}$/.test(s)) return s;
  if (/^(rgb|rgba|hsl|hsla)\([0-9.,%\s/]+\)$/i.test(s)) return s;
  if (/^[a-zA-Z]+$/.test(s)) return s; // named colour (e.g. "transparent", "tomato")
  // A brand-token CSS var with an OPTIONAL literal-colour fallback - the documented
  // brand-inheritance path (brand-vars.ts injects --brand-primary/… onto the canvas root,
  // so a template can carry var(--brand-primary, #hex)). Strict on purpose: a var name and
  // at most one hex / named / rgb / hsl fallback, so nothing (no ; " ' < > { } or a nested
  // function) can break out of the style="…" property this value is interpolated into.
  if (/^var\(\s*--[a-zA-Z0-9-]+\s*(,\s*(#[0-9a-fA-F]{3,8}|[a-zA-Z]+|(?:rgb|rgba|hsl|hsla)\([0-9.,%\s/]+\)))?\s*\)$/.test(s)) return s;
  return fallback;
}
// === /lolly:shared safeColor ===
function boolVal(v, dflt) {
  if (v === true || v === false) return v;
  if (v == null || v === '') return dflt;
  var s = String(v).toLowerCase();
  if (s === 'true' || s === '1' || s === 'yes' || s === 'on') return true;
  if (s === 'false' || s === '0' || s === 'no' || s === 'off') return false;
  return dflt;
}
// === lolly:shared esc - generated from community/_shared/text.js; edit there and run npm run sync:shared ===
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
// === /lolly:shared esc ===

// ── semi-rich text (same tiny markdown subset as Design) ────────────────────
function inlineMd(s) {
  s = s.replace(/\\\*/g, '\x01').replace(/\\_/g, '\x02');
  s = s.replace(/\{([^|{}]+)\|([^{}]*)\}/g, function (whole, attrs, inner) {
    var styles = [], deco = [], toks = attrs.trim().split(/\s+/);
    for (var i = 0; i < toks.length; i++) {
      var tok = toks[i];
      if (/^#[0-9a-fA-F]{3,8}$/.test(tok)) { var c = safeColor(tok, ''); if (!c) return whole; styles.push('color:' + c); }
      else if (/^w[1-9]00$/.test(tok)) { styles.push('font-weight:' + tok.slice(1)); }
      else if (tok === 'mono' || tok === 'suse') { styles.push('font-family:' + fontFamily(tok === 'mono' ? 'SUSE Mono' : 'SUSE')); }
      else if (tok === 'u') { deco.push('underline'); }
      else if (tok === 's') { deco.push('line-through'); }
      else { return whole; }
    }
    if (deco.length) styles.push('text-decoration:' + deco.join(' '));
    return styles.length ? '<span style="' + styles.join(';') + '">' + inner + '</span>' : whole;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  s = s.replace(/(^|[^_\w])_([^_\n]+)_/g, '$1<em>$2</em>');
  return s.replace(/\x01/g, '*').replace(/\x02/g, '_');
}
function richText(raw) {
  return esc(raw).split('\n').map(function (ln) {
    var mb = ln.match(/^(\s*)[-*•]\s+(.*)$/);
    if (mb) return mb[1] + '•  ' + inlineMd(mb[2]);
    var mo = ln.match(/^(\s*)(\d{1,3})\.\s+(.*)$/);
    if (mo) return mo[1] + mo[2] + '.  ' + inlineMd(mo[3]);
    return inlineMd(ln);
  }).join('\n');
}
// Plain text of the FIRST line (markdown stripped) - used to derive avatar initials.
function firstLinePlain(text) {
  var first = String(text == null ? '' : text).split('\n')[0] || '';
  return first
    .replace(/\{[^|{}]*\|([^{}]*)\}/g, '$1')   // attribute runs → their inner text
    .replace(/[*_`>#~]/g, '')                    // markdown markers
    .replace(/\s+/g, ' ').trim();
}
function initialsFrom(text) {
  var words = firstLinePlain(text).split(' ').filter(Boolean);
  if (!words.length) return '';
  var a = words[0].charAt(0);
  var b = words.length > 1 ? words[words.length - 1].charAt(0) : '';
  return (a + b).toUpperCase();
}

// ── colour helpers ────────────────────────────────────────────────────────────────
function hexToRgb(hex) {
  var s = String(hex || '').trim().replace('#', '');
  if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
  if (!/^[0-9a-fA-F]{6,8}$/.test(s)) return null;
  return { r: parseInt(s.slice(0, 2), 16), g: parseInt(s.slice(2, 4), 16), b: parseInt(s.slice(4, 6), 16) };
}
// Legible ink (dark or white) for text sitting on `bg`. Understands #hex and rgb()/
// rgba(); for any other valid-but-unparseable colour (e.g. a CSS named colour) it
// defaults to dark ink, which reads on the typical light/mid accent chips.
function inkOn(bg) {
  var c = hexToRgb(bg);
  if (!c) {
    var m = String(bg == null ? '' : bg).match(/^rgba?\(\s*(\d{1,3})[,\s]+(\d{1,3})[,\s]+(\d{1,3})/i);
    if (m) c = { r: +m[1], g: +m[2], b: +m[3] };
  }
  if (!c) return '#0c322c';
  var lum = (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255;
  return lum > 0.62 ? '#0c322c' : '#ffffff';
}

function radiusFor(shape, radius) {
  switch (shape) {
    case 'rounded': return Math.max(0, num(radius, 0)) + 'px';
    case 'pill': return '9999px';
    case 'ellipse': return '50%';
    default: return '0';
  }
}
var H_JUSTIFY = { left: 'flex-start', center: 'center', right: 'flex-end' };
var V_ALIGN = { top: 'flex-start', middle: 'center', bottom: 'flex-end' };
function weightOf(b) {
  var w = clamp(Math.round(num(b.weight, 600) / 100) * 100, 100, 900);
  if (String(b.font) === 'SUSE Mono' && w > 800) w = 800;
  return String(w);
}
var FONTS = {
  'SUSE Mono': "'SUSE Mono', ui-monospace, SFMono-Regular, monospace",
  'SUSE': "'SUSE', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
};
function fontFamily(v) { return FONTS[String(v)] || FONTS.SUSE; }
var FITS = { cover: 1, contain: 1, fill: 1, none: 1, 'scale-down': 1 };
var OBJPOS = {
  center: 1, 'center top': 1, 'center bottom': 1, 'left center': 1, 'right center': 1,
  'left top': 1, 'right top': 1, 'left bottom': 1, 'right bottom': 1,
  top: 1, bottom: 1, left: 1, right: 1,
};
var BLENDS = { multiply: 1, screen: 1, overlay: 1, darken: 1, lighten: 1 };

// Which layout a box uses. Non-card kinds are always 'plain'.
function layoutOf(b) {
  if (String(b.kind || 'card') !== 'card') return 'plain';
  var L = String(b.layout || 'row');
  return (L === 'row' || L === 'icon' || L === 'stacked' || L === 'plain') ? L : 'row';
}

function typeFeatureCss(b) {
  var track = clamp(num(b.tracking, 0), -100, 400);
  var ligOff = !boolVal(b.ligatures, true);
  var altOn = boolVal(b.alternates, false);
  var feat = [];
  if (ligOff) feat.push('"liga" 0', '"clig" 0');
  if (altOn) feat.push('"salt" 1');
  return (track ? 'letter-spacing:' + f2(track) + 'px;' : '') + (feat.length ? 'font-feature-settings:' + feat.join(', ') + ';' : '');
}

// ── box (card) CSS ─────────────────────────────────────────────────────────────────
function boxCss(b, layout) {
  var x = Math.round(num(b.x, 0)), y = Math.round(num(b.y, 0));
  var w = Math.max(1, Math.round(num(b.w, 1))), h = Math.max(1, Math.round(num(b.h, 1)));
  var rot = num(b.rot, 0);
  var op = clamp(num(b.opacity, 100), 0, 100) / 100;
  var fill = safeColor(b.bg, layout === 'plain' ? 'transparent' : '#ffffff');
  var blend = BLENDS[String(b.blend)] === 1 ? String(b.blend) : '';
  var css =
    'left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px;' +
    (rot ? 'transform:rotate(' + (Math.round(rot * 10) / 10) + 'deg);' : '') +
    (op !== 1 ? 'opacity:' + op + ';' : '') +
    (blend ? 'mix-blend-mode:' + blend + ';' : '') +
    'background:' + fill + ';' +
    'border-radius:' + radiusFor(b.shape, b.radius) + ';';
  if (layout === 'plain') {
    return css +
      'justify-content:' + (H_JUSTIFY[b.align] || 'center') + ';' +
      'align-items:' + (V_ALIGN[b.valign] || 'center') + ';';
  }
  // Card: flex container laying out the avatar beside/above the text.
  var pad = Math.round(clamp(num(b.pad, 16), 0, 400));
  var gap = clamp(Math.round(pad * 0.9), 6, 20);
  if (layout === 'stacked') {
    return css + 'flex-direction:column;align-items:stretch;justify-content:flex-start;gap:' + gap + 'px;padding:' + pad + 'px;';
  }
  return css + 'flex-direction:row;align-items:' + (V_ALIGN[b.valign] || 'center') + ';justify-content:flex-start;gap:' + gap + 'px;padding:' + pad + 'px;';
}

function textCss(b, layout) {
  var size = Math.max(1, Math.round(num(b.fontSize, 30)));
  var align = layout === 'stacked' ? (H_JUSTIFY[b.align] ? b.align : 'center')
    : (layout === 'plain' ? (H_JUSTIFY[b.align] ? b.align : 'center') : (H_JUSTIFY[b.align] ? b.align : 'left'));
  var css =
    'text-align:' + align + ';' +
    'color:' + safeColor(b.fg, '#0c322c') + ';' +
    'font-family:' + fontFamily(b.font) + ';' +
    'font-size:' + size + 'px;' +
    'font-weight:' + weightOf(b) + ';' +
    'line-height:' + clamp(num(b.lineHeight, 1.15), 0.5, 4) + ';' +
    typeFeatureCss(b);
  if (layout === 'plain') {
    var pad = Math.round(clamp(num(b.pad, 8), 0, 400));
    return css + 'padding:' + pad + 'px;';
  }
  // Card: the text is a flex child that takes the space beside/below the avatar.
  return css + 'padding:0;width:auto;flex:1 1 auto;min-width:0;';
}

// ── media / avatar ──────────────────────────────────────────────────────────────────
function imgObjCss(b, fitOverride) {
  var fit = fitOverride || (FITS[String(b.fit)] === 1 ? String(b.fit) : 'contain');
  var pos = String(b.imgpos == null ? '' : b.imgpos).trim();
  return 'object-fit:' + fit + ';' + (OBJPOS[pos] === 1 && pos !== 'center' ? 'object-position:' + pos + ';' : '');
}
// The <img>/<video>/lottie element for a box's image. `cls` + `extraStyle` let it serve
// both the plain absolute-fill case and the card avatar (a sized flex child).
function mediaEl(b, cls, extraStyle, fitOverride) {
  var img = b && b.image;
  var url = img && img.url ? String(img.url) : '';
  if (!url) return '';
  var isLottie = (img && img.type === 'lottie') || /\.json($|\?|#)/i.test(url);
  var isVideo = (img && img.type === 'video') || /\.(mp4|m4v|mov|webm)($|\?|#)/i.test(url);
  var style = imgObjCss(b, fitOverride) + (extraStyle || '');
  if (isLottie) {
    var lfit = (fitOverride || String(b.fit)) === 'cover' ? 'cover' : 'contain';
    return '<div class="' + cls + ' lolly-box-lottie" data-lottie-src="' + esc(url) +
      '" data-lottie-loop="1" data-lottie-autoplay="1" data-lottie-fit="' + lfit + '" style="' + style + '"></div>';
  }
  if (isVideo) {
    var vkey = b && b.id != null ? esc(String(b.id)) : esc(url);
    return '<video class="' + cls + '" src="' + esc(url) + '" data-video-key="' + vkey +
      '" muted loop autoplay playsinline style="' + style + '"></video>';
  }
  return '<img class="' + cls + '" src="' + esc(url) + '" style="' + style + '" alt="" draggable="false">';
}

function avatarHtml(b, layout) {
  var pad = Math.round(clamp(num(b.pad, 16), 0, 400));
  var w = Math.max(1, Math.round(num(b.w, 1))), h = Math.max(1, Math.round(num(b.h, 1)));
  var accent = safeColor(b.accent, '#30ba78');
  var url = b && b.image && b.image.url ? String(b.image.url) : '';
  var hasImg = !!url;

  if (layout === 'stacked') {
    var bandH = clamp(Math.round((h - 2 * pad) * 0.55), 36, Math.max(36, h - 2 * pad - 24));
    var br = Math.round(clamp(num(b.radius, 12), 0, 60) * 0.7);
    var wrap = 'height:' + bandH + 'px;width:100%;border-radius:' + br + 'px;background:' + (hasImg ? 'transparent' : accent) + ';';
    var inner = hasImg ? mediaEl(b, 'oc-avatar-img', 'position:absolute;inset:0;width:100%;height:100%;', 'cover')
      : initialsHtml(b, accent, Math.round(bandH * 0.42));
    return '<div class="oc-avatar" style="' + wrap + '">' + inner + '</div>';
  }

  var side, radius, fit;
  if (layout === 'icon') {
    side = clamp(Math.min(h - 2 * pad, 56), 20, 72);
    radius = Math.round(side * 0.28) + 'px';
    fit = FITS[String(b.fit)] === 1 ? String(b.fit) : 'contain';   // icons: don't crop by default
  } else { // row (headshot)
    side = clamp(h - 2 * pad, 24, Math.min(h, Math.floor(w * 0.5)));
    radius = '50%';
    fit = 'cover';
  }
  var wrap2 = 'width:' + side + 'px;height:' + side + 'px;border-radius:' + radius + ';background:' + (hasImg ? 'transparent' : accent) + ';';
  var inner2 = hasImg ? mediaEl(b, 'oc-avatar-img', 'width:100%;height:100%;', fit)
    : initialsHtml(b, accent, Math.round(side * 0.42));
  return '<div class="oc-avatar" style="' + wrap2 + '">' + inner2 + '</div>';
}
function initialsHtml(b, accent, size) {
  var ini = initialsFrom(b && b.text);
  if (!ini) return '';
  return '<span class="oc-initials" style="color:' + inkOn(accent) + ';font-size:' + size + 'px">' + esc(ini) + '</span>';
}

// The media markup for a box: an absolute-fill image (plain) or a card avatar.
function mediaFor(b, layout) {
  if (layout === 'plain') return mediaEl(b, 'lolly-box-img', '', null);
  return avatarHtml(b, layout);
}

// ── the path primitive (plan 96) ────────────────────────────────────────────────────
//
// A line, a spline and a connector are ONE thing here: a `kind:'path'` box carrying an
// authored path plus its decorations. None of the geometry lives in this file any more -
// the routing, the arrowheads and the dash segments all come from the engine through
// host.connectors / host.geom, so the editor's live preview, the committed export and a
// headless CLI draw the same line. Everything below feature-detects and degrades to "no
// decoration" / "no layer", never to a throw.

var FILL_RULES = { nonzero: 1, evenodd: 1 };
var LINE_CAPS = { butt: 1, round: 1, square: 1 };
var LINE_JOINS = { miter: 1, round: 1, bevel: 1 };
var DASH_STYLES = { dashed: 1, dotted: 1 };
var HEAD_KINDS = { none: 1, triangle: 1, open: 1, circle: 1, diamond: 1, bar: 1 };
// SVG's own default. Emitted explicitly, because PDF's default is 10 and a miter spike
// that differs between the browser and the export is a shape that moved.
var MITER_LIMIT = 4;

// host.geom (v1.64) and host.connectors (v1.106) are OPTIONAL and additive.
function geomApi() {
  return typeof host !== 'undefined' && host && host.geom ? host.geom : null;
}
function connApi() {
  return typeof host !== 'undefined' && host && host.connectors ? host.connectors : null;
}
function pathWarn(msg) {
  try {
    if (typeof host !== 'undefined' && host && typeof host.log === 'function') host.log('warn', 'org-chart: ' + msg);
  } catch (e) { /* logging must never be the thing that breaks a render */ }
}

// The head vocabulary, whitelisted for the same reason the cap/join/dash keywords are:
// the value reaches a bridge call and, through it, an attribute in {{{ }}} markup.
function headKind(v) {
  var s = String(v == null ? '' : v);
  return HEAD_KINDS[s] ? s : 'none';
}
// The head's SIZE from the stroke width, and how far the SHAFT is pulled back so a filled
// head is not pierced by the line it terminates. Both mirror engine/src/connectors.ts
// (pathHeadSize / edgeHeadInset) EXACTLY, because the head is drawn by that engine code and
// the pull-back is computed here: two formulas that must agree, so they are written to
// agree rather than guessed. An open chevron and a bar are strokes across the tip with
// nothing to pierce, so they pull back by nothing.
// The width is clamped to the SAME [0.5, 20] band `pathHeadSize` clamps it to before the
// engine sizes the head. Without that, a 40px stroke draws an 80px head (the engine's) and
// pulls its shaft back 144px (this one's), leaving the line visibly short of its own arrow.
function headSizeFor(w) { return Math.max(9, clamp(num(w, 2.5), 0.5, 20) * 4); }
function headInsetFor(kind, s) {
  if (kind === 'none' || kind === 'open' || kind === 'bar') return 0;
  if (kind === 'diamond') return 2 * s;
  if (kind === 'circle') return 2 * (0.42 * s);
  return s * 0.9;   // triangle
}
// One arrowhead as an SVG fragment, via the bridge. `angle` is RADIANS about the +x axis -
// atan2 order. Absent primitive (older engine) → '' and the path simply has no head.
function headSvgFor(tip, ux, uy, kind, color, width) {
  var api = connApi();
  if (kind === 'none' || !api || typeof api.pathHeadSvg !== 'function') return '';
  try {
    return api.pathHeadSvg({
      tipX: tip.x, tipY: tip.y, angle: Math.atan2(uy, ux),
      head: kind, color: color, width: width,
    }) || '';
  } catch (e) {
    pathWarn('arrowhead render failed: ' + e);
    return '';
  }
}

// Stroke style -> an SVG dash array, in the same user units as stroke-width. A KEYWORD, not
// an authored array: a keyword is whitelist-checkable so nothing the user types reaches the
// attribute, the dashes keep their proportions when the width changes, and the compact
// blocks URL cannot carry a comma at all.
function dashArrayFor(style, w, cap) {
  if (!DASH_STYLES[style] || !(w > 0)) return '';
  if (style === 'dotted') {
    // A round or square cap already paints a full w across the line, so the dot is a
    // ZERO-length dash and the gap is the whole period. A flat (butt) cap paints nothing
    // at zero length, so it needs a real w-long dash - which is a square dot, correctly.
    return cap === 'butt' ? f2(w) + ' ' + f2(w) : '0 ' + f2(w * 2);
  }
  return f2(w * 3) + ' ' + f2(w * 2);
}

// ── end tangents ────────────────────────────────────────────────────────────────────
// A head needs a tip and a direction. On a routed connector the direction falls out of the
// route; on an AUTHORED path there is none, so it is read off the LOWERED curve - the only
// honest source, since the same nodes lower to different tangents under different spline
// kinds. Both vectors point OUT of the path: the way a head at that end faces.
// `curves` is the engine's cubic form: [x0,y0, c1x,c1y, c2x,c2y, x3,y3].
function unitBetween(ax, ay, bx, by) {
  var dx = bx - ax, dy = by - ay, L = Math.sqrt(dx * dx + dy * dy);
  return L > 1e-9 ? { x: dx / L, y: dy / L } : null;
}
function endTangents(curves) {
  var s = null, e = null, i, c, legs, k;
  // A zero-length control leg is ordinary (a straight segment out of fromNodes has one), so
  // step over it rather than normalise it; only a wholly degenerate segment moves the walk
  // into its neighbour.
  for (i = 0; i < curves.length && !s; i++) {
    c = curves[i]; legs = [[2, 3], [4, 5], [6, 7]];
    for (k = 0; k < legs.length && !s; k++) s = unitBetween(c[legs[k][0]], c[legs[k][1]], c[0], c[1]);
  }
  for (i = curves.length - 1; i >= 0 && !e; i--) {
    c = curves[i]; legs = [[4, 5], [2, 3], [0, 1]];
    for (k = 0; k < legs.length && !e; k++) e = unitBetween(c[legs[k][0]], c[legs[k][1]], c[6], c[7]);
  }
  return s && e ? { start: s, end: e } : null;
}
function endPoints(curves) {
  var a = curves[0], z = curves[curves.length - 1];
  return { start: { x: a[0], y: a[1] }, end: { x: z[6], y: z[7] } };
}
// Pull the two END POINTS back along their own tangents, so the shaft stops short of a
// filled head instead of running out through its tip. Only the endpoint and the control
// point beside it move, by the same delta, so the tangent direction is untouched and the
// curve keeps its shape; the pull-back is capped at 40% of the segment's chord so a very
// short final segment cannot be turned inside out. Returns a NEW curves array.
function insetCurveEnds(curves, dirs, insetStart, insetEnd) {
  var out = [], i;
  for (i = 0; i < curves.length; i++) out.push(curves[i].slice());
  var first = out[0], last = out[out.length - 1];
  var capOf = function (c) {
    var dx = c[6] - c[0], dy = c[7] - c[1];
    return Math.sqrt(dx * dx + dy * dy) * 0.4;
  };
  if (insetStart > 0) {
    var ds = Math.min(insetStart, capOf(first));
    first[0] -= dirs.start.x * ds; first[1] -= dirs.start.y * ds;
    first[2] -= dirs.start.x * ds; first[3] -= dirs.start.y * ds;
  }
  if (insetEnd > 0) {
    var de = Math.min(insetEnd, capOf(last));
    last[6] -= dirs.end.x * de; last[7] -= dirs.end.y * de;
    last[4] -= dirs.end.x * de; last[5] -= dirs.end.y * de;
  }
  return out;
}

// The honest degrade: a dashed outline of the box frame. A path we cannot draw is still a
// box the user placed, and an invisible element is the one answer that can't be acted on.
// currentColor + fixed numbers, so nothing from the box can reach the markup.
function pathPlaceholder(w, h, why) {
  pathWarn(why);
  var d = 'M.75 .75H' + (w - 0.75) + 'V' + (h - 0.75) + 'H.75Z';
  return '<svg class="lolly-box-path lolly-box-path-undrawn" width="' + w + '" height="' + h +
    '" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" aria-hidden="true">' +
    '<path d="' + d + '" fill="none" stroke="currentColor" stroke-width="1.5"' +
    ' stroke-dasharray="6 4" opacity="0.45"></path></svg>';
}

// A FREE path box's inline <svg>, or '' for every other kind. Pure/string-only like
// mediaFor, so the CLI emits identical markup.
function pathHtmlFor(b) {
  if (String(b.kind) !== 'path') return '';
  // A BOUND path is a connector: its shape is the route between two live rects, in CANVAS
  // coordinates, and a box <svg> can only draw inside its own frame. lineLayerFor() draws
  // it instead.
  if (isBoundPath(b)) return '';
  var w = Math.max(1, Math.round(num(b.w, 1)));
  var h = Math.max(1, Math.round(num(b.h, 1)));
  var raw = b.path == null ? '' : String(b.path);
  if (!raw) return '';                       // nothing authored yet - not an error

  var geom = geomApi();
  if (!geom || !geom.decodeAuthored || !geom.fromNodes) {
    return pathPlaceholder(w, h, 'host.geom is unavailable, so a path box cannot be drawn (needs engine >= 1.64)');
  }
  var dec = geom.decodeAuthored(raw);
  if (!dec || !dec.ok) {
    return pathPlaceholder(w, h, 'path box: ' + ((dec && dec.message) || 'unreadable path field'));
  }
  // A value carries a LIST of contours, always. Every contour is lowered on its own and the
  // subpaths are concatenated into ONE `d`, which is what makes a hole a hole.
  var srcs = dec.value, ds = [], pi, i;
  for (pi = 0; pi < srcs.length; pi++) {
    var src = srcs[pi], nodes = [];
    for (i = 0; i < src.nodes.length; i++) {
      var n = src.nodes[i], out = { x: n.x * w, y: n.y * h };
      if (n.hInX != null) out.hInX = n.hInX * w;
      if (n.hInY != null) out.hInY = n.hInY * h;
      if (n.hOutX != null) out.hOutX = n.hOutX * w;
      if (n.hOutY != null) out.hOutY = n.hOutY * h;
      if (n.continuity) out.continuity = n.continuity;
      nodes.push(out);
    }
    var res = geom.fromNodes({ kind: src.kind, nodes: nodes, closed: src.closed === true, tension: src.tension, decimals: 3 });
    if (!res || !res.ok) {
      return pathPlaceholder(w, h, 'path box: ' + ((res && res.code) || 'error') + ' - ' + ((res && res.message) || 'could not lower the path'));
    }
    // ok with no geometry is an ANSWER, not a failure (fewer than two nodes lowers to no
    // curves), so an empty contour is skipped rather than treated as a refusal.
    if (res.d) ds.push(res.d);
  }
  if (!ds.length) return '';
  var d = ds.join(' ');

  var fill = b.bg == null || String(b.bg).trim() === '' ? 'none' : safeColor(b.bg, 'none');
  var stroke = b.stroke == null || String(b.stroke).trim() === '' ? '' : safeColor(b.stroke, '');
  var sw = clamp(num(b.strokeW, 0), 0, 400);
  var rule = FILL_RULES[String(b.fillRule)] ? String(b.fillRule) : 'nonzero';
  var cap = LINE_CAPS[String(b.strokeCap)] ? String(b.strokeCap) : 'round';
  var join = LINE_JOINS[String(b.strokeJoin)] ? String(b.strokeJoin) : 'round';
  var dash = dashArrayFor(String(b.strokeDash == null ? '' : b.strokeDash), sw, cap);

  // Arrowheads. They need the LOWERED curve (the tangent a head points along) and are
  // meaningful only on a path with two ends, so they apply to a SINGLE OPEN contour: a
  // closed loop has no ends, and a multi-contour result has no single pair of them.
  var headStart = headKind(b.headStart), headEnd = headKind(b.headEnd);
  var wantHeads = !!stroke && sw > 0 && (headStart !== 'none' || headEnd !== 'none');
  var sole = srcs.length === 1 ? srcs[0] : null;
  var curves = null;
  if (wantHeads && sole && !(sole.closed === true) && typeof geom.parse === 'function') {
    var pr = geom.parse(d);
    if (pr && pr.ok && pr.value && pr.value.length === 1) curves = pr.value[0].curves;
  }
  var heads = '', headReach = 0;
  if (curves && curves.length) {
    var dirs = endTangents(curves);
    if (dirs) {
      var tips = endPoints(curves), hsz = headSizeFor(sw);
      // Each head is BUILT FIRST and the shaft is pulled back only where one actually came
      // back: the primitive is feature-detected, so "no head" is a real outcome on an older
      // engine, and trimming for a head that was never drawn would leave the line visibly
      // short of its own endpoint with nothing there to explain it.
      var hs = headSvgFor(tips.start, dirs.start.x, dirs.start.y, headStart, stroke, sw);
      var he = headSvgFor(tips.end, dirs.end.x, dirs.end.y, headEnd, stroke, sw);
      heads = hs + he;
      if (heads) {
        var trimmed = insetCurveEnds(curves, dirs, hs ? headInsetFor(headStart, hsz) : 0, he ? headInsetFor(headEnd, hsz) : 0);
        if (typeof geom.toPathData === 'function') {
          var td = geom.toPathData([{ curves: trimmed, closed: false }], { decimals: 3 });
          if (td && td.ok && td.d) d = td.d;
        }
        // A head sits ON the frame edge and spreads across the tangent (a bar reaches
        // 0.62·size either side, the widest of the six), so the pad below has to cover it.
        headReach = hsz * 0.7 + sw / 2;
      }
    }
  }

  // The STROKE PAD. The frame is the curve's tight bounding box, so a stroke straddles the
  // frame edge and half of it falls outside - and an outer <svg> clips to its viewport. So
  // the element is grown by `pad` on every side, offset by −pad, and the viewBox shifted to
  // match, which leaves path coordinates mapping to 0..w / 0..h exactly as before. A square
  // cap reaches sw/2·√2 and a miter spike is bounded by miterlimit·sw/2, so each sizes the
  // pad for itself; an arrowhead is the third, via headReach.
  var reach = Math.max(cap === 'square' ? Math.SQRT2 / 2 : 0.5, join === 'miter' ? MITER_LIMIT / 2 : 0.5);
  var pad = Math.max(stroke && sw > 0 ? sw * reach : 0, headReach);
  var vw = f2(w + pad * 2), vh = f2(h + pad * 2), o = f2(-pad);
  return '<svg class="lolly-box-path" width="' + esc(vw) + '" height="' + esc(vh) +
    '" viewBox="' + esc(o) + ' ' + esc(o) + ' ' + esc(vw) + ' ' + esc(vh) + '" preserveAspectRatio="none"' +
    (pad ? ' style="inset:auto;left:' + esc(o) + 'px;top:' + esc(o) + 'px;width:' + esc(vw) + 'px;height:' + esc(vh) + 'px"' : '') +
    '>' +
    '<path d="' + esc(d) + '" fill="' + esc(fill) + '" fill-rule="' + esc(rule) + '"' +
    (stroke && sw > 0
      ? ' stroke="' + esc(stroke) + '" stroke-width="' + esc(f2(sw)) +
        '" stroke-linejoin="' + esc(join) + '" stroke-linecap="' + esc(cap) + '"' +
        (join === 'miter' ? ' stroke-miterlimit="' + esc(MITER_LIMIT) + '"' : '') +
        (dash ? ' stroke-dasharray="' + esc(dash) + '"' : '')
      : '') +
    '></path>' +
    // The heads follow the shaft so they paint over its end, and they are NOT esc()'d: they
    // are engine-built SVG fragments, not values - the engine escapes the one thing in them
    // that came from the box (the colour).
    heads +
    '</svg>';
}

// ── bound paths: connector management takes over ────────────────────────────────────
//
// A path box with an end ATTACHED to a card is a connector. The engine routes from the
// card's border toward the other end (another card, or the path's own free node as an
// `@x,y` point) and re-solves that route every render, so the line sticks to the cards
// wherever they move. The route comes from the path's own SPLINE KIND
// (host.connectors.routeStyleForKind), overridden by the box's `route` field for the nine
// variants six kinds cannot name.
//
// CW/CH are the artboard's native coordinate space, and the <svg> is CSS-stretched to the
// artboard (styles.css .oc-connectors), so the viewBox maps card x/y 1:1.
// What a bound path falls back to when it carries no stroke of its own - the same pair the
// retired `canvas.connect` block declared, so a migrated edge looks as it did.
var CONN_COLOR = '#30ba78', CONN_WIDTH = 3.5;

function bindOf(b, which) {
  var v = which === 'start' ? b.bindStart : b.bindEnd;
  return v == null ? '' : String(v).trim();
}
function isBoundPath(b) {
  return String(b.kind) === 'path' && (bindOf(b, 'start') !== '' || bindOf(b, 'end') !== '');
}
function ptRef(p) { return '@' + f2(p.x) + ',' + f2(p.y); }

// A path box's spline kind, node count, and its two END POINTS in CANVAS coordinates.
// Nodes are stored NORMALISED to the frame. Rotation is deliberately ignored: a bound path
// is drawn between two rects and the router re-solves both ends anyway.
function pathGeomFor(b) {
  var geom = geomApi();
  var raw = b.path == null ? '' : String(b.path);
  if (!geom || typeof geom.decodeAuthored !== 'function' || !raw) return null;
  var dec = geom.decodeAuthored(raw);
  if (!dec || !dec.ok || !dec.value || !dec.value.length) return null;
  var src = dec.value[0], ns = src && src.nodes;
  if (!ns || ns.length < 2) return null;
  var x = num(b.x, 0), y = num(b.y, 0);
  var w = Math.max(1, num(b.w, 1)), h = Math.max(1, num(b.h, 1));
  var a = ns[0], z = ns[ns.length - 1];
  return {
    kind: String(src.kind == null ? '' : src.kind),
    nodes: ns.length,
    start: { x: x + num(a.x, 0) * w, y: y + num(a.y, 0) * h },
    end: { x: x + num(z.x, 0) * w, y: y + num(z.y, 0) * h },
  };
}

// One bound path as a row the engine's committed-line builder reads. null for anything that
// is not a connector, and for a HALF-bound path whose free end cannot be read: half a
// connector is worse than none, and guessing where the loose end goes would invent geometry.
function boundPathRow(b) {
  if (!isBoundPath(b)) return null;
  var bs = bindOf(b, 'start'), be = bindOf(b, 'end');
  var g = pathGeomFor(b);
  if ((!bs || !be) && !g) return null;
  var api = connApi();
  var route = (api && typeof api.routeStyleForKind === 'function')
    ? api.routeStyleForKind(g ? g.kind : '', b.route, g ? g.nodes : 2)
    : 'straight';
  var sw = clamp(num(b.strokeW, 0), 0, 400);
  return {
    from: bs || ptRef(g.start),
    to: be || ptRef(g.end),
    style: route,
    headStart: headKind(b.headStart),
    headEnd: headKind(b.headEnd),
    dash: DASH_STYLES[String(b.strokeDash)] ? String(b.strokeDash) : 'solid',
    color: safeColor(b.stroke, CONN_COLOR),
    width: sw > 0 ? clamp(sw, 0.5, 20) : CONN_WIDTH,
  };
}

// The committed line layer: every bound path in the chart, routed + decorated by the engine
// (host.connectors.build) so the SAME geometry lands in the editor's live preview, the
// export and a headless CLI. The wrapping <svg> is always emitted, even empty, because the
// artboard's first child must not be an <svg> the exporter mistakes for the whole board -
// which is exactly what the template's oc-conn-wrap <div> is for.
function lineLayerFor(boxes) {
  var api = connApi();
  var body = '';
  if (api && typeof api.build === 'function') {
    var rows = [], i, row;
    for (i = 0; i < boxes.length; i++) {
      row = boundPathRow(boxes[i] || {});
      if (row) rows.push(row);
    }
    if (rows.length) {
      var rectById = new Map();
      boxes.forEach(function (b, k) {
        var id = (b && b.id != null && b.id !== '') ? String(b.id) : String(k);
        rectById.set(id, { x: num(b && b.x, 0), y: num(b && b.y, 0), w: Math.max(1, num(b && b.w, 1)), h: Math.max(1, num(b && b.h, 1)) });
      });
      try {
        return api.build(rows, rectById, {
          fromField: 'from', toField: 'to', styleField: 'style',
          headStartField: 'headStart', headEndField: 'headEnd',
          colorField: 'color', dashField: 'dash', widthField: 'width',
          defaultStyle: 'elbow', defaultColor: CONN_COLOR, defaultWidth: CONN_WIDTH,
          width: CW, height: CH, layerClass: 'oc-connectors',
        });
      } catch (e) {
        pathWarn('bound path render failed: ' + e);
      }
    }
  }
  return '<svg class="oc-connectors" width="' + CW + '" height="' + CH + '" viewBox="0 0 ' + CW + ' ' + CH +
    '" preserveAspectRatio="none" aria-hidden="true">' + body + '</svg>';
}

// ── plan 96 P4: the plan-90 `connectors` edge input, migrated on load ────────────────
//
// An edge {from,to,style,arrow,head,dash,color,width} becomes a TWO-NODE AuthoredPath box
// bound at both ends, carrying the same decorations. The input stays DECLARED so an old
// share link still parses, but nothing writes it again.
//
// Lossless by construction. The edge's own `style` goes to the box's `route` override - six
// spline kinds cannot name thirteen routes, so an elbow-src edge would otherwise collapse to
// a plain elbow - and `arrow` + one shared `head` map onto the two per-end heads exactly as
// the engine's own edge reading does (`end` → a head at the end and none at the start,
// `both` → the same shape at each, anything else → neither). Every default here is the one
// this hook applied before the migration existed (elbow, end, open, #30ba78, 3.5), so the
// converted chart is the chart that was there (tests/org-chart-migration.test.ts).
var MIGRATED_ID_PREFIX = 'ln';

// The wire form of a two-node straight AuthoredPath (engine/src/geom/authored-url.ts):
// `1` format version, the kind, `0` = open, then one `x!y` record per node, `_`-separated.
function twoNodePathValue(n0, n1) {
  return '1!line!0_' + f2(n0.x) + '!' + f2(n0.y) + '_' + f2(n1.x) + '!' + f2(n1.y);
}


// The whole migration: null when there is nothing to do (which is the case for every
// document saved after this shipped, and the thing that keeps compute() from writing inputs
// on every render), else the new `boxes` array with one path box appended per edge.

// Optional drop shadow (matches Design). `shadow` picks WHAT the shadow
// follows → which CSS property: box → box-shadow, text → text-shadow, content →
// filter:drop-shadow. Raster-faithful (PNG/JPG/WebP); flattens in the SVG/PDF vector
// walkers, same as blend modes.
var SHADOW_TARGETS = { box: 1, text: 1, content: 1 };
function shadowCss(b) {
  var tgt = String(b.shadow || 'none');
  if (SHADOW_TARGETS[tgt] !== 1) return { box: '', text: '', filter: '' };
  var col = safeColor(b.shadowColor, '#0c322c33');
  var x = Math.round(clamp(num(b.shadowX, 0), -300, 300));
  var y = Math.round(clamp(num(b.shadowY, 0), -300, 300));
  var bl = Math.round(clamp(num(b.shadowBlur, 10), 0, 300));
  var off = x + 'px ' + y + 'px ' + bl + 'px ';
  if (tgt === 'text') return { box: '', text: 'text-shadow:' + off + col + ';', filter: '' };
  if (tgt === 'box') return { box: 'box-shadow:' + off + col + ';', text: '', filter: '' };
  return { box: '', text: '', filter: 'filter:drop-shadow(' + off + col + ');' };
}

// ── compute ─────────────────────────────────────────────────────────────────────────
function compute(model) {
  var inp = inputsFrom(model);
  var boxes = Array.isArray(inp.boxes) ? inp.boxes : [];
  // plan 96 P4 - any surviving `connectors` edge becomes a bound path box before anything
  // else reads `boxes`, so every surface below sees ONE model with no edges in it.
  var transparent = inp.transparentBg === true;

  var layouts = boxes.map(function (b) { return layoutOf(b || {}); });
  var shadows = boxes.map(function (b) { return shadowCss(b || {}); });
  var boxStyle = boxes.map(function (b, i) { return boxCss(b || {}, layouts[i]) + shadows[i].box + shadows[i].filter; });
  var textStyle = boxes.map(function (b, i) { return textCss(b || {}, layouts[i]) + shadows[i].text; });
  var textHtml = boxes.map(function (b) { return richText((b && b.text) || ''); });
  var mediaHtml = boxes.map(function (b, i) { return mediaFor(b || {}, layouts[i]); });
  var pathHtml = boxes.map(function (b) { return pathHtmlFor(b || {}); });

  var out = {
    boxStyle: boxStyle,
    textStyle: textStyle,
    textHtml: textHtml,
    mediaHtml: mediaHtml,
    pathHtml: pathHtml,
    connectorSvg: lineLayerFor(boxes),
    bgStyle: [transparent ? 'transparent' : safeColor(inp.background, '#ffffff')],
  };
  // The migration's INPUT patch. `boxes`/`connectors` are declared input ids, so the
  // runtime WRITES them rather than treating them as extras - which is what makes this a
  // one-time conversion. The keys are ASSIGNED, never set to undefined: the runtime's patch
  // merge keys off key PRESENCE, so `{ boxes: undefined }` would blank the whole document.
  return out;
}

function onInit(ctx) { return compute(ctx.model); }
function onInput(ctx) { return compute(ctx.model); }
