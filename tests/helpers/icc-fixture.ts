// SPDX-License-Identifier: MPL-2.0
/**
 * Synthetic ICC profile bytes, for the cases macOS's stock ColorSync tree cannot
 * prove: the v4 `mAB ` element type (no stock profile uses one), the legacy-vs-v4
 * Lab encoding decision, a v2 display profile beside a v2 printer profile carrying
 * the SAME white point tag, and a profile with only one direction of transform.
 *
 * Shared by tests/icc.test.ts and tests/gamut-icc-integration.test.ts so both
 * suites describe a fixture profile in the same vocabulary.
 *
 * Not collected by the test glob (only *.test.ts is); tests/tsconfig.json's
 * `./**\/*` include still typechecks it.
 */

export const u32 = (n: number): number[] => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
export const u16 = (n: number): number[] => [(n >>> 8) & 0xff, n & 0xff];
export const ascii = (s: string): number[] => [...s].map((c) => c.charCodeAt(0));

/** Assemble a profile from tag elements, laying each out 4-byte aligned. */
export function buildProfile(opts: {
  major?: number;
  /** The version's BCD minor byte (0x40 → x.4.0). Defaults to 0. */
  bcd?: number;
  deviceClass?: string;
  space?: string;
  pcs?: string;
  tags: [string, number[]][];
}): Uint8Array {
  const major = opts.major ?? 2;
  const header = new Array<number>(128).fill(0);
  header.splice(8, 4, major, opts.bcd ?? 0x00, 0, 0);
  header.splice(12, 4, ...ascii(opts.deviceClass ?? 'prtr'));
  header.splice(16, 4, ...ascii(opts.space ?? 'RGB '));
  header.splice(20, 4, ...ascii(opts.pcs ?? 'Lab '));
  header.splice(36, 4, ...ascii('acsp'));

  const table: number[] = [...u32(opts.tags.length)];
  let off = 128 + 4 + opts.tags.length * 12;
  off = (off + 3) & ~3;
  const body: number[] = [];
  for (const [sig, data] of opts.tags) {
    const at = off + body.length;
    table.push(...ascii(sig), ...u32(at), ...u32(data.length));
    body.push(...data);
    while (body.length % 4) body.push(0);
  }
  const pad = new Array<number>(off - (128 + 4 + opts.tags.length * 12)).fill(0);
  const all = [...header, ...table, ...pad, ...body];
  all.splice(0, 4, ...u32(all.length));
  return Uint8Array.from(all);
}

/** A 16-bit lut16Type (`mft2`) element: identity 2-entry curves either side of a flat CLUT. */
export function mft2(nIn: number, nOut: number, node: number[]): number[] {
  const g = 2;
  const el: number[] = [...ascii('mft2'), 0, 0, 0, 0, nIn, nOut, g, 0];
  for (const v of [1, 0, 0, 0, 1, 0, 0, 0, 1]) el.push(...u32(v * 65536));
  el.push(...u16(2), ...u16(2));
  for (let d = 0; d < nIn; d++) el.push(...u16(0), ...u16(65535));
  const nodes = g ** nIn;
  for (let i = 0; i < nodes; i++) for (const v of node) el.push(...u16(v));
  for (let k = 0; k < nOut; k++) el.push(...u16(0), ...u16(65535));
  return el;
}

/** An identity `curv` (count 0), 12 bytes. */
export const identityCurv = (): number[] => [...ascii('curv'), 0, 0, 0, 0, ...u32(0)];

/** An `XYZ ` tag (colorant or white point) from real XYZ values, s15Fixed16. */
export const xyzTag = (x: number, y: number, z: number): number[] => [
  ...ascii('XYZ '), 0, 0, 0, 0,
  ...u32(Math.round(x * 65536)), ...u32(Math.round(y * 65536)), ...u32(Math.round(z * 65536)),
];

