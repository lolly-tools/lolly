// SPDX-License-Identifier: MPL-2.0
/**
 * Saved-session record envelope - the version stamps a shell's state bridge
 * writes for one saved tool session, and the migrate-or-warn branch it runs on
 * load.
 *
 * A session record (IndexedDB row on web, `$APPDATA/Lolly/saved-state/<slot>.json`
 * on the Tauri shells) is:
 *
 *   { slot, toolId, toolVersion, label, data, preview, updatedAt,
 *     formatVersion, engineVersion }
 *
 * (`preview` is a picture reference from format 5; older records carry the
 * picture itself as a `thumb` data URL, which readers still accept.)
 *
 * `formatVersion` is the record LAYOUT version (bump on any change to the fields
 * or their shape). `engineVersion` is the running engine that wrote it - a
 * breadcrumb for a future migration that needs to know which engine's data
 * conventions produced the record. The engine owns both the constant and the
 * migrate-or-warn branch so the three bridges (web + desktop + mobile) cannot
 * drift - the same discipline data-transfer.ts applies to the portable-backup
 * envelope, applied here to the per-session record.
 *
 * This is the hook the state.ts header always promised ("the runtime can decide
 * whether to migrate or warn the user") but never had: records written before
 * this shipped carry no `formatVersion`, so migrateSessionRecord treats a
 * missing one as version 0. The v0→v1 step is a no-op on the data (v1 only ADDED
 * the stamps), but the branch now EXISTS, so a genuinely breaking 1.1 change has
 * somewhere to stand instead of guessing at every unversioned file forever.
 */

import type { RightsDecisionV1 } from '@lolly-tools/core/rights-v1';
import { ENGINE_VERSION } from './version.ts';
import { readPreviewRef, type SessionPreviewRef } from './session-preview.ts';

export type { SessionPreviewRef } from './session-preview.ts';

/** The record LAYOUT this build writes. Bump on any change to the record shape.
 *  v2 (engine 1.173, plans/186): the optional `designSystem: { id, label }` stamp,
 *  which design system the session was made with. Additive - a v1 reader ignores
 *  it and a v2 reader treats its absence as "unknown".
 *  v3 (plans/252): the optional `emoji: { emoji, emojifx }` stamp, which emoji set
 *  and brand treatment the session's text was drawn with. Additive in the same way:
 *  an older reader ignores it, and a v3 reader treats its absence as "the person's
 *  own preference decides", exactly as a session saved before this existed.
 *  v4 (plans/253): the optional `rightsDecisions` list, the licence choices and
 *  recorded permissions a person made about the sources in this document. Additive
 *  again: an older reader ignores it, and a v4 reader treats its absence as "no
 *  choice was recorded", which is what the evaluator assumes anyway.
 *  v5 (plan 373): the optional `preview` reference, `{ key, type, width, height }`
 *  plus the route that drew the picture, in place of the `thumb` data URL. The
 *  picture bytes live once in the shell's preview store, keyed by their hash, so
 *  a list of sessions reads no picture. Additive like the others: `thumb` stays in
 *  the layout as a legacy field, an older reader ignores `preview` (and shows the
 *  tool icon where no `thumb` is left), and a v5 reader reads `thumb` when a
 *  record has no `preview`. */
export const SESSION_FORMAT_VERSION = 5;

/** The newest record layout this build knows how to read. A record is readable
 *  when its `formatVersion` is ≤ this; a higher one is from a newer app. */
export const SESSION_READER_VERSION = 5;

/**
 * Which emoji artwork a saved session was made with: the two reserved URL params
 * verbatim (`emoji=<id>@<version>`, `emojifx=<treatment>`), so reopening the
 * session resolves the same set through the same parser a link does. Deliberately
 * not the resolved style: a set's bytes belong to the device that holds them, and
 * a stamp that named a checksum could not be reopened on a device that has a
 * different build of the same set.
 */
export interface SessionEmojiStamp {
  emoji: string;
  emojifx: string;
  emojistyle?: string;
}

export interface SessionVersionStamp {
  formatVersion: number;
  engineVersion: string;
}

/** The two version fields a state bridge spreads into every record it writes. */
export function sessionVersionStamp(): SessionVersionStamp {
  return { formatVersion: SESSION_FORMAT_VERSION, engineVersion: ENGINE_VERSION };
}

/** A record as read back from storage - untrusted shape, version fields optional.
 *  Only the fields the migrate-or-warn branch reads are named (no index
 *  signature, so a shell's concrete record type stays assignable here). */
export interface StoredSessionRecord {
  slot?: unknown;
  formatVersion?: unknown;
  engineVersion?: unknown;
  data?: unknown;
  emoji?: unknown;
  rightsDecisions?: unknown;
  preview?: unknown;
}

/** The decision kinds a record may carry. An `acknowledged` decision records that
 *  a warning was seen and resolves nothing, which is why it is kept apart from the
 *  two that do. */
const DECISION_KINDS = new Set(['output-licence', 'separate-permission', 'acknowledged']);

