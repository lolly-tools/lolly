// SPDX-License-Identifier: MPL-2.0
/**
 * How a Node shell reads pinned CA roots out of a PATH-style list.
 *
 * The two terminal shells both accept `LOLLY_TRUST_ANCHOR` — a `path.delimiter`
 * separated list of PEM files — and both expand a leading `~`. They had two copies of
 * the splitting rules and the copies disagreed in a way that only bites on Windows: the
 * CLI hard-coded `':'` as the separator, which splits `C:\corp\root.pem` at the drive
 * letter and then reports two unreadable anchors. This module is the one set of rules.
 *
 * Deliberately only the PURE parts. What a shell does with an anchor it cannot read is
 * a product decision and stays per-shell: the CLI refuses the whole run (exit 2 — a
 * typo'd root must never quietly downgrade a verdict in a non-interactive gate), while
 * the TUI reports the failure in its verdict panel and carries on with the rest.
 */

import { homedir } from 'node:os';
import { delimiter } from 'node:path';

/** Expand a leading `~` to the home directory. `~foo` (another user) is left alone. */
export function expandHome(p: string): string {
  return p.startsWith('~') && (p.length === 1 || p[1] === '/') ? homedir() + p.slice(1) : p;
}

/**
 * Split a PATH-style list of PEM paths. Blanks dropped; `~` left for `expandHome`.
 * Arrays flatten, so a profile record may hold either spelling.
 */
export function splitAnchorList(v: unknown): string[] {
  if (Array.isArray(v)) return v.flatMap(splitAnchorList);
  if (typeof v !== 'string') return [];
  return v.split(delimiter).map(s => s.trim()).filter(Boolean);
}
