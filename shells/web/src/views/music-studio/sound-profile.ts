// SPDX-License-Identifier: MPL-2.0
/** Keep a saved sound selection explicit while the music studio remains freely editable. */

import { readSonicRecipe, resolveSonicRecipe } from '../../../../../engine/src/sonic-profile.ts';
import type { SonicRecipeV1 } from '../../../../../packages/core/src/sonic-profile-v1.ts';
import { t } from '../../i18n.ts';
import { type MusicState, musicStateParams, parseMusicState } from '../../lib/music-state.ts';
import { sonicMusicAdapter } from '../../lib/sonic-music.ts';
import { escape as e } from '../../utils.ts';

export function mountMusicSoundProfile(
  page: HTMLElement,
  state: MusicState,
  apply: (next: MusicState) => void,
  independent: () => void
) {
  const el = document.createElement('aside');
  el.className = 'ms-sound-profile';
  el.hidden = true;
  page.prepend(el);
  let recipe: SonicRecipeV1 | undefined,
    invalid = false,
    loading = false,
    disposed = false;
  const matches = () =>
    !!recipe &&
    sonicMusicAdapter.resolve(
      recipe.profile.contexts.find((c) => c.id === recipe!.contextId)!.music.parameters,
      state.seed
    ).parameters === musicStateParams(state);
  const refresh = () => {
    if (disposed) return;
    el.hidden = !recipe && !invalid && !loading;
    if (el.hidden) return;
    const context = recipe?.profile.contexts.find((c) => c.id === recipe?.contextId);
    el.innerHTML = `<div><strong>${e(recipe ? `${recipe.profile.label} · ${context!.label}` : t('Saved sound profile'))}</strong><p role="status">${e(t(loading ? 'Reading the saved profile…' : invalid ? 'The saved sound profile cannot be verified in this build. Keep the original project, or continue with an independent copy.' : matches() ? 'Music choices match this saved profile revision. Listen before release.' : 'These music choices have changed. Reapply the profile, or continue as an independent track.'))}</p>${recipe ? `<details><summary>${t('Sound guidance')}</summary><p>${e(recipe.profile.identity.character)}</p><p>${e(context!.guidance)}</p><p>${e(context!.narration.guidance)}</p><p>${t('Narration and the fixed signature are separate assets in your sequence. The music generator produces the bed only.')}</p><p>${t('Profile revision')}: ${recipe.profile.revision} · ${e(t(recipe.profile.review.state === 'draft' ? 'Draft' : 'Listening review recorded'))}</p><a href="#/start?area=sound">${t('Open Sound settings')}</a></details>` : ''}</div><div class="ms-sound-actions">${recipe ? `<button class="btn btn--sm" type="button" data-sound-new>${t('New composition')}</button><button class="btn btn--sm" type="button" data-sound-reapply>${t('Reapply profile')}</button>` : ''}<button class="btn btn--sm" type="button" data-sound-detach${loading ? ' disabled' : ''}>${t('Make an independent copy')}</button></div>`;
  };
  const clicked = (event: Event) => {
    const button = (event.target as Element).closest('button');
    if (!button) return;
    if (button.hasAttribute('data-sound-detach')) {
      recipe = undefined;
      invalid = false;
      independent();
      refresh();
      return;
    }
    if (!recipe) return;
    const nextSeed = button.hasAttribute('data-sound-new')
      ? crypto.getRandomValues(new Uint32Array(1))[0]!
      : state.seed;
    const context = recipe.profile.contexts.find((c) => c.id === recipe!.contextId)!;
    apply(
      parseMusicState(sonicMusicAdapter.resolve(context.music.parameters, nextSeed).parameters)
    );
    refresh();
  };
  el.addEventListener('click', clicked);
  return {
    refresh,
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
      if (loading) throw new Error(t('Wait for the saved sound profile to load.'));
      if (invalid || (recipe && !matches()))
        throw new Error(
          t('Reapply the sound profile or continue independently before saving or exporting.')
        );
      if (!recipe) return undefined;
      const resolved = await resolveSonicRecipe(
        recipe.profile,
        { documentContext: recipe.contextId, seed: state.seed },
        sonicMusicAdapter
      );
      if (!resolved.recipe) throw new Error(resolved.findings.map((f) => f.message).join(' '));
      if (resolved.recipe.music.parameters !== musicStateParams(state))
        throw new Error(
          t('The composition changed while its profile was being checked. Try again.')
        );
      return resolved.recipe;
    },
    teardown() {
      disposed = true;
      el.removeEventListener('click', clicked);
      el.remove();
    },
  };
}
