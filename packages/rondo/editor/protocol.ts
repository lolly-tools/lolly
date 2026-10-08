// SPDX-License-Identifier: MPL-2.0
/**
 * The messages between the Rondocode utility and its editor frame.
 *
 * The frame has an opaque origin, so an origin check means nothing: both sides
 * check where a message came from (the frame's window, or its parent) and then
 * its shape, field by field, with a size limit on everything that can grow.
 * Every message is a plain object whose `kind` starts with `rondo:`.
 *
 * Frame to utility:
 *   rondo:ready        the editor is up
 *   rondo:doc          the song in the editor: { code, lang, name }
 *   rondo:store        changes to the project library: { ops }
 *   rondo:prefs        changed editor settings: { items } (null removes one)
 *   rondo:download     a file upstream's own controls made (a recording, a project
 *                      export): { name, mime, bytes, sung, song } (sung: the parts
 *                      whose AI-generated singing is in the file)
 *   rondo:sing-models  a request for singing-model files: { id, files }
 *   rondo:export       a finished render for the utility to encode, sign and
 *                      save: { id, format, audio | stems | midi, sung, voices,
 *                      silent, song }
 *   rondo:immersive    put the frame in full screen, or take it out: { on }
 *   rondo:viz-preset   an artist visualiser preset's JSON, please: { id, preset }
 *
 * Utility to frame:
 *   rondo:song         replace the song: { code, lang, name }
 *   rondo:sing-models  the answer: { id, ok: true, files } or { id, ok: false, reason, message }
 *   rondo:sing-progress  { id, label, done, total }
 *   rondo:export-result  what the utility did with an export: { id, ok, message }
 *   rondo:immersive    the frame left full screen: { on: false }
 *   rondo:notice       a sentence to show in the editor: { key, message }
 *   rondo:theme        the app's theme changed (light or dark, contrast, design
 *                      system): { theme, tokens }, in the boot data's shapes
 *   rondo:viz-preset   the answer: { id, ok, json } (json: the preset's text)
 *
 * The utility's half lives in community/rondocode/template.html as plain
 * script; this module is the frame's half and the reference for both.
 */
import type { StoreOp } from './storage.ts';

/** Largest song accepted, in characters (the engine's limit is 256 KB of UTF-8). */
export const MAX_CODE_CHARS = 256 * 1024;
/** Longest song name kept. */
export const MAX_NAME_CHARS = 200;

export type SongLang = 'js' | 'rondo' | 'auto';

export interface SongMessage {
  kind: 'rondo:song';
  code: string;
  lang: SongLang;
  name: string;
}

export interface SingModelsAnswer {
  kind: 'rondo:sing-models';
  id: number;
  ok: boolean;
  files?: Record<string, ArrayBuffer>;
  reason?: 'declined' | 'offline' | 'error';
  message?: string;
}

export interface SingProgressMessage {
  kind: 'rondo:sing-progress';
  id: number;
  label: string;
  done: number;
  total: number;
}

export interface ExportResultMessage {
  kind: 'rondo:export-result';
  id: number;
  ok: boolean;
  /** One or two plain sentences for the person, said after the file was read back. */
  message: string;
}

export interface ImmersiveMessage {
  kind: 'rondo:immersive';
  on: boolean;
}

export interface NoticeMessage {
  kind: 'rondo:notice';
  /** One notice per subject: a later notice with the same key takes the earlier one's place. */
  key: string;
  message: string;
}

/** The app's colours, as the boot data carries them (theme.ts ThemeInput plus brand swatches). */
export interface ThemeData {
  primary?: string;
  secondary?: string;
  warn?: string;
  danger?: string;
  mode?: 'light' | 'dark';
  highContrast?: boolean;
  ui?: Record<string, string>;
  swatches?: string[];
}

export interface ThemeMessage {
  kind: 'rondo:theme';
  theme: ThemeData;
  /** The shell's design tokens the chrome reads: custom property → value. */
  tokens: Record<string, string>;
}

