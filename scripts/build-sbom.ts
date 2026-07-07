#!/usr/bin/env node
/**
 * Software Bill of Materials (SBOM) generator.
 *
 * Run as: npm run build:sbom  (or directly: node scripts/build-sbom.ts)
 *
 * Emits a CycloneDX 1.5 SBOM at `sbom.cdx.json` describing every third-party npm
 * package in the workspace dependency graph, plus the vendored browser libraries
 * (d3, topojson-client), the SUSE OFL fonts, and — when present — the Tauri shells'
 * own npm installs and their Rust crate graph (Cargo.lock). This is the
 * supply-chain-transparency
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
 *   - Beyond the root lockfile, optional passes fold in components that npm's graph
 *     can't see: vendored `.min.js` bundles (hashed from disk), the OFL fonts, the
 *     Tauri shells' sibling lockfiles, and Cargo.lock crates (pkg:cargo, license
 *     `unknown` — Cargo.lock carries none). Every pass is existence-guarded, so the
 *     generator still runs end-to-end on a checkout that has only the web/CLI shells,
 *     and a component that still ends up with no license is warned about, never fatal.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ─── CycloneDX component shapes (partial — only the fields this tool emits) ───
interface Hash {
  alg: string;
  content: string;
}
interface LicenseChoice {
  license?: { id?: string; name?: string; url?: string };
  expression?: string;
}
interface Property {
  name: string;
  value: string;
}
interface ExternalReference {
  type: string;
  url: string;
}
interface Component {
  type: string;
  'bom-ref': string;
  name: string;
  version?: string;
  purl: string;
  licenses?: LicenseChoice[];
  hashes?: Hash[];
  externalReferences?: ExternalReference[];
  properties?: Property[];
  components?: Component[];
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LOCK_PATH = join(ROOT, 'package-lock.json');
const OUT_PATH = join(ROOT, 'sbom.cdx.json');

const rootPkg = readJson('package.json');
const lock = readJson('package-lock.json');

// ─── SRI integrity → CycloneDX hashes ───────────────────────────────────────
// Lockfile integrity is base64 SRI ("sha512-<base64>"); CycloneDX wants the
// digest hex-encoded with a canonical algorithm name.
const ALG_NAMES: Record<string, string> = { sha1: 'SHA-1', sha256: 'SHA-256', sha384: 'SHA-384', sha512: 'SHA-512' };

function hashesFromIntegrity(integrity: string): Hash[] | undefined {
  if (!integrity) return undefined;
  const hashes: Hash[] = [];
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
function licensesFromString(license: unknown): LicenseChoice[] | undefined {
  if (!license || typeof license !== 'string') return undefined;
  const looksLikeExpression = /\bOR\b|\bAND\b|\bWITH\b|[()]/.test(license);
  if (looksLikeExpression) return [{ expression: license }];
  // SPDX ids are a constrained charset; fall back to `name` for anything odd.
  const isIdLike = /^[A-Za-z0-9.+-]+$/.test(license);
  return [{ license: isIdLike ? { id: license } : { name: license } }];
}

// purl for an npm package; scope's leading '@' is percent-encoded per the spec.
function purlFor(name: string, version: string): string {
  return `pkg:npm/${name.replace(/^@/, '%40')}@${version}`;
}

// ─── Collect external components from the lockfile ───────────────────────────
const byPurl = new Map<string, Component>(); // purl → component (dedupes hoisted/nested duplicates)

for (const [path, entry] of Object.entries(lock.packages ?? {}) as [string, any][]) {
  if (!path.includes('node_modules/')) continue; // root + workspace package dirs
  if (entry.link) continue;                       // workspace symlink, not a 3rd party
  if (!entry.version) continue;                   // nothing installable to describe

  const name = path.slice(path.lastIndexOf('node_modules/') + 'node_modules/'.length);
  const purl = purlFor(name, entry.version);
  if (byPurl.has(purl)) continue;

  const component: Component = {
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

// ─── Vendored libraries (checked into the tree, not via npm install) ─────────
// d3 / topojson-client ship as pre-minified bundles under tools/*/lib and never
// appear in the lockfile. We pin the version read from each file's banner-comment
// provenance, the license from the project's license audit (both ISC), and hash
// the bytes on disk ourselves so the component is still independently verifiable.
const VENDORED_LIBS = [
  {
    name: 'd3',
    version: '7.9.0',
    license: 'ISC',
    files: ['tools/meeting-planner/lib/d3.min.js', 'tools/street-map/lib/d3.min.js'],
  },
  {
    name: 'topojson-client',
    version: '3.1.0',
    license: 'ISC',
    files: ['tools/meeting-planner/lib/topojson.min.js'],
  },
];
for (const lib of VENDORED_LIBS) {
  const file = lib.files.find((f) => existsSync(join(ROOT, f)));
  if (!file) continue; // none of the candidate copies are present — skip
  const purl = purlFor(lib.name, lib.version);
  if (byPurl.has(purl)) continue;
  const component: Component = {
    type: 'library',
    'bom-ref': purl,
    name: lib.name,
    version: lib.version,
    purl,
  };
  const licenses = licensesFromString(lib.license);
  if (licenses) component.licenses = licenses;
  const hashes = fileHashes(join(ROOT, file));
  if (hashes) component.hashes = hashes;
  component.properties = [{ name: 'lolly:vendored', value: file }];
  byPurl.set(purl, component);
}

