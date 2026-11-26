// SPDX-License-Identifier: MPL-2.0
/**
 * The note that tells a person what happened to a file they dropped while Lolly was
 * still loading. lib/drop-early.ts decides; this only shows the outcome, in plain words.
 *
 * One note at a time, bottom centre, in the floating cluster (lib/float-cluster.ts) so
 * it shows over the Loading card. While a drop waits the note stays up. A short wait
 * comes first, so a drop the page takes within a moment never flashes a note. A refusal
 * or a drop that was not opened stays for a few seconds, then the note goes, or shows
 * the waiting drop again. It is a status region, so a screen reader reads each change.
 * It rises in; under reduced motion it simply appears (styles/parts/job-toast.css).
 */
import { getFloatCluster } from './float-cluster.ts';
import { tRaw } from '../i18n.ts';
import type { DropNote } from './drop-early.ts';

/** How long a drop waits before the note says it is waiting. */
export const HELD_NOTE_DELAY_MS = 400;
/** How long a refusal, or a drop that was not opened, stays on screen. */
export const OUTCOME_NOTE_MS = 8000;

let el: HTMLElement | null = null;
let showTimer: ReturnType<typeof setTimeout> | undefined;
let outcomeTimer: ReturnType<typeof setTimeout> | undefined;
/** What the note reads while a drop waits, or '' when none does. */
let waitingText = '';

/** One file by its name, several by their count. */
function what(files: string[]): string {
  return files.length === 1 ? files[0] ?? '' : tRaw('{n} files', { n: files.length });
}

/** The words for a note. Pure, so every outcome's wording is tested. */
export function dropNoteText(note: DropNote): string {
  switch (note.kind) {
    case 'held': return tRaw('Still loading. Lolly will open {file} when this page is ready.', { file: what(note.files) });
    case 'busy': return tRaw('Lolly will open {held} first. Drop {file} again after that.', { held: what(note.held), file: what(note.files) });
    case 'left': return tRaw('Lolly did not open {file}, because you left the page before it had loaded. Drop the file again to open it here.', { file: what(note.files) });
    case 'failed': return tRaw('Lolly did not open {file}, because the page did not finish loading.', { file: what(note.files) });
    case 'unclaimed': return tRaw('Nothing on this page can open {file}.', { file: what(note.files) });
    case 'done': return '';
  }
}

function render(text: string): void {
  if (!text) { el?.remove(); return; }
  if (!el) {
    el = document.createElement('div');
    el.className = 'drop-hold-note';
    el.setAttribute('role', 'status');
  }
  if (!el.isConnected) getFloatCluster().appendChild(el);
  el.textContent = text;
}

/** Show what happened to a held drop. */
export function showDropHoldNote(note: DropNote): void {
  clearTimeout(showTimer);
  if (note.kind === 'held') {
    waitingText = dropNoteText(note);
    if (!outcomeTimer) showTimer = setTimeout(() => render(waitingText), HELD_NOTE_DELAY_MS);
    return;
  }
  if (note.kind === 'done') {
    waitingText = '';
    if (!outcomeTimer) render('');
    return;
  }
  // A refusal leaves the earlier drop waiting; the other outcomes end the wait.
  if (note.kind !== 'busy') waitingText = '';
  clearTimeout(outcomeTimer);
  render(dropNoteText(note));
  outcomeTimer = setTimeout(() => { outcomeTimer = undefined; render(waitingText); }, OUTCOME_NOTE_MS);
}
