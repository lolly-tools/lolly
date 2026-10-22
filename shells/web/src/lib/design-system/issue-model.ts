// SPDX-License-Identifier: MPL-2.0
/**
 * The Settings Design system tab, read as a magazine issue about the active
 * design system: what its author wrote about it, its two looks, its colours,
 * its four type roles, its logo files and its colourways. This module only
 * reads; views/dashboard/brand.ts renders the model.
 *
 * Pure and DOM-free. The doc is untrusted: text comes back as plain text for
 * the renderer to escape, and every colour is a `#rrggbb` from preview.ts.
 */
import { createTokenSet } from '@lolly/engine';
import type { PaletteEntry } from '../../palette.ts';
import { groupPalette, isLockedInk, splitPalette, type PaletteRamp } from '../swatches.ts';
import { logoTokensOf, LOGO_DEFAULT_IDENTITY } from '../brand-logos.ts';
import { tokenValueToHex } from '../../brand-vars.ts';
import { leadModes, listLeads, type Lead } from './leads.ts';
import { coreColoursOf, fontRolesOf, looksOf, type CoverLook, type CoverLooks, type FontRoleRead } from './preview.ts';

export interface IssueInput {
  doc: unknown;
  /** The active palette (live-palette.ts), the list every colour count reads. */
  palette: readonly PaletteEntry[];
  label: string;
  /** The source line (source-line.ts). */
  source: string;
  locked: boolean;
}

/** One of a look's four lead colours. */
export interface LookSlot {
  role: 'surface' | 'text' | 'primary' | 'secondary';
  hex: string;
  /** The first named colour with the same value, or ''. */
  name: string;
  /** The mode's own description of the slot, or ''. */
  note: string;
}

export interface IssueLogo {
  id: string;
  /** The slots that draw this file on this ground, as labels. */
  variants: string[];
  /** What the file is drawn on: the light surface, the dark surface or the primary. */
  ground: 'surface-light' | 'surface-dark' | 'primary';
}

export interface IssueModel {
  name: string;
  source: string;
  locked: boolean;
  standfirst: { lead: string; rest: string };
  looks: CoverLooks;
  leads: Array<{ mode: 'light' | 'dark'; slots: LookSlot[] }>;
  colours: {
    core: PaletteEntry[];
    named: PaletteEntry[];
    ramps: PaletteRamp[];
    spectrum: PaletteEntry[];
    roles: PaletteEntry[];
    lockedInks: number;
  };
  fonts: FontRoleRead[];
  logos: IssueLogo[];
  colourways: Lead[];
  facts: { colours: number; typefaces: number; logos: number; colourways: number; modes: string[] };
  primaryHex: string;
}

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);

