// SPDX-License-Identifier: MPL-2.0
/** Materialize immutable catalog URLs in an extracted build, preserving legacy files. */
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, sep, extname } from 'node:path';
import { toolDirectoryHash, catalogIndexPath, CATALOG_SIGNED_I18N_SIDECAR, CATALOG_SIGNED_TEMPLATE_FILE } from '../engine/src/catalog-integrity.ts';
import type { CatalogSignatureEnvelope } from '../engine/src/catalog-integrity.ts';

export interface CatalogDeliveryFile { path: string; size: number; sha256: string; }
export interface CatalogDeliveryManifest { version: 1; files: CatalogDeliveryFile[]; }
const sha = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
const safe = (path: string): boolean => !isAbsolute(path) && !/[\\%?#\p{White_Space}\p{Cc}]/u.test(path)
  && path.split('/').every(part => !!part && part !== '.' && part !== '..');

function pathIn(root: string, path: string): string {
  if (!safe(path)) throw new Error('Unsafe catalog delivery path');
  const parts = path.split('/');
  let current = root;
  for (const part of parts) {
    current = join(current, part);
    if (existsSync(current) && lstatSync(current).isSymbolicLink()) throw new Error('Catalog delivery contains a symbolic link');
  }
  return current;
}

/** Existing immutable destinations are verified, never overwritten. */
function publish(root: string, path: string, bytes: Uint8Array): CatalogDeliveryFile {
  const output = pathIn(root, path), digest = sha(bytes);
  if (existsSync(output)) {
    if (!lstatSync(output).isFile() || sha(readFileSync(output)) !== digest) throw new Error('Immutable catalog URL already names different bytes');
  } else {
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, bytes, { flag: 'wx', mode: 0o444 });
  }
  return { path, size: bytes.byteLength, sha256: digest };
}

/** Enumerate actual regular tool bytes, including assets and vendored libraries. */
export function catalogToolFiles(rootPath: string): Record<string, string> {
  const root = realpathSync(rootPath), files: Record<string, string> = {};
  let count = 0;
  const walk = (directory: string, prefix: string, depth: number): void => {
    if (depth > 32) throw new Error('Tool directory is too deep');
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = prefix + entry.name;
      if (entry.isSymbolicLink()) throw new Error('Tool directory contains a symbolic link');
      if (++count > 100000 || !safe(path)) throw new Error('Unsafe or oversized tool directory');
      if (entry.isDirectory()) walk(join(directory, entry.name), path + '/', depth + 1);
      else if (entry.isFile()) files[path] = sha(readFileSync(join(directory, entry.name)));
      else throw new Error('Tool directory contains a non-regular file');
    }
  };
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.isSymbolicLink() && /^[a-z0-9][a-z0-9-]*$/i.test(entry.name)) throw new Error('Tool directory contains a symbolic link');
    if (!/^[a-z0-9][a-z0-9-]*$/i.test(entry.name) || !entry.isDirectory()) continue;
    if (existsSync(join(root, entry.name, 'tool.json'))) walk(join(root, entry.name), entry.name + '/', 0);
  }
  for (const path of Object.keys(files)) {
    const rel = path.slice(path.indexOf('/') + 1);
    if ((rel.startsWith('i18n/') && !CATALOG_SIGNED_I18N_SIDECAR.test(rel)) || (rel.startsWith('templates/') && !CATALOG_SIGNED_TEMPLATE_FILE.test(rel))) delete files[path];
  }
  return files;
}

