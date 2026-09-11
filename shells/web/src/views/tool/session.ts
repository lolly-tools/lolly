// SPDX-License-Identifier: MPL-2.0
/**
 * tool view: session dirty state, URL sync, revisions, bulk, framing.
 *
 * Every function takes the shared `tview: ToolViewCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `tview.<module>.<fn>`. Extracted verbatim
 * from mountTool() by scripts/split-closure.ts.
 */
import type { AssetRef, Profile } from '@lolly-tools/core/host-v1';
import { DEFAULT_CMYK_CONDITION, HDR_DEFAULTS, PACK_PARAM, assetIdForUrl, blocksForUrl, encodeTableCompact, isBakedRef, isPackAvailable, isTokenValue, normalizeTableValue, packQuery, serializeHdr, toCssPx } from '@lolly/engine';
import type { InputValue } from '../../../../../engine/src/inputs.js';
import { migrateBlockRowIds, stripHiddenRowIds } from '../../lib/row-id.ts';
import type { UserTemplate, UserTemplateHost } from '../../lib/user-templates.ts';
import type { TemplateActionHost } from '../../lib/template-actions.ts';
import { parseEditorState } from '../../lib/editor-state.ts';
import { attachCanvasEditorApi } from '../../lib/canvas-editor-api.ts';
import { DESIGN_INTENT_OPTIONS, designNarrationEnabled, designOutcome, designTimelineEnabled, inferDesignIntent } from '../design-workspace.ts';
import { backHomeHtml, mountBackPill } from '../../components/back-pill.ts';
import { mountHomeFab } from '../../components/home-fab.ts';
import { t, tRaw } from '../../i18n.ts';
import { announce } from '../../a11y.ts';
import { urlProfileValue } from '../../lib/press-profile-embed.ts';
import { edgeDockCollapsed, isDocked, onDockChange } from '../../lib/edge-dock.ts';
import { AUTO_PACK_MIN, BROWSER_TARGET, costUrlState } from '../../lib/url-budget.ts';
import { makeLollyVehicle } from '../tool-lolly-vehicle.ts';
import type { Unit } from '../../../../../engine/src/units.js';
import { navigateTo } from '../../nav.ts';
import { asRow } from '../tool-types.ts';
import { sessionName } from '../tool-session-name.ts';
import { encodeBlocksCompact } from '../../lib/blocks-url.ts';
import { fmtBytes, openEmbedEditor } from '../tool-inputs.ts';
import { isCmykFmt, isPrintFmt, marksToCsv } from '../tool-actions.ts';
import { collectExportParams, isTextEditing, shareDialogOptions, showShareDialog, showUnsavedDialog, shrinkUrl, wireUpCopyUrl } from './shared.ts';
import type { MotionCaptureOpts } from './shared.ts';
import { bindOp, type ToolViewCtx } from './context.ts';

export const currentDesignOutcome = (tview: ToolViewCtx) =>
  { const { runtime } = tview; return designOutcome(tview.designIntent, runtime.getModel().find((i) => i.id === 'boxes')?.value); };
