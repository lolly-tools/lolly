// SPDX-License-Identifier: MPL-2.0
/**
 * actions bar: ingredient notes, detail asks and the file name placeholder.
 *
 * Every function takes the shared `ta: ActionsCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `ta.<module>.<fn>`. Extracted verbatim
 * from renderActions() by scripts/split-closure.ts.
 */
import { LEXICON_VERSION, designRecordCarrier } from '@lolly/engine';
import { t, tRaw } from '../../i18n.ts';
import { isAudioFormat as isAudioFmt } from '../../lib/audio-encode.js';
import { isTauriShell } from '../../lib/instance-choice.ts';
import { madeWithWords } from '../../lib/made-with.ts';
import { isC2paFmt, type ProfileStore } from './shared.ts';
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
      'An ingredient carries AI-writing signals: {names}. A signal, not proof - review it in Assets before this file travels.',
      { names: flagged.join(', ') }
    );
    slot.appendChild(line);
  }
  slot.hidden = false;
}
// ── The design-system record (plans/319) ───────────────────────────────────
//
// Andy approved on 2026-10-17 that an export records which design system and
// colourway made it, on the condition that the record is visible at the moment of
// export and named in the public docs. This card is the visible half: before the
// export it shows the exact words the file will carry ("Records: Acme · Colourway:
// Persimmon") and the description as it will read. Unticking the card sets the
// runtime's own switch, so every export from this sheet (download, copy, a ZIP's
// members) leaves the record out and keeps the plain description.

/** Paint the card from the runtime's preview. Hidden when there is nothing to record. */
export async function fillMadeWith(ta: ActionsCtx): Promise<void> {
  const section = ta.el?.querySelector<HTMLElement>('[data-madewith-section]');
  if (!section || !ta.hasMadeWith) return;
  const seq = (ta.madeWithSeq ?? 0) + 1;
  ta.madeWithSeq = seq;
  let preview: ActionsCtx['madeWithPreview'] = null;
  try {
    preview = await ta.runtime.madeWithPreview();
  } catch {
    preview = null;
  }
  if (seq !== ta.madeWithSeq) return;
  ta.madeWithPreview = preview;
  paintMadeWith(ta);
}

/**
 * Where the chosen format writes the record: its own metadata, only the credential
 * this export stamps, or nowhere (a text or data format with the credential off).
 */
function madeWithCarrier(ta: ActionsCtx): 'file' | 'credential' | null {
  const fmt = ta.formatEl?.value ?? ta.initialFmt ?? '';
  return designRecordCarrier(fmt, isC2paFmt(fmt) && ta.c2paEl?.checked === true);
}

/**
 * Write the card's two lines for the switch's current state and the chosen format.
 * Hidden when there is nothing to record, or when the format will carry none of it,
 * so the card never names words a file will not hold.
 */
export function paintMadeWith(ta: ActionsCtx): void {
  const section = ta.el?.querySelector<HTMLElement>('[data-madewith-section]');
  if (!section) return;
  const preview = ta.madeWithPreview;
  const carrier = madeWithCarrier(ta);
  if (!preview || !carrier) {
    section.hidden = true;
    return;
  }
  const on = ta.runtime.madeWith();
  const toggle = section.querySelector<HTMLInputElement>('[data-action="madewith"]');
  if (toggle) toggle.checked = on;
  const record = section.querySelector<HTMLElement>('[data-madewith-record]');
  const description = section.querySelector<HTMLElement>('[data-madewith-description]');
  // Text sinks, so tRaw: the label is typed text and is shown exactly as written.
  if (record) {
    record.textContent = on
      ? tRaw('Records: {words}', { words: madeWithWords(preview.record) })
      : t('Records nothing about the design system.');
  }
  if (description) {
    // A format whose record lives only in the credential has no description to write.
    description.hidden = carrier !== 'file';
    description.textContent = tRaw('Description: {text}', { text: on ? preview.description : preview.plainDescription });
  }
  section.hidden = false;
}

/** Repaint when the format or the credential changes what the file will carry. */
export function madeWithControlChange(ta: ActionsCtx, event: Event): void {
  if (event.target === ta.formatEl || event.target === ta.c2paEl) paintMadeWith(ta);
}

/** Repaint after the canvas settles: a colourway switch or a bound description changes the words. */
export function scheduleMadeWith(ta: ActionsCtx): void {
  if (ta.madeWithTimer) clearTimeout(ta.madeWithTimer);
  ta.madeWithTimer = setTimeout(() => {
    ta.madeWithTimer = null;
    if (ta.el?.isConnected) void fillMadeWith(ta);
  }, 300);
}

