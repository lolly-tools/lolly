// SPDX-License-Identifier: MPL-2.0
import { assetBaseId } from './asset-favourites.ts';
const RECENTS_KEY = 'lolly:recentAssets';
export function readRecentAssets(): string[] {
  try { const v = JSON.parse(localStorage.getItem(RECENTS_KEY) || '[]'); return Array.isArray(v) ? v.filter(x => typeof x === 'string') : []; }
  catch { return []; }
}
export function recordRecentAsset(id: string): void {
  try {
    const base = assetBaseId(id);
    localStorage.setItem(RECENTS_KEY, JSON.stringify([base, ...readRecentAssets().filter(x => x !== base)].slice(0, 24)));
  } catch { /* storage off */ }
}
// Last-used tab per pick type (plans/134 P1) - a default, exactly like initialTab.
const TABMEM_KEY = 'lolly:pickerTab';
export function readTabMemory(kind: string): string | null {
  try { return (JSON.parse(localStorage.getItem(TABMEM_KEY) || '{}') as Record<string, string>)[kind] ?? null; }
  catch { return null; }
}
export function recordTabMemory(kind: string, tab: string): void {
  try {
    const m = JSON.parse(localStorage.getItem(TABMEM_KEY) || '{}') as Record<string, string>;
    m[kind] = tab;
    localStorage.setItem(TABMEM_KEY, JSON.stringify(m));
  } catch { /* storage off */ }
}
