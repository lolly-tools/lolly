// SPDX-License-Identifier: MPL-2.0
// Capability probes for format availability. These are tiny, mostly stateless (a
// few memoised probes) DOM/navigator/MediaRecorder feature checks the tool view
// calls at mount to gate the format picker. They live HERE, not in export.ts, so
// importing them does NOT drag the ~95 KB rasteriser onto the tool-open path -
// export.ts stays lazy (loaded only on an actual Get/Save). export.ts re-exports
// these for its dynamic callers, and imports canRecord for videoMimeType.
//
// The only imports allowed here are PURE DATA modules for the same reason: the
// codec lists, the models base, and the durable model's file identity. Anything
// that opens a database or a runtime is reached by dynamic import from inside an
// async probe.
import { WEBM_CODECS, MP4_CODECS } from './video-mime.ts';
import { MODELS_BASE } from '../lib/models-base.ts';
import { DURABLE_ENCODER_BYTES, DURABLE_ENCODER_PATH } from '../lib/durable-model.ts';

// Production needs canvas pixel readback (blocked by Tor / Firefox RFP, which
// breaks every raster export). Delivery is the TIFF-specific catch: the browser
// can't preview a CMYK TIFF, and mobile Safari / in-app WebViews route blob
// downloads to an in-page view - a dead end for a non-displayable file. So the
// format is offered on desktop only, until a previewable / colour-managed path
// exists. The shell calls this from keepFormat to hide the option where unusable.
let _cmykTiff: boolean | null = null;
export function cmykTiffSupport(): boolean {
  if (_cmykTiff !== null) return _cmykTiff;
  _cmykTiff = false;
  if (typeof document === 'undefined' || typeof navigator === 'undefined') return _cmykTiff;
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 2;
    const ctx = c.getContext('2d');
    if (!ctx) return _cmykTiff;
    ctx.fillRect(0, 0, 1, 1);
    ctx.getImageData(0, 0, 1, 1);                     // throws if readback is blocked
  } catch { return _cmykTiff; }
  const ua = navigator.userAgent || '';
  const iOS = /iP(hone|ad|od)/.test(ua) || (/Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1);
  const mobile = iOS || /Android/.test(ua) || (/Mobi/.test(ua) && (navigator.maxTouchPoints || 0) > 0);
  _cmykTiff = !mobile;
  return _cmykTiff;
}

// The plain RGB TIFF has the same produce-and-deliver constraints as the CMYK one
// (canvas pixel readback to produce; no in-browser preview + mobile blob-download
// dead-end to deliver), so it's gated identically - desktop only. Separate export
// so callers read intent, not a CMYK-named check.
export function tiffSupport(): boolean {
  return cmykTiffSupport();
}

// The pro float interchange formats (OpenEXR, Radiance RGBE - plans/61-deeprichpixels.md
// section 4.2/section 6 B3). The engine owns the writers, but they are fed by a float rasterisation
// the WEB shell cannot do: packages/node-shell/src/raster.ts renders the tool to an
// SVG, rasterises it with resvg and hands the un-premultiplied RGBA to packExr /
// packRadiance. Nothing on this side produces that frame - the browser path ends at
// 8-bit canvas bytes - so the answer is a flat false, not a probe. section 10 item 4 puts
// these formats CLI-first on purpose: offering an option the shell then refuses is
// worse than not offering it. Flip this to a real probe (and add the encoders) if a
// float render path ever lands in the browser; keepFormat and the picker's Pro
// <optgroup> both read this one function, so nothing else has to change.
export function proFormatSupport(): boolean {
  return false;
}

// True only if this browser's MediaRecorder pipeline is usable at all (it also
// needs canvas.captureStream).
export function canRecord(): boolean {
  return typeof MediaRecorder !== 'undefined' &&
         typeof HTMLCanvasElement !== 'undefined' &&
         typeof HTMLCanvasElement.prototype.captureStream === 'function';
}

// Live capture ("Record live" on webm/mp4) needs a display-capture source plus a
// usable recorder. Deliberately does NOT require CropTarget: any browser with
// getDisplayMedia can take live-capture.ts's calibrated-crop tier - Chromium just
// gets the exact element crop for free. Mobile browsers (no getDisplayMedia) and
// Tauri WebViews fail the probe, so the toggle never shows where it can't work.
export function liveCaptureSupport(): boolean {
  return typeof navigator !== 'undefined' &&
         typeof navigator.mediaDevices?.getDisplayMedia === 'function' &&
         canRecord();
}

