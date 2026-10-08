// SPDX-License-Identifier: MPL-2.0
/**
 * Chromium launch flags that give an automated browser a WebGPU adapter (plan 295).
 *
 * The web shell does not start without a WebGPU adapter and device, and a launched
 * Chromium offers neither by default. `--enable-unsafe-webgpu` turns the API on. On a
 * machine with no usable GPU (a Linux server, a container, a CI runner) the only
 * adapter is SwiftShader, Chromium's built-in software Vulkan, and
 * `--use-webgpu-adapter=swiftshader` is what makes `requestAdapter()` return that adapter.
 *
 * Every launcher that boots the shell takes its flags from here rather than spelling
 * them out: the CLI and TUI browser tier (browsers.ts), the MCP renderer
 * (services/mcp/src/render.ts), the maintainer scripts that drive the shell, and the
 * test preload (tests/browser-gpu.ts). A copy that drifted is how a launcher ends up
 * working on a developer's Mac and showing the unsupported-environment card on Linux.
 */

/** WebGPU on, with SwiftShader as its adapter. The same pair CI's browser tests use. */
export const SOFTWARE_WEBGPU_ARGS: readonly string[] = Object.freeze([
  '--enable-unsafe-webgpu',
  '--use-webgpu-adapter=swiftshader',
]);

export type WebGpuGraphics = 'software' | 'auto';

/**
 * The flags for one launch. `software` (the default) always names SwiftShader: the
 * same adapter, and so the same GPU results, on every machine, including one with no
 * GPU. `auto` keeps the machine's own adapter where the platform reliably offers one
 * (Metal on macOS, Direct3D on Windows) and names SwiftShader on Linux, where a
 * headless or GPU-less host commonly has no hardware adapter at all.
 */
export function webGpuLaunchArgs(graphics: WebGpuGraphics = 'software', platform: NodeJS.Platform = process.platform): string[] {
  if (graphics === 'auto' && platform !== 'linux') return ['--enable-unsafe-webgpu'];
  return [...SOFTWARE_WEBGPU_ARGS];
}
