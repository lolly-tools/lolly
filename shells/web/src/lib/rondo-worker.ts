// SPDX-License-Identifier: MPL-2.0
/**
 * Rondocode render worker. A rondocode song is source code, and it is untrusted
 * wherever it came from, so this worker never runs it in its own realm: it calls
 * packages/rondo's `renderRondo`, which evaluates the song in QuickJS (the `vm`
 * execution class), validates the data that comes back and only then hands it to
 * upstream's fixed DSP. The song gets no host, no network and no storage, and the
 * same function renders the same bytes on the CLI and the MCP server.
 *
 * Why a worker of its own: the native render is synchronous and cannot be
 * stopped from inside the realm. The main-thread client (lib/rondo-render.ts)
 * holds a wall-clock timer per render and terminates this worker when it runs
 * out, which is the only stop that always works. Nothing here keeps state a
 * terminate could corrupt: QuickJS is loaded once per worker, and each render
 * gets a runtime of its own inside that worker.
 *
 * Shaped like mod-worker.ts: one request in, transferable channel buffers out,
 * and a probe that only asks whether the interpreter starts here at all.
 */
import { renderRondo, quickjs } from '@lolly-tools/rondo';
// The staging bundle's text, inlined into this worker's chunk. It is the code that
// runs INSIDE QuickJS (upstream's evaluation core), never in this realm.
import stageSource from '@lolly-tools/rondo/generated/stage.js?raw';

interface RenderRequest {
  id: number;
  probe?: boolean;
  code?: string;
  lang?: 'js' | 'rondo' | 'auto';
  seconds?: number;
}

/** A failure as plain data: the class name, the stable code and any line-level detail. */
interface FailureReply {
  name: string;
  code: string;
  message: string;
  diagnostics?: { message: string; line?: number; col?: number }[];
}

// Worker scope: postMessage here is the DedicatedWorkerGlobalScope overload
// (message, transfer), not Window's. Narrow it so the transfer list type-checks.
const post = postMessage as (message: unknown, transfer: Transferable[]) => void;

function failure(err: unknown): FailureReply {
  const e = (err && typeof err === 'object' ? err : {}) as {
    name?: unknown; code?: unknown; message?: unknown; diagnostics?: unknown;
  };
  const out: FailureReply = {
    name: typeof e.name === 'string' ? e.name : 'Error',
    code: typeof e.code === 'string' ? e.code : 'rondo.error',
    message: typeof e.message === 'string' ? e.message : String(err),
  };
  if (Array.isArray(e.diagnostics)) {
    out.diagnostics = e.diagnostics.slice(0, 20).map((d: unknown) => {
      const o = (d && typeof d === 'object' ? d : {}) as Record<string, unknown>;
      const row: { message: string; line?: number; col?: number } = { message: String(o.message ?? '') };
      if (typeof o.line === 'number') row.line = o.line;
      if (typeof o.col === 'number') row.col = o.col;
      return row;
    });
  }
  return out;
}

addEventListener('message', (e: MessageEvent<RenderRequest>) => {
  const { id, probe, code, lang, seconds } = e.data;
  if (probe || typeof code !== 'string') {
    quickjs().then(
      () => post({ id, ok: true }, []),
      (err: unknown) => post({ id, error: failure(err) }, []),
    );
    return;
  }
  renderRondo({ source: code, lang: lang ?? 'auto', ...(seconds !== undefined ? { seconds } : {}) }, { stageSource }).then(
    (pcm) => post({
      id,
      pcm: {
        left: pcm.left,
        right: pcm.right,
        sampleRate: pcm.sampleRate,
        seconds: pcm.seconds,
        cycles: pcm.cycles,
        cps: pcm.cps,
        lang: pcm.lang,
        normalized: pcm.normalized,
        findings: pcm.findings,
        run: pcm.run,
      },
    }, [pcm.left.buffer, pcm.right.buffer]),
    (err: unknown) => post({ id, error: failure(err) }, []),
  );
});
