// SPDX-License-Identifier: MPL-2.0
import { t } from '../i18n.ts';
import { announce } from '../a11y.ts';
import type { ToolViewCtx } from './tool/context.ts';

export function wirePhotoPresetImport(view: ToolViewCtx): void {
  if (view.toolId !== 'darkroom' || !view.sidebarEl) return;
  const button = document.createElement('button'); button.type = 'button'; button.className = 'btn'; button.textContent = t('Import Adobe photo preset');
  const input = document.createElement('input'); input.type = 'file'; input.accept = '.xmp,.lrtemplate'; input.hidden = true;
  const notes = document.createElement('p'); notes.className = 'hint'; notes.hidden = true;
  button.addEventListener('click', () => input.click());
  input.addEventListener('change', async () => {
    const file = input.files?.[0]; input.value = ''; if (!file) return;
    button.disabled = true;
    try {
      if (file.size > 1024 * 1024) throw new Error(t('Choose a preset smaller than 1 MB.'));
      const { readCameraRawPreset } = await import('../../../../engine/src/camera-raw-preset.ts');
      const preset = readCameraRawPreset(await file.text(), source => new DOMParser().parseFromString(source, 'application/xml'));
      if (!button.isConnected || view.collabHandle?.role === 'observer') return;
      for (const [id, value] of Object.entries(preset.values)) {
        view.session.markUserDirty(id); await view.runtime.setInput(id, value);
      }
      notes.textContent = preset.notes.join(' '); notes.hidden = false; announce(notes.textContent);
    } catch (error) {
      notes.textContent = error instanceof Error ? error.message : t('Preset import failed.'); notes.hidden = false;
      announce(notes.textContent, { assertive: true });
    } finally { button.disabled = false; }
  });
  const body = view.sidebarEl.querySelector('.sidebar-body') ?? view.sidebarEl;
  const section = document.createElement('div'); section.className = 'input-section'; section.append(button, input, notes);
  const motionHint = document.createElement('p'); motionHint.className = 'hint';
  motionHint.textContent = t('Use Grade a video to apply this look to a clip, or export a .cube LUT to reuse the look in another editor.');
  section.append(motionHint);
  body.insertBefore(section, body.querySelector('#tool-actions'));
  view.mountLifecycle.add('Adobe preset import', () => section.remove());
}
