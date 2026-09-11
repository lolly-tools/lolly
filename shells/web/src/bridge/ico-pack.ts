// SPDX-License-Identifier: MPL-2.0

export interface IcoEntry {
  size: number;
  bytes: Uint8Array;
}

/** Pack PNG entries into an ICO container. */
export function packIco(entries: IcoEntry[]): Blob {
  const header = new Uint8Array(6 + entries.length * 16);
  const view = new DataView(header.buffer);
  view.setUint16(0, 0, true);
  view.setUint16(2, 1, true);
  view.setUint16(4, entries.length, true);
  let offset = header.length;

  entries.forEach((entry, index) => {
    const cursor = 6 + index * 16;
    header[cursor] = entry.size >= 256 ? 0 : entry.size;
    header[cursor + 1] = entry.size >= 256 ? 0 : entry.size;
    view.setUint16(cursor + 4, 1, true);
    view.setUint16(cursor + 6, 32, true);
    view.setUint32(cursor + 8, entry.bytes.length, true);
    view.setUint32(cursor + 12, offset, true);
    offset += entry.bytes.length;
  });

  const output = new Uint8Array(offset);
  output.set(header);
  let cursor = header.length;
  for (const entry of entries) {
    output.set(entry.bytes, cursor);
    cursor += entry.bytes.length;
  }
  return new Blob([output], { type: 'image/x-icon' });
}
