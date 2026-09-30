// SPDX-License-Identifier: MPL-2.0
/** Switch the active system from a child popover without navigating away. */
import { mountBodyPopover } from './body-popover.ts';
import type { SwitchHost } from '../lib/design-system/switch.ts';
import { escape as esc } from '../utils.ts';
import { t } from '../i18n.ts';
import { icon } from '../lib/icons.ts';
import '../styles/parts/design-system-menu.css';

export function attachDesignSystemMenu(trigger: HTMLElement, host: SwitchHost): () => void {
  let generation = 0;
  let switching = false;
  const menu = mountBodyPopover(trigger, (el, pop) => {
    const current = ++generation;
    el.innerHTML = `<p role="status">${esc(t('Loading…'))}</p>`;
    const alive = () => current === generation && el.isConnected;
    void (async () => {
      try {
        const [records, active] = await Promise.all([host.designSystems.list(), host.designSystems.activeId()]);
        if (!alive()) return;
        el.innerHTML = records.map(record => `<button type="button" class="profile-menu-item" role="menuitemradio" aria-checked="${record.id === active}" data-system="${esc(record.id)}"><span>${esc(record.label)}</span>${record.id === active ? icon('check', { size: 18 }) : ''}</button>`).join('') + '<p role="status" data-system-status hidden></p>';
        const items = [...el.querySelectorAll<HTMLButtonElement>('[data-system]')];
        const selected = items.find(item => item.dataset.system === active) ?? items[0];
        const rove = (item: HTMLButtonElement) => {
          items.forEach(button => { button.tabIndex = button === item ? 0 : -1; });
          item.focus();
        };
        if (selected) rove(selected);
        el.addEventListener('keydown', event => {
          if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const index = items.indexOf(document.activeElement as HTMLButtonElement);
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
          if (items[next]) rove(items[next]);
        });
        el.addEventListener('click', async event => {
          const button = (event.target as Element).closest<HTMLButtonElement>('[data-system]');
          if (!button || switching) return;
          if (button.dataset.system === active) { pop.close(true); return; }
          switching = true;
          items.forEach(item => { item.disabled = true; });
          el.setAttribute('aria-busy', 'true');
          try {
            const { switchDesignSystem } = await import('../lib/design-system/switch.ts');
            const result = await switchDesignSystem(host, button.dataset.system!, { noRemount: true });
            const label = trigger.querySelector('[data-ds-label]');
            if (label) label.textContent = result.record.label;
            if (alive()) pop.close(true);
          } catch (error) {
            if (alive()) {
              const status = el.querySelector<HTMLElement>('[data-system-status]')!;
              status.textContent = error instanceof Error ? error.message : t('Could not switch design system. Try again.');
              status.hidden = false;
              items.forEach(item => { item.disabled = false; });
              button.focus();
            }
          } finally { switching = false; el.removeAttribute('aria-busy'); }
        });
      } catch {
        if (alive()) el.innerHTML = `<p role="status">${esc(t('Could not load design systems. Try again.'))}</p>`;
      }
    })();
  }, {
    className: 'profile-menu design-system-menu', ariaLabel: t('Design system'), trackSize: true,
    onClose: () => { generation++; },
  });
  const open = () => { if (!switching) menu.isOpen() ? menu.close(true) : menu.open(); };
  trigger.addEventListener('click', open);
  return () => { generation++; menu.close(); trigger.removeEventListener('click', open); };
}