// The durable credential (opt-in TrustMark embed - tool-actions.ts, export.ts's
// durableEmbedCanvas) is a neural ONNX encode that lazily fetches a ~33 MB encoder
// model (lib/trustmark-embed.ts). It needs WebAssembly for onnxruntime-web, and it
// needs a ROUTE to those bytes. There are three, and this pair of functions asks
// for them in that order:
//   1. already in the IndexedDB model cache - works with no connection;
//   2. same-origin /models/trustmark/ - the web PWA and any self-serving deploy;
//   3. the models base (MODELS_BASE, VITE_MODELS_BASE) - what the Tauri desktop
//      and mobile builds set to https://lolli.li for every other model family.
// Route 3 is why this is no longer a flat `!tauri`: the desktop build has a model
// host, so hiding the toggle there hid a feature that works. It stays hidden where
// no route exists, and a 404 on the model host reads as NO ROUTE - the toggle must
// never appear and then fail at export time.
//
// durableSupport() is the SYNC gate the export panel renders from. On the web it
// answers true exactly as before (same-origin first, the models base after - the
// fetcher's own order, unchanged). Under Tauri it answers false until
// probeDurableSupport() has confirmed a route, so the toggle appears on the probe's
// resolution the way the WebCodecs options do - never wrongly offered.
let _durableRoute: boolean | null = null;

function isTauriWebview(): boolean {
  return typeof window !== 'undefined' &&
    typeof (window as { __TAURI_INTERNALS__?: { invoke?: unknown } }).__TAURI_INTERNALS__?.invoke === 'function';
}

export function durableSupport(): boolean {
  if (typeof WebAssembly === 'undefined') return false;
  if (!isTauriWebview()) return true;
  return _durableRoute === true;
}

/** What the durable probe learned: whether a route exists at all, whether the
 *  bytes are already on device (so the first export starts immediately), and how
 *  big the one-time download is - the three things the export toggle's consent
 *  line states. */
export interface DurableRoute { available: boolean; cached: boolean; bytes: number }

let _durablePending: Promise<DurableRoute> | null = null;

/**
 * Resolve the durable route. Cheap and offline-safe: the IndexedDB check comes
 * first and a cached model short-circuits it, so a primed device never touches the
 * network. Only a Tauri shell with no cached model does a HEAD against the models
 * base - metadata only, no model bytes move without the export's own consent - and
 * only when a models base is configured at all.
 *
 * NOTHING is memoised across calls, deliberately: both answers can change inside a
 * session. The model arrives (a durable export, or Profile -> Available offline ->
 * Durable credential) and `cached` has to flip, or the file appears on the model
 * host and the toggle should turn up on the next panel open rather than after a
 * restart. Each call is one IndexedDB key read, plus - only on a Tauri shell that
 * has no model yet - one HEAD. Concurrent calls share the one in-flight run.
 */
export function probeDurableSupport(opts: {
  base?: string;
  cached?: () => Promise<boolean>;
  reachable?: (url: string) => Promise<boolean>;
} = {}): Promise<DurableRoute> {
  if (_durablePending) return _durablePending;
  const base = opts.base ?? MODELS_BASE;
  const cached = opts.cached ?? (async () => {
    const { durableModelCached } = await import('../lib/model-prefetch.ts');
    return durableModelCached();
  });
  const reachable = opts.reachable ?? (async (url: string) => {
    try {
      const resp = await fetch(url, { method: 'HEAD' });
      return resp.ok;
    } catch { return false; }
  });
  const pending = (async (): Promise<DurableRoute> => {
    const result: DurableRoute = { available: false, cached: false, bytes: DURABLE_ENCODER_BYTES };
    if (typeof WebAssembly === 'undefined') return result;
    result.cached = await cached().catch(() => false);
    if (result.cached) { result.available = true; return result; }
    if (!isTauriWebview()) { result.available = true; return result; } // same-origin, then the models base
    if (!base) return result;                                          // a Tauri build with no model host
    result.available = await reachable(`${base}${DURABLE_ENCODER_PATH}`);
    return result;
  })();
  _durablePending = pending;
  const settle = (available: boolean): void => {
    // Only the Tauri answer is recorded: off Tauri the sync gate is already true and
    // must stay byte-identical to the pre-probe behaviour.
    if (isTauriWebview()) _durableRoute = available;
    _durablePending = null;
  };
  void pending.then((r) => settle(r.available), () => settle(false));
  return pending;
}

// WebCodecs half of the video gate. renderVideo tries a VideoEncoder encode FIRST,
// so a browser whose MediaRecorder can't produce a container (e.g. no MediaRecorder
// mp4, but VideoEncoder AVC) still makes a real file - the picker must offer it.
// VideoEncoder.isConfigSupported is async while videoSupport() is a sync gate, so
// the probe is kicked off once at module load and cached; until it resolves
// videoSupport() reports the MediaRecorder-only answer. That transient under-report
// is deliberate progressive enhancement - the option appears on the next gate read,
// it is never wrongly offered. Exported (with the encoder injectable) so the
// resolve-then-OR behaviour is unit-testable under node.
const _wcVideo = { webm: false, mp4: false };
type ConfigProbe = { isConfigSupported?: (c: object) => Promise<{ supported?: boolean } | null | undefined> };
export async function probeWebCodecsVideoSupport(
  VE: ConfigProbe | undefined = (globalThis as { VideoEncoder?: ConfigProbe }).VideoEncoder,
): Promise<{ webm: boolean; mp4: boolean }> {
  const isSupported = VE?.isConfigSupported?.bind(VE);
  if (typeof isSupported !== 'function') return _wcVideo;
  const ok = async (codec: string): Promise<boolean> => {
    try {
      // Nominal 720p - export.ts's pickWebCodecsVideo re-probes at the real size.
      return !!(await isSupported({ codec, width: 1280, height: 720, bitrate: 2_000_000, framerate: 24 }))?.supported;
    } catch { return false; }
  };
  // The same codec candidates pickWebCodecsVideo tries, per container.
  const [mp4, webm] = await Promise.all([
    Promise.all(['avc1.640033', 'avc1.4d0033'].map(ok)).then((r) => r.some(Boolean)),
    Promise.all(['vp09.00.10.08', 'vp8'].map(ok)).then((r) => r.some(Boolean)),
  ]);
  _wcVideo.mp4 = mp4;
  _wcVideo.webm = webm;
  return _wcVideo;
}
void probeWebCodecsVideoSupport();

