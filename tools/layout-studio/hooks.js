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
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

// Only let a value through if it's a shape CSS colour can't be smuggled past —
// box fill/text colour come from colour inputs, but a hand-edited URL could carry
// anything, and these land inside a style="" attribute, so guard against
// property-injection via a stray ';'.
function safeColor(v, fallback) {
  var s = String(v == null ? '' : v).trim();
  if (!s) return fallback;
  if (/^#[0-9a-fA-F]{3,8}$/.test(s)) return s;
  if (/^(rgb|rgba|hsl|hsla)\([0-9.,%\s/]+\)$/i.test(s)) return s;
  if (/^[a-zA-Z]+$/.test(s)) return s; // named colour (e.g. "transparent", "tomato")
  return fallback;
}

// Escape a string for safe inclusion in raw HTML output ({{{ }}} in the template).
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Inline emphasis on an ALREADY-escaped fragment: **bold** first, then *italic* /
// _italic_. The markers are literal chars in the escaped text and we only ever inject
// our own fixed <strong>/<em> tags, so this can't smuggle markup through.
// \* and \_ are literal-marker escapes (the WYSIWYG editor emits them for typed
// asterisks/underscores so "5 * 3 * 2" never italicises): park them in control
// chars while the emphasis regexes run, then restore the bare character.
function inlineMd(s) {
  s = s.replace(/\\\*/g, '\u0001').replace(/\\_/g, '\u0002');
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
    var m = ln.match(/^(\s*)[-*•]\s+(.*)$/);
    return m ? m[1] + '•  ' + inlineMd(m[2]) : inlineMd(ln);
  }).join('\n');
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
// Any 100-step weight in the variable font's range. SUSE Sans covers 100–900;
// SUSE Mono has no Black cut (its axis tops out at 800), so cap it there — this
// keeps the browser render and the static-TTF vector export in agreement.
function weightOf(b) {
  var w = clamp(Math.round(num(b.weight, 700) / 100) * 100, 100, 900);
  if (String(b.font) === 'SUSE Mono' && w > 800) w = 800;
  return String(w);
}
// Text block font family. Single-quoted so it survives inside a style="" attribute
// without HTML-escaping. Unknown values fall back to SUSE (no CSS injection).
var FONTS = {
  'SUSE Mono': "'SUSE Mono', ui-monospace, SFMono-Regular, monospace",
  'SUSE': "'SUSE', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
};
function fontFamily(v) { return FONTS[String(v)] || FONTS.SUSE; }
var FITS = { cover: 1, contain: 1, fill: 1, none: 1, 'scale-down': 1 };
// CSS mix-blend-mode keywords. Faithful in raster (PNG/JPG/WebP) export; the vector
// walkers (SVG/PDF) don't honour blend, so it flattens there — documented.
var BLENDS = {
  multiply: 1, screen: 1, overlay: 1, darken: 1, lighten: 1, 'color-dodge': 1,
  'color-burn': 1, 'hard-light': 1, 'soft-light': 1, difference: 1, exclusion: 1,
  hue: 1, saturation: 1, color: 1, luminosity: 1,
};

function boxCss(b) {
  var x = Math.round(num(b.x, 0));
  var y = Math.round(num(b.y, 0));
  var w = Math.max(1, Math.round(num(b.w, 1)));
  var h = Math.max(1, Math.round(num(b.h, 1)));
  var rot = num(b.rot, 0);
  var op = clamp(num(b.opacity, 100), 0, 100) / 100;
  var fill = safeColor(b.bg, 'transparent');
  var blend = BLENDS[String(b.blend)] ? String(b.blend) : '';
  var css =
    'left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px;' +
    (rot ? 'transform:rotate(' + (Math.round(rot * 10) / 10) + 'deg);' : '') +
    (op !== 1 ? 'opacity:' + op + ';' : '') +
    (blend ? 'mix-blend-mode:' + blend + ';' : '') +
    'background:' + fill + ';' +
    'border-radius:' + radiusFor(b.shape, b.radius) + ';' +
    'justify-content:' + (H_JUSTIFY[b.align] || 'center') + ';' +
    'align-items:' + (V_ALIGN[b.valign] || 'center') + ';';
  return css;
}

function imgCss(b) {
  var fit = FITS[String(b.fit)] ? String(b.fit) : 'contain';
  return 'object-fit:' + fit + ';';
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
  if (String(m.shape) === 'ellipse') {
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

function textCss(b) {
  var size = Math.max(1, Math.round(num(b.fontSize, 48)));
  var weight = weightOf(b);
  var align = H_JUSTIFY[b.align] ? b.align : 'center';
  // Inner padding between the box edge and the text (all sides). Clamped so a
  // hand-edited URL can't push text absurdly far or negative.
  var pad = Math.round(clamp(num(b.pad, 8), 0, 400));
  return (
    'text-align:' + align + ';' +
    'color:' + safeColor(b.fg, '#0c322c') + ';' +
    'font-family:' + fontFamily(b.font) + ';' +
    'font-size:' + size + 'px;' +
    'font-weight:' + weight + ';' +
    'line-height:' + clamp(num(b.lineHeight, 1.12), 0.5, 4) + ';' +
    'padding:' + pad + 'px;'
  );
}

function compute(model) {
  var inp = inputsFrom(model);
  var boxes = Array.isArray(inp.boxes) ? inp.boxes : [];
  var transparent = inp.transparentBg === true;
  var byId = {};
  boxes.forEach(function (b) { if (b && b.id != null && b.id !== '') byId[String(b.id)] = b; });
  var shadows = boxes.map(function (b) { return shadowCss(b || {}); });
  var boxStyle = boxes.map(function (b, i) { return boxCss(b || {}) + clipCss(b || {}, byId) + shadows[i].box + shadows[i].filter; });
  var textStyle = boxes.map(function (b, i) { return textCss(b || {}) + shadows[i].text; });
  var textHtml = boxes.map(function (b) { return richText((b && b.text) || ''); });
  var imgStyle = boxes.map(function (b) { return imgCss(b || {}); });
  return {
    boxStyle: boxStyle,
    textStyle: textStyle,
    textHtml: textHtml,
    imgStyle: imgStyle,
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
