// SPDX-License-Identifier: MPL-2.0
/**
 * start: candidates.
 *
 * Every function but handFocusBack takes the shared `start: StartCtx` first (see context.ts). Sibling
 * calls in this file are direct; a call into another module, and every use of a
 * function as a value (an event listener), goes through `start.<module>.<fn>`. Extracted verbatim
 * from mountStart() by scripts/split-closure.ts.
 */
import { announce } from '../../a11y.ts';
import { bustFontRegistry } from '../../bridge/font-registry.ts';
import { t, tRaw } from '../../i18n.ts';
import type { ColorEntry } from '../../lib/design-system/add-color.ts';
import type { DesignCensus } from '../../lib/design-system/census.ts';
import { candidatesFromCensus } from '../../lib/design-system/tray.ts';
import { mountTrayUi } from '../../lib/design-system/tray-ui.ts';
import { playSfx } from '../../lib/sfx.ts';
import { installGoogleFont } from '../../user-fonts.ts';
import type { UserFontsHost } from '../../user-fonts.ts';
import { bindOp, type StartCtx } from './context.ts';

/**
 * One token per colour, through the Colours room's own write (plan 97 section 2b).
 *
 * The room's `addColors` writes into the LIVE document the editor is holding
 * - the only correct target. This view once kept its own `headDoc` snapshot
 * and wrote into that when the room had no add path: a snapshot taken at mount
 * and refreshed only by this view's own installs, so a tray Add made after any
 * edit in the room reinstalled the pre-edit document and reverted it. There is
 * one document; the room owns it, and there is no second way in.
 *
 * The tray is mounted only when the editor mounted (see below), so the absent
 * case is a degraded studio rather than a state a person can press their way
 * into - it still says so instead of going quiet, because a press that reports
 * nothing added reads exactly like a dead button.
 */
export const addColorsToSystem = (start: StartCtx, entries: ColorEntry[]): number => {
  const own = start.editor?.addColors;
  if (!own) {
    start.exporting.showNote(t('The brand editor didn’t open - reload the page and try again.'), true);
    return 0;
  }
  return own(entries);
};
export const syncTrayToggle = (start: StartCtx): void => {
  const { trayCountEl, trayToggle } = start;
  if (!trayToggle) return;
  const n = start.trayUi?.count() ?? 0;
  trayToggle.hidden = n === 0; // an empty concept is never advertised
  trayToggle.setAttribute('aria-expanded', String(start.trayUi?.isOpen() ?? false));
  if (trayCountEl) trayCountEl.textContent = n ? String(n) : '';
};
/** A finished census into the tray, opened on what it found. Every source ends
 *  here - there is no second path that skips the tray. */
export const keepInTray = async (start: StartCtx, 
  census: DesignCensus,
  note?: (msg: string, isError?: boolean) => void
): Promise<number> => {
  const { tray } = start;
  // One sink per message: `note` writes into an aria-live region of its own, so
  // announce() on top of it says everything twice. It is the fallback for a
  // call that passed no note, never a second voice for one that did.
  const say = (msg: string, isError = false): void => {
    if (note) note(msg, isError);
    else announce(msg, { assertive: isError });
  };
  const candidates = candidatesFromCensus(census);
  if (!candidates.length) {
    say(tRaw('Nothing to keep from {source}.', { source: census.source.label }), true);
    return 0;
  }
  let n = 0;
  try {
    n = await tray.add(candidates);
  } catch (err) {
    say(String((err as { message?: unknown })?.message ?? err), true);
    return 0;
  }
  // No `focus`: a scan can land while the source dialog is still open, and the
  // tray sits outside it. The panel refuses to open on an empty list itself.
  start.trayUi?.open(); // fires onOpenChange → the rail toggle and the sheet resync
  syncTrayToggle(start); // …and again for the count, which the open didn't change
  // A rescan of the same source adds nothing, because the tray dedupes on
  // type+value - report it rather than reporting "0 kept". Which "already" it is
  // matters: a candidate still pending is IN the tray, one already added is in
  // the design system and will never come back to the tray, and telling
  // someone to look in a tray that is empty (and whose toggle is hidden) is
  // the more confusing of the two by a distance.
  const stillPending = new Set(
    tray
      .list()
      .filter((c) => c.state === 'pending')
      .map((c) => c.id)
  );
  const msg =
    n === 0
      ? candidates.some((c) => stillPending.has(c.id))
        ? t('Already in the tray.')
        : t('Already added to the design system.')
      : n === 1
        ? t('1 kept in the tray')
        : tRaw('{n} kept in the tray', { n });
  say(msg);
  return n;
};
/**
 * Focus the first target that actually takes focus. A target that is hidden,
 * or not drawn (display: none in a narrow layout), ignores focus(), and that
 * is only known by asking: focus() is called and the active element read back.
 * Returns the element that took focus, or null when none did.
 */
