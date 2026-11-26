// SPDX-License-Identifier: MPL-2.0
/**
 * Brand Studio's journal of an edit that has not finished saving. The rules and the
 * reasons live in lib/design-system/edit-journal.ts; this module wires them into the
 * editor:
 *
 * - `prepare`, from loadDocument before anything renders, works out which design system
 *   the saves go to, drops entries nobody will come back for, and replays or holds back
 *   what a closed tab left behind. A replayed document is the one the studio shows.
 * - `record`, from persist, puts the newest document in the journal at once, with the
 *   edit's writer stamp. The save of the same edit puts that stamp on the stored head.
 * - `saved`, after a save has written, moves the base on, and clears the entry when the
 *   newest edit is the one saved.
 * - `afterMount` saves a replayed document the normal way and shows the choice for an
 *   entry the stored document has moved on from: "Restore your unsaved changes" or
 *   "Keep the saved version". Nothing is written over the stored document until the
 *   person picks, and both stay until then.
 *
 * `prepare` reads the stamp on the stored head, so an entry its own page made after its
 * last save is replayed like any other unsaved edit, not offered as a choice: the base
 * such an entry carries can be the one from before that save (see edit-journal.ts).
 *
 * A locked or managed design system never mounts the editor, and is never journalled.
 */
import { DEFAULT_DESIGN_SYSTEM_ID } from '@lolly/engine';
import { JOURNAL_WRITER_META } from '../../bridge/tokens.ts';
import { t, tRaw } from '../../i18n.ts';
import { announce } from '../../a11y.ts';
import { withLogoGroupFrom } from '../brand-logos.ts';
import {
  docHash, heldJournalTabs, journalSlot, journalTabIds, mintJournalTab, nextWriterStamp, parseWriterStamp, planRecovery, readEntries,
  startEditJournal, sweepJournal,
} from '../design-system/edit-journal.ts';
import type { JournalEntry, JournalStore, WriterStamp } from '../design-system/edit-journal.ts';
import { bindOp } from './context.ts';
import type { BrandEditorCtx } from './context.ts';

type Item = { slot: string; entry: JournalEntry };

/** The id an edit is saved under on a device with no design-system registry (a legacy single head). */
const LEGACY_SYSTEM = 'user';

function tabStorage(): Storage | null {
  try { return globalThis.sessionStorage ?? null; } catch { return null; }
}

/**
 * The design system an edit is saved to: the active one, or the person's own default
 * when the active one is the shipped brand, since the first edit of the shipped brand
 * creates that default.
 */
async function targetSystem(bedit: BrandEditorCtx): Promise<{ id: string; locked: boolean; present: string[] }> {
  const summary = await bedit.tokens?.active().catch(() => null) ?? null;
  const list = await bedit.tokens?.list().catch(() => []) ?? [];
  const id = !summary ? LEGACY_SYSTEM : summary.source === 'shipped' ? DEFAULT_DESIGN_SYSTEM_ID : summary.id;
  return { id, locked: bedit.locked || !!summary?.locked, present: [...list.map(s => s.id), DEFAULT_DESIGN_SYSTEM_ID, LEGACY_SYSTEM] };
}

/** The writer stamp on the stored head's record, or null when it carries none. */
async function storedStamp(bedit: BrandEditorCtx): Promise<WriterStamp | null> {
  try {
    const id = await bedit.tokens?.headId();
    const assets = bedit.host.assets as { _getUserRecord?(id: string): Promise<{ meta?: Record<string, unknown> } | null> };
    if (!id || !assets._getUserRecord) return null;
    return parseWriterStamp((await assets._getUserRecord(id))?.meta?.[JOURNAL_WRITER_META]);
  } catch { return null; }
}

/**
 * Before the studio shows `stored`, recover what a closed tab left and start this
 * tab's journal. Returns the document to show: a replayed edit, or `stored` unchanged.
 */
export async function prepare(bedit: BrandEditorCtx, stored: Record<string, unknown> | null): Promise<Record<string, unknown> | null> {
  bedit.editJournal = null;
  bedit.journalChoices = [];
  bedit.journalReplayed = false;
  const store: JournalStore = bedit.host.state;
  try {
    const target = await targetSystem(bedit);
    if (target.locked) return stored;
    const held = await heldJournalTabs();
    const storage = tabStorage();
    const ids = journalTabIds(storage, held);
    await sweepJournal(store, { systems: target.present });
    const entries = await readEntries(store, target.id);
    const own = new Set([ids.tab, ...(ids.previous ? [ids.previous] : [])]);
    const plan = await planRecovery(store, entries, {
      storedDoc: stored, liveTabs: held, ownTabs: own, locked: false, storedStamp: await storedStamp(bedit),
      effective: (doc, from) => withLogoGroupFrom(doc, from),
    });
    // An entry left waiting on a choice keeps its slot: this page journals under a new id.
    const tab = plan.choices.some(c => c.entry.tab === ids.tab) ? mintJournalTab(storage) : ids.tab;
    bedit.journalSlotId = journalSlot(target.id, tab);
    bedit.editJournal = startEditJournal(store, {
      system: target.id, tab, base: await docHash(stored),
      win: typeof window === 'undefined' ? undefined : window,
      locks: globalThis.navigator?.locks,
    });
    bedit.journalChoices = plan.choices;
    if (!plan.replay) return stored;
    bedit.journalReplayed = true;
    const doc = structuredClone(plan.replay.entry.doc);
    // The replayed edit is this tab's now: written under this tab first, then the old
    // entry goes, so there is no moment with neither.
    bedit.editJournal.record(doc, nextWriterStamp());
    if (plan.replay.slot !== bedit.journalSlotId) {
      await bedit.editJournal.idle();
      await store.delete(plan.replay.slot).catch(() => {});
    }
    return doc;
  } catch {
    // The journal is a safety net: without it the studio opens as it always did.
    return stored;
  }
}

