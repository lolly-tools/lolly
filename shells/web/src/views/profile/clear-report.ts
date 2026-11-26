// SPDX-License-Identifier: MPL-2.0
/**
 * profile: what "Clear all my data" tells the person when part of the clear did not
 * finish. lib/clear-all-data.ts runs every step whatever happens and reports the ones
 * that failed. Before this, those failures went only to the log, and the app restarted
 * as if everything had gone. Now a dialog lists the parts still on the device and says
 * what to do: try again, or on the web clear the site's data in the browser, which
 * removes everything the button does. The log line stays, for whoever reads the logs.
 */
import { choiceDialog } from '../../components/confirm-dialog.ts';
import { t } from '../../i18n.ts';
import { isTauriShell } from '../../lib/instance-choice.ts';
import { unclearedParts, type ClearAllReport, type UnclearedPart } from '../../lib/clear-all-data.ts';

/** One plain line for a part still on the device. */
function partLine(part: UnclearedPart): string {
  switch (part) {
    case 'app-files': return t('Saved sessions and other files the app keeps on this device');
    case 'database': return t('Some saved work, uploads or settings');
    case 'offline': return t('Offline copies, downloaded models or caches');
    case 'files': return t('File results and working files');
    case 'preferences': return t('Interface preferences, such as theme and language');
  }
}

/** Say what a clear left behind and ask whether to run it again. True to try again;
 *  false when the person restarts the app as it is (the button, Escape or the backdrop). */
export async function askToClearAgain(parts: readonly UnclearedPart[]): Promise<boolean> {
  const choice = await choiceDialog({
    title: t('Some of your data was not cleared'),
    message: isTauriShell()
      ? t('Lolly could not clear the parts below. Try again. If they are still there, close Lolly, open the app again and clear once more.')
      : t('Lolly could not clear the parts below. Try again. If they are still there, clear this site’s data in your browser’s settings, which removes everything Lolly keeps here.'),
    items: parts.map(partLine),
    choices: [{ id: 'again', label: t('Try again'), primary: true }],
    cancelLabel: t('Restart Lolly'),
    tag: 'clear-report',
  });
  return choice === 'again';
}

export interface ClearUntilDoneOpts {
  /** Called with each run's error lines, when it has any. */
  log?(errors: string[]): void;
  /** The question to ask; askToClearAgain unless a test hands in its own. */
  ask?(parts: readonly UnclearedPart[]): Promise<boolean>;
}

/**
 * Run the clear, and while it leaves part of the device behind, say which and offer to
 * run it again. Resolves the last report once nothing is left, or once the person
 * chooses to restart with something still there.
 */
export async function clearUntilDone(run: () => Promise<ClearAllReport>, opts: ClearUntilDoneOpts = {}): Promise<ClearAllReport> {
  const ask = opts.ask ?? askToClearAgain;
  for (;;) {
    const report = await run();
    if (report.errors.length) opts.log?.(report.errors);
    const parts = unclearedParts(report);
    if (!parts.length || !(await ask(parts))) return report;
  }
}
