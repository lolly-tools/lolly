// === lolly:shared brand-logo - generated from community/_shared/brand-logo.js; edit there and run pnpm run sync:shared ===
// Resolve only slots declared by the active design system. Catalogue tags describe
// available artwork; they do not say which identity the person selected.
async function resolveBrandLogo(dark, mono) {
  if (!host.tokens || !host.tokens.resolve || !host.assets || !host.assets.get) return null;
  var suffix = dark ? '-reverse' : '';
  var treatments = mono ? ['mono', 'primary'] : ['primary', 'mono'];
  for (var t = 0; t < treatments.length; t++) {
    for (var o = 0; o < 2; o++) {
      var variant = (o ? 'vertical-' : 'horizontal-') + treatments[t] + suffix;
      try {
        var id = await host.tokens.resolve('{asset.logo.' + variant + '}');
        if (typeof id !== 'string' || !id.trim() || id.indexOf('{') !== -1) continue;
        var asset = await host.assets.get(id);
        if (asset && typeof asset.url === 'string' && asset.url) return asset;
      } catch { /* Try another declared slot on the same background. */ }
    }
  }
  return null;
}

var _lastBrandLogoWarning = '';
function brandLogoWarning(missing) {
  var message = missing
    ? 'A logo for this background is unavailable in the active design system. Add a matching mark in Logos, or turn off the logo.'
    : '';
  if (message && message !== _lastBrandLogoWarning && host.log) host.log('warn', message);
  _lastBrandLogoWarning = message;
  return message;
}
// === /lolly:shared brand-logo ===

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
async function brandLogoUrl(dark) {
  var asset = await resolveBrandLogo(dark, false);
  return asset ? asset.url : '';
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

  var wantLogo = args.brandLogo !== false && out.hasChip;
  out.logoUrl = wantLogo ? await brandLogoUrl(_isDark(card)) : '';
  out._logoWarning = brandLogoWarning(wantLogo && !out.logoUrl);
  out.hasLogo = Boolean(out.logoUrl);
  return out;
}

async function compute(args) {

  var result;
  try {
    result = await _build(args);
  } catch (err) {
    result = await _build({}).catch(function () { return {}; });
    result.error = 'Could not lay this card out. Check the inputs and try again.';
  }
  return result;
}

function _args(model) {
  return Object.fromEntries(model.map(function (i) { return [i.id, i.value]; }));
}

function onInit({ model }) {
  return surfaceRender(model);
}

function onInput({ model }) {
  return surfaceRender(model);
}

async function surfaceRender(model) {
  var values = _args(model);
  var palette = await toolSurface(values, {"ink": "color"});
  values = Object.assign({}, values, { background: palette.surfacePaper, color: palette.surfaceInk, _surfacePaper: palette.surfacePaper, _surfaceInk: palette.surfaceInk });
  return Object.assign(await compute(values), palette);
}

// === lolly:shared tool-surface - generated from community/_shared/tool-surface.js; edit there and run pnpm run sync:shared ===
function surfaceHex(value, fallback) {
  if (value && typeof value === 'object' && Array.isArray(value.components)) {
    var space = value.colorSpace || 'srgb';
    if (space === 'srgb' && value.components.length === 3 && value.components.every(Number.isFinite)) {
      value = '#' + value.components.map(function (n) { return Math.round(Math.max(0, Math.min(1, n)) * 255).toString(16).padStart(2, '0'); }).join('');
    } else value = 'color(' + space + ' ' + value.components.join(' ') + ')';
  }
  if (host.color && typeof host.color.mix === 'function') {
    try {
      var normalized = host.color.mix(String(value), String(value), 0);
      if (normalized && /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(normalized)) return normalized.slice(0, 7);
    } catch (_) { /* Try the plain hex form below. */ }
  }
  var match = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(String(value || '').trim());
  if (!match) return fallback;
  var hex = match[1];
  if (hex.length === 3) hex = hex.split('').map(function (c) { return c + c; }).join('');
  return '#' + hex.slice(0, 6).toLowerCase();
}

function surfaceMix(a, b, amount) {
  if (host.color && typeof host.color.mix === 'function') {
    try { return surfaceHex(host.color.mix(a, b, amount), a); } catch (_) { /* Use sRGB below. */ }
  }
  return '#' + [1, 3, 5].map(function (at) {
    var first = parseInt(a.slice(at, at + 2), 16);
    var last = parseInt(b.slice(at, at + 2), 16);
    return Math.round(first + (last - first) * amount).toString(16).padStart(2, '0');
  }).join('');
}

