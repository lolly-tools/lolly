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
 *
 * `describeAnchorSet` is the other half of the same anti-drift rule: both shells must
 * say WHICH anchors produced a verdict in the same words, because "verified" is only
 * meaningful next to "verified by what" (contract §12 O1).
 */

import { homedir } from 'node:os';
import { basename, delimiter } from 'node:path';

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

/** What a shell fed to `verifyC2pa`, with enough provenance to explain a verdict. */
export interface AnchorSetFacts {
  /** Whether the Lolly CA root was pinned (default-on since contract §12 O1). */
  lollyRoot: boolean;
  /** How many roots came from the vendored C2PA known-certificate list. */
  vendored: number;
  /** Paths of the caller-pinned PEMs that loaded cleanly, in order. */
  pinned: readonly string[];
}

/**
 * The one sentence a terminal shell prints to say which anchor set produced a verdict.
 *
 * Written once here because the CLI and the TUI answer the same question: a file can
 * read "Credential intact" for two completely different reasons (nothing vouches for
 * the signer, or the caller deliberately verified against nothing), and a trust tool
 * that does not distinguish them is confidently unhelpful. Pure — no I/O, no colour.
 */
export function describeAnchorSet(f: AnchorSetFacts): string {
  const pinned = f.pinned.length ? f.pinned.map(p => basename(p)).join(', ') : 'none';
  const parts = [
    f.vendored ? `C2PA known-certificate list (${f.vendored})` : 'no built-in anchors',
    `pinned: ${pinned}`,
    f.lollyRoot ? 'Lolly CA root' : 'Lolly CA root NOT pinned',
  ];
  return `Trust anchors: ${parts.join(' · ')}`;
}
