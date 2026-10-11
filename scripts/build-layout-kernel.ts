// SPDX-License-Identifier: MPL-2.0
import { execFileSync } from 'node:child_process';
import { chmodSync, copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const source = fileURLToPath(
  new URL('../packages/node-shell/wasm/layout-kernel/', import.meta.url)
);
const target = fileURLToPath(new URL('../plans/305-layout-target/', import.meta.url));
mkdirSync(target, { recursive: true });
execFileSync(
  'cargo',
  [
    'build',
    '--lib',
    '--release',
    '--locked',
    '--target',
    'wasm32-unknown-unknown',
    '--target-dir',
    target,
  ],
  {
    cwd: source,
    stdio: 'inherit',
    env: {
      ...process.env,
      RUSTFLAGS: '-C link-arg=--max-memory=33554432 -C link-arg=-zstack-size=1048576',
    },
  }
);
const destination = join(source, 'layout-kernel.wasm');
copyFileSync(join(target, 'wasm32-unknown-unknown/release/lolly_layout_kernel.wasm'), destination);
chmodSync(destination, 0o644);
