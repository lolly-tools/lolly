// SPDX-License-Identifier: MPL-2.0
/**
 * Usage-derived brand proposal - the policy half of the token-less Penpot
 * import. The engine's `scanPenpotUsage` (brand-import.ts) is the pure census:
 * every paint source tallied per colour, gradients deduped, fonts aggregated.
 * This module turns that census into the roles a designer would assign:
 *
 *   - surface   = the highest-weight FILL colour (backgrounds dominate fills);
 *   - shades    = colours co-occurring with the surface in any gradient's stops
 *                 (data-driven, no hue window) - excluded from the accent pool,
 *                 which is essential: a surface shade rides huge gradient
 *                 counts and would otherwise out-score a real accent;
 *   - accents   = remaining colours with OKLCH chroma >= 0.09, scored
 *                 weight x chroma; primary is the top score, secondary the next
 *                 accent at least 30 degrees of hue away (else null);
 *   - scheme    = nearest of mono/analogous/triad/complement to the
 *                 primary-secondary hue arc;
 *   - text      = the most-frequent text-run colour that clears WCAG 4.5:1 on
 *                 the surface, else white/black by the surface's look.
 *
 * `buildBrandDocFromUsage` then composes the EXISTING machinery rather than
 * inventing a doc shape: deriveBrandTokens for the full OKLCH ramp/semantic
 * doc, a literal semantic-secondary override (the supported alias-detach
 * write), addSwatch custom entries for kept extras, addStudioToken gradient
 * tokens for the top gradients, and withFontRoleToken for font.brand/font.mono
 * so carryUserFontTokens lets the doc's own font group win on install.
 *
 * Pure and DOM-free on purpose: unit-testable under node, and importable by
 * the repo-root gated keynote suite the same way font-upload-edge-cases.test.ts
 * imports lib modules.
 */

import { hexToOklch, contrastRatio, deriveBrandTokens, createTokenSet, typographyFamilies, tokenSetNames } from '@lolly/engine';
import type { PenpotUsage, PenpotAppliedToken } from '@lolly/engine';
import { addSwatch } from './brand-doc.ts';
import { addStudioToken } from './token-studio.ts';
import { withFontRoleToken } from '../user-fonts.ts';

export interface BrandRoleProposal {
  primary: string;
  secondary: string | null;
  surface: string;
  surfaceLook: 'light' | 'dark';
  text: string;
  scheme: 'mono' | 'analogous' | 'triad' | 'complement';
  /** Accent-pool colours beyond primary/secondary, in score order. */
  extras: string[];
}

export interface BrandUsageFonts {
  /** The most-used family - the app's primary face candidate. */
  brand: string | null;
  /** The most-used family matching /mono/i, for font.mono. */
  mono: string | null;
  /** Families sourced from Google Fonts (`gfont-` ids), most-used first. */
  google: string[];
  /** Families with no fetchable source - named in the card, never fetched. */
  missing: string[];
}

/** Minimum OKLCH chroma for a colour to count as an accent candidate. */
const ACCENT_CHROMA_MIN = 0.09;
/** Minimum hue arc (degrees) between primary and secondary. */
const SECONDARY_HUE_ARC_MIN = 30;
/** WCAG floor for keeping an observed text colour on the observed surface. */
const TEXT_CONTRAST_MIN = 4.5;
/** How many observed gradients become brand tokens. */
const MAX_GRADIENT_TOKENS = 3;

/** Shortest hue arc between two hues, 0..180. */
function hueArc(a: number, b: number): number {
  const d = Math.abs(((a - b) % 360 + 360) % 360);
  return Math.min(d, 360 - d);
}

/**
 * Pick brand roles from a usage census. Null when the census carries no
 * colours at all (the caller keeps its "nothing found" error for that).
 */
