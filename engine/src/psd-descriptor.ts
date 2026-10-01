// SPDX-License-Identifier: MPL-2.0
/**
 * Photoshop's two structured text formats inside a layer's tagged blocks
 * (plans/289 item 1): the Action Descriptor (the typed key/value tree that type
 * layers, vector origination, solid fills and stroke settings are stored as)
 * and the text engine's EngineData (a small PostScript-like dictionary that
 * carries a type layer's fonts, sizes, colours and paragraph settings).
 *
 * Written from Adobe's Photoshop File Formats Specification ("Descriptor
 * structure" and the Type Tool Object Setting), with the reading order of
 * Composa's PsdDescriptor.cs and PsdText.cs (MIT, Copyright (c) 2026 Dennis van
 * der Stelt) as a guide. Nothing here comes from a GPL reader.
 *
 * UNTRUSTED INPUT. A layered file is attacker bytes (docs/threat-model.md), so
 * every read is bounds-checked and bounded: descriptor nesting (32 levels),
 * items per descriptor (10,000), list length (100,000), items read in total
 * (200,000), raw data (8 MB), and for EngineData nesting (64) and tokens read
 * (1,000,000). Neither source capped descriptor nesting; this does. Anything
 * unexpected returns null rather than a partial tree, and every object is
 * created without a prototype, so a key such as `__proto__` is an ordinary key.
 */

/** A descriptor value. `enum` values are kept apart from text so a name is never read as what someone typed. */
export type DescValue = number | boolean | string | DescEnum | DescObject | DescValue[] | Uint8Array | null;
export interface DescEnum { readonly enum: string }
export type DescObject = { [key: string]: DescValue };

const MAX_DEPTH = 32;
const MAX_ITEMS = 10_000;
const MAX_LIST = 100_000;
const MAX_TOTAL = 200_000;
const MAX_DATA = 8_000_000;
const MAX_KEY = 256;

class Stop extends Error {}

class Cursor {
  p: number;
  readonly b: Uint8Array;
  private readonly v: DataView;
  total = 0;
  constructor(b: Uint8Array, start: number) {
    this.b = b;
    this.p = start;
    this.v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  }
  need(n: number): void { if (n < 0 || this.p + n > this.b.length) throw new Stop(); }
  u8(): number { this.need(1); return this.b[this.p++]!; }
  u32(): number { this.need(4); const x = this.v.getUint32(this.p); this.p += 4; return x; }
  i32(): number { this.need(4); const x = this.v.getInt32(this.p); this.p += 4; return x; }
  f64(): number { this.need(8); const x = this.v.getFloat64(this.p); this.p += 8; return x; }
  i64(): number {
    this.need(8);
    const x = Number(this.v.getBigInt64(this.p));
    this.p += 8;
    return x;
  }
  ascii(n: number): string {
    this.need(n);
    let s = '';
    for (let i = 0; i < n; i++) s += String.fromCharCode(this.b[this.p + i]!);
    this.p += n;
    return s;
  }
  /** A key: a length, then that many characters, or a 4-character ID when the length is 0. */
  key(): string {
    const n = this.u32();
    if (n > MAX_KEY) throw new Stop();
    return this.ascii(n === 0 ? 4 : n);
  }
  /** A Unicode string: a character count, then UTF-16BE. A trailing NUL is dropped. */
  unicode(): string {
    const n = this.u32();
    if (n > MAX_DATA / 2) throw new Stop();
    this.need(n * 2);
    let s = '';
    for (let i = 0; i < n; i++) s += String.fromCharCode(this.v.getUint16(this.p + i * 2));
    this.p += n * 2;
    return s.replace(/\0+$/, '');
  }
  skip(n: number): void { this.need(n); this.p += n; }
  count(): void { if (++this.total > MAX_TOTAL) throw new Stop(); }
}

