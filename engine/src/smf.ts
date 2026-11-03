// SPDX-License-Identifier: MPL-2.0
/**
 * Standard MIDI File 1.0 reader and writer, lossless.
 *
 * Written from the published specification ("Standard MIDI-File Format Spec.
 * 1.1", MIDI Manufacturers Association). `readSmf` keeps everything needed to put
 * the same bytes back: the header length and any extra header bytes, the declared
 * track count, chunks the reader does not know (kept as they are, in order), bytes
 * after the last chunk, bytes after a track's end-of-track event, each event's
 * delta time and meta/sysex length in the exact number of bytes the file used,
 * and whether an event used running status. `writeSmf(readSmf(b))` is `b` byte for
 * byte for every file the reader accepts.
 *
 * Events are not interpreted beyond their framing. A note-on with velocity 0
 * stays a note-on; a tempo stays three bytes. {@link smfTempo} and the other
 * `smf*` helpers read a typed view of a meta event and leave the event alone.
 *
 * The reader takes untrusted bytes. Every count and length is capped by
 * {@link SMF_LIMITS} (override with the `limits` argument), every offset is checked
 * against the chunk it lives in, a variable-length quantity is at most four bytes,
 * and malformed input throws an {@link SmfError} with a stable `code` and the byte
 * offset. Nothing recurses and nothing allocates from a length before that length
 * has been checked against the bytes that remain.
 *
 * Strictness: a meta or sysex event cancels running status (the specification
 * says so), so a data byte after one with no status is refused. A chunk whose
 * declared length runs past the end of the file is refused rather than clamped,
 * because clamping cannot be written back the same.
 *
 * Pure and DOM-free: Uint8Array and DataView only.
 */

/** Hard bounds for {@link readSmf}. Pass a `Partial` to tighten or loosen them. */
export interface SmfLimits {
  /** Largest input, in bytes. */
  maxBytes: number;
  /** Most MTrk chunks. */
  maxTracks: number;
  /** Most chunks of unknown type. */
  maxUnknownChunks: number;
  /** Most events over all tracks. */
  maxEvents: number;
  /** Longest single meta or sysex payload, in bytes. */
  maxEventBytes: number;
}

export const SMF_LIMITS: Readonly<SmfLimits> = Object.freeze({
  maxBytes: 64 * 1024 * 1024,
  maxTracks: 4096,
  maxUnknownChunks: 4096,
  maxEvents: 1_000_000,
  maxEventBytes: 4 * 1024 * 1024,
});

/** Largest delta time or length a variable-length quantity can hold (four 7-bit groups). */
export const SMF_MAX_VLQ = 0x0fffffff;

export type SmfErrorCode =
  | 'not-smf'
  | 'too-large'
  | 'bad-header'
  | 'bad-division'
  | 'unsupported-format'
  | 'bad-chunk-length'
  | 'too-many-tracks'
  | 'too-many-chunks'
  | 'too-many-events'
  | 'event-too-long'
  | 'vlq-too-long'
  | 'truncated'
  | 'bad-status'
  | 'bad-data-byte'
  | 'no-running-status'
  | 'invalid-value';

export class SmfError extends Error {
  override name = 'SmfError';
  readonly code: SmfErrorCode;
  /** Byte offset in the input (or the event index for a write error). */
  readonly offset: number;
  constructor(code: SmfErrorCode, message: string, offset = 0) {
    super(`${message} (at byte ${offset})`);
    this.code = code;
    this.offset = offset;
  }
}

export type SmfChannelType =
  | 'noteOff'
  | 'noteOn'
  | 'polyPressure'
  | 'controlChange'
  | 'programChange'
  | 'channelPressure'
  | 'pitchBend';

const CHANNEL_TYPES: readonly SmfChannelType[] = [
  'noteOff', 'noteOn', 'polyPressure', 'controlChange', 'programChange', 'channelPressure', 'pitchBend',
];

interface SmfEventBase {
  /** Ticks since the previous event in the track. 0 to {@link SMF_MAX_VLQ}. */
  delta: number;
  /** Bytes the delta used when the file did not use the shortest form (set by the reader only). */
  deltaLen?: number;
}

