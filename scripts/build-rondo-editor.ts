#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Build the Rondocode utility's editor as ONE self-contained HTML file.
 *
 *   node scripts/build-rondo-editor.ts           write community/rondocode/lib/editor.html
 *   node scripts/build-rondo-editor.ts --check   rebuild in memory, exit 1 if the committed file differs
 *
 * The file holds rondocode's app (packages/rondo/upstream, with Lolly's patch
 * series applied) and Lolly's frame glue (packages/rondo/editor), with every
 * script and style inline, so the utility can load the whole editor into an
 * opaque-origin frame through `srcdoc` and the frame needs no URL of its own.
 * Three Vite builds go into it:
 *
 *   1. the AudioWorklet processor, as ES module text. The app turns that text
 *      into a blob: URL inside the frame (audioWorklet.addModule takes a URL);
 *   2. Lolly's boot script (packages/rondo/editor/boot.ts), an IIFE that runs
 *      first and sets up the host seam the patches read. It carries Lolly's
 *      chrome (editor/chrome.ts), which is built from the web shell's own
 *      modules: the audio transport, the icon set, the menu and context menu,
 *      the body popover and the MilkDrop visualiser. Three shell modules that
 *      reach for the shell's page are swapped for frame versions
 *      (editor/shims): translations, the Back-button stack and the focus
 *      music player;
 *   3. the app itself (upstream src/main.ts), one ES module with every dynamic
 *      import inlined.
 *
 * Where it ships: as a tool-local file of community/rondocode, in lib/ beside
 * the other tools' vendored bundles (it is one: rondocode, CodeMirror, ONNX
 * Runtime and the rest, built). Tool files are what every shell already
 * carries: the web service worker caches /tools/<id>/ files and an "available
 * offline" pin stores the /tools/<id>/lib/ and /assets/ files a tool's sources
 * name, the Tauri apps embed the dist, and a static deploy serves the
 * directory. A shell-served file would need its own cache rule and its own
 * copy step in each shell for no gain.
 *
 * ONNX Runtime (for sing()) is the web shell's own onnxruntime-web, the same
 * version as the runtime files the shell serves under /ort/, so the wasm the
 * utility hands the frame matches the glue compiled in here. Its wasm binary is
 * never inlined; the frame asks the utility for it (upstream src/lolly/sing.ts).
 *
 * The chrome's styles are the shell's own rules for those components, taken
 * from the shell's stylesheets by selector (SHELL_RULES below), and
 * editor/chrome.css. Their values are the shell's design tokens: the file
 * lists the tokens those rules read (meta lolly-rondo-tokens) and the utility
 * passes the values it resolves on its page.
 *
 * Reproducible: the same sources and dependency versions give the same bytes.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { build, type InlineConfig, type Plugin } from 'vite';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = path.join(repo, 'packages/rondo');
const upstream = path.join(pkg, 'upstream');
const app = path.join(upstream, 'packages/app');
const OUT = path.join(repo, 'community/rondocode/lib/editor.html');
const CHECK = process.argv.includes('--check');

const upstreamCommit = (/^\*\*Commit:\*\* `([0-9a-f]{40})`/m.exec(readFileSync(path.join(pkg, 'UPSTREAM.md'), 'utf8')) ?? [])[1] ?? 'unknown';

/** The editor's version: the upstream commit and a hash of the patch series. */
const patchesDir = path.join(pkg, 'patches');
const patchHash = createHash('sha256');
for (const f of readdirSync(patchesDir).filter((n) => n.endsWith('.patch')).sort()) patchHash.update(f).update(readFileSync(path.join(patchesDir, f)));
const EDITOR_VERSION = `${upstreamCommit.slice(0, 12)}+lolly.editor.${patchHash.digest('hex').slice(0, 8)}`;

const shellSrc = path.join(repo, 'shells/web/src');
/** Shell modules the frame swaps for its own versions (editor/shims). */
const SHIMS: Record<string, string> = {
  [path.join(shellSrc, 'i18n.ts')]: path.join(pkg, 'editor/shims/i18n.ts'),
  [path.join(shellSrc, 'lib/overlay-back.ts')]: path.join(pkg, 'editor/shims/overlay-back.ts'),
  [path.join(shellSrc, 'lib/neurospicy.ts')]: path.join(pkg, 'editor/shims/neurospicy.ts'),
};
const shellShims: Plugin = {
  name: 'lolly-shell-shims',
  enforce: 'pre',
  resolveId(id, importer) {
    // Any relative import of a swapped shell module, from the shell's own
    // modules or from the chrome (which takes t() from the shell's i18n path).
    if (!importer || !id.startsWith('.')) return undefined;
    const target = path.resolve(path.dirname(importer), id);
    return SHIMS[target];
  },
};

