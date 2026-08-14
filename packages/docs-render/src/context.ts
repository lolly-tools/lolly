// The DocsRenderContext capability bridge — the M0b seam.
//
// This is the ONE thing that differs between the two consumers of the shared docs
// renderer: the BUILD-TIME static generator (docs/build.ts) reads facts from the
// filesystem + C2PA manifests; the RUNTIME in-app docs view (shells/web) reads the
// same facts from a shipped docs-manifest.json + fetch. The resolver returns DATA;
// the shared renderer owns every byte of HTML assembly — so identical facts produce
// byte-identical markup on both sides. See plan this-is-a-very-sparkling-eich, M0b.
//
// NOTE (M0b, prep): these are the TARGET types. The renderer (inline/mdToHtml/the
// credential assembly) is not wired through them yet — that surgery lands on a clean
// build.ts. Until then this file is types-only (zero runtime) and typechecks alone.

/** Anatomy of a served shot file. Mirrors docs/shot-anatomy.ts `ShotAnatomy`. */
export interface CredentialAnatomy {
  kind: 'vector' | 'raster';
  /** <path> elements. 0 on a raster. */
  paths: number;
  /** Path anchor vertices — a text-heavy shot outlines to thousands. 0 on a raster. */
  nodes: number;
  /** <g> elements. 0 on a raster. */
  groups: number;
  /** Embedded <image> elements (a raster baked into the SVG). */
  images: number;
  /** Total drawable elements. */
  elements: number;
  /** The committed file's size on disk, in bytes. */
  bytes: number;
}

/** The capture-recipe facts a credential states. A subset of the shots pipeline's
 *  `ShotDef` (scripts/lib/shot-compare.ts). Null for banked art (no capture recipe). */
export interface CredentialRecipe {
  width?: number;
  height?: number;
  dpi?: number;
  /** True when captured with the DOM→SVG walker rather than the print path. */
  walker?: boolean;
}

/**
 * Everything the credential line's HTML assembly needs, read from the SERVED bytes.
 * Mirrors docs/shot-provenance.ts `ShotProvenance` + anatomy + the recipe subset.
 * The build-time context reads these from the file (C2PA decode + a byte parse); the
 * runtime context reads them from the shipped docs-manifest.json. `null` overall (the
 * return of DocsRenderContext.credential) means the file carries no readable credential
 * — the renderer then emits no line, exactly as today.
 */
export interface CredentialFacts {
  /** Who signed it: the certificate's organisation, else its common name. */
  signer: string | null;
  /** Claim generator, e.g. "Lolly 1.90.0". */
  generator: string | null;
  /** When the claim was made, ISO-8601; the renderer slices to the day. */
  when: string | null;
  /** Capture dimensions as the credential records them, e.g. "1440 × 1200 px" (label only). */
  dimensions: string | null;
  /** Set when the credential declares AI-generated or AI-composited content. */
  ai: 'generated' | 'composite' | undefined;
  /** §18.28 c2pa.ai-disclosure model name, e.g. "Claude Fable 5". */
  model: string | null;
  /** Human-oversight level (§18.28.4), verbatim: fully_autonomous | prompt_guided | human_validated. */
  oversight: string | null;
  /** Byte-level anatomy, or null when the file cannot be parsed for it. */
  anat: CredentialAnatomy | null;
  /** The capture recipe, or null for banked art (which has none, and must not borrow one). */
  recipe: CredentialRecipe | null;
  /** The served URL the verify/download links point at, e.g. "/info/shots/x.svg". */
  src: string;
  /** True only where the served file is pasteable source text (banked SVG/HTML art). */
  canCopySource: boolean;
}

/** A resolved screenshot: the localized/dark file variants + intrinsic pixel sizes.
 *  Encapsulates build.ts's localizedShot + darkShot + shotSize. */
