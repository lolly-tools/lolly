// SPDX-License-Identifier: MPL-2.0
/** CMX 3600 edit decision list reader, written from the public format description. */
import type { InterchangeClip, InterchangeRate, InterchangeSequence } from './premiere-xml.ts';
import {
  LossReport, TIMELINE_MAX_CLIPS, TIMELINE_MAX_TRACKS, buildSequence, checkText, cleanName, cleanPath, framesPerHour, rateLabel, timecodeToFrames,
} from './timeline-common.ts';

export interface EdlOptions {
  /** An EDL carries no frame rate, so the caller supplies one. Drop-frame lists default to 29.97, others to 24. */
  rate?: InterchangeRate;
  width?: number;
  height?: number;
}
const TC = /^\d{1,3}:\d{2}:\d{2}[:;.,]\d{2,3}$/;
const MAX_LINES = 200_000, MAX_LINE = 2048;

interface EdlEvent {
  number: string; reel: string; track: string; edit: string; transition: number; drop: boolean; line: number;
  srcIn: number; srcOut: number; recIn: number; recOut: number;
  from?: string; file?: string; audio: number[]; speed?: string;
}
/** Read an event's track field into video and numbered audio channels. */
function trackKinds(spec: string): { video: boolean; audio: number[] } | null {
  let video = false; const audio: number[] = [];
  for (const part of spec.toUpperCase().split('/')) {
    if (part === 'V' || part === 'B') video = true;
    else if (part === 'A') audio.push(1);
    else if (part === 'AA') audio.push(1, 2);
    else if (/^A\d{1,3}$/.test(part)) audio.push(Number(part.slice(1)));
    else if (part !== 'NONE' && part !== '') return null;
  }
  return { video, audio };
}

