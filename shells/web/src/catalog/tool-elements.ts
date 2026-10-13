// SPDX-License-Identifier: MPL-2.0
import { catalogVerificationRequired } from './integrity.ts';
import { instancePath } from '../lib/instance.ts';
import { verifiedResourceURL, protectedPath } from './tool-bytes.ts';

let installed = false;
/** Dynamic library elements receive a verified local URL before browser loading starts. */
export function installVerifiedToolElements(read: (url: string) => Promise<string> = verifiedResourceURL,
  required: () => boolean = catalogVerificationRequired, root: () => string = () => instancePath('/tools/')): void {
  if (installed || !required() || typeof HTMLScriptElement === 'undefined') return;
  installed = true;
  const attributes = Element.prototype.setAttribute;
  const revisions = new WeakMap<Element, number>();
  const apply = (element: Element, value: string, original: (value: string) => void): void => {
    const revision = (revisions.get(element) ?? 0) + 1; revisions.set(element, revision);
    let address: URL;
    try { address = new URL(value, location.href); } catch { original(value); return; }
    const instance = new URL(root(), location.href);
    const prefix = instance.pathname.replace(/\/tools\/?$/, '');
    const path = prefix && address.pathname.startsWith(prefix + '/') ? address.pathname.slice(prefix.length) : address.pathname;
    if (address.origin !== instance.origin || !protectedPath(path)) { original(value); return; }
    void read(address.href).then(url => {
      if (revisions.get(element) === revision && element.isConnected) original(url);
    }).catch(() => {
      if (revisions.get(element) === revision) element.dispatchEvent(new Event('error'));
    });
  };
  const script = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src')!;
  Object.defineProperty(HTMLScriptElement.prototype, 'src', { ...script,
    set(this: HTMLScriptElement, value: string) { apply(this, String(value), next => script.set!.call(this, next)); },
  });
  const link = Object.getOwnPropertyDescriptor(HTMLLinkElement.prototype, 'href')!;
  Object.defineProperty(HTMLLinkElement.prototype, 'href', { ...link,
    set(this: HTMLLinkElement, value: string) {
      apply(this, String(value), next => link.set!.call(this, next));
    },
  });
  for (const elementType of [HTMLImageElement, HTMLMediaElement, HTMLSourceElement, HTMLIFrameElement]) {
    const source = Object.getOwnPropertyDescriptor(elementType.prototype, 'src');
    if (!source?.set) continue;
    Object.defineProperty(elementType.prototype, 'src', { ...source,
      set(this: Element, value: string) { apply(this, String(value), next => source.set!.call(this, next)); },
    });
  }
  Element.prototype.setAttribute = function(name: string, value: string): void {
    const key = name.toLowerCase();
    if ((['SCRIPT', 'IMG', 'VIDEO', 'AUDIO', 'SOURCE', 'IFRAME'].includes(this.tagName) && key === 'src') || (this.tagName === 'LINK' && key === 'href')) {
      apply(this, String(value), next => attributes.call(this, name, next));
    } else attributes.call(this, name, value);
  };
}
