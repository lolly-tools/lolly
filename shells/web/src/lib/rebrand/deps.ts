// SPDX-License-Identifier: MPL-2.0
/**
 * The real pieces the renovation controller is built from in the web shell (plan 274
 * sections 3.5 and 4): `createRebrandDeps(host, extra)` answers `RebrandControllerDepsV1`
 * with the store, the ingest, the stage runner, the design-system reader, readiness, the
 * picture URLs, the retained source bytes, the `.lolly` writer, the Design handoff and
 * the job registry.
 *
 * Load order matters here, because the view imports this file at module scope:
 *
 *   - The ingest (the pptx and PDF readers, fflate, `sourceDeckFromPptx`,
 *     `sourceDeckFromPdf` and the slide picture rebuild) and the `.lolly` writer arrive
 *     by dynamic import the first time they are asked for, so the view's chunk carries
 *     neither.
 *   - The stages never load here at all. `runStage` names a registered stage; the worker
 *     loads `stages.ts` in its own realm, and the runner's fallback reaches it through a
 *     dynamic import.
 *
 * Two rules this module keeps for the rest of the journey:
 *
 *   1. **The stage adapter** (`stageRunnerFor`) names, versions and titles each stage and
 *      refuses an envelope that answers for other work.
 *   2. **A heavy job owns the slot its stages run under.** `lib/jobs.ts` has one heavy
 *      slot and no timeout. A controller job that held it through `runJob` while a stage
 *      queued for it would wait forever, so `runJob` here claims the slot through
 *      `withHeavySlot`, and a stage started inside it adopts that slot instead of
 *      queueing (see `stage-runner.ts`, "The heavy slot rule").
 *
 * Presets come from `presets.ts`: the design system's preset assets and the personal
 * layer on the profile. The ingest holds the in-place model offer back while it runs
 * (`holdOffers`), and readiness reads the OCR size from the model part it would download.
 *
 * Reading the slide pictures (plan 274 section 6) takes two more pieces, the controller's
 * `RebrandSlidePictureDepsV1`: `ensureTextReading` is `ensureModel("ocr")` from
 * `lib/model-offer.ts`, the download offered in place and never a trip to Settings, and
 * `rebuildSlidePictures` is the ingest's rebuild over `host.ocr`.
 *
 * The store pieces (one store per host, the verbatim source-byte writer, the release
 * rule and the provenance hint) live in `user-assets.ts`, a leaf, so this file can hand
 * the store out without loading the reader; they are re-exported below.
 */
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type {
  CompiledDeckV1,
  DeckCensusV1,
  ProjectStageV1,
  RenovationPlanV1,
  RenovationProjectV1,
  SourceDeckV1,
  StageEnvelopeV1,
} from '@lolly-tools/core';
import { CENSUS_RULES } from '../../../../../engine/src/deck-census-rules.ts';
import { DECK_COMPILE_VERSION, DECK_RENOVATE_VERSION } from '../../../../../engine/src/deck-compile.ts';
import { PLAN_RULES } from '../../../../../engine/src/rebrand-plan.ts';
import { ENGINE_VERSION } from '../../../../../engine/src/version.ts';
import { t } from '../../i18n.ts';
import type { BeamAssetRecord } from '../beam-pack.ts';
import { cancelJob, dismissJob, resourceJobs, runJob, startJob, subscribe, type JobHandle } from '../jobs.ts';
import { ensureModel, holdModelOffers } from '../model-offer.ts';
import { classifyDevice, decodeBudgetFor, type DeviceHintsV1 } from './budget.ts';
import type {
  RebrandControllerDepsV1,
  RebrandJobHandleV1,
  RebrandJobOptsV1,
  RebrandPackPartsV1,
  RebrandStageNameV1,
} from './controller-api.ts';
import { drawnLabelCount, slidePictureIdsOf, type RebrandSlidePictureDepsV1 } from './controller.ts';
import type { PdfReadersV1 } from './ingest.ts';
import { isMasterAssets, readActiveDesignSystem, type DesignSystemNeedsV1 } from './design-system.ts';
import { mergePresets, readPackPresets, readPersonalPresets, savePersonalPreset } from './presets.ts';
import { ocrPartInfo, readinessFor, type ReadinessItemV1 } from './readiness.ts';
import { StaleReplyError, isStageCancelled, runStage, withHeavySlot, type HeavySlotTokenV1 } from './stage-runner.ts';

