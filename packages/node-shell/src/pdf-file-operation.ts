// SPDX-License-Identifier: MPL-2.0
/** DOM-free PDF utilities shared by UI and Node. Never silently invalidates signatures. */
import { PDFDocument, PDFDict, PDFName, PDFArray } from 'pdf-lib';
import { stripPdf } from './pdf.ts';
async function unsignedPdf(bytes: Uint8Array, signal?: AbortSignal): Promise<PDFDocument> {
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
  return document;
}

export async function runPdfFileOperation(bytes: Uint8Array, target: 'pdf-clean' | 'pdf-optimize', signal?: AbortSignal): Promise<Uint8Array> {
  const document = await unsignedPdf(bytes, signal);
  const output = target === 'pdf-clean' ? (await stripPdf(bytes)).bytes : await document.save({ useObjectStreams: true, addDefaultPage: false, updateFieldAppearances: false });
  signal?.throwIfAborted();
  // Optimization never returns a larger copy; no image quality is sacrificed.
  return target === 'pdf-optimize' && output.byteLength >= bytes.byteLength ? bytes : output;
}


/** Each page becomes an independent static PDF; interactive documents are refused. */
export async function splitPdfPages(bytes: Uint8Array, signal?: AbortSignal): Promise<Uint8Array[]> {
  const source = await unsignedPdf(bytes, signal);
  if (source.catalog.has(PDFName.of('AcroForm')) || source.catalog.has(PDFName.of('Names')) || source.catalog.has(PDFName.of('OpenAction')) || source.catalog.has(PDFName.of('AA'))) throw new Error('PDF splitting requires a static document without forms, attachments, named actions or scripts.');
  for (const page of source.getPages()) {
    const annotations = page.node.lookup(PDFName.of('Annots'));
    if ((annotations && (!(annotations instanceof PDFArray) || annotations.size() > 0)) || page.node.has(PDFName.of('AA'))) throw new Error('PDF splitting requires pages without annotations or actions. Use a static source.');
  }
  const results: Uint8Array[] = [];
  let total = 0;
  for (let index = 0; index < source.getPageCount(); index++) {
    signal?.throwIfAborted();
    const output = await PDFDocument.create();
    const [page] = await output.copyPages(source, [index]);
    output.addPage(page!);
    const result = await output.save({ useObjectStreams: true });
    total += result.byteLength;
    if (total > 128 * 1024 * 1024) throw new Error('Split PDF outputs exceed the 128 MB packaging limit.');
    results.push(result);
  }
  signal?.throwIfAborted();
  return results;
}
