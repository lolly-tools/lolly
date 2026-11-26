// SPDX-License-Identifier: MPL-2.0
/**
 * What a read-only design system offers someone who can change it for their instance.
 * The instance decides who that is: its org-config grants the capability only to them,
 * so everyone else sees the system exactly as before, read-only and shown.
 */
import { t, tRaw } from '../../i18n.ts';
import { connectedInstance, onConnectedInstance, type ConnectedInstanceV1 } from '../brand-page-hosting.ts';

export interface ManagerActions {
  editLabel: string | null;
  publishLabel: string | null;
  /** The page's line about this read-only system, for someone who can edit this system. Null keeps the line unchanged. */
  note: string | null;
}

/** Which actions this person gets, from what the instance reported. */
export function managerActions(instance: ConnectedInstanceV1 | null): ManagerActions {
  return {
    editLabel: instance?.brandEdits ? tRaw('Edit for {host}', { host: instance.brandEdits.host }) : null,
    publishLabel: instance?.brandPages ? t('Publish a brand page') : null,
    note: instance?.brandEdits
      ? tRaw('This design system is read-only: its colours, type and logos are kept current from where it came. You can edit its colours, colour roles and brand page address for {host}. Make an editable copy for a personal version, or switch to another design system.', { host: instance.brandEdits.host })
      : null,
  };
}

/** Fill `slot` and `line`, now and whenever the instance's answer arrives or changes. Returns the way to stop. */
export function mountManagerActions(slot: HTMLElement, line: HTMLElement, handlers: { edit(): void; publish(): void }): () => void {
  const everyone = line.textContent;
  const paint = (instance: ConnectedInstanceV1 | null): void => {
    const { editLabel, publishLabel, note } = managerActions(instance);
    line.textContent = note ?? everyone;
    const buttons: HTMLElement[] = [];
    const button = (className: string, label: string, onClick: () => void): void => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = className;
      el.textContent = label;
      el.addEventListener('click', onClick);
      buttons.push(el);
    };
    if (editLabel) button('be-cta is-active', editLabel, handlers.edit);
    if (publishLabel) button('be-btn', publishLabel, handlers.publish);
    slot.replaceChildren(...buttons);
    slot.hidden = !buttons.length;
  };
  paint(connectedInstance());
  return onConnectedInstance(paint);
}
