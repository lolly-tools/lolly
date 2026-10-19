// SPDX-License-Identifier: MPL-2.0

// ─── Design tokens ────────────────────────────────────────────────────────────

export interface TokenResolveOptions {
  theme?: string;
  /** One source theme id per source group. Empty group ids use the empty string. */
  selection?: Record<string, string>;
}

export interface TokenDiagnostic {
  code: 'selection' | 'missing' | 'cycle' | 'type' | 'unsupported' | 'limit';
  path: string;
  message: string;
}

/**
 * What a theme group means (v1.265, plans/319). A Tokens Studio `$themes` group is
 * only a name; the kind says what choosing between its options changes. A group
 * declares it on its entries as `$extensions['com.suse.lolly'].axis.kind`, or once
 * for the group at the document root as `$extensions['com.suse.lolly'].themeAxes`.
 *
 * - `mode`: light, dark and similar looks that every artefact can be drawn in.
 * - `colourway`: which lead colour fills the primary role.
 * - `expression`, `medium`, `contrast`, `density`, `campaign`, `brand`: recognised
 *   and kept, but resolved as plain theme choices until a later version gives them
 *   behaviour.
 *
 * A group with no kind, or a kind this version does not know, behaves exactly as
 * an ordinary theme group.
 */
export type TokenAxisKind = 'mode' | 'colourway' | 'expression' | 'medium' | 'contrast' | 'density' | 'campaign' | 'brand';

/** Every `TokenAxisKind`, in documentation order. */
export const TOKEN_AXIS_KINDS: readonly TokenAxisKind[] = Object.freeze(['mode', 'colourway', 'expression', 'medium', 'contrast', 'density', 'campaign', 'brand']);

/** How a series picks a colourway for each new artefact (plans/319). See `pickColourway` in the engine. */
export type TokenRotationPolicy = 'canonical' | 'cycle' | 'by-key' | 'shuffle' | 'by-date';

/**
 * One theme group of the document with what it means (plans/319), as
 * `host.tokens.axes()` lists the group. Structure only: which option is in force for a
 * read is a selection, reported by `inspect()` and applied by every read.
 */
export interface TokenAxisInfo {
  /** The source group id; `''` for themes with no group. */
  group: string;
  /** The declared kind, or null when the group declares none. */
  kind: TokenAxisKind | null;
  /** The canonical option's id: the one marked canonical, else the first authored. */
  canonical: string;
  /** The group's default rotation policy, or null when none is declared. */
  rotation: TokenRotationPolicy | null;
  /** Options in authored order. `window` is an inclusive pair of ISO dates. */
  options: { id: string; name: string; canonical: boolean; window?: { from?: string; to?: string } }[];
}

/**
 * One lead of the family (plans/319): a colourway and the colour it gives one
 * role in the current look. `host.tokens.family()` lists them canonical first.
 */
export interface TokenFamilyMember {
  /** The colourway's theme id. Permanent: a series stores this id. */
  id: string;
  /** The colourway's display name. */
  name: string;
  /** True for the design system's canonical colourway. */
  canonical: boolean;
  /** True for the colourway this read resolves to, which is the one the artefact uses. */
  active: boolean;
  /** The role's resolved colour as a hex string. */
  value: string;
}

export interface TokenSelection {
  groups: {
    id: string;
    options: { id: string; name: string }[];
    /** The group's declared kind (v1.265). Absent when the document declares none. */
    kind?: TokenAxisKind;
    /** The canonical option's id (v1.265): the option marked `canonical`, else the first one authored. */
    canonical?: string;
  }[];
  choices: Record<string, string>;
  defaults: string[];
  sets: string[];
  diagnostics: TokenDiagnostic[];
}

export interface TokenSource {
  set: string | null;
  /** JSON Pointer into the retained source document. */
  location: string;
  type: string | null;
  value: unknown;
  active: boolean;
  description?: string;
  extensions?: Record<string, unknown>;
}

export interface TokenTrace {
  path: string;
  type: string | null;
  authored: unknown;
  resolved: unknown;
  source: TokenSource | null;
  candidates: TokenSource[];
  references: string[];
  usedBy: string[];
  /** Portable declarations in this document, not observed or policy-checked usage. */
  declaredConsumers?: {
    roleId: string;
    label: string;
    bindings: { id: string; tool?: string; slot: string; modes?: string[] }[];
  }[];
  diagnostics: TokenDiagnostic[];
}

export interface TokenInspection {
  selection: TokenSelection;
  tokens: TokenTrace[];
  diagnostics: TokenDiagnostic[];
  truncated: boolean;
  /** Counts cover token references and declared roles in this document only. */
  scope: 'token-document';
}

