// SPDX-License-Identifier: MPL-2.0
/**
 * The view-side wiring for the Projects Templates collection (plans/226 section 4.3).
 *
 * views/projects-templates.ts owns the collection itself (its model, tiles, menu and
 * every mutation). This file is the glue that used to sit inside mountProjects: the
 * doors into the collection (the root tile, the rail chip), what a selection it can act
 * on offers, and the add-picker's blank-or-a-template step. Each piece takes what
 * it needs as an argument, so views/projects.ts calls it in a line or two and the
 * closure carries no template state of its own.
 */
import { t, tRaw } from '../i18n.ts';
import { escape as escapeHtml } from '../utils.ts';
import { icon } from '../lib/icons.ts';
import { announce } from '../a11y.ts';
import { choiceDialog, promptDialog } from '../components/confirm-dialog.ts';
import { showUndoToast } from '../lib/undo-toast.ts';
import { getTool } from '../bridge/tool-loader.ts';
import { actionTile } from '../folder-tiles.ts';
import {
  ADD_SEED_BLANK, TEMPLATES, createTemplatesCollection,
  type SessionSaveSource, type TemplateItem, type TemplatesCollection, type TemplatesToolInfo,
} from './projects-templates.ts';
import type { CollectTemplates } from './picker-templates.ts';
import type { BulkBarConfig } from '../lib/bulk-bar.ts';
import type { TemplateActionHost } from '../lib/template-actions.ts';
import type { Profile } from '@lolly-tools/core/host-v1';

const TEMPLATE_ICON = icon('layersStack', { strokeWidth: 1.8 });
// Hide / Restore a SHIPPED template (plans/226): the only removal a client can honestly do
// to catalog content, so it wears the eye, not the bin.
const HIDE_ICON = icon('eyeOff', { strokeWidth: 1.9 });
const SHOW_ICON = icon('eye', { strokeWidth: 1.9 });

/** What the view lends the collection that only the view can answer. */
export interface TemplatesViewDeps {
  /** The mount's raw route query, for the `?tool=` pre-filter. */
  params: string;
  toolName(id: string): string;
  isSelected(ref: string): boolean;
  isMounted(): boolean;
  confirm(opts: { title: string; message: string; confirmLabel?: string }): Promise<boolean>;
  /** Reload the view's data and repaint. */
  refresh(): Promise<void>;
}

/**
 * Build the collection for one mount. Everything the shell already owns (the catalog
 * index, the live region, the name prompt, the undo toast, a tool manifest, a stored
 * session) is wired here, so the view hands over only its own six answers.
 */
export function templatesCollectionFor(host: TemplateActionHost, view: TemplatesViewDeps): TemplatesCollection {
  const w = window as typeof window & { __toolIndex?: { tools?: TemplatesToolInfo[] } };
  return createTemplatesCollection({
    host,
    toolIndex: () => w.__toolIndex?.tools ?? [],
    toolName: (id) => view.toolName(id),
    params: view.params,
    isSelected: (ref) => view.isSelected(ref),
    announce,
    toast: (message, actionLabel, action) => { showUndoToast({ message, actionLabel, undo: action }); },
    prompt: (o) => promptDialog(o),
    confirm: (o) => view.confirm(o),
    refresh: () => view.refresh(),
    isMounted: () => view.isMounted(),
    // A stored session is a bag of input values plus `__`-prefixed markers, which is what
    // the collection reads it as; the base state type says only that it is an object.
    loadSession: (slot) => host.state.load(slot).then(data => data as Record<string, unknown> | null),
    loadManifest: (toolId) => getTool(toolId).then(loaded => loaded.manifest).catch(() => ({ inputs: [] })),
  });
}

/**
 * The root grid's door into the collection, built by the SAME builder as New folder and
 * New asset (plans/245), so the three read as one row of actions instead of one cover
 * tile beside two icon tiles. It navigates rather than creating, so it is never a drop
 * target, and it holds no items of its own to count.
 */
export function templatesRootTile(): string {
  return actionTile('templates', TEMPLATE_ICON, t('Templates'), t('Starting points'), {
    nav: TEMPLATES,
    openLabel: t('Open Templates'),
    cols: { kind: t('Templates'), count: '', when: '' },
  });
}

/**
 * The same door at the end of a folder's rail, as a NAVIGATION chip only: no
 * data-drop-folder, so nothing can be dropped into it (a template is not a file you
 * file). Always present, so the collection is reachable from every folder.
 */
