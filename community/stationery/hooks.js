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
 * Stationery hooks.
 *
 * Turns the chosen piece into everything the logic-less template prints: the
 * trim size, the resolved colour set, the contact lines that are not empty,
 * and the brand lockup.
 *
 * The trim is the point of this tool. Each `piece` option carries width /
 * height / unit in the manifest, which is what the shell reads to set the
 * export size (views/export-size.ts), so a card really does export as an
 * 85 x 55 mm page. The same numbers are stamped on the root element here, so
 * the rendered markup says what it was drawn for and a test can read it back.
 *
 * The lockup follows the active design system's logo tokens. When a matching
 * mark is unavailable, the company name remains as the wordmark and a preview
 * notice explains how to add a logo or turn the logo off.
 */

// Every piece, in millimetres. Landscape for the card and the slip, portrait
// for the letterhead. Keys are the `piece` values and must stay in step with
// the manifest's option list (tests/stationery.test.ts pins them together).
var PIECES = {
  'business-card-front': { w: 85, h: 55, unit: 'mm', kind: 'card', face: 'front' },
  'business-card-back': { w: 85, h: 55, unit: 'mm', kind: 'card', face: 'back' },
  letterhead: { w: 210, h: 297, unit: 'mm', kind: 'letterhead', face: 'front' },
  'comp-slip': { w: 210, h: 99, unit: 'mm', kind: 'slip', face: 'front' },
};

var DEFAULT_PIECE = 'business-card-front';

// Fallbacks for every colour input. A colour default is a token alias that
// resolves to '' on a brand with no tokens, so each one needs a literal here.
var INK_FALLBACK = '#17232b';
var PAPER_FALLBACK = '#ffffff';
var ACCENT_FALLBACK = '#1f5f52';

function _str(v) {
  return String(v == null ? '' : v).trim();
}

// Accept #rgb, #rgba, #rrggbb or #rrggbbaa (with or without the hash); anything
// else takes the fallback, so a blank token alias can never paint a transparent
// sheet. The alpha digits are READ AND DROPPED rather than refused: a brand
// token carrying alpha resolves to an 8-digit hex (engine colorToHex ->
// rgbaToHex), and rejecting it would silently swap the brand's own ink for the
// literal fallback below. Paper has no alpha, so opaque is the honest reading.
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

// Straight 8-bit blend. Not perceptual, but these are hairlines and muted
// lines derived from the user's own two colours, so a plain mix reads right on
// a light paper and on a dark one.
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

// The two inks the tool can put on a coloured field.
var PALE_INK = '#ffffff';
var DARK_INK = '#111417';

// WCAG relative luminance and contrast ratio.
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

// Which ink reads on a given surface - used for the card back, which prints on
// the accent rather than on the paper. MEASURED, not thresholded: the point
// where white stops beating near-black is a luminance around 0.19, not 0.5, so
// a threshold at the halfway mark puts white on every mid tone (white on a mid
// grey is about 2.8:1). Comparing the two real ratios needs no constant and is
// right at every point on the ramp.
function _onColor(hex) {
  return _contrast(PALE_INK, hex) >= _contrast(DARK_INK, hex) ? PALE_INK : DARK_INK;
}

// A surface that wants the pale ink wants the reversed lockup. One decision, so
// the logo polarity can never disagree with the type printed beside it.
function _isDark(hex) { return _onColor(hex) === PALE_INK; }

// The ink for type printed on the accent: the brand's own pairing when it has one
// and it reads, otherwise the measured one. An accent the person chose themselves
// may not suit the pairing, so the pairing has to earn its place each time.
async function _inkOnAccent(accent) {
  var measured = _onColor(accent);
  if (!host.tokens || !host.tokens.resolve) return measured;
  try {
    var paired = _hex(await host.tokens.resolve('{color.semantic.on-primary}'), '');
    return paired && _contrast(paired, accent) >= 4.5 ? paired : measured;
  } catch (e) {
    return measured;
  }
}
async function brandLogoUrl(dark, mono) {
  var asset = await resolveBrandLogo(dark, mono);
  return asset ? asset.url : '';
}