/**
 * The shell's own rules for the components the chrome draws, by selector:
 * the transport, the visualiser switcher, the menu skin and the context
 * menu's sheet. A rule whose selector list names other components too keeps
 * only these selectors.
 */
const SHELL_RULES = {
  files: ['styles/parts/buttons.css', 'styles/parts/components.css', 'styles/parts/folders.css', 'styles/parts/asset-shared.css', 'styles/parts/assets.css'],
  keep: /^\.(?:cat-tp|cat-viz-(?:group|name|btn)\b|folder-menu|ctx-menu\b|ctx-sheet)/,
  keyframes: /^ctx-sheet-/,
};

/** Top-level blocks of a stylesheet with its comments removed: prelude and body. */
function cssBlocks(css: string): { prelude: string; body: string }[] {
  const out: { prelude: string; body: string }[] = [];
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf('{', i);
    if (open < 0) break;
    let prelude = css.slice(i, open);
    const semi = prelude.lastIndexOf(';');
    if (semi >= 0) prelude = prelude.slice(semi + 1); // a statement at-rule (@import) before it
    let depth = 1;
    let j = open + 1;
    while (j < css.length && depth > 0) {
      if (css[j] === '{') depth++;
      else if (css[j] === '}') depth--;
      j++;
    }
    out.push({ prelude: prelude.trim(), body: css.slice(open + 1, j - 1) });
    i = j;
  }
  return out;
}

/** A selector list split at its top-level commas. */
function selectors(list: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === ',' && depth === 0) {
      out.push(list.slice(start, i).trim());
      start = i + 1;
    }
  }
  out.push(list.slice(start).trim());
  return out.filter(Boolean);
}

function pickRules(css: string): string {
  const out: string[] = [];
  for (const b of cssBlocks(css)) {
    if (/^@(media|supports)\b/.test(b.prelude)) {
      const inner = pickRules(b.body);
      if (inner) out.push(`${b.prelude.replace(/\s+/g, ' ')}{${inner}}`);
    } else if (/^@layer\b/.test(b.prelude)) {
      out.push(pickRules(b.body));
    } else if (/^@keyframes\b/.test(b.prelude)) {
      if (SHELL_RULES.keyframes.test(b.prelude.slice(10).trim())) out.push(`${b.prelude}{${b.body.trim().replace(/\s+/g, ' ')}}`);
    } else if (!b.prelude.startsWith('@')) {
      const kept = selectors(b.prelude).filter((sel) => SHELL_RULES.keep.test(sel));
      if (kept.length) out.push(`${kept.join(',')}{${b.body.trim().replace(/\s+/g, ' ')}}`);
    }
  }
  return out.filter(Boolean).join('\n');
}

