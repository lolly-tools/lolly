// SPDX-License-Identifier: MPL-2.0
/** Rebuild the dependency-free Rust pixel reference with a bounded WASM heap. */
import { execFileSync } from 'node:child_process';
import { chmodSync, copyFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const source = fileURLToPath(new URL('../packages/node-shell/wasm/pixel-kernel/', import.meta.url));
const target = fileURLToPath(new URL('../plans/artifacts/295/pixel-kernel-target/', import.meta.url));
mkdirSync(target, { recursive: true });
execFileSync('cargo', ['build', '--release', '--locked', '--target', 'wasm32-unknown-unknown', '--target-dir', target], {
  cwd: source, stdio: 'inherit',
  env: { ...process.env, RUSTFLAGS: '-C link-arg=--max-memory=201326592 -C link-arg=-zstack-size=1048576' },
});
const destination = join(source, 'pixel-kernel.wasm');
copyFileSync(join(target, 'wasm32-unknown-unknown/release/lolly_pixel_kernel.wasm'), destination);
chmodSync(destination, 0o644);
