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
 *
 * ONE controller per mounted tool (plans/319 A4). The tool sidebar's Design system
 * section (components/theme-choices.ts) and the Design inspector's Document section
 * both draw from the same `DocumentThemeController`, created once by the tool view
 * (views/tool/stage-layout.ts), so a choice made in either is the choice both show.
 * A tool's manifest `tokenAxes` hides the groups it ignores from both, and so does
 * a group whose options all draw this tool the same (plans/319 decision 9): light
 * and dark appear only when the tool reads a colour that differs between them
 * (lib/theme-relevance.ts works out what the tool reads).
 */
import type { HostV1, TokenAxisKind, TokenSet, TokensSnapshot } from '@lolly-tools/core/host-v1';
import type { ToolTokenAxes } from '@lolly-tools/core';
import { parseTokenSelection, resolveTokenSelection } from '../../../../engine/src/token-selection.ts';
import { withTokenSelection } from '../../../../engine/src/token-context.ts';
import { createTokenSet } from '../../../../engine/src/tokens.ts';
import { effectiveAxisKinds, ignoredTokenAxes } from '../../../../engine/src/tool-token-axes.ts';
import { t } from '../i18n.ts';
import { isIframeMode } from './iframe-mode.ts';
import { routeParams, updateRouteParams } from './url-state.ts';
import { themeOptionLabel } from './theme-option-label.ts';
import { optionsChangeOutput, tokenUsageKey, type ToolTokenUsage } from './theme-relevance.ts';

export type ThemeSelection = Record<string, string>;

/** The colours a colourway gives in the look in force, as `#rrggbb`. */
export interface ThemeOptionSwatch {
  lead: string;
  partner: string | null;
}

/** One theme a group offers. `label` is what a person reads. */
export interface DocumentThemeOption {
  id: string;
  label: string;
  /** The option an artefact is drawn in when it chooses none. */
  canonical: boolean;
  /** A colourway's lead and partner, so a control can show the colour itself. */
  swatch?: ThemeOptionSwatch;
}

/** One theme group of the active design system, with the option in force. */
export interface DocumentThemeGroup {
  /** The group id (`''` for a design system whose themes declare no group). */
  id: string;
  label: string;
  /** What choosing changes: the declared kind, `mode` for the ungrouped light and
   *  dark group, or null for a group that says nothing about itself. */
  kind: TokenAxisKind | null;
  canonical: string;
  options: DocumentThemeOption[];
  active: string;
}

export interface DocumentThemeGroupOpts {
  /** The tool's manifest `tokenAxes`: a group of an ignored kind is not offered. */
  tokenAxes?: ToolTokenAxes | null;
  /** What the tool's output reads (lib/theme-relevance.ts). With it, a group whose
   *  options all resolve those reads the same is not offered, because switching it
   *  would change nothing the tool draws. Without it, every group is offered. */
  usage?: ToolTokenUsage | null;
}

/** The runtime surface a theme switch needs. `setTokenSelection` is optional so a
 *  runtime without it simply offers no control. */
export interface ThemeRuntime {
  readonly tokenSelection?: ThemeSelection;
  setTokenSelection?(selection: ThemeSelection): Promise<void>;
}

export { themeOptionLabel };

/** What a kind of group is called, in the person's language. */
export function themeKindLabel(kind: TokenAxisKind): string {
  switch (kind) {
    case 'mode': return t('Mode');
    case 'colourway': return t('Colourway');
    case 'expression': return t('Expression');
    case 'medium': return t('Medium');
    case 'contrast': return t('Contrast');
    case 'density': return t('Density');
    case 'campaign': return t('Campaign');
    case 'brand': return t('Brand');
  }
}

/** A group id as words: `brand-line` reads "Brand line". A design system's own name,
 *  so it is not translated. */
export function humanGroupId(id: string): string {
  const words = id.replace(/[-_./]+/g, ' ').replace(/\s+/g, ' ').trim();
  return words ? words[0]!.toUpperCase() + words.slice(1) : '';
}

const HEX = /^#[0-9a-f]{6}$/i;

/** The lead and partner one colourway gives, read from the token set it resolves to. */
function colourwaySwatch(set: TokenSet): ThemeOptionSwatch | undefined {
  const colours = set.colors();
  const read = (path: string): string | null => {
    const value = colours.find((s) => s.path === path)?.value;
    return typeof value === 'string' && HEX.test(value) ? value.toLowerCase() : null;
  };
  const lead = read('color.semantic.primary');
  return lead ? { lead, partner: read('color.semantic.secondary') } : undefined;
}