// Which video containers this browser can actually produce: what MediaRecorder can
// record (Safari/iOS = mp4 only; Firefox = webm only; recent Chrome = both), OR'd
// with the cached WebCodecs probe above. The view uses this to gate the format
// picker so users only see formats their browser can produce. Deliberately probes
// the video-only lists - audio is optional, so a browser that can't mux audio
// still offers the format (it records silent, with a log warning).
export function videoSupport(): { webm: boolean; mp4: boolean } {
  const ok = (t: string) => canRecord() && (MediaRecorder.isTypeSupported?.(t) ?? false);
  return { webm: WEBM_CODECS.some(ok) || _wcVideo.webm, mp4: MP4_CODECS.some(ok) || _wcVideo.mp4 };
}

// The audio-only export formats (lib/audio-encode.ts). wav and mp3 are pure JS
// (engine packWav / lamejs), so they are unconditional - no probe can fail them.
// m4a/aac and opus/ogg ride the platform's WebCodecs AudioEncoder, whose
// isConfigSupported is async while audioSupport() is a sync gate, so this follows
// the same shape as probeWebCodecsVideoSupport above: fire once at module load,
// cache, and report the safe answer (false) until it resolves. The option appears
// on the next gate read; it is never wrongly offered. Only TWO probes are needed:
// m4a and aac are the same AAC encoder in different containers (so they share the
// mp4a.40.2 result), and opus and ogg are the same Opus encoder (sharing the opus
// result). Nominal config only - audio-encode.ts re-probes at the clip's real
// sample rate before it encodes.
const _wcAudio = { m4a: false, opus: false };
export async function probeWebCodecsAudioSupport(
  AE: ConfigProbe | undefined = (globalThis as { AudioEncoder?: ConfigProbe }).AudioEncoder,
): Promise<{ m4a: boolean; opus: boolean }> {
  const isSupported = AE?.isConfigSupported?.bind(AE);
  if (typeof isSupported !== 'function') return _wcAudio;
  const ok = async (codec: string): Promise<boolean> => {
    try {
      return !!(await isSupported({ codec, sampleRate: 48_000, numberOfChannels: 2, bitrate: 128_000 }))?.supported;
    } catch { return false; }
  };
  // The same codecs export.ts's pickWebCodecsAudio uses, per container.
  const [m4a, opus] = await Promise.all([ok('mp4a.40.2'), ok('opus')]);
  _wcAudio.m4a = m4a;
  _wcAudio.opus = opus;
  return _wcAudio;
}
void probeWebCodecsAudioSupport();

// FLAC rides @mediabunny/flac-encoder's libFLAC WASM encoder, REGISTERED into
// mediabunny at encode time - it is not a platform (WebCodecs) codec, so it works
// wherever WebAssembly does. This gate is therefore a cheap WASM-presence probe, the
// "or an equivalent" the plan allows, NOT a mediabunny import: dragging mediabunny
// onto the tool-open path is exactly what this file exists to avoid (see header). It
// is not a hardcoded `true` - it reads false where WASM is absent. The AUTHORITATIVE
// check - register the encoder, then canEncodeAudio('flac') at the CLIP's real sample
// rate (libFLAC accepts only a fixed rate set) - happens in lib/audio-encode.ts
// encodeFlac, which throws a clean message where the real rate is unsupported.
export function flacSupport(): boolean {
  return typeof WebAssembly !== 'undefined';
}

// Which audio-only formats this browser can actually produce. The picker gates on
// this exactly as it does on videoSupport(). aac shares m4a's AAC encoder and ogg
// shares opus's Opus encoder, so each pair reports the same probe result.
export function audioSupport(): { wav: boolean; mp3: boolean; m4a: boolean; aac: boolean; opus: boolean; ogg: boolean; flac: boolean } {
  return {
    wav: true, mp3: true,
    m4a: _wcAudio.m4a, aac: _wcAudio.m4a,
    opus: _wcAudio.opus, ogg: _wcAudio.opus,
    flac: flacSupport(),
  };
}
