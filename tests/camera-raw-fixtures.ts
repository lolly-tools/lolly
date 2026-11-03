// SPDX-License-Identifier: MPL-2.0
/**
 * A tiny TIFF/DNG writer for tests: little-endian, one strip of uncompressed 16-bit Bayer samples
 * (RGGB), no compression. It writes the tags the decoder reads and nothing else, so tests control
 * every value the decoder is supposed to honour.
 */
export interface DngOptions {
  width: number;
  height: number;
  /** Linear scene value 0..1 for the pixel at (x, y) in red, green and blue. */
  scene: (x: number, y: number) => [number, number, number];
  dng?: boolean;
  make?: string;
  model?: string;
  orientation?: number;
  iso?: number;
  exposureTime?: [number, number];
  fNumber?: [number, number];
  /** DNG ColorMatrix1 (XYZ to camera), row-major. */
  colorMatrix?: number[];
  asShotNeutral?: [number, number, number];
  baselineExposure?: number;
  /** Declare these dimensions instead, for limit tests, and write only `data` bytes of samples. */
  declare?: { width: number; height: number };
  /** Skip the pixel strip entirely. */
  noData?: boolean;
}

/** XYZ (D65) to linear sRGB, so a "camera" that records linear sRGB. */
export const XYZ_TO_SRGB = [3.2404542, -1.5371385, -0.4985314, -0.969266, 1.8760108, 0.041556, 0.0556434, -0.2040259, 1.0572252];

export function buildDng(o: DngOptions): Uint8Array {
  const { width, height } = o;
  const dng = o.dng ?? true;
  const pixels = width * height;
  const samples = new Uint16Array(o.noData ? 0 : pixels);
  const RGGB = [0, 1, 1, 2];
  if (!o.noData) for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) samples[y * width + x] = Math.round(Math.min(1, Math.max(0, o.scene(x, y)[RGGB[(y & 1) * 2 + (x & 1)]!]!)) * 65535);
  const bytes: number[] = [];
  const u16 = (v: number) => [v & 255, (v >> 8) & 255];
  const u32 = (v: number) => [v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255];
  type Entry = { tag: number; type: number; count: number; data: number[] };
  const ascii = (s: string) => [...new TextEncoder().encode(s), 0];
  const rat = (n: number, d: number) => [...u32(n >>> 0), ...u32(d >>> 0)];
  const srat = (v: number) => [...u32(Math.round(v * 10000) >>> 0), ...u32(10000)];

  // Layout: header(8) | IFD0 | Exif IFD | out-of-line values | strip.
  const exifEntries: Entry[] = [];
  if (o.exposureTime) exifEntries.push({ tag: 33434, type: 5, count: 1, data: rat(...o.exposureTime) });
  if (o.fNumber) exifEntries.push({ tag: 33437, type: 5, count: 1, data: rat(...o.fNumber) });
  if (o.iso) exifEntries.push({ tag: 34855, type: 3, count: 1, data: u16(o.iso) });
  const dw = o.declare?.width ?? width, dh = o.declare?.height ?? height;
  const main: Entry[] = [
    { tag: 254, type: 4, count: 1, data: u32(0) },
    { tag: 256, type: 4, count: 1, data: u32(dw) },
    { tag: 257, type: 4, count: 1, data: u32(dh) },
    { tag: 258, type: 3, count: 1, data: u16(16) },
    { tag: 259, type: 3, count: 1, data: u16(1) },
    { tag: 262, type: 3, count: 1, data: u16(32803) },
    { tag: 271, type: 2, count: 0, data: ascii(o.make ?? 'Lolly Test') },
    { tag: 272, type: 2, count: 0, data: ascii(o.model ?? 'Fixture One') },
    { tag: 273, type: 4, count: 1, data: [] },
    { tag: 274, type: 3, count: 1, data: u16(o.orientation ?? 1) },
    { tag: 277, type: 3, count: 1, data: u16(1) },
    { tag: 278, type: 4, count: 1, data: u32(dh) },
    { tag: 279, type: 4, count: 1, data: u32(samples.length * 2) },
    { tag: 33421, type: 3, count: 2, data: [...u16(2), ...u16(2)] },
    { tag: 33422, type: 1, count: 4, data: RGGB },
  ];
  if (exifEntries.length) main.push({ tag: 34665, type: 4, count: 1, data: [] });
  if (dng) {
    main.push({ tag: 50706, type: 1, count: 4, data: [1, 4, 0, 0] });
    main.push({ tag: 50714, type: 3, count: 1, data: u16(0) });
    main.push({ tag: 50717, type: 3, count: 1, data: u16(65535) });
    main.push({ tag: 50721, type: 10, count: 9, data: (o.colorMatrix ?? XYZ_TO_SRGB).flatMap(srat) });
    main.push({ tag: 50728, type: 5, count: 3, data: (o.asShotNeutral ?? [1, 1, 1]).flatMap(v => rat(Math.round(v * 10000), 10000)) });
    main.push({ tag: 50778, type: 3, count: 1, data: u16(21) });
    if (o.baselineExposure !== undefined) main.push({ tag: 50730, type: 10, count: 1, data: srat(o.baselineExposure) });
  }
  main.sort((a, b) => a.tag - b.tag);
  const typeSize: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 10: 8 };
  const ifdSize = (n: number) => 2 + n * 12 + 4;
  const ifd0At = 8, exifAt = ifd0At + ifdSize(main.length);
  const tail = exifAt + (exifEntries.length ? ifdSize(exifEntries.length) : 0);
  const out: number[] = [...[0x49, 0x49, 42, 0], ...u32(ifd0At)];
  const extra: number[] = [];
  const stripAt = () => stripOffset;
  let stripOffset = 0;
  const write = (entries: Entry[], base: number) => {
    const rows: number[] = [...u16(entries.length)];
    for (const e of entries) {
      const count = e.type === 2 ? e.data.length : e.count;
      let value: number[];
      if (e.tag === 273) value = u32(stripAt());
      else if (e.tag === 34665) value = u32(exifAt);
      else if (e.data.length <= 4) value = [...e.data, 0, 0, 0, 0].slice(0, 4);
      else { value = u32(tail + extra.length); extra.push(...e.data); if (extra.length % 2) extra.push(0); }
      rows.push(...u16(e.tag), ...u16(e.type), ...u32(count), ...value);
    }
    rows.push(...u32(0));
    void base; void typeSize;
    return rows;
  };
  // The strip follows all out-of-line values; compute their size first with a dry run.
  const dry = [...main, ...exifEntries].reduce((n, e) => n + (e.data.length > 4 ? e.data.length + (e.data.length % 2) : 0), 0);
  stripOffset = tail + dry;
  out.push(...write(main, ifd0At));
  if (exifEntries.length) out.push(...write(exifEntries, exifAt));
  out.push(...extra);
  bytes.push(...out);
  const head = new Uint8Array(bytes);
  const file = new Uint8Array(head.length + samples.length * 2);
  file.set(head);
  file.set(new Uint8Array(samples.buffer), head.length);
  void tail;
  return file;
}
