// SPDX-License-Identifier: MPL-2.0
import type { HostV1, TextOperation, TextToolResult } from '@lolly-tools/core/host-v1';
import type { Runtime } from '../../../../../engine/src/runtime.ts';
import type { CodeEditor } from '../../components/code-editor.ts';
import type { TextSource } from '../../lib/text-handoff.ts';
export interface TextContext {
  actions: {
    open(operation: TextOperation, adjust?: boolean): void;
    form(operation: TextOperation): void;
    run(
      operation: TextOperation,
      options?: Record<string, string | number | boolean>,
      sourceText?: string
    ): Promise<boolean>;
    all(): void;
    ai(task: 'synopsis' | 'rewrite' | 'explain-logs'): Promise<void>;
  };
  presentation: {
    markdown(): Promise<void>;
    logs(container: HTMLElement): void;
    inspect(container: HTMLElement): void;
  };
  root: HTMLElement;
  host: HostV1;
  runtime: Runtime;
  editor: CodeEditor;
  source: TextSource;
  operations: TextOperation[];
  abort: AbortController;
  activeJob: AbortController | null;
  aiAbort: (() => void) | null;
  result: {
    value: TextToolResult;
    start: number;
    end: number;
    revision: number;
    ai: boolean;
    operation: string;
  } | null;
  resultCleanup: (() => void) | null;
  write(id: string, value: string): void;
  status(message: string): void;
  resultReady(): void;
  focusText(): void;
  sync(): void;
  lastError: string;
  options: Map<string, Record<string, string | number | boolean>>;
}
export const query = <T extends HTMLElement>(ctx: TextContext, selector: string): T =>
  ctx.root.querySelector<T>(selector)!;

export function selectionForAction(ctx: TextContext): {
  start: number;
  end: number;
  text: string;
  revision: number;
} {
  const value = ctx.editor.document.value;
  const selected = value.start !== value.end;
  return {
    start: selected ? value.start : 0,
    end: selected ? value.end : value.text.length,
    text: selected ? value.text.slice(value.start, value.end) : value.text,
    revision: ctx.editor.document.revision,
  };
}
