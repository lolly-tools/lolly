// SPDX-License-Identifier: MPL-2.0
/** Content-sized slide components shared by import and authoring paths. */
import type { ArchetypeV1, FurnitureLayerV1, PlaceholderLayerV1, SlideMasterV1, SlidePlanV1, SlideSourceV1, SourceObjectV1 } from '@lolly-tools/core';
import { compareCodeUnits } from './rebrand-order.ts';
import { slideGridCells } from './slide-composition.ts';

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

/**
 * The weight the master sets a label in, read from its own label placeholders, so
 * a component label matches the master (SUSE sets labels in Medium 500). A master
 * with no weighted label gives 700.
 */
function masterLabelWeight(master: SlideMasterV1): string {
  for (const a of master.archetypes) {
    const label = a.placeholders.find(p => p.role === 'label' && p.style?.weight);
    if (label?.style?.weight) return label.style.weight;
  }
  return '700';
}

/** The light layout id of a content-sized layout's dark twin (`flow-cards-4-2-dark` to `flow-cards-4-2`), else undefined. */
function slideLayoutDarkBase(id: string): string | undefined {
  if (!id.endsWith('-dark')) return undefined;
  const base = id.slice(0, -'-dark'.length);
  return slideLayoutRecipe(base) ? base : undefined;
}

/**
 * Expand only the recipes in use. Master tokens, faces, title and footer remain authoritative.
 *
 * A `-dark` id (`flow-cards-4-2-dark`) asks for that layout's dark twin as well: the same
 * geometry on the master's `content-dark` ground, with its inks and furniture, bound to
 * the light layout through `variants.dark` and `variantOf`. A master with no dark content
 * archetype (with a title and a body) has no twin to give. Only an id that asks for a twin
 * gets one, so a plan that names light layouts expands exactly as before.
 */
export function withSlideLayoutComponents(master: SlideMasterV1, ids: readonly string[]): SlideMasterV1 {
  const unique = [...new Set(ids)];
  const darkOf = new Set(unique.map(slideLayoutDarkBase).filter((id): id is string => id !== undefined));
  const recipes = [...new Set(unique.map(id => slideLayoutDarkBase(id) ?? id))].flatMap(id => {
    const recipe = slideLayoutRecipe(id);
    return recipe && !master.archetypes.some(a => a.id === id) ? [{ id, recipe }] : [];
  });
  if (!recipes.length) return master;
  const base = master.archetypes.find(a => a.id === 'content');
  const title = base?.placeholders.find(p => p.role === 'title');
  const body = base?.placeholders.find(p => p.role === 'body');
  if (!base || !title || !body) return master;
  const darkBase = master.archetypes.find(a => a.id === (base.variants?.dark ?? 'content-dark'));
  const darkTitle = darkBase?.placeholders.find(p => p.role === 'title');
  const darkBody = darkBase?.placeholders.find(p => p.role === 'body');
  const furniture: FurnitureLayerV1[] = [...master.furniture];
  const archetypes: ArchetypeV1[] = [...master.archetypes];
  const labelWeight = masterLabelWeight(master);
  for (const { id, recipe } of recipes) {
    const light = flowArchetype(id, recipe, { base, title, body }, master, labelWeight, furniture);
    archetypes.push(light);
    const darkId = `${id}-dark`;
    if (!darkOf.has(id) || !darkBase || !darkTitle || !darkBody || master.archetypes.some(a => a.id === darkId)) continue;
    const dark = flowArchetype(darkId, recipe, { base: darkBase, title: darkTitle, body: darkBody }, master, labelWeight, furniture);
    light.variants = { dark: darkId };
    archetypes.push({ ...dark, name: `${dark.name}, dark`, variantOf: id });
  }
  return { ...master, archetypes, furniture };
}

/** One content-sized layout on `on.base`'s ground, furniture and inks. A cards layout adds its rules to `furniture`. */
function flowArchetype(
  id: string,
  recipe: SlideLayoutRecipe,
  on: { base: ArchetypeV1; title: PlaceholderLayerV1; body: PlaceholderLayerV1 },
  master: SlideMasterV1,
  labelWeight: string,
  furniture: FurnitureLayerV1[],
): ArchetypeV1 {
  const { base, title, body } = on;
  const { count, columns, kind } = recipe;
  const rows = Math.ceil(count / columns);
  const cells = slideGridCells(count, columns, body.box);
  const { w: cellW, h: cellH } = cells[0]!;
  const insetX = kind === 'cards' ? .012 : 0;
  const insetY = kind === 'cards' ? .016 : .008;
  const bodySize = Math.round(Math.min(master.typeScale.body, master.typeScale.body * (rows >= 3 ? .70 : columns >= 3 ? .85 : 1)));
  const labelSize = Math.round(bodySize * 1.15);
  const labelH = Math.min(cellH * .33, labelSize * 1.5 / master.size.height);
  const placeholders: PlaceholderLayerV1[] = [{ ...title, box: { ...title.box }, optional: true }];
  const decor: string[] = [];
  for (let k = 0; k < count; k++) {
    const { x, y } = cells[k]!;
    const common = { group: `c${k + 1}`, index: k };
    const textBox = { x: x + insetX, w: cellW - 2 * insetX };
    const ink = body.style ?? {};
    placeholders.push({ ...common, role: 'label', kind: 'text', optional: true, box: { ...textBox, y: y + insetY, h: labelH }, style: { ...ink, fontSize: labelSize, weight: labelWeight, valign: 'top' } });
    placeholders.push({ ...common, role: 'body', kind: 'text', box: { ...textBox, y: y + insetY + labelH + .008, h: cellH - insetY * 2 - labelH - .008 }, style: { ...ink, fontSize: bodySize, weight: '400', valign: 'top' } });
    if (kind === 'cards') {
      const ruleId = `${id}-rule-${k}`;
      furniture.push({ id: ruleId, kind: 'bar', box: { x, y, w: cellW, h: .002 }, tokenPath: ink.fgTokenPath, hex: ink.fg });
      decor.push(ruleId);
    }
  }
  return { id, name: slideLayoutName(recipe), background: base.background, furniture: [...(base.furniture ?? []), ...decor], placeholders, repeat: { count, across: columns, cell: ['label:.25', 'body:.75'] } };
}