export function readEdl(source: string, options: EdlOptions = {}): InterchangeSequence {
  checkText(source, 'The EDL');
  const lines = source.replace(/^﻿/, '').split(/\r\n|\r|\n/);
  if (lines.length > MAX_LINES) throw new Error('The EDL has too many lines.');
  const report = new LossReport(), events: EdlEvent[] = [];
  let title = '', drop = false, unknown = 0, firstUnknown = 0;
  const fcmDrops = new Set<boolean>();
  // Frame rate must be known before timecode is counted, so events keep their text until the rate is chosen.
  interface Raw { number: string; reel: string; track: string; edit: string; transition: number; tcs: string[]; drop: boolean; line: number; meta: Partial<EdlEvent> & { audio: number[] } }
  const raws: Raw[] = [];
  for (const [index, rawLine] of lines.entries()) {
    const text = rawLine.length > MAX_LINE ? rawLine.slice(0, MAX_LINE) : rawLine, line = text.trim(), n = index + 1;
    if (!line) continue;
    if (rawLine.length > MAX_LINE) report.add('long-line', `Line ${n} is longer than ${MAX_LINE} characters and was truncated.`);
    const titleMatch = /^TITLE:\s*(.*)$/i.exec(line), fcmMatch = /^FCM:\s*(.*)$/i.exec(line);
    if (titleMatch) { title = titleMatch[1]!; continue; }
    if (fcmMatch) {
      const mode = fcmMatch[1]!.toUpperCase();
      if (/^DROP/.test(mode)) drop = true; else if (/^NON/.test(mode)) drop = false; else report.add('fcm', `Line ${n}: unknown frame code mode "${fcmMatch[1]!.slice(0, 24)}".`);
      fcmDrops.add(drop); continue;
    }
    if (line.startsWith('*')) {
      const last = raws[raws.length - 1]; if (!last) continue;
      const body = line.replace(/^\*\s*/, '');
      const nameMatch = /^(?:FROM\s+)?CLIP\s+NAME:\s*(.*)$/i.exec(body), fileMatch = /^SOURCE\s+FILE:\s*(.*)$/i.exec(body);
      if (nameMatch) last.meta.from = nameMatch[1]!.trim();
      else if (fileMatch) last.meta.file = fileMatch[1]!.trim();
      else if (/^TO\s+CLIP\s+NAME:/i.test(body)) report.add('to-clip', 'Outgoing clip names of dissolves are not imported.');
      else if (/^LOC:/i.test(body)) report.add('locator', 'Locators and markers are not imported.');
      else if (/^(ASC_SOP|ASC_SAT)/i.test(body)) report.add('grade', 'Colour decisions (ASC CDL) are not applied.');
      else if (/^(COMMENT|EFFECT NAME|DISSOLVE|KEY)/i.test(body)) { if (/^EFFECT NAME/i.test(body)) report.add('effect', `Line ${n}: named effects are not imported (${body.slice(0, 48)}).`); }
      continue;
    }
    const audMatch = /^AUD\s+([\d\s]+)$/i.exec(line);
    if (audMatch) {
      const last = raws[raws.length - 1]; if (last) for (const c of audMatch[1]!.trim().split(/\s+/).map(Number)) if (c >= 1 && c <= TIMELINE_MAX_TRACKS) last.meta.audio.push(c); continue;
    }
    if (/^M2\s/i.test(line)) { const last = raws[raws.length - 1]; if (last) last.meta.speed = line; continue; }
    if (/^(SPLIT|EFFECTS NAME|FOR TV|\.{3})/i.test(line)) { report.add('split', `Line ${n}: split edits and effect directives are not imported.`); continue; }
    const tokens = line.split(/\s+/);
    if (/^\d{1,6}$/.test(tokens[0]!) && tokens.length >= 8 && tokens.slice(-4).every(t => TC.test(t))) {
      if (raws.length >= TIMELINE_MAX_CLIPS) throw new Error(`The EDL exceeds ${TIMELINE_MAX_CLIPS} events.`);
      const middle = tokens.slice(4, -4), transition = Number(middle.find(t => /^\d{1,5}$/.test(t)) ?? 0);
      raws.push({ number: tokens[0]!, reel: tokens[1]!, track: tokens[2]!, edit: tokens[3]!.toUpperCase(), transition, tcs: tokens.slice(-4), drop, line: n, meta: { audio: [] } });
      continue;
    }
    if (!unknown++) firstUnknown = n;
  }
  if (!raws.length) throw new Error('The EDL has no edit events.');
  if (unknown) report.add('unknown', `${unknown} unrecognised lines were skipped, the first at line ${firstUnknown}.`);
  if (fcmDrops.size > 1) report.add('mixed-fcm', 'The list mixes drop-frame and non-drop-frame sections; each event is counted in its own mode.');

  const anyDrop = raws.some(r => r.drop);
  const rate = options.rate ?? (anyDrop ? { numerator: 30000, denominator: 1001 } : { numerator: 24, denominator: 1 });
  if (!options.rate) report.add('rate', `An EDL carries no frame rate; ${rateLabel(rate)} was assumed. Choose the real rate if it differs.`);
  const hour = (d: boolean) => framesPerHour(rate, d);

  for (const r of raws) {
    try {
      const [a, b, c, d] = r.tcs.map(t => timecodeToFrames(t, rate, r.drop)) as [number, number, number, number];
      events.push({ number: r.number, reel: r.reel, track: r.track, edit: r.edit, transition: r.transition, drop: r.drop, line: r.line, srcIn: a, srcOut: b, recIn: c, recOut: d, from: r.meta.from, file: r.meta.file, audio: r.meta.audio, speed: r.meta.speed });
    } catch (error) { throw new Error(`Line ${r.line}: ${(error as Error).message}`); }
  }
  const minRec = Math.min(...events.map(e => e.recIn)), hourFrames = hour(anyDrop);
  const timecodeStart = Math.floor(minRec / hourFrames) * hourFrames;
  const reelStart = new Map<string, number>();
  for (const e of events) {
    const base = Math.floor(e.srcIn / hour(e.drop)) * hour(e.drop);
    reelStart.set(e.reel, Math.min(reelStart.get(e.reel) ?? base, base));
  }
  if ([...reelStart.values()].some(v => v > 0)) report.add('source-tc', 'Source timecode is treated as starting on the hour of each reel. Relink the media and check the In points.');

  const clips: InterchangeClip[] = [], width = options.width ?? 1920, height = options.height ?? 1080;
  for (const e of events) {
    if (e.edit !== 'C') report.add(`edit-${e.edit[0]}`, `Event ${e.number}: ${e.edit[0] === 'D' ? 'dissolve' : e.edit[0] === 'W' ? 'wipe' : e.edit[0] === 'K' ? 'key' : 'edit type ' + e.edit} transitions are unsupported; the incoming clip is placed as a cut.`);
    if (/^(BL|BLACK)$/i.test(e.reel)) { report.add('black', `Event ${e.number}: black (reel ${e.reel}) is left as a gap.`); continue; }
    const kinds = trackKinds(e.track);
    if (!kinds) { report.add('track', `Event ${e.number}: track "${e.track.slice(0, 12)}" is not recognised and the event was skipped.`); continue; }
    if (!kinds.video && !kinds.audio.length && !e.audio.length) { report.add('none', `Event ${e.number}: an event with no track was skipped.`); continue; }
    if (e.recOut <= e.recIn || e.srcOut <= e.srcIn) { report.add('zero', `Event ${e.number}: a zero-length event was skipped (usually the outgoing half of a transition).`); continue; }
    if (e.speed) report.add('speed', `Event ${e.number}: speed changes (${e.speed.slice(0, 48)}) are unsupported; the clip plays at normal speed.`);
    else if (e.srcOut - e.srcIn !== e.recOut - e.recIn) report.add('speed-implied', `Event ${e.number}: source and record lengths differ, so the clip was retimed. Speed changes are unsupported.`);
    const name = cleanName(e.from ?? '', e.reel), path = e.file ? cleanPath(e.file) : '';
    const start = e.recIn - timecodeStart, end = e.recOut - timecodeStart, base = reelStart.get(e.reel) ?? 0;
    const channels = [...new Set(e.audio.length ? e.audio : kinds.audio)];
    const make = (kind: 'video' | 'audio', track: number): InterchangeClip => ({ id: `edl-${e.number}-${kind[0]}${track}-${clips.length}`, name, kind, track, start, end, in: e.srcIn, out: e.srcOut, path, sourceRate: rate, width, height, sourceStart: base });
    if (kinds.video) clips.push(make('video', 0));
    for (const c of channels) { if (c > TIMELINE_MAX_TRACKS) continue; clips.push(make('audio', c - 1)); }
    if (clips.length > TIMELINE_MAX_CLIPS) throw new Error(`The EDL exceeds ${TIMELINE_MAX_CLIPS} clips.`);
  }
  report.add('size', `An EDL carries no frame size; ${width}x${height} was assumed.`);
  return buildSequence({ name: title, rate, width, height, clips, report, timecodeStart, dropFrame: anyDrop });
}
