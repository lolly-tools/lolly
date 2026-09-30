// SPDX-License-Identifier: MPL-2.0
/**
 * The daily usage budget (src/usage-budget.ts): CPU and response bytes per UTC
 * day, counted from the process CPU clock, refused with the time to the next day.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MemoryUsageBudget, RedisRestUsageBudget, budgetLimits, createUsageBudget,
  secondsToNextUtcDay, HOSTED_CPU_SECONDS_PER_DAY,
} from '../src/usage-budget.ts';
import { RateLimitUnavailableError, restStoreConfig } from '../src/rate-limit.ts';

const NOON = Date.UTC(2026, 8, 30, 12, 0, 0);

test('limits: hosted defaults, local has none, env overrides, 0 turns a ceiling off', () => {
  assert.deepEqual(budgetLimits({}), { cpuMs: 0, egressBytes: 0 });
  const hosted = budgetLimits({ VERCEL: '1' });
  assert.equal(hosted.cpuMs, HOSTED_CPU_SECONDS_PER_DAY * 1000);
  assert.ok(hosted.egressBytes > 0);
  assert.deepEqual(budgetLimits({ VERCEL: '1', LOLLY_BUDGET_CPU_SECONDS_PER_DAY: '0', LOLLY_BUDGET_EGRESS_MB_PER_DAY: '1' }), { cpuMs: 0, egressBytes: 1024 * 1024 });
  assert.throws(() => budgetLimits({ LOLLY_BUDGET_CPU_SECONDS_PER_DAY: '-1' }), /non-negative/);
});

test('CPU is the process clock since the last record, and a crossed ceiling refuses until the next UTC day', async () => {
  let now = NOON;
  let cpu = 0;
  const budget = new MemoryUsageBudget({ cpuMs: 1000, egressBytes: 0 }, () => now, () => cpu);
  assert.equal((await budget.check()).ok, true);
  cpu += 600; await budget.record(0);
  now += 10_000;
  assert.equal((await budget.check()).ok, true);
  cpu += 600; await budget.record(0);
  const refused = await budget.check();
  assert.equal(refused.ok, false);
  assert.equal(refused.reached, 'cpu');
  assert.equal(refused.retryAfter, 12 * 60 * 60 - 10);
  now = Date.UTC(2026, 9, 1, 0, 0, 10);
  assert.equal((await budget.check()).ok, true, 'a new UTC day starts from zero');
});

test('egress is its own ceiling', async () => {
  let now = NOON;
  const budget = new MemoryUsageBudget({ cpuMs: 0, egressBytes: 100 }, () => now, () => 0);
  await budget.record(150);
  now += 10_000;
  const state = await budget.check();
  assert.equal(state.ok, false);
  assert.equal(state.reached, 'egress');
});

test('seconds to the next UTC day', () => {
  assert.equal(secondsToNextUtcDay(Date.UTC(2026, 8, 30, 23, 59, 59)), 1);
  assert.equal(secondsToNextUtcDay(NOON), 43_200);
});

test('the REST budget reads with MGET and adds with one EVAL, and a store failure is "unavailable"', async () => {
  const sent: unknown[][] = [];
  let totals = [null, null] as unknown[];
  const fetchImpl = (async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as unknown[];
    sent.push(body);
    if (body[0] === 'MGET') return new Response(JSON.stringify({ result: totals }));
    totals = [String(Number(body[5])), String(Number(body[6]))];
    return new Response(JSON.stringify({ result: [Number(body[5]), Number(body[6])] }));
  }) as typeof fetch;
  let cpu = 0;
  const budget = new RedisRestUsageBudget({ url: 'https://store.example.test', token: 't', namespace: 'mcp', limits: { cpuMs: 500, egressBytes: 0 }, fetchImpl, now: () => NOON, cpu: () => cpu });
  assert.equal((await budget.check()).ok, true);
  assert.deepEqual(sent[0], ['MGET', 'lolly:budget:mcp:2026-09-30:cpu-ms', 'lolly:budget:mcp:2026-09-30:egress-bytes']);
  cpu = 700; await budget.record(42);
  assert.equal(sent[1]![0], 'EVAL');
  assert.deepEqual(sent[1]!.slice(2, 7), ['2', 'lolly:budget:mcp:2026-09-30:cpu-ms', 'lolly:budget:mcp:2026-09-30:egress-bytes', '700', '42']);
  assert.equal((await budget.check()).ok, false, 'the record that crossed the ceiling closes the door at once');

  const broken = new RedisRestUsageBudget({ url: 'https://store.example.test', token: 't', namespace: 'mcp', limits: { cpuMs: 1, egressBytes: 0 }, fetchImpl: (async () => new Response('no', { status: 500 })) as typeof fetch });
  await assert.rejects(broken.check(), RateLimitUnavailableError);
  await broken.record(1); // never throws
});

test('store config: LOLLY_* first, then the Upstash integration names, each read as a pair', () => {
  assert.equal(restStoreConfig({}), null);
  assert.deepEqual(restStoreConfig({ UPSTASH_REDIS_REST_URL: 'https://u', UPSTASH_REDIS_REST_TOKEN: 'ut' }), { url: 'https://u', token: 'ut' });
  assert.deepEqual(restStoreConfig({ KV_REST_API_URL: 'https://k', KV_REST_API_TOKEN: 'kt' }), { url: 'https://k', token: 'kt' });
  assert.deepEqual(restStoreConfig({ LOLLY_RATE_LIMIT_REST_URL: 'https://l', LOLLY_RATE_LIMIT_REST_TOKEN: 'lt', KV_REST_API_URL: 'https://k', KV_REST_API_TOKEN: 'kt' }), { url: 'https://l', token: 'lt' });
  assert.throws(() => restStoreConfig({ UPSTASH_REDIS_REST_URL: 'https://u' }), /configured together/);
  assert.ok(createUsageBudget({ UPSTASH_REDIS_REST_URL: 'https://u.example.test', UPSTASH_REDIS_REST_TOKEN: 'ut' }) instanceof RedisRestUsageBudget);
});
