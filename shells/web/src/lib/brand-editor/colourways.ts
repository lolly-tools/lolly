// SPDX-License-Identifier: MPL-2.0
/**
 * brand editor: the Colourways row (plans/319 A3), at the head of the Colour roles
 * wing.
 *
 * One chip per colourway, its lead colour in the mode being edited, the default one
 * marked. Choosing a chip makes it the room's editing context (`bedit.currentLead`),
 * so the roles strip, the palette and the previews below all read and write that
 * colourway; the Light/Dark switch does the same for the mode. "Add" starts a new
 * colourway from one of the palette's own colours, and the selected colourway can
 * be renamed, copied, made the default or removed.
 *
 * Every edit is a lib/design-system/leads.ts function: it clones the document and
 * the engine checks that nothing an existing choice draws has moved. The room then
 * swaps in the new document, takes an undo snapshot, saves and repaints, the same
 * steps every other Colours room edit takes.
 */
import { addLead, duplicateLead, leadsEditable, listLeads, removeLead, renameLead, setCanonicalLead } from '../design-system/leads.ts';
import type { Lead, LeadEdit } from '../design-system/leads.ts';
import type { ColourwayEdit } from '@lolly/engine';
import { nameColor } from '../color-namer.ts';
import { segHtml } from '../seg.ts';
import { t, tRaw } from '../../i18n.ts';
import { escape as escapeText } from '../../utils.ts';
import { announce } from '../../a11y.ts';
import { playSfx } from '../sfx.ts';
import { bindOp, type BrandEditorCtx } from './context.ts';

/** The lead colour of `lead` in the mode being edited. */
const leadHex = (bedit: BrandEditorCtx, lead: Lead): string =>
  lead.colours[bedit.state.editContext().mode]?.primary || lead.colours.light?.primary || '';

/** The colourway the room edits: the chosen one, else the default. */
const editingLead = (bedit: BrandEditorCtx): Lead | undefined => {
  const leads = listLeads(bedit.doc);
  return leads.find((l) => l.id === bedit.currentLead) ?? leads.find((l) => l.canonical);
};

/** A colourway's display name in `doc`. */
const nameOf = (doc: unknown, id: string | undefined): string => listLeads(doc).find((l) => l.id === id)?.name ?? '';

/** The colourways as chips. A design system with one lead shows that lead, unnamed
 *  until a second one exists, so "Add" always has something to sit beside. */
function chipsHtml(bedit: BrandEditorCtx, leads: Lead[], editing: string | null): string {
  if (!leads.length) {
    const hex = bedit.derive.primaryHex();
    const name = hex ? nameColor(hex) : t('Default');
    return `<span class="be-lead" aria-current="true"><span class="be-lead-dot" style="background:${escapeText(hex)}"></span><span class="be-lead-name">${escapeText(name)}</span></span>`;
  }
  return leads.map((lead) => {
    const on = lead.id === editing;
    return `<button type="button" class="be-lead" data-be-lead="${escapeText(lead.id)}" aria-pressed="${on}" data-sfx="select">`
      + `<span class="be-lead-dot" style="background:${escapeText(leadHex(bedit, lead))}"></span>`
      + `<span class="be-lead-name">${escapeText(lead.name)}</span>`
      + `${lead.canonical ? `<span class="be-lead-badge">${t('Default')}</span>` : ''}</button>`;
  }).join('');
}

/** The palette's own colours, as the starting points for a new colourway. */
function picksHtml(bedit: BrandEditorCtx): string {
  const seen = new Set<string>();
  return bedit.swatches.filter((s) => s.hex && s.kind !== 'semantic' && !seen.has(s.hex) && seen.add(s.hex))
    .slice(0, 48)
    .map((s) => `<button type="button" class="be-lead-pick" data-be-lead-pick="${escapeText(s.hex)}" title="${escapeText(s.name)}" aria-label="${escapeText(s.name)}" style="background:${escapeText(s.hex)}"></button>`)
    .join('');
}

/** The selected colourway's own actions. The default one can be renamed and copied,
 *  but not removed or made the default again. */
function actionsHtml(lead: Lead, count: number): string {
  return `<div class="be-lead-actions">
      <label class="be-lead-rename"><span class="visually-hidden">${t('Name')}</span>
        <input type="text" class="field-input" data-be-lead-name value="${escapeText(lead.name)}" autocomplete="off" spellcheck="false"></label>
      <button type="button" class="be-btn be-btn--sm" data-be-lead-act="duplicate">${t('Duplicate')}</button>
      ${lead.canonical ? '' : `<button type="button" class="be-btn be-btn--sm" data-be-lead-act="canonical">${t('Make default')}</button>`}
      ${lead.canonical || count < 2 ? '' : `<button type="button" class="be-btn be-btn--sm" data-be-lead-act="remove" data-sfx="delete">${t('Remove')}</button>`}
    </div>`;
}

