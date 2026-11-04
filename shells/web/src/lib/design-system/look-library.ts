// SPDX-License-Identifier: MPL-2.0
/** A small local index of saved systems and original reusable starting points. */
import { brandContext } from '../../../../../engine/src/brand-context.ts';
import { deltaEOk } from '../../../../../engine/src/color-tools.ts';
import { deriveBrandTokens, hexToOklch } from '../../../../../engine/src/brand-derive.ts';
import { t } from '../../i18n.ts';
import type { DesignSystemRegistry } from './registry.ts';

export interface LocalLook {
  id: string;
  name: string;
  tags: string[];
  source: 'saved' | 'example';
  doc: Record<string, unknown>;
  context: ReturnType<typeof brandContext>;
}
export const LOOK_LIMIT = 60;
export const LOOK_BYTES = 2 * 1024 * 1024;
export function lookTags(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((s): s is string => typeof s === 'string')
    .map(s => s.trim().slice(0, 30).toLowerCase()).filter(Boolean))].slice(0, 8) : [];
}
export function localLook(id: string, name: string, source: LocalLook['source'], doc: Record<string, unknown>, tags: string[] = []): LocalLook {
  return { id, name, source, doc, tags: lookTags(tags), context: brandContext(doc, { name }) };
}
/** The starting points. Their tags are read in the reader's language when the
 *  list is built, so the tag line and the search both use the words on screen. */
export function exampleLooks(): LocalLook[] {
  return [
    { id: 'orchard', name: 'Orchard', color: '#39734D', tags: [t('calm'), t('green'), t('nature')] },
    { id: 'playroom', name: 'Playroom', color: '#8551C8', tags: [t('playful'), t('purple'), t('creative')] },
    { id: 'sunroom', name: 'Sunroom', color: '#BE522A', tags: [t('warm'), t('orange'), t('editorial')] },
  ].map(e => localLook(`example:${e.id}`, e.name, 'example', deriveBrandTokens({ primary: e.color, name: e.name }), e.tags));
}
export async function readLocalLooks(host: { designSystems: DesignSystemRegistry; assets: { _getBlob?(id: string): Promise<Blob | null> }; tokens?: { raw?(): Promise<unknown> } }) {
  const records = await host.designSystems.visible();
  const activeId = await host.designSystems.activeId?.();
  const looks: LocalLook[] = [];
  let unavailable = Math.max(0, records.length - LOOK_LIMIT);
  // A small batch keeps large libraries from starting dozens of blob reads at once.
  for (let at = 0; at < Math.min(records.length, LOOK_LIMIT); at += 4) {
    await Promise.all(records.slice(at, Math.min(at + 4, LOOK_LIMIT)).map(async record => {
      try {
        const blob = record.headId ? await host.assets._getBlob?.(record.headId) : null;
        if (blob && blob.size > LOOK_BYTES) { unavailable++; return; }
        const doc: unknown = blob ? JSON.parse(await blob.text()) : record.id === activeId ? await host.tokens?.raw?.() : null;
        if (!doc || typeof doc !== 'object' || Array.isArray(doc)) { unavailable++; return; }
        looks.push(localLook(record.id, record.label, 'saved', doc as Record<string, unknown>, record.tags));
      } catch { unavailable++; }
    }));
  }
  return { looks: [...looks.sort((a, b) => a.id < b.id ? -1 : 1), ...exampleLooks()], unavailable };
}
function anchors(look: LocalLook): string[] {
  const semantic = look.context.colors.filter(c => /\.semantic\.(primary|surface|text)$/.test(c.path));
  return (semantic.length ? semantic : look.context.colors).slice(0, 6).map(c => c.value);
}

/** A colour family, measured in OKLCH. Boundaries sit between color-namer.ts's hue
 *  anchors, so a colour named "Teal" there is "teal" here too. */
export type LookHue = 'neutral' | 'red' | 'orange' | 'yellow' | 'green' | 'teal' | 'blue' | 'purple' | 'pink';
const HUE_FAMILIES: ReadonlyArray<readonly [number, LookHue]> = [
  [15, 'pink'], [35, 'red'], [85, 'orange'], [122, 'yellow'], [180, 'green'], [218, 'teal'], [290, 'blue'], [330, 'purple'], [360, 'pink'],
];
/** Below this chroma a colour reads as a grey (color-namer.ts uses the same cut). */
const NEUTRAL_C = 0.037;
export function hueFamily(hex: string): LookHue | null {
  const o = hexToOklch(hex);
  if (!o) return null;
  if (o.c < NEUTRAL_C) return 'neutral';
  const h = ((o.h % 360) + 360) % 360;
  return HUE_FAMILIES.find(([end]) => h < end)?.[1] ?? 'pink';
}
/** One word for how the lead colour sits: dark, pale, saturated or quiet. Empty
 *  for a grey and for the middle band, where no word would be honest. */
