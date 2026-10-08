// SPDX-License-Identifier: MPL-2.0
/**
 * The staging bundle's entry. Bundled by scripts/build-rondo.ts into
 * generated/stage.js and evaluated ONLY inside QuickJS (src/vm.ts).
 *
 * Everything in here runs next to the song's own code, in the same realm, so none
 * of it is trusted by the caller: its output is a string the trusted side parses
 * and validates from scratch (src/wire.ts, src/staged.ts).
 *
 * Two calls, one deadline per phase: `prepare` compiles and evaluates
 * the song (a loop at the top level stops here), `schedule` queries the patterns
 * for a number of cycles (a loop inside a pattern function stops there).
 *
 * Upstream's own headless path is used verbatim (render-runner's stageCode and
 * runPatterns), which is what makes a vm render byte-identical to upstream's.
 */
import { compile } from '../upstream/packages/rondo/src/index';
import { stageCode, runPatterns } from '../upstream/packages/server/src/render-runner';
import { getCustomWavetables } from '../upstream/packages/engine/src/dsp/wavetable';
import { replacer } from './wire';

type Staged = Extract<ReturnType<typeof stageCode>, { ok: true }>;

let staged: Staged | null = null;

const diag = (d: { message?: unknown; line?: unknown; col?: unknown }) => ({
  message: String(d.message ?? ''),
  line: typeof d.line === 'number' ? d.line : undefined,
  col: typeof d.col === 'number' ? d.col : undefined,
});

export function prepare(source: string, lang: string): string {
  staged = null;
  if (lang !== 'rondo' && lang !== 'auto') return prepareJs(source, undefined, 'js');
  const c = compile(source);
  // 'auto' is upstream's own sniff (session/projects.ts): a rondo document
  // compiles as rondo and a JavaScript one does not.
  if (lang === 'auto' && (!c.ok || c.code == null)) return prepareJs(source, undefined, 'js');
  if (!c.ok || c.code == null) {
    return JSON.stringify({ ok: false, phase: 'compile', diagnostics: c.errors.map(diag) });
  }
  // An arranged song states its own length: the slots loop over their total.
  const naturalCycles = c.arrangement ? c.arrangement.slots.reduce((sum, s) => sum + s.len, 0) : undefined;
  return prepareJs(c.code, naturalCycles, 'rondo');
}

function prepareJs(code: string, naturalCycles: number | undefined, lang: 'js' | 'rondo'): string {
  const s = stageCode(code);
  if (!s.ok) return JSON.stringify({ ok: false, phase: 'evaluate', diagnostics: s.diagnostics.map(diag) });
  staged = s;
  return JSON.stringify({
    ok: true,
    lang,
    cps: s.cps ?? 0.5,
    naturalCycles,
    sings: s.sings.map((r) => ({ synth: r.synthName, voice: r.voice })),
    warnings: s.warnings.map(diag),
  });
}

export function schedule(cycles: number): string {
  const s = staged;
  if (!s) return JSON.stringify({ ok: false, phase: 'schedule', diagnostics: [{ message: 'nothing was prepared' }] });
  const cps = s.cps ?? 0.5;
  const events = runPatterns(s.patterns, { cycles, cps });
  // nodeLocs is editor-only metadata (upstream builder.ts says so); it never reaches the DSP.
  const synths = new Map([...s.synths].map(([name, def]) => {
    const { nodeLocs: _locs, ...rest } = def;
    return [name, rest] as const;
  }));
  return JSON.stringify({
    ok: true,
    cps,
    synths,
    events,
    buses: s.buses,
    sends: s.sends,
    sidechain: s.sidechain,
    masterComp: s.masterComp,
    masterGain: s.masterGain,
    stereo: s.stereo,
    // Custom tables live in the eval realm's registry, which the trusted render
    // cannot see, so they cross as data (upstream threads them the same way to
    // an offline ctx through renderOffline's `wavetables` option).
    wavetables: Object.fromEntries(getCustomWavetables()),
  }, replacer);
}
