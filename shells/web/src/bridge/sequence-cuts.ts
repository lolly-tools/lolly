// SPDX-License-Identifier: MPL-2.0
/**
 * sequence-cuts.ts - the CONTACT SHEET: N stills off one timed composition
 * (Fable timeline, phase 2.5 / plans/51-fable-timeline-editing.md section 4.6).
 *
 * This is the STILL sibling of sequence-render.ts. Where that module decodes,
 * composites and muxes to produce motion, this one does none of those things: it
 * moves the DOM playhead, asks the ordinary still renderer for a picture, and
 * repeats. Every pixel therefore comes from exactly the same code path as a normal
 * PNG/SVG/PDF export - which is the whole point, because Andy's rule is that a
 * still of a sequence is WYSIWYG, and the cheapest way to keep N stills honest is
 * for each of them to be a plain still taken at a different time.
 *
 * THE CONTRACT (section 4.6):
 *   cuts = 1 (default)  the frame at the playhead. Nothing in this module runs;
 *                       the dispatch in export.ts never reaches it. That path must
 *                       stay byte-identical - it is the common one.
 *   cuts = N > 1        N stills at MIDPOINT times t_i = totalMs * (i + 0.5) / N.
 *                       png/jpg/webp/svg → N members in one ZIP, `<base>-01.<ext>`;
 *                       pdf              → ONE document of N pages.
 *
 * WHY MIDPOINT. Endpoint sampling (`i/(N-1)`) spends frame 0 at t = 0, where an
 * `enter` transition is still at alpha 0 (a blank card), and the last frame at
 * t = totalMs, where every clip has ended. A 6-up sheet would be two-thirds
 * useful. The midpoint of each equal slice always lands inside a live span.
 *
 * THE FREEZE STILL HOLDS. `render()` in export.ts has already run `snapshotMotion`
 * on the live node (a still of a sequence keeps it - only MOTION formats skip it),
 * so every `<video>` is already an `<img>` of the frame the preview was parked on.
 * We deliberately do NOT re-seek per cut: the poster contract is "the video is
 * where you left it", and it holds for cut 12 exactly as it does for cut 1. What
 * moves between cuts is the timeline's own visibility state and the six inline
 * properties the applier composes - `transform`, `opacity`, and, on a stage that
 * authors depth (plans/104), `filter`, `z-index`, and `width`/`height`. That list is
 * all `applySequenceTime` writes, and `restoreSequenceTime` hands every one of them
 * back.
 *
 * The last pair is the one deliberate LAYOUT write in the whole applier (plans/104
 * section 5.2, P1): the `w`/`h` keyframe channels exist so that a size tween REFLOWS - text
 * rewraps, a border stays one pixel - which no composited property can fake. It costs
 * a reflow per cut on a stage that keys a size, and nothing at all on one that does
 * not: the write is gated on the track actually mentioning `w` or `h`.
 *
 * AND THE STAGE IT STARTS FROM IS THE AUTHORED ONE. The whole run sits inside
 * `withAuthoredDom` (plans/104 section 6 point 0): the preview clock has been writing those
 * same properties for whatever frame the playhead is parked on, and this module's
 * session would capture that composed pose as "authored" the first time it touched a
 * box - so every cut would carry the parked frame baked in, and by how much would
 * depend on where the user last scrubbed.
 *
 * INJECTED DEPENDENCIES. The renderers stay in export.ts (they are that file's
 * private machinery) and arrive as `CutsDeps`. That is not ceremony: it is what
 * lets the loop, the clamping, the naming and the restore-in-`finally` be tested
 * headlessly in jsdom, where no pixel can ever be rasterised.
 */

import {
  createSequenceTime,
  sequenceDurationMs,
  withAuthoredDom,
  type SequenceTimeSession,
} from './sequence-dom.ts';
import { CUTS_FORMATS } from '@lolly/engine';
import { sequenceError, toCodedError } from './sequence-plan.ts';
import type { ExportOpts } from './export.ts';

// ── policy ──────────────────────────────────────────────────────────────────

/**
 * Ceiling on N. Mirrors the engine's `CUTS_MAX` (engine/src/url-mode.ts) on
 * purpose rather than importing it: the engine clamps what it parses out of a URL,
 * but this bridge is also reachable from a hook, the MCP verb and a shell that
 * built `opts` by hand, so the boundary re-validates instead of trusting its
 * caller. 64 is already an 8x8 wall of thumbnails - past that a reviewer reads
 * nothing and the cost (64 full renders) stops paying for itself.
 */
