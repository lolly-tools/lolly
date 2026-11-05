// SPDX-License-Identifier: MPL-2.0
/**
 * Covers baked at build time, so a first visit paints without rendering anything.
 *
 * `scripts/build-gallery-covers.ts` runs each profile's gallery and saves the first cover
 * of every tool, per theme, with a hash of the exact context it drew them in. A visitor in
 * that same context (the pack's design system, no colourway, no personal details) gets the
 * file. Anyone else, a stale tool version, or a missing file falls through to the live
 * render, so this can only change the timing, never what a cover shows.
 */
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { instanceFetch, instancePath } from './instance.ts';
import { previewContextSignature } from './preview-context.ts';
import { newWorkTokenSelection, type ColourwaySeedHost } from './colourway-seed.ts';

export const COVERS_MANIFEST_PATH = '/catalog/previews/covers.json';

interface BakedCoverFile { templateId?: string; file: string }

export interface BakedCoverManifest {
  v: 1;
  /** Context hash to the theme it was baked in. */
  contexts: Record<string, string>;
  covers: Record<string, { version: string } & Record<string, BakedCoverFile | string>>;
}

/** The file for this tool's first look in this context, or null to render it live. */
export function pickBakedCover(
  manifest: BakedCoverManifest | null | undefined,
  contextHash: string,
  tool: { id: string; version?: string },
  index: number,
  templateId?: string,
): string | null {
  if (manifest?.v !== 1) return null;
  const theme = manifest.contexts?.[contextHash];
  const entry = theme ? manifest.covers?.[tool.id] : undefined;
  if (!theme || !entry || entry.version !== tool.version) return null;
  const baked = entry[theme];
  if (!baked || typeof baked === 'string') return null;
  // A theme can hide earlier looks, so a template is matched by id. A default look has no id.
  return templateId ? (baked.templateId === templateId ? baked.file : null) : (index === 0 && !baked.templateId ? baked.file : null);
}

/** A short hash of the context signature, so the manifest never carries the tokens. */
export async function coverContextHash(signature: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(signature));
  return [...new Uint8Array(digest)].slice(0, 16).map((b) => b.toString(16).padStart(2, '0')).join('');
}

let manifestPromise: Promise<BakedCoverManifest | null> | null = null;
function loadManifest(): Promise<BakedCoverManifest | null> {
  manifestPromise ??= instanceFetch(instancePath(COVERS_MANIFEST_PATH))
    .then((r) => (r.ok ? r.json() as Promise<BakedCoverManifest> : null))
    .catch(() => null);
  return manifestPromise;
}

/** Decoded before it is offered, so a missing file falls back to a live render. */
async function decodes(url: string): Promise<boolean> {
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return true;
  } catch {
    return false;
  }
}

/** The build script reads the context from here, and skips any file already baked. */
declare global {
  // Set by scripts/build-gallery-covers.ts, which needs the hash a bake is drawn under.
  var __lollyBakeCovers: boolean | undefined;
  var __lollyCoverContext: string | undefined;
}

export async function bakedCover(
  host: Pick<HostV1, 'tokens' | 'profile'>,
  tool: { id: string; version?: string },
  index: number,
  templateId?: string,
): Promise<string | null> {
  if (typeof Image === 'undefined' || typeof crypto === 'undefined' || !crypto.subtle) return null;
  try {
    if (await newWorkTokenSelection(host as ColourwaySeedHost)) return null;
    const hash = await coverContextHash(await previewContextSignature(host));
    if (globalThis.__lollyBakeCovers) { globalThis.__lollyCoverContext = hash; return null; }
    const file = pickBakedCover(await loadManifest(), hash, tool, index, templateId);
    if (!file) return null;
    const url = instancePath(file);
    return await decodes(url) ? url : null;
  } catch {
    return null;
  }
}
