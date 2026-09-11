// SPDX-License-Identifier: MPL-2.0
/**
 * actions bar: stage facts, design audit, preflight and the cost panel.
 *
 * Every function takes the shared `ta: ActionsCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `ta.<module>.<fn>`. Extracted verbatim
 * from renderActions() by scripts/split-closure.ts.
 */
import { computeCost, isRateCardError, parseRateCard, preflight, validateRateCard } from '@lolly/engine';
import type { CostWorking, Count, Fact, PreflightInput, PreflightJob, PreflightManifest, StageFacts } from '@lolly/engine';
import { inspectDesignV1 } from '@lolly-tools/core';
import type { MoneyContext } from '@lolly-tools/core';
import type { Unit } from '../../../../../engine/src/units.js';
import { RASTER_DEFAULT_SCALE, SUPERSAMPLED_EXPORT_FORMATS } from '../../bridge/export-scale.ts';
import { tRaw } from '../../i18n.ts';
import { mountSlot, slotHasResolved } from '../../lib/extensions.ts';
import { isVectorImageSrc, placedImageLabel } from '../../lib/placed-image.ts';
import { getRateCardBlob, listCatalogRateCards, listRateCards } from '../../lib/rate-cards.ts';
import { applyCostPanel, costView } from '../cost-panel.ts';
import type { CostAuthoringContext } from '../cost-panel.ts';
import { mountedDesignFindingMessage } from '../design-audit-copy.ts';
import { auditMountedDesign } from '../design-mounted-audit.ts';
import { applyPreflight, isPreflightEnabled, preflightView } from '../export-preflight.ts';
import type { PreflightRow } from '../export-preflight.ts';
import { fmtLabel, isCmykFmt, printEnabled } from './shared.ts';
import { bindOp, type ActionsCtx } from './context.ts';

/** DOM truths, the only channel through which the stage reaches the engine. */
export function stageFacts(ta: ActionsCtx): Fact<StageFacts> {
  const { canvasEl } = ta;
  if (!canvasEl) return { known: false, why: 'needs-mount' };
  const durationS = ta.formatRules.seqDurationS();
  const boxes = canvasEl.querySelectorAll('[data-pdf-page]').length;
  // Measure placed raster images for the per-image effective-DPI check. Pure/sync
  // (getBoundingClientRect + naturalWidth) - stays on the refreshPreflight path,
  // never a render. Only images with real intrinsic pixels + a rendered box.
  const rect = canvasEl.getBoundingClientRect();
  const rasterImages = [...canvasEl.querySelectorAll('img')].flatMap((el) => {
    const nW = el.naturalWidth,
      nH = el.naturalHeight,
      b = el.getBoundingClientRect();
    if (!(nW > 0) || !(nH > 0) || !(b.width > 0) || !(b.height > 0)) return [];
    const src = el.currentSrc || el.src || '';
    // A placed SVG is VECTOR: it carries through PDF/SVG export as vector (or a
    // crisp render rasterised from the vector at output DPI - export.ts
    // drawHtmlVectors), so measuring its intrinsic naturalWidth as an
    // effective-DPI limit is meaningless and only ever a false "will look soft".
    // The field is rasterImages; a vector does not belong in it.
    if (isVectorImageSrc(src)) return [];
    const label = placedImageLabel(el.getAttribute('alt'), el.getAttribute('aria-label'), src);
    return [{ label, naturalW: nW, naturalH: nH, boxCssW: b.width, boxCssH: b.height }];
  });
  return {
    known: true,
    value: {
      isSequence: Boolean(ta.formatRules.seqStageEl()),
      durationMs: durationS === null ? null : Math.round(durationS * 1000),
      pageBoxes: boxes > 0 ? boxes : null,
      canvasCssW: rect.width > 0 ? rect.width : null,
      rasterImages,
    },
  };
}
// The manifest slice preflight reads, narrowed explicitly rather than passed
// through: RenderSpec's `video` is a Record<string, unknown> bag, and the two
// numbers preflight wants have to be proved to be numbers here.
export const vidNum = (ta: ActionsCtx, k: string): number | undefined => {
  const { manifest } = ta;
  const v = (manifest.render.video as Record<string, unknown> | undefined)?.[k];
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
};
export const designTone = (_ta: ActionsCtx, severity: 'error' | 'warn' | 'info'): PreflightRow['tone'] =>
  severity === 'error' ? 'error' : severity === 'warn' ? 'warn' : 'note';
