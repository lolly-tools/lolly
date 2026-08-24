#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Instance-pack builder (plans/131 WP-D) - cuts a distributable `.lolly` brand
 * pack from a mounted brand: one file carrying everything a fresh install needs
 * to wear the brand and run its tools, hosted wherever the brand chooses (for
 * SUSE: an internal file store, while id.suse.com is pending).
 *
 * Run as:
 *   node scripts/build-instance-pack.ts                       # brands/suse (default)
 *   node scripts/build-instance-pack.ts --brand <name>        # brands/<name>
 *   node scripts/build-instance-pack.ts --out <dir>           # default dist-packs/
 *   node scripts/build-instance-pack.ts --keyfile <path>      # sign (PKCS8 PEM or JWK)
 *                                                             # or LOLLY_CATALOG_SIGNING_KEY
 *
 * The output is the web shell's own `lolly-brand` bundle (brand-transfer.ts) -
 * tokens.json + fonts/* + logos/* land through the EXISTING importer - extended
 * with the additive instance-pack parts (formatVersion 3, minReader still 1):
 *
 *   instance.json    kind/name/publisher/version + the instance base for
 *                    community content (community tools are NOT in the pack)
 *   tools.json       the brand tools' catalog index entries + per-tool file lists
 *   tools/<id>/**    the tool files themselves (manifest, template, hooks, i18n)
 *   catalog.json     the included catalog-asset index entries (checksums intact)
 *   catalog/**       those assets' bytes, at their canonical /catalog/ paths
 *   pack.sig         ECDSA P-256/SHA-256 over the exact manifest.json bytes -
 *                    manifest.integrity covers every part, so one signature
 *                    vouches for the whole pack. Absent when unsigned (dev).
 *
 * What may leave the building is the BRAND's decision: brands/<name>/pack.json
 * declares include/exclude asset families (id prefixes), and every id in the
 * brand's asset index must match exactly one list - an unclassified family
 * fails the build rather than being guessed at. Two guards are not delegated to
 * that recipe: AUDIO in an included family is refused outright (the PremiumBeat
 * licence rule is absolute), and the pack refuses to grow past PACK_BUDGET
 * (a pack is a bootstrap, not a media library).
 */

import { createHash, webcrypto } from 'node:crypto';
import type { webcrypto as wc } from 'node:crypto';
import {
  existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipSync, strToU8 } from 'fflate';

import { CATALOG_SIG_ALG, jwkThumbprint } from '../engine/src/catalog-integrity.ts';
import { pemToDer } from '../engine/src/x509.ts';
import { ENGINE_VERSION } from '../engine/src/version.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const subtle = webcrypto.subtle;

/** Keep in sync with shells/web/src/brand-transfer.ts (a drift test pins all
 *  three: tests/instance-pack.test.ts). formatVersion 3 = the instance-pack
 *  parts; minReader stays 1 - the parts are additive, an older reader loads
 *  the brand and counts the pack parts as skipped. */
const BRAND_FORMAT = 'lolly-brand';
const BRAND_FORMAT_VERSION = 3;
const BRAND_READER_VERSION = 1;

/** Refuse to cut a pack bigger than this (bytes, zipped). A pack is fonts +
 *  tokens + tools + light brand art - if it grows past this something heavy
 *  (photos? audio?) slipped an include list. */
const PACK_BUDGET = 64 * 1024 * 1024;

/** Audio never ships in a pack, whatever the include lists say. */
const AUDIO_EXT = /\.(mp3|m4a|aac|opus|ogg|oga|wav|flac|aiff?)$/i;

const BUNDLE_HEADER = '📐 Lolly  •  ❤️ Give Fitzy an Ovation  •  🌏 https://lolly.tools';

/** woff2/raster bytes are already compressed - store, don't re-deflate. */
const STORED_EXT = /\.(woff2?|png|webp|jpe?g|avif)$/i;

const WEIGHT_NAMES: Record<string, number> = {
  Thin: 100, ExtraLight: 200, Light: 300, Regular: 400, Medium: 500,
  SemiBold: 600, Bold: 700, ExtraBold: 800, Black: 900,
};

