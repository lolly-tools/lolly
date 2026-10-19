// SPDX-License-Identifier: MPL-2.0
import type { AppHistoryRow } from '../bridge/app-history.ts';
import { bindHistoryLink } from '../lib/history-navigation.ts';
import { sessionOpenHref } from '../lib/search/projects-source.ts';
import { isBatchSlot, isDiscardedSlot } from '../lib/batch-slots.ts';
import { icon } from '../lib/icons.ts';
import { t } from '../i18n.ts';

type Glyph = Parameters<typeof icon>[0];
export const historyElement = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string): HTMLElementTagNameMap[K] => {
  const el = document.createElement(tag);
  if (text) el.textContent = text;
  if (className) el.className = className;
  return el;
};

export function historyIcon(name: Glyph, className = 'app-history-icon'): HTMLElement {
  const el = historyElement('span', undefined, className);
  el.innerHTML = icon(name);
  el.setAttribute('aria-hidden', 'true');
  return el;
}

export function historyAction<T extends HTMLButtonElement | HTMLAnchorElement>(el: T, label: string, glyph: Glyph, iconOnly = false): T {
  el.classList.add('app-history-action');
  el.replaceChildren(historyIcon(glyph), historyElement('span', t(label), iconOnly ? 'visually-hidden' : undefined));
  if (iconOnly) { el.classList.add('app-history-action--icon'); el.title = t(label); }
  return el;
}

export function historyButton(label: string, glyph: Glyph, iconOnly = false): HTMLButtonElement {
  const el = historyElement('button', undefined, 'btn'); el.type = 'button';
  return historyAction(el, label, glyph, iconOnly);
}

export function historyLink(label: string, href: string, glyph: Glyph, iconOnly = false): HTMLAnchorElement {
  const el = historyElement('a', undefined, 'btn'); el.href = href;
  return historyAction(el, label, glyph, iconOnly);
}