function object(c: Cursor, depth: number): DescObject {
  if (depth > MAX_DEPTH) throw new Stop();
  c.unicode(); // class name
  c.key(); // class ID
  const n = c.u32();
  if (n > MAX_ITEMS) throw new Stop();
  const out: DescObject = Object.create(null) as DescObject;
  for (let i = 0; i < n; i++) {
    c.count();
    const k = c.key();
    out[k] = item(c, c.ascii(4), depth);
  }
  return out;
}

function item(c: Cursor, type: string, depth: number): DescValue {
  switch (type) {
    case 'Objc':
    case 'GlbO':
      return object(c, depth + 1);
    case 'VlLs': {
      const n = c.u32();
      if (n > MAX_LIST) throw new Stop();
      const list: DescValue[] = [];
      for (let i = 0; i < n; i++) { c.count(); list.push(item(c, c.ascii(4), depth + 1)); }
      return list;
    }
    case 'doub': return c.f64();
    case 'UntF': c.skip(4); return c.f64();
    case 'UnFl': {
      c.skip(4);
      const n = c.u32();
      if (n > MAX_LIST) throw new Stop();
      const list: DescValue[] = [];
      for (let i = 0; i < n; i++) list.push(c.f64());
      return list;
    }
    case 'TEXT': return c.unicode();
    case 'enum': c.key(); return { enum: c.key() };
    case 'long': return c.i32();
    case 'comp': return c.i64();
    case 'bool': return c.u8() !== 0;
    case 'type':
    case 'GlbC':
      c.unicode(); return c.key();
    case 'tdta': {
      const n = c.u32();
      if (n > MAX_DATA) throw new Stop();
      c.need(n);
      const data = c.b.slice(c.p, c.p + n);
      c.p += n;
      return data;
    }
    case 'alis':
    case 'Pth ':
      c.skip(c.u32()); return null;
    case 'obj ':
      reference(c); return null;
    default:
      throw new Stop();
  }
}

/** A reference item, skipped so whatever follows it can still be read. */
function reference(c: Cursor): void {
  const n = c.u32();
  if (n > MAX_ITEMS) throw new Stop();
  for (let i = 0; i < n; i++) {
    c.count();
    switch (c.ascii(4)) {
      case 'prop': c.unicode(); c.key(); c.key(); break;
      case 'Clss': c.unicode(); c.key(); break;
      case 'Enmr': c.unicode(); c.key(); c.key(); c.key(); break;
      case 'rele': c.unicode(); c.key(); c.i32(); break;
      case 'Idnt': case 'indx': c.i32(); break;
      case 'name': c.unicode(); break;
      default: throw new Stop();
    }
  }
}

/** A descriptor starting at `offset`, and where it ends. Null on anything unexpected. */
export function readDescriptor(bytes: Uint8Array, offset = 0): { value: DescObject; end: number } | null {
  try {
    const c = new Cursor(bytes, offset);
    const value = object(c, 0);
    return { value, end: c.p };
  } catch (e) {
    if (e instanceof Stop) return null;
    throw e;
  }
}

/** A descriptor after its 4-byte version (16), as most tagged blocks store one. */
export function readVersionedDescriptor(bytes: Uint8Array, offset = 0): { value: DescObject; end: number } | null {
  if (offset + 4 > bytes.length) return null;
  const version = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset);
  return version === 16 ? readDescriptor(bytes, offset + 4) : null;
}

const own = (o: DescObject | null | undefined, k: string): DescValue | undefined =>
  o && Object.hasOwn(o, k) ? o[k] : undefined;

export const descNumber = (o: DescObject | null | undefined, k: string): number | null => {
  const v = own(o, k);
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
};
export const descText = (o: DescObject | null | undefined, k: string): string | null => {
  const v = own(o, k);
  return typeof v === 'string' ? v : null;
};
export const descBool = (o: DescObject | null | undefined, k: string): boolean | null => {
  const v = own(o, k);
  return typeof v === 'boolean' ? v : null;
};
export const descEnum = (o: DescObject | null | undefined, k: string): string | null => {
  const v = own(o, k);
  return v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Uint8Array) && typeof (v as DescEnum).enum === 'string' && Object.keys(v).length === 1
    ? (v as DescEnum).enum : null;
};
export const descData = (o: DescObject | null | undefined, k: string): Uint8Array | null => {
  const v = own(o, k);
  return v instanceof Uint8Array ? v : null;
};
export const descList = (o: DescObject | null | undefined, k: string): DescValue[] | null => {
  const v = own(o, k);
  return Array.isArray(v) ? v : null;
};
export const descChild = (o: DescObject | null | undefined, k: string): DescObject | null => {
  const v = own(o, k);
  return v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Uint8Array) && !('enum' in v && Object.keys(v).length === 1) ? v as DescObject : null;
};

