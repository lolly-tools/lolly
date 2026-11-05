// SPDX-License-Identifier: MPL-2.0
/** OpenTimelineIO JSON reader, written from the public OTIO schema description. */
import type { InterchangeClip, InterchangeRate, InterchangeSequence } from './premiere-xml.ts';
import {
  LossReport, TIMELINE_MAX_CLIPS, TIMELINE_MAX_TRACKS, buildSequence, checkText, cleanName, cleanPath, rateFromFps, rateFps, rateLabel, sameRate,
} from './timeline-common.ts';

type Json = Record<string, unknown>;
const MAX_DEPTH = 24, MAX_NODES = 400_000;
const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const schema = (v: unknown): string => isObject(v) && typeof v.OTIO_SCHEMA === 'string' ? v.OTIO_SCHEMA.split('.')[0]! : '';
const num = (v: unknown): number | undefined => typeof v === 'number' && Number.isFinite(v) ? v : undefined;

interface Time { value: number; rate: number }
function readTime(v: unknown): Time | undefined {
  if (!isObject(v)) return undefined;
  const value = num(v.value), rate = num(v.rate);
  return value === undefined || rate === undefined || rate <= 0 ? undefined : { value, rate };
}
interface Range { start: Time; duration: Time }
function readRange(v: unknown): Range | undefined {
  if (!isObject(v)) return undefined;
  const start = readTime(v.start_time), duration = readTime(v.duration);
  return start && duration && duration.value >= 0 ? { start, duration } : undefined;
}
const seconds = (t: Time): number => t.value / t.rate;

/** Count nodes and depth before the walk, so a hostile file stops early. */
function admit(root: unknown): void {
  const stack: { v: unknown; depth: number }[] = [{ v: root, depth: 0 }]; let count = 0;
  while (stack.length) {
    const { v, depth } = stack.pop()!;
    if (typeof v !== 'object' || v === null) continue;
    if (++count > MAX_NODES || depth > 64) throw new Error('The OpenTimelineIO file exceeds the structure limits.');
    for (const child of Array.isArray(v) ? v : Object.values(v)) stack.push({ v: child, depth: depth + 1 });
  }
}

/** Length of an item in seconds. Compositions with no range of their own add up (track) or take the longest child (stack). */
function itemSeconds(item: unknown, depth = 0): number {
  if (!isObject(item) || depth > MAX_DEPTH) return 0;
  const range = readRange(item.source_range); if (range) return seconds(range.duration);
  const kind = schema(item);
  if (kind === 'Clip') {
    const media = activeMedia(item), avail = media && readRange(media.available_range); return avail ? seconds(avail.duration) : 0;
  }
  const children = Array.isArray(item.children) ? item.children : [];
  if (kind === 'Stack') return Math.max(0, ...children.map(c => itemSeconds(c, depth + 1)));
  if (kind === 'Track') return children.reduce((sum: number, c) => schema(c) === 'Transition' ? sum : sum + itemSeconds(c, depth + 1), 0);
  return 0;
}
function activeMedia(clip: Json): Json | undefined {
  const refs = clip.media_references;
  if (isObject(refs)) {
    const key = typeof clip.active_media_reference_key === 'string' ? clip.active_media_reference_key : 'DEFAULT_MEDIA';
    const chosen = refs[key]; if (isObject(chosen)) return chosen;
  }
  return isObject(clip.media_reference) ? clip.media_reference : undefined;
}

