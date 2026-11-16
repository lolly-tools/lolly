// SPDX-License-Identifier: MPL-2.0
import type { ToolManifest } from '@lolly/engine';

export function toolCanvasRole(
  manifest: Pick<ToolManifest, 'id' | 'render'>,
  hasExportFile: boolean,
  hideSidebar: boolean,
): 'group' | 'img' {
  return hasExportFile || manifest.id === '3d-studio' || hideSidebar ||
    manifest.render.webPreview === true || manifest.render.sidebar === false || manifest.render.export === false
    ? 'group' : 'img';
}
