// SPDX-License-Identifier: MPL-2.0
/**
 * A disposable whose real value is still loading: the shape a view hands back when the
 * thing it mounts lives in a module it imports on demand. destroy() works before the
 * import resolves (the mount then never happens) and after it (the mount is torn down).
 * A failed import leaves nothing mounted and nothing to destroy.
 */
export function deferredHandle(pending: Promise<{ destroy(): void }>): { destroy(): void } {
  let gone = false;
  let inner: { destroy(): void } | null = null;
  pending.then((h) => { if (gone) h.destroy(); else inner = h; }, () => { /* nothing was mounted */ });
  return { destroy() { gone = true; inner?.destroy(); inner = null; } };
}
