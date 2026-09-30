// SPDX-License-Identifier: MPL-2.0
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { t } from '../../i18n.ts';
import { ENGINE_VERSION } from '../../../../../engine/src/version.ts';
import { createDraftHost } from './draft-host.ts';
import { fetchTemplateSeed } from '../template-source.ts';
import { renderRowToBlob, getTool } from '../../pro/render-export.ts';

/** No shared compose cache: every result belongs to one supplied draft. */
export async function renderReferencePoster(base: HostV1, doc: unknown, theme: string, signal: AbortSignal) {
  signal.throwIfAborted();
  const [values, tool] = await Promise.all([fetchTemplateSeed('design', 'poster'), getTool('design')]);
  if (!values) throw new Error('Poster template unavailable');
  signal.throwIfAborted();
  // The poster owns a paper surface. Design's default transparent export would
  // clear that surface when the first frame itself is the export target.
  values.transparentBg = false;
  const host = createDraftHost(base, doc, theme);
  if (Array.isArray(values.boxes)) values.boxes = values.boxes.map(box => {
    if (!box || typeof box !== 'object' || Array.isArray(box) || !('id' in box)) return box;
    return { ...box, ...(box.id === 'title' ? { text: t('Make room for your next idea.') } : box.id === 'body' ? { text: t('A fresh direction, made with your colours.') } : {}) };
  });
  const fontStack = getComputedStyle(document.documentElement).getPropertyValue('--font-brand');
  const render = host.export.render;
  host.export.render = (node, format, options) => {
    if (node instanceof HTMLElement) node.style.setProperty('--font-brand', fontStack);
    return render(node, format, options);
  };
  const dependency = { document: doc, theme, values, tool: { id: tool.manifest.id, version: tool.manifest.version }, engine: ENGINE_VERSION, fontStack };
  const bytes = new TextEncoder().encode(JSON.stringify(dependency));
  const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(v => v.toString(16).padStart(2, '0')).join('');
  const result = await renderRowToBlob({ toolId: 'design', values }, host, {
    format: 'png', width: 960, height: 540, thumbnail: true, previewPage: true,
    watermark: false, embedMeta: false, c2pa: false, imprint: false, signal,
  });
  signal.throwIfAborted();
  return { blob: result.blob, digest, tool: dependency.tool, engine: ENGINE_VERSION, theme, format: 'png', template: 'poster', fontStack, coverage: 'preview-only' as const, unchecked: ['glyph coverage', 'font byte identity', 'layout constraints', 'brand rules'] };
}
