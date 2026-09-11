/**
 * Jump Page hooks.
 *
 * Reads the `links` table into the list the logic-less template prints: one
 * entry per usable link, each with a resolved href, a display label and the
 * bare host name, plus the per-scene class names and the split heading the
 * `cinema` style needs - the template is logic-less, so every scrap of
 * computation lives here. It also resolves the page's colours TWICE, once per
 * colour scheme, so the same page reads in the light and in the dark. DOM-free
 * and memoized on the input values, so the CLI and the node tests run the same
 * path the web shell does. Nothing here throws: a page with no usable links
 * comes back as a hint the template renders in place.
 *
 * The page itself is the point of the tool: the whole state rides in the share
 * link (packed `z` / password-gated `zx` like any tool), so any Lolly - a
 * static host, the PWA offline, someone else's install - rebuilds the same
 * landing page from the link alone, with nothing stored on a server.
 */

var JUMP_MAX = 10;

// A glyph is one emoji, not a caption: capped by GRAPHEME so the cut can never
// leave a lone surrogate half behind, nor split a ZWJ sequence (a family, a
// profession, a flag) into a different emoji plus a dangling joiner.
var ICON_MAX = 4;

// The stagger index the opening scene delays each word by. Capped because a
// heading arriving from a hand-typed link is not bounded by the manifest's
// maxLength (the engine constrains edits, not initial values), and an
// uncapped index holds the tail of a long heading at opacity 0 for seconds.
var WORD_STAGGER_MAX = 12;

// Scene wash classes, cycled per link: clean paper, accent tint, the full
// accent crescendo, shaded paper. Dealt in this order so a three-link page
// (the default) lands its last scene on the crescendo before the dark close.
// The template is logic-less, so the cycling happens here.
var WASHES = ['jp-wash-a', 'jp-wash-b', 'jp-wash-c', 'jp-wash-d'];

// One dial over every cinema animation (travel distance + stagger step).
var MOODS = { calm: '0.6', bold: '1', electric: '1.6' };

// Fallbacks for every colour input. A colour default is a token alias that
// resolves to '' on a brand with no tokens, so each one needs a literal here.
var INK_FALLBACK = '#17232b';
var PAPER_FALLBACK = '#f7f8fa';
var ACCENT_FALLBACK = '#2563eb';

function _str(v) {
  return String(v == null ? '' : v).trim();
}

// Accept #rgb or #rrggbb (with or without the hash); anything else takes the
// fallback, so a blank token alias can never paint a transparent sheet.
function _hex(v, fallback) {
  var m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(_str(v));
  if (!m) return fallback;
  var h = m[1].toLowerCase();
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return '#' + h;
}

function _rgb(hex) {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

// Hex to HSL, as [hue 0..360, saturation 0..1, lightness 0..1]. HSL rather than
// OKLCH because everything below only ever moves the hue or the lightness, and
// HSL does both in a dozen lines the CLI and the browser run identically.
function _toHsl(hex) {
  var c = _rgb(hex);
  var r = c[0] / 255, g = c[1] / 255, b = c[2] / 255;
  var max = Math.max(r, g, b), min = Math.min(r, g, b);
  var l = (max + min) / 2;
  var d = max - min;
  var s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  var h = 0;
  if (d !== 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  return [(h + 360) % 360, s, l];
}

function _fromHsl(h, s, l) {
  h = (h + 360) % 360;
  l = Math.min(1, Math.max(0, l));
  var C = (1 - Math.abs(2 * l - 1)) * s;
  var X = C * (1 - Math.abs(((h / 60) % 2) - 1));
  var m = l - C / 2;
  var rgb = h < 60 ? [C, X, 0] : h < 120 ? [X, C, 0] : h < 180 ? [0, C, X]
    : h < 240 ? [0, X, C] : h < 300 ? [X, 0, C] : [C, 0, X];
  var to = function (v) { return ('0' + Math.round((v + m) * 255).toString(16)).slice(-2); };
  return '#' + to(rgb[0]) + to(rgb[1]) + to(rgb[2]);
}

// The aurora's mesh companions: the accent walked around the hue wheel (and
// optionally re-lit). Computed here, not in CSS, because the WebGL shader needs
// them as plain numbers - and hooks run identically in the CLI, so every shell
// hands the shader the same palette.
function _hueShift(hex, deg, lightMul) {
  var c = _toHsl(hex);
  return _fromHsl(c[0] + deg, c[1], c[2] * lightMul);
}

// The counterpart of an authored colour for the other colour scheme: same hue,
// same saturation, lightness turned end for end, then held inside a band so the
// pair always sits on opposite sides of the middle. Without the band a
// mid-grey paper would flip to another mid-grey and the two schemes would be
// the same page twice.
function _flipL(hex, floorL, ceilL) {
  var c = _toHsl(hex);
  return _fromHsl(c[0], c[1], Math.min(ceilL, Math.max(floorL, 1 - c[2])));
}

// An accent dark enough to vanish against a dark page gets lifted to a floor.
// Additive rather than a multiplier, because multiplying a near-black accent
// leaves it near-black.
function _lift(hex, minL) {
  var c = _toHsl(hex);
  return c[2] >= minL ? hex : _fromHsl(c[0], c[1], minL);
}

function _luma(hex) {
  var c = _rgb(hex);
  return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
}

// One colour scheme, complete: the three colours it is built from plus the four
// companions every style reads - the ink that sits on the accent, the muted
// type, the hairline edge and the card fill. All four follow from how light the
// PAPER of this scheme is, so the same rules produce a sane light set and a sane
// dark set with no second code path.
//
// `shade` is the scheme's genuinely dark end (the ink on a light page, the paper
// on a dark one). Only one thing needs it: the Cover story duotone drops it into
// the picture's shadows with a multiply pass, and multiply by a near-white ink
// on the dark scheme would do nothing at all.
function _scheme(ink, paper, accent) {
  var light = _luma(paper) > 0.5;
  return {
    ink: ink,
    paper: paper,
    accent: accent,
    shade: light ? ink : paper,
    onAccent: _luma(accent) > 0.6 ? '#111111' : '#ffffff',
    muted: light ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.62)',
    edge: light ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.18)',
    card: light ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.07)',
  };
}

