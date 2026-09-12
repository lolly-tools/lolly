// SPDX-License-Identifier: MPL-2.0
import '../styles/parts/profile.css';   // async CSS chunk (lazy view - not on the landing)
import '../styles/parts/tool.css';      // .help-tip-btn/-pop/-host styles - shared chunk with the
                                        // tool view, same reuse the .tool-inputs sheet already gets
                                        // from multi-edit.ts (component audit rec 13)
import '../styles/parts/storage.css';   // the storage-reconciliation meter lives in /profile
import '../styles/parts/offline-manager.css'; // the "Offline tools" download manager section
import { currentTheme } from '../theme.ts';
import { currentA11yPrefs } from '../lib/a11y-prefs.ts';
import type { A11yPrefs } from '../lib/a11y-prefs.ts';
import { chromeFollowsDesignSystem } from '../lib/chrome-follow.ts';
import { captureNeutralPinned } from '../lib/capture-neutral.ts';
import { icon } from '../lib/icons.ts';
import { getMetrics } from '../metrics.ts';
import { CATEGORY_FLAGS, CONNECTOR_FLAGS, JELLY_FLAG, PERFORMANCE_UI_FLAG, PERF_HUD_FLAG, PREFLIGHT_FLAG, PRIVATE_COLLAB_FLAG, STRIP_UPLOAD_META_FLAG, WOBBLY_FLAG, WOBBLY_MESH_FLAG, isFlagOn } from '../feature-flags.ts';
import { ensureJelly } from '../lib/jelly.ts';
import { getInstanceBase } from '../lib/instance.ts';
import { isTauriShell } from '../lib/instance-choice.ts';
import { orgAdminHref } from '../org/index.ts';
import type { UserFontsHost } from '../user-fonts.ts';
import { updaterGlobal } from './profile-updates.ts';
import type { SessionRowContext } from './profile-storage-model.ts';
import type { ProfileHost } from './profile/shared.ts';
import type { ProfileViewCtx } from './profile/context.ts';
import { rowsOps } from './profile/rows.ts';
import { prefsOps } from './profile/prefs.ts';
import { summariesOps } from './profile/summaries.ts';
import { shellOps } from './profile/shell.ts';
import { chromeOps } from './profile/chrome.ts';
import { headshotOps } from './profile/headshot.ts';
import { storageOps } from './profile/storage.ts';
import { offlineOps } from './profile/offline.ts';
import { connectionsOps } from './profile/connections.ts';
import { identityOps } from './profile/identity.ts';
export { NAV_SECTIONS } from './profile/shared.ts';
export type { ProfileNavSection } from './profile/shared.ts';
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
 *
 * This file is the orchestrator: it reads the state the whole view needs, puts it
 * on one context object (`pv`, typed in profile/context.ts) and calls the feature
 * modules under views/profile/ in page order. Each card's own code lives in the
 * module named for it - rows, prefs, summaries, shell, chrome, headshot, storage,
 * offline, connections, identity - and every one of those takes `pv` first. A
 * source pin on this view has to read the directory too, not just this file.
 */

