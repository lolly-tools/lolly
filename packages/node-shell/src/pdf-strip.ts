// SPDX-License-Identifier: MPL-2.0
/** Remove metadata links and retain only objects reachable from the document root. */
import { PDFArray, PDFDict, PDFName, PDFRef, PDFStream } from 'pdf-lib';
import type { PDFDocument, PDFObject } from 'pdf-lib';

export function removePdfMetadata(document: PDFDocument): void {
  const context = document.context;
  context.trailerInfo.Info = undefined;
  context.trailerInfo.ID = undefined;
  const seen = new Set<PDFObject>(), reachable = new Set<string>();
  const pending: PDFObject[] = [context.trailerInfo.Root!];
  while (pending.length) {
    const object = pending.pop()!;
    if (seen.has(object)) continue;
    seen.add(object);
    if (seen.size > 500_000) throw new Error('PDF metadata cleaning exceeds the supported object limit.');
    if (object instanceof PDFRef) {
      reachable.add(object.toString());
      const target = context.lookup(object);
      if (!target) throw new Error('PDF metadata cleaning found an unresolved document reference.');
      pending.push(target);
    } else if (object instanceof PDFStream) pending.push(object.dict);
    else if (object instanceof PDFDict) {
      object.delete(PDFName.of('Metadata'));
      for (const [, value] of object.entries()) pending.push(value);
    } else if (object instanceof PDFArray) for (const value of object.asArray()) pending.push(value);
  }
  for (const [reference] of context.enumerateIndirectObjects()) {
    if (!reachable.has(reference.toString())) context.delete(reference);
  }
}