function chromeCss(): string {
  const parts = SHELL_RULES.files.map((rel) => {
    const css = readFileSync(path.join(shellSrc, rel), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    return `/* shells/web/src/${rel} */\n${pickRules(css)}`;
  });
  const own = readFileSync(path.join(pkg, 'editor/chrome.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\n\s*\n/g, '\n').trim();
  return `${parts.join('\n')}\n/* packages/rondo/editor/chrome.css */\n${own}`;
}

/** The custom properties a stylesheet reads: what the utility resolves for the frame. */
function tokensUsed(css: string): string[] {
  return [...new Set([...css.matchAll(/var\(\s*(--[\w-]+)/g)].map((m) => m[1]!))].sort();
}

/** The web shell's onnxruntime-web: the version /ort/ serves. */
const ortDir = path.join(repo, 'shells/web/node_modules/onnxruntime-web/dist');
const ORT_ENTRY = path.join(ortDir, 'ort.bundle.min.mjs');

const alias = [
  { find: '@rondocode/engine', replacement: path.join(upstream, 'packages/engine/src/index.ts') },
  { find: '@rondocode/pattern', replacement: path.join(upstream, 'packages/pattern/src/index.ts') },
  { find: '@rondocode/rondo', replacement: path.join(upstream, 'packages/rondo/src/index.ts') },
  // upstream's production alias: the private local examples never reach a build
  { find: /^\.\/local-loader$/, replacement: path.join(app, 'src/examples/local-loader.prod.ts') },
  { find: /^onnxruntime-web$/, replacement: ORT_ENTRY },
  // the visualiser palette's engine import, narrowed to the colour maths
  { find: '@lolly/engine', replacement: path.join(pkg, 'editor/engine-color.ts') },
];

const LICENCE = [
  'Rondocode editor for Lolly. Built by scripts/build-rondo-editor.ts; do not edit.',
  `rondocode (c) 2026 Vijay Pemmaraju, MIT License, https://github.com/vijaypemmaraju/rondocode at ${upstreamCommit}, with Lolly's patches (packages/rondo/patches).`,
  'Also bundled: CodeMirror and Lezer (MIT), acorn and acorn-walk (MIT), pako (MIT and Zlib), Prettier (MIT),',
  'butterchurn (MIT), onnxruntime-web (MIT), phonemizer (Apache-2.0). Lolly glue: MPL-2.0. See THIRD-PARTY-NOTICES.md.',
];

const base = (extra: InlineConfig): InlineConfig => ({
  configFile: false,
  envDir: false,
  publicDir: false,
  logLevel: 'warn',
  mode: 'production',
  root: app,
  resolve: { alias },
  ...extra,
});

/** The single output file of an in-memory lib build. */
async function bundle(cfg: InlineConfig, want: 'js' | 'css' = 'js'): Promise<string> {
  const res = await build(cfg);
  const outputs = (Array.isArray(res) ? res : [res]).flatMap((r) => ('output' in r ? r.output : []));
  const hit = outputs.find((o) => (want === 'js' ? o.type === 'chunk' : o.fileName.endsWith('.css')));
  if (!hit) throw new Error(`build produced no ${want}`);
  return hit.type === 'chunk' ? hit.code : String(hit.source);
}

async function bundleApp(workletCode: string): Promise<{ js: string; css: string }> {
  const workletBlob: Plugin = {
    name: 'lolly-worklet-blob',
    enforce: 'pre',
    resolveId(id) {
      return id.endsWith('processor?worker&url') ? '\0lolly-worklet-url' : undefined;
    },
    load(id) {
      if (id !== '\0lolly-worklet-url') return undefined;
      return `export default URL.createObjectURL(new Blob([${JSON.stringify(workletCode)}], { type: 'text/javascript' }))`;
    },
  };
  // ORT points at its wasm with `new URL(file, import.meta.url)`, which a bundler
  // reads as an asset to inline (28 MB). The frame hands ORT the bytes instead,
  // so the reference is turned into a plain string that bundles nothing.
  const ortNoWasmAsset: Plugin = {
    name: 'lolly-ort-no-wasm-asset',
    enforce: 'pre',
    transform(code, id) {
      if (!id.startsWith(ortDir)) return undefined;
      return code.replace(/new URL\("(ort-wasm-[\w.-]+\.wasm)",import\.meta\.url\)/g, 'new URL("$1","https://ort.invalid/")');
    },
  };
  const res = await build(base({
    plugins: [workletBlob, ortNoWasmAsset],
    build: {
      write: false,
      minify: true,
      cssCodeSplit: false,
      assetsInlineLimit: () => true,
      reportCompressedSize: false,
      lib: { entry: path.join(app, 'src/main.ts'), formats: ['es'], fileName: 'app' },
      rolldownOptions: { output: { codeSplitting: false } },
    },
  }));
  const outputs = (Array.isArray(res) ? res : [res]).flatMap((r) => ('output' in r ? r.output : []));
  const js = outputs.find((o) => o.type === 'chunk');
  const css = outputs.find((o) => o.fileName.endsWith('.css'));
  if (js?.type !== 'chunk' || css?.type !== 'asset') throw new Error('the app build is missing its script or its styles');
  const extra = outputs.filter((o) => o !== js && o !== css);
  if (extra.length) throw new Error(`the app build emitted files that cannot be inlined: ${extra.map((o) => o.fileName).join(', ')}`);
  return { js: js.code, css: String(css.source) };
}

/** Make text safe inside an inline <script> or <style>. */
const inlineScript = (js: string): string => js.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');
const inlineStyle = (css: string): string => css.replace(/<\/(style)/gi, '<\\/$1');

async function main(): Promise<void> {
  const worklet = await bundle(base({
    build: {
      write: false,
      minify: true,
      reportCompressedSize: false,
      lib: { entry: path.join(app, 'src/audio/worklet/processor.ts'), formats: ['es'], fileName: 'worklet' },
      rolldownOptions: { output: { codeSplitting: false } },
    },
  }));
  const boot = await bundle(base({
    root: pkg,
    plugins: [shellShims],
    build: {
      write: false,
      minify: true,
      reportCompressedSize: false,
      lib: { entry: path.join(pkg, 'editor/boot.ts'), formats: ['iife'], name: 'lollyRondoBoot', fileName: 'boot' },
      rolldownOptions: { output: { codeSplitting: false } },
    },
  }));
  const { js, css } = await bundleApp(worklet);

  // Upstream's model URLs stay in the text (they are the file ids' source, and
  // the branches that fetch them are not taken in the frame); an analytics host
  // and the MCP bridge's WebSocket must not be there at all.
  // The editor ships in the tool's lib/, which tests/no-trackers.test.ts skips
  // as vendored code, so the build makes the same check here. The names are
  // joined at run time so this file does not trip that test itself.
  const TRACKER_HOSTS = [['google-analytics', 'com'], ['googletagmanager', 'com'], ['doubleclick', 'net'], ['plausible', 'io'], ['clarity', 'ms'], ['sentry', 'io'], ['segment', 'io'], ['facebook', 'net']].map((p) => p.join('.'));
  for (const [name, text] of [['app', js], ['boot', boot], ['worklet', worklet]] as const) {
    const tracker = TRACKER_HOSTS.find((h) => text.includes(h));
    if (tracker) throw new Error(`${name} bundle names an analytics host: ${tracker}`);
    if (/\bnew WebSocket\(/.test(text)) throw new Error(`${name} bundle opens a WebSocket`);
  }

  const lollyCss = chromeCss();
  // the frame's own properties and the font stacks (set from the fonts) are not tokens to pass
  const tokens = tokensUsed(lollyCss).filter((t) => !t.startsWith('--lolly-') && t !== '--font-brand' && t !== '--font-mono');
  const digest = createHash('sha256').update(worklet).update(boot).update(js).update(css).update(lollyCss).digest('hex').slice(0, 16);
  const html = [
    '<!doctype html>',
    `<!-- ${LICENCE.join('\n     ')} -->`,
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
    `<meta name="lolly-rondo-editor" content="${digest}">`,
    `<meta name="lolly-rondo-version" content="${EDITOR_VERSION}">`,
    `<meta name="lolly-rondo-tokens" content="${tokens.join(' ')}">`,
    '<title>Rondocode</title>',
    `<style>${inlineStyle(css)}</style>`,
    `<style>${inlineStyle(lollyCss)}</style>`,
    '<!--lolly-rondo-boot-->',
    `<script>${inlineScript(boot)}</script>`,
    '</head>',
    '<body>',
    '<div id="app"></div>',
    `<script type="module">${inlineScript(js)}</script>`,
    '</body>',
    '</html>',
    '',
  ].join('\n');

  const raw = Buffer.byteLength(html);
  const gz = gzipSync(html, { level: 9 }).length;
  const mb = (n: number): string => `${(n / 1024 / 1024).toFixed(2)} MB`;
  const sizes = `editor.html ${mb(raw)} (${mb(gz)} gzipped): app ${mb(js.length)}, styles ${mb(css.length + lollyCss.length)}, boot and chrome ${mb(boot.length)}, worklet ${mb(worklet.length)}; version ${EDITOR_VERSION}`;

  if (CHECK) {
    const committed = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
    if (committed !== html) {
      console.error(`community/rondocode/lib/editor.html is out of date (${sizes}). Run: node scripts/build-rondo-editor.ts`);
      process.exit(1);
    }
    console.log(`✓ editor.html matches its sources (${sizes})`);
    return;
  }
  mkdirSync(path.dirname(OUT), { recursive: true });
  writeFileSync(OUT, html);
  console.log(`wrote ${path.relative(repo, OUT)}: ${sizes}`);
}

await main();
