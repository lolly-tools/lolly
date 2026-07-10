// SPDX-License-Identifier: MPL-2.0
/**
 * ZzFXM procedural-music renderer — pure, DOM-free, deterministic-ish.
 *
 * Lolly ships music as DATA, not bytes: a whole song is a few KB of nested
 * arrays that this module renders to raw PCM at play time (in a Web Worker on
 * the web shell, or offline for a video music bed). This is the single runtime
 * code path for every music source — hand-authored songs, MIDI→ZzFXM and
 * MOD→ZzFXM conversions, and the procedural generator all emit `ZzfxSong`.
 *
 * Two MIT-licensed upstreams are vendored below. Their logic is UNCHANGED — the
 * only edits are TypeScript annotations and the index guards required by the
 * engine's `noUncheckedIndexedAccess` (every guard is a no-op at runtime, i.e.
 * `?? 0` where the original relied on `undefined` coercing to `0`/`NaN`, and
 * `!` where an index is structurally always present in a valid song):
 *
 *   zzfxG — ZzFX "Micro" synth v1.3.2 by Frank Force.
 *           MIT — Copyright 2019 Frank Force — https://github.com/KilledByAPixel/ZzFX
 *           (the AudioContext/playback tail is dropped; it returns the mono
 *            sample buffer instead of playing it — i.e. this is `zzfxG`, the
 *            generator, not `zzfx`, the player.)
 *   zzfxM — ZzFX Music renderer v2.0.3 by Keith Clark & Frank Force.
 *           MIT — Copyright Keith Clark — https://github.com/keithclark/ZzFXM
 *
 * DO NOT "clean up" or refactor the two vendored functions — keep them faithful
 * to upstream so rendered output matches the reference ZzFXM tracker. New code
 * belongs in `renderZzfxm()` / the types.
 */

/** ZzFX sample rate (Hz). Songs render at this rate; callers resample if needed. */
export const zzfxR = 44100;

/** ZzFX global volume scale, read inside `zzfxG`. Matches upstream default. */
export const zzfxV = 0.3;

/** One ZzFX instrument: the (mostly optional) parameter list passed to `zzfxG`. */
export type ZzfxInstrument = number[];

/**
 * One channel-row within a pattern: `[instrumentIndex, panning, ...notes]`.
 * `panning` is -1..+1; each note is a semitone value (0 = rest; the fractional
 * part encodes per-note attenuation, per the ZzFXM format).
 */
export type ZzfxChannel = number[];

/** A pattern: one {@link ZzfxChannel} per simultaneous voice. */
export type ZzfxPattern = ZzfxChannel[];

/** A complete ZzFXM song — the portable unit every music source produces. */
export interface ZzfxSong {
  /** ZzFX instrument parameter lists, indexed by channel row `[0]`. */
  instruments: ZzfxInstrument[];
  /** Pattern bank. */
  patterns: ZzfxPattern[];
  /** Playback order: indices into {@link patterns}. */
  sequence: number[];
  /** Tempo in BPM (default 125). */
  bpm?: number;
  /** Optional human title — metadata only; ignored by the renderer. */
  title?: string;
}

/** Rendered stereo PCM: matching-length channels plus the sample rate. */
export interface RenderedPcm {
  left: Float32Array;
  right: Float32Array;
  sampleRate: number;
}

/* ------------------------------------------------------------------------- *
 *  Vendored: ZzFX Micro synth (generator).  MIT © 2019 Frank Force.
 *  Do not refactor — keep faithful to upstream.
 * ------------------------------------------------------------------------- */
