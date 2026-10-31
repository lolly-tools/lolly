// SPDX-License-Identifier: MPL-2.0
/**
 * Settings > Appearance: the colourway a person takes as theirs (plans/331).
 *
 * In many brands a department or a product has a colourway of its own. This row
 * lets a person choose theirs: the app's accent, favicon and logo tint follow it
 * on this device (brand-vars.ts chromeTokens), and each new piece of work starts
 * in it (lib/colourway-seed.ts). Work already made keeps its own colourway.
 *
 * The row IS the tool sidebar's colourway control (components/theme-choices.ts),
 * drawn over a port of its own, so the dots, the selection ring, the keyboard
 * model and the names are the same everywhere a colourway is chosen. Only the
 * words differ: the row is the person's ("Your colourway"), the tip says what the
 * choice changes, and the canonical colourway is named as the design system's
 * default. Choosing that one means following the design system, so
 * lib/colourway-pref.ts stores no choice then.
 *
 * The dots draw each colourway in the look the app is in now: the light look for
 * the Light theme, the dark look for Dark and Brand, the look the chrome reads
 * for each. Nothing is drawn for a design system with one colourway or none.
 */
import type { DocumentThemeGroup, DocumentThemePort } from '../lib/document-theme.ts';
import { documentThemeGroups } from '../lib/document-theme.ts';
import { colourwayAxis } from '../../../../engine/src/colourway.ts';
import { modeAxis, readTokenAxes } from '../../../../engine/src/token-axes.ts';
import { activeSystemId, personalColourway, setPersonalColourway, type ColourwayPrefHost } from '../lib/colourway-pref.ts';
import { mountThemeChoices, type ThemeChoices } from './theme-choices.ts';
import { t, tRaw } from '../i18n.ts';

/** The look the dots draw in. */
export type ColourwayLook = 'light' | 'dark';

/** The host slice the row reads: the person's choice, and the design system's document. */
export interface ColourwayPrefControlHost extends ColourwayPrefHost {
  tokens?: ColourwayPrefHost['tokens'] & {
    snapshot?(): Promise<{ document: unknown }>;
  };
}

/**
 * The one group the row draws: the design system's colourway group with `choice`
 * in force (the canonical colourway when the person chose none, or chose one the
 * design system no longer offers), each dot in `look`. Null when the design system
 * offers fewer than two colourways, which hides the row.
 */
export function colourwayPrefGroup(doc: unknown, choice: string | null, look: ColourwayLook): DocumentThemeGroup | null {
  const lead = colourwayAxis(doc);
  if (!lead || lead.options.length < 2) return null;
  const selection: Record<string, string> = {};
  const mode = modeAxis(readTokenAxes(doc).axes);
  const inLook = mode?.options.find((o) => o.id.toLowerCase() === look || o.name.trim().toLowerCase() === look);
  if (mode && inLook) selection[mode.group] = inLook.id;
  selection[lead.group] = choice && lead.options.some((o) => o.id === choice) ? choice : lead.canonical;
  const group = documentThemeGroups(doc, selection).find((g) => g.id === lead.group);
  if (!group) return null;
  return {
    ...group,
    label: t('Your colourway'),
    // tRaw, not t: the control escapes every label it draws, so an escaped name
    // here would show its entities.
    options: group.options.map((o) => (o.canonical ? { ...o, label: tRaw('{colourway} (design system default)', { colourway: o.label }) } : o)),
  };
}

export interface ColourwayPrefOpts {
  host: ColourwayPrefControlHost;
  /** The look the app is in now. */
  look(): ColourwayLook;
  /** Repaint the app's chrome once a choice is saved (brand-vars.ts applyChromeBrandVars). */
  repaint(): Promise<unknown>;
  /** Whether the design system offers a choice; the caller shows or hides the row. */
  onVisible?(visible: boolean): void;
  /** The chosen colourway's name, or null while the design system's own is in force. */
  onChange?(name: string | null): void;
}

export interface ColourwayPrefControl {
  /** Settles once the design system has been read and the row drawn. */
  ready: Promise<void>;
  /** Read the design system and the choice again, then draw. */
  refresh(): Promise<void>;
  destroy(): void;
}

/** The name the summary shows: the chosen colourway's own, or null for the canonical one. */
function chosenName(group: DocumentThemeGroup | null): string | null {
  const option = group?.options.find((o) => o.id === group.active);
  return option && !option.canonical ? option.label : null;
}

export function mountColourwayPref(el: HTMLElement, opts: ColourwayPrefOpts): ColourwayPrefControl {
  const { host } = opts;
  let doc: unknown = null;
  let system: string | null = null;
  let choice: string | null = null;
  let destroyed = false;
  const listeners = new Set<() => void>();
  const notify = (): void => { for (const listener of [...listeners]) listener(); };
  const group = (): DocumentThemeGroup | null => (doc ? colourwayPrefGroup(doc, choice, opts.look()) : null);

  const port: DocumentThemePort = {
    groups: () => { const g = group(); return g ? [g] : []; },
    async choose(_group, option) {
      const current = group();
      if (!current || !system || !current.options.some((o) => o.id === option)) return;
      // Choosing the design system's own colourway stores nothing: the person follows
      // the design system again, whatever it makes canonical later.
      choice = option === current.canonical ? null : option;
      await setPersonalColourway(host, system, choice);
      notify();
      opts.onChange?.(chosenName(group()));
      await opts.repaint().catch(() => { /* cosmetic: the choice is saved */ });
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };

  const control: ThemeChoices = mountThemeChoices(el, port, {
    onVisible: (visible) => opts.onVisible?.(visible),
    tip: t("This colourway sets the app's accent and is where new work starts. Work you have already made keeps its own."),
  });

  async function refresh(): Promise<void> {
    let nextDoc: unknown = null;
    try { nextDoc = (await host.tokens?.snapshot?.())?.document ?? null; } catch { nextDoc = null; }
    const nextSystem = await activeSystemId(host);
    const nextChoice = nextSystem ? await personalColourway(host, nextSystem) : null;
    if (destroyed) return;
    doc = nextDoc;
    system = nextSystem;
    choice = nextChoice;
    notify();
    opts.onChange?.(chosenName(group()));
  }

  // Another design system has its own colourways and its own choice; another look
  // draws every dot in that look's colours.
  const onRefresh = (): void => { void refresh(); };
  const onLook = (): void => { notify(); };
  window.addEventListener('lolly:design-system-changed', onRefresh);
  window.addEventListener('jelly-theme-change', onLook);

  return {
    ready: refresh(),
    refresh,
    destroy() {
      destroyed = true;
      listeners.clear();
      window.removeEventListener('lolly:design-system-changed', onRefresh);
      window.removeEventListener('jelly-theme-change', onLook);
      control.destroy();
    },
  };
}
