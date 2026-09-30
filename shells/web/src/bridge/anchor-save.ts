// SPDX-License-Identifier: MPL-2.0
/** Browser download fallback shared by exports and standalone docs. */
export function anchorSave(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  anchorSaveUrl(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Click a download anchor at an ALREADY-RESOLVED url (a same-origin path or a
 * data: URI the caller owns) - the sibling of anchorSave for callers that hold a
 * url, not a Blob. Same bridge/-only rule: it exists so a fallback that must
 * anchor a raw url doesn't grow a second `<a download>` outside bridge/. Does not
 * revoke `url` - it is not this helper's to own.
 */
export function anchorSaveUrl(url: string, filename: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

