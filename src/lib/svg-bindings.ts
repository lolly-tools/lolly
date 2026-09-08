// SPDX-License-Identifier: MPL-2.0
/**
 * Applied-token capture for a native-SVG tool export (plans/222). A tool that paints
 * an SVG shape `fill="var(--brand-primary)"` (or a `{alias}`) is inheriting a brand
 * token; this stamps that source onto the element as the shared
 * `data-lolly-bind="fill:color.semantic.primary"` attribute the engine's
 * svgToPenpotDoc reads - BEFORE the export bakes the paint down to a hex, which is
 * where the source would otherwise be lost. Brand-agnostic: the caller supplies the
 * `resolve` map (bridge/export-penpot.ts), so this module stays DOM-only and
 * node-testable. The engine writer re-validates every path it produces.
 */

/** The inline source of a paint property on an SVG element - its `style` declaration
 *  first, then the presentation attribute - so a `var(--brand-*)` survives to be
 *  captured before it is baked. `''` when neither is set. */
export function svgInlinePaint(el: Element, prop: 'fill' | 'stroke'): string {
  const style = el.getAttribute?.('style');
  if (style) {
    for (const decl of style.split(';')) {
      const i = decl.indexOf(':');
      if (i >= 0 && decl.slice(0, i).trim().toLowerCase() === prop) return decl.slice(i + 1).trim();
    }
  }
  return el.getAttribute?.(prop) ?? '';
}

/**
 * Stamp `data-lolly-bind` on every element (and the root) whose inline fill/stroke
 * names a brand token, per `resolve`. Idempotent-ish: an existing binding is
 * appended to, not replaced. Mutates `root` in place - call it on the export CLONE.
 */
export function stampSvgBindings(root: Element, resolve: (css: string) => string | null): void {
  const els: Element[] = [root, ...Array.from(root.querySelectorAll('*'))];
  for (const el of els) {
    const binds: string[] = [];
    const fillPath = resolve(svgInlinePaint(el, 'fill'));
    if (fillPath) binds.push(`fill:${fillPath}`);
    const strokePath = resolve(svgInlinePaint(el, 'stroke'));
    if (strokePath) binds.push(`strokeColor:${strokePath}`);
    if (binds.length) {
      const prior = el.getAttribute('data-lolly-bind');
      el.setAttribute('data-lolly-bind', prior ? `${prior};${binds.join(';')}` : binds.join(';'));
    }
  }
}