// ─── SUSE brand fonts (OFL-1.1, under catalog/fonts) ─────────────────────────
// Shipped as binary font files, not an npm package; one component stands in for
// the whole family. License is OFL-1.1 (see catalog/fonts/OFL.txt).
if (existsSync(join(ROOT, 'catalog/fonts'))) {
  const purl = 'pkg:generic/suse-fonts';
  if (!byPurl.has(purl)) {
    byPurl.set(purl, {
      type: 'library',
      'bom-ref': purl,
      name: 'SUSE / SUSE Mono fonts',
      purl,
      licenses: licensesFromString('OFL-1.1'),
      properties: [{ name: 'lolly:vendored', value: 'catalog/fonts' }],
    });
  }
}

// ─── Tauri shells: separate npm installs with their own lockfiles ────────────
addNpmShellDeps('shells/tauri-desktop');
addNpmShellDeps('shells/tauri-mobile');

// ─── Tauri shells: Rust crate graph (Cargo.lock) ─────────────────────────────
addCargoCrates('shells/tauri-desktop/src-tauri/Cargo.lock');
addCargoCrates('shells/tauri-mobile/src-tauri/Cargo.lock');

const components = [...byPurl.values()].sort((a, b) => a.purl.localeCompare(b.purl));

// ─── Describe the thing the SBOM is *for* (the workspace itself) ─────────────
const subjectVersion = rootPkg.version ?? '0.0.0';
const subjectPurl = purlFor(rootPkg.name ?? 'lolly', subjectVersion);
const workspaceSubcomponents = ((rootPkg.workspaces ?? []) as any[])
  .map((ws) => {
    const pkg = readJsonOptional(join(ws, 'package.json'));
    if (!pkg?.name) return null;
    const v = pkg.version ?? subjectVersion;
    const purl = purlFor(pkg.name, v);
    const component: Component = { type: 'library', 'bom-ref': purl, name: pkg.name, version: v, purl };
    const licenses = licensesFromPackage(pkg);
    if (licenses) component.licenses = licenses;
    return component;
  })
  .filter((c): c is Component => Boolean(c));

