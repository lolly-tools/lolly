// SPDX-License-Identifier: MPL-2.0
/**
 * Module-level declarations of profile.ts that its feature modules use: the types,
 * constants and pure helpers that used to sit above mountProfile(). Moved here verbatim so
 * no feature module has to import the orchestrator file.
 *
 * The profile (settings) view: your details, the preference cards, storage and the offline manager.
 */
import type { AssetRef, AssetsAPI, HostV1, Profile, ProfileAPI } from '@lolly-tools/core/host-v1';
import { prefersReducedMotion } from '../../lib/a11y-prefs.ts';
import { t } from '../../i18n.ts';
import { mountModal } from '../../components/modal.ts';
import type { ModalHandle } from '../../components/modal.ts';
import { helpTip } from '../../components/help-tip.ts';
import { escape } from '../../utils.ts';
import { icon } from '../../lib/icons.ts';
import type { SessionEntry } from '../profile-storage-model.ts';

/** The slice of the tool-previews cache this view reads. */
export interface PreviewsSlice {
  list(): Promise<Array<{ thumb?: string | null }>>;
  size?(): Promise<number>;
  clear(): Promise<unknown>;
}

export interface IdentityInfo { provider?: string; email?: string }
export interface IdentityStatus {
  enrolled?: boolean;
  identity?: IdentityInfo;
  notBefore?: string;
  notAfter?: string;
  expired?: boolean;
}
export interface IdentityAPI {
  status(): Promise<IdentityStatus>;
  enroll(provider: string, opts?: { days?: number; email?: string }): Promise<IdentityStatus>;
  forget(): Promise<unknown>;
  completeEnrollment(token: string): Promise<IdentityStatus>;
}

export interface CaHealth { ok?: boolean; devProvider?: boolean; configured?: { github?: boolean; google?: boolean; suse?: boolean; email?: boolean } }

/**
 * The web bridge as this view drives it: HostV1 plus the host-UI-only surface
 * that isn't part of the tool-facing contract. `identity`/`previews` are the
 * concrete web-only APIs (WebHost declares them). The profile setter, the
 * user-asset helpers and `state.sizes` live on the web bridge at runtime but
 * aren't in the shared HostV1 types, so they're modelled as optional here (and
 * asserted present at the call sites, which only ever run in the web shell - 
 * this keeps main.ts's `mountProfile(view, WebHost)` call type-correct).
 */
export interface ProfileHost extends HostV1 {
  profile: ProfileAPI & {
    set?(profile: Profile): Promise<void>;
    bust?(): void;
  };
  assets: AssetsAPI & {
    _deleteUserAsset?(id: string): Promise<unknown>;
    _listUserAssets?(): Promise<AssetRef[]>;
    _uploadUserAsset?(record: Record<string, unknown>): Promise<void>;
    _blobCacheSize?(): Promise<number>;
    _userAssetsSize?(): Promise<number>;
  };
  state: {
    save(slot: string, data: object): Promise<void>;
    load(slot: string): Promise<object | null>;
    list(): Promise<SessionEntry[]>;
    delete(slot: string): Promise<void>;
    sizes?(): Promise<Record<string, number>>;
  };
  identity: IdentityAPI;
  previews: PreviewsSlice;
}

// Friendly labels for the raw profile field keys.
export const FIELD_LABELS: Record<string, string> = {
  firstname: 'First name', lastname: 'Last name', email: 'Email',
  phone: 'Phone', city: 'City', country: 'Country',
};

// Per-field input semantics - the right keyboard on mobile, native validation
// and autofill where it helps. Anything not listed falls back to a plain text
// input (autocomplete off, as before).
export const FIELD_ATTRS: Record<string, Record<string, string>> = {
  firstname: { type: 'text', autocomplete: 'given-name' },
  lastname:  { type: 'text', autocomplete: 'family-name' },
  email:     { type: 'email', inputmode: 'email', autocomplete: 'email' },
  phone:     { type: 'tel', autocomplete: 'tel' },
};
export const fieldAttrs = (f: string): string => {
  const a = FIELD_ATTRS[f] ?? { type: 'text', autocomplete: 'off' };
  return Object.entries(a).map(([k, v]) => `${k}="${escape(v)}"`).join(' ');
};

// The headshot lives in the user-assets store under one fixed id (so a new one
// overwrites the old and it only ever occupies a single slot), and is kept out
// of the "My images" library list.
export const HEADSHOT_ID = 'user/headshot';

