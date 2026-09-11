// SPDX-License-Identifier: MPL-2.0
/**
 * Golden-file tests for host.text.toPath (shells/web/src/bridge/text.ts) - the
 * text→glyph-outline vectorisation path used on SVG/PDF export
 * (shells/web/src/bridge/export.ts). This is the highest-consequence text
 * seam in the app: get it wrong and every exported brand asset silently
 * mis-outlines.
 *
 * This is NOT a mock - it runs the real `harfbuzzjs` WASM module shaping
 * real SUSE/Outfit font bytes read off disk. The only stub is `globalThis.
 * fetch`, and only as a transport shim so `toPath`'s internal `fetch(fontUrl)`
 * resolves against the repo's real font files instead of the network;
 * HarfBuzz itself, the font parsing, and the path/metric math are 100% real.
 *
 * Run directly:            node --test shells/web/src/bridge/text-outline-golden.test.ts
 * Regenerate the goldens:  UPDATE_GOLDENS=1 node --test shells/web/src/bridge/text-outline-golden.test.ts
 *   (then re-run without UPDATE_GOLDENS to confirm the fixture is now green,
 *   and diff-review the fixture change before committing it - a golden diff
 *   IS the review artefact for any change to this seam.)
 *
 * Portability: the STATIC cases need real SUSE static faces under
 * catalog/fonts/ttf/ (a gitignored profile VIEW - see CLAUDE.md "Content
 * profiles"), which a bare checkout on the `lolly-start` profile, or a public
 * CI run that never mounted brands/suse, won't have. Those cases check file
 * existence up front and `test.skip` with a logged reason rather than
 * failing when the font view isn't mounted - this file must never fail
 * merely because a brand pack isn't checked out.
 *
 * The VARIABLE cases are deliberately not in that set: they read the shell's
 * own `public/fonts/SUSE[wght].ttf`, which ships on every profile, so the fvar
 * seam is covered on a bare checkout and in CI. Reach for `catalog/fonts/` here
 * only when a case is genuinely ABOUT the mounted brand's files.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createTextAPI } from './text.ts';

type TextAPIShape = ReturnType<typeof createTextAPI>;
type ToPathOpts = Parameters<TextAPIShape['toPath']>[0];
type ToPathResult = Awaited<ReturnType<TextAPIShape['toPath']>>;

// ── repo-relative font/fixture resolution ───────────────────────────────────
// 4 levels up from THIS file's own url (not its dirname) lands on the repo
// root: bridge/ -> src/ -> web/ -> shells/ -> <repo root>. Verified against
// this checkout's actual path layout, not assumed.
const REPO_ROOT_URL = new URL('../../../../', import.meta.url);

function repoPath(rel: string): string {
  return fileURLToPath(new URL(rel, REPO_ROOT_URL));
}

function fontExists(rel: string): boolean {
  return existsSync(repoPath(rel));
}

// Transport-only stub: serves fontUrl fetches from disk. Real HarfBuzz + real
// font bytes still run - nothing about shaping is faked.
const realFetch = globalThis.fetch;
globalThis.fetch = (async (url: RequestInfo | URL) => {
  const rel = String(url).replace(/^\/+/, '');
  const bytes = readFileSync(repoPath(rel));
  return {
    ok: true,
    status: 200,
    async arrayBuffer() {
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    },
  } as unknown as Response;
}) as typeof fetch;
after(() => { globalThis.fetch = realFetch; });

const api = createTextAPI();

// ── font files under test ────────────────────────────────────────────────────
// Statics: brand-critical weights/styles actually shipped for outline export.
const REGULAR      = 'catalog/fonts/ttf/SUSE-Regular.ttf';
const BOLD         = 'catalog/fonts/ttf/SUSE-Bold.ttf';
const BOLD_ITALIC  = 'catalog/fonts/ttf/SUSE-BoldItalic.ttf';
// The actual VARIABLE master (the statics above are pre-instanced weights baked
// from this at build time - SUSE-Regular.ttf itself carries no fvar axis).
//
// Read from the SHELL's own font directory, not from `catalog/fonts/variable/`.
// The catalog path was always the wrong coupling: this case tests the fvar axis
// in `bridge/text.ts`, which has nothing to do with which brand pack is mounted,
// and pinning it to a gitignored profile VIEW meant the whole variable-font seam
// silently stopped being tested on every checkout that wasn't on the `suse`
// profile - including CI, which never mounts brands/suse. The shell serves this
// face on EVERY profile (it is the app's own standard face, alongside Outfit
// below), so the case now runs everywhere. The bytes are the same file: this and
// `brands/suse/catalog/fonts/variable/SUSE[wght].ttf` are identical
// (sha256 e58dc240debae8a177d236e977e3834c6fff3883a7ad6010f098778f60904527), so
// the committed goldens are unchanged by the repoint - verified, not assumed.
const VARIABLE     = 'shells/web/public/fonts/SUSE[wght].ttf';
// Platform fallback face (Outfit), shipped regardless of active brand profile
// - used below purely as a face with disjoint unicode coverage from SUSE, to
// exercise the real fallbackFonts/segmentByFace branch.
const OUTFIT_VARIABLE = 'shells/web/public/fonts/Outfit[wght].ttf';

const suseStaticsAvailable = fontExists(REGULAR) && fontExists(BOLD) && fontExists(BOLD_ITALIC);
const suseVariableAvailable = fontExists(VARIABLE);
const outfitAvailable = fontExists(OUTFIT_VARIABLE);

const SKIP_NO_SUSE = suseStaticsAvailable ? false
  : `SUSE static fonts not present at ${REGULAR} etc. - this checkout's active profile ` +
    `(see profiles.json) has no SUSE fonts mounted under catalog/fonts/. Skipping.`;
// Not profile-gated any more - the face ships with the shell this file lives in,
// so this reads as a corrupt checkout rather than as an unmounted brand pack, and
// it must never quietly become the normal state again.
const SKIP_NO_VARIABLE = suseVariableAvailable ? false
  : `SUSE variable font missing from the web shell's own fonts at ${VARIABLE} - this ` +
    `ships on every profile, so a checkout without it is broken, not unmounted.`;
const SKIP_NO_FALLBACK = (suseStaticsAvailable && outfitAvailable) ? false
  : `Missing ${!suseStaticsAvailable ? REGULAR : OUTFIT_VARIABLE} - skipping fallbackFonts golden case.`;

// ── golden fixture I/O ───────────────────────────────────────────────────────
const FIXTURE_PATH = repoPath('shells/web/src/bridge/__fixtures__/text-outline.golden.json');
const UPDATE_GOLDENS = process.env.UPDATE_GOLDENS === '1';

interface NormalizedResult {
  d: string;
  advanceWidth: number;
  bbox: { x1: number; y1: number; x2: number; y2: number } | null;
  notdef: number;
}

function round3(n: number): number {
  const r = Math.round(n * 1000) / 1000;
  // Collapse -0 to 0: JSON.stringify(-0) === '0', so a round-trip through the
  // committed fixture would otherwise turn a live -0 into a spurious mismatch
  // against the JSON-parsed +0 (assert.deepEqual/deepStrictEqual uses SameValue,
  // which distinguishes -0 from 0). A glyph sitting exactly on the baseline is
  // a real, deterministic source of -0 (e.g. HarfBuzz Y-up 0 negated by the
  // SVG Y-down flip in transformPath) - not an edge case worth preserving sign on.
  return r === 0 ? 0 : r;
}

/** d is already 2dp-rounded by transformPath in text.ts; only the raw float
 *  metrics (advanceWidth, bbox) need normalising for a stable golden. */
