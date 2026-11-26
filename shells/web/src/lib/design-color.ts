// SPDX-License-Identifier: MPL-2.0
/** Preserve authored Design colours and token links under the document's range policy. */
import { tokenColorVar } from '../../../../engine/src/color-face.ts';
import type { ColorFieldValue, ColorChangeDetail } from '../components/color-field.ts';
import { colourRoleWord } from './colour-role-words.ts';

export function designColorValue(value: ColorFieldValue, editingRange: unknown, detail?: ColorChangeDetail): string {
  if (typeof value === 'object') return `var(${tokenColorVar(value.ref)}, ${value.value})`;
  return editingRange === 'hdr' && detail ? detail.css : value;
}

/**
 * A colour for a Design input that is not a row, such as the canvas background. A row
 * lowers whatever it is given to a literal plus its link. An input keeps what it is given,
 * so a colour role is handed over as the link itself, the form a tool's colour input
 * stores: it reads `{color.semantic.<id>}` and follows the colourway. Every other colour,
 * and everything a document already holds, stays as it was.
 */
export function designInputColorValue(value: ColorFieldValue, editingRange: unknown, detail?: ColorChangeDetail): ColorFieldValue {
  return typeof value === 'object' && colourRoleWord(value.ref) ? value : designColorValue(value, editingRange, detail);
}

/** A gradient stop holds a colour, never a token link, so a picked swatch arrives as its plain value. */
export function designStopColorValue(value: ColorFieldValue, editingRange: unknown, detail?: ColorChangeDetail): string {
  return designColorValue(typeof value === 'object' ? value.value : value, editingRange, detail);
}
