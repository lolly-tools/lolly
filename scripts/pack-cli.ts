#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * pack-cli - build the PUBLISHABLE @lolly-tools/cli npm package (plans/202 WP1.2).
 *
 * The workspace runs the terminal shells straight from TypeScript: `shells/cli/bin/
 * lolly.ts` under Node's type-stripping, `shells/tui/bin/lolly-tui.tsx` under tsx,
 * both importing `@lolly/engine` and `@lolly-tools/node-shell` by workspace name. None
 * of that survives a publish - Node refuses to type-strip anything under node_modules,
 * and the workspace names resolve to nothing outside the monorepo. So the published
 * artifact is BUILT here, and the no-build dev loop upstairs stays as it is.
 *
 * Under dist/cli-pack/:
 *   - pkg/                        the staged package: bin/ wrappers, dist/ compiled ESM
 *                                 (cli + tui + shared chunks), a GENERATED package.json,
 *                                 README.md, LICENSE
 *   - lolly-tools-cli-<v>.tgz     npm pack of pkg/
 *   - manifest.json               version, git commit, content hash (the pack-core shape)
 *
 * plus a throwaway consumer in a TEMP directory that installs the tarball and RUNS it:
 * version, list, a real render, `tui`, and the no-content refusal. It lives outside the
 * repo on purpose: the CLI finds a content root by walking UP from its own location, so
 * a consumer installed under dist/ would silently find this checkout's catalog and the
 * refusal could never be tested. The directory is removed when every check passes and
 * kept, and named, when one does not.
 *
 * CONTENT-FREE (plans/131). No tool and no catalog asset goes in the tarball: community/
 * alone is 79 MB and a brand catalog another 56 MB. The package renders from a root the
 * user points it at (LOLLY_ROOT), or from the desktop app's own resources. The staged
 * tree is checked for both directories before it is packed, so content cannot creep in.
 *
 * First-party source is BUNDLED; every npm dependency stays external and is declared in
 * the generated package.json, so native and wasm packages (@resvg/resvg-js, jsdom,
 * harfbuzzjs, zxing-wasm) install and load themselves the ordinary way. The heavy
 * on-device runtimes stay OPTIONAL, matching packages/node-shell: absent means the
 * feature refuses by name, never a broken install.
 *
 *   node scripts/pack-cli.ts
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync, copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(REPO, 'dist', 'cli-pack');
const PKG = join(OUT, 'pkg');

/** The workspace packages whose SOURCE is bundled into the two entries. */
const FIRST_PARTY = [
  'shells/cli', 'shells/tui', 'packages/node-shell', 'engine', 'packages/core',
] as const;

/** The published README. Written here rather than copied from shells/cli/README.md,
 *  which documents the CHECKOUT (npm run cli, the profile views); a package reader has
 *  none of that and needs the install and the content root first. */
const README = `# @lolly-tools/cli

\`lolly\` renders any Lolly tool from the terminal: the same engine, the same render
path and the same bytes as the web app and the desktop app. It is URL mode under a
different transport, so \`--foo=bar\` on the command line is the \`?foo=bar\` a shared
link carries.

\`\`\`bash
npm i -g @lolly-tools/cli
lolly --help
\`\`\`

## It ships with no tools and no catalog

Tools and brand assets are content, not code, and a full set is well over 100 MB. This
package carries none of it. Point it at a root, three ways:

1. **A directory holding \`tools/\` and \`catalog/\`.**

   \`\`\`bash
   LOLLY_ROOT=/path/to/lolly lolly list
   \`\`\`

   A Lolly checkout has both once \`npm install\` has built its profile views.

2. **The desktop app.** Lolly for macOS, Windows and Linux carries its own tools,
   catalog and this same command.

3. **\`lolly system import <pack.lolly>\`.** Your design system: colours, fonts and
   logos, kept on this machine and used by every render. It adds no tools, so it needs
   one of the two above beside it.

Run a command that needs content without one and the CLI says this and exits 3
(\`UNAVAILABLE_HERE\`), the retry-somewhere-else code.

## A first render

\`\`\`bash
lolly list                                  # what this catalog has
lolly describe qr-code                      # inputs, defaults, formats
lolly qr-code --url=https://example.com --export=svg --output=qr.svg
lolly tui                                   # the interactive terminal shell
\`\`\`

## Optional extras

SVG, EMF, EPS, DXF, JSON and CSV render here with nothing else installed, and PNG comes
out natively for SVG-first tools. The heavier paths are optional on purpose:

- \`sharp\`, \`@napi-rs/canvas\`, \`onnxruntime-node\` and \`@huggingface/transformers\`
  install as optional dependencies. Without them the commands that need them refuse by
  name instead of failing halfway.
- HTML-layout raster, PDF and video use an installed Lolly desktop renderer first,
  then Chromium: \`lolly install-browser\`. Pin one with
  \`LOLLY_RENDERER=desktop|chromium\`.

## Documentation

The full surface, every flag and every exit code: <https://lolly.tools/info/cli.html>,
and \`lolly --help\` prints the same thing offline. The interactive shell is documented
at <https://lolly.tools/info/tui.html>.

MPL-2.0. Source: <https://github.com/lolly-tools/lolly>.
`;

