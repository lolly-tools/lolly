// SPDX-License-Identifier: MPL-2.0
/**
 * Rebuild the curated MilkDrop artist-preset list from butterchurn's own packs.
 *
 * WHY THIS EXISTS. `scripts/viz-preset-list.json` used to be a hand-assembled selection
 * scored by a local heuristic (authored `rating` + shader richness + a per-author cap).
 * That produced 220 entries of which only 162 were in ANY butterchurn pack, while 232
 * presets that butterchurn itself curates were missing — including one of the 29 that
 * butterchurnviz.com opens with. It also parsed names badly, leaving author fields like
 * "Anandamide_I_Don't_Want_" (a truncated filename prefix) on the cards.
 *
 * THE POPULARITY SIGNAL. There is no download count or star rating for MilkDrop presets.
 * The one real signal is which of its packs butterchurn ships a preset in, because those
 * were selected by people who know the corpus:
 *
 *   1 minimal   (29)  what butterchurnviz.com opens with — the greatest hits
 *   2 base      (71)  the rest of the default `butterchurnPresets` pack
 *   3 extra     (146) the first deep cut
 *   4 extra2    (122) the second
 *   5 md1       (87)  the MilkDrop 1 originals — historical rather than "better or worse"
 *
 * A preset in several packs takes its BEST (lowest) tier. Union across all five: 395, of
 * which 394 map to a converted file.
 *
 * NOTHING IS EVER DROPPED. Entries already in the list that no pack includes are kept at
 * tier 6, because a preset id is user data: it is stored in saved sessions and travels in
 * share URLs, so removing one silently changes somebody's finished card.
 *
 * PROVENANCE IS UNCHANGED. This writes identifiers only — filename, display name, author,
 * tier. The preset CONTENT still lives in the `butterchurn-presets` dependency and is
 * staged at build time by copy-viz-presets.ts into a gitignored directory. See that file.
 *
 * Run manually after a `butterchurn-presets` upgrade; not part of the build (the list is
 * committed so a clone without the dependency still knows what it would stage).
 *
 *   node scripts/build-viz-preset-list.ts [--write-tool]
 *
 * `--write-tool` also refreshes the audiogram manifest's `preset` select with the tier-1
 * and tier-2 presets — the ones worth putting in front of someone by name.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..');
const require_ = createRequire(import.meta.url);
const LIB = join(repo, 'node_modules/butterchurn-presets/lib');
const SRC = join(repo, 'node_modules/butterchurn-presets/presets/converted');
const LIST = join(here, 'viz-preset-list.json');
const TOOL = join(repo, 'community/audiogram/tool.json');

/** Pack → tier, best (lowest) wins. Order matters: earlier entries are better. */
const PACKS: Array<{ tier: number; module: string }> = [
  { tier: 1, module: 'butterchurnPresetsMinimal' },
  { tier: 2, module: 'butterchurnPresets' },
  { tier: 3, module: 'butterchurnPresetsExtra' },
  { tier: 4, module: 'butterchurnPresetsExtra2' },
  { tier: 5, module: 'butterchurnPresetsMD1' },
];

/** Tier given to a preset no pack includes — kept so no existing id disappears. */
const TIER_DEEP_CUT = 6;

/** Tiers offered by name in the tool's preset select. */
const TOOL_TIERS = 2;

/**
 * Mean-luminance bounds (0-255) for a preset worth OFFERING by name.
 *
 * Pack membership says a preset is admired; it does not say it renders. Measured on a real
 * GPU across all 452 (butterchurn-viz's own mount, injected audio, buffers reset then 48
 * warm frames — the audiogram's actual path), 7 render pure black and 24 blow out to a
 * flat white field. Both were reproduced with the brand wrapper BYPASSED and at tint
 * 'off', so they are how butterchurn renders these presets, not something we do to them.
 *
 * The blacks are a coherent class: pure feedback amplifiers with no light source of their
 * own. They come alive only by inheriting a previous preset's field, so they can look fine
 * in a live overlay that cycles — and render black in an export, which always starts cold.
 *
 * WITHHELD, NOT REMOVED. These stay in the list and stay staged, so an id already in a
 * saved session or a share URL still resolves; they are simply not put in front of anyone
 * to pick. Re-derive `l` by re-running the render audit after a dependency upgrade.
 */
const MIN_LUMA = 3;
const MAX_LUMA = 235;

