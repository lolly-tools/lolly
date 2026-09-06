// SPDX-License-Identifier: MPL-2.0
/**
 * The IPTC DigitalSourceType slugs that denote AI/ML-generated pixels, and the
 * one lookup every reader shares. Split out of c2pa-extract.ts because
 * file-metadata.ts (the XMP/EXIF reader, on the mount path of any tool that
 * places a user file) only needs this lookup - importing it through
 * c2pa-extract dragged the whole C2PA read side (c2pa, c2pa-containers,
 * video-meta, ogg, …) into every render.
 */
const AI_SOURCE_TYPES: Record<string, 'generated' | 'composite'> = {
  trainedAlgorithmicMedia: 'generated',
  compositeWithTrainedAlgorithmicMedia: 'composite',
};

/** Map a DigitalSourceType (full IRI or bare slug) to the AI kind, if any. Full-AI
 *  ("generated") outranks the mixed-in ("composite") case wherever both appear. */
export const aiKind = (sourceType: unknown): 'generated' | 'composite' | undefined =>
  AI_SOURCE_TYPES[(typeof sourceType === 'string' ? sourceType : '').split('/').pop() ?? ''];
