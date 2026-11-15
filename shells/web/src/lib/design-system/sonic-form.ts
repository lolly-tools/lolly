// SPDX-License-Identifier: MPL-2.0

import type { SpeechVoiceInfo } from '@lolly-tools/core/host-v1';
import { LOFI_MOODS } from '../../../../../engine/src/lofi-compose.ts';
import type {
  SonicContextV1,
  SonicProfileV1,
} from '../../../../../packages/core/src/sonic-profile-v1.ts';
import { t } from '../../i18n.ts';
import { escape as e } from '../../utils.ts';
import { genreTitle } from '../genre-icons.ts';
import { LOFI_BASS_NAME, LOFI_KEYS_NAME, LOFI_LEAD_NAME } from '../lofi-names.ts';
import { MIX_KEYS, parseMusicState } from '../music-state.ts';

const field = (path: string, label: string, value: string, hint = ''): string =>
  `<label class="sound-field"><span>${e(t(label))}</span><textarea data-sound-field="${path}" rows="2" maxlength="4000">${e(value)}</textarea>${hint ? `<small>${e(t(hint))}</small>` : ''}</label>`;
const number = (
  path: string,
  label: string,
  value: number | undefined,
  min: number,
  max: number,
  step: number,
  optional = false
): string =>
  `<label class="sound-field"><span>${e(t(label))}</span><input data-sound-field="${path}" type="number" value="${value ?? ''}" min="${min}" max="${max}" step="${step}"${optional ? ` placeholder="${e(t('Chosen by the style'))}"` : ' required'}></label>`;
const select = (
  path: string,
  label: string,
  value: string,
  options: Array<[string, string]>
): string =>
  `<label class="sound-field"><span>${e(t(label))}</span><select data-sound-field="${path}">${options.map(([id, name]) => `<option value="${e(id)}"${id === value ? ' selected' : ''}>${e(t(name))}</option>`).join('')}</select></label>`;

export function sonicIdentityFields(profile: SonicProfileV1): string {
  return `${field('identity.character', 'How should your brand feel?', profile.identity.character, 'Describe the audience and occasion. Warm and reassuring for a tutorial may differ from a product launch.')}${field('identity.anchors', 'What should stay familiar?', profile.identity.anchors, 'Name recognisable instruments, rhythmic habits or a fixed signature. New melodies alone do not establish recognition.')}${field('identity.avoid', 'What should we avoid?', profile.identity.avoid, 'Include distracting sounds and associations that would feel wrong. This guidance needs listening review.')}`;
}

