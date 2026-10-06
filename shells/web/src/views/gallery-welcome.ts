// SPDX-License-Identifier: MPL-2.0
/** First-use guidance can resolve before gallery cards and previews load. */
import { instanceFetch, instancePath } from '../lib/instance.ts';
import { activeDesignSystemSource } from '../lib/design-system/active.ts';
import { decideWelcome } from '../lib/welcome-gate.ts';
import type { GalleryHost } from './gallery.ts';
import type { PickerHost } from './picker.ts';

async function galleryNeedsWelcome(host: GalleryHost, isCurrent: () => boolean): Promise<boolean> {
  try {
    if (await host.tokens?.isLocked?.()) return false;
    const source = await activeDesignSystemSource(host);
    if (source) return source === 'shipped';
    let tokensId = (await host.assets._findMetaByType('tokens'))?.id;
    if (tokensId === undefined && isCurrent()) {
      const response = await instanceFetch(instancePath('/catalog/assets/index.json'));
      if (response.ok) {
        const index = await response.json() as { assets?: Array<{ id?: string; type?: string }> };
        tokensId = index.assets?.find(asset => asset.type === 'tokens')?.id;
      }
    }
    return tokensId === 'lolly/tokens/brand';
  } catch { return false; }
}

type WelcomeModule = typeof import('../components/welcome-dialog.ts');
type WelcomeStep =
  | { unbranded: false }
  | { unbranded: true; welcome: WelcomeModule; closed: Promise<unknown> | null };

/** Keep maintenance behind the welcome decision and preserve route teardown. */
export function galleryWelcomeStep(host: GalleryHost & PickerHost, isCurrent: () => boolean, force = false): Promise<WelcomeStep | null> {
  return decideWelcome(async (): Promise<WelcomeStep | null> => {
    if (!await galleryNeedsWelcome(host, isCurrent)) return { unbranded: false };
    const welcome = await import('../components/welcome-dialog.ts');
    if (!isCurrent()) return null;
    const due = force || !welcome.isWelcomeDismissed();
    return { unbranded: true, welcome, closed: due ? welcome.showWelcomeDialog(host.profile, host) : null };
  }, force);
}

/** Resolve the decision once brand assets arrive, without waiting for dismissal. */
export async function showGalleryWelcome(host: GalleryHost & PickerHost, isCurrent: () => boolean): Promise<void> {
  await galleryWelcomeStep(host, isCurrent);
}
