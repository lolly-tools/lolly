// SPDX-License-Identifier: MPL-2.0
/**
 * The music generator's instrument icons: each keys, lead or bass instrument belongs to a
 * family, and each family has an icon from lib/icons.ts (a piano, a synth's waveform, a
 * guitar for plucked strings, a bowed string, a flute's wind, a horn, a voice, a bell for
 * mallets and bells, a games console for the 8-bit sounds, a drum for the drum-like
 * basses). The editor draws them on its canvas, so this also turns an icon's markup into
 * canvas paths: its path, circle, ellipse, line, polyline and rect elements, which are
 * all the icon set uses.
 */
import type { LofiStyle } from '../../../../engine/src/lofi-compose.ts';
import { iconMarkup } from './icons.ts';

export type InstrumentIcon = 'piano' | 'audioWaveform' | 'guitar' | 'bowed' | 'wind' | 'horn' | 'micVocal' | 'bell' | 'gamepad' | 'drum';

const KEYS: Record<LofiStyle['keys'], InstrumentIcon> = {
  rhodes: 'piano', felt: 'piano', wurli: 'piano', honky: 'piano', organ: 'piano',
  pluck: 'audioWaveform', pad: 'audioWaveform', supersaw: 'audioWaveform', future: 'audioWaveform',
  nylon: 'guitar', steel: 'guitar', banjo: 'guitar', jazzbox: 'guitar', crunch: 'guitar', wah: 'guitar', harp: 'guitar',
  tar: 'guitar', santur: 'guitar', zheng: 'guitar', koto: 'guitar', shamisen: 'guitar', kora: 'guitar',
  chiparp: 'gamepad', brass: 'horn', choir: 'micVocal', balafon: 'bell',
};
const LEADS: Record<LofiStyle['lead'], InstrumentIcon> = {
  vibes: 'bell', bells: 'bell', kalimba: 'bell', balafon: 'bell',
  flute: 'wind', panflute: 'wind', ney: 'wind', shakuhachi: 'wind', dizi: 'wind', clarinet: 'wind', harmonica: 'wind',
  sax: 'horn', trumpet: 'horn',
  soft: 'audioWaveform', synthwave: 'audioWaveform',
  chip: 'gamepad', pulse: 'gamepad', bit: 'gamepad',
  angel: 'micVocal', chop: 'micVocal',
  guitar: 'guitar', overdrive: 'guitar', metal: 'guitar', riff: 'guitar', twang: 'guitar', nylon: 'guitar', banjo: 'guitar', pedal: 'guitar',
  santur: 'guitar', zheng: 'guitar', koto: 'guitar', pipa: 'guitar', shamisen: 'guitar', kora: 'guitar',
  fiddle: 'bowed', kamancheh: 'bowed', erhu: 'bowed',
  none: 'audioWaveform',
};
const BASSES: Record<LofiStyle['bass'], InstrumentIcon> = {
  round: 'audioWaveform', synth: 'audioWaveform', wobble: 'audioWaveform', growl: 'audioWaveform', reese: 'audioWaveform', screech: 'audioWaveform', electro: 'audioWaveform', acid: 'audioWaveform',
  upright: 'bowed', slap: 'guitar', picked: 'guitar', croak: 'guitar', motown: 'guitar',
  pulse: 'gamepad', eight: 'drum', log: 'drum', yidaki: 'wind',
};

/** The family icon for a part's instrument. */
export function instrumentIcon(part: 'keys' | 'lead' | 'bass', instrument: string): InstrumentIcon {
  const table: Record<string, InstrumentIcon> = part === 'keys' ? KEYS : part === 'lead' ? LEADS : BASSES;
  return table[instrument] ?? 'audioWaveform';
}

const PATHS = new Map<string, Path2D>();

/** An icon as one canvas path in its 24-unit box, to stroke at any size. Cached. */
export function iconPath(name: InstrumentIcon): Path2D {
  let p = PATHS.get(name);
  if (p) return p;
  p = new Path2D();
  const num = (el: string, attr: string): number => Number(new RegExp(`\\b${attr}="([-\\d.]+)"`).exec(el)?.[1] ?? 0);
  for (const el of iconMarkup(name).match(/<(path|circle|ellipse|line|polyline|rect)\b[^>]*>/g) ?? []) {
    if (el.startsWith('<path')) {
      const d = /\bd="([^"]+)"/.exec(el)?.[1];
      if (d) p.addPath(new Path2D(d));
    } else if (el.startsWith('<circle')) {
      p.moveTo(num(el, 'cx') + num(el, 'r'), num(el, 'cy'));
      p.arc(num(el, 'cx'), num(el, 'cy'), num(el, 'r'), 0, Math.PI * 2);
    } else if (el.startsWith('<ellipse')) {
      p.moveTo(num(el, 'cx') + num(el, 'rx'), num(el, 'cy'));
      p.ellipse(num(el, 'cx'), num(el, 'cy'), num(el, 'rx'), num(el, 'ry'), 0, 0, Math.PI * 2);
    } else if (el.startsWith('<line')) {
      p.moveTo(num(el, 'x1'), num(el, 'y1'));
      p.lineTo(num(el, 'x2'), num(el, 'y2'));
    } else if (el.startsWith('<polyline')) {
      const pts = (/\bpoints="([^"]+)"/.exec(el)?.[1] ?? '').trim().split(/[\s,]+/).map(Number);
      for (let i = 0; i + 1 < pts.length; i += 2) (i ? p.lineTo : p.moveTo).call(p, pts[i]!, pts[i + 1]!);
    } else {
      p.rect(num(el, 'x'), num(el, 'y'), num(el, 'width'), num(el, 'height'));
    }
  }
  PATHS.set(name, p);
  return p;
}
