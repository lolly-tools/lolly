// SPDX-License-Identifier: MPL-2.0
import { expandDerivedFormats } from '@lolly/engine';
import type { ToolManifest } from '../../../../engine/src/loader.ts';
import { fmtLabel, keepFormat } from '../lib/export-format-info.ts';
import { wireFormatPicker } from '../components/export-format-picker.ts';
import { getExportPolicy } from '../lib/export-policy.ts';
import { batchCanRender } from './batch-render-format.ts';

interface FormatSource { id: string; formats?: readonly string[] }
interface FormatState { format: string; rows: { manifest: ToolManifest | null }[] }

/** The catalog supplies the full menu; loaded manifests add tool-owned producers. */
export function batchFormats(tools: readonly FormatSource[], state: FormatState, codec: boolean): string[] {
  const formats = new Set<string>(['png']);
  const loaded = new Map(state.rows.flatMap(row => row.manifest ? [[row.manifest.id, row.manifest] as const] : []));
  for (const source of [...tools, ...[...loaded.values()].map(m => ({ id: m.id, formats: m.render.formats }))]) {
    const manifest = loaded.get(source.id);
    const declared = manifest?.render.formats ?? expandDerivedFormats([...(source.formats ?? [])]);
    const allowed = getExportPolicy()?.formatsFor(source.id);
    const supported = declared.filter(f => batchCanRender(f) && keepFormat(f, codec && !!manifest?.hooks?.exportStill));
    const narrowed = allowed ? supported.filter(f => allowed.includes(f)) : supported;
    for (const f of narrowed.length ? narrowed : supported) formats.add(f === 'jpeg' ? 'jpg' : f);
  }
  formats.add(state.format);
  return [...formats];
}

export function mountBatchFormats(root: HTMLElement, tools: readonly FormatSource[], state: FormatState, codec: boolean) {
  const select = root.querySelector<HTMLSelectElement>('#pro-format')!;
  const picker = wireFormatPicker(root, select, fmtLabel)!;
  let previous = '';
  return {
    refresh(): void {
      const formats = batchFormats(tools, state, codec);
      const signature = JSON.stringify([formats, state.format]);
      if (signature === previous) return;
      previous = signature;
      select.replaceChildren(...formats.map(f => new Option(fmtLabel(f), f)));
      select.value = state.format;
      picker.refresh(formats, state.format);
    },
    destroy(): void { picker.destroy(); },
  };
}
