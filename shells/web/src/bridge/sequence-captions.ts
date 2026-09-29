// SPDX-License-Identifier: MPL-2.0
/** Caption collection from the authored sequence DOM. */
import type { CaptionCue } from '@lolly/engine';
import { CAPTION_BOX_CLASS, MIN_CUE_KEEP_S } from '../lib/caption-constants.ts';
const CAPTION_SELECTOR = `.lolly-box.${CAPTION_BOX_CLASS}[data-t-start], .lolly-box[data-caption][data-t-start]`;

const oneLine = (s: string): string => s.replace(/\s+/g, ' ').trim();

const attrMs = (el: Element, name: string): number => {
  const v = parseFloat(el.getAttribute(name) ?? '');
  return Number.isFinite(v) ? v : Number.NaN;
};

const round3 = (v: number): number => Math.round(v * 1000) / 1000;

export interface StageCaptionOpts {
  totalMs?: number;
}

export function stageCaptionCues(node: Element | null | undefined, opts: StageCaptionOpts = {}): CaptionCue[] {
  const root = node as HTMLElement | null | undefined;
  const stage = root?.matches?.('[data-sequence]')
    ? root
    : (root?.querySelector?.('[data-sequence]') as HTMLElement | null);
  if (!stage?.querySelectorAll) return [];
  const declared = attrMs(stage, 'data-seq-ms');
  const totalMs = Number.isFinite(Number(opts.totalMs)) && Number(opts.totalMs) > 0
    ? Number(opts.totalMs)
    : (Number.isFinite(declared) && declared > 0 ? declared : 0);
  const endLimit = totalMs > 0 ? totalMs / 1000 : Number.POSITIVE_INFINITY;
  const out: CaptionCue[] = [];
  for (const el of stage.querySelectorAll<HTMLElement>(CAPTION_SELECTOR)) {
    if (el.getAttribute('data-t-ignored') != null) continue;
    const startMs = attrMs(el, 'data-t-start');
    if (!Number.isFinite(startMs)) continue;
    const durMs = attrMs(el, 'data-t-dur');
    const start = Math.max(0, startMs / 1000);
    // An open-ended caption box (no authored duration) runs to the end of the film,
    // matching the compositor's caption interval.
    const end = Math.min(endLimit, Number.isFinite(durMs) && durMs > 0 ? start + durMs / 1000 : endLimit);
    if (!(end > start) || !Number.isFinite(end)) continue;
    const text = oneLine((el.querySelector('.lolly-box-text') ?? el).textContent ?? '');
    if (!text) continue;
    if (end - start < MIN_CUE_KEEP_S) continue;
    out.push({ start: round3(start), end: round3(end), text });
  }
  out.sort((a, b) => (a.start - b.start) || (a.end - b.end));
  return out;
}
