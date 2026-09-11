/* global host */
/**
 * Certificate hooks.
 *
 * Turns the manifest inputs into the finished wording, the resolved colour set
 * and the page geometry the logic-less template prints. Nothing here throws: a
 * failure comes back as the `error` extra, which the template shows in place of
 * the sheet's copy.
 *
 * Three things worth knowing before editing:
 *
 * 1. WORDING follows `certKind` whenever `heading` is empty, so the title and
 *    the citation line above the course can never disagree with each other. A
 *    typed heading wins, and only the heading - the citation still follows the
 *    kind, because that line is grammar, not branding.
 *
 * 2. GEOMETRY comes from `pageSize`, but only the PROPORTION is computed here.
 *    The sheet is HTML, laid out in one unit `--ct-u` = a thousandth of the
 *    sheet's own width, which styles.css takes in container units - so the copy
 *    scales with whatever box the sheet is painted in (a reduced canvas preview,
 *    or the export stage at the true page size) exactly as the border layer's
 *    viewBox already does. `vbH` is that viewBox's height in the same 1000-wide
 *    space. `pageW`/`pageH` are the page in px at 96 dpi, which is what makes
 *    the proportion; the export bar takes the real physical size straight off
 *    the manifest's `pageSize` options.
 *
 * 3. The LOGO is discovered by catalog tag (logo + on-light|on-dark, the same
 *    convention deck-builder and multi-page-pdf use), never a hardcoded brand
 *    asset, and the side follows the paper colour. A brand with no logo, or a
 *    shell with no asset query, falls back to the `company` line on its own.
 */

// Fallbacks for every colour input: a colour default is a token alias that
// resolves to '' on a brand with no tokens, so each one needs a literal here.
var INK_FALLBACK = '#1f2933';
var PAPER_FALLBACK = '#faf8f4';
var ACCENT_FALLBACK = '#8a6a2b';

// Page sizes, in the unit the manifest's select declares for each one, so the
// export bar and the sheet agree on what "A4 landscape" means.
var PAGES = {
  'a4-landscape': { w: 297, h: 210, unit: 'mm' },
  'letter-landscape': { w: 11, h: 8.5, unit: 'in' },
  screen: { w: 1600, h: 1131, unit: 'px' },
};
var PAGE_DEFAULT = 'a4-landscape';

// title / citation per kind. The lead line ("This is to certify that") is the
// same for all four: it introduces the name, not the reason.
var KINDS = {
  completion: { title: 'Certificate of Completion', cite: 'has successfully completed' },
  achievement: { title: 'Certificate of Achievement', cite: 'is recognised for achievement in' },
  award: { title: 'Certificate of Award', cite: 'is hereby awarded' },
  appreciation: { title: 'Certificate of Appreciation', cite: 'in appreciation of' },
};
var KIND_DEFAULT = 'completion';
var LEAD = 'This is to certify that';

var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

// Own-property lookup only: a value of "constructor" or "__proto__" arriving
// from a URL would otherwise pick an inherited member and lay out a NaN sheet.
function own(map, key) {
  return Object.prototype.hasOwnProperty.call(map, key);
}

function str(v) {
  return String(v == null ? '' : v).trim();
}

// Accept #rgb / #rgba / #rrggbb / #rrggbbaa (with or without the hash); anything
// else takes the fallback, so a blank token alias can never paint a transparent
// sheet. The alpha forms matter: the engine's colorToHex hands a colour input
// #rrggbbaa whenever the brand token behind it carries an alpha, and a sheet of
// paper has no opacity to express, so the alpha is dropped rather than the whole
// colour (rejecting it would silently repaint the brand in these literals).
function hex(v, fallback) {
  var m = /^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(str(v));
  if (!m) return fallback;
  var h = m[1].toLowerCase();
  if (h.length <= 4) return '#' + h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return '#' + h.slice(0, 6);
}

function rgb(h) {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}

// Straight 8-bit blend. Not perceptual, but these are hairlines and muted
// labels derived from the user's own two colours, so a plain mix reads right.
function mix(a, b, t) {
  var A = rgb(a);
  var B = rgb(b);
  var out = '#';
  for (var i = 0; i < 3; i++) {
    var v = Math.max(0, Math.min(255, Math.round(A[i] + (B[i] - A[i]) * t)));
    out += (v < 16 ? '0' : '') + v.toString(16);
  }
  return out;
}

// Rec.709 luminance of the paper, the same test deck-studio uses to pick a
// logo side.
function isDark(h) {
  var c = rgb(h);
  return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) < 140;
}

// 'YYYY-MM-DD' -> '18 June 2026'. Anything else (a typed word, an empty value)
// passes straight through, so a hand-written "Spring 2026" still prints.
function fmtDate(v) {
  var s = str(v);
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return s;
  var mo = Number(m[2]);
  var day = Number(m[3]);
  if (!(mo >= 1 && mo <= 12) || !(day >= 1 && day <= 31)) return s;
  return day + ' ' + MONTHS[mo - 1] + ' ' + m[1];
}

// px at 96 dpi for a value in the unit the page table declares.
function toPx(value, unit) {
  if (unit === 'mm') return Math.round(value * 96 / 25.4);
  if (unit === 'in') return Math.round(value * 96);
  return Math.round(value);
}

