// SPDX-License-Identifier: MPL-2.0
/** Gallery art is a real template or default render in the active brand. */
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { PreviewsAPI } from '../bridge/previews.ts';
import type { FeaturedVariant } from '../components/featured-row.ts';
import { instanceFetch, instancePath } from './instance.ts';
import { coverFormats, renderFeaturedVariant } from './featured-render.ts';
import { parseTemplateMotion, type TemplateMotion } from './template-motion.ts';
import { toolSeedHref } from './seed-url.ts';
import { bakedCover } from './gallery-covers.ts';

export interface GalleryPreviewSource {
  id: string;
  version?: string;
  formats?: readonly string[];
  galleryArt?: 'render' | 'icon';
  templates?: Array<{ id: string; name: string; galleryCover?: boolean; galleryTheme?: 'light' | 'dark'; values?: Record<string, unknown>; motion?: TemplateMotion }>;
}

/** Finish covers before nearby extra templates; captures also finish hidden looks. */
export function galleryPreviewPriority(card: HTMLElement, cover: boolean, capture: boolean): number | null {
  const rect = (card.closest('.gtile') ?? card).getBoundingClientRect();
  if (!rect.width || !rect.height) return capture ? 3 : null;
  const near = rect.bottom >= -250 && rect.top <= window.innerHeight + 250;
  return cover ? (near ? 0 : 1) : (near || capture || typeof IntersectionObserver === 'undefined' ? 2 : null);
}

export function galleryPreviewLooks(tool: GalleryPreviewSource): FeaturedVariant[] {
  if (tool.galleryArt === 'icon') return [];
  const formats = coverFormats(tool);
  if (formats && !formats.some(f => ['svg', 'png', 'jpg', 'jpeg', 'webp'].includes(f))) return [];
  const templates = (tool.templates?.filter(t => t.id && t.name) ?? [])
    .sort((a, b) => Number(b.galleryCover === true) - Number(a.galleryCover === true));
  return templates.length
    ? templates.map(t => ({ label: t.name, templateId: t.id, values: t.values ?? {}, ...(t.galleryTheme ? { theme: t.galleryTheme } : {}), ...(t.motion ? { motion: t.motion } : {}) }))
    : [{ values: {} }];
}

/**
 * The size a cover is drawn at on its gallery card. A template's `values` hold only
 * declared inputs, so the card's shape travels beside them and never changes what opens.
 */
export function withGallerySize(values: Record<string, unknown>, size: unknown): Record<string, unknown> {
  const { width, height } = (size && typeof size === 'object' ? size : {}) as { width?: unknown; height?: unknown };
  return typeof width === 'number' && width > 0 && typeof height === 'number' && height > 0 ? { ...values, width, height } : values;
}

export async function galleryLookHref(toolId: string, look?: FeaturedVariant): Promise<string> {
  return look?.templateId
    ? `#/tool/${encodeURIComponent(toolId)}?template=${encodeURIComponent(look.templateId)}`
    : Object.keys(look?.values ?? {}).length
      ? toolSeedHref(toolId, look?.values)
      : `#/tool/${encodeURIComponent(toolId)}`;
}

/**
 * The last cover drawn for each look in this visit. When the design system or the theme
 * changes, the gallery mounts again and every cover has to be drawn again in the new
 * colours, which takes seconds. A tile shows the cover held here until its new one is
 * ready, so the gallery recolours tile by tile and never falls back to placeholders.
 */
const heldLooks = new Map<string, string>();
const heldKey = (toolId: string, index: number): string => `${toolId}\u0000${index}`;

/** The cover last drawn for this look in this visit, or null on a first draw. */
export function heldGalleryLook(toolId: string, index: number): string | null {
  return heldLooks.get(heldKey(toolId, index)) ?? null;
}

export async function renderGalleryLook(
  host: HostV1 & { previews?: PreviewsAPI }, tool: GalleryPreviewSource,
  index: number, look: FeaturedVariant,
): Promise<string> {
  const thumb = await drawGalleryLook(host, tool, index, look);
  if (thumb) heldLooks.set(heldKey(tool.id, index), thumb);
  return thumb;
}

async function drawGalleryLook(
  host: HostV1 & { previews?: PreviewsAPI }, tool: GalleryPreviewSource,
  index: number, look: FeaturedVariant,
): Promise<string> {
  const baked = await bakedCover(host, tool, index, look.templateId);
  if (baked) return baked;
  let values = look.values;
  let motion = look.motion;
  if (look.templateId) {
    const response = await instanceFetch(instancePath(`/tools/${encodeURIComponent(tool.id)}/templates/${encodeURIComponent(look.templateId)}.json`));
    if (response.ok) {
      const file = await response.json() as { values?: Record<string, unknown>; motion?: TemplateMotion; gallerySize?: unknown };
      if (!file.values || typeof file.values !== 'object' || Array.isArray(file.values)) throw new Error('Invalid template values');
      values = withGallerySize(file.values, file.gallerySize); motion = parseTemplateMotion(file.motion);
    } else if (!Object.keys(values).length) throw new Error(`Template ${look.templateId} is unavailable`);
  }
  return renderFeaturedVariant(host, tool.id, coverFormats(tool), look.templateId ?? index, values, `gallery@${tool.version ?? 'current'}`, motion?.posterMs);
}
