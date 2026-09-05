#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * build-cli-sidecar - the Node CLI, packaged as the desktop app's Tauri `externalBin`
 * (plans/202 WP1.3).
 *
 * The desktop binary is already a command line, but only for `run`. Everything else the
 * terminal knows how to do (list, describe, batch, validate, preflight, models, the TUI)
 * lives in shells/cli, which needs Node. So the app carries a Node CLI beside it and
 * cli.rs forwards those verbs to it. This script builds that sidecar.
 *
 * ## Which route shipped, and why
 *
 * The plan asked for a Node 24 single executable (SEA) carrying the CLI. Two things were
 * measured on this machine before choosing:
 *
 *   1. A SEA CAN load a native addon from the directory of `process.execPath`
 *      (`createRequire` anchored there, then `require('./resvgjs.<triple>.node')`).
 *      Verified: the resvg binding loaded and listed its exports.
 *   2. A SEA main script CANNOT be ESM. Node 24.20 runs it through `embedderRunCjs`
 *      whatever the file is called, so an `import` statement is a SyntaxError, and
 *      esbuild refuses to emit CJS for this graph: `shells/cli/bin/lolly.ts` is six
 *      top-level `await`s inside one try block, and `import.meta.url` is read across
 *      shells/cli and packages/node-shell (the `--version` package.json read, the
 *      zxing wasm resolve, `createRequire` in the ML session loader).
 *
 * So the blocker is the module format, not the addons, and this takes the fallback the
 * plan names: the executable is a Node SEA whose embedded main is a small LAUNCHER, and
 * the CLI's own ESM bundle rides beside it as Tauri bundle `resources`. The result still
 * behaves as one command - `lolly-cli-<triple> list --json` works standalone, no `node`
 * on PATH, no `node_modules` above it - which is what the app needs.
 *
 * ## What is produced
 *
 *   dist/cli-sidecar/
 *     bin/lolly-cli-<triple>          the SEA (Tauri externalBin: bin/lolly-cli)
 *     cli-lib/                        the payload, laid down as one resource directory
 *       package.json                  name + version, `type: module`
 *       dist/cli.js, tui.js, chunk-*  the ESM bundle: every pure-JS dependency inlined
 *       addons/resvgjs.node           the ONE native addon, loose, not in node_modules
 *       node_modules/                 only what cannot be inlined: the two wasm packages
 *                                     and playwright-core (see below)
 *
 * `--install` copies both into `shells/tauri-desktop/src-tauri/` where `tauri.conf.json`
 * expects them. Nothing here is committed: both destinations are gitignored, because the
 * SEA is a copy of the Node runtime (about 120 MB) and is rebuilt per release.
 *
 * ## What stays outside the bundle
 *
 * - `@resvg/resvg-js` is a native addon: the `.node` file is copied loose into
 *   `cli-lib/addons/` and a generated 20-line package in the payload's node_modules
 *   loads it from `LOLLY_SIDECAR_HOME` (which the launcher derives from
 *   `process.execPath`). The addon is never resolved through node_modules.
 * - `zxing-wasm` and `harfbuzzjs` carry .wasm files their own code resolves from disk,
 *   so they are copied whole rather than inlined.
 * - `playwright-core` is copied so the browser tier fails the way it already fails
 *   everywhere else: BrowserError with the `lolly install-browser` sentence and exit 3.
 *   Without the package the same request would die on ERR_MODULE_NOT_FOUND instead. The
 *   desktop app's own off-screen window becomes that tier in plans/202 WP2.
 * - `sharp`, `onnxruntime-node`, `@napi-rs/canvas`, `@huggingface/transformers` and
 *   `phonemizer` are NOT shipped. They are optional everywhere else and absent means the
 *   command refuses by name, which is the rule. Drop a matching `.node` beside
 *   `resvgjs.node` and add a shim if that ever changes.
 *
 *   node scripts/build-cli-sidecar.ts [--target=<triple>] [--node=<path>] [--install]
 *                                     [--postject=<path>] [--skip-verify]
 */
