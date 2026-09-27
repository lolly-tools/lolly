// SPDX-License-Identifier: MPL-2.0
/**
 * Bringing a copy of the person's own data back onto this device (plans/277 P13).
 *
 * Two kinds of file carry that data. The backup .zip that Export my data writes, and
 * the copies Sync writes to the storage the person chose: `lolly-sync/snapshot.lolly`
 * (`lolly-sync.lolly` on Google Drive), `lolly-backup/day-N.lolly` and
 * `lolly-backup/before-apply.lolly`. A sync copy holds the same backup bundle,
 * optionally encrypted with the sync passphrase. Both kinds are imported the same way,
 * from Settings → Storage → Import data… or from Open: one confirmation dialog, the
 * passphrase asked for in place when the copy is encrypted, and importBackup's
 * defaults, which add and merge and delete nothing. The sync engine's own decoder
 * (`openSnapshot`) reads and decrypts the copy on this device; nothing is uploaded.
 *
 * Loaded on demand by both doors, so none of this rides the boot path.
 */
// The import dialog is styled by the Storage sheet. Open shows the same dialog over
// any view, so the sheet loads with this module rather than only with Settings.
import '../styles/parts/storage.css';
import { t, tRaw } from '../i18n.ts';
import { playSfx } from './sfx.ts';
import { applyTheme } from '../theme.ts';
import { registerUserFonts, type UserFontsHost } from '../user-fonts.ts';
import { applyChromeBrandVars } from '../brand-vars.ts';
import { backupImportLine } from './backup-summary.ts';
import { isEncryptedSnapshot } from './snapshot-crypto.ts';
import { showImportDialog, type ImportDialogModals, type ImportDialogOpts } from '../components/import-dialog.ts';
import type { LollyPreview } from './lolly-intake.ts';
import type { BackupDeps } from './sync-engine.ts';
import type { importBackup } from '../data-transfer.ts';

/** What an import reports back: counts per kind, and anything skipped or not restored. */
export type DataImportSummary = Awaited<ReturnType<typeof importBackup>>;

/** What a picked or dropped file holds, read from its first bytes and, for a `.lolly`,
 *  from its manifest alone. */
export interface DataImportSource {
  /** 'sync-copy' for a copy Sync wrote (a `.lolly`); 'backup' for an Export my data .zip. */
  kind: 'backup' | 'sync-copy';
  /** Encrypted with the sync passphrase: the dialog asks for the passphrase. */
  encrypted: boolean;
  /** When a plain sync copy was written, from its manifest. */
  exportedAt: string | null;
  /** Why the file cannot be imported (a `.lolly` holding a shared design, or an
   *  unreadable one). The dialog shows it when Import is pressed; nothing is written. */
  refusal: string | null;
}

/**
 * The two readers an import takes from lib/lolly-intake.ts, handed in by each door
 * (Open already holds the intake; Import data… loads it beside this module). This
 * module does not import the intake itself: Open's router loads this module, and
 * the intake reaches the router again through the brand reader, so an import here
 * would close a loop in the module graph.
 */
export interface LollyReaders {
  peekLollyFile(file: File): Promise<LollyPreview>;
  lollyBytesLabel(bytes: number): string;
}

const isLollyFile = (file: File): boolean =>
  /\.lolly$/i.test(file.name) || file.type === 'application/vnd.lolly+zip';

/** The words for a wrong passphrase, shown in the dialog beside the field. */
export const wrongPassphraseText = (): string =>
  t('That passphrase does not open this copy. Check the passphrase and try again, or cancel.');
const missingPassphraseText = (): string => t('Enter your sync passphrase to unlock this copy.');

/** Read what a file is without inflating the archive. Never throws for a file that is not a copy
 *  of the person's data: the answer carries a refusal instead. */
export async function describeDataImportFile(file: File, readers: LollyReaders): Promise<DataImportSource> {
  const plain = { encrypted: false, exportedAt: null, refusal: null };
  const head = new Uint8Array(await file.slice(0, 64).arrayBuffer());
  if (isEncryptedSnapshot(head)) return { ...plain, kind: 'sync-copy', encrypted: true };
  // A .zip is read by importBackup, which refuses anything that is not a backup.
  if (!isLollyFile(file)) return { ...plain, kind: 'backup' };
  try {
    const preview = await readers.peekLollyFile(file);
    if (preview.kind === 'backup') return { ...plain, kind: 'sync-copy', exportedAt: preview.exportedAt };
    return {
      ...plain, kind: 'backup',
      refusal: t('This .lolly file holds a shared design or design system, not a copy of your data. Use Open to add the file.'),
    };
  } catch (err) {
    return { ...plain, kind: 'backup', refusal: (err as Error)?.message || t('Import failed.') };
  }
}

/**
 * Import the file: decrypt it on this device when it is an encrypted sync copy, then
 * import it as a backup. A backup .zip goes through the same call, because the decoder
 * hands plain bytes back unchanged. Throws a message the dialog can show as it is;
 * nothing is written when the passphrase is missing or wrong or the file is refused.
 */
