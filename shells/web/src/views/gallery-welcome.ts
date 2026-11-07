// SPDX-License-Identifier: MPL-2.0
/** First-use guidance can resolve before gallery cards and previews load. */
import { instanceFetch, instancePath } from '../lib/instance.ts';
import { activeDesignSystemSource } from '../lib/design-system/active.ts';
import { decideWelcome } from '../lib/welcome-gate.ts';
import { listWorkspaceTemplates, workspaceTemplateOf } from '../lib/workspace-templates.ts';
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
  return (assets ?? []).some((asset) => { const tpl = workspaceTemplateOf(asset as AssetRef); return !!tpl && !tpl.retired; });
}

async function galleryNeedsWelcome(host: GalleryHost, isCurrent: () => boolean): Promise<boolean> {
  try {
    if (await host.tokens?.isLocked?.()) return false;
    if ((await listWorkspaceTemplates(host)).some((tpl) => !tpl.retired)) return false;
    const source = await activeDesignSystemSource(host);
    if (source) return source === 'shipped';
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
