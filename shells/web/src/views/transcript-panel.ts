// SPDX-License-Identifier: MPL-2.0
/**
 * transcript-panel.ts - the right-docked Transcript surface for transcript-driven
 * editing (plans/174). Edit like a document: the clip's words flow as one paragraph;
 * click a word to seek, drag or double-click to select a span, Delete to CUT that
 * media, ⌘/Ctrl+Delete to STRIKE it (reversible - a second ⌘Delete on a struck span
 * restores it). All editing arithmetic lives in the pure, headless-tested
 * transcript-edit.ts / timeline-math.ts; this module is only DOM + native selection,
 * and every edit funnels through the injected undo-aware `write`, so ⌘Z takes it back.
 *
 * Opened FROM timeline-panel.ts, which hands us the closures it already holds
 * (getBoxes / write / clock seek+tick / cfg) and maps the panel's AUTHORED times to
 * the clock's compressed timebase. Self-contained: docked into the shared right-edge
 * column (lib/edge-dock.ts) on desktop, a fixed overlay below the mobile breakpoint.
 *
 * EDIT SCRIPT MODE (plans/181 sections 5.4 and 6) is the second half, offered only
 * on a clip Lolly itself spoke. The caret moves freely over the script, the bracket
 * marks are ordinary characters drawn as highlighted segments the pointer can also
 * operate, and the SENTENCE is the unit: touch one and it shows dirty, delete a
 * terminal mark and the band widens to swallow its neighbour, because the two are
 * now one line to speak. Regenerate re-speaks only those lines and splices them
 * into the clip; the timeline half of that is spliceSentences in transcript-edit.ts,
 * and the synthesis half is the injected `regenerate`, which owns the worker and
 * the asset rewrite.
 */

import { icon, type IconName } from '../lib/icons.ts';
import { t, tRaw } from '../i18n.ts';
import { requestDock, releaseDock } from '../lib/edge-dock.ts';
import { announce } from '../a11y.ts';
import type { AssetRef, SpeechWordTiming } from '@lolly-tools/core/host-v1';
import { endsSentence, PAUSE_DEFAULT_S, scriptLinesOf, splitWords } from '../../../../engine/src/speech-text.ts';
import { ttsWordsOf } from './timeline-captions.ts';
import { prosodyChips, prosodyTips, sayItAs, tokenizeMarks } from '../lib/prosody-chips.ts';
import type { Box, TimeCfg } from './timeline-math.ts';
import {
  transcriptRows, deleteMediaRange, ignoreMediaRange, restoreIgnored,
  spliceSentences, lcsMap, type SentenceEdit,
} from './transcript-edit.ts';
import '../styles/parts/transcript.css';

export interface TranscriptPanelOpts {
  cfg: TimeCfg;
  /** The source clip's word timings (media seconds), from subtitleSource(). */
  words: SpeechWordTiming[];
  /** The source asset id (may be '' for a stashed / URL source - then we match by url). */
  assetId: string;
  /** The box id the panel was opened on - the source clip, whose asset key we capture. */
  sourceId: string;
  /** The box sub-field carrying the asset ref (design: 'image'). */
  assetField: string;
  /** Read the live boxes array (closure over the runtime model). */
  getBoxes: () => Box[];
  /** The one undo-aware write path (timeline-panel's `write`). */
  write: (next: Box[]) => void;
  /** Seek the playhead to an AUTHORED-time millisecond (the caller maps to the clock). */
  seek: (ms: number) => void;
  /** Subscribe to playhead ticks (AUTHORED ms) for the read-along highlight. */
  subscribeTick: (cb: (ms: number) => void) => () => void;
  /** Optional: subscribe to model changes so external edits refresh the words. */
  subscribeModel?: (cb: () => void) => () => void;
  /** A human label for the clip, shown in the header. */
  title?: string;
  /**
   * The clip's `meta.tts` block, when Lolly spoke this clip. Its word timings
   * are what offers Edit script, exactly as they gate the auto-open.
   */
  tts?: TranscriptTtsMeta;
  /**
   * Re-speak the dirty lines and rewrite the clip in place, resolving the new
   * word timings and the source ranges that changed. Supplied by the caller,
   * which owns the speech bridge and the asset store; without it, Edit script
   * still edits but Regenerate is not offered.
   */
  regenerate?: (req: TranscriptRegenerateRequest) => Promise<TranscriptRegenerateResult | null>;
  /**
   * Re-run this source's caption set on the new words. Called once, after the
   * boxes are written, and only when the document has caption boxes for it.
   */
  reapplySubtitles?: (words: SpeechWordTiming[]) => void;
}

/** What a spoken clip remembers about how it was made (plans/181 section 5.1). */
export interface TranscriptTtsMeta {
  /** The model-facing script: normalized, one sentence per line, marks kept. */
  script?: string;
  /** The human prose the studio typed. */
  text?: string;
  /** A voice id, or a plus-joined weighted blend of them. */
  voice?: string;
  speed?: number;
  words?: SpeechWordTiming[];
}

/** One Regenerate press, handed to the injected synthesis half. */
export interface TranscriptRegenerateRequest {
  /** The whole edited script, one sentence per line, marks in place. */
  script: string;
  /** The script this clip was last spoken from, to diff against. */
  baseScript: string;
  /** Indices into the edited script's lines that must be re-spoken. */
  dirtyLines: number[];
  /** Save the pre-edit clip under a fresh id before rewriting this one. */
  keepPrevious: boolean;
  /** 0 to 1, or null when the transport will not say how far along it is. */
  onProgress?: (fraction: number | null) => void;
}

/** What comes back: the rewritten clip's timings and what moved. */
export interface TranscriptRegenerateResult {
  words: SpeechWordTiming[];
  /** The script it was spoken from, in canonical form. */
  script: string;
  /** Old source ranges that were replaced, and their length change. */
  edits: SentenceEdit[];
  /**
   * The clip as the store holds it after the rewrite (plans/181 section 5.3
   * step 4). The one a box already carries points at the previous bytes and
   * the previous `meta.tts`, so it is replaced in the same write as the
   * geometry; without it the canvas plays the old take under the new cuts and
   * the next open of this panel reads word timings that no longer match.
   */
  ref?: AssetRef | null;
}

export interface TranscriptPanel { close(): void; }

