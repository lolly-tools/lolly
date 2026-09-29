// SPDX-License-Identifier: MPL-2.0
/** Inspect delivered bytes using the browser's available media decoders. */
import { motionReport, type MotionFacts, type MotionReport, type MotionTarget, type MotionCheck } from '../../../../engine/src/motion-report.ts';
import { createLoudnessMeter } from '../../../../engine/src/audio-loudness.ts';

export async function inspectMotionBlob(blob: Blob, target: MotionTarget = {}, signal?: AbortSignal): Promise<MotionReport> {
  const facts: MotionFacts = {}, extra: MotionCheck[] = [];
  const mb = await import('mediabunny');
  const input = new mb.Input({ formats: mb.ALL_FORMATS, source: new mb.BlobSource(blob) });
  try {
    signal?.throwIfAborted();
    const video = await input.getPrimaryVideoTrack(), audio = await input.getPrimaryAudioTrack();
    facts.seconds = await input.computeDuration(); facts.audio = !!audio;
    if (video) {
      facts.width = await video.getDisplayWidth(); facts.height = await video.getDisplayHeight();
      facts.fps = (await video.computePacketStats()).averagePacketRate;
    }
    if (audio && facts.seconds <= 600 && await audio.canDecode()) {
      const meter = createLoudnessMeter(), sink = new mb.AudioBufferSink(audio);
      let supported = true;
      for await (const { buffer } of sink.buffers()) {
        signal?.throwIfAborted();
        if (buffer.sampleRate !== 48000 || buffer.numberOfChannels > 2) { supported = false; break; }
        const left = buffer.getChannelData(0);
        meter.push(left, buffer.numberOfChannels === 2 ? buffer.getChannelData(1) : new Float32Array(left.length));
      }
      if (supported) facts.loudness = meter.integrated();
      else extra.push({ id: 'audio-decoder', status: 'not-run', reason: 'Browser loudness measurement supports mono/stereo at 48 kHz; use Node inspection for this file.' });
    }
    for (const id of ['black-spans', 'frozen-spans', 'silent-spans']) extra.push({ id, status: 'not-run', reason: 'Use Node inspection for a full decoded span scan.' });
  } catch (error) {
    signal?.throwIfAborted();
    extra.push({ id: 'container', status: 'not-run', reason: `Browser inspection unavailable: ${(error as Error).message}` });
  } finally { input.dispose(); }
  return motionReport(facts, target, extra);
}