export const MAX_CUTS = 64;

/**
 * Still formats a contact sheet is defined for. Everything else - the motion
 * formats, the data formats (json/csv/ics), `zip` itself, `pptx`, `ico` - ignores
 * `cuts` entirely: a bundle of a bundle has no meaning, and a data payload has no
 * frames. `jpeg` is listed beside `jpg` because renderFormatDispatch accepts both
 * spellings.
 *
 * Re-exported from `engine/src/preflight.ts` rather than restated: `wantsCuts`
 * below and the engine's `count.cuts-applies` / `count.cuts-inert` checks must
 * decide on the SAME set, or the export panel and the preflight card disagree
 * about whether a format has a contact sheet at all.
 */
export { CUTS_FORMATS };

/** File extension for a zipped cut of `format` (the token is not always the ext). */
const CUT_EXT: Record<string, string> = { jpeg: 'jpg' };

// ── pure helpers (the whole decision surface, node-testable) ────────────────

/**
 * Total function from whatever the caller put in `opts.cuts` to a usable N.
 *
 * Junk (undefined, null, '', NaN, Infinity, objects, 0, negatives) degrades to 1 - 
 * the playhead frame - because a contact sheet is an enhancement and a broken
 * request must never turn into a failed export. A fraction truncates. Above
 * MAX_CUTS it CLAMPS rather than falling back: "too many" is a legible intent.
 * Numeric strings are accepted so a shell can pass a raw URL param through.
 */
export function cutCount(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw.trim()) : NaN;
  if (!Number.isFinite(n)) return 1;
  const i = Math.trunc(n);
  if (i < 1) return 1;
  return Math.min(i, MAX_CUTS);
}

/**
 * The N sample times, in ms, for a sequence of `totalMs`. MIDPOINT sampling:
 * `t_i = totalMs * (i + 0.5) / n`. Strictly increasing, all strictly inside
 * (0, totalMs), and symmetric about the middle.
 *
 * Exported and pure so the export bar's "Frames" control can show the same times
 * the exporter will actually take, without importing the exporter.
 */
export function cutTimestamps(totalMs: number, n: number): number[] {
  const count = cutCount(n);
  const total = Number.isFinite(totalMs) && totalMs > 0 ? totalMs : 0;
  const out: number[] = [];
  for (let i = 0; i < count; i++) out.push(total * (i + 0.5) / count);
  return out;
}

/**
 * Archive member name for cut `i` (0-based) of `n`: `<base>-01.png`.
 *
 * Zero-padded to the width of `n` (minimum two digits) so a file manager's
 * lexicographic sort is the timeline order - the single thing that makes a
 * downloaded sheet readable. Any extension already on `base` is dropped, matching
 * `renderZip`'s base derivation.
 */
export function cutMemberName(base: string, format: string, i: number, n: number): string {
  const stem = (base || 'export').replace(/\.[a-z0-9]+$/i, '') || 'export';
  const width = Math.max(2, String(Math.max(1, n)).length);
  const ext = CUT_EXT[format] ?? format;
  return `${stem}-${String(i + 1).padStart(width, '0')}.${ext}`;
}

/**
 * Does this render want the contact-sheet path?
 *
 * All three conditions matter, and they are checked HERE so the dispatch site in
 * export.ts is one line: N > 1 (1 is the untouched single-still path), a still
 * format cuts is defined for, and a stage the timeline actually applies to.
 */
export function wantsCuts(format: string, cuts: unknown, isSequence: boolean): boolean {
  return isSequence && CUTS_FORMATS.has(format) && cutCount(cuts) > 1;
}

// ── the run ─────────────────────────────────────────────────────────────────

/** What the loop needs from export.ts, whose renderers are module-private there. */
export interface CutsDeps {
  /** One ordinary still, through the full renderFormat funnel (C2PA, imprint, …). */
  renderStill(node: Element, format: string, opts: ExportOpts): Promise<Blob>;
  /**
   * One multi-page PDF over `pages`, calling `prepare(i)` before page `i` is sized
   * and drawn. For a contact sheet every entry of `pages` is the SAME node and
   * `prepare` is what moves the playhead between pages.
   */
  renderPdfPages(pages: Element[], opts: ExportOpts, prepare: (i: number) => void): Promise<Blob>;
  /**
   * The archive. This is `renderZip`'s own packer (extracted, not reimplemented),
   * so a contact sheet inherits the two-tier password handling and the fflate
   * store-vs-deflate choice for free.
   */
  packZip(members: { name: string; bytes: Uint8Array }[], opts: ExportOpts): Promise<Blob>;
  log?(level: string, msg: string): void;
}

