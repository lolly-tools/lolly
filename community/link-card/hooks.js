/* global host */
/**
 * Link Card hooks.
 *
 * A share card for one link: the title, the description, a site chip and a
 * thumbnail, at whichever of the three sizes the platform wants.
 *
 * NOTHING HERE FETCHES THE PAGE. The title, the description and the site name
 * are typed in. community/url-shot has no page-title or description
 * extraction to reuse (it captures pixels and geometry, never the document's
 * metadata), so reading them would mean a new network surface, and this tool
 * adds none. The one live thing on the card is the thumbnail slot, and that
 * is an ORDINARY asset input: a user can paste a Lolly tool link into it
 * (docs/authoring-tools.md, "Use any tool as an image") and the runtime
 * re-renders that tool through host.compose.renderUrl on every mount - so a
 * URL Capture link becomes a live screenshot with no host.capture call and no
 * authored `composes` entry here. On a shell with no compose bridge the slot
 * is simply empty and the monogram panel prints instead.
 *
 * The `layout` select carries width / height / unit per option, which is what
 * the shell reads to set the export size (views/export-size.ts), so picking
 * Open Graph really does export a 1200 x 630 image. The same numbers are
 * stamped on the root here so a test can read back what the render was drawn
 * for.
 *
 * Nothing throws: a failure comes back as an `error` note the template prints
 * in place of the card.
 */

// Every card size, in CSS pixels. Keys are the `layout` values and must stay
// in step with the manifest's option list (tests/link-card.test.ts pins them
// together). `stack` puts the thumbnail above the text instead of beside it.
var LAYOUTS = {
  'og-horizontal': { w: 1200, h: 630, unit: 'px', shape: 'split' },
  square: { w: 1080, h: 1080, unit: 'px', shape: 'stack' },
  'twitter-summary': { w: 1200, h: 600, unit: 'px', shape: 'stack' },
};

var DEFAULT_LAYOUT = 'og-horizontal';

// Fallbacks for every colour input. A colour default is a token alias that
// resolves to '' on a brand with no tokens, so each one needs a literal here.
var INK_FALLBACK = '#17232b';
var CARD_FALLBACK = '#ffffff';
var ACCENT_FALLBACK = '#1f5f52';

// The two inks the tool can put on the accent chip.
var PALE_INK = '#ffffff';
var DARK_INK = '#111417';

function _str(v) {
  return String(v == null ? '' : v).trim();
}

// Accept #rgb, #rgba, #rrggbb or #rrggbbaa (with or without the hash); anything
// else takes the fallback, so a blank token alias can never paint a transparent
// card. Alpha digits are read and dropped: a brand token carrying alpha
// resolves to an 8-digit hex (engine colorToHex), and refusing it would swap
// the brand's own ink for the literal fallback.
function _hex(v, fallback) {
  var m = /^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(_str(v));
  if (!m) return fallback;
  var h = m[1].toLowerCase();
  if (h.length < 6) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return '#' + h.slice(0, 6);
}

function _rgb(hex) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

// Straight 8-bit blend, for the muted line and the hairline rule. These are
// derived from the user's own two colours, so a plain mix reads right on a
// light card and on a dark one.
function _mix(a, b, t) {
  var A = _rgb(a);
  var B = _rgb(b);
  var out = '#';
  for (var i = 0; i < 3; i++) {
    var v = Math.max(0, Math.min(255, Math.round(A[i] + (B[i] - A[i]) * t)));
    out += (v < 16 ? '0' : '') + v.toString(16);
  }
  return out;
}

function _relLum(hex) {
  var c = _rgb(hex);
  function lin(i) {
    var v = c[i] / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  }
  return 0.2126 * lin(0) + 0.7152 * lin(1) + 0.0722 * lin(2);
}

