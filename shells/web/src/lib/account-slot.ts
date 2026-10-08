// SPDX-License-Identifier: MPL-2.0
/**
 * lib/account-slot.ts - one place in the header for the account the shell is signed in
 * with, when something connects the shell to an account at all.
 *
 * A neutral seam, like lib/profile-sections.ts and lib/share-sections.ts: the slot knows
 * nothing about who fills the slot. A deployment's optional control plane (src/org/) registers
 * the workspace account chip from its member branch, and its "Sign in" chip for a visitor
 * on an open workspace. With nothing registered there is no slot, no observer and no
 * extra element, so a plain deployment renders its header exactly as before.
 *
 * The header is the top-right cluster the browse and utility views share
 * (`.gallery-topright`, components/view-topbar.ts and mountProfileFab). The views build
 * that cluster themselves and rebuild it when they render again, so the slot follows it:
 * while a provider is registered, a mutation observer on the app root looks for a cluster
 * with no slot (at most once a frame) and adds one in front of the profile control, then
 * calls the provider's `mount` on the new slot. A slot whose cluster went away is cleaned up the
 * same way. Views never import this module.
 */

/** What fills the slot. `mount` gets an empty element already in the header and returns
 *  the function that takes its listeners down again. */
export interface AccountSlotProvider {
  mount(into: HTMLElement): () => void;
}

/** The attribute every slot carries, so a cluster that already has one is left alone. */
export const ACCOUNT_SLOT_ATTR = 'data-account-slot';
const CLUSTER_SELECTOR = '.gallery-topright';
/** The control the slot goes in front of: the profile pill, or the square profile button. */
const PROFILE_SELECTOR = ':scope > .profile-link, :scope > .profile-fab';

let provider: AccountSlotProvider | null = null;
/** Every slot this module made, with the cleanup its provider returned. */
const slots = new Map<HTMLElement, () => void>();
let observer: MutationObserver | null = null;
let scheduled = false;

function cleanup(slot: HTMLElement): void {
  const off = slots.get(slot);
  slots.delete(slot);
  try { off?.(); } catch (e) { console.error(e); }
}

/** Add a slot to every cluster that has none, and let go of slots that left the page. */
function place(): void {
  scheduled = false;
  for (const slot of [...slots.keys()]) if (!slot.isConnected) cleanup(slot);
  const current = provider;
  if (!current || typeof document === 'undefined') return;
  for (const cluster of document.querySelectorAll<HTMLElement>(CLUSTER_SELECTOR)) {
    if (cluster.querySelector(`:scope > [${ACCOUNT_SLOT_ATTR}]`)) continue;
    const slot = document.createElement('div');
    slot.setAttribute(ACCOUNT_SLOT_ATTR, '');
    slot.className = 'account-slot';
    slot.style.cssText = 'display:flex;align-items:center;min-width:0';
    cluster.insertBefore(slot, cluster.querySelector(PROFILE_SELECTOR));
    let off: () => void = () => {};
    try { off = current.mount(slot); } catch (e) { console.error(e); }
    slots.set(slot, off);
  }
}

/** Run `place` once, soon: a frame later where frames exist, else on the next task. */
function schedule(): void {
  if (scheduled) return;
  scheduled = true;
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(place);
  else setTimeout(place, 0);
}

function watch(): void {
  if (observer || typeof MutationObserver === 'undefined' || typeof document === 'undefined') return;
  const root = document.getElementById('app') ?? document.body;
  if (!root) return;
  observer = new MutationObserver(schedule);
  observer.observe(root, { childList: true, subtree: true });
}

function unwatch(): void {
  observer?.disconnect();
  observer = null;
}

/**
 * Fill the header's account slot from `next` (last registration wins). The slot is added
 * at once to a header already on screen, and to every header drawn later. Returns the
 * unregister function, which removes every slot this registration made.
 */
export function registerAccountSlot(next: AccountSlotProvider): () => void {
  for (const slot of [...slots.keys()]) { cleanup(slot); slot.remove(); }
  provider = next;
  watch();
  place();
  return () => {
    if (provider !== next) return;
    provider = null;
    unwatch();
    for (const slot of [...slots.keys()]) { cleanup(slot); slot.remove(); }
  };
}

/** Whether a provider is registered (the header has an account slot). */
export function accountSlotRegistered(): boolean {
  return provider !== null;
}

/** TEST-ONLY: drop the provider, every slot and the observer. */
export function _clearAccountSlotForTests(): void {
  provider = null;
  unwatch();
  for (const slot of [...slots.keys()]) { cleanup(slot); slot.remove(); }
  scheduled = false;
}
