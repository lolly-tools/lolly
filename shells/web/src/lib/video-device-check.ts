// SPDX-License-Identifier: MPL-2.0
/**
 * What a video file holds, and whether this device can open the file.
 *
 * Lolly ships no decoder for a patent-pool codec (ProRes, DNx, H.264, HEVC, AAC,
 * AC-3). It reads the container (engine/src/video-container-probe.ts), asks the
 * device's own licensed decoder whether it can open the codec, and says so in
 * plain words when it cannot. The original bytes are always kept.
 *
 * The device is asked two ways, in this order:
 *   1. WebCodecs `VideoDecoder` / `AudioDecoder.isConfigSupported` with the probed
 *      codec string, which is what the trim, preview and transcode paths use;
 *   2. `HTMLMediaElement.canPlayType` with the same codec, which is how the
 *      element fallback plays a clip. WKWebView on a Mac answers "probably" for
 *      ProRes through AVFoundation, which is how the desktop app on macOS opens
 *      ProRes under Apple's licence without any native code of ours.
 *
 * Follow-up, not built here: a native Tauri command asking the operating system
 * directly (AVFoundation on macOS, Media Foundation on Windows). The two web
 * questions above already cover the macOS WebView, so this waits for a codec
 * they answer wrongly.
 *
 * MXF is a container no browser or WebView opens, so an MXF is never reported as
 * playable here, whatever its codec: the message says to export a proxy.
 */
import {
  probeVideoContainer, VideoProbeError,
  type ContainerProbe, type ProbedAudioTrack, type ProbedVideoTrack,
} from '../../../../engine/src/video-container-probe.ts';

export interface DeviceCheckDeps {
  videoSupported?: (config: { codec: string; codedWidth: number; codedHeight: number }) => Promise<boolean | null>;
  audioSupported?: (config: { codec: string; sampleRate: number; numberOfChannels: number }) => Promise<boolean | null>;
  canPlayType?: (mime: string) => string;
}

export interface DeviceCheck {
  /** True when the first picture track can be opened, false when it cannot, null when the device cannot be asked. */
  video: boolean | null;
  /** One entry per audio track, in file order. */
  audio: Array<boolean | null>;
}

export interface VideoInspection {
  probe: ContainerProbe;
  check: DeviceCheck;
  /** Plain-English note for a clip the device cannot fully open, otherwise null. */
  note: string | null;
}

function browserDeps(): DeviceCheckDeps {
  const g = globalThis as {
    VideoDecoder?: { isConfigSupported?: (c: unknown) => Promise<{ supported?: boolean }> };
    AudioDecoder?: { isConfigSupported?: (c: unknown) => Promise<{ supported?: boolean }> };
    document?: { createElement?: (t: string) => { canPlayType?: (m: string) => string } };
  };
  const ask = (api: { isConfigSupported?: (c: unknown) => Promise<{ supported?: boolean }> } | undefined) =>
    api?.isConfigSupported
      ? async (config: unknown): Promise<boolean | null> => { try { return (await api.isConfigSupported!(config)).supported === true; } catch { return false; } }
      : undefined;
  let el: { canPlayType?: (m: string) => string } | undefined;
  try { el = g.document?.createElement?.('video'); } catch { el = undefined; }
  return {
    videoSupported: ask(g.VideoDecoder) as DeviceCheckDeps['videoSupported'],
    audioSupported: ask(g.AudioDecoder) as DeviceCheckDeps['audioSupported'],
    canPlayType: el?.canPlayType ? (m) => el!.canPlayType!(m) : undefined,
  };
}

async function askTrack(
  container: ContainerProbe['container'],
  codecString: string | null,
  identifier: string,
  webcodecs: (() => Promise<boolean | null>) | undefined,
  deps: DeviceCheckDeps,
  kind: 'video' | 'audio',
): Promise<boolean | null> {
  if (container === 'mxf') return false;
  let answered = false;
  if (codecString && webcodecs) {
    const r = await webcodecs();
    if (r === true) return true;
    answered = r !== null;
  }
  if (deps.canPlayType) {
    const codec = codecString ?? identifier.trim();
    const mime = `${kind === 'audio' ? 'audio' : 'video'}/${container === 'mp4' ? 'mp4' : 'quicktime'}; codecs="${codec}"`;
    if (deps.canPlayType(mime) === 'probably') return true;
    answered = true;
  }
  return answered ? false : null;
}