import { execFileSync, spawnSync } from 'node:child_process';
import {
  chmodSync, copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync,
  readFileSync, rmSync, statSync, writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(REPO, 'dist', 'cli-sidecar');
const BIN_DIR = join(OUT, 'bin');
/** The payload directory name, identical in the staging tree and inside the app. */
const PAYLOAD = 'cli-lib';
const LIB = join(OUT, PAYLOAD);
const DESKTOP_TAURI = join(REPO, 'shells', 'tauri-desktop', 'src-tauri');

/** postject's fuse, fixed by Node. Split so this file never matches its own search. */
const SEA_FUSE = `NODE_SEA_FUSE_${'fce680ab2cc467b6e072b8b5df1996b2'}`;
const POSTJECT_VERSION = '1.0.0-alpha.6';

// ── argv ──────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const hit = argv.find(a => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return undefined;
  const [, value] = hit.split('=');
  return value ?? '1';
};

/** Rust target triples, keyed by the Node platform-arch pair that builds them. */
const HOST_TRIPLES: Record<string, string> = {
  'darwin-arm64': 'aarch64-apple-darwin',
  'darwin-x64': 'x86_64-apple-darwin',
  'linux-x64': 'x86_64-unknown-linux-gnu',
  'linux-arm64': 'aarch64-unknown-linux-gnu',
  'win32-x64': 'x86_64-pc-windows-msvc',
  'win32-arm64': 'aarch64-pc-windows-msvc',
};

/** The napi binding each triple needs, as `<package suffix>` and the `.node` file in it. */
const RESVG_BINDING: Record<string, string> = {
  'aarch64-apple-darwin': 'darwin-arm64',
  'x86_64-apple-darwin': 'darwin-x64',
  'x86_64-unknown-linux-gnu': 'linux-x64-gnu',
  'aarch64-unknown-linux-gnu': 'linux-arm64-gnu',
  'x86_64-pc-windows-msvc': 'win32-x64-msvc',
  'aarch64-pc-windows-msvc': 'win32-arm64-msvc',
};

const hostKey = `${process.platform}-${process.arch}`;
const TARGET = flag('target') ?? HOST_TRIPLES[hostKey];
if (!TARGET) throw new Error(`no known Rust target triple for ${hostKey}; pass --target=<triple>`);
const isWindowsTarget = TARGET.includes('windows');
const crossBuilding = TARGET !== HOST_TRIPLES[hostKey];

/**
 * The Node runtime the SEA is cut from. Default is the one running this script, which is
 * right for a host build and wrong for a cross build - a SEA is the target platform's own
 * node with a blob injected, so cross-targeting needs that platform's binary passed in.
 */
function bundledSeaAlreadyPresent(path: string): boolean {
  if (process.platform !== 'darwin') return false;
  const result = spawnSync('otool', ['-l', path], { encoding: 'utf8' });
  return result.status === 0 && /(?:segname\s+NODE_SEA|sectname\s+__NODE_SEA_BLOB)/.test(result.stdout);
}

function seaCapable(path: string): boolean {
  if (!existsSync(path) || bundledSeaAlreadyPresent(path)) return false;
  const result = spawnSync(path, ['-p', 'process.config.variables.single_executable_application === true'], {
    encoding: 'utf8',
  });
  return result.status === 0 && result.stdout.trim() === 'true';
}

function defaultNodeCandidates(): string[] {
  const out = [process.execPath];
  if (process.env.NVM_BIN) out.push(join(process.env.NVM_BIN, process.platform === 'win32' ? 'node.exe' : 'node'));
  const nvmVersions = join(homedir(), '.nvm', 'versions', 'node');
  if (existsSync(nvmVersions)) {
    for (const version of readdirSync(nvmVersions).sort().reverse()) {
      out.push(join(nvmVersions, version, 'bin', 'node'));
    }
  }
  out.push('/usr/local/bin/node', '/opt/homebrew/bin/node');
  return [...new Set(out)];
}

const requestedNode = flag('node');
const resolvedNode = requestedNode
  ?? defaultNodeCandidates().find(seaCapable);
