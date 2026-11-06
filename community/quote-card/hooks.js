// SPDX-License-Identifier: MPL-2.0
// Quote: the words, the colours the design system offers for them, and the motion.
//
// 1. The two layouts the tool shipped with (beside, centred) keep their markup and
//    their colours when none of the new fields is filled, so an old link renders as
//    it did. Everything below that reaches them is opt-in by a field being set.
//
// 2. MARKUP built here reaches the template through {{{ }}}, so every value the person
//    typed goes through esc() first. Style values are parsed to a hex colour or a
//    number before they are written.
//
// 3. COLOUR. Each ground has a colour for the words that is made to sit on it. A
//    decoration or a highlight is measured against the ground it lands on, under the
//    active colourway, light or dark. The primary colour is never used for words on
//    the surface.
//
// 4. MOTION is data here and playback in the template's script: the hook chooses the
//    units and reads durations and curves from the design system. The script assigns
//    them once the page is laid out, because a line only exists after layout.
//
// Nothing here touches the page, so the hooks can run in a Worker.

// === lolly:shared esc - generated from community/_shared/text.js; edit there and run npm run sync:shared ===
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
// === /lolly:shared esc ===

var GROUNDS = { lead: 1, ink: 1, paper: 1 };
var MOTIONS = { none: 1, word: 1, line: 1, sweep: 1, draw: 1 };
// How far a layout may grow its type to fill the frame. The two original layouts
// never grow; they only shrink when a long quote would not fit.
var GROW = { type: 4.5, glyph: 3, pull: 3, citation: 2.4, portrait: 2.4, marker: 2.2 };
var PLAY_LABEL = 'Play motion';

// Built-in timing where a design system names none. A system's motion tokens replace them.
var UNIT_MS = 400;
var BLOCK_MS = 700;
var STAGGER_MS = 80;
var EASE = 'cubic-bezier(0.05,0.7,0.1,1)';

// An entrance longer than this stops being an entrance, so a long quote deals faster.
var MAX_DEAL_MS = 5000;

var RTL_RE = /[֐-ࣿיִ-﷿ﹰ-﻿]/;
var LTR_RE = /[A-Za-zÀ-ɏͰ-ϿЀ-ӿ]/;
var CJK_RE = /[぀-ヿ㐀-䶿一-鿿豈-﫿ｦ-ﾟ]/;
// Kept with the character before: a line never starts with one of these.
var CJK_CLOSE_RE = /^[、。，．！？：；）」』】〉》”’…ー々]$/;
// Kept with the character after: a line never ends with one of these.
var CJK_OPEN_RE = /^[（「『【〈《“‘]$/;

function clean(v) {
  return v == null ? '' : String(v).trim();
}

function inputs(model) {
  var o = {};
  (model || []).forEach(function (i) { o[i.id] = i.value; });
  return o;
}

function own(table, key) {
  return Object.prototype.hasOwnProperty.call(table, key);
}

// ── text units ──────────────────────────────────────────────────────────────

var SEGMENTER = (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function')
  ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;

function graphemes(s) {
  if (!SEGMENTER) return Array.from(s);
  return Array.from(SEGMENTER.segment(s), function (r) { return r.segment; });
}

// One run with no spaces in it, as the units that move together. Latin, Arabic and
// Hangul take the whole word. Chinese and Japanese have no spaces, so each character
// is its own unit, with its punctuation held to it so the line breaker cannot strand
// the mark at the start or end of a line.
function runUnits(run) {
  if (!CJK_RE.test(run)) return [run];
  var out = [];
  var open = '';
  graphemes(run).forEach(function (g) {
    if (CJK_OPEN_RE.test(g)) { open += g; return; }
    if (CJK_CLOSE_RE.test(g) && out.length && !open) { out[out.length - 1] += g; return; }
    out.push(open + g);
    open = '';
  });
  if (open) out.push(open);
  return out;
}

// A reading order the browser can only keep while the runs stay inline: an atomic
// inline counts as a neutral character, so splitting an embedded Latin phrase out of
// an Arabic sentence would reverse its words. Correct order beats moving by word.
function mixedDirection(text) {
  return RTL_RE.test(text) && LTR_RE.test(text);
}

// The whitespace-separated pieces of a stretch of text, keeping whether a space
// followed each one, so `dis[appear]s` stays one word on the page.
function pieces(text) {
  var out = [];
  var re = /(\S+)(\s*)/g;
  var m;
  var leading = /^\s/.test(text);
  while ((m = re.exec(text))) out.push({ text: m[1], space: !!m[2] });
  return { leading: leading, list: out };
}

// The stretch of the quote the person asked to emphasise, or null. Exact first, then
// ignoring case. Never a guess: a phrase that is not in the quote marks nothing.
function findPhrase(quote, phrase) {
  if (!phrase) return null;
  var at = quote.indexOf(phrase);
  var end = at + phrase.length;
  if (at < 0) {
    var re;
    try { re = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'iu'); } catch (e) { return null; }
    var m = re.exec(quote);
    if (!m) return null;
    at = m.index;
    end = at + m[0].length;
  }
  // A marker stops at a space: cutting a word would let the line break inside it and
  // break the shaping of a joining script, and a mark left beside the marker would sit
  // half under its edge. Han and Kana have no spaces and run to their own characters.
  if (!CJK_RE.test(quote.slice(at, end))) {
    while (at > 0 && !/\s/.test(quote[at - 1])) at--;
    while (end < quote.length && !/\s/.test(quote[end])) end++;
  }
  return { start: at, end: end };
}

