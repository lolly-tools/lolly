// SPDX-License-Identifier: MPL-2.0
import { assetDependency } from '../../../../engine/src/asset-version.ts';
import type { AssetVersionPin } from '../../../../engine/src/asset-version.ts';

export interface RevisionDependency {
  key: string;
  id: string;
  label: string;
  source: string;
  type: string;
  format?: string;
  pin?: AssetVersionPin;
  kind: 'stored' | 'embedded' | 'unverified' | 'invalid';
  /** Only recognised typed references may be changed in a repair copy. */
  references: Record<string, unknown>[];
}

/** A bounded, iterative walk over saved inputs. No string guessing, recursive
 * asset decoding, network, or mutable catalog lookup while browsing history. */
export function revisionDependencies(data: unknown): { dependencies: RevisionDependency[]; truncated: boolean } {
  const dependencies = new Map<string, RevisionDependency>();
  let visited = 0, truncated = false;
  const add = (dep: RevisionDependency): void => {
    const prior = dependencies.get(dep.key);
    if (prior) prior.references.push(...dep.references);
    else if (dependencies.size < 128) dependencies.set(dep.key, dep);
    else truncated = true;
  };
  // Iterators avoid allocating an unbounded pending list for a wide document.
  const stack: Iterator<unknown>[] = [[data][Symbol.iterator]()];
  while (stack.length) {
    const next = stack[stack.length - 1]!.next();
    if (next.done) { stack.pop(); continue; }
    if (++visited > 20_000) { truncated = true; break; }
    const value = next.value;
    if (typeof value === 'string' && value.includes('#lolly-version=')) {
      // A URL-mode pin can occur in a string input. Without that tool's schema
      // we cannot distinguish an asset input from text; never rewrite it.
      add({ key: JSON.stringify(['link', value]), id: value, label: value, source: '', type: '', kind: 'unverified', references: [] });
      continue;
    }
    if (!value || typeof value !== 'object') continue;
    const ref = value as Record<string, unknown>;
    if (typeof ref.id === 'string' && ['user', 'library', 'remote'].includes(String(ref.source))) {
      const meta = ref.meta && typeof ref.meta === 'object' ? ref.meta as Record<string, unknown> : {};
      const label = typeof meta.name === 'string' && meta.name ? meta.name : ref.id;
      const base = { id: ref.id, label, source: String(ref.source), type: typeof ref.type === 'string' ? ref.type : '', references: [ref] };
      try {
        if (ref.id.length > 2048) throw new Error();
        const dep = assetDependency(ref as { id: string });
        const format = dep.pin?.format ?? (typeof ref.format === 'string' ? ref.format : undefined);
        const embedded = meta.baked === true && typeof ref.url === 'string' && /^data:[^,]*,/i.test(ref.url);
        const kind = embedded ? 'embedded' : meta.baked === true || ref.source === 'remote' || !base.type || !format
          || /^(?:https?:|data:|zzfx)/i.test(dep.id) ? 'unverified' : 'stored';
        const key = JSON.stringify([ref.source, dep.id, dep.modifier, dep.pin ?? null, format, base.type, kind]);
        add({ ...base, ...dep, key, format, kind });
      } catch { add({ ...base, key: JSON.stringify(['invalid', ref.id]), kind: 'invalid' }); }
      continue;
    }
    if (stack.length >= 64) { truncated = true; continue; }
    stack.push((Array.isArray(value) ? value : Object.values(value))[Symbol.iterator]());
  }
  return { dependencies: [...dependencies.values()], truncated };
}
