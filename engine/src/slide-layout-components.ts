// SPDX-License-Identifier: MPL-2.0
/** Content-sized slide components shared by import and authoring paths. */
import type { ArchetypeV1, FurnitureLayerV1, PlaceholderLayerV1, SlideMasterV1, SlidePlanV1, SlideSourceV1, SourceObjectV1 } from '@lolly-tools/core';
import { compareCodeUnits } from './rebrand-order.ts';

export interface SlideLayoutRecipe { kind: 'cards' | 'columns'; count: number; columns: number }

/** Stable, bounded recipes can travel in an existing layout reference and replay. */
export function slideLayoutRecipe(id: string): SlideLayoutRecipe | undefined {
  const match = /^flow-(cards|columns)-(\d{1,2})-(\d)$/.exec(id);
  if (!match) return;
  const count = Number(match[2]); const columns = Number(match[3]);
  if (count < 2 || count > 12 || columns < 1 || columns > 4 || columns > count || Math.ceil(count / columns) > 4 || String(count) !== match[2]) return;
  return { kind: match[1] as SlideLayoutRecipe['kind'], count, columns };
}

export function slideLayoutName(recipe: SlideLayoutRecipe): string {
  return `${recipe.count} ${recipe.kind === 'cards' ? 'cards' : 'text groups'} · ${recipe.columns} ${recipe.columns === 1 ? 'column' : 'columns'}`;
}

const textOf = (o: SourceObjectV1): string => o.text?.paras.map(p => p.runs.map(r => r.text).join('')).join('\n') ?? '';

/** Keep a heading with the text immediately below it, independent of the target geometry. */
export function slideContentGroups(objects: readonly SourceObjectV1[]): SourceObjectV1[][] {
  const sorted = [...objects].sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x || compareCodeUnits(a.id, b.id));
  const heading = (o: SourceObjectV1): boolean => o.kind === 'text' && textOf(o).trim().length <= 90 && (o.text?.paras.length ?? 0) === 1;
  const groups: SourceObjectV1[][] = [];
  const claimed = new Set<string>();
  for (const object of sorted) {
    if (claimed.has(object.id)) continue;
    const group = [object]; claimed.add(object.id);
    if (heading(object)) {
      let bottom = object.box.y + object.box.h;
      for (const next of sorted) {
        if (claimed.has(next.id) || next.kind !== 'text' || next.box.y < object.box.y) continue;
        const overlap = Math.min(object.box.x + object.box.w, next.box.x + next.box.w) - Math.max(object.box.x, next.box.x);
        if (overlap < Math.min(object.box.w, next.box.w) * .7) continue;
        const gap = next.box.y - bottom;
        if (gap < -object.box.h * .2 || gap > object.box.h * 1.6) continue;
        // A peer heading starts a new card. Bullet paragraphs may be short too.
        const bullet = next.text?.paras.some(p => p.bullet && p.bullet !== 'none');
        if (heading(next) && !bullet && textOf(next).length <= textOf(object).length * 1.5) break;
        group.push(next); claimed.add(next.id); bottom = next.box.y + next.box.h;
      }
    }
    groups.push(group);
  }
  // Use the top of each group to establish rows, then read each row left to right.
  const rows: SourceObjectV1[][][] = [];
  for (const group of groups) {
    const top = group[0]!;
    const row = rows.find(r => Math.abs(r[0]![0]!.box.y - top.box.y) <= Math.min(r[0]![0]!.box.h, top.box.h) * .5);
    if (row) row.push(group); else rows.push([group]);
  }
  return rows.flatMap(row => row.sort((a, b) => a[0]!.box.x - b[0]!.box.x));
}

