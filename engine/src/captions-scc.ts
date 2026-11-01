// SPDX-License-Identifier: MPL-2.0
/**
 * SCC (Scenarist Closed Caption) pop-on captions, read and written as pure functions.
 *
 * Written from the published CEA-608 byte tables and the Scenarist SCC text layout. It
 * has not been checked against a real broadcast tool or hardware decoder; see
 * docs/captions.md before relying on it for delivery.
 *
 * What is carried:
 *  - caption channel 1 (CC1) only, 29.97 fps, drop-frame or non-drop timecode labels;
 *  - pop-on captions: RCL, ENM, rows by preamble address code, text, EOC, EDM;
 *  - the basic North American character set plus the special characters and the
 *    Western European extended characters, which map one to one onto Unicode.
 *
 * What is refused or reported, never dropped silently:
 *  - roll-up and paint-on captions, text mode and other channels are skipped on read
 *    and listed in `issues` (or thrown with `strict`);
 *  - characters outside the set refuse the write, unless `onUnsupported: 'replace'`
 *    swaps them for `?` and lists each one;
 *  - colour, italics and underline are not held by the caption model; they are
 *    ignored on read and noted once.
 *
 * DOM-free: text in, cues out, and the reverse.
 */
import { CaptionFormatError, type CaptionCue, type CaptionIssue } from './captions.ts';

/** Hard limits for untrusted input. */
export const SCC_LIMITS = {
  /** Longest SCC text read, in UTF-16 units. */
  maxChars: 4 * 1024 * 1024,
  /** Most lines of caption data. */
  maxLines: 200_000,
  /** Most byte pairs (frames) of caption data. */
  maxPairs: 2_000_000,
  /** Most cues read or written. */
  maxCues: 20_000,
  /** Most characters in one cue written. */
  maxCueChars: 2_000,
} as const;

const FPS = 30_000 / 1001;
/** Caption screen: 15 rows of 32 columns. */
const COLS = 32;
const ROWS = 15;

// --- timecode -------------------------------------------------------------------------

const FRAMES_PER_10_MIN = 17_982;
const FRAMES_PER_DROP_MIN = 1_798;

/** Frame number to `HH:MM:SS;FF` (drop-frame) or `HH:MM:SS:FF` at 29.97 fps. */
export function frameToTimecode(frame: number, dropFrame: boolean): string {
  let f = Math.max(0, Math.floor(frame));
  if (dropFrame) {
    const tens = Math.floor(f / FRAMES_PER_10_MIN);
    const rest = f % FRAMES_PER_10_MIN;
    f += 18 * tens + (rest < 2 ? 0 : 2 * Math.floor((rest - 2) / FRAMES_PER_DROP_MIN));
  }
  const pad = (n: number): string => String(n).padStart(2, '0');
  const ff = f % 30;
  const ss = Math.floor(f / 30) % 60;
  const mm = Math.floor(f / 1800) % 60;
  const hh = Math.floor(f / 108_000);
  return `${pad(hh)}:${pad(mm)}:${pad(ss)}${dropFrame ? ';' : ':'}${pad(ff)}`;
}

/**
 * `HH:MM:SS:FF` or `HH:MM:SS;FF` to a frame number, or null when the text is not a valid
 * timecode. A semicolon (or comma or dot) before the frames means drop-frame. A drop-frame
 * label that points at a dropped frame (`00:01:00;00` and `;01`) is invalid.
 */
export function timecodeToFrame(tc: string): number | null {
  const m = /^(\d{2}):(\d{2}):(\d{2})([:;.,])(\d{2})$/.exec(tc);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  const ss = Number(m[3]);
  const ff = Number(m[5]);
  if (mm > 59 || ss > 59 || ff > 29) return null;
  const nominal = 108_000 * hh + 1800 * mm + 30 * ss + ff;
  if (m[4] === ':') return nominal;
  if (ss === 0 && ff < 2 && mm % 10 !== 0) return null;
  const minutes = 60 * hh + mm;
  return nominal - 2 * (minutes - Math.floor(minutes / 10));
}

// --- CEA-608 bytes --------------------------------------------------------------------

/** The byte with its odd-parity bit (bit 7) set so the eight bits hold an odd count of ones. */
export function withOddParity(byte: number): number {
  const b = byte & 0x7f;
  let ones = 0;
  for (let v = b; v; v >>= 1) ones += v & 1;
  return ones % 2 === 0 ? b | 0x80 : b;
}