/** Rewrite only the extracted asset index; source catalogs and legacy URLs survive. */
function assetAddresses(root: string): CatalogDeliveryFile[] {
  const indexPath = pathIn(root, 'catalog/assets/index.json');
  if (!existsSync(indexPath)) return [];
  const text = readFileSync(indexPath, 'utf8');
  const index = JSON.parse(text) as { assets?: Array<{ formats?: unknown[]; locales?: Record<string, unknown[]> }> };
  if (!Array.isArray(index.assets)) throw new Error('Asset index has no assets list');
  const output: CatalogDeliveryFile[] = [];
  let changed = false;
  for (const asset of index.assets) {
    const formats = [...(asset.formats ?? []), ...Object.values(asset.locales ?? {}).flat()];
    for (const input of formats) {
      const format = input as { url?: string; checksum?: string; size?: number };
      if (typeof format.url !== 'string' || !format.url.startsWith('/catalog/')) continue;
      const source = pathIn(root, format.url.slice(1));
      if (!lstatSync(source).isFile()) throw new Error('Catalog asset is not a regular file');
      const bytes = readFileSync(source), digest = sha(bytes);
      const sri = 'sha256-' + Buffer.from(digest, 'hex').toString('base64');
      if (format.checksum !== sri) throw new Error('Catalog asset does not match its checksum');
      const ext = extname(format.url);
      if (!/^\.[a-z0-9]{1,12}$/i.test(ext)) throw new Error('Catalog asset requires an explicit extension');
      const stem = format.url.slice(1, -ext.length).replace(/\.[0-9a-f]{16}$/, '');
      const addressed = `${stem}.${digest.slice(0, 16)}${ext}`;
      output.push(publish(root, addressed, bytes));
      if (format.url !== '/' + addressed) { format.url = '/' + addressed; changed = true; }
      if (format.size !== bytes.length) { format.size = bytes.length; changed = true; }
    }
  }
  if (changed) writeFileSync(indexPath, JSON.stringify(index, null, 2) + '\n');
  return output;
}

/** Only mutable text references change; signed image and screenshot bytes stay exact. */
function rewriteReferences(text: string, addresses: Map<string, string>): string {
  return text.replace(/\/(?:catalog\/(?:previews|og)\/|info\/shots\/|tools\/)[A-Za-z0-9_./@+,-]+/g, path => addresses.get(path) ?? path);
}

/** Immutable preview, social-card and documentation-shot copies from an extracted build. */
function publicImageAddresses(root: string): { addresses: Map<string, string>; files: CatalogDeliveryFile[] } {
  const addresses = new Map<string, string>(), files: CatalogDeliveryFile[] = [];
  const walk = (directory: string): void => {
    if (!existsSync(directory)) return;
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.isSymbolicLink()) throw new Error('Public image tree contains a symbolic link');
      const source = join(directory, entry.name);
      if (entry.isDirectory()) { walk(source); continue; }
      if (!entry.isFile() || !/\.(svg|png|webp|avif|jpe?g|gif|webm|mp4)$/i.test(entry.name) || /\.[0-9a-f]{16}\.[a-z0-9]+$/i.test(entry.name)) continue;
      const path = relative(root, source).split(sep).join('/'), bytes = readFileSync(source), extension = extname(path);
      const addressed = `${path.slice(0, -extension.length)}.${sha(bytes).slice(0, 16)}${extension}`;
      files.push(publish(root, addressed, bytes));
      addresses.set('/' + path, '/' + addressed);
    }
  };
  for (const path of ['catalog/previews', 'catalog/og', 'info/shots']) walk(pathIn(root, path));
  return { addresses, files };
}

/** Read regular mutable text only, excluding retained hash trees and hash files. */
function rewriteHtmlTree(root: string, directory: string, addresses: Map<string, string>, skipTools: boolean): void {
  if (!existsSync(directory)) return;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw new Error('Public HTML tree contains a symbolic link');
    if (entry.name.startsWith('.') || /@[0-9a-f]{16}$/.test(entry.name) || /\.[0-9a-f]{16}\.[a-z0-9]+$/i.test(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (skipTools && path === join(root, 'tools')) continue;
      rewriteHtmlTree(root, path, addresses, skipTools);
    } else if (entry.isFile() && /\.html$/i.test(entry.name)) {
      const before = readFileSync(path, 'utf8');
      let after = rewriteReferences(before, addresses);
      const toolParts = relative(join(root, 'tools'), path).split(sep);
      if (toolParts.length === 2 && toolParts[1] === 'card.html' && /^[a-z0-9][a-z0-9-]*$/i.test(toolParts[0]!)) {
        // A directly served card resolves siblings inside its own immutable tree.
        after = after.replace(new RegExp(`(?<![a-z0-9./:-])/tools/${toolParts[0]}/`, 'gi'), './');
      }
      if (after !== before) writeFileSync(path, after);
    }
  }
}

/** Catalog indexes and the look bundle now point at files that actually exist. */
function rewriteCatalogReferences(root: string, addresses: Map<string, string>): void {
  for (const path of ['catalog/tools/index.json', 'catalog/tools/index.slim.json', 'catalog/previews/bundle.json']) {
    const file = pathIn(root, path);
    if (!existsSync(file)) continue;
    const before = readFileSync(file, 'utf8'), after = rewriteReferences(before, addresses);
    if (after !== before) writeFileSync(file, after);
  }
}

