// SPDX-License-Identifier: MPL-2.0
/**
 * Readiness and capabilities for the renovation journey (plan 274 section 4 and
 * the Codex review section 2).
 *
 * Two questions, answered before anything is promised:
 *
 *   readinessFor()   what is missing for this deck, how big it is, what the
 *                    person can do about it.
 *   capabilitiesFor() what this surface can actually do, as the contract type
 *                    every surface reports.
 *
 * Neither one downloads. `readinessFor` reads a sync feature probe, an
 * already-on-device check and the live model roster's own numbers; a model
 * download and a document upload are separate operations, and a missing model
 * never starts a fetch on its own or falls back to a remote service. The caller
 * shows the item and the person presses Download, or carries on with slide
 * pictures, or picks another file. That Download is `ensureModel("ocr")` from
 * `lib/model-offer.ts`, offered in place where the row is, never a route to Settings,
 * and `deps.ts` asks for the row only while a slide of the deck is still one picture of
 * a whole slide, since reading the text changes nothing once every such slide is rebuilt.
 *
 * The OCR probe is the same one the Verify view gates its text button on
 * (`views/valid.ts`, `ocrReady`): a shell that cannot run a model at all reports
 * `isAvailable()` false, and a shell with an empty roster has nothing to offer
 * even when the runtime is there. Every probe is read through a try/catch and a
 * throw reads as a negative, because a shell that cannot answer has not got the
 * thing on hand.
 *
 * The OCR size comes from `modelPartInfo("ocr").bytes` (`lib/model-parts.ts`), the
 * number the in-place offer (`ensureModel` in `lib/model-offer.ts`) states and the
 * download it starts actually transfers, so the row and the sheet never disagree. When
 * that answer states no size, the roster entry `host.ocr.models()` returned stands in,
 * then `OCR_MODEL_BYTES`, so a language pack this build does not carry still gets a row
 * a person can act on. A part the offline records already call downloaded reads as
 * ready, the same answer Settings gives.
 *
 * One line about what the asset rows can and cannot say. `host.assets.isAvailable`
 * answers "available right now": for a core or catalog asset the web bridge reads
 * its cached bytes, and for an on-demand one it reads the network state. So these
 * rows say a master or a logo is available to this project, never that its bytes
 * are on the device, because that is not the question the bridge answers.
 */
import type { AssetRef, HostV1, OcrModelInfo, RebrandCapabilitiesV1 } from '@lolly-tools/core';
import { OCR_DEFAULT_MODEL, OCR_MODEL_BYTES } from '../ocr-models.ts';

/** `unknown` is a probe that threw: not the same answer as "there is none". */
export type ReadinessStateV1 = 'ready' | 'missing' | 'downloadable' | 'unknown';

/** What the panel offers. `download` appears only where there is something to fetch. */
export type ReadinessActionV1 = 'download' | 'continue-with-pictures' | 'choose-another-file';

export interface ReadinessItemV1 {
  /** Stable id for the row: `ocr`, `layout-model`, `master`, `logo:<tag>`. */
  id: string;
  state: ReadinessStateV1;
  /** One-time download size, when one is known. Absent is not zero. */
  sizeBytes?: number;
  /** Plain copy the panel can show as it stands. */
  message: string;
  actions: ReadinessActionV1[];
}

export interface ReadinessNeedsV1 {
  /** The deck has pictures whose text would have to be read. */
  ocr?: boolean;
  /** The flattened path wants a layout model to split a slide picture into regions. */
  layoutModel?: boolean;
  /** The design system's slide master, by asset id. */
  masterAssetId?: string;
  /** Logo variants the plan expects to place, by asset tag. */
  logoTags?: string[];
}

/** Only the host parts this module reads, so a test passes a small object. */
export type ReadinessHostV1 = Pick<HostV1, 'ocr' | 'assets'>;

export interface ReadinessInputV1 {
  host: ReadinessHostV1;
  needs: ReadinessNeedsV1;
  /**
   * The OCR model part's facts, as `modelPartInfo("ocr")` answers them. Tests pass their
   * own; the default loads `lib/model-parts.ts` on first use. A part that cannot be read
   * leaves the roster's numbers in charge.
   */
  ocrPart?: () => Promise<OcrPartFactsV1 | null>;
}

/** What the readiness row needs from the OCR model part. */
export interface OcrPartFactsV1 {
  bytes?: number;
  ready?: boolean | 'unknown';
}

/** `modelPartInfo("ocr")`, loaded on first use so this module stays light. */
export async function ocrPartInfo(): Promise<OcrPartFactsV1 | null> {
  try {
    const { modelPartInfo } = await import('../model-parts.ts');
    return await modelPartInfo('ocr');
  } catch {
    return null;
  }
}

