// SPDX-License-Identifier: MPL-2.0
/**
 * Saved studios: save the look of a 3D Studio document once, use it in many documents
 * (plan 265 step 2, milestone 2 lane A).
 *
 * A saved studio is an ordinary user template with `scope: 'look'`, so it persists,
 * backs up and restores with everything else on the profile (lib/user-templates.ts).
 * It carries only the studio's own inputs, the engine's `STUDIO_LOOK_KEYS`, and an
 * integer `lookVersion` that counts up on every save.
 *
 * A document that uses one keeps two plain inputs: `studioRef`, which is
 * `<templateId>@<lookVersion>`, and `studioOverrides`, a JSON list of the studio
 * controls the reader changed since. Applying a studio writes the look straight into
 * the ordinary inputs, so the recipe, URL mode, the CLI and MCP see plain values and
 * `buildStudioScene` is untouched. Editing the saved studio changes nothing in a
 * document that uses it until the reader takes the update.
 *
 * Why an apply is two batches, not one: `applyPatch` puts every value in the model
 * first and then runs the tool's `onInput` hook once per changed id. The hook records
 * a studio control the reader changed, and from inside the hook an applied value and a
 * typed one look the same. So the operations below write the look first and the true
 * `studioOverrides` and `studioRef` second, in their own batch, where the hook has
 * nothing left to record.
 *
 * Everything above the mount is headless: the operations take a runtime slice and a
 * template store, so they run under Node in a test and are what the contact sheet's
 * Studio control (lane B) calls as well.
 *
 * Every operation that writes takes an optional `changed`, called after each batch:
 * `applyPatch` goes round the tool view's setInput wrapper, so the view hands in its
 * automatic-history signal and a studio applied, updated or detached is kept as an
 * edit (plan 277 P4).
 */

import {
  STUDIO_LOOK_INPUT_IDS,
  studioApplyLook,
  studioFormatOverrides,
  studioFormatRef,
  studioLookOf,
  studioParseOverrides,
  studioParseRef,
} from '../../../../engine/src/studio3d-look.ts';
import { t, tRaw } from '../i18n.ts';
import { announce } from '../a11y.ts';
import { escape as escapeHtml } from '../utils.ts';
import { choiceDialog, promptDialog } from '../components/confirm-dialog.ts';
import {
  createUserTemplateStore,
  MAX_TEMPLATE_NAME,
  type UserTemplate,
  type UserTemplateHost,
  type UserTemplateStore,
} from './user-templates.ts';

export type StudioValues = Record<string, unknown>;

/** The slice of the runtime a studio operation needs. Structural, so a test needs no mount. */
export interface StudioLibraryRuntime {
  getModel(): ReadonlyArray<{ id: string; value: unknown }>;
  applyPatch(values: StudioValues): Promise<void>;
}

/** Plain values from a runtime model, the form every operation here works in. */
export function studioValuesOf(runtime: StudioLibraryRuntime): StudioValues {
  return Object.fromEntries(runtime.getModel().map((item) => [item.id, item.value]));
}

/** What a document's two studio inputs say, read against the saved studios. */
export interface StudioLinkState {
  /** The saved studio this document names, or null when none is attached. */
  ref: { id: string; version: number } | null;
  /** The saved studio itself, or null when it is gone or names another tool. */
  template: UserTemplate | null;
  /** Input ids the reader changed after the studio was applied. */
  overrides: string[];
  /** A studio was named and no longer exists. A note, never an error. */
  stale: boolean;
  /** The saved studio has been saved again since this document took its look. */
  outdated: boolean;
}

/** Read a document's link to a saved studio. Never throws on a value a reader typed. */
export async function studioLinkState(
  values: StudioValues,
  store: UserTemplateStore
): Promise<StudioLinkState> {
  const ref = studioParseRef(values.studioRef);
  const overrides = studioParseOverrides(values.studioOverrides);
  if (!ref) return { ref: null, template: null, overrides, stale: false, outdated: false };
  const template = await store.get(ref.id);
  const found = template && template.scope === 'look' ? template : null;
  return {
    ref,
    template: found,
    overrides,
    stale: !found,
    outdated: Boolean(found) && Number(found?.lookVersion ?? 1) > ref.version,
  };
}

/** The saved studios for a tool, newest first. */
export function listStudios(store: UserTemplateStore, toolId: string): Promise<UserTemplate[]> {
  return store.listLooks(toolId);
}

/**
 * Attach a document to a saved studio and write the studio's values into it. The
 * document's own source, framing, collection and delivery are left alone, and so is
 * every control listed in `overrides` when `keepOverrides` is set (that is what
 * "Update from studio" means).
 */
