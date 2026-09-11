// SPDX-License-Identifier: MPL-2.0
/**
 * The "Save as…" dialog - the render pill's Save half and Design's Lolly menu open THIS
 * instead of a silent one-shot save, so a creative can choose WHERE the work lands:
 *
 *   1. Save to a project - file the saved session into a project (folder), or leave it at
 *      the library root. This is the everyday save, plus a home.
 *   2. Save as a template - the current doc becomes a reusable STARTING POINT for this
 *      tool, shown in its "New from template" chooser, the Projects add-picker and the
 *      Templates collection. It can also become what NEW documents of this tool start
 *      with ("Start with", plans/226).
 *
 * The two are PEERS - side by side, no disclosure - because on most tools the template
 * card is the only door to a first template (plans/226 C6). "Create a tool" (Design only)
 * stays folded under "More ways to save". The export sheet's own Save is a separate,
 * silent quick save and never opens this (plans/226 D7).
 *
 * A saved template is an ordinary values seed, so the existing Share modal's `.lolly`
 * path carries it unchanged (the footer points at it). This module owns only the DOM +
 * wiring; every side effect (save, folder create/file, template persist/update, share) is
 * INJECTED, so it is headless-testable and knows nothing about the host bridge, the
 * runtime, or the store shapes.
 */

import { mountModal } from '../components/modal.ts';
import { escape } from '../utils.ts';

export interface SaveDialogFolder { id: string; name: string; }
/** One template the person already saved for this tool - the "Update ‹name›" targets. */
export interface SaveDialogTemplate { id: string; name: string; }

/** What the template card collects for a NEW template. */
export interface SaveTemplateMeta {
  name: string;
  /** One line, '' when the field was left empty. */
  description: string;
  /** "Start new ‹Tool› documents with this" - sets the tool's "Start with". */
  startWith: boolean;
}

export interface SaveDialogDeps {
  toolName: string;
  /**
   * Show the "Save as a template" card. The caller computes it with
   * `canSaveTemplate(manifest.inputs)` (lib/user-templates.ts): true when the tool has at
   * least one non-`file` input, i.e. there is something a template could carry. It is NOT
   * "this tool already has templates" - that gate is what kept ~50 tools from ever making
   * a first one (plans/226).
   */
  canSaveTemplate?: boolean;
  /** Prefill for the template name - the session label if the doc has one, else
   *  "‹Tool› template". The caller owns the wording so it stays translated. */
  templateName?: string;
  /** This tool's existing user templates, offered as "Update ‹name›" targets. */
  existingTemplates?: readonly SaveDialogTemplate[];
  /** The user-template id this tool currently starts new documents with, when it is one
   *  of `existingTemplates` - the checkbox reflects it while that template is selected. */
  startWithId?: string | null;
  /** Force the checkbox on for the selected update target (the caller already knows the
   *  answer). Absent, `startWithId` decides. */
  startWithCurrent?: boolean;
  /** Which card the dialog opens on - focus + scroll. Default 'project'. */
  focus?: 'project' | 'template';
  /** Projects (folders) to file into. Awaited on open so the dialog paints instantly. */
  listFolders: () => Promise<SaveDialogFolder[]>;
  createFolder: (name: string) => Promise<SaveDialogFolder>;
  /** Save the session to the library, filed into `folderId` (null = library root). true = ok. */
  saveToLibrary: (folderId: string | null) => Promise<boolean>;
  /** Persist the current doc as a NEW user template. */
  saveTemplate: (meta: SaveTemplateMeta) => Promise<void>;
  /** Re-point an existing user template at the current doc (store.replace) - its name is
   *  its identity and never changes here. Required for the "Update ‹name›" options. */
  updateTemplate?: (id: string, meta: { description: string; startWith: boolean }) => Promise<void>;
  /** Show the "Create a tool" card - true when saving from a tool that can be a user tool's
   *  base (the Design tool). Needs `createTool` to actually do anything. */
  canCreateTool?: boolean;
  /** The base tool's export formats, offered as the new tool's formats (all pre-selected). */
  toolFormats?: readonly string[];
  /** Persist the current doc as a NEW user tool (its own listing entry). `formats` is the
   *  user's selected subset; `icon` is an optional emoji/glyph (empty → the base tool's own). */
  createTool?: (meta: { title: string; description: string; icon: string; formats: string[] }) => Promise<void>;
  /** Open the Share modal (its `.lolly` File panel) - the "share for anyone to import" path. */
  shareLolly?: () => void;
  /** The project this session is ALREADY filed in (null/absent = root or unknown).
   *  Preselected in the picker so a re-save of a filed session tells the truth
   *  instead of showing "No project" (plans/142 W1). */
  currentFolderId?: string | null;
  announce?: (msg: string) => void;
  /** The i18n lookup. Pass `tRaw`: every string this module renders is escape()d at the
   *  sink, so a param escaped by `t` would reach the user as `O&#39;Brien`. */
  t?: (s: string, params?: Record<string, string | number>) => string;
}