export interface TokensAPI {
  /** The resolved token set for the active (or named) theme. */
  get(opts?: TokenResolveOptions): Promise<TokenSet>;
  /** Colour tokens as picker-ready swatches. */
  colors(opts?: TokenResolveOptions): Promise<ColorSwatch[]>;
  /** Resolve a `{dotted.path}` alias (or bare path) to its concrete value. */
  resolve(ref: string, opts?: TokenResolveOptions): Promise<unknown>;
  /** Resolution evidence for all retained sets, including inactive definitions. */
  inspect?(opts?: TokenResolveOptions): Promise<TokenInspection>;
  /**
   * Theme names declared in the document. Since v1.265 each entry may also carry
   * the theme's `id` (when the source has one) and its group's `kind`; in a group
   * that declares a kind, the canonical theme carries `canonical: true`.
   */
  themes(): Promise<{ name: string; group: string | null; id?: string; kind?: TokenAxisKind; canonical?: true }[]>;
  /**
   * Every theme group of the document with its kind, canonical option, rotation
   * and options (plans/319). Optional/additive: an older shell omits it, and a
   * tool feature-detects the member. Structure only, so it ignores the read options the
   * other members take.
   */
  axes?(): Promise<TokenAxisInfo[]>;
  /**
   * The family (plans/319): every colourway's colour for one role, canonical
   * first, in the look this read resolves to. `role` is a semantic slot name
   * (`primary`, the default, or `secondary`, `on-primary`, ...) or a full token
   * path. `opts` works as it does for `get()`: the document's choices apply, a
   * `theme` picks a look and keeps the rest, a `selection` replaces them. The
   * colourway group is set per member, so the answer lists every lead whatever
   * colourway the artefact uses; the member the read resolves to has `active`.
   *
   * An empty list when the design system has no colourway group, and a colourway
   * whose role does not resolve to a colour is left out. A tool treats fewer than
   * two members as no family and draws exactly as it would without this member.
   * Optional/additive: feature-detect the member.
   */
  family?(role?: string, opts?: TokenResolveOptions): Promise<TokenFamilyMember[]>;
  /**
   * Every design system this device holds, in the host's own listing order
   * (v1.173, plans/186). Optional/additive: a shell that holds exactly one system
   * omits it, and a tool feature-detects rather than assuming a list exists.
   *
   * A READ. Switching stays a host concern: which system is active decides the
   * colours, fonts and logos of every surface at once, so it is the person's
   * choice through host UI, never a tool's side effect (the plan-47 posture).
   */
  list?(): Promise<DesignSystemSummary[]>;
  /**
   * The active design system, or null where the host has none to name (v1.173).
   * What `tokens.get()` and `tokens.colors()` are already resolving against, made
   * legible so a tool can say which system it drew with.
   */
  active?(): Promise<DesignSystemSummary | null>;

  /**
   * One immutable snapshot of the effective render context (v1.184, plans/222):
   * the RAW effective DTCG document, the active design system, the resolved design
   * VERSION it describes, and the theme selection that produced the canvas.
   *
   * A READ, for an exporter that has to preserve inheritance - the `.penpot` writer
   * carries this document's tokens/themes AND binds shapes to them, so the file
   * opens on the same theme the canvas was rendered with. Unlike the web bridge's
   * `raw()` (deliberately the editable HEAD), this follows the SAME resolver and
   * version ladder as `get()`/`colors()`/`resolve()`, so the tokens, palette and
   * canvas all describe one render and an unpublished head edit never leaks into
   * the file.
   *
   * Optional/additive: a third-party or older host without it still exports
   * geometry, with an honest report that token definitions were unavailable.
   */
  snapshot?(): Promise<TokensSnapshot>;
}

/**
 * The effective render context an exporter captures once (v1.184). Take it after
 * the export's normal settling, together with the document state it describes: a
 * design-system switch or input edit mid-export must not mix two snapshots.
 */
export interface TokensSnapshot {
  /**
   * The raw effective DTCG document for the RESOLVED render version - the same
   * document `get()`/`resolve()` read, not the editable head. Tokens-Studio shaped
   * (sets + `$themes` + `$metadata`) or a plain single-set DTCG doc. `null` when
   * the host holds no token definitions (geometry still exports).
   */
  document: unknown;
  /** Optional shell projection for rendering, such as isolated pinned font families.
   * Portable writers retain `document`; worker renderers prefer this projection. */
  renderDocument?: unknown;
  /** The active design system, or null where the host names none. Mirrors `active()`. */
  system: DesignSystemSummary | null;
  /**
   * The resolved design version this snapshot describes - a published version's id
   * or label, `latest`/`head` for the working head, or null for a host that does
   * not version its tokens. Never a version the render did not actually use.
   */
  version: string | null;
  /**
   * The theme selection that produced the canvas. `activeThemes` names the theme(s)
   * that were on (by name, id, or `group/name`), spanning independent groups;
   * `activeSets` names sets directly when there is no theme handle; `theme` is the
   * single name a URL/`get({theme})` pinned, when one was. An exporter passes this
   * straight to the writer so the file's active selection matches the render.
   */
  selection: { activeThemes?: string[]; activeSets?: string[]; theme?: string | null; choices?: Record<string, string> };
}

