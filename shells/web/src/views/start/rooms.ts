// SPDX-License-Identifier: MPL-2.0
/**
 * start: rooms.
 *
 * Every function takes the shared `start: StartCtx` first (see context.ts). Sibling
 * calls in this file are direct; a call into another module, and every use of a
 * function as a value (an event listener), goes through `start.<module>.<fn>`. Extracted verbatim
 * from mountStart() by scripts/split-closure.ts.
 */
import { mountOverviewRoom, readOverview } from '../../lib/design-system/rooms/overview.ts';
import { mountUsageRoom } from '../../lib/design-system/rooms/usage.ts';
import { isStartArea } from '../../lib/design-system/start-route.ts';
import type { StartArea } from '../../lib/design-system/start-route.ts';
import { playSfx } from '../../lib/sfx.ts';
import { mountPaletteSheet } from '../../lib/design-system/palette-sheet.ts';
import { bindOp, type StartCtx } from './context.ts';

export const syncPaletteSheet = (start: StartCtx): void => {
  const { editorRoot, shell } = start;
  // Single owner of the phone's bottom edge: the tray and the palette sheet are
  // both fixed sheets there, and two of them stacked is one of them unreachable.
  // The tray is the transient one, so it wins while it is open and the palette
  // mirror comes back the moment it closes (onOpenChange calls this).
  //
  // Beat 0 has nothing to mirror (plan 182 section 3a): the room holds no
  // colour of its own, so a sheet there would peek an empty strip and eat the
  // bottom of the one screen the first pick has to fit in. The editor answers
  // the beat, and every commit re-asks through onPalette below.
  const want =
    start.activeArea === 'color' &&
    start.editor !== null &&
    !!editorRoot &&
    (start.editor.colourBeat?.() ?? 2) > 0 &&
    !(start.trayUi?.isOpen() ?? false);
  if (want && !start.paletteSheet) start.paletteSheet = mountPaletteSheet(shell, start.editor!, editorRoot!);
  else if (!want && start.paletteSheet) {
    start.paletteSheet.teardown();
    start.paletteSheet = null;
  }
};
export const syncVersionsEntry = (start: StartCtx): void => {
  const { versionsBtn, versionsLink } = start;
  if (start.activeArea === 'versions') start.versionsOffered = true;
  if (versionsBtn) versionsBtn.hidden = !start.versionsOffered;
  // The first publish has to stay one press away, so a system worth exporting
  // that has never published gets the quiet entry instead of the rail one - and
  // drops it again as soon as the rail entry latches on.
  if (versionsLink) versionsLink.hidden = start.versionsOffered || !start.worthExporting;
};
/** Re-read the room's signals and reveal what each of the two latches owes.
 *  Called from the two paths the studio already refreshes on - every room
 *  change and every committed edit - so a studio that grows mid-session
 *  reveals them without a reload, whichever room the edit was made in. */
export const refreshFurnished = (start: StartCtx): void => {
  const { host } = start;
  if (start.worthExporting) return; // the harder latch is set, so both are
  void readOverview(host as unknown as Parameters<typeof readOverview>[0])
    .then((model) => {
    const { furnishedOnly, importBtn, shell } = start;
      if (!shell.isConnected) return;
      // The hero only duplicates a door while the doors are up (plans/163 F2).
      if (model.furnished && importBtn) importBtn.hidden = false;
      if (!model.worthExporting) return;
      start.worthExporting = true;
      for (const el of furnishedOnly) el.hidden = false;
      syncVersionsEntry(start);
    })
    .catch(() => {
      /* undiscoverable storage - the actions stay out of the way */
    });
};
export const selectRoom = (start: StartCtx, area: StartArea, opts: { focus?: boolean; sfx?: boolean } = {}): void => {
  const { editorRoot, overviewPanel, roomBtns, versionsPanel } = start;
  start.activeArea = area;
  start.editor?.closeOverlays(); // a popover anchored in the outgoing room must not linger
  refreshFurnished(start); // the install path runs through here too (selectRoom('color'))
  syncVersionsEntry(start); // before the focus loop: a hidden button cannot take it
  for (const btn of roomBtns) {
    const on = btn.dataset.dsRoom === area;
    if (on) btn.setAttribute('aria-current', 'page');
    else btn.removeAttribute('aria-current');
    if (on && opts.focus) btn.focus();
  }
  overviewPanel.hidden = area !== 'overview';
  start.usagePanel.hidden = area !== 'usage';
  if (area === 'usage') {
    if (start.usage) void start.usage.refresh();
    else start.usage = mountUsageRoom(start.usagePanel, { host: start.host, studio: start.studio, changed: () => { start.rooms.refreshFurnished(); start.brand.wireRegistry(); } });
  } else start.usage?.suspend();
  versionsPanel.hidden = area !== 'versions';
  editorRoot?.setAttribute('data-active-tab', area);
  if (area === 'overview') start.overview?.refresh();
  if (area === 'versions') start.openVersions();
  syncPaletteSheet(start);
  // Keep the URL shareable without spamming history.
  // `area` is deliberately the ONLY param that survives: `focus`, `wheel`, `import`,
  // `source` and `seed` are one-shot flags, consumed on mount and never propagated
  // into a generated link (the contract in lib/design-system/start-route.ts). So a
  // room click dropping them is the design, not a regression - the URL you copy
  // afterwards says which room you are in, not which wing you once opened.
  try {
    history.replaceState(null, '', `#/start?area=${area}`);
  } catch {
    /* sandboxed */
  }
  if (opts.sfx) playSfx('click');
};
/**
 * Open what a `?focus=` (or an Overview door) asked for, in the room it
 * belongs to. One table for both, so a door and a link can never disagree.
 *
 * Every opener is optional on the handle and answers false when its room did
 * not render, which is how a locked or degraded studio degrades: the room
 * opens, the control does not, nothing throws. None of them writes - `pick`
 * and `stage` put a decision in front of the person and wait for it.
 */
