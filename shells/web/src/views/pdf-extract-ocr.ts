// SPDX-License-Identifier: MPL-2.0
/**
 * Unpack's text recognition for scanned pages.
 *
 * A scanned page holds a picture of text and no text layer, so the text pass
 * returns nothing for it. When the shell can run the on-device reader, the page
 * offers "Read the text": this module asks for the model in place first
 * (lib/model-offer.ts ensureModel, so a person who closed the first-run sheet gets
 * the download here and is never sent to Profile), then draws each page picture,
 * reads it, and hands the words back one page at a time so the report fills in
 * while the rest are still being read.
 *
 * The reads run as ONE background job on the heavy queue (lib/jobs.ts): the toast
 * owns progress ("Reading page 3 of 8") and cancel, and two wasm inference runs never
 * share the tab. Not now on the offer leaves every page as it was: the picture,
 * its honest "scanned" line and the button to try again.
 *
 * Everything the job touches comes in through `ScanReadDeps`, so the whole flow
 * unit-tests with a stub offer, stub frames and a stub reader.
 */
import type { PageText } from '@lolly/engine';
import type { OcrFrame, OcrResult } from '@lolly-tools/core/host-v1';
import { t, tRaw } from '../i18n.ts';
import type { JobHandle, StartJobOpts } from '../lib/jobs.ts';

export interface ScanReadDeps {
  /** The in-place model offer for Text recognition. True once the model is here. */
  ensure: (reason: string) => Promise<boolean>;
  /** Page `index` as the RGBA frame the reader takes; null when it cannot be drawn. */
  frame: (index: number) => Promise<OcrFrame | null>;
  /** One read of one frame. */
  read: (frame: OcrFrame, signal: AbortSignal) => Promise<OcrResult>;
  /** lib/jobs.ts startJob, injectable for tests. */
  startJob: (opts: StartJobOpts) => JobHandle;
}

export interface ScanReadHooks {
  /** A page was read. `page` is null when the picture held no readable text. */
  onPage?: (index: number, page: PageText | null) => void;
  /** The model is here and reading begins (after any download offer). */
  onStart?: () => void;
  /** Is the read still wanted? Checked once the offer settles, which can be
   *  minutes later, and before each page: false (the person left the document)
   *  ends the run without reading further. */
  wanted?: () => boolean;
}

export type ScanReadStatus = 'declined' | 'busy' | 'cancelled' | 'done';

export interface ScanReadOutcome {
  status: ScanReadStatus;
  /** Pages that came back with words. */
  read: number;
  /** Pages read that held no words. */
  empty: number;
  /** Pages that could not be drawn or read. */
  failed: number;
}

/** A scanned page with the reader's words folded in: it stops being "scanned", so
 *  Copy all and the downloads carry it like any other page. */
export function pageFromOcr(base: PageText, text: string): PageText {
  const paras = text.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
  return {
    ...base,
    scanned: false,
    // The reader gives no type sizes or columns, so every block is plain prose.
    blocks: paras.map((p): PageText['blocks'][number] => ({ kind: 'paragraph', text: p, size: 0, bold: false, column: 0 })),
    text: paras.join('\n\n'),
    markdown: paras.join('\n\n'),
  };
}

/**
 * Read the given scanned pages. `pages` maps a page index to its current
 * PageText. Resolves when the job settles; `status` says how it ended, and a
 * declined offer resolves before any job starts.
 */
export async function readScannedPages(
  pages: ReadonlyMap<number, PageText>,
  deps: ScanReadDeps,
  hooks: ScanReadHooks = {},
): Promise<ScanReadOutcome> {
  const outcome: ScanReadOutcome = { status: 'declined', read: 0, empty: 0, failed: 0 };
  const indices = [...pages.keys()].sort((a, b) => a - b);
  if (!indices.length) return { ...outcome, status: 'done' };

  if (!(await deps.ensure(t('Reading text in scanned pages')))) return outcome;
  if (hooks.wanted && !hooks.wanted()) return outcome;
  hooks.onStart?.();

  const controller = new AbortController();
  let job: JobHandle;
  try {
    job = deps.startJob({ title: t('Reading scanned pages'), cancel: () => controller.abort() });
  } catch {
    // The heavy queue is full: report it rather than drop the request.
    return { ...outcome, status: 'busy' };
  }

  let abandoned = false;
  try {
    await job.started;
    for (let k = 0; k < indices.length; k++) {
      if (job.cancelled) break;
      if (hooks.wanted && !hooks.wanted()) { abandoned = true; break; }
      const i = indices[k]!;
      job.progress(k, indices.length, tRaw('Reading page {i} of {n}…', { i: k + 1, n: indices.length }));
      let result: OcrResult;
      try {
        const frame = await deps.frame(i);
        if (!frame) { outcome.failed++; continue; }
        result = await deps.read(frame, controller.signal);
      } catch (err) {
        if (job.cancelled || (err as Error | null)?.name === 'AbortError') break;
        // One page that will not read must not cost the others.
        outcome.failed++;
        continue;
      }
      if (job.cancelled) break;
      const text = result.text.trim();
      if (text) { outcome.read++; hooks.onPage?.(i, pageFromOcr(pages.get(i)!, text)); }
      else { outcome.empty++; hooks.onPage?.(i, null); }
    }
    if (job.cancelled) {
      outcome.status = 'cancelled';
    } else if (abandoned) {
      // Nobody is looking at this document any more: close the job quietly.
      job.finish();
      outcome.status = 'cancelled';
    } else {
      job.progress(indices.length, indices.length);
      job.finish();
      outcome.status = 'done';
    }
  } finally {
    job.settle();
  }
  return outcome;
}

/** The sentence a finished run leaves for screen readers. */
export function scanReadSummary(o: ScanReadOutcome): string {
  if (o.status === 'busy') return t('Another job is running. Try again when it finishes.');
  if (o.status === 'cancelled') return t('Reading stopped.');
  if (o.read === 0 && o.empty === 0 && o.failed > 0) return t('The scanned pages could not be read.');
  if (o.read === 0) return t('No readable text was found in the scanned pages.');
  return o.read === 1 ? t('1 scanned page read.') : tRaw('{n} scanned pages read.', { n: o.read });
}
