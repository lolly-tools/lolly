// SPDX-License-Identifier: MPL-2.0
/**
 * The music generator's instrument preferences (#/music): the instruments a person
 * starred and the ones they blocked, for each part, kept on the person's profile
 * (`Profile.music`) like their other choices, so they travel with the profile's backup
 * and sync. A shuffle draws a starred instrument more often and never draws a blocked
 * one (lib/music-shuffle.ts). When the composer itself draws a blocked instrument for a
 * new tune, `avoidBlocked` puts another instrument the style plays in its place and
 * writes that choice into the track's state, so the link plays the same for anyone who
 * opens it, whatever they have blocked. A link that already sets an instrument plays
 * that instrument.
 *
 * Also here: the families the instrument browser groups instruments by. Pure, with no
 * DOM, so the tests can run every rule.
 */
import type { Profile } from '@lolly-tools/core/host-v1';
import { composeLofiTune, LOFI_KEYS, LOFI_LEADS, LOFI_BASSES, type LofiBar, type LofiMood } from '../../../../engine/src/lofi-compose.ts';
import { composeTrack, type MusicState } from './music-state.ts';
import { instrumentIcon, type InstrumentIcon } from './instrument-icons.ts';

/** The parts whose instrument a person chooses. */
export type MusicPart = 'keys' | 'lead' | 'bass';
export const MUSIC_PARTS: readonly MusicPart[] = ['lead', 'keys', 'bass'];

/** Every instrument a part can play, in the composer's order ('none' is not one). */
export function instrumentsOf(part: MusicPart): readonly string[] {
  return (part === 'keys' ? LOFI_KEYS : part === 'lead' ? LOFI_LEADS : LOFI_BASSES).filter(v => v !== 'none');
}

// ── families ─────────────────────────────────────────────────────────────────

/** The families the browser groups instruments by, in the order it shows them. */
export const INSTRUMENT_FAMILIES = ['keys', 'guitars', 'bells', 'winds', 'voices', 'world', 'synths', 'chip'] as const;
export type InstrumentFamily = typeof INSTRUMENT_FAMILIES[number];

/** Instruments from a tradition of their own, whatever their icon. */
const WORLD = new Set(['tar', 'santur', 'zheng', 'koto', 'shamisen', 'kora', 'balafon', 'ney', 'kamancheh', 'erhu', 'dizi', 'pipa', 'shakuhachi', 'yidaki', 'log']);
/** Every other instrument goes by its icon, so a new one goes to a sensible family. */
const BY_ICON: Record<InstrumentIcon, InstrumentFamily> = {
  piano: 'keys', guitar: 'guitars', bowed: 'guitars', wind: 'winds', horn: 'winds', micVocal: 'voices', bell: 'bells', gamepad: 'chip', audioWaveform: 'synths', drum: 'synths',
};

/** The family an instrument belongs to. */
export function familyOf(part: MusicPart, id: string): InstrumentFamily {
  return WORLD.has(id) ? 'world' : BY_ICON[instrumentIcon(part, id)];
}

// ── preferences ──────────────────────────────────────────────────────────────

/** Favourites and blocks, each entry `<part>:<instrument>`, as `Profile.music` stores them. */
export interface MusicPrefs {
  favourites: ReadonlySet<string>;
  blocked: ReadonlySet<string>;
}
export const NO_PREFS: MusicPrefs = { favourites: new Set(), blocked: new Set() };
export type MusicPrefKind = 'favourite' | 'blocked';

export const prefKey = (part: MusicPart, id: string): string => `${part}:${id}`;
export const isFavourite = (p: MusicPrefs, part: MusicPart, id: string): boolean => p.favourites.has(prefKey(part, id));
export const isBlocked = (p: MusicPrefs, part: MusicPart, id: string): boolean => p.blocked.has(prefKey(part, id));

const ENTRY = /^(keys|lead|bass):[a-z0-9]+$/i;
/** The entries of a stored list. Entries this build does not know (an instrument added
 *  by a later version) are kept, so saving here never drops them. */
const entries = (list: unknown): string[] => Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string' && ENTRY.test(x)) : [];

/** The person's preferences, from their profile. */
export function loadMusicPrefs(profile: Profile | null | undefined): MusicPrefs {
  return { favourites: new Set(entries(profile?.music?.favourites)), blocked: new Set(entries(profile?.music?.blocked)) };
}

