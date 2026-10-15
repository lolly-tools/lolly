// SPDX-License-Identifier: MPL-2.0
/**
 * The Unsaved edits dialog: what a tool asks before Home, the back pill or Bulk
 * from rows leaves edits nobody saved (views/tool/session.ts). Save & leave, Leave
 * anyway or Cancel; Leave anyway runs leaveWithoutSaving, which discards the edits
 * (views/tool-leave.ts). A document that belongs somewhere else asks that place's
 * question as the title (leaveQuestion), and there Leave anyway keeps a draft on
 * this device.
 *
 * Kept apart from views/tool/shared.ts so a test can build the real dialog in a
 * DOM (tool-leave-dialog.test.ts): shared.ts reaches the export path, whose
 * imports only resolve under Vite.
 */
import { mountModal } from '../components/modal.ts';
import { t } from '../i18n.ts';
import { jellyActive } from '../lib/jelly.ts';
import { playSfx } from '../lib/sfx.ts';
import { escape as escapeText } from '../utils.ts';
import { leaveQuestion } from './tool-leave.ts';

// onSave: optional async () => void that performs the save and navigates on
// success (the caller owns both). We invoke and await it directly (from the
// modal's onClose, after the dialog has been dismissed) rather than firing a
// button click, so "Save & leave" reliably saves *then* leaves instead of
// trusting a fire-and-forget click + timer. Built on the shared mountModal
// lifecycle (components/modal.ts) - Escape and a backdrop click dismiss as
// Cancel like every other app dialog. Over a document that belongs somewhere else
// (a team project) the title is that place's question instead ("Save changes to
// Brand refresh?", views/tool-leave.ts leaveQuestion), with the document's name in
// it; the sentence and the buttons stay the same. There Leave anyway keeps the edits
// on this device as a draft rather than discarding them (discardUnsavedWork).
export function showUnsavedDialog(
  onSave: (() => Promise<void> | void) | null,
  onLeave: () => void,
  detail?: string
): void {
  // Under the jelly flag the three actions become soft-body buttons (accent
  // "Save & leave", neutral platinum for the two exits), mirroring the confirm-
  // dialog.ts actionBtn mapping. The jelly host must NOT carry the box-painting
  // .unsaved-* classes (they'd paint a second capsule behind its canvas) - the
  // delegated [data-act] click handler retargets composed shadow clicks to the
  // host, so it fires unchanged; a layout-only .unsaved-btn-jelly class stays.
  const btn = (act: 'save' | 'leave' | 'cancel', label: string): string => {
    const nativeClass = { save: 'unsaved-save', leave: 'unsaved-leave', cancel: 'unsaved-cancel' }[
      act
    ];
    return jellyActive()
      ? `<jelly-button class="unsaved-btn-jelly"${act === 'save' ? '' : ' variant="platinum"'} data-act="${act}">${label}</jelly-button>`
      : `<button type="button" class="${nativeClass}" data-act="${act}">${label}</button>`;
  };
  const scoped = leaveQuestion();
  const content = `
    <div class="unsaved-dialog-body">
      <h2>${scoped ? escapeText(scoped) : t('Unsaved edits')}</h2>
      <p>${t('Save now or abandon your changes.')}</p>
      <!-- ${detail ? `<p class="unsaved-dialog-detail">${detail}</p>` : ''} -->
      <div class="unsaved-dialog-actions">
        ${onSave ? btn('save', t('Save &amp; leave')) : ''}
        ${btn('leave', t('Leave anyway'))}
        ${btn('cancel', t('Cancel'))}
      </div>
    </div>
  `;
  const modal = mountModal<'save' | 'leave' | undefined>(content, {
    className: 'unsaved-dialog',
    onClose: async (result) => {
      if (result === 'save') await onSave?.();
      else if (result === 'leave') onLeave();
      else playSfx('land'); // Cancel / Escape / backdrop - reverse-liftoff settle
    },
  });
  modal.el.dataset.sfxClose = 'off'; // this dialog plays its own dismiss cue on Cancel, not the generic shoo
  playSfx('crystal'); // a light glass-elevator lift as the save decision rises up
  modal.el.addEventListener('click', (e) => {
    const act =
      e.target instanceof Element
        ? e.target.closest<HTMLElement>('[data-act]')?.dataset.act
        : undefined;
    if (act === 'save') modal.close('save');
    else if (act === 'leave') modal.close('leave');
    else if (act === 'cancel') modal.close(undefined);
  });
}