export async function refreshDesignAudit(ta: ActionsCtx): Promise<void> {
  const { canvasEl, isDesignTool, manifest, runtime } = ta;
  if (!isDesignTool || !ta.designAuditOpen || !canvasEl) return;
  const generation = ++ta.designAuditGeneration;
  const boxes = runtime.getModel().find((input) => input.id === 'boxes')?.value;
  const rect = canvasEl.getBoundingClientRect();
  const report = inspectDesignV1(boxes, {
    width: rect.width || manifest.render.width,
    height: rect.height || manifest.render.height,
  });
  const structuralRows: PreflightRow[] = report.findings.map((finding) => ({
    id: finding.id,
    tone: designTone(ta, finding.severity),
    text: finding.message,
  }));
  ta.designAuditRows = structuralRows;
  refreshPreflight(ta);

  try {
    await document.fonts?.ready;
  } catch {
    /* mounted geometry still answers */
  }
  const mounted = await auditMountedDesign(canvasEl, report, {
    resolveFont: async (style, text) => {
      const { resolveVectorFont } = await import('../../bridge/font-registry.ts');
      return Boolean(await resolveVectorFont(style, text));
    },
  });
  if (!ta.designAuditOpen || generation !== ta.designAuditGeneration) return;
  ta.designAuditRows = [
    ...structuralRows,
    ...mounted.findings.map(
      (finding): PreflightRow => ({
        id: finding.id,
        tone: finding.id === 'design.text.contrast-review' ? 'gap' : designTone(ta, finding.severity),
        text: mountedDesignFindingMessage(finding),
      })
    ),
  ];
  refreshPreflight(ta);
}
export const onDesignExportOpen = (ta: ActionsCtx): void => {
  ta.designAuditOpen = true;
  ta.refresh.refreshNotesHandoutUi();
  void refreshDesignAudit(ta);
};
export const onDesignExportClose = (ta: ActionsCtx): void => {
  ta.designAuditOpen = false;
  ta.designAuditGeneration++;
  ta.designAuditRows = [];
  refreshPreflight(ta);
};
export const onDesignCanvasPaint = (ta: ActionsCtx): void => {
  ta.refresh.refreshNotesHandoutUi();
  if (ta.designAuditOpen) void refreshDesignAudit(ta);
};
/** Assemble the job from the live panel, run the engine's rules, render the card. */
export function refreshPreflight(ta: ActionsCtx): void {
  const { actions, el, formatEl, formats, initialFmt, manifest, preflightManifest, runtime } = ta;
  if (!actions.includes('download')) return;
  const fmt = formatEl?.value || initialFmt || formats[0] || '';
  const unit = ta.refresh.dimUnit() as Unit;
  const dpi = ta.dims.dimDpi();
  const { w, h } = ta.dims.rawDims();
  // A dims-less tool exports at the manifest's pixel canvas: that size came from
  // the manifest, so it is BARE PIXELS by construction and no unit was declared.
  const fixed = manifest.render.dims === false;
  // Both fields must hold a positive value before the ACTIVE UNIT may be applied
  // to them. `rawDims()` returns undefined for a blank or non-positive field, and
  // substituting `manifest.render.width` under a live `unit: 'mm'` manufactured a
  // PHYSICAL trim out of a bare pixel number nobody declared - a 1200 x 900 px
  // canvas reported as "Trim 1.08 m²", with `bound: 'exact'`, in the state a user
  // passes through every time they clear the width field to retype it. That is the
  // derivation plan section 4 forbids by name, and the real export path does not do it
  // either: it falls back to the MEASURED DOM box.
  //
  // So an incomplete pair reads as what it actually is - the manifest's pixel
  // canvas, `declaredBy: 'manifest'`, no unit declared. The engine then emits
  // `print.trim-not-physical` / `refuse.trim-when-unset` instead of an area.
  const typed = (w ?? 0) > 0 && (h ?? 0) > 0;
  // `declaredBy: 'url'` only when the size is genuinely the user's: a URL param,
  // a restored session, a size-select pick or an edit. Hard-coding it meant the
  // web could NEVER emit `refuse.trim-when-unset` while the CLI emitted it
  // routinely for the identical job, so the two surfaces disagreed on a pre-filled
  // tool where the user had set nothing at all.
  const fromUser = typed && ta.sizeUserSet;
  const manifestSize = fixed || !fromUser;
  // …and when the manifest canvas is what renders, it is not always what COMES OUT.
  // With both size fields blank the export path passes no dimension at all, so
  // `rasterStyle` takes its not-requested branch and supersamples the node box by
  // RASTER_DEFAULT_SCALE: a 1200 x 900 tool exported to PNG is a 2400 x 1800 file.
  // Reporting the manifest numbers there stamped `bound: 'exact'` on a pixel count
  // four times too small. A fixed-dims tool (`dims === false`) is exempt: it passes
  // the manifest size explicitly, which IS a request, so no scale applies - and so
  // is every vector/PDF format, which never reaches `rasterStyle`.
  const supersampled =
    manifest.render.dims !== false &&
    !typed &&
    SUPERSAMPLED_EXPORT_FORMATS.has(fmt.toLowerCase());
  const canvasScale = supersampled ? RASTER_DEFAULT_SCALE : 1;
  const width = manifestSize
    ? { value: manifest.render.width * canvasScale, unit: 'px' as Unit }
    : { value: w!, unit };
  const height = manifestSize
    ? { value: manifest.render.height * canvasScale, unit: 'px' as Unit }
    : { value: h!, unit };
  // `unitDeclared` is true only when the SOURCE spelled a unit out - here, when
  // the panel offers the unit selector AND the value in the field is the one the
  // user put there. False makes the engine refuse to derive an area rather than
  // trust a fabricated unit.
  const unitDeclared = !manifestSize && manifest.render.units !== false;

  const on = printEnabled(el);
  const bleedMm = parseFloat(
    el!.querySelector<HTMLInputElement>('[data-action="print-bleed"]')?.value ?? ''
  );
  const marks = ta.dims.printOpts();
  const job: PreflightJob = {
    source: 'web',
    manifest: preflightManifest,
    // Post-onInit: this panel only exists after the tool has mounted, so a
    // paginate source table is the hydrated one and its row count is exact.
    model: runtime.getModel() as readonly PreflightInput[],
    modelPhase: 'post-init',
    settings: {
      format: fmt,
      size: { width, height, dpi, declaredBy: manifestSize ? 'manifest' : 'url', unitDeclared },
      // The panel is the whole truth about bleed/marks/press profile here - an
      // absent card means the export applies none, which is a KNOWN null, not an
      // unknown. (A batch-snapshot row, which carries none of them, is the case
      // that must report `{ known:false, why:'not-carried' }`.)
      bleed: { known: true, value: on && bleedMm > 0 ? { value: bleedMm, unit: 'mm' } : null },
      marks: {
        known: true,
        value: on
          ? {
              crop: marks.cropMarks,
              registration: marks.registrationMarks,
              bleed: marks.bleedMarks,
              colorBars: marks.colorBars,
              provenance: marks.provenance,
            }
          : null,
      },
      // The reserved `profile` param is the PRESS CONDITION, not a user profile.
      //
      // Reported ONLY when the setting is actually in force. The Color profile
      // card is rendered (and its select populated with DEFAULT_CMYK_CONDITION)
      // for any tool that OFFERS a CMYK format, and merely display:none'd for the
      // others - so reading `.value` unconditionally asserted "the user chose
      // fogra39" on the default SVG/PNG export of every such tool, and the card
      // read "1 to fix" out of the box. The engine rule is right; the collector
      // was inventing the setting.
      pressProfile: {
        known: true,
        value: isCmykFmt(fmt)
          ? el!.querySelector<HTMLSelectElement>('[data-action="cmyk-profile"]')?.value || null
          : null,
      },
      cuts: ta.sequence.cutsValue(),
      password: Boolean(
        el!.querySelector<HTMLInputElement>('[data-action="pdf-password"]')?.value
      ),
      durable: el!.querySelector<HTMLInputElement>('[data-action="durable"]')?.checked ?? false,
      hdr: el!.querySelector<HTMLInputElement>('[data-action="hdr"]')?.checked ?? false,
    },
    palette: ta.palette,
    stage: stageFacts(ta),
  };

  // The fact row states the size the JOB carries, so it agrees with the findings
  // by construction: a manifest-sourced size shows as the pixel canvas it is.
  const sizeText = manifestSize
    ? `${manifest.render.width * canvasScale} × ${manifest.render.height * canvasScale} px`
    : unit === 'px'
      ? `${w} × ${h} px`
      : tRaw('{w} × {h} {unit} at {dpi} DPI', { w: String(w), h: String(h), unit, dpi });
  const report = preflight(job);
  applyPreflight(
    el,
    preflightView(isPreflightEnabled() ? report : null, {
      formatLabel: fmt ? fmtLabel(fmt) : '',
      sizeText,
      bleedText: on && bleedMm > 0 ? `${bleedMm} mm` : null,
      additionalRows: ta.designAuditRows,
    })
  );
  // The cost pass consumes the SAME counts. Async (it reads stored cards), so it is
  // fired and forgotten off the latest counts; a stale in-flight pass is harmless
  // because each call re-reads the current selection and rewrites the card.
  ta.lastCounts = report.counts;
  void refreshCost(ta);
}
// Hydrate the cost-authoring slot when - and only when - an extension actually
// RESOLVES into it. Gating on slotHasResolved rather than mere element existence
// is what makes ASYNC delivery work: a control-plane/community bundle evaluated
// after first paint calls registerExtension, which fires onExtensionsChanged,
// which re-runs this and hydrates the door. Latches once mounted.
export function tryMountCostSlot(ta: ActionsCtx): void {
  const { el, host } = ta;
  if (ta.costSlotMounted) return;
  const slotEl = el?.querySelector<HTMLElement>('[data-cost-authoring]');
  if (!slotEl || !slotHasResolved('cost-authoring')) return;
  ta.costSlotMounted = true;
  // `WebToolHost.assets` carries the `_*UserAsset` methods at runtime.
  const rcHost = host as unknown as Parameters<typeof listRateCards>[0];
  void mountSlot<CostAuthoringContext>('cost-authoring', slotEl, {
    host: rcHost,
    onChange: () => {
      void refreshCost(ta);
    },
  }).then((d) => {
    ta.costSlotDispose = d;
  });
}
export function disposeActions(ta: ActionsCtx): void {
  const { canvasEl, costSlotUnsub, el, isDesignTool } = ta;
  void ta.automaticHistory?.flush();
  ta.automaticHistory?.dispose();
  if (isDesignTool) {
    ta.designAuditOpen = false;
    ta.designAuditGeneration++;
    el?.removeEventListener('lolly:export-open', ta.preflight.onDesignExportOpen);
    el?.removeEventListener('lolly:export-close', ta.preflight.onDesignExportClose);
    canvasEl?.removeEventListener('lolly-canvas-painted', ta.preflight.onDesignCanvasPaint);
  }
  costSlotUnsub();
  try {
    ta.costSlotDispose?.();
  } catch (e) {
    console.error(e);
  }
  ta.costSlotDispose = undefined;
}
export async function refreshCost(ta: ActionsCtx): Promise<void> {
  const { PRICEABLE_KINDS, el, host, reachedViaLink } = ta;
  const costable = ta.lastCounts.some((c) => PRICEABLE_KINDS.has(c.kind));
  // The stored cards on THIS device. A link carries none - a card is never a URL
  // param - so possession is always a local fact. `WebToolHost.assets` carries the
  // `_*UserAsset` methods at runtime (same cast the rate-cards manager uses).
  // A user-dropped card wins; with none, a CATALOG-shipped card (the org's
  // distribution rail - brand pack, channel, control-plane provider) is
  // offered. Possession still means "synced to this device", and the
  // confidential/reveal semantics in money-policy hold unchanged.
  const rcHost = host as unknown as Parameters<typeof listRateCards>[0];
  // Give the extracted authoring furniture its door: hydrate the `cost-authoring`
  // slot the moment an extension resolves into it (empty registry → no-op, the
  // container is left untouched and the panel is byte-identical to counts-only).
  // A hydrated extension gets the store + an onChange that reprices. Also re-runs
  // on async bundle delivery via the onExtensionsChanged subscription above. (The
  // context type lives beside this consumer in cost-panel.ts; the furniture is
  // src/ext/cost-authoring.ts, off the default path.)
  tryMountCostSlot(ta);
  const cards = await listRateCards(rcHost).catch(() => []);
  const selected =
    cards[0] ??
    (
      await listCatalogRateCards(
        host as unknown as Parameters<typeof listCatalogRateCards>[0]
      ).catch(() => [])
    )[0];
  // most-recently-added / first catalog card; a full picker is future work

  // Resolve + cost the selected card. The figure is still gated by `costView` →
  // `canShowMoney`, so a link-reached mount never RENDERS one until the reveal flips
  // (proven in cost-panel.test.ts).
  let working: CostWorking | null = null;
  if (selected) {
    const parsed = await resolveCard(ta, selected);
    if (parsed) working = computeCost(parsed, ta.lastCounts, {});
  }
  const money: MoneyContext = {
    hasCard: !!selected,
    selectionFromUrl: reachedViaLink,
    revealedThisSession: ta.costRevealed,
    cardConfidential: selected?.confidential ?? false,
    expired: working?.expired ?? false,
    useExpiredAnyway: ta.costUseExpired,
  };

  applyCostPanel(
    el,
    costView(working, {
      costable,
      money,
      issuerName: selected?.issuerName,
      issued: selected?.issued,
      validUntil: selected?.validUntil,
    })
  );
  wireCostActions(ta);
}
/** Fetch + parse a card's bytes into a `RateCard` - the user-asset store for
 *  a dropped card, the catalog rail for a shipped one. Null on any failure. */
