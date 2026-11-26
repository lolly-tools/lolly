// SPDX-License-Identifier: MPL-2.0
/**
 * An explicit "no Content Credentials" on an SVG. An SVG that inlines credentialed artwork,
 * such as a catalog logo, carries that piece's `<c2pa:manifest>`, and a verifier reads it as
 * the file's own: `c2pa=off` read back as `invalid`. So when the caller opted out, every
 * manifest comes out of the finished SVG, and only those. The rest of the file's metadata stays.
 *
 * Only on an explicit opt-out (`dropInlinedC2pa`, set by a link's `c2pa=off` and the export
 * card's box). An export nobody configured keeps its bytes, and this module has no part in
 * where a credential goes when one is stamped.
 *
 * packages/node-shell/src/lolly-file.ts stripSvgC2pa is the same three replacements for the
 * Node shells; tests/credential-off.test.ts runs both over the same documents.
 */
import { gunzip, gzip } from '@lolly/engine';

/** Every `<c2pa:manifest>` and the namespace it needs, out of one SVG document. */
export function stripSvgManifests(svg: string): string {
  return svg
    .replace(/<metadata><c2pa:manifest(?:\s[^>]*)?>[^<]*<\/c2pa:manifest><\/metadata>/g, '')
    .replace(/<c2pa:manifest(?:\s[^>]*)?>[^<]*<\/c2pa:manifest>/g, '')
    .replace(/ xmlns:c2pa="[^"]*"/g, '');
}

/** The finished file with no manifest in it, when the caller asked for none. Otherwise the same Blob. */
export async function dropInlinedCredentials(blob: Blob, format: string, opts: { dropInlinedC2pa?: boolean; c2pa?: boolean }): Promise<Blob> {
  if (!opts.dropInlinedC2pa || opts.c2pa) return blob;
  if (format === 'svg' || format === 'svg-anim') {
    const svg = await blob.text();
    return svg.includes('<c2pa:manifest') ? new Blob([stripSvgManifests(svg)], { type: blob.type }) : blob;
  }
  if (format === 'svgz') {
    const svg = new TextDecoder().decode(gunzip(new Uint8Array(await blob.arrayBuffer())));
    if (!svg.includes('<c2pa:manifest')) return blob;
    return new Blob([gzip(new TextEncoder().encode(stripSvgManifests(svg))) as BlobPart], { type: blob.type });
  }
  return blob;
}