/**
 * The licence decisions off a stored record, or null when it carries none or
 * carries junk. Total over untrusted rows, like the emoji stamp above: a
 * malformed entry is dropped rather than throwing, an entry with no work or no
 * kind is not a decision, and an empty result reads as "nothing was recorded".
 *
 * Bounded on purpose. A record is device-local but it is also what a `.lolly`
 * file and a restored backup carry, so the reader never trusts the length or the
 * field sizes of what it was handed.
 */
export function sessionRightsDecisions(record: StoredSessionRecord | null | undefined): RightsDecisionV1[] | null {
  const raw = record?.rightsDecisions;
  if (!Array.isArray(raw)) return null;
  // Keyed by work and kind, keeping the last, so a stored array that named one
  // work twice cannot let its own order decide which choice applies. The key
  // goes through JSON because a work id is arbitrary text out of an untrusted
  // record, and a key glued together with a separator could be made to collide.
  const out = new Map<string, RightsDecisionV1>();
  for (const entry of raw.slice(0, 200)) {
    if (!entry || typeof entry !== 'object') continue;
    const { work, kind, licence, note, fingerprint, recordedAt } = entry as Record<string, unknown>;
    if (typeof work !== 'string' || !work.trim()) continue;
    if (typeof kind !== 'string' || !DECISION_KINDS.has(kind)) continue;
    const decision: RightsDecisionV1 = { work: work.slice(0, 300), kind: kind as RightsDecisionV1['kind'] };
    if (typeof fingerprint === 'string' && fingerprint) decision.fingerprint = fingerprint.slice(0, 200);
    if (typeof licence === 'string' && licence) decision.licence = licence.slice(0, 200);
    if (typeof note === 'string' && note) decision.note = note.slice(0, 2000);
    if (typeof recordedAt === 'string' && recordedAt) decision.recordedAt = recordedAt.slice(0, 40);
    out.set(JSON.stringify([decision.work, decision.kind]), decision);
  }
  return out.size ? [...out.values()] : null;
}

/** The emoji stamp off a stored record, or null when it carries none or carries
 *  junk. Total over untrusted rows: a malformed stamp reads as absent, never
 *  throws, and never half-applies. */
export function sessionEmojiStamp(record: StoredSessionRecord | null | undefined): SessionEmojiStamp | null {
  const stamp = record?.emoji;
  if (!stamp || typeof stamp !== 'object') return null;
  const { emoji, emojifx, emojistyle } = stamp as { emoji?: unknown; emojifx?: unknown; emojistyle?: unknown };
  if (typeof emoji !== 'string' || !emoji.trim()) return null;
  return { emoji: emoji.trim(), emojifx: typeof emojifx === 'string' ? emojifx.trim() : '', ...(typeof emojistyle === 'string' ? { emojistyle } : {}) };
}

/** The picture reference off a stored record (format 5), or null when it carries
 *  none or carries junk. Total over untrusted rows like the stamps above: the key
 *  must be 32 hex characters, the type one of the picture types and the sizes
 *  whole numbers in range, or the reference reads as absent. */
export function sessionPreviewRef(record: StoredSessionRecord | null | undefined): SessionPreviewRef | null {
  return readPreviewRef(record?.preview);
}

export type SessionLogger = (
  level: 'warn' | 'info',
  message: string,
  meta?: Record<string, unknown>,
) => void;

/**
 * The migrate-or-warn branch every state bridge runs on load. Reads a parsed
 * record's version stamps and returns its `data` - migrating forward when the
 * record predates the current layout, and warning (never throwing) when it comes
 * from a newer build than this one understands.
 *
 * Deliberately non-destructive: a future-versioned record is still read as-is
 * (losing a user's session is worse than reading it optimistically), it's just
 * reported. Returns null only when there is genuinely no session data to load.
 */
export function migrateSessionRecord(
  record: StoredSessionRecord | null | undefined,
  log?: SessionLogger,
): object | null {
  if (!record || typeof record !== 'object') return null;
  const data = record.data;
  if (data == null || typeof data !== 'object') return null;

  const raw = record.formatVersion;
  const fromVersion = typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;

  if (fromVersion > SESSION_READER_VERSION) {
    log?.('warn', 'saved session was written by a newer version of the app - reading it as-is', {
      slot: record.slot,
      recordFormatVersion: fromVersion,
      readerFormatVersion: SESSION_READER_VERSION,
    });
    return data as object;
  }

  // fromVersion ≤ current: migrate forward, step by step. The v0→v1 (add-stamps),
  // v1→v2 (add the design-system stamp), v2→v3 (add the emoji stamp), v3→v4
  // (add the recorded licence decisions) and v4→v5 (a picture reference beside or
  // in place of the thumbnail) steps are all additive and no-ops on the data, so
  // there is nothing to transform yet. The picture is not part of `data`, so v5
  // never touches what this returns. A v2 record simply has no emoji
  // stamp, which reads as "no set was chosen when this was saved" - the same
  // answer it gave before the stamp existed, and a v3 record carries no recorded
  // decision, which is what the evaluator assumes of any session. Future breaking
  // steps slot in here, e.g.:
  //   if (fromVersion < 6) { /* v5 → v6: reshape data */ }
  return data as object;
}