// The brand's logo for this paper colour. One cached lookup per side: onInput
// runs on every keystroke and the catalog does not change under the tool.
var _logoCache = {};
async function brandLogoUrl(darkPaper) {
  var side = darkPaper ? 'on-dark' : 'on-light';
  if (Object.prototype.hasOwnProperty.call(_logoCache, side)) return _logoCache[side];
  var url = '';
  try {
    if (host && host.assets && host.assets.query) {
      var q = async function (tags) {
        try { return (await host.assets.query({ type: 'vector', tags: tags })) || []; } catch (e) { return []; }
      };
      var all = await q(['logo', side, 'horizontal']);
      if (!all.length) all = await q(['logo', side]);
      var ref = all[0];
      if (ref) {
        if (typeof ref.url === 'string' && ref.url) url = ref.url;
        else if (host.assets.get) {
          try {
            var full = await host.assets.get(ref.id);
            if (full && typeof full.url === 'string') url = full.url;
          } catch (e) { /* the brand just renders without one */ }
        }
      }
    }
  } catch (e) { url = ''; }
  _logoCache[side] = url;
  return url;
}

// The name is sized to stay on ONE line. A sheet is a fixed box: the copy above
// the signature row has about 590 units of height at A4 landscape, and a second
// line of the name at display size eats most of the slack. The name box is 800
// units wide (1000 less the body's two 100-unit margins) and a semibold sans
// averages roughly 0.52em per glyph, so 800 / (0.52 * length) is the largest
// size that still fits. An approximation by character count, not measured text,
// since a hook has no font metrics - hence the clamp at both ends: the display
// size at the top, and a floor that keeps a pathological 200-character name
// legible while letting it wrap.
function nameSize(name) {
  return Math.max(24, Math.min(68, Math.floor(800 / (0.52 * name.length))));
}

// The course line is MEANT to wrap - it is a sentence, not a name - so it takes
// a coarse step and the vertical budget carries the slack for the extra lines.
function courseSize(course) {
  if (course.length > 60) return 24;
  if (course.length > 40) return 28;
  return 32;
}

function build(args, logoUrl) {
  var ink = hex(args.color, INK_FALLBACK);
  var paper = hex(args.background, PAPER_FALLBACK);
  var accent = hex(args.accent, ACCENT_FALLBACK);

  var kind = own(KINDS, str(args.certKind)) ? str(args.certKind) : KIND_DEFAULT;
  var typedTitle = str(args.heading);

  var page = own(PAGES, str(args.pageSize)) ? PAGES[str(args.pageSize)] : PAGES[PAGE_DEFAULT];
  var pageW = toPx(page.w, page.unit);
  var pageH = toPx(page.h, page.unit);

  var first = str(args.firstname);
  var last = str(args.lastname);
  var name = (first + ' ' + last).trim();
  var presenter = str(args.presenter);
  var dateText = fmtDate(args.awarddate);
  var vbH = Math.round(pageH / pageW * 1000);

  return {
    error: '',

    // Wording.
    titleText: typedTitle || KINDS[kind].title,
    leadText: LEAD,
    citeText: KINDS[kind].cite,
    recipientName: name,
    nameSizeU: nameSize(name),
    courseText: str(args.awardtopic),
    courseSizeU: courseSize(str(args.awardtopic)),
    dateText: dateText,
    presenterText: presenter,
    presenterTitleText: str(args.presenterTitle),
    companyText: str(args.company),
    serialText: str(args.serial),
    hasPresenter: !!presenter,
    hasDate: !!dateText,

    // Issuer lockup: the logo when there is one, the company line otherwise -
    // and the company line stays under a logo when both are set.
    logoUrl: logoUrl || '',
    hasLogo: !!logoUrl,

    // Geometry. The sheet's layout unit is a thousandth of its own width and
    // comes from the stylesheet in container units, so nothing here has to
    // guess the pixel size the sheet is painted at; pageW/pageH are the true
    // page in px at 96 dpi, and vbH is the page height in the border layer's
    // 1000-wide space.
    pageW: pageW,
    pageH: pageH,
    vbH: vbH,
    // The border layer's two rules, in that same space: the outer rule sits
    // 26 units in, the inner one 40, and the corner marks ride the inner one.
    frameH: vbH - 52,
    innerH: vbH - 80,
    innerBottom: vbH - 40,

    // Colours. paperColor drives --ct-paper, which is the only thing that
    // paints .ct-root's background - so 'transparent' there is the whole
    // toggle. mutedColor/ruleSoftColor below still mix against the real
    // paper hex: those are contrast colours (muted labels, hairlines), not
    // a fill, and stay meaningful with no paper painted underneath.
    inkColor: ink,
    paperColor: args.transparentBg === true ? 'transparent' : paper,
    accentColor: accent,
    mutedColor: mix(ink, paper, 0.45),
    ruleSoftColor: mix(paper, accent, 0.45),
  };
}

function blank(note) {
  var out = build({}, '');
  out.error = note;
  return out;
}

var _memoKey = null;
var _memoResult = null;

async function compute(model) {
  var args = {};
  for (var i = 0; i < model.length; i++) args[model[i].id] = model[i].value;

  var key;
  try { key = JSON.stringify(args); } catch (e) { key = null; }
  if (key !== null && key === _memoKey) return _memoResult;

  var result;
  try {
    var paper = hex(args.background, PAPER_FALLBACK);
    var wantLogo = args.brandLogo !== false;
    var logoUrl = wantLogo ? await brandLogoUrl(isDark(paper)) : '';
    result = build(args, logoUrl);
  } catch (err) {
    result = blank('This certificate could not be laid out. Check the sheet size and the colours.');
  }
  _memoKey = key;
  _memoResult = result;
  return result;
}

function onInit({ model }) {
  return compute(model);
}

function onInput({ model }) {
  return compute(model);
}
