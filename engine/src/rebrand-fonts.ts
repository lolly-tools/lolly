// SPDX-License-Identifier: MPL-2.0
/**
 * Which face a source deck's typefaces become (plan 274 section 3.3).
 *
 * A corporate deck names two dozen faces and means three: a sans for nearly
 * everything, a serif where someone wanted one, and a mono for code. The
 * alias table below carries the families that turn up in those decks, taken
 * from the plan's own list, and answers first. A family the table does not
 * name goes to `mapFontsToBrand` in `brand-map.ts`, which classifies by its
 * own name table and falls back to the brand face. A theme reference has no
 * family of its own to classify, so it takes the brand face directly.
 *
 * `available` is the design system's own faces, not the device's: a target the
 * design system does not carry falls back to the brand face rather than to the
 * source, because renovate mode never keeps a source typeface.
 *
 * Pure: no DOM, no clock, no filesystem, no network, no randomness.
 */

import type { FontMappingV1, FontUseV1 } from '@lolly-tools/core';

import { mapFontsToBrand } from './brand-map.ts';
import { compareCodeUnits } from './rebrand-order.ts';

/** Identity of these rules, recorded on a plan for replay. */
export const FONT_RULES = { name: 'rebrand-fonts', version: 'fonts-2026-09-24.1' } as const;

/** The three faces a design system names. `serif` is optional; without it a serif source takes the brand face. */
export interface BrandFacesV1 {
  brand: string;
  serif?: string;
  mono?: string;
  /** Families the design system carries. A target outside this list falls back to the brand face. */
  available?: string[];
}

export interface MapFontsInputV1 extends BrandFacesV1 {
  fonts: FontUseV1[];
}

type FaceSlot = 'sans' | 'serif' | 'mono';

/**
 * The substitution table plan 274 section 3.3 names, plus the families the same
 * decks carry alongside them. Keys are normalised family names: lower case,
 * single spaces, first family of a stack only.
 */
export const FONT_ALIASES: Readonly<Record<string, FaceSlot>> = {
  calibri: 'sans',
  'calibri light': 'sans',
  arial: 'sans',
  'arial narrow': 'sans',
  'arial black': 'sans',
  helvetica: 'sans',
  'helvetica neue': 'sans',
  'segoe ui': 'sans',
  'segoe ui light': 'sans',
  aptos: 'sans',
  'aptos display': 'sans',
  verdana: 'sans',
  tahoma: 'sans',
  trebuchet: 'sans',
  'trebuchet ms': 'sans',
  'century gothic': 'sans',
  'gill sans': 'sans',
  'gill sans mt': 'sans',
  'open sans': 'sans',
  roboto: 'sans',
  lato: 'sans',
  'source sans': 'sans',
  'source sans pro': 'sans',
  cambria: 'serif',
  'times new roman': 'serif',
  times: 'serif',
  georgia: 'serif',
  garamond: 'serif',
  'book antiqua': 'serif',
  palatino: 'serif',
  'palatino linotype': 'serif',
  consolas: 'mono',
  'courier new': 'mono',
  courier: 'mono',
  menlo: 'mono',
  monaco: 'mono',
};

/**
 * A family name reduced to the key the alias table is written in. The case fold
 * is the plain one rather than a locale-aware one: locale folding reads the
 * host's ICU data, and two hosts with different ICU versions would then pick
 * different brand faces for one deck.
 */
export function normaliseFamily(family: string): string {
  let name = family.trim();
  const comma = name.indexOf(',');
  if (comma >= 0) name = name.slice(0, comma);
  name = name.trim().replace(/^['"]+|['"]+$/g, '').trim();
  return name.replace(/\s+/g, ' ').toLowerCase();
}

/** The theme slot references a pptx theme states, which name no family of their own. */
const THEME_REFERENCES = new Set(['+mj-lt', '+mj-ea', '+mj-cs', '+mn-lt', '+mn-ea', '+mn-cs']);

function faceFor(slot: FaceSlot, faces: BrandFacesV1): string {
  const wanted = slot === 'serif' ? faces.serif ?? faces.brand : slot === 'mono' ? faces.mono ?? faces.brand : faces.brand;
  if (!faces.available || faces.available.length === 0) return wanted;
  const carried = faces.available.some((family) => normaliseFamily(family) === normaliseFamily(wanted));
  return carried ? wanted : faces.brand;
}

/**
 * One mapping per distinct source family, sorted by the source name.
 *
 * `source` records how the target was reached: `alias` from the table above,
 * `class` from the family class table in `brand-map.ts` or from a theme
 * reference that names no family. `user` is reserved for a person's own choice
 * and is never written here.
 */
export function mapFonts(input: MapFontsInputV1): FontMappingV1[] {
  const faces: BrandFacesV1 = { brand: input.brand };
  if (input.serif !== undefined) faces.serif = input.serif;
  if (input.mono !== undefined) faces.mono = input.mono;
  if (input.available !== undefined) faces.available = input.available;

  const seen = new Set<string>();
  const rest: string[] = [];
  const out: FontMappingV1[] = [];

  for (const use of input.fonts) {
    const from = use.family;
    if (typeof from !== 'string' || from.length === 0 || seen.has(from)) continue;
    seen.add(from);
    const key = normaliseFamily(from);

    const alias = FONT_ALIASES[key];
    if (alias) {
      out.push({ from, to: faceFor(alias, faces), source: 'alias' });
      continue;
    }
    if (use.provenance === 'theme' || THEME_REFERENCES.has(key)) {
      out.push({ from, to: faceFor('sans', faces), source: 'class' });
      continue;
    }
    rest.push(from);
  }

  // Everything the table did not name goes through the engine's own family
  // class table, which answers the brand face for a family it does not know.
  const classed = mapFontsToBrand(rest, {
    brand: faces.brand,
    ...(faces.serif === undefined ? {} : { serif: faces.serif }),
    ...(faces.mono === undefined ? {} : { mono: faces.mono }),
  });
  for (const from of rest) {
    const target = classed.get(from) ?? faces.brand;
    const carried = !faces.available || faces.available.length === 0
      || faces.available.some((family) => normaliseFamily(family) === normaliseFamily(target));
    out.push({ from, to: carried ? target : faces.brand, source: 'class' });
  }

  return out.sort((a, b) => compareCodeUnits(a.from, b.from));
}
