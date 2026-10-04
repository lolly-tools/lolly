// SPDX-License-Identifier: MPL-2.0
/**
 * Named text styles for Design authoring (plan 291 W5). A style is resolved when a
 * row is authored and written out as explicit fields, so every renderer and export
 * paints the same text whatever its own defaults are.
 *
 * `textStylesFromBrief` derives one style per archetype text role from a design brief
 * (`designBrief`): the most frequent size, weight and alignment the master's
 * placeholders state, sizes scaled from the master's width to the artboard's and
 * rounded to whole px, weights held to the brand's `text-weight` house rules, the
 * line height from `DESIGN_TEXT_LINE_HEIGHTS` (no brand states one) and the colour
 * from the theme's semantic `text` slot (`muted` for subtitle, caption and
 * attribution). With no brief it gives the built-in styles, which carry no colour.
 *
 * `resolveTextStyle` follows `basedOn` chains through a style table, refusing a
 * cycle or an unknown id with the caller's JSON pointer. Pure: data in, data out.
 */
import type { DesignTextStyleV1 } from '@lolly-tools/core';
import { parseColorToSrgb8 } from './css-color.ts';

export type { DesignTextStyleV1 } from '@lolly-tools/core';

type Rec = Record<string, unknown>;
const record = (v: unknown): v is Rec => !!v && typeof v === 'object' && !Array.isArray(v);

/** The style ids the brief gives, in the order a table lists them. */
const STYLE_IDS = ['title', 'subtitle', 'body', 'caption', 'label', 'quote', 'number', 'attribution'] as const;
type StyleId = (typeof STYLE_IDS)[number];

/**
 * Line height per style id. No master, token or brand guide states one, so these are
 * the values a hand-built branded deck settled on: tight display lines, open small
 * print. Design's own fallback (1.12) is for unstyled text.
 */
export const DESIGN_TEXT_LINE_HEIGHTS: Readonly<Record<StyleId, number>> = Object.freeze({
  title: 1.1,
  subtitle: 1.25,
  body: 1.35,
  caption: 1.3,
  label: 1.2,
  quote: 1.2,
  number: 1,
  attribution: 1.3,
});

/** Sizes at a 1280 px master when the brief has no tally for a role (and the built-in styles). */
const FALLBACK_SIZE: Readonly<Record<StyleId, number>> = { title: 37, subtitle: 27, body: 24, caption: 20, label: 22, quote: 40, number: 50, attribution: 21 };
/** Weights when the brief states none for a role (and the built-in styles). */
const FALLBACK_WEIGHT: Readonly<Record<StyleId, string>> = { title: '700', subtitle: '400', body: '400', caption: '400', label: '700', quote: '400', number: '700', attribution: '700' };
/** The styles whose colour is the theme's `muted` slot. */
const MUTED: ReadonlySet<StyleId> = new Set(['subtitle', 'caption', 'attribution']);
/** A text at this share of its artboard's height or more is a headline (the house rules' measure). */
const HEADLINE_SCALE = 0.05;

/** The fields a style may carry, and the type each must have. */
const STYLE_FIELDS: Readonly<Record<keyof DesignTextStyleV1, 'string' | 'number' | 'weight' | 'boolean' | 'align' | 'valign'>> = {
  basedOn: 'string', fontSize: 'number', weight: 'weight', lineHeight: 'number', tracking: 'number', font: 'string',
  align: 'align', valign: 'valign', pad: 'number', fg: 'string', italic: 'boolean',
};
const ALIGNS = ['left', 'center', 'right', 'justify'];
const VALIGNS = ['top', 'middle', 'bottom'];

const hexOf = (value: unknown): string | undefined => {
  const rgba = typeof value === 'string' ? parseColorToSrgb8(value) : null;
  return rgba && rgba[3] >= 1 ? '#' + rgba.slice(0, 3).map((n) => n.toString(16).padStart(2, '0')).join('') : undefined;
};

/** The most frequent tallied value, skipping `unset`. Tallies arrive most frequent first. */
function topOf(tally: unknown): string | number | undefined {
  if (!Array.isArray(tally)) return undefined;
  for (const entry of tally) {
    if (!record(entry)) continue;
    const v = entry.value;
    if ((typeof v === 'string' && v && v !== 'unset') || (typeof v === 'number' && Number.isFinite(v))) return v;
  }
  return undefined;
}

