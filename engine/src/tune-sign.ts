// SPDX-License-Identifier: MPL-2.0
/**
 * tune-sign.ts: sign a file the music generator made.
 *
 * tune-provenance.ts decides what such a file says about itself; this module writes
 * that statement twice, in the same words. First as the file's plain description, which
 * players and file inspectors show (tagTuneFile): the WAV's RIFF INFO comment (ICMT), or
 * the M4A's comment and description items (`©cmt`, `desc`). Then as the created step of
 * the signed Content Credentials: algorithmic media, described as made with Lolly's
 * music generator, with the style and the seed. The credential goes into the container
 * as the last byte operation, so its hash covers the description too. Nothing else is
 * added to the file.
 *
 * The caller picks the signer: an enrolled identity when there is one, else the
 * ephemeral on-device signer (`dates` without `signer`). Not on the engine barrel;
 * the shells import it by path.
 */
import { embedC2pa, C2PA_FORMATS } from './c2pa-containers.ts';
import type { EmbedOptions } from './c2pa.ts';
import { embedWavInfo } from './riff-meta.ts';
import { tuneCreatedAction, tuneDeclaration, type TuneTrackFacts } from './tune-provenance.ts';
import { embedMp4Meta } from './video-meta.ts';
import { ENGINE_VERSION } from './version.ts';

export interface TuneSignArgs {
  /** The track's display name, the credential's title. */
  name: string;
  facts: TuneTrackFacts;
  /** An enrolled identity's signer. Absent: the ephemeral on-device signer. */
  signer?: EmbedOptions['signer'];
  /** The signing window: an identity's certificate dates, else now to 30 days on. */
  dates?: EmbedOptions['dates'];
  /** `claim_generator_info.name`. Default 'Lolly'. */
  generator?: string;
}

/** True when the engine can embed a credential in this format. */
export function canSignTune(format: string): boolean {
  return C2PA_FORMATS.includes(format);
}

/** The software a tune file's plain tags record: the WAV writer's own default. */
const SOFTWARE = 'lolly.tools';

/**
 * The file's plain title and description: the declaration a reader sees without a
 * Content Credentials reader. WAV and M4A only; any other format comes back as it was.
 */
export function tagTuneFile(bytes: Uint8Array, format: string, args: Pick<TuneSignArgs, 'name' | 'facts'>): Uint8Array {
  const description = tuneDeclaration(args.facts);
  if (format === 'wav') return embedWavInfo(bytes, { title: args.name, comment: description, software: SOFTWARE });
  if (format === 'm4a') {
    return embedMp4Meta(bytes, { title: args.name, artist: '', date: '', comment: description, description, encoder: SOFTWARE, encodedBy: '', publisher: '' });
  }
  return bytes;
}

/**
 * Write the plain description, then embed the signed credential. Throws for a format
 * with no credential placer (see canSignTune), so a caller never reports a credential
 * that was not written.
 */
export async function signTuneFile(bytes: Uint8Array, format: string, args: TuneSignArgs): Promise<Uint8Array> {
  if (!canSignTune(format)) throw new Error(`${format.toUpperCase()} has no place for Content Credentials`);
  const options: EmbedOptions = {
    title: args.name,
    claimGenerator: 'Lolly lolly.tools',
    generatorInfo: { name: args.generator ?? 'Lolly', version: ENGINE_VERSION },
    actions: [tuneCreatedAction(args.facts)],
    ...(args.signer ? { signer: args.signer } : {}),
    // An enrolled identity brings its certificate window; the ephemeral signer
    // gets now to 30 days on.
    dates: args.dates ?? { notBefore: new Date(Date.now() - 60_000), notAfter: new Date(Date.now() + 30 * 86_400_000) },
  };
  return embedC2pa(tagTuneFile(bytes, format, args), format, options);
}
