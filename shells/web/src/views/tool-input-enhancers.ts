// SPDX-License-Identifier: MPL-2.0
/**
 * Tool view - the sidebar controls a widget enhances after renderInputs has built
 * and wired the plain fields: the date-time pickers (flatpickr) and the tone curve
 * plots (lazy). Both read and write through the ordinary field or the runtime, so
 * the panel builder in tool-inputs.ts only has to call them in order.
 */
import flatpickr from 'flatpickr';
import type { InputModelItem } from '../../../../engine/src/inputs.ts';
import type { Runtime } from '../../../../engine/src/runtime.ts';
import type { FlatpickrHost } from './tool.ts';

/** Tone curve plots, after the fields they edit are wired: a plot commit is an
 *  ordinary `input` event on its field. */
export function mountCurvePlots(el: HTMLElement, panelModel: InputModelItem[]): void {
  const curveSlots = el.querySelectorAll<HTMLElement>('[data-tone-curve-for]');
  if (!curveSlots.length) return;
  void import('../components/tone-curve.ts').then(({ mountToneCurve }) => {
    curveSlots.forEach((slot) => {
      if (!slot.isConnected || slot.childElementCount) return;
      const cid = slot.dataset.toneCurveFor!;
      const field = slot.parentElement?.querySelector<HTMLInputElement>(`[data-input-id="${CSS.escape(cid)}"]`);
      const item = panelModel.find((i) => i.id === cid);
      if (field) mountToneCurve(slot, field, item?.label ?? cid);
    });
  });
}

export function wireDateTimePickers(el: HTMLElement, runtime: Runtime, onDirty?: (id: string) => void): void {
  el.querySelectorAll<FlatpickrHost>('.fp-datetime').forEach((control) => {
    const id = control.dataset.inputId!;
    const initVal = control.dataset.fpValue || null;
    const existing = control._flatpickr;
    if (existing) existing.destroy();
    flatpickr(control, {
      enableTime: true,
      dateFormat: 'Y-m-dTH:i',
      altInput: true,
      altFormat: 'D j M Y h:iK',
      defaultDate: initVal || undefined,
      allowInput: false,
      time_24hr: true,
      disableMobile: true,
      onReady(_: Date[], __: string, fp: { altInput?: HTMLInputElement }) {
        if (fp.altInput) fp.altInput.placeholder = control.placeholder || 'Live - current time';
      },
      // onClose fires once when the picker closes, after the user has finished
      // picking both the date and time. onChange would fire mid-interaction and
      // trigger renderInputs → el.innerHTML reset → destroying the open calendar.
      onClose(selectedDates: Date[], dateStr: string) {
        const next = selectedDates.length ? dateStr : '';
        runtime.setInput(id, next);
        onDirty?.(id);
      },
    });
  });
}
