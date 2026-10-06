// SPDX-License-Identifier: MPL-2.0
import { t } from '../i18n.ts';
import { configureNotifications, publishNotification } from '../lib/notifications.ts';
import { getInstanceBase } from '../lib/instance.ts';
import { isTauriShell } from '../lib/instance-choice.ts';
import type { CollabHistoryCapability } from '../lib/collab-history.ts';
import { historyClass, type HistoryManifest } from './tool-history-adapters.ts';

interface RecoveryContext {
  manifest: HistoryManifest;
  automatic: boolean;
  shared?: boolean;
  collab?: CollabHistoryCapability;
  canSave?: boolean;
  native?: boolean;
  scope?: string;
  onSave?(): void | Promise<void>;
}

/** Explain the current mount's recovery limits in the profile notification queue. */
export function recoveryNotice(context: RecoveryContext): string | null {
  if (context.automatic) return null;
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
  return publishNotification({ id: `recovery:${getInstanceBase()}:${context.scope ?? context.manifest.id}:${context.collab?.durability ?? historyClass(context.manifest)}`,
    title: t('Saving and recovery'), body: message, tone: context.collab?.durability === 'durable' ? 'info' : 'warning',
    ...(context.canSave && context.onSave ? { action: { label: t('Save a copy'), run: async () => { if (root.isConnected) await context.onSave?.(); } } } : {}),
  });
}