// The default headshot when the user hasn't set one: the app mark (a vector), so
// a blank profile still reads as a real avatar. Shown as a placeholder only - the
// slot stays "empty" (Upload prompt, no Remove) until a real headshot is saved.
export const DEFAULT_HEADSHOT = '/icon.svg';

// The Storage manager's own ad-hoc mountModal dialogs (clear/hoard/keep-active/import
// gates + the user-image lightbox) - tracked here, mirroring confirm-dialog.ts's
// openDialogs, so mountProfile's _cleanup can close them on a view swap. A real
// <dialog> sits in the top layer, so an orphan left open would block the next view
// (unlike the body-level overlay divs these replaced).
export const openProfileModals = new Set<ModalHandle<any>>();

// Live "export and render everything" progress toasts. They're body-level like the
// dialogs above, so mountProfile's _cleanup drains them too - matching the Projects
// view, which has always torn its batch-export toasts down on navigate-away.
export const openProfileToasts = new Set<HTMLElement>();

// Randomised word the user must type to confirm the irreversible "clear all my
// data" action - a deliberate speed-bump against an accidental wipe.
export const CLEAR_CONFIRM_WORDS = ['lolly', 'open', 'free', 'privacy', 'choice', 'thank you', 'security', 'goodbye'];

// Playful word the user types to confirm the (heavy but SAFE) "export everything AND
// render it all" action. A speed-bump for a big job - potentially many renders + a large
// download - but the mood is celebratory data-ownership, NOT the sombre clear-data gate,
// so the two word pools never overlap. Kept short + lowercase for easy typing.
export const HOARD_CONFIRM_WORDS = ['hoard', 'mine', 'stash', 'vault', 'archive', 'homeward', 'liberate', 'agency', 'to the drive', 'own it', 'my data', 'keep it all'];

// Chevron for a collapsible section's summary (rotates 90° when open via CSS).
// Path data lives in lib/icons.ts as 'chevronRight' - was a <polyline>, same shape as
// the (deduped) <path> chevrons in gallery.ts/projects.ts (component-audit rec 5).
// `section-card-chev`/`-summary`/`-title`/`-body` ride alongside every
// `profile-collapse-*` class below - the shared fold primitive's sub-part
// names (disclosure.css, component audit rec 7). profile.css's own, more
// specific `.profile-view .profile-collapse …` rules still govern every
// pixel (this is prep for a later pass that thins profile.css onto the
// primitive, not a visual change today).
export const COLLAPSE_CHEV = icon('chevronRight', { size: 16, strokeWidth: 2.5, className: 'profile-collapse-chev section-card-chev' });
// Shield-with-check - the same glyph the gallery's green Verify button uses (deduped
// against footer-nav.ts's identical NAV_ICONS.shield as 'shieldCheck').
export const VERIFY_SHIELD = icon('shieldCheck', { size: 18 });
// Jump to the Verify view - styled to match the gallery's green Verify button.
// A function (not a module const) so t() runs at render time, after the catalog loads.
export const verifyLink = (): string => `<a href="#/verify" class="btn identity-verify-link" aria-label="${escape(t('Verify Content Credentials - check any file on-device'))}">${VERIFY_SHIELD}<span>${t('Verify a file')}</span></a>`;

