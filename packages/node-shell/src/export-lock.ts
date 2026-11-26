// SPDX-License-Identifier: MPL-2.0
/**
 * A requested export password, on every route a Node shell drives (MCP, CLI, TUI).
 *
 * Three rules, and this module is where they are kept:
 *  1. It is decided before anything renders whether the file asked for can carry the
 *     lock. A file that cannot is a refusal, never an unlocked file.
 *  2. The password reaches the web shell over a one-time browser binding. It never
 *     goes into an address, a request, a console line or a command line.
 *  3. The finished bytes are read back before anyone is told they are locked. A file
 *     that came back unlocked is an error, and it is not delivered.
 *
 * The messages name the format and the setting, never the password.
 */
import { createHash } from 'node:crypto';
import { hashR6, preparePassword } from '@lolly/engine';

/** The formats the standard password lock can be written into. */
const LOCKABLE_FORMATS: ReadonlySet<string> = new Set(['pdf', 'zip']);

/**
 * The standard PDF tier keys on PDFDocEncoded bytes, and readers disagree about how
 * typed text becomes those bytes outside ASCII. Cyrillic and CJK passwords produced a
 * file nobody could open, so the tier takes printable ASCII only.
 */
export function standardPdfPasswordIsTypable(password: string): boolean {
  return /^[\x20-\x7e]+$/.test(password);
}

/**
 * Why this export cannot carry the password it was asked for, or null when it can.
 * Shared by every Node shell so the words do not drift between them.
 */
export function exportPasswordRefusal(
  format: string,
  o: { password?: string | null; bleed?: unknown; marks?: unknown } = {},
): string | null {
  const fmt = String(format).toLowerCase();
  if (fmt === 'pdf-cmyk') {
    return 'A password cannot lock a "pdf-cmyk" export on this route, so nothing was written. '
      + 'Ask for "pdf", or use the Strong lock in the web export panel, which covers Print PDFs.';
  }
  if (!LOCKABLE_FORMATS.has(fmt)) {
    return `A "${fmt}" file cannot carry a password, so nothing was written. Ask for "pdf" or "zip", or leave the password out.`;
  }
  if (fmt === 'pdf' && (o.bleed || o.marks)) {
    return 'A password cannot be combined with bleed or print marks on a "pdf" here, so nothing was written. '
      + 'Leave one out, or use the Strong lock in the web export panel.';
  }
  if (fmt === 'pdf' && o.password && !standardPdfPasswordIsTypable(o.password)) {
    return 'A standard PDF password can use only plain ASCII letters, digits and punctuation, so nothing was written. '
      + 'Other characters give a file that readers cannot open. Choose an ASCII password, or use the Strong lock in the web export panel.';
  }
  return null;
}

/** What a finished file holds, read from its bytes. */
export interface ExportLockReading {
  /** Whether the file's own structure says it is encrypted. */
  locked: boolean;
  /** Whether the password opens the file. Null when this reader could not test that. */
  opens: boolean | null;
  /** The security handler in words, for the line a result prints. */
  scheme: string | null;
}

const PDF_PAD = Uint8Array.from([
  0x28, 0xbf, 0x4e, 0x5e, 0x4e, 0x75, 0x8a, 0x41, 0x64, 0x00, 0x4e, 0x56, 0xff, 0xfa, 0x01, 0x08,
  0x2e, 0x2e, 0x00, 0xb6, 0xd0, 0x68, 0x3e, 0x80, 0x2f, 0x0c, 0xa9, 0xfe, 0x64, 0x53, 0x69, 0x7a,
]);

function md5(...parts: Uint8Array[]): Uint8Array {
  const hash = createHash('md5');
  for (const part of parts) hash.update(part);
  return new Uint8Array(hash.digest());
}