export interface ShotResolution {
  /** The resolved filename, e.g. "gallery.de.svg". */
  file: string;
  /** The served URL, "/info/shots/<file>". */
  src: string;
  width?: number;
  height?: number;
  /** The dark twin, when this shot has one (a second <img class="shot-alt">). */
  dark?: { file: string; src: string; width?: number; height?: number };
}

/** A resolved banked masthead/figure: the manifest-stripped inline HTML + served src.
 *  Encapsulates resolveDocsArt + inlineDocsArt (docs/docs-art.ts). The pure composition
 *  (mastheadArtBand / figureBlock) lives in the renderer and reads this + a credential. */
export interface ArtResolution {
  /** stripArtForInline output — namespaced ids, C2PA manifest removed. */
  html: string;
  /** The bank file, for the credential (read from the SAME file that was inlined). */
  file: string;
  /** The served URL, e.g. "/info/mastheads/<file>". */
  src: string;
}

/** A resolved `::: showcase` recipe: the animation camera frame read from the built file.
 *  Encapsulates buildShowcase's existsSync + viewBox read + shotSize. Null → the renderer
 *  bails to a plain <img> screenshot (never drops the shot). */
export interface ShowcaseResolution {
  /** The SVG viewBox, "minX minY width height" — the animation's start/end frame. */
  viewBox: string;
  file: string;
  src: string;
  width?: number;
  height?: number;
}

/**
 * The capability bridge for docs rendering. build.ts implements it with thin adapters
 * over its existing filesystem/C2PA helpers; the in-app view implements it over the
 * shipped docs-manifest.json + fetch. Method names track the resolvers the renderer
 * calls today, so the eventual build.ts adapter is a near 1:1 wrap — the only genuine
 * refactor is `credential`, whose HTML assembly moves INTO the renderer (both consumers
 * must emit identical markup) while its facts come from here.
 */
export interface DocsRenderContext {
  /** The locale being rendered (replaces build.ts's module-global `activeLang`). */
  readonly lang: string;
  /** The BCP-47 htmlLang for localeNum/approxCount grouping (LANG_META[lang].htmlLang). */
  readonly htmlLang: string;
  /** i18n lookup with English-key identity fallback (replaces the module-global `t()`).
   *  For the English static build the catalog is empty, so `t` is the identity — the
   *  in-app English render must match that to stay byte-identical. */
  t(en: string): string;
  /**
   * A unique credential-line id ("shot-cred-N"). The BUILD impl closes over ONE
   * process-global counter reused across every page and locale, reproducing today's
   * exact monotonic sequence (byte-identical). The in-app impl uses a fresh per-mount
   * counter (ids need only be unique within the mounted page). NEVER a module global
   * inside this package.
   */
  nextCredId(): string;
  /** Prefer a localized shot (<slug>.<lang>.<ext>); null → caller uses the English baseline. */
  localizedShot(slug: string, ext: string): string | null;
  /** The dark twin filename paired with a shot file, or null. */
  darkShot(file: string): string | null;
  /** A served file's intrinsic pixel size (the fit-content 0×0-deadlock guard). `assetSrc`
   *  names a non-shot file's served URL so the impl can locate a page asset / mascot. */
  shotSize(file: string, assetSrc?: string): { w: number; h: number } | null;
  /**
   * The Content-Credential FACTS for a served file, or null when it carries none.
   * `assetSrc` names a non-shot file's served URL (a page asset / mascot); `art` marks
   * banked source-text art (sets `canCopySource`, and suppresses the capture recipe so
   * banked art never borrows a screenshot's viewport facts).
   */
  credential(file: string, opts?: { assetSrc?: string; art?: boolean }): CredentialFacts | null;
  /** The "Try it in the app" route for a shot file's slug, or null. */
  tryLink(file: string): { route: string } | null;
  /** Resolve a `::: showcase` recipe's slug to its animation frame, or null (bail to a plain shot). */
  showcase(slug: string): ShowcaseResolution | null;
  /** Resolve a banked masthead/figure id to its stripped inline HTML + served src, or null. */
  art(bank: 'mastheads' | 'figures', id: string): ArtResolution | null;
}