// The settings-view section index - one entry per card, in page order. Drives the
// left nav rail, the scroll-spy active state, and the search filter. `id` MUST match
// the `id` on the corresponding `.profile-card`/`<details>` in the render below
// (pinned by profile-nav.test.ts); `keywords` are extra (untranslated) search terms
// so a query hits a section even when its label doesn't literally contain the word
// (e.g. "dark" → Appearance). The label is passed through t() at render time;
// keywords stay as an English aid.
// EXPORTED for the spotlight settings provider (lib/search/providers/settings.ts,
// plans/99 section 2b - settings findability is first-class): every entry becomes a
// search hit deep-linking to #/profile?focus=<id>, which the handler below
// honours for ANY section here, not just the collapsibles.
export interface ProfileNavSection {
  id: string;
  icon: Parameters<typeof icon>[0];
  label: string;
  keywords: string;
}
// Order is the page order, top to bottom (plans/163 section 4.2): what goes into
// your files first (your details, then the credentials that sign them), then how
// the app dresses for you, then where your work goes, then the data and app
// plumbing. "Lolly instance" is read-only info on the web, so it sits last.
export const NAV_SECTIONS: ReadonlyArray<ProfileNavSection> = [
  { id: 'details-section', icon: 'user', label: 'Your details', keywords: 'name email headshot photo avatar personal' },
  { id: 'identity-section', icon: 'credentialShield', label: 'Content Credentials', keywords: 'c2pa credentials provenance verify signing identity certificate' },
  // The design systems on this device (plans/186 section 5) - what every tool
  // renders with, so it sits with "how the app dresses" rather than the plumbing.
  { id: 'design-systems-section', icon: 'tokens', label: 'Design systems', keywords: 'design system brand tokens colours fonts logos switch hosted instance' },
  { id: 'appearance-section', icon: 'palette', label: 'Appearance', keywords: 'theme dark light mode colour color sound look' },
  { id: 'a11y-section', icon: 'eye', label: 'Accessibility', keywords: 'motion contrast large text previews comfort a11y reduce sound mute focus music neurospicy atmosphere' },
  // Sync across devices lives INSIDE this card (its own titled sub-block), so its
  // search keywords ride here - a query for "passphrase" or "icloud" must still land.
  { id: 'connections-section', icon: 'upload', label: 'Connected services', keywords: 'connect send drive dropbox onedrive s3 bucket nextcloud webdav providers oauth sync devices continuity snapshot backup cloud icloud across phone desktop passphrase encrypt' },
  { id: 'renders-section', icon: 'image', label: 'Your renders', keywords: 'renders downloads library save copy export tag auto-save' },
  { id: 'storage-section', icon: 'package', label: 'Storage', keywords: 'storage data space sessions images clear export delete' },
  { id: 'offline-section', icon: 'download', label: 'Available offline', keywords: 'offline download pwa install cache' },
  // Desktop shells only (plans/174) - the row hides itself elsewhere, but the
  // search keywords stay registered so a "hot folder" query still finds it.
  { id: 'hotfolder-section', icon: 'download', label: 'Hot folder', keywords: 'hot folder watch auto import ingest desktop drop directory' },
  { id: 'activity-section', icon: 'history', label: 'Your activity', keywords: 'activity usage metrics stats history recent' },
  { id: 'feature-flags-section', icon: 'flask', label: 'Feature flags', keywords: 'features experimental beta jelly neurospicy flags toggles' },
  { id: 'instance-section', icon: 'globe', label: 'Lolly instance', keywords: 'instance server source tools catalogue connect disconnect' },
];

// One collapsed card header: the section title, a short right-aligned value
// preview, then the chevron (plans/163 section 4.1). The value is what turns a
// page of folded cards into a dashboard - sections whose numbers need a lazy
// load render it empty and fill it in through setSummary() when that load
// returns, so nothing here waits on first paint.
export const summaryRow = (id: string, title: string, value = ''): string =>
  `<summary class="profile-collapse-summary section-card-summary"><h2 class="section-card-title">${title}</h2><span class="profile-summary-value" data-summary="${id}">${value}</span>${COLLAPSE_CHEV}</summary>`;

// Stand-in for a lazy section's body until its load returns. A plain static bar,
// deliberately never animated: a shimmer would be one more thing to switch off
// under Reduce motion, and the word "Loading…" told the reader nothing.
export const skeletonRow = (): string =>
  `<div class="profile-skeleton" role="status" aria-label="${escape(t('Loading'))}"></div>`;

// A small "i" badge with a hover/focus tooltip - used beside storage headings.
// Was a bespoke .info-dot/.info-tip pair; now the shared help-tip button
// (component audit rec 13), wrapped in its own positioning host so the pop
// anchors to the badge rather than stretching to match a page-width row - 
// `.help-tip-host`'s default (`left:0;right:0`, sized to the host) assumes a
// wide host like a sidebar `.input-row`, so the pop gets an inline auto-width
// override here (same recipe as tool.css's `.block-control > .help-tip-pop`)
// to keep it exactly the compact, left-anchored badge tooltip it always was.
export const infoDot = (text: string): string => {
  const tip = helpTip(text);
  const pop = tip.pop.replace(
    'class="help-tip-pop"',
    'class="help-tip-pop" style="right:auto;width:max-content;min-width:140px;max-width:230px"',
  );
  return `<span class="help-tip-host" style="display:inline-flex;vertical-align:middle">${tip.button}${pop}</span>`;
};