interface Entry {
  /** Converted filename inside the dependency. */
  f: string;
  /** Display name. */
  n: string;
  /** Author as credited on the card. */
  a: string;
  /** 1 = in butterchurn's minimal pack. Kept for compatibility with older readers. */
  p: 0 | 1;
  /** Popularity tier, 1 (best) … 6 (in no pack). */
  t: number;
  /** Mean luminance (0-255) measured on a real GPU; absent if never audited. See MIN_LUMA. */
  l?: number;
}

/**
 * The id copy-viz-presets.ts will derive from a filename. Duplicated there ON PURPOSE
 * rather than shared: the two scripts must agree, and a collision has to be caught HERE,
 * where it can be reported, instead of silently overwriting a staged file there.
 *
 * THE SUFFIX IS NOT COSMETIC. 7% of the corpus (124 of 1754) has a slug longer than 72
 * characters, and truncating alone already collided in the SHIPPED list: "…Geiss Chaos
 * Tile edit + random color" and "…Geiss Chaos Tile edit 2" cut to the same id, so one
 * overwrote the other in the staged directory and one of the two has been rendering as
 * the wrong preset. So a truncated slug carries a hash of the full filename.
 *
 * The hash is applied on TRUNCATION, not on collision, so an id is a pure function of its
 * own filename — a collision-triggered suffix would depend on what else happened to be in
 * the list, and ids would churn every time the dependency added a preset. Ids are user
 * data: they sit in saved sessions and share URLs.
 */
