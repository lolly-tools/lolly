/* global host */
/**
 * Brief hooks.
 *
 * Reads the Markdown in `body` into the parts the logic-less template lays out:
 * a title and the details under it, an opening paragraph, labelled points and
 * notes for the foot of the page. Each piece of text stays Markdown and is
 * rendered by the template's `markdown` helper, which escapes it. DOM-free and
 * never throws, so whatever an assistant writes still makes a page.
 *
 * What it reads (the input help says the same):
 *   title       a first line in bold, or a # heading; parts after " · " or " | "
 *               are the details under it ("**Name** · Role · Company")
 *   points      "- **Label:** text" list items, or a ## heading with what follows
 *   notes       a "**Not confirmed:**", "**Sources:**" or "**Note:**" paragraph
 *               wherever it stands, and any plain paragraph after the points
 */

var NOTE_LABEL = /^(not confirmed|unconfirmed|unverified|sources?|notes?|caveats?|disclaimer|based on)$/i;
var MAX_POINTS = 12;

function stripEmphasis(s) {
  return String(s).trim().replace(/^(\*\*|__)(.*)\1$/, '$2').replace(/^(\*|_)(.*)\1$/, '$2').trim();
}

/** "**Label:** text", "**Label**: text" or "**Label** - text" as [label, text], else null.
 *  A note's label may also stand plain ("Sources: ..."). */
function labelled(text) {
  var s = String(text).trim();
  var m = /^(?:\*\*|__)([^*_]{1,60}?)(?::\s*)?(?:\*\*|__)\s*[:\-–]?\s*([\s\S]*)$/.exec(s);
  if (m) return [m[1].replace(/[:\s]+$/, '').trim(), m[2].trim()];
  var plain = /^([A-Za-z][A-Za-z ]{1,30}):\s*([\s\S]*)$/.exec(s);
  return plain && NOTE_LABEL.test(plain[1].trim()) ? [plain[1].trim(), plain[2].trim()] : null;
}

/** A title line's parts: "**Name** · Role" or "**Name · Role**" as [name, details]. */
function titleParts(line) {
  var s = /^(\*\*|__)[^*_]*\1$/.test(line.trim()) ? stripEmphasis(line) : line;
  var parts = s.split(/\s+(?:·|\|)\s+/);
  return [stripEmphasis(parts[0]), parts.slice(1).map(stripEmphasis).join(' · ')];
}

function parse(md) {
  var lines = String(md == null ? '' : md).replace(/\r\n?/g, '\n').split('\n');
  var title = '', meta = '', intro = [], points = [], notes = [];
  var para = [], section = null, item = null;
  // A note label with nothing after it ("Sources:") takes the list that follows.
  var openNote = null;

  var flushItem = function () {
    if (!item) return;
    if (openNote) { openNote.text += (openNote.text ? ' · ' : '') + item.trim(); item = null; return; }
    // A label still being written ("- **Sig", as an answer streams in) shows as a
    // label, not as asterisks.
    var opening = /^(?:\*\*|__)([^*_]*)$/.exec(item.trim());
    if (opening) { points.push({ label: opening[1].replace(/[:\s]+$/, ''), text: '' }); item = null; return; }
    var lab = labelled(item);
    points.push(lab ? { label: lab[0], text: lab[1] } : { label: '', text: item.trim() });
    item = null;
  };
  var flushPara = function () {
    if (!para.length) return;
    var text = para.join('\n').trim();
    para = [];
    if (!text) return;
    openNote = null;
    var lab = labelled(text);
    if (lab && NOTE_LABEL.test(lab[0])) {
      var note = { label: lab[0], text: lab[1] };
      notes.push(note);
      if (!lab[1]) openNote = note;
      return;
    }
    if (section) { section.parts.push(text); return; }
    // A details line under a # title ("Company · Topic") belongs with the title.
    if (title && !meta && !intro.length && !points.length && text.indexOf('\n') < 0 && /\s(?:\u00b7|\|)\s/.test(text)) {
      meta = text.split(/\s+(?:\u00b7|\|)\s+/).map(stripEmphasis).join(' \u00b7 ');
      return;
    }
    if (!title && !points.length && !intro.length && /^(\*\*|__)/.test(text) && text.indexOf('\n') < 0 && (!lab || !lab[1] || /^(?:·|\|)/.test(lab[1]))) {
      var tp = titleParts(text);
      title = tp[0];
      meta = tp[1];
      return;
    }
    if (lab && lab[1] && points.length) { points.push({ label: lab[0], text: lab[1] }); return; }
    if (points.length) notes.push({ label: '', text: text });
    else intro.push(text);
  };
  var flushSection = function () {
    if (!section) return;
    var text = section.parts.join('\n\n').trim();
    if (NOTE_LABEL.test(section.label)) notes.push({ label: section.label, text: text });
    else if (text || section.label) points.push({ label: section.label, text: text });
    section = null;
  };

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var heading = /^\s*(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    var bullet = /^\s*(?:[-*•]|\d+[.)])\s+(.*)$/.exec(line);
    if (heading) {
      flushItem(); flushPara();
      openNote = null;
      if (!title && heading[1].length === 1 && !points.length) {
        var hp = titleParts(heading[2]);
        title = hp[0];
        meta = hp[1];
      } else {
        flushSection();
        section = { label: stripEmphasis(heading[2]).replace(/:$/, ''), parts: [] };
      }
    } else if (bullet) {
      flushPara();
      if (section) { section.parts.push(line.trim()); continue; }
      flushItem();
      item = bullet[1];
    } else if (!line.trim()) {
      flushItem(); flushPara();
    } else if (item !== null && /^\s+\S/.test(line)) {
      item += ' ' + line.trim();
    } else {
      flushItem();
      para.push(line);
    }
  }
  flushItem(); flushPara(); flushSection();
  return { title: title, meta: meta, intro: intro, points: points.slice(0, MAX_POINTS), notes: notes };
}

/** A type size for the amount of text: a short brief sets larger, a long one smaller. */
function scaleFor(chars) {
  if (chars <= 500) return 1.2;
  if (chars <= 900) return 1.05;
  if (chars <= 1400) return 0.92;
  if (chars <= 2000) return 0.82;
  if (chars <= 2800) return 0.74;
  return 0.66;
}

function compute(v) {
  var b = parse(v.body);
  var chars = b.intro.concat(b.points.map(function (p) { return p.label + ' ' + p.text; })).join(' ').length;
  var n = b.points.length;
  return {
    briefTitle: b.title,
    briefMeta: b.meta,
    intro: b.intro,
    points: b.points,
    notes: b.notes,
    hasNotes: b.notes.length > 0,
    scale: String(scaleFor(chars)),
    wideCols: String(n <= 3 ? Math.max(1, n) : n === 4 ? 2 : n <= 9 ? 3 : 4),
  };
}

function _args(model) {
  return Object.fromEntries(model.map(function (i) { return [i.id, i.value]; }));
}

// biome-ignore lint/correctness/noUnusedVariables: The engine calls this named hook.
function onInit({ model }) {
  return surfaceRender(model);
}

// biome-ignore lint/correctness/noUnusedVariables: The engine calls this named hook.
function onInput({ model }) {
  return surfaceRender(model);
}

async function surfaceRender(model) {
  var values = _args(model);
  var palette = await toolSurface(values, {});
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
