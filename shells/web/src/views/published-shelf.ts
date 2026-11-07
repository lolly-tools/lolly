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
 */
import { escape } from '../utils.ts';
import { t, tRaw } from '../i18n.ts';
import type { WorkspaceTemplate } from '../lib/workspace-templates.ts';

export interface PublishedItem {
  /** Stable key: the template's catalog id. */
  key: string;
  name: string;
  /** The tool it opens. */
  toolId: string;
  /** What the second line says: the tool it is made with. */
  toolName: string;
  href: string;
  /** A short version label ("Version 3", "1.0.2"). */
  version: string;
  icon?: string;
  /** For a template, the values a preview draws from. */
  values?: Record<string, unknown>;
  formats?: readonly string[];
}

/** The shelf's items: templates of tools this person can open, then rules tools, by name. */
export function publishedItems(
  templates: readonly WorkspaceTemplate[],
  tools: ReadonlyArray<{ id: string; name: string; icon?: string; version?: string; formats?: readonly string[]; listed?: boolean; templateId?: unknown }>,
): PublishedItem[] {
  const byId = new Map(tools.map((tool) => [tool.id, tool]));
  const out: PublishedItem[] = [];
  for (const tpl of templates) {
    const tool = byId.get(tpl.toolId);
    if (tpl.retired || !tool) continue;
    out.push({
      key: tpl.id, name: tpl.name, toolId: tpl.toolId, toolName: tool.name,
      href: `#/tool/${encodeURIComponent(tpl.toolId)}?template=${encodeURIComponent(tpl.id)}`,
      version: tRaw('Version {n}', { n: tpl.version }),
      ...(tool.icon ? { icon: tool.icon } : {}), ...(tool.formats ? { formats: tool.formats } : {}),
    });
  }
  for (const tool of tools) {
    if (typeof tool.templateId !== 'string' || tool.listed === false) continue;
    out.push({
      key: tool.templateId, name: tool.name, toolId: tool.id, toolName: t('Share with rules'),
      href: `#/tool/${encodeURIComponent(tool.id)}`,
      version: tool.version ? tRaw('Version {n}', { n: tool.version }) : '',
      ...(tool.icon ? { icon: tool.icon } : {}), ...(tool.formats ? { formats: tool.formats } : {}),
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** The shelf's markup, or '' when there is nothing published (shelf absent). */
export function publishedShelfHtml(items: readonly PublishedItem[], workspace: string | undefined): string {
  if (!items.length) return '';
  const title = workspace ? tRaw('From {name}', { name: workspace }) : t('From your workspace');
  return `
      <section class="published-shelf" aria-label="${escape(title)}">
        <h2 class="published-shelf-title">${escape(title)}</h2>
        <div class="published-shelf-row">
          ${items.map((item) => `
          <a class="published-card" href="${escape(item.href)}" data-published-key="${escape(item.key)}">
            <span class="published-card-media" aria-hidden="true">${item.icon ? `<span class="published-card-icon">${item.icon}</span>` : ''}</span>
            <span class="published-card-text">
              <span class="published-card-name">${escape(item.name)}</span>
              <span class="published-card-sub">${escape([item.toolName, item.version].filter(Boolean).join(' · '))}</span>
            </span>
            <span class="published-card-use">${escape(t('Use'))}</span>
          </a>`).join('')}
        </div>
      </section>`;
}