export function zzfxG(
  volume = 1,
  randomness = 0.05,
  frequency = 220,
  attack = 0,
  sustain = 0,
  release = 0.1,
  shape = 0,
  shapeCurve = 1,
  slide = 0,
  deltaSlide = 0,
  pitchJump = 0,
  pitchJumpTime = 0,
  repeatTime = 0,
  noise = 0,
  modulation = 0,
  bitCrush = 0,
  delay = 0,
  sustainVolume = 1,
  decay = 0,
  tremolo = 0,
  filter = 0,
): number[] {
  // init parameters
  const sampleRate = zzfxR;
  const PI2 = Math.PI * 2;
  const abs = Math.abs;
  const sign = (v: number): number => (v < 0 ? -1 : 1);
  let startSlide = (slide *= (500 * PI2) / sampleRate / sampleRate);
  let startFrequency = (frequency *=
    ((1 + randomness * 2 * Math.random() - randomness) * PI2) / sampleRate);
  let modOffset = 0; // modulation offset
  let repeat = 0; // repeat offset
  let crush = 0; // bit crush offset
  let jump = 1; // pitch jump timer
  let length = 0; // sample length
  const b: number[] = []; // sample buffer
  let t = 0; // sample time
  let i = 0; // sample index
  let s = 0; // sample value
  let f = 0; // wave frequency

  // biquad LP/HP filter
  const quality = 2;
  const w = (PI2 * abs(filter) * 2) / sampleRate;
  const cos = Math.cos(w);
  const alpha = Math.sin(w) / 2 / quality;
  const a0 = 1 + alpha;
  const a1 = (-2 * cos) / a0;
  const a2 = (1 - alpha) / a0;
  const b0 = (1 + sign(filter) * cos) / 2 / a0;
  const b1 = -(sign(filter) + cos) / a0;
  const b2 = b0;
  let x2 = 0,
    x1 = 0,
    y2 = 0,
    y1 = 0;

  // scale by sample rate
  const minAttack = 9; // prevent pop if attack is 0
  attack = attack * sampleRate || minAttack;
  decay *= sampleRate;
  sustain *= sampleRate;
  release *= sampleRate;
  delay *= sampleRate;
  deltaSlide *= (500 * PI2) / sampleRate ** 3;
  modulation *= PI2 / sampleRate;
  pitchJump *= PI2 / sampleRate;
  pitchJumpTime *= sampleRate;
  repeatTime = (repeatTime * sampleRate) | 0;
  volume *= zzfxV;

  // generate waveform
  for (length = (attack + decay + sustain + release + delay) | 0; i < length; b[i++] = s * volume) {
    if (!(++crush % ((bitCrush * 100) | 0))) {
      // bit crush
      s = shape // wave shape
        ? shape > 1
          ? shape > 2
            ? shape > 3
              ? shape > 4
                ? (t / PI2) % 1 < shapeCurve / 2 // 5 square duty
                  ? 1
                  : -1
                : Math.sin(t ** 3) // 4 noise
              : Math.max(Math.min(Math.tan(t), 1), -1) // 3 tan
            : 1 - ((((2 * t) / PI2) % 2) + 2) % 2 // 2 saw
          : 1 - 4 * abs(Math.round(t / PI2) - t / PI2) // 1 triangle
        : Math.sin(t); // 0 sin

      s =
        (repeatTime
          ? 1 - tremolo + tremolo * Math.sin((PI2 * i) / repeatTime) // tremolo
          : 1) *
        (shape > 4 ? s : sign(s) * abs(s) ** shapeCurve) * // shape curve
        (i < attack
          ? i / attack // attack
          : i < attack + decay // decay
            ? 1 - ((i - attack) / decay) * (1 - sustainVolume) // decay falloff
            : i < attack + decay + sustain // sustain
              ? sustainVolume // sustain volume
              : i < length - delay // release
                ? ((length - i - delay) / release) * sustainVolume // release falloff
                : 0); // post release

      s = delay // delay
        ? s / 2 +
          (delay > i
            ? 0
            : ((i < length - delay ? 1 : (length - i) / delay) * // release delay
                (b[(i - delay) | 0] ?? 0)) /
              2 /
              volume) // sample delay
        : s;

      if (filter)
        // apply filter
        s = y1 = b2 * x2 + b1 * (x2 = x1) + b0 * (x1 = s) - a2 * y2 - a1 * (y2 = y1);
    }

    f = (frequency += slide += deltaSlide) * // frequency
      Math.cos(modulation * modOffset++); // modulation
    t += f + f * noise * Math.sin(i ** 5); // noise

    if (jump && ++jump > pitchJumpTime) {
      // pitch jump
      frequency += pitchJump; // apply pitch jump
      startFrequency += pitchJump; // also apply to start
      jump = 0; // stop pitch jump time
    }

    if (repeatTime && !(++repeat % repeatTime)) {
      // repeat
      frequency = startFrequency; // reset frequency
      slide = startSlide; // reset slide
      jump ||= 1; // reset pitch jump time
    }
  }

  return b;
}

/* ------------------------------------------------------------------------- *
 *  Vendored: ZzFXM song renderer.  MIT © Keith Clark & Frank Force.
 *  Do not refactor — keep faithful to upstream.
 * ------------------------------------------------------------------------- */
