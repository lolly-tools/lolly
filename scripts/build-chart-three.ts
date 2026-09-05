// SPDX-License-Identifier: MPL-2.0
/**
 * Build the Chart tool's deliberately small Three.js renderer dependency.
 *
 * The general 3D tool needs WebGPU, model loaders, environments and controls;
 * Chart does not. This IIFE carries only the WebGL scene/geometry/material
 * primitives used by community/chart/lib/chart-three.js. Keeping the build
 * separate makes its payload and capability boundary reviewable.
 *
 *   npm run build:chart-three
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { build } from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = resolve(root, 'community/chart/lib/three-chart.min.js');
const version = (
  JSON.parse(readFileSync(resolve(root, 'node_modules/three/package.json'), 'utf8')) as {
    version: string;
  }
).version;

const entry = `
export {
  Scene, Color, PerspectiveCamera, OrthographicCamera, WebGLRenderer,
  Group, BoxGeometry, SphereGeometry, PlaneGeometry, TubeGeometry, BufferGeometry,
  Float32BufferAttribute, Mesh, MeshStandardMaterial, MeshPhysicalMaterial,
  MeshBasicMaterial, ShadowMaterial, GridHelper, DirectionalLight,
  HemisphereLight, AmbientLight, Vector3, CatmullRomCurve3, DoubleSide, PCFSoftShadowMap,
  SRGBColorSpace, ACESFilmicToneMapping
} from 'three';
`;

const result = await build({
  stdin: { contents: entry, resolveDir: root, loader: 'js' },
  bundle: true,
  write: false,
  minify: true,
  format: 'iife',
  globalName: 'LollyChartThree',
  target: 'es2020',
  charset: 'utf8',
  legalComments: 'none',
  banner: {
    js: `/*! three.js r${version.split('.')[1]} (${version}) - MIT - https://threejs.org - chart-only WebGL build */`,
  },
});

const output = result.outputFiles[0]!.text;
for (const symbol of [
  'WebGLRenderer',
  'BoxGeometry',
  'TubeGeometry',
  'CatmullRomCurve3',
  'MeshPhysicalMaterial',
  'Float32BufferAttribute',
]) {
  if (!output.includes(symbol)) throw new Error(`chart Three bundle is missing ${symbol}`);
}
if (
  output.includes('GLTFLoader') ||
  output.includes('WebGPURenderer') ||
  output.includes('OrbitControls')
) {
  throw new Error('chart Three bundle accidentally contains general 3-D tool features');
}
writeFileSync(target, output);
console.log(`wrote ${target}`);
console.log(
  `three ${version}: ${(Buffer.byteLength(output) / 1024).toFixed(0)} KB min, ${(gzipSync(output).length / 1024).toFixed(0)} KB gz`
);
