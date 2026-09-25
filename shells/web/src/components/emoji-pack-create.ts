// SPDX-License-Identifier: MPL-2.0
/** A small authoring form for partial Unicode replacements and named custom symbols. */
import type { EmojiAPI } from '@lolly-tools/core/host-v1';
import type { EmojiSetInfoV1 } from '@lolly-tools/core/emoji-v1';
import { mountModal } from './modal.ts';
import { escape as esc } from '../utils.ts';
import { t, tRaw } from '../i18n.ts';
import './emoji-pack-create.css';

export function mountEmojiPackCreate(root: HTMLElement, api: EmojiAPI, installed: (info: EmojiSetInfoV1) => void): void {
  if (!api.install) return;
  const button = document.createElement('button'); button.type = 'button'; button.textContent = tRaw('Create emoji set'); root.append(button);
  button.addEventListener('click', () => { void open(); });
  async function open(): Promise<void> {
    const { licenceProfiles } = await import('../../../../engine/src/rights-profiles.ts');
    const licenses = licenceProfiles().filter(profile => profile.reviewed && profile.redistributeSource === 'permitted-with-notices');
    const artId = `emoji-create-art-${Math.random().toString(36).slice(2, 8)}`;
    const modal = mountModal(`<form class="emoji-pack-create-form field-stack">
      <h2 class="modal-title">${t('Create emoji set')}</h2>
      <label class="field-row">${t('Set name')}<input name="family" required maxlength="128" class="field-input"></label>
      <label class="field-row">${t('Set ID')}<input name="id" required pattern="user/[a-z0-9/-]+" value="user/emoji/my-set" class="field-input"></label>
      <label class="field-row">${t('Version')}<input name="version" required value="1.0.0" class="field-input"></label>
      <label class="field-row">${t('Creator')}<input name="creator" required class="field-input"></label>
      <label class="field-row">${t('Source URL')}<input name="source" type="url" required class="field-input"></label>
      <label class="field-row">${t('Licence')}<select name="license" class="field-select">${licenses.map(profile => `<option value="${esc(profile.id)}">${esc(profile.name)}</option>`).join('')}</select></label>
      <label class="field-row">${t('Source notices')}<textarea name="notices" required class="field-input"></textarea></label>
      <p>${t('Name Unicode replacement files with their code points, such as 1f600.svg. Other filenames become labelled custom symbols in your asset library. Choose a fallback set for emoji you do not replace.')}</p>
      <div class="field-row">
        <span class="field-label" id="${artId}">${t('SVG artwork')}</span>
        <button type="button" class="btn" id="${artId}-choose" aria-labelledby="${artId} ${artId}-choose">${t('Choose SVG files…')}</button>
        <input name="art" type="file" accept=".svg,image/svg+xml" multiple required class="visually-hidden" tabindex="-1" aria-hidden="true">
      </div>
      <p role="status" data-status></p>
      <div class="modal-actions">
        <button type="button" class="btn modal-cancel" data-cancel>${t('Cancel')}</button>
        <button type="submit" class="btn modal-primary">${t('Create set')}</button>
      </div>
    </form>`, { className: 'modal', ariaLabel: tRaw('Create emoji set') });
    const status = modal.el.querySelector<HTMLElement>('[data-status]')!;
    const artInput = modal.el.querySelector<HTMLInputElement>('[name=art]')!;
    const artChoose = modal.el.querySelector<HTMLButtonElement>(`#${artId}-choose`)!;
    artChoose.addEventListener('click', () => artInput.click());
    artInput.addEventListener('change', () => {
      const count = artInput.files?.length ?? 0;
      status.textContent = count ? tRaw('{count} files chosen', { count }) : '';
    });
    modal.el.querySelector('[data-cancel]')!.addEventListener('click', () => modal.close());
    modal.el.querySelector('form')!.addEventListener('submit', event => {
      event.preventDefault(); const form = event.currentTarget as HTMLFormElement;
      const submit = form.querySelector<HTMLButtonElement>('[type=submit]')!; submit.disabled = true;
      status.textContent = tRaw('Checking emoji artwork…');
      void (async () => {
        const data = new FormData(form); const field = (name: string) => String(data.get(name) ?? '').trim();
        const profile = licenses.find(item => item.id === field('license'))!;
        const files = Array.from(artInput.files ?? []);
        if (!files.length || files.length > 4096 || files.some(file => file.size > 2 * 1024 * 1024) || files.reduce((sum, file) => sum + file.size, 0) > 48 * 1024 * 1024) throw new Error(tRaw('The artwork exceeds the emoji import limit.'));
        const { buildEmojiBundle } = await import('../../../../engine/src/emoji-author.ts');
        const glyphs = await Promise.all(files.map(async file => {
          const name = file.name.replace(/\.svg$/i, '').toLowerCase();
          const meaning = /^[0-9a-f]{4,6}(?:-[0-9a-f]{4,6})*$/.test(name) ? { kind: 'unicode' as const, key: name }
            : { kind: 'custom' as const, id: `${field('id')}/symbols/${name.replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '')}` };
          return { meaning, label: file.name.replace(/\.svg$/i, '').replace(/[-_]/g, ' '), svg: await file.text() };
        }));
        const bundle = await buildEmojiBundle({ id: field('id'), family: field('family'), style: 'Custom', version: field('version'),
          source: { creator: field('creator'), sourceUrl: field('source'), revision: field('version'), license: profile.id, licenseUrl: profile.url,
            attribution: field('creator'), modifications: [] }, notices: [{ name: 'Source notices', text: field('notices') }], glyphs }, api.parseXml as Parameters<typeof buildEmojiBundle>[1]);
        const info = await api.install!(new TextEncoder().encode(JSON.stringify(bundle)));
        installed(info); modal.close();
      })().catch(error => { status.textContent = String(error instanceof Error ? error.message : error); }).finally(() => { submit.disabled = false; });
    });
  }
}