function idFor(file: string): string {
  const slug = file
    .replace(/\.json$/, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  if (slug.length <= 72) return slug;
  // FNV-1a, 32-bit — a short stable discriminator, not a security hash.
  let h = 0x811c9dc5;
  for (let i = 0; i < file.length; i++) {
    h ^= file.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${slug.slice(0, 67)}-${h.toString(16).padStart(8, '0').slice(0, 4)}`;
}

/**
 * Split "Author - Title" — the convention 373 of the 395 pack presets follow. A title can
 * itself contain " - " ("Flexi, martin + geiss - dedicated to the sherwin maxawow"), so
 * only the FIRST separator splits. The 22 without one (e.g. "_Mig_085") have no author to
 * credit, and inventing one would put a false name on a card.
 */
function parseName(stem: string): { name: string; author: string } {
  const at = stem.indexOf(' - ');
  if (at < 0) return { name: stem, author: '' };
  const author = stem.slice(0, at).trim();
  const name = stem.slice(at + 3).trim();
  if (!author || !name) return { name: stem, author: '' };
  return { name, author };
}

function main(): void {
  if (!existsSync(SRC)) {
    console.error('[viz-presets] butterchurn-presets is not installed — nothing to rebuild');
    process.exitCode = 1;
    return;
  }

  // Pack membership → best tier per preset NAME (which is the converted file's stem).
  const tierOf = new Map<string, number>();
  for (const { tier, module } of PACKS) {
    const path = join(LIB, `${module}.min.js`);
    if (!existsSync(path)) { console.warn(`[viz-presets] pack missing: ${module}`); continue; }
    // These bundles export a FUNCTION carrying getPresets(); requiring one and reading its
    // keys directly yields nothing, which is what made the packs look unreadable before.
    const mod = require_(path) as { getPresets?: () => Record<string, unknown> };
    const names = typeof mod.getPresets === 'function' ? Object.keys(mod.getPresets()) : [];
    for (const n of names) if (!tierOf.has(n)) tierOf.set(n, tier);
    console.log(`[viz-presets] ${module}: ${names.length}`);
  }

  const files = new Set(readdirSync(SRC).filter(f => f.endsWith('.json')));
  const prior: Entry[] = existsSync(LIST) ? JSON.parse(readFileSync(LIST, 'utf8')) : [];

  // Measured luminance survives a rebuild: it comes from a GPU render audit, not from
  // anything this script can compute, so losing it would silently re-offer presets that
  // were withheld for rendering black.
  const lumaOf = new Map<string, number>();
  for (const e of prior) if (typeof e.l === 'number') lumaOf.set(e.f, e.l);

  const out = new Map<string, Entry>();

  // Everything butterchurn curates, best tier first.
  let unmatched = 0;
  for (const [name, tier] of tierOf) {
    const file = `${name}.json`;
    if (!files.has(file)) { unmatched++; continue; }
    const { name: n, author: a } = parseName(name);
    out.set(file, { f: file, n, a, p: tier === 1 ? 1 : 0, t: tier, ...(lumaOf.has(file) ? { l: lumaOf.get(file) } : {}) });
  }

  // Then everything the previous list carried that no pack includes — a preset id is user
  // data (saved sessions, share URLs), so dropping one rewrites somebody's finished card.
  let kept = 0;
  for (const e of prior) {
    if (out.has(e.f)) continue;
    if (!files.has(e.f)) continue; // gone from the dependency entirely; nothing to stage
    const { name: n, author: a } = parseName(e.f.replace(/\.json$/, ''));
    out.set(e.f, { f: e.f, n: n || e.n, a: a || e.a, p: 0, t: TIER_DEEP_CUT, ...(lumaOf.has(e.f) ? { l: lumaOf.get(e.f) } : {}) });
    kept++;
  }

  // A colliding id means two presets stage to one file and one silently wins.
  const byId = new Map<string, string>();
  const collisions: string[] = [];
  for (const f of out.keys()) {
    const id = idFor(f);
    const other = byId.get(id);
    if (other) collisions.push(`${id}: ${other} / ${f}`);
    else byId.set(id, f);
  }
  if (collisions.length) {
    console.error(`[viz-presets] ${collisions.length} id collision(s) — fix idFor() before staging:`);
    for (const c of collisions.slice(0, 10)) console.error(`  ${c}`);
    process.exitCode = 1;
    return;
  }

  const list = [...out.values()].sort((x, y) => x.t - y.t || x.a.localeCompare(y.a) || x.n.localeCompare(y.n));
  writeFileSync(LIST, `${JSON.stringify(list, null, 0)}\n`);

  const withheld = list.filter(e => !rendersWell(e));
  const perTier = list.reduce<Record<number, number>>((acc, e) => { acc[e.t] = (acc[e.t] ?? 0) + 1; return acc; }, {});
  if (withheld.length) {
    const black = withheld.filter(e => (e.l ?? 0) < MIN_LUMA).length;
    console.log(`[viz-presets] withholding ${withheld.length} from pickers — ${black} render black, ${withheld.length - black} blow out to white (still staged, ids still resolve)`);
  }
  console.log(`[viz-presets] wrote ${list.length} entries — per tier ${JSON.stringify(perTier)}`
    + `${unmatched ? `, ${unmatched} pack member(s) had no converted file` : ''}`
    + `, ${kept} kept as deep cuts`);

  if (process.argv.includes('--write-tool')) writeToolOptions(list);
}

/**
 * Refresh the audiogram manifest's `preset` select.
 *
 * Only tiers 1-2 go in by name: 100 curated presets is already a long select, and the
 * deeper cuts are reachable by id for anyone who wants them. The tool's OWN presets are
 * preserved exactly as authored — they are the licence-clean default and their order is a
 * design decision, not something to regenerate.
 */
/** Does this preset render something a person would want on a card? Unaudited = yes:
 *  absence of a measurement is not evidence of a fault. */
function rendersWell(e: Entry): boolean {
  return e.l === undefined || (e.l >= MIN_LUMA && e.l < MAX_LUMA);
}

function writeToolOptions(list: Entry[]): void {
  if (!existsSync(TOOL)) { console.warn('[viz-presets] audiogram manifest not found — skipping'); return; }
  const manifest = JSON.parse(readFileSync(TOOL, 'utf8')) as {
    inputs: Array<{ id: string; options?: Array<{ value: string; label: string }> }>;
  };
  const input = manifest.inputs.find(i => i.id === 'preset');
  if (!input?.options) { console.warn('[viz-presets] no preset input — skipping'); return; }

  const own = input.options.filter(o => !o.value.startsWith('stock:'));
  const stock = list
    .filter(e => e.t <= TOOL_TIERS && rendersWell(e))
    .map(e => ({
      value: `stock:${idFor(e.f)}`,
      // "Title · Author" — the author is the point, so it is in the label a person picks
      // from, not only on the finished card.
      label: e.a ? `${e.n} · ${e.a}` : e.n,
    }));

  input.options = [...own, ...stock];
  writeFileSync(TOOL, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`[viz-presets] audiogram preset select: ${own.length} own + ${stock.length} artist`);
}

main();
