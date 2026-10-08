// SPDX-License-Identifier: MPL-2.0
/**
 * The `vm` execution class: a song's code runs in QuickJS compiled to WebAssembly.
 *
 * The document model reserves this class for "an interpreter in WebAssembly or a
 * hardened compartment" (docs/spec/document-model/05-values-and-time.md). This is
 * its first implementation, and what it enforces is stated here and in that chapter:
 *
 *   - No host. The context holds plain ECMAScript and the staging bundle, nothing
 *     else: no fetch, no storage, no DOM, no timers, no module loader, no file
 *     system. Absence is the policy (the `strictHostShape` rule): there is nothing
 *     to call, so nothing needs a check.
 *   - No clock and no entropy. `Date.now()` and `performance.now()` return 0 and
 *     `Math.random()` is a fixed-seed generator, so the same song renders the same
 *     bytes on every host and every run.
 *   - Budgets. A memory limit, a native stack limit and a deadline per phase
 *     (src/limits.ts). A breach ends the run with a named error.
 *   - One runtime per render, disposed afterwards, so one song can never leave
 *     anything behind for the next.
 *   - Refusal, never fallback. If the interpreter cannot start, the render fails;
 *     nothing here runs a song in the caller's realm.
 *   - Data out. The only thing that leaves is a string, which the trusted side
 *     parses and validates (src/staged.ts) before upstream's fixed DSP reads the data.
 */
import {
  newQuickJSWASMModuleFromVariant,
  type QuickJSContext,
  type QuickJSHandle,
  type QuickJSRuntime,
  type QuickJSWASMModule,
} from 'quickjs-emscripten-core';
import RELEASE_SYNC from '@jitl/quickjs-wasmfile-release-sync';
import { RONDO_LIMITS, type RondoLimits } from './limits.ts';

export const EXECUTION_CLASS = 'vm' as const;

/** The fixed seed behind the vm's Math.random, recorded so a receipt can state the seed. */
export const VM_SEED = 0x726f6e64; // "rond"

export class VmError extends Error {
  override name = 'VmError';
  readonly code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}

let modulePromise: Promise<QuickJSWASMModule> | null = null;

/** Load the interpreter once per process or worker. A failed load is retried next time. */
export function quickjs(): Promise<QuickJSWASMModule> {
  modulePromise ??= newQuickJSWASMModuleFromVariant(RELEASE_SYNC).catch((e: unknown) => {
    modulePromise = null;
    throw new VmError(
      `the vm could not start: ${e instanceof Error ? e.message : String(e)}`,
      'rondo.vm.unavailable'
    );
  });
  return modulePromise;
}

const PRELUDE = `(() => {
  const noop = () => {};
  globalThis.console = { log: noop, info: noop, warn: noop, error: noop, debug: noop, trace: noop };
  globalThis.performance = { now: () => 0 };
  Date.now = () => 0;
  let s = ${VM_SEED} >>> 0;
  Math.random = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
})();`;

export interface PreparedSong {
  lang: 'js' | 'rondo';
  cps: number;
  naturalCycles?: number;
  sings: { synth: string; voice: string }[];
  warnings: { message: string; line?: number; col?: number }[];
}

export interface Diagnostic {
  message: string;
  line?: number;
  col?: number;
}

export class SongError extends Error {
  override name = 'SongError';
  readonly code: string;
  readonly diagnostics: Diagnostic[];
  constructor(code: string, diagnostics: Diagnostic[]) {
    super(diagnostics[0]?.message ?? 'the song could not be read');
    this.code = code;
    this.diagnostics = diagnostics;
  }
}

export interface StageRequest {
  source: string;
  lang: 'js' | 'rondo' | 'auto';
  /** The window to schedule: called once the song's tempo is known. */
  window: (prepared: PreparedSong) => { cycles: number; seconds: number };
  /** The staging bundle's text (generated/stage.js). Each shell loads it its own way. */
  stageSource: string;
  limits?: Partial<RondoLimits>;
}

