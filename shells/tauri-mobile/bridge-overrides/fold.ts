// SPDX-License-Identifier: MPL-2.0
/**
 * Fold signal for the web shell's layout module (plan 345, P4), so that module
 * needs no Tauri import.
 *
 * The lolly-fold plugin (plugins/lolly-fold) emits the Tauri event
 * `lolly://fold` on Android and answers the command `plugin:lolly-fold|current`.
 * This helper subscribes to the first, asks the second once at boot, and
 * re-dispatches what it learns in the shape the page can use without Tauri:
 *
 *   - a `lolly:fold` CustomEvent on `window`; `event.detail` is the payload or
 *     `null` (no folding feature),
 *   - a `window.__lollyFold` getter that returns the latest payload or `null`.
 *
 * Payload (CSS pixels, relative to the web view's own content area):
 *   { state: 'flat' | 'half-opened', orientation: 'vertical' | 'horizontal',
 *     bounds: { x, y, width, height }, isSeparating: boolean,
 *     occlusion: 'none' | 'full' } | null
 *
 * The controller takes its Tauri calls as arguments so it can be tested
 * without a webview. Bad payloads are dropped, never forwarded.
 */

export type FoldPayload = {
  state: 'flat' | 'half-opened';
  orientation: 'vertical' | 'horizontal';
  bounds: { x: number; y: number; width: number; height: number };
  isSeparating: boolean;
  occlusion: 'none' | 'full';
};

export const FOLD_TAURI_EVENT = 'lolly://fold';
export const FOLD_CURRENT_COMMAND = 'plugin:lolly-fold|current';
export const FOLD_DOM_EVENT = 'lolly:fold';

export type FoldSignalDeps = {
  invoke: (command: string) => Promise<unknown>;
  listen: (event: string, handler: (event: { payload: unknown }) => void) => Promise<unknown>;
  target: Pick<EventTarget, 'dispatchEvent'>;
};

/** The payload when `value` has exactly the documented shape, else `undefined`. */
export function parseFold(value: unknown): FoldPayload | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'object') return undefined;
  const v = value as Record<string, unknown>;
  const b = v.bounds as Record<string, unknown> | null | undefined;
  const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
  if (v.state !== 'flat' && v.state !== 'half-opened') return undefined;
  if (v.orientation !== 'vertical' && v.orientation !== 'horizontal') return undefined;
  if (v.occlusion !== 'none' && v.occlusion !== 'full') return undefined;
  if (typeof v.isSeparating !== 'boolean') return undefined;
  if (!b || !finite(b.x) || !finite(b.y) || !finite(b.width) || !finite(b.height)) return undefined;
  return {
    state: v.state,
    orientation: v.orientation,
    bounds: { x: b.x, y: b.y, width: b.width, height: b.height },
    isSeparating: v.isSeparating,
    occlusion: v.occlusion,
  };
}

export function createFoldSignal(deps: FoldSignalDeps): { current: () => FoldPayload | null; start: () => Promise<void> } {
  let latest: FoldPayload | null = null;
  let heardEvent = false;

  const publish = (payload: FoldPayload | null): void => {
    latest = payload;
    deps.target.dispatchEvent(new CustomEvent(FOLD_DOM_EVENT, { detail: payload }));
  };

  return {
    current: () => latest,
    async start() {
      // Listen first, then ask: an event that arrives while the command
      // is in flight is newer than its answer, so it wins.
      await deps.listen(FOLD_TAURI_EVENT, (event) => {
        const parsed = parseFold(event.payload);
        if (parsed === undefined) return;
        heardEvent = true;
        publish(parsed);
      });
      const parsed = parseFold(await deps.invoke(FOLD_CURRENT_COMMAND));
      if (parsed !== undefined && !heardEvent) publish(parsed);
    },
  };
}

let started = false;

/** Starts the signal once per page. If it fails to start, the page has no fold signal. */
export function startFoldSignal(deps: Omit<FoldSignalDeps, 'target'>): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  const signal = createFoldSignal({ ...deps, target: window });
  Object.defineProperty(window, '__lollyFold', { get: signal.current, configurable: true });
  signal.start().catch(() => {});
}
