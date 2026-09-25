// SPDX-License-Identifier: MPL-2.0
/**
 * rebrand: intake (plan 274 section 2.1 steps 1 and 2, section 4 "Readiness"; plan 275
 * close-out sections 2.1, 2.5 and 3.2).
 *
 * Owns `rb.els.intake`, shown while no plan exists (`phase` idle, reading, analysing,
 * or failed before a plan), and `rb.els.alert`, the band under the top bar. The intake
 * is one column: the heading, the design system the deck goes into (its three colours
 * and its name), the mode as a two-way segment with one help line that follows the
 * pressed half, the drop area with the view's one primary ("Choose a deck"), then the
 * recent projects on this device as rows with the project's first slide as a thumbnail
 * and Open and Delete behind the row's menu. The preset line shows only when presets
 * exist; errors and readiness rows only when they apply, and a mode switch or the next
 * pick clears them.
 *
 * Reading is one surface: the sentence with its count ("Reading slide 6 of 12", counted
 * from 1, never a percentage), the file name, Cancel, and a row of frames that fill left
 * to right as slides are read. The job toast is not this module's (plan 275 CP11 keeps
 * it quiet while the intake shows); the arrival sentence is the orchestrator's.
 *
 * Several decks at once (a multi-file pick or drop) start one read of all of them
 * (`rb.controller.startMany`); the list under the drop area names each deck with its
 * state, and a deck that is ready opens from its row. Once the first deck's review
 * takes the intake's place the list moves to the band under the top bar, so the other
 * decks stay in reach. The preset line offers the preset the next read applies,
 * through the same choice the project menu uses (`choosePreset`, which the project menu
 * reaches through `rb.intake`). A readiness row or an error that needs text recognition
 * offers the download in place (`ensureModel` from `lib/model-offer.ts`), never a trip
 * to Settings; once the model is on the device the controller checks readiness again.
 *
 * A deck whose slides are pictures of slides (a scanned PDF, a pptx of one picture per
 * slide) is offered its reading in one place, the notice band under the top bar, in
 * the intake and over the review alike: the first picture as a thumbnail, one sentence
 * ("All 15 slides are pictures. Read their text to rebuild them as slides."), Read the
 * text and Keep as pictures. Read the text is a ghost until the review shows (the drop
 * area holds the one primary before that, and there is no plan to rebuild into), then
 * the band's primary, and the footer steps down while it asks. The text recognition
 * offer (size and privacy) opens only from that button. While the pictures are read,
 * the band's line is the one progress surface ("Reading slide 4 of 15. About 2 minutes
 * left."), and when the rebuild ends the footer and the live region say what it came to
 * once, with the items left to review. Keep as pictures folds the band to its sentence
 * and Read the text, so the way back stays in reach. While the band shows, the text
 * recognition readiness row folds into it, so the download is offered once.
 *
 * Every function takes `rb` first; calls into other modules go through `rb.<module>`.
 *
 * The region is built once, in `wireIntake`, from DOM nodes (the mode segment is the
 * shared `segHtml` markup, mounted once), and each render only sets text, attributes,
 * `hidden` and the lists, so a redraw never moves focus off a button the person is on.
 * Pictures (the frames, thumbnails and wireframes) are parsed from SVG as nodes, never
 * assigned as markup. View-only state (the recent list, a readiness row the person set
 * aside, a note about a file that is not a deck, the reading clock) lives in a WeakMap
 * keyed by the context and never reaches the controller.
 */
import { buildDeckTheme } from '@lolly/engine';
import type { SlideMasterV1 } from '@lolly-tools/core';
import type { CompiledFrameV1, ProjectStageV1 } from '@lolly-tools/core/rebrand-v1';
import { confirmDialog, promptDialog } from '../../components/confirm-dialog.ts';
import { mountModal } from '../../components/modal.ts';
import { tRaw } from '../../i18n.ts';
import { menuItemHtml, wireTileContextMenu, type ContextMenuSheetHead, type TileContextMenuHandle } from '../../lib/context-menu.ts';
import { takePendingRebrandFiles } from '../../lib/drop-router.ts';
import { fmtBytes, relativeTime } from '../../lib/format.ts';
import { icon, type IconName } from '../../lib/icons.ts';
import { ensureModel } from '../../lib/model-offer.ts';
import { slidePictureIdsOf } from '../../lib/rebrand/controller.ts';
import { setRebrandPdfReaders } from '../../lib/rebrand/deps.ts';
import type {
  RebrandBatchRowV1,
  RebrandEditOutcomeV1,
  RebrandErrorV1,
  RebrandPresetSummaryV1,
  RebrandProgressV1,
  RebrandProjectSummaryV1,
  RebrandResolvedSystemV1,
  RebrandStateV1,
} from '../../lib/rebrand/controller-api.ts';
import { resolveActiveDesignSystem } from '../../lib/rebrand/design-system.ts';
import { personalPresetId } from '../../lib/rebrand/presets.ts';
import type { ReadinessActionV1, ReadinessItemV1 } from '../../lib/rebrand/readiness.ts';
import { segHtml } from '../../lib/seg.ts';
import { layoutThumb, svgNode } from '../../lib/slide-structures-ui.ts';
import { isPdfUpload, isPptxUpload } from '../../lib/upload-types.ts';
import { escape as htmlEscape } from '../../utils.ts';
import { archetypeThumbSvg } from '../free-canvas/archetype-thumb.ts';
import { bindOp, type RbCtx } from './context.ts';
import { framesForSlide } from './shared.ts';

/** What the file input offers: a PowerPoint deck or a PDF. */
const DECK_ACCEPT = '.pptx,.pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/pdf';

/** The frames the reading row draws before it counts the rest ("+28"). */
export const READ_FRAMES_MAX = 12;

/** The width of a recent project's thumbnail, in CSS px at the base type size. */
const RECENT_THUMB_W = 64;

/** The id of the reason a Read the text that cannot run yet is described by. */
const PICTURES_WHY_ID = 'rb-pictures-why';

// ─── view-only state ─────────────────────────────────────────────────────────

interface IntakeEls {
  inner: HTMLElement;
  heading: HTMLElement;
  system: HTMLElement;
  systemSwatches: HTMLElement;
  systemText: HTMLElement;
  mode: HTMLElement;
  modeHelp: HTMLElement;
  drop: HTMLElement;
  input: HTMLInputElement;
  notice: HTMLElement;
  progress: HTMLElement;
  progressLine: HTMLElement;
  progressFile: HTMLElement;
  progressFrames: HTMLElement;
  cancel: HTMLButtonElement;
  error: HTMLElement;
  errorLine: HTMLElement;
  errorActions: HTMLElement;
  ready: HTMLElement;
  readyList: HTMLElement;
  recent: HTMLElement;
  recentList: HTMLElement;
  presetLine: HTMLElement;
  presetText: HTMLElement;
  batch: HTMLElement;
  batchHead: HTMLElement;
  batchList: HTMLElement;
  pictures: HTMLElement;
  picturesArt: HTMLElement;
  picturesLine: HTMLElement;
  picturesNote: HTMLElement;
  picturesRead: HTMLButtonElement;
  picturesKeep: HTMLButtonElement;
}

interface IntakeLocal {
  els: IntakeEls | null;
  /** Null while the first read of the store is in flight. */
  recent: RebrandProjectSummaryV1[] | null;
  /** Bumped whenever `recent` is replaced, for the memo key. */
  recentVersion: number;
  /** Readiness rows the person chose to go on without. */
  setAside: Set<string>;
  /** A plain line about a file that was not taken, or null. */
  notice: string | null;
  /** The phase the last render drew, so a return to idle re-reads the recent list. */
  lastPhase: RebrandStateV1['phase'] | null;
  /** The mode the last render drew, so a switch clears what the last pick left behind. */
  lastMode: RebrandStateV1['mode'] | null;
  /** The error last said through the live region, so a redraw never says it again. */
  announcedError: string;
  /** An error the person moved past (a new file, a new pick, a mode switch): it stays off screen. */
  dismissedError: string;
  /** The presets on offer, once read; empty hides the preset line. */
  presets: RebrandPresetSummaryV1[];
  /** A model download or a read of the pictures started from a button, so the button waits instead of asking twice. */
  downloading: boolean;
  /**
   * The project whose slide pictures the person chose to go on with: its notice folds
   * to the sentence and Read the text, so the way back stays in reach.
   */
  picturesKept: string | null;
  /** The project whose slide pictures are being read and rebuilt, from the read until the progress clears. */
  rebuilding: string | null;
  /**
   * How many slide pictures the open deck had when its rebuild started, so the end of a
   * rebuild the controller started on its own (a picture deck read as it opens) can say
   * what it came to.
   */
  rebuildFrom: { projectId: string; pictures: number } | null;
  /** When the current read of the slide pictures started, and from which count, for the time left. */
  readClock: { projectId: string; startedAt: number; done: number } | null;
  /**
   * What the last read of the slide pictures, or the choice to keep them, came to,
   * shown in the notice while the same deck has the same pictures. `retry` is false
   * when the read could not rebuild the slides left, so it is not offered again.
   */
  picturesOutcome: { projectId: string; pictures: number; text: string; retry: boolean } | null;
  /** The design system the deck goes into, once read; null when it cannot be read here. */
  system: RebrandResolvedSystemV1 | null | undefined;
  /** The recent rows' menu (Open, Delete). */
  menu: TileContextMenuHandle | null;
}

const LOCAL = new WeakMap<RbCtx, IntakeLocal>();

