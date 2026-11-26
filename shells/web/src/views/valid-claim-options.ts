// SPDX-License-Identifier: MPL-2.0
/** The choices offered when a viewer adds their own credential in Verify. */

/**
 * Licence options offered when claiming a file - mirrors community/claim
 * (option value = the exact string embedded as dc:rights, incl. the CC deed URL).
 *
 * The first option is empty and means exactly what it says: no public licence was
 * declared. It is NOT a retained-rights notice, which is the second option and
 * writes a notice of its own. Those are different facts about a file, and the
 * empty value used to be labelled as the second one, which said something the
 * claimant never chose (plan 253, section 9.3).
 */
export const CLAIM_LICENCES: Array<{ value: string; label: string }> = [
  { value: '', label: 'No public licence declared' },
  { value: 'All rights reserved', label: 'All rights reserved - a retained-rights notice' },
  { value: 'CC0 1.0 (Public Domain) · https://creativecommons.org/publicdomain/zero/1.0/', label: 'CC0 1.0 - Public Domain' },
  { value: 'CC BY 4.0 · https://creativecommons.org/licenses/by/4.0/', label: 'CC BY 4.0 - Attribution' },
  { value: 'CC BY-SA 4.0 · https://creativecommons.org/licenses/by-sa/4.0/', label: 'CC BY-SA 4.0 - Attribution-ShareAlike' },
  { value: 'CC BY-ND 4.0 · https://creativecommons.org/licenses/by-nd/4.0/', label: 'CC BY-ND 4.0 - Attribution-NoDerivatives' },
  { value: 'CC BY-NC 4.0 · https://creativecommons.org/licenses/by-nc/4.0/', label: 'CC BY-NC 4.0 - Attribution-NonCommercial' },
  { value: 'CC BY-NC-SA 4.0 · https://creativecommons.org/licenses/by-nc-sa/4.0/', label: 'CC BY-NC-SA 4.0 - NonCommercial-ShareAlike' },
  { value: 'CC BY-NC-ND 4.0 · https://creativecommons.org/licenses/by-nc-nd/4.0/', label: 'CC BY-NC-ND 4.0 - NonCommercial-NoDerivatives' },
  { value: 'Public Domain Mark 1.0 · https://creativecommons.org/publicdomain/mark/1.0/', label: 'Public Domain Mark - already public domain' },
];

/**
 * What the claimant says their claim rests on. Signing records the sentence, not
 * a finding: uploading a file is not ownership of it, and a Lolly signature says
 * who asserted this and that the bytes match, never that the assertion is true.
 */
export const CLAIM_BASIS: Array<{ value: string; label: string; sentence: string }> = [
  { value: 'author', label: 'I created this work', sentence: 'Credentials added by the claimant, who asserts they created this work.' },
  { value: 'contribution', label: 'I hold rights in my own contribution', sentence: 'Credentials added by the claimant, who asserts rights in their own contribution and not in the rest of the work.' },
  { value: 'distribution', label: 'I am authorised to distribute this work', sentence: 'Credentials added by the claimant, who asserts they are authorised to distribute this work.' },
];