export function zzfxM(
  instruments: ZzfxInstrument[],
  patterns: ZzfxPattern[],
  sequence: number[],
  BPM = 125,
): [number[], number[]] {
  let instrumentParameters: number[] = [];
  let i = 0;
  let j = 0;
  let k = 0;
  let note = 0;
  let sample = 0;
  let patternChannel: number[] = [];
  let notFirstBeat = 0;
  let stop: number | boolean = 0;
  let instrument = 0;
  let attenuation = 0;
  let outSampleOffset = 0;
  let isSequenceEnd = 0;
  let sampleOffset = 0;
  let nextSampleOffset = 0;
  let sampleBuffer: number[] = [];
  const leftChannelBuffer: number[] = [];
  const rightChannelBuffer: number[] = [];
  let channelIndex = 0;
  let panning = 0;
  let hasMore = 1;
  const sampleCache: Record<string, number[]> = {};
  const beatLength = ((zzfxR / BPM) * 60) >> 2;
  // `zzfxG` has a fixed param list; the renderer applies a variable-length
  // instrument array to it, so view it through a rest signature for the spread.
  const genG = zzfxG as (...args: number[]) => number[];

  // for each channel in order until there are no more
  for (; hasMore; channelIndex++) {
    // reset current values
    sampleBuffer = [(hasMore = notFirstBeat = outSampleOffset = 0)];

    // for each pattern in sequence
    sequence.forEach((patternIndex, sequenceIndex) => {
      const pattern = patterns[patternIndex]!;
      // get pattern for current channel, use empty 1 note pattern if none found
      patternChannel = pattern[channelIndex] || [0, 0, 0];

      // check if there are more channels
      hasMore |= pattern[channelIndex] ? 1 : 0;

      // get next offset, use the length of first channel
      nextSampleOffset =
        outSampleOffset + (pattern[0]!.length - 2 - (notFirstBeat ? 0 : 1)) * beatLength;
      // for each beat in pattern, plus one extra if end of sequence
      isSequenceEnd = sequenceIndex === sequence.length - 1 ? 1 : 0;
      for (i = 2, k = outSampleOffset; i < patternChannel.length + isSequenceEnd; notFirstBeat = ++i) {
        // <channel-note>
        note = patternChannel[i] ?? 0;

        // stop if end, different instrument or new note
        stop =
          (i === patternChannel.length + isSequenceEnd - 1 && isSequenceEnd) ||
          ((instrument !== (patternChannel[0] || 0) ? 1 : 0) | note | 0);

        // fill buffer with samples for previous beat, most cpu intensive part
        for (
          j = 0;
          j < beatLength && notFirstBeat;
          // fade off attenuation at end of beat if stopping note, prevents clicking
          j++ > beatLength - 99 && stop ? (attenuation += (attenuation < 1 ? 1 : 0) / 99) : 0
        ) {
          // copy sample to stereo buffers with panning
          sample = ((1 - attenuation) * (sampleBuffer[sampleOffset++] ?? 0)) / 2 || 0;
          leftChannelBuffer[k] = (leftChannelBuffer[k] || 0) - sample * panning + sample;
          rightChannelBuffer[k] = (rightChannelBuffer[k++] || 0) + sample * panning + sample;
        }

        // set up for next note
        if (note) {
          // set attenuation
          attenuation = note % 1;
          panning = patternChannel[1] || 0;
          if ((note |= 0)) {
            // get cached sample
            instrument = patternChannel[(sampleOffset = 0)] || 0;
            const cacheKey = instrument + ',' + note;
            sampleBuffer =
              sampleCache[cacheKey] ||
              // add sample to cache
              (sampleCache[cacheKey] =
                ((instrumentParameters = [...instruments[instrument]!]),
                (instrumentParameters[2] = instrumentParameters[2]! * 2 ** ((note - 12) / 12)),
                // allow negative values to stop notes
                note > 0 ? genG(...instrumentParameters) : []));
          }
        }
      }

      // update the sample offset
      outSampleOffset = nextSampleOffset;
    });
  }

  return [leftChannelBuffer, rightChannelBuffer];
}

/**
 * Render a {@link ZzfxSong} to stereo PCM.
 *
 * Pure and DOM-free: the web shell wraps `left`/`right` in an `AudioBuffer`
 * (in a worker for the player, or on an `OfflineAudioContext` for a video music
 * bed); Node callers (ingest/generator scripts) use it to audition output.
 */
export function renderZzfxm(song: ZzfxSong): RenderedPcm {
  const [left, right] = zzfxM(song.instruments, song.patterns, song.sequence, song.bpm ?? 125);
  return {
    left: Float32Array.from(left),
    right: Float32Array.from(right),
    sampleRate: zzfxR,
  };
}
