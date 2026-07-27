/* global onInit, onInput, beforeExport, host */

/**
 * Layout Studio — a free-form WYSIWYG canvas of positioned "boxes".
 *
 * The tool is DATA: each box is one row of the `boxes` blocks input, carrying flat
 * geometry (x/y/w/h/rot) + decoration (shape/radius/fill/opacity/image/text/…).
 * The direct-manipulation overlay (select / drag / resize / rotate / z-order /
 * align / distribute) lives entirely in the web shell (shells/web/src/views/
 * free-canvas.js) and only ever writes this flat array back through the normal
 * input path — so the engine, the URL, and the CLI never see the editor, and a
 * headless render of the same state produces identical artwork.
 *
 * This hook is PURE (no DOM, no async): Handlebars is logic-less, so it can't
 * divide opacity by 100 or map a shape to a border-radius. We precompute a CSS
 * string per box (boxStyle) and per text block (textStyle) and expose them as
 * extras the template applies via {{lookup boxStyle @index}}. Running here (not in
 * the template) means the CLI produces the same styles as the browser.
 */

function inputsFrom(model) {
  var o = {};
  (model || []).forEach(function (i) { o[i.id] = i.value; });
  return o;
}

function num(v, d) {
  var x = typeof v === 'number' ? v : parseFloat(v);
  return isFinite(x) ? x : d;
}
// === lolly:shared clamp — generated from community/_shared/math.js; edit there and run npm run sync:shared ===
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
// === /lolly:shared clamp ===

