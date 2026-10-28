// SPDX-License-Identifier: MPL-2.0
/** Create editable text documents through the existing project stores. */
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { mountModal } from '../components/modal.ts';
import { t } from '../i18n.ts';
import type { WebStateAPI } from '../bridge/state.ts';
import type { FolderHost } from '../folders.ts';

export interface ProjectTextFile {
  name: string;
  inputs: { body: string; language: string; source: string; workspaceMode: string };
}

export function projectTextFile(rawName: string, format: string): ProjectTextFile {
  const base = Array.from(rawName.trim(), char => char < ' ' || char === '\x7f' || char === '/' || char === '\\' ? '-' : char).join('').replace(/\.(txt|md|markdown)$/i, '');
  if (!base || base === '.' || base === '..') throw new Error('Enter a filename.');
  const markdown = format === 'markdown';
  const name = `${base}.${markdown ? 'md' : 'txt'}`;
  return { name, inputs: { body: '', language: markdown ? 'markdown' : 'plain', workspaceMode: 'text',
    source: JSON.stringify({ name, format: markdown ? 'md' : 'txt', origin: 'Projects' }) } };
}

/** Keep the dialog open on failure so placement can retry the same saved identity. */
export function openNewFileDialog(create: (file: ProjectTextFile, stillWanted: () => boolean) => Promise<void>, current: () => boolean): () => void {
  let active = true;
  const wanted = () => active && current();
  const modal = mountModal(`<form><h2 class="modal-title">${t('New file')}</h2>
    <label>${t('Filename')}<input class="projects-name-input" data-file-name value="Untitled.txt" maxlength="180" required></label>
    <label>${t('File type')}<select class="field-select" data-file-type><option value="plain">${t('Text file (.txt)')}</option><option value="markdown">${t('Markdown file (.md)')}</option></select></label>
    <p role="status" data-file-error></p><div class="modal-actions"><button type="button" class="btn" data-cancel>${t('Cancel')}</button><button type="submit" class="btn modal-primary">${t('Create file')}</button></div></form>`,
    { className: 'modal projects-prompt', ariaLabel: t('New file'), onClose: () => { active = false; }, initialFocus: el => el.querySelector('input') });
  const input = modal.el.querySelector<HTMLInputElement>('[data-file-name]')!;
  const format = modal.el.querySelector<HTMLSelectElement>('[data-file-type]')!;
  const submit = modal.el.querySelector<HTMLButtonElement>('[type="submit"]')!;
  input.select();
  format.addEventListener('change', () => {
    input.value = input.value.replace(/\.(txt|md|markdown)$/i, '') + (format.value === 'markdown' ? '.md' : '.txt');
  });
  modal.el.querySelector('[data-cancel]')!.addEventListener('click', () => modal.close());
  modal.el.querySelector('form')!.addEventListener('submit', async event => {
    event.preventDefault();
    if (submit.disabled || !wanted()) return;
    try {
      const file = projectTextFile(input.value, format.value);
      submit.disabled = true;
      input.disabled = format.disabled = true;
      await create(file, wanted);
      modal.close();
    } catch (error) {
      if (!wanted() || !modal.el.isConnected) return;
      modal.el.querySelector('[data-file-error]')!.textContent = error instanceof Error ? error.message : String(error);
      submit.disabled = false;
      // Keep the name fixed: a retry may be placing an already saved document.
    }
  });
  return () => modal.close();
}

export function openNewLocalTextFile(host: HostV1 & FolderHost & { state: WebStateAPI }, folderId: string | null, current: () => boolean, beforeNavigate: () => void): () => void {
  let slot: string | undefined;
  return openNewFileDialog(async (file, stillWanted) => {
    const { createFolderStore } = await import('../folders.ts');
    const store = createFolderStore(host);
    if (folderId) {
      const folder = await store.get(folderId);
      if (!folder || folder.link) throw new Error('This project folder is unavailable.');
    }
    if (!slot) {
      const { getTool } = await import('../bridge/tool-loader.ts');
      const tool = await getTool('write');
      if (!stillWanted()) return;
      const savedSlot = `write:${crypto.randomUUID()}`;
      await host.state.save(savedSlot, { ...file.inputs, __label: file.name,
        __toolId: tool.manifest.id, __toolVersion: tool.manifest.version }, '');
      slot = savedSlot;
    }
    if (!stillWanted()) return;
    if (folderId) await store.moveItem(slot, folderId, 'session');
    if (!stillWanted()) return;
    beforeNavigate();
    window.location.hash = `#/tool/write?slot=${encodeURIComponent(slot)}`;
  }, current);
}