export function proposeBrandRoles(usage: PenpotUsage): BrandRoleProposal | null {
  const colors = usage.colors;
  if (!colors.length) return null;

  // Surface: the highest-weight fill colour (colors are total-sorted, so ties
  // on fills resolve toward overall weight). A file with no fills at all falls
  // back to the heaviest colour overall.
  let surfaceRow = colors[0]!;
  let bestFills = -1;
  for (const c of colors) {
    if (c.fills > bestFills) { surfaceRow = c; bestFills = c.fills; }
  }
  const surface = surfaceRow.hex;
  const surfaceL = hexToOklch(surface)?.l ?? 1;
  const surfaceLook: 'light' | 'dark' = surfaceL < 0.5 ? 'dark' : 'light';

  // Surface shades: colours that share a gradient with the surface. A shade is
  // the surface's own ramp partner, not an accent - and its gradient-stop
  // weight would out-score genuine accents if left in the pool.
  const shades = new Set<string>();
  for (const g of usage.gradients) {
    if (!g.stops.some(s => s.color === surface)) continue;
    for (const s of g.stops) if (s.color !== surface) shades.add(s.color);
  }

  // Accents: weight x chroma over what's left.
  const accents = colors
    .filter(c => c.hex !== surface && !shades.has(c.hex))
    .map(c => ({ hex: c.hex, ok: hexToOklch(c.hex), score: 0 }))
    .filter(a => a.ok !== null && a.ok.c >= ACCENT_CHROMA_MIN)
    .map(a => ({ ...a, score: (colors.find(c => c.hex === a.hex)?.total ?? 0) * a.ok!.c }))
    .sort((a, b) => b.score - a.score);

  // A file of pure greys still needs a primary for deriveBrandTokens: fall
  // back to the heaviest non-surface colour, then the surface itself.
  const primary = accents[0]?.hex ?? colors.find(c => c.hex !== surface)?.hex ?? surface;
  const primaryHue = hexToOklch(primary)?.h ?? 0;

  let secondary: string | null = null;
  const extras: string[] = [];
  for (const a of accents.slice(1)) {
    if (secondary === null && hueArc(a.ok!.h, primaryHue) >= SECONDARY_HUE_ARC_MIN) {
      secondary = a.hex;
    } else {
      extras.push(a.hex);
    }
  }

  // Scheme: nearest named relationship to the observed hue arc.
  let scheme: BrandRoleProposal['scheme'] = 'mono';
  if (secondary !== null) {
    const arc = hueArc(hexToOklch(secondary)?.h ?? 0, primaryHue);
    const named: [BrandRoleProposal['scheme'], number][] =
      [['mono', 0], ['analogous', 30], ['triad', 120], ['complement', 180]];
    let bestD = Infinity;
    for (const [name, at] of named) {
      const d = Math.abs(arc - at);
      if (d < bestD) { bestD = d; scheme = name; }
    }
  }

  // Text: the most-frequent observed text colour that actually reads on the
  // surface; otherwise plain white/black by the surface's look.
  let text: string | null = null;
  let bestRuns = 0;
  for (const c of colors) {
    if (c.textRuns > bestRuns && contrastRatio(c.hex, surface) >= TEXT_CONTRAST_MIN) {
      text = c.hex;
      bestRuns = c.textRuns;
    }
  }
  text ??= surfaceLook === 'dark' ? '#FFFFFF' : '#000000';

  return { primary, secondary, surface, surfaceLook, text, scheme, extras };
}

/** Aggregate the census's font entries into role + source buckets. */
export function proposeFonts(usage: PenpotUsage): BrandUsageFonts {
  const families = new Map<string, { runs: number; google: boolean }>();
  for (const u of usage.fonts) {
    const name = u.fontFamily || u.fontId;
    let e = families.get(name);
    if (!e) { e = { runs: 0, google: false }; families.set(name, e); }
    e.runs += u.runs;
    if (u.fontId.startsWith('gfont-')) e.google = true;
  }
  const byRuns = [...families.entries()].sort((a, b) => b[1].runs - a[1].runs);
  const brand = byRuns[0]?.[0] ?? null;
  const mono = byRuns.find(([name]) => /mono/i.test(name))?.[0] ?? null;
  return {
    brand,
    mono,
    google: byRuns.filter(([, e]) => e.google).map(([name]) => name),
    missing: byRuns.filter(([, e]) => !e.google).map(([name]) => name),
  };
}

// ── Token-first proposal - roles from what the file DECLARES ─────────────────
// The token-less path above reads pixels; this one reads names. When a Penpot
// file carries its own token document, the designer has already said what their
// colours are called, and `scanPenpotAppliedTokens` says which of those tokens
// they attached to which kind of attribute. Ranking declared tokens by that
// census beats every hex heuristic, because it is not a guess.
//
// Three sources of weight, in order: the applied census; failing that (an older
// export, or a wire shape we didn't recognise) the raw usage census bridged by
// hex; failing that the declared swatches on their own, ordered by the same
// chroma/hue guard rails the usage path uses.

/** A role proposal that can name the token each role came from. */
export interface TokenRoleProposal extends BrandRoleProposal {
  /** role → the declared token's dotted path, when the role came from one. */
  refs: Partial<Record<'primary' | 'secondary' | 'surface' | 'text', string>>;
}

