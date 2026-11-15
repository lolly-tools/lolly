// SPDX-License-Identifier: MPL-2.0
import corpus from '../../examples/open-media/corpus.json' with { type: 'json' };
import type { SpeechWordTiming } from '../../packages/core/src/host-v1/speech.ts';

export { corpus };
export type Story = (typeof corpus.stories)[number];
export type Mode = (typeof corpus.modes)[number];
export interface Colours {
  primary: string;
  secondary: string;
  surface: string;
  text: string;
  muted: string;
}

/** Exact accepted candidates. A retry does not roll another seed. */
export function musicQuery(story: Story, mode: Mode): string {
  const q = new URLSearchParams(mode.music);
  q.set('seed', String(Number(q.get('seed')) + story.seedOffset));
  return q.toString();
}

export function captions(
  words: SpeechWordTiming[],
  granularity: 'word' | 'sentence' | 'none'
): SpeechWordTiming[] {
  if (granularity === 'none')
    throw new Error(
      'This speech result has no timing. Caption alignment is required for the study.'
    );
  if (
    !words.length ||
    words.some(
      (w) =>
        !w.text.trim() ||
        !Number.isFinite(w.start) ||
        !Number.isFinite(w.end) ||
        w.start < 0 ||
        w.end <= w.start
    )
  )
    throw new Error('Speech returned invalid caption timing.');
  if (granularity === 'sentence') return words;
  const result: SpeechWordTiming[] = [];
  let current: SpeechWordTiming | undefined;
  for (const w of words) {
    if (!current || `${current.text} ${w.text}`.length > 72 || w.end - current.start > 5) {
      current = { ...w };
      result.push(current);
    } else {
      current.text += ` ${w.text}`;
      current.end = w.end;
    }
  }
  return result;
}

export function webVtt(cues: SpeechWordTiming[], offset = 0): string {
  const stamp = (seconds: number) =>
    new Date(Math.round(seconds * 1000)).toISOString().slice(11, 23);
  return `WEBVTT\n\n${cues.map((c, i) => `${i + 1}\n${stamp(c.start + offset)} --> ${stamp(c.end + offset)}\n${c.text.replace(/-->/g, '→')}`).join('\n\n')}\n`;
}

/** Authored inputs for the existing Design tool, shared by still and timed specimens. */
export function designBoxes(
  story: Story,
  mode: Mode,
  colours: Colours,
  seconds?: number,
  cues: SpeechWordTiming[] = [],
  audio?: string
): Record<string, unknown>[] {
  const boxes: Record<string, unknown>[] = [
    {
      id: 'scene',
      kind: 'frame',
      name: story.title,
      x: 0,
      y: 0,
      w: 960,
      h: 540,
      bg: colours.surface,
      clipChildren: true,
    },
  ];
  const add = (id: string, kind: string, values: Record<string, unknown>) =>
    boxes.push({
      id,
      kind,
      frame: 'scene',
      shape: 'rect',
      fg: colours.text,
      font: 'SUSE',
      ...values,
    });
  add('series', 'text', {
    x: 56,
    y: 28,
    w: 848,
    h: 30,
    text: 'LOLLY / OPEN MEDIA STUDY',
    fontSize: 17,
    fg: colours.primary,
    fontWeight: 700,
  });
  add('title', 'text', {
    x: 56,
    y: 80,
    w: 848,
    h: 124,
    text: story.title,
    font: 'Outfit',
    fontSize: 44,
    fontWeight: 650,
  });
  const timed = seconds
    ? {
        lane: 'seq',
        start: 0,
        dur: seconds,
        enter: 'fade',
        enterMs: mode.id === 'explain' ? 350 : 180,
      }
    : {};
  if (story.id === 'chart') {
    [0, 35].forEach((baseline, column) => {
      const x = 76 + column * 440;
      add(`axis-${column}`, 'text', {
        x,
        y: 198,
        w: 340,
        h: 32,
        text: `Axis starts at ${baseline}`,
        fontSize: 20,
        fontWeight: 650,
      });
      story.data.forEach((value, i) => {
        const width = ((value - baseline) / (50 - baseline)) * 280;
        add(`bar-${column}-${i}`, 'box', {
          x,
          y: 250 + i * 58,
          w: width,
          h: 34,
          bg: i ? colours.primary : colours.secondary,
          ...timed,
        });
        add(`value-${column}-${i}`, 'text', {
          x: x + width + 8,
          y: 248 + i * 58,
          w: 54,
          h: 38,
          text: String(value),
          fontSize: 25,
          fontWeight: 650,
        });
      });
      add(`scale-${column}`, 'text', {
        x,
        y: 361,
        w: 340,
        h: 30,
        text: `${baseline} to 50 · same values`,
        fontSize: 16,
        fg: colours.muted,
      });
    });
  } else if (story.id === 'motion') {
    story.data.forEach((value, i) => {
      add(`bar-${i}`, 'box', {
        x: 160,
        y: 228 + i * 65,
        w: value * 10,
        h: 38,
        bg: i ? colours.primary : colours.secondary,
        ...timed,
        ...(seconds && i === 1 ? { start: 3, dur: seconds - 3 } : {}),
      });
      add(`value-${i}`, 'text', {
        x: 70,
        y: 225 + i * 65,
        w: 75,
        h: 45,
        text: String(value),
        fontSize: 30,
        fontWeight: 650,
      });
    });
    add('scale', 'text', {
      x: 160,
      y: 355,
      w: 660,
      h: 30,
      text: 'Zero baseline · original demonstration data',
      fontSize: 16,
      fg: colours.muted,
    });
  } else {
    ['Same picture', 'Same words', 'Different sound'].forEach((text, i) => {
      add(`card-${i}`, 'box', {
        x: 56 + i * 288,
        y: 230,
        w: 264,
        h: 120,
        bg: i === 2 ? colours.primary : colours.secondary,
      });
      add(`label-${i}`, 'text', {
        x: 72 + i * 288,
        y: 258,
        w: 232,
        h: 60,
        text,
        fg: '#ffffff',
        fontSize: 24,
        fontWeight: 650,
      });
    });
  }
  if (seconds) {
    cues.forEach((c, i) => {
      add(`caption-${i}`, 'text', {
        x: 56,
        y: 416,
        w: 848,
        h: 94,
        text: c.text,
        fontSize: 22,
        lane: 'seq',
        start: c.start + 0.5,
        dur: c.end - c.start,
      });
    });
    add('duration', 'box', {
      x: 56,
      y: 523,
      w: 848,
      h: 3,
      bg: colours.primary,
      lane: 'seq',
      start: 0,
      dur: seconds,
    });
    if (audio)
      add('narrated-mix', 'audio', {
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        image: audio,
        lane: 'seq',
        start: 0,
        dur: seconds,
        volume: 1,
      });
  } else
    add('point', 'text', {
      x: 56,
      y: 420,
      w: 848,
      h: 85,
      text: story.keyPoint,
      fontSize: 25,
      fontWeight: 650,
    });
  return boxes;
}