/**
 * Render `node` as a contact sheet. Callers must have established `wantsCuts`.
 *
 * The DOM is left exactly as it was found - the session's `restore()` runs in a
 * `finally` on every path, including a throw from the middle of page 7 of a PDF.
 * Failing to restore would strand the artboard on the last sampled frame with
 * `.seq-off` (display:none) still on every box outside it, i.e. a mostly blank
 * editor after a failed export.
 */
export async function renderSequenceCuts(
  node: Element, format: string, opts: ExportOpts, deps: CutsDeps,
): Promise<Blob> {
  // THE READ/RESTORE SEAM (plans/104 section 6 point 0). The comment above about re-capturing
  // the authored styles on cut 2 is the same bug one level up: the PREVIEW CLOCK has
  // already written cut 0. This sheet opens its own session on the live artboard, and
  // `AuthoredStore.get()` captures whatever is on the element the first time it is
  // touched - mid-keyframe that is the clock's composed pose, and every one of the N
  // stills would then carry the frame the user happened to be parked on, baked in.
  // The scope stands every OTHER writer over `node` down (handing its writes back) and
  // holds it down until the last cut is packed; the session opened INSIDE it is not in
  // the snapshot, so it composes normally.
  return await withAuthoredDom(node as HTMLElement, () => renderCutsAuthored(node, format, opts, deps));
}

async function renderCutsAuthored(
  node: Element, format: string, opts: ExportOpts, deps: CutsDeps,
): Promise<Blob> {
  const log = (l: string, m: string): void => deps.log?.(l, m);
  const n = cutCount(opts.cuts);
  const root = node as HTMLElement;
  const totalMs = sequenceDurationMs(root);
  if (!(totalMs > 0)) {
    throw sequenceError('SEQ_DECODE_FAILED', 'contact sheet: the stage declares no duration (data-seq-ms)');
  }
  const times = cutTimestamps(totalMs, n);

  // ONE session across all N cuts. Per-cut sessions would re-capture the authored
  // styles on cut 2 - and by then the "authored" transform is the one cut 1 wrote,
  // so the enter/exit offsets would compound frame after frame.
  const session: SequenceTimeSession = createSequenceTime(root);
  // Members render with cuts stripped, so a member can never re-enter this path,
  // and without the caller's onProgress: progress is reported per CUT here (the
  // number a 32-cut sheet needs), not per DOM node of an inner walk.
  const memberOpts: ExportOpts = { ...opts, cuts: 1, onProgress: undefined };

  try {
    if (format === 'pdf') {
      // The password stays ON the member opts here - there is exactly one output
      // document and locking it is the same request as locking a one-page PDF.
      // ONE document, N pages. The page loop lives in export.ts's existing
      // multi-page renderer - it already owns page sizing, orientation, the
      // password tier and the PDF/X finishing pass - and `prepare` is the seam
      // that advances the playhead between pages.
      const pages = times.map(() => node);
      return await deps.renderPdfPages(pages, memberOpts, (i) => {
        session.apply(times[i] as number);
        opts.onProgress?.(i, n);
      });
    }

    // Raster/SVG: N members in one archive. A member is never itself locked (no
    // still format can carry a password) - the container is what protects them,
    // exactly as in the ordinary bundle.
    const stillOpts: ExportOpts = { ...memberOpts, password: undefined, strongPassword: undefined };
    const members: { name: string; bytes: Uint8Array }[] = [];
    const base = opts.filename || 'export';
    for (let i = 0; i < n; i++) {
      session.apply(times[i] as number);
      const blob = await deps.renderStill(node, format, stillOpts);
      members.push({ name: cutMemberName(base, format, i, n), bytes: new Uint8Array(await blob.arrayBuffer()) });
      opts.onProgress?.(i + 1, n);
    }
    log('info', `contact sheet: ${n} cuts of a ${Math.round(totalMs)}ms sequence`);
    return await deps.packZip(members, opts);
  } catch (err) {
    // One coded shape for the whole sequence pipeline, motion or still, so the UI
    // has a single error taxonomy to speak. A SequenceError passes through with
    // its code intact.
    const coded = toCodedError(err);
    throw sequenceError(coded.code, `contact sheet: ${coded.message}`);
  } finally {
    session.restore();
  }
}
