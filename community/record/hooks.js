/* global onInit, onInput, beforeExport, host */

/**
 * Record - an editable intro/outro around a camera clip.
 *
 * A three-frame free-canvas filmstrip: an INTRO card, your CAMERA, and an OUTRO
 * card, side by side. Derived from Carousel Maker: each object is one row of the
 * `boxes` blocks input carrying flat GLOBAL geometry (x/y/w/h/rot) across the whole
 * strip. This hook buckets objects into their frame (nearest centre column), shifts
 * each into that frame's LOCAL space, and precomputes a CSS string per object - so
 * Handlebars stays logic-less and a headless CLI/URL render matches the browser.
 *
 * Two things make it a recorder rather than a carousel:
 *   • the MIDDLE frame (index 1) renders a [data-record-camera] placeholder the shell
 *     fills with the live viewfinder (framing) / self-view (during the take); objects
 *     on that frame are OVERLAYS composited over the footage (lower-third, logo bug).
 *   • every object carries a `transition` + `delay`, surfaced as data-* attributes so
 *     the export compositor (export.renderRecord) animates each one individually.
 *
 * This hook is PURE (no DOM, no async).
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
// === lolly:shared clamp - generated from community/_shared/math.js; edit there and run npm run sync:shared ===
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
// === /lolly:shared clamp ===

// Only let a value through if it's a shape CSS colour can't be smuggled past - box
// fill/text colour come from colour inputs, but a hand-edited URL could carry
// anything, and these land inside a style="" attribute, so guard against
// property-injection via a stray ';'.
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

function inlineMd(s) {
  s = s.replace(/\\\*/g, '').replace(/\\_/g, '');
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
      } else if (tok === 'mono' || tok === 'suse') {
        styles.push('font-family:' + fontFamily(tok === 'mono' ? 'SUSE Mono' : 'SUSE'));
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
  return s.replace(//g, '*').replace(//g, '_');
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
  var w = clamp(Math.round(num(b.weight, 700) / 100) * 100, 100, 900);
  if (String(b.font) === 'SUSE Mono' && w > 800) w = 800;
  return String(w);
}
// Resolve a font token to the ACTIVE brand's font via the injected brand vars (brand-vars
// sets --font-brand / --font-mono on the canvas root), so this renders under any brand and
// falls back to system fonts where a brand sets none. 'SUSE'/'SUSE Mono' are kept as aliases
// so sessions saved before this tool became brand-agnostic still resolve.
var SANS = "var(--font-brand, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif)";
var MONO = "var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace)";
var FONTS = { 'mono': MONO, 'sans': SANS, 'SUSE Mono': MONO, 'SUSE': SANS };
function fontFamily(v) { return FONTS[String(v)] || SANS; }
var FITS = { cover: 1, contain: 1, fill: 1, none: 1, 'scale-down': 1 };
var OBJPOS = {
  center: 1, 'center top': 1, 'center bottom': 1, 'left center': 1, 'right center': 1,
  'left top': 1, 'right top': 1, 'left bottom': 1, 'right bottom': 1,
  top: 1, bottom: 1, left: 1, right: 1,
};
var BLENDS = {
  multiply: 1, screen: 1, overlay: 1, darken: 1, lighten: 1, 'color-dodge': 1,
  'color-burn': 1, 'hard-light': 1, 'soft-light': 1, difference: 1, exclusion: 1,
  hue: 1, saturation: 1, color: 1, luminosity: 1,
};
// The transition vocabulary the export compositor understands (shared with digi-ad).
var TRANSITIONS = {
  fade: 1, pop: 1, grow: 1, rise: 1, drop: 1, 'slide-left': 1, 'slide-right': 1,
  'slide-up': 1, 'slide-down': 1, 'zoom-in': 1, 'zoom-out': 1, tilt: 1, swoop: 1,
  spin: 1, drift: 1, none: 1,
};
function transitionOf(b) { var t = String(b && b.transition || 'fade'); return TRANSITIONS[t] ? t : 'fade'; }

// The named easing curves the export compositor implements (lib/transitions.ts EASINGS).
var EASINGS = {
  linear: 1, 'ease-out': 1, 'ease-in': 1, 'ease-in-out': 1, overshoot: 1, anticipate: 1,
};

// An authored easing, canonicalised for the attribute: a whitelisted preset name, or a
// cubic-bezier re-emitted from its own PARSED numbers rather than the user's string.
// The x controls are TIME and must stay inside 0..1 or the curve is not a function of
// progress (CSS refuses the same thing); y is unbounded, which is the overshoot family.
// Anything else answers '' and the compositor keeps the transition's built-in curve -
// the same shape sequence-studio's timeAttrsFor uses, and the same vocabulary
// shells/web/src/lib/transitions.ts re-validates on the way in.
function easeOf(b) {
  var v = b && b.transitionEase;
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
  var pos = String(b.imgpos == null ? '' : b.imgpos).trim();
  return 'object-fit:' + fit + ';' +
    (OBJPOS[pos] && pos !== 'center' ? 'object-position:' + pos + ';' : '');
}

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
  if (isVideo) {
    var vkey = b && b.id != null ? esc(String(b.id)) : esc(url);
    return '<video class="lolly-box-img lolly-box-video" src="' + esc(url) +
      '" data-video-key="' + vkey + '" muted loop autoplay playsinline style="' + style + '"></video>';
  }
  return '<img class="lolly-box-img" src="' + esc(url) + '" style="' + style + '" alt="" draggable="false">';
}