export interface SmfChannelEvent extends SmfEventBase {
  kind: 'channel';
  type: SmfChannelType;
  /** 0 to 15 (channel 1 is 0). */
  channel: number;
  /** First data byte, 0 to 127: note, controller, program, pressure, or the low 7 bits of a bend. */
  data1: number;
  /** Second data byte, 0 to 127, for every type except programChange and channelPressure. */
  data2?: number;
  /** The file left the status byte out (running status). */
  running?: true;
}

export interface SmfMetaEvent extends SmfEventBase {
  kind: 'meta';
  /** The byte after FF: 0x51 tempo, 0x2F end of track, and so on. */
  metaType: number;
  data: Uint8Array;
  /** Bytes the length used when the file did not use the shortest form. */
  lenLen?: number;
}

export interface SmfSysexEvent extends SmfEventBase {
  kind: 'sysex';
  /** False for F0 (a message, or the first packet of one), true for F7 (a continuation or an escape). */
  escape: boolean;
  /** The bytes after the length. An F0 message normally ends in F7, kept here. */
  data: Uint8Array;
  lenLen?: number;
}

export type SmfEvent = SmfChannelEvent | SmfMetaEvent | SmfSysexEvent;

export interface SmfTrackChunk {
  kind: 'track';
  events: SmfEvent[];
  /** Bytes inside the chunk after the end-of-track event, kept as they are. */
  tail?: Uint8Array;
}

export interface SmfUnknownChunk {
  kind: 'unknown';
  /** The four-character chunk type, one character per byte. */
  id: string;
  data: Uint8Array;
}

export interface SmfHeader {
  /** 0, 1 or 2. */
  format: number;
  /**
   * The track count the header declares. The reader sets it to what the file
   * said. Leave it out when building a file and the writer counts the tracks.
   */
  trackCount?: number;
  /** Raw 16-bit division: ticks per quarter note, or SMPTE frames and ticks per frame. */
  division: number;
  /** Header bytes after the first six (a header chunk may be longer). */
  extra?: Uint8Array;
}

export interface SmfFile {
  header: SmfHeader;
  /** Track and unknown chunks in file order. */
  chunks: (SmfTrackChunk | SmfUnknownChunk)[];
  /** Fewer than eight bytes after the last chunk, kept as they are. */
  trailing?: Uint8Array;
}

export type SmfTimeDivision =
  | { kind: 'ppq'; ticksPerQuarter: number }
  | { kind: 'smpte'; framesPerSecond: 24 | 25 | 29 | 30; ticksPerFrame: number };

// ── Reader ──────────────────────────────────────────────────────────────────

const tag4 = (b: Uint8Array, at: number): string =>
  String.fromCharCode(b[at]!, b[at + 1]!, b[at + 2]!, b[at + 3]!);

/** The division as ticks per quarter or as SMPTE; throws for the undefined frame rates and zero values. */
export function smfTimeDivision(division: number): SmfTimeDivision {
  if (!Number.isInteger(division) || division < 0 || division > 0xffff) {
    throw new SmfError('bad-division', 'division is not a 16-bit value', 12);
  }
  if (!(division & 0x8000)) {
    if (division === 0) throw new SmfError('bad-division', 'division of 0 ticks per quarter note', 12);
    return { kind: 'ppq', ticksPerQuarter: division };
  }
  const fps = 256 - (division >> 8); // the high byte is a negative frame rate in two's complement
  const ticksPerFrame = division & 0xff;
  if ((fps !== 24 && fps !== 25 && fps !== 29 && fps !== 30) || ticksPerFrame === 0) {
    throw new SmfError('bad-division', 'invalid SMPTE division', 12);
  }
  return { kind: 'smpte', framesPerSecond: fps, ticksPerFrame };
}

/**
 * Read a Standard MIDI File. Throws {@link SmfError} for anything malformed or over a limit.
 * @param bytes the file
 * @param limits overrides for {@link SMF_LIMITS}
 */
