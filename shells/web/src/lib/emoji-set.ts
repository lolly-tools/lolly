// SPDX-License-Identifier: MPL-2.0
/** Inspect one admitted set and prepare its artwork only when requested. */
import type { EmojiAPI } from '@lolly-tools/core/host-v1';
import type { EmojiGlyphV1, EmojiPackPinV1 } from '@lolly-tools/core/emoji-v1';
import { inspectEmojiPack, readEmojiPack } from '../../../../engine/src/emoji-pack.ts';
import { emojiSvgMarkup, prepareEmojiSvg } from '../../../../engine/src/emoji-svg.ts';
import type { EmojiXmlParser } from '../../../../engine/src/emoji-svg.ts';

export interface EmojiSetEntry {
  glyph: EmojiGlyphV1;
  key: string;
  text: string;
  kind: 'emoji' | 'tones' | 'custom';
  search: string;
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

export function filterEmojiSet(entries: readonly EmojiSetEntry[], query: string, kind: string): EmojiSetEntry[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return entries.filter(entry => (kind === 'all' || entry.kind === kind)
    && terms.every(term => entry.search.includes(term)));
}

export interface EmojiSetArtwork {
  entries: EmojiSetEntry[];
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
  const cache = new Map<string, Promise<string | null>>();
  let stopped = false;
  return {
    entries: emojiSetEntries(manifest.glyphs),
    url(entry) {
      if (stopped) return Promise.resolve(null);
      let pending = cache.get(entry.key);
      if (!pending) {
        pending = (async () => {
          const artwork = await api.artwork(pin, entry.glyph.asset);
          if (stopped || !artwork) return null;
          const result = await prepareEmojiSvg(admitted.pack, entry.glyph.meaning, artwork, api.parseXml as EmojiXmlParser);
          if (stopped || !result.ok) return null;
          // Each image has its own document, so SVG ids cannot collide with the page.
          const url = URL.createObjectURL(new Blob([emojiSvgMarkup(result.svg)], { type: 'image/svg+xml' }));
          urls.add(url);
          return url;
        })().catch(() => null);
        cache.set(entry.key, pending);
      }
      return pending;
    },
    destroy() {
      stopped = true;
      for (const url of urls) URL.revokeObjectURL(url);
      urls.clear();
      cache.clear();
    },
  };
}
