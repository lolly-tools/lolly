// SPDX-License-Identifier: MPL-2.0
import type { Runtime } from '../../../../engine/src/runtime.ts';
import { mountBodyPopover } from '../components/body-popover.ts';
import { registerShareSection } from './share-sections.ts';
import { launchRulesCopy, shareCurrentWithRules } from './rules-launch.ts';
import { sessionInputReason } from './session-tool-draft.ts';
import { announce } from '../a11y.ts';
import { t } from '../i18n.ts';
import { resetDesignInputs } from './design-input-reset.ts';

export function mountRulesEntrypoints(runtime: Runtime, inputs: HTMLElement | null, snapshot: () => Record<string, unknown>): () => void {
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
  const attach = (): void => {
    for (const row of inputs?.querySelectorAll<HTMLElement>('.input-row') || []) {
      if (row.querySelector('.input-rule-actions')) continue;
      const id = row.querySelector<HTMLElement>('[data-input-id]')?.dataset.inputId;
      const spec = manifest.inputs.find(i => i.id === id);
      const label = row.querySelector('.input-label');
      if (!spec || sessionInputReason(spec) || !label || row.querySelector('[inert]')) continue;
      const button = document.createElement('button'); button.type = 'button'; button.className = 'btn btn--ghost input-rule-actions'; button.textContent = '…';
      button.setAttribute('aria-label', t('Actions for {name}', { name: String(spec.label || spec.id) })); button.dataset.tip = t('Input actions');
      button.addEventListener('click', event => {
        event.preventDefault(); event.stopPropagation(); active?.close();
        active = mountBodyPopover(button, el => {
          const expose = document.createElement('button'); expose.type = 'button'; expose.className = 'btn'; expose.textContent = t(manifest.designTool ? 'Reset this input' : 'Use as a tool input');
          expose.addEventListener('click', () => { active?.close(); if (manifest.designTool) void resetDesignInputs(runtime, inputs!, [id!]); else share(id); }); el.replaceChildren(expose); return expose;
        }, { className: 'folder-menu input-rule-menu', ariaLabel: t('Input actions') }); active.open();
      });
      label.append(button);
    }
  };
  const observer = new MutationObserver(attach);
  if (inputs && manifest.id !== 'design') { observer.observe(inputs, { childList: true, subtree: true }); attach(); }
  return () => { observer.disconnect(); active?.close(); unregister(); inputs?.querySelectorAll('.input-rule-actions').forEach(el => { el.remove(); }); };
}
