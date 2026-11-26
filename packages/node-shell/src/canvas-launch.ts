// SPDX-License-Identifier: MPL-2.0
/**
 * The Chromium launch flag that keeps export renders byte-identical from run to run.
 *
 * Draw every 2D canvas with Skia's CPU rasteriser instead of the GPU process. An export
 * renders by drawing the page into a canvas (dom-to-image) and encoding that canvas. On
 * the accelerated canvas the pixels depend on what the GPU process drew before: in one
 * browser the first draw of a page, the second and the third each give their own
 * pixels, a few edge pixels one step apart, and every launch repeats the same sequence.
 * The CLI draws a varying number of previews before the export, so the same render gave
 * different PNG bytes from run to run. The PNG encoder was never the cause: the same
 * pixels encode to the same bytes. On the CPU canvas every draw of a page is identical
 * (`node scripts/probe-canvas-determinism.ts` measures both).
 *
 * Export launches only: the CLI and TUI browser tier (browsers.ts, `software`) and the
 * MCP renderer (services/mcp/src/render.ts). WebGL and WebGPU keep SwiftShader. Its own
 * module, with no imports, so the MCP function bundle can take it without the browser
 * resolver.
 */
export const CPU_CANVAS_ARGS: readonly string[] = Object.freeze(['--disable-accelerated-2d-canvas']);
