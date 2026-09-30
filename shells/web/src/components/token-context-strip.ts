// SPDX-License-Identifier: MPL-2.0
import type { TokensSnapshot } from '@lolly-tools/core/host-v1';
import { escape as esc } from '../utils.ts';
import { t } from '../i18n.ts';

/** One captured render context, using the shared card, chips and action primitive. */
export function mountTokenContextStrip(root: HTMLElement, snapshot: TokensSnapshot, inspect: () => void | Promise<void>): () => void {
  root.classList.add('token-context-strip', 'card', 'card--sub');
  const choices = Object.entries(snapshot.selection.choices ?? {}).map(([group, option]) => `${group || t('Theme')}: ${option}`).join(' · ');
  const source = snapshot.system ? { shipped: t('Bundled with this app'), local: t('Local copy'), file: t('Imported file'), hosted: t('Hosted source') }[snapshot.system.source] : '';
  root.innerHTML = `<strong>${esc(snapshot.system?.label ?? t('Design system'))}</strong><span class="chip chip--status">${t('Render version')}: ${esc(snapshot.version ?? t('Latest'))}</span>${source ? `<span class="chip chip--status">${esc(source)}</span>` : ''}${choices ? `<p>${esc(choices)}</p>` : ''}<button type="button" class="btn btn--ghost btn--sm">${t('Inspect tokens')}</button>`;
  const button = root.querySelector('button')!;
  const open = (): void => { void Promise.resolve(inspect()).catch(() => { button.textContent = t('Tokens could not be read.'); }); };
  button.addEventListener('click', open);
  return () => { button.removeEventListener('click', open); root.replaceChildren(); };
}
