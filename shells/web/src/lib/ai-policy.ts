// SPDX-License-Identifier: MPL-2.0
/** Execution policy for the supported shell AI paths. A managed browser needs
 * a fresh member response; persisted org-config never grants an AI lease.
 * This is application enforcement, not a sandbox for arbitrary tool JavaScript. */
export const AI_CAPABILITIES = [
  'speech',
  'transcription',
  'upscale',
  'matte',
  'ocr',
  'depth',
  'reword',
  'ai-detect',
  'embedding',
  'watermark',
] as const;
export type AiCapability = (typeof AI_CAPABILITIES)[number];
type AiScope = AiCapability | 'unclassified';
export interface AiPolicy {
  version: 1;
  enabled: boolean;
  capabilities: AiCapability[];
  maxAgeSeconds: number;
}

export class AiPolicyError extends Error {
  readonly code = 'AI_POLICY_DENIED';
  constructor() {
    super('AI is unavailable under the current service policy.');
    this.name = 'AiPolicyError';
  }
}

/** Monotonic lease clock: moving the device wall clock cannot extend consent. */
export class AiPolicyController {
  private managed: boolean;
  private policy: AiPolicy | null = null;
  private expires = 0;
  private expiresWall = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private listeners = new Set<() => void>();
  private now: () => number;
  constructor(managed = false, now: () => number = () => performance.now()) {
    this.managed = managed;
    this.now = now;
  }

  allowed(capability: AiScope): boolean {
    return (
      !this.managed ||
      (this.policy?.enabled === true &&
        this.now() < this.expires &&
        Date.now() < this.expiresWall &&
        this.policy.capabilities.some((c) => c === capability))
    );
  }
  require(capability: AiScope): void {
    if (!this.allowed(capability)) throw new AiPolicyError();
  }
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  private notify(): void {
    for (const listener of [...this.listeners]) {
      try {
        listener();
      } catch {
        /* one UI observer must not prevent cancellation */
      }
    }
  }
  setManaged(managed: boolean): void {
    clearTimeout(this.timer);
    this.managed = managed;
    this.policy = null;
    this.expires = 0;
    this.notify();
  }
  apply(value: unknown): void {
    clearTimeout(this.timer);
    this.managed = true;
    this.policy = null;
    this.expires = 0;
    if (value && typeof value === 'object') {
      const p = value as Partial<AiPolicy>;
      if (
        p.version === 1 &&
        typeof p.enabled === 'boolean' &&
        Array.isArray(p.capabilities) &&
        p.capabilities.every((c) => AI_CAPABILITIES.includes(c)) &&
        Number.isInteger(p.maxAgeSeconds) &&
        p.maxAgeSeconds! > 0 &&
        p.maxAgeSeconds! <= 60
      ) {
        this.policy = {
          version: 1,
          enabled: p.enabled,
          capabilities: [...p.capabilities],
          maxAgeSeconds: p.maxAgeSeconds!,
        };
        this.expires = this.now() + p.maxAgeSeconds! * 1000;
        // Some platforms pause the monotonic clock during system sleep. Either
        // clock expiring withdraws the lease; rolling wall time back cannot extend it.
        this.expiresWall = Date.now() + p.maxAgeSeconds! * 1000;
        this.timer = setTimeout(() => {
          this.policy = null;
          this.notify();
        }, p.maxAgeSeconds! * 1000);
        (this.timer as unknown as { unref?: () => void }).unref?.();
      }
    }
    this.notify();
  }
}

/** The managed build flag protects FIRST boot too, before Work is reachable.
 * Server render workers can impose a stricter, permanent local ceiling. */
export const requireAiPolicy = import.meta.env?.VITE_REQUIRE_AI_POLICY === 'true';
const renderDisabled = (): boolean =>
  (globalThis as { __LOLLY_AI_DISABLED__?: boolean }).__LOLLY_AI_DISABLED__ === true;
const previouslyManaged = (): boolean => {
  try {
    return localStorage.getItem('lolly:managed-ai:same-origin') === '1';
  } catch {
    return false;
  }
};
// Model workers inherit permission through their guarded parent and are killed
// when that lease ends. They cannot independently renew a member session.
export const aiPolicy = new AiPolicyController(
  ((requireAiPolicy || previouslyManaged()) && typeof document !== 'undefined') || renderDisabled()
);
export const aiAllowed = (capability: AiScope): boolean =>
  !renderDisabled() && aiPolicy.allowed(capability);
export function assertAiAllowed(capability: AiScope): void {
  if (!aiAllowed(capability)) throw new AiPolicyError();
}

