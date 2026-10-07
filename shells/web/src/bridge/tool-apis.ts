// SPDX-License-Identifier: MPL-2.0
/** Install pure tool capabilities on each host after their modules load. */
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { GeometryBackend } from './geometry-host.ts';
let toolApiModules: Promise<{
  color: HostV1['color']; geometry: typeof import('../../../../engine/src/geom-api.ts').makeGeomApi;
  connectors: HostV1['connectors'];
}> | null = null;
export async function installToolApis(host: HostV1, options: { geometryBackend?: GeometryBackend } = {}): Promise<void> {
  toolApiModules ??= Promise.all([
    import('../../../../engine/src/color-tools.ts'), import('../../../../engine/src/geom-api.ts'), import('../../../../engine/src/connectors.ts'),
  ]).then(([color, geometry, connectors]) => ({ color: color.makeColorApi(), geometry: geometry.makeGeomApi, connectors: connectors.makeConnectorsApi() }));
  try {
    const apis = await toolApiModules;
    if (options.geometryBackend !== undefined) await (await import('./geometry-host.ts')).installWebGeometryApi(host, options.geometryBackend);
    host.color ??= apis.color; host.geom ??= apis.geometry(); host.connectors ??= apis.connectors;
  } catch (error) {
    toolApiModules = null;
    if (options.geometryBackend !== undefined) throw error;
    host.log('warn', 'Could not install tool capabilities.', { message: error instanceof Error ? error.message : String(error) });
  }
}