export async function resolveCard(ta: ActionsCtx, entry: { digest: string; catalogUrl?: string }) {
  const { host } = ta;
  let blob: Blob | null = null;
  if (entry.catalogUrl) {
    blob = await fetch(entry.catalogUrl)
      .then((r) => (r.ok ? r.blob() : null))
      .catch(() => null);
  } else {
    const rcHost = host as unknown as Parameters<typeof getRateCardBlob>[0];
    blob = await getRateCardBlob(rcHost, entry.digest).catch(() => null);
  }
  if (!blob) return null;
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const card = parseRateCard(bytes, entry.digest, validateRateCard);
  return isRateCardError(card) ? null : card;
}
/** Attach the reveal / use-expired actions after each cost-body rewrite. The
 *  reveal is device-local memory only - it is never written to the URL, so a shared
 *  link can never carry the revealed state. */
export function wireCostActions(ta: ActionsCtx): void {
  const { el } = ta;
  el!.querySelector<HTMLButtonElement>('[data-cost-reveal]')?.addEventListener('click', () => {
    ta.costRevealed = true;
    void refreshCost(ta);
  });
  el!
    .querySelector<HTMLButtonElement>('[data-cost-use-expired]')
    ?.addEventListener('click', () => {
      ta.costUseExpired = true;
      void refreshCost(ta);
    });
}
export function seedPreflightFacts(ta: ActionsCtx): void {
  const { host } = ta;
  // ── Preflight: "Before you export" ────────────────────────────────────────
  //
  // The shell collects the FACTS from its own platform and the engine applies the
  // RULES - the same split print-marks.ts uses. Everything below reads the LIVE
  // panel (the same readers the export path uses: rawDims/dimUnit/dimDpi, the
  // print card, the CMYK select, cutsValue) so a finding can never be about
  // settings a render would not use. The engine receives a plain object and never
  // touches the DOM.
  //
  // THE GENERIC RULE PATH IS STATIC ONLY. Nothing there renders, rasterises or
  // exports: `preflight()` is pure and synchronous and runs on every input change.
  // Design's mounted audit below is the explicit exception; it is async and is
  // reached only from Export-open / settled-canvas events, never runtime.subscribe.
  //
  // The palette is the one genuinely async fact. It is resolved ONCE, off
  // host.tokens.colors() DIRECTLY - never livePalette, which silently substitutes
  // the neutral starter PALETTE when tokens throw OR answer with nothing, and
  // carries no provenance to tell the two apart. A throw and an empty list both
  // become `{ known:false, why:'not-resolved' }`, so the engine withholds the
  // plate ceiling instead of counting starter swatches as if they were the brand's.
  ta.palette = { known: false, why: 'not-resolved' };
  void (async () => {
    try {
      const colors = await host.tokens?.colors?.();
      if (!Array.isArray(colors) || colors.length === 0) return; // stays 'not-resolved'
      ta.palette = {
        known: true,
        value: colors.map((s) => ({
          path: s.path,
          name: s.name,
          spot: s.spot ?? null,
          cmyk: s.cmyk ?? undefined,
          hex: s.value,
        })),
      };
      ta.preflight.refreshPreflight();
    } catch {
      /* stays 'not-resolved' - never a fabricated empty palette */
    }
  })();
}

