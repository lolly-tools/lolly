// SPDX-License-Identifier: MPL-2.0
/**
 * Fallback font slots in a tool's own font stacks, on the live canvas.
 *
 * The live page draws a script the design system's fonts lack in the same fallback font
 * the export outlines it with (docs/fallback-fonts.md). For text set in the design
 * system's font variables, bridge/page-fallback-fonts.ts adds the fallback families to
 * those variables. A tool that sets its own fonts instead, such as
 * `font-family: "SUSE", system-ui, sans-serif`, never reads those variables, so its page
 * fell back to a system font while its export used the fallback font.
 *
 * Here each such `font-family` in the canvas's tool stylesheets gets a slot after the
 * fonts it names and before the generic and system ones: `"SUSE" var(--slot,),
 * system-ui, sans-serif`. page-fallback-fonts.ts sets the slot's property on the canvas
 * to the families it needs, each after a comma. Unset, the slot is empty and every
 * computed `font-family` is the same string as before, in Chromium and WebKit.
 *
 * The slots go into the CSSOM only. A `<style>` element's text stays as the tool wrote
 * it, so every export that copies that text (HTML, the player, an SVG's own styles)
 * writes the same bytes as before.
 */

/** The custom property the live page sets to the fallback families its text needs. */
export const FALLBACK_SLOT_PROPERTY = '--lolly-fallback-families';
const SLOT = ` var(${FALLBACK_SLOT_PROPERTY},)`;

/** Family keywords a browser maps to a font of its own choosing. */
const GENERIC_FAMILY = /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|math|emoji|fangsong|ui-serif|ui-sans-serif|ui-monospace|ui-rounded)$/i;

/**
 * Fonts that come with an operating system. An export never draws with one, because it
 * outlines only fonts it holds a file for, so on the page a fallback font goes before
 * these as it goes before the generic families.
 */
const SYSTEM_FAMILY = new Set([
  '-apple-system', 'blinkmacsystemfont', 'segoe ui', 'roboto', 'helvetica neue', 'helvetica', 'arial',
  'sfmono-regular', 'sf mono', 'menlo', 'monaco', 'consolas', 'courier new', 'courier', 'liberation mono',
  'dejavu sans mono', 'ubuntu', 'cantarell', 'oxygen', 'fira sans', 'droid sans', 'times new roman', 'times', 'georgia',
]);

/** Split a family list on its top-level commas, keeping each part's own spacing. */
function splitFamilies(value: string): string[] {
  const parts: string[] = [];
  let start = 0;
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (c === '"' || c === "'") {
      const end = value.indexOf(c, i + 1);
      i = end === -1 ? value.length : end;
      continue;
    }
    if (c === ',') { parts.push(value.slice(start, i)); start = i + 1; }
  }
  parts.push(value.slice(start));
  return parts;
}

/**
 * A `font-family` value with the slot after its leading named families. Unchanged when
 * the value starts with a system or generic family rather than a font of its own, uses a variable
 * (the design system's font variables get the families directly) or is a keyword.
 */
export function slotFamilies(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes('var(') || /^(inherit|initial|unset|revert|revert-layer)$/i.test(trimmed)) return value;
  const parts = splitFamilies(value);
  let named = 0;
  for (const part of parts) {
    const name = part.trim().replace(/^(["'])(.*)\1$/, '$2').trim();
    if (!name || GENERIC_FAMILY.test(name) || SYSTEM_FAMILY.has(name.toLowerCase())) break;
    named++;
  }
  if (!named) return value;
  const last = parts[named - 1]!;
  const end = last.trimEnd().length;
  parts[named - 1] = `${last.slice(0, end)}${SLOT}${last.slice(end)}`;
  return parts.join(',');
}

/** A rule whose declarations apply to elements: a style rule, or nested declarations. */
function declaresStyle(rule: CSSRule): rule is CSSRule & { style: CSSStyleDeclaration } {
  return 'style' in rule && ('selectorText' in rule || rule.constructor?.name === 'CSSNestedDeclarations');
}

/**
 * Put a slot in each `font-family` of the style rules in `sheet`, nested and grouped rules
 * included, and return how many. An `@font-face` family is one face, so it is left alone.
 * Safe to call again: a value that already holds a slot holds a variable.
 */
export function addFallbackSlots(sheet: CSSStyleSheet | null | undefined): number {
  let added = 0;
  const walk = (rules: CSSRuleList | undefined): void => {
    if (!rules) return;
    for (const rule of rules) {
      if (declaresStyle(rule)) {
        const value = rule.style.getPropertyValue('font-family');
        const slotted = value ? slotFamilies(value) : value;
        if (slotted !== value) {
          rule.style.setProperty('font-family', slotted, rule.style.getPropertyPriority('font-family'));
          added++;
        }
      }
      // Grouping rules (@media, @supports, @layer, @container) and nested style rules.
      if ('cssRules' in rule && !(typeof CSSKeyframesRule !== 'undefined' && rule instanceof CSSKeyframesRule)) walk((rule as CSSGroupingRule).cssRules);
    }
  };
  try { walk(sheet?.cssRules); } catch { /* a sheet the page cannot read keeps its rules */ }
  return added;
}

/** A string as a CSS attribute selector value, in double quotes. */
const attrValue = (value: string): string => `"${value.replace(/["\\]/g, '\\$&').replace(/\n/g, '\\a ')}"`;

/**
 * Rules that give the slot to the font stacks a tool writes on its elements rather than
 * in a stylesheet: an inline `style` (a hook's `font-family:'SUSE', system-ui`) and an
 * SVG `font-family` attribute. Each rule matches the stack's own text and gives it back
 * with the slot after its named fonts (slotFamilies), so nothing else about the
 * element changes. The elements and their attributes stay as written, so exports that
 * copy them write the same bytes. An inline stack needs `!important` to win over the
 * inline declaration it repeats. Every rule has no specificity, so any rule a tool wrote
 * for the same element still wins as before.
 */
export function slotRulesFor(root: ParentNode, scope: string): string[] {
  const rules = new Set<string>();
  for (const el of root.querySelectorAll('[style*="font-family"], [font-family]')) {
    const attr = el.getAttribute('font-family');
    if (attr) {
      const slotted = slotFamilies(attr);
      if (slotted !== attr) rules.add(`:where(${scope} [font-family=${attrValue(attr)}]) { font-family: ${slotted}; }`);
    }
    const inline = el.getAttribute('style') ?? '';
    for (const m of inline.matchAll(/font-family\s*:\s*([^;]*)/gi)) {
      const value = m[1]!.replace(/\s*!\s*important\s*$/i, '').trim();
      if (!value || /!\s*important/i.test(m[1]!)) continue;
      const slotted = slotFamilies(value);
      if (slotted === value) continue;
      // The declaration as written, ended by a semicolon or by the attribute's end.
      const decl = m[0]!.trimEnd();
      rules.add(`:where(${scope} [style*=${attrValue(`${decl};`)}], ${scope} [style$=${attrValue(decl)}]) { font-family: ${slotted} !important; }`);
    }
  }
  return [...rules];
}
