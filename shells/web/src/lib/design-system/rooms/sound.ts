// SPDX-License-Identifier: MPL-2.0
/**
 * The Sound room (#/start?area=sound): the design system's sound, chosen by listening.
 *
 * It opens on the starting sounds (lib/sonic-music.ts SONIC_DIRECTIONS), each a card
 * with a play button. Choosing one makes it the sound of every use, and the uses appear:
 * chips that each play, the use picked showing its purpose and its music in plain words.
 * The music itself is shaped in the music generator: Edit in the music generator takes
 * the use there with the room's draft (lib/sound-edit-handoff.ts) and comes back with the
 * new settings or none. The voice, the notes and signature, and the brand's character and
 * listening review fold away below. Markup: rooms/sound-html.ts.
 *
 * One player serves the whole room: an audio element that is never in the page, so the
 * play buttons are the only controls and starting one stops the other.
 *
 * Saving writes the profile into the design system as a new revision, with a checkpoint
 * in the same history the other rooms use (engine/src/sonic-profile.ts withSonicProfile).
 * Any change returns the profile to a draft, so a listening review always belongs to
 * the version that was heard. Nothing is saved until Save sound.
 */
import type { SpeechVoiceInfo } from '@lolly-tools/core/host-v1';
import type { SonicContextV1, SonicNarrationV1, SonicProfileV1 } from '@lolly-tools/core/sonic-profile-v1';
import { readSonicProfile, resolveSonicRecipe, sonicProfileOf, withSonicProfile } from '../../../../../../engine/src/sonic-profile.ts';
import type { LofiMood } from '../../../../../../engine/src/lofi-compose.ts';
import { perfUiOn } from '../../../feature-flags.ts';
import { prefersReducedMotion } from '../../a11y-prefs.ts';
import { showPillSlider } from '../../../components/pill-slider.ts';
import { t, tRaw } from '../../../i18n.ts';
import { musicProjectHref, musicProjectRecord, newMusicSlot } from '../../music-project.ts';
import { musicStateParams, parseMusicState } from '../../music-state.ts';
import { staggerReveal } from '../../reveal.ts';
import { clearSoundEdit, readSoundEdit, soundEditHref, writeSoundEdit } from '../../sound-edit-handoff.ts';
import { applySonicDirection, applySonicMix, SONIC_DIRECTIONS, SONIC_MIX as MIXED, sonicMusicAdapter, sonicMusicFromLink, sonicStartOf, starterSonicProfile } from '../../sonic-music.ts';
import type { StudioState } from '../studio-state.ts';
import { type UsageHost, usageRevision } from '../usage-model.ts';
import { percentText, saveStateText, soundMessageHtml, soundRoomHtml, speedText, type SoundViewModel } from './sound-html.ts';

/** A genre's wash for a card: the stronger stop, the softer one, their angle, and the text colour when it is not the theme's. */
export interface SoundWash { from: string; to: string; angle: number; ink?: string }

export interface SoundRoomOptions {
  host: UsageHost;
  readonly?: boolean;
  studio?: StudioState;
  changed?(): void;
  /** The genres' washes for this surface and text colour (views/music-studio/genre-colours.ts), passed in by the view. */
  washes?(surface: string, text: string): Promise<ReadonlyMap<LofiMood, SoundWash>>;
  /** Make a preview: the music, or the music under the voice. Defaults to lib/sonic-preview.ts. */
  audition?(parameters: string | readonly string[], signal: AbortSignal, narration?: { settings: SonicNarrationV1; script: string }): Promise<Blob>;
  /** The one player. Defaults to an audio element that is never in the page. */
  audio?: Pick<HTMLAudioElement, 'play' | 'pause' | 'addEventListener' | 'removeEventListener' | 'currentTime' | 'duration'> & { src: string };
  /** Go to an address in the app. Defaults to setting location.hash. */
  navigate?(href: string): void;
}

const DEFAULT_SAMPLE = 'Here is one clear idea. Give the words room to land, and let the music support the story.';
/** How many previews are kept, so a second play starts at once. */
const KEPT_PREVIEWS = 6;
const randomSeed = (): number => crypto.getRandomValues(new Uint32Array(1))[0]!;

/** Which card is chosen: a starting sound's id, the mix, or none. */
export function chosenOf(profile: SonicProfileV1): string | null {
  const start = sonicStartOf(profile);
  return !start ? null : start.mode === 'mixed' ? MIXED : start.sound;
}