async function writeStudio(
  runtime: StudioLibraryRuntime,
  template: UserTemplate,
  keepOverrides: readonly string[],
  changed?: () => void
): Promise<void> {
  const values = studioValuesOf(runtime);
  const next = studioApplyLook(values, template.values, keepOverrides);
  const patch: StudioValues = {};
  for (const id of STUDIO_LOOK_INPUT_IDS)
    if (next[id] !== values[id]) patch[id] = next[id];
  if (Object.keys(patch).length) {
    await runtime.applyPatch(patch);
    changed?.();
  }
  // Second batch, on purpose: see the header. The hook cannot tell an applied value
  // from a typed one, so the truth about the link is written after it has run.
  await runtime.applyPatch({
    studioOverrides: studioFormatOverrides(keepOverrides),
    studioRef: studioFormatRef({
      id: template.id,
      version: Math.max(1, Math.trunc(Number(template.lookVersion) || 1)),
    }),
  });
  changed?.();
}

/** Apply a saved studio to this document. Every override is dropped: this is a fresh start. */
export function applyStudio(
  runtime: StudioLibraryRuntime,
  template: UserTemplate,
  changed?: () => void
): Promise<void> {
  return writeStudio(runtime, template, [], changed);
}

/**
 * Take the saved studio's current values for every control this document has not
 * changed itself, and name the version that was taken. Answers what happened so the
 * caller can say it: a studio that is gone is a note, not a failure.
 */
export async function updateFromStudio(
  runtime: StudioLibraryRuntime,
  store: UserTemplateStore,
  changed?: () => void
): Promise<'updated' | 'missing' | 'none'> {
  const state = await studioLinkState(studioValuesOf(runtime), store);
  if (!state.ref) return 'none';
  if (!state.template) return 'missing';
  await writeStudio(runtime, state.template, state.overrides, changed);
  return 'updated';
}

/** Stop using a saved studio. The values stay exactly as they are. */
export async function detachStudio(runtime: StudioLibraryRuntime, changed?: () => void): Promise<void> {
  await runtime.applyPatch({ studioRef: '', studioOverrides: '' });
  changed?.();
}

/**
 * Save this document's look as a studio and attach the document to it. A name that is
 * already in use saves a second studio: a saved studio is identified by its id, and
 * two rooms may honestly share a name.
 */
export async function saveStudio(
  runtime: StudioLibraryRuntime,
  store: UserTemplateStore,
  input: { toolId: string; name: string; description?: string },
  changed?: () => void
): Promise<UserTemplate> {
  const saved = await store.save({
    toolId: input.toolId,
    name: input.name,
    ...(input.description ? { description: input.description } : {}),
    values: studioLookOf(studioValuesOf(runtime)),
    scope: 'look',
  });
  await writeStudio(runtime, saved, [], changed);
  return saved;
}

/** Save this document's look over a studio it already uses, counting its version up. */
export async function saveStudioOver(
  runtime: StudioLibraryRuntime,
  store: UserTemplateStore,
  id: string,
  changed?: () => void
): Promise<UserTemplate | null> {
  const saved = await store.updateLook(id, studioLookOf(studioValuesOf(runtime)));
  if (!saved) return null;
  await writeStudio(runtime, saved, [], changed);
  return saved;
}

// ── The sidebar's Studio section ────────────────────────────────────────────

const ROW_CLASS = 'studio-library';

export interface StudioActionsDeps {
  runtime: StudioLibraryRuntime;
  /** The web host, for the profile the templates ride on. */
  host: UserTemplateHost;
  toolId: string;
  /** Automatic history's change signal, called after every write (see the header). */
  changed?: () => void;
}

function button(label: string, action: string, enabled: boolean): string {
  return `<button type="button" class="block-add" data-studio-action="${action}"${enabled ? '' : ' disabled'}>${escapeHtml(label)}</button>`;
}

/** The section the actions live in: the one holding `studioRef`, or one made here. */
function sectionFor(panel: ParentNode): HTMLElement | null {
  const declared = panel
    .querySelector('[data-input-id="studioRef"]')
    ?.closest<HTMLElement>('details.input-section');
  if (declared) return declared.querySelector<HTMLElement>('.input-section-body') ?? declared;
  const existing = panel.querySelector<HTMLElement>(`.${ROW_CLASS}-section .input-section-body`);
  if (existing) return existing;
  const sections = panel.querySelectorAll<HTMLElement>('details.input-section');
  const made = document.createElement('details');
  made.className = `input-section ${ROW_CLASS}-section`;
  made.open = true;
  made.innerHTML = `<summary class="input-section-summary"><span class="input-section-title">${t('Studio')}</span></summary><div class="input-section-body"></div>`;
  const first = sections[0];
  if (first?.parentNode) first.after(made);
  else (panel as Element).prepend(made);
  return made.querySelector<HTMLElement>('.input-section-body');
}

/**
 * Put Save studio, Apply a studio, Update from studio and Detach in the tool sidebar,
 * and say which studio is in use. Idempotent: the tool view calls it on every paint,
 * because `renderInputs` rebuilds the panel whenever the model changes.
 */
