// SPDX-License-Identifier: MPL-2.0
import { t, tRaw } from '../../i18n.ts';
import { escape as escapeHtml, safeHref } from '../../utils.ts';
import { getInstanceBase, instanceFetch } from '../instance.ts';
import { networkStatus } from '../../catalog/sync.ts';
import { isTauriShell } from '../instance-choice.ts';
import { stripTokensSuffix, type DesignSystemRecord, type DesignSystemRegistry } from './registry.ts';
import { pickHeadAssetId } from '../../../../../engine/src/design-version.ts';

/** Preview the incoming source without changing the current connection. Loaded
 *  pack assets remain part of the catalogue; removing a record is not Leave. */
export async function removalFallback(registry: DesignSystemRegistry, id: string): Promise<DesignSystemRecord> {
  const active = await registry.active();
  const next = active.id === id ? await registry.get('shipped') : active;
  if (!next) throw new Error(t('Could not read the design system that will remain active. Please try again.'));
  const owned = active.source.kind === 'hosted' || active.source.kind === 'file' ? active.source.instance : '';
  if (active.id !== id || !owned || owned !== getInstanceBase()) return next;
  const origin = isTauriShell() ? '' : window.location.origin;
  try {
    const response = await instanceFetch('/catalog/assets/index.json', { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error('Catalogue unavailable');
    const index = await response.json() as { brandTokens?: string | null; assets?: Array<{
      id: string; type?: string; name?: string; version?: string; checksum?: string;
      formats?: Array<{ format: string; checksum?: string }>;
    }> };
    const tokens = (index.assets ?? []).filter(asset => asset.type === 'tokens');
    const head = 'brandTokens' in index ? index.brandTokens : pickHeadAssetId(tokens.map(asset => asset.id));
    const asset = tokens.find(asset => asset.id === head);
    return { ...next, label: asset?.name ? stripTokensSuffix(asset.name) : t('Catalogue design system'), headId: asset?.id ?? '',
      catalog: { origin, available: !!asset, version: asset?.version, checksum: asset?.checksum ?? asset?.formats?.find(format => format.format === 'json')?.checksum } };
  } catch {
    return { ...next, label: t('Catalogue design system'), headId: '', catalog: { origin, available: false } };
  }
}

export function catalogSourceLabel(): string {
  return isTauriShell() && !getInstanceBase() ? t('Bundled with this app') : t('Managed by this instance');
}

export function catalogSourceHtml(record: DesignSystemRecord, adminHref?: string | null): string {
  if (record.source.kind !== 'shipped') return '';
  const instance = record.catalog?.origin || (networkStatus.offline ? '' : getInstanceBase() || (isTauriShell() ? '' : window.location.origin));
  const namespace = record.headId.includes('/tokens/') ? `${record.headId.split('/tokens/')[0]}/` : '';
  const adminLink = adminHref && safeHref(adminHref)
    // nosemgrep: lolly-href-escape-is-not-scheme-validation - safeHref gates the link above
    ? `<a href="${escapeHtml(adminHref)}">${t('Manage instance design systems')}</a>` : '';
  return `<details class="ds-row-origin">
    <summary>${t('Catalogue source')}</summary>
    <dl>
      <dt>${t('Supplied by')}</dt><dd>${escapeHtml(instance || (networkStatus.offline ? t('Last-known origin unavailable') : catalogSourceLabel()))}</dd>
      <dt>${t('Tokens asset')}</dt><dd>${escapeHtml(record.headId || t('Not available yet'))}</dd>
      ${namespace ? `<dt>${t('Asset namespace')}</dt><dd>${escapeHtml(namespace)}</dd>` : ''}
      ${record.catalog?.version ? `<dt>${t('Version')}</dt><dd>${escapeHtml(record.catalog.version)}</dd>` : ''}
      ${record.catalog?.checksum ? `<dt>${t('Checksum')}</dt><dd>${escapeHtml(record.catalog.checksum)}</dd>` : ''}
    </dl>
    ${networkStatus.offline ? `<p>${t('Cached catalogue. The instance could not be reached for a refresh.')}</p>` : ''}
    ${record.catalog?.available === false ? `<p>${t('No selected tokens asset is available. Refresh the catalogue or ask the administrator to check its source.')}</p>` : ''}
    <p>${t('Removing a local copy does not remove these catalogue assets.')}</p>
    <a href="/info/operate/deployment.html#removing-a-catalogue-design-system">${t('How to change the supplied design system')}</a>
    ${adminLink}
  </details>`;
}

export async function designSystemRemovalMessage(registry: DesignSystemRegistry, id: string, fallback?: DesignSystemRecord): Promise<string> {
  const active = await registry.active();
  const next = fallback ?? await removalFallback(registry, id);
  return [
    isTauriShell() ? t('Removes this design system from this device. Saved sessions and personal uploads stay.')
      : t('Removes this design system from this browser. Saved sessions and personal uploads stay.'),
    active.id === id ? next.catalog?.available === false
      ? t('Lolly will return to the catalogue supplied by this app or host. Its selected design system could not be verified. Cached material stays available until a refresh succeeds.')
      : tRaw('The supplied design system “{name}” will become active. Its colours, type and logos will be used.', { name: next.label })
      : tRaw('“{name}” will stay active.', { name: next.label }),
    next.catalog?.origin ? tRaw('Catalogue source: {origin}.', { origin: next.catalog.origin }) : '',
    t('Catalogue assets supplied by the instance or app remain available.'),
  ].join(' ');
}
