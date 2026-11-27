// SPDX-License-Identifier: MPL-2.0
/**
 * Rust flags shared by the scripts that build the committed WebAssembly kernels
 * (packages/node-shell/wasm/*).
 *
 * Panic messages name source files, and rustc writes crates from outside the package
 * (the Cargo registry, git checkouts) by their absolute path. Without remapping, a
 * committed .wasm carries the builder's home directory, user name included. Each build
 * writes the checkout as /lolly and the Cargo home as /cargo, so the module holds no
 * path from the machine that built it and the same source builds the same bytes
 * wherever it is checked out. scripts/check-binary-home-paths.ts fails CI when a
 * committed binary holds a home-directory path.
 */
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = fileURLToPath(new URL('../..', import.meta.url)).replace(/[\\/]$/, '');

/** `--remap-path-prefix` flags for the checkout and the Cargo home. */
export function remapPathFlags(): string[] {
  const cargoHome = process.env.CARGO_HOME ?? join(homedir(), '.cargo');
  return [`--remap-path-prefix=${REPO}=/lolly`, `--remap-path-prefix=${cargoHome}=/cargo`];
}

/**
 * The environment for `cargo build`: the caller's flags followed by the path remaps.
 * They travel as CARGO_ENCODED_RUSTFLAGS, so a path with a space stays one argument,
 * and RUSTFLAGS is removed, so a value set in the shell cannot replace them.
 */
export function wasmBuildEnv(flags: readonly string[]): NodeJS.ProcessEnv {
  return { ...process.env, RUSTFLAGS: undefined, CARGO_ENCODED_RUSTFLAGS: [...flags, ...remapPathFlags()].join('\x1f') };
}