interface PackRecipe {
  name: string;
  publisher: string;
  version: string;
  instance?: string;
  tokensAsset: string;
  fonts: { dir: string; families: string[]; license?: string };
  logos: Record<string, string>;
  includeAssetFamilies: string[];
  excludeAssetFamilies: string[];
}

interface AssetFormat { format: string; url: string; checksum?: string; size?: number }
interface AssetEntry { id: string; type?: string; formats?: AssetFormat[]; [k: string]: unknown }
interface FontRow {
  id: string; format: string; version?: string;
  meta: Record<string, unknown>; file: string; mime: string;
}

function parseArgs(argv: string[]) {
  const args = { brand: 'suse', out: join(ROOT, 'dist-packs'), keyfile: null as string | null };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const next = () => {
      const v = argv[++i];
      if (!v) throw new Error(`${flag} needs a value`);
      return v;
    };
    if (flag === '--brand') args.brand = next();
    else if (flag === '--out') args.out = resolve(next());
    else if (flag === '--keyfile') args.keyfile = resolve(next());
    else throw new Error(`unknown flag ${flag}`);
  }
  return args;
}

function walkFiles(dir: string, base = dir, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith('.') || entry === 'node_modules') continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walkFiles(p, base, out);
    else out.push(relative(base, p));
  }
  return out;
}

const sriSha256 = (bytes: Uint8Array): string =>
  'sha256-' + createHash('sha256').update(bytes).digest('base64');

/** Font style/weight from a static webfont filename (`SUSE-BoldItalic.woff2`).
 *  Null for anything unparsable - including `[wght]` variable files, which the
 *  user-font registry has no weight-range story for yet. */
function parseFontFile(name: string, family: string): { weight: number; style: 'normal' | 'italic' } | null {
  if (name.includes('[')) return null;
  const m = name.match(/^(.+?)-(.+)\.(woff2?|ttf|otf)$/);
  if (!m || m[1] !== family.replace(/\s+/g, '')) return null;
  const face = m[2]!;
  const italic = face.endsWith('Italic');
  const weightName = face === 'Italic' ? 'Regular' : face.replace(/Italic$/, '');
  const weight = WEIGHT_NAMES[weightName];
  return weight ? { weight, style: italic ? 'italic' : 'normal' } : null;
}

