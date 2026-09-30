// SPDX-License-Identifier: MPL-2.0
import type { Runtime } from '../../../../engine/src/runtime.ts';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { mountBodyPopover } from '../components/body-popover.ts';
import { mountTokenInputActions } from './input-token-actions.ts';
import { registerShareSection } from './share-sections.ts';
import { launchRulesCopy, shareCurrentWithRules } from './rules-launch.ts';
import { sessionInputReason } from './session-tool-draft.ts';
import { announce } from '../a11y.ts';
import { t } from '../i18n.ts';
import { resetDesignInputs } from './design-input-reset.ts';

export function mountRulesEntrypoints(runtime: Runtime, inputs: HTMLElement | null, snapshot: () => Record<string, unknown>, host?: HostV1, changed?: (id: string) => void): () => void {
  const manifest = runtime.manifest;
  const share = (inputId?: string): void => {
    const run = inputId ? launchRulesCopy(manifest.id, snapshot(), manifest.name, inputId) : shareCurrentWithRules(runtime, manifest.id, snapshot(), manifest.name);
    void run.catch(error => announce(String(error.message)));
  };
  const unregister = registerShareSection(context => {
    if (manifest.designTool || context.toolId !== manifest.id) return null;
    const section = document.createElement('section'); section.className = 'share-row';
    const button = document.createElement('button'); button.type = 'button'; button.className = 'btn'; button.textContent = t('Share as a reusable tool');
    button.addEventListener('click', () => { context.close?.(); share(); });
    const note = document.createElement('p'); note.textContent = t('Choose a few inputs people may edit. Deliver a portable .lolly file.');
    section.append(button, note); return section;
  });
  let active: ReturnType<typeof mountBodyPopover> | undefined;
  let activeButton: HTMLElement | undefined;
  let activeId: string | undefined;
  const currentButton = (id: string): HTMLElement | undefined => [...inputs?.querySelectorAll<HTMLElement>('.input-rule-actions') || []].find(button => button.dataset.inputActions === id);
  const attach = (): void => {
    for (const row of inputs?.querySelectorAll<HTMLElement>('.input-row') || []) {
      if (row.querySelector('.input-rule-actions')) continue;
      const id = row.querySelector<HTMLElement>('[data-input-id]')?.dataset.inputId;
      const spec = runtime.getModel().find(i => i.id === id);
      const declared = manifest.inputs.some(i => i.id === id);
      const label = row.querySelector('.input-label');
      if (!spec || !label) continue;
      const shareable = declared && !sessionInputReason(spec) && !row.querySelector('[inert]');
      if (!shareable && (!host?.tokens || !['number', 'text', 'longtext', 'select'].includes(spec.type))) continue;
      const button = document.createElement('button'); button.type = 'button'; button.className = 'btn btn--ghost input-rule-actions'; button.textContent = '…';
      button.setAttribute('aria-label', t('Actions for {name}', { name: String(spec.label || spec.id) })); button.dataset.tip = t('Input actions');
      button.dataset.inputActions = spec.id;
      button.setAttribute('aria-haspopup', 'dialog'); button.setAttribute('aria-expanded', 'false');
      button.addEventListener('click', event => {
        if (active?.isOpen() && activeId === id) { event.preventDefault(); event.stopPropagation(); active.close(true); return; }
        event.preventDefault(); event.stopPropagation(); active?.close();
        activeButton = button; activeId = id;
        let disposeTokens: (() => void) | undefined;
        const anchor = {
          getBoundingClientRect: () => (currentButton(spec.id) ?? button).getBoundingClientRect(),
          contains: (node: Node | null) => !!currentButton(spec.id)?.contains(node),
          focus: () => currentButton(spec.id)?.focus({ preventScroll: true }),
          setAttribute: (name: string, value: string) => currentButton(spec.id)?.setAttribute(name, value),
        };
        active = mountBodyPopover(anchor, (el, popover) => {
          if (shareable) {
            const expose = document.createElement('button'); expose.type = 'button'; expose.className = 'btn folder-menu-item'; expose.textContent = t(manifest.designTool ? 'Reset this input' : 'Use as a tool input');
            expose.addEventListener('click', () => { popover.close(); if (manifest.designTool) void resetDesignInputs(runtime, inputs!, [id!]); else share(id); }); el.append(expose);
          }
          const editor = row.querySelector<HTMLElement>('[data-input-id]');
          disposeTokens = mountTokenInputActions(el, runtime, host, spec.id, !!editor?.matches(':disabled,[readonly]'), () => { changed?.(spec.id); popover.close(true); });
          return el.querySelector<HTMLElement>('button');
        }, {
          className: 'folder-menu input-rule-menu', role: 'dialog', ariaLabel: t('Input actions'), trackScroll: true, trackSize: true,
          isInside: node => node instanceof Element && !!node.closest('.token-inspector-dialog'),
          onClose: () => { disposeTokens?.(); activeButton = undefined; activeId = undefined; },
        }); active.open();
      });
      label.append(button);
    }
    // A refreshed input invalidates the captured actions and restores its new trigger.
    if (activeButton && !activeButton.isConnected) active?.close(true);
  };
  const observer = new MutationObserver(attach);
  if (inputs && manifest.id !== 'design') { observer.observe(inputs, { childList: true, subtree: true }); attach(); }
  return () => { observer.disconnect(); active?.close(); unregister(); inputs?.querySelectorAll('.input-rule-actions').forEach(el => { el.remove(); }); };
}
