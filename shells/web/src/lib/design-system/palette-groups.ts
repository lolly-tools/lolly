// SPDX-License-Identifier: MPL-2.0
/** Empty palette groups are document data, not a side effect of moving a colour. */
import { TOKEN_EXT } from '@lolly/engine';
import { isRec, setSwatchGroup, walkSwatches } from '../brand-doc.ts';

export const groupName = (name: string): string => name.replace(/\s*·.*$/, '').trim().slice(0, 60);

export function paletteGroups(doc: unknown): string[] {
  if (!isRec(doc) || !isRec(doc.$extensions)) return [];
  const vendor = doc.$extensions[TOKEN_EXT];
  if (!isRec(vendor) || !Array.isArray(vendor.paletteGroups)) return [];
  return [...new Set(vendor.paletteGroups.filter((v): v is string => typeof v === 'string').map(groupName).filter(Boolean))];
}

function writeGroups(doc: unknown, names: string[]): boolean {
  if (!isRec(doc)) return false;
  if (!isRec(doc.$extensions)) doc.$extensions = {};
  const ext = doc.$extensions as Record<string, unknown>;
  if (!isRec(ext[TOKEN_EXT])) ext[TOKEN_EXT] = {};
  (ext[TOKEN_EXT] as Record<string, unknown>).paletteGroups = names;
  return true;
}

export function addPaletteGroup(doc: unknown, raw: string): string | null {
  const name = groupName(raw);
  if (!name) return null;
  const groups = paletteGroups(doc);
  const existing = groups.find(g => g.toLocaleLowerCase() === name.toLocaleLowerCase());
  if (existing) return existing;
  return writeGroups(doc, [...groups, name]) ? name : null;
}

/** Rename/ungroup leaves in both themes, retaining their token keys and aliases. */
export function changePaletteGroup(doc: unknown, from: string, to: string | null): boolean {
  const name = to == null ? null : groupName(to);
  if (name === '' || !paletteGroups(doc).includes(from)) return false;
  const target = name ? addPaletteGroup(doc, name) : 'Custom';
  for (const theme of ['light', 'dark']) {
    for (const swatch of walkSwatches(doc, theme)) {
      if (groupName(swatch.group) === from) setSwatchGroup(doc, swatch.path, target);
    }
  }
  return writeGroups(doc, paletteGroups(doc).filter(g => g !== from || g === target));
}

/** Carry display organisation through a shade rebuild, including empty groups. */
export function carryPaletteGroups(from: unknown, to: unknown): void {
  const names = paletteGroups(from);
  for (const name of names) addPaletteGroup(to, name);
  for (const theme of ['light', 'dark']) {
    const targets = new Map(walkSwatches(to, theme).map(s => [s.key, s]));
    for (const swatch of walkSwatches(from, theme)) {
      const name = groupName(swatch.group), target = targets.get(swatch.key);
      if (target && names.includes(name)) setSwatchGroup(to, target.path, name);
    }
  }
}
