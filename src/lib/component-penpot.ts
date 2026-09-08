// SPDX-License-Identifier: MPL-2.0
/** Native component archives. No DOM dependencies: also exercised by archive tests. */
import { buildPenpotEntries, parsePenpotColor } from '../../../../engine/src/penpot-file.ts';
import type { PenpotBuild, PenpotDoc, PenpotIrShape, PenpotBuildOptions, PenpotComponentSpec } from '../../../../engine/src/penpot-file.ts';
import { createTokenSet } from '../../../../engine/src/tokens.ts';
import { lollyUiTokenDocument } from './lolly-ui-tokens.ts';

type Rec = Record<string, any>;
export const componentSlug = (name: string): string => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'component';

/** A token-linked native component, not just a named collection of paths.
 * Penpot's main-instance and appliedTokens contracts:
 * https://help.penpot.app/technical-guide/developer/data-model/penpot-file-format/
 * Canonical aliases stay intact. Component-specific values live in a separate
 * namespace, so a measured radius never rewrites a global semantic role.
 *
 * The bindings and the component declaration ride the engine's IR
 * (`shape.appliedTokens`, `board.component`), so the ENGINE owns the applied-token
 * validation and the component/main-instance ids - this shell only measures the
 * local token values and declares the roles. (plans/222 D: one writer, no
 * post-processing by layer name.)
 */
export function buildComponentArchive(doc: PenpotDoc, options: PenpotBuildOptions = {}): PenpotBuild {
  const tokens = structuredClone(doc.tokens ?? lollyUiTokenDocument()) as Rec;
  tokens.lolly ??= {};
  tokens.lolly.component ??= {};
  const semantic = createTokenSet(tokens);
  const roles = semantic.query().filter(t => t.path.startsWith('lolly.ui.'));
  const collect = (shape: PenpotIrShape, prefix: string, index: { value: number }): void => {
    const name = `${String(++index.value).padStart(3, '0')} · ${shape.name || shape.type}`;
    shape.name = name;
    const linked: Record<string, string> = {};
    const group: Rec = {};
    const key = `layer-${index.value}`;
    const token = (property: string, type: string, value: unknown): string => {
      const candidates = roles.filter(t => t.type === type && (
        property === 'text' ? t.path.includes('.color.text.') || t.path.endsWith('.on-primary') :
        property === 'fill' ? t.path.includes('.color.surface.') || t.path.endsWith('.action.primary') : true
      ));
      const alias = candidates.find(t => JSON.stringify(t.value) === JSON.stringify(value));
      group[property] = { $type: type, $value: alias ? `{${alias.path}}` : value };
      return `lolly.component.${prefix}.${key}.${property}`;
    };
    const fill = shape.fills?.length === 1 ? shape.fills[0] : null;
    if (fill?.color) {
      const paint = parsePenpotColor(fill.color);
      const alpha = Math.max(0, Math.min(1, (paint?.alpha ?? 1) * (fill.opacity ?? 1)));
      const value = paint ? paint.hex + (alpha < 1 ? Math.round(alpha * 255).toString(16).padStart(2, '0') : '') : fill.color;
      linked.fill = token('fill', 'color', value);
    }
    if (shape.strokes?.length === 1) linked.strokeColor = token('stroke', 'color', shape.strokes[0]!.color);
    if (typeof shape.radius === 'number') {
      const path = token('radius', 'borderRadius', `${Math.min(shape.radius, shape.w / 2, shape.h / 2)}px`);
      for (const corner of ['r1', 'r2', 'r3', 'r4']) linked[corner] = path;
    } else if (Array.isArray(shape.radius)) {
      shape.radius.forEach((radius, i) => { linked[`r${i + 1}`] = token(`radius-${i + 1}`, 'borderRadius', `${Math.min(radius, shape.w / 2, shape.h / 2)}px`); });
    }
    if (shape.type === 'text') {
      const runs = shape.paragraphs.flatMap(p => p.runs);
      const first = runs[0];
      if (first && runs.every(r => r.fontSize === first.fontSize && r.fontFamily === first.fontFamily && r.color === first.color)) {
        linked.fontSize = token('size', 'fontSize', `${first.fontSize || 14}px`);
        linked.fontFamily = token('family', 'fontFamilies', first.fontFamily || 'sans-serif');
        linked.fill = token('text', 'color', first.color || '#000000');
      }
    }
    if (Object.keys(group).length) {
      tokens.lolly.component[prefix] ??= {};
      tokens.lolly.component[prefix][key] = group;
      shape.appliedTokens = linked;
    }
    if ('children' in shape) shape.children.forEach(child => { collect(child, prefix, index); });
  };
  // Clone the authored geometry: building an archive must be repeatable and must
  // not rename or bind the caller's own document.
  const pages = structuredClone(doc.pages);
  pages.forEach((page, i) => {
    page.shapes.forEach(s => { collect(s, `${componentSlug(page.name)}-${i + 1}`, { value: i * 100000 }); });
    // Each top-level board becomes a reusable main component; the engine assigns its id.
    for (const s of page.shapes) {
      if (s.type !== 'board') continue;
      const component: PenpotComponentSpec = { name: String(s.name ?? '').replace(/^\d+ · /, ''), path: 'Lolly / Components' };
      s.component = component;
    }
  });
  return buildPenpotEntries({ ...doc, pages, tokens }, options);
}

/** Plain DTCG document with current semantic colours and dimensions resolved by
 * the caller. References not affected by the runtime theme remain editable aliases. */
export function componentTokenDocument(values: Record<string, string>): Rec {
  const doc = structuredClone(lollyUiTokenDocument()) as Rec;
  for (const [path, value] of Object.entries(values)) {
    let node: Rec = doc;
    for (const key of path.split('.')) node = node?.[key];
    if (!node || !('$value' in node)) continue;
    if (node.$type === 'color') {
      const color = parsePenpotColor(value);
      if (color) node.$value = color.hex + (color.alpha < 1 ? Math.round(color.alpha * 255).toString(16).padStart(2, '0') : '');
    } else if (/^\d+(?:\.\d+)?px$/.test(value) && !String(node.$value).startsWith('{')) node.$value = value;
  }
  return doc;
}