/**
 * Star or block one instrument, or undo either, on the profile record (the caller then
 * saves it with host.profile.set). Starring an instrument unblocks it and blocking one
 * unstars it: the two never hold together. An empty record leaves the field out, so a
 * profile that never used the generator stays as it was. Returns the new preferences.
 */
export function setMusicPref(profile: Profile, part: MusicPart, id: string, kind: MusicPrefKind, on: boolean): MusicPrefs {
  const key = prefKey(part, id);
  const favourites = entries(profile.music?.favourites).filter(k => k !== key);
  const blocked = entries(profile.music?.blocked).filter(k => k !== key);
  if (on) (kind === 'favourite' ? favourites : blocked).push(key);
  const music: NonNullable<Profile['music']> = {};
  if (favourites.length) music.favourites = favourites;
  if (blocked.length) music.blocked = blocked;
  if (Object.keys(music).length) profile.music = music;
  else delete profile.music;
  return { favourites: new Set(favourites), blocked: new Set(blocked) };
}

// ── what a style plays ───────────────────────────────────────────────────────

/** Tunes of a style read to learn its instruments: enough to meet the rarer ones. */
const STYLE_SEEDS = 24;
const styleCache = new Map<LofiMood, Record<MusicPart, string[]>>();

/** The instruments a part plays where it has notes in `bars`, by kind of section: each
 *  bar's own instrument, or the tune's, and a drop's doubling of the lead. */
export function heardBySection(bars: readonly LofiBar[], part: MusicPart): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const bar of bars) {
    if (bar.section === 'rest' || !bar.notes.some(n => n.voice === part)) continue;
    const list = out.get(bar.section) ?? [];
    const own = bar.voices?.[part] ?? bar.tune.style[part];
    if (!list.includes(own)) list.push(own);
    const double = part === 'lead' ? bar.voices?.double : undefined;
    if (double && !list.includes(double)) list.push(double);
    out.set(bar.section, list);
  }
  return out;
}

/**
 * The instruments a style plays for a part, most often first: read from the style's
 * own tunes on a fixed set of seeds (the same answer every time), every section's
 * instrument included. A shuffle and a substitute stay inside this list.
 */
export function styleInstruments(mood: LofiMood, part: MusicPart): readonly string[] {
  let found = styleCache.get(mood);
  if (!found) {
    const counts: Record<MusicPart, Map<string, number>> = { keys: new Map(), lead: new Map(), bass: new Map() };
    for (let n = 1; n <= STYLE_SEEDS; n++) {
      const bars = composeLofiTune((n * 2654435761) >>> 0, mood);
      for (const p of MUSIC_PARTS) {
        for (const list of heardBySection(bars, p).values()) for (const id of list) counts[p].set(id, (counts[p].get(id) ?? 0) + 1);
      }
    }
    const ranked = (m: Map<string, number>): string[] => [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([id]) => id);
    found = { keys: ranked(counts.keys), lead: ranked(counts.lead), bass: ranked(counts.bass) };
    styleCache.set(mood, found);
  }
  return found[part];
}

// ── keeping blocked instruments out of a new tune ────────────────────────────

/** One instrument put in place of a blocked one: for the whole track, or for one kind of section. */
export interface MusicSwap {
  part: MusicPart;
  section?: string;
  from: string;
  to: string;
}

/** A small, fixed scramble of the seed, the part and the section, to choose among substitutes. */
function salt(seed: number, part: MusicPart, section: string): number {
  let h = (seed ^ 0x2545f491) >>> 0;
  for (const ch of `${part}|${section}`) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0;
  return h;
}

/**
 * What plays in place of a blocked instrument: a favourite the style plays, else one of
 * the instruments already heard there, else another the style plays, else (a style
 * whose every choice is blocked) any instrument of the part that is not blocked, the
 * person's favourites first. Undefined only when every instrument of the part is blocked.
 */
export function substituteFor(prefs: MusicPrefs, mood: LofiMood, part: MusicPart, heard: readonly string[], seed: number, section = ''): string | undefined {
  const ok = (id: string): boolean => !isBlocked(prefs, part, id);
  const style = styleInstruments(mood, part).filter(ok);
  const favs = style.filter(id => isFavourite(prefs, part, id));
  if (favs.length) return favs[salt(seed, part, section) % favs.length];
  const kept = heard.find(id => ok(id) && style.includes(id));
  if (kept) return kept;
  if (style.length) return style[salt(seed, part, section) % style.length];
  const any = instrumentsOf(part).filter(ok);
  const anyFav = any.filter(id => isFavourite(prefs, part, id));
  const from = anyFav.length ? anyFav : any;
  return from.length ? from[salt(seed, part, section) % from.length] : undefined;
}