/** Offline parts can combine capabilities (speech contains both TTS and STT). */
export function aiOfflinePartAllowed(part: string): boolean {
  if (part === 'speech') return aiAllowed('speech') && aiAllowed('transcription');
  const scopes: Record<string, AiCapability> = {
    upscale: 'upscale',
    matte: 'matte',
    ocr: 'ocr',
    reword: 'reword',
    ask: 'embedding',
    'ai-detect': 'ai-detect',
    verify: 'watermark',
    durable: 'watermark',
  };
  const scope = scopes[part];
  return !scope || aiAllowed(scope);
}

/** Cancellation rejects promptly and suppresses late results. Callers pass the
 * signal to downloads; worker owners terminate execution separately. */
export async function runAi<T>(
  capability: AiScope,
  run: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  assertAiAllowed(capability);
  const ctrl = new AbortController();
  const unsubscribe = aiPolicy.subscribe(() => {
    if (!aiAllowed(capability)) ctrl.abort(new AiPolicyError());
  });
  let rejectAborted: () => void = () => {};
  const aborted = new Promise<never>((_, reject) => {
    rejectAborted = () => reject(ctrl.signal.reason);
    ctrl.signal.addEventListener('abort', rejectAborted, { once: true });
  });
  try {
    const value = await Promise.race([run(ctrl.signal), aborted]);
    assertAiAllowed(capability);
    ctrl.signal.throwIfAborted();
    return value;
  } finally {
    unsubscribe();
    ctrl.signal.removeEventListener('abort', rejectAborted);
  }
}

/** Lazy bridge imports can finish after a policy withdrawal and subsequent
 * re-enable. The original aborted call must never dispatch into that new lease. */
export function callAiApi<T, R>(
  capability: AiCapability,
  load: () => Promise<T>,
  invoke: (api: T, signal: AbortSignal) => Promise<R>
): Promise<R> {
  return runAi(capability, async (signal) => {
    const api = await load();
    signal.throwIfAborted();
    return invoke(api, signal);
  });
}

/** Keep Vite's literal `new Worker(new URL(...))` inside the factory, so the
 * worker remains bundled. Denial occurs before the factory or any postMessage.
 * Revocation uses each client's existing error path to settle pending calls. */
export function guardAiWorker(capability: AiCapability, create: () => Worker): Worker {
  assertAiAllowed(capability);
  const worker = create();
  const terminate = worker.terminate.bind(worker);
  const post = worker.postMessage.bind(worker);
  let stopped = false;
  let unsubscribe = (): void => {};
  worker.terminate = (): void => {
    stopped = true;
    unsubscribe();
    terminate();
  };
  const revoke = (): void => {
    if (stopped) return;
    worker.terminate();
    worker.dispatchEvent(
      new ErrorEvent('error', { error: new AiPolicyError(), message: 'AI_POLICY_DENIED' })
    );
  };
  unsubscribe = aiPolicy.subscribe(() => {
    if (!aiAllowed(capability)) revoke();
  });
  worker.addEventListener(
    'message',
    (event) => {
      if (stopped || !aiAllowed(capability)) {
        event.stopImmediatePropagation();
        revoke();
      }
    },
    { capture: true }
  );
  worker.postMessage = ((
    message: unknown,
    transfer?: Transferable[] | StructuredSerializeOptions
  ): void => {
    if (stopped || !aiAllowed(capability)) {
      revoke();
      // Existing client AbortSignal handlers send this control message before
      // rejecting their promise. Termination already accomplished the abort;
      // throwing here would interrupt that cleanup and leak the pending call.
      if (message && typeof message === 'object' && (message as { type?: string }).type === 'abort')
        return;
      throw new AiPolicyError();
    }
    if (Array.isArray(transfer)) post(message, transfer);
    else post(message, transfer);
  }) as Worker['postMessage'];
  return worker;
}

/** Model directory names used by both IndexedDB fetchers and offline parts.
 * Unknown model families are denied on managed builds until classified. */
export function modelCapability(path: string): AiCapability | null {
  const dir = /(?:^|\/)models\/([^/]+)/.exec(path)?.[1] ?? path.split('/')[0];
  const known: Record<string, AiCapability> = {
    upscale: 'upscale',
    matte: 'matte',
    ocr: 'ocr',
    depth: 'depth',
    kokoro: 'speech',
    whisper: 'transcription',
    reword: 'reword',
    'ai-detect': 'ai-detect',
    embed: 'embedding',
    trustmark: 'watermark',
    contentseal: 'watermark',
  };
  return known[dir ?? ''] ?? null;
}
