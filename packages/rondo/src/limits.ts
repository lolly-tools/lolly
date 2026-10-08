// SPDX-License-Identifier: MPL-2.0
/**
 * The limits a rondocode render runs under, as data.
 *
 * The document model asks a host to report what it can do as numbers rather than
 * as a yes or a no (docs/spec/document-model/09-extensions.md, "Capabilities are
 * data with limits"), so these are exported for a capability report to read, and a
 * render outside them is refused by name rather than attempted.
 *
 * Two groups. The `vm` numbers bound the song's own code, which is untrusted: it
 * runs in QuickJS with this much memory, this much stack and this much time. The
 * staged numbers bound the DATA that code hands back, which is just as untrusted:
 * the song shares a realm with the staging code and can rewrite JSON, Array or
 * anything else before the result is serialised, so every count the trusted DSP
 * would allocate or loop over is checked here before it runs.
 */

export const RONDO_LIMITS = Object.freeze({
  /** Largest song source accepted, in UTF-8 bytes. The largest upstream example is under 20 KB. */
  maxSourceBytes: 256 * 1024,
  /** Longest render, in seconds. */
  maxSeconds: 600,
  /** Output sample rate. Fixed, because the byte-identity tests are pinned to this rate. */
  sampleRate: 48000,
  /** Length when nothing asks for one and the song has no arrangement: upstream's own bounce default. */
  defaultCycles: 8,

  /** QuickJS heap for one staging run. */
  vmMemoryBytes: 128 * 1024 * 1024,
  /**
   * QuickJS's own stack check. Kept well under the host's native stack, which the
   * WebAssembly frames also use: set too high, a runaway recursion overflows the
   * host first and escapes as a host error instead of a QuickJS one.
   */
  vmStackBytes: 512 * 1024,
  /** Time to load the staging bundle and evaluate the song. */
  prepareBudgetMs: 15_000,
  /** Time to schedule the patterns: a base plus this much per second of audio. */
  scheduleBaseMs: 10_000,
  scheduleMsPerSecond: 400,

  /** Largest staged result accepted from the vm, in UTF-16 code units. */
  maxStagedChars: 48 * 1024 * 1024,
  maxSynths: 64,
  maxBuses: 32,
  maxSends: 2048,
  maxNodesPerGraph: 2048,
  maxParamsPerGraph: 512,
  maxVoices: 32,
  maxEvents: 4_000_000,
  /** Numbers anywhere in one node's config, wavetable frames included. */
  maxConfigNumbers: 1_000_000,
  maxConfigDepth: 8,
  maxStringChars: 8192,
  /**
   * Upper bound on (voices x nodes) summed over every synth plus every bus graph.
   * Render time grows with it, so it is the CPU budget for one render.
   */
  maxVoiceNodes: 60_000,
  /** Diagnostics kept from a failed compile or evaluation. */
  maxDiagnostics: 20,
});

export type RondoLimits = { readonly [K in keyof typeof RONDO_LIMITS]: number };