/** The longest standfirst kept, and the longest lead shown before the fold. */
const STANDFIRST_MAX = 2000;
const LEAD_MAX = 320;
/** A sentence ends at . ! or ? followed by space and a capital, a digit, a quote or a bracket. */
const SENTENCE_BREAK = /(?<=[.!?])\s+(?=[\p{Lu}\d"'‘“(])/u;
/** Control characters and the bidirectional overrides, which could reorder what a reader sees. */
const UNSAFE_CHARS = /[\p{Cc}\u202a-\u202e\u2066-\u2069]/gu;
/** The role layers, in the order the Colour roles fold lists them. */
const ROLE_LAYERS = ['semantic', 'role', 'chrome', 'colourway'] as const;

/** Cut `text` at the last space at or before `max` characters. */
function cutAtWord(text: string, max: number): number {
  if (text.length <= max) return text.length;
  const space = text.lastIndexOf(' ', max);
  return space > max / 2 ? space : max;
}

/**
 * The doc's own `$description`, as a standfirst: control characters removed,
 * white space collapsed and clamped to 2000 characters. `lead` is the first two
 * sentences when they fit in 320 characters (else the first, cut at a word);
 * `rest` is everything after it, for the fold.
 */
export function standfirstOf(doc: unknown): { lead: string; rest: string } {
  const raw = isRec(doc) && typeof doc.$description === 'string' ? doc.$description : '';
  let text = raw.replace(UNSAFE_CHARS, ' ').replace(/\s+/g, ' ').trim();
  if (text.length > STANDFIRST_MAX) text = `${text.slice(0, cutAtWord(text, STANDFIRST_MAX)).trimEnd()}…`;
  if (!text) return { lead: '', rest: '' };
  const sentences = text.split(SENTENCE_BREAK);
  let lead = sentences[0]!;
  let used = 1;
  if (sentences.length > 1 && lead.length + 1 + sentences[1]!.length <= LEAD_MAX) { lead = `${lead} ${sentences[1]}`; used = 2; }
  let rest = sentences.slice(used).join(' ');
  if (lead.length > LEAD_MAX) {
    const cut = cutAtWord(lead, LEAD_MAX);
    rest = [lead.slice(cut).trim(), rest].filter(Boolean).join(' ');
    lead = `${lead.slice(0, cut).trimEnd()}…`;
  }
  return { lead, rest };
}

const hexOf = (value: unknown): string => tokenValueToHex(value)?.toLowerCase() ?? '';

/** "horizontal-primary-reverse" as "Horizontal primary reverse". */
function prettySlug(slug: string): string {
  const words = slug.replace(/-+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The ground a logo slot is made for: reverse forms on the dark surface, on-brand forms on the primary. */
function groundOf(variant: string): IssueLogo['ground'] {
  if (/(^|-)reverse$/.test(variant)) return 'surface-dark';
  if (/(^|-)on-brand$/.test(variant)) return 'primary';
  return 'surface-light';
}

const orientationRank = (variant: string): number => (variant.startsWith('horizontal') ? 0 : variant.startsWith('vertical') ? 1 : 2);

/** Each logo file once per ground it is drawn on, horizontal forms first. */
function logosOf(doc: unknown): IssueLogo[] {
  const byKey = new Map<string, IssueLogo & { rank: number; order: number }>();
  for (const slot of logoTokensOf(doc)) {
    const ground = groundOf(slot.variant);
    const key = `${slot.id}\n${ground}`;
    const label = prettySlug(slot.identity === LOGO_DEFAULT_IDENTITY ? slot.variant : `${slot.identity}-${slot.variant}`);
    const found = byKey.get(key);
    if (found) { if (!found.variants.includes(label)) found.variants.push(label); continue; }
    byKey.set(key, { id: slot.id, variants: [label], ground, rank: orientationRank(slot.variant), order: byKey.size });
  }
  return [...byKey.values()]
    .sort((a, b) => a.rank - b.rank || a.order - b.order)
    .map(({ id, variants, ground }) => ({ id, variants, ground }));
}

/** The four lead colours of one look, each with the colour's name and the mode's note. */
function leadSlots(doc: unknown, look: CoverLook, theme: string | undefined, core: readonly PaletteEntry[]): LookSlot[] {
  const notes = new Map<string, string>();
  for (const swatch of createTokenSet(doc, theme ? { theme } : {}).colors()) {
    if (typeof swatch.description === 'string' && swatch.description) notes.set(swatch.path, swatch.description);
  }
  const nameOf = (hex: string): string => core.find(c => hexOf(c.hex) === hex)?.label ?? '';
  const slots: Array<[LookSlot['role'], string]> = [['surface', look.surface], ['text', look.ink], ['primary', look.primary], ['secondary', look.secondary]];
  return slots.map(([role, hex]) => ({ role, hex, name: nameOf(hex), note: notes.get(`color.semantic.${role}`) ?? '' }));
}

/** Read the issue for one design system. Never throws on a malformed doc. */
export function readIssue(input: IssueInput): IssueModel {
  const { doc, palette } = input;
  const core = coreColoursOf(palette);
  const { brand: named, ramps } = groupPalette(core);
  const seen = new Set<string>();
  const spectrum = palette.filter(c => {
    if (c.group !== 'spectrum') return false;
    const key = `${c.label.toLowerCase()}\n${c.hex.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const roleLayers = new Map(splitPalette(palette).roles);
  const roles = ROLE_LAYERS.flatMap(layer => roleLayers.get(layer) ?? []);

  const looks = looksOf(doc);
  const modes = leadModes(doc);
  const modeId = (mode: 'light' | 'dark'): string | undefined => modes.find(m => m.id.toLowerCase() === mode)?.id;
  const leads: IssueModel['leads'] = [{ mode: 'light', slots: leadSlots(doc, looks.light, modeId('light'), core) }];
  if (looks.dark) leads.push({ mode: 'dark', slots: leadSlots(doc, looks.dark, modeId('dark'), core) });

  const fonts = fontRolesOf(doc);
  const logos = logosOf(doc);
  const colourways = listLeads(doc);
  return {
    name: input.label,
    source: input.source,
    locked: input.locked,
    standfirst: standfirstOf(doc),
    looks,
    leads,
    colours: { core, named, ramps, spectrum, roles, lockedInks: core.filter(isLockedInk).length },
    fonts,
    logos,
    colourways,
    facts: {
      colours: core.length,
      typefaces: new Set(fonts.map(f => f.family)).size,
      logos: new Set(logos.map(l => l.id)).size,
      colourways: colourways.length,
      modes: (['light', 'dark'] as const).filter(m => modeId(m) !== undefined),
    },
    primaryHex: looks.light.primary,
  };
}
