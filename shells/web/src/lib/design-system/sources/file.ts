// SPDX-License-Identifier: MPL-2.0
/**
 * The **design-file source** (plan 97 section 8, M2) - everything the import flow needs
 * to decide what a dropped file IS, and everything the semantic-mapping card
 * needs once that file turns out to be a token document.
 *
 * Pure and DOM-free on purpose. `views/start.ts` owns the copy, the markup and
 * the install; this module owns the sniffing, the zip shapes, the "does this doc
 * still need roles" question and the alias write. That split is what makes the
 * shapes testable under bare node - the flows they replace were 200 lines of
 * branching inside one `handleImportFile` closure with no coverage at all.
 *
 * Nothing here reports user-facing text. A refusal comes back as a machine
 * `reason` and the caller renders it through its own `t()`, so this module never
 * has to reach for the i18n runtime and one refusal can read differently in two
 * places (the modal card, the rail note) without a second code path.
 *
 * Four public jobs:
 *
 *  1. {@link routeDesignFile} - name/type/byte sniffing over the five shapes the
 *     picker accepts, including the zip of loose token-set files that
 *     `assembleTokenSetFiles` has always read for the CLI and the web could
 *     never open.
 *  2. {@link docNeedsMappingReview} - the gap that leaves an installed palette
 *     with every `--brand-*` var dark, plus the card's own model:
 *     {@link colorTokenRows} (what it can offer), {@link chooserRows} (what it
 *     shows) and {@link followRoles} (what follows the one decision it asks for).
 *  3. {@link censusFromTokensDoc} - a declaring source as a `DesignCensus`, for
 *     tray candidates ONLY. Read its caveat before reaching for it.
 *  4. {@link applyMappingChoice} - the chosen roles written as ALIASES onto the
 *     doc that installs, so there is one install and not two.
 */

import { strFromU8 } from 'fflate';
import type { Unzipped } from 'fflate';

import {
  assembleTokenSetFiles, coerceTokensDoc, createTokenSet, hexToOklch, typographyFamilies,
} from '@lolly/engine';
import type { TokensExtraction } from '@lolly/engine';

import { withRoleAliases } from '../../brand-propose.ts';
import type { TokenRoleProposal } from '../../brand-propose.ts';
import { unzipAsync } from '../../zip.ts';
import { censusHex } from '../census.ts';
import type { CensusColor, CensusFont, DesignCensus } from '../census.ts';

// ── Size policy ──────────────────────────────────────────────────────────────
// Caps are exported so a caller can refuse a mispicked multi-GB file from
// `File.size` BEFORE reading a byte of it; `routeDesignFile` re-checks what it
// was handed, because a cap only enforced at one of two call sites is a cap that
// will eventually be skipped.

/** A token document is hand-authored JSON: a few KB to a few MB. */
export const TOKENS_MAX_BYTES = 10 * 1024 * 1024;
/** An SVG mark, same cap the shipped SVG scan has always applied. */
export const SVG_MAX_BYTES = 10 * 1024 * 1024;
/** A design-system pack / Penpot export / zip of token sets. */
export const ZIP_MAX_BYTES = 64 * 1024 * 1024;

/** How many `.json` members a zip of loose token sets may carry. A real export
 *  is one file per set - tens, not hundreds - and the count guard is cheaper
 *  than parsing an archive full of decoys. */
export const SET_FILES_MAX_COUNT = 200;
/** …and how many bytes of JSON they may sum to. The unzip guard's 64 MB/entry
 *  and 256 MB/total caps are the outer net; this is the shape-specific one. */
export const SET_FILES_MAX_BYTES = 10 * 1024 * 1024;

/** Why a file could not be routed. The caller maps each to its own copy. */
export type DesignFileRefusal =
  /** Bigger than the cap for its shape (`limit` says which cap). */
  | 'too-large'
  /** Looked like a zip and would not unzip (or tripped the bomb guard). */
  | 'unreadable-zip'
  /** A readable zip that is not a pack, a Penpot export, or a zip of token sets. */
  | 'unknown-zip'
  /** Not valid JSON. */
  | 'not-json'
  /** Valid JSON, no usable token document in it (`detail` carries the first warning). */
  | 'no-tokens';

interface RouteBase {
  /** The file name minus its extension - the honest default label for whatever
   *  gets installed, and the provenance label every candidate carries. */
  label: string;
}