export function historyDayKey(at: string): string {
  const date = new Date(at);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function historyDayLabel(at: string, now = new Date()): string {
  if (historyDayKey(at) === historyDayKey(now.toISOString())) return t('Today');
  const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
  if (historyDayKey(at) === historyDayKey(yesterday.toISOString())) return t('Yesterday');
  return new Date(at).toLocaleDateString(undefined, { weekday: 'long' });
}

const kinds: Record<AppHistoryRow['kind'], { label: string; glyph: Glyph }> = {
  creation: { label: 'Creation', glyph: 'image' },
  revision: { label: 'Checkpoint', glyph: 'history' },
  export: { label: 'Exported', glyph: 'download' },
  operation: { label: 'File operation', glyph: 'convert' },
  batch: { label: 'Batch', glyph: 'grid' },
};

/** What a row's own click does, and the other actions its menu offers. */
export type HistoryRowAction = 'resume' | 'versions' | 'project' | 'reopen' | 'results' | 'trash';

export interface HistoryTimelineContext {
  toolNames: ReadonlyMap<string, string>;
  preview(id: string, node: HTMLElement, image: HTMLImageElement): void;
  versions(row: AppHistoryRow): void;
  reopen(row: AppHistoryRow, button: HTMLButtonElement): void;
  /** Rows that can be selected (saved creations); undefined turns selection off. */
  selectable?(row: AppHistoryRow): boolean;
  isSelected?(row: AppHistoryRow): boolean;
}

/** The name a person gave the work, or the tool's name when the record only knows
 *  its tool id (an unnamed save is indexed under `chart`, `qr-code` and the like). */
export function historyTitle(ctx: Pick<HistoryTimelineContext, 'toolNames'>, row: AppHistoryRow): string {
  const own = row.milestone || row.title;
  return !own || own === row.toolId ? ctx.toolNames.get(row.toolId) || row.toolId : own;
}

const time = (at: string): string => new Date(at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

/** The menu a row offers, in order. The primary click is always the first entry. */
export function historyRowActions(row: AppHistoryRow): HistoryRowAction[] {
  if (row.kind === 'creation' && row.slot) return ['resume', 'versions', ...(isDiscardedSlot(row.slot) ? [] : ['project', 'trash'] as const)];
  if (row.kind === 'revision' && row.slot) return ['versions', ...(isDiscardedSlot(row.slot) ? [] : ['project'] as const)];
  if (row.kind === 'export') return ['reopen'];
  if (row.kind === 'operation' || row.kind === 'batch') return ['results'];
  return [];
}

export function historyProjectHref(row: AppHistoryRow): string {
  return row.projectId ? `#/p/${encodeURIComponent(row.projectId)}` : '#/p';
}

export function historyResultsHref(row: AppHistoryRow): string {
  return `#/convert?${row.kind === 'batch' ? 'batch' : 'history'}=${encodeURIComponent(row.ref)}`;
}

function resultLine(row: AppHistoryRow): HTMLElement | undefined {
  if (row.counts) {
    const c = row.counts;
    return historyElement('span', `${c.succeeded} ${t('ready')} · ${c.failed} ${t('failed')} · ${c.cancelled} ${t('cancelled')}${c.partially_succeeded ? ` · ${c.partially_succeeded} ${t('partial')}` : ''}${c.pending ? ` · ${c.pending} ${t('pending')}` : ''}`, 'app-history-result');
  }
  if (row.state) {
    const result = historyElement('span', t(({ succeeded: 'Ready to download', failed: 'Failed', cancelled: 'Cancelled', interrupted: 'Interrupted', running: 'Running' } as Record<string, string>)[row.state] ?? row.state), 'app-history-result');
    result.dataset.state = row.state;
    return result;
  }
  return undefined;
}

/** The control that covers the whole tile: a link where the action navigates, a
 *  button where it opens something here. It sits in the heading, so the tile's name
 *  is what a screen reader lists and what voice control matches. */
function openControl(ctx: HistoryTimelineContext, row: AppHistoryRow, title: string): HTMLAnchorElement | HTMLButtonElement {
  const first = historyRowActions(row)[0];
  if (first === 'resume') {
    const link = historyElement('a', title, 'app-history-open'); link.href = sessionOpenHref({ slot: row.slot!, toolId: row.toolId }, isBatchSlot(row.slot!));
    link.dataset.historyAction = 'resume'; bindHistoryLink(link); return link;
  }
  if (first === 'results') {
    const link = historyElement('a', title, 'app-history-open'); link.href = historyResultsHref(row);
    link.dataset.historyAction = 'results'; return link;
  }
  const button = historyElement('button', title, 'app-history-open'); button.type = 'button';
  if (first === 'versions') { button.dataset.historyAction = 'versions'; button.addEventListener('click', () => ctx.versions(row)); }
  else if (first === 'reopen') { button.dataset.historyAction = 'reopen'; button.addEventListener('click', () => ctx.reopen(row, button)); }
  else button.disabled = true;
  return button;
}

/** One history entry as an object tile: the picture leads, the name opens it, and
 *  everything else is a badge or one menu away (the same card the Projects grid
 *  draws, from styles/parts/object-tiles.css). */
export function historyRow(ctx: HistoryTimelineContext, row: AppHistoryRow): HTMLElement {
  const article = historyElement('article', undefined, 'folder-tile app-history-row'); article.dataset.historyId = row.id;
  article.dataset.kind = row.milestone ? 'milestone' : row.kind;
  const kind = row.milestone ? { label: 'Milestone', glyph: 'star' as const } : kinds[row.kind];
  const title = historyTitle(ctx, row);
  const toolName = ctx.toolNames.get(row.toolId) || row.toolId;

  const cover = historyElement('div', undefined, 'tile-figure app-history-cover'); cover.setAttribute('aria-hidden', 'true');
  cover.append(historyIcon(kind.glyph));
  const image = historyElement('img'); image.alt = ''; image.hidden = true; cover.append(image); ctx.preview(row.id, article, image);

  const meta = historyElement('div', undefined, 'tile-meta app-history-caption');
  const heading = historyElement('h3', undefined, 'tile-title');
  heading.append(openControl(ctx, row, title));
  const sub = historyElement('p', undefined, 'tile-sub app-history-sub'); sub.id = `history-sub-${row.id.replace(/[^\w-]/g, '-')}`;
  const at = historyElement('time', time(row.at)); at.dateTime = row.at; at.title = new Date(row.at).toLocaleString();
  sub.append(...(title === toolName ? [] : [historyElement('span', toolName, 'app-history-tool'), document.createTextNode(' · ')]), at);
  heading.firstElementChild!.setAttribute('aria-describedby', sub.id);
  const badges = historyElement('div', undefined, 'tile-badges');
  const badge = historyElement('span', undefined, 'tile-badge app-history-kind'); badge.append(historyIcon(kind.glyph), historyElement('span', t(kind.label)));
  badges.append(badge);
  if (row.format) badges.append(historyElement('span', row.format.toUpperCase(), 'tile-badge tile-badge--fmt'));
  if (row.project) { const project = historyElement('span', undefined, 'tile-badge app-history-project'); project.title = row.project; project.append(historyIcon('folder'), historyElement('span', row.project)); badges.append(project); }
  const titleRow = historyElement('div', undefined, 'app-history-title-row'); titleRow.append(heading);
  meta.append(titleRow, sub);
  if (row.milestone && row.title && row.title !== row.milestone) meta.append(historyElement('p', row.title, 'tile-sub app-history-original-title'));
  const result = resultLine(row); if (result) meta.append(result);
  meta.append(badges);

  const selectable = !!ctx.selectable?.(row);
  if (selectable) {
    const check = historyElement('button', undefined, 'tile-check'); check.type = 'button';
    const selected = !!ctx.isSelected?.(row);
    check.dataset.historySelect = row.id; check.setAttribute('aria-pressed', String(selected));
    check.setAttribute('aria-label', t('Select {name}', { name: title })); check.append(historyIcon('check', 'app-history-check-glyph'));
    article.classList.toggle('is-selected', selected);
    article.append(check);
  }
  const actions = historyRowActions(row);
  if (actions.length > 1) {
    const menu = historyElement('button', undefined, 'tile-menu-btn'); menu.type = 'button';
    menu.dataset.historyMenu = row.id; menu.setAttribute('aria-haspopup', 'menu');
    menu.setAttribute('aria-label', t('Actions for {title}', { title })); menu.append(historyIcon('menuDots', 'app-history-menu-glyph'));
    article.append(menu);
  }
  // A creation's history is the second thing people reach for, so it stays on the
  // tile rather than in the menu alone.
  if (row.kind === 'creation' && row.slot) {
    const versions = historyButton('Versions', 'history', true); versions.classList.add('btn--ghost', 'app-history-versions');
    versions.addEventListener('click', () => ctx.versions(row)); titleRow.append(versions);
  }
  article.append(cover, meta);
  return article;
}

/** A date is a complete, keyboard-operable chapter even while its entries are folded. */
export function historyDay(at: string, rows: AppHistoryRow[], open: boolean): { group: HTMLDetailsElement; body: HTMLElement } {
  const date = new Date(at), key = historyDayKey(at);
  const group = historyElement('details', undefined, 'app-history-day'); group.open = open; group.dataset.day = key;
  const summary = historyElement('summary', undefined, 'app-history-day-summary');
  const heading = historyElement('div', undefined, 'app-history-day-heading');
  const title = historyElement('h2', historyDayLabel(at)); title.id = `history-day-${key}`;
  heading.append(title, historyElement('span', date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }), 'app-history-day-date'));
  const count = historyElement('span', rows.length === 1 ? t('1 entry') : t('{count} entries', { count: rows.length }), 'app-history-day-count');
  summary.append(historyIcon('chevronDown', 'app-history-day-chevron'), heading, count);
  const body = historyElement('div', undefined, 'app-history-day-entries'); body.setAttribute('role', 'group'); body.setAttribute('aria-labelledby', title.id);
  group.append(summary, body);
  return { group, body };
}

