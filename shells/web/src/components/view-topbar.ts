// SPDX-License-Identifier: MPL-2.0
/**
 * The top chrome shared by Tools and Catalog (component-audit rec 11 - the
 * `.gallery-topbar` + `.gallery-topright` + profile-pill cluster was hand-copied
 * between gallery.ts and catalog.ts). Each view still owns its OWN popover
 * content (the gallery's sort/filter popover vs the catalog's view-options
 * popover - passed through `popover`) and its own extra trigger button(s)
 * (filter-fab / history-fab vs the view-options button - passed through
 * `right`); only the shell around them - the view-toggle, the language FAB,
 * the profile pill, and their wiring - is unified here.
 *
 * viewTopbarHtml() renders the markup; mountViewTopbar() wires the parts that
 * never vary: the language menu and the profile pill's mobile menu, plus an
 * optional deferred avatar fetch.
 *
 * Reconciled drift (gallery vs catalog, picked deliberately):
 * - Avatar timing differed - gallery resolves the headshot AFTER first paint
 *   (a blob fetch + createObjectURL that would otherwise delay the whole
 *   view), catalog resolved it before its first render. Both are still
 *   possible here: pass an already-resolved `profile.headshotUrl` to
 *   `viewTopbarHtml` (catalog's way), or a `headshotId` to `mountViewTopbar`
 *   for the deferred fetch-and-swap-in (gallery's way) - never both.
 * - The profile pill's markup itself already matched (name span always
 *   present; the `<img>` + `.has-avatar` are additive), so that needed no
 *   reconciling.
 */
import { escape } from '../utils.ts';
import { t, LANG_ICON_SVG } from '../i18n.ts';
import { viewToggle, type ViewToggleKey } from './view-toggle.ts';
import { LOLLY_MARK_SVG } from '../lib/lolly-mark.ts';
import type { HostV1 } from '@lolly-tools/core/host-v1';

export interface ViewTopbarProfile {
  firstname?: string;
  /** Already-resolved avatar URL, if the caller has one at render time (catalog's way). */
  headshotUrl?: string;
}

export interface ViewTopbarHtmlOpts {
  /** Which tab is active in the Tools|Projects|Catalog toggle. */
  active: ViewToggleKey;
  /** View-specific trigger button(s) (filter-fab, history-fab, the view-options
   *  button…), rendered before the language FAB - the one part that's genuinely
   *  different between views. */
  right?: string;
  /** The view's own popover (filter popover / view-options popover…), rendered
   *  last inside `.gallery-topright` so it anchors off the same fixed cluster.
   *  The view wires its own open/close - this only places the markup. */
  popover?: string;
  profile: ViewTopbarProfile;
}

/** The `.gallery-topbar` shell: view-toggle + top-right cluster (right-slot
 *  buttons, language FAB, profile pill, then the view's own popover). */
export function viewTopbarHtml(opts: ViewTopbarHtmlOpts): string {
  const { active, right = '', popover = '', profile } = opts;
  const hasAvatar = !!profile.headshotUrl;
  return `
    <div class="gallery-topbar">
      <div class="view-toggle-wrap">${viewToggle(active)}</div>
      <div class="gallery-topright">
        ${right}
        <button type="button" class="lang-fab" aria-label="${escape(t('Language'))}" aria-haspopup="menu" aria-expanded="false" title="${escape(t('Language'))}">${LANG_ICON_SVG}</button>
        <a href="#/profile" class="profile-link${hasAvatar ? ' has-avatar' : ''}" aria-label="${escape(t('Open your profile'))}" aria-haspopup="menu" aria-expanded="false">${hasAvatar ? `<img class="profile-link-avatar" src="${escape(profile.headshotUrl!)}" alt="">` : ''}<span class="profile-link-mark" aria-hidden="true">${LOLLY_MARK_SVG}</span><span class="profile-link-name">${escape(profile.firstname || t('Profile'))}</span></a>
        ${popover}
      </div>
    </div>`;
}

export interface MountViewTopbarOpts {
  /** Passed straight through to attachProfileMenu (saved-session count + history opener). */
  profileMenu?: { savedCount?: number; onHistory?: () => void };
  /** A headshot asset id to resolve AFTER first paint (gallery's pattern). Skip this
   *  when the caller already resolved `headshotUrl` for viewTopbarHtml (catalog's pattern) - 
   *  passing both would fetch a headshot the markup already shows. */
  headshotId?: string;
}

/** Wires the parts of the top bar that never vary between views: the language
 *  menu, the profile pill's mobile menu, and (optionally) a deferred avatar fetch. */
export function mountViewTopbar(viewEl: HTMLElement, host: HostV1, opts: MountViewTopbarOpts = {}): void {
  // The profile pill's popover, lazy-loaded for the same reason as the language menu
  // below and on the same terms: the pill's markup (including its menu semantics) is
  // rendered above, and opening it is a gesture. attachProfileMenu's whole synchronous
  // half was setting those two aria attributes, which viewTopbarHtml now writes - so
  // what is deferred is only the popover body. Worth 1.9 KB gz off first paint: this is
  // the topbar's only boot importer of it (plans/155 WP-3).
  void import('./profile-menu.ts').then(m => m.attachProfileMenu(viewEl.querySelector<HTMLElement>('.profile-link'), host, opts.profileMenu));
  // The language menu's dropdown logic (components/lang-menu.ts) is lazy-loaded OFF the boot
  // path - the fab is inline markup above, and the menu is a click gesture. Fire-and-forget
  // at mount so it wires within ~ms (a fab click in that sliver just no-ops once). This is
  // the ONLY boot importer of lang-menu; the lazy views keep their own static import.
  void import('./lang-menu.ts').then((m) => m.attachLangMenu(viewEl.querySelector<HTMLElement>('.lang-fab'), host));

  // Off-first-paint avatar swap-in (gallery's pattern) - resolved OFF the first-paint path:
  // the headshot is a blob fetch + createObjectURL (and the stored object URL goes stale
  // across reloads, so it must be re-fetched by id) - awaiting it before the initial
  // innerHTML would delay the whole view. Fire-and-forget; a failure just leaves the
  // name-only pill standing. Re-queries `.profile-link` at resolve time (not captured
  // above) so a torn-down/replaced view can't be written into.
  if (opts.headshotId) {
    const headshotId = opts.headshotId;
    void host.assets.get(headshotId).then(res => {
      const url = res?.url;
      if (!url) return;
      const link = viewEl.querySelector<HTMLElement>('.profile-link');
      if (!link || !link.isConnected) return;
      let img = link.querySelector<HTMLImageElement>('.profile-link-avatar');
      if (!img) {
        img = document.createElement('img');
        img.className = 'profile-link-avatar';
        img.alt = '';
        link.prepend(img);
      }
      img.src = url;
      link.classList.add('has-avatar');
    }).catch(() => { /* no avatar - the name-only pill stands */ });
  }
}
