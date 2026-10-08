// SPDX-License-Identifier: MPL-2.0
/** Playback preferences stay in the shared web link, including pasted embed links. */
import type { WebEmbed } from '../../../../engine/src/web-embed.ts';
import { t } from '../i18n.ts';

export function webPlaybackRows(embed: WebEmbed): string {
  if (embed.provider !== 'youtube') return '';
  const query = new URL(embed.src).searchParams;
  const toggles = [
    ['autoplay', 'Autoplay when presenting', false], ['mute', 'Muted', false],
    ['loop', 'Loop video', false], ['controls', 'Show player controls', true],
    ['fs', 'Allow fullscreen', true], ['cc_load_policy', 'Show captions', false],
  ] as const;
  return toggles.map(([key, label, fallback]) =>
    `<label class="fc-row fc-row-toggle field-toggle"><span>${t(label)}</span>`
    + `<input type="checkbox" class="field-check" data-fld="web" data-web-param="${key}"${(query.get(key) ?? (fallback ? '1' : '0')) === '1' ? ' checked' : ''}></label>`).join('')
    + ['start', 'end'].map(key => `<label class="fc-row"><span>${t(key === 'start' ? 'Start at (seconds)' : 'Stop at (seconds)')}</span>`
      + `<input class="field-input" type="number" min="0" max="86400" step="1" data-fld="web" data-web-param="${key}" value="${Number(query.get(key)) || 0}"></label>`).join('')
    + `<div class="fc-insp-read">${t('Autoplay starts on the active slide. Keep muted for reliable autoplay. A stop time of 0 plays to the end.')}</div>`;
}

export function changeWebPlayback(embed: WebEmbed, key: string, value: string): string | null {
  if (embed.provider !== 'youtube') return null;
  if (!['autoplay', 'mute', 'loop', 'controls', 'fs', 'cc_load_policy', 'start', 'end'].includes(key)) return null;
  const url = new URL(embed.source);
  if (key === 'start' || key === 'end') {
    const seconds = Number(value);
    if (!Number.isFinite(seconds) || seconds < 0 || seconds > 86400) return null;
    url.searchParams.delete(key === 'start' ? 't' : 'end');
    url.searchParams.set(key, String(Math.round(seconds)));
  } else {
    if (value !== '0' && value !== '1') return null;
    url.searchParams.set(key, value);
    if (key === 'autoplay' && value === '1' && !url.searchParams.has('mute')) url.searchParams.set('mute', '1');
  }
  return url.href;
}

export function wireWebPlayback(root: HTMLElement, read: () => WebEmbed | null, write: (link: string) => void): void {
  for (const input of root.querySelectorAll<HTMLInputElement>('[data-web-param]')) {
    input.addEventListener('change', () => {
      const embed = read();
      if (!embed) return;
      const link = changeWebPlayback(embed, input.dataset.webParam ?? '', input.type === 'checkbox' ? (input.checked ? '1' : '0') : input.value);
      if (link) write(link);
    });
  }
}
