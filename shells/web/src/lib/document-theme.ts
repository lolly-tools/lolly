// SPDX-License-Identifier: MPL-2.0
/**
 * The theme a DOCUMENT is shown in (plan 291 W4): Light, Dark, or any other theme
 * the active design system declares.
 *
 * One choice, four places that must agree, and this module is the only writer of
 * all four:
 *
 *  1. the runtime. `Runtime.setTokenSelection` re-scopes the document's token reads
 *     and re-resolves every linked colour (`tokenLinks`) under the new theme;
 *  2. the route. `_themes` in the address scopes the web token bridge, so every
 *     surface that reads the unscoped host (the colour picker's swatches, the
 *     brand rooms) follows, and a copied link opens on the same theme;
 *  3. the canvas CSS variables (`--brand-*`, `--brand-token-*`). They are painted
 *     from a host scoped by the SAME selection the runtime holds, so a colour
 *     written in the var() form follows too, whatever form the address is in;
 *  4. the saved session. `__tokenSelection` is read from `runtime.tokenSelection`
 *     by the session snapshot, so the choice only has to mark the session dirty.
 *
 * A theme is document state, not a chrome preference: the app's own light and dark
 * (components/theme-toggle.ts) is a separate setting, never read here.
 */
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { parseTokenSelection, resolveTokenSelection } from '../../../../engine/src/token-selection.ts';
import { withTokenSelection } from '../../../../engine/src/token-context.ts';
import { t } from '../i18n.ts';
import { isIframeMode } from './iframe-mode.ts';
import { routeParams, updateRouteParams } from './url-state.ts';

export type ThemeSelection = Record<string, string>;

/** One theme a group offers. `label` is what a person reads. */
export interface DocumentThemeOption {
  id: string;
  label: string;
}

/** One theme group of the active design system, with the option in force. */
export interface DocumentThemeGroup {
  /** The group id (`''` for a design system whose themes declare no group). */
  id: string;
  label: string;
  options: DocumentThemeOption[];
  active: string;
}

/** The runtime surface a theme switch needs. `setTokenSelection` is optional so a
 *  runtime without it simply offers no control. */
export interface ThemeRuntime {
  readonly tokenSelection?: ThemeSelection;
  setTokenSelection?(selection: ThemeSelection): Promise<void>;
}

/** Light and dark, the themes every shipped pack declares, read in the person's
 *  language; any other theme keeps the design system's own label. */
export function themeOptionLabel(name: string): string {
  const key = name.trim().toLowerCase();
  if (key === 'light') return t('Light');
  if (key === 'dark') return t('Dark');
  return name;
}

/**
 * The groups a document can switch between, with the option in force in each.
 * Only a group with more than one option is a choice, so a design system that
 * declares one theme (or none) gives an empty list and no control is drawn.
 */
export function documentThemeGroups(doc: unknown, selection?: ThemeSelection): DocumentThemeGroup[] {
  const resolved = resolveTokenSelection(doc, selection ? { selection } : {});
  return resolved.groups
    .filter((group) => group.options.length > 1)
    .map((group) => ({
      id: group.id,
      label: group.id || t('Theme'),
      options: group.options.map((option) => ({ id: option.id, label: themeOptionLabel(option.name) })),
      active: resolved.choices[group.id] ?? group.options[0]!.id,
    }));
}

/** The whole selection after choosing `option` in `group`: every other group keeps
 *  the option it shows now, so the result is explicit and survives a default change. */
export function withThemeChoice(groups: readonly DocumentThemeGroup[], group: string, option: string): ThemeSelection {
  const next: ThemeSelection = {};
  for (const g of groups) next[g.id] = g.active;
  next[group] = option;
  return next;
}

/** Two selections name the same themes, whatever their key order. */
export function sameThemeSelection(a: ThemeSelection | undefined, b: ThemeSelection | undefined): boolean {
  const ka = Object.keys(a ?? {}), kb = Object.keys(b ?? {});
  return ka.length === kb.length && ka.every((key) => Object.hasOwn(b ?? {}, key) && a![key] === b![key]);
}

/** A host whose token reads are scoped to `selection`; the host itself without one. */
export function themedHost(host: HostV1, selection: ThemeSelection | undefined): HostV1 {
  return selection && Object.keys(selection).length ? withTokenSelection(host, selection) : host;
}

/**
 * A host whose token and asset reads follow the runtime's selection at the time of
 * each read. `themedHost` fixes the selection when it is called, which suits one
 * repaint; a surface built once and kept across switches (the Design inspector's
 * Token links) needs this one, or a link made after a switch stores the colour of
 * the theme the document opened in.
 */
export function liveThemedHost(host: HostV1, runtime: { readonly tokenSelection?: ThemeSelection }): HostV1 {
  if (!host.tokens && !host.assets) return host;
  const current = (): HostV1 => themedHost(host, runtime.tokenSelection);
  const live: HostV1 = { ...host };
  if (host.tokens) {
    // Every read goes to the host scoped to the current theme, and a method runs on that host.
    const base = host.tokens;
    live.tokens = new Proxy(base, {
      get: (_target, key) => {
        const now = current().tokens ?? base;
        const value: unknown = Reflect.get(now, key);
        return typeof value === 'function' ? (...args: unknown[]) => Reflect.apply(value, now, args) : value;
      },
    });
  }
  if (host.assets) {
    const assets = host.assets;
    live.assets = { ...assets, get: (id, opts) => current().assets.get(id, opts) };
  }
  return live;
}

/** Write `_themes` into the address. A framed tool never rewrites its address. */
export function writeThemesRoute(selection: ThemeSelection | null): void {
  if (isIframeMode()) return;
  updateRouteParams({ _themes: selection ? JSON.stringify(selection) : null });
}

