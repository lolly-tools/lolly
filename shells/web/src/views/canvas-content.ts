// SPDX-License-Identifier: MPL-2.0
import { cssEscape } from '../lib/util/escape.ts';
declare global { interface Window { __lollyCanvasContentPath?: { patches: number } } }

const cached = new WeakMap<HTMLElement, { html: string; template: HTMLTemplateElement }>();
const enhanced = 'script,style,video,audio,iframe,canvas,[data-lottie-src],[data-anim-src],[data-lolly-scene],[data-lolly-web],[data-t-split],[contenteditable]';
function parse(doc: Document, html: string): HTMLTemplateElement {
  const template = doc.createElement('template'); template.innerHTML = html; return template;
}
function safe(node: HTMLElement): boolean {
  return node.namespaceURI === 'http://www.w3.org/1999/xhtml' && node.localName === 'div'
    && node.getAttribute('data-fit') !== '1' && !node.matches(enhanced) && !node.querySelector(enhanced)
    && ![...node.attributes].some(attr => attr.name.startsWith('data-t-'));
}

/** All targets and unchanged template content are checked before any live mutation. */
export function patchCanvasContent(container: HTMLElement, previous: string | null, next: string, ids: readonly string[]): boolean {
  if (!previous || !ids.length || new Set(ids).size !== ids.length) return false;
  const mounted = new Map<string, HTMLElement>();
  for (const id of ids) {
    const nodes = container.querySelectorAll<HTMLElement>(`.lolly-box[data-box-id="${cssEscape(id)}"]`);
    if (nodes.length !== 1 || !safe(nodes[0]!)) return false;
    mounted.set(id, nodes[0]!);
  }
  const before = cached.get(container)?.html === previous ? cached.get(container)!.template : parse(container.ownerDocument, previous);
  const after = parse(container.ownerDocument, next);
  const updates: Array<{ old: HTMLElement; next: HTMLElement; live: HTMLElement }> = [];
  const metadata: Array<{ old: Element; next: Element; live: Element }> = [];
  for (const id of ids) {
    const selector = `.lolly-box[data-box-id="${cssEscape(id)}"]`;
    const oldNodes = before.content.querySelectorAll<HTMLElement>(selector), newNodes = after.content.querySelectorAll<HTMLElement>(selector);
    if (oldNodes.length !== 1 || newNodes.length !== 1) return false;
    const old = oldNodes[0]!, node = newNodes[0]!, live = mounted.get(id)!;
    if (![old, node, live].every(safe) || old.innerHTML !== live.innerHTML) return false;
    if (old.querySelector('.lolly-box') || node.querySelector('.lolly-box')) return false;
    updates.push({ old, next: node, live });
  }
  for (const attribute of ['data-penpot-doc', 'data-pptx-deck']) {
    const selector = `script[type="application/json"][${attribute}]`;
    const a = before.content.querySelectorAll(selector), b = after.content.querySelectorAll(selector), c = container.querySelectorAll(selector);
    if (!a.length && !b.length) continue;
    if (a.length !== 1 || b.length !== 1 || c.length !== 1) return false;
    try { JSON.parse(b[0]!.textContent ?? ''); } catch { return false; }
    metadata.push({ old: a[0]!, next: b[0]!, live: c[0]! });
  }
  // The cached tree is a proof scratchpad. Never reuse it after a failed proof.
  cached.delete(container);
  for (const update of updates) update.old.replaceWith(update.next.cloneNode(true));
  for (const update of metadata) update.old.textContent = update.next.textContent;
  if (!before.content.isEqualNode(after.content)) return false;
  for (const { old, next: node, live } of updates) {
    for (const attr of [...live.attributes]) if (!node.hasAttribute(attr.name)) live.removeAttribute(attr.name);
    for (const attr of [...node.attributes]) if (live.getAttribute(attr.name) !== attr.value) live.setAttribute(attr.name, attr.value);
    if (old.innerHTML !== node.innerHTML) live.replaceChildren(...[...node.childNodes].map(child => child.cloneNode(true)));
  }
  for (const update of metadata) update.live.textContent = update.next.textContent;
  cached.set(container, { html: next, template: after });
  return true;
}