export function readSmf(bytes: Uint8Array, limits: Partial<SmfLimits> = {}): SmfFile {
  const lim = { ...SMF_LIMITS, ...limits };
  const n = bytes.length;
  if (n > lim.maxBytes) throw new SmfError('too-large', `input is larger than ${lim.maxBytes} bytes`, 0);
  if (n < 4 || tag4(bytes, 0) !== 'MThd') throw new SmfError('not-smf', 'not a Standard MIDI File', 0);
  if (n < 8) throw new SmfError('truncated', 'header chunk is cut off', n);
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  const hlen = dv.getUint32(4);
  if (hlen < 6) throw new SmfError('bad-header', 'header chunk is shorter than 6 bytes', 4);
  if (hlen > n - 8) throw new SmfError('bad-chunk-length', 'header chunk runs past the end of the file', 4);
  const format = dv.getUint16(8);
  const trackCount = dv.getUint16(10);
  const division = dv.getUint16(12);
  if (format > 2) throw new SmfError('unsupported-format', `SMF format ${format} is not 0, 1 or 2`, 8);
  smfTimeDivision(division);
  const header: SmfHeader = { format, trackCount, division };
  if (hlen > 6) header.extra = bytes.slice(14, 8 + hlen);

  const chunks: (SmfTrackChunk | SmfUnknownChunk)[] = [];
  let pos = 8 + hlen;
  let tracks = 0;
  let unknown = 0;
  let events = 0;
  while (n - pos >= 8) {
    const id = tag4(bytes, pos);
    const len = dv.getUint32(pos + 4);
    const start = pos + 8;
    if (len > n - start) throw new SmfError('bad-chunk-length', `chunk "${printable(id)}" runs past the end of the file`, pos + 4);
    const end = start + len;
    if (id === 'MTrk') {
      if (++tracks > lim.maxTracks) throw new SmfError('too-many-tracks', `more than ${lim.maxTracks} tracks`, pos);
      const track = readTrack(bytes, start, end, lim, lim.maxEvents - events);
      events += track.events.length;
      chunks.push(track);
    } else {
      if (++unknown > lim.maxUnknownChunks) throw new SmfError('too-many-chunks', `more than ${lim.maxUnknownChunks} unknown chunks`, pos);
      chunks.push({ kind: 'unknown', id, data: bytes.slice(start, end) });
    }
    pos = end;
  }
  const file: SmfFile = { header, chunks };
  if (pos < n) file.trailing = bytes.slice(pos);
  return file;
}

const printable = (s: string): string => s.replace(/[^\x20-\x7e]/g, '?');

/** Read a variable-length quantity ending at or before `end`. Returns the value and its byte count. */
function readVlq(b: Uint8Array, at: number, end: number): { value: number; len: number } {
  let value = 0;
  for (let i = 0; i < 4; i++) {
    if (at + i >= end) throw new SmfError('truncated', 'variable-length quantity is cut off', at + i);
    const c = b[at + i]!;
    value = (value << 7) | (c & 0x7f);
    if (!(c & 0x80)) return { value, len: i + 1 };
  }
  throw new SmfError('vlq-too-long', 'variable-length quantity is longer than four bytes', at);
}

const minVlqLen = (v: number): number => (v < 0x80 ? 1 : v < 0x4000 ? 2 : v < 0x200000 ? 3 : 4);

function readTrack(b: Uint8Array, start: number, end: number, lim: SmfLimits, budget: number): SmfTrackChunk {
  const events: SmfEvent[] = [];
  let p = start;
  let running = -1; // status byte in effect, or -1
  while (p < end) {
    if (events.length >= budget) throw new SmfError('too-many-events', `more than ${lim.maxEvents} events`, p);
    const at = p;
    const d = readVlq(b, p, end);
    p += d.len;
    if (p >= end) throw new SmfError('truncated', 'event has a delta time but no status', at);
    const base: SmfEventBase = { delta: d.value };
    if (d.len !== minVlqLen(d.value)) base.deltaLen = d.len;

    let status = b[p]!;
    let isRunning = false;
    if (status < 0x80) {
      if (running < 0) throw new SmfError('no-running-status', 'data byte with no running status', p);
      status = running;
      isRunning = true;
    } else {
      p++;
    }

    if (status === 0xff) {
      running = -1;
      if (p >= end) throw new SmfError('truncated', 'meta event has no type', p);
      const metaType = b[p++]!;
      const l = readVlq(b, p, end);
      p += l.len;
      const data = takeData(b, p, end, l.value, lim);
      p += l.value;
      const ev: SmfMetaEvent = { ...base, kind: 'meta', metaType, data };
      if (l.len !== minVlqLen(l.value)) ev.lenLen = l.len;
      events.push(ev);
      if (metaType === 0x2f) {
        const out: SmfTrackChunk = { kind: 'track', events };
        if (p < end) out.tail = b.slice(p, end);
        return out;
      }
    } else if (status === 0xf0 || status === 0xf7) {
      running = -1;
      const l = readVlq(b, p, end);
      p += l.len;
      const data = takeData(b, p, end, l.value, lim);
      p += l.value;
      const ev: SmfSysexEvent = { ...base, kind: 'sysex', escape: status === 0xf7, data };
      if (l.len !== minVlqLen(l.value)) ev.lenLen = l.len;
      events.push(ev);
    } else if (status >= 0xf1) {
      throw new SmfError('bad-status', `system status ${status.toString(16)} cannot appear in a track`, isRunning ? p : p - 1);
    } else {
      running = status;
      const hi = status >> 4;
      const two = hi !== 0xc && hi !== 0xd;
      const need = two ? 2 : 1;
      if (end - p < need) throw new SmfError('truncated', 'channel event is cut off', p);
      const data1 = b[p]!;
      const data2 = two ? b[p + 1]! : undefined;
      if (data1 & 0x80 || (data2 !== undefined && data2 & 0x80)) {
        throw new SmfError('bad-data-byte', 'status byte where a data byte was expected', data1 & 0x80 ? p : p + 1);
      }
      p += need;
      const ev: SmfChannelEvent = { ...base, kind: 'channel', type: CHANNEL_TYPES[hi - 8]!, channel: status & 0x0f, data1 };
      if (data2 !== undefined) ev.data2 = data2;
      if (isRunning) ev.running = true;
      events.push(ev);
    }
  }
  return { kind: 'track', events };
}

