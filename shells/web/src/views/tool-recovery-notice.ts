// SPDX-License-Identifier: MPL-2.0
import { t } from '../i18n.ts';
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
}

/** Explain the current mount's recovery limits beside its editing controls. */
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
  const parent = root.querySelector('.sidebar-body') ?? root.querySelector('.tool-stage');
  if (!message || !parent) return () => {};
  const note = document.createElement('p');
  note.className = 'lp-help tool-recovery-notice';
  note.dataset.recoveryNotice = '';
  note.dataset.exportHide = '';
  note.textContent = message;
  parent.prepend(note);
  return () => note.remove();
}