async function loadSigningKey(keyfile: string | null): Promise<{ key: wc.CryptoKey; thumbprint: string } | null> {
  const material = keyfile ? readFileSync(keyfile, 'utf8') : process.env.LOLLY_CATALOG_SIGNING_KEY;
  if (!material) return null;
  const EC = { name: 'ECDSA', namedCurve: 'P-256' } as const;
  let key: wc.CryptoKey;
  if (material.trimStart().startsWith('{')) {
    key = await subtle.importKey('jwk', JSON.parse(material), EC, true, ['sign']);
  } else {
    key = await subtle.importKey('pkcs8', pemToDer(material) as unknown as NodeJS.BufferSource, EC, true, ['sign']);
  }
  // The public half, for the printed thumbprint the deployment pins against.
  const jwk = await subtle.exportKey('jwk', key);
  const { d: _d, key_ops: _ops, ...pub } = jwk as JsonWebKey & { d?: string; key_ops?: string[] };
  return { key, thumbprint: await jwkThumbprint({ ...pub, key_ops: ['verify'] } as JsonWebKey) };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const brandDir = join(ROOT, 'brands', args.brand);
  const recipePath = join(brandDir, 'pack.json');
  if (!existsSync(recipePath)) {
    throw new Error(`no pack recipe at brands/${args.brand}/pack.json - the brand declares what leaves the building`);
  }
  const recipe: PackRecipe = JSON.parse(readFileSync(recipePath, 'utf8'));
  const catalogDir = join(brandDir, 'catalog');
  const toolsDir = join(brandDir, 'tools');

  const entries: Record<string, Uint8Array | [Uint8Array, { level: 0 }]> = {};
  const put = (path: string, bytes: Uint8Array): void => {
    entries[path] = STORED_EXT.test(path) ? [bytes, { level: 0 }] : bytes;
  };

  // ── tokens ────────────────────────────────────────────────────────────────
  const assetIndex: { assets: AssetEntry[] } = JSON.parse(
    readFileSync(join(catalogDir, 'assets/index.json'), 'utf8'),
  );
  const tokensEntry = assetIndex.assets.find(a => a.id === recipe.tokensAsset);
  const tokensUrl = tokensEntry?.formats?.[0]?.url;
  if (!tokensUrl) throw new Error(`tokens asset "${recipe.tokensAsset}" not found in the brand asset index`);
  const tokensBytes = readFileSync(join(catalogDir, tokensUrl.replace(/^\/catalog\//, '')));
  put('tokens.json', new Uint8Array(tokensBytes));

  // ── fonts (brand-transfer FontRow shape → the existing importer) ──────────
  const fontRows: FontRow[] = [];
  const fontDir = join(brandDir, recipe.fonts.dir);
  const fontFiles = readdirSync(fontDir).sort().filter(f => /\.(woff2?|ttf|otf)$/i.test(f));
  let unparsedFonts = fontFiles.length;
  for (const family of recipe.fonts.families) {
    let fontIdx = 0;
    for (const file of fontFiles) {
      const parsed = parseFontFile(file, family);
      if (!parsed) continue;
      unparsedFonts--;
      const zipPath = `fonts/${file.toLowerCase()}`;
      put(zipPath, new Uint8Array(readFileSync(join(fontDir, file))));
      fontRows.push({
        id: `user/fonts/${family.toLowerCase().replace(/\s+/g, '-')}/${fontIdx++}`,
        format: 'woff2',
        version: recipe.version,
        meta: {
          name: `${family}${parsed.weight !== 400 ? ` ${parsed.weight}` : ''}${parsed.style === 'italic' ? ' italic' : ''}`,
          family,
          style: parsed.style,
          weight: String(parsed.weight),
          source: 'brand-pack',
          tags: ['font'],
        },
        file: zipPath,
        mime: 'font/woff2',
      });
    }
    if (!fontIdx) throw new Error(`no static faces parsed for "${family}" in ${recipe.fonts.dir} - the fonts are a MUST`);
  }
  entries['fonts.json'] = strToU8(JSON.stringify(fontRows, null, 2));
  if (recipe.fonts.license && existsSync(join(brandDir, recipe.fonts.license))) {
    entries['fonts/LICENSE.txt'] = new Uint8Array(readFileSync(join(brandDir, recipe.fonts.license)));
  }

  // ── logos (canonical variant slots → the existing importer) ───────────────
  const logoRows: Array<FontRow & { type?: string }> = [];
  for (const [variant, rel] of Object.entries(recipe.logos)) {
    const src = join(brandDir, rel);
    const ext = rel.slice(rel.lastIndexOf('.') + 1).toLowerCase();
    const zipPath = `logos/${variant}.${ext}`;
    put(zipPath, new Uint8Array(readFileSync(src)));
    logoRows.push({
      id: `user/logo/${variant}`,
      format: ext,
      version: recipe.version,
      meta: { format: ext },
      file: zipPath,
      mime: ext === 'svg' ? 'image/svg+xml' : `image/${ext}`,
    });
  }
  entries['logos.json'] = strToU8(JSON.stringify(logoRows, null, 2));
  entries['prefs.json'] = strToU8('{}');

  // ── catalog assets (instance-pack part) ───────────────────────────────────
  const kept: AssetEntry[] = [];
  for (const asset of assetIndex.assets) {
    const included = recipe.includeAssetFamilies.some(p => asset.id.startsWith(p));
    const excluded = recipe.excludeAssetFamilies.some(p => asset.id.startsWith(p));
    if (included && excluded) throw new Error(`asset "${asset.id}" matches BOTH include and exclude families - fix the recipe`);
    if (!included && !excluded) throw new Error(`asset "${asset.id}" matches NO declared family - classify it in brands/${args.brand}/pack.json`);
    if (!included) continue;
    for (const fmt of asset.formats ?? []) {
      if (AUDIO_EXT.test(fmt.url) || asset.type === 'audio') {
        throw new Error(`audio may never ship in a pack: ${asset.id} (${fmt.url}) - the licence rule is absolute`);
      }
      if (!fmt.url.startsWith('/catalog/')) continue;
      const rel = fmt.url.slice('/catalog/'.length);
      put(`catalog/${rel}`, new Uint8Array(readFileSync(join(catalogDir, rel))));
    }
    kept.push(asset);
  }
  entries['catalog.json'] = strToU8(JSON.stringify({ assets: kept }, null, 2));

  // The brand's catalog font tree rides at its canonical /catalog/fonts/ paths
  // too (webfonts + variable + licence; otf/ttf are print/desktop installers,
  // fetchable from the brand instance later): font-registry.ts resolves brand
  // statics by these exact paths for vector export, and the brand editor lists
  // them - the pack must answer like a brand instance would. The SAME faces
  // also land as user fonts (fonts.json above), which is what makes the type
  // available the moment the pack loads, so the two are complementary.
  const catalogFontsDir = join(catalogDir, 'fonts');
  if (existsSync(catalogFontsDir)) {
    for (const sub of ['webfonts', 'variable']) {
      const subDir = join(catalogFontsDir, sub);
      if (!existsSync(subDir)) continue;
      for (const file of walkFiles(subDir)) {
        put(`catalog/fonts/${sub}/${file}`, new Uint8Array(readFileSync(join(subDir, file))));
      }
    }
    for (const lic of readdirSync(catalogFontsDir)) {
      if (/\.(txt|md)$/i.test(lic)) put(`catalog/fonts/${lic}`, new Uint8Array(readFileSync(join(catalogFontsDir, lic))));
    }
  }

  // ── tools (instance-pack part) ────────────────────────────────────────────
  const toolIds = readdirSync(toolsDir).filter(e =>
    !e.startsWith('.') && !e.startsWith('_')
    && statSync(join(toolsDir, e)).isDirectory()
    && existsSync(join(toolsDir, e, 'tool.json')));
  const toolIndex: { tools: Array<{ id: string;[k: string]: unknown }> } = JSON.parse(
    readFileSync(join(catalogDir, 'tools/index.json'), 'utf8'),
  );
  const packToolEntries = toolIndex.tools.filter(t => toolIds.includes(t.id));
  const missingFromIndex = toolIds.filter(id => !packToolEntries.some(t => t.id === id));
  if (missingFromIndex.length) {
    throw new Error(`tool dir(s) with no index entry: ${missingFromIndex.join(', ')} - run npm run build:catalog for the brand first`);
  }
  const toolFiles: Record<string, string[]> = {};
  const excludedIds = new Set(assetIndex.assets
    .filter(a => recipe.excludeAssetFamilies.some(p => a.id.startsWith(p)))
    .map(a => a.id));
  const danglingRefs: string[] = [];
  for (const id of toolIds) {
    const files = walkFiles(join(toolsDir, id)).sort();
    toolFiles[id] = files;
    for (const f of files) {
      if (AUDIO_EXT.test(f)) throw new Error(`audio may never ship in a pack: tools/${id}/${f}`);
      const bytes = readFileSync(join(toolsDir, id, f));
      put(`tools/${id}/${f}`, new Uint8Array(bytes));
      // A tool default naming an excluded asset will 404 for pack users until
      // id.suse.com exists - surface it at build time, don't let it surprise.
      if (f === 'tool.json') {
        const raw = bytes.toString('utf8');
        for (const ex of excludedIds) if (raw.includes(`"${ex}"`)) danglingRefs.push(`${id} → ${ex}`);
      }
    }
  }
  entries['tools.json'] = strToU8(JSON.stringify({ tools: packToolEntries, files: toolFiles }, null, 2));

  // ── instance-pack manifest part ───────────────────────────────────────────
  const packMeta = {
    kind: 'instance-pack',
    name: recipe.name,
    publisher: recipe.publisher,
    version: recipe.version,
    ...(recipe.instance ? { instance: recipe.instance } : {}),
    engineVersion: ENGINE_VERSION,
    toolCount: toolIds.length,
    assetCount: kept.length,
    generatedAt: new Date().toISOString(),
  };
  entries['instance.json'] = strToU8(JSON.stringify(packMeta, null, 2));

  // ── envelope: README, integrity-mapped manifest, signature ────────────────
  const counts = {
    tokens: true,
    fontFamilies: 1,
    fontFiles: fontRows.length,
    logos: logoRows.length,
    prefs: 0,
    versions: 0,
    frozen: 0,
  };
  const integrity: Record<string, string> = {};
  for (const [path, entry] of Object.entries(entries)) {
    integrity[path] = sriSha256(entry instanceof Uint8Array ? entry : entry[0]);
  }
  const manifest = {
    format: BRAND_FORMAT,
    formatVersion: BRAND_FORMAT_VERSION,
    minReader: BRAND_READER_VERSION,
    app: 'lolly',
    exportedAt: new Date().toISOString(),
    label: recipe.name,
    counts,
    pack: packMeta,
    integrity,
  };
  const manifestBytes = strToU8(JSON.stringify(manifest, null, 2));
  entries['manifest.json'] = manifestBytes;

  const signer = await loadSigningKey(args.keyfile);
  if (signer) {
    const signature = await subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' }, signer.key, manifestBytes as unknown as NodeJS.BufferSource,
    );
    entries['pack.sig'] = strToU8(JSON.stringify({
      alg: CATALOG_SIG_ALG,
      signedAt: new Date().toISOString(),
      keyThumbprint: signer.thumbprint,
      signature: Buffer.from(signature).toString('base64'),
    }, null, 2));
  }

  const filename = `${args.brand}-brand-${recipe.version}.lolly`;
  entries['lolly.txt'] = strToU8([
    BUNDLE_HEADER,
    '-'.repeat(56),
    '',
    `[[ 🎨 ${filename} ]]`,
    '',
    `${recipe.name} - a portable Lolly instance pack from ${recipe.publisher}.`,
    'Open Lolly (the app, or the web shell), go to Profile → Adjust your brand →',
    '“Load a brand file…” and choose this file. Everything installs on-device;',
    'nothing is uploaded anywhere.',
    '',
    "[ What's inside ]",
    '',
    `🎨 Design tokens   included`,
    `🔤 Font faces      ${fontRows.length} (${recipe.fonts.families.join(', ')})`,
    `🖼  Logo marks      ${logoRows.length}`,
    `🧰 Tools           ${toolIds.length}`,
    `🗂  Catalog assets  ${kept.length}`,
    `🌐 Community tools come from ${recipe.instance ?? 'the instance you connect'}`,
    `🔏 Signature       ${signer ? 'signed' : 'UNSIGNED (development build)'}`,
    '',
    'Photos, campaign imagery and music are deliberately not in this file -',
    'load those from the brand portal yourself.',
  ].join('\n') + '\n');

  const zipped = zipSync(entries as Parameters<typeof zipSync>[0]);
  if (zipped.length > PACK_BUDGET) {
    throw new Error(`pack is ${(zipped.length / 1048576).toFixed(1)} MB - over the ${PACK_BUDGET / 1048576} MB budget; something heavy slipped an include list`);
  }
  mkdirSync(args.out, { recursive: true });
  const outPath = join(args.out, filename);
  writeFileSync(outPath, zipped);
  const fileSha = createHash('sha256').update(zipped).digest('hex');
  writeFileSync(`${outPath}.sha256`, `${fileSha}  ${filename}\n`);

  console.log(`✓ ${relative(ROOT, outPath)} - ${(zipped.length / 1048576).toFixed(1)} MB`);
  console.log(`  tokens ✓ · ${fontRows.length} font faces (${unparsedFonts} variable/other file(s) skipped) · ${logoRows.length} logos · ${toolIds.length} tools · ${kept.length} catalog assets`);
  console.log(`  sha256 ${fileSha}`);
  console.log(signer
    ? `  signed - pin thumbprint ${signer.thumbprint}`
    : '  UNSIGNED - pass --keyfile (or LOLLY_CATALOG_SIGNING_KEY) before distributing');
  // Where a finished pack goes: a deployment with a control plane hosts it at
  // /connect/pack.lolly and advertises it in its instance manifest - the pack
  // is verified at upload to point at the instance base it names, so cutting
  // it for one deployment and hosting it on another is refused at the door.
  console.log(`  host it on its instance: PUT /api/v1/instance-pack (owner) - e.g. \`lw instance pack ${relative(ROOT, outPath)}\``);
  if (danglingRefs.length) {
    console.warn(`  ⚠ tool manifests reference excluded assets (they will 404 for pack users until the brand instance exists):`);
    for (const ref of danglingRefs) console.warn(`    - ${ref}`);
  }
}

main().catch((e: Error) => {
  console.error(`✗ ${e.message}`);
  process.exit(1);
});
