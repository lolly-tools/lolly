// SPDX-License-Identifier: MPL-2.0

let nextLabel = 0;
const linkedSliderCaptions = new WeakSet<HTMLElement>();

/** Keep help and attachment buttons from taking a field's wrapping label. */
export function linkInputLabels(scope: HTMLElement): void {
  const rows = [...scope.querySelectorAll<HTMLLabelElement>('label.input-row')];
  if (scope.matches('label.input-row')) rows.unshift(scope as HTMLLabelElement);
  rows.forEach((row) => {
    const caption = row.querySelector<HTMLElement>('.input-label-text');
    const control = row.querySelector<HTMLElement>(
      'input:not([type="hidden"]):not(.is-upgraded), select, textarea, [role="slider"]',
    );
    if (!caption || !control) return;
    if (!caption.id) caption.id = `input-caption-${++nextLabel}`;
    if (!control.id) control.id = `${caption.id}-control-${++nextLabel}`;
    row.htmlFor = control.id;
    // A custom slider is not labelable. Explicit `for` keeps the browser from
    // implicitly assigning the row to its first help or input-actions button.
    if (control.matches('[role="slider"]') && !linkedSliderCaptions.has(caption)) {
      linkedSliderCaptions.add(caption);
      caption.addEventListener('click', () => row.querySelector<HTMLElement>('[role="slider"]')?.focus({ preventScroll: true }));
    }
    if (!control.getAttribute('aria-label') && !control.hasAttribute('aria-labelledby')) {
      control.setAttribute('aria-labelledby', caption.id);
    }
  });
}