export interface VizPresetAnswer {
  kind: 'rondo:viz-preset';
  id: number;
  ok: boolean;
  /** The preset file's text (a converted MilkDrop preset, JSON). */
  json?: string;
}

/** Largest artist preset accepted, in characters (the pack's are around 4 KB). */
export const MAX_VIZ_PRESET_CHARS = 256 * 1024;

export type ParentMessage = SongMessage | SingModelsAnswer | SingProgressMessage | ExportResultMessage | ImmersiveMessage | NoticeMessage | ThemeMessage | VizPresetAnswer;

/** One visualiser preset as the boot data lists it (host.viz.presets()). */
export interface VizPresetEntry {
  id: string;
  name: string;
  author: string;
  calm: boolean;
}

/** The boot data's preset list, keeping only well-formed entries. */
export function parseVizPresets(v: unknown): VizPresetEntry[] {
  if (!Array.isArray(v)) return [];
  const out: VizPresetEntry[] = [];
  for (const p of v.slice(0, 2000)) {
    if (!isObj(p) || !str(p.id, 120) || !/^(stock:)?[\w.-]+$/.test(p.id) || !str(p.name, 200) || !str(p.author, 200)) continue;
    out.push({ id: p.id, name: p.name, author: p.author, calm: p.calm === true });
  }
  return out;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max;
const count = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;

const HEX = /^#[0-9a-f]{6}$/i;
const UI_KEYS = ['canvas', 'raised', 'muted', 'overlay', 'border', 'text', 'textMuted', 'accent', 'danger'] as const;

/** A theme from the utility, keeping only '#rrggbb' colours and the known fields. */
export function parseTheme(v: unknown): ThemeData | null {
  if (!isObj(v)) return null;
  const out: ThemeData = {};
  for (const k of ['primary', 'secondary', 'warn', 'danger'] as const) if (typeof v[k] === 'string' && HEX.test(v[k] as string)) out[k] = v[k] as string;
  if (v.mode === 'light' || v.mode === 'dark') out.mode = v.mode;
  if (v.highContrast === true) out.highContrast = true;
  if (isObj(v.ui)) {
    const ui: Record<string, string> = {};
    for (const k of UI_KEYS) if (typeof v.ui[k] === 'string' && HEX.test(v.ui[k] as string)) ui[k] = v.ui[k] as string;
    out.ui = ui;
  }
  if (Array.isArray(v.swatches)) out.swatches = v.swatches.filter((x): x is string => typeof x === 'string' && HEX.test(x)).slice(0, 24);
  return out;
}

/** Design tokens from the utility: keys that are custom properties, values that are plain CSS. */
export function parseTokens(v: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!isObj(v)) return out;
  let n = 0;
  for (const [name, value] of Object.entries(v)) {
    if (++n > 400) break;
    if (/^--[\w-]{1,80}$/.test(name) && typeof value === 'string' && value.length <= 400 && !/[;{}<>\\]|url\(|expression\(|@import/i.test(value)) out[name] = value;
  }
  return out;
}

/** One export, as the frame hands it over. */
export interface ExportMessage {
  kind: 'rondo:export';
  id: number;
  format: 'wav' | 'mp3' | 'm4a' | 'opus' | 'flac' | 'zip' | 'mid' | 'json';
  /** The mix as WAV (the audio formats). */
  audio?: ArrayBuffer;
  /** One WAV per part (zip). */
  stems?: { name: string; part: string; bytes: ArrayBuffer }[];
  /** The MIDI file (mid). */
  midi?: ArrayBuffer;
  /** Parts whose synthesised singing is in the render. */
  sung: string[];
  /** The voices that singing used. */
  voices: string[];
  /** Parts the render left silent. */
  silent: string[];
  /** The song the render was made from. */
  song: { code: string; lang: 'js' | 'rondo'; name: string };
  /** Hand the file to the system's share sheet instead of saving the file. */
  send?: boolean;
  /** Save the file into the person's Assets (host.assets.add) instead of downloading. */
  dest?: 'assets';
}

export type FrameMessage =
  | { kind: 'rondo:ready' }
  | { kind: 'rondo:doc'; code: string; lang: 'js' | 'rondo'; name: string }
  | { kind: 'rondo:store'; ops: StoreOp[] }
  | { kind: 'rondo:prefs'; items: Record<string, string | null> }
  | { kind: 'rondo:download'; name: string; mime: string; bytes: ArrayBuffer; sung: string[]; voices: string[]; song?: { code: string; lang: 'js' | 'rondo'; name: string } }
  | { kind: 'rondo:sing-models'; id: number; files: string[] }
  | ExportMessage
  | ImmersiveMessage
  | { kind: 'rondo:viz-preset'; id: number; preset: string };

/** Read a message from the utility, or null when it is not one this frame accepts. */
export function parseParentMessage(data: unknown): ParentMessage | null {
  if (!isObj(data) || typeof data.kind !== 'string') return null;
  switch (data.kind) {
    case 'rondo:song': {
      if (!str(data.code, MAX_CODE_CHARS) || !str(data.name, MAX_NAME_CHARS)) return null;
      const lang = data.lang === 'js' || data.lang === 'rondo' ? data.lang : 'auto';
      return { kind: 'rondo:song', code: data.code, lang, name: data.name };
    }
    case 'rondo:sing-models': {
      if (!Number.isSafeInteger(data.id) || typeof data.ok !== 'boolean') return null;
      if (data.ok) {
        if (!isObj(data.files)) return null;
        const files: Record<string, ArrayBuffer> = {};
        for (const [k, v] of Object.entries(data.files)) if (v instanceof ArrayBuffer) files[k] = v;
        return { kind: 'rondo:sing-models', id: data.id as number, ok: true, files };
      }
      const reason = data.reason === 'declined' || data.reason === 'offline' ? data.reason : 'error';
      const message = str(data.message, 400) ? data.message : '';
      return { kind: 'rondo:sing-models', id: data.id as number, ok: false, reason, message };
    }
    case 'rondo:sing-progress': {
      if (!Number.isSafeInteger(data.id) || !str(data.label, 200) || !count(data.done) || !count(data.total)) return null;
      return { kind: 'rondo:sing-progress', id: data.id as number, label: data.label, done: data.done, total: data.total };
    }
    case 'rondo:export-result': {
      if (!Number.isSafeInteger(data.id) || typeof data.ok !== 'boolean' || !str(data.message, 1000)) return null;
      return { kind: 'rondo:export-result', id: data.id as number, ok: data.ok, message: data.message };
    }
    case 'rondo:notice': {
      if (!str(data.key, 40) || !/^[a-z-]+$/.test(data.key) || !str(data.message, 1000)) return null;
      return { kind: 'rondo:notice', key: data.key, message: data.message };
    }
    case 'rondo:viz-preset': {
      if (!Number.isSafeInteger(data.id) || typeof data.ok !== 'boolean') return null;
      if (data.ok && !str(data.json, MAX_VIZ_PRESET_CHARS)) return null;
      return { kind: 'rondo:viz-preset', id: data.id as number, ok: data.ok, ...(data.ok ? { json: data.json as string } : {}) };
    }
    case 'rondo:theme': {
      const theme = parseTheme(data.theme);
      if (!theme) return null;
      return { kind: 'rondo:theme', theme, tokens: parseTokens(data.tokens) };
    }
    case 'rondo:immersive': {
      if (typeof data.on !== 'boolean') return null;
      return { kind: 'rondo:immersive', on: data.on };
    }
    default:
      return null;
  }
}

/** Lolly's language names and upstream's: 'js' is upstream's 'rondocode'. */
export const toUpstreamLang = (lang: SongLang): 'rondocode' | 'rondo' | undefined =>
  lang === 'js' ? 'rondocode' : lang === 'rondo' ? 'rondo' : undefined;
export const fromUpstreamLang = (lang: string): 'js' | 'rondo' => (lang === 'rondo' ? 'rondo' : 'js');
