// SPDX-License-Identifier: MPL-2.0
/**
 * Does this body READ as an HTML document?
 *
 * The shell answers a MISSING tool file with the SPA index.html - a 200, never a
 * 404 - and this is how the tool loader tells that fallback apart from the file it
 * asked for. The decision is made on CONTENT, not the Content-Type header, because
 * the header is not trustworthy for every tool file: Tauri's asset resolver labels
 * any text it cannot fingerprint by its extension table as `text/html`
 * (`MimeType::parse` falls back to Html; `.md`, `.ics` and `.vcf` are not in that
 * table, `.csv` and `.txt` are). A header check therefore rejected the REAL signed
 * bytes of a sibling text template such as chart's template.md, and the verified
 * loader then failed closed - chart and timezone would not open in the iOS app
 * (2026-09-08). The unsigned web and CLI paths tolerated the same null, which is
 * why only the native apps showed it.
 *
 * No tool file other than template.html legitimately begins with an HTML document,
 * and the caller excludes that one by extension, so this cannot misfire on genuine
 * tool bytes. Pure, dependency-free: kept out of tool-loader.ts so it can be unit
 * tested without importing the engine and the shell's instance/i18n modules.
 */
export function looksLikeHtmlDocument(text: string): boolean {
  const head = text.slice(0, 512).replace(/^﻿/, '').trimStart().toLowerCase();
  return head.startsWith('<!doctype html') || head.startsWith('<html');
}

/** The same question for a byte body (a pinned or bundled file read as a Blob or
 *  ArrayBuffer): decode a 512-byte prefix and classify that. A binary tool asset
 *  never decodes to an HTML preamble, so this cannot misfire on fonts or images. */
export function looksLikeHtmlDocumentBytes(bytes: Uint8Array): boolean {
  return looksLikeHtmlDocument(new TextDecoder().decode(bytes.subarray(0, 512)));
}