/** A v4 lutAtoBType (`mAB `) element: A curves → 16-bit CLUT → B curves. */
export function mab(nIn: number, nOut: number, node: number[]): number[] {
  const head = 32;
  const aCurves: number[] = [];
  for (let d = 0; d < nIn; d++) aCurves.push(...identityCurv());
  const grid = 2;
  const clut: number[] = new Array<number>(16).fill(0);
  for (let d = 0; d < nIn; d++) clut[d] = grid;
  clut.push(2, 0, 0, 0); // 2-byte precision
  const nodes = grid ** nIn;
  for (let i = 0; i < nodes; i++) for (const v of node) clut.push(...u16(v));
  const bCurves: number[] = [];
  for (let k = 0; k < nOut; k++) bCurves.push(...identityCurv());

  const offA = head;
  const offClut = offA + aCurves.length;
  const offB = offClut + clut.length;
  return [
    ...ascii('mAB '), 0, 0, 0, 0, nIn, nOut, 0, 0,
    ...u32(offB), ...u32(0), ...u32(0), ...u32(offClut), ...u32(offA),
    ...aCurves, ...clut, ...bCurves,
  ];
}

/**
 * A CMYK profile with A2B0 and NO B2A0: device → Lab works, Lab → device cannot.
 * The structure of the stock abstract profiles, and the one an intent gate has to
 * refuse - a gamut source built over it contains nothing behind a valid label.
 */
export const oneWayProfileBytes = (): Uint8Array => buildProfile({
  deviceClass: 'prtr', space: 'CMYK',
  tags: [['A2B0', mft2(4, 3, [0x8000, 0x8080, 0x8080])]],
});

/** A v2 `desc` (textDescriptionType) tag carrying an ASCII description. */
export const descTag = (text: string): number[] => [
  ...ascii('desc'), 0, 0, 0, 0,
  ...u32(text.length + 1), ...ascii(text), 0,
  ...new Array<number>(78).fill(0),          // unicode + scriptcode fields, all empty
];

/**
 * A `targ` (characterizationTarget) tag holding a CGATS header - the in-file
 * testimony `iccCharacterization` reads. `charData` becomes FILE_DESCRIPTOR, the
 * field a press profile states its characterization data set in (`FOGRA51`).
 */
export const targTag = (charData: string, extra = ''): number[] => {
  const body = 'ISO28178\n'
    + 'ORIGINATOR\t"Synthetic, tests/helpers/icc-fixture.ts"\n'
    + `FILE_DESCRIPTOR\t"${charData}"\n`
    + 'CREATED\t"July 2026"\n'
    + extra;
  return [...ascii('text'), 0, 0, 0, 0, ...ascii(body), 0];
};

/**
 * A press profile the PDF/X embed path would accept: `prtr`, CMYK, four
 * channels, both directions present, a `desc`, and optionally the `targ` tag that
 * pairs it with a named press condition.
 */
export const pressProfileBytes = (opts: {
  desc?: string; charData?: string | null;
  space?: string; deviceClass?: string; major?: number; bcd?: number;
} = {}): Uint8Array => buildProfile({
  deviceClass: opts.deviceClass ?? 'prtr',
  space: opts.space ?? 'CMYK',
  major: opts.major,
  bcd: opts.bcd,
  tags: [
    ['desc', descTag(opts.desc ?? 'Synthetic Coated')],
    ['wtpt', xyzTag(0.9642, 1, 0.8249)],
    ['A2B0', mft2((opts.space ?? 'CMYK').trim() === 'RGB' ? 3 : 4, 3, [0x8000, 0x8080, 0x8080])],
    ['A2B1', mft2((opts.space ?? 'CMYK').trim() === 'RGB' ? 3 : 4, 3, [0x8000, 0x8080, 0x8080])],
    ['B2A1', mft2(3, (opts.space ?? 'CMYK').trim() === 'RGB' ? 3 : 4, new Array((opts.space ?? 'CMYK').trim() === 'RGB' ? 3 : 4).fill(0x4000))],
    ...(opts.charData ? [['targ', targTag(opts.charData)] as [string, number[]]] : []),
  ],
});