function localOf(rb: RbCtx): IntakeLocal {
  let local = LOCAL.get(rb);
  if (!local) {
    local = {
      els: null,
      recent: null,
      recentVersion: 0,
      setAside: new Set(),
      notice: null,
      lastPhase: null,
      lastMode: null,
      announcedError: '',
      dismissedError: '',
      presets: [],
      downloading: false,
      picturesKept: null,
      rebuilding: null,
      rebuildFrom: null,
      readClock: null,
      picturesOutcome: null,
      system: undefined,
      menu: null,
    };
    LOCAL.set(rb, local);
  }
  return local;
}

// ─── small DOM helpers (this module builds nodes, never markup) ─────────────

function node<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function button(className: string, label: string, glyphName?: IconName): HTMLButtonElement {
  const el = node('button', className);
  el.type = 'button';
  const glyph = glyphName ? glyphNode(glyphName) : null;
  if (glyph) el.append(glyph);
  el.append(node('span', 'rb-btn-label', label));
  return el;
}

/** Set a button's words without touching its glyph. */
function setLabel(el: HTMLElement, label: string): void {
  const span = el.querySelector('.rb-btn-label');
  if (span) span.textContent = label;
  else el.textContent = label;
}

/** A registered glyph as a node: the icon registry's markup read as SVG, so no HTML sink is involved. */
function glyphNode(name: IconName): Node | null {
  const markup = icon(name);
  if (!markup || typeof DOMParser === 'undefined') return null;
  const parsed = new DOMParser().parseFromString(markup, 'image/svg+xml').documentElement;
  if (parsed?.localName !== 'svg') return null;
  return document.importNode(parsed, true);
}

/** An `href` a stored picture may keep: a data picture, an object URL, the page's own origin or a fragment. */
const SAFE_HREF = /^(?:#|data:image\/|blob:|https?:)/i;

/**
 * Stored SVG (a project's first-slide thumbnail, read back from the store) as a node,
 * with what could run taken out while it is still an inert parsed document: scripts,
 * foreign content, event attributes and links that are not pictures. The engine's own
 * drawings go through `svgNode` directly.
 */
export function storedSvgNode(markup: string): Element | null {
  if (!markup || typeof DOMParser === 'undefined') return null;
  const doc = new DOMParser().parseFromString(markup, 'image/svg+xml');
  const root = doc.documentElement;
  if (root?.localName !== 'svg' || doc.getElementsByTagName('parsererror').length) return null;
  for (const bad of [...root.querySelectorAll('script, foreignObject, iframe, object, embed')]) bad.remove();
  for (const el of [root, ...root.querySelectorAll('*')]) {
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on')) el.removeAttribute(attr.name);
      else if ((name === 'href' || name === 'xlink:href') && !SAFE_HREF.test(attr.value.trim())) el.removeAttribute(attr.name);
    }
  }
  return document.importNode(root, true);
}

/** True when the person asked for calm previews: glyphs stand in for every picture. */
function previewsHidden(): boolean {
  return typeof document !== 'undefined' && document.documentElement.getAttribute('data-a11y-previews') === 'hidden';
}

// ─── copy ────────────────────────────────────────────────────────────────────

/**
 * The slide in hand while slides are read one after another, counted from 1: the count
 * a reader reports is of slides finished, so the one being read is one more, and the
 * first reads as 1, not 0.
 */
export function slideInHand(done: number, total: number): number {
  return Math.max(1, Math.min(done + 1, total));
}

/** The time a read of the slide pictures has left, in words, or '' until one picture is read. */
export function timeLeftText(msLeft: number | null): string {
  if (msLeft === null || !Number.isFinite(msLeft) || msLeft < 0) return '';
  if (msLeft < 60_000) return tRaw('Less than a minute left.');
  const minutes = Math.round(msLeft / 60_000);
  return minutes <= 1 ? tRaw('About a minute left.') : tRaw('About {n} minutes left.', { n: minutes });
}

/**
 * The progress of reading the slide pictures: the slide in hand, counted from 1, and,
 * once one picture is read, the time left ("Reading slide 4 of 15. About 2 minutes
 * left."). The total is the slides that are pictures.
 */
export function readingPicturesText(progress: RebrandProgressV1 | null, msLeft: number | null = null): string {
  if (progress?.step !== 'read') return '';
  const { done, total } = progress;
  if (typeof done !== 'number' || typeof total !== 'number' || total <= 0) return tRaw('Reading the slide pictures');
  const line = tRaw('Reading slide {n} of {total}.', { n: slideInHand(done, total), total });
  const left = timeLeftText(msLeft);
  return left ? `${line} ${left}` : line;
}

/** The progress sentence: counts where the step knows them, never a percentage. */
export function progressText(progress: RebrandProgressV1 | null): string {
  if (!progress) return '';
  const { step, done, total } = progress;
  const counted = typeof done === 'number' && typeof total === 'number' && total > 0;
  switch (step) {
    case 'read':
      return counted ? tRaw('Reading slide {done} of {total}', { done: slideInHand(done, total), total }) : tRaw('Reading the deck');
    case 'census':
      return counted ? tRaw('Looking for repeated objects on {total} slides', { total }) : tRaw('Looking for repeated objects');
    case 'plan':
      return tRaw('Preparing suggestions');
    case 'preview':
    case 'compile':
      // The words the job toast uses for the same stage (`rebrandStageTitle`).
      return tRaw('Drawing the proposed slides');
    case 'handoff':
      return tRaw('Opening the slides in Design');
    case 'keep-design':
      return tRaw('Swapping in the design system');
  }
}

/** The ways on an error can offer. */
type ErrorWay = 'pick' | 'reload' | 'retry' | 'studio' | 'close' | 'report' | 'models' | 'pictures' | 'lolly';

/** One identity per error, so it is said once and set aside once. */
function errorKey(error: RebrandErrorV1): string {
  return `${error.code}|${error.step ?? ''}|${error.message}`;
}

/** The failure of a stage the person did not start by picking a file, by the step it stopped at. */
function stageCopy(error: RebrandErrorV1): { text: string; ways: ErrorWay[] } {
  switch (error.step) {
    case 'preview':
      return { text: tRaw('The proposed slides could not be updated.'), ways: ['retry'] };
    case 'plan':
      return { text: tRaw('The suggestions could not be updated.'), ways: ['retry'] };
    case 'compile':
    case 'handoff':
      return { text: tRaw('Design did not open the slides. Try Open in Design again.'), ways: [] };
    case 'keep-design':
      return { text: tRaw('The design system could not be swapped into this deck.'), ways: ['retry'] };
    default:
      return { text: tRaw('Reading the deck did not finish.'), ways: ['reload', 'pick'] };
  }
}

/** The line for a file that is not a deck. */
function notADeckText(): string {
  return tRaw('Choose a .pptx or .pdf file.');
}

/** One plain sentence per error code, and what the person can do next. */
export function errorCopy(error: RebrandErrorV1): { text: string; ways: ErrorWay[] } {
  switch (error.code) {
    case 'source.unreadable':
      return { text: tRaw('This file could not be read as a deck.'), ways: ['pick'] };
    case 'source.too-large':
      return { text: tRaw('This deck is larger than this device can read.'), ways: ['pick'] };
    case 'source.encrypted':
      return { text: tRaw('This deck is protected by a password, so it cannot be read.'), ways: ['pick'] };
    case 'unsupported-file':
      return { text: notADeckText(), ways: ['pick'] };
    case 'plan.hash-mismatch':
      return { text: tRaw('The saved decisions belong to a different copy of this deck.'), ways: ['pick', 'close'] };
    case 'plan.revision-stale':
      return { text: tRaw('Another tab changed this project, so reload it first.'), ways: ['reload'] };
    case 'plan.invalid':
      return { text: tRaw('The saved decisions could not be read.'), ways: ['pick', 'close'] };
    case 'no-design-system':
      return { text: tRaw('No design system is active on this device.'), ways: ['studio'] };
    case 'design-system.master-missing':
      return { text: tRaw('The design system has no slide master, and the neutral one could not be loaded.'), ways: ['studio'] };
    case 'design-system.logo-missing':
      return { text: tRaw('The design system has no mark to place on the slides.'), ways: ['studio'] };
    case 'ocr.unavailable':
      return { text: tRaw('Text recognition is not installed on this device.'), ways: ['models', 'pictures'] };
    case 'storage.quota':
      return { text: tRaw('This device has no room left to save the project. Download it to keep your decisions.'), ways: ['lolly', 'close'] };
    case 'cancelled':
      return { text: tRaw('Reading stopped.'), ways: ['pick'] };
    case 'compile.unresolved-objects':
      // The waiting cards are on the To review tab, which the review already shows.
      return { text: tRaw('Review the items in To review before the slides open in Design.'), ways: [] };
    case 'export.failed':
      return { text: tRaw('The file could not be made.'), ways: ['retry'] };
    case 'stage-failed':
      return stageCopy(error);
  }
}

/** The stage a stored project reached, in the words the recent list uses. */
function stageWords(stage: ProjectStageV1): string {
  switch (stage) {
    case 'ingest':
      return tRaw('not read yet');
    case 'census':
    case 'plan':
      return tRaw('being prepared');
    case 'review':
      return tRaw('ready to review');
    case 'compile':
      return tRaw('opening in Design');
    case 'done':
      return tRaw('opened in Design');
  }
}

