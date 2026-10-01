// SPDX-License-Identifier: MPL-2.0
/**
 * "Check web pages": the one moment Lolly asks about a deck's web pages (plan 288 D2).
 *
 * Nothing is asked once the presenter is open. A web page box whose site nobody has
 * trusted shows its picture there and its slide goes on. So every question is asked
 * here, before presenting, and only while it still matters:
 *   - a site nobody has trusted or agreed to: "Just this time" (this session) or
 *     "Always trust" (the person's trusted sites; plan 288 D5 offers both);
 *   - a site that will not load whatever anyone answers (an organisation's policy,
 *     this deployment's security headers, the site's own refusal, this browser): said
 *     once per session, so the presenter knows which slides show a picture.
 * A kiosk never asks: its untrusted pages stay pictures.
 */
import { mountModal } from '../components/modal.ts';
import { escape as esc } from '../utils.ts';
import { t } from '../i18n.ts';
import { icon } from '../lib/icons.ts';
import { parseWebEmbed, type WebEmbed } from '../../../../engine/src/web-embed.ts';
import { trustedSiteHost } from '../../../../engine/src/trusted-sites.ts';
import { canTrustMore, trustSite } from '../lib/trusted-sites.ts';
import { consentToLink, frameHost, policyNote, trustEntryFor, webFrameState, type WebFrameState } from '../lib/design-web-mount.ts';
import { anySiteApplies, enterAnySite, probeAnySite } from '../lib/any-site.ts';

type CheckState = Extract<WebFrameState, 'ask' | 'policy' | 'blocked' | 'refused' | 'browser'>;

export interface WebCheckRow {
  /** The host the frames contact, the row's identity. */
  host: string;
  state: CheckState;
  /** Slide numbers (1-based, in deck order) that carry a box for this host. */
  slides: number[];
  /** Plain words for what the boxes show ("YouTube video"). */
  label: string;
  /** One of the links, as given: consent and trust are per site, not per box. */
  link: string;
  embed: WebEmbed;
  /** Some box for this host has no picture of its own, so it shows a placeholder. */
  missingPoster: boolean;
}

const CHECK_STATES = new Set<WebFrameState>(['ask', 'policy', 'blocked', 'refused', 'browser']);

/** Issues shown in this session that no answer can change, by `host|state`. */
const acknowledged = new Set<string>();

/** Every site in the deck that needs a word before presenting, grouped by host. */
export function webCheckRows(source: Element): WebCheckRow[] {
  const pages = [...source.querySelectorAll<HTMLElement>('.lolly-frame-page')];
  const rows = new Map<string, WebCheckRow>();
  for (const marker of source.querySelectorAll<HTMLElement>('.lolly-box-web[data-lolly-web]')) {
    const link = marker.dataset.lollyWeb ?? '';
    const embed = parseWebEmbed(link, { appOrigin: location.origin });
    if (!embed) continue;
    const state = webFrameState(embed, 'editor');
    if (!CHECK_STATES.has(state)) continue;
    const host = frameHost(embed);
    const key = `${host}|${state}`;
    const page = marker.closest<HTMLElement>('.lolly-frame-page');
    const slide = page ? pages.indexOf(page) + 1 : 0;
    const missingPoster = !marker.querySelector('img.lolly-box-web-poster');
    const row = rows.get(key);
    if (row) {
      if (slide && !row.slides.includes(slide)) row.slides.push(slide);
      row.missingPoster ||= missingPoster;
    } else {
      rows.set(key, { host, state: state as CheckState, slides: slide ? [slide] : [], label: embed.label, link, embed, missingPoster });
    }
  }
  return [...rows.values()].sort((a, b) => (a.slides[0] ?? 0) - (b.slides[0] ?? 0));
}

/** Whether the list still has something to say: an open question, or an issue this
 *  session has not been told about yet. */
export function webCheckIsRelevant(rows: readonly WebCheckRow[]): boolean {
  return rows.some((r) => r.state === 'ask' || !acknowledged.has(`${r.host}|${r.state}`));
}

function slidesText(slides: readonly number[]): string {
  if (!slides.length) return '';
  return slides.length === 1 ? t('Slide {n}', { n: slides[0]! }) : t('Slides {list}', { list: [...slides].sort((a, b) => a - b).join(', ') });
}

function stateText(row: WebCheckRow): string {
  const reason = (() => {
    switch (row.state) {
      case 'ask': return t('Not trusted yet.');
      case 'policy': return policyNote(row.embed);
      case 'blocked': return t('The web version of Lolly cannot show this site. The desktop app can show the page.');
      case 'refused': return t('This site does not allow being shown inside other pages.');
      case 'browser': return t('This browser cannot show other sites inside Lolly. Chrome, Edge and Safari can show the page.');
      default: return '';
    }
  })();
  // What the slide shows instead, for as long as the page does not load.
  const instead = row.state === 'ask'
    ? (row.missingPoster ? t('Until you decide, the slide shows a placeholder card, because no picture is set.') : t('Until you decide, the slide shows its picture.'))
    : (row.missingPoster ? t('The slide shows a placeholder card, because no picture is set.') : t('The slide shows its picture instead.'));
  return `${reason} ${instead}`;
}