const subjectLicenses = licensesFromPackage(rootPkg);
const subject: Component = {
  type: 'application',
  'bom-ref': subjectPurl,
  name: rootPkg.name ?? 'lolly',
  version: subjectVersion,
  purl: subjectPurl,
  ...(subjectLicenses ? { licenses: subjectLicenses } : {}),
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

// ─── Surface license gaps without failing the build ──────────────────────────
// A component (including the subject itself and the workspace subcomponents)
// with an empty licenses[] is a real audit gap — something we couldn't attribute.
// List them so they're visible; never throw or exit non-zero over it.
const unlicensed = [subject, ...workspaceSubcomponents, ...components].filter(
  (c) => !Array.isArray(c.licenses) || c.licenses.length === 0,
);
if (unlicensed.length) {
  console.warn(`⚠ ${unlicensed.length} component(s) without license metadata:`);
  for (const c of unlicensed) console.warn(`    ${c.purl || c['bom-ref'] || c.name}`);
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function readJson(rel: string): any {
  return JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
}
function readJsonOptional(rel: string): any {
  const p = join(ROOT, rel);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

// Hash a file on disk into CycloneDX hash entries — used for vendored bundles
// that never pass through npm and so have no lockfile integrity to reuse.
function fileHashes(absPath: string, algs: string[] = ['sha512']): Hash[] | undefined {
  if (!existsSync(absPath)) return undefined;
  let bytes: Buffer;
  try {
    bytes = readFileSync(absPath);
  } catch {
    return undefined;
  }
  // algs values are our own literal keys of ALG_NAMES, so the lookup is total.
  return algs.map((alg) => ({ alg: ALG_NAMES[alg]!, content: createHash(alg).update(bytes).digest('hex') }));
}

// Normalize any package.json license shape into CycloneDX licenses[]. Handles
// the modern `license: "MIT"` string plus the legacy `license: { type, url }`
// object and `licenses: [{ type, url }]` array forms (npm still ships both).
function licensesFromPackage(pkg: any): LicenseChoice[] | undefined {
  if (!pkg) return undefined;
  if (typeof pkg.license === 'string') return licensesFromString(pkg.license);
  if (pkg.license && typeof pkg.license === 'object' && !Array.isArray(pkg.license)) {
    return licensesFromLegacy([pkg.license]);
  }
  if (Array.isArray(pkg.licenses)) return licensesFromLegacy(pkg.licenses);
  return undefined;
}

// Legacy `{ type, url }` license entries → SPDX where the `type` is a clean id;
// multiple entries collapse to an SPDX "OR" expression (npm's documented meaning
// of the array form). We keep the bare url when a `type` can't map to an id.
function licensesFromLegacy(list: any[]): LicenseChoice[] | undefined {
  const out: LicenseChoice[] = [];
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue;
    const type = typeof entry.type === 'string' ? entry.type.trim() : '';
    const url = typeof entry.url === 'string' ? entry.url.trim() : '';
    const mapped = type ? licensesFromString(type)?.[0] : undefined;
    if (mapped) {
      if (url && mapped.license) mapped.license.url = url;
      out.push(mapped);
    } else if (url) {
      out.push({ license: { url } });
    }
  }
  const ids = out.map((l) => l.license?.id).filter(Boolean);
  if (out.length > 1 && ids.length === out.length) return [{ expression: ids.join(' OR ') }];
  return out.length ? out : undefined;
}

// A Tauri shell is a separate npm install with its own package.json + lockfile.
// Pull its declared deps in, resolving exact versions from the sibling lockfile
// when present (else fall back to the declared range, flagged as such). All
// existence-guarded: a missing shell or lockfile just contributes nothing.
function addNpmShellDeps(shellDir: string): void {
  const pkg = readJsonOptional(join(shellDir, 'package.json'));
  if (!pkg) return;
  const shellLock = readJsonOptional(join(shellDir, 'package-lock.json'));
  const dev = new Set(Object.keys(pkg.devDependencies ?? {}));
  const declared = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  for (const [name, range] of Object.entries(declared) as [string, any][]) {
    const locked = shellLock?.packages?.[`node_modules/${name}`];
    const resolvedVersion = locked?.version;
    const version = resolvedVersion ?? String(range);
    const purl = purlFor(name, version);
    if (byPurl.has(purl)) continue;
    const component: Component = {
      type: 'library',
      'bom-ref': purl,
      name,
      version,
      purl,
    };
    const licenses = licensesFromString(locked?.license);
    if (licenses) component.licenses = licenses;
    const hashes = hashesFromIntegrity(locked?.integrity);
    if (hashes) component.hashes = hashes;
    if (locked?.resolved) {
      component.externalReferences = [{ type: 'distribution', url: locked.resolved }];
    }
    const properties: Property[] = [];
    if (!resolvedVersion) properties.push({ name: 'cdx:npm:package:version-source', value: 'declared-range' });
    if (dev.has(name)) properties.push({ name: 'cdx:npm:package:development', value: 'true' });
    if (properties.length) component.properties = properties;
    byPurl.set(purl, component);
  }
}

// Parse a Cargo.lock (TOML) for its [[package]] name/version/checksum triples and
// add them as pkg:cargo components. Cargo.lock records no license data, so we mark
// the license `unknown` rather than fabricate one. Absent file → skip silently.
function addCargoCrates(rel: string): void {
  const abs = join(ROOT, rel);
  if (!existsSync(abs)) return;
  let text: string;
  try {
    text = readFileSync(abs, 'utf8');
  } catch {
    return;
  }
  let name: string | null = null;
  let version: string | null = null;
  let checksum: string | null = null;
  const flush = () => {
    if (name && version) {
      const purl = `pkg:cargo/${name}@${version}`;
      if (!byPurl.has(purl)) {
        const component: Component = {
          type: 'library',
          'bom-ref': purl,
          name,
          version,
          purl,
          licenses: [{ license: { name: 'unknown' } }],
        };
        // Cargo.lock checksums are the hex SHA-256 of the published .crate tarball.
        if (checksum) component.hashes = [{ alg: ALG_NAMES.sha256!, content: checksum }];
        component.properties = [{ name: 'lolly:source', value: rel }];
        byPurl.set(purl, component);
      }
    }
    name = version = checksum = null;
  };
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line === '[[package]]') {
      flush();
      continue;
    }
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^name = "(.+)"$/))) name = m[1]!;
    else if ((m = line.match(/^version = "(.+)"$/))) version = m[1]!;
    else if ((m = line.match(/^checksum = "(.+)"$/))) checksum = m[1]!;
  }
  flush();
}
