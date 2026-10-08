// SPDX-License-Identifier: MPL-2.0
/** Only visible navigator slots consume thumbnail work; names and rows stay available. */
export function thumbnailWork<T>(root: HTMLElement, build: (value: T) => HTMLElement | null, completed: (id: string, value: T, node: HTMLElement) => void) {
  const pending = new Map<string, { value: T; slot: HTMLElement }>(), visible = new Set<Element>();
  const view = root.ownerDocument.defaultView!;
  let frame = 0, disposed = false;
  const observer = typeof view.IntersectionObserver === 'function' ? new view.IntersectionObserver(entries => {
    for (const entry of entries) { if (entry.isIntersecting) visible.add(entry.target); else visible.delete(entry.target); }
    schedule();
  }, { root, rootMargin: '96px' }) : null;
  function schedule() { if (!disposed && !frame) frame = requestAnimationFrame(flush); }
  function flush() {
    frame = 0;
    const deadline = view.performance.now() + 4;
    let remaining = false;
    for (const [id, entry] of pending) {
      if (disposed || !root.contains(entry.slot)) { pending.delete(id); observer?.unobserve(entry.slot); visible.delete(entry.slot); continue; }
      if (observer && !visible.has(entry.slot)) continue;
      if (view.performance.now() >= deadline) { remaining = true; break; }
      pending.delete(id); observer?.unobserve(entry.slot); visible.delete(entry.slot);
      let node: HTMLElement | null = null;
      try { node = build(entry.value); } catch { node = null; }
      if (node) { completed(id, entry.value, node); entry.slot.replaceChildren(node); }
    }
    if (remaining) schedule();
  }
  return {
    set(id: string, value: T, slot: HTMLElement) {
      const old = pending.get(id); if (old) { observer?.unobserve(old.slot); visible.delete(old.slot); }
      pending.set(id, { value, slot }); observer?.observe(slot); schedule();
    },
    dispose() { disposed = true; if (frame) cancelAnimationFrame(frame); observer?.disconnect(); pending.clear(); visible.clear(); },
  };
}
