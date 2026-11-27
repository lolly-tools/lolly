// SPDX-License-Identifier: MPL-2.0
/**
 * A PDF the C2PA embedder can extend. The embedder keeps the original bytes as a prefix and
 * adds an incremental update, which needs a classic cross-reference table. A PDF saved with
 * object streams has a cross-reference stream instead, and that is what the browser tier
 * writes when it is told not to stamp.
 *
 * This saves such a file again with the same library and the same flag the web shell's own
 * finishing pass uses when it does stamp, so the objects are carried over and nothing is
 * drawn again. Metadata stays as it was. A PDF that already has a classic table, or that is
 * encrypted, comes back unchanged, and every other format is not looked at.
 */

/** Bytes as one character each, without a Node API, so the web shell can load this module too. */
function latin1(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]!);
  return out;
}

/** Where the last `startxref` points, or null when there is none. */
function lastCrossReference(pdf: Uint8Array): number | null {
  const tail = latin1(pdf.subarray(Math.max(0, pdf.length - 2048)));
  const found = [...tail.matchAll(/startxref\s+(\d+)/g)].at(-1);
  return found ? Number(found[1]) : null;
}

function hasClassicTable(pdf: Uint8Array): boolean {
  const at = lastCrossReference(pdf);
  if (at === null || at >= pdf.length) return true; // Not ours to judge: the embedder reports a broken file.
  return latin1(pdf.subarray(at, at + 16)).trimStart().startsWith('xref');
}

/** `pdf` ready for the embedder. Bytes of any other format pass straight through. */
export async function classicPdfForStamp(bytes: Uint8Array, format: string): Promise<Uint8Array> {
  if (!/^pdf/i.test(format) || hasClassicTable(bytes)) return bytes;
  const { PDFDocument } = await import('pdf-lib');
  try {
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    return await doc.save({ useObjectStreams: false, updateFieldAppearances: false });
  } catch {
    // An encrypted or unreadable file stays as it was, and the embedder says why.
    return bytes;
  }
}
