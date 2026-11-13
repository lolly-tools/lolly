// SPDX-License-Identifier: MPL-2.0
/**
 * Words for where the Neurospicy player has got to, for its progress bar (the dock's
 * scrub): the time, and for a generated tune the bar and the part of the tune it is in,
 * in the listener's language.
 *
 * The part names are the music generator's ("verse", "chorus", "drum break"), one t()
 * call each so the translation run finds every key.
 */
import { t, tRaw } from '../i18n.ts';
import { barAt, type LofiTimeline } from './neurospicy-lofi.ts';

/** A part of a tune, in words. The rest bar at a tune's end has no name. */
export function sectionWord(name: string): string {
  switch (name) {
    case 'intro': return t('Intro');
    case 'verse': return t('Verse');
    case 'pre-chorus': return t('Pre-chorus');
    case 'chorus': return t('Chorus');
    case 'bridge': return t('Bridge');
    case 'feature': return t('Feature');
    case 'groove': return t('Groove');
    case 'break': return t('Break');
    case 'solo': return t('Solo');
    case 'drums': return t('Drums');
    case 'drum break': return t('Drum break');
    case 'build': return t('Build');
    // Kept in English: the catalogs already hold "Drop" for drag and drop, and a dance
    // track's drop is called a drop in most languages.
    case 'drop': return 'Drop';
    case 'outro': return t('Outro');
    default: return '';
  }
}

/** Minutes and seconds, "1:04". */
export function clockTime(seconds: number): string {
  const s = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

/**
 * The progress bar's words for `seconds` of `duration`: for a generated tune (its
 * `timeline`), a short label with the bar and part ("Bar 5 of 43 · Verse"); for anyone
 * using a screen reader, that and the time.
 */
export function positionWords(seconds: number, duration: number, timeline: LofiTimeline | null): { label?: string; spoken: string } {
  const time = tRaw('{elapsed} of {length}', { elapsed: clockTime(seconds), length: clockTime(duration) });
  if (!timeline?.starts.length) return { spoken: time };
  const bar = barAt(timeline.starts, seconds);
  const where = tRaw('Bar {n} of {total}', { n: bar + 1, total: timeline.starts.length });
  const part = sectionWord(timeline.sections[bar] ?? '');
  return { label: part ? `${where} · ${part}` : where, spoken: [where, part, time].filter(Boolean).join(', ') };
}