export function templatesRailChip(): string {
  return `<button type="button" class="projects-chip projects-chip--nav" data-open-folder-nav="${escapeHtml(TEMPLATES)}" title="${escapeHtml(t('Starting points you saved, and the ones that shipped with each tool.'))}">${t('Templates')}</button>`;
}

/**
 * The rows a template selection contributes to the shared selection bar, in two groups so
 * the view can place each one: "Save as a template..." sits beside Duplicate (it acts on
 * SESSIONS), and Hide / Restore replace the file actions that stand down.
 */
export function templateBulkRows(gates: {
  templatable(): boolean;
  kinds(): { hide: boolean; restore: boolean; delete: boolean };
}): { save: BulkBarConfig['actions']; overlay: BulkBarConfig['actions'] } {
  return {
    save: [{ id: 'save-templates', icon: TEMPLATE_ICON, label: () => t('Save as a template…'), title: () => t('Keep the settings of each selected project as a starting point'), hidden: () => !gates.templatable() }],
    overlay: [
      { id: 'hide', icon: HIDE_ICON, label: () => t('Hide'), hidden: () => !gates.kinds().hide },
      { id: 'restore', icon: SHOW_ICON, label: () => t('Restore'), hidden: () => !gates.kinds().restore },
    ],
  };
}

/** A saved session as the collection reads it for "Save as a template...". */
export function templateSessionSource(
  entry: { toolId?: string; label?: string | null; filename?: string | null } | undefined,
  slot: string,
  toolName: (id: string) => string,
): SessionSaveSource {
  return { slot, toolId: entry?.toolId || '', label: entry?.label || entry?.filename || toolName(entry?.toolId || '') };
}

/**
 * The new-asset picker's Templates tab source (plans/245 scope 3). One template-picking
 * surface: the list is the collection's own `pickable()`, so the tab shows exactly what
 * `#/p/__templates__` shows, and a pick reuses the collection's two actions - open the
 * tool seeded from the template, or file a project from it without opening the editor.
 * The collection is loaded here on demand, because the Projects root never needs it
 * until this tab asks.
 */
export function templatePickerSource(
  tpl: TemplatesCollection,
  profile: Profile | null,
  view: { open(item: TemplateItem): void; add(item: TemplateItem): Promise<boolean> },
): CollectTemplates {
  const byRef = new Map<string, TemplateItem>();
  return {
    list: async () => {
      await tpl.load(profile);
      const items = tpl.pickable();
      byRef.clear();
      for (const item of items) byRef.set(item.ref, item);
      return items.map(item => ({
        ref: item.ref, name: item.name, toolId: item.toolId,
        toolName: item.toolName, own: item.own, description: item.description,
      }));
    },
    onOpen: (ref) => { const item = byRef.get(ref); if (item) view.open(item); },
    onQuickAdd: async (ref) => {
      const item = byRef.get(ref);
      return item ? { ok: await view.add(item) } : { ok: false };
    },
  };
}

/** The add-picker's answer: the seed values to open with, or a silent cancel. */
export interface AddSeedPick { cancelled: boolean; values?: Record<string, unknown> }

/**
 * Quick-add intermediate step: when a tool has at least one template (shipped or the
 * person's own, minus the hidden ones) offer a tiny chooser (blank, or one of them) and
 * return the seed values to hand addDefaultSession. The tool's "Start with" leads the
 * list and is preselected, so quick-add agrees with what a blank open of that tool does.
 * A tool with NOTHING to choose resolves straight to the default, no extra step, exactly
 * as before. `cancelled` is true only when the chooser was actually shown and dismissed,
 * so the caller can stay silent instead of flashing a failure.
 */
export async function chooseAddSeed(
  tpl: TemplatesCollection,
  toolId: string,
  profile: Profile | null,
  view: { toolName(id: string): string; closeMenu(): void },
): Promise<AddSeedPick> {
  const choices = await tpl.addSeedChoices(toolId, profile);
  if (choices.length < 2) return { cancelled: false };   // only "Blank" so take the default
  view.closeMenu();
  const chosen = await choiceDialog({
    title: tRaw('Add {tool}', { tool: view.toolName(toolId) }),
    message: t('Start blank, or from a template.'),
    choices,
  });
  if (chosen === null) return { cancelled: true };           // Cancel / Escape / backdrop
  if (chosen === ADD_SEED_BLANK) return { cancelled: false }; // resolved defaults
  return { cancelled: false, values: await tpl.seedForRef(chosen, toolId) };
}
