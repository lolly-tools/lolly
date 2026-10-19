// SPDX-License-Identifier: MPL-2.0
/** Document-scoped token reads, captured snapshots and the family of leads. */
import type { HostV1, TokenAxisInfo, TokenFamilyMember, TokenResolveOptions, TokenSet } from './bridge/host-v1.ts';
import { resolveTokenSelection } from './token-selection.ts';
import { readTokenAxes } from './token-axes.ts';
import { colourwayAxis, canonicalFirst } from './colourway.ts';
import { createTokenSet } from './tokens.ts';

/**
 * A document's choices under a tool's own read options. An explicit `selection`
 * replaces the document's choices. A `theme` (`colors({ theme: 'light' })`) keeps
 * them: the resolver lets the theme decide only the groups it names, so a hook
 * that asks for light still gets the document's colourway (plans/319). Before
 * engine 1.265 a theme call dropped the document's choices altogether.
 */
export function scopedTokenOptions(selection: Record<string, string> | undefined, opts: TokenResolveOptions = {}): TokenResolveOptions {
  if (opts.selection !== undefined || selection === undefined) return opts;
  return { ...opts, selection };
}

/** A document's choices scope token reads without changing the shell's active system. */
export function withTokenSelection(host: HostV1, selection: Record<string, string>): HostV1 {
  if (!host.tokens) return host.assets ? { ...host, assets: withAssetSelection(host.assets, selection) } : host;
  const base = host.tokens, choices = structuredClone(selection);
  return { ...host, ...(host.assets ? { assets: withAssetSelection(host.assets, choices) } : {}), tokens: {
    ...base,
    get: (opts = {}) => base.get(scopedTokenOptions(choices, opts)),
    colors: (opts = {}) => base.colors(scopedTokenOptions(choices, opts)),
    resolve: (ref, opts = {}) => base.resolve(ref, scopedTokenOptions(choices, opts)),
    ...(base.inspect ? { inspect: (opts = {}) => base.inspect!(scopedTokenOptions(choices, opts)) } : {}),
    // The family follows the document's look, and its `active` member is the
    // document's colourway, so it is scoped like every other read. `axes()` is
    // structure and has no options to scope.
    ...(base.family ? { family: (role?: string, opts: TokenResolveOptions = {}) => base.family!(role, scopedTokenOptions(choices, opts)) } : {}),
    ...(base.snapshot ? { snapshot: async () => {
      const snapshot = await base.snapshot!();
      const scoped = (source: unknown): unknown => {
        const document = structuredClone(source);
        if (document && typeof document === 'object' && !Array.isArray(document)) {
          const d = document as Record<string, unknown>;
          d.$metadata = { ...(d.$metadata as object ?? {}), activeThemeSelection: choices };
        }
        return document;
      };
      const document = scoped(snapshot.document);
      return { ...snapshot, document, ...(snapshot.renderDocument !== undefined ? { renderDocument: scoped(snapshot.renderDocument) } : {}), selection: { ...snapshot.selection, choices: resolveTokenSelection(document, { selection: choices }).choices } };
    } } : {}),
  } };
}

/**
 * Asset reads that carry the document's theme choice (plan 291 W7), so a photo look
 * with theme variants bakes the variant of that theme. Every other member is the
 * host's own, copied the way the shells' own asset wrappers copy the asset bridge.
 */
function withAssetSelection(assets: HostV1['assets'], selection: Record<string, string>): HostV1['assets'] {
  const choices = structuredClone(selection);
  return { ...assets, get: (id, opts) => assets.get(id, { ...opts, tokenSelection: choices }) };
}

// ─── The family of leads (plans/319, milestone A5) ───────────────────────────

/** The longest role a family read accepts: a slot name or a dotted token path. */
const MAX_ROLE_LENGTH = 256;

/** The most `--brand-lead-<n>` variables a canvas carries. A family longer than this paints its first leads. */
export const MAX_LEAD_VARS = 16;

/**
 * Every theme group of a document with what it means, for `host.tokens.axes()`.
 * A copy: a caller that edits the answer cannot change what the next read sees.
 */
export function tokenAxesOf(doc: unknown): TokenAxisInfo[] {
  return readTokenAxes(doc).axes.map(axis => ({
    group: axis.group,
    kind: axis.kind,
    canonical: axis.canonical,
    rotation: axis.rotation,
    options: axis.options.map(o => ({ id: o.id, name: o.name, canonical: o.canonical, ...(o.window ? { window: { ...o.window } } : {}) })),
  }));
}

/**
 * The family for `host.tokens.family(role, opts)`: every colourway's colour for
 * one role, canonical first, in the look `opts` resolves to (the document's
 * choices, a `theme`, or a replacing `selection`, exactly as `get()` reads them).
 * Each member is resolved with the read's own choices and its colourway set in the
 * colourway group, so a member differs from the read only in its lead.
 *
 * `setFor` returns the token set for one explicit selection. A shell passes its
 * own memoised reader so a family read shares the per-selection cache that
 * `get()` and `colors()` fill; the default builds a fresh set.
 *
 * An empty list when the document has no colourway group or `role` is not a
 * usable name. A colourway whose role does not resolve to a colour is left out,
 * as `colourwayFamily` leaves it out.
 */
export async function tokenFamily(
  doc: unknown,
  role: unknown = 'primary',
  opts: TokenResolveOptions = {},
  setFor: (opts: TokenResolveOptions) => TokenSet | Promise<TokenSet> = o => createTokenSet(doc, o),
): Promise<TokenFamilyMember[]> {
  if (typeof role !== 'string' || !role || role.length > MAX_ROLE_LENGTH) return [];
  const axis = colourwayAxis(doc);
  if (!axis) return [];
  const choices = resolveTokenSelection(doc, opts).choices;
  const active = choices[axis.group];
  const path = role.includes('.') ? role : `color.semantic.${role}`;
  const out: TokenFamilyMember[] = [];
  for (const option of canonicalFirst(axis)) {
    const set = await setFor({ selection: { ...choices, [axis.group]: option.id } });
    const swatch = set.colors().find(s => s.path === path);
    if (swatch?.value) out.push({ id: option.id, name: option.name, canonical: option.canonical, active: option.id === active, value: swatch.value });
  }
  return out;
}

/**
 * The canvas CSS variables a family paints, as `[name, value]` pairs: one
 * `--brand-lead-<n>` per lead, from 1 and canonical first, then
 * `--brand-lead-count`. Both shells' `applyBrandVars` paint exactly these, so a
 * template that reads them renders the same in the browser and the CLI.
 *
 * Nothing for a family of fewer than two, so a design system with one lead
 * paints the canvas exactly as before and a template's fallback stays in charge.
 * A member whose value is not a plain hex colour is skipped rather than painted.
 */
export function brandLeadVars(family: readonly { value?: unknown }[] | null | undefined): [string, string][] {
  const values = (Array.isArray(family) ? family : [])
    .map(m => (m && typeof m.value === 'string' ? m.value.trim() : ''))
    .filter(v => /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(v))
    .slice(0, MAX_LEAD_VARS);
  if (values.length < 2) return [];
  return [...values.map((v, i): [string, string] => [`--brand-lead-${i + 1}`, v]), ['--brand-lead-count', String(values.length)]];
}