// Briefly rings a #/profile?focus=<id> deep-link target (see the handler in
// mountProfile) so the link visibly delivers, not just scrolls. Full motion: two
// pulses of a soft ring (`.is-focus-pulse`, profile.css). Reduced motion: the ring
// holds static, then fades out via a plain box-shadow transition - a colour
// change only, never movement.
export function pulseHighlight(el: HTMLElement): void {
  el.classList.add('is-focus-pulse');
  if (prefersReducedMotion()) {
    setTimeout(() => {
      el.classList.add('is-focus-pulse-out');
      setTimeout(() => el.classList.remove('is-focus-pulse', 'is-focus-pulse-out'), 650);
    }, 900);
  } else {
    setTimeout(() => el.classList.remove('is-focus-pulse'), 2400);
  }
}


export function clearIdbStores(storeNames: string[]) {
  return new Promise<void>((res, rej) => {
    const req = indexedDB.open('lolly');
    req.onerror = rej;
    req.onsuccess = e => {
      const db = (e.target as IDBOpenDBRequest).result;
      const tx = db.transaction(storeNames.filter(n => [...db.objectStoreNames].includes(n)), 'readwrite');
      tx.oncomplete = () => { db.close(); res(); };
      tx.onerror    = rej;
      storeNames.forEach(n => {
        if ([...db.objectStoreNames].includes(n)) tx.objectStore(n).clear();
      });
    };
  });
}

// Confirm + run a data import. The action may throw (not a backup, wrong format,
// quota); surface the reason in place and keep the dialog open rather than
// leaving the user guessing.
export function showImportDialog(onConfirm: () => Promise<void>) {
  const content = `
    <h3 id="import-dialog-title">${t('Import data?')}</h3>
    <p>${t('This imports your profile, sessions, uploaded assets, preferences and saved file history. Matching profile, session and asset IDs are updated; unrelated data is kept. Existing historical versions and result records are never overwritten. Keep the backup until every item is restored.')}</p>
    <p class="import-error" style="color:hsl(var(--destructive));font-size:13px;margin:0" hidden></p>
    <div class="clear-dialog-actions">
      <button class="btn" data-scope="import">${t('Import')}</button>
      <button class="btn" data-scope="cancel">${t('Cancel')}</button>
    </div>`;
  const modal = mountModal<void>(content, {
    className: 'clear-dialog',
    initialFocus: (el) => el.querySelector<HTMLElement>('[data-scope="import"]'),
    onClose: () => openProfileModals.delete(modal),
  });
  modal.el.setAttribute('aria-labelledby', 'import-dialog-title');
  openProfileModals.add(modal);

  modal.el.addEventListener('click', async e => {
    const scope = (e.target as Element).closest<HTMLElement>('[data-scope]')?.dataset.scope;
    if (!scope) return;
    if (scope === 'cancel') { modal.close(); return; }

    const btns = modal.el.querySelectorAll('button');
    const errEl = modal.el.querySelector<HTMLElement>('.import-error');
    btns.forEach(b => (b.disabled = true));
    (e.target as HTMLElement).textContent = t('Importing…');
    try {
      await onConfirm();
      modal.close(); // success re-mounts the page; drop the dialog
    } catch (err) {
      if (errEl) { errEl.textContent = (err as { message?: string })?.message || t('Import failed.'); errEl.hidden = false; }
      btns.forEach(b => (b.disabled = false));
      (e.target as HTMLElement).textContent = t('Import');
    }
  });
}

// Store the cropped square WebP in the user-assets store (one fixed id, so it
// overwrites) and record the resulting AssetRef on the profile (sans the volatile
// object URL - consumers re-resolve by id). A fresh version each time avoids the
// bridge's id:format:version object-URL cache masking the new image.
export async function saveHeadshot(host: ProfileHost, blob: Blob, opts: { vector?: boolean } = {}): Promise<AssetRef> {
  const record = opts.vector
    ? {
        id: HEADSHOT_ID, type: 'vector', format: 'svg', blob,
        version: String(Date.now()), meta: { name: 'headshot.svg', tags: ['headshot'] },
      }
    : {
        id: HEADSHOT_ID, type: 'raster', format: 'webp', blob,
        width: 512, height: 512, version: String(Date.now()),
        meta: { name: 'headshot.webp', tags: ['headshot'] },
      };
  await host.assets._uploadUserAsset!(record);
  const ref = await host.assets.get(HEADSHOT_ID);
  const { source, id, type, format, version, width, height, meta } = ref;
  const current = await host.profile.get();
  await host.profile.set!({ ...current, headshot: { source, id, type, format, version, width, height, meta } as AssetRef });
  return ref;
}