// The render pill's Save half goes amber (with a one-shot flash) the moment the
// first un-saved edit arrives, and reverts to its resting state on save. We flash
// only on the clean→dirty edge so it's an attention cue, not a strobe; the
// animation is restarted by removing+re-adding the class (a no-op re-add wouldn't
// replay it), so it fires again after each subsequent save→edit cycle.
export function markSessionDirty(tview: ToolViewCtx): void {
  tview.exportedSinceEdit = false; // a fresh edit re-arms the leave guard
  if (tview.userHasMadeChanges) return; // already dirty - keep the resting amber
  tview.userHasMadeChanges = true;
  if (tview.renderSaveBtn) {
    tview.renderSaveBtn.classList.remove('is-unsaved');
    void tview.renderSaveBtn.offsetWidth; // force reflow so the flash animation restarts
    tview.renderSaveBtn.classList.add('is-unsaved');
  }
}
export function markSessionSaved(tview: ToolViewCtx): void {
  tview.userHasMadeChanges = false;
  tview.renderSaveBtn?.classList.remove('is-unsaved');
}
export function syncUrl(tview: ToolViewCtx, dirtyId?: string): void {
  const { TOOL_URL_BASE, actionsEl, barSeq, dirtyParams, runtime, templateSeededIds } = tview;
  if (dirtyId) dirtyParams.add(dirtyId);

  // Ambient URL-budget gauge: the SHARE-link cost of the current edit (reads the cost
  // model, NOT this address bar - different serializations), so it updates even before
  // the first edit of an encrypted link. Pure + synchronous; the packed refine is
  // deferred inside the gauge and never blocks this tick.
  if (tview.urlGauge) {
    const gaugeBase = `${location.origin}${TOOL_URL_BASE}?`;
    tview.urlGauge.update(
      costUrlState(
        { model: runtime.getModel(), exportParts: collectExportParams(actionsEl) },
        { base: gaugeBase, target: BROWSER_TARGET }
      ),
      gaugeBase
    );
  }

  if (runtime.manifest.render.urlSync === false && tview.userHasMadeChanges) {
    const slot = tview.actionsApi?.getSlot?.() ?? tview.slot;
    history.replaceState(history.state, '', TOOL_URL_BASE + (slot ? `?slot=${encodeURIComponent(slot)}` : ''));
    return;
  }

  // A password-protected (`zx`) link stays ENCRYPTED in the address bar until the
  // user actually changes something - otherwise this first auto-sync would rewrite
  // the bar to the cleartext state, so copying it would re-share an UNPROTECTED link
  // and a refresh would skip the password prompt. After the first edit the new state
  // can't be the original token, so we fall through to the normal (cleartext) write.
  if (tview.encLinkQuery && !tview.userHasMadeChanges) {
    history.replaceState(history.state, '', `${TOOL_URL_BASE}?${tview.encLinkQuery}`);
    return;
  }

  const params = new URLSearchParams();

  for (const entry of runtime.getModel()) {
    const { id, type, value } = entry;
    if (!dirtyParams.has(id) && !templateSeededIds.has(id)) continue;
    // The address bar writes each input under its short urlKey alias when it declares one
    // (e.g. design `boxes`→`bx`), same as the share link (encodeModelParam) - so a
    // copy-pasted bar is as small as a copied Share link. Dirty tracking stays keyed by the
    // canonical id; only the written param NAME shortens. parseUrlState reads both forms.
    const key = entry.urlKey ?? id;
    // A picked file is binary, in-memory, device-local content - it has no
    // shareable URL form. Never write it (would otherwise serialise to junk).
    if (type === 'file') continue;
    if (type === 'asset') {
      // Library assets are shareable by ID; user uploads are device-local. A
      // baked ref's frozen bytes can't ride in the bar either: write its
      // provenance (assetIdForUrl → bakedFrom) so a refresh degrades to a live
      // re-render - but one WITHOUT provenance is skipped like a user upload
      // (its dead 'baked/…' id could never re-resolve; a saved session is what
      // restores the exact bytes).
      const ref = value as AssetRef | null;
      if (ref && isBakedRef(ref) && typeof ref.meta?.bakedFrom !== 'string') continue;
      const assetId = ref ? assetIdForUrl(ref) : undefined;
      if (assetId && !assetId.startsWith('user/')) params.set(key, assetId);
      continue;
    }
    if (type === 'blocks') {
      if (Array.isArray(value) && value.length > 0) {
        // Compact form first (the share dialog's encoder, in its address-bar variant that
        // keeps device-local user/ ids) - a 20-layer import is ~10× smaller than the JSON
        // form, and it now carries separator-bearing values too (URLSearchParams.set applies
        // the outer url-encode layer that keeps in-value %2C/%7E escapes intact - see
        // blocks-url.ts), so JSON is the fallback only for field-less blocks; blocksForUrl
        // collapses baked sub-field refs to their provenance URL first (the data: bytes would
        // blow the bar). The JSON form copies every key, so the hidden row id comes off first -
        // it is this device's bookkeeping, not a value. No length guard: a blocks value IS the
        // content (a design's boxes), so - like a table - it rides the bar and the auto-pack
        // tail below compresses it, rather than being silently dropped from a shared link.
        const compact = encodeBlocksCompact(value, entry.fields ?? [], { keepUserIds: true });
        const encoded = compact ?? JSON.stringify(blocksForUrl(stripHiddenRowIds(value)));
        params.set(key, encoded);
      }
      continue;
    }
    if (type === 'vector') {
      // One flat param per field: "<inputId>.<fieldId>" (e.g. transform.zoom=200).
      if (value && typeof value === 'object') {
        const vv = asRow(value);
        for (const f of entry.fields ?? []) {
          if (vv[f.id] !== undefined && vv[f.id] !== null)
            params.set(`${key}.${f.id}`, String(vv[f.id]));
        }
      }
      continue;
    }
    if (type === 'table') {
      // A table IS the tool's content - it belongs in the URL, not as the
      // "[object Object]" the scalar path below would stamp. It round-trips
      // through the engine's compact form (encode here / decodeTableCompact on
      // load), and rides under the input's short urlKey (e.g. battlecards `t`),
      // which parseUrlState reads alongside the id. Deliberately bypasses the
      // 150-char scalar cap below: a table is meant to FILL the link, and once
      // the query passes AUTO_PACK_MIN the auto-pack tail of this function
      // compresses the bar to the `z=` form. An empty grid writes nothing, so a
      // blank tool keeps a bare URL. URLSearchParams applies its own encode layer.
      const tbl = normalizeTableValue(value);
      if (tbl && (tbl.columns.length || tbl.rows.length))
        params.set(key, encodeTableCompact(tbl));
      continue;
    }
    if (value == null || value === '') continue;
    if (typeof value === 'boolean' && !value) continue;
    // A token-backed colour ({ ref, value }) serialises to its canonical token ref
    // (mirrors the engine's coerceToString) - never String()'d into the URL as
    // "[object Object]", which would then ride into a lolly-URL embed of this tool.
    const str = type === 'color' && isTokenValue(value) ? value.ref : String(value);
    // A `longtext` is CONTENT (d3 data, design customCss, code) and rides uncapped like a
    // table - it must NOT be dropped from the bar, or a shared chart link would open blank. The
    // 150-char cap stays only for short single-line scalars (a stray-long label is bloat).
    if (type !== 'longtext' && str.length > 150) continue;
    params.set(key, str);
  }

  if (dirtyParams.has('w')) {
    // As typed, not truncated: `8.5in` must survive a share link (plans/184 R12).
    const w = parseFloat(
      actionsEl?.querySelector<HTMLInputElement>('[data-action="export-width"]')?.value ?? ''
    );
    if (w > 0) params.set('w', String(w));
  }
  if (dirtyParams.has('h')) {
    const h = parseFloat(
      actionsEl?.querySelector<HTMLInputElement>('[data-action="export-height"]')?.value ?? ''
    );
    if (h > 0) params.set('h', String(h));
  }
  if (dirtyParams.has('unit')) {
    const u = actionsEl?.querySelector<HTMLSelectElement>('[data-action="export-unit"]')?.value;
    if (u && u !== 'px') params.set('unit', u);
  }
  if (dirtyParams.has('dpi')) {
    const d = parseInt(
      actionsEl?.querySelector<HTMLInputElement>('[data-action="export-dpi"]')?.value ?? '',
      10
    );
    const u = actionsEl?.querySelector<HTMLSelectElement>('[data-action="export-unit"]')?.value;
    if (d > 0 && u && u !== 'px') params.set('dpi', String(d));
  }
  if (dirtyParams.has('format')) {
    const fmt = actionsEl?.querySelector<HTMLSelectElement>('[data-action="format"]')?.value;
    if (fmt) params.set('format', fmt);
  }
  if (dirtyParams.has('filename')) {
    const filename = actionsEl
      ?.querySelector<HTMLInputElement>('[data-action="filename"]')
      ?.value?.trim();
    if (filename) params.set('filename', filename);
  }
  if (dirtyParams.has('profile')) {
    // Meaningful for the CMYK print formats (Print PDF / Print TIFF); share it only
    // when one is selected and it isn't the default condition (keeps links clean).
    const fmt = actionsEl?.querySelector<HTMLSelectElement>('[data-action="format"]')?.value;
    // `own:<digest>` is device-local - urlProfileValue flattens it to bare `own`.
    const prof = urlProfileValue(
      actionsEl?.querySelector<HTMLSelectElement>('[data-action="cmyk-profile"]')?.value
    );
    if (isCmykFmt(fmt) && prof && prof !== DEFAULT_CMYK_CONDITION) params.set('profile', prof);
  }
  if (dirtyParams.has('password')) {
    // Open-password for the standard-tier lock only (PDF 40-bit RC4 or the ZIP
    // ZipCrypto bundle); carried clear-text by design (a basic lock for short-lived
    // transactional material). Empty value → omitted.
    const fmt = actionsEl?.querySelector<HTMLSelectElement>('[data-action="format"]')?.value;
    const pw = actionsEl?.querySelector<HTMLInputElement>('[data-action="pdf-password"]')?.value;
    const strong =
      actionsEl?.querySelector<HTMLSelectElement>('[data-action="pdf-lock-tier"]')?.value ===
      'strong';
    // Only the standard lock rides in the URL. The strong (AES-256) tier is never
    // serialized - its password is typed at export/open only.
    if ((fmt === 'pdf' || fmt === 'zip') && pw && !strong) params.set('password', pw);
  }
  if (dirtyParams.has('bleed') || dirtyParams.has('marks')) {
    // Print marks & bleed - print formats (pdf / pdf-cmyk / cmyk-tiff) only, and
    // only when the card is on.
    const fmt = actionsEl?.querySelector<HTMLSelectElement>('[data-action="format"]')?.value;
    const on = actionsEl?.querySelector<HTMLInputElement>(
      '[data-action="print-enable"]'
    )?.checked;
    if (isPrintFmt(fmt) && on) {
      const mm = parseFloat(
        actionsEl?.querySelector<HTMLInputElement>('[data-action="print-bleed"]')?.value ?? ''
      );
      if (mm > 0) params.set('bleed', `${mm}mm`);
      const csv = marksToCsv({
        crop: actionsEl?.querySelector<HTMLInputElement>('[data-action="mark-crop"]')?.checked,
        registration: actionsEl?.querySelector<HTMLInputElement>('[data-action="mark-reg"]')
          ?.checked,
        bleed: actionsEl?.querySelector<HTMLInputElement>('[data-action="mark-bleed"]')?.checked,
        colorBars: actionsEl?.querySelector<HTMLInputElement>('[data-action="mark-bars"]')
          ?.checked,
        provenance: actionsEl?.querySelector<HTMLInputElement>('[data-action="mark-prov"]')
          ?.checked,
      });
      if (csv) params.set('marks', csv);
    }
  }
  if (dirtyParams.has('nostage')) {
    // Full-page HTML export - a presence flag, written only while HTML is the
    // selected format and the toggle is on (so it drops off other formats).
    const fmt = actionsEl?.querySelector<HTMLSelectElement>('[data-action="format"]')?.value;
    const on = actionsEl?.querySelector<HTMLInputElement>('[data-action="full-page"]')?.checked;
    if (fmt === 'html' && on) params.set('nostage', '');
  }
  if (dirtyParams.has('imprint')) {
    // Pixel watermark - on by default like c2pa (see url-mode serializeUrlState):
    // unchecking the popup toggle writes the explicit `imprint=0` opt-out;
    // checking it back on returns to the default, so the param drops out.
    const on = actionsEl?.querySelector<HTMLInputElement>('[data-action="imprint"]')?.checked;
    if (on) params.delete('imprint');
    else params.set('imprint', '0');
  }
  if (dirtyParams.has('durable')) {
    // Durable credential - OFF by default (opt-in, performance cost): checking
    // writes durable=1; unchecking drops the param so a plain link stays clean.
    const on = actionsEl?.querySelector<HTMLInputElement>('[data-action="durable"]')?.checked;
    if (on) params.set('durable', '1');
    else params.delete('durable');
  }
  if (dirtyParams.has('hdr')) {
    // HDR - OFF by default (opt-in): checking writes hdr=1 (or the compact tuned
    // form when a slider is off-default); unchecking drops it. serializeHdr emits
    // `1` when all dials are default so a plain link stays clean.
    const on = actionsEl?.querySelector<HTMLInputElement>('[data-action="hdr"]')?.checked;
    if (on) {
      const dial = (a: string, d: number) => {
      const actionsEl = tview.actionsEl as NonNullable<ToolViewCtx['actionsEl']>;
        const v = Number(
          actionsEl?.querySelector<HTMLInputElement>(`[data-action="${a}"]`)?.value
        );
        return Number.isFinite(v) ? v : d;
      };
      params.set(
        'hdr',
        serializeHdr({
          peakNits: dial('hdr-peak', HDR_DEFAULTS.peakNits),
          reach: dial('hdr-reach', HDR_DEFAULTS.reach),
          lift: dial('hdr-lift', HDR_DEFAULTS.lift),
          richness: dial('hdr-focus', HDR_DEFAULTS.richness),
        })
      );
    } else params.delete('hdr');
  }

  const qs = params.toString();
  // Bump the shared guard on EVERY write (not just when we pack) so a later,
  // possibly sub-threshold, syncUrl invalidates any pack still in flight from an
  // earlier large state - otherwise that stale pack could resolve afterward and
  // overwrite this bar with the old state.
  const seq = ++barSeq.v;
  history.replaceState(history.state, '', qs ? `${TOOL_URL_BASE}?${qs}` : TOOL_URL_BASE);

  // Auto-switch to the packed form once the readable query gets long enough to
  // risk the ~2000-char URL ceiling. The readable write above already arrived, so
  // simple links stay readable/editable and only large states get compressed -
  // and only if packing is available AND genuinely shorter. Async + seq-guarded so
  // a slow pack from an older keystroke can never clobber a newer bar.
  if (qs.length >= AUTO_PACK_MIN && isPackAvailable()) {
    packQuery(qs)
      .then((token) => {
      const { TOOL_URL_BASE, barSeq } = tview;
        if (token == null || seq !== barSeq.v) return; // unavailable, or superseded
        const packed = `${PACK_PARAM}=${token}`;
        if (packed.length >= qs.length) return; // packing didn't help - keep readable
        history.replaceState(history.state, '', `${TOOL_URL_BASE}?${packed}`);
      })
      .catch(() => {
        /* keep the readable URL already written */
      });
  }
}
export function markUserDirty(tview: ToolViewCtx, id?: string): void {
  const { dirtyParams } = tview;
  markSessionDirty(tview); // sets userHasMadeChanges + flashes the Save pill on the first edit
  // Just record the param as dirty - the coalesced render's syncUrl() (folded
  // into the rAF below) writes the URL for every dirty param, so calling it here
  // too would replaceState twice per keystroke for no benefit.
  if (id) dirtyParams.add(id);
}
export const openRevisions = (tview: ToolViewCtx) => { const { revisionPanel } = tview; return revisionPanel.open(); };
// "Bulk from rows" - hand this template to /batch, where a sheet of rows renders the
// whole set in one run. Deliberately NOT an export option (like Make variants, it is a
// step BEFORE export). The batch starts from rows, so the current design does not
// travel with it, which is why an edited-but-unsaved session gets the same offer to
// save that the back pill makes before it leaves. Two homes, one action: this header
// button for the sidebar layouts, the Lolly menu item for the chromeless editors.
export const openBulk = (tview: ToolViewCtx): void => {
  const { actionsApi, actionsEl, hasInputs, toolId } = tview;
  const go = (): void => navigateTo(`#/batch?tool=${encodeURIComponent(toolId)}`);
  if (!hasInputs || !tview.userHasMadeChanges || tview.exportedSinceEdit) {
    go();
    return;
  }
  const canSave = !!actionsEl?.querySelector('[data-action="save"]') && !!actionsApi?.save;
  showUnsavedDialog(
    canSave
      ? async () => {
      const actionsApi = tview.actionsApi as NonNullable<ToolViewCtx['actionsApi']>;
          if (await actionsApi!.save!()) go();
        }
      : null,
    go
  );
};
// Wire the back pill(s) - the full-screen one and/or the sidebar one. When the
// tool has inputs and they've been touched, take the click over and offer the save
// dialog first. Saving returns to the launch folder or defaults to Projects, where
// the saved session lives; leaving without saving follows the pill's destination.
/**
 * The unsaved-work gate every Home/Back pill in this view shares. A `function`
 * declaration, so it hoists over the whole mount: the Design top bar's pill is wired
 * from inside a dynamic import's callback, which may run either side of the call below.
 * Returns true when it has taken the click (a dialog is up), false to let the pill go.
 */
export function backPillIntercept(tview: ToolViewCtx, go: () => void): boolean {
  const { actionsApi, actionsEl, hasInputs, runtime } = tview;
  if (!hasInputs || !tview.userHasMadeChanges || tview.exportedSinceEdit) return false;
  // Offer "Save & leave" only when the tool actually has a save action.
  const canSave = !!actionsEl?.querySelector('[data-action="save"]') && !!actionsApi?.save;
  // If the session carries heavy embedded bytes (a recorded clip stamps meta.bytes),
  // tell the user how big the save is - the recording is what makes a Record session
  // large, and it's stored on-device.
  const heavy = runtime
    .getModel()
    .map((i) => (i.value as { meta?: { bytes?: number } } | undefined)?.meta?.bytes)
    .find((b): b is number => typeof b === 'number' && b > 0);
  const detail = heavy
    ? t('Includes a {size} video clip, stored on this device.', { size: fmtBytes(heavy) })
    : undefined;
  showUnsavedDialog(
    canSave
      ? async () => {
      const actionsApi = tview.actionsApi as NonNullable<ToolViewCtx['actionsApi']>;
          if (await actionsApi!.save!()) navigateTo(tview.fromFolder ? tview.returnTo : '/#/p');
        }
      : null,
    () => {
      go();
    },
    detail
  );
  return true;
}
/**
 * "Use as a new image" (plans/148 WP-E): bake a framing into new bytes, save
 * them to the user's library as a child of the source, then point the input at
 * the child and reset the framing.
 *
 * Every piece here already existed and is reused rather than reproduced: the
 * placement maths is the engine's (so the baked pixels match the preview), the
 * signing is lib/derived-asset.ts's - the catalog crop's own path, source as a
 * C2PA ingredient with the genAI backfill intact - and the two setInput calls
 * ride the tool view's undo coalescing, so the whole thing is ONE undo step.
 *
 * `key` is the overlay's marker: a top-level framing input id, or
 * "<blocksId>:<index>:<base>" for a row.
 */
