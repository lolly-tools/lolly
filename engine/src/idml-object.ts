// SPDX-License-Identifier: MPL-2.0
/**
 * IDML object styles and item appearance: fill, stroke, corners, opacity and blend, read from
 * the applied object style with the item's own attributes on top, then written onto the node.
 * Effects and text wrap have no Design equivalent and are counted for the import report.
 */
import type { IdmlNode } from './idml-read.ts';
import { itemChildProps, numericAttr, ownProps, tally, type IdmlStats, type StyleBook } from './idml-styles.ts';

const BLEND: Record<string, string> = {
  Multiply: 'multiply', Screen: 'screen', Overlay: 'overlay', SoftLight: 'soft-light', HardLight: 'hard-light',
  ColorDodge: 'color-dodge', ColorBurn: 'color-burn', Darken: 'darken', Lighten: 'lighten', Difference: 'difference',
  Exclusion: 'exclusion', Hue: 'hue', Saturation: 'saturation', Color: 'color', Luminosity: 'luminosity',
};
const CORNERS = ['TopLeft', 'TopRight', 'BottomLeft', 'BottomRight'] as const;

/** The item's appearance bag: style chain, then the item's attributes, then its child elements. */
export function objectAttrs(el: Element, book: StyleBook): Record<string, string> {
  const a: Record<string, string> = { ...book.resolve('object', el.getAttribute('AppliedObjectStyle')), ...ownProps(el, 'object'), ...itemChildProps(el) };
  // Effects sit beside the transparency setting; a mode other than none is an effect Design lacks.
  const t = Array.from(el.children).find(c => c.localName === 'TransparencySetting');
  if (t) for (const e of Array.from(t.children)) {
    if (/^(?:DropShadow|InnerShadow|OuterGlow|InnerGlow|BevelAndEmboss|Satin|BasicFeather|DirectionalFeather|GradientFeather)Setting$/.test(e.localName)
      && (e.getAttribute('Mode') ?? 'None') !== 'None' && e.getAttribute('Applied') !== 'false') a._effect = '1';
  }
  return a;
}

export interface Appearance { fill?: string; textFrame?: boolean }

/**
 * Write fill, stroke, corners, opacity and blend onto a node. `colour` resolves a swatch with
 * its tint. A text frame keeps its fill and stroke on the text node itself.
 */
export function applyAppearance(node: IdmlNode, tag: string, a: Record<string, string>, colour: (ref: string | undefined, tint: number | undefined) => string, stats?: IdmlStats): void {
  const tint = (key: string) => numericAttr(a[key], 0, 100);
  if (a.FillColor !== undefined && tag !== 'GraphicLine') {
    if (a.FillColor.startsWith('Gradient/')) tally(stats, 'object.gradient', 'approximated');
    node.fill = colour(a.FillColor, tint('FillTint'));
    if (node.fill) tally(stats, 'object.fill', 'mapped');
  }
  const weight = numericAttr(a.StrokeWeight, 0, 400) ?? 0, ink = colour(a.StrokeColor, tint('StrokeTint'));
  if (weight > 0 && ink) {
    tally(stats, 'object.stroke', 'mapped');
    if (tag === 'GraphicLine' && node.rot === 0 && (node.h < 1 || node.w < 1)) {
      // A straight rule is its stroke: thicken the flat box and fill it with the ink.
      if (node.h < 1) { node.y -= weight / 2; node.h = weight; } else { node.x -= weight / 2; node.w = weight; }
      node.fill = ink;
    } else {
      if (tag === 'GraphicLine') tally(stats, 'object.line', 'approximated');
      node.stroke = ink; node.strokeW = weight;
      node.strokeAlign = /Inside/i.test(a.StrokeAlignment || '') ? 'inside' : /Outside/i.test(a.StrokeAlignment || '') ? 'outside' : 'center';
      const type = a.StrokeType || '';
      if (/Dashed/i.test(type)) node.strokeDash = 'dashed';
      else if (/Dot/i.test(type)) node.strokeDash = 'dotted';
      else if (type && !/Solid/i.test(type)) tally(stats, 'object.stroke-type', 'approximated');
    }
  }
  if (tag === 'Rectangle' || tag === 'TextFrame') {
    let radius = 0, other = false, plain = 0;
    for (const c of CORNERS) {
      const option = a[`${c}CornerOption`] ?? a.CornerOption ?? 'None';
      if (option === 'None') { plain++; continue; }
      if (option !== 'RoundedCorner') other = true;
      radius = Math.max(radius, numericAttr(a[`${c}CornerRadius`] ?? a.CornerRadius, 0, 2000) ?? 0);
    }
    if (radius > 0) {
      node.radius = radius; tally(stats, 'object.corner', other || plain > 0 ? 'approximated' : 'mapped');
    }
  }
  const opacity = numericAttr(a.Opacity, 0, 100);
  if (opacity !== undefined && opacity < 100) { node.opacity = opacity; tally(stats, 'object.opacity', 'mapped'); }
  const blend = BLEND[a.BlendMode || ''];
  if (blend) { node.blend = blend; tally(stats, 'object.blend', 'mapped'); }
  if (a._effect) tally(stats, 'object.effects', 'dropped');
  if (a.TextWrapMode && a.TextWrapMode !== 'None') tally(stats, 'wrap.text', 'dropped');
  if (tag === 'TextFrame') {
    if (a.VerticalJustification && a.VerticalJustification !== 'TopAlign') tally(stats, 'object.vertical-justify', 'dropped');
    const inset = (a.InsetSpacing || '').split(/\s+/).map(Number);
    if (inset.length === 4 && inset.every(Number.isFinite)) {
      node.pad = Math.max(0, Math.round(inset.reduce((s, v) => s + v, 0) / 4));
      if (new Set(inset).size > 1) tally(stats, 'object.inset', 'approximated');
    }
  }
}
