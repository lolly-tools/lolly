// SPDX-License-Identifier: MPL-2.0
import { t } from '../i18n.ts';
import { announce } from '../a11y.ts';
import type { CollectResult, CollectOpts } from './picker.ts';
import { mountBodyPopover, type BodyPopoverHandle } from '../components/body-popover.ts';
import './picker-guided.css';

export const collectOk = (r: CollectResult | boolean): boolean => typeof r === 'boolean' ? r : r.ok;
export const collectLabel = (r: CollectResult | boolean): string =>
  (typeof r === 'object' && r.label) || (collectOk(r) ? t('Added') : t('Couldn’t add'));

/** Show search counts on inactive tabs; an empty map clears the badges. */
export function renderTabCounts(root: HTMLElement, counts: ReadonlyMap<string, number>, activeTab: string): void {
  for (const button of root.querySelectorAll<HTMLElement>('.asset-picker-tab')) {
    button.querySelector('.asset-picker-tabcount')?.remove();
    const id = button.dataset.tab ?? '';
    const count = counts.get(id);
    if (count !== undefined && id !== activeTab) {
      const badge = document.createElement('span');
      badge.className = 'asset-picker-tabcount';
      badge.textContent = String(count);
      button.appendChild(badge);
    }
  }
}
// Flash a tile as added (green ✓ overlay) or failed, then restore - the dialog stays
// open so several items can be gathered in a row. The card owns `position:relative`
// already (the format badge sits on it), so the overlay pins cleanly.
export function flashCard(el: HTMLElement, r: CollectResult | boolean): void {
  const ok = collectOk(r), label = collectLabel(r);
  const card = el.closest<HTMLElement>('.asset-picker-toolcell, .asset-picker-card, .asset-picker-toolitem') ?? el;
  card.classList.add(ok ? 'is-added' : 'is-addfail');
  const badge = document.createElement('span');
  badge.className = 'asset-picker-added';
  badge.textContent = (ok ? '✓ ' : '') + label;
  card.appendChild(badge);
  announce(label);
  setTimeout(() => { badge.remove(); card.classList.remove('is-added', 'is-addfail'); }, 1200);
}

/** Optional collection summary for callers gathering several items in one visit. */
export function guidedCollection(source: CollectOpts, root: HTMLElement): CollectOpts {
  if (!source.guided) return source;
  let count = 0;
  const track =
    <A>(callback: (arg: A) => ReturnType<CollectOpts['onAsset']>) =>
    async (arg: A) => {
      const result = await callback(arg);
      if (typeof result === 'boolean' ? result : result.ok) count++;
      const status = root.querySelector('[data-collection-count]');
      if (status) status.textContent = `${count} ${count === 1 ? 'item' : 'items'} added`;
      return result;
    };
  return {
    ...source,
    onAsset: track(source.onAsset),
    onSession: track(source.onSession),
    onQuickAddTool: track(source.onQuickAddTool),
  };
}

export function mountGuidedCollection(
  root: HTMLElement,
  opts: CollectOpts,
  done: () => void
): () => void {
  const footer = root.querySelector<HTMLElement>('.asset-picker-footer');
  if (!footer || !opts.guided) return () => {};
  root.classList.add('asset-picker-guided');
  const revealTab = requestAnimationFrame(() =>
    root
      .querySelector<HTMLElement>('[role=tab][aria-selected=true]')
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  );
  const hint = document.createElement('p');
  hint.className = 'asset-picker-collection-hint';
  hint.textContent = opts.guided.hint;
  root.querySelector('.asset-picker-body')!.before(hint);
  const extras = [...footer.querySelectorAll<HTMLButtonElement>('button')];
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'btn btn--ghost';
  trigger.textContent = 'Create or edit';
  trigger.setAttribute('aria-haspopup', 'true');
  trigger.setAttribute('aria-expanded', 'false');
  const tools = document.createElement('div');
  tools.className = 'asset-picker-collection-tools';
  tools.hidden = true;
  for (const button of extras) {
    button.classList.add('btn', 'btn--ghost');
    tools.append(button);
  }
  footer.append(tools);
  let menu: BodyPopoverHandle | undefined;
  if (extras.length) {
    footer.append(trigger);
    menu = mountBodyPopover(
      trigger,
      (el, handle) => {
        tools.hidden = false;
        el.append(tools);
        // Keep the original nodes and their upload/capture listeners alive.
        el.addEventListener('click', () => handle.close());
        return tools.querySelector('button');
      },
      {
        className: 'folder-menu ctx-menu',
        role: 'group',
        ariaLabel: 'Create or edit content',
        container: root,
        onClose: () => {
          tools.hidden = true;
          footer.append(tools);
        },
      }
    );
    trigger.addEventListener('click', () => (menu?.isOpen() ? menu.close() : menu?.open()));
  }
  const status = document.createElement('span');
  status.dataset.collectionCount = '';
  status.setAttribute('role', 'status');
  status.textContent = '0 items added';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn btn--primary';
  button.dataset.collectionDone = '';
  button.textContent = 'Done';
  button.addEventListener('click', done);
  footer.append(status, button);
  return () => {
    cancelAnimationFrame(revealTab);
    menu?.close(false);
  };
}

/** Transient feedback for additions that have no tile, such as pasted assets. */
export function createCollectToast(root: HTMLElement): (result: CollectResult | boolean) => void {
  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  return (r) => {
    const ok = collectOk(r), label = collectLabel(r);
    let toast = root.querySelector<HTMLElement>('.asset-picker-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'asset-picker-toast';
      toast.setAttribute('role', 'status');
      root.querySelector('.asset-picker-panel')?.appendChild(toast);
    }
    toast.textContent = (ok ? '✓ ' : '') + label;
    toast.classList.toggle('is-fail', !ok);
    toast.classList.add('is-shown');
    announce(label);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast?.classList.remove('is-shown'), 1600);
  };
}
