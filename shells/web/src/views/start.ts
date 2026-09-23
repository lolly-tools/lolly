import '../styles/parts/design-system-specimen.css';
// SPDX-License-Identifier: MPL-2.0
/**
 * #/start - the Design System studio (plan 97). This is THE place the design
 * system is set, saved, edited and deleted; the Dashboard's Design-system tab
 * renders the result read-only, and user preferences (theme, sound) live on
 * Profile. Five of the six rooms are lib/brand-editor.ts's panels, mounted once
 * with everything wired; this view owns what sits around them:
 *
 *   - the RAIL of rooms (Overview · Colours · Type · Logos · Tokens · Files) -
 *     independent areas, not steps: nothing is numbered, nothing gates on
 *     anything else, and arriving anywhere is legitimate. The editor renders
 *     all five of its panels and this view flips `data-active-tab` on it, so
 *     changing room never re-mounts anything. `overview` is not one of the
 *     editor's panels - parking that key on the same attribute hides all five,
 *     which is exactly what the Overview room wants. On a phone the rail
 *     becomes a horizontal chip strip pinned under the header;
 *   - the RAIL FOOT: "Add from…" (the source picker - a design file: a
 *     W3C/Tokens-Studio JSON, a Penpot file, an SVG's colours or a Lolly brand
 *     file; a PDF, read here for its colours, marks and embedded faces; an image;
 *     a font file), Export, and Versions (plan 97 section 6a - publish, activate,
 *     restore; hidden until the studio has something of its own to publish, and
 *     mounted the first time it is opened). All three act on the whole design
 *     system rather than the open room, which is why they sit in the chrome and
 *     not in a room;
 *   - the OVERVIEW room itself (lib/design-system/rooms/overview.ts) - the hub
 *     and the completion state. There is no finish card: Overview is always
 *     reachable and always reflects exactly what exists.
 *
 * Everything persists to the one `user/tokens/brand` install via the bridge's
 * single write chokepoint (installUserTokens → bust); a source install takes a
 * checkpoint first (lib/design-system/studio-state.ts), so "revert to before
 * the import" is one restore rather than a lost afternoon. A LOCKED catalog
 * owns its brand and can't be adjusted, so the route degrades to a read-only
 * note. Esc or the back pill returns to the view the user came from - the pill
 * wears that view's name (lib/back-nav.ts), falling back to "Tools" (the
 * gallery) when there's no history. `?area=<key>` deep-links a room (`?tab=` is
 * its kept alias - see lib/design-system/start-route.ts for the whole table).
 */

import '../styles/parts/start.css';
import type { TokensExtraction } from '@lolly/engine';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { applyChromeBrandVars } from '../brand-vars.ts';
import { siteIngestSupport } from '../capabilities.ts';
import { backPillHtml, resolveBackTarget } from '../components/back-pill.ts';
import { homeFabHtml } from '../components/home-fab.ts';
import { attachLangMenu, langFabHtml } from '../components/lang-menu.ts';
import { t } from '../i18n.ts';
import type { BrandTabKey } from '../lib/brand-editor.ts';
import { activeDesignSystemRecord } from '../lib/design-system/active.ts';
import { hasPendingLogoFiles } from '../lib/design-system/pending-files.ts';
import { SITE_MAX_URL_CHARS, detectSiteTransport } from '../lib/design-system/sources/website.ts';
import { isStartArea, resolveStartRoute } from '../lib/design-system/start-route.ts';
import type { StartArea, StartRoom } from '../lib/design-system/start-route.ts';
import { createStudioState } from '../lib/design-system/studio-state.ts';
import { createTray } from '../lib/design-system/tray.ts';
import type { Tray } from '../lib/design-system/tray.ts';
import { takePendingDesignSystemFile } from '../lib/drop-router.ts';
import { escape as escapeText } from '../utils.ts';
import type { PickerSource, StartHost } from './start/shared.ts';
import type { StartCtx } from './start/context.ts';
import { navigationOps } from './start/navigation.ts';
import { feedbackOps } from './start/feedback.ts';
import { brandOps } from './start/brand.ts';
import { roomsOps } from './start/rooms.ts';
import { exportingOps } from './start/exporting.ts';
import { candidatesOps } from './start/candidates.ts';
import { imagesOps } from './start/images.ts';
import { pdfOps } from './start/pdf.ts';
import { siteOps } from './start/site.ts';
import { looksOps } from './start/looks.ts';
import { referenceOps } from './start/reference.ts';
import { savedPageOps } from './start/saved-page.ts';
import '../styles/parts/start-reference.css';
import { sourcesOps } from './start/sources.ts';
import { tokensOps } from './start/tokens.ts';
import { lifecycleOps } from './start/lifecycle.ts';


