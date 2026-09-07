// SPDX-License-Identifier: MPL-2.0
/** Adding a draft is append-only: existing swatches, roles and other tokens survive. */
import { colorToHex, createTokenSet } from '@lolly/engine';
import { addSwatch, walkSwatches } from '../brand-doc.ts';
import { addPaletteGroup } from './palette-groups.ts';

export interface DraftShade { key: string; hex: string; step: number }

export function draftShades(draft: unknown, ramp: string): DraftShade[] {
  if (!['primary', 'secondary', 'neutral'].includes(ramp)) return [];
  const set = createTokenSet(draft, { theme: 'light' });
  return set.query({ type: 'color' }).flatMap(token => {
    const match = new RegExp(`^color\\.ramp\\.${ramp}\\.(\\d+)$`).exec(token.path);
    const hex = match ? colorToHex(set.resolve(token.path)) : null;
    return hex && match ? [{ key: token.path, hex, step: Number(match[1]) }] : [];
  }).sort((a, b) => a.step - b.step);
}

export function addDraftShades(doc: unknown, shades: DraftShade[], group: string): number {
  const present = new Set(walkSwatches(doc, 'light').filter(s => s.kind !== 'semantic').map(s => s.hex?.toLowerCase()));
  let added = 0;
  for (const shade of shades) {
    if (present.has(shade.hex.toLowerCase())) continue;
    const path = addSwatch(doc, 'custom', `${group} ${shade.step}`, shade.hex, { displayGroup: group });
    if (path) { present.add(shade.hex.toLowerCase()); added++; }
  }
  if (added) addPaletteGroup(doc, group);
  return added;
}
