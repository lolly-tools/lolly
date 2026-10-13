// SPDX-License-Identifier: MPL-2.0
import { ENGINE_VERSION, validateDocument } from '@lolly/engine';
import { exportTargetNode } from '../lib/export-target.ts';
import { designLiveEditor } from './design-live.ts';
import { designLiveContext } from './design-live-context.ts';
import { inputLiveEditor, liveInputState } from './input-live.ts';
import type { LiveEditor } from '../lib/live-agent.ts';
import type { ToolViewCtx } from './tool/context.ts';
import type { DesignCanvasPorts } from './design-ports.ts';
import { t, tRaw } from '../i18n.ts';

interface EditorPorts {
  documentId: string;
  desktop: boolean;
  canvas: HTMLElement;
  design?(): DesignCanvasPorts | null;
  size(): { width: number; height: number };
}

/** Shared by local pairing, desktop control and hosted invitations. Loaded on demand. */
export function toolAgentCapabilities(tview: ToolViewCtx, design?: DesignCanvasPorts | null): { adapter: 'layers' | 'inputs'; canEdit: boolean } {
  return { adapter: design ? 'layers' : 'inputs', canEdit: tview.collabHandle?.role !== 'observer' && (!!design || !!liveInputState(tview.tool.manifest, tview.runtime.getModel()).editableInputIds.length) };
}

export function toolAgentEditor(tview: ToolViewCtx, ports: EditorPorts): () => LiveEditor {
  return () => {
    const design = ports.design?.();
    const common = {
      documentId: ports.documentId, manifest: tview.tool.manifest, engine: ENGINE_VERSION,
      surface: ports.desktop ? 'desktop' as const : 'web' as const, runtime: tview.runtime, size: ports.size,
      history: { commit: tview.history.commitInputs, top: () => tview.inputHistory.peekUndo(), undo: () => tview.history.undoHistory() },
      readOnly: () => tview.collabHandle?.role === 'observer',
      label: (note: string, client?: string) => tRaw('{name}: {note}', { name: client || t('AI agent'), note }),
      exportSvg: () => tview.exporting.exportUnscaled(() => tview.runtime.export(exportTargetNode(ports.canvas) ?? ports.canvas, 'svg', { ...ports.size(), embedMeta: false, watermark: false }), { shutter: false }),
    };
    if (!design) return inputLiveEditor({ ...common, context: async () => {
      const { brief, designSystem, designVersion, themeSelection } = await designLiveContext(tview.host, []);
      return { brief, designSystem, designVersion, themeSelection };
    } });
    const snapshot = inputLiveEditor({ ...common, excludedInputIds: tview.runtime.getModel().map(input => input.id) });
    return { ...designLiveEditor({
      documentId: ports.documentId, context: () => designLiveContext(tview.host, design.fields),
      toolId: tview.tool.manifest.id, engine: ENGINE_VERSION, surface: ports.desktop ? 'desktop' : 'web',
      runtime: tview.runtime, blockId: design.model.blockId, fields: design.fields, assets: tview.host.assets,
      selection: () => design.selection.get(), size: ports.size,
      history: common.history, readOnly: common.readOnly, label: common.label,
      validateInputs: value => validateDocument({ kind: 'inputs', manifest: tview.tool.manifest, value }),
      exportSvg: common.exportSvg,
    }), adapter: 'layers', toolVersion: tview.tool.manifest.version, inputs: snapshot.inputs, revisionInputs: snapshot.revisionInputs };
  };
}
