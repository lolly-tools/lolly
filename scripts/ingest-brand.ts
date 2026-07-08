#!/usr/bin/env node
/**
 * Brand pack hydrator — turns a design-tokens export into a `brands/<name>`
 * pack, ready to register as a profile (see profiles.json / use-profile.ts).
 *
 * Run as:
 *   npm run ingest:brand -- <source> --name <brand> [--label "Label"]
 *   node scripts/ingest-brand.ts <source> --name <brand> [--label "Label"]
 *        [--out brands/<brand>] [--register] [--activate] [--force]
 *
 * <source> is any of the three containers Penpot/Tokens Studio export the
 * same token document in (engine/src/brand-import.ts owns the reassembly):
 *
 *   tokens.json         monolithic Tokens-Studio or plain-DTCG document
 *   a directory         one-file-per-set export ($metadata.json/$themes.json
 *                       + '<set>.json'; nested dirs = '/' in set names)
 *   project.penpot      a Penpot project archive (zip; tokens per file)
 *
 * The emitted pack mirrors brands/lolly-start/catalog: the extracted document
 * lands verbatim at catalog/assets/<name>/tokens/brand.json, indexed as the
 * pack's single core-tier `tokens` asset (the web shell's token bridge
 * discovers the first `type:"tokens"` asset generically, so the colour picker
 * lights up with the brand's palette as soon as the profile is active).
 * catalog/tools/index.json is NOT written here — `npm run build:catalog`
 * generates it once the profile is active.
 *
 * --register  upserts profiles.json: profiles[<name>] = community tools (+ the
 *             pack's own tools/ root if one exists) + this catalog. Never
 *             touches the "default" key; re-running updates the entry in place.
 * --activate  implies --register, then chains use-profile.ts <name> →
 *             build:catalog → validate:catalog, propagating the first failure.
 */

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';
import {
  assembleTokenSetFiles, coerceTokensDoc, extractPenpotProject, summarizeTokensDoc,
} from '../engine/src/brand-import.ts';
import type { TokensExtraction } from '../engine/src/brand-import.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const USAGE = `Usage:
  node scripts/ingest-brand.ts <source> --name <brand> [--label "Label"] [--out brands/<brand>] [--register] [--activate] [--force]

  <source>      a monolithic tokens .json (Tokens Studio or plain DTCG),
                a DIRECTORY of per-set token files ($metadata.json/$themes.json + <set>.json),
                or a .penpot project file (zip)
  --name        brand id — lowercase [a-z0-9-]. The asset-id namespace is the name
                with hyphens stripped (asset ids forbid '-' in the first segment:
                'lolly-start' → 'lolly...' would be illegal, so 'lollystart/tokens/brand')
  --label       human label (default: capitalised name)
  --out         pack directory, inside the repo (default: brands/<name>)
  --register    upsert the profile into profiles.json (never touches "default")
  --activate    implies --register, then: use-profile <name> && build:catalog && validate:catalog
  --force       write into an existing non-empty --out`;

/** Human name for each container shape, for console + README provenance. */
const CONTAINER_LABEL: Record<TokensExtraction['source'], string> = {
  'dtcg': 'monolithic DTCG tokens file',
  'tokens-studio': 'monolithic Tokens Studio export',
  'token-set-files': 'one-file-per-set token directory',
  'penpot-project': 'Penpot project archive (.penpot)',
};

interface Args {
  source: string; name: string; label: string; out: string;
  /** Asset-id namespace: `name` with hyphens stripped — asset.schema.json's id
   * pattern (`^[a-z0-9]+(/…)+$`) forbids '-' in the first segment. */
  ns: string;
  register: boolean; activate: boolean; force: boolean;
}

function parseArgs(argv: string[]): Args {
  if (!argv.length || argv.includes('--help') || argv.includes('-h')) {
    console.log(USAGE);
    process.exit(argv.length ? 0 : 1);
  }
  const flags: Record<string, string | boolean> = {};
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (!a.startsWith('--')) { positional.push(a); continue; }
    const eq = a.indexOf('=');
    const key = eq === -1 ? a.slice(2) : a.slice(2, eq);
    if (['register', 'activate', 'force'].includes(key)) { flags[key] = true; continue; }
    if (!['name', 'label', 'out'].includes(key)) fail(`unknown flag --${key}\n\n${USAGE}`);
    const value = eq === -1 ? argv[++i] : a.slice(eq + 1);
    if (value === undefined) fail(`--${key} needs a value`);
    flags[key] = value;
  }
  if (positional.length !== 1) fail(`expected exactly one <source>, got ${positional.length}\n\n${USAGE}`);
  const name = typeof flags.name === 'string' ? flags.name : fail('--name is required');
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) {
    fail(`--name "${name}" is invalid — lowercase [a-z0-9-], starting alphanumeric`);
  }

  // The pack must live INSIDE the repo: profiles.json paths are joined onto the
  // repo root by use-profile.ts (an absolute/outside path would register a
  // broken profile), and it must never be the repo root or the tools/ +
  // catalog/ SYMLINK VIEWS — writing "into" a view lands in whatever pack is
  // active (--force could clobber brands/suse's real assets/index.json).
  const rawOut = typeof flags.out === 'string' ? flags.out : join('brands', name);
  const outRel = relative(ROOT, resolve(ROOT, rawOut)).split(sep).join('/');
  if (outRel === '' || outRel.startsWith('..')) {
    fail(`--out ${rawOut} resolves outside the repo (or to the repo root) — packs must live inside it, e.g. brands/${name}`);
  }
  if (/^(catalog|tools)(\/|$)/.test(outRel)) {
    fail(`--out ${rawOut} points into the ${outRel.split('/')[0]}/ profile VIEW — write to a real pack dir instead, e.g. brands/${name}`);
  }

  return {
    source: positional[0]!,
    name,
    ns: name.replace(/-/g, ''),
    label: typeof flags.label === 'string' ? flags.label : name.charAt(0).toUpperCase() + name.slice(1),
    out: outRel,
    register: flags.register === true || flags.activate === true, // --activate implies --register
    activate: flags.activate === true,
    force: flags.force === true,
  };
}

function fail(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

/** Recursively collect parsed `*.json` under `dir`, keyed by POSIX rel path. */
function walkJsonFiles(dir: string, base: string, files: Record<string, unknown>, warnings: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) { walkJsonFiles(full, base, files, warnings); continue; }
    if (!entry.name.endsWith('.json')) continue; // README, .DS_Store, … — not set files
    const rel = relative(base, full).split(sep).join('/');
    try {
      files[rel] = JSON.parse(readFileSync(full, 'utf8'));
    } catch (e) {
      warnings.push(`${rel}: ${e instanceof Error ? e.message : 'unparseable JSON'} — skipped`);
    }
  }
}

const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04]; // PK\x03\x04 — local file header

/** Detect the container shape from the path/bytes and extract the token doc. */
function extract(source: string): TokensExtraction {
  const abs = resolve(source);
  if (!existsSync(abs)) fail(`source not found: ${abs}`);

  if (statSync(abs).isDirectory()) {
    const files: Record<string, unknown> = {};
    const ioWarnings: string[] = [];
    walkJsonFiles(abs, abs, files, ioWarnings);
    const ex = assembleTokenSetFiles(files);
    ex.warnings.unshift(...ioWarnings);
    return ex;
  }

  const bytes = readFileSync(abs);
  if (bytes.length >= 4 && ZIP_MAGIC.every((b, i) => bytes[i] === b)) {
    let entries: Record<string, Uint8Array>;
    try {
      // Only inflate the .json members — a .penpot carries images/media too.
      entries = unzipSync(new Uint8Array(bytes), { filter: (f) => f.name.endsWith('.json') });
    } catch (e) {
      return fail(`cannot unzip ${abs}: ${e instanceof Error ? e.message : e}`);
    }
    return extractPenpotProject(entries);
  }

  try {
    return coerceTokensDoc(JSON.parse(bytes.toString('utf8')));
  } catch (e) {
    return fail(`${abs} is neither a zip nor parseable JSON: ${e instanceof Error ? e.message : e}`);
  }
}

/** Write the pack skeleton, mirroring brands/lolly-start/catalog exactly. */
function emitPack(
  args: Args, doc: Record<string, unknown>, source: TokensExtraction['source'],
  summary: ReturnType<typeof summarizeTokensDoc>,
): void {
  const out = resolve(ROOT, args.out);
  if (existsSync(out)) {
    // A file here breaks every later mkdir/write with a raw ENOTDIR — refuse
    // it readably, and regardless of --force (force can't help a file).
    if (!statSync(out).isDirectory()) fail(`--out ${args.out} exists and is not a directory`);
    if (!args.force && readdirSync(out).length > 0) {
      fail(`--out ${args.out} exists and is not empty — pass --force to write into it anyway`);
    }
  }

  const tokensDir = join(out, 'catalog/assets', args.ns, 'tokens');
  mkdirSync(tokensDir, { recursive: true });
  // tools/ stays empty here — build:catalog generates its index.json later.
  for (const d of ['catalog/tools', 'catalog/previews', 'catalog/og/views', 'catalog/fonts']) {
    mkdirSync(join(out, d), { recursive: true });
  }
  for (const k of ['catalog/previews/.gitkeep', 'catalog/og/views/.gitkeep', 'catalog/fonts/.gitkeep']) {
    writeFileSync(join(out, k), '');
  }

  // The extracted document verbatim — this file IS the brand.
  const brandBytes = Buffer.from(JSON.stringify(doc, null, 2) + '\n');
  writeFileSync(join(tokensDir, 'brand.json'), brandBytes);

  // Same SRI form as scripts/checksum-assets.ts, so build:catalog is a no-op on it.
  const checksum = `sha256-${createHash('sha256').update(brandBytes).digest('base64')}`;
  const index = {
    version: '1',
    generatedAt: new Date().toISOString(),
    assets: [{
      id: `${args.ns}/tokens/brand`,
      name: `${args.label} Design Tokens`,
      type: 'tokens',
      version: '1.0.0',
      tier: 'core',
      tags: ['tokens', 'brand', 'dtcg'],
      formats: [{
        format: 'json',
        url: `/catalog/assets/${args.ns}/tokens/brand.json`,
        checksum,
        size: brandBytes.length,
      }],
    }],
  };
  writeFileSync(join(out, 'catalog/assets/index.json'), JSON.stringify(index, null, 2) + '\n');

  const { sets, themes, tokenCount, colorCount } = summary;
  writeFileSync(join(out, 'README.md'), `# brands/${args.name} — ${args.label} brand pack

