// SPDX-License-Identifier: MPL-2.0
/**
 * The shared Content-Credentials payload for a Node-shell export — the "what was this
 * made from / where / when / how big" record matching the web shell's
 * tools.lolly.export enrichment, so a CLI- or TUI-made asset inspects as richly as a
 * browser-made one. Author details ride along only with the profile's explicit
 * `useDetails` opt-in (same gate as the web shell). Ephemeral on-device signing only —
 * verifiers report it unverified; the enrolled-identity path is a browser feature.
 */
import { summarizeInputs, ENGINE_VERSION } from '@lolly/engine';
import type { embedC2pa } from '@lolly/engine';
import type { Profile } from '@lolly-tools/core/host-v1';

/** The (unexported-by-name) options bag `embedC2pa` accepts. */
export type ExportC2paOpts = NonNullable<Parameters<typeof embedC2pa>[2]>;

export interface BuildExportC2paOpts {
  /** Which shell/service produced the bytes — lands in the environment assertion.
   *  'build' covers the generated-media pipeline (OG cards, previews, thumbnails). */
  surface: 'cli' | 'tui' | 'mcp' | 'docs' | 'build';
  manifest: { id: string; name?: string };
  /** The runtime's input model (`runtime.getModel()`) — digested via summarizeInputs. */
  model: Parameters<typeof summarizeInputs>[0];
  format: string;
  /** Requested output dimensions, if any (values in `unit`, px default). */
  dims?: { width?: number | null; height?: number | null; unit?: string | null; dpi?: number | null };
  /** Credential validity window in days (URL mode's `c2pa=N`; default 30). */
  days?: number | null;
  profile?: Profile;
}

/** Build the embedC2pa options for a shell export, INCLUDING author from the profile. */
export function buildExportC2paOpts(o: BuildExportC2paOpts): ExportC2paOpts {
  const { surface, manifest, model, format, dims = {}, profile = {} } = o;
  const days = o.days ?? 30;
  const name = manifest.name || manifest.id;
  const inputs = summarizeInputs(model);
  const unit = dims.unit || 'px';
  const sizeLine = (typeof dims.width === 'number' && dims.width > 0 && typeof dims.height === 'number' && dims.height > 0)
    ? (unit !== 'px' ? `${dims.width} × ${dims.height} ${unit} @ ${dims.dpi || 300} DPI` : `${dims.width} × ${dims.height} px`)
    : undefined;
  return {
    title: name,
    claimGenerator: 'Lolly lolly.tools',
    generatorInfo: { name: 'Lolly', version: ENGINE_VERSION },
    environment: {
      surface, engine: `node ${process.version}`, os: process.platform,
      format, tool: name,
      date: new Date().toISOString(),
      ...(sizeLine ? { dimensions: sizeLine } : {}),
      ...(Object.keys(inputs).length ? { inputs } : {}),
    },
    ...(profile.useDetails === true && profile.firstname
      ? { author: { name: [profile.firstname, profile.lastname].filter(Boolean).join(' '), ...(profile.email ? { email: profile.email } : {}) } }
      : {}),
    dates: { notBefore: new Date(Date.now() - 60_000), notAfter: new Date(Date.now() + days * 86_400_000) },
  };
}
