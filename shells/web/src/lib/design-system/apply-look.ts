// SPDX-License-Identifier: MPL-2.0
/**
 * What applying an example look (Find a look, views/start/looks.ts) writes over the
 * open design system. A saved system is switched to instead, which edits nothing.
 * An example stands for colours and style settings, so those come from the look
 * and the open system keeps everything else:
 *
 *  - its logos, always, as the references it already uses. A catalog mark stays a
 *    catalog mark and an uploaded mark stays the same file: nothing is copied and
 *    nothing is dropped. The asset ids the result points at that came from the
 *    open system (its marks, and any file its rules point at) come back in
 *    `keptRefs`, which the adoption keeps as references (prepareTokenAdoption's
 *    `keepRefs`).
 *  - its fonts, whatever the look carries.
 *  - every other group and extension the look does not define (motion, rules,
 *    emoji, share cards), unchanged. The palette's own order and groups describe
 *    the colours, so they go with the colours.
 *
 * Pure: the caller reads the open system's document (host.tokens.raw(), which is
 * the shipped catalog document while the shipped system is active).
 */
import { TOKEN_EXT } from '@lolly/engine';
import { brandResourceAssetIds } from '../../../../../engine/src/brand-resources.ts';
import { collectAssetTokens } from '../../../../../engine/src/design-version.ts';
import { withLogoGroupFrom } from '../brand-logos.ts';
import { fontGroupOf } from '../../user-fonts.ts';

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const layered = (doc: Rec): boolean => Array.isArray(doc.$themes) && doc.$themes.length > 0;

/** The groups a look stands for. Every look carries colours; nothing else is assumed. */
const LOOK_GROUPS = new Set(['color']);
/** Token extension keys that describe the palette, so they belong to the look's colours. */
const PALETTE_KEYS = new Set(['paletteOrder', 'paletteGroups']);

/** A document's token sets by name: each set of a layered document, or the document itself under ''. */
function setsOf(doc: Rec): Map<string, Rec> {
  if (!layered(doc)) return new Map([['', doc]]);
  return new Map(Object.entries(doc).filter((e): e is [string, Rec] => !e[0].startsWith('$') && isRec(e[1])));
}

/** The name of the set a whole-system group sits in: `base` on a layered document, '' otherwise. */
function leadName(doc: Rec): string {
  if (!layered(doc)) return '';
  return 'base' in doc ? 'base' : Object.keys(doc).find(k => !k.startsWith('$')) ?? 'base';
}

/** The lead set of a document, created when a layered document has none yet. */
function leadSet(doc: Rec): Rec {
  const name = leadName(doc);
  if (!name) return doc;
  if (!isRec(doc[name])) doc[name] = {};
  return doc[name] as Rec;
}

export interface AppliedLook {
  doc: Rec;
  /** Asset ids the document points at that came from the open system, kept as references. */
  keptRefs: string[];
}

export function applyLookDoc(current: unknown, look: Rec): AppliedLook {
  let out = structuredClone(look) as Rec;
  if (!isRec(current)) return { doc: out, keptRefs: [] };

  // Groups the look does not define carry over, into the set of the same name, or
  // into the look's lead set when the group sat in the open system's lead set.
  const lookSets = setsOf(out);
  const defined = new Set<string>();
  for (const set of lookSets.values()) for (const key of Object.keys(set)) if (!key.startsWith('$')) defined.add(key);
  const currentLead = leadName(current);
  for (const [name, set] of setsOf(current)) {
    for (const [key, value] of Object.entries(set)) {
      if (key.startsWith('$') || LOOK_GROUPS.has(key) || key === 'font' || defined.has(key)) continue;
      const into = lookSets.get(name) ?? (name === currentLead ? leadSet(out) : null);
      if (into && !(key in into)) into[key] = structuredClone(value);
    }
  }

  // Logos always stay the open system's: a look never brings or drops a mark.
  out = withLogoGroupFrom(out, current);

  // Fonts: always the open system's.
  for (const set of setsOf(out).values()) delete set.font;
  const fonts = fontGroupOf(current);
  if (fonts) leadSet(out).font = structuredClone(fonts);

  // Extensions the look does not define carry over, apart from the palette's own.
  if (isRec(current.$extensions)) {
    if (!isRec(out.$extensions)) out.$extensions = {};
    const ext = out.$extensions as Rec;
    for (const [vendor, values] of Object.entries(current.$extensions)) {
      if (!isRec(values)) { if (!(vendor in ext)) ext[vendor] = structuredClone(values); continue; }
      if (!isRec(ext[vendor])) ext[vendor] = {};
      const into = ext[vendor] as Rec;
      for (const [key, value] of Object.entries(values)) {
        if (vendor === TOKEN_EXT && PALETTE_KEYS.has(key)) continue;
        if (!(key in into)) into[key] = structuredClone(value);
      }
      if (Object.keys(into).length === 0) delete ext[vendor];
    }
    if (Object.keys(ext).length === 0) delete out.$extensions;
  }

  const named = (doc: Rec): string[] => [...collectAssetTokens(doc).map(ref => ref.id), ...brandResourceAssetIds(doc)];
  const fromCurrent = new Set(named(current));
  const keptRefs = [...new Set(named(out).filter(id => fromCurrent.has(id)))];
  return { doc: out, keptRefs };
}
