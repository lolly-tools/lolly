// SPDX-License-Identifier: MPL-2.0
/** Snapshot scoped artwork styles before moving a preview into screen coordinates. */
export function previewContentWork(source: HTMLElement, maxElements = 512): { step(deadline: number): { done: boolean; content?: HTMLElement } } {
  // Oversized artwork keeps its outline rather than creating an unbounded clone.
  const originals: Array<HTMLElement | SVGElement> = [source];
  const walker = source.ownerDocument.createTreeWalker(source, 1);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (originals.length >= maxElements) return { step: () => ({ done: true }) };
    originals.push(node as HTMLElement | SVGElement);
  }
  const clone = source.cloneNode(true) as HTMLElement;
  const copies = [clone, ...clone.querySelectorAll<HTMLElement | SVGElement>('*')];
  const view = source.ownerDocument.defaultView;
  let index = 0;
  return { step(deadline) {
    do {
      const copy = copies[index]!;
      const computed = view?.getComputedStyle(originals[index]!);
      if (computed && copy.style) {
        for (let i = 0; i < computed.length; i++) {
          const property = computed.item(i);
          copy.style.setProperty(property, computed.getPropertyValue(property));
        }
      }
      copy.removeAttribute('id'); copy.removeAttribute('contenteditable'); copy.removeAttribute('autofocus');
      copy.setAttribute('tabindex', '-1'); index++;
    } while (index < copies.length && (view?.performance.now() ?? 0) < deadline);
    if (index < copies.length) return { done: false };
    clone.querySelectorAll('script,iframe,object,embed,video,audio').forEach(el => { el.remove(); });
    clone.classList.add('collab-preview-content'); clone.inert = true;
    Object.assign(clone.style, { position: 'absolute', left: '0', top: '0', margin: '0',
      transformOrigin: '0 0', pointerEvents: 'none', transition: 'none', animation: 'none' });
    return { done: true, content: clone };
  } };
}

export function clonePreviewContent(source: HTMLElement): HTMLElement {
  return previewContentWork(source, Infinity).step(Infinity).content!;
}

export function sizePreviewContent(clone: HTMLElement, width: number, height: number, screenWidth: number, screenHeight: number): void {
  // Keep native typography inside the clone; only the outer scale maps to the viewport.
  Object.assign(clone.style, { width: `${width}px`, height: `${height}px`,
    transform: `scale(${screenWidth / Math.max(1, width)}, ${screenHeight / Math.max(1, height)})` });
}
