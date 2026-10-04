// SPDX-License-Identifier: MPL-2.0
/**
 * The open Design document as a `live-v1` editor (plans/289 D1): the adapter between
 * lib/live-agent.ts and the tool view. It reads the rows straight off the runtime (the
 * same `boxes` value `layerOperations` and `layerPatches` address in `lolly_render`),
 * writes through the tool view's transaction history so an agent edit is one labelled
 * undo step, and looks through the same export path Copy uses.
 *
 * Like the other Design chrome modules it takes ports, never free-canvas itself.
 */

import type { LiveEditor } from '../lib/live-agent.ts';

export interface DesignLiveDeps {
  toolId: string;
  engine: string;
  surface: 'desktop' | 'web';
  runtime: { getModel(): Array<{ id: string; value: unknown }> };
  /** The blocks input the editor draws (`boxes` in Design). */
  blockId: string;
  /** The blocks input's field definitions, for a new layer's defaults. */
  fields: unknown[];
  selection(): string[];
  size(): { width: number; height: number };
  history: {
    commit(values: Record<string, unknown>, label: string): Promise<void>;
    top(): object | null;
    undo(): void;
  };
  readOnly(): boolean;
  /** The history label for an agent edit, in the person's language. */
  label(note: string): string;
  /** The manifest's own input check (the engine's `validateDocument`), given `{ [blockId]: rows }`. */
  validateInputs?(values: Record<string, unknown>): { errors: Array<{ path: string; message: string }> };
  exportSvg(): Promise<Blob>;
}

export function designLiveEditor(d: DesignLiveDeps): LiveEditor {
  const rows = (): unknown[] => {
    const value = d.runtime.getModel().find((item) => item.id === d.blockId)?.value;
    return Array.isArray(value) ? structuredClone(value) : [];
  };
  return {
    tool: d.toolId,
    engine: d.engine,
    surface: d.surface,
    rows,
    size: d.size,
    selection: d.selection,
    fieldDefault(id, fallback) {
      const field = d.fields.find((f) => !!f && typeof f === 'object' && (f as { id?: unknown }).id === id) as { default?: unknown } | undefined;
      return field && 'default' in field ? field.default : fallback;
    },
    async commit(next, note) {
      const before = d.history.top();
      // The history records the step before the call first awaits, so reading the top
      // here, with no await in between, cannot pick up an edit the person made meanwhile.
      const pending = d.history.commit({ [d.blockId]: next }, d.label(note));
      const after = d.history.top();
      await pending;
      return after && after !== before ? after : null;
    },
    topEntry: () => d.history.top(),
    undo: () => d.history.undo(),
    async look() {
      const svg = await (await d.exportSvg()).text();
      const { width, height } = d.size();
      return { svg, width, height };
    },
    readOnly: d.readOnly,
    validate(changed) {
      if (!d.validateInputs || !changed.length) return [];
      const prefix = `/${d.blockId}/`;
      return d.validateInputs({ [d.blockId]: changed }).errors.map((e) => {
        const rest = e.path.startsWith(prefix) ? e.path.slice(prefix.length) : '';
        const [index, ...field] = rest.split('/');
        const row = changed[Number(index)];
        const id = row && typeof row === 'object' ? (row as { id?: unknown }).id : undefined;
        return id === undefined ? `${e.path}: ${e.message}` : `layer "${String(id)}"${field.length ? ` ${field.join('/')}` : ''}: ${e.message}`;
      });
    },
  };
}
