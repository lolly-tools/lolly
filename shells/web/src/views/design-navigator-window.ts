// SPDX-License-Identifier: MPL-2.0
/** Bounded row mounting for long navigator lists; small documents keep ordinary DOM. */
export function navigatorWindow<T>(host: HTMLElement, build: (value: T, index: number) => HTMLElement, opts: { height?: number; limit?: number } = {}) {
  const height = opts.height ?? 32, limit = opts.limit ?? 120;
  let values: readonly T[] = [], start = -1, end = -1, frame = 0, disposed = false, managed = true;
  const before = host.ownerDocument.createElement('div'), after = host.ownerDocument.createElement('div');
  before.setAttribute('aria-hidden', 'true'); after.setAttribute('aria-hidden', 'true');
  before.className = after.className = 'fc-nav-window-space';
  function paint(force = false): void {
    frame = 0;
    if (disposed || !managed) return;
    const virtual = values.length > limit;
    const count = virtual ? Math.min(limit, Math.ceil((host.clientHeight || 320) / height) + 16) : values.length;
    const nextStart = virtual ? Math.max(0, Math.min(Math.max(0, values.length - count), Math.floor(host.scrollTop / height) - 8)) : 0;
    const nextEnd = Math.min(values.length, nextStart + count);
    if (!force && start === nextStart && end === nextEnd) return;
    start = nextStart; end = nextEnd;
    before.style.height = `${start * height}px`; after.style.height = `${(values.length - end) * height}px`;
    host.classList.toggle('is-windowed', virtual);
    host.replaceChildren(...(virtual ? [before] : []), ...values.slice(start, end).map((value, offset) => {
      const node = build(value, start + offset); node.dataset.windowIndex = String(start + offset); return node;
    }), ...(virtual ? [after] : []));
  }
  function scroll(): void { if (!disposed && !frame) frame = requestAnimationFrame(() => paint()); }
  function reveal(index: number, focus = true): void {
    if (index < 0 || index >= values.length) return;
    if (values.length > limit && (index < start || index >= end)) { host.scrollTop = index * height; paint(true); }
    const node = host.querySelector<HTMLElement>(`[data-window-index="${index}"]`);
    if (focus) (node?.matches('[data-nav-row]') ? node : node?.querySelector<HTMLElement>('[data-nav-row]'))?.focus();
  }
  function key(event: KeyboardEvent): void {
    if (values.length <= limit || event.metaKey || event.ctrlKey || event.altKey) return;
    const row = (event.target as Element).closest<HTMLElement>('[data-nav-row]');
    if (!row || row !== event.target || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const index = Number(row.closest<HTMLElement>('[data-window-index]')?.dataset.windowIndex);
    if (!Number.isInteger(index)) return;
    event.preventDefault(); event.stopPropagation();
    reveal(event.key === 'Home' ? 0 : event.key === 'End' ? values.length - 1 : Math.max(0, Math.min(values.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))));
  }
  host.addEventListener('scroll', scroll, { passive: true });
  host.addEventListener('keydown', key, true);
  return {
    set(next: readonly T[]): void { managed = true; values = next; paint(true); },
    reset(): void { managed = false; if (frame) cancelAnimationFrame(frame); frame = 0; values = []; start = end = -1; host.classList.remove('is-windowed'); },
    reveal,
    destroy(): void { disposed = true; if (frame) cancelAnimationFrame(frame); host.removeEventListener('scroll', scroll); host.removeEventListener('keydown', key, true); values = []; },
  };
}
