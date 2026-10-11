#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/** Generate approved signed previews once; apply only verified products to an extracted release. */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync, realpathSync } from 'node:fs';
import { resolve, dirname, join, relative, sep } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { DEFAULT_RASTER_LADDER, signedRendition } from './catalog-renditions.ts';
import type { RenditionRecord, RenditionCredits } from './catalog-renditions.ts';
import { catalogRenditionSigner } from './catalog-rendition-signer.ts';
import type { EmbedOptions } from '../engine/src/c2pa.ts';
import { verifyC2pa } from '../engine/src/c2pa-verify.ts';
import { pemToDer } from '../engine/src/x509.ts';

const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
interface Format { format: string; url: string; checksum?: string; size?: number; width?: number; height?: number; rendition?: unknown }
interface Asset { id: string; name?: string; type: string; tags?: string[]; attribution?: string; license?: string; rights?: unknown; formats: Format[] }
interface Products { v: 1; assets: Array<{ id: string; source: string; credits: RenditionCredits; products: RenditionRecord[] }> }
const credits = (a: Asset): RenditionCredits => ({ title: a.name || a.id,
  ...(a.attribution ? { attribution: a.attribution } : {}), ...(a.license ? { license: a.license } : {}), ...(a.rights ? { rights: a.rights } : {}) });
