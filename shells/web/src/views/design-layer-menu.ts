// SPDX-License-Identifier: MPL-2.0
/** Layer moves use stable owners and one document commit; geometry stays in canvas space. */
import type { Box } from './free-canvas-math.ts';
import type { DesignPage, ModelPort } from './design-ports.ts';
import { designHierarchyDescendants, designHierarchyIndex, reparentDesignHierarchy } from '../../../../engine/src/design-hierarchy.ts';
import { mountBodyPopover } from '../components/body-popover.ts';
import { tRaw as t } from '../i18n.ts';

export function openDesignLayerMenu(opts: { row: HTMLElement; id: string; model: ModelPort; pages?: DesignPage[]; canEdit(): boolean; rename(): void }) {
  const doc = opts.row.ownerDocument;
  const popover = mountBodyPopover(opts.row, (el, pop) => {
    const boxes = opts.model.getBoxes(), pages = opts.pages;
    const index = designHierarchyIndex(boxes, pages), box = index.byId.get(opts.id);
    const subtree = designHierarchyDescendants(index, new Set([opts.id])), page = index.pageById.get(opts.id);
    const action = (label: string, run: () => void): void => {
      const button = doc.createElement('button'); button.type = 'button'; button.className = 'fc-nav-menu-item'; button.textContent = label;
      button.setAttribute('role', 'menuitem'); button.disabled = !opts.canEdit(); button.onclick = () => { if (opts.canEdit()) run(); }; el.append(button);
    };
    const move = (parent: string): void => {
      if (!opts.canEdit()) return;
      const current = opts.model.getBoxes();
      const next = reparentDesignHierarchy(current, new Set([opts.id]), parent, page, pages) as Box[];
      pop.close(); opts.model.commit(next, undefined, t('Move layer'));
    };
    action(t('Rename layer'), () => { pop.close(); opts.rename(); });
    if (box?.kind === 'group') action(t('Select group contents'), () => { pop.close(); opts.row.dispatchEvent(new CustomEvent('design-enter-group', { bubbles: true, detail: opts.id })); });
    if (index.parent.has(opts.id)) action(t('Move outside group'), () => move(index.parent.get(index.parent.get(opts.id)!) || ''));
    const candidates = [...index.byId.values()].filter(candidate => !subtree.has(String(candidate.id)) && index.pageById.get(String(candidate.id)) === page
      && (candidate.kind === 'group' || candidate.kind === 'frame' || candidate.layout === 'flex' || candidate.layout === 'grid'));
    if (candidates.length) action(t('Move into...'), () => {
      el.setAttribute('role', 'group'); el.replaceChildren();
      const search = doc.createElement('input'); search.type = 'search'; search.maxLength = 1000; search.className = 'fc-nav-parent-search'; search.placeholder = t('Find a group or artboard'); search.setAttribute('aria-label', t('Find a group or artboard'));
      const results = doc.createElement('div'); results.className = 'fc-nav-parent-results'; results.setAttribute('role', 'menu'); results.setAttribute('aria-label', t('Move layer into'));
      el.append(search, results);
      function render(): void {
        const query = search.value.trim().toLocaleLowerCase();
        const matches = candidates.filter(candidate => String(candidate.name || candidate.kind).toLocaleLowerCase().includes(query)).slice(0, 64);
        results.replaceChildren(...matches.map(candidate => {
          const button = doc.createElement('button'); button.type = 'button'; button.className = 'fc-nav-menu-item'; button.setAttribute('role', 'menuitem');
          button.textContent = String(candidate.name || (candidate.kind === 'frame' ? t('Artboard') : t('Group'))); button.onclick = () => move(String(candidate.id)); return button;
        }));
      }
      search.addEventListener('input', render);
      search.addEventListener('keydown', event => { if (event.key === 'ArrowDown') { event.preventDefault(); results.querySelector<HTMLElement>('button')?.focus(); } });
      render(); search.focus();
    });
    return el.querySelector<HTMLElement>('button:not(:disabled)');
  }, { className: 'fc-nav-menu fc-nav-layer-menu', ariaLabel: t('Layer actions'), menuNavigation: true, trackSize: true });
  popover.open(); return popover;
}
