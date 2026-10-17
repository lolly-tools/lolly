// SPDX-License-Identifier: MPL-2.0
/**
 * Adobe Type 1 fonts arrive as PFA (ASCII) or PFB (binary segments). Browsers
 * and Lolly's font readers take only sfnt-based formats, so the viewer can
 * recognise a Type 1 file and show its cleartext header, but cannot draw its glyphs.
 * Only the cleartext part before `eexec` is read; the encrypted charstrings
 * are never touched.
 */

export interface Type1FontInfo {
  container: 'pfa' | 'pfb';
  fontName: string; familyName: string; fullName: string; weight: string; version: string; notice: string;
}

const CLEARTEXT_LIMIT = 64 * 1024;
const HEADER = /^%!(?:PS-AdobeFont|FontType1)-/;

function latin1(bytes: Uint8Array): string { return new TextDecoder('latin1').decode(bytes); }

/** 'pfa' or 'pfb' when the bytes open with a Type 1 header, otherwise null. */
export function type1Container(bytes: Uint8Array): 'pfa' | 'pfb' | null {
  if (bytes[0] === 0x80 && bytes[1] === 0x01 && bytes.length > 6) return HEADER.test(latin1(bytes.subarray(6, 32))) ? 'pfb' : null;
  return HEADER.test(latin1(bytes.subarray(0, 26))) ? 'pfa' : null;
}

function cleartext(bytes: Uint8Array, container: 'pfa' | 'pfb'): string {
  let text: string;
  if (container === 'pfb') {
    // The first PFB segment is ASCII: 0x80 0x01, a little-endian uint32 length, then the text.
    const length = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(2, true);
    text = latin1(bytes.subarray(6, 6 + Math.min(length, CLEARTEXT_LIMIT)));
  } else text = latin1(bytes.subarray(0, CLEARTEXT_LIMIT));
  const end = text.indexOf('eexec');
  return end < 0 ? text : text.slice(0, end);
}

/** A PostScript string literal after `/key`, with balanced parentheses and escapes. */
function stringValue(text: string, key: string): string {
  const match = new RegExp(`/${key}\\s*\\(`).exec(text);
  if (!match) return '';
  let depth = 1, out = '';
  for (let i = match.index + match[0].length; i < text.length && out.length < 256; i++) {
    const char = text[i]!;
    if (char === '\\') {
      const next = text[++i] ?? '';
      const octal = /^[0-7]{1,3}/.exec(text.slice(i, i + 3));
      if (octal) { out += String.fromCharCode(Number.parseInt(octal[0], 8) & 0xff); i += octal[0].length - 1; }
      else out += next === 'n' ? '\n' : next === 'r' ? '\r' : next === 't' ? '\t' : next;
      continue;
    }
    if (char === '(') depth++;
    else if (char === ')' && --depth === 0) break;
    out += char;
  }
  return out.replace(/\s+/g, ' ').trim();
}

/** The header fields a Type 1 font states about itself, or null when the bytes are not Type 1. */
export function readType1FontInfo(bytes: Uint8Array): Type1FontInfo | null {
  const container = type1Container(bytes);
  if (!container) return null;
  const text = cleartext(bytes, container);
  const fontName = /\/FontName\s*\/([^\s/[\]{}()<>%]{1,127})/.exec(text)?.[1]
    ?? /^%!(?:PS-AdobeFont|FontType1)-[\d.]+:\s*(\S{1,127})/.exec(text)?.[1] ?? '';
  return { container, fontName, familyName: stringValue(text, 'FamilyName'), fullName: stringValue(text, 'FullName'),
    weight: stringValue(text, 'Weight'), version: stringValue(text, 'version'), notice: stringValue(text, 'Notice') || stringValue(text, 'Copyright') };
}
