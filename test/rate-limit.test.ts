// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createRateLimiter,
  MemoryRateLimiter,
  RateLimitUnavailableError,
  RedisRestRateLimiter,
} from '../src/rate-limit.ts';

test('memory limiter separates subjects and resets fixed windows', async () => {
  let now = 1_000;
  const limiter = new MemoryRateLimiter(() => now);
  assert.equal((await limiter.consume('render', 'a', 1, 1_000)).ok, true);
  const denied = await limiter.consume('render', 'a', 1, 1_000);
  assert.equal(denied.ok, false);
  assert.equal(denied.retryAfter, 1);
  assert.equal((await limiter.consume('render', 'b', 1, 1_000)).ok, true);
  now += 1_001;
  assert.equal((await limiter.consume('render', 'a', 1, 1_000)).ok, true);
});

test('Redis REST limiter uses atomic EVAL and hashes the raw subject', async () => {
  let requestBody = '';
  let authorization = '';
  const limiter = new RedisRestRateLimiter({
    url: 'https://limit.example.test',
    token: 'store-token',
    namespace: 'test',
    fetchImpl: (async (_url: string | URL | Request, init?: RequestInit) => {
      requestBody = String(init?.body ?? '');
      authorization = new Headers(init?.headers).get('authorization') ?? '';
      return new Response(JSON.stringify({ result: [3, 42_000] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as typeof fetch,
  });
  const result = await limiter.consume('oauth', 'sensitive@example.test', 2, 60_000);
  assert.equal(result.ok, false);
  assert.equal(result.retryAfter, 42);
  assert.equal(authorization, 'Bearer store-token');
  assert.match(requestBody, /"EVAL"/);
  assert.doesNotMatch(requestBody, /sensitive@example\.test/);
});

test('hosted gateways require the durable pair and fail closed when it is unavailable', async () => {
  // No store and no opt-in: the limiter is constructed (the function boots) but
  // admits nothing - every consume is "unavailable", which the gateway maps to 503.
  const unconfigured = createRateLimiter({ VERCEL: '1' });
  await assert.rejects(unconfigured.consume('render', '10.0.0.1', 1, 60_000), /no durable rate limiter is configured/i);
  assert.throws(
    () => createRateLimiter({ LOLLY_RATE_LIMIT_REST_URL: 'https://limit.example.test' }),
    /configured together/,
  );
  assert.doesNotThrow(() => createRateLimiter({ VERCEL: '1', LOLLY_ALLOW_IN_MEMORY_RATE_LIMIT: '1' }));

  const limiter = new RedisRestRateLimiter({
    url: 'https://limit.example.test',
    token: 'token',
    namespace: 'test',
    fetchImpl: (async () => { throw new Error('offline'); }) as typeof fetch,
  });
  await assert.rejects(limiter.consume('render', 'a', 1, 1_000), RateLimitUnavailableError);
});
