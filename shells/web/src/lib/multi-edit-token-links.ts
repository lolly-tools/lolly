// SPDX-License-Identifier: MPL-2.0
/**
 * Token links in multi-edit (plan 286, M5). A session card's input actions act on
 * that session alone, as the tool sidebar's do. The Shared card's actions reach
 * every session that declares the input through the bulk token field
 * (lib/token-bulk-field.ts), which reviews a link before anything is written.
 */
import '../styles/parts/design-rules.css';   // the input actions trigger and menu
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { InputModelItem } from '../../../../engine/src/inputs.ts';
import { mountBodyPopover, type BodyPopoverHandle } from '../components/body-popover.ts';
import { mountTokenInputActions } from './input-token-actions.ts';
import { BULK_TOKEN_TYPES } from './token-bulk-link.ts';
import { memberInput, mountBulkTokenField, type TokenMember } from './token-bulk-field.ts';
import { tRaw } from '../i18n.ts';

interface ActionMenuOptions {
  host: HostV1 | undefined;
  /** The input's model item, when this panel offers token actions for that input. */
  item: (id: string) => InputModelItem | undefined;
  /** Fill the open menu; returns its disposer. */
  build: (el: HTMLElement, id: string, popover: BodyPopoverHandle) => (() => void) | undefined;
}

/**
 * One "Input actions" trigger per eligible row, the same trigger and menu the tool
 * sidebar uses (lib/rules-entrypoints.ts), re-attached when the panel repaints.
 */
function mountActionMenus(panel: HTMLElement, opts: ActionMenuOptions): () => void {
  let active: BodyPopoverHandle | undefined;
  let activeButton: HTMLElement | undefined;
  let activeId: string | undefined;
  const currentButton = (id: string): HTMLElement | undefined => [...panel.querySelectorAll<HTMLElement>('.input-rule-actions')].find(button => button.dataset.inputActions === id);
  const attach = (): void => {
    for (const row of panel.querySelectorAll<HTMLElement>('.input-row')) {
      if (row.querySelector('.input-rule-actions')) continue;
      const id = row.querySelector<HTMLElement>('[data-input-id]')?.dataset.inputId;
      const label = row.querySelector('.input-label');
      const item = id ? opts.item(id) : undefined;
      if (!id || !label || !item || !opts.host?.tokens || !BULK_TOKEN_TYPES.has(item.type)) continue;
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'btn btn--ghost input-rule-actions'; button.textContent = '…';
      button.setAttribute('aria-label', tRaw('Actions for {name}', { name: String(item.label || item.id) }));
      button.dataset.tip = tRaw('Input actions');
      button.dataset.inputActions = id;
      button.setAttribute('aria-haspopup', 'dialog'); button.setAttribute('aria-expanded', 'false');
      button.addEventListener('click', event => {
        event.preventDefault(); event.stopPropagation();
        if (active?.isOpen() && activeId === id) { active.close(true); return; }
        active?.close();
        activeButton = button; activeId = id;
        let dispose: (() => void) | undefined;
        const anchor = {
          getBoundingClientRect: () => (currentButton(id) ?? button).getBoundingClientRect(),
          contains: (node: Node | null) => !!currentButton(id)?.contains(node),
          focus: () => currentButton(id)?.focus({ preventScroll: true }),
          setAttribute: (name: string, value: string) => currentButton(id)?.setAttribute(name, value),
        };
        active = mountBodyPopover(anchor, (el, popover) => {
          dispose = opts.build(el, id, popover);
          return el.querySelector<HTMLElement>('button');
        }, {
          className: 'folder-menu input-rule-menu', role: 'dialog', ariaLabel: tRaw('Input actions'), trackScroll: true, trackSize: true,
          isInside: node => node instanceof Element && !!node.closest('.token-inspector-dialog, .token-bulk-dialog'),
          onClose: () => { dispose?.(); activeButton = undefined; activeId = undefined; },
        });
        active.open();
      });
      label.append(button);
    }
    if (activeButton && !activeButton.isConnected) active?.close(true);
  };
  const observer = new MutationObserver(attach);
  observer.observe(panel, { childList: true, subtree: true });
  attach();
  return () => { observer.disconnect(); active?.close(); panel.querySelectorAll('.input-rule-actions').forEach(el => { el.remove(); }); };
}

// The Design tool links tokens in its own layer inspector; the tool sidebar leaves it out too.
const ownInspector = (member: TokenMember): boolean => member.tool.manifest.id === 'design';

/** A session card: the tool sidebar's token actions against that session's runtime. */
export function mountMemberTokenActions(panel: HTMLElement, member: TokenMember, host: HostV1 | undefined, applied: () => void): () => void {
  return mountActionMenus(panel, {
    host,
    item: id => ownInspector(member) ? undefined : member.runtime?.getModel().find(item => item.id === id),
    build: (el, id, popover) => {
      const runtime = member.runtime;
      if (!runtime) return undefined;
      const editor = panel.querySelector<HTMLElement>(`[data-input-id="${CSS.escape(id)}"]`);
      return mountTokenInputActions(el, runtime, host, id, !!editor?.matches(':disabled,[readonly]'), () => {
        member.dirty = true; applied(); popover.close(true);
      });
    },
  });
}

/**
 * The Shared card: link, make custom or restore across every session that declares
 * the input. Cancelling the review leaves the menu open and every session unchanged.
 */
export function mountSharedTokenActions(panel: HTMLElement, host: HostV1 | undefined, membersOf: (id: string) => TokenMember[], applied: () => void): () => void {
  return mountActionMenus(panel, {
    host,
    item: id => { const members = membersOf(id); return members[0] && !members.some(ownInspector) ? memberInput(members[0], id) : undefined; },
    build: (el, id, popover) => {
      const members = membersOf(id);
      const input = members[0] ? memberInput(members[0], id) : undefined;
      if (!host?.tokens || !input) return undefined;
      const section = document.createElement('section'); section.className = 'input-token-actions';
      const heading = document.createElement('div'); heading.className = 'folder-menu-head'; heading.textContent = tRaw('Design token');
      const note = document.createElement('p'); note.className = 'input-token-note';
      note.textContent = tRaw('Applies to {n} designs. Linking shows which designs change before anything is written.', { n: members.length });
      const field = document.createElement('div'); field.dataset.tokenInput = id;
      section.append(heading, note, field); el.append(section);
      const dispose = mountBulkTokenField(field, {
        host, id, members, label: String(input.label || id),
        applied: () => { applied(); popover.close(true); },
      });
      return () => { dispose?.(); section.remove(); };
    },
  });
}