export type LookMood = 'deep' | 'pale' | 'vivid' | 'muted';
export function hueMood(hex: string): LookMood | null {
  const o = hexToOklch(hex);
  if (!o || o.c < NEUTRAL_C) return null;
  if (o.l < 0.45) return 'deep';
  if (o.l > 0.82) return 'pale';
  if (o.c >= 0.19) return 'vivid';
  return o.c < 0.08 ? 'muted' : null;
}
const hueWord = (hue: LookHue): string => ({
  neutral: t('neutral'), red: t('red'), orange: t('orange'), yellow: t('yellow'), green: t('green'),
  teal: t('teal'), blue: t('blue'), purple: t('purple'), pink: t('pink'),
})[hue];
const moodWord = (mood: LookMood): string => ({ deep: t('deep'), pale: t('pale'), vivid: t('vivid'), muted: t('muted') })[mood];

/** The lead colour: the semantic primary, else the first colour the look carries. */
export function lookLead(look: LocalLook): string | undefined {
  return look.context.colors.find(c => c.path.endsWith('.semantic.primary'))?.value ?? look.context.colors[0]?.value;
}
/** The look's first declared family, without quotes or fallbacks. */
function leadFamily(look: LocalLook): string {
  const fonts = look.context.fonts;
  const value = (fonts.find(f => f.path === 'font.brand') ?? fonts[0])?.value ?? '';
  return value.split(',')[0]!.trim().replace(/^['"]|['"]$/g, '');
}
/**
 * The words under a look's card. Tags someone wrote come first and stand alone.
 * A look with none (a shipped system, a saved one never tagged) is described by
 * what can be measured: how its lead colour sits, its colour family and its
 * typeface. No count, because the rooms already say how many colours a system
 * holds and a third number would disagree with them.
 */
export function lookTagline(look: LocalLook): string[] {
  if (look.tags.length) return look.tags;
  const lead = lookLead(look);
  const hue = lead ? hueFamily(lead) : null;
  const mood = lead ? hueMood(lead) : null;
  const family = leadFamily(look);
  return [mood ? moodWord(mood) : '', hue ? hueWord(hue) : '', family].filter(Boolean);
}

/** A look's colours and roles in the shape palette-preview.ts draws its scenes
 *  from: primary and secondary first, then every other colour once, the same
 *  order activePalette gives the live system. */
export function lookPalette(look: LocalLook): { colors: string[]; roles: { primary?: string; secondary?: string; surface?: string; text?: string; onPrimary?: string } } {
  const colors = look.context.colors;
  const role = (slot: string): string | undefined => colors.find(c => c.path.endsWith(`.semantic.${slot}`))?.value;
  const roles = { primary: role('primary'), secondary: role('secondary'), surface: role('surface'), text: role('text'), onPrimary: role('on-primary') };
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const value of [roles.primary, roles.secondary, ...colors.map(c => c.value)]) {
    if (typeof value !== 'string' || seen.has(value.toLowerCase())) continue;
    seen.add(value.toLowerCase());
    ordered.push(value);
  }
  return { colors: ordered, roles };
}

/** Rank on stated terms and measured palette distance. This is not a quality score. */
export function rankLocalLooks(looks: LocalLook[], query: string, reference?: LocalLook): LocalLook[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean).slice(0, 12);
  const referenceColors = reference ? anchors(reference) : [];
  const referenceFonts = new Set(reference?.context.fonts.map(f => f.value.toLowerCase()) ?? []);
  return looks.map(look => {
    const haystack = [look.name, ...look.tags, ...lookTagline(look), ...look.context.fonts.map(f => f.value)].join(' ').toLowerCase();
    const matches = words.every(word => haystack.includes(word));
    const colors = anchors(look);
    const distance = referenceColors.length && colors.length
      ? referenceColors.reduce((total, color) => total + Math.min(...colors.map(c => deltaEOk(color, c)).filter(Number.isFinite), 1), 0) / referenceColors.length : 1;
    const sameType = look.context.fonts.some(f => referenceFonts.has(f.value.toLowerCase()));
    return { look, matches, distance, sameType };
  }).filter(r => r.matches).sort((a, b) => a.distance - b.distance || Number(b.sameType) - Number(a.sameType) || a.look.name.localeCompare(b.look.name) || a.look.id.localeCompare(b.look.id)).map(r => r.look);
}
