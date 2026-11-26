// SPDX-License-Identifier: MPL-2.0

export function holdScreenAwake(): () => void {
  if (typeof navigator === 'undefined' || !navigator.wakeLock || typeof document === 'undefined') return () => {};
  const wakeLock = navigator.wakeLock;
  const page = document;
  let active = true;
  let pending = false;
  let sentinel: WakeLockSentinel | null = null;

  const request = async (): Promise<void> => {
    if (!active || pending || (sentinel && !sentinel.released) || page.visibilityState !== 'visible') return;
    pending = true;
    try {
      const next = await wakeLock.request('screen');
      if (active) sentinel = next;
      else await next.release();
    } catch { /* Recording can continue without a wake lock. */ }
    finally { pending = false; }
  };
  const onVisibility = (): void => { void request(); };
  page.addEventListener('visibilitychange', onVisibility);
  void request();

  return () => {
    if (!active) return;
    active = false;
    page.removeEventListener('visibilitychange', onVisibility);
    if (sentinel) void sentinel.release().catch(() => {});
    sentinel = null;
  };
}
