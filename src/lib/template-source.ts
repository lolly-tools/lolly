// SPDX-License-Identifier: MPL-2.0
/**
 * Template source - the shipped-template data layer the chooser, the `?template=`
 * launcher, the gallery's About dialog and the Projects Templates collection all read
 * through. Moved out of views/template-chooser.ts (plans/226 WP-0) so a lib module can
 * resolve a template without importing a view; the chooser re-exports every name so its
 * existing importers are unchanged.
 *
 * Shipped templates live one per file at tools/<toolId>/templates/<tid>.json; the synced
 * index carries metadata only, and `fetchTemplateFile` reads the heavy `values` seed on
 * demand through the instance base. Every reader here returns null or drops a malformed
 * entry rather than throwing - a broken template must never stop a tool opening.
 */

import { parseTemplateMotion, type TemplateMotion } from './template-motion.ts';
import type { InputValue } from '../../../../engine/src/inputs.ts';

/**
 * A parsed template entry. Its metadata (id/name/category/description/thumb) is what
 * the synced index carries and the chooser renders the grid from; `values` is the heavy
 * input seed, which now lives in an EXTERNAL per-template file (tools/<id>/templates/
 * <tid>.json) and is FETCHED ON DEMAND (preview render + select). For a metadata-only
 * entry `values` is `{}` - fetchTemplateValues() supplies the real seed lazily.
 */
/** A template's curated variant (plans/142): a values OVERLAY merged over the
 *  template's base `values` (shallow, preset wins). `values` is `{}` for a
 *  metadata-only entry off the synced index - the overlay rides the template's
 *  external file and is read with it. */
export interface TemplatePreset {
  id: string;
  name: string;
  description?: string;
  values: Record<string, InputValue>;
}

export interface TemplateVariant {
  id: string;
  name: string;
  description?: string;
  category?: string;
  thumb?: string;
  motion?: TemplateMotion;
  values: Record<string, InputValue>;
  presets?: TemplatePreset[];
  /** The template's ref (`"<toolId>:<tid>"` or `"user:<id>"`, lib/template-ref.ts) when the
   *  list builder knows it - the chooser and the Projects collection key hide / start-with
   *  / delete actions on it. Absent on a bare parseTemplates() result. */
  ref?: string;
  /** True for a template the person saved (delete, rename, update); false/absent for a
   *  shipped one (hide, make a copy). */
  own?: boolean;
}

/** Narrow an unknown `presets` array (template file, index metadata, or inline
 *  manifest) to the shape above - malformed entries drop, first id wins. */
function parsePresets(raw: unknown): TemplatePreset[] {
  if (!Array.isArray(raw)) return [];
  const out: TemplatePreset[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const p = item as Record<string, unknown>;
    if (typeof p.id !== 'string' || !p.id || seen.has(p.id)) continue;
    if (typeof p.name !== 'string' || !p.name) continue;
    seen.add(p.id);
    out.push({
      id: p.id,
      name: p.name,
      description: typeof p.description === 'string' ? p.description : undefined,
      values: p.values && typeof p.values === 'object' && !Array.isArray(p.values)
        ? (p.values as Record<string, InputValue>)
        : {},
    });
  }
  return out;
}

/**
 * Fetch one template's full input seed from its external file
 * (tools/<toolId>/templates/<tid>.json) through the instance base / profile view - the
 * same static namespace the card-preview paths use. Returns the `values` map, or `null`
 * on every failure (network, missing file, malformed JSON, non-object `values`) so a
 * caller falls through to a blank/default open rather than throwing. The heavy seed is
 * never packed into a URL - this fetch is the on-demand path for both the chooser select
 * and the reserved `?template=<id>` launcher.
 */
export async function fetchTemplateValues(toolId: string, tid: string): Promise<Record<string, InputValue> | null> {
  const f = await fetchTemplateFile(toolId, tid);
  return f?.values ?? null;
}

/**
 * Fetch one template's external file whole: the base `values` plus its `presets`
 * overlays (plans/142). Same failure contract as fetchTemplateValues - null, never
 * a throw. The chooser's select path and the `?template=&preset=` launcher both
 * need the presets, so the file is read once and shared.
 */
