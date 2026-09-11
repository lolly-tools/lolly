// SPDX-License-Identifier: MPL-2.0
/**
 * Thin re-export - the headless-Chromium launcher moved to @lolly-tools/node-shell,
 * shared with the CLI. That also gives the TUI the CLI's full browsers-dir resolution
 * order (env overrides → the repo-root `.browsers` that `lolly install-browser`
 * populates → the services/mcp sibling install), where it previously only found the
 * MCP dir. Kept because url-capture.ts imports this path; new code should import the
 * package directly.
 */
export { BrowserError, getBrowser, browserInstalled, closeBrowser } from '@lolly-tools/node-shell/browsers';