export function recentMeta(project: RebrandProjectSummaryV1): string {
  const parts: string[] = [];
  if (typeof project.slides === 'number') {
    parts.push(project.slides === 1 ? tRaw('1 slide') : tRaw('{n} slides', { n: project.slides }));
  }
  parts.push(stageWords(project.stage));
  const when = relativeTime(project.updatedAt);
  if (when) parts.push(when);
  return parts.join(', ');
}

/** A deck of a multi-file read, in one word or a short phrase. */
export function batchWords(row: RebrandBatchRowV1): string {
  switch (row.state) {
    case 'waiting':
      return tRaw('Waiting');
    case 'reading':
      return tRaw('Reading');
    case 'ready':
      return tRaw('Ready to review');
    case 'failed':
      return row.error ? errorCopy({ code: row.error, message: '' }).text : tRaw('Reading the deck did not finish.');
  }
}

/** The preset line: which preset the next read applies. */
export function presetLineText(presets: RebrandPresetSummaryV1[], id: string | undefined): string {
  if (!id) return tRaw('Preset: none');
  return tRaw('Preset: {name}', { name: presets.find((preset) => preset.id === id)?.name ?? id });
}

/** The design system line on the intake: the name of what the deck goes into. */
export function intoLine(name: string, neutralMaster: boolean): string {
  return neutralMaster
    ? tRaw('Into {name}, with the neutral slide master', { name })
    : tRaw('Into {name}', { name });
}

/** The one help line under the mode segment, following the pressed half. */
export function modeHelpText(mode: RebrandStateV1['mode']): string {
  return mode === 'keep-design'
    ? tRaw('Swaps in the theme, colours and fonts.')
    : tRaw('Rebuilds each slide on the slide master.');
}

/** What a readiness row's button does, in this view's words. */
type ReadinessWay = ReadinessActionV1 | 'studio';

/**
 * The readiness row in this view's words, keyed on the row's id and state rather than
 * on the English sentence the readiness module keeps for its log. A missing master or
 * mark is fixed in the design system studio, never by a download or another file.
 */
export function readinessCopy(item: ReadinessItemV1): { text: string; ways: ReadinessWay[] } {
  const [kind = '', tag = ''] = item.id.split(':');
  const picturesOrFile: ReadinessWay[] = item.actions.filter((a) => a === 'continue-with-pictures' || a === 'choose-another-file');
  switch (kind) {
    case 'ocr':
      // A deck whose only need of text recognition is its charts' outlined labels.
      if (tag === 'labels') {
        return { text: tRaw('Chart labels are drawn as outlines. Download text recognition to read them as text.'), ways: item.actions };
      }
      if (item.state === 'downloadable') {
        return { text: tRaw('Text recognition is not installed. Downloading it sends nothing from the deck.'), ways: item.actions };
      }
      return { text: tRaw('Text recognition is not available on this device, so pictures stay as they are.'), ways: picturesOrFile };
    case 'layout-model':
      return { text: tRaw('Slide layout reading is not available on this device, so parts of some slides stay as pictures.'), ways: picturesOrFile };
    case 'master':
      return item.state === 'unknown'
        ? { text: tRaw('Lolly could not check the slide master on this device.'), ways: ['studio'] }
        : { text: tRaw('The slide master of the design system is not on this device.'), ways: ['studio'] };
    case 'logo': {
      if (item.state === 'unknown') return { text: tRaw('Lolly could not check the design system mark on this device.'), ways: ['studio'] };
      const side = tag.toLowerCase();
      const text = side.includes('dark')
        ? tRaw('The design system has no mark for dark slides, so slides that need one keep theirs and ask for review.')
        : side.includes('light')
          ? tRaw('The design system has no mark for light slides, so slides that need one keep theirs and ask for review.')
          : tRaw('The design system has no mark, so slides that need one keep theirs and ask for review.');
      return { text, ways: ['studio'] };
    }
    default:
      return { text: item.message, ways: picturesOrFile };
  }
}

function readinessWayLabel(way: ReadinessWay): string {
  switch (way) {
    case 'download':
      return tRaw('Download text recognition');
    case 'continue-with-pictures':
      return tRaw('Keep as pictures');
    case 'choose-another-file':
      return tRaw('Choose another file');
    case 'studio':
      return tRaw('Open the design system studio');
  }
}

// ─── work ────────────────────────────────────────────────────────────────────

/** Re-read the projects on this device and redraw the list. */
export async function refreshRecent(rb: RbCtx): Promise<void> {
  const local = localOf(rb);
  let list: RebrandProjectSummaryV1[];
  try {
    list = await rb.controller.recent();
  } catch {
    list = [];
  }
  local.recent = list;
  local.recentVersion += 1;
  renderIntake(rb);
}

/** Take one file: a pptx starts a project; anything else is named and left alone. */
export async function takeFile(rb: RbCtx, file: File): Promise<void> {
  await takeFiles(rb, [file]);
}

/**
 * Take the files a pick or a drop handed over. The decks among them start one read
 * (several decks are read one after another under one job); a file that is not a deck
 * is named and left alone.
 */
export async function takeFiles(rb: RbCtx, files: File[]): Promise<void> {
  const local = localOf(rb);
  // A new file moves past whatever went wrong with the last one, and past the rows it needed.
  if (rb.state.error) local.dismissedError = errorKey(rb.state.error);
  local.setAside.clear();
  const decks = files.filter((file) => isPptxUpload(file) || isPdfUpload(file));
  const others = files.length - decks.length;
  if (decks.length === 0) {
    local.notice = notADeckText();
    rb.announce(local.notice);
    renderIntake(rb);
    return;
  }
  local.notice = others === 0
    ? null
    : others === 1
      ? tRaw('1 file is not a PowerPoint deck or a PDF, so it was left out.')
      : tRaw('{n} files are not PowerPoint decks or PDFs, so they were left out.', { n: others });
  if (local.notice) rb.announce(local.notice);
  renderIntake(rb);
  try {
    const [first] = decks;
    if (decks.length > 1 && rb.controller.startMany) await rb.controller.startMany(decks);
    else if (first) await rb.controller.start(first);
  } catch {
    local.notice = tRaw('This file could not be read as a deck.');
    rb.announce(local.notice);
  }
  void refreshRecent(rb);
}

/** The value the preset choice uses for running with no preset. */
const NO_PRESET = '__none__';

/**
 * The single-choice list a preset is chosen from: one radio row per preset, the current
 * one checked, where a personal preset came from on a second line, and one Apply.
 * Resolves the chosen id, or null on Cancel, Escape or the backdrop.
 */
function presetChoice(list: RebrandPresetSummaryV1[], current: string | null, applyLabel: string): Promise<string | null> {
  const row = (id: string, name: string, origin: string): string => {
    const checked = (id === NO_PRESET ? current === null : id === current) ? ' checked' : '';
    return `<label class="rb-choice rb-preset-row"><input type="radio" name="rb-preset" value="${htmlEscape(id)}"${checked}>`
      + `<span class="rb-preset-text"><span class="rb-preset-name">${htmlEscape(name)}</span>`
      + (origin ? `<span class="rb-preset-origin">${htmlEscape(origin)}</span>` : '')
      + '</span></label>';
  };
  const title = tRaw('Choose a preset');
  const content = `<h2 class="modal-title">${htmlEscape(title)}</h2>`
    + `<p class="modal-msg">${htmlEscape(tRaw('A preset sets the first suggestions for each kind of object. Every suggestion stays reversible.'))}</p>`
    + `<fieldset class="rb-preset-list"><legend class="visually-hidden">${htmlEscape(title)}</legend>`
    + row(NO_PRESET, tRaw('No preset'), '')
    + list.map((preset) => row(preset.id, preset.name, preset.origin === 'personal' ? tRaw('Saved on this device') : '')).join('')
    + '</fieldset>'
    + '<div class="modal-actions">'
    + `<button type="button" class="btn modal-cancel" data-act="cancel">${htmlEscape(tRaw('Cancel'))}</button>`
    + `<button type="button" class="btn modal-primary" data-act="ok">${htmlEscape(applyLabel)}</button>`
    + '</div>';
  return new Promise((resolve) => {
    const modal = mountModal<string | null>(content, {
      className: 'modal rb-preset-dialog',
      ariaLabel: title,
      cancelValue: null,
      initialFocus: (el) => el.querySelector<HTMLElement>('input[name="rb-preset"]:checked'),
      onClose: (result) => resolve(result ?? null),
    });
    modal.el.addEventListener('click', (event) => {
      const act = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-act]')?.dataset.act : undefined;
      if (act === 'cancel') modal.close(null);
      if (act !== 'ok') return;
      modal.close(modal.el.querySelector<HTMLInputElement>('input[name="rb-preset"]:checked')?.value ?? null);
    });
  });
}

/**
 * Choose a preset from a single-choice list. `next` sets the one the next read
 * applies (the intake); `apply` runs the first pass again with it over the open plan.
 * The result shows in the footer's outcome line as well as through the live region.
 */
export async function choosePreset(rb: RbCtx, mode: 'next' | 'apply'): Promise<void> {
  const list = (await rb.controller.presets?.()) ?? [];
  if (list.length === 0) return;
  const current = mode === 'apply' ? rb.state.plan?.presetId ?? null : rb.state.nextPresetId ?? null;
  const chosen = await presetChoice(list, current, mode === 'apply' ? tRaw('Apply') : tRaw('Choose'));
  if (chosen === null) return;
  const presetId = chosen === NO_PRESET ? null : chosen;
  const name = presetId === null ? tRaw('No preset') : list.find((preset) => preset.id === presetId)?.name ?? presetId;
  if (mode === 'next') {
    rb.controller.choosePreset?.(presetId);
    rb.announce(tRaw('Preset: {name}.', { name }));
    return;
  }
  const outcome = await rb.controller.applyPreset?.(presetId);
  if (!outcome) return;
  if (outcome.ok) rb.foot.say(tRaw('Applied {name}.', { name }), { undo: true });
  else if (outcome.refusal === 'nothing-to-do') rb.foot.say(tRaw('{name} is already applied.', { name }));
  else rb.foot.say(tRaw('The preset could not be applied. Try again in a moment.'));
}

