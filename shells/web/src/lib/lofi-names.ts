// SPDX-License-Identifier: MPL-2.0
/**
 * The words people read for the generated stations' instruments: the player's
 * now-playing line and the music generator's track pickers share them. Types only from
 * the composer, so importing this never loads the composer.
 */
import type { LofiStyle } from '../../../../engine/src/lofi-compose.ts';

export const LOFI_KEYS_NAME: Record<LofiStyle['keys'], string> = {
  rhodes: 'Rhodes', felt: 'felt piano', wurli: 'Wurlitzer', pluck: 'soft pluck', pad: 'pad', supersaw: 'saw chords',
  nylon: 'nylon guitar', crunch: 'rhythm guitar', heavy: 'heavy guitars', buzzsaw: 'buzzsaw guitars', clean: 'clean chorus guitar', fuzz: 'fuzz guitars', wall: 'wall of guitars', wah: 'wah guitar', chiparp: 'chip arpeggio',
  steel: 'acoustic guitar', banjo: 'banjo', honky: 'honky-tonk piano', organ: 'organ', brass: 'brass section', jazzbox: 'jazz guitar', electric: 'electric guitar', harp: 'harp', choir: 'choir', future: 'future-bass chords',
  tar: 'tar', santur: 'santur', zheng: 'guzheng', koto: 'koto', shamisen: 'shamisen', kora: 'kora', balafon: 'balafon', strings: 'string section',
  grand: 'grand piano',
  surf: 'surf rhythm guitar', combo: 'combo organ',
  houseOrgan: 'house organ',
};

export const LOFI_LEAD_NAME: Record<LofiStyle['lead'], string> = {
  vibes: 'vibes', flute: 'flute', soft: 'soft lead', kalimba: 'kalimba', chip: 'chip lead', angel: 'angel lead', pulse: 'pulse lead',
  guitar: 'guitar', overdrive: 'lead guitar', synthwave: 'synthwave lead', metal: 'metal guitar', panflute: 'pan flute',
  nylon: 'nylon guitar', riff: 'riff guitar', twang: 'twang guitar', banjo: 'banjo', harmonica: 'harmonica', sax: 'sax',
  trumpet: 'trumpet', clarinet: 'clarinet', pedal: 'pedal steel', fiddle: 'fiddle', bells: 'bells', chop: 'vocal chops', bit: '8-bit lead',
  santur: 'santur', ney: 'ney', kamancheh: 'kamancheh', erhu: 'erhu', dizi: 'dizi', zheng: 'guzheng', pipa: 'pipa', shakuhachi: 'shakuhachi',
  koto: 'koto', shamisen: 'shamisen', kora: 'kora', balafon: 'balafon', harp: 'harp', steel: 'acoustic guitar', tar: 'tar', viola: 'viola', cello: 'cello', doublebass: 'double bass', none: '',
  surf: 'surf guitar', chorus: 'chorus guitar',
};

export const LOFI_SNARE_NAME: Record<LofiStyle['snare'], string> = { snare: 'snare', brush: 'brushes', rim: 'cross-stick', clap: 'claps', stack: 'big snare', snap: 'finger snaps' };
export const LOFI_HATS_NAME: Record<LofiStyle['hats'], string> = { hat: 'hi-hat', shaker: 'shaker', ride: 'ride cymbal', none: 'no cymbals' };

export const LOFI_BASS_NAME: Record<LofiStyle['bass'], string> = {
  round: 'rolling bass', upright: 'upright bass', synth: 'synth bass', wobble: 'wobble bass', growl: 'growl bass',
  reese: 'reese bass', slap: 'slap bass', screech: 'screech bass', pulse: 'chip bass', electro: 'electro bass',
  picked: 'bass guitar', croak: 'croak bass', eight: '808', acid: 'acid bass', motown: 'soul bass', yidaki: 'yidaki', log: 'log drum', deep: 'deep-house bass', warp: 'warp bass',
};
