// SPDX-License-Identifier: MPL-2.0
/** Theme group selection, deterministic set precedence and bounded transport parsing. */
import type { TokenDiagnostic, TokenResolveOptions, TokenSelection } from './bridge/host-v1.ts';
import { parseThemeGroups, describeAxes, groupLabel, type ThemeEntry } from './token-axes.ts';

type Rec = Record<string, unknown>;
const record = (v: unknown): v is Rec => !!v && typeof v === 'object' && !Array.isArray(v);

export function tokenSetNames(doc: unknown): string[] | null {
  if (!record(doc)) return null;
  const keys = Object.keys(doc).filter(k => !k.startsWith('$'));
  if (!keys.length) return null;
  if (Array.isArray(doc.$themes) && doc.$themes.length) return keys;
  const order = record(doc.$metadata) ? doc.$metadata.tokenSetOrder : null;
  return Array.isArray(order) && order.length && order.every(s => typeof s === 'string' && record(doc[s])) ? keys : null;
}

/**
 * Normalize source ids and compose one theme per group without changing the source.
 *
 * Precedence, per group:
 *   1. `opts.theme`, for the groups that declare an option with that id or name
 *      (or `group/id`, `group/name`). A theme picks one look and decides only
 *      the groups that declare that theme.
 *   2. The group's entry in `opts.selection` when a selection is given; otherwise
 *      its entry in the document's stored `$metadata.activeThemeSelection`. A given
 *      selection replaces the stored one whole, so a group it leaves out does not
 *      fall back to the stored choice.
 *   3. `$metadata.activeThemes`.
 *   4. The group's canonical option (plans/319): the one marked `canonical`, else
 *      the first. A group that marks none therefore draws its first option, as
 *      every group did before canonical marks existed.
 *
 * Before engine 1.262 a `theme` request also reset every group it did not name to
 * that group's first option, so `colors({ theme: 'light' })` silently dropped a
 * chosen colourway (plans/319). A theme that no group declares is reported and
 * changes nothing else.
 */
export function resolveTokenSelection(doc: unknown, opts: TokenResolveOptions = {}): TokenSelection {
  const d = record(doc) ? doc : {};
  const meta = record(d.$metadata) ? d.$metadata : {};
  const parsed = parseThemeGroups(d);
  const { groups } = parsed;
  const described = describeAxes(d, groups);
  const diagnostics: TokenDiagnostic[] = [...parsed.diagnostics, ...described.diagnostics];
  const issue = (message: string): void => { diagnostics.push({ code: 'selection', path: '', message }); };
  const stored = record(meta.activeThemeSelection) ? meta.activeThemeSelection : undefined;
  const requested = opts.selection ?? stored;
  const active = Array.isArray(meta.activeThemes) ? meta.activeThemes : [];
  const named = (options: ThemeEntry[], group: string, name: string): ThemeEntry[] =>
    options.filter(o => o.id === name || o.name === name || `${group}/${o.id}` === name || `${group}/${o.name}` === name);
  const defaults: string[] = [];
  const choices = new Map<string, string>();
  const enabled = new Set<string>();
  let themeFound = false;
  const axisOf = new Map(described.axes.map(a => [a.group, a]));
  for (const [group, options] of groups) {
    const byTheme = opts.theme ? named(options, group, opts.theme) : [];
    const wanted = requested && Object.hasOwn(requested, group) ? requested[group] : undefined;
    let matches: ThemeEntry[];
    if (byTheme.length) {
      matches = byTheme;
      themeFound = true;
    } else if (wanted !== undefined) {
      matches = options.filter(o => o.id === wanted);
      if (!matches.length) issue(`Unknown choice ${String(wanted)} in ${groupLabel(group)}.`);
    } else {
      matches = options.filter(o => active.includes(o.id) || active.includes(o.name) || active.includes(`${group}/${o.id}`) || active.includes(`${group}/${o.name}`));
    }
    if (matches.length > 1) issue(`Competing choices in ${groupLabel(group)}; the first is effective.`);
    const canonical = axisOf.get(group)?.canonical;
    const choice = matches[0] ?? options.find(o => o.id === canonical) ?? options[0]!;
    if (!matches.length) defaults.push(group);
    choices.set(group, choice.id);
    if (record(choice.raw.selectedTokenSets)) for (const [set, status] of Object.entries(choice.raw.selectedTokenSets)) {
      if (status && status !== 'disabled') enabled.add(set);
    }
  }
  if (opts.theme && !themeFound && groups.size) issue(`Unknown theme ${opts.theme}; the other choices are effective.`);
  if (requested) for (const group of Object.keys(requested)) if (!groups.has(group)) issue(`Unknown theme group ${group}.`);
  const keys = tokenSetNames(d) ?? [];
  for (const set of enabled) if (!keys.includes(set)) issue(`Selected set ${set} is missing.`);
  let sets = groups.size ? keys.filter(k => enabled.has(k)) : keys;
  if (!groups.size && Array.isArray(meta.activeSets) && meta.activeSets.length) sets = sets.filter(k => (meta.activeSets as unknown[]).includes(k));
  if (groups.size && !enabled.size) sets = keys;
  if (Array.isArray(meta.tokenSetOrder)) {
    const ordered = meta.tokenSetOrder.filter((s): s is string => typeof s === 'string' && sets.includes(s));
    sets = [...new Set([...ordered, ...sets])];
  }
  return {
    groups: [...groups].map(([id, options]) => {
      const axis = axisOf.get(id);
      return {
        id,
        options: options.map(({ id, name }) => ({ id, name })),
        ...(axis?.kind ? { kind: axis.kind } : {}),
        ...(axis ? { canonical: axis.canonical } : {}),
      };
    }),
    choices: Object.fromEntries(choices),
    defaults,
    sets,
    diagnostics,
  };
}

/** Stable cache/transport key; key insertion order never changes the meaning. */
export function tokenSelectionKey(opts: TokenResolveOptions = {}): string {
  return JSON.stringify([opts.theme ?? null, opts.selection ? Object.entries(opts.selection).sort(([a], [b]) => a.localeCompare(b, 'en')) : null]);
}

/** URL/CLI transport is JSON, bounded and validated before use. */
export function parseTokenSelection(value: string | null | undefined): Record<string, string> | undefined {
  if (!value) return undefined;
  if (value.length > 8192) throw new Error('Theme choices exceed the 8192 character limit.');
  const parsed: unknown = JSON.parse(value);
  if (!record(parsed) || Object.keys(parsed).length > 64 || Object.values(parsed).some(v => typeof v !== 'string' || v.length > 256)) throw new Error('Theme choices must be a JSON object with up to 64 group ids and theme ids.');
  return parsed as Record<string, string>;
}
