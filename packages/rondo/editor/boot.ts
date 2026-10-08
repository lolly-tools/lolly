// SPDX-License-Identifier: MPL-2.0
/**
 * Lolly's boot script for the Rondocode editor frame.
 *
 * Runs before any of rondocode's own modules (it is the first script in the
 * frame), and leaves one object on globalThis.__lollyRondo: the host seam the
 * patch series reads (packages/rondo/patches, upstream file src/lolly/host.ts).
 *
 * What it sets up, all from the boot data the utility writes into the frame
 * (a JSON script element, #lolly-rondo-boot) and the message channel:
 *
 *   - the colour table, derived from the design system (theme.ts);
 *   - the brand and monospace font stacks, and the font files behind them,
 *     registered with FontFace so the frame never fetches a font;
 *   - memory stand-ins for localStorage and sessionStorage (storage.ts), with
 *     the editor's settings saved through the utility;
 *   - the project library (FrameDb), saved through the utility;
 *   - the song in the utility's inputs, both ways;
 *   - the shell's design tokens, as the utility resolves them on its page, so
 *     Lolly's chrome in the frame (chrome.ts) looks like the app around it;
 *   - file saving and exports (the utility encodes, signs and saves), the
 *     in-place notices, Lolly's chrome, and the one call that asks the
 *     utility for singing-model files.
 */
import { derivePalette, paletteCssVars, paletteProblems, type ThemeInput } from './theme.ts';
import { FrameDb, MemoryStorage, installStorage, type LibrarySnapshot, type StoreOp } from './storage.ts';
import {
  MAX_CODE_CHARS, MAX_NAME_CHARS, fromUpstreamLang, parseParentMessage, parseTheme, parseTokens, parseVizPresets, toUpstreamLang,
  type FrameMessage, type SingModelsAnswer, type SongLang,
} from './protocol.ts';
import { mountLollyChrome, type ChromeHandles, type ExportJob } from './chrome.ts';

interface FontFaceData {
  family: string;
  /** Base64 font file bytes (woff2, woff, ttf or otf). */
  data: string;
  weight?: string;
  style?: string;
  unicodeRange?: string;
}

/** What the utility writes into the frame before it loads. */
interface BootData {
  theme?: ThemeInput & { swatches?: string[] };
  fonts?: { brand?: string; mono?: string; faces?: FontFaceData[] };
  song?: { code: string; lang: SongLang; name: string } | null;
  library?: LibrarySnapshot | null;
  prefs?: Record<string, string>;
  reducedMotion?: boolean;
  /** The shell's design tokens, resolved by the utility: custom property → value. */
  tokens?: Record<string, string>;
  /** What the utility can do with an export. */
  exports?: { encoders?: string[]; credentials?: boolean; canSend?: boolean; assets?: boolean };
  /** The visualiser presets host.viz.presets() lists. */
  viz?: { presets?: unknown };
}

/** The brand colours the visualiser is seeded from, '#rrggbb' only. */
function swatchesOf(theme: ThemeInput & { swatches?: string[] }): string[] {
  const out: string[] = [];
  for (const c of [theme.primary, theme.secondary, ...(theme.swatches ?? [])]) {
    if (typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) && !out.includes(c.toLowerCase())) out.push(c.toLowerCase());
  }
  return out;
}

/**
 * Put a theme on the frame: the shell's tokens for Lolly's chrome, and the
 * editor's colour table as upstream's --c-* properties (every upstream
 * colour, CodeMirror's theme included, reads them through var()). Runs at boot
 * and again whenever the app's theme changes.
 */
function applyTheme(theme: ThemeInput, tokens: Record<string, string>): ReturnType<typeof derivePalette> {
  const root = document.documentElement;
  for (const [name, value] of Object.entries(parseTokens(tokens))) root.style.setProperty(name, value);
  const palette = derivePalette(theme);
  const problems = paletteProblems(palette);
  if (problems.length) console.warn('[lolly] colour contrast', problems);
  for (const [name, value] of Object.entries(paletteCssVars(palette))) root.style.setProperty(name, value);
  const dark = theme.mode ? theme.mode === 'dark' : (palette.bg.match(/[0-9a-f]{2}/gi) ?? []).reduce((n, x) => n + parseInt(x, 16), 0) < 384;
  root.style.colorScheme = dark ? 'dark' : 'light';
  root.dataset.lollyTheme = dark ? 'dark' : 'light';
  return palette;
}

interface UpstreamSong {
  code: string;
  lang?: 'rondocode' | 'rondo';
  name: string;
}

