// SPDX-License-Identifier: MPL-2.0
/**
 * The "what was checked" receipt - the verify view's completeness ledger,
 * pure model in (flags the view already holds), rows out. The negative space
 * made visible: every check that RAN, every check that COULD NOT run and why,
 * and the standing promise that nothing was fetched. An impossible check
 * stated plainly ("only Google holds SynthID's key") is itself guidance - the
 * app earns trust by naming its own limits.
 *
 * Every string is an ENGLISH SOURCE STRING for t(), same contract as
 * valid-text.ts's notices. The view owns rendering and escaping.
 */

export interface ReceiptCheck {
  name: string;
  status: 'ran' | 'blocked' | 'na';
  /** Why a check did not run - REQUIRED for 'blocked'/'na', absent for 'ran'. */
  why?: string;
}

export interface ReceiptInput {
  /** A raster/PDF format the Imprint detector can scan. */
  imprintScannable: boolean;
  /** SEAL byte-scan ran (it always does on the verify path). */
  sealScanned: boolean;
  /** A text analysis panel exists for this file. */
  textAnalysed: boolean;
  /** The analysed text came from pixels (OCR), not bytes. */
  pixelSourced: boolean;
  /** The file is one the read-the-text action could still analyse. */
  textReadable: boolean;
  /** The on-device OCR model is staged and loadable. */
  ocrReady: boolean;
  /** The reword pack (and so the reword-watermark check) is available. */
  rewordReady: boolean;
  /** The AI-text detector model is staged for this deploy. */
  detectorStaged: boolean;
}

export function verifyReceiptModel(i: ReceiptInput): ReceiptCheck[] {
  const rows: ReceiptCheck[] = [
    { name: 'Content Credentials (C2PA)', status: 'ran' },
    { name: 'Embedded metadata and maker fingerprints', status: 'ran' },
    { name: 'Hidden data and appended payloads', status: 'ran' },
    i.sealScanned
      ? { name: 'SEAL signature', status: 'ran' }
      : { name: 'SEAL signature', status: 'na', why: 'this format carries no SEAL record' },
    i.imprintScannable
      ? { name: 'Lolly Imprint (pixel watermark)', status: 'ran' }
      : { name: 'Lolly Imprint (pixel watermark)', status: 'na', why: 'this format cannot carry the Imprint' },
  ];

  if (i.textAnalysed) {
    rows.push({ name: 'Text analysis (style, boilerplate, census)', status: 'ran' });
    rows.push(i.pixelSourced
      ? { name: 'Hidden-character check', status: 'blocked', why: 'the text was read from pixels, so byte-level characters were lost before we saw them' }
      : { name: 'Hidden-character check', status: 'ran' });
    rows.push(i.rewordReady
      ? { name: 'Lolly reword watermark', status: 'ran' }
      : { name: 'Lolly reword watermark', status: 'blocked', why: 'the reword pack is not installed on this deploy' });
    rows.push(i.detectorStaged
      ? { name: 'On-device detector model', status: 'ran' }
      : { name: 'On-device detector model', status: 'blocked', why: 'no detector model is staged on this deploy' });
  } else if (i.textReadable) {
    rows.push({ name: 'Text analysis', status: 'na', why: 'not run yet - use the Read-the-text action above' });
    if (!i.ocrReady) rows.push({ name: 'Text recognition (OCR)', status: 'blocked', why: 'the text-recognition model is not installed' });
  } else {
    rows.push({ name: 'Text analysis', status: 'na', why: 'this file type carries no readable text' });
  }

  rows.push({
    name: 'Third-party AI watermarks (SynthID and similar)',
    status: 'blocked',
    why: 'only their makers hold the keys - no one else can read them; their declarations are surfaced when the file carries one',
  });
  return rows;
}

/** ran / blocked+na counts for the header line. */
export function receiptCounts(rows: readonly ReceiptCheck[]): { ran: number; not: number } {
  const ran = rows.filter((r) => r.status === 'ran').length;
  return { ran, not: rows.length - ran };
}
