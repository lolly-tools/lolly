// SPDX-License-Identifier: MPL-2.0
/**
 * The two variant axes a docs screenshot can have, and the interactions that get it
 * into the state worth photographing.
 *
 *   theme  — `dark=1` ships a second baseline captured with the app pinned dark;
 *            /info swaps the two as the reader toggles the site theme.
 *   drive  — `drive=…` performs real clicks/keys/drags before the shot, so a menu,
 *            a popover, a dialog or a drag-in-flight can be documented at all.
 *
 * Both are recipe-authored, so both can rot the same way `format=png` did: silently,
 * by staying true after they stopped being true. These tests pin the parts that
 * would fail quietly — a filename that drops an axis, an expectation set that makes
 * `--rebuild` delete every dark baseline, a theme pin that only reaches the OS
 * media query, and a `drive=` typo that would otherwise capture the untouched page.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDriveSteps, parseShotRecipes } from '../scripts/lib/shot-compare.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = join(ROOT, 'docs');
const SHOTS = join(DOCS, 'shots');

/** Every recipe declared across the English docs pages. */
function englishRecipes() {
  return readdirSync(DOCS)
    .filter((f) => f.endsWith('.md'))
    .flatMap((f) => parseShotRecipes(readFileSync(join(DOCS, f), 'utf-8')).recipes);
}

// ── drive= grammar ────────────────────────────────────────────────────────────

test('drive: each step kind parses to the shape the runner executes', () => {
  const { steps, problems } = parseDriveSteps(
    'click:.tl-onion;click:.tl-ruler|at=0.42,0.5;click:.tl-clip|right;click:.tl-chip|double;'
    + 'hover:.tl-split;press:Shift+O;press:S|on=.tl-panel;'
    + 'drag:.tl-clip|dx=90|dy=-4|at=0.99,0.15|hold;wait:400',
  );
  assert.deepEqual(problems, []);
  assert.deepEqual(steps, [
    { kind: 'click', selector: '.tl-onion' },
    { kind: 'click', selector: '.tl-ruler', at: [0.42, 0.5] },
    { kind: 'click', selector: '.tl-clip', button: 'right' },
    { kind: 'click', selector: '.tl-chip', count: 2 },
    { kind: 'hover', selector: '.tl-split' },
    { kind: 'press', keys: 'Shift+O' },
    { kind: 'press', keys: 'S', selector: '.tl-panel' },
    { kind: 'drag', selector: '.tl-clip', dx: 90, dy: -4, at: [0.99, 0.15], hold: true },
    { kind: 'wait', ms: 400 },
  ]);
});

test('drive: a malformed step is reported, never silently dropped', () => {
  // Each of these would otherwise capture the page in its untouched state and
  // publish a screenshot of the wrong thing — the failure mode worth catching.
  for (const bad of ['clik:.tl-onion', 'click:', 'drag:.tl-clip', 'drag:.tl-clip|dx=x', 'wait:soon', 'nonsense']) {
    const { problems } = parseDriveSteps(bad);
    assert.ok(problems.length, `"${bad}" should be reported as a problem`);
  }
});

test('drive: at= is clamped into the element box', () => {
  const { steps } = parseDriveSteps('click:.x|at=-3,9');
  assert.deepEqual((steps[0] as { at: number[] }).at, [0, 1]);
});

test('drive: recipe problems surface through parseShotRecipes', () => {
  const { problems } = parseShotRecipes(
    '![x](/t/url-shot?url=%2F%23%2F&drive=clik%3A.tl-onion&format=svg&filename=made-up)',
  );
  assert.ok(problems.some((p) => p.includes('drive step')), problems.join('; '));
});

// ── dark=1 ────────────────────────────────────────────────────────────────────

test('dark: the recipe param is parsed, and defaults off', () => {
  const one = (q: string) => parseShotRecipes(`![x](/t/url-shot?url=%2F%23%2F&${q}&filename=made-up)`).recipes[0]!;
  assert.equal(one('dark=1').dark, true);
  assert.equal(one('dark=true').dark, true);
  assert.equal(one('format=svg').dark, false);
});

test('dark: every committed twin has a dark=1 recipe, and every dark=1 recipe has its twins', () => {
  const recipes = englishRecipes();
  const wantDark = new Map(recipes.filter((r) => r.dark).map((r) => [`${r.slug}.dark.${r.format}`, r.slug]));

  const missing = [...wantDark].filter(([file]) => !existsSync(join(SHOTS, file))).map(([f]) => f);
  assert.deepEqual(missing, [], 'dark=1 recipes with no committed twin — re-run scripts/build-docs-shots.ts');

  // And the other direction: a twin on disk whose recipe no longer asks for one is a
  // file that ships to readers and can never be re-captured.
  const bySlug = new Map(recipes.map((r) => [r.slug, r]));
  const orphaned = readdirSync(SHOTS)
    .filter((f) => /\.dark\.(svg|png|jpg)$/.test(f))
    .filter((f) => {
      const slug = f.replace(/\.dark\.(svg|png|jpg)$/, '').replace(/\.[a-z]{2}(-[a-z]+)?$/i, '');
      return !bySlug.get(slug)?.dark;
    });
  assert.deepEqual(orphaned, [], 'dark baselines no recipe claims — delete them or restore dark=1');
});