export function buildPreflightManifest(ta: ActionsCtx): void {
  const { manifest } = ta;
  const preflightManifest: PreflightManifest = {
    id: manifest.id,
    status: manifest.status,
    render: {
      width: manifest.render.width,
      height: manifest.render.height,
      formats: manifest.render.formats,
      export: manifest.render.export,
      paginate: manifest.render.paginate,
      pages: manifest.render.pages,
      video: { wait: ta.preflight.vidNum('wait'), duration: ta.preflight.vidNum('duration') },
      aspectWarning: manifest.render.aspectWarning,
    },
    inputs: manifest.inputs,
  }; ta.preflightManifest = preflightManifest;

  // Design has renderer-neutral document checks plus mounted browser checks that
  // cannot honestly live in the engine's generic preflight rules. Keep their
  // lifetime tied to the Export surface: opening runs them, canvas paint refreshes
  // them, and closing cancels/clears them. A closed Export panel pays nothing.
  ta.designAuditRows = [];
  ta.designAuditOpen = false;
  ta.designAuditGeneration = 0;
}

export function definePriceableKinds(ta: ActionsCtx): void {
  // The QuantityKinds a rate card can actually price - used to decide whether the job
  // is "costable" at all, so the panel never appears on a plain logo PNG.
  const PRICEABLE_KINDS = new Set<Count['kind']>([
    'processPlates',
    'spotPlates',
    'finishPlates',
    'sheets',
    'area',
    'pages',
    'variantRows',
    'outputFiles',
  ]); ta.PRICEABLE_KINDS = PRICEABLE_KINDS;
}

export function preflightOps(ta: ActionsCtx) {
  return {
    stageFacts: bindOp(ta, stageFacts),
    vidNum: bindOp(ta, vidNum),
    designTone: bindOp(ta, designTone),
    refreshDesignAudit: bindOp(ta, refreshDesignAudit),
    onDesignExportOpen: bindOp(ta, onDesignExportOpen),
    onDesignExportClose: bindOp(ta, onDesignExportClose),
    onDesignCanvasPaint: bindOp(ta, onDesignCanvasPaint),
    refreshPreflight: bindOp(ta, refreshPreflight),
    tryMountCostSlot: bindOp(ta, tryMountCostSlot),
    disposeActions: bindOp(ta, disposeActions),
    refreshCost: bindOp(ta, refreshCost),
    resolveCard: bindOp(ta, resolveCard),
    wireCostActions: bindOp(ta, wireCostActions),
    seedPreflightFacts: bindOp(ta, seedPreflightFacts),
    buildPreflightManifest: bindOp(ta, buildPreflightManifest),
    definePriceableKinds: bindOp(ta, definePriceableKinds),
  };
}