/**
 * Save the decisions on the open plan as a personal preset, under a name the person
 * gives. A blank name asks again with the reason; a name that would replace one of the
 * person's own presets asks first.
 */
export async function savePreset(rb: RbCtx): Promise<void> {
  let error: string | undefined;
  let value = '';
  let name: string | null = null;
  for (;;) {
    const typed = await promptDialog({
      title: tRaw('Save as my preset'),
      message: tRaw('Name the preset. It keeps the actions you chose for each kind of object.'),
      confirmLabel: tRaw('Save'),
      placeholder: tRaw('For example, Quarterly decks'),
      value,
      ...(error ? { error } : {}),
    });
    if (typed === null) return;
    if (typed.trim()) {
      name = typed.trim();
      break;
    }
    error = tRaw('Type a name for the preset.');
    value = typed;
  }
  const id = personalPresetId(name);
  const mine = localOf(rb).presets.find((preset) => preset.origin === 'personal' && preset.id === id);
  if (mine) {
    const replace = await confirmDialog({
      title: tRaw('Replace {name}?', { name: mine.name }),
      message: tRaw('A preset of yours already has this name. Saving replaces it with the actions on this deck.'),
      confirmLabel: tRaw('Replace'),
    });
    if (!replace) return;
  }
  const outcome = await rb.controller.savePreset?.(name);
  rb.foot.say(outcome?.ok
    ? tRaw('Saved {name} as a preset on this device.', { name })
    : tRaw('The preset could not be saved.'));
  if (outcome?.ok) await refreshPresets(rb);
}

/** True once the presets on offer are read and there is at least one. */
export function hasPresets(rb: RbCtx): boolean {
  return localOf(rb).presets.length > 0;
}

/** Read the presets on offer, for the preset line. */
export async function refreshPresets(rb: RbCtx): Promise<void> {
  const local = localOf(rb);
  try {
    local.presets = (await rb.controller.presets?.()) ?? [];
  } catch {
    local.presets = [];
  }
  rb.memo.intake = '';
  renderIntake(rb);
}

/** Read the design system the deck goes into, once, for the line under the heading. */
async function refreshSystem(rb: RbCtx): Promise<void> {
  const local = localOf(rb);
  // The view's host reads the active design system; a host without one says nothing here.
  const host: RbCtx['host'] | undefined = rb.host;
  if (!host) {
    local.system = null;
    return;
  }
  try {
    local.system = await resolveActiveDesignSystem(host);
  } catch {
    local.system = null;
  }
  rb.memo.intake = '';
  renderIntake(rb);
}

/** How many slides of the open deck are still one picture of a whole slide, and of how many. */
function pictureCounts(state: RebrandStateV1): { pictures: number; total: number } {
  const source = state.source;
  if (!source) return { pictures: 0, total: 0 };
  return { pictures: slidePictureIdsOf(source).length, total: source.slides.length };
}

/**
 * The notice over a deck whose slides are pictures of slides: one sentence, with its
 * numbers, that states the fact and what reading their text does. `unreadable` is true
 * when this device has no text recognition.
 */
export function picturesText(pictures: number, total: number, unreadable = false): string {
  // Most slides pictures: a picture deck. The sentence names the fact and the offer,
  // and the buttons beside it are the offer itself.
  if (!unreadable && pictures * 2 > total) {
    if (pictures >= total) {
      return pictures === 1
        ? tRaw('The slide is a picture. Read its text to rebuild it as a slide.')
        : tRaw('All {n} slides are pictures. Read their text to rebuild them as slides.', { n: pictures });
    }
    return tRaw('{n} of {total} slides are pictures. Read their text to rebuild them as slides.', { n: pictures, total });
  }
  // The fact, then what it means here: this device cannot read the text, or the text
  // stays part of the picture. No promise of a later change.
  if (pictures >= total) {
    if (pictures === 1) {
      return unreadable
        ? tRaw('The slide is a picture. This device cannot read its text.')
        : tRaw('The slide is a picture. Its text stays part of the picture.');
    }
    return unreadable
      ? tRaw('All {n} slides are pictures. This device cannot read their text.', { n: pictures })
      : tRaw('All {n} slides are pictures. Their text stays part of the pictures.', { n: pictures });
  }
  if (pictures === 1) {
    return unreadable
      ? tRaw('1 of {total} slides is a picture. This device cannot read its text.', { total })
      : tRaw('1 of {total} slides is a picture. Its text stays part of the picture.', { total });
  }
  return unreadable
    ? tRaw('{n} of {total} slides are pictures. This device cannot read their text.', { n: pictures, total })
    : tRaw('{n} of {total} slides are pictures. Their text stays part of the pictures.', { n: pictures, total });
}

/** True when the open deck is under review with a plan, the only time its slide pictures can be read. */
function picturesReadable(state: RebrandStateV1): boolean {
  return state.phase === 'review' && Boolean(state.plan);
}

/** The cards left to review after a rebuild, as a sentence, in the footer's unit. */
export function leftToReviewText(left: number): string {
  if (left <= 0) return tRaw('Nothing is left to review.');
  return left === 1 ? tRaw('1 card is left to review.') : tRaw('{n} cards are left to review.', { n: left });
}

/**
 * What reading the slide pictures did, in one line, or null when there is nothing to
 * say. `left` adds the items left to review once the rebuilt deck is in the review.
 */
export function picturesOutcomeText(outcome: RebrandEditOutcomeV1, left?: number): string | null {
  const tail = typeof left === 'number' ? ` ${leftToReviewText(left)}` : '';
  if (outcome.ok) {
    if (outcome.skipped === 0) {
      return (outcome.touched === 1
        ? tRaw('Rebuilt 1 slide from its picture.')
        : tRaw('Rebuilt {n} slides from their pictures.', { n: outcome.touched })) + tail;
    }
    return tRaw('Rebuilt {n} of {total} slides from their pictures. The others stay pictures.', { n: outcome.touched, total: outcome.touched + outcome.skipped }) + tail;
  }
  if (outcome.refusal === 'nothing-to-do' && outcome.skipped > 0) {
    return tRaw('No slide could be rebuilt from its picture, so they stay pictures.');
  }
  if (outcome.refusal === 'busy') return tRaw('Reading the slide pictures stopped, so the slides stay as they were.');
  return null;
}

/** The items the To review tab counts, through the footer, which owns that number. */
function leftToReview(rb: RbCtx): number | undefined {
  const foot: RbCtx['foot'] | undefined = rb.foot;
  return typeof foot?.toReviewCount === 'function' ? foot.toReviewCount() : undefined;
}

/**
 * Say what a read of the slide pictures came to, once: in the footer's outcome line and
 * the live region together (`rb.foot.say` does both), and in the band while the same
 * deck still has pictures left. The footer line leaves out the cards left, which the
 * counts beside it already show; the live region hears the whole sentence.
 */
function sayPicturesOutcome(rb: RbCtx, outcome: RebrandEditOutcomeV1, asked: string | undefined): void {
  const local = localOf(rb);
  const said = picturesOutcomeText(outcome, outcome.ok ? leftToReview(rb) : undefined);
  const projectId = rb.state.project?.id;
  // Kept only over the deck it was about: another deck may have opened meanwhile.
  if (said && projectId && projectId === asked) {
    local.picturesOutcome = { projectId, pictures: pictureCounts(rb.state).pictures, text: said, retry: outcome.skipped === 0 };
  }
  if (!said) return;
  if (outcome.ok) rb.foot.say(picturesOutcomeText(outcome) ?? said, { spoken: said });
  else rb.announce(said);
}

/**
 * Read the text in the slide pictures: the controller offers the text recognition model
 * in place first (`ensureModel`), then rebuilds each slide as one job. Where the open
 * deck has no slide picture, or the controller does not read them, text recognition is
 * downloaded in place on its own: the sheet names the size and what needs it, the job
 * toast shows the download, and the deck never rides along. Either way the readiness
 * rows are checked again afterwards.
 */
export async function offerTextReading(rb: RbCtx): Promise<void> {
  const local = localOf(rb);
  if (local.downloading) return;
  local.downloading = true;
  rb.memo.intake = '';
  renderIntake(rb);
  try {
    // Before the review there is no plan to rebuild into: the model is offered on its
    // own, and Read the text works once the deck is ready.
    const readable = pictureCounts(rb.state).pictures > 0 && picturesReadable(rb.state);
    const asked = rb.state.project?.id;
    const outcome = readable ? await rb.controller.readSlidePictures?.() : undefined;
    if (outcome && outcome.refusal !== 'not-built') {
      sayPicturesOutcome(rb, outcome, asked);
      return;
    }
    const ready = await ensureModel('ocr', { reason: tRaw('Reading text in slide pictures') });
    if (ready) await rb.controller.refreshReadiness?.();
  } finally {
    local.downloading = false;
    rb.memo.intake = '';
    renderIntake(rb);
  }
}

/** Open the file picker. */
export function pickFile(rb: RbCtx): void {
  localOf(rb).els?.input.click();
}

function navigate(url: string): void {
  void import('../../nav.ts').then(({ navigateTo }) => navigateTo(url));
}

