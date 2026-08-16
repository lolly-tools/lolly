// SPDX-License-Identifier: MPL-2.0
/**
 * "Does this failure mean the Node host cannot do it, but a real browser can?"
 *
 * ONE implementation for every Node host that has a browser tier to escalate to: the
 * CLI (`shells/cli/src/run.ts`), the TUI, and the MCP server's transform path
 * (`services/mcp/src/render.ts`). It used to be copied into each of them, and the copies
 * drifted: the MCP twin still carried the ORIGINAL prose-only regex, so a tool hook that
 * says "isn't available in this app" (convert-image) failed hard over MCP while the same
 * hook escalated correctly on the CLI. Same question, two answers. There was no way to
 * tell from the outside which host you were talking to.
 *
 * TWO signals, in order of reliability:
 *
 *   1. A TYPED SENTINEL on the error - `err.code === 'NEEDS_BROWSER'`, or a truthy
 *      `err.needsBrowser`. This is the supported way for a tool hook to say it, and the
 *      only one not coupled to prose. Tool hooks ship as DATA from a different
 *      repository, so wording there and control flow here must not be the same thing.
 *   2. The prose regex, kept as a compatibility fallback for every already-shipped tool.
 *      It accepts the "is not"/"isn't"/"isn’t" split that caused the convert-image bug.
 *
 * A verification failure ("the rebuilt PDF still carries Info") reads like neither, so a
 * failed export gate still fails loudly rather than being retried in a browser.
 *
 * Accepts an Error or a bare message string - the MCP call site has only the message.
 */

/** `NEEDS_BROWSER`: the typed sentinel a tool hook (or a bridge) sets to ask for Tier B. */
export const NEEDS_BROWSER = 'NEEDS_BROWSER';

/**  "needs a browser canvas" · "is not / isn't / isn’t available in this app" ·
 *   "needs a browser" · "requires a browser" */
const PROSE = /browser canvas|n(?:['’]|o)t available in this app|needs a browser|requires a browser/i;

export function needsBrowserTier(err: unknown): boolean {
  if (err && typeof err === 'object') {
    const e = err as { code?: unknown; needsBrowser?: unknown };
    if (e.code === NEEDS_BROWSER || e.needsBrowser === true) return true;
  }
  const message = typeof err === 'string' ? err : (err as { message?: unknown } | null)?.message;
  if (typeof message !== 'string') return false;
  return PROSE.test(message);
}
