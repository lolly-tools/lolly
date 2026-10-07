// SPDX-License-Identifier: MPL-2.0
/** Build the portable float64 geometry pilot with pinned Rust and a bounded WASM heap. */
import { execFileSync } from 'node:child_process';
import { chmodSync, copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(
  new URL('../packages/node-shell/wasm/geometry-kernel/', import.meta.url)
);
const option = (name: string) => process.argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const target = resolve(option('target-dir') ?? fileURLToPath(new URL('../plans/295-validation/geometry-target/', import.meta.url)));
mkdirSync(target, { recursive: true });
const portable = process.argv.includes('--portable-math');
const fitting = portable || process.argv.includes('--fitting');
const clipping = process.argv.includes('--clipping');
const hostNorm = process.argv.includes('--host-norm');
if (clipping && fitting) throw new Error('Build clipping and fitting as separate artifacts.');
if (hostNorm && (portable || (!clipping && !fitting))) throw new Error('Host norms require a separate clipping or host-fitting artifact.');
execFileSync(
  'cargo',
  [
    'build',
    '--release',
    '--locked',
    '--target',
    'wasm32-unknown-unknown',
    '--target-dir',
    target,
    ...(clipping
      ? ['--features', hostNorm ? 'clipping,host-norm' : 'clipping']
      : fitting
        ? ['--features', portable ? 'portable-math' : hostNorm ? 'fitting,host-norm' : 'fitting']
        : []),
  ],
  {
    cwd: source,
    stdio: 'inherit',
    env: {
      ...process.env,
      RUSTFLAGS: '-C link-arg=--max-memory=16777216 -C link-arg=-zstack-size=1048576',
    },
  }
);
const destination = option('output') ? resolve(option('output')!) : join(
  source,
  clipping
    ? hostNorm ? 'geometry-clip-host-norm.wasm' : 'geometry-clip.wasm'
    : portable
      ? 'geometry-fit-portable.wasm'
      : fitting
        ? hostNorm ? 'geometry-fit-host-norm.wasm' : 'geometry-fit.wasm'
        : 'geometry-kernel.wasm'
);
mkdirSync(dirname(destination), { recursive: true });
copyFileSync(
  join(target, 'wasm32-unknown-unknown/release/lolly_geometry_kernel.wasm'),
  destination
);
chmodSync(destination, 0o644);