async function openProject(rb: RbCtx, id: string): Promise<void> {
  await rb.controller.open(id);
}

async function deleteProject(rb: RbCtx, project: RebrandProjectSummaryV1): Promise<void> {
  const ok = await confirmDialog({
    title: tRaw('Delete {name}?', { name: project.name }),
    message: tRaw('The project and its decisions are deleted from this device. The original file is not changed.'),
    confirmLabel: tRaw('Delete'),
  });
  if (!ok) return;
  // The row that had focus goes with the redraw, so focus moves to the row after it.
  const ids = (localOf(rb).recent ?? []).map((one) => one.id);
  const at = ids.indexOf(project.id);
  const nextId = ids[at + 1] ?? ids[at - 1] ?? null;
  await rb.controller.remove(project.id);
  rb.announce(tRaw('Deleted {name}.', { name: project.name }));
  await refreshRecent(rb);
  const els = localOf(rb).els;
  if (!els) return;
  const next = nextId ? [...els.recentList.querySelectorAll<HTMLElement>('.rb-recent-row')].find((one) => one.dataset.projectId === nextId) : undefined;
  const row = next?.querySelector<HTMLElement>('.rb-recent-open') ?? null;
  (row ?? els.drop.querySelector<HTMLElement>('.rb-drop-pick'))?.focus();
}

function takeWay(rb: RbCtx, way: ErrorWay, error: RebrandErrorV1): void {
  const local = localOf(rb);
  switch (way) {
    case 'pick':
      local.dismissedError = errorKey(error);
      pickFile(rb);
      return;
    case 'reload':
    case 'retry':
      void rb.controller.reload();
      return;
    case 'close':
      rb.controller.close();
      return;
    case 'studio':
      navigate('#/start');
      return;
    case 'report':
      rb.report.open();
      return;
    case 'models':
      // The download is its own operation, offered in place; the deck never rides along.
      void offerTextReading(rb);
      return;
    case 'pictures':
      local.dismissedError = errorKey(error);
      rb.memo.intake = '';
      renderIntake(rb);
      return;
    case 'lolly':
      void rb.top.download();
      return;
  }
}

function wayLabel(way: ErrorWay): string {
  switch (way) {
    case 'pick':
      return tRaw('Choose another file');
    case 'reload':
      return tRaw('Reload');
    case 'retry':
      return tRaw('Try again');
    case 'close':
      return tRaw('Close project');
    case 'studio':
      return tRaw('Open the design system studio');
    case 'report':
      return tRaw('Open the report');
    case 'models':
      return tRaw('Download text recognition');
    case 'pictures':
      return tRaw('Keep as pictures');
    case 'lolly':
      return tRaw('Download .lolly');
  }
}

function takeReadiness(rb: RbCtx, item: ReadinessItemV1, way: ReadinessWay): void {
  switch (way) {
    case 'download':
      // The download is its own operation, offered in place; the deck never rides along.
      void offerTextReading(rb);
      return;
    case 'continue-with-pictures':
      localOf(rb).setAside.add(item.id);
      renderIntake(rb);
      return;
    case 'choose-another-file':
      pickFile(rb);
      return;
    case 'studio':
      navigate('#/start');
      return;
  }
}

/** Keep the slide pictures as they are: the band folds to its sentence and Read the text. */
function keepPictures(rb: RbCtx): void {
  const local = localOf(rb);
  const projectId = rb.state.project?.id ?? null;
  local.picturesKept = projectId;
  local.setAside.add('ocr');
  const said = tRaw('The slide pictures stay as they are.');
  if (projectId) local.picturesOutcome = { projectId, pictures: pictureCounts(rb.state).pictures, text: said, retry: true };
  rb.memo.intake = '';
  renderIntake(rb);
  rb.foot.say(said);
}

// ─── wiring ──────────────────────────────────────────────────────────────────

/** The PDF import's own codec and decoders, loaded the first time a PDF deck is read. */
async function pdfImportReaders() {
  const { rebrandPdfReaders } = await import('../pdf-import.ts');
  return rebrandPdfReaders();
}

/** The two modes, in the order the segment shows them. */
const MODES = ['renovate', 'keep-design'] as const;

function modeLabel(mode: RebrandStateV1['mode']): string {
  return mode === 'keep-design' ? tRaw('Keep the design') : tRaw('Renovate the layout');
}

/** Mount-time wiring: listeners on the intake region, the pending drop-router file. */
export function wireIntake(rb: RbCtx): void {
  const local = localOf(rb);
  // A PDF deck reads with the pictures, masks and gradients the PDF import reads.
  setRebrandPdfReaders(pdfImportReaders);
  const root = rb.els.intake;
  root.replaceChildren();

  const inner = node('div', 'rb-intake-inner');
  const head = node('header', 'rb-intake-head');
  const heading = node('h2', 'rb-intake-title', tRaw('Choose a deck to rebrand'));
  // The design system the deck goes into: its three colours and its name, once read.
  const system = node('p', 'rb-intake-system');
  const systemSwatches = node('span', 'rb-intake-sws');
  systemSwatches.setAttribute('aria-hidden', 'true');
  const systemText = node('span', 'rb-intake-system-name');
  system.append(systemSwatches, systemText);
  system.hidden = true;
  // The mode, offered before a file is chosen: the top bar's mode control appears only
  // once a project is open. One help line follows the pressed half.
  const modeHost = node('div', 'rb-intake-mode-host');
  modeHost.innerHTML = segHtml('rb-intake-mode', MODES.map((id) => ({ id, label: modeLabel(id) })), rb.state.mode, tRaw('Mode'), {
    variant: 'panel',
    attr: 'data-intake-mode',
    extraClass: 'rb-intake-mode',
  });
  const mode = modeHost.querySelector<HTMLElement>('.lp-seg') ?? modeHost;
  const modeHelp = node('p', 'lp-help rb-intake-help');
  head.append(heading, system, modeHost, modeHelp);

  const drop = node('div', 'rb-drop');
  drop.dataset.drop = '';
  const dropTitle = node('p', 'rb-drop-title', tRaw('Drop a PowerPoint or PDF deck here'));
  const pick = button('btn btn--primary rb-drop-pick', tRaw('Choose a deck'), 'upload');
  const dropNote = node('p', 'rb-drop-note', tRaw('Read on this device, not uploaded. A 30-slide deck takes about 5 seconds.'));
  const input = node('input');
  input.type = 'file';
  input.accept = DECK_ACCEPT;
  input.multiple = true;
  input.hidden = true;
  drop.append(dropTitle, pick, dropNote, input);

  // The preset the next read applies, and the choice of it.
  const presetLine = node('p', 'rb-intake-preset');
  const presetText = node('span', 'rb-intake-preset-text');
  const presetPick = button('btn btn--ghost btn--sm rb-intake-preset-pick', tRaw('Choose a preset'), 'sliders');
  presetLine.append(presetText, presetPick);
  presetLine.hidden = true;

  // The decks of a multi-file read, each with its state.
  const batch = node('section', 'rb-batch');
  const batchHead = node('h3', 'rb-intake-subtitle', tRaw('Decks being read'));
  batchHead.id = 'rb-batch-title';
  batch.setAttribute('aria-labelledby', batchHead.id);
  const batchList = node('ul', 'rb-recent-list rb-batch-list');
  batch.append(batchHead, batchList);
  batch.hidden = true;

  const notice = node('p', 'rb-intake-notice');
  notice.hidden = true;

  // Reading: the one progress surface. The sentence, the file, Cancel, and the frames.
  const progress = node('section', 'rb-progress');
  progress.setAttribute('aria-label', tRaw('Progress'));
  const progressHead = node('p', 'rb-progress-head');
  const progressLine = node('b', 'rb-progress-line');
  const progressFile = node('span', 'rb-progress-file');
  const cancel = button('btn btn--text btn--sm rb-progress-cancel', tRaw('Cancel'));
  progressHead.append(progressLine, progressFile, cancel);
  const progressFrames = node('div', 'rb-progress-frames');
  progressFrames.setAttribute('aria-hidden', 'true');
  progress.append(progressHead, progressFrames);
  progress.hidden = true;

  const error = node('section', 'rb-error');
  error.setAttribute('aria-label', tRaw('Problem'));
  const errorLine = node('p', 'rb-error-line');
  const errorActions = node('div', 'rb-error-actions');
  error.append(errorLine, errorActions);
  error.hidden = true;

  // Slides that are pictures of slides: one offer, in the band under the top bar.
  // Attached only while it shows, so a hidden band never counts among the rows.
  const pictures = node('section', 'rb-pictures');
  pictures.setAttribute('aria-label', tRaw('Slide pictures'));
  const picturesArt = node('span', 'rb-pictures-art');
  picturesArt.setAttribute('aria-hidden', 'true');
  const picturesBody = node('div', 'rb-pictures-text');
  const picturesLine = node('p', 'rb-pictures-line');
  const picturesNote = node('p', 'rb-pictures-note');
  const picturesWhy = node('span', 'visually-hidden', tRaw('Waits for the deck to finish reading.'));
  picturesWhy.id = PICTURES_WHY_ID;
  picturesBody.append(picturesLine, picturesNote, picturesWhy);
  const picturesActions = node('div', 'rb-pictures-actions');
  const picturesRead = button('btn btn--ghost', tRaw('Read the text'));
  picturesRead.dataset.way = 'read-pictures';
  const picturesKeep = button('btn btn--text', tRaw('Keep as pictures'));
  picturesKeep.dataset.way = 'continue-with-pictures';
  picturesActions.append(picturesRead, picturesKeep);
  pictures.append(picturesArt, picturesBody, picturesActions);

  const ready = node('section', 'rb-ready');
  const readyHead = node('h3', 'rb-intake-subtitle', tRaw('What this deck needs'));
  const readyList = node('ul', 'rb-ready-list');
  ready.append(readyHead, readyList);
  ready.hidden = true;

  const recent = node('section', 'rb-recent');
  const recentHead = node('h3', 'rb-intake-eyebrow', tRaw('Recent projects'));
  recentHead.id = 'rb-recent-title';
  recent.setAttribute('aria-labelledby', recentHead.id);
  const recentList = node('ul', 'rb-recent-list');
  recent.append(recentHead, recentList);
  recent.hidden = true;

  inner.append(head, drop, presetLine, notice, progress, batch, error, ready, recent);
  root.append(inner);
  local.els = {
    inner,
    heading,
    system,
    systemSwatches,
    systemText,
    mode,
    modeHelp,
    drop,
    input,
    notice,
    progress,
    progressLine,
    progressFile,
    progressFrames,
    cancel,
    error,
    errorLine,
    errorActions,
    ready,
    readyList,
    recent,
    recentList,
    presetLine,
    presetText,
    batch,
    batchHead,
    batchList,
    pictures,
    picturesArt,
    picturesLine,
    picturesNote,
    picturesRead,
    picturesKeep,
  };

  pick.addEventListener('click', () => pickFile(rb));
  presetPick.addEventListener('click', () => void choosePreset(rb, 'next'));
  mode.addEventListener('click', (event) => {
    const value = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-intake-mode]')?.dataset.intakeMode : undefined;
    if (value === 'renovate' || value === 'keep-design') rb.keep.chooseMode(value);
  });
  input.addEventListener('change', () => {
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (files.length) void takeFiles(rb, files);
  });
  cancel.addEventListener('click', () => rb.controller.cancel());
  picturesRead.addEventListener('click', () => {
    // A Read the text that cannot run yet stays focusable and says why; a press does nothing.
    if (picturesRead.getAttribute('aria-disabled') === 'true') return;
    void offerTextReading(rb);
  });
  picturesKeep.addEventListener('click', () => keepPictures(rb));

  // Only a drag that carries files is taken, so text or a link dragged across the page
  // keeps the browser's own behaviour.
  const carriesFiles = (event: DragEvent): boolean => Array.from(event.dataTransfer?.types ?? []).includes('Files');
  drop.addEventListener('dragover', (event) => {
    if (!carriesFiles(event)) return;
    event.preventDefault();
    drop.classList.add('is-over');
  });
  // Crossing from the area onto its own title or button is not leaving it.
  drop.addEventListener('dragleave', (event) => {
    if (event.relatedTarget instanceof Node && drop.contains(event.relatedTarget)) return;
    drop.classList.remove('is-over');
  });
  drop.addEventListener('drop', (event) => {
    if (!carriesFiles(event)) return;
    event.preventDefault();
    drop.classList.remove('is-over');
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (files.length) void takeFiles(rb, files);
  });

  // A recent project's menu: Open and Delete, from its More button, a right-click or a
  // long press, as a sheet under a finger.
  const recentOf = (id: string): RebrandProjectSummaryV1 | undefined => (local.recent ?? []).find((one) => one.id === id);
  local.menu = wireTileContextMenu({
    host: recent,
    tileSelector: '.rb-recent-row',
    refOf: (tile) => tile.dataset.projectId ?? null,
    singleHtml: () => menuItemHtml('open', icon('folder'), tRaw('Open'))
      + menuItemHtml('delete', icon('trash'), tRaw('Delete'), { danger: true }),
    presentation: 'sheet',
    head: (target): ContextMenuSheetHead | null => {
      const project = target ? recentOf(target.ref) : undefined;
      return project ? { name: project.name } : null;
    },
    onAction: (act, target) => {
      const project = target ? recentOf(target.ref) : undefined;
      if (!project) return;
      if (act === 'open') void openProject(rb, project.id);
      else if (act === 'delete') void deleteProject(rb, project);
    },
  });
  recent.addEventListener('click', (event) => {
    const more = event.target instanceof Element ? event.target.closest<HTMLElement>('.rb-recent-more') : null;
    const row = more?.closest<HTMLElement>('.rb-recent-row');
    const ref = row?.dataset.projectId;
    if (!more || !row || !ref) return;
    const box = more.getBoundingClientRect();
    local.menu?.openAt(box.left, box.bottom, { ref, tile: row }, more);
  });
  rb.disposers.push(() => {
    local.menu?.destroy();
    local.menu = null;
  });

  const pending = takePendingRebrandFiles();
  if (pending.length) void takeFiles(rb, pending);
  void refreshRecent(rb);
  void refreshPresets(rb);
  void refreshSystem(rb);
}

