// SPDX-License-Identifier: MPL-2.0
/**
 * TTML2 and IMSC1.1 Text Profile captions, read and written as pure functions.
 *
 * Written from the W3C TTML2 and IMSC1.1 specifications. The writer emits media-time
 * clock times, one bottom-centre region and nothing else: Lolly's caption model holds a
 * start, an end and text, so no per-cue colour, font or position is written.
 *
 * The reader accepts TTML1 and TTML2 documents with `ttp:timeBase="media"` (or none).
 * Timing follows the time containers: `begin`, `end` and `dur` on `body`, `div` and `p`
 * offset and clip their contents. Styling and layout are ignored and noted once. The XML
 * parser is supplied by the shell, as for the other XML readers, so the engine stays
 * DOM-free.
 */
import { CaptionFormatError, type CaptionCue, type CaptionIssue } from './captions.ts';
import { readAdobeXml, type AdobeXmlParser } from './adobe-xml.ts';
import { escapeXml } from './xml-escape.ts';

export const TTML_LIMITS = {
  /** Largest document read, in bytes. */
  maxBytes: 8 * 1024 * 1024,
  /** Most cues read or written. */
  maxCues: 20_000,
  /** Longest cue text, in characters. */
  maxCueChars: 10_000,
  /** Latest time accepted, in seconds (100 hours). */
  maxSeconds: 360_000,
} as const;

export const TTML_NS = 'http://www.w3.org/ns/ttml';
export const IMSC11_TEXT_PROFILE = 'http://www.w3.org/ns/ttml/profile/imsc1.1/text';

// --- writer ---------------------------------------------------------------------------

export interface TtmlWriteOptions {
  /** BCP 47 language tag for `xml:lang`. Default `en`. An empty string means unknown. */
  lang?: string;
}

function clockTime(seconds: number): string {
  const ms = Math.round(seconds * 1000);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const pad = (n: number, w = 2): string => String(n).padStart(w, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms % 1000, 3)}`;
}

function xmlSafe(text: string, what: string): string {
  for (const ch of text) {
    const c = ch.codePointAt(0)!;
    if ((c < 32 && c !== 9 && c !== 10 && c !== 13) || (c >= 0xd800 && c <= 0xdfff) || c === 0xfffe || c === 0xffff) {
      throw new CaptionFormatError(`${what} holds a character that XML cannot carry (U+${c.toString(16).toUpperCase().padStart(4, '0')}).`);
    }
  }
  return escapeXml(text);
}

/**
 * Write cues (seconds) as an IMSC1.1 Text Profile document. Times are media times in
 * `hh:mm:ss.mmm` clock form. Line breaks become `<br/>`. Throws `CaptionFormatError` for a
 * bad time, a bad language tag, too many cues, or a character XML cannot carry.
 */
export function cuesToTtml(cues: readonly CaptionCue[], opts: TtmlWriteOptions = {}): string {
  const lang = opts.lang ?? 'en';
  if (lang !== '' && !/^[A-Za-z]{1,8}(-[A-Za-z0-9]{1,8})*$/.test(lang)) throw new CaptionFormatError('The language tag is not valid.');
  if (cues.length > TTML_LIMITS.maxCues) throw new CaptionFormatError('Too many captions for one TTML file.');
  const body: string[] = [];
  cues.forEach((c, i) => {
    if (!Number.isFinite(c.start) || !Number.isFinite(c.end) || c.start < 0 || c.end < c.start || c.end > TTML_LIMITS.maxSeconds) {
      throw new CaptionFormatError(`Caption ${i + 1} has a time that is out of range.`);
    }
    if (c.text.length > TTML_LIMITS.maxCueChars) throw new CaptionFormatError(`Caption ${i + 1} is too long.`);
    const lines = c.text.split(/\r\n|\r|\n/).map((l) => xmlSafe(l, `Caption ${i + 1}`));
    body.push(`      <p xml:id="c${i + 1}" begin="${clockTime(c.start)}" end="${clockTime(c.end)}">${lines.join('<br/>')}</p>`);
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<tt xmlns="${TTML_NS}" xmlns:tts="${TTML_NS}#styling" xmlns:ttp="${TTML_NS}#parameter" xml:lang="${lang}" ttp:timeBase="media" ttp:contentProfiles="${IMSC11_TEXT_PROFILE}">`,
    '  <head>',
    '    <layout>',
    '      <region xml:id="bottom" tts:origin="10% 70%" tts:extent="80% 20%" tts:displayAlign="after" tts:textAlign="center"/>',
    '    </layout>',
    '  </head>',
    '  <body region="bottom">',
    '    <div>',
    ...body,
    '    </div>',
    '  </body>',
    '</tt>',
    '',
  ].join('\n');
}

// --- reader ---------------------------------------------------------------------------

export interface TtmlReadOptions {
  /** Throw on skipped or approximated content instead of listing that content. */
  strict?: boolean;
}
export interface TtmlReadResult {
  cues: CaptionCue[];
  issues: CaptionIssue[];
}

