// SPDX-License-Identifier: MPL-2.0
/**
 * The bytes behind an asset url, for a Node host (`host.assets.bytes`, v1.183).
 * Node shells hand tools `data:` urls (the CLI bridge inlines catalog files) and
 * occasionally `file:` paths; anything http(s) goes through the tool's own
 * `host.net` allowlist so a hook cannot use the asset reader as an open fetch.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export interface AssetBytesOpts {
  /** The tool's allowlisted fetch, for http(s) urls. Absent ⇒ http(s) is refused. */
  netFetch?: (url: string) => Promise<Response>;
}

export function decodeDataUrl(url: string): Uint8Array {
  const comma = url.indexOf(',');
  if (comma < 0) throw new Error('malformed data: url');
  const meta = url.slice(5, comma);
  const payload = url.slice(comma + 1);
  if (/;base64$/i.test(meta)) return new Uint8Array(Buffer.from(payload, 'base64'));
  return new Uint8Array(Buffer.from(decodeURIComponent(payload), 'utf8'));
}

export async function assetBytes(target: { url: string } | string, opts: AssetBytesOpts = {}): Promise<Uint8Array> {
  const url = typeof target === 'string' ? target : target.url;
  if (!url) throw new Error('asset has no url');
  if (url.startsWith('data:')) return decodeDataUrl(url);
  if (url.startsWith('file:')) return new Uint8Array(await readFile(fileURLToPath(url)));
  if (/^https?:/i.test(url)) {
    if (!opts.netFetch) throw new Error(`host.assets.bytes: ${url} is a network url and this tool declares no network allowlist`);
    const res = await opts.netFetch(url);
    if (!res.ok) throw new Error(`host.assets.bytes: HTTP ${res.status} for ${url}`);
    return new Uint8Array(await res.arrayBuffer());
  }
  throw new Error(`host.assets.bytes: cannot read ${url.slice(0, 40)} in this shell`);
}