// ─── drawing ─────────────────────────────────────────────────────────────────

/** A hex a style may carry, else nothing. */
const HEX = /^#[0-9a-f]{3,8}$/i;

/** The design system line: three colours (ground, ink, accent of its Light theme) and its name. */
function drawSystem(rb: RbCtx, els: IntakeEls): void {
  const local = localOf(rb);
  const resolved = local.system;
  const info = resolved?.info ?? rb.state.designSystem;
  if (!info) {
    els.system.hidden = true;
    return;
  }
  els.system.hidden = false;
  els.systemText.textContent = intoLine(info.name, info.neutralMaster);
  const light = resolved ? buildDeckTheme('light', { colors: resolved.input.colors, master: resolved.input.master }) : null;
  const tones = light ? [light.swatches.ground, light.swatches.ink, light.swatches.accent] : [];
  els.systemSwatches.replaceChildren(...tones.filter((hex) => HEX.test(hex)).map((hex) => {
    const dot = node('i', 'rb-intake-sw');
    dot.style.setProperty('--sw', hex);
    return dot;
  }));
  els.systemSwatches.hidden = els.systemSwatches.childElementCount === 0;
}

/** Press the half that matches the mode and say what it does in the one help line. */
function drawMode(rb: RbCtx, els: IntakeEls): void {
  for (const half of els.mode.querySelectorAll<HTMLElement>('[data-intake-mode]')) {
    half.setAttribute('aria-pressed', String(half.dataset.intakeMode === rb.state.mode));
  }
  els.modeHelp.textContent = modeHelpText(rb.state.mode);
}

/** The slides the reading row counts, and how many of them are read. */
function readCounts(state: RebrandStateV1): { total: number; done: number } {
  const progress = state.progress;
  const read = progress?.step === 'read' && typeof progress.total === 'number' && progress.total > 0;
  if (read) return { total: progress.total ?? 0, done: Math.max(0, Math.min(progress.done ?? 0, progress.total ?? 0)) };
  const total = state.source?.slides.length ?? 0;
  // Past the read every slide is in; before the read counts, nothing is.
  return { total, done: state.source ? total : 0 };
}

/**
 * The reading row's frames: one empty 16:9 frame per slide, at most `READ_FRAMES_MAX`
 * and then "+28", filling left to right as slides are read. A read slide shows its
 * faithful picture where the faithful deck is already drawn, else the filled frame.
 */
function drawFrames(rb: RbCtx, els: IntakeEls): void {
  const { state } = rb;
  const { total, done } = readCounts(state);
  if (total <= 0) {
    els.progressFrames.replaceChildren();
    els.progressFrames.hidden = true;
    return;
  }
  els.progressFrames.hidden = false;
  const shown = Math.min(total, READ_FRAMES_MAX);
  const faithful = state.faithful;
  const slides = state.source?.slides ?? [];
  const calm = previewsHidden();
  const frames: HTMLElement[] = [];
  for (let i = 0; i < shown; i += 1) {
    const frame = node('span', 'rb-read-frame');
    if (i < done) {
      frame.classList.add('is-read');
      const slide = slides[i];
      const drawn: CompiledFrameV1 | undefined = faithful && slide ? framesForSlide(faithful.frames, slide.id)[0] : undefined;
      const svg = !calm && faithful && drawn ? rb.compare.draw(faithful, drawn, 0, false).svg : '';
      const art = svg ? svgNode(svg) : null;
      if (art) frame.append(art);
    }
    frames.push(frame);
  }
  if (total > shown) frames.push(node('span', 'rb-read-more', tRaw('+{n}', { n: total - shown })));
  els.progressFrames.replaceChildren(...frames);
}

/** The file being read, for the reading row: the open project's, else the deck the batch is on. */
function readingName(state: RebrandStateV1): string {
  return state.project?.source?.name
    ?? state.project?.name
    ?? state.batch?.find((row) => row.state === 'reading')?.name
    ?? '';
}

function drawBatch(rb: RbCtx, els: IntakeEls, rows: RebrandBatchRowV1[]): void {
  const items = rows.map((one) => {
    const row = node('li', 'rb-recent-row rb-batch-row');
    row.dataset.batchState = one.state;
    const mark = node('span', 'rb-recent-icon');
    mark.setAttribute('aria-hidden', 'true');
    const glyph = glyphNode(one.state === 'failed' ? 'alert' : one.state === 'ready' ? 'check' : 'document');
    if (glyph) mark.append(glyph);
    const text = node('div', 'rb-recent-text');
    text.append(node('span', 'rb-recent-name', one.name), node('span', 'rb-recent-meta', batchWords(one)));
    row.append(mark, text);
    const openable = one.state === 'ready' && one.projectId && one.projectId !== rb.state.project?.id;
    if (openable && one.projectId) {
      const id = one.projectId;
      const open = button('btn btn--ghost btn--sm rb-recent-go', tRaw('Open'));
      open.setAttribute('aria-label', tRaw('Open {name}', { name: one.name }));
      open.addEventListener('click', () => void openProject(rb, id));
      row.append(open);
    }
    return row;
  });
  els.batchList.replaceChildren(...items);
}