function rot2(px, py, deg) {
  var r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
  return [px * c - py * s, px * s + py * c];
}
function f2(v) { return Math.round(v * 100) / 100; }

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
  var pad = Math.round(clamp(num(b.pad, 8), 0, 400));
  return (
    'text-align:' + align + ';' +
    'color:' + safeColor(b.fg, '#ffffff') + ';' +
    'font-family:' + fontFamily(b.font) + ';' +
    'font-size:' + size + 'px;' +
    'font-weight:' + weight + ';' +
    'line-height:' + clamp(num(b.lineHeight, 1.1), 0.5, 4) + ';' +
    'padding:' + pad + 'px;' +
    typeFeatureCss(b)
  );
}

/**
 * Subtitles. Whatever dialect arrived in the `transcript` input (the shell's
 * Transcribe button writes SRT, a dropped-in file may be either) is parsed once
 * and written back as one clean dialect, so the .srt / .vtt that travels with the
 * video is the same shape whichever way it got here. Shared with the captions tool
 * and the other recorders, so one file reads the same everywhere.
 *
 * The cues are NOT burned into the picture: the compositor (export.renderRecord)
 * rasterises each object once and draws that bitmap for the whole phase, so a
 * caption in the DOM would freeze on one cue. A sidecar is the honest answer until
 * the compositor can draw a caption per frame.
 */
// === lolly:shared cues - generated from community/_shared/captions.js; edit there and run npm run sync:shared ===
function pad(n, w) { var s = String(n); while (s.length < w) s = '0' + s; return s; }
function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

/** "00:00:01,500", "00:01.5" or "1:02:03.250" to seconds, or null. */
function stampToSeconds(raw) {
  var m = /^(?:(\d+):)?(\d{1,2}):(\d{1,2})[.,](\d{1,3})$/.exec(String(raw == null ? '' : raw).trim());
  if (!m) return null;
  var hours = m[1] ? Number(m[1]) : 0;
  // One or two digits after the separator are tenths and hundredths, not
  // milliseconds: "0.5" is half a second.
  var frac = Number((m[4] + '00').slice(0, 3));
  return hours * 3600 + Number(m[2]) * 60 + Number(m[3]) + frac / 1000;
}

/** Seconds to HH:MM:SS<sep>mmm. The engine's `stamp`, mirrored. */
function fmtStamp(seconds, sep) {
  var ms = Math.max(0, Math.round(seconds * 1000));
  var h = Math.floor(ms / 3600000);
  var m = Math.floor((ms % 3600000) / 60000);
  var s = Math.floor((ms % 60000) / 1000);
  return pad(h, 2) + ':' + pad(m, 2) + ':' + pad(s, 2) + sep + pad(ms % 1000, 3);
}

/** The five entities a subtitle file is allowed to carry. `&amp;` goes last, so
 *  "&amp;lt;" decodes to "&lt;" and not to "<". */
function decodeEntities(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');
}

/** Cue payload to one clean line: tags out, entities decoded, runs of
 *  whitespace (line breaks included) collapsed to single spaces. */
