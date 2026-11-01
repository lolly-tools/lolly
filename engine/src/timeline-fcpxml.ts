// SPDX-License-Identifier: MPL-2.0
/** Final Cut Pro X Markup Language (FCPXML 1.8 to 1.11) reader, written from the public format description. */
import { adobeChild, adobeChildren, readAdobeXml, type AdobeXmlParser } from './adobe-xml.ts';
import type { InterchangeClip, InterchangeRate, InterchangeSequence } from './premiere-xml.ts';
import {
  LossReport, TIMELINE_MAX_CLIPS, TIMELINE_MAX_TRACKS, buildSequence, cleanName, cleanPath, gcd, rateFps, rateFromRatio, rateLabel, sameRate,
} from './timeline-common.ts';

const MAX_DEPTH = 16;
/** FCPXML times are rational seconds such as "1001/30000s" or "5s". */
export function parseRationalSeconds(text: string | null | undefined): number | undefined {
  if (!text) return undefined;
  const m = /^(-?\d{1,15})(?:\/(\d{1,15}))?s$/.exec(text.trim());
  if (!m) return undefined;
  const den = m[2] === undefined ? 1 : Number(m[2]);
  if (den === 0) return undefined;
  return Number(m[1]) / den;
}
function frameDurationRate(text: string | null): InterchangeRate | undefined {
  const m = text && /^(\d{1,15})(?:\/(\d{1,15}))?s$/.exec(text.trim());
  if (!m) return undefined;
  const num = Number(m[1]), den = m[2] === undefined ? 1 : Number(m[2]);
  if (!num || !den) return undefined;
  const g = gcd(den, num);
  try { return rateFromRatio(den / g, num / g); } catch { return undefined; }
}
interface Format { rate: InterchangeRate; width: number; height: number }
interface Asset { rate: InterchangeRate; start: number; path: string; video: boolean; audio: boolean; name: string }