function readBoot(): BootData {
  const el = document.getElementById('lolly-rondo-boot');
  if (!el?.textContent) return {};
  try {
    const v = JSON.parse(el.textContent) as unknown;
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as BootData) : {};
  } catch {
    return {};
  }
}

const post = (msg: FrameMessage, transfer: Transferable[] = []): void => {
  try {
    window.parent.postMessage(msg, '*', transfer);
  } catch {
    // no parent (the editor opened on its own): nothing to tell
  }
};

/** A CSS font-family list, or null when it carries anything else. */
const fontStack = (v: unknown): string | null =>
  typeof v === 'string' && v.length < 400 && /^[\w\s,'"-]+$/.test(v) ? v : null;

function registerFonts(faces: FontFaceData[] | undefined): void {
  if (!Array.isArray(faces) || typeof FontFace === 'undefined') return;
  for (const f of faces.slice(0, 8)) {
    if (!f || typeof f.family !== 'string' || typeof f.data !== 'string' || !fontStack(f.family)) continue;
    try {
      const bin = atob(f.data);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const face = new FontFace(f.family.replace(/^['"]|['"]$/g, ''), bytes, {
        ...(typeof f.weight === 'string' ? { weight: f.weight } : {}),
        ...(typeof f.style === 'string' ? { style: f.style } : {}),
        ...(typeof f.unicodeRange === 'string' ? { unicodeRange: f.unicodeRange } : {}),
        display: 'swap',
      });
      document.fonts.add(face);
      void face.load().catch((e: unknown) => console.warn('[lolly] a brand font did not load', f.family, e));
    } catch (e) {
      console.warn('[lolly] a brand font was refused', f.family, e);
    }
  }
}

/** The settings the frame starts with when the utility has none saved: the
 *  first-run tour stays closed (it is one click away in the editor's settings). */
const DEFAULT_PREFS: Record<string, string> = { 'rc.tourDone': '1' };

/** Notices, one per subject, in upstream's notice style. Esc or the button closes one. */
function makeNotices(): (key: string, message: string) => void {
  const shown = new Map<string, HTMLElement>();
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const last = [...shown.values()].pop();
    if (last && !last.classList.contains('hidden')) {
      last.classList.add('hidden');
      e.stopPropagation();
    }
  }, true);
  return (key, message) => {
    let bar = shown.get(key);
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'lib-notice lolly-notice';
      bar.setAttribute('role', 'status');
      const text = document.createElement('span');
      text.className = 'lib-notice-text';
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'lib-notice-close';
      close.setAttribute('aria-label', 'Close');
      close.textContent = '×';
      const b = bar;
      close.addEventListener('click', () => b.classList.add('hidden'));
      bar.append(text, close);
      document.body.append(bar);
      shown.set(key, bar);
    }
    bar.querySelector('.lib-notice-text')!.textContent = message;
    // An empty message takes the notice away (the app said what happened itself).
    bar.classList.toggle('hidden', message === '');
  };
}

