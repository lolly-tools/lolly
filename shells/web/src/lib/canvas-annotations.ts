// SPDX-License-Identifier: MPL-2.0
/**
 * The click-to-edit markers on a rendered canvas: `annotateTemplate` (engine/src/template.ts)
 * leaves `<!-- ci:<id> -->` comment pairs around every input reference, and this turns
 * them into `data-canvas-input` attributes the sidebar and collab focus read.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';
/** The SVG elements whose character data is drawn: text placed anywhere else is not. */
const SVG_TEXT = new Set(['text', 'tspan', 'textPath']);

/**
 * Walk the canvas DOM for the comment markers, convert them into data-canvas-input
 * attributes, then remove the comments. Block-element outputs (e.g. `<p>` from
 * `{{markdown}}`) are marked directly. Plain text gets a wrapper so it is clickable:
 * a transparent `<span>` in HTML, a `<tspan>` inside SVG text.
 *
 * The SVG case matters for what is drawn, not only for clicks. An HTML `<span>` inside
 * an SVG `<text>` is not part of the drawing, so its words vanish from the preview and
 * from every export: Contrast Check's 17 px sample line (`{{sample}}`, an input) was
 * missing from the browser's PNG while the two lines drawn from hook values were there.
 * Text directly inside any other SVG element is never drawn, so it is left unwrapped.
 */
export function resolveCanvasAnnotations(canvasEl: HTMLElement, fixed?: (id: string) => boolean): void {
  const doc = canvasEl.ownerDocument;
  const comments: Comment[] = [];
  const walker = doc.createTreeWalker(canvasEl, 128 /* NodeFilter.SHOW_COMMENT */);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) comments.push(node as Comment);

  for (const comment of comments) {
    const parent = comment.parentNode;
    if (!parent) continue;
    const text = (comment.nodeValue ?? '').trim();
    const m = text.match(/^ci:(.+)$/);
    if (!m) continue;
    const id = m[1]!;

    // Collect siblings until the matching closing comment.
    const between: Node[] = [];
    let closing: ChildNode | null = null;
    let cur: ChildNode | null = comment.nextSibling;
    while (cur) {
      if (cur.nodeType === 8 /* COMMENT_NODE */ && (cur.nodeValue ?? '').trim() === `/ci:${id}`) {
        closing = cur;
        break;
      }
      between.push(cur);
      cur = cur.nextSibling;
    }

    const elements = between.filter((n) => n.nodeType === 1 /* ELEMENT_NODE */) as Element[];
    const isFixed = fixed?.(id) ?? false;
    const mark = (el: Element): void => {
      el.setAttribute('data-canvas-input', id);
      if (isFixed) el.setAttribute('data-canvas-fixed', '');
    };
    if (elements.length > 0) {
      for (const el of elements) mark(el);
    } else {
      const inSvg = (parent as Element).namespaceURI === SVG_NS;
      const wrapper = !inSvg ? doc.createElement('span')
        : SVG_TEXT.has((parent as Element).localName) ? doc.createElementNS(SVG_NS, 'tspan') : null;
      if (wrapper) {
        mark(wrapper);
        parent.insertBefore(wrapper, comment);
        for (const n of between) wrapper.appendChild(n);
      }
    }

    comment.remove();
    closing?.remove();
  }
}
