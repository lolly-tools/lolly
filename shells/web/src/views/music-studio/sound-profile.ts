// SPDX-License-Identifier: MPL-2.0
/**
 * The music generator's line about a design system's sound (#/music), in one of two
 * kinds, above the bar.
 *
 * EDITING A USE. The Sound room's Edit in the music generator opens the generator on a
 * use's settings with `sound=edit` (lib/sound-edit-handoff.ts). The line says whose sound
 * is being edited, and offers Save to this use and Cancel; both go back to the room,
 * which takes the new settings or none.
 *
 * A PROJECT MADE FROM A SOUND. Make a music project keeps the use, the sound's version
 * and the exact settings with the project. New tune draws a new seed and keeps the
 * settings. A change to the settings is allowed, but before saving or downloading the
 * person either puts the sound back or keeps the tune as their own: a file never claims a
 * sound it no longer plays. The original project stays as it was.
 */

import type { SonicRecipeV1 } from '@lolly-tools/core/sonic-profile-v1';
import { readSonicRecipe, resolveSonicRecipe } from '../../../../../engine/src/sonic-profile.ts';
import { t, tRaw } from '../../i18n.ts';
import { icon } from '../../lib/icons.ts';
import { type MusicState, musicStateParams, parseMusicState } from '../../lib/music-state.ts';
import { finishSoundEdit, readSoundEdit, SOUND_ROOM_HREF } from '../../lib/sound-edit-handoff.ts';
import { sonicMusicAdapter } from '../../lib/sonic-music.ts';
import { escape as e } from '../../utils.ts';

export interface MusicSoundProfileOptions {
  /** The address carried `sound=edit`: show the editing line when a trip is open. */
  editing?: boolean;
  /** Go to an address in the app. Defaults to setting location.hash. */
  navigate?(href: string): void;
}

