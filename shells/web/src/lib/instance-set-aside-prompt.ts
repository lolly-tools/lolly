// SPDX-License-Identifier: MPL-2.0
/**
 * What the person is shown when the connected instance was set aside for this page
 * load because its catalog is signed with a key this app has not accepted.
 *
 * Everywhere: the short note (catalog/integrity.ts). In the apps the note is also a
 * door to the connect step, and the app opens that step once by itself, with the
 * address filled in and the check already started, so the person sees the instance's
 * key without hunting for Settings. Opening the step accepts nothing: the key is taken
 * only when the person chooses "Use this instance" there.
 *
 * The step opens once per page load. It waits for the first-run welcome to settle and
 * for a moment when a view is on screen with no dialog and no sign-in gate over it;
 * with no such moment inside {@link WAIT_MS} it does not open, and the note and
 * Settings remain. Closing the step leaves the app on its own tools and shows the note
 * again as the way back. In a browser nothing opens.
 */
import { noteInstanceCatalogSetAside } from '../catalog/integrity.ts';
import { isTauriShell } from './instance-choice.ts';
import { suspendedInstanceBase } from './instance.ts';
import { welcomeSettled } from './welcome-gate.ts';

type Log = (level: 'debug' | 'info' | 'warn' | 'error', msg: string, ctx?: object) => void;

/** How long the step waits for a quiet moment before leaving the note to stand alone. */
const WAIT_MS = 30000;
const CHECK_MS = 400;
/** Quiet checks in a row before the step opens, so a sheet that is about to open goes first. */
const QUIET_CHECKS = 2;

let offered = false;

/** A view is drawn and nothing is over it: no boot screen, no dialog, no sign-in gate. */
export function quietForSheet(): boolean {
  if (typeof document === 'undefined') return false;
  const view = document.getElementById('view');
  if (!view?.childElementCount || view.querySelector(':scope > .loading')) return false;
  return !document.querySelector('dialog[open], .org-gate');
}

export interface SetAsideDeps {
  apps: () => boolean;
  quiet: () => boolean;
  settled: () => Promise<void>;
  /** Open the connect step for `base`; resolves when the step has closed. */
  open: (base: string, log: Log) => Promise<void>;
  note: typeof noteInstanceCatalogSetAside;
  stillSetAside: (base: string) => boolean;
  waitMs: number;
  checkMs: number;
}

const DEFAULTS: SetAsideDeps = {
  apps: isTauriShell,
  quiet: quietForSheet,
  settled: welcomeSettled,
  open: async (base, log) => {
    const sheet = await import('../components/instance-sheet.ts');
    await sheet.openInstanceSheet({ log }, { start: 'connect', url: base, check: true });
  },
  note: noteInstanceCatalogSetAside,
  stillSetAside: base => suspendedInstanceBase() === base,
  waitMs: WAIT_MS,
  checkMs: CHECK_MS,
};

/**
 * Tell the person `base` was set aside. Returns a promise that settles when the step
 * this call opened has closed, or at once when it opened none.
 */
export function offerSetAsideInstance(base: string, log: Log, overrides: Partial<SetAsideDeps> = {}): Promise<void> {
  const deps = { ...DEFAULTS, ...overrides };
  if (!deps.apps()) { deps.note(base); return Promise.resolve(); }
  let open = false;
  const openStep = async (): Promise<void> => {
    if (open) return;
    open = true;
    try { await deps.open(base, log); }
    catch (error) { log('warn', 'The connect step did not open', { error: String(error) }); }
    finally { open = false; }
    // Closed without connecting: the note comes back as the way to the step.
    if (deps.stillSetAside(base)) deps.note(base, () => { void openStep(); }, true);
  };
  deps.note(base, () => { void openStep(); });
  if (offered) return Promise.resolve();
  offered = true;
  return (async () => {
    await deps.settled();
    const until = Date.now() + deps.waitMs;
    for (let quiet = 0; quiet < QUIET_CHECKS;) {
      if (Date.now() > until || open || !deps.stillSetAside(base)) return;
      await new Promise(resolve => setTimeout(resolve, deps.checkMs));
      quiet = deps.quiet() ? quiet + 1 : 0;
    }
    if (!open && deps.stillSetAside(base)) await openStep();
  })();
}

/** TEST-ONLY: a fresh page load. */
export function _resetSetAsidePromptForTests(): void {
  offered = false;
}