export function mountStudioActions(panel: ParentNode | null, deps: StudioActionsDeps): void {
  if (!panel) return;
  const body = sectionFor(panel);
  if (!body) return;
  let row = body.querySelector<HTMLElement>(`.${ROW_CLASS}`);
  if (!row) {
    row = document.createElement('div');
    row.className = ROW_CLASS;
    body.prepend(row);
    row.addEventListener('click', (event) => {
      const action = (event.target as Element | null)?.closest<HTMLElement>('[data-studio-action]')
        ?.dataset.studioAction;
      if (action) void run(action, deps, panel);
    });
  }
  // Only the two studio inputs decide what this row says, and only the actions below
  // change the saved studios, so a paint that moved neither needs no profile read. An
  // orbit drag paints many times and must not read the profile on each one.
  const values = studioValuesOf(deps.runtime);
  const signature = `${String(values.studioRef ?? '')}|${String(values.studioOverrides ?? '')}`;
  if (row.dataset.studioSig === signature && row.childElementCount) return;
  row.dataset.studioSig = signature;
  void paintRow(row, deps);
}

/** The row's text and buttons for the document as it is now. */
async function paintRow(row: HTMLElement, deps: StudioActionsDeps): Promise<void> {
  const store = createUserTemplateStore(deps.host);
  let state: StudioLinkState;
  let saved: UserTemplate[] = [];
  try {
    [state, saved] = await Promise.all([
      studioLinkState(studioValuesOf(deps.runtime), store),
      listStudios(store, deps.toolId),
    ]);
  } catch {
    return; // no profile on this host: the sidebar simply does not offer studios
  }
  if (!row.isConnected) return;
  const attached = Boolean(state.ref);
  const note = state.stale
    ? t('The studio this document used has been deleted. Its look is still here.')
    : state.template
      ? state.outdated
        ? tRaw('{name} has been saved again since this document took its look.', {
            name: state.template.name,
          })
        : tRaw('Using {name}.', { name: state.template.name })
      : t('No studio. Save this look to use it in other documents.');
  const changed = !state.overrides.length
    ? ''
    : state.overrides.length === 1
      ? ' ' + t('One control you changed stays yours.')
      : ' ' + tRaw('{count} controls you changed stay yours.', { count: state.overrides.length });
  row.innerHTML =
    `<div class="${ROW_CLASS}-actions" style="display:flex;flex-wrap:wrap;gap:6px">` +
    button(t('Save studio'), 'save', true) +
    button(t('Apply a studio'), 'apply', saved.length > 0) +
    button(t('Update from studio'), 'update', attached && !state.stale) +
    button(t('Detach'), 'detach', attached) +
    '</div>' +
    `<p class="input-notice" role="status">${escapeHtml(note + changed)}</p>`;
}

/** One button press. Every path ends by saying what happened. */
async function run(action: string, deps: StudioActionsDeps, panel: ParentNode): Promise<void> {
  const store = createUserTemplateStore(deps.host);
  const say = (message: string): void => announce(message);
  if (action === 'save') {
    const state = await studioLinkState(studioValuesOf(deps.runtime), store);
    if (state.template) {
      const choice = await choiceDialog({
        title: t('Save studio'),
        message: tRaw('Save this look over {name}, or save it as a new studio?', {
          name: state.template.name,
        }),
        choices: [
          { id: 'new', label: t('New studio') },
          { id: 'over', label: t('Save over it'), primary: true },
        ],
      });
      if (!choice) return;
      if (choice === 'over') {
        const saved = await saveStudioOver(deps.runtime, store, state.template.id, deps.changed);
        say(saved ? tRaw('Saved over {name}.', { name: saved.name }) : t('That studio is gone.'));
        mountStudioActions(panel, deps);
        return;
      }
    }
    const name = await promptDialog({
      title: t('Save studio'),
      message: t('Name this studio, so you can use it in other documents.'),
      confirmLabel: t('Save'),
      value: t('My studio'),
    });
    const clean = String(name ?? '').trim().slice(0, MAX_TEMPLATE_NAME);
    if (!clean) return;
    const studio = await saveStudio(deps.runtime, store, { toolId: deps.toolId, name: clean }, deps.changed);
    say(tRaw('Saved {name}.', { name: studio.name }));
  } else if (action === 'apply') {
    const saved = await listStudios(store, deps.toolId);
    if (!saved.length) return;
    const pick = await choiceDialog({
      title: t('Apply a studio'),
      message: t('The look is applied to this document. Your subject and framing stay as they are.'),
      choices: saved.slice(0, 8).map((studio, i) => ({
        id: studio.id,
        label: studio.name,
        ...(i === 0 ? { primary: true } : {}),
      })),
    });
    const chosen = saved.find((studio) => studio.id === pick);
    if (!chosen) return;
    await applyStudio(deps.runtime, chosen, deps.changed);
    say(tRaw('Applied {name}.', { name: chosen.name }));
  } else if (action === 'update') {
    const result = await updateFromStudio(deps.runtime, store, deps.changed);
    say(
      result === 'updated'
        ? t('Updated from the studio.')
        : result === 'missing'
          ? t('The studio this document used has been deleted. Its look is still here.')
          : t('No studio is in use.')
    );
  } else if (action === 'detach') {
    await detachStudio(deps.runtime, deps.changed);
    say(t('Detached. The look stays in this document.'));
  }
  mountStudioActions(panel, deps);
}