export async function fetchTemplateFile(toolId: string, tid: string): Promise<{ values: Record<string, InputValue>; presets: TemplatePreset[]; motion?: TemplateMotion; kit?: unknown } | null> {
  try {
    const { instanceFetch, instancePath } = await import('./instance.ts');
    const resp = await instanceFetch(instancePath(`/tools/${encodeURIComponent(toolId)}/templates/${encodeURIComponent(tid)}.json`));
    if (!resp.ok) return null;
    const data = await resp.json() as { values?: unknown; presets?: unknown; motion?: unknown; kit?: unknown };
    const v = data?.values;
    if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
    return { values: v as Record<string, InputValue>, presets: parsePresets(data?.presets), ...(data.kit !== undefined ? { kit: data.kit } : {}), ...(parseTemplateMotion(data.motion) ? { motion: parseTemplateMotion(data.motion) } : {}) };
  } catch {
    return null;
  }
}

/** The seed for `?template=<tid>[&preset=<pid>]`: the template base merged with the
 *  named preset's overlay (shallow, preset wins). An unknown preset id applies the
 *  base alone - a stale link still opens something sensible. */
/** A blank template keeps declared artboards, with no composed cover content. */
export function blankTemplateSeed(inputs: Array<{ id: string; type?: string; default?: unknown; canvas?: { frameKind?: string; kindField?: string } }>): Record<string, InputValue> {
  const input = inputs.find(i => i.type === 'blocks' && !!i.canvas?.frameKind);
  const rows = Array.isArray(input?.default) ? input.default as Array<Record<string, unknown>> : [];
  const frames = rows.filter(row => row && String(row[input?.canvas?.kindField ?? 'kind']) === input?.canvas?.frameKind);
  return frames.length && input ? { [input.id]: frames as InputValue } : {};
}

const seedPosters = new WeakMap<object, number>();
export const templateEditorPose = (values: object): { playhead?: number } => {
  const ms = seedPosters.get(values);
  return ms === undefined ? {} : { playhead: ms / 1000 };
};
export function rememberPoster(values: Record<string, InputValue>, motion?: TemplateMotion) {
  if (motion) {
    const rows = Array.isArray(values.boxes) ? values.boxes as Array<Record<string, unknown>> : [];
    const duration = Math.max(0, ...rows.map(b => (Number(b.start) || 0) + (Number(b.dur) || 0))) * 1000;
    seedPosters.set(values, motion.posterMs * (duration || motion.durationMs) / motion.durationMs);
  }
  return values;
}

export async function fetchTemplateSeed(toolId: string, tid: string, presetId?: string | null): Promise<Record<string, InputValue> | null> {
  const f = await fetchTemplateFile(toolId, tid);
  if (!f) return null;
  const overlay = presetId ? f.presets.find(p => p.id === presetId)?.values : undefined;
  return rememberPoster(overlay && Object.keys(overlay).length ? { ...f.values, ...overlay } : f.values, f.motion);
}

/**
 * Narrow a manifest's `templates` (typed `unknown[]` on the SDK Manifest) into
 * the variants this chooser can render. Entries missing the required `id` /
 * `name` / object `values` are dropped rather than throwing - a malformed
 * template must never break a tool's fresh open.
 */
export function parseTemplates(raw: unknown): TemplateVariant[] {
  if (!Array.isArray(raw)) return [];
  const out: TemplateVariant[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const t = item as Record<string, unknown>;
    if (typeof t.id !== 'string' || !t.id) continue;
    if (typeof t.name !== 'string' || !t.name) continue;
    if (seen.has(t.id)) continue; // first wins on a duplicate id
    const values = t.values && typeof t.values === 'object' && !Array.isArray(t.values)
      ? (t.values as Record<string, InputValue>)
      : {};
    seen.add(t.id);
    const presets = parsePresets(t.presets);
    out.push({
      id: t.id,
      name: t.name,
      description: typeof t.description === 'string' ? t.description : undefined,
      category: typeof t.category === 'string' && t.category ? t.category : undefined,
      thumb: typeof t.thumb === 'string' && t.thumb ? t.thumb : undefined,
      values,
      ...(presets.length ? { presets } : {}),
      ...(parseTemplateMotion(t.motion) ? { motion: parseTemplateMotion(t.motion) } : {}),
    });
  }
  return out;
}

/** Look up one template's seed by id (the inline-manifest fallback for the reserved
 *  `?template=<id>` path). With `presetId`, the named preset's overlay is merged over
 *  the base (shallow, preset wins); an unknown preset id applies the base alone. */
export function templateValuesById(raw: unknown, id: string, presetId?: string | null): Record<string, InputValue> | null {
  const found = parseTemplates(raw).find(v => v.id === id);
  if (!found) return null;
  const overlay = presetId ? found.presets?.find(p => p.id === presetId)?.values : undefined;
  return overlay && Object.keys(overlay).length ? { ...found.values, ...overlay } : found.values;
}
