// SPDX-License-Identifier: MPL-2.0
import { t, tRaw } from '../i18n.ts';
import { configureNotifications, publishNotification } from '../lib/notifications.ts';
import { getInstanceBase } from '../lib/instance.ts';
import { isTauriShell } from '../lib/instance-choice.ts';
import type { CollabHistoryCapability } from '../lib/collab-history.ts';
import { fileInputPaths, historyClass, notKeptFiles, type HistoryManifest } from './tool-history-adapters.ts';

interface RecoveryContext {
  manifest: HistoryManifest;
  automatic: boolean;
  shared?: boolean;
  collab?: CollabHistoryCapability;
  canSave?: boolean;
  native?: boolean;
  scope?: string;
  /** The values the document opened with, which name any file history did not keep. */
  opened?: Readonly<Record<string, unknown>>;
  onSave?(): void | Promise<void>;
}

/** Explain the current mount's recovery limits in the profile notification queue. */
export function recoveryNotice(context: RecoveryContext): string | null {
  if (context.automatic) {
    // History keeps everything but an imported file's bytes (plan 277 P4, class B). The
    // notice says that, and lists the files a reopened creation needs again. A text sink: tRaw.
    const paths = fileInputPaths(context.manifest.inputs);
    if (!paths.length) return null;
    const missing = context.opened ? notKeptFiles(context.opened, paths).filter(Boolean) : [];
    return missing.length
      ? tRaw('This creation was kept without its imported files: {files}. Load them again to use them.', { files: missing.join(', ') })
      : t('Changes are saved automatically, but imported files are not kept. Keep your original files to load them again.');
  }
  if (context.shared || context.collab) {
    if (context.collab?.durability === 'durable') return t('Version history is kept by your organisation. Save a copy to keep this work locally.');
    if (context.collab) return t('This collaboration’s history is temporary. Save a copy before leaving.');
    return t('This collaboration has no local automatic recovery. Save a copy before leaving.');
  }
  if (!context.manifest.inputs?.length) return null;
  const kind = historyClass(context.manifest);
  if (kind === 'recording') return t('This tool has no automatic recovery. Save or download your result before leaving.');
  if (kind === 'settings' || !context.canSave) return t('This tool has no automatic recovery. Download your result before leaving and keep your original files.');
  if (kind === 'side-file') return t('Changes are not saved automatically. Save before leaving and keep your original imported files.');
  return context.native
    ? t('Changes are not saved automatically in this app. Save before leaving.')
    : t('Automatic recovery is unavailable here. Save before leaving.');
}

export function mountRecoveryNotice(root: HTMLElement, context: RecoveryContext): () => void {
  const message = recoveryNotice({ native: isTauriShell(), ...context });
  if (!message) return () => {};
  void configureNotifications();
  // The automatic notice has an id of its own, so dismissing the older manual notice
  // leaves the automatic one showing.
  const kind = context.automatic ? 'not-kept' : context.collab?.durability ?? historyClass(context.manifest);
  return publishNotification({ id: `recovery:${getInstanceBase()}:${context.scope ?? context.manifest.id}:${kind}`,
    title: t('Saving and recovery'), body: message, tone: context.collab?.durability === 'durable' ? 'info' : 'warning',
    ...(context.canSave && context.onSave ? { action: { label: t('Save a copy'), run: async () => { if (root.isConnected) await context.onSave?.(); } } } : {}),
  });
}
