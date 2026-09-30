// SPDX-License-Identifier: MPL-2.0
import { mountModal, type ModalHandle } from '../../components/modal.ts';
import { tRaw } from '../../i18n.ts';
import type { StudioState } from './studio-state.ts';
import type { BrandAdoptionAPI } from '../../bridge/brand-adoption.ts';
import { switchDesignSystem, type SwitchHost } from './switch.ts';

/** Recover token settings through the studio's existing checkpoint store. */
export function mountCheckpointRecovery(studio: StudioState, refresh: () => Promise<void>, host?: SwitchHost & { brandAdoption?: BrandAdoptionAPI }): ModalHandle<void> {
  const title = tRaw('Restore brand settings');
  const modal = mountModal('', { className: 'modal', ariaLabel: title });
  const heading = document.createElement('h2');
  heading.className = 'modal-title';
  heading.textContent = title;
  const description = document.createElement('p');
  description.className = 'modal-msg';
  description.textContent = tRaw('Choose a checkpoint to restore your colours, type settings and other brand tokens. Your current settings are saved first. Font and image files are kept as they are.');
  const label = document.createElement('label');
  label.className = 'field-row';
  label.textContent = tRaw('Checkpoint');
  const select = document.createElement('select');
  select.className = 'field-select';
  label.append(select);
  const status = document.createElement('p');
  status.className = 'modal-msg';
  status.setAttribute('role', 'status');
  const actions = document.createElement('div');
  actions.className = 'modal-actions';
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.className = 'btn';
  retry.textContent = tRaw('Try again');
  retry.hidden = true;
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'btn';
  cancel.textContent = tRaw('Close');
  const restore = document.createElement('button');
  restore.type = 'button';
  restore.className = 'btn modal-primary';
  restore.textContent = tRaw('Restore checkpoint');
  restore.disabled = true;
  actions.append(retry, cancel, restore);
  const checkpointsPanel = document.createElement('details');
  const checkpointsTitle = document.createElement('summary');
  checkpointsTitle.textContent = tRaw('Restore an earlier checkpoint');
  checkpointsPanel.append(checkpointsTitle, description, label);
  checkpointsPanel.open = true;
  modal.el.append(heading, checkpointsPanel, status, actions);
  const undoImport = document.createElement('button');
  undoImport.type = 'button';
  undoImport.className = 'btn modal-primary';
  undoImport.textContent = tRaw('Undo last import');
  undoImport.hidden = true;
  actions.append(undoImport);
  const importNote = document.createElement('p');
  importNote.className = 'modal-msg';
  importNote.hidden = true;
  heading.after(importNote);
  cancel.focus();
  let busy = false;
  let hasImportRecovery = false;

  async function load(): Promise<void> {
    retry.hidden = true;
    restore.disabled = true;
    select.disabled = true;
    status.textContent = tRaw('Loading…');
    try {
      const activeId = await host?.designSystems.activeId();
      const available = activeId && await host?.brandAdoption?.recovery(activeId);
      hasImportRecovery = !!available;
      undoImport.hidden = importNote.hidden = !available;
      if (available) importNote.textContent = tRaw('Undo the last import to return to {name} and its previous file references. Imported files stay in your library.', { name: available.label });
      checkpointsPanel.open = !available;
      restore.hidden = !!available;
      const checkpoints = await studio.listCheckpoints();
      if (!modal.el.isConnected) return;
      select.replaceChildren(...checkpoints.reverse().map(checkpoint => {
        const option = document.createElement('option');
        option.value = checkpoint.id;
        const date = new Date(checkpoint.date);
        option.textContent = `${checkpoint.label} · ${Number.isNaN(date.getTime()) ? checkpoint.date : date.toLocaleString()}`;
        return option;
      }));
      select.disabled = restore.disabled = !checkpoints.length;
      checkpointsPanel.hidden = !!available && !checkpoints.length;
      status.textContent = checkpoints.length || available ? '' : tRaw('No checkpoints yet. Lolly saves one before an import or a change that replaces brand settings.');
    } catch {
      if (!modal.el.isConnected) return;
      status.textContent = tRaw('Could not load checkpoints. Try again.');
      retry.hidden = false;
    }
  }
  checkpointsPanel.addEventListener('toggle', () => {
    restore.hidden = !checkpointsPanel.open;
    undoImport.hidden = !hasImportRecovery || checkpointsPanel.open;
  });

  restore.addEventListener('click', async () => {
    if (busy || !select.value) return;
    busy = true;
    restore.disabled = select.disabled = true;
    const id = select.value;
    status.textContent = tRaw('Restoring…');
    try {
      await studio.load();
      if (!await studio.restoreCheckpoint(id, tRaw('Before restore'))) throw new Error('Checkpoint unavailable');
      try { await refresh(); }
      catch {
        if (modal.el.isConnected) status.textContent = tRaw('Brand settings restored. Reopen Make it yours to refresh the view.');
        return;
      }
      if (!modal.el.isConnected) return;
      await load();
      status.textContent = tRaw('Brand settings restored. To reverse this, restore “Before restore”.');
    } catch {
      if (modal.el.isConnected) status.textContent = tRaw('Could not restore this checkpoint. Your saved checkpoints are kept. Try again.');
    } finally {
      busy = false;
      select.disabled = restore.disabled = !select.options.length;
    }
  });
  undoImport.addEventListener('click', async () => {
    if (busy || !host?.brandAdoption) return;
    busy = true;
    undoImport.disabled = restore.disabled = true;
    status.textContent = tRaw('Restoring the previous design system…');
    try {
      const previous = await host.designSystems.active();
      await host.brandAdoption.restore(previous.id);
      await switchDesignSystem(host, await host.designSystems.activeId(), { previous, route: 'start' });
      modal.close();
    } catch (error) {
      status.textContent = String((error as Error).message);
    } finally { busy = false; undoImport.disabled = false; restore.disabled = !select.options.length; }
  });
  retry.addEventListener('click', () => { void load(); });
  cancel.addEventListener('click', () => modal.close());
  void load();
  return modal;
}
