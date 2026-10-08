// SPDX-License-Identifier: MPL-2.0
/** Compile authored documents through the shared structural exporters. */
import type { ExportOpts, HostV1 } from '@lolly-tools/core/host-v1';

export async function renderStructuralExport(format: 'idml' | 'premiere-xml' | 'lottie', opts: ExportOpts, host: HostV1 | null | undefined): Promise<Blob> {
  if (!host) throw new Error(`${format} export needs the asset host.`);
  switch (format) {
    case 'idml': return (await import('../../../../engine/src/design-idml.ts')).exportDesignIdml(opts, host);
    case 'premiere-xml': return (await import('../../../../engine/src/design-premiere.ts')).exportDesignPremiere(opts, host);
    case 'lottie': return (await import('../../../../engine/src/design-lottie.ts')).exportDesignLottie(opts, host);
  }
}
