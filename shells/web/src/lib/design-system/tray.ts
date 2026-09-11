// SPDX-License-Identifier: MPL-2.0
/**
 * The persistent candidate tray (plan 97 SS8) - what a Source scan or a group-add
 * lands in before anything is committed to the design system. Model + persistence
 * only; the dockable panel / bottom sheet lives elsewhere.
 *
 * Candidates never overwrite each other silently: `add()` dedupes on type+value
 * (case-insensitive) so a rescanned source doesn't pile up duplicates, and a
 * previously-dismissed candidate coming back in a new scan is treated as live
 * information again - it revives to pending rather than staying buried.
 */

import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { DesignCensus } from './census.ts';

export type CandidateType = 'color' | 'font' | 'logo' | 'asset' | 'name';

export interface Candidate {
  id: string;
  type: CandidateType;
  value: string;
  label?: string;
  provenance: { kind: string; label: string; detail?: string };
  state: 'pending' | 'added' | 'dismissed';
}

const TRAY_KEY = 'start.tray.v1';

interface StoredTray {
  candidates: Candidate[];
}

/** Deterministic id for a (type, value) pair, stable across sessions and
 *  independent of a value's original casing or surrounding whitespace - this is
 *  the same key `add()` dedupes on, so a candidate always lands on the same slot. */
function candidateId(type: CandidateType, value: string): string {
  const norm = value.trim().toLowerCase();
  let h = 0x811c9dc5;
  for (let i = 0; i < norm.length; i++) {
    h ^= norm.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `${type}-${(h >>> 0).toString(16).padStart(8, '0')}`;
}

function dedupeKey(type: CandidateType, value: string): string {
  return `${type}:${value.trim().toLowerCase()}`;
}

/** Turns a scanned census into tray candidates: the top colours by weight, one
 *  candidate per font family, and the source's name if it has one. Gradients are
 *  not surfaced here - there is no `gradient` candidate type (plan 97 SS8). */
export function candidatesFromCensus(
  census: DesignCensus,
  opts?: { maxColors?: number },
): Candidate[] {
  const maxColors = opts?.maxColors ?? 12;
  const out: Candidate[] = [];

  const colors = [...census.colors]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, maxColors);
  for (const c of colors) {
    out.push({
      id: candidateId('color', c.hex),
      type: 'color',
      value: c.hex,
      provenance: { kind: census.source.kind, label: census.source.label, detail: c.kind },
      state: 'pending',
    });
  }

  // One candidate per family - usage/label come from whichever entry has the
  // highest individual count (the family's dominant role wins ties left-to-right).
  const byFamily = new Map<string, { family: string; usage: string; bestCount: number }>();
  for (const f of census.fonts) {
    const key = f.family.trim().toLowerCase();
    const existing = byFamily.get(key);
    if (!existing) {
      byFamily.set(key, { family: f.family, usage: f.usage, bestCount: f.count });
    } else if (f.count > existing.bestCount) {
      existing.usage = f.usage;
      existing.bestCount = f.count;
    }
  }
  for (const f of byFamily.values()) {
    out.push({
      id: candidateId('font', f.family),
      type: 'font',
      value: f.family,
      provenance: { kind: census.source.kind, label: census.source.label, detail: f.usage },
      state: 'pending',
    });
  }

  if (census.name) {
    out.push({
      id: candidateId('name', census.name),
      type: 'name',
      value: census.name,
      provenance: { kind: census.source.kind, label: census.source.label },
      state: 'pending',
    });
  }

  return out;
}

export interface Tray {
  load(): Promise<void>;
  list(): Candidate[];
  add(candidates: Candidate[]): Promise<number>;
  markAdded(id: string): Promise<void>;
  dismiss(id: string): Promise<void>;
  clearSource(label: string): Promise<void>;
  subscribe(cb: () => void): () => void;
}

export function createTray(host: HostV1): Tray {
  let candidates: Candidate[] = [];
  const listeners = new Set<() => void>();

  const notify = () => { for (const cb of listeners) cb(); };

  const persist = async () => {
    await host.state.save(TRAY_KEY, { candidates } satisfies StoredTray);
  };

  return {
    async load() {
      const stored = (await host.state.load(TRAY_KEY)) as StoredTray | null;
      candidates = Array.isArray(stored?.candidates) ? stored.candidates : [];
    },

    list() {
      return candidates;
    },

    async add(incoming) {
      let added = 0;
      for (const c of incoming) {
        const key = dedupeKey(c.type, c.value);
        const existing = candidates.find((x) => dedupeKey(x.type, x.value) === key);
        if (!existing) {
          candidates.push({ ...c, state: 'pending' });
          added++;
        } else if (existing.state === 'dismissed') {
          existing.state = 'pending';
          added++;
        }
        // already pending or added - a genuine duplicate, nothing to do.
      }
      await persist();
      notify();
      return added;
    },

    async markAdded(id) {
      const c = candidates.find((x) => x.id === id);
      if (!c) return;
      c.state = 'added';
      await persist();
      notify();
    },

    async dismiss(id) {
      const c = candidates.find((x) => x.id === id);
      if (!c) return;
      c.state = 'dismissed';
      await persist();
      notify();
    },

    async clearSource(label) {
      candidates = candidates.filter((c) => !(c.provenance.label === label && c.state === 'pending'));
      await persist();
      notify();
    },

    subscribe(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
}
