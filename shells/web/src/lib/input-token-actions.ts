// SPDX-License-Identifier: MPL-2.0
/** Token details live inside the existing input actions popover. */
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { Runtime } from '../../../../engine/src/runtime.ts';
import { withTokenSelection } from '../../../../engine/src/token-context.ts';
import { mountTokenBindingField } from '../components/token-binding-field.ts';
import { getInputPolicy, policyLocksControl } from './input-policy.ts';
import { t } from '../i18n.ts';

export function mountTokenInputActions(root: HTMLElement, runtime: Runtime, host: HostV1 | undefined,
  id: string, readOnly: boolean, applied: () => void): (() => void) | undefined {
  const input = runtime.getModel().find(item => item.id === id);
  const policy = getInputPolicy(runtime.manifest.id, id);
  if (!host?.tokens || !input || !['number', 'text', 'longtext', 'select'].includes(input.type) || policy?.mode === 'hidden') return;
  const options = policy?.mode === 'choice' && policy.allow
    ? input.options?.filter(option => policy.allow!.includes(String(option.value))) : input.options;
  const section = document.createElement('section'); section.className = 'input-token-actions';
  const heading = document.createElement('div'); heading.className = 'folder-menu-head'; heading.textContent = t('Design token');
  const field = document.createElement('div'); field.dataset.tokenInput = id;
  section.append(heading, field); root.append(section);
  const scoped = runtime.tokenSelection ? withTokenSelection(host, runtime.tokenSelection) : host;
  const locked = readOnly || policyLocksControl(input.control, policy) || (policy?.mode === 'choice' && options?.length === 0);
  const dispose = mountTokenBindingField(field, { ...input, options }, scoped, async value => {
    await runtime.setInput(id, value);
    applied();
  }, { readOnly: locked, restoreRef: input.restoreTokenRef });
  return () => { dispose(); section.remove(); };
}
