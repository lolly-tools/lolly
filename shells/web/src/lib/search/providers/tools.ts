// SPDX-License-Identifier: MPL-2.0
/**
 * The Tools + Utilities spotlight providers (plans/99 section 2b) - both read the
 * synced tool index off window.__toolIndex (catalog/sync.ts owns that global;
 * the provider assembly passes no deps, so the read happens per search call and
 * a mid-session re-sync is picked up automatically).
 *
 * The split mirrors views/gallery.ts exactly: utilities are `category ===
 * 'utility'` (the `#/u` view), tools are everything else, and unlisted entries
 * (manifest `listed: false` - mechanisms invoked from context, e.g.
 * asset-export) never surface. Haystacks include the pristine English strings
 * localizeToolIndex stashes on `tool.en` (plans/99 section 2e), so a Spanish session
 * finds "Compress PDF" by "compress" AND by its Spanish name.
 *
 * Haystacks are folded ONCE and cached in a WeakMap keyed on the index OBJECT:
 * a re-sync assigns a fresh window.__toolIndex, which misses the cache and
 * rebuilds; the old index's rows go with it (no invalidation bookkeeping).
 */

import { fold, scoreHaystack } from '../match.ts';
import { flagEnabledSync } from '../../../feature-flags.ts';
import { UTILITIES_FLAG_ID } from '../../../components/view-toggle.ts';
import type { SearchField } from '../match.ts';
import type { SearchHit, SearchProvider } from '../registry.ts';
import { icon } from '../../icons.ts';

/** The slice of a tool-index entry the haystack reads (catalog/sync.ts's
 *  ToolIndex types most fields `unknown`, so this stays defensive). */
interface IndexTool {
  id: string;
  name?: unknown;
  description?: unknown;
  tags?: unknown;
  category?: unknown;
  listed?: unknown;
  en?: { name?: unknown; description?: unknown };
}

interface ToolIndexLike { tools?: IndexTool[] }

const readIndex = (): ToolIndexLike | undefined =>
  (globalThis as { window?: { __toolIndex?: ToolIndexLike } }).window?.__toolIndex;

/** One searchable tool: the index entry + its prebuilt, pre-folded fields. */
interface Row { tool: IndexTool; fields: SearchField[] }

// Field weights (plans/99 section 2b): names lead, tags + id carry vocabulary the
// name doesn't ("foil" → Finish Preview), descriptions trail.
function fieldsFor(tool: IndexTool): SearchField[] {
  const out: SearchField[] = [];
  const push = (text: unknown, weight: number): void => {
    if (typeof text === 'string' && text) out.push({ text: fold(text), weight });
  };
  push(tool.name, 3);
  push(tool.en?.name, 3);
  push(Array.isArray(tool.tags) ? tool.tags.filter((x) => typeof x === 'string').join(' ') : '', 2);
  push(tool.id, 2);
  push(tool.description, 1);
  push(tool.en?.description, 1);
  return out;
}

const rowCache = new WeakMap<object, { tools: Row[]; utilities: Row[] }>();

function splitRows(index: ToolIndexLike): { tools: Row[]; utilities: Row[] } {
  const hit = rowCache.get(index as object);
  if (hit) return hit;
  const split = { tools: [] as Row[], utilities: [] as Row[] };
  for (const tool of index.tools ?? []) {
    if (!tool || typeof tool.id !== 'string' || tool.listed === false) continue;
    (tool.category === 'utility' ? split.utilities : split.tools).push({ tool, fields: fieldsFor(tool) });
  }
  rowCache.set(index as object, split);
  return split;
}

function makeProvider(id: 'tools' | 'utilities'): SearchProvider {
  // Utilities get the wrench, tools the tool glyph - existing lib/icons entries.
  const glyph = icon(id === 'utilities' ? 'wrench' : 'tool');
  return {
    id,
    async search(tokens, limit): Promise<SearchHit[]> {
      const index = readIndex();
      if (!index) return [];
      const scored: Array<{ row: Row; score: number }> = [];
      for (const row of splitRows(index)[id]) {
        const score = scoreHaystack(row.fields, tokens);
        if (score > 0) scored.push({ row, score });
      }
      scored.sort((a, b) => b.score - a.score);
      // No subtitle: the raw category ids ('everyone', 'designer') read poorly
      // and the group header already says Tools/Utilities.
      return scored.slice(0, Math.max(0, limit)).map(({ row, score }) => ({
        icon: glyph,
        title: typeof row.tool.name === 'string' && row.tool.name ? row.tool.name : row.tool.id,
        href: `#/tool/${encodeURIComponent(row.tool.id)}`,
        score,
      }));
    },
  };
}

export function createToolsProvider(): SearchProvider {
  return makeProvider('tools');
}

export function createUtilitiesProvider(): SearchProvider {
  const base = makeProvider('utilities');
  return {
    id: 'utilities',
    // Gated per call on the same flag that owns the #/u route (main.ts replaces
    // it with the gallery when off) - without this, the group's "See all in
    // Utilities" handoff would bounce to the gallery and drop the query. Same
    // per-call pattern as the places provider's Batch-mode entry.
    search: (tokens, limit) => flagEnabledSync(UTILITIES_FLAG_ID) ? base.search(tokens, limit) : Promise.resolve([]),
  };
}