/** The archetype a recent row falls back to when its project has no thumbnail: the master's title slide. */
function titleArchetype(master: SlideMasterV1): string {
  return master.archetypes.find((one) => /title/i.test(one.id))?.id ?? master.archetypes[0]?.id ?? '';
}

/**
 * A recent project's picture: its first slide as the controller stored it, else the
 * design system's title layout as a wireframe, else a document glyph. Glyphs stand in
 * for every picture while previews are hidden.
 */
function recentThumb(rb: RbCtx, project: RebrandProjectSummaryV1): HTMLElement {
  const holder = node('span', 'rb-recent-thumb');
  holder.setAttribute('aria-hidden', 'true');
  if (!previewsHidden()) {
    const stored = 'thumbSvg' in project && typeof project.thumbSvg === 'string' ? storedSvgNode(project.thumbSvg) : null;
    if (stored) {
      holder.append(stored);
      return holder;
    }
    const master = localOf(rb).system?.input.master;
    const archetype = master ? titleArchetype(master) : '';
    const wire = master && archetype ? svgNode(layoutThumb(master, archetype, RECENT_THUMB_W, archetypeThumbSvg)) : null;
    if (wire) {
      holder.classList.add('rb-recent-thumb--wire');
      holder.append(wire);
      return holder;
    }
  }
  holder.classList.add('rb-recent-thumb--glyph');
  const glyph = glyphNode('document');
  if (glyph) holder.append(glyph);
  return holder;
}

function drawRecent(rb: RbCtx, els: IntakeEls, list: RebrandProjectSummaryV1[]): void {
  const rows = list.map((project) => {
    const row = node('li', 'rb-recent-row');
    row.dataset.projectId = project.id;
    // The row opens the project; its name and state are the button's name.
    const open = node('button', 'rb-recent-open');
    open.type = 'button';
    const text = node('span', 'rb-recent-text');
    text.append(node('span', 'rb-recent-name', project.name), node('span', 'rb-recent-meta', recentMeta(project)));
    open.append(recentThumb(rb, project), text);
    open.addEventListener('click', () => void openProject(rb, project.id));
    const more = node('button', 'lp-iconbtn rb-recent-more');
    more.type = 'button';
    more.setAttribute('aria-haspopup', 'menu');
    more.setAttribute('aria-expanded', 'false');
    const moreName = tRaw('More for {name}', { name: project.name });
    more.setAttribute('aria-label', moreName);
    more.title = tRaw('More');
    const dots = glyphNode('menuDots');
    if (dots) more.append(dots);
    row.append(open, more);
    return row;
  });
  els.recentList.replaceChildren(...rows);
}

/**
 * Whether the button a row draws first may be the primary: only when nothing else on
 * screen holds it. On the intake the drop area's Choose a deck holds it unless it is
 * hidden while a deck is read; in the band the footer holds it and steps down while
 * the band shows one (`foot.ts` reads the band), so the band may take it unless the
 * slide pictures offer already did.
 */
interface PrimaryClaim { free: boolean }

function claimPrimary(claim: PrimaryClaim): boolean {
  if (!claim.free) return false;
  claim.free = false;
  return true;
}

function drawReadiness(rb: RbCtx, els: IntakeEls, items: ReadinessItemV1[], claim: PrimaryClaim): void {
  const rows = items.map((item) => {
    const copy = readinessCopy(item);
    const row = node('li', 'rb-ready-row');
    row.dataset.readiness = item.id;
    const text = node('div', 'rb-ready-text');
    text.append(node('p', 'rb-ready-message', copy.text));
    if (copy.ways.includes('download') && typeof item.sizeBytes === 'number' && item.sizeBytes > 0) {
      text.append(node('p', 'rb-ready-size', tRaw('A {size} download, the first time only.', { size: fmtBytes(item.sizeBytes) })));
    }
    const actions = node('div', 'rb-ready-actions');
    copy.ways.forEach((way, i) => {
      const primary = i === 0 && claimPrimary(claim);
      const btn = button(primary ? 'btn btn--primary' : 'btn btn--ghost', readinessWayLabel(way));
      btn.dataset.way = way;
      btn.addEventListener('click', () => takeReadiness(rb, item, way));
      actions.append(btn);
    });
    row.append(text, actions);
    return row;
  });
  els.readyList.replaceChildren(...rows);
}

function drawError(rb: RbCtx, els: IntakeEls, error: RebrandErrorV1, claim: PrimaryClaim): void {
  const copy = errorCopy(error);
  els.errorLine.textContent = copy.text;
  const ways = copy.ways.filter((way) => way !== 'close' || Boolean(rb.state.project));
  els.errorActions.replaceChildren(
    ...ways.map((way, i) => {
      const primary = i === 0 && claimPrimary(claim);
      const btn = button(primary ? 'btn btn--primary' : 'btn btn--ghost', wayLabel(way));
      btn.dataset.way = way;
      btn.addEventListener('click', () => takeWay(rb, way, error));
      return btn;
    }),
  );
}

/** The first slide picture of the open deck, as a drawable address, once the controller has it. */
function firstPictureHref(rb: RbCtx): string | undefined {
  const source = rb.state.source;
  if (!source || previewsHidden()) return undefined;
  const [firstId] = slidePictureIdsOf(source);
  const slide = source.slides.find((one) => one.id === firstId);
  const media = slide?.objects.find((object) => object.kind === 'pic' && object.media)?.media;
  return media ? rb.controller.mediaHref(media) : undefined;
}

/** What the band's Read the text is now: hidden, waiting for the deck, or the offer. */
interface PicturesView {
  line: string;
  note: string;
  readHidden: boolean;
  /** Read the text cannot run yet (no plan, or a read is under way): it stays focusable and says why. */
  readOff: boolean;
  /** Why Read the text cannot run yet, when the deck is still being read; '' otherwise. */
  why: string;
  /** Read the text is the band's primary: the review shows and nothing else is asked of the band. */
  asks: boolean;
  readLabel: string;
  keepHidden: boolean;
  href: string | undefined;
}

function picturesView(rb: RbCtx, counts: { pictures: number; total: number }, ocr: ReadinessItemV1 | undefined, reading: boolean): PicturesView {
  const local = localOf(rb);
  const { state } = rb;
  const missing = ocr?.state === 'missing';
  const keepMode = state.mode === 'keep-design';
  const kept = local.picturesKept !== null && local.picturesKept === state.project?.id;
  const readable = picturesReadable(state);
  const outcome = picturesOutcomeFor(local, state, counts);
  // While the pictures are read, the band's line is the one progress surface.
  const line = reading
    ? state.progress?.step === 'read' ? readingPicturesText(state.progress, msLeft(local, state)) : progressText(state.progress)
    : picturesText(counts.pictures, counts.total, missing);
  const note = reading || missing
    ? ''
    : keepMode && !readable
      ? tRaw('Keep the design keeps these slides as pictures.')
      : (outcome?.text ?? '');
  // A read that could not rebuild the slides left is not offered again as if it might.
  const readHidden = missing || (keepMode && !readable) || (outcome !== null && !outcome.retry);
  const readOff = local.downloading || reading || !readable;
  const asks = state.mode === 'renovate' && !readHidden && !readOff && !kept && outcome === null;
  return {
    line,
    note,
    readHidden,
    readOff,
    why: !readable && !reading ? tRaw('Waits for the deck to finish reading.') : '',
    asks,
    readLabel: reading ? tRaw('Reading the text') : tRaw('Read the text'),
    // Going on with the pictures while they are being read would say something the read
    // then undoes, so it waits; the job toast is where a read is stopped.
    keepHidden: kept || reading || (keepMode && !readable),
    href: firstPictureHref(rb),
  };
}

/** The time the current read of the slide pictures has left, from its own pace so far. */
function msLeft(local: IntakeLocal, state: RebrandStateV1): number | null {
  const clock = local.readClock;
  const progress = state.progress;
  if (!clock || progress?.step !== 'read' || typeof progress.done !== 'number' || typeof progress.total !== 'number') return null;
  const read = progress.done - clock.done;
  if (read <= 0) return null;
  const elapsed = Date.now() - clock.startedAt;
  return (elapsed / read) * Math.max(0, progress.total - progress.done);
}

/** The slide pictures band: the first picture, the sentence or the progress, and the two ways. */
function drawPictures(els: IntakeEls, view: PicturesView): void {
  els.picturesLine.textContent = view.line;
  els.picturesNote.textContent = view.note;
  els.picturesNote.hidden = !view.note;
  const img = els.picturesArt.querySelector('img');
  if (view.href) {
    if (img?.getAttribute('src') !== view.href) {
      const next = node('img');
      next.alt = '';
      next.decoding = 'async';
      next.src = view.href;
      els.picturesArt.replaceChildren(next);
    }
  } else if (img) {
    els.picturesArt.replaceChildren();
  }
  els.picturesArt.hidden = !view.href;
  const read = els.picturesRead;
  read.hidden = view.readHidden;
  read.className = view.asks ? 'btn btn--primary' : 'btn btn--ghost';
  setLabel(read, view.readLabel);
  if (view.readOff) read.setAttribute('aria-disabled', 'true');
  else read.removeAttribute('aria-disabled');
  if (view.why) read.setAttribute('aria-describedby', PICTURES_WHY_ID);
  else read.removeAttribute('aria-describedby');
  read.title = view.why;
  els.picturesKeep.hidden = view.keepHidden;
}

