// SPDX-License-Identifier: MPL-2.0
/** Wait for decoded images and stable preview content during documentation captures. */
type CaptureRoot = ParentNode & Node & { setAttribute(name: string, value: string): void };

function looksFinished(root: CaptureRoot, pendingAttribute: string): Promise<void> {
  const pending = (): number => root.querySelectorAll(`[${pendingAttribute}]`).length;
  if (!pending()) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const observer = new MutationObserver(() => {
      if (pending()) return;
      observer.disconnect();
      resolve();
    });
    observer.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: [pendingAttribute] });
  });
}

export function settleForCapture(root: CaptureRoot, settledAttribute: string, pendingAttribute: string): void {
  void (async () => {
    let stable = 0;
    let prev = -1;
    for (let round = 0; round < 40 && stable < 2; round++) {
      const imgs = Array.from(root.querySelectorAll('img'));
      for (const im of imgs) im.loading = 'eager';
      await Promise.all(imgs.map((im) => (im.complete ? Promise.resolve() : new Promise<void>((res) => {
        im.addEventListener('load', () => res(), { once: true });
        im.addEventListener('error', () => res(), { once: true });
      }))));
      await Promise.all(imgs.map((im) => im.decode?.().catch(() => undefined)));
      await looksFinished(root, pendingAttribute);
      await new Promise<void>((res) => setTimeout(res, 150));
      const now = root.querySelectorAll('*').length;
      stable = now === prev ? stable + 1 : 0;
      prev = now;
    }
    await looksFinished(root, pendingAttribute);
    root.setAttribute(settledAttribute, 'true');
  })();
}
