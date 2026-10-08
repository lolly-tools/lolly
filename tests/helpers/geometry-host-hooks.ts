// SPDX-License-Identifier: MPL-2.0
import type { LoadedTool } from '../../engine/src/loader.ts';
export const geometryHostCurve = 'M0 0 C60 200 200 -80 260 60';
export function geometryHostTool(hooksSource: string): LoadedTool {
  return { trustClass: 'builtin-verified', styles: null, hooksUrl: null, textTemplates: {}, textTemplateErrors: {},
    manifest: { id: 'geometry-host-test', name: 'Geometry', version: '1.0.0', engineVersion: '^1.0.0', status: 'official',
      render: { width: 10, height: 10, formats: ['svg'] }, inputs: [], hooks: { onInit: true } }, template: '{{{note}}}', hooksSource };
}
