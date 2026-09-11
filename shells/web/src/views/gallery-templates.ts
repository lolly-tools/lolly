// SPDX-License-Identifier: MPL-2.0
/**
 * The starting points a gallery card can offer (plans/226 section 4.5).
 *
 * Two overlays sit between the catalog index and every browse surface: the shipped
 * templates this person hid, and the templates they saved themselves. A hidden one
 * leaves the card's count, the About dialog's tiles and the search haystack while its
 * `?template=` link keeps working; their own join the count beside the shipped ones.
 * Both are read from the ONE profile record the gallery mount already awaits, so
 * nothing here delays the first paint.
 *
 * Every function takes the context first (the mount builds it once with
 * galleryTemplates()), so the gallery closure calls each of these in a single line
 * and no state has to be threaded through it a second time.
 */
import { t, tRaw } from '../i18n.ts';
import { defaultHiddenTemplateRefs } from '../catalog/sync.ts';
import { loadHiddenTemplates } from '../lib/hidden-templates.ts';
import { loadTemplateStart, START_BLANK } from '../lib/template-start.ts';
import { parseTemplateRef, shippedTemplateRef } from '../lib/template-ref.ts';
import type { UserTemplate } from '../lib/user-templates.ts';
import type { Profile } from '@lolly-tools/core/host-v1';
import type { GalleryHost, GalleryTool } from './gallery.ts';

/**
 * What the About dialog needs to list a tool's starting points and let the person pick
 * the one it opens with: the shipped templates they have NOT hidden, the ones they saved
 * themselves, and the live "Start with" setting. The mount owns all four, so the dialog
 * only renders them.
 */
export interface InfoTemplates {
  shipped: NonNullable<GalleryTool['templates']>;
  mine: readonly UserTemplate[];
  /** The stored setting: a TemplateRef, 'blank', or null for "ask me". */
  start: () => string | null;
  /** The setting's display name, or null when nothing is set (or it no longer resolves). */
  startName: () => string | null;
  setStart: (value: string | null) => Promise<void>;
}

export const NO_INFO_TEMPLATES: InfoTemplates = {
  shipped: [], mine: [], start: () => null, startName: () => null, setStart: async () => {},
};

/** The mount's template state: both overlays, plus what the surfaces read them against. */
export interface GalleryTemplates {
  readonly host: GalleryHost;
  /** The LIVE profile object the mount awaited; the shared handlers mutate it in place. */
  readonly profile: Profile;
  readonly own: readonly UserTemplate[];
  readonly ownByTool: Map<string, UserTemplate[]>;
  readonly hidden: Set<string>;
  readonly toolById: Map<string, GalleryTool>;
  /** The mounted view element, so a card's line can be repainted in place. */
  readonly root: HTMLElement;
}

/** Build the context once per mount, from the profile and template list already read. */
export function galleryTemplates(
  host: GalleryHost,
  profile: Profile,
  own: readonly UserTemplate[],
  toolById: Map<string, GalleryTool>,
  root: HTMLElement,
): GalleryTemplates {
  const hiddenTemplates = loadHiddenTemplates(profile, defaultHiddenTemplateRefs());
  const ownByTool = new Map<string, UserTemplate[]>();
  for (const tpl of own) {
    const list = ownByTool.get(tpl.toolId);
    if (list) list.push(tpl); else ownByTool.set(tpl.toolId, [tpl]);
  }
  return { host, profile, own, ownByTool, hidden: hiddenTemplates, toolById, root };
}

/** This tool's shipped templates, minus the ones this person hid. */
export function shippedTemplatesOf(gt: GalleryTemplates, tool: GalleryTool): NonNullable<GalleryTool['templates']> {
  return (tool.templates ?? []).filter(tp => !gt.hidden.has(shippedTemplateRef(tool.id, tp.id)));
}

export function myTemplatesOf(gt: GalleryTemplates, toolId: string): readonly UserTemplate[] {
  return gt.ownByTool.get(toolId) ?? [];
}

/**
 * The name of this tool's "Start with", or null for "ask me". Reads the LIVE profile
 * object (saveTemplateStart mutates the cached record), so the About dialog's chip and
 * the card line agree the moment either changes one. A setting whose template no longer
 * resolves reads as null here, and the card falls back to its count. The fresh-open
 * ladder clears the stale pointer for real the next time the tool opens.
 */
