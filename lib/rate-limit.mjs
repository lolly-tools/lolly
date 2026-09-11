// SPDX-License-Identifier: MPL-2.0
/** Durable fixed-window admission control for the CA's public auth/enrolment routes. */

import { createHash } from 'node:crypto';

const MAX_MEMORY_KEYS = 20_000;
const LUA = [
  "local n = redis.call('INCR', KEYS[1])",
  "if n == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end",
  "local ttl = redis.call('PTTL', KEYS[1])",
  'return {n, ttl}',
].join('\n');

export class RateLimitUnavailableError extends Error {
  constructor(message = 'Durable rate limiter is unavailable') {
    super(message);
    this.name = 'RateLimitUnavailableError';
  }
}

export class MemoryRateLimiter {
  #windows = new Map();
  #now;
  constructor(now = Date.now) { this.#now = now; }

  async consume(scope, subject, limit, windowMs) {
    validateBudget(limit, windowMs);
    const now = this.#now();
    const key = digest('memory', scope, subject);
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

export class RedisRestRateLimiter {
  #url;
  #token;
  #fetch;
  constructor({ url, token, fetchImpl = fetch }) {
    this.#url = normalizeUrl(url);
    this.#token = token;
    this.#fetch = fetchImpl;
  }

  async consume(scope, subject, limit, windowMs) {
    validateBudget(limit, windowMs);
    const key = `lolly:rl:${digest('ca', scope, subject)}`;
    let response;
    try {
      response = await this.#fetch(this.#url, {
        method: 'POST',
        headers: { authorization: `Bearer ${this.#token}`, 'content-type': 'application/json' },
        body: JSON.stringify(['EVAL', LUA, '1', key, String(windowMs)]),
        signal: AbortSignal.timeout(2_500),
      });
    } catch {
      throw new RateLimitUnavailableError();
    }
    if (!response.ok) throw new RateLimitUnavailableError(`Durable rate limiter returned HTTP ${response.status}`);
    let result;
    try { result = (await response.json()).result; }
    catch { throw new RateLimitUnavailableError('Durable rate limiter returned malformed JSON'); }
    if (!Array.isArray(result) || result.length !== 2) throw new RateLimitUnavailableError('Durable rate limiter returned an invalid result');
    const count = Number(result[0]);
    const ttl = Number(result[1]);
    if (!Number.isSafeInteger(count) || count < 1 || !Number.isFinite(ttl)) {
      throw new RateLimitUnavailableError('Durable rate limiter returned invalid counters');
    }
    return decision(count, limit, Math.max(1, ttl));
  }
}

/**
 * A hosted deployment with no durable store configured and no explicit opt-in:
 * every admission fails as unavailable (the handler answers 503 + Retry-After)
 * instead of the function refusing to boot. The boot throw it replaces took
 * /health down with the enrolment routes on 2026-09-10, a wider failure than the
 * policy (no unlimited admission) needed.
 */
export class UnconfiguredRateLimiter {
  #reason;
  constructor(reason) { this.#reason = reason; }

  async consume(scope, subject, limit, windowMs) {
    validateBudget(limit, windowMs);
    throw new RateLimitUnavailableError(this.#reason);
  }
}

export const UNCONFIGURED_REASON =
  'No durable CA rate limiter is configured for this hosted deployment: set CA_RATE_LIMIT_REST_URL + CA_RATE_LIMIT_REST_TOKEN (or the LOLLY_RATE_LIMIT_REST_* pair), or CA_ALLOW_IN_MEMORY_RATE_LIMIT=1 to accept per-instance limiting';

export function createRateLimiter(env) {
  const url = String(env.CA_RATE_LIMIT_REST_URL || env.LOLLY_RATE_LIMIT_REST_URL || '').trim();
  const token = String(env.CA_RATE_LIMIT_REST_TOKEN || env.LOLLY_RATE_LIMIT_REST_TOKEN || '').trim();
  if (!!url !== !!token) throw new Error('CA rate-limit REST URL and token must be configured together');
  if (url && token) return new RedisRestRateLimiter({ url, token });
  const hosted = !!env.VERCEL || env.CA_HOSTED === '1' || env.NODE_ENV === 'production';
  if (hosted && env.CA_ALLOW_IN_MEMORY_RATE_LIMIT !== '1') {
    console.warn(`[ca rate-limit] ${UNCONFIGURED_REASON}`);
    return new UnconfiguredRateLimiter(UNCONFIGURED_REASON);
  }
  return new MemoryRateLimiter();
}

function digest(namespace, scope, subject) {
  return createHash('sha256').update(namespace).update('\0').update(scope).update('\0').update(String(subject)).digest('hex');
}

function normalizeUrl(raw) {
  let url;
  try { url = new URL(raw); }
  catch { throw new Error('CA rate-limit REST URL must be an absolute HTTPS URL'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('CA rate-limit REST URL must be HTTPS without credentials, query, or fragment');
  }
  return url.toString();
}

function validateBudget(limit, windowMs) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1_000_000) throw new Error('rate limit must be a positive safe integer');
  if (!Number.isSafeInteger(windowMs) || windowMs < 1_000 || windowMs > 24 * 60 * 60 * 1_000) {
    throw new Error('rate-limit window must be between one second and one day');
  }
}

function decision(count, limit, ttlMs) {
  return {
    ok: count <= limit,
    retryAfter: count <= limit ? 0 : Math.max(1, Math.ceil(ttlMs / 1_000)),
    remaining: Math.max(0, limit - count),
  };
}
