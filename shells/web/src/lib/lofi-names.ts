// SPDX-License-Identifier: MPL-2.0
/**
 * The words people read for the generated stations' instruments: the player's
 * now-playing line and the music generator's track pickers share them. Types only from
 * the composer, so importing this never loads the composer.
 */
import type { LofiStyle } from '../../../../engine/src/lofi-compose.ts';

export const LOFI_KEYS_NAME: Record<LofiStyle['keys'], string> = {
  rhodes: 'Rhodes', felt: 'felt piano', wurli: 'Wurlitzer', pluck: 'soft pluck', pad: 'pad', supersaw: 'saw chords',
  nylon: 'nylon guitar', crunch: 'rhythm guitar', wah: 'wah guitar', chiparp: 'chip arpeggio',
};

export const LOFI_LEAD_NAME: Record<LofiStyle['lead'], string> = {
  vibes: 'vibes', flute: 'flute', soft: 'soft lead', kalimba: 'kalimba', chip: 'chip lead', angel: 'angel lead', pulse: 'pulse lead',
  guitar: 'guitar', overdrive: 'lead guitar', synthwave: 'synthwave lead', metal: 'metal guitar', panflute: 'pan flute',
  nylon: 'nylon guitar', riff: 'riff guitar', twang: 'twang guitar', none: '',
};

export const LOFI_BASS_NAME: Record<LofiStyle['bass'], string> = {
  round: 'rolling bass', upright: 'upright bass', synth: 'synth bass', wobble: 'wobble bass', growl: 'growl bass',
  reese: 'reese bass', slap: 'slap bass', screech: 'screech bass', pulse: 'chip bass', electro: 'electro bass',
  picked: 'bass guitar', croak: 'croak bass', eight: '808', acid: 'acid bass', motown: 'soul bass',
};
