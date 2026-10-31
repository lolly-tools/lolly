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

// === lolly:shared certificate-i18n - generated from community/_shared/certificate-i18n.js; edit there and run pnpm run sync:shared ===
// The words the Certificate prints, by language. Keys are the English source text;
// a language or a string missing from the table prints in English, and the hook
// then formats the date in English too, so a sheet is never half translated.
// The English list, with context for translators, is CT_PRINTED below; translations
// are added here by a reviewed translation pass, never by machine at render time.
var CT_TEXT = {};
var CT_PRINTED = [
  'Certificate of Completion',
  'Certificate of Achievement',
  'Certificate of Award',
  'Certificate of Appreciation',
  'This is to certify that',
  'has successfully completed',
  'is recognised for achievement in',
  'is hereby awarded',
  'in appreciation of',
  'Date',
  'Play motion',
  'This certificate could not be laid out. Check the sheet size and the colours.'
];
// Right-to-left languages among the ones Lolly ships (engine/src/lang.ts).
var CT_RTL = { ar: 1, ur: 1 };
// The value for Intl and the `lang` attribute, where it differs from the code.
var CT_LOCALE = { en: 'en-GB', zh: 'zh-Hans', 'zh-hant': 'zh-Hant', pt: 'pt-BR' };
function ctLangOf(code) {
  var c = String(code || '').trim().toLowerCase().replace(/_/g, '-');
  if (c === 'zh-hans' || c === 'zh-cn' || c === 'cn') return 'zh';
  if (c === 'zh-tw' || c === 'zh-hk' || c === 'tw' || c === 'hk') return 'zh-hant';
  if (c === 'pt-br' || c === 'br') return 'pt';
  if (c === 'jp') return 'ja';
  return c;
}
// The language the sheet is printed in: the requested one when the table has it,
// English otherwise.
function ctPrintLang(code) {
  var c = ctLangOf(code);
  return c && c !== 'en' && Object.prototype.hasOwnProperty.call(CT_TEXT, c) ? c : 'en';
}
function ctText(text, lang) {
  var table = Object.prototype.hasOwnProperty.call(CT_TEXT, lang) ? CT_TEXT[lang] : null;
  return table && Object.prototype.hasOwnProperty.call(table, text) && table[text] ? table[text] : text;
}
// === /lolly:shared certificate-i18n ===

/* global host */
/**
 * Certificate hooks.
 *
 * Turns the manifest inputs into the finished wording, the colours of the chosen
 * style and the sizes the logic-less template prints. Nothing here throws: a
 * failure comes back as the `error` extra, which the template shows in place of
 * the sheet's copy.
 *
 * Five things to know before editing:
 *
 * 1. COLOUR starts from the design system's colourway. The lead, the colour on
 *    the lead and the partner are read once per mount (and again after a theme
 *    or colourway switch, which reaches onInput as id '__tokens'), and each style
 *    gives them its own jobs: Classic inks the name and the frame in the lead,
 *    Modern lays the lead down as a panel, Minimal keeps it to a kicker and a
 *    ring, Celebration prints on the lead itself. Ink, Paper and Accent start
 *    empty and only override. Every colour the hook chooses is checked against
 *    what it sits on, so a pale lead hands the job to its partner or the ink.
 *
 * 2. WORDING follows `certKind` and the print language. A typed Title wins over
 *    the kind's title and nothing else, because the citation line is grammar,
 *    not branding. The language is the Language input, else the language the
 *    app or the link renders in; a language the CT_TEXT table does not hold yet
 *    prints in English, date included, so a sheet is never half translated.
 *
 * 3. SHAPE: the sheet re-lays itself out for its proportion through container
 *    queries in styles.css (banner, landscape, square, portrait, story). The hook
 *    works out the same shape from `pageSize` only to size the name and the
 *    course: one layout unit is a thousandth of the sheet's width, or of a design
 *    box H units tall when the sheet is wider than that box.
 *
 * 4. FIT is an estimate by character class (CJK is full width, capitals are
 *    wide), because a hook has no font metrics. The template's script measures
 *    the laid-out name and course afterwards and only ever shrinks them further.
 *
 * 5. MOTION is data here and maths in the template's script: the hook picks the
 *    preset, and seeds the confetti so every shell draws the same pieces.
 */

