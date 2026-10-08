// SPDX-License-Identifier: MPL-2.0
/**
 * Lolly's chrome over the Rondocode editor, inside the editor frame.
 *
 * Upstream's header stays in the page, unseen (its popovers and panels still
 * open from here), and this draws Lolly's own controls above the code, from
 * the web shell's own modules, bundled into the frame:
 *
 *   - the song button (upstream's project library) and the transport, the
 *     same play, time, seek, mute and volume strip an audio asset's preview
 *     has (lib/audio-transport.ts), driving the live song through an adapter
 *     with Stop beside it and an Apply changes button while edits wait;
 *   - the visualiser, a view of its own between the bar and the code, with the
 *     preset and colour switcher of the asset preview (views/assets/thumbs.ts)
 *     over lib/butterchurn-viz.ts, and Immersive, which fills the screen;
 *   - Export and More, body popovers in the shell's menu skin
 *     (components/body-popover.ts, lib/context-menu.ts menuItemHtml), and
 *     context menus on the gutter, the project rows and the visualiser.
 *
 * The code text keeps the browser's own menu (copy, paste, spelling): only the
 * line-number gutter has Lolly's.
 */
import { audioTransportHtml, wireAudioTransport } from '../../../shells/web/src/lib/audio-transport.ts';
import { icon } from '../../../shells/web/src/lib/icons.ts';
import { t } from '../../../shells/web/src/i18n.ts';
import { menuItemHtml, wireTileContextMenu } from '../../../shells/web/src/lib/context-menu.ts';
import { mountBodyPopover, type BodyPopoverHandle } from '../../../shells/web/src/components/body-popover.ts';
import { mountViz, type VizHandle } from '../../../shells/web/src/lib/butterchurn-viz.ts';
import { buildVizPalette } from '../../../shells/web/src/lib/viz-palette.ts';
import { VIZ_PRESETS, defaultVizPresetId, vizPresetById, type MdVars, type VizPreset } from '../../../shells/web/src/lib/viz-presets.ts';
import { wrapCompShader } from '../../../shells/web/src/lib/viz-stock.ts';

// ── What the chrome drives (upstream's objects, typed by what is used) ───────

interface SessionStateLike {
  playing: boolean;
  paused: boolean;
  synths: string[];
}

export interface ChromeEditor {
  getDoc(): string;
  getLang(): string;
  session: { getState(): SessionStateLike };
  onState(fn: (s: SessionStateLike) => void): () => void;
  onVisual(fn: (wgsl: string | null, synths: string[]) => void): () => void;
  topbar: HTMLElement;
}

export interface ChromeAudio {
  readonly analyser: AnalyserNode | null;
  readonly loadedSamples: Record<string, { data: Float32Array; sampleRate: number }>;
  setOutputGain(level: number): void;
}

type Samples = Record<string, { data: Float32Array; sampleRate: number }>;
type Failed = { error: string };

export interface ChromeHandles {
  editor: ChromeEditor;
  audio: ChromeAudio;
  library: Promise<{
    store: {
      duplicateProject(id: string): Promise<unknown>;
      deleteProject(id: string): Promise<void>;
    };
    /** The Song menu's verbs (patch 0006). */
    lolly: {
      name(): string;
      newSong(): Promise<void>;
      rename(name: string): Promise<void>;
      duplicate(): Promise<void>;
      examples(): { id: string; name: string; lang: 'rondo' | 'rondocode' }[];
      openExample(id: string): Promise<void>;
    };
  }>;
  exports: {
    evalCode(): string | Failed;
    bounceLoop(code: string, cycles: number, samples?: Samples, bits?: 16 | 24 | 32): { bytes: Uint8Array } | Failed;
    bounceStems(code: string, cycles: number, samples?: Samples, bits?: 16 | 24 | 32, project?: string): { files: { part: string; name: string; bytes: Uint8Array }[] } | Failed;
    bounceMidi(code: string, cycles: number): Uint8Array | Failed;
  };
  sungParts?(): string[];
  sungVoices?(): string[];
  silentParts?(): string[];
}

