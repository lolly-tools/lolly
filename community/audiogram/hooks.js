/* global host */
/**
 * Audiogram hooks - turn the chosen clip into a per-frame animation track.
 *
 * The division of labour with template.html is deliberate:
 *
 *   hooks.js (here)  decides WHAT the animation knows - it calls host.audio to
 *                    analyse the clip (all of it, from the in-point to the end,
 *                    at an fps that adapts to its length), derives the brand
 *                    colour ramp from host.color, and hands both to the template
 *                    as a compact packed payload.
 *   template.html    decides how it MOVES - a canvas draw function per style,
 *                    reading that payload. No fetching, no decoding, no colour
 *                    science, and (importantly) no async work during a repaint.
 *
 * The STILL is neither: it is drawn here, as SVG, from the same packed bytes (see
 * stillSvg below). The canvas covers it only while it is painting motion, so a
 * script-less render, a reduced-motion viewer and a docs screenshot all get real
 * vector geometry instead of a snapshot of an animation mid-stride.
 *
 * Why the payload is packed bytes rather than JSON: a frame track is `count ×
 * bands` numbers, so an 8-second clip at 30fps over 48 bands is 11,520 values.
 * As JSON that is ~80 KB of text re-parsed on every keystroke and embedded in
 * every exported HTML file; quantised to bytes and base64'd it is ~15 KB. The
 * values are all normalised 0..1 already, so a byte is the honest precision - a
 * bar's height is being drawn into a pixel grid, not integrated.
 *
 * Everything the template needs travels IN the payload, which is what makes an
 * exported `html` render animate on its own and a headless CLI render draw the
 * same frames as the browser.
 */

/** Analysis frames per second at full rate. Matches the export's default fps, so one
 *  analysis frame is one video frame and nothing interpolates. Long clips scale this
 *  down - see MAX_FRAMES. */
const FPS = 30;

/**
 * Frame budget for the whole animation track - the knob that lets the window follow
 * the clip instead of stopping at 8 seconds. The analysis fps adapts so the frame
 * count stays near this budget: full 30fps up to 2 minutes, then coarser.
 *
 *   fps = clamp(floor(MAX_FRAMES / seconds), FPS_MIN, FPS)
 *
 * What that costs, per second of clip (raw bytes; base64 adds 4/3):
 *
 *   spectrum + scalars (6 + 48 B/frame):  ~1.6 KB/s at 30fps   ~0.32 KB/s at 6fps
 *   scope rows        (1024 B/frame):     ~30 KB/s  at 30fps   ~6 KB/s    at 6fps
 *   vizWave           (1024 B/frame):     ~30 KB/s  at 30fps   ~6 KB/s    at 6fps
 *
 * So the spectrum track lands near MAX_FRAMES × 54 B ≈ 190 KB worst case, and the
 * sample-window styles (scope, milkdrop) near MAX_FRAMES × 1 KB ≈ 3.7 MB - bounded
 * by the budget, not by the clip. Past 10 minutes the fps floor holds at FPS_MIN and
 * the payload grows linearly again, which still works; it is just coarser and
 * heavier, which is why the audio input's help says so.
 */
const MAX_FRAMES = 3600;

/** The fps floor. Below ~6fps the animation stops reading as animation. */
const FPS_MIN = 6;

/** The analysis fps for a clip of `sec` seconds - full rate up to the budget, then
 *  scaled down, never below the floor. Integer, so the maths stays stable. */
function adaptFps(sec) {
  if (!(sec > 0)) return FPS;
  return Math.max(FPS_MIN, Math.min(FPS, Math.floor(MAX_FRAMES / sec)));
}

/** Spectrum bands. 48 log-spaced bands is more bars than any of these styles draws
 *  at once, so styles subsample rather than ask for a second analysis. */
const BANDS = 48;

/** Overview waveform columns - the `wave` style's envelope. */
const BUCKETS = 160;

/**
 * Oscilloscope window length, in samples. This is a TIME window, not a resolution:
 * 1024 samples is ~23ms, which is two or three cycles of a bass note, and that is
 * what makes a scope look like a scope. 256 was tried first on the reasoning that a
 * polyline across 1080 pixels cannot show more detail than that - true, but it
 * covers only 5.8ms, less than one cycle of a 110Hz bass line, so it rendered as a
 * lazy sine wobble instead of a waveform.
 *
 * Requested ONLY for this style, because it is by far the largest thing the payload
 * can carry (~250 KB of sample bytes for an 8-second clip). Every other style stays
 * on the ~15 KB spectrum track.
 */
const SCOPE = 1024;

/**
 * Time-domain window length for the MilkDrop style, in samples.
 *
 * NOT a free choice: butterchurn's AudioProcessor allocates its arrays at
 * `numSamps * 2 = 1024` and `updateAudio` copies into them with a bare `.set()`. A
 * longer window throws RangeError inside the renderer (which stands the visualizer
 * down for the session, silently, over a black canvas); a shorter one leaves the tail
 * of the previous frame in place and reads as a stuck bass note.
 */
const VIZ_SAMPLES = 1024;

/** Seconds the PLACEHOLDER track covers (and the manifest's default export length).
 *  Real audio is always analysed to the end of the clip - the animation matches the
 *  duration of the selected audio by construction. */
const PLACEHOLDER_SEC = 8;

