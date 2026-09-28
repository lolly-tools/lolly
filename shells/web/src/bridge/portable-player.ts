// SPDX-License-Identifier: MPL-2.0
/** Standalone transport. Frame evaluation belongs to the tool or the shared sequence applier. */
import { createSequenceTime } from './sequence-dom.ts';
import { playerIcons, type PlaybackElement, type PortablePlayerConfig } from './portable-player-document.ts';

const root = document.querySelector<HTMLElement>('[data-player-root]')!;
const stage = root.querySelector<HTMLElement>('[data-player-stage]')!;
const config = JSON.parse(root.querySelector('[data-player-config]')!.textContent!) as PortablePlayerConfig;
const find = <T extends HTMLElement>(name: string) => root.querySelector<T>(`[data-player-${name}]`);
const playButton = find<HTMLButtonElement>('play'), big = find<HTMLButtonElement>('big');
const scrub = find<HTMLInputElement>('seek'), output = find<HTMLOutputElement>('time');
const audio = find<HTMLAudioElement>('audio'), mute = find<HTMLButtonElement>('mute'), volume = find<HTMLInputElement>('volume');
const fullscreen = find<HTMLButtonElement>('fullscreen');
const scenesButton = find<HTMLButtonElement>('scenes');
const sceneMenu = root.querySelector<HTMLElement>('#lp-scenes');
const scenes = config.scenes ?? [];
let time = 0, playing = false, frame = 0, anchor = 0, generation = 0, posterPending = true, loaded = false;
let idle: ReturnType<typeof setTimeout> | undefined;
let animations: Animation[] = [];
let soundContext: AudioContext | null = null, gain: GainNode | null = null, sound: AudioBufferSourceNode | null = null;
let soundtrack: AudioBuffer | null = null, soundStart = 0, soundOffset = 0;
const soundTime = () => {
  if (!soundContext || !sound) return time;
  const stamp = soundContext.getOutputTimestamp?.();
  const audible = stamp?.contextTime && stamp.performanceTime !== undefined ? stamp.contextTime + (performance.now() - stamp.performanceTime) / 1000
    : soundContext.currentTime - (soundContext.outputLatency || soundContext.baseLatency || 0);
  return soundOffset + Math.max(0, audible - soundStart);
};
const tool = stage.querySelector<PlaybackElement>('[data-lolly-player]')?.__lollyPlayback;
const sequence = config.kind === 'sequence' ? createSequenceTime(stage) : null;
const clockText = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
const resize = () => {
  const scale = Math.min(root.clientWidth / config.width, root.clientHeight / config.height);
  stage.style.transform = `translate(${(root.clientWidth - config.width * scale) / 2}px,${(root.clientHeight - config.height * scale) / 2}px) scale(${scale})`;
};
new ResizeObserver(resize).observe(root); resize();
const showBar = () => {
  root.removeAttribute('data-idle'); clearTimeout(idle);
  if (playing) idle = setTimeout(() => { if (!root.querySelector('.lp-bar:focus-within') && sceneMenu?.hidden !== false) root.setAttribute('data-idle', ''); }, 1800);
};
const show = (seconds: number) => {
  time = Math.max(0, Math.min(config.duration, Number.isFinite(seconds) ? seconds : 0));
  const sample = Math.min(time, Math.max(0, config.duration - 1 / config.fps));
  const sourceTime = config.from + sample * config.sourceDuration / config.duration;
  sequence?.apply(sourceTime * 1000);
  tool?.seek(sourceTime);
  for (const animation of animations) { animation.pause(); animation.currentTime = sourceTime * 1000; }
  if (scrub) { scrub.value = String(time); scrub.style.setProperty('--progress', `${100 * time / config.duration}%`); scrub.setAttribute('aria-valuetext', `${time.toFixed(1)} of ${config.duration.toFixed(1)} seconds`); }
  if (output) output.value = `${clockText(time)} / ${clockText(config.duration)}`;
  for (const button of sceneMenu?.querySelectorAll<HTMLButtonElement>('button') ?? []) {
    const scene = scenes[Number(button.dataset.sceneIndex)]!;
    if (sample >= scene.start && sample < scene.end) button.setAttribute('aria-current', 'true'); else button.removeAttribute('aria-current');
  }
};
const update = () => {
  const ended = !posterPending && time >= config.duration;
  if (playButton) { playButton.innerHTML = playing ? playerIcons.pause : ended ? playerIcons.replay : playerIcons.play;
    playButton.setAttribute('aria-label', playing ? 'Pause' : ended ? 'Replay' : 'Play'); playButton.title = playButton.getAttribute('aria-label')!; }
  if (big) { big.hidden = playing || !posterPending && time < config.duration; big.innerHTML = ended ? playerIcons.replay : playerIcons.play; big.setAttribute('aria-label', ended ? 'Replay animation' : 'Play animation'); }
  root.dataset.playing = String(playing); showBar();
};
const pause = () => {
  generation++; playing = false; cancelAnimationFrame(frame);
  if (sound) { sound.onended = null; sound.stop(); sound.disconnect(); sound = null; }
  update();
};
const tick = (now: number) => {
  if (!playing) return;
  show(sound ? soundTime() : (now - anchor) / 1000);
  if (time >= config.duration) pause(); else frame = requestAnimationFrame(tick);
};
const play = async () => {
  if (!loaded || config.kind === 'still') return;
  pause(); if (posterPending || time >= config.duration) show(0); posterPending = false;
  const token = generation;
  if (audio && soundtrack) {
    soundContext ??= new AudioContext();
    if (!gain) { gain = soundContext.createGain(); gain.connect(soundContext.destination); }
    await soundContext.resume();
    if (generation !== token) return;
    gain.gain.value = audio.muted ? 0 : audio.volume;
    sound = soundContext.createBufferSource(); sound.buffer = soundtrack; sound.connect(gain);
    soundStart = soundContext.currentTime; soundOffset = time;
    sound.onended = () => { if (playing) { show(config.duration); pause(); } };
    sound.start(soundStart, time);
  }
  if (generation !== token) return;
  playing = true; anchor = performance.now() - time * 1000; update(); frame = requestAnimationFrame(tick);
};
const seek = (seconds: number) => { pause(); posterPending = false; show(seconds); update(); };
const closeScenes = () => { if (sceneMenu) sceneMenu.hidden = true; scenesButton?.setAttribute('aria-expanded', 'false'); showBar(); };
const goToScene = (id: string) => { const scene = scenes.find(scene => scene.id === id); if (scene) { seek(scene.start); closeScenes(); } };
for (const [index, scene] of scenes.entries()) {
  if (!sceneMenu) break;
  const button = document.createElement('button'), stamp = document.createElement('time'), label = document.createElement('span');
  button.type = 'button'; button.dataset.sceneIndex = String(index);
  stamp.textContent = clockText(scene.start); label.textContent = scene.name; button.append(stamp, label);
  button.addEventListener('click', () => { goToScene(scene.id); scenesButton?.focus(); }); sceneMenu.append(button);
}
scenesButton?.addEventListener('click', () => {
  if (!sceneMenu) return;
  sceneMenu.hidden = !sceneMenu.hidden; scenesButton.setAttribute('aria-expanded', String(!sceneMenu.hidden)); showBar();
  if (!sceneMenu.hidden) (sceneMenu.querySelector<HTMLButtonElement>('[aria-current]') ?? sceneMenu.querySelector('button'))?.focus();
});
const toggle = () => { if (playing) pause(); else void play(); };
playButton?.addEventListener('click', toggle); big?.addEventListener('click', toggle);
find('replay')?.addEventListener('click', () => { seek(0); void play(); });
scrub?.addEventListener('input', () => seek(Number(scrub.value)));
const updateMute = () => {
  if (!audio || !mute) return;
  const quiet = audio.muted || audio.volume === 0;
  if (gain) gain.gain.value = quiet ? 0 : audio.volume;
  mute.innerHTML = quiet ? playerIcons.muted : playerIcons.sound;
  mute.setAttribute('aria-label', quiet ? 'Unmute' : 'Mute'); mute.title = quiet ? 'Unmute' : 'Mute';
  mute.setAttribute('aria-pressed', String(quiet));
  volume?.style.setProperty('--progress', `${audio.volume * 100}%`);
};
mute?.addEventListener('click', () => { if (audio) { audio.muted = !audio.muted; if (!audio.muted && audio.volume === 0) { audio.volume = 1; if (volume) volume.value = '1'; } updateMute(); } });
volume?.addEventListener('input', () => { if (audio) { audio.volume = Number(volume.value); audio.muted = audio.volume === 0; updateMute(); } });
const toggleFullscreen = async () => {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else await root.requestFullscreen(); } catch { /* An embedding page can withhold fullscreen permission. */ }
};
if (fullscreen) { fullscreen.hidden = !document.fullscreenEnabled; fullscreen.addEventListener('click', () => void toggleFullscreen()); }
document.addEventListener('fullscreenchange', () => { fullscreen?.setAttribute('aria-label', document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen'); resize(); });
root.addEventListener('pointermove', showBar); root.addEventListener('focusin', showBar);
stage.addEventListener('click', event => { if (!(event.target as Element).closest('a,button,input,select,textarea,[contenteditable]')) toggle(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && sceneMenu?.hidden === false) { closeScenes(); scenesButton?.focus(); event.preventDefault(); return; }
  if (scenes.length && (event.key === 'PageDown' || event.key === 'PageUp') && !(event.target as Element)?.closest('input,select,textarea,[contenteditable]')) {
    event.preventDefault();
    const target = event.key === 'PageDown' ? scenes.find(scene => scene.start > time + .01) : [...scenes].reverse().find(scene => scene.start < time - .01);
    if (target) goToScene(target.id);
    return;
  }
  if ((event.target as Element)?.closest('button,input,select,textarea,a,[contenteditable]')) return;
  if (event.key === ' ' || event.key.toLowerCase() === 'k') { event.preventDefault(); toggle(); }
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); seek(time + (event.key === 'ArrowLeft' ? -.5 : .5)); }
  if (event.key.toLowerCase() === 'm') mute?.click();
  if (event.key.toLowerCase() === 'f') void toggleFullscreen();
});
const ready = (async () => {
  if (audio) {
    const bytes = await (await fetch(audio.src)).arrayBuffer();
    soundtrack = await new OfflineAudioContext(2, 1, 48000).decodeAudioData(bytes);
  }
  await document.fonts.ready;
  await Promise.all([...stage.querySelectorAll('img')].map(img => img.decode()));
  if (config.kind === 'tool' && !tool) throw new Error('The animation runtime could not start.');
  animations = stage.getAnimations({ subtree: true });
  const queryTime = new URLSearchParams(location.search).get('t');
  loaded = true;
  seek(queryTime === null ? config.poster : Number(queryTime)); posterPending = queryTime === null;
  update(); updateMute(); root.dataset.ready = 'true';
})().catch(error => {
  const message = root.querySelector<HTMLElement>('.lp-error')!;
  message.textContent = error instanceof Error ? error.message : 'The animation could not load.'; message.hidden = false;
  throw error;
});
Object.assign(window, { lollyPlayer: { ready, seek, play, pause, duration: config.duration, width: config.width, height: config.height,
  scenes: scenes.map(scene => ({ ...scene })), goToScene,
  get time() { return time; }, get playing() { return playing; }, get audioTime() { return audio ? playing ? soundTime() : time : null; } } });
