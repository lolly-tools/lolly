// SPDX-License-Identifier: MPL-2.0
/**
 * Three small files for the findings tests of the CLI, the TUI and MCP: one signed by
 * another tool, one with nothing in it, and one whose metadata states a licence and a
 * place. Built from bytes here, so each shell's test reads the same three files.
 */
import { readFileSync } from 'node:fs';

/** The labels the six findings print under, in the engine's fixed order. */
export const FINDING_LABELS_IN_ORDER = ['Credential', 'Made with', 'AI', 'Licence', 'Personal data', 'Hidden content'] as const;

/** A 16x16 PNG that c2patool signed. See tests/c2pa-foreign-fixture.test.ts for how it was made. */
export const SIGNED_PNG_PATH = new URL('../fixtures/c2patool-signed.png', import.meta.url).pathname;
export const signedPng = (): Uint8Array => new Uint8Array(readFileSync(SIGNED_PNG_PATH));

function concat(parts: Uint8Array[]): Uint8Array {
  let n = 0; for (const p of parts) n += p.length;
  const out = new Uint8Array(n); let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

function app1(id: Uint8Array, payload: Uint8Array): Uint8Array {
  const len = 2 + id.length + payload.length;
  return concat([Uint8Array.from([0xFF, 0xE1, (len >> 8) & 0xFF, len & 0xFF]), id, payload]);
}

const SOI = Uint8Array.from([0xFF, 0xD8]);
const JFIF = Uint8Array.from([0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]);
const SCAN = Uint8Array.from([0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 0x00, 0xAA, 0xBB, 0xFF, 0xD9]);

/** A little-endian TIFF: IFD0 {Make, GPS pointer}, then a GPS IFD at 37°48'30"N 122°25'W. */
function gpsTiff(): Uint8Array {
  const buf = new Uint8Array(148);
  const dv = new DataView(buf.buffer);
  const LE = true;
  const MAKE_OFF = 38, GPS_IFD = 46, LAT_OFF = 100, LON_OFF = 124;
  buf[0] = 0x49; buf[1] = 0x49;
  dv.setUint16(2, 42, LE);
  dv.setUint32(4, 8, LE);
  dv.setUint16(8, 2, LE);
  const entry = (off: number, tag: number, type: number, count: number): void => {
    dv.setUint16(off, tag, LE); dv.setUint16(off + 2, type, LE); dv.setUint32(off + 4, count, LE);
  };
  entry(10, 0x010F, 2, 8); dv.setUint32(18, MAKE_OFF, LE);
  entry(22, 0x8825, 4, 1); dv.setUint32(30, GPS_IFD, LE);
  dv.setUint32(34, 0, LE);
  'TestCam'.split('').forEach((c, i) => { buf[MAKE_OFF + i] = c.charCodeAt(0); });
  dv.setUint16(GPS_IFD, 4, LE);
  entry(48, 0x0001, 2, 2); buf[56] = 0x4E;
  entry(60, 0x0002, 5, 3); dv.setUint32(68, LAT_OFF, LE);
  entry(72, 0x0003, 2, 2); buf[80] = 0x57;
  entry(84, 0x0004, 5, 3); dv.setUint32(92, LON_OFF, LE);
  dv.setUint32(96, 0, LE);
  const rat = (off: number, n: number, d: number): void => { dv.setUint32(off, n, LE); dv.setUint32(off + 4, d, LE); };
  rat(LAT_OFF, 37, 1); rat(LAT_OFF + 8, 48, 1); rat(LAT_OFF + 16, 30, 1);
  rat(LON_OFF, 122, 1); rat(LON_OFF + 8, 25, 1); rat(LON_OFF + 16, 0, 1);
  return buf;
}

const XMP_LICENCE =
  '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">' +
  '<rdf:Description xmlns:dc="http://purl.org/dc/elements/1.1/">' +
  '<dc:rights><rdf:Alt><rdf:li xml:lang="x-default">https://creativecommons.org/licenses/by/4.0/</rdf:li></rdf:Alt></dc:rights>' +
  '</rdf:Description></rdf:RDF></x:xmpmeta>';

/** A JPEG with no credential and no metadata. */
export function plainJpeg(): Uint8Array {
  return concat([SOI, JFIF, SCAN]);
}

/** A JPEG whose EXIF records a GPS fix and whose XMP states CC BY 4.0. No credential. */
export function licensedLocatedJpeg(): Uint8Array {
  const enc = new TextEncoder();
  return concat([
    SOI, JFIF,
    app1(Uint8Array.from([0x45, 0x78, 0x69, 0x66, 0x00, 0x00]), gpsTiff()),
    app1(enc.encode('http://ns.adobe.com/xap/1.0/\0'), enc.encode(XMP_LICENCE)),
    SCAN,
  ]);
}

/** Where each of the six labels starts in a block of text, asserting all six are there and in order. */
export function labelPositions(text: string): number[] {
  const at: number[] = [];
  let from = 0;
  for (const label of FINDING_LABELS_IN_ORDER) {
    const i = text.indexOf(`${label}: `, from);
    if (i === -1) throw new Error(`"${label}: " is missing, or out of order, in:\n${text}`);
    at.push(i);
    from = i + label.length;
  }
  return at;
}
