/* global host */
/**
 * Captions hooks.
 *
 * Subtitle text in, cues out. An SRT or WebVTT transcript is parsed into
 * { start, end, text }, the cue covering the preview time `t` is picked, and the
 * whole set is re-serialised so the .srt and .vtt sidecars are one clean dialect
 * whatever dialect arrived.
 *
 * The parser is deliberately tolerant, because a transcript is usually somebody
 * else's file: CRLF or LF, a byte-order mark, cue ids present or absent, comma
 * or dot before the milliseconds, an hours field or none, a WEBVTT header, NOTE
 * and STYLE blocks, cue settings after the timing, and inline tags like <b> or
 * <v Ana>. Anything it cannot read is counted and reported as a warning rather
 * than dropped in silence.
 *
 * The parse and the two serialisers live in the shared `cues` region
 * (community/_shared/captions.js), because audiogram, record and
 * top-tail-recorder read the same transcripts and must break at the same words
 * and write the same bytes. Edit them THERE and run npm run sync:shared; the
 * region's own header carries the engine-mirror rule.
 *
 * DOM-free, no host.* API required, and it never throws: every path returns a
 * patch, and a failure surfaces as the `capError` extra the template prints.
 */

// === lolly:shared clamp - generated from community/_shared/math.js; edit there and run npm run sync:shared ===
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
// === /lolly:shared clamp ===

