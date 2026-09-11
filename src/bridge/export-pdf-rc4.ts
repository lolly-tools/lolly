// SPDX-License-Identifier: MPL-2.0
/**
 * The standard (weak) PDF password tier: 40-bit RC4, revision 2 of the PDF
 * standard security handler.
 *
 * Two tiers ship, and they are a product choice, not an accident: "standard"
 * opens in every reader ever made and protects little, "strong" is AES-256 (R6,
 * export.ts encryptPdfStrong) and needs a modern one. This module owns the weak
 * tier, which the previous PDF library used to build into the document as it was
 * written. Here it is a final pass over finished bytes instead, the same shape as
 * the AES-256 pass: load with pdf-lib, encrypt every string and stream body with
 * a per-object RC4 key, attach the /Encrypt dictionary, save.
 *
 * Never fed to a document that still has finishing passes to run - pdf-lib cannot
 * reopen an encrypted file - so the caller gates on the same "no print geometry"
 * condition it always did.
 */

// Types only, under aliases, so the runtime names the walk below destructures out
// of the lazy pdf-lib import stay the plain ones.
import type {
  PDFHexString as PdfHexStringType,
  PDFObject as PdfObjectType,
  PDFString as PdfStringType,
} from 'pdf-lib';

/** The 32-byte pad from the PDF specification, algorithm 2 step (a). */
const PAD = Uint8Array.from([
  0x28, 0xbf, 0x4e, 0x5e, 0x4e, 0x75, 0x8a, 0x41, 0x64, 0x00, 0x4e, 0x56, 0xff, 0xfa, 0x01, 0x08,
  0x2e, 0x2e, 0x00, 0xb6, 0xd0, 0x68, 0x3e, 0x80, 0x2f, 0x0c, 0xa9, 0xfe, 0x64, 0x53, 0x69, 0x7a,
]);

/** Permission bit values, PDF specification table 22 (revision 2 subset). */
const PERMISSION_BITS: Record<string, number> = { print: 4, modify: 8, copy: 16, 'annot-forms': 32 };

/** Password bytes padded or truncated to the 32 the handler hashes. */
function padPassword(pw: string): Uint8Array {
  const out = new Uint8Array(32);
  let i = 0;
  for (; i < 32 && i < pw.length; i++) out[i] = pw.charCodeAt(i) & 0xff;
  out.set(PAD.subarray(0, 32 - i), i);
  return out;
}

export function rc4(key: Uint8Array, data: Uint8Array): Uint8Array {
  const s = new Uint8Array(256);
  for (let i = 0; i < 256; i++) s[i] = i;
  for (let i = 0, j = 0; i < 256; i++) {
    j = (j + s[i]! + key[i % key.length]!) & 0xff;
    const t = s[i]!; s[i] = s[j]!; s[j] = t;
  }
  const out = new Uint8Array(data.length);
  for (let n = 0, i = 0, j = 0; n < data.length; n++) {
    i = (i + 1) & 0xff;
    j = (j + s[i]!) & 0xff;
    const t = s[i]!; s[i] = s[j]!; s[j] = t;
    out[n] = data[n]! ^ s[(s[i]! + s[j]!) & 0xff]!;
  }
  return out;
}

const S = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
];
const K = new Int32Array(64);
for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296);

