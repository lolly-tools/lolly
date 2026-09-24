// SPDX-License-Identifier: MPL-2.0
/** Inspect one admitted set and prepare its artwork only when requested. */
import type { EmojiAPI } from '@lolly-tools/core/host-v1';
import type { EmojiGlyphV1, EmojiPackPinV1 } from '@lolly-tools/core/emoji-v1';
import { inspectEmojiPack, readEmojiPack } from '../../../../engine/src/emoji-pack.ts';
import { emojiSvgMarkup, inkPreparedEmojiSvg, prepareEmojiSvg } from '../../../../engine/src/emoji-svg.ts';
import type { EmojiXmlParser } from '../../../../engine/src/emoji-svg.ts';
import { emojiCategoryFor, emojiCategoryOfValue, type EmojiCategoryId } from './emoji-categories.ts';

export interface EmojiSetEntry {
  glyph: EmojiGlyphV1;
  key: string;
  text: string;
  kind: 'emoji' | 'tones' | 'custom';
  search: string;
  /** Set once the category dataset has loaded (lib/emoji-categories.ts); null for
   *  a custom symbol, and undefined while the lookup is still in flight. */
  category?: EmojiCategoryId | null;
}

export function emojiSetEntries(glyphs: readonly EmojiGlyphV1[]): EmojiSetEntry[] {
  return glyphs.map(glyph => {
    const unicode = glyph.meaning.kind === 'unicode';
    const key = glyph.meaning.kind === 'unicode' ? glyph.meaning.key : glyph.meaning.id;
    const text = unicode ? String.fromCodePoint(...key.split('-').map(hex => Number.parseInt(hex, 16))) : '';
    const codes = unicode ? key.split('-').map(hex => `U+${hex}`).join(' ') : key;
    return {
      glyph, key, text,
      kind: !unicode ? 'custom' : /(?:^|-)1f3f[b-f](?:-|$)/.test(key) ? 'tones' : 'emoji',
      search: `${glyph.label} ${key} ${codes} ${text}`.toLowerCase(),
    };
  });
}

/** Assign each entry its Unicode category from a loaded lookup. Custom symbols are
 *  not in the dataset and settle on null, which is what takes them out of every
 *  category filter without taking them out of `all`. */
export function applyEmojiCategories(
  entries: readonly EmojiSetEntry[],
  lookup: ReadonlyMap<string, EmojiCategoryId>,
): void {
  for (const entry of entries) {
    entry.category = entry.kind === 'custom' ? null : emojiCategoryFor(entry.key, lookup);
  }
}

/**
 * `kind` is one filter value covering two axes: the glyph kinds ('all', 'emoji',
 * 'tones', 'custom') and, as `group:<id>`, one of the nine Unicode categories.
 * They share a control because they are alternative ways to narrow the same list,
 * and an unknown value narrows to nothing rather than quietly meaning 'all'.
 */
export function filterEmojiSet(entries: readonly EmojiSetEntry[], query: string, kind: string): EmojiSetEntry[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const category = emojiCategoryOfValue(kind);
  const matchesKind = (entry: EmojiSetEntry): boolean =>
    category ? entry.category === category : kind === 'all' || entry.kind === kind;
  return entries.filter(entry => matchesKind(entry) && terms.every(term => entry.search.includes(term)));
}

/** One glyph's prepared artwork, in both the forms a surface can draw it in. */
export interface EmojiSetArt {
  /** Blob URL of the prepared SVG - for an `<img>`, which is cheap and isolated. */
  url: string;
  /**
   * The same SVG as markup, set ONLY for a single-ink glyph, whose black paints
   * the engine has bound to `currentColor` (`inkPreparedEmojiSvg`). Such artwork
   * has to be drawn INLINE to read at all: an `<img>` renders in its own document
   * and inherits no colour, so a monochrome set (OpenMoji Black, Fluent High
   * Contrast) paints black on black the moment the app is in a dark theme - which
   * is what a filled plate behind every cell used to be covering up. Inline, the
   * ink follows the surrounding text and the contrast survives a theme switch.
   */
  ink: string | null;
}

export interface EmojiSetArtwork {
  entries: EmojiSetEntry[];
  art(entry: EmojiSetEntry): Promise<EmojiSetArt | null>;
  url(entry: EmojiSetEntry): Promise<string | null>;
  destroy(): void;
}

export async function loadEmojiSet(api: EmojiAPI | undefined, pin: EmojiPackPinV1): Promise<EmojiSetArtwork> {
  const bytes = await api?.manifest(pin);
  if (!api || !bytes) throw new Error('Emoji set unavailable.');
  const admitted = await readEmojiPack(bytes, pin);
  if (!admitted.ok) throw new Error(admitted.issue.message);
  const manifest = inspectEmojiPack(admitted.pack);
  if (!manifest) throw new Error('Emoji set unavailable.');
  const urls = new Set<string>();
  const cache = new Map<string, Promise<EmojiSetArt | null>>();
  let stopped = false;
  const art = (entry: EmojiSetEntry): Promise<EmojiSetArt | null> => {
    if (stopped) return Promise.resolve(null);
    let pending = cache.get(entry.key);
    if (!pending) {
      pending = (async () => {
        const artwork = await api.artwork(pin, entry.glyph.asset);
        if (stopped || !artwork) return null;
        const result = await prepareEmojiSvg(admitted.pack, entry.glyph.meaning, artwork, api.parseXml as EmojiXmlParser);
        if (stopped || !result.ok) return null;
        // The same rewrite the render path applies under the `original` treatment
        // (engine/src/emoji-inline.ts): colour artwork comes back as the handle that
        // went in, so the handles differing IS the answer to "is this single ink".
        const inked = await inkPreparedEmojiSvg(result.svg);
        if (stopped) return null;
        const markup = emojiSvgMarkup(inked);
        // Each image has its own document, so SVG ids cannot collide with the page.
        const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }));
        urls.add(url);
        return { url, ink: inked === result.svg ? null : markup };
      })().catch(() => null);
      cache.set(entry.key, pending);
    }
    return pending;
  };
  return {
    entries: emojiSetEntries(manifest.glyphs),
    art,
    async url(entry) {
      return (await art(entry))?.url ?? null;
    },
    destroy() {
      stopped = true;
      for (const url of urls) URL.revokeObjectURL(url);
      urls.clear();
      cache.clear();
    },
  };
}
