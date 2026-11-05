// SPDX-License-Identifier: MPL-2.0
/**
 * Read a brand page somebody published (plan 351 B4): an address or a local folder. This
 * is how one brand's tools take another brand's current logo and usage statement, in
 * place of a PNG sent by email.
 *
 * Everything in a page is data from someone else, so every step is bounded and checked.
 * The manifest must hash to the digest it states, and each file must hash to its row in
 * the manifest. Fetches stay under the page's own address through the same allowlist
 * check tools get, and a redirect to another origin is refused. A folder is read only
 * inside itself. Nothing here runs anything from the page, and a file is only returned
 * once its digest is right.
 *
 * A signed page does not exist yet, so a digest shows a file is the one the manifest
 * lists. It does not show who published the page.
 */
import { lstat, readFile, realpath } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';

import type { BrandPageFileV1, BrandPageLogoV1, BrandPageV1 } from '@lolly-tools/core/brand-page-v1';

import { brandPageDigest, brandPageSvgProblem } from '../../../engine/src/brand-page.ts';
import { bytesToHex, sha256 } from '../../../engine/src/bytes.ts';
import { createNetAPI } from './net.ts';

const MAX_MANIFEST_BYTES = 4 * 1024 * 1024;
const MAX_FILE_BYTES = 32 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 30_000;

export class BrandPageReadError extends Error {
  readonly code: string;
  constructor(code: string, message: string) { super(message); this.code = code; }
}

export interface ReadBrandPageOptions {
  fetchImpl?: typeof fetch;
  /** For tests: read over plain http from this machine. An address elsewhere must be https. */
  allowInsecureLoopback?: boolean;
}

export interface ReadBrandPage {
  manifest: BrandPageV1;
  /** The address or folder the page was read from. */
  source: string;
  /** A file's bytes, once they match the manifest. */
  file(path: string): Promise<Uint8Array>;
  /** The page's current logo for a surface. Null when it lists none. */
  logo(surface: 'light' | 'dark'): BrandPageLogoV1 | null;
}

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** A path a manifest lists: relative, forward slashes, with no way out of the page. */
function safePath(path: unknown): path is string {
  return typeof path === 'string' && path.length > 0 && path.length <= 600 && !path.startsWith('/') && !path.includes('\\') && !path.includes('\0')
    && path.split('/').every(part => part !== '' && part !== '.' && part !== '..');
}

function readManifest(bytes: Uint8Array): BrandPageV1 {
  let parsed: unknown;
  try { parsed = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new BrandPageReadError('BRAND_PAGE_INVALID', 'brand.json is not valid JSON'); }
  if (!isRecord(parsed) || parsed.version !== 1 || typeof parsed.digest !== 'string' || !Array.isArray(parsed.files) || typeof parsed.id !== 'string' || typeof parsed.name !== 'string') {
    throw new BrandPageReadError('BRAND_PAGE_INVALID', 'brand.json is not a version 1 brand page manifest');
  }
  for (const file of parsed.files as unknown[]) {
    if (!isRecord(file) || !safePath(file.path) || typeof file.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(file.sha256)) {
      throw new BrandPageReadError('BRAND_PAGE_INVALID', 'brand.json lists a file with an unsafe path or no digest');
    }
  }
  return parsed as unknown as BrandPageV1;
}

async function readBounded(res: Response, cap: number, url: string): Promise<Uint8Array> {
  const declared = Number(res.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > cap) throw new BrandPageReadError('BRAND_PAGE_TOO_LARGE', `${url} is larger than the ${cap}-byte limit`);
  if (!res.body) return new Uint8Array(await res.arrayBuffer());
  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = res.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > cap) { await reader.cancel(); throw new BrandPageReadError('BRAND_PAGE_TOO_LARGE', `${url} is larger than the ${cap}-byte limit`); }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) { out.set(chunk, at); at += chunk.byteLength; }
  return out;
}