function _contrast(a, b) {
  var la = _relLum(a);
  var lb = _relLum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// Which ink reads on the accent field. MEASURED, not thresholded: white stops
// beating near-black at a luminance around 0.19, so a halfway threshold puts
// white on every mid tone. Comparing the two real ratios needs no constant.
function _onColor(hex) {
  return _contrast(PALE_INK, hex) >= _contrast(DARK_INK, hex) ? PALE_INK : DARK_INK;
}

// A surface that wants the pale ink wants the reversed lockup too, so the logo
// polarity can never disagree with the type printed beside it.
function _isDark(hex) { return _onColor(hex) === PALE_INK; }

/**
 * The active brand's logo for a light or dark surface, as a URL. Discovered by
 * catalog tag, never a hardcoded brand asset. Prefers a horizontal lockup and
 * falls back to any logo with the right polarity. Empty string when the brand
 * ships none, when the host has no asset query, or on any failure - the card
 * then prints the site chip on its own.
 *
 * The last pass drops the polarity tag, because a brand may ship one untagged
 * lockup and nothing else. It still refuses a logo tagged for the OPPOSITE
 * surface: a reversed lockup is white artwork, and white artwork on a white
 * card shows nothing at all.
 *
 * Copied from community/stationery/hooks.js. Feature-detect, query, always
 * resolve to a string.
 */
async function brandLogoUrl(darkSurface) {
  try {
    if (typeof host === 'undefined' || !host || !host.assets || !host.assets.query) return '';
    var on = darkSurface ? 'on-dark' : 'on-light';
    var opposite = darkSurface ? 'on-light' : 'on-dark';
    async function q(tags) {
      try { return (await host.assets.query({ type: 'vector', tags: tags })) || []; }
      catch (e) { return []; }
    }
    function tagged(ref, tag) {
      var t = ref && ref.meta && ref.meta.tags;
      return Array.isArray(t) && t.indexOf(tag) !== -1;
    }
    var found = await q(['logo', on, 'horizontal']);
    if (!found.length) found = await q(['logo', on]);
    if (!found.length) {
      found = (await q(['logo'])).filter(function (r) { return !tagged(r, opposite); });
    }
    var ref = found[0];
    if (!ref) return '';
    if (typeof ref.url === 'string' && ref.url) return ref.url;
    if (host.assets.get) {
      try {
        var full = await host.assets.get(ref.id);
        if (full && typeof full.url === 'string') return full.url;
      } catch (e) { /* fall through to the chip on its own */ }
    }
    return '';
  } catch (e) {
    return '';
  }
}

/**
 * The site as a reader would say it: no protocol, no credentials, no path.
 * Text parsing rather than `new URL`, because the field accepts what people
 * actually paste - "atlasfield.io/notes", with or without a scheme, sometimes
 * with a trailing slash - and the URL constructor throws on half of that.
 *
 * A leading "www." goes: it is noise on a card, and every platform's own link
 * preview drops it. The port stays, because "localhost" without :3000 is a
 * different machine.
 */
function hostDisplay(raw) {
  var s = _str(raw);
  if (!s) return '';
  // The scheme is optional, because "//example.com/x" is a URL people copy out
  // of page source; splitting that on "/" first would leave an empty host.
  s = s.replace(/^([a-z][a-z0-9+.\-]*:)?\/\//i, ''); // scheme://
  s = s.split(/[/?#]/)[0];                          // path, query, fragment
  s = s.replace(/^[^@]*@/, '');                     // user:pass@
  s = s.replace(/\.+$/, '');                        // the root dot
  s = s.toLowerCase();
  s = s.replace(/^www\./, '');
  return s;
}

// The letter in the chip and on the placeholder panel. The site name first,
// the address second, and a dot when there is neither - a blank chip reads as
// a rendering fault.
//
// Any script's letters and digits count, ASCII or otherwise: a site called
// "Ателье" or "日本語" has an initial of its own, and falling back to the dot
// there would print the missing-value mark for a perfectly good name.
var FIRST_LETTER = /[\p{L}\p{N}]/u;
function monogram(siteName, host_) {
  var m = FIRST_LETTER.exec(_str(siteName)) || FIRST_LETTER.exec(_str(host_));
  return m ? m[0].toUpperCase() : '·';
}

function _clamp(v, lo, hi, dflt) {
  var n = Number(v);
  if (!Number.isFinite(n)) return dflt;
  return Math.min(hi, Math.max(lo, n));
}

// The plans/148 framing recipe, as one style string: cover, pan with
// object-position, zoom with a scale about the same point so the visible part
// of the image is what the X / Y pair names at any zoom.
function framingStyle(framing) {
  var f = framing && typeof framing === 'object' ? framing : {};
  var zoom = _clamp(f.zoom, 100, 400, 100);
  var x = _clamp(f.x, 0, 100, 50);
  var y = _clamp(f.y, 0, 100, 50);
  return 'object-fit:cover;object-position:' + x + '% ' + y + '%;'
    + 'transform:scale(calc(' + zoom + ' / 100));transform-origin:' + x + '% ' + y + '%';
}

async function _build(args) {
  var layoutId = Object.prototype.hasOwnProperty.call(LAYOUTS, _str(args.layout))
    ? _str(args.layout)
    : DEFAULT_LAYOUT;
  var layout = LAYOUTS[layoutId];

  var ink = _hex(args.color, INK_FALLBACK);
  var card = _hex(args.background, CARD_FALLBACK);
  var accent = _hex(args.accent, ACCENT_FALLBACK);
  // The outermost element IS the card (it fills the whole canvas, no separate
  // page backdrop), so "transparent background" means this fill goes away.
  // `card` itself stays the real hex below - the muted-text mix, the rule tint
  // and the logo's light/dark pick all still want the AUTHORED tone, only the
  // painted --lc-card var should drop to alpha.
  var transparentBg = args.transparentBg === true;

  var site = _str(args.siteName);
  var shownHost = hostDisplay(args.url);

  // The thumbnail ref is resolved by the runtime before this hook runs, so a
  // pasted tool link has already become a rendered asset (or null, where the
  // shell cannot compose).
  var thumb = args.image && typeof args.image === 'object' ? args.image : null;
  var hasThumb = !!(thumb && typeof thumb.url === 'string' && thumb.url);

  var out = {
    layoutId: layoutId,
    layoutShape: layout.shape,
    isSplit: layout.shape === 'split',
    isStack: layout.shape === 'stack',
    cardW: layout.w,
    cardH: layout.h,
    cardUnit: layout.unit,

    inkColor: ink,
    cardColor: transparentBg ? 'transparent' : card,
    accentColor: accent,
    accentInk: _onColor(accent),
    mutedColor: _mix(ink, card, 0.42),
    ruleColor: _mix(ink, card, 0.84),

    headingText: _str(args.heading),
    bodyText: _str(args.body),
    siteText: site,
    hostDisplay: shownHost,
    // Neither typed in: the chip would be an empty pill, so it goes.
    hasChip: Boolean(site || shownHost),
    monogram: monogram(site, shownHost),

    hasThumb: hasThumb,
    framingStyle: framingStyle(args.imageFraming),
    error: '',

    // The two halves of manifest.a11yLabel. They carry their fallbacks HERE
    // rather than through the `default` helper, which is `??` and so keeps an
    // empty string: a cleared site name would otherwise read "Link card for :".
    siteLabel: site || shownHost || 'a link',
    headingLabel: _str(args.heading) || 'an untitled page',
  };

  out.logoUrl = await brandLogoUrl(_isDark(card));
  out.hasLogo = Boolean(out.logoUrl);
  return out;
}

var _memoKey = null;
var _memoResult = null;

async function compute(args) {
  var key;
  try { key = JSON.stringify(args); } catch (e) { key = null; }
  if (key !== null && key === _memoKey) return _memoResult;

  var result;
  try {
    result = await _build(args);
  } catch (err) {
    result = await _build({}).catch(function () { return {}; });
    result.error = 'Could not lay this card out. Check the inputs and try again.';
  }
  _memoKey = key;
  _memoResult = result;
  return result;
}

function _args(model) {
  return Object.fromEntries(model.map(function (i) { return [i.id, i.value]; }));
}

function onInit({ model }) {
  return compute(_args(model));
}

function onInput({ model }) {
  return compute(_args(model));
}
