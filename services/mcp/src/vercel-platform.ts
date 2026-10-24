// SPDX-License-Identifier: MPL-2.0
/**
 * What the Vercel function adapter (api/mcp/[...path].js) knows about its own
 * platform, written as the settings the rest of the server reads, so no other
 * module has to ask whether it runs on Vercel to size a request or a response.
 *
 * Imported first by vercel-entry.ts, so these values are in place before the
 * gateway and the modules it imports run. A value the Vercel project sets wins.
 *
 *   - A Vercel function is a hosted server (hosted.ts).
 *   - Vercel refuses a request or response body over 4.5 MB with a bare platform
 *     error, so requests stop at 4.5 MB and answers at 4.4 MB, which leaves room
 *     for the headers, and the image proxy stops at 4 MiB for the same reason.
 *
 * Two Vercel facts stay where they are used, because they are about the platform
 * and not about being hosted: gateway.ts `clientIp` believes the address headers
 * Vercel's edge sets only on Vercel, and result-files.ts never holds a private
 * file there, because a function keeps no disk between calls.
 */

process.env.LOLLY_MCP_HOSTED ??= '1';
process.env.LOLLY_MCP_REQUEST_MAX_BYTES ??= '4500000';
process.env.LOLLY_MCP_RESPONSE_MAX_BYTES ??= '4400000';
process.env.LOLLY_MCP_MAX_IMAGE_BYTES ??= String(4 * 1024 * 1024);

export {};
