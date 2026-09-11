// SPDX-License-Identifier: MPL-2.0
/**
 * The Ask spotlight provider (plans/103 M0) - the hand-off from search to help.
 *
 * It emits exactly ONE hit, a constant-score row that carries the typed query
 * into the #/ask view. It is the fallback affordance: GROUP_ORDER places `ask`
 * last, so it sits under whatever concrete tool/settings/docs hits the other
 * providers found - "didn't see it? ask." Navigation-only, like every hit.
 *
 * Tokens arrive folded (lowercase, diacritics stripped) from the shared
 * tokenizer, so the seeded question loses case and punctuation; that is fine - 
 * the composer in the view is where the user refines it, and the seed only has
 * to be recognisably their query.
 */
import { icon } from '../../icons.ts';
import { t } from '../../../i18n.ts';
import type { SearchHit, SearchProvider } from '../registry.ts';

export function createAskProvider(): SearchProvider {
  return {
    id: 'ask',
    async search(tokens): Promise<SearchHit[]> {
      if (!tokens.length) return [];
      const q = tokens.join(' ');
      return [{
        // The "smart / auto" glyph the app uses for AI-assisted actions (verify,
        // upscale, the filter tools). spotlight.css makes this row prominent and
        // twinkles the icon on hover via the `ask-spark` class.
        icon: icon('aiSpark', { className: 'ask-spark' }),
        title: t('Ask Lolly: {q}', { q }),
        href: `#/ask?q=${encodeURIComponent(q)}`,
        score: 1,
      }];
    },
  };
}