// Fallbacks for every colour: a design system with no tokens (the plain CLI host)
// still paints a finished sheet.
var INK_FALLBACK = '#1f2933';
var PAPER_FALLBACK = '#faf8f4';
var ACCENT_FALLBACK = '#8a6a2b';

// Page sizes, in the unit the manifest's select declares for each one, so the
// export bar and the sheet agree on what "A4 landscape" means.
var PAGES = {
  'a4-landscape': { w: 297, h: 210, unit: 'mm' },
  'a4-portrait': { w: 210, h: 297, unit: 'mm' },
  'letter-landscape': { w: 11, h: 8.5, unit: 'in' },
  'letter-portrait': { w: 8.5, h: 11, unit: 'in' },
  screen: { w: 1600, h: 1131, unit: 'px' },
  slide: { w: 1920, h: 1080, unit: 'px' },
  'social-landscape': { w: 1200, h: 628, unit: 'px' },
  'social-square': { w: 1080, h: 1080, unit: 'px' },
  'social-portrait': { w: 1080, h: 1350, unit: 'px' },
  story: { w: 1080, h: 1920, unit: 'px' },
  banner: { w: 1200, h: 400, unit: 'px' },
};
var PAGE_DEFAULT = 'a4-landscape';

// The proportion bands styles.css switches layout on, with the height of each
// band's design box in layout units. Keep in step with the @container rules.
var SHAPES = [
  { id: 'wide', min: 2.3, h: 333 },
  { id: 'land', min: 1.2, h: 707 },
  { id: 'square', min: 0.9, h: 1000 },
  { id: 'tall', min: 0.66, h: 1250 },
  { id: 'story', min: 0, h: 1778 },
];

var STYLES = ['classic', 'modern', 'minimal', 'celebration'];
var MOTIONS = ['none', 'fade', 'reveal', 'shimmer', 'confetti'];

// title / citation per kind. The lead line ("This is to certify that") is the
// same for all four: it introduces the name, not the reason.
var KINDS = {
  completion: { title: 'Certificate of Completion', cite: 'has successfully completed', glyph: 'check' },
  achievement: { title: 'Certificate of Achievement', cite: 'is recognised for achievement in', glyph: 'star' },
  award: { title: 'Certificate of Award', cite: 'is hereby awarded', glyph: 'star' },
  appreciation: { title: 'Certificate of Appreciation', cite: 'in appreciation of', glyph: 'heart' },
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

function pick(list, value, fallback) {
  return list.indexOf(value) >= 0 ? value : fallback;
}

function round(v, places) {
  var k = Math.pow(10, places || 0);
  return Math.round(v * k) / k;
}

// ── colour ──────────────────────────────────────────────────────────────────

// Accept #rgb / #rgba / #rrggbb / #rrggbbaa (with or without the hash); anything
// else takes the fallback, so a blank token alias can never paint a transparent
// sheet. A sheet of paper has no opacity to express, so an alpha is dropped
// rather than the whole colour.
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

// Straight 8-bit blend: hairlines, tints and muted labels from the sheet's own
// colours.
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

// Rec.709 luma of a ground, the same test deck-studio uses to pick a logo side.
function isDark(h) {
  var c = rgb(h);
  return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) < 140;
}

