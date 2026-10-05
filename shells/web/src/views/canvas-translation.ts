// SPDX-License-Identifier: MPL-2.0
import type { FastPatch } from './canvas-scene.ts';
import { cssEscape } from '../lib/util/escape.ts';
import { proveTranslationSource, readTranslationSource, sameFrameLocalStyle, translationStyle, type TranslationSource } from './canvas-translation-source.ts';

const sources = new WeakMap<HTMLElement, { html: string; source: TranslationSource | null }>();
const patchSelector = (patch: FastPatch): string => patch.frame
  ? `.lolly-frame-page[data-frame-id="${cssEscape(patch.id)}"]`
  : `.lolly-box[data-box-id="${cssEscape(patch.id)}"]`;
const patchKey = (patch: FastPatch): string => `${patch.frame ? 'frame' : 'box'}:${patch.id}`;
const targetRoles = [
  ['box', 'lolly-box', 'data-box-id'], ['frame', 'lolly-frame-page', 'data-frame-id'],
] as const;

/** Large selections share one DOM walk while retaining target uniqueness checks. */
function mountedTargets(container: HTMLElement, plan: readonly FastPatch[]): Map<string, HTMLElement> | null {
  const targets = new Map<string, HTMLElement>();
  if (plan.length < 64) {
    for (const patch of plan) {
      const nodes = container.querySelectorAll<HTMLElement>(patchSelector(patch));
      if (nodes.length !== 1) return null;
      targets.set(patchKey(patch), nodes[0]!);
    }
  } else {
    const wanted = new Set(plan.map(patchKey));
    for (const node of container.querySelectorAll<HTMLElement>('.lolly-box[data-box-id],.lolly-frame-page[data-frame-id]')) {
      for (const [kind, className, attribute] of targetRoles) {
        if (!node.classList.contains(className) || !node.hasAttribute(attribute)) continue;
        const key = `${kind}:${node.getAttribute(attribute)}`;
        if (!wanted.has(key)) continue;
        if (targets.has(key)) return null;
        targets.set(key, node);
      }
    }
  }
  if (targets.size !== plan.length || [...targets.values()].some(node =>
    node.namespaceURI !== 'http://www.w3.org/1999/xhtml' || node.localName !== 'div')) return null;
  return targets;
}

/** Seed from a full paint before template scripts or editing chrome change the DOM. */
export function cacheCanvasTranslations(container: HTMLElement, html: string): void {
  sources.set(container, { html, source: readTranslationSource(container.ownerDocument, html, container) });
}

function patchCachedSource(container: HTMLElement, previous: string, next: string, plan: readonly FastPatch[]): boolean {
  let cached = sources.get(container);
  if (cached?.html !== previous) {
    cached = { html: previous, source: readTranslationSource(container.ownerDocument, previous) };
    sources.set(container, cached);
  }
  if (!cached.source) return false;
  const proof = proveTranslationSource(container.ownerDocument, cached.source, next, plan);
  if (!proof) return false;
  const targets = mountedTargets(container, plan);
  if (!targets) return false;
  const updates: Array<{ node: HTMLElement; left: string; top: string }> = [];
  const metadata: Array<{ node: Element; text: string }> = [];
  for (const { patch, left, top } of proof.targets) {
    updates.push({ node: targets.get(patchKey(patch))!, left, top });
  }
  for (const { attribute, text } of proof.metadata) {
    const nodes = container.querySelectorAll(`script[type="application/json"][${attribute}]`);
    if (nodes.length !== 1) return false;
    metadata.push({ node: nodes[0]!, text });
  }
  for (const { node, left, top } of updates) { node.style.left = left; node.style.top = top; }
  for (const { node, text } of metadata) node.textContent = text;
  sources.set(container, { html: next, source: proof.source });
  return true;
}

/**
 * Apply a geometry plan only when left/top explain the entire template change.
 * Comparing inert templates also catches non-box inputs and hook side effects.
 * Every target is checked before touching the mounted DOM.
 */