function _lines(list) {
  var out = [];
  for (var i = 0; i < list.length; i++) {
    var s = _str(list[i]);
    if (s) out.push({ text: s });
  }
  return out;
}

async function _build(args) {
  var pieceId = Object.prototype.hasOwnProperty.call(PIECES, _str(args.piece))
    ? _str(args.piece)
    : DEFAULT_PIECE;
  var piece = PIECES[pieceId];

  var ink = _hex(args.color, INK_FALLBACK);
  var paper = _hex(args.background, PAPER_FALLBACK);
  var accent = _hex(args.accent, ACCENT_FALLBACK);
  var isBack = piece.face === 'back';
  // Engine-injected boolean (render.transparentBg in the manifest). Only the
  // painted sheet goes transparent - `surface` (below) still carries the real
  // hex so mutedColor/ruleColor keep mixing against a colour, not the string
  // 'transparent'.
  var transparent = args.transparentBg === true || args.transparentBg === 'true';

  // The card back prints on the accent field; every other piece prints on the
  // paper. Everything downstream reads `surface` / `surfaceInk`, so one branch
  // here settles the whole sheet.
  var surface = args._surfacePaper || (isBack ? accent : paper);
  var surfaceInk = args._surfaceInk || (isBack ? await _inkOnAccent(accent) : ink);

  var first = _str(args.firstname);
  var last = _str(args.lastname);
  var fullName = (first + ' ' + last).trim();
  var company = _str(args.company);
  var url = _str(args.url);

  var out = {
    pieceId: pieceId,
    pieceKind: piece.kind,
    isCard: piece.kind === 'card',
    isBack: isBack,
    isLetterhead: piece.kind === 'letterhead',
    isSlip: piece.kind === 'slip',
    trimW: piece.w,
    trimH: piece.h,
    trimUnit: piece.unit,

    inkColor: surfaceInk,
    // The `--st-paper` value the template paints .st-piece with - the only
    // place the sheet's background comes from (styles.css: background: var(--st-paper)).
    paperColor: transparent ? 'transparent' : surface,
    accentColor: isBack ? surfaceInk : accent,
    mutedColor: _mix(surfaceInk, surface, 0.4),
    ruleColor: _mix(surfaceInk, surface, 0.82),

    fullName: fullName,
    jobTitleText: _str(args.jobTitle),
    companyName: company,
    taglineText: _str(args.tagline),
    // The letter, with its line endings normalised before the markdown helper
    // sees it. The helper splits blocks on /\n{2,}/ and lines on '\n', so a
    // CRLF paste (a letter drafted in Word or Outlook, which is most of them)
    // leaves a stray \r between the two newlines: every paragraph break and
    // every bullet list collapses into one run of <br>. Trailing spaces go too,
    // for the same reason - '- item \r' is still a bullet, ' \r' alone is not.
    letterBody: String(args.body == null ? '' : args.body)
      .replace(/\r\n?/g, '\n')
      .replace(/[ \t]+$/gm, ''),
    // The wordmark stands in for a logo asset, so it names the organisation
    // first and only falls back to the person when there is no company.
    wordmark: company || fullName,
    // Card front: the three lines a card carries. Letterhead and slip: one
    // footer line, because a footer that wraps stops being a footer.
    contactLines: _lines([args.email, args.phone, url]),
    footerLine: _lines([args.address, args.email, args.phone, url])
      .map(function (l) { return l.text; })
      .join(' · '),
    error: '',
  };

  var wantLogo = args.brandLogo !== false;
  // Pale ink wants the reversed lockup, so the logo follows the ink the type really got.
  var reversed = _contrast(PALE_INK, surfaceInk) < _contrast(DARK_INK, surfaceInk);
  // On the accent field a full-colour mark can vanish into its own ground, so the
  // back asks for the one-colour lockup first.
  out.logoUrl = wantLogo ? await brandLogoUrl(reversed, isBack) : '';
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
    result.error = 'Could not lay this piece out. Check the inputs and try again.';
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
  var piece = PIECES[values.piece] || PIECES[DEFAULT_PIECE];
  var palette = await toolSurface(Object.assign({}, values, { ground: values.ground === "piece" ? (piece.face === "back" ? "lead" : "tint") : values.ground }), { ink: "color" });
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
