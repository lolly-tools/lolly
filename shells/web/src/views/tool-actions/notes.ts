// SPDX-License-Identifier: MPL-2.0
/**
 * actions bar: ingredient notes, detail asks and the file name placeholder.
 *
 * Every function takes the shared `ta: ActionsCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `ta.<module>.<fn>`. Extracted verbatim
 * from renderActions() by scripts/split-closure.ts.
 */
import { LEXICON_VERSION } from '@lolly/engine';
import { t, tRaw } from '../../i18n.ts';
import type { ProfileStore } from './shared.ts';
import { bindOp, type ActionsCtx } from './context.ts';

// Ingredient provenance note (plans/126 WP-B item 2): when this design's
// chosen ASSET ingredients carry an AI declaration or AI-writing signals,
// the export sheet says so in one hedged line each - the moment the file is
// about to travel is the moment the maker deserves the reminder. UI note
// only: nothing here changes what exports or what gets signed (the declared
// flag already rides as a C2PA ingredient on its own path). Computed at
// sheet-render time from top-level asset inputs; assets nested inside
// `blocks` groups are not walked here.
export async function fillIngredientNote(ta: ActionsCtx): Promise<void> {
  const { el, host, runtime } = ta;
  const slot = el?.querySelector<HTMLElement>('[data-ingredient-note]');
  if (!slot) return;
  const ids = [
    ...new Set(
      runtime
        .getModel()
        .filter((i) => i.type === 'asset' && typeof i.value === 'string' && i.value)
        .map((i) => String(i.value))
    ),
  ];
  if (!ids.length) return;
  const declared: string[] = [];
  const flagged: string[] = [];
  for (const id of ids) {
    try {
      const ref = await host.assets.get(id);
      const meta = (ref.meta ?? {}) as {
        name?: unknown;
        aiGenerated?: unknown;
        aiSignals?: { v?: number; band?: string };
      };
      const name = String(meta.name ?? id);
      if (meta.aiGenerated === 'full' || meta.aiGenerated === 'partial') declared.push(name);
      else if (
        meta.aiSignals &&
        meta.aiSignals.v === LEXICON_VERSION &&
        (meta.aiSignals.band === 'notable' || meta.aiSignals.band === 'strong')
      )
        flagged.push(name);
    } catch {
      /* a missing asset has nothing to disclose */
    }
  }
  if (!declared.length && !flagged.length) return;
  slot.replaceChildren();
  if (declared.length) {
    const line = document.createElement('p');
    line.className = 'guide-fact';
    line.textContent = tRaw(
      "AI-declared ingredient in this design: {names}. The export's own credential declares this AI origin, signed and machine-readable.",
      { names: declared.join(', ') }
    );
    slot.appendChild(line);
  }
  if (flagged.length) {
    const line = document.createElement('p');
    line.className = 'guide-hint';
    line.textContent = tRaw(
      'An ingredient carries AI-writing signals: {names}. A signal, not proof - review it in the catalogue before this file travels.',
      { names: flagged.join(', ') }
    );
    slot.appendChild(line);
  }
  slot.hidden = false;
}
// The provenance ask, at the moment it means something (plans/137 WP-E). A file
// has just been downloaded, so "should your details go into it?" is now a real
// question about a real file rather than a cold prompt at boot - which is why
// the gallery's personalize toast hands the ask over to here. One quiet line
// under the buttons of the sheet the user is already looking at: never a dialog,
// never over the shutter (that has reopened by now), never before the export.
// It shows at most once per profile because it writes the SAME
// personalizeNudgeDismissed flag the gallery toast reads, so whichever surface
// asks first retires the other. Best-effort throughout - a profile store that
// cannot be read or written costs nothing, the file has already reached the user.
export async function offerDetailsAsk(ta: ActionsCtx): Promise<boolean> {
  const { el, host } = ta;
  if (!el || el.querySelector('.export-details-ask')) return false;
  const store = host.profile as ProfileStore | undefined;
  if (!store?.get) return false;
  const current = await store.get();
  if (current.useDetails || current.personalizeNudgeDismissed) return false;
  const line = document.createElement('p');
  line.className = 'export-details-ask';
  line.textContent = t('Add your details to this file? They stay on this device.');
  const link = document.createElement('a');
  link.href = '#/profile?focus=use-details';
  link.textContent = t('Set up my details');
  line.append(' ', link);
  el.appendChild(line);
  await store.set?.({ ...current, personalizeNudgeDismissed: true });
  return true;
}
export function offerReopenNote(ta: ActionsCtx): void {
  const { REOPEN_NOTE_KEY, el } = ta;
  if (!el || el.querySelector('.export-details-ask')) return;
  try {
    if (localStorage.getItem(REOPEN_NOTE_KEY)) return;
    localStorage.setItem(REOPEN_NOTE_KEY, '1');
  } catch {
    return;
  }
  const line = document.createElement('p');
  line.className = 'export-details-ask';
  line.textContent = t(
    'This file remembers how it was made - drop it on Lolly anytime to reopen it.'
  );
  const link = document.createElement('a');
  link.href = '#/verify';
  link.textContent = t('See for yourself');
  line.append(' ', link);
  el.appendChild(line);
}
export const refreshFilenamePlaceholder = (ta: ActionsCtx): void => {
  const { filenameInputEl } = ta;
  if (filenameInputEl) filenameInputEl.placeholder = ta.formatRules.autoFilename();
};
export function notesOps(ta: ActionsCtx) {
  return {
    fillIngredientNote: bindOp(ta, fillIngredientNote),
    offerDetailsAsk: bindOp(ta, offerDetailsAsk),
    offerReopenNote: bindOp(ta, offerReopenNote),
    refreshFilenamePlaceholder: bindOp(ta, refreshFilenamePlaceholder),
  };
}