Hydrated by \`scripts/ingest-brand.ts\`. The token document at
\`catalog/assets/${args.ns}/tokens/brand.json\` is the extracted source
verbatim — re-run the ingest to refresh it, or hand-edit and bump the asset
version in \`catalog/assets/index.json\`.

## Provenance

- **Source:** \`${resolve(args.source)}\`
- **Container:** ${CONTAINER_LABEL[source]}
- **Ingested:** ${new Date().toISOString().slice(0, 10)}
- **Contents:** ${sets.length} sets · ${themes.length} themes · ${tokenCount} tokens (${colorCount} colors)

## Next steps

1. Register the profile (if you didn't pass \`--register\`): add
   \`profiles.json → profiles.${args.name}\` pointing \`catalog\` here.
2. Activate and build the generated tool index:
   \`node scripts/use-profile.ts ${args.name} && npm run build:catalog && npm run validate:catalog\`
   (\`--activate\` does all three).
3. Grow the pack: brand tools under \`${args.out}/tools/\` (append that path to
   the profile's \`tools\` roots), fonts under \`catalog/fonts/\`, previews via
   \`npm run previews\`.
`);

  console.log(`✓ brand pack written to ${args.out} (brand.json ${brandBytes.length} bytes, ${checksum})`);
}

interface ProfilesFile {
  default: string;
  profiles: Record<string, { label?: string; tools: string[]; catalog: string }>;
}