export function sonicContextFields(
  context: SonicContextV1,
  voices: SpeechVoiceInfo[],
  assets: Array<{ id: string; name: string }>
): string {
  const s = parseMusicState(context.music.parameters);
  const instruments = (names: Record<string, string>) =>
    [
      ['', 'Chosen by the style'],
      ...Object.entries(names).map(([id, name]) => [id, name || 'No lead']),
    ] as Array<[string, string]>;
  const voiceOptions: Array<[string, string]> = [
    ['', 'Choose a voice'],
    ...voices.map((v) => [v.id, `${v.name} (${v.lang})`] as [string, string]),
  ];
  if (context.narration.voice && !voices.some((v) => v.id === context.narration.voice))
    voiceOptions.push([context.narration.voice, `${context.narration.voice} (saved voice)`]);
  const signatureOptions: Array<[string, string]> = [
    ['', 'No signature assigned'],
    ...assets.map((a) => [a.id, a.name] as [string, string]),
  ];
  if (context.signature.resource && !assets.some((a) => a.id === context.signature.resource?.id))
    signatureOptions.push([context.signature.resource.id, 'Saved signature (not available here)']);
  return `<details class="sound-details"><summary>${t('Describe this use')}</summary><div class="sound-grid">${field('context.label', 'Name this use', context.label)}${field('context.purpose', 'When to use this sound', context.purpose)}</div>${field('context.guidance', 'Listen for', context.guidance)}</details>
  <details class="sound-details"><summary>${t('Music choices')}</summary><p>${t('These settings stay fixed when you make a new composition. Style choices marked automatic can vary with the seed.')}</p><div class="sound-grid">
  ${select(
    'music.style',
    'Style',
    s.mood,
    LOFI_MOODS.map((id) => [id, genreTitle(id)])
  )}${number('music.bpm', 'Tempo (beats per minute)', s.bpm, 50, 220, 1, true)}
  ${select('music.keys', 'Chords', s.keys ?? '', instruments(LOFI_KEYS_NAME))}${select('music.bass', 'Bass', s.bass ?? '', instruments(LOFI_BASS_NAME))}${select('music.lead', 'Melody', s.lead ?? '', instruments(LOFI_LEAD_NAME))}${select(
    'music.drums',
    'Drums',
    s.drums ? '1' : '0',
    [
      ['1', 'On'],
      ['0', 'Off'],
    ]
  )}
  ${number('music.bars', 'Length (bars)', s.bars, 4, 512, 1)}${number('music.texture', 'Texture', s.texture, 0, 1, 0.05)}${MIX_KEYS.map((key) => number(`music.mix.${key}`, `${key} level`, s.mix[key], 0, 2, 0.05)).join('')}
  </div><details class="sound-details"><summary>${t('More musical control')}</summary><p>${t('Open this recipe in Music to edit sections, effects, drum kits and the producer tag. Copy its settings link, then apply the link here to keep those choices for this use.')}</p><a class="btn" href="#/music?${e(context.music.parameters)}" target="_blank" rel="noopener">${t('Edit in Music')}</a><label class="sound-field"><span>${t('Music settings link')}</span><input data-sound-music-link type="text" maxlength="6000" placeholder="#/music?…"></label><button type="button" class="btn" data-sound-action="apply-music">${t('Apply these music choices')}</button></details><p>${t('The full recipe also retains section instruments, effects and other advanced settings. Personal shuffle preferences never replace this profile.')}</p></details>
  <details class="sound-details"><summary>${t('Voice and music together')}</summary><p>${t('Choose a voice for your audience, then listen for clear words and natural pacing. Voice previews may download a local speech model on first use.')}</p><div class="sound-grid">${select('narration.voice', 'Voice', context.narration.voice, voiceOptions)}${number('narration.speed', 'Speaking speed', context.narration.speed, 0.5, 2, 0.05)}${number('narration.bedVolume', 'Music level with narration', context.narration.bedVolume, 0, 1, 0.05)}${number('narration.duck', 'Music remaining while speaking', context.narration.duck, 0, 1, 0.05)}</div>${field('narration.guidance', 'Voice guidance', context.narration.guidance)}${field('pronunciations', 'Pronunciation notes', context.narration.pronunciations.map((p) => `${p.written} = ${p.spoken}`).join('\n'), 'One written phrase = spoken phrase per line. Preview substitutions match exact text, including capitalisation.')}</details>
  <details class="sound-details"><summary>${t('Signature and references')}</summary>${select('signature.resource', 'Fixed signature', context.signature.resource?.id ?? '', signatureOptions)}${field('signature.guidance', 'How the signature should be used', context.signature.guidance)}<p>${t('A signature is a separate audio asset. Place it in your sequence; generating a music bed does not insert the signature. Use a rendered recording when the exact sound must stay fixed.')}</p><div class="sound-actions"><button type="button" class="btn" data-sound-action="signature">${t('Listen to signature')}</button><a class="btn" href="#/a?type=audio">${t('Open audio files')}</a></div>${context.examples.length ? `<ul>${context.examples.map((x) => `<li>${e(x.label)}: ${e(x.note)}</li>`).join('')}</ul>` : ''}</details>
  ${context.requirements.length ? `<details class="sound-details"><summary>${t('Imported requirements')}</summary><ul>${context.requirements.map((r) => `<li>${e(r.label)} (${e(r.requirement)}): ${e(r.kind)}</li>`).join('')}</ul><p>${t('Unsupported required checks stop generation. Descriptive guidance is retained for human review.')}</p></details>` : ''}`;
}
