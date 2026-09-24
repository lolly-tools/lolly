// SPDX-License-Identifier: MPL-2.0
/**
 * The nine Unicode emoji categories, as a lookup from a glyph's sequence key.
 *
 * These are the same groups the text selector wears as tabs, and they come from
 * the same place: `unicode-emoji`, the data package `unicode-emoji-picker`
 * (components/emoji-picker.ts) already reads. Deriving them here from a second
 * source would let the catalog and the selector disagree about where an emoji
 * lives, so the one dataset answers both.
 *
 * A pack's glyphs are keyed by sequence (`1f600`, `1f1e6-1f1e8`), and the data
 * package speaks in literal strings, so every emoji is indexed under the key its
 * own code points spell AND under that key with the variation selectors removed:
 * packs differ on whether they keep `fe0f`, and a category is not worth a miss.
 *
 * The dataset is about half a megabyte of JSON-ish module, so it is only ever
 * imported on demand, from the one surface that offers the filter. Callers get a
 * promise and should keep working while it is in flight - a category filter is
 * an improvement on a list that already reads fine without it.
 */

/** The category ids `unicode-emoji` assigns, in picker order. */
export const EMOJI_CATEGORY_IDS = [
  'face-emotion',
  'person-people',
  'animals-nature',
  'food-drink',
  'travel-places',
  'activities-events',
  'objects',
  'symbols',
  'flags',
] as const;

export type EmojiCategoryId = typeof EMOJI_CATEGORY_IDS[number];

/** English names for each category. Wrapped in `t()` by the surface that shows them. */
export const EMOJI_CATEGORY_LABELS: Record<EmojiCategoryId, string> = {
  'face-emotion': 'Smileys and emotion',
  'person-people': 'People and body',
  'animals-nature': 'Animals and nature',
  'food-drink': 'Food and drink',
  'travel-places': 'Travel and places',
  'activities-events': 'Activities and events',
  objects: 'Objects',
  symbols: 'Symbols',
  flags: 'Flags',
};

/** The filter value a category is selected by, kept apart from the glyph-kind values. */
export function emojiCategoryValue(id: EmojiCategoryId): string {
  return `group:${id}`;
}

/** The category a `group:` filter value names, or null for any other value. */
export function emojiCategoryOfValue(value: string): EmojiCategoryId | null {
  const id = value.startsWith('group:') ? value.slice(6) : '';
  return (EMOJI_CATEGORY_IDS as readonly string[]).includes(id) ? id as EmojiCategoryId : null;
}

/** A literal emoji string to the hyphenated lowercase hex key a pack uses. */
function sequenceKey(text: string): string {
  return [...text].map(char => char.codePointAt(0)!.toString(16)).join('-');
}

/** The same key with every variation selector dropped (`fe0f`/`fe0e`). */
function bareKey(key: string): string {
  return key.split('-').filter(part => part !== 'fe0f' && part !== 'fe0e').join('-');
}

let index: Promise<ReadonlyMap<string, EmojiCategoryId>> | null = null;

/**
 * Sequence key to category, for every emoji the pinned dataset knows. Memoised
 * per page; resolves to an EMPTY map if the dataset cannot be loaded, so a caller
 * only ever loses the filter, never the list it was filtering.
 */
export function emojiCategoryIndex(): Promise<ReadonlyMap<string, EmojiCategoryId>> {
  index ??= (async () => {
    const map = new Map<string, EmojiCategoryId>();
    try {
      const { getEmojis } = await import('unicode-emoji');
      for (const emoji of getEmojis()) {
        const category = emoji.category as EmojiCategoryId;
        if (!(EMOJI_CATEGORY_IDS as readonly string[]).includes(category)) continue;
        for (const text of [emoji.emoji, ...(emoji.variations ?? []).map(v => v.emoji)]) {
          const key = sequenceKey(text);
          // First writer wins: a skin-tone variation belongs to the same category as
          // its base, and nothing should be able to move a base it shares a key with.
          if (!map.has(key)) map.set(key, category);
          const bare = bareKey(key);
          if (bare && !map.has(bare)) map.set(bare, category);
        }
      }
    } catch { /* dataset unavailable - the kind filter still works on its own */ }
    return map;
  })();
  return index;
}

/** The category for one pack key, trying the variation-selector-free spelling too. */
export function emojiCategoryFor(
  key: string,
  lookup: ReadonlyMap<string, EmojiCategoryId>,
): EmojiCategoryId | null {
  return lookup.get(key) ?? lookup.get(bareKey(key)) ?? null;
}