// WCAG relative luminance and contrast ratio.
function lum(h) {
  var c = rgb(h);
  var out = 0;
  var w = [0.2126, 0.7152, 0.0722];
  for (var i = 0; i < 3; i++) {
    var v = c[i] / 255;
    out += w[i] * (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  }
  return out;
}

function contrast(a, b) {
  var x = lum(a);
  var y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

// The first candidate that reaches `min` against `bg`, else the one that comes
// closest. Empty candidates are skipped, so a missing token never wins.
function readable(candidates, bg, min) {
  var best = '';
  var score = 0;
  for (var i = 0; i < candidates.length; i++) {
    var c = candidates[i];
    if (!c) continue;
    var k = contrast(c, bg);
    if (k >= min) return c;
    if (k > score) { score = k; best = c; }
  }
  return best || INK_FALLBACK;
}

function withAlpha(h, a) {
  var v = Math.max(0, Math.min(255, Math.round(a * 255)));
  return h + (v < 16 ? '0' : '') + v.toString(16);
}

// ── the design system ───────────────────────────────────────────────────────
// Read once and kept, because onInput runs on every keystroke. A theme or
// colourway switch reaches onInput as '__tokens', which drops the kept answers.

var _theme = null;

async function readTheme() {
  if (_theme) return _theme;
  var t = { lead: '', onLead: '', partner: '', surface: '', text: '', muted: '', edge: '', family: [] };
  if (typeof host !== 'undefined' && host && host.tokens && host.tokens.resolve) {
    var read = async function (ref) {
      try {
        var v = await host.tokens.resolve(ref);
        return typeof v === 'string' ? v : '';
      } catch (e) { return ''; }
    };
    // The colourway: its lead, the colour that sits on the lead, and its partner.
    t.lead = hex(await read('{color.semantic.primary}'), '');
    t.onLead = hex(await read('{color.semantic.on-primary}'), '');
    t.partner = hex(await read('{color.semantic.secondary}'), '');
    t.surface = hex(await read('{color.semantic.surface}'), '');
    t.text = hex(await read('{color.semantic.text}'), '');
    t.muted = hex(await read('{color.semantic.muted}'), '');
    t.edge = hex(await read('{color.semantic.edge}'), '');
    // Every colourway's lead, for confetti that looks like the whole brand.
    if (host.tokens.family) {
      try {
        var members = (await host.tokens.family('primary')) || [];
        for (var i = 0; i < members.length && t.family.length < 6; i++) {
          var v = hex(members[i] && members[i].value, '');
          if (v && t.family.indexOf(v) < 0) t.family.push(v);
        }
      } catch (e) { /* a design system with one colourway has no family */ }
    }
  }
  _theme = t;
  return t;
}

// The colours of one style. Overrides are the person's own choices and are used
// as given; everything chosen here is contrast-checked against its ground.
function paletteFor(style, t, args, shape) {
  var oInk = hex(args.color, '');
  var oPaper = hex(args.background, '');
  var oAccent = hex(args.accent, '');
  var lead = t.lead || ACCENT_FALLBACK;
  var surface = t.surface || PAPER_FALLBACK;
  var text = t.text || INK_FALLBACK;
  var p = {};

  if (style === 'celebration') {
    // The whole sheet in the lead, printed in the colour made to sit on the lead.
    p.paper = oPaper || lead;
    p.ink = oInk || readable([t.onLead, surface, text, '#ffffff', '#111111'], p.paper, 4.5);
    p.accent = oAccent || readable([t.partner, t.onLead, p.ink], p.paper, 1.8);
    p.second = mix(p.ink, p.paper, 0.3);
    p.muted = mix(p.ink, p.paper, 0.22);
    p.rule = mix(p.ink, p.paper, 0.55);
    p.panel = p.paper;
    p.panelInk = p.ink;
  } else {
    p.paper = oPaper || surface;
    p.ink = oInk || readable([text, '#111111', '#ffffff'], p.paper, 4.5);
    if (style === 'modern') {
      // The lead becomes a panel; the accent is a short bar beside the name.
      p.panel = oAccent || lead;
      p.panelInk = readable([t.onLead, surface, text, '#ffffff', '#111111'], p.panel, 4.5);
      p.accent = readable([t.partner, p.panel, p.ink], p.paper, 2);
    } else {
      p.accent = oAccent || readable([lead, t.partner, p.ink], p.paper, 3);
      p.panel = p.accent;
      p.panelInk = readable([t.onLead, p.paper, '#ffffff', '#111111'], p.panel, 3);
    }
    p.second = t.partner && t.partner !== p.accent && contrast(t.partner, p.paper) >= 1.4
      ? t.partner : mix(p.accent, p.paper, 0.4);
    p.muted = t.muted && contrast(t.muted, p.paper) >= 3.5 ? t.muted : mix(p.ink, p.paper, 0.4);
    p.rule = mix(p.paper, p.accent, 0.45);
  }
  p.edge = t.edge && contrast(t.edge, p.paper) >= 1.2 ? t.edge : mix(p.paper, p.ink, 0.22);

  // The seal: a rosette in the accent (Classic, Celebration), a badge in the
  // panel's ink (Modern), a ring in the accent (Minimal).
  if (style === 'modern' && shape === 'wide') {
    p.seal = p.panel;
    p.sealInk = p.panelInk;
  } else if (style === 'modern') {
    p.seal = p.panelInk;
    p.sealInk = p.panel;
  } else {
    p.seal = p.accent;
    p.sealInk = readable([p.accent === lead ? t.onLead : '', p.paper, '#ffffff', '#111111'], p.seal, 3);
  }
  p.sealInner = mix(p.seal, p.sealInk, 0.12);
  p.ribbon = style === 'celebration' ? mix(p.ink, p.paper, 0.15) : p.second;

  // A light that passes over the sheet once, for the shimmer: white on a dark
  // ground, a glint of the accent on a light one.
  p.sheen = isDark(p.paper) ? '#ffffff47' : withAlpha(mix(p.accent, '#ffffff', 0.7), 0.34);

  // Confetti and ornaments: the brand's own colours, each one visible on the
  // paper it falls across.
  var pool = [p.accent, p.second, t.partner, t.onLead].concat(t.family);
  var confetti = [];
  for (var i = 0; i < pool.length && confetti.length < 6; i++) {
    var c = pool[i];
    if (c && confetti.indexOf(c) < 0 && contrast(c, p.paper) >= 1.3) confetti.push(c);
  }
  if (confetti.length < 3) confetti.push(p.ink, mix(p.accent, p.paper, 0.5));
  p.confetti = confetti;
  return p;
}

// ── wording ─────────────────────────────────────────────────────────────────

// 'YYYY-MM-DD' -> '18 June 2026' (or the print language's own long date).
// Anything else (a typed word, an empty value) passes straight through, so a
// hand-written "Spring 2026" still prints.
function fmtDate(v, lang) {
  var s = str(v);
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return s;
  var y = Number(m[1]);
  var mo = Number(m[2]);
  var day = Number(m[3]);
  if (!(mo >= 1 && mo <= 12) || !(day >= 1 && day <= 31)) return s;
  if (lang !== 'en' && typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
    try {
      var locale = own(CT_LOCALE, lang) ? CT_LOCALE[lang] : lang;
      return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
        .format(new Date(Date.UTC(y, mo - 1, day)));
    } catch (e) { /* an engine without that locale prints the English date */ }
  }
  return day + ' ' + MONTHS[mo - 1] + ' ' + m[1];
}

// The direction of a typed line: its first strong character decides, as the
// browser's dir="auto" does.
function textDir(s) {
  var text = str(s);
  for (var i = 0; i < text.length; i++) {
    var c = text.charCodeAt(i);
    if ((c >= 0x0590 && c <= 0x08ff) || (c >= 0xfb1d && c <= 0xfdff) || (c >= 0xfe70 && c <= 0xfeff)) return 'rtl';
    if ((c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a) || (c >= 0xc0 && c <= 0x24f) || (c >= 0x370 && c <= 0x58f) || c >= 0x900) return 'ltr';
  }
  return '';
}

// ── fit ─────────────────────────────────────────────────────────────────────

// Advance widths in em, by character class: an approximation of a display sans,
// erring wide so a name rarely needs the template's measured correction.
function emWidth(text) {
  var w = 0;
  var chars = Array.from(text);
  for (var i = 0; i < chars.length; i++) {
    var ch = chars[i];
    var c = ch.codePointAt(0);
    if (c === 32) w += 0.27;
    else if ((c >= 0x1100 && c <= 0x115f) || (c >= 0x2e80 && c <= 0xa4cf) || (c >= 0xac00 && c <= 0xd7af) ||
      (c >= 0xf900 && c <= 0xfaff) || (c >= 0xfe30 && c <= 0xfe4f) || (c >= 0xff00 && c <= 0xff60) || c >= 0x20000) w += 1;
    else if (c >= 0x0590 && c <= 0x08ff) w += 0.52;
    else if (c >= 0x0900 && c <= 0x0dff) w += 0.62;
    else if (/[0-9]/.test(ch)) w += 0.58;
    else if (/[iljtfr.,'’\-]/.test(ch)) w += 0.32;
    else if (/[mwMW]/.test(ch)) w += 0.86;
    else if (ch.toUpperCase() === ch && ch.toLowerCase() !== ch) w += 0.68;
    else if (ch.toLowerCase() === ch && ch.toUpperCase() !== ch) w += 0.55;
    else w += 0.6;
  }
  return w;
}

function shapeOf(aspect) {
  for (var i = 0; i < SHAPES.length; i++) if (aspect >= SHAPES[i].min) return SHAPES[i];
  return SHAPES[SHAPES.length - 1];
}

// The widths and largest sizes, in layout units, that styles.css gives the name
// and the course line in each style and shape. `sheetW` is the sheet's width in
// layout units: 1000, or more when the sheet is wider than its design box.
function boxes(style, shape, sheetW) {
  var portrait = shape === 'square' || shape === 'tall' || shape === 'story';
  var nameMax = { wide: 54, land: 68, square: 92, tall: 112, story: 132 }[shape];
  var courseMax = { wide: 24, land: 30, square: 38, tall: 46, story: 56 }[shape];
  var w;
  if (shape === 'wide') w = sheetW - 480;
  else if (style === 'modern') w = portrait ? sheetW - 190 : sheetW - 340 - 150;
  else if (style === 'minimal') w = sheetW - 200;
  else w = Math.min(900, sheetW - (portrait ? 190 : 230));
  if (style === 'minimal') nameMax = Math.round(nameMax * 1.15);
  if (style === 'modern' && !portrait) nameMax = Math.round(nameMax * 0.94);
  return { width: Math.max(260, w), nameMax: nameMax, courseMax: courseMax, courseLines: portrait ? 3 : 2 };
}

// The name is the hero: the largest size that keeps it on one line, down to a
// floor; below the floor it takes two balanced lines rather than shrinking to
// a whisper.
function fitName(name, box) {
  var em = Math.max(1, emWidth(name));
  var one = Math.floor(box.width / em);
  var floor = Math.round(box.nameMax * 0.56);
  if (one >= floor) return { size: Math.min(box.nameMax, one), lines: 1 };
  var two = Math.floor(box.width * 2 / (em * 1.12));
  return { size: Math.max(Math.round(box.nameMax * 0.32), Math.min(Math.round(box.nameMax * 0.8), two)), lines: 2 };
}

// The course is a sentence and is meant to wrap, balanced, up to the shape's
// line budget.
function fitCourse(course, box) {
  var em = Math.max(1, emWidth(course));
  var size = Math.floor(box.width * box.courseLines / (em * 1.15));
  return Math.max(Math.round(box.courseMax * 0.55), Math.min(box.courseMax, size));
}

// ── shapes the template draws ───────────────────────────────────────────────

// The rosette's scalloped edge in its 120-unit box.
function scallopPath(bumps) {
  var cx = 60;
  var cy = 60;
  var r = 52;
  var R = 59;
  var d = '';
  for (var i = 0; i < bumps; i++) {
    var a0 = (i / bumps) * Math.PI * 2;
    var a1 = ((i + 1) / bumps) * Math.PI * 2;
    var am = (a0 + a1) / 2;
    if (i === 0) d += 'M' + round(cx + r * Math.cos(a0), 2) + ' ' + round(cy + r * Math.sin(a0), 2);
    d += 'Q' + round(cx + R * Math.cos(am), 2) + ' ' + round(cy + R * Math.sin(am), 2) + ' ' +
      round(cx + r * Math.cos(a1), 2) + ' ' + round(cy + r * Math.sin(a1), 2);
  }
  return d + 'Z';
}

function starPath() {
  var d = '';
  for (var i = 0; i < 10; i++) {
    var a = -Math.PI / 2 + (i * Math.PI) / 5;
    var r = i % 2 ? 9.5 : 22;
    d += (i ? 'L' : 'M') + round(60 + r * Math.cos(a), 2) + ' ' + round(61 + r * Math.sin(a), 2);
  }
  return d + 'Z';
}

var GLYPHS = {
  check: { d: 'M43 61 L55 73 L78 48', stroke: true },
  star: { d: starPath(), stroke: false },
  heart: { d: 'M60 80 C42 67 38 58 38 51 C38 44 43 39 49.5 39 C54 39 57.5 41.5 60 45.5 C62.5 41.5 66 39 70.5 39 C77 39 82 44 82 51 C82 58 78 67 60 80 Z', stroke: false },
};

// A small seeded generator: the same seed gives the same pieces in every shell.
function rng(seed) {
  var s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    var t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Celebration's printed confetti: thrown into two opposite corners and thinning
// out along the margins, so it frames the sheet and never crosses the wording.
// Each corner has a streak down the side margin and one along the top or foot
// margin; the bands are the body's own padding, as a share of the sheet.
// Positions are percentages of the sheet; sizes are layout units. Pieces keep a
// little air between them, so a cluster reads as thrown, not piled.
var ORNAMENT_BANDS = {
  wide: { side: 4.5, end: 9, along: 30, down: 42, grow: 0.9, aspect: 3 },
  land: { side: 9, end: 7.5, along: 24, down: 40, grow: 1, aspect: 1.41 },
  square: { side: 8, end: 8, along: 26, down: 30, grow: 1.35, aspect: 1 },
  tall: { side: 8, end: 7, along: 28, down: 22, grow: 1.7, aspect: 0.75 },
  story: { side: 7.5, end: 8, along: 30, down: 18, grow: 1.9, aspect: 0.56 },
};

function ornaments(colours, shape) {
  var rnd = rng(337);
  var band = ORNAMENT_BANDS[shape] || ORNAMENT_BANDS.land;
  var out = [];
  var kinds = ['dot', 'pill', 'ring', 'pill', 'dot', 'spark'];
  // [corner x, corner y, pieces down the side, pieces along the end]
  var corners = [[0, 0, 8, 7], [1, 1, 8, 7], [1, 0, 3, 2], [0, 1, 3, 2]];
  for (var k = 0; k < corners.length; k++) {
    var scale = k >= 2 ? 0.55 : 1;
    for (var streak = 0; streak < 2; streak++) {
      var want = corners[k][2 + streak];
      var placed = 0;
      for (var tries = 0; placed < want && tries < 300; tries++) {
        var d = Math.pow(rnd(), 0.8);
        var across = 0.6 + rnd() * 0.4;
        var dx = streak === 0 ? across * band.side : d * band.along * scale;
        var dy = streak === 0 ? d * band.down * scale : across * band.end;
        var x = Math.max(2.5, Math.min(97.5, corners[k][0] ? 100 - dx : dx));
        var y = Math.max(3, Math.min(97, corners[k][1] ? 100 - dy : dy));
        var clash = false;
        for (var j = 0; j < out.length && !clash; j++) {
          var ddx = (out[j].x - x) * band.aspect;
          var ddy = out[j].y - y;
          if (ddx * ddx + ddy * ddy < 9) clash = true;
        }
        if (clash) continue;
        var kind = kinds[Math.floor(rnd() * kinds.length)];
        out.push({
          i: out.length,
          kind: kind,
          x: round(x, 2),
          y: round(y, 2),
          size: round((kind === 'pill' ? 5 + rnd() * 2.5 : 7 + rnd() * 8) * (1 - d * 0.4) * band.grow, 1),
          rot: Math.round(rnd() * 180),
          color: colours[out.length % colours.length],
        });
        placed++;
      }
    }
  }
  return out;
}

// The confetti that falls in the Confetti motion: start across the width above
// the sheet, each with its own delay, fall time, sway and spin. Motion maths
// lives in the template; these are only the seeds.
function confettiPieces(colours) {
  var rnd = rng(2026);
  var out = [];
  for (var i = 0; i < 56; i++) {
    out.push({
      i: i,
      kind: rnd() < 0.68 ? 'strip' : 'dot',
      color: colours[i % colours.length],
      size: round(8 + rnd() * 8, 1),
      x: round(rnd() * 100, 2),
      delay: round(rnd() * 0.55, 3),
      fall: round(1.9 + rnd() * 0.7, 3),
      sway: round(1.5 + rnd() * 4, 2),
      phase: round(rnd() * 6.28, 3),
      spin: Math.round(200 + rnd() * 520) * (rnd() < 0.5 ? -1 : 1),
      rot: Math.round(rnd() * 180),
    });
  }
  return out;
}

// ── build ───────────────────────────────────────────────────────────────────

// px at 96 dpi for a value in the unit the page table declares.
function toPx(value, unit) {
  if (unit === 'mm') return Math.round(value * 96 / 25.4);
  if (unit === 'in') return Math.round(value * 96);
  return Math.round(value);
}

function build(args, theme, logoUrl, lang) {
  var style = pick(STYLES, str(args.style), 'classic');
  var motion = pick(MOTIONS, str(args.motion), 'none');
  var kind = own(KINDS, str(args.certKind)) ? str(args.certKind) : KIND_DEFAULT;
  var pageKey = own(PAGES, str(args.pageSize)) ? str(args.pageSize) : PAGE_DEFAULT;
  var page = PAGES[pageKey];
  var pageW = toPx(page.w, page.unit);
  var pageH = toPx(page.h, page.unit);
  var shape = shapeOf(pageW / pageH);
  var unitPx = Math.min(pageW / 1000, pageH / shape.h);
  var sheetW = Math.round(pageW / unitPx);

  var p = paletteFor(style, theme, args, shape.id);

  var typedTitle = str(args.heading);
  var name = (str(args.firstname) + ' ' + str(args.lastname)).trim();
  var course = str(args.awardtopic);
  var presenter = str(args.presenter);
  var dateText = fmtDate(args.awarddate, lang);
  var box = boxes(style, shape.id, sheetW);
  var nameFit = fitName(name || ' ', box);
  var glyph = GLYPHS[KINDS[kind].glyph];
  var showSeal = args.seal !== false;
  var celebrate = style === 'celebration';
  var ornamentList = celebrate ? ornaments(p.confetti, shape.id) : [];
  var pieces = motion === 'confetti' ? confettiPieces(p.confetti) : [];
  var langDir = own(CT_RTL, lang) ? 'rtl' : 'ltr';
  var dir = typedTitle ? (textDir(typedTitle) || langDir) : langDir;

  return {
    error: '',

    // Wording, in the print language.
    printLang: own(CT_LOCALE, lang) ? CT_LOCALE[lang] : lang,
    dir: dir,
    titleText: typedTitle || ctText(KINDS[kind].title, lang),
    leadText: ctText(LEAD, lang),
    citeText: ctText(KINDS[kind].cite, lang),
    dateLabel: ctText('Date', lang),
    playLabel: ctText('Play motion', lang),
    recipientName: name,
    courseText: course,
    dateText: dateText,
    presenterText: presenter,
    presenterTitleText: str(args.presenterTitle),
    companyText: str(args.company),
    serialText: str(args.serial),
    hasPresenter: !!presenter,
    hasDate: !!dateText,
    hasSign: !!presenter || !!dateText,

    // Issuer lockup: the logo when there is one, the company line otherwise,
    // and the company line stays under a logo when both are set.
    logoUrl: logoUrl || '',
    hasLogo: !!logoUrl,

    // Look and size.
    style: style,
    shape: shape.id,
    motion: motion,
    hasMotion: motion !== 'none',
    pageW: pageW,
    pageH: pageH,
    designH: shape.h,
    nameSizeU: nameFit.size,
    nameLines: nameFit.lines,
    courseSizeU: fitCourse(course || ' ', box),
    courseLines: box.courseLines,
    hasFrame: style === 'classic' || celebrate,
    hasInnerRule: style === 'classic',
    hasPanel: style === 'modern',

    // The seal.
    hasSeal: showSeal,
    sealRibbons: style === 'classic' || celebrate,
    sealScallop: style === 'classic' || celebrate,
    sealRing: style === 'minimal',
    sealEdge: scallopPath(22),
    sealGlyph: glyph.d,
    sealStroke: glyph.stroke,
    sealViewH: style === 'classic' || celebrate ? 150 : 120,

    // Celebration's printed confetti and the falling confetti of the motion.
    ornaments: ornamentList,
    confetti: pieces,
    // Numbers only, and `<` cannot occur: safe inside a <script> data island.
    motionJson: JSON.stringify({
      motion: motion,
      key: motion + '|' + style + '|' + pageKey,
      confetti: pieces.map(function (c) { return [c.x, c.delay, c.fall, c.sway, c.phase, c.spin, c.rot]; }),
    }),

    // Colours. paperColor drives --ct-paper, the only thing that paints the
    // sheet, so 'transparent' there is the whole transparent-background toggle.
    paperColor: args.transparentBg === true ? 'transparent' : p.paper,
    groundColor: p.paper,
    inkColor: p.ink,
    accentColor: p.accent,
    secondColor: p.second,
    mutedColor: p.muted,
    ruleColor: p.rule,
    edgeColor: p.edge,
    panelColor: p.panel,
    panelInk: p.panelInk,
    sealColor: p.seal,
    sealInk: p.sealInk,
    sealInner: p.sealInner,
    ribbonColor: p.ribbon,
    sheenColor: p.sheen,
  };
}

function blank(note, lang) {
  var out = build({}, {}, '', lang);
  out.error = ctText(note, lang);
  return out;
}

// The ground the logo sits on: Modern's panel, else the paper.
function logoGround(args, theme) {
  var style = pick(STYLES, str(args.style), 'classic');
  var p = paletteFor(style, theme, args);
  return { dark: isDark(style === 'modern' ? p.panel : p.paper), colourGround: style === 'modern' || style === 'celebration' };
}

async function compute(model, lang) {
  var args = {};
  for (var i = 0; i < model.length; i++) args[model[i].id] = model[i].value;

  var requested = str(args.language) || lang || '';
  if (!requested && typeof host !== 'undefined' && host && host.profile && host.profile.get) {
    try { requested = (await host.profile.get()).lang || ''; } catch (e) { requested = ''; }
  }
  var printLang = ctPrintLang(requested || 'en');

  var result;
  try {
    var theme = await readTheme();
    var wantLogo = args.brandLogo !== false;
    var logoUrl = '';
    if (wantLogo) {
      var ground = logoGround(args, theme);
      var version = pick(['auto', 'colour', 'mono'], str(args.logoStyle), 'auto');
      var mono = version === 'mono' || (version === 'auto' && ground.colourGround);
      var asset = await resolveBrandLogo(ground.dark, mono);
      logoUrl = asset ? asset.url : '';
    }
    result = build(args, theme, logoUrl, printLang);
    result._logoWarning = brandLogoWarning(wantLogo && !logoUrl);
  } catch (err) {
    result = blank('This certificate could not be laid out. Check the sheet size and the colours.', printLang);
  }
  return result;
}

function onInit({ model, lang }) {
  return compute(model, lang);
}

function onInput({ id, model, lang }) {
  // A theme or colourway switch: read the design system again.
  if (id === '__tokens') _theme = null;
  return compute(model, lang);
}
