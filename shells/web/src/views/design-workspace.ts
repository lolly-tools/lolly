// SPDX-License-Identifier: MPL-2.0
/**
 * Outcome-aware defaults for the otherwise general-purpose Design canvas.
 *
 * This is shell UI state, not an engine concept: every document still follows the
 * same render path, while the editor can name the job and put the likely output
 * first.  The intent is persisted beside the existing `__export_*` session markers
 * and is deliberately never inferred as "poster" - a poster may be digital, so it
 * keeps the ordinary Design experience instead of being forced into print semantics.
 */

export type DesignIntent = 'general' | 'slides' | 'carousel' | 'video' | 'screencast';

export interface DesignOutcome {
  intent: DesignIntent;
  label: string;
  defaultFormat?: string;
  recommendedFormats: string[];
  summary: string;
  downloadLabel?: string;
  openNavigator: boolean;
  openTimeline: boolean;
}

const INTENTS = new Set<DesignIntent>(['general', 'slides', 'carousel', 'video', 'screencast']);

export function validDesignIntent(value: unknown): DesignIntent | null {
  return typeof value === 'string' && INTENTS.has(value as DesignIntent)
    ? value as DesignIntent
    : null;
}

interface BoxLike {
  kind?: unknown;
  w?: unknown;
  h?: unknown;
  lane?: unknown;
  start?: unknown;
}

function finite(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export interface InferDesignIntentOpts {
  saved?: unknown;
  templateId?: string | null;
  templateCategory?: string | null;
  boxes?: unknown;
}

/** Prefer explicit saved/template intent, then recognise older unmarked documents. */
export function inferDesignIntent(opts: InferDesignIntentOpts): DesignIntent {
  const saved = validDesignIntent(opts.saved);
  if (saved) return saved;

  const hint = `${opts.templateId ?? ''} ${opts.templateCategory ?? ''}`.toLowerCase();
  if (/screencast|screen\s*record|youtube/.test(hint)) return 'screencast';
  if (/carousel|linkedin/.test(hint)) return 'carousel';
  if (/slide|deck|presentation/.test(hint)) return 'slides';
  if (/video|motion/.test(hint)) return 'video';

  const boxes = Array.isArray(opts.boxes) ? opts.boxes as BoxLike[] : [];
  if (boxes.some(b => String(b?.lane ?? '') === 'seq' || finite(b?.start) > 0)) return 'video';
  const frames = boxes.filter(b => String(b?.kind ?? '') === 'frame');
  if (frames.length > 1) {
    const portrait = frames.every(b => finite(b.w) > 0 && finite(b.h) > finite(b.w));
    return portrait ? 'carousel' : 'slides';
  }
  return 'general';
}

export const DESIGN_INTENT_OPTIONS: ReadonlyArray<{ value: DesignIntent; label: string }> = [
  { value: 'general', label: 'Design' },
  { value: 'slides', label: 'Slides' },
  { value: 'carousel', label: 'LinkedIn carousel' },
  { value: 'video', label: 'Video' },
  { value: 'screencast', label: 'YouTube screencast' },
];

/** Narration is part of authored playback, not a static-design default. */
export function designNarrationEnabled(intent: DesignIntent): boolean {
  return intent === 'slides' || intent === 'video' || intent === 'screencast';
}

/** Keep time editing discoverable only for outcomes that can meaningfully play. */
export function designTimelineEnabled(intent: DesignIntent): boolean {
  return intent === 'slides' || intent === 'video' || intent === 'screencast';
}

export function designOutcome(intent: DesignIntent, boxes: unknown): DesignOutcome {
  const rows = Array.isArray(boxes) ? boxes as BoxLike[] : [];
  const pages = Math.max(1, rows.filter(b => String(b?.kind ?? '') === 'frame').length);
  switch (intent) {
    case 'slides':
      return {
        intent,
        label: 'Slides',
        defaultFormat: 'pptx',
        recommendedFormats: ['pptx', 'pdf'],
        summary: `${pages} slide${pages === 1 ? '' : 's'} · PowerPoint keeps every artboard as an editable slide.`,
        downloadLabel: 'Download PowerPoint',
        openNavigator: true,
        openTimeline: false,
      };
    case 'carousel':
      return {
        intent,
        label: 'LinkedIn carousel',
        defaultFormat: 'png',
        recommendedFormats: ['png', 'pdf'],
        summary: `${pages} image${pages === 1 ? '' : 's'} · PNG exports one file per artboard in a ZIP.`,
        downloadLabel: `Download ${pages} image${pages === 1 ? '' : 's'}`,
        openNavigator: true,
        openTimeline: false,
      };
    case 'video':
      return {
        intent,
        label: 'Video',
        defaultFormat: 'mp4',
        recommendedFormats: ['mp4', 'webm', 'gif'],
        summary: 'One video · timing, audio and transitions follow the timeline.',
        downloadLabel: 'Download MP4',
        openNavigator: false,
        openTimeline: true,
      };
    case 'screencast':
      return {
        intent,
        label: 'YouTube screencast',
        defaultFormat: 'mp4',
        recommendedFormats: ['mp4', 'webm'],
        summary: 'One video · record a screen clip, then trim and caption it on the timeline.',
        downloadLabel: 'Download MP4',
        openNavigator: false,
        openTimeline: true,
      };
    default:
      return {
        intent: 'general',
        label: 'Design',
        recommendedFormats: [],
        summary: '',
        openNavigator: false,
        openTimeline: false,
      };
  }
}