export async function mountProfile(viewEl: HTMLElement, host: ProfileHost, params: string = ''): Promise<void> {
  const pv = {} as ProfileViewCtx;
  pv.rows = rowsOps(pv);
  pv.prefs = prefsOps(pv);
  pv.summaries = summariesOps(pv);
  pv.shell = shellOps(pv);
  pv.chrome = chromeOps(pv);
  pv.headshot = headshotOps(pv);
  pv.storage = storageOps(pv);
  pv.offline = offlineOps(pv);
  pv.connections = connectionsOps(pv);
  pv.identity = identityOps(pv);
  pv.viewEl = viewEl;
  pv.host = host;
  pv.params = params;
  pv.mountProfile = mountProfile;

  document.title = 'Profile - Lolly';
  // Only the first-paint-critical reads run upfront. The Storage section's heavy
  // work is deferred to loadStorage() (run when the section is first expanded).
  const profile = await host.profile.get(); pv.profile = profile;
  // Jelly effects (flag-gated soft-body switches): decide from the canonical
  // profile, not the sync mirror, and load the lazy bundle before first paint so
  // the flag rows render their final control with no post-mount swap. `jellyOn`
  // and `liveProfile` are mutable - the flag list re-renders in place when the
  // jelly flag itself is toggled (see the change listener below).
  // isFlagOn (not flagEnabled): the Jelly flag is opt-in (built-in default OFF),
  // and only the default-aware read honours that. The capture-neutral pin must be consulted
  // here too: it only rewrites the flag MIRROR, which this canonical-profile
  // read bypasses - without the check, every docs baseline of this view carried
  // jelly controls despite the pin.
  pv.jellyOn = await ensureJelly(isFlagOn(profile, JELLY_FLAG) && !captureNeutralPinned());
  pv.liveProfile = profile;
  const fields = ['firstname', 'lastname', 'email', 'phone', 'city', 'country']; pv.fields = fields;
  // The theme in force right now (applied at boot from the profile; localStorage
  // is only its FOUC mirror) - seeds the Appearance card's active preview.
  const activeTheme = currentTheme(); pv.activeTheme = activeTheme;
  // '' = bundled with this app (the default everywhere but a Tauri shell that
  // connected elsewhere) - see components/instance-sheet.ts + lib/instance.ts.
  const instanceBase = getInstanceBase(); pv.instanceBase = instanceBase;
  // The active design system's label for the card summary (plans/186); '' before
  // the registry answers, which only a shell without one ever is.
  const activeDesignSystemLabel = await (host as unknown as { tokens?: { active?(): Promise<{ label: string } | null> } }).tokens?.active?.().then(a => a?.label ?? '').catch(() => '') ?? ''; pv.activeDesignSystemLabel = activeDesignSystemLabel;
  // Instance-admin affordance - null unless the org session's role is admin/owner
  // (so it never renders on a plain deployment).
  const adminHref = orgAdminHref(); pv.adminHref = adminHref;
  // Changing the instance base is a DESKTOP capability, not a browser one. A
  // remote base makes every catalogue, tool, asset and org request cross-origin,
  // and the shell's Content-Security-Policy allows a fixed host list that cannot
  // contain an origin the user types at runtime - so in a browser those fetches
  // are refused and the feature fails with a console-only error. Tauri routes
  // cross-origin traffic through tauri-plugin-http and serves no CSP, so it works
  // there. Offering a control that cannot work is worse than not offering it, so
  // the browser shows the current source read-only and says where to go instead.
  // Matches lib/instance-choice.ts's own gate on the first-run sheet.
  const canChangeInstance = isTauriShell(); pv.canChangeInstance = canChangeInstance;
  // Does this shell carry a self-updater? Probed, never assumed from isTauriShell
  // (plans/202 principle 5): the desktop shell installs window.__lollyUpdater from
  // bridge-overrides/updater.ts, the mobile shell updates through its app store and
  // installs nothing, and a browser has nothing to update. No global, no row.
  const shellUpdater = updaterGlobal(); pv.shellUpdater = shellUpdater;
  const hasShellUpdater = !!shellUpdater; pv.hasShellUpdater = hasShellUpdater;
  // The headshot is a user asset; re-resolve it (the stored object URL goes stale
  // across reloads).
  const headshotRef = profile.headshot?.id ? await host.assets.get(profile.headshot!.id).catch(() => null) : null;
  pv.headshotUrl = headshotRef?.url || '';
  const rawFocus = new URLSearchParams(params).get('focus');
  // 'sync-section' is kept as an alias: Sync across devices moved inside Connected
  // services, and links written before that (share links, docs, the sync-service
  // passphrase nudge, screenshot recipes) still name it.
  const focusParam = rawFocus === 'sync-section' ? 'connections-section' : rawFocus; pv.focusParam = focusParam;
  const focusFlags = focusParam === 'feature-flags'; pv.focusFlags = focusFlags;
  const focusUseDetails = focusParam === 'use-details'; pv.focusUseDetails = focusUseDetails;
  // Which SECTION a ?focus= param must leave expanded. Every card is a collapsible
  // now and they all start closed, so a deep link that arrives at a folded card
  // delivers nothing - the two legacy aliases name the section they live in (the
  // use-details checkbox sits inside the details card), anything else is already a
  // section id.
  const focusSectionId = focusFlags ? 'feature-flags-section'
    : focusUseDetails ? 'details-section'
    : focusParam; pv.focusSectionId = focusSectionId;
  // Remember which sections were left open, across visits (a UI preference, so it
  // lives in localStorage like the theme - read synchronously before render). No
  // entry ⇒ CLOSED: every card starts folded, and the nav rail (or a stored open
  // state, or a ?focus= target) is what opens one.
  const OPEN_KEY = 'lolly-profile-open'; pv.OPEN_KEY = OPEN_KEY;
  pv.openState = {};
  try { pv.openState = JSON.parse(localStorage.getItem(OPEN_KEY) || '{}') || {}; } catch { /* storage blocked */ }

  // Every flag the list below renders, for the card's folded summary to count the
  // switched-off ones. The standalone eight are spelled out rather than mapped
  // because the list's own rows are hand-written (dividers and a group heading sit
  // between them) and two feature tests pin those call sites by name - keep the two
  // in step when a flag joins or leaves the list.
  // Jelly effects render on a canvas the native shells' WebView grows without
  // bound (lib/jelly.ts gates it off there), so the toggle would promise a look
  // it cannot deliver - hide the whole row on any non-web shell. The web PWA
  // keeps it.
  const jellyHidden = isTauriShell(); pv.jellyHidden = jellyHidden;
  const LISTED_FLAGS = [
    ...CATEGORY_FLAGS,
    ...(jellyHidden ? [] : [JELLY_FLAG]),
    WOBBLY_FLAG, WOBBLY_MESH_FLAG, PERFORMANCE_UI_FLAG, PERF_HUD_FLAG, STRIP_UPLOAD_META_FLAG, PREFLIGHT_FLAG, PRIVATE_COLLAB_FLAG,
    ...CONNECTOR_FLAGS,
  ]; pv.LISTED_FLAGS = LISTED_FLAGS;

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
  const a11yState: A11yPrefs = currentA11yPrefs(); pv.a11yState = a11yState;
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
  ]; pv.A11Y_ROWS = A11Y_ROWS;

  // ── Appearance: does the app follow the design system? (plans/182 SS5.6) ─────
  // The app taking its accent from the design system's primary is the APP's use
  // of the palette, and a palette is for tools and exports first - so it is a
  // preference in this card, beside the theme, rather than a token in the studio.
  // Initial state is what is in FORCE (the device mirror lib/chrome-follow.ts
  // reads), not profile.appearance, for the reason a11yState reads the applied
  // attributes: a switch that disagrees with the page you are looking at is the
  // worse lie.
  pv.followDsState = chromeFollowsDesignSystem();
  // Mutable so a Jelly-flag re-render keeps this toggle in step with the live
  // choice (same pattern as a11yState above).
  pv.renderSaveState = profile.saveRenders !== false;

  // Every card folds now, including Your details - so the identity moves into that
  // card's summary line, or a fully collapsed page would be a wall of anonymous
  // headings. Name if there is one, email as the fallback, nothing at all on a fresh
  // profile (the heading alone is honest when there is no-one to name yet).
  const displayName = [profile.firstname, profile.lastname].filter(Boolean).join(' ').trim() || (profile.email ?? '').trim(); pv.displayName = displayName;

  // ── Folded-card summaries (plans/163 section 4.1) ────────────────────────────
  // Each one is a couple of words, read from the same state the section's own
  // body renders from - never a second source of truth. The three below are known
  // at first paint; the lazy sections leave theirs empty and call setSummary().
  const metrics = getMetrics(); pv.metrics = metrics;

  pv.shell.renderShell();

  pv.shell.wireNav();

  pv.rows.wireFlagRows();

  pv.prefs.wireA11yRows();

  pv.prefs.wireAppearanceRows();

  pv.prefs.wireRenderSaveRows();

  pv.shell.wireFocusTarget();

  pv.prefs.wireThemePick();

  pv.chrome.wireInstanceCard();

  pv.chrome.wireChrome();

  pv.headshot.wireDetailsOptIn();

  // Headshot - upload → circular crop → save as a user asset → store the ref.
  const headshotFileInput = viewEl.querySelector<HTMLInputElement>('#headshot-file'); pv.headshotFileInput = headshotFileInput;

  pv.headshot.wireHeadshot();

  // Live storage refresh - re-render the Storage meter IF it's loaded. The headshot
  // upload/remove paths change user-asset bytes and call this; it no-ops while the
  // Storage section is still collapsed (loadStorage sets refreshStorageMeter).
  pv.refreshStorageMeter = null;

  pv.headshot.wireDetailsForm();

  pv.rows.wireOpenState();

  const fontsHost = host as unknown as UserFontsHost; pv.fontsHost = fontsHost;

  // ── Storage: lazy. Fetch the data + render the (heavy) image grid only when the
  // section is first expanded, then wire its handlers. ──────────────────────────
  const storageDetails = viewEl.querySelector<HTMLDetailsElement>('#storage-section'); pv.storageDetails = storageDetails;
  pv.storageLoaded = false;
  // Tool display names + a glyph for sessions saved without a thumbnail.
  const toolNameById = new Map((window.__toolIndex?.tools ?? []).map(t => [t.id, t.name] as [string, string])); pv.toolNameById = toolNameById;
  // 'image' glyph - deduped against catalog-summary.ts's "raster" and valid.ts's
  // ICONS.image (near-identical circle-radius/path-endpoint roundings of the same
  // Lucide "image" icon; component-audit rec 5).
  const SESS_PLACEHOLDER_ICON = icon('image', { strokeWidth: 1.8 });
  // What profile-storage-model.ts's row renderers read out of this mount.
  const sessRowCtx: SessionRowContext = { toolNameOf: pv.storage.toolNameOf, placeholderIcon: SESS_PLACEHOLDER_ICON }; pv.sessRowCtx = sessRowCtx;

  pv.storage.wireStorageToggle();

  // ── Offline tools: lazy, like Storage. A download manager over every tool the
  // shell can run: search, a per-tool download → progress → tick button (the same
  // three-layer state machine as the gallery cards' keep-offline toggle, styled
  // by offline-manager.css), the measured on-disk size beside each downloaded
  // tool, and a Download-all sweep. Sizes are the tool FILES recorded at pin
  // time (PinRecord.bytes) - manifest-declared catalog assets are prefetched too
  // but counted by the Storage section's Asset-cache slice, never double here. ──
  const offlineDetails = viewEl.querySelector<HTMLDetailsElement>('#offline-section'); pv.offlineDetails = offlineDetails;
  pv.offlineLoaded = false;
  // Set by loadOffline's wiring; called from _cleanup to DETACH this view from
  // the run, never to stop it. The run itself lives in lib/offline-run.ts (a
  // WP-F job), so leaving /profile mid-sweep keeps the download going with the
  // global job toast owning its progress and its Cancel.
  pv.offlineRunUnsub = null;
  pv.aiPolicyUnsub = null;

  pv.offline.wireOfflineToggle();

  pv.chrome.wireUpdatesAndHotFolder();

  // Connected services (plans/129) - same lazy-mount idiom; the module owns
  // its own re-rendering after connect/disconnect/save.
  const connectionsDetails = viewEl.querySelector<HTMLDetailsElement>('#connections-section'); pv.connectionsDetails = connectionsDetails;
  pv.connectionsLoaded = false;
  // Sync across devices (plans/138 B1) - the sub-block inside the same card, so it
  // rides the same open: one toggle, two bodies. The module owns its own
  // re-rendering after each change.
  pv.syncLoaded = false;

  pv.connections.wireConnectionsToggle();

  // ── Content Credentials: lazy, like Storage. The identity bridge (host.identity)
  // holds the device keypair + CA-issued cert; this section only ever shows either
  // a status card ("Signing as …") or the provider buttons + email magic-link form.
  // Everything repaints via body.innerHTML, so the click/submit handlers are
  // delegated once and survive every repaint. ────────────────────────────────────
  const identityDetails = viewEl.querySelector<HTMLDetailsElement>('#identity-section'); pv.identityDetails = identityDetails;
  const PROVIDER_LABELS: Record<string, string> = { suse: 'SUSE (id.suse.com)', github: 'GitHub', google: 'Google', dev: 'Dev', email: 'Email link' }; pv.PROVIDER_LABELS = PROVIDER_LABELS;
  pv.identityStatus = null;
  // The zero-secret Dev provider is offered only when the CA reports dev mode
  // (health contract: { ok: true, devProvider: boolean }). Memoised per mount.
  pv.caHealthP = null;

  // Memoised as a promise (not a boolean) so the magic-link path below can await
  // the same in-flight load instead of racing a second one.
  pv.identityLoadP = null;

  pv.identity.wireIdentityToggle();

  pv.chrome.wireCleanup();
}
