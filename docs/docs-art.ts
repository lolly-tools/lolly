// SPDX-License-Identifier: MPL-2.0
/**
 * Banked docs art - the masthead bank and the figure bank (plans/105 section 6).
 *
 * Two directories, one pipeline. `docs/mastheads/<id>.svg|.html` is a stable
 * library a page maps into by slug; `docs/figures/<page-slug>-<name>.svg|.html`
 * is bespoke artwork a page references from its own prose with a
 * `::: figure <id>` fence. Both are signed at bank time
 * (scripts/sign-docs-art.ts) and both are INLINED into the page here.
 *
 * WHY THIS MODULE EXISTS SEPARATELY FROM build.ts. Everything here is pure - 
 * it reads a file and returns a string - and docs/build.ts runs its own
 * `build()` on import, so nothing in that file can be exercised by a test
 * without building the whole site. The parts a test must be able to prove (the
 * manifest really leaves the inlined copy; the ids really get namespaced; the
 * credential really points at the same file that was inlined) live here.
 *
 * ── The design axiom: presentation copy ≠ verification copy ──────────────────
 *
 * A C2PA hash binding covers FILE BYTES, not DOM. Inlining an artifact takes the
 * file off the page, so the inlined copy MUST NOT carry the manifest: a reader
 * who saved that markup out of devtools would hold a file whose credential fails
 * to validate - a false negative on a genuine Lolly asset, which is worse than
 * no credential at all. The signed file stays served at /info/<bank>/<file> and
 * the credential line points there, so "Check it yourself", "Get the signed
 * file" and "Copy signed source" all act on the real bytes.
 *
 * That is the same contract SHOWCASE_SCRIPT keeps at runtime for the one inlined
 * screenshot on the site (docs/build.ts). Its strip + id-namespace rules are the
 * ones promoted here, and {@link stripArtForInline} is the single build-time
 * implementation both banked paths use. The showcase's copy stays inline in that
 * script because it runs in the browser; tests/docs-figures.test.ts pins the two
 * in step.
 *
 * The strip is also VERIFIED rather than assumed: if a carrier survives it (a
 * shape neither rule anticipated), the inline is refused and the caller warns.
 * A page with no art is a small loss; a page shipping a broken credential is a
 * claim we cannot stand behind.
 *
 * ── The same-file rule ───────────────────────────────────────────────────────
 *
 * A localized variant (`<id>.<lang>.svg`) is its OWN banked, signed artifact.
 * Everything downstream - the bytes inlined, the path the credential is read
 * from, the URL its actions point at - is derived from the ONE filename this
 * module resolved, never re-derived from the id. What the reader sees is what
 * the credential describes.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { stripPlacedArmorLine } from '../engine/src/c2pa-containers.ts';

/** The two banks. Same pipeline, different lifecycles (plan section 6). */
export type ArtBank = 'mastheads' | 'figures';

export interface DocsArt {
  bank: ArtBank;
  /** The canonical id - the map value / the fence's id line. */
  id: string;
  /** The file actually resolved, e.g. `hero.svg` or `hero.de.svg`. */
  file: string;
  /** Absolute path to the banked source. */
  path: string;
  /** The served URL of the SAME file, e.g. `/info/mastheads/hero.de.svg`. */
  src: string;
  /** `svg` (section A.3.3 metadata carrier) or `html` (Lolly fragment armour profile). */
  kind: 'svg' | 'html';
  /** The id-space prefix this artifact's inlined copy is namespaced with. */
  prefix: string;
}

/** Bank order: a locale variant first, then the English/base artifact. */
const EXTS = ['svg', 'html'] as const;

/** An id is a filename component, so it is kept to the shape a slug already has. */
const ID_RE = /^[a-z0-9][a-z0-9-]*$/;

/**
 * Resolve a banked artifact to ONE file - the locale variant when the bank has
 * one for this pass, else the base artifact (the `localizedShot` pattern).
 *
 * Returns null for an unknown id, an id that is not a plain slug (a bank lookup
 * must never be able to walk out of its directory), or a bank that does not
 * exist in this checkout. Callers warn; nothing here throws.
 */
export function resolveDocsArt(
  bank: ArtBank,
  id: string,
  opts: { dir: string; lang?: string },
): DocsArt | null {
  if (!ID_RE.test(id)) return null;
  const dir = resolve(opts.dir, bank);
  const lang = opts.lang && opts.lang !== 'en' ? opts.lang : null;
  const names = [
    ...(lang ? EXTS.map(e => `${id}.${lang}.${e}`) : []),
    ...EXTS.map(e => `${id}.${e}`),
  ];
  for (const file of names) {
    const path = resolve(dir, file);
    if (!existsSync(path)) continue;
    return {
      bank,
      id,
      file,
      path,
      src: `/info/${bank}/${file}`,
      kind: file.endsWith('.svg') ? 'svg' : 'html',
      // Per BANK and per ID: two banks may legitimately hold the same id, and a
      // page may inline several artifacts at once.
      prefix: `${bank === 'mastheads' ? 'mast' : 'fig'}-${id}-`,
    };
  }
  return null;
}