if (!resolvedNode) {
  throw new Error(
    'No clean SEA-capable Node runtime was found. Pass --node=<path> to an official Node 22+ binary; ' +
    'the current runtime may already contain a NODE_SEA blob or have SEA disabled.',
  );
}
const NODE_BINARY: string = resolvedNode;
if (requestedNode && !seaCapable(requestedNode)) {
  throw new Error(`--node=${requestedNode} is not a clean SEA-capable Node runtime.`);
}
const NODE_VERSION = spawnSync(NODE_BINARY, ['-p', 'process.versions.node'], { encoding: 'utf8' }).stdout.trim();

// ── 1. the ESM bundle ─────────────────────────────────────────────────────────
/** Packages left external: native addons, wasm carriers, and ink's devtools import. */
const EXTERNAL = [
  '@resvg/resvg-js',
  // jsdom stays a real package on disk. Inlined it broke twice: its
  // living/xhr/XMLHttpRequest-impl.js resolves a sibling worker file at module load, so
  // every command died on import, and `jsdom.VirtualConsole` came out undefined once
  // esbuild had rewritten the CommonJS entry through a split ESM chunk, which failed the
  // render itself. It is pure JavaScript, so it is copied with its dependency closure.
  'jsdom',
  'zxing-wasm',
  'harfbuzzjs',
  'playwright-core',
  'sharp',
  'onnxruntime-node',
  '@napi-rs/canvas',
  '@huggingface/transformers',
  'phonemizer',
  // ink imports this only for its React devtools hook, which no shipped run reaches.
  'react-devtools-core',
];

/** Copied whole into the payload's node_modules; the rest of `EXTERNAL` is absent. */
const COPIED_PACKAGES = ['zxing-wasm', 'harfbuzzjs', 'playwright-core', 'jsdom'];

const cliPkg = JSON.parse(readFileSync(join(REPO, 'shells', 'cli', 'package.json'), 'utf8')) as { version: string };
const VERSION = cliPkg.version;

rmSync(OUT, { recursive: true, force: true });
mkdirSync(BIN_DIR, { recursive: true });
mkdirSync(join(LIB, 'dist'), { recursive: true });

const result = await build({
  // The output names matter: shells/cli/src/tui.ts starts the TUI by looking for
  // `./tui.js` beside its own bundle, exactly as it does in the npm package.
  entryPoints: { cli: join(REPO, 'shells/cli/bin/lolly.ts'), tui: join(REPO, 'shells/tui/src/main.tsx') },
  outdir: join(LIB, 'dist'),
  bundle: true,
  splitting: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  jsx: 'automatic',
  external: EXTERNAL,
  // Inlining jsdom and handlebars brings CommonJS code that calls `require` at run time.
  // esbuild's ESM output answers that with a shim which throws unless a real `require` is
  // in scope, so give every chunk one, anchored at its own location. Without it the first
  // render dies on `Dynamic require of "path" is not supported`, and only the render path
  // reaches it, so `list` and `--version` pass while the tool that matters does not.
  banner: {
    js: "import { createRequire as __lollyCreateRequire } from 'node:module';\n"
      + 'const require = __lollyCreateRequire(import.meta.url);',
  },
  metafile: true,
  logLevel: 'warning',
});

const outputs = Object.keys(result.metafile.outputs);
for (const name of ['cli', 'tui']) {
  if (!outputs.some(o => o.endsWith(`/dist/${name}.js`))) {
    throw new Error(`esbuild produced no dist/${name}.js (outputs: ${outputs.join(', ')})`);
  }
}
const bundleBytes = Object.values(result.metafile.outputs).reduce((n, o) => n + o.bytes, 0);