// The quote's markup, or '' when plain text does the job (no motion by word, no
// phrase), which is what leaves the original layouts' markup unchanged.
function quoteMarkup(quote, phrase, opts) {
  var hit = findPhrase(quote, phrase);
  if (!opts.split && !hit) return { html: '', units: 0 };
  var stretches = hit
    ? [{ text: quote.slice(0, hit.start) }, { text: quote.slice(hit.start, hit.end), em: true }, { text: quote.slice(hit.end) }]
    : [{ text: quote }];
  var units = 0;
  var html = '';
  stretches.forEach(function (st) {
    if (!st.text) return;
    // With no motion by word, plain text stays plain and only a marker needs its own box.
    if (!opts.split && !(st.em && opts.marker)) {
      html += st.em ? '<span class="qc-em">' + esc(st.text) + '</span>' : esc(st.text);
      return;
    }
    var p = pieces(st.text);
    if (p.leading) html += ' ';
    p.list.forEach(function (piece) {
      runUnits(piece.text).forEach(function (u) {
        units++;
        var cls = 'qc-w' + (st.em ? (opts.marker ? ' qc-hl' : ' qc-em') : '');
        html += '<span class="' + cls + '" aria-hidden="true">'
          + (st.em && opts.marker ? '<span class="qc-hlbg" aria-hidden="true"></span>' : '')
          + esc(u) + '</span>';
      });
      if (piece.space) html += ' ';
    });
  });
  return {
    html: '<span class="qc-split" role="text" aria-label="' + esc(quote) + '">' + html + '</span>',
    units: units,
  };
}

// ── the source line ─────────────────────────────────────────────────────────

// Join what was typed and nothing else: an empty field leaves no separator behind,
// and a value that already ends in punctuation does not get a second mark.
function joinParts(parts, sep) {
  return parts.filter(Boolean).join(sep);
}

function period(html) {
  return html && !/[.!?…。！？]$/.test(html.replace(/<[^>]+>/g, '')) ? html + '.' : html;
}

function shortLink(url) {
  return url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '');
}

function sourceLines(v) {
  var name = clean(v.name);
  var role = clean(v.role);
  var work = clean(v.source);
  var pub = clean(v.publication);
  var date = clean(v.date);
  var link = clean(v.link);
  var cite = work ? '<cite>' + esc(work) + '</cite>' : '';
  var where = joinParts([esc(pub), esc(date)], ', ');
  return {
    // Beside any other layout: the work and where it appeared, one line.
    sourceHtml: joinParts([cite, where], ', '),
    // A citation runs them together as one reference, the way a paper does.
    refHtml: joinParts([period(joinParts([esc(name), esc(role)], ', ')), period(cite), period(where)], ' '),
    linkText: link ? shortLink(link) : '',
  };
}

// ── the design system ───────────────────────────────────────────────────────
// Read once and kept, because onInput runs on every keystroke. A theme or colourway
// switch reaches onInput as '__tokens', which drops the kept answers.

var _theme = null;