const NEW_PROJECT = '__new_project__';
const NEW_TEMPLATE = '';

/** The last project a save filed into, remembered for the app session (module
 *  scope) - an operator filing ten outputs into one project should not re-pick
 *  it ten times, and a missed pick silently scatters work into the root
 *  (plans/142 W1). A session's own current folder still wins over this. */
let lastPickedFolderId: string | null = null;

/** The project the last dialog save filed into, for surfaces that follow its
 *  lead (plans/142 W2, Andy's call: the export sheet's quick Save files an
 *  UNFILED session here instead of scattering to the root). */
export function lastPickedFolder(): string | null { return lastPickedFolderId; }

/** The "More ways to save" disclosure (create-a-tool), collapsed for a first-timer so the
 *  everyday save reads as ONE decision (plans/170 WP-1). Its open state is remembered per
 *  device - chrome preference, same class as the catalogue's collapsed sections, never
 *  tool state - so an author who opens it keeps it open. */
const SAVE_MORE_KEY = 'lolly-save-more-open';
const savedMoreOpen = (): boolean => {
  try { return localStorage.getItem(SAVE_MORE_KEY) === '1'; } catch { return false; }
};

/** The dialog's own fallback lookup: identity plus plain {name} interpolation. */
const identityT = (s: string, params?: Record<string, string | number>): string =>
  params ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m)) : s;

