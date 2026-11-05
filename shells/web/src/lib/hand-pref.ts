// SPDX-License-Identifier: MPL-2.0
/**
 * Dominant hand: which side the controls take in the two-pane (split) layout.
 *
 * A right-handed person draws with the right hand, so the controls go on the left
 * and the drawing hand keeps the canvas. A left-handed person gets the mirror. In a
 * right-to-left language the whole arrangement mirrors again, because the panes
 * follow the inline direction (styles/parts/split.css).
 *
 * The same model as lib/a11y-prefs.ts: the profile record (`Profile.hand`) is
 * canonical, localStorage holds only the FOUC mirror the index.html pre-paint script
 * reads, and the live switch is an attribute on <html>, `data-hand="left"`, present
 * ONLY for the left hand. Right is the default and writes nothing, so a page where
 * nobody chose is byte-identical to the shell without this module. The attribute
 * changes only where the panes sit; it never reaches inside the tool canvas or an
 * export stage.
 */

export type Hand = 'left' | 'right';

/** localStorage FOUC mirror key, read by the inline script in index.html. Holds
 *  `left` or nothing. */
export const HAND_STORE_KEY = 'lolly-hand';

/** The window event sent after the hand changes, for chrome laid out in JS. */
export const HAND_CHANGE_EVENT = 'lolly:hand-change';

/** The hand in force right now, read back from the applied attribute. */
export function currentHand(): Hand {
  return typeof document !== 'undefined' && document.documentElement.dataset.hand === 'left' ? 'left' : 'right';
}

/** Read a stored value. Anything but `left` is the default. */
export function readHand(v: unknown): Hand {
  return v === 'left' ? 'left' : 'right';
}

/**
 * Apply a hand to <html> and keep the mirror in step. Sends HAND_CHANGE_EVENT when
 * the hand actually changed, from the document's own window (a jsdom test host keeps
 * Node's global Event, which jsdom refuses).
 */
export function applyHand(hand: Hand | undefined): void {
  const d = document.documentElement.dataset;
  const before = currentHand();
  if (hand === 'left') d.hand = 'left';
  else delete d.hand;
  try {
    if (hand === 'left') localStorage.setItem(HAND_STORE_KEY, 'left');
    else localStorage.removeItem(HAND_STORE_KEY);
  } catch { /* storage blocked: the attribute still applied */ }
  const view = document.defaultView;
  if (view && currentHand() !== before) view.dispatchEvent(new view.Event(HAND_CHANGE_EVENT));
}

/**
 * Boot reconciliation: the profile is canonical. An untouched profile leaves what
 * the FOUC mirror applied; an explicit value is authoritative.
 */
export function hydrateHand(profileValue: unknown): void {
  if (profileValue === undefined) return;
  applyHand(readHand(profileValue));
}

/** The host slice this module persists through, the same weak shape as a11y-prefs. */
export interface HandHost {
  profile: {
    get(): Promise<object>;
    set?(profile: object): Promise<unknown>;
  };
}

/** Set the hand: apply at once, then persist to the profile as best it can. */
export async function setHand(host: HandHost, hand: Hand): Promise<void> {
  applyHand(hand);
  try {
    const profile = await host.profile.get();
    await host.profile.set?.({ ...profile, hand });
  } catch { /* best effort: the attribute is already live */ }
}

/** Hear every change of hand. Returns the unsubscribe. */
export function onHandChange(fn: (hand: Hand) => void): () => void {
  const listener = (): void => fn(currentHand());
  window.addEventListener(HAND_CHANGE_EVENT, listener);
  return () => window.removeEventListener(HAND_CHANGE_EVENT, listener);
}
