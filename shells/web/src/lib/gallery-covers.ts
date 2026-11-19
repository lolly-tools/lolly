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
  /** What the bake was drawn from, for scripts/validate-catalog.ts. The gallery does not read this. */
  source?: { fingerprint: string };
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

/** The baked files that fit one visitor's context, read once for a whole gallery paint. */
export interface BakedCoverSet {
  /** The address of this look's baked file, or null to render the look live. */
  fileFor(tool: { id: string; version?: string }, index: number, templateId?: string): string | null;
}

/**
 * Resolve the visitor's context once: one token read, one hash and one manifest. A gallery
 * paint asks this before it queues any render, so a baked cover is a plain image the
 * browser loads by itself and never waits its turn behind a live render. Null means this
 * visitor gets no baked file at all (a colourway of their own, another design system, a
 * bake that is out of date), and every cover is rendered live.
 */
export async function bakedCoverSet(host: Pick<HostV1, 'tokens' | 'profile'>): Promise<BakedCoverSet | null> {
  if (typeof Image === 'undefined' || typeof crypto === 'undefined' || !crypto.subtle) return null;
  try {
    if (await newWorkTokenSelection(host as ColourwaySeedHost)) return null;
    const hash = await coverContextHash(await previewContextSignature(host));
    if (globalThis.__lollyBakeCovers) { globalThis.__lollyCoverContext = hash; return null; }
    const manifest = await loadManifest();
    if (manifest?.v !== 1 || !manifest.contexts?.[hash]) return null;
    return {
      fileFor(tool, index, templateId) {
        const file = pickBakedCover(manifest, hash, tool, index, templateId);
        return file ? instancePath(file) : null;
      },
    };
  } catch {
    return null;
  }
}

export async function bakedCover(
  host: Pick<HostV1, 'tokens' | 'profile'>,
  tool: { id: string; version?: string },
  index: number,
  templateId?: string,
): Promise<string | null> {
  const url = (await bakedCoverSet(host))?.fileFor(tool, index, templateId);
  return url && await decodes(url) ? url : null;
}
