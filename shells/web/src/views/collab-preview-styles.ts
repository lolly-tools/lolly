// SPDX-License-Identifier: MPL-2.0
/** A disposable style revision for scoped previews, including loaded fonts. */
export function previewStyleRevision(doc: Document, refresh: () => void) {
  let revision = 0, root: HTMLElement | null = null;
  const changed = () => { revision++; refresh(); };
  const observer = new doc.defaultView!.MutationObserver(changed);
  observer.observe(doc.head, { subtree: true, childList: true, characterData: true, attributes: true });
  const ancestors = new doc.defaultView!.MutationObserver(changed);
  doc.fonts?.addEventListener('loadingdone', changed);
  doc.fonts?.addEventListener('loadingerror', changed);
  return {
    read(element: HTMLElement | null) {
      if (root !== element) {
        ancestors.disconnect(); root = element; revision++;
        for (let at = root; at; at = at.parentElement) ancestors.observe(at, { attributes: true });
        if (root) ancestors.observe(root, { subtree: true, childList: true, characterData: true, attributes: true });
      }
      if (observer.takeRecords().length + ancestors.takeRecords().length) revision++;
      return revision;
    },
    dispose() { observer.disconnect(); ancestors.disconnect(); doc.fonts?.removeEventListener('loadingdone', changed); doc.fonts?.removeEventListener('loadingerror', changed); },
  };
}