/** Build real hashed tool trees and hashed catalog originals before final signing. */
export async function materializeCatalogDelivery(rootPath: string): Promise<{ toolDirs: Record<string, string>; files: CatalogDeliveryFile[] }> {
  if (lstatSync(rootPath).isSymbolicLink()) throw new Error('Catalog build root must not be a symbolic link');
  const root = realpathSync(rootPath), source = join(root, 'tools');
  const images = publicImageAddresses(root);
  // Tool HTML changes precede hashing; no hash directory may contain changed bytes.
  rewriteHtmlTree(root, source, images.addresses, false);
  const files = catalogToolFiles(source), toolDirs: Record<string, string> = {};
  const output = [...assetAddresses(root), ...images.files];
  for (const id of [...new Set(Object.keys(files).map(path => path.split('/')[0]!))].sort()) {
    const digest = await toolDirectoryHash(files, id);
    toolDirs[id] = digest;
    for (const [path] of Object.entries(files).filter(([path]) => path.startsWith(id + '/'))) {
      const addressed = `tools/${id}@${digest.slice(0, 16)}/${path.slice(id.length + 1)}`;
      output.push(publish(root, addressed, readFileSync(pathIn(source, path))));
      images.addresses.set('/tools/' + path, '/' + addressed);
    }
  }
  rewriteCatalogReferences(root, images.addresses);
  rewriteHtmlTree(root, root, images.addresses, true);
  return { toolDirs, files: output };
}

/** Write exact index bytes by their signed addresses and an immutable retention inventory. */
export function publishCatalogIndexes(rootPath: string, envelope: CatalogSignatureEnvelope, files: CatalogDeliveryFile[] = []): CatalogDeliveryManifest {
  const root = realpathSync(rootPath), output = [...files];
  const indexes = [[envelope.indexHash, 'tools', 'catalog/tools/index.json'],
    [envelope.assetIndexHash, 'assets', 'catalog/assets/index.json'],
    [envelope.slimHash, 'slim', 'catalog/tools/index.slim.json']] as const;
  for (const [digest, kind, source] of indexes) {
    if (!digest) continue;
    const bytes = readFileSync(pathIn(root, source));
    if (sha(bytes) !== digest) throw new Error('Catalog changed after signing');
    output.push(publish(root, catalogIndexPath(digest, kind).slice(1), bytes));
  }
  const unique = [...new Map(output.map(file => [file.path, file])).values()].sort((a, b) => a.path.localeCompare(b.path));
  const manifest: CatalogDeliveryManifest = { version: 1, files: unique };
  writeFileSync(pathIn(root, 'catalog/delivery-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

/** Import a reviewed previous immutable inventory into a new release, checking every byte. */
export function retainCatalogDelivery(rootPath: string, previousPath: string): CatalogDeliveryFile[] {
  const root = realpathSync(rootPath), previous = realpathSync(previousPath);
  const rel = relative(root, previous), reverse = relative(previous, root);
  if (!rel || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith('..' + sep)) || (!isAbsolute(reverse) && reverse !== '..' && !reverse.startsWith('..' + sep))) throw new Error('Retained release must be separate from output');
  const inventory = JSON.parse(readFileSync(pathIn(previous, 'catalog/delivery-manifest.json'), 'utf8')) as CatalogDeliveryManifest;
  if (inventory.version !== 1 || !Array.isArray(inventory.files) || inventory.files.length > 100000) throw new Error('Invalid retained catalog inventory');
  const output: CatalogDeliveryFile[] = [];
  for (const file of inventory.files) {
    if (!/^(?:catalog|info\/shots)\/.+\.[0-9a-f]{16}\.[a-z0-9]{1,12}$/i.test(file.path) && !/^tools\/[a-z0-9-]+@[0-9a-f]{16}\/.+/i.test(file.path)) throw new Error('Retained path is not content addressed');
    const bytes = readFileSync(pathIn(previous, file.path));
    if (!Number.isSafeInteger(file.size) || file.size !== bytes.length || !/^[0-9a-f]{64}$/.test(file.sha256) || sha(bytes) !== file.sha256) throw new Error('Retained catalog bytes differ from inventory');
    output.push(publish(root, file.path, bytes));
  }
  return output;
}
