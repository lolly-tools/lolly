// SPDX-License-Identifier: MPL-2.0
/**
 * Profile view - personal details + appearance preferences.
 *
 * Theme selection auto-saves on click (it's a preference, not a form field), as
 * do the sound switch and the Accessibility card's four prefs (Reduce motion,
 * Hide colourful previews, High contrast, Large text - A11Y_ROWS below).
 * The other personal details save on form submit.
 *
 * Activity / Storage / Feature flags / Content Credentials are collapsible
 * sections, collapsed by default. Storage and Content Credentials are also
 * LAZY: their expensive work (storage estimate, asset listing/sizes, the
 * image-thumbnail grid; identity status + the CA health probe) is deferred
 * until the section is expanded, so first paint only awaits the profile +
 * headshot.
 */

import '../styles/parts/profile.css';   // async CSS chunk (lazy view - not on the landing)
import { presentApis } from '@lolly-tools/core/host-v1';
import '../styles/parts/tool.css';      // .help-tip-btn/-pop/-host styles - shared chunk with the
                                         // tool view, same reuse the .tool-inputs sheet already gets
                                         // from multi-edit.ts (component audit rec 13)
import '../styles/parts/storage.css';   // the storage-reconciliation meter lives in /profile
import '../styles/parts/offline-manager.css'; // the "Offline tools" download manager section
import { applyTheme, currentTheme, THEMES, THEME_LABELS, THEME_ICONS } from '../theme.ts';
import { setTheme } from '../lib/set-theme.ts';
import { currentA11yPrefs, setA11yPref, prefersReducedMotion } from '../lib/a11y-prefs.ts';
import { chromeFollowsDesignSystem, setChromeFollow } from '../lib/chrome-follow.ts';
import { fold, tokenize, scoreHaystack } from '../lib/search/match.ts';
import { captureNeutralPinned } from '../lib/capture-neutral.ts';
import type { A11yPrefs } from '../lib/a11y-prefs.ts';
import { currentLang, switchLang, t, tRaw, docsAppHref } from '../i18n.ts';
import type { Lang } from '../i18n.ts';
import { langFabHtml, attachLangMenu } from '../components/lang-menu.ts';
import { playSfx } from '../lib/sfx.ts';
import { staggerReveal } from '../lib/reveal.ts';
import { soundSwitchHtml, wireSoundSwitch } from '../components/sound-toggle.ts';
import { isHiddenSlot } from '../lib/batch-slots.ts';
import { mountModal } from '../components/modal.ts';
import type { ModalHandle } from '../components/modal.ts';
import { startBatchExport } from '../lib/batch-job.ts';
import { helpTip, wireHelpTips, linkHelpDescriptions } from '../components/help-tip.ts';
import { escape } from '../utils.ts';
import { icon } from '../lib/icons.ts';
import { announce } from '../a11y.ts';
import { getMetrics } from '../metrics.ts';
import { renderActivity } from '../lib/activity-summary.ts';
import { openHeadshotCropper } from '../components/headshot-cropper.ts';
import { sanitizeSvgToString } from '../bridge/svg-sanitize.ts';
import { storeUserUpload } from './picker.ts';
import { CATEGORY_FLAGS, CONNECTOR_FLAGS, NEUROSPICY_FLAG, JELLY_FLAG, WOBBLY_FLAG, WOBBLY_MESH_FLAG, STRIP_UPLOAD_META_FLAG, PREFLIGHT_FLAG, PRIVATE_COLLAB_FLAG, PERFORMANCE_UI_FLAG, PERF_HUD_FLAG, isFlagOn, flagHidden, setFlagMirror, applyPerfUi } from '../feature-flags.ts';
import { mountPerfHud, unmountPerfHud } from '../lib/perf-hud.ts';
import { ensureJelly } from '../lib/jelly.ts';
import { stopNeurospicy } from '../lib/neurospicy.ts';
import { stopAtmosphere } from '../lib/atmosphere.ts';
import { syncNeuroDock } from '../components/neuro-dock.ts';
import { saveBlob } from '../pro/zip.ts';
import { exportBackup, importBackup } from '../data-transfer.ts';
import { backupHistoryNote } from '../lib/backup-summary.ts';
import { measureFileHistory } from '../lib/file-history-storage.ts';
import { pinnedToolBytes, unpinAll, pinTool, unpinTool, pinRecords } from '../lib/offline-pins.ts';
import type { PinRecord } from '../lib/offline-pins.ts';
import { prefetchAssetsById, catalogDownloadSummary, catalogScopeSize, downloadCatalogScope } from '../catalog/sync.ts';
import {
  fetchPrecacheManifest, fetchInfoManifest, docsFileList,
  downloadApp, downloadDocs, downloadVerify, downloadSpeech, downloadUpscale, downloadMatte, downloadOcr, downloadReword, downloadAsk, downloadAiDetect,
  downloadDurable, trustmarkGroupSplit,
  recordCatalogDownload, partRecords, removePart, storageHeadroom, persistenceState, speechCacheBytes,
  rewordCacheBytes, aiDetectCacheBytes, clearAiDetectCaches,
} from '../lib/offline-manager.ts';
import type { OfflinePartId, PrecacheManifest, InfoManifest, DownloadProgress, PartState } from '../lib/offline-manager.ts';
import { beginOfflineRun, cancelOfflineRun, offlineRunActive, offlineRunLine, subscribeOfflineRun } from '../lib/offline-run.ts';
import type { OfflineRunHandle, OfflineRunLine } from '../lib/offline-run.ts';
import { upscaleCacheBytes, matteCacheBytes, ocrCacheBytes, durableCacheBytes } from '../lib/model-prefetch.ts';
import { toolSupport } from '../capabilities.ts';
import { getInstanceBase } from '../lib/instance.ts';
import { isTauriShell } from '../lib/instance-choice.ts';
import { openInstanceSheet } from '../components/instance-sheet.ts';
// Generic per-field display policy (empty/no-op unless a deployment's control
// plane has populated it via src/org/) + the admin-console affordance seam.
import { getFieldPolicy } from '../lib/field-policy.ts';
import { orgAdminHref } from '../org/index.ts';
import { syncCatalog } from '../catalog/sync.ts';
// Colour / palette / fonts / brand-pack / corner radius all live in the
// Dashboard's "Your brand" editor now (and the #/start wizard).
import { registerUserFonts } from '../user-fonts.ts';
import type { UserFontsHost } from '../user-fonts.ts';
import { applyChromeBrandVars } from '../brand-vars.ts';
import { confirmDialog, closeConfirmDialogs } from '../components/confirm-dialog.ts';
import { fmtBytes } from '../folder-tiles.ts';
import type { HostV1, Profile, AssetRef, ProfileAPI, AssetsAPI } from '@lolly-tools/core/host-v1';
import type { FeatureFlag } from '../feature-flags.ts';
import { updaterGlobal, updatesRowHtml, wireUpdatesRow } from './profile-updates.ts';
import { openImageLightbox, userImageThumb } from './profile-user-images.ts';
import { fmtPct, reconciliationSentence, sessionRowsHtml } from './profile-storage-model.ts';
import type { PreviewsMeasure, SessionEntry, SessionRowContext, StorageModel } from './profile-storage-model.ts';
import { backHomeHtml, mountBackPill } from '../components/back-pill.ts';
import { mountHomeFab } from '../components/home-fab.ts';

/** The slice of the tool-previews cache this view reads. */
interface PreviewsSlice {
  list(): Promise<Array<{ thumb?: string | null }>>;
  size?(): Promise<number>;
  clear(): Promise<unknown>;
}

interface IdentityInfo { provider?: string; email?: string }
interface IdentityStatus {
  enrolled?: boolean;
  identity?: IdentityInfo;
  notBefore?: string;
  notAfter?: string;
  expired?: boolean;
}
interface IdentityAPI {
  status(): Promise<IdentityStatus>;
  enroll(provider: string, opts?: { days?: number; email?: string }): Promise<IdentityStatus>;
  forget(): Promise<unknown>;
  completeEnrollment(token: string): Promise<IdentityStatus>;
}

interface CaHealth { ok?: boolean; devProvider?: boolean; configured?: { github?: boolean; google?: boolean; suse?: boolean; email?: boolean } }

/**
 * The web bridge as this view drives it: HostV1 plus the host-UI-only surface
 * that isn't part of the tool-facing contract. `identity`/`previews` are the
 * concrete web-only APIs (WebHost declares them). The profile setter, the
 * user-asset helpers and `state.sizes` live on the web bridge at runtime but
 * aren't in the shared HostV1 types, so they're modelled as optional here (and
 * asserted present at the call sites, which only ever run in the web shell - 
 * this keeps main.ts's `mountProfile(view, WebHost)` call type-correct).
 */