/** True when the byte carries odd parity. */
export function hasOddParity(byte: number): boolean {
  let ones = 0;
  for (let v = byte & 0xff; v; v >>= 1) ones += v & 1;
  return ones % 2 === 1;
}

type Pair = readonly [number, number];

const MISC = { RCL: 0x20, BS: 0x21, DER: 0x24, RU2: 0x25, RU3: 0x26, RU4: 0x27, FON: 0x28, RDC: 0x29, TR: 0x2a, RTD: 0x2b, EDM: 0x2c, CR: 0x2d, ENM: 0x2e, EOC: 0x2f } as const;

const BASIC_SUBSTITUTES = new Map<number, string>([
  [0x2a, 'á'], [0x5c, 'é'], [0x5e, 'í'], [0x5f, 'ó'], [0x60, 'ú'], [0x7b, 'ç'], [0x7c, '÷'], [0x7d, 'Ñ'], [0x7e, 'ñ'], [0x7f, '■'],
]);
/** 0x11 0x30 to 0x3F. The transparent space reads as a plain space. */
const SPECIAL = [...'®°½¿™¢£♪à èâêîôû'];
/** 0x12 0x20 to 0x3F. */
const EXTENDED_12 = [...'ÁÉÓÚÜü‘¡*’—©℠•“”ÀÂÇÈÊËëÎÏïÔÙùÛ«»'];
/** 0x13 0x20 to 0x3F. */
const EXTENDED_13 = [...'ÃãÍÌìÒòÕõ{}\\^_|~ÄäÖöß¥¤│ÅåØø┌┐└┘'];

type Unit =
  | { kind: 'basic'; byte: number }
  | { kind: 'special'; b2: number }
  | { kind: 'extended'; b1: number; b2: number; fallback: number };

const FALLBACKS: Readonly<Record<string, string>> = {
  '‘': "'", '’': "'", '“': '"', '”': '"', '«': '"', '»': '"', '—': '-', '•': '*', '©': 'c', '℠': 'S', '¡': '!', '¥': 'Y',
  '¤': '$', '│': '|', '┌': '+', '┐': '+', '└': '+', '┘': '+', '{': '(', '}': ')', '\\': '/', '^': '"', '_': '-', '|': '!',
  '~': '-', '*': '+', 'ß': 's', 'Ø': 'O', 'ø': 'o',
};

function fallbackByte(ch: string): number {
  const mapped = FALLBACKS[ch];
  if (mapped) return mapped.charCodeAt(0);
  const base = ch.normalize('NFD')[0] ?? '?';
  return /^[A-Za-z]$/.test(base) ? base.charCodeAt(0) : 0x3f;
}

const UNITS = new Map<string, Unit>();
(() => {
  for (let code = 0x20; code <= 0x7f; code++) {
    const ch = BASIC_SUBSTITUTES.get(code) ?? String.fromCharCode(code);
        UNITS.set(ch, { kind: 'basic', byte: code });
  }
  const put = (table: string[], b1: number, from: number): void => {
    table.forEach((ch, i) => {
      if (!UNITS.has(ch)) UNITS.set(ch, { kind: 'extended', b1, b2: from + i, fallback: fallbackByte(ch) });
    });
  };
  put(EXTENDED_12, 0x12, 0x20);
  put(EXTENDED_13, 0x13, 0x20);
  SPECIAL.forEach((ch, i) => {
    if (ch !== ' ') UNITS.set(ch, { kind: 'special', b2: 0x30 + i });
  });
})();

/** Row (1 to 15) and attribute for a preamble address code first byte and second byte. */
const PAC_ROWS = new Map<number, readonly [number, number]>([
  [0x10, [11, 0]], [0x11, [1, 2]], [0x12, [3, 4]], [0x13, [12, 13]], [0x14, [14, 15]], [0x15, [5, 6]], [0x16, [7, 8]], [0x17, [9, 10]],
]);

function pacFor(row: number, indent: number): Pair {
  let b1 = 0x10;
  let high = 0;
  for (const [first, [a, b]] of PAC_ROWS) {
    if (row === a || (b && row === b)) {
      b1 = first;
      high = row === b ? 0x20 : 0;
    }
  }
  return [b1, 0x40 | high | 0x10 | ((indent / 4) << 1)];
}

// --- reader ---------------------------------------------------------------------------

