// SPDX-License-Identifier: MPL-2.0
/** Versioned cue authoring compiled into ordinary Design layer timing. */
import { parseKf, serialiseKf } from './keyframes.ts';

export interface MotionCue { id: string; at?: number; beat?: number; after?: string; offset?: number }
export interface CueBinding { layerId: string; cueId: string; target: 'start' | 'enterEnd' | 'exitStart' | 'keyframe'; keyIndex?: number; offset?: number; applied?: string | number }
export interface MotionTiming {
  version: 1;
  tempo?: { bpm: number | null; offset: number; beatsPerBar: number };
  snap?: boolean;
  cues: MotionCue[];
  bindings: CueBinding[];
}
const idOk = (id: unknown): id is string => typeof id === 'string' && /^[\w-]{1,80}$/.test(id);
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
export function parseMotionTiming(raw: unknown): MotionTiming {
  if (raw === '' || raw == null) return { version: 1, cues: [], bindings: [] };
  if (typeof raw === 'string' && raw.length > 131072) throw new Error('Cue description exceeds 128 KiB.');
  const v: MotionTiming = typeof raw === 'string' ? JSON.parse(raw) : structuredClone(raw);
  if (v?.version !== 1 || !Array.isArray(v.cues) || v.cues.length > 256 || !Array.isArray(v.bindings) || v.bindings.length > 1024) throw new Error('Cue timing requires version 1, at most 256 cues and 1024 bindings.');
  if (v.tempo && (!(v.tempo.bpm === null || (finite(v.tempo.bpm) && v.tempo.bpm >= 1 && v.tempo.bpm <= 400)) || !finite(v.tempo.offset) || Math.abs(v.tempo.offset) > 3600 || !Number.isInteger(v.tempo.beatsPerBar) || v.tempo.beatsPerBar < 1 || v.tempo.beatsPerBar > 32)) throw new Error('Tempo needs BPM 1-400 or null, a finite offset, and 1-32 beats per bar.');
  const ids = new Set<string>(), targets = new Set<string>();
  for (const cue of v.cues) {
    if (!idOk(cue?.id) || ids.has(cue.id) || [cue.at, cue.beat, cue.after].filter(x => x !== undefined).length !== 1
      || (cue.at !== undefined && !finite(cue.at)) || (cue.beat !== undefined && !finite(cue.beat))
      || (cue.after !== undefined && !idOk(cue.after)) || (cue.offset !== undefined && !finite(cue.offset))) throw new Error('Cues need unique ids and exactly one of at, beat or after.');
    ids.add(cue.id);
  }
  for (const b of v.bindings) {
    const key = `${b?.layerId}:${b?.target}:${b?.keyIndex ?? ''}`;
    if (!b || !idOk(b.layerId) || !ids.has(b.cueId) || !['start', 'enterEnd', 'exitStart', 'keyframe'].includes(b.target)
      || targets.has(key) || (b.offset !== undefined && !finite(b.offset))
      || (b.target === 'keyframe' && (!Number.isInteger(b.keyIndex) || b.keyIndex! < 0))) throw new Error('Invalid or duplicate cue binding.');
    targets.add(key);
  }
  resolveCues(v);
  return v;
}
export function resolveCues(timing: MotionTiming): Record<string, number> {
  const cues = new Map(timing.cues.map(cue => [cue.id, cue]));
  const times: Record<string, number> = Object.create(null), pending = new Set<string>();
  const visit = (id: string): number => {
    if (Object.hasOwn(times, id)) return times[id]!;
    const cue = cues.get(id);
    if (!cue || pending.has(id)) throw new Error(`Missing or cyclic cue: ${id}`);
    pending.add(id);
    let at: number;
    if (cue.at !== undefined) at = cue.at;
    else if (cue.after !== undefined) at = visit(cue.after);
    else {
      if (!timing.tempo?.bpm) throw new Error(`Cue ${id} needs a known BPM; no rhythm is inferred.`);
      at = timing.tempo.offset + cue.beat! * 60 / timing.tempo.bpm;
    }
    at += cue.offset ?? 0;
    if (!finite(at) || at < 0 || at > 3600) throw new Error(`Cue ${id} is outside the one-hour timeline.`);
    pending.delete(id); times[id] = at; return at;
  };
  for (const id of cues.keys()) visit(id);
  return times;
}
const fieldOf = (target: CueBinding['target']): string => ({ start: 'start', enterEnd: 'enterMs', exitStart: 'exitMs', keyframe: 'kf' })[target];

export function compileMotionCues<T extends Record<string, unknown>>(source: readonly T[], raw: unknown): {
  boxes: (T & Record<string, unknown>)[]; timing: MotionTiming; times: Record<string, number>;
  changes: { layerId: string; field: string; before: unknown; after: unknown }[]; detached: CueBinding[];
} {
  const timing = parseMotionTiming(raw), times = resolveCues(timing);
  const boxes: Record<string, unknown>[] = source.map(box => ({ ...box })), byId = new Map(boxes.map(box => [String(box.id), box]));
  if (byId.size !== boxes.length) throw new Error('Cue compilation needs unique layer ids.');
  const detached: CueBinding[] = [], changes: { layerId: string; field: string; before: unknown; after: unknown }[] = [];
  const bindings = timing.bindings.filter(binding => {
    const box = byId.get(binding.layerId);
    if (!box) throw new Error(`Cue binding names missing layer ${binding.layerId}.`);
    const manual = binding.applied !== undefined && box[fieldOf(binding.target)] !== binding.applied;
    if (manual) detached.push(binding);
    return !manual;
  });
  const tracks = new Map<string, { t: number; ease: string; v: ReturnType<typeof parseKf>[number]['v'] }[]>();
  for (const binding of [...bindings].sort((a, b) => Number(b.target === 'start') - Number(a.target === 'start'))) {
    const box = byId.get(binding.layerId)!, field = fieldOf(binding.target), before = box[field];
    const absolute = times[binding.cueId]! + (binding.offset ?? 0), start = Number(box.start) || 0;
    let value: string | number;
    if (binding.target === 'start') value = absolute;
    else if (binding.target === 'keyframe') {
      let track = tracks.get(binding.layerId);
      if (!track) { track = parseKf(box.kf).map(key => ({ ...key })); tracks.set(binding.layerId, track); }
      const key = track[binding.keyIndex!];
      if (!key) throw new Error(`Missing keyframe on ${binding.layerId}.`);
      key.t = (absolute - start) * 1000;
      continue;
    } else value = (binding.target === 'enterEnd' ? absolute - start : start + Number(box.dur) - absolute) * 1000;
    if (typeof value === 'number' && (!finite(value) || value < 0 || value > (field === 'start' ? 3600 : 3_600_000))) throw new Error(`Cue creates invalid ${field} on ${binding.layerId}.`);
    box[field] = value;
    if (before !== value) changes.push({ layerId: binding.layerId, field, before, after: value });
  }
  for (const [layerId, track] of tracks) {
    if (track.some((key, i) => !finite(key.t) || key.t < 0 || (i > 0 && key.t <= track[i - 1]!.t))) throw new Error(`Cue reorders keyframes on ${layerId}.`);
    const box = byId.get(layerId)!, before = box.kf, after = serialiseKf(track);
    box.kf = after;
    if (before !== after) changes.push({ layerId, field: 'kf', before, after });
  }
  // Every binding to one keyframe track remembers the final combined track.
  timing.bindings = bindings.map(binding => ({ ...binding, applied: byId.get(binding.layerId)![fieldOf(binding.target)] as string | number }));
  return { boxes: boxes as T[], timing, times, changes, detached };
}
