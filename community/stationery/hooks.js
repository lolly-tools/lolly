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
 * The lockup comes from the ACTIVE brand, discovered by catalog tag
 * (logo + on-light | on-dark, the convention deck-builder and multi-page-pdf
 * use) rather than a hardcoded asset id, so the tool follows whatever brand is
 * mounted. When the brand ships no logo - or the shell has no asset query at
 * all - the company name is set as a wordmark instead. Nothing here throws:
 * a failure comes back as an `error` note the template renders in place.
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

/**
 * The active brand's logo for a light or dark surface, as a URL. Discovered by
 * catalog tag, never a hardcoded brand asset. Prefers a horizontal lockup and
 * falls back to any logo with the right polarity. Empty string when the brand
 * ships none, when the host has no asset query, or on any failure - the
 * template then prints the wordmark.
 *
 * The last pass drops the polarity tag, because a brand may ship one untagged
 * lockup and nothing else (lolly/logo/primary is tagged logo + mark + primary,
 * with no polarity at all). It still refuses a logo tagged for the OPPOSITE
 * surface: a reversed lockup is white artwork, and printing that on white paper
 * gives nothing, which is worse than the wordmark it would have replaced.
 *
 * M7-style contract for other tools copying this: feature-detect, query, and
 * always resolve to a string.
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
      } catch (e) { /* fall through to the wordmark */ }
    }
    return '';
  } catch (e) {
    return '';
  }
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
  var surface = isBack ? accent : paper;
  var surfaceInk = isBack ? _onColor(accent) : ink;

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
    accentColor: isBack ? _onColor(accent) : accent,
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

  out.logoUrl = await brandLogoUrl(_isDark(surface));
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
    result.error = 'Could not lay this piece out. Check the inputs and try again.';
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