function hex(v) {
  if (typeof v !== 'string') return '';
  var s = v.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(s)) return s;
  if (/^#[0-9a-f]{8}$/.test(s)) return s.slice(0, 7);
  if (/^#[0-9a-f]{3}$/.test(s)) return '#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
  return '';
}

function durationMs(v) {
  var n = null;
  var unit = 'ms';
  if (typeof v === 'number') n = v;
  else if (typeof v === 'string') {
    var m = /^\s*(\d+(?:\.\d+)?|\.\d+)\s*(ms|s)\s*$/i.exec(v);
    if (m) { n = Number(m[1]); unit = m[2].toLowerCase(); }
  } else if (v && typeof v === 'object' && typeof v.value === 'number') {
    n = v.value;
    unit = v.unit === 's' ? 's' : 'ms';
  }
  if (n === null || !(n > 0)) return 0;
  return Math.min(4000, unit === 's' ? n * 1000 : n);
}

function curveCss(v) {
  if (v && typeof v === 'object' && !Array.isArray(v) && Array.isArray(v.timingFunction)) v = v.timingFunction;
  if (!Array.isArray(v) || v.length !== 4) return '';
  for (var i = 0; i < 4; i++) if (typeof v[i] !== 'number' || !isFinite(v[i])) return '';
  if (v[0] < 0 || v[0] > 1 || v[2] < 0 || v[2] > 1) return '';
  return 'cubic-bezier(' + v.join(',') + ')';
}

// The corner the design system states, as a share of the shorter side of a 1200 px
// frame, so it scales with the artwork. Empty when the system states no corner.
function radiusVar(v) {
  var n = null;
  if (typeof v === 'number') n = v;
  else if (typeof v === 'string') {
    var m = /^\s*(\d+(?:\.\d+)?)\s*(px|rem)\s*$/i.exec(v);
    if (m) n = Number(m[1]) * (m[2].toLowerCase() === 'rem' ? 16 : 1);
  } else if (v && typeof v === 'object' && typeof v.value === 'number') {
    n = v.value * (v.unit === 'rem' ? 16 : 1);
  }
  if (n === null || !(n >= 0)) return '';
  return (Math.round(n / 12 * 100) / 100) + 'cqmin';
}

async function readTheme() {
  if (_theme) return _theme;
  var t = { lead: '', onLead: '', partner: '', surface: '', text: '', muted: '', edge: '', unitMs: 0, blockMs: 0, ease: '', radius: '' };
  if (typeof host !== 'undefined' && host && host.tokens && host.tokens.resolve) {
    var read = async function (ref) {
      try { return await host.tokens.resolve(ref); } catch (e) { return null; }
    };
    t.lead = hex(await read('{color.semantic.primary}'));
    t.onLead = hex(await read('{color.semantic.on-primary}'));
    t.partner = hex(await read('{color.semantic.secondary}'));
    t.surface = hex(await read('{color.semantic.surface}'));
    t.text = hex(await read('{color.semantic.text}'));
    t.muted = hex(await read('{color.semantic.muted}'));
    t.edge = hex(await read('{color.semantic.edge}'));
    t.unitMs = durationMs(await read('{motion.duration.medium}'));
    t.blockMs = durationMs(await read('{motion.duration.long}'));
    t.ease = curveCss(await read('{motion.curve.emphasised}'));
    t.radius = radiusVar(await read('{shape.radius}'));
  }
  _theme = t;
  return t;
}

function luminance(h) {
  var c = [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)].map(function (x) {
    var s = x / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

function contrast(a, b) {
  var la = luminance(a);
  var lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// The first candidate that clears `min` on `ground`, else whichever came closest.
function readable(candidates, ground, min) {
  var best = '';
  var bestScore = -1;
  for (var i = 0; i < candidates.length; i++) {
    var c = candidates[i];
    if (!c) continue;
    var score = contrast(c, ground);
    if (score >= min) return c;
    if (score > bestScore) { best = c; bestScore = score; }
  }
  return best;
}

// The colours a new layout reads. Empty when the design system could not be read,
// and the stylesheet's own var() fallbacks draw the card instead.
function paletteVars(ground, t) {
  if (!t.surface || !t.text || !t.lead) return '';
  var onLead = t.onLead || readable([t.surface, t.text], t.lead, 4.5);
  var g = ground === 'lead' ? t.lead : ground === 'ink' ? t.text : t.surface;
  var ink = ground === 'lead' ? onLead : ground === 'ink' ? t.surface : t.text;
  // Decoration is not text, so 3:1 is enough, and the lead colour leads where it can.
  var deco = readable(ground === 'lead' ? [t.partner, onLead] : [t.lead, t.partner, ink], g, 3);
  // The band behind a picture sits on the ground, and is decoration too.
  var band = readable(ground === 'lead' ? [t.partner, onLead] : [t.lead, t.partner, ink], g, 1.6);
  // An emphasised word is text, so it has to clear 4.5:1, or stay in the ink colour.
  var em = readable(ground === 'lead' ? [onLead] : ground === 'ink' ? [t.partner, t.lead, ink] : [t.text], g, 4.5);
  // A marker is a pair made to sit together: the lead and the colour on it, swapped
  // on the lead's own ground so it still shows.
  var hlBg = ground === 'lead' ? onLead : readable([t.lead, t.partner, ink], g, 2);
  var hlInk = hlBg === onLead ? t.lead : readable([onLead, t.surface, t.text], hlBg, 4.5);
  var vars = ['--qc-deco:' + deco, '--qc-band:' + band, '--qc-em:' + em, '--qc-hl-bg:' + hlBg, '--qc-hl-ink:' + hlInk];
  if (t.radius) vars.push('--qc-radius:' + t.radius);
  return vars.join(';');
}

// ── the piece as a whole ────────────────────────────────────────────────────

function wordCount(quote) {
  var latin = quote.split(/\s+/).filter(Boolean).length;
  var cjk = (quote.match(new RegExp(CJK_RE.source, 'g')) || []).length;
  // Two CJK characters read about like one word.
  return latin + Math.ceil(cjk / 2);
}

// A title holds long enough to read twice: about a second for every four words, never
// under two seconds. Capped so a very long quote still makes a usable clip.
function holdMs(words) {
  return Math.round(Math.min(12000, Math.max(2000, (words / 4) * 1000)));
}

async function compute(model) {
  var v = inputs(model);
  var quote = clean(v.quote);
  var phrase = clean(v.phrase);
  var layout = String(v.layout || 'beside');
  var ground = own(GROUNDS, v.ground) ? v.ground : 'lead';
  var motion = own(MOTIONS, v.motion) ? v.motion : 'none';
  var isNew = own(GROW, layout);
  var marker = layout === 'marker';
  var wantsSplit = (motion === 'word' || motion === 'line') && !mixedDirection(quote);
  var built = quoteMarkup(quote, phrase, { split: wantsSplit, marker: marker });
  var src = sourceLines(v);
  var moving = motion !== 'none';
  var theme = (isNew || moving || phrase) ? await readTheme() : null;

  var classes = [];
  if (moving) classes.push('qc-moving');
  if (RTL_RE.test(quote)) classes.push('qc-rtl');
  if (!clean(v.name) && !clean(v.role) && !src.sourceHtml && !src.linkText) classes.push('qc-bare');

  var words = wordCount(quote);
  var unitMs = (theme && theme.unitMs) || UNIT_MS;
  var blockMs = (theme && theme.blockMs) || BLOCK_MS;
  var stagger = built.units ? Math.min(STAGGER_MS, Math.floor(MAX_DEAL_MS / built.units)) : 0;

  return {
    quoteHtml: built.html,
    sourceHtml: src.sourceHtml,
    refHtml: layout === 'citation' ? src.refHtml : '',
    linkText: src.linkText,
    qcClass: classes.join(' '),
    qcStyle: (isNew || phrase) && theme ? paletteVars(ground, theme) : '',
    qcGrow: GROW[layout] || 0,
    qcGlyph: layout === 'glyph' ? (RTL_RE.test(quote) ? '”' : '“') : '',
    qcRules: layout === 'pull',
    qcHideMark: isNew,
    hasMotion: moving,
    playLabel: PLAY_LABEL,
    // The clip's length before layout says how many lines there are. The script
    // refines it once they exist.
    qcClipMs: moving ? blockMs + Math.max(blockMs, built.units * stagger + unitMs) + holdMs(words) : 0,
    qcMotionJson: moving ? JSON.stringify({
      motion: motion,
      unitMs: unitMs,
      blockMs: blockMs,
      staggerMs: stagger || STAGGER_MS,
      ease: (theme && theme.ease) || EASE,
      holdMs: holdMs(words),
    }).replace(/</g, '\\u003c') : '',
  };
}

function onInit(ctx) {
  return compute(ctx.model);
}

function onInput(ctx) {
  if (ctx.id === '__tokens') _theme = null;
  return compute(ctx.model);
}
