// SPDX-License-Identifier: MPL-2.0
/**
 * The sender's warning for catalog works that travel in a `.lolly` with no licence
 * recorded (lib/redistribution.ts packRights): one wording for every path that builds
 * such a file. The share dialog shows the warning beside the file it made; the other
 * paths show it as a notice once the file is made. Warn, do not stop (Andy, 2026-11-12).
 */
import { t, tRaw } from '../i18n.ts';

/** The warning for the works that travelled without a recorded licence, by label; empty when there are none. */
export function unrecordedWarning(names: readonly string[] | undefined): string {
  if (!names?.length) return '';
  if (names.length === 1) return tRaw('"{name}" travels in this file, but its licence is not on record. CREDITS.txt asks whoever opens the file to check the terms before reusing the work.', { name: names[0]! });
  const shown = names.slice(0, 3).map(name => `"${name}"`).join(', ');
  const more = names.length > 3 ? tRaw(' and {n} more', { n: names.length - 3 }) : '';
  return tRaw('{n} catalog works travel in this file without a recorded licence: {names}{more}. CREDITS.txt asks whoever opens the file to check their terms before reusing them.', { n: names.length, names: shown, more });
}

/** Show the warning as a notice once a file is made. Does nothing when no work needs one, or where there is no page to show a notice on. */
export async function noticeUnrecorded(names: readonly string[] | undefined): Promise<void> {
  const message = unrecordedWarning(names);
  if (!message || typeof document === 'undefined') return;
  try {
    const { showUndoToast } = await import('./undo-toast.ts');
    showUndoToast({ message, undo: () => {}, actionLabel: t('OK'), duration: 12000 });
  } catch { /* a notice that cannot be shown leaves the file and its CREDITS.txt as they are */ }
}