// Only let a value through if it's a shape CSS colour can't be smuggled past —
// box fill/text colour come from colour inputs, but a hand-edited URL could carry
// anything, and these land inside a style="" attribute, so guard against
// property-injection via a stray ';'.
// === lolly:shared safeColor — generated from community/_shared/math.js; edit there and run npm run sync:shared ===
function safeColor(v, fallback) {
  var s = String(v == null ? '' : v).trim();
  if (!s) return fallback;
  if (/^#[0-9a-fA-F]{3,8}$/.test(s)) return s;
  if (/^(rgb|rgba|hsl|hsla)\([0-9.,%\s/]+\)$/i.test(s)) return s;
  if (/^[a-zA-Z]+$/.test(s)) return s; // named colour (e.g. "transparent", "tomato")
  return fallback;
}
// === /lolly:shared safeColor ===

// Coerce a manifest/URL boolean (real boolean, or "true"/"1"/"on" string) to a
// boolean, falling back to `dflt` for empty/unknown values.
function boolVal(v, dflt) {
  if (v === true || v === false) return v;
  if (v == null || v === '') return dflt;
  var s = String(v).toLowerCase();
  if (s === 'true' || s === '1' || s === 'yes' || s === 'on') return true;
  if (s === 'false' || s === '0' || s === 'no' || s === 'off') return false;
  return dflt;
}

// Escape a string for safe inclusion in raw HTML output ({{{ }}} in the template).
// === lolly:shared esc — generated from community/_shared/text.js; edit there and run npm run sync:shared ===
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
// === /lolly:shared esc ===

// Inline emphasis on an ALREADY-escaped fragment: **bold** first, then *italic* /
// _italic_. The markers are literal chars in the escaped text and we only ever inject
// our own fixed <strong>/<em> tags, so this can't smuggle markup through.
// \* and \_ are literal-marker escapes (the WYSIWYG editor emits them for typed
// asterisks/underscores so "5 * 3 * 2" never italicises): park them in control
// chars while the emphasis regexes run, then restore the bare character.
function inlineMd(s) {
  s = s.replace(/\\\*/g, '\u0001').replace(/\\_/g, '\u0002');
  // Attribute runs: {#rrggbb|text}, {w600|text}, {mono|text}, {u|text}, {s|text}, or
  // any combination {#rrggbb w600 mono u|text}. The attrs are a space-separated list of
  // a validated colour (safeColor → only a real colour reaches style=""), a numeric
  // weight wNNN, a closed font token mono|sans, and/or the decoration flags u
  // (underline) / s (strikethrough); anything else leaves the {…|…} literal so ordinary
  // "{x|y}" copy is never swallowed. Only fixed, validated values reach style="" — no
  // token text is echoed — so this stays XSS-safe. The inner text still carries **/*,
  // handled just below. The vector export reads each run's computed colour, weight and
  // font-family (and draws underline/strike), so styled text outlines correctly.
  s = s.replace(/\{([^|{}]+)\|([^{}]*)\}/g, function (whole, attrs, inner) {
    var styles = [];
    var deco = [];
    var toks = attrs.trim().split(/\s+/);
    for (var i = 0; i < toks.length; i++) {
      var tok = toks[i];
      if (/^#[0-9a-fA-F]{3,8}$/.test(tok)) {
        var c = safeColor(tok, '');
        if (!c) return whole;
        styles.push('color:' + c);
      } else if (/^w[1-9]00$/.test(tok)) {
        styles.push('font-weight:' + tok.slice(1));
      } else if (tok === 'mono' || tok === 'sans') {
        styles.push('font-family:' + fontFamily(tok));
      } else if (tok === 'u') {
        deco.push('underline');
      } else if (tok === 's') {
        deco.push('line-through');
      } else {
        return whole;
      }
    }
    if (deco.length) styles.push('text-decoration:' + deco.join(' '));
    return styles.length ? '<span style="' + styles.join(';') + '">' + inner + '</span>' : whole;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  s = s.replace(/(^|[^_\w])_([^_\n]+)_/g, '$1<em>$2</em>');
  return s.replace(/\u0001/g, '*').replace(/\u0002/g, '_');
}

// Semi-rich text → safe HTML. Escape first, then a tiny markdown subset: **bold**,
// *italic*/_italic_, and lines starting with - / * / • become "•"-prefixed bullets.
// Newlines are preserved (styles.css sets white-space:pre-wrap). Emphasis is emitted
// as inline <strong>/<em>; the SVG/PDF vector walkers recurse into inline runs and
// outline each with its OWN computed weight/style, so bold/italic survive vector
// export too (not just raster). Bullets are plain "•" text, so they're trivially safe.
function richText(raw) {
  return esc(raw).split('\n').map(function (ln) {
    var mb = ln.match(/^(\s*)[-*•]\s+(.*)$/);
    if (mb) return mb[1] + '•  ' + inlineMd(mb[2]);
    // Ordered list: N. text (1-999) -> N.  text, numbers kept literal (like bullets).
    var mo = ln.match(/^(\s*)(\d{1,3})\.\s+(.*)$/);
    if (mo) return mo[1] + mo[2] + '.  ' + inlineMd(mo[3]);
    return inlineMd(ln);
  }).join('\n');
}

function radiusFor(shape, radius) {
  switch (shape) {
    case 'rounded': return Math.max(0, num(radius, 0)) + 'px';
    case 'pill': return '9999px';
    // A circle is an ellipse the editor keeps square (w === h); both round to 50%.
    case 'ellipse': case 'circle': return '50%';
    default: return '0';
  }
}

var H_JUSTIFY = { left: 'flex-start', center: 'center', right: 'flex-end' };
var V_ALIGN = { top: 'flex-start', middle: 'center', bottom: 'flex-end' };
// Any 100-step weight in the variable font's range. Sans stacks commonly cover
// 100–900; mono cuts rarely ship a Black, so cap mono at 800 — this keeps the
// browser render and the static-TTF vector export in agreement.
function weightOf(b) {
  var w = clamp(Math.round(num(b.weight, 700) / 100) * 100, 100, 900);
  if (/mono/i.test(String(b.font)) && w > 800) w = 800;
  return String(w);
}
// Text block font family. The sans stack leads with the brand font var (resolved
// on the canvas root when a brand sets it; the fallbacks keep headless/CLI renders
// identical without it). 'sans'/'mono' are closed keywords; any other value is a
// brand font family the user added to their kit (the font select's brandFonts
// option list), sanitised to safe chars before it reaches style="" so a family
// name can never inject CSS. Unknown/empty values fall back to sans.
var FONTS = {
  'mono': 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace)',
  'sans': "var(--font-brand, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif)",
};
function fontFamily(v) {
  var key = String(v);
  if (FONTS[key]) return FONTS[key];
  var safe = key.replace(/[^\w \-]/g, '').trim(); // letters/digits/space/hyphen only
  return safe ? ("'" + safe + "', " + FONTS.sans) : FONTS.sans;
}
var FITS = { cover: 1, contain: 1, fill: 1, none: 1, 'scale-down': 1 };
// Whitelisted CSS object-position anchors — the free-canvas 3×3 picker writes one of
// these. The value lands in a style="" attr, so (like safeColor) only known keywords
// pass. 'center' is the CSS default, so it's emitted as nothing to keep URLs terse.
// Picks which edge/corner a contain-fitted image sits against, or which part of a
// cover-cropped image stays in frame. The vector exporter reads the computed value, so
// SVG (preserveAspectRatio) and PDF honour the same anchor.
var OBJPOS = {
  center: 1, 'center top': 1, 'center bottom': 1, 'left center': 1, 'right center': 1,
  'left top': 1, 'right top': 1, 'left bottom': 1, 'right bottom': 1,
  top: 1, bottom: 1, left: 1, right: 1,
};
// CSS mix-blend-mode keywords. Faithful in raster (PNG/JPG/WebP) export; the vector
// walkers (SVG/PDF) don't honour blend, so it flattens there — documented.
var BLENDS = {
  multiply: 1, screen: 1, overlay: 1, darken: 1, lighten: 1, 'color-dodge': 1,
  'color-burn': 1, 'hard-light': 1, 'soft-light': 1, difference: 1, exclusion: 1,
  hue: 1, saturation: 1, color: 1, luminosity: 1,
};

function boxCss(b, grad) {
  var x = Math.round(num(b.x, 0));
  var y = Math.round(num(b.y, 0));
  var w = Math.max(1, Math.round(num(b.w, 1)));
  var h = Math.max(1, Math.round(num(b.h, 1)));
  var rot = num(b.rot, 0);
  var op = clamp(num(b.opacity, 100), 0, 100) / 100;
  // A path box's `bg` is the PATH's fill (see pathHtmlFor), so the div behind it
  // stays transparent — otherwise every pen shape would sit on an opaque rectangle
  // of its own fill colour.
  var fill = String(b.kind) === 'path' ? 'transparent' : safeColor(b.bg, 'transparent');
  var blend = BLENDS[String(b.blend)] ? String(b.blend) : '';
  var css =
    'left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px;' +
    (rot ? 'transform:rotate(' + (Math.round(rot * 10) / 10) + 'deg);' : '') +
    (op !== 1 ? 'opacity:' + op + ';' : '') +
    (blend ? 'mix-blend-mode:' + blend + ';' : '') +
    'background:' + fill + ';' +
    // AFTER the `background` shorthand, which resets background-image. The gradient
    // paints over the flat fill, so a spec with a translucent stop composites onto it.
    (grad ? 'background-image:' + grad + ';' : '') +
    // .lolly-box clips its children, which is right for an image or text but wrong for a
    // path box: the frame is the curve's tight bbox, so a stroke legitimately paints half
    // its width outside it (see pathHtmlFor's stroke pad) and the div would cut it off
    // again. Inline rather than in styles.css so the CLI and the export walkers, which read
    // this string, agree with the browser.
    (String(b.kind) === 'path' ? 'overflow:visible;' : '') +
    'border-radius:' + radiusFor(b.shape, b.radius) + ';' +
    'justify-content:' + (H_JUSTIFY[b.align] || 'center') + ';' +
    'align-items:' + (V_ALIGN[b.valign] || 'center') + ';';
  return css;
}

function imgCss(b) {
  var fit = FITS[String(b.fit)] ? String(b.fit) : 'contain';
  var pos = String(b.imgpos == null ? '' : b.imgpos).trim();
  return 'object-fit:' + fit + ';' +
    (OBJPOS[pos] && pos !== 'center' ? 'object-position:' + pos + ';' : '');
}

// A box's media element. When its image is a Lottie asset, emit the marker div the
// web shell's lottie-mount enhancer plays (data-lottie-src → live <svg>; still
// formats snapshot a frame, gif/webm/mp4 capture the motion) — otherwise a plain
// <img>. Empty when the box has no (resolved) image. Asset refs are resolved before
// this hook runs, so b.image carries .type + .url (same shape lottie-digi-ad reads).
// Pure/string-only, mirroring textHtml, so the CLI produces the same markup — the
// marker div is simply inert there (no browser enhancer). The url is esc()'d for
// parity with the {{asset image}} Handlebars escaping it replaces.
function mediaHtmlFor(b) {
  var img = b && b.image;
  var url = img && img.url ? String(img.url) : '';
  if (!url) return '';
  var isLottie = (img && img.type === 'lottie') || /\.json($|\?|#)/i.test(url);
  var isVideo = (img && img.type === 'video') || /\.(mp4|m4v|mov|webm)($|\?|#)/i.test(url);
  var style = imgCss(b);
  if (isLottie) {
    var fit = String(b.fit) === 'cover' ? 'cover' : 'contain';
    return '<div class="lolly-box-img lolly-box-lottie" data-lottie-src="' + esc(url) +
      '" data-lottie-loop="1" data-lottie-autoplay="1" data-lottie-fit="' + fit +
      '" style="' + style + '"></div>';
  }
  // A video box: a muted, looping, autoplaying <video> (muted + playsinline are
  // required for autoplay, incl. Tauri mobile WebViews). object-fit rides in `style`
  // just like the <img>. Still exports snapshot the current frame (export.js swaps
  // <video> → an <img> still). data-video-key (the box id) lets the shell's
  // video-mount enhancer restore playback position across per-paint rebuilds so the
  // clip doesn't restart at 0 on every edit. Pure string like the other branches, so
  // the CLI emits identical markup (the <video> is simply inert there).
  if (isVideo) {
    var vkey = b && b.id != null ? esc(String(b.id)) : esc(url);
    return '<video class="lolly-box-img lolly-box-video" src="' + esc(url) +
      '" data-video-key="' + vkey + '" muted loop autoplay playsinline style="' + style + '"></video>';
  }
  return '<img class="lolly-box-img" src="' + esc(url) + '" style="' + style + '" alt="" draggable="false">';
}

// ── vector path boxes ────────────────────────────────────────────────────────
//
// A `kind:'path'` box is a pen shape. Its geometry is NOT in this file: the box
// carries an AUTHORED path (nodes + handles + spline kind) in its `path` field,
// and the engine's geometry kernel — reached through host.geom, because tools may
// not import from the engine — decodes it and lowers it to cubics. That is what
// makes a pen shape render headlessly: a URL render, a CLI render and an export
// all run manifest -> inputs -> hooks -> template with no editor anywhere, so if
// the lowering lived in the overlay a shared link would arrive blank.
//
// Node coordinates are fractions of the BOX FRAME (see plans/pen-tool-and-vector-
// ops.md), so drag/resize/rotate act on a path box through x/y/w/h/rot exactly as
// they do on every other kind, without rewriting a node. They are mapped into
// box-local PIXELS here, before the lowering, for two reasons: the spline then
// solves in the same frame it is drawn in (so what the pen tool previews is what
// exports), and the emitted <svg> can carry a 1:1 viewBox. The alternative — a
// viewBox of "0 0 1 1" with preserveAspectRatio="none" — would scale the stroke
// non-uniformly with the box and leans on export-walker behaviour we don't rely on.

var FILL_RULES = { nonzero: 1, evenodd: 1 };
// Stroke decoration whitelists. Every one of these reaches an ATTRIBUTE VALUE in markup
// emitted through {{{ }}}, so a value is only ever a key of one of these maps — never the
// user's string with escaping applied on top, which would still let `stroke-dasharray`
// carry arbitrary numbers (and `NaN`) into the renderer.
var LINE_CAPS = { butt: 1, round: 1, square: 1 };
var LINE_JOINS = { miter: 1, round: 1, bevel: 1 };
var DASH_STYLES = { dashed: 1, dotted: 1 };
// Emitted explicitly with a miter join rather than left to each renderer's default (SVG
// says 4, PDF says 10), so the stroke pad below can bound the spike from a known number.
var MITER_LIMIT = 4;

// host.geom is OPTIONAL and additive (HostV1 v1.64), so feature-detect it the way
// the shipped tools feature-detect host.color — never assume, never throw.
function geomApi() {
  return typeof host !== 'undefined' && host && host.geom ? host.geom : null;
}

// Report through host.log, never by throwing: onInit/onInput errors are caught and
// DISCARDED by the runtime, so a throw here would make a path box vanish with
// nothing anywhere to say why.
function pathWarn(msg) {
  try {
    if (typeof host !== 'undefined' && host && host.log) host.log('warn', 'layout-studio: ' + msg);
  } catch (e) { /* a host without log is still a host */ }
}

// A box's GRADIENT fill as CSS, or '' for none.
//
// The value stored on the box is a Lolly gradient spec (`lin_90_30ba78-0_efefef-100`)
// — a terse string, because it has to survive the same round trip every other field
// does (editor → block row → shared URL → CLI). The engine turns it into a CSS
// gradient with its stops interpolated in OKLab and BAKED down to plain sRGB stops
// (host.color.gradientCss, HostV1 v1.68): a two-stop brand gradient that would look
// muddy through the middle in sRGB comes back with the intermediate stops that keep
// it clean, and because they are ordinary sRGB stops the SVG and PDF walkers render
// the identical thing (neither can read `linear-gradient(in oklab, …)`).
//
// OPTIONAL bridge method, so feature-detect exactly like geomApi above: on an older
// engine a gradient box degrades to its flat `bg` fill rather than throwing. And
// note what is NOT here — b.grad never reaches the style attribute itself. Only the
// engine's output does, which is hex stops and percentages by construction.
function gradCssFor(b) {
  // A path box's `bg` is the PATH's fill, not the div's (see pathHtmlFor), so a
  // gradient on it would paint a rectangle behind the curve. Shapes only for now.
  if (!b || String(b.kind) === 'path') return '';
  var spec = b.grad == null ? '' : String(b.grad).trim();
  if (!spec) return '';
  var api = typeof host !== 'undefined' && host && host.color ? host.color : null;
  if (!api || typeof api.gradientCss !== 'function') return '';
  try {
    return api.gradientCss(spec) || '';
  } catch (e) {
    pathWarn('gradient spec could not be rendered: ' + spec);
    return '';
  }
}

// The honest degrade: a dashed outline of the box frame. A path we cannot draw is
// still a box the user placed, and an invisible element is the one answer that
// can't be acted on — this one says "there is a shape here and it did not draw",
// keeps the element selectable in the editor, and carries no geometry it made up.
// currentColor + fixed numbers, so nothing from the box can reach the markup.
function pathPlaceholder(w, h, why) {
  pathWarn(why);
  var d = 'M.75 .75H' + (w - 0.75) + 'V' + (h - 0.75) + 'H.75Z';
  return '<svg class="lolly-box-path lolly-box-path-undrawn" width="' + w + '" height="' + h +
    '" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" aria-hidden="true">' +
    '<path d="' + d + '" fill="none" stroke="currentColor" stroke-width="1.5"' +
    ' stroke-dasharray="6 4" opacity="0.45"></path></svg>';
}

// Stroke style -> an SVG dash array, in the same user units as stroke-width. The style is
// a KEYWORD (solid/dashed/dotted), not an authored array, and the pattern is derived from
// the stroke width, for three reasons: a keyword is whitelist-checkable so nothing the user
// types reaches the attribute; the dashes keep their proportions when the width or the box
// changes; and the compact blocks URL form cannot carry a comma or a tilde at all
// (encodeBlocksCompact refuses the whole compact string), so an authored "8, 4" would push
// every layout-studio link onto the lossless JSON fallback.
//
// Solid returns '' — no attribute at all, which is what keeps an existing shape's markup
// byte-identical to what it was before this field existed.
function dashArrayFor(style, w, cap) {
  if (!DASH_STYLES[style] || !(w > 0)) return '';
  if (style === 'dotted') {
    // A round or square cap already paints a full w across the line, so the dot is a
    // ZERO-length dash and the gap is the whole period. A flat (butt) cap paints nothing
    // at zero length, so it needs a real w-long dash — which is a square dot, correctly.
    return cap === 'butt' ? f2(w) + ' ' + f2(w) : '0 ' + f2(w * 2);
  }
  return f2(w * 3) + ' ' + f2(w * 2);
}

// A path box's inline <svg>, or '' for every other kind. Pure/string-only like
// mediaHtmlFor, so the CLI emits identical markup.
function pathHtmlFor(b) {
  if (String(b.kind) !== 'path') return '';
  var w = Math.max(1, Math.round(num(b.w, 1)));
  var h = Math.max(1, Math.round(num(b.h, 1)));
  var raw = b.path == null ? '' : String(b.path);
  // Nothing authored yet (a freshly added box, or a cleared field). Not an error:
  // there is no shape, so there is nothing to draw and nothing to warn about.
  if (!raw) return '';

  var geom = geomApi();
  if (!geom || !geom.decodeAuthored || !geom.fromNodes) {
    return pathPlaceholder(w, h, 'host.geom is unavailable, so a path box cannot be drawn (needs engine >= 1.64)');
  }
  var dec = geom.decodeAuthored(raw);
  if (!dec || !dec.ok) {
    return pathPlaceholder(w, h, 'path box: ' + ((dec && dec.message) || 'unreadable path field'));
  }
  // A value carries a LIST of contours, always — one for a pen-drawn shape, several
  // when a boolean punched a hole or split the shape into loops. Every contour is
  // lowered on its own and the subpaths are concatenated into ONE `d`, which is what
  // makes the hole a hole: fill-rule is a property of a path, so two <path>s can
  // never subtract, and one <path> with two subpaths does it for free.
  var srcs = dec.value;
  var ds = [];
  for (var pi = 0; pi < srcs.length; pi++) {
    var src = srcs[pi];
    var nodes = [];
    for (var i = 0; i < src.nodes.length; i++) {
      var n = src.nodes[i];
      var out = { x: n.x * w, y: n.y * h };
      if (n.hInX != null) out.hInX = n.hInX * w;
      if (n.hInY != null) out.hInY = n.hInY * h;
      if (n.hOutX != null) out.hOutX = n.hOutX * w;
      if (n.hOutY != null) out.hOutY = n.hOutY * h;
      if (n.continuity) out.continuity = n.continuity;
      nodes.push(out);
    }
    var res = geom.fromNodes({
      kind: src.kind, nodes: nodes, closed: src.closed === true,
      tension: src.tension, decimals: 3,
    });
    if (!res || !res.ok) {
      return pathPlaceholder(w, h, 'path box: ' + ((res && res.code) || 'error') + ' — ' + ((res && res.message) || 'could not lower the path'));
    }
    // ok with no geometry is an ANSWER, not a failure (fewer than two nodes lowers to
    // no curves), so an empty contour is skipped rather than treated as a refusal.
    if (res.d) ds.push(res.d);
  }
  // Nothing to draw at all: emit nothing rather than a placeholder crying wolf.
  if (!ds.length) return '';
  var d = ds.join(' ');

  // `bg` is the path's FILL for a path box (boxCss keeps the div transparent so the
  // shape is the only thing painted). Empty fill means an unfilled outline, which is
  // what a stroked pen path wants, so it maps to 'none' rather than to a colour.
  var fill = b.bg == null || String(b.bg).trim() === '' ? 'none' : safeColor(b.bg, 'none');
  var stroke = b.stroke == null || String(b.stroke).trim() === '' ? '' : safeColor(b.stroke, '');
  var sw = clamp(num(b.strokeW, 0), 0, 400);
  var rule = FILL_RULES[String(b.fillRule)] ? String(b.fillRule) : 'nonzero';
  // Stroke decoration. Every one defaults to what this hook used to hard-code, so an
  // existing shape's markup is unchanged: round cap, round join, no dash array.
  var cap = LINE_CAPS[String(b.strokeCap)] ? String(b.strokeCap) : 'round';
  var join = LINE_JOINS[String(b.strokeJoin)] ? String(b.strokeJoin) : 'round';
  var dash = dashArrayFor(String(b.strokeDash == null ? '' : b.strokeDash), sw, cap);

  // The STROKE PAD. The frame is the curve's tight bounding box (the pen tool refits it to
  // exactly that), so a stroke straddles the frame edge and half of it falls outside — and
  // an outer <svg> clips to its viewport, so without a pad every stroked pen shape loses
  // half its outline all the way round. `overflow: visible` is NOT the fix: this markup is
  // read by three renderers (the browser, the SVG export walker, the PDF walker) and a
  // nested <svg> clips by default in SVG output too, so the geometry is made explicit
  // instead — the element is grown by `pad` on every side and offset by −pad, and the
  // viewBox is shifted to match, which leaves path coordinates mapping to 0..w / 0..h
  // exactly as before. A round cap and a round join both reach exactly half the stroke
  // width, so sw / 2 is sufficient for the defaults; the two decorations that reach FURTHER
  // size the pad up for themselves, because a pad that is merely usually right is a clipped
  // outline the user cannot explain:
  //   - a SQUARE cap's corner sits at sw/2 along the tangent AND sw/2 across it, i.e.
  //     sw/2·√2 from the endpoint;
  //   - a MITER join's spike is bounded by stroke-miterlimit · sw/2, and the limit is
  //     emitted explicitly below (4, SVG's default) precisely so this bound is a fact
  //     rather than a per-renderer default — PDF's own default is 10.
  //
  // The inline geometry also has to override styles.css's `inset: 0; width/height: 100%`,
  // which would otherwise pull the element back to the frame — hence `inset:auto` first.
  var reach = Math.max(cap === 'square' ? Math.SQRT2 / 2 : 0.5, join === 'miter' ? MITER_LIMIT / 2 : 0.5);
  var pad = stroke && sw > 0 ? sw * reach : 0;
  var vw = f2(w + pad * 2), vh = f2(h + pad * 2), o = f2(-pad);
  // Everything interpolated is esc()'d even though each value is already reduced to a
  // validated colour, a whitelisted keyword or a number: the extra is emitted through
  // {{{ }}}, which bypasses Handlebars' escaping, so the escape has to happen here.
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
    '></path></svg>';
}

function rot2(px, py, deg) {
  var r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
  return [px * c - py * s, px * s + py * c];
}
function f2(v) { return Math.round(v * 100) / 100; }

// Clip a box to ANOTHER box's silhouette (a clip-path mask). Expresses the mask
// box's shape in THIS box's unrotated local coordinate space (clip-path is applied
// pre-transform), so it stays correct when either box is rotated. Rect/rounded/pill
// masks use the 4 corners (rounding approximated as square); ellipse is sampled.
// Faithful in raster + SVG export (the SVG walker reads this polygon); PDF flattens.
function clipCss(b, byId) {
  var maskId = b.clip != null ? String(b.clip) : '';
  var selfId = b.id != null ? String(b.id) : '';
  if (!maskId || maskId === selfId) return '';
  var m = byId[maskId];
  if (!m) return '';
  var bw = Math.max(1, num(b.w, 1)), bh = Math.max(1, num(b.h, 1));
  var bcx = num(b.x, 0) + bw / 2, bcy = num(b.y, 0) + bh / 2, brot = num(b.rot, 0);
  var mw = Math.max(1, num(m.w, 1)), mh = Math.max(1, num(m.h, 1));
  var mcx = num(m.x, 0) + mw / 2, mcy = num(m.y, 0) + mh / 2, mrot = num(m.rot, 0);
  var world = [];
  if (String(m.shape) === 'ellipse' || String(m.shape) === 'circle') {
    for (var i = 0; i < 48; i++) {
      var t = i / 48 * 2 * Math.PI, w = rot2(Math.cos(t) * mw / 2, Math.sin(t) * mh / 2, mrot);
      world.push([mcx + w[0], mcy + w[1]]);
    }
  } else {
    var cs = [[-mw / 2, -mh / 2], [mw / 2, -mh / 2], [mw / 2, mh / 2], [-mw / 2, mh / 2]];
    for (var j = 0; j < 4; j++) { var w2 = rot2(cs[j][0], cs[j][1], mrot); world.push([mcx + w2[0], mcy + w2[1]]); }
  }
  var poly = world.map(function (p) {
    var lc = rot2(p[0] - bcx, p[1] - bcy, -brot);
    return f2(lc[0] + bw / 2) + 'px ' + f2(lc[1] + bh / 2) + 'px';
  }).join(',');
  return 'clip-path:polygon(' + poly + ');';
}

// Drop shadow. The `shadow` field picks WHAT the shadow follows, which decides the
// CSS property: 'box' → box-shadow (the box outline / radius), 'text' → text-shadow
// (on the text run), 'content' → filter:drop-shadow (the visible alpha silhouette,
// e.g. a transparent PNG / icon). Returns the fragments for each target element.
// Raster-faithful (PNG/JPG/WebP); the SVG/PDF vector walkers don't model shadows, so
// they flatten there — same caveat as blend modes.
var SHADOW_TARGETS = { box: 1, text: 1, content: 1 };
function shadowCss(b) {
  var tgt = String(b.shadow || 'none');
  if (!SHADOW_TARGETS[tgt]) return { box: '', text: '', filter: '' };
  var col = safeColor(b.shadowColor, '#00000055');
  var x = Math.round(clamp(num(b.shadowX, 0), -300, 300));
  var y = Math.round(clamp(num(b.shadowY, 0), -300, 300));
  var bl = Math.round(clamp(num(b.shadowBlur, 10), 0, 300));
  var off = x + 'px ' + y + 'px ' + bl + 'px ';
  if (tgt === 'text') return { box: '', text: 'text-shadow:' + off + col + ';', filter: '' };
  if (tgt === 'box') return { box: 'box-shadow:' + off + col + ';', text: '', filter: '' };
  return { box: '', text: '', filter: 'filter:drop-shadow(' + off + col + ');' };
}

// Uniform letter-spacing ("kerning" in the UI) in px, and OpenType feature toggles:
// ligatures default ON (off → disable liga/clig), stylistic alternates default OFF
// (on → salt). Expressed through font-feature-settings ONLY (one property) so the
// browser render and the vector exporter — which reads the computed feature string
// and re-shapes via HarfBuzz — stay in agreement.
function typeFeatureCss(b) {
  var track = clamp(num(b.tracking, 0), -100, 400);
  var ligOff = !boolVal(b.ligatures, true);
  var altOn = boolVal(b.alternates, false);
  var feat = [];
  if (ligOff) feat.push('"liga" 0', '"clig" 0');
  if (altOn) feat.push('"salt" 1');
  return (
    (track ? 'letter-spacing:' + f2(track) + 'px;' : '') +
    (feat.length ? 'font-feature-settings:' + feat.join(', ') + ';' : '')
  );
}

function textCss(b) {
  var size = Math.max(1, Math.round(num(b.fontSize, 48)));
  var weight = weightOf(b);
  var align = H_JUSTIFY[b.align] ? b.align : 'center';
  // Inner padding between the box edge and the text (all sides). Clamped so a
  // hand-edited URL can't push text absurdly far or negative.
  var pad = Math.round(clamp(num(b.pad, 8), 0, 400));
  return (
    'text-align:' + align + ';' +
    'color:' + safeColor(b.fg, '#0e1217') + ';' +
    'font-family:' + fontFamily(b.font) + ';' +
    // The authored size, multiplied by --fit (default 1, so this is inert unless the
    // box opted into shrink-to-fit). The fit pass in template.html measures the laid-out
    // text and writes ONE unitless --fit onto the box; a ratio is right at any canvas
    // scale (the stage previews small, the export scales the same DOM up). See boxFit.
    'font-size:calc(' + size + 'px * var(--fit, 1));' +
    'font-weight:' + weight + ';' +
    'line-height:' + clamp(num(b.lineHeight, 1.12), 0.5, 4) + ';' +
    'padding:' + pad + 'px;' +
    typeFeatureCss(b)
  );
}

// ── time model (phase 1: inert data only — no panel mounts this yet) ───────────
//
// Enter/exit transition keywords, mirroring record's tool.json transition options
// exactly. A hostile enum value (e.g. from a hand-edited URL) must never reach an
// HTML attribute unescaped, so timeAttrsFor only ever emits a value that's a member
// of this whitelist or a clamped number — never raw user text.
var TRANSITIONS = {
  fade: 1, pop: 1, grow: 1, rise: 1, drop: 1, 'slide-left': 1, 'slide-right': 1,
  'slide-up': 1, 'slide-down': 1, 'zoom-in': 1, 'zoom-out': 1, tilt: 1, swoop: 1,
  spin: 1, drift: 1, none: 1,
};

// Is `v` a value that parses to a finite number at all (as opposed to num()'s
// "finite, or fall back to a default")? Distinguishes "authored 0" from "empty" —
// start:"" means scenery (never timed), start:0 means "enters at the top".
function isFiniteNum(v) {
  if (v == null || v === '') return false;
  var x = typeof v === 'number' ? v : parseFloat(v);
  return isFinite(x);
}

// Ceiling (seconds) for every authored time value. An hour is far past anything a
// layout document should hold, and clamping EVERY time field to it — start included
// — keeps the emitted attribute a plain integer: 1e308 * 1000 is Infinity, and
// anything from 1e21 up stringifies exponentially ("1e+24"), both of which a
// parseInt on the phase-2 side would read as NaN / 1.
var MAX_TIME_S = 3600;

// Is `v` one of the whitelisted transition keywords? An own-property test, not the
// bare `TRANSITIONS[v]` truthiness check — every object literal inherits truthy
// `constructor` / `__proto__` / `toString` / `valueOf` from Object.prototype, so a
// hand-authored URL could otherwise smuggle any of those through as a "transition".
// The typeof guard also stops an object-valued field (?boxes= accepts raw JSON) from
// throwing on property-key coercion and aborting the whole compute().
function isTransition(v) {
  return typeof v === 'string' && v !== 'none'
    && Object.prototype.hasOwnProperty.call(TRANSITIONS, v);
}

// A box's start offset in seconds, clamped into range. One definition so the
// attribute and the derived sequence length can never disagree.
function startSeconds(b) {
  return clamp(num(b.start, 0), 0, MAX_TIME_S);
}

// A box's time attributes, or '' for scenery (a box with no lane/start authored).
// Pure; every value lands in an HTML attribute via {{{ }}}, so every emitted value
// is either a clamped NUMBER or a whitelisted enum token — never raw user text.
// Each attribute string starts with a leading space so concatenation into a tag is
// safe with no manual separator bookkeeping.
function timeAttrsFor(b) {
  if (b.lane !== 'seq' && !isFiniteNum(b.start)) return ''; // scenery
  var parts = [];
  parts.push(' data-t-start="' + Math.round(startSeconds(b) * 1000) + '"');
  if (isFiniteNum(b.dur)) {
    parts.push(' data-t-dur="' + Math.round(clamp(num(b.dur, 0), 0.1, MAX_TIME_S) * 1000) + '"');
  }
  if (num(b.clipIn, 0) > 0) {
    parts.push(' data-clip-in="' + Math.round(clamp(num(b.clipIn, 0), 0, MAX_TIME_S) * 1000) + '"');
  }
  // f2 so an accumulated slider value (0.30000000000000004) doesn't leak float noise
  // into the attribute; re-test against 1 AFTER rounding so a no-op speed stays absent.
  var speed = f2(clamp(num(b.speed, 1), 0.25, 4));
  if (speed !== 1) {
    parts.push(' data-t-speed="' + speed + '"');
  }
  if (isTransition(b.enter)) {
    parts.push(' data-t-enter="' + b.enter + '" data-t-enter-ms="' + Math.round(clamp(num(b.enterMs, 400), 100, 3000)) + '"');
  }
  if (isTransition(b.exit)) {
    parts.push(' data-t-exit="' + b.exit + '" data-t-exit-ms="' + Math.round(clamp(num(b.exitMs, 400), 100, 3000)) + '"');
  }
  if (boolVal(b.mute, false)) parts.push(' data-t-mute="1"');
  if (b.lane === 'seq') parts.push(' data-t-lane="seq"');
  return parts.join('');
}

var DEFAULT_SEQ_S = 5; // no box has an authored duration, but something is timed

// The sequence's total derived length in ms — single source of truth, reused
// verbatim by the phase-2 timeline panel. `dur` is TIMELINE seconds (the author's
// own trim, already reflecting any speed change), so it is never multiplied by
// speed here. Open-ended boxes (no dur authored) extend to fill this length.
function seqDurationMs(boxes) {
  var timedBoxes = boxes.filter(function (b) { return b && (b.lane === 'seq' || isFiniteNum(b.start)); });
  var withDur = timedBoxes.filter(function (b) { return isFiniteNum(b.dur); });
  if (withDur.length) {
    var max = 0;
    withDur.forEach(function (b) {
      var end = (startSeconds(b) + clamp(num(b.dur, 0), 0.1, MAX_TIME_S)) * 1000;
      if (end > max) max = end;
    });
    return Math.round(max);
  }
  return timedBoxes.length ? DEFAULT_SEQ_S * 1000 : 0;
}

function compute(model) {
  var inp = inputsFrom(model);
  var boxes = Array.isArray(inp.boxes) ? inp.boxes : [];
  var transparent = inp.transparentBg === true;
  var byId = {};
  boxes.forEach(function (b) { if (b && b.id != null && b.id !== '') byId[String(b.id)] = b; });
  var shadows = boxes.map(function (b) { return shadowCss(b || {}); });
  var boxStyle = boxes.map(function (b, i) {
    return boxCss(b || {}, gradCssFor(b || {})) + clipCss(b || {}, byId) + shadows[i].box + shadows[i].filter;
  });
  var textStyle = boxes.map(function (b, i) { return textCss(b || {}) + shadows[i].text; });
  var textHtml = boxes.map(function (b) { return richText((b && b.text) || ''); });
  var mediaHtml = boxes.map(function (b) { return mediaHtmlFor(b || {}); });
  var pathHtml = boxes.map(function (b) { return pathHtmlFor(b || {}); });
  // Which boxes opted into shrink-to-fit ("1" marks a fit root for the template's fit
  // pass; "" is ignored). Off by default so grow-to-fit (the editor's box-grows-to-text
  // behaviour) stays the norm; a box turns this on to instead shrink the text to a fixed box.
  var boxFit = boxes.map(function (b) { return boolVal(b && b.fitText, false) ? '1' : ''; });
  // Time model (phase 1 — inert data; nothing reads these attributes yet, the
  // phase-2 panel does). timeAttrs is index-aligned with boxStyle/boxFit/etc.
  var timeAttrs = boxes.map(function (b) { return timeAttrsFor(b || {}); });
  var seqMs = seqDurationMs(boxes);
  var seqAttrs = [seqMs > 0 ? ' data-sequence data-seq-ms="' + seqMs + '"' : ''];
  return {
    boxStyle: boxStyle,
    textStyle: textStyle,
    textHtml: textHtml,
    mediaHtml: mediaHtml,
    pathHtml: pathHtml,
    boxFit: boxFit,
    timeAttrs: timeAttrs,
    seqAttrs: seqAttrs,
    bgStyle: [transparent ? 'transparent' : safeColor(inp.background, '#ffffff')],
  };
}

function onInit(ctx) { return compute(ctx.model); }
function onInput(ctx) { return compute(ctx.model); }

// The export bar's "No BG" toggle (render.transparentBg) makes the raster export
// alpha; the live artboard already reflects it via compute() above.
function beforeExport(ctx) {
  var inp = inputsFrom(ctx.model);
  if (inp.transparentBg === true) ctx.opts.background = 'transparent';
}