const hex2 = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
const channel = (v: number) => (v > 1 ? v : v * 255);

/** A `Clr ` record's red, green and blue as `#rrggbb`. Older writers store 0..1, newer 0..255. */
export function descColor(color: DescObject | null | undefined): string | null {
  const r = descNumber(color, 'Rd  '), g = descNumber(color, 'Grn '), b = descNumber(color, 'Bl  ');
  if (r == null || g == null || b == null) return null;
  return `#${hex2(channel(r))}${hex2(channel(g))}${hex2(channel(b))}`;
}

// ── EngineData ───────────────────────────────────────────────────────────────

export type EngineValue = number | boolean | string | EngineValue[] | { [key: string]: EngineValue };

const ENGINE_DEPTH = 64;
const ENGINE_TOKENS = 1_000_000;

/**
 * The text engine's dictionary: `<< /Key value >>` dictionaries, `[ ]` arrays,
 * `/names`, numbers, booleans and `( )` or `< >` strings whose bytes are UTF-16
 * with a byte order mark, else Latin-1. Null when it does not parse.
 */
export function parseEngineData(bytes: Uint8Array): EngineValue | null {
  let i = 0;
  for (; i + 1 < bytes.length; i++) if (bytes[i] === 0x3c && bytes[i + 1] === 0x3c) break; // '<<'
  if (i + 1 >= bytes.length) return null;
  let p = i, depth = 0, tokens = 0;
  const at = (k = 0) => (p + k < bytes.length ? bytes[p + k]! : -1);
  const isDelim = (b: number) => b <= 0x20 || b === 0x2f || b === 0x3c || b === 0x3e || b === 0x5b || b === 0x5d || b === 0x28 || b === 0x29;
  const ws = () => {
    for (;;) {
      const b = at();
      if (b === 0x25) { while (at() !== -1 && at() !== 0x0a && at() !== 0x0d) p++; continue; } // % comment
      if (b !== -1 && b <= 0x20) { p++; continue; }
      return;
    }
  };
  const decode = (raw: number[]): string => {
    if (raw.length >= 2 && raw[0] === 0xfe && raw[1] === 0xff) {
      let s = '';
      for (let k = 2; k + 1 < raw.length; k += 2) s += String.fromCharCode((raw[k]! << 8) | raw[k + 1]!);
      return s;
    }
    return decodeLatin1(raw);
  };
  const decodeLatin1 = (raw: number[]): string => { let s = ''; for (const b of raw) s += String.fromCharCode(b); return s; };
  const token = (): string => { const s = p; while (at() !== -1 && !isDelim(at())) p++; return decodeLatin1([...bytes.subarray(s, p)]); };
  const word = (w: string): boolean => {
    for (let k = 0; k < w.length; k++) if (at(k) !== w.charCodeAt(k)) return false;
    if (at(w.length) !== -1 && !isDelim(at(w.length))) return false;
    p += w.length;
    return true;
  };

  function value(): EngineValue | null {
    if (++tokens > ENGINE_TOKENS) return null;
    ws();
    const b = at();
    if (b === -1) return null;
    if (b === 0x3c) return at(1) === 0x3c ? dict() : hex();
    if (b === 0x5b) return array();
    if (b === 0x28) return str();
    if (b === 0x2f) { p++; return token(); }
    if (b === 0x2d || b === 0x2b || b === 0x2e || (b >= 0x30 && b <= 0x39)) return number();
    if (word('true')) return true;
    if (word('false')) return false;
    if (word('null')) return '';
    return null;
  }
  function dict(): EngineValue | null {
    p += 2;
    if (++depth > ENGINE_DEPTH) return null;
    const out = Object.create(null) as { [key: string]: EngineValue };
    for (;;) {
      ws();
      if (at() === -1) return null;
      if (at() === 0x3e) break;
      if (at() !== 0x2f) return null;
      p++;
      const k = token();
      const v = value();
      if (v === null) return null;
      out[k] = v;
    }
    depth--;
    if (at() !== 0x3e || at(1) !== 0x3e) return null;
    p += 2;
    return out;
  }
  function array(): EngineValue | null {
    p++;
    if (++depth > ENGINE_DEPTH) return null;
    const out: EngineValue[] = [];
    for (;;) {
      ws();
      if (at() === -1) return null;
      if (at() === 0x5d) break;
      const v = value();
      if (v === null) return null;
      out.push(v);
    }
    depth--;
    p++;
    return out;
  }
  function number(): EngineValue | null {
    const s = p;
    if (at() === 0x2b || at() === 0x2d) p++;
    while (at() >= 0x30 && at() <= 0x39) p++;
    if (at() === 0x2e) { p++; while (at() >= 0x30 && at() <= 0x39) p++; }
    if (at() === 0x65 || at() === 0x45) { p++; if (at() === 0x2b || at() === 0x2d) p++; while (at() >= 0x30 && at() <= 0x39) p++; }
    const n = Number(decodeLatin1([...bytes.subarray(s, p)]));
    return Number.isFinite(n) ? n : null;
  }
  function str(): EngineValue | null {
    p++;
    const raw: number[] = [];
    for (;;) {
      const b = at();
      if (b === -1) return null;
      p++;
      if (b === 0x29) return decode(raw);
      if (b !== 0x5c) { raw.push(b); continue; }
      const e = at();
      if (e === -1) return null;
      p++;
      if (e === 0x6e) raw.push(0x0a);
      else if (e === 0x72) raw.push(0x0d);
      else if (e === 0x74) raw.push(0x09);
      else if (e >= 0x30 && e <= 0x37) {
        let v = e - 0x30;
        for (let k = 0; k < 2 && at() >= 0x30 && at() <= 0x37; k++) v = v * 8 + (bytes[p++]! - 0x30);
        raw.push(v & 0xff);
      } else if (e === 0x0a || e === 0x0d) { /* line continuation */ }
      else raw.push(e);
    }
  }
  function hex(): EngineValue | null {
    p++;
    const nib: number[] = [];
    for (;;) {
      const b = at();
      if (b === -1) return null;
      p++;
      if (b === 0x3e) break;
      const n = b >= 0x30 && b <= 0x39 ? b - 0x30 : b >= 0x61 && b <= 0x66 ? b - 0x57 : b >= 0x41 && b <= 0x46 ? b - 0x37 : -1;
      if (n >= 0) nib.push(n);
    }
    const raw: number[] = [];
    for (let k = 0; k + 1 < nib.length; k += 2) raw.push((nib[k]! << 4) | nib[k + 1]!);
    return decode(raw);
  }
  return value();
}

/** Walk dictionary keys; null when any step is missing. */
export function engineWalk(v: EngineValue | null | undefined, ...keys: string[]): EngineValue | null {
  let cur: EngineValue | null | undefined = v;
  for (const k of keys) {
    if (!cur || typeof cur !== 'object' || Array.isArray(cur) || !Object.hasOwn(cur, k)) return null;
    cur = (cur as { [key: string]: EngineValue })[k];
  }
  return cur ?? null;
}
export const engineNumber = (v: EngineValue | null): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
export const engineBool = (v: EngineValue | null): boolean | null => (typeof v === 'boolean' ? v : null);
export const engineString = (v: EngineValue | null): string | null => (typeof v === 'string' ? v : null);
export const engineList = (v: EngineValue | null): EngineValue[] => (Array.isArray(v) ? v : []);