// ─── the user asset store ────────────────────────────────────────────────────
// The store pieces live in user-assets.ts, a leaf, so ingest.ts can use them without
// importing this file. Re-exported so callers keep one import path.
export {
  REBRAND_SOURCE_HINT,
  isPickerHost,
  mintUploadId,
  provenanceFor,
  rebrandPictureUpload,
  rebrandStoreFor,
  setRebrandPictureUpload,
  uploadSlug,
  userAssetStoreOf,
  type RebrandPictureUploadV1,
  type RebrandStoreHost,
  type UserAssetStoreV1,
  type UserAssetWriteV1,
} from './user-assets.ts';
import { mintUploadId, provenanceFor, rebrandStoreFor, userAssetStoreOf } from './user-assets.ts';

// ─── the stage runner ────────────────────────────────────────────────────────

/** The project stage each registered stage reports under. The faithful pass is a compile. */
export const REBRAND_STAGE_OF: Readonly<Record<RebrandStageNameV1, ProjectStageV1>> = Object.freeze({
  'rebrand.census': 'census',
  'rebrand.plan': 'plan',
  'rebrand.compile': 'compile',
  'rebrand.faithful': 'compile',
});

/** The version each stage's result is recorded under, from the engine's own constants. */
export const REBRAND_STAGE_VERSION: Readonly<Record<RebrandStageNameV1, string>> = Object.freeze({
  'rebrand.census': CENSUS_RULES.version,
  'rebrand.plan': PLAN_RULES.version,
  'rebrand.compile': DECK_RENOVATE_VERSION,
  'rebrand.faithful': DECK_COMPILE_VERSION,
});

/**
 * The stages that run without a job toast when no job holds the slot: the ones a review
 * edit starts (a preview compile, the colour solve behind Shuffle and Automatic). The
 * Proposed pane's Updating pill is their progress, so a toast would say it twice. Run
 * under a job (the first read, Open in Design) they adopt its slot and its toast.
 */
export const REBRAND_QUIET_STAGES: ReadonlySet<RebrandStageNameV1> = new Set(['rebrand.compile', 'rebrand.plan']);

/**
 * Whether the web rebrand reads the text in slides that are pictures of slides. True
 * since `readSlidePictures` rebuilds them, so readiness offers the text recognition
 * download for a deck that has such slides, because it now changes them.
 */
export const OCR_STAGE_READY = true;

/** What the job toast calls each stage, in the person's language. */
export function rebrandStageTitle(stage: RebrandStageNameV1): string {
  switch (stage) {
    // The words the intake's progress line uses for the same stage, since both show at once.
    case 'rebrand.census':
      return t('Looking for repeated objects');
    case 'rebrand.plan':
      return t('Preparing suggestions');
    case 'rebrand.compile':
      return t('Drawing the proposed slides');
    case 'rebrand.faithful':
      return t('Drawing the original slides');
  }
}

/** What the job toast calls the read of a deck. For the controller's own job around the ingest. */
export function rebrandReadTitle(): string {
  return t('Reading the deck');
}

/** What this device says about itself, without measuring anything. */
function deviceHints(): DeviceHintsV1 {
  const nav = globalThis.navigator as (Navigator & { deviceMemory?: unknown }) | undefined;
  const hints: DeviceHintsV1 = {};
  if (typeof nav?.deviceMemory === 'number') hints.deviceMemoryGb = nav.deviceMemory;
  if (typeof nav?.hardwareConcurrency === 'number') hints.hardwareConcurrency = nav.hardwareConcurrency;
  try {
    if (typeof globalThis.matchMedia === 'function') hints.isMobile = globalThis.matchMedia('(pointer: coarse)').matches;
  } catch {
    // No media query here: the device reads as a laptop.
  }
  return hints;
}