export interface TtmlTiming {
  /** Frames per second, frameRate times multiplier. */
  fps: number;
  /** The nominal frame rate, which bounds the frames field of a clock time. */
  nominal: number;
  subFrames: number;
  tickRate: number;
}

const attr = (el: Element, name: string): string | null => {
  for (const a of Array.from(el.attributes)) {
    if (a.localName === name && (!a.namespaceURI || a.namespaceURI.endsWith('#parameter') || a.namespaceURI.endsWith('#metadata'))) return a.value;
  }
  return null;
};

function posInt(raw: string | null, name: string): number | null {
  if (raw === null) return null;
  if (!/^\d+$/.test(raw.trim()) || !Number.isSafeInteger(Number(raw)) || Number(raw) <= 0) throw new CaptionFormatError(`The ${name} value "${raw.slice(0, 20)}" is not a positive whole number.`);
  return Number(raw);
}

function readTiming(root: Element): TtmlTiming {
  const timeBase = attr(root, 'timeBase');
  if (timeBase !== null && timeBase !== 'media') throw new CaptionFormatError(`The time base "${timeBase.slice(0, 20)}" is not supported. Only media time is read.`);
  const frameRate = posInt(attr(root, 'frameRate'), 'frame rate');
  const subFrames = posInt(attr(root, 'subFrameRate'), 'sub-frame rate') ?? 1;
  let mult = 1;
  const rawMult = attr(root, 'frameRateMultiplier');
  if (rawMult !== null) {
    const m = /^\s*(\d+)\s+(\d+)\s*$/.exec(rawMult);
    if (!m || Number(m[1]) <= 0 || Number(m[2]) <= 0) throw new CaptionFormatError('The frame rate multiplier must be two positive whole numbers.');
    mult = Number(m[1]) / Number(m[2]);
  }
  const nominal = frameRate ?? 30;
  const fps = nominal * mult;
  const explicit = posInt(attr(root, 'tickRate'), 'tick rate');
  const tickRate = explicit ?? (frameRate !== null ? fps * subFrames : 1);
  return { fps, nominal, subFrames, tickRate };
}

/** A TTML time expression in seconds, or null when it is not valid or out of range. */
export function parseTtmlTime(expr: string, t: TtmlTiming = { fps: 30, nominal: 30, subFrames: 1, tickRate: 1 }): number | null {
  const s = expr.trim();
  let out: number | null = null;
  const m = /^(\d{2,}):(\d{2}):(\d{2})(?:\.(\d{1,12})|:(\d{2,})(?:\.(\d+))?)?$/.exec(s);
  const off = m ? null : /^(\d+(?:\.\d{1,12})?)(ms|h|m|s|f|t)$/.exec(s);
  if (m) {
    const [hh, mm, ss] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (mm > 59 || ss > 59) return null;
    out = hh * 3600 + mm * 60 + ss;
    if (m[4]) out += Number(`0.${m[4]}`);
    if (m[5]) {
      const ff = Number(m[5]);
      if (ff >= t.nominal) return null;
      out += ff / t.fps;
      if (m[6]) {
        const sub = Number(m[6]);
        if (!/^\d+$/.test(m[6]) || sub >= t.subFrames) return null;
        out += sub / (t.fps * t.subFrames);
      }
    }
  } else if (off) {
    const n = Number(off[1]);
    const unit = off[2];
    out = unit === 'h' ? n * 3600 : unit === 'm' ? n * 60 : unit === 's' ? n : unit === 'ms' ? n / 1000 : unit === 'f' ? n / t.fps : n / t.tickRate;
  }
  if (out === null || !Number.isFinite(out) || out < 0 || out > TTML_LIMITS.maxSeconds) return null;
  return out;
}

interface Span {
  begin: number;
  /** Infinity when nothing bounds the end. */
  end: number;
}

/**
 * Read a TTML or IMSC1 document into cues (seconds, sorted by start). `parse` turns XML text
 * into a DOM Document, as the other XML readers take their input. Throws `CaptionFormatError` for
 * input that is not well-formed TTML: size above the limit, a doctype or entity declaration,
 * malformed XML, a root other than `tt`, bad timing parameters, an unsupported time base, or
 * more cues than `TTML_LIMITS.maxCues`. Paragraphs with bad times, or with no end, are skipped
 * and listed.
 */