const run = (cmd: string, args: string[], cwd: string, env?: NodeJS.ProcessEnv): string =>
  execFileSync(cmd, args, {
    cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'],
    ...(env ? { env: { ...process.env, ...env } } : {}),
  });

/** A run whose FAILURE is the answer: the exit code and both streams, captured. */
const runCaptured = (cmd: string, args: string[], cwd: string, env: NodeJS.ProcessEnv): { status: number; stdout: string; stderr: string } => {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', env: { ...process.env, ...env } });
  return { status: r.status ?? -1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
};

const readJson = (path: string): Record<string, string | Record<string, string>> =>
  JSON.parse(readFileSync(path, 'utf8')) as Record<string, string | Record<string, string>>;

/** Every file under `dir` (sorted), hashing "<relpath>\0<content>" - deterministic and
 *  modification-sensitive. Mirrors pack-core.ts/pack-engine.ts so the bundles read alike. */
function contentHash(dir: string): string {
  const files: string[] = [];
  const walk = (d: string): void => {
    for (const name of readdirSync(d).sort()) {
      const full = join(d, name);
      if (statSync(full).isDirectory()) walk(full);
      else files.push(full);
    }
  };
  walk(dir);
  const h = createHash('sha256');
  for (const f of files.sort()) {
    h.update(relative(dir, f).split('\\').join('/'));
    h.update('\0');
    h.update(readFileSync(f));
    h.update('\0');
  }
  return h.digest('hex');
}

const sha256File = (path: string): string => createHash('sha256').update(readFileSync(path)).digest('hex');

function gitCommit(): string {
  try {
    return run('git', ['rev-parse', 'HEAD'], REPO).trim();
  } catch {
    return 'unknown';
  }
}

/** Merge one package.json's dependency block, refusing two different ranges for one name. */
function mergeRanges(into: Record<string, string>, block: Record<string, string> | undefined, from: string): void {
  for (const [name, range] of Object.entries(block ?? {})) {
    // Workspace names are `*` and are bundled, not depended on.
    if (name.startsWith('@lolly/') || name.startsWith('@lolly-tools/')) continue;
    const seen = into[name];
    if (seen !== undefined && seen !== range) {
      throw new Error(`${name} is pinned two ways: ${seen} and ${range} (${from}). Make the workspace agree first.`);
    }
    into[name] = range;
  }
}

// ── 1. the dependency surface, read off the workspace ─────────────────────────
const dependencies: Record<string, string> = {};
const optionalDependencies: Record<string, string> = {};
for (const dir of FIRST_PARTY) {
  const pkg = readJson(join(REPO, dir, 'package.json'));
  mergeRanges(dependencies, pkg.dependencies as Record<string, string>, dir);
  mergeRanges(optionalDependencies, pkg.optionalDependencies as Record<string, string>, dir);
}
// A name cannot be both. node-shell's heavy runtimes are optional there and must stay
// optional here: `lolly ocr` with no onnxruntime-node refuses by name (the absent-beats-
// a-stub rule), which is a much better install than a gigabyte of native wheels.
for (const name of Object.keys(optionalDependencies)) delete dependencies[name];

const cliPkg = readJson(join(REPO, 'shells', 'cli', 'package.json')) as { version: string; license: string };
const VERSION = cliPkg.version;

// ── 2. compile: two entries, one shared chunk graph ───────────────────────────
rmSync(OUT, { recursive: true, force: true });
mkdirSync(PKG, { recursive: true });

const result = await build({
  // The output NAMES matter: shells/cli/src/tui.ts starts the TUI by looking for
  // `./tui.js` beside its own bundle, which is how `lolly tui` works in the package.
  entryPoints: { cli: join(REPO, 'shells/cli/bin/lolly.ts'), tui: join(REPO, 'shells/tui/src/main.tsx') },
  outdir: join(PKG, 'dist'),
  bundle: true,
  // Splitting keeps the CLI's lazy `await import()` shape: `lolly --version` still loads
  // a few kB rather than the whole shell, and the two entries share one copy of the
  // engine instead of carrying one each.
  splitting: true,
  platform: 'node',
  format: 'esm',
  // The repo's own floor (package.json engines: >=22.18.0), so the package runs
  // everywhere the monorepo does.
  target: 'node22',
  jsx: 'automatic',
  external: [...Object.keys(dependencies), ...Object.keys(optionalDependencies)],
  metafile: true,
  logLevel: 'warning',
});

const outputs = Object.keys(result.metafile.outputs);
for (const name of ['cli', 'tui']) {
  if (!outputs.some(o => o.endsWith(`/dist/${name}.js`))) {
    throw new Error(`esbuild produced no dist/${name}.js (outputs: ${outputs.join(', ')})`);
  }
}

// A workspace specifier left in an output would be a dangling import at install time:
// nothing publishes `@lolly/engine`, so the first run would end in ERR_MODULE_NOT_FOUND
// rather than a build error here, where the cause is in view.
const dangling: string[] = [];
for (const out of outputs) {
  const src = readFileSync(join(REPO, out), 'utf8');
  const m = /(?:from|import|require)\s*\(?\s*["'](@lolly(?:-tools)?\/[^"']+)["']/.exec(src);
  if (m) dangling.push(`${relative(PKG, join(REPO, out))} → ${m[1]}`);
}
if (dangling.length) throw new Error(`workspace imports survived bundling: ${dangling.join(', ')}`);

// ── 3. bins ───────────────────────────────────────────────────────────────────
// Two-line wrappers rather than the bundles themselves, so the executable paths stay
// stable while the bundle layout is free to change.
mkdirSync(join(PKG, 'bin'), { recursive: true });
for (const [bin, entry] of [['lolly', 'cli'], ['lolly-tui', 'tui']] as const) {
  const path = join(PKG, 'bin', `${bin}.js`);
  writeFileSync(path, `#!/usr/bin/env node\n// GENERATED by scripts/pack-cli.ts - do not edit.\nimport '../dist/${entry}.js';\n`);
  chmodSync(path, 0o755);
}

// ── 4. the generated package.json + docs ──────────────────────────────────────
writeFileSync(
  join(PKG, 'package.json'),
  `${JSON.stringify(
    {
      name: '@lolly-tools/cli',
      version: VERSION,
      description: 'The Lolly command line: render any Lolly tool from the terminal, and `lolly tui` for the interactive one. Ships no tools and no catalog - point it at a content root.',
      license: cliPkg.license,
      keywords: ['lolly', 'cli', 'tui', 'svg', 'pdf', 'content-generation', 'brand'],
      repository: { type: 'git', url: 'git+https://github.com/lolly-tools/lolly.git', directory: 'shells/cli' },
      homepage: 'https://lolly.tools/info/cli.html',
      bugs: 'https://github.com/lolly-tools/lolly/issues',
      type: 'module',
      bin: { lolly: './bin/lolly.js', 'lolly-tui': './bin/lolly-tui.js' },
      engines: { node: '>=22.18.0' },
      files: ['bin', 'dist', 'README.md', 'LICENSE'],
      dependencies,
      optionalDependencies,
      publishConfig: { access: 'public', provenance: true },
    },
    null,
    2,
  )}\n`,
);
writeFileSync(join(PKG, 'README.md'), README);
copyFileSync(join(REPO, 'LICENSE'), join(PKG, 'LICENSE'));

// ── 5. pack ───────────────────────────────────────────────────────────────────
const tgzName = run('npm', ['pack', '--pack-destination', OUT], PKG).trim().split('\n').pop() as string;
const tgz = join(OUT, tgzName);

// The content-free guarantee, checked on the artifact rather than trusted from `files`.
const listing = run('tar', ['-tzf', tgz], OUT).split('\n').filter(Boolean);
const content = listing.filter(p => /^package\/(tools|catalog)\//.test(p));
if (content.length) throw new Error(`the tarball carries content: ${content.slice(0, 5).join(', ')}`);
const unpacked = readdirSync(PKG, { recursive: true, withFileTypes: true })
  .filter(d => d.isFile())
  .reduce((n, d) => n + statSync(join(d.parentPath, d.name)).size, 0);
const CAP_MB = 32;
if (unpacked > CAP_MB * 1024 * 1024) {
  throw new Error(`the staged package is ${(unpacked / 1024 / 1024).toFixed(1)} MB, over the ${CAP_MB} MB cap - something content-shaped got in`);
}

writeFileSync(
  join(OUT, 'manifest.json'),
  `${JSON.stringify(
    {
      generatedFrom: gitCommit(),
      note: 'Publish bundle for @lolly-tools/cli (compiled ESM, no tools and no catalog). contentHash is over the staged files; tarballSha256 is informational (gzip is not reproducible).',
      cli: {
        version: VERSION, tarball: tgzName, tarballSha256: sha256File(tgz),
        contentHash: contentHash(PKG), files: listing.length,
        unpackedBytes: unpacked,
      },
    },
    null,
    2,
  )}\n`,
);

// ── 6. smoke: install the tarball and RUN it ──────────────────────────────────
// The point of the script. Everything above can succeed and still ship something that
// cannot start, so the tarball is installed into a bare project here and driven the way
// a person would drive it. Any failure throws (execFileSync) and fails the build.
const SMOKE = mkdtempSync(join(tmpdir(), 'lolly-cli-smoke-'));
console.log(`smoke: installing ${tgzName} into ${SMOKE}`);
writeFileSync(join(SMOKE, 'package.json'), '{ "name": "cli-smoke", "private": true, "type": "module" }\n');
// --omit=optional deliberately: sharp / onnxruntime-node / @huggingface/transformers /
// @napi-rs/canvas are hundreds of MB of native builds, and the CLI must work without
// them. So this smoke proves the install everyone gets first, and the commands it runs
// are the ones that need no optional runtime.
run('npm', ['i', '--no-audit', '--no-fund', '--omit=optional', tgz], SMOKE);

// `--omit=optional` is all-or-nothing: it also drops the platform binary that a
// REQUIRED native package ships as an optional dependency of its own, which is how
// @resvg/resvg-js is distributed. Put back the one binding this machine needs, chosen
// from resvg's own list, so the raster path is present the way a normal install has it.
const resvgDir = join(SMOKE, 'node_modules', '@resvg', 'resvg-js');
const resvgOptional = Object.keys((readJson(join(resvgDir, 'package.json')).optionalDependencies ?? {}) as Record<string, string>);
const prefix = `@resvg/resvg-js-${process.platform}-${process.arch}`;
const binding = resvgOptional.find(n => n === prefix)
  ?? resvgOptional.find(n => n.startsWith(`${prefix}-gnu`))
  ?? resvgOptional.find(n => n.startsWith(prefix));
// --omit=optional again on this one too: without it npm re-resolves the whole tree with
// optionals back on and drags in the hundreds of megabytes this smoke exists to avoid.
if (binding) run('npm', ['i', '--no-audit', '--no-fund', '--no-save', '--omit=optional', binding], SMOKE);

const LOLLY = join(SMOKE, 'node_modules', '.bin', 'lolly');
const LOLLY_TUI = join(SMOKE, 'node_modules', '.bin', 'lolly-tui');

const version = run(LOLLY, ['--version'], SMOKE).trim();
if (!version.startsWith('lolly ')) throw new Error(`--version printed ${JSON.stringify(version)}`);

// `list --json` against the repo's built profile view: the package has no content of its
// own, and this is the documented way to give it some.
const listed = JSON.parse(run(LOLLY, ['list', '--json'], SMOKE, { LOLLY_ROOT: REPO })) as {
  ok: boolean; result: { tools: Array<{ id: string }>; environment?: unknown };
};
if (!listed.ok || !Array.isArray(listed.result?.tools) || listed.result.tools.length === 0) {
  throw new Error('list --json returned no tools against LOLLY_ROOT');
}

// A real render, all the way to a file on disk.
const qr = join(SMOKE, 'qr.svg');
run(LOLLY, ['qr-code', '--url=https://example.com', '--export=svg', `--output=${qr}`], SMOKE, { LOLLY_ROOT: REPO });
const svg = readFileSync(qr, 'utf8');
// The CLI writes a standalone document, so the XML declaration comes first and <svg>
// follows it.
if (!/^\s*(?:<\?xml[^>]*\?>\s*)?<svg\b/.test(svg)) {
  throw new Error(`qr.svg is not an SVG document: ${JSON.stringify(svg.slice(0, 60))}`);
}

// The no-content experience, exercised where it is real: no LOLLY_ROOT, and an install
// with no catalog anywhere above it, so the marker walk genuinely finds nothing.
const refusal = runCaptured(LOLLY, ['list'], SMOKE, { LOLLY_ROOT: '' });
if (refusal.status !== 3) {
  throw new Error(`\`lolly list\` with no content exited ${refusal.status}, expected 3 UNAVAILABLE_HERE (${SMOKE})`);
}
for (const route of ['LOLLY_ROOT=', 'lolly system import', 'desktop app']) {
  if (!refusal.stderr.includes(route)) {
    throw new Error(`the no-content message does not name "${route}": ${refusal.stderr}`);
  }
}

// `lolly tui` from the package: proves the compiled TUI entry is present and starts.
// With no TTY it refuses, which is the answer being checked - a broken entry would
// throw ERR_MODULE_NOT_FOUND instead.
if (binding) {
  for (const [name, argv] of [['lolly tui', [LOLLY, 'tui']], ['lolly-tui', [LOLLY_TUI]]] as const) {
    const started = runCaptured(argv[0]!, argv.slice(1), SMOKE, { LOLLY_ROOT: REPO });
    if (started.status === 0 || !/interactive terminal \(TTY\)/.test(started.stderr)) {
      throw new Error(`\`${name}\` did not reach the TUI (exit ${started.status}): ${started.stderr.slice(0, 400)}`);
    }
  }
} else {
  // Only reachable on a platform @resvg/resvg-js publishes no binding for, where the
  // TUI cannot start for a reason that has nothing to do with this package.
  console.log(`smoke: tui NOT checked - no @resvg/resvg-js binding published for ${process.platform}-${process.arch}`);
}

rmSync(SMOKE, { recursive: true, force: true });
console.log('smoke: --version, list --json, a rendered SVG, the exit-3 refusal, and tui - all ok');
console.log(`packed → ${relative(REPO, OUT)}`);
console.log(`  @lolly-tools/cli@${VERSION}  ${tgzName}`);
console.log(`  tarball ${(statSync(tgz).size / 1024 / 1024).toFixed(1)} MB · unpacked ${(unpacked / 1024 / 1024).toFixed(1)} MB · ${listing.length} files · no tools, no catalog`);
console.log(`\nto publish: git tag cli-v${VERSION} && git push origin cli-v${VERSION}   (runs .github/workflows/publish-cli.yml)`);
console.log(`  npm publish is deliberately manual: npm publish --access public --provenance=false ${relative(REPO, PKG)}`);