/** Guarded profiles.json read — a broken file must fail BEFORE the pack is
 * written (main() pre-flights this when --register is set), not crash with a
 * raw stack after, when a re-run would additionally need --force. */
function readProfilesFile(): ProfilesFile {
  const path = join(ROOT, 'profiles.json');
  let cfg: unknown;
  try {
    cfg = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    return fail(`profiles.json is missing or not valid JSON (${e instanceof Error ? e.message : e}) — fix it before --register`);
  }
  if (typeof cfg !== 'object' || cfg === null || typeof (cfg as ProfilesFile).profiles !== 'object' || (cfg as ProfilesFile).profiles === null) {
    return fail('profiles.json has no "profiles" object — fix it before --register');
  }
  return cfg as ProfilesFile;
}

/** Upsert profiles.json — never touches "default"; re-runs update in place. */
function registerProfile(args: Args): void {
  const cfg = readProfilesFile();
  const packTools = join(ROOT, args.out, 'tools'); // pack-owned tools root, sibling of catalog/
  cfg.profiles[args.name] = {
    label: args.label,
    tools: ['community', ...(existsSync(packTools) ? [`${args.out}/tools`] : [])],
    catalog: `${args.out}/catalog`,
  };
  writeFileSync(join(ROOT, 'profiles.json'), JSON.stringify(cfg, null, 2) + '\n');
  console.log(`✓ registered profile "${args.name}" in profiles.json (default stays "${cfg.default}")`);
}