export interface SccReadOptions {
  /** Throw on roll-up, paint-on, text mode, other channels and unterminated captions instead of listing them. */
  strict?: boolean;
}
export interface SccReadResult {
  cues: CaptionCue[];
  issues: CaptionIssue[];
}

type Mode = 'none' | 'popon' | 'other';
type Grid = (string | null)[][];
const newGrid = (): Grid => Array.from({ length: ROWS }, () => new Array<string | null>(COLS).fill(null));
const gridText = (g: Grid): string =>
  g.map((row) => row.map((c) => c ?? ' ').join('').replace(/^ +| +$/g, '')).filter((r) => r !== '').join('\n');

/**
 * Read SCC text into cues (seconds). Only pop-on captions on channel 1 become cues.
 * Malformed structure throws a `CaptionFormatError`: a missing or wrong header, a line that
 * is not `timecode words`, a word that is not four hex digits, an invalid timecode, a
 * timecode that goes backwards, or a size above `SCC_LIMITS`. Bytes that fail odd parity are
 * read with the parity bit ignored and counted in `issues`.
 */
export function sccToCues(text: string, opts: SccReadOptions = {}): SccReadResult {
  if (typeof text !== 'string') throw new CaptionFormatError('SCC input must be text.');
  if (text.length > SCC_LIMITS.maxChars) throw new CaptionFormatError('The SCC file is larger than 4 MB.');
  const lines = text.replace(/^﻿/, '').split(/\r\n|\r|\n/);
  if (lines.length > SCC_LIMITS.maxLines) throw new CaptionFormatError('The SCC file has too many lines.');
  let at = 0;
  while (at < lines.length && lines[at]!.trim() === '') at++;
  if (!/^Scenarist_SCC V1\.0\s*$/.test(lines[at] ?? '')) {
    throw new CaptionFormatError('This is not an SCC file: the first line must be "Scenarist_SCC V1.0".');
  }

  const issues: CaptionIssue[] = [];
  const seen = new Set<string>();
  const note = (code: string, message: string, once = false): void => {
    if (opts.strict && code !== 'parity' && code !== 'style') throw new CaptionFormatError(message);
    if (once) {
      if (seen.has(code)) return;
      seen.add(code);
    }
    issues.push({ code, message });
  };

  const cues: CaptionCue[] = [];
  let displayed = newGrid();
  let hidden = newGrid();
  let open: { start: number } | null = null;
  let mode: Mode = 'none';
  let channel = 1;
  let row = ROWS - 1;
  let col = 0;
  let prev: { frame: number; b1: number; b2: number } | null = null;
  let lastFrame = -1;
  let pairs = 0;
  let badParity = 0;

  const seconds = (frame: number): number => (frame * 1001) / 30_000;
  const closeCue = (frame: number): void => {
    if (!open) return;
    const text = gridText(displayed);
    if (text && frame > open.start) cues.push({ start: seconds(open.start), end: seconds(frame), text });
    open = null;
    if (cues.length > SCC_LIMITS.maxCues) throw new CaptionFormatError('The SCC file holds too many captions.');
  };
  const put = (ch: string): void => {
    if (mode !== 'popon' || channel !== 1) return;
    if (col >= COLS) col = COLS - 1;
    hidden[row]![col] = ch;
    col++;
  };
  const clock = (frame: number): string => frameToTimecode(frame, true);

  for (let li = at + 1; li < lines.length; li++) {
    const line = lines[li]!.trim();
    if (line === '') continue;
    const m = /^(\d{2}:\d{2}:\d{2}[:;.,]\d{2})(?:[\t ]+(.*))?$/.exec(line);
    if (!m) throw new CaptionFormatError(`SCC line ${li + 1} is not a timecode followed by caption words.`);
    const start = timecodeToFrame(m[1]!);
    if (start === null) throw new CaptionFormatError(`SCC line ${li + 1} has an invalid timecode "${m[1]}".`);
    const words = (m[2] ?? '').split(/[\t ]+/).filter(Boolean);
    if (start <= lastFrame) throw new CaptionFormatError(`SCC line ${li + 1} starts at or before the end of the previous line.`);
    pairs += words.length;
    if (pairs > SCC_LIMITS.maxPairs) throw new CaptionFormatError('The SCC file holds too much caption data.');
    for (let wi = 0; wi < words.length; wi++) {
      const w = words[wi]!;
      if (!/^[0-9a-fA-F]{4}$/.test(w)) throw new CaptionFormatError(`SCC line ${li + 1} holds "${w.slice(0, 12)}", which is not a four digit hex word.`);
      const frame = start + wi;
      lastFrame = frame;
      const r1 = parseInt(w.slice(0, 2), 16);
      const r2 = parseInt(w.slice(2, 4), 16);
      if (!hasOddParity(r1) || !hasOddParity(r2)) badParity++;
      let b1 = r1 & 0x7f;
      const b2 = r2 & 0x7f;

      if (b1 >= 0x10 && b1 <= 0x1f && b2 >= 0x20) {
        // Control codes come twice in a row; the second copy is ignored.
        const repeat = prev && prev.frame === frame - 1 && prev.b1 === b1 && prev.b2 === b2;
        const dupable = !(b1 === 0x11 && b2 >= 0x30) && !((b1 === 0x12 || b1 === 0x13 || b1 === 0x1a || b1 === 0x1b) && b2 < 0x40);
        if (repeat && dupable) {
          prev = null;
          continue;
        }
        prev = { frame, b1, b2 };
        channel = b1 & 0x08 ? 2 : 1;
        b1 &= ~0x08;
        if (b2 >= 0x40) {
          const rows = PAC_ROWS.get(b1);
          const rowNo = rows ? (b2 & 0x20 ? rows[1] : rows[0]) : 0;
          if (rowNo) {
            row = rowNo - 1;
            const low = b2 & 0x1f;
            col = low & 0x10 ? ((low & 0x0e) >> 1) * 4 : 0;
            if (low === 0x0e || low === 0x0f) note('style', 'Italics, colour and underline in the SCC file are not carried.', true);
          }
        } else if (b1 === 0x11 && b2 < 0x30) {
          put(' ');
          note('style', 'Italics, colour and underline in the SCC file are not carried.', true);
        } else if (b1 === 0x11) {
          put(SPECIAL[b2 - 0x30]!);
        } else if ((b1 === 0x12 || b1 === 0x13) && b2 < 0x40) {
          const ch = (b1 === 0x12 ? EXTENDED_12 : EXTENDED_13)[b2 - 0x20];
          if (ch && mode === 'popon' && channel === 1) {
            if (col > 0) col--;
            put(ch);
          }
        } else if (b1 === 0x17 && b2 >= 0x21 && b2 <= 0x23) {
          col = Math.min(COLS - 1, col + (b2 - 0x20));
        } else if ((b1 === 0x14 || b1 === 0x15) && b2 <= 0x2f) {
          if (channel !== 1) {
            note('channel', `A caption on channel ${channel} at ${clock(frame)} was skipped. Only channel 1 is read.`, true);
          } else if (b2 === MISC.RCL) mode = 'popon';
          else if (b2 === MISC.RU2 || b2 === MISC.RU3 || b2 === MISC.RU4) {
            mode = 'other';
            note('roll-up', `Roll-up captions at ${clock(frame)} were skipped. Only pop-on captions are read.`, true);
          } else if (b2 === MISC.RDC) {
            mode = 'other';
            note('paint-on', `Paint-on captions at ${clock(frame)} were skipped. Only pop-on captions are read.`, true);
          } else if (b2 === MISC.TR || b2 === MISC.RTD) {
            mode = 'other';
            note('text-mode', `Text mode data at ${clock(frame)} was skipped.`, true);
          } else if (b2 === MISC.ENM) hidden = newGrid();
          else if (b2 === MISC.EDM) closeCue(frame);
          else if (b2 === MISC.EOC) {
            if (mode === 'popon') {
              closeCue(frame);
              [displayed, hidden] = [hidden, displayed];
              if (gridText(displayed)) open = { start: frame };
            } else {
              mode = 'popon';
            }
          } else if (b2 === MISC.BS && mode === 'popon' && col > 0) {
            col--;
            hidden[row]![col] = null;
          } else if (b2 === MISC.DER && mode === 'popon') {
            for (let c = col; c < COLS; c++) hidden[row]![c] = null;
          }
        }
        continue;
      }

      prev = null;
      if (b1 >= 0x20) {
        for (const b of [b1, b2]) {
          if (b < 0x20) continue;
          put(BASIC_SUBSTITUTES.get(b) ?? String.fromCharCode(b));
        }
        if (mode === 'none' && channel === 1) {
          note('no-mode', `Caption text at ${clock(frame)} came before any pop-on command and was skipped.`, true);
        }
      }
    }
  }
  if (open) {
    note('unterminated', 'The last caption was never cleared. It ends one frame after the data stops.');
    closeCue(lastFrame + 1);
  }
  if (badParity) note('parity', `${badParity} byte(s) failed the CEA-608 odd-parity check and were read without it.`);
  return { cues, issues };
}

