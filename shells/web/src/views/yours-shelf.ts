// SPDX-License-Identifier: MPL-2.0
/**
 * The "Yours" shelf (plans/170 WP-2, audit 167 R3): once someone has real
 * history here, the gallery leads with THEIR tools - favourites first, then
 * recents - as a compact icon-and-name chip row above the grid. At 55-69 tools
 * the grid is a catalog; this row is what makes a return visit read as a home,
 * and on phones it is the antidote to a 55-row scroll to a familiar tool.
 *
 * It appears only after {@link YOURS_MIN_TOOLS} distinct tools have saved
 * sessions - the signal that someone actually works here - so a first-run
 * gallery stays a clean catalog. Chips are icon + name with no previews by
 * construction, so the hidePreviews accessibility pref holds without a rule.
 */
import { escape } from '../utils.ts';
import { t } from '../i18n.ts';

export interface YoursTool { id: string; name: string; icon?: string }

/** Distinct session-holding tools required before the shelf shows. */
export const YOURS_MIN_TOOLS = 3;
/** Chip cap - a shelf, not a second grid. */
export const YOURS_MAX_CHIPS = 8;

/**
 * Pick the shelf's tools: favourited recents first, then remaining favourites,
 * then remaining recents - deduped, hidden tools excluded, capped. Returns []
 * until enough distinct tools have sessions (see YOURS_MIN_TOOLS).
 *
 * `recentToolIds` is the caller's distinct newest-first list of tools with
 * saved sessions; `byId` supplies name/icon and doubles as the existence check
 * (a session for a tool this catalog no longer ships adds nothing).
 */
export function yoursShelfTools(
  recentToolIds: readonly string[],
  favourites: ReadonlySet<string>,
  byId: ReadonlyMap<string, YoursTool>,
  hidden: ReadonlySet<string>,
): YoursTool[] {
  const recents = recentToolIds.filter(id => !hidden.has(id) && byId.has(id));
  if (recents.length < YOURS_MIN_TOOLS) return [];
  const out: YoursTool[] = [];
  const seen = new Set<string>();
  const push = (id: string): void => {
    if (seen.has(id) || out.length >= YOURS_MAX_CHIPS) return;
    if (hidden.has(id)) return;
    const tool = byId.get(id);
    if (!tool) return;
    seen.add(id);
    out.push(tool);
  };
  for (const id of recents) if (favourites.has(id)) push(id);
  for (const id of favourites) push(id);
  for (const id of recents) push(id);
  return out;
}

/** The shelf's markup, or '' when the tool set is empty (shelf not shown). */
export function yoursShelfHtml(tools: readonly YoursTool[]): string {
  if (!tools.length) return '';
  return `
      <nav class="yours-shelf" aria-label="${escape(t('Your tools'))}">
        <span class="yours-shelf-label">${t('Yours')}</span>
        ${tools.map(tool => `<a class="yours-chip" href="#/tool/${escape(tool.id)}">${tool.icon ? `<span class="yours-chip-icon" aria-hidden="true">${tool.icon}</span>` : ''}<span class="yours-chip-name">${escape(tool.name)}</span></a>`).join('')}
      </nav>`;
}
