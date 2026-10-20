// SPDX-License-Identifier: MPL-2.0
/**
 * companions.ts - the design systems a catalog offers beside its own.
 *
 * A catalog ships one design system, the `shipped` record. Its assets index may
 * also name companions (`companionDesignSystems`, validated by
 * scripts/validate-catalog.ts): each is a tokens document this build can read,
 * either a tokens asset in the same catalog or the blank starter that every web
 * build bundles (starter.ts). lolly.tools lists the starter, so a person there
 * has Lolly Demo and Lolly Starter to switch between from the first visit.
 *
 * A companion becomes an ordinary local system: editable in the studio,
 * removable from the profile card, never activated by seeding. Each one is
 * seeded once per device. The profile KV remembers it (SEEDED_DESIGN_SYSTEMS_KEY),
 * so a system the person removed does not come back on the next sync. A locked
 * build (brandLock) is a single-system device and gets none.
 */
import { STARTER_TOKENS_ID, starterSeed, type StarterHost } from './starter.ts';
import { createDesignSystem, type ManageHost } from './manage.ts';
import type { DesignSystemRecord } from './registry.ts';

/** One `companionDesignSystems` entry of a catalog's assets index. */
export interface CompanionDesignSystem {
  /** A tokens asset id: one in this catalog, or `lolly/tokens/brand` (the bundled starter). */
  tokens: string;
  /** The name the system gets on this device. */
  label: string;
}

/** The well-formed entries of an index's `companionDesignSystems`, in order. */
export function readCompanionDesignSystems(value: unknown): CompanionDesignSystem[] {
  if (!Array.isArray(value)) return [];
  const out: CompanionDesignSystem[] = [];
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) continue;
    const { tokens, label } = entry as Record<string, unknown>;
    if (typeof tokens !== 'string' || !tokens || typeof label !== 'string' || !label.trim()) continue;
    if (out.some(c => c.tokens === tokens)) continue;
    out.push({ tokens, label: label.trim() });
  }
  return out;
}

export type CompanionHost = ManageHost & StarterHost;

async function companionDoc(host: CompanionHost, tokens: string): Promise<Record<string, unknown> | null> {
  // The starter reads the catalog's own copy first and the bundled one otherwise.
  if (tokens === STARTER_TOKENS_ID) return starterSeed(host);
  try {
    const blob = await host.assets._getBlob(tokens);
    const doc: unknown = blob ? JSON.parse(await blob.text()) : null;
    return typeof doc === 'object' && doc !== null && !Array.isArray(doc) ? doc as Record<string, unknown> : null;
  } catch { return null; }
}

/** Run `fn` in one tab of this origin at a time, where the browser has Web Locks. */
async function exclusively<T>(fn: () => Promise<T>): Promise<T> {
  const locks = (globalThis.navigator as { locks?: { request(name: string, cb: () => Promise<T>): Promise<T> } } | undefined)?.locks;
  return locks ? locks.request('lolly-companion-design-systems', fn) : fn();
}

/**
 * Give this device each companion it has not had yet. Returns the records made.
 * Never switches: the active system stays what it was.
 */
export async function seedCompanionDesignSystems(host: CompanionHost, companions: CompanionDesignSystem[]): Promise<DesignSystemRecord[]> {
  if (!companions.length) return [];
  return exclusively(async () => {
    const registry = host.designSystems;
    registry.bust();
    const shipped = await registry.get('shipped');
    if (!shipped || shipped.locked) return [];
    const done = new Set(await registry.seeded());
    const made: DesignSystemRecord[] = [];
    for (const companion of companions) {
      if (done.has(companion.tokens) || companion.tokens === shipped.headId) continue;
      const doc = await companionDoc(host, companion.tokens);
      if (!doc) continue; // not readable yet; the next sync tries again
      const record = await createDesignSystem(host, { label: companion.label, seedDoc: doc, source: { kind: 'local', from: 'app' } });
      await registry.markSeeded(companion.tokens, true);
      made.push(record);
    }
    return made;
  });
}
