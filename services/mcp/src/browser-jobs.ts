// SPDX-License-Identifier: MPL-2.0

export class BrowserQueueFullError extends Error {
  readonly code = 'browser-queue-full';
  constructor(message = 'Browser render queue is full') {
    super(message);
    this.name = 'BrowserQueueFullError';
  }
}

export class BrowserQueueTimeoutError extends Error {
  readonly code = 'browser-queue-timeout';
  constructor(message = 'Browser render queue wait timed out') {
    super(message);
    this.name = 'BrowserQueueTimeoutError';
  }
}

interface WaitingJob {
  start: () => void;
  reject: (error: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
}

/** A bounded process-wide queue for the expensive Chromium tier. */
export class BrowserJobQueue {
  readonly maxConcurrent: number;
  readonly maxQueued: number;
  readonly waitTimeoutMs: number;
  #active = 0;
  readonly #waiting: WaitingJob[] = [];

  constructor(options: { maxConcurrent: number; maxQueued: number; waitTimeoutMs: number }) {
    for (const [name, value] of Object.entries(options)) {
      if (!Number.isSafeInteger(value) || value < 1) throw new TypeError(`${name} must be a positive integer`);
    }
    this.maxConcurrent = options.maxConcurrent;
    this.maxQueued = options.maxQueued;
    this.waitTimeoutMs = options.waitTimeoutMs;
  }

  get active(): number { return this.#active; }
  get queued(): number { return this.#waiting.length; }

  async run<T>(job: () => Promise<T>): Promise<T> {
    await this.#acquire();
    try {
      return await job();
    } finally {
      this.#release();
    }
  }

  #acquire(): Promise<void> {
    if (this.#active < this.maxConcurrent) {
      this.#active += 1;
      return Promise.resolve();
    }
    if (this.#waiting.length >= this.maxQueued) return Promise.reject(new BrowserQueueFullError());
    return new Promise((resolve, reject) => {
      const waiting: WaitingJob = {
        reject,
        timer: setTimeout(() => {
          const index = this.#waiting.indexOf(waiting);
          if (index < 0) return;
          this.#waiting.splice(index, 1);
          reject(new BrowserQueueTimeoutError());
        }, this.waitTimeoutMs),
        start: () => {
          clearTimeout(waiting.timer);
          this.#active += 1;
          resolve();
        },
      };
      this.#waiting.push(waiting);
    });
  }

  #release(): void {
    this.#active -= 1;
    this.#waiting.shift()?.start();
  }
}

function envInt(env: NodeJS.ProcessEnv, name: string, fallback: number, max: number): number {
  const raw = env[name];
  if (raw == null || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1 || value > max) {
    throw new Error(`${name} must be an integer between 1 and ${max}`);
  }
  return value;
}

export function browserQueueOptions(env: NodeJS.ProcessEnv = process.env): {
  maxConcurrent: number;
  maxQueued: number;
  waitTimeoutMs: number;
} {
  return {
    maxConcurrent: envInt(env, 'LOLLY_BROWSER_MAX_CONCURRENCY', 2, 32),
    maxQueued: envInt(env, 'LOLLY_BROWSER_MAX_QUEUE', 16, 1_000),
    waitTimeoutMs: envInt(env, 'LOLLY_BROWSER_QUEUE_TIMEOUT_MS', 30_000, 600_000),
  };
}
