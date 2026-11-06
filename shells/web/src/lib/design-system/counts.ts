// SPDX-License-Identifier: MPL-2.0
/**
 * counts.ts - one number for each kind of material (plan 346, change 5).
 *
 * The Board and the Tokens room used to count one design system two ways. The
 * Board read `summarizeTokensDoc` and listed distinct faces; the Tokens room read
 * the token inspection and counted font tokens. So Lolly Demo showed 99 tokens
 * and three typefaces on the Board and 101 and four one click away, and the Files
 * card counted the fonts, logos and tokens the Files room leaves out. An expert
 * who sees two numbers for one thing stops trusting either.
 *
 * Every count those rooms show is answered here, from the installed document or
 * the stored uploads, and both read from here. counts.test.ts holds the Board and the
 * Tokens room to the same numbers.
 *
 * A count of material is split the way every room paints ownership: the
 * person's own material, and the rest (what came with the system). `shown` is
 * the number a room puts on screen: the own count when there is any, otherwise
 * the rest, so a room never shows zero over material that is there.
 *
 * Pure and DOM-free: nothing here is a string a person reads.
 */

import { createTokenSet } from '@lolly/engine';
import { inspectTokenDocument } from '../../../../../engine/src/token-inspect.ts';
import { walkSwatches, type BrandSwatch } from '../brand-doc.ts';
import { familyFromTokenValue } from '../../user-fonts.ts';
import { leadTokenSet } from './leads.ts';
import { colourRoleCopies, withoutRoleCopies } from './colour-role-copies.ts';
import { colorIdentity, isRoleKey } from './ownership.ts';

/** One kind of material, counted. */
export interface MaterialCount {
  /** The person's own: changed or added here, installed on this device. */
  own: number;
  /** What came with the system: still exactly as it shipped. */
  rest: number;
  /** What a room shows: `own` when there is any, otherwise `rest`. */
  shown: number;
}

const counted = (own: number, rest: number): MaterialCount => ({ own, rest, shown: own || rest });

/** The Lolly app's own interface tokens. They style the studio, not the design
 *  system's output, so no count of the system's material includes them. */
export const isUiTokenKey = (key: string): boolean => key.startsWith('lolly.') || key.startsWith('color.lolly.');

/** Every token the document defines: the number the Tokens room's All tokens
 *  lists, read from the same inspection. A colour role's values in each colourway
 *  count with the role, not one by one, as the list shows them. */
export function tokenCount(doc: unknown): number {
  if (!doc || typeof doc !== 'object') return 0;
  try { return withoutRoleCopies(inspectTokenDocument(doc).tokens, colourRoleCopies(doc)).length; } catch { /* fall back to the plain set */ }
  try { return createTokenSet(doc).size; } catch { return 0; }
}

/** The document's swatches as the Tokens room walks them: light mode, the lead
 *  colourway's resolution, the app's own interface colours left out. */
export function paletteSwatches(doc: unknown): BrandSwatch[] {
  try {
    const set = leadTokenSet(doc, 'light');
    return walkSwatches(doc, 'light', key => set.resolve(key)).filter(s => !isUiTokenKey(s.key));
  } catch { return []; }
}

/**
 * The palette's colours. A role re-points at a colour and is not one, and a
 * gradient is counted as a gradient, so neither adds to this number: one added
 * colour is one more, in every room (plan 182 C5). `starter` holds the shipped
 * starter's colours as {@link colorIdentity} pairs (ownership.ts
 * `starterColorIds`); a colour still matching one is not the person's own.
 */
export function colourCount(doc: unknown, starter: ReadonlySet<string> = new Set()): MaterialCount {
  const palette = paletteSwatches(doc).filter(s => !isRoleKey(s.key));
  const own = palette.filter(s => !starter.has(colorIdentity(s.key, s.raw))).length;
  return counted(own, palette.length - own);
}

/** The family each font token names, lower-cased for comparison, in document order. */
function fontFamilies(doc: unknown): string[] {
  try {
    return leadTokenSet(doc, 'light').query({ type: 'fontFamily' })
      .filter(e => !isUiTokenKey(e.path))
      .map(e => familyFromTokenValue(e.value).trim().toLowerCase())
      .filter(Boolean);
  } catch { return []; }
}

/**
 * The typefaces the document names. A family that serves two roles (text and
 * emphasis, most often) is one typeface. The person's own are the families
 * installed on this device (`installed`, case-insensitive); a family that only
 * the system names came with the system.
 */
export function typefaceCount(doc: unknown, installed: readonly string[] = []): MaterialCount {
  const families = fontFamilies(doc);
  const mine = new Set(installed.map(f => String(f).trim().toLowerCase()).filter(Boolean));
  const own = new Set(families.filter(f => mine.has(f)));
  const rest = new Set(families.filter(f => !own.has(f)));
  return counted(own.size, rest.size);
}

/** An upload, as the asset store lists uploads. */
export interface UploadRef { id: string; type: string; meta?: Record<string, unknown> }

/** The design system's own material, which its rooms keep: fonts, marks,
 *  tokens and headshots are not files a person dropped in Files. */
const INTERNAL_UPLOAD = /^user\/(fonts|logo|tokens|headshot)/;

/** Which section of Files an upload sorts into, or null when it sorts nowhere. */
export function fileBucket(ref: UploadRef): 'vector' | 'audio' | 'motion' | 'image' | null {
  if (ref.type === 'vector') return 'vector';
  if (ref.type === 'audio') return 'audio';
  if (ref.type === 'video' || ref.type === 'lottie') return 'motion';
  if (ref.type === 'raster') return ref.meta?.animated ? 'motion' : 'image';
  return null;
}

/** The uploads the Files room lists, in the order it was given (the store lists
 *  newest first). */
export function designFiles<R extends UploadRef>(refs: readonly R[]): R[] {
  return refs.filter(r => !INTERNAL_UPLOAD.test(r.id) && fileBucket(r) !== null);
}

/** The name Files shows for an upload: its own, or the last segment of its id. */
export const fileName = (ref: UploadRef): string => String(ref.meta?.name ?? ref.id.split('/').pop() ?? '');
