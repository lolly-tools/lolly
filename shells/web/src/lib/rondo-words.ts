// SPDX-License-Identifier: MPL-2.0
/**
 * The sentences a person reads about a rondocode song: what a render could not
 * play, why a render failed, and the credit line. One place, so the details sheet,
 * the export card and the timeline say the same thing in the same words.
 *
 * The renderer reports findings as stable codes with the parts they concern
 * (packages/rondo/src/render.ts). The English it sends along is the fallback; a
 * known code is rebuilt here from a translatable template, so the sentence
 * follows the interface language. A song's own warnings ("Line 4: ...") are the
 * song's words and are shown as they came.
 *
 * Every function returns PLAIN TEXT (tRaw): the callers write it with
 * textContent or announce(), or escape it before it reaches markup.
 */
import { tRaw } from '../i18n.ts';

/** One finding, in the renderer's own shape. */
export interface RondoFindingLike {
  code: string;
  message: string;
  parts: string[];
}

/** A failure, in the client's own shape. */
interface FailureLike {
  code?: unknown;
  message?: unknown;
  diagnostics?: unknown;
}

/** The parts, at most six by name, then a count. */
function partList(parts: readonly string[]): string {
  const names = [...new Set(parts)];
  if (names.length <= 6) return names.join(', ');
  return tRaw('{names} and {n} more', { names: names.slice(0, 6).join(', '), n: names.length - 6 });
}

/** One finding as a sentence in the interface language. */
export function rondoFindingSentence(f: RondoFindingLike): string {
  const parts = partList(f.parts ?? []);
  switch (f.code) {
    case 'rondo.part.sing':
      return tRaw('Sung parts need the singing models, so these are silent: {parts}.', { parts });
    case 'rondo.part.mic':
      return tRaw('Parts that play the live microphone are silent in a render: {parts}.', { parts });
    case 'rondo.part.sample':
      return tRaw('Samples loaded into the rondocode editor do not travel with a song, so these are silent: {parts}.', { parts });
    case 'rondo.part.ddsp':
      return tRaw('Instrument models loaded into the rondocode editor do not travel with a song, so these are silent: {parts}.', { parts });
    default:
      // rondo.limits.length carries its own numbers; rondo.warning is the song's own text.
      return String(f.message ?? '');
  }
}

/** The first line-level detail of a failed compile or evaluation, as "Line 3: ...". */
function firstDiagnostic(e: FailureLike): string {
  const list = Array.isArray(e.diagnostics) ? e.diagnostics as { message?: unknown; line?: unknown }[] : [];
  const d = list[0];
  if (!d) return typeof e.message === 'string' ? e.message : '';
  const msg = String(d.message ?? '').slice(0, 300);
  return typeof d.line === 'number' ? tRaw('Line {line}: {message}', { line: d.line, message: msg }) : msg;
}

/** Why a render did not happen, as one sentence. */
export function rondoFailureSentence(err: unknown): string {
  const e = (err && typeof err === 'object' ? err : {}) as FailureLike;
  const code = typeof e.code === 'string' ? e.code : '';
  switch (code) {
    case 'rondo.timeout':
      return tRaw('The song took too long to render and was stopped.');
    case 'rondo.vm.timeout':
      return tRaw('The song ran past its time limit.');
    case 'rondo.vm.memory':
      return tRaw('The song needed more memory than a render allows.');
    case 'rondo.vm.stack':
      return tRaw('The song recursed too deeply.');
    case 'rondo.vm.unavailable':
    case 'rondo.worker.error':
      return tRaw('This browser could not start the song renderer.');
    case 'rondo.compile':
    case 'rondo.evaluate':
      return tRaw('The song has an error. {detail}', { detail: firstDiagnostic(e) });
    case 'rondo.source.empty':
      return tRaw('The song is empty.');
    case 'rondo.limits.source':
      return tRaw('The song is too large to render.');
    case 'rondo.limits.seconds':
      return tRaw('That length is outside what a render allows.');
    case 'rondo.render.nonfinite':
      return tRaw('The render produced samples that are not numbers.');
    case 'rondo.source.invalid':
    case 'rondo.source.fetch':
      return tRaw('That file is not a rondocode song Lolly can read.');
    default:
      if (code.startsWith('rondo.staged')) return tRaw('The song returned data the renderer refused.');
      return tRaw('The song could not be rendered.');
  }
}

/** A song that failed on the timeline: the export goes ahead with it silent. */
export function rondoSilentInExport(name: string, reason: string): string {
  return name
    ? tRaw('“{name}” is silent in this render. {reason}', { name, reason })
    : tRaw('A song is silent in this render. {reason}', { reason });
}

/** The credit line: what played the song and where it ran. */
export function rondoCreditLine(): string {
  return tRaw('Rendered by rondocode, by Vijay Pemmaraju (MIT). The song’s code ran in Lolly’s sandbox, with no network and no access to your files.');
}
