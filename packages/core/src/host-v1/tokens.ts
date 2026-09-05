// SPDX-License-Identifier: MPL-2.0

// ─── Design tokens ────────────────────────────────────────────────────────────

export interface TokensAPI {
  /** The resolved token set for the active (or named) theme. */
  get(opts?: { theme?: string }): Promise<TokenSet>;
  /** Colour tokens as picker-ready swatches. */
  colors(opts?: { theme?: string }): Promise<ColorSwatch[]>;
  /** Resolve a `{dotted.path}` alias (or bare path) to its concrete value. */
  resolve(ref: string, opts?: { theme?: string }): Promise<unknown>;
  /** Theme names declared in the document. */
  themes(): Promise<{ name: string; group: string | null }[]>;
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
  themes(): { name: string; group: string | null }[];
}

export interface TokenEntry {
  path: string; // dotted path, e.g. 'color.brand.jungle'
  type: string | null; // DTCG $type (possibly inherited from a group)
  value: unknown; // resolved value (aliases already followed)
  description: string | null; // DTCG $description
  extensions: Record<string, unknown> | null; // DTCG $extensions (e.g. CMYK anchors)
}

export interface ColorSwatch {
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
