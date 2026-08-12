import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * Repo-leanness ratchet.
 *
 * The rule: git holds AUTHORED source + test baselines; the BUILD produces
 * everything else. Generated, downloadable, or otherwise build-reproducible
 * artifacts must not be committed — they bloat the repo, churn diffs, and
 * drift from their source of truth.
 *
 * This is a fast, pure `git ls-files` scan (no build step). Any TRACKED path
 * matching a known build-reproducible pattern is a leak UNLESS it appears in
 * the explicit ALLOWLIST below.
 *
 * To allowlist a deliberately-committed generated file, add its glob to
 * ALLOW with a one-line reason. If it is committed only until the build learns
 * to produce it, tag the reason `TODO(deploy-optimizations)` so the debt is
 * visible and removable, rather than silently baked into the tree.
 */

// Build-reproducible patterns. A tracked path matching any of these is a leak
// unless ALLOW (below) rescues it. Globs: `**` matches any chars incl. `/`,
// `*` matches any chars except `/`. Patterns are matched against repo-relative,
// forward-slash paths and are intentionally depth-agnostic (`**/…`) so they
// hold whether this suite runs from the monorepo root or a submodule root.
const BUILD_REPRODUCIBLE = [
  '**/catalog/og/**', // per-tool/per-view OG cards — rendered from titles at build time
  '**/catalog/previews/**', // catalog preview SVGs — generated from assets
  '**/dist/**', // compiled/bundled output
  '**/node_modules/**', // installed deps
  '**/*.map', // sourcemaps
  '**/scripts/i18n/cache.json', // translation-memory cache — a build accelerator, not source
  '**/public/models/**', // ML weights — fetched on build, never committed (e.g. shells/web/public/models)
  '**/public/ort/**', // onnxruntime-web wasm/js — vendored by the build (e.g. shells/web/public/ort)
];

// Deliberately-committed paths that a BUILD_REPRODUCIBLE pattern would
// otherwise flag. Each entry states WHY it is in git.
const ALLOW = [
  '**/docs/shots/**', // test golden baselines — the vector-snapshot suite compares against these
  '**/catalog/tools/index.json', // generated, but committed as the drift-guard contract (validate:catalog fails on drift)
  '**/api/**/*.js', // generated esbuild bundles, but committed as the drift-guard contract (CI api-bundles job)
  '**/public/fonts/**', // AUTHORED source (SUSE/Outfit faces + OFL licences), not a build product
  // TODO(deploy-optimizations): remove from git once OG cards + catalog previews move
  // to the build. Both are Playwright-rendered media still committed today (og cards
  // under catalog/og, look/card thumbnails under catalog/previews); allowlisted so this
  // ratchet passes now and documents the debt instead of failing on pre-existing state.
  '**/catalog/og/**',
  '**/catalog/previews/**',
];

function repoRoot(): string {
  return execFileSync('git', ['rev-parse', '--show-toplevel'], {
    encoding: 'utf8',
  }).trim();
}

function trackedFiles(cwd: string): string[] {
  return execFileSync('git', ['ls-files'], { cwd, encoding: 'utf8' })
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

// Anchored full-path glob → RegExp. A `**/` segment matches zero or more
// leading path segments (so `**/foo` matches `foo` at the root AND `a/b/foo`);
// a bare `**` matches any run incl. `/`; `*` matches any run excluding `/`;
// every other regex metachar is escaped.
function globToRegExp(glob: string): RegExp {
  let out = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        if (glob[i + 2] === '/') {
          out += '(?:.*/)?'; // `**/` — zero or more leading segments
          i += 2;
        } else {
          out += '.*'; // trailing/embedded `**`
          i += 1;
        }
      } else {
        out += '[^/]*';
      }
    } else if ('\\^$.|?+()[]{}'.includes(c)) {
      out += `\\${c}`;
    } else {
      out += c;
    }
  }
  return new RegExp(`^${out}$`);
}

const buildRe = BUILD_REPRODUCIBLE.map(globToRegExp);
const allowRe = ALLOW.map(globToRegExp);

const matchesAny = (path: string, res: RegExp[]) => res.some((re) => re.test(path));

test('no build-reproducible artifacts are tracked (git holds source, build makes the rest)', () => {
  const root = repoRoot();
  const files = trackedFiles(root);

  const offenders = files
    .filter((f) => matchesAny(f, buildRe))
    .filter((f) => !matchesAny(f, allowRe))
    .sort();

  assert.deepEqual(
    offenders,
    [],
    offenders.length === 0
      ? ''
      : [
          `${offenders.length} build-reproducible file(s) are tracked in git:`,
          ...offenders.map((f) => `  - ${f}`),
          '',
          'Git holds authored source + test baselines; the build produces everything else.',
          'Fix by removing them from git (`git rm --cached <path>`) and gitignoring them,',
          "or — if a file is committed on purpose — add its glob to this test's ALLOW list",
          'with a one-line reason (tag it TODO(deploy-optimizations) if it is only committed',
          'until the build learns to produce it).',
        ].join('\n'),
  );
});

test('ML models are fetched at build time, never committed', () => {
  // Models are large binary weights; committing them bloats history and drifts
  // from upstream. They must reach the deploy via a build-time fetch, so there
  // is intentionally no models/** allowlist entry — the tracked count is zero.
  const root = repoRoot();
  const models = trackedFiles(root).filter((f) => /(^|\/)public\/models\//.test(f));

  assert.deepEqual(
    models,
    [],
    `Expected no tracked model weights, found:\n${models.map((f) => `  - ${f}`).join('\n')}`,
  );
});
