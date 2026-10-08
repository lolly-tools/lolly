// SPDX-License-Identifier: MPL-2.0
/** Supported Final Cut Pro 7 XML interchange, also accepted by Premiere. */
import { readAdobeXml, adobeChild, adobeChildren, adobeText, escapeAdobeXml as esc, type AdobeXmlParser } from './adobe-xml.ts';
import type { AssetRef } from './bridge/host-v1.ts';

export interface InterchangeRate { numerator: number; denominator: number }
export interface InterchangeClip { id: string; name: string; kind: 'video' | 'audio'; track: number; start: number; end: number; in: number; out: number; path: string; sourceRate: InterchangeRate; width: number; height: number }
export interface InterchangeSequence { name: string; rate: InterchangeRate; width: number; height: number; duration: number; clips: InterchangeClip[]; notes: string[] }
export const framesToSeconds = (frames: number, rate: InterchangeRate): number => frames * rate.denominator / rate.numerator;
export const secondsToFrames = (seconds: number, rate: InterchangeRate): number => Math.round(seconds * rate.numerator / rate.denominator);
/** Media lookup is explicit IO supplied by the caller, never a path read by the engine. */
export async function premiereSequenceValues(sequence: InterchangeSequence, resolveMedia: (path: string) => Promise<AssetRef | null> = async () => null): Promise<{ values: Record<string, unknown>; notes: string[] }> {
  const notes = [...sequence.notes], fps = sequence.rate.numerator / sequence.rate.denominator;
  const supported = [24, 25, 30, 50, 60], projectFps = supported.reduce((a, b) => Math.abs(a - fps) <= Math.abs(b - fps) ? a : b);
  if (fps !== projectFps) notes.push(`Source rate ${sequence.rate.numerator}/${sequence.rate.denominator} is mapped to Lolly's ${projectFps} fps project clock; clip positions retain source seconds.`);
  const boxes: Record<string, unknown>[] = [];
  const assets = new Map<string, AssetRef | null>();
  for (const [index, clip] of sequence.clips.entries()) {
    if (!assets.has(clip.path)) assets.set(clip.path, await resolveMedia(clip.path));
    const image = assets.get(clip.path), start = framesToSeconds(clip.start, sequence.rate), dur = framesToSeconds(clip.end - clip.start, sequence.rate), clipIn = framesToSeconds(clip.in, clip.sourceRate);
    const sourceDur = framesToSeconds(clip.out - clip.in, clip.sourceRate);
    if (Math.abs(sourceDur - dur) > 0.000001) notes.push(`${clip.name}: source duration differs from its timeline interval; speed remapping is unsupported.`);
    if (!image) notes.push(`${clip.name}: missing media ${clip.path || '(no path)'}. A labelled placeholder was added.`);
    notes.push(`${clip.name}: ${clip.kind} track ${clip.track + 1} is represented in Lolly layer order.`);
    boxes.push({ id: `xml-${index}`, name: clip.name, kind: image ? clip.kind === 'audio' ? 'audio' : 'image' : 'text', x: 0, y: 0, w: sequence.width, h: sequence.height, ...(image ? { image } : { text: `Missing media: ${clip.name}`, fg: '#ffffff', bg: '#444444', fontSize: 24 }), start, dur, clipIn, speed: 1, lane: clip.kind === 'video' && clip.track === 0 ? 'seq' : '', enter: 'none', exit: 'none', fit: 'contain', opacity: 100 });
  }
  return { values: { boxes, projectFps: String(projectFps) }, notes: [...new Set(notes)] };
}
function validRate(rate: InterchangeRate): void {
  if (!Number.isInteger(rate.numerator) || !Number.isInteger(rate.denominator) || rate.numerator <= 0 || rate.denominator <= 0 || ![1, 1001].includes(rate.denominator) || rate.numerator / rate.denominator > 120 || rate.numerator / rate.denominator < 1) throw new Error('Unsupported interchange frame rate.');
  if (rate.denominator === 1001 && ![24000, 30000, 60000].includes(rate.numerator)) throw new Error('Unsupported NTSC interchange rate.');
}
function integer(s: string, name: string, fallback?: number): number {
  if (!s && fallback !== undefined) return fallback;
  if (!/^\d+$/.test(s) || !Number.isSafeInteger(Number(s)) || Number(s) > 100_000_000) throw new Error(`Invalid interchange ${name}.`);
  return Number(s);
}
function readRate(el: Element | undefined, fallback?: InterchangeRate): InterchangeRate {
  if (!el) { if (fallback) return fallback; throw new Error('The sequence has no frame rate.'); }
  const timebase = integer(adobeText(el, 'timebase'), 'timebase'), ntsc = adobeText(el, 'ntsc').toUpperCase();
  if (ntsc && !['TRUE', 'FALSE'].includes(ntsc)) throw new Error('Invalid NTSC flag.');
  const rate = { numerator: timebase * (ntsc === 'TRUE' ? 1000 : 1), denominator: ntsc === 'TRUE' ? 1001 : 1 }; validRate(rate); return rate;
}
export function readPremiereXml(source: string, parse: AdobeXmlParser): InterchangeSequence {
  const doc = readAdobeXml(source.replace(/<!DOCTYPE\s+xmeml\s*>/i, ''), parse, 8 * 1024 * 1024);
  if (doc.documentElement.localName !== 'xmeml') throw new Error('Choose Final Cut Pro XML (xmeml), not a native Premiere project.');
  const sequences = Array.from(doc.getElementsByTagName('sequence'));
  if (sequences.length !== 1) throw new Error('Import one sequence at a time; nested sequences are unsupported.');
  const sequence = sequences[0]!, rate = readRate(adobeChild(sequence, 'rate')), media = adobeChild(sequence, 'media');
  if (!media) throw new Error('The interchange sequence has no media.');
  const format = adobeChild(adobeChild(media, 'video') ?? media, 'format'), sample = format && adobeChild(format, 'samplecharacteristics');
  const width = sample ? integer(adobeText(sample, 'width'), 'width', 1920) : 1920, height = sample ? integer(adobeText(sample, 'height'), 'height', 1080) : 1080;
  if (width < 1 || height < 1 || width * height > 32_000_000) throw new Error('Interchange dimensions exceed the preview limit.');
  const files = new Map<string, Element>();
  for (const el of Array.from(doc.getElementsByTagName('file'))) if (adobeChild(el, 'pathurl')) {
    const id = el.getAttribute('id'); if (id && files.has(id)) throw new Error(`Repeated interchange file id: ${id}`); if (id) files.set(id, el);
  }
  const clips: InterchangeClip[] = [], notes: string[] = [], ids = new Set<string>();
  for (const kind of ['video', 'audio'] as const) {
    const stream = adobeChild(media, kind); if (!stream) continue;
    const tracks = adobeChildren(stream, 'track'); if (tracks.length > 128) throw new Error('Interchange exceeds 128 tracks.');
    for (const [trackIndex, track] of tracks.entries()) {
      if (adobeChildren(track, 'transitionitem').length) notes.push(`${kind} track ${trackIndex + 1}: transitions are unsupported.`);
      for (const el of adobeChildren(track, 'clipitem')) {
        if (clips.length >= 10000) throw new Error('Interchange exceeds 10000 clips.');
        const id = el.getAttribute('id') || `${kind}-${trackIndex}-${clips.length}`; if (ids.has(id)) throw new Error(`Repeated clip id: ${id}`); ids.add(id);
        const fileRef = adobeChild(el, 'file'), file = fileRef && (adobeChild(fileRef, 'pathurl') ? fileRef : files.get(fileRef.getAttribute('id') || ''));
        const startText = adobeText(el, 'start'), endText = adobeText(el, 'end');
        if (startText === '-1' || endText === '-1') { notes.push(`${id}: transition-relative timing was omitted.`); continue; }
        const start = integer(startText, 'start'), end = integer(endText, 'end'), clipIn = integer(adobeText(el, 'in'), 'in'), clipOut = integer(adobeText(el, 'out'), 'out');
        if (end <= start || clipOut <= clipIn) throw new Error(`Invalid clip interval: ${id}`);
        const path = file ? adobeText(file, 'pathurl') : '';
        if (path.length > 8192 || [...path].some(c => c.charCodeAt(0) < 32)) throw new Error('Invalid interchange media path.');
        const sourceRate = readRate(file && adobeChild(file, 'rate'), rate);
        if (adobeChildren(el, 'filter').length) notes.push(`${id}: effects and time remapping are unsupported.`);
        if (!path) notes.push(`${id}: missing media reference.`);
        clips.push({ id, name: adobeText(el, 'name') || id, kind, track: trackIndex, start, end, in: clipIn, out: clipOut, path, sourceRate, width, height });
      }
    }
  }
  const duration = integer(adobeText(sequence, 'duration'), 'duration', Math.max(0, ...clips.map(c => c.end)));
  if (clips.some(c => c.end > duration)) throw new Error('A clip extends past the interchange sequence duration.');
  if (doc.getElementsByTagName('generatoritem').length) notes.push('Generators and titles are unsupported.');
  return { name: adobeText(sequence, 'name') || 'Imported sequence', rate, width, height, duration, clips, notes: [...new Set(notes)] };
}
function rateXml(rate: InterchangeRate): string {
  validRate(rate); return `<rate><timebase>${rate.denominator === 1001 ? rate.numerator / 1000 : rate.numerator}</timebase><ntsc>${rate.denominator === 1001 ? 'TRUE' : 'FALSE'}</ntsc></rate>`;
}
export function writePremiereXml(sequence: InterchangeSequence): string {
  validRate(sequence.rate);
  for (const [key, value] of Object.entries({ width: sequence.width, height: sequence.height, duration: sequence.duration })) integer(String(value), key);
  if (sequence.clips.some(clip => !['video', 'audio'].includes(clip.kind))) throw new Error('Unsupported interchange media kind.');
  if (sequence.clips.length > 10000 || sequence.width < 1 || sequence.height < 1 || sequence.width * sequence.height > 32_000_000) throw new Error('Interchange exceeds the structure limits.');
  const sample = `<samplecharacteristics>${rateXml(sequence.rate)}<width>${sequence.width}</width><height>${sequence.height}</height><anamorphic>FALSE</anamorphic><pixelaspectratio>square</pixelaspectratio><fielddominance>none</fielddominance></samplecharacteristics>`;
  const ids = new Set<string>();
  const streams = (['video', 'audio'] as const).map(kind => {
    const clips = sequence.clips.filter(c => c.kind === kind), count = clips.length ? Math.max(...clips.map(c => c.track)) + 1 : 0;
    if (count > 128 || count < 0) throw new Error('Interchange exceeds the track limit.');
    const tracks = Array.from({ length: count }, (_, track) => `<track>${clips.filter(c => c.track === track).map(c => {
      if (ids.has(c.id)) throw new Error(`Repeated clip id: ${c.id}`); ids.add(c.id);
      for (const [key, value] of Object.entries({ start: c.start, end: c.end, in: c.in, out: c.out, track: c.track, width: c.width, height: c.height })) integer(String(value), key);
      if (c.end <= c.start || c.out <= c.in || c.end > sequence.duration || !c.path || c.path.length > 8192) throw new Error(`Invalid clip interval or source: ${c.id}`);
      const sourceSample = `<samplecharacteristics>${rateXml(c.sourceRate)}<width>${c.width}</width><height>${c.height}</height><anamorphic>FALSE</anamorphic><pixelaspectratio>square</pixelaspectratio><fielddominance>none</fielddominance></samplecharacteristics>`;
      return `<clipitem id="${esc(c.id)}"><name>${esc(c.name)}</name><enabled>TRUE</enabled><duration>${c.out}</duration>${rateXml(sequence.rate)}<start>${c.start}</start><end>${c.end}</end><in>${c.in}</in><out>${c.out}</out><file id="file-${esc(c.id)}"><name>${esc(c.name)}</name><pathurl>${esc(c.path)}</pathurl>${rateXml(c.sourceRate)}<duration>${c.out}</duration><media><video>${sourceSample}</video><audio><samplecharacteristics><samplerate>48000</samplerate></samplecharacteristics><channelcount>2</channelcount></audio></media></file><sourcetrack><mediatype>${kind}</mediatype><trackindex>1</trackindex></sourcetrack></clipitem>`;
    }).join('')}</track>`).join('');
    return `<${kind}>${kind === 'video' ? `<format>${sample}</format>` : '<format><samplecharacteristics><samplerate>48000</samplerate><channelcount>2</channelcount></samplecharacteristics></format>'}${tracks}</${kind}>`;
  }).join('');
  const xml = `<?xml version="1.0" encoding="UTF-8"?><xmeml version="5"><sequence id="lolly-sequence"><name>${esc(sequence.name)}</name><duration>${sequence.duration}</duration>${rateXml(sequence.rate)}<media>${streams}</media></sequence></xmeml>`;
  if (new TextEncoder().encode(xml).length > 8 * 1024 * 1024) throw new Error('Interchange XML exceeds 8 MB.');
  return xml;
}