function rowHtml(row: WebCheckRow, i: number): string {
  const entry = row.state === 'ask' ? trustEntryFor(row.embed) : null;
  const actions = row.state === 'ask'
    ? `<div class="pwc-actions">`
      + `<button type="button" class="btn" data-pwc-once="${i}">${t('Just this time')}</button>`
      + (entry && canTrustMore() ? `<button type="button" class="btn" data-pwc-always="${i}">${esc(t('Always trust {host}', { host: trustedSiteHost(entry) }))}</button>` : '')
      + `</div>`
    : '';
  const meta = [slidesText(row.slides), row.label].filter(Boolean).join(' · ');
  return `<li class="pwc-row" data-pwc-row="${i}">`
    + `<span class="pwc-glyph" aria-hidden="true">${icon(row.state === 'ask' ? 'globe' : 'shield')}</span>`
    + `<div class="pwc-text"><strong class="pwc-host">${esc(row.host)}</strong>`
    + `<span class="pwc-meta">${esc(meta)}</span>`
    + `<span class="pwc-state" data-pwc-state="${i}">${esc(stateText(row))}</span>`
    + `</div>${actions}</li>`;
}

/**
 * Show the list and resolve true to present, false to stay in the editor. Answers take
 * effect at once: "Just this time" agrees for this session, "Always trust" writes the
 * person's trusted sites, and either one loads the editor's frames too.
 */
export function openWebCheck(rows: readonly WebCheckRow[]): Promise<boolean> {
  return new Promise((resolve) => {
    const title = t('Check web pages');
    const modal = mountModal<boolean>(
      `<h2 class="modal-title">${title}</h2>`
      + `<p class="modal-msg">${t('Some slides show web pages. Nothing is asked while you present, so decide here. A page that does not load shows its picture.')}</p>`
      + `<ul class="pwc-list">${rows.map(rowHtml).join('')}</ul>`
      + (rows.some((r) => r.state === 'blocked') && anySiteApplies()
        ? `<div class="pwc-anysite"><p class="pwc-anysite-note">${t('To show the sites the web version cannot, Lolly can reload under a looser frame policy on this device, then ask about each site before you present. You can turn this off in your profile, under Trusted sites.')}</p>`
          + `<button type="button" class="btn" data-pwc-anysite>${t('Allow pages from any site')}</button><p class="pwc-anysite-note" data-pwc-anysite-msg hidden></p></div>`
        : '')
      + `<div class="modal-actions"><button type="button" class="btn" data-pwc-cancel>${t('Not now')}</button>`
      + `<button type="button" class="btn modal-primary" data-pwc-present>${t('Present')}</button></div>`,
      {
        className: 'modal pwc-dialog',
        ariaLabel: title,
        cancelValue: false,
        initialFocus: (el) => el.querySelector<HTMLElement>('[data-pwc-present]'),
        onClose: (result) => {
          if (result) for (const r of rows) if (r.state !== 'ask') acknowledged.add(`${r.host}|${r.state}`);
          resolve(result === true);
        },
      },
    );
    const settle = (i: number, text: string): void => {
      const row = modal.el.querySelector<HTMLElement>(`[data-pwc-row="${i}"]`);
      row?.querySelector('.pwc-actions')?.remove();
      const state = row?.querySelector<HTMLElement>(`[data-pwc-state="${i}"]`);
      if (state) state.textContent = text;
      row?.classList.add('is-settled');
    };
    modal.el.addEventListener('click', (e) => {
      const el = e.target instanceof Element ? e.target.closest<HTMLButtonElement>('button') : null;
      if (!el) return;
      if (el.hasAttribute('data-pwc-cancel')) { modal.close(false); return; }
      if (el.hasAttribute('data-pwc-present')) { modal.close(true); return; }
      if (el.hasAttribute('data-pwc-anysite')) {
        el.disabled = true;
        void probeAnySite().then((offer) => {
          // Back with the deck, presenting: the list runs again under the wider policy. The
          // dialog stays up while the page goes, because closing it steps history back,
          // and that traversal would cancel the reload.
          if (offer === 'offered') { enterAnySite('present'); return; }
          const msg = modal.el.querySelector<HTMLElement>('[data-pwc-anysite-msg]');
          if (msg) {
            msg.textContent = offer === 'unreachable'
              ? t('Lolly could not reach its server to check. Try again when you are online.')
              : t('This server does not offer pages from any site. The desktop app can show any page.');
            msg.hidden = false;
          }
        });
        return;
      }
      const once = el.dataset.pwcOnce, always = el.dataset.pwcAlways;
      const row = rows[Number(once ?? always)];
      if (!row) return;
      if (once !== undefined) {
        consentToLink(row.link);
        settle(Number(once), t('Loads while this window stays open.'));
      } else {
        const entry = trustEntryFor(row.embed);
        el.disabled = true;
        void (entry ? trustSite(entry) : Promise.resolve(null)).then((saved) => {
          if (saved) settle(Number(always), t('Trusted. You can change this in your profile, under Trusted sites.'));
          else { el.disabled = false; consentToLink(row.link); settle(Number(always), t('Loads while this window stays open.')); }
        });
      }
    });
  });
}

/** Hydrate the engine's render, then decide web permissions before presentation starts. */
export async function preparePresentSource(
  runtime: Pick<import('../../../../engine/src/runtime.ts').Runtime, 'getHydrated' | 'applyEmojiToDom'>,
  opts: { loop?: boolean; ready: Promise<unknown>; isActive(): boolean },
): Promise<HTMLElement | null> {
  await opts.ready;
  if (!opts.isActive()) return null;
  const source = document.createElement('div');
  source.innerHTML = runtime.getHydrated();
  await runtime.applyEmojiToDom(source);
  if (!opts.loop && source.querySelector('.lolly-box-web')) {
    const rows = webCheckRows(source);
    if (webCheckIsRelevant(rows) && !(await openWebCheck(rows))) return null;
  }
  return opts.isActive() ? source : null;
}