function takeData(b: Uint8Array, at: number, end: number, len: number, lim: SmfLimits): Uint8Array {
  if (len > lim.maxEventBytes) throw new SmfError('event-too-long', `a meta or sysex payload is longer than ${lim.maxEventBytes} bytes`, at);
  if (len > end - at) throw new SmfError('truncated', 'meta or sysex payload runs past the end of its track', at);
  return b.slice(at, at + len);
}

// ── Writer ──────────────────────────────────────────────────────────────────

export interface SmfWriteOptions {
  /**
   * Leave out a channel event's status byte when the previous channel event in
   * the track has the same status and no meta or sysex event came between. Off by
   * default. Events the reader marked `running` are always written that way when
   * that is valid, so a file read and written keeps its bytes either way.
   */
  runningStatus?: boolean;
}

class Out {
  buf = new Uint8Array(1024);
  len = 0;
  ensure(extra: number): void {
    if (this.len + extra <= this.buf.length) return;
    let cap = this.buf.length;
    while (cap < this.len + extra) cap *= 2;
    const next = new Uint8Array(cap);
    next.set(this.buf.subarray(0, this.len));
    this.buf = next;
  }
  u8(v: number): void { this.ensure(1); this.buf[this.len++] = v; }
  u16(v: number): void { this.u8(v >> 8); this.u8(v & 0xff); }
  u32(v: number): void { this.u16(v >>> 16); this.u16(v & 0xffff); }
  bytes(v: Uint8Array): void { this.ensure(v.length); this.buf.set(v, this.len); this.len += v.length; }
  ascii(s: string): void { for (let i = 0; i < 4; i++) this.u8(s.charCodeAt(i) & 0xff); }
  /** A VLQ in `min` bytes or more (the extra bytes are leading 0x80 groups, which read back as the same value). */
  vlq(v: number, pad?: number): void {
    const want = Math.max(minVlqLen(v), pad ?? 0);
    for (let i = want - 1; i >= 0; i--) this.u8(((v >> (7 * i)) & 0x7f) | (i > 0 ? 0x80 : 0));
  }
  at(pos: number, v: number): void {
    this.buf[pos] = v >>> 24; this.buf[pos + 1] = (v >>> 16) & 0xff; this.buf[pos + 2] = (v >>> 8) & 0xff; this.buf[pos + 3] = v & 0xff;
  }
}

const fail = (what: string, index: number): never => { throw new SmfError('invalid-value', what, index); };

function checkVlq(v: number, what: string, index: number): void {
  if (!Number.isInteger(v) || v < 0 || v > SMF_MAX_VLQ) fail(`${what} must be a whole number from 0 to ${SMF_MAX_VLQ}`, index);
}