function catalogPath(root: string, url: string): string {
  if (!url.startsWith('/catalog/') || /[%?#\\]/.test(url) || [...url].some(c => c.charCodeAt(0) <= 32)) throw new Error('Rendition source must be a local catalog file');
  const catalog = realpathSync(join(root, 'catalog')), file = realpathSync(join(root, url.slice(1)));
  if (!file.startsWith(catalog + sep)) throw new Error('Rendition source escaped the catalog');
  return file;
}
export async function generateRenditions(opts: { root: string; output: string; cache: string; sourceBase: string;
  approveSigning: boolean; signerVersion: string; signing: Pick<EmbedOptions, 'signer' | 'dates' | 'claimGenerator' | 'generatorInfo'>;
}): Promise<{ assets: number; products: number; reused: number }> {
  if (!opts.approveSigning) throw new Error('Signed rendition generation requires owner approval');
  const index = JSON.parse(readFileSync(join(opts.root, 'catalog/assets/index.json'), 'utf8')) as { assets: Asset[] };
  const manifest: Products = { v: 1, assets: [] }; let reused = 0;
  mkdirSync(opts.output, { recursive: true });
  for (const asset of index.assets) {
    if (asset.type !== 'raster' || asset.tags?.includes('animated')) continue;
    const original = asset.formats.find(f => !f.rendition && /^(png|jpe?g|webp|avif)$/.test(f.format));
    if (!original) continue;
    const source = new Uint8Array(readFileSync(catalogPath(opts.root, original.url)));
    const sri = 'sha256-' + createHash('sha256').update(source).digest('base64');
    if (!original.checksum || sri !== original.checksum) throw new Error(`Original checksum mismatch: ${asset.id}`);
    const info = await sharp(source, { limitInputPixels: 64_000_000 }).metadata();
    if ((info.pages ?? 1) > 1 || !info.width) continue;
    const width = info.orientation && info.orientation >= 5 ? info.height : info.width;
    const products: RenditionRecord[] = [];
    for (const spec of DEFAULT_RASTER_LADDER.filter(s => (s.w ?? 0) <= (width ?? 0))) {
      const product = await signedRendition({ source, sourceUrl: new URL(original.url, opts.sourceBase).href,
        sourceFormat: original.format === 'jpg' ? 'jpeg' : original.format, spec, credits: credits(asset),
        cache: opts.cache, approveSigning: true, signerVersion: opts.signerVersion, signing: opts.signing });
      const { bytes, cached, ...record } = product;
      const target = join(opts.output, record.file);
      if (existsSync(target) && sha(readFileSync(target)) !== record.sha256) throw new Error('Rendition product collision');
      if (!existsSync(target)) writeFileSync(target, bytes, { flag: 'wx' });
      products.push(record); if (cached) reused++;
    }
    if (products.length) manifest.assets.push({ id: asset.id, source: original.url, credits: credits(asset), products });
  }
  writeFileSync(join(opts.output, 'index.json'), JSON.stringify(manifest, null, 2) + '\n');
  return { assets: manifest.assets.length, products: manifest.assets.reduce((n, a) => n + a.products.length, 0), reused };
}
export async function applyRenditions(root: string, productsRoot = join(root, 'catalog/renditions'), trustAnchors?: Uint8Array[]): Promise<number> {
  if (!existsSync(join(productsRoot, 'index.json'))) return 0;
  const manifest = JSON.parse(readFileSync(join(productsRoot, 'index.json'), 'utf8')) as Products;
  if (manifest.v !== 1 || !Array.isArray(manifest.assets)) throw new Error('Unsupported rendition manifest');
  const indexFile = join(root, 'catalog/assets/index.json');
  const index = JSON.parse(readFileSync(indexFile, 'utf8')) as { assets: Asset[] }; let count = 0;
  for (const entry of manifest.assets) {
    const asset = index.assets.find(a => a.id === entry.id);
    if (!asset) continue;
    const original = asset.formats.find(f => !f.rendition && f.url === entry.source);
    if (!original || JSON.stringify(credits(asset)) !== JSON.stringify(entry.credits)) throw new Error(`Rendition source or credits changed: ${entry.id}`);
    const sourceHash = sha(readFileSync(catalogPath(root, original.url)));
    for (const product of entry.products) {
      if (product.sourceSha256 !== sourceHash || !/^out\.[0-9a-f]{16}\.(png|jpeg|webp|avif)$/.test(product.file)) throw new Error('Rendition parent mismatch');
      const file = join(productsRoot, product.file), bytes = readFileSync(file);
      if (sha(bytes) !== product.sha256 || bytes.length !== product.size || !product.file.includes(product.sha256.slice(0, 16))) throw new Error('Rendition checksum mismatch');
      const verdict = await verifyC2pa(new Uint8Array(bytes), { trustAnchors });
      if (verdict.state !== 'valid' || (trustAnchors?.length && !verdict.trusted)
        || verdict.environment?.sourceSha256 !== sourceHash || verdict.environment?.creditsJson !== JSON.stringify(entry.credits)
        || verdict.environment?.signerVersion !== product.signerVersion) throw new Error('Rendition credential or source credits mismatch');
      const url = '/' + relative(root, file).split(sep).join('/');
      if (!url.startsWith('/catalog/')) throw new Error('Rendition products must be within the release catalog');
      if (asset.formats.some(f => f.url === url)) continue;
      asset.formats.push({ format: product.spec.format, url, width: product.width, height: product.height, size: product.size,
        checksum: 'sha256-' + createHash('sha256').update(bytes).digest('base64'), rendition: { of: sourceHash, spec: product.spec } }); count++;
    }
  }
  writeFileSync(indexFile, JSON.stringify(index, null, 2) + '\n');
  return count;
}
export async function main(args = process.argv.slice(2)): Promise<void> {
  const opt = (name: string) => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
  const root = opt('--root'); if (!root) throw new Error('Specify an extracted --root');
  if (!args.includes('--generate')) {
    const pin = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../shells/web/src/ca-root.ts'), 'utf8').match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/);
    if (!pin) throw new Error('Catalog verifier root is missing');
    console.log(JSON.stringify({ applied: await applyRenditions(resolve(root), undefined, [pemToDer(pin[0])]) })); return;
  }
  const output = opt('--output'), cache = opt('--cache'), sourceBase = opt('--source-base');
  if (!output || !cache || !sourceBase || !args.includes('--approve-signing')) throw new Error('Generation requires output, protected cache, source base and explicit signing approval');
  const authority = await catalogRenditionSigner(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
  console.log(JSON.stringify(await generateRenditions({ root: resolve(root), output: resolve(output), cache: resolve(cache), sourceBase,
    approveSigning: true, signerVersion: authority.version, signing: authority.signing })));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