export function mountMusicSoundProfile(
  page: HTMLElement,
  state: MusicState,
  apply: (next: MusicState) => void,
  independent: () => void,
  opts: MusicSoundProfileOptions = {}
) {
  const el = document.createElement('aside');
  el.className = 'ms-sound-profile surface surface--floating';
  el.hidden = true;
  page.prepend(el);
  const navigate = opts.navigate ?? ((href: string) => { location.hash = href; });
  const trip = opts.editing ? readSoundEdit() : null;
  let recipe: SonicRecipeV1 | undefined,
    invalid = false,
    loading = false,
    disposed = false;
  const contextOf = (r: SonicRecipeV1) => r.profile.contexts.find((c) => c.id === r.contextId)!;
  const matches = () =>
    !!recipe && sonicMusicAdapter.resolve(contextOf(recipe).music.parameters, state.seed).parameters === musicStateParams(state);

  /** The line's one raw-HTML sink: every value in it went through escape(). */
  const render = (html: string): void => { el.innerHTML = html; };
  const editLine = (): string => {
    const use = trip!.profile.contexts.find((c) => c.id === trip!.contextId)?.label ?? '';
    return `<span class="ms-sound-icon" aria-hidden="true">${icon('music', { size: 18 })}</span>`
      + `<div class="ms-sound-text"><strong>${e(tRaw('Editing {use} for {system}', { use, system: trip!.label }))}</strong>`
      + `<p>${t('Change anything here, then save it to this use.')}</p></div>`
      + `<div class="ms-sound-actions"><button class="btn btn--sm btn--ghost" type="button" data-sound-cancel>${t('Cancel')}</button>`
      + `<button class="btn btn--sm btn--primary" type="button" data-sound-keep>${t('Save to this use')}</button></div>`;
  };
  const projectLine = (): string => {
    const context = recipe ? contextOf(recipe) : undefined;
    const same = matches();
    const line = loading
      ? t('Reading the sound this project was made from…')
      : invalid
        ? t('This project’s sound cannot be read by this version of Lolly. Keep the tune as your own, or open the project in a newer version.')
        : same
          ? t('Made from this sound. New tune keeps the sound.')
          : t('Changed since. Put the sound back, or keep the tune as your own.');
    const notes = recipe
      ? [recipe.profile.identity.character, context!.guidance, context!.narration.guidance].filter(Boolean)
      : [];
    return `<span class="ms-sound-icon" aria-hidden="true">${icon('music', { size: 18 })}</span>`
      + `<div class="ms-sound-text"><strong>${e(recipe ? `${recipe.profile.label} · ${context!.label}` : t('A design system’s sound'))}</strong>`
      + `<p role="status">${e(line)}</p>`
      + (notes.length ? `<details class="ms-sound-notes"><summary>${t('Sound notes')}</summary>${notes.map((n) => `<p>${e(n)}</p>`).join('')}<p><a href="${SOUND_ROOM_HREF}">${t('Open Sound in Design System Setup')}</a></p></details>` : '')
      + '</div><div class="ms-sound-actions">'
      + (recipe ? `<button class="btn btn--sm" type="button" data-sound-new>${t('New tune')}</button>` : '')
      + (recipe && !same ? `<button class="btn btn--sm" type="button" data-sound-reapply>${t('Put the sound back')}</button>` : '')
      + `<button class="btn btn--sm btn--ghost" type="button" data-sound-detach${loading ? ' disabled' : ''}>${t('Keep as my own')}</button></div>`;
  };
  const refresh = () => {
    if (disposed) return;
    if (trip) {
      el.hidden = false;
      el.dataset.kind = 'edit';
      render(editLine());
      return;
    }
    el.hidden = !recipe && !invalid && !loading;
    if (el.hidden) return;
    el.dataset.kind = 'project';
    render(projectLine());
  };
  const clicked = (event: Event) => {
    const button = (event.target as Element).closest('button');
    if (!button) return;
    if (button.hasAttribute('data-sound-keep')) {
      finishSoundEdit({ parameters: musicStateParams(state) });
      navigate(SOUND_ROOM_HREF);
      return;
    }
    if (button.hasAttribute('data-sound-cancel')) {
      finishSoundEdit({ cancelled: true });
      navigate(SOUND_ROOM_HREF);
      return;
    }
    if (button.hasAttribute('data-sound-detach')) {
      recipe = undefined;
      invalid = false;
      independent();
      refresh();
      return;
    }
    if (!recipe) return;
    const nextSeed = button.hasAttribute('data-sound-new') ? crypto.getRandomValues(new Uint32Array(1))[0]! : state.seed;
    apply(parseMusicState(sonicMusicAdapter.resolve(contextOf(recipe).music.parameters, nextSeed).parameters));
    refresh();
  };
  el.addEventListener('click', clicked);
  refresh();
  return {
    refresh,
    /** Whether this page is editing a use for the Sound room (the address keeps `sound=edit`). */
    editing: (): boolean => !!trip,
    pending() {
      loading = true;
      refresh();
    },
    failed() {
      loading = false;
      invalid = true;
      refresh();
    },
    async load(data: unknown) {
      const raw = (data as { __musicStudio?: { sonic?: unknown } } | null)?.__musicStudio?.sonic;
      if (raw !== undefined) {
        recipe = (await readSonicRecipe(raw, sonicMusicAdapter)) ?? undefined;
        invalid = !recipe;
      }
      loading = false;
      refresh();
    },
    async retained(): Promise<SonicRecipeV1 | undefined> {
      if (loading) throw new Error(t('Wait for the sound this project was made from to load.'));
      if (invalid || (recipe && !matches()))
        throw new Error(t('Put the sound back, or keep the tune as your own, before saving or downloading.'));
      if (!recipe) return undefined;
      const resolved = await resolveSonicRecipe(recipe.profile, { documentContext: recipe.contextId, seed: state.seed }, sonicMusicAdapter);
      if (!resolved.recipe) throw new Error(resolved.findings.map((f) => f.message).join(' '));
      if (resolved.recipe.music.parameters !== musicStateParams(state))
        throw new Error(t('The tune changed while its sound was being checked. Try again.'));
      return resolved.recipe;
    },
    teardown() {
      disposed = true;
      el.removeEventListener('click', clicked);
      el.remove();
    },
  };
}