function checkPad(pad: number | undefined, v: number, what: string, index: number): void {
  if (pad !== undefined && (!Number.isInteger(pad) || pad < minVlqLen(v) || pad > 4)) fail(`${what} length is not valid for its value`, index);
}

/**
 * Write a Standard MIDI File. Throws {@link SmfError} (`invalid-value`) for a value that cannot be
 * written (a data byte over 127, a delta over the four-byte limit, a bad division). `offset` is the
 * event number within its track.
 */
export function writeSmf(file: SmfFile, opts: SmfWriteOptions = {}): Uint8Array {
  const h = file.header;
  if (!Number.isInteger(h.format) || h.format < 0 || h.format > 2) fail('format must be 0, 1 or 2', 0);
  try { smfTimeDivision(h.division); } catch { fail('division is not a valid SMF time division', 0); }
  const trackTotal = file.chunks.reduce((c, ch) => c + (ch.kind === 'track' ? 1 : 0), 0);
  const declared = h.trackCount ?? trackTotal;
  if (!Number.isInteger(declared) || declared < 0 || declared > 0xffff) fail('track count must fit 16 bits', 0);

  const out = new Out();
  out.ascii('MThd');
  out.u32(6 + (h.extra?.length ?? 0));
  out.u16(h.format);
  out.u16(declared);
  out.u16(h.division);
  if (h.extra) out.bytes(h.extra);

  for (const ch of file.chunks) {
    if (ch.kind === 'unknown') {
      if (ch.id.length !== 4) fail('chunk type must be four characters', 0);
      out.ascii(ch.id);
      out.u32(ch.data.length);
      out.bytes(ch.data);
    } else {
      out.ascii('MTrk');
      const lenAt = out.len;
      out.u32(0);
      writeTrackBody(out, ch, opts);
      const size = out.len - lenAt - 4;
      if (size > 0xffffffff) fail('track is larger than 4 GiB', 0);
      out.at(lenAt, size);
    }
  }
  if (file.trailing) out.bytes(file.trailing);
  return out.buf.slice(0, out.len);
}

function writeTrackBody(out: Out, track: SmfTrackChunk, opts: SmfWriteOptions): void {
  let running = -1;
  track.events.forEach((ev, i) => {
    checkVlq(ev.delta, 'delta', i);
    checkPad(ev.deltaLen, ev.delta, 'delta', i);
    out.vlq(ev.delta, ev.deltaLen);
    if (ev.kind === 'meta') {
      running = -1;
      if (!Number.isInteger(ev.metaType) || ev.metaType < 0 || ev.metaType > 0xff) fail('meta type must be a byte', i);
      checkVlq(ev.data.length, 'meta length', i);
      checkPad(ev.lenLen, ev.data.length, 'meta', i);
      out.u8(0xff);
      out.u8(ev.metaType);
      out.vlq(ev.data.length, ev.lenLen);
      out.bytes(ev.data);
    } else if (ev.kind === 'sysex') {
      running = -1;
      checkVlq(ev.data.length, 'sysex length', i);
      checkPad(ev.lenLen, ev.data.length, 'sysex', i);
      out.u8(ev.escape ? 0xf7 : 0xf0);
      out.vlq(ev.data.length, ev.lenLen);
      out.bytes(ev.data);
    } else {
      const hi = CHANNEL_TYPES.indexOf(ev.type);
      if (hi < 0) fail(`unknown channel event type "${String(ev.type)}"`, i);
      if (!Number.isInteger(ev.channel) || ev.channel < 0 || ev.channel > 15) fail('channel must be 0 to 15', i);
      const two = hi + 8 !== 0xc && hi + 8 !== 0xd;
      const status = ((hi + 8) << 4) | ev.channel;
      if (!Number.isInteger(ev.data1) || ev.data1 < 0 || ev.data1 > 127) fail('data byte must be 0 to 127', i);
      if (two && (!Number.isInteger(ev.data2) || ev.data2! < 0 || ev.data2! > 127)) fail('second data byte must be 0 to 127', i);
      if (!two && ev.data2 !== undefined) fail(`${ev.type} has one data byte`, i);
      if (!((ev.running || opts.runningStatus) && running === status)) out.u8(status);
      running = status;
      out.u8(ev.data1);
      if (two) out.u8(ev.data2!);
    }
  });
  if (track.tail) out.bytes(track.tail);
}

// ── Typed views of meta events ──────────────────────────────────────────────

