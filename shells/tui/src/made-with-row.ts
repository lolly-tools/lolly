// SPDX-License-Identifier: MPL-2.0
/**
 * The export panel's Design system row (plans/319): what the design-system record
 * will write for the chosen format, in the words the file will carry. The record is
 * approved on the condition that it is visible at the moment of export, so the row
 * never names words a file will not hold. Pure, so the row is tested without
 * mounting the view.
 */
import { C2PA_FORMATS, designRecordCarrier } from '@lolly/engine';

export interface MadeWithRowState {
  /** The record's words (designRecordWords), '' when there is nothing to record. */
  words: string;
  /** The row's switch. */
  on: boolean;
  /** The chosen export format. */
  format: string;
  /** The Content Credentials row's lifetime in days; 0 stamps none. */
  c2paDays: number;
}

/** The row's value text for the chosen format and switches. */
export function madeWithRowText(o: MadeWithRowState): string {
  if (!o.words) return 'nothing to record';
  const carrier = designRecordCarrier(o.format, o.c2paDays > 0 && C2PA_FORMATS.includes(o.format.toLowerCase()));
  if (!carrier) return 'this format carries no metadata';
  if (!o.on) return 'off · records nothing';
  return carrier === 'file' ? `on · records ${o.words}` : `on · records ${o.words} in the credential only`;
}
