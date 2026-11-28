// SPDX-License-Identifier: MPL-2.0
/**
 * Switch the active system from a child popover without navigating away, and
 * choose a colourway of the active system in the same place.
 *
 * The colourway row is the Settings control (components/colourway-pref.ts), not
 * a second one: the same dots, names and keys, saving the same choice. It sits
 * under the active system because the choice belongs to that system, and it is
 * absent when the system offers fewer than two colourways. A choice repaints
 * the app's chrome at once and leaves the view alone, as a switch of system
 * from this menu does: new work starts in the colourway from then on.
 */
import { mountBodyPopover } from './body-popover.ts';
import type { SwitchHost } from '../lib/design-system/switch.ts';
import { escape as esc } from '../utils.ts';
import { t } from '../i18n.ts';
import { icon } from '../lib/icons.ts';
import '../styles/parts/design-system-menu.css';

export function attachDesignSystemMenu(trigger: HTMLElement, host: SwitchHost): () => void {
  let generation = 0;
  let switching = false;
  let colourway: { destroy(): void } | null = null;
  const dropColourway = () => { colourway?.destroy(); colourway = null; };
  /** The Settings colourway control, for the active system, in `slot`. */
  const mountColourway = async (slot: HTMLElement, alive: () => boolean) => {
    const [{ mountColourwayPref }, { applyChromeBrandVars }, { currentTheme }] = await Promise.all([
      import('./colourway-pref.ts'),
      import('../brand-vars.ts'),
      import('../theme.ts'),
    ]);
    if (!alive() || !slot.isConnected) return;
    dropColourway();
    colourway = mountColourwayPref(slot, {
      host,
      // Light draws the light look; Dark and Brand draw the dark one, as the chrome does.
      look: () => (currentTheme() === 'light' ? 'light' : 'dark'),
      repaint: () => applyChromeBrandVars(host),
      onVisible: visible => { slot.hidden = !visible; },
    });
  };
  const menu = mountBodyPopover(trigger, (el, pop) => {
    const current = ++generation;
    el.innerHTML = `<p role="status">${esc(t('Loading…'))}</p>`;
    const alive = () => current === generation && el.isConnected;
    void (async () => {
      try {
        const [records, active] = await Promise.all([host.designSystems.visible(), host.designSystems.activeId()]);
        if (!alive()) return;
        el.innerHTML = records.map(record => `<button type="button" class="profile-menu-item" role="menuitemradio" aria-checked="${record.id === active}" data-system="${esc(record.id)}"><span>${esc(record.label)}</span>${record.id === active ? icon('check', { size: 18 }) : ''}</button>${record.id === active ? '<div class="design-system-menu-colourway" data-system-colourway hidden></div>' : ''}`).join('') + '<p role="status" data-system-status hidden></p>';
        const slot = el.querySelector<HTMLElement>('[data-system-colourway]');
        // Best effort: the list of systems works without the colourway row.
        if (slot) void mountColourway(slot, alive).catch(() => { slot.hidden = true; });
        const items = [...el.querySelectorAll<HTMLButtonElement>('[data-system]')];
        const selected = items.find(item => item.dataset.system === active) ?? items[0];
        const rove = (item: HTMLButtonElement) => {
          items.forEach(button => { button.tabIndex = button === item ? 0 : -1; });
          item.focus();
        };
        if (selected) rove(selected);
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
    className: 'profile-menu design-system-menu', ariaLabel: t('Design system'), trackSize: true, menuNavigation: { roving: true },
    onClose: () => { generation++; dropColourway(); },
  });
  const open = () => { if (!switching) menu.isOpen() ? menu.close(true) : menu.open(); };
  trigger.addEventListener('click', open);
  return () => { generation++; menu.close(); dropColourway(); trigger.removeEventListener('click', open); };
}