/** A regeneration that finished with the panel closed, waiting for it to reopen. */
export interface PendingRefit {
  oldWords: SpeechWordTiming[];
  newWords: SpeechWordTiming[];
  edits: SentenceEdit[];
  script: string;
  /** The clip as the store holds it after the rewrite, for the boxes' refs. */
  ref?: AssetRef | null;
}

/**
 * Regenerations whose asset rewrite completed while nobody was watching, keyed
 * by asset id. The clip itself is already correct on disk; what is left is the
 * document's own geometry, and editing a document behind the user's back is
 * exactly what the plan forbids. So the re-fit waits here and runs the next
 * time the panel opens on that clip (plans/181 section 5.4).
 */
const pendingRefits = new Map<string, PendingRefit>();

/** Park a finished regeneration for the next open of that clip's panel. */
export function stashPendingRefit(assetId: string, refit: PendingRefit): void {
  if (assetId) pendingRefits.set(assetId, refit);
}

/** Take back a parked regeneration (and forget it), or null if there is none. */
export function takePendingRefit(assetId: string): PendingRefit | null {
  const found = assetId ? pendingRefits.get(assetId) : undefined;
  if (found) pendingRefits.delete(assetId);
  return found ?? null;
}

let _active: TranscriptPanel | null = null;

/** Close any open transcript panel (singleton - one clip's transcript at a time). */
export function closeTranscriptPanel(): void { _active?.close(); }

/** The input types Edit script lets through; everything else is still refused.
 *  `insertParagraph` is on the list but never performed by the browser: the
 *  handler puts a real newline in itself, so the sentence break is the same
 *  character on every engine. */
const EDIT_INPUT_TYPES = new Set([
  'insertText', 'deleteContentBackward', 'deleteContentForward', 'insertParagraph',
]);

/** NodeFilter.SHOW_TEXT, written as its value so this module needs no global. */
const SHOW_TEXT = 4;

/** Canonical script lines: one sentence each, marks put back in place. */
export function scriptLines(text: string): string[] {
  return scriptLinesOf(text, { prenormalized: true });
}

/**
 * A script for a clip saved before the pipeline wrote one: the words as spoken,
 * with a line break after every word carrying terminal punctuation. Coarser
 * than the real thing (it cannot recover marks that were never stored) but it
 * is the same words in the same order, which is what the diff needs.
 */
export function deriveScript(words: readonly SpeechWordTiming[]): string {
  const lines: string[] = [];
  let cur: string[] = [];
  for (const w of words) {
    const text = w.text.trim();
    if (!text) continue;
    cur.push(text);
    if (endsSentence(text)) { lines.push(cur.join(' ')); cur = []; }
  }
  if (cur.length) lines.push(cur.join(' '));
  return lines.join('\n');
}

/** The marks in a line, as one comparable string - what tells the restyler to run. */
export function markSignature(line: string): string {
  return tokenizeMarks(line)
    .filter((tok) => tok.kind !== 'text')
    .map((tok) => `${tok.kind}:${tok.text}`)
    .join('|');
}

/** The Regenerate label's two counts, each with its own singular form - one
 *  edited sentence is the common case, and "1 sentences" reads as a bug. */
export const nSentences = (n: number): string =>
  (n === 1 ? t('1 sentence') : tRaw('{n} sentences', { n }));
export const nWords = (n: number): string => (n === 1 ? t('1 word') : tRaw('{n} words', { n }));

/**
 * How many words a script line actually speaks (marks are never spoken).
 *
 * A pronunciation mark counts as ONE, however many words it wraps, because the
 * parser keeps the phrase it wraps as a single spoken token - that is how its
 * phonemes cover the whole phrase. baseWordStarts() checks this total against
 * the clip's own word count, so the two definitions have to agree exactly.
 */
export function spokenWordCount(line: string): number {
  let n = 0;
  for (const tok of tokenizeMarks(line)) {
    if (tok.kind === 'say') { n++; continue; }
    if (tok.kind === 'text') n += splitWords(tok.text).length;
  }
  return n;
}

/**
 * Diff the edited lines against the stored ones. A line with an exact match in
 * the base is clean and keeps its word timings; every other line is dirty, so
 * deleting a terminal mark (two base lines become one edited line) or typing
 * one (one becomes two) widens the band with no rule of its own - it falls out
 * of the diff, which is the point of plan section 5.2 step 1.
 */
export function dirtyLines(base: readonly string[], cur: readonly string[]): {
  dirty: Set<number>; baseOfCur: (number | null)[];
} {
  const map = lcsMap(base, cur);
  const baseOfCur: (number | null)[] = new Array(cur.length).fill(null);
  map.forEach((n, b) => { if (n != null) baseOfCur[n] = b; });
  const dirty = new Set<number>();
  for (let i = 0; i < cur.length; i++) if (baseOfCur[i] == null) dirty.add(i);
  return { dirty, baseOfCur };
}

/**
 * The separator that rebuilds one script line's break in the flow. A line
 * already ending in terminal punctuation is separated by a space, so deleting
 * that mark JOINS the two sentences; a line without one is separated by a real
 * newline, because the newline is the only thing ending its breath group.
 */
export function lineSeparator(line: string): string {
  const spoken = tokenizeMarks(line).filter((tok) => tok.kind !== 'pause' && tok.kind !== 'speed')
    .map((tok) => (tok.kind === 'say' ? (tok.word ?? '') : tok.text)).join('');
  const last = splitWords(spoken).at(-1) ?? '';
  return endsSentence(last) ? ' ' : '\n';
}

const idOf = (b: Box, cfg: TimeCfg): string => String(b[cfg.idField] ?? '');

/** The asset a box renders, keyed by BOTH its id and url. Splits copy the whole ref, so
 *  matching on either survives every edit - and a stashed / no-id source (a fresh
 *  recording, a URL) still resolves by url when its ref carries no persisted id. */
function assetKeyOf(b: Box | undefined, assetField: string): { id: string; url: string } | null {
  const r = b?.[assetField];
  if (r == null || typeof r !== 'object' || Array.isArray(r)) return null;
  const o = r as { id?: unknown; url?: unknown; source?: unknown };
  const id = typeof o.id === 'string' ? o.id : '';
  const url = typeof o.url === 'string' ? o.url : (typeof o.source === 'string' ? o.source : '');
  return (id || url) ? { id, url } : null;
}

