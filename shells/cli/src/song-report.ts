// SPDX-License-Identifier: MPL-2.0
/**
 * How the CLI tells a person about a rondocode song it rendered (plan 301).
 *
 * A song is code, run in the `vm` execution class (packages/node-shell/src/rondo.ts).
 * Each render gets one stderr note naming that class, and each part the render could
 * not play (a sung part, a live microphone, a sample that stayed in the editor)
 * becomes a recorded warning, so `--strict` fails the run and the `--json` envelope
 * carries the finding's stable code, its parts and the execution class.
 */
import type { ComputedAudioFailure, ComputedAudioRun } from '@lolly-tools/node-shell/audio';
import { note, warn } from './output.ts';

/** A finding's stable code as a CLI warning code: `rondo.part.mic` becomes `RONDO_PART_MIC`. */
export const warningCodeOf = (code: string): string => code.toUpperCase().replace(/[^A-Z0-9]+/g, '_');

/** What ran a song, as the facts a warning or a `--json` result carries. */
export function runFacts(run: ComputedAudioRun): Record<string, unknown> {
  return {
    executionClass: run.run.executionClass,
    source: run.run.source,
    version: run.run.version,
    ...(run.run.seed !== undefined ? { seed: run.run.seed } : {}),
  };
}

/**
 * A reporter for one CLI run. A song analysed twice in one run (a tool's
 * frame-rate guess, then its real pass) is reported once.
 */
export function cliAudioRunReporter(): (run: ComputedAudioRun) => void {
  const seen = new Set<string>();
  return (run) => {
    if (seen.has(run.key)) return;
    seen.add(run.key);
    const facts = runFacts(run);
    const seed = run.run.seed !== undefined ? `, seed ${run.run.seed}` : '';
    note(`Song "${run.name}": ${run.seconds.toFixed(2)} s rendered in the ${run.run.executionClass} execution class (QuickJS in WebAssembly; ${run.run.source} ${run.run.version}${seed}).`);
    for (const f of run.findings) {
      warn(warningCodeOf(f.code), `Song "${run.name}": ${f.message}`, 'usage', { finding: f.code, parts: f.parts, song: run.name, ...facts });
    }
  };
}

/**
 * A song that did not render, as a warning. A tool's hook may catch the error and
 * draw a placeholder; the warning still says which song and why, by stable code.
 */
export function cliAudioFailureReporter(): (failure: ComputedAudioFailure) => void {
  return (failure) => {
    warn(warningCodeOf(failure.code), `Song "${failure.name}" was not rendered: ${failure.message}`, 'usage', {
      failure: failure.code, song: failure.name, source: failure.source,
    });
  };
}