/** Consecutive checkpoints of one creation become ONE tile: a fanned stack of up to
 *  three of their pictures, the count, and the span of time. Its click opens the
 *  creation's versions, which lists every one of them. */
export function historyPeriod(ctx: HistoryTimelineContext, rows: AppHistoryRow[]): HTMLElement {
  const first = rows[0]!;
  if (rows.length === 1) return historyRow(ctx, first);
  const tile = historyRow(ctx, first);
  tile.classList.add('app-history-period'); tile.dataset.kind = 'period';
  const cover = tile.querySelector<HTMLElement>('.app-history-cover')!;
  cover.classList.add('app-history-stack');
  for (const row of rows.slice(1, 3)) {
    const layer = historyElement('img', undefined, 'app-history-stack-layer'); layer.alt = ''; layer.hidden = true;
    cover.prepend(layer); ctx.preview(row.id, tile, layer);
  }
  const badge = tile.querySelector<HTMLElement>('.app-history-kind > span:last-child');
  if (badge) badge.textContent = t('{count} checkpoints', { count: rows.length });
  const span = tile.querySelector<HTMLTimeElement>('.app-history-sub time');
  if (span && time(rows.at(-1)!.at) !== time(first.at)) span.textContent = `${time(rows.at(-1)!.at)} – ${time(first.at)}`;
  return tile;
}
