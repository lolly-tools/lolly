// SPDX-License-Identifier: MPL-2.0
/**
 * Whether an export carries provenance marks WHEN NOBODY SAID — the one home for
 * the two default-on answers every shell needs before it exports anything:
 *
 *   • Content Credentials (a signed C2PA manifest), and
 *   • the Lolly Imprint (the pixel watermark, engine/src/pixel-watermark.ts).
 *
 * Why it lives in the engine: both answers are read off the tool MANIFEST
 * (`render.c2pa`, `privacy`), which is engine territory — the same declaration
 * `schemas/tool.schema.json` documents as "Default TRUE … Ignored (forced off)
 * for privacy:'on-device' tools". Before this module the web shell owned the
 * policy privately (shells/web/src/lib/c2pa-policy.ts) and the CLI simply never
 * asked, so a file made in the app and the same file made from the terminal
 * carried different provenance. plans/73-cli-ga-contract.md §12 O2 (decided by
 * Andy, 2026-08-01) closed that: the CLI matches the web shell, and the policy
 * has exactly one implementation so the two cannot drift again.
 *
 * An EXPLICIT setting always wins over these: URL mode's `?c2pa=`/`?imprint=`
 * (and their CLI spellings `--c2pa=`/`--imprint=`/`--no-provenance`) are parsed
 * before this is consulted, and `null` from that parse is what "nobody said"
 * means. Pure, DOM-free, no I/O.
 */

/** The manifest surface these policies read. `ToolManifest` satisfies it
 *  structurally, so adopting this never forces a type migration on a caller. */
export interface ProvenanceManifest {
  render: { c2pa?: boolean; formats?: string[] };
  privacy?: string;
}

/**
 * Does this tool stamp Content Credentials when the caller said nothing?
 *
 * Off for exactly two cases, both of them the tool's own declaration:
 *  • `privacy: 'on-device'` — the output is the USER's own file (an EXIF strip,
 *    a redaction, a recompress). Stamping it would attach provenance to content
 *    Lolly did not author. This is a validated repo invariant, not a preference.
 *  • `render.c2pa: false` — an explicit per-tool opt-out.
 */
export function c2paDefaultOn(manifest: ProvenanceManifest): boolean {
  return manifest.render.c2pa !== false && manifest.privacy !== 'on-device';
}

/**
 * Does this tool embed the Lolly Imprint when the caller said nothing?
 *
 * Same gates as `c2paDefaultOn` — the two marks are complements (a credential
 * dies to any container change; the imprint survives a screenshot), and a tool
 * that has opted out of declaring "made with Lolly" must not have it asserted in
 * the pixels either. The web shell's export sheet pre-checks the Imprint toggle
 * for any imprint-capable format, and never shows it for an on-device utility.
 */
export function imprintDefaultOn(manifest: ProvenanceManifest): boolean {
  return c2paDefaultOn(manifest);
}

/**
 * Formats whose bytes can carry the pixel watermark at all — the web shell's
 * `isImprintFmt` (shells/web/src/views/tool-actions.ts), moved here so the
 * terminal shells gate on the same list.
 *
 * `pdf`/`pdf-cmyk`/`pptx` are CONTAINERS: the mark rides raster images they
 * embed, never the vector shapes or text, so a page of headings and boxes
 * carries no detectable mark even with the setting on. That is a property of
 * the mark, not a bug in the gate.
 */
export const IMPRINT_FORMATS: readonly string[] = Object.freeze([
  'png', 'jpg', 'jpeg', 'webp', 'avif', 'tiff', 'bmp', 'pdf', 'pdf-cmyk', 'pptx',
]);

/** True when `format` is one the Imprint can be embedded into. Case-insensitive. */
export function isImprintFormat(format: string | undefined | null): boolean {
  return !!format && IMPRINT_FORMATS.includes(format.toLowerCase());
}

/**
 * The CONTAINER subset of `IMPRINT_FORMATS`: pdf/pdf-cmyk/pptx. The mark rides only the
 * raster images these containers embed, never their vector shapes or text — so a page of
 * headings and boxes carries no detectable mark even with the Imprint on. The raster
 * formats (png/jpg/…) are excluded because every one of their pixels can carry it. Kept
 * beside `IMPRINT_FORMATS` so a UI can say "on · embedded images only" for a container
 * rather than overstating an unconditional in-pixel mark.
 */
export const IMPRINT_CONTAINER_FORMATS: readonly string[] = Object.freeze(['pdf', 'pdf-cmyk', 'pptx']);

/** True when the Imprint format is a container whose mark rides only embedded raster
 *  images (so a vector-only page carries none). Case-insensitive. */
export function isImprintContainerFormat(format: string | undefined | null): boolean {
  return !!format && IMPRINT_CONTAINER_FORMATS.includes(format.toLowerCase());
}