// Compile-time pin: every room but Overview IS one of the editor's panel keys,
// which is what lets a room key be written straight onto `data-active-tab`. If
// either list drifts, this stops compiling instead of silently opening a room
// with no panel behind it. START_ROOMS, not START_AREAS: `versions` is a
// foot-pinned panel this view renders itself, and parking its key on the same
// attribute is exactly how the editor hides - the same trick `overview` uses.
type RoomsArePanels =
  Exclude<StartRoom, 'overview'> extends BrandTabKey
    ? BrandTabKey extends Exclude<StartRoom, 'overview'>
      ? true
      : never
    : never;
const ROOMS_ARE_PANELS: RoomsArePanels = true;
void ROOMS_ARE_PANELS;

export async function mountStart(viewEl: HTMLElement, host: StartHost, params = ''): Promise<void> {
  const start = {} as StartCtx;
  start.navigation = navigationOps(start);
  start.feedback = feedbackOps(start);
  start.brand = brandOps(start);
  start.rooms = roomsOps(start);
  start.exporting = exportingOps(start);
  start.candidates = candidatesOps(start);
  start.images = imagesOps(start);
  start.pdf = pdfOps(start);
  start.site = siteOps(start);
  start.reference = referenceOps(start);
  start.looks = looksOps(start);
  start.savedPage = savedPageOps(start);
  start.referenceRevision = 0;
  start.sources = sourcesOps(start);
  start.tokens = tokensOps(start);
  start.lifecycle = lifecycleOps(start);
  start.viewEl = viewEl;
  start.host = host;
  start.params = params;

  document.title = 'Make it yours · Lolly';

  // The back pill wears the name of the view the user came from - a tool's
  // "Manage fonts", the Dashboard CTA, a project folder - and returns there;
  // with no recorded history it's the classic "Tools" → gallery. Rendering and
  // click handling are the shared ones (components/back-pill.ts), so /start's
  // pill behaves and lines up exactly like every other view's; only the in-flow
  // placement (.start-back) is this view's own. Esc leaves the studio the same
  // way, hence the resolved target being kept alongside.
  const backTarget = resolveBackTarget(); start.backTarget = backTarget;
  const backHref = backTarget.href; start.backHref = backHref;
  const backPill = backPillHtml({ class: 'start-back' }); start.backPill = backPill;

  // The history-INDEPENDENT escape, beside the back pill in the same in-flow row
  // (shared chrome - components/home-fab.ts). The back pill answers "where did I
  // come from"; this answers "just get me out", always to the front door. The
  // studio paints no global nav of its own, so it is the one exit that never
  // depends on the back stack.
  //
  // One Home per view (plans/137 B4). A pill that IS the way home already - a
  // direct arrival, or a back target that happens to BE Home - renders with
  // `data-back-home`, which is the same attribute back-pill.ts reads before it
  // adds a FAB of its own (addHomeEscape). Read off the rendered markup rather
  // than re-derived from backTarget, so this can never disagree with the pill:
  // the ` data-back-home>` form cannot come out of escaped label text, because
  // escape() turns a '>' into an entity.
  const pillIsHome = backPill.includes(' data-back-home>'); start.pillIsHome = pillIsHome;
  const homeFab = pillIsHome ? '' : homeFabHtml(); start.homeFab = homeFab;

  const active = await activeDesignSystemRecord(host);
  const locked = await host.tokens?.isLocked?.().catch(() => false);
  // Older hosts without a registry can only report the shipped catalog lock.
  if (!active && locked) {
    document.title = 'Brand · Lolly';
    // Nothing here can accept a file the front door handed over (lib/drop-router.ts),
    // so the stash is spent rather than left holding a document's bytes for the
    // rest of the session.
    takePendingDesignSystemFile();
    viewEl.innerHTML = `
      <div class="start">
        <div class="start-back-row">${backPill}${homeFab}</div>
        <div class="gallery-topright">${langFabHtml()}</div>
        <header class="start-head">
          <p class="start-eyebrow">${t('Brand')}</p>
          <h1 class="start-title">${t('This brand is set')}</h1>
          <p class="start-sub">${t('This build ships with a fixed brand - its colours, fonts and tokens are what every tool and export use. Brand adjustment is turned off here, so there’s nothing to change.')}</p>
        </header>
      </div>`;
    attachLangMenu(viewEl.querySelector<HTMLElement>('.lang-fab'), host);
    start.navigation.wireBackPill();
    start.navigation.wireHomeFab();
    return;
  }

  // Read-only systems keep their own material intact. Copies and other local
  // systems remain editable, including on a deployment with a locked brand.
  if (active && (active.locked || locked)) {
    document.title = `${active.label} · Lolly`;
    takePendingDesignSystemFile();
    viewEl.innerHTML = `
      <div class="start">
        <div class="start-back-row">${backPill}${homeFab}</div>
        <div class="gallery-topright">${langFabHtml()}</div>
        <header class="start-head">
          <p class="start-eyebrow">${t('Design system')}</p>
          <h1 class="start-title">${escapeText(active.label)}</h1>
          <p class="start-sub">${t('This design system is read-only: its colours, type and logos are kept current from where it came. Make an editable copy to change them, or switch to another design system.')}</p>
          <p class="start-sub">
            <button type="button" class="be-btn" data-ds-fork>${t('Make an editable copy')}</button>
            <a class="be-btn" href="#/profile?focus=design-systems-section">${t('Switch')}</a>
          </p>
        </header>
      </div>`;
    attachLangMenu(viewEl.querySelector<HTMLElement>('.lang-fab'), host);
    start.navigation.wireBackPill();
    start.navigation.wireHomeFab();
    viewEl.querySelector('[data-ds-fork]')?.addEventListener('click', async () => {
      const [{ createDesignSystem }, { switchDesignSystem }] = await Promise.all([
        import('../lib/design-system/manage.ts'),
        import('../lib/design-system/switch.ts'),
      ]);
      const copy = await createDesignSystem(
        host as unknown as Parameters<typeof createDesignSystem>[0],
        { label: `${active.label} copy`, seedFrom: active.id }
      );
      await switchDesignSystem(
        host as unknown as Parameters<typeof switchDesignSystem>[0],
        copy.id,
        { route: 'start' }
      );
    });
    return;
  }

  // Read-only deep-link flags, consumed on mount and never propagated into a
  // generated link: which room, whether the OKLCH colour chart opens with it,
  // and whether the source modal is open on arrival (`?import=0` still means
  // shut, so the links that carried it land where they always did).
  const route = resolveStartRoute(params); start.route = route;
  const wantWheel = route.wheel; start.wantWheel = wantWheel;
  const importOpen = route.importOpen; start.importOpen = importOpen;
  // Profile creates a system with a neutral temporary label, then brings focus
  // here. Naming belongs beside the colours, type and assets it describes - not
  // in a detached setup prompt.
  const focusDsName =
    new URLSearchParams(params.startsWith('?') ? params.slice(1) : params).get('rename') === '1'; start.focusDsName = focusDsName;
  // `?source=url&u=<address>` PREFILLS the website source's field and does
  // nothing else - the fetch button is the consent, so a link somebody sends
  // must never be able to start a read (plan 97 section 9). Read here rather than in
  // resolveStartRoute because it is the only param that belongs to one stage
  // rather than to the route; it should move there the next time that file is
  // open, with the same "prefill, never act" contract written on it.
  start.urlPrefill = new URLSearchParams(params.startsWith('?') ? params.slice(1) : params).get('u') ?? '';
  if (start.urlPrefill.length > SITE_MAX_URL_CHARS) start.urlPrefill = '';
  start.activeArea = isStartArea(route.area) ? route.area : 'overview';

  // Rooms are peers: one flat list, no order to obey. Built at mount so every
  // label resolves against the language in force right now.
  const ROOM_LABELS: Record<StartArea, string> = {
    overview: t('Overview'),
    color: t('Colours'),
    type: t('Type'),
    logos: t('Logos'),
    tokens: t('Tokens'),
    catalogue: t('Files'),
    versions: t('Versions'),
  }; start.ROOM_LABELS = ROOM_LABELS;

  start.navigation.renderShell();

  start.navigation.wireChrome();

  // Mount liveness: #view itself is the router's persistent container (it never
  // disconnects - navigation just replaces its innerHTML), so "are we still the
  // mounted view" must be asked of a node THIS mount created.
  const shell = viewEl.querySelector<HTMLElement>('.start')!; start.shell = shell;
  const importResult = viewEl.querySelector<HTMLElement>('.start-import-result')!; start.importResult = importResult;

  // ── The studio (all five editor panels, mounted once) ────────────────────────
  const editorMount = viewEl.querySelector<HTMLElement>('[data-start-editor]')!; start.editorMount = editorMount;
  const noteEl = viewEl.querySelector<HTMLElement>('[data-start-note]'); start.noteEl = noteEl;
  const overviewPanel = viewEl.querySelector<HTMLElement>('[data-ds-panel="overview"]')!; start.overviewPanel = overviewPanel;
  const versionsPanel = viewEl.querySelector<HTMLElement>('[data-ds-panel="versions"]')!; start.versionsPanel = versionsPanel;
  const versionsBtn = viewEl.querySelector<HTMLButtonElement>('[data-ds-room="versions"]'); start.versionsBtn = versionsBtn;
  const versionsLink = viewEl.querySelector<HTMLButtonElement>('[data-ds-versions-link]'); start.versionsLink = versionsLink;
  const railEl = viewEl.querySelector<HTMLElement>('.ds-rail')!; start.railEl = railEl;

  start.brand.wireRegistry();
  const roomBtns = [...viewEl.querySelectorAll<HTMLButtonElement>('[data-ds-room]')]; start.roomBtns = roomBtns;
  /** The foot actions that only exist once there is a system worth exporting. */
  const furnishedOnly = [...viewEl.querySelectorAll<HTMLElement>('[data-start-furnished]')]; start.furnishedOnly = furnishedOnly;
  /** The rail's "Add from…" hero. Declared up here because refreshFurnished()
   *  below reveals it; its click wiring is with the rest of the picker's. */
  const importBtn = viewEl.querySelector<HTMLButtonElement>('[data-start-import]'); start.importBtn = importBtn;

  // The save discipline's substrate (plan 97 section 6): used here for the checkpoint a
  // source install takes before it writes, so "revert to before the import" is a
  // restore rather than an apology. The rooms adopt the rest in M1.
  //
  // `afterInstall` fires only on studio.install, which nothing but the Versions
  // panel calls today - so an unversioned studio never runs it. It exists because
  // activating a version changes what the CHROME resolves against
  // (applyChromeBrandVars reads active-or-latest), and a repaint nobody triggers
  // would leave the app painted in the version the page opened with.
  //
  // No `label`: a routine save is not a rename. Passing one here renamed the
  // design system on every commit, so a system the person called "Acme" went
  // back to "My brand" the next time they touched a colour (plans/186 section
  // 3.3). A first install still gets a name from the write chokepoint's default.
  const studio = createStudioState(host as unknown as Parameters<typeof createStudioState>[0], {
    afterInstall: () => applyChromeBrandVars(host),
  }); start.studio = studio;

  // ── The candidate tray (plan 97 section 8) ──────────────────────────────────────────
  // A source scans material into a census, the census becomes typed candidates,
  // and NOTHING joins the design system until someone presses Add. The model is
  // persistent and outlives the view (lib/design-system/tray.ts); its surface
  // and its two commit paths are wired further down, once the editor exists.
  //
  // Created HERE, before the editor, because there must be exactly ONE live tray
  // per mounted studio. The tray persists its whole candidate list on every
  // write, so two instances on the same key each save their own in-memory list
  // and the later write erases whatever the other one added. The Logos room
  // hands the colours a mark carries to a tray too - it gets this one.
  const tray: Tray = createTray(host as unknown as Parameters<typeof createTray>[0]); start.tray = tray;
  try {
    await tray.load();
  } catch {
    /* an unreadable tray simply starts empty */
  }

  // A hand-off is waiting (the #/pdf exploder's Send to Logos, or this view's own
  // send across the remount). Read BEFORE the editor mounts, because the Logos
  // room's paint drains the stash: after that the answer is always false. It
  // decides one thing - whether the room this mount opens on takes focus, so a
  // keyboard user who pressed a button that navigated reaches a control.
  const marksArriving = hasPendingLogoFiles(); start.marksArriving = marksArriving;

  start.editor = null as StartCtx['editor'];
  start.overview = null as StartCtx['overview'];
  start.versions = null as StartCtx['versions'];

  await start.brand.mountEditor();
  const editorRoot = editorMount.querySelector<HTMLElement>('[data-brand-editor]'); start.editorRoot = editorRoot;

  start.rooms.wireEditorPanels();
  // ── Mobile palette sheet (≤640px) - mounted only while the Colours room shows,
  // and only when the editor actually mounted (a locked build renders no studio;
  // a failed mount leaves editor null / editorRoot missing - nothing to mirror).
  // Torn down on every room change away and on view unmount.
  start.paletteSheet = null as StartCtx['paletteSheet'];
  start.trayUi = null as StartCtx['trayUi'];

  // ── Rooms ────────────────────────────────────────────────────────────────────
  // A rail item is navigation, not a tab in a tablist: it carries aria-current,
  // and the panel it opens is a region named after it. `overview` on the editor's
  // data-active-tab matches none of its five panels, which is how the editor
  // hides itself while the Overview room shows.
  // Is there a system worth EXPORTING here? The Overview room's own answer
  // (readOverview → `worthExporting`), reused rather than re-derived, so the
  // foot's export actions can never contradict the room (plans/137 B1). The bar
  // used to be the room's `furnished` - which the first colour makes true, so
  // one gesture in the rail grew Export, Tokens and Versions (plans/163 F4).
  // Latched on: nothing in a session takes a design system away again.
  //
  // Cheap where it matters most. readOverview returns its empty model straight
  // after the tokens-asset lookup, so an EMPTY studio pays one keyed read per
  // call; a furnished one pays the full read on each room change and commit
  // until this answers true, after which nothing here reads again. That window
  // is a handful of user-paced gestures wide, which is what it buys: the rail
  // grows its power actions when the system does, not on the first colour.
  start.worthExporting = false;
  // Whether the foot's Versions entry is offered at all. Two ways in: something
  // has actually been published (the version index, read once below), or the panel was
  // asked for by name - a `?area=versions` link must never land on a control that
  // is not there. A system that merely EXISTS is deliberately not enough: that
  // rule put publishing on the face of a studio one colour old (plans/137 B2).
  //
  // Once shown it STAYS shown for the session. Hiding it again the moment the
  // user opens another room made the deep link one-way: the panel's own empty
  // state invites you to go and add colours first, `selectRoom` replaceStates the
  // URL so Back cannot recover it either, and the way home was to retype the
  // link. A latch is cheaper than a second door, and it cannot make the entry
  // appear for somebody who never asked for it.
  start.versionsOffered = false;
  /** Mount-on-first-open, then refresh. Reassigned once the panel's context
   *  exists further down; until then opening the area is simply a no-op panel,
   *  which is what the very first selectRoom() call needs. The laziness is the
   *  point: reading the ledger, hashing the pinned assets and measuring storage
   *  are the panel's costs, and a studio that never opens it must never pay them. */
  start.openVersions = () => {
    /* wired below */
  };

  start.rooms.wireRooms();

  // Deep-link: `#/start?area=color&wheel` opens the OKLCH Colour chart on mount -
  // the same folded card the Colours room reveals on click. Reuses the editor's
  // own opener (it repaints the wheel via its toggle handler). A no-op when the
  // editor didn't mount (failed/locked) or the chart card is absent (openColorChart
  // returns false), so a locked/degraded studio deep-links gracefully. The flag
  // is consumed here - selectRoom's replaceState above already dropped it from the URL.
  if (start.activeArea === 'color' && wantWheel) start.editor?.openColorChart();

  start.rooms.wireFocusRoute();

  start.exporting.wirePackExport();

  // The head document, kept in step with what is installed - the source of the
  // plain-tokens export below, which re-reads it at the press either way.
  //
  // NOTHING WRITES THROUGH THIS. A view-held snapshot of the installed document
  // is only ever safe to READ from: the Colours room edits its own live copy and
  // installs it, so writing into a snapshot and installing that reverts every
  // edit made since it was taken. Adds go through `editor.addColors`.
  start.headDoc = null as StartCtx['headDoc'];
  await start.exporting.refreshHead();

  start.exporting.wireTokensExport();

  start.exporting.wireFontsExport();

  start.brand.wireRecoveryAndVersions();

  start.unsubTray = null as StartCtx['unsubTray'];
  /** Unsubscribe from the palette seam that re-asks the Colours beat (plan 182
   *  section 3a) - the mirror only exists past beat 0. */
  start.unsubBeat = null as StartCtx['unsubBeat'];
  const trayToggle = viewEl.querySelector<HTMLButtonElement>('[data-start-tray]'); start.trayToggle = trayToggle;
  const trayCountEl = viewEl.querySelector<HTMLElement>('[data-start-tray-n]'); start.trayCountEl = trayCountEl;

  start.candidates.wireTray();

  // ── The PDF source (plan 97 section 8 gap 2, M5) ────────────────────────────────────
  // A guidelines PDF is the richest single file most teams have: its artwork
  // carries the marks AND the palette they are drawn in, and it embeds the real
  // font programs. All of the reading is lib/design-system/sources/pdf.ts's
  // (views/pdf-import.ts's PdfHandle underneath, imported on demand so nobody
  // pays for pdf-lib until a PDF actually arrives); this owns the copy, the
  // result card and the presses. Every byte is read here, on this device.
  //
  // The three findings travel three different ways, deliberately:
  //   colours + families → the tray, like every other source. Nothing installs.
  //   marks              → the Logos room, and only once the button is pressed:
  //                        a stash armed by a scan nobody acted on would queue
  //                        chips into a later visit that were never asked for.
  //   embedded faces     → an install, one press per face, with the caveats the
  //                        document itself states shown BEFORE the press.
  start.pdfPicks = [];
  start.pdfFonts = [];
  /** The scanned file's stem, so a mark sent to Logos arrives named after the
   *  document it came out of rather than as "logo.svg". */
  start.pdfStem = '';

  // ── The website source (plan 97 section 9, M6) ──────────────────────────────────────
  // section 9's decision in one sentence: NO SERVER FETCH, EVER. The deployed PWA
  // cannot reach an arbitrary origin at all (its CSP allowlists six hosts, so
  // this dies before CORS is even asked), and no fetching service was built -
  // it was ruled out, not deferred. So the source exists only where a reader
  // already lives on the device: a Tauri shell's native fetch, or the Lolly
  // extension reading one background tab.
  //
  // `siteTransport === null` is the gate, and it gates the TILE, not the tile's
  // state: nothing about this source appears in the picker on a plain browser,
  // because a control that cannot work teaches the person a lie about their own
  // machine. Discovery lives on the capabilities page instead (capabilities.ts's
  // `siteIngestSupport`, rendered as prose in lib/capabilities-data.ts).
  //
  // Nothing is fetched before the press. The button IS the consent, its label
  // names the host, and the line above it names WHO does the reading, because
  // "the extension opens a background tab on suse.com" and "this app opens a
  // socket to suse.com" are different facts about somebody's device. A
  // `?source=url&u=` link only fills the field in.
  const siteTransport = detectSiteTransport(host as unknown as HostV1); start.siteTransport = siteTransport;
  // Read through the one place verdicts live, so the picker and the capabilities
  // page cannot disagree about what 'ready' means. 'install' (Chromium without
  // the extension) deliberately renders NOTHING here - see capabilities.ts.
  const siteReady =
    siteIngestSupport(siteTransport !== null).status === 'ready' && siteTransport !== null; start.siteReady = siteReady;

  /** The marks a scan found that the Logos room can take, and the name the page
   *  calls itself: held between the result card and its presses, the same
   *  lifecycle as the PDF stage's `pdfPicks`. */
  start.siteMarks = [];
  start.siteNameOffer = '';
  /** The host the last scan actually reached (after any redirect) - the
   *  provenance in the card, and the noun in everything said about it. */
  start.siteHostName = '';

  // ── Add from…: a two-stage picker ────────────────────────────────────────────
  // Stage 1 asks WHAT you have (plan 97 section 8); stage 2 is that source's own control.
  // The design-file card is NOT rebuilt per open - it's moved out of its hidden
  // holder into the file stage and back again, so the file input, the drop target
  // and the delegated result handlers below stay wired to the same nodes for the
  // life of the view. Everything else is the shared modal primitive: Escape,
  // backdrop dismissal, focus containment and restore come free (components/modal.ts).
  const importHome = viewEl.querySelector<HTMLElement>('[data-start-import-home]')!; start.importHome = importHome;
  const importPanel = viewEl.querySelector<HTMLElement>('[data-start-import-panel]')!; start.importPanel = importPanel;
  start.importModal = null as StartCtx['importModal'];

  // Built at open so every label resolves against the language in force.
  const SOURCE_NAME: Record<PickerSource, () => string> = {
    file: () => t('Lolly pack or design file'),
    pdf: () => t('PDF'),
    image: () => t('Logo or screenshot'),
    font: () => t('Font file'),
    url: () => t('Website'),
    page: () => t('Saved web page'),
  }; start.SOURCE_NAME = SOURCE_NAME;
  const SOURCE_NOTE: Record<PickerSource, () => string> = {
    // User-first, not format-first (plans/137 B3): the exact formats are one tap
    // away on the file stage's own chips, which is where somebody checking
    // whether THEIR export is accepted is already looking.
    file: () => t('A .lolly file, tokens JSON, a Penpot project or an SVG.'),
    pdf: () =>
      t('A deck or guidelines file. Colours, marks and typefaces are read on this device.'),
    image: () =>
      t('A screenshot or a photo. Colours are read on this device and nothing is uploaded.'),
    font: () => t('TTF, OTF or WOFF. Opens Type, where the face installs.'),
    page: () => t('HTML and CSS files, or pasted source. Nothing is uploaded.'),
    // The tile names its reader AND whose session does the reading, because the
    // two are different things to do to somebody's device and the person is
    // about to consent to one of them.
    url: () =>
      siteTransport?.kind === 'extension'
        ? t('One page, read through the extension in a background tab, signed in as you.')
        : t('One page, fetched by the app on this device, signed in to nothing.'),
  }; start.SOURCE_NOTE = SOURCE_NOTE;

  start.sources.wireSources();

  // ── Install (the JSON-import path funnels here) ──────────────────────────────
  // An install keeps the user IN the studio: the editor reloads around the new
  // tokens so the palette, fonts and logos rooms show what was just imported, and the
  // Colours room opens on it.
  start.installing = false;

  // ── Import path - a raw tokens JSON (W3C DTCG / Tokens Studio) or a .zip pack ─
  // `openImport()` reparents this panel into a body-mounted dialog. A routed
  // arrival such as Profile -> "Load .lolly or another file" opens that dialog
  // before the wiring below runs, so `viewEl.querySelector(...)` is already the
  // wrong owner at this point. Keep every file-stage lookup rooted in the stable
  // panel reference: it survives both opening and closing the modal.
  const importFile = importPanel.querySelector<HTMLInputElement>('.start-import-file')!; start.importFile = importFile;
  start.importedDoc = null as StartCtx['importedDoc'];
  // The token-less Penpot path's census, held between the proposal card render
  // and its "Make this the look" click (same lifecycle as importedDoc).
  start.pendingUsage = null as StartCtx['pendingUsage'];
  // The semantic mapping review's proposal and the primary chosen in the card -
  // same lifecycle again, cleared at the top of every handleImportFile.
  start.pendingRoles = null as StartCtx['pendingRoles'];
  start.roleChoice = null as StartCtx['roleChoice'];
  // The card's pool of colour tokens, same lifecycle again. The ranking, the
  // chooser's cap and what follows a pick are all pure and live with the rest of
  // the mapping model in lib/design-system/sources/file.ts; this view holds the
  // state and paints it.
  start.pendingTokens = [];
  // The SVG path's scanned colours, so "Keep these for later" can hand the same
  // list to the tray that the checkbox grid is showing.
  start.pendingSvgColors = [];
  start.importedLabel = t('My brand');

  /** What produced a document, as a phrase rather than an id. The JSON path used
   *  to print the raw extraction source ('dtcg'), which said nothing to anyone who
   *  had not read the engine. */
  const SOURCE_LABEL: Record<TokensExtraction['source'], () => string> = {
    dtcg: () => t('design tokens'),
    'tokens-studio': () => t('tokens studio'),
    'token-set-files': () => t('token set files'),
    'penpot-project': () => t('penpot tokens'),
  }; start.SOURCE_LABEL = SOURCE_LABEL;

  start.tokens.wireTokenDrop();

  start.tokens.wireTokenReview();

  start.lifecycle.wireCleanup();
}
