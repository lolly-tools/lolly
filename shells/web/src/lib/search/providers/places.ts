// SPDX-License-Identifier: MPL-2.0
/**
 * The Places spotlight provider (plans/99 section 2b) - a static registry of
 * navigable views, so "verify", "colour lab" or "spreadsheet" typed anywhere
 * lands on the right route. This is also where the utilities view's non-tool
 * cards (Convert, PDF, Data - cards that link to VIEWS, not fake tools) are
 * searchable, so the tools/utilities providers never double-list them.
 *
 * Labels are the exact English t() keys those views already use; matching runs
 * over BOTH the translated and English labels (weight 3) plus an English
 * keyword bag (weight 1), so a German session finds Verify by either name and
 * the Colour Lab by "oklch". Batch mode joins the registry only while the Pro
 * flag is on - checked per search call (flagEnabledSync), never at module
 * load, so a toggle mid-session takes effect on the next keystroke.
 */

import { t } from '../../../i18n.ts';
import { icon } from '../../icons.ts';
import { fold, scoreHaystack } from '../match.ts';
import type { SearchField } from '../match.ts';
import type { SearchHit, SearchProvider } from '../registry.ts';

interface PlaceEntry {
  /** English t() key - translated at search/render time. */
  label: string;
  href: string;
  glyph: Parameters<typeof icon>[0];
  /** English-only recall vocabulary (weight 1). */
  keywords?: string;
}

// Icons reuse the glyphs the footer/dashboard chrome already uses where one
// exists (dashboard, shieldCheck, zap); the rest are sensible lib/icons picks.
const PLACES: readonly PlaceEntry[] = [
  { label: 'Verify', href: '#/verify', glyph: 'shieldCheck' },
  { label: 'Convert', href: '#/convert', glyph: 'convert' },
  { label: 'Unpack', href: '#/unpack', glyph: 'document', keywords: 'pdf svg idml indesign penpot figma fig pptx powerpoint psd photoshop take apart extract text images fonts colours attachments' },
  { label: 'Spreadsheet', href: '#/data', glyph: 'grid' },
  { label: 'Colour Lab', href: '#/lab', glyph: 'palette', keywords: 'color colour contrast gamut report oklch' },
  { label: 'Component library', href: '#/components', glyph: 'shapes' },
  { label: 'Design System studio', href: '#/start', glyph: 'tokens', keywords: 'brand design system tokens colors colours fonts logos start' },
  { label: 'Dashboard', href: '#/d', glyph: 'dashboard' },
  { label: 'Profile', href: '#/profile', glyph: 'user', keywords: 'settings account preferences' },
  { label: 'Script audio', href: '#/script', glyph: 'speech' },
];

/** Gated on the Pro flag per call - the same flagEnabledSync gate the footer's
 *  Batch link uses, so the two can't disagree. */
const PRO_PLACE: PlaceEntry = { label: 'Batch mode', href: '#/batch', glyph: 'table', keywords: 'pro batch' };

export function createPlacesProvider(): SearchProvider {
  return {
    id: 'places',
    async search(tokens, limit): Promise<SearchHit[]> {
      const entries = [...PLACES, PRO_PLACE];   // Batch/Pro available to everyone now (flag retired)
      const scored: Array<{ place: PlaceEntry; score: number }> = [];
      for (const place of entries) {
        // t(label) re-folds per call: the active language can change
        // mid-session, and eleven entries make caching a non-saving.
        const fields: SearchField[] = [
          { text: fold(t(place.label)), weight: 3 },
          { text: fold(place.label), weight: 3 },
        ];
        if (place.keywords) fields.push({ text: fold(place.keywords), weight: 1 });
        const score = scoreHaystack(fields, tokens);
        if (score > 0) scored.push({ place, score });
      }
      scored.sort((a, b) => b.score - a.score);
      return scored.slice(0, Math.max(0, limit)).map(({ place, score }) => ({
        icon: icon(place.glyph),
        title: t(place.label),
        href: place.href,
        score,
      }));
    },
  };
}
