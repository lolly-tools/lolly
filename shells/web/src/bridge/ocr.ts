// SPDX-License-Identifier: MPL-2.0
/**
 * Web implementation of `host.ocr` (plans/125) - on-device text recognition.
 *
 * The worker plumbing lives in lib/ocr-wasm-api.ts (createWasmOcrAPI); this file is
 * the stable module the web host imports (bridge/index.ts → import('./ocr.ts')),
 * mirroring bridge/matte.ts so a future native shell override can swap it via
 * vite.config.js's overrideBridgeModules while the import site stays identical.
 */
export { createWasmOcrAPI as createOcrAPI } from '../lib/ocr-wasm-api.ts';
