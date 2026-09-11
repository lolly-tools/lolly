// SPDX-License-Identifier: MPL-2.0
/** Replace one audio track without decoding, trimming or re-encoding any picture packets. */
import * as MB from 'mediabunny';

export async function remuxCleanedTracks(sourceBytes: Uint8Array, audioBytes: Uint8Array, opts: { sourceMime?: string; sourceName?: string }) {
  const name = opts.sourceName || '', mime = opts.sourceMime || '';
  const container = /webm/i.test(mime) || /\.webm$/i.test(name) ? 'webm'
    : /quicktime/i.test(mime) || /\.mov$/i.test(name) ? 'mov'
      : /matroska/i.test(mime) || /\.mkv$/i.test(name) ? 'mkv' : 'mp4';
  const formats = { webm: new MB.WebMOutputFormat(), mov: new MB.MovOutputFormat(), mkv: new MB.MkvOutputFormat(), mp4: new MB.Mp4OutputFormat() };
  const target = new MB.BufferTarget(), output = new MB.Output({ format: formats[container], target });
  const input = new MB.Input({ formats: MB.ALL_FORMATS, source: new MB.BufferSource(sourceBytes) });
  const cleaned = new MB.Input({ formats: MB.ALL_FORMATS, source: new MB.BufferSource(audioBytes) });
  try {
    const videos = await input.getVideoTracks(), audios = await input.getAudioTracks();
    if (videos.length !== 1 || audios.length !== 1) throw new Error('video cleanup requires exactly one picture track and one audio track; additional tracks will not be silently dropped');
    const video = videos[0]!, audio = await cleaned.getPrimaryAudioTrack();
    if (!audio) throw new Error('the cleaned file has no audio track');
    const videoCodec = await video.getCodec(), audioCodec = await audio.getCodec();
    if (!videoCodec || !formats[container].getSupportedVideoCodecs().includes(videoCodec)) throw new Error(`cannot preserve ${videoCodec || 'unknown'} picture packets in ${container.toUpperCase()}`);
    if (!audioCodec || !formats[container].getSupportedAudioCodecs().includes(audioCodec)) throw new Error(`cannot mux cleaned ${audioCodec || 'unknown'} audio in ${container.toUpperCase()}`);
    const videoSource = new MB.EncodedVideoPacketSource(videoCodec), audioSource = new MB.EncodedAudioPacketSource(audioCodec);
    const videoConfig = await video.getDecoderConfig(), audioConfig = await audio.getDecoderConfig();
    output.addVideoTrack(videoSource, { rotation: await video.getRotation() });
    output.addAudioTrack(audioSource);
    output.setMetadataTags(await input.getMetadataTags());
    const audioOffset = await audios[0]!.getFirstTimestamp();
    let frameCount = 0;
    await output.start();
    await Promise.all([
      (async () => {
        for await (const packet of new MB.EncodedPacketSink(video).packets()) {
          await videoSource.add(packet, videoConfig ? { decoderConfig: videoConfig } : undefined);
          frameCount++;
        }
        videoSource.close();
      })(),
      (async () => {
        for await (const packet of new MB.EncodedPacketSink(audio).packets()) {
          await audioSource.add(packet.clone({ timestamp: packet.timestamp + audioOffset }), audioConfig ? { decoderConfig: audioConfig } : undefined);
        }
        audioSource.close();
      })(),
    ]);
    await output.finalize();
    if (!target.buffer || !frameCount) throw new Error('muxer produced no picture frames');
    return { bytes: new Uint8Array(target.buffer), container,
      mime: { webm: 'video/webm', mov: 'video/quicktime', mkv: 'video/x-matroska', mp4: 'video/mp4' }[container], frameCount };
  } finally {
    if (output.state === 'started') await output.cancel();
    input.dispose(); cleaned.dispose();
  }
}
