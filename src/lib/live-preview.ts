// SPDX-License-Identifier: MPL-2.0

const SVG_NS = 'http://www.w3.org/2000/svg';
const pending = new WeakMap<Element, object>();
const frameAttrs: Record<string, readonly string[]> = {
  svg: ['viewBox'], image: ['href', 'width', 'height'], polygon: ['points'],
};

/**
 * Patch an opted-in SVG camera preview without replacing its decoded image or
 * surrounding controls. Only frame attributes may differ; a result, source,
 * script or structural change still takes the ordinary full render path.
 */
export function patchLivePreview(container: HTMLElement, previous: string | null, next: string): boolean {
  if (!previous?.includes('data-live-preview') || !next.includes('data-live-preview')) return false;
  const doc = container.ownerDocument;
  const before = doc.createElement('template');
  const after = doc.createElement('template');
  before.innerHTML = previous;
  after.innerHTML = next;
  const oldRoots = before.content.querySelectorAll('svg[data-live-preview]');
  const newRoots = after.content.querySelectorAll('svg[data-live-preview]');
  const liveRoots = container.querySelectorAll('svg[data-live-preview]');
  if (oldRoots.length !== 1 || newRoots.length !== 1 || liveRoots.length !== 1) return false;
  const oldRoot = oldRoots[0]!;
  const newRoot = newRoots[0]!;
  const liveRoot = liveRoots[0]!;
  const oldNodes = [oldRoot, ...oldRoot.querySelectorAll('*')];
  const newNodes = [newRoot, ...newRoot.querySelectorAll('*')];
  const liveNodes = [liveRoot, ...liveRoot.querySelectorAll('*')];
  if (oldNodes.length !== newNodes.length || oldNodes.length !== liveNodes.length) return false;
  const updates: Array<{ node: Element; name: string; value: string | null }> = [];
  let imageSrc = '';
  for (let i = 0; i < oldNodes.length; i++) {
    const oldNode = oldNodes[i]!;
    const newNode = newNodes[i]!;
    const liveNode = liveNodes[i]!;
    if ([oldNode, newNode, liveNode].some(node => node.namespaceURI !== SVG_NS || node.localName !== oldNode.localName)) return false;
    for (const name of frameAttrs[oldNode.localName] ?? []) {
      const oldValue = oldNode.getAttribute(name);
      const value = newNode.getAttribute(name);
      if (oldValue === value && liveNode.getAttribute(name) === value) continue;
      // A live image is local camera data, never a URL to fetch or an SVG script.
      if (name === 'href') {
        if (!value || !/^data:image\/(?:jpeg|png|webp);base64,/.test(value)) return false;
        imageSrc = value;
      }
      updates.push({ node: liveNode, name, value });
      if (value === null) oldNode.removeAttribute(name);
      else oldNode.setAttribute(name, value);
    }
  }
  // Compare the complete template, not the live DOM: Copy feedback and revealed
  // secrets are local UI state and must survive camera ticks.
  if (before.innerHTML !== after.innerHTML) return false;
  const ticket = {};
  pending.set(liveRoot, ticket);
  const apply = () => {
    if (!container.contains(liveRoot) || pending.get(liveRoot) !== ticket) return;
    for (const { node, name, value } of updates) {
      if (value === null) node.removeAttribute(name);
      else node.setAttribute(name, value);
    }
  };
  if (imageSrc && doc.defaultView) {
    // Keep the last decoded frame visible while WebKit decodes the next JPEG.
    // A late load must never overwrite a newer frame or a newly mounted result.
    const image = new doc.defaultView.Image();
    image.onload = apply;
    image.src = imageSrc;
  } else apply();
  return true;
}
