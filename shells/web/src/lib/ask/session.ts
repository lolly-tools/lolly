// SPDX-License-Identifier: MPL-2.0
/**
 * The Ask transcript store (plans/103 M0).
 *
 * Session memory only - a module-level array, deliberately not persisted. The
 * conversation survives a spotlight → #/ask re-ask round-trip and a Back into the
 * view (the view re-reads it on mount and appends), but dies on a page reload.
 * That is the v1 contract: no history, no storage, nothing to clear.
 */
import type { AskAnswer } from './answer.ts';

/** A question the user asked (raw text, as typed). */
export interface AskUserTurn { role: 'user'; q: string }
/** The answer assembled for the preceding question. */
export interface AskAnswerTurn { role: 'answer'; answer: AskAnswer }
export type AskTurn = AskUserTurn | AskAnswerTurn;

let turns: AskTurn[] = [];

/** The transcript so far (newest last). */
export function askSession(): readonly AskTurn[] {
  return turns;
}

/** Append one turn. */
export function pushTurn(turn: AskTurn): void {
  turns.push(turn);
}

/** The raw text of the last question asked, or null if none. */
export function lastAskedQuestion(): string | null {
  for (let i = turns.length - 1; i >= 0; i--) {
    if (turns[i]!.role === 'user') return (turns[i] as AskUserTurn).q;
  }
  return null;
}

/** Test seam / hard reset - drop the whole transcript. */
export function resetAskSession(): void {
  turns = [];
}
