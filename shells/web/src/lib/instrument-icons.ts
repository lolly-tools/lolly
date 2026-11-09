// SPDX-License-Identifier: MPL-2.0
/**
 * The music generator's instrument icons: each keys, lead or bass instrument belongs to a
 * family, and each family has an icon (a piano, a synth's waveform, a guitar for plucked
 * strings, a bowed string, a flute's wind, a horn, a voice, a bell for mallets and bells,
 * a games console for the 8-bit sounds, a drum for the drum-like basses). They live here
 * rather than in lib/icons.ts, which every page loads at startup, because only the music
 * generator draws them. The editor draws them on its
 * canvas too, so this also turns an icon's markup into canvas paths: its path, circle,
 * ellipse, line, polyline and rect elements, which are all these icons use.
 */
import type { LofiStyle } from '../../../../engine/src/lofi-compose.ts';

export type InstrumentIcon = 'piano' | 'audioWaveform' | 'guitar' | 'bowed' | 'wind' | 'horn' | 'micVocal' | 'bell' | 'gamepad' | 'drum';

/** The icons' markup, in the 24-unit stroke style of lib/icons.ts. Lucide (ISC): piano,
 *  guitar, drum, mic-vocal, audio-waveform, gamepad-2, bell and wind. Lolly's own:
 *  a bowed string with its bow, and a horn. */
const MARKUP: Record<InstrumentIcon, string> = {
  piano: '<path d="M18.5 8c-1.4 0-2.6-.8-3.2-2A6.87 6.87 0 0 0 2 9v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-8.5C22 9.6 20.4 8 18.5 8"/><path d="M2 14h20"/><path d="M6 14v4"/><path d="M10 14v4"/><path d="M14 14v4"/><path d="M18 14v4"/>',
  guitar: '<path d="m11.9 12.1 4.514-4.514"/><path d="M20.1 2.3a1 1 0 0 0-1.4 0l-1.114 1.114A2 2 0 0 0 17 4.828v1.344a2 2 0 0 1-.586 1.414A2 2 0 0 1 17.828 7h1.344a2 2 0 0 0 1.414-.586L21.7 5.3a1 1 0 0 0 0-1.4z"/><path d="m6 16 2 2"/><path d="M8.2 9.9C8.7 8.8 9.8 8 11 8c2.8 0 5 2.2 5 5 0 1.2-.8 2.3-1.9 2.8l-.9.4A2 2 0 0 0 12 18a4 4 0 0 1-4 4c-3.3 0-6-2.7-6-6a4 4 0 0 1 4-4 2 2 0 0 0 1.8-1.2z"/>',
  drum: '<path d="m2 2 8 8"/><path d="m22 2-8 8"/><ellipse cx="12" cy="9" rx="10" ry="5"/><path d="M7 13.4v7.9"/><path d="M12 14v8"/><path d="M17 13.4v7.9"/><path d="M2 9v8a10 5 0 0 0 20 0V9"/>',
  micVocal: '<path d="m11 7.601-5.994 8.19a1 1 0 0 0 .1 1.298l.817.818a1 1 0 0 0 1.314.087L15.09 12"/><path d="M16.5 21.174C15.5 20.5 14.372 20 13 20c-2.058 0-3.928 2.356-6 2-2.072-.356-2.775-3.369-1.5-4.5"/><circle cx="16" cy="7" r="5"/>',
  audioWaveform: '<path d="M2 13a2 2 0 0 0 2-2V7a2 2 0 0 1 4 0v13a2 2 0 0 0 4 0V4a2 2 0 0 1 4 0v13a2 2 0 0 0 4 0v-4a2 2 0 0 1 2-2"/>',
  gamepad: '<line x1="6" x2="10" y1="11" y2="11"/><line x1="8" x2="8" y1="9" y2="13"/><line x1="15" x2="15.01" y1="12" y2="12"/><line x1="18" x2="18.01" y1="10" y2="10"/><path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  bowed: '<path d="M9 22c-2.5 0-4-1.6-4-3.5 0-1.2.6-2 1.4-2.6-.6-.6-1-1.4-1-2.4C5.4 11.6 7 10 9 10s3.6 1.6 3.6 3.5c0 1-.4 1.8-1 2.4.8.6 1.4 1.4 1.4 2.6C13 20.4 11.5 22 9 22z"/><path d="M9 10V2"/><path d="m14 3 7 16"/>',
  horn: '<path d="M2 11h11"/><path d="M13 7.5c3 1.5 5 2 9-1.5v11c-4-3.5-6-3-9-1.5z"/><path d="M5 11v4"/><path d="M8 11v4"/><path d="M11 11v4"/>',
  wind: '<path d="M12.8 19.6A2 2 0 1 0 14 16H2"/><path d="M17.5 8a2.5 2.5 0 1 1 2 4H2"/><path d="M9.8 4.4A2 2 0 1 1 11 8H2"/>',
};

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

const SVG_NS = 'http://www.w3.org/2000/svg';
const SVG_ATTRS = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' };

/** An icon as an `<svg>` element, built node by node (a lane head swaps its icon as the playhead moves). */
export function musicIconNode(name: InstrumentIcon, size: number): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  for (const [k, v] of Object.entries({ ...SVG_ATTRS, width: String(size), height: String(size) })) svg.setAttribute(k, v);
  for (const el of MARKUP[name].match(/<[a-z]+\b[^>]*>/g) ?? []) {
    const node = document.createElementNS(SVG_NS, /^<([a-z]+)/.exec(el)![1]!);
    for (const [, k, v] of el.matchAll(/([a-z][\w-]*)="([^"]*)"/gi)) node.setAttribute(k!, v!);
    svg.append(node);
  }
  return svg;
}

const PATHS = new Map<string, Path2D>();

/** An icon as one canvas path in its 24-unit box, to stroke at any size. Cached. */
export function iconPath(name: InstrumentIcon): Path2D {
  let p = PATHS.get(name);
  if (p) return p;
  p = new Path2D();
  const num = (el: string, attr: string): number => Number(new RegExp(`\\b${attr}="([-\\d.]+)"`).exec(el)?.[1] ?? 0);
  for (const el of MARKUP[name].match(/<(path|circle|ellipse|line|polyline|rect)\b[^>]*>/g) ?? []) {
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
