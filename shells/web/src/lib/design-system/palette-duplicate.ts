// SPDX-License-Identifier: MPL-2.0
/**
 * palette-duplicate.ts - the Colours room's Duplicate, on the selection bar.
 *
 * A copy is a colour of its own: a token holding the source's value as a
 * literal, never an alias of the source. Moving the copy a shade lighter or
 * giving it more chroma leaves the source as it was, and a later change to the
 * source leaves the copy alone. The copy is written beside its source, in the
 * same token group, so it shows under the same heading and right after it: a
 * person can step a colour along without hunting for where the new one went.
 * A ramp step is the exception. A ramp is derived, so its copy is a custom
 * swatch filed under the ramp's heading. The copy takes the value, the name
 * and the heading and nothing else: a print lock pinned to the source's colour
 * would be wrong for a copy that is about to change. DOM-free: the editor's bar
 * (brand-editor/pal-select.ts) calls it inside one undoable write.
 */
import { TOKEN_EXT } from '@lolly/engine';
import { addSwatch, isRec, leafAt, walkSwatches, type BrandSwatch } from '../brand-doc.ts';
import { t, tRaw } from '../../i18n.ts';
import { groupName } from './palette-groups.ts';
import { paletteOrder, writePaletteOrder } from './palette-order.ts';

/** The name a copy takes: "Bunyapine copy", then "Bunyapine copy 2", and so on
 *  past every name already in use (compared without case). */
export function copyName(name: string, taken: ReadonlySet<string>): string {
  const base = name.trim() || t('Colour');
  const first = tRaw('{name} copy', { name: base });
  if (!taken.has(first.toLowerCase())) return first;
  for (let n = 2; ; n++) {
    const next = tRaw('{name} copy {n}', { name: base, n });
    if (!taken.has(next.toLowerCase())) return next;
  }
}

/** Write a copy next to the leaf at `path`, under a slug no sibling uses, with
 *  the source's heading tag when it has one. Null when the source is gone. */
function addSibling(doc: unknown, path: string[], name: string, value: string): string[] | null {
  const parent = leafAt(doc, path.slice(0, -1));
  const source = leafAt(doc, path);
  if (!parent || !source) return null;
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'colour';
  let slug = base;
  for (let i = 2; slug in parent; i++) slug = `${base}-${i}`;
  const vendor = isRec(source.$extensions) ? source.$extensions[TOKEN_EXT] : null;
  const tag = isRec(vendor) && typeof vendor.group === 'string' ? vendor.group : '';
  parent[slug] = {
    $type: 'color', $value: value, $description: name,
    ...(tag ? { $extensions: { [TOKEN_EXT]: { group: tag } } } : {}),
  };
  return [...path.slice(0, -1), slug];
}

export interface DuplicateResult {
  /** The copies' JSON paths, in the order of the sources they came from. */
  paths: string[][];
  /** Their token keys, in the same order. */
  keys: string[];
}

/**
 * Copy each swatch in `items` into the document. `shown` is the palette's
 * current display order (token keys); the copies are written into the stored
 * palette order right after their sources, so the grid keeps every other tile
 * where it was. A role's own alias tile and a colour with no value to copy are
 * skipped.
 */
export function duplicateSwatches(
  doc: unknown, items: readonly BrandSwatch[],
  opts: { ctx?: Parameters<typeof walkSwatches>[1]; shown?: readonly string[] } = {},
): DuplicateResult {
  const ctx = opts.ctx ?? 'light';
  const taken = new Set(walkSwatches(doc, ctx).map(s => s.name.toLowerCase()));
  const made: Array<{ source: string; path: string[] }> = [];
  for (const s of items) {
    if (s.kind === 'semantic') continue;
    // The stored notation when the source holds a literal; the colour an alias
    // resolves to otherwise, so the copy never follows the source.
    const value = s.isAlias ? s.hex : s.raw;
    if (!value) continue;
    const name = copyName(s.name, taken);
    taken.add(name.toLowerCase());
    const path = s.kind === 'ramp'
      ? addSwatch(doc, 'custom', name, value, { displayGroup: groupName(s.group) })
      : addSibling(doc, s.path, name, value);
    if (path) made.push({ source: s.key, path });
  }
  if (!made.length) return { paths: [], keys: [] };
  const same = (a: string[], b: string[]): boolean => a.length === b.length && a.every((seg, i) => seg === b[i]);
  const walked = walkSwatches(doc, ctx);
  const keyOf = (path: string[]): string => walked.find(s => same(s.path, path))?.key ?? '';
  const shown = [...(opts.shown ?? [])];
  const order = [...shown, ...paletteOrder(doc).filter(key => !shown.includes(key))];
  const keys: string[] = [];
  for (const { source, path } of made) {
    const key = keyOf(path);
    keys.push(key);
    if (!key) continue;
    const at = order.indexOf(source);
    if (at >= 0) order.splice(at + 1, 0, key);
    else order.push(key);
  }
  writePaletteOrder(doc, order);
  return { paths: made.map(m => m.path), keys };
}
