// SPDX-License-Identifier: MPL-2.0
/**
 * Builders for Photoshop tagged-block fixtures (plans/289 item 1): descriptors,
 * type layers (TySh with EngineData), vector origination (vogk), vector masks
 * (vmsk), solid fills (SoCo) and stroke settings (vstk), encoded the way Adobe's
 * Photoshop File Formats Specification lays them out. The shapes of the type and
 * vector fixtures follow Composa's test PsdWriter.cs (MIT), which records what
 * Photoshop writes.
 *
 * These are an encoder written from the same specification the reader was, so a
 * shared misreading would pass both. A real Photoshop file is the check that
 * closes that gap; see the plan's evidence notes.
 */

class Buf {
  private parts: number[] = [];
  u8(v: number) { this.parts.push(v & 0xff); return this; }
  u16(v: number) { return this.u8(v >> 8).u8(v); }
  u32(v: number) { return this.u8(v >>> 24).u8(v >>> 16).u8(v >>> 8).u8(v); }
  i32(v: number) { return this.u32(v >>> 0); }
  f64(v: number) { const b = new DataView(new ArrayBuffer(8)); b.setFloat64(0, v); for (let i = 0; i < 8; i++) this.u8(b.getUint8(i)); return this; }
  ascii(s: string) { for (const ch of s) this.u8(ch.charCodeAt(0)); return this; }
  bytes(b: ArrayLike<number>) { for (let i = 0; i < b.length; i++) this.u8(b[i]!); return this; }
  zeros(n: number) { for (let i = 0; i < n; i++) this.u8(0); return this; }
  done(): Uint8Array { return Uint8Array.from(this.parts); }
}

const key = (b: Buf, k: string) => (k.length === 4 ? b.u32(0).ascii(k) : b.u32(k.length).ascii(k));
const unicode = (b: Buf, s: string) => { b.u32(s.length); for (const ch of s) b.u16(ch.charCodeAt(0)); return b; };

/** One descriptor item: its 4-character type and its encoded body. */
export type Item = { type: string; body: Uint8Array };

export const D = {
  doub: (v: number): Item => ({ type: 'doub', body: new Buf().f64(v).done() }),
  untf: (unit: string, v: number): Item => ({ type: 'UntF', body: new Buf().ascii(unit).f64(v).done() }),
  long: (v: number): Item => ({ type: 'long', body: new Buf().i32(v).done() }),
  bool: (v: boolean): Item => ({ type: 'bool', body: new Buf().u8(v ? 1 : 0).done() }),
  text: (s: string): Item => ({ type: 'TEXT', body: unicode(new Buf(), s).done() }),
  enumv: (type: string, value: string): Item => { const b = new Buf(); key(b, type); key(b, value); return { type: 'enum', body: b.done() }; },
  raw: (data: Uint8Array): Item => ({ type: 'tdta', body: new Buf().u32(data.length).bytes(data).done() }),
  objc: (items: [string, Item][]): Item => ({ type: 'Objc', body: descriptor(items) }),
  list: (items: Item[]): Item => {
    const b = new Buf().u32(items.length);
    for (const it of items) b.ascii(it.type).bytes(it.body);
    return { type: 'VlLs', body: b.done() };
  },
};

/** A descriptor body: empty class name, class ID 'null', then the items. */
export function descriptor(items: [string, Item][]): Uint8Array {
  const b = new Buf();
  unicode(b, '');
  key(b, 'null');
  b.u32(items.length);
  for (const [k, it] of items) { key(b, k); b.ascii(it.type).bytes(it.body); }
  return b.done();
}

/** A versioned descriptor (version 16 first), as most tagged blocks store one. */
export const versioned = (items: [string, Item][]): Uint8Array => new Buf().u32(16).bytes(descriptor(items)).done();

const rgb = (hex: string): [string, Item][] => {
  const n = parseInt(hex.slice(1), 16);
  return [['Rd  ', D.doub((n >> 16) & 255)], ['Grn ', D.doub((n >> 8) & 255)], ['Bl  ', D.doub(n & 255)]];
};

/** SoCo: a solid colour fill layer. */
export const solidColor = (hex: string): Uint8Array => versioned([['Clr ', D.objc(rgb(hex))]]);