/** The nearest weight a house rule allows, or the weight itself when no rule speaks. */
function clampWeight(weight: string, allowed: string[] | undefined): string {
  if (!allowed?.length || allowed.includes(weight)) return weight;
  const w = Number(weight);
  return [...allowed].sort((a, b) => Math.abs(Number(a) - w) - Math.abs(Number(b) - w) || Number(a) - Number(b))[0]!;
}

interface TextRules { headline?: string[]; body?: string[]; align?: { align: string; exempt: string[] } }

function textRulesOf(brief: Rec): TextRules {
  const type = record(brief.type) ? brief.type : {};
  const listed = Array.isArray(type.rules) && type.rules.length ? type.rules : Array.isArray(brief.houseRules) ? brief.houseRules : [];
  const out: TextRules = {};
  for (const rule of listed) {
    if (!record(rule) || !record(rule.parameters)) continue;
    const p = rule.parameters;
    const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : []);
    if (rule.kind === 'text-weight') {
      const weights = strings(p.weights);
      if (!weights.length) continue;
      if (p.target === 'headline') out.headline = weights;
      else out.body = weights;
    } else if (rule.kind === 'text-align' && typeof p.align === 'string' && ALIGNS.includes(p.align)) {
      out.align = { align: p.align, exempt: strings(p.exemptRoles) };
    }
  }
  return out;
}

/** The semantic slots of the named theme (or the brief's own theme, or its first). Throws on an unknown name. */
function themeSlots(brief: Rec, theme: string | undefined): Record<string, string> | null {
  const themes = Array.isArray(brief.themes) ? brief.themes.filter(record) : [];
  if (!themes.length) return null;
  const wanted = theme ?? (typeof brief.theme === 'string' && brief.theme ? brief.theme : undefined);
  const hit = wanted === undefined ? themes[0]! : themes.find((t) => t.name === wanted);
  if (!hit) {
    if (theme === undefined) return record(themes[0]!.semantic) ? themes[0]!.semantic as Record<string, string> : null;
    throw new Error(`theme "${theme}" is not one of the brief's themes (${themes.map((t) => String(t.name)).join(', ')}).`);
  }
  return record(hit.semantic) ? hit.semantic as Record<string, string> : null;
}

/**
 * One style per archetype text role for an artboard `width` px wide. `brief` is a
 * `designBrief` result (read defensively, so a partial one works); null gives the
 * built-in styles without colours. Throws when the brief has no theme called `theme`.
 */
export function textStylesFromBrief(
  brief: unknown | null,
  opts: { width: number; height?: number; theme?: string },
): Record<string, DesignTextStyleV1> {
  const width = Number(opts.width) > 0 ? Number(opts.width) : 1920;
  const height = Number(opts.height) > 0 ? Number(opts.height) : (width * 9) / 16;
  const b = record(brief) ? brief : null;
  const type = b && record(b.type) ? b.type : {};
  const roles = record(type.roles) ? type.roles : {};
  const scaleSteps = record(type.scale) ? type.scale : {};
  const master = record(type.size) && Number(type.size.width) > 0 ? Number(type.size.width) : 1280;
  const factor = width / master;
  const rules = b ? textRulesOf(b) : {};
  const slots = b ? themeSlots(b, opts.theme) : null;
  const out: Record<string, DesignTextStyleV1> = {};
  for (const id of STYLE_IDS) {
    const role = record(roles[id]) ? roles[id] : {};
    // The scale's label and number steps are page furniture (11 px), so only the four
    // reading roles fall back to the scale.
    const step = ['title', 'subtitle', 'body', 'caption'].includes(id) ? Number(scaleSteps[id]) : NaN;
    const sizeAtMaster = Number(topOf(role.sizes)) || (step > 0 ? step : FALLBACK_SIZE[id]);
    const fontSize = Math.max(1, Math.round(sizeAtMaster * factor));
    const headline = id === 'title' || fontSize >= height * HEADLINE_SCALE;
    const stated = topOf(role.weights);
    const weight = clampWeight(stated !== undefined ? String(stated) : FALLBACK_WEIGHT[id], headline ? rules.headline : rules.body);
    const tallied = topOf(role.aligns);
    const align = rules.align && !rules.align.exempt.includes(id)
      ? rules.align.align
      : typeof tallied === 'string' && ALIGNS.includes(tallied) ? tallied : 'left';
    const style: DesignTextStyleV1 = { fontSize, weight, lineHeight: DESIGN_TEXT_LINE_HEIGHTS[id], align: align as DesignTextStyleV1['align'] };
    const fg = slots ? hexOf(MUTED.has(id) ? slots.muted ?? slots.text : slots.text) : undefined;
    if (fg) style.fg = fg;
    out[id] = style;
  }
  return out;
}

