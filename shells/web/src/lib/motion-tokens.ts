// SPDX-License-Identifier: MPL-2.0
/**
 * The active design system's motion tokens, installed for keyframe evaluation
 * (plans/329).
 *
 * A keyframe can be bound to a design-system curve or spring by name (`et(<path>)` on
 * the kf wire). The engine resolves the name through a table this module installs with
 * `setKfEaseTokens`, read from `host.tokens` once and again whenever the design system
 * changes. Until the read finishes, and wherever a token is missing, a bound keyframe plays
 * the value its link carries, so nothing waits on this read and nothing breaks without one.
 *
 * `motionTokens()` is the same read for the chrome: the Keyframes popup's Design system
 * curves and the duration suggestions beside a length field.
 */
import { motionEaseMap, readHostMotionTokens, setKfEaseTokens, type MotionTokens } from '@lolly/engine';
import type { HostV1 } from '@lolly-tools/core/host-v1';

// DESIGN_SYSTEM_CHANGED_EVENT in lib/design-system/switch.ts, spelled here so this small
// module does not pull the whole switch onto every importer's graph.
const DESIGN_SYSTEM_CHANGED_EVENT = 'lolly:design-system-changed';

/** Fired on `window` when the installed motion tokens change, so open chrome can redraw. */
export const MOTION_TOKENS_EVENT = 'lolly:motion-tokens';

/** What this needs of a host: its tokens, and somewhere to log a missing one. */
interface MotionHost {
  tokens?: HostV1['tokens'];
  log?(level: 'info', msg: string): void;
}

let current: MotionTokens = { curves: [], durations: [] };
let currentKey = '';
let pending: Promise<MotionTokens> | null = null;
let lastHost: MotionHost | null = null;
let listening = false;

/** The motion tokens as last read; empty until the first read finishes. */
export function motionTokens(): MotionTokens {
  return current;
}

function install(host: MotionHost, read: MotionTokens): void {
  const key = JSON.stringify(read);
  setKfEaseTokens(motionEaseMap(read), {
    // A keyframe bound to a token this design system does not have plays the value its
    // link carries. Worth a line in the log, never an error.
    onMiss: (path) => host.log?.('info', `Motion token ${path} is not in this design system; the keyframe plays the curve it was saved with.`),
  });
  if (key === currentKey) return;
  current = read;
  currentKey = key;
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(MOTION_TOKENS_EVENT, { detail: read }));
}

/**
 * Read and install the design system's motion tokens. Memoised until the design system
 * changes; a host with no token API leaves whatever is installed in place.
 */
export function ensureMotionTokens(host: MotionHost): Promise<MotionTokens> {
  lastHost = host;
  if (!listening && typeof window !== 'undefined') {
    listening = true;
    window.addEventListener(DESIGN_SYSTEM_CHANGED_EVENT, () => {
      pending = null;
      // After the switch's own listeners have dropped their cached token sets.
      setTimeout(() => { if (lastHost) void ensureMotionTokens(lastHost); }, 0);
    });
  }
  if (pending) return pending;
  const run = readHostMotionTokens(host)
    .then((read) => {
      if (read) install(host, read);
      return current;
    })
    .catch(() => current);
  pending = run;
  return run;
}

/** Test seam: forget the memo, so the next call reads again. */
export function resetMotionTokens(): void {
  pending = null;
}
