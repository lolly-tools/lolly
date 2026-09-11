// SPDX-License-Identifier: MPL-2.0
/**
 * The spotlight SETTINGS provider (plans/99 section 2b) - settings findability is
 * first-class (Andy's mid-build directive): "contrast", "dark mode", "jelly",
 * "storage" or "focus music" typed in the bottom bar anywhere in the app must
 * surface the right settings destination.
 *
 * Federates FOUR static sources, all in-memory and instant (no host slice):
 *  1. Profile sections - views/profile.ts NAV_SECTIONS, the same array that
 *     renders the settings rail. Hits deep-link #/profile?focus=<id>, which the
 *     profile view honours for every section (not just the collapsibles).
 *  2. Individual feature flags - feature-flags.ts consts, so "jelly" or "batch"
 *     lands on the Feature flags drawer with the flag named in the hit title.
 *     Flags a control plane hides are skipped, mirroring the profile's flagRow.
 *  3. The four accessibility prefs - the Accessibility card's rows, with
 *     generous keywords ("animation", "text size", "calm"), all deep-linking
 *     #/profile?focus=a11y-section.
 *  4. Dashboard destinations - views/dashboard-registry.ts, the same registry
 *     dashboard.ts renders its data-flag sections from, so "palette" or
 *     "typography" lands on the right dashboard section via its own deep link.
 *
 * Items are rebuilt per search call: ~50 entries of fold() is microseconds, and
 * it keeps t() honest against the live language catalog with no cache to
 * invalidate. Titles/subtitles are PLAIN TEXT (the overlay escapes at render).
 */
import type { SearchHit, SearchProvider } from '../registry.ts';
import { fold, scoreHaystack } from '../match.ts';
import type { SearchField } from '../match.ts';
import { t } from '../../../i18n.ts';
import { icon } from '../../icons.ts';
import { NAV_SECTIONS } from '../../../views/profile.ts';
import { DASH_SECTIONS, dashHref } from '../../../views/dashboard-registry.ts';
import {
  CATEGORY_FLAGS, JELLY_FLAG, WOBBLY_FLAG, WOBBLY_MESH_FLAG, STRIP_UPLOAD_META_FLAG, PREFLIGHT_FLAG,
  flagHidden,
} from '../../../feature-flags.ts';
import type { FeatureFlag } from '../../../feature-flags.ts';

// The standalone toggles the profile's Feature flags drawer lists (its flagListHtml
// order), joined with the gallery category flags below.
const STANDALONE_FLAGS: readonly FeatureFlag[] = [JELLY_FLAG, WOBBLY_FLAG, WOBBLY_MESH_FLAG, STRIP_UPLOAD_META_FLAG, PREFLIGHT_FLAG];

// The Accessibility card's four prefs (views/profile.ts A11Y_ROWS - the labels
// are a copy, pinned against that source by settings.test.ts so a reword there
// fails here). Keywords are deliberately generous: these are the settings people
// search for in distress, with whatever word is in their head.
const A11Y_PREFS: ReadonlyArray<{ label: string; keywords: string }> = [
  { label: 'Reduce motion', keywords: 'motion animation animations movement transitions calm still reduce a11y accessibility' },
  { label: 'Hide colourful previews', keywords: 'previews thumbnails colourful colorful calm quiet noise hide a11y accessibility' },
  { label: 'High contrast', keywords: 'contrast borders outlines focus ring visibility legibility a11y accessibility' },
  { label: 'Large text', keywords: 'text size type font bigger larger zoom magnify large a11y accessibility' },
  // Sound + focus music live in the same card (plans/142 A11y-1/2): first-class
  // accommodations, so searching for them routes to Accessibility - never to
  // the experimental flags drawer.
  { label: 'Sound', keywords: 'sound mute audio effects sfx quiet silence volume a11y accessibility' },
  { label: 'Neurospicy Mode', keywords: 'neurospicy focus music beat atmosphere stimulation background a11y accessibility' },
];

/** An item ready to score: a prebuilt (folded) haystack plus its hit fields. */
interface SettingsItem {
  icon: string;
  title: string;
  subtitle: string;
  href: string;
  fields: SearchField[];
}

// Weighted fields: titles (localized + English) outrank keyword bags, matching
// the tools provider's name-over-tags shape. Empty strings are dropped so a
// missing translation never adds a zero-width field.
function fieldsOf(titles: readonly string[], keywords: readonly string[]): SearchField[] {
  const out: SearchField[] = [];
  for (const s of new Set(titles)) if (s) out.push({ text: fold(s), weight: 3 });
  for (const s of new Set(keywords)) if (s) out.push({ text: fold(s), weight: 1 });
  return out;
}

function buildItems(): SettingsItem[] {
  const items: SettingsItem[] = [];

  // 1. Profile sections - reuse each rail entry's own icon.
  for (const s of NAV_SECTIONS) {
    items.push({
      icon: icon(s.icon, { size: 16 }),
      title: t(s.label),
      subtitle: t('Profile settings'),
      href: `#/profile?focus=${encodeURIComponent(s.id)}`,
      fields: fieldsOf([t(s.label), s.label], [s.keywords]),
    });
  }

  // 2. Feature flags - every visible toggle, named individually, all landing on
  // the (auto-opened) Feature flags drawer.
  for (const f of [...CATEGORY_FLAGS, ...STANDALONE_FLAGS]) {
    if (flagHidden(f.id)) continue;
    items.push({
      icon: icon('flask', { size: 16 }),
      title: t(f.label),
      subtitle: t('Feature flags'),
      href: '#/profile?focus=feature-flags-section',
      fields: fieldsOf([t(f.label), f.label], f.pill ? [t(f.pill), f.pill] : []),
    });
  }

  // 3. Accessibility prefs.
  for (const p of A11Y_PREFS) {
    items.push({
      icon: icon('eye', { size: 16 }),
      title: t(p.label),
      subtitle: t('Accessibility'),
      href: '#/profile?focus=a11y-section',
      fields: fieldsOf([t(p.label), p.label], [p.keywords]),
    });
  }

  // 4. Dashboard destinations - the registry's own deep-link form (dashHref:
  // sections by first flag keyword, tabs by ?tab=), so hits and applyDeepLink
  // cannot diverge.
  for (const d of DASH_SECTIONS) {
    items.push({
      icon: icon('dashboard', { size: 16 }),
      title: t(d.label),
      subtitle: t('Dashboard'),
      href: dashHref(d),
      fields: fieldsOf([t(d.label), d.label], [d.flag]),
    });
  }

  return items;
}

export function createSettingsProvider(): SearchProvider {
  return {
    id: 'settings',
    async search(tokens, limit): Promise<SearchHit[]> {
      const hits: SearchHit[] = [];
      for (const item of buildItems()) {
        const score = scoreHaystack(item.fields, tokens);
        if (score <= 0) continue;
        hits.push({ icon: item.icon, title: item.title, subtitle: item.subtitle, href: item.href, score });
      }
      return hits.sort((a, b) => b.score - a.score).slice(0, limit);
    },
  };
}
