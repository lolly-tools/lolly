// SPDX-License-Identifier: MPL-2.0
/**
 * "Was this page opened with `?neuro`?" - the one question the boot path and the
 * visualizer's synchronous probe ask, and nothing else from lib/neuro-demo.ts.
 *
 * SPLIT OUT because both askers are first-paint work (main.ts's boot, and
 * lib/viz-support.ts, which the bridge builds), while what they are gating is a
 * docs-screenshot deep-link almost no page load carries. Answering it from
 * neuro-demo.ts meant the whole demo driver - the track pick, the state overrides,
 * the settle stamping - rode the render-blocking preload set of every visit
 * (plans/155 WP-3). neuro-demo.ts re-exports both names, so its own callers are
 * unchanged.
 *
 * Import-free at module level, and it must stay that way: viz-support.ts's whole
 * design is a probe that costs nothing to import.
 */

export type NeuroDemoMode = 'player' | 'viz';

// Read once per page load: the demo is a property of how the page was opened, so a
// later in-app hash navigation neither activates nor deactivates it.
let peeked: NeuroDemoMode | null | undefined;

/** The demo mode this page load was opened with, or null. Mirrors peekUrlLang in
 *  main.ts: the hash query first (#/?neuro=viz), then the search string. */
export function peekNeuroDemo(): NeuroDemoMode | null {
  if (peeked !== undefined) return peeked;
  if (typeof window === 'undefined') return (peeked = null);
  const hashQuery = window.location.hash.split('?')[1] ?? '';
  const v = new URLSearchParams(hashQuery).get('neuro')
    ?? new URLSearchParams(window.location.search).get('neuro');
  peeked = v === 'player' || v === 'viz' ? v : null;   // closed vocabulary - anything else is ignored
  return peeked;
}

/** Is this page load a ?neuro demo? The gate the dock/visualizer bypasses hang on. */
export function neuroDemoActive(): boolean { return peekNeuroDemo() !== null; }