function normalize(r: ToPathResult): NormalizedResult {
  return {
    d: r.d,
    advanceWidth: round3(r.advanceWidth),
    bbox: r.bbox
      ? { x1: round3(r.bbox.x1), y1: round3(r.bbox.y1), x2: round3(r.bbox.x2), y2: round3(r.bbox.y2) }
      : null,
    notdef: r.notdef ?? 0,
  };
}

function loadFixture(): Record<string, NormalizedResult> {
  if (!existsSync(FIXTURE_PATH)) return {};
  return JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as Record<string, NormalizedResult>;
}

// Regeneration accumulates here across the whole run, then is written ONCE in
// `after` - so a fresh UPDATE_GOLDENS run always produces a fixture with
// exactly the cases this file defines (no stale leftover keys).
const committed = loadFixture();
const regenerated: Record<string, NormalizedResult> = {};

after(() => {
  if (!UPDATE_GOLDENS) return;
  mkdirSync(repoPath('shells/web/src/bridge/__fixtures__'), { recursive: true });
  const sorted: Record<string, NormalizedResult> = {};
  for (const key of Object.keys(regenerated).sort()) sorted[key] = regenerated[key]!;
  writeFileSync(FIXTURE_PATH, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8');
});

/** Runs the real toPath, and either records the live result as the new golden
 *  (UPDATE_GOLDENS=1) or asserts it matches the committed fixture exactly. */
async function goldenCase(id: string, opts: ToPathOpts): Promise<NormalizedResult> {
  const live = normalize(await api.toPath(opts));
  if (UPDATE_GOLDENS) {
    regenerated[id] = live;
    return live;
  }
  const expected = committed[id];
  assert.ok(
    expected,
    `No committed golden for "${id}" - regenerate with: ` +
    `UPDATE_GOLDENS=1 node --test "shells/web/src/bridge/text-outline-golden.test.ts"`,
  );
  assert.deepEqual(live, expected, `Golden mismatch for "${id}"`);
  return live;
}

// ── golden regression cases ─────────────────────────────────────────────────
// One entry per case = one committed { d, advanceWidth, bbox, notdef } snapshot
// of a REAL toPath() call. A diff in any of these on a future run means the
// real HarfBuzz shaping or the coordinate transform changed - exactly the
// signal this suite exists to catch.

test('golden: basic Latin run, SUSE Regular 48px', { skip: SKIP_NO_SUSE }, async () => {
  await goldenCase('basic-latin-regular-48', { text: 'Hamburgefonstiv', fontUrl: REGULAR, fontSize: 48 });
});

test('golden: same run, SUSE Bold 48px', { skip: SKIP_NO_SUSE }, async () => {
  await goldenCase('basic-latin-bold-48', { text: 'Hamburgefonstiv', fontUrl: BOLD, fontSize: 48 });
});

test('golden: same run, SUSE Bold Italic 48px', { skip: SKIP_NO_SUSE }, async () => {
  await goldenCase('basic-latin-bold-italic-48', { text: 'Hamburgefonstiv', fontUrl: BOLD_ITALIC, fontSize: 48 });
});

test('golden: variable SUSE master at wght=400, 48px', { skip: SKIP_NO_VARIABLE }, async () => {
  await goldenCase('variable-wght-400-48', { text: 'Hamburgefonstiv', fontUrl: VARIABLE, fontSize: 48, variations: ['wght=400'] });
});

test('golden: variable SUSE master at wght=700, 48px', { skip: SKIP_NO_VARIABLE }, async () => {
  await goldenCase('variable-wght-700-48', { text: 'Hamburgefonstiv', fontUrl: VARIABLE, fontSize: 48, variations: ['wght=700'] });
});

test('golden: "office" with ligatures on (default), Regular 48px', { skip: SKIP_NO_SUSE }, async () => {
  await goldenCase('ligature-on-office-48', { text: 'office', fontUrl: REGULAR, fontSize: 48 });
});

test('golden: "office" with ligatures forced off (liga=0), Regular 48px', { skip: SKIP_NO_SUSE }, async () => {
  await goldenCase('ligature-off-office-48', { text: 'office', fontUrl: REGULAR, fontSize: 48, features: ['liga=0'] });
});

test('golden: letterSpacing=0 baseline, Regular 48px', { skip: SKIP_NO_SUSE }, async () => {
  await goldenCase('letterspacing-0-48', { text: 'Hamburgefonstiv', fontUrl: REGULAR, fontSize: 48, letterSpacing: 0 });
});

test('golden: letterSpacing=4px, Regular 48px', { skip: SKIP_NO_SUSE }, async () => {
  await goldenCase('letterspacing-4-48', { text: 'Hamburgefonstiv', fontUrl: REGULAR, fontSize: 48, letterSpacing: 4 });
});

test('golden: CJK run SUSE cannot cover (tofu/.notdef), Regular 48px', { skip: SKIP_NO_SUSE }, async () => {
  await goldenCase('notdef-cjk-48', { text: '中', fontUrl: REGULAR, fontSize: 48 });
});

test('golden: blank/whitespace-only run', { skip: SKIP_NO_SUSE }, async () => {
  await goldenCase('blank-whitespace-48', { text: '   ', fontUrl: REGULAR, fontSize: 48 });
});

test('golden: mixed run with a SUSE-uncovered char, NO fallback face', { skip: SKIP_NO_FALLBACK }, async () => {
  // U+00B5 MICRO SIGN: absent from every SUSE static/variable face (verified
  // against the shipped font files' cmap - see notes), present in Outfit.
  await goldenCase('fallback-none-micro-48', { text: '5µm', fontUrl: REGULAR, fontSize: 48 });
});

test('golden: same mixed run, WITH Outfit as a fallback face', { skip: SKIP_NO_FALLBACK }, async () => {
  await goldenCase('fallback-outfit-micro-48', {
    text: '5µm', fontUrl: REGULAR, fontSize: 48,
    fallbackFonts: [{ fontUrl: OUTFIT_VARIABLE }],
  });
});

test('golden: two-word run with an interior space glyph, Regular 48px', { skip: SKIP_NO_SUSE }, async () => {
  // A space is the most common glyph in any real headline/sentence and carries
  // NO outline - this drives toPath's no-path (`if (rawPath)`) and no-extents
  // (`if (ext)`) falsy branches that every single-word case above skips.
  await goldenCase('two-word-space-regular-48', { text: 'Hamburg Berlin', fontUrl: REGULAR, fontSize: 48 });
});

// ── behavioural assertions (real branches, not just snapshot equality) ──────
// Each of these re-runs the real toPath independently of the golden cases
// above, so it holds regardless of test declaration/execution order.

test('bold and bold-italic outlines differ from regular (real shape difference, not just re-snapshot)', { skip: SKIP_NO_SUSE }, async () => {
  const text = 'Hamburgefonstiv';
  const regular = await api.toPath({ text, fontUrl: REGULAR, fontSize: 48 });
  const bold = await api.toPath({ text, fontUrl: BOLD, fontSize: 48 });
  const boldItalic = await api.toPath({ text, fontUrl: BOLD_ITALIC, fontSize: 48 });
  assert.notEqual(bold.d, regular.d);
  assert.notEqual(boldItalic.d, regular.d);
  assert.notEqual(boldItalic.d, bold.d);
});

test('variable-font wght axis actually changes the outline (700 differs from 400)', { skip: SKIP_NO_VARIABLE }, async () => {
  const text = 'Hamburgefonstiv';
  const w400 = await api.toPath({ text, fontUrl: VARIABLE, fontSize: 48, variations: ['wght=400'] });
  const w700 = await api.toPath({ text, fontUrl: VARIABLE, fontSize: 48, variations: ['wght=700'] });
  assert.notEqual(w700.d, w400.d);
  assert.notEqual(w700.advanceWidth, w400.advanceWidth);
});

test('liga=0 disables the ffi/fi ligature HarfBuzz applies by default', { skip: SKIP_NO_SUSE }, async () => {
  const ligaOn = await api.toPath({ text: 'office', fontUrl: REGULAR, fontSize: 48 });
  const ligaOff = await api.toPath({ text: 'office', fontUrl: REGULAR, fontSize: 48, features: ['liga=0'] });
  assert.notEqual(ligaOn.d, ligaOff.d);
  // Splitting the ligature back into separate glyphs changes the total advance.
  assert.notEqual(ligaOn.advanceWidth, ligaOff.advanceWidth);
});

test('letterSpacing strictly widens advanceWidth over the same run at 0', { skip: SKIP_NO_SUSE }, async () => {
  const text = 'Hamburgefonstiv';
  const tight = await api.toPath({ text, fontUrl: REGULAR, fontSize: 48, letterSpacing: 0 });
  const spaced = await api.toPath({ text, fontUrl: REGULAR, fontSize: 48, letterSpacing: 4 });
  assert.ok(spaced.advanceWidth > tight.advanceWidth,
    `expected letterSpacing:4 advanceWidth (${spaced.advanceWidth}) > letterSpacing:0 (${tight.advanceWidth})`);
});

test('a codepoint no face covers shapes as .notdef and is counted - the caller\'s cue to keep <text>', { skip: SKIP_NO_SUSE }, async () => {
  const cjk = await api.toPath({ text: '中', fontUrl: REGULAR, fontSize: 48 }); // 中
  assert.ok((cjk.notdef ?? 0) > 0, 'expected notdef > 0 for an uncovered CJK character');

  const emoji = await api.toPath({ text: '\u{1F600}', fontUrl: REGULAR, fontSize: 48 });
  assert.ok((emoji.notdef ?? 0) > 0, 'expected notdef > 0 for an uncovered emoji codepoint');
});

test('a blank/whitespace-only run returns the documented empty sentinel, not a degenerate shape', { skip: SKIP_NO_SUSE }, async () => {
  const blank = await api.toPath({ text: '   ', fontUrl: REGULAR, fontSize: 48 });
  assert.equal(blank.d, '');
  assert.equal(blank.bbox, null);
  assert.equal(blank.notdef ?? 0, 0);
});

test('baseline & bbox sanity on an ordinary run: ascenders go negative-y, bbox is well-formed', { skip: SKIP_NO_SUSE }, async () => {
  const r = await api.toPath({ text: 'Hamburgefonstiv', fontUrl: REGULAR, fontSize: 48 });
  assert.ok(r.d.length > 0);
  assert.ok(/-\d/.test(r.d), 'expected at least one negative-y coordinate (an ascender above the y=0 baseline)');
  assert.ok(r.advanceWidth > 0);
  assert.ok(r.bbox, 'expected a non-null bbox for a non-blank run');
  if (r.bbox) {
    assert.ok(r.bbox.x2 > r.bbox.x1, `expected bbox.x2 (${r.bbox.x2}) > bbox.x1 (${r.bbox.x1})`);
  }
});

test('fallbackFonts: an uncovered character drops out of notdef once a covering face is chained', { skip: SKIP_NO_FALLBACK }, async () => {
  // '5µm' - SUSE covers the digit and 'm', but not U+00B5 MICRO SIGN.
  const text = '5µm';
  const withoutFallback = await api.toPath({ text, fontUrl: REGULAR, fontSize: 48 });
  assert.ok((withoutFallback.notdef ?? 0) > 0, 'sanity: expected SUSE alone to miss the micro sign');

  const withFallback = await api.toPath({
    text, fontUrl: REGULAR, fontSize: 48,
    fallbackFonts: [{ fontUrl: OUTFIT_VARIABLE }],
  });
  assert.ok(
    (withFallback.notdef ?? 0) < (withoutFallback.notdef ?? 0),
    `expected fallbackFonts to lower notdef (was ${withoutFallback.notdef}, got ${withFallback.notdef})`,
  );
  // And the shaped output actually changed - segmentByFace really re-shaped
  // the covered segment through the fallback face, not a no-op.
  assert.notEqual(withFallback.d, withoutFallback.d);
});

test('an interior space (no-ink glyph) advances the pen and keeps bbox well-formed without shaping as .notdef', { skip: SKIP_NO_SUSE }, async () => {
  // Exercises the falsy sides of text.ts `if (rawPath)` / `if (ext)`: a space
  // has a real glyph id (not .notdef) but no outline and no extents. A refactor
  // that mishandled a no-ink glyph (dropped its advance, or dereferenced a null
  // `ext`) would break real multi-word exports while every single-word golden
  // stayed green.
  const oneWord = await api.toPath({ text: 'Hamburg', fontUrl: REGULAR, fontSize: 48 });
  const twoWord = await api.toPath({ text: 'Hamburg Berlin', fontUrl: REGULAR, fontSize: 48 });
  assert.equal(twoWord.notdef ?? 0, 0, 'a space is a covered glyph, not .notdef');
  assert.ok(twoWord.advanceWidth > oneWord.advanceWidth, 'the space + second word advance the pen further');
  assert.ok(twoWord.bbox && twoWord.bbox.x2 > twoWord.bbox.x1, 'bbox stays well-formed across the interior space');
  assert.ok(twoWord.d.length > oneWord.d.length, 'the second word contributes real outline');
});

// Split from the static half below on purpose. This is the assertion with the
// consequence - the weight a jsPDF embed silently gets - and pairing it with a
// SUSE-static check used to take it down with the brand pack on every profile
// that isn't `suse`. It now reads the shell's own master and runs everywhere.
test('axisDefaults reports a variable font’s default instance (the jsPDF-embed weight cue)', { skip: SKIP_NO_VARIABLE }, async () => {
  // axisDefaults is an optional (v1.30) TextAPI method; this shell's impl always
  // provides it - narrow + assert that, so a shell that dropped it fails loudly.
  const axisDefaults = api.axisDefaults;
  assert.ok(axisDefaults, 'this shell must implement host.text.axisDefaults');
  // The shipped SUSE[wght] master’s fvar default is wght=100 - the weight a
  // jsPDF embed (no axis control) will actually get. A change here means that
  // embed default moved and must be reviewed deliberately, not silently.
  assert.deepEqual(await axisDefaults(VARIABLE), { wght: 100 });
});

// The other half. Genuinely needs a PRE-INSTANCED face, and the shell ships no
// static one (every face in public/fonts is a [wght] master), so this is the
// piece that legitimately waits on the SUSE pack.
test('axisDefaults reports {} for a pre-instanced static', { skip: SKIP_NO_SUSE }, async () => {
  const axisDefaults = api.axisDefaults;
  assert.ok(axisDefaults, 'this shell must implement host.text.axisDefaults');
  assert.deepEqual(await axisDefaults(REGULAR), {}, 'a pre-instanced static carries no fvar axis');
});

test('an unparseable variation/feature string is dropped, not thrown (a caller typo degrades to the default)', { skip: SKIP_NO_VARIABLE }, async () => {
  const text = 'Hamburgefonstiv';
  const defaultInstance = await api.toPath({ text, fontUrl: VARIABLE, fontSize: 48 });
  const bogusVariation = await api.toPath({ text, fontUrl: VARIABLE, fontSize: 48, variations: ['nonsense=1'] });
  assert.equal(bogusVariation.d, defaultInstance.d, 'a malformed axis string is filtered, leaving the default instance - not thrown');

  // Shaped through the same master rather than the static: the claim is about
  // the FEATURE STRING being filtered, which no face is special to, and reading
  // a brand-pack file here would put the variation half back behind a mount.
  const noFeature = await api.toPath({ text: 'office', fontUrl: VARIABLE, fontSize: 48 });
  const bogusFeature = await api.toPath({ text: 'office', fontUrl: VARIABLE, fontSize: 48, features: ['not a feat'] });
  assert.equal(bogusFeature.d, noFeature.d, 'a malformed feature string is filtered, not applied or thrown');
});

test('a fallback face is instanced at its OWN variations (fallbackFonts[].variations is honoured)', { skip: SKIP_NO_FALLBACK }, async () => {
  // Outfit is a variable face and the micro sign is shaped THROUGH it, so the
  // fallback entry’s own wght must change the outline - otherwise a fallback
  // face’s axis settings are being silently ignored.
  const text = '5µm';
  const light = await api.toPath({ text, fontUrl: REGULAR, fontSize: 48, fallbackFonts: [{ fontUrl: OUTFIT_VARIABLE, variations: ['wght=100'] }] });
  const heavy = await api.toPath({ text, fontUrl: REGULAR, fontSize: 48, fallbackFonts: [{ fontUrl: OUTFIT_VARIABLE, variations: ['wght=700'] }] });
  assert.equal(light.notdef ?? 0, 0);
  assert.equal(heavy.notdef ?? 0, 0);
  assert.notEqual(light.d, heavy.d, 'the fallback face’s own wght axis changed the shaped micro sign');
});