/** A collision-free id minter for one edit (splitBox may mint twice). */
function makeMint(boxes: readonly Box[], cfg: TimeCfg): () => string {
  const used = new Set(boxes.map((b) => idOf(b, cfg)));
  let n = used.size;
  return () => { let id: string; do { n++; id = `b${n}`; } while (used.has(id)); used.add(id); return id; };
}

/**
 * An icon-only header button (close, dock). One helper so this file keeps a single
 * raw-markup sink for header glyphs, and its input is always a trusted lib/icons
 * constant.
 */
function makeHeadBtn(iconName: IconName, label: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'tr-close';   // the head's icon-button shape (transcript.css)
  b.setAttribute('aria-label', label);
  b.title = label;
  b.innerHTML = icon(iconName);
  return b;
}

/** A labelled action button. `mousedown` preventDefault keeps the word selection alive
 *  when the button takes the click (else the click would collapse it first). */
function makeActBtn(iconName: IconName, label: string): { b: HTMLButtonElement; lab: HTMLElement } {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'tr-act';
  const ico = document.createElement('span');
  ico.className = 'tr-act-ico';
  ico.innerHTML = icon(iconName);   // trusted lib/icons constant
  const lab = document.createElement('span');
  lab.textContent = label;
  b.append(ico, lab);
  b.addEventListener('mousedown', (e) => e.preventDefault());
  return { b, lab };
}

