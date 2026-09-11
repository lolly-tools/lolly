// SPDX-License-Identifier: MPL-2.0
/**
 * brand editor: the compare stage.
 *
 * Every function takes the shared `bedit: BrandEditorCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `bedit.<module>.<fn>`. Extracted verbatim
 * from mountBrandEditor() by scripts/split-closure.ts.
 */
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { installFontFromBytes, installGoogleFont, removeUserFont, setDisplayFont, setItalicFont, setMonoFont, setPrimaryFont } from '../../user-fonts.ts';
import type { FontRole } from '../../user-fonts.ts';
import { mountTypeCompare, pinnedFaces } from '../design-system/type-compare.ts';
import type { CompareChoice } from '../design-system/type-compare.ts';
import { googleMatch, parseFaceName } from '../design-system/font-resolve.ts';
import { PINNED_FAMILIES } from '../google-fonts.ts';
import { confirmDialog } from '../../components/confirm-dialog.ts';
import { fmtBytes } from '../device-info.ts';
import { t, tRaw } from '../../i18n.ts';
import { announce } from '../../a11y.ts';
import { prefersReducedMotion } from '../a11y-prefs.ts';
import { playSfx } from '../sfx.ts';
import { ensureGoogleFontsConsent, typeRoleLabel } from './shared.ts';
import { bindOp, type BrandEditorCtx } from './context.ts';

/** The stage's own error line. Written, never announced: the stage announces
 *  the outcome of a press itself, and two polite messages for one action is
 *  one too many. This carries the REASON the stage's own sentence cannot. */
export const setStageErr = (bedit: BrandEditorCtx, m: string): void => {
  const { stageErr } = bedit;
  if (!stageErr) return;
  stageErr.textContent = m;
  stageErr.hidden = !m;
};
/**
 * Move the stage under the card that opened it (plan 182 section 6.6). It
 * becomes a full-width item of the card grid, so at any column count it sits
 * on the row below its own card rather than below all four - which on a phone
 * was a stage a screen and a half down (T7).
 *
 * Two cases go back to the seat instead: the Fonts panel's "Add a face",
 * which no card owns, and any width where the collapsed strip is a sideways
 * scroller (≤640px) - a stage inside a scroller would be off to the right of
 * the pills rather than under them.
 */
export const narrowStrip = (bedit: BrandEditorCtx): boolean => {
  const { root } = bedit;
  try { return !!root.ownerDocument.defaultView?.matchMedia('(max-width: 640px)').matches; }
  catch { return false; }
};
export const placeStage = (bedit: BrandEditorCtx): void => {
  const { stageEl, stageHome, stageHomeNext } = bedit;
  if (!stageEl) return;
  const grid = bedit.ramps.$('[data-be-typecards]') as HTMLElement | null;
  const after = bedit.choosingRole && grid && !narrowStrip(bedit)
    ? grid.querySelector<HTMLElement>(`[data-be-typecard="${bedit.choosingRole}"]`)
    : null;
  if (after) after.insertAdjacentElement('afterend', stageEl);
  else if (stageHome && stageEl.parentElement !== stageHome) stageHome.insertBefore(stageEl, stageHomeNext);
};
/** Close the stage. Always a cancel: nothing is installed on the way out, and
 *  every preview registration goes with it (type-compare.ts's teardown). */
export const closeStage = (bedit: BrandEditorCtx, opts: { restoreFocus?: boolean } = {}): void => {
  const { stageEl, stageFromTray } = bedit;
  const open = bedit.stage;
  bedit.stage = null;
  bedit.choosingRole = null;
  bedit.stageOpen = false;
  stageFromTray.clear();
  open?.teardown();
  if (stageEl) stageEl.hidden = true;
  setStageErr(bedit, '');
  // The cards come back BEFORE the keyboard does: the control we are handing
  // focus to is a card button, and a display:none button cannot take it.
  placeStage(bedit);
  bedit.type.paintRoleCards();
  const back = bedit.stageReturn;
  bedit.stageReturn = null;
  // Never let a close drop the keyboard on <body>.
  if (open && opts.restoreFocus !== false && back?.isConnected) back.focus();
};
/**
 * Persist one stage choice. The stage hands over a candidate and this decides
 * the rail: a Google pick through `installGoogleFont`, a file through
 * `installFontFromBytes` (plan 97 section 4 gap 3 - the second entrance into the role
 * system), then the role that OPENED the stage is assigned through the same
 * withFontRoleToken writers the list rows use.
 *
 * Throwing is meaningful: the stage keeps the card standing and says the press
 * failed, so it can be tried again. The reason ends up under the stage.
 */