/** MD5, as the security handler specifies it. Not used for anything else. */
export function md5(input: Uint8Array): Uint8Array {
  const len = input.length;
  const withPad = ((len + 8) >> 6) + 1;
  const msg = new Uint8Array(withPad * 64);
  msg.set(input);
  msg[len] = 0x80;
  const dv = new DataView(msg.buffer);
  dv.setUint32(withPad * 64 - 8, (len << 3) >>> 0, true);
  dv.setUint32(withPad * 64 - 4, Math.floor(len / 536870912), true);

  let a0 = 0x67452301 | 0, b0 = 0xefcdab89 | 0, c0 = 0x98badcfe | 0, d0 = 0x10325476 | 0;
  const m = new Int32Array(16);
  for (let chunk = 0; chunk < withPad; chunk++) {
    for (let i = 0; i < 16; i++) m[i] = dv.getInt32(chunk * 64 + i * 4, true);
    let a = a0, b = b0, c = c0, d = d0;
    for (let i = 0; i < 64; i++) {
      let f: number;
      let g: number;
      if (i < 16) { f = (b & c) | (~b & d); g = i; }
      else if (i < 32) { f = (d & b) | (~d & c); g = (5 * i + 1) & 15; }
      else if (i < 48) { f = b ^ c ^ d; g = (3 * i + 5) & 15; }
      else { f = c ^ (b | ~d); g = (7 * i) & 15; }
      const tmp = d;
      d = c;
      c = b;
      const x = (a + f + K[i]! + m[g]!) | 0;
      const s = S[i]!;
      b = (b + ((x << s) | (x >>> (32 - s)))) | 0;
      a = tmp;
    }
    a0 = (a0 + a) | 0; b0 = (b0 + b) | 0; c0 = (c0 + c) | 0; d0 = (d0 + d) | 0;
  }
  const out = new Uint8Array(16);
  const odv = new DataView(out.buffer);
  odv.setInt32(0, a0, true);
  odv.setInt32(4, b0, true);
  odv.setInt32(8, c0, true);
  odv.setInt32(12, d0, true);
  return out;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  let n = 0;
  for (const p of parts) n += p.length;
  const out = new Uint8Array(n);
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

function hexUpper(b: Uint8Array): string {
  let s = '';
  for (const x of b) s += x.toString(16).padStart(2, '0');
  return s.toUpperCase();
}

export interface Rc4Security {
  /** Owner entry, 32 bytes. */
  O: Uint8Array;
  /** User entry, 32 bytes. */
  U: Uint8Array;
  /** Permission flags as the signed 32-bit value written to /P. */
  P: number;
  /** The 5-byte document key every per-object key is derived from. */
  fileKey: Uint8Array;
}

/**
 * Algorithms 2, 3 and 4 of the standard security handler at revision 2: the
 * owner entry, the document key, and the user entry. `id` is the first element
 * of the trailer /ID, which must be the one actually written to the file.
 */
export function buildRc4Security(userPw: string, ownerPw: string, permissions: string[], id: Uint8Array): Rc4Security {
  let protection = 192;                              // reserved high bits, always set
  for (const perm of permissions) protection += PERMISSION_BITS[perm] ?? 0;
  const P = -((protection ^ 255) + 1);

  const paddedUser = padPassword(userPw);
  const paddedOwner = padPassword(ownerPw || userPw);
  const O = rc4(md5(paddedOwner).subarray(0, 5), paddedUser);

  const pBytes = new Uint8Array(4);
  new DataView(pBytes.buffer).setInt32(0, P, true);
  const fileKey = md5(concat(paddedUser, O, pBytes, id)).subarray(0, 5);
  return { O, U: rc4(fileKey, PAD), P, fileKey };
}

/** The per-object RC4 key: document key + object and generation number, hashed. */
export function objectKey(fileKey: Uint8Array, objectNumber: number, generation: number): Uint8Array {
  const extra = Uint8Array.from([
    objectNumber & 0xff, (objectNumber >> 8) & 0xff, (objectNumber >> 16) & 0xff,
    generation & 0xff, (generation >> 8) & 0xff,
  ]);
  return md5(concat(fileKey, extra)).subarray(0, 10);
}

/**
 * Lock finished PDF bytes on open with the standard handler. The same value is
 * used for the user and owner password, which is what the export panel collects;
 * `permissions` is the list a reader should still allow (printing, by default).
 */
export async function encryptPdfRc4(bytes: Uint8Array, password: string, permissions: string[] = ['print']): Promise<Uint8Array> {
  const { PDFDocument, PDFString, PDFHexString, PDFRawStream, PDFStream, PDFDict, PDFArray } =
    await import('pdf-lib');
  // updateMetadata:false for the same reason the AES-256 pass sets it: the bytes
  // already carry Lolly's Info values, and pdf-lib would replace them with its own.
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const ctx = doc.context;

  const id = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const sec = buildRc4Security(password, password, permissions, id);

  const encStr = (o: PdfStringType | PdfHexStringType, key: Uint8Array): PdfHexStringType =>
    PDFHexString.of(hexUpper(rc4(key, o.asBytes())));
  const walk = (c: PdfObjectType, key: Uint8Array): void => {
    if (c instanceof PDFDict) {
      for (const [k, v] of c.entries()) {
        if (v instanceof PDFString || v instanceof PDFHexString) c.set(k, encStr(v, key));
        else if (v instanceof PDFDict || v instanceof PDFArray) walk(v, key);
      }
    } else if (c instanceof PDFArray) {
      for (let i = 0; i < c.size(); i++) {
        const v = c.get(i);
        if (v instanceof PDFString || v instanceof PDFHexString) c.set(i, encStr(v, key));
        else if (v instanceof PDFDict || v instanceof PDFArray) walk(v, key);
      }
    }
  };
  for (const [ref, obj] of ctx.enumerateIndirectObjects()) {
    const key = objectKey(sec.fileKey, ref.objectNumber, ref.generationNumber);
    if (obj instanceof PDFStream) {
      const ct = rc4(key, new Uint8Array(obj.getContents()));
      walk(obj.dict, key);
      ctx.assign(ref, PDFRawStream.of(obj.dict, ct));
    } else if (obj instanceof PDFDict || obj instanceof PDFArray) {
      walk(obj, key);
    } else if (obj instanceof PDFString || obj instanceof PDFHexString) {
      ctx.assign(ref, encStr(obj, key));
    }
  }

  // The /Encrypt dictionary is registered after the walk, so its own strings stay
  // in the clear - the reader needs them to derive the key in the first place.
  const encDict = ctx.obj({
    Filter: 'Standard', V: 1, R: 2, P: sec.P,
    O: PDFHexString.of(hexUpper(sec.O)),
    U: PDFHexString.of(hexUpper(sec.U)),
  });
  const idArr = PDFArray.withContext(ctx);
  idArr.push(PDFHexString.of(hexUpper(id)));
  idArr.push(PDFHexString.of(hexUpper(id)));
  ctx.trailerInfo.Encrypt = ctx.register(encDict);
  ctx.trailerInfo.ID = idArr;
  // A classic cross-reference table: every indirect object is encrypted uniformly,
  // with nothing packed into an object stream that would have to be exempt.
  return doc.save({ useObjectStreams: false });
}
