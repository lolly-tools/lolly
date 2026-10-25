// SPDX-License-Identifier: MPL-2.0
/**
 * The one line that says where a design system came from: "Came with this
 * app", "Edited here", "Hosted at brand.example. Synced 5 min ago". A module of
 * its own so the Settings tab can name a system's source without loading the
 * Preferences card and its dialogs; the card re-exports sourceLine.
 */
import { t, tRaw } from '../../i18n.ts';
import { catalogSourceLabel } from './catalog-source.ts';
import type { DesignSystemRecord } from './registry.ts';

/**
 * What a row says under its label. Plain sentences, "design system" not "brand".
 * Plain text, not markup: a name in it is not escaped, so a file by O'Brien
 * reads O'Brien. Escape it for an HTML sink.
 */
export function sourceLine(record: DesignSystemRecord, now = Date.now()): string {
  const s = record.source;
  switch (s.kind) {
    case 'shipped': return catalogSourceLabel(record);
    case 'local':
      if (s.from === 'app') return t('Came with this app');
      if (s.from === 'shipped') return t('Edited here');
      return s.forkedFrom ? tRaw('Made here, copied from {name}', { name: s.forkedFrom.id }) : t('Made here');
    case 'file': return s.publisher ? tRaw('From a file by {publisher}', { publisher: s.publisher }) : t('From a file');
    case 'hosted': {
      const host = s.instance.replace(/^https?:\/\//, '');
      const when = s.lastSyncedAt ? relativeTime(now - s.lastSyncedAt) : null;
      if (s.stale) return tRaw('Hosted at {host}. Update available when online', { host });
      return when ? tRaw('Hosted at {host}. Synced {when}', { host, when }) : tRaw('Hosted at {host}', { host });
    }
  }
}

/** How long ago a sync was, from its age in milliseconds. */
function relativeTime(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60000));
  if (m < 2) return t('just now');
  if (m < 60) return t('{n} min ago', { n: m });
  const h = Math.round(m / 60);
  if (h < 48) return t('{n} h ago', { n: h });
  return t('{n} days ago', { n: Math.round(h / 24) });
}