/**
 * Deterministic speech-like placeholder, so the tool (and its gallery examples)
 * renders as something recognisable with no audio chosen. Seeded - identical on
 * every run, which matters because a gallery thumbnail that changed every rebuild
 * would show up as churn in every preview diff.
 */
function synthTrack(count, bands) {
  let s = 1337;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const rms = new Array(count);
  const mag = new Array(count * bands);
  let env = 0.2;
  for (let i = 0; i < count; i++) {
    // Bursts and decay - the shape of speech rather than of noise.
    if (rnd() < 0.06) env = 0.35 + rnd() * 0.65;
    else env = env * 0.93 + rnd() * 0.05;
    rms[i] = Math.min(1, 0.1 + env * 0.9);
    for (let b = 0; b < bands; b++) {
      // Energy falls away with frequency, with a little life on top.
      const tilt = Math.pow(1 - b / bands, 1.7);
      mag[i * bands + b] = Math.min(1, rms[i] * tilt * (0.75 + rnd() * 0.5));
    }
  }
  return { rms, mag };
}

/**
 * Cue grouping - a tiny mirror of the engine's `groupWordsToCues`
 * (engine/src/captions.ts), same defaults: 42 chars, 5 s on screen, a 0.6 s
 * silence starts a new cue, sentence punctuation closes the cue after its word.
 * Tools are data and may not import the engine, so the reference implementation
 * is mirrored here - a caption grouped by the web shell and one grouped here
 * must break at the same words, so change BOTH or neither
 * (tests/audiogram-captions.test.ts pins them against each other).
 */
const CUE_CHARS = 42;
const CUE_SEC = 5;
const CUE_GAP = 0.6;
const SENTENCE_END = /[.!?…][)\]"'”’]*$/;

/** Word timings ({text,start,end} seconds) → cues ({t0,t1,text}), greedily. */
function groupCues(words) {
  const cues = [];
  let open = null;
  for (const w of words) {
    const text = String(w.text || '').trim();
    if (!text) continue;
    if (open) {
      const joined = `${open.text} ${text}`;
      const overflow = joined.length > CUE_CHARS || w.end - open.t0 > CUE_SEC;
      const paused = w.start - open.t1 >= CUE_GAP;
      if (overflow || paused) {
        cues.push(open);
        open = null;
      } else {
        open.text = joined;
        open.t1 = w.end;
      }
    }
    if (!open) open = { t0: w.start, t1: w.end, text };
    // Sentence punctuation closes the cue AFTER the word that carries it.
    if (SENTENCE_END.test(text)) {
      cues.push(open);
      open = null;
    }
  }
  if (open) cues.push(open);
  return cues;
}

/**
 * SRT / WebVTT parsing and serialising, shared with the captions tool so the two
 * read the same files and write the same bytes. Used for the OTHER caption
 * source: a clip with no word timings of its own, plus a transcript the shell's
 * Transcribe button (or the user's own .srt file) put in the `transcript` input.
 */
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

/** Greedy split into pieces of at most `limit` characters, on word boundaries. */
function splitText(text, limit) {
  const words = text.split(' ');
  const out = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (line && next.length > limit) { out.push(line); line = w; }
    else line = next;
  }
  if (line) out.push(line);
  return out.length ? out : [text];
}

/**
 * A pasted or transcribed transcript as the {t0,t1,text} cues the template draws,
 * seconds relative to the analysed window. Cue times in the file are clip-absolute,
 * so the in-point is subtracted and anything already finished before it is dropped -
 * the same shift the word-timing path applies.
 *
 * The caption layer wraps to at most two lines and CUE_CHARS is what one line holds,
 * so a cue longer than two lines is split at word boundaries into pieces that share
 * its duration in proportion to their length. A transcript written by the shell's
 * Transcribe button is grouped to the same ceiling already and passes through whole.
 */
function transcriptCues(raw, startSec) {
  const LIMIT = CUE_CHARS * 2;
  const out = [];
  for (const c of parseCues(raw).cues) {
    const t1 = c.end - startSec;
    if (t1 <= 0) continue;
    const t0 = Math.max(0, c.start - startSec);
    if (t1 <= t0) continue;   // a backwards cue would draw for no time at all
    const parts = c.text.length > LIMIT ? splitText(c.text, LIMIT) : [c.text];
    const chars = parts.reduce((n, part) => n + part.length, 0) || 1;
    let at = t0;
    for (let i = 0; i < parts.length; i++) {
      const span = (t1 - t0) * (parts[i].length / chars);
      out.push({ t0: at, t1: i === parts.length - 1 ? t1 : at + span, text: parts[i] });
      at += span;
    }
  }
  return out;
}

/** The drawn cues in the shape the two serialisers take. */
function cueFiles(cues) {
  return cues.map((c) => ({ start: c.t0, end: c.t1, text: c.text }));
}

