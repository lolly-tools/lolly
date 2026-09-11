// SPDX-License-Identifier: MPL-2.0
import './kit-panel.css';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { InputValue } from '../../../../engine/src/inputs.ts';
import { fetchTemplateFile } from '../lib/template-source.ts';
import { t, tRaw } from '../i18n.ts';
import { escape as escapeHtml } from '../utils.ts';
import { getTool, renderRowToBlob } from './render-export.ts';
import { applyKit, boundValue, captureKitEdits, createKitRows, kitIssues, kitRowIssues, parseKitDefinition } from './kit-model.ts';
import type { KitState, KitRow } from './kit-model.ts';

interface KitBatch<R extends KitRow> { kit?: KitState; rows: R[]; running: boolean; zipName: string }
export interface KitPanel { refresh(): void; dispose(): void; validate(): Promise<string[]>; isBusy(): boolean }

/** One brief panel, with the existing batch grid and renderer as its editor/exporter. */
export function mountKitPanel<R extends KitRow>(
  root: HTMLElement, host: HostV1, state: KitBatch<R>,
  deps: { newRow(): R; changed(): void; save(): void },
): KitPanel {
  const panel = root.querySelector<HTMLElement>('#pro-kit-host')!;
  const trigger = root.querySelector<HTMLButtonElement>('#pro-event-kit')!;
  let active = true, busy = false, generation = 0, error = '', fresh = false;
  const previews = new Map<string, string>();
  let displayedKit: KitState | undefined;
  let renderedValues = '';
  const clearPreviews = (): void => { for (const url of previews.values()) URL.revokeObjectURL(url); previews.clear(); fresh = false; };
  const failure = (e: unknown): void => { error = e instanceof Error ? e.message : String(e); paint(); };
  const issues = (): string[] => {
    const kit = state.kit;
    if (!kit) return [];
    return [...new Set([...kitIssues(kit), ...kitRowIssues(kit, state.rows)])];
  };
  const dependencies = async (): Promise<string[]> => {
    const kit = state.kit;
    if (!kit) return [];
    const messages: string[] = [];
    const seen = new Set<string>();
    for (const output of kit.definition.outputs) {
      const row = state.rows.find(row => row.kitOutputId === output.id);
      if (!row) continue;
      for (const binding of output.bindings) {
        const field = kit.definition.fields.find(field => field.id === binding.field)!;
        if (field.type !== 'asset') continue;
        const ref = boundValue(row, binding);
        const id = typeof ref === 'string' ? ref : ref && typeof ref === 'object' && 'id' in ref ? String(ref.id) : '';
        if (!id || seen.has(id)) continue;
        seen.add(id);
        let available = false;
        try { available = !!await host.assets.get(id); } catch { /* missing local bytes or an unavailable catalog */ }
        if (!available) messages.push(`${field.label} is unavailable on this device. Check your connection, choose it again or remove it.`);
      }
    }
    return messages;
  };
  const paint = (): void => {
    if (!active) return;
    const kit = state.kit;
    if (displayedKit !== kit) { clearPreviews(); generation++; displayedKit = kit; }
    const values = JSON.stringify(state.rows.filter(row => row.kitOutputId).map(row => [row.values, row.format, row.outWidth, row.outHeight, row.unit]));
    if (values !== renderedValues) { fresh = false; generation++; renderedValues = values; }
    if (kit) captureKitEdits(kit, state.rows);
    trigger.disabled = busy || state.running;
    panel.hidden = !kit && !error;
    if (!kit) { panel.textContent = error; return; }
    const frozen = busy || state.running;
    const messages = [error, ...issues()].filter(Boolean);
    const opened = new Set([...panel.querySelectorAll<HTMLDetailsElement>('details[open]')].map(el => el.dataset.kitOutput));
    const focused = document.activeElement;
    const focusKey = focused instanceof HTMLInputElement && panel.contains(focused)
      ? ['kitField', 'kitOverride', 'kitLink'].find(key => focused.dataset[key]) : undefined;
    const focusValue = focusKey && focused instanceof HTMLInputElement ? focused.dataset[focusKey] : undefined;
    const scrollTop = panel.scrollTop;
    panel.innerHTML = `<div class="kit-heading"><div><h2>${escapeHtml(kit.definition.name)}</h2><p>${t('One brief for your poster, social card and QR code. Outputs follow the active brand.')}</p></div>
      <button type="button" class="btn btn--ghost btn--sm" data-kit-action="save">${t('Save kit…')}</button></div>
      <div class="kit-fields">${kit.definition.fields.map(f => {
        const value = kit.brief[f.id];
        if (f.type === 'asset') return `<div class="kit-field"><span>${escapeHtml(t(f.label))}</span><button type="button" class="btn btn--ghost" data-kit-logo="${f.id}" ${frozen ? 'disabled' : ''}>${value ? t('Change logo…') : t('Choose logo…')}</button>${value ? `<button type="button" class="btn btn--ghost btn--sm" data-kit-clear="${f.id}">${t('Remove logo')}</button>` : ''}</div>`;
        return `<label class="kit-field">${escapeHtml(t(f.label))}<input class="field-input" data-kit-field="${f.id}" type="${f.type === 'url' ? 'url' : 'text'}" value="${escapeHtml(typeof value === 'string' ? value : '')}" ${f.required ? 'required' : ''} ${frozen ? 'disabled' : ''}></label>`;
      }).join('')}</div>
      <p class="kit-hint">${t('Dates are printed exactly as entered. Text shrinks to fit; preview before printing. Editing a linked field in the grid unlinks that field.')}</p>
      <p class="kit-hint">${t('Save kit keeps the editable brief on this device. Share the downloaded files.')}</p>
      <div class="kit-actions"><button type="button" class="btn btn--primary" data-kit-action="preview" ${frozen || messages.length ? 'disabled' : ''}>${busy ? t('Preparing previews…') : t('Preview all')}</button><button type="button" class="btn btn--ghost" data-kit-action="rows">${t('Show or hide batch rows')}</button></div>
      <p role="status" class="kit-status">${messages.map(escapeHtml).join(' ')} ${previews.size ? (fresh ? t('Previews are up to date.') : t('Details changed. Refresh the previews.')) : ''}</p>
      <div class="kit-outputs">${kit.definition.outputs.map(o => {
        const row = state.rows.find(r => r.kitOutputId === o.id);
        const url = previews.get(o.id);
        return `<article><h3>${escapeHtml(t(o.name))}</h3><p>${escapeHtml(o.format.toUpperCase())} · ${o.width} × ${o.height} ${o.unit}</p>${url ? `<img src="${url}" alt="${escapeHtml(tRaw('Preview of {name}', { name: o.name }))}">` : `<div class="kit-preview-empty">${t('Preview your output')}</div>`}<details data-kit-output="${o.id}" ${opened.has(o.id) ? 'open' : ''}><summary>${t('Shared fields')}</summary>${o.bindings.map(b => {
          const f = kit.definition.fields.find(f => f.id === b.field)!;
          const detached = kit.detached[o.id]?.includes(b.field);
          let current: InputValue = '';
          try { if (row) current = boundValue(row, b); } catch { /* issues names the missing slot */ }
          return `<label><input type="checkbox" data-kit-link="${o.id}/${b.field}" ${detached ? '' : 'checked'} ${frozen ? 'disabled' : ''}> ${escapeHtml(t(f.label))}</label>${detached && f.type !== 'asset' ? `<input class="field-input" aria-label="${escapeHtml(tRaw('{output}: {field}', { output: o.name, field: f.label }))}" data-kit-override="${o.id}/${b.field}" value="${escapeHtml(typeof current === 'string' ? current : '')}" ${frozen ? 'disabled' : ''}>` : ''}`;
        }).join('')}</details></article>`;
      }).join('')}</div>`;
    if (focusKey && focusValue) {
      const next = [...panel.querySelectorAll<HTMLInputElement>('input')].find(input => input.dataset[focusKey] === focusValue);
      next?.focus({ preventScroll: true });
    }
    panel.scrollTop = scrollTop;
  };
  const edit = (fn: (kit: KitState) => void): void => {
    if (!state.kit || busy || state.running) return;
    try {
      captureKitEdits(state.kit, state.rows);
      fn(state.kit); applyKit(state.kit, state.rows);
      fresh = false; generation++; error = ''; deps.changed(); paint();
    } catch (e) { failure(e); }
  };
  const onChange = (event: Event): void => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    if (input.dataset.kitField) edit(kit => { kit.brief[input.dataset.kitField!] = input.value; });
    else if (input.dataset.kitLink) edit(kit => {
      const [output, field] = input.dataset.kitLink!.split('/') as [string, string];
      const detached = kit.detached[output] ?? [];
      kit.detached[output] = input.checked ? detached.filter(f => f !== field) : [...new Set([...detached, field])];
    });
    else if (input.dataset.kitOverride) {
      const [output, field] = input.dataset.kitOverride.split('/');
      const o = state.kit?.definition.outputs.find(o => o.id === output);
      const row = state.rows.find(r => r.kitOutputId === output), b = o?.bindings.find(b => b.field === field);
      if (!row || !b) return;
      if (b.box) {
        const boxes = row.values[b.input];
        if (Array.isArray(boxes)) { const box = boxes.find(v => v && typeof v === 'object' && 'id' in v && v.id === b.box); if (box && typeof box === 'object') (box as Record<string, InputValue>)[b.property!] = input.value; }
      } else row.values[b.input] = input.value;
      fresh = false; generation++; deps.changed();
    }
  };
  const preview = async (): Promise<void> => {
    const kit = state.kit;
    if (!kit || busy || issues().length) return;
    const run = ++generation; busy = true; error = ''; paint();
    try {
      const missing = await dependencies();
      if (missing.length) throw new Error(missing.join(' '));
      for (const o of kit.definition.outputs) {
        const row = state.rows.find(r => r.kitOutputId === o.id)!;
        const { blob } = await renderRowToBlob(row, host, { format: 'png', width: row.outWidth, height: row.outHeight, unit: row.unit as 'px' | 'mm', dpi: 96, embedMeta: false });
        if (!active || generation !== run) return;
        const prior = previews.get(o.id); if (prior) URL.revokeObjectURL(prior);
        previews.set(o.id, URL.createObjectURL(blob)); paint();
      }
      fresh = true;
    } catch (e) { if (active && generation === run) error = e instanceof Error ? e.message : String(e); }
    finally { busy = false; if (active) paint(); }
  };
  const onClick = (event: Event): void => {
    const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button') : null;
    if (!target || target.disabled) return;
    const action = target.dataset.kitAction;
    if (action === 'save') deps.save();
    if (action === 'rows') root.classList.toggle('kit-hide-rows');
    if (action === 'preview') void preview();
    if (target.dataset.kitClear) edit(kit => { kit.brief[target.dataset.kitClear!] = ''; });
    if (target.dataset.kitLogo) {
      const kit = state.kit;
      void host.assets.pick({ title: t('Choose logo'), allowUpload: true }).then(ref => {
        if (ref && active && state.kit === kit) { if (!['vector', 'raster'].includes(ref.type)) throw new Error('Choose a vector or raster image for the logo.'); edit(k => { k.brief[target.dataset.kitLogo!] = ref; }); }
      }).catch(failure);
    }
  };
  const start = async (): Promise<void> => {
    if (state.kit) { panel.scrollIntoView({ block: 'start' }); return; }
    busy = true; error = ''; paint();
    try {
      const file = await fetchTemplateFile('design', 'event-kit');
      const definition = parseKitDefinition(file?.kit);
      const manifests = new Map<string, Awaited<ReturnType<typeof getTool>>['manifest']>();
      for (const id of new Set(definition.outputs.map(o => o.toolId))) manifests.set(id, (await getTool(id)).manifest);
      if (!active) return;
      const made = createKitRows(definition, manifests);
      state.kit = made.kit;
      state.rows = [...state.rows.filter(r => r.toolId), ...made.rows.map(r => Object.assign(deps.newRow(), r))];
      state.zipName ||= 'event-kit';
      root.classList.add('kit-hide-rows'); deps.changed();
    } catch (e) { failure(e); }
    finally { busy = false; paint(); }
  };
  panel.addEventListener('change', onChange); panel.addEventListener('click', onClick);
  trigger.addEventListener('click', start);
  const brandChanged = (): void => { generation++; clearPreviews(); paint(); };
  window.addEventListener('lolly:design-system-changed', brandChanged);
  return { refresh: paint, async validate() {
    busy = true; paint();
    try { const found = issues(); const all = found.length ? found : await dependencies(); error = all.join(' '); return all; }
    catch (e) { return [e instanceof Error ? e.message : String(e)]; }
    finally { busy = false; paint(); }
  }, isBusy: () => busy, dispose() { active = false; generation++; clearPreviews(); panel.removeEventListener('change', onChange); panel.removeEventListener('click', onClick); trigger.removeEventListener('click', start); window.removeEventListener('lolly:design-system-changed', brandChanged); } };
}