/** Checks one style object's fields and types; throws `<pointer>/<field>: ...`. */
export function assertTextStyle(value: unknown, pointer: string): DesignTextStyleV1 {
  if (!record(value)) throw new Error(`${pointer}: a text style is an object of style fields.`);
  for (const [key, v] of Object.entries(value)) {
    const want = (STYLE_FIELDS as Record<string, string>)[key];
    if (!want) throw new Error(`${pointer}/${key}: unknown text style field (expected ${Object.keys(STYLE_FIELDS).join(', ')}).`);
    const bad =
      want === 'string' ? typeof v !== 'string' || !v
        : want === 'number' ? !(typeof v === 'number' ? Number.isFinite(v) : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)))
          : want === 'weight' ? !/^[1-9]00$/.test(String(v))
            : want === 'boolean' ? typeof v !== 'boolean'
              : want === 'align' ? !ALIGNS.includes(String(v))
                : !VALIGNS.includes(String(v));
    if (bad) {
      const expected = want === 'weight' ? 'a weight from 100 to 900' : want === 'align' ? ALIGNS.join(', ') : want === 'valign' ? VALIGNS.join(', ') : `a ${want}`;
      throw new Error(`${pointer}/${key}: expected ${expected}.`);
    }
  }
  const out: DesignTextStyleV1 = {};
  for (const [key, v] of Object.entries(value)) {
    (out as Rec)[key] = STYLE_FIELDS[key as keyof DesignTextStyleV1] === 'number' ? Number(v) : v;
  }
  return out;
}

const withoutBase = (style: DesignTextStyleV1): DesignTextStyleV1 => {
  const { basedOn: _basedOn, ...rest } = style;
  return rest;
};

/**
 * A style id or an inline style, flattened through its `basedOn` chain (the parent
 * first, the style's own fields over the parent's). The result carries no `basedOn`. Throws
 * `<pointer>: ...` for an unknown id, a cycle or a malformed style.
 */
export function resolveTextStyle(
  ref: string | DesignTextStyleV1,
  table: Record<string, DesignTextStyleV1>,
  pointer: string,
): DesignTextStyleV1 {
  const chain = (id: string, seen: string[]): DesignTextStyleV1 => {
    if (seen.includes(id)) throw new Error(`${pointer}: text style "${id}" is based on itself (${[...seen, id].join(' -> ')}).`);
    const style = Object.hasOwn(table, id) ? table[id] : undefined;
    if (!style) {
      const known = Object.keys(table);
      const from = seen.length ? `text style "${seen[seen.length - 1]}" is based on "${id}", which` : `text style "${id}"`;
      throw new Error(`${pointer}: ${from} does not exist${known.length ? ` (known: ${known.join(', ')})` : ''}.`);
    }
    const own = assertTextStyle(style, `${pointer} (style "${id}")`);
    if (own.basedOn === undefined) return withoutBase(own);
    return { ...chain(own.basedOn, [...seen, id]), ...withoutBase(own) };
  };
  if (typeof ref === 'string') {
    if (!ref) throw new Error(`${pointer}: a text style id is required.`);
    return chain(ref, []);
  }
  if (!record(ref)) throw new Error(`${pointer}: expected a text style id or a style object.`);
  const inline = assertTextStyle(ref, pointer);
  if (inline.basedOn === undefined) return withoutBase(inline);
  return { ...chain(inline.basedOn, []), ...withoutBase(inline) };
}