function cleanText(s) {
  return decodeEntities(String(s).replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
}

/**
 * Parse SRT or WebVTT into cues, plus the warnings worth telling the user about.
 * Source order is kept: a file whose cues are out of order is reported, never
 * quietly rewritten, because the person who owns the file should decide.
 */
function parseCues(raw) {
  var warnings = [];
  var cues = [];
  var text = String(raw == null ? '' : raw)
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n');
  if (!text.trim()) return { cues: cues, warnings: warnings };

  var blocks = text.split(/\n{2,}/);
  var malformed = 0;
  for (var b = 0; b < blocks.length; b++) {
    var block = blocks[b].trim();
    if (!block) continue;
    var lines = block.split('\n');
    // WebVTT metadata blocks. A NOTE may hold anything, an arrow included.
    if (/^(NOTE|STYLE|REGION)\b/.test(lines[0])) continue;
    var at = -1;
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].indexOf('-->') >= 0) { at = i; break; }
    }
    // No timing line. The WEBVTT signature is the one block that is meant to
    // look like this (matched on its own text rather than on being block zero,
    // so a file that opens with blank lines still reads as a header). Anything
    // else is words that will never reach the screen, so it is counted rather
    // than dropped in silence - the whole point of the warnings.
    if (at < 0) {
      if (!/^WEBVTT/.test(block)) malformed++;
      continue;
    }
    var parts = lines[at].split('-->');
    var start = stampToSeconds(parts[0]);
    // Cue settings (line:90%, align:start, …) trail the out-point on the same line.
    var end = stampToSeconds(String(parts[1] == null ? '' : parts[1]).trim().split(/\s+/)[0]);
    if (start === null || end === null) { malformed++; continue; }
    // Lines before the timing are the optional cue id, which carries no meaning
    // once the cues are renumbered on the way out.
    var body = cleanText(lines.slice(at + 1).join(' '));
    // Timed, but nothing left after the tags come out. Counted too: a cue that
    // vanishes is exactly the kind of quiet loss the count exists to surface.
    if (!body) { malformed++; continue; }
    cues.push({ start: start, end: end, text: body });
  }

  if (!cues.length) {
    warnings.push('No timed cues found. Paste SRT or WebVTT text, or transcribe the clip.');
  }
  if (malformed) {
    warnings.push(plural(malformed,
      'block was skipped: it is not a readable cue.',
      'blocks were skipped: they are not readable cues.'));
  }
  var backwards = 0;
  var overlaps = 0;
  var unordered = 0;
  for (var c = 0; c < cues.length; c++) {
    if (cues[c].end <= cues[c].start) backwards++;
    if (c > 0) {
      if (cues[c].start < cues[c - 1].start) unordered++;
      else if (cues[c].start < cues[c - 1].end) overlaps++;
    }
  }
  if (backwards) warnings.push(plural(backwards, 'cue ends before it starts.', 'cues end before they start.'));
  if (unordered) warnings.push(plural(unordered, 'cue starts before the one before it.', 'cues start before the ones before them.'));
  if (overlaps) warnings.push(plural(overlaps, 'cue overlaps the one before it.', 'cues overlap the ones before them.'));
  return { cues: cues, warnings: warnings };
}

/** SubRip: 1-based numbered blocks, comma milliseconds. Empty in, empty out -
 *  never a file holding one lonely newline. */
function toSrt(cues) {
  if (!cues.length) return '';
  var out = [];
  for (var i = 0; i < cues.length; i++) {
    out.push((i + 1) + '\n' + fmtStamp(cues[i].start, ',') + ' --> ' + fmtStamp(cues[i].end, ',') + '\n' + cues[i].text);
  }
  return out.join('\n\n') + '\n';
}

/**
 * WebVTT cue text may not carry a bare `&` or `<` (the grammar reads them as an
 * escape and a tag opener), so both go back out encoded. `decodeEntities` is the
 * exact inverse, so re-importing our own file gives the same text back.
 * SubRip has no such rule and plenty of players print an entity literally, so
 * the .srt sidecar keeps the characters as the author wrote them.
 */