/** The `_themes` the address carries now, or undefined when it has none or it is unreadable. */
export function readThemesRoute(read: () => string | null = () => routeParams().get('_themes')): ThemeSelection | undefined {
  try { return parseTokenSelection(read()); } catch { return undefined; }
}

/**
 * Put the document's selection in the address when the address disagrees. A saved
 * session carries `__tokenSelection` and its slot link does not, so without this a
 * reopened dark document drew dark linked colours on a light token bridge.
 * Returns whether the address was written.
 */
export function syncThemesRoute(
  selection: ThemeSelection | undefined,
  io: { read?: () => string | null; write?: (selection: ThemeSelection) => void } = {},
): boolean {
  if (!selection || !Object.keys(selection).length) return false;
  if (sameThemeSelection(readThemesRoute(io.read), selection)) return false;
  (io.write ?? writeThemesRoute)(selection);
  return true;
}

export interface ThemeSwitchDeps {
  runtime: ThemeRuntime;
  /** The shell's own (unscoped) host. */
  host: HostV1;
  /** The element the canvas CSS variables are painted on, when one is mounted. */
  canvas(): HTMLElement | null;
  /** Repaint the canvas CSS variables from a host (brand-vars.ts `applyBrandVars`). */
  paint(el: HTMLElement, host: HostV1): Promise<unknown>;
  writeRoute(selection: ThemeSelection | null): void;
  /** The choice is document state: the session has an unsaved change now. */
  markDirty(): void;
}

/**
 * Switch the document to `selection`. The address is written first, so the token
 * bridge already answers in the new theme when the runtime repaints; a runtime that
 * refuses the change puts the address back. Returns whether anything changed.
 */
export async function switchDocumentTheme(deps: ThemeSwitchDeps, selection: ThemeSelection): Promise<boolean> {
  const { runtime } = deps;
  if (typeof runtime.setTokenSelection !== 'function') return false;
  const before = runtime.tokenSelection;
  if (sameThemeSelection(before, selection)) return false;
  deps.writeRoute(selection);
  try {
    await runtime.setTokenSelection(selection);
  } catch (error) {
    deps.writeRoute(before && Object.keys(before).length ? before : null);
    throw error;
  }
  const canvas = deps.canvas();
  if (canvas) await deps.paint(canvas, themedHost(deps.host, selection)).catch(() => { /* cosmetic, as at mount */ });
  deps.markDirty();
  return true;
}

/** What the Design inspector's Document section is handed (views/design-inspector.ts). */
export interface DocumentThemePort {
  /** The groups to draw, each with more than one option; empty draws nothing. */
  groups(): DocumentThemeGroup[];
  /** Choose `option` in `group`. Resolves once the canvas shows the new theme. */
  choose(group: string, option: string): Promise<void>;
}

export interface DocumentThemeController extends DocumentThemePort {
  /** Settles once the design system's themes have been read. */
  ready: Promise<void>;
  /** Read the themes again (after a design-system switch). */
  refresh(): Promise<void>;
  dispose(): void;
}

export interface DocumentThemeControllerDeps extends Omit<ThemeSwitchDeps, 'paint' | 'writeRoute'> {
  /** Repaint the surface that shows the choice (the inspector's `sync`). */
  onChange(): void;
  paint?: ThemeSwitchDeps['paint'];
  writeRoute?: ThemeSwitchDeps['writeRoute'];
  /** The design system's token document. Defaults to the host's render snapshot. */
  readDocument?(): Promise<unknown>;
}

/**
 * The state behind the theme control: the declared themes, read once and again on
 * a design-system switch, and the choices, applied one at a time in the order they
 * were made so two quick presses cannot land out of order.
 */
export function createDocumentThemeController(deps: DocumentThemeControllerDeps): DocumentThemeController {
  let doc: unknown = null;
  let disposed = false;
  let queue: Promise<unknown> = Promise.resolve();
  const readDocument = deps.readDocument ?? (async () => {
    const snapshot = await deps.host.tokens?.snapshot?.();
    return snapshot?.document ?? null;
  });
  const paint = deps.paint ?? (async (el: HTMLElement, host: HostV1) => {
    const { applyBrandVars } = await import('../brand-vars.ts');
    return applyBrandVars(el, host);
  });
  const switchDeps: ThemeSwitchDeps = { ...deps, paint, writeRoute: deps.writeRoute ?? writeThemesRoute };
  const supported = (): boolean => typeof deps.runtime.setTokenSelection === 'function';

  async function refresh(): Promise<void> {
    let next: unknown = null;
    try { next = await readDocument(); } catch { next = null; }
    if (disposed) return;
    doc = next;
    deps.onChange();
  }
  const ready = refresh();
  const onSystemChange = (): void => { void refresh(); };
  if (typeof window !== 'undefined') window.addEventListener('lolly:design-system-changed', onSystemChange);

  const groups = (): DocumentThemeGroup[] => (doc && supported() ? documentThemeGroups(doc, deps.runtime.tokenSelection) : []);

  return {
    ready,
    refresh,
    groups,
    choose(group, option) {
      const run = queue.then(async () => {
        if (disposed) return;
        const current = groups();
        if (!current.some((g) => g.id === group && g.options.some((o) => o.id === option))) return;
        await switchDocumentTheme(switchDeps, withThemeChoice(current, group, option));
        if (!disposed) deps.onChange();
      });
      queue = run.catch(() => { /* the caller hears about it; the queue keeps going */ });
      return run;
    },
    dispose() {
      disposed = true;
      if (typeof window !== 'undefined') window.removeEventListener('lolly:design-system-changed', onSystemChange);
    },
  };
}
