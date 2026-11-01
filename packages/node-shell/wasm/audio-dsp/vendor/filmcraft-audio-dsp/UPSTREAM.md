# FilmCraft audio DSP

Source: https://github.com/storytold/filmcraft/tree/9c6d66114c71179f66d21933b6bf6b88311adf46/crates/audio-dsp
Commit: 9c6d66114c71179f66d21933b6bf6b88311adf46
Licence: MIT OR Apache-2.0. The upstream licence and notice files are retained here.

Source files (`src/`) and the README are unchanged. Lolly replaces the
workspace-inherited Cargo metadata with a standalone manifest, drops the
`filmcraft-testkit` dev-dependency, and does not copy
`tests/loudness_oracle.rs`, which needs that testkit and an ffmpeg binary.
Lolly's own tests under `packages/node-shell/wasm/audio-dsp/src/lib.rs` and
`tests/audio-dsp.test.ts` cover the cases that need neither.
No application UI, branding, fonts, sounds or test media are included.
The NOTICE keeps only the copyright and licence paragraph. The upstream third-party
section covers fonts and icons in the FilmCraft application, none of which is included here.

## Provenance statement and its limits

The upstream README states the crate is clean-room: written from the public
standards (ITU-R BS.1770-4, EBU R128, Tech 3341 and Tech 3342) and textbook DSP
(RBJ cookbook biquads, a Householder feedback delay network, a phase vocoder,
spectral subtraction with the statistical late-reverberation model). Lolly has
not independently audited that claim. The effect names in the registry follow
Adobe Premiere Pro's audio effect set (DeNoise, DeHum, DeEsser, DeReverb,
Automatic Click Remover). Lolly uses the names only as internal ids and shows its
own wording.

## Measured upstream accuracy

Upstream records the loudness meter as oracle-tested against ffmpeg `ebur128`:
momentary and short-term within 0.0005 LU, integrated within 0.007 LU, loudness
range within 0.04 LU and true peak within 0.045 dB. Lolly cannot re-run that
oracle in ordinary tests (it needs ffmpeg), so `tests/audio-dsp.test.ts` pins
analytic cases instead and the README of this module records a one-off ffmpeg
comparison.

## Unmeasured quality

Spectral gating (DeNoise) and late-reverb suppression (DeReverb) can leave
"musical noise" on non-stationary backgrounds. Upstream publishes dB figures on
synthetic signals only; quality on real speech is a listening judgement.
