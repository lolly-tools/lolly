/** The raw Emscripten factory the vendored patch exports (see README.md). The C
 *  surface is driven only by lib/audio-stretch-core.ts, which owns the heap I/O
 *  discipline, so the type here stays deliberately loose. */
export interface SignalsmithStretchModule {
  _main(): void;
  _presetDefault(channels: number, rate: number): void;
  _presetCheaper(channels: number, rate: number): void;
  _inputLatency(): number;
  _outputLatency(): number;
  _setBuffers(channels: number, bufferLength: number): number;
  _process(inputSamples: number, outputSamples: number): void;
  _flush(outputSamples: number): void;
  _seek(samples: number, playbackRate: number): void;
  _setTransposeSemitones(semitones: number, tonalityLimit: number): void;
  _setTransposeFactor(factor: number, tonalityLimit: number): void;
  _setFormantSemitones(semitones: number, compensate: number): void;
  _setFormantFactor(factor: number, compensate: number): void;
  _setFormantBase(baseFreq: number): void;
  HEAP8: { buffer: ArrayBufferLike };
}
declare const factory: () => Promise<SignalsmithStretchModule>;
export default factory;
