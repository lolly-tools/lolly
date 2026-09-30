// SPDX-License-Identifier: MPL-2.0
/** Theme group selection, deterministic set precedence and bounded transport parsing. */
import type { TokenDiagnostic, TokenResolveOptions, TokenSelection } from './bridge/host-v1.ts';

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

/** Normalize source ids and compose one theme per group without changing the source. */
export function resolveTokenSelection(doc: unknown, opts: TokenResolveOptions = {}): TokenSelection {
  const d = record(doc) ? doc : {};
  const meta = record(d.$metadata) ? d.$metadata : {};
  const diagnostics: TokenDiagnostic[] = [];
  const issue = (message: string): void => { diagnostics.push({ code: 'selection', path: '', message }); };
  const raw = Array.isArray(d.$themes) ? d.$themes : [];
  if (raw.length > 512) diagnostics.push({ code: 'limit', path: '', message: 'Only the first 512 themes were inspected.' });
  const groups = new Map<string, { id: string; name: string; raw: Rec }[]>();
  for (const t of raw.slice(0, 512)) {
    if (!record(t)) continue;
    const group = typeof t.group === 'string' ? t.group : '';
    const id = typeof t.id === 'string' ? t.id : typeof t.name === 'string' ? t.name : '';
    if (!id) { issue('A theme has no id or name.'); continue; }
    const list = groups.get(group) ?? [];
    if (list.some(o => o.id === id)) { issue(`Duplicate theme id ${id} in ${group || 'Themes'}.`); continue; }
    list.push({ id, name: typeof t.name === 'string' ? t.name : id, raw: t });
    groups.set(group, list);
  }
  const stored = record(meta.activeThemeSelection) ? meta.activeThemeSelection : undefined;
  const requested = opts.selection ?? (opts.theme ? undefined : stored);
  const active = Array.isArray(meta.activeThemes) ? meta.activeThemes : [];
  const defaults: string[] = [];
  const choices = new Map<string, string>();
  const enabled = new Set<string>();
  let legacyFound = false;
  for (const [group, options] of groups) {
    const wanted = requested && Object.hasOwn(requested, group) ? requested[group] : undefined;
    const matches = wanted !== undefined
      ? options.filter(o => o.id === wanted)
      : opts.theme
        ? options.filter(o => o.id === opts.theme || o.name === opts.theme || `${group}/${o.id}` === opts.theme || `${group}/${o.name}` === opts.theme)
        : options.filter(o => active.includes(o.id) || active.includes(o.name) || active.includes(`${group}/${o.id}`) || active.includes(`${group}/${o.name}`));
    if (matches.length > 1) issue(`Competing choices in ${group || 'Themes'}; the first is effective.`);
    if (wanted !== undefined && !matches.length) issue(`Unknown choice ${String(wanted)} in ${group || 'Themes'}.`);
    if (opts.theme && matches.length) legacyFound = true;
    const choice = matches[0] ?? options[0]!;
    if (!matches.length) defaults.push(group);
    choices.set(group, choice.id);
    if (record(choice.raw.selectedTokenSets)) for (const [set, status] of Object.entries(choice.raw.selectedTokenSets)) {
      if (status && status !== 'disabled') enabled.add(set);
    }
  }
  if (opts.theme && !legacyFound && groups.size) issue(`Unknown theme ${opts.theme}; defaults are effective.`);
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
  return { groups: [...groups].map(([id, options]) => ({ id, options: options.map(({ id, name }) => ({ id, name })) })), choices: Object.fromEntries(choices), defaults, sets, diagnostics };
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