/** Set a part's instrument for the whole track, or for one kind of section: only a name the part knows. */
export function setPartInstrument(s: MusicState, part: MusicPart, id: string | undefined, section?: string): void {
  const keys = part === 'keys' ? LOFI_KEYS.find(x => x === id) : undefined;
  const lead = part === 'lead' ? LOFI_LEADS.find(x => x === id) : undefined;
  const bass = part === 'bass' ? LOFI_BASSES.find(x => x === id) : undefined;
  if (section === undefined) {
    if (part === 'keys') s.keys = keys;
    if (part === 'lead') s.lead = lead;
    if (part === 'bass') s.bass = bass;
    return;
  }
  const v = { ...s.sections[section] };
  if (part === 'keys') v.keys = keys;
  if (part === 'lead') v.lead = lead;
  if (part === 'bass') v.bass = bass;
  if (!v[part]) delete v[part];
  if (Object.keys(v).length) s.sections[section] = v; else delete s.sections[section];
}

const copyState = (s: MusicState): MusicState => ({
  ...s,
  mix: { ...s.mix },
  sections: Object.fromEntries(Object.entries(s.sections).map(([k, v]) => [k, { ...v }])),
  ...(s.quiet ? { quiet: [...s.quiet] } : {}),
});

/**
 * The track with every instrument the composer drew that the person blocked replaced,
 * and the replacements written into the state (`lead=`, or `drop.lead=` for one kind of
 * section), so the link carries them and plays the same for everyone. An instrument the
 * state already names, for the track or a kind of section, is the person's or the
 * link's choice and is kept even when blocked.
 *
 * When the blocked instrument is a tune's own (heard across the track), the replacement
 * is set for the whole track; when only a section's change of instrument is blocked
 * (an intro's lead, a drop's doubling), it is set for that kind of section alone.
 */
export function avoidBlocked(state: MusicState, prefs: MusicPrefs): { state: MusicState; swaps: MusicSwap[] } {
  const swaps: MusicSwap[] = [];
  if (!prefs.blocked.size) return { state, swaps };
  const s = copyState(state);
  // A swap can change the arrangement's instruments in turn (a bass set for the whole
  // track is the one every section plays), so look again until nothing blocked is left.
  for (let pass = 0; pass < 3; pass++) {
    const bars = composeTrack(s);
    let changed = false;
    for (const part of MUSIC_PARTS) {
      if (s[part]) continue;
      const heard = heardBySection(bars, part);
      const blockedIn = [...heard].filter(([section, list]) => !s.sections[section]?.[part] && list.some(id => isBlocked(prefs, part, id)));
      if (!blockedIn.length) continue;
      const tuneOwn = bars.find(b => isBlocked(prefs, part, b.tune.style[part]) && b.notes.some(n => n.voice === part) && !(b.voices?.[part]) && !s.sections[b.section]?.[part]);
      if (tuneOwn) {
        const all = [...new Set([...heard.values()].flat())];
        const to = substituteFor(prefs, s.mood, part, all, s.seed);
        if (!to) continue;
        setPartInstrument(s, part, to);
        swaps.push({ part, from: tuneOwn.tune.style[part], to });
        changed = true;
        continue;
      }
      for (const [section, list] of blockedIn) {
        const to = substituteFor(prefs, s.mood, part, list, s.seed, section);
        if (!to) continue;
        setPartInstrument(s, part, to, section);
        swaps.push({ part, section, from: list.find(id => isBlocked(prefs, part, id))!, to });
        changed = true;
      }
    }
    if (!changed) break;
  }
  return { state: s, swaps };
}

/** Where a swap is written in the state: `lead`, or `drop.lead` for a kind of section. */
export const swapKey = (w: MusicSwap): string => (w.section ? `${w.section}.${w.part}` : w.part);

/** Take back what earlier swaps wrote (by swapKey), so a new tune is free to choose again. */
export function clearSwaps(state: MusicState, keys: Iterable<string>): void {
  for (const key of keys) {
    const [a, b] = key.split('.');
    if (!b) { if (a === 'keys' || a === 'lead' || a === 'bass') delete state[a]; continue; }
    const v = state.sections[a!];
    if (!v || (b !== 'keys' && b !== 'lead' && b !== 'bass')) continue;
    delete v[b];
    if (!Object.keys(v).length) delete state.sections[a!];
  }
}