function surfaceContrast(a, b) {
  function luminance(hex) {
    var channels = [1, 3, 5].map(function (at) {
      var c = parseInt(hex.slice(at, at + 2), 16) / 255;
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  }
  var x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

function surfaceReadable(preferred, ground, alternatives) {
  if (surfaceContrast(preferred, ground) >= 4.5) return preferred;
  var choices = alternatives.concat(['#111111', '#ffffff']);
  return choices.reduce(function (best, colour) {
    return surfaceContrast(colour, ground) > surfaceContrast(best, ground) ? colour : best;
  }, preferred);
}

async function toolSurface(values, aliases) {
  aliases = aliases || {};
  async function readToken(path) {
    try {
      if (host.tokens && typeof host.tokens.resolve === 'function') {
        return await host.tokens.resolve('{' + path + '}');
      }
      if (host.tokens && typeof host.tokens.get === 'function') {
        var set = await host.tokens.get();
        if (set && typeof set.resolve === 'function') return set.resolve('{' + path + '}');
      }
    } catch (_) { /* A tool without a design system still draws. */ }
    return null;
  }
  var colours = await Promise.all([
    readToken('color.semantic.primary'), readToken('color.semantic.on-primary'),
    readToken('color.semantic.surface'), readToken('color.semantic.text'),
  ]);
  colours = colours.map(function (c, i) { return surfaceHex(c, ['#2563eb', '#ffffff', '#f6f7f9', '#17232b'][i]); });
  var primary = surfaceHex(values[aliases.accent || 'accent'], colours[0]);
  var paper = surfaceHex(values[aliases.background || 'background'], colours[2]);
  var text = surfaceHex(values[aliases.ink || 'ink'], colours[3]);
  var ground = values.ground || 'tint';
  var fill = ground === 'lead' ? primary : ground === 'ink' ? text
    : ground === 'surface' ? paper : surfaceMix(paper, primary, 0.1);
  var ink = ground === 'lead' ? colours[1] : ground === 'ink' ? paper : text;
  ink = surfaceReadable(ink, fill, [text, paper, colours[1]]);
  var accent = primary;
  for (var amount = 0.1; surfaceContrast(accent, fill) < 4.5 && amount <= 1.01; amount += 0.1) {
    accent = surfaceMix(primary, ink, Math.min(1, amount));
  }
  var onAccent = surfaceReadable(colours[1], accent, [fill, text, paper]);
  var density = values.density || 'auto';
  var chars = JSON.stringify(['body', 'heading', 'subheading', 'quote', 'criteria', 'events', 'data',
    'directions', 'blocks', 'content', 'company', 'firstname', 'lastname', 'description', 'title']
    .map(function (key) { return values[key]; })).length;
  var spacing = density === 'compact' ? 0.78 : density === 'spacious' ? 1.16
    : density === 'comfortable' ? 1 : chars > 4500 ? 0.78 : chars > 2400 ? 0.9 : 1;
  var timing = await readToken('motion.duration.long');
  var ms = 700;
  if (typeof timing === 'number' && Number.isFinite(timing)) ms = timing;
  else if (timing && typeof timing === 'object' && typeof timing.value === 'number') {
    ms = timing.value * (timing.unit === 's' ? 1000 : 1);
  } else if (typeof timing === 'string') {
    var match = /^(\d+(?:\.\d+)?)(ms|s)$/.exec(timing.trim());
    if (match) ms = Number(match[1]) * (match[2] === 's' ? 1000 : 1);
  }
  var curve = await readToken('motion.curve.emphasised');
  if (!Array.isArray(curve) || curve.length !== 4 || !curve.every(Number.isFinite)
      || curve[0] < 0 || curve[0] > 1 || curve[2] < 0 || curve[2] > 1) curve = [0.2, 0, 0, 1];
  return {
    surfaceGround: values.transparentBg === true || values.transparentBg === 'true' ? 'transparent' : fill,
    surfacePaper: fill,
    surfaceInk: ink,
    surfaceAccent: accent,
    surfaceOnAccent: onAccent,
    surfaceMuted: surfaceMix(ink, fill, 0.22),
    surfaceEdge: surfaceMix(fill, ink, 0.2),
    surfacePanel: surfaceMix(fill, ink, 0.045),
    surfaceTint: surfaceMix(fill, accent, 0.12),
    surfaceSpacing: String(spacing),
    surfaceEnterSeconds: String(Math.max(0, Math.min(3000, ms)) / 1000),
    surfaceCurve: curve.join(','),
  };
}
// === /lolly:shared tool-surface ===
