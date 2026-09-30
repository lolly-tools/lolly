// SPDX-License-Identifier: MPL-2.0
/**
 * sync-changes (plans/138 Tier D, WP-S1 and WP-S2) - the one signal that says
 * "something the person owns changed on this device".
 *
 * Device sync needs it twice. A change schedules a push. And a device with
 * changes that are not in the synced copy yet must never be overwritten by that
 * copy without the person choosing so. Listening at a few save buttons missed
 * uploads, brand edits, deletions and profile edits, so the bridge reports every
 * write itself: `trackHostChanges` wraps the writing methods of the host once,
 * at the end of bridge assembly, which covers the web shell and both Tauri shells
 * (their state bridge is swapped in at build time, underneath the same wrapper).
 *
 * This module stays tiny and free of imports, because the bridge loads it at boot.
 */

type Listener = () => void;

const listeners = new Set<Listener>();
let seq = 0;
let quiet = 0;

/** Report one local change. Ignored while `withoutLocalChanges` runs. */
export function noteLocalChange(): void {
  if (quiet > 0) return;
  seq++;
  for (const listener of listeners) {
    try { listener(); } catch { /* a listener never breaks the write that reported it */ }
  }
}

/** A counter that rises with every reported change. A push compares it before
 *  and after, so an edit made during the upload stays marked as waiting. */
export function localChangeSeq(): number {
  return seq;
}

/** Subscribe to local changes. A change reported before the first subscriber is
 *  delivered once, on subscription, so an edit made during boot is not lost. */
export function onLocalChange(listener: Listener): () => void {
  const first = listeners.size === 0;
  listeners.add(listener);
  if (first && seq > 0) {
    try { listener(); } catch { /* same rule as above */ }
  }
  return () => { listeners.delete(listener); };
}

/**
 * Run `fn` without reporting its writes: applying a synced copy writes through
 * the same bridge, and those writes are the synced state, not new local work.
 * The page reloads after an apply, so an edit the person makes in that same
 * moment is the only thing this can hide, and the before-apply copy keeps it.
 */
export async function withoutLocalChanges<T>(fn: () => Promise<T>): Promise<T> {
  quiet++;
  try { return await fn(); } finally { quiet--; }
}

/** Wrap one method so a successful call reports a change. */
function wrap(target: Record<string, unknown> | undefined, name: string, changed?: (args: unknown[]) => Promise<boolean>): void {
  const original = target?.[name];
  if (typeof original !== 'function') return;
  const fn = original as (...args: unknown[]) => unknown;
  target![name] = async function wrapped(this: unknown, ...args: unknown[]) {
    const report = changed ? await changed(args).catch(() => true) : true;
    const result = await fn.apply(this, args);
    if (report) noteLocalChange();
    return result;
  };
}

/** The host slice whose writes are tracked. Every part is optional: a shell or a
 *  test host that lacks one simply is not wrapped there. */
interface TrackedHost {
  state?: object;
  profile?: object;
  assets?: object;
  designSystems?: object;
  brandAdoption?: object;
}

/**
 * Wrap the writing methods of `host` so each one reports a local change. Call it
 * once, after the host is complete. Profile writes report only when the record
 * really changes, because several boot steps write the profile back unchanged.
 */
export function trackHostChanges(host: TrackedHost): void {
  const adoption = host.brandAdoption as Record<string, unknown> | undefined;
  for (const name of ['commit', 'restore']) wrap(adoption, name);
  // restore is the save a backup import writes through (it keeps the session's
  // own times), so an import is a local change sync must push (plan 277 P7).
  const state = host.state as Record<string, unknown> | undefined;
  for (const name of ['save', 'restore', 'delete']) wrap(state, name);

  // The profile bridge hands out its cached record, and callers often change that
  // object in place before calling set(), so comparing with a fresh read would see
  // no difference. Compare with the last value written instead.
  const profile = host.profile as Record<string, unknown> | undefined;
  const readProfile = profile?.get as (() => Promise<unknown>) | undefined;
  let lastProfile: string | null = null;
  const seen = readProfile
    ? readProfile.call(profile).then((p) => { lastProfile ??= JSON.stringify(p ?? null); }, () => {})
    : Promise.resolve();
  wrap(profile, 'set', async ([next]) => {
    await seen;
    const json = JSON.stringify(next ?? null);
    const changed = json !== lastProfile;
    lastProfile = json;
    return changed;
  });

  const assets = host.assets as Record<string, unknown> | undefined;
  for (const name of [
    '_uploadUserAsset', '_duplicateUserAsset', '_restoreUserAssetVersion', '_removeUserAssetVersion',
    '_importUserAsset', '_deleteUserAsset', '_renameUserAsset', '_updateUserAssetMeta',
    '_restampUserAsset', '_replaceUserAssetBytes', '_setUserAssetTrashed',
  ]) wrap(assets, name);

  const systems = host.designSystems as Record<string, unknown> | undefined;
  for (const name of ['put', 'remove']) wrap(systems, name);
  const activeId = systems?.activeId as (() => Promise<string>) | undefined;
  wrap(systems, 'setActive', async ([id]) => (activeId ? (await activeId.call(systems)) !== id : true));
}

/** Test seam. */
export function resetSyncChangesForTests(): void {
  listeners.clear();
  seq = 0;
  quiet = 0;
}