export const applyTypeChoice = async (bedit: BrandEditorCtx, choice: CompareChoice): Promise<void> => {
  const { fontsHost, stageFromTray } = bedit;
  const role = bedit.choosingRole;
  setStageErr(bedit, '');
  let family = '';
  try {
    if (choice.install === 'google') {
      // `primary: true` only for the Primary card. Every other role still gets
      // installGoogleFont's standing only-font promotion, which is the right
      // answer when there is no primary yet.
      const fam = await installGoogleFont(fontsHost, choice.family, role === 'brand' ? { primary: true } : {});
      family = fam.family;
    } else if (choice.bytes) {
      const fam = await installFontFromBytes(fontsHost, choice.bytes, {
        ...(choice.label ? { filename: choice.label } : {}),
        ...(role === 'brand' ? { makePrimary: true } : {}),
      });
      // installFontFromBytes returns null rather than throwing for bytes it
      // will not take, because its other callers are multi-file drop zones
      // where one bad file must not abandon the rest. Here there is one file
      // and one deliberate press, so a refusal is an error to show.
      if (!fam) throw new Error(t('That font file could not be installed.'));
      family = fam.family;
    } else {
      throw new Error(t('That candidate has no face to install.'));
    }
    if (role === 'display') await setDisplayFont(fontsHost, family);
    else if (role === 'mono') await setMonoFont(fontsHost, family);
    else if (role === 'italic') await setItalicFont(fontsHost, family);
  } catch (err) {
    setStageErr(bedit, String((err as { message?: unknown })?.message ?? err));
    throw err;
  }
  // The tray candidate that put this face on the stage has been shopped.
  const trayId = stageFromTray.get(choice.family.trim().toLowerCase());
  if (trayId) {
    try {
      const handle = await bedit.logos.trayHandle();
      // Re-read before writing. The candidate list is one host.state record and
      // the studio view holds its OWN Tray over it (views/start.ts's rail
      // panel), so a write from a stale in-memory copy would drop whatever it
      // has done since. This narrows that window to the write itself; it does
      // not close it, which is a two-instances problem and not this room's.
      await handle?.load();
      await handle?.markAdded(trayId);
    } catch { /* the tray is a convenience; it never fails an install */ }
  }
  playSfx('saveProfile');
  await bedit.type.paintFonts();
  bedit.state.notify('type');
  announce(role
    ? tRaw('{family} now serves {role}', { family, role: typeRoleLabel(role) })
    : tRaw('Added {family}', { family }));
  closeStage(bedit);
};
/** Font candidates a source scan left in the tray, put on the stage with their
 *  provenance. A face discovered in a document arrives spelled its own way
 *  ("ABCDEF+Inter-SemiBold"); font-resolve.ts resolves the whole spelling
 *  first and the parsed family second, which is the order its tests pin. An
 *  unresolvable family is still offered - the stage says honestly that it has
 *  no source for it, which beats hiding a face the person's own file names. */
export const seedStageFromTray = async (bedit: BrandEditorCtx): Promise<void> => {
  const { TRAY_SEED_MAX, stageFromTray } = bedit;
  const open = bedit.stage;
  const handle = await bedit.logos.trayHandle();
  if (!handle) return;
  await handle.load().catch(() => {}); // freshest list - see applyTypeChoice
  // The stage may have been closed or replaced while that was in flight.
  if (!open || open !== bedit.stage) return;
  const pending = handle.list()
    .filter(c => c.type === 'font' && c.state === 'pending')
    .slice(0, TRAY_SEED_MAX);
  for (const c of pending) {
    const resolved = googleMatch(c.value) ?? googleMatch(parseFaceName(c.value).family) ?? c.value;
    const spelled = c.value.trim();
    stageFromTray.set(resolved.trim().toLowerCase(), c.id);
    open.addCandidate({
      kind: 'tray',
      family: resolved,
      ...(resolved.trim().toLowerCase() === spelled.toLowerCase() ? {} : { label: spelled }),
      provenance: c.provenance.label,
    });
  }
};
/**
 * The pinned families, as one-press previews (plan 182 section 6.4).
 *
 * Built with DOM calls rather than markup: the only value that varies is a
 * family NAME, which never needs to be markup, and textContent keeps it out of
 * a sink altogether. Families already serving a role are dropped by
 * `pinnedFaces` - a chip offering the face you are already wearing previews
 * nothing.
 */
