/**
 * Every same-site section link in the built English docs points at a real section,
 * and no English page repeats an id (plan 277 step 2).
 *
 * A dead anchor fails quietly: the browser opens the page at its top and the reader
 * never learns the section they were sent to exists somewhere else. Five of these
 * reached the published site with nothing to catch them, and duplicate heading ids
 * made the second of two same-named sections unreachable by link.
 *
 * Reads the built site (gitignored, from `pnpm run build:info`) and skips when that build is absent.
 * Links are followed the way a reader's browser follows them: through the flat
 * /info/<slug>.html redirect stub to the door page, and through a section move
 * (docs/section-moves.json), whose script forwards an old anchor to its new home.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BUILT = join(ROOT, 'shells/web/public/info');
const DOORS = ['start', 'create', 'build', 'operate', 'trust'];
const MOVES: Record<string, Record<string, { slug: string; anchor: string }>> =
  JSON.parse(readFileSync(join(ROOT, 'docs/section-moves.json'), 'utf-8'));

/** Pages whose duplicate ids are known and owned elsewhere, each with its reason.
 *  The check fails both ways: a listed page that no longer repeats an id must leave. */
const DUPLICATE_IDS_KNOWN: Record<string, string> = {
  // "Hear it" appears twice; the page is being reworded under the new rule against
  // headings that end in "it" (another session, 26 September 2026).
  'trust/beatrice-warde.html': 'two "Hear it" headings; reworded in a concurrent edit',
};

const skip = !existsSync(join(BUILT, 'create', 'using.html')) ? 'no built /info on disk - run `pnpm run build:info`' : false;

const REFRESH = /<meta http-equiv="refresh" content="0;\s*url=([^"]+)"/i;

/** The English pages a reader can open: the landing plus every door page (stubs excluded). */
function englishPages(): string[] {
  const out: string[] = ['index.html'];
  for (const door of DOORS) {
    const dir = join(BUILT, door);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) if (f.endsWith('.html')) out.push(`${door}/${f}`);
  }
  return out.filter((rel) => !REFRESH.test(readFileSync(join(BUILT, rel), 'utf-8')));
}

const idCache = new Map<string, Set<string>>();
function idsOf(rel: string): Set<string> {
  let ids = idCache.get(rel);
  if (!ids) {
    const html = readFileSync(join(BUILT, rel), 'utf-8');
    ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]!));
    idCache.set(rel, ids);
  }
  return ids;
}

/** /info/<path>.html → the built page a browser ends up on, following one redirect stub. */
function landing(path: string): string | null {
  const rel = path.replace(/^\/info\//, '');
  const abs = join(BUILT, rel);
  if (!existsSync(abs)) return null;
  const m = REFRESH.exec(readFileSync(abs, 'utf-8'));
  if (!m) return rel;
  const next = m[1]!.replace(/[#?].*$/, '').replace(/^\/info\//, '');
  return existsSync(join(BUILT, next)) ? next : null;
}

const slugOf = (rel: string): string => rel.slice(rel.lastIndexOf('/') + 1, -'.html'.length);

test('every same-site section link in the English docs points at a real section', { skip }, () => {
  const dead: string[] = [];
  for (const rel of englishPages()) {
    const html = readFileSync(join(BUILT, rel), 'utf-8');
    for (const m of html.matchAll(/href="(\/info\/[^"#?]+\.html)(?:\?[^"#]*)?#([^"]+)"/g)) {
      const [, path, anchor] = m as unknown as [string, string, string];
      const target = landing(path);
      if (!target) { dead.push(`${rel}: ${path}#${anchor} (no such page)`); continue; }
      if (idsOf(target).has(anchor)) continue;
      const moved = MOVES[slugOf(target)]?.[anchor];
      if (moved) continue;
      dead.push(`${rel}: ${path}#${anchor} (no id "${anchor}" on ${target})`);
    }
    for (const m of html.matchAll(/href="#([^"]+)"/g)) {
      const anchor = m[1]!;
      // "#top" needs no element: HTML defines it as the start of the document.
      if (anchor === 'top') continue;
      if (!idsOf(rel).has(anchor) && !MOVES[slugOf(rel)]?.[anchor]) dead.push(`${rel}: #${anchor} (same page)`);
    }
  }
  assert.deepEqual([...new Set(dead)], [], 'Repair the link or add a docs/section-moves.json entry for a section that moved.');
});

test('no English docs page repeats an id', { skip }, () => {
  const repeated: Record<string, string[]> = {};
  for (const rel of englishPages()) {
    // Inlined SVG artwork carries its own internal ids (gradients, clip paths); those
    // are scoped to the drawing and are not link targets, so only markup outside it counts.
    const html = readFileSync(join(BUILT, rel), 'utf-8').replace(/<svg[\s\S]*?<\/svg>/g, '');
    const seen = new Map<string, number>();
    for (const m of html.matchAll(/\sid="([^"]+)"/g)) seen.set(m[1]!, (seen.get(m[1]!) ?? 0) + 1);
    const dups = [...seen].filter(([, n]) => n > 1).map(([id, n]) => `${id} x${n}`);
    if (dups.length) repeated[rel] = dups;
  }
  const unexpected = Object.keys(repeated).filter((rel) => !(rel in DUPLICATE_IDS_KNOWN));
  const stale = Object.keys(DUPLICATE_IDS_KNOWN).filter((rel) => !(rel in repeated));
  assert.deepEqual(unexpected.map((rel) => `${rel}: ${repeated[rel]!.join(', ')}`), [], 'Rename a repeated heading, or give the element a unique id.');
  assert.deepEqual(stale, [], 'These pages no longer repeat an id: remove them from DUPLICATE_IDS_KNOWN.');
});
