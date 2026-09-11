// SPDX-License-Identifier: MPL-2.0
/** Browser-tier request admission: exact origin allowlist plus DNS/IP refusal. */

import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';

const blocked = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24],
  ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) blocked.addSubnet(network, prefix, 'ipv4');
for (const [network, prefix] of [
  ['::', 128], ['::1', 128], ['100::', 64], ['2001:db8::', 32],
  ['fc00::', 7], ['fe80::', 10], ['ff00::', 8],
] as const) blocked.addSubnet(network, prefix, 'ipv6');

export type HostResolver = (hostname: string) => Promise<string[]>;

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  return family !== 0 && !blocked.check(address, family === 4 ? 'ipv4' : 'ipv6');
}

export function checkedBase(raw: string): URL {
  let url: URL;
  try { url = new URL(raw); }
  catch { throw new Error('LOLLY_WEB_BASE must be an absolute URL'); }
  const loopback = isLoopbackName(url.hostname);
  if (url.username || url.password || url.search || url.hash) throw new Error('LOLLY_WEB_BASE must not contain credentials, query, or fragment');
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) {
    throw new Error('LOLLY_WEB_BASE must use HTTPS outside the local embedded-shell server');
  }
  return url;
}

export function browserAllowedOrigins(base: string, env: NodeJS.ProcessEnv): Set<string> {
  const allowed = new Set([checkedBase(base).origin]);
  for (const raw of String(env.LOLLY_BROWSER_ALLOWED_ORIGINS || '').split(',')) {
    const value = raw.trim();
    if (!value) continue;
    let url: URL;
    try { url = new URL(value); }
    catch { throw new Error('LOLLY_BROWSER_ALLOWED_ORIGINS entries must be absolute origins'); }
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
      throw new Error('LOLLY_BROWSER_ALLOWED_ORIGINS entries must be credential-free HTTPS origins');
    }
    allowed.add(url.origin);
  }
  return allowed;
}

export async function assertBrowserRequestAllowed(
  raw: string,
  base: string,
  env: NodeJS.ProcessEnv,
  resolver: HostResolver = resolveHost,
): Promise<void> {
  const url = new URL(raw);
  if (url.protocol === 'blob:' || url.protocol === 'data:' || url.protocol === 'about:') return;
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error(`browser egress rejects ${url.protocol}`);
  // Hosted MCP renders have no member AI lease, including same-origin models.
  if (/\/models\/|\.(onnx|gguf|safetensors)$/i.test(url.pathname)) throw new Error('MCP model execution is disabled');
  if (!browserAllowedOrigins(base, env).has(url.origin)) throw new Error(`browser egress rejects off-list origin ${url.origin}`);

  const baseUrl = checkedBase(base);
  if (baseUrl.protocol === 'http:' && isLoopbackName(baseUrl.hostname) && url.origin === baseUrl.origin) return;
  const literal = stripIpv6Brackets(url.hostname);
  if (isIP(literal)) {
    if (!isPublicAddress(literal)) throw new Error('browser egress rejects non-public address');
    return;
  }
  const addresses = await resolver(url.hostname);
  if (!addresses.length || addresses.some(address => !isPublicAddress(address))) {
    throw new Error('browser egress rejects unresolved or non-public DNS answer');
  }
}

export async function installBrowserEgressPolicy(
  page: Pick<import('playwright-core').Page, 'route'>,
  base: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const cache = new Map<string, Promise<string[]>>();
  const resolver: HostResolver = hostname => {
    let pending = cache.get(hostname);
    if (!pending) {
      pending = resolveHost(hostname);
      cache.set(hostname, pending);
    }
    return pending;
  };
  browserAllowedOrigins(base, env);
  await page.route('**/*', async route => {
    try {
      await assertBrowserRequestAllowed(route.request().url(), base, env, resolver);
      await route.continue();
    } catch {
      await route.abort('blockedbyclient');
    }
  });
}

async function resolveHost(hostname: string): Promise<string[]> {
  try { return (await lookup(hostname, { all: true, verbatim: true })).map(answer => answer.address); }
  catch { return []; }
}

function isLoopbackName(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

function stripIpv6Brackets(hostname: string): string {
  return hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
}
