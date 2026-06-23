/**
 * PDF capability (host.pdf) — metadata inspection + removal, backed by pdf-lib.
 *
 * Unlike the JPEG/PNG/SVG strippers (dependency-free byte/text surgery that runs
 * inside the sandboxed tool hook), a PDF is a cross-referenced object graph with
 * an xref table and compressed object streams — you can't excise a metadata
 * object without rewriting offsets. So the work lives here in the shell, where a
 * real PDF library is available, and the tool reaches it through `host.pdf`.
 *
 * IMPORTANT: this RE-SAVES the document (pdf-lib re-serialises), so the result is
 * not byte-for-byte and any digital signature is invalidated — the tool's UI says
 * so. Everything runs locally in the browser; nothing is uploaded.
 *
 * pdf-lib is loaded on demand (dynamic import) so it never adds to startup cost —
 * only the first PDF a user opens pulls it in.
 */

const PDF_LOAD_OPTS = { ignoreEncryption: true, updateMetadata: false };

// Info-dictionary keys we report + remove. These are the standard document-info
// entries; PDF/X and tooling sometimes add more, but these cover the leaks.
const INFO_FIELDS = [
  { key: 'Author', label: 'Author', tone: 'warn', get: (d) => d.getAuthor() },
  { key: 'Creator', label: 'Created with', tone: 'warn', get: (d) => d.getCreator() },   // authoring app
  { key: 'Producer', label: 'PDF producer', tone: 'warn', get: (d) => d.getProducer() }, // producing app/lib
  { key: 'Title', label: 'Title', tone: '', get: (d) => d.getTitle() },
  { key: 'Subject', label: 'Subject', tone: '', get: (d) => d.getSubject() },
  { key: 'Keywords', label: 'Keywords', tone: '', get: (d) => d.getKeywords() },
];

function isoDate(d) {
  try { return d instanceof Date && !isNaN(d) ? d.toISOString().slice(0, 10) : null; }
  catch { return null; }
}

// Read the catalog's XMP metadata stream as text, if present. Best-effort: the
// stream is usually an uncompressed XML packet; if it's compressed/odd we still
// detect its presence, we just can't quote from it.
function readXmpText(doc, PDFName) {
  const ref = doc.catalog.get(PDFName.of('Metadata'));
  if (!ref) return null;
  let stream;
  try { stream = doc.context.lookup(ref); } catch { return ''; }
  if (!stream) return '';
  try {
    const bytes = typeof stream.getContents === 'function' ? stream.getContents() : stream.contents;
    return bytes ? new TextDecoder('utf-8').decode(bytes) : '';
  } catch { return ''; }
}

const xmpField = (xmp, re) => { const m = re.exec(xmp); return m ? m[1].replace(/\s+/g, ' ').trim() : null; };

export async function analyzePdf(bytes) {
  const { PDFDocument, PDFName } = await import('pdf-lib');
  const doc = await PDFDocument.load(bytes, PDF_LOAD_OPTS);
  const findings = [];
  const add = (label, detail, tone = '') => {
    const d = detail == null ? '' : String(detail).trim();
    if (d) findings.push({ label, detail: d, tone });
  };

  for (const f of INFO_FIELDS) {
    let v;
    try { v = f.get(doc); } catch { v = null; }
    add(f.label, Array.isArray(v) ? v.join(', ') : v, f.tone);
  }
  try { add('Created', isoDate(doc.getCreationDate())); } catch { /* malformed date */ }
  try { add('Modified', isoDate(doc.getModificationDate())); } catch { /* malformed date */ }

  const xmp = readXmpText(doc, PDFName);
  if (xmp != null) {
    const who = xmpField(xmp, /<dc:creator>[\s\S]*?<rdf:li[^>]*>([\s\S]*?)<\/rdf:li>/i)
      || xmpField(xmp, /<xmp:CreatorTool>([\s\S]*?)<\/xmp:CreatorTool>/i);
    add('XMP metadata', who ? `XMP packet — ${who}` : 'embedded XMP packet', 'warn');
  }
  return { findings };
}

export async function stripPdf(bytes) {
  const { PDFDocument, PDFName } = await import('pdf-lib');
  const doc = await PDFDocument.load(bytes, PDF_LOAD_OPTS);

  // Remove every entry in the Info dictionary (Author, Producer, dates, …).
  const infoRef = doc.context.trailerInfo && doc.context.trailerInfo.Info;
  if (infoRef) {
    let info;
    try { info = doc.context.lookup(infoRef); } catch { info = null; }
    if (info && typeof info.keys === 'function' && typeof info.delete === 'function') {
      for (const key of [...info.keys()]) info.delete(key);
    }
  }
  // Remove the XMP metadata stream from the document catalog.
  try { doc.catalog.delete(PDFName.of('Metadata')); } catch { /* none present */ }

  const out = await doc.save({ updateFieldAppearances: false });
  return { bytes: out };
}

export function createPdfAPI() {
  return {
    analyze: (bytes) => analyzePdf(bytes),
    strip: (bytes) => stripPdf(bytes),
  };
}