export async function checkDevice(probe: ContainerProbe, deps: DeviceCheckDeps = browserDeps()): Promise<DeviceCheck> {
  const v = probe.video[0];
  const video = v
    ? await askTrack(probe.container, v.webcodecs, v.identifier, deps.videoSupported && v.webcodecs
      ? () => deps.videoSupported!({ codec: v.webcodecs!, codedWidth: Math.max(2, v.width), codedHeight: Math.max(2, v.height) })
      : undefined, deps, 'video')
    : null;
  const audio: Array<boolean | null> = [];
  for (const a of probe.audio) {
    audio.push(await askTrack(probe.container, a.webcodecs, a.identifier, deps.audioSupported && a.webcodecs
      ? () => deps.audioSupported!({ codec: a.webcodecs!, sampleRate: a.sampleRate ?? 48000, numberOfChannels: a.channels ?? 2 })
      : undefined, deps, 'audio'));
  }
  return { video, audio };
}

const PROXY = 'Export an H.264, HEVC or AV1 copy from your editing app';

/** The note for a clip the device cannot fully open. Short, plain, English only. */
export function explainProbe(probe: ContainerProbe, check: DeviceCheck): string | null {
  const v: ProbedVideoTrack | undefined = probe.video[0];
  if (v && check.video === false) {
    if (probe.container === 'mxf') {
      return `This is an MXF file with ${v.label}. Lolly can read what it holds but cannot play MXF. ${PROXY}. Lolly keeps the original file.`;
    }
    const mac = v.family === 'prores' ? ', or open it in the Lolly desktop app on a Mac' : '';
    return `This clip uses ${v.label}, which this device cannot play. ${PROXY}${mac}. Lolly keeps the original file.`;
  }
  const badAudio: ProbedAudioTrack | undefined = probe.audio.find((_, i) => check.audio[i] === false);
  if (v && check.video !== false && badAudio) {
    return `The sound in this clip uses ${badAudio.label}, which this device cannot play. The picture is fine. Lolly keeps the original file.`;
  }
  return null;
}

/** Read the container and ask the device. Never throws: a file the probe cannot read answers null. */
export async function inspectVideoFile(file: Blob, deps?: DeviceCheckDeps): Promise<VideoInspection | null> {
  try {
    const probe = await probeVideoContainer({
      size: file.size,
      read: async (offset, length) => new Uint8Array(await file.slice(offset, offset + length).arrayBuffer()),
    });
    if (!probe) return null;
    const check = await checkDevice(probe, deps);
    return { probe, check, note: explainProbe(probe, check) };
  } catch (e) {
    void (e instanceof VideoProbeError);
    return null;
  }
}

export interface VideoImportFacts {
  /** The record kept in the asset's meta, or undefined when the file is not a readable container. */
  videoProbe?: Record<string, unknown>;
  width?: number;
  height?: number;
  durationMs?: number;
}

/** The DOM readers the upload path already has, passed in so this module stays testable in node. */
export interface VideoDomReaders {
  readVideoDimensions: (file: Blob) => Promise<{ width?: number; height?: number; duration?: number }>;
  probeMediaDurationMs: (file: Blob, kind: 'video') => Promise<number | undefined>;
}

/**
 * What the upload path stores for a video: the probe record, plus size and length.
 * When the device cannot play the picture they come from the container header, since
 * a <video> metadata load would only wait out its timeout.
 */
export async function videoImportFacts(file: Blob, dom: VideoDomReaders, deps?: DeviceCheckDeps): Promise<VideoImportFacts> {
  const inspected = await inspectVideoFile(file, deps);
  const v = inspected?.probe.video[0];
  const videoProbe = inspected ? {
    container: inspected.probe.container,
    codec: v?.label ?? null,
    ...(inspected.probe.timecode ? { timecode: inspected.probe.timecode } : {}),
    ...(inspected.note ? { note: inspected.note, openable: inspected.check.video !== false } : {}),
  } : undefined;
  if (inspected && inspected.check.video === false) {
    return {
      videoProbe,
      width: v?.width || undefined,
      height: v?.height || undefined,
      durationMs: inspected.probe.durationSeconds ? Math.round(inspected.probe.durationSeconds * 1000) : undefined,
    };
  }
  const { width, height, duration } = await dom.readVideoDimensions(file);
  const durationMs = duration != null && duration > 0 ? Math.round(duration * 1000) : await dom.probeMediaDurationMs(file, 'video');
  return { videoProbe, width, height, durationMs };
}
