// SPDX-License-Identifier: MPL-2.0
/**
 * Text-based export formats: Markdown / plain text (walked from the DOM) and the
 * data formats (json/csv/ics/vcf) whose payload the engine already hydrated —
 * the host just wraps each with the right MIME.
 */

import type { FormatAdapter, RenderContext, ExportOptions } from './types.ts';

interface WalkHandlers {
  text(t: string): string;
  br?(): string;
  element?(tag: string, inner: string, node: Element): string;
}

// Recursive DOM walker shared by markdown and plain-text exports.
// Skips aria-hidden elements, <style>, <script>, and <img>.
function walkDom(node: Node, handlers: WalkHandlers): string {
  if (node.nodeType === 3) return handlers.text(node.textContent ?? '');
  if (!(node instanceof Element)) return '';
  if (node.getAttribute('aria-hidden') === 'true') return '';
  const tag = node.tagName.toLowerCase();
  if (tag === 'style' || tag === 'script' || tag === 'img') return '';
  if (tag === 'br') return handlers.br?.() ?? '\n';
  const inner = [...node.childNodes].map(n => walkDom(n, handlers)).join('');
  return handlers.element?.(tag, inner, node) ?? inner;
}

export function renderMarkdown(node: HTMLElement): Blob {
  const handlers: WalkHandlers = {
    text: t => t,
    br: () => '\n',
    element(tag, inner) {
      const s = inner.trim();
      switch (tag) {
        case 'strong': case 'b': return s ? `**${s}**` : '';
        case 'em':     case 'i': return s ? `*${s}*`   : '';
        case 'p':   return s ? s + '\n\n' : '';
        case 'h1':  return s ? `# ${s}\n\n` : '';
        case 'h2':  return s ? `## ${s}\n\n` : '';
        case 'h3':  return s ? `### ${s}\n\n` : '';
        case 'blockquote': return s ? `> ${s.replace(/\n/g, '\n> ')}\n\n` : '';
        case 'a':   return inner; // href not useful without context
        default:    return inner;
      }
    },
  };
  const md = walkDom(node, handlers).replace(/\n{3,}/g, '\n\n').trim();
  return new Blob([md + '\n'], { type: 'text/markdown' });
}

export function renderPlainText(node: HTMLElement): Blob {
  const handlers: WalkHandlers = {
    text: t => t,
    br: () => '\n',
    element(tag, inner) {
      const s = inner.trim();
      switch (tag) {
        case 'p':  return s ? s + '\n\n' : '';
        case 'h1': case 'h2': case 'h3': return s ? s + '\n\n' : '';
        case 'blockquote': return s ? s + '\n\n' : '';
        default:   return inner;
      }
    },
  };
  const text = walkDom(node, handlers).replace(/\n{3,}/g, '\n\n').trim();
  return new Blob([text + '\n'], { type: 'text/plain' });
}

// Engine already hydrated the payload (runtime.export → buildDataPayload); the
// host just wraps it with the right MIME.
export function renderDataBlob(opts: ExportOptions): Blob {
  return new Blob([opts.dataText ?? ''], { type: opts.dataMime ?? 'text/plain' });
}

export const textAdapter: FormatAdapter = {
  formats: ['md', 'txt', 'json', 'csv', 'ics', 'vcf'],
  render(ctx: RenderContext): Promise<Blob> {
    switch (ctx.format) {
      case 'md':  return Promise.resolve(renderMarkdown(ctx.node));
      case 'txt': return Promise.resolve(renderPlainText(ctx.node));
      default:    return Promise.resolve(renderDataBlob(ctx.opts));
    }
  },
};
