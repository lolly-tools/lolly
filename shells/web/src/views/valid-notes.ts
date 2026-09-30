// SPDX-License-Identifier: MPL-2.0
import { tRaw } from '../i18n.ts';
import { escape as escapeText } from '../utils.ts';
import { scannedUnreadNote, type DocReadNotes } from './doc-read.ts';

/** Readback limitations shared by Verify document reports. */
export function docReadNotesHtml(notes: DocReadNotes): string {
    const bits: string[] = [];
    if (notes.pagesRead < notes.pageCount) bits.push(tRaw('The first {n} of {total} pages were read.', { n: notes.pagesRead, total: notes.pageCount }));
    if (notes.ocrPages > 0) bits.push(tRaw('{n} scanned pages were read with on-device text recognition, so hidden-character checks could not run on those pages.', { n: notes.ocrPages }));
    if (notes.scannedUnread > 0) bits.push(scannedUnreadNote(notes));
    return bits.map((b) => `<p class="valid-tsig-cands">${escapeText(b)}</p>`).join('');
  }

