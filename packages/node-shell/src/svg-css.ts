// SPDX-License-Identifier: MPL-2.0
/** Resolve inline/inherited SVG variables before native writers lose the wrapper context. */
const PAINT_ATTRIBUTES = [
  'fill',
  'stroke',
  'color',
  'stop-color',
  'flood-color',
  'lighting-color',
  'opacity',
  'fill-opacity',
  'stroke-opacity',
  'stroke-width',
  'font-family',
  'font-size',
];

function inherited(element: Element, name: string): string | undefined {
  for (let current: Element | null = element; current; current = current.parentElement) {
    const style = (current as HTMLElement).style;
    const value = style?.getPropertyValue(name).trim();
    if (value) return value;
  }
  return undefined;
}

/** Balanced parentheses keep nested colour/function fallbacks together. */
function variables(value: string, element: Element, seen: Set<string> = new Set()): string {
  if (seen.size > 32 || !value.includes('var(')) return value;
  let cursor = 0,
    result = '';
  while (cursor < value.length) {
    const at = value.indexOf('var(', cursor);
    if (at < 0) return result + value.slice(cursor);
    result += value.slice(cursor, at);
    let end = at + 4,
      depth = 1,
      quote = '';
    for (; end < value.length; end++) {
      const character = value[end]!;
      if (character === '\\') {
        end++;
        continue;
      }
      if (quote) {
        if (character === quote) quote = '';
        continue;
      }
      if (character === '"' || character === "'") {
        quote = character;
        continue;
      }
      if (character === '(') depth++;
      if (character === ')' && --depth === 0) break;
    }
    if (depth) return result + value.slice(at);
    const body = value.slice(at + 4, end),
      comma = body.indexOf(',');
    const name = (comma < 0 ? body : body.slice(0, comma)).trim();
    const bound = /^--[\w-]+$/.test(name) && !seen.has(name) ? inherited(element, name) : undefined;
    const fallback = comma < 0 ? undefined : body.slice(comma + 1).trim();
    const next = bound ?? fallback;
    result +=
      next === undefined
        ? value.slice(at, end + 1)
        : variables(next, element, new Set([...seen, name]));
    cursor = end + 1;
  }
  return result;
}

/** Does not emulate a stylesheet cascade; the browser still owns layout/CSS-heavy artwork. */
export function materializeSvgVariables(svg: Element): void {
  if (!svg.outerHTML.includes('var(')) return;
  for (const element of [svg, ...svg.querySelectorAll('*')]) {
    for (const attribute of PAINT_ATTRIBUTES) {
      const value = element.getAttribute(attribute);
      if (value?.includes('var(')) element.setAttribute(attribute, variables(value, element));
    }
    const style = (element as SVGElement).style;
    if (!style) continue;
    for (const property of Array.from({ length: style.length }, (_, index) => style.item(index))) {
      if (property.startsWith('--')) continue;
      const value = style.getPropertyValue(property);
      if (value.includes('var('))
        style.setProperty(property, variables(value, element), style.getPropertyPriority(property));
    }
  }
}
