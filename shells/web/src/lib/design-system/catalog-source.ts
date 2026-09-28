// SPDX-License-Identifier: MPL-2.0
import { t, tRaw } from '../../i18n.ts';
import { escape as escapeHtml } from '../../utils.ts';
import { getInstanceBase } from '../instance.ts';
import { isTauriShell } from '../instance-choice.ts';
import type { DesignSystemRecord, DesignSystemRegistry } from './registry.ts';

export function catalogSourceLabel(): string {
  return isTauriShell() && !getInstanceBase() ? t('Bundled with this app') : t('Managed by this instance');
}

export function catalogSourceHtml(record: DesignSystemRecord): string {
  if (record.source.kind !== 'shipped') return '';
  const instance = getInstanceBase() || (isTauriShell() ? '' : window.location.origin);
  const namespace = record.headId.includes('/tokens/') ? `${record.headId.split('/tokens/')[0]}/` : '';
  return `<details class="ds-row-origin">
    <summary>${t('Catalogue source')}</summary>
    <dl>
      <dt>${t('Supplied by')}</dt><dd>${escapeHtml(instance || catalogSourceLabel())}</dd>
      <dt>${t('Tokens asset')}</dt><dd>${escapeHtml(record.headId || t('Not available yet'))}</dd>
      ${namespace ? `<dt>${t('Asset namespace')}</dt><dd>${escapeHtml(namespace)}</dd>` : ''}
    </dl>
    <p>${t('Removing a local copy does not remove these catalogue assets.')}</p>
    <a href="/info/operate/deployment.html#removing-a-catalogue-design-system">${t('How to change the supplied design system')}</a>
  </details>`;
}

export async function designSystemRemovalMessage(registry: DesignSystemRegistry, id: string): Promise<string> {
  const active = await registry.active();
  const next = active.id === id ? await registry.get('shipped') : active;
  if (!next) throw new Error(t('Could not read the design system that will remain active. Please try again.'));
  return [
    isTauriShell() ? t('Removes this design system from this device. Saved sessions and personal uploads stay.')
      : t('Removes this design system from this browser. Saved sessions and personal uploads stay.'),
    active.id === id ? tRaw('The supplied design system “{name}” will become active. Its colours, type and logos will be used.', { name: next.label })
      : tRaw('“{name}” will stay active.', { name: next.label }),
    t('Catalogue assets supplied by the instance or app remain available.'),
  ].join(' ');
}