/** The outcome to show, while it still describes the open deck's slide pictures. */
function picturesOutcomeFor(local: IntakeLocal, state: RebrandStateV1, counts: { pictures: number }): IntakeLocal['picturesOutcome'] {
  const outcome = local.picturesOutcome;
  if (!outcome || outcome.projectId !== state.project?.id || outcome.pictures !== counts.pictures) return null;
  return outcome;
}

/** True when the intake region is hidden (a plan exists, or Keep the design has its source). */
function intakeHidden(state: RebrandStateV1): boolean {
  return Boolean(state.plan) || (state.mode === 'keep-design' && Boolean(state.source));
}

/**
 * Follow a read of the slide pictures from its start to its end: start the clock the
 * time left is measured with, and when a read the controller started on its own (a
 * picture deck read as it opens) ends, say once what it came to. A read started from
 * Read the text says its own outcome as its promise settles.
 */
function followRebuild(rb: RbCtx, counts: { pictures: number }): void {
  const local = localOf(rb);
  const { state } = rb;
  const projectId = state.project?.id ?? '';
  // A rebuild runs from the read of the pictures through its census, plan and preview,
  // and is under way until the progress clears, not only while the step is `read`.
  if (state.phase === 'review' && state.progress?.step === 'read') {
    if (local.rebuilding !== projectId) {
      local.rebuildFrom = { projectId, pictures: counts.pictures };
      local.readClock = null;
    }
    local.rebuilding = projectId;
    const done = state.progress.done;
    if (typeof done === 'number' && !local.readClock) local.readClock = { projectId, startedAt: Date.now(), done };
    return;
  }
  if (state.phase === 'review' && state.progress && local.rebuilding === projectId) return;
  const from = local.rebuildFrom;
  local.rebuilding = null;
  local.rebuildFrom = null;
  local.readClock = null;
  if (!from || from.projectId !== projectId || local.downloading) return;
  const touched = from.pictures - counts.pictures;
  if (touched <= 0) return;
  sayPicturesOutcome(rb, { ok: true, touched, skipped: counts.pictures }, projectId);
}

/** Draw the intake for the current phase. Returns early when nothing it shows changed. */
export function renderIntake(rb: RbCtx): void {
  const local = localOf(rb);
  const els = local.els;
  if (!els) return;
  const { state } = rb;
  const busy = state.phase === 'reading' || state.phase === 'analysing';
  const counts = pictureCounts(state);

  // A mode switch clears what the last pick left: its notice and its error.
  if (local.lastMode !== null && local.lastMode !== state.mode) {
    local.notice = null;
    if (state.error) local.dismissedError = errorKey(state.error);
  }
  local.lastMode = state.mode;

  followRebuild(rb, counts);
  // The band waits for the census, so it never shows over a deck still being read.
  // Keeping the pictures folds it rather than removing it.
  const showPictures = counts.pictures > 0 && Boolean(state.census);
  const ocrRow = state.readiness.find((item) => item.id === 'ocr');
  // While the band shows, the text recognition row folds into it. Chart labels are read
  // only for Renovate the layout, so Keep the design does not ask for that download.
  const readiness = state.readiness.filter((item) => item.state !== 'ready' && !local.setAside.has(item.id)
    && !(showPictures && item.id === 'ocr') && !(state.mode === 'keep-design' && item.id === 'ocr:labels'));
  const readingPictures = state.phase === 'review' && state.progress !== null && local.rebuilding === (state.project?.id ?? '');
  const currentError = state.error && errorKey(state.error) !== local.dismissedError ? state.error : null;
  const showError = Boolean(currentError) && !busy;
  const away = intakeHidden(state);
  const pictures = showPictures ? picturesView(rb, counts, ocrRow, readingPictures) : null;

  const batch = state.batch ?? [];
  const key = JSON.stringify([
    state.phase,
    state.mode,
    state.progress,
    showError ? currentError : null,
    state.project?.id ?? null,
    readiness,
    local.recentVersion,
    local.notice,
    away,
    batch,
    state.nextPresetId ?? null,
    local.presets.map((preset) => preset.id),
    local.system ? [local.system.info.id, local.system.info.name] : local.system ?? null,
    state.designSystem?.id ?? null,
    busy ? [state.source?.slides.length ?? 0, Boolean(state.faithful)] : null,
    pictures,
  ]);
  if (rb.memo.intake === key) return;
  rb.memo.intake = key;

  // A return to the intake from a project means the list may have moved on.
  if (state.phase === 'idle' && local.lastPhase !== null && local.lastPhase !== 'idle') void refreshRecent(rb);
  local.lastPhase = state.phase;

  drawSystem(rb, els);
  drawMode(rb, els);
  // Once a project is open the top bar carries the mode control (keep.ts), so the
  // intake's own segment steps aside and one job keeps one control on screen.
  const modeHost = els.mode.closest<HTMLElement>('.rb-intake-mode-host') ?? els.mode;
  modeHost.hidden = Boolean(state.project);
  els.modeHelp.hidden = Boolean(state.project);

  // The Choose a deck button is about to hide: focus goes to Cancel, never to the page.
  const active = typeof document === 'undefined' ? null : document.activeElement;
  if (busy && active instanceof HTMLElement && els.drop.contains(active)) {
    els.progress.hidden = false;
    els.cancel.focus();
  }
  els.drop.hidden = busy;
  els.notice.hidden = !local.notice;
  els.notice.textContent = local.notice ?? '';

  els.progress.hidden = !busy;
  els.progressLine.textContent = busy ? progressText(state.progress) || tRaw('Reading the deck') : '';
  const file = busy ? readingName(state) : '';
  els.progressFile.textContent = file;
  els.progressFile.hidden = !file;
  if (busy) drawFrames(rb, els);

  // The error and readiness rows go where a person can see them: in the intake while it
  // shows, in the band under the top bar once the review or Keep the design took its place.
  const home = away ? rb.els.alert : els.inner;
  // The decks of a multi-file read stay in reach once the first one's review took the
  // intake's place: the list moves to the same band, so a ready deck still opens from it.
  const batchAway = away && batch.length > 1;
  const batchHome = batchAway ? rb.els.alert : els.inner;
  if (els.batch.parentElement !== batchHome) batchHome.insertBefore(els.batch, batchAway ? null : els.recent);
  const afterProgress = away ? null : els.progress.nextSibling;
  if (els.error.parentElement !== home) home.insertBefore(els.error, afterProgress);
  if (els.ready.parentElement !== home) home.insertBefore(els.ready, away ? null : els.error.nextSibling);
  // The slide pictures offer is always in the band, first in it.
  if (!pictures) els.pictures.remove();
  else if (els.pictures.parentElement !== rb.els.alert || rb.els.alert.firstElementChild !== els.pictures) rb.els.alert.prepend(els.pictures);

  // One primary on screen: the drop area's while it shows; in the band, the footer's
  // unless the band asks. The slide pictures offer claims it first.
  const claim: PrimaryClaim = { free: away ? state.mode === 'renovate' && !pictures?.asks : busy };
  if (pictures) drawPictures(els, pictures);

  els.error.hidden = !showError;
  if (showError && currentError) {
    drawError(rb, els, currentError, claim);
    const said = errorKey(currentError);
    if (local.announcedError !== said) {
      local.announcedError = said;
      rb.announce(errorCopy(currentError).text);
    }
  }

  els.ready.hidden = readiness.length === 0;
  drawReadiness(rb, els, readiness, claim);
  rb.els.alert.hidden = !pictures && (!away || (!showError && readiness.length === 0 && !batchAway));

  const recent = local.recent ?? [];
  els.recent.hidden = busy || recent.length === 0;
  drawRecent(rb, els, recent);

  els.batch.hidden = batch.length === 0 || (away && !batchAway);
  const reading = batch.some((row) => row.state === 'waiting' || row.state === 'reading');
  els.batchHead.textContent = reading ? tRaw('Decks being read') : tRaw('Decks read together');
  drawBatch(rb, els, batch);
  els.presetLine.hidden = busy || local.presets.length === 0;
  els.presetText.textContent = presetLineText(local.presets, state.nextPresetId);
}

/**
 * True while the notice band's slide pictures offer holds the view's primary (the
 * review shows and Read the text can run), so the footer steps down.
 */
export function picturesAsk(rb: RbCtx): boolean {
  const state = rb.state;
  const counts = pictureCounts(state);
  if (counts.pictures <= 0 || !state.census) return false;
  const readingPictures = state.phase === 'review' && state.progress !== null && localOf(rb).rebuilding === (state.project?.id ?? '');
  return picturesView(rb, counts, state.readiness.find((item) => item.id === 'ocr'), readingPictures).asks;
}

export function intakeOps(rb: RbCtx) {
  return {
    wire: bindOp(rb, wireIntake),
    render: bindOp(rb, renderIntake),
    take: bindOp(rb, takeFile),
    takeMany: bindOp(rb, takeFiles),
    offerTextReading: bindOp(rb, offerTextReading),
    choosePreset: bindOp(rb, choosePreset),
    savePreset: bindOp(rb, savePreset),
    hasPresets: bindOp(rb, hasPresets),
    pick: bindOp(rb, pickFile),
    refresh: bindOp(rb, refreshRecent),
    picturesAsk: bindOp(rb, picturesAsk),
  };
}
