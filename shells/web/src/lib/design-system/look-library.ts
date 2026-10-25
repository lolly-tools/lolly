// SPDX-License-Identifier: MPL-2.0
/** A small local index of saved systems and original reusable starting points. */
import { brandContext } from '../../../../../engine/src/brand-context.ts';
import { deltaEOk } from '../../../../../engine/src/color-tools.ts';
import { deriveBrandTokens } from '../../../../../engine/src/brand-derive.ts';
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
export function exampleLooks(): LocalLook[] {
  return [
    { id: 'orchard', name: 'Orchard', color: '#39734D', tags: ['calm', 'green', 'nature'] },
    { id: 'playroom', name: 'Playroom', color: '#8551C8', tags: ['playful', 'purple', 'creative'] },
    { id: 'sunroom', name: 'Sunroom', color: '#BE522A', tags: ['warm', 'orange', 'editorial'] },
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
/** Rank on stated terms and measured palette distance. This is not a quality score. */
export function rankLocalLooks(looks: LocalLook[], query: string, reference?: LocalLook): LocalLook[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean).slice(0, 12);
  const referenceColors = reference ? anchors(reference) : [];
  const referenceFonts = new Set(reference?.context.fonts.map(f => f.value.toLowerCase()) ?? []);
  return looks.map(look => {
    const haystack = [look.name, ...look.tags, ...look.context.fonts.map(f => f.value)].join(' ').toLowerCase();
    const matches = words.every(word => haystack.includes(word));
    const colors = anchors(look);
    const distance = referenceColors.length && colors.length
      ? referenceColors.reduce((total, color) => total + Math.min(...colors.map(c => deltaEOk(color, c)).filter(Number.isFinite), 1), 0) / referenceColors.length : 1;
    const sameType = look.context.fonts.some(f => referenceFonts.has(f.value.toLowerCase()));
    return { look, matches, distance, sameType };
  }).filter(r => r.matches).sort((a, b) => a.distance - b.distance || Number(b.sameType) - Number(a.sameType) || a.look.name.localeCompare(b.look.name) || a.look.id.localeCompare(b.look.id)).map(r => r.look);
}
