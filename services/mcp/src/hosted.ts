// SPDX-License-Identifier: MPL-2.0
/**
 * Whether this MCP server is hosted, and the size limits a hosted server works to.
 *
 * HOSTED. A deployment says so with `LOLLY_MCP_HOSTED=1` or `NODE_ENV=production`
 * (every container image and both Helm charts set the second). `isHostedServer`
 * adds one case those flags miss: a server whose public origin is not a loopback
 * address is reachable from other machines, so a file sent to it leaves the
 * machine it came from. The rate limiter, the daily budget and the public origin
 * check read the narrower `hostedDeployment`; the size limits and the rules about
 * what one request may carry read `isHostedServer`.
 *
 * LIMITS. Three settings, read only on a hosted server, each a whole number of
 * bytes. A value that is not one falls back to the default and is reported once.
 *
 *   LOLLY_MCP_REQUEST_MAX_BYTES   the largest JSON-RPC request body the gateway
 *                                 reads, and so the room the file tools have for
 *                                 a file and its base64. Default 4,500,000.
 *   LOLLY_MCP_RESPONSE_MAX_BYTES  the largest JSON-RPC response body sent. A larger
 *                                 answer becomes a tool error that says why.
 *                                 Default 4,400,000.
 *   LOLLY_MCP_MAX_IMAGE_BYTES     the largest image the image proxy fetches.
 *                                 Default 4 MiB.
 *
 * The defaults are the figures the public endpoint has always published. A local
 * server keeps its own larger limits and reads none of these settings.
 *
 * Nothing here reads the environment at import time, so a bundle entry can set
 * these variables before the first call (vercel-platform.ts does).
 */

type Env = Record<string, string | undefined>;

/** The request body a hosted server reads when `LOLLY_MCP_REQUEST_MAX_BYTES` is not set. */
export const HOSTED_REQUEST_MAX_BYTES = 4_500_000;
/** The response body a hosted server sends when `LOLLY_MCP_RESPONSE_MAX_BYTES` is not set. */
export const HOSTED_RESPONSE_MAX_BYTES = 4_400_000;
/** The image a hosted proxy fetches when `LOLLY_MCP_MAX_IMAGE_BYTES` is not set. */
export const HOSTED_MAX_IMAGE_BYTES = 4 * 1024 * 1024;

/** The deployment flags: `LOLLY_MCP_HOSTED=1` or `NODE_ENV=production`. */
export function hostedDeployment(env: Env = process.env): boolean {
  return env.LOLLY_MCP_HOSTED === '1' || env.NODE_ENV === 'production';
}

/**
 * Hosted or local: the deployment flags, or a public origin that is not a
 * loopback address.
 */
export function isHostedServer(env: Env = process.env): boolean {
  if (hostedDeployment(env)) return true;
  const origin = env.LOLLY_MCP_PUBLIC_ORIGIN?.trim();
  if (!origin) return false;
  try {
    const host = new URL(origin).hostname;
    return !(host === 'localhost' || host === '127.0.0.1' || host === '[::1]');
  } catch {
    return false;
  }
}

const reported = new Set<string>();

function bytesSetting(env: Env, name: string, fallback: number): number {
  const raw = env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (/^\d+$/.test(raw) && Number.isSafeInteger(value) && value > 0) return value;
  if (!reported.has(name)) {
    reported.add(name);
    console.warn(`[mcp] ${name} must be a whole number of bytes; using ${fallback}`);
  }
  return fallback;
}

/** The request body a hosted server reads. */
export function hostedRequestMaxBytes(env: Env = process.env): number {
  return bytesSetting(env, 'LOLLY_MCP_REQUEST_MAX_BYTES', HOSTED_REQUEST_MAX_BYTES);
}

/** The response body a hosted server sends. */
export function hostedResponseMaxBytes(env: Env = process.env): number {
  return bytesSetting(env, 'LOLLY_MCP_RESPONSE_MAX_BYTES', HOSTED_RESPONSE_MAX_BYTES);
}

/** The image a hosted image proxy fetches. */
export function hostedMaxImageBytes(env: Env = process.env): number {
  return bytesSetting(env, 'LOLLY_MCP_MAX_IMAGE_BYTES', HOSTED_MAX_IMAGE_BYTES);
}
