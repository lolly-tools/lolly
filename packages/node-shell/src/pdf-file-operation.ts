// SPDX-License-Identifier: MPL-2.0
/** DOM-free PDF utilities shared by UI and Node. Never silently invalidates signatures. */
import { PDFDocument, PDFDict, PDFName, PDFArray } from 'pdf-lib';
import { stripPdf } from './pdf.ts';
export async function runPdfFileOperation(bytes: Uint8Array, target: 'pdf-clean' | 'pdf-optimize', signal?: AbortSignal): Promise<Uint8Array> {
  if (bytes.byteLength > 128 * 1024 * 1024) throw new Error('PDF utilities support files up to 128 MB.');
  signal?.throwIfAborted();
  // Default encryption handling REFUSES password-protected documents. A parser's
  // ignoreEncryption escape hatch is not authority to rewrite a protected file.
  const document = await PDFDocument.load(bytes, { updateMetadata: false });
  if (document.getPageCount() > 200) throw new Error('These PDF utilities support up to 200 pages. Split the document first.');
  const seen = new Set<unknown>(); let visited = 0;
  const inspect = (object: unknown, depth = 0): void => {
    if (seen.has(object)) return;
    seen.add(object);
    if (++visited > 500_000 || depth > 32) throw new Error('PDF structure exceeds the safe inspection limit.');
    if (object instanceof PDFDict) {
      if (object.has(PDFName.of('ByteRange')) || object.get(PDFName.of('Type')) === PDFName.of('Sig')) throw new Error('This PDF carries a digital signature. Rewriting would invalidate it; use an unsigned source.');
      for (const [, value] of object.entries()) inspect(value, depth + 1);
    } else if (object instanceof PDFArray) for (const value of object.asArray()) inspect(value, depth + 1);
  };
  for (const [, object] of document.context.enumerateIndirectObjects()) inspect(object);
  signal?.throwIfAborted();
  const output = target === 'pdf-clean' ? (await stripPdf(bytes)).bytes : await document.save({ useObjectStreams: true, addDefaultPage: false, updateFieldAppearances: false });
  signal?.throwIfAborted();
  // Optimization never returns a larger copy; no image quality is sacrificed.
  return target === 'pdf-optimize' && output.byteLength >= bytes.byteLength ? bytes : output;
}
