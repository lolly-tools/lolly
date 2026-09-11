// SPDX-License-Identifier: MPL-2.0
/**
 * Export an app-owned, deterministic surface as a Penpot file.
 *
 * This is deliberately separate from tool export: callers opt in with an
 * explicit DOM root and name, so browser chrome and private/current data cannot
 * leak by accident. `renderPenpot` already carries the active brand plus the
 * Lolly UI token document; unsupported DOM paints retain its fidelity-first SVG
 * fallback rather than becoming a misleading pseudo-component.
 */
import type { HostV1 } from '@lolly-tools/core/host-v1';

export interface AppSurfaceExportOptions {
  /** Human-readable Penpot file name and provenance label. */
  name: string;
  /** Stable, filesystem-safe basename without the extension. */
  filename: string;
  /** Explicit canvas backdrop; absent preserves transparent/vector behaviour. */
  background?: string;
}

export async function exportAppSurface(
  host: HostV1, node: Element, { name, filename, background }: AppSurfaceExportOptions,
): Promise<void> {
  if (!node.isConnected) throw new Error('The requested app surface is no longer mounted.');
  // Both imports are action-lazy: the components library remains a light
  // documentation route until someone actually asks for an archive.
  const [{ renderPenpot }, { buildExportMeta }] = await Promise.all([
    import('../bridge/export-penpot.ts'), import('@lolly/engine'),
  ]);
  const meta = await buildExportMeta(host, { name });
  const blob = await renderPenpot(node, { background, meta });
  await host.export.download(blob, `${filename}.penpot`);
}
