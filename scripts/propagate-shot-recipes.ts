// SPDX-License-Identifier: MPL-2.0
/**
 * Propagate screenshot-recipe IMAGES from each English docs page into its translated
 * sidecars (docs/i18n/<lang>/<slug>.md), so a localized page shows a screenshot at all.
 *
 * The recipe URL stays canonical (English route) in every locale; the docs build
 * swaps the <img src> to a localized shot `<slug>.<lang>.<ext>` when the pipeline has
 * captured one (build.ts `localizedShot`), else the English baseline. So this only has
 * to place the SAME recipe image token at the SAME structural spot in each locale.
 *
 * Anchor = heading ordinal (locales mirror the English heading structure). Idempotent:
 * a page that already declares the recipe (by slug) keeps its POSITION. Only the image
 * token is copied - any trailing prose on the English line is already translated in the
 * locale page. Run after adding or moving a recipe, before `loldev shots`.
 *
 * Two passes, and the second one matters more than it looks:
 *   INSERT - a slug the locale page doesn't have yet, placed under its heading ordinal.
 *   SYNC - a slug it already has, whose token has since CHANGED in English.
 * Sync exists because the recipe query is not decoration: build.ts reads `format=` off
 * the LOCALE page's own token to pick `/info/shots/<slug>.<lang>.<ext>` (build.ts:383-393).
 * So when English moves a recipe from `format=png` to `format=svg&walker=1`, a
 * skip-if-present propagate leaves 26 locales pointing at a .png that the run has just
 * retired - every translated page 404s its screenshot, and nothing in the pipeline
 * notices because the orphan check only reads English. Keeping the token verbatim in
 * every locale is what makes the recipe canonical in fact and not just in the comment.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseShotRecipes } from './lib/shot-compare.ts';

const ROOT = resolve(fileURLToPath(import.meta.url), '..', '..');
const DOCS = join(ROOT, 'docs');
const I18N = join(DOCS, 'i18n');

const HEADING = /^#{1,6}\s/;
const RECIPE_IMG = /!\[[^\]]*\]\(\/t\/url-shot\?[^)\s]+\)/g;

const headingLineIdxs = (lines: string[]): number[] =>
  lines.flatMap((l, i) => (HEADING.test(l) ? [i] : []));

/** Each recipe image in the English page + the ordinal of the heading it sits under. */
function anchored(md: string): Array<{ token: string; slug: string; ord: number }> {
  const lines = md.split('\n');
  const heads = headingLineIdxs(lines);
  const out: Array<{ token: string; slug: string; ord: number }> = [];
  lines.forEach((line, i) => {
    for (const m of line.matchAll(RECIPE_IMG)) {
      const token = m[0];
      // token ends with the markdown ")" - drop it before parsing, else filename= would
      // capture "gallery)" and never match the clean slug in the idempotency have-set.
      const slug = new URLSearchParams(token.slice(token.indexOf('?') + 1, -1)).get('filename') ?? '';
      let ord = -1;
      for (let h = 0; h < heads.length && heads[h]! <= i; h++) ord = h;
      out.push({ token, slug, ord });
    }
  });
  return out;
}

const locales = readdirSync(I18N, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

let inserted = 0;
let synced = 0;
let skipped = 0;
let noAnchor = 0;
const touched: string[] = [];

for (const f of readdirSync(DOCS).sort()) {
  if (!f.endsWith('.md')) continue;
  const recipes = anchored(readFileSync(join(DOCS, f), 'utf-8'));
  if (!recipes.length) continue;

  for (const loc of locales) {
    const p = join(I18N, loc, f);
    if (!existsSync(p)) continue; // this page isn't translated in this locale
    const md = readFileSync(p, 'utf-8');
    const have = new Set(parseShotRecipes(md).recipes.map((r) => r.slug));

    // SYNC first, in place: rewrite any token whose slug matches an English recipe but
    // whose query has drifted. Done on the raw text before the insert pass splits it, so
    // a page that only needs syncing still gets written.
    const canonical = new Map(recipes.map((r) => [r.slug, r.token]));
    let text = md;
    text = text.replace(RECIPE_IMG, (tok) => {
      const slug = new URLSearchParams(tok.slice(tok.indexOf('?') + 1, -1)).get('filename') ?? '';
      const want = canonical.get(slug);
      if (!want) return tok;
      // Keep the locale's own translated alt text - only the recipe URL is canonical.
      const url = want.slice(want.indexOf('](') + 2, -1);
      const alt = tok.slice(0, tok.indexOf('](') + 2);
      const next = `${alt}${url})`;
      if (next !== tok) synced++;
      return next;
    });

    const lines = text.split('\n');
    const heads = headingLineIdxs(lines);

    // Group the still-missing recipes by heading ordinal, preserving source order.
    const byOrd = new Map<number, string[]>();
    for (const r of recipes) {
      if (have.has(r.slug)) { skipped++; continue; }
      if (r.ord < 0 || r.ord >= heads.length) { noAnchor++; continue; }
      (byOrd.get(r.ord) ?? byOrd.set(r.ord, []).get(r.ord)!).push(r.token);
    }
    // Insert bottom-up so earlier heading indices don't shift under later splices.
    for (const ord of [...byOrd.keys()].sort((a, b) => b - a)) {
      const at = heads[ord]! + 1;
      const ins = byOrd.get(ord)!.flatMap((tok) => ['', tok]);
      // …and a blank line AFTER the last token when the heading was immediately
      // followed by content. Without it the image and that first line become one
      // markdown paragraph: the token renders inline with the text instead of as
      // its own block. Only bites when a section opens on a non-blank line (a
      // code span, a list item), which is why it went unnoticed - it was wrong in
      // every locale's overview.md.
      if ((lines[at] ?? '').trim() !== '') ins.push('');
      lines.splice(at, 0, ...ins);
      inserted += byOrd.get(ord)!.length;
    }
    const next = lines.join('\n');
    if (next === md) continue; // nothing inserted AND nothing to sync
    writeFileSync(p, next, 'utf-8');
    touched.push(`${loc}/${f}`);
  }
}

console.log(
  `propagated: ${inserted} inserted, ${synced} synced, ${skipped} already-present, ${noAnchor} no-anchor`,
);
if (touched.length) console.log(`touched ${touched.length} files`);