const HEX6 = /^#[0-9a-fA-F]{6}/;
const hex6 = (v: string): string | null => {
  const m = HEX6.exec(v.trim());
  return m ? m[0].toUpperCase() : null;
};

interface Candidate {
  path: string;
  hex: string;
  chroma: number;
  hue: number;
  fills: number;
  strokes: number;
  text: number;
  total: number;
}

/**
 * Propose brand roles from a file's DECLARED tokens, ranked by how the designer
 * applied them. Null when the document resolves no usable colour tokens at all
 * - the caller then falls back to `proposeBrandRoles` over the usage census,
 * which is what every token-less file gets today.
 *
 * @param doc     the reassembled token document (extractPenpotProject's output)
 * @param applied the applied-token census (`scanPenpotAppliedTokens`), possibly empty
 * @param usage   the paint census, used to bridge weights when `applied` is empty
 */
export function proposeRolesFromTokens(
  doc: unknown,
  applied: readonly PenpotAppliedToken[],
  usage?: PenpotUsage | null,
): TokenRoleProposal | null {
  const ts = createTokenSet(doc);
  const cands: Candidate[] = [];
  for (const sw of ts.colors()) {
    const hex = typeof sw.value === 'string' ? hex6(sw.value) : null;
    const ok = hex ? hexToOklch(hex) : null;
    if (!hex || !ok) continue;
    cands.push({ path: sw.path, hex, chroma: ok.c, hue: ok.h, fills: 0, strokes: 0, text: 0, total: 0 });
  }
  if (!cands.length) return null;

  // Weights: the applied census first. Token names join to createTokenSet's
  // flattened paths verbatim - Penpot's token-name grammar has no spaces, so
  // there is nothing to normalise and normalising would only break the join.
  const byName = new Map(applied.map(r => [r.name, r]));
  let weighted = false;
  for (const c of cands) {
    const row = byName.get(c.path);
    if (!row) continue;
    c.fills = row.fills; c.strokes = row.strokes; c.text = row.text; c.total = row.total;
    if (row.total > 0) weighted = true;
  }
  // Bridge: no applied census (or none of it named a colour token) - fall back
  // to how often each declared colour was actually painted.
  if (!weighted && usage) {
    const byHex = new Map(usage.colors.map(r => [r.hex, r]));
    for (const c of cands) {
      const row = byHex.get(c.hex);
      if (!row) continue;
      c.fills = row.fills; c.strokes = row.strokes; c.text = row.textRuns; c.total = row.total;
      if (row.total > 0) weighted = true;
    }
  }

  // Surface: the most-filled token. With no weights at all, the least colourful
  // declared colour is the honest guess - a brand's surface is its neutral.
  let surfaceC = cands[0]!;
  if (weighted) {
    for (const c of cands) if (c.fills > surfaceC.fills) surfaceC = c;
  } else {
    for (const c of cands) if (c.chroma < surfaceC.chroma) surfaceC = c;
  }
  const surface = surfaceC.hex;
  const surfaceLook: 'light' | 'dark' = (hexToOklch(surface)?.l ?? 1) < 0.5 ? 'dark' : 'light';

  // Same shade exclusion as the usage path: a colour sharing a gradient with
  // the surface is that surface's ramp partner, not an accent.
  const shades = new Set<string>();
  for (const g of usage?.gradients ?? []) {
    if (!g.stops.some(s => s.color === surface)) continue;
    for (const s of g.stops) if (s.color !== surface) shades.add(s.color);
  }

  const accents = cands
    .filter(c => c.hex !== surface && !shades.has(c.hex) && c.chroma >= ACCENT_CHROMA_MIN)
    .map(c => ({ c, score: (weighted ? c.total : 1) * c.chroma }))
    .sort((a, b) => b.score - a.score)   // stable: equal scores keep declaration order
    .map(e => e.c);

  const primaryC = accents[0] ?? cands.find(c => c.hex !== surface) ?? surfaceC;
  let secondaryC: Candidate | null = null;
  const extras: string[] = [];
  for (const a of accents) {
    if (a === primaryC) continue;
    if (!secondaryC && hueArc(a.hue, primaryC.hue) >= SECONDARY_HUE_ARC_MIN) secondaryC = a;
    else extras.push(a.hex);
  }

  let scheme: BrandRoleProposal['scheme'] = 'mono';
  if (secondaryC) {
    const arc = hueArc(secondaryC.hue, primaryC.hue);
    const named: [BrandRoleProposal['scheme'], number][] =
      [['mono', 0], ['analogous', 30], ['triad', 120], ['complement', 180]];
    let bestD = Infinity;
    for (const [name, at] of named) {
      const d = Math.abs(arc - at);
      if (d < bestD) { bestD = d; scheme = name; }
    }
  }

  // Text: the token applied to the most text fills that actually reads on the
  // surface; plain white/black when nothing declared clears the floor.
  let textC: Candidate | null = null;
  for (const c of cands) {
    if (c.text <= (textC?.text ?? 0)) continue;
    if (contrastRatio(c.hex, surface) >= TEXT_CONTRAST_MIN) textC = c;
  }
  const text = textC?.hex ?? (surfaceLook === 'dark' ? '#FFFFFF' : '#000000');

  const refs: TokenRoleProposal['refs'] = { primary: primaryC.path, surface: surfaceC.path };
  if (secondaryC) refs.secondary = secondaryC.path;
  if (textC) refs.text = textC.path;

  return {
    primary: primaryC.hex,
    secondary: secondaryC?.hex ?? null,
    surface,
    surfaceLook,
    text,
    scheme,
    extras,
    refs,
  };
}