export function mountSoundRoom(el: HTMLElement, opts: SoundRoomOptions) {
  const readonly = !!opts.readonly;
  let profile: SonicProfileV1 | null = null;
  let contextId = '';
  let label = '';
  let systemId = '';
  /** The saved revision, or null when this design system has no sound yet. */
  let savedRevision: number | null = null;
  let revision: Awaited<ReturnType<typeof usageRevision>> | undefined;
  let picked = false, saved = false, dirty = false, working = false, disposed = false;
  let withVoice = false, renaming = false, reviewing = false;
  let renameBackup: { label: string; purpose: string } | null = null;
  let sample = DEFAULT_SAMPLE;
  let voices: SpeechVoiceInfo[] = [];
  let audioAssets: Array<{ id: string; name: string }> = [];
  let speech = !!opts.host.speech;
  let sequence = 0;
  let pendingStatus = '';
  /** A tune drawn by Another tune, per use: heard in the room and carried to the generator. */
  const drawn = new Map<string, number>();
  const open = new Set<string>();
  const navigate = opts.navigate ?? ((href: string) => { location.hash = href; });

  // ── the one player ─────────────────────────────────────────────────────────
  let audio = opts.audio ?? null;
  let playingKey = '', playState: '' | 'loading' | 'playing' = '', playAbort: AbortController | undefined, playUrl = '';
  const kept = new Map<string, Blob>();
  const player = () => {
    if (!audio) {
      const element = new Audio();
      element.preload = 'none';
      audio = element;
    }
    return audio;
  };
  const markButtons = (): void => {
    for (const button of el.querySelectorAll<HTMLButtonElement>('[data-play]')) {
      const on = button.dataset.play === playingKey;
      button.dataset.state = on ? playState : '';
      button.setAttribute('aria-pressed', String(on && playState !== ''));
    }
  };
  const stop = (): void => {
    playAbort?.abort();
    playAbort = undefined;
    if (audio) {
      audio.pause();
      // An empty src asks the element to load the page's own address; dropping the attribute does not.
      if (typeof HTMLMediaElement !== 'undefined' && audio instanceof HTMLMediaElement) { audio.removeAttribute('src'); audio.load(); } else audio.src = '';
    }
    if (playUrl) URL.revokeObjectURL(playUrl);
    playUrl = '';
    playingKey = '';
    playState = '';
    markButtons();
  };
  const onEnded = (): void => { if (playingKey) stop(); };
  const onTime = (): void => {
    const button = el.querySelector<HTMLElement>(`[data-play="${CSS.escape(playingKey)}"]`);
    if (button && audio && audio.duration > 0) button.style.setProperty('--sound-progress', String(Math.min(1, audio.currentTime / audio.duration)));
  };
  let listening = false;
  const listen = (): void => {
    if (listening) return;
    listening = true;
    player().addEventListener('ended', onEnded);
    player().addEventListener('timeupdate', onTime);
  };
  /** `offer`: when the voice model is missing, offer its download once and try again. */
  /** `parameters`: one sound, or several to hear in turn (the mix card's preview). */
  async function play(key: string, parameters: string | readonly string[], narration?: { settings: SonicNarrationV1; script: string }, offer = true): Promise<void> {
    if (playingKey === key) { stop(); return; }
    stop();
    listen();
    const controller = new AbortController();
    playAbort = controller;
    playingKey = key;
    playState = 'loading';
    markButtons();
    const cacheKey = JSON.stringify([parameters, narration ?? null]);
    try {
      let blob = kept.get(cacheKey);
      if (!blob) {
        const make = opts.audition ?? (async (p: string | readonly string[], signal: AbortSignal, n?: { settings: SonicNarrationV1; script: string }) => {
          const preview = await import('../../sonic-preview.ts');
          return typeof p === 'string' ? preview.auditionSound(p, opts.host, signal, n) : preview.auditionMedley(p, signal);
        });
        blob = await make(parameters, controller.signal, narration);
        kept.set(cacheKey, blob);
        if (kept.size > KEPT_PREVIEWS) kept.delete(kept.keys().next().value!);
      }
      if (controller.signal.aborted || disposed || playingKey !== key) return;
      playUrl = URL.createObjectURL(blob);
      const out = player();
      out.src = playUrl;
      playState = 'playing';
      markButtons();
      await out.play();
    } catch (error) {
      if (controller.signal.aborted || playingKey !== key) return;
      stop();
      if (offer && narration && /local_files_only|no available backend|voice fetch failed/.test((error as Error).message)) {
        // The voice model is not on this device yet: offer the download here, then play.
        const { ensureModel } = await import('../../model-offer.ts');
        if (await ensureModel('speech', { reason: t('Hearing a voice with your sound') })) { if (!disposed) void play(key, parameters, narration, false); }
        else status(t('The voice is not on this device yet. Music without a voice still plays.'));
        return;
      }
      status((error as Error).message);
    }
  }

  // ── reading the model ──────────────────────────────────────────────────────
  const context = (): SonicContextV1 => profile!.contexts.find((c) => c.id === contextId)!;
  /** The settings a use plays now: its own, with the tune Another tune drew. */
  const playing = (c: SonicContextV1): string => {
    const seed = drawn.get(c.id);
    if (seed === undefined) return c.music.parameters;
    const state = parseMusicState(c.music.parameters);
    state.seed = seed;
    return musicStateParams(state);
  };
  const model = (): SoundViewModel => ({
    label, profile: profile!, contextId, picked, saved, dirty, readonly, speech,
    chosen: picked ? chosenOf(profile!) : null,
    voices, audio: audioAssets, withVoice, sample, renaming, reviewing, open, playing,
  });
  /** What the room last said; shown in the floating foot until the room paints again. */
  let statusText = '';
  const status = (message: string): void => { statusText = message; syncSave(); };
  /** Show the save state, what just happened and the save buttons without painting the room again (typing keeps its focus). */
  const syncSave = (): void => {
    const text = saveStateText({ saved, dirty, picked, readonly });
    for (const state of el.querySelectorAll<HTMLElement>('[data-sound-state]')) { state.textContent = text; state.hidden = !text; }
    for (const bar of el.querySelectorAll<HTMLElement>('[data-savebar]')) {
      bar.hidden = !dirty;
      for (const button of bar.querySelectorAll<HTMLButtonElement>('button')) button.disabled = working;
    }
    const out = el.querySelector('[data-sound-status]');
    if (out) out.textContent = statusText;
    const top = el.querySelector<HTMLElement>('[data-bar]');
    if (top) top.hidden = !picked && !statusText;
    // The room's end repeats the top while there is something to save or to say.
    const end = el.querySelector<HTMLElement>('[data-endbar]');
    if (end) {
      end.hidden = !picked || (!dirty && !statusText);
      const words = end.querySelector('[data-endbar-text]');
      if (words) words.textContent = statusText || text;
    }
  };
  const changed = (): void => {
    if (!profile) return;
    profile.review = { state: 'draft' };
    dirty = true;
    syncSave();
  };

  // ── painting ───────────────────────────────────────────────────────────────
  async function tint(): Promise<void> {
    if (!opts.washes) return;
    const card = el.querySelector<HTMLElement>('.sound-card');
    if (!card) return;
    // The card's own surface and text, as drawn without a wash (a repaint after a change of theme).
    const tinted = card.classList.contains('is-tinted');
    if (tinted) card.classList.remove('is-tinted');
    const surface = getComputedStyle(card).backgroundColor;
    const ink = getComputedStyle(card).color;
    if (tinted) card.classList.add('is-tinted');
    let washes: ReadonlyMap<LofiMood, SoundWash>;
    try { washes = await opts.washes(surface, ink); } catch { return; }
    if (disposed) return;
    for (const node of el.querySelectorAll<HTMLElement>('.sound-card[data-mood]')) {
      const wash = washes.get(node.dataset.mood as LofiMood);
      if (!wash) continue;
      node.style.setProperty('--sound-wash-from', wash.from);
      node.style.setProperty('--sound-wash-to', wash.to);
      node.style.setProperty('--sound-wash-angle', `${wash.angle}deg`);
      if (wash.ink) { node.style.setProperty('--sound-wash-ink', wash.ink); node.dataset.deep = ''; }
      else { node.style.removeProperty('--sound-wash-ink'); delete node.dataset.deep; }
      node.classList.add('is-tinted');
    }
    // The mix card keeps its own surface; each of its discs wears its sound's wash.
    for (const disc of el.querySelectorAll<HTMLElement>('.sound-card--mix .sound-card-icon[data-mood]')) {
      const wash = washes.get(disc.dataset.mood as LofiMood);
      if (!wash) continue;
      disc.style.setProperty('--sound-disc', wash.from);
      if (wash.ink) disc.style.setProperty('--sound-disc-ink', wash.ink);
      else disc.style.removeProperty('--sound-disc-ink');
      disc.classList.add('is-tinted');
    }
  }
  /** The room's one raw-HTML sink: every value in the markup went through escape(). */
  const render = (html: string): void => { el.innerHTML = html; };
  function paint(focus?: string, reveal = false): void {
    if (!profile) return;
    el.classList.add('sound-room');
    el.classList.toggle('is-moving', !prefersReducedMotion() && !perfUiOn());
    render(soundRoomHtml(model()));
    markButtons();
    statusText = pendingStatus;
    pendingStatus = '';
    syncSave();
    if (focus) el.querySelector<HTMLElement>(focus)?.focus();
    if (reveal && !perfUiOn()) staggerReveal([...el.querySelectorAll('[data-reveal]')], { sound: false });
    void tint();
  }
  const say = (message: string): void => { pendingStatus = message; };

  // ── loading ────────────────────────────────────────────────────────────────
  async function refresh(): Promise<void> {
    if (dirty || working || disposed) return;
    const current = ++sequence;
    try {
      const [next, active] = await Promise.all([
        readonly ? opts.host.tokens.snapshot().then((s) => ({ doc: s.document, snapshot: undefined })) : usageRevision(opts.host),
        opts.host.tokens.active().catch(() => null),
      ]);
      if (disposed || current !== sequence) return;
      const found = sonicProfileOf(next.doc);
      label = active?.label || t('Your brand');
      systemId = active?.id ?? '';
      if (found.state === 'unsupported') { render(soundMessageHtml(t('This sound was made with a newer version of Lolly. It has been kept as it is.'))); return; }
      if (readonly && found.state === 'absent') { render(soundMessageHtml(t('This design system has no sound yet.'))); return; }
      revision = next.snapshot ? (next as Awaited<ReturnType<typeof usageRevision>>) : undefined;
      saved = !!found.profile;
      savedRevision = found.profile?.revision ?? null;
      profile = found.profile ?? starterSonicProfile('sound', label);
      picked = saved;
      dirty = false;
      if (!profile.contexts.some((c) => c.id === contextId)) contextId = profile.defaultContext;
      if (!readonly) resume();
      paint();
    } catch (error) {
      if (!disposed) render(soundMessageHtml((error as Error).message));
    }
  }
  /** Back from the music generator: put the draft back, with the new settings when there are some. */
  function resume(): void {
    const trip = readSoundEdit();
    if (!trip || trip.system !== systemId) return;
    clearSoundEdit();
    if (trip.base !== savedRevision) {
      say(t('The saved sound changed while you were away, so that edit was left out.'));
      return;
    }
    const draft = readSonicProfile(trip.profile);
    if (!draft?.contexts.some((c) => c.id === trip.contextId)) return;
    profile = draft;
    contextId = trip.contextId;
    picked = trip.picked;
    dirty = trip.dirty;
    const result = trip.result;
    if (result && 'parameters' in result) {
      try {
        context().music = { adapter: sonicMusicAdapter.id, parameters: sonicMusicFromLink(result.parameters) };
        drawn.delete(contextId);
        picked = true;
        profile.review = { state: 'draft' };
        dirty = true;
        say(tRaw('{use} has its new music.', { use: context().label }));
      } catch {
        say(t('Those music settings cannot be kept in a sound. Nothing was changed.'));
      }
    } else if (result && 'cancelled' in result) {
      say(t('Nothing was changed.'));
    }
  }

  // ── actions ────────────────────────────────────────────────────────────────
  function choose(id: string): void {
    const direction = SONIC_DIRECTIONS.find((d) => d.id === id);
    if ((!direction && id !== MIXED) || !profile || readonly) return;
    const first = !picked;
    profile = direction ? applySonicDirection(profile, direction) : applySonicMix(profile);
    drawn.clear();
    picked = true;
    dirty = true;
    stop();
    const name = el.querySelector(`[data-direction="${CSS.escape(id)}"] .sound-card-name`)?.textContent ?? '';
    say(direction ? tRaw('{name} is now the sound of every use.', { name }) : t('Each use now plays its own sound.'));
    paint(`[data-direction="${CSS.escape(id)}"] [data-play]`, first);
  }
  function select(id: string): void {
    if (!profile?.contexts.some((c) => c.id === id) || id === contextId) return;
    contextId = id;
    renaming = false;
    paint(`[data-select="${CSS.escape(id)}"]`);
  }
  function needsVoice(): boolean {
    if (!speech) { status(t('Speech is not available here. You can still listen to the music.')); return true; }
    if (context().narration.voice) return false;
    open.add('voice');
    paint('[data-field="narration.voice"]');
    status(t('Choose a voice first.'));
    return true;
  }
  async function playKey(key: string): Promise<void> {
    if (!profile) return;
    const [kind, id = ''] = key.split(/:(.*)/s);
    if (kind === 'dir') {
      const direction = SONIC_DIRECTIONS.find((d) => d.id === id);
      if (direction) await play(key, direction.parameters);
      else if (id === MIXED) await play(key, SONIC_DIRECTIONS.map((d) => d.parameters));
      return;
    }
    const c = profile.contexts.find((x) => x.id === id);
    if (!c) return;
    if (kind === 'sig') {
      if (playingKey === key) { stop(); return; }
      const ref = c.signature.resource;
      if (!ref) return;
      stop();
      try {
        const asset = await opts.host.assets.get(ref.id);
        if (disposed) return;
        if (asset.format === 'lofi') { status(t('Render this tune to an audio file before using it as a signature.')); return; }
        listen();
        playingKey = key;
        playState = 'playing';
        markButtons();
        const out = player();
        out.src = asset.url;
        await out.play();
      } catch (error) { stop(); status((error as Error).message); }
      return;
    }
    const voiced = kind === 'voice' || (kind === 'use' && withVoice);
    if (voiced && playingKey !== key && needsVoice()) return;
    await play(key, playing(c), voiced ? { settings: structuredClone(c.narration), script: sample } : undefined);
  }
  function editInGenerator(): void {
    if (!profile || readonly) return;
    const c = context();
    if (c.music.adapter !== sonicMusicAdapter.id) { status(t('This use plays music this version of Lolly cannot edit. It has been kept.')); return; }
    stop();
    writeSoundEdit({ v: 1, system: systemId, label, base: savedRevision, profile: structuredClone(profile), contextId, picked, dirty, at: Date.now() });
    navigate(soundEditHref(playing(c)));
  }
  function addUse(): void {
    if (!profile || readonly) return;
    if (profile.contexts.length >= 24) { status(t('A sound can have 24 uses. Rename one instead.')); return; }
    const copy = structuredClone(context());
    copy.id = `use-${crypto.randomUUID()}`;
    copy.label = t('New use');
    copy.purpose = '';
    profile.contexts.push(copy);
    contextId = copy.id;
    renameBackup = null;
    renaming = true;
    changed();
    paint('[data-field="context.label"]');
  }
  function finishRename(keep: boolean): void {
    if (!profile || !renaming) return;
    const c = context();
    if (!keep && renameBackup) { c.label = renameBackup.label; c.purpose = renameBackup.purpose; }
    if (!c.label.trim()) c.label = t('New use');
    renaming = false;
    renameBackup = null;
    paint('[data-rename]');
  }
  async function makeProject(): Promise<void> {
    if (!profile) return;
    if (!saved || dirty) { status(t('Save the sound first, then make a project from the saved sound.')); return; }
    const c = context();
    const result = await resolveSonicRecipe(profile, { documentContext: contextId, seed: parseMusicState(playing(c)).seed }, sonicMusicAdapter);
    if (!result.recipe) { status(result.findings.map((f) => f.message).join(' ')); return; }
    const slot = newMusicSlot();
    await opts.host.state.save(slot, musicProjectRecord(parseMusicState(result.recipe.music.parameters), `${label} · ${c.label}`, result.recipe));
    navigate(musicProjectHref(slot));
  }
  async function save(review?: { reviewer: string; notes: string }): Promise<void> {
    if (readonly || working || !profile || !revision || !opts.studio) return;
    if (!review && !dirty) return;
    working = true;
    syncSave();
    status(t('Saving…'));
    try {
      const next = structuredClone(profile);
      next.revision = saved ? next.revision + 1 : 1;
      next.review = review ? { state: 'reviewed', reviewer: review.reviewer, notes: review.notes, at: new Date().toISOString() } : { state: 'draft' };
      if (!next.label.trim()) next.label = label;
      if (!readSonicProfile(next)) throw new Error(t('Check the names and the pronunciation notes, then save again.'));
      const candidate = await opts.host.brandAdoption.prepare(revision.snapshot, { doc: withSonicProfile(revision.doc, next) });
      await opts.studio.load();
      await opts.studio.checkpoint(t('Before editing sound'));
      await opts.host.brandAdoption.commit(candidate, { recovery: false });
      await opts.studio.load();
      dirty = false;
      working = false;
      reviewing = false;
      opts.changed?.();
      say(review ? t('Review recorded.') : t('Sound saved. Listen to new tunes before you publish them.'));
      await refresh();
    } catch (error) {
      status((error as Error).message);
    } finally {
      working = false;
      syncSave();
    }
  }
  async function discard(): Promise<void> {
    stop();
    drawn.clear();
    renaming = false;
    reviewing = false;
    dirty = false;
    if (!saved) { profile = null; picked = false; }
    say(saved ? t('Changes discarded.') : '');
    await refresh();
  }

  // ── editing fields ─────────────────────────────────────────────────────────
  function edit(target: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): void {
    if (!profile || readonly) return;
    const path = target.dataset.field;
    if (!path) return;
    const c = context();
    const value = target.value;
    if (path === 'signature.resource') {
      if (value) c.signature.resource = { type: 'asset', id: value };
      else delete c.signature.resource;
    } else if (path === 'pronunciations') {
      c.narration.pronunciations = value.split('\n').filter((line) => line.trim()).map((line) => {
        const at = line.indexOf('=');
        return { written: at < 0 ? line.trim() : line.slice(0, at).trim(), spoken: at < 0 ? '' : line.slice(at + 1).trim() };
      });
    } else {
      const [group, key = ''] = path.split('.');
      const owner = group === 'identity' ? profile.identity : group === 'context' ? c : group === 'narration' ? c.narration : c.signature;
      if (!Object.hasOwn(owner, key)) return;
      const numeric = target.type === 'range';
      Reflect.set(owner, key, numeric ? Number(value) : value);
      if (path === 'narration.voice' && value) {
        // The first voice chosen speaks for every use that has none yet.
        for (const other of profile.contexts) if (!other.narration.voice) other.narration.voice = value;
      }
    }
    if (playingKey) stop();
    changed();
  }
  const onInput = (event: Event): void => {
    const target = event.target as HTMLInputElement;
    if (target.hasAttribute('data-sample')) { sample = target.value; if (playingKey.startsWith('voice:') || withVoice) stop(); return; }
    if (target.type === 'range') {
      showPillSlider(target, target.dataset.field === 'narration.speed' ? speedText : percentText);
      edit(target);
      return;
    }
    if (target.tagName !== 'SELECT' && target.dataset.field) edit(target);
  };
  const onChange = (event: Event): void => {
    const target = event.target as HTMLSelectElement;
    if (target.tagName === 'SELECT' && target.dataset.field) {
      edit(target);
      paint(`[data-field="${CSS.escape(target.dataset.field)}"]`);
    }
  };
  const onKey = (event: KeyboardEvent): void => {
    if (!renaming || !(event.target as Element).closest('[data-rename-form]')) return;
    if (event.key === 'Enter') { event.preventDefault(); finishRename(true); }
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); finishRename(false); }
  };
  const onToggle = (event: Event): void => {
    const fold = (event.target as HTMLElement).closest?.('details[data-fold]') as HTMLDetailsElement | null;
    if (!fold || fold !== event.target) return;
    if (fold.open) open.add(fold.dataset.fold!); else open.delete(fold.dataset.fold!);
  };
  const onClick = (event: Event): void => {
    const button = (event.target as Element).closest<HTMLButtonElement>('button');
    if (!button || button.disabled || !profile || !el.contains(button)) return;
    const d = button.dataset;
    if (d.play) { void playKey(d.play); return; }
    if (d.choose) { choose(d.choose); return; }
    if (d.select) { select(d.select); return; }
    if (d.listen) {
      withVoice = d.listen === 'voice';
      stop();
      for (const b of el.querySelectorAll<HTMLButtonElement>('[data-listen]')) b.setAttribute('aria-pressed', String(b.dataset.listen === d.listen));
      if (withVoice && speech && !context().narration.voice) needsVoice();
      return;
    }
    if (readonly) return;
    if (d.editMusic !== undefined) editInGenerator();
    else if (d.another !== undefined) {
      drawn.set(contextId, randomSeed());
      paint('[data-another]');
      void playKey(`use:${contextId}`);
    } else if (d.project !== undefined) void makeProject().catch((error: Error) => status(error.message));
    else if (d.makeMain !== undefined) {
      profile.defaultContext = contextId;
      changed();
      say(tRaw('{use} is now the main use, played when nothing else is asked for.', { use: context().label }));
      paint('[data-select]');
    } else if (d.removeUse !== undefined) {
      if (contextId === profile.defaultContext || profile.contexts.length < 2) return;
      const gone = context().label;
      profile.contexts = profile.contexts.filter((c) => c.id !== contextId);
      drawn.delete(contextId);
      contextId = profile.defaultContext;
      changed();
      say(tRaw('{use} was removed.', { use: gone }));
      paint('[data-add-use]');
    } else if (d.addUse !== undefined) addUse();
    else if (d.rename !== undefined) {
      const c = context();
      renameBackup = { label: c.label, purpose: c.purpose };
      renaming = true;
      paint('[data-field="context.label"]');
    } else if (d.renameDone !== undefined) finishRename(true);
    else if (d.review !== undefined) {
      if (dirty || !saved) { status(t('Save the sound before you record a review.')); return; }
      reviewing = true;
      open.add('details');
      paint('[data-reviewer]');
    } else if (d.reviewCancel !== undefined) { reviewing = false; paint('[data-review]'); }
    else if (d.reviewSave !== undefined) {
      const reviewer = el.querySelector<HTMLInputElement>('[data-reviewer]')?.value.trim() ?? '';
      const notes = el.querySelector<HTMLTextAreaElement>('[data-review-notes]')?.value.trim() ?? '';
      if (!reviewer || !notes) { status(t('Write your name and what you heard, then record the review.')); return; }
      void save({ reviewer, notes });
    } else if (d.save !== undefined) void save();
    else if (d.discard !== undefined) void discard();
  };
  // A change of theme washes the cards again for the new surface, as the generator's genre button does.
  const retint = (): void => { if (profile) void tint(); };
  const themes = typeof MutationObserver === 'undefined' ? null : new MutationObserver(retint);
  themes?.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
  const darkScheme = globalThis.matchMedia?.('(prefers-color-scheme: dark)');
  darkScheme?.addEventListener?.('change', retint);
  el.addEventListener('input', onInput);
  el.addEventListener('change', onChange);
  el.addEventListener('click', onClick);
  el.addEventListener('keydown', onKey);
  el.addEventListener('toggle', onToggle, true);

  void Promise.allSettled([
    opts.host.speech?.voices() ?? Promise.resolve([] as SpeechVoiceInfo[]),
    opts.host.assets.query({ type: 'audio' }),
  ]).then((results) => {
    if (disposed) return;
    if (results[0].status === 'fulfilled') voices = results[0].value;
    else speech = false;
    if (results[1].status === 'fulfilled')
      audioAssets = results[1].value.map((a) => ({ id: a.id, name: typeof a.meta?.name === 'string' ? a.meta.name : a.id }));
    // Never repaint under someone who is typing.
    if (profile && !el.contains(document.activeElement)) paint();
  });
  void refresh();

  return {
    refresh,
    suspend: stop,
    teardown(): void {
      disposed = true;
      stop();
      themes?.disconnect();
      darkScheme?.removeEventListener?.('change', retint);
      if (audio && listening) {
        audio.removeEventListener('ended', onEnded);
        audio.removeEventListener('timeupdate', onTime);
      }
      el.removeEventListener('input', onInput);
      el.removeEventListener('change', onChange);
      el.removeEventListener('click', onClick);
      el.removeEventListener('keydown', onKey);
      el.removeEventListener('toggle', onToggle, true);
    },
  };
}
export type SoundRoom = ReturnType<typeof mountSoundRoom>;