/** vstk: stroke settings. */
export const strokeSettings = (o: { fill: boolean; stroke: boolean; width: number; color: string; dash?: number[]; cap?: string; join?: string }): Uint8Array => versioned([
  ['strokeStyleVersion', D.long(2)], ['fillEnabled', D.bool(o.fill)], ['strokeEnabled', D.bool(o.stroke)],
  ['strokeStyleLineWidth', D.untf('#Pxl', o.width)],
  ...(o.dash ? [['strokeStyleLineDashSet', D.list(o.dash.map(v => D.untf('#Nne', v)))] as [string, Item]] : []),
  ...(o.cap ? [['strokeStyleLineCapType', D.enumv('strokeStyleLineCapType', o.cap)] as [string, Item]] : []),
  ...(o.join ? [['strokeStyleLineJoinType', D.enumv('strokeStyleLineJoinType', o.join)] as [string, Item]] : []),
  ['strokeStyleContent', D.objc([['Clr ', D.objc(rgb(o.color))]])],
]);

/** vogk: what the shape tool drew. type 1 rectangle, 2 rounded rectangle, 5 ellipse; box in canvas pixels. */
export function origination(type: number, box: { left: number; top: number; right: number; bottom: number }, radius?: number | [number, number, number, number]): Uint8Array {
  const bbox: [string, Item][] = [['unitValueQuadVersion', D.long(1)], ['Top ', D.untf('#Pxl', box.top)], ['Left', D.untf('#Pxl', box.left)], ['Btom', D.untf('#Pxl', box.bottom)], ['Rght', D.untf('#Pxl', box.right)]];
  const shape: [string, Item][] = [['keyOriginType', D.long(type)], ['keyOriginShapeBBox', D.objc(bbox)]];
  if (radius != null) {
    const [tl, tr, br, bl] = Array.isArray(radius) ? radius : [radius, radius, radius, radius];
    shape.push(['keyOriginRRectRadii', D.objc([['unitValueQuadVersion', D.long(1)], ['topRight', D.untf('#Pxl', tr)], ['topLeft', D.untf('#Pxl', tl)], ['bottomLeft', D.untf('#Pxl', bl)], ['bottomRight', D.untf('#Pxl', br)]])]);
  }
  shape.push(['keyOriginIndex', D.long(0)]);
  return new Buf().u32(1).u32(16).bytes(descriptor([['keyDescriptorList', D.list([D.objc(shape)])]])).done();
}

/** A knot as [x, y] anchor, with optional incoming and outgoing control points; all in canvas pixels. */
export type Knot = { at: [number, number]; in?: [number, number]; out?: [number, number] };

/** vmsk: one or more closed subpaths, coordinates as 8.24 fixed-point fractions of the canvas. */
export function vectorMask(canvasW: number, canvasH: number, subpaths: Knot[][], open = false, ops: number[] = []): Uint8Array {
  const b = new Buf().u32(3).u32(0);
  b.u16(6).zeros(24); // path fill rule record
  b.u16(8).zeros(24); // initial fill rule record
  const fixed = (frac: number) => Math.round(frac * 0x1000000);
  subpaths.forEach((knots, i) => {
    // The subpath length record: count, then the join (1 combines, as Photoshop writes by default).
    b.u16(open ? 3 : 0).u16(knots.length).u16(ops[i] ?? 1).zeros(20);
    for (const k of knots) {
      b.u16(open ? 4 : 1);
      for (const p of [k.in ?? k.at, k.at, k.out ?? k.at]) b.i32(fixed(p[1] / canvasH)).i32(fixed(p[0] / canvasW));
    }
  });
  return b.done();
}

/** vscg: newer Photoshop's shape fill, a kind and then that kind's descriptor. */
export const vectorFill = (kind: 'SoCo' | 'GdFl' | 'PtFl', hex = '#000000'): Uint8Array =>
  new Buf().bytes(Uint8Array.from([...kind].map(c => c.charCodeAt(0)))).bytes(kind === 'SoCo' ? solidColor(hex) : versioned([])).done();

/** lfx2: layer effects, each switched on or off. */
export const effects = (on: Record<string, boolean>, master = true): Uint8Array =>
  new Buf().u32(0).u32(16).bytes(descriptor([
    ['masterFXSwitch', D.bool(master)],
    ...Object.entries(on).map(([key, enab]): [string, Item] => [key, D.objc([['enab', D.bool(enab)]])]),
  ])).done();

export interface TypeFixture {
  text?: string;
  font?: string;
  size?: number;
  color?: string;
  /** 0 left, 1 right, 2 centre, 3+ justified. */
  justification?: number;
  tracking?: number;
  leading?: number | null;
  fauxBold?: boolean;
  fauxItalic?: boolean;
  vertical?: boolean;
  warp?: boolean;
  /** A second style run with a different size. */
  secondSize?: number;
  /** Style runs with their lengths in UTF-16 units over the text, written with a
   *  RunLengthArray as Photoshop writes them. `font` indexes `fonts`. */
  runs?: Array<{ length: number; font?: number; size?: number; color?: string; fauxBold?: boolean; fauxItalic?: boolean; underline?: boolean; strike?: boolean }>;
  /** The FontSet; defaults to `[font]`. */
  fonts?: string[];
  /** The 2x3 transform: xx, xy, yx, yy, tx, ty. */
  transform?: [number, number, number, number, number, number];
  /** Paragraph frame and glyph box, in text-space units. */
  bounds?: { left: number; top: number; right: number; bottom: number };
  glyphBounds?: { left: number; top: number; right: number; bottom: number };
  noEngine?: boolean;
}