function rc4(key: Uint8Array, data: Uint8Array): Uint8Array {
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

const sameBytes = (a: Uint8Array, b: Uint8Array): boolean => a.length === b.length && a.every((v, i) => v === b[i]);

/** Algorithm 6 of the PDF standard security handler at revision 2: does this password produce the file's /U? */
function revision2Opens(password: string, o: Uint8Array, u: Uint8Array, p: number, id: Uint8Array): boolean {
  const padded = new Uint8Array(32);
  const bytes = Buffer.from(password, 'latin1').subarray(0, 32);
  padded.set(bytes);
  padded.set(PDF_PAD.subarray(0, 32 - bytes.length), bytes.length);
  const permissions = new Uint8Array(4);
  new DataView(permissions.buffer).setInt32(0, p, true);
  return sameBytes(rc4(md5(padded, o.subarray(0, 32), permissions, id).subarray(0, 5), PDF_PAD), u.subarray(0, 32));
}

/** Algorithm 11 of ISO 32000-2: does this password produce the file's /U at revision 6? */
async function revision6Opens(password: string, u: Uint8Array): Promise<boolean> {
  const hash = await hashR6(preparePassword(password), u.subarray(32, 40));
  return sameBytes(hash, u.subarray(0, 32));
}

async function readPdfLock(bytes: Uint8Array, password: string): Promise<ExportLockReading> {
  const { PDFDocument, PDFDict, PDFName, PDFNumber, PDFArray, PDFHexString, PDFString } = await import('pdf-lib');
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false, throwOnInvalidObject: false });
  const dict = doc.context.lookup(doc.context.trailerInfo.Encrypt);
  if (!(dict instanceof PDFDict)) return { locked: false, opens: false, scheme: null };
  const number = (key: string): number | null => {
    const value = dict.lookup(PDFName.of(key));
    return value instanceof PDFNumber ? value.asNumber() : null;
  };
  const text = (key: string): Uint8Array | null => {
    const value = dict.lookup(PDFName.of(key));
    return value instanceof PDFHexString || value instanceof PDFString ? value.asBytes() : null;
  };
  const revision = number('R');
  const u = text('U');
  const o = text('O');
  const p = number('P');
  const ids = doc.context.lookup(doc.context.trailerInfo.ID);
  const first = ids instanceof PDFArray ? ids.lookup(0) : null;
  const id = first instanceof PDFHexString || first instanceof PDFString ? first.asBytes() : new Uint8Array(0);
  if (revision === 2 && u && o && p !== null) {
    try {
      return { locked: true, opens: revision2Opens(password, o, u, p, id), scheme: '40-bit RC4' };
    } catch {
      // A host that forbids MD5 (a FIPS build) cannot test this tier. Its structure still counts.
      return { locked: true, opens: null, scheme: '40-bit RC4' };
    }
  }
  if (revision === 6 && u) return { locked: true, opens: await revision6Opens(password, u), scheme: 'AES-256' };
  return { locked: true, opens: null, scheme: revision === null ? 'an unknown handler' : `revision ${revision}` };
}

/** Whether every member of a zip is flagged encrypted, walking its central directory. */
function zipEveryEntryEncrypted(bytes: Uint8Array): boolean {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65_535); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { end = i; break; }
  }
  if (end < 0) return false;
  const count = view.getUint16(end + 10, true);
  if (count === 0) return false;
  let at = view.getUint32(end + 16, true);
  for (let n = 0; n < count; n++) {
    if (at + 46 > bytes.length || view.getUint32(at, true) !== 0x02014b50) return false;
    if ((view.getUint16(at + 8, true) & 1) === 0) return false;
    at += 46 + view.getUint16(at + 28, true) + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
  }
  return true;
}

/** Read what a finished file holds. Bytes that are neither a PDF nor a zip are not locked. */
export async function readExportLock(bytes: Uint8Array, password: string): Promise<ExportLockReading> {
  const head = Buffer.from(bytes.subarray(0, 1024)).toString('latin1');
  if (head.includes('%PDF-')) return readPdfLock(bytes, password);
  if (head.startsWith('PK')) {
    return { locked: zipEveryEntryEncrypted(bytes), opens: null, scheme: 'ZIP encryption' };
  }
  return { locked: false, opens: false, scheme: null };
}

/**
 * The last check before a locked file is handed over. It throws when the bytes are not
 * what the caller is about to say they are, so an unlocked file is never delivered.
 */
export async function assertExportLocked(bytes: Uint8Array, format: string, password: string): Promise<ExportLockReading> {
  let reading: ExportLockReading;
  try {
    reading = await readExportLock(bytes, password);
  } catch {
    throw new Error(`The "${format}" could not be read back to confirm its password, so it was not delivered.`);
  }
  if (!reading.locked) throw new Error(`The "${format}" came back without its password, so it was not delivered.`);
  if (reading.opens === false) throw new Error(`The "${format}" came back locked with a different password, so it was not delivered.`);
  return reading;
}

type ExportSecretContext = Pick<import('playwright-core').BrowserContext, 'exposeBinding'>;

/**
 * Publish an export password as a one-shot browser-context RPC. It never enters
 * navigation, request headers, console output, or an init-script literal. The binding
 * exists only when a password was asked for, so the web shell reads its presence as
 * that request, and refuses to write a file when the password does not arrive.
 */
export async function exposeExportPassword(
  context: ExportSecretContext,
  password: string | undefined,
): Promise<() => void> {
  let held = password || undefined;
  if (!held) return () => {};
  await context.exposeBinding('__lollyTakeExportSecret', (_source, kind: unknown) => {
    if (kind !== 'pdf-password') return null;
    const value = held ?? null;
    held = undefined;
    return value;
  });
  return () => { held = undefined; };
}
