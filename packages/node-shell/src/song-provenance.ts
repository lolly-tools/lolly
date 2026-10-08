// SPDX-License-Identifier: MPL-2.0
/**
 * What a Node-made file records about the rondocode songs it contains (plan 301).
 *
 * Andy approved on 2026-10-08 that an audio export holding a song carries a
 * machine-readable record of it: one C2PA source ingredient per distinct song, with
 * its name, the digest of its canonical bytes and how it was rendered (the `vm`
 * execution class, the renderer version and seed, the parts the render could not
 * play). The record is shown at the moment of export and named in the public docs
 * (docs/exporting.md, docs/cli-rendering.md, docs/mcp.md, docs/privacy.md).
 *
 * The CLI, the TUI and the MCP server all build the record here, from the run
 * reports rondo.ts already hands back, so the three say the same thing. What they
 * say afterwards is read off the written bytes (`recordedSongs`), never assumed
 * from the stamp having been attempted.
 */
import {
  isRondoSongIngredient, rondoCreatedAction, rondoDeclaration, rondoRenderFacts, rondoSongIngredient,
  uniqueRondoIngredients, verifyC2pa, type RondoRenderFacts,
} from '@lolly/engine';
import type { SourceIngredient } from '@lolly-tools/core/host-v1';
import type { ComputedAudioRun } from './rondo.ts';

/** The render facts of one song run: the `vm` path never synthesises singing. */
export function songRunFacts(run: ComputedAudioRun): RondoRenderFacts {
  return rondoRenderFacts(run.run, run.findings);
}

/** One source ingredient per distinct song the runs rendered. */
export function songIngredients(runs: readonly ComputedAudioRun[]): SourceIngredient[] {
  const out: SourceIngredient[] = [];
  for (const run of runs) {
    if (run.source !== 'rondocode' || !/^[0-9a-f]{64}$/.test(run.sourceDigest ?? '')) continue;
    out.push(rondoSongIngredient({
      name: run.name,
      hash: Uint8Array.from(Buffer.from(run.sourceDigest, 'hex')),
      facts: songRunFacts(run),
    }));
  }
  return uniqueRondoIngredients(out);
}

/**
 * The created step and RIFF comment for a file whose whole essence is one song's
 * render, or null when the runs hold more than one distinct song or none.
 */
export function singleSongEssence(runs: readonly ComputedAudioRun[]): {
  name: string;
  action: ReturnType<typeof rondoCreatedAction>;
  declaration: string;
} | null {
  const distinct = new Map<string, ComputedAudioRun>();
  for (const run of runs) if (run.source === 'rondocode') distinct.set(run.sourceDigest, run);
  if (distinct.size !== 1) return null;
  const run = [...distinct.values()][0]!;
  const facts = songRunFacts(run);
  return { name: run.name, action: rondoCreatedAction(facts), declaration: rondoDeclaration(facts) };
}

/**
 * The song titles the Content Credentials in `bytes` actually record, read back
 * from the file. Empty when there is no credential, it does not verify, or it
 * records no song.
 */
export async function recordedSongs(bytes: Uint8Array): Promise<string[]> {
  try {
    const report = await verifyC2pa(bytes);
    if (report.state !== 'valid') return [];
    return (report.ingredients ?? []).filter(isRondoSongIngredient).map((r) => r.title ?? '').filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * The song ingredients a file's own Content Credentials already record, as
 * ingredients to carry into a new credential. A shell that re-signs bytes another
 * renderer stamped (the MCP server over its browser tier) passes these on, so the
 * re-sign does not drop the songs the first credential named. Empty when there is
 * no valid credential or it records no song.
 */
export async function songIngredientsIn(bytes: Uint8Array): Promise<SourceIngredient[]> {
  try {
    const report = await verifyC2pa(bytes);
    if (report.state !== 'valid') return [];
    const out: SourceIngredient[] = [];
    for (const r of report.ingredients ?? []) {
      if (!isRondoSongIngredient(r) || !r.title) continue;
      out.push({
        credential: 'none',
        title: r.title,
        ...(r.format ? { format: r.format } : {}),
        relationship: 'componentOf',
        ...(r.instanceId ? { instanceId: r.instanceId } : {}),
        ...(r.description ? { description: r.description } : {}),
        ...(r.informationalUri ? { informationalUri: r.informationalUri } : {}),
        ...(r.digitalSourceType ? { digitalSourceType: r.digitalSourceType } : {}),
      });
    }
    return uniqueRondoIngredients(out);
  } catch {
    return [];
  }
}
