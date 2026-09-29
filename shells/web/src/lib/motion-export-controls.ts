// SPDX-License-Identifier: MPL-2.0
/** Sequence export controls keep the selected quality in the authored document. */
import { validateMotionBlur, type MotionBlur } from '../../../../engine/src/motion-sampling.ts';
import type { ToolRuntime } from '../views/tool.ts';
import { t } from '../i18n.ts';

export function motionControlsMarkup(): string {
  return `<label class="vp-field"><span>${t('Motion blur')}</span><select class="field-select field-select--sm" data-action="motion-blur" aria-label="${t('Motion blur')}"><option value="1">${t('Off')}</option><option value="4">${t('Draft')} (4)</option><option value="8">${t('Standard')} (8)</option><option value="16">${t('High')} (16)</option></select></label><label class="vp-field"><span>${t('Shutter angle')}</span><input class="field-input field-input--sm" data-action="motion-shutter" aria-label="${t('Shutter angle')}" type="number" min="0" max="360" value="180"></label><p class="muted">${t('More samples take longer to render.')}</p>`;
}
export function readMotionControls(root: HTMLElement): MotionBlur {
  return validateMotionBlur({ samples: Number(root.querySelector<HTMLSelectElement>('[data-action="motion-blur"]')?.value ?? 1), shutterAngle: Number(root.querySelector<HTMLInputElement>('[data-action="motion-shutter"]')?.value ?? 180) });
}
export function wireMotionControls(root: HTMLElement, runtime: ToolRuntime, explicit?: MotionBlur): void {
  const stored = runtime.getModel().find(input => input.id === 'sequenceMotionBlur');
  let value = explicit;
  try { if (!value && stored?.value) value = validateMotionBlur(JSON.parse(String(stored.value))); } catch { /* invalid stored values are refused by export */ }
  const samples = root.querySelector<HTMLSelectElement>('[data-action="motion-blur"]'), angle = root.querySelector<HTMLInputElement>('[data-action="motion-shutter"]');
  if (samples && value) samples.value = String(value.samples);
  if (angle && value) angle.value = String(value.shutterAngle);
  for (const input of [samples, angle]) input?.addEventListener('change', () => {
    if (stored && angle?.validity.valid) void runtime.setInput('sequenceMotionBlur', JSON.stringify(readMotionControls(root)));
  });
}
