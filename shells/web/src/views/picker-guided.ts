// SPDX-License-Identifier: MPL-2.0
import type { CollectOpts } from './picker.ts';
import { mountBodyPopover, type BodyPopoverHandle } from '../components/body-popover.ts';
import './picker-guided.css';

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
