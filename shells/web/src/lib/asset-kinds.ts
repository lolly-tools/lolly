// SPDX-License-Identifier: MPL-2.0
/**
 * Which asset types have a PICTURE, and which are engine data wearing an asset's
 * clothes.
 *
 * A user asset is the shell's universal storage rail - fonts, the installed
 * tokens doc, saved palettes and (since 1.73) ICC profiles all live in the same
 * store as uploaded images, so they all come back from `_listUserAssets()`. Any
 * surface that TILES that list has to filter, or it renders a woff2 as a broken
 * thumbnail. The catalog and the picker always did; the folder overlays did not,
 * which is why an installed Google Font already showed up there as an empty tile
 * before a profile could.
 *
 * Two lists rather than one because the surfaces ask different questions: the
 * catalog grid asks "does this thumbnail as an image" (a strict allow-list, so a
 * type added later is out until someone decides it belongs), while the folder
 * overlays ask "is this a thing at all" and tile audio too (a deny-list, so a new
 * media type appears rather than silently vanishing).
 */

/** Types that render as an image tile. `model` (3-D GLB) and `lut` (a .cube colour
 *  grade) tile from a rendered still poster, exactly as a lottie/video tiles from
 *  its poster - the primary file (mesh / lookup table) is not itself an image. */
export const VISUAL_TYPES: ReadonlySet<string> = new Set(['raster', 'vector', 'video', 'lottie', 'model', 'lut']);

/** Types that are engine data, with nothing to show. */
export const DATA_TYPES: ReadonlySet<string> = new Set(['palette', 'tokens', 'font', 'profile', 'ratecard', 'text', 'data']);

/** Can this asset be tiled at all? False for the data types above. */
export const isPlaceableAsset = (a: { type: string }): boolean => !DATA_TYPES.has(a.type);