/**
 * Whether this shell can read text from pictures at all. Sync, cheap, and the
 * same expression `views/valid.ts` uses, so the two surfaces cannot disagree
 * about what the device can do. A probe that throws reads as false, which keeps
 * `capabilitiesFor` answerable on a shell whose OCR object is half built.
 */
export function ocrAvailable(host: Pick<HostV1, 'ocr'>): boolean {
  try {
    return host.ocr?.isAvailable() === true && (host.ocr?.models().length ?? 0) > 0;
  } catch {
    return false;
  }
}

/** The roster entry this journey would use, or null when the roster is empty. */
function defaultOcrModel(host: Pick<HostV1, 'ocr'>): OcrModelInfo | null {
  if (!ocrAvailable(host)) return null;
  let roster: OcrModelInfo[] = [];
  try {
    roster = host.ocr?.models() ?? [];
  } catch {
    return null;
  }
  const preferred = roster.find((m) => m.id === OCR_DEFAULT_MODEL);
  return preferred ?? roster[0] ?? null;
}

/**
 * The readiness rows for one deck. Never fetches, never downloads, never
 * decides for the person. An item the caller did not ask about is not returned,
 * so an all-vector deck produces an empty list.
 */
export async function readinessFor(input: ReadinessInputV1): Promise<ReadinessItemV1[]> {
  const { host, needs } = input;
  const items: ReadinessItemV1[] = [];

  if (needs.ocr) items.push(await ocrItem(host, input.ocrPart ?? ocrPartInfo));
  if (needs.layoutModel) items.push(layoutModelItem());
  if (needs.masterAssetId) items.push(await masterItem(host, needs.masterAssetId));
  for (const tag of needs.logoTags ?? []) items.push(await logoItem(host, tag));

  return items;
}

async function ocrItem(host: ReadinessHostV1, part: () => Promise<OcrPartFactsV1 | null>): Promise<ReadinessItemV1> {
  const model = defaultOcrModel(host);
  if (!model) {
    return {
      id: 'ocr',
      state: 'missing',
      message: 'Text recognition is not available on this device. Lolly will keep each picture as it is.',
      actions: ['continue-with-pictures', 'choose-another-file'],
    };
  }

  // The model part is the authority on what a download transfers; the roster and
  // the static table answer for a part that states no size.
  const facts = await part().catch(() => null);
  const partBytes = typeof facts?.bytes === 'number' && facts.bytes > 0 ? facts.bytes : undefined;
  const sizeBytes = partBytes ?? (typeof model.approxBytes === 'number' ? model.approxBytes : OCR_MODEL_BYTES[model.id]);
  let cached = facts?.ready === true;
  if (!cached) {
    try {
      cached = (await host.ocr?.cached(model.id)) === true;
    } catch {
      // A shell that cannot answer has not got the bytes on hand. Offering the
      // download is the honest reading of an unanswered question.
      cached = false;
    }
  }

  if (cached) {
    return {
      id: 'ocr',
      state: 'ready',
      ...(typeof sizeBytes === 'number' ? { sizeBytes } : {}),
      message: 'Text recognition is installed and runs on this device.',
      actions: [],
    };
  }

  return {
    id: 'ocr',
    state: 'downloadable',
    ...(typeof sizeBytes === 'number' ? { sizeBytes } : {}),
    message: 'Text recognition is not installed. Downloading it sends no part of your deck.',
    actions: typeof sizeBytes === 'number'
      ? ['download', 'continue-with-pictures', 'choose-another-file']
      : ['continue-with-pictures', 'choose-another-file'],
  };
}

/**
 * The layout model (PP-DocLayout-S in plan 274 section 6) is not on the roster
 * yet, so there is no size to consent to and no bytes to fetch. It reports
 * missing rather than downloadable, and the flattened path falls back to the
 * pixel heuristic or to keeping the picture.
 */
function layoutModelItem(): ReadinessItemV1 {
  return {
    id: 'layout-model',
    state: 'missing',
    message: 'Slide layout reading is not available on this device. Lolly will read what it can and keep the rest as pictures.',
    actions: ['continue-with-pictures', 'choose-another-file'],
  };
}

async function masterItem(host: ReadinessHostV1, id: string): Promise<ReadinessItemV1> {
  const there = await assetPresence(host, id);
  if (there === 'unknown') {
    return {
      id: 'master',
      state: 'unknown',
      message: `Lolly could not check the slide master "${id}" on this device.`,
      actions: ['choose-another-file'],
    };
  }
  return there === 'present'
    ? { id: 'master', state: 'ready', message: 'The slide master for this design system is available to this project.', actions: [] }
    : {
        // Not `downloadable`: one id and one probe cannot tell a master that is
        // in the catalog and not fetched from one that is not there at all, and
        // a Download button for a master nobody has would be the worse guess.
        id: 'master',
        state: 'missing',
        message: `The slide master "${id}" is not available to this project. Pick a design system whose master is installed.`,
        actions: ['choose-another-file'],
      };
}

