// SPDX-License-Identifier: MPL-2.0
/**
 * Public surface of the Lolly MCP server package.
 */

export { dispatch, PROTOCOL_VERSION, SERVER_INFO } from './server.ts';
export { createMcpHttpHandler, startHttpServer } from './http.ts';
export { TOOL_DEFS, callTool } from './tools.ts';
export { render, transform, RenderError } from './render.ts';
export type { RenderOpts, RenderResult } from './render.ts';
export { listTools, loadIndex } from './catalog.ts';
