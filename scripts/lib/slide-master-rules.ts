// SPDX-License-Identifier: MPL-2.0
/**
 * The slide master rules `validate:catalog` applies beyond the schema (plan 275
 * section 2.7). Pure: the caller reads the files and hands in parsed values, so a
 * test can run the same rules over a master held in memory.
 *
 *  1. Every archetype names a layout library structure or carries its own slots.
 *     A `structure` the library does not hold is an error once the library is on
 *     disk; with no library to read, the rule checks what it can (the id form,
 *     which the schema already pins) and says nothing more. An archetype that
 *     states a `repeat` carries the cells of it (placeholders with a `group`):
 *     the runtime reads one flat placeholder list and never expands a repeat, so
 *     a repeat with no cells would seed and export nothing but its title.
 *  2. Every placeholder that seeds a text layer (kind `text` or `table`) states a
 *     weight. Design draws a text layer with no weight at 700, so a body slot that
 *     leaves it out comes out bold in Design and in the exported pptx.
 *  3. No two placeholders in one archetype overlap, unless one of them is
 *     `optional` or `overlay`, or an image placeholder sits under (before) a text
 *     one: a caption over a full-bleed picture is the intended case.
 *  4. Archetype ids are unique in a master, `variants.dark` names an archetype of
 *     the same master, and so does `variantOf`.
 *
 * Every rule is an error for every masters file, whether the layout library build
 * wrote it (the file states `library`) or a person did: a third-party pack is where
 * a missing weight would otherwise draw a body bold. `warnings` stays in the result
 * for callers that print both lists, and these rules leave it empty.
 */

/** Geometry the rules read: fractions of the master size. */
interface Box { x: number; y: number; w: number; h: number }

interface Placeholder {
  role?: string;
  kind?: string;
  box?: Box;
  group?: string;
  style?: { weight?: string };
  optional?: boolean;
  overlay?: boolean;
}

interface Archetype {
  id?: string;
  structure?: string;
  placeholders?: Placeholder[];
  repeat?: unknown;
  variants?: { dark?: string };
  variantOf?: string;
}

interface Master {
  id?: string;
  archetypes?: Archetype[];
}

export interface SlideMasterFileLike {
  masters?: Master[];
  library?: { id?: string; version?: string };
}

export interface SlideMasterRuleResult {
  errors: string[];
  warnings: string[];
}

/** Two boxes overlap when they share more than this much in both directions (fractions of the master). */
export const MASTER_OVERLAP_EPSILON = 0.001;

function overlaps(a: Box, b: Box): boolean {
  const x = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const y = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return x > MASTER_OVERLAP_EPSILON && y > MASTER_OVERLAP_EPSILON;
}

const seedsText = (ph: Placeholder): boolean => ph.kind === 'text' || ph.kind === 'table';

/** How a placeholder is named in a message: its role and its position in the archetype. */
const nameOf = (ph: Placeholder, index: number): string => `${ph.role ?? 'placeholder'} #${index + 1}`;

/** Whether an overlapping pair is one the rule allows. `first` is painted before `second`. */
function overlapAllowed(first: Placeholder, second: Placeholder): boolean {
  if (first.optional || second.optional || first.overlay || second.overlay) return true;
  return first.kind === 'image' && seedsText(second);
}

/**
 * The rules over one masters file. `where` names the file in every message;
 * `libraryIds` is the set of structure ids the layout library holds, or null when
 * no library is on disk to read.
 */
export function slideMasterProblems(file: SlideMasterFileLike, where: string, libraryIds: ReadonlySet<string> | null): SlideMasterRuleResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  for (const master of file.masters ?? []) {
    const at = `${where} master ${master.id ?? '(no id)'}`;
    const archetypes = master.archetypes ?? [];
    const ids = new Set<string>();
    const unweighted: string[] = [];
    const overlapping: string[] = [];
    for (const archetype of archetypes) {
      const id = archetype.id ?? '(no id)';
      if (ids.has(id)) errors.push(`${at}: archetype "${id}" is declared twice`);
      ids.add(id);
      const placeholders = archetype.placeholders ?? [];
      if (archetype.structure !== undefined && libraryIds && !libraryIds.has(archetype.structure)) {
        errors.push(`${at}: archetype "${id}" names the structure "${archetype.structure}", which the layout library does not hold`);
      }
      if (placeholders.length === 0 && archetype.structure === undefined) {
        errors.push(`${at}: archetype "${id}" has no placeholders and names no layout library structure`);
      }
      if (archetype.repeat !== undefined && !placeholders.some((ph) => ph.group !== undefined)) {
        errors.push(`${at}: archetype "${id}" states a repeat but none of its cells; write the cells as grouped placeholders, or run node scripts/build-slide-masters.ts`);
      }
      placeholders.forEach((ph, index) => {
        if (seedsText(ph) && !ph.style?.weight) unweighted.push(`${id} ${nameOf(ph, index)}`);
      });
      for (let i = 0; i < placeholders.length; i++) {
        for (let j = i + 1; j < placeholders.length; j++) {
          const a = placeholders[i];
          const b = placeholders[j];
          if (!a?.box || !b?.box || !overlaps(a.box, b.box) || overlapAllowed(a, b)) continue;
          overlapping.push(`${id} ${nameOf(a, i)} and ${nameOf(b, j)}`);
        }
      }
    }
    for (const archetype of archetypes) {
      const dark = archetype.variants?.dark;
      if (dark !== undefined && !ids.has(dark)) {
        errors.push(`${at}: archetype "${archetype.id ?? '(no id)'}" names the dark variant "${dark}", which this master does not declare`);
      }
      const base = archetype.variantOf;
      if (base !== undefined && !ids.has(base)) {
        errors.push(`${at}: archetype "${archetype.id ?? '(no id)'}" is the variant of "${base}", which this master does not declare`);
      }
    }
    if (unweighted.length > 0) {
      errors.push(`${at}: ${unweighted.length} text placeholder${unweighted.length === 1 ? ' states' : 's state'} no weight, so Design would draw them bold (${unweighted.join(', ')})`);
    }
    if (overlapping.length > 0) {
      errors.push(`${at}: ${overlapping.length} placeholder pair${overlapping.length === 1 ? ' overlaps' : 's overlap'} with neither marked optional or overlay (${overlapping.join('; ')})`);
    }
  }
  return { errors, warnings };
}

/** The structure ids a layout library file holds, or null when the value is not one. */
export function libraryStructureIds(library: unknown): Set<string> | null {
  if (!library || typeof library !== 'object') return null;
  const structures = (library as { structures?: unknown }).structures;
  if (!Array.isArray(structures)) return null;
  const ids = new Set<string>();
  for (const entry of structures) {
    const id = entry && typeof entry === 'object' ? (entry as { id?: unknown }).id : undefined;
    if (typeof id === 'string') ids.add(id);
  }
  return ids;
}
