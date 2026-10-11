// SPDX-License-Identifier: MPL-2.0
import { requireLearningFeature } from './learning-feature.ts';
import { mountModal } from '../components/modal.ts';
import { escape as htmlEscape } from '../utils.ts';
import { getExportPolicy, exportAffordance } from './export-policy.ts';
import { videoSupport, audioSupport } from '../bridge/format-support.ts';
import { getTool } from '../bridge/tool-loader.ts';
import { createFolderStore } from '../folders.ts';
import type { PickerHost } from '../views/picker.ts';
import {
  collectLearningSelection,
  moduleFromLearningCandidates,
  type LearningSelection,
  type LearningReader,
} from './learning-selection.ts';
import { icon } from './icons.ts';
import { contentIcon, contentLabels, courseFocus } from './learning-ui.ts';
import './learning-entry.css';

export function learningReader(host: PickerHost): LearningReader {
  return {
    load: (slot) => host.state.load(slot),
    asset: (id) => host.assets.get(id),
    tool: async (id) => {
      const manifest = (await getTool(id)).manifest;
      const policy = getExportPolicy(),
        allowed = policy?.formatsFor(id);
      const video = videoSupport(),
        audio = audioSupport();
      const formats =
        exportAffordance(policy) === 'download'
          ? manifest.render.formats.filter(
              (f) =>
                (!allowed || allowed.includes(f)) &&
                (!(f in video) || video[f as keyof typeof video]) &&
                (!(f in audio) || audio[f as keyof typeof audio])
            )
          : [];
      return { ...manifest, render: { ...manifest.render, formats } };
    },
  };
}
/** Shared tool, folder and selection handoff. Nothing is silently omitted. */
export async function startLearningCourse(
  host: PickerHost,
  selection: LearningSelection
): Promise<void> {
  requireLearningFeature();
  let closed = false;
  const modal = mountModal<void>(
    '<div class="learning-dialog-content" data-learning-panel><header class="learning-modal-header"><h2>Review course content</h2></header><div class="learning-modal-body"><p role="status">Collecting selected content...</p></div><footer class="learning-modal-footer"><button type="button" class="btn btn--ghost" data-course-close>Cancel</button></footer></div>',
    {
      className: 'learning-ui learning-entry',
      ariaLabel: 'Review course content',
      onClose: () => {
        closed = true;
      },
    }
  );
  modal.el.addEventListener('click', (e) => {
    if ((e.target as Element).closest('[data-course-close]')) modal.close();
  });
  try {
    const candidates = await collectLearningSelection(selection, learningReader(host));
    if (closed) return;
    let title = selection.title || 'Learning module';
    let search = '';
    let creating = false;
    const included = new Set(candidates.map((c) => c.id));
    const matches = (c: (typeof candidates)[number]) =>
      `${c.title} ${c.section}`.toLocaleLowerCase().includes(search.toLocaleLowerCase());
    const paint = () => {
      const focus = courseFocus(modal.el, 'data-course-');
      const scroll = modal.el.querySelector('.learning-modal-body')?.scrollTop || 0;
      const picked = candidates.filter((c) => included.has(c.id));
      const unavailable = picked.filter((c) => c.problem).length;
      modal.el.querySelector('[data-learning-panel]')!.innerHTML =
        `<header class="learning-modal-header"><h2>Review course content</h2><p>Choose what to include and arrange the teaching order. You can edit the lessons next.</p></header>
        <div class="learning-modal-body"><label>Course title<input class="field-input" data-course-title value="${htmlEscape(title)}" maxlength="500" required></label>
        <div class="learning-selection-heading"><p role="status">${picked.length} selected, ${candidates.length - picked.length} excluded.</p><div class="learning-toolbar"><button type="button" class="btn btn--ghost" data-course-all>Select all</button><button type="button" class="btn btn--ghost" data-course-none>Clear selection</button></div></div>
        ${unavailable ? `<div class="learning-notice" data-tone="error"><p>${unavailable} ${unavailable === 1 ? 'selected item is unavailable' : 'selected items are unavailable'}. Replace the source or exclude it to continue.</p><div><button type="button" class="btn btn--ghost" data-course-exclude>Exclude unavailable items</button></div></div>` : ''}
        ${candidates.length > 6 ? `<label>Find content<input class="field-input" type="search" data-course-search value="${htmlEscape(search)}" placeholder="Search by title or section"></label><p class="learning-hint" data-course-search-hint ${search ? '' : 'hidden'}>Clear the search to change the teaching order.</p>` : ''}
        <ol class="learning-candidates">${candidates
          .map(
            (
              c,
              i
            ) => `<li data-candidate="${htmlEscape(c.id)}" data-excluded="${!included.has(c.id)}" ${matches(c) ? '' : 'hidden'}>
          <div class="learning-candidate-main"><label><input class="field-check" type="checkbox" data-course-include aria-label="${htmlEscape(c.title)}" ${included.has(c.id) ? 'checked' : ''}><span class="learning-content-icon">${contentIcon(c.block?.kind || 'module')}</span><span class="learning-candidate-title"><strong>${i + 1}. ${htmlEscape(c.title)}</strong><small>${c.lessons ? `${c.lessons.length} lessons from an existing module` : htmlEscape(contentLabels[c.block?.kind || ''] || 'Unavailable content')}${c.section ? ` / ${htmlEscape(c.section)}` : ''}</small></span></label></div>
          <div class="learning-toolbar"><button type="button" class="btn btn--ghost learning-icon-button learning-move-up" aria-label="Move up" title="Move up" data-course-up ${i === 0 || search ? 'disabled' : ''}>${icon('chevronDown', { size: 18 })}</button><button type="button" class="btn btn--ghost learning-icon-button" aria-label="Move down" title="Move down" data-course-down ${i === candidates.length - 1 || search ? 'disabled' : ''}>${icon('chevronDown', { size: 18 })}</button></div>
          ${c.problem ? `<p class="learning-entry-error">${htmlEscape(c.problem)}</p>` : ''}
          ${c.lessons || (c.renditions?.length || 0) > 1 ? `<div class="learning-candidate-settings">${c.lessons ? '<button type="button" class="btn btn--ghost" data-course-open>Open existing module</button>' : ''}${(c.renditions?.length || 0) > 1 ? `<label>Use as<select class="field-select" data-course-rendition aria-label="Use ${htmlEscape(c.title)} as" ${!included.has(c.id) ? 'disabled' : ''}>${c.renditions!.map((r) => `<option value="${r.kind}" ${c.block?.kind === r.kind ? 'selected' : ''}>${htmlEscape(r.label)}</option>`).join('')}</select></label>` : ''}</div>` : ''}</li>`
          )
          .join('')}</ol>
        ${!candidates.length ? '<p class="learning-notice">No course content was found. Add saved creations or finished media to this project, then try again.</p>' : ''}
        <p class="learning-hint" data-course-no-match ${candidates.some(matches) ? 'hidden' : ''}>No content matches this search.</p>
        <p class="learning-hint">Each item becomes a lesson. An existing module contributes its lessons.</p><p data-course-error role="alert" hidden></p></div>
        <footer class="learning-modal-footer"><button type="button" class="btn btn--ghost" data-course-close>Cancel</button><button type="button" class="btn btn--primary" data-course-create ${!title.trim() || !picked.length || unavailable || creating ? 'disabled' : ''}>${creating ? 'Creating course...' : 'Create course from selection'}</button></footer>`;
      if (creating)
        modal.el
          .querySelectorAll<HTMLInputElement>(
            'input,select,[data-course-all],[data-course-none],[data-course-up],[data-course-down],[data-course-open],[data-course-exclude]'
          )
          .forEach((el) => {
            el.disabled = true;
          });
      modal.el.querySelector('.learning-modal-body')!.scrollTop = scroll;
      if (focus) {
        const control = modal.el.querySelector<HTMLElement>(focus);
        const target =
          control instanceof HTMLButtonElement && control.disabled
            ? control
                .closest('[data-candidate]')
                ?.querySelector<HTMLInputElement>('input[type=checkbox]')
            : control;
        target?.focus({ preventScroll: true });
      }
    };
    paint();
    modal.el.querySelector<HTMLInputElement>('[data-course-title]')?.focus();
    modal.el.addEventListener('input', (e) => {
      const el = e.target as HTMLInputElement;
      if (el.matches('[data-course-title]')) {
        title = el.value;
        modal.el.querySelector<HTMLButtonElement>('[data-course-create]')!.disabled =
          creating ||
          !title.trim() ||
          !included.size ||
          candidates.some((c) => included.has(c.id) && !!c.problem);
      }
      if (el.matches('[data-course-search]')) {
        search = el.value;
        for (const [i, c] of candidates.entries()) {
          const row = modal.el.querySelector<HTMLElement>(
            `[data-candidate="${CSS.escape(c.id)}"]`
          )!;
          row.hidden = !matches(c);
          row.querySelector<HTMLButtonElement>('[data-course-up]')!.disabled = !!search || i === 0;
          row.querySelector<HTMLButtonElement>('[data-course-down]')!.disabled =
            !!search || i === candidates.length - 1;
        }
        modal.el.querySelector<HTMLElement>('[data-course-search-hint]')!.hidden = !search;
        modal.el.querySelector<HTMLElement>('[data-course-no-match]')!.hidden =
          candidates.some(matches);
      }
    });
    modal.el.addEventListener('change', (e) => {
      const el = e.target as HTMLInputElement;
      const c = candidates.find(
        (item) => item.id === el.closest<HTMLElement>('[data-candidate]')?.dataset.candidate
      );
      if (!c || creating) return;
      if (el.matches('[data-course-include]')) {
        if (el.checked) included.add(c.id);
        else included.delete(c.id);
        paint();
      }
      if (el.matches('[data-course-rendition]') && c.block) {
        const option = c.renditions?.find((r) => r.kind === el.value);
        if (option) {
          c.block.kind = option.kind;
          if (c.block.source) c.block.source.motion = option.kind === 'video';
        }
      }
    });
    modal.el.addEventListener('click', (e) => {
      const el = (e.target as Element).closest<HTMLButtonElement>('button');
      if (!el || creating) return;
      const i = candidates.findIndex(
        (c) => c.id === el.closest<HTMLElement>('[data-candidate]')?.dataset.candidate
      );
      if (el.matches('[data-course-all],[data-course-none],[data-course-exclude]')) {
        if (el.matches('[data-course-all]'))
          candidates.forEach((c) => {
            included.add(c.id);
          });
        if (el.matches('[data-course-none]')) included.clear();
        if (el.matches('[data-course-exclude]'))
          candidates
            .filter((c) => c.problem)
            .forEach((c) => {
              included.delete(c.id);
            });
        paint();
        return;
      }
      if (el.matches('[data-course-open]') && candidates[i]?.moduleSlot) {
        const slot = candidates[i]!.moduleSlot!;
        modal.close();
        window.location.hash = `#/learning?slot=${encodeURIComponent(slot)}&export=1`;
        return;
      }
      if (el.matches('[data-course-up],[data-course-down]')) {
        const j = i + (el.matches('[data-course-up]') ? -1 : 1);
        if (candidates[i] && candidates[j])
          [candidates[i], candidates[j]] = [candidates[j]!, candidates[i]!];
        paint();
        return;
      }
      if (el.matches('[data-course-create]')) {
        creating = true;
        paint();
        void (async () => {
          try {
            const module = moduleFromLearningCandidates(
              title,
              candidates.filter((c) => included.has(c.id)),
              selection.projectId || null
            );
            const slot = `__learning__:${module.id}`;
            await host.state.save(slot, {
              __label: module.title,
              __learningModule: module,
              __learningReleases: [],
            });
            if (module.projectId)
              await createFolderStore(
                host as unknown as Parameters<typeof createFolderStore>[0]
              ).addItem(module.projectId, { type: 'session', ref: slot });
            if (closed) return;
            modal.close();
            window.location.hash = `#/learning?slot=${encodeURIComponent(slot)}`;
          } catch (error) {
            creating = false;
            if (!closed) {
              paint();
              const notice = modal.el.querySelector<HTMLElement>('[data-course-error]')!;
              notice.hidden = false;
              notice.textContent = error instanceof Error ? error.message : String(error);
            }
          }
        })();
      }
    });
  } catch (error) {
    if (!closed)
      modal.el.querySelector('[role=status]')!.textContent =
        error instanceof Error ? error.message : String(error);
  }
}
