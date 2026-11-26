// SPDX-License-Identifier: MPL-2.0
/**
 * The standard export password on the web shell's link route: which files can carry it,
 * and what it leaves behind. The panel gates its own controls; a link has no controls, so
 * a link that asks for a lock the file cannot hold is refused here, and no file is written.
 * packages/node-shell/src/export-lock.ts keeps the same rules for the Node shells.
 *
 * Nothing here ever repeats the password.
 */

/**
 * The standard PDF tier keys on PDFDocEncoded bytes, and readers disagree about how typed
 * text becomes those bytes outside ASCII. Cyrillic and CJK passwords produced a file nobody
 * could open, so the tier takes printable ASCII only.
 */
export function standardPdfPasswordIsTypable(password: string): boolean {
  return /^[\x20-\x7e]+$/.test(password);
}

/** A link's password cannot be honoured. The person who opened the link is told, not only the log. */
export class LinkPasswordRefused extends Error {}

/** Why a link cannot have the lock it asked for, or null when it can. */
export function linkPasswordRefusal(
  format: string,
  o: { password?: string | null; bleed?: unknown; marks?: unknown },
): string | null {
  const fmt = format.toLowerCase();
  if (fmt === 'pdf-cmyk') {
    return 'A password in a link cannot lock a "pdf-cmyk" export, so nothing was written. Ask for "pdf", or use the Strong lock in the export panel, which covers Print PDFs.';
  }
  if (fmt !== 'pdf' && fmt !== 'zip') {
    return `A "${fmt}" file cannot carry a password, so nothing was written. Ask for "pdf" or "zip", or leave the password out.`;
  }
  if (fmt === 'pdf' && (o.bleed || o.marks)) {
    return 'A password in a link cannot be combined with bleed or print marks on a "pdf", so nothing was written. Leave one out, or use the Strong lock in the export panel.';
  }
  if (fmt === 'pdf' && o.password && !standardPdfPasswordIsTypable(o.password)) {
    return 'A standard PDF password can use only plain ASCII letters, digits and punctuation, so nothing was written. Other characters give a file that readers cannot open. Choose an ASCII password, or use the Strong lock in the export panel.';
  }
  return null;
}

/** A query with its export password taken out. Every other value keeps its form. */
export function withoutLinkPassword(query: string): string {
  if (!/(?:^|[?&])password(?:=|&|$)/.test(query)) return query;
  const params = new URLSearchParams(query);
  params.delete('password');
  return params.toString();
}

/**
 * What the address holds once a link's password has been read. The one-shot `export` and
 * `copy` go with it: a reload of that address would otherwise write the same file again,
 * this time with no password.
 */
export function addressAfterLinkPassword(query: string): string {
  const params = new URLSearchParams(withoutLinkPassword(query));
  params.delete('export');
  params.delete('copy');
  return params.toString();
}
