// SPDX-License-Identifier: MPL-2.0
/**
 * A daily ceiling on what this function may spend: CPU time and response bytes,
 * counted per UTC day. The rate limits bound how fast one caller may ask; this
 * bounds the total, however many callers there are, so a public deployment has
 * a worst-case bill that is known in advance.
 *
 * CPU is measured, not estimated: each record adds the process CPU used since
 * the previous record (process.cpuUsage, which counts every thread, so resvg's
 * native work is included). Concurrent requests are therefore never counted
 * twice, and cold-start and idle work is counted too, because the platform
 * bills that work as well. Bytes are the response bodies the metered routes send.
 *
 * Where the totals live follows the rate limiter: the same Redis-compatible
 * REST store when one is configured (one total for every instance), otherwise
 * this process alone (per instance, which is weaker and said so at start).
 *
 * The answer is cached for CHECK_TTL_MS, so a busy instance reads the store a
 * few times a minute rather than once a request. The overshoot that allows is
 * a few seconds of one instance's work.
 */

import { RateLimitUnavailableError, restStoreConfig } from './rate-limit.ts';

export interface BudgetState {
  ok: boolean;
  /** Which ceiling was reached, when one was. */
  reached?: 'cpu' | 'egress';
  /** Seconds until the next UTC day, when a ceiling was reached. */
  retryAfter: number;
}

export interface UsageBudget {
  /** May a metered request start now? Throws RateLimitUnavailableError when the store cannot answer. */
  check(): Promise<BudgetState>;
  /** Add the CPU used since the last record, plus `egressBytes`. Never throws. */
  record(egressBytes: number): Promise<void>;
}

export interface BudgetLimits {
  /** CPU milliseconds per UTC day. 0 means no ceiling. */
  cpuMs: number;
  /** Response bytes per UTC day. 0 means no ceiling. */
  egressBytes: number;
}

/** Hosted defaults: four CPU-minutes and 1 GB a day. Sized to fit a Vercel Hobby
 *  team, whose whole month includes 4 CPU-hours and 100 GB of transfer and whose
 *  functions pause once either runs out: this spends at most about half the CPU
 *  and a third of the transfer, leaving the rest for the site. A typical render
 *  costs 0.1 to 0.3 s. Raise both with the env vars on a larger plan. */
export const HOSTED_CPU_SECONDS_PER_DAY = 240;
export const HOSTED_EGRESS_MB_PER_DAY = 1024;
const CHECK_TTL_MS = 5_000;
const KEY_TTL_SECONDS = 2 * 24 * 60 * 60;

type Clock = () => number;
type CpuClock = () => number;

const processCpuMs: CpuClock = () => {
  const u = process.cpuUsage();
  return (u.user + u.system) / 1000;
};

