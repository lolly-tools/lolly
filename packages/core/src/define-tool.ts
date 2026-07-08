// SPDX-License-Identifier: MPL-2.0
/**
 * Typed authoring helpers. `defineTool` and `defineHooks` are identity functions —
 * they add zero runtime behaviour and exist purely so your editor type-checks a
 * manifest, or a hooks module, against the contract as you write it.
 */
import type { ToolManifest } from './manifest.ts';
import type { HostV1, MediaFrame, AudioLevel, ExportOpts } from './host-v1.ts';

/** Type-check a manifest object as you author it. Returns it unchanged. */
export function defineTool(manifest: ToolManifest): ToolManifest {
  return manifest;
}

/** One entry of the input model handed to every hook. */
export interface HookModelItem {
  id: string;
  value: unknown;
  [key: string]: unknown;
}

/** The lifecycle context every hook receives (mirrors the engine runtime). */
export interface HookContext {
  /** The current input model — one entry per declared input. */
  model: HookModelItem[];
  /** The capability bridge — the supported, portable API surface for hooks. */
  host: HostV1;
}

/**
 * What a hook may return. Keys matching a declared input `id` update that input's
 * value; any other key becomes a computed `extra` the template can reference
 * directly (e.g. QR module lists, chart data). Return nothing to make no changes.
 */
export type HookResult = Record<string, unknown> | void;

/** Context for the export-lifecycle hooks (`beforeExport` / `afterExport`). */
export interface ExportHookContext {
  /** The render target (a DOM node in shells that have one). */
  node: unknown;
  format: string;
  opts: ExportOpts & Record<string, unknown>;
  host: HostV1;
}

/** What an `exportFile` (on-device transform) hook must produce. */
export interface ExportFileResult {
  bytes: Uint8Array | ArrayBuffer;
  mime?: string;
  filename?: string;
}

/**
 * The lifecycle hooks a tool may export from its `hooks.js`. Every hook is
 * optional; declare the ones you implement in the manifest's `hooks` block too so
 * the host wires them. `onInit` runs once at mount; `onInput` runs per edit;
 * `onFrame`/`onLevel` are driven by the live camera / mic; the export hooks run
 * around export; `exportFile` is the on-device transform path (file in → bytes out).
 */
export interface ToolHooks {
  onInit?(ctx: HookContext): HookResult | Promise<HookResult>;
  onInput?(ctx: HookContext & { id: string; value: unknown }): HookResult | Promise<HookResult>;
  onFrame?(ctx: HookContext & { frame: MediaFrame }): void;
  onLevel?(ctx: HookContext & { level: AudioLevel }): void;
  beforeRender?(ctx: HookContext): HookResult | Promise<HookResult>;
  beforeExport?(ctx: ExportHookContext): void | Promise<void>;
  afterExport?(ctx: ExportHookContext): void | Promise<void>;
  exportFile?(ctx: HookContext & { opts: Record<string, unknown> }): ExportFileResult | Promise<ExportFileResult>;
}

/** Type-check a hooks module as you author it. Returns it unchanged. */
export function defineHooks(hooks: ToolHooks): ToolHooks {
  return hooks;
}
