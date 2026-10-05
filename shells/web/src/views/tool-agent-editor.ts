// SPDX-License-Identifier: MPL-2.0
import { ENGINE_VERSION, validateDocument } from '@lolly/engine';
import { exportTargetNode } from '../lib/export-target.ts';
import { designLiveEditor } from './design-live.ts';
import { designLiveContext } from './design-live-context.ts';
import type { ToolViewCtx } from './tool/context.ts';
import type { DesignCanvasPorts } from './design-ports.ts';
import { t, tRaw } from '../i18n.ts';

interface EditorPorts {
  documentId: string;
  desktop: boolean;
  canvas: HTMLElement;
  design(): DesignCanvasPorts;
  size(): { width: number; height: number };
}

/** Shared by local pairing, desktop control and hosted invitations. Loaded on demand. */
export function toolAgentEditor(tview: ToolViewCtx, ports: EditorPorts): () => ReturnType<typeof designLiveEditor> {
  return () => {
    const design = ports.design();
    return designLiveEditor({
      documentId: ports.documentId, context: () => designLiveContext(tview.host, design.fields),
      toolId: tview.tool.manifest.id, engine: ENGINE_VERSION, surface: ports.desktop ? 'desktop' : 'web',
      runtime: tview.runtime, blockId: design.model.blockId, fields: design.fields,
      selection: () => design.selection.get(), size: ports.size,
      history: { commit: tview.history.commitInputs, top: () => tview.inputHistory.peekUndo(), undo: () => tview.history.undoHistory() },
      readOnly: () => tview.collabHandle?.role === 'observer',
      label: (note, client) => tRaw('{name}: {note}', { name: client || t('AI agent'), note }),
      validateInputs: value => validateDocument({ kind: 'inputs', manifest: tview.tool.manifest, value }),
      exportSvg: () => tview.exporting.exportUnscaled(() => tview.runtime.export(exportTargetNode(ports.canvas) ?? ports.canvas, 'svg', { ...ports.size(), embedMeta: false, watermark: false }), { shutter: false }),
    });
  };
}