/** 0..1 → one byte. Values outside the range are clamped rather than wrapped. */
function byte(v) {
  const n = Math.round((Number.isFinite(v) ? v : 0) * 255);
  return n < 0 ? 0 : n > 255 ? 255 : n;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Base64 a byte array. Hand-rolled rather than reaching for `btoa`: hooks run in
 * whatever realm the shell gives them (a browser window, a Node context under the
 * CLI), and this is 12 lines against having to reason about which globals exist
 * where.
 */
function b64(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const n = (a << 16) | (b << 8) | c;
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    out += i + 1 < bytes.length ? B64[(n >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? B64[n & 63] : '=';
  }
  return out;
}

/**
 * The brand colour ramp the gradient-ish styles paint with.
 *
 * `host.color.ramp` interpolates in OKLab, so a two-stop accent → light ramp stays
 * in the accent's own hue family instead of wandering through whatever sits between
 * two hex codes in sRGB. Feature-detected: an older shell (or the CLI without
 * host.color) just gets the flat accent repeated, which every style handles.
 */
function ramp(host, accent, n) {
  const flat = new Array(n).fill(accent);
  if (!host.color || typeof host.color.ramp !== 'function') return flat;
  try {
    // Toward the accent's own lighter end rather than toward white: a ramp that
    // reaches #fff washes the top of every bar out to paper on a light background.
    const lift = host.color.mix ? host.color.mix(accent, '#ffffff', 0.55) : '#ffffff';
    const out = host.color.ramp([accent, lift || '#ffffff'], n, { correctLightness: true });
    return Array.isArray(out) && out.length === n ? out : flat;
  } catch {
    return flat;
  }
}

/**
 * The length of audio the last analysis actually covered, in seconds.
 *
 * Module-level because `beforeExport` needs it and hooks share one module instance per
 * mount (the same pattern gradient uses for its palette). Seeded with the
 * placeholder length so an export that somehow precedes an analysis still gets the
 * manifest's own default.
 */
let _analysedSec = PLACEHOLDER_SEC;

/**
 * Analyse the clip (from the in-point to its end) and pack it for the template.
 *
 * Returns the extras the template reads. Called from both onInit and onInput
 * because every input that changes what is analysed (the clip, the in-point, and
 * - via the scope window - the style) has to re-derive it. The web shell's
 * host.audio caches by source + options, so the common case of typing a title
 * re-requests an analysis that is already in hand.
 */
async function build(ctx) {
  // ctx.model is an ARRAY of input items, not a value map.
  const v = Object.fromEntries((ctx.model || []).map((i) => [i.id, i.value]));
  // The bridge arrives on the context; the injected `host` global is the fallback
  // for a shell that predates it. Named `h` because `const host = … host …` would
  // reference the binding inside its own initializer.
  const h = ctx.host || (typeof host !== 'undefined' ? host : null);
  if (!h) return {};
  const style = v.style || 'bars';
  const accent = v.accent || '#5b8def';
  const start = Math.max(0, Number(v.start) || 0);
  /**
   * The MilkDrop style is progressive enhancement, decided HERE rather than in the
   * template: only a shell with `host.viz` can run a visualizer at all, and the
   * decision has to be made before the analysis so we don't carry a quarter of a
   * megabyte of sample windows in a payload nothing will read. Everywhere else - a
   * CLI render, a browser without WebGL2, an exported html file - the card falls
   * through to the `bars` draw, which needs no extra data.
   */
  const wantViz = style === 'milkdrop' && !!h.viz && h.viz.isAvailable();
  const wantScope = style === 'scope';
  const wantSamples = wantScope || wantViz;

  const colors = ramp(h, accent, 6);
  const meta = {
    fps: FPS, bands: BANDS, buckets: BUCKETS, scope: 0,
    count: 0, bpm: null, dur: PLACEHOLDER_SEC, start, real: false,
  };

  let packed = '';
  // The packed payload before base64, kept so the still can be drawn from exactly
  // the bytes the canvas will unpack rather than from the float analysis.
  let rawBytes = null;
  let beats = [];
  let cues = [];
  // The visualizer's payload, kept OUT of agData: the shell decodes these windows
  // straight into butterchurn, and agData's section layout is a contract with the
  // template's own unpack(). One reader each beats making both agree on one buffer.
  let vizWave = '';
  let vizMeta = null;

  const src = v.audio;
  if (src && h.audio && h.audio.isAvailable()) {
    try {
      // The whole remaining clip is analysed: `window` is OMITTED, which the
      // host.audio contract defines as "to the end of the source". The fps adapts
      // to the clip length (see MAX_FRAMES) - so the fps has to be guessed BEFORE
      // the analysis. Uploaded and generated audio assets carry meta.durationMs,
      // which makes the guess exact in the common case; without it, guess full
      // rate and re-analyse below only if that turns out badly wrong.
      const hintMs = src && src.meta && Number(src.meta.durationMs);
      const hintSec = hintMs > 0 ? Math.max(0.5, hintMs / 1000 - start) : 0;
      const opts = (fps) => ({
        fps,
        bands: BANDS,
        buckets: BUCKETS,
        start,
        ...(wantSamples ? { samples: wantViz ? VIZ_SAMPLES : SCOPE } : {}),
      });
      let a = await h.audio.analyse(src, opts(hintSec ? adaptFps(hintSec) : FPS));
      // The analysis reports the span it actually covered - that is the truth the
      // guess is checked against. Re-analyse only when the guess was off by more
      // than 2x (a missing durationMs on a long clip): a second decode is real
      // work, and a track within 2x of budget draws fine.
      const ideal = adaptFps(a.window);
      if (ideal * 2 <= a.fps || ideal >= a.fps * 2) a = await h.audio.analyse(src, opts(ideal));
      const fps = a.fps;
      const f = a.frames;
      const scopeLen = f.samples;
      // Section order is the contract with the template's unpack(): the six
      // per-frame scalars, then the spectrum rows, then the overview, then the
      // scope rows. Any change here changes there.
      const size = f.count * 6 + f.count * BANDS + BUCKETS + (wantScope ? f.count * scopeLen : 0);
      const bytes = new Uint8Array(size);
      let at = 0;
      for (const track of [f.rms, f.peak, f.bass, f.mid, f.treb, f.flux]) {
        for (let i = 0; i < f.count; i++) bytes[at++] = byte(track[i]);
      }
      for (let i = 0; i < f.count * BANDS; i++) bytes[at++] = byte(f.magnitude[i]);
      for (let i = 0; i < BUCKETS; i++) bytes[at++] = byte(a.peaks[i]);
      if (wantScope) {
        // Already 0..255 centred on 128 - copy, do not re-quantise.
        for (let i = 0; i < f.count * scopeLen; i++) bytes[at++] = f.wave[i];
      }
      packed = b64(bytes);
      rawBytes = bytes;
      meta.count = f.count;
      meta.scope = wantScope ? scopeLen : 0;
      meta.bpm = a.bpm;
      meta.fps = fps;
      meta.dur = a.window || PLACEHOLDER_SEC;
      // beforeExport reads this to make the video as long as the audio it draws.
      _analysedSec = meta.dur;
      meta.real = true;
      if (wantViz) {
        vizWave = b64(f.wave.subarray(0, f.count * scopeLen));
        vizMeta = { count: f.count, samples: scopeLen, fps, poster: loudest(f.rms, f.count) };
      }
      // Beat FRAME indices, not seconds: the draw loop already works in frames, and
      // an index is one byte-ish of payload against a float's worth of text. Mapped
      // at the fps this analysis actually ran at, not the full-rate constant.
      if (v.beat !== false && a.bpm !== null) {
        beats = Array.from(a.beats).map((t) => Math.round(t * fps)).filter((i) => i >= 0 && i < f.count);
      }
      /**
       * Captions - only when the clip carries its own word timings, which a
       * Script-audio asset does (meta.tts.words, exact by construction from the
       * synthesis). Nothing is transcribed here: no timings, no captions. The
       * timings are clip-absolute and the analysis runs from the in-point, so
       * words are shifted onto the analysed window first and words already
       * finished before it are dropped.
       */
      const tts = v.captions !== false && src && src.meta && src.meta.tts;
      const words = tts && Array.isArray(tts.words) ? tts.words : null;
      if (words) {
        cues = groupCues(
          words
            .filter((w) => Number(w.end) > start)
            .map((w) => ({ text: w.text, start: Math.max(0, Number(w.start) - start), end: Number(w.end) - start })),
        );
      }
    } catch (err) {
      // An undecodable clip is a normal outcome, not a bug: codec support genuinely
      // differs between browsers, and Node has almost none. Say so once and fall
      // through to the placeholder so the card still renders.
      h.log('info', 'audiogram: could not analyse the audio, drawing a placeholder', {
        error: err && err.message ? err.message : String(err),
      });
    }
  }

  /**
   * The other caption source. Word timings win when the clip has them (a Script-audio
   * asset), so scripted audio is untouched by this; anything else falls back to the
   * `transcript` input - filled by the shell's Transcribe button (render.transcribe),
   * by dropping in an .srt/.vtt file, or by hand. Still nothing is transcribed HERE:
   * the hook only reads text that is already in the model.
   */
  if (!cues.length && v.captions !== false && String(v.transcript || '').trim()) {
    cues = transcriptCues(v.transcript, start);
  }

  if (!meta.real) {
    const count = FPS * PLACEHOLDER_SEC;
    const { rms, mag } = synthTrack(count, BANDS);
    const bytes = new Uint8Array(count * 6 + count * BANDS + BUCKETS);
    let at = 0;
    // The placeholder has no real peak/band split, so every scalar track gets the
    // envelope. Styles that read `bass` still animate; they just do not disagree
    // with the bars above them.
    for (let t = 0; t < 6; t++) for (let i = 0; i < count; i++) bytes[at++] = byte(rms[i]);
    for (let i = 0; i < count * BANDS; i++) bytes[at++] = byte(mag[i]);
    // Keep the overview the placeholder writes, so the still below draws the SAME
    // envelope the canvas animates rather than nothing at all.
    for (let i = 0; i < BUCKETS; i++) {
      bytes[at++] = byte(rms[Math.min(count - 1, Math.floor((i / BUCKETS) * count))]);
    }
    packed = b64(bytes);
    rawBytes = bytes;
    meta.count = count;
  }

  // Attribution is only emitted for a preset the shell CONFIRMS it has: an artist
  // preset whose pack isn't staged falls back to a brand-native one, and a credit line
  // naming an artist whose work is not on screen would be worse than none.
  let vizPreset = '';
  let credit = '';
  if (wantViz && vizMeta) {
    try {
      const presets = await h.viz.presets();
      const found = presets.find((p) => p.id === v.vizLook) || presets[0];
      if (found) {
        vizPreset = found.id;
        if (v.credit !== false && found.author && found.author !== 'Lolly') {
          credit = `${found.name} \u00b7 a MilkDrop preset by ${found.author}`;
        }
      }
    } catch {
      vizPreset = '';
    }
  }

  return {
    agData: packed,
    agMeta: JSON.stringify(meta),
    agColors: colors.join(' '),
    agBeats: beats.join(' '),
    // A human-readable line for the a11y label and the no-script fallback, so the
    // card says something true about the audio even where nothing can animate.
    agSummary: meta.real
      ? (meta.bpm ? `${Math.round(meta.bpm)} BPM` : 'waveform')
      : 'placeholder waveform',
    // Subtitle cues as their own small JSON extra rather than a section of the
    // packed payload: agData's section layout is a byte contract with the
    // template's unpack(), and a handful of short strings is not worth touching
    // it for. Empty (and the template's caption markup absent) for any clip
    // without word timings.
    agCues: cues.length ? JSON.stringify(cues) : '',
    // The .srt / .vtt sidecars (template.srt / template.vtt): exactly the cues on
    // screen, so the subtitle file and the exported video agree by construction -
    // both are window-relative, both start at the in-point.
    agSrt: toSrt(cueFiles(cues)),
    agVtt: toVtt(cueFiles(cues)),
    // The still (see template.html): the poster frame of the chosen style as real
    // SVG, drawn from the packed bytes above. It is the base layer of the card -
    // what a script-less render, a reduced-motion viewer and the moment before the
    // preview loop starts all show - and the canvas paints motion over it.
    agStill: stillSvg(rawBytes, meta, style, colors, accent, beats),
    // The MilkDrop half. All four are empty unless the visualizer will actually run,
    // and the template keys its placeholder off agVizPreset - so every other shell
    // renders the ordinary `bars` card with no dead markup and no dead payload.
    agVizPreset: vizPreset,
    agVizMeta: vizPreset ? JSON.stringify(vizMeta) : '',
    agWave: vizPreset ? vizWave : '',
    // Seeds the visualizer's palette. The background goes in alongside the ramp so the
    // field falls off to the card's own dark end rather than to a neutral the brand
    // never chose; the accent leads, so it stays the colour the image is about.
    agVizColors: vizPreset ? [accent, v.bg || '#101828'].concat(colors).join(' ') : '',
    // The bed's analysed length in ms, stamped on the stage as data-clip-ms so the
    // export bar's Duration field shows the length beforeExport will run to (empty
    // while the placeholder wave stands in for real audio).
    agClipMs: meta.real && meta.dur > 0.5 ? Math.round(meta.dur * 1000) : '',
    agCredit: credit,
  };
}

/** The loudest frame in the middle 80% of the window - the poster frame. Clips open on
 *  silence often enough that frame 0 is the wrong still to freeze. */
function loudest(rms, count) {
  const lo = Math.floor(count * 0.1);
  const hi = Math.ceil(count * 0.9);
  let best = lo;
  let bv = -1;
  for (let i = lo; i < hi && i < count; i++) if (rms[i] > bv) { bv = rms[i]; best = i; }
  return best;
}

/* ── The still ───────────────────────────────────────────────────────────────
 *
 * The card's STILL is real SVG: the poster frame of the chosen style drawn as
 * rects, paths and circles rather than as pixels in a canvas. The canvas keeps
 * the MOTION (the live preview loop and every video frame) - see template.html,
 * which reveals it only while it is painting.
 *
 * The geometry is built from the SAME packed bytes the canvas unpacks, with the
 * same helpers (at / band / kick / posterFrame) and the same constants, so the
 * two agree by construction instead of by two sets of maths staying in step.
 * Read one, change both; tests/audiogram-still-svg.test.ts decodes agData itself
 * and compares the emitted rects against it.
 *
 * Why it was a canvas at all: nothing here needs pixels. plans/69 section 16
 * called the audiogram raster "by implementation, not necessity", and the docs
 * screenshots proved it - they shipped the analysis as an embedded bitmap that
 * changed on every capture because the preview loop was mid-animation.
 */

/** The still's own coordinate space. Square, because the card is not: the SVG is
 *  fitted to the wavebox at render time and the fit is what carries the aspect. */
const STILL_W = 1000;
const STILL_H = 1000;

/**
 * Styles whose geometry is a fraction of the width and a fraction of the height,
 * independently - bars across the box, heights up from a baseline. Stretching the
 * viewBox to the wavebox ("none") is exactly what the canvas does for these.
 *
 * The rest (ring, blob) size from min(W,H) and centre on the box, which is what
 * "xMidYMid meet" is. `dots` is the one compromise: its grid stretches like a bar
 * chart but its dot radius is min(cell width, cell height), so on a non-square
 * card the still's dots come out slightly oval where the canvas keeps them round.
 * Expressing both at once needs the box size, which a hook does not have.
 */
const STILL_STRETCH = { bars: 1, mirror: 1, spectrum: 1, wave: 1, scope: 1, ridge: 1, dots: 1 };

/** One COORDINATE, one decimal, no trailing ".0" - the still is re-emitted on
 *  every repaint, so in a 1000-unit box the digits nobody can see are worth
 *  leaving out. Not for opacity: see op(). */
function fmt(v) {
  const n = Math.round((Number.isFinite(v) ? v : 0) * 10) / 10;
  return String(n);
}

/** One OPACITY. fmt's 0.1 step is a tenth of a pixel in the coordinate space and
 *  a tenth of the WHOLE range here, which turned ridge's 18-row fade into eight
 *  visible bands where the canvas draws a smooth ramp. */
function op(v) {
  const n = Math.round((Number.isFinite(v) ? v : 0) * 1000) / 1000;
  return String(n);
}

/**
 * A colour value safe to write into an SVG attribute. The still is rendered raw
 * ({{{agStill}}}), and `accent` / `ink` / `bg` are user input, so every colour
 * goes through the shared whitelist below - hex, a bare keyword, an rgb/hsl
 * function, or a brand var() - and anything else falls back. A blacklist was
 * tried first and is the wrong instrument: stripping the quotes out of
 * `#f00" onload="…` leaves a fill value with the word `onload` still in it,
 * which is only harmless by luck.
 */
function col(c) { return safeColor(c, '#5b8def'); }

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

/**
 * Short stable id salt, so two audiograms composed into one document (print-sheet,
 * host.compose) cannot share a gradient or clip-path id. djb2, base 36.
 *
 * The PAYLOAD is folded in as well as the string, because style and brand accent
 * are exactly what two cards in one document do share - two episodes of the same
 * podcast collide on every text input there is. The wave style's clip path is the
 * playhead, so a collision put the first card's progress on the second card.
 */
function salt(s, bytes) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  for (let i = 0; bytes && i < bytes.length; i++) h = ((h * 33) ^ bytes[i]) >>> 0;
  return h.toString(36);
}

/**
 * The poster frame as an SVG element, or '' when there is nothing to draw.
 *
 * `raw` is the packed payload in the section order build() writes and the template
 * unpacks: rms, peak, bass, mid, treb, flux (COUNT bytes each), then the spectrum
 * rows (COUNT x BANDS), the overview (BUCKETS), and the scope rows when present.
 */
function stillSvg(raw, meta, style, colors, accent, beatFrames) {
  const COUNT = meta.count | 0;
  const SCOPE_N = meta.scope | 0;
  const need = COUNT * 6 + COUNT * BANDS + BUCKETS + COUNT * SCOPE_N;
  if (!raw || !COUNT || raw.length < need) return '';

  let off = 0;
  const take = (n) => { const s = raw.subarray(off, off + n); off += n; return s; };
  const RMS = take(COUNT);
  take(COUNT);                                  // peak
  const BASS = take(COUNT);
  take(COUNT); take(COUNT); take(COUNT);        // mid, treb, flux
  const MAG = take(COUNT * BANDS);
  const OVER = take(BUCKETS);
  const WAVE = SCOPE_N ? take(COUNT * SCOPE_N) : null;

  const W = STILL_W;
  const H = STILL_H;
  const COLORS = colors && colors.length ? colors : [accent];
  const BEATS = {};
  for (const b of beatFrames || []) BEATS[b | 0] = 1;

  const at = (track, i) => track[i < 0 ? 0 : i >= COUNT ? COUNT - 1 : i] / 255;
  const band = (fr, b, n) => {
    const lo = Math.floor((b / n) * BANDS);
    const hi = Math.max(lo + 1, Math.floor(((b + 1) / n) * BANDS));
    let m = 0;
    for (let i = lo; i < hi && i < BANDS; i++) { const v = MAG[fr * BANDS + i]; if (v > m) m = v; }
    return m / 255;
  };
  const kick = (fr) => {
    for (let d = 0; d < 5; d++) if (BEATS[fr - d]) return (1 - d / 5) * 0.35;
    return 0;
  };

  const f = loudest(RMS, COUNT);
  const p = (f + 0.5) / COUNT;
  const k = kick(f);

  const defs = [];
  const uid = 'ags' + salt(style + '|' + accent + '|' + COLORS.join(','), raw);
  let seq = 0;
  const grad = (x0, y0, x1, y1) => {
    const id = uid + (seq++);
    let stops = '';
    for (let i = 0; i < COLORS.length; i++) {
      stops += `<stop offset="${fmt((i / Math.max(1, COLORS.length - 1)) * 100)}%" stop-color="${col(COLORS[i])}"/>`;
    }
    defs.push(`<linearGradient id="${id}" gradientUnits="userSpaceOnUse"`
      + ` x1="${fmt(x0)}" y1="${fmt(y0)}" x2="${fmt(x1)}" y2="${fmt(y1)}">${stops}</linearGradient>`);
    return `url(#${id})`;
  };
  const rect = (x, y, w, h, r, opacity) =>
    `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(w)}" height="${fmt(h)}"`
    + (r ? ` rx="${fmt(r)}" ry="${fmt(r)}"` : '')
    + (opacity == null ? '' : ` fill-opacity="${opacity}"`) + '/>';

  const drawBars = (mirror) => {
    const N = 40;
    const slot = W / N;
    const gap = slot * 0.42;
    const bw = slot - gap;
    let s = `<g fill="${grad(0, H, 0, 0)}">`;
    for (let i = 0; i < N; i++) {
      const v = Math.min(1, band(f, i, N) * (1 + k));
      const h = Math.max(H * 0.015, v * H * (mirror ? 0.46 : 0.9));
      const x = i * slot + gap / 2;
      if (mirror) {
        s += rect(x, H / 2 - h, bw, h, bw / 2, null);
        // Faint below the centre line, so it reads as a baseline and not as an
        // axis of symmetry - the canvas's globalAlpha 0.45.
        s += rect(x, H / 2, bw, h, bw / 2, 0.45);
      } else {
        s += rect(x, (H - h) / 2, bw, h, bw / 2, null);
      }
    }
    return `${s}</g>`;
  };

  const drawSpectrum = () => {
    const N = BANDS;
    const slot = W / N;
    let d = `M0 ${H}`;
    for (let i = 0; i < N; i++) {
      const y = H - Math.max(2, Math.min(1, band(f, i, N) * (1 + k)) * H * 0.92);
      d += `L${fmt(i * slot)} ${fmt(y)}L${fmt((i + 1) * slot)} ${fmt(y)}`;
    }
    return `<path d="${d}L${W} ${H}Z" fill="${grad(0, H, 0, H * 0.1)}"/>`;
  };

  const wavePath = () => {
    const mid = H / 2;
    const step = W / Math.max(1, BUCKETS - 1);
    let d = `M0 ${fmt(mid - (OVER[0] / 255) * H * 0.42)}`;
    for (let q = 1; q < BUCKETS; q++) d += `L${fmt(q * step)} ${fmt(mid - (OVER[q] / 255) * H * 0.42)}`;
    for (let r = BUCKETS - 1; r >= 0; r--) d += `L${fmt(r * step)} ${fmt(mid + (OVER[r] / 255) * H * 0.42)}`;
    return `${d}Z`;
  };

  const drawWave = () => {
    const d = wavePath();
    const clip = `${uid}c`;
    defs.push(`<clipPath id="${clip}"><rect x="0" y="0" width="${fmt(W * p)}" height="${H}"/></clipPath>`);
    const head = Math.max(0, W * p - Math.max(1, W * 0.002));
    return `<path d="${d}" fill="${col(accent)}" fill-opacity="0.38"/>`
      + `<path d="${d}" fill="${grad(0, H, 0, 0)}" clip-path="url(#${clip})"/>`
      + `<rect x="${fmt(head)}" y="${fmt(H * 0.06)}" width="${fmt(Math.max(2, W * 0.004))}"`
      + ` height="${fmt(H * 0.88)}" fill="${col(COLORS[COLORS.length - 1] || accent)}" fill-opacity="0.85"/>`;
  };

  const drawScope = () => {
    if (!WAVE) return drawWave();
    const mid = H / 2;
    const step = W / (SCOPE_N - 1);
    const base = f * SCOPE_N;
    let d = '';
    for (let i = 0; i < SCOPE_N; i++) {
      const y = mid - ((WAVE[base + i] - 128) / 128) * H * 0.44;
      d += `${i ? 'L' : 'M'}${fmt(i * step)} ${fmt(y)}`;
    }
    return `<path d="${d}" fill="none" stroke="${grad(0, 0, W, 0)}"`
      + ` stroke-width="${fmt(Math.max(2, H * 0.012))}" stroke-linejoin="round"/>`;
  };

  const drawRing = () => {
    const N = 72;
    const cx = W / 2;
    const cy = H / 2;
    const R = Math.min(W, H) * 0.27;
    let d = '';
    for (let i = 0; i < N; i++) {
      const a = (i / N) * 2 * Math.PI - Math.PI / 2;
      const v = Math.min(1, band(f, i, N) * (1 + k));
      const len = Math.min(W, H) * (0.03 + v * 0.19);
      d += `M${fmt(cx + Math.cos(a) * R)} ${fmt(cy + Math.sin(a) * R)}`
        + `L${fmt(cx + Math.cos(a) * (R + len))} ${fmt(cy + Math.sin(a) * (R + len))}`;
    }
    return `<path d="${d}" fill="none" stroke="${grad(0, cy - R, 0, cy + R)}"`
      + ` stroke-width="${fmt(Math.max(2, ((2 * Math.PI * R) / N) * 0.45))}" stroke-linecap="round"/>`
      + `<circle cx="${cx}" cy="${cy}" r="${fmt(R * (0.8 + at(RMS, f) * 0.08 + k * 0.1))}"`
      + ` fill="none" stroke="${col(accent)}" stroke-opacity="0.35" stroke-width="${fmt(Math.max(2, R * 0.02))}"/>`;
  };

  const drawBlob = () => {
    const N = 160;
    const cx = W / 2;
    const cy = H / 2;
    const R = Math.min(W, H) * (0.19 + at(BASS, f) * 0.09 + k * 0.05);
    const HARM = [[2, 0.13, 0.0], [3, 0.10, 1.1], [5, 0.07, 2.3], [7, 0.05, 0.6], [11, 0.03, 1.9]];
    let d = '';
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * 2 * Math.PI - Math.PI / 2;
      let r = 1;
      for (let hi = 0; hi < HARM.length; hi++) {
        r += band(f, hi, HARM.length) * HARM[hi][1] * Math.sin(HARM[hi][0] * a + HARM[hi][2]);
      }
      d += `${i ? 'L' : 'M'}${fmt(cx + Math.cos(a) * R * r)} ${fmt(cy + Math.sin(a) * R * r)}`;
    }
    return `<path d="${d}Z" fill="${grad(0, cy - R, 0, cy + R)}"/>`;
  };

  const drawRidge = () => {
    const ROWS = 18;
    const N = 34;
    let s = '';
    for (let r = ROWS - 1; r >= 0; r--) {
      const src = f - r * 2;
      if (src < 0) continue;
      const depth = r / ROWS;
      const y = H * (0.92 - depth * 0.72);
      const amp = H * 0.16 * (1 - depth * 0.55);
      let d = `M0 ${fmt(y)}`;
      for (let i = 0; i < N; i++) {
        const v = Math.min(1, band(src, i, N) * (1 + (r === 0 ? k : 0)));
        d += `L${fmt((i / (N - 1)) * W)} ${fmt(y - v * amp)}`;
      }
      const fill = COLORS[Math.min(COLORS.length - 1, Math.round(depth * (COLORS.length - 1)))];
      s += `<path d="${d}L${W} ${fmt(y)}Z" fill="${col(fill)}" fill-opacity="${op(0.9 - depth * 0.75)}"/>`;
    }
    return s;
  };

  const drawDots = () => {
    const COLS = 24;
    const ROWS = 12;
    const cw = W / COLS;
    const ch = H / ROWS;
    const rad = Math.min(cw, ch) * 0.28;
    let s = '';
    for (let c = 0; c < COLS; c++) {
      const lit = Math.min(1, band(f, c, COLS) * (1 + k)) * ROWS;
      for (let r = 0; r < ROWS; r++) {
        const on = lit - r;
        const fill = on <= 0 ? accent : COLORS[Math.min(COLORS.length - 1, Math.round((r / ROWS) * (COLORS.length - 1)))];
        s += `<circle cx="${fmt(c * cw + cw / 2)}" cy="${fmt(H - (r * ch + ch / 2))}" r="${fmt(rad)}"`
          + ` fill="${col(fill)}" fill-opacity="${op(on <= 0 ? 0.1 : Math.min(1, 0.35 + on))}"/>`;
      }
    }
    return s;
  };

  // MilkDrop has no vector equivalent, and neither does an unknown style: both
  // fall through to bars, exactly as the canvas does.
  const BY_STYLE = {
    bars: () => drawBars(false),
    mirror: () => drawBars(true),
    spectrum: drawSpectrum,
    wave: drawWave,
    scope: drawScope,
    ring: drawRing,
    blob: drawBlob,
    ridge: drawRidge,
    dots: drawDots,
  };
  // Resolve the style BEFORE choosing the fit, or milkdrop (which draws as bars)
  // would be fitted as though it were one of the round ones.
  const drawn = BY_STYLE[style] ? style : 'bars';
  const body = BY_STYLE[drawn]();
  const fit = STILL_STRETCH[drawn] ? 'none' : 'xMidYMid meet';
  return `<svg class="ag-ph" viewBox="0 0 ${W} ${H}" preserveAspectRatio="${fit}" aria-hidden="true">`
    + (defs.length ? `<defs>${defs.join('')}</defs>` : '')
    + `${body}</svg>`;
}

