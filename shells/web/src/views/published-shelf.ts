// SPDX-License-Identifier: MPL-2.0
/**
 * The workspace's shelf: what a connected workspace published for this person, at the
 * top of the gallery, each with Use. A brand team's partner data sheet is here before
 * the person has to search for it (plans/82 M2).
 *
 * Two kinds of thing land on it, both read from the catalog the workspace already
 * serves, so nothing new is asked of the network:
 *   - a template of a tool (lib/workspace-templates.ts): Use opens that tool from it,
 *     through `?template=`, so its rules hold from the first frame;
 *   - a tool the workspace built from a Share with rules file: an ordinary tool in the
 *     index that carries the template it came from (`templateId`). Use opens that tool.
 * A retired one is never offered. On a plain build there is nothing to show and the
 * shelf is absent, so the gallery renders exactly as before.
 *
 * One published thing is one card (plans/82 M6): a rules tool on the shelf leaves the
 * grid (`onShelf`), and the home search filters the shelf's cards with the tiles. A
 * card whose person has a copy says so, "Your copy · <date>", and resumes that copy; a
 * template's copy made from an older version also gets "New version", which opens the
 * copy and takes the new version through the copy's own notice.
 */
import { escape as escapeHtml, safeHref } from '../utils.ts';
import { t, tRaw } from '../i18n.ts';
import { icon } from '../lib/icons.ts';
import { fold, scoreHaystack } from '../lib/search/match.ts';
import { isHiddenSlot } from '../lib/batch-slots.ts';
import type { ShelfCopy, ShelfEntry, WorkspaceTemplate } from '../lib/workspace-templates.ts';

export interface PublishedItem {
  /** Stable key: the template's catalog id. */
  key: string;
  name: string;
  /** The tool it opens. */
  toolId: string;
  /** What the second line says: the tool it is made with ('' for a tool of its own). */
  toolName: string;
  href: string;
  /** A short version label ("Version 3", "1.0.2"). */
  version: string;
  icon?: string;
  /** For a template, the values a preview draws from. */
  values?: Record<string, unknown>;
  formats?: readonly string[];
  /** The tool's own proportions, for the preview frame. */
  width?: number;
  height?: number;
  /** A workspace template's version now, so a copy made from an older one shows as
   *  behind. Absent for a rules tool, whose copies follow the tool. */
  templateVersion?: number;
}

/** True for a tool the shelf shows as its own card (a rules tool built from a workspace
 *  template): the grid leaves it out, so one published thing is one card. */
export function onShelf(tool: { templateId?: unknown; listed?: boolean }): boolean {
  return typeof tool.templateId === 'string' && tool.listed !== false;
}

