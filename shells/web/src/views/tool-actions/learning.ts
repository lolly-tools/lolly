// SPDX-License-Identifier: MPL-2.0
import type { ActionsCtx } from './context.ts';
import { requireLearningFeature } from '../../lib/learning-feature.ts';
import { announce } from '../../a11y.ts';
import { learningRenditions } from '../../../../../engine/src/learning/delivery.ts';
import type { PickerHost } from '../picker.ts';

export function learningOps(ta: ActionsCtx) {
  return { open: () => open(ta), wire: () => wire(ta) };
}
export async function open(ta: ActionsCtx): Promise<void> {
  requireLearningFeature();
  if (
    ta.affordance !== 'download' ||
    !learningRenditions({ ...ta.manifest, render: { ...ta.manifest.render, formats: ta.formats } })
      .length
  )
    return;
  const folderId = ta.fileIntoFolder;
  const button =
    ta.el.querySelector<HTMLButtonElement>('[data-course-export]') ||
    document.createElement('button');
  const saved = await ta.saving.performSave(button);
  if (!saved || !ta.activeSlot) return;
  const { startLearningCourse } = await import('../../lib/learning-entry.ts');
  await startLearningCourse(ta.host as unknown as PickerHost, {
    title: ta.manifest.name,
    sessionRefs: [ta.activeSlot],
    projectId: folderId,
  });
}
export function wire(ta: ActionsCtx): void {
  ta.el.querySelector('[data-course-export]')?.addEventListener('click', () => {
    void open(ta).catch((error) =>
      announce(error instanceof Error ? error.message : 'The course could not be opened.', {
        assertive: true,
      })
    );
  });
}