async function onInit(ctx) {
  return build(ctx);
}

async function onInput(ctx) {
  return build(ctx);
}

/**
 * Make the video as long as the audio it is drawing - and an audio-only export the
 * same excerpt the video would have carried.
 *
 * VIDEO: the analysis covers the whole clip from the in-point, but the manifest's
 * default export length is still 8 seconds - so a 5-second voice memo or a 3-minute
 * track would otherwise be walked across the wrong duration and the picture would
 * drift against its own soundtrack. Setting the duration from the analysed span makes
 * the animation and the audio end together by construction, at any clip length.
 * The same span is stamped on the stage as data-clip-ms (see agClipMs), so the export
 * bar's Duration field SHOWS that length rather than the manifest's 8 s while the export
 * silently runs longer - a user who wants a shorter clip types over it, and that wins.
 *
 * AUDIO (wav/mp3/m4a/opus): the file IS the sound, and the sound is the excerpt the
 * card is about - from "Start at" (stamped on the stage as data-audio-start, which is
 * where the export path reads the in-point) to the end of the clip. The tool applies
 * NOTHING to it: no fade, no normalisation, no gain. The video's soundtrack is the
 * same span played at the export bar's own level, so the two exports agree about the
 * same clip by construction rather than by matching two sets of maths.
 *
 * Leaving `duration` UNSET is what the export path reads as "to the end of the
 * source", and it is also what lets an untrimmed export in the source's own format
 * hand back the original bytes instead of a lossy re-encode. A duration inherited
 * from the video card (the manifest's 8 s default) would silently truncate the sound
 * to something nobody asked for, so it is cleared.
 *
 * Both branches defer to a duration the user chose: the export popup's value is a
 * deliberate instruction and must win. Same stance as the sequence tool's beforeExport.
 */
function beforeExport(ctx) {
  if (!ctx || !ctx.opts) return;
  const ANIMATED = { webm: 1, mp4: 1, gif: 1, 'webp-anim': 1 };
  const AUDIO_ONLY = { wav: 1, mp3: 1, m4a: 1, opus: 1 };
  if (AUDIO_ONLY[ctx.format]) {
    if (!ctx.opts.durationUserSet) delete ctx.opts.duration;
    return;
  }
  if (!ANIMATED[ctx.format]) return;
  if (ctx.opts.durationUserSet) return;
  if (_analysedSec > 0.5) ctx.opts.duration = Math.round(_analysedSec * 100) / 100;
}