export function readOtio(source: string, options: { width?: number; height?: number } = {}): InterchangeSequence {
  checkText(source, 'The OpenTimelineIO file', 16 * 1024 * 1024);
  let root: unknown;
  try { root = JSON.parse(source); } catch { throw new Error('The OpenTimelineIO file is not valid JSON.'); }
  admit(root);
  const kind = schema(root);
  let timeline: Json, name = '';
  if (kind === 'Timeline' && isObject(root)) { timeline = root; name = typeof root.name === 'string' ? root.name : ''; }
  else if (kind === 'Stack' && isObject(root)) timeline = { tracks: root, name: typeof root.name === 'string' ? root.name : '' };
  else throw new Error('This is not an OpenTimelineIO timeline.');
  name = typeof timeline.name === 'string' ? timeline.name : name;
  const stack = timeline.tracks;
  if (!isObject(stack) || schema(stack) !== 'Stack' || !Array.isArray(stack.children)) throw new Error('The OpenTimelineIO timeline has no tracks.');
  const report = new LossReport(), trackNodes = stack.children as unknown[];
  if (trackNodes.length > TIMELINE_MAX_TRACKS) throw new Error(`The timeline exceeds ${TIMELINE_MAX_TRACKS} tracks.`);

  // Sequence rate: the first rate seen on a video clip's range, else on any clip, else 24.
  const rates: number[] = [];
  const gather = (node: unknown, depth: number): void => {
    if (!isObject(node) || depth > MAX_DEPTH) return;
    if (schema(node) === 'Clip') {
      const r = readRange(node.source_range) ?? (activeMedia(node) && readRange(activeMedia(node)!.available_range)); if (r) rates.push(r.duration.rate);
    }
    if (Array.isArray(node.children)) for (const c of node.children) gather(c, depth + 1);
  };
  const videoFirst = [...trackNodes].sort((a, b) => Number(isObject(b) && b.kind === 'Video') - Number(isObject(a) && a.kind === 'Video'));
  for (const t of videoFirst) { gather(t, 0); if (rates.length) break; }
  const start0 = readTime(timeline.global_start_time);
  let rate: InterchangeRate;
  const usable = [...rates, ...(start0 ? [start0.rate] : [])].find(r => { try { rateFromFps(r); return true; } catch { return false; } });
  rate = rateFromFps(usable ?? 24);
  if (usable === undefined) report.add('rate', 'The timeline has no usable frame rate; 24 fps was assumed.');
  const fps = rateFps(rate), clips: InterchangeClip[] = [], counters = { video: 0, audio: 0 };
  const width = options.width ?? 1920, height = options.height ?? 1080;
  let timecodeStart = 0;
  if (start0) { try { timecodeStart = Math.max(0, Math.round(seconds(start0) * fps)); } catch { timecodeStart = 0; } }
  let nextId = 0;
  const frames = (s: number): number => Math.round(s * fps + 1e-9);

  function layTrack(track: Json, trackKind: 'video' | 'audio', index: number, originSeconds: number): void {
    const children = Array.isArray(track.children) ? track.children as unknown[] : [];
    let cursor = originSeconds;
    for (const child of children) {
      const type = schema(child);
      if (!isObject(child)) continue;
      if (type === 'Transition') { report.add('transition', `Transitions (${typeof child.transition_type === 'string' ? child.transition_type.slice(0, 32) : 'dissolve'}) are unsupported; the clips are placed as cuts.`); continue; }
      const length = itemSeconds(child);
      if (type === 'Gap') { cursor += length; continue; }
      if (type === 'Track' || type === 'Stack') {
        report.add('nested', 'Nested compositions (compound clips, nested tracks or stacks) are unsupported; their space is left empty.');
        cursor += length; continue;
      }
      if (type !== 'Clip') { report.add('unknown-item', `Items of type ${type || 'unknown'} are unsupported and were skipped.`); cursor += length; continue; }
      if (child.enabled === false) report.add('disabled', 'Disabled clips are imported as enabled.');
      const effects = Array.isArray(child.effects) ? child.effects as unknown[] : [];
      for (const fx of effects) {
        const t = schema(fx);
        if (t === 'LinearTimeWarp' || t === 'FreezeFrame' || t === 'TimeEffect') report.add('speed', `Speed changes (${t}) are unsupported; the clip plays at normal speed.`);
        else report.add('effect', 'Effects are unsupported and were not applied.');
      }
      if (Array.isArray(child.markers) && child.markers.length) report.add('markers', 'Markers are not imported.');
      const media = activeMedia(child), avail = media && readRange(media.available_range), range = readRange(child.source_range) ?? avail;
      if (!range) { report.add('no-range', 'A clip has no usable time range and was skipped.'); continue; }
      const mType = schema(media);
      let path = '';
      if (mType === 'ExternalReference' && media && typeof media.target_url === 'string') path = cleanPath(media.target_url);
      else if (mType === 'ImageSequenceReference') report.add('sequence', 'Image sequence references are unsupported; the clip is a placeholder.');
      else if (mType === 'GeneratorReference') report.add('generator', 'Generators are unsupported; the clip is a placeholder.');
      let sourceRate: InterchangeRate, scale: number;
      try { sourceRate = rateFromFps(range.start.rate); scale = 1; } catch {
        sourceRate = rate; scale = fps / range.start.rate;
        report.add('sample-rate', 'Times counted in audio samples or unusual rates were converted to timeline frames.');
      }
      const durationSeconds = seconds(range.duration);
      if (!sameRate(sourceRate, rate)) report.add('mixed-rate', `Clips at ${rateLabel(sourceRate)} sit on a ${rateLabel(rate)} timeline; their positions were rounded to timeline frames.`);
      const start = frames(cursor), end = Math.max(start + 1, frames(cursor + durationSeconds));
      const inFrames = Math.round(range.start.value * scale), outFrames = Math.max(inFrames + 1, Math.round((range.start.value + range.duration.value) * scale));
      const mediaStart = avail ? Math.round(avail.start.value * (scale === 1 ? rateFps(sourceRate) / avail.start.rate : fps / avail.start.rate)) : 0;
      const label = cleanName(typeof child.name === 'string' ? child.name : '', 'Clip');
      if (clips.length >= TIMELINE_MAX_CLIPS) throw new Error(`The timeline exceeds ${TIMELINE_MAX_CLIPS} clips.`);
      clips.push({ id: `otio-${nextId++}`, name: label, kind: trackKind, track: index, start, end, in: inFrames, out: outFrames, path, sourceRate, width, height, sourceStart: mediaStart });
      cursor += durationSeconds;
    }
  }
  for (const node of trackNodes) {
    if (!isObject(node) || schema(node) !== 'Track') { report.add('nested', 'Nested compositions (compound clips, nested tracks or stacks) are unsupported; their space is left empty.'); continue; }
    const k = String(node.kind ?? '').toLowerCase();
    if (k !== 'video' && k !== 'audio') { report.add('track-kind', `Tracks of kind "${k.slice(0, 16)}" are unsupported and were skipped.`); continue; }
    layTrack(node, k, counters[k]++, 0);
  }
  report.add('size', `OpenTimelineIO carries no frame size; ${width}x${height} was assumed.`);
  return buildSequence({ name, rate, width, height, clips, report, timecodeStart: timecodeStart || undefined });
}