export interface StageResult {
  prepared: PreparedSong;
  cycles: number;
  seconds: number;
  /** The untrusted schedule output, for src/staged.ts. */
  stagedText: string;
}

const clip = (s: unknown, n = 300): string => String(s ?? '').slice(0, n);

function sanitiseDiagnostics(v: unknown, max: number): Diagnostic[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, max).map((d: unknown) => {
    const o = (d && typeof d === 'object' ? d : {}) as Record<string, unknown>;
    const out: Diagnostic = { message: clip(o.message) };
    if (typeof o.line === 'number' && Number.isInteger(o.line)) out.line = o.line;
    if (typeof o.col === 'number' && Number.isInteger(o.col)) out.col = o.col;
    return out;
  });
}

/** Turn a QuickJS exception into a named error. */
function vmFailure(ctx: QuickJSContext, handle: QuickJSHandle, phase: string): VmError {
  let name = '';
  let message = '';
  try {
    const dumped = ctx.dump(handle) as unknown;
    if (dumped && typeof dumped === 'object') {
      name = clip((dumped as Record<string, unknown>).name, 60);
      message = clip((dumped as Record<string, unknown>).message);
    } else message = clip(dumped);
  } catch {
    message = 'the song stopped with an error';
  }
  const text = `${name} ${message}`.toLowerCase();
  if (text.includes('interrupted'))
    return new VmError(`the song ran past its time budget while ${phase}`, 'rondo.vm.timeout');
  if (text.includes('out of memory'))
    return new VmError(`the song ran out of memory while ${phase}`, 'rondo.vm.memory');
  if (text.includes('stack overflow') || text.includes('call stack'))
    return new VmError(`the song recursed too deeply while ${phase}`, 'rondo.vm.stack');
  return new VmError(
    `the song failed while ${phase}: ${name ? `${name}: ` : ''}${message}`,
    'rondo.vm.error'
  );
}

/**
 * Stage one song: evaluate it, then schedule its patterns for the window the
 * caller picks. Returns the untrusted staged text; never returns anything the
 * song's code could have turned into a callable.
 */
export async function stageInVm(req: StageRequest): Promise<StageResult> {
  const lim = { ...RONDO_LIMITS, ...req.limits };
  const mod = await quickjs();
  const rt = mod.newRuntime();
  let ctx: QuickJSContext | null = null;
  try {
    return await stageWith(rt, req, lim, (c) => {
      ctx = c;
    });
  } catch (e) {
    if (e instanceof VmError || e instanceof SongError) throw e;
    // Anything else escaped the interpreter itself (a host stack overflow from
    // deep WebAssembly frames, a trap). The module instance may be inconsistent
    // after that, so it is dropped and the next render loads a fresh one.
    modulePromise = null;
    const msg = e instanceof Error ? e.message : String(e);
    if (/call stack/i.test(msg))
      throw new VmError('the song recursed too deeply', 'rondo.vm.stack');
    throw new VmError(`the vm stopped unexpectedly: ${clip(msg)}`, 'rondo.vm.error');
  } finally {
    try {
      (ctx as QuickJSContext | null)?.dispose();
      rt.dispose();
    } catch {
      // A runtime that hit its memory limit can fail to tear down cleanly; the
      // module itself stays usable and the next render gets a fresh runtime.
    }
  }
}

