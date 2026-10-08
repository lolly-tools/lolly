// SPDX-License-Identifier: MPL-2.0
/**
 * The worker thread one rondocode render runs in (the owning side is rondo.ts).
 *
 * A song's code runs in QuickJS inside packages/rondo, the `vm` execution class,
 * and never in this realm. What this thread adds is the wall clock: upstream's
 * DSP render that follows staging is synchronous, so only a thread the parent can
 * terminate puts a bound on that render. One render per thread; the thread ends
 * once its one answer is sent.
 *
 * In: `workerData` as `RondoWorkerJob`. Out: one message, `RondoWorkerReply`.
 * The PCM travels as transferred buffers, so a long render is not copied twice.
 */
import { parentPort, workerData } from 'node:worker_threads';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderRondo } from '@lolly-tools/rondo';
import type { RondoLimits } from '@lolly-tools/rondo/limits';

/**
 * The staging bundle's text, set at build time when this file is bundled for a
 * serverless function (scripts/build-mcp-fn.ts), where packages/rondo is not on
 * disk. Undefined when running from source, which reads the file instead.
 */
declare const __LOLLY_RONDO_STAGE__: string | undefined;

export interface RondoWorkerJob {
  code: string;
  lang: 'js' | 'rondo' | 'auto';
  seconds?: number;
  limits: Partial<RondoLimits>;
}

export type RondoWorkerReply =
  | {
    ok: true;
    sampleRate: number;
    left: Float32Array;
    right: Float32Array;
    seconds: number;
    cycles: number;
    cps: number;
    lang: 'js' | 'rondo';
    normalized: boolean;
    findings: { code: string; message: string; parts: string[] }[];
    run: { executionClass: string; seed: number; upstream: string; adapter: number };
  }
  | { ok: false; code: string; message: string; diagnostics?: { message: string; line?: number; col?: number }[] };

function stageSource(): string {
  if (typeof __LOLLY_RONDO_STAGE__ === 'string') return __LOLLY_RONDO_STAGE__;
  return readFileSync(fileURLToPath(import.meta.resolve('@lolly-tools/rondo/generated/stage.js')), 'utf8');
}

async function main(): Promise<void> {
  const job = workerData as RondoWorkerJob;
  let reply: RondoWorkerReply;
  const transfer: ArrayBuffer[] = [];
  try {
    const pcm = await renderRondo(
      { source: job.code, lang: job.lang, ...(job.seconds !== undefined ? { seconds: job.seconds } : {}) },
      { stageSource, limits: job.limits },
    );
    reply = {
      ok: true,
      sampleRate: pcm.sampleRate,
      left: pcm.left,
      right: pcm.right,
      seconds: pcm.seconds,
      cycles: pcm.cycles,
      cps: pcm.cps,
      lang: pcm.lang,
      normalized: pcm.normalized,
      findings: pcm.findings,
      run: pcm.run,
    };
    for (const ch of [pcm.left, pcm.right]) {
      const buf = ch.buffer as ArrayBuffer;
      if (!transfer.includes(buf)) transfer.push(buf);
    }
  } catch (e) {
    const err = (e ?? {}) as { code?: unknown; message?: unknown; diagnostics?: unknown };
    reply = {
      ok: false,
      // A named rondo error keeps its code; anything else is a fault in the trusted render.
      code: typeof err.code === 'string' && err.code.startsWith('rondo.') ? err.code : 'rondo.render.error',
      message: typeof err.message === 'string' ? err.message.slice(0, 500) : 'the render failed',
      ...(Array.isArray(err.diagnostics) ? { diagnostics: err.diagnostics.slice(0, 20) as { message: string; line?: number; col?: number }[] } : {}),
    };
  }
  parentPort?.postMessage(reply, transfer);
}

await main();
