#!/usr/bin/env node
/**
 * Software Bill of Materials (SBOM) generator.
 *
 * Run as: npm run build:sbom  (or directly: node scripts/build-sbom.js)
 *
 * Emits a CycloneDX 1.5 SBOM at `sbom.cdx.json` describing every third-party npm
 * package in the workspace dependency graph. This is the supply-chain-transparency
 * half of the sovereignty story (see SOVEREIGNTY.md): it lets anyone audit exactly
 * what code the build pulls in, with a verifiable SRI hash per component, without
 * trusting our word for it.
 *
 * Design notes:
 *   - Self-contained on purpose. Generating an SBOM with a heavyweight external
 *     tool would itself add an opaque dependency — the opposite of the point. We
 *     read the npm lockfile (the install's own source of truth) and nothing else.
 *     No network, no new dependency.
 *   - Source of truth is the root `package-lock.json` (lockfileVersion 3). Its
 *     per-package `integrity` (SRI) and `license` fields become CycloneDX hashes
 *     and licenses verbatim — we don't re-derive them, so the SBOM can't disagree
 *     with what npm actually installed.
 *   - Output is DETERMINISTIC: components sorted by purl, the serialNumber derived
 *     from a content hash, and the timestamp held stable while the dependency set
 *     is unchanged. So `git diff` on sbom.cdx.json is empty unless dependencies
 *     actually moved — which makes a committed-but-stale SBOM a visible CI signal
 *     (run this, commit nothing → drift), the same guard build:catalog relies on.
 *   - dev-only packages are tagged `cdx:npm:package:development=true` (matching the
 *     cyclonedx-npm convention) rather than dropped, so the SBOM is complete and a
 *     consumer can filter to "what actually runs on a user's device" themselves.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LOCK_PATH = join(ROOT, 'package-lock.json');
const OUT_PATH = join(ROOT, 'sbom.cdx.json');

const rootPkg = readJson('package.json');
const lock = readJson('package-lock.json');

// ─── SRI integrity → CycloneDX hashes ───────────────────────────────────────
// Lockfile integrity is base64 SRI ("sha512-<base64>"); CycloneDX wants the
// digest hex-encoded with a canonical algorithm name.
const ALG_NAMES = { sha1: 'SHA-1', sha256: 'SHA-256', sha384: 'SHA-384', sha512: 'SHA-512' };

function hashesFromIntegrity(integrity) {
  if (!integrity) return undefined;
  const hashes = [];
  for (const token of integrity.trim().split(/\s+/)) {
    const dash = token.indexOf('-');
    if (dash === -1) continue;
    const alg = ALG_NAMES[token.slice(0, dash)];
    if (!alg) continue;
    const content = Buffer.from(token.slice(dash + 1), 'base64').toString('hex');
    if (content) hashes.push({ alg, content });
  }
  return hashes.length ? hashes : undefined;
}

// ─── License string → CycloneDX licenses[] entry ────────────────────────────
// A bare token ("MIT") is an SPDX id; anything with boolean operators or parens
// is an expression and must go in `expression`, not wrapped in `license`.
function licensesFromString(license) {
  if (!license || typeof license !== 'string') return undefined;
  const looksLikeExpression = /\bOR\b|\bAND\b|\bWITH\b|[()]/.test(license);
  if (looksLikeExpression) return [{ expression: license }];
  // SPDX ids are a constrained charset; fall back to `name` for anything odd.
  const isIdLike = /^[A-Za-z0-9.+-]+$/.test(license);
  return [{ license: isIdLike ? { id: license } : { name: license } }];
}

// purl for an npm package; scope's leading '@' is percent-encoded per the spec.
function purlFor(name, version) {
  return `pkg:npm/${name.replace(/^@/, '%40')}@${version}`;
}

// ─── Collect external components from the lockfile ───────────────────────────
const byPurl = new Map(); // purl → component (dedupes hoisted/nested duplicates)

for (const [path, entry] of Object.entries(lock.packages ?? {})) {
  if (!path.includes('node_modules/')) continue; // root + workspace package dirs
  if (entry.link) continue;                       // workspace symlink, not a 3rd party
  if (!entry.version) continue;                   // nothing installable to describe

  const name = path.slice(path.lastIndexOf('node_modules/') + 'node_modules/'.length);
  const purl = purlFor(name, entry.version);
  if (byPurl.has(purl)) continue;

  const component = {
    type: 'library',
    'bom-ref': purl,
    name,
    version: entry.version,
    purl,
  };
  const licenses = licensesFromString(entry.license);
  if (licenses) component.licenses = licenses;
  const hashes = hashesFromIntegrity(entry.integrity);
  if (hashes) component.hashes = hashes;
  if (entry.resolved) {
    component.externalReferences = [{ type: 'distribution', url: entry.resolved }];
  }
  if (entry.dev) {
    component.properties = [{ name: 'cdx:npm:package:development', value: 'true' }];
  }
  byPurl.set(purl, component);
}

const components = [...byPurl.values()].sort((a, b) => a.purl.localeCompare(b.purl));

// ─── Describe the thing the SBOM is *for* (the workspace itself) ─────────────
const subjectVersion = rootPkg.version ?? '0.0.0';
const subjectPurl = purlFor(rootPkg.name ?? 'lolly', subjectVersion);
const workspaceSubcomponents = (rootPkg.workspaces ?? [])
  .map((ws) => {
    const pkg = readJsonOptional(join(ws, 'package.json'));
    if (!pkg?.name) return null;
    const v = pkg.version ?? subjectVersion;
    return { type: 'library', 'bom-ref': purlFor(pkg.name, v), name: pkg.name, version: v, purl: purlFor(pkg.name, v) };
  })
  .filter(Boolean);

const subject = {
  type: 'application',
  'bom-ref': subjectPurl,
  name: rootPkg.name ?? 'lolly',
  version: subjectVersion,
  purl: subjectPurl,
  ...(workspaceSubcomponents.length ? { components: workspaceSubcomponents } : {}),
};

// ─── Deterministic identity (no git churn) ──────────────────────────────────
// serialNumber is a content hash shaped as a UUID; timestamp is reused from the
// existing SBOM whenever the component set is identical.
const fingerprint = createHash('sha256')
  .update(JSON.stringify(components.map((c) => [c.purl, c.hashes])))
  .digest('hex');
const serialNumber = `urn:uuid:${fingerprint.slice(0, 8)}-${fingerprint.slice(8, 12)}-4${fingerprint.slice(13, 16)}-8${fingerprint.slice(17, 20)}-${fingerprint.slice(20, 32)}`;

const previous = existsSync(OUT_PATH) ? readJsonOptional('sbom.cdx.json') : null;
const sameComponents = previous && JSON.stringify(previous.components) === JSON.stringify(components);
const timestamp = sameComponents && previous?.metadata?.timestamp
  ? previous.metadata.timestamp
  : new Date().toISOString();

const bom = {
  bomFormat: 'CycloneDX',
  specVersion: '1.5',
  serialNumber,
  version: 1,
  metadata: {
    timestamp,
    tools: [{ vendor: 'lolly', name: 'build-sbom', version: subjectVersion }],
    component: subject,
  },
  components,
};

writeFileSync(OUT_PATH, JSON.stringify(bom, null, 2) + '\n');
const devCount = components.filter((c) => c.properties?.some((p) => p.value === 'true')).length;
console.log(
  `✓ Wrote sbom.cdx.json — ${components.length} components ` +
  `(${components.length - devCount} runtime, ${devCount} dev)${sameComponents ? ' (unchanged)' : ''}`,
);

// ─── Helpers ────────────────────────────────────────────────────────────────
function readJson(rel) {
  return JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
}
function readJsonOptional(rel) {
  const p = join(ROOT, rel);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}