export function openFocus(start: StartCtx, area: StartArea, focus: string): void {
  if (focus === 'looks') { void start.looks.openLooks(); return; }
  if (area === 'type') {
    if (focus === 'stage') start.editor?.openTypeStage?.('brand');
    return;
  }
  if (area !== 'color') return;
  if (focus === 'pick') {
    start.editor?.openPickCard?.();
    return;
  }
  if (focus === 'chart') {
    start.editor?.openColorChart();
    return;
  }
  if (focus === 'generate' || focus === 'curves' || focus === 'contrast' || focus === 'print') {
    start.editor?.openWing?.(focus);
  }
}
export function wireEditorPanels(start: StartCtx): void {
  const { editorRoot } = start;
  // Name each editor panel after the rail item that opens it (the editor renders
  // the panels; only this view knows what navigates to them).
  editorRoot?.querySelectorAll<HTMLElement>('[data-be-tab-panel]').forEach((panel) => {
    const key = panel.dataset.beTabPanel!;
    panel.id = `start-panel-${key}`;
    panel.setAttribute('role', 'region');
    panel.setAttribute('aria-labelledby', `ds-room-${key}`);
  });
}

export function wireRooms(start: StartCtx): void {
  const { host, marksArriving, overviewPanel, railEl, versionsLink } = start;
  railEl.addEventListener('click', (e) => {
    const area =
      (e.target as HTMLElement).closest<HTMLElement>('[data-ds-room]')?.dataset.dsRoom ?? '';
    if (isStartArea(area)) start.rooms.selectRoom(area, { sfx: true });
  });
  // The quiet first-publish entry opens the same panel. Focus goes with it: the
  // press hides the control that was made (syncVersionsEntry latches the rail
  // entry on), so a keyboard user needs somewhere to land.
  versionsLink?.addEventListener('click', () => start.rooms.selectRoom('versions', { focus: true, sfx: true }));

  // The room is selected BEFORE the Overview room mounts, so the panel's hidden
  // state is already true/false when the room takes its first reading (and the
  // arrival doesn't read the design system twice).
  //
  // Marks arriving from a hand-off take the focus with them. The send navigates
  // (or remounts), which destroys the control that was pressed along with the
  // dialog that restored focus to it, so without this a keyboard user is
  // returned to the top of the document. The rail item is the landing: it is a
  // real control, it names the room the marks arrive in, and the queue is the
  // next stop from there.
  start.rooms.selectRoom(start.activeArea, { focus: marksArriving });
  start.overview = mountOverviewRoom(overviewPanel, {
    host: host as unknown as Parameters<typeof mountOverviewRoom>[1]['host'],
    editor: () => start.editor,
    goto: (area, focus) => {
      if (!isStartArea(area)) return;
      start.rooms.selectRoom(area, { focus: true, sfx: true });
      // A door names the room AND the control it wants open there - the same
      // pair `?focus=` carries, routed through the same openers, so the door and
      // the link can never land in different places.
      if (focus) start.rooms.openFocus(area, focus);
    },
    // The Overview's "Start from a file" door means exactly that, so it skips the
    // source list and opens on the file stage. OverviewCtx.openImport stays a
    // bare `() => void` - the room never learns the picker has stages.
    // Same picker, same first stage as the rail's "Add from…" (Andy, 2026-09-04: two
    // buttons, two different modals - unify). The door used to skip to the file stage.
    openLooks: start.looks.openLooks,
    openImport: () => {
      start.sources.openImport();
      playSfx('click');
    },
  });
}

export function wireFocusRoute(start: StartCtx): void {
  const { route } = start;
  // Deep-link: `#/start?area=color&focus=<wing>` opens that wing of the Colours
  // room (`chart` is the colour chart, the same target as `?wheel`). Same
  // consume-on-mount, no-op-when-degraded contract as the wheel flag.
  // `?seed=<hex>` primes the Generate wing's primary FIRST, so the wing opens
  // already showing ramps built from the carried colour (audit 167 F-A12 - the
  // added-chip's "Generate your palette from this colour" finally means it).
  if (route.focus) {
    if (start.activeArea === 'color' && route.seed) start.editor?.setGeneratePrimary?.(route.seed);
    start.rooms.openFocus(start.activeArea, route.focus);
  }

  // Deep-link: `#/start?area=color&group=<name>` reveals one INHERITED colour
  // group in the pane, folded and tagged Starter (plan 182 section 12) - minted
  // by the Tokens room's "Open" beside the starter neutrals, and the one thing
  // that ever draws a starter tile. Same consume-on-mount, no-op-when-degraded
  // contract as the wing flags above.
  if (start.activeArea === 'color' && route.group) start.editor?.openStarterGroup?.(route.group);
}

export function roomsOps(start: StartCtx) {
  return {
    syncPaletteSheet: bindOp(start, syncPaletteSheet),
    syncVersionsEntry: bindOp(start, syncVersionsEntry),
    refreshFurnished: bindOp(start, refreshFurnished),
    selectRoom: bindOp(start, selectRoom),
    openFocus: bindOp(start, openFocus),
    wireEditorPanels: bindOp(start, wireEditorPanels),
    wireRooms: bindOp(start, wireRooms),
    wireFocusRoute: bindOp(start, wireFocusRoute),
  };
}