const n = (v: number) => v.toFixed(4);

/** TySh: a Photoshop 6 type layer, with its EngineData. */
export function typeLayer(o: TypeFixture = {}): Uint8Array {
  const text = o.text ?? 'Hello';
  const size = o.size ?? 24;
  const color = o.color ?? '#000000';
  type RunFixture = NonNullable<TypeFixture['runs']>[number];
  const sheet = (r: Partial<RunFixture>): string => {
    const s = r.size ?? size;
    const c = parseInt((r.color ?? color).slice(1), 16);
    return `<<\n/StyleSheet\n<<\n/StyleSheetData\n<<\n/Font ${r.font ?? 0}\n/FontSize ${n(s)}\n/FauxBold ${(r.fauxBold ?? o.fauxBold) ? 'true' : 'false'}\n/FauxItalic ${(r.fauxItalic ?? o.fauxItalic) ? 'true' : 'false'}\n`
      + (r.underline ? '/Underline true\n' : '') + (r.strike ? '/Strikethrough true\n' : '')
      + `/AutoLeading ${o.leading == null ? 'true' : 'false'}\n/Leading ${n(o.leading ?? s * 1.2)}\n/Tracking ${n(o.tracking ?? 0)}\n`
      + `/FillColor\n<<\n/Type 1\n/Values [ 1.0 ${n(((c >> 16) & 255) / 255)} ${n(((c >> 8) & 255) / 255)} ${n((c & 255) / 255)} ]\n>>\n>>\n>>\n>>`;
  };
  let esc = '(\\376\\377';
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    for (const byte of [code >> 8, code & 255]) {
      esc += byte === 0x28 || byte === 0x29 || byte === 0x5c ? '\\' + String.fromCharCode(byte)
        : byte < 0x20 || byte > 0x7e ? '\\' + byte.toString(8).padStart(3, '0') : String.fromCharCode(byte);
    }
  }
  esc += ')';
  const runs = o.runs ? o.runs.map(sheet).join('\n') : o.secondSize != null ? `${sheet({})}\n${sheet({ size: o.secondSize })}` : sheet({});
  const lengths = o.runs ? `\n/RunLengthArray [ ${o.runs.map(r => r.length).join(' ')} ]` : '';
  const fontSet = (o.fonts ?? [o.font ?? 'Helvetica']).map(name => `<<\n/Name (${name})\n>>`).join('\n');
  const engine = `\n\n<<\n/EngineDict\n<<\n/Editor\n<<\n/Text ${esc}\n>>\n/ParagraphRun\n<<\n/RunArray\n[\n<<\n/ParagraphSheet\n<<\n/Properties\n<<\n/Justification ${o.justification ?? 0}\n>>\n>>\n>>\n]\n>>\n`
    + `/StyleRun\n<<\n/RunArray\n[\n${runs}\n]${lengths}\n>>\n>>\n/ResourceDict\n<<\n/FontSet\n[\n${fontSet}\n]\n>>\n>>`;
  const rect = (r: { left: number; top: number; right: number; bottom: number }) => D.objc([['Left', D.untf('#Pnt', r.left)], ['Top ', D.untf('#Pnt', r.top)], ['Rght', D.untf('#Pnt', r.right)], ['Btom', D.untf('#Pnt', r.bottom)]]);
  const items: [string, Item][] = [['Txt ', D.text(text)], ['Ornt', D.enumv('Ornt', o.vertical ? 'Vrtc' : 'Hrzn')]];
  if (o.bounds) items.push(['bounds', rect(o.bounds)]);
  if (o.glyphBounds) items.push(['boundingBox', rect(o.glyphBounds)]);
  if (!o.noEngine) items.push(['EngineData', D.raw(Uint8Array.from([...engine].map(ch => ch.charCodeAt(0) & 255)))]);
  const b = new Buf().u16(1);
  for (const v of o.transform ?? [1, 0, 0, 1, 40, 50]) b.f64(v);
  b.u16(50).u32(16).bytes(descriptor(items));
  b.u16(1).u32(16).bytes(descriptor([['warpStyle', D.enumv('warpStyle', o.warp ? 'warpArc' : 'warpNone')]]));
  return b.done();
}
