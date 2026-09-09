// SPDX-License-Identifier: MPL-2.0
/**
 * The spotlight overlay's boot registration, without the overlay.
 *
 * `components/spotlight.ts` is ~5 KB of panel chrome, grouping and combobox
 * navigation that only ever runs once someone searches - but its `initSpotlight`
 * had to be called synchronously at boot, because a bar with no registered hook
 * silently swallows the query and the ⌘/⌃Space chord (search-bar.ts's
 * `spotlightHook?.` reads). So the whole overlay sat on the render-blocking
 * preload set to reserve a slot it usually never uses (plans/155 WP-3).
 *
 * A SHIM, not a deferral. Deferring the registration to load/idle would have left
 * a real hole - on a slow cold load `window.load` can be seconds after the bar
 * paints, and the person typing in that window would get nothing, silently. What
 * registers here instead answers the bar's three questions from first paint and
 * fetches the overlay on the FIRST of them, then re-registers the real hook
 * (`registerSpotlightHook` is last-wins) and replays the query that triggered the
 * load. So the only observable difference is that the first search resolves a
 * chunk fetch later - the same trade the provider set already makes one layer in.
 *
 * `onKeydown` answers `false` while loading, which is correct rather than
 * convenient: it means "the bar handles this normally", and with no panel open
 * there is nothing for Arrow/Enter/Escape to act on - exactly what the real hook
 * returns in that state.
 */
import { registerSpotlightHook, SPOTLIGHT_LISTBOX_ID, type SpotlightHook } from './search-bar.ts';

/** Seam for the test: swapped so the shim can be driven without the real chunk. */
export const spotlightBootSeams = {
  load: (): Promise<typeof import('./spotlight.ts')> => import('./spotlight.ts'),
};

export function initSpotlightBoot(host: unknown): void {
  // The query that triggered the load, so it is answered rather than swallowed.
  // Last one in wins - a fast typist's keystrokes all land before the chunk does.
  let pending: string | null = null;
  // The in-flight load, so a second keystroke joins it instead of loading the chunk twice.
  let loading: Promise<void> | null = null;

  const load = (): void => {
    if (loading) return;
    loading = spotlightBootSeams.load()
      .then(m => { m.initSpotlight(host, pending); })
      .catch(err => {
        console.warn('[spotlight] overlay failed to load', err);
        loading = null;                     // let the next keystroke retry
      });
  };

  const shim: SpotlightHook = {
    onQueryChanged(raw) { pending = raw; load(); },
    onKeydown() { load(); return false; },
    // Nothing is open while the shim is still the hook, so there is nothing to
    // dismiss; once the overlay registers, its own onRouteChanged takes over.
    onRouteChanged() { /* no-op by construction */ },
  };
  registerSpotlightHook(shim, { listboxId: SPOTLIGHT_LISTBOX_ID });
}
