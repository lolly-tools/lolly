// SPDX-License-Identifier: MPL-2.0
/**
 * tune-sign.ts: sign a file the music generator made.
 *
 * tune-provenance.ts decides what such a file says about itself; this module writes
 * that statement twice, in the same words. First as the file's plain description, which
 * players and file inspectors show (tagTuneFile): the WAV's RIFF INFO comment (ICMT), or
 * the M4A's comment and description items (`©cmt`, `desc`). Then as the created step of
 * the signed Content Credentials: algorithmic media, described as made with Lolly's
 * music generator, with the style and the seed.
 *
 * The licence the music is offered under (CC BY 4.0) and the credit it asks for travel
 * the same way (Andy, 2026-11-15). In the plain tags: the licence statement in the
 * copyright field (the WAV's ICOP, the M4A's `cprt`), and an XMP packet with the terms
 * in words (`xmpRights:UsageTerms`), the terms page (`xmpRights:WebStatement`,
 * `cc:license`), the party to credit (`cc:attributionName`, `cc:attributionURL`) and the
 * credit line (`photoshop:Credit`), in the WAV's `_PMX` chunk or the M4A's XMP `uuid`
 * box. In the credential's `cawg.metadata` assertion: the statement as `dc:rights`, the
 * same terms page, party and credit line. The credential goes into the container as
 * the last byte operation, so its hash covers every tag. Nothing else is added.
 *
 * The caller picks the signer: an enrolled identity when there is one, else the
 * ephemeral on-device signer (`dates` without `signer`). Not on the engine barrel;
 * the shells import it by path.
 */
import { embedC2pa, C2PA_FORMATS } from './c2pa-containers.ts';
import type { EmbedOptions } from './c2pa.ts';
import { embedWavInfo, embedWavXmp } from './riff-meta.ts';
import {
  TUNE_ATTRIBUTION_NAME, TUNE_CREDIT, TUNE_CREDIT_URL, TUNE_LICENCE, TUNE_LICENCE_STATEMENT,
  tuneCreatedAction, tuneDeclaration, type TuneTrackFacts,
} from './tune-provenance.ts';
import { embedMp4Meta, embedMp4Xmp } from './video-meta.ts';
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
 * The XMP packet a tune file carries: the licence's terms and the credit, nothing
 * else. Every value is a fixed string of this module, so nothing needs escaping.
 */
export function tuneLicenceXmp(): string {
  return '<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>'
    + '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">'
    + '<rdf:Description rdf:about="" xmlns:xmpRights="http://ns.adobe.com/xap/1.0/rights/"'
    + ' xmlns:cc="http://creativecommons.org/ns#" xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/">'
    + `<xmpRights:UsageTerms><rdf:Alt><rdf:li xml:lang="x-default">${TUNE_LICENCE_STATEMENT}</rdf:li></rdf:Alt></xmpRights:UsageTerms>`
    + `<xmpRights:WebStatement>${TUNE_LICENCE.url}</xmpRights:WebStatement>`
    + `<cc:license rdf:resource="${TUNE_LICENCE.url}"/>`
    + `<cc:attributionName>${TUNE_ATTRIBUTION_NAME}</cc:attributionName>`
    + `<cc:attributionURL rdf:resource="${TUNE_CREDIT_URL}"/>`
    + `<photoshop:Credit>${TUNE_CREDIT}</photoshop:Credit>`
    + '</rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="r"?>';
}

/**
 * The file's plain tags: its title, the declaration as its description, the licence
 * statement as its copyright notice, and the XMP packet (tuneLicenceXmp), all of
 * which a reader sees without a Content Credentials reader. WAV and M4A only; any
 * other format comes back as it was.
 */
export function tagTuneFile(bytes: Uint8Array, format: string, args: Pick<TuneSignArgs, 'name' | 'facts'>): Uint8Array {
  const description = tuneDeclaration(args.facts);
  if (format === 'wav') {
    return embedWavXmp(embedWavInfo(bytes, { title: args.name, comment: description, copyright: TUNE_LICENCE_STATEMENT, software: SOFTWARE }), tuneLicenceXmp());
  }
  if (format === 'm4a') {
    const tagged = embedMp4Meta(bytes, { title: args.name, artist: '', date: '', comment: description, description, copyright: TUNE_LICENCE_STATEMENT, encoder: SOFTWARE, encodedBy: '', publisher: '' });
    return embedMp4Xmp(tagged, tuneLicenceXmp());
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
    // The licence and the credit, in the credential's own metadata (cawg.metadata).
    rights: TUNE_LICENCE_STATEMENT,
    licence: { url: TUNE_LICENCE.url, attributionName: TUNE_ATTRIBUTION_NAME, attributionUrl: TUNE_CREDIT_URL, credit: TUNE_CREDIT },
    ...(args.signer ? { signer: args.signer } : {}),
    // An enrolled identity brings its certificate window; the ephemeral signer
    // gets now to 30 days on.
    dates: args.dates ?? { notBefore: new Date(Date.now() - 60_000), notAfter: new Date(Date.now() + 30 * 86_400_000) },
  };
  return embedC2pa(tagTuneFile(bytes, format, args), format, options);
}
