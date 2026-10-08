// SPDX-License-Identifier: MPL-2.0
/** Existing Web page properties share the inspector's standard row components. */
import { parseWebEmbed } from '../../../../engine/src/web-embed.ts';
import { t } from '../i18n.ts';
import type { IconName } from '../lib/icons.ts';
import type { Box, BoxFieldConfig } from './free-canvas-math.ts';
import { opt } from './free-canvas-fields.ts';
import { webPlaybackRows } from './design-web-playback.ts';
import { webApprovalRows } from './design-web-policy.ts';

export interface WebSectionPort {
  cfg: BoxFieldConfig & { imageField?: string };
  F_WEB: string | undefined;
  fv(box: Box, field: string | undefined): unknown;
  clampN(value: unknown, fallback: number, min: number, max: number): number;
  boolOf(value: unknown, fallback: boolean): boolean;
  textRow(label: string, field: string, value: unknown, placeholder?: string): string;
  readRow(label: string, value: string): string;
  selectRow(label: string, field: string, choices: Array<[string, string]>, current: unknown): string;
  toggleRow(label: string, field: string, on: boolean): string;
  doorBtn(label: string, action: string, glyph: IconName): string;
}

export function webSectionRows(b: Box, port: WebSectionPort): string {
  const { cfg, F_WEB, fv, clampN, boolOf, textRow, readRow, selectRow, toggleRow, doorBtn } = port;
  const link = String(fv(b, F_WEB) ?? '').trim();
  const embed = link ? parseWebEmbed(link, { appOrigin: location.origin }) : null;
  const shows = !link ? t('No link yet')
    : !embed ? t('This link cannot be shown in a box')
      : embed.refuses ? t('{label}: the site does not allow being shown inside other pages', { label: embed.label })
        : embed.label;
  const view = Math.max(0, Math.round(clampN(fv(b, 'webView'), 0, 0, 3840)));
  const views: Array<[string, string]> = [['0', t('Box size')], ['1280', t('Desktop (1280)')], ['1024', t('Tablet (1024)')], ['390', t('Phone (390)')]];
  if (!views.some(([v]) => Number(v) === view)) views.push([String(view), t('{n} px wide', { n: view })]);
  return textRow(t('Link'), 'web', link, 'https://…')
    + readRow(t('Shows'), shows)
    + `<label class="fc-row"><span>${t('Lay out as')}</span><select class="field-select field-select--sm" data-fld="webView" data-kind="num">`
    + views.map(([v, l]) => opt(v, l, String(view))).join('') + '</select></label>'
    + selectRow(t('When presenting'), 'webLoad', [
      ['slide', t('With its slide')], ['early', t('One slide early')],
      ['keep', t('Keep running')], ['click', t('Wait for a click')],
    ], String(fv(b, 'webLoad') ?? '') || 'slide')
    + (embed ? webPlaybackRows(embed) : '')
    + (embed && !embed.sameOrigin ? webApprovalRows(embed, readRow, doorBtn) : '')
    + (embed && !embed.refuses ? doorBtn(t('Use page'), 'webuse', 'externalLink') : '')
    + (embed?.sameOrigin && embed.provider !== 'sandbox'
      ? toggleRow(t('Hide cookie banners'), 'webHideCookies', boolOf(fv(b, 'webHideCookies'), false))
        + doorBtn(fv(b, 'webCss') ? t('Edit page CSS') : t('Add page CSS'), 'webcss', 'code')
        + readRow(t('Appearance'), t('Live page only. Hiding a banner does not accept cookies.'))
      : embed && !embed.refuses ? readRow(t('Cookie banners'), t('Use page to reject cookies or close the banner. This site controls its own CSS.')) : '')
    + doorBtn(cfg.imageField && b[cfg.imageField] ? t('Change poster') : t('Choose poster'), 'pickimage', 'image')
    + (embed?.kind === 'lolly'
      ? doorBtn(embed.provider === 'sandbox' ? t('Edit in Sandbox') : t('Edit in the tool'), 'webedit', 'code')
        + doorBtn(t('Refresh poster'), 'webposter', 'refresh')
      : embed ? doorBtn(t('Open in new tab'), 'webopen', 'externalLink') : '');
}
