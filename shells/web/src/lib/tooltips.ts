// SPDX-License-Identifier: MPL-2.0
/** Shared hover, focus and touch-hold help outside scrolling chrome. */
const mounted = new WeakMap<Document, { release(): void; users: number }>();
export function mountTooltips(doc: Document = document): () => void {
  const existing = mounted.get(doc);
  if (existing) { existing.users++; return () => release(); }
  const win = doc.defaultView!;
  let bubble: HTMLElement | undefined;
  let target: HTMLElement | undefined;
  let nativeTitle: string | null = null;
  let hold: ReturnType<typeof setTimeout> | undefined;
  let held: HTMLElement | undefined;
  let pending: { target: HTMLElement; id: number; x: number; y: number } | undefined;
  let touchUntil = 0;
  const listeners: Array<() => void> = [];
  const listen = (node: EventTarget, name: string, handler: EventListener, capture = false): void => {
    node.addEventListener(name, handler, capture); listeners.push(() => node.removeEventListener(name, handler, capture));
  };
  const cancelHold = (): void => { if (hold) clearTimeout(hold); hold = undefined; pending = undefined; };
  const hide = (): void => {
    if (target) {
      delete target.dataset.tooltipManaged;
      if (nativeTitle !== null) target.setAttribute('title', nativeTitle);
      const described = (target.getAttribute('aria-describedby') || '').split(/\s+/).filter(id => id && id !== bubble?.id);
      if (described.length) target.setAttribute('aria-describedby', described.join(' ')); else target.removeAttribute('aria-describedby');
    }
    target = undefined;
    nativeTitle = null;
    if (bubble) {
      if (typeof bubble.hidePopover === 'function' && bubble.matches(':popover-open')) bubble.hidePopover();
      bubble.remove(); bubble = undefined;
    }
  };
  const trigger = (node: EventTarget | null): HTMLElement | undefined => {
    const element = node instanceof win.Element ? node.closest<HTMLElement>('[data-tip]') : null;
    if (!element?.dataset.tip?.trim() || element.closest('[inert],[data-tooltip="off"]')) return;
    return element;
  };
  const show = (element: HTMLElement): void => {
    hide();
    if (!element.isConnected) return;
    target = element; target.dataset.tooltipManaged = '';
    nativeTitle = element.getAttribute('title'); element.removeAttribute('title');
    bubble = doc.createElement('div'); bubble.className = 'lolly-tooltip'; bubble.id = `lolly-tip-${crypto.randomUUID()}`;
    bubble.setAttribute('role', 'tooltip'); bubble.textContent = element.dataset.tip!;
    bubble.style.left = '-9999px'; bubble.style.top = '-9999px';
    target.setAttribute('aria-describedby', [target.getAttribute('aria-describedby'), bubble.id].filter(Boolean).join(' '));
    doc.body.append(bubble);
    if (typeof bubble.showPopover === 'function') { bubble.popover = 'manual'; bubble.showPopover(); }
    else doc.querySelector('dialog[open]')?.append(bubble);
    const viewport = win.visualViewport;
    const leftEdge = (viewport?.offsetLeft || 0) + 8, topEdge = (viewport?.offsetTop || 0) + 8;
    const rightEdge = leftEdge + (viewport?.width || win.innerWidth) - 16;
    const bottomEdge = topEdge + (viewport?.height || win.innerHeight) - 16;
    bubble.style.maxWidth = `${Math.max(0, Math.min(448, rightEdge - leftEdge))}px`;
    const rect = element.getBoundingClientRect(), size = bubble.getBoundingClientRect();
    bubble.style.left = `${Math.max(leftEdge, Math.min(rect.left + (rect.width - size.width) / 2, rightEdge - size.width))}px`;
    const above = rect.top - size.height - 8;
    bubble.style.top = `${Math.max(topEdge, Math.min(above >= topEdge ? above : rect.bottom + 8, bottomEdge - size.height))}px`;
  };
  const dismiss = (): void => { cancelHold(); hide(); };
  listen(doc, 'pointerover', event => {
    const e = event as PointerEvent;
    if (e.pointerType === 'touch' || Date.now() < touchUntil) return;
    const element = trigger(e.target); if (element && element !== target) show(element);
  });
  listen(doc, 'pointerout', event => {
    const e = event as PointerEvent;
    if (target && !target.contains(e.relatedTarget as Node | null) && e.pointerType !== 'touch') hide();
  });
  listen(doc, 'focusin', event => { const element = trigger(event.target); if (element && Date.now() >= touchUntil) show(element); });
  listen(doc, 'focusout', () => { if (!held) hide(); });
  listen(doc, 'pointerdown', event => {
    const e = event as PointerEvent;
    const wasPending = !!pending;
    dismiss(); held = undefined;
    if (e.pointerType !== 'touch') return;
    touchUntil = Date.now() + 1000;
    const element = trigger(e.target);
    if (wasPending || !e.isPrimary || !element?.matches('button,[role="button"],a[href]') || element.closest('[draggable="true"],[data-reorder-handle],.resize-grip,.tl-handle,[data-tooltip-hold="off"]')) return;
    pending = { target: element, id: e.pointerId, x: e.clientX, y: e.clientY };
    hold = setTimeout(() => { held = pending?.target; cancelHold(); if (held) show(held); }, 500);
  }, true);
  listen(doc, 'pointermove', event => {
    const e = event as PointerEvent;
    if (pending && Math.hypot(e.clientX - pending.x, e.clientY - pending.y) > 9) dismiss();
  }, true);
  listen(doc, 'pointerup', event => {
    const e = event as PointerEvent; cancelHold();
    // Gesture trackers still need the release to retire this pointer. Activation
    // is consumed by the click handler below.
    if (held) { e.preventDefault(); touchUntil = Date.now() + 1000; }
  }, true);
  listen(doc, 'pointercancel', () => { dismiss(); held = undefined; }, true);
  listen(doc, 'click', event => {
    if (!held || !(event.target instanceof win.Node) || !held.contains(event.target)) return;
    event.preventDefault(); event.stopImmediatePropagation(); held = undefined;
  }, true);
  listen(doc, 'contextmenu', event => {
    if (held || pending) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  listen(doc, 'keydown', event => { if ((event as KeyboardEvent).key === 'Escape' && target) { dismiss(); held = undefined; event.preventDefault(); event.stopImmediatePropagation(); } }, true);
  listen(doc, 'scroll', dismiss, true); listen(win, 'resize', dismiss);
  if (win.visualViewport) { listen(win.visualViewport, 'resize', dismiss); listen(win.visualViewport, 'scroll', dismiss); }
  const observer = new win.MutationObserver(() => { if (target && (!target.isConnected || target.closest('[inert]'))) dismiss(); if (held && !held.isConnected) held = undefined; });
  observer.observe(doc.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['inert'] });
  doc.documentElement.dataset.tooltips = '';
  mounted.set(doc, { users: 1, release() { dismiss(); observer.disconnect(); for (const stop of listeners) stop(); delete doc.documentElement.dataset.tooltips; } });
  return () => release();

  function release(): void {
    const entry = mounted.get(doc); if (!entry || --entry.users) return;
    entry.release(); mounted.delete(doc);
  }
}
