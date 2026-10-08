// SPDX-License-Identifier: MPL-2.0
/**
 * What a web export records about the rondocode songs it holds (plan 301).
 *
 * Andy approved on 2026-10-08 that an audio export holding a song carries a
 * machine-readable record of it: one C2PA source ingredient per distinct song, with
 * its name, the digest of its canonical bytes and how it was rendered (the `vm`
 * execution class, the renderer version and seed, and the parts the render could not
 * play). Two rules come with that approval, and this module serves both:
 *
 *   - VISIBLE AT EXPORT. The export sheet says, before the file is made, which songs
 *     the credential will record (`exportSongNames`, read by
 *     views/tool-actions/notes.ts). After the export it says only what a reading of
 *     the delivered bytes found (`recordedSongNames`).
 *   - NAMED IN THE DOCS. docs/exporting.md and docs/privacy.md describe the record.
 *
 * Only a file that carries sound holds a song. A still image drawn from a song's
 * waveform does not, so it records none.
 *
 * The ingredient itself is the engine's (engine/src/rondo-provenance.ts), so the web
 * shell, the CLI and the MCP server write the same record. Nothing here runs a song:
 * the facts come from a render lib/rondo-render.ts already made.
 */
import type { SourceIngredient } from '@lolly-tools/core/host-v1';
import { rondoSourceBytes } from '../../../../engine/src/rondo-source.ts';
import { isRondoUrl, MAX_RONDO_SNIFF_BYTES, sniffRondoSource } from './media-source.ts';
import type { RondoFinding, RondoRunInfo, RondoSong } from './rondo-render.ts';

/** The renderer version a run reports, in the form the ingredient records (`<commit 12>+lolly.<adapter>`). */
export function rondoRunVersion(run: Pick<RondoRunInfo, 'upstream' | 'adapter'>): string {
  return `${run.upstream.slice(0, 12)}+lolly.${run.adapter}`;
}

/** SHA-256 of a song's canonical `.rondo.json` bytes. */
async function songDigest(song: RondoSong): Promise<Uint8Array> {
  const bytes = rondoSourceBytes({
    schemaVersion: 1, format: 'rondocode', name: song.name ?? 'Untitled song', lang: song.lang, code: song.code,
  });
  return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as BufferSource));
}

/**
 * The C2PA source ingredient for one song an export holds, from the render that
 * put it there. The `vm` path never synthesises singing, so the facts carry the
 * silent parts and no sung parts.
 */
export async function songIngredient(
  song: RondoSong,
  render: { run: RondoRunInfo; findings: readonly RondoFinding[] },
): Promise<SourceIngredient> {
  const { rondoRenderFacts, rondoSongIngredient } = await import('../../../../engine/src/rondo-provenance.ts');
  return rondoSongIngredient({
    name: song.name ?? 'Untitled song',
    hash: await songDigest(song),
    facts: rondoRenderFacts({
      executionClass: render.run.executionClass,
      version: rondoRunVersion(render.run),
      seed: render.run.seed,
    }, render.findings),
  });
}

/** Add song ingredients to a list, one per song (by digest). */
export function addSongIngredients(into: SourceIngredient[], more: readonly SourceIngredient[]): void {
  for (const ing of more) {
    if (ing.instanceId && into.some((have) => have.instanceId === ing.instanceId)) continue;
    into.push(ing);
  }
}

// ── which songs an export will hold ──────────────────────────────────────────

/**
 * Read the song at a media url, without running it, or null when the url is not
 * a song. A share link is decoded in place; a song file path is fetched; a `blob:`
 * or `data:` url (an uploaded song) is read only when it is small enough to be one.
 * Any other url is media, and is not fetched.
 */
export async function songAt(url: string): Promise<RondoSong | null> {
  const r = await import('./rondo-render.ts');
  try {
    if (isRondoUrl(url)) return await r.songFromUrl(url);
    if (!/^(blob|data):/i.test(url)) return null;
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    if (blob.size < 2 || blob.size > MAX_RONDO_SNIFF_BYTES) return null;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    return sniffRondoSource(bytes) ? r.songFromBytes(bytes) : null;
  } catch {
    return null;
  }
}

/**
 * The songs a timeline's audio boxes hold: the boxes the export mix will play
 * (not muted, not struck through, with a length), read in timeline order. Mirrors
 * the mix in bridge/sequence-render.ts, which records the same songs as it renders
 * them.
 */
export async function timelineSongs(root: Element): Promise<RondoSong[]> {
  const { parseSequenceStage } = await import('../bridge/sequence-plan.ts');
  const stage = parseSequenceStage(root as HTMLElement);
  if (!stage) return [];
  const seen = new Set<string>();
  const out: RondoSong[] = [];
  for (const L of stage.layers) {
    if (L.kind !== 'audio' || L.mute || L.ignored || !(L.durMs > 0)) continue;
    const marker = L.el.matches?.('[data-audio-src]') ? L.el : L.el.querySelector?.('[data-audio-src]');
    const src = marker?.getAttribute('data-audio-src') ?? '';
    if (!src || seen.has(src)) continue;
    seen.add(src);
    const song = await songAt(src);
    if (song) out.push(song);
  }
  return out;
}

/** Song names, once each, in order. */
export function distinctNames(songs: readonly (RondoSong | null | undefined)[]): string[] {
  const out: string[] = [];
  for (const s of songs) {
    const name = (s?.name ?? '').trim() || 'Untitled song';
    if (s && !out.includes(name)) out.push(name);
  }
  return out;
}

// ── what the delivered file records ──────────────────────────────────────────

/** Largest file read back to confirm the record. Past it the record is not checked. */
export const MAX_READBACK_BYTES = 512 * 1024 * 1024;

/**
 * The song titles the delivered file's Content Credentials record, read from its
 * bytes. `null` when the file was too large to read back here; an empty list when
 * it holds no valid credential or the credential records no song.
 */
export async function recordedSongNames(blob: Blob): Promise<string[] | null> {
  if (blob.size > MAX_READBACK_BYTES) return null;
  try {
    const [{ verifyC2pa }, { isRondoSongIngredient }] = await Promise.all([
      import('../../../../engine/src/c2pa-verify.ts'),
      import('../../../../engine/src/rondo-provenance.ts'),
    ]);
    const report = await verifyC2pa(new Uint8Array(await blob.arrayBuffer()));
    if (report.state !== 'valid') return [];
    return (report.ingredients ?? []).filter(isRondoSongIngredient).map((r) => r.title ?? '').filter(Boolean);
  } catch {
    return [];
  }
}
