// SPDX-License-Identifier: MPL-2.0
/**
 * A rendition tool (manifest `renditionOf`, engine 1.341): the one picture its output is
 * a changed copy of, the C2PA action it performs, and the reference check every
 * validator shares (the SDK's validateTool, the engine's loader and validate:catalog).
 * Pure and dependency-free, so the engine can import it without the SDK index.
 */

/** What a rendition tool did to the picture it opened, as a C2PA action. */
export const RENDITION_ACTIONS = ['c2pa.color_adjustments', 'c2pa.filtered', 'c2pa.converted', 'c2pa.resized', 'c2pa.cropped', 'c2pa.edited'] as const;
export type RenditionAction = (typeof RENDITION_ACTIONS)[number];

/** `ToolManifest.renditionOf`: the input the output is a rendition of, and the action the tool performs. */
export interface RenditionOf {
  /** The id of a top-level `asset` input. */
  input: string;
  action: RenditionAction;
  /** Inputs that replace the picture as the source while they hold anything (Darkroom's
   *  layer stack). While one does, the export is not recorded as a rendition. A live
   *  camera frame or a recording replaces the picture too, without being listed. */
  unlessSet?: string[];
}

/**
 * A rendition's parent is one picture, so `renditionOf.input` has to name a declared
 * top-level `asset` input, and each `unlessSet` entry another declared input. The schema
 * checks the shape; this checks the references.
 */
export function renditionOfErrors(manifest: { renditionOf?: { input: string; unlessSet?: string[] }; inputs?: { id: string; type: string }[] }): { path: string; message: string }[] {
  const rendition = manifest.renditionOf;
  if (!rendition) return [];
  const issues: { path: string; message: string }[] = [];
  if (!manifest.inputs?.some((input) => input.id === rendition.input && input.type === 'asset')) {
    issues.push({ path: '/renditionOf/input', message: 'must name a declared top-level asset input' });
  }
  for (const [i, id] of (rendition.unlessSet ?? []).entries()) {
    if (id === rendition.input || !manifest.inputs?.some((input) => input.id === id)) {
      issues.push({ path: `/renditionOf/unlessSet/${i}`, message: 'must name another declared input' });
    }
  }
  return issues;
}