// === lolly:shared safeColor - generated from community/_shared/math.js; edit there and run npm run sync:shared ===
function safeColor(v, fallback) {
  var s = String(v == null ? '' : v).trim();
  if (!s) return fallback;
  if (/^#[0-9a-fA-F]{3,8}$/.test(s)) return s;
  if (/^(rgb|rgba|hsl|hsla)\([0-9.,%\s/]+\)$/i.test(s)) return s;
  if (/^[a-zA-Z]+$/.test(s)) return s; // named colour (e.g. "transparent", "tomato")
  // A brand-token CSS var with an OPTIONAL literal-colour fallback - the documented
  // brand-inheritance path (brand-vars.ts injects --brand-primary/… onto the canvas root,
  // so a template can carry var(--brand-primary, #hex)). Strict on purpose: a var name and
  // at most one hex / named / rgb / hsl fallback, so nothing (no ; " ' < > { } or a nested
  // function) can break out of the style="…" property this value is interpolated into.
  if (/^var\(\s*--[a-zA-Z0-9-]+\s*(,\s*(#[0-9a-fA-F]{3,8}|[a-zA-Z]+|(?:rgb|rgba|hsl|hsla)\([0-9.,%\s/]+\)))?\s*\)$/.test(s)) return s;
  return fallback;
}
// === /lolly:shared safeColor ===

// A semantic token alias that does not resolve flattens to '', so every colour
// read needs a literal to fall back to. These two are the classic subtitle pair:
// near-white words on a near-black plate.
var FALLBACK_INK = '#f8fafc';
var FALLBACK_BG = '#111827';

var STYLES = ['bar', 'outline', 'box', 'karaoke'];
var POSITIONS = ['bottom', 'top', 'centre'];

var VIDEO_EXT = /\.(mp4|m4v|mov|webm|mkv|avi|ogv)($|\?|#)/i;
var AUDIO_EXT = /\.(mp3|wav|m4a|aac|ogg|oga|opus|flac|weba)($|\?|#)/i;

function num(v, d) { var n = Number(v); return Number.isFinite(n) ? n : d; }
function pick(v, list, d) { var s = String(v == null ? '' : v); return list.indexOf(s) >= 0 ? s : d; }
// === lolly:shared cues - generated from community/_shared/captions.js; edit there and run npm run sync:shared ===
function pad(n, w) { var s = String(n); while (s.length < w) s = '0' + s; return s; }
function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

/** "00:00:01,500", "00:01.5" or "1:02:03.250" to seconds, or null. */
function stampToSeconds(raw) {
  var m = /^(?:(\d+):)?(\d{1,2}):(\d{1,2})[.,](\d{1,3})$/.exec(String(raw == null ? '' : raw).trim());
  if (!m) return null;
  var hours = m[1] ? Number(m[1]) : 0;
  // One or two digits after the separator are tenths and hundredths, not
  // milliseconds: "0.5" is half a second.
  var frac = Number((m[4] + '00').slice(0, 3));
  return hours * 3600 + Number(m[2]) * 60 + Number(m[3]) + frac / 1000;
}

/** Seconds to HH:MM:SS<sep>mmm. The engine's `stamp`, mirrored. */
function fmtStamp(seconds, sep) {
  var ms = Math.max(0, Math.round(seconds * 1000));
  var h = Math.floor(ms / 3600000);
  var m = Math.floor((ms % 3600000) / 60000);
  var s = Math.floor((ms % 60000) / 1000);
  return pad(h, 2) + ':' + pad(m, 2) + ':' + pad(s, 2) + sep + pad(ms % 1000, 3);
}

/** The five entities a subtitle file is allowed to carry. `&amp;` goes last, so
 *  "&amp;lt;" decodes to "&lt;" and not to "<". */
function decodeEntities(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');
}

/** Cue payload to one clean line: tags out, entities decoded, runs of
 *  whitespace (line breaks included) collapsed to single spaces. */
function cleanText(s) {
  return decodeEntities(String(s).replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
}

/**
 * Parse SRT or WebVTT into cues, plus the warnings worth telling the user about.
 * Source order is kept: a file whose cues are out of order is reported, never
 * quietly rewritten, because the person who owns the file should decide.
 */
function parseCues(raw) {
  var warnings = [];
  var cues = [];
  var text = String(raw == null ? '' : raw)
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n');
  if (!text.trim()) return { cues: cues, warnings: warnings };

  var blocks = text.split(/\n{2,}/);
  var malformed = 0;
  for (var b = 0; b < blocks.length; b++) {
    var block = blocks[b].trim();
    if (!block) continue;
    var lines = block.split('\n');
    // WebVTT metadata blocks. A NOTE may hold anything, an arrow included.
    if (/^(NOTE|STYLE|REGION)\b/.test(lines[0])) continue;
    var at = -1;
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].indexOf('-->') >= 0) { at = i; break; }
    }
    // No timing line. The WEBVTT signature is the one block that is meant to
    // look like this (matched on its own text rather than on being block zero,
    // so a file that opens with blank lines still reads as a header). Anything
    // else is words that will never reach the screen, so it is counted rather
    // than dropped in silence - the whole point of the warnings.
    if (at < 0) {
      if (!/^WEBVTT/.test(block)) malformed++;
      continue;
    }
    var parts = lines[at].split('-->');
    var start = stampToSeconds(parts[0]);
    // Cue settings (line:90%, align:start, …) trail the out-point on the same line.
    var end = stampToSeconds(String(parts[1] == null ? '' : parts[1]).trim().split(/\s+/)[0]);
    if (start === null || end === null) { malformed++; continue; }
    // Lines before the timing are the optional cue id, which carries no meaning
    // once the cues are renumbered on the way out.
    var body = cleanText(lines.slice(at + 1).join(' '));
    // Timed, but nothing left after the tags come out. Counted too: a cue that
    // vanishes is exactly the kind of quiet loss the count exists to surface.
    if (!body) { malformed++; continue; }
    cues.push({ start: start, end: end, text: body });
  }

  if (!cues.length) {
    warnings.push('No timed cues found. Paste SRT or WebVTT text, or transcribe the clip.');
  }
  if (malformed) {
    warnings.push(plural(malformed,
      'block was skipped: it is not a readable cue.',
      'blocks were skipped: they are not readable cues.'));
  }
  var backwards = 0;
  var overlaps = 0;
  var unordered = 0;
  for (var c = 0; c < cues.length; c++) {
    if (cues[c].end <= cues[c].start) backwards++;
    if (c > 0) {
      if (cues[c].start < cues[c - 1].start) unordered++;
      else if (cues[c].start < cues[c - 1].end) overlaps++;
    }
  }
  if (backwards) warnings.push(plural(backwards, 'cue ends before it starts.', 'cues end before they start.'));
  if (unordered) warnings.push(plural(unordered, 'cue starts before the one before it.', 'cues start before the ones before them.'));
  if (overlaps) warnings.push(plural(overlaps, 'cue overlaps the one before it.', 'cues overlap the ones before them.'));
  return { cues: cues, warnings: warnings };
}

/** SubRip: 1-based numbered blocks, comma milliseconds. Empty in, empty out -
 *  never a file holding one lonely newline. */
function toSrt(cues) {
  if (!cues.length) return '';
  var out = [];
  for (var i = 0; i < cues.length; i++) {
    out.push((i + 1) + '\n' + fmtStamp(cues[i].start, ',') + ' --> ' + fmtStamp(cues[i].end, ',') + '\n' + cues[i].text);
  }
  return out.join('\n\n') + '\n';
}

/**
 * WebVTT cue text may not carry a bare `&` or `<` (the grammar reads them as an
 * escape and a tag opener), so both go back out encoded. `decodeEntities` is the
 * exact inverse, so re-importing our own file gives the same text back.
 * SubRip has no such rule and plenty of players print an entity literally, so
 * the .srt sidecar keeps the characters as the author wrote them.
 */
function vttEscape(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

/** WebVTT: header, dot milliseconds, no numbering. */
function toVtt(cues) {
  if (!cues.length) return '';
  var out = [];
  for (var i = 0; i < cues.length; i++) {
    out.push(fmtStamp(cues[i].start, '.') + ' --> ' + fmtStamp(cues[i].end, '.') + '\n' + vttEscape(cues[i].text));
  }
  return 'WEBVTT\n\n' + out.join('\n\n') + '\n';
}

/** Index of the cue on screen at `t`, or -1 during silence. A cue covers
 *  [start, end) - at exactly `end` it has left, the engine's `cueAt` rule.
 *  Where cues overlap the earlier one wins, which is what a player does. */
function cueIndexAt(cues, t) {
  for (var i = 0; i < cues.length; i++) {
    if (t >= cues[i].start && t < cues[i].end) return i;
  }
  return -1;
}
// === /lolly:shared cues ===

/** Greedy wrap to at most `maxLines` rows of words, aiming for even rows. */
function wrapLines(text, maxLines) {
  var words = text.split(' ').filter(Boolean);
  if (maxLines <= 1 || words.length < 2) return [words];
  var per = Math.ceil(text.length / maxLines);
  var rows = [];
  var cur = [];
  var len = 0;
  for (var i = 0; i < words.length; i++) {
    var add = (cur.length ? 1 : 0) + words[i].length;
    if (cur.length && len + add > per && rows.length < maxLines - 1) {
      rows.push(cur);
      cur = [];
      len = 0;
      add = words[i].length;
    }
    cur.push(words[i]);
    len += add;
  }
  if (cur.length) rows.push(cur);
  return rows;
}

/**
 * The cue as rows of words the template prints. For karaoke the cue's duration
 * is shared evenly between its words: an SRT/VTT file times cues, not words, so
 * an even share is the only honest reading of it. A word-timed transcript would
 * deserve better, and that is what the engine's grouper gives the sidecar.
 */
function buildRows(cue, maxLines, karaoke, t) {
  var rows = wrapLines(cue.text, maxLines);
  var total = 0;
  for (var r = 0; r < rows.length; r++) total += rows[r].length;
  var onIdx = -1;
  if (karaoke && total > 0) {
    var span = (cue.end - cue.start) / total;
    onIdx = span > 0 ? Math.floor((t - cue.start) / span) : 0;
    onIdx = Math.round(clamp(onIdx, 0, total - 1));
  }
  var out = [];
  var n = 0;
  for (r = 0; r < rows.length; r++) {
    var words = [];
    for (var i = 0; i < rows[r].length; i++, n++) {
      words.push({
        text: rows[r][i],
        cls: !karaoke ? 'cp-w' : n < onIdx ? 'cp-w is-done' : n === onIdx ? 'cp-w is-on' : 'cp-w is-next',
      });
    }
    out.push({ words: words });
  }
  return out;
}

/** video / audio / image, from the ref's own type first and its URL second. */
function mediaKind(ref) {
  if (!ref || typeof ref !== 'object') return '';
  var type = String(ref.type == null ? '' : ref.type);
  if (type === 'video' || type === 'audio') return type;
  var url = String(ref.url || ref.id || '');
  if (VIDEO_EXT.test(url)) return 'video';
  if (AUDIO_EXT.test(url)) return 'audio';
  return 'image';
}

function mediaName(ref) {
  if (!ref || typeof ref !== 'object') return '';
  var meta = ref.meta && typeof ref.meta === 'object' ? ref.meta : {};
  if (meta.name) return String(meta.name);
  var id = String(ref.id == null ? '' : ref.id);
  return id.split('/').pop() || id;
}

/**
 * A still bar row for the audio panel, seeded off the clip's own id so the same
 * clip always draws the same bars. Explicit fills, never currentColor: the SVG
 * export path clones inline svg with no inherited paint.
 */
function artBars(seed, fill) {
  var s = 2166136261;
  for (var i = 0; i < seed.length; i++) s = ((s ^ seed.charCodeAt(i)) * 16777619) >>> 0;
  var out = '';
  for (var b = 0; b < 32; b++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    var h = 8 + (s % 48);
    out += '<rect x="' + (b * 7.5 + 1).toFixed(1) + '" y="' + ((64 - h) / 2).toFixed(1) +
      '" width="5" height="' + h + '" rx="2.5" fill="' + fill + '"/>';
  }
  return out;
}

// Parsing is the one thing a scrub of the preview slider must not redo: the
// transcript has not changed, only `t`. So the parse gets its own memo, and
// compute() gets a second one over the whole input set.
var _parseKey = null;
var _parseVal = null;

function parseMemo(raw) {
  var key = String(raw == null ? '' : raw);
  if (key === _parseKey) return _parseVal;
  _parseKey = key;
  _parseVal = parseCues(key);
  return _parseVal;
}

var _memoKey = null;
var _memoResult = null;

function compute(args) {
  var key = JSON.stringify(args);
  if (key === _memoKey) return _memoResult;

  var out;
  try {
    var parsed = parseMemo(args.transcript);
    var cues = parsed.cues;
    var style = pick(args.style, STYLES, 'bar');
    var position = pick(args.position, POSITIONS, 'bottom');
    var maxLines = Math.round(clamp(num(args.maxLines, 2), 1, 3));
    var t = Math.max(0, num(args.time, 0));
    var ink = safeColor(args.color, FALLBACK_INK);
    var bg = safeColor(args.background, FALLBACK_BG);
    var kind = mediaKind(args.media);
    var at = cueIndexAt(cues, t);
    var cue = at >= 0 ? cues[at] : null;

    var list = [];
    for (var i = 0; i < cues.length; i++) {
      list.push({
        n: i + 1,
        start: cues[i].start,
        end: cues[i].end,
        text: cues[i].text,
        tc: fmtStamp(cues[i].start, ',') + ' --> ' + fmtStamp(cues[i].end, ','),
        current: i === at,
      });
    }

    out = {
      capStyle: style,
      capPos: position,
      fsPx: Math.round(clamp(num(args.fontSize, 54), 20, 140)),
      inkColor: ink,
      bgColor: bg,
      cues: list,
      cueCount: cues.length,
      currentCue: cue ? cue.text : '',
      currentIndex: at,
      tcStart: cue ? fmtStamp(cue.start, ',') : '',
      tcEnd: cue ? fmtStamp(cue.end, ',') : '',
      cueRows: cue ? buildRows(cue, maxLines, style === 'karaoke', t) : [],
      showCue: Boolean(cue) && args.burnIn !== false,
      showTc: Boolean(cue) && args.burnIn !== false && args.showTimecodes === true,
      srtText: toSrt(cues),
      vttText: toVtt(cues),
      cuesJson: JSON.stringify(cues),
      warningsJson: JSON.stringify(parsed.warnings),
      warnings: parsed.warnings,
      isEmpty: cues.length === 0,
      listHead: cues.length
        ? plural(cues.length, 'cue', 'cues')
        : 'No captions yet. Drop in an .srt or .vtt file, or transcribe the clip where on-device speech is available.',
      hasMedia: kind !== '',
      isVideo: kind === 'video',
      isAudio: kind === 'audio',
      isImage: kind === 'image',
      mediaUrl: args.media && typeof args.media === 'object' ? String(args.media.url || '') : '',
      mediaName: mediaName(args.media),
      artBars: kind === 'audio' ? artBars(mediaName(args.media) || 'lolly', ink) : '',
      capError: '',
    };
  } catch (err) {
    // A patch is always returned, so a bad value shows a note instead of a blank
    // canvas. The sidecars go empty rather than half-written.
    out = {
      capStyle: 'bar', capPos: 'bottom', fsPx: 54,
      inkColor: FALLBACK_INK, bgColor: FALLBACK_BG,
      cues: [], cueCount: 0, currentCue: '', currentIndex: -1,
      tcStart: '', tcEnd: '', cueRows: [], showCue: false, showTc: false,
      srtText: '', vttText: '', cuesJson: '[]', warningsJson: '[]', warnings: [],
      isEmpty: true, listHead: 'No captions yet.',
      hasMedia: false, isVideo: false, isAudio: false, isImage: false,
      mediaUrl: '', mediaName: '', artBars: '',
      capError: (err && err.message) ? String(err.message) : 'Could not read the transcript',
    };
  }

  _memoKey = key;
  _memoResult = out;
  return out;
}

function argsOf(model) {
  var o = {};
  for (var i = 0; i < model.length; i++) o[model[i].id] = model[i].value;
  return o;
}

function onInit({ model }) { return compute(argsOf(model)); }

function onInput({ model }) { return compute(argsOf(model)); }