export async function importDataFile(
  deps: BackupDeps, file: File, source: DataImportSource, passphrase = '',
): Promise<DataImportSummary> {
  if (source.refusal) throw new Error(source.refusal);
  if (source.encrypted && !passphrase) throw new Error(missingPassphraseText());
  const { importSnapshotFile, SnapshotPassphraseError } = await import('./sync-engine.ts');
  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    return await importSnapshotFile(deps, bytes, source.encrypted ? { passphrase } : {});
  } catch (err) {
    if (err instanceof SnapshotPassphraseError) {
      throw new Error(err.reason === 'wrong' ? wrongPassphraseText() : missingPassphraseText());
    }
    throw err;
  }
}

function whenText(iso: string): string {
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

/** How the import dialog reads for this file: the backup wording for a .zip, and for a
 *  sync copy a line about the file plus the passphrase field when it is encrypted. */
export function importDialogOptions(file: File, source: DataImportSource, readers: LollyReaders): ImportDialogOpts {
  if (source.refusal || source.kind === 'backup') return {};
  const name = file.name;
  const size = readers.lollyBytesLabel(file.size);
  const lead = source.encrypted
    ? tRaw('“{name}” ({size}) is a copy of your Lolly data that Sync saved. It is encrypted: enter your sync passphrase to unlock the copy on this device.', { name, size })
    : source.exportedAt
      ? tRaw('“{name}” ({size}) is a copy of your Lolly data that Sync saved on {when}.', { name, size, when: whenText(source.exportedAt) })
      : tRaw('“{name}” ({size}) is a copy of your Lolly data that Sync saved.', { name, size });
  return { kind: 'sync-copy', lead, passphrase: source.encrypted };
}

/** The status line after an import, for the live region. Failures make it assertive,
 *  since a picture that did not come across is lost once the file is thrown away. */
export function dataImportMessage(summary: DataImportSummary): { message: string; assertive: boolean } {
  // `skipped` > 0 means the bundle came from a newer app and carried parts this
  // build doesn't understand yet - surface it rather than pretend a full restore.
  const skipNote = summary.skipped ? ` · ${summary.skipped === 1 ? t('1 newer item skipped') : t('{n} newer items skipped', { n: summary.skipped })}` : '';
  const failNote = summary.failedAssets ? ` · ${summary.failedAssets === 1 ? t('1 image couldn’t be restored (storage full?)') : t('{n} images couldn’t be restored (storage full?)', { n: summary.failedAssets })}` : '';
  const message = backupImportLine(summary) + skipNote + failNote;
  return { message, assertive: Boolean(summary.failedAssets || summary.failedHistory) };
}

/** The host slices the repaint after an import touches. */
interface RefreshHost {
  profile?: { bust?(): void };
  tokens?: { bust?(): void };
}

/**
 * Repaint what an import can change: drop the profile and token caches, load any font
 * faces that came across into document.fonts and repaint the chrome, as a fresh boot
 * would. A bundle may carry a brand, whose tokens and fonts restore as user assets.
 */
export async function refreshAfterDataImport(host: unknown): Promise<void> {
  const h = host as RefreshHost;
  h.profile?.bust?.();
  h.tokens?.bust?.();
  await registerUserFonts(host as UserFontsHost).catch(() => { /* faces load at next boot */ });
  void applyChromeBrandVars(host as Parameters<typeof applyChromeBrandVars>[0]);
  applyTheme(localStorage.getItem('theme') || 'light');
}

/**
 * The whole import from one file, as both doors run it: read what the file is, confirm
 * in the import dialog (with the passphrase field for an encrypted copy), import,
 * repaint, then `afterImport`. That last step runs while the dialog still shows
 * "Importing…", so a failure there is shown in place too. Resolves the summary, or
 * null when the person cancelled or closed the dialog. `modals` is the set a view
 * closes its dialogs from when it is swapped out (Settings passes its own).
 */
export async function runDataImport(
  file: File, host: unknown, readers: LollyReaders,
  { afterImport, modals }: { afterImport?: (summary: DataImportSummary) => Promise<void> | void; modals?: ImportDialogModals } = {},
): Promise<DataImportSummary | null> {
  const source = await describeDataImportFile(file, readers);
  const deps: BackupDeps = { host: host as BackupDeps['host'], storage: localStorage };
  let summary: DataImportSummary | null = null;
  const imported = await showImportDialog(async ({ passphrase }) => {
    // The data gets sucked in, the mirror of export's whoosh. An encrypted copy waits
    // until the passphrase opened the copy, so a wrong one does not sound like success.
    if (!source.encrypted) playSfx('vacuum');
    summary = await importDataFile(deps, file, source, passphrase);
    if (source.encrypted) playSfx('vacuum');
    // The data is in by now, so a repaint that fails must not read as a failed import:
    // the next boot paints from the restored records anyway.
    await refreshAfterDataImport(host).catch(() => { /* repainted at next boot */ });
    await afterImport?.(summary);
  }, importDialogOptions(file, source, readers), modals);
  return imported ? summary : null;
}
