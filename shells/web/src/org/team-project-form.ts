// SPDX-License-Identifier: MPL-2.0
/**
 * org/team-project-form - the small "New project" form, shared by the Team projects
 * modal (org/team-projects.ts) and the Share dialog's Team section (org/team-save.ts),
 * so creating a project reads and behaves the same from both.
 *
 * A name and who can see it: "Only me", or one of the groups the instance lets this
 * person share with (`sharing.groups` in org-config). An instance that sends no groups
 * gets "Only me" alone. Built with DOM APIs and textContent only, so no instance-
 * supplied group name ever reaches an HTML sink. Errors show inline, never alert().
 */
import type { SessionSourceWriter, TeamProjectRef, TeamProjectVisibility } from '../lib/session-source.ts';
import { tRaw } from '../i18n.ts';
import { announce } from '../a11y.ts';

/** The visibility a select value stands for. '' is "only me"; 'g:<name>' a group. Pure. */
export function visibilityFromChoice(value: string): TeamProjectVisibility {
  return value.startsWith('g:') && value.length > 2 ? { groups: [value.slice(2)] } : 'private';
}

/** The sentence for a failed create, by status. Plain text. */
export function createProjectMessage(status: number): string {
  if (status === 400) return tRaw('Give the project a name.');
  if (status === 401) return tRaw('Your sign-in has expired. Sign in again, then create the project.');
  if (status === 403) return tRaw('This instance does not let you create projects.');
  if (status === 0) return tRaw('The instance could not be reached. Try again when you are back online.');
  return tRaw('Could not create the project. Try again.');
}

let formSeq = 0;

export interface NewProjectFormOptions {
  onCreated: (project: TeamProjectRef) => void;
  onCancel?: () => void;
}

/** Build the form. Focus goes to the name field once it is in the document. */
export function buildNewProjectForm(writer: SessionSourceWriter, opts: NewProjectFormOptions): HTMLFormElement {
  const { groups } = writer.projectOptions();
  const id = `team-new-project-${++formSeq}`;
  const form = document.createElement('form');
  form.className = 'team-new-project';
  form.noValidate = true;

  const nameLabel = document.createElement('label');
  nameLabel.htmlFor = `${id}-name`;
  nameLabel.textContent = tRaw('Project name');
  nameLabel.style.cssText = 'font-size:var(--fs-sm);font-weight:600';
  const name = document.createElement('input');
  name.type = 'text';
  name.id = `${id}-name`;
  name.className = 'field-input';
  name.autocomplete = 'off';
  name.maxLength = 200;
  name.required = true;

  const visLabel = document.createElement('label');
  visLabel.htmlFor = `${id}-vis`;
  visLabel.textContent = tRaw('Who can edit this project');
  visLabel.style.cssText = 'font-size:var(--fs-sm);font-weight:600';
  const vis = document.createElement('select');
  vis.id = `${id}-vis`;
  vis.className = 'field-select field-select--sm';
  const only = document.createElement('option');
  only.value = '';
  only.textContent = tRaw('Only people I add');
  vis.append(only);
  for (const g of groups) {
    const o = document.createElement('option');
    o.value = `g:${g}`;
    o.textContent = tRaw('Everyone in {group}', { group: g });
    vis.append(o);
  }
  const note = document.createElement('p'); note.className = 'team-project-notice';
  note.textContent = tRaw('People you add can view or edit according to their role. Workspace admins can manage all projects.');

  const err = document.createElement('p');
  err.setAttribute('role', 'status');
  err.hidden = true;
  err.style.cssText = 'margin:0;color:hsl(var(--destructive));font-size:var(--fs-xs)';

  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex;gap:.5rem;flex-wrap:wrap;justify-content:flex-end';
  const create = document.createElement('button');
  create.type = 'submit';
  create.className = 'btn btn--primary btn--sm';
  create.textContent = tRaw('Create project');
  actions.append(create);
  if (opts.onCancel) {
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'btn btn--sm';
    cancel.textContent = tRaw('Cancel');
    cancel.addEventListener('click', () => opts.onCancel?.());
    actions.prepend(cancel);
  }

  form.append(nameLabel, name, visLabel, vis, note, err, actions);
  const showError = (msg: string): void => {
    err.textContent = msg;
    err.hidden = false;
    announce(msg, { assertive: true });
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (create.disabled) return;
    const projectName = name.value.trim();
    if (!projectName) { showError(createProjectMessage(400)); name.focus(); return; }
    err.hidden = true;
    create.disabled = true;
    const label = create.textContent;
    create.textContent = tRaw('Creating…');
    try {
      const got = await writer.createProject({ name: projectName, visibility: visibilityFromChoice(vis.value) });
      if (got.kind === 'created') { announce(tRaw('Project created')); opts.onCreated(got.project); return; }
      showError(createProjectMessage(got.status));
    } finally {
      create.disabled = false;
      create.textContent = label;
    }
  });
  queueMicrotask(() => { if (form.isConnected) name.focus(); });
  return form;
}