export function patchCanvasTranslations(
  container: HTMLElement, previous: string | null, next: string, plan: readonly FastPatch[],
): boolean {
  if (!previous || !plan.length) return false;
  if (patchCachedSource(container, previous, next, plan)) return true;
  const before = container.ownerDocument.createElement('template');
  const after = container.ownerDocument.createElement('template');
  before.innerHTML = previous;
  after.innerHTML = next;
  const updates: Array<{ node: HTMLElement; left: string; top: string }> = [];
  const metadata: Array<{ node: Element; text: string | null }> = [];
  const seen = new Set<string>();
  for (const patch of plan) {
    const selector = patchSelector(patch);
    if (seen.has(selector)) return false;
    seen.add(selector);
    const oldNodes = before.content.querySelectorAll<HTMLElement>(selector);
    const newNodes = after.content.querySelectorAll<HTMLElement>(selector);
    const liveNodes = container.querySelectorAll<HTMLElement>(selector);
    if (oldNodes.length !== 1 || newNodes.length !== 1 || liveNodes.length !== 1) return false;
    const oldNode = oldNodes[0]!, newNode = newNodes[0]!, liveNode = liveNodes[0]!;
    if ([oldNode, newNode, liveNode].some(node => node.namespaceURI !== 'http://www.w3.org/1999/xhtml' || node.localName !== oldNode.localName)) return false;
    const left = newNode.style.left, top = newNode.style.top;
    const expected = translationStyle(container.ownerDocument, oldNode.style.cssText, patch);
    if (!expected || left !== expected.left || top !== expected.top) return false;
    if (newNode.style.getPropertyPriority('left') || newNode.style.getPropertyPriority('top')) return false;
    oldNode.style.left = left; oldNode.style.top = top;
    // Normalize both style attributes through the same CSS serializer.
    newNode.style.left = left; newNode.style.top = top;
    oldNode.setAttribute('style', oldNode.style.cssText);
    newNode.setAttribute('style', newNode.style.cssText);
    if (patch.frame) {
      const oldChildren = oldNode.querySelectorAll<HTMLElement>('.lolly-box[data-box-id]');
      const newChildren = newNode.querySelectorAll<HTMLElement>('.lolly-box[data-box-id]');
      if (oldChildren.length !== newChildren.length) return false;
      for (let i = 0; i < oldChildren.length; i++) {
        const a = oldChildren[i]!, b = newChildren[i]!;
        if (a.getAttribute('data-box-id') !== b.getAttribute('data-box-id')) return false;
        const oldStyle = a.getAttribute('style') ?? '', newStyle = b.getAttribute('style') ?? '';
        if (oldStyle === newStyle) continue;
        if (!sameFrameLocalStyle(container.ownerDocument, oldStyle, newStyle)) return false;
        a.setAttribute('style', a.style.cssText); b.setAttribute('style', b.style.cssText);
      }
    }
    updates.push({ node: liveNode, left, top });
  }
  // These inert payloads describe the export document, including its positions.
  // Refresh them with the geometry; executable scripts still require a repaint.
  for (const attribute of ['data-penpot-doc', 'data-pptx-deck']) {
    const selector = `script[type="application/json"][${attribute}]`;
    const oldNodes = before.content.querySelectorAll(selector);
    const newNodes = after.content.querySelectorAll(selector);
    const liveNodes = container.querySelectorAll(selector);
    if (!oldNodes.length && !newNodes.length) continue;
    if (oldNodes.length !== 1 || newNodes.length !== 1 || liveNodes.length !== 1) return false;
    const text = newNodes[0]!.textContent;
    try { JSON.parse(text ?? ''); } catch { return false; }
    oldNodes[0]!.textContent = text;
    metadata.push({ node: liveNodes[0]!, text });
  }
  if (!before.content.isEqualNode(after.content)) return false;
  for (const { node, left, top } of updates) { node.style.left = left; node.style.top = top; }
  for (const { node, text } of metadata) node.textContent = text;
  return true;
}