export function openTranscriptPanel(opts: TranscriptPanelOpts): TranscriptPanel {
  closeTranscriptPanel();
  const { cfg, assetId, assetField, getBoxes, write, seek, subscribeTick, subscribeModel } = opts;
  // Regeneration replaces these in place, so the read-along, the projection and
  // the next diff all read the clip's CURRENT timings.
  let words = opts.words;

  // The source asset's stable key, captured ONCE from the clip we opened on. Every box
  // that renders a window of it - the original plus every split - carries the same asset
  // ref, so we match on id-or-url and stay correct as cuts accrue. Falls back to the
  // passed assetId when the opened box can't be found (already edited away, say).
  const srcKey = assetKeyOf(getBoxes().find((b) => idOf(b, cfg) === opts.sourceId), assetField)
    ?? (assetId ? { id: assetId, url: '' } : null);
  function srcBoxes(boxes: readonly Box[]): Box[] {
    if (!srcKey) return [];
    return boxes.filter((b) => {
      const k = assetKeyOf(b, assetField);
      return !!k && ((!!srcKey.id && k.id === srcKey.id) || (!!srcKey.url && k.url === srcKey.url));
    });
  }

  const panel = document.createElement('aside');
  panel.className = 'tr-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', t('Transcript'));

  // ── header ────────────────────────────────────────────────────────────────
  const head = document.createElement('div');
  head.className = 'tr-head';
  const title = document.createElement('span');
  title.className = 'tr-title';
  title.textContent = opts.title || t('Transcript');
  // The way back into the one right sidebar. Hidden while the panel IS in it; shown when
  // the dock refused the panel (below the mobile breakpoint) or it was taken out, so this
  // surface is never stuck as a fixed sheet over the work with no way to tuck it away.
  const dockBtn = makeHeadBtn('dock', t('Dock to the side'));
  const closeBtn = makeHeadBtn('close', t('Close'));
  const headTools = document.createElement('span');
  headTools.className = 'tr-head-tools';
  headTools.append(dockBtn, closeBtn);
  head.append(title, headTools);

  // ── toolbar: the actions, spelled out (no shortcut knowledge required) ────────
  const toolbar = document.createElement('div');
  toolbar.className = 'tr-toolbar';
  const cut = makeActBtn('trash', t('Cut'));
  cut.b.setAttribute('data-danger', '');
  cut.b.title = t('Remove the selected words and their audio (⌘Z undoes)');
  const skip = makeActBtn('minus', t('Skip'));
  skip.b.title = t('Skip the selected words on playback, keeping them (a second Skip restores)');

  const spacer = document.createElement('span');
  spacer.className = 'tr-spacer';

  const showSkipped = document.createElement('label');
  showSkipped.className = 'tr-chk';
  const showSkippedCb = document.createElement('input');
  showSkippedCb.type = 'checkbox';
  showSkippedCb.checked = true;
  showSkipped.append(showSkippedCb, document.createTextNode(t('Show skipped')));

  // ── Edit script: only for a clip Lolly spoke, and only if it kept timings ──
  const isTts = !!ttsWordsOf({ tts: opts.tts });
  const editToggle = makeActBtn('pen', t('Edit script'));
  editToggle.b.title = t('Change the words and the punctuation, then re-speak just what you changed');
  editToggle.b.setAttribute('aria-pressed', 'false');
  const regen = makeActBtn('refresh', t('Regenerate'));
  const regenCount = document.createElement('span');
  regenCount.className = 'tr-regen-count';
  regen.b.append(regenCount);
  const recipeBtn = makeActBtn('speech', t('Voice'));
  recipeBtn.b.title = t('The voice and speed this clip was spoken with');
  const keepPrev = document.createElement('label');
  keepPrev.className = 'tr-chk';
  const keepPrevCb = document.createElement('input');
  keepPrevCb.type = 'checkbox';
  keepPrevCb.checked = false;
  keepPrev.append(keepPrevCb, document.createTextNode(t('Keep the previous take')));

  toolbar.append(cut.b, skip.b);
  if (isTts) toolbar.append(editToggle.b, regen.b, recipeBtn.b);
  toolbar.append(spacer, showSkipped);
  if (isTts) toolbar.append(keepPrev);

  // ── the chip bar: the same text, for anyone who would rather not type it ────
  const chipBar = document.createElement('div');
  chipBar.className = 'tr-chips';
  chipBar.hidden = true;
  const tipsBtn = document.createElement('button');
  tipsBtn.type = 'button';
  tipsBtn.className = 'tr-chip tr-chip-tips';
  tipsBtn.textContent = t('Tips');
  tipsBtn.title = t('What each mark does, with an example');
  for (const chip of prosodyChips()) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tr-chip';
    b.dataset.chip = chip.id;
    b.textContent = chip.label;
    b.title = chip.title;
    b.setAttribute('aria-label', chip.title);
    // Keep the caret (and any word selection) alive when the button takes the click.
    b.addEventListener('mousedown', (e) => e.preventDefault());
    b.addEventListener('click', () => applyChip(chip.id));
    chipBar.appendChild(b);
  }
  tipsBtn.addEventListener('mousedown', (e) => e.preventDefault());
  tipsBtn.addEventListener('click', () => openTips());
  chipBar.appendChild(tipsBtn);

  // ── the flowing transcript + foot ────────────────────────────────────────────
  const list = document.createElement('div');
  list.className = 'tr-list';
  const flow = document.createElement('div');
  flow.className = 'tr-flow';
  // A READ-ONLY contenteditable: the browser gives a real blinking caret, click-to-place,
  // arrow-key navigation and native drag/double-click selection - the "edit like a document"
  // feel - while every actual mutation is blocked, so the words can only be SELECTED, never
  // typed over. All edits go through Delete/⌘Delete (onKey below) → the tested media ops.
  flow.contentEditable = 'true';
  flow.spellcheck = false;
  flow.setAttribute('role', 'textbox');
  flow.setAttribute('aria-multiline', 'true');
  flow.setAttribute('aria-readonly', 'true');
  // Read mode blocks every mutation. Edit mode steps aside for plain text only:
  // typing, both deletes, and Enter. Formatting commands, native drag-moves and
  // rich paste stay refused, so the flow can never gain markup of its own.
  flow.addEventListener('beforeinput', (e) => {
    // A run in flight owns the script it was handed. Letting the keyboard
    // change it would throw those keystrokes away the moment the new words
    // arrive and the flow is repainted from them, so the words go read-only
    // until the run is done - the band under them says why.
    if (!editMode || regenerating) { e.preventDefault(); return; }
    const type = (e as InputEvent).inputType;
    if (!EDIT_INPUT_TYPES.has(type)) { e.preventDefault(); return; }
    // Enter is a sentence break, and the script is read back off
    // flow.textContent - so the break has to be a real newline character.
    // Left to itself a browser inserts a <div> or a <br> instead, depending on
    // the engine and on what the caret sits in, and both lose the break when
    // the text is read back ("This is" + "a test." would be spoken as "This
    // isa test."). Put the newline in ourselves so every engine agrees.
    if (type === 'insertParagraph') { e.preventDefault(); insertAtCaret('\n'); }
  });
  flow.addEventListener('paste', (e) => {
    e.preventDefault();
    if (!editMode || regenerating) return;
    const text = (e as ClipboardEvent).clipboardData?.getData('text/plain') ?? '';
    if (text) insertAtCaret(text);
  });
  flow.addEventListener('drop', (e) => e.preventDefault());
  flow.addEventListener('input', () => { if (editMode) onEditInput(); });
  list.appendChild(flow);
  const foot = document.createElement('div');
  foot.className = 'tr-foot';
  const READ_FOOT = t('Click a word to jump · drag to select · then Cut or Skip (or press Delete / ⌘Delete)');
  const EDIT_FOOT = t('Type over the words, add punctuation or a mark, then Regenerate. Only the sentences you touched are spoken again.');
  foot.textContent = READ_FOOT;

  panel.append(head, toolbar, chipBar, list, foot);
  document.body.appendChild(panel);
  // Dock into the shared right-edge column so the stage AND the timeline are NUDGED
  // in (not overlapped) - #view reserves `--dock-w` and re-fits (lib/edge-dock.ts).
  const dockHooks = { icon: icon('transcript'), label: t('Transcript') };
  let docked = requestDock('transcript', panel, dockHooks);
  dockBtn.hidden = docked;
  dockBtn.addEventListener('click', () => {
    docked = requestDock('transcript', panel, dockHooks);
    dockBtn.hidden = docked;
  });

  const syncHideIgnored = (): void => { panel.dataset.hideIgnored = showSkippedCb.checked ? '0' : '1'; };

  /** The rendered word spans, cached for the per-tick read-along scan. */
  let wordEls: HTMLElement[] = [];

  // ── Edit script state ───────────────────────────────────────────────────────
  let editMode = false;
  /** The script the clip was last spoken from - what the diff measures against. */
  let baseLines: string[] = [];
  /** The canonical lines the flow currently holds. */
  let curLines: string[] = [];
  let dirty = new Set<number>();
  /** For each current line, the base line it still is, or null when it is dirty. */
  let baseOfCur: (number | null)[] = [];
  let regenerating = false;
  let markPopover: HTMLElement | null = null;

  const scriptOf = (): string => opts.tts?.script || deriveScript(words);

  function resetScript(): void {
    baseLines = scriptLines(scriptOf());
    curLines = baseLines.slice();
    dirty = new Set();
    baseOfCur = curLines.map((_, i) => i);
  }

  /**
   * The script edit mode opens on. Typing is thrown away by exactly one thing,
   * a new take, so re-entering edit mode brings back the words that were on
   * screen last time rather than the clip's. Only a clip whose own script has
   * moved under us (a regeneration, a re-open on different timings) starts over.
   */
  function openScript(): void {
    const base = scriptLines(scriptOf());
    const same = base.length === baseLines.length && base.every((line, i) => line === baseLines[i]);
    if (!same || !curLines.length) { resetScript(); return; }
    const d = dirtyLines(baseLines, curLines);
    dirty = d.dirty;
    baseOfCur = d.baseOfCur;
  }

  /**
   * Word index ranges per BASE line, so a clean line can still carry the media
   * datasets that make click-to-seek and the read-along work. Null when the
   * script and the timings disagree about how many words there are - a legacy
   * clip whose stored script was written by a different pass - in which case
   * edit mode simply offers no seeking rather than pointing at wrong audio.
   */
  function baseWordStarts(): number[] | null {
    const starts: number[] = [];
    let n = 0;
    for (const line of baseLines) { starts.push(n); n += spokenWordCount(line); }
    starts.push(n);
    return n === words.length ? starts : null;
  }

  function render(): void {
    if (editMode) { renderEdit(); return; }
    const rows = transcriptRows(words, srcBoxes(getBoxes()), cfg, { granularity: 'word' });
    flow.textContent = '';   // clears the words AND any prior empty message - one owner
    if (!rows.length) {
      const empty = document.createElement('div');
      empty.className = 'tr-empty';
      empty.textContent = t('No speech left in this clip.');
      flow.appendChild(empty);
      wordEls = [];
      return;
    }
    const els: HTMLElement[] = [];
    for (const row of rows) {
      const w = document.createElement('span');
      w.className = 'tr-word' + (row.ignored ? ' is-ignored' : '');
      w.textContent = row.text;
      w.dataset.ms0 = String(row.mStart);
      w.dataset.ms1 = String(row.mEnd);
      w.dataset.t0 = String(row.timelineStart);
      w.dataset.t1 = String(row.timelineEnd);
      w.dataset.box = row.boxId;
      flow.append(w, document.createTextNode(' '));
      els.push(w);
    }
    wordEls = els;
    nowEl = null;
  }

  // ── Edit script: rendering ──────────────────────────────────────────────────

  const sentenceEls = (): HTMLElement[] => [...flow.querySelectorAll<HTMLElement>('.tr-sentence')];

  /** Paint one sentence: mark tokens as their own spans, words as word spans. */
  function paintSentence(el: HTMLElement, line: string, firstWord: number | null): void {
    el.textContent = '';
    const rows = firstWord == null ? [] : transcriptRows(words, srcBoxes(getBoxes()), cfg, { granularity: 'word' });
    const rowByWord = new Map<number, ReturnType<typeof transcriptRows>[number]>();
    for (const r of rows) for (const i of r.wordIdxs) rowByWord.set(i, r);
    let wi = firstWord;

    const addWord = (text: string): void => {
      const w = document.createElement('span');
      w.className = 'tr-word';
      w.textContent = text;
      if (wi != null) {
        const row = rowByWord.get(wi);
        if (row) {
          w.dataset.ms0 = String(row.mStart);
          w.dataset.ms1 = String(row.mEnd);
          w.dataset.t0 = String(row.timelineStart);
          w.dataset.t1 = String(row.timelineEnd);
          w.dataset.box = row.boxId;
          if (row.ignored) w.classList.add('is-ignored');
        }
        wi++;
      }
      el.appendChild(w);
    };

    for (const tok of tokenizeMarks(line)) {
      if (tok.kind !== 'text') {
        const m = document.createElement('span');
        // A STYLING wrapper only: contenteditable stays inherited, never false,
        // so the caret walks straight through a mark like any other characters.
        m.className = 'tr-mark';
        m.dataset.mark = tok.kind;
        m.textContent = tok.text;
        el.appendChild(m);
        if (tok.kind === 'say' && wi != null) wi++;
        continue;
      }
      for (const piece of tok.text.split(/(\s+)/)) {
        if (!piece) continue;
        if (/^\s+$/.test(piece)) { el.appendChild(document.createTextNode(piece)); continue; }
        addWord(piece);
      }
    }
  }

  /** Rebuild the whole flow from `curLines`, marks and word spans included. */
  function renderEdit(): void {
    const caret = caretOffsetIn(flow);
    flow.textContent = '';
    const starts = baseWordStarts();
    for (const [i, line] of curLines.entries()) {
      const sent = document.createElement('div');
      sent.className = 'tr-sentence';
      sent.dataset.line = String(i);
      const b = baseOfCur[i];
      if (b == null) sent.classList.add('is-dirty');
      paintSentence(sent, line, b != null && starts ? (starts[b] as number) : null);
      flow.appendChild(sent);
      const sep = i < curLines.length - 1 ? lineSeparator(line) : '';
      if (sep) flow.appendChild(document.createTextNode(sep));
    }
    wordEls = [...flow.querySelectorAll<HTMLElement>('.tr-word')].filter((w) => w.dataset.t0 != null);
    nowEl = null;
    if (caret != null) placeCaretIn(flow, caret);
    paintRegenTracks();
  }

  /** Re-wrap ONE sentence from the text it currently holds, keeping the caret. */
  function repaintSentence(el: HTMLElement): void {
    const at = caretOffsetIn(el);
    const raw = el.textContent ?? '';
    const i = Number(el.dataset.line);
    const b = baseOfCur[i];
    const starts = baseWordStarts();
    paintSentence(el, raw, b != null && starts ? (starts[b] as number) : null);
    if (at != null) placeCaretIn(el, at);
  }

  /** The caret's character offset inside `root`, or null when it is elsewhere. */
  function caretOffsetIn(root: Node): number | null {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return null;
    const r = sel.getRangeAt(0);
    if (!root.contains(r.startContainer)) return null;
    const pre = document.createRange();
    pre.selectNodeContents(root);
    try { pre.setEnd(r.startContainer, r.startOffset); } catch { return null; }
    return pre.toString().length;
  }

  /** Put the caret back at a character offset inside `root`. */
  function placeCaretIn(root: Node, offset: number): void {
    const sel = window.getSelection();
    if (!sel) return;
    const walker = document.createTreeWalker(root, SHOW_TEXT);
    let seen = 0;
    let node: Text | null = null;
    let local = 0;
    while (walker.nextNode()) {
      const tn = walker.currentNode as Text;
      if (seen + tn.data.length >= offset) { node = tn; local = offset - seen; break; }
      seen += tn.data.length;
      node = tn;
      local = tn.data.length;
    }
    const r = document.createRange();
    if (node) r.setStart(node, Math.max(0, Math.min(local, node.data.length)));
    else { r.selectNodeContents(root); }
    r.collapse(true);
    sel.removeAllRanges();
    sel.addRange(r);
  }

  /** Put plain text in at the caret (the chip bar and the paste coercion). */
  function insertAtCaret(text: string, caretBack = 0): void {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || !flow.contains(sel.getRangeAt(0).startContainer)) {
      // Nowhere to put it: append to the last sentence rather than dropping it.
      const last = sentenceEls().at(-1);
      if (!last) return;
      last.appendChild(document.createTextNode(text));
      onEditInput();
      return;
    }
    const r = sel.getRangeAt(0);
    r.deleteContents();
    const node = document.createTextNode(text);
    r.insertNode(node);
    const after = document.createRange();
    after.setStart(node, Math.max(0, node.data.length - caretBack));
    after.collapse(true);
    sel.removeAllRanges();
    sel.addRange(after);
    onEditInput();
  }

  // ── Edit script: the input loop ─────────────────────────────────────────────

  /**
   * Read the flow back after every keystroke. The DOM keeps whatever the user
   * typed (so a trailing space survives); the canonical lines are what the
   * diff and the synthesis see. A change in the LINE COUNT means a sentence
   * split or two joined, so it repaints everything; a change in one
   * line's marks repaints just that sentence, which is the restyler; anything
   * else only moves the dirty bands.
   */
  function onEditInput(): void {
    const next = scriptLines(flow.textContent ?? '');
    // A finished mark can belong to a different line than the one it was typed
    // in (a pause written between two sentences attaches to the one that
    // follows), so the moment the marks change the canonical lines are the
    // truth and the whole flow is repainted from them. Plain typing takes
    // neither branch, which is what keeps a half-typed word and its trailing
    // space intact.
    const structural = next.length !== curLines.length
      || next.some((line, i) => markSignature(line) !== markSignature(curLines[i] ?? ''));
    const wasDirty = dirty;
    curLines = next;
    const d = dirtyLines(baseLines, curLines);
    dirty = d.dirty;
    baseOfCur = d.baseOfCur;

    if (structural) { renderEdit(); syncEditToolbar(); return; }
    const els = sentenceEls();
    for (const [i, el] of els.entries()) {
      const nowDirty = dirty.has(i);
      const flip = nowDirty !== wasDirty.has(i);
      el.classList.toggle('is-dirty', nowDirty);
      // A sentence that just went dirty drops its word spans: its timings mean
      // nothing until it is spoken again.
      if (flip) repaintSentence(el);
    }
    paintRegenTracks();
    syncEditToolbar();
  }

  /** The dirty band's progress track, shown only while a regeneration runs. */
  function paintRegenTracks(fraction: number | null = null): void {
    for (const el of sentenceEls()) {
      const old = el.querySelector('.tr-regen-track');
      old?.remove();
      if (!regenerating || !el.classList.contains('is-dirty')) continue;
      const track = document.createElement('div');
      track.className = 'tr-regen-track';
      track.contentEditable = 'false';
      if (fraction == null) track.classList.add('is-indeterminate');
      const fill = document.createElement('div');
      fill.className = 'tr-regen-fill';
      fill.style.width = fraction == null ? '100%' : `${Math.round(fraction * 100)}%`;
      track.appendChild(fill);
      el.appendChild(track);
    }
  }

  function idsNow(boxes: Box[]): string[] {
    return srcBoxes(boxes).map((b) => idOf(b, cfg));
  }

  /** The word spans the native selection currently touches (partial counts). */
  function selectedWords(): HTMLElement[] {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return [];
    return wordEls.filter((w) => sel.containsNode(w, true));
  }

  /** Is the selection anchored inside the transcript flow (not some other field)? */
  function selectionInFlow(): boolean {
    const a = window.getSelection()?.anchorNode;
    return !!a && flow.contains(a);
  }

  /** Delete or strike the selected words. ⌘Delete on an all-struck selection restores it. */
  function applySelection(strike: boolean): void {
    const spans = selectedWords();
    if (!spans.length) return;
    let boxes = getBoxes();

    if (strike && spans.every((w) => w.classList.contains('is-ignored'))) {
      // Un-strike: clear the flag on every box the selection covers.
      for (const bId of new Set(spans.map((w) => w.dataset.box || ''))) boxes = restoreIgnored(boxes, cfg, bId);
      write(boxes);
    } else {
      const mStart = Math.min(...spans.map((w) => Number(w.dataset.ms0)));
      const mEnd = Math.max(...spans.map((w) => Number(w.dataset.ms1)));
      const ids = idsNow(boxes);
      const mint = makeMint(boxes, cfg);
      write(strike
        ? ignoreMediaRange(boxes, cfg, ids, mStart, mEnd, mint)
        : deleteMediaRange(boxes, cfg, ids, mStart, mEnd, mint));
    }
    window.getSelection()?.removeAllRanges();
    render();
  }

  // Click a word (no active selection) seeks the playhead to it. A drag/double-click
  // leaves a non-collapsed selection, so it selects instead of seeking.
  flow.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (editMode) {
      const mark = target.closest?.('.tr-mark') as HTMLElement | null;
      if (mark) { openMarkControl(mark); return; }
    }
    const w = target.closest?.('.tr-word') as HTMLElement | null;
    if (!w || w.dataset.t0 == null) return;   // a dirty sentence has no timings yet
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) return;
    seek(Math.max(0, Number(w.dataset.t0) * 1000));
  });

  // ── Edit script: the chip bar, the mark controls, the popovers ──────────────

  /** Close whatever small popover is open (a mark control, Tips, the recipe). */
  function closePopover(): boolean {
    if (!markPopover) return false;
    markPopover.remove();
    markPopover = null;
    return true;
  }

  /** Mount a popover under `anchor`, inside the panel so it rides the dock. */
  function openPopover(anchor: HTMLElement, build: (body: HTMLElement) => void): void {
    closePopover();
    const pop = document.createElement('div');
    pop.className = 'tr-pop';
    pop.contentEditable = 'false';
    build(pop);
    panel.appendChild(pop);
    const a = anchor.getBoundingClientRect();
    const p = panel.getBoundingClientRect();
    pop.style.left = `${Math.max(4, a.left - p.left)}px`;
    pop.style.top = `${a.bottom - p.top + 4}px`;
    markPopover = pop;
  }

  /** A button inside a popover. */
  function popBtn(label: string, onClick: () => void): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tr-pop-btn';
    b.textContent = label;
    b.addEventListener('mousedown', (e) => e.preventDefault());
    b.addEventListener('click', onClick);
    return b;
  }

  /** Rewrite one mark's text in place, then run the normal input loop. */
  function setMarkText(span: HTMLElement, text: string): void {
    if (text) span.textContent = text;
    else span.remove();
    closePopover();
    onEditInput();
  }

  /** The pointer controls: a stepper for a pause, a toggle for a speed mark,
   *  a field for a pronunciation, and a remove on all three. */
  function openMarkControl(span: HTMLElement): void {
    if (regenerating) return;   // the script is the run's while it speaks
    const tok = tokenizeMarks(span.textContent ?? '').find((x) => x.kind !== 'text');
    if (!tok) return;
    openPopover(span, (body) => {
      const row = document.createElement('div');
      row.className = 'tr-pop-row';
      if (tok.kind === 'pause') {
        // A bare [pause] is the engine's own default, so the stepper starts
        // from the silence the mark is actually asking for.
        const secs = tok.seconds ?? PAUSE_DEFAULT_S;
        const val = document.createElement('span');
        val.className = 'tr-pop-val';
        val.textContent = tRaw('{seconds}s', { seconds: String(secs) });
        const step = (by: number): void => {
          const next = Math.round(Math.max(0.1, secs + by) * 10) / 10;
          setMarkText(span, `[pause ${next}]`);
        };
        row.append(popBtn('−', () => step(-0.2)), val, popBtn('+', () => step(0.2)));
      } else if (tok.kind === 'speed') {
        const isSlow = tok.rate === 'slow';
        const isFast = tok.rate === 'fast';
        row.append(
          popBtn(isSlow ? `✓ ${t('Slow')}` : t('Slow'), () => setMarkText(span, '[slow]')),
          popBtn(isFast ? `✓ ${t('Fast')}` : t('Fast'), () => setMarkText(span, '[fast]')),
          popBtn(t('Off'), () => setMarkText(span, '')),
        );
      } else {
        const field = document.createElement('input');
        field.type = 'text';
        field.className = 'field-input tr-pop-field';
        field.value = tok.ipa ?? '';
        field.setAttribute('aria-label', t('Phonemes'));
        field.addEventListener('change', () => setMarkText(span, sayItAs(tok.word ?? '', field.value.trim())));
        row.append(field);
      }
      body.append(row);
      if (tok.kind !== 'speed') body.append(popBtn(t('Remove'), () => setMarkText(span, '')));
    });
  }

  /** The chip bar: it puts the same text in, at the caret. */
  function applyChip(id: string): void {
    const chip = prosodyChips().find((c) => c.id === id);
    if (!chip || !editMode || regenerating) return;
    if (!chip.wrapsWord) { insertAtCaret(chip.insert); return; }
    // "Say it as" attaches to a word: the selected one, or the one at the caret.
    const sel = window.getSelection();
    const picked = sel && !sel.isCollapsed ? sel.toString().trim() : '';
    if (picked) { insertAtCaret(sayItAs(picked), 2); return; }
    const node = sel?.anchorNode ?? null;
    const el = (node && (node.nodeType === 1 ? node as HTMLElement : node.parentElement)) ?? null;
    const wordEl = el?.closest?.('.tr-word') as HTMLElement | null;
    if (!wordEl || !sel) return;
    // Select the word and go through the same insert the selection path uses,
    // which parks the caret between the slashes. Writing the word's
    // textContent instead detaches the text node the caret lived in, and the
    // repaint then finds no caret to restore - leaving the empty phoneme slot,
    // the whole point of the chip, for the user to hunt down with the mouse.
    const over = document.createRange();
    over.selectNodeContents(wordEl);
    sel.removeAllRanges();
    sel.addRange(over);
    insertAtCaret(sayItAs(wordEl.textContent ?? ''), 2);
  }

  /** The Tips list: one line per technique, with an example (lib/prosody-chips.ts). */
  function openTips(): void {
    openPopover(tipsBtn, (body) => {
      body.classList.add('tr-pop-tips');
      for (const tip of prosodyTips()) {
        const row = document.createElement('div');
        row.className = 'tr-tip';
        const text = document.createElement('div');
        text.className = 'tr-tip-text';
        text.textContent = tip.text;
        const ex = document.createElement('code');
        ex.className = 'tr-tip-ex';
        ex.textContent = tip.example;
        row.append(text, ex);
        body.appendChild(row);
      }
    });
  }

  /** The recipe, read-only: the voice or blend and the speed this clip used. */
  function openRecipe(): void {
    openPopover(recipeBtn.b, (body) => {
      body.classList.add('tr-pop-recipe');
      const rows: Array<[string, string]> = [
        [t('Voice'), opts.tts?.voice || t('Default')],
        [t('Speed'), String(opts.tts?.speed ?? 1)],
      ];
      for (const [label, value] of rows) {
        const row = document.createElement('div');
        row.className = 'tr-pop-row';
        const k = document.createElement('span');
        k.className = 'tr-pop-key';
        k.textContent = label;
        const v = document.createElement('span');
        v.className = 'tr-pop-val';
        v.textContent = value;
        row.append(k, v);
        body.appendChild(row);
      }
      const note = document.createElement('p');
      note.className = 'tr-pop-note';
      note.textContent = t('To change these, open the clip in Script audio.');
      body.appendChild(note);
    });
  }

  // ── Edit script: the mode switch and Regenerate ─────────────────────────────

  function syncEditToolbar(): void {
    editToggle.b.setAttribute('aria-pressed', editMode ? 'true' : 'false');
    // Not "Done": the only thing that commits an edit is Regenerate, and this
    // button just puts the cutting surface back. The words stay where they are.
    editToggle.lab.textContent = editMode ? t('Stop editing') : t('Edit script');
    editToggle.b.title = editMode
      ? t('Go back to cutting. What you typed stays until you Regenerate.')
      : t('Change the words and the punctuation, then re-speak just what you changed');
    // A run in flight owns the script, so the words are read-only until done.
    flow.setAttribute('aria-readonly', editMode && !regenerating ? 'false' : 'true');
    for (const b of chipBar.querySelectorAll('button')) b.disabled = regenerating;
    regen.b.hidden = !editMode;
    recipeBtn.b.hidden = !editMode;
    keepPrev.hidden = !editMode;
    chipBar.hidden = !editMode;
    cut.b.hidden = editMode;
    skip.b.hidden = editMode;
    const sentences = dirty.size;
    let wordsDirty = 0;
    for (const i of dirty) wordsDirty += spokenWordCount(curLines[i] ?? '');
    regenCount.textContent = sentences ? ` ${nSentences(sentences)} · ${nWords(wordsDirty)}` : '';
    regen.b.disabled = regenerating || !sentences || !opts.regenerate;
    editToggle.b.disabled = regenerating;
  }

  function setEditMode(on: boolean): void {
    if (on === editMode) return;
    closePopover();
    editMode = on;
    panel.dataset.edit = on ? '1' : '0';
    foot.textContent = on ? EDIT_FOOT : READ_FOOT;
    if (on) openScript();
    render();
    syncEditToolbar();
  }

  /**
   * Regenerate: hand the edited script and the dirty line numbers to the
   * injected synthesis half, which re-speaks only those lines and rewrites the
   * clip under its own id. What comes back is the new timings plus the source
   * ranges that moved, which is all spliceSentences needs.
   *
   * If the panel closed while it ran, the clip on disk is still correct and the
   * document is left alone; the re-fit waits in the stash for the next open.
   */
  async function doRegenerate(): Promise<void> {
    if (!opts.regenerate || regenerating || !dirty.size) return;
    closePopover();
    regenerating = true;
    syncEditToolbar();
    paintRegenTracks(null);
    const before = words;
    try {
      const out = await opts.regenerate({
        script: curLines.join('\n'),
        baseScript: baseLines.join('\n'),
        dirtyLines: [...dirty].sort((a, b) => a - b),
        keepPrevious: keepPrevCb.checked,
        onProgress: (f) => { if (!closed) paintRegenTracks(f); },
      });
      if (!out) return;
      if (closed) {
        stashPendingRefit(assetId, {
          oldWords: before, newWords: out.words, edits: out.edits, script: out.script, ref: out.ref,
        });
        return;
      }
      applyRegenerated(before, out.words, out.edits, out.script, out.ref);
    } catch {
      // The job's own toast carries the detail. Here the point is that the edit
      // is still on screen: nothing typed is thrown away by a failed run.
      announce(t('That could not be spoken again. Your changes are still here.'), { assertive: true });
    } finally {
      regenerating = false;
      if (!closed) { paintRegenTracks(); syncEditToolbar(); }
    }
  }

  /** One write for the geometry AND the refreshed ref, then the captions, then
   *  the words on screen. Both halves go in the same write so ⌘Z is one step. */
  function applyRegenerated(
    oldWords: SpeechWordTiming[], newWords: SpeechWordTiming[], edits: SentenceEdit[], script: string,
    ref?: AssetRef | null,
  ): void {
    const boxes = getBoxes();
    const ids = new Set(idsNow(boxes));
    let next = spliceSentences(boxes, cfg, ids, oldWords, newWords, edits);
    // Plan section 5.3 step 4: the rewrite bumped the record's version, so the
    // ref each box stored carries the PREVIOUS bytes' object URL and the
    // previous meta.tts. Put the live one in its place, or the canvas plays
    // the old take under the re-fitted cuts and the next open of this panel
    // reads word timings the audio no longer matches.
    if (ref) {
      next = next.map((b) => (ids.has(idOf(b, cfg)) ? { ...b, [assetField]: ref } : b));
    }
    write(next);
    words = newWords;
    if (opts.tts) {
      opts.tts.script = script;
      // The panel was handed the box's own tts block; its words are what the
      // next open diffs and seeks against, so they move with the script.
      opts.tts.words = newWords;
    }
    resetScript();
    render();
    syncEditToolbar();
    opts.reapplySubtitles?.(newWords);
  }

  // ── read-along highlight ────────────────────────────────────────────────────
  let nowEl: HTMLElement | null = null;
  const onTick = subscribeTick((ms) => {
    const sec = ms / 1000;
    let hit: HTMLElement | null = null;
    for (const w of wordEls) {
      if (sec >= Number(w.dataset.t0) && sec < Number(w.dataset.t1)) { hit = w; break; }
    }
    if (hit === nowEl) return;
    nowEl?.classList.remove('is-now');
    hit?.classList.add('is-now');
    nowEl = hit;
  });

  // External model edits (canvas trims, splits) refresh the words.
  const onModel = subscribeModel ? subscribeModel(() => render()) : null;

  showSkippedCb.addEventListener('change', syncHideIgnored);

  // Keep the toolbar in step with the live selection: the actions are enabled only once
  // words are picked, and Skip flips to Restore when the whole selection is already struck.
  function syncToolbar(): void {
    const spans = selectedWords();
    const has = spans.length > 0;
    cut.b.disabled = !has;
    skip.b.disabled = !has;
    skip.lab.textContent = has && spans.every((w) => w.classList.contains('is-ignored')) ? t('Restore') : t('Skip');
  }
  cut.b.addEventListener('click', () => applySelection(false));
  skip.b.addEventListener('click', () => applySelection(true));
  editToggle.b.addEventListener('click', () => setEditMode(!editMode));
  regen.b.addEventListener('click', () => { void doRegenerate(); });
  recipeBtn.b.addEventListener('click', () => openRecipe());
  document.addEventListener('selectionchange', syncToolbar);

  function onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.stopPropagation();
      if (closePopover()) return;   // one layer at a time, like every other overlay
      // Unspoken typing is the next layer down. Escape is a reflex, and closing
      // the panel takes the script with it, so the first press puts the cutting
      // surface back and the second closes.
      if (editMode && dirty.size) { setEditMode(false); return; }
      close();
      return;
    }
    // In edit mode the browser owns Delete and Backspace - they are how you type.
    if (editMode) return;
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectionInFlow()) {
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) {
        e.preventDefault();
        e.stopPropagation();
        applySelection(e.metaKey || e.ctrlKey);
      }
    }
  }
  document.addEventListener('keydown', onKey, true);
  closeBtn.addEventListener('click', () => close());

  let closed = false;
  function close(): void {
    if (closed) return;
    closed = true;
    onTick();
    onModel?.();
    document.removeEventListener('keydown', onKey, true);
    document.removeEventListener('selectionchange', syncToolbar);
    closePopover();
    if (docked) releaseDock('transcript'); // restores the element to <body>, un-nudges #view
    panel.remove();
    if (_active === api) _active = null;
  }

  syncHideIgnored();
  resetScript();
  // A regeneration that finished with this panel closed rewrote the clip but
  // left the document's geometry pointing at the old audio. Re-fit it now, on
  // the open the user asked for, and in the same one undo-able write every
  // other edit uses.
  const parked = takePendingRefit(assetId);
  if (parked) {
    applyRegenerated(parked.oldWords, parked.newWords, parked.edits, parked.script, parked.ref);
  }
  render();
  syncToolbar();
  syncEditToolbar();
  // Focus the transcript so the caret is there immediately - it reads as a document to
  // edit, not a panel to read. Harmless when empty.
  try { flow.focus({ preventScroll: true }); } catch { /* older browsers: no options arg */ }

  const api: TranscriptPanel = { close };
  _active = api;
  return api;
}
