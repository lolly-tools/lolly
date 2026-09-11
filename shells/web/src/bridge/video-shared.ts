// SPDX-License-Identifier: MPL-2.0
/**
 * Shared WebCodecs codec selection - the one avc→vp9→vp8 ladder and the
 * per-container audio pick.
 *
 * These were copy-pasted three ways: `pickWebCodecsVideo`/`pickWebCodecsAudio` in
 * bridge/export.ts, reproduced verbatim in bridge/sequence-render.ts (whose header
 * names the "REPORTED DEBT: the right end state is a shared bridge/video-shared.ts
 * that both files import"), and a third copy as `pickVideoCodec`/`pickAudioCodec`
 * in lib/video-jobs.ts. This is that shared module. Behaviour is byte-for-byte what
 * the three carried - one probe list, one `isConfigSupported` gate, same order - so
 * the export goldens are unaffected. It is also the single edit point where plan
 * 153 WP-B (AV1/HEVC candidates) and plan 154 (10-bit HDR variants) add codecs.
 */
import type { EncodePick } from './video-encode-core.ts';

/** The video ladder: mp4 (AV1→H.264 High→Main) and webm (AV1→VP9→VP8). AV1 leads
 *  both where the browser encodes it (WP-B) - same visual quality at ~40% of the
 *  bytes, verified deterministic + luma-faithful on the browser tier - falling back
 *  to the universally-decodable H.264 / VP9 where AV1 encode is absent. HEVC is
 *  deliberately NOT in the default ladder (browsers frequently cannot DECODE hvc1),
 *  it is an explicit codec choice only. */
const MP4_LADDER: readonly EncodePick[] = [
  { container: 'mp4', codec: 'av01.0.08M.08', muxCodec: 'av1' },   // AV1 Main profile 0, 8-bit
  { container: 'mp4', codec: 'avc1.640033', muxCodec: 'avc' },   // H.264 High L5.1
  { container: 'mp4', codec: 'avc1.4d0033', muxCodec: 'avc' },   // H.264 Main L5.1
];
const WEBM_LADDER: readonly EncodePick[] = [
  { container: 'webm', codec: 'av01.0.08M.08', muxCodec: 'V_AV1' },   // AV1 Main profile 0, 8-bit
  { container: 'webm', codec: 'vp09.00.10.08', muxCodec: 'V_VP9' },   // VP9 profile 0, 8-bit
  { container: 'webm', codec: 'vp8', muxCodec: 'V_VP8' },
];

/** The 10-bit HDR ladders (plan 154 WP-2), probed FIRST only when the caller asks for
 *  HDR. AV1 Main10 leads both containers (widely encodable, small); HEVC Main10 is the
 *  MP4 fallback (last - browsers rarely ENCODE it), VP9 profile-2 10-bit the WebM one.
 *  All carry a `.10` / profile-2 depth so is10bitHdrCodec below recognises the pick. */
const HDR_MP4_LADDER: readonly EncodePick[] = [
  { container: 'mp4', codec: 'av01.0.08M.10', muxCodec: 'av1' },        // AV1 Main10
  { container: 'mp4', codec: 'hev1.2.4.L153.B0', muxCodec: 'hevc' },    // HEVC Main10 (rarely encodable - last)
];
const HDR_WEBM_LADDER: readonly EncodePick[] = [
  { container: 'webm', codec: 'av01.0.08M.10', muxCodec: 'V_AV1' },     // AV1 Main10
  { container: 'webm', codec: 'vp09.02.10.10', muxCodec: 'V_VP9' },     // VP9 profile 2, 10-bit
];

/** The Rec.2100-PQ tag stamped on every HDR VideoFrame and forced onto the muxed
 *  track's decoderConfig, so the container carries a colr/nclx (mp4) or Colour (webm)
 *  box. Matches the stills HDR path (BT.2020 primaries, PQ transfer, narrow range). */
export const HDR_VF_COLORSPACE = {
  // The lib.dom VideoColorPrimaries union predates BT.2020 (stops at bt709/smpte170m),
  // so the runtime-valid PQ values are widened - same cast lossless-trim/transmux use.
  primaries: 'bt2020', transfer: 'pq', matrix: 'bt2020-ncl', fullRange: false,
} as unknown as VideoColorSpaceInit;

/** True when `codec` is one of the 10-bit HDR ladder picks - the gate export.ts uses to
 *  decide hdrActive. Reads the codec string's depth/profile field so an explicit
 *  pro-picker HDR codec (long-form AV1, etc.) is recognised too. */
export function is10bitHdrCodec(codec: string): boolean {
  const c = codec.toLowerCase();
  if (c.startsWith('av01')) return c.split('.')[3] === '10';                 // AV1 bit-depth field
  if (c.startsWith('hev1') || c.startsWith('hvc1')) return c.split('.')[1] === '2';  // HEVC Main10 profile
  if (c.startsWith('vp09')) { const p = c.split('.'); return p[1] === '02' && p[2] === '10'; }  // VP9 profile 2, 10-bit
  return false;
}