export function utcDay(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

export function secondsToNextUtcDay(now: number): number {
  const next = new Date(now);
  next.setUTCHours(24, 0, 0, 0);
  return Math.max(1, Math.ceil((next.getTime() - now) / 1000));
}

function limitFromEnv(raw: string | undefined, fallback: number, scale: number): number {
  if (raw == null || raw.trim() === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) throw new Error('usage budget values must be non-negative numbers');
  return Math.round(n * scale);
}

/** The limits this deployment runs with. Hosted deployments get the defaults
 *  above; a local server has no ceiling unless one is set. */
export function budgetLimits(env: NodeJS.ProcessEnv): BudgetLimits {
  const hosted = !!env.VERCEL || env.LOLLY_MCP_HOSTED === '1' || env.NODE_ENV === 'production';
  return {
    cpuMs: limitFromEnv(env.LOLLY_BUDGET_CPU_SECONDS_PER_DAY, hosted ? HOSTED_CPU_SECONDS_PER_DAY * 1000 : 0, 1000),
    egressBytes: limitFromEnv(env.LOLLY_BUDGET_EGRESS_MB_PER_DAY, hosted ? HOSTED_EGRESS_MB_PER_DAY * 1024 * 1024 : 0, 1024 * 1024),
  };
}

abstract class MeteredBudget implements UsageBudget {
  protected readonly limits: BudgetLimits;
  protected readonly now: Clock;
  readonly #cpu: CpuClock;
  #lastCpu: number;
  #cached: { state: BudgetState; until: number } | null = null;

  constructor(limits: BudgetLimits, now: Clock, cpu: CpuClock) {
    this.limits = limits;
    this.now = now;
    this.#cpu = cpu;
    this.#lastCpu = cpu();
  }

  protected abstract totals(day: string): Promise<{ cpuMs: number; egressBytes: number }>;
  protected abstract add(day: string, cpuMs: number, egressBytes: number): Promise<{ cpuMs: number; egressBytes: number }>;

  #judge(totals: { cpuMs: number; egressBytes: number }, now: number): BudgetState {
    const { cpuMs, egressBytes } = this.limits;
    const reached = cpuMs > 0 && totals.cpuMs >= cpuMs ? 'cpu' as const
      : egressBytes > 0 && totals.egressBytes >= egressBytes ? 'egress' as const
      : undefined;
    return reached ? { ok: false, reached, retryAfter: secondsToNextUtcDay(now) } : { ok: true, retryAfter: 0 };
  }

  async check(): Promise<BudgetState> {
    if (!this.limits.cpuMs && !this.limits.egressBytes) return { ok: true, retryAfter: 0 };
    const now = this.now();
    if (this.#cached && this.#cached.until > now) return this.#cached.state;
    const state = this.#judge(await this.totals(utcDay(now)), now);
    this.#cached = { state, until: now + CHECK_TTL_MS };
    return state;
  }

  async record(egressBytes: number): Promise<void> {
    if (!this.limits.cpuMs && !this.limits.egressBytes) return;
    const cpuNow = this.#cpu();
    const cpuMs = Math.max(0, Math.round(cpuNow - this.#lastCpu));
    this.#lastCpu = cpuNow;
    const bytes = Math.max(0, Math.round(egressBytes));
    const now = this.now();
    try {
      const totals = await this.add(utcDay(now), cpuMs, bytes);
      // A record that crosses a ceiling closes the door at once, not a check later.
      const state = this.#judge(totals, now);
      if (!state.ok) this.#cached = { state, until: now + CHECK_TTL_MS };
    } catch (error) {
      console.warn(`[usage-budget] could not record usage: ${(error as Error).message}`);
    }
  }
}

export class MemoryUsageBudget extends MeteredBudget {
  readonly #days = new Map<string, { cpuMs: number; egressBytes: number }>();

  constructor(limits: BudgetLimits, now: Clock = Date.now, cpu: CpuClock = processCpuMs) {
    super(limits, now, cpu);
  }

  protected async totals(day: string): Promise<{ cpuMs: number; egressBytes: number }> {
    return this.#days.get(day) ?? { cpuMs: 0, egressBytes: 0 };
  }

  protected async add(day: string, cpuMs: number, egressBytes: number): Promise<{ cpuMs: number; egressBytes: number }> {
    for (const key of this.#days.keys()) if (key !== day) this.#days.delete(key);
    const t = this.#days.get(day) ?? { cpuMs: 0, egressBytes: 0 };
    t.cpuMs += cpuMs;
    t.egressBytes += egressBytes;
    this.#days.set(day, t);
    return { ...t };
  }
}

const ADD_LUA = [
  "local c = redis.call('INCRBY', KEYS[1], ARGV[1])",
  "local e = redis.call('INCRBY', KEYS[2], ARGV[2])",
  "if redis.call('TTL', KEYS[1]) < 0 then redis.call('EXPIRE', KEYS[1], ARGV[3]) end",
  "if redis.call('TTL', KEYS[2]) < 0 then redis.call('EXPIRE', KEYS[2], ARGV[3]) end",
  'return {c, e}',
].join('\n');

export class RedisRestUsageBudget extends MeteredBudget {
  readonly #url: string;
  readonly #token: string;
  readonly #namespace: string;
  readonly #fetch: typeof fetch;

  constructor(options: {
    url: string; token: string; namespace: string; limits: BudgetLimits;
    fetchImpl?: typeof fetch; now?: Clock; cpu?: CpuClock;
  }) {
    super(options.limits, options.now ?? Date.now, options.cpu ?? processCpuMs);
    this.#url = options.url;
    this.#token = options.token;
    this.#namespace = options.namespace;
    this.#fetch = options.fetchImpl ?? fetch;
  }

  #keys(day: string): [string, string] {
    return [`lolly:budget:${this.#namespace}:${day}:cpu-ms`, `lolly:budget:${this.#namespace}:${day}:egress-bytes`];
  }

  async #command(body: unknown[]): Promise<unknown> {
    let response: Response;
    try {
      response = await this.#fetch(this.#url, {
        method: 'POST',
        headers: { authorization: `Bearer ${this.#token}`, 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(2_500),
      });
    } catch {
      throw new RateLimitUnavailableError('Usage budget store is unavailable');
    }
    if (!response.ok) throw new RateLimitUnavailableError(`Usage budget store returned HTTP ${response.status}`);
    try { return (await response.json() as { result?: unknown }).result; }
    catch { throw new RateLimitUnavailableError('Usage budget store returned malformed JSON'); }
  }

  protected async totals(day: string): Promise<{ cpuMs: number; egressBytes: number }> {
    const result = await this.#command(['MGET', ...this.#keys(day)]);
    if (!Array.isArray(result) || result.length !== 2) throw new RateLimitUnavailableError('Usage budget store returned an invalid result');
    return { cpuMs: Number(result[0] ?? 0) || 0, egressBytes: Number(result[1] ?? 0) || 0 };
  }

  protected async add(day: string, cpuMs: number, egressBytes: number): Promise<{ cpuMs: number; egressBytes: number }> {
    const result = await this.#command(['EVAL', ADD_LUA, '2', ...this.#keys(day), String(cpuMs), String(egressBytes), String(KEY_TTL_SECONDS)]);
    if (!Array.isArray(result) || result.length !== 2) throw new RateLimitUnavailableError('Usage budget store returned an invalid result');
    return { cpuMs: Number(result[0]) || 0, egressBytes: Number(result[1]) || 0 };
  }
}

export function createUsageBudget(env: NodeJS.ProcessEnv, namespace = 'mcp'): UsageBudget {
  const limits = budgetLimits(env);
  const store = restStoreConfig(env);
  if (store) return new RedisRestUsageBudget({ ...store, namespace, limits });
  if (limits.cpuMs || limits.egressBytes) {
    const hosted = !!env.VERCEL || env.LOLLY_MCP_HOSTED === '1' || env.NODE_ENV === 'production';
    if (hosted) console.warn('[usage-budget] no durable store is configured, so the daily budget is counted per instance');
  }
  return new MemoryUsageBudget(limits);
}

/** The refusal body and headers every metered route answers with. */
export function budgetRefusal(state: BudgetState): { status: 503; headers: Record<string, string>; json: { error: string; error_description: string } } {
  const what = state.reached === 'egress' ? 'data transfer' : 'compute';
  return {
    status: 503,
    headers: { 'retry-after': String(state.retryAfter), 'cache-control': 'no-store' },
    json: {
      error: 'daily_budget_reached',
      error_description: `This public endpoint has used its ${what} budget for today. It resets at 00:00 UTC. `
        + 'For unlimited use, run Lolly yourself: the CLI or a local MCP server (https://github.com/lolly-tools/lolly).',
    },
  };
}
