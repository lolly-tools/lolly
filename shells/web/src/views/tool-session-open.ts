// SPDX-License-Identifier: MPL-2.0
import type { StateAPI } from '@lolly-tools/core/host-v1';
import type { InputValue } from '../../../../engine/src/inputs.ts';
import type { UrlState } from '../../../../engine/src/url-mode.ts';
import { migrateSessionRecord, sessionEmojiStamp, sessionRightsDecisions } from '../../../../engine/src/session-record.ts';
import type { SessionEmojiStamp } from '../../../../engine/src/session-record.ts';
import type { RightsDecisionV1 } from '@lolly-tools/core/rights-v1';
import type { WebStateAPI } from '../bridge/state.ts';
import type { RevisionCursor } from '../bridge/revision-records.ts';
import { getCollabSessionSource } from '../lib/collab-session-source.ts';
import { localHistorySlot } from './tool-revision-history.ts';
import { historyParticipation, type HistoryManifest } from './tool-history-adapters.ts';
import { migrateCarouselToFrames } from './free-canvas-math.ts';

/** A resumed local document uses its durable inputs, row IDs and settings. The
 * address bar can be lossy or behind the last completed recovery write. Explicit
 * links retain their overrides; collaboration keeps its carried/memory path. */
export async function openToolSession(state: StateAPI, manifest: HistoryManifest, url: UrlState, carriedSlot?: string | null): Promise<{
  url: UrlState; values: Record<string, InputValue>; cursor?: RevisionCursor; emoji?: SessionEmojiStamp;
  rightsDecisions?: RightsDecisionV1[];
}> {
  const toolId = manifest.id;
  const shared = !!getCollabSessionSource();
  const remembered = !shared && !url.slot && !carriedSlot ? localHistorySlot(state, manifest) : undefined;
  const slot = url.slot ?? carriedSlot ?? remembered;
  if (!slot) return { url, values: url.values };
  const history = !shared ? (state as WebStateAPI).history : undefined;
  const opened = history ? await history.open(slot) : undefined;
  let saved = opened ? migrateSessionRecord(opened.record, (level, message, meta) => console.warn(`[lolly:state] ${level}: ${message}`, meta)) : await state.load(slot);
  // A retired carousel-maker session redirects into Design. Keep the existing
  // migration before runtime creation, including on hosts without history.
  if (saved && toolId === 'design') saved = migrateCarouselToFrames(saved as Record<string, unknown>);
  // Explicit saves need refresh continuity even without automatic capture. Keep
  // the device-local slot out of share URLs; unrecorded URL edits still win on
  // tools without a recovery adapter.
  if (history && saved && url.slot) window.history.replaceState({ ...window.history.state,
    lollyHistory: { toolId, slot, explicit: true } }, '', location.href);
  const durable = remembered && historyParticipation(manifest, false).localHistory;
  const values = saved ? durable ? { ...url.values, ...saved } : { ...saved, ...url.values } : url.values;
  if (durable && saved) url = { ...url, values: {}, filename: null, format: null, width: null, height: null, unit: null, dpi: null, profile: null, bleed: null, marks: null };
  // Which emoji set this session was made with (plans/252). It lives on the
  // RECORD, not in the saved values, so it is read from the opened revision where
  // there is one and asked of the state bridge otherwise. A shell whose state has
  // no stamp reader simply has no stamp, and the open falls through to the
  // person's own preference - the same as a session saved before this existed.
  const emoji = sessionEmojiStamp({ emoji: (saved as Record<string, unknown> | null)?.__emoji })
    ?? sessionEmojiStamp(opened?.record as Parameters<typeof sessionEmojiStamp>[0])
    ?? (await (state as WebStateAPI).emojiStamp?.(slot).catch(() => null)) ?? null;
  // The licence choices made in this document (plan 253), read the same way and
  // for the same reason: a ShareAlike decision belongs to the document, so it
  // has to survive a reload rather than being asked for again on every export.
  const rightsDecisions = sessionRightsDecisions(opened?.record as Parameters<typeof sessionRightsDecisions>[0])
    ?? (await (state as WebStateAPI).rightsDecisions?.(slot).catch(() => null)) ?? null;
  return {
    url, values: values as Record<string, InputValue>,
    ...(opened ? { cursor: { head: opened.head, version: opened.version, unsaved: opened.unsaved === true,
      ...(opened.workingHash !== undefined ? { workingHash: opened.workingHash } : {}), ...(opened.adopt ? { adopt: true } : {}), ...(opened.neverSaved ? { neverSaved: true } : {}) } } : {}),
    ...(emoji ? { emoji } : {}),
    ...(rightsDecisions ? { rightsDecisions } : {}),
  };
}