export function startWithName(gt: GalleryTemplates, toolId: string): string | null {
  const start = loadTemplateStart(gt.profile, toolId);
  if (!start) return null;
  if (start === START_BLANK) return t('Blank');
  const ref = parseTemplateRef(start, { toolId });
  if (ref?.kind === 'user') return gt.own.find(x => x.id === ref.id)?.name ?? null;
  if (ref?.kind === 'shipped') {
    return gt.toolById.get(ref.toolId)?.templates?.find(tp => tp.id === ref.id)?.name ?? null;
  }
  return null;
}

/** The card's quiet starting-point line: what it starts with, else how many there are. */
export function templateLine(gt: GalleryTemplates, tool: GalleryTool): string {
  const name = startWithName(gt, tool.id);
  if (name) return tRaw('Starts with {name}', { name });
  const n = shippedTemplatesOf(gt, tool).length + myTemplatesOf(gt, tool.id).length;
  return n === 0 ? '' : n === 1 ? t('1 template') : tRaw('{n} templates', { n });
}

/** Repaint one card's line in place after a "Start with" changes under the About dialog. */
export function refreshTemplateLine(gt: GalleryTemplates, toolId: string): void {
  const tool = gt.toolById.get(toolId);
  if (!tool) return;
  const sel = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(toolId) : toolId;
  const card = gt.root.querySelector<HTMLElement>(`.gtile[data-tool-id="${sel}"]`);
  const meta = card?.querySelector<HTMLElement>('.gtile-meta');
  if (!meta) return;
  const line = templateLine(gt, tool);
  let el = meta.querySelector<HTMLElement>('.gtile-tpl');
  if (!line) { el?.remove(); return; }
  if (!el) {
    el = document.createElement('span');
    el.className = 'gtile-tpl';
    meta.appendChild(el);
  }
  el.textContent = line;
}

/**
 * The About dialog's view of one tool, built at open time. `setStart` writes through the
 * shared handler (lib/template-actions.ts) and repaints the card behind the dialog.
 */
export function infoTemplates(gt: GalleryTemplates, toolId: string): InfoTemplates {
  const tool = gt.toolById.get(toolId);
  return {
    shipped: tool ? shippedTemplatesOf(gt, tool) : [],
    mine: myTemplatesOf(gt, toolId),
    start: () => loadTemplateStart(gt.profile, toolId),
    startName: () => startWithName(gt, toolId),
    async setStart(value) {
      const { setStartWith } = await import('../lib/template-actions.ts');
      await setStartWith(gt.host, toolId, value);
      refreshTemplateLine(gt, toolId);
    },
  };
}

/** One mount's arm of the animated template covers: re-armed on every full paint. */
export interface TemplateMotionHandle {
  /** Arm the motion previews in a freshly painted grid (a null grid arms nothing). */
  arm: (grid: HTMLElement | null) => void;
  destroy: () => void;
}

/**
 * Motion previews for the Design template covers (plans/155 WP-5.3). The preview code
 * and the template file reader are both lazy chunks, so an epoch counter says whether the
 * paint that asked for them is still the current one by the time they resolve.
 */
export function templateMotionPreviews(host: GalleryHost): TemplateMotionHandle {
  let cleanup: (() => void) | undefined;
  let epoch = 0;
  return {
    arm(grid) {
      cleanup?.();
      const mine = ++epoch;
      if (!grid?.querySelector('[data-motion-template]')) return;
      const root = grid;
      void Promise.all([import('../lib/template-motion-preview.ts'), import('./template-chooser.ts')]).then(([{ armTemplateMotion }, { fetchTemplateFile }]) => {
        if (!root.isConnected || mine !== epoch) return;
        cleanup = armTemplateMotion(root, { host, toolId: 'design', card: '[data-motion-template]', media: '.gcar-open',
          id: card => card.dataset.motionTemplate,
          async load(id) { const file = await fetchTemplateFile('design', id); return file?.motion ? { values: file.values, motion: file.motion } : null; },
        });
      });
    },
    destroy() { epoch++; cleanup?.(); },
  };
}

/**
 * The template side of a tool's search haystack. Search-only, like tags: a shipped
 * template this person hid drops out of it with the tile, and the templates they saved
 * themselves are in it, so "quarterly" finds Chart through their own Quarterly template.
 * A template's presets (plans/142) carry their names in too.
 */
export function templateSearchTerms(gt: GalleryTemplates, tool: GalleryTool): Array<string | undefined> {
  return [
    ...shippedTemplatesOf(gt, tool).flatMap(tp => [tp.name, tp.category, tp.description,
      ...(tp.presets ?? []).map(p => p.name)]),
    ...myTemplatesOf(gt, tool.id).flatMap(tp => [tp.name, tp.description]),
  ];
}
