// SPDX-License-Identifier: MPL-2.0
/** Small original bitmap alphabet. Output remains plain ASCII text. */
const GLYPHS: Record<string, string> = {
  A: '01110/10001/10001/11111/10001/10001/10001',
  B: '11110/10001/10001/11110/10001/10001/11110',
  C: '01111/10000/10000/10000/10000/10000/01111',
  D: '11110/10001/10001/10001/10001/10001/11110',
  E: '11111/10000/10000/11110/10000/10000/11111',
  F: '11111/10000/10000/11110/10000/10000/10000',
  G: '01111/10000/10000/10111/10001/10001/01111',
  H: '10001/10001/10001/11111/10001/10001/10001',
  I: '11111/00100/00100/00100/00100/00100/11111',
  J: '00111/00010/00010/00010/10010/10010/01100',
  K: '10001/10010/10100/11000/10100/10010/10001',
  L: '10000/10000/10000/10000/10000/10000/11111',
  M: '10001/11011/10101/10101/10001/10001/10001',
  N: '10001/11001/10101/10011/10001/10001/10001',
  O: '01110/10001/10001/10001/10001/10001/01110',
  P: '11110/10001/10001/11110/10000/10000/10000',
  Q: '01110/10001/10001/10001/10101/10010/01101',
  R: '11110/10001/10001/11110/10100/10010/10001',
  S: '01111/10000/10000/01110/00001/00001/11110',
  T: '11111/00100/00100/00100/00100/00100/00100',
  U: '10001/10001/10001/10001/10001/10001/01110',
  V: '10001/10001/10001/10001/10001/01010/00100',
  W: '10001/10001/10001/10101/10101/11011/10001',
  X: '10001/10001/01010/00100/01010/10001/10001',
  Y: '10001/10001/01010/00100/00100/00100/00100',
  Z: '11111/00001/00010/00100/01000/10000/11111',
  '0': '01110/10001/10011/10101/11001/10001/01110',
  '1': '00100/01100/00100/00100/00100/00100/01110',
  '2': '01110/10001/00001/00010/00100/01000/11111',
  '3': '11110/00001/00001/01110/00001/00001/11110',
  '4': '00010/00110/01010/10010/11111/00010/00010',
  '5': '11111/10000/10000/11110/00001/00001/11110',
  '6': '01110/10000/10000/11110/10001/10001/01110',
  '7': '11111/00001/00010/00100/01000/01000/01000',
  '8': '01110/10001/10001/01110/10001/10001/01110',
  '9': '01110/10001/10001/01111/00001/00001/01110',
  ' ': '000/000/000/000/000/000/000',
  '.': '00/00/00/00/00/11/11',
  ',': '00/00/00/00/01/01/10',
  '!': '1/1/1/1/1/0/1',
  '?': '01110/10001/00001/00010/00100/00000/00100',
  '-': '00000/00000/00000/11111/00000/00000/00000',
  _: '00000/00000/00000/00000/00000/00000/11111',
  ':': '0/1/0/0/1/0/0',
  '/': '00001/00001/00010/00100/01000/10000/10000',
  '+': '00000/00100/00100/11111/00100/00100/00000',
  '=': '00000/00000/11111/00000/11111/00000/00000',
};
export function textAscii(
  text: string,
  opts: { style?: string; ink?: string; spacing?: number; width?: number; align?: string } = {}
): string {
  if (text.length > 300) throw new Error('Use 300 characters or fewer for an ASCII banner.');
  if (/[^\x20-\x7e\r\n]/.test(text))
    throw new Error(
      'This banner alphabet supports ASCII letters, numbers, spaces, and basic punctuation.'
    );
  const source = text.toUpperCase().replace(/\r\n?/g, '\n');
  const missing = [...new Set([...source].filter((c) => c !== '\n' && !GLYPHS[c]))];
  if (missing.length)
    throw new Error(`This banner alphabet has no lettering for: ${missing.join(' ')}`);
  const ink = opts.ink || '#';
  if (!/^[!-~]$/.test(ink)) throw new Error('Choose one visible ASCII character for the ink.');
  const scale = opts.style === 'block' ? 2 : 1;
  const gap = ' '.repeat(Math.min(8, Math.max(0, Math.trunc(opts.spacing ?? 1))));
  const width = Math.min(500, Math.max(0, Math.trunc(opts.width ?? 0)));
  const blocks: string[] = [];
  for (const line of source.split('\n')) {
    const glyphs = [...line].map((c) => GLYPHS[c]!.split('/'));
    const rows = Array.from({ length: 7 }, (_, row) => {
      const indent = opts.style === 'slant' ? ' '.repeat(6 - row) : '';
      return (
        indent +
        glyphs
          .map((g) => [...g[row]!].map((v) => (v === '1' ? ink : ' ').repeat(scale)).join(''))
          .join(gap)
      );
    });
    const used = Math.max(0, ...rows.map((r) => r.length));
    if (width && used > width)
      throw new Error(`This banner needs ${used} columns. Increase the width or use shorter text.`);
    blocks.push(
      rows
        .map((r) => {
          const pad = Math.max(0, width - used);
          return (
            ' '.repeat(
              opts.align === 'right' ? pad : opts.align === 'center' ? Math.floor(pad / 2) : 0
            ) + r
          );
        })
        .join('\n')
    );
  }
  return blocks.join('\n\n');
}
