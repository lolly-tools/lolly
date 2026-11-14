// SPDX-License-Identifier: MPL-2.0
/** First-use guidance can resolve before gallery cards and previews load. */
import { instanceFetch, instancePath } from '../lib/instance.ts';
import { activeDesignSystemRecord } from '../lib/design-system/active.ts';
import { decideWelcome, isWelcomeDismissed } from '../lib/welcome-gate.ts';
import { viewingAs } from '../org/view-as.ts';
import { isWorkspaceTemplateRef, listWorkspaceTemplates, workspaceCompany, workspaceCompanySettled, workspaceGoverned, workspaceTemplateOf } from '../lib/workspace-templates.ts';
import type { AssetRef } from '@lolly-tools/core/host-v1';
// The welcome is first content on a new public visit; fetch its code and CSS with boot.
import * as welcome from '../components/welcome-dialog.ts';
import { adoptWelcomeHero, closeWelcomeHero, showWelcomeHero, welcomeHeroOpen, type WelcomeAudience, type WelcomePrivacy } from '../components/welcome-hero.ts';
import { ackPrivacyNotice, connectedWorkspace, WORKSPACE_PRIVACY_HREF, workspacePrivacyLine } from './privacy-notice.ts';
import { docsAppHref, t } from '../i18n.ts';
import type { GalleryHost } from './gallery.ts';
import type { PickerHost } from './picker.ts';

/**
 * Whether a connected workspace published a template this person can start from. Such a
 * person (a partner, say) already has their welcome: the home shelf of those templates,
 * so "Make it yours" would only stand between them and the shelf. Exported for tests.
 */
export function hasPublishedTemplates(assets: ReadonlyArray<Partial<AssetRef>> | undefined): boolean {
  return (assets ?? []).some((asset) => {
    const tpl = workspaceTemplateOf(asset as AssetRef);
    if (tpl) return !tpl.retired;
    // A Share with rules file the workspace published is on the shelf the same way.
    const meta = (asset.meta ?? {}) as Record<string, unknown>;
    return (asset.type as string) === 'rules-tool' && isWorkspaceTemplateRef(asset.id)
      && typeof meta.toolId === 'string' && !!meta.toolId && meta.retired !== true;
  });
}

/** Whether the workspace gives this person a company with details. Exported for tests. */
export function hasCompany(): boolean {
  const c = workspaceCompany();
  return !!c && (c.revision ?? 0) > 0;
}

/** Whether this gallery visit is due the welcome. Exported for tests. */
export async function galleryNeedsWelcome(host: GalleryHost, isCurrent: () => boolean): Promise<boolean> {
  return (await galleryWelcomeAudience(host, isCurrent)) !== null;
}

/** The placeholder brand an unbranded install (Lolly Start) runs on until someone makes it theirs. */
const PLACEHOLDER_TOKENS_ID = 'lolly/tokens/brand';

/**
 * Who this gallery visit's welcome is for, or null when none is due: 'demo' on a
 * shipped design system to try (Lolly Demo on lolly.tools), 'blank' on an install
 * still on the placeholder brand (Lolly Start). Exported for tests.
 */
export async function galleryWelcomeAudience(host: GalleryHost, isCurrent: () => boolean): Promise<WelcomeAudience | null> {
  const due = await welcomeDue(host, isCurrent);
  return due === false ? null : due;
}

async function welcomeDue(host: GalleryHost, isCurrent: () => boolean): Promise<WelcomeAudience | false> {
  try {
    if (await host.tokens?.isLocked?.()) return false;
    // Someone the workspace puts in a company opens on its shelf, which their company
    // card leads, even before anything is published to them (plans/82 M3). A first
    // visit decides before the instance has said who they are, so wait for that
    // answer (bounded) instead of offering the welcome a company does not need.
    await workspaceCompanySettled();
    if (hasCompany()) return false;
    if ((await listWorkspaceTemplates(host)).some((tpl) => !tpl.retired)) return false;
    const record = await activeDesignSystemRecord(host);
    const source = record?.source.kind ?? null;
    if (source) {
      if (source !== 'shipped') return false;
      // A workspace member's first visit has not synced what is published to them
      // yet, so ask the served index once. Offline, or with nothing published, the
      // welcome stays. A plain build has no workspace and never makes this read.
      if (workspaceGoverned() && isCurrent()) {
        const response = await instanceFetch(instancePath('/catalog/assets/index.json?paged=1')).catch(() => null);
        if (response?.ok && hasPublishedTemplates(((await response.json()) as { assets?: Array<Partial<AssetRef>> }).assets)) return false;
      }
      return record?.headId === PLACEHOLDER_TOKENS_ID ? 'blank' : 'demo';
    }
    let tokensId = (await host.assets._findMetaByType('tokens'))?.id;
    if (tokensId === undefined && isCurrent()) {
      const response = await instanceFetch(instancePath('/catalog/assets/index.json?paged=1'));
      if (response.ok) {
        const index = await response.json() as { assets?: Array<Partial<AssetRef>> };
        // The same read answers for templates this device has not synced yet.
        if (hasPublishedTemplates(index.assets)) return false;
        tokensId = index.assets?.find(asset => asset.type === 'tokens')?.id;
      }
    }
    return tokensId === PLACEHOLDER_TOKENS_ID ? 'blank' : false;
  } catch { return false; }
}