async function stageWith(
  rt: QuickJSRuntime,
  req: StageRequest,
  lim: RondoLimits,
  own: (ctx: QuickJSContext) => void
): Promise<StageResult> {
  rt.setMemoryLimit(lim.vmMemoryBytes);
  rt.setMaxStackSize(lim.vmStackBytes);
  let deadline = Date.now() + lim.prepareBudgetMs;
  rt.setInterruptHandler(() => Date.now() > deadline);
  const c = rt.newContext();
  own(c);

  const run = (code: string, file: string, phase: string): void => {
    const r = c.evalCode(code, file);
    if (r.error) {
      const err = vmFailure(c, r.error, phase);
      r.error.dispose();
      throw err;
    }
    r.value.dispose();
  };
  run(PRELUDE, 'prelude.js', 'starting');
  run(req.stageSource, 'rondo-stage.js', 'loading');

  // Take the two entry points before the song runs, so a song that rewrites
  // the staging global cannot swap them. (It could still corrupt what they
  // return; src/staged.ts assumes it did.)
  const ns = c.getProp(c.global, '__rondoStage');
  const prepareFn = c.getProp(ns, 'prepare');
  const scheduleFn = c.getProp(ns, 'schedule');
  ns.dispose();
  try {
    const call = (fn: QuickJSHandle, phase: string, ...args: QuickJSHandle[]): string => {
      const r = c.callFunction(fn, c.undefined, ...args);
      for (const a of args) a.dispose();
      if (r.error) {
        const err = vmFailure(c, r.error, phase);
        r.error.dispose();
        throw err;
      }
      try {
        if (c.typeof(r.value) !== 'string')
          throw new VmError(
            `the song returned something other than text while ${phase}`,
            'rondo.vm.error'
          );
        return c.getString(r.value);
      } finally {
        r.value.dispose();
      }
    };

    const prepText = call(prepareFn, 'reading it', c.newString(req.source), c.newString(req.lang));
    if (prepText.length > 1_000_000)
      throw new VmError('the song returned an oversized summary', 'rondo.vm.error');
    let prep: Record<string, unknown>;
    try {
      prep = JSON.parse(prepText) as Record<string, unknown>;
    } catch {
      throw new VmError('the song returned an unreadable summary', 'rondo.vm.error');
    }
    if (!prep || typeof prep !== 'object' || prep.ok !== true) {
      const diagnostics = sanitiseDiagnostics(prep?.diagnostics, lim.maxDiagnostics);
      // Upstream's evalCode catches what the song throws, QuickJS's own
      // out-of-memory and stack errors included, and returns them as
      // diagnostics. Those two are budget breaches, so they keep their names.
      const first = (diagnostics[0]?.message ?? '').toLowerCase();
      if (first.includes('out of memory'))
        throw new VmError('the song ran out of memory while reading it', 'rondo.vm.memory');
      if (first.includes('stack overflow'))
        throw new VmError('the song recursed too deeply while reading it', 'rondo.vm.stack');
      throw new SongError(
        prep?.phase === 'compile' ? 'rondo.compile' : 'rondo.evaluate',
        diagnostics
      );
    }
    const cps = prep.cps;
    if (typeof cps !== 'number' || !Number.isFinite(cps) || cps < 0.05 || cps > 4) {
      throw new VmError('the song reported an impossible tempo', 'rondo.vm.error');
    }
    const nc = prep.naturalCycles;
    const prepared: PreparedSong = {
      lang: prep.lang === 'rondo' ? 'rondo' : 'js',
      cps,
      sings: Array.isArray(prep.sings)
        ? prep.sings.slice(0, 64).map((s: unknown) => {
            const o = (s && typeof s === 'object' ? s : {}) as Record<string, unknown>;
            return { synth: clip(o.synth, 128), voice: clip(o.voice, 64) };
          })
        : [],
      warnings: sanitiseDiagnostics(prep.warnings, lim.maxDiagnostics),
    };
    if (typeof nc === 'number' && Number.isInteger(nc) && nc > 0 && nc <= 100_000)
      prepared.naturalCycles = nc;

    const { cycles, seconds } = req.window(prepared);
    deadline = Date.now() + lim.scheduleBaseMs + seconds * lim.scheduleMsPerSecond;
    const stagedText = call(scheduleFn, 'scheduling its patterns', c.newNumber(cycles));
    return { prepared, cycles, seconds, stagedText };
  } finally {
    prepareFn.dispose();
    scheduleFn.dispose();
  }
}