/** use-profile <name> → build:catalog → validate:catalog; first failure wins. */
function activateProfile(name: string): void {
  const steps: [string, string[]][] = [
    [process.execPath, [join(ROOT, 'scripts/use-profile.ts'), name]],
    ['npm', ['run', 'build:catalog']],
    ['npm', ['run', 'validate:catalog']],
  ];
  for (const [cmd, cmdArgs] of steps) {
    const r = spawnSync(cmd, cmdArgs, { stdio: 'inherit', cwd: ROOT });
    if (r.status !== 0) {
      console.error(`✗ ${cmd} ${cmdArgs.join(' ')} failed (exit ${r.status ?? 'signal'})`);
      process.exit(r.status ?? 1);
    }
  }
  console.log(`✓ profile "${name}" active — catalog built and validated`);
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  if (args.register) readProfilesFile(); // pre-flight: fail before the pack is written
  const extraction = extract(args.source);

  // Extraction never throws — problems land here, and they matter: a partially
  // merged doc can silently miss whole sets, so show every warning up front.
  for (const w of extraction.warnings) console.warn(`⚠ ${w}`);

  if (!extraction.doc) {
    fail(`no usable token document in ${args.source} — see warnings above`);
  }
  const summary = summarizeTokensDoc(extraction.doc);
  if (summary.colorCount === 0) {
    fail(`extracted ${summary.tokenCount} tokens but ZERO resolvable colors — a brand pack without colors is almost certainly the wrong source (${CONTAINER_LABEL[extraction.source]}: ${args.source})`);
  }
  console.log(
    `✓ extracted ${CONTAINER_LABEL[extraction.source]}: ` +
    `${summary.sets.length} sets · ${summary.themes.length} themes · ` +
    `${summary.tokenCount} tokens (${summary.colorCount} colors)`,
  );

  emitPack(args, extraction.doc, extraction.source, summary);
  if (args.register) registerProfile(args);
  if (args.activate) activateProfile(args.name);
}

main();
