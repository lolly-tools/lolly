// SPDX-License-Identifier: MPL-2.0
/**
 * In-place editor for Lolly-sourced embeds (finding 1). Extracted from tool.js
 * unchanged. Mutually recursive with input-panel.ts by design: the panel's Edit
 * / configure-then-insert affordances open this editor, and the editor drives
 * its own panel instance over a throwaway child runtime.
 */
import type { AssetRef, InputValue, ExportFormat } from '@lolly/engine';
import { createRuntime, parseUrlState, serializeUrlState, buildEmbedUrl, parseToolUrl } from '@lolly/engine';
import { escape } from '../../utils.ts';
import { getTool } from '../../bridge/tool-loader.ts';
import type { WebHost } from '../../bridge/index.ts';
import { createInputPanel } from './input-panel.ts';
import type { PanelContainer } from './input-panel.ts';

/**
 * Edit a Lolly-sourced image in place → Promise<AssetRef | null>.
 *
 * An asset minted from a pasted Lolly link records its origin as a canonical,
 * re-renderable embed URL (meta.toolUrl — see compose.renderUrl). This overlay
 * re-opens the SOURCE tool's own inputs, pre-filled from that URL, so an editor can
 * make minor changes (and adjust format/size), preview live, and re-apply the new
 * render to the same slot. Resolves to a fresh tool-sourced AssetRef (a new
 * canonical id) or null if cancelled.
 *
 * Reuse, not reinvention: the source tool's controls are driven by a throwaway
 * runtime via the SAME renderInputs/syncInputs the main sidebar uses, and every
 * preview + the final commit go through host.compose.renderUrl(buildEmbedUrl(…)) —
 * the SAME minting the paste flow uses. So the re-applied asset round-trips through
 * URL mode + saved sessions exactly like the original; provenance is just the URL
 * we already persist, nothing new is stored.
 */
