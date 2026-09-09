// SPDX-License-Identifier: MPL-2.0
/** Bounded, data-only comparison. No document rendering or live-tool mutation. */
export function revisionDifference(before: unknown, after: unknown): { paths: string[]; changed: number; truncated: boolean } {
  const queue: Array<{ a: unknown; b: unknown; path: string }> = [{ a: before, b: after, path: '' }];
  const paths: string[] = [];
  let visited = 0, changed = 0, collapsed = false;
  const change = (path: string): void => { changed++; if (paths.length < 50) paths.push(path || 'Document'); };
  while (queue.length && visited++ < 20_000) {
    const { a, b, path } = queue.pop()!;
    if (a === b) continue;
    if (a && b && typeof a === 'object' && typeof b === 'object' && Array.isArray(a) === Array.isArray(b)) {
      const left = a as Record<string, unknown>, right = b as Record<string, unknown>;
      const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])];
      // Avoid allocating an unbounded work queue for hostile/huge arrays.
      if (keys.length + queue.length > 20_000) { collapsed = true; change(path); continue; }
      for (const key of keys.reverse()) {
        if (!path && key.startsWith('__')) continue;
        const at = path ? `${path}.${key}` : key;
        if (!(key in left) || !(key in right)) change(at);
        else queue.push({ a: left[key], b: right[key], path: at });
      }
    } else change(path);
  }
  return { paths, changed, truncated: collapsed || queue.length > 0 || changed > paths.length };
}
