// SPDX-License-Identifier: MPL-2.0
/**
 * profile: what one Available-offline part row says and which of its buttons show.
 *
 * Pure (strings through t(), no DOM), so the row states are tested without
 * mounting Profile; offline.ts applies the result to the row's elements.
 */
import { t } from '../../i18n.ts';
import { isTauriShell } from '../../lib/instance-choice.ts';
import { fmtBytes } from '../../lib/format.ts';
import type { PartRecord } from '../../lib/offline-manager.ts';

export interface PartRowInput {
  /** The AI policy allows this part (always true for non-model parts). */
  allowed: boolean;
  /** The server or model host can serve it. */
  available: boolean;
  /** The recorded download, if one completed. */
  rec?: PartRecord;
  /** The recorded download is behind the live manifest (or scope). */
  stale: boolean;
  /** The files are on this device without a record (fetched on first use). */
  ready: boolean;
  /** Bytes still to download; 0 when unknown, and then no size is printed. */
  planned: number;
  /** The catalogue row words a stale record as a changed selection. */
  catalog?: boolean;
  /** Why the last download of this part did not finish, said on the row until
   *  the next try (offline.ts words it from the error). */
  failure?: string;
}

export interface PartRowState {
  sub: string;
  dl: { hidden: boolean; text: string; disabled: boolean };
  rm: { hidden: boolean };
  /** The row line is a failure, painted as one. */
  error?: boolean;
}

export function partRowState(i: PartRowInput): PartRowState {
  if (!i.allowed) {
    return { sub: t('AI downloads are disabled by your service policy.'), dl: { hidden: true, text: t('Download'), disabled: false }, rm: { hidden: !i.rec } };
  }
  if (i.rec) {
    // An update needs the server too; without it the row keeps what is on disk.
    const stale = i.stale && i.available;
    if (stale && i.failure) return { sub: i.failure, dl: { hidden: false, text: t('Try again'), disabled: false }, rm: { hidden: false }, error: true };
    return {
      sub: stale
        ? (i.catalog ? t('Selection changed · download to update') : t('Downloaded · update available'))
        : t('Downloaded · {size} on disk', { size: fmtBytes(i.rec.bytes) }),
      dl: { hidden: false, text: stale ? t('Update') : t('Downloaded'), disabled: !stale },
      rm: { hidden: false },
    };
  }
  // Fetched the first time a feature needed it: already here, so no Download.
  if (i.ready) {
    return { sub: isTauriShell() ? t('On this device') : t('In this browser'), dl: { hidden: false, text: t('Downloaded'), disabled: true }, rm: { hidden: false } };
  }
  if (!i.available) {
    return { sub: t('Not available to download here'), dl: { hidden: true, text: t('Download'), disabled: false }, rm: { hidden: true } };
  }
  // A download that did not finish says why on the row, not only in a passing
  // toast or the console (a user report, 2026-10-19).
  if (i.failure) return { sub: i.failure, dl: { hidden: false, text: t('Try again'), disabled: false }, rm: { hidden: true }, error: true };
  return {
    sub: i.planned > 0 ? fmtBytes(i.planned) : '',
    dl: { hidden: false, text: t('Download'), disabled: false },
    rm: { hidden: true },
  };
}