function boot(): void {
  const data = readBoot();

  // Colours and type.
  const bootTheme = parseTheme(data.theme) ?? {};
  const palette = applyTheme(bootTheme, data.tokens ?? {});
  const themeListeners = new Set<(swatches: string[]) => void>();
  let swatches = swatchesOf(bootTheme);
  const root = document.documentElement;
  const brand = fontStack(data.fonts?.brand);
  const mono = fontStack(data.fonts?.mono);
  if (brand) root.style.setProperty('--font-brand', brand);
  if (mono) root.style.setProperty('--font-mono', mono);
  registerFonts(data.fonts?.faces);

  const notice = makeNotices();

  // Storage.
  let prefTimer = 0;
  const prefChanges: Record<string, string | null> = {};
  const local = new MemoryStorage({ ...DEFAULT_PREFS, ...(data.prefs ?? {}) }, (key, value) => {
    prefChanges[key] = value;
    clearTimeout(prefTimer);
    prefTimer = window.setTimeout(() => {
      const items = { ...prefChanges };
      for (const k of Object.keys(prefChanges)) delete prefChanges[k];
      post({ kind: 'rondo:prefs', items });
    }, 400);
  });
  installStorage(local, new MemoryStorage());

  // The project library. Writes are batched per task, so one save that touches
  // three records is one message.
  let pendingOps: StoreOp[] = [];
  const db = new FrameDb(data.library ?? null, (op) => {
    if (pendingOps.length === 0) queueMicrotask(() => {
      const ops = pendingOps;
      pendingOps = [];
      post({ kind: 'rondo:store', ops });
    });
    pendingOps.push(op);
  });

  // The song, both ways.
  const s = data.song;
  const song: UpstreamSong | null = s && typeof s.code === 'string' && s.code.trim() !== '' && s.code.length <= MAX_CODE_CHARS
    ? { code: s.code, name: typeof s.name === 'string' && s.name.trim() ? s.name.slice(0, MAX_NAME_CHARS) : 'Untitled song', ...(toUpstreamLang(s.lang) ? { lang: toUpstreamLang(s.lang) } : {}) }
    : null;
  const songListeners = new Set<(song: UpstreamSong) => void>();
  let docTimer = 0;
  /** The song's name, as the editor last reported the name. */
  let currentName = song?.name ?? 'Untitled song';
  /** The editor, once the app has mounted Lolly's chrome. */
  let editorRef: ChromeHandles['editor'] | null = null;
  /** The song in the editor now: what a render or a recording was made from. */
  const songNow = (): { code: string; lang: 'js' | 'rondo'; name: string } | null =>
    editorRef ? { code: editorRef.getDoc().slice(0, MAX_CODE_CHARS), lang: fromUpstreamLang(editorRef.getLang()), name: currentName } : null;
  let lastDoc = '';
  const publishDoc = (d: { code: string; lang: string; name: string }): void => {
    if (typeof d.name === 'string' && d.name.trim()) currentName = d.name.slice(0, MAX_NAME_CHARS);
    clearTimeout(docTimer);
    docTimer = window.setTimeout(() => {
      if (d.code.length > MAX_CODE_CHARS) return;
      const msg: FrameMessage = { kind: 'rondo:doc', code: d.code, lang: fromUpstreamLang(d.lang), name: d.name.slice(0, MAX_NAME_CHARS) };
      const key = JSON.stringify(msg);
      if (key === lastDoc) return;
      lastDoc = key;
      post(msg);
    }, 200);
  };

  // Singing-model files, asked of the utility.
  let nextId = 1;
  const pending = new Map<number, { resolve(f: Record<string, ArrayBuffer>): void; reject(e: Error): void; progress?: (p: { label: string; done: number; total: number }) => void }>();
  const singModels = (files: string[], onProgress?: (p: { label: string; done: number; total: number }) => void): Promise<Record<string, ArrayBuffer>> =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject, progress: onProgress });
      post({ kind: 'rondo:sing-models', id, files: files.slice(0, 32) });
    });
  const answerSing = (m: SingModelsAnswer): void => {
    const p = pending.get(m.id);
    if (!p) return;
    pending.delete(m.id);
    if (m.ok) p.resolve(m.files ?? {});
    else p.reject(Object.assign(new Error(m.message || 'Singing needs voice models that are not available here.'), { lollyReason: m.reason ?? 'error' }));
  };

  window.addEventListener('message', (e) => {
    if (e.source !== window.parent) return;
    const m = parseParentMessage(e.data);
    if (!m) return;
    if (m.kind === 'rondo:song') {
      const next: UpstreamSong = { code: m.code, name: m.name, ...(toUpstreamLang(m.lang) ? { lang: toUpstreamLang(m.lang) } : {}) };
      for (const fn of songListeners) fn(next);
    } else if (m.kind === 'rondo:sing-models') answerSing(m);
    else if (m.kind === 'rondo:sing-progress') pending.get(m.id)?.progress?.({ label: m.label, done: m.done, total: m.total });
    else if (m.kind === 'rondo:export-result') {
      const job = exportsPending.get(m.id);
      exportsPending.delete(m.id);
      if (job) m.ok ? job.resolve(m.message) : job.reject(new Error(m.message));
    } else if (m.kind === 'rondo:immersive') for (const fn of immersiveListeners) fn(m.on);
    else if (m.kind === 'rondo:notice') notice(`parent-${m.key}`, m.message);
    else if (m.kind === 'rondo:viz-preset') {
      const p = vizAsked.get(m.id);
      vizAsked.delete(m.id);
      p?.(m.ok && typeof m.json === 'string' ? m.json : null);
    } else if (m.kind === 'rondo:theme') {
      Object.assign(palette, applyTheme(m.theme, m.tokens));
      swatches = swatchesOf(m.theme);
      for (const fn of themeListeners) fn(swatches);
    }
  });

  // Artist visualiser presets, asked of the utility one at a time (the frame
  // cannot fetch). Each answer is cached; a preset is about 4 KB.
  let nextViz = 1;
  const vizAsked = new Map<number, (json: string | null) => void>();
  const vizCache = new Map<string, Promise<string | null>>();
  const vizPreset = (preset: string): Promise<string | null> => {
    let hit = vizCache.get(preset);
    if (!hit) {
      hit = new Promise<string | null>((resolve) => {
        const id = nextViz++;
        vizAsked.set(id, resolve);
        post({ kind: 'rondo:viz-preset', id, preset });
        setTimeout(() => { if (vizAsked.delete(id)) resolve(null); }, 15000);
      }).then((json) => {
        if (json === null) vizCache.delete(preset); // try again next time
        return json;
      });
      vizCache.set(preset, hit);
    }
    return hit;
  };

  // Exports: the frame renders, the utility encodes, signs, reads back and saves.
  let nextExport = 1;
  const exportsPending = new Map<number, { resolve(message: string): void; reject(e: Error): void }>();
  const immersiveListeners = new Set<(on: boolean) => void>();
  const exportFile = (job: ExportJob): Promise<string> => new Promise((resolve, reject) => {
    const id = nextExport++;
    const own = (u: Uint8Array): ArrayBuffer => u.slice().buffer;
    const transfer: Transferable[] = [];
    const audio = job.audio ? own(job.audio) : undefined;
    const midi = job.midi ? own(job.midi) : undefined;
    const stems = job.stems?.slice(0, 64).map((f) => ({ name: f.name.slice(0, 200), part: f.part.slice(0, 200), bytes: own(f.bytes) }));
    if (audio) transfer.push(audio);
    if (midi) transfer.push(midi);
    for (const f of stems ?? []) transfer.push(f.bytes);
    const doc = songNow();
    if (!doc) {
      reject(new Error('The song is not ready yet.'));
      return;
    }
    exportsPending.set(id, { resolve, reject });
    post({
      kind: 'rondo:export', id, format: job.format,
      ...(audio ? { audio } : {}), ...(midi ? { midi } : {}), ...(stems ? { stems } : {}),
      sung: job.sung.slice(0, 20), voices: job.voices.slice(0, 20), silent: job.silent.slice(0, 20),
      song: doc, ...(job.send ? { send: true } : {}), ...(job.dest === 'assets' ? { dest: 'assets' } : {}),
    }, transfer);
  });

  // Audio contexts the app opens, so the utility's checks can read their state.
  const contexts: AudioContext[] = [];
  const Native = window.AudioContext;
  if (typeof Native === 'function') {
    window.AudioContext = class extends Native {
      constructor(opts?: AudioContextOptions) {
        super(opts);
        contexts.push(this);
      }
    };
  }


  const host = {
    palette,
    song,
    openDb: () => Promise.resolve(db),
    publishDoc,
    onSong: (fn: (song: UpstreamSong) => void) => { songListeners.add(fn); },
    download: (bytes: Uint8Array, name: string, type: string, about?: { sung?: string[]; voices?: string[] }) => {
      const copy = bytes.slice().buffer;
      const names = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 20) : []);
      const doc = songNow();
      post({
        kind: 'rondo:download', name: String(name).slice(0, 200), mime: String(type).slice(0, 100), bytes: copy,
        sung: names(about?.sung), voices: names(about?.voices), ...(doc ? { song: doc } : {}),
      }, [copy]);
    },
    mountChrome: (handles: ChromeHandles) => {
      editorRef = handles.editor;
      mountLollyChrome(handles, {
        swatches,
        onTheme: (fn: (swatches: string[]) => void) => { themeListeners.add(fn); },
        vizPresets: parseVizPresets(data.viz?.presets),
        vizPreset,
        reducedMotion: Boolean(data.reducedMotion),
        encoders: Array.isArray(data.exports?.encoders) ? data.exports.encoders.filter((x) => typeof x === 'string') : [],
        credentials: data.exports?.credentials === true,
        canSend: data.exports?.canSend === true,
        canSaveAssets: data.exports?.assets === true,
        notice,
        exportFile,
        immersive: (on: boolean) => post({ kind: 'rondo:immersive', on }),
        onImmersive: (fn: (on: boolean) => void) => { immersiveListeners.add(fn); },
      });
    },
    notice,
    singModels,
    debug: {
      audioStates: (): string[] => contexts.map((c) => c.state),
      palette: () => ({ ...palette }),
    },
  };
  (globalThis as { __lollyRondo?: unknown }).__lollyRondo = host;

  const ready = (): void => post({ kind: 'rondo:ready' });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready, { once: true });
  else ready();
}

boot();
