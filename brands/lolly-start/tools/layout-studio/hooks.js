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

// JSON safe to drop verbatim into <script type="application/json">: kill the only
// tag-closing sequence ("</script") by escaping '<', plus the two JS line
// terminators U+2028/U+2029. esc() above is HTML-escaping and would corrupt the
// JSON (e.g. turn `"` into `&quot;`), so the deck model is serialised through THIS,
// exactly like deck-studio's own safeJson. (plan 95 route-a native-pptx emit.)
function safeJson(o) {
  return JSON.stringify(o).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

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
// The deck-model equivalents (plan 95 route-a): a box's horizontal align → a deck
// paragraph align token, its vertical align → a deck text-box anchor. Same keys as
// the CSS maps above so the native pptx text box lands where the canvas paints it.
var DECK_ALIGN = { left: 'l', center: 'ctr', right: 'r' };
var DECK_ANCHOR = { top: 't', middle: 'ctr', bottom: 'b' };
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
  // Own-property, not bare truthiness — the SHADOW_TARGETS rule, applied to every enum
  // whitelist in this file: `font=constructor` from a hand-edited URL would otherwise
  // return Object and emit its source text as a font-family.
  if (Object.prototype.hasOwnProperty.call(FONTS, key)) return FONTS[key];
  var safe = key.replace(/[^\w \-]/g, '').trim(); // letters/digits/space/hyphen only
  return safe ? ("'" + safe + "', " + FONTS.sans) : FONTS.sans;
}
// A box font → a PLAIN PowerPoint typeface NAME for the deck model (NOT fontFamily's
// CSS stack, which is a var()/fallback list unusable as a pptx font). The built-in
// 'sans'/'mono' keywords resolve to CSS custom properties with no single static face
// name in the blank profile, so they are OMITTED (undefined) — the deck theme's minor
// font then applies. A brand family the user added carries a real name; sanitise it
// exactly as fontFamily() does before it reaches the pptx run.
function deckFont(b) {
  var key = String(b && b.font == null ? '' : b.font);
  if (key === '' || key === 'sans' || key === 'mono') return undefined;
  var safe = key.replace(/[^\w \-]/g, '').trim();
  return safe || undefined;
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

// ONE answer to "is this box audio?", shared by every place that has to leave no mark
// on the frame: the fill (boxCss), the shadow/clip/blur (compute), the text (compute)
// and the media element (mediaHtmlFor). Mirrors sequence-studio's predicate verbatim so
// Design and Sequence Studio decide identically. A box is audio when it SAYS so
// (kind:'audio' — what the Audio add-kind seeds and what the shell's timeline compositor
// keys its waveform lane off), or when the asset it carries is audio by type/extension.
// Both, because a catalog ref's url is an opaque `asset:`/blob id with no extension and a
// resolver may not fill in .type, so the kind is the only reliable signal for a library
// track — while the extension test still catches an audio file dropped onto an ordinary box.
function isAudioBox(b) {
  if (!b) return false;
  if (String(b.kind) === 'audio') return true;
  var img = b.image;
  if (!img) return false;
  if (img.type === 'audio') return true;
  var re = /\.(mp3|wav|ogg|m4a|flac)($|\?|#)/i;
  return re.test(String(img.url == null ? '' : img.url)) || re.test(String(img.id == null ? '' : img.id));
}

// plan 104 §5.4 — "is this box a camera?". A camera is a non-visual TIMELINE citizen
// like an audio bed: it carries the scene's pose (its own `kf` track and `z`) and paints
// nothing at all. Keyed off `kind` ALONE, unlike isAudioBox: no asset can imply a camera,
// so there is no second signal to reconcile — a box is a camera because the Camera
// add-kind seeded it (or a hand-edited URL says so).
function isCameraBox(b) {
  return !!b && String(b.kind) === 'camera';
}

// The boxes that leave NO MARK on the frame: an audio bed and a camera marker. One
// predicate so every "paints nothing" site (fill, gradient, clip, blur, shadow, text)
// stays in one vocabulary and a new bare kind is added in exactly one place.
function isBareBox(b) {
  return isAudioBox(b) || isCameraBox(b);
}

function boxCss(b, grad) {
  var x = Math.round(num(b.x, 0));
  var y = Math.round(num(b.y, 0));
  var w = Math.max(1, Math.round(num(b.w, 1)));
  var h = Math.max(1, Math.round(num(b.h, 1)));
  var rot = num(b.rot, 0);
  var op = clamp(num(b.opacity, 100), 0, 100) / 100;
  // A path box's `bg` is the PATH's fill (see pathHtmlFor), so the div behind it
  // stays transparent — otherwise every pen shape would sit on an opaque rectangle
  // of its own fill colour. An audio box or a camera marker paints nothing at all (see
  // mediaHtmlFor), so their fill is dropped for the same reason: they must leave no mark
  // on the frame.
  var bare = isBareBox(b);
  var fill = (String(b.kind) === 'path' || bare) ? 'transparent' : safeColor(b.bg, 'transparent');
  var blend = Object.prototype.hasOwnProperty.call(BLENDS, String(b.blend)) ? String(b.blend) : '';
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
  // Stroke on a non-path box → a CSS border. box-sizing is border-box, so this is
  // an INSIDE stroke; the design importer pre-inflates center/outer-aligned rects
  // so the painted edge lands where the source authored it. Path boxes stroke the
  // SVG path itself (pathHtmlFor), never the div.
  var sw = num(b.strokeW, 0);
  var sc = safeColor(b.stroke, '');
  if (String(b.kind) !== 'path' && !bare && sc && sw > 0) {
    var dash = String(b.strokeDash) === 'dashed' ? 'dashed' : String(b.strokeDash) === 'dotted' ? 'dotted' : 'solid';
    css += 'border:' + (Math.round(sw * 100) / 100) + 'px ' + dash + ' ' + sc + ';';
  }
  // Backdrop blur ("frosted glass") — blurs whatever is painted BEHIND the box, as
  // opposed to `blur`, which blurs the box's own paint. Boxes only: a path box's
  // frame is the curve's bbox, so a rectangular frost behind an arbitrary outline
  // would be wrong. Same clamp + 1-decimal rounding discipline as blurCss, and the
  // -webkit- prefix rides alongside for Safari.
  //
  // Fidelity: the live canvas and SVG export carry it; the raster (PNG/JPG/WebP),
  // PDF and video paths cannot see a backdrop through their serialiser and export
  // the box frostless. The export panel warns when the chosen format drops it.
  var bgb = clamp(num(b.bgBlur, 0), 0, 300);
  if (String(b.kind) !== 'path' && !bare && bgb > 0) {
    var bgbPx = (Math.round(bgb * 10) / 10) + 'px';
    css += 'backdrop-filter:blur(' + bgbPx + ');-webkit-backdrop-filter:blur(' + bgbPx + ');';
  }
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
  // plan 104 §5.4 — a CAMERA box is a bare marker and nothing else: no fill (boxCss), no
  // media, no text, no shadow (compute). It exists so the scene's pose has somewhere to
  // live — the pose itself rides on the wrapper's data-t-kf/data-t-z, exactly like every
  // other timing attribute — and the marker is what the evaluators key their camera
  // branch off. Checked FIRST, before the `url` guard: a camera carries no image, so an
  // early return on "no url" would swallow the marker entirely. data-export-hide keeps it
  // out of every export walk (the same tag the editor's own chrome carries), on top of
  // styles.css hiding it.
  if (isCameraBox(b)) {
    return '<div class="lolly-box-cam" data-cam="1" data-export-hide aria-hidden="true"></div>';
  }
  var img = b && b.image;
  var url = img && img.url ? String(img.url) : '';
  if (!url) return '';
  var isLottie = (img && img.type === 'lottie') || /\.json($|\?|#)/i.test(url);
  var isVideo = (img && img.type === 'video') || /\.(mp4|m4v|mov|webm)($|\?|#)/i.test(url);
  var style = imgCss(b);
  // An audio box is a TIMELINE citizen, not an artboard one: a music bed or a voiceover
  // has no picture, so it paints nothing and a still export can never show a stray
  // rectangle where it sits (styles.css hides the marker; boxCss keeps the box
  // transparent and compute() drops its text). The marker div is the only trace, carrying
  // the src for the shell compositor's waveform + audio mix — inert in the CLI and a plain
  // browser render, exactly like the Lottie marker below. Checked BEFORE the lottie/video
  // branches so an asset typed 'audio' can never fall through to a broken <img>. Mirrors
  // sequence-studio's marker verbatim: class + data-audio-src (always), data-audio-dur
  // (only when the source's own length in ms is known — a procedural zzfxm bed omits it).
  if (isAudioBox(b)) {
    var adur = img && img.meta && Number(img.meta.durationMs);
    var adurAttr = (isFinite(adur) && adur > 0) ? ' data-audio-dur="' + Math.round(adur) + '"' : '';
    return '<div class="lolly-box-audio" data-audio-src="' + esc(url) + '"' + adurAttr + ' aria-hidden="true"></div>';
  }
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
  // An ANIMATED SVG (a CSS/SMIL-animated vector) is a motion source like Lottie, so it
  // earns the same live-marker treatment instead of a frozen <img>: emit the anim marker
  // div the web shell's anim-svg enhancer inlines as a LIVE sanitized <svg> (plays in
  // preview, seekable for frame-accurate export). A STATIC svg stays the <img> below —
  // inlining every svg would risk id collisions across boxes and a perf hit. This hook is
  // pure/sync and cannot fetch the file, so "animated" is gated on a signal the resolved
  // ref already carries: an svg (type 'vector' / format 'svg' / .svg url) whose meta says
  // so (meta.animated === true, or an 'animated' tag on meta.tags / the ref's own tags).
  // Mirrors the lottie marker above — fit → cover|meet (the anim enhancer's vocabulary),
  // url esc()'d, style shared with the other branches (data-anim-fit carries the real fit).
  var isSvg = (img && (img.type === 'vector' || img.format === 'svg')) || /\.svg($|\?|#)/i.test(url);
  var animTags = (img && (img.meta && img.meta.tags || img.tags)) || [];
  var isAnimSvg = isSvg && (
    !!(img && img.meta && img.meta.animated === true) ||
    (Array.isArray(animTags) && animTags.indexOf('animated') >= 0));
  if (isAnimSvg) {
    var afit = String(b.fit) === 'cover' ? 'cover' : 'meet';
    return '<div class="lolly-box-img lolly-box-anim" data-anim-src="' + esc(url) +
      '" data-anim-fit="' + afit + '" style="' + style + '"></div>';
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
  // An audio box or camera marker is invisible, so a gradient on it would print a stray
  // rectangle.
  if (!b || String(b.kind) === 'path' || isBareBox(b)) return '';
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
// `dashLen`/`gapLen` are the AUTHORED lengths (Penpot 2.17 exports them as strokeDash /
// strokeGap, absolute px). They are numbers, so they still cannot carry a comma or a
// tilde, and they only ever reach the attribute through f2(). 0 means "not authored" and
// keeps the width-proportional synthesis, so every shape made before these fields
// existed emits exactly the markup it emitted then. One of the two authored on its own
// is used for both, which is what Penpot's own per-input default does.
function dashArrayFor(style, w, cap, dashLen, gapLen) {
  if (!DASH_STYLES[style] || !(w > 0)) return '';
  if (style === 'dashed') {
    var dl = clamp(num(dashLen, 0), 0, 400), gl = clamp(num(gapLen, 0), 0, 400);
    if (!(dl > 0)) dl = gl;
    if (!(gl > 0)) gl = dl;
    if (dl > 0 && gl > 0) return f2(dl) + ' ' + f2(gl);
  }
  if (style === 'dotted') {
    // A round or square cap already paints a full w across the line, so the dot is a
    // ZERO-length dash and the gap is the whole period. A flat (butt) cap paints nothing
    // at zero length, so it needs a real w-long dash — which is a square dot, correctly.
    return cap === 'butt' ? f2(w) + ' ' + f2(w) : '0 ' + f2(w * 2);
  }
  return f2(w * 3) + ' ' + f2(w * 2);
}

// ── plan 96: one path primitive, so a path carries connector decorations ─────
//
// A spline, a line and a connector are the SAME thing here — an authored path — so the
// arrowheads that used to belong to a connector edge belong to any path box. The shapes
// and their geometry are the engine's (`edgeArrowHead`), reached through the host bridge
// so the editor, the export and a headless CLI draw one head, not three.
//
// Everything below is feature-detected and degrades to "no decoration", never to a throw:
// a path box on an engine that predates the primitive renders exactly the markup it
// rendered before these fields existed.

// The head vocabulary, whitelisted for the same reason the cap/join/dash keywords are:
// the value reaches a bridge call and, through it, an attribute in {{{ }}} markup. The
// membership test is an OWN-property lookup, not the bare `HEAD_KINDS[s]` truthiness test,
// because every object literal inherits truthy `constructor`/`__proto__`/`toString`/
// `valueOf` from Object.prototype — `headEnd=constructor` in a hand-edited URL would
// otherwise pass the gate and reach the engine, which draws a triangle for any name it
// doesn't recognise. Same posture as SHADOW_TARGETS, FONTS, BLENDS, TRANSITIONS, EASINGS
// and KF_EASES. NOT yet universal — FILL_RULES, LINE_CAPS, LINE_JOINS, DASH_STYLES, FITS,
// OBJPOS, H_JUSTIFY, V_ALIGN and the DECK_* maps still use the bare truthiness test. An
// inherited key there lands as a nonsense keyword in an attribute or a CSS declaration
// (inert: no Object.prototype key, and no function's source text, carries a quote or `<`),
// so converting them is a tidy-up rather than a hole — but it is still owed.
var HEAD_KINDS = { none: 1, triangle: 1, open: 1, circle: 1, diamond: 1, bar: 1 };
function headKind(v) {
  var s = String(v == null ? '' : v);
  return Object.prototype.hasOwnProperty.call(HEAD_KINDS, s) ? s : 'none';
}

// host.connectors is OPTIONAL and additive — feature-detect exactly like geomApi().
function connApi() {
  return typeof host !== 'undefined' && host && host.connectors ? host.connectors : null;
}

// The head's SIZE from the stroke width, and how far the SHAFT is pulled back so a filled
// head is not pierced by the line it terminates. Both mirror engine/src/connectors.ts
// (`Math.max(9, width * 4)` and `edgeHeadInset`) EXACTLY, because the head is drawn by that
// engine code and the pull-back is computed here: two formulas that must agree, so they are
// written to agree rather than guessed. An open chevron and a bar are strokes across the
// tip with nothing to pierce, so they pull back by nothing.
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

// One arrowhead as an SVG fragment, via the bridge. `angle` is RADIANS about the +x axis —
// atan2 order — and the primitive derives the head size from `width` the same way
// headSizeFor does. Absent primitive (older engine) → '' and the path simply has no head.
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

// ── end tangents ─────────────────────────────────────────────────────────────
// A head needs a tip and a direction. On a routed connector the direction falls out of the
// route; on an AUTHORED path there is none, so it is read off the LOWERED curve — the only
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
    // start tangent points OUT of the path, so moving IN is +ds along it reversed.
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

// ── authored dash arrays + corner fit ────────────────────────────────────────
//
// The keyword style (dashArrayFor above) derives its pattern from the stroke width. A power
// user wants the numbers, so `strokeDashArray` carries them as a SPACE-separated string —
// space because the compact blocks URL splits rows on '~' and fields on ',', and neither
// can be escaped inside a value. When it is set it WINS over the keyword.
//
// The parse is the engine's when the engine has one (host.connectors.dashFit.parse is the
// authority the editor validates against too), and this local one otherwise, so a hand-
// edited URL param is checked either way. Nothing but finite non-negative NUMBERS ever
// reaches the attribute — which is the whole reason a keyword was the only option before.
var DASH_MAX = 16;
function parseDashArrayText(v) {
  var text = String(v == null ? '' : v).trim();
  if (!text) return null;
  var api = connApi();
  if (api && api.dashFit && typeof api.dashFit.parse === 'function') {
    try { return api.dashFit.parse(text) || null; } catch (e) { /* fall through to the local parse */ }
  }
  var parts = text.split(/[\s,]+/), out = [], i, n;
  if (!parts.length || parts.length > DASH_MAX) return null;
  for (i = 0; i < parts.length; i++) {
    if (!/^\d*\.?\d+$/.test(parts[i])) return null;
    n = Number(parts[i]);
    if (!isFinite(n) || n < 0) return null;
    out.push(n);
  }
  for (i = 0; i < out.length; i++) if (out[i] > 0) return out;
  return null;   // all zeros paints nothing — not a pattern
}

// The length of one cubic, by chord sampling. Exact arc length of a cubic has no closed
// form; 16 chords is well inside a pixel at any size a layout canvas holds, and the number
// only ever feeds a dash-period fit, where being a fraction of a percent out is invisible.
function cubicLength(c) {
  var n = 16, prevX = c[0], prevY = c[1], total = 0, i, t, mt, x, y;
  for (i = 1; i <= n; i++) {
    t = i / n; mt = 1 - t;
    x = mt * mt * mt * c[0] + 3 * mt * mt * t * c[2] + 3 * mt * t * t * c[4] + t * t * t * c[6];
    y = mt * mt * mt * c[1] + 3 * mt * mt * t * c[3] + 3 * mt * t * t * c[5] + t * t * t * c[7];
    total += Math.sqrt((x - prevX) * (x - prevX) + (y - prevY) * (y - prevY));
    prevX = x; prevY = y;
  }
  return total;
}

// The lengths the dash pattern has to come out even over — Illustrator's "align dashes to
// corners and path ends". A CORNER is a node the curve actually turns at: every node on a
// polyline (`kind:'line'`), and a node marked `corner` on any other kind. A smooth spline
// has none, so its whole run is one span between its two ends; a CLOSED path has no ends,
// so a closed smooth loop is one span all the way round and a closed polyline is one span
// per side. Segment i runs node i → node i+1 (the engine's own indexing), wrapping on the
// last segment of a closed path.
function dashSpanLengths(curves, nodes, kind, closed) {
  if (!curves.length || nodes.length < 2) return [];
  var isCorner = [], i;
  for (i = 0; i < nodes.length; i++) {
    isCorner.push(kind === 'line' || String(nodes[i].continuity) === 'corner');
  }
  var spans = [], acc = 0, endNode;
  for (i = 0; i < curves.length; i++) {
    acc += cubicLength(curves[i]);
    endNode = (i + 1) % nodes.length;
    if (i === curves.length - 1 || isCorner[endNode]) { spans.push(acc); acc = 0; }
  }
  if (acc > 0) spans.push(acc);
  // On a closed path the run that starts at node 0 and the one that ends there are the SAME
  // span unless node 0 is itself a corner — otherwise a smooth loop would report a seam the
  // curve does not have.
  if (closed && !isCorner[0] && spans.length > 1) spans[0] += spans.pop();
  var out = [];
  for (i = 0; i < spans.length; i++) if (spans[i] > 0) out.push(spans[i]);
  return out;
}

// The pattern actually emitted: the authored one, adjusted so a whole number of periods
// fits each span when "Fit dashes to corners" is on. The fit is the ENGINE's arithmetic
// (host.connectors.dashFit.cornerFitDashArray) — absent, or refusing, and the authored
// pattern is emitted unchanged, which is the same drawing minus the corner alignment.
function fittedDashArray(pattern, spans) {
  var api = connApi();
  if (!spans.length || !api || !api.dashFit || typeof api.dashFit.cornerFitDashArray !== 'function') return pattern;
  try {
    var fit = api.dashFit.cornerFitDashArray(spans, pattern);
    return (fit && fit.length) ? fit : pattern;
  } catch (e) {
    pathWarn('corner-fit dashes failed: ' + e);
    return pattern;
  }
}

// numbers -> the attribute value. f2() is the only thing that ever writes it.
function dashArrayToAttr(nums) {
  var out = [], i;
  for (i = 0; i < nums.length; i++) {
    var n = num(nums[i], -1);
    if (!(n >= 0)) return '';        // a non-number anywhere voids the whole pattern
    out.push(f2(clamp(n, 0, 4000)));
  }
  return out.join(' ');
}

// A path box's inline <svg>, or '' for every other kind. Pure/string-only like
// mediaHtmlFor, so the CLI emits identical markup.
function pathHtmlFor(b) {
  if (String(b.kind) !== 'path') return '';
  // A BOUND path is a connector: its shape is the route between two live rects, in CANVAS
  // coordinates, and a box <svg> can only draw inside its own frame. So it is drawn by
  // lineLayerFor() instead and nothing is emitted here — see the plan 96 P3 block below.
  if (isBoundPath(b)) return '';
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
  var soleNodes = null;   // the box-local nodes of a SINGLE-contour path (see below)
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
    if (srcs.length === 1) soleNodes = nodes;
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
  var dash = dashArrayFor(String(b.strokeDash == null ? '' : b.strokeDash), sw, cap,
    num(b.strokeDashLen, 0), num(b.strokeGapLen, 0));

  // ── plan 96 decorations: arrowheads + the authored dash pattern ────────────
  //
  // Both need the LOWERED curve — the tangent a head points along, and the arc lengths a
  // corner fit divides — and both are meaningful only on a path with two ends, so they
  // apply to a SINGLE OPEN contour. A closed loop has no ends; a multi-contour result (a
  // boolean, a traced glyph) has no single pair of them, and picking one arbitrarily would
  // put an arrow on whichever subpath happened to be first. Those keep today's markup.
  var headStart = headKind(b.headStart);
  var headEnd = headKind(b.headEnd);
  var authored = parseDashArrayText(b.strokeDashArray);
  var wantHeads = !!stroke && sw > 0 && (headStart !== 'none' || headEnd !== 'none');
  var wantFit = !!authored && boolVal(b.dashFit, false);
  var sole = (srcs.length === 1 && soleNodes) ? srcs[0] : null;
  var curves = null;
  if ((wantHeads || wantFit) && sole && typeof geom.parse === 'function') {
    var pr = geom.parse(d);
    if (pr && pr.ok && pr.value && pr.value.length === 1) curves = pr.value[0].curves;
  }

  // An authored array WINS over the keyword: the numbers are the more specific statement,
  // and the keyword's control stays where it is so the pattern can be dropped again.
  if (authored) {
    var pattern = (wantFit && curves && curves.length)
      ? fittedDashArray(authored, dashSpanLengths(curves, soleNodes, String(sole.kind), sole.closed === true))
      : authored;
    var attr = dashArrayToAttr(pattern);
    if (attr) dash = attr;
  }

  var heads = '';
  var headReach = 0;
  if (wantHeads && curves && curves.length && !(sole.closed === true)) {
    var dirs = endTangents(curves);
    if (dirs) {
      var tips = endPoints(curves);
      var hsz = headSizeFor(sw);
      // Each head is BUILT FIRST and the shaft is pulled back only where one actually came
      // back. The primitive is feature-detected, so "no head" is a real outcome on an older
      // engine — and trimming for a head that was never drawn would leave the line visibly
      // short of its own endpoint with nothing there to explain it.
      var hs = headSvgFor(tips.start, dirs.start.x, dirs.start.y, headStart, stroke, sw);
      var he = headSvgFor(tips.end, dirs.end.x, dirs.end.y, headEnd, stroke, sw);
      heads = hs + he;
      if (heads) {
        var trimmed = insetCurveEnds(curves, dirs,
          hs ? headInsetFor(headStart, hsz) : 0,
          he ? headInsetFor(headEnd, hsz) : 0);
        // Re-serialising the pulled-back curve is the engine's job too, so the `d` the
        // browser reads is the `d` the SVG/PDF walkers read. No toPathData (or a refusal)
        // leaves the shaft at full length under its head — a cosmetic loss, not a wrong
        // drawing, so it is not worth a placeholder.
        if (typeof geom.toPathData === 'function') {
          var td = geom.toPathData([{ curves: trimmed, closed: false }], { decimals: 3 });
          if (td && td.ok && td.d) d = td.d;
        }
        // A head sits ON the frame edge and spreads across the tangent (a bar reaches
        // 0.62·size either side, the widest of the six), so the pad below has to cover it
        // or the outer <svg> clips the arrow off the shape it belongs to.
        headReach = hsz * 0.7 + sw / 2;
      }
    }
  }

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
  //   - an ARROWHEAD (plan 96) is the third: it sits ON the frame edge and spreads across
  //     the tangent, so `headReach` above sizes the pad for whichever head is on. A path
  //     with no head contributes 0 and the pad is byte-identical to what it was.
  var reach = Math.max(cap === 'square' ? Math.SQRT2 / 2 : 0.5, join === 'miter' ? MITER_LIMIT / 2 : 0.5);
  var pad = Math.max(stroke && sw > 0 ? sw * reach : 0, headReach);
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
    '></path>' +
    // The heads follow the shaft so they paint over its end, and they are NOT esc()'d:
    // they are engine-built SVG fragments, not values — the engine escapes the one thing
    // in them that came from the box (the colour), exactly as it does for a connector.
    heads +
    '</svg>';
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
// e.g. a transparent PNG / icon), 'depth' → the same drop-shadow, but DERIVED from the
// box's own `z` instead of the manual offsets (plan 104 §5.3). Returns the fragments for
// each target element. Raster and SVG export are faithful. PDF reaches all four too, but
// by two different routes: 'box' and 'text' are true vector (the walker's Gaussian-CDF
// band fan), while 'content' and 'depth' follow the alpha silhouette, which no PDF
// operator describes, so that box takes the per-element raster escape hatch.
//
// An own-property lookup, not the bare `SHADOW_TARGETS[tgt]` truthiness test: every
// object literal inherits truthy `constructor`/`__proto__`/`toString`/`valueOf` from
// Object.prototype, so `shadow=constructor` in a hand-edited URL would otherwise select
// a shadow target that does not exist and fall through to the content branch. Same
// posture as isTransition below — one rule for every enum whitelist in this file.
var SHADOW_TARGETS = { box: 1, text: 1, content: 1, depth: 1 };
function isShadowTarget(v) {
  return Object.prototype.hasOwnProperty.call(SHADOW_TARGETS, v);
}
function shadowCss(b) {
  var tgt = String(b.shadow || 'none');
  if (!isShadowTarget(tgt)) return { box: '', text: '', filterFn: '' };
  // The depth shadow is a pure function of `z` — straight overhead light, alpha and
  // spread growing with the lift, so raising a box off the surface reads as height
  // rather than as a light direction (a baked down-right offset is an LTR assumption
  // that would be wrong in half of the 26 locales). The manual shadowColor/X/Y/Blur
  // stay as the OVERRIDE tier: pick 'box'/'text'/'content' to drive them by hand.
  // Blur is floored at 0 because a sunken box (z < 0) drives 10 + z·0.2 negative,
  // which is not a legal CSS length.
  if (tgt === 'depth') {
    var dz = clamp(num(b.z, 0), -300, 900);
    var dy = f2(dz * 0.15);
    var dbl = f2(clamp(10 + dz * 0.2, 0, 300));
    return { box: '', text: '', filterFn: 'drop-shadow(0px ' + dy + 'px ' + dbl + 'px #00000055)' };
  }
  var col = safeColor(b.shadowColor, '#00000055');
  var x = Math.round(clamp(num(b.shadowX, 0), -300, 300));
  var y = Math.round(clamp(num(b.shadowY, 0), -300, 300));
  var bl = Math.round(clamp(num(b.shadowBlur, 10), 0, 300));
  var off = x + 'px ' + y + 'px ' + bl + 'px ';
  if (tgt === 'text') return { box: '', text: 'text-shadow:' + off + col + ';', filterFn: '' };
  if (tgt === 'box') return { box: 'box-shadow:' + off + col + ';', text: '', filterFn: '' };
  return { box: '', text: '', filterFn: 'drop-shadow(' + off + col + ')' };
}

// Layer blur — gaussian blur of the whole box as a CSS filter function (no
// property/terminator; compute() merges it with a content drop-shadow into one
// filter declaration, blur first so the shadow follows the blurred silhouette).
function blurCss(b) {
  var v = clamp(num(b.blur, 0), 0, 300);
  return v > 0 ? 'blur(' + (Math.round(v * 10) / 10) + 'px)' : '';
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
    'color:' + safeColor(b.fg, '#11141f') + ';' +
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

// The named easing curves the shell implements (lib/transitions.ts EASINGS). 'smooth'
// and 'snappy' arrived with the keyframe grammar (plan 104 §5.1) and are listed here for
// the same reason the other six are: the ease select offers every name in that table, and
// a name this whitelist did not know would be dropped on the way to the attribute and
// silently revert to the preset's built-in curve. One vocabulary, three copies of it.
var EASINGS = {
  linear: 1, 'ease-out': 1, 'ease-in': 1, 'ease-in-out': 1, overshoot: 1, anticipate: 1,
  smooth: 1, snappy: 1,
};

// An authored easing, canonicalised for the attribute: a whitelisted preset name, or
// a cubic-bezier re-emitted from its own PARSED numbers rather than from the user's
// string — which is what keeps arbitrary text out of an attribute this hook writes
// through {{{ }}}. The x controls are TIME and must stay inside 0..1 or the curve is
// not a function of progress (CSS refuses the same thing); y is unbounded on purpose,
// because that is the whole overshoot family. Anything else answers '' and the
// attribute is omitted entirely, so the preset keeps the built-in curve it has always
// had. Mirrors easingPoints/easingToWire in shells/web/src/lib/transitions.ts, which
// re-validates on the way back in — two guards, one vocabulary.
function easeAttr(v) {
  if (typeof v !== 'string') return '';
  var s = v.trim();
  if (Object.prototype.hasOwnProperty.call(EASINGS, s)) return s;
  var m = /^cubic-bezier\(([^)]*)\)$/i.exec(s);
  if (!m) return '';
  var raw = m[1].split(',');
  if (raw.length !== 4) return '';
  var n = [];
  for (var i = 0; i < 4; i++) {
    var x = Number(raw[i].trim());
    if (!isFinite(x)) return '';
    n.push(Math.round(x * 1000) / 1000);
  }
  if (n[0] < 0 || n[0] > 1 || n[2] < 0 || n[2] > 1) return '';
  return 'cubic-bezier(' + n.join(',') + ')';
}

// A box's start offset in seconds, clamped into range. One definition so the
// attribute and the derived sequence length can never disagree.
function startSeconds(b) {
  return clamp(num(b.start, 0), 0, MAX_TIME_S);
}

// ── plan 104 §5.1: the keyframe track ──────────────────────────────────────────
//
// `kf` is a per-box TEXT field carrying a whole animation as one compact string:
// keyframes separated by '*', tokens within a keyframe by '_', the first token that
// keyframe's LOCAL time in ms (t1500), the rest channel values (x-40, s1.2, rx-8) plus
// at most one ease token for the segment leaving it (eo, or eb(0.32)(0)(0.67)(1)).
//
// It is free text, authorable from a hand-edited share URL, and it lands in an HTML
// attribute through {{{ }}} — so this hook NEVER emits the authored string. It PARSES the
// value and re-serialises its own: the easeAttr posture, one step further out. A track
// carrying `"><img` leaves no surviving token, so the attribute is omitted entirely
// rather than escaped — the same answer this file gives a non-whitelisted transition.
//
// The tables below are TRANSCRIBED from engine/src/keyframes.ts (KF_CHANNELS, KF_CLAMPS,
// KF_QUANTA, KF_EASE_PRESETS and the parse caps), because a hook cannot import the
// engine. So the grammar has two implementations — and tests/timeline-model.test.ts pins
// them to each other by asserting the emitted attribute equals the engine's own
// serialiseKf(parseKf(raw)) for a corpus of hostile and ordinary tracks. Change one side
// without the other and that test fails, which is exactly what it is for.
var KF_CHANNEL_ORDER = ['x', 'y', 'z', 's', 'r', 'rx', 'ry', 'o', 'b', 'f', 'a', 'p'];
// The same names LONGEST-FIRST, which is what makes 'rx-8' channel rx at −8 rather than
// channel r followed by junk. No channel is named 'e', so an ease token can never be read
// as a channel.
var KF_CHANNELS_BY_LEN = ['rx', 'ry', 'a', 'b', 'f', 'o', 'p', 'r', 's', 'x', 'y', 'z'];
// `z` spans ±12000 on the WIRE, which is NOT the z field's own −300…900: one kf grammar
// carries both a box's lift and the CAMERA's dolly, and camZ is the only zoom control
// there is. The field clamp still governs the z FIELD — see data-t-z below.
var KF_CLAMPS = {
  x: [-100000, 100000], y: [-100000, 100000], z: [-12000, 12000], s: [0.01, 100],
  r: [-3600, 3600], rx: [-180, 180], ry: [-180, 180], o: [0, 1], b: [0, 300],
  f: [-3000, 3000], a: [0, 1], p: [50, 12000],
};
var KF_QUANTA = {
  x: 0.01, y: 0.01, z: 0.01, s: 0.001, r: 0.01, rx: 0.01, ry: 0.01,
  o: 0.001, b: 0.01, f: 0.01, a: 0.001, p: 0.01,
};
// The eight named curves, by their wire token: linear, ease-in, ease-out, ease-in-out,
// overshoot, anticipate, smooth, snappy. 'eh' (hold) is an ease too but has no points.
var KF_EASES = {
  el: [0, 0, 1, 1], ei: [0.32, 0, 0.67, 0], eo: [0.33, 1, 0.68, 1],
  eio: [0.65, 0, 0.35, 1], ev: [0.34, 1.56, 0.64, 1], ea: [0.36, -0.4, 0.66, 1],
  es: [0.4, 0, 0.2, 1], ek: [0.4, 0, 0.6, 1],
};
var KF_HOLD_EASE = 'eh';
var KF_DEFAULT_EASE = 'eio'; // absent from the wire means this curve
var KF_BEZIER_Q = 0.001;
var KF_BEZIER_Y_MAX = 10;
var KF_MAX_KEYS = 256;   // parse caps — a blocks sub-field has no length limit of its own
// DERIVED from KF_MAX_KEYS, not picked: 256 keyframes at the widest a keyframe can
// serialise to (154 chars) plus separators is 39 679, so a full-density track always
// fits and the two caps can never disagree. The engine pins the derivation.
var KF_MAX_CHARS = 40960;
var KF_NUM = /^-?(?:\d+(?:\.\d+)?|\.\d+)$/; // no exponent, no '+', no NaN/Infinity
var KF_T = /^t(-?(?:\d+(?:\.\d+)?|\.\d+))$/;
var KF_EB = /^eb\(([^()]*)\)\(([^()]*)\)\(([^()]*)\)\(([^()]*)\)$/;

// Round to a quantum whose inverse is an exact power of ten, so String() of the result is
// its shortest round-tripping spelling — and −0 never reaches the wire.
function kfQuant(v, q) {
  var inv = Math.round(1 / q);
  var n = Math.round(v * inv) / inv;
  return n === 0 ? 0 : n;
}

// Strict decimal parse, matching the engine's: null for anything else.
function kfNum(s) {
  if (!KF_NUM.test(s)) return null;
  var n = Number(s);
  return isFinite(n) ? n : null;
}

// An ease token in canonical spelling, or '' when it is not an ease at all. A custom
// bezier landing exactly on a preset's points comes back as that preset's name.
function kfEase(tok) {
  if (tok === KF_HOLD_EASE) return tok;
  if (Object.prototype.hasOwnProperty.call(KF_EASES, tok)) return tok;
  var m = KF_EB.exec(tok);
  if (!m) return '';
  var p = [];
  for (var i = 1; i <= 4; i++) {
    var n = kfNum(m[i]);
    if (n === null) return '';
    // The odd positions are the x controls: TIME, which must stay inside 0..1 or the
    // curve is not a function of progress (the rule easeAttr applies to cubic-bezier).
    // y is bounded only to keep the attribute finite — the overshoot family lives
    // outside 0..1 by design. Clamped, never rejected: the engine's parser clamps too,
    // and the two must agree on every input.
    var odd = (i % 2) === 1;
    p.push(kfQuant(clamp(n, odd ? 0 : -KF_BEZIER_Y_MAX, odd ? 1 : KF_BEZIER_Y_MAX), KF_BEZIER_Q));
  }
  for (var name in KF_EASES) {
    if (!Object.prototype.hasOwnProperty.call(KF_EASES, name)) continue;
    var q = KF_EASES[name];
    if (q[0] === p[0] && q[1] === p[1] && q[2] === p[2] && q[3] === p[3]) return name;
  }
  return 'eb(' + p[0] + ')(' + p[1] + ')(' + p[2] + ')(' + p[3] + ')';
}

// The whole track, parsed and re-serialised, or '' to omit the attribute entirely.
// Never throws: junk tokens are skipped, and a keyframe whose first token is not
// t<number> is skipped whole (the grammar puts time first, always).
function kfAttr(v) {
  if (typeof v !== 'string' || v === '') return '';
  var src = v.length > KF_MAX_CHARS ? v.slice(0, KF_MAX_CHARS) : v; // the excess is ignored
  var segs = src.split('*');
  var keys = [];
  for (var s = 0; s < segs.length && keys.length < KF_MAX_KEYS; s++) {
    if (segs[s] === '') continue;
    var raw = segs[s].split('_');
    var toks = [];
    for (var r = 0; r < raw.length; r++) { if (raw[r] !== '') toks.push(raw[r]); }
    if (!toks.length) continue;
    var tm = KF_T.exec(toks[0]);
    if (!tm) continue;
    var tRaw = kfNum(tm[1]);
    if (tRaw === null) continue;
    var ease = KF_DEFAULT_EASE;
    var vals = {};
    for (var i = 1; i < toks.length; i++) {
      var tok = toks[i];
      if (tok.charAt(0) === 'e') {
        // Later tokens overwrite earlier ones — the wire reads as a list of assignments.
        var e = kfEase(tok);
        if (e) { ease = e; continue; }
      }
      for (var c = 0; c < KF_CHANNELS_BY_LEN.length; c++) {
        var ch = KF_CHANNELS_BY_LEN[c];
        if (tok.slice(0, ch.length) !== ch) continue;
        var n = kfNum(tok.slice(ch.length));
        if (n === null) continue; // a shorter channel name may still match
        vals[ch] = kfQuant(clamp(n, KF_CLAMPS[ch][0], KF_CLAMPS[ch][1]), KF_QUANTA[ch]);
        break;
      }
    }
    keys.push({ t: Math.round(clamp(tRaw, 0, MAX_TIME_S * 1000)), ease: ease, v: vals });
  }
  // Sorted by time, then last-wins at equal times: a re-keyed pose replaces the one it was
  // written over rather than leaving an unreachable twin behind. Array.sort is stable.
  keys.sort(function (a, b) { return a.t - b.t; });
  var out = [];
  for (var k = 0; k < keys.length; k++) {
    if (out.length && out[out.length - 1].t === keys[k].t) out[out.length - 1] = keys[k];
    else out.push(keys[k]);
  }
  var wire = [];
  for (var w = 0; w < out.length; w++) {
    var key = out[w];
    var parts = ['t' + key.t];
    if (key.ease !== KF_DEFAULT_EASE) parts.push(key.ease);
    for (var o = 0; o < KF_CHANNEL_ORDER.length; o++) {
      var cn = KF_CHANNEL_ORDER[o];
      if (!Object.prototype.hasOwnProperty.call(key.v, cn)) continue;
      parts.push(cn + key.v[cn]);
    }
    wire.push(parts.join('_'));
  }
  return wire.join('*');
}

// A box's time attributes, or '' for a box with no timing, no depth and no keyframes.
// Pure; every value lands in an HTML attribute via {{{ }}}, so every emitted value is
// either a clamped NUMBER or a whitelisted enum token — never raw user text. `kf` is the
// one free-text field among them, and kfAttr parses and re-serialises it rather than
// passing it through, so the invariant holds unchanged.
// Each attribute string starts with a leading space so concatenation into a tag is
// safe with no manual separator bookkeeping.
function timeAttrsFor(b) {
  var parts = [];
  // SCENERY (no lane, no start authored) carries no TIMING attributes — the contract
  // every document written before the time model still renders under. Depth and
  // keyframes are not timing: a scenery box on a sequence stage is visible throughout
  // and can still be lifted off the surface or animated, and an always-on camera is
  // exactly that box, so those two are emitted below for timed and untimed alike.
  if (b.lane === 'seq' || isFiniteNum(b.start)) {
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
      // Only ever alongside a kind, and only when it survives easeAttr — an unauthored
      // or unparseable curve leaves the attribute absent, which is what every reader
      // treats as "the preset's own curve".
      var enterEase = easeAttr(b.enterEase);
      if (enterEase) parts.push(' data-t-enter-ease="' + enterEase + '"');
    }
    if (isTransition(b.exit)) {
      parts.push(' data-t-exit="' + b.exit + '" data-t-exit-ms="' + Math.round(clamp(num(b.exitMs, 400), 100, 3000)) + '"');
      var exitEase = easeAttr(b.exitEase);
      if (exitEase) parts.push(' data-t-exit-ease="' + exitEase + '"');
    }
    if (boolVal(b.mute, false)) parts.push(' data-t-mute="1"');
    if (b.lane === 'seq') parts.push(' data-t-lane="seq"');
  }
  // plan 104 §5.3 / §5.1 — depth as a clamped number (the ±300 house clamp on one side,
  // 900 on the other so a deep lift stays clear of the behind-camera guard), and the
  // keyframe track as re-serialised tokens. Both stay absent unless authored, so a
  // document using neither renders byte-identically to before the feature landed.
  // NOT on a FRAME: §5.4 scopes v1 to boxes on a [data-sequence] stage — "frame pages
  // are excluded from projection and cannot carry kf" — and frameGroupsFor stamps this
  // same string onto the [data-pdf-page] div. Excluded HERE, at the one place the
  // attribute is written, rather than left for every future reader to remember to skip.
  if (String(b.kind) !== 'frame') {
    var z = Math.round(clamp(num(b.z, 0), -300, 900));
    if (z !== 0) parts.push(' data-t-z="' + z + '"');
    var kf = kfAttr(b.kf);
    if (kf) parts.push(' data-t-kf="' + kf + '"');
  }
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

// ── plan 96 P3–P5: bound paths, and ONE committed line layer ──────────────
//
// A path box with an endpoint ATTACHED to another box is a connector, and connector
// management takes over drawing it: the engine routes from the bound box's border toward
// the other end (another bound box, or the path's own free node as an `@x,y` point) and
// re-solves that route every render, so the line sticks to the boxes wherever they move.
//
// The route is chosen by the path's own SPLINE KIND — host.connectors.routeStyleForKind,
// the engine's single mapping (line→straight, a 3+-node polyline→elbow, spiro→arc, every
// other kind→the curved S) — overridden by the box's `route` field for the nine variants
// six kinds cannot name (elbow-v/-h/-src/-tgt, curved-v/-h, the arc bows). Heads, dashes
// and colour ride along as the box's own decoration fields.
//
// Everything below is feature-detected and degrades to "no layer", never to a throw:
// CONN_W/H are the artboard's native coordinate space, and the <svg> is CSS-stretched to
// the artboard (styles.css .lolly-connectors), so the viewBox maps box x/y 1:1.
var CONN_W = 1080, CONN_H = 1080;
// What a bound path falls back to when it carries no stroke of its own. Same pair the
// retired `canvas.connect` block declared, so a migrated edge with no colour looks the
// same as it did.
var CONN_COLOR = '#64748b', CONN_WIDTH = 3;

// One end's binding: the id of the box it is attached to, '' for a free end.
function bindOf(b, which) {
  var v = which === 'start' ? b.bindStart : b.bindEnd;
  return v == null ? '' : String(v).trim();
}
// Is this box a connector? One binding is enough — a path pinned at one end and loose at
// the other still routes, from the border toward the loose point.
function isBoundPath(b) {
  return String(b.kind) === 'path' && (bindOf(b, 'start') !== '' || bindOf(b, 'end') !== '');
}
// A free end as the engine's point sentinel. 2dp, like every other coordinate here.
function ptRef(p) { return '@' + f2(p.x) + ',' + f2(p.y); }

// A path box's spline kind, node count, and its two END POINTS in CANVAS coordinates.
// Nodes are stored NORMALISED to the frame, so the canvas position is the frame origin
// plus the normalised coordinate times the frame size. Rotation is deliberately ignored:
// a bound path is drawn between two rects and the router re-solves both ends anyway, so a
// rotated frame would only move a point that is about to be recomputed.
// null when there is no readable two-node-or-more path (an empty field, an older engine
// with no host.geom, an unreadable value).
function pathGeomFor(b) {
  var geom = geomApi();
  var raw = b.path == null ? '' : String(b.path);
  if (!geom || typeof geom.decodeAuthored !== 'function' || !raw) return null;
  var dec = geom.decodeAuthored(raw);
  if (!dec || !dec.ok || !dec.value || !dec.value.length) return null;
  var src = dec.value[0];
  var ns = src && src.nodes;
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

// One bound path as a row the engine's committed-line builder reads. null for anything
// that is not a connector, and for a HALF-bound path whose free end cannot be read: half a
// connector is worse than none, and guessing where the loose end goes would invent
// geometry. A both-ends-bound path needs no local geometry at all.
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
    dashArray: parseDashArrayText(b.strokeDashArray),
    dashFit: boolVal(b.dashFit, false),
    color: safeColor(b.stroke, CONN_COLOR),
    width: sw > 0 ? clamp(sw, 0.5, 20) : CONN_WIDTH,
  };
}

// The committed line layer: every bound path in the document, routed + decorated by the
// engine (host.connectors.build, v1.106/v1.111) so the SAME geometry lands in the editor's
// live preview, the export, and a headless CLI. Export-safe by the engine's contract —
// filled <path> / chevron <line> heads and real <line> dash segments, never a <marker>,
// a <polygon> or a stroke-dasharray. '' on an older engine, and '' when nothing is bound,
// so a document with no connectors emits exactly the markup it always did.
function lineLayerFor(boxes) {
  var api = connApi();
  if (!api || typeof api.build !== 'function') return '';
  var rows = [], i, row;
  for (i = 0; i < boxes.length; i++) {
    row = boundPathRow(boxes[i] || {});
    if (row) rows.push(row);
  }
  if (!rows.length) return '';
  var rectById = new Map();
  boxes.forEach(function (b, k) {
    var id = (b && b.id != null && b.id !== '') ? String(b.id) : String(k);
    rectById.set(id, { x: num(b && b.x, 0), y: num(b && b.y, 0), w: Math.max(1, num(b && b.w, 1)), h: Math.max(1, num(b && b.h, 1)) });
  });
  try {
    return api.build(rows, rectById, {
      fromField: 'from', toField: 'to', styleField: 'style',
      headStartField: 'headStart', headEndField: 'headEnd',
      colorField: 'color', dashField: 'dash', dashArrayField: 'dashArray',
      dashFitField: 'dashFit', widthField: 'width',
      defaultStyle: 'straight', defaultColor: CONN_COLOR, defaultWidth: CONN_WIDTH,
      width: CONN_W, height: CONN_H, layerClass: 'lolly-connectors',
    });
  } catch (e) {
    pathWarn('bound path render failed: ' + e);
    return '';
  }
}

// ── plan 96 P4: the plan-90 `connectors` edge input, migrated on load ─────────
//
// An edge {from,to,style,arrow,head,dash,color,width} becomes a TWO-NODE AuthoredPath box
// bound at both ends, carrying the same decorations. The input stays DECLARED so an old
// share link still parses, but nothing writes it again: this runs in compute(), returns
// the rewritten `boxes` plus an emptied `connectors` as an input patch, and is a no-op
// from the next render on.
//
// Lossless by construction. The edge's own `style` is written to the box's `route`
// override — six spline kinds cannot name thirteen routes, so an elbow-src edge would
// otherwise collapse to a plain elbow — and `arrow` + one shared `head` map onto the two
// per-end heads exactly as the engine's own edge reading does (`end` → a head at the end
// and none at the start, `both` → the same shape at each, anything else → neither). The
// result routes through the very same host.connectors.build call the edge layer used, so
// the migration is render-identical rather than nearly so (tests/org-chart-migration).
var MIGRATED_ID_PREFIX = 'ln';

// The wire form of a two-node straight AuthoredPath (engine/src/geom/authored-url.ts):
// `1` format version, the kind, `0` = open, then one `x!y` record per node, `_`-separated.
// Written here rather than through host.geom.encodeAuthored so the migration runs on any
// engine and produces a byte-stable value the tests can pin.
function twoNodePathValue(n0, n1) {
  return '1!line!0_' + f2(n0.x) + '!' + f2(n0.y) + '_' + f2(n1.x) + '!' + f2(n1.y);
}

// One edge → one path box, or null when either endpoint names no box (a dangling id drew
// nothing before the migration and draws nothing after it).

// The whole migration: null when there is nothing to do (the overwhelmingly common case,
// and the one that keeps compute() from writing inputs on every render), else the new
// `boxes` array with one path box appended per resolvable edge.

// ── frame grouping (plan 93 F1a-part-2) ───────────────────────────────────────
//
// A box with kind==='frame' is a PAGE. Every OTHER box carries a STORED `frame`
// field = the id of its parent frame ("" = top-level scratch/pasteboard). When at
// least one frame-kind box exists we emit `frameGroups`: one entry per frame, ordered
// (order asc, then x asc — matching seedFrameOrder in free-canvas-math.ts), each
// holding the page's own style plus its member boxes re-wrapped at FRAME-LOCAL
// coordinates (left = box.x - frame.x, top = box.y - frame.y). Membership is READ from
// the stored box.frame — geometry is never re-resolved here (that resolution lives in
// the shell overlay, F1b). The per-box markup/style REUSES the same index-aligned
// arrays the artboard path already computed (boxStyle/textStyle/… in `ext`); only the
// wrapping and the frame-local left/top override are new. A scratch box (frame === "",
// or a frame id matching no page) is NOT put in any page here — it renders LOOSE on the
// editor pasteboard via pasteboardFor() (F1b-2), and a frame-kind box is the page
// container, never also rendered as a child. When NO frame exists we return undefined so
// the template's {{#if frameGroups}} is false and {{else}} renders today's single
// .artboard byte-for-byte.
function frameGroupsFor(boxes, ext) {
  var hasFrame = false;
  for (var i = 0; i < boxes.length; i++) {
    if (boxes[i] && String(boxes[i].kind) === 'frame') { hasFrame = true; break; }
  }
  if (!hasFrame) return undefined;

  var frameEntries = [];
  for (var f = 0; f < boxes.length; f++) {
    var fb = boxes[f];
    if (!fb || String(fb.kind) !== 'frame') continue;
    frameEntries.push({ box: fb, idx: f, order: num(fb.order, 0), x: num(fb.x, 0) });
  }
  // Page order: ascending `order`, tie-break ascending x (left→right) — the exact rule
  // seedFrameOrder() uses so a headless render matches the editor's frame numbering.
  frameEntries.sort(function (a, b) { return (a.order - b.order) || (a.x - b.x); });

  return frameEntries.map(function (fe) {
    var fb = fe.box;
    // Round exactly as boxCss does, so a child's frame-local left/top lines up with the
    // global left/top the reused boxStyle string already carries.
    var fx = Math.round(num(fb.x, 0));
    var fy = Math.round(num(fb.y, 0));
    var fw = Math.max(1, Math.round(num(fb.w, 1)));
    var fh = Math.max(1, Math.round(num(fb.h, 1)));
    var fid = (fb.id != null && fb.id !== '') ? String(fb.id) : String(fe.idx);
    var clip = boolVal(fb.clipChildren, true);
    // Free-placed pages: each frame is absolutely positioned at its authored (x,y) so
    // multi-frame docs render side by side / anywhere (not stacked in block flow). The
    // overlay reads back these offsetLeft/offsetTop to drive frame-local drag (F1b). fx/fy
    // are already rounded, matching the frame-local left/top baked onto member boxes.
    // A frame is a BOARD, so a frame with NO authored bg must still read as a surface —
    // not the transparent hole it used to be, which on a dark canvas showed only the
    // editor's shadow/ring (chrome that never exports). The default is the theme-aware
    // --lolly-frame-surface token (styles.css: light paper / dark raised surface) with a
    // concrete #ffffff fallback so a headless/CLI render, which has no brand vars, still
    // gets a visible board deterministically. This is REAL page fill, so the SVG/PDF/raster
    // walkers export it faithfully. An authored bg still wins — safeColor returns it and
    // the token is never emitted.
    // A frame is a BOARD, so like a box shape it can carry a REAL border (stroke colour
    // + width), not just the editor-only shadow/ring. Same safeColor/num/dash discipline
    // boxCss uses, with box-sizing:border-box so it is an INSIDE stroke — the border sits
    // within fw/fh, keeping the frame's OUTER box (fw×fh at fx,fy) unmoved. Emitted only
    // when authored (colour + positive width); the SVG/PDF/raster walkers export it
    // faithfully.
    //   box-sizing keeps the frame's outer size right, but it does NOT stop the border
    // from insetting the CONTAINING BLOCK of the page's absolutely-positioned children:
    // an abs child resolves left/top against the page's PADDING box, which the border
    // pushes in by border-width on every side. So a child authored at frame-local (lx,ly)
    // would paint at (lx+bw, ly+bw) — a persistent strokeW-px drift off the model
    // coordinate that selection chrome, live drag and connectors all anchor at. We cancel
    // it by subtracting the border width (frameBW) from each child's frame-local origin
    // below, so painted position == model position for any strokeW. (An edge-flush child's
    // stroke-band is then covered/clipped by the inside stroke — the correct semantics of
    // an inside stroke — instead of the whole child sliding inward.)
    var fsw = num(fb.strokeW, 0);
    var fsc = safeColor(fb.stroke, '');
    var frameBW = (fsc && fsw > 0) ? (Math.round(fsw * 100) / 100) : 0;
    var frameBorder = frameBW > 0
      ? 'box-sizing:border-box;border:' + frameBW + 'px ' +
        (String(fb.strokeDash) === 'dashed' ? 'dashed' : String(fb.strokeDash) === 'dotted' ? 'dotted' : 'solid') +
        ' ' + fsc + ';'
      : '';
    var pageStyle =
      'position:absolute;left:' + fx + 'px;top:' + fy + 'px;' +
      'width:' + fw + 'px;height:' + fh + 'px;' +
      'background:' + safeColor(fb.bg, 'var(--lolly-frame-surface, #ffffff)') + ';' +
      frameBorder +
      (clip ? 'overflow:hidden;' : 'overflow:visible;');
    var children = [];
    for (var j = 0; j < boxes.length; j++) {
      var cb = boxes[j];
      if (!cb || String(cb.kind) === 'frame') continue;              // a frame is a page, never a child
      if (String(cb.frame == null ? '' : cb.frame) !== fid) continue; // scratch / other frame omitted
      // Frame-local position OVERRIDES the global left/top already in boxStyle[j]: a
      // later same-property declaration wins in an inline style attribute. frameBW cancels
      // the inside border's containing-block inset (see the frameBorder note above) so the
      // child paints at its model coordinate, not model+strokeW.
      var lx = Math.round(num(cb.x, 0)) - fx - frameBW;
      var ly = Math.round(num(cb.y, 0)) - fy - frameBW;
      children.push({
        flatIndex: j,
        id: (cb.id != null && cb.id !== '') ? cb.id : j,
        fit: ext.boxFit[j],
        boxStyle: ext.boxStyle[j] + 'left:' + lx + 'px;top:' + ly + 'px;',
        timeAttrs: ext.timeAttrs[j],
        pathHtml: ext.pathHtml[j],
        mediaHtml: ext.mediaHtml[j],
        textStyle: ext.textStyle[j],
        textHtml: ext.textHtml[j],
      });
    }
    // Frames-as-scenes (plan 92): when a frame has been SEQUENCED (lane==='seq' or a
    // finite start — the same scenery guard timeAttrsFor uses), stamp the timeline
    // attributes onto the frame PAGE div so the sequence clock's [data-t-start] selector
    // gates it: the page whose [start,start+dur) contains the playhead stays visible, the
    // rest get .seq-off (display:none) — one slide at a time. A frame with NO timing gets
    // no data-t-start → never selected → every frame shows (spatial view); the depth and
    // keyframe attributes are outside that guard (plan 104) but the CLOCK gates on
    // data-t-start alone, so an untimed frame is still never selected. fb carries the
    // timeline fields already, so this is the same emission the artboard boxes get.
    var pageTimeAttrs = timeAttrsFor(fb);
    return { pageStyle: pageStyle, pageTimeAttrs: pageTimeAttrs, children: children };
  });
}

// Editor pasteboard (plan 93 F1b-2): the scratch boxes frameGroupsFor omits from every
// page. A non-frame box is loose when its stored `frame` matches NO existing frame id
// (frame === "", or an orphan id whose frame was deleted). It renders at its GLOBAL x/y —
// ext.boxStyle[j] already carries the global left/top from boxCss, so (unlike a page
// child) NO frame-local override is appended. The template drops these directly under
// .lolly-frames, OUTSIDE every [data-pdf-page]; the per-page export path walks
// [data-pdf-page] nodes only, so a pasteboard box is visible in the editor and excluded
// from the exported pages by construction. Frame ids are derived exactly as the children
// loop derives `fid` (own id, else flat index as a string) so membership agrees.
function pasteboardFor(boxes, ext) {
  var frameIds = Object.create(null);   // null-proto: a frame id like "constructor" can't leak a truthy hit
  for (var f = 0; f < boxes.length; f++) {
    var fb = boxes[f];
    if (!fb || String(fb.kind) !== 'frame') continue;
    frameIds[(fb.id != null && fb.id !== '') ? String(fb.id) : String(f)] = true;
  }
  var loose = [];
  for (var j = 0; j < boxes.length; j++) {
    var cb = boxes[j];
    if (!cb || String(cb.kind) === 'frame') continue;           // a frame is a page, never loose
    if (frameIds[String(cb.frame == null ? '' : cb.frame)]) continue; // belongs to a page → rendered inside it
    loose.push({
      flatIndex: j,
      id: (cb.id != null && cb.id !== '') ? cb.id : j,
      fit: ext.boxFit[j],
      boxStyle: ext.boxStyle[j],   // GLOBAL left/top from boxCss — no frame-local override
      timeAttrs: ext.timeAttrs[j],
      pathHtml: ext.pathHtml[j],
      mediaHtml: ext.mediaHtml[j],
      textStyle: ext.textStyle[j],
      textHtml: ext.textHtml[j],
    });
  }
  return loose;
}

// ── native PowerPoint deck model (plan 95 route-a, "route a") ──────────────────
//
// The DUAL of frameGroupsFor: when frames exist, lower the SAME frames + members to
// a deck-studio-shaped model { size:{w,h}, slides:[{ bg, elements:[…] }] }. The
// export bridge (shells/web/src/bridge/export-pptx.ts → pptx-deck.ts, UNCHANGED)
// reads it off <script data-pptx-deck> and builds an EDITABLE .pptx — real text
// boxes / rects / pictures, not a rasterised picture of the DOM (which needs a live
// browser). Because it re-runs frameGroupsFor's frame filter, the SAME
// order-asc-then-x sort, the SAME fid derivation and the SAME lx/ly frame-local
// arithmetic, every slide stays 1:1 with the rendered [data-pdf-page]. Only the
// lowering differs: RAW numbers + css-colour strings (pptx-deck.ts does px→EMU and
// parses hex/rgb), never the CSS strings the artboard arrays carry.
//
// v1 maps the kinds the flat deck model can EXPRESS: text → an editable text box,
// box → a rect, a still image → a picture. Anything the model cannot carry emits
// NOTHING native here — a path (pen) box, a lottie/video image, and any box wearing
// rotation, a gradient fill, a clip mask, layer/backdrop blur, a blend mode or a
// shadow. Rasterise-to-image for those is a documented FOLLOW-UP; it does NOT block
// the deck (the missing element just isn't in the .pptx). A single no-frames design
// emits no model at all and still exports via export-pptx's DOM-walk fallback.

// Effects/transforms the axis-aligned, solid-fill deck element cannot represent.
// A box wearing any of these is skipped native in v1 (rasterise follow-up), so it is
// never emitted mispositioned/mis-styled. Mirrors the CSS the artboard would apply
// (boxCss rotation + opacity, gradCssFor, clipCss, blurCss, BLENDS, shadowCss) so
// "expressible natively" and "plain enough to have no extra CSS" stay the same predicate.
function deckInexpressible(b, byId) {
  if (!b) return true;
  if (num(b.rot, 0) !== 0) return true;
  if (clamp(num(b.opacity, 100), 0, 100) !== 100) return true; // boxCss emits opacity:<1 — the flat deck element carries no alpha (rasterise follow-up)
  if (b.grad != null && String(b.grad).trim() !== '') return true;
  if (num(b.blur, 0) > 0 || num(b.bgBlur, 0) > 0) return true;
  if (Object.prototype.hasOwnProperty.call(BLENDS, String(b.blend))) return true;
  // Every shadow target, 'depth' included: a .pptx element carries no filter, so a
  // depth shadow is skipped native exactly like the other three (rasterise follow-up).
  if (isShadowTarget(String(b.shadow))) return true;
  var mid = b.clip != null ? String(b.clip) : '';
  var selfId = b.id != null ? String(b.id) : '';
  if (mid && mid !== selfId && byId[mid]) return true; // an actual clip mask (matches clipCss)
  return false;
}

// One non-frame member box → one deck element at frame-LOCAL (lx, ly), or null to
// emit nothing native (a skipped kind/effect). RAW numbers + css colours only.
function deckElementFor(cb, byId, lx, ly) {
  // An audio box is invisible and has no picture, so it lowers to NOTHING native — never
  // the fallback deck rect below (which would print a stray rectangle where the bed sits).
  // A .pptx has no audio track in this model, so a music bed simply isn't in the deck.
  // A camera marker is invisible for the same reason, and a deck has no camera either.
  if (isBareBox(cb)) return null;
  if (deckInexpressible(cb, byId)) return null;
  var cw = Math.max(1, Math.round(num(cb.w, 1)));
  var ch = Math.max(1, Math.round(num(cb.h, 1)));
  var kind = String(cb.kind);
  if (kind === 'path') return null; // pen/vector shape → rasterise FOLLOW-UP
  if (kind === 'text') {
    // One paragraph, one run (v1). sizePt = px * 0.75 (matches export-pptx's
    // pptxRunStyle and deck-studio's pt↔cqw inverse); colour/weight/font reuse the
    // exact reads textCss/weightOf/deckFont use, so the run matches the preview.
    var run = {
      text: cb.text == null ? '' : String(cb.text),
      sizePt: f2(num(cb.fontSize, 48) * 0.75),
      color: safeColor(cb.fg, '#11141f'),
      bold: Number(weightOf(cb)) >= 600,
    };
    var fnt = deckFont(cb);
    if (fnt) run.font = fnt;
    var al = H_JUSTIFY[cb.align] ? String(cb.align) : 'center';
    return {
      t: 'text', x: lx, y: ly, w: cw, h: ch,
      anchor: DECK_ANCHOR[String(cb.valign)] || 'ctr',
      paras: [{ align: DECK_ALIGN[al], runs: [run] }],
    };
  }
  if (kind === 'image') {
    // Asset refs are resolved by the runtime BEFORE this hook, so cb.image already
    // carries { type, url } — the same shape mediaHtmlFor reads. STILL images only:
    // a lottie/video source is skipped (rasterise-to-image FOLLOW-UP), reusing
    // mediaHtmlFor's own motion test so the deck's decision matches the canvas.
    var img = cb.image;
    var url = img && img.url ? String(img.url) : '';
    if (!url) return null;
    var isLottie = (img && img.type === 'lottie') || /\.json($|\?|#)/i.test(url);
    var isVideo = (img && img.type === 'video') || /\.(mp4|m4v|mov|webm)($|\?|#)/i.test(url);
    if (isLottie || isVideo) return null;
    return { t: 'image', x: lx, y: ly, w: cw, h: ch, src: url, fit: FITS[String(cb.fit)] ? String(cb.fit) : 'contain' };
  }
  // kind 'box' (the rectangle; 'circle' is a box+shape) → a deck rect. 'transparent'
  // fill is dropped by deckFill (no fill), matching boxCss. Only a 'rounded' shape
  // carries a numeric radius the deck can express; pill/ellipse/circle round in CSS
  // to values (9999px/50%) the flat px radius can't carry, so they lower to a plain
  // rect in v1 (documented). A stroke → the rect's line.
  var rect = { t: 'rect', x: lx, y: ly, w: cw, h: ch, fill: safeColor(cb.bg, 'transparent') };
  if (String(cb.shape) === 'rounded') rect.radius = num(cb.radius, 0);
  var sw = num(cb.strokeW, 0);
  var sc = safeColor(cb.stroke, '');
  if (sc && sw > 0) rect.line = { color: sc, w: sw };
  return rect;
}

// Build the whole deck model, or undefined when no frame exists (same gate as
// frameGroupsFor). Re-runs the frame filter + order-asc-then-x sort + fid derivation
// so slide order == page order; a pptx deck has ONE slide size, taken from the first
// frame (matches export-pptx reading page 0's size). The slide bg uses a CONCRETE hex
// fallback (#ffffff), never the var(--lolly-frame-surface,…) CSS string the page
// render uses — deckColor parses only hex/rgb.
function deckModelFor(boxes, byId) {
  var frameEntries = [];
  for (var f = 0; f < boxes.length; f++) {
    var fb = boxes[f];
    if (!fb || String(fb.kind) !== 'frame') continue;
    frameEntries.push({ box: fb, idx: f, order: num(fb.order, 0), x: num(fb.x, 0) });
  }
  if (!frameEntries.length) return undefined;
  frameEntries.sort(function (a, b) { return (a.order - b.order) || (a.x - b.x); });

  var first = frameEntries[0].box;
  var size = { w: Math.max(1, Math.round(num(first.w, 1))), h: Math.max(1, Math.round(num(first.h, 1))) };

  var slides = frameEntries.map(function (fe) {
    var fbx = fe.box;
    var fx = Math.round(num(fbx.x, 0));
    var fy = Math.round(num(fbx.y, 0));
    var fid = (fbx.id != null && fbx.id !== '') ? String(fbx.id) : String(fe.idx);
    var elements = [];
    for (var j = 0; j < boxes.length; j++) {
      var cb = boxes[j];
      if (!cb || String(cb.kind) === 'frame') continue;               // a frame is a page, never a child
      if (String(cb.frame == null ? '' : cb.frame) !== fid) continue; // scratch / other frame omitted
      var lx = Math.round(num(cb.x, 0)) - fx;
      var ly = Math.round(num(cb.y, 0)) - fy;
      var el = deckElementFor(cb, byId, lx, ly);
      if (el) elements.push(el);
    }
    return { bg: safeColor(fbx.bg, '#ffffff'), elements: elements };
  });
  return { size: size, slides: slides };
}

function compute(model) {
  var inp = inputsFrom(model);
  var boxes = Array.isArray(inp.boxes) ? inp.boxes : [];
  // plan 96 P4 — any plan-90 `connectors` edge becomes a bound path box before anything
  // else reads `boxes`, so every surface below (the per-box arrays, the frame groups, the
  // deck model, the committed line layer) sees ONE model with no edges in it.
  var transparent = inp.transparentBg === true;
  var byId = {};
  boxes.forEach(function (b) { if (b && b.id != null && b.id !== '') byId[String(b.id)] = b; });
  // An audio box or a camera marker renders NOTHING visible: no fill (boxCss), no media
  // (mediaHtmlFor emits a display:none marker), no text, and — the part that is easy to
  // miss — no shadow, no clip and no blur either. `shadow`/`blur` are plain sidebar fields
  // with no showFor restriction, so a bare box can carry one, and box-shadow/drop-shadow/
  // blur paint OUTSIDE the (transparent) box: without this they would print a stray
  // rectangle of colour exactly where the music bed or the camera sits, which is the one
  // thing this contract promises never happens.
  var NO_SHADOW = { box: '', text: '', filterFn: '' };
  var shadows = boxes.map(function (b) { return isBareBox(b) ? NO_SHADOW : shadowCss(b || {}); });
  var boxStyle = boxes.map(function (b, i) {
    var bare = isBareBox(b);
    var fx = [];
    var bl = bare ? '' : blurCss(b || {});
    if (bl) fx.push(bl);
    if (shadows[i].filterFn) fx.push(shadows[i].filterFn);
    return boxCss(b || {}, bare ? '' : gradCssFor(b || {})) + (bare ? '' : clipCss(b || {}, byId)) + shadows[i].box +
      (fx.length ? 'filter:' + fx.join(' ') + ';' : '');
  });
  var textStyle = boxes.map(function (b, i) { return textCss(b || {}) + shadows[i].text; });
  var textHtml = boxes.map(function (b) { return isBareBox(b) ? '' : richText((b && b.text) || ''); });
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
  // Hand-authored frames (plan 93 F1a-part-2). undefined when no kind:'frame' box
  // exists → {{#if frameGroups}} false → the template's {{else}} renders today's single
  // artboard byte-identically. Reuses the index-aligned per-box arrays above.
  var frameArrays = {
    boxStyle: boxStyle, textStyle: textStyle, textHtml: textHtml,
    mediaHtml: mediaHtml, pathHtml: pathHtml, boxFit: boxFit, timeAttrs: timeAttrs,
  };
  var frameGroups = frameGroupsFor(boxes, frameArrays);
  // Pasteboard only when frames exist: without a frame the single {{else}} artboard
  // renders every box already, so it stays undefined and no loose copy is emitted.
  var pasteboard = frameGroups ? pasteboardFor(boxes, frameArrays) : undefined;
  // Native-pptx deck model (plan 95 route-a): emitted ONLY when frames exist, so a
  // no-frames design stays byte-identical and uses export-pptx's DOM-walk fallback.
  // `deckJson` collides with no input id (inputs: background/transparentBg/connectors/
  // boxes + box fields) so the runtime routes it to extras; the template reads
  // {{{deckJson}}} into <script data-pptx-deck>, exactly like deck-studio.
  var deckJson = frameGroups ? safeJson(deckModelFor(boxes, byId)) : undefined;
  var out = {
    boxStyle: boxStyle,
    textStyle: textStyle,
    textHtml: textHtml,
    mediaHtml: mediaHtml,
    pathHtml: pathHtml,
    boxFit: boxFit,
    timeAttrs: timeAttrs,
    seqAttrs: seqAttrs,
    bgStyle: [transparent ? 'transparent' : safeColor(inp.background, '#ffffff')],
    connectorSvg: lineLayerFor(boxes),
    frameGroups: frameGroups,
    pasteboard: pasteboard,
    deckJson: deckJson,
  };
  // The migration's INPUT patch (plan 96 P4). `boxes` and `connectors` are declared input
  // ids, so the runtime WRITES them rather than treating them as extras — which is what
  // makes this a one-time conversion: the next compute() sees no edges and adds neither
  // key. The keys are ASSIGNED, never set to undefined: the runtime's patch merge keys off
  // key PRESENCE, so `{ boxes: undefined }` does not mean "no opinion", it blanks the
  // input — and a hook that blanks `boxes` on every render empties the whole document.
  return out;
}

function onInit(ctx) { return compute(ctx.model); }
function onInput(ctx) { return compute(ctx.model); }

// The export bar's "No BG" toggle (render.transparentBg) makes the raster export
// alpha; the live artboard already reflects it via compute() above.
function beforeExport(ctx) {
  var inp = inputsFrom(ctx.model);
  if (inp.transparentBg === true) ctx.opts.background = 'transparent';
}
