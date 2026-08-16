// SPDX-License-Identifier: MPL-2.0
/**
 * skera - fontations' Rust font subsetter (https://crates.io/crates/skera,
 * repo https://github.com/googlefonts/fontations) - detection + invocation,
 * shared by the gated parity suite (tests/font-outline-subset-parity.test.ts)
 * and the benchmark harness (scripts/bench-font-outline.ts).
 *
 * Context (plan 88 - Font Outliner): Dave Crossland's steer is to adopt skera
 * once it reaches v1.0.0 (likely end of 2026). Until then it stays optional:
 * nothing here runs unless a binary is present. Install with
 *   cargo install skera --features cli
 * or point SKERA_BIN at a build. CLI shape per its README:
 *   skera --path <in> --unicodes <hex,list> --output-file <out>
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/** Locate a skera binary: $SKERA_BIN, then PATH, then ~/.cargo/bin. */
export function findSkera(): string | null {
  const env = process.env.SKERA_BIN;
  if (env && existsSync(env)) return env;
  try {
    const p = execFileSync('which', ['skera'], { encoding: 'utf8' }).trim();
    if (p) return p;
  } catch {
    /* not on PATH */
  }
  const cargoBin = join(homedir(), '.cargo', 'bin', 'skera');
  if (existsSync(cargoBin)) return cargoBin;
  return null;
}

export function skeraVersion(bin: string): string {
  try {
    return execFileSync(bin, ['--version'], { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

/** Unique codepoints of `text`, formatted for skera's --unicodes (comma-separated hex). */
export function unicodesArg(text: string): string {
  const cps = new Set<number>();
  for (const ch of text) cps.add(ch.codePointAt(0)!);
  return [...cps]
    .sort((a, b) => a - b)
    .map((c) => c.toString(16).toUpperCase())
    .join(',');
}

/**
 * Subset `fontPath` to the codepoints of `text`, writing `outPath`.
 * Returns wall-clock ms. Throws (with skera's stderr attached) on failure - 
 * callers decide whether that's a skip, a fail, or a report line.
 */
export function skeraSubset(bin: string, fontPath: string, text: string, outPath: string): number {
  const t0 = performance.now();
  try {
    execFileSync(bin, ['--path', fontPath, '--unicodes', unicodesArg(text), '--output-file', outPath], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e) {
    const err = e as { stderr?: Buffer | string; message: string };
    const stderr = err.stderr ? String(err.stderr).trim() : '';
    throw new Error(`skera subset failed for ${fontPath}${stderr ? `: ${stderr}` : ` (${err.message})`}`);
  }
  return performance.now() - t0;
}
