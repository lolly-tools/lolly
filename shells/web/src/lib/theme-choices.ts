// SPDX-License-Identifier: MPL-2.0
/**
 * Theme choices away from the tool view's own canvas (plans/319 A6).
 *
 * A document's theme choices (light or dark, a colourway, any other theme group) are
 * one theme id per group: `_themes` in a link, `__tokenSelection` in a saved session,
 * `runtime.tokenSelection` once the document is open. The tool view hands them to its
 * runtime and paints its canvas from a host scoped to them (lib/document-theme.ts).
 * Every other place a document is drawn needs the same two things, and before this
 * module several of them dropped the choices: a multi-edit card, a /pro batch row, a
 * Design document export and a tool composed inside another tool all drew in the
 * design system's default theme.
 *
 * - {@link savedTokenSelection} reads a stored choice map from a record nobody
 *   checked (a saved session, a batch snapshot, a CSV cell), under the limits the
 *   engine applies to `_themes`.
 * - {@link composeSelection} merges a composed child's own choices over the ones it
 *   inherits from the document it is placed in, group by group, and
 *   {@link childSelection} fills a document that made no choice from the design
 *   system's own (the address's `_themes`, else the stored ones).
 * - {@link withComposeSelection} wraps a mount's host so every compose call carries
 *   the document's choices. The compose bridge (bridge/compose.ts) is built once per
 *   shell host and cannot see which document is asking, so each mount that renders
 *   children says so. Before, a child read the unscoped token bridge, which follows
 *   the address bar's `_themes`: right in the tool view once the address had been
 *   synced, wrong in a framed tool (whose address is never written) and in every
 *   offscreen render (which has no address of its own).
 *
 * No DOM, so the batch, multi-edit and compose paths share this module and Node tests
 * run the module directly.
 */
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { parseTokenSelection } from '../../../../engine/src/token-selection.ts';
import type { WebComposeSpec, WebComposeUrlOpts } from '../bridge/compose.ts';

/** One theme id per theme group, as `_themes` and `__tokenSelection` store them. */
export type ThemeChoices = Record<string, string>;

/**
 * A stored theme choice map, when it is one: what the engine's `parseTokenSelection`
 * accepts from `_themes` (a JSON object of at most 64 group ids, each naming a theme
 * id of at most 256 characters), with at least one group. Anything else, a hand-edited
 * record included, reads as "no choice", so the document renders in the design
 * system's defaults instead of failing. Returns a copy, never the stored object.
 */
export function savedTokenSelection(value: unknown): ThemeChoices | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  let choices: ThemeChoices | undefined;
  try { choices = parseTokenSelection(JSON.stringify(value)); } catch { return undefined; }
  return choices && Object.keys(choices).length ? choices : undefined;
}

/**
 * A composed child's own choices over the ones it inherits, group by group. Undefined
 * when neither has a group, so a document with no choices composes exactly as before.
 * Neither argument is written to.
 */
export function composeSelection(inherited: Readonly<ThemeChoices> | undefined, own: Readonly<ThemeChoices> | undefined): ThemeChoices | undefined {
  const merged: ThemeChoices = { ...(inherited ?? {}), ...(own ?? {}) };
  return Object.keys(merged).length ? merged : undefined;
}

/**
 * The theme choices a host's own token reads resolve to, one theme id per group: the
 * design system's stored choices (`$metadata.activeThemeSelection`), or the address's
 * `_themes`, which the web token bridge reads in their place. Read the way the runtime
 * reads them for photo looks (engine/src/runtime.ts `effectiveChoices`): the token
 * snapshot, else an inspection. Undefined when the host has no token API, the design
 * system declares no theme groups, or the read fails.
 */
export async function effectiveThemeChoices(host: HostV1): Promise<ThemeChoices | undefined> {
  const tokens = host.tokens;
  try {
    const choices = tokens?.snapshot ? (await tokens.snapshot()).selection?.choices
      : tokens?.inspect ? (await tokens.inspect()).selection?.choices : undefined;
    return savedTokenSelection(choices);
  } catch { return undefined; }
}

/**
 * The choices a composed child draws in: its own over the document's, group by group
 * ({@link composeSelection}). A document that made no choice draws in the choices its
 * host's token reads resolve to, so when the child names some groups of its own, the
 * other groups come from there ({@link effectiveThemeChoices}). Without that,
 * `_themes={"":"light"}` inside a document whose design system is set to dark
 * Persimmon drew light in the canonical colourway, because an explicit selection
 * replaces the stored one whole (engine/src/token-selection.ts). A document's own
 * choices are never filled in this way: the document itself resolves the groups they
 * leave out to the defaults, and the child does the same. `host` is read only when the
 * child names some groups and the document none.
 */
export async function childSelection(
  host: HostV1,
  inherited: Readonly<ThemeChoices> | undefined,
  own: Readonly<ThemeChoices> | undefined,
): Promise<ThemeChoices | undefined> {
  const named = (choices: Readonly<ThemeChoices> | undefined): boolean => !!choices && Object.keys(choices).length > 0;
  return composeSelection(named(own) && !named(inherited) ? await effectiveThemeChoices(host) : inherited, own);
}

/**
 * A host whose compose calls carry the document's theme choices. `selection` is read on
 * every call, so a mount whose choices change (the tool view's theme control) composes
 * in the choices it shows at that moment. A spec that names choices of its own keeps
 * them for the groups it names, and {@link childSelection} fills the rest. Every other
 * member is the host's own, the shell host is never written to, and a host with no
 * compose API is returned as it is.
 */
export function withComposeSelection<H extends HostV1>(host: H, selection: () => Readonly<ThemeChoices> | undefined): H {
  const base = host.compose;
  if (!base) return host;
  const withChoices = async <T extends { tokenSelection?: ThemeChoices }>(spec: T): Promise<T> => {
    const tokenSelection = await childSelection(host, selection(), spec.tokenSelection);
    return tokenSelection ? { ...spec, tokenSelection } : spec;
  };
  const renderUrl = base.renderUrl;
  const compose: typeof base = {
    ...base,
    render: async (spec: WebComposeSpec) => base.render(await withChoices(spec ?? ({} as WebComposeSpec))),
    ...(renderUrl ? { renderUrl: async (url: string, opts: WebComposeUrlOpts = {}) => renderUrl(url, await withChoices(opts)) } : {}),
  };
  return { ...host, compose };
}
