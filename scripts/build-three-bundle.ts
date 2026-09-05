// SPDX-License-Identifier: MPL-2.0
/**
 * Build the 3d tool's vendored three.js bundle - `tools/3d/lib/three.min.js`.
 *
 * One IIFE global, `window.LollyThree`, carrying three's WebGPU build plus the
 * addons the tool uses (GLTFLoader, RoomEnvironment, OrbitControls). The WebGPU
 * build is also the WebGL 2 fallback: `new WebGPURenderer({ forceWebGL: true })`
 * paints through WebGL 2 with the same API, so the tool needs no second renderer
 * and the bundle carries no `WebGLRenderer` at all. The addons import the bare
 * `three` specifier, which normally resolves to the WebGL build; the resolve
 * plugin below points it at the WebGPU build so the bundle holds exactly one copy
 * of the library.
 *
 * Written to community/3d/lib/ and, when the private pack is mounted, to
 * brands/suse/tools/3d/lib/ - the SUSE override ships its own copy of the tool
 * directory, so both must carry the same bytes.
 *
 *   npm run build:three          (node scripts/build-three-bundle.ts)
 *
 * `three` is a root devDependency pinned to an exact version; bump it there and
 * re-run. The tool's template checks `THREE.WebGPURenderer` on load, so a bundle
 * built from the WebGL build would be refused, not silently used.
 */
import { build } from 'esbuild';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const threeVersion = (JSON.parse(readFileSync(resolve(repoRoot, 'node_modules/three/package.json'), 'utf8')) as { version: string }).version;
const threeWebgpu = fileURLToPath(import.meta.resolve('three/webgpu'));

const ENTRY = `
export * from 'three/webgpu';
export { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
export { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
export { OrbitControls } from 'three/addons/controls/OrbitControls.js';
`;

const TARGETS = [
  'community/3d/lib/three.min.js',
  'brands/suse/tools/3d/lib/three.min.js',
].map((p) => resolve(repoRoot, p)).filter((p) => existsSync(dirname(p)));

const result = await build({
  stdin: { contents: ENTRY, resolveDir: repoRoot, loader: 'js' },
  bundle: true,
  write: false,
  minify: true,
  format: 'iife',
  globalName: 'LollyThree',
  target: 'es2020',
  charset: 'utf8',
  legalComments: 'none',
  banner: { js: `/*! three.js r${threeVersion.split('.')[1]} (${threeVersion}) - MIT - https://threejs.org - WebGPU build + GLTFLoader/RoomEnvironment/OrbitControls, bundled by scripts/build-three-bundle.ts */` },
  plugins: [{
    name: 'three-webgpu-build',
    setup(b) {
      b.onResolve({ filter: /^three$/ }, () => ({ path: threeWebgpu }));
    },
  }],
});

const out = result.outputFiles[0]!;
const text = out.text;
// The refusal the template relies on, checked at build time too.
for (const needle of ['WebGPURenderer', 'GLTFLoader', 'RoomEnvironment', 'PMREMGenerator']) {
  if (!text.includes(needle)) throw new Error(`bundle is missing ${needle}`);
}
if (/class \w+ extends \w+\{[^}]*isWebGLRenderer/.test(text)) throw new Error('bundle carries the WebGL renderer - the alias plugin did not take');

for (const target of TARGETS) {
  writeFileSync(target, text);
  console.log(`wrote ${target}`);
}
const kb = (n: number): string => `${(n / 1024).toFixed(0)} KB`;
console.log(`three ${threeVersion}: ${kb(Buffer.byteLength(text))} min, ${kb(gzipSync(text).length)} gz`);
