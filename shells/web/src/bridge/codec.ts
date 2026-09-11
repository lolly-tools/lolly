// host.codec (engine 1.100) - deep image encoders for tools that compute their
// own float pixels. Thin: the maths is the engine's deep-encode (packExr /
// packRadiance / packPng + dither), imported deep-relative to keep those writers
// off the boot barrel (this module is a lazy facade, loaded only when a tool
// first asks for a deep export). The CLI wraps the SAME functions, so a float
// frame encodes to byte-identical output on either shell.
import type { CodecAPI, CodecFrame } from '@lolly-tools/core/host-v1';
import { encodeExr, encodeRadiance, encodePng16, encodeDither8 } from '../../../../engine/src/deep-encode.ts';
import type { DeepFrame } from '../../../../engine/src/pixels.ts';

const toDeep = (f: CodecFrame): DeepFrame =>
  ({ width: f.width, height: f.height, data: f.data, space: f.space ?? 'srgb-linear' });

export function createCodecAPI(): CodecAPI {
  return {
    png16: async (f, o) => encodePng16(toDeep(f), o),
    exr: async (f, o) => encodeExr(toDeep(f), o),
    radiance: async (f, o) => encodeRadiance(toDeep(f), o),
    dither8: async (f, o) => encodeDither8(toDeep(f), o),
  };
}