export const paintStagePins = (bedit: BrandEditorCtx): void => {
  const wrap = bedit.ramps.$('[data-be-typestage-pins]') as HTMLElement | null;
  const row = bedit.ramps.$('[data-be-typestage-pinrow]') as HTMLElement | null;
  if (!wrap || !row) return;
  // Every family a role RESOLVES to counts as taken, the starter's included:
  // the ownership report is the settled answer, the four locals are the same
  // reads one paint earlier, and both are listed so a stage opened before
  // paintFonts resolved still skips whatever is already on a card.
  const taken = [
    ...bedit.fontFamilies.map(f => f.family),
    ...Object.values(bedit.faces).map(f => f.family),
    bedit.brandFace, bedit.displayFamily, bedit.monoFamily, bedit.italicFamily,
  ];
  const families = pinnedFaces(PINNED_FAMILIES, taken);
  row.replaceChildren(...families.map((family) => {
    const chip = row.ownerDocument.createElement('button');
    chip.type = 'button';
    chip.className = 'be-btn be-typestage-pin';
    chip.dataset.bePin = family;
    chip.textContent = family;
    return chip;
  }));
  wrap.hidden = families.length === 0;
};
export const openStage = (bedit: BrandEditorCtx, role: FontRole | null, opener: HTMLElement | null): void => {
  const { host, stageEl, stageMount, stageQ, stageTitleEl } = bedit;
  if (!stageEl || !stageMount) return;
  closeStage(bedit, { restoreFocus: false }); // one stage, one decision
  bedit.choosingRole = role;
  bedit.stageOpen = true;
  bedit.stageReturn = opener;
  stageEl.hidden = false;
  // The cards fold to a one-line strip and the stage takes their place under
  // the one being chosen for, so the decision and its subject are on the same
  // screen at every width (plan 182 section 6.6).
  placeStage(bedit);
  bedit.type.paintRoleCards();
  paintStagePins(bedit);
  if (stageTitleEl) {
    stageTitleEl.textContent = role
      ? tRaw('Choose the {role} face', { role: typeRoleLabel(role) })
      : t('Compare faces');
  }
  bedit.stage = mountTypeCompare(stageMount, {
    host: host as unknown as HostV1,
    t,
    tRaw,
    consentGoogle: ensureGoogleFontsConsent,
    onSelect: bedit.compareStage.applyTypeChoice,
  });
  // Into the stage, on its first control: opening a panel from a press has to
  // move the keyboard with it.
  if (stageQ) { stageQ.value = ''; stageQ.focus(); }
  stageEl.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  void seedStageFromTray(bedit);
};
export function wireTypeCards(bedit: BrandEditorCtx): void {
  const { fontsHost, stageEl, stageQ, typePanel } = bedit;
  bedit.ramps.$('[data-be-typecards]')?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-be-typecard-choose]');
    const role = btn?.dataset.beTypecardChoose as FontRole | undefined;
    if (!btn || !role) return;
    bedit.compareStage.openStage(role, btn);
  });
  // Beat 0's disclosure: the other three roles, revealed for good. No state is
  // stored - a fresh mount is a fresh first decision - and once the room is at
  // beat 1 the sentence and its button are gone anyway.
  bedit.ramps.$('[data-be-typemore-toggle]')?.addEventListener('click', () => {
    typePanel?.setAttribute('data-be-more', 'on');
    announce(t('Headings, code and italic are now on the page.'));
  });
  bedit.ramps.$('[data-be-typestage-pinrow]')?.addEventListener('click', (e) => {
    const chip = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-be-pin]');
    const family = chip?.dataset.bePin;
    if (!family || !bedit.stage) return;
    // Exactly what the search field's Preview does, minus the typing: one press
    // admits the card AND starts its load, and the consent dialog is what that
    // press asks (plan 182 section 6.4).
    bedit.stage.addCandidate({ kind: 'google', family });
  });
  bedit.ramps.$('[data-be-font-compare]')?.addEventListener('click', (e) => {
    bedit.compareStage.openStage(null, e.currentTarget as HTMLElement);
  });
  bedit.ramps.$('[data-be-typestage-close]')?.addEventListener('click', () => bedit.compareStage.closeStage());
  bedit.ramps.$('[data-be-typestage-search]')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const family = stageQ?.value.trim();
    if (!family || !bedit.stage) return;
    // A PREVIEW, not an install. The card appears already loading: the stage's
    // own `add()` starts it, and the consent dialog fires from inside that load,
    // so this one press is the press that asks (plan 182 section 6.1). Nothing
    // is stored until "Use this face".
    bedit.stage.addCandidate({ kind: 'google', family });
    if (stageQ) { stageQ.value = ''; stageQ.focus(); }
  });
  stageEl?.addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key !== 'Escape' || !bedit.stage) return;
    // Cancel, never commit. The specimen field answers Escape only while it has
    // an edit to cancel (it reverts the text and stops the key there); with
    // nothing to cancel the key bubbles to here and closes the stage, so the
    // field the stage opens on is not a place Escape stops working.
    e.stopPropagation();
    bedit.compareStage.closeStage();
  });
  bedit.ramps.$('[data-be-fonts]')?.addEventListener('click', async (e) => {
    const mp = (e.target as Element).closest<HTMLButtonElement>('[data-mp]');
    if (mp) { mp.disabled = true; try { await setPrimaryFont(fontsHost, mp.dataset.mp!); await bedit.type.paintFonts(); bedit.state.notify('type'); announce(tRaw('{family} is now your primary font', { family: mp.dataset.mp ?? '' })); } catch (err) { mp.disabled = false; bedit.roles.showFontErr(String((err as { message?: unknown })?.message ?? err)); } return; }
    const mono = (e.target as Element).closest<HTMLButtonElement>('[data-mono]');
    if (mono) { mono.disabled = true; try { await setMonoFont(fontsHost, mono.dataset.mono!); await bedit.type.paintFonts(); bedit.state.notify('type'); announce(tRaw('{family} now serves code & data', { family: mono.dataset.mono ?? '' })); } catch (err) { mono.disabled = false; bedit.roles.showFontErr(String((err as { message?: unknown })?.message ?? err)); } return; }
    const disp = (e.target as Element).closest<HTMLButtonElement>('[data-display]');
    if (disp) { disp.disabled = true; try { await setDisplayFont(fontsHost, disp.dataset.display!); await bedit.type.paintFonts(); bedit.state.notify('type'); announce(tRaw('{family} now serves h1/h2 headings', { family: disp.dataset.display ?? '' })); } catch (err) { disp.disabled = false; bedit.roles.showFontErr(String((err as { message?: unknown })?.message ?? err)); } return; }
    const ital = (e.target as Element).closest<HTMLButtonElement>('[data-italic]');
    if (ital) { ital.disabled = true; try { await setItalicFont(fontsHost, ital.dataset.italic!); await bedit.type.paintFonts(); bedit.state.notify('type'); announce(tRaw('{family} now serves italic text', { family: ital.dataset.italic ?? '' })); } catch (err) { ital.disabled = false; bedit.roles.showFontErr(String((err as { message?: unknown })?.message ?? err)); } return; }
    const del = (e.target as Element).closest<HTMLButtonElement>('[data-del]'); if (!del) return;
    const fam = bedit.fontFamilies.find(f => f.family === del.dataset.del); if (!fam) return;
    const ok = await confirmDialog({
      title: tRaw('Remove {family}?', { family: fam.family }),
      message: fam.primary
        ? tRaw('Its font files ({size}) are deleted from this device and the next font becomes primary.', { size: fmtBytes(fam.bytes) })
        : tRaw('Its font files ({size}) are deleted from this device.', { size: fmtBytes(fam.bytes) }),
      confirmLabel: t('Remove'),
    });
    if (!ok) return; del.disabled = true;
    try {
      await removeUserFont(fontsHost, fam);
      // A removed face can't keep any role it served.
      if (fam.family === bedit.monoFamily) await setMonoFont(fontsHost, null).catch(() => {});
      if (fam.family === bedit.displayFamily) await setDisplayFont(fontsHost, null).catch(() => {});
      if (fam.family === bedit.italicFamily) await setItalicFont(fontsHost, null).catch(() => {});
      await bedit.type.paintFonts(); bedit.state.notify('type');
    } catch (err) { del.disabled = false; bedit.roles.showFontErr(String((err as { message?: unknown })?.message ?? err)); }
  });

  // ── Logos (the Logos room) ───────────────────────────────────────────────────
  // Identity sections (a brand can carry several distinct logos), each holding
  // the canonical orientation × treatment matrix plus user-named custom marks
  // ("icon", "crest", …). Each slot is a drop/upload tile: empty → "Add",
  // filled → the mark on a chip themed to its treatment (reverse on dark, mono
  // on neutral) with a Replace/Remove pair. Stored as user assets via
  // brand-logos.ts; every slot optional.
  const logoErr = bedit.ramps.$('[data-be-logo-err]') as HTMLElement | null; bedit.logoErr = logoErr;
}

export function compareStageOps(bedit: BrandEditorCtx) {
  return {
    setStageErr: bindOp(bedit, setStageErr),
    narrowStrip: bindOp(bedit, narrowStrip),
    placeStage: bindOp(bedit, placeStage),
    closeStage: bindOp(bedit, closeStage),
    applyTypeChoice: bindOp(bedit, applyTypeChoice),
    seedStageFromTray: bindOp(bedit, seedStageFromTray),
    paintStagePins: bindOp(bedit, paintStagePins),
    openStage: bindOp(bedit, openStage),
    wireTypeCards: bindOp(bedit, wireTypeCards),
  };
}
