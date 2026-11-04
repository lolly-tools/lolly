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

/** "**Label:** text", "**Label**: text" or "**Label** - text" as [label, text], else null. */
function labelled(text) {
  var m = /^(?:\*\*|__)([^*_]{1,60}?)(?::\s*)?(?:\*\*|__)\s*[:\-–]?\s*([\s\S]*)$/.exec(String(text).trim());
  if (!m) return null;
  return [m[1].replace(/[:\s]+$/, '').trim(), m[2].trim()];
}

function parse(md) {
  var lines = String(md == null ? '' : md).replace(/\r\n?/g, '\n').split('\n');
  var title = '', meta = '', intro = [], points = [], notes = [];
  var para = [], section = null, item = null;

  var flushItem = function () {
    if (!item) return;
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
    var lab = labelled(text);
    if (lab && NOTE_LABEL.test(lab[0])) { notes.push({ label: lab[0], text: lab[1] }); return; }
    if (section) { section.parts.push(text); return; }
    // A details line under a # title ("Company · Topic") belongs with the title.
    if (title && !meta && !intro.length && !points.length && text.indexOf('\n') < 0 && /\s(?:\u00b7|\|)\s/.test(text)) {
      meta = text.split(/\s+(?:\u00b7|\|)\s+/).map(stripEmphasis).join(' \u00b7 ');
      return;
    }
    if (!title && !points.length && !intro.length && /^(\*\*|__)/.test(text) && text.indexOf('\n') < 0 && (!lab || !lab[1] || /^(?:·|\|)/.test(lab[1]))) {
      var parts = text.split(/\s+(?:·|\|)\s+/);
      title = stripEmphasis(parts[0]);
      meta = parts.slice(1).map(stripEmphasis).join(' · ');
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
      if (!title && heading[1].length === 1 && !points.length) {
        var hp = heading[2].split(/\s+(?:·|\|)\s+/);
        title = stripEmphasis(hp[0]);
        meta = hp.slice(1).map(stripEmphasis).join(' · ');
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
  return compute(_args(model));
}

// biome-ignore lint/correctness/noUnusedVariables: The engine calls this named hook.
function onInput({ model }) {
  return compute(_args(model));
}