/** Geometry is generated for the kept content, not rounded up to a template's capacity. */
export function slideLayoutChoices(slide: SlideSourceV1, plan: SlidePlanV1): string[] {
  const kept = new Map(plan.objects.filter(p => (p.decision ?? p.proposal) === 'keep' && !['title', 'subtitle', 'caption', 'footer', 'page-number'].includes(p.role ?? p.class)).map(p => [p.id, p]));
  const content = slide.objects.filter(o => kept.has(o.id) && !['decoration', 'template-furniture', 'recurring-text', 'brand-logo', 'page-number', 'footer'].includes(kept.get(o.id)!.class));
  if (!content.length || content.some(o => o.kind !== 'text')) return [];
  const count = slideContentGroups(content).length;
  if (count < 2 || count > 12) return [];
  const ideal = Math.min(4, Math.ceil(Math.sqrt(count)));
  return [...new Set([ideal, Math.max(1, ideal - 1), Math.min(count, ideal + 1)])]
    .filter(columns => count % columns !== 1 || count <= 4)
    .flatMap(columns => ['cards', 'columns'].map(kind => `flow-${kind}-${count}-${columns}`))
    .filter(id => slideLayoutRecipe(id));
}

/** Expand only the recipes in use. Master tokens, faces, title and footer remain authoritative. */
export function withSlideLayoutComponents(master: SlideMasterV1, ids: readonly string[]): SlideMasterV1 {
  const recipes = [...new Set(ids)].flatMap(id => {
    const recipe = slideLayoutRecipe(id);
    return recipe && !master.archetypes.some(a => a.id === id) ? [{ id, recipe }] : [];
  });
  if (!recipes.length) return master;
  const base = master.archetypes.find(a => a.id === 'content');
  const title = base?.placeholders.find(p => p.role === 'title');
  const body = base?.placeholders.find(p => p.role === 'body');
  if (!base || !title || !body) return master;
  const furniture: FurnitureLayerV1[] = [...master.furniture];
  const archetypes: ArchetypeV1[] = [...master.archetypes];
  for (const { id, recipe } of recipes) {
    const { count, columns, kind } = recipe;
    const rows = Math.ceil(count / columns);
    const gapX = Math.min(.025, body.box.w / columns * .08);
    const gapY = .025;
    const cellW = (body.box.w - gapX * (columns - 1)) / columns;
    const cellH = (body.box.h - gapY * (rows - 1)) / rows;
    const insetX = kind === 'cards' ? .012 : 0;
    const insetY = kind === 'cards' ? .016 : .008;
    const bodySize = Math.round(Math.min(master.typeScale.body, master.typeScale.body * (rows >= 3 ? .70 : columns >= 3 ? .85 : 1)));
    const labelSize = Math.round(bodySize * 1.15);
    const labelH = Math.min(cellH * .33, labelSize * 1.5 / master.size.height);
    const placeholders: PlaceholderLayerV1[] = [{ ...title, box: { ...title.box }, optional: true }];
    const decor: string[] = [];
    for (let k = 0; k < count; k++) {
      const y = body.box.y + Math.floor(k / columns) * (cellH + gapY);
      const lastCount = count - Math.floor(k / columns) * columns;
      const usedCols = Math.min(columns, lastCount);
      const center = (columns - usedCols) * (cellW + gapX) / 2;
      const x = body.box.x + (k % columns) * (cellW + gapX) + center;
      const common = { group: `c${k + 1}`, index: k };
      const textBox = { x: x + insetX, w: cellW - 2 * insetX };
      const ink = body.style ?? {};
      placeholders.push({ ...common, role: 'label', kind: 'text', optional: true, box: { ...textBox, y: y + insetY, h: labelH }, style: { ...ink, fontSize: labelSize, weight: '700', valign: 'top' } });
      placeholders.push({ ...common, role: 'body', kind: 'text', box: { ...textBox, y: y + insetY + labelH + .008, h: cellH - insetY * 2 - labelH - .008 }, style: { ...ink, fontSize: bodySize, weight: '400', valign: 'top' } });
      if (kind === 'cards') {
        const ruleId = `${id}-rule-${k}`;
        furniture.push({ id: ruleId, kind: 'bar', box: { x, y, w: cellW, h: .002 }, tokenPath: ink.fgTokenPath, hex: ink.fg });
        decor.push(ruleId);
      }
    }
    archetypes.push({ id, name: slideLayoutName(recipe), background: base.background, furniture: [...(base.furniture ?? []), ...decor], placeholders, repeat: { count, across: columns, cell: ['label:.25', 'body:.75'] } });
  }
  return { ...master, archetypes, furniture };
}