/**
 * The groups a document can switch between, with the option in force in each.
 * Only a group with more than one option is a choice, so a design system that
 * declares one theme (or none) gives an empty list and no control is drawn. A
 * group of a kind the tool ignores (`tokenAxes`) is left out as well, and so,
 * given the tool's `usage`, is a group whose options resolve everything the tool
 * reads to the same values, each with the other groups on their choice in force.
 *
 * Colourway groups come first, because choosing the lead is the choice people
 * make most; every other group keeps its authored order. Labels are for people:
 * the kind's name when the group declares one (and is the only group of that
 * kind), else the group id as words. A colourway's options carry the lead and
 * partner they give in the look in force.
 */
export function documentThemeGroups(doc: unknown, selection?: ThemeSelection, opts: DocumentThemeGroupOpts = {}): DocumentThemeGroup[] {
  const resolved = resolveTokenSelection(doc, selection ? { selection } : {});
  const kinds = effectiveAxisKinds(resolved.groups);
  const ignored = new Set(ignoredTokenAxes(resolved.groups, opts.tokenAxes).map((axis) => axis.group));
  const leadsFirst = (group: { id: string }): number => (kinds.get(group.id) === 'colourway' ? 0 : 1);
  // One token set per selection, shared by the swatches and the output check.
  const sets = new Map<string, TokenSet>();
  const setFor = (group: string, option: string): TokenSet => {
    const choices = { ...resolved.choices, [group]: option };
    const key = JSON.stringify(Object.entries(choices).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
    let set = sets.get(key);
    if (!set) { set = createTokenSet(doc, { selection: choices }); sets.set(key, set); }
    return set;
  };
  const usage = opts.usage ?? null;
  const offered = resolved.groups
    .filter((group) => group.options.length > 1 && !ignored.has(group.id))
    .filter((group) => !usage || optionsChangeOutput(group.options.map((o) => o.id), usage, (option) => setFor(group.id, option)))
    .sort((a, b) => leadsFirst(a) - leadsFirst(b));
  const perKind = new Map<TokenAxisKind, number>();
  for (const group of offered) {
    const kind = kinds.get(group.id);
    if (kind) perKind.set(kind, (perKind.get(kind) ?? 0) + 1);
  }
  return offered.map((group) => {
    const kind = kinds.get(group.id) ?? null;
    const canonical = group.canonical ?? group.options[0]!.id;
    const shared = kind ? (perKind.get(kind) ?? 0) > 1 : false;
    const label = kind && !(shared && group.id) ? themeKindLabel(kind) : humanGroupId(group.id) || t('Theme');
    return {
      id: group.id,
      label,
      kind,
      canonical,
      options: group.options.map((option) => {
        const swatch = kind === 'colourway' ? colourwaySwatch(setFor(group.id, option.id)) : undefined;
        return { id: option.id, label: themeOptionLabel(option.name), canonical: option.id === canonical, ...(swatch ? { swatch } : {}) };
      }),
      active: resolved.choices[group.id] ?? canonical,
    };
  });
}

/** The whole selection after choosing `option` in `group`: every other group keeps
 *  the option it shows now, so the result is explicit and survives a default change. */
export function withThemeChoice(groups: readonly Pick<DocumentThemeGroup, 'id' | 'active'>[], group: string, option: string): ThemeSelection {
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
  /**
   * Re-read whatever else in the shell latched a resolved colour when the tool
   * mounted (the colour field's swatches), from a host scoped to the new choice.
   * Cosmetic: a failure leaves the old swatches standing and never undoes the switch.
   */
  refresh?(host: HostV1): Promise<unknown>;
}

/** The event a switch announces on `window`, for a surface that keeps its own copy
 *  of a resolved colour (the export panel's palette). `detail` is the selection. */
export const DOCUMENT_THEME_EVENT = 'lolly:document-theme-changed';

/**
 * Switch the document to `selection`. The address is written first, so the token
 * bridge already answers in the new theme when the runtime repaints; a runtime that
 * refuses the change puts the address back. A runtime may apply a different
 * selection than it was handed (a tool's `tokenAxes` pins an ignored group to its
 * canonical option), and then the address, the canvas and the swatches follow what
 * it applied. Returns whether anything changed.
 */
export async function switchDocumentTheme(deps: ThemeSwitchDeps, selection: ThemeSelection): Promise<boolean> {
  const { runtime } = deps;
  if (typeof runtime.setTokenSelection !== 'function') return false;
  const before = runtime.tokenSelection;
  if (sameThemeSelection(before, selection)) return false;
  // An empty selection is the document going back to the design system's choices.
  deps.writeRoute(Object.keys(selection).length ? selection : null);
  try {
    await runtime.setTokenSelection(selection);
  } catch (error) {
    deps.writeRoute(before && Object.keys(before).length ? before : null);
    throw error;
  }
  const applied = runtime.tokenSelection ?? selection;
  if (!sameThemeSelection(applied, selection)) deps.writeRoute(Object.keys(applied).length ? applied : null);
  const themed = themedHost(deps.host, applied);
  const canvas = deps.canvas();
  if (canvas) await deps.paint(canvas, themed).catch(() => { /* cosmetic, as at mount */ });
  await deps.refresh?.(themed).catch(() => { /* cosmetic: the old swatches stay */ });
  if (typeof window !== 'undefined' && typeof CustomEvent === 'function') {
    window.dispatchEvent(new CustomEvent(DOCUMENT_THEME_EVENT, { detail: { ...applied } }));
  }
  deps.markDirty();
  return true;
}

/**
 * What the document draws with (plan 286 section 5.1): the design system's render
 * snapshot and the choices the document made itself. `selection` is absent while
 * the document follows the design system.
 */
export interface DocumentTokenContext {
  snapshot: TokensSnapshot;
  selection?: ThemeSelection;
}

/** What a surface that shows the theme choices is handed: the Design inspector's
 *  Document section and the tool sidebar's Design system section. */
export interface DocumentThemePort {
  /** The groups to draw, each with more than one option; empty draws nothing. */
  groups(): DocumentThemeGroup[];
  /** Choose `option` in `group`. Resolves once the canvas shows the new theme. */
  choose(group: string, option: string): Promise<void>;
  /** Hear every change to the groups or the choice, whichever surface made the change.
   *  Optional so a test port can leave it out. Returns the way to stop. */
  subscribe?(listener: () => void): () => void;
  /** The design-system context strip's data, or null before it is read or on a host with no snapshot. */
  context?(): DocumentTokenContext | null;
  /** Open the read-only token inspector on what the document draws with. */
  inspect?(): Promise<void>;
  /** Drop the document's own choices so it follows the design system again. */
  follow?(): Promise<void>;
}

export interface DocumentThemeController extends DocumentThemePort {
  /** Settles once the design system's themes have been read. */
  ready: Promise<void>;
  /** Read the themes again (after a design-system switch). */
  refresh(): Promise<void>;
  /** What the tool reads now (lib/theme-relevance.ts), after an edit linked or
   *  unlinked a colour. Surfaces are told only when the answer changes. */
  setUsage(usage: ToolTokenUsage | null): void;
  subscribe(listener: () => void): () => void;
  context(): DocumentTokenContext | null;
  inspect(): Promise<void>;
  follow(): Promise<void>;
  dispose(): void;
}

export interface DocumentThemeControllerDeps extends Omit<ThemeSwitchDeps, 'paint' | 'writeRoute'> {
  /** Repaint the surface that shows the choice. A second surface subscribes instead. */
  onChange?(): void;
  paint?: ThemeSwitchDeps['paint'];
  writeRoute?: ThemeSwitchDeps['writeRoute'];
  /** The design system's token document. Defaults to the host's render snapshot. */
  readDocument?(): Promise<unknown>;
  /** The render snapshot the context strip reads. Defaults to the host's own. */
  readSnapshot?(): Promise<TokensSnapshot | null>;
  /** Open the read-only token inspector over `host`. Defaults to the shared inspector modal. */
  openInspector?(host: HostV1, current: () => boolean): Promise<void>;
  /** The tool's manifest `tokenAxes`; a group of an ignored kind is never offered. */
  tokenAxes?: ToolTokenAxes | null;
  /** What the tool reads when it mounts, until `setUsage` says otherwise. Absent offers every group. */
  usage?: ToolTokenUsage | null;
}

/** The selection the document chose itself, or undefined while it follows the design system. */
const ownSelection = (runtime: ThemeRuntime): ThemeSelection | undefined =>
  runtime.tokenSelection && Object.keys(runtime.tokenSelection).length ? structuredClone(runtime.tokenSelection) : undefined;

/**
 * The state behind the theme controls: the declared themes, read once and again on
 * a design-system switch, and the choices, applied one at a time in the order they
 * were made so two quick presses cannot land out of order. Every surface that shows
 * the choice subscribes to this one object, so none can show a choice the others
 * do not.
 *
 * It also holds the design-system context the Document section's strip shows. Every
 * write here goes to the document (runtime, address, canvas, session) and never to
 * the design system: the inspector it opens is read-only.
 */
export function createDocumentThemeController(deps: DocumentThemeControllerDeps): DocumentThemeController {
  let doc: unknown = null;
  let snapshot: TokensSnapshot | null = null;
  let disposed = false;
  let queue: Promise<unknown> = Promise.resolve();
  const listeners = new Set<() => void>();
  if (deps.onChange) listeners.add(deps.onChange);
  const notify = (): void => {
    for (const listener of [...listeners]) {
      try { listener(); } catch (error) { console.warn('[theme] a surface could not show the change:', error); }
    }
  };
  const readSnapshot = deps.readSnapshot ?? (async () => (await deps.host.tokens?.snapshot?.()) ?? null);
  const openInspector = deps.openInspector ?? (async (host: HostV1, current: () => boolean) => {
    const { openTokenInspector } = await import('../components/token-workspace.ts');
    await openTokenInspector(host, undefined, current);
  });
  const paint = deps.paint ?? (async (el: HTMLElement, host: HostV1) => {
    const { applyBrandVars } = await import('../brand-vars.ts');
    return applyBrandVars(el, host);
  });
  const switchDeps: ThemeSwitchDeps = { ...deps, paint, writeRoute: deps.writeRoute ?? writeThemesRoute };
  const supported = (): boolean => typeof deps.runtime.setTokenSelection === 'function';

  // Resolving the groups reads the whole token document once per option, and the
  // inspector asks on every sync, so the answer is kept until the document, the
  // selection or what the tool reads changes.
  let usage: ToolTokenUsage | null = deps.usage ?? null;
  let memo: { doc: unknown; key: string; usage: ToolTokenUsage | null; groups: DocumentThemeGroup[] } | null = null;
  const groups = (): DocumentThemeGroup[] => {
    if (!doc || !supported()) return [];
    const selection = deps.runtime.tokenSelection;
    const key = JSON.stringify(selection ? Object.entries(selection).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)) : null);
    if (memo && memo.doc === doc && memo.key === key && memo.usage === usage) return memo.groups;
    const next = documentThemeGroups(doc, selection, { tokenAxes: deps.tokenAxes ?? null, usage });
    memo = { doc, key, usage, groups: next };
    return next;
  };

  async function refresh(): Promise<void> {
    let nextSnapshot: TokensSnapshot | null = null;
    let next: unknown = null;
    try { nextSnapshot = await readSnapshot(); } catch { nextSnapshot = null; }
    try { next = deps.readDocument ? await deps.readDocument() : nextSnapshot?.document ?? null; } catch { next = null; }
    if (disposed) return;
    snapshot = nextSnapshot;
    doc = next;
    memo = null;
    notify();
  }
  const ready = refresh();
  const onSystemChange = (): void => { void refresh(); };
  if (typeof window !== 'undefined') window.addEventListener('lolly:design-system-changed', onSystemChange);

  /** Run one switch after the ones before it, then tell every surface. Going back to
   *  the design system's choices reads the design system again: the snapshot read
   *  while the document had choices of its own carries those choices, not the system's. */
  const enqueue = (next: () => ThemeSelection | null): Promise<void> => {
    const run = queue.then(async () => {
      if (disposed) return;
      const selection = next();
      if (!selection) return;
      await switchDocumentTheme(switchDeps, selection);
      if (disposed) return;
      if (Object.keys(selection).length) notify(); else await refresh();
    });
    queue = run.catch(() => { /* the caller hears about it; the queue keeps going */ });
    return run;
  };

  return {
    ready,
    refresh,
    groups,
    setUsage(next) {
      if (disposed || tokenUsageKey(next) === tokenUsageKey(usage)) return;
      usage = next;
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    choose(group, option) {
      return enqueue(() => {
        if (!doc) return null;
        const current = groups();
        if (!current.some((g) => g.id === group && g.options.some((o) => o.id === option))) return null;
        // Every group with a choice stays explicit, offered or not: a group hidden
        // because it changes nothing in this tool keeps the option it is on, so a
        // dark document stays dark in the link and the session. A group the tool
        // ignores stays on its canonical option, so the runtime has nothing to pin back.
        const all = resolveTokenSelection(doc, deps.runtime.tokenSelection ? { selection: deps.runtime.tokenSelection } : {});
        const choosable = all.groups.filter((g) => g.options.length > 1)
          .map((g) => ({ id: g.id, active: all.choices[g.id] ?? g.canonical ?? g.options[0]!.id }));
        const next = withThemeChoice(choosable, group, option);
        for (const axis of ignoredTokenAxes(all.groups, deps.tokenAxes)) next[axis.group] = axis.canonical;
        return next;
      });
    },
    context() {
      if (!snapshot) return null;
      const selection = ownSelection(deps.runtime);
      return selection ? { snapshot, selection } : { snapshot };
    },
    async inspect() {
      // Scoped to the document's choices, so the inspector opens on what the canvas shows.
      await openInspector(themedHost(deps.host, ownSelection(deps.runtime)), () => !disposed);
    },
    follow() {
      return enqueue(() => (supported() && ownSelection(deps.runtime) ? {} : null));
    },
    dispose() {
      disposed = true;
      listeners.clear();
      if (typeof window !== 'undefined') window.removeEventListener('lolly:design-system-changed', onSystemChange);
    },
  };
}
