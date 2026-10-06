// SPDX-License-Identifier: MPL-2.0
/** Original-file viewers take priority over background thumbnail work. */
let active = 0;
const listeners = new Set<(busy: boolean) => void>();
export const previewIsActive = (): boolean => active > 0;
export function subscribePreviewActivity(listener: (busy: boolean) => void): () => void { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function beginPreviewActivity(): () => void {
  active++; for (const listener of listeners) listener(true); let ended = false;
  return () => { if (ended) return; ended = true; active--; if (!active) for (const listener of listeners) listener(false); };
}
