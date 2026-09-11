// SPDX-License-Identifier: MPL-2.0
/**
 * Audio metadata tags for the muxed audio-only exports (plans/153, metadata-honour
 * plan 144 Wave WP-D). The mp3/m4a/aac/opus/ogg (flac later) containers get the
 * same ExportMeta the raster stampers embed, written through mediabunny's
 * `Output.setMetadataTags()` - one normalized tag shape, mediabunny maps it to
 * each container's native slot (MP4 udta, Ogg/FLAC Vorbis comments, ID3 for
 * mp3/adts, RIFF INFO for WAV).
 *
 * WAV is NOT routed here: its live path in export.ts already writes five RIFF
 * INFO fields via embedWavInfo (title/artist/comment/copyright/software) and
 * stays verbatim.
 *
 * PURE by design: no Date.now, no host, no I/O. The caller injects `date` (an
 * audio-only export is not in the byte-compared browser goldens, but the same
 * discipline keeps this trivially testable and keeps a stray clock read out of
 * any path that might later be compared). Empty ExportMeta fields ('' when the
 * user has no profile) are omitted so no blank tag is written.
 */
import type { ExportMeta } from '@lolly-tools/core/host-v1';
import type { MetadataTags } from 'mediabunny';

/**
 * Map an ExportMeta credit line to mediabunny's normalized tag object.
 *
 *   title   = the tool's name        (meta.tool)
 *   artist  = the author             (meta.author)
 *   album   = the software           (meta.software, "Lolly")
 *   comment = description · contact · rights   (see below)
 *   date    = injected export date    (omitted when not supplied)
 *
 * Rights (copyright/license) have NO normalized MetadataTags slot (mediabunny's
 * type carries title/artist/album/comment/date/… and a per-container `raw` map,
 * but no copyright field - a single normalized object can't name `raw` keys that
 * differ Ogg vs ID3 vs FLAC). So, as the WAV RIFF path joins copyright + license
 * into one ICOP string, we fold the same "copyright · license" line into the
 * `comment` here - format-agnostic and validateMetadataTags-safe (a plain string),
 * so the rights survive into every container instead of being dropped.
 */
export function buildAudioTags(meta: ExportMeta, date?: Date): MetadataTags {
  const rights = [meta.copyright, meta.license].filter(Boolean).join(' · ');
  const comment = [meta.description, meta.contact, rights].filter(Boolean).join(' · ');
  const tags: MetadataTags = {};
  if (meta.tool) tags.title = meta.tool;
  if (meta.author) tags.artist = meta.author;
  if (meta.software) tags.album = meta.software;
  if (comment) tags.comment = comment;
  if (date) tags.date = date;
  return tags;
}