/**
 * What a dropped file turned out to be.
 *
 * `pack` and `penpot` stop at identification. The Penpot branch runs several
 * more scans over the same entries, so it keeps them and nothing unzips twice.
 *
 * The pack branch carries `files` too, and its caller hands those same parts to
 * importBrandPack for integrity verification: one bounded inflate, not a sniff
 * inflate followed by an import inflate. `.lolly` is deliberately absent: it is
 * a container family, and every UI entry point sends it through
 * lib/lolly-intake.ts before this design-file router is asked anything.
 */
export type DesignFileRoute =
  | (RouteBase & { kind: 'svg' })
  | (RouteBase & { kind: 'pack'; files: Unzipped })
  | (RouteBase & { kind: 'penpot'; files: Unzipped })
  | (RouteBase & { kind: 'tokens'; extraction: TokensExtraction })
  | { kind: 'refused'; reason: DesignFileRefusal; limit?: number; detail?: string };

const SVG_NAME = /\.svg$/i;
const ZIP_NAME = /\.(zip|penpot)$/i;
const EXT = /\.[^./\\]+$/;

const stripExt = (name: string): string => name.replace(EXT, '');

const isSvgFile = (name: string, type?: string): boolean =>
  SVG_NAME.test(name) || type === 'image/svg+xml';

/** `PK\x03\x04` - every zip this app can be handed starts with it, whatever the
 *  extension says. A `.penpot` file is a zip, and a token export renamed by a
 *  well-meaning colleague is still a zip. */
const hasZipMagic = (bytes: Uint8Array): boolean =>
  bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;

/** `<svg` inside the opening bytes, past a BOM, an XML declaration or a comment.
 *  Only consulted when the name and the type both said nothing. */
function looksLikeSvg(bytes: Uint8Array): boolean {
  const head = strFromU8(bytes.subarray(0, 1024));
  return /<svg[\s/>]/i.test(head);
}

/**
 * The byte cap for a file with this name, so a caller can refuse a mispicked
 * multi-GB file straight from `File.size` without reading it.
 */
export function designFileLimit(name: string, type?: string): number {
  if (isSvgFile(name, type)) return SVG_MAX_BYTES;
  if (ZIP_NAME.test(name) || type === 'application/zip') return ZIP_MAX_BYTES;
  return TOKENS_MAX_BYTES;
}

/** A zip member that is a directory entry, a macOS resource fork, or the
 *  `__MACOSX` shadow tree Finder adds to every archive it compresses. */
function isNoise(path: string): boolean {
  if (path.endsWith('/')) return true;
  if (path.startsWith('__MACOSX/') || path.includes('/__MACOSX/')) return true;
  const base = path.slice(path.lastIndexOf('/') + 1);
  return base.startsWith('._') || base === '.DS_Store';
}

/**
 * Drop ONE shared leading directory when every path has one and they agree on
 * it. `assembleTokenSetFiles` recognises `$metadata.json` / `$themes.json` at
 * the ROOT only, and real exports are routinely zipped inside a wrapper folder
 * - without this, every set would be named `tokens/Global` and the metadata
 * that orders them would be read as a set called `tokens/$metadata`.
 *
 * Only one level, and only when it is unambiguous: two top-level directories
 * are a structure the export meant, not packaging.
 */
export function stripCommonPrefix(paths: string[]): string[] {
  if (paths.length < 2) return paths;
  const first = paths[0]!.indexOf('/');
  if (first < 1) return paths;
  const prefix = paths[0]!.slice(0, first + 1);
  return paths.every(p => p.startsWith(prefix) && p.length > prefix.length)
    ? paths.map(p => p.slice(prefix.length))
    : paths;
}

/**
 * A zip of loose token-set files → one document, via the engine's own
 * `assembleTokenSetFiles`. The engine does the `$metadata`/`$themes`/set-name
 * work; this only has to hand it parsed JSON under root-relative paths.
 *
 * A member that will not parse is a local warning, never fatal: a stray
 * `package.json` beside the sets should cost one line of explanation, not the
 * whole import.
 */