/** The formats the Export panel offers, in its order. */
export const EXPORT_FORMATS = ['wav', 'mp3', 'm4a', 'opus', 'flac', 'zip', 'mid', 'json'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

/** What the frame hands the utility for one export. */
export interface ExportJob {
  format: ExportFormat;
  /** WAV bytes of the mix (audio formats). */
  audio?: Uint8Array;
  /** One WAV per part (zip). */
  stems?: { name: string; part: string; bytes: Uint8Array }[];
  /** The MIDI file (mid). */
  midi?: Uint8Array;
  sung: string[];
  voices: string[];
  silent: string[];
  /** Hand the file to the system's share sheet instead of saving the file. */
  send?: boolean;
  /** Save the file into the person's Assets instead of downloading the file. */
  dest?: 'assets';
}

export interface ChromeHost {
  swatches: string[];
  reducedMotion: boolean;
  /** Encoders the utility has beyond WAV (mp3, m4a, opus, flac). */
  encoders: string[];
  /** The utility can sign files (host.c2pa.sign). */
  credentials: boolean;
  /** The system share sheet takes an MP3 here (host.export.canShare). */
  canSend: boolean;
  /** Files can be saved into the person's Assets here (host.assets.add). */
  canSaveAssets: boolean;
  notice(key: string, message: string): void;
  /** Hand a finished export to the utility; resolves with what it read back. */
  exportFile(job: ExportJob): Promise<string>;
  /** Ask the utility to put the frame in full screen, or take it out. */
  immersive(on: boolean): void;
  /** The utility left full screen (Esc in the browser's own full screen). */
  onImmersive(fn: (on: boolean) => void): void;
  /** The app's theme changed; `swatches` are the design system's colours now. */
  onTheme(fn: (swatches: string[]) => void): void;
  /** The visualiser presets host.viz.presets() lists: Lolly's, then the artist pack. */
  vizPresets: { id: string; name: string; author: string; calm: boolean }[];
  /** An artist preset's JSON, asked of the utility; null when it is not there. */
  vizPreset(id: string): Promise<string | null>;
}

/** How strongly an artist preset takes the brand's colours: lib/viz-stock.ts's default, `strong`. */
const BRAND_MIX = 0.7;

/**
 * An artist preset in the shape butterchurn wants, brand-influenced: the same
 * shaping lib/viz-stock.ts's loadStockPreset applies to the JSON it fetches.
 * The frame cannot fetch, so the utility hands over the JSON text. Equations
 * stay source strings, which butterchurn compiles itself (their authored path).
 */
function stockPreset(text: string, palette: Parameters<typeof wrapCompShader>[1]): VizPreset | null {
  let json: Record<string, unknown>;
  try {
    const v = JSON.parse(text) as unknown;
    if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
    json = v as Record<string, unknown>;
  } catch {
    return null;
  }
  return {
    ...(json as unknown as VizPreset),
    baseVals: { ...((json.baseVals as Record<string, number> | undefined) ?? {}) },
    warp: String(json.warp ?? '').trim(),
    comp: wrapCompShader(typeof json.comp === 'string' ? json.comp : undefined, palette, BRAND_MIX),
    shapes: (Array.isArray(json.shapes) ? json.shapes : []) as VizPreset['shapes'],
    waves: (Array.isArray(json.waves) ? json.waves : []) as VizPreset['waves'],
    init_eqs: undefined as unknown as (m: MdVars) => MdVars,
    frame_eqs: undefined as unknown as (m: MdVars) => MdVars,
    pixel_eqs: '' as VizPreset['pixel_eqs'],
  };
}

// ── Small helpers ────────────────────────────────────────────────────────────

const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** The icon registry has no Stop glyph; this is a filled square on its 24-unit grid. */
const STOP = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor"/></svg>';

const ico = (name: Parameters<typeof icon>[0], size = 20): string => icon(name, { size });

/** Click an upstream control after the current event has finished, so a menu
 *  pick does not reach upstream's own outside-click handler and close what it
 *  just opened. */
const later = (el: Element | null | undefined): void => {
  if (el instanceof HTMLElement) setTimeout(() => el.click(), 0);
};

const FORMAT_LABEL: Record<ExportFormat, string> = {
  wav: 'WAV audio',
  mp3: 'MP3 audio',
  m4a: 'M4A audio (AAC)',
  opus: 'Opus audio',
  flac: 'FLAC audio (lossless)',
  zip: 'Stems (ZIP of WAV files)',
  mid: 'MIDI notes',
  json: 'Song file (.rondo.json)',
};

const list = (xs: string[]): string => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

// ── The live song as a media element, for the shared transport ──────────────

/**
 * An object shaped like the <audio> element lib/audio-transport.ts drives, over
 * the live song. Play runs the song (or resumes a paused take), Pause holds the take.
 * A live song has no length, so the transport shows the elapsed time and keeps
 * its scrubber disabled, which is what it does for a stream.
 */
class LiveSong extends EventTarget {
  controls = false;
  readonly duration = Number.POSITIVE_INFINITY;
  readonly ended = false;
  private vol = 1;
  private mute = false;
  private startedAt = 0;
  private heldFor = 0;
  private heldAt = 0;
  private state: SessionStateLike = { playing: false, paused: false, synths: [] };
  private tick = 0;
  private readonly runBtn: HTMLElement | null;
  private readonly pauseBtn: HTMLElement | null;
  private readonly setGain: (level: number) => void;

  constructor(topbar: HTMLElement, setGain: (level: number) => void) {
    super();
    this.runBtn = topbar.querySelector('.run');
    this.pauseBtn = topbar.querySelector('.pause-btn');
    this.setGain = setGain;
  }

  get paused(): boolean {
    return !this.state.playing || this.state.paused;
  }

  get currentTime(): number {
    if (!this.state.playing) return 0;
    const now = this.state.paused ? this.heldAt : performance.now();
    return Math.max(0, (now - this.startedAt - this.heldFor) / 1000);
  }
  set currentTime(_v: number) {
    // a live song cannot be scrubbed; the transport never offers it
  }

  get volume(): number { return this.vol; }
  set volume(v: number) {
    this.vol = Math.min(1, Math.max(0, Number.isFinite(v) ? v : 1));
    this.apply();
  }
  get muted(): boolean { return this.mute; }
  set muted(m: boolean) {
    this.mute = Boolean(m);
    this.apply();
  }

  private apply(): void {
    this.setGain(this.mute ? 0 : this.vol);
    this.dispatchEvent(new Event('volumechange'));
  }

  play(): Promise<void> {
    if (this.state.playing && this.state.paused) this.pauseBtn?.click();
    else if (!this.state.playing) this.runBtn?.click();
    return Promise.resolve();
  }

  pause(): void {
    if (this.state.playing && !this.state.paused) this.pauseBtn?.click();
  }

  /** The session changed: follow it, and tell the transport. */
  follow(s: SessionStateLike): void {
    const was = this.state;
    const now = performance.now();
    if (s.playing && !was.playing) {
      this.startedAt = now;
      this.heldFor = 0;
    }
    if (s.playing && s.paused && !(was.playing && was.paused)) this.heldAt = now;
    if (s.playing && !s.paused && was.playing && was.paused) this.heldFor += now - this.heldAt;
    this.state = { playing: s.playing, paused: s.paused, synths: s.synths };
    if (s.playing !== was.playing || s.paused !== was.paused) {
      this.dispatchEvent(new Event(this.paused ? 'pause' : 'play'));
    }
    clearInterval(this.tick);
    if (s.playing && !s.paused) this.tick = window.setInterval(() => this.dispatchEvent(new Event('timeupdate')), 500);
    else this.dispatchEvent(new Event('timeupdate'));
  }
}

// ── The chrome ───────────────────────────────────────────────────────────────

export function mountLollyChrome(h: ChromeHandles, host: ChromeHost): void {
  const { editor, audio } = h;
  const top = editor.topbar;
  const app = top.parentElement ?? document.body;
  const q = <T extends HTMLElement = HTMLElement>(sel: string): T | null => top.querySelector<T>(sel);
  document.documentElement.classList.add('lolly-chrome-on');

  // ── Markup ────────────────────────────────────────────────────────────────
  const bar = document.createElement('div');
  bar.className = 'lolly-bar';
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', 'Song controls');
  bar.innerHTML =
    `<div class="lolly-pill lolly-pill--song">`
    + `<button type="button" class="lolly-song" data-lolly="songs" title="Your songs" aria-label="Your songs" aria-haspopup="dialog">`
    + `${ico('music', 18)}<span class="lolly-song-name" data-lolly-song-name>Song</span>${icon('chevronDown', { size: 16 })}</button>`
    + `</div>`
    + `<div class="lolly-pill lolly-pill--transport">`
    + audioTransportHtml({ play: 'Run', pause: 'Pause', seek: 'Position', mute: 'Mute', unmute: 'Unmute', volume: 'Volume' })
    + `<button type="button" class="lolly-btn lolly-stop" data-lolly="stop" title="Stop (Ctrl+.)" aria-label="Stop" disabled>${STOP}</button>`
    + `<button type="button" class="lolly-btn lolly-apply" data-lolly="apply" title="Apply changes (Ctrl+Enter)" aria-label="Apply changes" hidden>${ico('refresh', 18)}<span class="lolly-btn-label">Apply changes</span></button>`
    + `</div>`
    + `<div class="lolly-pill lolly-pill--tempo" data-lolly-tempo></div>`
    + `<div class="lolly-pill lolly-pill--tools">`
    + `<button type="button" class="lolly-btn" data-lolly="viz" title="Visualiser" aria-label="Visualiser" aria-pressed="false">${ico('sparkle')}</button>`
    + `<button type="button" class="lolly-btn" data-lolly="export" title="Export" aria-label="Export" aria-haspopup="dialog" aria-expanded="false">${ico('download')}</button>`
    + `<button type="button" class="lolly-btn" data-lolly="more" title="More" aria-label="More" aria-haspopup="menu" aria-expanded="false">${ico('menuDots')}</button>`
    + `</div>`;

  const viz = document.createElement('section');
  viz.className = 'lolly-viz';
  viz.hidden = true;
  viz.setAttribute('aria-label', 'Visualiser');
  viz.innerHTML =
    `<div class="lolly-viz-stage" data-lolly-viz-stage></div>`
    + `<p class="lolly-viz-note" data-lolly-viz-note hidden></p>`
    + `<div class="lolly-viz-bar cat-stage-bar">`
    + `<span class="cat-viz-group" data-audio-vizbar>`
    + `<button type="button" class="cat-viz-btn" data-viz-prev title="Previous preset" aria-label="Previous preset">‹</button>`
    + `<span class="cat-viz-name" data-viz-name></span>`
    + `<button type="button" class="cat-viz-btn" data-viz-next title="Next preset" aria-label="Next preset">›</button>`
    + `<button type="button" class="cat-viz-btn" data-viz-shuffle title="Shuffle preset" aria-label="Shuffle preset">🎲</button>`
    + `<button type="button" class="cat-viz-btn" data-viz-colour-shuffle title="Shuffle brand colour" aria-label="Shuffle brand colour">🎨</button>`
    + `<button type="button" class="cat-viz-btn" data-viz-immerse title="Immersive" aria-label="Immersive" aria-pressed="false">⛶</button>`
    + `</span>`
    + `</div>`;

  app.insertBefore(bar, top);
  app.insertBefore(viz, top);
  const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = bar): T => root.querySelector<T>(sel)!;

  // The tempo and start-from fields are upstream's own, moved into the bar
  // whole, so what they edit and how they validate does not change.
  const tempoPill = $('[data-lolly-tempo]');
  for (const sel of ['.tempo', '.startfrom', '.rec-pill']) {
    const el = q(sel);
    if (el) tempoPill.append(el);
  }
  if (!tempoPill.children.length) tempoPill.remove();

  // ── Transport ───────────────────────────────────────────────────────────
  const song = new LiveSong(top, (level) => audio.setOutputGain(level));
  const transport = wireAudioTransport(bar, song as unknown as HTMLAudioElement, {
    play: 'Run', pause: 'Pause', seek: 'Position', mute: 'Mute', unmute: 'Unmute', volume: 'Volume',
  });
  const playBtn = $<HTMLButtonElement>('[data-tp-play]');
  const stopBtn = $<HTMLButtonElement>('[data-lolly="stop"]');
  // Run and Stop side by side: the two controls a performance reaches for.
  playBtn.after(stopBtn);
  const applyBtn = $<HTMLButtonElement>('[data-lolly="apply"]');
  const dirtyDot = q('.dirty-dot');
  let state = editor.session.getState();
  const isDirty = (): boolean => Boolean(dirtyDot?.classList.contains('visible'));
  const paintTransport = (): void => {
    stopBtn.disabled = !state.playing;
    applyBtn.hidden = !(state.playing && isDirty());
    // The play button says what it will do: Run when idle, Resume when held.
    if (state.playing && state.paused) {
      playBtn.title = 'Resume';
      playBtn.setAttribute('aria-label', 'Resume');
    }
  };
  editor.onState((s) => {
    state = s;
    song.follow(s);
    paintTransport();
    transport.refresh();
  });
  song.follow(state);
  if (dirtyDot) new MutationObserver(paintTransport).observe(dirtyDot, { attributes: true, attributeFilter: ['class'] });
  paintTransport();
  stopBtn.addEventListener('click', () => q('.stop-btn')?.click());
  applyBtn.addEventListener('click', () => q('.run')?.click());

  // ── Song button ─────────────────────────────────────────────────────────
  // The library mounts after the chrome (it opens its store first), so its
  // button is looked up when needed and its name followed as it changes.
  const projectBtn = (): HTMLElement | null => q('.project-btn');
  const nameEl = $('[data-lolly-song-name]');
  const songBtn = $<HTMLButtonElement>('[data-lolly="songs"]');
  const syncName = (): void => {
    const name = projectBtn()?.querySelector('.project-name')?.textContent?.trim() || 'Song';
    if (nameEl.textContent === name) return;
    nameEl.textContent = name;
    songBtn.title = `Your songs: ${name}`;
    songBtn.setAttribute('aria-label', `Your songs: ${name}`);
  };
  new MutationObserver(syncName).observe(top, { childList: true, subtree: true, characterData: true });
  syncName();
  // The Song menu: Lolly's words for what a song can do, with upstream's own
  // library (versions, files, import) one step in, under Open.
  const songHtml = (lib: Awaited<ChromeHandles['library']> | null): string => {
    const name = lib?.lolly.name() ?? nameEl.textContent ?? '';
    const lang = editor.getLang() === 'rondo' ? 'rondo' : 'rondocode';
    const examples = (lib?.lolly.examples() ?? []).filter((x) => x.lang === lang);
    return `<div class="folder-menu-head">Song</div>`
      + `<label class="lolly-field lolly-field--wide"><span>Name</span><input type="text" maxlength="200" value="${esc(name)}" data-lolly-song-rename aria-label="Song name" autocomplete="off" spellcheck="false"></label>`
      + `<div role="menu" aria-label="Song">`
      + menuItemHtml('new', ico('filePlus', 15), 'New song')
      + menuItemHtml('open', ico('folder', 15), 'Open a song…')
      + menuItemHtml('duplicate', ico('duplicate', 15), 'Duplicate')
      + (host.canSaveAssets
        ? menuItemHtml('assets', ico('folderPlus', 15), t('Save to Assets'))
        : menuItemHtml('download', ico('download', 15), t('Download the song file')))
      + `</div>`
      + (examples.length
        ? `<details class="lolly-disclosure"><summary>${ico('chevronRight', 14)}<span>Start from an example</span></summary><div role="menu" aria-label="Examples">`
          + examples.map((x) => menuItemHtml(`example:${x.id}`, ico('music', 15), x.name)).join('')
          + `</div></details>`
        : '')
      + `<div class="folder-menu-sep" aria-hidden="true"></div>`
      + `<div role="menu" aria-label="History">${menuItemHtml('history', ico('history', 15), 'Versions and history…')}</div>`;
  };
  let libReady: Awaited<ChromeHandles['library']> | null = null;
  void h.library.then((lib) => { libReady = lib; }).catch(() => {});
  const songPop: BodyPopoverHandle = mountBodyPopover(songBtn, (el) => {
    el.innerHTML = songHtml(libReady);
    const field = el.querySelector<HTMLInputElement>('[data-lolly-song-rename]');
    const rename = (): void => {
      const next = field?.value.trim() ?? '';
      if (!libReady || !next || next === libReady.lolly.name()) return;
      void libReady.lolly.rename(next).catch((e: unknown) => host.notice('library', `The song was not renamed: ${e instanceof Error ? e.message : String(e)}`));
    };
    field?.addEventListener('change', rename);
    field?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        rename();
        songPop.close(true);
      }
    });
    el.addEventListener('click', (e) => {
      const row = (e.target as Element).closest<HTMLElement>('[data-act]');
      if (!row) return;
      const act = row.dataset.act ?? '';
      songPop.close();
      const run = (fn: () => Promise<void>): void => {
        void fn().catch((err: unknown) => host.notice('library', `That did not work: ${err instanceof Error ? err.message : String(err)}`));
      };
      if (act === 'open' || act === 'history') later(projectBtn());
      // The song as its canonical .rondo.json: into Assets, where timelines and
      // exports pick it up, or downloaded where this app has no Assets.
      else if (act === 'assets') void runExport('json', false, 'assets');
      else if (act === 'download') void runExport('json');
      else if (libReady && act === 'new') run(() => libReady!.lolly.newSong());
      else if (libReady && act === 'duplicate') run(() => libReady!.lolly.duplicate());
      else if (libReady && act.startsWith('example:')) run(() => libReady!.lolly.openExample(act.slice(8)));
    });
    return field;
  }, { className: 'folder-menu ctx-menu lolly-menu', role: 'dialog', ariaLabel: 'Song' });
  songBtn.addEventListener('click', () => (songPop.isOpen() ? songPop.close() : songPop.open()));

  // ── Visualiser ──────────────────────────────────────────────────────────
  const vizBtn = $<HTMLButtonElement>('[data-lolly="viz"]');
  const stage = $('[data-lolly-viz-stage]', viz);
  const vizNote = $('[data-lolly-viz-note]', viz);
  const vizName = $('[data-viz-name]', viz);
  const immerseBtn = $<HTMLButtonElement>('[data-viz-immerse]', viz);
  // Every preset host.viz lists, Lolly's own first and then the artist pack,
  // each credited to its author on screen; Lolly's own when the list is empty.
  const listed = host.vizPresets.length ? host.vizPresets : VIZ_PRESETS.map((d) => ({ id: d.id, name: d.name, author: 'Lolly', calm: d.calm }));
  const presets = listed.map((p) => {
    // Some converted names already start with their author; do not say it twice.
    const credit = p.author && p.author !== 'Lolly' && !p.name.toLowerCase().startsWith(p.author.toLowerCase());
    return { id: p.id, label: credit ? `${p.name} · ${p.author}` : p.name };
  });
  // Open on a preset that reads at a glance (the asset preview's first choice);
  // under reduced motion, the calmest one.
  const opening = presets.findIndex((p) => p.id === (host.reducedMotion ? defaultVizPresetId(true) : 'bloom'));
  let at = opening >= 0 ? opening : 0;
  let colours = host.swatches.length ? host.swatches : ['#30ba78'];
  let colourAt = 0;
  let handle: VizHandle | null = null;
  let vizOpen = false;
  let immersive = false;
  let mounting = 0;

  /** What is on screen now: an artist preset that did not arrive falls back to Lolly's own,
   *  and the label then shows that preset's name, never an artist whose work is not showing. */
  let onScreen: string | null = null;
  const label = (): void => {
    const shown = onScreen && onScreen !== presets[at]!.id ? vizPresetById(onScreen).name : presets[at]!.label;
    vizName.textContent = `${shown}  ·  ${at + 1}/${presets.length}`;
  };
  /** Put preset `id` on the visualiser: Lolly's own by id, an artist's from its JSON. */
  const applyPreset = async (h: VizHandle, id: string): Promise<void> => {
    if (!id.startsWith('stock:')) {
      h.setPreset(id);
      onScreen = id;
      label();
      return;
    }
    const text = await host.vizPreset(id);
    if (handle !== h || presets[at]!.id !== id) return; // closed, or stepped past meanwhile
    const preset = text ? stockPreset(text, h.palette()) : null;
    if (preset) {
      h.setRawPreset(id, preset);
      onScreen = id;
    } else {
      const fallback = vizPresetById(null).id;
      h.setPreset(fallback);
      onScreen = fallback;
    }
    label();
  };
  const palette = () => buildVizPalette(colours, colours[colourAt % colours.length]);

  const mountLive = async (): Promise<void> => {
    const ticket = ++mounting;
    handle?.destroy();
    handle = null;
    const canvas = document.createElement('canvas');
    canvas.className = 'lolly-viz-canvas';
    stage.replaceChildren(canvas);
    const box = stage.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(box.width * dpr));
    canvas.height = Math.max(1, Math.round(box.height * dpr));
    const silence = new Uint8Array(1024).fill(128);
    const first = presets[at]!.id;
    const got = await mountViz(canvas, undefined, first.startsWith('stock:') ? vizPresetById(null).id : first, (err) => {
      vizNote.textContent = `The visualiser stopped: ${err instanceof Error ? err.message : String(err)}`;
      vizNote.hidden = false;
    }, palette(), {
      audio: audio.analyser ? { analyser: audio.analyser } : { frame: () => ({ wave: silence, seed: 0 }) },
      pixelRatioCap: 2,
    });
    if (ticket !== mounting) {
      got?.destroy();
      return;
    }
    handle = got;
    if (!handle) {
      vizNote.textContent = 'The visualiser needs WebGL2, which this browser is not providing.';
      vizNote.hidden = false;
      label();
      return;
    }
    await applyPreset(handle, first);
  };

  const showViz = async (on: boolean): Promise<void> => {
    vizOpen = on;
    viz.hidden = !on;
    vizBtn.setAttribute('aria-pressed', String(on));
    vizBtn.classList.toggle('is-on', on);
    document.documentElement.classList.toggle('lolly-viz-open', on);
    if (!on) {
      setImmersive(false);
      mounting++;
      handle?.destroy();
      handle = null;
      stage.replaceChildren();
      return;
    }
    vizNote.hidden = true;
    label();
    await mountLive();
  };
  const step = (by: number): void => {
    at = (at + by + presets.length) % presets.length;
    label();
    if (handle) void applyPreset(handle, presets[at]!.id);
  };
  const shufflePreset = (): void => {
    if (presets.length < 2) return;
    let next = at;
    while (next === at) next = Math.floor(Math.random() * presets.length);
    at = next;
    label();
    if (handle) void applyPreset(handle, presets[at]!.id);
  };
  const shuffleColour = (): void => {
    if (colours.length < 2) return;
    let next = colourAt;
    while (next === colourAt) next = Math.floor(Math.random() * colours.length);
    colourAt = next;
    recolour();
  };
  /** A new palette: Lolly's presets re-colour in place; an artist's preset is wrapped again in the new colours. */
  const recolour = (): void => {
    if (!handle) return;
    handle.setPalette(palette());
    if (onScreen?.startsWith('stock:')) void applyPreset(handle, onScreen);
  };
  const setImmersive = (on: boolean): void => {
    if (on === immersive) return;
    immersive = on;
    document.documentElement.classList.toggle('lolly-immersive', on);
    immerseBtn.setAttribute('aria-pressed', String(on));
    immerseBtn.title = on ? 'Leave immersive' : 'Immersive';
    immerseBtn.setAttribute('aria-label', immerseBtn.title);
    host.immersive(on);
    requestAnimationFrame(() => handle?.resize());
  };
  host.onImmersive((on) => { if (!on) setImmersive(false); });
  // A new design system brings new colours: repaint the visualiser in them.
  host.onTheme((next) => {
    if (!next.length || next.join() === colours.join()) return;
    colours = next;
    colourAt = 0;
    recolour();
  });
  vizBtn.addEventListener('click', () => void showViz(!vizOpen));
  $('[data-viz-prev]', viz).addEventListener('click', () => step(-1));
  $('[data-viz-next]', viz).addEventListener('click', () => step(1));
  $('[data-viz-shuffle]', viz).addEventListener('click', shufflePreset);
  $('[data-viz-colour-shuffle]', viz).addEventListener('click', shuffleColour);
  immerseBtn.addEventListener('click', () => setImmersive(!immersive));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && immersive) {
      e.stopPropagation();
      setImmersive(false);
    }
  }, true);
  new ResizeObserver(() => handle?.resize()).observe(stage);

  // A song that draws its own visuals with visual() is told, once, what it gets here.
  let toldVisual = false;
  editor.onVisual((wgsl) => {
    if (!wgsl || toldVisual) return;
    toldVisual = true;
    host.notice('visual', 'This song draws its own visuals with visual(). Lolly does not run WebGPU shaders from songs; the visualiser button shows Lolly\'s visualiser instead.');
  });

  // ── Export ──────────────────────────────────────────────────────────────
  const exportBtn = $<HTMLButtonElement>('[data-lolly="export"]');
  let busy = false;
  const songParts = (): { sung: string[]; voices: string[]; silent: string[] } => {
    const synths = new Set(editor.session.getState().synths);
    const sung = (h.sungParts?.() ?? []).filter((p) => synths.size === 0 || synths.has(p));
    return {
      sung,
      voices: sung.length ? (h.sungVoices?.() ?? []) : [],
      silent: (h.silentParts?.() ?? []).filter((p) => synths.size === 0 || synths.has(p)),
    };
  };
  const credentialSentence = (): string => {
    if (!host.credentials) return 'This app cannot sign files, so exports carry no Content Credentials.';
    const { sung } = songParts();
    const audioLine = sung.length
      ? `Audio files carry Content Credentials that record this song as their source and declare the singing in ${list(sung)} AI-generated.`
      : 'Audio files carry Content Credentials that record this song as their source.';
    return `${audioLine} A MIDI file states the same in a text event, with no credential. A song file is your code as it is.`;
  };
  /** Where the Export menu's formats go: a download, or the person's Assets. */
  let dest: 'download' | 'assets' = 'download';
  const exportHtml = (): string => {
    const row = (f: ExportFormat): string => {
      const glyph = f === 'zip' ? ico('layers', 15) : f === 'mid' ? ico('keyboard', 15) : f === 'json' ? ico('code', 15) : ico('music', 15);
      const lossy = f === 'mp3' || f === 'm4a' || f === 'opus' || f === 'flac';
      const reason = lossy && !host.encoders.includes(f) ? `This app has no ${f.toUpperCase()} encoder.`
        : f === 'zip' && dest === 'assets' ? t('Stems are a ZIP of WAV files, which Assets does not keep. Choose Download for them.') : '';
      return menuItemHtml(`fmt:${f}`, glyph, FORMAT_LABEL[f], { reason, render: f === 'wav' });
    };
    const choice = (value: 'download' | 'assets', label: string): string =>
      `<button type="button" role="radio" class="lolly-seg-btn" data-lolly-dest="${value}" aria-checked="${dest === value}">${esc(label)}</button>`;
    return `<div class="folder-menu-head">Export</div>`
      + (host.canSaveAssets
        ? `<div class="lolly-seg" role="radiogroup" aria-label="${esc(t('Where it goes'))}">${choice('download', t('Download'))}${choice('assets', t('Save to Assets'))}</div>`
        : '')
      + `<label class="lolly-field"><span>Length</span><input type="number" min="1" max="256" step="1" value="${cycles}" data-lolly-cycles inputmode="numeric" aria-label="Length in cycles"><span>cycles</span></label>`
      + `<div role="menu" aria-label="Audio">${(['wav', 'mp3', 'm4a', 'opus', 'flac'] as const).map(row).join('')}</div>`
      + `<div class="folder-menu-sep">Parts and source</div>`
      + `<div role="menu" aria-label="Parts and source">${(['zip', 'mid', 'json'] as const).map(row).join('')}</div>`
      + `<div class="folder-menu-sep" aria-hidden="true"></div>`
      + `<div role="menu" aria-label="Share">`
      + (host.canSend && host.encoders.includes('mp3') ? menuItemHtml('send', ico('share', 15), 'Send as MP3…') : '')
      + menuItemHtml('record', ico('mic', 15), 'Record what is playing…')
      + `</div>`
      + `<p class="lolly-cred" data-lolly-cred>${esc(credentialSentence())}</p>`;
  };
  let cycles = 8;
  const exportPop: BodyPopoverHandle = mountBodyPopover(exportBtn, (el) => {
    el.innerHTML = exportHtml();
    el.addEventListener('change', (e) => {
      const field = e.target as HTMLInputElement;
      if (!field.matches('[data-lolly-cycles]')) return;
      const n = Math.round(Number(field.value));
      cycles = Number.isFinite(n) ? Math.min(256, Math.max(1, n)) : 8;
      field.value = String(cycles);
    });
    el.addEventListener('click', (e) => {
      const pick = (e.target as Element).closest<HTMLElement>('[data-lolly-dest]');
      if (pick) {
        dest = pick.dataset.lollyDest === 'assets' ? 'assets' : 'download';
        el.innerHTML = exportHtml();
        el.querySelector<HTMLElement>(`[data-lolly-dest="${dest}"]`)?.focus();
        return;
      }
      const row = (e.target as Element).closest<HTMLElement>('[data-act]');
      if (!row || row.getAttribute('aria-disabled') === 'true') return;
      const act = row.dataset.act ?? '';
      exportPop.close();
      if (act === 'record') {
        later(q('.export-btn'));
        return;
      }
      if (act === 'send') void runExport('mp3', true);
      else if (act.startsWith('fmt:')) void runExport(act.slice(4) as ExportFormat, false, dest === 'assets' ? 'assets' : undefined);
    });
    return el.querySelector<HTMLElement>('[data-lolly-cycles]');
  }, { className: 'folder-menu ctx-menu lolly-menu lolly-export', role: 'dialog', ariaLabel: 'Export' });
  exportBtn.addEventListener('click', () => (exportPop.isOpen() ? exportPop.close() : exportPop.open()));

  const runExport = async (format: ExportFormat, send = false, to?: 'assets'): Promise<void> => {
    if (busy) return;
    busy = true;
    exportBtn.classList.add('is-busy');
    const parts = songParts();
    try {
      const job: ExportJob = { format, ...parts, ...(send ? { send: true } : {}), ...(to ? { dest: to } : {}) };
      if (to && format === 'json') host.notice('export', t('Saving to Assets…'));
      if (format !== 'json') {
        const code = h.exports.evalCode();
        if (typeof code !== 'string') throw new Error(code.error);
        host.notice('export', `Rendering ${cycles} cycles…`);
        // Let the notice paint before the render takes the main thread.
        await new Promise((r) => setTimeout(r, 30));
        const samples = audio.loadedSamples;
        if (format === 'zip') {
          const res = h.exports.bounceStems(code, cycles, samples, 16, 'song');
          if ('error' in res) throw new Error(res.error);
          job.stems = res.files;
        } else if (format === 'mid') {
          const res = h.exports.bounceMidi(code, cycles);
          if (!(res instanceof Uint8Array)) throw new Error(res.error);
          job.midi = res;
          job.sung = [];
          job.voices = [];
        } else {
          const res = h.exports.bounceLoop(code, cycles, samples, 16);
          if ('error' in res) throw new Error(res.error);
          job.audio = res.bytes;
        }
        host.notice('export', format === 'mid' ? 'Saving…' : 'Encoding and signing…');
      }
      // An empty answer means the app said it all (a save to Assets has its own
      // message, with Undo), so the editor's notice goes away.
      host.notice('export', await host.exportFile(job));
    } catch (e) {
      host.notice('export', `The export did not finish: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      busy = false;
      exportBtn.classList.remove('is-busy');
    }
  };

  // ── More ────────────────────────────────────────────────────────────────
  const moreBtn = $<HTMLButtonElement>('[data-lolly="more"]');
  const has = (sel: string): boolean => Boolean(q(sel));
  const moreHtml = (): string => {
    const other = editor.getLang() === 'rondo' ? 'JavaScript' : 'rondo';
    const locked = q('.lock-btn')?.getAttribute('aria-pressed') === 'true';
    const group = (title: string, rows: string[]): string => {
      const kept = rows.filter(Boolean);
      return kept.length ? `<div class="folder-menu-sep">${esc(title)}</div><div role="menu" aria-label="${esc(title)}">${kept.join('')}</div>` : '';
    };
    return group('Write', [
      menuItemHtml('lang', ico('code', 15), `Switch to ${other}`),
      has('.docs-btn') ? menuItemHtml('docs', ico('document', 15), 'Language reference') : '',
      has('.outline-btn') ? menuItemHtml('outline', ico('menuLines', 15), 'Jump to a part…') : '',
      has('.synthlib-btn') ? menuItemHtml('synths', ico('package', 15), 'Synth library…') : '',
      has('.sample-btn') ? menuItemHtml('samples', ico('upload', 15), 'Your samples…') : '',
    ]) + group('Perform', [
      has('.lock-btn') ? menuItemHtml('lock', ico('lock', 15), locked ? 'Unlock the code' : 'Lock the code, keep the controls') : '',
      has('.midi-btn') ? menuItemHtml('midi', ico('keyboard', 15), 'Play from a MIDI keyboard…') : '',
      has('.mask-btn') ? menuItemHtml('mask', ico('sparkle', 15), 'LED mask over Bluetooth…') : '',
    ]) + group('Editor', [
      has('.options-btn') ? menuItemHtml('options', ico('sliders', 15), 'Editor settings…') : '',
    ]);
  };
  const MORE_TARGET: Record<string, string> = {
    lang: '.lang-btn', samples: '.sample-btn', synths: '.synthlib-btn', outline: '.outline-btn',
    docs: '.docs-btn', lock: '.lock-btn', midi: '.midi-btn', mask: '.mask-btn', options: '.options-btn',
  };
  const morePop: BodyPopoverHandle = mountBodyPopover(moreBtn, (el) => {
    el.innerHTML = moreHtml();
    el.addEventListener('click', (e) => {
      const row = (e.target as Element).closest<HTMLElement>('[data-act]');
      if (!row) return;
      morePop.close();
      later(q(MORE_TARGET[row.dataset.act ?? ''] ?? ''));
    });
    return el.querySelector<HTMLElement>('[data-act]');
  }, { className: 'folder-menu ctx-menu lolly-menu', ariaLabel: 'More' });
  moreBtn.addEventListener('click', () => (morePop.isOpen() ? morePop.close() : morePop.open()));

  // ── Context menus ──────────────────────────────────────────────────────
  // The gutter beside the code: the transport and the panels that read the code.
  wireTileContextMenu({
    host: app,
    tileSelector: '.cm-gutters',
    refOf: () => 'gutter',
    singleHtml: () => [
      state.playing && isDirty() ? menuItemHtml('apply', ico('refresh', 15), 'Apply changes') : '',
      !state.playing || state.paused ? menuItemHtml('run', ico('play', 15), state.paused ? 'Resume' : 'Run') : menuItemHtml('pause', ico('pause', 15), 'Pause'),
      state.playing ? menuItemHtml('stop', STOP, 'Stop') : '',
      has('.outline-btn') ? menuItemHtml('outline', ico('menuLines', 15), 'Outline') : '',
      has('.docs-btn') ? menuItemHtml('docs', ico('document', 15), 'Reference') : '',
    ].join(''),
    onAction: (act) => {
      if (act === 'apply' || act === 'run') {
        if (state.paused) later(q('.pause-btn'));
        else later(q('.run'));
      } else if (act === 'pause') later(q('.pause-btn'));
      else if (act === 'stop') later(q('.stop-btn'));
      else later(q(MORE_TARGET[act] ?? ''));
    },
    presentation: 'sheet',
    head: () => ({ name: nameEl.textContent || 'Song' }),
  });

  // The project rows in the song library.
  wireTileContextMenu({
    host: document.body,
    tileSelector: '.lib-row[data-project]',
    refOf: (tile) => tile.dataset.project ?? null,
    singleHtml: (t) => {
      const open = t.tile?.classList.contains('active');
      return menuItemHtml('open', ico('arrowRight', 15), open ? 'Open (already open)' : 'Open')
        + menuItemHtml('duplicate', ico('duplicate', 15), 'Duplicate')
        + menuItemHtml('delete', ico('trash', 15), 'Delete…', { danger: true, reason: open ? 'Open another song first.' : '' });
    },
    onAction: (act, t) => {
      if (!t) return;
      if (act === 'open') {
        later(t.tile);
        return;
      }
      const name = t.tile?.querySelector('.lib-row-name')?.textContent ?? 'this song';
      void h.library.then(async (lib) => {
        if (act === 'duplicate') await lib.store.duplicateProject(t.ref);
        else if (act === 'delete') {
          if (!window.confirm(`Delete "${name}"? Its saved versions go with it.`)) return;
          await lib.store.deleteProject(t.ref);
        } else return;
        // Redraw the open library: close it and open it again.
        later(projectBtn());
        setTimeout(() => later(projectBtn()), 30);
      }).catch((e: unknown) => host.notice('library', `That did not work: ${e instanceof Error ? e.message : String(e)}`));
    },
    presentation: 'sheet',
    head: (t) => ({ name: t?.tile?.querySelector('.lib-row-name')?.textContent ?? 'Song' }),
  });

  // The visualiser.
  wireTileContextMenu({
    host: viz,
    tileSelector: '.lolly-viz-stage',
    refOf: () => 'viz',
    singleHtml: () => menuItemHtml('next', ico('chevronRight', 15), 'Next preset')
      + menuItemHtml('shuffle', ico('sparkle', 15), 'Shuffle preset')
      + menuItemHtml('colour', ico('palette', 15), 'Shuffle brand colour')
      + menuItemHtml('immerse', ico(immersive ? 'close' : 'fitAll', 15), immersive ? 'Leave immersive' : 'Immersive')
      + menuItemHtml('hide', ico('eyeOff', 15), 'Hide the visualiser'),
    onAction: (act) => {
      if (act === 'next') step(1);
      else if (act === 'shuffle') shufflePreset();
      else if (act === 'colour') shuffleColour();
      else if (act === 'immerse') setImmersive(!immersive);
      else if (act === 'hide') void showViz(false);
    },
    presentation: 'sheet',
    head: () => ({ name: presets[at]!.label }),
  });
}
