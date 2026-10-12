// SPDX-License-Identifier: MPL-2.0
/** A link appearing beneath a stationary pointer is not navigation intent. */
export function wireViewPrewarmIntent(doc: Document, warm: (target: Element) => void, complete: () => boolean): () => void {
  let pointer: { x: number; y: number } | undefined, keyboard = false, stopped = false;
  let lastMoveTarget: EventTarget | null = null;
  function intent(event: Event): void {
    if (stopped || !(event.target instanceof Element)) return;
    warm(event.target);
    if (complete()) stop();
  }
  function move(event: PointerEvent): void {
    if (event.pointerType === 'touch') return;
    const changed = pointer ? pointer.x !== event.clientX || pointer.y !== event.clientY : !!(event.movementX || event.movementY);
    pointer = { x: event.clientX, y: event.clientY };
    if (!changed) return;
    keyboard = false;
    if (event.target === lastMoveTarget) return;
    lastMoveTarget = event.target; intent(event);
  }
  function press(event: PointerEvent): void { keyboard = false; intent(event); }
  function key(): void { keyboard = true; }
  function focus(event: FocusEvent): void { if (keyboard) intent(event); }
  function stop(): void {
    if (stopped) return; stopped = true; lastMoveTarget = null;
    doc.removeEventListener('pointermove', move, true);
    doc.removeEventListener('pointerdown', press, true);
    doc.removeEventListener('keydown', key, true);
    doc.removeEventListener('focusin', focus, true);
  }
  doc.addEventListener('pointermove', move, { capture: true, passive: true });
  doc.addEventListener('pointerdown', press, { capture: true, passive: true });
  doc.addEventListener('keydown', key, true);
  doc.addEventListener('focusin', focus, true);
  return stop;
}