export function readFcpxml(source: string, parse: AdobeXmlParser): InterchangeSequence {
  const doc = readAdobeXml(source.replace(/<!DOCTYPE\s+fcpxml\s*>/i, ''), parse, 8 * 1024 * 1024);
  const root = doc.documentElement;
  if (root.localName !== 'fcpxml') throw new Error('This is not an FCPXML file.');
  const version = root.getAttribute('version') ?? '';
  const [major, minor] = version.split('.').map(Number);
  if (!/^\d+\.\d+$/.test(version) || major !== 1 || (minor ?? 0) < 8 || (minor ?? 0) > 11) throw new Error(`FCPXML version ${version.slice(0, 12) || '(none)'} is unsupported; export version 1.8 to 1.11.`);
  const report = new LossReport();
  const resources = adobeChild(root, 'resources');
  const formats = new Map<string, Format>(), assets = new Map<string, Asset>(), compounds = new Set<string>();
  for (const el of resources ? Array.from(resources.children) : []) {
    const id = el.getAttribute('id') ?? '';
    if (el.localName === 'format') {
      const rate = frameDurationRate(el.getAttribute('frameDuration'));
      if (rate) formats.set(id, { rate, width: Math.max(1, Math.min(16384, Number(el.getAttribute('width')) || 1920)), height: Math.max(1, Math.min(16384, Number(el.getAttribute('height')) || 1080)) });
    } else if (el.localName === 'asset') {
      const rep = adobeChildren(el, 'media-rep').find(r => (r.getAttribute('kind') ?? 'original-media') === 'original-media') ?? adobeChild(el, 'media-rep');
      const src = rep?.getAttribute('src') ?? el.getAttribute('src') ?? '';
      const fmt = formats.get(el.getAttribute('format') ?? '');
      assets.set(id, {
        rate: fmt?.rate ?? { numerator: 24, denominator: 1 }, start: parseRationalSeconds(el.getAttribute('start')) ?? 0, path: cleanPath(src),
        video: el.getAttribute('hasVideo') !== '0' && (el.getAttribute('hasVideo') === '1' || !!el.getAttribute('format')), audio: el.getAttribute('hasAudio') === '1', name: el.getAttribute('name') ?? '',
      });
    } else if (el.localName === 'media' || el.localName === 'effect') compounds.add(id);
  }
  const sequences = Array.from(doc.getElementsByTagName('sequence')).filter(e => e.parentElement?.localName !== 'media');
  if (!sequences.length) throw new Error('The FCPXML file has no sequence to import.');
  if (sequences.length > 1) report.add('multi', `The file holds ${sequences.length} projects; only the first sequence was imported.`);
  const sequence = sequences[0]!, spine = adobeChild(sequence, 'spine');
  if (!spine) throw new Error('The FCPXML sequence has no spine.');
  const format = formats.get(sequence.getAttribute('format') ?? '') ?? { rate: { numerator: 24, denominator: 1 }, width: 1920, height: 1080 };
  if (!formats.has(sequence.getAttribute('format') ?? '')) report.add('rate', 'The sequence names no frame format; 24 fps was assumed.');
  const rate = format.rate, fps = rateFps(rate), drop = sequence.getAttribute('tcFormat') === 'DF';
  const tcStart = parseRationalSeconds(sequence.getAttribute('tcStart')) ?? 0;
  const frames = (s: number): number => Math.round(s * fps + 1e-9);
  const clips: InterchangeClip[] = [];
  let nextId = 0, minOffset = Infinity;
  const raw: { clip: Omit<InterchangeClip, 'start' | 'end'> & { startS: number; endS: number } }[] = [];

  function emit(name: string, kind: 'video' | 'audio', track: number, startS: number, durS: number, assetRef: Asset | undefined, inS: number): void {
    if (raw.length >= TIMELINE_MAX_CLIPS) throw new Error(`The timeline exceeds ${TIMELINE_MAX_CLIPS} clips.`);
    if (!(durS > 0)) { report.add('zero', 'A clip with no duration was skipped.'); return; }
    const sourceRate = assetRef?.rate ?? rate;
    if (!sameRate(sourceRate, rate)) report.add('mixed-rate', `Media at ${rateLabel(sourceRate)} sits on a ${rateLabel(rate)} timeline; positions were rounded to timeline frames.`);
    const inF = Math.round(inS * rateFps(sourceRate) + 1e-9), outF = Math.max(inF + 1, Math.round((inS + durS) * rateFps(sourceRate) + 1e-9));
    minOffset = Math.min(minOffset, startS);
    raw.push({ clip: { id: `fcpxml-${nextId++}`, name, kind, track, startS, endS: startS + durS, in: inF, out: outF, path: assetRef?.path ?? '', sourceRate, width: format.width, height: format.height, sourceStart: Math.round((assetRef?.start ?? 0) * rateFps(sourceRate) + 1e-9) } });
  }
  const unsupported = (el: Element): boolean => {
    switch (el.localName) {
      case 'transition': report.add('transition', 'Transitions are unsupported; the clips are placed as cuts.'); return true;
      case 'title': report.add('title', 'Titles are unsupported and were skipped.'); return true;
      case 'generator': report.add('generator', 'Generators are unsupported and were skipped.'); return true;
      case 'ref-clip': report.add('compound', 'Compound clips are unsupported and were skipped.'); return true;
      case 'mc-clip': case 'sync-clip': report.add('compound', 'Multicam and synchronized clips are unsupported and were skipped.'); return true;
      case 'audition': report.add('audition', 'Auditions are unsupported; only the active clip would apply and it was skipped.'); return true;
      default: return false;
    }
  };
  /** Place one storyline item. `base` is its timeline position in seconds. */
  function place(el: Element, base: number, lane: number, depth: number): void {
    if (depth > MAX_DEPTH) throw new Error('The FCPXML storyline nests too deeply.');
    if (unsupported(el)) return;
    const dur = parseRationalSeconds(el.getAttribute('duration')) ?? 0, start = parseRationalSeconds(el.getAttribute('start')) ?? 0;
    const name = cleanName(el.getAttribute('name') ?? '', 'Clip');
    if (!['asset-clip', 'clip', 'video', 'audio'].includes(el.localName)) { report.add('unknown', `Items of type ${el.localName.slice(0, 24)} are unsupported and were skipped.`); return; }
    if (adobeChildren(el, 'timeMap').length) report.add('speed', 'Speed changes (retiming) are unsupported; clips play at normal speed.');
    for (const c of Array.from(el.children)) {
      if (c.localName === 'filter-video' || c.localName === 'filter-audio' || c.localName === 'filter-video-mask') report.add('effect', 'Effects are unsupported and were not applied.');
      else if (/^adjust-(transform|crop|conform|blend|corners|stabilization)/.test(c.localName)) report.add('adjust', 'Transform, crop and blend adjustments are not applied.');
    }
    if (adobeChildren(el, 'marker').length || adobeChildren(el, 'chapter-marker').length) report.add('markers', 'Markers are not imported.');
    if (el.getAttribute('enabled') === '0') report.add('disabled', 'Disabled clips are imported as enabled.');
    const videoTrack = Math.max(0, lane), audioTrack = lane < 0 ? -lane - 1 : 0;
    if (videoTrack >= TIMELINE_MAX_TRACKS || audioTrack >= TIMELINE_MAX_TRACKS) throw new Error(`The timeline exceeds ${TIMELINE_MAX_TRACKS} tracks.`);
    if (el.localName === 'clip') {
      const v = adobeChildren(el, 'video').find(c => c.getAttribute('ref')), a = adobeChildren(el, 'audio').find(c => c.getAttribute('ref'));
      if (adobeChildren(el, 'spine').length) { report.add('compound', 'Compound clips are unsupported and were skipped.'); return; }
      const asset = assets.get(v?.getAttribute('ref') ?? a?.getAttribute('ref') ?? '');
      if (!asset) { report.add('no-media', `Clip "${name}" has no media reference and was skipped.`); return; }
      if (v && lane >= 0) emit(name, 'video', videoTrack, base, dur, asset, start);
      if (a || asset.audio) emit(name, 'audio', audioTrack, base, dur, asset, start);
    } else {
      const ref = el.getAttribute('ref') ?? '', asset = assets.get(ref);
      if (!asset) { report.add(compounds.has(ref) ? 'compound' : 'no-media', compounds.has(ref) ? 'Compound clips are unsupported and were skipped.' : `Clip "${name}" has no media reference and was skipped.`); return; }
      const wantsVideo = el.localName !== 'audio' && asset.video, wantsAudio = el.localName === 'audio' || (el.localName === 'asset-clip' && asset.audio);
      if (wantsVideo && lane >= 0) emit(name, 'video', videoTrack, base, dur, asset, start);
      if (wantsAudio) emit(name, 'audio', audioTrack, base, dur, asset, start);
      if (!wantsVideo && !wantsAudio) report.add('no-media', `Clip "${name}" carries no picture or sound Lolly can place.`);
    }
    connected(el, base, depth, start);
  }
  /** Connected clips hang off a parent and take their offset in the parent's own time, so subtract the parent's start. */
  function connected(parent: Element, base: number, depth: number, parentStart = 0): void {
    for (const child of Array.from(parent.children)) {
      if (!['asset-clip', 'clip', 'video', 'audio', 'title', 'generator', 'ref-clip', 'mc-clip', 'sync-clip', 'audition', 'transition'].includes(child.localName)) continue;
      if (child.getAttribute('lane') === null && parent.localName !== 'gap') continue;
      const offset = parseRationalSeconds(child.getAttribute('offset')) ?? 0, lane = Number(child.getAttribute('lane')) || 0;
      place(child, base + offset - parentStart, lane, depth + 1);
    }
  }
  for (const item of Array.from(spine.children)) {
    if (item.localName === 'gap') { connected(item, parseRationalSeconds(item.getAttribute('offset')) ?? 0, 0, parseRationalSeconds(item.getAttribute('start')) ?? 0); continue; }
    place(item, parseRationalSeconds(item.getAttribute('offset')) ?? 0, 0, 0);
  }
  if (!raw.length) throw new Error('The timeline has no clips Lolly can place.');
  const origin = minOffset >= tcStart ? tcStart : 0;
  for (const { clip: c } of raw) {
    const start = frames(c.startS - origin), end = Math.max(start + 1, frames(c.endS - origin));
    const { startS: _s, endS: _e, ...rest } = c; void _s; void _e;
    clips.push({ ...rest, start, end });
  }
  const seqName = cleanName(sequence.parentElement?.getAttribute('name') ?? '', 'Imported timeline');
  return buildSequence({ name: seqName, rate, width: format.width, height: format.height, clips, report, timecodeStart: Math.round(origin * fps), dropFrame: drop });
}