export function openSaveDialog(deps: SaveDialogDeps): void {
  const t = deps.t ?? identityT;
  const showTemplate = Boolean(deps.canSaveTemplate);
  const showCreateTool = Boolean(deps.canCreateTool && deps.createTool);
  const existing = deps.existingTemplates ?? [];

  // The template card: name + one-line description + the "Start with" checkbox, plus a
  // "Save as new / Update ‹name›" select once this tool has templates of its own. Update
  // keeps the target's name (that is its identity) and only re-points its values, so the
  // name field hides while an update target is selected.
  const templateCard = showTemplate ? `
    <section class="save-card" data-card="template">
      <h3 class="save-card-title">${escape(t('Save as a template'))}</h3>
      <p class="save-card-desc">${escape(t('A reusable starting point for {tool} - offered whenever you start a new document.', { tool: deps.toolName }))}</p>
      ${existing.length ? `
      <div class="save-card-row">
        <select class="save-input" data-tpl-target aria-label="${escape(t('Save as new or update an existing template'))}"></select>
      </div>` : ''}
      <div class="save-card-row" data-tpl-name-row>
        <input type="text" class="save-input" data-tpl-name maxlength="80" placeholder="${escape(t('Template name'))}" aria-label="${escape(t('Template name'))}">
      </div>
      <div class="save-card-row">
        <input type="text" class="save-input" data-tpl-desc maxlength="120" placeholder="${escape(t('Description (optional)'))}" aria-label="${escape(t('Description'))}">
      </div>
      <label class="save-card-check">
        <input type="checkbox" data-tpl-start>
        <span>${escape(t('Start new {tool} documents with this', { tool: deps.toolName }))}</span>
      </label>
      <div class="save-card-row">
        <button type="button" class="btn" data-act="save-template">${escape(t('Save template'))}</button>
      </div>
      <p class="save-card-err" data-err="template" hidden></p>
    </section>` : '';

  // "Create a tool": turn the current doc into the user's own listed tool. Format options are
  // built from the base tool's formats (all pre-selected); title is required, description +
  // icon are optional. Formats render as DOM checkboxes below (never an HTML string sink).
  const createToolCard = showCreateTool ? `
    <section class="save-card" data-card="tool">
      <h3 class="save-card-title">${escape(t('Create a tool'))}</h3>
      <p class="save-card-desc">${escape(t('Turn this into your own tool - it joins your tool list and opens preconfigured like this.'))}</p>
      <div class="save-card-row">
        <input type="text" class="save-input" data-tool-title maxlength="60" placeholder="${escape(t('Tool name'))}" aria-label="${escape(t('Tool name'))}">
        <input type="text" class="save-input save-tool-icon" data-tool-icon maxlength="4" placeholder="${escape(t('Icon'))}" aria-label="${escape(t('Icon (an emoji)'))}">
      </div>
      <div class="save-card-row">
        <input type="text" class="save-input" data-tool-desc maxlength="120" placeholder="${escape(t('Short description (optional)'))}" aria-label="${escape(t('Description'))}">
      </div>
      <fieldset class="save-tool-formats" data-tool-formats></fieldset>
      <div class="save-card-row">
        <button type="button" class="btn" data-act="create-tool">${escape(t('Create tool'))}</button>
      </div>
      <p class="save-card-err" data-err="tool" hidden></p>
    </section>` : '';

  const shareFoot = deps.shareLolly ? `
    <div class="save-dialog-foot">
      <span>${escape(t('Made something worth sharing? Send it as a .lolly file for anyone to import.'))}</span>
      <button type="button" class="save-link" data-act="share">${escape(t('Share…'))}</button>
    </div>` : '';

  const title = t('Save as');
  const content = `
    <div class="save-dialog-head">
      <h2>${escape(title)}</h2>
      <button type="button" class="save-dialog-close" data-act="close" aria-label="${escape(t('Close'))}">&times;</button>
    </div>
    <div class="save-dialog-body">
      <div class="save-cards">
        <section class="save-card" data-card="project">
          <h3 class="save-card-title">${escape(t('Save to a project'))}</h3>
          <p class="save-card-desc">${escape(t('Keep this in your library, filed under a project.'))}</p>
          <div class="save-card-row">
            <select class="save-input" data-project aria-label="${escape(t('Project'))}">
              <option value="">${escape(t('Loading projects…'))}</option>
            </select>
          </div>
          <input type="text" class="save-input save-new-project" data-new-project maxlength="80" placeholder="${escape(t('New project name'))}" aria-label="${escape(t('New project name'))}" hidden>
          <div class="save-card-row">
            <button type="button" class="btn btn--primary" data-act="save-project">${escape(t('Save'))}</button>
          </div>
          <p class="save-card-err" data-err="project" hidden></p>
        </section>
        ${templateCard}
      </div>
      ${createToolCard ? `
      <details class="save-more" data-save-more${savedMoreOpen() ? ' open' : ''}>
        <summary>${escape(t('More ways to save'))}</summary>
        ${createToolCard}
      </details>` : ''}
    </div>
    ${shareFoot}`;

  const wantsTemplate = showTemplate && deps.focus === 'template';
  const modal = mountModal(content, {
    className: `save-dialog${showTemplate ? ' save-dialog--wide' : ''}`,
    ariaLabel: title,
    initialFocus: (el) =>
      (wantsTemplate
        ? el.querySelector<HTMLElement>('[data-tpl-name]') ?? el.querySelector<HTMLElement>('[data-act="save-template"]')
        : null) ?? el.querySelector<HTMLElement>('[data-act="save-project"]'),
  });
  const root = modal.el;

  const q = <T extends HTMLElement>(sel: string): T | null => root.querySelector<T>(sel);
  const announce = (m: string): void => deps.announce?.(m);
  const showErr = (which: string, msg: string): void => {
    const el = q<HTMLElement>(`[data-err="${which}"]`);
    if (el) { el.textContent = msg; el.hidden = !msg; }
  };
  // Run an async save, guarding its button + surfacing failure inline instead of throwing.
  async function withButton(btn: HTMLButtonElement, which: string, fn: () => Promise<void>): Promise<void> {
    if (btn.dataset.busy) return;
    btn.dataset.busy = '1';
    btn.disabled = true;
    showErr(which, '');
    try {
      await fn();
    } catch (e) {
      showErr(which, e instanceof Error ? e.message : String(e));
      btn.disabled = false;
      delete btn.dataset.busy;
    }
  }

  // ── Project select: fill async, reveal a name field when "New project" is chosen ──
  // Options are built as DOM (textContent), never an HTML string, so a folder name can never
  // be markup - no raw-HTML sink, no escaping to get wrong.
  const projectSel = q<HTMLSelectElement>('[data-project]');
  const newProjectInput = q<HTMLInputElement>('[data-new-project]');
  const opt = (value: string, label: string): HTMLOptionElement => {
    const o = document.createElement('option');
    o.value = value; o.textContent = label;
    return o;
  };
  // "My library" - a place a person can go (Projects lists it), not a shrug.
  // The audit (167 F-A3) found "No project (Library)" read as "this save goes
  // nowhere", which is exactly where trust in the first save died.
  const noProject = (): HTMLOptionElement => opt('', t('My library'));
  void deps.listFolders().then(folders => {
    projectSel?.replaceChildren(
      noProject(),
      ...folders.map(f => opt(f.id, f.name)),
      opt(NEW_PROJECT, t('＋ New project…')),
    );
    // Preselect where this save will actually count: the session's own current
    // project first (a filed session must not claim "No project"), else the
    // project the last save picked, when it still exists.
    const pre = [deps.currentFolderId, lastPickedFolderId].find(id => id && folders.some(f => f.id === id));
    if (pre && projectSel) projectSel.value = pre;
  }).catch(() => { projectSel?.replaceChildren(noProject()); });

  projectSel?.addEventListener('change', () => {
    const isNew = projectSel.value === NEW_PROJECT;
    if (newProjectInput) { newProjectInput.hidden = !isNew; if (isNew) newProjectInput.focus(); }
  });

  // Remember the More-ways-to-save disclosure across dialogs (see SAVE_MORE_KEY).
  q<HTMLElement>('[data-save-more]')?.addEventListener('toggle', (e) => {
    try { localStorage.setItem(SAVE_MORE_KEY, (e.target as HTMLDetailsElement).open ? '1' : '0'); } catch { /* device pref only */ }
  });

  // ── Template card: the update targets, the name field's visibility, the Start-with box ──
  const tplTarget = q<HTMLSelectElement>('[data-tpl-target]');
  const tplNameInput = q<HTMLInputElement>('[data-tpl-name]');
  const tplNameRow = q<HTMLElement>('[data-tpl-name-row]');
  const tplStart = q<HTMLInputElement>('[data-tpl-start]');
  if (showTemplate) {
    if (tplNameInput && deps.templateName) tplNameInput.value = deps.templateName;
    // Options as DOM, like the project select: a template name is the person's own text.
    tplTarget?.replaceChildren(
      opt(NEW_TEMPLATE, t('Save as new')),
      ...existing.map(x => opt(x.id, t('Update {name}', { name: x.name }))),
    );
    const syncTemplateMode = (): void => {
      const target = tplTarget?.value ?? NEW_TEMPLATE;
      if (tplNameRow) tplNameRow.hidden = Boolean(target); // an update keeps its own name
      // Reflect the tool's current "Start with" for the selected template, so ticking is
      // an opt-in and un-ticking an update is a real "stop starting with this".
      if (tplStart) tplStart.checked = Boolean(target) && (deps.startWithCurrent === true || target === deps.startWithId);
    };
    syncTemplateMode();
    tplTarget?.addEventListener('change', syncTemplateMode);
  }

  // ── Create-a-tool: format checkboxes, built as DOM (a format id is catalog data, but this
  // keeps the same no-HTML-string-sink discipline as the project select above) ──
  if (showCreateTool) {
    const fmtBox = q<HTMLFieldSetElement>('[data-tool-formats]');
    const formats = (deps.toolFormats ?? []).slice();
    if (fmtBox) {
      if (!formats.length) { fmtBox.hidden = true; }
      else for (const f of formats) {
        const label = document.createElement('label');
        label.className = 'save-tool-format';
        const cb = document.createElement('input');
        cb.type = 'checkbox'; cb.value = f; cb.checked = true; cb.setAttribute('data-tool-format', '');
        label.append(cb, document.createTextNode(' ' + f.toUpperCase()));
        fmtBox.appendChild(label);
      }
    }
  }

  // Opened on the template card ("Save as a template…"): bring it into view as well as
  // into focus, for the narrow layout where the two cards are stacked.
  if (wantsTemplate) q<HTMLElement>('[data-card="template"]')?.scrollIntoView?.({ block: 'nearest' });

  // ── Actions ──
  root.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement | null)?.closest<HTMLButtonElement>('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;

    if (act === 'close') { modal.close(); return; }
    if (act === 'share') { modal.close(); deps.shareLolly?.(); return; }

    if (act === 'save-project') {
      void withButton(btn, 'project', async () => {
        let folderId: string | null = projectSel?.value || null;
        if (folderId === NEW_PROJECT) {
          const name = (newProjectInput?.value || '').trim();
          if (!name) { throw new Error(t('Name the new project first.')); }
          folderId = (await deps.createFolder(name)).id;
        }
        const ok = await deps.saveToLibrary(folderId);
        if (!ok) throw new Error(t('Save failed - please try again.'));
        lastPickedFolderId = folderId;
        announce(t('Saved'));
        modal.close();
      });
      return;
    }

    if (act === 'save-template') {
      const target = tplTarget?.value || NEW_TEMPLATE;
      const name = (tplNameInput?.value || '').trim();
      const description = (q<HTMLInputElement>('[data-tpl-desc]')?.value || '').trim();
      const startWith = Boolean(tplStart?.checked);
      void withButton(btn, 'template', async () => {
        if (target) {
          if (!deps.updateTemplate) throw new Error(t('Save failed - please try again.'));
          await deps.updateTemplate(target, { description, startWith });
          announce(t('Template updated'));
        } else {
          if (!name) throw new Error(t('Name the template first.'));
          await deps.saveTemplate({ name, description, startWith });
          announce(t('Saved as a template'));
        }
        modal.close();
      });
      return;
    }

    if (act === 'create-tool') {
      const title2 = (q<HTMLInputElement>('[data-tool-title]')?.value || '').trim();
      const description = (q<HTMLInputElement>('[data-tool-desc]')?.value || '').trim();
      const icon = (q<HTMLInputElement>('[data-tool-icon]')?.value || '').trim();
      const formats = Array.from(root.querySelectorAll<HTMLInputElement>('[data-tool-format]:checked')).map(c => c.value);
      void withButton(btn, 'tool', async () => {
        if (!title2) throw new Error(t('Name the tool first.'));
        await deps.createTool!({ title: title2, description, icon, formats });
        announce(t('Tool created'));
        modal.close();
      });
      return;
    }
  });

  // Enter in a text field triggers that card's primary action.
  root.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const tgt = e.target as HTMLElement | null;
    if (!(tgt instanceof HTMLInputElement)) return;
    e.preventDefault();
    const card = tgt.closest<HTMLElement>('.save-card');
    // The primary action for each card: a save-* button, or the Create-a-tool button.
    card?.querySelector<HTMLButtonElement>('[data-act^="save-"], [data-act="create-tool"]')?.click();
  });
}
