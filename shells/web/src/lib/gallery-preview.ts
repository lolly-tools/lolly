// SPDX-License-Identifier: MPL-2.0
/** Gallery art is a real template or default render in the active brand. */
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { PreviewsAPI } from '../bridge/previews.ts';
import type { FeaturedVariant } from '../components/featured-row.ts';
import { instanceFetch, instancePath } from './instance.ts';
import { renderFeaturedVariant } from './featured-render.ts';
import { parseTemplateMotion, type TemplateMotion } from './template-motion.ts';
import { toolSeedHref } from './seed-url.ts';

export interface GalleryPreviewSource {
  id: string;
  version?: string;
  formats?: readonly string[];
  templates?: Array<{ id: string; name: string; values?: Record<string, unknown>; motion?: TemplateMotion }>;
}

export function galleryPreviewLooks(tool: GalleryPreviewSource): FeaturedVariant[] {
  const templates = tool.templates?.filter(t => t.id && t.name) ?? [];
  return templates.length
    ? templates.map(t => ({ label: t.name, templateId: t.id, values: t.values ?? {}, ...(t.motion ? { motion: t.motion } : {}) }))
    : [{ values: {} }];
}

export async function galleryLookHref(toolId: string, look?: FeaturedVariant): Promise<string> {
  return look?.templateId
    ? `#/tool/${encodeURIComponent(toolId)}?template=${encodeURIComponent(look.templateId)}`
    : Object.keys(look?.values ?? {}).length
      ? toolSeedHref(toolId, look?.values)
      : `#/tool/${encodeURIComponent(toolId)}`;
}

export async function renderGalleryLook(
  host: HostV1 & { previews?: PreviewsAPI }, tool: GalleryPreviewSource,
  index: number, look: FeaturedVariant,
): Promise<string> {
  let values = look.values;
  let motion = look.motion;
  if (look.templateId) {
    const response = await instanceFetch(instancePath(`/tools/${encodeURIComponent(tool.id)}/templates/${encodeURIComponent(look.templateId)}.json`));
    if (response.ok) {
      const file = await response.json() as { values?: Record<string, unknown>; motion?: TemplateMotion };
      if (!file.values || typeof file.values !== 'object' || Array.isArray(file.values)) throw new Error('Invalid template values');
      values = file.values; motion = parseTemplateMotion(file.motion);
    } else if (!Object.keys(values).length) throw new Error(`Template ${look.templateId} is unavailable`);
  }
  return renderFeaturedVariant(host, tool.id, tool.formats, look.templateId ?? index, values, `gallery@${tool.version ?? 'current'}`, motion?.posterMs);
}
