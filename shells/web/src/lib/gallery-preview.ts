// SPDX-License-Identifier: MPL-2.0
/** Gallery art is a real template or default render in the active brand. */
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { FeaturedVariant } from '../components/featured-row.ts';
import { instanceFetch, instancePath } from './instance.ts';
import { coverFormats, lookStoreEmpty, renderFeaturedVariant, storedFeaturedVariant } from './featured-render.ts';
import { srcStillLive } from './preview-urls.ts';
import { parseTemplateMotion, type TemplateMotion } from './template-motion.ts';
import { toolSeedHref } from './seed-url.ts';
import { bakedCover } from './gallery-covers.ts';
import { lookDrawReach } from './preview-work-gate.ts';

export interface GalleryPreviewSource {
  id: string;
  version?: string;
  formats?: readonly string[];
  galleryArt?: 'render' | 'icon';
  templates?: Array<{ id: string; name: string; galleryCover?: boolean; galleryTheme?: 'light' | 'dark'; values?: Record<string, unknown>; motion?: TemplateMotion }>;
}

/**
 * Finish covers before any extra template; captures also finish hidden looks.
 *
 * An extra template is drawn only for a card the person has shown interest in (`wanted`:
 * the pointer or the focus is on the card, or the card is on a touch screen). A first
 * visit used to draw every look of every nearby card, about 350 ms of main-thread work
 * each, for strips that most visitors never step through.
 */
export function galleryPreviewPriority(card: HTMLElement, cover: boolean, capture: boolean, wanted = true): number | null {
  const rect = (card.closest('.gtile') ?? card).getBoundingClientRect();
  if (!rect.width || !rect.height) return capture ? 3 : null;
  const near = rect.bottom >= -250 && rect.top <= window.innerHeight + 250;
  if (cover) return near ? 0 : 1;
  if (capture || typeof IntersectionObserver === 'undefined') return 2;
  // Asked for by the person, so it goes ahead of covers far down the page and of the
  // strip's ambient looks (2), and behind only the covers on the screen.
  return near && wanted ? 0.5 : null;
}

/** A draw comes after every read: a visit shows its finished looks first. */
export const DRAW_PRIORITY = 10;
/** How far past the screen a stored look is read ahead, in screen heights. */
const READ_AHEAD_SCREENS = 1.5;

function cardRect(card: HTMLElement): DOMRect {
  return (card.closest('.gtile') ?? card).getBoundingClientRect();
}

function cardOnScreen(card: HTMLElement): boolean {
  const rect = cardRect(card);
  return rect.width > 0 && rect.bottom > 0 && rect.top < window.innerHeight;
}

/** The galleryPreviewPriority of an extra look the person asked for. */
const WANTED_EXTRA = 0.5;

/**
 * When to read a card's stored look, from its galleryPreviewPriority. A cover far down
 * the page (1) is read once the page comes within {@link READ_AHEAD_SCREENS} screens of
 * it, so a visit does not turn every stored look into a picture at once; the queue
 * looks again when the page stops scrolling. An extra look is read while its card is
 * on the screen: on a touch screen a card stays "wanted" once it has been in view, and
 * the page can move it below the fold a moment later (the featured row arrives above).
 */
export function lookReadPriority(card: HTMLElement, base: number | null): number | null {
  if (base === WANTED_EXTRA) return cardOnScreen(card) ? base : null;
  if (base !== 1) return base;
  const rect = cardRect(card);
  const ahead = window.innerHeight * READ_AHEAD_SCREENS;
  return rect.bottom >= -ahead && rect.top <= window.innerHeight + ahead ? 1 : null;
}

/**
 * When to draw a card's missing look, from its galleryPreviewPriority: a cover on the
 * screen or near it (never one far down the page), an extra look while its card is on
 * the screen, and only as far as the device allows (lib/preview-work-gate.ts
 * lookDrawReach): on the screen itself when it asks for less work, nowhere under
 * Performance UI. Whether the page is at rest is the queue's question (its draw gate).
 */