export function handFocusBack(targets: ReadonlyArray<HTMLElement | null | undefined>): HTMLElement | null {
  for (const el of targets) {
    if (!el || el.hidden) continue;
    el.focus();
    if (el.ownerDocument.activeElement === el) return el;
  }
  return null;
}

export function wireTray(start: StartCtx): void {
  const { host, importBtn, railEl, shell, tray, trayToggle } = start;
  // A locked build never reaches here (the route returned above) and a failed
  // editor mount has nothing to repaint an add into, so the tray is mounted only
  // where its Adds can actually land.
  if (start.editor) {
    start.trayUi = mountTrayUi(shell, {
      tray,
      // The disclosure pair: the panel is a fixed dock appended after the whole
      // studio, so `aria-controls` and the focus hand-back are the only things
      // tying it to the control that opens it.
      toggle: trayToggle ?? undefined,
      addColors: start.candidates.addColorsToSystem,
      // Only families we hold a fetchable source for get an Add at all (the tray
      // checks that itself); this is what happens when one is pressed. The face
      // becomes the primary only when nothing else claims that role yet.
      installFont: async (family) => {
        await installGoogleFont(host as unknown as UserFontsHost, family);
        bustFontRegistry();
        await start.editor?.reload();
      },
      onOpenChange: (open) => {
        start.rooms.syncPaletteSheet();
        start.candidates.syncTrayToggle();
        // A tray that closes by EMPTYING also hides the toggle it would hand
        // focus back to, so there is nothing left in the panel's own story to
        // return to. Rather than leave a keyboard user at the top of the
        // document, put them on the rail action that starts the next scan - and
        // only when focus was actually dropped, so this can never be a steal.
        // Queried here, not captured: this fires long after mount either way.
        if (!open && trayToggle?.hidden && document.activeElement === document.body) {
          // "Add from…" is hidden on an empty studio (plans/163 F2) and not
          // drawn on a phone, where the More menu holds it; focus() on either
          // does nothing. So each target is tried in turn until one takes
          // focus: "Add from…", then More (its home on a phone), then the room
          // strip's own stop.
          handFocusBack([
            importBtn,
            shell.querySelector<HTMLElement>('[data-ds-more]'),
            railEl.querySelector<HTMLElement>('[data-ds-room][tabindex="0"]'),
            railEl.querySelector<HTMLElement>('[data-ds-room]'),
          ]);
        }
      },
    });
    start.unsubTray = tray.subscribe(start.candidates.syncTrayToggle);
    start.candidates.syncTrayToggle();
    trayToggle?.addEventListener('click', () => {
      start.trayUi?.toggle();
      start.candidates.syncTrayToggle();
      playSfx('click');
    });
    // The Colours room's beat moves on a commit, and the palette mirror only
    // exists past beat 0 - so the first colour is what mounts the sheet, and an
    // undo back to nothing is what takes it away. Same seam the mirror itself
    // re-renders off; it tolerates double-fires, and so does this.
    start.unsubBeat = start.editor.onPalette(start.rooms.syncPaletteSheet);
  }
}

export function candidatesOps(start: StartCtx) {
  return {
    addColorsToSystem: bindOp(start, addColorsToSystem),
    syncTrayToggle: bindOp(start, syncTrayToggle),
    keepInTray: bindOp(start, keepInTray),
    wireTray: bindOp(start, wireTray),
  };
}