export function renderColourways(bedit: BrandEditorCtx): void {
  const mount = bedit.leadsMount;
  if (!mount || !bedit.doc) return;
  const leads = listLeads(bedit.doc);
  // The context may name a colourway an undo or a removal took away.
  if (bedit.currentLead && !leads.some((l) => l.id === bedit.currentLead)) bedit.currentLead = null;
  const selected = leads.find((l) => l.id === bedit.currentLead) ?? leads.find((l) => l.canonical) ?? null;
  const editing = selected?.id ?? null;
  const editable = leadsEditable(bedit.doc);
  const mode = bedit.state.editContext().mode;
  const adding = mount.dataset.adding === 'true';
  mount.innerHTML = `
    <div class="be-leads-head">
      <span class="be-leads-title">${t('Colourways')}</span>
      ${segHtml('lead-mode', [{ id: 'light', label: t('Light') }, { id: 'dark', label: t('Dark') }], mode, t('Mode'), { attr: 'data-be-lead-mode' })}
    </div>
    <div class="be-leads-row" role="group" aria-label="${escapeText(t('Colourways'))}">
      ${chipsHtml(bedit, leads, editing)}
      ${editable.ok && !bedit.locked ? `<button type="button" class="be-btn be-btn--sm" data-be-lead-add aria-expanded="${adding}">+ ${t('Add')}</button>` : ''}
    </div>
    ${adding ? `<div class="be-lead-add"><p class="be-lead-add-hint">${t('Choose a colour')}</p><div class="be-lead-picks">${picksHtml(bedit)}</div></div>` : ''}
    ${selected && editable.ok && !bedit.locked ? actionsHtml(selected, leads.length) : ''}
    ${editable.ok ? '' : `<p class="be-lead-note">${escapeText(editable.reasons[0] ?? '')}</p>`}`;
}

/** Swap in an edited document: undo snapshot, save, repaint, the steps every edit takes. */
function commit(bedit: BrandEditorCtx, label: string, edit: ColourwayEdit | LeadEdit, select?: string | null): boolean {
  if (!edit.ok) {
    announce(edit.reasons[0] ?? label, { assertive: true });
    renderColourways(bedit);
    return false;
  }
  bedit.state.pushUndo(label);
  bedit.doc = edit.doc;
  if (select !== undefined) bedit.currentLead = select;
  bedit.swatchEditor.closeEditor();
  bedit.ramps.repaintPalette();
  bedit.state.persist(true);
  return true;
}

/** Make `lead` (null for the default) the colourway the room edits. */
function editLead(bedit: BrandEditorCtx, lead: string | null): void {
  bedit.currentLead = lead;
  bedit.swatchEditor.closeEditor();
  bedit.ramps.repaintPalette();
  const name = lead ? nameOf(bedit.doc, lead) : '';
  if (name) announce(tRaw('Editing {name}', { name }));
}

export function wireColourways(bedit: BrandEditorCtx): void {
  const mount = bedit.ramps.$('[data-be-leads]') as HTMLElement | null;
  bedit.leadsMount = mount;
  if (!mount) return;
  bedit.paletteHooks.push(() => renderColourways(bedit));
  mount.addEventListener('click', (e) => {
    const el = e.target as HTMLElement;
    const chip = el.closest<HTMLElement>('[data-be-lead]');
    if (chip) { editLead(bedit, chip.dataset.beLead ?? null); return; }
    const mode = el.closest<HTMLElement>('[data-be-lead-mode]');
    if (mode) {
      const next = mode.dataset.beLeadMode === 'dark' ? 'dark' : 'light';
      if (next !== bedit.state.editContext().mode) { bedit.currentTheme = next; bedit.swatchEditor.closeEditor(); bedit.ramps.repaintPalette(); }
      return;
    }
    if (el.closest('[data-be-lead-add]')) {
      mount.dataset.adding = mount.dataset.adding === 'true' ? 'false' : 'true';
      renderColourways(bedit);
      mount.querySelector<HTMLElement>('[data-be-lead-pick]')?.focus();
      return;
    }
    const pick = el.closest<HTMLElement>('[data-be-lead-pick]');
    if (pick?.dataset.beLeadPick) {
      mount.dataset.adding = 'false';
      const edit = addLead(bedit.doc, { colour: pick.dataset.beLeadPick });
      const label = tRaw('{name} added', { name: edit.ok ? nameOf(edit.doc, edit.id) : '' });
      if (commit(bedit, label, edit, edit.ok ? edit.id ?? null : undefined)) { playSfx('twinkle'); announce(label); }
      return;
    }
    const act = el.closest<HTMLElement>('[data-be-lead-act]')?.dataset.beLeadAct;
    const current = editingLead(bedit);
    if (!act || !current) return;
    if (act === 'duplicate') {
      const edit = duplicateLead(bedit.doc, current.id);
      const label = tRaw('{name} added', { name: edit.ok ? nameOf(edit.doc, edit.id) : '' });
      if (commit(bedit, label, edit, edit.ok ? edit.id ?? null : undefined)) announce(label);
    } else if (act === 'canonical') {
      const label = tRaw('{name} is now the default', { name: current.name });
      if (commit(bedit, label, setCanonicalLead(bedit.doc, current.id))) announce(label);
    } else if (act === 'remove') {
      const label = tRaw('{name} removed', { name: current.name });
      if (commit(bedit, label, removeLead(bedit.doc, current.id), null)) announce(label);
    }
  });
  // Rename on Enter or when the field loses focus; Escape puts the name back.
  mount.addEventListener('change', (e) => {
    const input = (e.target as HTMLElement).closest<HTMLInputElement>('[data-be-lead-name]');
    if (!input) return;
    const current = editingLead(bedit);
    const name = input.value.trim();
    if (!current || !name || name === current.name) { if (current) input.value = current.name; return; }
    commit(bedit, t('Rename'), renameLead(bedit.doc, current.id, name));
  });
  mount.addEventListener('keydown', (e) => {
    const input = (e.target as HTMLElement).closest<HTMLInputElement>('[data-be-lead-name]');
    if (!input) return;
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { input.value = editingLead(bedit)?.name ?? input.defaultValue; input.blur(); }
  });
  renderColourways(bedit);
}

export function colourwaysOps(bedit: BrandEditorCtx) {
  return {
    renderColourways: bindOp(bedit, renderColourways),
    wireColourways: bindOp(bedit, wireColourways),
  };
}