export async function openEmbedEditor(
  host: WebHost,
  { editUrl, slotLabel, mode = 'edit' }: { editUrl: string; slotLabel?: string; mode?: 'edit' | 'insert' },
): Promise<AssetRef | null> {
  if (!host.compose?.renderUrl) return null;
  const parsed = parseToolUrl(editUrl);
  if (!parsed) return null;

  let tool, desc, child;
  try {
    [tool, desc] = await Promise.all([getTool(parsed.toolId), host.compose._describeUrl(editUrl)]);
    if (!tool || !desc) return null;
    const state = parseUrlState(parsed.query, tool.manifest);
    child = await createRuntime(tool, host, state.values);
  } catch {
    return null; // unknown tool / bad link → silently no-op (button shouldn't have shown)
  }
  const childRuntime = child;
  const renderUrl = host.compose.renderUrl.bind(host.compose);

  // The embed panel is its OWN input-panel instance driving the child runtime.
  // Its edits are throwaway (Apply re-exports the whole child state), so they
  // never enter the main tool's undo history — set and setSilent both just
  // forward to child.setInput (finding 6: a separate instance, not shared state).
  const childHistory = {
    set: (id: string, v: InputValue) => childRuntime.setInput(id, v),
    setSilent: (id: string, v: InputValue) => childRuntime.setInput(id, v),
  };

  // The format <select> is populated from desc.formats (strings from the compose
  // describe step); narrow each read back to the ExportFormat union at this boundary.
  const EXPORT_FORMATS: readonly ExportFormat[] = ['png', 'jpg', 'svg', 'emf', 'eps', 'eps-cmyk', 'pdf', 'pdf-cmyk', 'cmyk-tiff', 'html', 'webm'];
  const asExportFormat = (v: string): ExportFormat | undefined => EXPORT_FORMATS.find(x => x === v);

  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'embed-editor-overlay';
    const fmtOptions = desc.formats.map(f =>
      `<option value="${escape(f)}"${f === desc.format ? ' selected' : ''}>${escape(f.toUpperCase())}</option>`
    ).join('');
    const titleSlot = escape(slotLabel ?? 'image');
    // 'insert' = filling an empty slot from the picker's Tools/Saved list; 'edit' =
    // re-opening an already-placed Lolly asset via its "from <tool>" badge.
    const titleVerb  = mode === 'insert' ? 'New' : 'Edit';
    const applyLabel = mode === 'insert' ? 'Insert' : 'Re-apply to slot';
    overlay.innerHTML = `
      <div class="embed-editor-backdrop" aria-hidden="true"></div>
      <div class="embed-editor-panel" role="dialog" aria-modal="true" aria-label="Edit ${titleSlot}">
        <header class="embed-editor-head">
          <span class="embed-editor-spark" aria-hidden="true">&#10022;</span>
          <h2 class="embed-editor-title">${titleVerb} ${titleSlot} <span class="embed-editor-from">from ${escape(desc.name)}</span></h2>
          <button type="button" class="embed-editor-close" aria-label="Close">&times;</button>
        </header>
        <div class="embed-editor-body">
          <div class="embed-editor-form">
            <div class="tool-inputs ee-inputs"></div>
          </div>
          <div class="embed-editor-side">
            <div class="asset-picker-toolcard-controls">
              <label>Format <select class="ee-format" aria-label="Render format">${fmtOptions}</select></label>
              <label>Width <input type="number" class="ee-w" min="1" inputmode="numeric" placeholder="auto" value="${desc.width ?? ''}"></label>
              <label>Height <input type="number" class="ee-h" min="1" inputmode="numeric" placeholder="auto" value="${desc.height ?? ''}"></label>
            </div>
            <div class="asset-picker-toolcard-preview ee-preview"><div class="asset-picker-loading">Rendering…</div></div>
            <div class="embed-editor-actions">
              <button type="button" class="ee-cancel">Cancel</button>
              <button type="button" class="ee-apply" disabled>${applyLabel}</button>
            </div>
          </div>
        </div>
      </div>`;
    // Return focus to whatever opened the editor (the Edit button) when it closes —
    // matches the picker / export-panel convention so keyboard + AT users keep their
    // place rather than being dropped on <body> behind the (now-removed) scrim.
    const opener = document.activeElement;
    document.body.appendChild(overlay);

    // The overlay markup above was just assigned, so these all exist.
    const inputsEl  = overlay.querySelector<PanelContainer>('.ee-inputs')!;
    const fmtSel    = overlay.querySelector<HTMLSelectElement>('.ee-format')!;
    const wEl       = overlay.querySelector<HTMLInputElement>('.ee-w')!;
    const hEl       = overlay.querySelector<HTMLInputElement>('.ee-h')!;
    const previewEl = overlay.querySelector<HTMLElement>('.ee-preview')!;
    const applyBtn  = overlay.querySelector<HTMLButtonElement>('.ee-apply')!;
    // Move focus into the dialog so it's not stranded on the obscured Edit trigger.
    overlay.querySelector<HTMLElement>('.embed-editor-close')?.focus();

    let pending: AssetRef | null = null;   // the AssetRef "Re-apply" will commit
    let renderSeq = 0;    // drop a stale render when controls change again

    // The embed panel's OWN gesture state + baseline live inside this instance
    // (finding 6): a slider/block drag here never touches the main sidebar panel.
    const panel = createInputPanel({ container: inputsEl, runtime: childRuntime, history: childHistory, host, onDirty: () => {} });

    // Re-serialise the child's inputs to a canonical embed URL and re-render the
    // preview. width/height/unit/dpi ride in opts (not the query). We use the engine's
    // LOSSLESS serializeUrlState — NOT buildShareParams, which is the share-LINK
    // serialiser and silently drops scalars >150 chars, user/ assets and big block
    // arrays. The original paste keeps the query verbatim, so the edit flow must too,
    // or a long input (e.g. a QR `url`) would revert to default on re-apply and corrupt
    // the asset. Reserved width/height inputs that serializeUrlState emits are skipped
    // on re-parse; the effective size is carried via the opts below. renderUrl mints the id.
    const renderPreview = async (): Promise<void> => {
      const seq = ++renderSeq;
      pending = null;
      applyBtn.disabled = true;
      previewEl.innerHTML = `<div class="asset-picker-loading">Rendering…</div>`;
      const query = serializeUrlState(childRuntime.getModel());
      const url = buildEmbedUrl({ toolId: parsed.toolId, format: fmtSel.value, query });
      const ref = url ? await renderUrl(url, {
        format: asExportFormat(fmtSel.value),
        width:  parseInt(wEl.value, 10) || undefined,
        height: parseInt(hEl.value, 10) || undefined,
        unit:   desc.unit ?? undefined,
        dpi:    desc.dpi ?? undefined,
      }).catch(() => null) : null;
      if (seq !== renderSeq) return; // a newer change supersedes this render
      if (!ref) {
        previewEl.innerHTML = `<p class="asset-picker-error">Couldn't render this — the inputs may be too large to re-apply as a link.</p>`;
        return;
      }
      pending = ref;
      previewEl.innerHTML = `<img class="asset-picker-toolcard-img" src="${escape(ref.url)}" alt="Preview of the ${escape(desc.name)} render">`;
      applyBtn.disabled = false;
    };

    let debounce: ReturnType<typeof setTimeout> | undefined;
    const schedulePreview = (): void => { clearTimeout(debounce); debounce = setTimeout(renderPreview, 300); };

    // The child runtime drives the source tool's input panel (the very same
    // renderInputs/syncInputs path as the main sidebar). subscribe fires once
    // immediately (initial render + first preview) and on every later change.
    childRuntime.subscribe(({ model }) => {
      panel.render(model);
      schedulePreview();
    });

    const close = (value: AssetRef | null): void => {
      clearTimeout(debounce);
      renderSeq++; // invalidate any in-flight preview render so it can't write to the detached overlay
      document.removeEventListener('keydown', onKey);
      // Drop the panel's document-level capture listeners + flatpickr calendars so
      // the detached overlay tree isn't pinned alive (mirrors mountTool's cleanup).
      panel.destroy();
      overlay.remove();
      if (opener instanceof HTMLElement) opener.focus();
      resolve(value);
    };
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') { e.preventDefault(); close(null); } };
    document.addEventListener('keydown', onKey);

    overlay.querySelector('.embed-editor-backdrop')!.addEventListener('click', () => close(null));
    overlay.querySelector('.embed-editor-close')!.addEventListener('click', () => close(null));
    overlay.querySelector('.ee-cancel')!.addEventListener('click', () => close(null));
    applyBtn.addEventListener('click', () => { if (pending) close(pending); });
    fmtSel.addEventListener('change', () => { void renderPreview(); });
    wEl.addEventListener('input', schedulePreview);
    hEl.addEventListener('input', schedulePreview);
  });
}
