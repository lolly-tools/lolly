// SPDX-License-Identifier: MPL-2.0
/**
 * NetAPI - controlled fetch for tools that declared the 'network' capability.
 *
 * The implementation MOVED to packages/node-shell/src/net.ts: it is entirely
 * DOM-free (global `fetch` + `TransformStream`), and the CLI and TUI shells build
 * host.net from it too. They used to reach across a submodule boundary into this
 * directory, which meant neither terminal shell could typecheck without
 * shells/web checked out. The shared package is the supported home; this file
 * stays as a stable re-export so every web import site keeps working unchanged.
 */

export { createNetAPI } from '../../../../packages/node-shell/src/net.ts';