/**
 * The controller's `runStage`, over a runner (the real `runStage` unless a test passes
 * one). It names the registered stage, reports under its project stage and version,
 * titles the job, passes the tag and the signal through, and unwraps the envelope. An
 * envelope for another project, another plan revision or another stage is refused with
 * `StaleReplyError`, so a late result never reaches the controller as current.
 */
export function stageRunnerFor(
  run: typeof runStage = runStage,
  budget = decodeBudgetFor(classifyDevice(deviceHints())),
): RebrandControllerDepsV1['runStage'] {
  return async <I, O>(
    stage: RebrandStageNameV1,
    input: I,
    tag: { projectId: string; planRevision?: number },
    signal: AbortSignal,
  ): Promise<O> => {
    const projectStage = REBRAND_STAGE_OF[stage];
    const envelope: StageEnvelopeV1<O> = await run<I, O>({
      projectId: tag.projectId,
      ...(tag.planRevision === undefined ? {} : { planRevision: tag.planRevision }),
      stage: projectStage,
      name: stage,
      algorithmVersion: REBRAND_STAGE_VERSION[stage],
      input,
      budget,
      signal,
      title: rebrandStageTitle(stage),
      ...(REBRAND_QUIET_STAGES.has(stage) ? { quiet: true } : {}),
      // Under a quiet run the stage adopts its token, as it adopts a held slot, so it
      // puts no job of its own on the toast.
      ...(quietSlot() ? { slot: quietSlot() } : {}),
    });
    if (
      envelope.projectId !== tag.projectId
      || envelope.planRevision !== tag.planRevision
      || envelope.stage !== projectStage
    ) {
      throw new StaleReplyError(envelope.projectId, envelope.planRevision);
    }
    return envelope.result;
  };
}

/**
 * `runJob` over the heavy slot. A heavy job claims the slot through `withHeavySlot`, so
 * every stage the controller runs inside it adopts that slot rather than queueing for
 * it. A light job (`heavy: false`) is the plain `runJob`. The handle the work gets
 * reports progress and cancellation the way `runJob`'s does; the slot owns finishing.
 *
 * `quietWhile` (close-out section 2.1): while it answers true when the job starts, the
 * view shows the reading itself, so the job runs quietly (`runQuietly`) and puts
 * nothing on the toast unless the person leaves that view.
 */
export async function runJobOverHeavySlot<T>(
  opts: RebrandJobOptsV1,
  work: (handle: RebrandJobHandleV1) => Promise<T> | T,
): Promise<T | undefined> {
  if (opts.heavy === false) return runJob(opts, work);
  const { quietWhile } = opts;
  if (quietWhile && (await quietTurn(quietWhile))) return runQuietly(opts, quietWhile, work);
  let began = false;
  try {
    return await withHeavySlot(opts.title, async (slot) => {
      began = true;
      const onAbort = (): void => { opts.cancel?.(); };
      slot.signal.addEventListener('abort', onAbort, { once: true });
      try {
        const handle: RebrandJobHandleV1 = {
          id: slot.id,
          started: Promise.resolve(),
          get cancelled() { return slot.cancelled; },
          progress: (done, total, note) => { slot.progress(done, total, note); },
          finish: () => {},
          fail: () => {},
          settle: () => {},
          dismiss: () => { dismissJob(slot.id); },
        };
        // Work that finished stands, even when a cancel reached the slot after the
        // last check inside it: what it did (Design opened, a session recorded) is
        // done. A cancel in time is the work's own signal check, which throws.
        return await work(handle);
      } finally {
        slot.signal.removeEventListener('abort', onAbort);
      }
    });
  } catch (err) {
    // Cancelled while waiting for the slot: `runJob` answers undefined for that.
    if (!began && isStageCancelled(err)) return undefined;
    throw err;
  }
}