// --- writer ---------------------------------------------------------------------------

export interface SccWriteOptions {
  /** Drop-frame timecode labels (semicolon before frames). Default true. Both count real 29.97 fps frames. */
  dropFrame?: boolean;
  /** What to do with a character the caption set cannot carry. `'refuse'` (default) throws; `'replace'` writes `?` and lists the character. */
  onUnsupported?: 'refuse' | 'replace';
}
export interface SccWriteResult {
  text: string;
  issues: CaptionIssue[];
}

/** Wrap one line to at most 32 columns at spaces, splitting a longer word. */
function wrapLine(line: string): string[] {
  const rows: string[] = [];
  let cur = '';
  for (const word of line.split(' ').filter(Boolean)) {
    let w = word;
    while (Array.from(w).length > COLS) {
      if (cur) {
        rows.push(cur);
        cur = '';
      }
      const chars = Array.from(w);
      rows.push(chars.slice(0, COLS).join(''));
      w = chars.slice(COLS).join('');
    }
    const next = cur ? `${cur} ${w}` : w;
    if (Array.from(next).length > COLS) {
      rows.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) rows.push(cur);
  return rows;
}

function encodeRows(
  text: string,
  cueNo: number,
  opts: SccWriteOptions,
  issues: CaptionIssue[],
): Pair[] {
  let src = text.normalize('NFC').replace(/ /g, ' ');
  if (/<\/?[ibu]>/i.test(src)) {
    src = src.replace(/<\/?[ibu]>/gi, '');
    issues.push({ code: 'style', message: `Caption ${cueNo}: italic, bold and underline tags were removed. SCC pop-on output here carries plain text.` });
  }
  const rows = src.split(/\r\n|\r|\n/).flatMap((l) => wrapLine(l.replace(/[ \t]+/g, ' ').trim()));
  if (rows.length === 0) return [];
  if (rows.length > ROWS) throw new CaptionFormatError(`Caption ${cueNo} needs ${rows.length} rows. A CEA-608 screen holds ${ROWS}.`);
  const out: Pair[] = [[0x14, MISC.RCL], [0x14, MISC.RCL], [0x14, MISC.ENM], [0x14, MISC.ENM]];
  const bad = new Set<string>();
  const firstRow = ROWS + 1 - rows.length;
  rows.forEach((rowText, i) => {
    const units: Unit[] = [];
    for (const ch of Array.from(rowText)) {
      let u = UNITS.get(ch);
      if (!u) {
        bad.add(ch);
        if (opts.onUnsupported !== 'replace') continue;
        u = UNITS.get('?')!;
      }
      units.push(u);
    }
    const col = Math.floor((COLS - units.length) / 2);
    const pac = pacFor(firstRow + i, Math.floor(col / 4) * 4);
    out.push(pac, pac);
    if (col % 4) out.push([0x17, 0x20 + (col % 4)], [0x17, 0x20 + (col % 4)]);
    let pending: number | null = null;
    const flush = (): void => {
      if (pending !== null) out.push([pending, 0]);
      pending = null;
    };
    const basic = (b: number): void => {
      if (pending === null) pending = b;
      else {
        out.push([pending, b]);
        pending = null;
      }
    };
    for (const u of units) {
      if (u.kind === 'basic') basic(u.byte);
      else {
        if (u.kind === 'extended') basic(u.fallback);
        flush();
        out.push(u.kind === 'special' ? [0x11, u.b2] : [u.b1, u.b2]);
      }
    }
    flush();
  });
  if (bad.size) {
    const list = Array.from(bad).map((c) => `"${c}" (U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')})`).join(', ');
    if (opts.onUnsupported !== 'replace') {
      throw new CaptionFormatError(`Caption ${cueNo} has characters that CEA-608 cannot carry: ${list}. Change them, or write with replacement.`);
    }
    issues.push({ code: 'unsupported-character', message: `Caption ${cueNo}: replaced ${list} with "?".` });
  }
  return out;
}

/**
 * Write cues (seconds) as SCC pop-on captions at 29.97 fps.
 *
 * Each caption loads into non-displayed memory in the free frames before its start, then
 * End Of Caption (doubled) puts it on screen on its first frame; End Of Display clears it
 * at its end unless the next caption replaces it first. A caption whose load cannot fit
 * before its start is delayed, and each delay is listed. Cues are sorted by start. A cue
 * with blank text is skipped and listed. Throws `CaptionFormatError` for a non-finite or
 * negative time, more than `SCC_LIMITS.maxCues` cues, an over-long cue, more than 15 rows,
 * or (by default) a character the caption set cannot carry.
 */
export function cuesToScc(cues: readonly CaptionCue[], opts: SccWriteOptions = {}): SccWriteResult {
  const dropFrame = opts.dropFrame !== false;
  if (cues.length > SCC_LIMITS.maxCues) throw new CaptionFormatError('Too many captions for one SCC file.');
  const issues: CaptionIssue[] = [];
  const timeline = new Map<number, Pair>();
  const free = (from: number, n: number): boolean => {
    for (let f = from; f < from + n; f++) if (timeline.has(f)) return false;
    return true;
  };
  const put = (from: number, pairs: readonly Pair[]): void => pairs.forEach((p, i) => {
    timeline.set(from + i, p);
  });

  const order = cues.map((c, i) => ({ c, i })).sort((a, b) => a.c.start - b.c.start || a.i - b.i);
  const todo: { no: number; s: number; e: number; load: Pair[] }[] = [];
  for (const { c, i } of order) {
    if (!Number.isFinite(c.start) || !Number.isFinite(c.end) || c.start < 0 || c.end < 0) {
      throw new CaptionFormatError(`Caption ${i + 1} has a time that is not a finite, non-negative number of seconds.`);
    }
    if (c.text.length > SCC_LIMITS.maxCueChars) throw new CaptionFormatError(`Caption ${i + 1} is longer than ${SCC_LIMITS.maxCueChars} characters.`);
    const load = encodeRows(c.text, i + 1, opts, issues);
    if (load.length === 0) {
      issues.push({ code: 'empty-caption', message: `Caption ${i + 1} has no text and was skipped.` });
      continue;
    }
    const s = Math.round(c.start * FPS);
    todo.push({ no: i + 1, s, e: Math.max(s + 1, Math.round(c.end * FPS)), load });
  }

  let cursor = 0;
  let pendingEnd: { e: number } | null = null;
  const edm: Pair = [0x14, MISC.EDM];
  const eoc: Pair = [0x14, MISC.EOC];
  const clearAt = (e: number): void => {
    put(e, [edm, edm]);
  };
  for (const t of todo) {
    if (pendingEnd) {
      // The previous caption clears itself unless this one replaces it first.
      if (t.s > pendingEnd.e + 1) clearAt(pendingEnd.e);
      else if (t.s < pendingEnd.e) issues.push({ code: 'overlap', message: `Caption ${t.no} starts before the previous caption ends. The previous caption ends at ${frameToTimecode(t.s, dropFrame)}.` });
      pendingEnd = null;
    }
    const n = t.load.length;
    let b = -1;
    for (let cand = t.s - n; cand >= cursor; cand--) {
      if (free(cand, n)) {
        b = cand;
        break;
      }
    }
    if (b < 0) {
      b = cursor;
      while (!free(b, n)) b++;
    }
    put(b, t.load);
    let d = Math.max(t.s, b + n);
    while (!free(d, 2)) d++;
    put(d, [eoc, eoc]);
    if (d !== t.s) {
      issues.push({ code: 'delayed', message: `Caption ${t.no} could not load in time and starts ${d - t.s} frame(s) late, at ${frameToTimecode(d, dropFrame)}.` });
    }
    cursor = d + 2;
    pendingEnd = { e: Math.max(t.e, d + 2) };
  }
  if (pendingEnd) clearAt(pendingEnd.e);

  const hex = (p: Pair): string =>
    (withOddParity(p[0]) * 256 + withOddParity(p[1])).toString(16).padStart(4, '0');
  const frames = Array.from(timeline.keys()).sort((a, b) => a - b);
  const out: string[] = ['Scenarist_SCC V1.0', ''];
  let runStart = -1;
  let words: string[] = [];
  const flushRun = (): void => {
    if (words.length) out.push(`${frameToTimecode(runStart, dropFrame)}\t${words.join(' ')}`, '');
    words = [];
  };
  let last = -2;
  for (const f of frames) {
    if (f !== last + 1) {
      flushRun();
      runStart = f;
    }
    words.push(hex(timeline.get(f)!));
    last = f;
  }
  flushRun();
  return { text: out.join('\n'), issues };
}
