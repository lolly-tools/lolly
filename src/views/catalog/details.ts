// SPDX-License-Identifier: MPL-2.0
/**
 * catalog: the details sheet for one asset, its audio visualiser and cover art.
 *
 * Every function takes the shared `cat: CatCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `cat.<module>.<fn>`. Extracted verbatim
 * from mountCatalog() by scripts/split-closure.ts.
 */
import { derivePeaks, memoPeaks } from '../../lib/audio-peaks.ts';
import type { AssetRef } from '@lolly-tools/core/host-v1';
import { bindOp } from './context.ts';
import type { CatCtx } from './context.ts';
import { audioCardArt, audioElOf, meterElOf, setAudioCover, wireAudioViz } from './details-shared.ts';
import type { DetailsCtx } from './details-context.ts';
import { panelsOps } from './details-panels.ts';
import { inlineModesOps } from './details-inline-modes.ts';
import { sheetOps } from './details-sheet.ts';
export { wireAudioViz, audioCardArt, audioElOf, meterElOf, setAudioCover } from './details-shared.ts';


export function openDetails(cat: CatCtx, ref: AssetRef, initialTheme?: string | null, initialTreatment?: string | null): void {
  const dt = {} as DetailsCtx;
  dt.panels = panelsOps(dt);
  dt.inlineModes = inlineModesOps(dt);
  dt.sheet = sheetOps(dt);
  dt.cat = cat;
  dt.ref = ref;
  dt.initialTheme = initialTheme;
  dt.initialTreatment = initialTreatment as DetailsCtx['initialTreatment'];
  dt.openDetails = openDetails;


  dt.sheet.readAsset();

  dt.sheet.buildSheet();
  dt.panels.renderOrigins();

  dt.sheet.paintPassport();

  dt.sheet.wireTextAsset();
  // Inline video edit (plans/130): Grade and Trim are two tabs of ONE mode over
  // this preview - the look and the in/out points are both decisions about what is
  // on screen, so they are made at the frame. Applying enqueues a background job and
  // leaves; the global toast owns progress, exactly like the vid-* dialog path.
  // Inline STILL grade (2026-08-20): the video Grade tab's bitmap sibling. Same
  // takeover shape as the video mode; Apply enqueues a background job and exits,
  // so the toast (riding above this modal now) owns progress and cancel.
  dt.inlineGrade = null;
  dt.gradeEntering = false;

  dt.inlineVideoEdit = null;
  dt.videoEditEntering = false;
  // Synchronous in-flight guard: `inlineCrop` isn't assigned until AFTER the async
  // prepCropSource below, so a fast double-click could pass an `if (inlineCrop)`
  // check twice and build two overlays. This flag is set/cleared around the only
  // await; everything after it is synchronous through `inlineCrop = exit`.
  dt.cropEntering = false;

  /**
   * Inline trim mode: "Trim margins" measures the STORED bytes and, when a trim
   * would buy something, shows the shared before/after card in the body under the
   * actions - the same card the dropzone and the asset picker show at upload time,
   * offered here after the fact. It stays in THIS modal, like crop.
   *
   * "Trim" rewrites the bytes in place (commitTrim) and reopens the details on the
   * fresh asset; "Keep original margins", the card's ✕ and Escape all leave the
   * upload untouched (nothing is being ingested here, so backing out and keeping
   * the margins land in the same place). An upload that is already tight gets a
   * note instead, and the action stays where it is. `inlineTrim` (declared beside
   * the modal) holds the exit fn while a card is up, so onClose can answer one the
   * dialog outlived.
   */
  dt.trimEntering = false;

  dt.sheet.wireSheetEvents();
}
/**
 * Measure the favourited AUDIO assets so the strip can draw real waveforms.
 *
 * The strip builds its markup synchronously, so it can only draw peaks already in
 * memory - none on a cold load, which left a starred track as a card with a name and
 * nothing above it. Favourites are the one set where measuring up front is justified:
 * few by definition, and the assets the user looks at most. Bounded, sequential, and
 * it re-renders ONCE at the end rather than per asset.
 */
export async function warmFavAudioArt(cat: CatCtx): Promise<void> {
  const { host } = cat;
  if (cat.warmingFavArt) return;
  const need = cat.filters.favItems().filter(a => a.type === 'audio' && !memoPeaks(a.id)).slice(0, 12);
  if (!need.length) return;
  cat.warmingFavArt = true;
  try {
    let got = false;
    for (const a of need) {
      if (!cat.mounted) return;
      if (await derivePeaks(host, a, a.id).catch(() => null)) got = true;
    }
    if (got && cat.mounted) cat.sections.mountFavStrip();
  } finally {
    cat.warmingFavArt = false;
  }
}
export function detailsOps(cat: CatCtx) {
  return {
    openDetails: bindOp(cat, openDetails),
    wireAudioViz: bindOp(cat, wireAudioViz),
    audioCardArt: bindOp(cat, audioCardArt),
    warmFavAudioArt: bindOp(cat, warmFavAudioArt),
    audioElOf: bindOp(cat, audioElOf),
    meterElOf: bindOp(cat, meterElOf),
    setAudioCover: bindOp(cat, setAudioCover),
  };
}