const text = (d: Uint8Array): string => new TextDecoder('utf-8').decode(d);

/** Microseconds per quarter note of a set-tempo event (0x51), or null when it is not a well-formed one. */
export function smfTempo(ev: SmfEvent): number | null {
  if (ev.kind !== 'meta' || ev.metaType !== 0x51 || ev.data.length !== 3) return null;
  return (ev.data[0]! << 16) | (ev.data[1]! << 8) | ev.data[2]!;
}

/** A time-signature event (0x58): numerator, denominator as a number (4 for a quarter), clocks and 32nds. */
export function smfTimeSignature(ev: SmfEvent): { numerator: number; denominator: number; clocksPerClick: number; thirtySecondsPerQuarter: number } | null {
  if (ev.kind !== 'meta' || ev.metaType !== 0x58 || ev.data.length !== 4 || ev.data[1]! > 7) return null;
  return { numerator: ev.data[0]!, denominator: 2 ** ev.data[1]!, clocksPerClick: ev.data[2]!, thirtySecondsPerQuarter: ev.data[3]! };
}

/** A key-signature event (0x59): sharps (negative for flats) and whether the key is minor. */
export function smfKeySignature(ev: SmfEvent): { sharps: number; minor: boolean } | null {
  if (ev.kind !== 'meta' || ev.metaType !== 0x59 || ev.data.length !== 2) return null;
  const s = ev.data[0]! > 127 ? ev.data[0]! - 256 : ev.data[0]!;
  if (s < -7 || s > 7 || ev.data[1]! > 1) return null;
  return { sharps: s, minor: ev.data[1] === 1 };
}

/** The text of a text-family meta event: 0x01 text, 0x02 copyright, 0x03 track name, 0x04 instrument, 0x05 lyric, 0x06 marker, 0x07 cue point. */
export function smfText(ev: SmfEvent): string | null {
  if (ev.kind !== 'meta' || ev.metaType < 1 || ev.metaType > 7) return null;
  return text(ev.data);
}

// ── Builders ────────────────────────────────────────────────────────────────

/** A meta event holding text. */
export function smfTextEvent(metaType: number, value: string, delta = 0): SmfMetaEvent {
  return { kind: 'meta', delta, metaType, data: new TextEncoder().encode(value) };
}

/** A set-tempo event from microseconds per quarter note (1 to 16777215). */
export function smfTempoEvent(microsecondsPerQuarter: number, delta = 0): SmfMetaEvent {
  const v = Math.round(microsecondsPerQuarter);
  if (!Number.isFinite(v) || v < 1 || v > 0xffffff) throw new SmfError('invalid-value', 'tempo must be 1 to 16777215 microseconds per quarter note', 0);
  return { kind: 'meta', delta, metaType: 0x51, data: Uint8Array.of(v >> 16, (v >> 8) & 0xff, v & 0xff) };
}

/** A time-signature event. The denominator must be a power of two from 1 to 128. */
export function smfTimeSignatureEvent(numerator: number, denominator: number, delta = 0, clocksPerClick = 24, thirtySecondsPerQuarter = 8): SmfMetaEvent {
  const exp = Math.log2(denominator);
  if (!Number.isInteger(numerator) || numerator < 1 || numerator > 255 || !Number.isInteger(exp) || exp < 0 || exp > 7) {
    throw new SmfError('invalid-value', 'time signature needs a numerator of 1 to 255 and a power-of-two denominator of 1 to 128', 0);
  }
  return { kind: 'meta', delta, metaType: 0x58, data: Uint8Array.of(numerator, exp, clocksPerClick & 0xff, thirtySecondsPerQuarter & 0xff) };
}

/** A key-signature event: sharps from -7 (seven flats) to 7. */
export function smfKeySignatureEvent(sharps: number, minor: boolean, delta = 0): SmfMetaEvent {
  if (!Number.isInteger(sharps) || sharps < -7 || sharps > 7) throw new SmfError('invalid-value', 'key signature must be -7 to 7 sharps', 0);
  return { kind: 'meta', delta, metaType: 0x59, data: Uint8Array.of(sharps & 0xff, minor ? 1 : 0) };
}

/** The end-of-track event. */
export const smfEndOfTrack = (delta = 0): SmfMetaEvent => ({ kind: 'meta', delta, metaType: 0x2f, data: new Uint8Array(0) });
