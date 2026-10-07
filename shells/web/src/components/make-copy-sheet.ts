// SPDX-License-Identifier: MPL-2.0
/**
 * The "Make a copy" sheet (plan 75 J5 step 6 and section 5.16): someone who may only
 * view a document keeps their own changes by copying it, either on this device or into
 * a project they can edit. The second choice is offered only when there is such a
 * project, so the sheet never offers a place the copy cannot go.
 *
 * Built on mountModal (components/modal.ts) like the other app dialogs, with the
 * shared `.modal` chrome. The copy itself is the caller's (org/team-scope.ts): this
 * file asks where, waits for the caller to make it, and shows the caller's sentence
 * when it could not.
 */
import { escape as escapeHtml } from '../utils.ts';
import { t, tRaw } from '../i18n.ts';
import { mountModal } from './modal.ts';

export interface MakeCopyProject {
  id: string;
  name: string;
}

export type MakeCopyChoice = { where: 'device' } | { where: 'project'; projectId: string };

export interface MakeCopySheetOptions {
  /** The line under the choices ("The copy is separate. Changes to the copy don't
   *  reach Brand refresh."). Plain text. */
  note: string;
  /** Projects the copy may go to. May resolve after the sheet opens; none hides the
   *  "In a project you can edit" choice. */
  projects: Promise<readonly MakeCopyProject[]> | readonly MakeCopyProject[];
  /** Make the copy. Resolves null when it was made, or a plain-text sentence saying
   *  why not, which the sheet shows while staying open. */
  make(choice: MakeCopyChoice): Promise<string | null>;
}

/** Open the sheet. Resolves true when a copy was made, false when the person left. */
export function openMakeCopySheet(opts: MakeCopySheetOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const title = t('Make a copy');
    const content = `
      <h2 class="modal-title">${title}</h2>
      <fieldset class="make-copy-choices" style="border:0;margin:0 0 12px;padding:0;display:flex;flex-direction:column;gap:8px">
        <legend class="modal-msg" style="margin-bottom:8px">${t('Where should the copy go?')}</legend>
        <label class="make-copy-option" style="display:flex;align-items:center;gap:8px;min-height:32px">
          <input type="radio" name="make-copy-where" value="device" checked> ${t('On this device')}
        </label>
        <label class="make-copy-option" data-project-option hidden style="display:flex;align-items:center;gap:8px;min-height:32px">
          <input type="radio" name="make-copy-where" value="project"> ${t('In a project you can edit')}
        </label>
        <select class="field-select field-select--sm" data-project-select aria-label="${t('Project')}" hidden></select>
      </fieldset>
      <p class="modal-msg make-copy-note">${escapeHtml(opts.note)}</p>
      <p class="make-copy-status" role="status" hidden style="margin:0 0 12px;color:hsl(var(--destructive))"></p>
      <div class="modal-actions">
        <button type="button" class="btn modal-cancel" data-act="cancel">${t('Cancel')}</button>
        <button type="button" class="btn modal-primary" data-act="make">${t('Make copy')}</button>
      </div>`;
    let made = false;
    const modal = mountModal<boolean>(content, {
      className: 'modal make-copy-sheet',
      ariaLabel: title,
      cancelValue: false,
      initialFocus: (el) => el.querySelector<HTMLElement>('[data-act="make"]'),
      onClose: () => resolve(made),
    });
    const el = modal.el;
    const projectOption = el.querySelector<HTMLElement>('[data-project-option]')!;
    const select = el.querySelector<HTMLSelectElement>('[data-project-select]')!;
    const status = el.querySelector<HTMLElement>('.make-copy-status')!;
    const makeBtn = el.querySelector<HTMLButtonElement>('[data-act="make"]')!;
    const where = (): string => el.querySelector<HTMLInputElement>('input[name="make-copy-where"]:checked')?.value ?? 'device';
    const sync = (): void => { select.hidden = projectOption.hidden || where() !== 'project'; };
    el.addEventListener('change', sync);
    void Promise.resolve(opts.projects).then((list) => {
      if (!el.isConnected || !list.length) return;
      select.replaceChildren(...list.map((p) => {
        const o = document.createElement('option');
        o.value = p.id;
        o.textContent = p.name;
        return o;
      }));
      projectOption.hidden = false;
      sync();
    }).catch(() => { /* no projects to offer: the device copy stands alone */ });
    el.addEventListener('click', (event) => {
      const act = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-act]')?.dataset.act : undefined;
      if (act === 'cancel') { modal.close(false); return; }
      if (act !== 'make' || makeBtn.disabled) return;
      const choice: MakeCopyChoice = where() === 'project' && select.value
        ? { where: 'project', projectId: select.value }
        : { where: 'device' };
      makeBtn.disabled = true;
      status.hidden = true;
      void opts.make(choice).catch(() => tRaw('Could not save. Try again.')).then((failure) => {
        makeBtn.disabled = false;
        if (failure) {
          status.textContent = failure;
          status.hidden = false;
          return;
        }
        made = true;
        modal.close(true);
      });
    });
  });
}
