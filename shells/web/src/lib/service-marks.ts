// SPDX-License-Identifier: MPL-2.0
/**
 * Service marks for Connected services and the sync list in /profile. A service
 * with a mark in service-marks/marks.json (Simple Icons, CC0 - see the README
 * there) draws it; OneDrive and the sync choices that are not services draw a
 * plain glyph from lib/icons.ts. Marks are filled with the text colour, like the
 * Verify vendor marks, so they follow every theme including high contrast.
 */
import marks from './service-marks/marks.json' with { type: 'json' };
import { icon, type IconName } from './icons.ts';

const GLYPHS: Record<string, IconName> = { o365: 'cloud', folder: 'folder', device: 'monitor', file: 'document' };

/** A decorative mark for a provider kind (or a sync choice id); the service name is in the row's text. */
export function serviceMark(kind: string): string {
  const paths = (marks as Record<string, string[] | undefined>)[kind];
  const svg = paths
    ? `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${paths.map((d) => `<path d="${d}"/>`).join('')}</svg>`
    : icon(GLYPHS[kind] ?? 'link');
  return `<span class="profile-mark" aria-hidden="true">${svg}</span>`;
}
