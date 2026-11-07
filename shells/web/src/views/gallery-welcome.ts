// SPDX-License-Identifier: MPL-2.0
/** First-use guidance can resolve before gallery cards and previews load. */
import { instanceFetch, instancePath } from '../lib/instance.ts';
import { activeDesignSystemSource } from '../lib/design-system/active.ts';
import { decideWelcome } from '../lib/welcome-gate.ts';
import { isWorkspaceTemplateRef, listWorkspaceTemplates, workspaceCompany, workspaceCompanySettled, workspaceGoverned, workspaceTemplateOf } from '../lib/workspace-templates.ts';
import type { AssetRef } from '@lolly-tools/core/host-v1';
// The welcome is first content on a new public visit; fetch its code and CSS with boot.
import * as welcome from '../components/welcome-dialog.ts';
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
  try {
    if (await host.tokens?.isLocked?.()) return false;
    // Someone the workspace puts in a company opens on its shelf, which their company
    // card leads, even before anything is published to them (plans/82 M3). A first
    // visit decides before the instance has said who they are, so wait for that
    // answer (bounded) instead of offering the welcome a company does not need.
    await workspaceCompanySettled();
    if (hasCompany()) return false;
    if ((await listWorkspaceTemplates(host)).some((tpl) => !tpl.retired)) return false;
    const source = await activeDesignSystemSource(host);
    if (source) {
      if (source !== 'shipped') return false;
      // A workspace member's first visit has not synced what is published to them
      // yet, so ask the served index once. Offline, or with nothing published, the
      // welcome stays. A plain build has no workspace and never makes this read.
      if (workspaceGoverned() && isCurrent()) {
        const response = await instanceFetch(instancePath('/catalog/assets/index.json?paged=1')).catch(() => null);
        if (response?.ok && hasPublishedTemplates(((await response.json()) as { assets?: Array<Partial<AssetRef>> }).assets)) return false;
      }
      return true;
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
    return tokensId === 'lolly/tokens/brand';
  } catch { return false; }
}

type WelcomeModule = typeof welcome;
type WelcomeStep =
  | { unbranded: false }
  | { unbranded: true; welcome: WelcomeModule; closed: Promise<unknown> | null };

/** Keep maintenance behind the welcome decision and preserve route teardown. */
export function galleryWelcomeStep(host: GalleryHost & PickerHost, isCurrent: () => boolean, force = false): Promise<WelcomeStep | null> {
  return decideWelcome(async (): Promise<WelcomeStep | null> => {
    if (!await galleryNeedsWelcome(host, isCurrent)) return { unbranded: false };
    if (!isCurrent()) return null;
    const due = force || !welcome.isWelcomeDismissed();
    return { unbranded: true, welcome, closed: due ? welcome.showWelcomeDialog(host.profile, host) : null };
  }, force);
}

/** Resolve the decision once brand assets arrive, without waiting for dismissal. */
export async function showGalleryWelcome(host: GalleryHost & PickerHost, isCurrent: () => boolean): Promise<void> {
  await galleryWelcomeStep(host, isCurrent);
}