// A typed address is often bare ("suse.com"): give it a scheme so the anchor
// works, but leave anything that already has one (https, mailto, tel) alone.
function _href(raw) {
  var s = _str(raw);
  if (!s) return '';
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return s;
  return 'https://' + s;
}

// The bare host for display and for the label fallback: no scheme, no www.,
// no path unless the path is the interesting part (mailto keeps its address).
function _host(href) {
  var m = /^[a-z][a-z0-9+.-]*:\/\/([^/?#]+)/i.exec(href);
  if (m) return m[1].replace(/^www\./i, '');
  return href.replace(/^[a-z][a-z0-9+.-]*:/i, '');
}

// A redirect NAVIGATES on visit, so its scheme has to be safe to hand to
// location.replace: http(s)/mailto/tel only. `javascript:`/`data:` etc. would
// execute, so they never become a redirect target (the page falls back to the
// link list). An anchor href a click away is contained; an auto-forward is not.
function _safeRedirect(href) {
  return /^(https?|mailto|tel):/i.test(href) ? href : '';
}

function _icon(v) {
  var s = _str(v).replace(/\s+/g, '');
  var units = typeof Intl !== 'undefined' && Intl.Segmenter
    ? Array.from(new Intl.Segmenter().segment(s), function (x) { return x.segment; })
    : Array.from(s);
  return units.slice(0, ICON_MAX).join('');
}

// A scene with no chosen glyph gets a ghost instead: the label's first
// grapheme, which the cinema sets huge in the brand face as the parallax
// layer - so an icon-less page still composes. Uppercased, because a lone
// letterform reads as a mark, not a typo.
function _ghost(label) {
  var s = _str(label);
  if (!s) return '';
  var units = typeof Intl !== 'undefined' && Intl.Segmenter
    ? Array.from(new Intl.Segmenter().segment(s), function (x) { return x.segment; })
    : Array.from(s);
  return (units[0] || '').toLocaleUpperCase();
}

// The heading, one span per word, so the opening scene can stagger them in.
function _words(v) {
  return _str(v).split(/\s+/).filter(Boolean).map(function (w, i) {
    return { w: w, i: i < WORD_STAGGER_MAX ? i : WORD_STAGGER_MAX };
  });
}

// A boolean arrives as a real boolean from the model and as text from a
// hand-typed URL, so both spellings of "off" have to count.
function _bool(v, dflt) {
  if (v === undefined || v === null || v === '') return dflt;
  if (typeof v === 'string') return !/^(0|false|off|no)$/i.test(v.trim());
  return !!v;
}

// An asset input's value is a ref object (or an id string) when a picture is
// chosen, null/'' when the slot is empty. The template resolves the picture
// itself via {{asset ...}}; hooks only need the presence flag for the
// structural branches.
function _hasAsset(v) {
  if (!v) return '';
  if (typeof v === 'string') return _str(v) ? '1' : '';
  return v.id || v.url ? '1' : '';
}

function compute(args) {
  // The links table: one row per link, cells in column order [url, name, emoji].
  // A hand-typed link can hand us anything, so both the table and each row are
  // checked before they are read, and a short row simply has empty tail cells.
  var table = args.links && typeof args.links === 'object' ? args.links : null;
  var rows = table && Array.isArray(table.rows) ? table.rows : [];
  var items = [];
  for (var i = 0; i < rows.length && items.length < JUMP_MAX; i++) {
    var row = Array.isArray(rows[i]) ? rows[i] : [];
    var href = _href(row[0]);
    if (!href) continue;
    var host = _host(href);
    var n = items.length;
    var label = _str(row[1]) || host;
    var icon = _icon(row[2]);
    items.push({
      href: href,
      host: host,
      label: label,
      icon: icon,
      ghost: icon ? '' : _ghost(label),
      // The Front page's index numeral, always two digits so the column sets.
      num: (n + 1 < 10 ? '0' : '') + (n + 1),
      // A stable per-item seed 0..9 for the Playroom's float phase/duration -
      // derived from position, so the same link always drifts the same way.
      seed: String((n * 7 + 3) % 10),
      n: String(n),
      sceneParity: n % 2 ? 'jp-odd' : 'jp-even',
      sceneWash: WASHES[n % WASHES.length],
    });
  }

  // On visit: 'page' (default) shows the list; 'forward' redirects to the first
  // link; 'gate' redirects after a press-and-hold human check. The redirect only
  // arms when there's a safe first link - otherwise it quietly shows the list.
  var onVisit = _str(args.onVisit) || 'page';
  var redirectHref = onVisit !== 'page' && items.length ? _safeRedirect(items[0].href) : '';

  // A hand-typed URL value never passes the select's option whitelist (the
  // engine constrains edits, not initial values), so `mood` is looked up as an
  // own property - `constructor` and friends would otherwise resolve.
  var mood = _str(args.mood);
  var style = _str(args.style) || 'cinema';

  var ink = _hex(args.color, INK_FALLBACK);
  var paper = _hex(args.background, PAPER_FALLBACK);
  var accent = _hex(args.accent, ACCENT_FALLBACK);

  // Both colour schemes, every time. The authored palette is whichever one its
  // own paper belongs to; the other is derived from it, so a page built in the
  // light also has a dark reading and the CSS picks between them per visitor.
  // Nothing here decides which one shows - that is prefers-color-scheme's job.
  var authoredIsLight = _luma(paper) > 0.5;
  var lightSet = authoredIsLight
    ? _scheme(ink, paper, accent)
    : _scheme(_flipL(ink, 0, 0.18), _flipL(paper, 0.93, 1), accent);
  var darkSet = authoredIsLight
    ? _scheme(_flipL(ink, 0.88, 1), _flipL(paper, 0, 0.16), _lift(accent, 0.42))
    : _scheme(ink, paper, _lift(accent, 0.42));

  // The styles with a composed close (an end card / folio) show the footer;
  // the plain lists never did and still don't.
  var ANIMATED = { cinema: 1, aurora: 1, editorial: 1, mural: 1, orbit: 1 };

  return {
    items: items,
    headingWords: _words(args.heading),
    // Content defaults are EMPTY on purpose (nothing a CLI user or hand-typed
    // link never asked for may travel), so the template needs a real flag to
    // drop the empty heading/footer nodes instead of printing hollow tags.
    hasHeading: _str(args.heading) ? '1' : '',
    motionScale: Object.prototype.hasOwnProperty.call(MOODS, mood) ? MOODS[mood] : MOODS.calm,
    hasAvatar: _hasAsset(args.avatar),
    hasBackdrop: _hasAsset(args.backdrop),
    showFooter: Object.prototype.hasOwnProperty.call(ANIMATED, style) && _bool(args.footer, true) ? '1' : '',
    showCue: items.length && !redirectHref ? '1' : '',
    linkCount: items.length ? String(items.length) : '',
    error: items.length ? '' : 'Add a link to build the page.',
    redirect: redirectHref ? '1' : '',
    challenge: redirectHref && onVisit === 'gate' ? '1' : '',
    redirectHref: redirectHref,
    redirectHost: redirectHref ? _host(redirectHref) : '',

    // The light scheme. The template writes these into --jp-*-l, never into the
    // bare --jp-* the styles read: one mapping block at the top of the
    // stylesheet points the bare names at one set or the other.
    inkL: lightSet.ink,
    paperL: lightSet.paper,
    accentL: lightSet.accent,
    shadeL: lightSet.shade,
    onAccentL: lightSet.onAccent,
    mutedL: lightSet.muted,
    edgeL: lightSet.edge,
    cardL: lightSet.card,

    // The dark scheme, the same eight names.
    inkD: darkSet.ink,
    paperD: darkSet.paper,
    accentD: darkSet.accent,
    shadeD: darkSet.shade,
    onAccentD: darkSet.onAccent,
    mutedD: darkSet.muted,
    edgeD: darkSet.edge,
    cardD: darkSet.card,

    // The aurora's shader palette, one set per scheme: the shader is a canvas,
    // not CSS, so the template script picks the pair and re-uploads them when
    // the visitor's scheme changes under it.
    meshBL: _hueShift(lightSet.accent, 55, 1.05),
    meshCL: _hueShift(lightSet.accent, -60, 0.8),
    meshBD: _hueShift(darkSet.accent, 55, 1.05),
    meshCD: _hueShift(darkSet.accent, -60, 0.8),
  };
}

// One-entry memo, keyed on the whole args object so every input is covered by
// construction (same pattern as the other list tools).
var _memoKey = null;
var _memoResult = null;

function _run(model) {
  var args = Object.fromEntries(model.map(function(i) { return [i.id, i.value]; }));
  var key = JSON.stringify(args);
  if (key === _memoKey) return _memoResult;
  _memoKey = key;
  _memoResult = compute(args);
  return _memoResult;
}

function onInit({ model }) {
  return _run(model);
}

function onInput({ model }) {
  return _run(model);
}
