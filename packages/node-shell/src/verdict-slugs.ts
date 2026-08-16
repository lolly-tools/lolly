// SPDX-License-Identifier: MPL-2.0
/**
 * The verdict slug and headline for each engine-resolved C2PA state.
 *
 * The engine owns the ladder (`resolveVerdict`, engine/src/c2pa-verdict.ts): it decides
 * which state a file is in. This module owns the wording every machine surface uses to
 * report that state: the stable slug a script branches on, and the one-line headline.
 *
 * It lives here, in the shared Node package, because the CLI's `validate --json` and
 * the MCP `verify_file` tool answer the same question and must not answer it in two
 * vocabularies. That is not hypothetical: the verdict renderer was forked between the
 * CLI validator and the TUI profile view before, and the two ladders drifted until the
 * engine took the ladder back. This applies the same lesson to the slug.
 *
 * The slugs are a frozen machine surface: an existing one is never re-pointed, and a
 * new engine state adds a new slug.
 */

import type { C2paVerdictState } from '@lolly/engine';

export interface VerdictSlug {
  /** The stable machine handle, e.g. `made-with-lolly`. Branch on this. */
  verdict: string;
  /** One-line human wording. Not stable, never branch on it. */
  headline: string;
}

export const VERDICT_SLUGS: Record<C2paVerdictState, VerdictSlug> = {
  lolly: { verdict: 'made-with-lolly', headline: 'Made with Lolly — credential intact, file unchanged since export' },
  delivered: { verdict: 'delivered-by-lolly', headline: 'Delivered by Lolly — verified authentic official asset; delivered by Lolly, not created by it' },
  likelyLolly: { verdict: 'likely-made-with-lolly', headline: "Likely made with Lolly — the credential's own content checks out and records a Lolly export, but this file's bytes no longer match it" },
  expired: { verdict: 'credential-expired', headline: 'Credential expired — the file still matches what was signed; the one-year on-device certificate has lapsed' },
  trusted: { verdict: 'credential-intact', headline: 'Credential intact — signed on-device (integrity, not identity)' },
  valid: { verdict: 'credential-intact', headline: 'Credential intact — signed on-device (integrity, not identity)' },
  invalid: { verdict: 'credential-broken', headline: 'Credential broken — the file no longer matches what was signed' },
  none: { verdict: 'no-credential', headline: 'No Content Credentials found' },
};

/** The slug for a resolved state, tolerating a state this build has no wording for. */
export function verdictSlug(state: string): string {
  return VERDICT_SLUGS[state as C2paVerdictState]?.verdict ?? state;
}