/** The privacy promise the greeting carries: the notice's own words when a workspace keeps the work. */
function welcomePrivacy(): WelcomePrivacy {
  const workspace = connectedWorkspace();
  if (workspace) return { text: workspacePrivacyLine(workspace), href: WORKSPACE_PRIVACY_HREF };
  return { text: t('No accounts, no tracking. Your work stays on this device.'), href: docsAppHref('trust/privacy') };
}

/**
 * Who the last greeting was for, so a later visit that has not settled the welcome can
 * put the card in the gallery's first paint. On such a visit the gallery paints from
 * its cached index before the decision can answer, and a card added after that pushes
 * the whole gallery down. The decision still runs and takes the card away if it is no
 * longer due. Exported for tests.
 */
export const WELCOME_AUDIENCE_KEY = 'lolly-welcome-audience';

function rememberAudience(audience: WelcomeAudience | null): void {
  try {
    if (audience) localStorage.setItem(WELCOME_AUDIENCE_KEY, audience);
    else localStorage.removeItem(WELCOME_AUDIENCE_KEY);
  } catch { /* storage off: the card waits for the decision */ }
}

function rememberedAudience(): WelcomeAudience | null {
  try {
    const audience = localStorage.getItem(WELCOME_AUDIENCE_KEY);
    return audience === 'demo' || audience === 'blank' ? audience : null;
  } catch { return null; }
}

/**
 * Put the greeting in a gallery that is mounting, in the same task as the gallery's
 * markup, so the card is in its first paint. A card the decision already opened (a
 * first visit, where the decision usually comes before the gallery) moves in; failing
 * that, a visit after one that showed the greeting opens it from the remembered
 * audience. Neither waits for anything, so neither can move the gallery later.
 */
export function placeGalleryWelcome(root: HTMLElement | null, host: GalleryHost & PickerHost, opts: { classic?: boolean } = {}): void {
  if (welcomeHeroOpen()) { adoptWelcomeHero(root); return; }
  if (!root || opts.classic || viewingAs() || isWelcomeDismissed()) return;
  const audience = rememberedAudience();
  if (!audience) return;
  void showWelcomeHero(root, { audience, privacy: welcomePrivacy(), ackPrivacy: ackPrivacyNotice, profileApi: host.profile, uploadHost: host });
}

type WelcomeModule = typeof welcome;
type WelcomeStep =
  | { unbranded: false }
  | { unbranded: true; welcome: WelcomeModule; closed: Promise<unknown> | null; inPlace: boolean };

/**
 * Keep maintenance behind the welcome decision and preserve route teardown. The
 * welcome is the greeting in place at the top of the gallery (`root`); the dialog
 * it replaced opens instead with `classic` (#/?welcome=classic), or when there is
 * no gallery to greet in.
 */
export function galleryWelcomeStep(
  host: GalleryHost & PickerHost, isCurrent: () => boolean, force = false,
  opts: { classic?: boolean; root?: () => HTMLElement | null } = {},
): Promise<WelcomeStep | null> {
  return decideWelcome(async (): Promise<WelcomeStep | null> => {
    // Viewing as a partner: no welcome, even with ?welcome, and nothing is recorded.
    if (viewingAs()) return { unbranded: false };
    const audience = await galleryWelcomeAudience(host, isCurrent);
    if (!audience) {
      // Not due (any more): a card opened from the last visit's answer goes, unsettled.
      rememberAudience(null);
      closeWelcomeHero();
      return { unbranded: false };
    }
    if (!isCurrent()) return null;
    const due = force || !welcome.isWelcomeDismissed();
    // Every caller agrees on the form: the address says when the classic dialog is
    // asked for. The greeting goes at the top of the gallery; when main.ts asks before
    // the gallery has mounted, the card waits out of the page and the gallery's own
    // mount places it (placeGalleryWelcome), so it never shows in the loading view.
    const classic = opts.classic ?? /[?&]welcome=classic(?:&|$)/.test(globalThis.location?.hash ?? '');
    if (!due) return { unbranded: true, welcome, closed: null, inPlace: !classic };
    if (!classic) {
      rememberAudience(audience);
      const root = opts.root?.() ?? document.querySelector<HTMLElement>('.gallery');
      const closed = showWelcomeHero(root, { audience, privacy: welcomePrivacy(), ackPrivacy: ackPrivacyNotice, profileApi: host.profile, uploadHost: host });
      return { unbranded: true, welcome, closed, inPlace: true };
    }
    return { unbranded: true, welcome, closed: welcome.showWelcomeDialog(host.profile, host), inPlace: false };
  }, force);
}

/** Resolve the decision once brand assets arrive, without waiting for dismissal. */
export async function showGalleryWelcome(host: GalleryHost & PickerHost, isCurrent: () => boolean): Promise<void> {
  await galleryWelcomeStep(host, isCurrent);
}
