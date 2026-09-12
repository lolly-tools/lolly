// SPDX-License-Identifier: MPL-2.0
/**
 * profile: the design-systems and instance cards, the app-chrome wiring, the updates row, the hot folder and the teardown.
 *
 * Every function takes the shared `pv: ProfileViewCtx` first (see context.ts). Sibling
 * calls in this file are direct; a call into another module, and every use of a
 * function as a value (an event listener), goes through `pv.<module>.<fn>`. Extracted verbatim
 * from mountProfile() by scripts/split-closure.ts.
 */
import { t } from '../../i18n.ts';
import { attachLangMenu } from '../../components/lang-menu.ts';
import { wireSoundSwitch } from '../../components/sound-toggle.ts';
import { linkHelpDescriptions, wireHelpTips } from '../../components/help-tip.ts';
import { syncCatalog } from '../../catalog/sync.ts';
import { isTauriShell } from '../../lib/instance-choice.ts';
import { openInstanceSheet } from '../../components/instance-sheet.ts';
import { closeConfirmDialogs, confirmDialog } from '../../components/confirm-dialog.ts';
import { wireUpdatesRow } from '../profile-updates.ts';
import { mountBackPill } from '../../components/back-pill.ts';
import { mountHomeFab } from '../../components/home-fab.ts';
import { openProfileModals, openProfileToasts } from './shared.ts';
import { bindOp, type ProfileViewCtx } from './context.ts';

/** The design-systems card plus the instance Change and Leave buttons. */
export function wireInstanceCard(pv: ProfileViewCtx): void {
  const { host, viewEl } = pv;
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
      void import('../../lib/design-system/design-systems-card.ts')
        .then(m => m.mountDesignSystemsCard(dsBody, host as unknown as Parameters<typeof m.mountDesignSystemsCard>[1]))
        .catch(() => { dsBody.innerHTML = ''; });
    }
  }
  viewEl.querySelector('#instance-change-btn')?.addEventListener('click', async () => {
    await openInstanceSheet(host);
    await pv.mountProfile(viewEl, host); // re-read getInstanceBase() into the row
  });
  viewEl.querySelector('#instance-disconnect-btn')?.addEventListener('click', async () => {
    const { leaveInstance, countSessionsUsingInstanceTools } = await import('../../lib/instance-leave.ts');
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
}

/** Language FAB, back pill, home FAB, the sound switch and the help tips. */
export function wireChrome(pv: ProfileViewCtx): void {
  const { host, viewEl } = pv;
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
}

/** The app-updates row and the desktop-only hot folder form. */
export function wireUpdatesAndHotFolder(pv: ProfileViewCtx): void {
  const { params, shellUpdater, viewEl } = pv;
  // App updates (plans/202 WP4.1) - the three-button state machine in the "Lolly
  // instance" card. Its whole implementation is views/profile-updates.ts.
  wireUpdatesRow(viewEl, shellUpdater, params);

  // Hot folder (plans/174 #9) - desktop shells only; the boot module owns the
  // key and the invoke, this block is pure form wiring.
  if (isTauriShell()) {
    void import('../../lib/linux-desktop-boot.ts').then((hf) => {
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
}

/** View teardown: close body-level dialogs and toasts, detach from the offline run. */
export function wireCleanup(pv: ProfileViewCtx): void {
  const { viewEl } = pv;
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
    pv.offlineRunUnsub?.();
    pv.offlineRunUnsub = null;
    pv.aiPolicyUnsub?.();
    pv.aiPolicyUnsub = null;
  };
}

export function chromeOps(pv: ProfileViewCtx) {
  return {
    wireInstanceCard: bindOp(pv, wireInstanceCard),
    wireChrome: bindOp(pv, wireChrome),
    wireUpdatesAndHotFolder: bindOp(pv, wireUpdatesAndHotFolder),
    wireCleanup: bindOp(pv, wireCleanup),
  };
}