// ─── the quiet run ───────────────────────────────────────────────────────────

/** How often a quiet run asks the view whether it still shows the reading, in ms. */
export const QUIET_POLL_MS = 250;

/** The quiet run in flight: a stage started inside it adopts this token. */
const quietSlots: HeavySlotTokenV1[] = [];

function quietSlot(): HeavySlotTokenV1 | undefined {
  return quietSlots[quietSlots.length - 1];
}

/** A heavy job holds the slot or waits for it. */
function heavyJobActive(): boolean {
  return resourceJobs().some((job) => job.heavy);
}

/**
 * Wait until a quiet run may start: true once no heavy job holds or waits for the slot
 * while the view still shows the reading, false as soon as it does not (the job then
 * queues for the slot on the toast like every other job).
 */
function quietTurn(quietWhile: () => boolean): Promise<boolean> {
  if (!quietWhile()) return Promise.resolve(false);
  if (!heavyJobActive()) return Promise.resolve(true);
  return new Promise((resolve) => {
    let settled = false;
    const check = (): void => {
      if (settled) return;
      const quiet = quietWhile();
      if (quiet && heavyJobActive()) return;
      settled = true;
      stop();
      clearInterval(timer);
      resolve(quiet);
    };
    const stop = subscribe(check);
    const timer = setInterval(check, QUIET_POLL_MS);
    (timer as { unref?: () => void }).unref?.();
  });
}

/**
 * A job the view is showing itself: no entry on the job toast while `quietWhile`
 * answers true, and a toast from the moment it answers false (the person left the
 * view), carrying the last progress and the cancel. The stages under it adopt its
 * token, so they add no job of their own either.
 *
 * It holds no place in the registry's heavy slot, since a place there is a toast
 * entry. It starts only once no heavy job holds or waits for the slot, and a job the
 * person starts elsewhere while it runs means they left the view, which is when the
 * toast appears; the entry it shows then is a light one, so it never queues behind
 * the work it is reporting on.
 *
 * `dismiss` on the handle answers the view's "the deck is read" once the job
 * finished: a job that never showed has nothing on screen to take down, and one that
 * showed leaves the toast at once (`dismissJob`) rather than after its retention.
 */
async function runQuietly<T>(
  opts: RebrandJobOptsV1,
  quietWhile: () => boolean,
  work: (handle: RebrandJobHandleV1) => Promise<T> | T,
): Promise<T | undefined> {
  const controller = new AbortController();
  const shown: { job: JobHandle | null; last: [number, number, string | undefined] | null } = { job: null, last: null };
  const show = (): void => {
    if (shown.job || quietWhile()) return;
    const job = startJob({ title: opts.title, heavy: false, cancel: () => { controller.abort(); } });
    shown.job = job;
    if (shown.last) job.progress(...shown.last);
  };
  const onAbort = (): void => { opts.cancel?.(); };
  controller.signal.addEventListener('abort', onAbort, { once: true });
  const id = `quiet-${quietSlots.length + 1}`;
  const token: HeavySlotTokenV1 = {
    id,
    get cancelled() { return controller.signal.aborted; },
    progress: (done, total, note) => {
      shown.last = [done, total, note];
      if (shown.job) shown.job.progress(done, total, note);
      else show();
    },
    signal: controller.signal,
  };
  const timer = setInterval(show, QUIET_POLL_MS);
  (timer as { unref?: () => void }).unref?.();
  quietSlots.push(token);
  try {
    const handle: RebrandJobHandleV1 = {
      id,
      started: Promise.resolve(),
      get cancelled() { return controller.signal.aborted; },
      progress: token.progress,
      finish: () => {},
      fail: () => {},
      settle: () => {},
      // A run that stayed quiet put nothing on screen; one that showed is taken down.
      dismiss: () => { if (shown.job) dismissJob(shown.job.id); },
    };
    const value = await work(handle);
    shown.job?.finish();
    return value;
  } catch (err) {
    if (shown.job) {
      if (controller.signal.aborted || isStageCancelled(err)) cancelJob(shown.job.id);
      else shown.job.fail(err);
    }
    throw err;
  } finally {
    clearInterval(timer);
    const at = quietSlots.indexOf(token);
    if (at >= 0) quietSlots.splice(at, 1);
    controller.signal.removeEventListener('abort', onAbort);
    shown.job?.settle();
  }
}