export function tokenSetFilesFromZip(files: Unzipped): TokensExtraction {
  const warnings: string[] = [];
  const names = Object.keys(files)
    .filter(p => !isNoise(p) && p.toLowerCase().endsWith('.json'));

  if (!names.length) return { doc: null, warnings: ['no .json files in the archive'], source: 'token-set-files' };
  if (names.length > SET_FILES_MAX_COUNT) {
    return {
      doc: null,
      warnings: [`${names.length} .json files is more than a token export should carry (max ${SET_FILES_MAX_COUNT})`],
      source: 'token-set-files',
    };
  }
  let total = 0;
  for (const name of names) total += files[name]?.length ?? 0;
  if (total > SET_FILES_MAX_BYTES) {
    return {
      doc: null,
      warnings: [`the .json files in the archive total more than ${Math.round(SET_FILES_MAX_BYTES / (1024 * 1024))} MB`],
      source: 'token-set-files',
    };
  }

  const stripped = stripCommonPrefix(names);
  // Null-prototype: a set file legitimately named `__proto__.json` must become
  // an own key here, exactly as it does inside assembleTokenSetFiles.
  const parsed: Record<string, unknown> = Object.create(null);
  for (const [i, name] of names.entries()) {
    const bytes = files[name];
    if (!bytes) continue;
    try {
      parsed[stripped[i]!] = JSON.parse(strFromU8(bytes));
    } catch {
      warnings.push(`${stripped[i]}: not valid JSON - ignored`);
    }
  }

  const out = assembleTokenSetFiles(parsed);
  return { ...out, warnings: [...warnings, ...out.warnings] };
}

/** The manifest a pack or a Penpot export announces itself with. */
function readManifest(files: Unzipped): { format?: string; type?: string } | null {
  const bytes = files['manifest.json'];
  if (!bytes) return null;
  try {
    const json: unknown = JSON.parse(strFromU8(bytes));
    return json && typeof json === 'object' ? json as { format?: string; type?: string } : null;
  } catch { return null; }
}

/**
 * Route one dropped/picked file to the import branch that owns it.
 *
 * Sniffing order is name/type first, bytes second - the name is what the person
 * chose and is right nearly always, and the byte sniff exists for the case it
 * is missing entirely (a drag from an app that reports no type, a file saved
 * without an extension). Anything that is not an SVG and not a zip is attempted
 * as JSON, which is the shipped behaviour and gives the clearest refusal: "is it
 * valid JSON?" beats "unrecognised file".
 *
 * @param name  the file name, used for the label as well as the sniff
 * @param bytes the whole file, already read
 * @param opts  `type` is `File.type` where the platform reported one
 */
export async function routeDesignFile(
  name: string,
  bytes: Uint8Array,
  opts: { type?: string } = {},
): Promise<DesignFileRoute> {
  const label = stripExt(name) || name;
  const type = opts.type;

  if (isSvgFile(name, type) || (!ZIP_NAME.test(name) && !hasZipMagic(bytes) && looksLikeSvg(bytes))) {
    return bytes.length > SVG_MAX_BYTES
      ? { kind: 'refused', reason: 'too-large', limit: SVG_MAX_BYTES }
      : { kind: 'svg', label };
  }

  if (ZIP_NAME.test(name) || type === 'application/zip' || hasZipMagic(bytes)) {
    if (bytes.length > ZIP_MAX_BYTES) return { kind: 'refused', reason: 'too-large', limit: ZIP_MAX_BYTES };
    let files: Unzipped;
    try {
      files = await unzipAsync(bytes);
    } catch (err) {
      return { kind: 'refused', reason: 'unreadable-zip', detail: String((err as { message?: unknown })?.message ?? err) };
    }
    const manifest = readManifest(files);
    if (manifest?.format === 'lolly-brand') return { kind: 'pack', label, files };
    if (manifest?.type === 'penpot/export-files') return { kind: 'penpot', label, files };
    // Neither manifest - the plain zip of loose token-set files.
    const extraction = tokenSetFilesFromZip(files);
    return extraction.doc
      ? { kind: 'tokens', label, extraction }
      : { kind: 'refused', reason: 'unknown-zip', detail: extraction.warnings[0] };
  }

  if (bytes.length > TOKENS_MAX_BYTES) return { kind: 'refused', reason: 'too-large', limit: TOKENS_MAX_BYTES };
  let parsed: unknown;
  try {
    parsed = JSON.parse(strFromU8(bytes));
  } catch {
    return { kind: 'refused', reason: 'not-json' };
  }
  const extraction = coerceTokensDoc(parsed);
  return extraction.doc
    ? { kind: 'tokens', label, extraction }
    : { kind: 'refused', reason: 'no-tokens', detail: extraction.warnings[0] };
}

// ── Semantic mapping ─────────────────────────────────────────────────────────

/** The three roles a design system needs before `--brand-*` can light up.
 *  `secondary` is genuinely optional - a one-colour system is a system. */
export const SEMANTIC_ROLES = ['primary', 'surface', 'text'] as const;

const semanticPath = (role: string): string => `color.semantic.${role}`;