function addressReader(address: string, opts: ReadBrandPageOptions): (path: string, cap: number) => Promise<Uint8Array> {
  let base: URL;
  try { base = new URL(address.endsWith('/') ? address : `${address}/`); } catch { throw new BrandPageReadError('BRAND_PAGE_ADDRESS', `${address} is not a valid address`); }
  const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname);
  if (base.username || base.password) throw new BrandPageReadError('BRAND_PAGE_ADDRESS', 'a brand page address cannot carry a name or password');
  if (base.protocol !== 'https:' && !(base.protocol === 'http:' && loopback && opts.allowInsecureLoopback)) {
    throw new BrandPageReadError('BRAND_PAGE_ADDRESS', `a brand page address must use https: ${address}`);
  }
  // The allowlist tools get, narrowed to this one origin, so a manifest cannot point a fetch elsewhere.
  const net = createNetAPI({ allowlist: [`${base.origin}/*`], ...(opts.fetchImpl ? { fetchImpl: opts.fetchImpl as never } : {}) });
  return async (path, cap) => {
    let url = new URL(path, base).href;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      const res = await net.fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS) } as RequestInit).catch((error: Error) => {
        throw new BrandPageReadError('BRAND_PAGE_FETCH', `could not read ${url}: ${error.message}`);
      });
      if (res.status >= 300 && res.status < 400) {
        const next = new URL(res.headers.get('location') ?? '', url);
        if (next.origin !== base.origin) throw new BrandPageReadError('BRAND_PAGE_REDIRECT', `${url} redirects to another origin, ${next.origin}`);
        url = next.href;
        continue;
      }
      if (!res.ok) throw new BrandPageReadError('BRAND_PAGE_FETCH', `${url} answered ${res.status}`);
      return readBounded(res, cap, url);
    }
    throw new BrandPageReadError('BRAND_PAGE_REDIRECT', `${path} redirected more than ${MAX_REDIRECTS} times`);
  };
}

function folderReader(folder: string): (path: string, cap: number) => Promise<Uint8Array> {
  const root = resolve(folder);
  return async (path, cap) => {
    const target = join(root, ...path.split('/'));
    const info = await lstat(target).catch(() => null);
    if (!info?.isFile()) throw new BrandPageReadError('BRAND_PAGE_FETCH', `${path} is not a file in ${folder}`);
    if (info.size > cap) throw new BrandPageReadError('BRAND_PAGE_TOO_LARGE', `${path} is larger than the ${cap}-byte limit`);
    const [realRoot, real] = await Promise.all([realpath(root), realpath(target)]);
    if (!real.startsWith(realRoot + sep)) throw new BrandPageReadError('BRAND_PAGE_INVALID', `${path} leads outside the folder`);
    return new Uint8Array(await readFile(real));
  };
}

/** Read a page from an `https` address or a local folder. Throws `BrandPageReadError`. */
export async function readBrandPage(source: string, opts: ReadBrandPageOptions = {}): Promise<ReadBrandPage> {
  const isAddress = /^[a-z][a-z0-9+.-]*:\/\//i.test(source);
  const read = isAddress ? addressReader(source, opts) : folderReader(source);
  const manifest = readManifest(await read('brand.json', MAX_MANIFEST_BYTES));
  if (await brandPageDigest(manifest) !== manifest.digest) throw new BrandPageReadError('BRAND_PAGE_DIGEST', 'brand.json does not match its own digest, so it may have been altered');
  const rows = new Map<string, BrandPageFileV1>(manifest.files.map(f => [f.path, f]));
  const logos = Array.isArray(manifest.logos) ? manifest.logos.filter(l => isRecord(l) && rows.has(l.path)) : [];
  return {
    manifest,
    source,
    async file(path) {
      const row = rows.get(path);
      if (!row) throw new BrandPageReadError('BRAND_PAGE_INVALID', `${path} is not listed in brand.json`);
      const bytes = await read(path, MAX_FILE_BYTES);
      if (bytesToHex(await sha256(bytes)) !== row.sha256) throw new BrandPageReadError('BRAND_PAGE_DIGEST', `${path} does not match its digest in brand.json`);
      return bytes;
    },
    logo(surface) {
      // The logo the brand leads with on this surface, then one drawn for it, then one for any surface. Colour before mono in each.
      const rank = (l: BrandPageLogoV1): number => (l.surface === surface ? (l.primary === true ? 0 : 2) : l.surface === 'any' ? 4 : 6) + (l.mono ? 1 : 0);
      return [...logos].sort((a, b) => rank(a) - rank(b) || (a.id < b.id ? -1 : 1))[0] ?? null;
    },
  };
}

/** A logo file's bytes, refused when an SVG carries anything a picture should not. */
export async function readBrandPageLogo(page: ReadBrandPage, logo: BrandPageLogoV1): Promise<Uint8Array> {
  const bytes = await page.file(logo.path);
  if (logo.path.toLowerCase().endsWith('.svg')) {
    const problem = brandPageSvgProblem(new TextDecoder().decode(bytes));
    if (problem) throw new BrandPageReadError('BRAND_PAGE_INVALID', `${logo.path}: ${problem}`);
  }
  return bytes;
}