/** The shelf's items: templates of tools this person can open, then rules tools, by name. */
export function publishedItems(
  templates: readonly WorkspaceTemplate[],
  tools: ReadonlyArray<{ id: string; name: string; icon?: string; version?: string; formats?: readonly string[]; width?: number; height?: number; listed?: boolean; templateId?: unknown }>,
): PublishedItem[] {
  const byId = new Map(tools.map((tool) => [tool.id, tool]));
  const out: PublishedItem[] = [];
  for (const tpl of templates) {
    const tool = byId.get(tpl.toolId);
    if (tpl.retired || !tool) continue;
    out.push({
      key: tpl.id, name: tpl.name, toolId: tpl.toolId, toolName: tool.name,
      href: `#/tool/${encodeURIComponent(tpl.toolId)}?template=${encodeURIComponent(tpl.id)}`,
      version: tRaw('Version {n}', { n: tpl.version }), templateVersion: tpl.version,
      ...(tool.icon ? { icon: tool.icon } : {}), ...(tool.formats ? { formats: tool.formats } : {}),
      ...(tool.width && tool.height ? { width: tool.width, height: tool.height } : {}),
    });
  }
  for (const tool of tools) {
    if (!onShelf(tool)) continue;
    out.push({
      key: String(tool.templateId), name: tool.name, toolId: tool.id, toolName: '',
      href: `#/tool/${encodeURIComponent(tool.id)}`,
      version: tool.version ? tRaw('Version {n}', { n: tool.version }) : '',
      ...(tool.icon ? { icon: tool.icon } : {}), ...(tool.formats ? { formats: tool.formats } : {}),
      ...(tool.width && tool.height ? { width: tool.width, height: tool.height } : {}),
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** A preview frame in the tool's own proportions, kept between portrait and wide. */
function mediaShape(item: PublishedItem): string {
  if (!item.width || !item.height) return '';
  const ratio = Math.min(16 / 9, Math.max(3 / 4, item.width / item.height));
  return ` style="aspect-ratio: ${ratio.toFixed(3)}"`;
}

/** What the home search matches a card on: its name and the tool it is made with. */
export function shelfSearchText(item: Pick<PublishedItem, 'name' | 'toolName'>): string {
  return [item.name, item.toolName].filter(Boolean).join(' ');
}

/** One card. Use is the link, stretched over the whole card so the card taps as one
 *  target; the person's copy, added later by markCopies, is a second link above the
 *  stretched one and never inside the Use link. */
function cardHtml(item: PublishedItem): string {
  if (!safeHref(item.href)) return '';
  // nosemgrep: lolly-href-escape-is-not-scheme-validation - safeHref()-gated in the guard above
  return `<div class="published-card" data-published-key="${escapeHtml(item.key)}" data-search="${escapeHtml(shelfSearchText(item))}">
            <span class="published-card-media" aria-hidden="true"${mediaShape(item)}><span class="published-card-icon">${item.icon ?? icon('document', { size: 22 })}</span></span>
            <span class="published-card-text">
              <span class="published-card-name">${escapeHtml(item.name)}</span>
              <span class="published-card-sub"><span>${escapeHtml([item.toolName, item.version].filter(Boolean).join(' · '))}</span></span>
            </span>
            <a class="btn btn--primary btn--sm published-card-use" href="${escapeHtml(item.href)}">${escapeHtml(t('Use'))}<span class="visually-hidden"> ${escapeHtml(item.name)}</span></a>
          </div>`;
}

/** The shelf's markup, or '' when there is nothing published (shelf absent). `lead`
 *  is markup for the first card, the person's company card (views/company-card.ts),
 *  which keeps the shelf on screen even before anything is published. */
export function publishedShelfHtml(items: readonly PublishedItem[], workspace: string | undefined, lead = ''): string {
  if (!items.length && !lead) return '';
  const title = workspace ? tRaw('From {name}', { name: workspace }) : t('From your workspace');
  return `
      <section class="published-shelf" aria-label="${escapeHtml(title)}">
        <h2 class="published-shelf-title">${escapeHtml(title)}</h2>
        <div class="published-shelf-row">
          ${lead}${items.map(cardHtml).join('')}
        </div>
      </section>`;
}

/**
 * Filter the shelf with the home search, the way the grid filters its tiles: a card
 * shows when its name or tool matches every word. The company card has nothing to
 * match, so it rests while a search runs, and a shelf with no match hides whole.
 * Returns how many cards a search found (0 with no search).
 */
export function filterShelf(view: ParentNode, tokens: readonly string[]): number {
  const shelf = view.querySelector<HTMLElement>('.published-shelf');
  if (!shelf) return 0;
  let shown = 0;
  for (const card of shelf.querySelectorAll<HTMLElement>('.published-card')) {
    const text = card.dataset.search;
    const match = !tokens.length || (text !== undefined && scoreHaystack([{ text: fold(text), weight: 1 }], tokens) > 0);
    card.hidden = !match;
    if (match) shown++;
  }
  shelf.hidden = shown === 0;
  return tokens.length ? shown : 0;
}

/** "3 Nov": the copy's last save, short, in the viewer's own date order, kept on one
 *  line when the card's text wraps. */
function copyDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }).replace(/ /g, '\u00a0');
}

/** The route that resumes a saved copy. */
export function copyHref(copy: Pick<ShelfCopy, 'toolId' | 'slot'>): string {
  return `#/tool/${encodeURIComponent(copy.toolId)}?slot=${encodeURIComponent(copy.slot)}`;
}

/**
 * Add the person's copy to each card that has one: "Your copy · <date>", which resumes
 * it, and for a copy made from an older version of its template a "New version" button
 * beside the version. Text goes in as text; nothing here is markup.
 */
export function markCopies(root: ParentNode, copies: ReadonlyMap<string, ShelfCopy>): void {
  for (const [key, copy] of copies) {
    const card = root.querySelector<HTMLElement>(`.published-card[data-published-key="${CSS.escape(key)}"]`);
    const text = card?.querySelector<HTMLElement>('.published-card-text');
    if (!card || !text || card.querySelector('.published-card-copy')) continue;
    const link = document.createElement('a');
    link.className = 'published-card-copy';
    link.href = copyHref(copy);
    link.dataset.slot = copy.slot;
    const date = copyDate(copy.updatedAt);
    link.textContent = date ? tRaw('Your copy · {date}', { date }) : t('Your copy');
    text.append(link);
    if (!copy.behind) continue;
    const mark = document.createElement('button');
    mark.type = 'button';
    mark.className = 'btn btn--sm published-card-new';
    mark.dataset.newVersion = key;
    mark.dataset.slot = copy.slot;
    mark.dataset.tool = copy.toolId;
    mark.textContent = t('New version');
    card.querySelector('.published-card-sub')?.append(mark);
  }
}

/** The slice of the host the copies read uses: the saved-session list and one read. */
export interface ShelfCopiesHost {
  state: {
    list(): Promise<Array<{ slot: string; toolId: string; updatedAt: string }>>;
    load(slot: string): Promise<object | null>;
  };
}

/**
 * Find the person's copies of what the shelf offers and mark the cards, once, when the
 * page is idle after the shelf is drawn: the session list, then at most SHELF_COPY_READS
 * reads of the newest sessions of the shelf's template tools, for where each came from.
 * A rules tool needs no read. A read that fails leaves that card as it was.
 */
export async function fillShelfCopies(mount: HTMLElement, host: ShelfCopiesHost, items: readonly PublishedItem[]): Promise<void> {
  const { copiesOf, readTemplateOrigin, sessionsToRead } = await import('../lib/workspace-templates.ts');
  const entries: ShelfEntry[] = items.map((item) => ({
    key: item.key, toolId: item.toolId, template: item.templateVersion !== undefined,
    ...(item.templateVersion !== undefined ? { version: item.templateVersion } : {}),
  }));
  const list = (await host.state.list()).filter((s) => !isHiddenSlot(s.slot));
  const rulesTools = new Set(entries.filter((e) => !e.template).map((e) => e.toolId));
  const saved: Array<{ slot: string; toolId: string; updatedAt: string; origin?: ReturnType<typeof readTemplateOrigin> }> =
    list.filter((s) => rulesTools.has(s.toolId)).map(({ slot, toolId, updatedAt }) => ({ slot, toolId, updatedAt }));
  for (const s of sessionsToRead(entries, list)) {
    if (!mount.isConnected) return;
    try {
      const data = await host.state.load(s.slot) as { __template?: unknown } | null;
      saved.push({ slot: s.slot, toolId: s.toolId, updatedAt: s.updatedAt, origin: readTemplateOrigin(data?.__template) });
    } catch { /* that card keeps no copy line */ }
  }
  if (mount.isConnected) markCopies(mount, copiesOf(entries, saved));
}

/** "New version" on a card: open the copy and have its notice take the new version, the
 *  same action as Use new version in the notifications list. */
export function wireShelfCopies(mount: HTMLElement, go: (href: string) => void = (href) => { location.hash = href; }): void {
  mount.addEventListener('click', (event) => {
    const mark = (event.target as Element).closest<HTMLElement>('[data-new-version]');
    if (!mark?.dataset.newVersion || !mark.dataset.slot || !mark.dataset.tool) return;
    event.preventDefault();
    const { newVersion: ref, slot, tool } = mark.dataset;
    void import('./tool-template-notices.ts').then(({ requestNewVersion }) => {
      requestNewVersion(ref);
      go(copyHref({ toolId: tool, slot }));
    });
  });
}
