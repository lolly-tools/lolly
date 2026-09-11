// SPDX-License-Identifier: MPL-2.0
/**
 * Web implementation of `host.matte` (v1.103) - on-device background removal.
 *
 * The worker plumbing moved to lib/matte-wasm-api.ts (createWasmMatteAPI) so a
 * native shell override (shells/tauri-desktop/bridge-overrides/matte.ts) can reuse
 * it for the wasm-runnable models and only intercept a model that OOMs the wasm32
 * heap - no model on the roster does since the BiRefNet pair was removed
 * (2026-08-26). This file stays the module the
 * web host imports (bridge/index.ts → import('./matte.ts')); the Tauri build swaps
 * it for the override via vite.config.js's overrideBridgeModules, so keeping the
 * export name `createMatteAPI` here keeps both shells' import site identical.
 */
export { createWasmMatteAPI as createMatteAPI } from '../lib/matte-wasm-api.ts';
