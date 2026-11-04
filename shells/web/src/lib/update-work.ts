// SPDX-License-Identifier: MPL-2.0
import { tRaw } from '../i18n.ts';
import { resourceJobs } from './jobs.ts';
import { publishNotification } from './notifications.ts';

import { documents, lockUpdateWrites, hasActiveUpdateWork, settleUpdateWork, drainUpdateWrites, type UpdateDocument } from './update-work-state.ts';
export { registerUpdateDocument, trackUpdateWrite } from './update-work-state.ts';
let protecting: Promise<boolean> | undefined;

function report(message: string, recovery = false): false {
  const recover = recovery ? [...documents].find(doc => doc.recover)?.recover : undefined;
  publishNotification({ id: 'desktop-update-work', title: tRaw('App updates'), body: message, tone: 'warning', action: recover ? { label: tRaw('Save a copy'), run: recover } : undefined });
  return false;
}
const choose = (doc: UpdateDocument): Promise<boolean> => doc.choose?.() ?? Promise.resolve(false);
export function protectUpdateWork(): Promise<boolean> {
  if (protecting) return protecting;
  protecting = (async () => {
    try {
      const outcome = await settleUpdateWork({ documents: () => [...documents], busy: () => hasActiveUpdateWork() || resourceJobs().length > 0,
        drain: drainUpdateWrites, choose });
      if (outcome === 'busy') return report(tRaw('Finish recording or exporting before updating.'));
      if (outcome === 'save') return report(tRaw('Save could not finish. Save a recovery copy before updating.'), true);
      if (outcome !== 'ready') return false;
      lockUpdateWrites(true);
      document.body.inert = true;
      return true;
    } catch { return report(tRaw('Save could not finish. Save a recovery copy before updating.'), true); }
    finally { protecting = undefined; }
  })();
  return protecting;
}
export function releaseUpdateWork(): void { lockUpdateWrites(false); document.body.inert = false; }