/**
 * True when a document resolves colour tokens but none of
 * `color.semantic.{primary,surface,text}` - the case that installs a palette and
 * leaves every `--brand-*` var at its default, which is the single most common
 * "I imported my tokens and nothing happened" report.
 *
 * `createTokenSet` merges a layered Tokens-Studio document across
 * `$metadata.tokenSetOrder` before resolving, so a doc whose roles live in one
 * set and whose palette lives in another answers correctly from the same call
 * as a plain DTCG file. Asking each set separately would report a false gap for
 * exactly the docs that are already complete.
 *
 * A doc with no colour tokens at all is NOT a gap - there is nothing to map, and
 * offering the card would be asking a question with no answers.
 */
export function docNeedsMappingReview(doc: unknown): boolean {
  const ts = createTokenSet(doc);
  if (!ts.colors().length) return false;
  return SEMANTIC_ROLES.every(role => ts.resolve(semanticPath(role)) === undefined);
}

/** One colour token as the mapping card needs it: where it lives, what it
 *  paints, and how colourful it is - the chooser's rank and the surface's
 *  tie-break, in that order. */
export interface ColorTokenRow { path: string; hex: string; chroma: number }

/**
 * Every colour token the document resolves, most colourful first.
 *
 * `censusHex`, not the raw value: a token may be authored in any CSS notation,
 * and the chip's paint, the chroma sort and the contrast fallback all need one
 * form. A token that resolves to nothing paintable is simply not offered.
 */
export function colorTokenRows(doc: unknown): ColorTokenRow[] {
  const out: ColorTokenRow[] = [];
  try {
    for (const swatch of createTokenSet(doc).colors()) {
      const hex = typeof swatch.value === 'string' ? censusHex(swatch.value) : null;
      const o = hex ? hexToOklch(hex) : null;
      if (!hex || !o) continue;
      out.push({ path: swatch.path, hex, chroma: o.c });
    }
  } catch { return []; }
  return out.sort((a, b) => b.chroma - a.chroma);
}

/**
 * The rows the chooser shows: the most colourful first (a primary is the colour
 * someone would point at), capped so the card stays one decision rather than a
 * scroll - **with the seeded path always among them, wherever it ranks**.
 *
 * The cap is a display cap, and the seed is the answer the card arrives with. A
 * near-neutral proposed primary (`proposeRolesFromTokens` falls back to
 * declaration order when nothing clears its accent-chroma floor) ranks below
 * every saturated palette entry, so without this the card asks "which one is the
 * primary?", shows twelve chips with none pressed, and installs a thirteenth
 * token the person was never shown.
 */
export function chooserRows(
  tokens: readonly ColorTokenRow[], seeded: string | null, max = 12,
): ColorTokenRow[] {
  const top = tokens.slice(0, max);
  if (seeded && !top.some(c => c.path === seeded)) {
    const row = tokens.find(c => c.path === seeded);
    // The least colourful of the shown rows makes room - it is the one with the
    // weakest claim to being anybody's primary.
    if (row && top.length) top.splice(max - 1, 1, row);
    else if (row) top.push(row);
  }
  return top;
}

/** Where a role landed: the declared token it aliases, when it has one, and the
 *  colour that will paint. A `ref`-less role installs nothing (a literal would
 *  fork the imported system on its first edit). */
export interface RoleFollow { ref?: string; hex: string }

/**
 * Surface and text for a chosen primary - the "and these follow from it" half of
 * the card's one decision.
 *
 * The proposer's own picks stand, with one exception that is the whole reason
 * this exists: the chooser lists EVERY colour token, so the token the proposer
 * chose as the surface is one click away from being chosen as the primary - and
 * aliasing both roles to one token makes `--brand-primary` and `--brand-surface`
 * identical, with a text colour picked for contrast against a surface that is no
 * longer there. A collision therefore steps the surface to the next most neutral
 * token (the proposer's own no-weights rule, over a smaller pool), and text
 * follows the surface it actually gets: the proposed text token while it is
 * still a different token, and plain white or black otherwise - the same
 * fallback `proposeRolesFromTokens` uses, and the common case here, since the
 * card's proposal is made with no census at all.
 */
export function followRoles(
  primary: string,
  tokens: readonly ColorTokenRow[],
  proposal: { refs: TokenRoleProposal['refs']; surface?: string } | null,
): Record<'surface' | 'text', RoleFollow> {
  const hexOf = (path?: string): string | undefined => tokens.find(c => c.path === path)?.hex;

  let surfaceRef = proposal?.refs.surface;
  if (!surfaceRef || surfaceRef === primary) {
    surfaceRef = [...tokens].filter(c => c.path !== primary)
      .sort((a, b) => a.chroma - b.chroma)[0]?.path;
  }
  const surfaceHex = hexOf(surfaceRef) ?? proposal?.surface ?? '#FFFFFF';

  let textRef = proposal?.refs.text;
  if (textRef === primary || textRef === surfaceRef) textRef = undefined;
  const textHex = hexOf(textRef) ?? ((hexToOklch(surfaceHex)?.l ?? 1) < 0.5 ? '#FFFFFF' : '#000000');

  return { surface: { ref: surfaceRef, hex: surfaceHex }, text: { ref: textRef, hex: textHex } };
}