interface ProfileHost extends HostV1 {
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
const FIELD_LABELS: Record<string, string> = {
  firstname: 'First name', lastname: 'Last name', email: 'Email',
  phone: 'Phone', city: 'City', country: 'Country',
};

// Per-field input semantics - the right keyboard on mobile, native validation
// and autofill where it helps. Anything not listed falls back to a plain text
// input (autocomplete off, as before).
const FIELD_ATTRS: Record<string, Record<string, string>> = {
  firstname: { type: 'text', autocomplete: 'given-name' },
  lastname:  { type: 'text', autocomplete: 'family-name' },
  email:     { type: 'email', inputmode: 'email', autocomplete: 'email' },
  phone:     { type: 'tel', autocomplete: 'tel' },
};
const fieldAttrs = (f: string): string => {
  const a = FIELD_ATTRS[f] ?? { type: 'text', autocomplete: 'off' };
  return Object.entries(a).map(([k, v]) => `${k}="${escape(v)}"`).join(' ');
};

// The headshot lives in the user-assets store under one fixed id (so a new one
// overwrites the old and it only ever occupies a single slot), and is kept out
// of the "My images" library list.
const HEADSHOT_ID = 'user/headshot';

// The default headshot when the user hasn't set one: the app mark (a vector), so
// a blank profile still reads as a real avatar. Shown as a placeholder only - the
// slot stays "empty" (Upload prompt, no Remove) until a real headshot is saved.
const DEFAULT_HEADSHOT = '/icon.svg';

// The Storage manager's own ad-hoc mountModal dialogs (clear/hoard/keep-active/import
// gates + the user-image lightbox) - tracked here, mirroring confirm-dialog.ts's
// openDialogs, so mountProfile's _cleanup can close them on a view swap. A real
// <dialog> sits in the top layer, so an orphan left open would block the next view
// (unlike the body-level overlay divs these replaced).
const openProfileModals = new Set<ModalHandle<any>>();

// Live "export and render everything" progress toasts. They're body-level like the
// dialogs above, so mountProfile's _cleanup drains them too - matching the Projects
// view, which has always torn its batch-export toasts down on navigate-away.
const openProfileToasts = new Set<HTMLElement>();

// Randomised word the user must type to confirm the irreversible "clear all my
// data" action - a deliberate speed-bump against an accidental wipe.
const CLEAR_CONFIRM_WORDS = ['lolly', 'open', 'free', 'privacy', 'choice', 'thank you', 'security', 'goodbye'];

// Playful word the user types to confirm the (heavy but SAFE) "export everything AND
// render it all" action. A speed-bump for a big job - potentially many renders + a large
// download - but the mood is celebratory data-ownership, NOT the sombre clear-data gate,
// so the two word pools never overlap. Kept short + lowercase for easy typing.
const HOARD_CONFIRM_WORDS = ['hoard', 'mine', 'stash', 'vault', 'archive', 'homeward', 'liberate', 'agency', 'to the drive', 'own it', 'my data', 'keep it all'];

// Chevron for a collapsible section's summary (rotates 90° when open via CSS).
// Path data lives in lib/icons.ts as 'chevronRight' - was a <polyline>, same shape as
// the (deduped) <path> chevrons in gallery.ts/projects.ts (component-audit rec 5).
// `section-card-chev`/`-summary`/`-title`/`-body` ride alongside every
// `profile-collapse-*` class below - the shared fold primitive's sub-part
// names (disclosure.css, component audit rec 7). profile.css's own, more
// specific `.profile-view .profile-collapse …` rules still govern every
// pixel (this is prep for a later pass that thins profile.css onto the
// primitive, not a visual change today).
const COLLAPSE_CHEV = icon('chevronRight', { size: 16, strokeWidth: 2.5, className: 'profile-collapse-chev section-card-chev' });
// Shield-with-check - the same glyph the gallery's green Verify button uses (deduped
// against footer-nav.ts's identical NAV_ICONS.shield as 'shieldCheck').
const VERIFY_SHIELD = icon('shieldCheck', { size: 18 });
// Jump to the Verify view - styled to match the gallery's green Verify button.
// A function (not a module const) so t() runs at render time, after the catalog loads.
const verifyLink = (): string => `<a href="#/verify" class="btn identity-verify-link" aria-label="${escape(t('Verify Content Credentials - check any file on-device'))}">${VERIFY_SHIELD}<span>${t('Verify a file')}</span></a>`;

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
const summaryRow = (id: string, title: string, value = ''): string =>
  `<summary class="profile-collapse-summary section-card-summary"><h2 class="section-card-title">${title}</h2><span class="profile-summary-value" data-summary="${id}">${value}</span>${COLLAPSE_CHEV}</summary>`;

// Stand-in for a lazy section's body until its load returns. A plain static bar,
// deliberately never animated: a shimmer would be one more thing to switch off
// under Reduce motion, and the word "Loading…" told the reader nothing.
const skeletonRow = (): string =>
  `<div class="profile-skeleton" role="status" aria-label="${escape(t('Loading'))}"></div>`;

// A small "i" badge with a hover/focus tooltip - used beside storage headings.
// Was a bespoke .info-dot/.info-tip pair; now the shared help-tip button
// (component audit rec 13), wrapped in its own positioning host so the pop
// anchors to the badge rather than stretching to match a page-width row - 
// `.help-tip-host`'s default (`left:0;right:0`, sized to the host) assumes a
// wide host like a sidebar `.input-row`, so the pop gets an inline auto-width
// override here (same recipe as tool.css's `.block-control > .help-tip-pop`)
// to keep it exactly the compact, left-anchored badge tooltip it always was.
const infoDot = (text: string): string => {
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
function pulseHighlight(el: HTMLElement): void {
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

export async function mountProfile(viewEl: HTMLElement, host: ProfileHost, params: string = ''): Promise<void> {
  document.title = 'Profile - Lolly';
  // Only the first-paint-critical reads run upfront. The Storage section's heavy
  // work is deferred to loadStorage() (run when the section is first expanded).
  const profile = await host.profile.get();
  // Jelly effects (flag-gated soft-body switches): decide from the canonical
  // profile, not the sync mirror, and load the lazy bundle before first paint so
  // the flag rows render their final control with no post-mount swap. `jellyOn`
  // and `liveProfile` are mutable - the flag list re-renders in place when the
  // jelly flag itself is toggled (see the change listener below).
  // isFlagOn (not flagEnabled): the Jelly flag's built-in default is brand-aware
  // (OFF on a locked brand - see setJellyDefault in main.ts), and only the
  // default-aware read honours it. The capture-neutral pin must be consulted
  // here too: it only rewrites the flag MIRROR, which this canonical-profile
  // read bypasses - without the check, every docs baseline of this view carried
  // jelly controls despite the pin.
  let jellyOn = await ensureJelly(isFlagOn(profile, JELLY_FLAG) && !captureNeutralPinned());
  let liveProfile = profile;
  const fields = ['firstname', 'lastname', 'email', 'phone', 'city', 'country'];
  // The theme in force right now (applied at boot from the profile; localStorage
  // is only its FOUC mirror) - seeds the Appearance card's active preview.
  const activeTheme = currentTheme();
  // '' = bundled with this app (the default everywhere but a Tauri shell that
  // connected elsewhere) - see components/instance-sheet.ts + lib/instance.ts.
  const instanceBase = getInstanceBase();
  // The active design system's label for the card summary (plans/186); '' before
  // the registry answers, which only a shell without one ever is.
  const activeDesignSystemLabel = await (host as unknown as { tokens?: { active?(): Promise<{ label: string } | null> } }).tokens?.active?.().then(a => a?.label ?? '').catch(() => '') ?? '';
  // Instance-admin affordance - null unless the org session's role is admin/owner
  // (so it never renders on a plain deployment).
  const adminHref = orgAdminHref();
  // Changing the instance base is a DESKTOP capability, not a browser one. A
  // remote base makes every catalogue, tool, asset and org request cross-origin,
  // and the shell's Content-Security-Policy allows a fixed host list that cannot
  // contain an origin the user types at runtime - so in a browser those fetches
  // are refused and the feature fails with a console-only error. Tauri routes
  // cross-origin traffic through tauri-plugin-http and serves no CSP, so it works
  // there. Offering a control that cannot work is worse than not offering it, so
  // the browser shows the current source read-only and says where to go instead.
  // Matches lib/instance-choice.ts's own gate on the first-run sheet.
  const canChangeInstance = isTauriShell();
  // Does this shell carry a self-updater? Probed, never assumed from isTauriShell
  // (plans/202 principle 5): the desktop shell installs window.__lollyUpdater from
  // bridge-overrides/updater.ts, the mobile shell updates through its app store and
  // installs nothing, and a browser has nothing to update. No global, no row.
  const shellUpdater = updaterGlobal();
  const hasShellUpdater = !!shellUpdater;
  // The headshot is a user asset; re-resolve it (the stored object URL goes stale
  // across reloads).
  const headshotRef = profile.headshot?.id ? await host.assets.get(profile.headshot!.id).catch(() => null) : null;
  let headshotUrl = headshotRef?.url || '';
  const rawFocus = new URLSearchParams(params).get('focus');
  // 'sync-section' is kept as an alias: Sync across devices moved inside Connected
  // services, and links written before that (share links, docs, the sync-service
  // passphrase nudge, screenshot recipes) still name it.
  const focusParam = rawFocus === 'sync-section' ? 'connections-section' : rawFocus;
  const focusFlags = focusParam === 'feature-flags';
  const focusUseDetails = focusParam === 'use-details';
  // Which SECTION a ?focus= param must leave expanded. Every card is a collapsible
  // now and they all start closed, so a deep link that arrives at a folded card
  // delivers nothing - the two legacy aliases name the section they live in (the
  // use-details checkbox sits inside the details card), anything else is already a
  // section id.
  const focusSectionId = focusFlags ? 'feature-flags-section'
    : focusUseDetails ? 'details-section'
    : focusParam;
  // Remember which sections were left open, across visits (a UI preference, so it
  // lives in localStorage like the theme - read synchronously before render). No
  // entry ⇒ CLOSED: every card starts folded, and the nav rail (or a stored open
  // state, or a ?focus= target) is what opens one.
  const OPEN_KEY = 'lolly-profile-open';
  let openState: Record<string, boolean> = {};
  try { openState = JSON.parse(localStorage.getItem(OPEN_KEY) || '{}') || {}; } catch { /* storage blocked */ }
  const startOpen = (id: string) => (openState[id] || focusSectionId === id ? ' open' : '');

  // One toggle row for a feature flag (closes over `profile` for its checked state). Honours
  // a flag's `default` (opt-in flags start off) and shows an (i) explainer when it has `info`.
  // The explainer is the shared help-tip button too (component audit rec 13) - kept on
  // `.feature-flag-info` as its positioning host (it already carries the right
  // position:relative/margin) with `help-tip-host` added alongside so the shared
  // hover/focus-reveal CSS (tool.css) recognises it. The pop's placement is a real,
  // deliberate delta worth keeping: this row sits at the *bottom* of a long list, so
  // it opens upward/centred (inline style override) rather than help-tip-pop's default
  // "drop below, span the host" - which here would spill past the list, off-screen.
  const flagRow = (f: FeatureFlag) => {
    // A control plane can hide a flag's toggle (a staged surprise, or a policy the
    // deployment owns): drop the row entirely - the resolved default still applies,
    // the user just never sees a switch. Dormant / shown ⇒ rendered as ever.
    if (flagHidden(f.id)) return '';
    const info = f.info ? helpTip(t(f.info)) : null;
    const infoPop = info ? info.pop.replace(
      'class="help-tip-pop"',
      'class="help-tip-pop" style="left:50%;right:auto;top:auto;bottom:calc(100% + .4rem);transform:translateX(-50%);width:max-content;max-width:16rem"',
    ) : '';
    // Jelly mode swaps the CSS switch for a <jelly-switch> (vendored web
    // component, lib/jelly.ts). Its hidden native checkbox lives in shadow DOM,
    // so the visible row label can't name it - the `label` attribute carries the
    // accessible name instead. It reflects `.checked` and re-dispatches a
    // bubbling `change` on the host, so the generic [data-flag] save listener
    // below works identically for both control kinds.
    //
    // The label→control link is EXPLICIT (`for`/id): with no `for`, a label
    // activates its FIRST labelable descendant - and on rows with an (i)
    // explainer that's the help-tip <button>, not the switch, so row clicks
    // opened the tip instead of toggling (the "mouse-blocked toggle" bug).
    const ctlId = `ff-${f.id}`;
    const control = jellyOn
      ? `<jelly-switch id="${escape(ctlId)}" class="feature-flag-jelly" data-flag="${escape(f.id)}" size="sm" label="${escape(t(f.label))}" ${isFlagOn(liveProfile, f) ? 'checked' : ''}></jelly-switch>`
      : `<input type="checkbox" id="${escape(ctlId)}" class="feature-flag-input" data-flag="${escape(f.id)}" ${isFlagOn(liveProfile, f) ? 'checked' : ''}>
        <span class="feature-flag-switch" aria-hidden="true"></span>`;
    return `
    <li>
      <label class="feature-flag" for="${escape(ctlId)}">
        <span class="feature-flag-label">${escape(t(f.label))}${f.pill ? `<span class="feature-flag-pill">${escape(t(f.pill))}</span>` : ''}${
          info ? `<span class="feature-flag-info help-tip-host">${info.button}${infoPop}</span>` : ''
        }</span>
        ${control}
      </label>
    </li>`;
  };

  // One identity-form control - <jelly-input> in jelly mode (form-associated:
  // its ElementInternals.setFormValue keeps it in the form's FormData under the
  // host's `name`, so the submit handler below reads both kinds identically).
  // The visible .profile-field-label span stays either way; `label` doubles it
  // onto the shadow input's aria-label so the accessible name survives the
  // shadow boundary. Takes the value as an argument so the jelly-flag toggle
  // can rebuild a control in place without dropping unsaved edits.
  const fieldControl = (f: string, value: string) => {
    // A locked field (control-plane policy, via lib/field-policy.ts) renders
    // read-only. Dormant default: no policy ⇒ no attribute ⇒ unchanged.
    const ro = getFieldPolicy(f)?.mode === 'locked' ? ' readonly' : '';
    return jellyOn
      ? `<jelly-input ${fieldAttrs(f)}${ro} name="${f}" size="sm" label="${escape(t(FIELD_LABELS[f] ?? f))}" value="${escape(value)}"></jelly-input>`
      : `<input ${fieldAttrs(f)}${ro} name="${f}" value="${escape(value)}" placeholder=" ">`;
  };

  // The Save button - <jelly-button type="submit"> drives the closest light-DOM
  // form via requestSubmit(), so the same submit listener fires. It must NOT
  // carry .profile-btn-primary (those border/fill styles would paint a second
  // box behind the jelly canvas).
  const saveButtonHtml = () => jellyOn
    ? `<jelly-button type="submit" class="profile-btn-jelly">${t('Save Profile')}</jelly-button>`
    : `<button type="submit" class="profile-btn-primary">${t('Save Profile')}</button>`;

  // Every flag the list below renders, for the card's folded summary to count the
  // switched-off ones. The standalone eight are spelled out rather than mapped
  // because the list's own rows are hand-written (dividers and a group heading sit
  // between them) and two feature tests pin those call sites by name - keep the two
  // in step when a flag joins or leaves the list.
  // Jelly effects render on a canvas the native shells' WebView grows without
  // bound (lib/jelly.ts gates it off there), so the toggle would promise a look
  // it cannot deliver - hide the whole row on any non-web shell. The web PWA
  // keeps it.
  const jellyHidden = isTauriShell();
  const LISTED_FLAGS = [
    ...CATEGORY_FLAGS,
    ...(jellyHidden ? [] : [JELLY_FLAG]),
    WOBBLY_FLAG, WOBBLY_MESH_FLAG, PERFORMANCE_UI_FLAG, PERF_HUD_FLAG, STRIP_UPLOAD_META_FLAG, PREFLIGHT_FLAG, PRIVATE_COLLAB_FLAG,
    ...CONNECTOR_FLAGS,
  ];
  // The Feature-flags card's <ul> contents - a function so the jelly-flag toggle
  // can re-render the list in place (its switches change kind on the spot).
  const flagListHtml = () => `
            ${CATEGORY_FLAGS.map(f =>
              // Set the on-device Offline Utilities drawer apart from the creative
              // tool categories above it with its own separator.
              (f.category === 'utility' ? '<li class="feature-flag-divider" aria-hidden="true"></li>' : '') + flagRow(f)
            ).join('')}
            <li class="feature-flag-divider" aria-hidden="true"></li>
            ${/* Neurospicy is NOT listed here any more: it is a first-class
                accommodation (Andy, plans/142 A11y-2) controlled from the
                Accessibility card's Sound row. The flag object survives for
                instance governance only. */''}
            ${jellyHidden ? '' : flagRow(JELLY_FLAG)}
            ${flagRow(WOBBLY_FLAG)}
            ${flagRow(WOBBLY_MESH_FLAG)}
            ${flagRow(PERFORMANCE_UI_FLAG)}
            ${flagRow(PERF_HUD_FLAG)}
            ${flagRow(STRIP_UPLOAD_META_FLAG)}
            ${flagRow(PREFLIGHT_FLAG)}
            ${flagRow(PRIVATE_COLLAB_FLAG)}
            <li class="feature-flag-divider" aria-hidden="true"></li>
            <li class="feature-flag-group">${t('Connectors')}<span class="feature-flag-group-note">${t('Where this device may send finished exports. Turning one off withdraws it from every send and share surface, and hides its row in Connected services.')}</span></li>
            ${CONNECTOR_FLAGS.map(flagRow).join('')}`;

  // ── Accessibility prefs (lib/a11y-prefs.ts) ──────────────────────────────────
  // Three opt-in comfort switches. Deliberately NOT feature flags and NOT in the
  // collapsed Feature flags drawer: someone who needs reduced motion or larger
  // type must be able to find these on a page they can barely read, so they get a
  // plain always-open card beside Appearance (both answer "how does the app dress
  // for me"), and their state lives on profile.a11y rather than in the flag map.
  //
  // Initial checked state comes from currentA11yPrefs() - what is APPLIED to
  // <html> right now - not from profile.a11y. The two normally agree (main.ts
  // hydrates the profile value into the attributes at boot, after the index.html
  // FOUC script applied the localStorage mirror), but they can diverge: an
  // untouched/absent profile.a11y leaves a device-local mirror choice standing on
  // purpose, and a profile write can fail while the attribute stays live. A switch
  // that disagreed with the page the user is looking at would be the worse lie.
  const a11yState: A11yPrefs = currentA11yPrefs();
  const A11Y_ROWS: Array<{ key: keyof A11yPrefs; label: string; info: string }> = [
    {
      key: 'reduceMotion',
      label: 'Reduce motion',
      info: 'Turns off the transitions, slides and animated flourishes in the app. Your tool canvas and any animated export keep moving exactly as designed.',
    },
    // Sits under Reduce motion on purpose: both trim visual stimulation. The
    // galleries keep every card (and its favourite/pin/info actions) as calm
    // icon + text; Projects keeps its thumbnails but tints them to one colour
    // (parts/folders.css) so they stay recognisable without the colour noise.
    {
      key: 'hidePreviews',
      label: 'Hide colourful previews',
      info: 'Swaps the gallery preview artwork for calm icon and text cards, and lowers the colour and contrast of your project thumbnails so they stay recognisable without shouting. Inside a tool everything shows in full colour, and nothing you export changes.',
    },
    {
      key: 'highContrast',
      label: 'High contrast',
      info: 'Strengthens the borders, text and focus rings of the app around your work. Your brand colours and everything on the canvas stay exactly as you set them.',
    },
    // Large text multiplies CHROME font sizes only (--a11y-fs, styles/parts/a11y.css) - 
    // px paddings and control heights are untouched, and the root font-size never moves
    // so `rem`-styled tools export byte-identically. The copy promises exactly that and
    // no more: over-promising "bigger controls" is the one claim this mechanism can't keep.
    {
      key: 'largeText',
      label: 'Large text',
      info: 'Grows the app type: labels, menus and button text. The controls themselves keep their size, so only the words inside them get bigger. Type inside your designs is untouched, so nothing you export reflows.',
    },
  ];
  // Same markup contract as flagRow: the .feature-flag primitives (so there is one
  // toggle-row look in this view), the explicit label `for`/id link (without it a
  // row click lands on the help-tip <button> instead of the switch - the
  // "mouse-blocked toggle" bug), and a control that carries `.checked` + emits a
  // bubbling `change` in both jelly and CSS-switch modes. The pop takes its own
  // width here (the (i) host is a few px wide, and help-tip-pop's default
  // `left:0;right:0` would size to it) - see .a11y-pref-info in profile.css.
  //
  // The scope text is also wired as the switch's accessible DESCRIPTION, which the
  // generic linkHelpDescriptions() can't do for a row like this (it looks for a
  // control inside the tip's own host, and the host here holds only the button +
  // pop). Native control only: a <jelly-switch>'s real checkbox lives in shadow
  // DOM, so an aria-describedby on the host would never reach it - the same
  // boundary the `label` attribute works around for the accessible name.
  const a11yRow = (row: { key: keyof A11yPrefs; label: string; info: string }) => {
    const tip = helpTip(t(row.info));
    const ctlId = `a11y-${row.key}`;
    const on = a11yState[row.key] ? ' checked' : '';
    const control = jellyOn
      ? `<jelly-switch id="${escape(ctlId)}" class="feature-flag-jelly" data-a11y="${escape(row.key)}" size="sm" label="${escape(t(row.label))}"${on}></jelly-switch>`
      : `<input type="checkbox" id="${escape(ctlId)}" class="feature-flag-input" data-a11y="${escape(row.key)}" aria-describedby="${tip.id}"${on}>
        <span class="feature-flag-switch" aria-hidden="true"></span>`;
    return `
    <li>
      <label class="feature-flag" for="${escape(ctlId)}">
        <span class="feature-flag-label">${escape(t(row.label))}<span class="feature-flag-info a11y-pref-info help-tip-host">${tip.button}${tip.pop}</span></span>
        ${control}
      </label>
    </li>`;
  };
  // A function for the same reason flagListHtml() is one: toggling the Jelly flag
  // re-renders these rows in place so their control kind swaps with the rest.
  const a11yListHtml = () => A11Y_ROWS.map(a11yRow).join('');

  // ── Appearance: does the app follow the design system? (plans/182 SS5.6) ─────
  // The app taking its accent from the design system's primary is the APP's use
  // of the palette, and a palette is for tools and exports first - so it is a
  // preference in this card, beside the theme, rather than a token in the studio.
  // Initial state is what is in FORCE (the device mirror lib/chrome-follow.ts
  // reads), not profile.appearance, for the reason a11yState reads the applied
  // attributes: a switch that disagrees with the page you are looking at is the
  // worse lie.
  let followDsState = chromeFollowsDesignSystem();
  const followDsRow = (on: boolean) => {
    const tip = helpTip(t('The app\'s accent takes the primary colour. Tools and exports are not affected.'));
    const ctlId = 'follow-ds';
    const checked = on ? ' checked' : '';
    const label = t('Interface follows the design system');
    const control = jellyOn
      ? `<jelly-switch id="${escape(ctlId)}" class="feature-flag-jelly" data-follow-ds size="sm" label="${escape(label)}"${checked}></jelly-switch>`
      : `<input type="checkbox" id="${escape(ctlId)}" class="feature-flag-input" data-follow-ds aria-describedby="${tip.id}"${checked}>
        <span class="feature-flag-switch" aria-hidden="true"></span>`;
    return `
    <li>
      <label class="feature-flag" for="${escape(ctlId)}">
        <span class="feature-flag-label">${escape(label)}<span class="feature-flag-info a11y-pref-info help-tip-host">${tip.button}${tip.pop}</span></span>
        ${control}
      </label>
    </li>`;
  };
  const followDsListHtml = () => followDsRow(followDsState);

  // ── Renders auto-save (WP-B) ─────────────────────────────────────────────────
  // A single toggle for "keep a copy of every render in my library". Default ON:
  // unset means on, so an untouched profile keeps its renders. Same control kinds
  // + label wiring as the a11y rows so it swaps with the Jelly flag too.
  const renderSaveRow = (on: boolean) => {
    const tip = helpTip(t('Every image, audio clip and video you download is also kept in your library under a Renders tag, so you can find it again without re-exporting. Identical files are only kept once, and large videos ask first. Nothing about the file you downloaded changes.'));
    const ctlId = 'save-renders';
    const checked = on ? ' checked' : '';
    const control = jellyOn
      ? `<jelly-switch id="${escape(ctlId)}" class="feature-flag-jelly" data-save-renders size="sm" label="${escape(t('Save my renders to my library'))}"${checked}></jelly-switch>`
      : `<input type="checkbox" id="${escape(ctlId)}" class="feature-flag-input" data-save-renders aria-describedby="${tip.id}"${checked}>
        <span class="feature-flag-switch" aria-hidden="true"></span>`;
    return `
    <li>
      <label class="feature-flag" for="${escape(ctlId)}">
        <span class="feature-flag-label">${escape(t('Save my renders to my library'))}<span class="feature-flag-info a11y-pref-info help-tip-host">${tip.button}${tip.pop}</span></span>
        ${control}
      </label>
    </li>`;
  };
  // Mutable so a Jelly-flag re-render keeps this toggle in step with the live
  // choice (same pattern as a11yState above).
  let renderSaveState = profile.saveRenders !== false;
  const renderSaveListHtml = () => renderSaveRow(renderSaveState);

  // Every card folds now, including Your details - so the identity moves into that
  // card's summary line, or a fully collapsed page would be a wall of anonymous
  // headings. Name if there is one, email as the fallback, nothing at all on a fresh
  // profile (the heading alone is honest when there is no-one to name yet).
  const displayName = [profile.firstname, profile.lastname].filter(Boolean).join(' ').trim() || (profile.email ?? '').trim();

  // ── Folded-card summaries (plans/163 section 4.1) ────────────────────────────
  // Each one is a couple of words, read from the same state the section's own
  // body renders from - never a second source of truth. The three below are known
  // at first paint; the lazy sections leave theirs empty and call setSummary().
  const metrics = getMetrics();
  // currentTheme() can hand back a name that is not one of THEMES (a stale stored
  // value), so a miss shows the raw name rather than an empty summary.
  const themeLabel = (name: string): string => tRaw((THEME_LABELS as Record<string, string>)[name] ?? name);
  const a11yOnCount = () => A11Y_ROWS.filter(r => a11yState[r.key]).length;
  const a11ySummary = () => (a11yOnCount() ? tRaw('{n} on', { n: a11yOnCount() }) : t('Off'));
  const rendersSummary = () => (renderSaveState ? t('Keeping copies') : t('Off'));
  const flagsOffCount = () => LISTED_FLAGS.filter(f => !flagHidden(f.id) && !isFlagOn(liveProfile, f)).length;
  const flagsSummary = () => (flagsOffCount() ? tRaw('{n} off', { n: flagsOffCount() }) : t('All on'));
  // Fills a section's summary value after the fact - textContent, so the caller
  // passes plain text (tRaw, not t). A section that never loads keeps its blank.
  const setSummary = (id: string, text: string): void => {
    const el = viewEl.querySelector<HTMLElement>(`[data-summary="${id}"]`);
    if (el) el.textContent = text;
  };

  viewEl.innerHTML = `
    ${backHomeHtml()}
    <div class="gallery-topbar" style="justify-content:flex-end">
      <div class="gallery-topright">
        ${langFabHtml()}
      </div>
    </div>
    <div class="profile-layout">
      <h1 class="visually-hidden">${t('Your profile')}</h1>

      <aside class="profile-nav" aria-label="${escape(t('Settings sections'))}">
        <div class="profile-nav-search">
          <span class="profile-nav-search-ic" aria-hidden="true">${icon('search', { size: 15 })}</span>
          <input type="search" id="profile-nav-search" class="profile-nav-search-input" placeholder="${escape(t('Search settings'))}" aria-label="${escape(t('Search settings'))}" autocomplete="off" spellcheck="false">
        </div>
        <ul class="profile-nav-list" role="list">
          ${NAV_SECTIONS.map(s => `<li><button type="button" class="profile-nav-item" data-nav="${s.id}">${icon(s.icon, { size: 16, className: 'profile-nav-ic' })}<span class="profile-nav-text">${escape(t(s.label))}</span></button></li>`).join('')}
        </ul>
        <p class="profile-nav-empty" id="profile-nav-empty" hidden>${t('No settings match')}</p>
      </aside>

      <div class="profile-panes">

      <details class="profile-card profile-collapse" id="details-section"${startOpen('details-section')}>
        ${summaryRow('details-section', t('Your details'), displayName
          ? `<span class="profile-summary-name">${escape(displayName)}</span>`
          : t('Nothing added - exports stay anonymous'))}
        <div class="profile-collapse-body section-card-body">
        <form class="profile-form" id="profile-form">
          ${/* The opt-in leads the form (plans/163 section 4.3): it is the door that
               decides whether anything below ever leaves this device, so it reads
               before the fields rather than after the Save button. Same checkbox,
               same name, same live label swap - placement and one sentence only. */''}
          <div class="profile-optin">
            <label class="profile-check">
              <span class="profile-check-tag">${t(profile.useDetails ? 'Opted-in' : 'opt-in')}</span>
              ${jellyOn
                ? `<jelly-checkbox name="useDetails" size="sm" label="${escape(t('Use my details to create'))}"${profile.useDetails ? ' checked' : ''}></jelly-checkbox>`
                : `<input type="checkbox" name="useDetails" ${profile.useDetails ? 'checked' : ''}>`}
              <span class="profile-check-text">${t(profile.useDetails ? 'Using my details' : 'Use my details to create')}</span>
            </label>
            <p class="profile-optin-note">${t('Only when this is on do your details go into the files you export - shown per file at export time.')}</p>
          </div>
          <div class="profile-details-grid">
            <div class="profile-details-main">
              <div class="profile-fields">
                ${fields.filter(f => getFieldPolicy(f)?.mode !== 'hidden').map(f => {
                  // Consult the generic field-policy registry: hidden fields are
                  // dropped above; a locked field shows a small "Managed by …"
                  // chip and its policy value overrides the stored one. With no
                  // policy (the default) this is exactly today's render.
                  const pol = getFieldPolicy(f);
                  const val = pol && pol.value !== undefined
                    ? String(pol.value)
                    : String((profile as Record<string, unknown>)[f] ?? '');
                  // A locked field shows a padlock, not a text chip: the "Managed
                  // by …" note rides along as its tooltip (title + accessible
                  // label) so the row stays uncluttered. No note ⇒ nothing.
                  const note = pol?.mode === 'locked' && pol.note
                    ? `<span class="profile-field-lock" tabindex="0" role="img" title="${escape(pol.note)}" aria-label="${escape(pol.note)}" style="margin-inline-start:.35rem;display:inline-flex;vertical-align:middle;color:hsl(var(--muted-foreground))">${icon('lock', { size: 13 })}</span>`
                    : '';
                  return `<label class="profile-field">
                  <span class="profile-field-label">${escape(t(FIELD_LABELS[f] ?? f))}${note}</span>
                  ${fieldControl(f, val)}
                </label>`;
                }).join('')}
              </div>

              <div class="profile-actions">
                ${saveButtonHtml()}
              </div>
            </div>

            <aside class="profile-side">
              <div class="profile-field">
                <span class="profile-field-label headshot-heading">${t('Headshot')}</span>
                <div class="headshot">
                  <div class="headshot-preview${headshotUrl ? '' : ' is-empty'}" id="headshot-preview" style="background-image:url('${escape(headshotUrl || DEFAULT_HEADSHOT)}')">
                    ${jellyOn
                      ? `<jelly-button variant="platinum" class="headshot-edit-jelly" id="headshot-upload">${t(headshotUrl ? 'Edit' : 'Upload')}</jelly-button>`
                      : `<button type="button" class="headshot-edit" id="headshot-upload">${t(headshotUrl ? 'Edit' : 'Upload')}</button>`}
                  </div>
                  <button type="button" class="headshot-remove" id="headshot-remove" aria-label="${escape(t('Remove headshot'))}" title="${escape(t('Remove'))}"${headshotUrl ? '' : ' hidden'}>&times;</button>
                  <input type="file" id="headshot-file" accept="image/png,image/jpeg,image/webp,image/avif,image/heic,image/heif,image/svg+xml" hidden>
                </div>
                <p class="profile-inline-error" id="headshot-error" style="color:hsl(var(--destructive));font-size:13px;margin:.4rem 0 0" hidden></p>
              </div>
            </aside>
          </div>
        </form>
        </div>
      </details>

      ${/* Content Credentials sits second, right under Your details: the two are one
           subject - what goes into the files you export - and splitting them across
           the page was what made the provenance story unfindable (plans/163 4.2). */''}
      <details class="profile-card profile-collapse" id="identity-section"${startOpen('identity-section')}>
        ${summaryRow('identity-section', t('Content Credentials'))}
        <div class="profile-collapse-body section-card-body" id="identity-body">${skeletonRow()}</div>
      </details>

      <details class="profile-card profile-collapse" id="design-systems-section"${startOpen('design-systems-section')}>
        ${summaryRow('design-systems-section', t('Design systems'), escape(activeDesignSystemLabel))}
        <div class="profile-collapse-body section-card-body" id="design-systems-body">${skeletonRow()}</div>
      </details>

      <details class="profile-card profile-collapse profile-card--appearance" id="appearance-section"${startOpen('appearance-section')}>
        ${summaryRow('appearance-section', t('Appearance'), escape(themeLabel(activeTheme)))}
        <div class="profile-collapse-body section-card-body">
        <p class="profile-appearance-sub">${t('How the app dresses for you - your preference, separate from your brand. Applied instantly and remembered on this device.')}</p>
        <div class="profile-theme-grid" data-theme-pick>
          ${THEMES.map(theme => `
            <button type="button" class="profile-theme${theme === activeTheme ? ' is-active' : ''}" data-theme-set="${escape(theme)}" data-theme="${escape(theme)}" aria-pressed="${theme === activeTheme ? 'true' : 'false'}">
              <div class="profile-theme-name"><span class="profile-theme-ic" aria-hidden="true">${THEME_ICONS[theme]}</span>${escape(t(THEME_LABELS[theme]))}${theme === 'light' ? `<span class="profile-theme-pill">${t('default')}</span>` : ''}</div>
              <div class="profile-theme-dots">
                <span style="background:hsl(var(--primary))" title="primary"></span>
                <span style="background:hsl(var(--card))" title="card"></span>
                <span style="background:hsl(var(--accent))" title="accent"></span>
                <span style="background:hsl(var(--muted))" title="muted"></span>
                <span style="background:hsl(var(--foreground))" title="foreground"></span>
              </div>
              <div class="profile-theme-sample">Aa</div>
            </button>`).join('')}
        </div>
        <ul class="feature-flags profile-a11y-prefs" id="appearance-prefs">${followDsListHtml()}
        </ul>
        </div>
      </details>

      <details class="profile-card profile-collapse profile-card--a11y" id="a11y-section"${startOpen('a11y-section')}>
        ${summaryRow('a11y-section', t('Accessibility'), a11ySummary())}
        <div class="profile-collapse-body section-card-body">
        <p class="profile-appearance-sub">${t('Comfort settings for the app around your work. Each one is off until you turn it on, and none of them touch your designs or your exports.')}</p>
        <ul class="feature-flags profile-a11y-prefs" id="a11y-prefs">${a11yListHtml()}
        </ul>
        ${/* Sound + focus music live IN the comfort card (plans/142 A11y-1/2,
            Andy's call): the same switches that used to sit beside the headshot.
            One home for every stimulation control - visual prefs above, audio
            here. The Neurospicy row inside soundSwitchHtml stays governed by
            its (default-ON) flag, so managed instances keep their say. */''}
        <div class="profile-field profile-field--sound" style="margin-top:.9rem">
          ${soundSwitchHtml()}
        </div>
        </div>
      </details>

      ${/* Sync across devices is a sub-block of this card, not a card of its own: it
           syncs THROUGH the providers connected right above it, so the two were
           always one subject. Both bodies mount lazily when the card opens. */''}
      <details class="profile-card profile-collapse" id="connections-section"${startOpen('connections-section')}>
        ${summaryRow('connections-section', t('Connected services'))}
        <div class="profile-collapse-body section-card-body">
          <div id="connections-body">${skeletonRow()}</div>
          <div class="storage-subsection">
            <div class="storage-subsection-header"><h3>${t('Sync across devices')}</h3></div>
            <div id="sync-body">${skeletonRow()}</div>
          </div>
        </div>
      </details>

      <details class="profile-card profile-collapse" id="renders-section"${startOpen('renders-section')}>
        ${summaryRow('renders-section', t('Your renders'), rendersSummary())}
        <div class="profile-collapse-body section-card-body">
        <p class="profile-appearance-sub">${t('Keep a copy of everything you download, ready to reopen or reuse.')}</p>
        <ul class="feature-flags profile-a11y-prefs" id="render-save-prefs">${renderSaveListHtml()}
        </ul>
        </div>
      </details>

      <details class="profile-card profile-collapse" id="storage-section"${startOpen('storage-section')}>
        ${summaryRow('storage-section', t('Storage'))}
        <div class="profile-collapse-body section-card-body" id="storage-body">${skeletonRow()}</div>
      </details>

      <details class="profile-card profile-collapse" id="offline-section"${startOpen('offline-section')}>
        ${summaryRow('offline-section', t('Available offline'))}
        <div class="profile-collapse-body section-card-body" id="offline-body">${skeletonRow()}</div>
      </details>

      ${isTauriShell() ? `
      <details class="profile-card profile-collapse" id="hotfolder-section"${startOpen('hotfolder-section')}>
        ${summaryRow('hotfolder-section', t('Hot folder'), '')}
        <div class="profile-collapse-body section-card-body" id="hotfolder-body">
          <p class="profile-hint">${t('Watch one folder on this computer. Anything dropped into it is pulled into Lolly through the same chooser a drag-and-drop gets - nothing leaves the device.')}</p>
          <label class="field-row"><span>${t('Folder path')}</span>
            <input type="text" class="field-input" id="hotfolder-path" placeholder="${escape(t('e.g. /home/you/Lolly-inbox'))}" autocomplete="off" spellcheck="false">
          </label>
          <div class="profile-actions-row">
            <button type="button" class="btn" id="hotfolder-enable">${t('Watch this folder')}</button>
            <button type="button" class="btn" id="hotfolder-disable" hidden>${t('Stop watching')}</button>
          </div>
          <p class="be-err" id="hotfolder-err" hidden></p>
        </div>
      </details>` : ''}

      <details class="profile-card profile-collapse profile-activity" id="activity-section"${startOpen('activity-section')}>
        ${summaryRow('activity-section', t('Your activity'), t('{n} renders', { n: metrics.filesRendered }))}
        <div class="profile-collapse-body section-card-body">${renderActivity(metrics, window.__toolIndex?.tools ?? [])}</div>
      </details>

      <details class="profile-card profile-collapse" id="feature-flags-section"${startOpen('feature-flags-section')}>
        ${summaryRow('feature-flags-section', t('Feature flags'), flagsSummary())}
        <div class="profile-collapse-body section-card-body">
          <p class="storage-hint-text feature-hint-text">${t('Self-governance, autonomy, choice. Enable or disable parts of the app here')}</p>
          <ul class="feature-flags" id="feature-flags">${flagListHtml()}
          </ul>
        </div>
      </details>

      <details class="profile-card profile-collapse" id="instance-section"${startOpen('instance-section')}>
        ${summaryRow('instance-section', t('Lolly instance'), instanceBase ? escape(instanceBase) : t('Bundled'))}
        <div class="profile-collapse-body section-card-body">
        <p class="profile-appearance-sub">${t('Where this install gets its tools and catalogue from.')}</p>
        <div class="store-manage--row">
          <span class="store-manage-name">${escape(instanceBase || t('Bundled with this app'))}</span>
          <span style="display:flex;gap:8px">
            ${/* nosemgrep: lolly-href-escape-is-not-scheme-validation - orgAdminHref() returns the '/admin' literal or null; no control-plane value reaches it */ ''}
            ${adminHref ? `<a class="btn" id="instance-console-link" href="${escape(adminHref)}">${t('Instance console')}</a>` : ''}
            ${canChangeInstance ? `<button type="button" class="btn" id="instance-change-btn">${t('Change')}</button>` : ''}
            ${/* Leave is never desktop-only: a .lolly share file carrying an instance pack
                  connects ANY shell to that pack's instance (brand-transfer.ts), and a browser
                  that got there this way needs the same way back. */ ''}
            ${instanceBase ? `<button type="button" class="btn-link-danger" id="instance-disconnect-btn">${t('Leave')}</button>` : ''}
          </span>
        </div>
        ${canChangeInstance ? '' : `<p class="profile-appearance-sub">${t('Pointing at another Lolly instance needs the desktop app - a browser blocks a page from loading tools and assets across origins.')}</p>`}
        ${/* App updates (plans/202 WP4.1) - the row and its wiring live in
              views/profile-updates.ts. */ ''}
        ${updatesRowHtml(hasShellUpdater)}
        </div>
      </details>

      </div>
    </div>
  `;
  // (The old two-button .profile-footer is retired - the shell's persistent search
  // bar (components/search-bar.ts, plans/99 M1) shows on this route and carries the
  // same Dashboard/Verify links plus the search field. Profile makes no claim, so
  // the bar keeps its global default placeholder.)

  // ─── Settings nav rail: jump, scroll-spy, and search ─────────────────────
  // A macOS/GNOME-style left rail. Clicking a section scrolls to it (opening a
  // collapsed <details> first); scrolling highlights the section in view; the
  // search box filters the rail (and, while typing, the visible cards) so a
  // buried setting is one query away. All progressive: if there's no matching
  // markup the wiring simply no-ops.
  (() => {
    const nav = viewEl.querySelector<HTMLElement>('.profile-nav');
    if (!nav) return;
    const items = Array.from(nav.querySelectorAll<HTMLButtonElement>('.profile-nav-item'));
    const search = nav.querySelector<HTMLInputElement>('#profile-nav-search');
    const empty = nav.querySelector<HTMLElement>('#profile-nav-empty');
    const sectionOf = (id: string) => viewEl.querySelector<HTMLElement>(`#${CSS.escape(id)}`);

    const jump = (id: string) => {
      const el = sectionOf(id);
      if (!el) return;
      // A collapsed <details> must open before it can be scrolled into meaningful view.
      if (el instanceof HTMLDetailsElement && !el.open) el.open = true;
      el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    };

    for (const btn of items) {
      btn.addEventListener('click', () => {
        const id = btn.dataset.nav!;
        jump(id);
        // Move focus to the section heading for screen-reader/keyboard continuity,
        // without stealing the smooth scroll (focus without scroll).
        sectionOf(id)?.querySelector<HTMLElement>('h2')?.focus?.();
      });
    }

    // Scroll-spy - highlight the section whose top is nearest the rail. rootMargin
    // biases the "active" band to the upper third so a section lights up as its
    // heading reaches the top, not only when it fills the viewport.
    const setActive = (id: string | null) => {
      for (const btn of items) {
        const on = btn.dataset.nav === id;
        btn.classList.toggle('is-active', on);
        if (on) btn.setAttribute('aria-current', 'true');
        else btn.removeAttribute('aria-current');
      }
    };
    if ('IntersectionObserver' in window) {
      const visible = new Map<string, number>();
      const io = new IntersectionObserver(entries => {
        for (const e of entries) {
          if (e.isIntersecting) visible.set(e.target.id, e.intersectionRatio);
          else visible.delete(e.target.id);
        }
        // Pick the topmost currently-intersecting section (page order = NAV_SECTIONS order).
        const top = NAV_SECTIONS.find(s => visible.has(s.id));
        if (top) setActive(top.id);
      }, { rootMargin: '-10% 0px -70% 0px', threshold: [0, 1] });
      for (const s of NAV_SECTIONS) {
        const el = sectionOf(s.id);
        if (el) io.observe(el);
      }
      // Tear down when the view unmounts (the router replaces viewEl's subtree).
      const mo = new MutationObserver(() => {
        if (!viewEl.contains(nav)) { io.disconnect(); mo.disconnect(); }
      });
      mo.observe(viewEl, { childList: true });
    }

    // Search - filter the rail by label + keywords; hide non-matching cards while a
    // query is present so the page itself narrows to what you're looking for.
    // Matching is lib/search (plans/99 M3 - the shared matcher replaces the old
    // single `.includes()` here). Two behaviour changes ride along, both wanted:
    // a multi-word query ANDs across tokens ("large text" needs both words to
    // land, in any field), and diacritics fold ("accessibilité" finds the
    // Accessibility card). Same haystack as before - t(label) + English label +
    // keywords - scored > 0 as a plain filter; the rail keeps page order.
    if (search) {
      const panes = viewEl.querySelector<HTMLElement>('.profile-panes');
      const apply = () => {
        const tokens = tokenize(search.value);
        let matches = 0;
        for (const s of NAV_SECTIONS) {
          const btn = items.find(b => b.dataset.nav === s.id);
          const card = sectionOf(s.id);
          const hit = !tokens.length || scoreHaystack([
            { text: fold(t(s.label)), weight: 2 },
            { text: fold(s.label), weight: 2 },
            { text: fold(s.keywords), weight: 1 },
          ], tokens) > 0;
          if (btn) btn.hidden = !hit;
          // Only narrow the cards while actively searching - an empty query restores
          // the full page (never leaves a card orphaned hidden).
          if (card) card.classList.toggle('is-filtered-out', tokens.length > 0 && !hit);
          if (hit) matches++;
        }
        panes?.classList.toggle('is-searching', tokens.length > 0);
        if (empty) empty.hidden = matches > 0;
      };
      search.addEventListener('input', apply);
      // Enter jumps to the first (only) remaining match - the quickest path to a
      // setting you searched for.
      search.addEventListener('keydown', e => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const first = items.find(b => !b.hidden);
        if (first) { jump(first.dataset.nav!); first.classList.add('is-active'); }
      });
    }
  })();

  // Feature flags - auto-save each toggle (a preference, like the theme picker).
  // `[data-flag]` is either the native checkbox or a <jelly-switch> host; both
  // carry `.checked` and emit a bubbling `change`, so one handler covers both.
  viewEl.querySelector('#feature-flags')?.addEventListener('change', async e => {
    const input = (e.target as Element).closest<HTMLInputElement>('[data-flag]');
    if (!input) return;
    const current = await host.profile.get();
    const flagId = input.dataset.flag!;
    const featureFlags = { ...(current.featureFlags ?? {}), [flagId]: input.checked };
    await host.profile.set!({ ...current, featureFlags });
    liveProfile = { ...current, featureFlags };
    // Keep the synchronous mirror in step so the Neurospicy player (rendered in
    // popovers, outside the profile-aware views) reflects the change on next render.
    setFlagMirror(flagId, input.checked);
    setSummary('feature-flags-section', flagsSummary());
    // Performance UI applies on the spot: reflect it onto <html> so the gated stylesheet
    // switches immediately - no reload, and off restores the full chrome byte-for-byte.
    if (flagId === PERFORMANCE_UI_FLAG.id) applyPerfUi(input.checked);
    // Performance HUD mounts/unmounts on the spot (the mirror above is already set, so
    // mountPerfHud's own perfHudOn() gate passes when turning on). Off removes the element
    // and stops its rAF loop, leaving no residue.
    if (flagId === PERF_HUD_FLAG.id) { if (input.checked) mountPerfHud(); else unmountPerfHud(); }
    // A connector kill switch changes what Connected services may offer, so re-mount
    // that card's two bodies in place (only if they are already mounted - a closed
    // card will read the flag when it first opens). Every SEND surface reads
    // connectorEnabled() at call time, so nothing else needs telling.
    if (flagId.startsWith('conn-') && connectionsLoaded) {
      connectionsLoaded = false;
      syncLoaded = false;
      loadConnectionsCard();
    }
    // Toggling the Neurospicy feature: silence any loop when turning it off (the UI is
    // gone, so leave no invisible audio), and show/hide the bottom-right dock to match.
    if (flagId === NEUROSPICY_FLAG.id) {
      // Atmosphere lives in the same player, so it goes quiet on the same terms - 
      // its controls disappear with the dock and audio must not outlive them.
      if (!input.checked) { stopNeurospicy(); stopAtmosphere(); }
      syncNeuroDock(host as unknown as Parameters<typeof syncNeuroDock>[0]);
    }
    // Toggling Jelly effects applies on the spot: load the bundle if needed, then
    // re-render the list so every row swaps between the CSS switch and
    // <jelly-switch>. Focus returns to the toggled control (innerHTML drops it).
    if (flagId === JELLY_FLAG.id) {
      jellyOn = await ensureJelly(input.checked);
      const list = viewEl.querySelector('#feature-flags');
      if (list) {
        list.innerHTML = flagListHtml();
        list.querySelector<HTMLElement>(`[data-flag="${flagId}"]`)?.focus();
      }
      // The Accessibility card's rows use the same two control kinds, so they swap
      // with the flag rows - otherwise the page would show both looks at once.
      // Rebuilt from a11yState (not the DOM), which the pref listener keeps current.
      const a11yList = viewEl.querySelector('#a11y-prefs');
      if (a11yList) a11yList.innerHTML = a11yListHtml();
      const renderSaveList = viewEl.querySelector('#render-save-prefs');
      if (renderSaveList) renderSaveList.innerHTML = renderSaveListHtml();
      // The Appearance card's one toggle row swaps its control kind with them.
      const followDsList = viewEl.querySelector('#appearance-prefs');
      if (followDsList) followDsList.innerHTML = followDsListHtml();
      // The identity form swaps its controls in place too, carrying any unsaved
      // edits across (both control kinds expose `.value` on the [name] element).
      const form = viewEl.querySelector('#profile-form');
      if (form) {
        for (const f of fields) {
          const ctl = form.querySelector<HTMLElement & { value?: string }>(`[name="${f}"]`);
          if (ctl) ctl.outerHTML = fieldControl(f, String(ctl.value ?? ''));
        }
        const save = form.querySelector('button[type="submit"], jelly-button[type="submit"]');
        if (save) save.outerHTML = saveButtonHtml();
      }
    }
    announce(input.checked ? t('Enabled') : t('Disabled'));
  });

  // Accessibility prefs - auto-save each toggle, same shape as the flag listener
  // above (and its own container, so a pref never lands in profile.featureFlags).
  // setA11yPref switches the <html> attribute FIRST and persists after, so the
  // change is visible on the same frame even if the profile write is slow or fails.
  viewEl.querySelector('#a11y-prefs')?.addEventListener('change', async e => {
    const input = (e.target as Element).closest<HTMLInputElement>('[data-a11y]');
    if (!input) return;
    const key = input.dataset.a11y as keyof A11yPrefs;
    a11yState[key] = input.checked;   // keeps a jelly-flag re-render in step with the live state
    setSummary('a11y-section', a11ySummary());
    await setA11yPref(host, key, input.checked);
    announce(input.checked ? t('Enabled') : t('Disabled'));
  });

  // "Interface follows the design system" - mirror + profile through
  // lib/chrome-follow.ts, then one repaint through the painter that owns the
  // chrome accent. Turning it off removes the injected style; turning it on
  // resolves the primary again, so the accent is right on the same gesture.
  viewEl.querySelector('#appearance-prefs')?.addEventListener('change', async e => {
    const input = (e.target as Element).closest<HTMLInputElement>('[data-follow-ds]');
    if (!input) return;
    followDsState = input.checked;   // keeps a jelly-flag re-render in step
    await setChromeFollow(host as unknown as Parameters<typeof setChromeFollow>[0], input.checked);
    const { applyChromeBrandVars } = await import('../brand-vars.ts');
    await applyChromeBrandVars(host as unknown as Parameters<typeof applyChromeBrandVars>[0]);
    announce(input.checked ? t('Enabled') : t('Disabled'));
  });

  // Renders auto-save toggle - auto-saves to the profile like the flags above.
  // Stored on profile.saveRenders (default ON = unset), never localStorage.
  viewEl.querySelector('#render-save-prefs')?.addEventListener('change', async e => {
    const input = (e.target as Element).closest<HTMLInputElement>('[data-save-renders]');
    if (!input) return;
    renderSaveState = input.checked;   // keep a jelly-flag re-render in step
    setSummary('renders-section', rendersSummary());
    const current = await host.profile.get();
    await host.profile.set!({ ...current, saveRenders: input.checked });
    liveProfile = { ...current, saveRenders: input.checked };
    announce(input.checked ? t('Enabled') : t('Disabled'));
  });

  // Label-click forwarding for the jelly switches is app-wide now - the one
  // delegated forwarder installed by lib/jelly.ts when the bundle loads. (A
  // second, view-local forwarder here would run on the same click and toggle the
  // switch straight back - reading as a dead toggle.)

  // Deep-link target: #/profile?focus=<id> scrolls a section or control into view
  // and briefly highlights it, so a link that promises "go set this up" visibly
  // delivers it instead of landing on the page top with no clue where to look.
  // Three recognised forms, one shared path (pulseHighlight below) so a target
  // never falls back to a silent scroll: the feature-flags alias (gallery's
  // empty-state nudge), the use-details alias (gallery's personalisation nudge),
  // and any NAV_SECTIONS id (the rail's own jump(), search hits, share links,
  // screenshot recipes). A collapsible target is opened first (fires the toggle
  // that lazy-loads storage/images - the initial-open check at the bottom catches
  // it too).
  const sec: HTMLElement | null = focusFlags
    ? viewEl.querySelector<HTMLElement>('#feature-flags-section')
    : focusUseDetails
    ? viewEl.querySelector<HTMLElement>('.profile-check')
    : focusParam && NAV_SECTIONS.some(s => s.id === focusParam)
    ? viewEl.querySelector<HTMLElement>('#' + CSS.escape(focusParam))
    : null;
  if (sec) {
    if (sec instanceof HTMLDetailsElement) sec.open = true;
    requestAnimationFrame(() => {
      sec.scrollIntoView({
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        block: focusUseDetails ? 'center' : 'start',
      });
      // Focus the heading for screen-reader/keyboard continuity - the same move
      // the rail's nav buttons make (a no-op for .profile-check, which has none).
      sec.querySelector<HTMLElement>('h2')?.focus?.();
      pulseHighlight(sec);
    });
  }

  // Appearance - theme preview cards (moved here from the dashboard). Each preview
  // applies the theme app-wide immediately (applyTheme mirrors to localStorage +
  // updates the PWA chrome colour) and persists it to the profile (canonical). The
  // active preview is flagged; a soft theme cue plays on switch.
  const themePick = viewEl.querySelector<HTMLElement>('[data-theme-pick]');
  themePick?.addEventListener('click', async e => {
    const btn = (e.target as Element).closest<HTMLButtonElement>('[data-theme-set]');
    if (!btn) return;
    const next = btn.dataset.themeSet;
    if (!next || next === currentTheme()) return;
    // Reflect the new active state across the picker.
    themePick.querySelectorAll<HTMLButtonElement>('[data-theme-set]').forEach(b => {
      const on = b.dataset.themeSet === next;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', String(on));
    });
    await setTheme(host, next);
    setSummary('appearance-section', themeLabel(currentTheme()));
  });

  // Lolly instance - "Change" re-opens the sheet (views/profile.ts is one of
  // its two callers; see components/instance-sheet.ts's header). "Leave" takes
  // the covenant's whole exit (lib/instance-leave.ts): org caches, the install
  // identity, the pack and its tools, THEN the base - not just the base, which
  // left the organisation's ingredients behind - and then the same resync →
  // remount path as a successful connect, so the catalogue swap happens
  // identically either way.
  // The design-systems card (plans/186 section 5): lazy like the credentials
  // card - the list, the switch and the doors live in lib/design-system/.
  {
    const dsBody = viewEl.querySelector<HTMLElement>('#design-systems-body');
    if (dsBody) {
      void import('../lib/design-system/design-systems-card.ts')
        .then(m => m.mountDesignSystemsCard(dsBody, host as unknown as Parameters<typeof m.mountDesignSystemsCard>[1]))
        .catch(() => { dsBody.innerHTML = ''; });
    }
  }
  viewEl.querySelector('#instance-change-btn')?.addEventListener('click', async () => {
    await openInstanceSheet(host);
    await mountProfile(viewEl, host); // re-read getInstanceBase() into the row
  });
  viewEl.querySelector('#instance-disconnect-btn')?.addEventListener('click', async () => {
    const { leaveInstance, countSessionsUsingInstanceTools } = await import('../lib/instance-leave.ts');
    // Sessions saved here against a tool the instance installed stay (they are the
    // person's) but go inert once the tool leaves - say so before, not after.
    const inert = await countSessionsUsingInstanceTools(host as unknown as Parameters<typeof countSessionsUsingInstanceTools>[0]).catch(() => 0);
    const ok = await confirmDialog({
      title: t('Leave this instance?'),
      message: t('Your work stays on this device - sessions, images, profile, and anything you installed yourself. What the organisation supplied leaves with it: its brand, its tools, its catalogue, and this device’s standing with it. Anything you saved to the instance stays there. You can reconnect any time.')
        + (inert ? ' ' + t('Saved sessions that use this instance’s tools: {n}. They stay, but will not open until you reconnect.', { n: inert }) : ''),
      confirmLabel: t('Leave'),
      danger: false,
    });
    if (!ok) return;
    await leaveInstance();
    await syncCatalog(host as unknown as Parameters<typeof syncCatalog>[0]).catch(() => { /* offline - falls back to cache */ });
    window.dispatchEvent(new Event('lolly:remount')); // re-navigates the current route with the fresh (bundled) catalogue
  });

  // Language FAB menu - same control as gallery/catalog/projects, so switching
  // the language is consistent across views. switchLang saves to profile.lang +
  // localStorage, then reloads so the whole app re-renders in the new language.
  attachLangMenu(viewEl.querySelector<HTMLElement>('.lang-fab'), host);

  mountBackPill(viewEl);
  mountHomeFab(viewEl);

  // Sound switch - the unified "Sound:" toggle (speaker indicator + sliding switch). Auto-saves
  // each flip to profile.sfxMuted + localStorage and chirps when re-enabled (via applySfxMuted,
  // inside wireSoundSwitch), a preference like the theme picker.
  wireSoundSwitch(viewEl, host as unknown as Parameters<typeof wireSoundSwitch>[1]);


  // Every info-dot + feature-flag explainer on the page is a shared help-tip now
  // (component audit rec 13) - one delegated wiring on the view root handles all
  // of them (click/tap toggle, Escape, outside-click dismiss), and survives the
  // per-section innerHTML rebuilds below since it's attached to viewEl itself.
  wireHelpTips(viewEl);
  linkHelpDescriptions(viewEl);

  // Opt-in pill reflects the checkbox state (saved on form submit).
  const useDetailsInput = viewEl.querySelector<HTMLInputElement>('[name="useDetails"]');
  const optInTag = viewEl.querySelector('.profile-check-tag');
  const optInText = viewEl.querySelector('.profile-check-text');
  useDetailsInput?.addEventListener('change', () => {
    const on = useDetailsInput!.checked;
    if (optInTag) optInTag.textContent = on ? t('Opted-in') : t('opt-in');
    if (optInText) optInText.textContent = on ? t('Using my details') : t('Use my details to create');
    // Opt-in plays a rising-then-falling chime, the app's most expressive sound cue; opt-out
    // plays a sad one. (The checkbox's press-tick already played via the global click cue.)
    playSfx(on ? 'optIn' : 'optOut');
  });

  // Headshot - upload → circular crop → save as a user asset → store the ref.
  const headshotFileInput = viewEl.querySelector<HTMLInputElement>('#headshot-file');
  const paintHeadshot = (url: string) => {
    headshotUrl = url || '';
    const preview = viewEl.querySelector<HTMLElement>('#headshot-preview');
    if (preview) {
      // Set the image as a background so the overlaid Edit button (and its click
      // listener) is never re-created.
      preview.classList.toggle('is-empty', !headshotUrl);
      // Fall back to the default mark so the circle is never a blank swatch.
      preview.style.backgroundImage = `url('${headshotUrl || DEFAULT_HEADSHOT}')`;
    }
    const uploadBtn = viewEl.querySelector('#headshot-upload');
    if (uploadBtn) uploadBtn.textContent = headshotUrl ? t('Edit') : t('Upload');
    const removeBtn = viewEl.querySelector<HTMLElement>('#headshot-remove');
    if (removeBtn) removeBtn.hidden = !headshotUrl;
  };
  // The whole circle is the hit-area: a click anywhere on the preview opens the
  // file picker (the Upload/Edit button is just a visual affordance now, and its
  // own click bubbles up here too). The ✕ remove badge handles its own click, so
  // ignore taps that land on it.
  viewEl.querySelector('#headshot-preview')?.addEventListener('click', e => {
    if ((e.target as Element).closest('#headshot-remove')) return;
    headshotFileInput?.click();
  });
  headshotFileInput?.addEventListener('change', async () => {
    const file = headshotFileInput!.files?.[0];
    headshotFileInput!.value = '';
    if (!file) return;
    const errEl = viewEl.querySelector<HTMLElement>('#headshot-error');
    if (errEl) errEl.hidden = true;
    try {
      const isSvg = file.type === 'image/svg+xml' || /\.svg$/i.test(file.name);
      if (isSvg) {
        // Vector headshot: keep it vector (tools clip to a circle at render time),
        // so no raster cropper. Sanitise first - an uploaded SVG is untrusted markup.
        const clean = await sanitizeSvgToString(await file.text());
        const ref = await saveHeadshot(host, new Blob([clean], { type: 'image/svg+xml' }), { vector: true });
        paintHeadshot(ref.url);
        await refreshCounter();
        return;
      }
      const cropped = await openHeadshotCropper(file); // throws on undecodable
      if (!cropped) return; // user cancelled
      const ref = await saveHeadshot(host, cropped.blob);
      paintHeadshot(ref.url);
      await refreshCounter();
    } catch (err) {
      host.log?.('error', 'Headshot save failed', { error: String(err) });
      // Inline + announced, matching the import-dialog error pattern - not a
      // blocking alert(). e.g. the storage-cap message.
      const msg = String((err as { message?: unknown })?.message ?? err);
      if (errEl) { errEl.textContent = msg; errEl.hidden = false; }
      announce(msg, { assertive: true });
    }
  });
  viewEl.querySelector('#headshot-remove')?.addEventListener('click', async () => {
    await host.assets._deleteUserAsset!(HEADSHOT_ID).catch(() => {});
    const current = await host.profile.get();
    delete current.headshot;
    await host.profile.set!(current);
    paintHeadshot('');
    await refreshCounter();
  });

  // Live storage refresh - re-render the Storage meter IF it's loaded. The headshot
  // upload/remove paths change user-asset bytes and call this; it no-ops while the
  // Storage section is still collapsed (loadStorage sets refreshStorageMeter).
  let refreshStorageMeter: (() => Promise<void>) | null = null;
  async function refreshCounter() { if (refreshStorageMeter) await refreshStorageMeter(); }

  // Personal details form
  viewEl.querySelector('#profile-form')!.addEventListener('submit', async e => {
    e.preventDefault();
    // Either the native submit button or its jelly-mode <jelly-button> stand-in;
    // disabling goes through the ATTRIBUTE (jelly-button observes it and syncs
    // its shadow button; on a native button it's equivalent to .disabled).
    const btn = (e.target as HTMLFormElement).querySelector<HTMLElement>('button[type="submit"], jelly-button[type="submit"]');
    const label = btn?.textContent ?? t('Save');
    btn?.toggleAttribute('disabled', true);
    const data = Object.fromEntries(new FormData(e.target as HTMLFormElement).entries());
    // Checkboxes aren't reliably in FormData (omitted when unchecked), so read it explicitly.
    const useDetails = (e.target as HTMLFormElement).querySelector<HTMLInputElement>('[name="useDetails"]')?.checked ?? false;
    delete data.useDetails;
    try {
      const current = await host.profile.get();
      // The FormData rows are dynamic string/File pairs; the merged record is a Profile.
      await host.profile.set!({ ...current, ...data, useDetails } as unknown as Profile);
      if (btn) btn.textContent = t('Saved');
      playSfx('saveProfile');   // an "all set" confirmation chime on a successful save
      announce(t('Profile saved'));
      // Stay on the page; restore the button shortly after so users can keep editing.
      setTimeout(() => { if (btn) { btn.textContent = label; btn.toggleAttribute('disabled', false); } }, 1600);
    } catch {
      if (btn) { btn.textContent = label; btn.toggleAttribute('disabled', false); }
      announce(t("Couldn't save - try again"), { assertive: true });
    }
  });

  // Persist each section's open/closed state across visits. Every card in
  // NAV_SECTIONS is a <details> now, so the registry is the list (it was a
  // hand-kept copy of the five collapsibles).
  for (const { id } of NAV_SECTIONS) {
    const d = viewEl.querySelector<HTMLDetailsElement>('#' + id);
    d?.addEventListener('toggle', () => {
      openState[id] = d!.open;
      try { localStorage.setItem(OPEN_KEY, JSON.stringify(openState)); } catch { /* storage blocked */ }
    });
  }

  const fontsHost = host as unknown as UserFontsHost;

  // ── Storage: lazy. Fetch the data + render the (heavy) image grid only when the
  // section is first expanded, then wire its handlers. ──────────────────────────
  const storageDetails = viewEl.querySelector<HTMLDetailsElement>('#storage-section');
  let storageLoaded = false;
  // Tool display names + a glyph for sessions saved without a thumbnail.
  const toolNameById = new Map((window.__toolIndex?.tools ?? []).map(t => [t.id, t.name] as [string, string]));
  const toolNameOf = (id: string) => toolNameById.get(id) || id || t('Saved session');
  // 'image' glyph - deduped against catalog-summary.ts's "raster" and valid.ts's
  // ICONS.image (near-identical circle-radius/path-endpoint roundings of the same
  // Lucide "image" icon; component-audit rec 5).
  const SESS_PLACEHOLDER_ICON = icon('image', { strokeWidth: 1.8 });
  // What profile-storage-model.ts's row renderers read out of this mount.
  const sessRowCtx: SessionRowContext = { toolNameOf, placeholderIcon: SESS_PLACEHOLDER_ICON };
  // Honours the in-app Reduce motion pref as well as the OS one (lib/a11y-prefs.ts),
  // so the counter roll-up and the smooth panel scroll below calm down for a user
  // whose device never advertised a motion preference.
  const reduceMotion = () => prefersReducedMotion();

  // Tool-previews cache: measurable (size()/list()) + clearable. Feature-detected so
  // an older/rebuilt bridge without host.previews just folds its bytes into "Other".
  async function measurePreviews(): Promise<PreviewsMeasure> {
    if (!host.previews?.list) return { bytes: 0, count: 0, available: false };
    try {
      const list = await host.previews.list();
      const bytes = typeof host.previews.size === 'function'
        ? await host.previews.size()
        : list.reduce((n, r) => n + (r?.thumb ? r.thumb.length : 0), 0);
      return { bytes, count: list.length, available: true };
    } catch { return { bytes: 0, count: 0, available: false }; }
  }

  // Read every measurer + the browser's ground-truth estimate into one model. The
  // four measured slices never sum to estimate().usage - the remainder is labelled
  // "Other" = max(0, usage − measured), so measured + Other == usage by construction.
  async function measure(): Promise<StorageModel> {
    const estP = navigator.storage?.estimate
      ? navigator.storage.estimate().catch(() => null)
      : Promise.resolve(null);
    const [estimate, sessions, sessionSizes, blobCacheBytes, allImages, imagesBytes, previews, pins, speech, upscale, matte, ocr, reword, aiDetect, durable, fileHistory] = await Promise.all([
      estP,
      host.state.list().catch((): SessionEntry[] => []),
      host.state.sizes!().catch((): Record<string, number> => ({})),
      host.assets._blobCacheSize!().catch(() => 0),
      host.assets._listUserAssets!().catch((): AssetRef[] => []),
      host.assets._userAssetsSize!().catch(() => 0),
      measurePreviews(),
      pinnedToolBytes().catch(() => ({ bytes: 0, count: 0 })),
      speechCacheBytes().catch(() => ({ bytes: 0, files: 0 })),
      upscaleCacheBytes().catch(() => ({ bytes: 0, files: 0 })),
      matteCacheBytes().catch(() => ({ bytes: 0, files: 0 })),
      ocrCacheBytes().catch(() => ({ bytes: 0, files: 0 })),
      rewordCacheBytes().catch(() => ({ bytes: 0, files: 0 })),
      aiDetectCacheBytes().catch(() => ({ bytes: 0, files: 0 })),
      durableCacheBytes().catch(() => ({ bytes: 0, files: 0 })),
      measureFileHistory().catch(() => ({ bytes: 0 })),
    ]);
    const sessBytes = Object.values(sessionSizes).reduce((s, n) => s + n, 0);
    const cacheBytes = blobCacheBytes;
    // The grid shows visual uploads only: the headshot is hidden, and the non-visual
    // user assets (brand tokens doc, font faces - managed in the Adjust your brand card)
    // would render as broken tiles. Their bytes stay in the slice either way.
    const VISUAL = new Set(['raster', 'vector', 'video', 'lottie']);
    const imageList = allImages.filter(a => a.id !== HEADSHOT_ID && VISUAL.has(a.type));
    const measured = sessBytes + imagesBytes + cacheBytes + previews.bytes + pins.bytes + speech.bytes + upscale.bytes + matte.bytes + ocr.bytes + reword.bytes + aiDetect.bytes + durable.bytes + fileHistory.bytes;
    const hasEstimate = !!(estimate && estimate.usage != null);
    const usage: number | null = hasEstimate ? estimate!.usage! : null;
    const quota: number | null = (estimate && estimate.quota) || null;
    const overshoot = hasEstimate && measured > usage!; // estimates are bucketed/approximate
    const other = (hasEstimate && !overshoot) ? Math.max(0, usage! - measured) : 0;
    const total = hasEstimate ? Math.max(usage!, measured) : measured; // the hero number
    return {
      sessions: { bytes: sessBytes, count: sessions.length, sizes: sessionSizes, list: sessions },
      images: { bytes: imagesBytes, count: imageList.length, list: imageList },
      cache: { bytes: cacheBytes },
      previews,
      pins,
      speech,
      upscale,
      matte,
      ocr,
      reword,
      aiDetect,
      durable,
      fileHistory,
      measured, hasEstimate, usage, quota, overshoot, other, total,
    };
  }

  // The whole section, rendered ONCE. applyMeter() then refreshes only the viz so an
  // open managed list (multi-select state) is never rebuilt out from under the user.
  function renderSection(m: StorageModel, sort: string) {
    const hasPrev = m.previews.available;
    // Pinned-tools slice only renders once something is pinned - a permanent
    // "0 B" row would be noise for the (default) never-pinned user.
    const hasPins = m.pins.count > 0;
    // Same for the speech models: the slice appears only after a download.
    const hasSpeech = m.speech.bytes > 0;
    // The AI image models (host.upscale / host.matte) - each appears only once its
    // store holds bytes (pre-downloaded from Available offline, or fetched on demand
    // by the Upscale / Remove-background dialogs).
    const hasUpscale = m.upscale.bytes > 0;
    const hasMatte = m.matte.bytes > 0;
    const hasOcr = m.ocr.bytes > 0;
    const hasReword = m.reword.bytes > 0;
    const hasAiDetect = m.aiDetect.bytes > 0;
    // The durable-credential encoder - present once a durable export or the offline
    // part has fetched it. Scoped to its own key in the shared trustmark store.
    const hasDurable = m.durable.bytes > 0;
    return `
      <section class="store-meter" aria-label="${escape(t('Storage on this device'))}">
        <header class="store-hero">
          <p class="store-hero-num" id="store-hero-num" data-bytes="0">0 KB</p>
          <p class="store-hero-cap">${t('On this device')} ${infoDot(t('The real total this origin uses on this device, measured by your browser. Everything below is on THIS device only - nothing is uploaded.'))}</p>
          <p class="store-headroom" id="store-headroom" hidden></p>
        </header>

        <div class="store-bar" id="store-bar">
          <button type="button" class="seg" data-cat="sessions" style="flex-grow:0"></button>
          <button type="button" class="seg" data-cat="images" style="flex-grow:0"></button>
          <button type="button" class="seg" data-cat="file-history" style="flex-grow:0"></button>
          <button type="button" class="seg" data-cat="cache" style="flex-grow:0"></button>
          <button type="button" class="seg" data-cat="previews" style="flex-grow:0"${hasPrev ? '' : ' hidden'}></button>
          <button type="button" class="seg" data-cat="pins" style="flex-grow:0"${hasPins ? '' : ' hidden'}></button>
          <button type="button" class="seg" data-cat="speech" style="flex-grow:0"${hasSpeech ? '' : ' hidden'}></button>
          <button type="button" class="seg" data-cat="upscale" style="flex-grow:0"${hasUpscale ? '' : ' hidden'}></button>
          <button type="button" class="seg" data-cat="matte" style="flex-grow:0"${hasMatte ? '' : ' hidden'}></button>
          <button type="button" class="seg" data-cat="ocr" style="flex-grow:0"${hasOcr ? '' : ' hidden'}></button>
          <button type="button" class="seg" data-cat="reword" style="flex-grow:0"${hasReword ? '' : ' hidden'}></button>
          <button type="button" class="seg" data-cat="aidetect" style="flex-grow:0"${hasAiDetect ? '' : ' hidden'}></button>
          <button type="button" class="seg" data-cat="durable" style="flex-grow:0"${hasDurable ? '' : ' hidden'}></button>
          <span class="seg seg--other" data-cat="other" style="flex-grow:0" aria-hidden="true" hidden></span>
        </div>
        <p class="visually-hidden" id="store-aria-sentence"></p>

        <ul class="store-legend" role="list">
          <li><button type="button" class="store-chip" data-cat="sessions"><span class="store-chip-sw" data-cat="sessions"></span><span class="store-chip-name">${t('Saved sessions')}</span><span class="store-chip-val" data-size="sessions">-</span></button></li>
          <li><button type="button" class="store-chip" data-cat="images"><span class="store-chip-sw" data-cat="images"></span><span class="store-chip-name">${t('My images')}</span><span class="store-chip-val" data-size="images">-</span></button></li>
          <li><button type="button" class="store-chip" data-cat="file-history"><span class="store-chip-sw" data-cat="file-history"></span><span class="store-chip-name">${t('File results & versions')}</span><span class="store-chip-val" data-size="file-history">-</span></button></li>
          <li><button type="button" class="store-chip" data-cat="cache"><span class="store-chip-sw" data-cat="cache"></span><span class="store-chip-name">${t('Asset cache')}</span><span class="store-chip-val" data-size="cache">-</span></button></li>
          ${hasPrev ? `<li><button type="button" class="store-chip" data-cat="previews"><span class="store-chip-sw" data-cat="previews"></span><span class="store-chip-name">${t('Tool previews')}</span><span class="store-chip-val" data-size="previews">-</span></button></li>` : ''}
          ${hasPins ? `<li><button type="button" class="store-chip" data-cat="pins"><span class="store-chip-sw" data-cat="pins"></span><span class="store-chip-name">${t('Available offline')}</span><span class="store-chip-val" data-size="pins">-</span></button></li>` : ''}
          ${hasSpeech ? `<li><button type="button" class="store-chip" data-cat="speech"><span class="store-chip-sw" data-cat="speech"></span><span class="store-chip-name">${t('Voice models')}</span><span class="store-chip-val" data-size="speech">-</span></button></li>` : ''}
          ${hasUpscale ? `<li><button type="button" class="store-chip" data-cat="upscale"><span class="store-chip-sw" data-cat="upscale"></span><span class="store-chip-name">${t('Upscaling models')}</span><span class="store-chip-val" data-size="upscale">-</span></button></li>` : ''}
          ${hasMatte ? `<li><button type="button" class="store-chip" data-cat="matte"><span class="store-chip-sw" data-cat="matte"></span><span class="store-chip-name">${t('Background removal')}</span><span class="store-chip-val" data-size="matte">-</span></button></li>` : ''}
          ${hasOcr ? `<li><button type="button" class="store-chip" data-cat="ocr"><span class="store-chip-sw" data-cat="ocr"></span><span class="store-chip-name">${t('Text recognition')}</span><span class="store-chip-val" data-size="ocr">-</span></button></li>` : ''}
          ${hasReword ? `<li><button type="button" class="store-chip" data-cat="reword"><span class="store-chip-sw" data-cat="reword"></span><span class="store-chip-name">${t('Rewriter model')}</span><span class="store-chip-val" data-size="reword">-</span></button></li>` : ''}
          ${hasAiDetect ? `<li><button type="button" class="store-chip" data-cat="aidetect"><span class="store-chip-sw" data-cat="aidetect"></span><span class="store-chip-name">${t('AI text detector')}</span><span class="store-chip-val" data-size="aidetect">-</span></button></li>` : ''}
          ${hasDurable ? `<li><button type="button" class="store-chip" data-cat="durable"><span class="store-chip-sw" data-cat="durable"></span><span class="store-chip-name">${t('Durable credential')}</span><span class="store-chip-val" data-size="durable">-</span></button></li>` : ''}
          ${m.hasEstimate ? `<li><span class="store-chip store-chip--other"><span class="store-chip-sw is-hatch"></span><span class="store-chip-name">${t('Other')}</span><span class="store-chip-val" data-size="other">-</span>${infoDot(t('Your profile, internal indexes, the offline app cache and storage overhead - everything not itemised above. Calculated as total used minus the measured items. Clear it with "Clear all my data" below.'))}</span></li>` : ''}
        </ul>

        <p class="store-quota" id="store-quota" hidden><span class="storage-bar-wrap"><span class="storage-bar-fill" id="store-quota-fill" style="width:0%"></span></span><span class="store-quota-text" id="store-quota-text"></span></p>
        <p class="store-reclaim" id="store-reclaim"></p>
        <p class="store-footnote" id="store-footnote" hidden></p>

        <div class="store-manages">
          <div class="store-manage store-manage--row" data-cat="file-history">
            <span class="store-manage-name">${t('File results & versions')} <span class="storage-count" data-size-label="file-history">0 KB</span><br><small>${t('Saved copies and earlier asset bytes, including recoverable deleted assets. Included in data backups. Not a disposable cache.')}</small></span>
            <a class="btn" href="#/convert">${t('Review & manage…')}</a>
          </div>
          <details class="store-manage" data-cat="sessions">
            <summary class="store-manage-sum">${COLLAPSE_CHEV}<span>${t('Saved sessions')}</span> <span class="storage-count" data-count="sessions">0</span> <span class="storage-hint" data-size-hint="sessions">0 KB</span></summary>
            <div class="store-manage-body">
              <div class="store-sess-tools">
                <label class="store-selall"><input type="checkbox" id="sess-selall"> ${t('Select all')}</label>
                <button type="button" class="store-sort" data-sort="${sort}">${sort === 'recent' ? t('Recent ▾') : t('Largest first ▾')}</button>
              </div>
              <ul class="store-sess-list" id="store-sess-list">${sessionRowsHtml(m, sort, sessRowCtx)}</ul>
              <a class="store-manage-link" href="#/p">${t('Organise in Projects')} →</a>
            </div>
          </details>

          <details class="store-manage" data-cat="images">
            <summary class="store-manage-sum">${COLLAPSE_CHEV}<span>${t('My images')}</span> <span class="storage-count" id="userimg-count">0</span> <span class="storage-hint" id="userimg-size">0 KB</span> ${infoDot(t('Images you save to reuse across tools. This size includes your profile photo and any brand fonts.'))}</summary>
            <div class="store-manage-body">
              <div class="userimg-grid" id="userimg-grid">
                ${m.images.list.map(userImageThumb).join('')}
                <button type="button" class="userimg-add" id="userimg-add" aria-label="${escape(t('Add images'))}">
                  <span class="userimg-add-icon" aria-hidden="true">+</span>
                  <span class="userimg-add-text">${t('Add')}</span>
                </button>
              </div>
              <input type="file" id="userimg-file" accept="image/svg+xml,image/png,image/apng,image/jpeg,image/webp,image/gif,image/avif,image/heic,image/heif,video/mp4,video/webm,.mp4,.webm,.mov" multiple hidden>
              <p class="profile-inline-error" id="userimg-error" style="color:hsl(var(--destructive));font-size:13px;margin:.4rem 0 0" hidden></p>
            </div>
          </details>

          <div class="store-manage store-manage--row" data-cat="cache">
            <span class="store-manage-name">${t('Asset cache')} ${infoDot(t('Downloaded catalog content; it re-downloads on demand. Safe to clear.'))} <span class="storage-count" data-size-label="cache">0 KB</span></span>
            <button type="button" id="clear-cache-btn" class="btn-link-danger">${t('Clear cache')}</button>
          </div>

          ${hasPrev ? `<div class="store-manage store-manage--row" data-cat="previews">
            <span class="store-manage-name">${t('Tool previews')} ${infoDot(t('Snapshots Lolly draws of personalised tool cards - they redraw when needed. Safe to clear.'))} <span class="storage-count" data-size-label="previews">0 KB</span></span>
            <button type="button" id="clear-previews-btn" class="btn-link-danger">${t('Clear previews')}</button>
          </div>` : ''}

          ${hasPins ? `<div class="store-manage store-manage--row" data-cat="pins">
            <span class="store-manage-name">${t('Available offline')} ${infoDot(t('Tools you pinned in the gallery to work offline - their files are kept on this device. Unpinning re-downloads them on demand.'))} <span class="storage-count" data-size-label="pins">0 KB</span></span>
            <button type="button" id="unpin-all-btn" class="btn-link-danger">${t('Unpin all')}</button>
          </div>` : ''}

          ${hasSpeech ? `<div class="store-manage store-manage--row" data-cat="speech">
            <span class="store-manage-name">${t('Voice models')} ${infoDot(t('On-device voices for Script audio and narration. Removing them frees the space; they download again with your consent when next used.'))} <span class="storage-count" data-size-label="speech">0 KB</span></span>
            <button type="button" id="clear-speech-btn" class="btn-link-danger">${t('Remove voices')}</button>
          </div>` : ''}

          ${hasUpscale ? `<div class="store-manage store-manage--row" data-cat="upscale">
            <span class="store-manage-name">${t('Upscaling models')} ${infoDot(t('On-device AI upscalers for the Upscale tool. Removing them frees the space; they download again with your consent when next used.'))} <span class="storage-count" data-size-label="upscale">0 KB</span></span>
            <button type="button" id="clear-upscale-btn" class="btn-link-danger">${t('Remove models')}</button>
          </div>` : ''}

          ${hasMatte ? `<div class="store-manage store-manage--row" data-cat="matte">
            <span class="store-manage-name">${t('Background removal')} ${infoDot(t('On-device cut-out models for Remove background. Removing them frees the space; they download again with your consent when next used.'))} <span class="storage-count" data-size-label="matte">0 KB</span></span>
            <button type="button" id="clear-matte-btn" class="btn-link-danger">${t('Remove models')}</button>
          </div>` : ''}

          ${hasOcr ? `<div class="store-manage store-manage--row" data-cat="ocr">
            <span class="store-manage-name">${t('Text recognition')} ${infoDot(t('On-device OCR models for reading text out of images. Removing them frees the space; they download again with your consent when next used.'))} <span class="storage-count" data-size-label="ocr">0 KB</span></span>
            <button type="button" id="clear-ocr-btn" class="btn-link-danger">${t('Remove models')}</button>
          </div>` : ''}

          ${hasReword ? `<div class="store-manage store-manage--row" data-cat="reword">
            <span class="store-manage-name">${t('Rewriter model')} ${infoDot(t('The on-device rewriter for Humanize. Removing it frees the space; it downloads again with your consent when next used.'))} <span class="storage-count" data-size-label="reword">0 KB</span></span>
            <button type="button" id="clear-reword-btn" class="btn-link-danger">${t('Remove model')}</button>
          </div>` : ''}
          ${hasAiDetect ? `<div class="store-manage store-manage--row" data-cat="aidetect">
            <span class="store-manage-name">${t('AI text detector')} ${infoDot(t('The on-device detector behind the deeper AI-text check. Removing it frees the space; it downloads again with your consent when next used.'))} <span class="storage-count" data-size-label="aidetect">0 KB</span></span>
            <button type="button" id="clear-aidetect-btn" class="btn-link-danger">${t('Remove model')}</button>
          </div>` : ''}
          ${hasDurable ? `<div class="store-manage store-manage--row" data-cat="durable">
            <span class="store-manage-name">${t('Durable credential')} ${infoDot(t('The on-device model that hides the durable credential in exported pixels. Removing it frees the space; it downloads again with your consent when next used.'))} <span class="storage-count" data-size-label="durable">0 KB</span></span>
            <button type="button" id="clear-durable-btn" class="btn-link-danger">${t('Remove model')}</button>
          </div>` : ''}
        </div>

        <div class="storage-subsection">
          <div class="storage-subsection-header">
            <span>${t('Move to another device')} ${infoDot(t('Export everything - profile, saved sessions, uploaded images and preferences - as one file, then import it on another offline install to pick up exactly where you left off. Stays entirely on your devices.'))}</span>
          </div>
          <div class="storage-actions">
            ${jellyOn
              ? `<jelly-button variant="platinum" id="export-data-btn" data-sfx="whoosh">${t('Export my data')}</jelly-button>
            <jelly-button variant="platinum" id="import-data-btn">${t('Import data…')}</jelly-button>`
              : `<button type="button" id="export-data-btn" class="btn" data-sfx="whoosh">${t('Export my data')}</button>
            <button type="button" id="import-data-btn" class="btn">${t('Import data…')}</button>`}
            <input type="file" id="import-data-input" accept=".zip,application/zip" hidden>
          </div>
          <button type="button" id="export-render-btn" class="btn storage-hoard-btn">📦 ${t('Export my data &amp; render everything')}</button>
          <p class="storage-hoard-hint">${t('The backup above, plus a second zip that <strong>renders every saved session</strong> to its output file - organised into folders that mirror your Projects. A complete offline archive; can be large and slow with many sessions.')}</p>
        </div>

        <div class="storage-actions">
          ${jellyOn
            ? `<jelly-button variant="rose" id="clear-storage-btn">${t('Clear all my data')}</jelly-button>`
            : `<button type="button" id="clear-storage-btn" class="btn btn-danger">${t('Clear all my data')}</button>`}
        </div>

        <div class="store-selbar" id="store-selbar" role="region" aria-live="polite" hidden>
          <span class="store-selbar-count">${t('0 selected')}</span>
          <button type="button" class="btn store-selbar-clear">${t('Clear selection')}</button>
          <button type="button" class="btn btn-danger store-selbar-del">${t('Delete')}</button>
        </div>
      </section>`;
  }

  async function loadStorage() {
    if (storageLoaded) return;
    const panel = viewEl.querySelector<HTMLElement>('#storage-body');
    if (!panel) return;
    const body: HTMLElement = panel;
    storageLoaded = true;

    let model = await measure();
    // Import remounts Profile, and navigation can reuse viewEl for another
    // route while storage estimates/IDB reads are outstanding. A late result
    // belongs only to the exact panel that requested it.
    if (!body.isConnected || viewEl.querySelector('#storage-body') !== body) return;
    let sessSort = 'size';
    const userImages = [...model.images.list]; // mutable mirror for the grid + lightbox

    body.innerHTML = renderSection(model, sessSort);
    // Content loaded async after the card opened - cascade it in like the catalog does
    // (silent: the shuffle already played when the section toggled open).
    staggerReveal([...body.children], { sound: false });

    const bar = body.querySelector('#store-bar');
    const heroNum = body.querySelector<HTMLElement>('#store-hero-num');
    const selbar = body.querySelector<HTMLElement>('#store-selbar');
    const setText = (sel: string, text: string) => body.querySelectorAll(sel).forEach(e => { e.textContent = text; });

    // Hero count-up - cosmetic; set instantly under reduced-motion OR a hidden tab
    // (rAF is paused when document.hidden, so the final value must land immediately).
    function countUp(el: HTMLElement | null, to: number) {
      if (!el) return;
      const from = Number(el.dataset.bytes || 0);
      el.dataset.bytes = String(to);
      if (reduceMotion() || document.hidden || from === to) { el.textContent = fmtBytes(to); return; }
      const dur = 600; let t0: number | null = null;
      const tick = (now: number) => {
        if (t0 == null) t0 = now;
        const p = Math.min(1, (now - t0) / dur);
        const eased = 1 - (1 - p) ** 3;
        el.textContent = fmtBytes(Math.round(from + (to - from) * eased));
        if (p < 1) requestAnimationFrame(tick); else el.textContent = fmtBytes(to);
      };
      requestAnimationFrame(tick);
    }

    const selectedSessionBytes = () => {
      let n = 0;
      body.querySelectorAll<HTMLElement>('.store-sess-check:checked').forEach(c => { n += model.sessions.sizes[c.dataset.slot!] || 0; });
      return n;
    };
    function updateReclaim(m: StorageModel) {
      const el = body.querySelector('#store-reclaim');
      if (el) el.innerHTML = t('Up to <strong>{n}</strong> can be freed here', { n: fmtBytes(m.cache.bytes + m.previews.bytes + m.pins.bytes + m.speech.bytes + m.upscale.bytes + m.matte.bytes + m.ocr.bytes + m.durable.bytes + selectedSessionBytes()) });
    }

    // Refresh ONLY the visualization (hero, segments, legend, quota, reclaim, aria,
    // manage-summary badges) from a fresh model. Never rebuilds the session list/grid.
    function applyMeter(m: StorageModel) {
      countUp(heroNum, m.hasEstimate ? m.total : m.measured);
      // Same number as the hero, so the folded summary and the open card agree.
      setSummary('storage-section', tRaw('{size} used', { size: fmtBytes(m.hasEstimate ? m.total : m.measured) }));
      const headroom = body.querySelector<HTMLElement>('#store-headroom');
      if (headroom) {
        if (m.hasEstimate && m.quota) {
          const used = m.usage! / m.quota;
          const phrase = used < 0.5 ? t('lots of room left') : used < 0.8 ? t('plenty of room left') : used < 0.95 ? t('getting full') : t('almost full');
          headroom.textContent = tRaw('Using {pct} of your {quota} device budget · {phrase}', { pct: fmtPct(m.usage!, m.quota), quota: fmtBytes(m.quota), phrase });
          headroom.hidden = false;
        } else headroom.hidden = true;
      }
      const segs: Array<[string, number, string, boolean]> = [
        ['sessions', m.sessions.bytes, t('Saved sessions'), true],
        ['images', m.images.bytes, t('My images'), true],
        ['file-history', m.fileHistory?.bytes ?? 0, t('File results & versions'), true],
        ['cache', m.cache.bytes, t('Asset cache'), true],
        ['previews', m.previews.bytes, t('Tool previews'), m.previews.available],
        ['pins', m.pins.bytes, t('Available offline'), m.pins.count > 0],
        ['speech', m.speech.bytes, t('Voice models'), m.speech.bytes > 0],
        ['upscale', m.upscale.bytes, t('Upscaling models'), m.upscale.bytes > 0],
        ['matte', m.matte.bytes, t('Background removal'), m.matte.bytes > 0],
        ['ocr', m.ocr.bytes, t('Text recognition'), m.ocr.bytes > 0],
        ['reword', m.reword.bytes, t('Rewriter model'), m.reword.bytes > 0],
        ['aidetect', m.aiDetect.bytes, t('AI text detector'), m.aiDetect.bytes > 0],
        ['durable', m.durable.bytes, t('Durable credential'), m.durable.bytes > 0],
      ];
      for (const [cat, bytes, label, avail] of segs) {
        const seg = bar?.querySelector<HTMLElement>(`.seg[data-cat="${cat}"]`);
        if (!seg) continue;
        seg.style.flexGrow = String(Math.max(0, bytes));
        seg.hidden = !avail || bytes <= 0;
        seg.setAttribute('aria-label', tRaw('{label}, {size} - manage', { label, size: fmtBytes(bytes) }));
        seg.title = `${label} - ${fmtBytes(bytes)}`;
      }
      const otherSeg = bar?.querySelector<HTMLElement>('.seg--other');
      if (otherSeg) { otherSeg.style.flexGrow = String(m.other); otherSeg.hidden = !(m.hasEstimate && !m.overshoot && m.other > 0); }

      setText('[data-size="sessions"]', fmtBytes(m.sessions.bytes));
      setText('[data-size="images"]', fmtBytes(m.images.bytes));
      setText('[data-size="file-history"]', fmtBytes(m.fileHistory?.bytes ?? 0));
      setText('[data-size-label="file-history"]', fmtBytes(m.fileHistory?.bytes ?? 0));
      setText('[data-size="cache"]', fmtBytes(m.cache.bytes));
      setText('[data-size="previews"]', fmtBytes(m.previews.bytes));
      setText('[data-size="pins"]', fmtBytes(m.pins.bytes));
      setText('[data-size="speech"]', fmtBytes(m.speech.bytes));
      setText('[data-size="upscale"]', fmtBytes(m.upscale.bytes));
      setText('[data-size="matte"]', fmtBytes(m.matte.bytes));
      setText('[data-size="ocr"]', fmtBytes(m.ocr.bytes));
      setText('[data-size="reword"]', fmtBytes(m.reword.bytes));
      setText('[data-size="aidetect"]', fmtBytes(m.aiDetect.bytes));
      setText('[data-size="durable"]', fmtBytes(m.durable.bytes));
      setText('[data-size="other"]', `~${fmtBytes(m.other)}`);
      setText('[data-count="sessions"]', String(m.sessions.count));
      setText('[data-size-hint="sessions"]', fmtBytes(m.sessions.bytes));
      setText('[data-size-label="cache"]', fmtBytes(m.cache.bytes));
      setText('[data-size-label="previews"]', fmtBytes(m.previews.bytes));
      setText('[data-size-label="pins"]', fmtBytes(m.pins.bytes));
      setText('[data-size-label="speech"]', fmtBytes(m.speech.bytes));
      setText('[data-size-label="upscale"]', fmtBytes(m.upscale.bytes));
      setText('[data-size-label="matte"]', fmtBytes(m.matte.bytes));
      setText('[data-size-label="ocr"]', fmtBytes(m.ocr.bytes));
      setText('[data-size-label="reword"]', fmtBytes(m.reword.bytes));
      setText('[data-size-label="aidetect"]', fmtBytes(m.aiDetect.bytes));
      setText('[data-size-label="durable"]', fmtBytes(m.durable.bytes));
      const imgCount = body.querySelector('#userimg-count');
      const imgSize = body.querySelector('#userimg-size');
      if (imgCount) imgCount.textContent = `${m.images.count}`;
      if (imgSize) imgSize.textContent = fmtBytes(m.images.bytes);

      const quotaRow = body.querySelector<HTMLElement>('#store-quota');
      const fill = body.querySelector<HTMLElement>('#store-quota-fill');
      const quotaText = body.querySelector('#store-quota-text');
      if (m.hasEstimate && m.quota) {
        if (fill) fill.style.width = `${Math.min(100, (m.usage! / m.quota) * 100)}%`;
        if (quotaText) quotaText.innerHTML = t('{used} of {quota} device budget · <strong>{pct}</strong> used', { used: fmtBytes(m.usage!), quota: fmtBytes(m.quota), pct: fmtPct(m.usage!, m.quota) });
        if (quotaRow) quotaRow.hidden = false;
      } else if (quotaRow) quotaRow.hidden = true;

      const note = body.querySelector<HTMLElement>('#store-footnote');
      if (note) {
        if (!m.hasEstimate) { note.textContent = t('Device total unavailable - showing measured items only.'); note.hidden = false; }
        else if (m.overshoot) { note.textContent = t("Measured items meet or exceed the browser's estimate (estimates are approximate)."); note.hidden = false; }
        else note.hidden = true;
      }
      const aria = body.querySelector('#store-aria-sentence');
      if (aria) aria.textContent = reconciliationSentence(m);
      updateReclaim(m);
    }

    // Explore: a legend chip / bar segment isolates its slice and opens + scrolls to
    // that category's manage panel. Re-clicking the active one clears the highlight.
    function exploreCategory(cat: string) {
      const next = bar?.getAttribute('data-active') === cat ? '' : cat;
      if (bar) {
        if (next) bar.setAttribute('data-active', next); else bar.removeAttribute('data-active');
        bar.querySelectorAll<HTMLElement>('.seg').forEach(s => s.classList.toggle('is-active', !!next && s.dataset.cat === next));
      }
      body.querySelectorAll<HTMLElement>('.store-chip').forEach(c => c.classList.toggle('is-active', !!next && c.dataset.cat === next));
      if (!next) return;
      const panel = body.querySelector<HTMLElement>(`.store-manage[data-cat="${cat}"]`);
      if (panel) {
        if (panel.tagName === 'DETAILS') (panel as HTMLDetailsElement).open = true;
        panel.scrollIntoView({ block: 'start', behavior: reduceMotion() ? 'auto' : 'smooth' });
      }
    }

    const ensureSessEmptyState = () => {
      const list = body.querySelector('#store-sess-list');
      if (list && !list.querySelector('.store-sess')) list.innerHTML = `<li class="storage-empty">${t('No saved sessions yet.')}</li>`;
    };
    function syncSelbar() {
      const checked = [...body.querySelectorAll<HTMLElement>('.store-sess-check:checked')];
      if (selbar) {
        selbar.hidden = checked.length === 0;
        let bytes = 0; checked.forEach(c => bytes += model.sessions.sizes[c.dataset.slot!] || 0);
        const cnt = selbar.querySelector('.store-selbar-count');
        if (cnt) cnt.textContent = t('{n} selected · {size}', { n: checked.length, size: fmtBytes(bytes) });
      }
      // Reserve space so the fixed bar never covers the section's bottom controls (mobile).
      body.querySelector('.store-meter')?.classList.toggle('has-selbar', checked.length > 0);
      const all = body.querySelector<HTMLInputElement>('#sess-selall');
      const boxes = [...body.querySelectorAll('.store-sess-check')];
      if (all) all.checked = boxes.length > 0 && checked.length === boxes.length;
      updateReclaim(model);
    }

    async function refreshMeter() { model = await measure(); applyMeter(model); }

    // The confirm modal restores focus to the (now-removed) delete control on close, so
    // after a deletion move focus to a surviving control - else keyboard/SR users drop to
    // <body> and have to re-traverse the page.
    function focusSurvivingSession(preferred?: HTMLElement | null) {
      const t = (preferred && document.contains(preferred) && preferred)
        || body.querySelector<HTMLElement>('.store-sess-del')
        || body.querySelector<HTMLElement>('.store-sort')
        || body.querySelector<HTMLElement>('.store-manage[data-cat="sessions"] > summary');
      t?.focus?.();
    }

    async function deleteOneSession(slot: string, btn: HTMLButtonElement) {
      const bytes = model.sessions.sizes[slot] || 0;
      const row = [...body.querySelectorAll<HTMLElement>('.store-sess')].find(r => r.dataset.slot === slot);
      const label = row?.querySelector('.store-sess-label')?.textContent || t('this session');
      const ok = await confirmDialog({
        title: t('Delete this session?'),
        message: bytes
          ? tRaw('"{name}" will be permanently removed from this device, freeing about {size}. This cannot be undone.', { name: label, size: fmtBytes(bytes) })
          : tRaw('"{name}" will be permanently removed from this device. This cannot be undone.', { name: label }),
        confirmLabel: t('Delete'),
      });
      if (!ok) return;
      // The next/previous row's delete button is the natural landing spot post-removal.
      const nextFocus = (row?.nextElementSibling || row?.previousElementSibling)?.querySelector?.('.store-sess-del') as HTMLElement | null | undefined;
      btn.disabled = true;
      try { await host.state.delete(slot); }
      catch (err) { host.log?.('error', 'Session delete failed', { slot, error: String(err) }); btn.disabled = false; return; }
      row?.remove();
      ensureSessEmptyState();
      syncSelbar();
      focusSurvivingSession(nextFocus);
      await refreshMeter();
      announce(t('Freed {freed} - {used} used', { freed: fmtBytes(bytes), used: fmtBytes(model.hasEstimate ? model.total : model.measured) }));
    }

    async function deleteSelectedSessions(btn: HTMLButtonElement) {
      const checked = [...body.querySelectorAll<HTMLElement>('.store-sess-check:checked')];
      if (!checked.length) return;
      const slots = checked.map(c => c.dataset.slot!);
      let bytes = 0; slots.forEach(s => bytes += model.sessions.sizes[s] || 0);
      const ok = await confirmDialog({
        title: slots.length === 1 ? t('Delete 1 saved session?') : t('Delete {n} saved sessions?', { n: slots.length }),
        message: slots.length === 1
          ? t('This permanently removes it from this device, freeing about {size}. This cannot be undone.', { size: fmtBytes(bytes) })
          : t('This permanently removes them from this device, freeing about {size}. This cannot be undone.', { size: fmtBytes(bytes) }),
        confirmLabel: t('Delete {n}', { n: slots.length }),
      });
      if (!ok) return;
      const prev = btn.textContent; btn.disabled = true; btn.textContent = t('Deleting…');
      // Only splice a row once its delete actually resolves - otherwise a rejected
      // delete leaves a ghost (row gone, but the session still counted by refreshMeter
      // and resurrected on the next sort). Freed bytes are summed from real successes.
      let freed = 0, done = 0;
      for (const slot of slots) {
        try { await host.state.delete(slot); }
        catch (err) { host.log?.('error', 'Session delete failed', { slot, error: String(err) }); continue; }
        freed += model.sessions.sizes[slot] || 0; done++;
        [...body.querySelectorAll<HTMLElement>('.store-sess')].find(r => r.dataset.slot === slot)?.remove();
      }
      btn.textContent = prev; btn.disabled = false;
      ensureSessEmptyState();
      syncSelbar();
      focusSurvivingSession();
      await refreshMeter();
      announce(done === slots.length
        ? (done === 1 ? t('Deleted 1 session - freed {size}', { size: fmtBytes(freed) }) : t('Deleted {n} sessions - freed {size}', { n: done, size: fmtBytes(freed) }))
        : t('Deleted {done} of {total} - freed {size}; some could not be removed', { done, total: slots.length, size: fmtBytes(freed) }));
    }

    function toggleSort(btn: HTMLElement) {
      sessSort = sessSort === 'size' ? 'recent' : 'size';
      btn.dataset.sort = sessSort;
      btn.textContent = sessSort === 'recent' ? t('Recent ▾') : t('Largest first ▾');
      const checked = new Set([...body.querySelectorAll<HTMLElement>('.store-sess-check:checked')].map(c => c.dataset.slot!));
      const list = body.querySelector('#store-sess-list');
      if (list) list.innerHTML = sessionRowsHtml(model, sessSort, sessRowCtx);
      checked.forEach(slot => {
        const box = [...body.querySelectorAll<HTMLInputElement>('.store-sess-check')].find(c => c.dataset.slot === slot);
        if (box) box.checked = true;
      });
      syncSelbar();
    }

    async function clearRegenerable(btn: HTMLButtonElement, fn: () => Promise<unknown>, doneMsg: string) {
      const prev = btn.textContent; btn.disabled = true; btn.textContent = t('Clearing…');
      try { await fn(); } catch (err) { host.log?.('error', doneMsg, { error: String(err) }); }
      btn.textContent = t('Cleared');
      setTimeout(() => { btn.textContent = prev; btn.disabled = false; }, 1500);
      await refreshMeter();
      announce(doneMsg);
    }

    // ── one delegated click listener (explore / clear / sort / multi-select bar) ──
    body.addEventListener('click', async (e) => {
      const explore = (e.target as Element).closest<HTMLElement>('.store-chip[data-cat], .seg[data-cat]');
      if (explore && explore.dataset.cat !== 'other') { exploreCategory(explore.dataset.cat!); return; }

      const del = (e.target as Element).closest<HTMLButtonElement>('[data-del-session]');
      if (del) { await deleteOneSession(del.dataset.delSession!, del); return; }

      const sortBtn = (e.target as Element).closest<HTMLElement>('.store-sort');
      if (sortBtn) { toggleSort(sortBtn); return; }

      const cacheBtn = (e.target as Element).closest<HTMLButtonElement>('#clear-cache-btn');
      // 'derived-media' rides with the asset cache: it is the same kind of thing
      // (downloaded/derived bytes that regenerate on demand), so it is counted in
      // the same slice - see measure() - and must be cleared by the same button.
      if (cacheBtn) { await clearRegenerable(cacheBtn, () => clearIdbStores(['asset-blob', 'asset-meta', 'derived-media', 'audio-peaks', 'audio-cover-bakes']), t('Cleared asset cache')); return; }

      const prevBtn = (e.target as Element).closest<HTMLButtonElement>('#clear-previews-btn');
      if (prevBtn) { await clearRegenerable(prevBtn, () => host.previews?.clear(), t('Cleared tool previews')); return; }

      const unpinBtn = (e.target as Element).closest<HTMLButtonElement>('#unpin-all-btn');
      if (unpinBtn) { await clearRegenerable(unpinBtn, () => unpinAll(), t('Removed offline copies')); return; }

      // removePart clears BOTH speech buckets and forgets the offline-part
      // record, so the offline section's Speech row reads not-downloaded again.
      const speechBtn = (e.target as Element).closest<HTMLButtonElement>('#clear-speech-btn');
      if (speechBtn) { await clearRegenerable(speechBtn, () => removePart('speech'), t('Removed voice models')); return; }

      // removePart clears the model's IndexedDB store and forgets the offline-part
      // record, so Available offline reads not-downloaded again; the dialog re-fetches
      // on next use behind its own consent line.
      const upscaleBtn = (e.target as Element).closest<HTMLButtonElement>('#clear-upscale-btn');
      if (upscaleBtn) { await clearRegenerable(upscaleBtn, () => removePart('upscale'), t('Removed upscaling models')); return; }
      const matteBtn = (e.target as Element).closest<HTMLButtonElement>('#clear-matte-btn');
      if (matteBtn) { await clearRegenerable(matteBtn, () => removePart('matte'), t('Removed background-removal models')); return; }
      const ocrBtn = (e.target as Element).closest<HTMLButtonElement>('#clear-ocr-btn');
      if (ocrBtn) { await clearRegenerable(ocrBtn, () => removePart('ocr'), t('Removed text-recognition models')); return; }
      const durableBtn = (e.target as Element).closest<HTMLButtonElement>('#clear-durable-btn');
      if (durableBtn) { await clearRegenerable(durableBtn, () => removePart('durable'), t('Removed the durable-credential model')); return; }
      const rewordBtn = (e.target as Element).closest<HTMLButtonElement>('#clear-reword-btn');
      if (rewordBtn) { await clearRegenerable(rewordBtn, () => removePart('reword'), t('Removed the rewriter model')); return; }
      const aiDetectBtn = (e.target as Element).closest<HTMLButtonElement>('#clear-aidetect-btn');
      if (aiDetectBtn) { await clearRegenerable(aiDetectBtn, () => clearAiDetectCaches(), t('Removed the AI text detector')); return; }

      if ((e.target as Element).closest('.store-selbar-clear')) { body.querySelectorAll<HTMLInputElement>('.store-sess-check').forEach(c => { c.checked = false; }); syncSelbar(); return; }
      const selDel = (e.target as Element).closest<HTMLButtonElement>('.store-selbar-del');
      if (selDel) { await deleteSelectedSessions(selDel); return; }
    });

    // selection checkboxes (incl. select-all) update the floating action bar.
    body.addEventListener('change', (e) => {
      if ((e.target as Element).matches('.store-sess-check')) { syncSelbar(); }
      else if ((e.target as Element).matches('#sess-selall')) {
        const on = (e.target as HTMLInputElement).checked;
        body.querySelectorAll<HTMLInputElement>('.store-sess-check').forEach(c => { c.checked = on; });
        syncSelbar();
      }
    });

    // ── My images - same add/delete/lightbox handlers as before (grid reused). ──
    const userimgAddBtn = body.querySelector<HTMLButtonElement>('#userimg-add');
    async function syncUserImgMeta() {
      await refreshCounter(); // re-measures → applyMeter refreshes the count/size badges + legend + bar
    }
    const userimgFile = body.querySelector<HTMLInputElement>('#userimg-file');
    userimgAddBtn?.addEventListener('click', () => userimgFile?.click());
    userimgFile?.addEventListener('change', async () => {
      const files = [...(userimgFile!.files ?? [])];
      userimgFile!.value = '';
      if (!files.length) return;
      if (userimgAddBtn) userimgAddBtn.disabled = true;
      const imgErr = body.querySelector<HTMLElement>('#userimg-error');
      if (imgErr) imgErr.hidden = true;
      for (const file of files) {
        try {
          // host carries the web-only bridge methods storeUserUpload needs; its
          // exact PickerHost type isn't exported from picker.
          const ref = await storeUserUpload(host as unknown as Parameters<typeof storeUserUpload>[0], file);
          userImages.unshift(ref);
          body.querySelector('#userimg-grid')?.insertAdjacentHTML('afterbegin', userImageThumb(ref));
        } catch (err) {
          host.log?.('error', 'Image upload failed', { name: file.name, error: String(err) });
          const msg = String((err as { message?: unknown })?.message ?? err);
          if (imgErr) { imgErr.textContent = msg; imgErr.hidden = false; }
          announce(msg, { assertive: true });
          break;
        }
      }
      if (userimgAddBtn) userimgAddBtn.disabled = false;
      await syncUserImgMeta();
    });
    body.querySelector('#userimg-grid')?.addEventListener('click', async e => {
      const view = (e.target as Element).closest<HTMLElement>('[data-view-userimg]');
      if (view) {
        const ref = userImages.find(a => a.id === view.dataset.viewUserimg);
        if (ref) openImageLightbox(ref, openProfileModals);
        return;
      }
      const btn = (e.target as Element).closest<HTMLButtonElement>('[data-delete-userimg]');
      if (!btn) return;
      const id = btn.dataset.deleteUserimg!;
      btn.disabled = true;
      try { await host.assets._deleteUserAsset!(id); }
      catch (err) { host.log?.('error', 'Failed to delete image', { id, error: String(err) }); btn.disabled = false; return; }
      btn.closest('[data-userimg]')?.remove();
      const i = userImages.findIndex(a => a.id === id);
      if (i !== -1) userImages.splice(i, 1);
      await syncUserImgMeta();
    });

    applyMeter(model);
    refreshStorageMeter = refreshMeter;

    // Clear all - confirmation dialog gated on typing a randomised word, so an
    // irreversible wipe can't be fired by reflex (or a stray double-click).
    viewEl.querySelector('#clear-storage-btn')?.addEventListener('click', () => {
      const word = CLEAR_CONFIRM_WORDS[Math.floor(Math.random() * CLEAR_CONFIRM_WORDS.length)]!;
      const content = `
        <h3 id="clear-dialog-title">${t('Clear all my data?')}</h3>
        <p>${t('This removes your profile, all saved sessions, your uploaded images, and the asset cache. Cannot be undone.')}</p>
        <label class="clear-confirm">
          <span class="clear-confirm-prompt">${t('Type <strong>{word}</strong> to confirm', { word })}</span>
          <input type="text" class="clear-confirm-input" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="${escape(tRaw('Type {word} to confirm', { word }))}">
        </label>
        <div class="clear-dialog-actions">
          <button class="btn btn-danger" data-scope="all" data-sfx="byebye" disabled>${t('Clear everything')}</button>
          <button class="btn" data-scope="cancel">${t('Cancel')}</button>
        </div>`;
      const modal = mountModal<void>(content, {
        className: 'clear-dialog',
        initialFocus: (el) => el.querySelector<HTMLElement>('.clear-confirm-input'),
        onClose: () => openProfileModals.delete(modal),
      });
      modal.el.setAttribute('aria-labelledby', 'clear-dialog-title');
      openProfileModals.add(modal);

      const confirmInput = modal.el.querySelector<HTMLInputElement>('.clear-confirm-input')!;
      const clearBtn = modal.el.querySelector<HTMLButtonElement>('[data-scope="all"]')!;
      const matches = () => confirmInput.value.trim().toLowerCase() === word;
      confirmInput.addEventListener('input', () => { clearBtn.disabled = !matches(); });
      confirmInput.addEventListener('keydown', e => { if (e.key === 'Enter' && matches()) { e.preventDefault(); clearBtn.click(); } });

      modal.el.addEventListener('click', async e => {
        const scope = (e.target as Element).closest<HTMLElement>('[data-scope]')?.dataset.scope;
        if (!scope || scope === 'cancel') { modal.close(); return; }
        if (scope === 'all' && !matches()) return; // guard: the word must match

        const btns = modal.el.querySelectorAll('button');
        btns.forEach(b => (b.disabled = true));
        clearBtn.textContent = t('Clearing…');

        localStorage.clear();
        sessionStorage.clear();
        // 'audio-peaks' belongs in this list for a PRIVACY reason, not a tidiness one:
        // its rows are keyed by asset id, and an upload's id embeds the user's original
        // filename ("user/upload/…-therapy_session.mp3"), alongside a measured envelope
        // of the audio. Leaving it out means "Delete everything" leaves behind both the
        // name of a file and the form of its sound. Every derived cache added here in
        // future needs the same check: does its KEY or its VALUE say anything about the
        // user's own content?
        await clearIdbStores(['state', 'profile', 'user-assets', 'asset-blob', 'asset-meta', 'derived-media', 'audio-peaks', 'audio-cover-bakes']);
        // The 'profile' wipe above dropped the pin RECORDS; also drop the pinned
        // tools' Cache Storage bucket so no orphaned bytes survive the clear.
        await unpinAll().catch(() => { /* cache API unavailable - nothing pinned */ });
        host.profile.bust!();
        applyTheme('light');
        modal.close();
        // The bye-bye song is already playing (data-sfx on the confirm button). Land
        // back on the gallery: with the dismissed flag just wiped, the first-run
        // "Welcome to Lolly" greets the clean slate there (unbranded installs only - 
        // a locked brand never shows it, see mountGallery). A hard reload (not just
        // a hash change) is required: in-memory singletons like the tokens bridge
        // cache (bridge/tokens.ts) only reset on bust(), so a soft nav would keep
        // painting a just-cleared user brand until the next manual refresh.
        window.location.hash = '';
        window.location.reload();
      });
    });

    // Export everything to a portable .zip for carrying to another offline install.
    viewEl.querySelector('#export-data-btn')?.addEventListener('click', async e => {
      const btn = e.currentTarget as HTMLButtonElement;
      const prev = btn.textContent;
      btn.disabled = true;
      btn.textContent = t('Exporting…');
      try {
        // host carries the web-only bridge methods exportBackup needs; its exact
        // BackupHost type isn't exported from data-transfer.
        const { blob, filename, summary } = await exportBackup({ host: host as unknown as Parameters<typeof exportBackup>[0]['host'], storage: localStorage });
        saveBlob(blob, filename);
        announce(tRaw('Exported {sessions} and {images}', {
          sessions: summary.sessions === 1 ? t('1 session') : t('{n} sessions', { n: summary.sessions }),
          images: summary.userAssets === 1 ? t('1 image') : t('{n} images', { n: summary.userAssets }),
        }) + backupHistoryNote(summary));
        btn.textContent = t('Exported');
      } catch (err) {
        host.log?.('error', 'Data export failed', { error: String(err) });
        btn.textContent = t('Export failed');
        announce(err instanceof Error ? err.message : t('Data export failed. Keep your local files and try again.'), { assertive: true });
      }
      setTimeout(() => { btn.textContent = prev; btn.disabled = false; }, 1800);
    });

    // Export EVERYTHING and render it all: the portable backup (as above) AND a second zip
    // that renders every saved session to its output file, in a folder tree mirroring the
    // Projects view. It's non-destructive but potentially big/slow, so it's gated behind a
    // celebratory type-a-word confirm (a distinct, upbeat word pool from the clear-data gate).
    viewEl.querySelector('#export-render-btn')?.addEventListener('click', () => {
      const word = HOARD_CONFIRM_WORDS[Math.floor(Math.random() * HOARD_CONFIRM_WORDS.length)]!;
      const content = `
        <h3 id="hoard-dialog-title">${t('Export everything - and render it all?')}</h3>
        <p>${t('Downloads a full <strong>backup</strong> of your data, then a <strong>rendered archive</strong> - every saved session output to its file, in folders that mirror your Projects. Nothing is deleted. A big library makes a big zip and can take a while.')}</p>
        <label class="clear-confirm">
          <span class="clear-confirm-prompt">${t('Type <strong>{word}</strong> to confirm', { word })}</span>
          <input type="text" class="clear-confirm-input" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="${escape(tRaw('Type {word} to confirm', { word }))}">
        </label>
        <div class="clear-dialog-actions">
          <button class="btn btn-go" data-scope="go" disabled>${t('Hoard it all 📦')}</button>
          <button class="btn" data-scope="cancel">${t('Cancel')}</button>
        </div>`;
      // Mirrors the clear-all dialog above; celebratory `--hoard` modifier only changes copy/colour.
      const modal = mountModal<void>(content, {
        className: 'clear-dialog clear-dialog--hoard',
        initialFocus: (el) => el.querySelector<HTMLElement>('.clear-confirm-input'),
        onClose: () => openProfileModals.delete(modal),
      });
      modal.el.setAttribute('aria-labelledby', 'hoard-dialog-title');
      openProfileModals.add(modal);

      const confirmInput = modal.el.querySelector<HTMLInputElement>('.clear-confirm-input')!;
      const goBtn = modal.el.querySelector<HTMLButtonElement>('[data-scope="go"]')!;
      const matches = () => confirmInput.value.trim().toLowerCase() === word;
      confirmInput.addEventListener('input', () => { goBtn.disabled = !matches(); });
      confirmInput.addEventListener('keydown', e => { if (e.key === 'Enter' && matches()) { e.preventDefault(); goBtn.click(); } });

      modal.el.addEventListener('click', async e => {
        const scope = (e.target as Element).closest<HTMLElement>('[data-scope]')?.dataset.scope;
        if (!scope || scope === 'cancel') { modal.close(); return; }
        if (scope === 'go' && !matches()) return; // guard: the word must match
        modal.close();
        await exportAndRenderEverything();
      });
    });

    // Secondary, on-demand gate for motion (video/animated) renders. They record in real
    // time and PAUSE the moment this tab is hidden, so including them is opt-in behind an
    // explicit "I'm willing to keep this tab active" affirmation. Resolves:
    //   'include' → render them (user committed to keeping the tab active)
    //   'skip'    → drop them, render everything else
    //   'cancel'  → abort the render (Escape / backdrop / Cancel)
    function askKeepTabActive(count: number): Promise<'include' | 'skip' | 'cancel'> {
      return new Promise(resolve => {
        const n = count === 1 ? t('1 creation is a video or animation') : t('{n} of your creations are videos or animations', { n: count });
        const content = `
          <h3 id="keepactive-title">${t('Keep this tab active?')}</h3>
          <p>${t('{n}. Those record in <strong>real time</strong>, so this browser tab must stay open and in front the whole time they render - switch away and they pause. Include them?', { n })}</p>
          <div class="clear-dialog-actions">
            <button class="btn btn-go" data-choice="include">${t("I'm willing to keep this tab active")}</button>
            <button class="btn" data-choice="skip">${t('Skip videos for now')}</button>
            <button class="btn" data-choice="cancel">${t('Cancel')}</button>
          </div>`;
        const modal = mountModal<'include' | 'skip' | 'cancel'>(content, {
          className: 'clear-dialog clear-dialog--hoard',
          cancelValue: 'cancel',
          initialFocus: (el) => el.querySelector<HTMLElement>('[data-choice="include"]'),
          onClose: (result) => { openProfileModals.delete(modal); resolve(result ?? 'cancel'); },
        });
        modal.el.setAttribute('aria-labelledby', 'keepactive-title');
        openProfileModals.add(modal);
        modal.el.addEventListener('click', e => {
          const choice = (e.target as Element).closest<HTMLElement>('[data-choice]')?.dataset.choice;
          if (choice === 'include' || choice === 'skip' || choice === 'cancel') modal.close(choice);
        });
      });
    }

    // The two-part export+render job, kicked off once the confirm word matches. It runs as
    // ONE WP-F background job (lib/batch-job.ts): the data backup and the render report
    // through the same handle, the global job toast owns the progress, and a throw
    // anywhere fails the job so the failure is visible even after the user has left this
    // view. It used to run in a view-owned progress toast that a view swap tore down mid
    // archive - the run kept going with nothing on screen to show for it.
    async function exportAndRenderEverything(): Promise<void> {
      // The victorious fanfare fires when the render QUEUE finishes (see runBatchWithProgress),
      // not here at kickoff - so it lands as a genuine "it's all done" reward.
      startBatchExport(t('Exporting everything'), async (job) => {
        const prof = await host.profile.get().catch(() => null);
        const author = prof && (prof as { useDetails?: boolean }).useDetails ? prof : null;

        // 1) Portable data backup (quick) - the same bundle the "Export my data" button makes.
        job.progress(0, 0, t('Saving your data backup…'));
        try {
          const { blob, filename, summary } = await exportBackup({ host: host as unknown as Parameters<typeof exportBackup>[0]['host'], storage: localStorage });
          saveBlob(blob, filename);
          announce(tRaw('Data backup saved: {sessions}, {images}', {
            sessions: summary.sessions === 1 ? t('1 session') : t('{n} sessions', { n: summary.sessions }),
            images: summary.userAssets === 1 ? t('1 image') : t('{n} images', { n: summary.userAssets }),
          }) + backupHistoryNote(summary));
        } catch (err) {
          // The backup failing must not take the render down with it - it is a separate
          // deliverable, so it is reported and the job carries on.
          host.log?.('error', 'Data export failed', { error: String(err) });
          announce(tRaw('The data backup failed ({error}). Continuing to the render…', { error: String((err as { message?: unknown })?.message ?? err) }));
        }

        // 2) Render EVERYTHING into one nested zip mirroring the Projects tree: loose
        // (uncategorised) sessions at the top, each top-level folder recursed into subpaths.
        job.progress(0, 0, t('Rendering every creation…'));
        const [{ createFolderStore, childFolders }, { exportSelectionAsBatch }] = await Promise.all([
          import('../folders.ts'),
          import('../pro/folder-export.ts'),
        ]);
        const store = createFolderStore(host as unknown as Parameters<typeof createFolderStore>[0]);
        const folders = await store.list();
        const entries = await (host.state as unknown as { list(): Promise<Array<{ slot: string }>> }).list().catch(() => []);
        const claimed = new Set(folders.flatMap(f => f.items.filter(i => i.type === 'session').map(i => i.ref)));
        // Trashed and project-template copies sit in no folder by construction; a backup renders neither.
        const looseSlots = entries.filter(e => !isHiddenSlot(e.slot) && !claimed.has(e.slot)).map(e => e.slot);
        const topLevelIds = childFolders(folders, null).map(f => f.id);
        if (!looseSlots.length && !topLevelIds.length) {
          announce(t('Backup saved. You have no saved sessions to render yet.'));
          return undefined;
        }
        try {
          const result = await exportSelectionAsBatch(host as unknown as Parameters<typeof exportSelectionAsBatch>[0], {
            label: prof?.firstname ? `${prof.firstname}'s Lolly` : 'Lolly',
            sessionRefs: looseSlots,
            folderIds: topLevelIds,
            allFolders: folders as unknown as NonNullable<Parameters<typeof exportSelectionAsBatch>[1]>['allFolders'],
            job,
            author,
            announce,
            // Videos/animations encode in real time (they pause if the tab is hidden), so make
            // them opt-in behind an explicit "I'll keep this tab active" affirmation.
            onMotionFound: (count) => askKeepTabActive(count),
          });
          // A falsy result means the motion prompt was cancelled - the backup still went out,
          // but nothing was rendered, so say so rather than finishing silently.
          if (!result) announce(t('Backup saved. Render cancelled, so nothing else was downloaded.'));
          return result;
        } catch (err) {
          // Logged here (the view has the host), then rethrown so job.fail carries it to
          // the toast - a render failure must never be swallowed into a log line.
          host.log?.('error', 'Render-everything failed', { error: String(err) });
          throw err;
        }
      });
    }

    // Import a bundle from another install (merge-overwrite), then re-mount.
    const importInput = viewEl.querySelector<HTMLInputElement>('#import-data-input');
    viewEl.querySelector('#import-data-btn')?.addEventListener('click', () => importInput?.click());
    importInput?.addEventListener('change', () => {
      const file = importInput!.files?.[0];
      importInput!.value = ''; // let the same file be re-picked later
      if (!file) return;
      showImportDialog(async () => {
        playSfx('vacuum');   // the data gets sucked in - the mirror of export's whoosh
        const bytes = await file.arrayBuffer();
        const summary = await importBackup({ host: host as unknown as Parameters<typeof importBackup>[0]['host'], storage: localStorage }, bytes);
        host.profile.bust!();
        // The bundle may carry a brand: user tokens + font-face assets restore as
        // plain user assets, so drop the token caches, load the faces into
        // document.fonts and repaint the chrome - same as a fresh boot would.
        (host.tokens as { bust?(): void } | undefined)?.bust?.();
        await registerUserFonts(fontsHost).catch(() => { /* faces load at next boot */ });
        void applyChromeBrandVars(host as unknown as Parameters<typeof applyChromeBrandVars>[0]);
        applyTheme(localStorage.getItem('theme') || 'light');
        // `skipped` > 0 means the bundle came from a newer app and carried parts this
        // build doesn't understand yet - surface it rather than pretend a full restore.
        const skipNote = summary.skipped ? ` · ${summary.skipped === 1 ? t('1 newer item skipped') : t('{n} newer items skipped', { n: summary.skipped })}` : '';
        // Failed restores are surfaced separately (and assertively) - a silently-dropped
        // image would be lost for good once the user discards the source backup.
        const failNote = summary.failedAssets ? ` · ${summary.failedAssets === 1 ? t('1 image couldn’t be restored (storage full?)') : t('{n} images couldn’t be restored (storage full?)', { n: summary.failedAssets })}` : '';
        announce(tRaw('Imported {sessions} and {images}', {
          sessions: summary.sessions === 1 ? t('1 session') : t('{n} sessions', { n: summary.sessions }),
          images: summary.userAssets === 1 ? t('1 image') : t('{n} images', { n: summary.userAssets }),
        }) + skipNote + failNote + backupHistoryNote(summary), summary.failedAssets || summary.failedHistory ? { assertive: true } : undefined);
        await mountProfile(viewEl, host);
      });
    });
  }
  storageDetails?.addEventListener('toggle', () => { if (storageDetails!.open) loadStorage(); });
  // A persisted-open section renders open from the HTML `open` attribute, which does
  // NOT fire `toggle`, so kick the lazy load here (runs after first paint).
  if (storageDetails?.open) loadStorage();

  // ── Offline tools: lazy, like Storage. A download manager over every tool the
  // shell can run: search, a per-tool download → progress → tick button (the same
  // three-layer state machine as the gallery cards' keep-offline toggle, styled
  // by offline-manager.css), the measured on-disk size beside each downloaded
  // tool, and a Download-all sweep. Sizes are the tool FILES recorded at pin
  // time (PinRecord.bytes) - manifest-declared catalog assets are prefetched too
  // but counted by the Storage section's Asset-cache slice, never double here. ──
  const offlineDetails = viewEl.querySelector<HTMLDetailsElement>('#offline-section');
  let offlineLoaded = false;
  // Set by loadOffline's wiring; called from _cleanup to DETACH this view from
  // the run, never to stop it. The run itself lives in lib/offline-run.ts (a
  // WP-F job), so leaving /profile mid-sweep keeps the download going with the
  // global job toast owning its progress and its Cancel.
  let offlineRunUnsub: (() => void) | null = null;
  async function loadOffline() {
    if (offlineLoaded) return;
    offlineLoaded = true;
    const body = viewEl.querySelector<HTMLElement>('#offline-body')!;
    interface OfflineTool { id: string; name?: string; icon?: string; listed?: boolean; capabilities?: readonly string[] }
    const tools = ((window.__toolIndex?.tools ?? []) as OfflineTool[])
      // Unlisted tools (context-invoked, e.g. asset-export) and tools this shell
      // can't run are not offered - a download the device can't use is dead weight.
      .filter(tl => tl.listed !== false && toolSupport(tl, host.capabilities, presentApis(host)).status !== 'unavailable')
      .sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));
    let pins: Record<string, PinRecord> = {};
    try { pins = await pinRecords(); } catch { /* IDB unavailable - render all as not downloaded */ }

    const rowHtml = (tl: OfflineTool): string => {
      const rec = pins[tl.id];
      const name = tl.name || tl.id;
      return `
        <li class="odl-row" data-tool="${escape(tl.id)}" data-name="${escape(name.toLowerCase())}">
          <span class="odl-row-icon" aria-hidden="true">${tl.icon ?? ''}</span>
          <span class="odl-row-name">${escape(name)}</span>
          <span class="odl-row-size">${rec ? fmtBytes(rec.bytes) : ''}</span>
          <button type="button" class="odl-pin${rec ? ' is-pinned' : ''}" data-odl="${escape(tl.id)}" aria-pressed="${rec ? 'true' : 'false'}" title="${escape(rec ? t('Available offline') : t('Keep available offline'))}" aria-label="${escape(rec ? tRaw('Remove {name} from offline', { name }) : tRaw('Keep {name} available offline', { name }))}">
            <span class="pin-layer pin-dl" aria-hidden="true">${icon('download')}</span>
            <span class="pin-layer pin-ring" aria-hidden="true">${icon('ring')}</span>
            <span class="pin-layer pin-done" aria-hidden="true">${icon('circleCheck')}</span>
          </button>
        </li>`;
    };

    // Everything the parts rows need up front - all cheap (two small manifest
    // fetches + the already-synced asset index + IDB reads), all best-effort.
    const [precache, infoManifest, catSummary, parts, persist] = await Promise.all([
      fetchPrecacheManifest(),
      fetchInfoManifest(),
      catalogDownloadSummary(),
      partRecords().catch(() => ({} as PartState)),
      persistenceState(),
    ]);
    // The folded summary: what this device is actually holding offline, tools plus
    // parts. Measured once, when the card opens - a download made later in the same
    // visit shows in the card's own rows, and this line catches up on the next mount.
    const heldBytes = Object.values(pins).reduce((n, r) => n + (r?.bytes || 0), 0)
      + Object.values(parts).reduce((n, r) => n + (r?.bytes || 0), 0);
    setSummary('offline-section', heldBytes ? fmtBytes(heldBytes) : tRaw('Not downloaded'));

    const sum = (files: readonly { size: number }[]) => files.reduce((n, f) => n + f.size, 0);
    const plannedBytes: Record<OfflinePartId, number> = {
      app: precache ? sum(precache.groups.app) : 0,
      docs: infoManifest ? sum(docsFileList(infoManifest, currentLang())) : 0,
      // The trustmark models group carries BOTH parts' files, so each row prices its
      // own half (offline-manager's trustmarkGroupSplit is the one rule).
      verify: precache ? sum(precache.groups.ort) + sum(trustmarkGroupSplit(precache.groups.models).verify) : 0,
      catalog: catSummary?.totalBytes ?? 0,
      speech: precache ? sum(precache.groups.speech ?? []) + sum(precache.groups.ortHf ?? []) : 0,
      upscale: precache?.groups.upscale ? sum(precache.groups.upscale) : 0,
      matte: precache?.groups.matte ? sum(precache.groups.matte) : 0,
      ocr: precache?.groups.ocr ? sum(precache.groups.ocr) : 0,
      // Like speech, the reword part owns the shared /ort-hf/ runtime too, so
      // its stated size is honest when it is the only transformers part taken.
      reword: precache?.groups.reword?.length ? sum(precache.groups.reword) + sum(precache.groups.ortHf ?? []) : 0,
      // The Ask embed model (plans/103 M1) - same shared-runtime accounting.
      ask: precache?.groups.embed?.length ? sum(precache.groups.embed) + sum(precache.groups.ortHf ?? []) : 0,
      // The AI-text detector (plans/126 WP-A) - same shared-runtime accounting.
      'ai-detect': precache?.groups.aiDetect?.length ? sum(precache.groups.aiDetect) + sum(precache.groups.ortHf ?? []) : 0,
      // The durable-credential encoder. Manifest-driven like every other model part:
      // a build whose model host does not list the encoder offers no row, rather than
      // a Download button that fails.
      durable: precache ? sum(trustmarkGroupSplit(precache.groups.models).durable) : 0,
    };
    // Model parts are release-versioned in IndexedDB (invalidated by their own
    // cache-version, not a manifest watermark), so they have no live manifest
    // version to go stale against - resyncOfflineParts never touches them.
    const liveVersion = (id: OfflinePartId): string | null =>
      id === 'docs' ? (infoManifest?.version ?? null)
      : (id === 'upscale' || id === 'matte' || id === 'ocr' || id === 'durable') ? null
      : (precache?.version ?? null);

    interface PartDef { id: OfflinePartId; name: string; desc: string; heavy?: boolean }
    const partDefs: PartDef[] = [
      { id: 'app', name: t('The app'), desc: t('Every view, editor and font - so the whole app opens and renders with no connection, not just the pages you have already visited.') },
      { id: 'catalog', name: t('Catalogue'), desc: t('Brand assets beyond the essentials - logos, art and music your tools can pull in. Narrow it by tag if you only need some of it.') },
      { id: 'docs', name: t('Guides & docs'), desc: t('The full documentation site in your language, screenshots included.') },
      { id: 'speech', name: t('Speech voices'), desc: t('Voice models for Script audio and narration. Downloads once (~{size}), runs on-device.', { size: fmtBytes(plannedBytes.speech) }), heavy: true },
      { id: 'upscale', name: t('Upscaling models'), desc: t('The AI image upscalers - photo, illustration/anime and face. Pull them down now (~{size}) and Upscale runs offline, with no wait when you need it.', { size: fmtBytes(plannedBytes.upscale) }), heavy: true },
      { id: 'matte', name: t('Background removal'), desc: t('The on-device cut-out models for Remove background. Pull them down now (~{size}) and it runs offline, with no wait when you need it.', { size: fmtBytes(plannedBytes.matte) }), heavy: true },
      { id: 'ocr', name: t('Text recognition'), desc: t('The on-device OCR models for reading text out of images. Pull them down now (~{size}) and Copy text runs offline, with no wait when you need it.', { size: fmtBytes(plannedBytes.ocr) }), heavy: true },
      { id: 'verify', name: t('Verify deep scan'), desc: t('The on-device watermark scanner for the Verify page. Big - only worth it if you check content credentials away from a connection.'), heavy: true },
      { id: 'durable', name: t('Durable credential'), desc: t('The on-device model that hides an invisible credential in exported pixels. Pull it down now (~{size}) and the first durable export starts straight away, with no wait.', { size: fmtBytes(plannedBytes.durable) }), heavy: true },
      // Only on builds carrying the staged model (plans/127) - the group is
      // empty on public/CI builds and the row would be a dead control.
      ...(precache?.groups.reword?.length ? [{
        id: 'reword' as const,
        name: t('Rewriter model'),
        desc: t('The on-device rewriter behind Humanize. Pull it down now (~{size}) and rewording runs fully offline, with no wait when you need it.', { size: fmtBytes(plannedBytes.reword) }),
        heavy: true,
      }] : []),
      // Only on builds carrying the staged embed model (plans/103 M1) - the
      // group is empty on builds where the model is not staged.
      ...(precache?.groups.embed?.length ? [{
        id: 'ask' as const,
        name: t('Ask matching model'),
        desc: t('The small on-device model that helps Ask Lolly match questions to the right docs section. Pull it down now (~{size}) and better matching works offline from the first question.', { size: fmtBytes(plannedBytes.ask) }),
      }] : []),
      // Only on builds carrying a staged detector (plans/126 WP-A) - the group
      // is empty on builds where no model is staged.
      ...(precache?.groups.aiDetect?.length ? [{
        id: 'ai-detect' as const,
        name: t('AI text detector'),
        desc: t('The on-device model behind the deeper AI-text check on Verify and in the catalog. Pull it down now (~{size}) and the check runs offline, with no wait when you need it.', { size: fmtBytes(plannedBytes['ai-detect']) }),
      }] : []),
    ];

    const partRowHtml = (p: PartDef): string => `
      <li class="odl-part" data-part="${p.id}">
        <div class="odl-part-info">
          <span class="odl-part-name">${escape(p.name)}${p.heavy ? ` <span class="odl-part-heavy">${t('large download')}</span>` : ''}</span>
          <span class="odl-part-desc">${escape(p.desc)}</span>
          ${p.id === 'catalog' && catSummary?.tags.length ? `
          <details class="odl-tagscope">
            <summary>${t('Choose by tag')}</summary>
            <div class="odl-tagchips">${catSummary.tags.map(tg => `
              <label class="odl-tagchip"><input type="checkbox" value="${escape(tg.tag)}"><span>${escape(tg.tag)}</span><span class="odl-tagchip-size">${fmtBytes(tg.bytes)}</span></label>`).join('')}
            </div>
          </details>` : ''}
          <span class="odl-part-sub" data-part-sub="${p.id}" aria-live="polite"></span>
        </div>
        <span class="odl-part-actions">
          <button type="button" class="btn" data-part-dl="${p.id}">${t('Download')}</button>
          <button type="button" class="btn-link-danger" data-part-rm="${p.id}" hidden>${t('Remove')}</button>
        </span>
      </li>`;

    body.innerHTML = `
      <p class="storage-hint-text">${t('Heading somewhere with no connection? Download what you need and it all keeps working - the app, your tools, the catalogue and the docs. Downloads stay on this device and refresh themselves when you are back online.')}</p>
      <div class="odl-sweep">
        <button type="button" id="odl-everything" class="btn">${t('Download everything')}</button>
        <button type="button" id="odl-cancel" class="btn" hidden>${t('Cancel')}</button>
        <span class="odl-sweep-size" id="odl-sweep-size"></span>
      </div>
      <label class="odl-sweep-models" id="odl-models-row" hidden><input type="checkbox" id="odl-incl-models"><span>${t('Include all the AI models')} <span class="odl-part-heavy">${t('large download')}</span></span><span class="odl-sweep-models-size" id="odl-models-size"></span></label>
      <div class="odl-progress" id="odl-progress" hidden>
        <div class="odl-progress-track" role="progressbar" aria-label="${escape(t('Offline download progress'))}" aria-valuemin="0" aria-valuemax="100"><div class="odl-progress-fill"></div></div>
        <span class="odl-progress-text" aria-live="polite"></span>
      </div>
      <ul class="odl-parts">${partDefs.map(partRowHtml).join('')}</ul>
      <p class="odl-persist" id="odl-persist" hidden></p>
      <h3 class="odl-subhead">${t('Tools')}</h3>
      <p class="storage-hint-text">${t('Download a tool to keep it working with no connection - its template, hooks and fonts are stored on this device. The tick means ready offline.')}</p>
      <div class="odl-head">
        <span class="odl-total" id="odl-total" aria-live="polite"></span>
        <button type="button" id="odl-all" class="btn">${t('Download all')}</button>
        <button type="button" id="odl-none" class="btn-link-danger">${t('Remove all')}</button>
      </div>
      <input type="search" class="odl-search" placeholder="${escape(t('Search tools…'))}" aria-label="${escape(t('Search tools'))}">
      <ul class="odl-list">${tools.map(rowHtml).join('')}</ul>
      <p class="odl-empty" hidden>${t('No tools match.')}</p>`;
    staggerReveal([...body.children], { sound: false });

    const totalEl = body.querySelector<HTMLElement>('#odl-total')!;
    const allBtn = body.querySelector<HTMLButtonElement>('#odl-all')!;
    const noneBtn = body.querySelector<HTMLButtonElement>('#odl-none')!;
    const updateTotals = () => {
      const recs = Object.entries(pins).filter(([id]) => tools.some(tl => tl.id === id));
      const bytes = recs.reduce((n, [, r]) => n + (r.bytes || 0), 0);
      totalEl.textContent = t('{n} of {total} downloaded · {size} on disk', { n: recs.length, total: tools.length, size: fmtBytes(bytes) });
      allBtn.hidden = recs.length >= tools.length;
      noneBtn.hidden = recs.length === 0;
    };
    updateTotals();

    // One row's state, updated in place after a pin/unpin lands.
    const syncRow = (id: string) => {
      const row = body.querySelector<HTMLElement>(`.odl-row[data-tool="${CSS.escape(id)}"]`);
      const rec = pins[id];
      if (!row) return;
      const sizeEl = row.querySelector<HTMLElement>('.odl-row-size');
      if (sizeEl) sizeEl.textContent = rec ? fmtBytes(rec.bytes) : '';
      const btn = row.querySelector<HTMLElement>('.odl-pin');
      const name = row.querySelector('.odl-row-name')?.textContent ?? id;
      if (btn) {
        btn.classList.toggle('is-pinned', !!rec);
        btn.setAttribute('aria-pressed', String(!!rec));
        btn.title = rec ? t('Available offline') : t('Keep available offline');
        btn.setAttribute('aria-label', rec ? tRaw('Remove {name} from offline', { name }) : tRaw('Keep {name} available offline', { name }));
      }
      updateTotals();
    };

    // Same erased cast as the gallery's pin handler - the concrete web host
    // satisfies sync's structural SyncHost slice at runtime.
    const prefetch = (ids: string[]) => prefetchAssetsById(host as unknown as Parameters<typeof prefetchAssetsById>[0], ids);
    const celebrate = (btn: HTMLElement) => {
      btn.classList.add('is-celebrating');
      const done = () => btn.classList.remove('is-celebrating');
      btn.addEventListener('animationend', done, { once: true });
      setTimeout(done, 900); // reduced-motion fires no animationend
    };
    // Downloads one tool and updates its row; returns false on failure. Shared by
    // the per-row button and the Download-all sweep (which silences the per-tool
    // chime so a 20-tool run isn't 20 fanfares).
    const download = async (id: string, btn: HTMLElement | null, { chime = true } = {}): Promise<boolean> => {
      btn?.classList.add('is-busy');
      try {
        await pinTool(id, prefetch);
        pins = await pinRecords();
        syncRow(id);
        if (btn) { celebrate(btn); }
        if (chime) playSfx('victory');
        return true;
      } catch (err) {
        host.log('warn', 'Offline download failed', { toolId: id, error: String(err) });
        return false;
      } finally {
        btn?.classList.remove('is-busy');
      }
    };

    body.querySelector('.odl-list')?.addEventListener('click', async e => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-odl]');
      if (!btn || btn.classList.contains('is-busy')) return;
      const id = btn.dataset.odl!;
      const name = tools.find(tl => tl.id === id)?.name ?? id;
      if (pins[id]) {
        btn.classList.add('is-busy');
        try {
          await unpinTool(id);
          pins = await pinRecords();
          syncRow(id);
          announce(tRaw('{name} removed from offline', { name }));
        } finally { btn.classList.remove('is-busy'); }
      } else {
        const ok = await download(id, btn);
        announce(ok
          ? tRaw('{name} is available offline', { name })
          : tRaw('Couldn’t save {name} for offline - check your connection', { name }), { assertive: !ok });
      }
      await refreshCounter(); // the Storage meter's pins slice moved
    });

    // Sequential sweep - one spinner walks the list (parallel fetch storms help
    // nobody on the connections this feature exists for). Failures are skipped
    // and reported as a count; the button doubles as the progress line. Shared
    // by the tools-row "Download all" and the section's "Download everything".
    // Re-entrancy is its OWN flag, not allBtn.disabled: the Everything sweep
    // now runs the tools phase while the run holds every control disabled, so
    // reading the button's state here would skip the phase entirely.
    let toolsSweeping = false;
    const sweepTools = async ({ fanfare = true, run = null as OfflineRunHandle | null } = {}): Promise<number> => {
      if (toolsSweeping) return 0;
      toolsSweeping = true;
      allBtn.disabled = true;
      const queue = tools.filter(tl => !pins[tl.id]);
      let failed = 0;
      let n = 0;
      try {
        for (const tl of queue) {
          // Cooperative cancel: the toast's ✕ (or the in-view Cancel) stops the
          // sweep between tools - a tool download is short, so there is nothing
          // finer to interrupt.
          if (run?.cancelled) break;
          allBtn.textContent = t('Downloading {n} of {total}…', { n: ++n, total: queue.length });
          run?.report({ label: t('Tools'), loaded: n, total: queue.length, unit: 'items' });
          const btn = body.querySelector<HTMLElement>(`.odl-pin[data-odl="${CSS.escape(tl.id)}"]`);
          if (!await download(tl.id, btn, { chime: false })) failed++;
        }
      } finally {
        toolsSweeping = false;
        allBtn.disabled = false;
        allBtn.textContent = t('Download all');
      }
      if (fanfare) {
        if (failed === 0) playSfx('victory');
        announce(failed
          ? t('{n} downloads failed - check your connection', { n: failed })
          : t('All tools are available offline'), { assertive: failed > 0 });
      }
      await refreshCounter();
      return failed;
    };
    // The tools-only sweep is a run too: dozens of small fetches still deserve
    // to survive leaving the view, and to be cancellable from the toast.
    allBtn.addEventListener('click', () => { void (async () => {
      if (offlineRunActive()) return;
      const run = beginOfflineRun(t('Downloading tools'));
      if (!run) return;
      try { await sweepTools({ run }); } finally { run.end(); }
    })(); });

    noneBtn.addEventListener('click', async () => {
      const sure = await confirmDialog({
        title: t('Remove all offline downloads?'),
        message: t('Every downloaded tool is removed from this device. Each re-downloads on demand when you next open it online.'),
        confirmLabel: t('Remove all'),
        danger: true,
      });
      if (!sure) return;
      await unpinAll();
      pins = {};
      body.querySelectorAll<HTMLElement>('.odl-row').forEach(r => syncRow(r.dataset.tool!));
      announce(t('Offline downloads removed'));
      await refreshCounter();
    });

    // Live search - plain substring over the display name.
    const search = body.querySelector<HTMLInputElement>('.odl-search')!;
    const emptyEl = body.querySelector<HTMLElement>('.odl-empty')!;
    search.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      let shown = 0;
      body.querySelectorAll<HTMLElement>('.odl-row').forEach(row => {
        const hit = !q || (row.dataset.name ?? '').includes(q);
        row.hidden = !hit;
        if (hit) shown++;
      });
      emptyEl.hidden = shown > 0;
    });

    // ── The parts rows: app / catalogue / docs / verify ─────────────────────
    let partState: PartState = parts;
    // Re-entrancy WITHIN this view is decided on this flag, set SYNCHRONOUSLY at
    // runParts entry - the run is only registered after two awaits (headroom
    // estimate + confirm dialog), which is exactly the window a double-click
    // exploits. Across views (a remount mid-run) the module-level
    // offlineRunActive() is the guard, since this flag is fresh per mount.
    let running = false;
    // The catalogue row's recorded scope no longer matches the checked chips - 
    // display state only; the record itself is untouched until a download runs.
    let catalogScopeDirty = false;
    const everythingBtn = body.querySelector<HTMLButtonElement>('#odl-everything')!;
    const cancelBtn = body.querySelector<HTMLButtonElement>('#odl-cancel')!;
    const sweepSizeEl = body.querySelector<HTMLElement>('#odl-sweep-size')!;
    const progWrap = body.querySelector<HTMLElement>('#odl-progress')!;
    const progTrack = progWrap.querySelector<HTMLElement>('.odl-progress-track')!;
    const progFill = progWrap.querySelector<HTMLElement>('.odl-progress-fill')!;
    const progText = progWrap.querySelector<HTMLElement>('.odl-progress-text')!;

    // The current catalogue scope: the checked tag chips, or the whole catalogue.
    const catalogScope = (): 'all' | string[] => {
      const picked = [...body.querySelectorAll<HTMLInputElement>('.odl-tagchip input:checked')].map(c => c.value);
      return picked.length ? picked : 'all';
    };
    let catalogPlanned = plannedBytes.catalog;

    // A part is downloadable when its manifest (or index) was reachable. The
    // dev server ships no dist/precache.json - the rows say so instead of
    // pretending a download happened.
    const partAvailable: Record<OfflinePartId, boolean> = {
      app: !!precache, docs: !!infoManifest, verify: !!precache && plannedBytes.verify > 0, catalog: !!catSummary,
      speech: !!precache && plannedBytes.speech > 0,
      upscale: !!precache && plannedBytes.upscale > 0,
      matte: !!precache && plannedBytes.matte > 0,
      ocr: !!precache && plannedBytes.ocr > 0,
      reword: !!precache && plannedBytes.reword > 0,
      ask: !!precache && plannedBytes.ask > 0,
      'ai-detect': !!precache && plannedBytes['ai-detect'] > 0,
      durable: !!precache && plannedBytes.durable > 0,
    };
    const isStale = (id: OfflinePartId): boolean => {
      const rec = partState[id];
      if (!rec) return false;
      if (id === 'catalog') return catalogScopeDirty;
      const live = liveVersion(id);
      return (live !== null && rec.version !== live) || (id === 'docs' && rec.lang !== currentLang());
    };
    /** What this part would still download: full size when absent, a token
     *  slice when downloaded-but-stale (delta re-syncs skip current files), and
     *  zero when current - so preflights and the sweep price REMAINING work,
     *  not work already on disk. */
    const planned = (id: OfflinePartId): number => {
      const full = id === 'catalog' ? catalogPlanned : plannedBytes[id];
      if (!partState[id]) return full;
      return isStale(id) ? Math.round(full / 8) : 0;
    };

    const syncPartRow = (id: OfflinePartId): void => {
      const row = body.querySelector<HTMLElement>(`.odl-part[data-part="${id}"]`);
      if (!row) return;
      const sub = row.querySelector<HTMLElement>(`[data-part-sub="${id}"]`)!;
      const dl = row.querySelector<HTMLButtonElement>(`[data-part-dl="${id}"]`)!;
      const rm = row.querySelector<HTMLButtonElement>(`[data-part-rm="${id}"]`)!;
      const rec = partState[id];
      if (!partAvailable[id]) {
        sub.textContent = t('Not offered by this server');
        dl.hidden = true;
        rm.hidden = true;
        return;
      }
      if (rec) {
        const stale = isStale(id);
        sub.textContent = stale
          ? (id === 'catalog' ? t('Selection changed · download to update') : t('Downloaded · update available'))
          : t('Downloaded · {size} on disk', { size: fmtBytes(rec.bytes) });
        dl.textContent = stale ? t('Update') : t('Downloaded');
        dl.disabled = !stale;
        dl.hidden = false;
        rm.hidden = false;
      } else {
        sub.textContent = fmtBytes(planned(id));
        dl.textContent = t('Download');
        dl.disabled = false;
        dl.hidden = false;
        rm.hidden = true;
      }
    };

    // The heavyweight on-device AI models. Kept OUT of the plain "Download everything"
    // sweep (hiding a multi-GB download inside one button misleads) - but the opt-in
    // checkbox below folds them in, with their combined size stated up front so it stays
    // honest. availableModelParts() filters to what THIS server actually offers.
    const MODEL_PARTS = ['speech', 'upscale', 'matte', 'ocr', 'reword', 'ask', 'ai-detect', 'verify', 'durable'] as const;
    const inclModels = (): boolean => !!body.querySelector<HTMLInputElement>('#odl-incl-models')?.checked;
    const availableModelParts = (): OfflinePartId[] => MODEL_PARTS.filter(id => partAvailable[id]);
    const modelsRow = body.querySelector<HTMLElement>('#odl-models-row');
    const modelsSizeEl = body.querySelector<HTMLElement>('#odl-models-size');
    const syncSweepSize = (): void => {
      // "Everything" = app + catalogue scope + docs + every tool; the models fold in only when
      // the "Include all the AI models" box is ticked. planned() prices only REMAINING work,
      // so downloaded-and-current parts cost 0.
      const base = ['app', 'catalog', 'docs'] as const;
      const ids: readonly OfflinePartId[] = inclModels() ? [...base, ...availableModelParts()] : base;
      const remaining = ids.filter(id => partAvailable[id]).reduce((n, id) => n + planned(id), 0);
      sweepSizeEl.textContent = remaining ? t('about {size}', { size: fmtBytes(remaining) }) : '';
      // The opt-in row: shown only when this server offers models, labelled with their combined
      // remaining size so ticking it is never a surprise.
      const modelIds = availableModelParts();
      if (modelsRow) modelsRow.hidden = modelIds.length === 0;
      if (modelsSizeEl) {
        const modelsRemaining = modelIds.reduce((n, id) => n + planned(id), 0);
        modelsSizeEl.textContent = modelsRemaining ? t('about {size}', { size: fmtBytes(modelsRemaining) })
          : modelIds.length ? t('all saved') : '';
      }
      for (const id of ['app', 'docs', 'speech', 'upscale', 'matte', 'ocr', 'reword', 'ask', 'ai-detect', 'verify', 'durable', 'catalog'] as const) syncPartRow(id);
      // A live run owns row enablement: syncPartRow reads storage state, so it
      // would re-enable rows the run just froze. This fires from async
      // re-pricing (tag chips, the recorded-scope restore) too, which is
      // exactly when a view mounted mid-run would flicker back to idle.
      if (offlineRunActive()) setBusy(true);
    };

    const setBusy = (busy: boolean): void => {
      everythingBtn.disabled = busy;
      allBtn.disabled = busy;
      cancelBtn.hidden = !busy;
      body.querySelectorAll<HTMLButtonElement>('[data-part-dl],[data-part-rm]').forEach(b => { b.disabled = busy; });
      // The scope a run downloads is captured at start - freezing the chips
      // keeps the UI from implying a mid-run change would apply to it.
      body.querySelectorAll<HTMLInputElement>('.odl-tagchip input').forEach(c => { c.disabled = busy; });
      progWrap.hidden = !busy;
      if (!busy) syncSweepSize(); // restore per-row enablement from state
    };

    // Paints ONE line of the run onto this view's bar. It is fed by the run's
    // fan-out (subscribeOfflineRun below), not by the download loop directly -
    // so the bar keeps painting in whichever /profile is currently mounted,
    // including one mounted after the run started somewhere else.
    const showProgress = (line: OfflineRunLine): void => {
      const label = line.label;
      const num = (n: number): string => line.unit === 'items' ? String(n) : fmtBytes(n);
      const pct = line.total ? Math.min(100, Math.round((line.loaded / line.total) * 100)) : null;
      progTrack.classList.toggle('is-indeterminate', pct === null);
      if (pct === null) {
        progTrack.removeAttribute('aria-valuenow');
        progFill.style.width = '100%';
        progText.textContent = tRaw('{label} - {loaded} so far…', { label, loaded: num(line.loaded) });
      } else {
        progTrack.setAttribute('aria-valuenow', String(pct));
        progFill.style.width = `${pct}%`;
        progText.textContent = tRaw('{label} - {loaded} of {total}', { label, loaded: num(line.loaded), total: num(line.total ?? 0) });
      }
    };

    // The erased cast sync's other callers use - the concrete web host
    // satisfies the structural SyncHost slice at runtime.
    const syncHost = host as unknown as Parameters<typeof downloadCatalogScope>[0];
    const partLabel = (id: OfflinePartId): string => partDefs.find(p => p.id === id)?.name ?? id;

    /** Run one part's download; true on success. The caller owns busy state
     *  and passes the catalogue scope it CAPTURED at run start - re-reading
     *  the live checkboxes here would let a mid-run change alter what a
     *  started download means. Progress goes to the RUN (job + every mounted
     *  view), never straight to this view's bar. */
    const runPart = async (id: OfflinePartId, run: OfflineRunHandle, scope: 'all' | string[]): Promise<boolean> => {
      const signal = run.signal;
      const onProgress = (p: DownloadProgress) => run.report({ label: partLabel(id), loaded: p.loaded, total: p.total, unit: 'bytes' });
      try {
        if (id === 'app' && precache) await downloadApp(precache, { signal, onProgress });
        else if (id === 'docs' && infoManifest) await downloadDocs(infoManifest, { signal, onProgress });
        else if (id === 'verify' && precache) await downloadVerify(precache, { signal, onProgress });
        else if (id === 'speech' && precache) await downloadSpeech(precache, { signal, onProgress });
        else if (id === 'reword' && precache) await downloadReword(precache, { signal, onProgress });
        else if (id === 'ask' && precache) await downloadAsk(precache, { signal, onProgress });
        else if (id === 'ai-detect' && precache) await downloadAiDetect(precache, { signal, onProgress });
        else if (id === 'upscale') await downloadUpscale({ signal, onProgress });
        else if (id === 'matte') await downloadMatte({ signal, onProgress });
        else if (id === 'ocr') await downloadOcr({ signal, onProgress });
        else if (id === 'durable') await downloadDurable({ signal, onProgress });
        else if (id === 'catalog') {
          const res = await downloadCatalogScope(syncHost, scope, { signal, onProgress });
          await recordCatalogDownload(scope, res.bytes, res.files);
          catalogScopeDirty = false;
        } else return false;
        partState = await partRecords();
        syncPartRow(id);
        await refreshCounter();
        return true;
      } catch (err) {
        if (signal.aborted) throw err;
        host.log('warn', 'Offline part download failed', { part: id, error: String(err) });
        return false;
      }
    };

    /** Preflight + sequential run of several parts behind one progress bar.
     *  Resolves true only when the run actually completed (with or without
     *  per-part failures) - false on re-entry, decline, or cancel, so a caller
     *  chaining more work (the Everything sweep) knows not to continue.
     *
     *  `outer` lets the Everything sweep run its parts phase and its tools
     *  phase inside ONE job: when it is passed, this function neither starts
     *  nor ends the run, and leaves the completion announcement to the caller. */
    const runParts = async (ids: OfflinePartId[], outer?: OfflineRunHandle): Promise<boolean> => {
      if (running || (!outer && offlineRunActive())) return false;
      running = true;   // synchronous - closes the double-click window the two awaits below open
      try {
        const want = ids.filter(id => partAvailable[id] && (!partState[id] || isStale(id)));
        if (!want.length) return true; // nothing to do IS a completed run
        const scope = catalogScope();
        const totalPlanned = want.reduce((n, id) => n + planned(id), 0);
        const room = await storageHeadroom(totalPlanned);
        if (!room.fits) {
          const sure = await confirmDialog({
            title: t('This might not fit'),
            message: room.free === null
              ? t('The browser could not say how much space is free. Download anyway?')
              : t('About {size} to download, but only around {free} of storage looks free. You can narrow the catalogue by tag, or try anyway.', { size: fmtBytes(totalPlanned), free: fmtBytes(room.free) }),
            confirmLabel: t('Download anyway'),
          });
          if (!sure) return false;
        }
        // One part gets that part's name in the toast; several share the section's.
        const run = outer ?? beginOfflineRun(want.length === 1
          ? tRaw('Downloading {name}', { name: partLabel(want[0]!) })
          : t('Downloading for offline'));
        if (!run) return false;   // another view's run is already in flight
        setBusy(true);
        let failed = 0;
        let cancelled = false;
        try {
          for (const id of want) {
            if (!await runPart(id, run, scope)) failed++;
          }
        } catch {
          cancelled = true;
        } finally {
          // The run ends here, not at view teardown. end() settles the job the
          // toast is showing and releases the module-level slot; a cancelled
          // job is already terminal, so this is a no-op for it.
          if (!outer) run.end(failed ? t('{n} downloads failed - check your connection', { n: failed }) : undefined);
          setBusy(false);
        }
        if (cancelled) {
          // Cancelled - everything already fetched stays cached, so the next
          // run resumes from here. Say so instead of reading as an error.
          announce(t('Download paused - already-saved files are kept'));
          return false;
        }
        if (failed === 0) playSfx('victory');
        if (!outer) {
          announce(failed
            ? t('{n} downloads failed - check your connection', { n: failed })
            : want.length === 1
              ? tRaw('{name} is available offline', { name: partLabel(want[0]!) })
              : t('Offline download complete'), { assertive: failed > 0 });
        }
        // Downloads may deserve eviction protection now that they hold real bytes.
        await syncPersistLine();
        return failed === 0;
      } finally {
        running = false;
      }
    };

    body.querySelector('.odl-parts')?.addEventListener('click', async e => {
      const dl = (e.target as HTMLElement).closest<HTMLElement>('[data-part-dl]');
      if (dl) { await runParts([dl.dataset.partDl as OfflinePartId]); return; }
      const rm = (e.target as HTMLElement).closest<HTMLElement>('[data-part-rm]');
      // offlineRunActive() covers a run started by an earlier mount of this view.
      if (!rm || running || offlineRunActive()) return;
      const id = rm.dataset.partRm as OfflinePartId;
      const sure = await confirmDialog({
        title: t('Remove this offline download?'),
        message: tRaw('{name} is removed from this device. You can download it again any time you are online.', { name: partLabel(id) }),
        confirmLabel: t('Remove'),
        danger: true,
      });
      if (!sure) return;
      await removePart(id);
      partState = await partRecords();
      syncPartRow(id);
      syncSweepSize();
      announce(t('Offline download removed'));
      await refreshCounter();
    });

    // Tag chips re-price the catalogue row live (asset-accurate, not tag sums).
    // Scope drift is tracked on a FLAG, never by deleting the record from the
    // display state - any partRecords() refresh would silently resurrect a
    // deleted entry and the row would lie about being current.
    const normScope = (s: 'all' | string[] | readonly string[] | undefined): string => JSON.stringify(s === undefined ? 'all' : Array.isArray(s) ? [...s].sort() : s);
    body.querySelector('.odl-tagscope')?.addEventListener('change', async () => {
      const scope = catalogScope();
      const size = await catalogScopeSize(scope);
      if (size) catalogPlanned = size.bytes;
      catalogScopeDirty = !!partState.catalog && normScope(partState.catalog.tags) !== normScope(scope);
      syncSweepSize();
    });

    // Re-price the sweep when the models opt-in flips (also toggles the button label so the
    // action reads honestly - "everything" only means the models when the box is ticked).
    body.querySelector<HTMLInputElement>('#odl-incl-models')?.addEventListener('change', () => {
      everythingBtn.textContent = inclModels() ? t('Download everything, models included') : t('Download everything');
      syncSweepSize();
    });

    everythingBtn.addEventListener('click', async () => {
      if (running || offlineRunActive()) return;
      // Held disabled across BOTH phases - parts and the tools sweep - so a
      // second click can't slip in during the sweep and re-announce success.
      everythingBtn.disabled = true;
      // ONE job covers both phases, so the toast tells a single story and the
      // whole thing stays cancellable from anywhere in the app.
      const run = beginOfflineRun(t('Downloading everything for offline'));
      if (!run) { everythingBtn.disabled = false; return; }
      try {
        // The models fold into the sweep only when the opt-in box is ticked (their size is
        // stated on that row). A declined headroom warning or a mid-run Cancel resolves false:
        // the tools sweep must NOT start after the user said stop.
        const sweepIds: OfflinePartId[] = ['app', 'catalog', 'docs', ...(inclModels() ? availableModelParts() : [])];
        if (!await runParts(sweepIds, run)) return;
        setBusy(true);   // the parts phase released it; the tools phase owns it now
        const failed = await sweepTools({ fanfare: false, run });
        announce(failed
          ? t('{n} downloads failed - check your connection', { n: failed })
          : run.cancelled
            ? t('Download paused - already-saved files are kept')
            : t('Everything you picked is saved for offline'), { assertive: failed > 0 });
      } finally {
        run.end();
        setBusy(false);
        everythingBtn.disabled = false;
        syncSweepSize();
      }
    });
    // Cancel routes through the job registry (not a bare controller.abort) so the
    // toast, the registry and the fetches all agree the run stopped.
    cancelBtn.addEventListener('click', () => cancelOfflineRun());

    // Eviction protection: say where downloads stand, and offer the fix - a
    // re-request from a click is exactly when browsers grant it.
    const persistEl = body.querySelector<HTMLElement>('#odl-persist')!;
    const syncPersistLine = async (state?: 'granted' | 'denied' | 'unsupported'): Promise<void> => {
      const s = state ?? await persistenceState();
      if (s === 'unsupported') { persistEl.hidden = true; return; }
      persistEl.hidden = false;
      persistEl.innerHTML = s === 'granted'
        ? escape(t('Protected: the browser won’t clear these downloads to free up space.'))
        : `${escape(t('The browser may clear downloads if the device runs low on space.'))} <button type="button" class="btn" id="odl-protect">${t('Protect downloads')}</button>`;
      persistEl.querySelector('#odl-protect')?.addEventListener('click', async () => {
        const granted = await persistenceState(true);
        await syncPersistLine(granted);
        announce(granted === 'granted' ? t('Downloads protected') : t('The browser declined - downloads stay best-effort'));
      });
    };
    void syncPersistLine(persist);
    // Restore the recorded catalogue scope into the chips, so the row reads
    // consistently on re-open (unchecked chips = 'all', which would otherwise
    // disagree with a tag-scoped record and misprice the sweep).
    const recordedTags = partState.catalog?.tags;
    if (Array.isArray(recordedTags) && recordedTags.length) {
      for (const c of body.querySelectorAll<HTMLInputElement>('.odl-tagchip input')) {
        c.checked = recordedTags.includes(c.value);
      }
      void catalogScopeSize(recordedTags).then(size => {
        if (size) { catalogPlanned = size.bytes; syncSweepSize(); }
      });
    }
    syncSweepSize();

    // ── The run outlives this view (lib/offline-run.ts) ─────────────────────
    // The bar is driven by the run's fan-out, so it keeps painting for as long
    // as THIS view lives and picks up a run that started in a previous mount.
    // Fires on change only (the lib/jobs.ts subscribe contract), so the current
    // line is read once below. _cleanup unsubscribes; it never aborts.
    offlineRunUnsub = subscribeOfflineRun({
      onProgress: line => showProgress(line),
      onEnd: () => { void (async () => {
        // The run may have finished parts this view never watched start.
        partState = await partRecords().catch(() => partState);
        setBusy(false);
        await refreshCounter();
      })(); },
    });
    // Re-entering /profile mid-run: read as busy rather than offer a second
    // sweep over the same buckets. Must come after the syncSweepSize() above,
    // which restores per-row enablement from storage state.
    if (offlineRunActive()) {
      setBusy(true);
      const line = offlineRunLine();
      if (line) showProgress(line);
    }
  }
  offlineDetails?.addEventListener('toggle', () => { if (offlineDetails!.open) loadOffline(); });
  if (offlineDetails?.open) loadOffline();

  // App updates (plans/202 WP4.1) - the three-button state machine in the "Lolly
  // instance" card. Its whole implementation is views/profile-updates.ts.
  wireUpdatesRow(viewEl, shellUpdater, params);

  // Hot folder (plans/174 #9) - desktop shells only; the boot module owns the
  // key and the invoke, this block is pure form wiring.
  if (isTauriShell()) {
    void import('../lib/linux-desktop-boot.ts').then((hf) => {
      const pathEl = viewEl.querySelector<HTMLInputElement>('#hotfolder-path');
      const onBtn = viewEl.querySelector<HTMLButtonElement>('#hotfolder-enable');
      const offBtn = viewEl.querySelector<HTMLButtonElement>('#hotfolder-disable');
      const errEl = viewEl.querySelector<HTMLElement>('#hotfolder-err');
      const summary = viewEl.querySelector<HTMLElement>('[data-summary="hotfolder-section"]');
      if (!pathEl || !onBtn || !offBtn) return;
      const paint = (active: string | null): void => {
        if (active) pathEl.value = active;
        onBtn.hidden = !!active;
        offBtn.hidden = !active;
        if (summary) summary.textContent = active ? t('watching') : '';
      };
      paint(hf.hotFolderPath());
      const showErr = (m: string): void => { if (errEl) { errEl.textContent = m; errEl.hidden = !m; } };
      onBtn.addEventListener('click', () => {
        showErr('');
        const path = pathEl.value.trim();
        if (!path) { showErr(t('Enter a folder path first')); return; }
        hf.setHotFolder(path).then(() => paint(path)).catch((e: Error) => showErr(e.message));
      });
      offBtn.addEventListener('click', () => {
        showErr('');
        hf.setHotFolder(null).then(() => paint(null)).catch((e: Error) => showErr(e.message));
      });
    });
  }

  // Connected services (plans/129) - same lazy-mount idiom; the module owns
  // its own re-rendering after connect/disconnect/save.
  const connectionsDetails = viewEl.querySelector<HTMLDetailsElement>('#connections-section');
  let connectionsLoaded = false;
  const loadConnections = async (): Promise<void> => {
    if (connectionsLoaded) return;
    connectionsLoaded = true;
    const body = viewEl.querySelector<HTMLElement>('#connections-body');
    if (!body) return;
    const { mountConnectionsBody } = await import('./profile-connections.ts');
    await mountConnectionsBody(body, host as Parameters<typeof mountConnectionsBody>[1],
      text => setSummary('connections-section', text));
  };
  // Sync across devices (plans/138 B1) - the sub-block inside the same card, so it
  // rides the same open: one toggle, two bodies. The module owns its own
  // re-rendering after each change.
  let syncLoaded = false;
  const loadSync = async (): Promise<void> => {
    if (syncLoaded) return;
    syncLoaded = true;
    const body = viewEl.querySelector<HTMLElement>('#sync-body');
    if (!body) return;
    const { mountSyncBody } = await import('./profile-sync.ts');
    await mountSyncBody(body, host as unknown as Parameters<typeof mountSyncBody>[1]);
  };
  const loadConnectionsCard = (): void => { void loadConnections(); void loadSync(); };
  connectionsDetails?.addEventListener('toggle', () => { if (connectionsDetails!.open) loadConnectionsCard(); });
  if (connectionsDetails?.open) loadConnectionsCard();

  // ── Content Credentials: lazy, like Storage. The identity bridge (host.identity)
  // holds the device keypair + CA-issued cert; this section only ever shows either
  // a status card ("Signing as …") or the provider buttons + email magic-link form.
  // Everything repaints via body.innerHTML, so the click/submit handlers are
  // delegated once and survive every repaint. ────────────────────────────────────
  const identityDetails = viewEl.querySelector<HTMLDetailsElement>('#identity-section');
  const identityBody = () => viewEl.querySelector<HTMLElement>('#identity-body');
  const PROVIDER_LABELS: Record<string, string> = { suse: 'SUSE (id.suse.com)', github: 'GitHub', google: 'Google', dev: 'Dev', email: 'Email link' };
  let identityStatus: IdentityStatus | null = null;
  // The zero-secret Dev provider is offered only when the CA reports dev mode
  // (health contract: { ok: true, devProvider: boolean }). Memoised per mount.
  let caHealthP: Promise<CaHealth | null> | null = null;
  const caHealth = (): Promise<CaHealth | null> => (caHealthP ??= fetch('/api/ca/health').then(r => r.json()).catch(() => null));

  // Inline + announced, matching the headshot/import error pattern.
  function showIdentityError(msg: string) {
    const el = identityBody()?.querySelector<HTMLElement>('.identity-error');
    if (el) { el.textContent = msg; el.hidden = !msg; }
    if (msg) announce(msg, { assertive: true });
  }

  function renderEnrollForm(health: CaHealth | null) {
    // Show only the providers the deployment has actually configured (from
    // /api/ca/health.configured), so a button never 501s on click - and a newly
    // configured provider appears with no code change. 'dev' rides on devProvider.
    const cfg = health?.configured ?? {};
    const providers: string[] = [
      ...(cfg.github ? ['github'] : []),
      ...(cfg.google ? ['google'] : []),
      ...(cfg.suse ? ['suse'] : []),
      ...(health?.devProvider === true ? ['dev'] : []),
    ];
    // Nothing to enrol WITH on this deployment: the pitch, the permanence warning
    // and the certificate-lifetime picker would all be controls that lead nowhere,
    // teaching the jargon for a door that isn't there (plans/163 4.5). One status
    // line stands in for the lot. Verifying a file needs no enrolment, so that
    // link stays exactly where it was.
    if (!providers.length) {
      return `
      <p class="storage-hint-text">${t('No sign-in provider is configured on this deployment yet.')}</p>
      ${verifyLink()}
      <p class="identity-error" role="alert" hidden></p>`;
    }
    return `
      <p class="identity-blurb">${t('Sign exports with a verified identity - a short-lived certificate ties your email to files you export; the key never leaves this device.')} <a href="${docsAppHref('trust/content-credentials-identity')}" target="_blank" rel="noopener">${t('How it works')}</a></p>
      <p class="identity-blurb identity-permanence">${t('Know before you enrol: your email address is written into every file you export while enrolled. It stays in every copy you share and cannot be removed later, even after the certificate expires.')}</p>
      <label class="identity-days-row">${t('Verified for')}
        <select class="identity-days-select" aria-label="${escape(t('Certificate lifetime'))}">
          <option value="7">${t('7 days')}</option>
          <option value="30" selected>${t('30 days')}</option>
          <option value="90">${t('90 days')}</option>
          <option value="365">${t('365 days')}</option>
        </select>
        <span class="identity-days-hint">${t('- longer keeps exports verified longer; shorter limits misuse if this device is lost. The CA has the final say.')}</span>
      </label>
      <div class="identity-providers">
        ${providers.map(p => `<button type="button" class="btn" data-identity-provider="${p}">${escape(PROVIDER_LABELS[p] ?? p)}</button>`).join('')}
      </div>
      ${verifyLink()}
      <p class="identity-error" role="alert" hidden></p>`;
  }

  function renderIdentityStatus(s: IdentityStatus) {
    const provider = PROVIDER_LABELS[s.identity?.provider as string] ?? s.identity?.provider ?? '';
    const when = s.notAfter ? new Date(s.notAfter).toLocaleDateString() : '';
    const life = s.expired ? (when ? tRaw('expired {date}', { date: when }) : t('expired')) : (when ? tRaw('renews {date}', { date: when }) : '');
    return `
      <div class="identity-status${s.expired ? ' is-expired' : ''}">
        <p class="identity-signing">${t('Signing as <strong>{email}</strong>', { email: s.identity?.email ?? '' })}${provider ? ` <span class="identity-via">${t('via {provider}', { provider })}</span>` : ''}</p>
        ${life ? `<p class="identity-life">${escape(life)}</p>` : ''}
        <div class="identity-actions">
          <button type="button" class="btn" data-identity-act="renew">${t('Renew')}</button>
          <button type="button" class="btn" data-identity-act="forget">${t('Forget this device')}</button>
        </div>
        ${verifyLink()}
        <p class="identity-error" role="alert" hidden></p>
      </div>`;
  }

  async function paintIdentity() {
    const body = identityBody();
    if (!body) return;
    if (!host.identity) { // bridge feature-detected, like host.previews
      body.innerHTML = `<p class="storage-hint-text">${t("Signing identity isn't available in this build.")}</p>`;
      return;
    }
    try { identityStatus = await host.identity.status(); }
    catch (err) {
      body.innerHTML = `<p class="identity-error" role="alert">${escape(String((err as { message?: unknown })?.message ?? err))}</p>`;
      return;
    }
    body.innerHTML = identityStatus?.enrolled
      ? renderIdentityStatus(identityStatus)
      : renderEnrollForm(await caHealth());
    setSummary('identity-section', identityStatus?.enrolled
      ? (identityStatus.identity?.email ?? tRaw('Enrolled'))
      : tRaw('Not enrolled'));
    staggerReveal([...body.children], { sound: false });  // cascade async content (shuffle already played on open)
  }

  // One OAuth/dev enrollment round-trip (popup) from a button, with a busy state.
  // enroll() resolves with the new status, and rejects on timeout/close/denial
  // with a user-presentable Error message. `days` (the 7/30/90/365 lifetime
  // pick) defaults to the form's select when not passed explicitly; the CA
  // clamps it server-side either way.
  async function enrollWith(provider: string, btn: HTMLElement, days?: number) {
    const body = identityBody()!;
    if (!Number.isFinite(days)) days = Number(body.querySelector<HTMLInputElement>('.identity-days-select')?.value);
    showIdentityError('');
    const label = btn.textContent;
    body.querySelectorAll('button').forEach(b => { b.disabled = true; });
    btn.textContent = t('Waiting…');
    try {
      const s = await host.identity!.enroll(provider, { days });
      await paintIdentity();
      announce(tRaw('Enrolled as {who}', { who: s?.identity?.email ?? t('your account') }));
    } catch (err) {
      body.querySelectorAll('button').forEach(b => { b.disabled = false; });
      btn.textContent = label;
      showIdentityError(String((err as { message?: unknown })?.message ?? err));
    }
  }

  // Memoised as a promise (not a boolean) so the magic-link path below can await
  // the same in-flight load instead of racing a second one.
  let identityLoadP: Promise<void> | null = null;
  const loadIdentity = () => (identityLoadP ??= (async () => {
    await paintIdentity();
    const body = identityBody();
    if (!body || !host.identity) return;

    body.addEventListener('click', async (e) => {
      const prov = (e.target as Element).closest<HTMLElement>('[data-identity-provider]');
      if (prov) { await enrollWith(prov.dataset.identityProvider!, prov); return; }
      const act = (e.target as Element).closest<HTMLButtonElement>('[data-identity-act]');
      if (!act) return;
      if (act.dataset.identityAct === 'renew') {
        const provider = identityStatus?.identity?.provider;
        // Renew keeps the lifetime that was chosen last time (derived from the
        // cert window - the status card has no picker; change it via Forget +
        // re-enrol if you want a different duration).
        const prevDays = Math.round((Date.parse(identityStatus?.notAfter as string) - Date.parse(identityStatus?.notBefore as string)) / 86400000);
        // A legacy email (magic-link) identity can no longer renew by email - re-show the
        // enroll form so it re-enrols via a provider instead.
        if (provider === 'email') body.innerHTML = renderEnrollForm(await caHealth());
        else if (provider) await enrollWith(provider, act, [7, 30, 90, 365].includes(prevDays) ? prevDays : undefined);
        return;
      }
      if (act.dataset.identityAct === 'forget') {
        // Low-ceremony confirm: the first click arms the button, a second confirms
        // (it disarms itself after a moment, so a stray click can't linger armed).
        if (act.dataset.confirm !== '1') {
          act.dataset.confirm = '1';
          act.textContent = t('Really forget?');
          act.classList.add('is-confirm');
          setTimeout(() => {
            if (!document.contains(act)) return;
            delete act.dataset.confirm;
            act.textContent = t('Forget this device');
            act.classList.remove('is-confirm');
          }, 4000);
          return;
        }
        act.disabled = true;
        try { await host.identity!.forget(); }
        catch (err) { act.disabled = false; showIdentityError(String((err as { message?: unknown })?.message ?? err)); return; }
        await paintIdentity();
        announce(t('Forgotten - exports on this device sign anonymously again'));
      }
    });

  })());
  identityDetails?.addEventListener('toggle', () => { if (identityDetails!.open) loadIdentity(); });
  if (identityDetails?.open) loadIdentity();

  // The Storage manager opens body-level modals (the shared confirmDialog, plus its own
  // clear/hoard/keep-active/import/lightbox mountModal dialogs - see openProfileModals);
  // tear any down when the router swaps this view out (main.js calls _cleanup) so an
  // orphaned top-layer <dialog> can't block the next view.
  (viewEl as HTMLElement & { _cleanup?: () => void })._cleanup = () => {
    closeConfirmDialogs();
    openProfileModals.forEach(m => m.close());
    openProfileModals.clear();
    openProfileToasts.forEach(el => el.remove());
    openProfileToasts.clear();
    // Detach this view from the offline download run - it is NOT aborted here.
    // A multi-gigabyte sweep used to end the moment the user navigated away,
    // which pinned them to this view for the whole thing; it now runs as a job
    // (lib/offline-run.ts) that the toast owns after teardown. A remount can't
    // start a second concurrent run over the same buckets either:
    // beginOfflineRun() refuses while one is live, and a view mounted mid-run
    // paints its controls busy.
    offlineRunUnsub?.();
    offlineRunUnsub = null;
  };
}


function clearIdbStores(storeNames: string[]) {
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
function showImportDialog(onConfirm: () => Promise<void>) {
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
async function saveHeadshot(host: ProfileHost, blob: Blob, opts: { vector?: boolean } = {}): Promise<AssetRef> {
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
