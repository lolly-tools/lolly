// SPDX-License-Identifier: MPL-2.0
/** Builds TTC files from real sfnt fonts for the collection tests. */
import { readFileSync } from 'node:fs';

export interface SfntTable { tag: string; checksum: number; data: Uint8Array }
export interface SfntFace { version: number; tables: SfntTable[] }

export const OUTFIT = new Uint8Array(readFileSync(new URL('../../public/fonts/Outfit[wght].ttf', import.meta.url)));
export const NOTO_HEBREW = new Uint8Array(readFileSync(new URL('../../../../tests/fixtures/text-composition/fonts/notosanshebrew/NotoSansHebrew[wdth,wght].ttf', import.meta.url)));

export function sfntFace(font: Uint8Array): SfntFace {
  const view = new DataView(font.buffer, font.byteOffset, font.byteLength), tables: SfntTable[] = [];
  for (let i = 0; i < view.getUint16(4); i++) {
    const record = 12 + i * 16, offset = view.getUint32(record + 8);
    tables.push({ tag: String.fromCharCode(...font.subarray(record, record + 4)), checksum: view.getUint32(record + 4), data: font.subarray(offset, offset + view.getUint32(record + 12)) });
  }
  return { version: view.getUint32(0), tables };
}

/** A version 1 TTC. A table object listed by several faces is written once and shared, as real collections do. */
export function packCollection(faces: SfntFace[]): Uint8Array {
  const aligned = (n: number) => (n + 3) & ~3;
  let cursor = 12 + faces.length * 4;
  const directories = faces.map(face => { const at = cursor; cursor += 12 + face.tables.length * 16; return at; });
  const placed = new Map<Uint8Array, number>();
  for (const face of faces) for (const table of face.tables) if (!placed.has(table.data)) { cursor = aligned(cursor); placed.set(table.data, cursor); cursor += table.data.length; }
  const out = new Uint8Array(aligned(cursor)), view = new DataView(out.buffer);
  out.set([0x74, 0x74, 0x63, 0x66]); view.setUint16(4, 1); view.setUint32(8, faces.length);
  faces.forEach((face, i) => {
    const at = directories[i]!; view.setUint32(12 + i * 4, at); view.setUint32(at, face.version); view.setUint16(at + 4, face.tables.length);
    face.tables.forEach((table, j) => {
      const record = at + 12 + j * 16;
      for (let c = 0; c < 4; c++) out[record + c] = table.tag.charCodeAt(c);
      view.setUint32(record + 4, table.checksum); view.setUint32(record + 8, placed.get(table.data)!); view.setUint32(record + 12, table.data.length);
    });
  });
  for (const [data, at] of placed) out.set(data, at);
  return out;
}
