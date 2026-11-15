// SPDX-License-Identifier: MPL-2.0

import type { SpeechVoiceInfo } from '@lolly-tools/core/host-v1';
import {
  readSonicProfile,
  resolveSonicRecipe,
  sonicProfileOf,
  withSonicProfile,
} from '../../../../../../engine/src/sonic-profile.ts';
import type { SonicProfileV1 } from '../../../../../../packages/core/src/sonic-profile-v1.ts';
import { t } from '../../../i18n.ts';
import { escape as e } from '../../../utils.ts';
import { musicProjectHref, musicProjectRecord, newMusicSlot } from '../../music-project.ts';
import { parseMusicState } from '../../music-state.ts';
import { sonicMusicAdapter, sonicMusicFromLink, starterSonicProfile } from '../../sonic-music.ts';
import { sonicContextFields, sonicIdentityFields } from '../sonic-form.ts';
import type { StudioState } from '../studio-state.ts';
import { type UsageHost, usageRevision } from '../usage-model.ts';

export function mountSoundRoom(
  el: HTMLElement,
  opts: { host: UsageHost; readonly?: boolean; studio?: StudioState; changed?(): void }
) {
  let profile: SonicProfileV1 | null = null,
    contextId = '',
    seed = 2024;
  let revision: Awaited<ReturnType<typeof usageRevision>> | undefined;
  let voices: SpeechVoiceInfo[] = [],
    assets: Array<{ id: string; name: string }> = [];
  let disposed = false,
    dirty = false,
    saved = false,
    working = false,
    sequence = 0;
  let abort: AbortController | undefined, url: string | undefined;
  let speechUnavailable = !opts.host.speech;
  let sample =
    'Here is one clear idea. Give the words room to land, and let the music support the story.';
  const context = () => profile!.contexts.find((c) => c.id === contextId)!;
  const status = (message: string) => {
    const out = el.querySelector('[data-sound-status]');
    if (out) out.textContent = message;
  };
  const stop = () => {
    sequence++;
    abort?.abort();
    abort = undefined;
    el.querySelectorAll('audio').forEach((audio) => {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    });
    if (url) URL.revokeObjectURL(url);
    url = undefined;
    working = false;
    el.querySelectorAll<HTMLButtonElement>('[data-sound-listen]').forEach((button) => {
      button.disabled = false;
    });
  };
  const updateSave = () => {
    const button = el.querySelector<HTMLButtonElement>('[data-sound-action="save"]');
    if (button) {
      button.disabled = !dirty || working;
      button.textContent = t(saved ? 'Save sound changes' : 'Save these starting points');
    }
    const badge = el.querySelector('[data-sound-review]');
    if (badge)
      badge.textContent = t(
        dirty
          ? 'Unsaved draft'
          : profile?.review.state === 'reviewed'
            ? 'Listening review recorded'
            : 'Draft sound'
      );
  };
  const paint = () => {
    stop();
    if (!profile) return;
    const current = context();
    el.classList.add('sound-room');
    el.innerHTML = `<header class="sound-head"><div><p class="start-eyebrow">${e(profile.label)}</p><h2>${t('Sound')}</h2><p>${t('A familiar character, with a fresh composition for each story.')}</p></div><span class="sound-badge" data-sound-review></span></header>
      ${!saved ? `<div class="sound-intro"><h3>${t('Start by listening')}</h3><p>${t('Compare three starting points, then shape your own sound. Nothing is saved until you choose to keep a direction.')}</p></div>` : ''}
      <form data-sound-form>
      <section class="sound-listening"><div class="sound-grid"><label class="sound-field"><span>${t('Use this sound for')}</span><select data-sound-context>${profile.contexts.map((c) => `<option value="${e(c.id)}"${c.id === current.id ? ' selected' : ''}>${e(c.label)}${c.id === profile!.defaultContext ? ` (${t('default')})` : ''}</option>`).join('')}</select></label><div class="sound-actions">${!opts.readonly ? `<button type="button" class="btn" data-sound-action="add">${t('Add a use')}</button><button type="button" class="btn" data-sound-action="default"${current.id === profile.defaultContext ? ' disabled' : ''}>${t('Make default')}</button>` : ''}</div></div>
      <h3>${e(current.label)}</h3><p>${e(current.purpose)}</p><div class="sound-actions"><button type="button" class="btn btn--primary" data-sound-listen="music">${t('Listen to music')}</button><button type="button" class="btn" data-sound-listen="voice">${t('Listen with narration')}</button><button type="button" class="btn" data-sound-action="new">${t('New composition')}</button><button type="button" class="btn" data-sound-action="stop">${t('Stop')}</button></div><audio controls preload="none" aria-label="${e(t('Sound audition'))}"></audio>
      <p class="sound-hint">${t('A short excerpt with a fade, not a composed ending. Compare the same seed across uses; New composition changes the notes while retaining the saved music choices.')}</p><details class="sound-details"><summary>${t('Narration sample')}</summary><label class="sound-field"><span>${t('Text to hear with the music')}</span><textarea data-sound-sample rows="3" maxlength="600">${e(sample)}</textarea></label><p>${t('This sample stays in this room. The profile keeps voice and pronunciation choices, not your sample text.')}</p></details></section>
      <fieldset${opts.readonly ? ' disabled' : ''}><details class="sound-details"><summary>${t('Your sound identity')}</summary>${sonicIdentityFields(profile)}</details></fieldset>
      <fieldset${opts.readonly ? ' disabled' : ''}>${sonicContextFields(current, voices, assets)}</fieldset>
      <details class="sound-details"><summary>${t('Review and repeatability')}</summary><p>${t('The profile stores musical choices and guidance. Listening is still needed for recognition, cultural fit and intelligibility. Every composition needs a release review.')}</p><p>${t('Seed')}: <code>${seed}</code> · ${t('Profile revision')}: ${profile.revision}</p>${profile.review.state === 'reviewed' ? `<p>${e(profile.review.reviewer)} · ${e(profile.review.at)}</p><p>${e(profile.review.notes)}</p>` : `<p>${t('No listening review has been recorded for this profile.')}</p>`}${!opts.readonly ? `<label class="sound-field"><span>${t('Reviewer name')}</span><input data-sound-reviewer maxlength="160"></label><label class="sound-field"><span>${t('What did you listen to and decide?')}</span><textarea data-sound-review-notes rows="3" maxlength="4000"></textarea><small>${t('Name the uses, seeds, listening conditions and remaining concerns. This records a human review of the profile, not approval of every future track.')}</small></label><button type="button" class="btn" data-sound-action="review">${t('Record listening review')}</button>` : ''}<p>${t('Saved projects retain this profile revision and exact recipe. Keep a rendered audio file when you need identical sound across future generator versions. Private guidance is not added to a music share link.')}</p></details>
      <p class="sound-status" role="status" aria-live="polite" data-sound-status></p><footer class="sound-actions">${!opts.readonly ? `<button type="submit" class="btn btn--primary" data-sound-action="save">${t('Save sound changes')}</button><button type="button" class="btn" data-sound-action="discard">${t('Reload saved sound')}</button>` : `<span>${t('Read-only design system')}</span>`}<button type="button" class="btn" data-sound-action="project">${t('Make a music project')}</button></footer></form>`;
    updateSave();
  };
  const refresh = async () => {
    if (dirty || working || disposed) return;
    try {
      const current = ++sequence;
      const next = opts.readonly
        ? { doc: (await opts.host.tokens.snapshot()).document, snapshot: undefined }
        : await usageRevision(opts.host);
      const state = sonicProfileOf(next.doc);
      if (disposed || current !== sequence) return;
      if (state.state === 'unsupported') {
        el.innerHTML = `<h2>${t('Sound')}</h2><p>${t('This sound profile needs a compatible editor. Its original data has been kept.')}</p>`;
        return;
      }
      if (opts.readonly && state.state === 'absent') {
        el.innerHTML = `<h2>${t('Sound')}</h2><p>${t('No sound profile has been published with this design system.')}</p>`;
        return;
      }
      revision = next.snapshot ? (next as Awaited<ReturnType<typeof usageRevision>>) : undefined;
      profile = state.profile ?? starterSonicProfile('sound', 'Your sound identity');
      saved = !!state.profile;
      if (!profile.contexts.some((c) => c.id === contextId)) contextId = profile.defaultContext;
      // Empty starting points are kept only by an explicit save.
      dirty = !saved && !opts.readonly;
      paint();
    } catch (error) {
      el.innerHTML = `<h2>${t('Sound')}</h2><p role="status">${e((error as Error).message)}</p>`;
    }
  };
  const resolve = async () => {
    if (!profile) throw new Error(t('Load a sound profile first.'));
    const result = await resolveSonicRecipe(
      profile,
      { documentContext: contextId, seed },
      sonicMusicAdapter
    );
    if (!result.recipe) throw new Error(result.findings.map((f) => f.message).join(' '));
    return result.recipe;
  };
  const listen = async (narrated: boolean) => {
    if (narrated && speechUnavailable) {
      status(
        t(
          'Speech is unavailable in this shell or disabled by its AI settings. Music previews remain available.'
        )
      );
      return;
    }
    if (narrated && opts.readonly && !context().narration.voice) {
      status(t('No narration voice is assigned to this read-only profile.'));
      return;
    }
    if (narrated && !context().narration.voice) {
      const select = el.querySelector<HTMLSelectElement>('[data-sound-field="narration.voice"]');
      const details = select?.closest('details');
      if (details) details.open = true;
      select?.focus();
      status(t('Choose a voice, then listen with narration.'));
      return;
    }
    stop();
    const current = sequence;
    const controller = new AbortController();
    abort = controller;
    working = true;
    el.querySelectorAll<HTMLButtonElement>('[data-sound-listen]').forEach((button) => {
      button.disabled = true;
    });
    updateSave();
    status(
      t(
        narrated
          ? 'Preparing the voice and music. First use may take a while.'
          : 'Rendering this composition…'
      )
    );
    try {
      const recipe = await resolve();
      const { auditionSonicRecipe } = await import('../../sonic-preview.ts');
      const blob = await auditionSonicRecipe(
        recipe,
        opts.host,
        controller.signal,
        narrated ? sample : undefined
      );
      if (disposed || current !== sequence) return;
      url = URL.createObjectURL(blob);
      const audio = el.querySelector('audio')!;
      audio.src = url;
      await audio.play().catch(() => {
        /* The visible native control remains available. */
      });
      status(t('Ready to listen. Check the feeling, distracting sounds and clarity of the words.'));
    } catch (error) {
      if (!controller.signal.aborted && current === sequence)
        status(
          /local_files_only|no available backend|voice fetch failed/.test((error as Error).message)
            ? t(
                'Speech is unavailable in this installation. Check that its local model and audio runtime are installed, then try again. Music previews remain available.'
              )
            : (error as Error).message
        );
    } finally {
      if (current === sequence) {
        working = false;
        el.querySelectorAll<HTMLButtonElement>('[data-sound-listen]').forEach((button) => {
          button.disabled = false;
        });
        updateSave();
      }
    }
  };
  const save = async (recordReview = false) => {
    if (
      opts.readonly ||
      (!dirty && !recordReview) ||
      working ||
      !profile ||
      !revision ||
      !opts.studio
    )
      return;
    if (!el.querySelector<HTMLFormElement>('form')!.reportValidity()) return;
    working = true;
    const form = el.querySelector<HTMLFormElement>('form')!;
    form.inert = true;
    updateSave();
    try {
      const next = structuredClone(profile);
      next.revision = saved ? next.revision + 1 : 1;
      next.review = { state: 'draft' };
      if (recordReview) {
        if (dirty || !saved)
          throw new Error(t('Save your changes before recording a listening review.'));
        const reviewer = el.querySelector<HTMLInputElement>('[data-sound-reviewer]')!.value.trim();
        const notes = el
          .querySelector<HTMLTextAreaElement>('[data-sound-review-notes]')!
          .value.trim();
        if (!reviewer || !notes)
          throw new Error(t('Enter the reviewer and listening notes before recording the review.'));
        next.review = { state: 'reviewed', reviewer, notes, at: new Date().toISOString() };
      }
      if (!readSonicProfile(next))
        throw new Error(t('Check the names, pronunciation notes and number ranges before saving.'));
      const candidate = await opts.host.brandAdoption.prepare(revision.snapshot, {
        doc: withSonicProfile(revision.doc, next),
      });
      await opts.studio.load();
      await opts.studio.checkpoint(t('Before editing sound'));
      await opts.host.brandAdoption.commit(candidate, { recovery: false });
      await opts.studio.load();
      dirty = false;
      working = false;
      opts.changed?.();
      await refresh();
      status(
        t('Sound saved with your design system. Listen to new compositions before releasing them.')
      );
    } catch (error) {
      status((error as Error).message);
    } finally {
      form.inert = false;
      working = false;
      updateSave();
    }
  };
  const edit = (target: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement) => {
    if (!profile || opts.readonly || !target.dataset.soundField) return;
    stop();
    const path = target.dataset.soundField;
    const c = context();
    const value = target.value;
    if (path.startsWith('music.')) {
      if (c.music.adapter !== sonicMusicAdapter.id) {
        status(t('These music settings need a compatible editor. They have been kept.'));
        return;
      }
      const params = new URLSearchParams(c.music.parameters);
      const key = path.slice(6);
      if (value === '') params.delete(key);
      else params.set(key, value);
      c.music.parameters = params.toString();
    } else if (path === 'signature.resource') {
      if (value) c.signature.resource = { type: 'asset', id: value };
      else delete c.signature.resource;
    } else if (path === 'pronunciations') {
      c.narration.pronunciations = value
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => {
          const at = line.indexOf('=');
          return {
            written: at < 0 ? line.trim() : line.slice(0, at).trim(),
            spoken: at < 0 ? '' : line.slice(at + 1).trim(),
          };
        });
    } else {
      const [group, key] = path.split('.') as [string, string];
      const object =
        group === 'identity'
          ? profile.identity
          : group === 'context'
            ? c
            : group === 'narration'
              ? c.narration
              : c.signature;
      if (Object.hasOwn(object, key))
        Reflect.set(object, key, target.type === 'number' ? Number(value) : value);
    }
    profile.review = { state: 'draft' };
    dirty = true;
    updateSave();
    status(t('Unsaved changes. Save when this direction feels right.'));
  };
  const onInput = (event: Event) => {
    const target = event.target as HTMLInputElement;
    if (target.hasAttribute('data-sound-sample')) {
      sample = target.value;
      stop();
      return;
    }
    if (target.tagName !== 'SELECT') edit(target);
  };
  const onChange = (event: Event) => {
    const target = event.target as HTMLSelectElement;
    if (target.hasAttribute('data-sound-context')) {
      contextId = target.value;
      paint();
    } else if (target.tagName === 'SELECT') edit(target);
  };
  const onClick = async (event: Event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>('button');
    if (!button || button.disabled || !profile) return;
    if (button.dataset.soundListen) {
      await listen(button.dataset.soundListen === 'voice');
      return;
    }
    const action = button.dataset.soundAction;
    if (action === 'save') return;
    if (action === 'review') {
      await save(true);
      return;
    }
    try {
      if (action === 'apply-music' && !opts.readonly) {
        const parameters = sonicMusicFromLink(
          el.querySelector<HTMLInputElement>('[data-sound-music-link]')!.value
        );
        context().music = { adapter: sonicMusicAdapter.id, parameters };
        seed = parseMusicState(parameters).seed;
        profile.review = { state: 'draft' };
        dirty = true;
        paint();
        status(t('Music choices applied. Listen and save when ready.'));
      }
      if (action === 'stop') {
        stop();
        status(t('Stopped.'));
      }
      if (action === 'new') {
        seed = crypto.getRandomValues(new Uint32Array(1))[0]!;
        paint();
        await listen(false);
      }
      if (action === 'discard') {
        dirty = false;
        stop();
        await refresh();
      }
      if (action === 'default' && !opts.readonly) {
        profile.defaultContext = contextId;
        profile.review = { state: 'draft' };
        dirty = true;
        paint();
      }
      if (action === 'add' && !opts.readonly) {
        if (profile.contexts.length >= 24)
          throw new Error(t('This profile already has 24 uses. Edit an existing use.'));
        const copy = structuredClone(context());
        copy.id = `use-${crypto.randomUUID()}`;
        copy.label = t('New use');
        profile.contexts.push(copy);
        contextId = copy.id;
        profile.review = { state: 'draft' };
        dirty = true;
        paint();
      }
      if (action === 'signature') {
        const ref = context().signature.resource;
        if (!ref) throw new Error(t('Choose a signature audio file first.'));
        stop();
        const current = sequence;
        const asset = await opts.host.assets.get(ref.id);
        if (disposed || current !== sequence) return;
        if (asset.format === 'lofi')
          throw new Error(
            t('Render this procedural tune to an audio file before using it as a fixed signature.')
          );
        const audio = el.querySelector('audio')!;
        audio.src = asset.url;
        await audio.play();
        status(t('Playing the signature by itself.'));
      }
      if (action === 'project') {
        if (dirty) throw new Error(t('Save your sound changes before making a music project.'));
        const recipe = await resolve();
        const slot = newMusicSlot();
        await opts.host.state.save(
          slot,
          musicProjectRecord(
            parseMusicState(recipe.music.parameters),
            `${profile.label} · ${context().label}`,
            recipe
          )
        );
        location.hash = musicProjectHref(slot);
      }
    } catch (error) {
      status((error as Error).message);
    }
  };
  const onSubmit = (event: Event) => {
    event.preventDefault();
    void save();
  };
  el.addEventListener('input', onInput);
  el.addEventListener('change', onChange);
  el.addEventListener('click', onClick);
  el.addEventListener('submit', onSubmit);
  void Promise.allSettled([
    opts.host.speech?.voices() ?? Promise.resolve([]),
    opts.host.assets.query({ type: 'audio' }),
  ]).then((results) => {
    if (disposed) return;
    if (results[0].status === 'fulfilled') voices = results[0].value;
    else speechUnavailable = true;
    if (results[1].status === 'fulfilled')
      assets = results[1].value.map((a) => ({
        id: a.id,
        name: typeof a.meta?.name === 'string' ? a.meta.name : a.id,
      }));
    // Do not replace a focused form while someone is typing.
    if (!el.contains(document.activeElement) && profile && !working) paint();
  });
  void refresh();
  return {
    refresh,
    suspend: stop,
    teardown() {
      disposed = true;
      stop();
      el.removeEventListener('input', onInput);
      el.removeEventListener('change', onChange);
      el.removeEventListener('click', onClick);
      el.removeEventListener('submit', onSubmit);
    },
  };
}
export type SoundRoom = ReturnType<typeof mountSoundRoom>;