/**
 * Font families a token document declares, ranked by the applied census.
 * `google`/`missing` stay empty and complete respectively: a token document
 * names families, it never says where they can be fetched from, and claiming a
 * source we haven't checked would be the one thing worse than saying nothing.
 */
export function proposeFontsFromTokens(
  doc: unknown,
  applied: readonly PenpotAppliedToken[],
): BrandUsageFonts {
  const ts = createTokenSet(doc);
  const byName = new Map(applied.map(r => [r.name, r]));
  const scored: { family: string; weight: number; order: number }[] = [];
  const seen = new Set<string>();
  let order = 0;
  for (const e of ts.query()) {
    if (e.type !== 'typography' && e.type !== 'fontFamily' && e.type !== 'fontFamilies') continue;
    const weight = byName.get(e.path)?.type ?? 0;
    for (const family of typographyFamilies(e.value)) {
      if (seen.has(family)) continue;
      seen.add(family);
      scored.push({ family, weight, order: order++ });
    }
  }
  scored.sort((a, b) => (b.weight - a.weight) || (a.order - b.order));
  const families = scored.map(s => s.family);
  return {
    brand: families[0] ?? null,
    mono: families.find(f => /mono/i.test(f)) ?? null,
    google: [],
    missing: families,
  };
}

/** The set a token-first install writes its semantic roles into. */
export const ROLE_SET_NAME = 'Lolly roles';

const ROLE_VARS = ['primary', 'secondary', 'surface', 'text'] as const;

/**
 * Return a copy of `doc` whose `color.semantic.*` roles ALIAS the declared
 * tokens named in `refs`. Aliases, not literals: the installed brand then still
 * points at the designer's own token, so editing that token moves the role with
 * it - the same alias-write `buildBrandDocFromUsage` uses for its secondary.
 *
 * A layered Tokens-Studio doc gets a new top-level set (`Lolly roles`, appended
 * to `$metadata.tokenSetOrder` and enabled in every theme) rather than having a
 * `color` group pushed in beside its sets, where it would read as a set name. A
 * plain DTCG doc gets the group merged in directly. `doc` is never mutated.
 */