/**
 * The carriers a presentation copy must not keep.
 *
 * `<metadata>` is where placeSvg puts `<c2pa:manifest>` (engine/src/c2pa-containers.ts).
 * section A.9's armour line is removed by the ENGINE's own {@link stripPlacedArmorLine} - 
 * the placer's inverse, imported rather than re-written. This file used to carry a
 * third hand-made copy of that rule, and like the second one it was lazy across
 * lines (`[\s\S]*?` to the first `-----END`), so any content between a quoted
 * `-----BEGIN` and a later `-----END` vanished from the rendered page. On a docs
 * site whose subject is C2PA, a figure that DOCUMENTS the armour format is ordinary
 * content, and it was being silently truncated.
 */
const STRIP: ReadonlyArray<RegExp> = [
  /<\?xml[^>]*\?>/g,
  /<c2pa:manifest(?=[\s>])[\s\S]*?<\/c2pa:manifest>/gi,
  // …and the wrapper placeSvg synthesises around it when the artifact had none.
  // An artifact's OWN <metadata> (RDF licensing, editor provenance) is left alone:
  // the presentation copy is the artifact minus its credential, not minus whatever
  // else its author put there.
  /<metadata>\s*<\/metadata>/gi,
  /\s+xmlns:c2pa="http:\/\/c2pa\.org\/manifest"/g,
];

/** Anything matching this after the strip means a CARRIER survived - the C2PA
 *  manifest element, its namespace declaration, an armour delimiter, or section A.7's
 *  script element. A plain `<metadata>` is no longer on this list because it is no
 *  longer stripped: it is the artifact's own (RDF licensing, editor provenance),
 *  and a presentation copy is the artifact minus its credential, nothing else. */
const RESIDUAL = /-----(?:BEGIN|END) C2PA MANIFEST-----|<c2pa:manifest\b|xmlns:c2pa\s*=|<script[^>]+type\s*=\s*["']?application\/c2pa/i;

/**
 * Turn a banked artifact's bytes into the copy that goes on the page: manifest
 * carrier removed, XML prolog removed, every id it defines namespaced.
 *
 * The namespacing is not cosmetic. An inlined SVG joins the PAGE's id space, so
 * an artifact's `clipPath`/`filter`/`gradient` id can collide with another
 * artifact's - and the loser silently renders wrong (a clip from someone else's
 * drawing). Same three references the showcase rewrites: the definition, `url(#…)`
 * paint references, and `href="#…"` (which also covers `xlink:href`).
 *
 * Throws when a carrier survives - see the module comment. The caller warns and
 * skips the art rather than shipping a copy that would fail its own credential.
 */
export function stripArtForInline(source: string, prefix: string): string {
  let out = stripPlacedArmorLine(source);
  for (const re of STRIP) out = out.replace(re, '');
  out = out
    .replace(/\bid="([^"]+)"/g, `id="${prefix}$1"`)
    .replace(/url\(#([^)]+)\)/g, `url(#${prefix}$1)`)
    .replace(/\bhref="#([^"]+)"/g, `href="#${prefix}$1"`);
  if (RESIDUAL.test(out)) {
    throw new Error('a C2PA carrier survived the strip - the inlined copy would fail its own credential');
  }
  return out.trim();
}

/**
 * Read a banked artifact and return the presentation copy, or the reason there
 * isn't one. Never throws: an unreadable artifact costs a page its art, not its
 * build.
 */
export function inlineDocsArt(art: DocsArt): { html: string } | { error: string } {
  let source: string;
  try {
    source = readFileSync(art.path, 'utf-8');
  } catch (err) {
    return { error: `${art.file} could not be read (${(err as Error).message})` };
  }
  if (!source.trim()) return { error: `${art.file} is empty` };
  try {
    return { html: stripArtForInline(source, art.prefix) };
  } catch (err) {
    return { error: `${art.file}: ${(err as Error).message}` };
  }
}

/**
 * `::: figure <id>` - the fence label, parsed.
 *
 * The id line is CANONICAL: it is the same token in all 27 locale copies of the
 * page, so a translator never has to know what it means and an edit to it never
 * strands 26 sidecars (the shot-recipe rule). Everything inside the fence is
 * ordinary prose - the caption - and localizes like any paragraph.
 */
// parseFigureFence + figureBlock now live in @lolly-tools/docs-render (packages/docs-render/
// src/art.ts) so the shared renderer can compose figures without importing this module.

/**
 * The masthead band with banked art in place of the default chip canvas.
 *
 * Same geometry, same scrims, same hoisted h1 - the only difference is what is
 * painted behind it, which is why this composes the same wrapper the default
 * band uses rather than a second one. The art is `aria-hidden`: it is
 * decorative even when it carries words, because the h1 IS the page's name
 * (plan section 6, words + locale charter).
 */
export function mastheadArtBand(parts: { art: string; heading: string; credential: string }): string {
  return `<div class="docs-masthead docs-masthead--art">`
    + `<div class="docs-mast-art" aria-hidden="true">${parts.art}</div>`
    + `<div class="docs-mast-inner">${parts.heading}</div>`
    + parts.credential
    + `</div>`;
}

// figureBlock moved to @lolly-tools/docs-render (packages/docs-render/src/art.ts).