export async function bakeFraming(tview: ToolViewCtx, key: string): Promise<void> {
  const { canvasEl, runtime } = tview;
  const blockRef = /^(.+):(\d+):(.+)$/.exec(key);
  const el = canvasEl?.querySelector<HTMLElement>(`[data-framing="${CSS.escape(key)}"]`);
  if (!el) return;
  const frameW = el.offsetWidth,
    frameH = el.offsetHeight;

  // Read the framing values, the fit, and the asset slot to replace - the same
  // two shapes the overlay resolves, kept here rather than exported from it
  // because this side also needs to WRITE the asset back.
  const model = runtime.getModel();
  const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
  let framing: Record<string, number> = {};
  let fit: 'cover' | 'contain' = 'cover';
  let ref: AssetRef | null = null;
  let apply: (next: AssetRef) => Promise<void>;

  if (!blockRef) {
    const input = model.find((i) => i.id === key);
    const assetId = (input as { framingFor?: string } | undefined)?.framingFor;
    const assetInput = assetId ? model.find((i) => i.id === assetId) : undefined;
    ref = (assetInput?.value ?? null) as AssetRef | null;
    if (!input || !ref?.url) return;
    framing = { ...(input.value as Record<string, number>) };
    fit =
      String(model.find((i) => i.id === key.replace(/Framing$/, '') + 'Fit')?.value) === 'contain'
        ? 'contain'
        : 'cover';
    const defaults: Record<string, number> = {};
    for (const f of input.fields ?? []) defaults[f.id] = f.default ?? 0;
    apply = async (next) => {
    const { runtime } = tview;
      await runtime.setInput(assetId!, next as unknown as InputValue);
      await runtime.setInput(key, defaults as unknown as InputValue);
    };
  } else {
    const [, blocksId, idxStr, base] = blockRef as unknown as [string, string, string, string];
    const input = model.find((i) => i.id === blocksId);
    const index = Number(idxStr);
    const rows = Array.isArray(input?.value)
      ? (input!.value as Array<Record<string, unknown>>)
      : [];
    const row = rows[index];
    if (!input || !row) return;
    const assetField = (
      (input.fields ?? []) as Array<{ id: string; type?: string; framingFor?: string }>
    ).find((f) => f.framingFor === base || (f.type === 'asset' && f.id === base));
    ref = (assetField ? row[assetField.id] : null) as AssetRef | null;
    if (!ref?.url) return;
    for (const f of ['zoom', 'x', 'y', 'rotate', 'pitch', 'yaw']) {
      const v = Number(row[`${base}${cap(f)}`]);
      if (Number.isFinite(v)) framing[f] = v;
    }
    fit = String(row[`${base}Fit`]) === 'contain' ? 'contain' : 'cover';
    apply = async (next) => {
    const { runtime } = tview;
      const live = runtime.getModel().find((i) => i.id === blocksId);
      const out = Array.isArray(live?.value) ? [...(live!.value as unknown[])] : [];
      const cur = out[index];
      if (!cur || typeof cur !== 'object') return;
      const merged: Record<string, unknown> = { ...(cur as Record<string, unknown>) };
      if (assetField) merged[assetField.id] = next;
      for (const f of ['zoom', 'x', 'y', 'rotate', 'pitch', 'yaw']) {
        const spec = ((input.fields ?? []) as Array<{ id: string; default?: number }>).find(
          (s) => s.id === `${base}${cap(f)}`
        );
        if (spec)
          merged[spec.id] =
            spec.default ?? (f === 'zoom' ? 100 : f === 'x' || f === 'y' ? 50 : 0);
      }
      out[index] = merged;
      await runtime.setInput(blocksId, out as unknown as InputValue);
    };
  }

  try {
    const { bakeFraming: bake } = await import('../../lib/framing-bake.ts');
    const baked = await bake(tview.host as never, ref.url, framing, fit, frameW, frameH, ref.format);
    if (!baked) {
      announce(t('This image can’t be baked here.'), { assertive: true });
      return;
    }
    const { saveDerivedAsset, derivedName } = await import('../../lib/derived-asset.ts');
    // The honest edit history for THIS derivation: a crop (the framing's own
    // window) plus an orientation change whenever it rolled or tilted.
    const tilted = Number(framing.rotate) || Number(framing.pitch) || Number(framing.yaw);
    const saved = await saveDerivedAsset(
      tview.host as never,
      ref,
      baked.blob,
      baked.format,
      'frame',
      {
        edits: [
          { action: 'c2pa.cropped' },
          ...(tilted ? [{ action: 'c2pa.orientation' }] : []),
          { action: 'c2pa.resized' },
        ],
        detail: Object.fromEntries(
          Object.entries(framing).map(([k, v]) => [`framing.${k}`, String(v)])
        ),
        dims: `${baked.width}x${baked.height}`,
      },
      derivedName(ref, t('framed'))
    );
    if (!saved) {
      announce(t('This image can’t be saved to your library here.'), { assertive: true });
      return;
    }
    await apply(saved);
    markUserDirty(tview, key);
    markSessionDirty(tview);
    announce(
      tRaw('Saved as "{name}" in your uploads.', { name: String(saved.meta?.name ?? saved.id) })
    );
  } catch (e) {
    tview.host.log?.('warn', 'framing bake failed', { key, error: String(e) });
    announce(t('That image couldn’t be saved. The framing is unchanged.'), { assertive: true });
  }
}
/** Live editing: the runtime subscriptions, the canvas edit tools and the collab wiring. */
export async function wireLiveEditing(tview: ToolViewCtx): Promise<void> {
  if (tview.runtime.getHydrated().includes('data-text-workspace') && tview.contentEl?.parentElement) {
    const { mountTextWorkspace } = await import('../text.ts');
    if (tview.mountLifecycle.disposed) return;
    const content = tview.contentEl;
    content.style.display = 'none';
    const cleanup = await mountTextWorkspace({ container: content.parentElement!, runtime: tview.runtime, host: tview.host, onDirty: tview.session.markUserDirty, history: tview.actionsApi?.history, historyEnabled: !tview.ephemeralState && !tview.collabHandle, slot: tview.slot, historyBase: tview.openedSession.cursor, flushState: async () => { tview.actionsApi?.history?.changed(); await tview.actionsApi?.history?.flush(); } });
    tview.mountLifecycle.add('text-workspace', () => { cleanup(); content.style.removeProperty('display'); });
  }

  const { TOOL_URL_BASE, actionsApi, actionsEl, backPillOpts, barSeq, brandVarsReady, canBulk, canSaveSession, canvasEditInput, canvasEl, collabHandle, contentEl, deckEditInput, deckLayout, docEditInput, documentLayout, editorLayout, fixedCanvasMode, frameCfg, hasTemplates, isPresent, mountLifecycle, nativeH, nativeW, outerEl, pagesCfg, pagesMode, presentAddress, profileToggle, renderFab, runtime, slot, soundToggle, stageEl, templateMeta, templateParam, templateSeededIds, themeToggle, toolId, transcribeSpec, urlFlags, urlHeight, urlWidth, viewEl } = tview;
  (
    globalThis as {
      __lollyCaptureMotion?: (fmt?: string, opts?: MotionCaptureOpts) => Promise<string | null>;
    }
  ).__lollyCaptureMotion = async (fmt = 'apng', opts = {}) => {
    try {
      const nw = opts.width ?? tview.tool.manifest.render.width ?? 600;
      const nh = opts.height ?? tview.tool.manifest.render.height ?? 600;
      // wait/duration/fps/repeat are the de-facto motion-timing opts the engine passes
      // through untouched (not in RuntimeExportOpts, like render-export.ts's exportOpts) -
      // build a typed local so the excess-property check doesn't trip at the call site.
      const exportOpts: {
        width: number;
        height: number;
        embedMeta: boolean;
        watermark: boolean;
        thumbnail: boolean;
        duration?: number;
        wait?: number;
        repeat?: number;
        fps?: number;
      } = { width: nw, height: nh, embedMeta: false, watermark: false, thumbnail: true };
      if (opts.duration !== undefined) exportOpts.duration = opts.duration;
      if (opts.wait !== undefined) exportOpts.wait = opts.wait;
      if (opts.repeat !== undefined) exportOpts.repeat = opts.repeat;
      if (opts.fps !== undefined) exportOpts.fps = opts.fps;
      const blob = await tview.exporting.exportUnscaled(() => runtime.export(contentEl, fmt, exportOpts), {
        shutter: false,
      });
      return await new Promise<string | null>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  };

  // Copy-URL now lives in the actions bar (renderActions), alongside the export
  // buttons - its format/filename/dimension inputs are in the same element. The Share
  // dialog also offers a `.lolly` download (plans/114) when the tool has a session.
  if (actionsEl) {
    const lolly = makeLollyVehicle(
      tview.host,
      toolId,
      tview.tool.manifest,
      actionsApi?.sessionState,
      contentEl
    );
    wireUpCopyUrl(actionsEl, runtime, actionsEl, tview.tool.manifest, lolly);
    const { mountExportShare } = await import('../export-share.ts');
    mountLifecycle.add('export share controls', mountExportShare(actionsEl, () =>
      shareDialogOptions(runtime, actionsEl, tview.tool.manifest, lolly)));
  }

  // ── Templates, the person's own (plans/226 WP-1) ────────────────────────────────────
  // Three surfaces read the same per-tool list - the Save as… dialog's "Update ‹name›"
  // targets, the sidebar header's Templates button, and the mid-session chooser - so it
  // is resolved ONCE here (the profile record is already cached by the mount) and
  // refreshed after each change rather than re-read three times.
  //
  // One cast serves every profile-WRITING store below: HostV1's ProfileAPI is read-only
  // by contract, and the web host is the one that also has `set`.
  const profileHost = tview.host as unknown as UserTemplateHost & TemplateActionHost;
  const templatesBtn = viewEl.querySelector<HTMLButtonElement>('#templates-btn');
  let myTemplates: UserTemplate[] = [];
  const refreshMyTemplates = async (): Promise<UserTemplate[]> => {
    try {
      const { createUserTemplateStore } = await import('../../lib/user-templates.ts');
      myTemplates = await createUserTemplateStore(profileHost).list(toolId);
    } catch {
      /* user templates are best-effort - the tool still opens, just without them */
    }
    // The header button is rendered hidden for a tool with no built-in templates; a
    // template of the person's own is the other reason for it to exist.
    if (templatesBtn) templatesBtn.hidden = !(hasTemplates || myTemplates.length > 0);
    return myTemplates;
  };
  await refreshMyTemplates();
  /** Open the "Save as…" dialog, optionally on its template card. Assigned below when
   *  this tool can save at all; the Design Lolly menu's rows spend it through the ports. */
  let openSaveAs: ((focus?: 'project' | 'template') => Promise<void>) | null = null;

  // The render pill's Save half: an in-place quick-save. It reuses the exact same
  // export-aware save routine as the popup's Save button (performSave), but unlike
  // that button it does NOT navigate away - it's a checkpoint affordance. performSave
  // leaves the button disabled with a "Saved" label for its own navigate-away caller,
  // so we restore it here and clear the unsaved cue, briefly holding "Saved" as
  // confirmation before reverting to "Save".
  if (tview.renderSaveBtn && actionsApi?.save) {
    const saveLabel = tview.renderSaveBtn.querySelector<HTMLElement>('[data-save-label]');
    // The button's "Saved" confirmation + amber-cue clear, factored out so the Save dialog's
    // save-to-library path lights the button up exactly like the old in-place quick-save did.
    const flashSaved = (): void => {
      delete tview.renderSaveBtn!.dataset.saving;
      tview.renderSaveBtn!.disabled = false;
      tview.session.markSessionSaved(); // drop the amber unsaved cue
      tview.renderSaveBtn!.classList.add('is-just-saved');
      setTimeout(() => {
        // Back to the door's own name, not "Save" - this half opens the Save as… dialog
        // (plans/226 D12), and the label is what tells the two saves apart.
        if (saveLabel) saveLabel.textContent = t('Save as');
        tview.renderSaveBtn!.classList.remove('is-just-saved');
      }, 1500);
    };
    // Save opens the "Save as…" dialog (plan 114, plans/226 D12): file into a PROJECT, or
    // save the doc as a reusable TEMPLATE for this tool. The export sheet's own Save stays
    // a silent quick save and never comes through here. Everything the dialog does is
    // injected here, where host / runtime / stores / the Share vehicle are all in scope.
    openSaveAs = async (focus?: 'project' | 'template'): Promise<void> => {
      if (tview.renderSaveBtn!.dataset.saving) return; // mid-save
      if (document.querySelector('dialog.save-dialog')) return; // already open
      const [
        { openSaveDialog },
        { createFolderStore },
        { canSaveTemplate, createUserTemplateStore },
        { createUserToolStore },
        { setStartWith, startWith: readStartWith, templateDesignSystemStamp },
        { parseTemplateRef, userTemplateRef },
        { templateValuesFromSnapshot },
      ] = await Promise.all([
        import('../../lib/save-dialog.ts'),
        import('../../folders.ts'),
        import('../../lib/user-templates.ts'),
        import('../../lib/user-tools.ts'),
        import('../../lib/template-actions.ts'),
        import('../../lib/template-ref.ts'),
        import('../tool-session-snapshot.ts'),
      ]);
      const folderStore = createFolderStore(
        tview.host as unknown as Parameters<typeof createFolderStore>[0]
      );
      const tplStore = createUserTemplateStore(profileHost);
      const userToolStore = createUserToolStore(
        tview.host as unknown as Parameters<typeof createUserToolStore>[0]
      );
      // "Create a tool" turns a saved Design doc into the user's own listed tool - shown only
      // for a tool that can BE a user tool's base (Design today). See lib/user-tools.ts.
      const canCreateTool = toolId === 'design';
      const plainValues = (): Record<string, unknown> =>
        Object.fromEntries(runtime.getModel().map((i) => [i.id, i.value]));
      // What a TEMPLATE keeps: the same session snapshot the save-to-library path writes,
      // minus the per-document identity and every `file` input (tool-session-snapshot.ts).
      // The export markers ride along, so a template opens at the size/format it was saved
      // at. The runtime model is the fallback for a tool with no export panel.
      const snapshot = (): Record<string, unknown> => actionsApi?.sessionState?.() ?? plainValues();
      const templateValues = (): Record<string, unknown> =>
        templateValuesFromSnapshot(snapshot(), tview.tool.manifest);
      const templateToast = (message: string): void => {
        void import('../../lib/sfx.ts').then(({ playSfx }) => playSfx('save'));
        void import('../../lib/undo-toast.ts').then(({ showUndoToast }) =>
          showUndoToast({
            message,
            actionLabel: t('Manage'),
            undo: () => navigateTo(`#/p/__templates__?tool=${encodeURIComponent(toolId)}`),
            duration: 6000,
          })
        );
      };
      const mine = await refreshMyTemplates();
      // The user template this tool currently starts new documents with, so the card's
      // checkbox tells the truth for the template being updated (plans/226 4.4).
      let startWithId: string | null = null;
      try {
        const parsed = parseTemplateRef(await readStartWith(profileHost, toolId));
        if (parsed?.kind === 'user') startWithId = parsed.id;
      } catch {
        /* "Start with" is best-effort - the checkbox just opens unticked */
      }
      // The project this session is already filed in, so the dialog's picker can
      // tell the truth on a re-save (plans/142 W1). Best-effort: an unfiled or
      // never-saved session resolves null and the picker falls back to the
      // last-picked project. (No async-IIFE shape here - the template-chooser
      // guard bans `await (async` across this file.)
      let currentFolderId: string | null = null;
      try {
        const slot = actionsApi?.getSlot?.();
        if (slot) currentFolderId = folderStore.folderOfRef(await folderStore.list(), slot);
      } catch {
        currentFolderId = null;
      }
      const label = String(snapshot().__label ?? '').trim();
      openSaveDialog({
        toolName: tview.tool.manifest.name,
        // Every tool with something to seed offers the card - the old gate was "this tool
        // ships templates", which is why ~50 tools could never make a first one.
        canSaveTemplate: canSaveTemplate(tview.tool.manifest.inputs),
        templateName: label || tRaw('{tool} template', { tool: tview.tool.manifest.name }),
        existingTemplates: mine.map((x) => ({ id: x.id, name: x.name })),
        startWithId,
        ...(focus ? { focus } : {}),
        currentFolderId,
        listFolders: () =>
          folderStore.list().then((fs) => fs.map((f) => ({ id: f.id, name: f.name }))),
        createFolder: (name) => folderStore.create(name).then((f) => ({ id: f.id, name: f.name })),
        saveToLibrary: async (folderId) => {
          const ok = await actionsApi!.save!(tview.renderSaveBtn, { folderId });
          if (ok) flashSaved();
          return ok;
        },
        saveTemplate: async ({ name, description, startWith }) => {
          const saved = await tplStore.save({
            toolId,
            name,
            description,
            values: templateValues(),
            designSystem: await templateDesignSystemStamp(tview.host),
          });
          if (startWith) await setStartWith(profileHost, toolId, userTemplateRef(saved.id));
          await refreshMyTemplates();
          templateToast(t('Saved as a template'));
        },
        updateTemplate: async (id, { description, startWith }) => {
          await tplStore.replace(id, templateValues());
          if (description) await tplStore.describe(id, description);
          if (startWith) await setStartWith(profileHost, toolId, userTemplateRef(id));
          // Un-ticking the box on the template this tool DOES start with is a real
          // "stop starting with this"; on another template it is simply left alone.
          else if (startWithId === id) await setStartWith(profileHost, toolId, null);
          await refreshMyTemplates();
          templateToast(t('Template updated'));
        },
        canCreateTool,
        toolFormats: tview.tool.manifest.render?.formats,
        createTool: async ({ title, description, icon, formats }) => {
          await userToolStore.save({
            title,
            description,
            icon,
            formats,
            baseToolId: toolId,
            values: plainValues(),
          });
        },
        shareLolly: () => {
          const lolly = makeLollyVehicle(
            tview.host,
            toolId,
            tview.tool.manifest,
            actionsApi?.sessionState,
            contentEl
          );
          showShareDialog(runtime, actionsEl, tview.tool.manifest, lolly);
        },
        announce: (m) => announce(m),
        // tRaw, not t: every string the dialog renders is escape()d at its own sink, so a
        // param escaped here would reach the user as `O&#39;Brien`.
        t: tRaw,
      });
    };
    // Exposed for the export panel's Save as, which opens this same dialog - one label,
    // one meaning - rather than arming a file dialog for the next download.
    tview.openSaveAs = openSaveAs;
    tview.renderSaveBtn.addEventListener('click', () => {
      void openSaveAs!();
    });
  }

  // New from template (plans/142 WP-1, universal since plans/226 WP-1): re-open the Start
  // chooser mid-session. Unlike the fresh-open seed (applyPatch, deliberately outside the
  // history), a mid-session pick REPLACES live content, so it applies through the
  // history-wrapped setInput - one ⌘Z restores the doc, exactly like the import panel's
  // commit. Blank/Escape/close resolve `{}` and apply nothing. Two doors reach it: the
  // Design Lolly menu's row (through the ports below) and the sidebar header's Templates
  // button - one implementation, so a template opens the same way in every layout. The
  // Design-only steps at the end are no-ops elsewhere (setDesignIntent returns early off
  // Design, refreshDesignExperience/poseTemplate are armed only with that chrome).
  let templateChooserBusy = false;
  const openTemplatesMidSession = async (): Promise<void> => {
    if (templateChooserBusy) return;
    templateChooserBusy = true;
    try {
      const [
        { openTemplateChooser, templateEditorPose },
        { shippedVariants, userVariants },
        { defaultHiddenTemplateRefs },
        { templateValuesFromSnapshot },
      ] = await Promise.all([
        import('../template-chooser.ts'),
        import('../../lib/template-ref.ts'),
        import('../../catalog/sync.ts'),
        import('../tool-session-snapshot.ts'),
      ]);
      // Both halves carry their ref + own flag, which is what turns each tile into a
      // managed one (hide / start with / rename / delete - plans/226 WP-3).
      const templates = [
        ...shippedVariants(toolId, templateMeta),
        ...userVariants(await refreshMyTemplates(), t('Yours')),
      ];
      if (!templates.length) return;
      // Held in a local first: the mount-gate contract test (tool-template-mount.
      // test.ts) forbids the literal `await openTemplateChooser(` file-wide, so the
      // fresh-open path can never regress into gating createRuntime on a click.
      // This callback runs long after mount, where waiting on the pick is the point.
      const pick = openTemplateChooser({
        toolName: tview.tool.manifest.name,
        title: t('New from template'),
        toolId,
        templates,
        host: tview.host,
        formats: tview.tool.manifest.render?.formats,
        hiddenDefaults: defaultHiddenTemplateRefs(),
        // Mid-session, so "Update from this document" on one of the person's own
        // templates has a document to take - the same snapshot a template save keeps.
        currentValues: () =>
          templateValuesFromSnapshot(
            actionsApi?.sessionState?.() ?? Object.fromEntries(runtime.getModel().map((i) => [i.id, i.value])),
            tview.tool.manifest
          ),
        onChanged: () => { void refreshMyTemplates(); },
        onPick: ({ templateId, category }) =>
          tview.history.setDesignIntent(inferDesignIntent({ templateId, templateCategory: category }), true),
        // Same navigate-away teardown as the fresh-open chooser: _cleanup calls
        // templatePickClose so the modal never outlives the view.
        onOpen: (close) => { if (tview.templatePickTornDown) close(); else tview.templatePickClose = close; },
      });
      const chosen = await pick;
      tview.templatePose = templateEditorPose(chosen);
      if (tview.templatePickTornDown || !viewEl.isConnected) return;
      // A template the person saved carries the `__export_*` markers of the document it
      // was made from (plans/226 C5); those are the export sheet's, not the model's, and
      // mid-session the sheet already holds this document's own. Seed the declared inputs
      // and leave the rest - setInput would be a no-op per key anyway, at one re-render
      // each, and a `__` key in templateSeededIds would reach the URL sync.
      const seeds = Object.entries(chosen ?? {}).filter(([k]) => !k.startsWith('__'));
      for (const [id] of seeds) templateSeededIds.add(id);
      for (const [k, v] of seeds) await runtime.setInput(k, v);
      if (seeds.length) {
        await migrateBlockRowIds(runtime);
        // setInput resolves no refs, so the template's {color.*} tokens + tool-URL
        // image stubs would render black/placeholder; run the mount's resolve pass
        // once, mirroring the fresh-open seed path above.
        if (!tview.templatePickTornDown && viewEl.isConnected) await runtime.resolveRefs();
        tview.refreshDesignExperience(true);
        tview.poseTemplate();
      }
    } catch (e) {
      tview.host.log?.('warn', 'template chooser failed: ' + String(e));
    } finally {
      templateChooserBusy = false;
    }
  };
  // The sidebar-layout door (plans/226 D11): the editor layout has no sidebar header, so
  // Design reaches the same function through its Lolly menu instead.
  templatesBtn?.addEventListener('click', () => {
    void openTemplatesMidSession();
  });

  // Darkroom's "Grade a video…" (plans/130): the tool authors the look and publishes
  // it as the `videoLook` hook extra (a baked .cube, key-guarded); the shell owns the
  // video pipeline. This button joins them - pick a video, hand the baked look plus
  // the tool's own texture params to the background grade job. The toast owns
  // progress; darkroom itself never decodes video.
  const gradeVideoBtn = viewEl.querySelector<HTMLButtonElement>('#grade-video-btn'); tview.gradeVideoBtn = gradeVideoBtn as ToolViewCtx['gradeVideoBtn'];
  if (gradeVideoBtn) {
    gradeVideoBtn.addEventListener('click', async () => {
      if (gradeVideoBtn.dataset.busy) return;
      gradeVideoBtn.dataset.busy = '1';
      try {
        const picked = await tview.host.assets.pick({ type: 'video', title: t('Grade a video') });
        if (!picked) return;
        let cube = '';
        try {
          const look = JSON.parse(runtime.getHydratedText('{{videoLook}}')) as {
            v?: number;
            on?: number;
            cube?: string;
          };
          // The envelope's `on` flag is the tool's own colour-identity test: an
          // untouched darkroom publishes an identity cube, and grading a clip
          // through it would re-encode for nothing AND stamp a colour-grade
          // credential the pixels don't earn. Only an active look counts.
          if (look?.v === 1 && look.on === 1 && typeof look.cube === 'string') cube = look.cube;
        } catch {
          /* no look authored yet - texture params may still make a grade */
        }
        const num = (id: string, dflt: number): number => {
          const v = Number(runtime.getModel().find((i) => i.id === id)?.value);
          return Number.isFinite(v) ? v : dflt;
        };
        const grain = Math.min(1, Math.max(0, num('grain', 0) / 100));
        const vignette = Math.min(1, Math.max(0, num('vignette', 0) / 100));
        if (!cube && grain === 0 && vignette === 0) {
          announce(t('Adjust the look first - this would output the video unchanged.'));
          return;
        }
        const { runVideoJobAsJob, videoJobRefusal } = await import('../../lib/video-jobs.ts');
        // A metadata-only probe so the caps refuse BEFORE a doomed decode starts -
        // the same check the catalog's inline mode shows next to Apply.
        const meta = await new Promise<{ w: number; h: number; durationSec: number } | null>(
          (resolve) => {
            const v = document.createElement('video');
            v.preload = 'metadata';
            v.muted = true;
            v.onloadedmetadata = () =>
              resolve({
                w: v.videoWidth,
                h: v.videoHeight,
                durationSec: Number.isFinite(v.duration) ? v.duration : 0,
              });
            v.onerror = () => resolve(null);
            v.src = picked.url;
          }
        );
        if (!meta) {
          announce(t("Couldn't read this video."));
          return;
        }
        const refusal = videoJobRefusal('grade', {
          longEdge: Math.max(meta.w, meta.h),
          durationSec: meta.durationSec,
          bytes: Number(picked.meta?.bytes ?? 0),
        });
        if (refusal) {
          announce(refusal);
          return;
        }
        const sourceName = String(picked.meta?.name ?? picked.id);
        runVideoJobAsJob(
          tview.host as unknown as import('../../lib/video-jobs.ts').VideoJobHost,
          {
            op: 'grade',
            source: picked,
            sourceName,
            grade: {
              cubeText: cube,
              lutLabel: t('Darkroom look'),
              lutIntensity: 1, // the baked cube already carries the LUT at its authored strength
              grain,
              grainSize: Math.min(4, Math.max(1, num('grainSize', 1.6))),
              vignette,
              seed: Math.round(num('seed', 7)),
              fps: 0, // source fps - a colour edit must not re-time the clip
              bitrate: 8_000_000,
            },
            ...(picked.meta?.aiGenerated === 'full' || picked.meta?.aiGenerated === 'partial'
              ? { aiGeneratedSource: picked.meta.aiGenerated as 'full' | 'partial' }
              : {}),
          },
          {
            onComplete: () => announce(t('Graded video saved to your uploads.')),
            onError: (err) =>
              tview.host.log('error', 'Video grade failed', { id: picked.id, error: String(err) }),
          }
        );
        announce(t('Grading in the background - watch the progress toast.'));
      } finally {
        delete gradeVideoBtn.dataset.busy;
      }
    });
  }

  // Transcribe (engine 1.150, render.transcribe). The whole affordance from one
  // declaration: listen to the named audio/video input, write cues into the named
  // text input. The heavy part is a background job (lib/stt-job.ts) whose toast
  // owns progress and cancel, exactly like the timeline panel's Generate
  // subtitles - the same consent sheet, the same stash/persist rungs, so a clip
  // transcribed once is never paid for twice.
  const transcribeBtn = viewEl.querySelector<HTMLButtonElement>('#transcribe-btn'); tview.transcribeBtn = transcribeBtn as ToolViewCtx['transcribeBtn'];
  if (transcribeSpec && transcribeBtn) {
    const { setupTranscribeControl } = await import('../transcribe-control.ts');
    setupTranscribeControl({
      btn: transcribeBtn,
      runtime: runtime as unknown as Parameters<typeof setupTranscribeControl>[0]['runtime'],
      host: tview.host as unknown as Parameters<typeof setupTranscribeControl>[0]['host'],
      spec: transcribeSpec,
      markSessionDirty: tview.session.markSessionDirty,
    });
  }

  // Wire up the remaining sidebar utility buttons (Shrink URL, Clear changes).
  const sidebarUtilsEl = viewEl.querySelector<HTMLElement>('#sidebar-utils'); tview.sidebarUtilsEl = sidebarUtilsEl as ToolViewCtx['sidebarUtilsEl'];
  if (sidebarUtilsEl) {
    sidebarUtilsEl
      .querySelector<HTMLButtonElement>('#shrink-url-btn')
      ?.addEventListener('click', function (this: HTMLButtonElement) {
        shrinkUrl(runtime, tview.tool.manifest, barSeq);
        const prev = this.textContent;
        this.textContent = t('Shrunk!');
        setTimeout(() => {
          this.textContent = prev;
        }, 1500);
      });
  }

  // WYSIWYG editor overlay (render.layout:'editor'): mount the direct-manipulation
  // layer over the live canvas. Dynamically imported (gated, never static) so it's
  // only pulled in for editor-layout tools - the engine and every other tool are
  // untouched. It reads/writes the flat `boxes` array through runtime.setInput.
  if (editorLayout && canvasEditInput && canvasEl && stageEl) {
    // The artboard is a resizable document. Restore its size from the URL's
    // reserved width/height (px) if present, then re-fit. Skipped in carousel mode -
    // the strip size is owned by syncStrip (from the page count/size inputs), and a
    // reserved ?width/?height must not overwrite it.
    if (!pagesMode && !fixedCanvasMode) {
      if ((urlWidth ?? 0) > 0) canvasEl.style.width = urlWidth + 'px';
      if ((urlHeight ?? 0) > 0) canvasEl.style.height = urlHeight + 'px';
      if ((urlWidth ?? 0) > 0 || (urlHeight ?? 0) > 0) tview.stageLayout.resetView();
    }
    // Resize the document: keep box coordinates fixed (they don't scatter), resize
    // the canvas, mirror it to the export dimensions so output matches, and re-fit.
    const setCanvasSize = (w: number, h: number, unit = 'px'): void => {
      // w/h are in `unit`; the artboard DOM is always px (a physical unit maps at the
      // 96-DPI CSS convention), while the export bar carries the physical size so the
      // output renders at the chosen DPI.
      const pxW = Math.round(unit === 'px' ? w : toCssPx({ value: w, unit: unit as Unit }));
      const pxH = Math.round(unit === 'px' ? h : toCssPx({ value: h, unit: unit as Unit }));
      canvasEl.style.width = pxW + 'px';
      canvasEl.style.height = pxH + 'px';
      actionsApi?.setDims?.({ width: w, height: h, unit });
      tview.session.markUserDirty('w');
      tview.session.markUserDirty('h');
      tview.stageLayout.resetView();
    };

    // --- Presentation mode (plan 112) ------------------------------------------------
    // A lazily-imported view state over the live canvas: it clones the rendered
    // `.lolly-frame-page` nodes out of contentEl into a body-level fullscreen deck stage
    // and never mutates the editor DOM, so exit restores the editor for free. Present is
    // reachable from the ⋯ menu (actions.present) and by opening a `?present` link.
    let presenter: import('../present-mode.ts').PresentController | null = null;
    // Debounced `s=` writer - mirrors updateFullParam, but no more than once per second
    // (reveal's MAX_REPLACE_STATE_FREQUENCY; Safari throttles replaceState). Writes the
    // reorder-proof frame id, so a deep link survives a later frame reorder.
    let sTimer: ReturnType<typeof setTimeout> | null = null;
    let sPending: string | null = null;
    const writePresentUrl = (mutate: (sp: URLSearchParams) => void): void => {
      const sp = new URLSearchParams(tview.stageLayout.currentQuery());
      mutate(sp);
      barSeq.v++;
      const q = sp.toString();
      history.replaceState(history.state, '', q ? `${TOOL_URL_BASE}?${q}` : TOOL_URL_BASE);
    };
    const flushPresentAddress = (): void => {
      if (sPending == null) return;
      const s = sPending;
      sPending = null;
      writePresentUrl((sp) => {
        sp.set('present', '');
        if (tview.presentLoop) sp.set('kiosk', '');
        sp.set('s', s);
      });
    };
    const writePresentAddress = (frameId: string): void => {
      sPending = frameId;
      if (sTimer) return; // a write is already scheduled this window
      sTimer = setTimeout(() => {
        sTimer = null;
        flushPresentAddress();
      }, 1100);
    };
    /**
     * Open the deck. `at` starts on one frame (the top bar's "Present from this slide" and
     * the navigator's row menu both pass a frame id, which present-mode parses as an `s=`
     * address exactly like the deep link); `speaker` opens straight into the speaker view.
     * Both optional, so every existing caller - the rail's Present action, the `?present`
     * auto-entry - keeps its no-argument call and its behaviour.
     */
    const openPresenter = async (o?: { at?: string; speaker?: boolean }): Promise<void> => {
      if (presenter) return;
      const { openPresentMode } = await import('../present-mode.ts');
      // `varsFrom` is read ONCE, at open, off `contentEl`'s inline `--brand-*` slots -
      // and `applyBrandVars` writes those asynchronously (seven awaited token resolves).
      // The `?present` deep link opens on the first rAF that sees a frame page, which on
      // a cold token cache is BEFORE the slots exist: `readScopeVars` returned [] and
      // every `var(--brand-on-primary, #ffffff)` box painted its white fallback, with no
      // second read to recover when the tokens arrived a moment later. So wait for the
      // same promise every other deep-link path waits on (plan 179 T7). On the menu path
      // this is one microtask - the promise settled during mount, long before the click -
      // and it carries brandVarsReady's own 3s cap, so a stalled fetch cannot wedge it.
      await brandVarsReady;
      if (presenter || !viewEl.isConnected) return; // re-check after the awaits
      // Present from the ENGINE's render (nested frame pages WITH their children), not the
      // editor's live DOM: the free-canvas editor flattens boxes to siblings of empty
      // frame-page backgrounds for editing, so cloning those pages would show blank frames.
      // getHydrated() reflects the current committed model as the template renders it.
      const presentSource = document.createElement('div');
      presentSource.innerHTML = runtime.getHydrated();
      const transitionVal = String(
        runtime.getModel().find((i) => i.id === 'transition')?.value ?? 'slide'
      );
      // Derived from the manifest so an option added to the select can never be
      // silently downgraded to a push here (that is how `flight` was lost once).
      const deckTransitionOptions = (): Set<string> =>
        new Set(
          (
            (
              tview.tool.manifest.inputs.find((i) => i.id === 'transition') as
                | { options?: Array<string | { value?: unknown }> }
                | undefined
            )?.options ?? []
          )
            .map((o) => String(typeof o === 'string' ? o : (o?.value ?? '')))
            .filter(Boolean)
        );
      presenter = openPresentMode({
        source: presentSource,
        // A frame id IS an `s=` address (present-mode resolves position / id / `h.f`), so
        // "from this slide" needs no second entry point - it just addresses the open.
        initial: o?.at || presentAddress,
        loop: tview.presentLoop,
        // The presenter stage is a body-level overlay, so it inherits none of the
        // `--brand-*` slots applyBrandVars wrote onto this canvas - hand it the canvas to
        // copy them from, or a box coloured `var(--brand-on-primary, #ffffff)` paints its
        // fallback while presenting and the brand colour while editing (plan 179 T7).
        varsFrom: contentEl,
        // Every value the manifest's `transition` select offers, and no more: the
        // presenter reads this one string as the deck's own transition, so a spelling
        // dropped here is a chosen option that silently becomes a push. `flight` (the
        // camera move over the canvas, plans/179 section 7) was exactly that - offered in
        // the sidebar, written to the model, honoured by the .pptx and mp4 exports, and
        // downgraded on the way into the one player that can actually fly it. Anything
        // unrecognised still falls back to the manifest's own default.
        transition: deckTransitionOptions().has(transitionVal)
          ? (transitionVal as 'slide' | 'fade' | 'morph' | 'flight')
          : 'slide',
        onAddress: (frameId, _index, build) =>
          writePresentAddress(build > 0 ? `${frameId}.${build}` : frameId),
        onClose: () => {
          presenter = null;
          if (sTimer) {
            clearTimeout(sTimer);
            sTimer = null;
          }
          sPending = null;
          // Leave the editor's own URL clean: drop the present params on exit.
          writePresentUrl((sp) => {
            sp.delete('present');
            sp.delete('kiosk');
            sp.delete('s');
          });
        },
      });
      // "Speaker view" opens the deck AND its notes panel in one gesture. Done here rather
      // than as an option on openPresentMode because the controller's own `s` key toggles
      // the very same function - one implementation, two doors.
      if (o?.speaker) presenter?.speaker();
    };

    // The document name lives in ONE place - the export sheet's filename field - and three
    // surfaces read and write it (the Document-info panel, the top bar, the save snapshot's
    // `__label`). Hoisted out of the `info` literal below so the bar shares the exact same
    // pair rather than a second copy of the selector.
    const { get: getFilename, set: setFilename, placeholder: getFilenamePlaceholder } = sessionName(actionsEl);

    // History is a SINGLE-SLOT contract (`historyControls`), and this layout now has two
    // registrants: the overlay's rail pair and the top bar's. Fanning out here keeps the
    // slot single while letting both stay live - without it whichever registered last
    // would leave the other's buttons frozen at their mount-time enabled state.
    const historySyncs: Array<(canUndo: boolean, canRedo: boolean) => void> = [];
    const registerHistory = (sync: (canUndo: boolean, canRedo: boolean) => void): void => {
      historySyncs.push(sync);
      tview.historyControls = {
        sync: (canUndo, canRedo) => {
          for (const s of historySyncs) s(canUndo, canRedo);
        },
      };
      tview.history.refreshHistoryUI();
    };

    // The three Design chrome modules (plan 179 M1-M3). Declared here so the top bar's
    // Navigator toggle can reach a column that is mounted after it, and so teardown has
    // one list to fold into `_cleanup`.
    let designTopbar: import('../design-topbar.ts').DesignTopbar | null = null;
    let designNav: import('../design-navigator.ts').DesignNavigatorHandle | null = null;
    let designInspector: import('../design-inspector.ts').DesignInspectorHandle | null = null;
    let designInspectorFloat: import('../design-inspector-float.ts').DesignInspectorFloatHandle | null = null;

    /**
     * Column open state is a DEVICE preference, not document data: it must never dirty the
     * document, ride a collab op or travel in a saved session, which is what `host.state`
     * would mean. Same reasoning (and the same try/catch) as the sidebar width.
     */
    const readColumnPref = (key: string): boolean => {
      try {
        const v = localStorage.getItem(key);
        if (v === 'open') return true;
        if (v === 'closed') return false;
      } catch {
        /* private mode / blocked storage: fall through to the width default */
      }
      return window.innerWidth > 1180;
    };
    const writeColumnPref = (key: string, open: boolean): void => {
      try {
        localStorage.setItem(key, open ? 'open' : 'closed');
      } catch {
        /* best-effort */
      }
    };

    import('../free-canvas.ts')
      .then(({ initFreeCanvas }) => {
        if (!viewEl.isConnected) return; // navigated away before the chunk loaded
        // The host-UI profile setter is a web-shell extension (WebProfileAPI), not on
        // the engine's read-only ProfileAPI - surface it via a narrow cast so the
        // Document-info panel can toggle the provenance opt-in.
        const profileApi = tview.host.profile as typeof tview.host.profile & {
          set?: (p: Profile) => Promise<void>;
        };
        const fc = initFreeCanvas({
          viewEl,
          stageEl,
          canvasEl,
          outerEl,
          runtime,
          host: tview.host,
          input: canvasEditInput,
          nativeW,
          nativeH,
          onDirty: tview.session.markUserDirty,
          // In carousel mode the strip size is owned by syncStrip (page count/size inputs);
          // withholding setCanvasSize stops the artboard-resize + design-import paths from
          // clobbering the strip. (The rail's size control is the page-size picker instead.)
          setCanvasSize: pagesMode || fixedCanvasMode ? undefined : setCanvasSize,
          setDocumentSettings: ({ unit, dpi, width, height }) => {
            // Design owns a document-level unit/DPI.  The export panel remains the
            // physical-output surface, but it mirrors that document state rather than
            // maintaining a competing temporary unit preference.
            actionsApi?.setDims?.({ unit, dpi, width, height });
          },
          // Multi-page (carousel) mode: gives the overlay the page-count + page-size input
          // ids so its rail exposes a page stepper / size picker, and so it translates box
          // gestures by each frame's offset. Absent for single-page editors.
          pages: pagesCfg
            ? {
                countField: pagesCfg.count,
                widthField: pagesCfg.width,
                heightField: pagesCfg.height,
                min: pagesCfg.min ?? 1,
                max: pagesCfg.max ?? 6,
              }
            : undefined,
          // Frame-primitive mode (plan 93 F1b): frame field names so the overlay renders
          // frame-local + re-buckets on drop. Absent unless the canvas declares frameField.
          frame: frameCfg,
          // One-shot EDITOR state off the link (docs/url-mode.md "On a tool route"): the
          // `_ui` object param plus the `_sel`/`_t`/`_panel` shorthands, which win on
          // conflict. All in the `_` namespace the engine reserves outright (parseUrlState
          // skips it), so none can ever shadow a tool input; syncUrl drops them on the
          // first edit.
          deepLink: { ...tview.templatePose, ...parseEditorState(urlFlags) },
          // Document-info panel: read/write the export/save name, plus at-a-glance
          // details. Name binds to the export bar's filename field (the canonical
          // save name); last-edited reads the resumed session's timestamp if any.
          info: {
            id: tview.tool.manifest.id,
            name: tview.tool.manifest.name,
            version: tview.tool.manifest.version,
            status: tview.tool.manifest.status,
            formats: tview.tool.manifest.render.formats,
            getFilename,
            setFilename,
            lastEdited: (async () => {
              if (!slot) return null;
              try {
                return (await tview.host.state.list()).find((s) => s.slot === slot)?.updatedAt || null;
              } catch {
                return null;
              }
            }) as () => string | Promise<string> | null | undefined,
            // Export provenance - a read-only view of the name/contact baked into the
            // file's metadata (see engine metadata.ts buildExportMeta) + the opt in/out
            // toggle. Only offered where the shell can persist the profile (host.profile.set).
            provenance:
              typeof profileApi.set === 'function'
                ? {
                    editHref: '#/profile?focus=use-details',
                    get: async () => {
                      const pr = await tview.host.profile.get();
                      const join = (a?: string, b?: string, sep = ' '): string =>
                        [a, b]
                          .map((s) => (s ?? '').trim())
                          .filter(Boolean)
                          .join(sep);
                      return {
                        optedIn: pr.useDetails === true,
                        author: join(pr.firstname, pr.lastname),
                        contact: join(pr.email, pr.phone, ' · '),
                      };
                    },
                    setOptIn: async (on: boolean) => {
                      const cur = await tview.host.profile.get();
                      await profileApi.set!({ ...cur, useDetails: on });
                    },
                  }
                : undefined,
          },
          // Picking a Lolly link / saved session for a box image opens its inputs
          // first (configure → insert), same as the sidebar asset slots. The picker
          // passes mode 'edit' when re-opening the box's current Lolly render.
          editTool: (toolUrl: string, mode = 'insert') =>
            openEmbedEditor(tview.host, { editUrl: toolUrl, slotLabel: t('image'), mode }),
          // The editor is chromeless (no sidebar header), so the free-canvas rail
          // hosts a pair of visible undo/redo buttons. Since plan 179 M1 the design
          // top bar hosts a second pair, so `registerHistory` fans the single-slot
          // contract out to both rather than letting the later mount silence the
          // earlier one (the header pair can't exist in this layout, so no conflict).
          history: {
            undo: tview.history.undoHistory,
            redo: tview.history.redoHistory,
            register: registerHistory,
          },
          // Chrome the tool view owns and the overlay's trimmed Lolly menu now hosts: the
          // theme cycle and sound toggles the retired zoom HUD used to carry (see the
          // setupStageNav call above), the profile avatar, and the two save rows.
          // The elements are ADOPTED, not cloned - the HUD is not built in this layout,
          // so nothing else holds a claim on them.
          chrome: {
            themeToggle: themeToggle ?? undefined,
            soundToggle: soundToggle ?? undefined,
            saveToLibrary: canSaveSession
              ? () => {
                  tview.renderSaveBtn?.click();
                }
              : undefined,
            // The same dialog, opened on its template card (plans/226 4.1) - so the menu
            // offers both destinations by name instead of one row that hides the other.
            saveAsTemplate:
              canSaveSession && openSaveAs
                ? () => {
                    void openSaveAs!('template');
                  }
                : undefined,
          },
          // Primary actions as prominent rail icons (the chromeless editor has no
          // bottom pill). Each delegates to the tool's existing handler/button so
          // the export/save/copy/share logic isn't duplicated: Export opens the
          // export popup, Save is the in-place checkpoint save, Copy writes the
          // rendered output, Share copies a shareable link. dirtyRef lets the rail
          // Save icon mirror the render pill's amber "unsaved" cue.
          actions: {
            export: () => renderFab?.click(),
            save: () => tview.renderSaveBtn?.click(),
            copy: () => viewEl.querySelector<HTMLButtonElement>('[data-action="copy"]')?.click(),
            share: () =>
              viewEl.querySelector<HTMLButtonElement>('[data-action="copy-url"]')?.click(),
            // Present the frames as a fullscreen deck (plan 112). Fire-and-forget: the
            // presenter module is lazily imported on first use. An optional frame id starts
            // the deck there - what the navigator's "Present from here" row spends.
            present: (atFrameId?: string) => {
              void openPresenter(atFrameId ? { at: atFrameId } : undefined);
            },
            // Offered when the tool has templates of EITHER kind (plans/226 WP-1): a
            // person's own template is as good a reason to re-open the chooser as a
            // shipped one, and the list is already resolved for the Save as… dialog.
            newFromTemplate: hasTemplates || myTemplates.length > 0
              ? () => {
                  void openTemplatesMidSession();
                }
              : undefined,
            // The chromeless editor's home for "Bulk from rows" - the sidebar header
            // button that carries it everywhere else does not exist in this layout.
            bulk: canBulk
              ? () => {
                  tview.session.openBulk();
                }
              : undefined,
            canSave: canSaveSession,
            dirtyRef: tview.renderSaveBtn,
          },
        } as Parameters<typeof initFreeCanvas>[0]);

        // ── The Design chrome: top bar + navigator + inspector (plan 179 M1-M3) ──────
        //
        // Lazily imported alongside the overlay, not statically, so a tool that never
        // mounts an editor pays nothing for three modules it cannot use. Each is mounted
        // through the ports on `fc.design` (see design-ports.ts) - none of them import
        // free-canvas, and none of them reach the model except through those ports, which
        // is why they are unit-testable and why this wiring is the only place that knows
        // both halves. Order matters: the bar measures its own height into
        // `--stage-reserve-top` before the columns report their widths, so the first fit
        // the canvas performs already accounts for all three bands.
        void Promise.all([
          import('../design-topbar.ts'),
          import('../design-navigator.ts'),
          import('../design-inspector.ts'),
          import('../design-inspector-float.ts'),
        ])
          .then(([{ mountDesignTopbar }, { initDesignNavigator }, { initDesignInspector }, { wireDesignInspectorFloat }]) => {
            if (!viewEl.isConnected) return;
            const design = fc.design;

            // The navigator is the only writer of a stage side reserve, and it writes through
            // the overlay's arbiter - which also owns the docked rail's share of the left
            // band, so a navigator and an open timeline cannot each claim the same edge.
            //
            // The RIGHT number is always 0: the inspector is not a stage child any more but an
            // occupant of the app's one right-hand column (lib/edge-dock.ts), and that column
            // reserves its width by nudging `#view` with `--dock-w`. Passing its width here as
            // well would take the same space twice.
            let navW = 0;
            const pushWidths = (): void => {
              design.setColumnWidths(navW, 0);
            };

            // ── One right-hand panel (Andy, 2026-09-02: "a single left sidebar and a single
            // right sidebar") ───────────────────────────────────────────────────────────
            //
            // The inspector used to append itself to the stage, which put a second right-hand
            // panel INSIDE the canvas surface, beside the edge dock the export sheet was
            // already using - two columns over the artwork, one of them clipping it. It is now
            // an occupant of that one column (lib/edge-dock.ts) like everything else, so
            // "the inspector is open" means the same live panel is either in that column
            // or in its persisted floating box. `setInspectorOpen` is the single writer.
            //
            // The column is the app's, not this view's: it can hand a panel back on its own
            // (the user undocks it, or the window drops below the mobile breakpoint, where the
            // whole dock is inert). That is why the release path - not just the bar's toggle -
            // is what records the state and re-syncs the bar.
            const INSP_KEY = 'lolly-design-inspector';
            let inspectorOpen = false;
            const setInspectorOpen = (open: boolean): void => {
              designInspectorFloat?.setOpen(open);
            };

            // (a) The top bar. Every port is a live read off the overlay or this view; the
            // bar holds no state of its own beyond its own open menu.
            designTopbar = mountDesignTopbar({
              stageEl,
              canvasEl,
              // The Home pill moved out of the view's corner and into the bar's left slot
              // (see the render gate above), so the bar emits it and we wire it here.
              backPillHtml: backHomeHtml(backPillOpts),
              history: { undo: tview.history.undoHistory, redo: tview.history.redoHistory, register: registerHistory },
              revisions: actionsApi?.history || collabHandle?.history ? { open: () => { void tview.session.openRevisions(); } } : undefined,
              name: {
                get: getFilename,
                set: setFilename,
                // The export field's own placeholder IS the auto-filename (tool-actions keeps
                // it fresh on every `lolly:export-open`), so reading it here needs no second
                // implementation of the naming rules.
                placeholder: getFilenamePlaceholder,
              },
              intent: {
                get: () => tview.designIntent,
                set: (value) => {
                  const next = DESIGN_INTENT_OPTIONS.find(
                    (option) => option.value === value
                  )?.value;
                  if (next) tview.history.setDesignIntent(next, true);
                },
                options: DESIGN_INTENT_OPTIONS,
              },
              zoom: {
                fitAll: () => {
                  tview.stageZoom?.fit();
                },
                // Deliberately the overlay's own focus path (`fc-focus-rect`), not a rect this
                // view converts: the overlay owns the canvas→client mapping, and the navigator
                // and the timeline already frame artboards through exactly this door.
                fitArtboard: () => {
                  const id = design.activeFrameId();
                  if (id) design.artboard.focus(id);
                },
                zoomBy: (f) => {
                  tview.stageZoom?.zoomBy(f);
                },
                zoomTo: (abs) => {
                  tview.stageZoom?.zoomTo(abs);
                },
                actual: () => tview.stageZoom?.actual() ?? 0,
                subscribe: (cb) =>
                  tview.stageZoom?.subscribe(cb) ??
                  (() => {
                    /* no stage nav: nothing to follow */
                  }),
              },
              timeline: {
                toggle: () => design.toggleTimeline(),
                isOpen: () => design.isTimelineOpen(),
              },
              timelineEnabled: () => designTimelineEnabled(tview.designIntent),
              navigator: {
                toggle: () => {
                  const n = designNav;
                  if (n) n.setOpen(!n.isOpen());
                },
                isOpen: () => !!designNav?.isOpen(),
              },
              // The inspector's only show/hide control from outside the panel. Its detachable
              // controller decides whether "open" restores the edge column or the floating
              // box; the top bar only asks for the shared live surface.
              inspector: {
                toggle: () => setInspectorOpen(!inspectorOpen),
                isOpen: () => inspectorOpen,
              },
              // …and the same column's other occupant the bar has to know about: while the
              // compact zoom bar is docked it carries Fit / NN% / ±, so the bar drops its own
              // copy of them rather than showing the five verbs twice.
              dock: {
                // Docked AND on screen: a collapsed column hides its body, so a bar that read
                // occupancy alone dropped Fit / NN% / ± (and the mark, and the avatar) for a
                // compact zoom bar nobody could see.
                zoomDocked: () => isDocked('zoom') && !edgeDockCollapsed(),
                subscribe: (cb) => onDockChange(cb),
              },
              share: () => {
                viewEl.querySelector<HTMLButtonElement>('[data-action="copy-url"]')?.click();
              },
              present: (o) => {
                void openPresenter(o);
              },
              exportSheet: (o) => {
                if (o?.format) actionsApi?.setFormat?.(o.format);
                renderFab?.click();
              },
              // The deck-wide Narrate row (plans/180 section 8). Undefined where the overlay
              // offers no narration - no speech bridge, no frames - and then there is no row.
              narrate: design.narrationActions,
              narrationEnabled: () => designNarrationEnabled(tview.designIntent),
              model: {
                getInput: (id) => runtime.getModel().find((i) => i.id === id)?.value,
                // Caught, not floated: the bar writes doc-level inputs the MANIFEST declares
                // (`autoAdvance`), and a tool that has not declared one yet must leave a log
                // line rather than an unhandled rejection on the page.
                setInput: (id, v) => {
                  tview.session.markUserDirty(id);
                  void Promise.resolve(runtime.setInput(id, v as InputValue)).catch((e: unknown) =>
                    tview.host.log?.('warn', `top bar could not set "${id}": ${String(e)}`)
                  );
                },
              },
              // Loop is the reserved `?kiosk` flag, not a model field: it describes how the
              // deck is PLAYED, and a shared link is how that travels.
              loop: {
                get: () => tview.presentLoop,
                set: (v) => {
                  tview.presentLoop = v;
                  writePresentUrl((sp) => {
                    if (v) sp.set('kiosk', '');
                    else sp.delete('kiosk');
                  });
                },
              },
              onFileMenu: (anchor) => design.openLollyMenu(anchor),
              // The avatar is ADOPTED (moved), so exactly one surface holds it at a time. The
              // bar is its home while the right column is closed; when the compact zoom bar
              // takes the column the bar hands the avatar to that bar instead (profileDock
              // below), so the profile menu is always reachable and never doubled.
              profileEl: profileToggle ?? undefined,
              // The docked compact zoom bar is the stage nav's own pill, so its element is
              // where the avatar goes while the column holds it. Null before the pill exists
              // (or on a layout that builds none), which the bar reads as "keep it".
              profileDock: () => tview.stageZoom?.profileHome() ?? null,
              // A document can only be presented (or have an artboard framed) if the tool
              // declares a frame primitive AND the document actually holds one.
              hasFrames: () => {
                if (!frameCfg) return false;
                if (design.activeFrameId()) return true;
                const kindField = (design.model.cfg as { kindField?: string }).kindField || 'kind';
                const frameKind = design.model.frame?.frameKind || frameCfg.frameKind || 'frame';
                return design.model
                  .getBoxes()
                  .some((b) => String(b[kindField] ?? '') === frameKind);
              },
              activeFrameId: () => design.activeFrameId(),
            });
            tview.syncDesignIntentChrome = () => {
              designTopbar?.sync();
              designInspector?.sync();
            };
            tview.applyDesignIntentLayout = (outcome) => {
              if (outcome.openNavigator && !designNav?.isOpen()) designNav?.setOpen(true);
              if (!outcome.openNavigator && designNav?.isOpen()) designNav.setOpen(false);
              if (outcome.openTimeline !== design.isTimelineOpen()) design.toggleTimeline();
            };
            tview.refreshDesignExperience(Boolean(templateParam));
            // No frame primitive at all: there is no deck here and never will be, so the
            // Present split is not disabled - it is not offered.
            if (!frameCfg) {
              const split = designTopbar.el.querySelector<HTMLElement>('.dtb-split');
              if (split) split.hidden = true;
            }
            // The bar's Home pill is not in the DOM when the view-wide mountBackPill() runs
            // (this callback is a dynamic import behind it), so wire the bar's own subtree.
            mountBackPill(designTopbar.el, { intercept: tview.session.backPillIntercept });
            mountHomeFab(designTopbar.el, { intercept: tview.session.backPillIntercept });
            // An edit made to the filename in the export sheet must show up in the bar. The
            // event is dispatched on the actions panel and does not bubble, so listen there.
            // Both edges of the sheet: it can open on one name and close on another (the field
            // normalises, or an unsaved edit is dropped), and a bar left on the stale one
            // writes it straight back over the sheet's at the next keystroke.
            const onExportOpen = (): void => designTopbar?.sync();
            actionsEl?.addEventListener('lolly:export-open', onExportOpen);
            actionsEl?.addEventListener('lolly:export-close', onExportOpen);
            // …and the OPEN event is not enough: it fires when the sheet opens, so a name
            // typed into the Filename field while it is open left the bar showing the old
            // one for the rest of the session - and the next keystroke in the bar wrote that
            // stale value straight back over the sheet's. `input` bubbles up to the panel, so
            // one delegated listener covers the field however it is rebuilt; the bar's own
            // `sync()` skips an unchanged value, so this is inert while typing in the bar.
            const onFilenameInput = (e: Event): void => {
              if ((e.target as HTMLElement | null)?.closest?.('[data-action="filename"]')) {
                tview.session.markUserDirty('filename');
                designTopbar?.sync();
              }
            };
            actionsEl?.addEventListener('input', onFilenameInput);

            // (b) The navigator column (slides / artboards + the active frame's layers).
            const NAV_KEY = 'lolly-design-nav';
            designNav = initDesignNavigator({
              stageEl,
              canvasEl,
              skin: window.matchMedia?.(
                '(pointer: coarse) and (max-width: 640px), (pointer: coarse) and (max-height: 430px)'
              ).matches
                ? 'strip'
                : 'column',
              model: design.model,
              selection: design.selection,
              artboard: design.artboard,
              thumb: design.thumb,
              actions: design.navigatorActions,
              // Notes to voice (plans/180): undefined on a host with no speech bridge, and
              // then the row's dot is the speaker-notes mark it has always been.
              narration: design.narrationActions,
              initiallyOpen: readColumnPref(NAV_KEY),
              onOpenChange: (open) => {
                writeColumnPref(NAV_KEY, open);
                designTopbar?.sync();
              },
              onWidthChange: (px) => {
                navW = px;
                pushWidths();
              },
            });
            if (!slot && templateParam) tview.applyDesignIntentLayout(tview.session.currentDesignOutcome());

            // (c) The inspector column, then hand it to the overlay so the object bar's
            // Text / More / Dims / Stroke buttons reveal its sections instead of opening
            // the one-slot popovers.
            //
            // It is built DETACHED and never appended to the stage: `setInspectorOpen` puts
            // it in the one right-hand column, which is also what takes it back out. Its own
            // header close button comes back here through `onClose` for the same reason - so
            // the panel and the bar's toggle can never disagree about where it is.
            designInspector = initDesignInspector({
              stageEl,
              canvasEl,
              model: design.model,
              selection: design.selection,
              artboard: design.artboard,
              actions: design.inspectorActions,
              guides: design.guides,
              // The Narrate button under the Speaker notes, and the document's own narration
              // settings. Absent means neither is drawn (plans/180 section 8).
              narration: design.narrationActions,
              narrationEnabled: () => designNarrationEnabled(tview.designIntent),
              fonts: design.fonts,
              // Document health asks the SAME registry vector export uses whether a
              // rendered run has real font bytes. Kept lazy: opening Design without
              // its inspector never pulls the font registry into this chunk.
              resolveFont: async (style, text) => {
                const { resolveVectorFont } = await import('../../bridge/font-registry.ts');
                return Boolean(await resolveVectorFont(style, text));
              },
              voices: tview.host.speech?.voices ? () => tview.host.speech!.voices() : undefined,
              fields: design.fields,
              // The panel skips its whole render while closed, and it is built DETACHED - so
              // without this it was constructed "open" and rebuilt its full property column on
              // every selection change and every commit, for a node that was never in the
              // document. The dock's own setOpen(true) forces a fresh sync on the way in.
              initiallyOpen: false,
              // The close button removes the column from the page, which drops focus to
              // <body>; the bar's toggle is the only way back in, so it takes the keyboard.
              onClose: () => {
                setInspectorOpen(false);
                designTopbar?.focusInspectorToggle();
              },
            });
            designInspectorFloat = wireDesignInspectorFloat({
              inspector: designInspector,
              head: designInspector.el.querySelector<HTMLElement>('.fc-insp-headbar')!,
              onOpenChange: (open, reason) => {
                inspectorOpen = open;
                if (reason === 'user') writeColumnPref(INSP_KEY, open);
                designTopbar?.sync();
              },
            });
            // The object bar's Text / More / Dims / Stroke buttons reveal a section, and that
            // can arrive while the column is out of the dock - so the handle the overlay gets
            // asks for a slot FIRST and then scrolls. Wrapped here rather than inside the
            // column, because taking a dock slot is this view's job, not the panel's.
            design.setInspector({
              reveal: (section) => {
                setInspectorOpen(true);
                designInspector?.reveal(section);
              },
            });
            // Restored from the device-local open preference. The detachable controller
            // independently remembers whether that means the edge column or a float box.
            if (readColumnPref(INSP_KEY)) setInspectorOpen(true);
            // BOTH columns are mounted after the bar, and neither announces its state at
            // mount: the navigator fires `onOpenChange` only from its own setOpen, and the
            // inspector's is now a dock request this view makes. So the bar's own `sync()`
            // (which ran inside mountDesignTopbar, when both handles were still null) had
            // every toggle reading `aria-pressed="false"` over an open column: a screen
            // reader told the panel was off while it was on, and the pressed styling never
            // painted. One sync here, once all three exist, with the real state.
            tview.syncDesignIntentChrome();

            const prevChromeCleanup = viewEl._cleanup;
            viewEl._cleanup = () => {
              actionsEl?.removeEventListener('lolly:export-open', onExportOpen);
              actionsEl?.removeEventListener('lolly:export-close', onExportOpen);
              actionsEl?.removeEventListener('input', onFilenameInput);
              // Unregister the inspector BEFORE destroying it, so a late object-bar rebuild
              // cannot reveal a section on a column that is already gone - and take it out of
              // the shared right-hand column, which outlives this view and would otherwise
              // keep a slot for an element nobody owns any more.
              try {
                design.setInspector(null);
              } catch (e) {
                console.error(e);
              }
              try {
                designInspectorFloat?.destroy();
              } catch (e) {
                console.error(e);
              }
              designInspectorFloat = null;
              for (const part of [designInspector, designNav, designTopbar]) {
                try {
                  part?.destroy();
                } catch (e) {
                  console.error(e);
                }
              }
              designInspector = designNav = designTopbar = null;
              tview.syncDesignIntentChrome = () => {};
              tview.applyDesignIntentLayout = () => {};
              prevChromeCleanup?.();
            };
          })
          .catch((err: unknown) => console.error('[design] chrome failed to load:', err));

        tview.poseTemplate = () => fc.applyUi(tview.templatePose);
        const detachEditorApi = attachCanvasEditorApi(fc);
        const prevCleanup = viewEl._cleanup;
        viewEl._cleanup = () => {
          detachEditorApi();
          tview.poseTemplate = () => {};
          try {
            fc.destroy();
          } catch (e) {
            console.error(e);
          }
          prevCleanup?.();
        };
      })
      .catch((err: unknown) => console.error('[design] editor overlay failed to load:', err));

    // `?present` auto-entry: open the deck once the canvas has rendered its frame pages
    // (the runtime paints on mount asynchronously, so poll a few frames for them).
    if (isPresent) {
      let tries = 0;
      const tryOpen = (): void => {
        if (!viewEl.isConnected || presenter) return;
        if (contentEl.querySelector('.lolly-frame-page')) {
          void openPresenter();
          return;
        }
        if (tries++ < 120) requestAnimationFrame(tryOpen); // ~2s at 60fps, then give up
      };
      requestAnimationFrame(tryOpen);
    }

    // ── Editor keyboard verbs (plan 179 M1 section 4) ────────────────────────────
    //
    // Three document-level chords, and only in this layout - a chromeless editor has no
    // visible pill to reach for, so Save and Export need a key. Each delegates to the
    // button that already owns the behaviour, so there is exactly one implementation.
    //
    // NOT Cmd/Ctrl+Shift+P: Firefox opens a private window on it and will not let a page
    // intercept, so a shortcut printed in a menu would silently do the wrong thing on one
    // browser. Cmd/Ctrl+Return is free everywhere and reads as "go".
    //
    // `z`/`y` stay with onHistoryKey and the canvas keeps its own bare-key chords; nothing
    // here collides. A text field always wins - typing beats every shortcut.
    const onDocKey = (e: KeyboardEvent): void => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
      if (isTextEditing()) return;
      const k = e.key.toLowerCase();
      if (k === 's') {
        e.preventDefault();
        tview.renderSaveBtn?.click();
        return;
      }
      if (k === 'e') {
        e.preventDefault();
        renderFab?.click();
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        void openPresenter();
      }
    };
    window.addEventListener('keydown', onDocKey);

    // Fold the presenter into teardown so navigating away closes the deck cleanly.
    const prevCleanupPresent = viewEl._cleanup;
    viewEl._cleanup = () => {
      window.removeEventListener('keydown', onDocKey);
      try {
        presenter?.close();
      } catch (e) {
        console.error(e);
      }
      prevCleanupPresent?.();
    };
  }

  // Multi-page rich-text document editor (render.layout:'document'). Mounts the
  // document overlay over the live canvas, reading/writing the flat `content` blocks
  // array through runtime.setInput - the same chromeless-canvas + export scaffolding as
  // the editor layout, but a word-processor UI instead of the free-canvas overlay.
  if (documentLayout && docEditInput && canvasEl && stageEl) {
    if ((urlWidth ?? 0) > 0) canvasEl.style.width = urlWidth + 'px';
    if ((urlHeight ?? 0) > 0) canvasEl.style.height = urlHeight + 'px';
    if ((urlWidth ?? 0) > 0 || (urlHeight ?? 0) > 0) tview.stageLayout.resetView();
    const setCanvasSize = (w: number, h: number, unit = 'px'): void => {
      const pxW = Math.round(unit === 'px' ? w : toCssPx({ value: w, unit: unit as Unit }));
      const pxH = Math.round(unit === 'px' ? h : toCssPx({ value: h, unit: unit as Unit }));
      canvasEl.style.width = pxW + 'px';
      canvasEl.style.height = pxH + 'px';
      actionsApi?.setDims?.({ width: w, height: h, unit });
      tview.session.markUserDirty('w');
      tview.session.markUserDirty('h');
      tview.stageLayout.resetView();
    };
    import('../doc-editor.ts')
      .then(({ initDocEditor }) => {
        if (!viewEl.isConnected) return; // navigated away before the chunk loaded
        const dc = initDocEditor({
          viewEl,
          stageEl,
          canvasEl,
          runtime,
          host: tview.host,
          input: docEditInput,
          inputs: tview.tool.manifest.inputs ?? [],
          nativeW,
          nativeH,
          onDirty: tview.session.markUserDirty,
          setCanvasSize,
          editTool: (toolUrl: string, mode = 'insert') =>
            openEmbedEditor(tview.host, { editUrl: toolUrl, slotLabel: t('image'), mode }),
          history: {
            undo: tview.history.undoHistory,
            redo: tview.history.redoHistory,
            register: (sync: (canUndo: boolean, canRedo: boolean) => void) => {
              tview.historyControls = { sync };
              tview.history.refreshHistoryUI();
            },
          },
          actions: {
            export: () => renderFab?.click(),
            save: () => tview.renderSaveBtn?.click(),
            canSave: canSaveSession,
            dirtyRef: tview.renderSaveBtn,
          },
        } as Parameters<typeof initDocEditor>[0]);
        const prevCleanup = viewEl._cleanup;
        viewEl._cleanup = () => {
          try {
            dc.destroy();
          } catch (e) {
            console.error(e);
          }
          prevCleanup?.();
        };
      })
      .catch((err: unknown) => console.error('[doc-studio] document editor failed to load:', err));
  }

  // Slide-deck editor (render.layout:'deck', e.g. Deck Builder). Mounts an on-canvas overlay
  // into the stage subtree (a sibling region of #tool-canvas - survives the canvas repaint)
  // that decorates the live deck for in-place editing + thumbnail-rail navigation. Dynamically
  // imported so it's only pulled in for deck-layout tools. The sidebar stays (deck is NOT
  // chromeless), so this ADDS to the sidebar rather than replacing it.
  if (deckLayout && deckEditInput && canvasEl && stageEl) {
    import('../deck-editor.ts')
      .then(({ initDeckEditor }) => {
        if (!viewEl.isConnected) return; // navigated away before the chunk loaded
        const de = initDeckEditor({
          viewEl,
          stageEl,
          canvasEl,
          runtime,
          host: tview.host,
          input: deckEditInput,
          inputs: tview.tool.manifest.inputs ?? [],
          nativeW,
          nativeH,
          onDirty: tview.session.markUserDirty,
          editTool: (toolUrl: string, mode = 'insert') =>
            openEmbedEditor(tview.host, { editUrl: toolUrl, slotLabel: t('image'), mode }),
          history: {
            undo: tview.history.undoHistory,
            redo: tview.history.redoHistory,
            register: (sync: (canUndo: boolean, canRedo: boolean) => void) => {
              tview.historyControls = { sync };
              tview.history.refreshHistoryUI();
            },
          },
          actions: {
            export: () => renderFab?.click(),
            save: () => tview.renderSaveBtn?.click(),
            canSave: canSaveSession,
            dirtyRef: tview.renderSaveBtn,
          },
        } as Parameters<typeof initDeckEditor>[0]);
        const prevCleanup = viewEl._cleanup;
        viewEl._cleanup = () => {
          try {
            de.destroy();
          } catch (e) {
            console.error(e);
          }
          prevCleanup?.();
        };
      })
      .catch((err: unknown) => console.error('[deck-builder] deck editor failed to load:', err));
  }
}

export function sessionOps(tview: ToolViewCtx) {
  return {
    currentDesignOutcome: bindOp(tview, currentDesignOutcome),
    markSessionDirty: bindOp(tview, markSessionDirty),
    markSessionSaved: bindOp(tview, markSessionSaved),
    syncUrl: bindOp(tview, syncUrl),
    markUserDirty: bindOp(tview, markUserDirty),
    openRevisions: bindOp(tview, openRevisions),
    openBulk: bindOp(tview, openBulk),
    backPillIntercept: bindOp(tview, backPillIntercept),
    bakeFraming: bindOp(tview, bakeFraming),
    wireLiveEditing: bindOp(tview, wireLiveEditing),
  };
}
