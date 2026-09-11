// SPDX-License-Identifier: MPL-2.0
/**
 * Share a user template as a `.lolly` file (plans/226 WP-6). The file carries a
 * `templates.json` part beside the session, so on the far side it registers as a
 * template rather than landing as a saved session. The Share dialog's File card and the
 * Projects Templates collection's "Share as .lolly" call this.
 *
 * Two payloads, one file, on purpose:
 *   - `templates.json` is the point: the recipient's Lolly adds the starting point to
 *     their own templates for that tool (lib/drop-router.ts importCarriedTemplates).
 *   - `session.json` is the template's values dressed as a document for that tool, so a
 *     build that predates the part - or a person who just wants to look at it - still
 *     opens something real instead of an empty editor. `minReader` therefore stays 1.
 *
 * The asset closure is collected the way views/tool-lolly-vehicle.ts collects it for a
 * live document: device-local uploads the values reference always travel, catalog art
 * travels as bytes, and brand-locked / licensed catalog content never does. There is no
 * canvas here, so the vehicle's two canvas-derived extras (the font receipt and the
 * thumbnail) are simply absent - a template has no render to report on.
 */

import { ENGINE_VERSION, decodeAssetVersion } from '@lolly/engine';
import type { AssetRef, HostV1 } from '@lolly-tools/core/host-v1';
import type { BeamAssetRecord } from './beam-pack.ts';
import { buildLollyFile, creatorFromProfile, type LollyLibraryAsset } from './lolly-pack.ts';
import { templateFileSlug } from './template-file.ts';
import type { UserTemplate } from './user-templates.ts';

/** The internal asset methods the closure needs. Every one is optional: `HostV1`'s public
 *  `assets` API declares none of them, and a shell that lacks them still produces a valid
 *  file - one whose device-local bytes travel by reference rather than not at all. */
interface TemplateShareAssets {
  get?(id: string, opts?: { format?: string; version?: string }): Promise<AssetRef>;
  _getUserRecord?(id: string, version?: string): Promise<BeamAssetRecord | null>;
  _getBlob?(id: string, opts?: { format?: string; version?: string }): Promise<Blob | null>;
  _exportUserAssets?(): Promise<readonly BeamAssetRecord[]>;
}

/** A catalog license that must NOT travel: proprietary / brand content. The same read
 *  views/tool-lolly-vehicle.ts and lib/design-system/brand-package.ts make - a template
 *  share has no licensed-content confirmation of its own, so here it is always a no. */
function isProprietaryLicense(license: unknown): boolean {
  const l = String(license ?? '').toLowerCase();
  return !!l && /proprietary|all-rights-reserved|licenseref|premiumbeat/.test(l);
}

/**
 * The template's seed dressed as a saved document for its tool: its values, plus the two
 * per-document keys `templateValuesFromSnapshot` strips (the tool stamp and the title).
 * Deep-copied, so the file can never alias the record still sitting in the profile.
 */
export function templateSessionOf(tpl: UserTemplate): Record<string, unknown> {
  const values = JSON.parse(JSON.stringify(tpl.values ?? {})) as Record<string, unknown>;
  return { ...values, __toolId: tpl.toolId, __label: tpl.name };
}

/** The suggested download name, `<toolId>-<slug>.lolly` (the `.json` export's twin). */
export function templateLollyName(tpl: UserTemplate): string {
  return `${tpl.toolId}-${templateFileSlug(tpl.name)}.lolly`;
}

/** Build and download a `.lolly` that carries `tpl` as a template. */
export async function shareTemplateAsLolly(host: HostV1, tpl: UserTemplate): Promise<void> {
  if (!tpl?.toolId || !tpl.name) throw new Error('This template is incomplete and cannot be shared.');
  const assets = host.assets as unknown as TemplateShareAssets;
  const appVersion = `Lolly ${ENGINE_VERSION}`;

  const resolveLibrary = async (id: string): Promise<LollyLibraryAsset | null> => {
    if (!assets._getBlob) return null;
    try {
      const dep = decodeAssetVersion(id);
      const blob = await assets._getBlob(dep.id, dep.pin);
      if (!blob) return null;
      const ref = await assets.get?.(dep.id, dep.pin).catch(() => null) ?? null;
      const meta = (ref?.meta ?? {}) as Record<string, unknown>;
      return {
        bytes: new Uint8Array(await blob.arrayBuffer()),
        mime: blob.type || '',
        type: ref?.type ?? 'raster',
        format: ref?.format ?? '',
        label: typeof meta.name === 'string' ? meta.name : id,
        licensed: meta.brandLock === true || isProprietaryLicense(meta.license),
      };
    } catch {
      return null;
    }
  };

  const profile = await host.profile.get().catch(() => null);
  const userAssets = await assets._exportUserAssets?.().catch(() => []) ?? [];
  const { blob } = await buildLollyFile({
    session: templateSessionOf(tpl),
    toolId: tpl.toolId,
    name: tpl.name,
    templates: [tpl],
    userAssets,
    ...(assets._getUserRecord ? { resolveUser: assets._getUserRecord.bind(assets) } : {}),
    resolveLibrary,
    // No licensed-content confirmation exists on this path, so brand-locked bytes stay
    // home and travel as resolve-locally refs, exactly as an unconfirmed session share does.
    creator: creatorFromProfile(profile, { appVersion }),
    appVersion,
    engineVersion: ENGINE_VERSION,
  });
  await host.export.file(blob, { filename: templateLollyName(tpl) });
}