// ─── the design system's faces ───────────────────────────────────────────────

/** The weights a proposed slide draws its text in: body and bold titles. */
const FACE_WEIGHTS = ['400', '700'] as const;

/** The longest the first proposed drawing waits for the faces, in ms, before it draws with what it has. */
export const FACE_LOAD_BUDGET_MS = 3000;

/** A family as a CSS font shorthand names it: quoted, with a quote or backslash in it escaped. */
function cssFamily(family: string): string {
  return `"${family.replace(/["\\]/g, (c) => `\\${c}`)}"`;
}

/**
 * Load the design system's faces into the document before the first proposed drawing
 * (close-out 9.2). A catalog face is declared in `styles/fonts.css`, and a face the
 * person installed through the brand editor is registered by `registerUserFonts`
 * (`user-fonts.ts`, at boot and on install); both are the faces `bridge/font-registry.ts`
 * resolves for vector export. `document.fonts.load` fetches whichever of them names the
 * family, in the weights a slide draws. Resolves within `FACE_LOAD_BUDGET_MS` at most,
 * and never rejects: a face that cannot load leaves the drawing to its fallback.
 */
export async function loadDesignSystemFaces(families: readonly string[], budgetMs: number = FACE_LOAD_BUDGET_MS): Promise<void> {
  const fonts = (globalThis as { document?: { fonts?: { load?: (font: string) => Promise<unknown> } } }).document?.fonts;
  const load = fonts?.load?.bind(fonts);
  if (!load) return;
  const wanted = [...new Set(families.map((family) => family.trim()).filter(Boolean))];
  if (wanted.length === 0) return;
  const loads = wanted.flatMap((family) => FACE_WEIGHTS.map((weight) => load(`${weight} 16px ${cssFamily(family)}`).catch(() => undefined)));
  let timer: ReturnType<typeof setTimeout> | undefined;
  const budget = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, Math.max(0, budgetMs));
    (timer as { unref?: () => void }).unref?.();
  });
  try {
    await Promise.race([Promise.all(loads).then(() => undefined), budget]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

// ─── the rest of the deps ────────────────────────────────────────────────────

/** A user-asset record as the `.lolly` writer takes it, or null when it is not one. */
function beamRecordOf(value: unknown): BeamAssetRecord | null {
  const r = value as Partial<Record<keyof BeamAssetRecord, unknown>> | null | undefined;
  if (!r || typeof r.id !== 'string' || typeof r.type !== 'string' || typeof r.format !== 'string') return null;
  const out: BeamAssetRecord = { id: r.id, type: r.type, format: r.format };
  if (r.blob instanceof Blob) out.blob = r.blob;
  if (typeof r.version === 'string') out.version = r.version;
  if (typeof r.checksum === 'string') out.checksum = r.checksum;
  if (typeof r.width === 'number') out.width = r.width;
  if (typeof r.height === 'number') out.height = r.height;
  if (r.meta && typeof r.meta === 'object') out.meta = { ...(r.meta as Record<string, unknown>) };
  if (r.credential instanceof Uint8Array) out.credential = r.credential;
  if (typeof r.credentialFormat === 'string') out.credentialFormat = r.credentialFormat;
  if (r.aiGenerated === 'full' || r.aiGenerated === 'partial') out.aiGenerated = r.aiGenerated;
  return out;
}

/**
 * Parts the controller holds in memory, for a `.lolly` file while the store holds less.
 * The contract owns the type; it is named here too so a caller of this file keeps one
 * import path.
 */
export type { RebrandPackPartsV1 };

export interface RebrandDepsExtraV1 {
  design: RebrandControllerDepsV1['design'];
  keepDesign?: RebrandControllerDepsV1['keepDesign'];
}

/**
 * The PDF reader's image codec and decoders, as a view registers them (the PDF import's
 * own, `rebrandPdfReaders` in `views/pdf-import.ts`), so this lib module never imports a
 * view. Unset, a PDF deck reads with the reader's pure codec.
 */
let pdfReadersProvider: (() => Promise<PdfReadersV1>) | null = null;

/** Register the PDF readers the ingest uses, or clear them with null. */
export function setRebrandPdfReaders(provider: (() => Promise<PdfReadersV1>) | null): void {
  pdfReadersProvider = provider;
}

/** What the in-place model offer names as needing the text recognition model. */
export function textReadingReason(purpose: 'pictures' | 'labels' = 'pictures'): string {
  return purpose === 'labels' ? t('Reading chart labels') : t('Reading text in slide pictures');
}

/**
 * The text recognition row for a deck whose only need of it is its charts' outlined
 * labels: the download alone, since keeping pictures or choosing another file answers
 * nothing about a chart. A shell that cannot read text at all has no row.
 */
export function labelsRow(row: ReadinessItemV1): ReadinessItemV1 {
  return {
    ...row,
    id: 'ocr:labels',
    message: 'Chart labels are drawn as outlines. Text recognition reads them as text.',
    actions: row.actions.filter((action) => action === 'download'),
  };
}

/** The controller's deps over the web shell's real pieces, slide pictures included. */
export function createRebrandDeps(host: HostV1, extra: RebrandDepsExtraV1): RebrandControllerDepsV1 & RebrandSlidePictureDepsV1 {
  const store = rebrandStoreFor(host);
  const assets = userAssetStoreOf(host);
  /** The readiness needs from the last design-system read, so readiness does not read twice. */
  let lastNeeds: DesignSystemNeedsV1 | null = null;
  /** Object URLs this module made, so a release revokes only its own. */
  const made = new Set<string>();

  const deps: RebrandControllerDepsV1 & RebrandSlidePictureDepsV1 = {
    store,

    async ingest(input) {
      const { ingestDeck } = await import('./ingest.ts');
      const pdfReaders = pdfReadersProvider;
      return ingestDeck(host, input, { store, ...(pdfReaders ? { pdfReaders } : {}) });
    },

    ensureTextReading: (purpose) => ensureModel('ocr', { reason: textReadingReason(purpose) }),

    async rebuildSlidePictures(input) {
      const { rebuildSlidePictures } = await import('./ingest.ts');
      return rebuildSlidePictures(host, input);
    },

    async readVectorLabels(input) {
      const { readVectorLabelsIn } = await import('./ingest.ts');
      return readVectorLabelsIn(host, input);
    },

    runStage: stageRunnerFor(),

    async resolveDesignSystem() {
      const read = await readActiveDesignSystem(host);
      lastNeeds = read?.needs ?? null;
      return read?.resolved ?? null;
    },

    async readiness(source, census) {
      if (!lastNeeds) lastNeeds = (await readActiveDesignSystem(host).catch(() => null))?.needs ?? null;
      // Text recognition is asked about only while a slide is still one picture of a
      // whole slide, or a chart still holds labels drawn as outlines: once those are
      // read, the download changes nothing.
      const pictures = OCR_STAGE_READY && census !== null && census.flattenedSlideIds.length > 0 && slidePictureIdsOf(source).length > 0;
      const labels = !pictures && drawnLabelCount(source) > 0;
      const rows = await readinessFor({
        host,
        ocrPart: ocrPartInfo,
        needs: {
          ...(pictures || labels ? { ocr: true } : {}),
          ...(lastNeeds?.masterAssetId ? { masterAssetId: lastNeeds.masterAssetId } : {}),
          logoTags: lastNeeds?.logoTags ?? [],
        },
      });
      // The panel lists what is missing; a row that is ready has nothing to ask. The
      // slide pictures' `ocr` row stays when ready, since it is how the controller knows
      // it may read a picture deck on arrival without offering anything; the intake
      // draws no ready row. For chart labels alone the row is `ocr:labels`, so it is not
      // taken for the slide pictures' offer, and it offers the download only: there is
      // no picture to keep.
      return rows
        .filter((row) => row.state !== 'ready' || (pictures && row.id === 'ocr'))
        .map((row) => (labels && row.id === 'ocr' ? labelsRow(row) : row))
        .filter((row) => row.id !== 'ocr:labels' || row.actions.length > 0);
    },

    async mediaUrl(ref) {
      const blob = await assets?._getBlob?.(ref).catch(() => null);
      if (blob) {
        const url = URL.createObjectURL(blob);
        made.add(url);
        return url;
      }
      const resolved = await host.assets.get(ref).catch(() => null);
      return resolved?.url || undefined;
    },

    releaseMediaUrl(url) {
      if (!made.delete(url)) return;
      URL.revokeObjectURL(url);
    },

    async sourceBytes(project: RenovationProjectV1) {
      const ref = project.source.bytesAssetRef;
      if (!ref || !assets?._getBlob) return null;
      const blob = await assets._getBlob(ref).catch(() => null);
      return blob ? new Uint8Array(await blob.arrayBuffer()) : null;
    },

    async packProject(project: RenovationProjectV1, held: RebrandPackPartsV1 = {}) {
      const [{ buildRenovationLolly }, { LOLLY_MIME }] = await Promise.all([
        import('../lolly-renovation.ts'),
        import('../lolly-pack.ts'),
      ]);
      const [sourceDeck, census, plan, compiled] = await Promise.all([
        held.sourceDeck ?? store.getPart<SourceDeckV1>(project.id, 'sourceDeck'),
        held.census ?? store.getPart<DeckCensusV1>(project.id, 'census'),
        held.plan ?? store.getPart<RenovationPlanV1>(project.id, 'plan'),
        held.compiled ?? store.getPart<CompiledDeckV1>(project.id, 'compiled'),
      ]);
      const built = await buildRenovationLolly({
        project,
        parts: {
          ...(sourceDeck ? { sourceDeck } : {}),
          ...(census ? { census } : {}),
          ...(plan ? { plan } : {}),
          ...(compiled ? { compiled } : {}),
        },
        resolveAsset: async (ref) => beamRecordOf(await assets?._getUserRecord?.(ref).catch(() => null)),
        engineVersion: ENGINE_VERSION,
      });
      return { blob: new Blob([built.bytes as BlobPart], { type: LOLLY_MIME }), filename: built.filename };
    },

    design: extra.design,
    runJob: runJobOverHeavySlot,

    loadFaces: (families) => loadDesignSystemFaces(families),

    /**
     * A `.lolly` file kept on this device, for a document too large for Design's
     * automatic history (close-out decision 10): a `data` user asset under the file's
     * own name, stored through the same quota-checked write the source deck takes. It is
     * the person's, not the project's: removing the project leaves it.
     */
    async saveProjectFile(file) {
      if (!assets) return null;
      const name = file.filename || 'project.lolly';
      await assets._uploadUserAsset({
        id: mintUploadId(name, Date.now()),
        type: 'data',
        format: 'lolly',
        blob: file.blob,
        version: '1.0.0',
        meta: { name, provenance: provenanceFor(name) },
      });
      return { name };
    },

    presets: {
      async list() {
        const pack = isMasterAssets(host.assets) ? await readPackPresets(host.assets) : [];
        return mergePresets(pack, await readPersonalPresets(host));
      },
      savePersonal: (preset, name) => savePersonalPreset(host, preset, name),
    },

    holdOffers: holdModelOffers,
  };
  if (extra.keepDesign) deps.keepDesign = extra.keepDesign;
  return deps;
}
