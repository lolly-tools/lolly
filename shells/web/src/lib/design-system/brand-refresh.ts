// SPDX-License-Identifier: MPL-2.0
import './brand-refresh.css';
import type { syncCatalog as syncCatalogType } from '../../catalog/sync.ts';
import { t } from '../../i18n.ts';
import { instanceFetch, instancePath, getInstanceBase } from '../instance.ts';
import { REMOUNTABLE_ROUTES, switchDesignSystem, type SwitchHost } from './switch.ts';

interface RefreshDeps {
  initial: string;
  origin(): string;
  fetchRevision(): Promise<string | null>;
  canRefresh(): Promise<boolean>;
  refresh(): Promise<boolean>;
  notify(pending: boolean): void;
}

/** Recheck on host events; apply only where the mounted view holds no work. */
export function createBrandRefresh(deps: RefreshDeps) {
  let known = deps.initial;
  let running = false;
  return async () => {
    if (running) return;
    running = true;
    const origin = deps.origin();
    try {
      const revision = await deps.fetchRevision();
      if (!revision || origin !== deps.origin() || revision === known) return;
      if (!await deps.canRefresh()) { deps.notify(true); return; }
      if (origin !== deps.origin()) return;
      if (await deps.refresh() && origin === deps.origin()) { known = revision; deps.notify(false); }
      else deps.notify(true);
    } catch { /* Keep the last known source and cached material while offline. */ }
    finally { running = false; }
  };
}

export function mountBrandRefresh(host: SwitchHost, catalogHost: Parameters<typeof syncCatalogType>[0], revision: string, route: () => string): () => void {
  let lastCheck = 0;
  const note = document.createElement('aside');
  note.setAttribute('role', 'status');
  note.className = 'brand-refresh-note';
  note.hidden = true;
  note.textContent = t('The instance design system changed. Your current work and editable copies are preserved. Review design systems in your profile.');
  const link = document.createElement('a');
  link.href = '#/profile';
  link.textContent = t('Review design systems');
  note.append(' ', link);
  document.body.append(note);
  const check = createBrandRefresh({
    initial: revision, origin: getInstanceBase,
    fetchRevision: async () => {
      const response = await instanceFetch(instancePath('/api/v1/instance'), { cache: 'no-store', signal: AbortSignal.timeout(5000) });
      if (!response.ok) return null;
      const body = await response.json() as { brand?: { revision?: unknown }; branding?: { revision?: unknown } };
      const next = body.branding?.revision ?? body.brand?.revision;
      return typeof next === 'string' ? next : null;
    },
    canRefresh: async () => {
      host.designSystems.bust();
      return (await host.designSystems.active()).source.kind === 'shipped' && REMOUNTABLE_ROUTES.has(route());
    },
    refresh: async () => {
      const origin = getInstanceBase();
      const { syncCatalog, syncCorePrefetch, networkStatus } = await import('../../catalog/sync.ts');
      await syncCatalog(catalogHost);
      if (networkStatus.offline) return false;
      await syncCorePrefetch(catalogHost);
      host.designSystems.bust();
      if (origin !== getInstanceBase() || !REMOUNTABLE_ROUTES.has(route()) || (await host.designSystems.active()).source.kind !== 'shipped') return false;
      await switchDesignSystem(host, 'shipped', { route: route() });
      return true;
    },
    notify: pending => { note.hidden = !pending; },
  });
  const focus = () => {
    if (document.hidden || Date.now() - lastCheck < 30_000) return;
    lastCheck = Date.now(); void check();
  };
  const reconnect = () => { lastCheck = 0; focus(); };
  window.addEventListener('focus', focus);
  window.addEventListener('online', reconnect);
  window.addEventListener('hashchange', reconnect);
  document.addEventListener('visibilitychange', focus);
  return () => {
    window.removeEventListener('focus', focus); window.removeEventListener('online', reconnect);
    window.removeEventListener('hashchange', reconnect); document.removeEventListener('visibilitychange', focus); note.remove();
  };
}