test('dark: the light and dark baselines of a shot are different files', () => {
  // A pin that only sets `prefers-color-scheme` and never seeds the app's own theme
  // key would produce two byte-identical files and a toggle that appears to do
  // nothing. Byte-equality is the cheapest possible detector for that.
  const pairs = englishRecipes()
    .filter((r) => r.dark)
    .map((r) => [join(SHOTS, `${r.slug}.${r.format}`), join(SHOTS, `${r.slug}.dark.${r.format}`)] as const)
    .filter(([a, b]) => existsSync(a) && existsSync(b));
  assert.ok(pairs.length, 'no dark twins committed — this test would pass vacuously');
  const identical = pairs
    .filter(([a, b]) => readFileSync(a).equals(readFileSync(b)))
    .map(([a]) => a.split('/').pop());
  assert.deepEqual(identical, [], 'these dark twins are byte-identical to their light originals');
});

// ── the capture pipeline's own composition rules ──────────────────────────────

test('pipeline: filenames and the orphan expectation set carry BOTH axes', async () => {
  // Imported for their behaviour rather than re-implemented: the expectation set is
  // what `--rebuild` prunes against, so a copy of the rule here would agree with
  // itself while the pipeline deleted files.
  const src = readFileSync(join(ROOT, 'scripts', 'build-docs-shots.ts'), 'utf-8');
  assert.match(
    src,
    /shot\.theme \? `\.\$\{shot\.theme\}` : ''/,
    'shotFileName must include the theme suffix',
  );
  assert.match(
    src,
    /if \(s\.dark\) expected\.add\(`\$\{stem\}\.dark\.\$\{s\.format\}`\)/,
    'warnOrphans must expect the dark twins, or --rebuild deletes them',
  );
  assert.match(
    src,
    /localStorage\.setItem\('theme','\$\{theme === 'dark' \? 'dark' : 'light'\}'\)/,
    "the capture must SEED the app's theme key, not rely on the OS colour scheme alone",
  );
});

test('pipeline: interactions reach all three page paths', () => {
  // crop measurement, vector walk, raster capture. Miss one and the frame is
  // measured on a page in a different state from the one photographed.
  const src = readFileSync(join(ROOT, 'scripts', 'build-docs-shots.ts'), 'utf-8');
  // The trailing argument is optional in the pattern: the two direct paths now hand
  // runDriveSteps a DriveOpts (the in-page click fallback), and pinning the call to a
  // literal two-argument form made an honest addition look like a removed drive.
  assert.equal((src.match(/runDriveSteps\(page as unknown as PageLike, shot\.drive[,)]/g) ?? []).length, 2,
    'resolveSelectorCrop and captureVector must both drive the page');
  assert.match(src, /actions: shot\.drive/, 'the raster path passes the steps through captureUrl');
  // …and all THREE must carry the same drive options, or the frame is measured on a
  // page whose click was refused while the photographed page's click landed (or the
  // reverse). One helper, three call sites.
  assert.equal((src.match(/driveOptsFor\(shot\)/g) ?? []).length, 3,
    'the crop, vector and raster paths must each pass driveOptsFor(shot)');
});

// ── sweep=1 (the drawing sweep) ───────────────────────────────────────────────

test('sweep: the drawing sweep is authored per recipe and stays inside its budget', () => {
  const perPage = new Map<string, number>();
  for (const f of readdirSync(DOCS).filter((x) => x.endsWith('.md'))) {
    const md = readFileSync(join(DOCS, f), 'utf-8');
    const n = parseShotRecipes(md).recipes.filter((r) => /[?&]sweep=1(&|$)/.test(r.raw)).length;
    if (n) perPage.set(f, n);
  }
  assert.ok(perPage.size, 'no page declares sweep=1 — the effect would be dead code');
  const over = [...perPage].filter(([, n]) => n > 4).map(([f, n]) => `${f}: ${n}`);
  assert.deepEqual(over, [], 'each sweep keeps a filtered composited layer alive — budget is four per page');
});

test('sweep: the timing stays in the enjoyable range and the layer is torn down', () => {
  const css = readFileSync(join(ROOT, 'docs', 'build.ts'), 'utf-8');
  const dur = /--sweep-dur:([\d.]+)s/.exec(css);
  const delay = /--sweep-delay:([\d.]+)s/.exec(css);
  assert.ok(dur && delay, 'the sweep timing must stay a pair of custom properties, tunable in one edit');
  const ms = Number(dur![1]) * 1000;
  assert.ok(ms >= 500 && ms <= 2000, `sweep duration ${ms}ms is outside the 500-2000ms brief`);
  assert.match(css, /shot--swept::after\{content:none\}/, 'the filtered layer must be retired after the sweep');
});
