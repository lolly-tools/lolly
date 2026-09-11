// SPDX-License-Identifier: MPL-2.0
/**
 * The boot-path half of the first-run instance choice.
 *
 * WHY THIS IS ITS OWN MODULE
 * main.ts must ask, on every boot, "is this a Tauri shell that has never
 * settled the instance question?" - two cheap probes. It used to ask by
 * importing components/instance-sheet.ts directly, which put the whole sheet
 * (mountModal chrome, the connect/probe flow, and via data-transfer.ts the
 * backup importer plus fflate) on the boot path of every shell - including the
 * web PWA, which never shows the sheet at all. Keeping the two probes and the
 * storage key here lets main.ts answer the question for ~0 bytes and
 * dynamic-import the sheet only in the rare case it is actually shown.
 *
 * instance-sheet.ts imports CHOICE_KEY/isTauriShell/hasMadeInstanceChoice from
 * here rather than redeclaring them, so the persisted key has exactly one
 * definition.
 */
import { openDB } from '../bridge/db.ts';
import type { HostV1 } from '@lolly-tools/core/host-v1';

/** Key of the "user has been asked" flag inside the 'profile' KV store - same
 *  store lib/instance.ts keeps its own 'instance-base' key in. Distinct from
 *  the base itself: choosing "bundled" also settles the question (base stays
 *  '') without it, so this needs its own marker. */
export const CHOICE_KEY = 'instance-choice-made';

/** True inside any Tauri shell (desktop or mobile) - same feature-detect
 *  lib/instance.ts's own (unexported) hasTauriInternals() uses. */
export function isTauriShell(): boolean {
  return typeof window !== 'undefined'
    && typeof (window as { __TAURI_INTERNALS__?: { invoke?: unknown } }).__TAURI_INTERNALS__?.invoke === 'function';
}

/** Has the user ever settled the first-run instance choice? Unreadable
 *  storage counts as "yes" - same reasoning as welcome-dialog's
 *  isWelcomeDismissed: re-prompting every single boot would be worse than
 *  never prompting. */
export async function hasMadeInstanceChoice(): Promise<boolean> {
  try {
    return (await (await openDB()).get('profile', CHOICE_KEY)) === true;
  } catch {
    return true;
  }
}

export async function markInstanceChoiceMade(): Promise<void> {
  try { await (await openDB()).put('profile', true, CHOICE_KEY); } catch { /* best-effort */ }
}

/**
 * Boot-time gate (main.ts's boot(), called before the first catalog sync):
 * show the sheet once, Tauri shells only, before the choice is ever
 * recorded. A no-op (one fast IndexedDB read) on every later boot and on
 * every non-Tauri shell (the web PWA never gates on this).
 *
 * The `await` on the dynamic import matters for ordering: main.ts
 * awaits this call BEFORE the first syncCatalog(), so a chosen instance is
 * honoured by that first sync. It must not become fire-and-forget.
 */
export async function maybeShowFirstRunInstanceSheet(host: HostV1): Promise<void> {
  if (!isTauriShell()) return;
  // Headless CLI render (the desktop binary's `Lolly run <tool>` mode, which drives
  // this same boot in an off-screen window) has no human to answer a first-run
  // dialog: the await below would hang the whole render forever, before the tool
  // ever mounts. Skip every interactive boot gate and keep the default (local)
  // instance, which is exactly what an offline render wants. See
  // shells/tauri-desktop/src-tauri/src/cli.rs.
  if ((window as { __LOLLY_CLI__?: unknown }).__LOLLY_CLI__) return;
  if (await hasMadeInstanceChoice()) return;
  const { openInstanceSheet } = await import('../components/instance-sheet.ts');
  await openInstanceSheet(host, { firstRun: true });
}