/** Reads the VideoEncoder global (present in both window and worker scope). */
function videoEncoder(): { isConfigSupported?: (c: unknown) => Promise<{ supported?: boolean }> } | undefined {
  return (globalThis as { VideoEncoder?: { isConfigSupported?: (c: unknown) => Promise<{ supported?: boolean }> } }).VideoEncoder;
}
function audioEncoder(): { isConfigSupported?: (c: unknown) => Promise<{ supported?: boolean }> } | undefined {
  return (globalThis as { AudioEncoder?: { isConfigSupported?: (c: unknown) => Promise<{ supported?: boolean }> } }).AudioEncoder;
}

/** An EncodePick for an EXPLICIT codec in a container (WP-B pro-settings picker),
 *  including codecs kept OUT of the default ladder (HEVC). Returns null when the
 *  codec is not legal in that container (e.g. HEVC/H.264 in WebM, VP9 in MP4), so the
 *  caller falls back to the auto ladder rather than emitting an illegal pairing. */
function explicitPick(codec: string, container: 'mp4' | 'webm'): EncodePick | null {
  const c = codec.toLowerCase();
  if (c.startsWith('av01')) return { container, codec, muxCodec: container === 'mp4' ? 'av1' : 'V_AV1' };
  if (c.startsWith('avc1') || c.startsWith('avc3')) return container === 'mp4' ? { container, codec, muxCodec: 'avc' } : null;
  if (c.startsWith('hvc1') || c.startsWith('hev1')) return container === 'mp4' ? { container, codec, muxCodec: 'hevc' } : null;
  if (c.startsWith('vp09') || c.startsWith('vp9')) return container === 'webm' ? { container, codec, muxCodec: 'V_VP9' } : null;
  if (c.startsWith('vp8')) return container === 'webm' ? { container, codec, muxCodec: 'V_VP8' } : null;
  return null;
}

/**
 * First encodable video codec for `width×height@fps`/`bitrate`, honouring the
 * caller's container preference (mp4 tries AV1→H.264 first, webm tries AV1→VP9/VP8
 * first). An explicit `forceCodec` (the pro-settings picker) is tried first in the
 * preferred container, still `isConfigSupported`-gated so an unsupported explicit pick
 * quietly falls through to the auto ladder. Returns null when WebCodecs - or any codec
 * at that size - is unavailable, so the caller falls back to the MediaRecorder path.
 */
export async function pickWebCodecsVideo(
  preferred: 'mp4' | 'webm' | string, width: number, height: number, fps: number, bitrate: number,
  forceCodec?: string, hdr?: boolean,
): Promise<EncodePick | null> {
  const VE = videoEncoder();
  if (!VE?.isConfigSupported) return null;
  const container: 'mp4' | 'webm' = preferred === 'webm' ? 'webm' : 'mp4';
  // HDR requested: probe the 10-bit ladder for the preferred container FIRST. Falls
  // through SILENTLY to the SDR path below when no HDR codec encodes here (Firefox,
  // older Chrome, headless CI), so hdr omitted/false is byte-identical to before.
  if (hdr === true) {
    for (const pick of (container === 'webm' ? HDR_WEBM_LADDER : HDR_MP4_LADDER)) {
      try {
        const s = await VE.isConfigSupported({ codec: pick.codec, width, height, bitrate, framerate: fps });
        if (s?.supported) return pick;
      } catch { /* HDR codec unavailable - try the next, then fall through to SDR */ }
    }
  }
  if (forceCodec) {
    const ep = explicitPick(forceCodec, container);
    if (ep) {
      try {
        const s = await VE.isConfigSupported({ codec: ep.codec, width, height, bitrate, framerate: fps });
        if (s?.supported) return ep;
      } catch { /* explicit pick unavailable - fall through to the auto ladder */ }
    }
  }
  const ladder = preferred === 'webm' ? [...WEBM_LADDER, ...MP4_LADDER] : [...MP4_LADDER, ...WEBM_LADDER];
  for (const pick of ladder) {
    try {
      const s = await VE.isConfigSupported({ codec: pick.codec, width, height, bitrate, framerate: fps });
      if (s?.supported) return pick;
    } catch { /* try the next candidate */ }
  }
  return null;
}

/** A chosen audio codec plus the params it was probed at. */
export interface AudioPick { codec: string; muxCodec: string; sampleRate: number; numberOfChannels: number; bitrate: number }

/**
 * WebCodecs audio codec for `container`: AAC-LC (mp4) or Opus (webm), probed at
 * the given rate/channels/bitrate (defaults match the export/mix path: 48 kHz,
 * stereo, 128 kbps). Returns null when AudioEncoder or that codec is unavailable.
 * The probe params ride along so callers feed the encoder + muxer without
 * re-stating them.
 */
export async function pickWebCodecsAudio(
  container: 'mp4' | 'webm', sampleRate = 48_000, numberOfChannels = 2, bitrate = 128_000,
): Promise<AudioPick | null> {
  const AE = audioEncoder();
  if (!AE?.isConfigSupported) return null;
  const cand = container === 'mp4'
    ? { codec: 'mp4a.40.2', muxCodec: 'aac' }
    : { codec: 'opus', muxCodec: 'A_OPUS' };
  try {
    const s = await AE.isConfigSupported({ codec: cand.codec, sampleRate, numberOfChannels, bitrate });
    if (s?.supported) return { ...cand, sampleRate, numberOfChannels, bitrate };
  } catch { /* unsupported */ }
  return null;
}