/**
 * One design system as the host describes it (v1.173). `id` is the addressable
 * slug (`default`, `shipped`, `acme-2026`), `label` the team's own naming.
 *
 * `source` says where the material came from: `shipped` with the build, `local`
 * made on this device, `file` imported from a pack, `hosted` linked to an instance
 * and kept current from it (`instance` is that base URL, and it is the only source
 * that carries one). `locked` means the material is read-only, so a tool that
 * writes tokens knows to offer a copy instead. `headId` is the tokens asset id the
 * system resolves against, and it is null for a host that does not address its
 * tokens by id.
 */
export interface DesignSystemSummary {
  id: string;
  label: string;
  source: 'shipped' | 'local' | 'file' | 'hosted';
  active: boolean;
  locked: boolean;
  headId: string | null;
  instance?: string;
}

/** A resolved token set. Returned by tokens.get(); see engine/src/tokens.js. */
export interface TokenSet {
  readonly size: number;
  has(path: string): boolean;
  get(path: string): TokenEntry | undefined;
  resolve(ref: string): unknown;
  query(filter?: { type?: string }): TokenEntry[];
  colors(): ColorSwatch[];
  /** Since v1.265 an entry may carry the source `id`, its group's `kind` and, in a group with a kind, `canonical: true`. */
  themes(): { name: string; group: string | null; id?: string; kind?: TokenAxisKind; canonical?: true }[];
}

export interface TokenEntry {
  path: string; // dotted path, e.g. 'color.brand.jungle'
  type: string | null; // DTCG $type (possibly inherited from a group)
  value: unknown; // resolved value (aliases already followed)
  description: string | null; // DTCG $description
  extensions: Record<string, unknown> | null; // DTCG $extensions (e.g. CMYK anchors)
}

export interface ColorSwatch {
  /** Canonical CSS colour before sRGB fallback mapping. */
  css?: string;
  ref: string; // canonical reference, e.g. '{color.brand.jungle}'
  path: string;
  name: string; // display label ($description, or prettified leaf)
  group: string | null; // display group (parent group, prettified)
  value: string; // resolved colour as a hex string
  description: string | null;
  cmyk: number[] | null; // [C,M,Y,K] from $extensions, when present
  spot: SpotColor | null; // named spot/Pantone lock from $extensions, when present
  /**
   * Per-target overrides the brand AUTHORED for this colour, keyed by target id
   * (a CSS space name, or `icc:<digest>:<intent>` - see the engine's
   * `gamutSourceId`). Empty for a token with none, which is most of them.
   *
   * `value` above already honours an authored **sRGB** face, so a consumer that
   * only paints does not need to read this - it is here for a consumer that has
   * to know WHICH faces were chosen rather than computed, or that can honour a
   * wider target than sRGB.
   *
   * v1.77.
   */
  faces?: Record<string, string | number[]>;
}

/** A named spot ink (e.g. Pantone) locked onto a token. Independent of the
 * sibling `cmyk` lock above - a token may carry either, both, or neither:
 *  `cmyk` is the process-colour fallback (preview, non-PDF export, and the
 *  Separation alternate-space value) whether or not a spot is also set; when
 *  neither is set it's derived from the token's own colour at export time. */
export interface SpotColor {
  name: string;
  book?: string;
  /** (v1.91) The tactile finish this ink IS, when it is not an ink at all: a foil,
   *  an emboss/deboss, a spot varnish, a cut/crease. Absent = an ordinary spot ink,
   * which is every spot lock that exists today - so this is strictly additive
   *  and changes nothing for them. `name` still says WHICH ('Gold', 'Silver',
   *  'Die'); `finish` says what the press DOES with it. */
  finish?: FinishKind;
}

/**
 * (v1.91) Print finishes a brand can declare on a spot.
 *
 * A finish ink is not a colour. It is something the press applies as its own
 * PLATE - a foil stamp, an embossing/debossing die, a spot-UV varnish screen, a
 * cutting or creasing rule - so it never contributes to the process build and
 * must not be gamut-mapped, previewed as a pigment, or merged into CMYK. It
 * rides the spot contract because a finish already IS a named separation whose
 * "value" is a press instruction, not because it is a kind of colour.
 *
 * The contract defines only how a finish is SPELLED. The *offered* set is brand
 * data: a brand declares the finishes it can actually buy, on its own colour
 * tokens (plans/67-tactile-brand-control.md). That is why the union is open - the
 * listed ids are the canonical spellings (they become plate names), while the
 * trailing `(string & {})` lets a house process ('letterpress', 'thermography',
 * 'holographic-foil') exist with no type, schema, or engine release. Editor
 * autocomplete still offers the known members.
 *
 * A consumer MUST treat an unrecognised value as "a finish I do not know how to
 * render" - never as an error, and never as a reason to discard the surrounding
 * ink, whose `name` is the one field a plate actually needs. Any `switch` over
 * it needs a `default:` arm.
 */
export const KNOWN_FINISH_KINDS = [
  'foil',
  'emboss',
  'deboss',
  'spot-uv',
  'soft-touch',
  'cut',
  'crease',
  'perforate',
] as const;

export type FinishKind = (typeof KNOWN_FINISH_KINDS)[number] | (string & {});
