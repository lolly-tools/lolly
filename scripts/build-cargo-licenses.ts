#!/usr/bin/env node
/**
 * Cargo crate license map generator.
 *
 * Run as: npm run build:cargo-licenses  (or directly: node scripts/build-cargo-licenses.ts)
 *
 * Cargo.lock records no license data, so scripts/build-sbom.ts on its own can
 * only mark every Rust crate `unknown`. This tool closes that gap: it runs
 * `cargo metadata` over each Tauri shell's crate graph (the resolver reads the
 * declared `license` field of every crate in Cargo.lock) and writes the result
 * to a committed map, `cargo-licenses.json` (repo root), which build-sbom.ts
 * consumes to attribute pkg:cargo components.
 *
 * Design notes:
 *   - Requires only `cargo` itself (no cargo-license / cargo-about install) and
 *     runs with --locked, so the graph is exactly what Cargo.lock pins. It may
 *     download registry metadata on first run; the OUTPUT is committed, so CI
 *     and airgapped checkouts never need cargo at all.
 *   - DETERMINISTIC: keys sorted, no timestamp — re-running with an unchanged
 *     Cargo.lock produces a byte-identical file (git diff is the drift signal).
 *   - Legacy `A/B` license syntax (Cargo's documented shorthand for OR) is
 *     normalized to an SPDX `A OR B` expression.
 *   - Crates declaring only `license-file` (no SPDX expression) are resolved by
 *     hand in LICENSE_FILE_OVERRIDES (id read off the file + why it's shippable,
 *     both emitted to `licenseFileNotes`). Anything not in that table is left OUT
 *     of the map — build-sbom.ts keeps it `unknown` and warns, so an unreviewed
 *     non-SPDX license stays a visible audit item instead of being papered over.
 *   - The workspace's own crates (lolly-desktop, lolly-mobile; `source: null`)
 *     carry no license field in their Cargo.toml but are first-party code under
 *     the repository's MPL-2.0 LICENSE, so they are mapped to MPL-2.0.
 *   - Run this after `cargo update` / lockfile changes, then commit the
 *     regenerated cargo-licenses.json AND sbom.cdx.json (npm run build:sbom).
 */

import { execFileSync } from 'node:child_process';
import { writeFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_PATH = join(ROOT, 'cargo-licenses.json');

// The two Rust crate graphs Lolly ships (same set scripts/build-sbom.ts reads).
const CRATE_DIRS = [
  'shells/tauri-desktop/src-tauri',
  'shells/tauri-mobile/src-tauri',
];

// First-party workspace crates: no `license` field in Cargo.toml, but they are
// this repository's own code, licensed under the root LICENSE (MPL-2.0).
const FIRST_PARTY_LICENSE = 'MPL-2.0';

// Crates that ship a `license-file` instead of an SPDX `license` field, read by
// hand and pinned here. Without this they stay `unknown` in the SBOM — which is
// the worst outcome for the one category that most needs an explicit answer, so
// each entry records the SPDX id read off the file plus WHY it is acceptable.
// Re-verify an entry when its version changes (the key is version-pinned).
const LICENSE_FILE_OVERRIDES: Record<string, { spdx: string; note: string }> = {
  // GPL-3.0 — the only strong-copyleft crate in either graph. It is a
  // BUILD-dependency of headless_chrome (`[build-dependencies.auto_generate_cdp]`),
  // a code generator that runs in that crate's build.rs to emit DevTools Protocol
  // bindings from Chrome's protocol.json. It is never linked into the shipped
  // desktop binary, so it does not place the distributed artifact under the GPL.
  // Desktop graph only — absent from tauri-mobile. Flagged for OSS-office sign-off.
  'auto_generate_cdp@0.4.6': {
    spdx: 'GPL-3.0-only',
    note: 'build-time code generator (headless_chrome build.rs); not linked into the shipped binary',
  },
};

// Minimal shape of the `cargo metadata` output we read.
interface CargoPackage {
  name: string;
  version: string;
  license: string | null;
  license_file: string | null;
  source: string | null; // null → workspace member (first-party)
}

// Cargo's legacy `A/B` (and `A / B`) license shorthand means OR; normalize to a
// valid SPDX expression. Expressions already using OR/AND/WITH pass through.
function normalizeSpdx(license: string): string {
  if (!license.includes('/')) return license;
  return license.split(/\s*\/\s*/).join(' OR ');
}

const licenses = new Map<string, string>(); // "name@version" → SPDX expression
const unresolved: string[] = [];            // license-file-only crates (stay unknown)
const overridden: string[] = [];            // license-file crates resolved by hand

let ran = 0;
for (const rel of CRATE_DIRS) {
  const dir = join(ROOT, rel);
  if (!existsSync(join(dir, 'Cargo.toml'))) continue;
  const out = execFileSync('cargo', ['metadata', '--format-version', '1', '--locked'], {
    cwd: dir,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });
  const meta = JSON.parse(out) as { packages: CargoPackage[] };
  for (const p of meta.packages) {
    const key = `${p.name}@${p.version}`;
    if (licenses.has(key)) continue;
    if (p.license) {
      licenses.set(key, normalizeSpdx(p.license));
    } else if (p.source === null) {
      licenses.set(key, FIRST_PARTY_LICENSE);
    } else if (LICENSE_FILE_OVERRIDES[key]) {
      licenses.set(key, LICENSE_FILE_OVERRIDES[key]!.spdx);
      overridden.push(key);
    } else {
      unresolved.push(`${key}${p.license_file ? ` (license-file: ${p.license_file})` : ''}`);
    }
  }
  ran++;
}

if (!ran) {
  console.error('✗ No Tauri shell crate graphs found (are the submodules checked out?)');
  process.exit(1);
}

const sorted = Object.fromEntries([...licenses.entries()].sort(([a], [b]) => a.localeCompare(b)));
const doc = {
  '//': [
    'Crate license map for the Tauri shells’ Cargo.lock graphs, consumed by',
    'scripts/build-sbom.ts (Cargo.lock itself records no license data).',
    'Generated by scripts/build-cargo-licenses.ts (npm run build:cargo-licenses).',
    'Do not edit by hand — regenerate after any Cargo.lock change, then run',
    'npm run build:sbom and commit both files.',
    '',
    '"licenseFileNotes" records crates that declare a license-file rather than an',
    'SPDX expression: the id was read off the file by hand and pinned in',
    'LICENSE_FILE_OVERRIDES, with the reason it is acceptable to ship.',
  ],
  licenses: sorted,
  licenseFileNotes: Object.fromEntries(
    [...overridden].sort().map((k) => [k, LICENSE_FILE_OVERRIDES[k]!.note]),
  ),
};
writeFileSync(OUT_PATH, JSON.stringify(doc, null, 2) + '\n');
console.log(`✓ Wrote cargo-licenses.json — ${licenses.size} crates attributed`);
for (const k of [...new Set(overridden)].sort()) {
  console.log(`  license-file resolved by hand: ${k} → ${LICENSE_FILE_OVERRIDES[k]!.spdx}`);
}
if (unresolved.length) {
  console.warn(`⚠ ${unresolved.length} crate(s) declare no SPDX license (left unknown in the SBOM):`);
  for (const u of [...new Set(unresolved)].sort()) console.warn(`    ${u}`);
}