/**
 * A logo variant, found by tag and then confirmed one asset at a time.
 *
 * The tag query reads the catalog index, which lists an asset whether or not its
 * bytes were ever fetched, so a row built on the query alone would report a logo
 * the compile stage cannot place. The confirmation is what makes the row mean
 * something.
 */
async function logoItem(host: ReadinessHostV1, tag: string): Promise<ReadinessItemV1> {
  let candidates: AssetRef[];
  try {
    candidates = await host.assets.query({ tags: [tag] });
  } catch {
    return {
      id: `logo:${tag}`,
      state: 'unknown',
      message: `Lolly could not check for a ${tag} logo on this device.`,
      actions: ['choose-another-file'],
    };
  }

  if (candidates.length === 0) {
    return {
      id: `logo:${tag}`,
      state: 'missing',
      message: `No ${tag} logo is in this catalog, so slides needing it keep what they have and are flagged for review.`,
      actions: [],
    };
  }

  let checked = 0;
  for (const ref of candidates) {
    const there = await assetPresence(host, ref.id);
    if (there === 'present') {
      return { id: `logo:${tag}`, state: 'ready', message: `The ${tag} logo is available to this project.`, actions: [] };
    }
    if (there === 'absent') checked += 1;
  }

  // Listed in the catalog and not available here: a fetch is a real way on, so
  // the row offers it rather than leaving the person with nothing to press.
  return {
    id: `logo:${tag}`,
    state: checked === 0 ? 'unknown' : 'downloadable',
    message: checked === 0
      ? `Lolly could not check whether the ${tag} logo is available here.`
      : `No ${tag} logo is available to this project yet, so slides needing it keep what they have and are flagged for review.`,
    actions: checked === 0 ? ['choose-another-file'] : ['download', 'choose-another-file'],
  };
}

/**
 * Whether one asset can be placed right now. `unknown` is its own answer: a
 * probe that threw is not evidence that the asset is missing, and the row says
 * which of the two it is.
 */
async function assetPresence(host: ReadinessHostV1, id: string): Promise<'present' | 'absent' | 'unknown'> {
  try {
    return (await host.assets.isAvailable(id)) === true ? 'present' : 'absent';
  } catch {
    return 'unknown';
  }
}

// ─── capabilities ────────────────────────────────────────────────────────────

/**
 * Source bytes a deck may be, taken from the pptx inflate cap in
 * `packages/node-shell/src/pptx.ts`. That constant is module-private there, so
 * the number is repeated here rather than imported; the two are pinned together
 * by the test beside this file.
 */
export const REBRAND_MAX_SOURCE_BYTES = 100 * 1024 * 1024;

/**
 * Decoded pixels the review may hold at once. Plan 274's memory row gives the
 * arithmetic: a 1920 by 1080 RGBA buffer is 7.91 MiB, and forty originals plus
 * forty proposals is about 633 MiB before anything else. The ceiling below is
 * half of that pair count, about 316 MiB of RGBA, which is a starting engineering
 * goal and not a measurement. Replace it with the baselines WP 0b records.
 */
export const REBRAND_MAX_DECODED_PIXELS = 1920 * 1080 * 40;

export interface CapabilitiesOptsV1 {
  /**
   * Whether this build can write a pptx from Design's own frames (WP 6). False
   * until that writer is in the tree, and injected rather than probed so this
   * file carries no dependency on the export path.
   */
  nativePptx?: boolean;
}

/**
 * What the web and desktop surfaces can do for this journey. Both keep the bytes
 * on the device, so the privacy line is the same for each; the difference between
 * them is in file access, not in where a deck goes.
 *
 * `maxSlides` is left unset on purpose. Plan 274 takes the supported deck size
 * from the Design-handoff baselines, so a number stated before those are recorded
 * would be a claim rather than a limit.
 */
export function capabilitiesFor(
  surface: 'web' | 'tauri',
  host: Pick<HostV1, 'ocr'>,
  opts: CapabilitiesOptsV1 = {},
): RebrandCapabilitiesV1 {
  return {
    surface,
    bytes: 'device',
    ocr: ocrAvailable(host),
    rasterFallback: true,
    nativePptx: opts.nativePptx === true,
    designDocument: true,
    limits: {
      maxBytes: REBRAND_MAX_SOURCE_BYTES,
      maxDecodedPixels: REBRAND_MAX_DECODED_PIXELS,
    },
    retention: 'Kept on this device until you delete the project.',
  };
}