/** Paint the card once and keep it current: on toggle, on sheet open and after edits. */
export function wireMadeWith(ta: ActionsCtx): void {
  // Wiring twice must not leave a second subscription behind, and a read still in
  // flight from the first wiring must not paint over the second: dispose bumps the
  // sequence instead of resetting the count.
  if (ta.madeWithUnsub || ta.madeWithTimer) disposeMadeWith(ta);
  ta.madeWithSeq = ta.madeWithSeq ?? 0;
  ta.madeWithTimer = null;
  ta.madeWithPreview = null;
  ta.madeWithUnsub = null;
  const section = ta.el?.querySelector<HTMLElement>('[data-madewith-section]');
  if (!section || !ta.hasMadeWith) return;
  section.querySelector<HTMLInputElement>('[data-action="madewith"]')?.addEventListener('change', (event) => {
    ta.runtime.setMadeWith((event.currentTarget as HTMLInputElement).checked);
    paintMadeWith(ta);
    ta.onUrlSync?.('madewith');
  });
  // A colourway switch (setTokenSelection) and every input edit notify subscribers.
  ta.el?.addEventListener('lolly:export-open', ta.notes.scheduleMadeWith);
  ta.el?.addEventListener('change', ta.notes.madeWithControlChange);
  ta.madeWithUnsub = ta.runtime.subscribe(ta.notes.scheduleMadeWith);
  void fillMadeWith(ta);
}

/** Stop keeping the card current when the panel goes: the timer, the subscription, the listener. */
export function disposeMadeWith(ta: ActionsCtx): void {
  if (ta.madeWithTimer) clearTimeout(ta.madeWithTimer);
  ta.madeWithTimer = null;
  ta.madeWithUnsub?.();
  ta.madeWithUnsub = null;
  ta.el?.removeEventListener('lolly:export-open', ta.notes.scheduleMadeWith);
  ta.el?.removeEventListener('change', ta.notes.madeWithControlChange);
  // A read still in flight paints nothing once the panel is gone.
  ta.madeWithSeq = (ta.madeWithSeq ?? 0) + 1;
}

// ── Songs in Content Credentials (plan 301) ─────────────────────────────────
//
// Andy approved on 2026-10-08 that an export holding a rondocode song records it
// in its Content Credentials, on two conditions: the person sees it at the moment
// of export, and the public docs list the record. This is the first half. Before the
// export, one plain sentence beside the export button says which songs the
// credential will record. After it, the same line says only what a reading of the
// delivered bytes found (the docs/creative-rights.md wording rule). The record
// follows the C2PA toggle: with credentials off, nothing is written and nothing
// is said.

/** Will this export carry a credential? The C2PA toggle and a format that can hold one. */
function songCredentialOn(ta: ActionsCtx, fmt: string): boolean {
  const c2pa = ta.el?.querySelector<HTMLInputElement>('[data-action="pdf-c2pa"]');
  const on = c2pa ? c2pa.checked && !c2pa.disabled : ta.c2paInitOn;
  return Boolean(on) && (ta.c2paFormats ?? []).includes(fmt);
}

/**
 * The songs the next export holds as sound, by name: the timeline's audio boxes,
 * the tool's own audio slot, and the export bar's track. Only a format that carries
 * sound holds a song; a still drawn from a song's waveform holds none.
 */
export async function exportSongNames(ta: ActionsCtx): Promise<string[]> {
  const fmt = ta.formatEl?.value || ta.initialFmt || '';
  const video = ta.formatRules.isVideoFmt(fmt);
  if (!video && !isAudioFmt(fmt)) return [];
  const { songAt, timelineSongs, distinctNames } = await import('../../lib/rondo-provenance.ts');
  const songs = [];
  if (ta.canvasEl?.querySelector?.('[data-sequence]')) songs.push(...(await timelineSongs(ta.canvasEl)));
  if (ta.hasToolAudioInput && ta.audio.toolAudioRef()?.format === 'rondo') {
    const ref = await ta.audio.resolveToolAudio().catch(() => null);
    if (ref?.url) songs.push(await songAt(ref.url));
  }
  const track = video ? ta.el?.querySelector<HTMLSelectElement>('[data-action="video-audio"]')?.value : '';
  if (track && track !== '__generate__') {
    const ref = await ta.host.assets.get(track).catch(() => null);
    if (ref?.format === 'rondo' && ref.url) songs.push(await songAt(ref.url));
  }
  return distinctNames(songs);
}

/** Quote a list of song names for a sentence. */
const quoted = (names: readonly string[]): string => names.map((n) => `“${n}”`).join(', ');

