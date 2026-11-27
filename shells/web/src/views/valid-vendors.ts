// SPDX-License-Identifier: MPL-2.0
/** Local vendor marks identify a recorded product, not the reliability of its claim. */
import type { VerifyStrength } from '@lolly/engine';
import marks from '../lib/verify-vendors/marks.json' with { type: 'json' };
import { identifyVendor, vendorMonogram, type Vendor } from '../lib/verify-vendors/identify.ts';
import { escape as esc } from '../utils.ts';
import { t } from '../i18n.ts';
import { icon } from '../lib/icons.ts';
import { LOLLY_MARK_SVG } from '../lib/lolly-mark.ts';

const paths = marks as Record<string, string[]>;
const isLolly = (name: string): boolean => /\blolly\b/i.test(name);

function markSvg(vendor: Vendor | null): string {
  const d = vendor?.mark ? paths[vendor.mark] : undefined;
  return d ? `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${d.map((p) => `<path d="${p}"/>`).join('')}</svg>` : '';
}

/**
 * The mark for a recorded product name. A product the registry holds with no
 * mark draws a monogram in the same box, so a missing mark is never a missing
 * finding. A name the registry does not hold draws the plain tool icon.
 */
export function vendorMark(name: string): string {
  if (isLolly(name)) return `<span class="valid-vendor-mark" aria-hidden="true" data-vendor="lolly">${LOLLY_MARK_SVG}</span>`;
  const vendor = identifyVendor(name);
  if (!vendor) return `<span class="valid-vendor-mark" aria-hidden="true">${icon('tool')}</span>`;
  const svg = markSvg(vendor);
  return svg
    ? `<span class="valid-vendor-mark" aria-hidden="true" data-vendor="${esc(vendor.mark ?? vendor.id)}">${svg}</span>`
    : `<span class="valid-vendor-mark is-monogram" aria-hidden="true" data-vendor="${esc(vendor.id)}">${esc(vendorMonogram(vendor.name))}</span>`;
}

/** The evidence strength words. One list for the answer row, every section and every chip. */
export const STRENGTH: Record<VerifyStrength, string> = {
  signed: 'Signed',
  unverified: 'Credential, not verified',
  stated: 'Stated in the file',
  hint: 'Hint',
  estimated: 'Estimated on this device',
  none: '',
};

/** The strength in words, or '' when there is none to state. */
export function strengthHtml(strength: VerifyStrength): string {
  const words = STRENGTH[strength];
  return words ? `<span class="vf-slot-strength is-${strength}">${t(words)}</span>` : '';
}

/**
 * A row's strength inside a section. The answer slot is the one statement of a
 * finding's strength, so a row whose strength matches the slot's (`stated`)
 * shows its words only at Evidence depth, where every source is listed with
 * its strength. A row that differs always shows its own.
 */
export function rowStrengthHtml(strength: VerifyStrength, stated?: VerifyStrength): string {
  const words = STRENGTH[strength];
  return words ? `<span class="vf-slot-strength is-${strength}${strength === stated ? ' vf-same' : ''}">${t(words)}</span>` : '';
}

/**
 * One vendor, wherever one is named: the mark, the name as recorded and how
 * strong the evidence is. The strength is part of the chip, because a mark
 * alone would read as a confirmed fact. Inside a section, `stated` is the
 * strength the finding's answer slot already gives (see rowStrengthHtml).
 */
export function vendorChip(name: string, role: string, strength: VerifyStrength, stated?: VerifyStrength): string {
  return `<span class="vendor-chip" data-vendor-role="${esc(role)}" data-strength="${strength}">${vendorMark(name)}<span class="vendor-chip-copy"><strong>${esc(name.length > 80 ? `${name.slice(0, 77)}…` : name)}</strong>${rowStrengthHtml(strength, stated)}</span></span>`;
}

/** How strong an AI declaration is, by where it was read. Only a credential that verified is "signed". */
export const aiStrength = (via: string, verified: boolean): VerifyStrength =>
  via === 'credential' ? (verified ? 'signed' : 'unverified') : via === 'fingerprint' ? 'hint' : 'stated';

/**
 * The chip for the AI model or service recorded in a file, or '' when what the
 * file records matches no AI maker in the registry. `via` is where the declaration
 * came from; only a credential that verified is "signed".
 */
export function aiMakerChip(recorded: string, via: string, verified: boolean, stated?: VerifyStrength): string {
  const vendor = identifyVendor(recorded);
  if (vendor?.kind !== 'ai') return '';
  return vendorChip(vendor.name, 'ai', aiStrength(via, verified), stated);
}
