// SPDX-License-Identifier: MPL-2.0
/**
 * Export provenance — the generic authorship record embedded into every exported
 * media file (platform-agnostic; no format/DOM knowledge here).
 *
 * The engine assembles these fields from the host profile + the tool manifest;
 * each shell's export bridge then maps them onto the format's native metadata
 * mechanism (PNG iTXt, JPEG EXIF, PDF info dict, SVG <metadata>, …). This is the
 * clean path from author → asset: provenance travels with the file, not the app.
 *
 * Scope: provenance — who/what made the file — PLUS user-asserted copyright/licence
 * when a tool's inputs supply them via `bindToMeta` (the artist declaring the IP of
 * their OWN work; see the embed-track-image tool). Those two are NEVER auto-derived
 * from the profile — Lolly won't assert ownership the user didn't state. Personal
 * fields (author/contact) appear only if the user filled in their profile; the
 * "Lolly" software/source tags are always stamped.
 */
import type { ExportMeta, Profile, ProfileAPI } from './bridge/host-v1.ts';

/** The slice of the host bridge this module needs: an optional profile source. */
export interface MetadataHost {
  profile?: Pick<ProfileAPI, 'get'>;
}

/** The slice of the tool manifest used for attribution. */
export interface MetadataManifest {
  id?: string;
  name?: string;
}

/** The slice of an input-model item buildExportMeta reads for bindToMeta merging. */
export interface MetadataInput {
  bindToMeta?: 'author' | 'contact' | 'description' | 'copyright' | 'license';
  value?: unknown;
}

export async function buildExportMeta(
  host: MetadataHost | null | undefined,
  manifest: MetadataManifest | null | undefined,
  profile?: Profile | null,
  inputs?: ReadonlyArray<MetadataInput> | null,
): Promise<ExportMeta> {
  // The runtime already resolved the profile at mount; callers pass it through to
  // avoid a redundant lookup. Fall back to fetching when omitted.
  let p: Profile = {};
  if (profile == null) {
    try { p = (await host?.profile?.get()) ?? {}; } catch { p = {}; }
  } else {
    p = profile;
  }

  const clean = (s: string | null | undefined): string => (s == null ? '' : String(s).trim());
  // Personal details are embedded only when the user has opted in
  // (Profile → "Use my details"). The platform/tool attribution always stays.
  const optedIn = p.useDetails === true;
  const author  = optedIn ? [clean(p.firstname), clean(p.lastname)].filter(Boolean).join(' ') : '';
  const contact = optedIn ? [clean(p.email), clean(p.phone)].filter(Boolean).join(' · ') : '';
  const tool    = clean(manifest?.name) || clean(manifest?.id);

  const description = ['Made with https://lolly.tools', tool && `: ${tool}`, author && `by ${author}`]
    .filter(Boolean).join(' ');

  const meta: ExportMeta = {
    software: 'Lolly',
    source: 'https://lolly.tools',
    tool,
    author,                                                   // '' if not opted in
    contact,                                                  // '' if none
    description,
  };

  // bindToMeta: a tool's own inputs supply/override provenance fields — the artist's
  // explicit author/copyright/licence declaration for their OWN work. Trimmed string
  // values; empty ones are skipped so a blank input never wipes a profile default.
  // copyright/license have no profile source, so they only ever arrive this way.
  if (inputs) {
    for (const i of inputs) {
      const field = i.bindToMeta;
      if (!field) continue;
      const v = clean(i.value == null ? '' : String(i.value));
      if (v) meta[field] = v;
    }
  }
  return meta;
}
