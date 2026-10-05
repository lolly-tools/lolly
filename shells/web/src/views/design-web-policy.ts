// SPDX-License-Identifier: MPL-2.0
/** Approval belongs beside the web link and changes only this person's site choices. */
import { parseWebEmbed, type WebEmbed } from '../../../../engine/src/web-embed.ts';
import { trustedSiteHost } from '../../../../engine/src/trusted-sites.ts';
import { t } from '../i18n.ts';
import type { IconName } from '../lib/icons.ts';
import { anySiteApplies, enterAnySite, probeAnySite } from '../lib/any-site.ts';
import { canTrustMore, trustSite } from '../lib/trusted-sites.ts';
import { consentToLink, policyNote, trustEntryFor, webFrameState, webSiteVerdict } from '../lib/design-web-mount.ts';

export function webApprovalRows(
  embed: WebEmbed, read: (label: string, value: string) => string,
  button: (label: string, action: string, glyph: IconName) => string,
): string {
  const verdict = webSiteVerdict(embed), state = webFrameState(embed, 'editor');
  if (state === 'policy') return read(t('Site'), policyNote(embed));
  if (state === 'refused') return read(t('Site'), t('This site does not allow being shown inside other pages.'));
  if (state === 'browser') return read(t('Site'), t('This browser cannot show other sites inside Lolly. Chrome, Edge and Safari can show the page.'));
  const entry = trustEntryFor(embed);
  if (state === 'ask' || state === 'blocked') {
    const actions = state !== 'blocked' || anySiteApplies();
    return read(t('Site'), t('Approve this site to load it in the document.'))
      + (actions ? button(t('Allow this time'), 'webapprove', 'globe') : '')
      + (actions && entry && canTrustMore() && verdict.state !== 'trusted'
        ? button(t('Always trust {host}', { host: trustedSiteHost(entry) }), 'webtrust', 'shieldCheck') : '')
      + (state === 'blocked' ? read(t('After approval'), t('Lolly reloads this document to show external pages. Other sites still need your approval.')) : '');
  }
  const by = verdict.state !== 'trusted' ? t('Allowed for this session')
    : verdict.source === 'organisation' ? (verdict.by ? t('Trusted by {org}', { org: verdict.by }) : t('Trusted by your organisation'))
      : verdict.source === 'brand' ? t('Trusted by your brand')
        : verdict.source === 'default' ? t('Trusted reference site') : t('Trusted by you');
  return read(t('Site'), by);
}

export async function approveWebLink(
  link: string, remember = false,
  navigation = { probe: probeAnySite, enter: enterAnySite },
): Promise<{ ok: boolean; message?: string }> {
  const embed = parseWebEmbed(link, { appOrigin: location.origin });
  const state = webFrameState(embed, 'editor');
  if (!embed || ['invalid', 'policy', 'refused', 'browser', 'poster'].includes(state)) {
    return { ok: false, message: state === 'policy' ? policyNote(embed) : t('This page cannot load inside the document. Open it in a new tab.') };
  }
  if (state === 'blocked') {
    const offer = await navigation.probe();
    if (offer !== 'offered') return { ok: false, message: offer === 'unreachable'
      ? t('Lolly could not reach its server to check. Try again when you are online.')
      : t('This server does not offer pages from any site. The desktop app can show any page.') };
  }
  // Recheck after the server probe: a policy change during the wait still wins.
  if (webSiteVerdict(embed).state === 'blocked') return { ok: false, message: policyNote(embed) };
  if (remember) {
    const entry = trustEntryFor(embed);
    if (!entry || !await trustSite(entry)) return { ok: false, message: t('Could not save this site. Try again.') };
  } else consentToLink(link);
  if (state === 'blocked' && !navigation.enter()) return { ok: false, message: t('Allow browser storage for Lolly, then try again.') };
  return { ok: true };
}
