// SPDX-License-Identifier: MPL-2.0
/**
 * The design system's own words for its colours, by token reference (plans/352).
 *
 * A colour field's swatch list sets these (components/color-field.ts `setSwatches`), and
 * anything that shows a colour's name reads them: a trigger, an inspector row, a link's summary.
 * The map holds a role's own reference, each slot the role fills and its on-colour, so
 * `{color.semantic.primary}` reads "Main" where the system bound its lead to Main.
 *
 * A system that declares no colour roles leaves the map empty, so every lookup answers
 * '' and every caller keeps the name it had. The words are inert text: nothing here reads
 * meaning from them, and a caller escapes them for the place it writes them.
 */
import { readBlockTokenBindings } from '../../../../engine/src/token-block-bindings.ts';

let words: ReadonlyMap<string, string> = new Map();

/** Replace the words. An empty map is the state of a system that declares none. */
export function setColourRoleWords(next: ReadonlyMap<string, string>): void {
  words = next;
}

/** The system's word for a token reference such as `{color.semantic.main}`, or ''. */
export function colourRoleWord(ref: unknown): string {
  return typeof ref === 'string' ? words.get(ref) ?? '' : '';
}

/**
 * The word for a Design row's colour field, from the link the row keeps beside its
 * literal (`tokenLinks`). The literal cannot say which token it came from, so a colourway
 * switch that moves the literal to a colour no swatch shares would otherwise read as a
 * colour's generic name. '' when the field has no live link, or when what is on screen is
 * no longer the link's colour (a keyframe's pose, say).
 */
export function linkedColourWord(row: Record<string, unknown> | null | undefined, field: string | null | undefined, shown?: unknown): string {
  if (!row || !field || !words.size) return '';
  const link = readBlockTokenBindings(row.tokenLinks)[field];
  if (!link || link.custom || (link.status && link.status !== 'linked')) return '';
  if (shown !== undefined && comparable(shown) !== comparable(link.value)) return '';
  return colourRoleWord(link.ref);
}

/** A compact share link drops a colour's `#`, so a row can hold either spelling. */
const comparable = (colour: unknown): string => String(colour).trim().toLowerCase().replace(/^#/, '');