/** Token paths - never hexes - for the roles a person picked in the card. */
export interface MappingChoice {
  /** The declared colour token that becomes `color.semantic.primary`. */
  primary: string;
  surface?: string;
  text?: string;
  secondary?: string;
}

/**
 * Write the chosen roles onto `doc` as ALIASES to its own tokens, returning a
 * copy (`withRoleAliases` never mutates).
 *
 * Aliases and not literals, because the design system the person imported stays
 * the source of truth: editing their `palette.blue-600` later moves the primary
 * with it. A literal would fork silently on the first edit.
 *
 * Blank/whitespace choices are dropped rather than written as an empty alias, so
 * a half-filled card degrades to "the roles it did name" instead of installing a
 * reference to nothing. With nothing named at all the doc comes back untouched,
 * which is exactly what Skip installs.
 */
export function applyMappingChoice(
  doc: Record<string, unknown>,
  choice: MappingChoice,
): Record<string, unknown> {
  const refs: TokenRoleProposal['refs'] = {};
  for (const role of ['primary', 'secondary', 'surface', 'text'] as const) {
    const path = choice[role]?.trim();
    if (path) refs[role] = path;
  }
  return withRoleAliases(doc, refs);
}

// ── The declaring source as a census ─────────────────────────────────────────

/**
 * A token document as a `DesignCensus` - **for tray candidates only**.
 *
 * The caveat is the whole point of this doc comment. A census is hex-keyed by
 * construction (`censusToUsage` buckets by hex and drops everything else), so
 * routing a doc through it throws away the declared token PATHS - and paths are
 * exactly what `withRoleAliases` needs to write an alias rather than a literal.
 * **Never propose roles from this.** `proposeRolesFromTokens(doc, [], null)` is
 * the token-first proposer, it keeps the paths, and it is what the mapping card
 * (section 3) runs. This function exists for the other half of section 8: "review first",
 * where a doc decomposes into candidates the person adds one at a time, and a
 * candidate only ever needs a value and a provenance.
 *
 * Weights are declaration COUNTS, never invented usage: a colour declared once
 * weighs 1, and a hex declared twice under two names weighs 2 because that is a
 * fact the document states. Equal weights leave declaration order standing
 * (`candidatesFromCensus` sorts stably), which is the only ranking a document
 * offers and the only one honest to report.
 *
 * `source.kind` is `'css'`, the census's bucket for *declared* values as opposed
 * to painted ones - a DTCG doc and a fetched stylesheet are the same species of
 * evidence. A dedicated `'tokens'` kind would read better and belongs in
 * `census.ts`'s union the next time it opens; it is not user-visible in the tray
 * (candidates show `provenance.label`), so it is not worth widening a shared
 * type from here.
 *
 * Gradients and a name are deliberately absent: the tray has no gradient
 * candidate type, and a document does not name itself - the file name is the
 * label, not a claim about what the design system is called.
 */
export function censusFromTokensDoc(doc: unknown, label: string): DesignCensus {
  const ts = createTokenSet(doc);

  const byHex = new Map<string, CensusColor>();
  for (const swatch of ts.colors()) {
    const hex = typeof swatch.value === 'string' ? censusHex(swatch.value) : null;
    if (!hex) continue;
    const row = byHex.get(hex);
    // No `kind`: a declared token was never painted, so it belongs in none of
    // the four paint buckets. censusToUsage reads an unqualified colour as a
    // fill, which is why this census must not reach the proposer (see above).
    if (row) row.weight += 1;
    else byHex.set(hex, { hex, weight: 1 });
  }

  const fonts: CensusFont[] = [];
  const seenFamily = new Set<string>();
  for (const entry of ts.query()) {
    if (entry.type !== 'typography' && entry.type !== 'fontFamily' && entry.type !== 'fontFamilies') continue;
    for (const family of typographyFamilies(entry.value)) {
      const key = family.toLowerCase();
      if (seenFamily.has(key)) continue;
      seenFamily.add(key);
      fonts.push({ family, usage: /mono/i.test(family) ? 'mono' : 'unknown', count: 1 });
    }
  }

  return {
    colors: [...byHex.values()],
    gradients: [],
    fonts,
    source: { kind: 'css', label },
  };
}