/** Paint the pre-export line: which songs the credential will record. Hidden when none. */
export async function fillSongNote(ta: ActionsCtx): Promise<void> {
  const slot = ta.el?.querySelector<HTMLElement>('[data-song-note]');
  if (!slot) return;
  const seq = (ta.songNoteSeq ?? 0) + 1;
  ta.songNoteSeq = seq;
  const fmt = ta.formatEl?.value || ta.initialFmt || '';
  let names: string[] = [];
  try {
    names = songCredentialOn(ta, fmt) ? await exportSongNames(ta) : [];
  } catch {
    names = [];
  }
  if (seq !== ta.songNoteSeq) return;
  ta.songNoteNames = names;
  if (!names.length) {
    slot.hidden = true;
    slot.replaceChildren();
    return;
  }
  const line = document.createElement('p');
  line.className = 'export-song-note';
  line.dataset.songNoteState = 'before';
  line.textContent = names.length === 1
    ? tRaw('Content Credentials will record the song {name}, rendered in Lolly’s sandbox, as a source of this file.', { name: quoted(names) })
    : tRaw('Content Credentials will record the songs {names}, rendered in Lolly’s sandbox, as sources of this file.', { names: quoted(names) });
  slot.replaceChildren(line);
  slot.hidden = false;
}

/** Re-check the songs after an edit. Debounced: an input change can arrive many times a second. */
export function scheduleSongNote(ta: ActionsCtx): void {
  if (ta.songNoteTimer) clearTimeout(ta.songNoteTimer);
  ta.songNoteTimer = setTimeout(() => {
    ta.songNoteTimer = null;
    void fillSongNote(ta);
  }, 300);
}

/**
 * After an export: say what the delivered file's Content Credentials record about
 * its songs, read from its bytes. Silent when the sheet promised no song.
 */
export async function reportSongRecord(ta: ActionsCtx, blob: Blob | null): Promise<void> {
  const slot = ta.el?.querySelector<HTMLElement>('[data-song-note]');
  const promised = ta.songNoteNames ?? [];
  if (!slot || !blob || !promised.length) return;
  const seq = (ta.songNoteSeq ?? 0) + 1;
  ta.songNoteSeq = seq;
  const { recordedSongNames } = await import('../../lib/rondo-provenance.ts');
  const recorded = await recordedSongNames(blob);
  if (seq !== ta.songNoteSeq) return;
  const lines: HTMLElement[] = [];
  const say = (cls: string, text: string): void => {
    const p = document.createElement('p');
    p.className = cls;
    p.dataset.songNoteState = 'after';
    p.textContent = text;
    lines.push(p);
  };
  if (recorded === null) {
    say('guide-absent', t('The song record was not checked: this file is too large to read back here.'));
  } else {
    const found = promised.filter((n) => recorded.includes(n));
    const missing = promised.filter((n) => !recorded.includes(n));
    if (found.length) {
      say('guide-fact', found.length === 1
        ? tRaw('This file’s Content Credentials record the song {name}.', { name: quoted(found) })
        : tRaw('This file’s Content Credentials record the songs {names}.', { names: quoted(found) }));
    }
    if (missing.length) {
      say('guide-absent', missing.length === 1
        ? tRaw('This file’s Content Credentials do not record the song {name}.', { name: quoted(missing) })
        : tRaw('This file’s Content Credentials do not record the songs {names}.', { names: quoted(missing) }));
    }
  }
  slot.replaceChildren(...lines);
  slot.hidden = !lines.length;
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
  line.textContent = isTauriShell() ? t('Add your details to this file? They stay on this device.') : t('Add your details to this file? They stay in this browser.');
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
    exportSongNames: bindOp(ta, exportSongNames),
    fillSongNote: bindOp(ta, fillSongNote),
    fillMadeWith: bindOp(ta, fillMadeWith),
    paintMadeWith: bindOp(ta, paintMadeWith),
    madeWithControlChange: bindOp(ta, madeWithControlChange),
    scheduleMadeWith: bindOp(ta, scheduleMadeWith),
    wireMadeWith: bindOp(ta, wireMadeWith),
    disposeMadeWith: bindOp(ta, disposeMadeWith),
    scheduleSongNote: bindOp(ta, scheduleSongNote),
    reportSongRecord: bindOp(ta, reportSongRecord),
    offerDetailsAsk: bindOp(ta, offerDetailsAsk),
    offerReopenNote: bindOp(ta, offerReopenNote),
    refreshFilenamePlaceholder: bindOp(ta, refreshFilenamePlaceholder),
  };
}