/** The newest document goes to the journal at once (persist calls this on every edit). */
export function record(bedit: BrandEditorCtx, stamp: WriterStamp): void {
  if (bedit.editJournal && bedit.doc) bedit.editJournal.record(bedit.doc, stamp);
}

/**
 * A save of revision `revision` wrote `written`. Later edits now build on it; when no
 * later edit is waiting, the entry has nothing left to keep.
 */
export async function saved(bedit: BrandEditorCtx, revision: number, written: unknown): Promise<void> {
  const journal = bedit.editJournal;
  if (!journal) return;
  const base = await docHash(written);
  journal.setBase(base);
  if (revision === bedit.saveRevision) journal.clear();
}

/**
 * The stored document was replaced outside the editor's own saves (an imported pack)
 * and the editor now shows the new document. Later edits start from that, and an older entry has
 * nothing left to keep, unless an edit arrived while the hash was worked out.
 */
export async function rebase(bedit: BrandEditorCtx, doc: unknown): Promise<void> {
  const journal = bedit.editJournal;
  if (!journal) return;
  const revision = bedit.saveRevision;
  journal.setBase(await docHash(doc));
  if (bedit.saveRevision === revision) journal.clear();
}

/** When the edit was made, in the reader's own words for a date and a time. */
function when(at: number): string {
  try {
    const lang = document.documentElement.lang || undefined;
    return new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short' }).format(at);
  } catch { return new Date(at).toLocaleString(); }
}

function button(label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'be-btn';
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

/** The card for one entry the stored document has moved on from. */
function choiceCard(bedit: BrandEditorCtx, item: Item): HTMLElement {
  const card = document.createElement('section');
  card.className = 'be-journal';
  card.dataset.beJournal = '';
  const title = document.createElement('h3');
  title.className = 'be-journal-title';
  title.id = `be-journal-${item.entry.at.toString(36)}`;
  title.textContent = t("Changes that didn't finish saving");
  card.setAttribute('aria-labelledby', title.id);
  const body = document.createElement('p');
  body.className = 'be-journal-body';
  body.textContent = tRaw('You made these changes on {time}, and the page closed before they were saved. This design system has been saved again since then, in another tab or by a sync.', { time: when(item.entry.at) });
  const actions = document.createElement('div');
  actions.className = 'be-journal-actions';
  const restoreBtn = button(t('Restore your unsaved changes'), () => { restore(bedit, item); });
  restoreBtn.dataset.beJournalRestore = '';
  const keepBtn = button(t('Keep the saved version'), () => { void keep(bedit, item); });
  keepBtn.dataset.beJournalKeep = '';
  actions.append(restoreBtn, keepBtn);
  const hint = document.createElement('p');
  hint.className = 'be-journal-hint';
  hint.textContent = t('Restoring replaces the version saved since. Keeping the saved version deletes the unsaved changes from this device.');
  card.append(title, body, actions, hint);
  return card;
}

/** Show the next entry waiting on a choice, or nothing when none is left. */
function showNext(bedit: BrandEditorCtx): void {
  bedit.journalCard?.remove();
  bedit.journalCard = null;
  const item = bedit.journalChoices.shift();
  if (!item || !bedit.root.isConnected) return;
  const card = choiceCard(bedit, item);
  const slot = bedit.opts.journalSlot?.() ?? null;
  if (slot) slot.prepend(card);
  else bedit.root.prepend(card);
  bedit.journalCard = card;
}

/** Drop an entry that is not this tab's live one. */
async function dropEntry(bedit: BrandEditorCtx, item: Item): Promise<void> {
  if (item.slot === bedit.journalSlotId) return;
  await bedit.editJournal?.idle();
  await bedit.host.state.delete(item.slot).catch(() => {});
}

/** Put the unsaved document back and save it over the newer one. Undo returns to the saved version. */
function restore(bedit: BrandEditorCtx, item: Item): void {
  bedit.state.pushUndo(t('Restore your unsaved changes'));
  bedit.doc = structuredClone(item.entry.doc);
  bedit.derive.reseedFromDoc();
  bedit.swatchEditor.closeEditor();
  bedit.palSelect.exitPalSelect();
  bedit.ramps.repaintPalette();
  bedit.state.persist(true);
  announce(t('Restored your unsaved changes.'));
  void dropEntry(bedit, item);
  showNext(bedit);
}

/** Keep what is stored: the unsaved document goes from this device. */
async function keep(bedit: BrandEditorCtx, item: Item): Promise<void> {
  showNext(bedit);
  announce(t('Kept the saved version.'));
  await dropEntry(bedit, item);
}

/** After the studio has rendered: save a replayed edit, or ask about one that cannot be replayed. */
export function afterMount(bedit: BrandEditorCtx): void {
  if (bedit.journalReplayed) {
    bedit.journalReplayed = false;
    bedit.state.persist(true);
    announce(t("Restored the changes that hadn't finished saving."));
    try { bedit.opts.onJournalRestored?.(); } catch { /* the host's note is a courtesy */ }
  }
  showNext(bedit);
  bedit.cleanups.push(() => {
    bedit.journalCard?.remove();
    bedit.journalCard = null;
    bedit.editJournal?.dispose();
  });
}

export function journalOps(bedit: BrandEditorCtx) {
  return {
    prepare: bindOp(bedit, prepare),
    record: bindOp(bedit, record),
    saved: bindOp(bedit, saved),
    rebase: bindOp(bedit, rebase),
    afterMount: bindOp(bedit, afterMount),
  };
}