export function withRoleAliases(
  doc: Record<string, unknown>,
  refs: TokenRoleProposal['refs'],
): Record<string, unknown> {
  const semantic: Record<string, unknown> = {};
  for (const role of ROLE_VARS) {
    const path = refs[role];
    if (path) semantic[role] = { $value: `{${path}}`, $type: 'color' };
  }
  if (!Object.keys(semantic).length) return doc;

  const out: Record<string, unknown> = { ...doc };
  const themes = Array.isArray(out.$themes) ? out.$themes : null;

  // Layered-ness is `tokenSetNames`, NOT `$themes` alone: a real Penpot export of
  // a themeless file writes `$themes: []` beside a real `$metadata.tokenSetOrder`
  // ({"Global":…, "$themes":[], "$metadata":{"tokenSetOrder":["Global"]}}). Merging
  // a `color` group into that doc's top level would make "color" read as a set name
  // that tokenSetOrder never activates, so the roles would resolve to nothing at all.
  if (!tokenSetNames(out)) {
    const color = typeof out.color === 'object' && out.color !== null ? { ...(out.color as Record<string, unknown>) } : {};
    const prev = typeof color.semantic === 'object' && color.semantic !== null ? color.semantic as Record<string, unknown> : {};
    color.semantic = { ...prev, ...semantic };
    out.color = color;
    return out;
  }

  let setName = ROLE_SET_NAME;
  for (let i = 2; Object.hasOwn(out, setName); i++) setName = `${ROLE_SET_NAME} ${i}`;
  out[setName] = { color: { semantic } };

  const meta = typeof out.$metadata === 'object' && out.$metadata !== null
    ? { ...(out.$metadata as Record<string, unknown>) } : {};
  const order = Array.isArray(meta.tokenSetOrder) ? meta.tokenSetOrder.filter(s => typeof s === 'string') : null;
  // Last in the order wins, which is what a role override must do.
  if (order) meta.tokenSetOrder = [...order, setName];
  // Penpot also writes `$metadata.activeSets`; a themeless export activates its
  // sets there rather than through a theme, so the new set has to join that list
  // or a round-trip back into Penpot would drop the roles.
  const active = Array.isArray(meta.activeSets) ? meta.activeSets.filter(s => typeof s === 'string') : null;
  if (active) meta.activeSets = [...active, setName];
  out.$metadata = meta;

  // Only a doc that HAS themes needs the new set enabling in each of them; the
  // themeless-but-layered case is already covered by the tokenSetOrder append.
  if (themes && themes.length) {
    out.$themes = themes.map(theme => {
      if (typeof theme !== 'object' || theme === null) return theme;
      const t = { ...(theme as Record<string, unknown>) };
      const sel = typeof t.selectedTokenSets === 'object' && t.selectedTokenSets !== null
        ? { ...(t.selectedTokenSets as Record<string, unknown>) } : {};
      sel[setName] = 'enabled';
      t.selectedTokenSets = sel;
      return t;
    });
  }

  return out;
}

/**
 * Compose a full installable tokens doc from a usage census. Throws when the
 * census has no colours - call proposeBrandRoles first to gate on null.
 *
 * `opts.keepExtras` restricts which of the proposal's extra accents become
 * custom swatches (the review card's checkboxes); omitted = keep them all.
 */
export function buildBrandDocFromUsage(
  usage: PenpotUsage, label: string, opts?: { keepExtras?: string[] },
): { doc: Record<string, unknown>; roles: BrandRoleProposal; fonts: BrandUsageFonts; gradientCount: number } {
  const roles = proposeBrandRoles(usage);
  if (!roles) throw new Error('No colours found in the file.');

  let doc = deriveBrandTokens({
    primary: roles.primary,
    scheme: roles.scheme,
    surface: roles.surfaceLook,
    name: label,
  });

  // Detach color.semantic.secondary from its derived ramp step in BOTH theme
  // sets, pinning the colour the designer actually used (writing a literal
  // over the alias is the supported detach - see brand-doc.ts).
  if (roles.secondary) {
    for (const set of ['light', 'dark']) {
      const setRec = doc[set];
      if (typeof setRec !== 'object' || setRec === null) continue;
      const color = (setRec as Record<string, unknown>).color;
      if (typeof color !== 'object' || color === null) continue;
      const semantic = (color as Record<string, unknown>).semantic;
      if (typeof semantic !== 'object' || semantic === null) continue;
      const leaf = (semantic as Record<string, unknown>).secondary;
      if (typeof leaf === 'object' && leaf !== null) (leaf as Record<string, unknown>).$value = roles.secondary;
      else (semantic as Record<string, unknown>).secondary = { $value: roles.secondary };
    }
  }

  // Kept extra accents land as custom swatches, labelled by their hex - honest
  // provenance for colours the file used without naming.
  const keep = opts?.keepExtras ?? roles.extras;
  for (const hex of keep) {
    if (roles.extras.includes(hex)) addSwatch(doc, 'custom', hex, hex);
  }

  // The top observed gradients become gradient tokens (stops as
  // {color, position}, the census's modal angle in the vendor extension).
  let gradientCount = 0;
  for (const g of usage.gradients.slice(0, MAX_GRADIENT_TOKENS)) {
    const path = addStudioToken(doc, 'gradient', `File gradient ${gradientCount + 1}`, {
      stops: g.stops.map(s => ({ color: s.color, position: s.offset })),
      angle: g.angle,
    });
    if (path) gradientCount++;
  }

  // Font roles from the tally - writing them here means carryUserFontTokens
  // keeps THESE on install instead of re-applying the previously chosen faces.
  const fonts = proposeFonts(usage);
  if (fonts.brand) doc = withFontRoleToken(doc, 'brand', fonts.brand);
  if (fonts.mono) doc = withFontRoleToken(doc, 'mono', fonts.mono);

  return { doc, roles, fonts, gradientCount };
}
