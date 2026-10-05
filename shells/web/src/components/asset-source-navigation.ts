// SPDX-License-Identifier: MPL-2.0
import type { AssetSourceNode, CatalogSourceStatus } from '../lib/asset-source-tree.ts';
import { t } from '../i18n.ts';
import './asset-source-navigation.css';
export function mountAssetSourceNavigation(root: HTMLElement, nodes: AssetSourceNode[], selected: string, expanded: Set<string>, statuses: CatalogSourceStatus[], activate: (id: string) => void, changed?: () => void): () => void {
  const tree = document.createElement('div'); tree.className = 'asset-source-tree'; tree.setAttribute('role', 'tree'); tree.setAttribute('aria-label', t('Asset sources'));
  const flat: HTMLElement[] = [];
  function paint(): void {
    const focused = (document.activeElement as HTMLElement | null)?.dataset.sourceNode;
    tree.replaceChildren(); flat.length = 0;
    function branch(items: AssetSourceNode[], parent: HTMLElement, depth: number): void {
      if (depth > 16) return;
      for (const node of items) {
        const item = document.createElement('div'); item.setAttribute('role', 'treeitem'); item.dataset.sourceNode = node.id; item.tabIndex = -1; item.setAttribute('aria-level', String(depth)); item.setAttribute('aria-selected', String(selected === node.id));
        const row = document.createElement('div'); row.className = 'asset-source-row'; row.style.paddingInlineStart = `${(depth - 1) * 12}px`;
        const disclosure = document.createElement('button'); disclosure.type = 'button'; disclosure.className = 'btn btn--ghost btn--sm asset-source-disclosure'; disclosure.tabIndex = -1; disclosure.textContent = expanded.has(node.id) ? '▾' : '▸'; disclosure.setAttribute('aria-label', t(expanded.has(node.id) ? 'Collapse' : 'Expand'));
        if (node.children?.length) { item.setAttribute('aria-expanded', String(expanded.has(node.id))); disclosure.addEventListener('click', e => { e.stopPropagation(); expanded.has(node.id) ? expanded.delete(node.id) : expanded.add(node.id); paint(); }); } else disclosure.hidden = true;
        const label = document.createElement('span'); label.textContent = t(node.label); const count = document.createElement('span'); count.className = 'asset-source-count'; count.textContent = node.count === undefined ? '' : String(node.count); row.append(disclosure, label, count); item.append(row); parent.append(item); flat.push(item);
        const status = statuses.find(s => JSON.stringify([s.id]) === node.id);
        if (status && status.status !== 'current') { const notice = document.createElement('small'); notice.className = 'asset-source-health'; if (status.lastSyncedAt) notice.title = new Date(status.lastSyncedAt).toLocaleString(); notice.textContent = t(status.status === 'stale' ? 'Cached listing' : status.status === 'pending' ? 'Syncing' : 'Unavailable'); row.append(notice); }
        item.addEventListener('click', e => { e.stopPropagation(); focus(item); if (node.selectable === false && node.children) { expanded.has(node.id) ? expanded.delete(node.id) : expanded.add(node.id); paint(); } else { selected = node.id; activate(node.id); paint(); } });
        if (node.children?.length && expanded.has(node.id)) { const group = document.createElement('div'); group.setAttribute('role', 'group'); item.append(group); branch(node.children, group, depth + 1); }
      }
    }
    branch(nodes, tree, 1); const target = flat.find(x => x.dataset.sourceNode === focused) ?? flat.find(x => x.dataset.sourceNode === selected) ?? flat[0]; if (target) { target.tabIndex = 0; if (focused) target.focus(); } changed?.();
  }
  function focus(item: HTMLElement): void { for (const x of flat) x.tabIndex = x === item ? 0 : -1; item.focus(); }
  let typed = '', typedAt = 0;
  tree.addEventListener('keydown', e => {
    const item = (e.target as HTMLElement).closest<HTMLElement>('[role=treeitem]'); if (!item) return;
    const index = flat.indexOf(item), id = item.dataset.sourceNode!; let next: HTMLElement | undefined;
    if (e.key === 'ArrowDown') next = flat[Math.min(index + 1, flat.length - 1)];
    else if (e.key === 'ArrowUp') next = flat[Math.max(0, index - 1)];
    else if (e.key === 'Home') next = flat[0]; else if (e.key === 'End') next = flat.at(-1);
    else if (e.key === 'ArrowRight') { if (item.hasAttribute('aria-expanded') && !expanded.has(id)) { expanded.add(id); paint(); } else if (item.hasAttribute('aria-expanded')) next = flat[index + 1]; }
    else if (e.key === 'ArrowLeft') { if (expanded.has(id)) { expanded.delete(id); paint(); } else next = item.parentElement?.closest<HTMLElement>('[role=treeitem]') ?? undefined; }
    else if (e.key === 'Enter' || e.key === ' ') item.click();
    else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) { typed = Date.now() - typedAt > 700 ? e.key : typed + e.key; typedAt = Date.now(); next = [...flat.slice(index + 1), ...flat.slice(0, index + 1)].find(x => x.querySelector('.asset-source-row span')?.textContent?.toLowerCase().startsWith(typed.toLowerCase())); }
    else return;
    e.preventDefault(); e.stopPropagation(); if (next) focus(next);
  });
  root.append(tree); paint(); return () => tree.remove();
}
