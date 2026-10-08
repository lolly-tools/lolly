// SPDX-License-Identifier: MPL-2.0
/** Cache source ranges so unchanged markup can be compared without rebuilding its DOM. */
import type { FastPatch } from './canvas-scene.ts';

const HTML_NS = 'http://www.w3.org/1999/xhtml';
const selector = '.lolly-box[data-box-id],.lolly-frame-page[data-frame-id]';
const metadataNames = ['data-penpot-doc', 'data-pptx-deck'] as const;
const globalPosition = /^(?:position:absolute;)?left:-?\d+px;top:-?\d+px;/;
interface Span {
  start: number;
  end: number;
  raw: string;
  quote: string;
  key: string;
  kind: 'box' | 'frame' | 'metadata';
  css?: string;
  owner?: string;
}
export interface TranslationSource { html: string; spans: Span[] }
interface Attribute { raw: string; start: number; end: number; quote: string }

function styleNode(doc: Document, raw: string, quote: string): HTMLElement {
  const template = doc.createElement('template');
  template.innerHTML = `<div style=${quote}${raw}${quote}></div>`;
  return template.content.firstElementChild as HTMLElement;
}

/** Only quoted attributes and ordinary raw-text endings enter the cached path. */
function sourceSpans(html: string): Span[] | null {
  const spans: Span[] = [];
  for (let cursor = 0; cursor < html.length;) {
    const start = html.indexOf('<', cursor);
    if (start < 0) break;
    if (html.startsWith('<!--', start)) {
      const end = html.indexOf('-->', start + 4);
      if (end < 0) return null;
      cursor = end + 3; continue;
    }
    const tag = /^<(\/?)([a-z][\w:-]*)\b/i.exec(html.slice(start));
    if (!tag) { cursor = start + 1; continue; }
    const name = tag[2]!.toLowerCase();
    if (name === 'noscript' || name === 'plaintext') return null;
    const attrs = new Map<string, Attribute>();
    cursor = start + tag[0].length;
    while (cursor < html.length) {
      while (/\s/.test(html[cursor] ?? '') && cursor < html.length) cursor++;
      if (html[cursor] === '>' || html.startsWith('/>', cursor)) break;
      const attr = /^[^\s"'<>/=]+/.exec(html.slice(cursor));
      if (!attr) return null;
      const key = attr[0].toLowerCase();
      if (attrs.has(key)) return null;
      cursor += attr[0].length;
      while (/\s/.test(html[cursor] ?? '') && cursor < html.length) cursor++;
      let raw = '', quote = '', from = cursor, end = cursor;
      if (html[cursor] === '=') {
        cursor++;
        while (/\s/.test(html[cursor] ?? '') && cursor < html.length) cursor++;
        quote = html[cursor] ?? '';
        if (quote !== '"' && quote !== "'") return null;
        from = cursor + 1; end = html.indexOf(quote, from);
        if (end < 0) return null;
        raw = html.slice(from, end); cursor = end + 1;
      }
      if (['class', 'data-box-id', 'data-frame-id'].includes(key) && /[&<>\r]/.test(raw)) return null;
      attrs.set(key, { raw, start: from, end, quote });
    }
    if (cursor >= html.length) return null;
    cursor += html.startsWith('/>', cursor) ? 2 : 1;
    if (tag[1]) continue;
    const classes = attrs.get('class')?.raw.split(/\s+/) ?? [];
    const box = classes.includes('lolly-box'), frame = classes.includes('lolly-frame-page');
    if (box || frame) {
      const id = attrs.get(frame ? 'data-frame-id' : 'data-box-id'), style = attrs.get('style');
      if (name !== 'div' || box && frame || !id?.raw || !style?.quote) return null;
      spans.push({ ...style, key: `${frame ? 'frame' : 'box'}:${id.raw}`, kind: frame ? 'frame' : 'box' });
    }
    if (['script', 'style', 'textarea', 'title', 'xmp', 'iframe', 'noembed', 'noframes'].includes(name)) {
      const ending = new RegExp(`</${name}\\s*>`, 'ig');
      ending.lastIndex = cursor;
      const close = ending.exec(html);
      if (!close) return null;
      const raw = html.slice(cursor, close.index);
      if (new RegExp(`</?${name}(?:[\\s/>])`, 'i').test(raw) || name === 'script' && raw.includes('<!--')) return null;
      const metadata = metadataNames.filter(key => attrs.has(key));
      if (name === 'script' && metadata.length) {
        if (metadata.length !== 1 || attrs.get('type')?.raw !== 'application/json' || /[<\r]/.test(raw)) return null;
        spans.push({ start: cursor, end: close.index, raw, quote: close[0], key: metadata[0]!, kind: 'metadata' });
      }
      cursor = ending.lastIndex;
    }
  }
  return spans;
}

export function readTranslationSource(doc: Document, html: string, mounted?: ParentNode): TranslationSource | null {
  const spans = sourceSpans(html);
  if (!spans) return null;
  let root = mounted;
  if (!root) { const template = doc.createElement('template'); template.innerHTML = html; root = template.content; }
  const elements = [...root.querySelectorAll<HTMLElement>(selector)];
  const geometry = spans.filter(span => span.kind !== 'metadata');
  if (elements.length !== geometry.length) return null;
  const seen = new Set<string>();
  for (let i = 0; i < elements.length; i++) {
    const node = elements[i]!, span = geometry[i]!;
    const frame = node.classList.contains('lolly-frame-page');
    const key = `${frame ? 'frame' : 'box'}:${node.getAttribute(frame ? 'data-frame-id' : 'data-box-id')}`;
    if (node.namespaceURI !== HTML_NS || node.localName !== 'div' || span.key !== key || seen.has(key)) return null;
    seen.add(key);
    const style = span.raw.includes('&') ? styleNode(doc, span.raw, span.quote).getAttribute('style') : span.raw;
    if (style === null || node.getAttribute('style') !== style) return null;
    // Parse CSS only for the styles a later translation needs to compare.
    span.css = style;
    if (!frame) span.owner = node.closest('.lolly-frame-page')?.getAttribute('data-frame-id') ?? '';
  }
  for (const name of metadataNames) {
    const nodes = root.querySelectorAll(`script[type="application/json"][${name}]`);
    const parts = spans.filter(span => span.key === name);
    if (nodes.length !== parts.length || parts.length > 1 || parts[0] && nodes[0]!.textContent !== parts[0].raw) return null;
  }
  return { html, spans };
}

export function sameFrameLocalStyle(doc: Document, before: string, after: string): boolean {
  if (!globalPosition.test(before) || !globalPosition.test(after)) return false;
  if (before.replace(globalPosition, '') !== after.replace(globalPosition, '')) return false;
  const node = doc.createElement('div'); node.setAttribute('style', before);
  const css = node.style.cssText; node.setAttribute('style', after);
  return node.style.cssText === css;
}

export function translationStyle(doc: Document, css: string, patch: FastPatch): CSSStyleDeclaration | null {
  const { style } = doc.createElement('div'); style.cssText = css;
  if (patch.localDelta) {
    if (!/^-?\d+(?:\.\d+)?px$/.test(style.left) || !/^-?\d+(?:\.\d+)?px$/.test(style.top)) return null;
    style.left = `${parseFloat(style.left) + patch.localDelta.dx}px`;
    style.top = `${parseFloat(style.top) + patch.localDelta.dy}px`;
  } else { style.left = `${patch.x}px`; style.top = `${patch.y}px`; }
  return style;
}

export function proveTranslationSource(doc: Document, source: TranslationSource, next: string, plan: readonly FastPatch[]): {
  source: TranslationSource; metadata: Array<{ attribute: string; text: string }>;
  targets: Array<{ patch: FastPatch; left: string; top: string }>;
} | null {
  const patches = new Map(plan.map(patch => [`${patch.frame ? 'frame' : 'box'}:${patch.id}`, patch]));
  if (patches.size !== plan.length) return null;
  const movedFrames = new Set(plan.filter(patch => patch.frame).map(patch => patch.id));
  const changes = new Map<Span, { raw: string; css?: string; delta: number }>();
  const metadata: Array<{ attribute: string; text: string }> = [];
  const targets: Array<{ patch: FastPatch; left: string; top: string }> = [];
  let oldCursor = 0, newCursor = 0;
  for (const span of source.spans) {
    const patch = patches.get(span.key);
    if (!patch && span.kind !== 'metadata' && !(span.owner && movedFrames.has(span.owner))) continue;
    const unchanged = source.html.slice(oldCursor, span.start);
    if (!next.startsWith(unchanged, newCursor)) return null;
    newCursor += unchanged.length;
    const end = next.indexOf(span.quote, newCursor);
    if (end < 0) return null;
    const raw = next.slice(newCursor, end);
    let css = span.css;
    if (span.kind === 'metadata') {
      if (/[<\r]/.test(raw)) return null;
      try { JSON.parse(raw); } catch { return null; }
      metadata.push({ attribute: span.key, text: raw });
    } else if (patch || raw !== span.raw) {
      const candidate = styleNode(doc, raw, span.quote);
      css = candidate.style.cssText;
      if (patch) {
        const { style } = candidate;
        const control = translationStyle(doc, span.css!, patch);
        if (!control || style.left !== control.left || style.top !== control.top || style.getPropertyPriority('left') || style.getPropertyPriority('top')) return null;
        if (control.cssText !== css) return null;
        targets.push({ patch, left: style.left, top: style.top });
      } else {
        const original = styleNode(doc, span.raw, span.quote);
        if (!sameFrameLocalStyle(doc, original.getAttribute('style')!, candidate.getAttribute('style')!)) return null;
      }
    }
    // A sliced CSS string can retain an entire older render. Copy changed styles
    // so editing many different boxes does not retain every document revision.
    const retained = raw === span.raw ? span.raw : span.kind === 'metadata' ? raw : String(JSON.parse(JSON.stringify(raw)));
    changes.set(span, { raw: retained, css, delta: raw.length - span.raw.length });
    oldCursor = span.end; newCursor = end;
  }
  if (targets.length !== plan.length || next.slice(newCursor) !== source.html.slice(oldCursor)) return null;
  let offset = 0;
  const spans = source.spans.map(span => {
    const change = changes.get(span), delta = change?.delta ?? 0;
    const result = { ...span, start: span.start + offset, end: span.end + offset + delta,
      raw: change?.raw ?? span.raw, css: change?.css ?? span.css };
    offset += delta;
    return result;
  });
  return { source: { html: next, spans }, metadata, targets };
}