export function ttmlToCues(source: string, parse: AdobeXmlParser, opts: TtmlReadOptions = {}): TtmlReadResult {
  if (typeof source !== 'string') throw new CaptionFormatError('TTML input must be text.');
  let doc: Document;
  try {
    doc = readAdobeXml(source.replace(/^﻿/, ''), parse, TTML_LIMITS.maxBytes);
  } catch (err) {
    throw new CaptionFormatError(`This is not a readable TTML file: ${(err as Error).message}`);
  }
  const root = doc.documentElement;
  if (root.localName !== 'tt') throw new CaptionFormatError('This is not a TTML file: the root element must be "tt".');
  const timing = readTiming(root);

  const issues: CaptionIssue[] = [];
  const seen = new Set<string>();
  const note = (code: string, message: string, once = false): void => {
    if (opts.strict) throw new CaptionFormatError(message);
    if (once && seen.has(code)) return;
    seen.add(code);
    issues.push({ code, message });
  };

  const cues: CaptionCue[] = [];
  const noteStyle = (el: Element): void => {
    for (const a of Array.from(el.attributes)) {
      if (a.namespaceURI?.endsWith('#styling')) note('styling', 'Colour, font and position settings in the TTML file are not carried.', true);
    }
  };

  const clock = (el: Element, name: string): number | null | undefined => {
    const raw = attr(el, name);
    if (raw === null) return undefined;
    return parseTtmlTime(raw, timing);
  };

  /** The active interval of `el` inside its parent's interval, or null when it never shows. */
  const interval = (el: Element, parent: Span, label: string): Span | null => {
    const b = clock(el, 'begin');
    const e = clock(el, 'end');
    const d = clock(el, 'dur');
    if (b === null || e === null || d === null) {
      note('bad-time', `A ${label} with an unreadable time was skipped.`);
      return null;
    }
    const begin = parent.begin + (b ?? 0);
    let end = parent.end;
    if (e !== undefined) end = Math.min(end, parent.begin + e);
    if (d !== undefined) end = Math.min(end, begin + d);
    if (begin >= parent.end || !(end > begin)) return null;
    return { begin, end };
  };

  const collapse = (s: string): string => s.replace(/[ \t\r\n]+/g, ' ');
  /** Text of an element: `<br/>` is a line break, timed spans are returned separately. */
  const textOf = (el: Element, preserve: boolean, timed: Element[]): string => {
    let out = '';
    for (const n of Array.from(el.childNodes)) {
      if (n.nodeType === 3 || n.nodeType === 4) out += preserve ? (n.nodeValue ?? '').replace(/\r\n?/g, '\n') : collapse(n.nodeValue ?? '');
      else if (n.nodeType === 1) {
        const c = n as Element;
        if (c.localName === 'br') out += '\n';
        else if (c.localName === 'metadata' || c.localName === 'set' || c.localName === 'animate') continue;
        else if (c.localName === 'span' && (attr(c, 'begin') !== null || attr(c, 'end') !== null || attr(c, 'dur') !== null)) timed.push(c);
        else {
          noteStyle(c);
          out += textOf(c, c.getAttribute('xml:space') === 'preserve' ? true : c.getAttribute('xml:space') === 'default' ? false : preserve, timed);
        }
      }
    }
    return out;
  };
  const tidy = (s: string, preserve: boolean): string =>
    preserve ? s.replace(/^\n+|\n+$/g, '') : s.split('\n').map((l) => l.replace(/^ +| +$/g, '')).join('\n').replace(/^\n+|\n+$/g, '');

  const emit = (span: Span, raw: string, preserve: boolean): void => {
    const text = tidy(raw, preserve);
    if (!text) return;
    if (!Number.isFinite(span.end)) {
      note('no-end', 'A paragraph with no end time was skipped.');
      return;
    }
    if (text.length > TTML_LIMITS.maxCueChars) throw new CaptionFormatError('A caption in the TTML file is too long.');
    if (cues.length >= TTML_LIMITS.maxCues) throw new CaptionFormatError('The TTML file holds too many captions.');
    cues.push({ start: span.begin, end: span.end, text });
  };

  const walk = (el: Element, parent: Span, preserve: boolean): void => {
    const isP = el.localName === 'p';
    if (el.localName === 'head' || el.localName === 'metadata') return;
    noteStyle(el);
    const tc = attr(el, 'timeContainer');
    if (tc === 'seq') note('seq', 'A sequential time container was read as a parallel one.', true);
    if (el.localName !== 'tt' && el.localName !== 'body' && el.localName !== 'div' && !isP) return;
    const span = el.localName === 'tt' ? parent : interval(el, parent, isP ? 'paragraph' : 'section');
    if (!span) return;
    const keep = el.getAttribute('xml:space') === 'preserve' ? true : el.getAttribute('xml:space') === 'default' ? false : preserve;
    if (isP) {
      const timed: Element[] = [];
      const own = textOf(el, keep, timed);
      if (timed.length) note('timed-spans', 'Timed spans inside a paragraph were read as separate captions.', true);
      if (!timed.length || own.trim()) emit(span, own, keep);
      for (const sp of timed) {
        const s = interval(sp, span, 'span');
        if (!s) continue;
        const inner: Element[] = [];
        emit(s, textOf(sp, keep, inner), keep);
      }
      return;
    }
    for (const child of Array.from(el.children)) walk(child, span, keep);
  };
  walk(root, { begin: 0, end: Infinity }, false);

  return { cues: cues.sort((a, b) => a.start - b.start), issues };
}