export function lookDrawPriority(card: HTMLElement, base: number | null): number | null {
  if (base === null || base === 1) return null;
  const reach = lookDrawReach();
  if (reach === 'none') return null;
  if ((reach === 'screen' || base === WANTED_EXTRA) && !cardOnScreen(card)) return null;
  return DRAW_PRIORITY + base;
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

/** The cover last drawn for this look in this visit, or null on a first draw. An
 *  object URL the reader has since revoked (lib/preview-urls.ts) is not offered:
 *  the new draw finds the look in the store again. */
export function heldGalleryLook(toolId: string, index: number): string | null {
  const held = heldLooks.get(heldKey(toolId, index)) ?? null;
  return held?.startsWith('blob:') && !srcStillLive(held) ? null : held;
}

export async function renderGalleryLook(
  host: HostV1, tool: GalleryPreviewSource,
  index: number, look: FeaturedVariant,
): Promise<string> {
  const thumb = await drawGalleryLook(host, tool, index, look);
  if (thumb) heldLooks.set(heldKey(tool.id, index), thumb);
  return thumb;
}

/**
 * The look's finished picture, or null when it has not been drawn yet: a baked cover
 * or a picture in the preview store. Draws nothing and loads no tool code, so a visit
 * can show every finished look first and leave the missing ones until the page is at
 * rest (renderGalleryLook draws them).
 */
export async function storedGalleryLook(
  host: HostV1, tool: GalleryPreviewSource,
  index: number, look: FeaturedVariant,
): Promise<string | null> {
  const baked = await bakedCover(host, tool, index, look.templateId);
  const thumb = baked ?? await (async () => {
    // An empty store holds no look to find: skip the template file the recipe needs.
    if (await lookStoreEmpty()) return null;
    const { values, motion } = await lookInputs(tool, look);
    return storedFeaturedVariant(host, tool.id, coverFormats(tool), values, galleryScope(tool), motion?.posterMs);
  })();
  if (thumb) heldLooks.set(heldKey(tool.id, index), thumb);
  return thumb;
}

const galleryScope = (tool: GalleryPreviewSource): string => `gallery@${tool.version ?? 'current'}`;

type TemplateFile = { values?: Record<string, unknown>; motion?: TemplateMotion; gallerySize?: unknown };

/** A template's own file (null when the server has none), fetched once a visit for
 *  each tool version: the read and the draw of one look both need its values. */
const templateFiles = new Map<string, Promise<TemplateFile | null>>();
function templateFile(tool: GalleryPreviewSource, templateId: string): Promise<TemplateFile | null> {
  const key = `${tool.id}\u0000${tool.version ?? ''}\u0000${templateId}`;
  let file = templateFiles.get(key);
  if (!file) {
    file = instanceFetch(instancePath(`/tools/${encodeURIComponent(tool.id)}/templates/${encodeURIComponent(templateId)}.json`))
      .then(response => (response.ok ? response.json() as Promise<TemplateFile> : null));
    templateFiles.set(key, file);
    // A missing or failed file is asked for again next time.
    file.then(found => { if (!found) templateFiles.delete(key); }, () => templateFiles.delete(key));
  }
  return file;
}

/** The values (and motion) a look is drawn with: a template's file, else the look's own. */
async function lookInputs(tool: GalleryPreviewSource, look: FeaturedVariant): Promise<{ values: Record<string, unknown>; motion?: TemplateMotion }> {
  let values = look.values;
  let motion = look.motion;
  if (look.templateId) {
    const file = await templateFile(tool, look.templateId);
    if (file) {
      if (!file.values || typeof file.values !== 'object' || Array.isArray(file.values)) throw new Error('Invalid template values');
      values = withGallerySize(file.values, file.gallerySize); motion = parseTemplateMotion(file.motion);
    } else if (!Object.keys(values).length) throw new Error(`Template ${look.templateId} is unavailable`);
  }
  return { values, ...(motion ? { motion } : {}) };
}

async function drawGalleryLook(
  host: HostV1, tool: GalleryPreviewSource,
  index: number, look: FeaturedVariant,
): Promise<string> {
  const baked = await bakedCover(host, tool, index, look.templateId);
  if (baked) return baked;
  const { values, motion } = await lookInputs(tool, look);
  return renderFeaturedVariant(host, tool.id, coverFormats(tool), look.templateId ?? index, values, galleryScope(tool), motion?.posterMs);
}
