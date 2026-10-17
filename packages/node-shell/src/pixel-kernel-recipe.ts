// SPDX-License-Identifier: MPL-2.0
/** Cache identity stays separate from operation admission so asset lookup remains small. */
export const LUT_GPU_RECIPE = 'lut-webgpu-v1';

/**
 * Each GPU photo look kind is versioned on its own, so a change to one kind's
 * numerics re-bakes only that kind. A changed recipe is a new id, never an edit.
 * The TypeScript bake (engine/src/photo-look.ts, `photo-look-v1`) stays the
 * reference these are compared against.
 */
export const GRADIENT_MAP_GPU_RECIPE = 'gradient-map-webgpu-v1';
export const GREYSCALE_GPU_RECIPE = 'greyscale-webgpu-v1';
export const DUOTONE_GPU_RECIPE = 'duotone-webgpu-v1';

const GPU_RECIPES: Readonly<Record<string, string>> = {
  lut: LUT_GPU_RECIPE,
  'gradient-map': GRADIENT_MAP_GPU_RECIPE,
  greyscale: GREYSCALE_GPU_RECIPE,
  duotone: DUOTONE_GPU_RECIPE,
};

/** The recipe a web pixel bake of this look kind carries in its cache key, or null for a kind with none. */
export function photoLookGpuRecipe(kind: unknown): string | null {
  return typeof kind === 'string' && Object.hasOwn(GPU_RECIPES, kind) ? GPU_RECIPES[kind]! : null;
}