function vttEscape(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

/** WebVTT: header, dot milliseconds, no numbering. */
function toVtt(cues) {
  if (!cues.length) return '';
  var out = [];
  for (var i = 0; i < cues.length; i++) {
    out.push(fmtStamp(cues[i].start, '.') + ' --> ' + fmtStamp(cues[i].end, '.') + '\n' + vttEscape(cues[i].text));
  }
  return 'WEBVTT\n\n' + out.join('\n\n') + '\n';
}

/** Index of the cue on screen at `t`, or -1 during silence. A cue covers
 *  [start, end) - at exactly `end` it has left, the engine's `cueAt` rule.
 *  Where cues overlap the earlier one wins, which is what a player does. */
function cueIndexAt(cues, t) {
  for (var i = 0; i < cues.length; i++) {
    if (t >= cues[i].start && t < cues[i].end) return i;
  }
  return -1;
}
// === /lolly:shared cues ===

// Parsing is the one thing a keystroke in another field must not redo, so it gets
// its own memo keyed on the transcript text.
var _cueKey = null;
var _cueVal = null;

/** The transcript as cues on the COMPOSITED timeline: a cue is timed against the
 *  clip, and the export plays the intro card before it, so every cue moves along
 *  by the intro. */
function subtitles(raw, introMs) {
  var text = String(raw == null ? '' : raw);
  var key = introMs + '\n' + text;
  if (key === _cueKey) return _cueVal;
  var out = [];
  try {
    var by = introMs / 1000;
    var cues = parseCues(text).cues;
    for (var i = 0; i < cues.length; i++) {
      out.push({ start: cues[i].start + by, end: cues[i].end + by, text: cues[i].text });
    }
  } catch {
    // An unreadable transcript means empty sidecars, never a broken render.
    out = [];
  }
  _cueKey = key;
  _cueVal = out;
  return out;
}

// GAP between frames, in px. MUST match styles.css `.rec-strip { gap }` and
// render.pages.gap in tool.json - the free-canvas overlay reads the frames' real DOM
// offsets, so it's immune to drift, but a mismatch here would render objects at the
// wrong spot inside their frame.
var GAP = 56;
var ROLES = ['intro', 'body', 'outro'];

function compute(model) {
  var inp = inputsFrom(model);
  var boxes = Array.isArray(inp.boxes) ? inp.boxes : [];
  // Fixed at three frames: intro | camera | outro.
  var count = 3;
  var pw = Math.max(1, Math.round(num(inp.pageW, 1080)));
  var ph = Math.max(1, Math.round(num(inp.pageH, 1920)));
  var stride = pw + GAP;
  var brand = safeColor(inp.brandColor, '#0c322c');
  var accent = safeColor(inp.accent, '#30ba78');

  var byId = {};
  boxes.forEach(function (b) { if (b && b.id != null && b.id !== '') byId[String(b.id)] = b; });

  // Which frame an object belongs to = the frame whose centre column is nearest the
  // object centre. Clamped to [0,2].
  function frameOf(b) {
    var cx = num(b && b.x, 0) + Math.max(1, num(b && b.w, 1)) / 2;
    var idx = Math.round((cx - pw / 2) / stride);
    return clamp(idx, 0, count - 1);
  }

  // Empty buckets first so every frame renders (even with no objects on it). The
  // middle frame (body) has no solid background - the camera / footage shows there.
  var frames = [];
  for (var p = 0; p < count; p++) {
    var role = ROLES[p];
    frames.push({
      frameNo: p + 1,
      role: role,
      isCamera: role === 'body',
      bg: role === 'body' ? '#000000' : brand,
      boxes: [],
    });
  }

  var shadows = boxes.map(function (b) { return shadowCss(b || {}); });
  for (var i = 0; i < boxes.length; i++) {
    var b = boxes[i] || {};
    var fr = frameOf(b);
    var lb = {};
    for (var k in b) if (Object.prototype.hasOwnProperty.call(b, k)) lb[k] = b[k];
    lb.x = Math.round(num(b.x, 0) - fr * stride);
    lb.y = Math.round(num(b.y, 0));
    frames[fr].boxes.push({
      flatIndex: i,
      id: b.id != null ? b.id : i,
      role: frames[fr].role,
      transition: transitionOf(b),
      transitionEase: easeOf(b),
      delay: Math.round(clamp(num(b.delay, 0), 0, 4000)),
      boxStyle: boxCss(lb) + clipCss(b, byId) + shadows[i].box + shadows[i].filter,
      textStyle: textCss(lb) + shadows[i].text,
      textHtml: richText((b && b.text) || ''),
      mediaHtml: mediaHtmlFor(b),
    });
  }

  var introMs = Math.round(clamp(num(inp.introMs, 2200), 300, 8000));
  var outroMs = Math.round(clamp(num(inp.outroMs, 2400), 300, 8000));
  var enterMs = Math.round(clamp(num(inp.enterMs, 650), 100, 3000));

  // NOTE: the output key is `frames`, NOT `pages` - matching a declared input id
  // (`frames` is our COUNT input) would clobber it via patch semantics. `framesOut`
  // sidesteps that; the template loops `framesOut`.
  // The .srt / .vtt sidecars (template.srt / template.vtt), timed against the
  // composited video rather than the raw take - see subtitles().
  var cues = subtitles(inp.transcript, introMs);

  return {
    framesOut: frames,
    recSrt: toSrt(cues),
    recVtt: toVtt(cues),
    introMs: introMs,
    outroMs: outroMs,
    enterMs: enterMs,
    brand: brand,
    accent: accent,
    stripStyle: '--pw:' + pw + 'px;--ph:' + ph + 'px;--gap:' + GAP + 'px;--brand:' + brand + ';--accent:' + accent + ';',
  };
}

function onInit(ctx) { return compute(ctx.model); }
function onInput(ctx) { return compute(ctx.model); }

// Video export always composites the bookends + footage in real time (renderRecord),
// so nothing to do here; kept for a still poster's transparent-bg opt (unused today).
function beforeExport() { /* no-op */ }
