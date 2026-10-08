// SPDX-License-Identifier: MPL-2.0
/** Authored media clips into a Premiere XML package with original media bytes. */
import type { AssetRef, ExportOpts, HostV1 } from './bridge/host-v1.ts';
import { secondsToFrames, writePremiereXml, type InterchangeClip, type InterchangeRate } from './premiere-xml.ts';
import { storeZip, type ZipStoreEntry } from './zip.ts';
import { attributionCompanion } from './rights-attribution.ts';
import { checkCompanionReadback } from './rights-companion.ts';

type Box = Record<string, unknown>;
const num = (v: unknown, fallback = 0): number => v == null || v === '' || !Number.isFinite(Number(v)) ? fallback : Number(v);
const yes = (v: unknown): boolean => v === true || v === 'true' || v === 1 || v === '1';
const extensions: Record<string, string> = { mp4: 'mp4', webm: 'webm', mov: 'mov', wav: 'wav', mp3: 'mp3', m4a: 'm4a', ogg: 'ogg', flac: 'flac', png: 'png', jpeg: 'jpg', jpg: 'jpg' };

export async function exportDesignPremiere(opts: ExportOpts, host: HostV1): Promise<Blob> {
  if (opts.sourceDocument?.toolId !== 'design') throw new Error('Premiere XML export needs an authored Design sequence.');
  if (opts.watermark) throw new Error('Premiere XML cannot carry the requested visible watermark.');
  const values = structuredClone(opts.sourceDocument.values);
  if (values.customCss || values.textDocument || values.sequenceMarks || values.sequenceTiming) throw new Error('Premiere XML exports unprocessed media clips. Export video to retain custom CSS, composed text, markers or sequence timing edits.');
  const boxes = (Array.isArray(values.boxes) ? values.boxes : []) as Box[], frames = boxes.filter(b => b.kind === 'frame' && !yes(b.hidden));
  if (frames.length > 1 || boxes.length > 10000) throw new Error('Premiere XML exports one sequence artboard with at most 10000 clips.');
  const frame = frames[0], rate: InterchangeRate = { numerator: num(values.projectFps, 30), denominator: 1 };
  const width = num(frame?.w, num(opts.width, 1920)), height = num(frame?.h, num(opts.height, 1080));
  const encoder = new TextEncoder(), entries: ZipStoreEntry[] = [], clips: InterchangeClip[] = [], sources: { id: string; path: string; mime: string }[] = [], seen = new Map<string, string>();
  let total = 0;
  const add = (name: string, bytes: Uint8Array) => { total += bytes.length; if (total > 256 * 1024 * 1024) throw new Error('Premiere interchange package exceeds 256 MB.'); entries.push({ name, bytes }); };
  const notes = ['Unprocessed media clips only. Unzip the package and import sequence.xml in Premiere. Relink media from its Media folder when prompted.', 'Source in/out positions use the Lolly project frame rate. Original media frame rates are not available in the asset contract; check source timing after import.'];
  let videoTrack = 0, audioTrack = 0;
  for (const [index, box] of boxes.entries()) {
    if (box.kind === 'frame' || yes(box.hidden) || yes(box.ignored)) continue;
    if (frame && String(box.frame ?? '') !== String(frame.id)) throw new Error('Premiere XML cannot include clips outside the sequence artboard.');
    const ref = box.image as AssetRef | undefined, name = String(box.name || box.id || `Clip ${index + 1}`);
    if (!ref || !['video', 'audio', 'raster'].includes(ref.type)) throw new Error(`${name}: render titles, shapes, animations and tool content to media before XML export.`);
    for (const key of ['keys', 'fx', 'grad', 'clip', 'cls', 'imageFraming', 'animationEdits']) if (box[key]) throw new Error(`${name}: ${key} needs rendered video export.`);
    for (const key of ['blur', 'bgBlur', 'rot', 'pitch', 'pan', 'duck']) if (num(box[key])) throw new Error(`${name}: ${key} needs rendered video export.`);
    for (const key of ['enter', 'exit', 'hold', 'shadow', 'blend']) if (box[key] && !['none', 'normal'].includes(String(box[key]))) throw new Error(`${name}: ${key} needs rendered video export.`);
    if (num(box.speed, 1) !== 1 || num(box.opacity, 100) !== 100 || yes(box.flipH) || yes(box.flipV)) throw new Error(`${name}: speed, opacity and mirroring need rendered video export.`);
    const start = secondsToFrames(num(box.start), rate), duration = secondsToFrames(num(box.dur), rate), clipIn = secondsToFrames(num(box.clipIn), rate);
    if (start < 0 || duration <= 0 || clipIn < 0) throw new Error(`${name}: XML export needs explicit nonnegative start/in and a positive duration.`);
    const format = ref.original?.format ?? ref.format, extension = extensions[format]; if (!extension || !host.assets.bytes) throw new Error(`${name}: unsupported or unavailable source media.`);
    let path = seen.get(ref.id);
    if (!path) {
      const bytes = await host.assets.bytes(ref); opts.signal?.throwIfAborted();
      path = `Media/source-${seen.size + 1}.${extension}`; seen.set(ref.id, path); add(path, bytes); sources.push({ id: ref.id, path, mime: format });
    }
    const kind = ref.type === 'audio' ? 'audio' : 'video', track = kind === 'audio' ? audioTrack++ : videoTrack++;
    clips.push({ id: `clip-${index}`, name, kind, track, start, end: start + duration, in: clipIn, out: clipIn + duration, path: `file://localhost/${path}`, sourceRate: rate, width: num(ref.width, width), height: num(ref.height, height) });
    if (kind === 'video' && ref.type === 'video' && !yes(box.mute)) {
      clips.push({ ...clips.at(-1)!, id: `clip-${index}-audio`, kind: 'audio', track: audioTrack++ });
      notes.push(`${name}: source audio included on its own track; silent sources can be removed in Premiere.`);
    }
    if (kind === 'video') notes.push(`${name}: authored canvas placement and fitting are not transferred; Premiere uses the source framing.`);
  }
  if (!clips.length) throw new Error('Add timed media clips before exporting Premiere XML.');
  const duration = Math.max(...clips.map(c => c.end));
  add('sequence.xml', encoder.encode(writePremiereXml({ name: String(values.title || 'Lolly sequence'), rate, width, height, duration, clips, notes })));
  add('lolly-interchange.json', encoder.encode(JSON.stringify({ format: 'xmeml', rate, clips, sources, notes: [...new Set(notes)] }, null, 2)));
  if (opts.rights) for (const file of attributionCompanion(opts.rights.plan).files) add(file.name, encoder.encode(file.text));
  if (opts.meta) add('lolly-metadata.json', encoder.encode(JSON.stringify(opts.meta)));
  const bytes = storeZip(entries); host.log('warn', [...new Set(notes)].join(' '));
  if (opts.rights?.onReceipt) opts.rights.onReceipt(await checkCompanionReadback(bytes, opts.rights.plan, opts.rights.fingerprint));
  return new Blob([bytes as BlobPart], { type: 'application/zip' });
}