// A workspace specifier left in an output would be a dangling import at run time, and the
// sidecar has no node_modules above it to accidentally satisfy it.
for (const out of outputs) {
  const src = readFileSync(join(REPO, out), 'utf8');
  const m = /(?:from|import|require)\s*\(?\s*["'](@lolly(?:-tools)?\/[^"']+)["']/.exec(src);
  if (m) throw new Error(`a workspace import survived bundling: ${relative(REPO, join(REPO, out))} needs ${m[1]}`);
}

// `lolly --version` reads ../package.json from beside its bundle. Same shape as the npm
// package, so the version string is the same string in both.
writeFileSync(
  join(LIB, 'package.json'),
  `${JSON.stringify({ name: '@lolly-tools/cli', version: VERSION, private: true, type: 'module' }, null, 2)}\n`,
);

// ── 2. the packages that cannot be inlined ────────────────────────────────────
/**
 * Find an installed package the way Node does: from `from`, walk up through each
 * `node_modules` on the way to the repo root. npm hoists most packages to the top level
 * and nests the rest on a version conflict, so a top-level-only lookup misses those.
 *
 * Read off disk rather than through `require.resolve`: several of these packages publish
 * an `exports` map with no `./package.json` entry, so the resolver refuses the very path
 * that would locate them.
 */
function findPackage(name: string, from: string): string | null {
  let dir = from;
  for (;;) {
    const candidate = join(dir, 'node_modules', ...name.split('/'));
    if (existsSync(join(candidate, 'package.json'))) return candidate;
    const parent = dirname(dir);
    if (parent === dir || !dir.startsWith(REPO)) return null;
    dir = parent;
  }
}

const packageDir = (name: string): string => {
  const dir = findPackage(name, REPO);
  if (!dir) throw new Error(`${name} is not installed under ${relative(process.cwd(), REPO)}; run npm install first`);
  return dir;
};

/**
 * Copy a package and everything it declares, flattened into the payload's node_modules.
 *
 * Only `dependencies` are followed. `optionalDependencies` are what the absent-beats-a-
 * stub rule is about, `peerDependencies` are already satisfied by the closure or by a
 * package that is inlined, and `devDependencies` never run.
 */
mkdirSync(join(LIB, 'node_modules'), { recursive: true });
const copied = new Set<string>();
const missing: string[] = [];
function copyPackageClosure(name: string, from: string): void {
  if (copied.has(name)) return;
  const src = findPackage(name, from);
  if (!src) { missing.push(name); return; }
  copied.add(name);
  const dest = join(LIB, 'node_modules', ...name.split('/'));
  mkdirSync(dirname(dest), { recursive: true });
  // Skip each package's own nested node_modules: everything it needs is copied to the
  // flat top level here, and copying both would duplicate whole subtrees.
  cpSync(src, dest, {
    recursive: true,
    dereference: true,
    filter: (s) => !relative(src, s).split(sep).includes('node_modules'),
  });
  const manifest = JSON.parse(readFileSync(join(src, 'package.json'), 'utf8')) as {
    dependencies?: Record<string, string>;
  };
  for (const dep of Object.keys(manifest.dependencies ?? {})) copyPackageClosure(dep, src);
}
for (const name of COPIED_PACKAGES) copyPackageClosure(name, REPO);
if (missing.length) {
  throw new Error(`these declared dependencies are not installed: ${[...new Set(missing)].join(', ')}`);
}

// ── 3. the native addon, loose, beside the payload ────────────────────────────
const bindingSuffix = RESVG_BINDING[TARGET];
if (!bindingSuffix) throw new Error(`no @resvg/resvg-js binding mapped for ${TARGET}`);
const bindingPkg = `@resvg/resvg-js-${bindingSuffix}`;
let addonSource: string | null = null;
try {
  addonSource = join(packageDir(bindingPkg), `resvgjs.${bindingSuffix}.node`);
} catch {
  addonSource = null;
}
if (addonSource && !existsSync(addonSource)) addonSource = null;

const addonsDir = join(LIB, 'addons');
mkdirSync(addonsDir, { recursive: true });
if (addonSource) {
  copyFileSync(addonSource, join(addonsDir, 'resvgjs.node'));
} else if (crossBuilding) {
  // A cross build cannot take the host's binding. Say so rather than shipping the wrong
  // architecture, which would fail at dlopen time in the user's app.
  throw new Error(
    `${bindingPkg} is not installed here, and ${TARGET} is not this machine. ` +
    `Run \`npm i --no-save ${bindingPkg}\` first, or build the sidecar on a ${TARGET} runner.`,
  );
} else {
  throw new Error(`${bindingPkg} is not installed; run npm install first`);
}

// The shim. It is a resolver, not an addon: eleven lines that read
// LOLLY_SIDECAR_HOME (which the launcher sets from process.execPath) and load the loose
// .node from there. The wrapper below mirrors @resvg/resvg-js's own index.js, which
// JSON-stringifies the options object before handing it to the binding.
mkdirSync(join(LIB, 'node_modules', '@resvg', 'resvg-js'), { recursive: true });
writeFileSync(
  join(LIB, 'node_modules', '@resvg', 'resvg-js', 'package.json'),
  `${JSON.stringify({ name: '@resvg/resvg-js', version: '0.0.0-sidecar', main: 'index.cjs' }, null, 2)}\n`,
);
writeFileSync(
  join(LIB, 'node_modules', '@resvg', 'resvg-js', 'index.cjs'),
  `// GENERATED by scripts/build-cli-sidecar.ts - do not edit.
// The addon itself is NOT in node_modules. It sits in the sidecar payload's addons/
// directory, found from process.execPath by the SEA launcher, which puts the answer in
// LOLLY_SIDECAR_HOME. The fallback is this file's own position in the payload, so the
// package still works when it is required directly.
'use strict';
const path = require('node:path');
const home = process.env.LOLLY_SIDECAR_HOME || path.resolve(__dirname, '..', '..', '..');
const binding = require(path.join(home, 'addons', 'resvgjs.node'));
const { render: _render, renderAsync: _renderAsync, Resvg: _Resvg } = binding;

module.exports.render = function render(svg, options) {
  return options ? _render(svg, JSON.stringify(options)) : _render(svg);
};
module.exports.renderAsync = function renderAsync(svg, options, signal) {
  return options ? _renderAsync(svg, JSON.stringify(options), signal) : _renderAsync(svg, null, signal);
};
module.exports.Resvg = class Resvg extends _Resvg {
  constructor(svg, options) {
    super(svg, JSON.stringify(options));
  }
};
`,
);

// ── 4. the SEA launcher ───────────────────────────────────────────────────────
const LAUNCHER = `// GENERATED by scripts/build-cli-sidecar.ts - do not edit.
// The embedded main of the sidecar executable. Node 24's SEA main runs as CommonJS, and
// the CLI bundle is ESM with top-level await, so this file finds the payload and imports
// it. It stays small on purpose: everything it can get wrong is a path.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const PAYLOAD = ${JSON.stringify(PAYLOAD)};
const execDir = path.dirname(process.execPath);

// Where the payload sits, most specific first. The desktop app sets LOLLY_SIDECAR_HOME
// from its own resource directory, so inside the app exactly one of these is consulted;
// the rest are for running the sidecar on its own, out of the staging tree or an
// unpacked bundle.
const candidates = [
  process.env.LOLLY_SIDECAR_HOME,
  path.join(execDir, PAYLOAD),
  path.join(execDir, '..', PAYLOAD),
  path.join(execDir, '..', 'Resources', PAYLOAD),
  path.join(execDir, '..', 'Resources', 'resources', PAYLOAD),
  path.join(execDir, '..', 'lib', 'lolly', PAYLOAD),
];

let home = null;
for (const c of candidates) {
  if (c && fs.existsSync(path.join(c, 'dist', 'cli.js'))) { home = path.resolve(c); break; }
}
if (!home) {
  process.stderr.write(
    'lolly: this build carries no CLI payload. Expected ' + PAYLOAD + '/dist/cli.js beside ' +
    execDir + ', or LOLLY_SIDECAR_HOME pointing at it.\\n',
  );
  process.exit(3);
}
process.env.LOLLY_SIDECAR_HOME = home;

// A SEA gets argv [execPath, argv0, ...args]; the CLI reads argv.slice(2), so the shape
// already matches a normal node run. Rewrite argv[1] to the entry anyway, so anything
// that prints or inspects it sees a script path rather than a repeated executable.
//
// One exception: \`lolly tui\` starts the TUI by spawning process.execPath with the
// compiled entry as its first argument, the way it would call node. A SEA ignores a
// script path and runs its own main, so honour it here. Only a file inside the payload
// is accepted, so an argument that happens to end in .js can never be executed.
let entry = path.join(home, 'dist', 'cli.js');
let rest = process.argv.slice(2);
const first = rest[0];
if (first && /\\.(?:js|mjs|cjs)$/.test(first)) {
  const asked = path.resolve(first);
  if (asked.startsWith(home + path.sep) && fs.existsSync(asked)) {
    entry = asked;
    rest = rest.slice(1);
  }
}
process.argv = [process.argv[0], entry, ...rest];

import(pathToFileURL(entry).href).catch((err) => {
  process.stderr.write('lolly: ' + ((err && err.stack) || err) + '\\n');
  process.exit(1);
});
`;

const seaWork = mkdtempSync(join(tmpdir(), 'lolly-sea-'));
writeFileSync(join(seaWork, 'launcher.js'), LAUNCHER);
writeFileSync(
  join(seaWork, 'sea-config.json'),
  `${JSON.stringify({
    main: 'launcher.js',
    output: 'sea.blob',
    disableExperimentalSEAWarning: true,
    useSnapshot: false,
    useCodeCache: false,
  }, null, 2)}\n`,
);
execFileSync(NODE_BINARY, ['--experimental-sea-config', 'sea-config.json'], {
  cwd: seaWork,
  stdio: ['ignore', 'pipe', 'inherit'],
});

const seaName = `lolly-cli-${TARGET}${isWindowsTarget ? '.exe' : ''}`;
const seaPath = join(BIN_DIR, seaName);
const isMacTarget = TARGET.includes('apple-darwin');

/** codesign, with its failure surfaced. An unsigned arm64 Mach-O is SIGKILLed on launch,
 *  which reads as an unexplained exit 137 rather than an error, so this never runs quiet. */
const codesign = (args: string[], required: boolean): void => {
  if (process.platform !== 'darwin') return;
  const r = spawnSync('codesign', args, { encoding: 'utf8' });
  if (required && r.status !== 0) {
    throw new Error(`codesign ${args[0]} failed (exit ${r.status}): ${r.stderr ?? ''}`);
  }
};

const postjectBin = flag('postject');
function inject(): void {
  copyFileSync(NODE_BINARY, seaPath);
  chmodSync(seaPath, 0o755);
  // macOS refuses to run a signed binary whose bytes changed, so strip the signature
  // before injecting and re-sign after. Ad-hoc is enough here; the release build re-signs
  // the whole app bundle, sidecar included, with the real identity.
  // Not required: a freshly copied node binary may already be unsigned on some hosts.
  if (isMacTarget) codesign(['--remove-signature', seaPath], false);

  const args = [
    seaPath, 'NODE_SEA_BLOB', join(seaWork, 'sea.blob'),
    '--sentinel-fuse', SEA_FUSE,
    ...(isMacTarget ? ['--macho-segment-name', 'NODE_SEA'] : []),
  ];
  const r = postjectBin
    ? spawnSync(postjectBin, args, { stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8' })
    : spawnSync('npx', ['--yes', `postject@${POSTJECT_VERSION}`, ...args], {
        stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8',
      });
  if (r.status !== 0) {
    throw new Error(
      `postject failed (exit ${r.status}). ${r.stdout ?? ''}\n` +
      'Pass --postject=<path to the postject executable> if this machine cannot reach the registry.',
    );
  }
  if (isMacTarget) {
    codesign(['--sign', '-', '--force', seaPath], true);
    codesign(['--verify', seaPath], true);
  }
}

/**
 * Inject, then check the binary actually starts.
 *
 * postject reports success and still writes a broken Mach-O now and then: the injected
 * `__NODE_SEA_BLOB` section is laid past the end of its own segment and dyld refuses the
 * image ("section end address is beyond containing segment's end"). It happened once in
 * four runs here, on unchanged inputs, and a plain re-inject fixed it. So a launch that
 * fails THAT WAY is retried; anything else is a real fault in the payload and is raised
 * at once, because injecting the same bytes again would only hide it.
 */
const DYLD_SEGMENT_FAULT = /beyond containing segment|malformed mach-o|code signature/i;
let launchError = '';
for (let attempt = 1; attempt <= 3; attempt++) {
  inject();
  const probe = spawnSync(seaPath, ['--version'], { encoding: 'utf8' });
  if (probe.status === 0 && probe.stdout.startsWith('lolly ')) { launchError = ''; break; }
  const said = (probe.stderr || probe.stdout || '').trim();
  launchError = `exit ${probe.status}: ${said.split('\n')[0] ?? ''}`;
  if (!DYLD_SEGMENT_FAULT.test(said)) {
    throw new Error(`the sidecar was injected but does not run - ${launchError}\n${said}`);
  }
  if (attempt < 3) console.log(`postject wrote a Mach-O the loader rejects (${launchError}); injecting again`);
}
if (launchError) throw new Error(`the injected sidecar does not start after three attempts - ${launchError}`);
rmSync(seaWork, { recursive: true, force: true });

// ── 5. verify: run the thing that was just built ──────────────────────────────
const dirBytes = (dir: string): number =>
  readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter(d => d.isFile())
    .reduce((n, d) => n + statSync(join(d.parentPath, d.name)).size, 0);

const skipVerify = Boolean(flag('skip-verify')) || crossBuilding;
if (!skipVerify) {
  const runSidecar = (args: string[], env: NodeJS.ProcessEnv = {}, cwd = OUT) =>
    spawnSync(seaPath, args, { encoding: 'utf8', env: { ...process.env, ...env }, cwd });

  const version = runSidecar(['--version']);
  if (version.status !== 0 || !version.stdout.startsWith('lolly ')) {
    throw new Error(`sidecar --version exited ${version.status}: ${version.stdout}${version.stderr}`);
  }

  const listed = runSidecar(['list', '--json'], { LOLLY_ROOT: REPO });
  if (listed.status !== 0) throw new Error(`sidecar list --json exited ${listed.status}: ${listed.stderr}`);
  const parsed = JSON.parse(listed.stdout) as { ok: boolean; result: { tools: Array<{ id: string }> } };
  if (!parsed.ok || !parsed.result?.tools?.length) throw new Error('sidecar list --json returned no tools');

  const svgOut = join(OUT, 'verify-qr.svg');
  const rendered = runSidecar(
    ['qr-code', '--url=https://example.com', '--export=svg', `--output=${svgOut}`],
    { LOLLY_ROOT: REPO },
  );
  if (rendered.status !== 0) throw new Error(`sidecar render exited ${rendered.status}: ${rendered.stderr}`);
  const svg = readFileSync(svgOut, 'utf8');
  if (!/^\s*(?:<\?xml[^>]*\?>\s*)?<svg\b/.test(svg)) {
    throw new Error(`the rendered file is not an SVG document: ${JSON.stringify(svg.slice(0, 60))}`);
  }
  rmSync(svgOut, { force: true });

  // The desktop always supplies its embedded content root. The publishable npm
  // package's isolated-install smoke owns the no-content exit-3 assertion; a
  // payload staged under this checkout can discover the checkout by design.
  console.log('verified: --version, list --json, and a rendered SVG');
} else {
  console.log(`verify skipped (${crossBuilding ? `cross build for ${TARGET}` : '--skip-verify'})`);
}

// ── 6. install into the desktop shell ─────────────────────────────────────────
if (flag('install')) {
  const binDest = join(DESKTOP_TAURI, 'bin');
  const libDest = join(DESKTOP_TAURI, PAYLOAD);
  mkdirSync(binDest, { recursive: true });
  rmSync(libDest, { recursive: true, force: true });
  copyFileSync(seaPath, join(binDest, seaName));
  chmodSync(join(binDest, seaName), 0o755);
  cpSync(LIB, libDest, { recursive: true });
  console.log(`installed → ${relative(REPO, binDest)}${sep}${seaName} and ${relative(REPO, libDest)}${sep}`);
}

const seaSize = statSync(seaPath).size;
const libSize = dirBytes(LIB);
const mb = (n: number): string => (n / 1024 / 1024).toFixed(1);
console.log(`built → ${relative(REPO, OUT)}`);
console.log(`  ${seaName}  ${mb(seaSize)} MB (Node ${NODE_VERSION} SEA + launcher)`);
console.log(`  ${PAYLOAD}/  ${mb(libSize)} MB (bundle ${mb(bundleBytes)} MB, addons + wasm packages the rest)`);
console.log(`  total added to the app: ${mb(seaSize + libSize)} MB`);
if (!flag('install')) console.log('  re-run with --install to place both under shells/tauri-desktop/src-tauri/');
