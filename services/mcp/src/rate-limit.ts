// SPDX-License-Identifier: MPL-2.0
/**
 * Cross-instance fixed-window limiting over a Redis-compatible HTTPS REST API.
 * The configured store sees only SHA-256 key digests, never raw IP addresses,
 * bearer tokens, or email addresses. Local development retains a bounded
 * in-memory implementation; a hosted/production gateway with neither a durable
 * store nor the operator's explicit acceptance of the weaker fallback admits
 * nothing - every rate-limited route answers 503 (UnconfiguredRateLimiter) while
 * the routes that need no admission keep working.
 */

import { createHash } from 'node:crypto';

export interface RateLimitDecision {
  ok: boolean;
  retryAfter: number;
  remaining: number;
}

export interface RateLimiter {
  consume(scope: string, subject: string, limit: number, windowMs: number): Promise<RateLimitDecision>;
}

export class RateLimitUnavailableError extends Error {
  readonly code = 'rate-limit-unavailable';
  constructor(message = 'Durable rate limiter is unavailable') {
    super(message);
    this.name = 'RateLimitUnavailableError';
  }
}

const MAX_MEMORY_KEYS = 20_000;

export class MemoryRateLimiter implements RateLimiter {
  readonly #windows = new Map<string, { count: number; expires: number }>();
  readonly #now: () => number;

  constructor(now: () => number = Date.now) {
    this.#now = now;
  }

  async consume(scope: string, subject: string, limit: number, windowMs: number): Promise<RateLimitDecision> {
    validateBudget(limit, windowMs);
    const now = this.#now();
    const key = digestKey('memory', scope, subject);
    let bucket = this.#windows.get(key);
    if (!bucket || bucket.expires <= now) {
      if (this.#windows.size >= MAX_MEMORY_KEYS) {
        for (const [candidate, value] of this.#windows) {
          if (value.expires <= now || this.#windows.size >= MAX_MEMORY_KEYS) this.#windows.delete(candidate);
          if (this.#windows.size < MAX_MEMORY_KEYS) break;
        }
      }
      bucket = { count: 0, expires: now + windowMs };
      this.#windows.set(key, bucket);
    }
    bucket.count += 1;
    return decision(bucket.count, limit, bucket.expires - now);
  }
}

const REDIS_LUA = [
  "local n = redis.call('INCR', KEYS[1])",
  "if n == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end",
  "local ttl = redis.call('PTTL', KEYS[1])",
  'return {n, ttl}',
].join('\n');

export class RedisRestRateLimiter implements RateLimiter {
  readonly #url: string;
  readonly #token: string;
  readonly #namespace: string;
  readonly #fetch: typeof fetch;

  constructor(options: { url: string; token: string; namespace: string; fetchImpl?: typeof fetch }) {
    this.#url = normalizeRestUrl(options.url);
    this.#token = options.token;
    this.#namespace = options.namespace;
    this.#fetch = options.fetchImpl ?? fetch;
  }

  async consume(scope: string, subject: string, limit: number, windowMs: number): Promise<RateLimitDecision> {
    validateBudget(limit, windowMs);
    const key = `lolly:rl:${digestKey(this.#namespace, scope, subject)}`;
    let response: Response;
    try {
      response = await this.#fetch(this.#url, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.#token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(['EVAL', REDIS_LUA, '1', key, String(windowMs)]),
        signal: AbortSignal.timeout(2_500),
      });
    } catch {
      throw new RateLimitUnavailableError();
    }
    if (!response.ok) throw new RateLimitUnavailableError(`Durable rate limiter returned HTTP ${response.status}`);
    let result: unknown;
    try { result = (await response.json() as { result?: unknown }).result; }
    catch { throw new RateLimitUnavailableError('Durable rate limiter returned malformed JSON'); }
    if (!Array.isArray(result) || result.length !== 2) {
      throw new RateLimitUnavailableError('Durable rate limiter returned an invalid result');
    }
    const count = Number(result[0]);
    const ttl = Number(result[1]);
    if (!Number.isSafeInteger(count) || count < 1 || !Number.isFinite(ttl)) {
      throw new RateLimitUnavailableError('Durable rate limiter returned invalid counters');
    }
    return decision(count, limit, Math.max(1, ttl));
  }
}

/**
 * A hosted deployment with no durable store configured and no explicit opt-in.
 * Every admission fails as unavailable - the gateway answers 503 + Retry-After -
 * instead of the function refusing to boot. The boot throw it replaces took the
 * public health, discovery and render routes down with it on 2026-09-10, a far
 * wider failure than the policy (no unlimited admission) ever needed.
 */
export class UnconfiguredRateLimiter implements RateLimiter {
  readonly reason: string;
  constructor(reason: string) {
    this.reason = reason;
  }

  async consume(scope: string, subject: string, limit: number, windowMs: number): Promise<RateLimitDecision> {
    validateBudget(limit, windowMs);
    throw new RateLimitUnavailableError(this.reason);
  }
}

export const UNCONFIGURED_REASON =
  'No durable rate limiter is configured for this hosted deployment: set LOLLY_RATE_LIMIT_REST_URL + LOLLY_RATE_LIMIT_REST_TOKEN (a Redis-compatible HTTPS REST store), or LOLLY_ALLOW_IN_MEMORY_RATE_LIMIT=1 to accept per-instance limiting';

export function createRateLimiter(env: NodeJS.ProcessEnv, namespace = 'mcp'): RateLimiter {
  const url = env.LOLLY_RATE_LIMIT_REST_URL?.trim();
  const token = env.LOLLY_RATE_LIMIT_REST_TOKEN?.trim();
  if (!!url !== !!token) throw new Error('LOLLY_RATE_LIMIT_REST_URL and LOLLY_RATE_LIMIT_REST_TOKEN must be configured together');
  if (url && token) return new RedisRestRateLimiter({ url, token, namespace });
  const hosted = !!env.VERCEL || env.LOLLY_MCP_HOSTED === '1' || env.NODE_ENV === 'production';
  if (hosted && env.LOLLY_ALLOW_IN_MEMORY_RATE_LIMIT !== '1') {
    console.warn(`[rate-limit] ${UNCONFIGURED_REASON}`);
    return new UnconfiguredRateLimiter(UNCONFIGURED_REASON);
  }
  return new MemoryRateLimiter();
}

function digestKey(namespace: string, scope: string, subject: string): string {
  return createHash('sha256').update(namespace).update('\0').update(scope).update('\0').update(subject).digest('hex');
}

function normalizeRestUrl(raw: string): string {
  let url: URL;
  try { url = new URL(raw); }
  catch { throw new Error('LOLLY_RATE_LIMIT_REST_URL must be an absolute HTTPS URL'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('LOLLY_RATE_LIMIT_REST_URL must be an HTTPS URL without credentials, query, or fragment');
  }
  return url.toString();
}

function validateBudget(limit: number, windowMs: number): void {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1_000_000) throw new Error('rate limit must be a positive safe integer');
  if (!Number.isSafeInteger(windowMs) || windowMs < 1_000 || windowMs > 24 * 60 * 60 * 1_000) {
    throw new Error('rate-limit window must be between one second and one day');
  }
}

function decision(count: number, limit: number, ttlMs: number): RateLimitDecision {
  return {
    ok: count <= limit,
    retryAfter: count <= limit ? 0 : Math.max(1, Math.ceil(ttlMs / 1_000)),
    remaining: Math.max(0, limit - count),
  };
}
